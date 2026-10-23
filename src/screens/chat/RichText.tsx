import { useState } from 'react';
import { Linking, Platform, Text, type TextStyle } from 'react-native';

import { haptic } from '../../haptics';
import { parse, type Segment } from '../../markup';
import { URL_RE } from '../../store';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

/** Обычные куски текста ещё делим на автоссылки */
function withAutoLinks(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const seg of segs) {
    if (seg.url || seg.mono) {
      out.push(seg);
      continue;
    }
    let last = 0;
    for (const m of seg.s.matchAll(URL_RE)) {
      const i = m.index ?? 0;
      const raw = m[1].replace(/[.,!?)]+$/, '');
      if (i > last) out.push({ ...seg, s: seg.s.slice(last, i) });
      out.push({ ...seg, s: raw, url: /^https?:/i.test(raw) ? raw : 'https://' + raw });
      last = i + raw.length;
    }
    if (last < seg.s.length) out.push({ ...seg, s: seg.s.slice(last) });
  }
  return out;
}

/** Текст заметки с оформлением как в Telegram: жирный, курсив, моно, скрытый (тап — показать), ссылки */
export default function RichText({ text, style, linkColor }: { text: string; style: TextStyle; linkColor: string }) {
  const [shown, setShown] = useState(false);
  const segs = withAutoLinks(parse(text));
  const color = (style.color as string) ?? '#000';
  return (
    <Text style={style}>
      {segs.map((p, i) => {
        const deco = [p.underline || p.url ? 'underline' : '', p.strike ? 'line-through' : ''].filter(Boolean).join(' ') as TextStyle['textDecorationLine'];
        const st: TextStyle = {
          fontWeight: p.bold ? '700' : undefined,
          fontStyle: p.italic ? 'italic' : undefined,
          textDecorationLine: deco || undefined,
          fontFamily: p.mono ? MONO : undefined,
          fontSize: p.mono && typeof style.fontSize === 'number' ? style.fontSize - 1 : undefined,
          color: p.url ? linkColor : undefined,
        };
        if (p.spoiler && !shown) {
          // скрытый текст: закрашен, тап — показать все скрытые куски заметки
          return (
            <Text
              key={i}
              suppressHighlighting
              onPress={() => {
                haptic.light();
                setShown(true);
              }}
              style={[st, { color: 'transparent', backgroundColor: color + '40', textDecorationLine: 'none' }]}
            >
              {p.s}
            </Text>
          );
        }
        return (
          <Text key={i} style={st} onPress={p.url ? () => open(p.url!) : undefined} suppressHighlighting={!p.url}>
            {p.s}
          </Text>
        );
      })}
    </Text>
  );
}
