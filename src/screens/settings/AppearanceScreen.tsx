import { ScrollView } from 'react-native';

import { actions, useStore } from '../../store';
import { useTheme } from '../../theme';
import { CheckRow, Group } from '../../ui/kit';

export default function AppearanceScreen() {
  const t = useTheme();
  const theme = useStore((s) => s.settings.theme);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20 }}>
      <Group>
        <CheckRow title="Авто" subtitle="Как в системе iPhone" checked={theme === 'auto'} onPress={() => actions.setSettings({ theme: 'auto' })} />
        <CheckRow title="Светлая" checked={theme === 'light'} onPress={() => actions.setSettings({ theme: 'light' })} />
        <CheckRow title="Тёмная" checked={theme === 'dark'} onPress={() => actions.setSettings({ theme: 'dark' })} last />
      </Group>
    </ScrollView>
  );
}
