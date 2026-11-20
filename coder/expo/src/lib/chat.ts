// What the chat shows, worked out from Coder's events (the same events coder/public/coder.js draws).
import type { CoderEvent, Project } from './api';

export const MODES = [
  { id: 'auto', name: 'Auto', info: 'Coder handles permission decisions' },
  { id: 'acceptEdits', name: 'Accept edits', info: 'Automatically accept all file edits' },
  { id: 'plan', name: 'Plan', info: 'Create a plan before making changes' },
];
export const EFFORT_NAME: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high' };

export type StepState = 'run' | 'ok' | 'bad' | 'wait';
export interface Step { id: string; label: string; state: StepState; output: string }
export interface Question { header: string; text: string; multi: boolean; options: { label: string; description: string }[] }
export type Item =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'ai'; key: string; text: string }
  | { kind: 'steps'; key: string; steps: Step[] }
  | { kind: 'permission'; key: string; event: CoderEvent; live: boolean; answer: CoderEvent | null }
  | { kind: 'question'; key: string; event: CoderEvent; questions: Question[]; live: boolean; answer: CoderEvent | null }
  | { kind: 'error'; key: string; text: string }
  | { kind: 'todo'; key: string; items: { text: string; status: string }[] };

const short = (s: unknown, n = 140) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/** One step's line: "Read src/app.ts", "Ran npm test", … */
export function stepLabel(e: CoderEvent): string {
  const what = short(e.command ?? e.desc ?? e.path ?? (Array.isArray(e.lines) ? e.lines[0] : '') ?? '');
  if (e.verb) return short(e.verb + (what ? ' ' + what : ''));
  return what ? 'Ran ' + what : 'Ran a command';
}

export const questionsOf = (e: CoderEvent): Question[] =>
  (Array.isArray(e.questions) && e.questions.length ? e.questions : [e]).slice(0, 4).map((q: any) => ({
    text: String(q?.text || q?.question || ''),
    header: String(q?.header || ''),
    multi: q?.multi === true,
    options: (q?.options || []).map((o: any) => (typeof o === 'string' ? { label: o, description: '' } : { label: String(o?.label || ''), description: String(o?.description || '') })).filter((o: { label: string }) => o.label),
  }));

/** Is a card still waiting for the owner? (While the job runs, or its paused job waits on it.) */
const isLive = (e: CoderEvent, answer: CoderEvent | null, running: boolean, project?: Project | null) =>
  !answer && (running || !!(project && project.parked && project.parked.pid === e.pid));

export function buildItems(events: CoderEvent[], running: boolean, project?: Project | null): Item[] {
  const results: Record<string, CoderEvent> = {};
  const answers: Record<string, CoderEvent> = {};
  const last: Record<string, number> = {};
  events.forEach((e, i) => {
    if (e.type === 'result' && e.id) results[e.id] = e;
    if (e.type === 'permanswer' && e.pid) answers[e.pid] = e;
    if (e.type === 'bash' && e.id) last[e.id] = i;
  });
  const waiting = new Set(events.filter((x) => x.type === 'permission' && x.id && !answers[x.pid]).map((x) => x.id));
  let lastUser = -1;
  events.forEach((e, i) => { if (e.type === 'user') lastUser = i; });
  const out: Item[] = [];
  let group: Step[] = [];
  let todo: Item | null = null;
  const flush = () => {
    if (group.length) out.push({ kind: 'steps', key: 's' + group[0].id, steps: group });
    group = [];
    if (todo) { out.push(todo); todo = null; }
  };
  events.forEach((e, i) => {
    if (e.type === 'bash') {
      if (e.id && last[e.id] !== i) return;
      if (e.tool === 'setup' && !(results[e.id] && Number(results[e.id].code) !== 0)) return;
      const r = results[e.id];
      const state: StepState = r
        ? (Number(r.code) === 0 && r.denied !== true && r.ran !== false && !r.timedOut ? 'ok' : 'bad')
        : waiting.has(e.id) ? 'wait' : running && i > lastUser ? 'run' : 'ok';
      group.push({ id: String(e.id || i), label: stepLabel(e), state, output: r ? short(r.output ?? r.text ?? '', 2000) : '' });
      return;
    }
    if (e.type === 'result' || e.type === 'permanswer') return;
    if (e.type === 'text' && e.quiet === true) return;
    if (e.type === 'todo') { todo = { kind: 'todo', key: 't' + i, items: (e.items || []).map((x: any) => ({ text: String(x?.text || x?.content || ''), status: String(x?.status || '') })) }; if (!group.length) flush(); return; }
    const known = ['user', 'text', 'done', 'permission', 'question', 'error'];
    if (!known.includes(e.type)) return;
    flush();
    const key = e.type + i;
    if (e.type === 'user') out.push({ kind: 'user', key, text: String(e.text || '') });
    else if (e.type === 'text' || e.type === 'done') { if (String(e.text || '').trim()) out.push({ kind: 'ai', key, text: String(e.text) }); }
    else if (e.type === 'error') out.push({ kind: 'error', key, text: String(e.text || '') });
    else if (e.type === 'permission') { const a = answers[e.pid] || null; out.push({ kind: 'permission', key, event: e, answer: a, live: isLive(e, a, running, project) }); }
    else if (e.type === 'question') {
      const a = e.pid ? answers[e.pid] || null : null;
      const live = e.pid ? isLive(e, a, running, project) : !running && !events.slice(i + 1).some((x) => x.type === 'user');
      out.push({ kind: 'question', key, event: e, questions: questionsOf(e), answer: a, live });
    }
  });
  flush();
  return out;
}

