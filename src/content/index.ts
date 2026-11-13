import { getSettings } from '../shared/storage.js';
import type { TriggerMatch } from '../shared/trigger.js';
import {
  DEFAULT_SETTINGS,
  type AiMode,
  type EnhanceRequest,
  type EnhanceStyle,
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
import { FloatingOverlay } from './overlay.js';

let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let activeTarget: EditableElement | null = null;
let activeMatch: TriggerMatch | null = null;
let activePort: chrome.runtime.Port | null = null;

const overlay = new FloatingOverlay(
  {
    onEnhance: (mode, style) => startEnhancement(mode, style),
    onReplace: (text) => applyReplacement(text),
    onDismiss: () => dismiss(),
    onCancel: () => cancelStream(),
  },
  settings.defaultStyle
);

async function init() {
  try {
    settings = await getSettings();
  } catch {
    // Fallback to defaults if storage isn't ready
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.slashprompt_settings?.newValue) {
      settings = { ...DEFAULT_SETTINGS, ...changes.slashprompt_settings.newValue };
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

function startEnhancement(mode: AiMode, style: EnhanceStyle) {
  if (!activeTarget || !activeMatch) return;
  cancelStream();

  const rect = getTargetAnchorRect(activeTarget);
  overlay.showCardLoading(rect, mode, style);

  const port = chrome.runtime.connect({ name: 'slashprompt-stream' });
  activePort = port;

  port.onMessage.addListener((msg: StreamPortMessage) => {
    if (port !== activePort) return;
    if (msg.type === 'DOWNLOAD_PROGRESS') {
      overlay.updateDownloadProgress(msg.progress);
    } else if (msg.type === 'CHUNK') {
      overlay.updateStream(msg.fullText);
    } else if (msg.type === 'DONE') {
      overlay.finishStream(msg.fullText, msg.usedDemoFallback);
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

  const payload: EnhanceRequest = {
    type: 'ENHANCE_PROMPT',
    prompt: activeMatch.query,
    mode,
    style,
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
        startEnhancement('enhance', settings.defaultStyle);
        return;
      }
    }

    // Replace with Enter when card is ready
    if (overlay.isCardOpen() && e.key === 'Enter' && !e.shiftKey) {
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
        startEnhancement('enhance', settings.defaultStyle);
      }
    }
  }
});

init();
