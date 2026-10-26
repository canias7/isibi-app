// EXPLORE THE SITE'S CODE, READ-ONLY (owner, 2026-10-26, "option b").
//
// A step that reasons about an existing site is no longer handed the pre-built
// site-map summary. It gets up front only THE FILE LIST (each path, with the
// route a page file serves) and, for a step that touches data, the TABLE
// NAMES; then it looks for itself, like a person in an editor:
//
//   list_files(prefix?)          the files, optionally under a prefix
//   search(pattern, prefix?)     file:line snippets matching text or a regex
//   read_file(path, from?, to?)  a file, or a range of its lines
//   describe_table(name)         columns, required, access, row count (data steps)
//
// Every tool READS. The step's own write path — its tool and the schema of the
// edit it makes — is untouched: the loop ends only with the step's own answer.
//
// ONE TRANSPORT WRAPPER (`exploreSend`), so no step's module changes: it wraps
// the `send(req)` a step is handed, adds the note and the tools, answers look
// calls from the site, and returns the step's answer with the usage of EVERY
// round summed onto it — the step bills from `reply.usage`, so each look round
// is billed through the step's existing cost path. Each round goes through the
// `send` it wraps, so a job's recorder and replayer (`jobSend`) see every round
// as its own exact request, tool calls and results included. AN ANSWER RESTS
// ON EXACTLY WHAT THE STEP SAW: the file list and table names in the note, and
// every look's result in the rounds after it, read from the site as it is now.
// A file the step read that has changed makes the next round a different
// request, which is never answered from an old record; a file it never read
// does not (so a part running beside another keeps its prepared answers).
//
// Dependency-light: imports only `routeOf` and `partPath`. Nothing from worker.js.

import { routeOf } from "./site-addon.mjs";
import { partPath } from "./site-files.mjs";
import { SITE_TOOLS, SITE_TOOL_NAMES, runSiteTool, foreignArgs } from "./explore-site-tools.mjs";
import { replyStandsFor } from "./prepared.mjs";

export const EXPLORE_MARK = "THE SITE'S FILES";
/** Look rounds a step may spend before it must answer. Owner: default 6. */
export const EXPLORE_MAX_LOOKS = 6;
/** The router must be fast (owner: ≤ 2). */
export const ROUTER_MAX_LOOKS = 2;
export const EXPLORE_RESULT_CHARS = 8000;
export const EXPLORE_READ_LINES = 400;
export const EXPLORE_SEARCH_HITS = 30;
const MAX_LIST = 400;

export const EXPLORE_TOOLS = Object.freeze([
  { name: "list_files", description: "List the site's files (path, and the route a page file serves). Read-only.", input_schema: { type: "object", properties: { prefix: { type: "string", description: "Only paths starting with this." } } } },
  { name: "search", description: "Search every file for text or a regular expression; answers file:line and the line. Read-only.", input_schema: { type: "object", properties: { pattern: { type: "string" }, regex: { type: "boolean", description: "Treat pattern as a regular expression (case-insensitive)." }, prefix: { type: "string", description: "Only paths starting with this." } }, required: ["pattern"] } },
  { name: "read_file", description: "Read one file, numbered, or a range of its lines. Read-only.", input_schema: { type: "object", properties: { path: { type: "string" }, from: { type: "integer", description: "First line (1-based)." }, to: { type: "integer", description: "Last line." } }, required: ["path"] } },
]);
export const DESCRIBE_TABLE_TOOL = Object.freeze({ name: "describe_table", description: "One table's columns (type, required), who may read and write it, and how many rows it holds. Read-only.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } });
export const EXPLORE_TOOL_NAMES = Object.freeze([...EXPLORE_TOOLS.map((t) => t.name), DESCRIBE_TABLE_TOOL.name, ...SITE_TOOL_NAMES]);

const str = (v) => (typeof v === "string" ? v : "");
const clip = (s, n) => (s.length > n ? s.slice(0, n) + "\n… (cut; ask for a line range)" : s);

/** A stored page `{path, source}` or part `{name, source}` as an explorable file. */
export function siteFiles({ pages = null, parts = null, extra = null } = {}) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    let route = null;
    try { route = routeOf(p.path) || null; } catch { route = null; }
    out.push({ path: p.path, source: p.source, ...(route ? { route } : {}) });
  }
  for (const p of Array.isArray(parts) ? parts : []) {
    if (!p || typeof p.name !== "string" || typeof p.source !== "string") continue;
    const path = partPath(p.name);
    if (path) out.push({ path, source: p.source });
  }
  for (const f of Array.isArray(extra) ? extra : []) {
    if (f && typeof f.path === "string" && typeof f.source === "string") out.push({ path: f.path, source: f.source, ...(typeof f.role === "string" && f.role ? { role: f.role } : {}) });
  }
  return out;
}

