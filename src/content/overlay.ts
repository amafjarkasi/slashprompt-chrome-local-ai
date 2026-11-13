import type { AiMode, EnhanceStyle } from '../shared/types.js';

export interface OverlayCallbacks {
  onEnhance: (mode: AiMode, style: EnhanceStyle) => void;
  onReplace: (text: string) => void;
  onDismiss: () => void;
  onCancel: () => void;
}

const STYLES = `
:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  color-scheme: light dark;
}

* {
  box-sizing: border-box;
}

.sp-root {
  --bg: rgba(255, 255, 255, 0.92);
  --bg-muted: rgba(244, 244, 245, 0.9);
  --border: rgba(24, 24, 27, 0.1);
  --text: #18181b;
  --text-muted: #71717a;
  --accent: #18181b;
  --accent-text: #ffffff;
  --chip-hover: rgba(24, 24, 27, 0.06);
  --shadow: 0 12px 36px -8px rgba(0, 0, 0, 0.16), 0 2px 8px -2px rgba(0, 0, 0, 0.06);
}

@media (prefers-color-scheme: dark) {
  .sp-root {
    --bg: rgba(24, 24, 27, 0.92);
    --bg-muted: rgba(39, 39, 42, 0.9);
    --border: rgba(255, 255, 255, 0.12);
    --text: #f4f4f5;
    --text-muted: #a1a1aa;
    --accent: #fafafa;
    --accent-text: #18181b;
    --chip-hover: rgba(255, 255, 255, 0.08);
    --shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.55), 0 2px 10px -2px rgba(0, 0, 0, 0.3);
  }
}

.sp-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 10px;
  background: var(--bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 12.5px;
  line-height: 1;
  animation: sp-pop 0.14s cubic-bezier(0.16, 1, 0.3, 1);
}

.sp-card {
  width: 380px;
  max-width: calc(100vw - 24px);
  background: var(--bg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  color: var(--text);
  overflow: hidden;
  animation: sp-pop 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes sp-pop {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.sp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.sp-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.sp-badge {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-muted);
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.sp-select {
  appearance: none;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text);
  font-size: 11.5px;
  padding: 4px 10px;
  cursor: pointer;
  outline: none;
}

.sp-select:hover {
  background: var(--chip-hover);
}

.sp-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--accent);
  color: var(--accent-text);
  border: none;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.12s ease;
}

.sp-btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.sp-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sp-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
}

.sp-btn-ghost:hover {
  color: var(--text);
  background: var(--chip-hover);
}

.sp-body {
  padding: 12px;
}

.sp-preview {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 210px;
  overflow-y: auto;
  color: var(--text);
  min-height: 44px;
}

.sp-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.sp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  animation: sp-pulse 1.1s infinite ease-in-out;
}

@keyframes sp-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
}

.sp-error {
  font-size: 12.5px;
  line-height: 1.45;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.22);
  border-radius: 10px;
  padding: 10px;
}

.sp-error-help {
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.sp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 12px 10px;
}

.sp-chip {
  background: var(--bg-muted);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.sp-chip:hover {
  color: var(--text);
  background: var(--chip-hover);
}

.sp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-muted);
}

.sp-kbd {
  font-size: 10.5px;
  opacity: 0.7;
}
`;

