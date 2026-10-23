import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { HeaderButton } from './kit';

type Props = { visible: boolean; title: string; initial: string; onCancel: () => void; onDone: (text: string) => void };

/** Редактирование длинного текста (например, расшифровки) */
export default function EditTextModal({ visible, title, initial, onCancel, onDone }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.group }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, marginTop: Platform.OS === 'ios' ? 0 : insets.top }}>
          <View style={{ flex: 1 }}>
            <HeaderButton title="Отмена" onPress={onCancel} />
          </View>
          <Text style={{ color: t.text, fontWeight: '600', fontSize: 17 }}>{title}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <HeaderButton title="Готово" bold onPress={() => onDone(text.trim())} />
          </View>
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          style={{ flex: 1, margin: 16, padding: 14, borderRadius: 12, backgroundColor: t.card, color: t.text, fontSize: 17, textAlignVertical: 'top' }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
