import { memo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { resolveUri } from '../files';
import type { Wallpaper as W } from '../store';
import { WALLPAPERS } from '../theme';

// Простые «дудлы» как на обоях Telegram
const SHAPES: Record<string, string> = {
  heart: 'M0 5C-8 -1 -8 -8 -3 -8C-1 -8 0 -6 0 -5C0 -6 1 -8 3 -8C8 -8 8 -1 0 5Z',
  star: 'M0 -8L2.4 -2.5L8 -2.5L3.5 1L5 7L0 3.5L-5 7L-3.5 1L-8 -2.5L-2.4 -2.5Z',
  ring: 'M0 -6A6 6 0 1 1 0 6A6 6 0 1 1 0 -6Z',
  plus: 'M-6 0H6M0 -6V6',
  tri: 'M0 -6L6 5L-6 5Z',
  leaf: 'M-6 6C-6 -4 2 -7 7 -7C7 -2 4 6 -6 6ZM-6 6L3 -3',
  bubble: 'M-7 -5H7V4H-2L-6 7V4H-7Z',
  moon: 'M2 -7A7 7 0 1 0 7 2A5 5 0 1 1 2 -7Z',
  wave: 'M-8 0Q-6 -4 -4 0T0 0T4 0T8 0',
  note: 'M-2 5A2.5 2 0 1 1 -2 4.9M0.5 5V-7L6 -5',
  bolt: 'M1 -8L-5 1H0L-1 8L5 -1H0Z',
  cup: 'M-6 -4H4V3A4 4 0 0 1 0 7H-2A4 4 0 0 1 -6 3ZM4 -2H6A2 2 0 0 1 6 2H4',
};

const SETS: string[][] = [
  ['heart', 'star', 'bubble', 'leaf', 'note', 'ring'],
  ['bubble', 'plus', 'ring', 'wave', 'star', 'tri'],
  ['cup', 'leaf', 'heart', 'moon', 'ring', 'plus'],
  ['star', 'moon', 'bolt', 'ring', 'heart', 'wave'],
  ['bubble', 'star', 'note', 'bolt', 'ring', 'plus'],
  ['heart', 'leaf', 'cup', 'wave', 'tri', 'star'],
  ['wave', 'leaf', 'ring', 'bubble', 'moon', 'plus'],
  ['bolt', 'tri', 'ring', 'star', 'plus', 'note'],
];

const TILE = 120;

// Детерминированные позиции фигур внутри плитки
function tile(index: number) {
  let seed = index * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const set = SETS[index % SETS.length];
  const out: { d: string; x: number; y: number; r: number; s: number }[] = [];
  for (let i = 0; i < 7; i++) {
    out.push({
      d: SHAPES[set[i % set.length]],
      x: (i % 3) * 40 + 12 + rnd() * 18,
      y: Math.floor(i / 3) * 40 + 12 + rnd() * 18,
      r: Math.round(rnd() * 360),
      s: 0.9 + rnd() * 0.5,
    });
  }
  return out;
}

export function wallpaperBase(w: W, dark: boolean): string {
  if (w.kind === 'color') return w.color;
  if (w.kind === 'photo') return dark ? '#0E1621' : '#C9DDB8';
  const p = WALLPAPERS[w.index] ?? WALLPAPERS[0];
  return dark ? p.dark : p.light;
}

function Pattern({ index, dark, width, height }: { index: number; dark: boolean; width: number; height: number }) {
  const p = WALLPAPERS[index] ?? WALLPAPERS[0];
  const ink = dark ? p.inkDark : p.ink;
  const shapes = tile(index);
  const cols = Math.ceil(width / TILE) + 1;
  const rows = Math.ceil(height / TILE) + 1;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <G key={`${r}-${c}`} transform={`translate(${c * TILE + (r % 2) * 20} ${r * TILE})`}>
          {shapes.map((s, i) => (
            <Path
              key={i}
              d={s.d}
              transform={`translate(${s.x} ${s.y}) rotate(${s.r}) scale(${s.s})`}
              stroke={ink}
              strokeWidth={1.6}
              strokeOpacity={0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </G>,
      );
    }
  }
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      {tiles}
    </Svg>
  );
}

function WallpaperView({ wallpaper, dark }: { wallpaper: W; dark: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: wallpaperBase(wallpaper, dark) }]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {wallpaper.kind === 'photo' ? (
        <>
          <Image source={{ uri: resolveUri(wallpaper.uri) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {dark ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} /> : null}
        </>
      ) : wallpaper.kind === 'pattern' && size.w > 0 ? (
        <Pattern index={wallpaper.index} dark={dark} width={size.w} height={size.h} />
      ) : null}
    </View>
  );
}

export default memo(WallpaperView);