export class FloatingOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private root: HTMLDivElement;
  private callbacks: OverlayCallbacks;
  private currentMode: AiMode = 'enhance';
  private currentStyle: EnhanceStyle = 'structured';
  private viewState: 'hidden' | 'pill' | 'card' = 'hidden';
  private resultText = '';
  private isStreaming = false;

  constructor(callbacks: OverlayCallbacks, defaultStyle: EnhanceStyle) {
    this.callbacks = callbacks;
    this.currentStyle = defaultStyle;

    this.host = document.createElement('div');
    this.host.id = 'slashprompt-overlay-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES;

    this.root = document.createElement('div');
    this.root.className = 'sp-root';

    this.shadow.appendChild(styleEl);
    this.shadow.appendChild(this.root);
  }

  public isVisible(): boolean {
    return this.viewState !== 'hidden';
  }

  public isCardOpen(): boolean {
    return this.viewState === 'card';
  }

  public getResultText(): string {
    return this.resultText;
  }

  public showPill(rect: DOMRect): void {
    this.viewState = 'pill';
    this.mount();
    this.renderPill();
    this.positionNear(rect, 310, 40);
  }

  public showCardLoading(rect: DOMRect, mode: AiMode, style: EnhanceStyle): void {
    this.currentMode = mode;
    this.currentStyle = style;
    this.viewState = 'card';
    this.isStreaming = true;
    this.resultText = '';
    this.mount();
    this.renderCard({ statusText: 'Enhancing locally with Gemini Nano...' });
    this.positionNear(rect, 380, 260);
  }

  public updateDownloadProgress(progress: number): void {
    if (this.viewState !== 'card') return;
    this.renderCard({
      statusText: `Preparing on-device AI model (${progress}%)...`,
    });
  }

  public updateStream(fullText: string): void {
    if (this.viewState !== 'card') return;
    this.resultText = fullText;
    this.renderCard({ statusText: 'Generating locally...' });
  }

  public finishStream(fullText: string, usedDemoFallback = false): void {
    if (this.viewState !== 'card') return;
    this.isStreaming = false;
    this.resultText = fullText;
    this.renderCard({
      badge: usedDemoFallback ? 'Demo Mode' : 'On-Device AI',
    });
  }

  public showError(message: string, needsSetup = false): void {
    if (this.viewState !== 'card') return;
    this.isStreaming = false;
    this.renderCard({ error: message, needsSetup });
  }

  public hide(): void {
    this.viewState = 'hidden';
    this.isStreaming = false;
    this.resultText = '';
    this.root.innerHTML = '';
    this.host.remove();
  }

  private mount(): void {
    if (!this.host.isConnected && document.body) {
      document.body.appendChild(this.host);
    }
  }

  private positionNear(rect: DOMRect, width: number, approxHeight: number): void {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = Math.max(margin, Math.min(rect.left, vw - width - margin));
    let top = rect.bottom + margin;

    if (top + approxHeight > vh - margin && rect.top - approxHeight - margin > margin) {
      top = rect.top - approxHeight - margin;
    } else {
      top = Math.min(top, vh - approxHeight - margin);
    }

    this.host.style.left = `${Math.round(left)}px`;
    this.host.style.top = `${Math.round(Math.max(margin, top))}px`;
  }

  private renderPill(): void {
    this.root.innerHTML = '';
    const pill = document.createElement('div');
    pill.className = 'sp-pill';
    pill.setAttribute('data-testid', 'slashprompt-pill');

    const label = document.createElement('span');
    label.textContent = '✨';

    const modeSelect = document.createElement('select');
    modeSelect.className = 'sp-select';
    modeSelect.setAttribute('aria-label', 'AI Mode');
    const modes: Array<[AiMode, string]> = [
      ['enhance', 'Enhance'],
      ['rewrite-concise', 'Concise'],
      ['rewrite-formal', 'Formal'],
      ['expand', 'Expand'],
      ['proofread', 'Proofread'],
      ['summarize', 'Summarize'],
    ];
    for (const [val, text] of modes) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === this.currentMode) opt.selected = true;
      modeSelect.appendChild(opt);
    }
    modeSelect.addEventListener('change', () => {
      this.currentMode = modeSelect.value as AiMode;
    });
    modeSelect.addEventListener('mousedown', (e) => e.stopPropagation());

    const enhanceBtn = document.createElement('button');
    enhanceBtn.type = 'button';
    enhanceBtn.className = 'sp-btn-primary';
    enhanceBtn.setAttribute('data-testid', 'slashprompt-enhance-btn');
    enhanceBtn.innerHTML = `Enhance <span class="sp-kbd">Ctrl+↵</span>`;
    enhanceBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onEnhance(this.currentMode, this.currentStyle);
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sp-btn-ghost';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacks.onDismiss();
    });

    pill.append(label, modeSelect, enhanceBtn, closeBtn);
    this.root.appendChild(pill);
  }

  private renderCard(opts: {
    statusText?: string;
    badge?: string;
    error?: string;
    needsSetup?: boolean;
  }): void {
    this.root.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'sp-card';
    card.setAttribute('data-testid', 'slashprompt-card');

    // Header
    const header = document.createElement('div');
    header.className = 'sp-header';

    const brand = document.createElement('div');
    brand.className = 'sp-brand';
    const title = document.createElement('span');
    title.textContent = '✨ SlashPrompt';
    const badge = document.createElement('span');
    badge.className = 'sp-badge';
    badge.textContent = opts.badge ?? 'Local AI';
    brand.append(title, badge);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sp-btn-ghost';
    closeBtn.textContent = 'Esc';
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.callbacks.onCancel();
      this.callbacks.onDismiss();
    });

    header.append(brand, closeBtn);
    card.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'sp-body';

    if (opts.error) {
      const errBox = document.createElement('div');
      errBox.className = 'sp-error';
      errBox.textContent = opts.error;
      if (opts.needsSetup) {
        const help = document.createElement('div');
        help.className = 'sp-error-help';
        help.textContent =
          'Open the SlashPrompt toolbar icon for the Chrome Built-in AI setup checklist or enable Demo Mode.';
        errBox.appendChild(help);
      }
      body.appendChild(errBox);
    } else {
      if (this.isStreaming && opts.statusText) {
        const status = document.createElement('div');
        status.className = 'sp-status';
        const dot = document.createElement('span');
        dot.className = 'sp-dot';
        const statusLabel = document.createElement('span');
        statusLabel.textContent = opts.statusText;
        status.append(dot, statusLabel);
        body.appendChild(status);
      }

      const preview = document.createElement('div');
      preview.className = 'sp-preview';
      preview.setAttribute('data-testid', 'slashprompt-preview');
      preview.textContent = this.resultText || '…';
      body.appendChild(preview);
      preview.scrollTop = preview.scrollHeight;
    }

    card.appendChild(body);

    // Quick refine chips (when finished and no error)
    if (!this.isStreaming && !opts.error && this.resultText) {
      const chips = document.createElement('div');
      chips.className = 'sp-chips';

      const refines: Array<{ label: string; mode: AiMode; style: EnhanceStyle }> = [
        { label: 'Shorter', mode: 'rewrite-concise', style: 'concise' },
        { label: 'Formal', mode: 'rewrite-formal', style: this.currentStyle },
        { label: 'Coding', mode: 'enhance', style: 'coding' },
        { label: '↻ Retry', mode: this.currentMode, style: this.currentStyle },
      ];

      for (const r of refines) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sp-chip';
        chip.textContent = r.label;
        chip.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.callbacks.onEnhance(r.mode, r.style);
        });
        chips.appendChild(chip);
      }
      card.appendChild(chips);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'sp-footer';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'sp-btn-ghost';
    copyBtn.textContent = 'Copy';
    copyBtn.disabled = !this.resultText;
    copyBtn.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      if (!this.resultText) return;
      await navigator.clipboard.writeText(this.resultText);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1400);
    });

    const replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'sp-btn-primary';
    replaceBtn.setAttribute('data-testid', 'slashprompt-replace-btn');
    replaceBtn.disabled = this.isStreaming || !this.resultText;
    replaceBtn.innerHTML = `Replace <span class="sp-kbd">↵</span>`;
    replaceBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!this.isStreaming && this.resultText) {
        this.callbacks.onReplace(this.resultText);
      }
    });

    footer.append(copyBtn, replaceBtn);
    card.appendChild(footer);

    this.root.appendChild(card);
  }
}
