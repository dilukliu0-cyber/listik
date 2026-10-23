import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

import type { ChatIcon } from '../store';

// Имя иконки → [SF Symbol для iOS, Ionicons для web]
const MAP = {
  edit: ['square.and.pencil', 'create-outline'],
  search: ['magnifyingglass', 'search'],
  archive: ['archivebox.fill', 'archive'],
  archiveLine: ['archivebox', 'archive-outline'],
  unarchive: ['tray.and.arrow.up', 'arrow-up-circle-outline'],
  pin: ['pin.fill', 'pin'],
  pinLine: ['pin', 'pin-outline'],
  unpin: ['pin.slash', 'pin-outline'],
  chats: ['bubble.left.and.bubble.right.fill', 'chatbubbles'],
  media: ['photo.on.rectangle', 'images'],
  settings: ['gearshape.fill', 'settings'],
  back: ['chevron.left', 'chevron-back'],
  chevron: ['chevron.right', 'chevron-forward'],
  chevronUp: ['chevron.up', 'chevron-up'],
  chevronDown: ['chevron.down', 'chevron-down'],
  paperclip: ['paperclip', 'attach'],
  mic: ['mic', 'mic-outline'],
  micFill: ['mic.fill', 'mic'],
  send: ['arrow.up', 'arrow-up'],
  play: ['play.fill', 'play'],
  pause: ['pause.fill', 'pause'],
  list: ['list.bullet', 'list'],
  reply: ['arrowshape.turn.up.left', 'arrow-undo-outline'],
  copy: ['doc.on.doc', 'copy-outline'],
  forward: ['arrowshape.turn.up.right', 'arrow-redo-outline'],
  select: ['checkmark.circle', 'checkmark-circle-outline'],
  trash: ['trash', 'trash-outline'],
  pencil: ['pencil', 'pencil'],
  close: ['xmark', 'close'],
  closeCircle: ['xmark.circle.fill', 'close-circle'],
  check: ['checkmark', 'checkmark'],
  checkCircle: ['checkmark.circle.fill', 'checkmark-circle'],
  circle: ['circle', 'ellipse-outline'],
  square: ['square', 'square-outline'],
  squareCheck: ['checkmark.square.fill', 'checkbox'],
  photo: ['photo', 'image-outline'],
  photoFill: ['photo.fill', 'image'],
  photoPlus: ['photo.badge.plus', 'images-outline'],
  camera: ['camera.fill', 'camera'],
  file: ['doc.fill', 'document'],
  checklist: ['checklist', 'list-circle'],
  link: ['link', 'link'],
  more: ['ellipsis', 'ellipsis-horizontal'],
  share: ['square.and.arrow.up', 'share-outline'],
  showInChat: ['text.bubble', 'chatbubble-ellipses-outline'],
  lock: ['lock.fill', 'lock-closed'],
  sparkles: ['sparkles', 'sparkles'],
  palette: ['paintpalette.fill', 'color-palette'],
  textSize: ['textformat.size', 'text'],
  haptic: ['hand.tap.fill', 'hand-left'],
  database: ['internaldrive.fill', 'server'],
  info: ['info.circle.fill', 'information-circle'],
  swatch: ['swatchpalette.fill', 'color-fill'],
  messagePlus: ['plus.bubble.fill', 'chatbubble-ellipses'],
  bubble: ['message.fill', 'chatbubble'],
  plus: ['plus', 'add'],
  plusCircle: ['plus.circle.fill', 'add-circle'],
  stop: ['stop.fill', 'stop'],
  warning: ['exclamationmark.triangle.fill', 'warning'],
  restore: ['arrow.uturn.backward', 'arrow-undo'],
  arrowDown: ['arrow.down', 'arrow-down'],
  // значки чатов
  bulb: ['lightbulb.fill', 'bulb'],
  cart: ['cart.fill', 'cart'],
  briefcase: ['briefcase.fill', 'briefcase'],
  book: ['book.fill', 'book'],
  movie: ['film.fill', 'film'],
  plane: ['airplane', 'airplane'],
  heart: ['heart.fill', 'heart'],
  school: ['graduationcap.fill', 'school'],
  music: ['music.note', 'musical-notes'],
  home: ['house.fill', 'home'],
  barbell: ['dumbbell.fill', 'barbell'],
} as const satisfies Record<string, readonly [string, keyof typeof Ionicons.glyphMap]>;

export type IconName = keyof typeof MAP | ChatIcon;

export const CHAT_ICONS: ChatIcon[] = [
  'bulb', 'cart', 'briefcase', 'book', 'movie', 'plane',
  'heart', 'school', 'music', 'home', 'barbell', 'camera',
];

type Props = { name: IconName; size?: number; color: string; style?: StyleProp<ViewStyle> };

export default function Icon({ name, size = 22, color, style }: Props) {
  const [sf, ion] = MAP[name];
  const fallback = <Ionicons name={ion} size={size} color={color} style={style as never} />;
  if (Platform.OS !== 'ios') return fallback;
  return (
    <SymbolView
      name={sf as SFSymbol}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
      fallback={fallback}
    />
  );
}
