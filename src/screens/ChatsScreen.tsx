import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listTime } from '../format';
import { haptic } from '../haptics';
import type { RootStack } from '../navigation/types';
import { actions, lastActivity, notePreview, noteSearchText, store, useStore, type Chat, type Note } from '../store';
import { TEMPLATES } from '../templates';
import { useTheme } from '../theme';
import { confirmDeleteChats } from '../ui/dialogs';
import Avatar from '../ui/Avatar';
import ChatRow from '../ui/ChatRow';
import Icon from '../ui/Icon';
import { HeaderButton, TabHeader } from '../ui/kit';
import SwipeRow, { closeOpenRow } from '../ui/SwipeRow';

// строки чатов плавно съезжаются при закреплении, архивации и удалении
const rowLayout = LinearTransition.springify().damping(24).stiffness(240);

type Nav = NativeStackNavigationProp<RootStack>;

export function sortChats(list: Chat[]) {
  const s = store.get();
  return list.sort((a, b) => {
    if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
    if (a.pinnedAt && b.pinnedAt) return a.pinnedAt - b.pinnedAt;
    return lastActivity(s, b) - lastActivity(s, a);
  });
}

export function chatSwipeActions(chat: Chat, t: ReturnType<typeof useTheme>) {
  return {
    left: chat.archived
      ? []
      : [
          {
            label: chat.pinnedAt ? 'Открепить' : 'Закрепить',
            icon: (chat.pinnedAt ? 'unpin' : 'pin') as 'pin',
            color: '#34C759',
            onPress: () => {
              haptic.medium();
              actions.pinChat(chat.id, !chat.pinnedAt);
            },
          },
        ],
    right: [
      {
        label: 'Удалить',
        icon: 'trash' as const,
        color: t.danger,
        onPress: () => confirmDeleteChats([chat.id]),
      },
      {
        label: chat.archived ? 'Вернуть' : 'В архив',
        icon: (chat.archived ? 'unarchive' : 'archive') as 'archive',
        color: '#8E8E93',
        onPress: () => {
          haptic.light();
          actions.archiveChat(chat.id, !chat.archived);
        },
      },
    ],
  };
}

type SearchHit = { key: string; chat: Chat; note?: Note };

