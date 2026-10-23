// «Точная» расшифровка — whisper.cpp (whisper.rn) на телефоне.
import { toPath } from '../../files';

type Lang = 'auto' | 'ru' | 'en';

type Ctx = {
  transcribe(path: string, o: object): { stop: () => Promise<void>; promise: Promise<{ result: string }> };
  release(): Promise<void>;
};

let ctx: Ctx | null = null;
let ctxPath = '';
let loading: Promise<Ctx> | null = null;

function lib(): { initWhisper(o: object): Promise<Ctx> } {
  try {
    return require('whisper.rn');
  } catch (e) {
    throw new Error('Whisper недоступен: ' + String((e as Error)?.message ?? e));
  }
}

async function context(modelUri: string): Promise<Ctx> {
  const path = toPath(modelUri);
  if (ctx && ctxPath === path) return ctx;
  if (loading) return loading;
  loading = (async () => {
    await releaseWhisper();
    const c = await lib().initWhisper({ filePath: path, useGpu: true });
    ctx = c;
    ctxPath = path;
    return c;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

const PROMPT_RU = 'Привет. Это голосовая заметка: со знаками препинания, запятыми и точками.';

export async function transcribeWhisper(modelUri: string, audioUri: string, lang: Lang, onProgress: (p: number) => void): Promise<string> {
  const c = await context(modelUri);
  const { promise } = c.transcribe(toPath(audioUri), {
    language: lang,
    translate: false,
    prompt: lang === 'en' ? undefined : PROMPT_RU,
    onProgress: (p: number) => onProgress(Math.round(p)),
  });
  const r = await promise;
  return (r?.result ?? '').replace(/\s+/g, ' ').trim();
}

export async function releaseWhisper() {
  const c = ctx;
  ctx = null;
  ctxPath = '';
  if (c) await c.release().catch(() => {});
}
