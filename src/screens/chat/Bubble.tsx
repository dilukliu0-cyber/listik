import { memo, useEffect, useRef } from 'react';
import { Animated, Image, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, { FadeInUp, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { resolveUri } from '../../files';
import { bytes, emojiOnlyCount, time } from '../../format';
import { haptic } from '../../haptics';
import { actions, notePreview, useStore, type Note } from '../../store';
import { isDarkColor, type Theme } from '../../theme';
import Icon from '../../ui/Icon';
import { SPRING_BOUNCY } from '../../ui/motion';
import RichText from './RichText';
import VoiceContent from './VoiceContent';

type Props = {
  note: Note;
  t: Theme;
  fontSize: number;
  selecting: boolean;
  selected: boolean;
  highlighted: boolean;
  onPress: (n: Note) => void;
  onLongPress: (n: Note) => void;
  onReply: (n: Note) => void;
  onJump: (id: string) => void;
  onOpenPhoto: (n: Note) => void;
  onOpenFile: (n: Note) => void;
  onEditTranscript: (n: Note) => void;
  preview?: boolean; // копия в контекстном меню — без жестов
  removing?: boolean; // идёт анимация удаления
};

// Новая заметка выезжает снизу: подпрыгивает на пружине и проявляется
const enterNew = FadeInUp.springify().damping(20).stiffness(240).mass(0.8);
const resize = LinearTransition.duration(220);

/** 1–3 для заметки только из эмодзи (крупно, без пузыря), иначе 0 */
export function bigEmojiCount(note: Note, on: boolean): number {
  if (!on || note.kind !== 'text' || note.replyTo) return 0;
  const n = emojiOnlyCount(note.text);
  return n <= 3 ? n : 0;
}

export function useBigEmoji(note: Note): number {
  const on = useStore((s) => s.settings.bigEmoji !== false);
  return bigEmojiCount(note, on);
}

function TimeTag({ note, color }: { note: Note; color: string }) {
  return (
    <Text style={{ color, fontSize: 11 }}>
      {note.editedAt ? 'изм. ' : ''}
      {time(note.createdAt)}
    </Text>
  );
}

export function BubbleBody({ note, t, fontSize, onJump, onOpenPhoto, onOpenFile, onEditTranscript, maxW }: Pick<Props, 'note' | 't' | 'fontSize' | 'onJump' | 'onOpenPhoto' | 'onOpenFile' | 'onEditTranscript'> & { maxW: number }) {
  const reply = useStore((s) => (note.replyTo ? s.notes[note.replyTo] : undefined));
  const bigEmoji = useBigEmoji(note);
  const textStyle = { color: t.outText, fontSize, lineHeight: Math.round(fontSize * 1.3) };
  const timeSpacer = <Text style={{ fontSize: 11, color: 'transparent' }}>{'    ' + (note.editedAt ? 'изм. ' : '') + '00:00'}</Text>;

  const quote = note.replyTo ? (
    <Pressable onPress={() => reply && !reply.deletedAt && onJump(reply.id)} style={{ flexDirection: 'row', marginBottom: 4, borderRadius: 6, overflow: 'hidden', backgroundColor: t.outAccent + '1F' }}>
      <View style={{ width: 3, backgroundColor: t.outAccent }} />
      <View style={{ paddingHorizontal: 7, paddingVertical: 3, flexShrink: 1 }}>
        <Text style={{ color: t.outAccent, fontWeight: '600', fontSize: 14 }}>Ответ</Text>
        <Text numberOfLines={1} style={{ color: t.outText, fontSize: 14 }}>
          {reply && !reply.deletedAt ? notePreview(reply) : 'Заметка удалена'}
        </Text>
      </View>
    </Pressable>
  ) : null;

  const pad = { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6 };
  const timePos = { position: 'absolute' as const, right: 10, bottom: 5 };

  switch (note.kind) {
    case 'photo': {
      const p = note.photo!;
      const w = Math.min(maxW, 270);
      const ratio = p.width && p.height ? p.height / p.width : 0.75;
      const h = Math.max(120, Math.min(360, Math.round(w * ratio)));
      return (
        <View style={{ padding: note.text || note.replyTo ? 3 : 0, width: w + (note.text || note.replyTo ? 6 : 0) }}>
          {quote ? <View style={{ paddingHorizontal: 7, paddingTop: 4 }}>{quote}</View> : null}
          <Pressable onPress={() => onOpenPhoto(note)}>
            <Image source={{ uri: resolveUri(p.uri) }} style={{ width: w, height: h, borderRadius: Math.max(4, t.radius - 3), backgroundColor: t.dark ? '#24384D' : '#8FB27A' }} resizeMode="cover" />
          </Pressable>
          {note.text ? (
            <View style={{ paddingHorizontal: 7, paddingTop: 5, paddingBottom: 3 }}>
              <RichText text={note.text} style={textStyle} linkColor={t.link} />
              <Text>{timeSpacer}</Text>
              <View style={{ ...timePos, right: 7, bottom: 3 }}>
                <TimeTag note={note} color={t.outSub} />
              </View>
            </View>
          ) : (
            <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 }}>
              <TimeTag note={note} color="#fff" />
            </View>
          )}
        </View>
      );
    }
    case 'file': {
      const f = note.file!;
      return (
        <View style={pad}>
          {quote}
          <Pressable onPress={() => onOpenFile(note)} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.outAccent, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Icon name="file" size={20} color={isDarkColor(t.outAccent) ? '#fff' : t.out} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text numberOfLines={2} style={{ color: t.outText, fontSize: 16, fontWeight: '600' }}>{f.name}</Text>
              <Text style={{ color: t.outSub, fontSize: 13, marginTop: 2 }}>{bytes(f.size)}</Text>
            </View>
          </Pressable>
          {note.text ? <RichText text={note.text} style={{ ...textStyle, marginTop: 6 }} linkColor={t.link} /> : null}
          <Text>{timeSpacer}</Text>
          <View style={timePos}>
            <TimeTag note={note} color={t.outSub} />
          </View>
        </View>
      );
    }
    case 'voice':
      return (
        <View style={[pad, { minWidth: 240 }]}>
          {quote}
          <VoiceContent note={note} t={t} accent={t.outAccent} sub={t.outSub} textColor={t.outText} fontSize={fontSize} onEditTranscript={() => onEditTranscript(note)} />
          <Text>{timeSpacer}</Text>
          <View style={timePos}>
            <TimeTag note={note} color={t.outSub} />
          </View>
        </View>
      );
    case 'list':
      return (
        <View style={[pad, { minWidth: 160 }]}>
          {quote}
          {note.text ? <Text style={{ ...textStyle, fontWeight: '600', marginBottom: 2 }}>{note.text}</Text> : null}
          {(note.items ?? []).map((it) => (
            <Pressable
              key={it.id}
              hitSlop={2}
              onPress={() => {
                haptic.select();
                actions.toggleItem(note.id, it.id);
              }}
              style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 }}
            >
              <Icon name={it.done ? 'squareCheck' : 'square'} size={fontSize + 3} color={it.done ? t.outAccent : t.outSub} style={{ marginRight: 7, marginTop: 1 }} />
              <Text style={{ ...textStyle, flexShrink: 1, opacity: it.done ? 0.5 : 1, textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.text}</Text>
            </Pressable>
          ))}
          <Text>{timeSpacer}</Text>
          <View style={timePos}>
            <TimeTag note={note} color={t.outSub} />
          </View>
        </View>
      );
    default:
      if (bigEmoji) {
        return (
          <View style={{ alignItems: 'flex-end', paddingTop: 2 }}>
            <Text style={{ fontSize: bigEmoji === 1 ? 64 : bigEmoji === 2 ? 52 : 42, lineHeight: bigEmoji === 1 ? 76 : bigEmoji === 2 ? 62 : 52 }}>{note.text.trim()}</Text>
            <View style={{ backgroundColor: t.datePill, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 }}>
              <TimeTag note={note} color="#fff" />
            </View>
          </View>
        );
      }
      return (
        <View style={pad}>
          {quote}
          <Text style={textStyle}>
            <RichText text={note.text} style={textStyle} linkColor={t.link} />
            {timeSpacer}
          </Text>
          <View style={timePos}>
            <TimeTag note={note} color={t.outSub} />
          </View>
        </View>
      );
  }
}

