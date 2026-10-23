import { useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { haptic } from '../haptics';
import type { ScreenProps } from '../navigation/types';
import { actions, store, uid, type ListItem } from '../store';
import { useTheme } from '../theme';
import Icon from '../ui/Icon';
import { HeaderButton } from '../ui/kit';

/** Создание и правка заметки-списка с галочками */
export default function ListEditorScreen({ route, navigation }: ScreenProps<'ListEditor'>) {
  const t = useTheme();
  const { chatId, noteId } = route.params;
  const existing = noteId ? store.get().notes[noteId] : undefined;
  const [title, setTitle] = useState(existing?.text ?? '');
  const [items, setItems] = useState<ListItem[]>(existing?.items?.length ? existing.items : [{ id: uid(), text: '', done: false }]);
  const refs = useRef<Record<string, TextInput | null>>({});
  const focusNext = useRef<string | null>(null);

  const clean = items.filter((i) => i.text.trim());

  const save = () => {
    if (!clean.length) return;
    const list = clean.map((i) => ({ ...i, text: i.text.trim() }));
    if (existing) actions.updateNote(existing.id, { text: title.trim(), items: list, editedAt: Date.now() });
    else actions.addNote({ chatId, kind: 'list', text: title.trim(), items: list });
    haptic.light();
    navigation.goBack();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Изменить список' : 'Список',
      headerLeft: () => <HeaderButton title="Отмена" onPress={() => navigation.goBack()} />,
      headerRight: () => <HeaderButton title={existing ? 'Готово' : 'Отправить'} bold disabled={!clean.length} onPress={save} />,
    });
  });

  const update = (id: string, patch: Partial<ListItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.group }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 }}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Название (необязательно)" placeholderTextColor={t.sub} style={{ color: t.text, fontSize: 17, fontWeight: '600', height: 46 }} />
        </View>
        <View style={{ backgroundColor: t.card, borderRadius: 12, overflow: 'hidden' }}>
          {items.map((it, i) => (
            <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
              <Pressable hitSlop={6} onPress={() => update(it.id, { done: !it.done })}>
                <Icon name={it.done ? 'squareCheck' : 'square'} size={22} color={it.done ? t.outAccent : t.sub} />
              </Pressable>
              <TextInput
                ref={(r) => {
                  refs.current[it.id] = r;
                  if (r && focusNext.current === it.id) {
                    focusNext.current = null;
                    r.focus();
                  }
                }}
                value={it.text}
                onChangeText={(s) => update(it.id, { text: s })}
                placeholder={`Пункт ${i + 1}`}
                placeholderTextColor={t.sub}
                autoFocus={!existing && i === 0}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  const id = uid();
                  focusNext.current = id;
                  setItems((list) => {
                    const idx = list.findIndex((x) => x.id === it.id);
                    const next = [...list];
                    next.splice(idx + 1, 0, { id, text: '', done: false });
                    return next;
                  });
                }}
                style={{ flex: 1, color: t.text, fontSize: 17, height: 46, marginLeft: 10 }}
              />
              {items.length > 1 ? (
                <Pressable hitSlop={8} onPress={() => setItems((list) => list.filter((x) => x.id !== it.id))} style={{ paddingHorizontal: 12 }}>
                  <Icon name="closeCircle" size={18} color={t.chevron} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            onPress={() => {
              const id = uid();
              focusNext.current = id;
              setItems((list) => [...list, { id, text: '', done: false }]);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 46 }}
          >
            <Icon name="plusCircle" size={22} color={t.accent} />
            <Text style={{ color: t.accent, fontSize: 17, marginLeft: 10 }}>Добавить пункт</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
