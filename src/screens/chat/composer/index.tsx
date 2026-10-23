// Панель ввода как в Telegram iOS: скрепка — поле, растущее по строкам, — микрофон/«Отправить».
// Над полем — плашка ответа/правки и, при выделении текста, «Форматирование».
// Во время записи голосового поле не размонтируется — клавиатура остаётся открытой.
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, TextInput, View, type NativeSyntheticEvent, type TextInputSelectionChangeEventData } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, FadeOut, SlideInRight, ZoomIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { duration } from '../../../format';
import { haptic } from '../../../haptics';
import { makeLink, toggleMark, type Mark, type Sel } from '../../../markup';
import { actions, type Note } from '../../../store';
import type { Theme } from '../../../theme';
import { promptText } from '../../../ui/dialogs';
import Icon from '../../../ui/Icon';
import { EASE_OUT, PressScale, useBgTransition } from '../../../ui/motion';
import ContextBar from './ContextBar';
import FormatBar from './FormatBar';
import { useVoice } from './useVoice';

type Props = {
  t: Theme;
  chatId: string;
  replyTo: Note | null;
  editing: Note | null;
  onCancelContext: () => void;
  onAttach: () => void;
  onFocus?: () => void;
  onSent: () => void;
  onJump?: (id: string) => void;
  text: string;
  setText: (s: string) => void;
};

const MIN_H = 36; // поле в одну строку
const MAX_H = 150; // ~6 строк, дальше прокрутка внутри поля
const BTN = 40; // ширина кнопок слева и справа

