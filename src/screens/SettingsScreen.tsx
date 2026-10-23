import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { ScrollView, View, useColorScheme } from 'react-native';

import { bytes } from '../format';
import type { RootStack } from '../navigation/types';
import { storageStats } from '../services/storageStats';
import { actions, useStore } from '../store';
import { THEME_NAMES, useTheme } from '../theme';
import { Group, Row, TabHeader, ToggleRow } from '../ui/kit';

export const THEME_LABEL = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' } as const;
export const LANG_LABEL = { auto: 'Авто', ru: 'Русский', en: 'English' } as const;
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStack>>();
  const settings = useStore((s) => s.settings);
  const archived = useStore((s) => Object.values(s.chats).filter((c) => c.archived && !c.deletedAt).length);
  const deleted = useStore((s) => {
    const chats = Object.values(s.chats).filter((c) => c.deletedAt).length;
    const notes = Object.values(s.notes).filter((n) => n.deletedAt && !s.chats[n.chatId]?.deletedAt).length;
    return chats + notes;
  });
  const [total, setTotal] = useState<number | null>(null);
  const system = useColorScheme();
  const isDark = settings.theme === 'auto' ? system === 'dark' : settings.theme === 'dark';
  const themeName = THEME_NAMES[isDark ? (settings.darkTheme ?? 'tinted') : (settings.lightTheme ?? 'classic')];

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      storageStats().then((s) => alive && setTotal(s.total)).catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.group }}>
      <TabHeader title="Настройки" />
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 30 }}>
        <Group>
          <Row icon="palette" iconBg="#3390EC" title="Оформление" value={themeName} chevron onPress={() => nav.navigate('Appearance')} />
          <Row icon="photoFill" iconBg="#4FAE4E" title="Обои чатов" chevron onPress={() => nav.navigate('Wallpaper')} />
          <Row icon="textSize" iconBg="#F2A33A" title="Размер текста" value={String(settings.fontSize)} chevron last onPress={() => nav.navigate('TextSize')} />
        </Group>
        <Group>
          <Row icon="micFill" iconBg="#E2574C" title="Расшифровка" value={LANG_LABEL[settings.language]} chevron onPress={() => nav.navigate('Transcription')} />
          <ToggleRow icon="haptic" iconBg="#8E6CEF" title="Вибро-отклик" value={settings.haptics} onChange={(v) => actions.setSettings({ haptics: v })} last />
        </Group>
        <Group>
          <Row icon="archive" iconBg="#8E8E93" title="Архив" value={archived ? String(archived) : ''} chevron onPress={() => nav.navigate('Archive')} />
          <Row icon="trash" iconBg="#E2574C" title="Недавно удалённые" value={deleted ? String(deleted) : ''} chevron onPress={() => nav.navigate('Deleted')} />
          <Row icon="database" iconBg="#2AABEE" title="Память" value={total === null ? '' : bytes(total)} chevron last onPress={() => nav.navigate('Storage')} />
        </Group>
        <Group>
          <Row icon="info" iconBg="#8E8E93" title="О приложении" value={APP_VERSION} chevron last onPress={() => nav.navigate('About')} />
        </Group>
      </ScrollView>
    </View>
  );
}
