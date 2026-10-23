// Запись голосового как в Telegram: держать — запись, отпустил — отправилось,
// влево — отмена, вверх на замок — запись без пальца. Короткий тап — подсказка.
import { setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform } from 'react-native';

import { moveIntoApp } from '../../../files';
import { haptic } from '../../../haptics';
import { toast } from '../../../runtime';
import { ensurePermission, hasPermission } from '../../../services/permissions';
import { stopPlayback } from '../../../services/player';
import { transcribe } from '../../../services/transcriber';
import { actions, store } from '../../../store';
import { REC_OPTIONS, compressWave, level } from '../Recorder';

export type RecState = 'idle' | 'recording' | 'locked';

const HOLD_MS = 220; // короче — это тап, а не удержание
const CANCEL_DX = -120;
const LOCK_DY = -80;

export function useVoice({ chatId, replyToId, onSent }: { chatId: string; replyToId?: string; onSent: () => void }) {
  const recorder = useAudioRecorder(REC_OPTIONS);
  const recState = useAudioRecorderState(recorder, 100);
  const [rec, setRec] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const samples = useRef<number[]>([]);
  const startedAt = useRef(0);
  const recRef = useRef<RecState>('idle');
  recRef.current = rec;

  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current; // кнопка «надувается» при старте
  const nudge = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  // уровень громкости → волна
  useEffect(() => {
    if (rec !== 'idle' && recState.isRecording) samples.current.push(level(recState.metering));
  }, [recState, rec]);

  useEffect(() => {
    if (rec === 'idle') return;
    const id = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200);
    const loops = [
      Animated.loop(Animated.sequence([Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }), Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true })])),
      // «‹ влево — отмена» покачивается, стрелка замка зовёт вверх
      Animated.loop(Animated.sequence([Animated.timing(nudge, { toValue: -6, duration: 600, useNativeDriver: true }), Animated.timing(nudge, { toValue: 0, duration: 600, useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: -4, duration: 500, useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 500, useNativeDriver: true })])),
    ];
    loops.forEach((l) => l.start());
    return () => {
      clearInterval(id);
      loops.forEach((l) => l.stop());
    };
  }, [rec, blink, nudge, bob]);

  async function start(): Promise<boolean> {
    if (Platform.OS === 'web') {
      toast('Запись голосовых работает в приложении на iPhone');
      return false;
    }
    if (!(await hasPermission('mic'))) {
      await ensurePermission('mic');
      return false; // после разрешения — удерживайте ещё раз
    }
    try {
      stopPlayback();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      samples.current = [];
      startedAt.current = Date.now();
      setElapsed(0);
      haptic.medium();
      return true;
    } catch (e) {
      toast('Не удалось начать запись: ' + String((e as Error)?.message ?? e));
      return false;
    }
  }

  async function finish(send: boolean, silent = false) {
    const dur = (Date.now() - startedAt.current) / 1000;
    setRec('idle');
    dragX.setValue(0);
    dragY.setValue(0);
    try {
      await recorder.stop();
    } catch {
      // уже остановлена
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri;
    if (!send || !uri) {
      if (send && !uri) toast('Запись не сохранилась');
      else if (!silent) haptic.warning();
      return;
    }
    if (dur < 0.7) {
      toast('Удерживайте, чтобы записать');
      return;
    }
    try {
      const rel = await moveIntoApp(uri, 'wav');
      const id = actions.addNote({
        chatId,
        kind: 'voice',
        text: '',
        replyTo: replyToId,
        voice: { uri: rel, duration: dur, wave: compressWave(samples.current), status: 'none' },
      });
      haptic.success();
      onSent();
      if (store.get().settings.autoTranscribe) transcribe(id);
    } catch (e) {
      toast('Не удалось сохранить запись: ' + String((e as Error)?.message ?? e));
    }
  }

  const fn = useRef({ start, finish });
  fn.current = { start, finish };

  // held — палец сейчас на кнопке; если запись запустилась уже после того, как палец отпустили, — выбрасываем её
  const held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginHold = async () => {
    holdTimer.current = null;
    if (!held.current) return;
    const ok = await fn.current.start();
    if (!ok) return;
    if (!held.current) {
      fn.current.finish(false, true);
      return;
    }
    pop.setValue(0.5);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
    setRec('recording');
  };
  const beginRef = useRef(beginHold);
  beginRef.current = beginHold;

  const release = () => {
    held.current = false;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      haptic.light();
      toast('Удерживайте, чтобы записать');
      return;
    }
    if (recRef.current === 'recording') fn.current.finish(true);
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => recRef.current === 'idle',
      onStartShouldSetPanResponderCapture: () => recRef.current === 'idle',
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        held.current = true;
        holdTimer.current = setTimeout(() => beginRef.current(), HOLD_MS);
      },
      onPanResponderMove: (_, g) => {
        if (recRef.current !== 'recording') return;
        dragX.setValue(Math.min(0, g.dx));
        dragY.setValue(Math.min(0, g.dy));
        if (g.dx < CANCEL_DX) {
          held.current = false;
          fn.current.finish(false);
        } else if (g.dy < LOCK_DY) {
          haptic.success();
          dragX.setValue(0);
          dragY.setValue(0);
          setRec('locked');
        }
      },
      onPanResponderRelease: () => releaseRef.current(),
      onPanResponderTerminate: () => releaseRef.current(),
    }),
  ).current;

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  return { rec, elapsed, panHandlers: pan.panHandlers, dragX, dragY, blink, pop, nudge, bob, finish: (send: boolean) => fn.current.finish(send) };
}
