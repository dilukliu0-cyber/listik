import { Text, View } from 'react-native';

import { actions, useStore } from '../../store';
import { useChatTheme } from '../../theme';
import { Group } from '../../ui/kit';
import StepSlider from '../../ui/StepSlider';
import Wallpaper from '../../ui/Wallpaper';

const SIZES = [13, 14, 15, 16, 17, 18, 19, 20, 21];
export default function TextSizeScreen() {
  const t = useChatTheme();
  const size = useStore((s) => s.settings.fontSize);
  const wp = useStore((s) => s.settings.wallpaper);
  return (
    <View style={{ flex: 1, backgroundColor: t.group, paddingTop: 20 }}>
      <View style={{ marginHorizontal: 16, height: 190, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', padding: 10, marginBottom: 22 }}>
        <Wallpaper wallpaper={wp} dark={t.dark} />
        {['Купить муку и молоко', 'Созвон в пять, потом отправить макет'].map((s) => (
          <View key={s} style={{ alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: t.out, borderRadius: t.radius, borderBottomRightRadius: Math.min(6, t.radius), paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 }}>
            <Text style={{ color: t.outText, fontSize: size, lineHeight: Math.round(size * 1.3) }}>{s}</Text>
          </View>
        ))}
      </View>
      <Group>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 56 }}>
          <Text style={{ color: t.text, fontSize: 13 }}>A</Text>
          <StepSlider steps={SIZES} value={size} onChange={(fontSize) => actions.setSettings({ fontSize })} />
          <Text style={{ color: t.text, fontSize: 22 }}>A</Text>
        </View>
      </Group>
      <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32, marginTop: -14 }}>Размер текста в заметках: {size}</Text>
    </View>
  );
}
