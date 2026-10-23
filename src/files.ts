// Файлы заметок лежат в папке приложения. В данных храним относительный путь
// (media/xxx.jpg): путь к контейнеру iOS меняется после обновления приложения.
import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { uid } from './store';

const WEB = Platform.OS === 'web';
const DOCS = FS.documentDirectory ?? '';

export function resolveUri(u: string): string {
  if (!u) return u;
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : DOCS + u;
}

/** Путь без file:// — для нативных библиотек (whisper) */
export function toPath(u: string): string {
  return decodeURIComponent(resolveUri(u).replace(/^file:\/\//, ''));
}

function extOf(name: string, fallback: string) {
  const m = /\.([a-z0-9]{1,8})(?:\?|$)/i.exec(name);
  return m ? m[1].toLowerCase() : fallback;
}

let dirReady: Promise<void> | null = null;
function ensureDir() {
  if (!dirReady) {
    dirReady = FS.makeDirectoryAsync(DOCS + 'media', { intermediates: true }).catch(() => {});
  }
  return dirReady;
}

/** Копирует файл в папку приложения и возвращает относительный путь. */
export async function importFile(src: string, nameHint = '', fallbackExt = 'bin'): Promise<string> {
  if (WEB) return src;
  await ensureDir();
  const rel = `media/${uid()}.${extOf(nameHint || src, fallbackExt)}`;
  await FS.copyAsync({ from: src, to: DOCS + rel });
  return rel;
}

/** Переносит (а не копирует) — для свежих записей голосовых */
export async function moveIntoApp(src: string, ext: string): Promise<string> {
  if (WEB) return src;
  await ensureDir();
  const rel = `media/${uid()}.${ext}`;
  try {
    await FS.moveAsync({ from: src, to: DOCS + rel });
  } catch {
    await FS.copyAsync({ from: src, to: DOCS + rel });
  }
  return rel;
}

export async function removeFiles(uris: string[]) {
  if (WEB) return;
  for (const u of uris) {
    if (/^[a-z]+:/i.test(u) && !u.startsWith(DOCS)) continue; // чужие файлы не трогаем
    await FS.deleteAsync(resolveUri(u), { idempotent: true }).catch(() => {});
  }
}

export async function fileSize(u: string): Promise<number> {
  if (WEB) return 0;
  try {
    const info = await FS.getInfoAsync(resolveUri(u));
    return info.exists ? (info.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

export async function cacheSize(): Promise<number> {
  if (WEB || !FS.cacheDirectory) return 0;
  return dirSize(FS.cacheDirectory);
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    for (const name of await FS.readDirectoryAsync(dir)) {
      const p = dir + (dir.endsWith('/') ? '' : '/') + name;
      const info = await FS.getInfoAsync(p);
      if (!info.exists) continue;
      total += info.isDirectory ? await dirSize(p) : (info.size ?? 0);
    }
  } catch {
    // нет доступа — пропускаем
  }
  return total;
}

export async function clearCache() {
  if (WEB || !FS.cacheDirectory) return;
  try {
    for (const name of await FS.readDirectoryAsync(FS.cacheDirectory)) {
      await FS.deleteAsync(FS.cacheDirectory + name, { idempotent: true }).catch(() => {});
    }
  } catch {
    // ничего
  }
}
