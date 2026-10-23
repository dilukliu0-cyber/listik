// Загрузка модели Whisper — только по желанию пользователя, через любую сеть,
// с прогрессом, отменой и докачкой (фоновая сессия iOS).
import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { runtime, toast } from '../runtime';
import { actions, store } from '../store';
import { releaseWhisper } from './stt/whisper';

export const MODEL_NAME = 'ggml-large-v3-turbo-q5_0.bin';
export const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/' + MODEL_NAME;
export const MODEL_BYTES = 574041195; // ~547 МБ
const MIN_VALID = 500 * 1024 * 1024;

const WEB = Platform.OS === 'web';
const DIR = (FS.documentDirectory ?? '') + 'models/';
export const MODEL_FILE = DIR + MODEL_NAME;
const PART = MODEL_FILE + '.part';

let task: FS.DownloadResumable | null = null;
let lastEmit = 0;

function setModel(patch: Partial<ReturnType<typeof runtime.get>['model']>) {
  runtime.set((r) => ({ ...r, model: { ...r.model, ...patch } }));
}

export async function checkModel() {
  if (WEB) {
    setModel({ status: 'none' });
    return;
  }
  try {
    const info = await FS.getInfoAsync(MODEL_FILE);
    if (info.exists && (info.size ?? 0) > MIN_VALID) {
      setModel({ status: 'ready', written: info.size ?? MODEL_BYTES, total: info.size ?? MODEL_BYTES });
      return;
    }
  } catch {
    // нет файла
  }
  setModel({ status: 'none', written: 0, total: MODEL_BYTES });
  if (store.get().settings.whisperWanted) startDownload(); // докачиваем после перезапуска
}

export async function startDownload() {
  if (WEB) {
    toast('Загрузка модели работает в приложении на iPhone');
    return;
  }
  if (task) return;
  actions.setSettings({ whisperWanted: true });
  setModel({ status: 'downloading', error: undefined, total: MODEL_BYTES });
  try {
    await FS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    task = FS.createDownloadResumable(
      MODEL_URL,
      PART,
      { sessionType: FS.FileSystemSessionType.BACKGROUND },
      (p) => {
        const now = Date.now();
        if (now - lastEmit < 250) return;
        lastEmit = now;
        setModel({
          written: p.totalBytesWritten,
          total: p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : MODEL_BYTES,
        });
      },
    );
    const res = await task.downloadAsync();
    task = null;
    if (!res) return; // поставлено на паузу / отменено
    if (res.status < 200 || res.status >= 300) throw new Error('сервер ответил ' + res.status);
    const info = await FS.getInfoAsync(PART);
    if (!info.exists || (info.size ?? 0) < MIN_VALID) throw new Error('файл скачался не полностью');
    await FS.deleteAsync(MODEL_FILE, { idempotent: true });
    await FS.moveAsync({ from: PART, to: MODEL_FILE });
    setModel({ status: 'ready', written: info.size ?? MODEL_BYTES, total: info.size ?? MODEL_BYTES });
    actions.setSettings({ whisperWanted: false, engine: 'whisper' });
    toast('Точная расшифровка готова');
  } catch (e) {
    task = null;
    if (runtime.get().model.status !== 'downloading') return; // отменили
    setModel({ status: 'error', error: String((e as Error)?.message ?? e) });
  }
}

export async function cancelDownload() {
  const t = task;
  task = null;
  setModel({ status: 'none', written: 0 });
  actions.setSettings({ whisperWanted: false });
  if (t) await t.pauseAsync().catch(() => {});
  if (!WEB) await FS.deleteAsync(PART, { idempotent: true }).catch(() => {});
}

export async function deleteModel() {
  await releaseWhisper();
  if (!WEB) await FS.deleteAsync(MODEL_FILE, { idempotent: true }).catch(() => {});
  setModel({ status: 'none', written: 0, total: MODEL_BYTES });
  actions.setSettings({ engine: 'apple', whisperWanted: false });
}
