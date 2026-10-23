// Оформление текста заметок, как в Telegram: **жирный**, __курсив__, ++подчёркнутый++, ~~зачёркнутый~~,
// `моноширинный`, ||скрытый|| и [ссылка](https://…). В данных хранится текст с метками.

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'mono' | 'spoiler';

export const MARKS: Record<Mark, string> = {
  bold: '**',
  italic: '__',
  underline: '++',
  strike: '~~',
  spoiler: '||',
  mono: '`',
};

const ORDER: Mark[] = ['bold', 'italic', 'underline', 'strike', 'spoiler', 'mono'];

export type Segment = { s: string; url?: string } & Partial<Record<Mark, true>>;

const LINK_RE = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/y;

/** Разбор текста на куски с оформлением. Метки без пары остаются обычным текстом. */
export function parse(text: string, style: Partial<Record<Mark, true>> = {}): Segment[] {
  const out: Segment[] = [];
  let plain = '';
  const flush = () => {
    if (plain) out.push({ ...style, s: plain });
    plain = '';
  };
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      LINK_RE.lastIndex = i;
      const m = LINK_RE.exec(text);
      if (m) {
        flush();
        const url = /^https?:/i.test(m[2]) ? m[2] : 'https://' + m[2];
        for (const seg of parse(m[1], style)) out.push({ ...seg, url });
        i += m[0].length;
        continue;
      }
    }
    let matched = false;
    if (!style.mono) {
      for (const mark of ORDER) {
        const tok = MARKS[mark];
        if (!text.startsWith(tok, i)) continue;
        const end = text.indexOf(tok, i + tok.length);
        if (end <= i + tok.length) continue; // нет пары или пусто внутри
        const inner = text.slice(i + tok.length, end);
        if (/^\s|\s$/.test(inner) && mark !== 'mono') continue; // «** a**» — не оформление
        flush();
        const st = { ...style, [mark]: true as const };
        if (mark === 'mono') out.push({ ...st, s: inner });
        else out.push(...parse(inner, st));
        i = end + tok.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    plain += text[i];
    i++;
  }
  flush();
  return out;
}

/** Текст без меток — для превью, поиска и копирования */
export function plainText(text: string): string {
  if (!/[*_+~|`[]/.test(text)) return text;
  return parse(text)
    .map((p) => p.s)
    .join('');
}

export type Sel = { start: number; end: number };

/** Обернуть выделение меткой; если оно уже обёрнуто этой меткой — снять */
export function toggleMark(text: string, sel: Sel, mark: Mark): { text: string; sel: Sel } {
  const tok = MARKS[mark];
  const { start, end } = sel;
  if (start >= end) return { text, sel };
  const before = text.slice(0, start);
  const body = text.slice(start, end);
  const after = text.slice(end);
  if (before.endsWith(tok) && after.startsWith(tok)) {
    return { text: before.slice(0, -tok.length) + body + after.slice(tok.length), sel: { start: start - tok.length, end: end - tok.length } };
  }
  if (body.startsWith(tok) && body.endsWith(tok) && body.length > tok.length * 2) {
    const inner = body.slice(tok.length, -tok.length);
    return { text: before + inner + after, sel: { start, end: start + inner.length } };
  }
  // пробелы по краям выделения оставляем снаружи, как Telegram
  const lead = body.match(/^\s*/)![0];
  const trail = body.match(/\s*$/)![0];
  const core = body.slice(lead.length, body.length - trail.length);
  if (!core) return { text, sel };
  const next = before + lead + tok + core + tok + trail + after;
  const s = start + lead.length + tok.length;
  return { text: next, sel: { start: s, end: s + core.length } };
}

/** Сделать выделение ссылкой */
export function makeLink(text: string, sel: Sel, url: string): { text: string; sel: Sel } {
  const u = url.trim();
  if (!u || sel.start >= sel.end) return { text, sel };
  const body = text.slice(sel.start, sel.end);
  const link = `[${body}](${/^https?:\/\//i.test(u) ? u : 'https://' + u})`;
  const next = text.slice(0, sel.start) + link + text.slice(sel.end);
  const caret = sel.start + link.length;
  return { text: next, sel: { start: caret, end: caret } };
}
