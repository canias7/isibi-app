// THE SITE AGENT (2026-10-28, the owner: "one big full agent", the Lovable /
// Claude Code style — one model with tools instead of the router and its rungs).
//
// One model works in rounds. Each round it is sent the whole conversation so
// far and answers with tool calls: read files, write a file, read a table,
// build, finish. This module is the loop and the tools; the caller hands in
// what touches the world (`send`, `build`, `readTable`) so every decision here
// is driven with literal values in the tests.
//
// THE THREE COST RULES THE OWNER CHOSE (2026-10-28):
//
//  1. A HEAD START. The first message carries the site map and the files the
//     change most likely needs (`headStart`), so the agent does not spend its
//     first rounds opening pages one by one.
//
//  3. THE DESK IS CLEARED. Every round re-sends the pile, so a file the agent
//     has finished with is swapped for a one-line note once the pile is big
//     (`compact`). Nothing is lost: its writes live in the WORKSPACE (the
//     files this job will save), and `read_files` hands back the current
//     version whenever it needs one again.
//
//  4. THE SAME OPENING EVERY ROUND. The rules and the tools are byte-for-byte
//     the same on every round and every site (`AGENT_SYSTEM`, `AGENT_TOOLS`),
//     and the per-site first message never changes during a job, so both are
//     read from the provider's cache at a quarter of the price. Nothing that
//     changes (a counter, the time, a remaining budget) is ever written there.
//     Clearing the desk rewrites older rounds, which costs one cache rebuild,
//     so it happens only when the pile passes `COMPACT_AT`, all at once.
//
// THE LIMITS ARE HARD: rounds, credits and time. Reaching one stops the loop
// with what the workspace holds; the caller saves only a workspace whose last
// build passed.
import { pageRulesFor, SITE_PAGES_TOOL } from "./page-gen.mjs";
import { siteSlice } from "./site-map.mjs";
import { checkServerPart, SERVER_PREFIX } from "./server-code.mjs";
import { pageCost } from "./publish-pages.mjs";
import { requiredFiles, partKey, overThreshold } from "./file-picker.mjs";

export const AGENT_MAX_ROUNDS = 14;
export const AGENT_MAX_TOKENS = 32000;
/** Credits the loop may spend before it stops (1 credit is $0.008). */
export const AGENT_CREDIT_CAP = 60;
export const AGENT_MAX_MS = 25 * 60 * 1000;
/** The pile, in characters, above which finished files become notes. */
export const COMPACT_AT = 60000;
/** How many of the latest rounds are never compacted. */
export const KEEP_RECENT = 2;
const CREDIT_USD = 0.008;
const MAX_READ = 8;
const MAX_FILE_CHARS = 120000;
const PAGE_KEY = /^[a-z0-9][a-z0-9._$-]*(?:\/[a-z0-9._$-]+)*\.tsx$/i;
const PART_KEY = /^-parts\/[a-z0-9][a-z0-9-]{0,62}$/i;
const TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

// ── THE TOOLS (frozen: rule 4) ───────────────────────────────────────────────
export const AGENT_TOOLS = Object.freeze([
  {
    name: "read_files",
    description: "Read files of this site, as they are in your workspace now (your own writes included). Keys exactly as listed: a page is its file name (\"about.tsx\"), a component or server function \"-parts/<name>\".",
    input_schema: { type: "object", properties: { files: { type: "array", items: { type: "string" }, maxItems: MAX_READ } }, required: ["files"] },
  },
  {
    name: "write_file",
    description: "Write one whole file: a page (\"about.tsx\", a new one adds a page), a component (\"-parts/<name>\"), server code (\"-parts/server-<name>\") or the site's stylesheet (\"styles.css\", the whole sheet). Always the COMPLETE source, never a fragment. It is saved in your workspace at once.",
    input_schema: { type: "object", properties: { file: { type: "string" }, source: { type: "string" } }, required: ["file", "source"] },
  },
  {
    name: "delete_file",
    description: "Remove a page (its address then sends visitors to the home page) or a component. Never the home page (\"index.tsx\") or the stylesheet. Take out every link to a removed page and every import of a removed component.",
    input_schema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] },
  },
  {
    name: "change_rows",
    description: "Change the entries stored in one of the site's tables (a menu, a price list, classes…): add rows, update rows by id, remove rows by id. Read the table first to get the ids. Saved to the live database when you finish, not before.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        add: { type: "array", items: { type: "object" } },
        update: { type: "array", items: { type: "object", properties: { id: {}, set: { type: "object" } }, required: ["id", "set"] } },
        remove: { type: "array", items: {} },
      },
      required: ["table"],
    },
  },
  {
    name: "read_table",
    description: "Read up to 20 rows of one of the site's database tables, to see what it holds. Reading only.",
    input_schema: { type: "object", properties: { table: { type: "string" } }, required: ["table"] },
  },
  {
    name: "build",
    description: "Compile the whole site as your workspace holds it, and test-run its server code. Answers ok, or the errors to fix.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "finish",
    description: "You are done. If you wrote or removed any file, only after a build that passed with nothing written since. `summary`: what you changed, as plain facts for the reply to the customer.",
    input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  },
]);

