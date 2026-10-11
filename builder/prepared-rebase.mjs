// RE-BASING A PREPARED ANSWER ONTO A SITE THAT CHANGED ONLY OUTSIDE ITS STEP'S
// SCOPE (2026-10-11, the parallel-work goal: independent tasks run together
// unless they need another's result or conflict with its changes).
//
// A step's model is shown the whole site, on purpose: the text step every
// page's words ("if the same thing appears on several pages, change every
// one"), the data step every table. So two independent steps — a heading on
// one page and a line on another, a price in one table and an opening time in
// another — each see the other's target, and once the first is applied the
// second's request is no longer byte for byte the one its preparation was
// answered for. Exact replay (`builder/prepared.mjs`) then asks the model
// again, and the work prepared beside the first job is thrown away.
//
// A RE-BASE keeps the whole context and the safety argument. A prepared answer
// is carried onto the request the job now makes only when every one of these
// holds, else the job asks the model as before:
//   - the step, its instructions, its tool and its own words are unchanged;
//   - everything inside the step's DECLARED SCOPE (the pages its route says it
//     writes; the tables) is byte for byte as the preparation saw it;
//   - the answer touches nothing outside that scope;
//   - no difference outside the scope mentions what the answer changes or
//     what it writes — a change elsewhere that now carries the same words is a
//     consistency question the model must see, so it is asked again.
// A text answer's numbers are re-pointed at the same lines of the same pages
// in the job's list; a data answer names rows by table and id, which do not
// move. Nothing here calls a model, writes, or charges: a re-based answer is
// billed by the job exactly as an exact replay is, through its own reserve.
//
// PURE.

const TEXT_TOOL = "write_text_edits";
const DATA_TOOL = "write_row_changes";
const TEXT_HEAD = "THE TEXT ON THEIR SITE\n";
const ASKED = "\n\nWHAT THEY ASKED FOR\n";
const DATA_HEAD = "WHAT THIS SITE STORES\n";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const toolOf = (q) => (q && q.tool_choice && typeof q.tool_choice.name === "string" ? q.tool_choice.name : "");
const userText = (q) => {
  const m = q && Array.isArray(q.messages) && q.messages.length === 1 ? q.messages[0] : null;
  return m && m.role === "user" && typeof m.content === "string" ? m.content : null;
};
const toolUse = (reply) => (reply && Array.isArray(reply.content) ? reply.content.find((b) => b && b.type === "tool_use") : null);
/** Text reduced to its words: lower case, punctuation and spacing folded, so "weekdays." and "weekdays —" read alike. */
const lower = (s) => " " + String(s).toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
/** Words worth looking for in a changed line: three characters or more once folded. */
const telling = (s) => typeof s === "string" && lower(s).trim().length >= 3;

/** A route's page file, as TanStack's flat routes name it (`builder/site-add.mjs` `fileOfRoute`). */
export function fileOfPagePath(r) {
  if (typeof r !== "string" || !r.startsWith("/")) return "";
  if (r === "/") return "index.tsx";
  return r.slice(1).split("/").join(".") + ".tsx";
}

/** The parts of a request that are not its site listing must be the same. */
function sameFrame(a, b, { tokens = true } = {}) {
  for (const k of ["model", "system", "tools", "tool_choice", "temperature", "top_p", "top_k", "thinking", "stop_sequences", "response_format"]) {
    if (!same(a[k], b[k])) return false;
  }
  return tokens ? same(a.max_tokens, b.max_tokens) : true;
}

// ── TEXT ─────────────────────────────────────────────────────────────────────

/** The numbered lines of a text request: `[{ path, text }]` in order, or null when any line does not read. */
function textLines(q) {
  const c = userText(q);
  if (c === null || !c.startsWith(TEXT_HEAD)) return null;
  const at = c.indexOf(ASKED);
  if (at < 0) return null;
  const body = c.slice(TEXT_HEAD.length, at);
  const out = [];
  for (const [i, line] of body.split("\n").entries()) {
    const m = /^(\d+)\. \[([^\]]+)\] (.*)$/.exec(line);
    if (!m || Number(m[1]) !== i) return null;
    out.push({ path: m[2], text: m[3] });
  }
  return { lines: out, asked: c.slice(at) };
}

/** The lines outside `scope` that one list has and the other does not, both ways. */
function changedOutside(a, b, inScope) {
  const count = (lines) => { const m = new Map(); for (const l of lines) if (!inScope(l.path)) { const k = l.path + "\u0000" + l.text; m.set(k, (m.get(k) || 0) + 1); } return m; };
  const ca = count(a), cb = count(b);
  const out = [];
  for (const [k, n] of ca) if ((cb.get(k) || 0) !== n) out.push(k.split("\u0000")[1]);
  for (const [k, n] of cb) if ((ca.get(k) || 0) !== n) out.push(k.split("\u0000")[1]);
  return out;
}

/**
 * A text answer made for `q`, re-based onto `now`, or null. `files` are the
 * page files the step's route says it writes.
 */
