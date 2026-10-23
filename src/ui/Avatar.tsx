import { Image, View } from 'react-native';

import { resolveUri } from '../files';
import type { Chat } from '../store';
import Icon from './Icon';

type Props = { chat: Pick<Chat, 'icon' | 'color' | 'photo'>; size: number };

export default function Avatar({ chat, size }: Props) {
  if (chat.photo) {
    return <Image source={{ uri: resolveUri(chat.photo) }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: chat.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={chat.icon} size={Math.round(size * 0.48)} color="#fff" />
    </View>
  );
}
