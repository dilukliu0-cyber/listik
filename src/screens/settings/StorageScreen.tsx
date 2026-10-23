import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { clearCache } from '../../files';
import { bytes } from '../../format';
import { haptic } from '../../haptics';
import { toast } from '../../runtime';
import { storageStats, type Stats } from '../../services/storageStats';
import { deleteModel } from '../../services/whisperModel';
import { useTheme } from '../../theme';
import { confirm } from '../../ui/dialogs';
import { Caption, Group, Row } from '../../ui/kit';

export default function StorageScreen() {
  const t = useTheme();
  const [s, setS] = useState<Stats | null>(null);
  const load = useCallback(() => {
    storageStats().then(setS).catch(() => {});
  }, []);
  useFocusEffect(load);

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: t.group, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
      <Group>
        <Row icon="photoFill" iconBg="#3390EC" title="Фото" value={bytes(s.photos)} />
        <Row icon="file" iconBg="#2AABEE" title="Файлы" value={bytes(s.files)} />
        <Row icon="micFill" iconBg="#E2574C" title="Голосовые" value={bytes(s.voices)} />
        <Row icon="sparkles" iconBg="#8E6CEF" title="Модель Whisper" value={bytes(s.model)} />
        <Row icon="database" iconBg="#8E8E93" title="Кэш" value={bytes(s.cache)} last />
      </Group>
      <Caption>Всего: {bytes(s.total)}. Всё хранится только на этом телефоне.</Caption>
      <Group>
        <Row
          title="Очистить кэш"
          color={t.accent}
          center
          last
          onPress={async () => {
            await clearCache();
            haptic.success();
            toast('Кэш очищен');
            load();
          }}
        />
      </Group>
      {s.model > 0 ? (
        <Group>
          <Row
            title={`Удалить модель Whisper (${bytes(s.model)})`}
            color={t.danger}
            center
            last
            onPress={() =>
              confirm('Удалить модель?', 'Расшифровка станет обычной. Модель можно скачать заново.', 'Удалить', async () => {
                await deleteModel();
                load();
              })
            }
          />
        </Group>
      ) : null}
      <Caption>Чтобы освободить место от заметок, удалите их и очистите «Недавно удалённые».</Caption>
    </ScrollView>
  );
}
