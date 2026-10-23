import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { importFile, removeFiles } from '../files';
import { haptic } from '../haptics';
import type { ScreenProps } from '../navigation/types';
import { actions, useStore, type ChatIcon } from '../store';
import { TEMPLATES } from '../templates';
import { CHAT_COLORS, useTheme } from '../theme';
import Avatar from '../ui/Avatar';
import { showActions } from '../ui/dialogs';
import Icon, { CHAT_ICONS } from '../ui/Icon';
import { HeaderButton } from '../ui/kit';

export default function EditChatScreen({ route, navigation }: ScreenProps<'EditChat'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const chatId = route.params?.chatId;
  const existing = useStore((s) => (chatId ? s.chats[chatId] : undefined));
  const tpl = route.params?.template ? TEMPLATES[route.params.template] : undefined;
  const [title, setTitle] = useState(existing?.title ?? tpl?.title ?? '');
  const [color, setColor] = useState(existing?.color ?? tpl?.color ?? CHAT_COLORS[5]);
  const [icon, setIcon] = useState<ChatIcon>(existing?.icon ?? tpl?.icon ?? 'book');
  const [photo, setPhoto] = useState<string | undefined>(existing?.photo);

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }).catch(() => null);
    if (r && !r.canceled && r.assets[0]) {
      const rel = await importFile(r.assets[0].uri, r.assets[0].uri, 'jpg');
      setPhoto(rel);
    }
  }

  function save() {
    const name = title.trim();
    if (!name) return;
    haptic.success();
    if (existing) {
      if (existing.photo && existing.photo !== photo) removeFiles([existing.photo]);
      actions.updateChat(existing.id, { title: name, color, icon, photo });
      navigation.goBack();
    } else {
      const id = actions.createChat({ title: name, color, icon, photo });
      navigation.goBack();
      setTimeout(() => navigation.navigate('Chat', { chatId: id }), 50);
    }
  }

  const label = (s: string) => <Text style={{ color: t.sub, fontSize: 13, marginBottom: 10 }}>{s}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: t.group }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56}}>
        <View style={{ flex: 1 }}>
          <HeaderButton title="Отмена" onPress={() => navigation.goBack()} />
        </View>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{existing ? 'Изменить' : 'Новый чат'}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <HeaderButton title={existing ? 'Готово' : 'Создать'} bold disabled={!title.trim()} onPress={save} />
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Pressable onPress={pickPhoto}>
            <Avatar chat={{ color, icon, photo }} size={96} />
          </Pressable>
          <Pressable
            onPress={() =>
              photo
                ? showActions(undefined, [
                    { label: 'Выбрать другое фото', onPress: pickPhoto },
                    { label: 'Убрать фото', destructive: true, onPress: () => setPhoto(undefined) },
                  ])
                : pickPhoto()
            }
            hitSlop={8}
          >
            <Text style={{ color: t.accent, fontSize: 15, marginTop: 8 }}>{photo ? 'Изменить фото' : 'Выбрать фото'}</Text>
          </Pressable>
        </View>
        <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 14 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Название"
            placeholderTextColor={t.sub}
            autoFocus={!existing}
            maxLength={64}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{ color: t.text, fontSize: 17, height: 46 }}
          />
        </View>
        <View style={{ marginHorizontal: 16, marginTop: 18, backgroundColor: t.card, borderRadius: 12, padding: 14 }}>
          {label('ЦВЕТ')}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {CHAT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  haptic.select();
                  setColor(c);
                }}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c === color ? c : 'transparent' }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c }} />
              </Pressable>
            ))}
          </View>
          <View style={{ height: 20 }} />
          {label('ЗНАЧОК')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {CHAT_ICONS.map((ic) => {
              const on = ic === icon && !photo;
              return (
                <Pressable
                  key={ic}
                  onPress={() => {
                    haptic.select();
                    setIcon(ic);
                    setPhoto(undefined);
                  }}
                  style={{ width: '15%', aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color + '26' : 'transparent' }}
                >
                  <Icon name={ic} size={26} color={on ? color : t.sub} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
