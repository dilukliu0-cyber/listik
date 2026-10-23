// Живое превью чата: шапка, обои, пузыри, поле ввода — в цветах выбранной темы и обоев
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import type { Wallpaper as W } from '../store';
import { chatTheme, type Theme } from '../theme';
import Icon from './Icon';
import { useBgTransition } from './motion';
import Wallpaper from './Wallpaper';

function PreviewBubble({ pt, text, time, reply }: { pt: Theme; text: string; time: string; reply?: boolean }) {
  const bg = useBgTransition(pt.out);
  return (
    <Reanimated.View style={[{ alignSelf: 'flex-end', maxWidth: '78%', borderRadius: pt.radius - 2, borderBottomRightRadius: Math.min(5, pt.radius), paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 }, bg]}>
      {reply ? (
        <View style={{ flexDirection: 'row', marginBottom: 4, borderRadius: 5, overflow: 'hidden', backgroundColor: pt.outAccent + '1F' }}>
          <View style={{ width: 3, backgroundColor: pt.outAccent }} />
          <View style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: pt.outAccent, fontWeight: '600', fontSize: 13 }}>Ответ</Text>
            <Text numberOfLines={1} style={{ color: pt.outText, fontSize: 13 }}>Купить муку и молоко</Text>
          </View>
        </View>
      ) : null}
      <Text style={{ color: pt.outText, fontSize: 15 }}>
        {text}
        <Text style={{ color: 'transparent', fontSize: 11 }}>{'    ' + time}</Text>
      </Text>
      <Text style={{ position: 'absolute', right: 10, bottom: 5, color: pt.outSub, fontSize: 11 }}>{time}</Text>
    </Reanimated.View>
  );
}

/** Живое превью чата с выбранными обоями и палитрой */
export default function ChatPreview({ t, wallpaper }: { t: Theme; wallpaper: W }) {
  const pt = chatTheme(t, wallpaper);
  const bar = useBgTransition(pt.chatBar);
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 22, height: 250, borderRadius: 12, overflow: 'hidden', backgroundColor: t.card }}>
      <Reanimated.View style={[{ height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: t.line }, bar]}>
        <Icon name="back" size={16} color={pt.accent} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: pt.text, fontSize: 13, fontWeight: '600' }}>Покупки</Text>
          <Text style={{ color: pt.chatSub, fontSize: 10 }}>3 заметки</Text>
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#4FAE4E' }} />
      </Reanimated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 8 }}>
        <Reanimated.View key={JSON.stringify(wallpaper)} entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
          <Wallpaper wallpaper={wallpaper} dark={t.dark} />
        </Reanimated.View>
        <View style={{ alignSelf: 'center', backgroundColor: pt.datePill, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>Сегодня</Text>
        </View>
        <PreviewBubble pt={pt} text="Купить муку и молоко" time="10:24" />
        <PreviewBubble pt={pt} text="И ещё яйца, десяток" time="10:25" reply />
      </View>
      <Reanimated.View style={[{ height: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6, borderTopWidth: 0.5, borderTopColor: t.line }, bar]}>
        <Icon name="paperclip" size={18} color={pt.sub} />
        <View style={{ flex: 1, height: 26, borderRadius: 13, backgroundColor: pt.field, justifyContent: 'center', paddingHorizontal: 10 }}>
          <Text style={{ color: pt.sub, fontSize: 13 }}>Заметка</Text>
        </View>
        <Icon name="mic" size={19} color={pt.accent} />
      </Reanimated.View>
    </View>
  );
}