const SERVER_HOW = (() => {
  try { return String(SITE_PAGES_TOOL.input_schema.properties.server.description || ""); } catch { return ""; }
})();

const AGENT_RULES = `

━━━ YOU ARE THE SITE'S AGENT — THESE RULES WIN OVER ANYTHING ABOVE ━━━
You change an existing website for its owner, with tools. Work like an engineer:
- The site map and the files most likely needed are in the first message. Read any other file you need with read_files before changing it; never guess what a file holds.
- Make every change the owner asked for, and nothing else. Keep everything else on every page exactly as it is.
- write_file takes a whole file. To change one line, write the file with that line changed and every other line as it was.
- Plan first: work out every change, then write all the files, then build once. Fix what the build reports and build again.
- When the build passes and every change is made, call finish with what you changed, as plain facts.
- If a change cannot be done, make the rest, and say in finish what was not done and why.

SERVER CODE is a component named "-parts/server-<name>":
` + SERVER_HOW;

/** The rules every round opens with, the same for every site of a kind (rule 4). */
export function agentSystem(spec = null, kind = "", { ownParts = false } = {}) {
  return pageRulesFor(spec, kind, { ownParts }) + AGENT_RULES;
}

// ── THE WORKSPACE ────────────────────────────────────────────────────────────
const isPage = (p) => p && typeof p.path === "string" && typeof p.source === "string";
const isPart = (p) => p && typeof p.name === "string" && typeof p.source === "string";

export const CSS_KEY = "styles.css";
const isPageKey = (k) => k !== CSS_KEY && !k.startsWith("-parts/");

/** The files the agent works on; `css` is the stored stylesheet, or null when it could not be read (then not offered). */
export function makeWorkspace(pages = [], parts = [], css = null) {
  const files = new Map();
  for (const p of Array.isArray(pages) ? pages : []) if (isPage(p)) files.set(p.path, p.source);
  for (const p of Array.isArray(parts) ? parts : []) if (isPart(p)) files.set(partKey(p.name), p.source);
  if (typeof css === "string") files.set(CSS_KEY, css);
  const original = new Map(files);
  return {
    files,
    has: (k) => files.has(k),
    get: (k) => files.get(k),
    set: (k, v) => files.set(k, v),
    delete: (k) => files.delete(k),
    keys: () => [...files.keys()],
    changed: () => [...new Set([...original.keys(), ...files.keys()])].filter((k) => original.get(k) !== files.get(k)),
    removed: () => [...original.keys()].filter((k) => !files.has(k)),
    pages: () => [...files].filter(([k]) => isPageKey(k)).map(([path, source]) => ({ path, source })),
    parts: () => [...files].filter(([k]) => k.startsWith("-parts/")).map(([k, source]) => ({ name: k.slice(7), source })),
    css: () => (files.has(CSS_KEY) ? files.get(CSS_KEY) : null),
    cssChanged: () => original.has(CSS_KEY) && original.get(CSS_KEY) !== files.get(CSS_KEY),
  };
}

/** A key the agent may write, or why not. */
export function writableKey(key, ws = null) {
  const k = typeof key === "string" ? key.trim() : "";
  if (k === CSS_KEY) return ws && !ws.has(CSS_KEY) ? { ok: false, why: "the stylesheet could not be read, so it cannot be written this time" } : { ok: true, key: k };
  if (PAGE_KEY.test(k) && !k.startsWith("-parts/")) return { ok: true, key: k };
  if (PART_KEY.test(k)) return { ok: true, key: k };
  return { ok: false, why: "a file key is a page (\"about.tsx\") or a component (\"-parts/<name>\")" };
}

