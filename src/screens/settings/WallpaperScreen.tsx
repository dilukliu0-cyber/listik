import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { importFile, removeFiles } from '../../files';
import { haptic } from '../../haptics';
import type { ScreenProps } from '../../navigation/types';
import { imageTint } from '../../services/imageTint';
import { actions, useStore, type Wallpaper as W } from '../../store';
import { SOLID_COLORS, WALLPAPERS, chatTheme, isDarkColor, useTheme, type Theme } from '../../theme';
import Icon from '../../ui/Icon';
import { Caption, CheckRow, Group, Row } from '../../ui/kit';
import { useBgTransition } from '../../ui/motion';
import Wallpaper from '../../ui/Wallpaper';

function same(a: W | undefined, b: W) {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'pattern' && b.kind === 'pattern') return a.index === b.index;
  if (a.kind === 'color' && b.kind === 'color') return a.color === b.color;
  if (a.kind === 'photo' && b.kind === 'photo') return a.uri === b.uri;
  return false;
}

/** Синий кружок с галочкой у выбранного варианта */
function Badge({ t, size = 22 }: { t: Theme; size?: number }) {
  return (
    <Reanimated.View entering={FadeIn.duration(160)} style={{ position: 'absolute', top: 6, right: 6, width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' }}>
      <Icon name="check" size={size * 0.55} color="#fff" />
    </Reanimated.View>
  );
}

function PreviewBubble({ pt, text, time, reply }: { pt: Theme; text: string; time: string; reply?: boolean }) {
  const bg = useBgTransition(pt.out);
  return (
    <Reanimated.View style={[{ alignSelf: 'flex-end', maxWidth: '78%', borderRadius: 16, borderBottomRightRadius: 5, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 }, bg]}>
      {reply ? (
        <View style={{ flexDirection: 'row', marginBottom: 4, borderRadius: 5, overflow: 'hidden', backgroundColor: pt.outAccent + '1F' }}>
          <View style={{ width: 3, backgroundColor: pt.outAccent }} />
          <View style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: pt.outAccent, fontWeight: '600', fontSize: 13 }}>Ответ</Text>
            <Text numberOfLines={1} style={{ color: pt.outText, fontSize: 13 }}>Купить муку и молоко</Text>
          </View>
        </View>
      ) : null}
      <Text style={{ color: pt.outText, fontSize: 15 }}>
        {text}
        <Text style={{ color: 'transparent', fontSize: 11 }}>{'    ' + time}</Text>
      </Text>
      <Text style={{ position: 'absolute', right: 10, bottom: 5, color: pt.outSub, fontSize: 11 }}>{time}</Text>
    </Reanimated.View>
  );
}

/** Живое превью чата с выбранными обоями и палитрой */
function Preview({ t, wallpaper }: { t: Theme; wallpaper: W }) {
  const pt = chatTheme(t, wallpaper);
  const bar = useBgTransition(pt.chatBar);
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 22, height: 250, borderRadius: 12, overflow: 'hidden', backgroundColor: t.card }}>
      <Reanimated.View style={[{ height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: t.line }, bar]}>
        <Icon name="back" size={16} color={pt.accent} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: pt.text, fontSize: 13, fontWeight: '600' }}>Покупки</Text>
          <Text style={{ color: pt.chatSub, fontSize: 10 }}>3 заметки</Text>
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#4FAE4E' }} />
      </Reanimated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 8 }}>
        <Reanimated.View key={JSON.stringify(wallpaper)} entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
          <Wallpaper wallpaper={wallpaper} dark={t.dark} />
        </Reanimated.View>
        <View style={{ alignSelf: 'center', backgroundColor: pt.datePill, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>Сегодня</Text>
        </View>
        <PreviewBubble pt={pt} text="Купить муку и молоко" time="10:24" />
        <PreviewBubble pt={pt} text="И ещё яйца, десяток" time="10:25" reply />
      </View>
      <Reanimated.View style={[{ height: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6, borderTopWidth: 0.5, borderTopColor: t.line }, bar]}>
        <Icon name="paperclip" size={18} color={pt.sub} />
        <View style={{ flex: 1, height: 26, borderRadius: 13, backgroundColor: pt.field, justifyContent: 'center', paddingHorizontal: 10 }}>
          <Text style={{ color: pt.sub, fontSize: 13 }}>Заметка</Text>
        </View>
        <Icon name="mic" size={19} color={pt.accent} />
      </Reanimated.View>
    </View>
  );
}

