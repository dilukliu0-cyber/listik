// Скрепка как в Telegram: шторка с сеткой твоих фото (первая клетка — камера), выбор с номерами,
// подпись и «Отправить N». Снизу — «Галерея», «Файл», «Список».
// Камера, системная галерея и файлы открываются только после полного закрытия шторки —
// иначе iOS не покажет их поверх закрывающегося окна и экран зависнет.
import * as DocumentPicker from 'expo-document-picker';
import { Image as XImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { importFile } from '../../files';
import { haptic } from '../../haptics';
import { toast } from '../../runtime';
import { sendPhotos, type PhotoSource } from '../../services/photos';
import { ensurePermission } from '../../services/permissions';
import { actions } from '../../store';
import type { Theme } from '../../theme';
import Icon, { type IconName } from '../../ui/Icon';
import { PressScale, SPRING, usePresence } from '../../ui/motion';

type Asset = { id: string; uri: string; width: number; height: number };
type Access = 'unknown' | 'all' | 'limited' | 'none';

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

const PAGE = 60;
const GAP = 2;

/** Клетка с фото: кружок выбора с номером, выбранное фото чуть уменьшается */
const Cell = memo(function Cell({ a, size, n, accent, onPress }: { a: Asset; size: number; n: number; accent: string; onPress: (a: Asset) => void }) {
  const s = useSharedValue(n ? 0.88 : 1);
  useEffect(() => {
    s.value = withSpring(n ? 0.88 : 1, SPRING);
  }, [n, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable onPress={() => onPress(a)} style={{ width: size, height: size }} accessibilityLabel={n ? `Фото, выбрано ${n}` : 'Фото'}>
      <Animated.View style={[{ flex: 1, overflow: 'hidden' }, st]}>
        <XImage source={{ uri: a.uri }} recyclingKey={a.id} contentFit="cover" transition={100} style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, borderWidth: n ? 0 : 1.5, borderColor: '#fff', backgroundColor: n ? accent : 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        {n ? (
          <Animated.Text entering={ZoomIn.duration(140)} style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
            {n}
          </Animated.Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export default function AttachSheet({ t, visible, onClose, chatId, replyTo, caption, onSent, onList }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { mounted, progress, onDismiss, afterHidden } = usePresence(visible);
  const [access, setAccess] = useState<Access>('unknown');
  const [assets, setAssets] = useState<Asset[]>([]);
  const cursor = useRef<{ after?: string; done: boolean; loading: boolean; gen: number }>({ done: false, loading: false, gen: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const drag = useSharedValue(0);

  const panelH = Math.round(height * 0.62) + insets.bottom;
  const size = (width - GAP * 2) / 3;

  // ---------- фото из медиатеки ----------
  const loadMore = useCallback(async () => {
    const c = cursor.current;
    if (c.done || c.loading || Platform.OS === 'web') return;
    c.loading = true;
    const gen = c.gen;
    try {
      const M = await import('expo-media-library/legacy');
      const page = await M.getAssetsAsync({ first: PAGE, after: c.after, mediaType: M.MediaType.photo, sortBy: [[M.SortBy.creationTime, false]] });
      if (gen !== cursor.current.gen) return; // список уже начали заново
      c.after = page.endCursor;
      c.done = !page.hasNextPage;
      const add = page.assets.map((a) => ({ id: a.id, uri: a.uri, width: a.width, height: a.height }));
      setAssets((list) => [...list, ...add]);
    } catch {
      c.done = true;
    } finally {
      c.loading = false;
    }
  }, []);

  const checkAccess = useCallback(async () => {
    if (Platform.OS === 'web') {
      setAccess('none');
      return;
    }
    try {
      const M = await import('expo-media-library/legacy');
      let st = await M.getPermissionsAsync(false);
      if (!st.granted && st.status === 'undetermined') {
        await ensurePermission('photos');
        st = await M.getPermissionsAsync(false);
      }
      const a: Access = !st.granted ? 'none' : st.accessPrivileges === 'limited' ? 'limited' : 'all';
      setAccess(a);
      if (a !== 'none') {
        cursor.current = { done: false, loading: false, gen: cursor.current.gen + 1 };
        setAssets([]);
        loadMore();
      }
    } catch {
      setAccess('none');
    }
  }, [loadMore]);

  useEffect(() => {
    if (visible) {
      drag.value = 0;
      setText(caption);
      checkAccess();
    } else {
      setSelected([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ---------- действия ----------
  // действие, для которого нужен системный экран, — только после полного закрытия шторки
  const closeThen = (f: () => void) => {
    afterHidden(() => setTimeout(f, Platform.OS === 'ios' ? 80 : 0));
    onClose();
  };

  const toggle = useCallback((a: Asset) => {
    haptic.select();
    setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]));
  }, []);

  const sendSelected = () => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    const list: PhotoSource[] = selected.map((id) => byId.get(id)).filter((a): a is Asset => !!a).map((a) => ({ uri: a.uri, width: a.width, height: a.height, assetId: a.id }));
    sendPhotos(chatId, list, text, replyTo);
    onSent();
    onClose();
  };

  async function camera() {
    if (Platform.OS === 'web') {
      toast('Камера работает в приложении на iPhone');
      return;
    }
    if (!(await ensurePermission('camera'))) return;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false }).catch((e) => {
      toast('Не удалось открыть камеру: ' + String((e as Error)?.message ?? e));
      return null;
    });
    if (r && !r.canceled) {
      sendPhotos(chatId, r.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })), text, replyTo);
      onSent();
    }
  }

  async function systemGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 1, exif: false }).catch(() => null);
    if (r && !r.canceled) {
      sendPhotos(chatId, r.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })), text, replyTo);
      onSent();
    }
  }

  async function file() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false }).catch(() => null);
    if (!r || r.canceled) return;
    for (const a of r.assets) {
      try {
        const rel = await importFile(a.uri, a.name, 'bin');
        actions.addNote({ chatId, kind: 'file', text: text.trim(), replyTo, file: { uri: rel, name: a.name, size: a.size ?? 0, mime: a.mimeType ?? undefined } });
        haptic.light();
        onSent();
      } catch (e) {
        toast('Не удалось добавить файл: ' + String((e as Error)?.message ?? e));
      }
    }
  }

  async function manageAccess() {
    try {
      const M = await import('expo-media-library/legacy');
      if (access === 'limited' && M.presentPermissionsPickerAsync) {
        await M.presentPermissionsPickerAsync();
        checkAccess();
      } else {
        const ok = await ensurePermission('photos');
        if (ok) checkAccess();
      }
    } catch {
      // ничего
    }
  }

  // ---------- шторка: тянется вниз за шапку, чтобы закрыть ----------
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        drag.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) closeRef.current();
        else drag.value = withSpring(0, SPRING);
      },
      onPanResponderTerminate: () => {
        drag.value = withSpring(0, SPRING);
      },
    }),
  ).current;

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * (panelH + 40) + drag.value }] }));

  const sheetBg = t.dark ? '#1C1C1E' : '#FFFFFF';
  const count = selected.length;

  const tab = (icon: IconName, label: string, color: string, onPress: () => void, active?: boolean) => (
    <PressScale onPress={onPress} scaleTo={0.88} feedback="select" style={{ alignItems: 'center', width: 76 }} accessibilityLabel={label}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: active === false ? 0.85 : 1 }}>
        <Icon name={icon} size={22} color="#fff" />
      </View>
      <Text style={{ color: active ? t.accent : t.sub, fontSize: 12, marginTop: 4, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </PressScale>
  );

  const header = (
    <View {...pan.panHandlers} style={{ paddingTop: 7, paddingBottom: 8 }}>
      <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.dark ? '#48484A' : '#D1D1D6', alignSelf: 'center' }} />
      <View style={{ height: 34, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
        <Pressable onPress={onClose} hitSlop={10} style={{ flex: 1 }}>
          <Text style={{ color: t.accent, fontSize: 17 }}>Отмена</Text>
        </Pressable>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{count ? `Выбрано: ${count}` : 'Недавние'}</Text>
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );

  const cameraCell = (
    <Pressable onPress={() => closeThen(camera)} style={{ width: size, height: size, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Камера">
      <Icon name="camera" size={32} color="#fff" />
    </Pressable>
  );

  let body;
  if (access === 'none') {
    body = (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {cameraCell}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
            <Text style={{ color: t.sub, fontSize: 14, textAlign: 'center' }}>
              {Platform.OS === 'web' ? 'Здесь появятся ваши фото в приложении на iPhone' : 'Разрешите доступ к фото, чтобы выбирать их прямо здесь'}
            </Text>
            {Platform.OS !== 'web' ? (
              <Pressable onPress={manageAccess} hitSlop={8} style={{ marginTop: 8 }}>
                <Text style={{ color: t.accent, fontSize: 15, fontWeight: '600' }}>Разрешить доступ</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  } else {
    body = (
      <FlatList<Asset | 'camera'>
        data={['camera', ...assets]}
        numColumns={3}
        keyExtractor={(a) => (a === 'camera' ? 'camera' : a.id)}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 8 }}
        ListHeaderComponent={
          <>
            {access === 'limited' ? (
              <Pressable onPress={manageAccess} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ flex: 1, color: t.sub, fontSize: 13 }}>Доступ только к выбранным фото</Text>
                <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Изменить</Text>
              </Pressable>
            ) : null}
          </>
        }
        // камера — первая клетка сетки, как в Telegram
        renderItem={({ item }) => (item === 'camera' ? cameraCell : <Cell a={item} size={size} n={selected.indexOf(item.id) + 1} accent={t.accent} onPress={toggle} />)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        removeClippedSubviews
        initialNumToRender={18}
        windowSize={7}
        extraData={selected}
      />
    );
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} onDismiss={onDismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View style={[{ height: panelH, backgroundColor: sheetBg, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' }, panel]}>
          {header}
          <View style={{ flex: 1 }}>{body}</View>
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: sheetBg }}>
            {count ? (
              <Animated.View key="send" entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8 }}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Добавить подпись…"
                  placeholderTextColor={t.sub}
                  multiline
                  keyboardAppearance={t.dark ? 'dark' : 'light'}
                  selectionColor={t.accent}
                  style={{ flex: 1, maxHeight: 100, minHeight: 36, borderRadius: 18, backgroundColor: t.dark ? '#2C2C2E' : '#F2F2F7', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, color: t.text, fontSize: 17 }}
                />
                <PressScale onPress={sendSelected} scaleTo={0.88} feedback="none" accessibilityLabel={`Отправить ${count}`} style={{ marginLeft: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="send" size={18} color="#fff" />
                  <View style={{ position: 'absolute', right: -4, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: sheetBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: t.accent, fontSize: 12, fontWeight: '700' }}>{count}</Text>
                  </View>
                </PressScale>
              </Animated.View>
            ) : (
              <Animated.View key="tabs" entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }}>
                {tab('photoFill', 'Галерея', '#3390EC', () => closeThen(systemGallery), true)}
                {tab('file', 'Файл', '#2AABEE', () => closeThen(file))}
                {tab('checklist', 'Список', '#4FAE4E', () => closeThen(onList))}
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
