import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { removeFiles } from '../../files';
import { notesCount } from '../../format';
import { haptic } from '../../haptics';
import type { ScreenProps } from '../../navigation/types';
import { actions, chatNotes, daysLeft, notePreview, store, useStore } from '../../store';
import { useTheme } from '../../theme';
import Avatar from '../../ui/Avatar';
import { confirm, showActions } from '../../ui/dialogs';
import Icon from '../../ui/Icon';
import { HeaderButton } from '../../ui/kit';

type Entry = { key: string; kind: 'chat' | 'note'; id: string; at: number };

export function purgeForever(chatIds: string[], noteIds: string[]) {
  const orphan = actions.purge(chatIds, noteIds);
  removeFiles(orphan);
}

export default function DeletedScreen({ navigation }: ScreenProps<'Deleted'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const chats = useStore((s) => s.chats);
  const notes = useStore((s) => s.notes);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const c of Object.values(chats)) if (c.deletedAt) out.push({ key: 'c' + c.id, kind: 'chat', id: c.id, at: c.deletedAt });
    for (const n of Object.values(notes)) if (n.deletedAt && chats[n.chatId] && !chats[n.chatId].deletedAt) out.push({ key: 'n' + n.id, kind: 'note', id: n.id, at: n.deletedAt });
    return out.sort((a, b) => b.at - a.at);
  }, [chats, notes]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        entries.length ? (
          <HeaderButton
            title={selecting ? 'Готово' : 'Выбрать'}
            bold={selecting}
            onPress={() => {
              setSelecting(!selecting);
              setSel([]);
            }}
          />
        ) : null,
    });
  }, [navigation, selecting, entries.length]);

  const split = (keys: string[]) => {
    const list = entries.filter((e) => keys.includes(e.key));
    return { chatIds: list.filter((e) => e.kind === 'chat').map((e) => e.id), noteIds: list.filter((e) => e.kind === 'note').map((e) => e.id) };
  };
  const restore = (keys: string[]) => {
    const { chatIds, noteIds } = split(keys);
    chatIds.forEach((id) => actions.restoreChat(id));
    actions.restoreNotes(noteIds);
    haptic.success();
    setSel([]);
    setSelecting(false);
  };
  const destroy = (keys: string[]) => {
    const { chatIds, noteIds } = split(keys);
    const n = keys.length;
    confirm('Удалить навсегда?', n === 1 ? 'Это действие нельзя отменить.' : `Будет удалено: ${n}. Это действие нельзя отменить.`, 'Удалить', () => {
      purgeForever(chatIds, noteIds);
      haptic.warning();
      setSel([]);
      setSelecting(false);
    });
  };

  const allKeys = entries.map((e) => e.key);
  const target = selecting && sel.length ? sel : allKeys;

  return (
    <View style={{ flex: 1, backgroundColor: t.group }}>
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}>
        <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32, marginBottom: 10 }}>Заметки и чаты хранятся 30 дней, потом удаляются навсегда.</Text>
        {entries.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Icon name="trash" size={46} color={t.sub} />
            <Text style={{ color: t.sub, fontSize: 16, marginTop: 12 }}>Здесь пусто</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: t.card, borderRadius: 12, marginHorizontal: 16, overflow: 'hidden' }}>
            {entries.map((e, i) => {
              const on = sel.includes(e.key);
              const last = i === entries.length - 1;
              const chat = e.kind === 'chat' ? chats[e.id] : chats[notes[e.id].chatId];
              const note = e.kind === 'note' ? notes[e.id] : undefined;
              return (
                <Pressable
                  key={e.key}
                  onPress={() => {
                    if (selecting) {
                      haptic.select();
                      setSel((s) => (on ? s.filter((x) => x !== e.key) : [...s, e.key]));
                    } else {
                      showActions(undefined, [
                        { label: 'Восстановить', onPress: () => restore([e.key]) },
                        { label: 'Удалить навсегда', destructive: true, onPress: () => destroy([e.key]) },
                      ]);
                    }
                  }}
                  style={({ pressed }) => ({ backgroundColor: pressed ? t.line : 'transparent' })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }}>
                    {selecting ? <Icon name={on ? 'checkCircle' : 'circle'} size={22} color={on ? t.accent : t.chevron} style={{ marginRight: 10 }} /> : null}
                    {e.kind === 'chat' && chat ? (
                      <View style={{ marginRight: 10 }}>
                        <Avatar chat={chat} size={34} />
                      </View>
                    ) : null}
                    <View style={{ flex: 1, paddingVertical: 10, paddingRight: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
                      <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: e.kind === 'chat' ? '600' : '400' }}>
                        {e.kind === 'chat' ? `Чат «${chat?.title}»` : notePreview(note!) || 'Заметка'}
                      </Text>
                      <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>
                        {e.kind === 'chat' ? notesCount(chatNotes(store.get(), e.id).length) : `из «${chat?.title}»`} · осталось {daysLeft(e.at)} дн.
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      {entries.length ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: t.bar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }}>
          <HeaderButton title={selecting && sel.length ? `Восстановить (${sel.length})` : 'Восстановить все'} disabled={selecting && !sel.length} onPress={() => restore(target)} />
          <HeaderButton title={selecting && sel.length ? `Удалить (${sel.length})` : 'Удалить все'} color={t.danger} disabled={selecting && !sel.length} onPress={() => destroy(target)} />
        </View>
      ) : null}
    </View>
  );
}
