import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { haptic } from '../../haptics';
import type { RootStack } from '../../navigation/types';
import { toast, useRuntime } from '../../runtime';
import { retranscribeAll } from '../../services/transcriber';
import { cancelDownload, deleteModel, startDownload } from '../../services/whisperModel';
import { actions, useStore } from '../../store';
import { useTheme } from '../../theme';
import { confirm } from '../../ui/dialogs';
import Icon from '../../ui/Icon';
import { Caption, Group, ProgressBar, Row, ToggleRow } from '../../ui/kit';
import { LANG_LABEL } from '../SettingsScreen';

const MB = 1024 * 1024;

export default function TranscriptionScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStack>>();
  const settings = useStore((s) => s.settings);
  const oldVoices = useStore((s) => Object.values(s.notes).filter((n) => n.voice && !n.deletedAt && n.voice.engine !== 'whisper').length);
  const model = useRuntime((r) => r.model);
  const ready = model.status === 'ready';
  const downloading = model.status === 'downloading';
  const accurate = settings.engine === 'whisper' && ready;

  const pill = (title: string, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ backgroundColor: t.accent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );

  const pct = model.total ? Math.round((model.written / model.total) * 100) : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.group }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
      <Caption top>Качество</Caption>
      <Group>
        <Row
          title="Обычная"
          subtitle="Встроена в iPhone, бывают ошибки"
          onPress={() => {
            haptic.select();
            actions.setSettings({ engine: 'apple' });
          }}
          right={!accurate ? <Icon name="check" size={18} color={t.accent} /> : null}
        />
        <Row
          title="Точная · Whisper"
          subtitle={ready ? 'large-v3-turbo · без интернета' : '547 МБ, без интернета'}
          last
          onPress={
            ready
              ? () => {
                  haptic.select();
                  actions.setSettings({ engine: 'whisper' });
                }
              : undefined
          }
          right={
            ready ? (
              accurate ? <Icon name="check" size={18} color={t.accent} /> : null
            ) : downloading ? (
              <ActivityIndicator color={t.accent} />
            ) : (
              pill(model.status === 'error' ? 'Повторить' : 'Скачать', () => {
                haptic.light();
                startDownload();
              })
            )
          }
        />
      </Group>

      {downloading ? (
        <Group>
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: t.text, fontSize: 17 }}>Загрузка</Text>
              <Text style={{ color: t.sub, fontSize: 15 }}>
                {Math.round(model.written / MB)} / {Math.round((model.total || 547 * MB) / MB)} МБ · {pct}%
              </Text>
            </View>
            <ProgressBar value={pct} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={{ color: t.sub, fontSize: 13 }}>Можно закрыть, докачается само</Text>
              <Pressable onPress={() => cancelDownload()} hitSlop={8}>
                <Text style={{ color: t.danger, fontSize: 13 }}>Отмена</Text>
              </Pressable>
            </View>
          </View>
        </Group>
      ) : null}

      {model.status === 'error' ? (
        <Group>
          <View style={{ padding: 14 }}>
            <Text style={{ color: t.danger, fontSize: 15 }}>Не удалось скачать модель: {model.error}</Text>
          </View>
        </Group>
      ) : null}

      {ready ? (
        <Group>
          <Row
            title="Модель Whisper"
            subtitle="large-v3-turbo · 547 МБ"
            last
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="checkCircle" size={16} color={t.green} />
                <Text style={{ color: t.green, fontSize: 15 }}>готова</Text>
              </View>
            }
          />
        </Group>
      ) : null}

      <Group>
        <Row title="Язык" value={settings.language === 'auto' ? 'Авто (рус/англ)' : LANG_LABEL[settings.language]} chevron onPress={() => nav.navigate('Language')} />
        <ToggleRow title="Расшифровывать сразу" value={settings.autoTranscribe} onChange={(v) => actions.setSettings({ autoTranscribe: v })} last />
      </Group>
      <Caption>Всё работает на телефоне. Голос никуда не отправляется.</Caption>

      {ready ? (
        <>
          {oldVoices > 0 ? (
            <Group>
              <Row
                title={`Перерасшифровать старые голосовые (${oldVoices})`}
                color={t.accent}
                last
                onPress={() =>
                  confirm('Перерасшифровать?', 'Старые голосовые будут расшифрованы точной моделью. Ваши правки в их расшифровках заменятся.', 'Начать', () => {
                    const n = retranscribeAll();
                    toast(`В очереди: ${n}`);
                  }, false)
                }
              />
            </Group>
          ) : null}
          <Group>
            <Row
              title="Удалить модель (освободить 547 МБ)"
              color={t.danger}
              center
              last
              onPress={() => confirm('Удалить модель?', 'Расшифровка снова станет обычной. Модель можно скачать заново.', 'Удалить', () => deleteModel())}
            />
          </Group>
        </>
      ) : (
        <Text style={{ color: t.sub, fontSize: 13, marginHorizontal: 32 }}>Когда точная модель скачается, старые голосовые можно перерасшифровать.</Text>
      )}
    </ScrollView>
  );
}
