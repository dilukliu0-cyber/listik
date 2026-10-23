// Сохранение состояния в JSON-файл в папке приложения (iOS).
import * as FS from 'expo-file-system/legacy';

const FILE = (FS.documentDirectory ?? '') + 'listik.json';

export async function loadState(): Promise<string | null> {
  try {
    const info = await FS.getInfoAsync(FILE);
    if (!info.exists) return null;
    return await FS.readAsStringAsync(FILE);
  } catch {
    return null;
  }
}

export async function saveState(json: string): Promise<void> {
  await FS.writeAsStringAsync(FILE, json);
}
