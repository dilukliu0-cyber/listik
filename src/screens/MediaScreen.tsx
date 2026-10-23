import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image as XImage } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { resolveUri } from '../files';
import { monthKey, monthLabel } from '../format';
import { haptic } from '../haptics';
import type { RootStack } from '../navigation/types';
import { confirmDeleteNotes, deleteNotesWithUndo } from '../ui/dialogs';
import { useStore, type Note } from '../store';
import { useTheme } from '../theme';
import Icon from '../ui/Icon';
import { HeaderButton, TabHeader } from '../ui/kit';

export default function MediaScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStack>>();
  const { width } = useWindowDimensions();
  const chats = useStore((s) => s.chats);
  const notes = useStore((s) => s.notes);
  const [filter, setFilter] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const all = useMemo(
    () => Object.values(notes).filter((n) => n.kind === 'photo' && !n.deletedAt && chats[n.chatId] && !chats[n.chatId].deletedAt).sort((a, b) => b.createdAt - a.createdAt),
    [notes, chats],
  );
  const chatIds = useMemo(() => [...new Set(all.map((n) => n.chatId))], [all]);
  const photos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((n) => (!filter || n.chatId === filter) && (!q || n.text.toLowerCase().includes(q) || chats[n.chatId].title.toLowerCase().includes(q)));
  }, [all, filter, query, chats]);
  const groups = useMemo(() => {
    const m = new Map<number, Note[]>();
    for (const p of photos) {
      const k = monthKey(p.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return [...m.values()];
  }, [photos]);

  const size = (width - 4) / 3;
  const chip = (id: string | null, label: string) => {
    const on = filter === id;
    return (
      <Pressable
        key={id ?? 'all'}
        onPress={() => {
          haptic.select();
          setFilter(id);
        }}
        style={{ backgroundColor: on ? t.accent : t.search, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}
      >
        <Text style={{ color: on ? '#fff' : t.text, fontSize: 15 }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TabHeader
        title={selecting ? `Выбрано: ${selected.length}` : 'Медиа'}
        left={
          all.length ? (
            <HeaderButton
              title={selecting ? 'Отмена' : 'Выбрать'}
              onPress={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
            />
          ) : null
        }
        right={
          selecting ? (
            <HeaderButton
              icon="trash"
              color={t.danger}
              disabled={!selected.length}
              onPress={() =>
                confirmDeleteNotes(selected, (ids) => {
                  deleteNotesWithUndo(ids);
                  setSelecting(false);
                  setSelected([]);
                })
              }
            />
          ) : (
            <HeaderButton
              icon="search"
              onPress={() => {
                setSearching(!searching);
                setQuery('');
              }}
            />
          )
        }
      />
      {searching ? (
        <View style={{ marginHorizontal: 16, marginBottom: 6, backgroundColor: t.search, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 36 }}>
          <Icon name="search" size={16} color={t.sub} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Поиск по подписям" placeholderTextColor={t.sub} style={{ flex: 1, color: t.text, fontSize: 17, marginLeft: 6, paddingVertical: 0 }} />
        </View>
      ) : null}
      {chatIds.length ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
            {chip(null, 'Все')}
            {chatIds.map((id) => chip(id, chats[id].title))}
          </ScrollView>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {groups.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 }}>
            <Icon name="media" size={48} color={t.sub} />
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '600', marginTop: 12 }}>Пока нет фото</Text>
            <Text style={{ color: t.sub, fontSize: 15, textAlign: 'center', marginTop: 4 }}>Здесь собираются все фото из ваших чатов.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={monthKey(g[0].createdAt)}>
              <Text style={{ color: t.sub, fontSize: 13, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
                {monthLabel(g[0].createdAt)} · {g.length} фото
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                {g.map((p) => {
                  const sel = selected.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        if (selecting) {
                          haptic.select();
                          setSelected((s) => (sel ? s.filter((x) => x !== p.id) : [...s, p.id]));
                          return;
                        }
                        const list = [...photos].reverse();
                        nav.navigate('PhotoViewer', { ids: list.map((x) => x.id), index: list.findIndex((x) => x.id === p.id) });
                      }}
                    >
                      <XImage source={{ uri: resolveUri(p.photo!.uri) }} recyclingKey={p.id} contentFit="cover" transition={120} style={{ width: size, height: size, backgroundColor: t.search, opacity: selecting && !sel ? 0.85 : 1 }} />
                      <View style={{ position: 'absolute', left: 6, bottom: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: chats[p.chatId].color, borderWidth: 1.5, borderColor: '#fff' }} />
                      {selecting ? (
                        <View style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, borderWidth: sel ? 0 : 1.5, borderColor: '#fff', backgroundColor: sel ? t.accent : 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                          {sel ? <Icon name="check" size={14} color="#fff" /> : null}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
