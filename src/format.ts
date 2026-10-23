const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad = (n: number) => (n < 10 ? '0' + n : String(n));

function dayStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const time = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Время в списке чатов: 12:04 / вчера / вт / 12.10 */
export function listTime(t: number): string {
  const today = dayStart(Date.now());
  const day = dayStart(t);
  const diff = Math.round((today - day) / 86400000);
  if (diff <= 0) return time(t);
  if (diff === 1) return 'вчера';
  if (diff < 7) return WEEK[new Date(t).getDay()];
  const d = new Date(t);
  const y = d.getFullYear() !== new Date().getFullYear() ? '.' + String(d.getFullYear()).slice(2) : '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}${y}`;
}

/** Разделитель дат в чате: Сегодня / Вчера / 12 октября */
export function dayLabel(t: number): string {
  const diff = Math.round((dayStart(Date.now()) - dayStart(t)) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  const d = new Date(t);
  const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}

export function sameDay(a: number, b: number) {
  return dayStart(a) === dayStart(b);
}

export function dateLong(t: number): string {
  const d = new Date(t);
  const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}

export function dateShort(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function dayAndTime(t: number): string {
  const label = dayLabel(t);
  return `${label}, ${time(t)}`;
}

export function monthKey(t: number) {
  const d = new Date(t);
  return d.getFullYear() * 100 + d.getMonth();
}

export function monthLabel(t: number) {
  const d = new Date(t);
  const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return MONTHS_NOM[d.getMonth()] + y;
}

export function duration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${Math.round(n / 1024 / 1024)} МБ`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
}

/** plural(5, 'заметка', 'заметки', 'заметок') */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const notesCount = (n: number) => `${n} ${plural(n, 'заметка', 'заметки', 'заметок')}`;

// Заметка только из эмодзи (1–3 штуки) показывается крупно, как в Telegram
let EMOJI_RE: RegExp | null = null;
try {
  EMOJI_RE = new RegExp('\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier}|\\u200D\\p{Extended_Pictographic}\\uFE0F?)*|\\p{Regional_Indicator}{2}', 'gu');
} catch {
  EMOJI_RE = null; // движок без \p{…} — без крупных эмодзи
}

/** Сколько эмодзи в тексте, если в нём нет ничего, кроме эмодзи (иначе 0) */
export function emojiOnlyCount(text: string): number {
  const s = text.trim();
  if (!EMOJI_RE || !s || s.length > 40) return 0;
  const found = s.match(EMOJI_RE);
  if (!found) return 0;
  if (s.replace(EMOJI_RE, '').replace(/\s/g, '') !== '') return 0;
  return found.length;
}
