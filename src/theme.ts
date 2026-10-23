import { useColorScheme } from 'react-native';

import { useStore } from './store';

export type Theme = {
  dark: boolean;
  bg: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  search: string;
  bar: string;
  pinIcon: string;
  group: string;
  card: string;
  danger: string;
  green: string;
  // экран чата (палитра Telegram)
  chatBar: string;
  chatSub: string;
  out: string;
  outAccent: string;
  outSub: string;
  field: string;
  menu: string;
  quoteLine: string;
  overlay: string;
  chevron: string;
};

export const light: Theme = {
  dark: false,
  bg: '#FFFFFF',
  text: '#000000',
  sub: '#8E8E93',
  line: '#E5E5EA',
  accent: '#3390EC',
  search: '#EFEFF0',
  bar: '#F7F7F7',
  pinIcon: '#C7C7CC',
  group: '#EFEFF4',
  card: '#FFFFFF',
  danger: '#E5533D',
  green: '#34C759',
  chatBar: '#F7F7F7',
  chatSub: '#8E8E93',
  out: '#EFFDDE',
  outAccent: '#4FAE4E',
  outSub: '#5FAA59',
  field: '#FFFFFF',
  menu: '#F2F2F2',
  quoteLine: '#CFE3BF',
  overlay: 'rgba(0,0,0,0.35)',
  chevron: '#C7C7CC',
};

export const dark: Theme = {
  dark: true,
  bg: '#000000',
  text: '#FFFFFF',
  sub: '#8D8E93',
  line: '#262628',
  accent: '#3E88F7',
  search: '#1C1C1D',
  bar: '#121212',
  pinIcon: '#545458',
  group: '#000000',
  card: '#1C1C1D',
  danger: '#EB5545',
  green: '#30D158',
  chatBar: '#17212B',
  chatSub: '#6D7F8F',
  out: '#2B5278',
  outAccent: '#7EC8F7',
  outSub: '#7DA8D3',
  field: '#242F3D',
  menu: '#232E3C',
  quoteLine: '#3B6A96',
  overlay: 'rgba(0,0,0,0.5)',
  chevron: '#5A5A5E',
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useStore((s) => s.settings.theme);
  const isDark = mode === 'auto' ? system === 'dark' : mode === 'dark';
  return isDark ? dark : light;
}

// 8 цветов чата (макет 04)
export const CHAT_COLORS = ['#E2574C', '#F2A33A', '#4FAE4E', '#2AABEE', '#3390EC', '#8E6CEF', '#E05BA0', '#8E8E93'];

// 8 узоров обоев (макет 05); тёмный вариант — для тёмной темы
export const WALLPAPERS: { light: string; dark: string; ink: string; inkDark: string }[] = [
  { light: '#C9DDB8', dark: '#0E1621', ink: '#9DBB84', inkDark: '#1A2736' },
  { light: '#B9D3EE', dark: '#0F1B2A', ink: '#8DB2DA', inkDark: '#1B2B40' },
  { light: '#E8D5C0', dark: '#1F1913', ink: '#CFB597', inkDark: '#30271D' },
  { light: '#D5CDEB', dark: '#17142A', ink: '#B4A8D9', inkDark: '#262140' },
  { light: '#0E1621', dark: '#0E1621', ink: '#1A2736', inkDark: '#1A2736' },
  { light: '#F0E1D8', dark: '#211915', ink: '#DDC2B2', inkDark: '#33271F' },
  { light: '#CFE6E0', dark: '#0F1E1B', ink: '#A6CDC3', inkDark: '#1B312C' },
  { light: '#2B2B2B', dark: '#1A1A1A', ink: '#3A3A3A', inkDark: '#2A2A2A' },
];

// Цвета для однотонных обоев
export const SOLID_COLORS = ['#C9DDB8', '#B9D3EE', '#F3E6C6', '#F5D0D0', '#D9D2F0', '#CDE8E4', '#E5E5EA', '#0E1621', '#1F2A37', '#000000'];

export function isDarkColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 110;
}
