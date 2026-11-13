import type {
  AiCapabilitiesStatus,
  AiMode,
  ApiAvailability,
  EnhanceStyle,
  PageContextInfo,
  PromptLintMeta,
} from '../shared/types.js';

type GlobalAiScope = typeof globalThis & {
  LanguageModel?: any;
  Rewriter?: any;
  Writer?: any;
  Summarizer?: any;
  Proofreader?: any;
  LanguageDetector?: any;
  Translator?: any;
  ai?: {
    languageModel?: any;
    rewriter?: any;
    writer?: any;
    summarizer?: any;
    proofreader?: any;
    languageDetector?: any;
    translator?: any;
  };
};

// Warm base sessions per style for instant session.clone() reuse
const warmBaseSessions = new Map<EnhanceStyle, any>();

function normalizeAvailability(raw: unknown): ApiAvailability {
  if (typeof raw === 'string') {
    if (raw === 'available' || raw === 'readily') return 'available';
    if (raw === 'downloadable' || raw === 'after-download') return 'downloadable';
    if (raw === 'downloading') return 'downloading';
    return 'unavailable';
  }
  if (raw && typeof raw === 'object' && 'available' in raw) {
    return normalizeAvailability((raw as { available: unknown }).available);
  }
  return 'unavailable';
}

