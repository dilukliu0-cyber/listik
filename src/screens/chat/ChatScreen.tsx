import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardController, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, { FadeIn, FadeInDown, FadeOutDown, ZoomIn, ZoomOut, LinearTransition, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveUri } from '../../files';
import { dayLabel, notesCount, sameDay } from '../../format';
import { haptic } from '../../haptics';
import { plainText } from '../../markup';
import type { ScreenProps } from '../../navigation/types';
import { toast } from '../../runtime';
import { stopPlayback } from '../../services/player';
import { actions, chatNotes, notePreview, noteSearchText, store, useStore, type Note } from '../../store';
import { useChatTheme } from '../../theme';
import Avatar from '../../ui/Avatar';
import EditTextModal from '../../ui/EditTextModal';
import Icon from '../../ui/Icon';
import { useBgTransition, wait } from '../../ui/motion';
import { confirmDeleteNotes, deleteNotesWithUndo } from '../../ui/dialogs';
import Wallpaper from '../../ui/Wallpaper';
import AttachSheet from './AttachSheet';
import Bubble from './Bubble';
import Composer from './composer';
import ContextMenu, { type MenuItem } from './ContextMenu';

type Item = { k: 'n'; note: Note } | { k: 'd'; key: string; t: number };

// соседние пузыри плавно сдвигаются, когда заметка добавляется или удаляется
const cellLayout = LinearTransition.springify().damping(24).stiffness(260).mass(0.9);