export default function ChatsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const chatsMap = useStore((s) => s.chats);
  const notes = useStore((s) => s.notes);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const chats = useMemo(
    () => sortChats(Object.values(chatsMap).filter((c) => !c.deletedAt && !c.archived)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatsMap, notes],
  );
  const archived = useMemo(() => Object.values(chatsMap).filter((c) => !c.deletedAt && c.archived), [chatsMap]);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];
    for (const c of Object.values(chatsMap)) if (!c.deletedAt && c.title.toLowerCase().includes(q)) out.push({ key: 'c' + c.id, chat: c });
    const found = Object.values(notes)
      .filter((n) => !n.deletedAt && chatsMap[n.chatId] && !chatsMap[n.chatId].deletedAt && noteSearchText(n).includes(q))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
    for (const n of found) out.push({ key: 'n' + n.id, chat: chatsMap[n.chatId], note: n });
    return out;
  }, [query, chatsMap, notes]);

  const open = (id: string, jumpTo?: string) => {
    if (closeOpenRow()) return; // как в Telegram: первый тап закрывает открытый свайп
    Keyboard.dismiss();
    nav.navigate('Chat', { chatId: id, jumpTo });
  };

  const toggleSel = (id: string) => {
    haptic.select();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const finishEdit = () => {
    setEditing(false);
    setSelected([]);
  };

  const empty = chats.length === 0 && archived.length === 0;

  // в режиме «Изм.» панель действий встаёт на место вкладок, как в Telegram
  useEffect(() => {
    nav.setOptions({ tabBarStyle: editing ? { display: 'none' } : { backgroundColor: t.bar, borderTopColor: t.line } } as object);
  }, [editing, nav, t.bar, t.line]);

  const header = (
    <TabHeader
      title="Чаты"
      left={
        empty ? null : (
          <HeaderButton
            title={editing ? 'Готово' : 'Изм.'}
            bold={editing}
            onPress={() => {
              closeOpenRow();
              if (editing) finishEdit();
              else setEditing(true);
            }}
          />
        )
      }
      right={<HeaderButton icon="edit" onPress={() => nav.navigate('EditChat')} />}
    />
  );

  if (empty) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: t.dark ? '#1D3550' : '#E6F1FB', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="messagePlus" size={46} color={t.accent} />
          </View>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 6 }}>Создайте первый чат</Text>
          <Text style={{ color: t.sub, fontSize: 15, textAlign: 'center', lineHeight: 20 }}>
            Каждый чат — тема. Пишите туда, как другу: текст, фото, голосовые.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((k) => {
              const tp = TEMPLATES[k];
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    haptic.light();
                    const id = actions.createChat(tp);
                    nav.navigate('Chat', { chatId: id });
                  }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.search, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
                >
                  <Icon name={tp.icon} size={17} color={tp.color} />
                  <Text style={{ color: t.text, fontSize: 15 }}>{tp.title}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => nav.navigate('EditChat')}
            style={({ pressed }) => ({ backgroundColor: t.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13, marginTop: 22, opacity: pressed ? 0.8 : 1 })}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Новый чат</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const searchBar = (
    <View style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: t.search, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 36 }}>
      <Icon name="search" size={16} color={t.sub} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск по заметкам"
        placeholderTextColor={t.sub}
        style={{ flex: 1, color: t.text, fontSize: 17, marginLeft: 6, paddingVertical: 0 }}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
    </View>
  );

  // Поиск и обычный список — в одном дереве: поле поиска не пересоздаётся и не теряет фокус
  const searchList = query.trim() ? (
        <FlatList
          data={hits}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(h) => h.key}
          ListEmptyComponent={<Text style={{ color: t.sub, textAlign: 'center', marginTop: 40, fontSize: 15 }}>Ничего не найдено</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item.chat.id, item.note?.id)} style={({ pressed }) => ({ backgroundColor: pressed ? t.line : t.bg })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
                <View style={{ paddingVertical: 7, marginRight: 12 }}>
                  <Avatar chat={item.chat} size={44} />
                </View>
                <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', paddingRight: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
                  <View style={{ flexDirection: 'row' }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }}>{item.chat.title}</Text>
                    {item.note ? <Text style={{ color: t.sub, fontSize: 13 }}>{listTime(item.note.createdAt)}</Text> : null}
                  </View>
                  {item.note ? (
                    <Highlight text={notePreview(item.note)} query={query.trim()} color={t.sub} hl={t.text} />
                  ) : (
                    <Text style={{ color: t.sub, fontSize: 14 }}>Чат · {listTime(lastActivity(store.get(), item.chat))}</Text>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      {searchBar}
      {searchList}
      <Reanimated.FlatList
        style={searchList ? { display: 'none' } : undefined}
        data={chats}
        itemLayoutAnimation={rowLayout}
        keyExtractor={(c) => c.id}
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={closeOpenRow}
        ListHeaderComponent={
          <>
            {archived.length ? (
              <Pressable onPress={() => nav.navigate('Archive')} style={({ pressed }) => ({ backgroundColor: pressed ? t.line : t.dark ? t.bg : t.bar })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
                  <View style={{ paddingVertical: 8, marginRight: 12 }}>
                    <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.pinIcon, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="archive" size={26} color="#fff" />
                    </View>
                  </View>
                  <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line, paddingRight: 14 }}>
                    <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>Архив</Text>
                    <Text numberOfLines={1} style={{ color: t.sub, fontSize: 15, marginTop: 3 }}>
                      {archived.map((c) => c.title).join(', ')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const sw = chatSwipeActions(item, t);
          return (
            <SwipeRow left={sw.left} right={sw.right} enabled={!editing}>
              <ChatRow
                chat={item}
                selecting={editing}
                selected={selected.includes(item.id)}
                onPress={() => (editing ? toggleSel(item.id) : open(item.id))}
                onLongPress={() => {
                  haptic.medium();
                  setEditing(true);
                  setSelected([item.id]);
                }}
              />
            </SwipeRow>
          );
        }}
      />
      {editing ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: t.bar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
          <HeaderButton
            title="В архив"
            disabled={!selected.length}
            onPress={() => {
              selected.forEach((id) => actions.archiveChat(id, true));
              haptic.light();
              finishEdit();
            }}
          />
          <HeaderButton
            title="Закрепить"
            disabled={!selected.length}
            onPress={() => {
              const allPinned = selected.every((id) => store.get().chats[id]?.pinnedAt);
              selected.forEach((id) => actions.pinChat(id, !allPinned));
              haptic.medium();
              finishEdit();
            }}
          />
          <HeaderButton
            title="Удалить"
            color={t.danger}
            disabled={!selected.length}
            onPress={() => confirmDeleteChats(selected, finishEdit)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function Highlight({ text, query, color, hl, lines = 2, size = 14 }: { text: string; query: string; color: string; hl: string; lines?: number; size?: number }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0 || !query) return <Text numberOfLines={lines} style={{ color, fontSize: size }}>{text}</Text>;
  const start = Math.max(0, i - 30);
  const pre = (start > 0 ? '…' : '') + text.slice(start, i);
  return (
    <Text numberOfLines={lines} style={{ color, fontSize: size }}>
      {pre}
      <Text style={{ color: hl, fontWeight: '600' }}>{text.slice(i, i + query.length)}</Text>
      {text.slice(i + query.length)}
    </Text>
  );
}
