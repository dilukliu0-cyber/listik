import { useColorScheme } from 'react-native';

import { useMemo } from 'react';

import { useStore, type Wallpaper } from './store';

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
  outText: string; // текст в пузыре заметки
  link: string; // ссылки в пузыре
  outAccent: string;
  outSub: string;
  field: string;
  menu: string;
  quoteLine: string;
  overlay: string;
  chevron: string;
  datePill: string; // плашка даты и «Здесь пока пусто» поверх обоев
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
  outText: '#000000',
  link: '#3390EC',
  outAccent: '#4FAE4E',
  outSub: '#5FAA59',
  field: '#FFFFFF',
  menu: '#F2F2F2',
  quoteLine: '#CFE3BF',
  overlay: 'rgba(0,0,0,0.35)',
  chevron: '#C7C7CC',
  datePill: 'rgba(0,0,0,0.22)',
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
  outText: '#FFFFFF',
  link: '#7EC8F7',
  outAccent: '#7EC8F7',
  outSub: '#7DA8D3',
  field: '#242F3D',
  menu: '#232E3C',
  quoteLine: '#3B6A96',
  overlay: 'rgba(0,0,0,0.5)',
  chevron: '#5A5A5E',
  datePill: 'rgba(0,0,0,0.35)',
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

// ---------- Палитра под обои (как темы Telegram) ----------

type HSL = { h: number; s: number; l: number };

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function toHsl(hex: string): HSL {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hsl(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Чёрный или белый — что читается лучше на фоне */
function readable(bg: string, prefer: string): string {
  if (contrast(prefer, bg) >= 4.5) return prefer;
  return contrast('#000000', bg) >= contrast('#FFFFFF', bg) ? '#000000' : '#FFFFFF';
}

/** Цвет, от которого считается палитра: узор — его светлый вариант, своё фото — средний цвет снимка */
function seedColor(w: Wallpaper): string {
  if (w.kind === 'color') return w.color;
  if (w.kind === 'photo') return w.tint ?? '#C9DDB8';
  return (WALLPAPERS[w.index] ?? WALLPAPERS[0]).light;
}

/** Обои тёмные (в текущей теме)? Тогда пузыри — в тёмном варианте. */
function wallpaperIsDark(w: Wallpaper, dark: boolean): boolean {
  if (dark) return true;
  if (w.kind === 'pattern') return isDarkColor((WALLPAPERS[w.index] ?? WALLPAPERS[0]).light);
  return isDarkColor(seedColor(w));
}

function wallpaperBaseColor(w: Wallpaper, dark: boolean): string {
  if (w.kind === 'color') return w.color;
  if (w.kind === 'photo') return dark ? mix(seedColor(w), '#000000', 0.6) : seedColor(w);
  const p = WALLPAPERS[w.index] ?? WALLPAPERS[0];
  return dark ? p.dark : p.light;
}

const cache = new Map<string, Theme>();

/**
 * Палитра экрана чата под обои: пузыри, их текст, акцент (кнопки, ссылки, →A, закреп, галочки, микрофон),
 * шапка и поле ввода с оттенком обоев, плашки дат. Текст пузырей проверяется на контраст.
 */
export function chatTheme(base: Theme, w: Wallpaper): Theme {
  const key = (base.dark ? 'd' : 'l') + JSON.stringify(w);
  const hit = cache.get(key);
  if (hit) return hit;
  // классические обои Telegram — родная палитра без изменений
  if (w.kind === 'pattern' && w.index === 0) {
    cache.set(key, base);
    return base;
  }
  const seed = toHsl(seedColor(w));
  const gray = seed.s < 12;
  const h = seed.h;
  const wpDark = wallpaperIsDark(w, base.dark);
  const wpBase = wallpaperBaseColor(w, base.dark);
  const blue = base.accent;
  const sat = gray ? 0 : Math.max(45, Math.min(75, seed.s + 25));

  let p: Partial<Theme>;
  if (!wpDark) {
    const out = gray ? '#FFFFFF' : hsl(h, Math.max(50, sat), 93);
    const outAccent = gray ? blue : hsl(h, sat, 38);
    p = {
      accent: gray ? blue : hsl(h, sat, 44),
      out,
      outText: readable(out, '#000000'),
      link: gray ? blue : hsl(h, sat, 40),
      outAccent,
      outSub: gray ? '#8E8E93' : hsl(h, sat * 0.6, 45),
      quoteLine: mix(out, outAccent, 0.35),
      chatBar: mix(base.chatBar, wpBase, 0.22),
      chatSub: gray ? base.chatSub : hsl(h, 15, 50),
      field: mix('#FFFFFF', wpBase, 0.08),
      datePill: gray ? 'rgba(0,0,0,0.22)' : hsl(h, sat * 0.5, 30) + '59',
    };
  } else {
    const out = gray ? '#3A3A3C' : hsl(h, Math.min(55, sat), 30);
    const outAccent = gray ? '#7EC8F7' : hsl(h, 75, 74);
    const bar = base.dark ? base.chatBar : '#17212B';
    p = {
      accent: gray ? base.accent : hsl(h, 75, base.dark ? 62 : 50),
      out,
      outText: readable(out, '#FFFFFF'),
      link: outAccent,
      outAccent,
      outSub: gray ? '#A8A8AD' : hsl(h, 40, 72),
      quoteLine: mix(out, outAccent, 0.35),
      datePill: 'rgba(0,0,0,0.35)',
    };
    if (base.dark) {
      p.chatBar = mix(bar, wpBase, 0.35);
      p.field = mix(base.field, wpBase, 0.3);
      p.menu = mix(base.menu, wpBase, 0.25);
      p.chatSub = gray ? base.chatSub : hsl(h, 18, 58);
    }
  }
  const theme = { ...base, ...p };
  cache.set(key, theme);
  return theme;
}

/** Тема экрана чата: обои чата (если заданы) или общие из настроек */
export function useChatTheme(wallpaper?: Wallpaper): Theme {
  const base = useTheme();
  const global = useStore((s) => s.settings.wallpaper);
  const w = wallpaper ?? global;
  return useMemo(() => chatTheme(base, w), [base, w]);
}