// ── RULE 1: THE HEAD START ───────────────────────────────────────────────────
/**
 * The files the first message carries: every file on a small site; on a big
 * one the required files (the targets, what they import, the header and
 * footer) and whatever the picker chose (`picked`, keys).
 */
export function headStart({ pages = [], parts = [], targets = [], picked = null } = {}) {
  const ws = makeWorkspace(pages, parts);
  if (!overThreshold(pages, parts)) return ws.keys();
  const want = new Set(requiredFiles(pages, parts, targets));
  for (const k of Array.isArray(picked) ? picked : []) if (ws.has(k)) want.add(k);
  return ws.keys().filter((k) => want.has(k));
}

const fileBlock = (k, src) => "=== " + k + " ===\n" + src;

/** The first message: the request, the map, the index of every file, the head-start files. */
export function firstMessage({ request, map = null, ws, shown = [] }) {
  const index = ws.keys().map((k) => "- " + k + " (" + ws.get(k).length + " chars)" + (shown.includes(k) ? " [below]" : "")).join("\n");
  const mapText = map ? siteSlice(map, "site", { budget: 8000 }) : "";
  return [
    "THE OWNER'S REQUEST\n" + String(request || ""),
    mapText,
    "EVERY FILE OF THE SITE\n" + index,
    shown.length ? "THE FILES MOST LIKELY NEEDED, AS THEY ARE NOW\n" + shown.map((k) => fileBlock(k, ws.get(k))).join("\n\n") : "",
  ].filter(Boolean).join("\n\n");
}

// ── RULE 3: CLEARING THE DESK ────────────────────────────────────────────────
const NOTE = "[cleared from this conversation to save space; the workspace keeps the current version — read_files it again if you need it]";
const pileSize = (messages) => messages.reduce((n, m) => n + JSON.stringify(m.content).length, 0);

/**
 * Older rounds' file bodies become one-line notes: the answers of
 * `read_files` and the sources given to `write_file`. The first message and
 * the latest `keep` rounds are never touched. Pure; answers new messages.
 */
export function compact(messages, { keep = KEEP_RECENT } = {}) {
  const out = messages.map((m) => ({ ...m }));
  // A round is one assistant message and the user message answering it.
  const assistants = out.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0);
  const cut = assistants.length > keep ? assistants[assistants.length - keep] : 1;
  let cleared = 0;
  for (let i = 1; i < cut; i++) {
    const m = out[i];
    if (!Array.isArray(m.content)) continue;
    m.content = m.content.map((b) => {
      if (b && b.type === "tool_use" && b.name === "write_file" && b.input && typeof b.input.source === "string" && b.input.source !== NOTE) {
        cleared++;
        return { ...b, input: { file: b.input.file, source: "[written: " + b.input.source.length + " chars] " + NOTE } };
      }
      if (b && b.type === "tool_result" && b.reads && typeof b.content === "string" && b.content !== NOTE) {
        cleared++;
        return { ...b, content: "[read: " + b.reads.join(", ") + "] " + NOTE };
      }
      return b;
    });
  }
  return { messages: out, cleared };
}