async function checkApi(
  modernCtor: any,
  legacyObj: any,
  options?: Record<string, unknown>
): Promise<ApiAvailability> {
  try {
    if (modernCtor && typeof modernCtor.availability === 'function') {
      return normalizeAvailability(await modernCtor.availability(options));
    }
    if (legacyObj && typeof legacyObj.capabilities === 'function') {
      return normalizeAvailability(await legacyObj.capabilities(options));
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}

export async function getAiCapabilities(): Promise<AiCapabilitiesStatus> {
  const g = globalThis as GlobalAiScope;
  const [
    prompt,
    rewriter,
    writer,
    summarizer,
    proofreader,
    languageDetector,
    translator,
    multimodal,
  ] = await Promise.all([
    checkApi(g.LanguageModel, g.ai?.languageModel),
    checkApi(g.Rewriter, g.ai?.rewriter),
    checkApi(g.Writer, g.ai?.writer),
    checkApi(g.Summarizer, g.ai?.summarizer),
    checkApi(g.Proofreader, g.ai?.proofreader),
    checkApi(g.LanguageDetector, g.ai?.languageDetector),
    checkApi(g.Translator, g.ai?.translator, {
      sourceLanguage: 'es',
      targetLanguage: 'en',
    }),
    checkApi(g.LanguageModel, g.ai?.languageModel, {
      expectedInputs: [{ type: 'image' }],
    }),
  ]);

  return {
    prompt,
    rewriter,
    writer,
    summarizer,
    proofreader,
    languageDetector,
    translator,
    multimodal,
  };
}

const STYLE_INSTRUCTIONS: Record<EnhanceStyle, string> = {
  structured:
    'Structure the prompt clearly with Role, Context, Task, Constraints, and Output Format where helpful. Keep it sharp and actionable.',
  concise:
    'Make the prompt crisp, direct, and high-signal in as few words as possible while removing ambiguity.',
  coding:
    'Optimize for software engineering: specify language/stack assumptions, edge cases, constraints, error handling, and expected code/test output.',
  'step-by-step':
    'Instruct the AI to state key assumptions, reason step-by-step (Chain-of-Thought), and verify the final answer before concluding.',
  'few-shot':
    'Include 1-2 concise Input -> Output examples inside the prompt to anchor the exact expected format and tone.',
  clarify:
    'Instruct the AI to ask 2-3 targeted clarifying questions about missing context or constraints before producing the final response.',
  creative:
    'Enhance with vivid direction, tone, audience, style constraints, and creative framing while preserving the core intent.',
};

function buildSystemPrompt(style: EnhanceStyle): string {
  return [
    'You are an expert prompt engineer.',
    'Rewrite the user’s rough input into a clear, effective prompt ready to paste into an AI assistant.',
    STYLE_INSTRUCTIONS[style],
    'Output ONLY the improved prompt text. Do not include preamble, explanations, or markdown quotes around the entire output.',
  ].join(' ');
}

export interface RunAiOptions {
  pageContext?: PageContextInfo;
  screenshotDataUrl?: string;
  translateToEnglish?: boolean;
}

export interface StreamCallbacks {
  onChunk: (delta: string, fullText: string) => void;
  onDownloadProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

async function consumeStream(
  stream: AsyncIterable<string>,
  onChunk: (delta: string, fullText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  let fullText = '';
  for await (const rawChunk of stream) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const chunk = String(rawChunk ?? '');
    if (!chunk) continue;

    let delta = chunk;
    if (fullText.length > 0 && chunk.startsWith(fullText)) {
      delta = chunk.slice(fullText.length);
      fullText = chunk;
    } else {
      fullText += chunk;
    }
    if (delta) {
      onChunk(delta, fullText);
    }
  }
  return fullText.trim();
}

function attachMonitor(onDownloadProgress?: (progress: number) => void) {
  if (!onDownloadProgress) return undefined;
  return (m: EventTarget) => {
    m.addEventListener('downloadprogress', (e: Event) => {
      const loaded = (e as ProgressEvent).loaded ?? 0;
      onDownloadProgress(Math.min(100, Math.round(loaded * 100)));
    });
  };
}

async function detectLanguage(text: string): Promise<string | undefined> {
  const g = globalThis as GlobalAiScope;
  const api = g.LanguageDetector ?? g.ai?.languageDetector;
  const avail = await checkApi(g.LanguageDetector, g.ai?.languageDetector);
  if (!api || avail === 'unavailable') return undefined;
  try {
    const detector = await api.create();
    try {
      const results = await detector.detect(text);
      const top = Array.isArray(results) ? results[0] : null;
      return top?.detectedLanguage;
    } finally {
      detector.destroy?.();
    }
  } catch {
    return undefined;
  }
}

async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage = 'en'
): Promise<string | null> {
  const g = globalThis as GlobalAiScope;
  const api = g.Translator ?? g.ai?.translator;
  if (!api) return null;
  try {
    const avail = await checkApi(g.Translator, g.ai?.translator, {
      sourceLanguage,
      targetLanguage,
    });
    if (avail === 'unavailable') return null;
    const translator = await api.create({ sourceLanguage, targetLanguage });
    try {
      return (await translator.translate(text))?.trim() || null;
    } finally {
      translator.destroy?.();
    }
  } catch {
    return null;
  }
}

async function maybePreCondense(
  text: string,
  session: any,
  signal?: AbortSignal
): Promise<{ text: string; preCondensed: boolean }> {
  try {
    const quota =
      typeof session.inputQuota === 'number'
        ? session.inputQuota
        : typeof session.maxTokens === 'number'
          ? session.maxTokens
          : 0;
    if (quota <= 0 || typeof session.measureInputUsage !== 'function') {
      return { text, preCondensed: false };
    }
    const usage = await session.measureInputUsage(text);
    if (usage <= quota * 0.85) {
      return { text, preCondensed: false };
    }

    // Over 85% of local quota: try Summarizer API first
    const g = globalThis as GlobalAiScope;
    const sumApi = g.Summarizer ?? g.ai?.summarizer;
    const sumAvail = await checkApi(g.Summarizer, g.ai?.summarizer);
    if (sumApi && sumAvail !== 'unavailable') {
      const summarizer = await sumApi.create({
        type: 'key-points',
        format: 'plain-text',
        length: 'medium',
      });
      try {
        const condensed = await summarizer.summarize(text, { signal });
        if (condensed) {
          return { text: condensed.trim(), preCondensed: true };
        }
      } finally {
        summarizer.destroy?.();
      }
    }

    // Safe fallback truncation if Summarizer isn't available
    const ratio = (quota * 0.75) / Math.max(usage, 1);
    const maxChars = Math.max(200, Math.floor(text.length * ratio));
    return { text: text.slice(0, maxChars), preCondensed: true };
  } catch {
    return { text, preCondensed: false };
  }
}

async function getOrCloneSession(
  lm: any,
  style: EnhanceStyle,
  monitor?: (m: EventTarget) => void
): Promise<{ session: any; shouldDestroy: boolean }> {
  const existing = warmBaseSessions.get(style);
  if (existing && typeof existing.clone === 'function') {
    try {
      const cloned = await existing.clone();
      return { session: cloned, shouldDestroy: true };
    } catch {
      warmBaseSessions.delete(style);
      existing.destroy?.();
    }
  }

  const base = await lm.create({
    initialPrompts: [{ role: 'system', content: buildSystemPrompt(style) }],
    systemPrompt: buildSystemPrompt(style),
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    monitor,
  });

  if (typeof base.clone === 'function') {
    warmBaseSessions.set(style, base);
    try {
      const cloned = await base.clone();
      return { session: cloned, shouldDestroy: true };
    } catch {
      // Fall back to using base directly if clone fails
    }
  }
  return { session: base, shouldDestroy: true };
}

const LINT_SCHEMA = {
  type: 'object',
  required: ['score', 'missing'],
  additionalProperties: false,
  properties: {
    score: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'Clarity and specificity score from 1 to 10',
    },
    missing: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to 3 short missing elements (e.g. "Output Format", "Target Audience")',
    },
  },
};

