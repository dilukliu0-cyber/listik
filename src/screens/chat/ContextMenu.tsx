import { BlurView } from 'expo-blur';
import { useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { haptic } from '../../haptics';
import type { Note } from '../../store';
import type { Theme } from '../../theme';
import Icon, { type IconName } from '../../ui/Icon';
import { usePresence } from '../../ui/motion';
import { BubbleBody } from './Bubble';

export type MenuItem = { label: string; icon: IconName; onPress: () => void; destructive?: boolean };

type Props = { t: Theme; note: Note | null; items: MenuItem[]; fontSize: number; onClose: () => void };

const noop = () => {};

export default function ContextMenu({ t, note, items, fontSize, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const { mounted, progress, onDismiss, afterHidden } = usePresence(!!note);
  // пока меню уезжает, показываем последнюю заметку и пункты
  const last = useRef<{ note: Note; items: MenuItem[] } | null>(null);
  if (note) last.current = { note, items };

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  // пузырь слегка «приподнимается», меню выпрыгивает на пружине из-под него
  const bubble = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.value, [0, 1], [0.94, 1.03]) }] }));
  const menu = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value * 1.4)),
    transform: [{ translateX: (1 - progress.value) * 60 }, { translateY: (1 - progress.value) * -40 }, { scale: interpolate(progress.value, [0, 1], [0.5, 1]) }],
  }));

  const shown = last.current;
  if (!shown) return null;
  const n = shown.note;
  const maxW = Math.round(width * 0.8);
  const photoOnly = n.kind === 'photo' && !n.text && !n.replyTo;

  // действие выполняем, когда меню полностью закрылось: так не конфликтуют окна и клавиатура
  const pick = (it: MenuItem) => {
    haptic.select();
    afterHidden(it.onPress);
    onClose();
  };

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} onDismiss={onDismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <BlurView intensity={28} tint={t.dark ? 'dark' : 'default'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay, opacity: 0.6 }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 10 }}>
        <ScrollView style={{ maxHeight: height * 0.45, flexGrow: 0, overflow: 'visible' }} contentContainerStyle={{ alignItems: 'flex-end' }} pointerEvents="none">
          <Animated.View style={[{ maxWidth: maxW, backgroundColor: photoOnly ? 'transparent' : t.out, borderRadius: 18, borderBottomRightRadius: 6, overflow: 'hidden' }, bubble]}>
            <BubbleBody note={n} t={t} fontSize={fontSize} maxW={maxW} onJump={noop} onOpenPhoto={noop} onOpenFile={noop} onEditTranscript={noop} />
          </Animated.View>
        </ScrollView>
        <Animated.View style={[{ width: 240, marginTop: 10, backgroundColor: t.menu, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }, menu]}>
          {shown.items.map((it, i) => (
            <Pressable
              key={it.label}
              onPress={() => pick(it)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                height: 46,
                backgroundColor: pressed ? (t.dark ? '#2E3B4B' : '#E2E2E6') : 'transparent',
                borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
                borderTopColor: t.dark ? '#0B121A' : '#D1D1D6',
              })}
            >
              <Text style={{ flex: 1, color: it.destructive ? '#E5533D' : t.text, fontSize: 17 }}>{it.label}</Text>
              <Icon name={it.icon} size={20} color={it.destructive ? '#E5533D' : t.text} />
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}
