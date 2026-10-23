// Состояние, которое не сохраняется: прогресс расшифровки, загрузка модели, всплывашки.
import { useSyncExternalStore } from 'react';

import { createStore } from './store';

export type ModelState = {
  status: 'unknown' | 'none' | 'downloading' | 'paused' | 'ready' | 'error';
  written: number;
  total: number;
  error?: string;
};

export type Runtime = {
  progress: Record<string, number>; // noteId → 0..100
  model: ModelState;
  toast: { id: number; text: string } | null;
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

export function toast(text: string) {
  const id = Date.now();
  runtime.set((r) => ({ ...r, toast: { id, text } }));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => runtime.set((r) => ({ ...r, toast: null })), 2400);
}

export function setProgress(noteId: string, value: number | null) {
  runtime.set((r) => {
    const progress = { ...r.progress };
    if (value === null) delete progress[noteId];
    else progress[noteId] = value;
    return { ...r, progress };
  });
}