async function lintPromptWithSchema(
  lm: any,
  enhancedPrompt: string,
  signal?: AbortSignal
): Promise<{ score: number; missing: string[] } | null> {
  try {
    const lintSession = await lm.create({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    try {
      const raw = await lintSession.prompt(
        `Evaluate this prompt for clarity and completeness (1-10) and list up to 3 short missing elements if any:\n\n${enhancedPrompt}`,
        { responseConstraint: LINT_SCHEMA, signal }
      );
      const parsed = JSON.parse(raw);
      return {
        score: Math.min(10, Math.max(1, Math.round(Number(parsed.score) || 7))),
        missing: Array.isArray(parsed.missing)
          ? parsed.missing.slice(0, 3).map((s: unknown) => String(s))
          : [],
      };
    } finally {
      lintSession.destroy?.();
    }
  } catch {
    return null;
  }
}

function buildContextPrefix(pageContext?: PageContextInfo): string {
  if (!pageContext) return '';
  const parts: string[] = [];
  if (pageContext.title) parts.push(`Page: ${pageContext.title} (${pageContext.host})`);
  if (pageContext.selection) parts.push(`Selected text: "${pageContext.selection}"`);
  return parts.length > 0 ? `[Local Page Context]\n${parts.join('\n')}\n\n` : '';
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function runLocalAiTask(
  prompt: string,
  mode: AiMode,
  style: EnhanceStyle,
  callbacks: StreamCallbacks,
  allowDemoFallback = false,
  options: RunAiOptions = {}
): Promise<{ text: string; usedDemoFallback: boolean; meta: PromptLintMeta }> {
  const g = globalThis as GlobalAiScope;
  const monitor = attachMonitor(callbacks.onDownloadProgress);
  const contextPrefix = buildContextPrefix(options.pageContext);

  const detectedLanguage = await detectLanguage(prompt);
  let workingPrompt = prompt;
  if (
    options.translateToEnglish &&
    detectedLanguage &&
    detectedLanguage !== 'en'
  ) {
    const translated = await translateText(prompt, detectedLanguage, 'en');
    if (translated) workingPrompt = translated;
  }

  const sharedContext = options.pageContext
    ? `Prompt engineering for an AI assistant. ${buildContextPrefix(options.pageContext)}`
    : 'Prompt engineering for an AI assistant.';

  try {
    if (!options.screenshotDataUrl && (mode === 'rewrite-concise' || mode === 'rewrite-formal')) {
      const api = g.Rewriter ?? g.ai?.rewriter;
      const avail = await checkApi(g.Rewriter, g.ai?.rewriter);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({
          tone: mode === 'rewrite-formal' ? 'more-formal' : 'as-is',
          length: mode === 'rewrite-concise' ? 'shorter' : 'as-is',
          sharedContext,
          monitor,
        });
        try {
          const stream = instance.rewriteStreaming
            ? instance.rewriteStreaming(workingPrompt, { signal: callbacks.signal })
            : null;
          const text = stream
            ? await consumeStream(stream, callbacks.onChunk, callbacks.signal)
            : await instance.rewrite(workingPrompt, { signal: callbacks.signal });
          if (!stream) callbacks.onChunk(text, text);
          return {
            text: text.trim(),
            usedDemoFallback: false,
            meta: { score: 8, missing: [], detectedLanguage },
          };
        } finally {
          instance.destroy?.();
        }
      }
    }

    if (!options.screenshotDataUrl && mode === 'expand') {
      const api = g.Writer ?? g.ai?.writer;
      const avail = await checkApi(g.Writer, g.ai?.writer);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({
          tone: 'neutral',
          length: 'medium',
          sharedContext,
          monitor,
        });
        try {
          const stream = instance.writeStreaming
            ? instance.writeStreaming(workingPrompt, { signal: callbacks.signal })
            : null;
          const text = stream
            ? await consumeStream(stream, callbacks.onChunk, callbacks.signal)
            : await instance.write(workingPrompt, { signal: callbacks.signal });
          if (!stream) callbacks.onChunk(text, text);
          return {
            text: text.trim(),
            usedDemoFallback: false,
            meta: { score: 8, missing: [], detectedLanguage },
          };
        } finally {
          instance.destroy?.();
        }
      }
    }

    if (!options.screenshotDataUrl && mode === 'summarize') {
      const api = g.Summarizer ?? g.ai?.summarizer;
      const avail = await checkApi(g.Summarizer, g.ai?.summarizer);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({
          type: 'key-points',
          format: 'plain-text',
          length: 'short',
          monitor,
        });
        try {
          const stream = instance.summarizeStreaming
            ? instance.summarizeStreaming(workingPrompt, { signal: callbacks.signal })
            : null;
          const text = stream
            ? await consumeStream(stream, callbacks.onChunk, callbacks.signal)
            : await instance.summarize(workingPrompt, { signal: callbacks.signal });
          if (!stream) callbacks.onChunk(text, text);
          return {
            text: text.trim(),
            usedDemoFallback: false,
            meta: { score: 8, missing: [], detectedLanguage },
          };
        } finally {
          instance.destroy?.();
        }
      }
    }

    if (!options.screenshotDataUrl && mode === 'proofread') {
      const api = g.Proofreader ?? g.ai?.proofreader;
      const avail = await checkApi(g.Proofreader, g.ai?.proofreader);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({ monitor });
        try {
          const result = await instance.proofread(workingPrompt, {
            signal: callbacks.signal,
          });
          const corrected =
            typeof result === 'string' ? result : result?.corrected ?? workingPrompt;
          callbacks.onChunk(corrected, corrected);
          return {
            text: corrected.trim(),
            usedDemoFallback: false,
            meta: { score: 9, missing: [], detectedLanguage },
          };
        } finally {
          instance.destroy?.();
        }
      }
    }

    // Prompt API (LanguageModel) — supports warm session.clone(), quota guardrails, multimodal image, and JSON Schema linting
    const lm = g.LanguageModel ?? g.ai?.languageModel;
    const lmAvail = await checkApi(g.LanguageModel, g.ai?.languageModel);
    if (lm && lmAvail !== 'unavailable') {
      let usedScreenshot = false;
      let session: any;
      let shouldDestroy = true;

      if (options.screenshotDataUrl) {
        const mmAvail = await checkApi(g.LanguageModel, g.ai?.languageModel, {
          expectedInputs: [{ type: 'image' }],
        });
        if (mmAvail !== 'unavailable') {
          session = await lm.create({
            initialPrompts: [{ role: 'system', content: buildSystemPrompt(style) }],
            expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
            monitor,
          });
          usedScreenshot = true;
        }
      }

      if (!session) {
        const res = await getOrCloneSession(lm, style, monitor);
        session = res.session;
        shouldDestroy = res.shouldDestroy;
      }

      try {
        const modePrompts: Record<AiMode, string> = {
          enhance: `${contextPrefix}Enhance this rough prompt:\n\n${workingPrompt}`,
          'rewrite-concise': `${contextPrefix}Rewrite this prompt to be much more concise and direct without losing intent:\n\n${workingPrompt}`,
          'rewrite-formal': `${contextPrefix}Rewrite this prompt in a clear, professional, formal tone:\n\n${workingPrompt}`,
          expand: `${contextPrefix}Expand this brief idea into a comprehensive, well-structured prompt:\n\n${workingPrompt}`,
          summarize: `${contextPrefix}Condense this prompt into its core instructions and key bullet points:\n\n${workingPrompt}`,
          proofread: `${contextPrefix}Fix grammar, spelling, and clarity in this prompt without changing its meaning:\n\n${workingPrompt}`,
        };

        const { text: safePrompt, preCondensed } = await maybePreCondense(
          modePrompts[mode],
          session,
          callbacks.signal
        );

        const promptInput =
          usedScreenshot && options.screenshotDataUrl
            ? [
                {
                  role: 'user',
                  content: [
                    { type: 'text', value: safePrompt },
                    {
                      type: 'image',
                      value: await dataUrlToBlob(options.screenshotDataUrl),
                    },
                  ],
                },
              ]
            : safePrompt;

        let text = '';
        if (typeof session.promptStreaming === 'function') {
          const stream = session.promptStreaming(promptInput, {
            signal: callbacks.signal,
          });
          text = await consumeStream(stream, callbacks.onChunk, callbacks.signal);
        } else {
          const result = await session.prompt(promptInput, {
            signal: callbacks.signal,
          });
          text = result.trim();
          callbacks.onChunk(text, text);
        }

        const lint = await lintPromptWithSchema(lm, text, callbacks.signal);
        return {
          text,
          usedDemoFallback: false,
          meta: {
            score: lint?.score ?? 8,
            missing: lint?.missing ?? [],
            detectedLanguage,
            preCondensed,
            usedScreenshot,
          },
        };
      } finally {
        if (shouldDestroy) session.destroy?.();
      }
    }

    if (allowDemoFallback) {
      return await runDemoEnhancement(prompt, mode, style, callbacks, options);
    }

    throw new AiUnavailableError(
      'Chrome Built-in AI (Gemini Nano) is not enabled or available in this browser.'
    );
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    if ((err as Error)?.name === 'AbortError') throw err;
    throw err;
  }
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

