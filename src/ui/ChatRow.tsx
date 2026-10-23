import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listTime } from '../format';
import { chatNotes, lastActivity, notePreview, openItems, useStore, type Chat } from '../store';
import { useTheme } from '../theme';
import Avatar from './Avatar';
import Icon from './Icon';

type Props = {
  chat: Chat;
  onPress: () => void;
  onLongPress?: () => void;
  selecting?: boolean;
  selected?: boolean;
};

function ChatRow({ chat, onPress, onLongPress, selecting, selected }: Props) {
  const t = useTheme();
  const last = useStore((s) => {
    const list = chatNotes(s, chat.id);
    return list[list.length - 1];
  });
  const time = useStore((s) => lastActivity(s, chat));
  const open = useStore((s) => openItems(s, chat.id));
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={({ pressed }) => ({ backgroundColor: pressed ? t.line : t.bg })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
        {selecting ? (
          <View style={{ marginRight: 10 }}>
            <Icon name={selected ? 'checkCircle' : 'circle'} size={24} color={selected ? t.accent : t.chevron} />
          </View>
        ) : null}
        <View style={{ paddingVertical: 8, marginRight: 12 }}>
          <Avatar chat={chat} size={58} />
        </View>
        <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'center', paddingRight: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 17, fontWeight: '600' }}>
              {chat.title}
            </Text>
            <Text style={{ color: t.sub, fontSize: 14, marginLeft: 8 }}>{listTime(time)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: t.sub, fontSize: 15 }}>
              {last ? notePreview(last) : 'Нет заметок'}
            </Text>
            {open > 0 ? (
              <View style={{ backgroundColor: t.accent, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{open}</Text>
              </View>
            ) : chat.pinnedAt ? (
              <Icon name="pin" size={15} color={t.pinIcon} style={{ marginLeft: 6, transform: [{ rotate: '45deg' }] }} />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default memo(ChatRow);
