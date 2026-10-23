// Оформление выделенного текста, как «Форматирование» в Telegram:
// жирный, курсив, подчёркнутый, зачёркнутый, моноширинный, скрытый, ссылка.
import { Platform, Pressable, ScrollView, Text, type TextStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { haptic } from '../../../haptics';
import type { Mark } from '../../../markup';
import type { Theme } from '../../../theme';

const ITEMS: { mark: Mark | 'link'; label: string; style?: TextStyle }[] = [
  { mark: 'bold', label: 'Жирный', style: { fontWeight: '700' } },
  { mark: 'italic', label: 'Курсив', style: { fontStyle: 'italic' } },
  { mark: 'underline', label: 'Подчёркнутый', style: { textDecorationLine: 'underline' } },
  { mark: 'strike', label: 'Зачёркнутый', style: { textDecorationLine: 'line-through' } },
  { mark: 'mono', label: 'Моно', style: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 14 } },
  { mark: 'spoiler', label: 'Скрытый' },
  { mark: 'link', label: 'Ссылка' },
];

export default function FormatBar({ t, onPick }: { t: Theme; onPick: (m: Mark | 'link') => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 6, gap: 6 }}
      >
        {ITEMS.map((it) => (
          <Pressable
            key={it.mark}
            onPress={() => {
              haptic.select();
              onPick(it.mark);
            }}
            style={({ pressed }) => ({ backgroundColor: pressed ? t.line : t.field, borderRadius: 14, paddingHorizontal: 12, height: 28, justifyContent: 'center', borderWidth: 0.5, borderColor: t.line })}
          >
            <Text style={[{ color: t.text, fontSize: 14 }, it.style]}>{it.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
