// Очередь расшифровки голосовых. Работает в фоне, по одной записи за раз.
import { Platform } from 'react-native';

import { runtime, setProgress } from '../runtime';
import { actions, store } from '../store';
import { ensurePermission } from './permissions';
import { transcribeApple } from './stt/apple';
import { transcribeWhisper } from './stt/whisper';
import { MODEL_FILE } from './whisperModel';

const queue: string[] = [];
let running = false;

export function transcribe(noteId: string) {
  const v = store.get().notes[noteId]?.voice;
  if (!v || queue.includes(noteId) || v.status === 'running') return;
  actions.updateVoice(noteId, { status: 'queued', error: undefined });
  queue.push(noteId);
  run();
}

/** После загрузки точной модели — перерасшифровать все старые голосовые */
export function retranscribeAll(): number {
  const ids = Object.values(store.get().notes)
    .filter((n) => n.voice && !n.deletedAt && n.voice.engine !== 'whisper')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((n) => n.id);
  ids.forEach(transcribe);
  return ids.length;
}

/** При запуске: продолжить то, что прервалось */
export function resumeQueue() {
  for (const n of Object.values(store.get().notes)) {
    if (n.voice && !n.deletedAt && (n.voice.status === 'queued' || n.voice.status === 'running')) {
      actions.updateVoice(n.id, { status: 'none' });
      transcribe(n.id);
    }
  }
}

async function run() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift()!;
      await one(id);
    }
  } finally {
    running = false;
  }
}

async function one(id: string) {
  const note = store.get().notes[id];
  if (!note?.voice || note.deletedAt) return;
  const { settings } = store.get();
  const modelReady = runtime.get().model.status === 'ready';
  const engine = settings.engine === 'whisper' && modelReady ? 'whisper' : 'apple';
  actions.updateVoice(id, { status: 'running', error: undefined });
  setProgress(id, 0);
  try {
    if (Platform.OS === 'web') throw new Error('Расшифровка работает в приложении на iPhone');
    let text: string;
    if (engine === 'apple') {
      const ok = await ensurePermission('speech');
      if (!ok) throw new Error('Нет доступа к распознаванию речи');
      text = await transcribeApple(note.voice.uri, settings.language, note.voice.duration, (p) => setProgress(id, p));
    } else {
      text = await transcribeWhisper(MODEL_FILE, note.voice.uri, settings.language, (p) => setProgress(id, p));
    }
    actions.updateVoice(id, { status: 'done', transcript: text, engine });
    const model = runtime.get().model.status;
    if (engine === 'apple' && !store.get().settings.upsellShown && model !== 'ready' && model !== 'downloading') {
      actions.setSettings({ upsellShown: true });
      runtime.set((r) => ({ ...r, upsell: true }));
    }
  } catch (e) {
    actions.updateVoice(id, { status: 'error', error: String((e as Error)?.message ?? e) });
  } finally {
    setProgress(id, null);
  }
}
