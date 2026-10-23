import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { dayAndTime } from '../format';
import { haptic } from '../haptics';
import { openChatAt } from '../navigation/ref';
import type { ScreenProps } from '../navigation/types';
import { actions, chatNotes, notePreview, useStore } from '../store';
import { useTheme } from '../theme';
import Icon from '../ui/Icon';

export default function PinnedListScreen({ route }: ScreenProps<'PinnedList'>) {
  const t = useTheme();
  const { chatId } = route.params;
  const pins = useStore((s) => chatNotes(s, chatId)).filter((n) => n.pinnedAt).reverse();
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      data={pins}
      keyExtractor={(n) => n.id}
      ListEmptyComponent={<Text style={{ color: t.sub, textAlign: 'center', marginTop: 40 }}>Нет закреплённых заметок</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => openChatAt(chatId, item.id)} style={({ pressed }) => ({ backgroundColor: pressed ? t.line : t.bg })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={3} style={{ color: t.text, fontSize: 16 }}>{notePreview(item)}</Text>
              <Text style={{ color: t.sub, fontSize: 13, marginTop: 3 }}>{dayAndTime(item.createdAt)}</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                haptic.medium();
                actions.pinNote(item.id, false);
              }}
              style={{ padding: 8 }}
            >
              <Icon name="unpin" size={20} color={t.sub} />
            </Pressable>
          </View>
        </Pressable>
      )}
    />
  );
}
