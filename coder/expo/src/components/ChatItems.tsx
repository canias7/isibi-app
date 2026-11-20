// The chat's rows: your messages, Coder's answers (markdown), its steps (compact), and the cards that wait for you.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../lib/config';
import { answerWords, permOptions, permWhat, PERM_TITLE, type Item, type Question, type Step } from '../lib/chat';
import { Markdown } from './Markdown';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const MARK: Record<string, string> = { run: '•', ok: '✓', bad: '✕', wait: '…' };

function Steps({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  const failed = steps.filter((x) => x.state === 'bad').length;
  const running = steps.some((x) => x.state === 'run');
  const head = steps.length === 1 ? steps[0].label : (running ? 'Working · ' : '') + steps.length + ' steps';
  return (
    <View style={s.steps}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={s.stepHead}>
        <Text style={s.stepHeadText} numberOfLines={1}>{head}</Text>
        {failed ? <Text style={s.bad}>{failed} failed</Text> : null}
        <Text style={s.caret}>{open ? '▾' : '›'}</Text>
      </Pressable>
      {open ? steps.map((x) => (
        <View key={x.id} style={s.step}>
          <Text style={[s.mark, x.state === 'bad' && s.bad, x.state === 'ok' && { color: COLORS.ok }]}>{MARK[x.state]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.stepText}>{x.label}</Text>
            {x.output ? <Text style={s.out} numberOfLines={6}>{x.output}</Text> : null}
          </View>
        </View>
      )) : null}
    </View>
  );
}

export interface CardHandlers {
  onPermission: (pid: string, choice: string) => void;
  onQuestion: (pid: string, choice: 'answers' | 'skip', answers?: { options: number[]; other: string }[]) => void;
  sent: Record<string, string>;
  autoOff?: boolean;
}

function PermissionCard({ item, h }: { item: Extract<Item, { kind: 'permission' }>; h: CardHandlers }) {
  const e = item.event;
  const sent = !!h.sent[e.pid];
  return (
    <View style={s.card} testID={'perm-' + e.pid}>
      <Text style={s.cardTitle}>{PERM_TITLE[e.tool] || 'Allow this?'}</Text>
      <Text style={[s.cardBody, e.tool === 'bash' && { fontFamily: mono, fontSize: 13 }]} numberOfLines={e.tool === 'plan' ? 40 : 8}>{permWhat(e)}</Text>
      {item.live ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          {permOptions(e, h.autoOff).map(([c, label]) => (
            <Pressable key={c} accessibilityRole="button" disabled={sent} onPress={() => h.onPermission(e.pid, c)}
              style={({ pressed }) => [s.opt, c === 'no' && s.optNo, (pressed || sent) && { opacity: 0.6 }]}>
              <Text style={[s.optText, c !== 'no' && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : item.answer ? <Text style={s.done}>{answerWords(item.answer)}</Text> : null}
    </View>
  );
}

function QuestionCard({ item, h }: { item: Extract<Item, { kind: 'question' }>; h: CardHandlers }) {
  const e = item.event;
  const pid = String(e.pid || '');
  const [picks, setPicks] = useState<string[][]>(() => item.questions.map((q) => (q.multi || !q.options.length ? [] : ['0'])));
  const [other, setOther] = useState<string[]>(() => item.questions.map(() => ''));
  const sent = !!(pid && h.sent[pid]);
  const toggle = (k: number, q: Question, v: string) => setPicks((p) => p.map((x, j) => (j !== k ? x : q.multi ? (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]) : [v])));
  const submit = () => h.onQuestion(pid, 'answers', item.questions.map((q, k) => ({
    options: picks[k].filter((v) => v !== '__other').map(Number),
    other: picks[k].includes('__other') ? other[k].trim() : '',
  })));
  return (
    <View style={s.card} testID={'ask-' + pid}>
      {item.questions.map((q, k) => (
        <View key={k} style={{ marginBottom: 8 }}>
          {q.header ? <Text style={s.header}>{q.header}</Text> : null}
          <Text style={s.cardTitle}>{q.text}</Text>
          {[...q.options.map((o, n) => ({ v: String(n), label: o.label, info: o.description })), { v: '__other', label: 'Other', info: '' }].map((o) => {
            const on = picks[k].includes(o.v);
            return (
              <Pressable key={o.v} accessibilityRole={q.multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: on }} disabled={!item.live || sent} onPress={() => toggle(k, q, o.v)} style={[s.choice, on && s.choiceOn]}>
                <Text style={s.radio}>{on ? (q.multi ? '☑' : '◉') : q.multi ? '☐' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.choiceText}>{o.label}</Text>
                  {o.info ? <Text style={s.choiceInfo}>{o.info}</Text> : null}
                  {o.v === '__other' && on && item.live ? (
                    <TextInput style={s.otherIn} placeholder="Type your own answer" value={other[k]} onChangeText={(t) => setOther((x) => x.map((y, j) => (j === k ? t : y)))} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {item.live && pid ? (
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" disabled={sent} onPress={() => h.onQuestion(pid, 'skip')} style={[s.opt, s.optNo, { paddingHorizontal: 18 }]}><Text style={s.optText}>Skip</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={sent} onPress={submit} style={[s.opt, { paddingHorizontal: 18 }, sent && { opacity: 0.6 }]}><Text style={[s.optText, { color: '#fff' }]}>Submit</Text></Pressable>
        </View>
      ) : item.answer ? <Text style={s.done}>{answerWords(item.answer)}</Text> : null}
    </View>
  );
}

export function ChatItem({ item, h }: { item: Item; h: CardHandlers }) {
  switch (item.kind) {
    case 'user': return <View style={s.userRow}><View style={s.bubble}><Text style={s.bubbleText}>{item.text}</Text></View></View>;
    case 'ai': return <View style={s.ai}><Markdown text={item.text} /></View>;
    case 'steps': return <Steps steps={item.steps} />;
    case 'error': return <Text style={s.err}>{item.text}</Text>;
    case 'todo': return (
      <View style={s.card}>
        <Text style={s.cardTitle}>Tasks · {item.items.filter((x) => x.status === 'done').length}/{item.items.length} done</Text>
        {item.items.map((x, i) => <Text key={i} style={[s.cardBody, x.status === 'done' && { textDecorationLine: 'line-through', color: COLORS.muted }]}>{x.status === 'done' ? '✓' : x.status === 'doing' || x.status === 'in_progress' ? '▸' : '○'} {x.text}</Text>)}
      </View>
    );
    case 'permission': return <PermissionCard item={item} h={h} />;
    case 'question': return <QuestionCard item={item} h={h} />;
  }
}

const s = StyleSheet.create({
  userRow: { alignItems: 'flex-end', marginVertical: 6 },
  bubble: { backgroundColor: COLORS.bubble, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 15, maxWidth: '88%' },
  bubbleText: { color: COLORS.ink, fontSize: 15, lineHeight: 21 },
  ai: { marginVertical: 6 },
  steps: { marginVertical: 3 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  stepHeadText: { color: COLORS.muted, fontSize: 14, flexShrink: 1 },
  caret: { color: COLORS.muted, fontSize: 14 },
  step: { flexDirection: 'row', gap: 8, paddingVertical: 3, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: COLORS.line, marginLeft: 2 },
  mark: { width: 14, color: COLORS.muted, fontSize: 13 },
  stepText: { color: COLORS.text, fontSize: 13.5 },
  out: { fontFamily: mono, fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  bad: { color: COLORS.error, fontSize: 13 },
  err: { color: COLORS.error, fontSize: 14, marginVertical: 6 },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 14, marginVertical: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  cardBody: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  header: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: COLORS.muted, backgroundColor: COLORS.bubble, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6, overflow: 'hidden' },
  opt: { backgroundColor: COLORS.ink, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  optNo: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line },
  optText: { color: COLORS.ink, fontSize: 14.5, fontWeight: '600' },
  done: { marginTop: 8, color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  choice: { flexDirection: 'row', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  choiceOn: { borderColor: COLORS.line, backgroundColor: COLORS.bg },
  radio: { fontSize: 16, color: COLORS.ink, width: 18 },
  choiceText: { fontSize: 14.5, color: COLORS.ink, fontWeight: '500' },
  choiceInfo: { fontSize: 13, color: COLORS.muted, marginTop: 1 },
  otherIn: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, padding: 8, marginTop: 6, fontSize: 14, backgroundColor: '#fff' },
});
