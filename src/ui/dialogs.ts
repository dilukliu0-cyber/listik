// Системные диалоги iOS; на web — простые заменители.
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { createStore } from '../store';

export type ActionOption = { label: string; destructive?: boolean; onPress: () => void };

export type WebSheet = { title?: string; options: ActionOption[] } | null;
export const webSheet = createStore<WebSheet>(null);

export function showActions(title: string | undefined, options: ActionOption[]) {
  if (Platform.OS === 'ios') {
    const labels = [...options.map((o) => o.label), 'Отмена'];
    const destructive = options.map((o, i) => (o.destructive ? i : -1)).filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructive },
      (i) => {
        if (i < options.length) options[i].onPress();
      },
    );
    return;
  }
  webSheet.set({ title, options });
}

export function confirm(title: string, message: string, ok: string, onOk: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: ok, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}

export function info(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function promptText(title: string, initial: string, onDone: (text: string) => void) {
  if (Platform.OS === 'ios') {
    Alert.prompt(title, undefined, [{ text: 'Отмена', style: 'cancel' }, { text: 'Готово', onPress: (t?: string) => onDone(t ?? '') }], 'plain-text', initial);
    return;
  }
  const t = window.prompt(title, initial);
  if (t !== null) onDone(t);
}
