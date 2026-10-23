import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { resolveUri } from '../files';
import { bytes, dateLong, dayAndTime, duration, monthKey, monthLabel, notesCount } from '../format';
import { haptic } from '../haptics';
import { openChatAt } from '../navigation/ref';
import type { ScreenProps } from '../navigation/types';
import { toast } from '../runtime';
import { actions, chatNotes, extractLinks, notePreview, useStore, type Note } from '../store';
import { useTheme, type Theme } from '../theme';
import Avatar from '../ui/Avatar';
import { confirm, showActions } from '../ui/dialogs';
import Icon, { type IconName } from '../ui/Icon';
import VoiceContent from './chat/VoiceContent';

type Tab = 'media' | 'links' | 'files' | 'voice' | 'pins';
const TABS: [Tab, string][] = [
  ['media', 'Медиа'],
  ['links', 'Ссылки'],
  ['files', 'Файлы'],
  ['voice', 'Голосовые'],
  ['pins', 'Закреп'],
];

export function PhotoGrid({ photos, t, onOpen, dotColor }: { photos: Note[]; t: Theme; onOpen: (n: Note) => void; dotColor?: (n: Note) => string | undefined }) {
  const { width } = useWindowDimensions();
  const size = (width - 4) / 3;
  const groups = useMemo(() => {
    const m = new Map<number, Note[]>();
    for (const p of [...photos].sort((a, b) => b.createdAt - a.createdAt)) {
      const k = monthKey(p.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return [...m.values()];
  }, [photos]);
  return (
    <View>
      {groups.map((g) => (
        <View key={monthKey(g[0].createdAt)}>
          <Text style={{ color: t.sub, fontSize: 13, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
            {monthLabel(g[0].createdAt)} · {g.length} фото
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
            {g.map((p) => {
              const dot = dotColor?.(p);
              return (
                <Pressable key={p.id} onPress={() => onOpen(p)}>
                  <Image source={{ uri: resolveUri(p.photo!.uri) }} style={{ width: size, height: size, backgroundColor: t.search }} />
                  {dot ? <View style={{ position: 'absolute', left: 6, bottom: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: dot, borderWidth: 1.5, borderColor: '#fff' }} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ChatProfileScreen({ route, navigation }: ScreenProps<'ChatProfile'>) {
  const { chatId } = route.params;
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const chat = useStore((s) => s.chats[chatId]);
  const notes = useStore((s) => chatNotes(s, chatId));
  const fontSize = useStore((s) => s.settings.fontSize);
  const [tab, setTab] = useState<Tab>('media');

  const photos = useMemo(() => notes.filter((n) => n.kind === 'photo'), [notes]);
  const links = useMemo(() => notes.flatMap((n) => extractLinks([n.text, n.voice?.transcript ?? ''].join(' ')).map((url) => ({ note: n, url }))).reverse(), [notes]);
  const files = useMemo(() => notes.filter((n) => n.kind === 'file').reverse(), [notes]);
  const voices = useMemo(() => notes.filter((n) => n.kind === 'voice').reverse(), [notes]);
  const pins = useMemo(() => notes.filter((n) => n.pinnedAt).reverse(), [notes]);

  if (!chat) return <View style={{ flex: 1, backgroundColor: t.group }} />;

  const goChat = (noteId?: string, search?: boolean) => openChatAt(chatId, noteId, search);

  const button = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, backgroundColor: t.card, borderRadius: 12, paddingVertical: 9, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={22} color={t.accent} />
      <Text style={{ color: t.accent, fontSize: 12, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );

  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line };
  const empty = (text: string) => <Text style={{ color: t.sub, textAlign: 'center', paddingVertical: 40, fontSize: 15 }}>{text}</Text>;

  let content;
  if (tab === 'media') {
    content = photos.length ? (
      <PhotoGrid photos={photos} t={t} onOpen={(p) => {
        const list = [...photos].sort((a, b) => a.createdAt - b.createdAt);
        navigation.navigate('PhotoViewer', { ids: list.map((x) => x.id), index: list.findIndex((x) => x.id === p.id) });
      }} />
    ) : empty('Здесь появятся фото из этого чата');
  } else if (tab === 'links') {
    content = links.length
      ? links.map(({ note, url }, i) => (
          <Pressable key={note.id + i} onPress={() => Linking.openURL(/^https?:/i.test(url) ? url : 'https://' + url).catch(() => {})} onLongPress={() => goChat(note.id)} style={rowStyle}>
            <View style={{ width: 44, height: 44, borderRadius: 9, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Icon name="link" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{notePreview(note).replace(url, '').trim() || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</Text>
              <Text numberOfLines={1} style={{ color: t.accent, fontSize: 14, marginTop: 2 }}>{url}</Text>
            </View>
          </Pressable>
        ))
      : empty('Ссылки из заметок появятся здесь');
  } else if (tab === 'files') {
    content = files.length
      ? files.map((n) => (
          <Pressable
            key={n.id}
            onPress={async () => {
              if (await Sharing.isAvailableAsync()) Sharing.shareAsync(resolveUri(n.file!.uri)).catch(() => {});
              else toast('Открыть файл можно в приложении на iPhone');
            }}
            onLongPress={() => goChat(n.id)}
            style={rowStyle}
          >
            <View style={{ width: 44, height: 44, borderRadius: 9, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Icon name="file" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{n.file!.name}</Text>
              <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>{bytes(n.file!.size)} · {dayAndTime(n.createdAt)}</Text>
            </View>
          </Pressable>
        ))
      : empty('Файлы из заметок появятся здесь');
  } else if (tab === 'voice') {
    content = voices.length
      ? voices.map((n) => (
          <Pressable key={n.id} onLongPress={() => goChat(n.id)} style={[rowStyle, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>{dayAndTime(n.createdAt)}</Text>
            <VoiceContent note={n} t={t} accent={t.dark ? '#7EC8F7' : '#4FAE4E'} sub={t.sub} textColor={t.text} fontSize={fontSize - 1} compact />
          </Pressable>
        ))
      : empty('Голосовые появятся здесь');
  } else {
    content = pins.length
      ? pins.map((n) => (
          <Pressable key={n.id} onPress={() => goChat(n.id)} style={rowStyle}>
            <Icon name="pin" size={18} color={t.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ color: t.text, fontSize: 16 }}>{notePreview(n)}</Text>
              <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>{dayAndTime(n.createdAt)}</Text>
            </View>
          </Pressable>
        ))
      : empty('Закреплённых заметок нет');
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.group }}>
      <View style={{ paddingTop: insets.top, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, height: 44 + insets.top }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="back" size={24} color={t.accent} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('EditChat', { chatId })} hitSlop={10}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Изм.</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={{ alignItems: 'center', paddingBottom: 16 }}>
          <Avatar chat={chat} size={96} />
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '600', marginTop: 10 }}>{chat.title}</Text>
          <Text style={{ color: t.sub, fontSize: 15, marginTop: 2 }}>
            {notesCount(notes.length)} · с {dateLong(chat.createdAt)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
          {button('search', 'поиск', () => goChat(undefined, true))}
          {button('photo', 'обои', () => navigation.navigate('Wallpaper', { chatId }))}
          {button(chat.archived ? 'unarchive' : 'archiveLine', chat.archived ? 'из архива' : 'в архив', () => {
            haptic.light();
            actions.archiveChat(chatId, !chat.archived);
            toast(chat.archived ? 'Чат возвращён из архива' : 'Чат в архиве');
          })}
          {button('more', 'ещё', () =>
            showActions(undefined, [
              {
                label: chat.pinnedAt ? 'Открепить чат' : 'Закрепить чат',
                onPress: () => {
                  haptic.medium();
                  actions.pinChat(chatId, !chat.pinnedAt);
                },
              },
              {
                label: 'Очистить историю',
                destructive: true,
                onPress: () =>
                  confirm('Очистить историю?', 'Все заметки чата попадут в «Недавно удалённые» на 30 дней.', 'Очистить', () => {
                    actions.clearChat(chatId);
                    haptic.warning();
                  }),
              },
              {
                label: 'Удалить чат',
                destructive: true,
                onPress: () =>
                  confirm('Удалить чат?', 'Чат попадёт в «Недавно удалённые» на 30 дней, потом удалится навсегда.', 'Удалить', () => {
                    actions.deleteChat(chatId);
                    haptic.warning();
                    navigation.popToTop();
                  }),
              },
            ]),
          )}
        </View>

        <View style={{ marginTop: 14, backgroundColor: t.card, minHeight: 300 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }} contentContainerStyle={{ paddingHorizontal: 8 }}>
            {TABS.map(([k, label]) => (
              <Pressable
                key={k}
                onPress={() => {
                  haptic.select();
                  setTab(k);
                }}
                style={{ paddingHorizontal: 10, paddingTop: 12 }}
              >
                <Text style={{ color: tab === k ? t.accent : t.sub, fontSize: 15, fontWeight: tab === k ? '600' : '400', paddingBottom: 9 }}>{label}</Text>
                <View style={{ height: 3, borderRadius: 1.5, backgroundColor: tab === k ? t.accent : 'transparent' }} />
              </Pressable>
            ))}
          </ScrollView>
          {content}
        </View>
      </ScrollView>
    </View>
  );
}