async function runDemoEnhancement(
  prompt: string,
  mode: AiMode,
  style: EnhanceStyle,
  callbacks: StreamCallbacks,
  options: RunAiOptions
): Promise<{ text: string; usedDemoFallback: boolean; meta: PromptLintMeta }> {
  const clean = prompt.trim();
  const ctxNote = options.pageContext
    ? `\nContext: ${options.pageContext.title}${options.pageContext.selection ? ` ("${options.pageContext.selection.slice(0, 80)}")` : ''}`
    : '';
  const shotNote = options.screenshotDataUrl ? '\n[Attached visible tab screenshot]' : '';
  let result = '';

  if (mode === 'rewrite-concise') {
    result = `${clean.replace(/\s+/g, ' ')} — Be concise, direct, and output only the final answer.`;
  } else if (mode === 'rewrite-formal') {
    result = `Please ${clean.charAt(0).toLowerCase() + clean.slice(1)}. Ensure the response is professional, accurate, and well-structured.`;
  } else if (mode === 'proofread') {
    result = clean.charAt(0).toUpperCase() + clean.slice(1) + (/[.!?]$/.test(clean) ? '' : '.');
  } else if (mode === 'summarize') {
    result = `Core goal: ${clean}\nKey constraints: Keep it brief and actionable.`;
  } else if (style === 'coding') {
    result = `Act as a senior software engineer.\n\nTask: ${clean}${ctxNote}${shotNote}\n\nRequirements:\n- Provide clean, idiomatic, production-ready code.\n- Handle edge cases and errors explicitly.\n- Include a brief usage example.`;
  } else if (style === 'step-by-step') {
    result = `Task: ${clean}${ctxNote}${shotNote}\n\nInstructions:\n1. State any key assumptions first.\n2. Work through the problem step-by-step.\n3. Verify edge cases before giving the final answer.`;
  } else if (style === 'few-shot') {
    result = `Task: ${clean}${ctxNote}${shotNote}\n\nFollow the exact format shown below:\nExample Input: <sample input>\nExample Output: <concise expected output>\n\nNow process the actual input with the same structure.`;
  } else if (style === 'clarify') {
    result = `Goal: ${clean}${ctxNote}${shotNote}\n\nBefore generating the full solution, ask 2–3 targeted clarifying questions about scope, constraints, and audience. Wait for my answers first.`;
  } else if (style === 'concise') {
    result = `Task: ${clean}${ctxNote}${shotNote}\nConstraints: Be direct, accurate, and avoid filler.`;
  } else {
    result = `Role: Expert assistant.\nTask: ${clean}${ctxNote}${shotNote}\n\nInstructions:\n1. Clarify assumptions briefly if needed.\n2. Provide a structured, step-by-step response.\n3. End with a concise summary or next action.`;
  }

  const tokens = result.split(/(\s+)/);
  let fullText = '';
  for (const token of tokens) {
    if (callbacks.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    fullText += token;
    callbacks.onChunk(token, fullText);
    await new Promise((r) => setTimeout(r, 10));
  }

  const missing: string[] = [];
  if (!options.pageContext) missing.push('Target Audience');
  if (style !== 'coding') missing.push('Output Format');

  return {
    text: fullText.trim(),
    usedDemoFallback: true,
    meta: {
      score: 8,
      missing,
      detectedLanguage: /[áéíóúñ¿¡]|bonjour|merci/i.test(clean) ? 'es' : 'en',
      preCondensed: clean.length > 2000,
      usedScreenshot: Boolean(options.screenshotDataUrl),
    },
  };
}
