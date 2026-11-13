import type {
  AiCapabilitiesStatus,
  AiMode,
  ApiAvailability,
  EnhanceStyle,
} from '../shared/types.js';

type GlobalAiScope = typeof globalThis & {
  LanguageModel?: any;
  Rewriter?: any;
  Writer?: any;
  Summarizer?: any;
  Proofreader?: any;
  ai?: {
    languageModel?: any;
    rewriter?: any;
    writer?: any;
    summarizer?: any;
    proofreader?: any;
  };
};

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
  legacyObj: any
): Promise<ApiAvailability> {
  try {
    if (modernCtor && typeof modernCtor.availability === 'function') {
      return normalizeAvailability(await modernCtor.availability());
    }
    if (legacyObj && typeof legacyObj.capabilities === 'function') {
      return normalizeAvailability(await legacyObj.capabilities());
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}

export async function getAiCapabilities(): Promise<AiCapabilitiesStatus> {
  const g = globalThis as GlobalAiScope;
  const [prompt, rewriter, writer, summarizer, proofreader] = await Promise.all([
    checkApi(g.LanguageModel, g.ai?.languageModel),
    checkApi(g.Rewriter, g.ai?.rewriter),
    checkApi(g.Writer, g.ai?.writer),
    checkApi(g.Summarizer, g.ai?.summarizer),
    checkApi(g.Proofreader, g.ai?.proofreader),
  ]);

  return { prompt, rewriter, writer, summarizer, proofreader };
}

const STYLE_INSTRUCTIONS: Record<EnhanceStyle, string> = {
  structured:
    'Structure the prompt clearly with Role, Context, Task, Constraints, and Output Format where helpful. Keep it sharp and actionable.',
  concise:
    'Make the prompt crisp, direct, and high-signal in as few words as possible while removing ambiguity.',
  coding:
    'Optimize for software engineering: specify language/stack assumptions, edge cases, constraints, error handling, and expected code/test output.',
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

    // Handle both cumulative streams (legacy window.ai) and delta streams (modern spec)
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

export async function runLocalAiTask(
  prompt: string,
  mode: AiMode,
  style: EnhanceStyle,
  callbacks: StreamCallbacks,
  allowDemoFallback: boolean = false
): Promise<{ text: string; usedDemoFallback: boolean }> {
  const g = globalThis as GlobalAiScope;
  const monitor = attachMonitor(callbacks.onDownloadProgress);

  try {
    if (mode === 'rewrite-concise' || mode === 'rewrite-formal') {
      const api = g.Rewriter ?? g.ai?.rewriter;
      const avail = await checkApi(g.Rewriter, g.ai?.rewriter);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({
          tone: mode === 'rewrite-formal' ? 'more-formal' : 'as-is',
          length: mode === 'rewrite-concise' ? 'shorter' : 'as-is',
          sharedContext: 'Prompt engineering for an AI assistant.',
          monitor,
        });
        try {
          const stream = instance.rewriteStreaming
            ? instance.rewriteStreaming(prompt, { signal: callbacks.signal })
            : null;
          if (stream) {
            const text = await consumeStream(stream, callbacks.onChunk, callbacks.signal);
            return { text, usedDemoFallback: false };
          }
          const result = await instance.rewrite(prompt, { signal: callbacks.signal });
          callbacks.onChunk(result, result);
          return { text: result.trim(), usedDemoFallback: false };
        } finally {
          instance.destroy?.();
        }
      }
    }

    if (mode === 'expand') {
      const api = g.Writer ?? g.ai?.writer;
      const avail = await checkApi(g.Writer, g.ai?.writer);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({
          tone: 'neutral',
          length: 'medium',
          sharedContext: 'Expand a rough idea into a detailed, well-structured AI prompt.',
          monitor,
        });
        try {
          const stream = instance.writeStreaming
            ? instance.writeStreaming(prompt, { signal: callbacks.signal })
            : null;
          if (stream) {
            const text = await consumeStream(stream, callbacks.onChunk, callbacks.signal);
            return { text, usedDemoFallback: false };
          }
          const result = await instance.write(prompt, { signal: callbacks.signal });
          callbacks.onChunk(result, result);
          return { text: result.trim(), usedDemoFallback: false };
        } finally {
          instance.destroy?.();
        }
      }
    }

    if (mode === 'summarize') {
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
            ? instance.summarizeStreaming(prompt, { signal: callbacks.signal })
            : null;
          if (stream) {
            const text = await consumeStream(stream, callbacks.onChunk, callbacks.signal);
            return { text, usedDemoFallback: false };
          }
          const result = await instance.summarize(prompt, { signal: callbacks.signal });
          callbacks.onChunk(result, result);
          return { text: result.trim(), usedDemoFallback: false };
        } finally {
          instance.destroy?.();
        }
      }
    }

    if (mode === 'proofread') {
      const api = g.Proofreader ?? g.ai?.proofreader;
      const avail = await checkApi(g.Proofreader, g.ai?.proofreader);
      if (api && avail !== 'unavailable') {
        const instance = await api.create({ monitor });
        try {
          const result = await instance.proofread(prompt, { signal: callbacks.signal });
          const corrected = typeof result === 'string' ? result : result?.corrected ?? prompt;
          callbacks.onChunk(corrected, corrected);
          return { text: corrected.trim(), usedDemoFallback: false };
        } finally {
          instance.destroy?.();
        }
      }
    }

    // Default / Fallback to Prompt API (LanguageModel) for 'enhance' or when specialized APIs aren't enabled
    const lm = g.LanguageModel ?? g.ai?.languageModel;
    const lmAvail = await checkApi(g.LanguageModel, g.ai?.languageModel);
    if (lm && lmAvail !== 'unavailable') {
      const modePrompts: Record<AiMode, string> = {
        enhance: `Enhance this rough prompt:\n\n${prompt}`,
        'rewrite-concise': `Rewrite this prompt to be much more concise and direct without losing intent:\n\n${prompt}`,
        'rewrite-formal': `Rewrite this prompt in a clear, professional, formal tone:\n\n${prompt}`,
        expand: `Expand this brief idea into a comprehensive, well-structured prompt:\n\n${prompt}`,
        summarize: `Condense this prompt into its core instructions and key bullet points:\n\n${prompt}`,
        proofread: `Fix grammar, spelling, and clarity in this prompt without changing its meaning:\n\n${prompt}`,
      };

      const session = await lm.create({
        initialPrompts: [{ role: 'system', content: buildSystemPrompt(style) }],
        systemPrompt: buildSystemPrompt(style),
        monitor,
      });

      try {
        if (typeof session.promptStreaming === 'function') {
          const stream = session.promptStreaming(modePrompts[mode], {
            signal: callbacks.signal,
          });
          const text = await consumeStream(stream, callbacks.onChunk, callbacks.signal);
          return { text, usedDemoFallback: false };
        }
        const result = await session.prompt(modePrompts[mode], {
          signal: callbacks.signal,
        });
        callbacks.onChunk(result, result);
        return { text: result.trim(), usedDemoFallback: false };
      } finally {
        session.destroy?.();
      }
    }

    if (allowDemoFallback) {
      return await runDemoEnhancement(prompt, mode, style, callbacks);
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
  callbacks: StreamCallbacks
): Promise<{ text: string; usedDemoFallback: boolean }> {
  const clean = prompt.trim();
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
    result = `Act as a senior software engineer.\n\nTask: ${clean}\n\nRequirements:\n- Provide clean, idiomatic, production-ready code.\n- Handle edge cases and errors explicitly.\n- Include a brief usage example.`;
  } else if (style === 'concise') {
    result = `Task: ${clean}\nConstraints: Be direct, accurate, and avoid filler.`;
  } else {
    result = `Role: Expert assistant.\nTask: ${clean}\n\nInstructions:\n1. Clarify assumptions briefly if needed.\n2. Provide a structured, step-by-step response.\n3. End with a concise summary or next action.`;
  }

  // Stream word-by-word so the UI streaming state is exercised realistically
  const tokens = result.split(/(\s+)/);
  let fullText = '';
  for (const token of tokens) {
    if (callbacks.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    fullText += token;
    callbacks.onChunk(token, fullText);
    await new Promise((r) => setTimeout(r, 12));
  }

  return { text: fullText.trim(), usedDemoFallback: true };
}
