import { useSyncExternalStore } from 'react';

import { loadState, saveState } from './storage';

// ---------- Типы ----------

export type ChatIcon =
  | 'bulb' | 'cart' | 'briefcase' | 'book' | 'movie' | 'plane'
  | 'heart' | 'school' | 'music' | 'home' | 'barbell' | 'camera';

export type Wallpaper =
  | { kind: 'pattern'; index: number }
  | { kind: 'color'; color: string }
  | { kind: 'photo'; uri: string; tint?: string }; // tint — средний цвет фото, от него считается палитра

export type Chat = {
  id: string;
  title: string;
  icon: ChatIcon;
  color: string;
  photo?: string;
  createdAt: number;
  pinnedAt?: number;
  archived?: boolean;
  deletedAt?: number;
  wallpaper?: Wallpaper;
};

export type ListItem = { id: string; text: string; done: boolean };

export type TranscriptStatus = 'none' | 'queued' | 'running' | 'done' | 'error';

export type Voice = {
  uri: string;
  duration: number; // секунды
  wave: number[]; // 0..1, ~40 столбиков
  transcript?: string;
  status: TranscriptStatus;
  engine?: 'apple' | 'whisper';
  error?: string;
  expanded?: boolean; // расшифровка раскрыта (→A / A↑)
};

export type NoteKind = 'text' | 'photo' | 'file' | 'voice' | 'list';

export type Note = {
  id: string;
  chatId: string;
  kind: NoteKind;
  text: string; // текст / подпись к фото / заголовок списка
  createdAt: number;
  editedAt?: number;
  replyTo?: string;
  pinnedAt?: number;
  deletedAt?: number;
  photo?: { uri: string; width: number; height: number };
  file?: { uri: string; name: string; size: number; mime?: string };
  voice?: Voice;
  items?: ListItem[];
};

export type Settings = {
  theme: 'auto' | 'light' | 'dark';
  wallpaper: Wallpaper;
  fontSize: number;
  haptics: boolean;
  engine: 'apple' | 'whisper';
  language: 'auto' | 'ru' | 'en';
  autoTranscribe: boolean;
  upsellShown: boolean;
  permIntro: Record<string, boolean>; // показывали ли своё окно перед системным запросом
  whisperWanted?: boolean; // пользователь начал загрузку модели — докачиваем при запуске
};

export type State = {
  chats: Record<string, Chat>;
  notes: Record<string, Note>;
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  wallpaper: { kind: 'pattern', index: 0 },
  fontSize: 16,
  haptics: true,
  engine: 'apple',
  language: 'auto',
  autoTranscribe: true,
  upsellShown: false,
  permIntro: {},
};

