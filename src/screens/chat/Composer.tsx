import { setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, FadeOut, SlideInRight, ZoomIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { duration } from '../../format';
import { moveIntoApp } from '../../files';
import { haptic } from '../../haptics';
import { toast } from '../../runtime';
import { ensurePermission, hasPermission } from '../../services/permissions';
import { stopPlayback } from '../../services/player';
import { transcribe } from '../../services/transcriber';
import { actions, notePreview, store, type Note } from '../../store';
import type { Theme } from '../../theme';
import Icon from '../../ui/Icon';
import { EASE_OUT, PressScale, useBgTransition } from '../../ui/motion';
import { REC_OPTIONS, compressWave, level } from './Recorder';

type Props = {
  t: Theme;
  chatId: string;
  replyTo: Note | null;
  editing: Note | null;
  onCancelContext: () => void;
  onAttach: () => void;
  onFocus?: () => void;
  onSent: () => void;
  text: string;
  setText: (s: string) => void;
};

type RecState = 'idle' | 'recording' | 'locked';

const HOLD_MS = 220;
const MIN_H = 36; // высота поля в одну строку, как в Telegram
const MAX_H = 150; // ~6 строк, дальше прокрутка

export default function Composer({ t, chatId, replyTo, editing, onCancelContext, onAttach, onFocus, onSent, text, setText }: Props) {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(REC_OPTIONS);
  const recState = useAudioRecorderState(recorder, 100);
  const [rec, setRec] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const samples = useRef<number[]>([]);
  const startedAt = useRef(0);
  const recRef = useRef<RecState>('idle');
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current; // кнопка микрофона «надувается» при записи
  const nudge = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const barBg = useBgTransition(t.chatBar);
  const fieldH = useSharedValue(MIN_H);
  const fieldTarget = useRef(MIN_H);
  const [scrollable, setScrollable] = useState(false);
  const fieldStyle = useAnimatedStyle(() => ({ height: fieldH.value }));
  const sendP = useSharedValue(0);
  const sendStyle = useAnimatedStyle(() => ({ opacity: sendP.value, transform: [{ scale: 0.4 + 0.6 * sendP.value }] }));
  const micStyle = useAnimatedStyle(() => ({ opacity: 1 - sendP.value, transform: [{ scale: 1 - 0.6 * sendP.value }] }));

  recRef.current = rec;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // уровень громкости → волна
  useEffect(() => {
    if (rec !== 'idle' && recState.isRecording) samples.current.push(level(recState.metering));
  }, [recState, rec]);

  useEffect(() => {
    if (rec === 'idle') return;
    const id = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 200);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    // подсказка «влево — отмена» покачивается, стрелка замка зовёт вверх
    const hint = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: -6, duration: 600, useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    const up = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -4, duration: 500, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    hint.start();
    up.start();
    return () => {
      clearInterval(id);
      loop.stop();
      hint.stop();
      up.stop();
    };
  }, [rec, blink, nudge, bob]);

  async function startRec(): Promise<boolean> {
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

  async function finishRec(send: boolean, silent = false) {
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
      const auto = store.get().settings.autoTranscribe;
      const id = actions.addNote({
        chatId,
        kind: 'voice',
        text: '',
        replyTo: replyTo?.id,
        voice: { uri: rel, duration: dur, wave: compressWave(samples.current), status: 'none' },
      });
      haptic.success();
      onSent();
      if (auto) transcribe(id);
    } catch (e) {
      toast('Не удалось сохранить запись: ' + String((e as Error)?.message ?? e));
    }
  }

  const finishRef = useRef(finishRec);
  finishRef.current = finishRec;
  const startRef = useRef(startRec);
  startRef.current = startRec;

  // Удержание: короткий тап — подсказка, запись начинается только если палец держат дольше HOLD_MS.
  // held — палец сейчас на кнопке; запись могла запуститься уже после того, как палец отпустили, —
  // тогда её сразу выбрасываем (раньше такая запись шла «сама» без удержания).
  const held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginHold = async () => {
    holdTimer.current = null;
    if (!held.current) return;
    const ok = await startRef.current();
    if (!ok) return;
    if (!held.current) {
      // отпустили, пока запись запускалась
      finishRef.current(false, true);
      return;
    }
    pop.setValue(0.5);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
    setRec('recording');
  };
  const beginRef = useRef(beginHold);
  beginRef.current = beginHold;

  const releaseHold = () => {
    held.current = false;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      haptic.light();
      toast('Удерживайте, чтобы записать');
      return;
    }
    if (recRef.current === 'recording') finishRef.current(true);
  };

  const micPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => recRef.current === 'idle',
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
        if (g.dx < -120) {
          held.current = false;
          finishRef.current(false); // влево — отмена
        } else if (g.dy < -80) {
          haptic.success();
          dragX.setValue(0);
          dragY.setValue(0);
          setRec('locked'); // вверх на замок — запись идёт без пальца
        }
      },
      onPanResponderRelease: () => releaseHold(),
      onPanResponderTerminate: () => releaseHold(),
    }),
  ).current;

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function send() {
    const body = text.trim();
    if (editing) {
      if (editing.kind === 'text' && !body) return;
      actions.updateNote(editing.id, { text: body, editedAt: Date.now() });
      haptic.light();
      onCancelContext();
      return;
    }
    if (!body) return;
    actions.addNote({ chatId, kind: 'text', text: body, replyTo: replyTo?.id });
    haptic.light();
    setText('');
    onSent();
  }

  const showSend = text.trim().length > 0 || !!editing;
  const ctx = editing ?? replyTo;

  useEffect(() => {
    sendP.value = withSpring(showSend ? 1 : 0, { damping: 16, stiffness: 320, mass: 0.7 });
  }, [showSend, sendP]);

  return (
    <Reanimated.View style={[barBg, { paddingBottom: Math.max(insets.bottom, 8), borderTopWidth: 0.5, borderTopColor: t.dark ? '#0B121A' : '#DDDDDD' }]}>
      {ctx ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 }}>
          <Icon name={editing ? 'pencil' : 'reply'} size={20} color={t.accent} />
          <View style={{ width: 2, alignSelf: 'stretch', backgroundColor: t.accent, marginHorizontal: 10, borderRadius: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>{editing ? 'Изменение' : 'Ответ на заметку'}</Text>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 14 }}>{notePreview(ctx)}</Text>
          </View>
          <Pressable
            hitSlop={10}
            onPress={onCancelContext}
          >
            <Icon name="close" size={18} color={t.sub} />
          </Pressable>
        </View>
      ) : null}

      {/* Поле ввода не размонтируется во время записи — клавиатура остаётся открытой, как в Telegram */}
      <View>
        <View pointerEvents={rec === 'idle' ? 'auto' : 'none'} style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, opacity: rec === 'idle' ? 1 : 0 }}>
          <PressScale onPress={onAttach} feedback="select" scaleTo={0.85} accessibilityLabel="Прикрепить" hitSlop={6} style={{ width: 38, height: MIN_H, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="paperclip" size={24} color={t.sub} />
          </PressScale>
          {/* Поле растёт по строкам плавно, как в Telegram; после MAX_H — прокрутка внутри */}
          <Reanimated.View
            style={[
              {
                flex: 1,
                marginHorizontal: 6,
                backgroundColor: t.field,
                borderRadius: MIN_H / 2,
                borderWidth: 0.5,
                borderColor: t.dark ? '#0B121A' : '#D9D9D9',
                overflow: 'hidden',
              },
              fieldStyle,
            ]}
          >
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              onFocus={onFocus}
              onContentSizeChange={(e) => {
                const h = Math.ceil(e.nativeEvent.contentSize.height);
                const target = Math.max(MIN_H, Math.min(MAX_H, h));
                if (target === fieldTarget.current) return;
                fieldTarget.current = target;
                fieldH.value = withTiming(target, { duration: 160, easing: EASE_OUT });
                setScrollable(h > MAX_H);
              }}
              placeholder="Заметка"
              placeholderTextColor={t.sub}
              multiline
              scrollEnabled={scrollable}
              autoCapitalize="sentences"
              autoCorrect
              spellCheck
              keyboardAppearance={t.dark ? 'dark' : 'light'}
              selectionColor={t.accent}
              cursorColor={t.accent}
              textAlignVertical="top"
              style={{
                flex: 1,
                paddingHorizontal: 13,
                paddingTop: 8,
                paddingBottom: 8,
                color: t.text,
                fontSize: 17,
              }}
            />
          </Reanimated.View>
          {/* «Отправить» появляется на месте микрофона: один уменьшается и гаснет, другой вырастает */}
          <Reanimated.View pointerEvents={showSend ? 'auto' : 'none'} style={[{ width: 38, height: MIN_H, alignItems: 'center', justifyContent: 'center' }, sendStyle]}>
            <PressScale onPress={send} feedback="none" scaleTo={0.85} accessibilityLabel="Отправить" style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={editing ? 'check' : 'send'} size={18} color="#fff" />
              </View>
            </PressScale>
          </Reanimated.View>
        </View>
        {rec !== 'idle' ? (
        <Reanimated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[barBg, { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8 }]}>
          <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5533D', opacity: blink, marginRight: 8 }} />
          <Text style={{ color: t.text, fontSize: 16, fontVariant: ['tabular-nums'], width: 50 }}>{duration(elapsed)}</Text>
          {rec === 'recording' ? (
            <Reanimated.View entering={SlideInRight.springify().damping(18)} style={{ flex: 1 }}>
              <Animated.Text style={{ textAlign: 'center', color: t.sub, fontSize: 15, opacity: dragX.interpolate({ inputRange: [-120, -40, 0], outputRange: [0.2, 0.8, 1], extrapolate: 'clamp' }), transform: [{ translateX: Animated.add(Animated.multiply(dragX, 0.5), nudge) }] }}>
                ‹ влево — отмена
              </Animated.Text>
            </Reanimated.View>
          ) : (
            <Reanimated.View entering={FadeInDown.duration(200)} style={{ flex: 1 }}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={() => finishRec(false)} hitSlop={10} accessibilityLabel="Удалить запись">
                <Icon name="trash" size={20} color={t.danger} />
                <Text style={{ color: t.danger, fontSize: 17, marginLeft: 6 }}>Удалить</Text>
              </Pressable>
            </Reanimated.View>
          )}
          <View style={{ width: 64 }} />
        </Reanimated.View>
        ) : null}
      </View>

      {/* Кнопка микрофона: держать — запись, влево — отмена, вверх — замок */}
      {rec !== 'idle' || !editing ? (
        <Reanimated.View pointerEvents={showSend && rec === 'idle' ? 'none' : 'box-none'} style={[{ position: 'absolute', right: rec === 'idle' ? 8 : -6, bottom: Math.max(insets.bottom, 8) + (rec === 'idle' ? (MIN_H - 38) / 2 : -6) }, rec === 'idle' ? micStyle : null]}>
          {rec === 'recording' ? (
            <Reanimated.View entering={FadeInDown.springify().damping(14).stiffness(220)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', bottom: 92, left: 15 }}>
              <Animated.View style={{ width: 44, height: 84, borderRadius: 22, backgroundColor: t.field, borderWidth: 0.5, borderColor: t.line, alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8, transform: [{ translateY: Animated.multiply(dragY, 0.4) }] }}>
                <Animated.View style={{ transform: [{ scale: dragY.interpolate({ inputRange: [-80, 0], outputRange: [1.25, 1], extrapolate: 'clamp' }) }] }}>
                  <Icon name="lock" size={18} color={t.sub} />
                </Animated.View>
                <Animated.View style={{ transform: [{ translateY: bob }] }}>
                  <Icon name="chevronUp" size={16} color={t.sub} />
                </Animated.View>
              </Animated.View>
            </Reanimated.View>
          ) : null}
          {rec === 'locked' ? (
            <Reanimated.View entering={ZoomIn.springify().damping(12)}>
              <PressScale onPress={() => finishRec(true)} scaleTo={0.9} feedback="none" style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="send" size={28} color="#fff" />
              </PressScale>
            </Reanimated.View>
          ) : (
            <Animated.View
              {...micPan.panHandlers}
              style={{
                width: rec === 'idle' ? 38 : 74,
                height: rec === 'idle' ? 38 : 74,
                borderRadius: 37,
                backgroundColor: rec === 'idle' ? 'transparent' : t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateX: dragX }, { translateY: dragY }, { scale: rec === 'idle' ? 1 : pop }],
              }}
            >
              <Icon name={rec === 'idle' ? 'mic' : 'micFill'} size={rec === 'idle' ? 25 : 32} color={rec === 'idle' ? t.sub : '#fff'} />
            </Animated.View>
          )}
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}
