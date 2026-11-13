import {
  AiUnavailableError,
  getAiCapabilities,
  runLocalAiTask,
} from '../ai/chromeAi.js';
import { addHistoryItem, getSettings } from '../shared/storage.js';
import type { EnhanceRequest, StreamPortMessage } from '../shared/types.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'slashprompt-enhance-selection',
    title: 'Enhance prompt with SlashPrompt',
    contexts: ['selection', 'editable'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'slashprompt-enhance-selection' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONTEXT_MENU_ENHANCE',
      selectionText: info.selectionText ?? '',
    }).catch(() => {
      // Ignore tabs where content script cannot run (e.g. chrome:// pages)
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_CAPABILITIES') {
    getAiCapabilities()
      .then((caps) => sendResponse({ ok: true, capabilities: caps }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'slashprompt-stream') return;

  let controller: AbortController | null = null;
  let disconnected = false;

  port.onDisconnect.addListener(() => {
    disconnected = true;
    controller?.abort();
  });

  const safePost = (msg: StreamPortMessage) => {
    if (disconnected) return;
    try {
      port.postMessage(msg);
    } catch {
      disconnected = true;
    }
  };

  port.onMessage.addListener(async (msg: EnhanceRequest) => {
    if (msg?.type !== 'ENHANCE_PROMPT') return;

    controller?.abort();
    controller = new AbortController();

    try {
      const settings = await getSettings();
      const { text, usedDemoFallback } = await runLocalAiTask(
        msg.prompt,
        msg.mode,
        msg.style,
        {
          signal: controller.signal,
          onChunk: (delta, fullText) => {
            safePost({ type: 'CHUNK', text: delta, fullText });
          },
          onDownloadProgress: (progress) => {
            safePost({ type: 'DOWNLOAD_PROGRESS', progress });
          },
        },
        settings.demoFallback
      );

      await addHistoryItem({
        original: msg.prompt,
        enhanced: text,
        mode: msg.mode,
        style: msg.style,
      });

      safePost({ type: 'DONE', fullText: text, usedDemoFallback });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const isUnavailable = err instanceof AiUnavailableError;
      safePost({
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
        needsSetup: isUnavailable,
      });
    }
  });
});
