import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Note } from '../../store';
import type { Theme } from '../../theme';
import Icon, { type IconName } from '../../ui/Icon';
import { BubbleBody } from './Bubble';

export type MenuItem = { label: string; icon: IconName; onPress: () => void; destructive?: boolean };

type Props = { t: Theme; note: Note | null; items: MenuItem[]; fontSize: number; onClose: () => void };

const noop = () => {};

export default function ContextMenu({ t, note, items, fontSize, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  if (!note) return null;
  const maxW = Math.round(width * 0.8);
  const photoOnly = note.kind === 'photo' && !note.text && !note.replyTo;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={onClose} />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 10 }}>
        <ScrollView style={{ maxHeight: height * 0.45, flexGrow: 0 }} contentContainerStyle={{ alignItems: 'flex-end' }} pointerEvents="none">
          <View style={{ maxWidth: maxW, backgroundColor: photoOnly ? 'transparent' : t.out, borderRadius: 18, borderBottomRightRadius: 6, overflow: 'hidden' }}>
            <BubbleBody note={note} t={t} fontSize={fontSize} maxW={maxW} onJump={noop} onOpenPhoto={noop} onOpenFile={noop} onEditTranscript={noop} />
          </View>
        </ScrollView>
        <View style={{ width: 240, marginTop: 10, backgroundColor: t.menu, borderRadius: 14, overflow: 'hidden' }}>
          {items.map((it, i) => (
            <Pressable
              key={it.label}
              onPress={() => {
                onClose();
                it.onPress();
              }}
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
        </View>
      </View>
    </Modal>
  );
}