// ── THE TOOLS, RUN ───────────────────────────────────────────────────────────
async function runTool(use, st, deps) {
  const input = use.input && typeof use.input === "object" ? use.input : {};
  switch (use.name) {
    case "read_files": {
      const want = (Array.isArray(input.files) ? input.files : []).filter((f) => typeof f === "string").slice(0, MAX_READ);
      if (!want.length) return { error: "name at least one file" };
      const found = want.filter((k) => st.ws.has(k));
      const missing = want.filter((k) => !st.ws.has(k));
      const text = found.map((k) => fileBlock(k, st.ws.get(k))).join("\n\n") + (missing.length ? "\n\nNo such file: " + missing.join(", ") : "");
      return { text, reads: found };
    }
    case "write_file": {
      const w = writableKey(input.file, st.ws);
      if (!w.ok) return { error: w.why };
      const src = typeof input.source === "string" ? input.source : "";
      if (!src.trim()) return { error: "the source is empty" };
      if (src.length > MAX_FILE_CHARS) return { error: "the file is over " + MAX_FILE_CHARS + " characters" };
      const name = w.key.startsWith("-parts/") ? w.key.slice(7) : "";
      st.ws.set(w.key, src);
      st.dirty = true;
      st.written.add(w.key);
      if (name.startsWith(SERVER_PREFIX)) {
        const c = checkServerPart({ name, source: src });
        const why = c && Array.isArray(c.reasons) ? c.reasons : [];
        if (why.length) return { text: "Saved, but this server code will be refused at publish: " + why.join("; ") + ". Fix it." };
      }
      return { text: "Saved " + w.key + " (" + src.length + " chars)." };
    }
    case "delete_file": {
      const w = writableKey(input.file);
      if (!w.ok || w.key === CSS_KEY) return { error: "only a page or a component can be removed" };
      if (w.key === "index.tsx") return { error: "the home page cannot be removed" };
      if (!st.ws.has(w.key)) return { error: "no such file: " + w.key };
      st.ws.delete(w.key);
      st.dirty = true;
      st.written.add(w.key);
      return { text: "Removed " + w.key + " from your workspace." };
    }
    case "change_rows": {
      const t = typeof input.table === "string" ? input.table.trim() : "";
      const table = (st.tables || []).find((x) => x.name === t);
      if (!table) return { error: st.tables && st.tables.length ? "no such table; the site's tables are " + st.tables.map((x) => x.name).join(", ") : "this site has no tables" };
      const cols = new Set(table.columns);
      const bad = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o).filter((k) => !cols.has(k) || k === "id") : ["(not an object)"]);
      const add = Array.isArray(input.add) ? input.add : [];
      const update = Array.isArray(input.update) ? input.update : [];
      const remove = Array.isArray(input.remove) ? input.remove : [];
      const okId = (v) => (typeof v === "number" && Number.isInteger(v)) || (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v));
      const wrong = [
        ...add.flatMap((o) => bad(o).map((k) => "add: " + k)),
        ...update.flatMap((u) => (!u || !okId(u.id) ? ["update: a row id"] : bad(u.set).map((k) => "update: " + k))),
        ...remove.filter((v) => !okId(v)).map(() => "remove: a row id"),
      ];
      if (wrong.length) return { error: "not columns of " + t + " (" + [...cols].join(", ") + "): " + [...new Set(wrong)].slice(0, 8).join("; ") };
      if (!add.length && !update.length && !remove.length) return { error: "nothing to change" };
      st.rows.push({ table: t, add, update: update.map((u) => ({ id: u.id, set: u.set })), remove });
      return { text: "Queued for " + t + ": " + [add.length && add.length + " to add", update.length && update.length + " to update", remove.length && remove.length + " to remove"].filter(Boolean).join(", ") + ". Saved when you finish." };
    }
    case "read_table": {
      const t = typeof input.table === "string" ? input.table.trim() : "";
      if (!TABLE.test(t)) return { error: "not a table name" };
      if (typeof deps.readTable !== "function") return { error: "this site's tables cannot be read here" };
      try {
        const rows = await deps.readTable(t, 20);
        return { text: JSON.stringify(rows).slice(0, 12000) };
      } catch (e) { return { error: "could not read " + t + ": " + String((e && e.message) || e).slice(0, 200) }; }
    }
    case "build": {
      st.builds++;
      let r;
      try { r = await deps.build({ pages: st.ws.pages(), parts: st.ws.parts(), css: st.ws.css() }); }
      catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
      st.lastBuild = r && r.ok === true ? "ok" : "fail";
      if (r && r.ok === true) { st.dirty = false; st.built = true; }
      const tests = r && Array.isArray(r.serverTests) ? r.serverTests.filter((t) => t && t.ok === false && t.kind === "code") : [];
      if (r && r.ok === true && !tests.length) return { text: "The build passed." };
      if (r && r.ok === true) return { text: "The build passed, but server code failed its test run: " + tests.map((t) => t.name + ": " + t.error).join("; ") };
      return { text: "The build failed:\n" + String((r && r.error) || "no reason given").slice(0, 6000) };
    }
    case "finish": {
      if (st.dirty || (st.written.size && !st.built)) return { error: "build first: files were written since the last build that passed" };
      st.done = true;
      st.summary = typeof input.summary === "string" ? input.summary.slice(0, 4000) : "";
      return { text: "Done." };
    }
    default: return { error: "no such tool: " + String(use.name).slice(0, 40) };
  }
}

