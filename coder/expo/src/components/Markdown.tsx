// A small markdown view for Coder's answers: headings, paragraphs, lists, code blocks, `code`, **bold**, *italic*, links.
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../lib/config';

export type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'li'; text: string; n?: string }
  | { t: 'code'; text: string }
  | { t: 'hr' };

export function parseBlocks(src: string): Block[] {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out: Block[] = [];
  let para: string[] = [];
  const end = () => { if (para.length) out.push({ t: 'p', text: para.join(' ') }); para = []; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*```/.test(l)) {
      end();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      out.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { end(); out.push({ t: 'h', level: m[1].length, text: m[2] }); continue; }
    if (/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(l)) { end(); out.push({ t: 'hr' }); continue; }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(l))) { end(); out.push({ t: 'li', text: m[1] }); continue; }
    if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(l))) { end(); out.push({ t: 'li', text: m[2], n: m[1] }); continue; }
    if (!l.trim()) { end(); continue; }
    para.push(l.trim());
  }
  end();
  return out;
}

export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean; url?: string };
export function parseInline(s: string): Span[] {
  const out: Span[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const x = m[0];
    if (m[1]) out.push({ text: x.slice(1, -1), code: true });
    else if (m[2]) out.push({ text: x.slice(2, -2), bold: true });
    else if (m[3]) { const k = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(x)!; out.push({ text: k[1], url: k[2] }); }
    else out.push({ text: x.slice(1, -1), italic: true });
    last = m.index + x.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function Inline({ text, style }: { text: string; style?: object }) {
  return (
    <Text style={[st.p, style]}>
      {parseInline(text).map((s, i) => (
        <Text
          key={i}
          style={[s.bold && st.b, s.italic && st.i, s.code && st.code, s.url && st.a]}
          onPress={s.url && /^https?:\/\//.test(s.url) ? () => Linking.openURL(s.url!) : undefined}
        >{s.text}</Text>
      ))}
    </Text>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <View>
      {parseBlocks(text).map((b, i) => {
        if (b.t === 'h') return <Inline key={i} text={b.text} style={[st.h, b.level <= 2 && st.h1]} />;
        if (b.t === 'code') return <View key={i} style={st.pre}><Text style={st.preText} selectable>{b.text}</Text></View>;
        if (b.t === 'hr') return <View key={i} style={st.hr} />;
        if (b.t === 'li') return (
          <View key={i} style={st.li}>
            <Text style={st.bullet}>{b.n ? b.n + '.' : '•'}</Text>
            <View style={{ flex: 1 }}><Inline text={b.text} /></View>
          </View>
        );
        return <Inline key={i} text={b.text} />;
      })}
    </View>
  );
}

const st = StyleSheet.create({
  p: { color: COLORS.ink, fontSize: 15, lineHeight: 22, marginVertical: 3 },
  h: { fontWeight: '700', fontSize: 16, marginTop: 8 },
  h1: { fontSize: 18 },
  b: { fontWeight: '700' },
  i: { fontStyle: 'italic' },
  code: { fontFamily: mono, fontSize: 13, backgroundColor: COLORS.code },
  a: { textDecorationLine: 'underline' },
  pre: { backgroundColor: COLORS.code, borderRadius: 8, padding: 10, marginVertical: 6 },
  preText: { fontFamily: mono, fontSize: 12.5, color: COLORS.ink },
  li: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginVertical: 3, minWidth: 14 },
  hr: { height: 1, backgroundColor: COLORS.line, marginVertical: 10 },
});
