import { Linking, Text, type TextStyle } from 'react-native';

import { URL_RE } from '../../store';

/** Текст с кликабельными ссылками */
export default function RichText({ text, style, linkColor }: { text: string; style: TextStyle; linkColor: string }) {
  const parts: { s: string; url?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    const raw = m[1].replace(/[.,!?)]+$/, '');
    if (i > last) parts.push({ s: text.slice(last, i) });
    parts.push({ s: raw, url: /^https?:/i.test(raw) ? raw : 'https://' + raw });
    last = i + raw.length;
  }
  if (last < text.length) parts.push({ s: text.slice(last) });
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.url ? (
          <Text key={i} style={{ color: linkColor, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(p.url!).catch(() => {})}>
            {p.s}
          </Text>
        ) : (
          p.s
        ),
      )}
    </Text>
  );
}