// ---------- Мини-хранилище ----------

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((s: T) => T)) {
      state = typeof next === 'function' ? (next as (s: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const store = createStore<State>({ chats: {}, notes: {}, settings: DEFAULT_SETTINGS });

export function useStore<R>(selector: (s: State) => R): R {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}

let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

store.subscribe(() => {
  if (!loaded) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
});

export function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const s = store.get();
  saveState(JSON.stringify({ v: 1, chats: s.chats, notes: s.notes, settings: s.settings })).catch(() => {});
}

export async function hydrate() {
  const raw = await loadState();
  if (raw) {
    try {
      const data = JSON.parse(raw);
      store.set({
        chats: data.chats ?? {},
        notes: data.notes ?? {},
        settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
      });
    } catch {
      // повреждённый файл — начинаем с пустого
    }
  }
  loaded = true;
}

// ---------- Утилиты ----------

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const DAY = 24 * 3600 * 1000;
export const KEEP_DAYS = 30;

export function daysLeft(deletedAt: number): number {
  return Math.max(0, Math.ceil((deletedAt + KEEP_DAYS * DAY - Date.now()) / DAY));
}

// Кэш отсортированных заметок по чатам — пересчитывается при изменении notes
let cacheNotes: Record<string, Note> | null = null;
let cacheByChat = new Map<string, Note[]>();

function byChat(notes: Record<string, Note>) {
  if (notes !== cacheNotes) {
    cacheNotes = notes;
    cacheByChat = new Map();
    for (const n of Object.values(notes)) {
      if (n.deletedAt) continue;
      let arr = cacheByChat.get(n.chatId);
      if (!arr) cacheByChat.set(n.chatId, (arr = []));
      arr.push(n);
    }
    cacheByChat.forEach((arr) => arr.sort((a, b) => a.createdAt - b.createdAt));
  }
  return cacheByChat;
}

const EMPTY: Note[] = [];

export function chatNotes(s: State, chatId: string): Note[] {
  return byChat(s.notes).get(chatId) ?? EMPTY;
}

export function lastActivity(s: State, chat: Chat): number {
  const list = chatNotes(s, chat.id);
  return list.length ? list[list.length - 1].createdAt : chat.createdAt;
}

export function openItems(s: State, chatId: string): number {
  let n = 0;
  for (const note of chatNotes(s, chatId)) {
    if (note.kind === 'list') n += (note.items ?? []).filter((i) => !i.done).length;
  }
  return n;
}

// ---------- Действия ----------

function patchChat(id: string, patch: Partial<Chat>) {
  store.set((s) => (s.chats[id] ? { ...s, chats: { ...s.chats, [id]: { ...s.chats[id], ...patch } } } : s));
}

function patchNotes(ids: string[], fn: (n: Note) => Note) {
  store.set((s) => {
    const notes = { ...s.notes };
    for (const id of ids) if (notes[id]) notes[id] = fn(notes[id]);
    return { ...s, notes };
  });
}

export const actions = {
  createChat(c: Pick<Chat, 'title' | 'icon' | 'color' | 'photo'>): string {
    const id = uid();
    store.set((s) => ({ ...s, chats: { ...s.chats, [id]: { ...c, id, createdAt: Date.now() } } }));
    return id;
  },
  updateChat: patchChat,
  pinChat(id: string, pin: boolean) {
    patchChat(id, { pinnedAt: pin ? Date.now() : undefined });
  },
  archiveChat(id: string, archived: boolean) {
    patchChat(id, { archived, pinnedAt: archived ? undefined : store.get().chats[id]?.pinnedAt });
  },
  deleteChat(id: string) {
    patchChat(id, { deletedAt: Date.now(), pinnedAt: undefined });
  },
  restoreChat(id: string) {
    patchChat(id, { deletedAt: undefined });
  },
  clearChat(id: string) {
    const now = Date.now();
    patchNotes(chatNotes(store.get(), id).map((n) => n.id), (n) => ({ ...n, deletedAt: now, pinnedAt: undefined }));
  },

  addNote(n: Omit<Note, 'id' | 'createdAt'> & { createdAt?: number }): string {
    const id = uid();
    const note: Note = { createdAt: Date.now(), ...n, id };
    store.set((s) => ({ ...s, notes: { ...s.notes, [id]: note } }));
    return id;
  },
  updateNote(id: string, patch: Partial<Note>) {
    patchNotes([id], (n) => ({ ...n, ...patch }));
  },
  updateVoice(id: string, patch: Partial<Voice>) {
    patchNotes([id], (n) => (n.voice ? { ...n, voice: { ...n.voice, ...patch } } : n));
  },
  toggleItem(noteId: string, itemId: string) {
    patchNotes([noteId], (n) => ({
      ...n,
      items: (n.items ?? []).map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
    }));
  },
  pinNote(id: string, pin: boolean) {
    patchNotes([id], (n) => ({ ...n, pinnedAt: pin ? Date.now() : undefined }));
  },
  deleteNotes(ids: string[]) {
    const now = Date.now();
    patchNotes(ids, (n) => ({ ...n, deletedAt: now, pinnedAt: undefined }));
  },
  restoreNotes(ids: string[]) {
    patchNotes(ids, (n) => ({ ...n, deletedAt: undefined }));
  },
  forwardNotes(ids: string[], chatId: string) {
    const s = store.get();
    const src = ids.map((id) => s.notes[id]).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
    const now = Date.now();
    const notes = { ...s.notes };
    src.forEach((n, i) => {
      const id = uid();
      notes[id] = {
        ...n,
        id,
        chatId,
        createdAt: now + i,
        editedAt: undefined,
        replyTo: undefined,
        pinnedAt: undefined,
        items: n.items?.map((it) => ({ ...it, id: uid() })),
      };
    });
    store.set({ ...s, notes });
  },
  /** Удаление навсегда. Возвращает файлы, которые больше никем не используются. */
  purge(chatIds: string[], noteIds: string[]): string[] {
    const s = store.get();
    const chats = { ...s.chats };
    const notes = { ...s.notes };
    const dropChats = new Set(chatIds);
    for (const id of chatIds) delete chats[id];
    for (const n of Object.values(notes)) if (dropChats.has(n.chatId)) delete notes[n.id];
    for (const id of noteIds) delete notes[id];
    const used = new Set<string>();
    const collect = (n: Note) => {
      if (n.photo) used.add(n.photo.uri);
      if (n.file) used.add(n.file.uri);
      if (n.voice) used.add(n.voice.uri);
    };
    Object.values(notes).forEach(collect);
    Object.values(chats).forEach((c) => {
      if (c.photo) used.add(c.photo);
      if (c.wallpaper?.kind === 'photo') used.add(c.wallpaper.uri);
    });
    const orphan: string[] = [];
    for (const n of Object.values(s.notes)) {
      if (notes[n.id]) continue;
      for (const u of [n.photo?.uri, n.file?.uri, n.voice?.uri]) if (u && !used.has(u)) orphan.push(u);
    }
    for (const id of chatIds) {
      const c = s.chats[id];
      if (c?.photo && !used.has(c.photo)) orphan.push(c.photo);
      if (c?.wallpaper?.kind === 'photo' && !used.has(c.wallpaper.uri)) orphan.push(c.wallpaper.uri);
    }
    store.set({ ...s, chats, notes });
    return orphan;
  },
  /** Ищет просроченные (старше 30 дней) удалённые чаты и заметки. */
  expired(): { chatIds: string[]; noteIds: string[] } {
    const s = store.get();
    const limit = Date.now() - KEEP_DAYS * DAY;
    return {
      chatIds: Object.values(s.chats).filter((c) => c.deletedAt && c.deletedAt < limit).map((c) => c.id),
      noteIds: Object.values(s.notes).filter((n) => n.deletedAt && n.deletedAt < limit).map((n) => n.id),
    };
  },
  setSettings(patch: Partial<Settings>) {
    store.set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
};

/** Текст для превью в списке чатов и поиска */
export function notePreview(n: Note): string {
  switch (n.kind) {
    case 'photo':
      return n.text ? n.text : 'Фото';
    case 'file':
      return n.file?.name ?? 'Файл';
    case 'voice':
      return n.voice?.transcript ? `Голосовое: «${n.voice.transcript}»` : 'Голосовое';
    case 'list':
      return (
        (n.text ? n.text + ': ' : '') +
        (n.items ?? []).map((i) => (i.done ? '☑ ' : '☐ ') + i.text).join(' ')
      );
    default:
      return n.text;
  }
}

/** Текст, по которому ищет поиск */
export function noteSearchText(n: Note): string {
  return [n.text, n.file?.name, n.voice?.transcript, ...(n.items ?? []).map((i) => i.text)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ru|com|org|net|io|рф|app|dev|me|su|info)(?:\/[^\s<>"']*)?)/gi;

export function extractLinks(text: string): string[] {
  return Array.from(text.matchAll(URL_RE), (m) => m[1].replace(/[.,!?)]+$/, ''));
}
