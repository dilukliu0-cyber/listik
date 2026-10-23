import { ScrollView } from 'react-native';

import { actions, useStore } from '../../store';
import { useTheme } from '../../theme';
import { Caption, CheckRow, Group } from '../../ui/kit';

export default function LanguageScreen() {
  const t = useTheme();
  const lang = useStore((s) => s.settings.language);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20 }}>
      <Group>
        <CheckRow title="Авто" subtitle="Русский и английский" checked={lang === 'auto'} onPress={() => actions.setSettings({ language: 'auto' })} />
        <CheckRow title="Русский" checked={lang === 'ru'} onPress={() => actions.setSettings({ language: 'ru' })} />
        <CheckRow title="English" checked={lang === 'en'} onPress={() => actions.setSettings({ language: 'en' })} last />
      </Group>
      <Caption>Обычная расшифровка в режиме «Авто» распознаёт русскую речь. Точная (Whisper) сама определяет язык.</Caption>
    </ScrollView>
  );
}