function Bubble(props: Props) {
  const { note, t, selecting, selected, highlighted, onPress, onLongPress, onReply, preview, removing } = props;
  // анимируем появление только у только что созданных заметок, а не у всей ленты при открытии чата
  const fresh = useRef(Date.now() - note.createdAt < 1500).current;
  const out = useSharedValue(0);
  const glow = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    if (removing) out.value = withTiming(1, { duration: 200 });
  }, [removing, out]);

  // переход из закрепа / поиска: пузырь мягко подсвечивается и гаснет
  useEffect(() => {
    if (highlighted) glow.value = withSequence(withTiming(1, { duration: 220 }), withDelay(900, withTiming(0, { duration: 450 })));
  }, [highlighted, glow]);

  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - out.value,
    transform: [{ scale: (1 - out.value * 0.15) * press.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const { width } = useWindowDimensions();
  const maxW = Math.round(width * 0.8);
  const x = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);
  const cb = useRef({ onReply, note, selecting });
  cb.current = { onReply, note, selecting };

  // Свайп влево — ответить
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !cb.current.selecting && g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        fired.current = false;
        x.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const v = Math.max(-90, Math.min(0, g.dx));
        x.setValue(v);
        if (v < -60 && !fired.current) {
          fired.current = true;
          haptic.light();
        }
        if (v > -60) fired.current = false;
      },
      onPanResponderRelease: () => {
        if (fired.current) cb.current.onReply(cb.current.note);
        Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 9 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const replyOpacity = x.interpolate({ inputRange: [-60, -20, 0], outputRange: [1, 0.2, 0], extrapolate: 'clamp' });
  const replyScale = x.interpolate({ inputRange: [-90, -60, -20, 0], outputRange: [1.15, 1, 0.5, 0.5], extrapolate: 'clamp' });
  const isPhotoOnly = (note.kind === 'photo' && !note.text && !note.replyTo) || useBigEmoji(note) > 0;

  const body = (
    <View
      style={{
        maxWidth: maxW,
        backgroundColor: isPhotoOnly ? 'transparent' : t.out,
        borderRadius: t.radius,
        borderBottomRightRadius: Math.min(6, t.radius),
        overflow: 'hidden',
      }}
    >
      <BubbleBody {...props} maxW={maxW} />
    </View>
  );

  if (preview) return body;

  return (
    <Reanimated.View entering={fresh ? enterNew : undefined} layout={resize}>
    <Pressable
      onPress={() => onPress(note)}
      onPressIn={() => {
        if (!selecting) press.value = withDelay(120, withTiming(0.97, { duration: 180 }));
      }}
      onPressOut={() => {
        press.value = withSpring(1, SPRING_BOUNCY);
      }}
      onLongPress={() => {
        haptic.medium();
        press.value = withSpring(1, SPRING_BOUNCY);
        onLongPress(note);
      }}
      delayLongPress={300}
      style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: selected ? 'rgba(51,144,236,0.12)' : 'transparent', flexDirection: 'row', alignItems: 'center' }}
    >
      <Reanimated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: t.dark ? 'rgba(62,136,247,0.25)' : 'rgba(51,144,236,0.18)' }, glowStyle]} />
      {selecting ? (
        <View style={{ width: 34 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: selected ? 0 : 1.5, borderColor: '#fff', backgroundColor: selected ? t.accent : 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <Icon name="check" size={14} color="#fff" /> : null}
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', right: -4, top: 0, bottom: 0, justifyContent: 'center', opacity: replyOpacity, transform: [{ scale: replyScale }] }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="reply" size={16} color="#fff" />
          </View>
        </Animated.View>
        <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
          <Reanimated.View pointerEvents={selecting ? 'none' : 'auto'} style={outStyle}>
            {body}
          </Reanimated.View>
        </Animated.View>
      </View>
    </Pressable>
    </Reanimated.View>
  );
}

export default memo(Bubble);
