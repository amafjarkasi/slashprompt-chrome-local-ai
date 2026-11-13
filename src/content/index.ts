import { getSettings } from '../shared/storage.js';
import type { TriggerMatch } from '../shared/trigger.js';
import {
  DEFAULT_SETTINGS,
  type EnhanceRequest,
  type ExtensionSettings,
  type StreamPortMessage,
} from '../shared/types.js';
import {
  getTargetAnchorRect,
  isEditableTarget,
  readTargetTrigger,
  replaceTargetRange,
  type EditableElement,
} from './domTarget.js';
import { FloatingOverlay, type OverlayEnhanceOpts } from './overlay.js';

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let activeTarget: EditableElement | null = null;
let activeMatch: TriggerMatch | null = null;
let activePort: chrome.runtime.Port | null = null;

const overlay = new FloatingOverlay(
  {
    onEnhance: (opts) => startEnhancement(opts),
    onReplace: (text) => applyReplacement(text),
    onDismiss: () => dismiss(),
    onCancel: () => cancelStream(),
  },
  settings.defaultStyle
);

async function init() {
  try {
    settings = await getSettings();
    overlay.setDefaultStyle(settings.defaultStyle);
  } catch {
    // Fallback to defaults if storage isn't ready
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.slashprompt_settings?.newValue) {
      settings = { ...DEFAULT_SETTINGS, ...changes.slashprompt_settings.newValue };
      overlay.setDefaultStyle(settings.defaultStyle);
      if (!settings.enabled) {
        dismiss();
      }
    }
  });
}

function cancelStream() {
  if (activePort) {
    try {
      activePort.disconnect();
    } catch {
      // ignore
    }
    activePort = null;
  }
}

function dismiss() {
  cancelStream();
  overlay.hide();
  activeMatch = null;
}

function startEnhancement(opts: OverlayEnhanceOpts) {
  if (!activeTarget || !activeMatch) return;
  cancelStream();

  const rect = getTargetAnchorRect(activeTarget);
  overlay.showCardLoading(rect, opts.mode, opts.style);

  const port = chrome.runtime.connect({ name: 'slashprompt-stream' });
  activePort = port;

  port.onMessage.addListener((msg: StreamPortMessage) => {
    if (port !== activePort) return;
    if (msg.type === 'DOWNLOAD_PROGRESS') {
      overlay.updateDownloadProgress(msg.progress);
    } else if (msg.type === 'CHUNK') {
      overlay.updateStream(msg.fullText);
    } else if (msg.type === 'DONE') {
      overlay.finishStream(msg.fullText, msg.usedDemoFallback, msg.meta);
      activePort = null;
      try {
        port.disconnect();
      } catch {
        // ignore
      }
    } else if (msg.type === 'ERROR') {
      overlay.showError(msg.error, msg.needsSetup);
      activePort = null;
      try {
        port.disconnect();
      } catch {
        // ignore
      }
    }
  });

  port.onDisconnect.addListener(() => {
    if (port === activePort) {
      activePort = null;
    }
  });

  const selection = window.getSelection()?.toString().trim().slice(0, 800);
  const payload: EnhanceRequest = {
    type: 'ENHANCE_PROMPT',
    prompt: activeMatch.query,
    mode: opts.mode,
    style: opts.style,
    includeScreenshot: opts.includeScreenshot,
    translateToEnglish: opts.translateToEnglish,
    pageContext: opts.includePageContext
      ? {
          title: document.title,
          host: location.hostname,
          selection: selection || undefined,
        }
      : undefined,
  };
  port.postMessage(payload);
}

function applyReplacement(text: string) {
  if (!activeTarget || !activeMatch) return;
  replaceTargetRange(activeTarget, activeMatch.start, activeMatch.end, text);
  dismiss();
}

function evaluateTarget(target: EventTarget | null) {
  if (!settings.enabled) return;
  if (overlay.isCardOpen()) return;
  if (!isEditableTarget(target)) {
    if (overlay.isVisible()) dismiss();
    return;
  }

  const match = readTargetTrigger(target, settings.triggerPrefix);
  if (match) {
    activeTarget = target;
    activeMatch = match;
    const rect = getTargetAnchorRect(target);
    overlay.showPill(rect);
  } else if (overlay.isVisible()) {
    dismiss();
  }
}

document.addEventListener(
  'input',
  (e) => {
    if (e.composedPath().includes(overlay.getHost())) return;
    evaluateTarget(e.target);
  },
  true
);

document.addEventListener(
  'keyup',
  (e) => {
    if (e.key === 'Escape' && overlay.isVisible()) {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.composedPath().includes(overlay.getHost())) return;
    if (!overlay.isCardOpen()) {
      evaluateTarget(e.target);
    }
  },
  true
);

document.addEventListener(
  'keydown',
  (e) => {
    if (!overlay.isVisible()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
      return;
    }

    // Trigger enhancement with Ctrl+Enter / Cmd+Enter / Alt+E when pill is shown
    if (!overlay.isCardOpen() && activeMatch) {
      const isTriggerShortcut =
        ((e.ctrlKey || e.metaKey) && e.key === 'Enter') ||
        (e.altKey && e.key.toLowerCase() === 'e');
      if (isTriggerShortcut) {
        e.preventDefault();
        e.stopPropagation();
        startEnhancement(overlay.getEnhanceOpts());
        return;
      }
    }

    // Replace with Enter (or Ctrl+Enter if editing inside the preview textarea) when card is ready
    if (overlay.isCardOpen() && e.key === 'Enter' && !e.shiftKey) {
      const editingPreview = e
        .composedPath()
        .some((n) => n instanceof HTMLTextAreaElement && n.classList.contains('sp-preview'));
      if (editingPreview && !(e.ctrlKey || e.metaKey)) {
        return;
      }
      const result = overlay.getResultText();
      if (result) {
        e.preventDefault();
        e.stopPropagation();
        applyReplacement(result);
      }
    }
  },
  true
);

document.addEventListener(
  'mousedown',
  (e) => {
    if (!overlay.isVisible()) return;
    const path = e.composedPath();
    if (path.includes(overlay.getHost())) return;
    if (activeTarget && path.includes(activeTarget)) return;
    dismiss();
  },
  true
);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CONTEXT_MENU_ENHANCE') {
    const el = document.activeElement;
    const selectionText = String(msg.selectionText ?? '').trim();
    if (isEditableTarget(el)) {
      activeTarget = el;
      const match = readTargetTrigger(el, settings.triggerPrefix);
      if (match) {
        activeMatch = match;
      } else if (selectionText) {
        const start =
          el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
            ? el.selectionStart ?? 0
            : 0;
        const end =
          el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
            ? el.selectionEnd ?? selectionText.length
            : selectionText.length;
        activeMatch = { start, end, query: selectionText };
      }
      if (activeMatch) {
        startEnhancement({
          mode: 'enhance',
          style: settings.defaultStyle,
          includePageContext: false,
          includeScreenshot: false,
        });
      }
    }
  }
});

init();
