import { buildItems, chatMode, mergeEvents, permOptions } from '../lib/chat';
import { parseBlocks, parseInline } from '../components/Markdown';

const EVENTS = [
  { type: 'user', text: 'fix the bug' },
  { type: 'bash', id: 'c1', verb: 'Read', command: 'src/a.ts' },
  { type: 'result', id: 'c1', code: 0 },
  { type: 'bash', id: 'c2', command: 'npm test' },
  { type: 'result', id: 'c2', code: 1, output: '1 failed' },
  { type: 'text', text: 'Found it.' },
  { type: 'permission', pid: 'k1', id: 'c3', tool: 'bash', lines: ['rm -rf dist'], rules: ['Bash(rm:*)'] },
  { type: 'bash', id: 'c3', command: 'rm -rf dist' },
];

test('steps in a row are one compact group, with their states', () => {
  const items = buildItems(EVENTS, true);
  expect(items.map((x) => x.kind)).toEqual(['user', 'steps', 'ai', 'permission', 'steps']);
  const g = items[1] as any;
  expect(g.steps.map((x: any) => [x.label, x.state])).toEqual([['Read src/a.ts', 'ok'], ['Ran npm test', 'bad']]);
  expect((items[4] as any).steps[0].state).toBe('wait');
  expect((items[3] as any).live).toBe(true);
});

test('an answered card is not live and says how it ended', () => {
  const items = buildItems([...EVENTS, { type: 'permanswer', pid: 'k1', choice: 'no' }], true);
  const p = items.find((x) => x.kind === 'permission') as any;
  expect(p.live).toBe(false);
  expect(p.answer.choice).toBe('no');
});

test('permission buttons follow the card, as on the web page', () => {
  expect(permOptions(EVENTS[6]).map((x) => x[0])).toEqual(['yes', 'always', 'no']);
  expect(permOptions({ type: 'permission', tool: 'plan' }, true).map((x) => x[0])).toEqual(['acceptEdits', 'no']);
});

test('the mode, and a switch inside the running job', () => {
  expect(chatMode({ id: 'p', repo: 'r', mode: 'plan' }, [], false)).toBe('plan');
  expect(chatMode({ id: 'p', repo: 'r', mode: 'plan', modeAt: 1 }, [{ type: 'mode', by: 'plan', mode: 'auto', at: 5 }], true)).toBe('auto');
  expect(chatMode({ id: 'p', repo: 'r' }, [], false, true)).toBe('acceptEdits');
});

test('the message just sent is not shown twice', () => {
  const m = mergeEvents([{ type: 'user', text: 'hi', local: true }], [{ type: 'user', text: 'hi' }, { type: 'text', text: 'hello' }]);
  expect(m.map((x) => x.type)).toEqual(['user', 'text']);
  expect(m[0].local).toBe(false);
});

test('markdown blocks and inline marks', () => {
  expect(parseBlocks('# Title\n\nsome *text*\n- one\n1. two\n```\ncode\n```').map((b) => b.t)).toEqual(['h', 'p', 'li', 'li', 'code']);
  expect(parseInline('a **b** `c` [d](https://e.f)')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' ' }, { text: 'c', code: true }, { text: ' ' }, { text: 'd', url: 'https://e.f' }]);
});