/** A permission card's buttons, as on the web page (Claude Code's prompt). */
export function permOptions(e: CoderEvent, autoOff = false): [string, string][] {
  if (e.tool === 'plan' && e.withheld) return [['no', 'No, keep planning']];
  if (e.tool === 'plan') return ([['auto', 'Yes, and use auto mode'], ['acceptEdits', 'Yes, and accept edits'], ['no', 'No, keep planning']] as [string, string][]).filter(([c]) => !(autoOff && c === 'auto'));
  const o: [string, string][] = [['yes', 'Yes']];
  if (Array.isArray(e.rules) && e.rules.length) o.push(['always', "Yes, and don't ask again for " + e.rules.join(' and ')]);
  if (e.toAuto && !autoOff) o.push(['auto', 'Yes, and switch to auto mode']);
  o.push(['no', 'No']);
  return o;
}

export const PERM_TITLE: Record<string, string> = { bash: 'Bash command', write: 'Write file', edit: 'Edit file', read: 'Read file', web_fetch: 'Fetch', web_search: 'Web search', pull_request: 'Pull request', plan: "Coder's plan", connector: 'Connector' };

/** What a permission card asks about, in one or a few lines. */
export function permWhat(e: CoderEvent): string {
  if (e.tool === 'plan') return String(e.plan || 'Coder wants to leave plan mode.');
  if (e.tool === 'bash') return String(e.desc || (Array.isArray(e.lines) ? e.lines.join('\n') : '') || e.command || '');
  return String(e.path || e.url || e.what || e.desc || 'Allow it?');
}

export function answerWords(a: CoderEvent): string {
  const c = String(a.choice || '');
  if (['yes', 'always', 'auto', 'acceptEdits', 'answers', 'chat'].includes(c)) return '✓ Answered';
  if (c === 'skip') return 'Skipped';
  if (c === 'stop') return 'Stopped';
  return '✕ No';
}

/** The chat's mode now (a switch inside the running job counts until the job saves it). */
export function chatMode(project: Project | null | undefined, events: CoderEvent[], running: boolean, autoOff = false): string {
  const p = project || ({} as Project);
  let m = MODES.some((x) => x.id === p.mode) ? String(p.mode) : 'auto';
  const sw = running ? events.filter((e) => e.type === 'mode' && ['card', 'plan', 'autoOff', 'enterPlan'].includes(e.by)).at(-1) : null;
  if (sw && MODES.some((x) => x.id === sw.mode) && Number(sw.at || 0) > Number(p.modeAt || 0)) m = sw.mode;
  return autoOff && m === 'auto' ? 'acceptEdits' : m;
}

/** Merge new events from a live look, without drawing the message just sent twice. */
export function mergeEvents(current: CoderEvent[], fresh: CoderEvent[]): CoderEvent[] {
  const cur = current.slice();
  const add: CoderEvent[] = [];
  for (const e of fresh) {
    if (e.type === 'user') {
      const k = cur.findIndex((x) => x.local && x.text === e.text);
      if (k >= 0) { cur[k] = { ...cur[k], local: false }; continue; }
    }
    add.push(e);
  }
  return cur.concat(add);
}

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
