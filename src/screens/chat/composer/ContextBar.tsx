// Плашка над полем ввода: «Ответ на заметку» / «Редактирование», как в Telegram.
// Выезжает и уезжает по высоте; пока уезжает — показывает последнюю заметку.
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { resolveUri } from '../../../files';
import { notePreview, type Note } from '../../../store';
import type { Theme } from '../../../theme';
import Icon from '../../../ui/Icon';
import { EASE_OUT } from '../../../ui/motion';

const H = 46;

export default function ContextBar({ t, note, editing, onClose, onPress }: { t: Theme; note: Note | null; editing: boolean; onClose: () => void; onPress?: (id: string) => void }) {
  const p = useSharedValue(note ? 1 : 0);
  const last = useRef<{ note: Note; editing: boolean } | null>(null);
  if (note) last.current = { note, editing };

  useEffect(() => {
    p.value = withTiming(note ? 1 : 0, { duration: 200, easing: EASE_OUT });
  }, [note, p]);

  const box = useAnimatedStyle(() => ({ height: p.value * H, opacity: p.value }));
  const shown = last.current;
  if (!shown) return null;
  const n = shown.note;
  const thumb = n.kind === 'photo' && n.photo ? resolveUri(n.photo.uri) : null;

  return (
    <Animated.View style={[{ overflow: 'hidden' }, box]} pointerEvents={note ? 'auto' : 'none'}>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6, paddingTop: 6 }}>
        <Icon name={shown.editing ? 'pencil' : 'reply'} size={22} color={t.accent} />
        <Pressable onPress={() => onPress?.(n.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
          <View style={{ width: 2, alignSelf: 'stretch', backgroundColor: t.accent, borderRadius: 1, marginRight: 8 }} />
          {thumb ? <Image source={{ uri: thumb }} style={{ width: 34, height: 34, borderRadius: 4, marginRight: 8 }} contentFit="cover" /> : null}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: t.accent, fontWeight: '600', fontSize: 15 }}>
              {shown.editing ? 'Редактирование' : 'Ответ на заметку'}
            </Text>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 15 }}>
              {notePreview(n)}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={shown.editing ? 'Отменить редактирование' : 'Отменить ответ'} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={t.sub} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
