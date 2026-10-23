import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import Icon from '../../ui/Icon';
import { Group, Row } from '../../ui/kit';
import { APP_VERSION } from '../SettingsScreen';

export default function AboutScreen() {
  const t = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 30, paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={{ width: 88, height: 88, borderRadius: 20, backgroundColor: '#3390EC', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bubble" size={46} color="#fff" />
        </View>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', marginTop: 12 }}>Listik</Text>
        <Text style={{ color: t.sub, fontSize: 15, marginTop: 2 }}>заметки как сообщения</Text>
      </View>
      <Group>
        <Row title="Версия" value={APP_VERSION} />
        <Row title="Хранение" value="только на телефоне" />
        <Row title="Аккаунт" value="не нужен" last />
      </Group>
      <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32, lineHeight: 18 }}>
        Каждый чат — тема, каждое сообщение — заметка. Без входа, без синхронизации и без рекламы. Голосовые расшифровываются на телефоне.
      </Text>
    </ScrollView>
  );
}
