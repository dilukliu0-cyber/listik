import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';

import { haptic } from '../haptics';
import ChatProfileScreen from '../screens/ChatProfileScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatsScreen from '../screens/ChatsScreen';
import EditChatScreen from '../screens/EditChatScreen';
import ForwardScreen from '../screens/ForwardScreen';
import ListEditorScreen from '../screens/ListEditorScreen';
import MediaScreen from '../screens/MediaScreen';
import PhotoViewerScreen from '../screens/PhotoViewerScreen';
import PinnedListScreen from '../screens/PinnedListScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import AppearanceScreen from '../screens/settings/AppearanceScreen';
import ArchiveScreen from '../screens/settings/ArchiveScreen';
import DeletedScreen from '../screens/settings/DeletedScreen';
import LanguageScreen from '../screens/settings/LanguageScreen';
import StorageScreen from '../screens/settings/StorageScreen';
import TextSizeScreen from '../screens/settings/TextSizeScreen';
import TranscriptionScreen from '../screens/settings/TranscriptionScreen';
import WallpaperScreen from '../screens/settings/WallpaperScreen';
import { useTheme } from '../theme';
import ErrorBoundary from '../ui/ErrorBoundary';
import Icon from '../ui/Icon';
import { navRef } from './ref';
import type { RootStack } from './types';

const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator();

// В iOS 26 свайп «назад» работает с любого места экрана и перехватывает ползунки и горизонтальные
// прокрутки. На экранах с такими элементами оставляем его только у левого края, как раньше в iOS.
const EDGE_ONLY = { end: 44 };

const BACK_TITLES: Record<string, string> = {
  ChatsTab: 'Чаты',
  MediaTab: 'Медиа',
  SettingsTab: 'Настройки',
  Appearance: 'Оформление',
  Transcription: 'Расшифровка',
  Archive: 'Архив',
};

type NavState = { routes: { key: string; name: string; state?: { index?: number; routes: { name: string }[] } }[] };

/** Подпись «назад» — название экрана, на который вернёт */
function backTitle(state: NavState | undefined, key: string): string {
  const routes = state?.routes ?? [];
  const i = routes.findIndex((r) => r.key === key);
  const prev = i > 0 ? routes[i - 1] : undefined;
  if (!prev) return 'Назад';
  if (prev.name === 'Tabs') {
    const tabs = prev.state;
    const tab = tabs ? tabs.routes[tabs.index ?? 0]?.name : 'ChatsTab';
    return BACK_TITLES[tab] ?? 'Назад';
  }
  return BACK_TITLES[prev.name] ?? 'Назад';
}

// Каждый экран в своём ErrorBoundary: ошибка одного экрана не роняет приложение
function safe<P extends object>(C: ComponentType<P>) {
  const Wrapped = (props: P) => (
    <ErrorBoundary>
      <C {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `Safe(${C.displayName ?? C.name})`;
  return Wrapped;
}

const S = {
  Chats: safe(ChatsScreen),
  Media: safe(MediaScreen),
  Settings: safe(SettingsScreen),
  Chat: safe(ChatScreen),
  ChatProfile: safe(ChatProfileScreen),
  EditChat: safe(EditChatScreen),
  PhotoViewer: safe(PhotoViewerScreen),
  Archive: safe(ArchiveScreen),
  Deleted: safe(DeletedScreen),
  Appearance: safe(AppearanceScreen),
  Wallpaper: safe(WallpaperScreen),
  TextSize: safe(TextSizeScreen),
  Transcription: safe(TranscriptionScreen),
  Language: safe(LanguageScreen),
  Storage: safe(StorageScreen),
  About: safe(AboutScreen),
  Forward: safe(ForwardScreen),
  ListEditor: safe(ListEditorScreen),
  PinnedList: safe(PinnedListScreen),
};

function Tabs() {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade', // мягкая смена вкладок
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.sub,
        tabBarStyle: { backgroundColor: t.bar, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
      screenListeners={{ tabPress: () => haptic.select() }}
    >
      <Tab.Screen name="ChatsTab" component={S.Chats} options={{ title: 'Чаты', tabBarIcon: ({ color }) => <Icon name="chats" size={25} color={color} /> }} />
      <Tab.Screen name="MediaTab" component={S.Media} options={{ title: 'Медиа', tabBarIcon: ({ color }) => <Icon name="media" size={25} color={color} /> }} />
      <Tab.Screen name="SettingsTab" component={S.Settings} options={{ title: 'Настройки', tabBarIcon: ({ color }) => <Icon name="settings" size={25} color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const t = useTheme();
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: t.accent, background: t.group, card: t.bar, text: t.text, border: t.line },
  };
  const sub = { headerTintColor: t.accent, headerStyle: { backgroundColor: t.group }, headerShadowVisible: false, headerTitleStyle: { color: t.text } };
  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      {/* нативные iOS-переходы стека со свайпом назад от края */}
      <Stack.Navigator
        screenOptions={({ navigation, route }) => ({
          headerShown: false,
          animation: 'default',
          gestureEnabled: true,
          // кнопка «назад» подписана экраном, на который вернёт, как в Telegram
          headerBackTitle: backTitle(navigation.getState() as unknown as NavState, route.key),
        })}
      >
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Chat" component={S.Chat} />
        <Stack.Screen name="ChatProfile" component={S.ChatProfile} options={{ gestureResponseDistance: EDGE_ONLY }} />
        <Stack.Screen name="EditChat" component={S.EditChat} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PhotoViewer" component={S.PhotoViewer} options={{ presentation: 'transparentModal', animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="Archive" component={S.Archive} options={{ ...sub, headerShown: true, title: 'Архив', headerStyle: { backgroundColor: t.bg } }} />
        <Stack.Screen name="Deleted" component={S.Deleted} options={{ ...sub, headerShown: true, title: 'Недавно удалённые' }} />
        <Stack.Screen name="Appearance" component={S.Appearance} options={{ ...sub, headerShown: true, title: 'Оформление', gestureResponseDistance: EDGE_ONLY }} />
        <Stack.Screen name="Wallpaper" component={S.Wallpaper} options={{ ...sub, headerShown: true, title: 'Обои' }} />
        <Stack.Screen name="TextSize" component={S.TextSize} options={{ ...sub, headerShown: true, title: 'Размер текста', gestureResponseDistance: EDGE_ONLY }} />
        <Stack.Screen name="Transcription" component={S.Transcription} options={{ ...sub, headerShown: true, title: 'Расшифровка' }} />
        <Stack.Screen name="Language" component={S.Language} options={{ ...sub, headerShown: true, title: 'Язык' }} />
        <Stack.Screen name="Storage" component={S.Storage} options={{ ...sub, headerShown: true, title: 'Память' }} />
        <Stack.Screen name="About" component={S.About} options={{ ...sub, headerShown: true, title: 'О приложении' }} />
        <Stack.Screen name="Forward" component={S.Forward} options={{ ...sub, headerShown: true, presentation: 'modal', title: 'Переслать' }} />
        <Stack.Screen name="ListEditor" component={S.ListEditor} options={{ ...sub, headerShown: true, presentation: 'modal', title: 'Список' }} />
        <Stack.Screen name="PinnedList" component={S.PinnedList} options={{ ...sub, headerShown: true, presentation: 'modal', title: 'Закреплённые' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