export default function ChatScreen({ route, navigation }: ScreenProps<'Chat'>) {
  const { chatId } = route.params;
  const insets = useSafeAreaInsets();
  const chat = useStore((s) => s.chats[chatId]);
  // палитра чата подстраивается под его обои
  const t = useChatTheme(chat?.wallpaper);
  const barBg = useBgTransition(t.chatBar);
  const notes = useStore((s) => chatNotes(s, chatId));
  const globalWp = useStore((s) => s.settings.wallpaper);
  const fontSize = useStore((s) => s.settings.fontSize);

  const listRef = useRef<FlatList<Item>>(null);
  // черновик: восстанавливается при открытии чата и сохраняется, пока пишешь
  const [text, setText] = useState(() => store.get().chats[chatId]?.draft?.text ?? '');
  const textRef = useRef(text);
  textRef.current = text;
  const beforeEdit = useRef<string | null>(null); // текст поля до начала правки заметки
  const [replyTo, setReplyTo] = useState<Note | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [menuNote, setMenuNote] = useState<Note | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [attach, setAttach] = useState(false);
  const [pinIdx, setPinIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [hitIdx, setHitIdx] = useState(0);
  const [transcriptNote, setTranscriptNote] = useState<Note | null>(null);
  const [showDown, setShowDown] = useState(false);
  const [removing, setRemoving] = useState<string[]>([]);

  // удаление: пузырь схлопывается, затем заметка уходит в «Недавно удалённые», соседи съезжаются
  // сначала подтверждение снизу, после удаления — тост «Отменить»
  const removeNotes = useCallback((ids: string[], after?: () => void) => {
    confirmDeleteNotes(ids, () => {
      after?.();
      setRemoving(ids);
      setTimeout(() => {
        deleteNotesWithUndo(ids);
        setRemoving([]);
      }, 210);
    });
  }, []);

  useEffect(() => () => stopPlayback(), []);

  useEffect(() => {
    if (editing) return; // текст правки — не черновик
    const id = setTimeout(() => actions.setDraft(chatId, text), 500);
    return () => clearTimeout(id);
  }, [text, editing, chatId]);
  useEffect(
    () => () => {
      if (beforeEdit.current === null) actions.setDraft(chatId, textRef.current);
      else actions.setDraft(chatId, beforeEdit.current);
    },
    [chatId],
  );

  // Поле ввода едет вместе с клавиатурой кадр в кадр (UI-поток), без KeyboardAvoidingView-рывков.
  // Нижний отступ под «чёлку» внутри панели ввода уже есть — его вычитаем, чтобы не было щели.
  const kb = useReanimatedKeyboardAnimation();
  const bottomPad = Math.max(insets.bottom, 8) - 8;
  const kbSpacer = useAnimatedStyle(() => ({ height: Math.max(0, -kb.height.value - bottomPad) }));


  const openAttach = useCallback(async () => {
    // сначала дожидаемся, пока клавиатура уедет, потом открываем шторку — иначе поле ввода
    // проезжает сквозь шторку и текст на мгновение рисуется поверх камеры
    if (KeyboardController.isVisible()) await Promise.race([KeyboardController.dismiss(), wait(450)]);
    else Keyboard.dismiss();
    setAttach(true);
  }, []);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      out.push({ k: 'n', note: n });
      const prev = notes[i - 1];
      if (!prev || !sameDay(prev.createdAt, n.createdAt)) out.push({ k: 'd', key: 'd' + n.id, t: n.createdAt });
    }
    return out;
  }, [notes]);

  const pins = useMemo(() => notes.filter((n) => n.pinnedAt), [notes]);
  useEffect(() => {
    setPinIdx(Math.max(0, pins.length - 1)); // по умолчанию — самый новый закреп
  }, [pins.length]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return notes.filter((n) => noteSearchText(n).includes(q)).reverse();
  }, [query, notes]);

  const jump = useCallback(
    (id: string) => {
      const index = items.findIndex((it) => it.k === 'n' && it.note.id === id);
      if (index < 0) {
        toast('Заметка не найдена');
        return;
      }
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlight(id);
      setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1600);
    },
    [items],
  );

  // Переход к заметке / поиск из других экранов
  useEffect(() => {
    const { jumpTo, search } = route.params;
    if (jumpTo) {
      setTimeout(() => jump(jumpTo), 350);
      navigation.setParams({ jumpTo: undefined });
    }
    if (search) {
      setSearching(true);
      navigation.setParams({ search: undefined });
    }
  }, [route.params, jump, navigation]);

  useEffect(() => {
    if (hits.length && hits[hitIdx]) jump(hits[hitIdx].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitIdx, hits.length, query]);

  const onPress = useCallback(
    (n: Note) => {
      if (!selecting) {
        Keyboard.dismiss(); // как в Telegram: тап по ленте прячет клавиатуру
        return;
      }
      haptic.select();
      setSelected((s) => (s.includes(n.id) ? s.filter((x) => x !== n.id) : [...s, n.id]));
    },
    [selecting],
  );
  const onLongPress = useCallback(
    (n: Note) => {
      if (selecting) return;
      Keyboard.dismiss();
      setMenuNote(n);
    },
    [selecting],
  );
  const onReply = useCallback((n: Note) => {
    setEditing(null);
    setReplyTo(n);
  }, []);
  const onOpenPhoto = useCallback(
    (n: Note) => {
      const photos = notes.filter((x) => x.kind === 'photo');
      navigation.navigate('PhotoViewer', { ids: photos.map((p) => p.id), index: Math.max(0, photos.findIndex((p) => p.id === n.id)) });
    },
    [notes, navigation],
  );
  const onOpenFile = useCallback(async (n: Note) => {
    if (!n.file) return;
    const uri = resolveUri(n.file.uri);
    if (Platform.OS === 'web') {
      Linking.openURL(uri).catch(() => {});
      return;
    }
    if (await Sharing.isAvailableAsync()) Sharing.shareAsync(uri, { mimeType: n.file.mime, dialogTitle: n.file.name }).catch(() => {});
  }, []);
  const onEditTranscript = useCallback((n: Note) => setTranscriptNote(n), []);

  if (!chat) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.sub }}>Чат удалён</Text>
      </View>
    );
  }

  const menuItems = (n: Note): MenuItem[] => {
    const copyText = n.kind === 'voice' ? (n.voice?.transcript ?? '') : n.kind === 'list' ? [n.text, ...(n.items ?? []).map((i) => (i.done ? '☑ ' : '☐ ') + i.text)].filter(Boolean).join('\n') : plainText(n.text);
    const canEdit = n.kind === 'text' || n.kind === 'photo' || n.kind === 'file' || n.kind === 'list' || (n.kind === 'voice' && n.voice?.transcript !== undefined);
    const list: MenuItem[] = [
      { label: 'Ответить', icon: 'reply', onPress: () => onReply(n) },
      {
        label: n.pinnedAt ? 'Открепить' : 'Закрепить',
        icon: n.pinnedAt ? 'unpin' : 'pinLine',
        onPress: () => {
          haptic.medium();
          actions.pinNote(n.id, !n.pinnedAt);
        },
      },
    ];
    if (canEdit)
      list.push({
        label: 'Изменить',
        icon: 'pencil',
        onPress: () => {
          if (n.kind === 'list') navigation.navigate('ListEditor', { chatId, noteId: n.id });
          else if (n.kind === 'voice') setTranscriptNote(n);
          else {
            if (beforeEdit.current === null) beforeEdit.current = text;
            setReplyTo(null);
            setEditing(n);
            setText(n.text);
          }
        },
      });
    if (copyText)
      list.push({
        label: 'Копировать',
        icon: 'copy',
        onPress: () => {
          Clipboard.setStringAsync(copyText).catch(() => {});
          haptic.light();
          toast('Скопировано');
        },
      });
    list.push(
      { label: 'Переслать', icon: 'forward', onPress: () => navigation.navigate('Forward', { noteIds: [n.id] }) },
      {
        label: 'Выбрать',
        icon: 'select',
        onPress: () => {
          setSelecting(true);
          setSelected([n.id]);
        },
      },
      {
        label: 'Удалить',
        icon: 'trash',
        destructive: true,
        onPress: () => {
          removeNotes([n.id], () => {
            if (replyTo?.id === n.id) setReplyTo(null);
            if (editing?.id === n.id) {
              setText(beforeEdit.current ?? '');
              beforeEdit.current = null;
              setEditing(null);
            }
          });
        },
      },
    );
    return list;
  };

  const wallpaper = chat.wallpaper ?? globalWp;
  const pin = pins[pinIdx];
  const barBorder = { borderBottomWidth: 0.5, borderBottomColor: t.dark ? '#0B121A' : '#DDDDDD' };

  const exitSelect = () => {
    setSelecting(false);
    setSelected([]);
  };

  return (
    <Reanimated.View style={[{ flex: 1 }, barBg]}>
      {/* Шапка */}
      <Reanimated.View style={[{ paddingTop: insets.top }, barBg, pins.length && !searching && !selecting ? null : barBorder]}>
        {selecting ? (
          <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <Pressable onPress={exitSelect} hitSlop={10} style={{ flex: 1 }}>
              <Text style={{ color: t.accent, fontSize: 17 }}>Отмена</Text>
            </Pressable>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>Выбрано: {selected.length}</Text>
            <View style={{ flex: 1 }} />
          </View>
        ) : searching ? (
          <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: t.dark ? t.field : '#E9E9EB', borderRadius: 10, height: 36, paddingHorizontal: 8 }}>
              <Icon name="search" size={16} color={t.sub} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={(q) => {
                  setQuery(q);
                  setHitIdx(0);
                }}
                placeholder={`Поиск в «${chat.title}»`}
                placeholderTextColor={t.sub}
                style={{ flex: 1, color: t.text, fontSize: 17, marginLeft: 6, paddingVertical: 0 }}
                returnKeyType="search"
              />
            </View>
            <Pressable
              onPress={() => {
                setSearching(false);
                setQuery('');
                Keyboard.dismiss();
              }}
              hitSlop={10}
              style={{ marginLeft: 12 }}
            >
              <Text style={{ color: t.accent, fontSize: 17 }}>Отмена</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', width: 90 }}>
              <Icon name="back" size={22} color={t.accent} />
              <Text style={{ color: t.accent, fontSize: 17, marginLeft: 2 }}>Чаты</Text>
            </Pressable>
            <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => navigation.navigate('ChatProfile', { chatId })}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{chat.title}</Text>
              <Text style={{ color: t.chatSub, fontSize: 13 }}>{notesCount(notes.length)}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('ChatProfile', { chatId })} style={{ width: 90, alignItems: 'flex-end', paddingRight: 4 }}>
              <Avatar chat={chat} size={38} />
            </Pressable>
          </View>
        )}
      </Reanimated.View>

      {/* Плашка закрепа */}
      {pin && !searching && !selecting ? (
        <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderTopWidth: 0.5, borderTopColor: t.dark ? '#0B121A' : '#E5E5EA' }, barBg, barBorder]}>
          <Pressable
            style={{ flex: 1, flexDirection: 'row', paddingVertical: 7 }}
            onPress={() => {
              haptic.select();
              jump(pin.id);
              setPinIdx((i) => (i - 1 + pins.length) % pins.length);
            }}
          >
            <View style={{ flexDirection: 'column', gap: 2, marginRight: 8, justifyContent: 'center' }}>
              {pins.length > 1 ? (
                pins.slice(-4).map((p) => <View key={p.id} style={{ width: 2, flex: 1, borderRadius: 1, backgroundColor: p.id === pin.id ? t.accent : t.dark ? '#2E4A66' : '#BFDBF7' }} />)
              ) : (
                <View style={{ width: 2, flex: 1, borderRadius: 1, backgroundColor: t.accent }} />
              )}
            </View>
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>
                Закреплённое{pins.length > 1 ? ` #${pinIdx + 1}` : ''}
              </Text>
              {/* текст закрепа плавно сменяется при листании */}
              <Reanimated.Text key={pin.id} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(160)} numberOfLines={1} style={{ color: t.text, fontSize: 14 }}>
                {notePreview(pin)}
              </Reanimated.Text>
            </View>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('PinnedList', { chatId })} hitSlop={8} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <Icon name="list" size={20} color={t.chatSub} />
          </Pressable>
        </Reanimated.View>
      ) : null}

      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* при смене обоев новые мягко проявляются поверх старых */}
          <Reanimated.View key={JSON.stringify(wallpaper)} entering={FadeIn.duration(320)} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Wallpaper wallpaper={wallpaper} dark={t.dark} />
          </Reanimated.View>
          {notes.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
              <View style={{ backgroundColor: t.datePill, borderRadius: 16, padding: 16, maxWidth: 260 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' }}>Здесь пока пусто</Text>
                <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 4 }}>Напишите первую заметку, прикрепите фото или удерживайте микрофон.</Text>
              </View>
            </View>
          ) : (
            <Reanimated.FlatList
              ref={listRef}
              data={items}
              inverted
              itemLayoutAnimation={cellLayout}
              keyExtractor={(it) => (it.k === 'n' ? it.note.id : it.key)}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 8 }}
              onScroll={(e) => setShowDown(e.nativeEvent.contentOffset.y > 500)}
              scrollEventThrottle={100}
              onScrollToIndexFailed={(info) => {
                listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
                setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 120);
              }}
              renderItem={({ item }) =>
                item.k === 'd' ? (
                  <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <View style={{ backgroundColor: t.datePill, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>{dayLabel(item.t)}</Text>
                    </View>
                  </View>
                ) : (
                  <Bubble
                    note={item.note}
                    t={t}
                    fontSize={fontSize}
                    selecting={selecting}
                    selected={selected.includes(item.note.id)}
                    highlighted={highlight === item.note.id}
                    removing={removing.includes(item.note.id)}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    onReply={onReply}
                    onJump={jump}
                    onOpenPhoto={onOpenPhoto}
                    onOpenFile={onOpenFile}
                    onEditTranscript={onEditTranscript}
                  />
                )
              }
            />
          )}
          {showDown ? (
            <Reanimated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(150)} style={{ position: 'absolute', right: 12, bottom: 12 }}>
            <Pressable
              onPress={() => {
                haptic.light();
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.chatBar, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}
            >
              <Icon name="chevronDown" size={20} color={t.chatSub} />
            </Pressable>
            </Reanimated.View>
          ) : null}
        </View>

        {selecting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: t.chatBar }}>
            <Pressable
              disabled={!selected.length}
              onPress={() => removeNotes(selected, exitSelect)}
            >
              <Icon name="trash" size={24} color={selected.length ? t.danger : t.sub} />
            </Pressable>
            <Text style={{ color: t.text, fontSize: 15 }}>{selected.length ? `Выбрано: ${selected.length}` : 'Выберите заметки'}</Text>
            <Pressable
              disabled={!selected.length}
              onPress={() => {
                navigation.navigate('Forward', { noteIds: selected });
                exitSelect();
              }}
            >
              <Icon name="forward" size={24} color={selected.length ? t.accent : t.sub} />
            </Pressable>
          </View>
        ) : searching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: t.chatBar }}>
            <Text style={{ flex: 1, color: t.text, fontSize: 15 }}>
              {query.trim() ? (hits.length ? `${hitIdx + 1} из ${hits.length}` : 'Ничего не найдено') : 'Введите текст для поиска'}
            </Text>
            <Pressable disabled={hitIdx >= hits.length - 1} onPress={() => setHitIdx((i) => i + 1)} hitSlop={8} style={{ marginRight: 20 }}>
              <Icon name="chevronUp" size={22} color={hitIdx < hits.length - 1 ? t.accent : t.sub} />
            </Pressable>
            <Pressable disabled={hitIdx <= 0} onPress={() => setHitIdx((i) => i - 1)} hitSlop={8}>
              <Icon name="chevronDown" size={22} color={hitIdx > 0 ? t.accent : t.sub} />
            </Pressable>
          </View>
        ) : (
          <Composer
            t={t}
            chatId={chatId}
            replyTo={replyTo}
            editing={editing}
            text={text}
            setText={setText}
            onCancelContext={() => {
              setReplyTo(null);
              if (editing) {
                // правка закончена — в поле возвращается то, что было написано до неё
                setText(beforeEdit.current ?? '');
                beforeEdit.current = null;
              }
              setEditing(null);
            }}
            onAttach={openAttach}
            onFocus={() => {
              setAttach(false); // фокус на поле — шторка скрепки закрывается, как в Telegram
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
            }}
            onJump={jump}
            onSent={() => {
              setReplyTo(null);
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
            }}
          />
        )}
        <Reanimated.View style={kbSpacer} />
      </View>

      <AttachSheet
        t={t}
        visible={attach}
        onClose={() => setAttach(false)}
        chatId={chatId}
        replyTo={replyTo?.id}
        caption={text}
        onSent={() => {
          setText('');
          setReplyTo(null);
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }}
        onList={() => navigation.navigate('ListEditor', { chatId })}
      />

      <ContextMenu t={t} note={menuNote} items={menuNote ? menuItems(menuNote) : []} fontSize={fontSize} onClose={() => setMenuNote(null)} />

      <EditTextModal
        visible={!!transcriptNote}
        title="Расшифровка"
        initial={transcriptNote?.voice?.transcript ?? ''}
        onCancel={() => setTranscriptNote(null)}
        onDone={(txt) => {
          if (transcriptNote) actions.updateVoice(transcriptNote.id, { transcript: txt, status: 'done', expanded: true });
          setTranscriptNote(null);
        }}
      />
    </Reanimated.View>
  );
}
