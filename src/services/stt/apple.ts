// «Обычная» расшифровка — встроенное распознавание Apple (SFSpeechRecognizer) по аудиофайлу.
import { resolveUri } from '../../files';

type Lang = 'auto' | 'ru' | 'en';

type Mod = {
  start(o: object): void;
  abort(): void;
  supportsOnDeviceRecognition(): boolean;
  addListener(e: string, l: (ev: any) => void): { remove(): void };
};

function load(): Mod {
  try {
    const m = require('expo-speech-recognition').ExpoSpeechRecognitionModule as Mod | undefined;
    if (!m) throw new Error('модуль не найден');
    return m;
  } catch (e) {
    throw new Error('Распознавание речи недоступно: ' + String((e as Error)?.message ?? e));
  }
}

let busy = false;

export async function transcribeApple(uri: string, lang: Lang, durationSec: number, onProgress: (p: number) => void): Promise<string> {
  const mod = load();
  if (busy) mod.abort();
  busy = true;
  const locale = lang === 'en' ? 'en-US' : 'ru-RU';
  let onDevice = false;
  try {
    onDevice = mod.supportsOnDeviceRecognition();
  } catch {
    onDevice = false;
  }

  return new Promise<string>((resolve, reject) => {
    let finals: string[] = [];
    let partial = '';
    let settled = false;
    const started = Date.now();
    const expected = Math.max(2, durationSec * 0.6) * 1000;
    const tick = setInterval(() => onProgress(Math.min(95, Math.round(((Date.now() - started) / expected) * 100))), 250);
    const timeout = setTimeout(() => {
      try {
        mod.abort();
      } catch {
        // уже остановлено
      }
      finish();
    }, Math.max(30, durationSec * 3) * 1000);

    const subs = [
      mod.addListener('result', (ev) => {
        const t: string = ev?.results?.[0]?.transcript ?? '';
        if (ev?.isFinal) {
          const last = finals[finals.length - 1];
          // iOS иногда присылает накопленный текст целиком — не дублируем
          if (last && t.startsWith(last)) finals[finals.length - 1] = t;
          else if (t) finals.push(t);
          partial = '';
        } else {
          partial = t;
        }
      }),
      mod.addListener('error', (ev) => {
        if (ev?.error === 'no-speech' || ev?.error === 'aborted') finish();
        else fail(new Error(ev?.message || ev?.error || 'ошибка распознавания'));
      }),
      mod.addListener('end', () => finish()),
    ];

    function cleanup() {
      settled = true;
      busy = false;
      clearInterval(tick);
      clearTimeout(timeout);
      subs.forEach((s) => s.remove());
    }
    function finish() {
      if (settled) return;
      cleanup();
      const text = [...finals, partial].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      resolve(text ? text[0].toUpperCase() + text.slice(1) : '');
    }
    function fail(e: Error) {
      if (settled) return;
      cleanup();
      reject(e);
    }

    try {
      mod.start({
        lang: locale,
        interimResults: true,
        addsPunctuation: true,
        continuous: true,
        requiresOnDeviceRecognition: onDevice,
        audioSource: { uri: resolveUri(uri) },
      });
    } catch (e) {
      fail(e as Error);
    }
  });
}
