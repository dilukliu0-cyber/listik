import * as DocumentPicker from 'expo-document-picker';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { importFile } from '../../files';
import { haptic } from '../../haptics';
import { toast } from '../../runtime';
import { ensurePermission, hasPermission } from '../../services/permissions';
import { actions } from '../../store';
import type { Theme } from '../../theme';
import Icon, { type IconName } from '../../ui/Icon';
import { Sheet } from '../../ui/kit';
import { PressScale } from '../../ui/motion';

type Recent = { id: string; uri: string; width: number; height: number };

type Props = {
  t: Theme;
  visible: boolean;
  onClose: () => void;
  chatId: string;
  replyTo?: string;
  caption: string;
  onSent: () => void;
  onList: () => void;
};

export default function AttachSheet({ t, visible, onClose, chatId, replyTo, caption, onSent, onList }: Props) {
  const [recent, setRecent] = useState<Recent[]>([]);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      try {
        let ok = await hasPermission('photos');
        if (!ok) {
          const M = await import('expo-media-library/legacy');
          const st = await M.getPermissionsAsync(false);
          if (st.status === 'undetermined') ok = await ensurePermission('photos');
        }
        if (!alive) return;
        setNoAccess(!ok);
        if (!ok) return;
        const M = await import('expo-media-library/legacy');
        const page = await M.getAssetsAsync({ first: 24, mediaType: M.MediaType.photo, sortBy: [[M.SortBy.creationTime, false]] });
        if (alive) setRecent(page.assets.map((a) => ({ id: a.id, uri: a.uri, width: a.width, height: a.height })));
      } catch {
        if (alive) setNoAccess(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  async function addPhoto(uri: string, width: number, height: number) {
    try {
      const rel = await importFile(uri, uri, 'jpg');
      actions.addNote({ chatId, kind: 'photo', text: caption.trim(), replyTo, photo: { uri: rel, width, height } });
      haptic.light();
      onSent();
    } catch (e) {
      toast('Не удалось добавить фото: ' + String((e as Error)?.message ?? e));
    }
  }

  // iOS не покажет камеру/галерею, пока шторка (Modal) ещё закрывается — экран зависает.
  // Поэтому действие ставится в очередь и выполняется после полного закрытия шторки.
  const pending = useRef<(() => void) | null>(null);
  const closeThen = (f: () => void) => {
    pending.current = f;
    onClose();
  };
  const onHidden = () => {
    const f = pending.current;
    pending.current = null;
    if (f) setTimeout(f, 30);
  };

  async function pickRecent(r: Recent) {
    try {
      const M = await import('expo-media-library/legacy');
      const info = await M.getAssetInfoAsync(r.id);
      const src = info.localUri ?? info.uri;
      await addPhoto(src, r.width, r.height);
    } catch (e) {
      toast('Не удалось открыть фото: ' + String((e as Error)?.message ?? e));
    }
  }

  async function camera() {
    if (Platform.OS === 'web') {
      toast('Камера работает в приложении на iPhone');
      return;
    }
    if (!(await ensurePermission('camera'))) return;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, exif: false }).catch((e) => {
      toast('Не удалось открыть камеру: ' + String((e as Error)?.message ?? e));
      return null;
    });
    if (r && !r.canceled) for (const a of r.assets) await addPhoto(a.uri, a.width, a.height);
  }

  async function gallery() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.85, exif: false }).catch(() => null);
    if (r && !r.canceled) for (const a of r.assets) await addPhoto(a.uri, a.width, a.height);
  }

  async function file() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false }).catch(() => null);
    if (!r || r.canceled) return;
    for (const a of r.assets) {
      try {
        const rel = await importFile(a.uri, a.name, 'bin');
        actions.addNote({ chatId, kind: 'file', text: caption.trim(), replyTo, file: { uri: rel, name: a.name, size: a.size ?? 0, mime: a.mimeType ?? undefined } });
        haptic.light();
        onSent();
      } catch (e) {
        toast('Не удалось добавить файл: ' + String((e as Error)?.message ?? e));
      }
    }
  }

  const btn = (icon: IconName, label: string, color: string, onPress: () => void) => (
    <PressScale onPress={onPress} scaleTo={0.88} style={{ alignItems: 'center', width: 76 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color="#fff" />
      </View>
      <Text style={{ color: t.text, fontSize: 13, marginTop: 6 }}>{label}</Text>
    </PressScale>
  );

  return (
    <Sheet visible={visible} onClose={onClose} onHidden={onHidden}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
        <PressScale onPress={() => closeThen(camera)} scaleTo={0.94} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={30} color="#fff" />
        </PressScale>
        {noAccess ? (
          <Pressable
            onPress={() => ensurePermission('photos')}
            style={{ width: 200, height: 96, borderRadius: 10, backgroundColor: t.search, alignItems: 'center', justifyContent: 'center', padding: 10 }}
          >
            <Text style={{ color: t.sub, fontSize: 13, textAlign: 'center' }}>Разрешите доступ к фото, чтобы видеть последние снимки</Text>
          </Pressable>
        ) : (
          recent.map((r) => (
            <PressScale key={r.id} onPress={() => closeThen(() => pickRecent(r))} scaleTo={0.94}>
              <ExpoImage source={{ uri: r.uri }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: t.search }} contentFit="cover" recyclingKey={r.id} transition={120} />
            </PressScale>
          ))
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 18, paddingHorizontal: 20 }}>
        {btn('photoFill', 'Галерея', '#3390EC', () => closeThen(gallery))}
        {btn('file', 'Файл', '#2AABEE', () => closeThen(file))}
        {btn('checklist', 'Список', '#4FAE4E', () => closeThen(onList))}
      </View>
    </Sheet>
  );
}