const usageOf = (j, model) => {
  const u = (j && j.usage) || {};
  return { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, model };
};

// ── WHAT EACH ROUND DID, FOR THE LIVE PROGRESS LINES ─────────────────────────
// Facts from the tools' own outcomes (never the model's words); the progress
// writer turns them into the customer's live updates.
export function fileName(k) {
  if (k === CSS_KEY) return "the stylesheet";
  if (k.startsWith("-parts/" + SERVER_PREFIX)) return "the server function \"" + k.slice(7 + SERVER_PREFIX.length) + "\"";
  if (k.startsWith("-parts/")) return "the \"" + k.slice(7) + "\" component";
  const r = k.replace(/\.tsx$/, "").replace(/(^|\/)index$/, "");
  return r ? "the /" + r + " page" : "the home page";
}
const fact = (state, text) => ({ state, text });
const listed = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
export function roundFacts(outcomes) {
  const out = [];
  const reads = [], wrote = [], gone = [], looked = [], queued = [];
  for (const { use, r } of Array.isArray(outcomes) ? outcomes : []) {
    if (!use || !r || r.error) continue;
    const i = use.input || {};
    if (use.name === "read_files") reads.push(...(r.reads || []).map(fileName));
    else if (use.name === "write_file") wrote.push(fileName(String(i.file).trim()));
    else if (use.name === "delete_file") gone.push(fileName(String(i.file).trim()));
    else if (use.name === "read_table") looked.push("the " + i.table + " table");
    else if (use.name === "change_rows") queued.push("the " + i.table + " entries");
    else if (use.name === "build") out.push(/^The build passed\.$/.test(r.text) ? fact("applied", "Built the site; it compiled cleanly.") : /^The build passed/.test(r.text) ? fact("doing", "Built the site; its server code failed a test run, fixing it.") : fact("doing", "Built the site; the compiler found errors, fixing them."));
  }
  if (reads.length) out.unshift(fact("prepared", "Read " + listed([...new Set(reads)]) + "."));
  if (looked.length) out.unshift(fact("prepared", "Looked at " + listed([...new Set(looked)]) + "."));
  if (wrote.length) out.push(fact("applied", "Wrote " + listed([...new Set(wrote)]) + "."));
  if (gone.length) out.push(fact("applied", "Removed " + listed([...new Set(gone)]) + "."));
  if (queued.length) out.push(fact("prepared", "Lined up changes to " + listed([...new Set(queued)]) + ", saved at the end."));
  return out;
}

/**
 * Run the agent. `deps`: `send(req)` (an Anthropic-shaped answer), `build({
 * pages, parts })` → `{ ok, error, serverTests }`, optional `readTable(name,
 * n)`, `now()`, `log(event)`. Never throws; answers
 * `{ ok, stopped, pages, parts, changed, summary, usage, credits, rounds, builds }`.
 * `ok` is true only when the agent finished on a passing build.
 */
