import { useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { haptic } from '../../haptics';
import { actions, useStore } from '../../store';
import { useChatTheme } from '../../theme';
import { Group } from '../../ui/kit';
import Wallpaper from '../../ui/Wallpaper';

const SIZES = [13, 14, 15, 16, 17, 18, 19, 20, 21];
const DOT = 14;

/**
 * Ползунок размера текста. Жест забирает себе и не отдаёт стеку навигации —
 * свайп по ползунку не закрывает экран (свайп «назад» на этом экране выключен).
 */
function SizeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useChatTheme();
  const [width, setWidth] = useState(0);
  const conf = useRef({ width: 0, value, onChange });
  conf.current = { width, value, onChange };

  const pick = (x: number) => {
    const { width: w, value: v, onChange: set } = conf.current;
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

export default function TextSizeScreen() {
  const t = useChatTheme();
  const size = useStore((s) => s.settings.fontSize);
  const wp = useStore((s) => s.settings.wallpaper);
  return (
    <View style={{ flex: 1, backgroundColor: t.group, paddingTop: 20 }}>
      <View style={{ marginHorizontal: 16, height: 190, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', padding: 10, marginBottom: 22 }}>
        <Wallpaper wallpaper={wp} dark={t.dark} />
        {['Купить муку и молоко', 'Созвон в пять, потом отправить макет'].map((s) => (
          <View key={s} style={{ alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: t.out, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 }}>
            <Text style={{ color: t.outText, fontSize: size, lineHeight: Math.round(size * 1.3) }}>{s}</Text>
          </View>
        ))}
      </View>
      <Group>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 56 }}>
          <Text style={{ color: t.text, fontSize: 13 }}>A</Text>
          <SizeSlider value={size} onChange={(fontSize) => actions.setSettings({ fontSize })} />
          <Text style={{ color: t.text, fontSize: 22 }}>A</Text>
        </View>
      </Group>
      <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32, marginTop: -14 }}>Размер текста в заметках: {size}</Text>
    </View>
  );
}
