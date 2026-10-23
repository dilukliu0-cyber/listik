// Фото в заметки, как в Telegram: пузырь появляется сразу, а фото сжимается в фоне.
// Полноразмерные снимки (12 Мп) больше не попадают в ленту — из-за них всё подвисало.
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { importFile, moveIntoApp, removeFiles } from '../files';
import { haptic } from '../haptics';
import { toast } from '../runtime';
import { actions, store } from '../store';

const MAX_SIDE = 2048; // как «высокое качество» в Telegram

export type PhotoSource = {
  uri: string; // что можно сразу показать: file://… или ph://… (фото из библиотеки)
  width: number;
  height: number;
  assetId?: string; // фото из библиотеки — файл берём через медиатеку
};

/** Настоящий файл для фото из библиотеки (может докачаться из iCloud) */
async function assetFile(id: string): Promise<string> {
  const M = await import('expo-media-library/legacy');
  const info = await M.getAssetInfoAsync(id, { shouldDownloadFromNetwork: true });
  const src = info.localUri ?? info.uri;
  if (!src) throw new Error('фото недоступно');
  return src;
}

/** Сжать до MAX_SIDE по длинной стороне и положить в папку приложения */
export async function preparePhoto(src: string, width: number, height: number): Promise<{ uri: string; width: number; height: number }> {
  if (Platform.OS === 'web') return { uri: await importFile(src, src, 'jpg'), width, height };
  const long = Math.max(width, height);
  const resize = long > MAX_SIDE ? (width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE }) : null;
  try {
    const r = await manipulateAsync(src, resize ? [{ resize }] : [], { compress: 0.82, format: SaveFormat.JPEG });
    const rel = await moveIntoApp(r.uri, 'jpg');
    return { uri: rel, width: r.width, height: r.height };
  } catch {
    // не вышло сжать — сохраняем как есть
    return { uri: await importFile(src, src, 'jpg'), width, height };
  }
}

/** Отправить фото в чат: заметки появляются сразу, файлы готовятся по очереди в фоне */
export function sendPhotos(chatId: string, list: PhotoSource[], caption = '', replyTo?: string) {
  if (!list.length) return;
  const ids = list.map((p, i) =>
    actions.addNote({
      chatId,
      kind: 'photo',
      text: i === 0 ? caption.trim() : '',
      replyTo: i === 0 ? replyTo : undefined,
      createdAt: Date.now() + i,
      photo: { uri: p.uri, width: p.width, height: p.height },
    }),
  );
  haptic.light();
  (async () => {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const id = ids[i];
      try {
        const src = p.assetId ? await assetFile(p.assetId) : p.uri;
        const ready = await preparePhoto(src, p.width, p.height);
        const note = store.get().notes[id];
        if (!note) {
          removeFiles([ready.uri]); // заметку уже удалили навсегда
          continue;
        }
        actions.updateNote(id, { photo: ready });
      } catch (e) {
        toast('Не удалось добавить фото: ' + String((e as Error)?.message ?? e));
        actions.purge([], [id]);
      }
    }
  })();
}
