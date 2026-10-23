import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveUri } from '../files';
import { dateShort } from '../format';
import { haptic } from '../haptics';
import { openChatAt } from '../navigation/ref';
import type { ScreenProps } from '../navigation/types';
import { toast } from '../runtime';
import { actions, useStore } from '../store';
import { showActions } from '../ui/dialogs';
import Icon from '../ui/Icon';

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

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
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
  const del = () => {
    haptic.warning();
    actions.deleteNotes([cur.id]);
    toast('Перемещено в «Недавно удалённые»');
    if (list.length <= 1) navigation.goBack();
    else setIndex((i) => Math.min(i, list.length - 2));
  };
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
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(n) => n.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable onPress={() => setChrome((c) => !c)} style={{ width, height: '100%', justifyContent: 'center' }}>
              <Image source={{ uri: resolveUri(item.photo!.uri) }} style={{ width, height: '100%' }} resizeMode="contain" />
            </Pressable>
          )}
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
            {cur.text ? <Text style={{ color: '#fff', fontSize: 15, paddingHorizontal: 16, paddingTop: 10 }}>{cur.text}</Text> : null}
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
