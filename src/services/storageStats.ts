import { cacheSize, fileSize } from '../files';
import { store } from '../store';
import { MODEL_FILE } from './whisperModel';

export type Stats = { photos: number; files: number; voices: number; model: number; cache: number; total: number };

export async function storageStats(): Promise<Stats> {
  const s = store.get();
  let photos = 0;
  let files = 0;
  let voices = 0;
  for (const n of Object.values(s.notes)) {
    if (n.photo) photos += await fileSize(n.photo.uri);
    if (n.file) files += n.file.size || (await fileSize(n.file.uri));
    if (n.voice) voices += await fileSize(n.voice.uri);
  }
  for (const c of Object.values(s.chats)) {
    if (c.photo) photos += await fileSize(c.photo);
    if (c.wallpaper?.kind === 'photo') photos += await fileSize(c.wallpaper.uri);
  }
  if (s.settings.wallpaper.kind === 'photo') photos += await fileSize(s.settings.wallpaper.uri);
  const model = await fileSize(MODEL_FILE);
  const cache = await cacheSize();
  return { photos, files, voices, model, cache, total: photos + files + voices + model + cache };
}
