import { setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, TextInput, View } from 'react-native';
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
import { REC_OPTIONS, compressWave, level } from './Recorder';

type Props = {
  t: Theme;
  chatId: string;
  replyTo: Note | null;
  editing: Note | null;
  onCancelContext: () => void;
  onAttach: () => void;
  onSent: () => void;
  text: string;
  setText: (s: string) => void;
};

type RecState = 'idle' | 'recording' | 'locked';

export default function Composer({ t, chatId, replyTo, editing, onCancelContext, onAttach, onSent, text, setText }: Props) {
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
  const inputRef = useRef<TextInput>(null);

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
    loop.start();
    return () => {
      clearInterval(id);
      loop.stop();
    };
  }, [rec, blink]);

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

  async function finishRec(send: boolean) {
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
      else haptic.warning();
      return;
    }
    if (dur < 0.7) {
      toast('Удерживайте микрофон, чтобы записать');
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

  const micPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => recRef.current !== 'locked',
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: async () => {
        const ok = await startRef.current();
        if (ok) setRec('recording');
      },
      onPanResponderMove: (_, g) => {
        if (recRef.current !== 'recording') return;
        dragX.setValue(Math.min(0, g.dx));
        dragY.setValue(Math.min(0, g.dy));
        if (g.dx < -120) {
          finishRef.current(false); // влево — отмена
        } else if (g.dy < -80) {
          haptic.medium();
          dragX.setValue(0);
          dragY.setValue(0);
          setRec('locked'); // вверх на замок — фиксация
        }
      },
      onPanResponderRelease: () => {
        if (recRef.current === 'recording') finishRef.current(true);
      },
      onPanResponderTerminate: () => {
        if (recRef.current === 'recording') finishRef.current(true);
      },
    }),
  ).current;

  function send() {
    const body = text.trim();
    if (editing) {
      if (editing.kind === 'text' && !body) return;
      actions.updateNote(editing.id, { text: body, editedAt: Date.now() });
      haptic.light();
      setText('');
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

  return (
    <View style={{ backgroundColor: t.chatBar, paddingBottom: Math.max(insets.bottom, 8), borderTopWidth: 0.5, borderTopColor: t.dark ? '#0B121A' : '#DDDDDD' }}>
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
            onPress={() => {
              if (editing) setText('');
              onCancelContext();
            }}
          >
            <Icon name="close" size={18} color={t.sub} />
          </Pressable>
        </View>
      ) : null}

      {rec !== 'idle' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, minHeight: 52 }}>
          <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5533D', opacity: blink, marginRight: 8 }} />
          <Text style={{ color: t.text, fontSize: 16, fontVariant: ['tabular-nums'], width: 50 }}>{duration(elapsed)}</Text>
          {rec === 'recording' ? (
            <Animated.Text style={{ flex: 1, textAlign: 'center', color: t.sub, fontSize: 15, transform: [{ translateX: Animated.multiply(dragX, 0.5) }] }}>
              ‹ влево — отмена
            </Animated.Text>
          ) : (
            <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => finishRec(false)} hitSlop={10}>
              <Text style={{ color: t.danger, fontSize: 17 }}>Отмена</Text>
            </Pressable>
          )}
          <View style={{ width: 64 }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8 }}>
          <Pressable onPress={onAttach} hitSlop={6} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="paperclip" size={24} color={t.sub} />
          </Pressable>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Заметка"
            placeholderTextColor={t.sub}
            multiline
            style={{
              flex: 1,
              maxHeight: 140,
              minHeight: 38,
              marginHorizontal: 6,
              backgroundColor: t.field,
              borderRadius: 19,
              borderWidth: 0.5,
              borderColor: t.dark ? '#0B121A' : '#DDDDDD',
              paddingHorizontal: 14,
              paddingTop: 9,
              paddingBottom: 9,
              color: t.text,
              fontSize: 17,
            }}
          />
          {showSend ? (
            <Pressable onPress={send} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={editing ? 'check' : 'send'} size={18} color="#fff" />
              </View>
            </Pressable>
          ) : (
            <View style={{ width: 38, height: 38 }} />
          )}
        </View>
      )}

      {/* Кнопка микрофона: держать — запись, влево — отмена, вверх — замок */}
      {!showSend || rec !== 'idle' ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', right: rec === 'idle' ? 8 : -6, bottom: Math.max(insets.bottom, 8) + (rec === 'idle' ? 0 : -6) }}>
          {rec === 'recording' ? (
            <Animated.View style={{ position: 'absolute', bottom: 92, left: 15, width: 44, height: 84, borderRadius: 22, backgroundColor: t.field, borderWidth: 0.5, borderColor: t.line, alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8, transform: [{ translateY: Animated.multiply(dragY, 0.4) }] }}>
              <Icon name="lock" size={18} color={t.sub} />
              <Icon name="chevronUp" size={16} color={t.sub} />
            </Animated.View>
          ) : null}
          {rec === 'locked' ? (
            <Pressable onPress={() => finishRec(true)} style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={28} color="#fff" />
            </Pressable>
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
                transform: [{ translateX: dragX }, { translateY: dragY }],
              }}
            >
              <Icon name={rec === 'idle' ? 'mic' : 'micFill'} size={rec === 'idle' ? 25 : 32} color={rec === 'idle' ? t.sub : '#fff'} />
            </Animated.View>
          )}
        </View>
      ) : null}
    </View>
  );
}
