import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { haptic } from '../haptics';
import type { ScreenProps } from '../navigation/types';
import { toast } from '../runtime';
import { actions, useStore } from '../store';
import { useTheme } from '../theme';
import Avatar from '../ui/Avatar';
import { sortChats } from './ChatsScreen';

export default function ForwardScreen({ route, navigation }: ScreenProps<'Forward'>) {
  const t = useTheme();
  const chatsMap = useStore((s) => s.chats);
  const chats = useMemo(() => sortChats(Object.values(chatsMap).filter((c) => !c.deletedAt)), [chatsMap]);
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      data={chats}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Text style={{ color: t.sub, fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 }}>Выберите чат, куда переслать</Text>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            actions.forwardNotes(route.params.noteIds, item.id);
            haptic.success();
            toast(`Переслано в «${item.title}»`);
            navigation.goBack();
          }}
          style={({ pressed }) => ({ backgroundColor: pressed ? t.line : t.bg })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
            <View style={{ paddingVertical: 7, marginRight: 12 }}>
              <Avatar chat={item} size={42} />
            </View>
            <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
              <Text style={{ color: t.text, fontSize: 17 }}>{item.title}</Text>
              {item.archived ? <Text style={{ color: t.sub, fontSize: 13 }}>в архиве</Text> : null}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}
