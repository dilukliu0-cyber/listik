// Системные диалоги iOS; на web — простые заменители.
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { plural } from '../format';
import { haptic } from '../haptics';
import { undoToast } from '../runtime';
import { actions, createStore, store } from '../store';

export type ActionOption = { label: string; destructive?: boolean; onPress: () => void };

export type WebSheet = { title?: string; options: ActionOption[] } | null;
export const webSheet = createStore<WebSheet>(null);

// Следующее окно (подтверждение) показываем, когда шторка уже уехала, — иначе iOS его не покажет
let sheetClosedAt = 0;
function afterSheet(f: () => void) {
  const wait = 320 - (Date.now() - sheetClosedAt);
  if (wait > 0) setTimeout(f, wait);
  else f();
}

export function showActions(title: string | undefined, options: ActionOption[], message?: string) {
  if (Platform.OS === 'ios') {
    const labels = [...options.map((o) => o.label), 'Отмена'];
    const destructive = options.map((o, i) => (o.destructive ? i : -1)).filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, message, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructive },
      (i) => {
        sheetClosedAt = Date.now();
        if (i < options.length) options[i].onPress();
      },
    );
    return;
  }
  webSheet.set({ title: message ? `${title ?? ''}\n${message}` : title, options });
}

/** Подтверждение снизу, как в Telegram: красная кнопка + «Отмена» */
export function confirmSheet(title: string, label: string, onOk: () => void, message?: string) {
  afterSheet(() => {
    haptic.warning();
    showActions(title, [{ label, destructive: true, onPress: onOk }], message);
  });
}

const notesWord = (n: number) => plural(n, 'заметку', 'заметки', 'заметок');

/** «Удалить заметку?» / «Удалить 3 заметки?» → удаление → тост «Отменить» */
export function confirmDeleteNotes(ids: string[], onDelete: (ids: string[]) => void) {
  const n = ids.length;
  if (!n) return;
  const title = n === 1 ? 'Удалить заметку?' : `Удалить ${n} ${notesWord(n)}?`;
  confirmSheet(title, n === 1 ? 'Удалить заметку' : `Удалить ${n} ${notesWord(n)}`, () => onDelete(ids), `${n === 1 ? 'Она будет' : 'Они будут'} в «Недавно удалённых» 30 дней.`);
}

/** Удаление заметок с тостом «Заметка удалена · Отменить» */
export function deleteNotesWithUndo(ids: string[]) {
  actions.deleteNotes(ids);
  haptic.warning();
  const n = ids.length;
  undoToast(n === 1 ? 'Заметка удалена' : `Удалено: ${n} ${plural(n, 'заметка', 'заметки', 'заметок')}`, () => actions.restoreNotes(ids));
}

/** «Удалить чат «Название»?» → в «Недавно удалённые» + тост «Отменить» */
export function confirmDeleteChats(ids: string[], onDone?: () => void) {
  const s = store.get();
  const n = ids.length;
  if (!n) return;
  const title = n === 1 ? `Удалить чат «${s.chats[ids[0]]?.title ?? ''}»?` : `Удалить ${n} ${plural(n, 'чат', 'чата', 'чатов')}?`;
  confirmSheet(
    title,
    n === 1 ? 'Удалить чат' : `Удалить ${n} ${plural(n, 'чат', 'чата', 'чатов')}`,
    () => {
      ids.forEach((id) => actions.deleteChat(id));
      haptic.warning();
      undoToast(n === 1 ? 'Чат удалён' : `Удалено чатов: ${n}`, () => ids.forEach((id) => actions.restoreChat(id)));
      onDone?.();
    },
    n === 1 ? 'Он будет в «Недавно удалённых» 30 дней.' : 'Они будут в «Недавно удалённых» 30 дней.',
  );
}

export function confirm(title: string, message: string, ok: string, onOk: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  afterSheet(() => {
    if (destructive) haptic.warning();
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel' },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: onOk },
    ]);
  });
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
    afterSheet(() => Alert.prompt(title, undefined, [{ text: 'Отмена', style: 'cancel' }, { text: 'Готово', onPress: (t?: string) => onDone(t ?? '') }], 'plain-text', initial));
    return;
  }
  const t = window.prompt(title, initial);
  if (t !== null) onDone(t);
}
