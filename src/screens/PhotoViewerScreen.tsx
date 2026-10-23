import { Image as XImage } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveUri } from '../files';
import { dateShort } from '../format';
import { haptic } from '../haptics';
import { openChatAt } from '../navigation/ref';
import type { ScreenProps } from '../navigation/types';
import { toast } from '../runtime';
import { actions, useStore } from '../store';
import { confirmDeleteNotes, deleteNotesWithUndo, showActions } from '../ui/dialogs';
import Icon from '../ui/Icon';
import RichText from './chat/RichText';

/** Страница с фото: щипок и двойной тап — увеличение (iOS), один тап — показать/скрыть панели */
function ZoomPage({ uri, width, onTap, onZoom }: { uri: string; width: number; onTap: () => void; onZoom: (zoomed: boolean) => void }) {
  const ref = useRef<ScrollView>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomed = useRef(false);
  const [box, setBox] = useState({ w: width, h: 0 });

  const handleTap = (x: number, y: number) => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      // двойной тап: увеличить к месту касания или вернуть как было
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const sv = ref.current as unknown as { scrollResponderZoomTo?: (r: { x: number; y: number; width: number; height: number; animated?: boolean }) => void };
      if (zoomed.current) sv?.scrollResponderZoomTo?.({ x: 0, y: 0, width: box.w, height: box.h, animated: true });
      else sv?.scrollResponderZoomTo?.({ x: x - box.w / 6, y: y - box.h / 6, width: box.w / 3, height: box.h / 3, animated: true });
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(onTap, 280);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ width }}
      contentContainerStyle={{ width, flexGrow: 1 }}
      maximumZoomScale={4}
      minimumZoomScale={1}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onScroll={(e) => {
        const z = (e.nativeEvent.zoomScale ?? 1) > 1.01;
        if (z !== zoomed.current) {
          zoomed.current = z;
          onZoom(z);
        }
      }}
    >
      <Pressable onPress={(e) => handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={{ width, flex: 1, justifyContent: 'center' }}>
        <XImage source={{ uri }} style={{ width, height: '100%' }} contentFit="contain" transition={120} />
      </Pressable>
    </ScrollView>
  );
}

export default function PhotoViewerScreen({ route, navigation }: ScreenProps<'PhotoViewer'>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const notes = useStore((s) => s.notes);
  const chats = useStore((s) => s.chats);
  const [ids] = useState(route.params.ids);
  const list = useMemo(() => ids.map((id) => notes[id]).filter((n) => n && !n.deletedAt && n.photo), [ids, notes]);
  const [index, setIndex] = useState(Math.min(route.params.index, Math.max(0, list.length - 1)));
  const y = useRef(new Animated.Value(0)).current;
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const zoomedRef = useRef(false);
  zoomedRef.current = zoomed;

  // смахнуть вверх/вниз — закрыть (не когда фото увеличено)
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !zoomedRef.current && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => y.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) > 120 || Math.abs(g.vy) > 1.2) {
          Animated.timing(y, { toValue: g.dy > 0 ? height : -height, duration: 180, useNativeDriver: true }).start(() => navigation.goBack());
        } else {
          Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const cur = list[Math.min(index, list.length - 1)];
  if (!cur) {
    return (
      <Pressable style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }} onPress={() => navigation.goBack()}>
        <Text style={{ color: '#fff' }}>Фото удалено</Text>
      </Pressable>
    );
  }
  const chat = chats[cur.chatId];
  const bgOpacity = y.interpolate({ inputRange: [-300, 0, 300], outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' });

  const share = async () => {
    if (await Sharing.isAvailableAsync()) Sharing.shareAsync(resolveUri(cur.photo!.uri)).catch(() => {});
    else toast('Поделиться можно в приложении на iPhone');
  };
  const del = () =>
    confirmDeleteNotes([cur.id], (ids) => {
      deleteNotesWithUndo(ids);
      if (list.length <= 1) navigation.goBack();
      else setIndex((i) => Math.min(i, list.length - 2));
    });
  const showInChat = () => {
    navigation.goBack();
    setTimeout(() => openChatAt(cur.chatId, cur.id), 50);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: bgOpacity }} />
      <Animated.View style={{ flex: 1, transform: [{ translateY: y }] }} {...pan.panHandlers}>
        <FlatList
          data={list}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(n) => n.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <ZoomPage uri={resolveUri(item.photo!.uri)} width={width} onTap={() => setChrome((c) => !c)} onZoom={setZoomed} />}
        />
      </Animated.View>
      {chrome ? (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 4, paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
              <Icon name="close" size={24} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 17 }}>
                {index + 1} из {list.length}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {chat?.title} · {dateShort(cur.createdAt)}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() =>
                showActions(undefined, [
                  { label: 'Поделиться', onPress: share },
                  { label: 'Показать в чате', onPress: showInChat },
                  { label: 'Удалить', destructive: true, onPress: del },
                ])
              }
            >
              <Icon name="more" size={24} color="#fff" />
            </Pressable>
          </View>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 8, backgroundColor: 'rgba(0,0,0,0.45)' }}>
            {cur.text ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <RichText text={cur.text} style={{ color: '#FFFFFF', fontSize: 15 }} linkColor="#7EC8F7" />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14 }}>
              <Pressable onPress={share} hitSlop={10}>
                <Icon name="share" size={24} color="#fff" />
              </Pressable>
              <Pressable onPress={showInChat} hitSlop={10}>
                <Icon name="showInChat" size={24} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.medium();
                  actions.pinNote(cur.id, !cur.pinnedAt);
                  toast(cur.pinnedAt ? 'Откреплено' : 'Закреплено');
                }}
                hitSlop={10}
              >
                <Icon name={cur.pinnedAt ? 'pin' : 'pinLine'} size={24} color="#fff" />
              </Pressable>
              <Pressable onPress={del} hitSlop={10}>
                <Icon name="trash" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