const label = (f) => f.path + (f.route ? " (" + f.route + ")" : f.role ? " (" + f.role + ")" : "");

/** The note a step is given up front: the file list, the table names for a data step, nothing else. */
export function exploreNote(ctx, { tables = false } = {}) {
  const files = Array.isArray(ctx && ctx.files) ? ctx.files : [];
  if (!files.length && !(tables && Array.isArray(ctx && ctx.tables) && ctx.tables.length)) return "";
  const lines = [EXPLORE_MARK + ". Read-only tools let you look before you answer: list_files, search, read_file" + (tables ? ", describe_table and the site's database and settings tools" : "") + ". Look only as much as you need; then answer with your own tool as usual."];
  lines.push("Files:");
  for (const f of files.slice(0, MAX_LIST)) lines.push("- " + label(f));
  if (files.length > MAX_LIST) lines.push("- … (" + (files.length - MAX_LIST) + " more: list_files)");
  if (tables) {
    const names = (Array.isArray(ctx.tables) ? ctx.tables : []).map((t) => t && t.name).filter((n) => typeof n === "string" && n);
    lines.push("Tables: " + (names.length ? names.join(", ") : "none"));
  }
  return lines.join("\n");
}

function underPrefix(files, prefix) {
  const p = str(prefix);
  return p ? files.filter((f) => f.path.startsWith(p)) : files;
}

/**
 * One look, answered from the site as bounded text. Never throws.
 * LOCKED TO THE JOB'S OWN SITE (owner, 2026-10-26): no tool takes a site, a
 * project or a connection; the site is bound when the job starts (`ctx`), and
 * a call naming one is refused before anything is read.
 */