export function rebaseText(q, reply, now, files) {
  const scope = new Set((Array.isArray(files) ? files : []).filter((f) => typeof f === "string" && f));
  if (!scope.size || toolOf(q) !== TEXT_TOOL || toolOf(now) !== TEXT_TOOL || !sameFrame(q, now)) return null;
  const was = textLines(q), is = textLines(now);
  if (!was || !is || was.asked !== is.asked) return null;
  const use = toolUse(reply);
  const input = use && use.input && typeof use.input === "object" ? use.input : null;
  if (!input || !Array.isArray(input.edits) || !input.edits.length || Object.hasOwn(input, "question")) return null;
  // INSIDE THE SCOPE, EXACTLY AS THE PREPARATION SAW IT.
  const inScope = (p) => scope.has(p);
  const pick = (lines, p) => lines.filter((l) => l.path === p).map((l) => l.text);
  for (const f of scope) if (!same(pick(was.lines, f), pick(is.lines, f))) return null;
  // EACH EDIT ON A LINE OF A SCOPED PAGE, RE-POINTED AT THAT SAME LINE NOW.
  const edits = [];
  const asked = [];
  for (const e of input.edits) {
    if (!e || !Number.isInteger(e.id) || typeof e.to !== "string") return null;
    const line = was.lines[e.id];
    if (!line || !inScope(line.path)) return null;
    const k = was.lines.slice(0, e.id).filter((l) => l.path === line.path).length;
    let seen = -1, id = -1;
    for (let i = 0; i < is.lines.length; i++) if (is.lines[i].path === line.path && ++seen === k) { id = i; break; }
    if (id < 0 || is.lines[id].text !== line.text) return null;
    edits.push({ ...e, id });
    asked.push(line.text, e.to);
  }
  // NOTHING CHANGED ELSEWHERE THAT CARRIES WHAT THIS ANSWER CHANGES OR WRITES.
  const words = asked.filter(telling).map(lower);
  for (const t of changedOutside(was.lines, is.lines, inScope)) {
    const l = lower(t);
    // EITHER WAY ROUND: a changed line that holds what this answer changes or
    // writes, or that is itself held within it.
    if (words.some((w) => l.includes(w) || (l.trim().length >= 3 && w.includes(l)))) return null;
  }
  return { ...reply, content: reply.content.map((b) => (b === use ? { ...use, input: { ...input, edits } } : b)) };
}

// ── DATA ─────────────────────────────────────────────────────────────────────

/** A data request's tables as `{ name → block text }` and the rest after them, or null. */
function dataBlocks(q) {
  const c = userText(q);
  if (c === null || !c.startsWith(DATA_HEAD)) return null;
  const body = c.slice(DATA_HEAD.length);
  const cut = body.indexOf("\n\n");
  if (cut < 0) return null;
  const blocks = new Map();
  let name = null;
  for (const line of body.slice(0, cut).split("\n")) {
    const m = /^TABLE (\S+) — /.exec(line);
    if (m) { name = m[1]; if (blocks.has(name)) return null; blocks.set(name, line); continue; }
    if (name === null) return null;
    blocks.set(name, blocks.get(name) + "\n" + line);
  }
  return { blocks, rest: body.slice(cut) };
}

/** Every table an answer names, and every string value it writes. */
function dataReach(input) {
  const tables = new Set();
  const values = [];
  const walk = (v, key) => {
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) walk(x, k); return; }
    if (key === "table" && typeof v === "string") tables.add(v);
    else if (typeof v === "string") values.push(v);
  };
  walk(input, "");
  return { tables, values };
}

/**
 * A data answer made for `q`, re-based onto `now`, or null. `tables` are the
 * tables the step's route says it writes. Rows are named by table and id, so a
 * re-based answer is the same answer.
 */
export function rebaseData(q, reply, now, tables) {
  const scope = new Set((Array.isArray(tables) ? tables : []).filter((t) => typeof t === "string" && t));
  if (!scope.size || toolOf(q) !== DATA_TOOL || toolOf(now) !== DATA_TOOL) return null;
  // THE ANSWER'S TOKEN ROOM grows with every table's size; an answer that did
  // not reach the old limit is the same answer under a new one.
  if (!sameFrame(q, now, { tokens: false }) || !reply || reply.stop_reason === "max_tokens") return null;
  const was = dataBlocks(q), is = dataBlocks(now);
  if (!was || !is || was.rest !== is.rest) return null;
  for (const t of scope) if (!was.blocks.has(t) || was.blocks.get(t) !== is.blocks.get(t)) return null;
  const use = toolUse(reply);
  const input = use && use.input && typeof use.input === "object" ? use.input : null;
  if (!input || Object.hasOwn(input, "question")) return null;
  const { tables: named, values } = dataReach(input);
  if (!named.size || [...named].some((t) => !scope.has(t))) return null;
  const words = values.filter(telling).map(lower);
  for (const name of new Set([...was.blocks.keys(), ...is.blocks.keys()])) {
    if (scope.has(name) || was.blocks.get(name) === is.blocks.get(name)) continue;
    const changed = lower((was.blocks.get(name) || "") + "\n" + (is.blocks.get(name) || ""));
    if (words.some((w) => changed.includes(w))) return null;
  }
  return reply;
}

/**
 * THE JOB'S RE-BASE for a part whose scope is declared (`prepScope`):
 * `{ pages: ["/visit"], tables: ["loaves"] }` → a function the replayer asks
 * on a miss, or null when nothing is scoped.
 */
export function rebaserFor(scope) {
  const pages = scope && Array.isArray(scope.pages) ? scope.pages.map(fileOfPagePath).filter(Boolean) : [];
  const tables = scope && Array.isArray(scope.tables) ? scope.tables.filter((t) => typeof t === "string" && t) : [];
  if (!pages.length && !tables.length) return null;
  return (q, reply, now) => {
    const tool = toolOf(now);
    if (tool === TEXT_TOOL && pages.length) return rebaseText(q, reply, now, pages);
    if (tool === DATA_TOOL && tables.length) return rebaseData(q, reply, now, tables);
    return null;
  };
}
