import { StackActions, createNavigationContainerRef } from '@react-navigation/native';

import type { RootStack } from './types';

export const navRef = createNavigationContainerRef<RootStack>();

export function navigate<K extends keyof RootStack>(...args: undefined extends RootStack[K] ? [K, RootStack[K]?] : [K, RootStack[K]]) {
  if (navRef.isReady()) (navRef.navigate as (...a: unknown[]) => void)(...args);
}

/** Открыть чат на заметке: если чат уже открыт в стеке — вернуться к нему */
export function openChatAt(chatId: string, jumpTo?: string, search?: boolean) {
  if (!navRef.isReady()) return;
  const state = navRef.getRootState();
  const exists = state?.routes.some((r) => r.name === 'Chat' && (r.params as { chatId?: string } | undefined)?.chatId === chatId);
  if (exists) navRef.dispatch(StackActions.popTo('Chat', { chatId, jumpTo, search }, { merge: true }));
  else navRef.navigate('Chat', { chatId, jumpTo, search });
}
