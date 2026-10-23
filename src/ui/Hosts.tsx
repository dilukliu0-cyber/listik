// Глобальные окна: всплывашка, объяснение доступа, «Хотите точнее?», меню на web.
import { useRef, useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigate } from '../navigation/ref';
import { runtime, useRuntime } from '../runtime';
import { PERM_INFO, answerPrompt, promptDismissed, promptStore } from '../services/permissions';
import { startDownload } from '../services/whisperModel';
import { useTheme } from '../theme';
import { webSheet } from './dialogs';
import Icon from './Icon';
import { PrimaryButton, Sheet } from './kit';

function Toast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useRuntime((r) => r.toast);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, alignItems: 'center' }}>
      <View style={{ backgroundColor: t.dark ? 'rgba(60,60,64,0.96)' : 'rgba(30,30,32,0.92)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}>
        <Text style={{ color: '#fff', fontSize: 15 }}>{toast.text}</Text>
      </View>
    </View>
  );
}

function PermissionPrompt() {
  const t = useTheme();
  const live = useSyncExternalStore(promptStore.subscribe, promptStore.get, promptStore.get);
  // последнее окно держим на экране, пока Modal закрывается
  const last = useRef(live);
  if (live) last.current = live;
  const p = live ?? last.current;
  if (!p) return null;
  const info = PERM_INFO[p.kind];
  const denied = p.mode === 'denied';
  const sep = { borderTopWidth: 0.5, borderTopColor: t.dark ? '#3A3A3C' : '#D1D1D6' };
  return (
    <Modal transparent visible={!!live} animationType="fade" onRequestClose={() => answerPrompt(false)} onDismiss={promptDismissed}>
      <View style={{ flex: 1, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 280, backgroundColor: t.dark ? '#2C2C2E' : '#F2F2F2', borderRadius: 14, overflow: 'hidden' }}>
          <View style={{ padding: 18, alignItems: 'center' }}>
            <Icon name={info.icon} size={32} color={t.accent} />
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 17, marginTop: 8, marginBottom: 4, textAlign: 'center' }}>{info.title}</Text>
            <Text style={{ color: t.sub, fontSize: 13, textAlign: 'center' }}>
              {denied ? 'Доступ запрещён. Его можно включить в Настройках iPhone → Listik.' : info.text}
            </Text>
          </View>
          <Pressable onPress={() => answerPrompt(true)} style={[{ padding: 12, alignItems: 'center' }, sep]}>
            <Text style={{ color: t.accent, fontWeight: '600', fontSize: 17 }}>{denied ? 'Открыть настройки' : 'Продолжить'}</Text>
          </Pressable>
          <Pressable onPress={() => answerPrompt(false)} style={[{ padding: 12, alignItems: 'center' }, sep]}>
            <Text style={{ color: t.accent, fontSize: 17 }}>Не сейчас</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Upsell() {
  const t = useTheme();
  const visible = useRuntime((r) => r.upsell);
  const close = () => runtime.set((r) => ({ ...r, upsell: false }));
  return (
    <Sheet visible={visible} onClose={close}>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: t.dark ? '#1D3550' : '#E6F1FB', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
          <Icon name="sparkles" size={28} color={t.accent} />
        </View>
        <Text style={{ color: t.text, textAlign: 'center', fontWeight: '600', fontSize: 20, marginTop: 12, marginBottom: 6 }}>Хотите точнее?</Text>
        <Text style={{ color: t.sub, textAlign: 'center', fontSize: 15, lineHeight: 20 }}>
          Сейчас работает обычная расшифровка, в ней бывают ошибки. Скачайте точную модель Whisper: она лучше понимает речь, ставит знаки препинания и работает без интернета.
        </Text>
        <Text style={{ color: t.sub, textAlign: 'center', fontSize: 13, marginVertical: 12 }}>547 МБ · один раз</Text>
        <PrimaryButton
          title="Скачать"
          onPress={() => {
            close();
            startDownload();
            navigate('Transcription');
          }}
        />
        <Pressable onPress={close} style={{ paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Не сейчас</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

function WebActionSheet() {
  const t = useTheme();
  const s = useSyncExternalStore(webSheet.subscribe, webSheet.get, webSheet.get);
  const close = () => webSheet.set(null);
  return (
    <Sheet visible={!!s} onClose={close}>
      {s?.title ? <Text style={{ color: t.sub, textAlign: 'center', fontSize: 13, marginBottom: 8 }}>{s.title}</Text> : null}
      {s?.options.map((o) => (
        <Pressable
          key={o.label}
          onPress={() => {
            close();
            o.onPress();
          }}
          style={{ paddingVertical: 15, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: t.line }}
        >
          <Text style={{ color: o.destructive ? t.danger : t.accent, fontSize: 18 }}>{o.label}</Text>
        </Pressable>
      ))}
      <Pressable onPress={close} style={{ paddingVertical: 15, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: t.line }}>
        <Text style={{ color: t.accent, fontSize: 18, fontWeight: '600' }}>Отмена</Text>
      </Pressable>
    </Sheet>
  );
}

export default function Hosts() {
  return (
    <>
      <PermissionPrompt />
      <Upsell />
      <WebActionSheet />
      <Toast />
    </>
  );
}
