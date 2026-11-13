import {
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  type PromptHistoryItem,
} from './types.js';

const SETTINGS_KEY = 'slashprompt_settings';
const HISTORY_KEY = 'slashprompt_history';
const MAX_HISTORY = 30;

export async function getSettings(): Promise<ExtensionSettings> {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] ?? {}) };
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getHistory(): Promise<PromptHistoryItem[]> {
  const res = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(res[HISTORY_KEY]) ? res[HISTORY_KEY] : [];
}

export async function addHistoryItem(
  item: Omit<PromptHistoryItem, 'id' | 'timestamp'>
): Promise<PromptHistoryItem[]> {
  const history = await getHistory();
  const newItem: PromptHistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const next = [newItem, ...history].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function toggleStarHistoryItem(id: string): Promise<PromptHistoryItem[]> {
  const history = await getHistory();
  const next = history.map((item) =>
    item.id === id ? { ...item, starred: !item.starred } : item
  );
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}
