// Состояние, которое не сохраняется: прогресс расшифровки, загрузка модели, всплывашки.
import { useSyncExternalStore } from 'react';

import { createStore } from './store';

export type ModelState = {
  status: 'unknown' | 'none' | 'downloading' | 'paused' | 'ready' | 'error';
  written: number;
  total: number;
  error?: string;
};

export type ToastAction = { label: string; onPress: () => void };

export type Runtime = {
  progress: Record<string, number>; // noteId → 0..100
  model: ModelState;
  toast: { id: number; text: string; action?: ToastAction } | null;
  upsell: boolean; // шторка «Хотите точнее?»
  ready: boolean;
};

export const runtime = createStore<Runtime>({
  progress: {},
  model: { status: 'unknown', written: 0, total: 0 },
  toast: null,
  upsell: false,
  ready: false,
});

export function useRuntime<R>(selector: (r: Runtime) => R): R {
  return useSyncExternalStore(runtime.subscribe, () => selector(runtime.get()), () => selector(runtime.get()));
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(text: string, action?: ToastAction) {
  const id = Date.now();
  runtime.set((r) => ({ ...r, toast: { id, text, action } }));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => runtime.set((r) => (r.toast?.id === id ? { ...r, toast: null } : r)), action ? 5000 : 2400);
}

export function hideToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  runtime.set((r) => ({ ...r, toast: null }));
}

/** Тост снизу «… · Отменить» на 5 секунд, как в Telegram */
export function undoToast(text: string, onUndo: () => void) {
  toast(text, { label: 'Отменить', onPress: onUndo });
}

export function setProgress(noteId: string, value: number | null) {
  runtime.set((r) => {
    const progress = { ...r.progress };
    if (value === null) delete progress[noteId];
    else progress[noteId] = value;
    return { ...r, progress };
  });
}
