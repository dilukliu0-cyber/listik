// «Оформление» как в Telegram iOS: превью, цветовые темы, акцент, обои, ночная тема, текст, скругление, эмодзи.
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { haptic } from '../../haptics';
import type { RootStack } from '../../navigation/types';
import { toast } from '../../runtime';
import { actions, useStore } from '../../store';
import { ACCENTS, THEME_NAMES, chatTheme, isDarkColor, makeTheme, useTheme, type Theme, type ThemeKind } from '../../theme';
import ChatPreview from '../../ui/ChatPreview';
import Icon from '../../ui/Icon';
import { Caption, Group, Row, ToggleRow } from '../../ui/kit';
import StepSlider from '../../ui/StepSlider';
import Wallpaper from '../../ui/Wallpaper';

const KINDS: ThemeKind[] = ['classic', 'day', 'tinted', 'night'];
const RADII = [6, 8, 10, 12, 14, 16, 18];

/** Карточка темы: мини-чат с её обоями и пузырями */
function ThemeCard({ kind, on, accent, onPress }: { kind: ThemeKind; on: boolean; accent?: string; onPress: () => void }) {
  const t = useTheme();
  const wp = useStore((s) => s.settings.wallpaper);
  const ct = chatTheme(makeTheme(kind, accent, t.radius), wp);
  const dark = kind === 'tinted' || kind === 'night';
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', marginRight: 10 }} accessibilityState={{ selected: on }}>
      <View style={{ borderRadius: 14, borderWidth: 2, borderColor: on ? t.accent : 'transparent', padding: 2 }}>
        <View style={{ width: 86, height: 112, borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end', padding: 7, backgroundColor: ct.chatBar }}>
          <Wallpaper wallpaper={wp} dark={dark} />
          <View style={{ alignSelf: 'flex-start', width: 44, height: 14, borderRadius: 7, backgroundColor: dark ? '#2A2A2C' : '#FFFFFF', marginBottom: 5 }} />
          <View style={{ alignSelf: 'flex-end', width: 54, height: 14, borderRadius: 7, backgroundColor: ct.out, marginBottom: 5 }} />
          <View style={{ alignSelf: 'flex-end', width: 38, height: 14, borderRadius: 7, backgroundColor: ct.out }} />
        </View>
        {on ? (
          <Reanimated.View entering={FadeIn.duration(160)} style={{ position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' }}>
            <Icon name="check" size={11} color="#fff" />
          </Reanimated.View>
        ) : null}
      </View>
      <Text style={{ color: on ? t.accent : t.text, fontSize: 13, marginTop: 6, fontWeight: on ? '600' : '400' }}>{THEME_NAMES[kind]}</Text>
    </Pressable>
  );
}

/** Кружок акцента; первый — «под обои» */
function AccentDot({ t, color, on, onPress }: { t: Theme; color?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{ borderRadius: 20, borderWidth: 2, borderColor: on ? (color ?? t.accent) : 'transparent', padding: 2 }} accessibilityLabel={color ? `Цвет ${color}` : 'Под обои'} accessibilityState={{ selected: on }}>
      {color ? (
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Icon name="check" size={14} color={isDarkColor(color) ? '#fff' : '#000'} /> : null}
        </View>
      ) : (
        <View style={{ width: 30, height: 30, borderRadius: 15, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
          {['#4FAE4E', '#3390EC', '#F2A33A', '#8E6CEF'].map((c) => (
            <View key={c} style={{ width: 15, height: 15, backgroundColor: c }} />
          ))}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={on ? 'check' : 'photoFill'} size={13} color="#fff" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function AppearanceScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStack>>();
  const system = useColorScheme();
  const s = useStore((st) => st.settings);
  const isDark = s.theme === 'auto' ? system === 'dark' : s.theme === 'dark';
  const current: ThemeKind = isDark ? (s.darkTheme ?? 'tinted') : (s.lightTheme ?? 'classic');

  const pickTheme = (k: ThemeKind) => {
    if (k === current) return;
    haptic.select();
    const darkKind = k === 'tinted' || k === 'night';
    const patch = darkKind ? { darkTheme: k as 'tinted' | 'night' } : { lightTheme: k as 'classic' | 'day' };
    if (s.theme === 'auto' && darkKind !== isDark) {
      actions.setSettings(patch);
      toast(darkKind ? 'Включится, когда iPhone перейдёт в тёмный режим' : 'Включится, когда iPhone перейдёт в светлый режим');
      return;
    }
    actions.setSettings({ ...patch, theme: s.theme === 'auto' ? 'auto' : darkKind ? 'dark' : 'light' });
  };

  const pickAccent = (c?: string) => {
    if (c === s.accent) return;
    haptic.select();
    actions.setSettings({ accent: c });
  };

  // «под обои» есть только у тем, которые красятся от обоев
  const canAuto = current === 'classic' || current === 'tinted';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
      <ChatPreview t={t} wallpaper={s.wallpaper} />

      <Caption top>Цветовая тема</Caption>
      <Group>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 }}>
          {KINDS.map((k) => (
            <ThemeCard key={k} kind={k} on={k === current} accent={s.accent} onPress={() => pickTheme(k)} />
          ))}
        </ScrollView>
        <View style={{ height: 0.5, backgroundColor: t.line, marginLeft: 16 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}>
          {canAuto ? <AccentDot t={t} on={!s.accent} onPress={() => pickAccent(undefined)} /> : null}
          {ACCENTS.map((c) => (
            <AccentDot key={c} t={t} color={c} on={s.accent === c || (!canAuto && !s.accent && c === ACCENTS[0])} onPress={() => pickAccent(c)} />
          ))}
        </ScrollView>
      </Group>

      <Group>
        <Row icon="photoFill" iconBg="#4FAE4E" title="Обои для чатов" chevron onPress={() => nav.navigate('Wallpaper')} />
        <ToggleRow
          icon="moon"
          iconBg="#5856D6"
          title="Ночная тема как в iPhone"
          value={s.theme === 'auto'}
          onChange={(v) => actions.setSettings({ theme: v ? 'auto' : isDark ? 'dark' : 'light' })}
          last
        />
      </Group>
      {s.theme !== 'auto' ? (
        <Group>
          <Row title="Светлая" onPress={() => actions.setSettings({ theme: 'light' })} right={!isDark ? <Icon name="check" size={18} color={t.accent} /> : null} />
          <Row title="Тёмная" last onPress={() => actions.setSettings({ theme: 'dark' })} right={isDark ? <Icon name="check" size={18} color={t.accent} /> : null} />
        </Group>
      ) : (
        <Caption>Тёмная тема включается вместе с тёмным режимом iPhone.</Caption>
      )}

      <Group>
        <Row icon="textSize" iconBg="#F2A33A" title="Размер текста" value={String(s.fontSize)} chevron onPress={() => nav.navigate('TextSize')} />
        <View style={{ paddingLeft: 16, paddingRight: 14, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Icon name="corners" size={17} color="#fff" />
            </View>
            <Text style={{ flex: 1, color: t.text, fontSize: 17 }}>Скругление сообщений</Text>
            <Text style={{ color: t.sub, fontSize: 17 }}>{t.radius}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 42, height: 50 }}>
            <View style={{ width: 16, height: 12, borderWidth: 2, borderColor: t.sub, borderRadius: 2 }} />
            <StepSlider steps={RADII} value={t.radius} onChange={(bubbleRadius) => actions.setSettings({ bubbleRadius })} />
            <View style={{ width: 16, height: 12, borderWidth: 2, borderColor: t.sub, borderRadius: 6 }} />
          </View>
        </View>
        <View style={{ height: 0.5, backgroundColor: t.line, marginLeft: 58 }} />
        <ToggleRow icon="emoji" iconBg="#F2A33A" title="Большие эмодзи" value={s.bigEmoji !== false} onChange={(v) => actions.setSettings({ bigEmoji: v })} last />
      </Group>
      <Caption>Заметка из одного–трёх эмодзи показывается крупно, без пузыря.</Caption>
    </ScrollView>
  );
}
