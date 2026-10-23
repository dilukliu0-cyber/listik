import { Pressable, Text, View } from 'react-native';

import { haptic } from '../../haptics';
import { actions, useStore } from '../../store';
import { useTheme } from '../../theme';
import { Group } from '../../ui/kit';
import Wallpaper from '../../ui/Wallpaper';

const SIZES = [13, 14, 15, 16, 17, 18, 19, 20, 21];

export default function TextSizeScreen() {
  const t = useTheme();
  const size = useStore((s) => s.settings.fontSize);
  const wp = useStore((s) => s.settings.wallpaper);
  return (
    <View style={{ flex: 1, backgroundColor: t.group, paddingTop: 20 }}>
      <View style={{ marginHorizontal: 16, height: 190, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', padding: 10, marginBottom: 22 }}>
        <Wallpaper wallpaper={wp} dark={t.dark} />
        {['Купить муку и молоко', 'Созвон в пять, потом отправить макет'].map((s) => (
          <View key={s} style={{ alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: t.out, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 }}>
            <Text style={{ color: t.text, fontSize: size, lineHeight: Math.round(size * 1.3) }}>{s}</Text>
          </View>
        ))}
      </View>
      <Group>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 56 }}>
          <Text style={{ color: t.text, fontSize: 13 }}>A</Text>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12 }}>
            <View style={{ position: 'absolute', left: 6, right: 6, height: 2, backgroundColor: t.line }} />
            {SIZES.map((s) => (
              <Pressable
                key={s}
                hitSlop={8}
                onPress={() => {
                  haptic.select();
                  actions.setSettings({ fontSize: s });
                }}
                style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: s === size ? t.accent : t.card, borderWidth: s === size ? 0 : 2, borderColor: t.line, transform: [{ scale: s === size ? 1.6 : 1 }] }}
              />
            ))}
          </View>
          <Text style={{ color: t.text, fontSize: 22 }}>A</Text>
        </View>
      </Group>
      <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32, marginTop: -14 }}>Размер текста в заметках: {size}</Text>
    </View>
  );
}