export default function Composer({ t, chatId, replyTo, editing, onCancelContext, onAttach, onFocus, onSent, onJump, text, setText }: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const barBg = useBgTransition(t.chatBar);
  const voice = useVoice({ chatId, replyToId: replyTo?.id, onSent });
  const { rec } = voice;
  const navigation = useNavigation();

  // пока идёт запись, свайп «назад» выключен — он не должен отбирать палец у микрофона
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: rec === 'idle' });
  }, [rec, navigation]);

  // ---- поле: плавный рост по строкам ----
  const fieldH = useSharedValue(MIN_H);
  const fieldTarget = useRef(MIN_H);
  const [scrollable, setScrollable] = useState(false);
  const fieldStyle = useAnimatedStyle(() => ({ height: fieldH.value }));

  // ---- выделение → форматирование ----
  const sel = useRef<Sel>({ start: 0, end: 0 });
  const [hasSel, setHasSel] = useState(false);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );
  const onSelection = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    sel.current = e.nativeEvent.selection;
    const on = e.nativeEvent.selection.end > e.nativeEvent.selection.start;
    if (on !== hasSel) setHasSel(on);
  };
  const applyFormat = (m: Mark | 'link') => {
    const s = sel.current;
    const set = (r: { text: string; sel: Sel }) => {
      setText(r.text);
      sel.current = r.sel;
      setHasSel(r.sel.end > r.sel.start);
      inputRef.current?.focus();
      // курсор/выделение — на оформленный текст
      requestAnimationFrame(() => (inputRef.current as unknown as { setSelection?: (a: number, b: number) => void })?.setSelection?.(r.sel.start, r.sel.end));
    };
    if (m === 'link') {
      promptText('Ссылка', 'https://', (url) => set(makeLink(text, s, url)));
      return;
    }
    set(toggleMark(text, s, m));
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // ---- кнопка справа: микрофон ↔ «Отправить» ----
  const showSend = text.trim().length > 0 || !!editing;
  const sendP = useSharedValue(showSend ? 1 : 0);
  useEffect(() => {
    sendP.value = withSpring(showSend ? 1 : 0, { damping: 16, stiffness: 320, mass: 0.7 });
  }, [showSend, sendP]);
  const sendStyle = useAnimatedStyle(() => ({ opacity: sendP.value, transform: [{ scale: 0.4 + 0.6 * sendP.value }] }));
  const micStyle = useAnimatedStyle(() => ({ opacity: 1 - sendP.value, transform: [{ scale: 1 - 0.6 * sendP.value }] }));

  function send() {
    const body = text.trim();
    if (editing) {
      if (editing.kind === 'text' && !body) return;
      actions.updateNote(editing.id, { text: body, editedAt: Date.now() });
      haptic.light();
      onCancelContext(); // вернёт в поле текст, который был до правки
      return;
    }
    if (!body) return;
    actions.addNote({ chatId, kind: 'text', text: body, replyTo: replyTo?.id });
    haptic.light();
    setText('');
    onSent();
  }

  const ctx = editing ?? replyTo;
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Reanimated.View style={[barBg, { paddingBottom: bottom, borderTopWidth: 0.5, borderTopColor: t.dark ? '#0B121A' : '#D9D9D9' }]}>
      <ContextBar t={t} note={ctx} editing={!!editing} onClose={onCancelContext} onPress={onJump} />
      {hasSel && focused && rec === 'idle' ? <FormatBar t={t} onPick={applyFormat} /> : null}

      <View>
        <View pointerEvents={rec === 'idle' ? 'auto' : 'none'} style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4, paddingTop: 7, opacity: rec === 'idle' ? 1 : 0 }}>
          <PressScale onPress={onAttach} feedback="select" scaleTo={0.85} accessibilityLabel="Прикрепить" hitSlop={6} style={{ width: BTN, height: MIN_H, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="paperclip" size={24} color={t.sub} />
          </PressScale>
          <Reanimated.View style={[{ flex: 1, backgroundColor: t.field, borderRadius: MIN_H / 2, borderWidth: 0.5, borderColor: t.dark ? '#0B121A' : '#D9D9D9', overflow: 'hidden' }, fieldStyle]}>
            {/* невидимая копия текста: по её высоте поле плавно растёт и сжимается */}
            <Text
              pointerEvents="none"
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                const target = Math.max(MIN_H, Math.min(MAX_H, h));
                setScrollable(h > MAX_H);
                if (target === fieldTarget.current) return;
                fieldTarget.current = target;
                fieldH.value = withTiming(target, { duration: 170, easing: EASE_OUT });
              }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: 0, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 17 }}
            >
              {text.endsWith('\n') || !text ? text + ' ' : text}
            </Text>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              onFocus={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setFocused(true);
                onFocus?.();
              }}
              // панель форматирования прячем не сразу: нажатие на неё может на миг снять фокус
              onBlur={() => {
                blurTimer.current = setTimeout(() => setFocused(false), 250);
              }}
              onSelectionChange={onSelection}
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
              style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, color: t.text, fontSize: 17 }}
            />
          </Reanimated.View>
          {/* «Отправить» появляется на месте микрофона: один уменьшается и гаснет, другой вырастает */}
          <Reanimated.View pointerEvents={showSend ? 'auto' : 'none'} style={[{ width: BTN, height: MIN_H, alignItems: 'center', justifyContent: 'center' }, sendStyle]}>
            <PressScale onPress={send} feedback="none" scaleTo={0.85} accessibilityLabel={editing ? 'Сохранить' : 'Отправить'} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={editing ? 'check' : 'send'} size={18} color="#fff" />
            </PressScale>
          </Reanimated.View>
        </View>

        {rec !== 'idle' ? (
          <Reanimated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[barBg, { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 7 }]}>
            <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5533D', opacity: voice.blink, marginRight: 8 }} />
            <Text style={{ color: t.text, fontSize: 16, fontVariant: ['tabular-nums'], width: 50 }}>{duration(voice.elapsed)}</Text>
            {rec === 'recording' ? (
              <Reanimated.View entering={SlideInRight.springify().damping(18)} style={{ flex: 1 }}>
                {/* подсказка ещё и кнопка: если касание потерялось, тап по ней отменяет запись */}
                <Pressable onPress={() => voice.finish(false)} hitSlop={10} accessibilityLabel="Отменить запись">
                <Animated.Text style={{ textAlign: 'center', color: t.sub, fontSize: 15, opacity: voice.dragX.interpolate({ inputRange: [-120, -40, 0], outputRange: [0.2, 0.8, 1], extrapolate: 'clamp' }), transform: [{ translateX: Animated.add(Animated.multiply(voice.dragX, 0.5), voice.nudge) }] }}>
                  ‹ Влево — отмена
                </Animated.Text>
                </Pressable>
              </Reanimated.View>
            ) : (
              <Reanimated.View entering={FadeInDown.duration(200)} style={{ flex: 1 }}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={() => voice.finish(false)} hitSlop={10} accessibilityLabel="Удалить запись">
                  <Icon name="trash" size={20} color={t.danger} />
                  <Text style={{ color: t.danger, fontSize: 17, marginLeft: 6 }}>Удалить</Text>
                </Pressable>
              </Reanimated.View>
            )}
            <View style={{ width: 64 }} />
          </Reanimated.View>
        ) : null}
      </View>

      {/* Микрофон: держать — запись, влево — отмена, вверх — замок. Один и тот же элемент растёт,
          чтобы палец не терял кнопку при начале записи. */}
      {!editing || rec !== 'idle' ? (
        <Reanimated.View
          pointerEvents={showSend && rec === 'idle' ? 'none' : 'box-none'}
          style={[{ position: 'absolute', right: rec === 'idle' ? 4 : -6, bottom: rec === 'idle' ? bottom : bottom - 6 }, rec === 'idle' ? micStyle : null]}
        >
          {rec === 'recording' ? (
            <Reanimated.View entering={FadeInDown.springify().damping(14).stiffness(220)} exiting={FadeOut.duration(120)} style={{ position: 'absolute', bottom: 92, left: 15 }}>
              <Animated.View style={{ width: 44, height: 84, borderRadius: 22, backgroundColor: t.field, borderWidth: 0.5, borderColor: t.line, alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8, transform: [{ translateY: Animated.multiply(voice.dragY, 0.4) }] }}>
                <Animated.View style={{ transform: [{ scale: voice.dragY.interpolate({ inputRange: [-80, 0], outputRange: [1.25, 1], extrapolate: 'clamp' }) }] }}>
                  <Icon name="lock" size={18} color={t.sub} />
                </Animated.View>
                <Animated.View style={{ transform: [{ translateY: voice.bob }] }}>
                  <Icon name="chevronUp" size={16} color={t.sub} />
                </Animated.View>
              </Animated.View>
            </Reanimated.View>
          ) : null}
          {rec === 'locked' ? (
            <Reanimated.View entering={ZoomIn.springify().damping(12)}>
              <PressScale onPress={() => voice.finish(true)} scaleTo={0.9} feedback="none" accessibilityLabel="Отправить голосовое" style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="send" size={28} color="#fff" />
              </PressScale>
            </Reanimated.View>
          ) : (
            <Animated.View
              {...voice.panHandlers}
              accessibilityLabel="Удерживайте, чтобы записать голосовое"
              style={{
                width: rec === 'idle' ? BTN : 74,
                height: rec === 'idle' ? MIN_H : 74,
                borderRadius: 37,
                backgroundColor: rec === 'idle' ? 'transparent' : t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ translateX: voice.dragX }, { translateY: voice.dragY }, { scale: rec === 'idle' ? 1 : voice.pop }],
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
