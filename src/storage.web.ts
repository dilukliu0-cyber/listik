// Web-предпросмотр: состояние в localStorage.
const KEY = 'listik-state';

export async function loadState(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveState(json: string): Promise<void> {
  try {
    window.localStorage.setItem(KEY, json);
  } catch {
    // переполнение или приватный режим — просто не сохраняем
  }
}
