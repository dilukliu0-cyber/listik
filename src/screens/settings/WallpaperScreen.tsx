import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { importFile, removeFiles } from '../../files';
import { haptic } from '../../haptics';
import type { ScreenProps } from '../../navigation/types';
import { actions, useStore, type Wallpaper as W } from '../../store';
import { SOLID_COLORS, WALLPAPERS, useTheme } from '../../theme';
import Icon from '../../ui/Icon';
import { Caption, CheckRow, Group, Row } from '../../ui/kit';
import Wallpaper from '../../ui/Wallpaper';

function same(a: W | undefined, b: W) {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'pattern' && b.kind === 'pattern') return a.index === b.index;
  if (a.kind === 'color' && b.kind === 'color') return a.color === b.color;
  if (a.kind === 'photo' && b.kind === 'photo') return a.uri === b.uri;
  return false;
}

export default function WallpaperScreen({ route }: ScreenProps<'Wallpaper'>) {
  const t = useTheme();
  const chatId = route.params?.chatId;
  const chat = useStore((s) => (chatId ? s.chats[chatId] : undefined));
  const global = useStore((s) => s.settings.wallpaper);
  const current = chatId ? chat?.wallpaper : global;
  const [colors, setColors] = useState(current?.kind === 'color');

  function apply(w: W | undefined) {
    haptic.select();
    const prev = chatId ? chat?.wallpaper : global;
    if (prev?.kind === 'photo' && !(w && same(prev, w))) removeFiles([prev.uri]);
    if (chatId) actions.updateChat(chatId, { wallpaper: w });
    else if (w) actions.setSettings({ wallpaper: w });
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 }).catch(() => null);
    if (r && !r.canceled && r.assets[0]) {
      const rel = await importFile(r.assets[0].uri, r.assets[0].uri, 'jpg');
      apply({ kind: 'photo', uri: rel });
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
      {chatId ? (
        <Group>
          <CheckRow title="Как в настройках" subtitle="Общие обои для всех чатов" checked={!current} onPress={() => apply(undefined)} last />
        </Group>
      ) : null}
      <Group>
        <Row icon="photoPlus" iconBg="#3390EC" title="Выбрать своё фото" chevron onPress={pickPhoto} right={current?.kind === 'photo' ? <Icon name="check" size={18} color={t.accent} /> : null} />
        <Row icon="swatch" iconBg="#8E6CEF" title="Однотонный цвет" chevron={!colors} last onPress={() => setColors(!colors)} right={current?.kind === 'color' ? <Icon name="check" size={18} color={t.accent} /> : null} />
        {colors ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 14, paddingTop: 4 }}>
            {SOLID_COLORS.map((c) => {
              const on = current?.kind === 'color' && current.color === c;
              return (
                <Pressable key={c} onPress={() => apply({ kind: 'color', color: c })} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: on ? 3 : 0.5, borderColor: on ? t.accent : t.line }} />
              );
            })}
          </View>
        ) : null}
      </Group>
      <Caption top>Узоры</Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 }}>
        {WALLPAPERS.map((p, i) => {
          const w: W = { kind: 'pattern', index: i };
          const on = same(current, w);
          const darkTile = i === 4 || i === 7;
          return (
            <Pressable key={i} onPress={() => apply(w)} style={{ width: '31%', aspectRatio: 0.6, borderRadius: 10, overflow: 'hidden', borderWidth: on ? 2.5 : 0, borderColor: t.accent }}>
              <Wallpaper wallpaper={w} dark={t.dark} />
              <View style={{ position: 'absolute', right: 8, bottom: 16, width: 44, height: 16, borderRadius: 8, backgroundColor: t.dark || darkTile ? '#2B5278' : '#EFFDDE' }} />
              <View style={{ position: 'absolute', right: 8, bottom: 38, width: 30, height: 16, borderRadius: 8, backgroundColor: t.dark || darkTile ? '#2B5278' : '#EFFDDE' }} />
              {on ? (
                <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={13} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32, marginTop: 12 }}>
        {chatId ? `Обои только для чата «${chat?.title ?? ''}».` : 'Для всех чатов. Свои обои для одного чата — в его профиле.'}
      </Text>
    </ScrollView>
  );
}
