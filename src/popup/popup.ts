import { getAiCapabilities } from '../ai/chromeAi.js';
import {
  clearHistory,
  getHistory,
  getSettings,
  saveSettings,
  toggleStarHistoryItem,
} from '../shared/storage.js';
import type {
  AiCapabilitiesStatus,
  AiMode,
  EnhanceRequest,
  EnhanceStyle,
  StreamPortMessage,
} from '../shared/types.js';

const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement;
const pgInput = document.getElementById('pg-input') as HTMLTextAreaElement;
const pgMode = document.getElementById('pg-mode') as HTMLSelectElement;
const pgStyle = document.getElementById('pg-style') as HTMLSelectElement;
const pgRun = document.getElementById('pg-run') as HTMLButtonElement;
const pgOutputWrap = document.getElementById('pg-output-wrap') as HTMLDivElement;
const pgStatus = document.getElementById('pg-status') as HTMLSpanElement;
const pgOutput = document.getElementById('pg-output') as HTMLPreElement;
const pgCopy = document.getElementById('pg-copy') as HTMLButtonElement;

const historyList = document.getElementById('history-list') as HTMLDivElement;
const historyClear = document.getElementById('history-clear') as HTMLButtonElement;

const statusGrid = document.getElementById('ai-status-grid') as HTMLDivElement;
const settingPrefix = document.getElementById('setting-prefix') as HTMLInputElement;
const settingStyle = document.getElementById('setting-style') as HTMLSelectElement;
const settingDemo = document.getElementById('setting-demo') as HTMLInputElement;

// Tab switching
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(`tab-${btn.dataset.tab}`);
    target?.classList.add('active');
    if (btn.dataset.tab === 'history') renderHistory();
    if (btn.dataset.tab === 'settings') renderCapabilities();
  });
});

async function loadSettingsUI() {
  const s = await getSettings();
  toggleEnabled.checked = s.enabled;
  settingPrefix.value = s.triggerPrefix;
  settingStyle.value = s.defaultStyle;
  pgStyle.value = s.defaultStyle;
  settingDemo.checked = s.demoFallback;
}

toggleEnabled.addEventListener('change', () => {
  saveSettings({ enabled: toggleEnabled.checked });
});

settingPrefix.addEventListener('change', () => {
  const val = settingPrefix.value.trim() || '//';
  settingPrefix.value = val;
  saveSettings({ triggerPrefix: val });
});

settingStyle.addEventListener('change', () => {
  const style = settingStyle.value as EnhanceStyle;
  pgStyle.value = style;
  saveSettings({ defaultStyle: style });
});

settingDemo.addEventListener('change', () => {
  saveSettings({ demoFallback: settingDemo.checked });
});

// Playground
let activePort: chrome.runtime.Port | null = null;

pgInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    pgRun.click();
  }
});

pgRun.addEventListener('click', () => {
  const prompt = pgInput.value.trim();
  if (!prompt) return;

  activePort?.disconnect();
  pgOutputWrap.classList.remove('hidden');
  pgOutput.textContent = '';
  pgStatus.textContent = 'Enhancing locally...';
  pgRun.disabled = true;

  const port = chrome.runtime.connect({ name: 'slashprompt-stream' });
  activePort = port;

  port.onMessage.addListener((msg: StreamPortMessage) => {
    if (msg.type === 'DOWNLOAD_PROGRESS') {
      pgStatus.textContent = `Downloading model (${msg.progress}%)...`;
    } else if (msg.type === 'CHUNK') {
      pgOutput.textContent = msg.fullText;
    } else if (msg.type === 'DONE') {
      pgOutput.textContent = msg.fullText;
      pgStatus.textContent = msg.usedDemoFallback ? 'Demo Mode' : 'On-Device AI';
      pgRun.disabled = false;
      port.disconnect();
    } else if (msg.type === 'ERROR') {
      pgOutput.textContent = msg.error;
      pgStatus.textContent = 'Unavailable';
      pgRun.disabled = false;
      port.disconnect();
    }
  });

  const req: EnhanceRequest = {
    type: 'ENHANCE_PROMPT',
    prompt,
    mode: pgMode.value as AiMode,
    style: pgStyle.value as EnhanceStyle,
  };
  port.postMessage(req);
});

pgCopy.addEventListener('click', async () => {
  const text = pgOutput.textContent ?? '';
  if (!text) return;
  await navigator.clipboard.writeText(text);
  pgCopy.textContent = 'Copied ✓';
  setTimeout(() => {
    pgCopy.textContent = 'Copy';
  }, 1200);
});

async function renderHistory() {
  const items = await getHistory();
  historyList.innerHTML = '';
  if (items.length === 0) {
    historyList.innerHTML =
      '<div class="muted" style="padding:18px 0;text-align:center;">No enhanced prompts yet. Type // in any text area to start.</div>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'history-item';

    const head = document.createElement('div');
    head.className = 'history-item-head';
    const meta = document.createElement('span');
    meta.textContent = `${item.mode} · ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const actions = document.createElement('div');
    const starBtn = document.createElement('button');
    starBtn.className = 'btn-ghost';
    starBtn.textContent = item.starred ? '★' : '☆';
    starBtn.addEventListener('click', async () => {
      await toggleStarHistoryItem(item.id);
      renderHistory();
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-ghost';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(item.enhanced);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    });

    actions.append(starBtn, copyBtn);
    head.append(meta, actions);

    const body = document.createElement('div');
    body.className = 'history-item-body';
    body.textContent = item.enhanced;

    card.append(head, body);
    historyList.appendChild(card);
  }
}

historyClear.addEventListener('click', async () => {
  await clearHistory();
  renderHistory();
});

async function renderCapabilities() {
  const caps: AiCapabilitiesStatus = await getAiCapabilities();
  const entries: Array<[string, string]> = [
    ['Prompt API', caps.prompt],
    ['Rewriter API', caps.rewriter],
    ['Writer API', caps.writer],
    ['Summarizer API', caps.summarizer],
    ['Proofreader API', caps.proofreader],
    ['LanguageDetector', caps.languageDetector],
    ['Translator API', caps.translator],
    ['Multimodal (Img)', caps.multimodal],
  ];

  statusGrid.innerHTML = '';
  for (const [label, state] of entries) {
    const card = document.createElement('div');
    card.className = 'status-card';

    const name = document.createElement('span');
    name.textContent = label;

    const pill = document.createElement('span');
    pill.className = `pill ${state}`;
    pill.textContent = state;

    card.append(name, pill);
    statusGrid.appendChild(card);
  }
}

loadSettingsUI();
renderCapabilities();
