// Доступы: сначала своё окно-объяснение, потом системный запрос.
// Если доступ запрещён — окно с кнопкой «Открыть настройки».
import { Linking, Platform } from 'react-native';

import { actions, createStore, store } from '../store';
import type { IconName } from '../ui/Icon';

export type PermKind = 'mic' | 'photos' | 'camera' | 'speech';

type Status = { granted: boolean; canAskAgain: boolean; status: string };

export const PERM_INFO: Record<PermKind, { icon: IconName; title: string; text: string }> = {
  mic: {
    icon: 'micFill',
    title: 'Нужен микрофон',
    text: 'Чтобы записывать голосовые заметки. Запись остаётся на телефоне.',
  },
  photos: {
    icon: 'photoFill',
    title: 'Доступ к фото',
    text: 'Чтобы показывать последние фото в меню скрепки. Фото никуда не отправляются.',
  },
  camera: {
    icon: 'camera',
    title: 'Нужна камера',
    text: 'Чтобы снимать фото прямо в заметку. Снимки остаются на телефоне.',
  },
  speech: {
    icon: 'sparkles',
    title: 'Распознавание речи',
    text: 'Чтобы превращать голосовые в текст. Расшифровка идёт на телефоне.',
  },
};

async function api(kind: PermKind): Promise<{ get: () => Promise<Status>; ask: () => Promise<Status> }> {
  switch (kind) {
    case 'mic': {
      const A = await import('expo-audio');
      return { get: A.getRecordingPermissionsAsync, ask: A.requestRecordingPermissionsAsync };
    }
    case 'photos': {
      const M = await import('expo-media-library/legacy');
      return { get: () => M.getPermissionsAsync(false), ask: () => M.requestPermissionsAsync(false) };
    }
    case 'camera': {
      const P = await import('expo-image-picker');
      return { get: P.getCameraPermissionsAsync, ask: P.requestCameraPermissionsAsync };
    }
    case 'speech': {
      const S = await import('expo-speech-recognition');
      const m = S.ExpoSpeechRecognitionModule;
      return {
        get: () => m.getSpeechRecognizerPermissionsAsync(),
        ask: () => m.requestSpeechRecognizerPermissionsAsync(),
      };
    }
  }
}

// --- окно-объяснение ---
export type PromptState = { kind: PermKind; mode: 'intro' | 'denied'; resolve: (ok: boolean) => void } | null;
export const promptStore = createStore<PromptState>(null);

function prompt(kind: PermKind, mode: 'intro' | 'denied'): Promise<boolean> {
  return new Promise((resolve) => promptStore.set({ kind, mode, resolve }));
}

// Ответ отдаётся только когда окно полностью исчезло: iOS не покажет системный запрос
// или камеру поверх закрывающегося Modal — приложение зависнет.
let pendingAnswer: (() => void) | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

export function promptDismissed() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  const f = pendingAnswer;
  pendingAnswer = null;
  f?.();
}

export function answerPrompt(ok: boolean) {
  const p = promptStore.get();
  promptStore.set(null);
  if (!p) return;
  promptDismissed();
  pendingAnswer = () => {
    if (ok && p.mode === 'denied') {
      Linking.openSettings().catch(() => {});
      p.resolve(false);
      return;
    }
    p.resolve(ok);
  };
  pendingTimer = setTimeout(promptDismissed, Platform.OS === 'ios' ? 700 : 0);
}

/** true — доступ есть. Можно вызывать в любой момент, окно покажется только когда нужно. */
export async function ensurePermission(kind: PermKind): Promise<boolean> {
  if (Platform.OS === 'web') return kind === 'photos';
  let a: Awaited<ReturnType<typeof api>>;
  try {
    a = await api(kind);
  } catch {
    return false;
  }
  const st = await a.get().catch(() => null);
  if (st?.granted) return true;
  if (!st || st.status === 'undetermined' || st.canAskAgain) {
    if (!store.get().settings.permIntro[kind]) {
      const ok = await prompt(kind, 'intro');
      if (!ok) return false;
      actions.setSettings({ permIntro: { ...store.get().settings.permIntro, [kind]: true } });
    }
    const r = await a.ask().catch(() => null);
    return !!r?.granted;
  }
  await prompt(kind, 'denied');
  return false;
}

/** Тихая проверка без окон */
export async function hasPermission(kind: PermKind): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const st = await (await api(kind)).get();
    return st.granted;
  } catch {
    return false;
  }
}