export async function runExploreTool(ctx, name, input) {
  const foreign = foreignArgs(input);
  if (foreign) return foreign;
  if (SITE_TOOL_NAMES.includes(name)) return runSiteTool(ctx, name, input);
  try {
    const files = Array.isArray(ctx && ctx.files) ? ctx.files : [];
    const i = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    if (name === "list_files") {
      const got = underPrefix(files, i.prefix);
      return got.length ? got.slice(0, MAX_LIST).map(label).join("\n") : "no files" + (str(i.prefix) ? " under " + str(i.prefix) : "");
    }
    if (name === "search") {
      const pat = str(i.pattern);
      if (!pat) return "error: pattern is required";
      let test;
      if (i.regex === true) {
        let re;
        try { re = new RegExp(pat, "i"); } catch { return "error: not a valid regular expression"; }
        test = (l) => re.test(l);
      } else { const low = pat.toLowerCase(); test = (l) => l.toLowerCase().includes(low); }
      const hits = [];
      let more = 0;
      for (const f of underPrefix(files, i.prefix)) {
        const ls = f.source.split("\n");
        for (let n = 0; n < ls.length; n++) {
          if (!test(ls[n])) continue;
          if (hits.length >= EXPLORE_SEARCH_HITS) { more++; continue; }
          hits.push(f.path + ":" + (n + 1) + ": " + ls[n].trim().slice(0, 200));
        }
      }
      if (!hits.length) return "no matches";
      return clip(hits.join("\n") + (more ? "\n… " + more + " more matches; narrow the search" : ""), EXPLORE_RESULT_CHARS);
    }
    if (name === "read_file") {
      const f = files.find((x) => x.path === str(i.path)) || files.find((x) => x.path === str(i.path).replace(/^src\/routes\//, ""));
      if (!f) return "no such file: " + str(i.path) + " (list_files shows the paths)";
      const ls = f.source.split("\n");
      const from = Number.isInteger(i.from) && i.from >= 1 ? i.from : 1;
      const to = Math.min(ls.length, Number.isInteger(i.to) && i.to >= from ? i.to : from + EXPLORE_READ_LINES - 1);
      const body = ls.slice(from - 1, to).map((l, k) => (from + k) + "\t" + l).join("\n");
      return clip(label(f) + " lines " + from + "–" + to + " of " + ls.length + "\n" + body, EXPLORE_RESULT_CHARS);
    }
    if (name === "describe_table") {
      const tables = Array.isArray(ctx && ctx.tables) ? ctx.tables : null;
      if (!tables) return "unavailable: this step is not given the tables";
      const t = tables.find((x) => x && x.name === str(i.name));
      if (!t) return "no such table: " + str(i.name) + " (tables: " + tables.map((x) => x && x.name).filter(Boolean).join(", ") + ")";
      const cols = Array.isArray(t.columns) ? t.columns.map((c) => "- " + c.name + (c.type ? " " + c.type : "") + (c.required ? " (required)" : "") + (c.pk ? " (key)" : "")).join("\n") : "- not known";
      return clip("table " + t.name + "\ncolumns:\n" + cols + "\naccess: " + (t.access || "not known") + "\nrows: " + (Number.isInteger(t.rows) ? t.rows : "not known"), EXPLORE_RESULT_CHARS);
    }
    return "unavailable: no such tool";
  } catch { return "unavailable: error"; }
}

/** The request with the note in its system turn (after the step's own rules) and the look tools beside its own. */
export function exploreRequest(req, note, { tables = false, looking = true } = {}) {
  if (!req || typeof req !== "object" || Array.isArray(req)) return req;
  const tools = [...EXPLORE_TOOLS, ...(tables ? [DESCRIBE_TABLE_TOOL, ...SITE_TOOLS] : [])];
  const own = Array.isArray(req.tools) ? req.tools.filter((t) => !(t && EXPLORE_TOOL_NAMES.includes(t.name))) : [];
  const sys = req.system;
  let system = sys;
  if (note) {
    if (typeof sys === "string") system = sys.includes(EXPLORE_MARK) ? sys : sys + "\n\n" + note;
    else if (Array.isArray(sys)) system = sys.some((c) => c && typeof c.text === "string" && c.text.includes(EXPLORE_MARK)) ? sys : [...sys, { type: "text", text: note }];
    else if (sys === undefined || sys === null) system = note;
  }
  const out = { ...req, system, tools: [...own, ...tools] };
  // WHILE LOOKING, any tool may be called (a forced step tool would forbid a
  // look); once the looks are spent, the step's own choice comes back.
  const forcedOwn = req.tool_choice && req.tool_choice.type === "tool";
  if (looking) out.tool_choice = own.length ? { type: "any" } : { type: "auto" };
  else if (forcedOwn || req.tool_choice) out.tool_choice = req.tool_choice;
  else delete out.tool_choice;
  return out;
}

function flatten(messages) {
  return messages.map((m) => {
    if (!m || !Array.isArray(m.content)) return m;
    const text = m.content.map((b) => (b && b.type === "text" ? b.text : b && b.type === "tool_use" ? "[looked: " + b.name + " " + JSON.stringify(b.input || {}) + "]" : b && b.type === "tool_result" ? "[result]\n" + (typeof b.content === "string" ? b.content : "") : "")).filter(Boolean).join("\n");
    return { role: m.role, content: text || "(nothing)" };
  });
}

const addUsage = (sum, u) => {
  if (!u || typeof u !== "object") return sum;
  const out = { ...(sum || {}) };
  for (const [k, v] of Object.entries(u)) if (typeof v === "number" && Number.isFinite(v)) out[k] = (out[k] || 0) + v;
  return out;
};

/**
 * THE BOUNDED LOOP around one step call. `ctx()` answers `{ files, tables? }`
 * (async; fails open: no files, the call is sent as it was). Up to `maxLooks`
 * rounds of looks; the round after the last is sent with the step's own
 * `tool_choice`, so it ends with the step's answer. The answer returned is the
 * step's last reply with look blocks removed and `usage` summed over every
 * round, plus `explore: { looks, rounds }`.
 */
export function exploreSend(send, ctx, { maxLooks = EXPLORE_MAX_LOOKS, tables = false, onLook = null } = {}) {
  return async (req) => {
    let c = null;
    try { c = typeof ctx === "function" ? await ctx() : ctx; } catch { c = null; }
    // THE DATABASE TOOLS FOR EVERY EXPLORING STEP (owner, 2026-10-26) whose
    // site has tables or readers bound; `tables` forces them on.
    const data = tables || !!(c && (Array.isArray(c.tables) || (c.read && typeof c.read === "object")));
    const note = c ? exploreNote(c, { tables: data }) : "";
    if (!note || !req || typeof req !== "object" || !Array.isArray(req.messages)) return send(req);
    const limit = Number.isInteger(maxLooks) && maxLooks >= 0 ? maxLooks : EXPLORE_MAX_LOOKS;
    const messages = req.messages.slice();
    let usage = null, looks = 0, rounds = 0;
    for (;;) {
      const looking = looks < limit;
      const hasOwn = Array.isArray(req.tools) && req.tools.length > 0;
      // A STEP WITH NO TOOL OF ITS OWN answers in prose: once the looks are
      // spent it is sent without the look tools, its looks retold as text.
      const r = !looking && !hasOwn
        ? { ...req, messages: flatten(messages), system: exploreRequest(req, note, { tables: data }).system }
        : exploreRequest({ ...req, messages: messages.slice() }, note, { tables: data, looking });
      const reply = await send(r);
      rounds++;
      usage = addUsage(usage, reply && reply.usage);
      const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
      const lookUses = blocks.filter((b) => b && b.type === "tool_use" && EXPLORE_TOOL_NAMES.includes(b.name));
      const ownUses = blocks.filter((b) => b && b.type === "tool_use" && !EXPLORE_TOOL_NAMES.includes(b.name));
      const done = ownUses.length > 0 || !lookUses.length || !looking;
      if (done) {
        const content = blocks.filter((b) => !(b && b.type === "tool_use" && EXPLORE_TOOL_NAMES.includes(b.name)));
        const out = { ...(reply && typeof reply === "object" ? reply : {}), content, ...(usage ? { usage } : {}), explore: { looks, rounds } };
        replyStandsFor(out, reply);
        return out;
      }
      const results = [];
      for (const u of lookUses) {
        let text;
        if (looks >= limit) text = "unavailable: the looks are spent; answer now with your own tool.";
        else { looks++; text = await runExploreTool(c, u.name, u.input); if (typeof onLook === "function") { try { onLook({ tool: u.name, input: u.input }); } catch { /* never costs the call */ } } }
        results.push({ type: "tool_result", tool_use_id: u.id || u.name, content: text });
      }
      messages.push({ role: "assistant", content: blocks });
      messages.push({ role: "user", content: results });
    }
  };
}

/** The same for a `call(keys, req, budget)` transport (the page writer's). */
export function exploreCall(call, ctx, opts = {}) {
  return (keys, req, ...rest) => exploreSend((r) => call(keys, r, ...rest), ctx, opts)(req);
}

/**
 * THE FREE OFFLINE MEASURE: one step run with supplied model answers, counting
 * the rounds and the characters (≈ tokens / 4) each round would send. No model
 * is called. `answers` is the list of replies, in order.
 */
export async function measureExplore({ req, ctx, answers, maxLooks = EXPLORE_MAX_LOOKS, tables = false }) {
  const sent = [];
  let k = 0;
  const send = async (r) => { sent.push(JSON.stringify(r).length); const a = answers[Math.min(k, answers.length - 1)]; k++; return a; };
  const reply = await exploreSend(send, ctx, { maxLooks, tables })(req);
  const chars = sent.reduce((a, b) => a + b, 0);
  return { rounds: sent.length, looks: reply && reply.explore ? reply.explore.looks : 0, charsPerRound: sent, chars, approxTokens: Math.round(chars / 4), reply };
}
