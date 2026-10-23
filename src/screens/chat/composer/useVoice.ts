// Запись голосового как в Telegram: коснулся микрофона — запись сразу пошла и кнопка выросла;
// отпустил — отправилось; влево — отмена; вверх на замок — запись идёт без пальца.
// Короткий тап — подсказка «Удерживайте, чтобы записать», ничего не отправляется.
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

const TAP_MS = 400; // отпустили быстрее — это тап
const CANCEL_DX = -120;
const LOCK_DY = -80;

export function useVoice({ chatId, replyToId, onSent }: { chatId: string; replyToId?: string; onSent: () => void }) {
  const recorder = useAudioRecorder(REC_OPTIONS);
  const recState = useAudioRecorderState(recorder, 100);
  const [rec, setRecView] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const samples = useRef<number[]>([]);
  const startedAt = useRef(0); // когда микрофон реально начал писать (0 — ещё не начал)

  // Состояние храним в ref и меняем синхронно: жест читает его сразу, не дожидаясь перерисовки.
  // Раньше отпускание пальца в момент старта терялось, и запись «висела» без кнопок.
  const state = useRef<RecState>('idle');
  const setRec = (s: RecState) => {
    state.current = s;
    setRecView(s);
  };

  const held = useRef(false); // палец сейчас на кнопке
  const pressedAt = useRef(0);
  const starting = useRef(false); // микрофон ещё включается
  const pending = useRef<'send' | 'discard' | null>(null); // что сделать, когда включится
  const micOk = useRef(false); // доступ к микрофону проверяем заранее, чтобы не терять время

  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current; // кнопка «надувается» при старте
  const nudge = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') hasPermission('mic').then((ok) => (micOk.current = ok)).catch(() => {});
  }, []);

  // уровень громкости → волна
  useEffect(() => {
    if (rec !== 'idle' && recState.isRecording) samples.current.push(level(recState.metering));
  }, [recState, rec]);

  useEffect(() => {
    if (rec === 'idle') return;
    const id = setInterval(() => setElapsed(startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0), 200);
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

  /** Включить микрофон. После этого выполняет то, что успели решить, пока он включался. */
  async function start() {
    starting.current = true;
    let ok = false;
    try {
      stopPlayback();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      samples.current = [];
      startedAt.current = Date.now();
      ok = true;
      haptic.medium();
    } catch (e) {
      toast('Не удалось начать запись: ' + String((e as Error)?.message ?? e));
    }
    starting.current = false;
    const todo = pending.current;
    pending.current = null;
    if (!ok) {
      held.current = false;
      reset();
      return;
    }
    if (todo === 'send') finish(true);
    else if (todo === 'discard') finish(false, true);
  }

  function reset() {
    setRec('idle');
    dragX.setValue(0);
    dragY.setValue(0);
  }

  /** Остановить запись: send — отправить, иначе выбросить */
  async function finish(send: boolean, silent = false) {
    if (state.current === 'idle' && !startedAt.current) return;
    // пока микрофон включается — решим, когда включится
    if (starting.current) {
      pending.current = send ? 'send' : 'discard';
      if (!send) reset();
      return;
    }
    const dur = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
    startedAt.current = 0;
    held.current = false;
    reset();
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

  function grant() {
    // запись «повисла» без пальца (палец потерян системой) — тап по кнопке отправляет
    if (state.current === 'recording' && !held.current) {
      finish(true);
      return;
    }
    if (state.current !== 'idle') return;
    if (Platform.OS === 'web') {
      toast('Запись голосовых работает в приложении на iPhone');
      return;
    }
    if (!micOk.current) {
      // первый раз — спрашиваем доступ; писать начнём со следующего удержания
      hasPermission('mic')
        .then((ok) => ok || ensurePermission('mic'))
        .then((ok) => (micOk.current = !!ok))
        .catch(() => {});
      return;
    }
    held.current = true;
    pressedAt.current = Date.now();
    pending.current = null;
    pop.setValue(0.5);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
    setElapsed(0);
    setRec('recording');
    start();
  }

  function release() {
    if (!held.current) return;
    held.current = false;
    if (state.current !== 'recording') return;
    if (Date.now() - pressedAt.current < TAP_MS) {
      haptic.light();
      toast('Удерживайте, чтобы записать');
      finish(false, true);
      return;
    }
    finish(true);
  }

  function move(dx: number, dy: number) {
    if (state.current !== 'recording' || !held.current) return;
    dragX.setValue(Math.min(0, dx));
    dragY.setValue(Math.min(0, dy));
    if (dx < CANCEL_DX) {
      held.current = false;
      if (starting.current) haptic.warning();
      finish(false); // влево — отмена
    } else if (dy < LOCK_DY && !starting.current) {
      held.current = false;
      haptic.success();
      dragX.setValue(0);
      dragY.setValue(0);
      setRec('locked'); // вверх на замок — запись идёт без пальца
    }
  }

  const fn = useRef({ grant, release, move });
  fn.current = { grant, release, move };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => state.current !== 'locked',
      onStartShouldSetPanResponderCapture: () => state.current !== 'locked',
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => fn.current.grant(),
      onPanResponderMove: (_, g) => fn.current.move(g.dx, g.dy),
      onPanResponderRelease: () => fn.current.release(),
      // систему отобрала касание (например, жест iOS) — ведём себя как при отпускании
      onPanResponderTerminate: () => fn.current.release(),
    }),
  ).current;

  // ушли из чата посреди записи — выбрасываем её
  useEffect(
    () => () => {
      if (state.current !== 'idle' || startedAt.current) {
        try {
          recorder.stop().catch(() => {});
        } catch {
          // запись уже освобождена
        }
        setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    rec,
    elapsed,
    panHandlers: pan.panHandlers,
    dragX,
    dragY,
    blink,
    pop,
    nudge,
    bob,
    finish,
  };
}
