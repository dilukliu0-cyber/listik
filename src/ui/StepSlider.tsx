import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { haptic } from '../haptics';
import { useTheme } from '../theme';

const DOT = 14;

/**
 * Ползунок по шагам. Жест забирает себе и не отдаёт стеку навигации —
 * свайп по ползунку не закрывает экран.
 */
export default function StepSlider({ steps, value, onChange }: { steps: number[]; value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const conf = useRef({ width: 0, value, onChange, steps });
  conf.current = { width, value, onChange, steps };

  const pick = (x: number) => {
    const { width: w, value: v, onChange: set, steps: SIZES } = conf.current;
    if (w <= 0) return;
    const step = (w - DOT) / (SIZES.length - 1);
    const i = Math.max(0, Math.min(SIZES.length - 1, Math.round((x - DOT / 2) / step)));
    if (SIZES[i] !== v) {
      haptic.select();
      conf.current.value = SIZES[i];
      set(SIZES[i]);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    }),
  ).current;

  const SIZES = steps;
  const idx = Math.max(0, SIZES.indexOf(value));
  const step = width > 0 ? (width - DOT) / (SIZES.length - 1) : 0;
  return (
    <View {...pan.panHandlers} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flex: 1, height: 44, justifyContent: 'center', marginHorizontal: 12 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: DOT / 2, right: DOT / 2, height: 2, backgroundColor: t.line }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: DOT / 2, width: idx * step, height: 2, backgroundColor: t.accent }} />
      <View pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {SIZES.map((s) => (
          <View key={s} style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: s === value ? t.accent : t.card, borderWidth: s === value ? 0 : 2, borderColor: s < value ? t.accent : t.line, transform: [{ scale: s === value ? 1.6 : 1 }] }} />
        ))}
      </View>
    </View>
  );
}
