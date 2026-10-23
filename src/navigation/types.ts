import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStack = {
  Tabs: undefined;
  Chat: { chatId: string; jumpTo?: string; search?: boolean };
  ChatProfile: { chatId: string };
  EditChat: { chatId?: string; template?: 'ideas' | 'shopping' | 'movies' | 'work' } | undefined;
  PhotoViewer: { ids: string[]; index: number };
  Archive: undefined;
  Deleted: undefined;
  Appearance: undefined;
  Wallpaper: { chatId?: string } | undefined;
  TextSize: undefined;
  Transcription: undefined;
  Language: undefined;
  Storage: undefined;
  About: undefined;
  Forward: { noteIds: string[] };
  ListEditor: { chatId: string; noteId?: string };
  PinnedList: { chatId: string };
};

export type ScreenProps<K extends keyof RootStack> = NativeStackScreenProps<RootStack, K>;
