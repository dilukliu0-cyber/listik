import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { store } from './store';

function on() {
  return Platform.OS === 'ios' && store.get().settings.haptics;
}

export const haptic = {
  light() {
    if (on()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium() {
    if (on()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  select() {
    if (on()) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (on()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (on()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