export default function WallpaperScreen({ route }: ScreenProps<'Wallpaper'>) {
  const t = useTheme();
  const chatId = route.params?.chatId;
  const chat = useStore((s) => (chatId ? s.chats[chatId] : undefined));
  const global = useStore((s) => s.settings.wallpaper);
  const current = chatId ? chat?.wallpaper : global;
  const effective = current ?? global;
  const [colors, setColors] = useState(current?.kind === 'color');

  function apply(w: W | undefined) {
    const prev = chatId ? chat?.wallpaper : global;
    if (w && prev && same(prev, w) && prev.kind !== 'photo') return;
    haptic.select();
    if (prev?.kind === 'photo' && !(w && same(prev, w))) removeFiles([prev.uri]);
    if (chatId) actions.updateChat(chatId, { wallpaper: w });
    else if (w) actions.setSettings({ wallpaper: w });
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 }).catch(() => null);
    if (r && !r.canceled && r.assets[0]) {
      const rel = await importFile(r.assets[0].uri, r.assets[0].uri, 'jpg');
      const tint = await imageTint(rel);
      apply({ kind: 'photo', uri: rel, tint });
    }
  }

  const ring = (on: boolean) => ({ borderWidth: 2, borderColor: on ? t.accent : 'transparent', padding: 2 });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
      <Preview t={t} wallpaper={effective} />
      {chatId ? (
        <Group>
          <CheckRow title="Как в настройках" subtitle="Общие обои для всех чатов" checked={!current} onPress={() => apply(undefined)} last />
        </Group>
      ) : null}
      <Group>
        <Row icon="photoPlus" iconBg="#3390EC" title="Выбрать своё фото" chevron={current?.kind !== 'photo'} onPress={pickPhoto} right={current?.kind === 'photo' ? <Icon name="check" size={18} color={t.accent} /> : null} />
        <Row icon="swatch" iconBg="#8E6CEF" title="Однотонный цвет" chevron={!colors && current?.kind !== 'color'} last onPress={() => setColors(!colors)} right={current?.kind === 'color' ? <Icon name="check" size={18} color={t.accent} /> : null} />
        {colors ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, paddingTop: 4 }}>
            {SOLID_COLORS.map((c) => {
              const on = current?.kind === 'color' && current.color === c;
              return (
                <Pressable key={c} onPress={() => apply({ kind: 'color', color: c })} style={[{ borderRadius: 24 }, ring(on)]} accessibilityState={{ selected: on }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: 0.5, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={16} color={isDarkColor(c) ? '#fff' : '#000'} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Group>
      <Caption top>Узоры</Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14 }}>
        {WALLPAPERS.map((_, i) => {
          const w: W = { kind: 'pattern', index: i };
          const on = same(current, w);
          const pt = chatTheme(t, w);
          return (
            <Pressable key={i} onPress={() => apply(w)} style={[{ width: '31.5%', borderRadius: 13 }, ring(on)]} accessibilityState={{ selected: on }}>
              <View style={{ aspectRatio: 0.6, borderRadius: 9, overflow: 'hidden' }}>
                <Wallpaper wallpaper={w} dark={t.dark} />
                <View style={{ position: 'absolute', right: 8, bottom: 38, width: 30, height: 16, borderRadius: 8, backgroundColor: pt.out }} />
                <View style={{ position: 'absolute', right: 8, bottom: 16, width: 44, height: 16, borderRadius: 8, backgroundColor: pt.out }} />
                <View style={{ position: 'absolute', left: 8, bottom: 16, width: 16, height: 16, borderRadius: 8, backgroundColor: pt.accent }} />
              </View>
              {on ? <Badge t={t} /> : null}
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

