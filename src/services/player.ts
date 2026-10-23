// Один общий плеер для голосовых.
import { useSyncExternalStore } from 'react';

import { resolveUri } from '../files';
import { createStore } from '../store';
import { toast } from '../runtime';

type PlayState = { noteId: string | null; playing: boolean; position: number; duration: number };

const state = createStore<PlayState>({ noteId: null, playing: false, position: 0, duration: 0 });

type AudioPlayerLike = {
  play(): void;
  pause(): void;
  remove(): void;
  seekTo(s: number): Promise<void>;
  addListener(e: 'playbackStatusUpdate', l: (s: { currentTime: number; duration: number; playing: boolean; didJustFinish: boolean }) => void): { remove(): void };
};

let player: AudioPlayerLike | null = null;
let sub: { remove(): void } | null = null;

function release() {
  sub?.remove();
  sub = null;
  try {
    player?.remove();
  } catch {
    // уже освобождён
  }
  player = null;
}

export async function togglePlay(noteId: string, uri: string, duration: number) {
  const s = state.get();
  if (s.noteId === noteId && player) {
    if (s.playing) player.pause();
    else {
      if (s.position >= s.duration - 0.05) await player.seekTo(0).catch(() => {});
      player.play();
    }
    return;
  }
  release();
  try {
    const A = await import('expo-audio');
    await A.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    const p = A.createAudioPlayer(resolveUri(uri), { updateInterval: 100 }) as unknown as AudioPlayerLike;
    player = p;
    state.set({ noteId, playing: true, position: 0, duration });
    sub = p.addListener('playbackStatusUpdate', (st) => {
      if (player !== p) return;
      if (st.didJustFinish) {
        state.set({ noteId, playing: false, position: 0, duration: st.duration || duration });
        p.pause();
        p.seekTo(0).catch(() => {});
        return;
      }
      state.set({ noteId, playing: st.playing, position: st.currentTime, duration: st.duration || duration });
    });
    p.play();
  } catch (e) {
    state.set({ noteId: null, playing: false, position: 0, duration: 0 });
    toast('Не удалось воспроизвести: ' + String((e as Error)?.message ?? e));
  }
}

export function stopPlayback() {
  release();
  state.set({ noteId: null, playing: false, position: 0, duration: 0 });
}

export function usePlayback(noteId: string) {
  return useSyncExternalStore(
    state.subscribe,
    () => {
      const s = state.get();
      return s.noteId === noteId ? s : IDLE;
    },
    () => IDLE,
  );
}

const IDLE: PlayState = { noteId: null, playing: false, position: 0, duration: 0 };