export async function runSiteAgent(deps, { request, pages, parts, css = null, map = null, spec = null, kind = "", ownParts = false, targets = [], picked = null, model, maxRounds = AGENT_MAX_ROUNDS, creditCap = AGENT_CREDIT_CAP, maxMs = AGENT_MAX_MS } = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const progress = typeof deps.progress === "function" ? deps.progress : () => {};
  const started = now();
  const ws = makeWorkspace(pages, parts, css);
  const tables = spec && Array.isArray(spec.tables)
    ? spec.tables.filter((t) => t && typeof t.name === "string" && Array.isArray(t.columns))
      .map((t) => ({ name: t.name, columns: t.columns.map((c) => (c && typeof c.name === "string" ? c.name : typeof c === "string" ? c : "")).filter(Boolean) }))
    : [];
  const st = { ws, tables, rows: [], dirty: false, built: false, builds: 0, written: new Set(), done: false, summary: "", lastBuild: "" };
  const shown = headStart({ pages, parts, targets, picked });
  const system = [{ type: "text", text: agentSystem(spec, kind, { ownParts }), cache_control: { type: "ephemeral" } }];
  let messages = [{ role: "user", content: [{ type: "text", text: firstMessage({ request, map, ws, shown }), cache_control: { type: "ephemeral" } }] }];
  const usage = [];
  const spent = () => usage.reduce((n, u) => n + pageCost(u), 0) / CREDIT_USD;
  let stopped = "";
  let rounds = 0;
  let lastCost = 0;

  while (!st.done) {
    if (rounds >= maxRounds) { stopped = "rounds"; break; }
    if (now() - started > maxMs) { stopped = "time"; break; }
    if (spent() + lastCost > creditCap) { stopped = "credits"; break; }
    if (pileSize(messages) > COMPACT_AT) {
      const c = compact(messages);
      messages = c.messages;
      log({ event: "compact", cleared: c.cleared });
    }
    rounds++;
    let j;
    try {
      j = await deps.send({ model, max_tokens: AGENT_MAX_TOKENS, system, tools: AGENT_TOOLS, cacheKey: "site-agent", messages });
    } catch (e) { stopped = "send"; log({ event: "send-failed", why: String((e && e.message) || e).slice(0, 200) }); break; }
    const u = usageOf(j, model);
    usage.push(u);
    lastCost = pageCost(u) / CREDIT_USD;
    const content = Array.isArray(j && j.content) ? j.content : [];
    const uses = content.filter((b) => b && b.type === "tool_use");
    log({ event: "round", round: rounds, tools: uses.map((b) => b.name), credits: Math.round(spent() * 10) / 10 });
    if (!uses.length) { stopped = j && j.stop_reason === "max_tokens" ? "too-long" : "no-tool"; break; }
    const ids = uses.map((b, i) => (typeof b.id === "string" && b.id ? b.id : "t" + rounds + "_" + i));
    messages.push({ role: "assistant", content: content.map((b) => (b && b.type === "tool_use" ? { ...b, id: ids[uses.indexOf(b)] } : b)) });
    const results = [];
    const outcomes = [];
    for (let i = 0; i < uses.length; i++) {
      const r = await runTool(uses[i], st, deps);
      const block = { type: "tool_result", tool_use_id: ids[i], content: r.error ? r.error : r.text };
      if (r.error) block.is_error = true;
      if (r.reads) Object.defineProperty(block, "reads", { value: r.reads, enumerable: false });
      results.push(block);
      outcomes.push({ use: uses[i], r });
    }
    messages.push({ role: "user", content: results });
    try { const f = roundFacts(outcomes.splice(0)); if (f.length) progress("agent", f); } catch { /* the record never costs the change */ }
  }

  const credits = usage.length ? Math.max(1, Math.ceil(spent())) : 0;
  return {
    ok: st.done && !st.dirty && (st.built || !st.written.size),
    stopped: st.done ? "" : stopped,
    pages: ws.pages(), parts: ws.parts(),
    css: ws.css(), cssChanged: ws.cssChanged(),
    changed: ws.changed(), removed: ws.removed(),
    rows: st.rows,
    summary: st.summary,
    lastBuild: st.lastBuild,
    usage, credits, rounds, builds: st.builds,
  };
}

/** The agent takes every site's edit and addition whole (2026-10-28, the owner: no switch). */
export const AGENT_TAKES_ALL = true;

/** The credit cap for one job: `SITE_AGENT_CAP` when it is a positive number, else the default. */
export function agentCap(env) {
  const n = Number(env && env.SITE_AGENT_CAP);
  return Number.isFinite(n) && n > 0 ? n : AGENT_CREDIT_CAP;
}

/** What the reply writer is told when the agent stopped short: facts, never a sentence for the customer. */
export function stoppedFacts(r) {
  const why = {
    rounds: "it reached its limit of steps before finishing",
    credits: "it reached its spending limit before finishing",
    time: "it ran out of time before finishing",
    send: "the AI model could not be reached",
    "no-tool": "the model stopped answering with actions",
    "too-long": "the model's answer was cut off for length",
  }[r && r.stopped] || "it did not finish";
  return "The site agent stopped: " + why + ". Nothing on the site was changed" +
    (r && r.lastBuild === "fail" ? "; its last build had errors" : "") + ".";
}
