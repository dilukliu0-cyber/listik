import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

import type { RootStack } from '../../navigation/types';
import { useStore } from '../../store';
import { useTheme } from '../../theme';
import ChatRow from '../../ui/ChatRow';
import Icon from '../../ui/Icon';
import SwipeRow, { closeOpenRow } from '../../ui/SwipeRow';
import { chatSwipeActions, sortChats } from '../ChatsScreen';

export default function ArchiveScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStack>>();
  const chatsMap = useStore((s) => s.chats);
  const notes = useStore((s) => s.notes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chats = useMemo(() => sortChats(Object.values(chatsMap).filter((c) => c.archived && !c.deletedAt)), [chatsMap, notes]);
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      data={chats}
      keyExtractor={(c) => c.id}
      onScrollBeginDrag={closeOpenRow}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 }}>
          <Icon name="archive" size={48} color={t.sub} />
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '600', marginTop: 12 }}>Архив пуст</Text>
          <Text style={{ color: t.sub, fontSize: 15, textAlign: 'center', marginTop: 4 }}>Смахните чат влево и нажмите «В архив», чтобы убрать его из списка.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const sw = chatSwipeActions(item, t);
        return (
          <SwipeRow left={sw.left} right={sw.right}>
            <ChatRow chat={item} onPress={() => nav.navigate('Chat', { chatId: item.id })} />
          </SwipeRow>
        );
      }}
    />
  );
}
