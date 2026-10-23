// Средний цвет фото для палитры обоев: фото сжимается до 8×8 и усредняется (без нативных зависимостей сверх Expo).
import { Buffer } from 'buffer';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import { resolveUri } from '../files';

export async function imageTint(uri: string): Promise<string | undefined> {
  try {
    const r = await manipulateAsync(resolveUri(uri), [{ resize: { width: 8, height: 8 } }], { format: SaveFormat.JPEG, compress: 0.9, base64: true });
    if (!r.base64) return undefined;
    const raw = r.base64.replace(/^data:[^,]*,/, '');
    const img = decode(Buffer.from(raw, 'base64'), { useTArray: true });
    let R = 0;
    let G = 0;
    let B = 0;
    let n = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      R += img.data[i];
      G += img.data[i + 1];
      B += img.data[i + 2];
      n++;
    }
    if (!n) return undefined;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    return '#' + hex(R) + hex(G) + hex(B);
  } catch {
    return undefined;
  }
}
