// Starter rows, when the designer did not write any.
//
// WHY THIS EXISTS. `seed` is a REQUIRED field on `design_schema` and the model
// leaves it out anyway — measured live on two consecutive builds on 2026-08-12
// after one that did not. Nothing noticed and nothing recovered, so the site
// published with an empty price list and a booking form whose Service select had
// zero options, and the customer was told `✅ Built`. That is not cosmetic:
// nothing can write to a `display` table after the build, so an empty one is
// empty forever and the form is unsubmittable by anybody, permanently.
//
// The cheap rung, deliberately. Asking the designer again is a second full
// schema call (~9-15 credits); this is one small forced-tool call that already
// knows the schema and the brief, and it only ever runs on a build that came
// back short. A build the designer got right makes NO call here at all, which is
// the property that decides whether this is affordable.
//
// A plain module with its one side effect injected, like `site-ask.mjs`: the
// request is composed here, the caller sends it. So every decision below is
// testable with no network and no Worker.
import { resolveAccess, accessNameFor, isManagedColumn } from "../site-access.mjs";
import { modelsFor } from "./build-models.mjs";

/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
export const SEED_MODEL = modelsFor().quick;
export const SEED_MAX_TOKENS = 2000;
/** Most tables one call will fill. A schema with more than this has other problems. */
export const MAX_GAP_TABLES = 6;
/** Most rows kept per table. `seedSiteRows` caps again at its own ceiling. */
export const MAX_GAP_ROWS = 6;
/** Most columns described per table, so one wide table cannot blow the prompt. */
export const MAX_GAP_COLS = 14;

/** The columns a row may actually carry — declared, and not engine-managed. */
function writableColumns(t) {
  const src = Array.isArray(t && t.columns) ? t.columns : [];
  const out = [];
  for (const c of src) {
    const name = String(typeof c === "string" ? c : (c && c.name) || "").toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(name) || isManagedColumn(name)) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out.slice(0, MAX_GAP_COLS);
}

/**
 * WHICH TABLES WILL BE EMPTY FOREVER unless somebody writes rows for them.
 *
 * Asked through `resolveAccess`, not through the `access` field as written —
 * `display` is a preset over `{read: "public", write: "none"}` and a designer is
 * told it may declare either. Reading the preset name is the bug this same
 * morning left a menu unseeded with, one file over, and there must be exactly
 * ONE question here or the top-up fills a table the seeder then refuses.
 *
 * A table with rows already in `seed` is not a gap, so a designer that filled
 * two of three costs one call about the third and nothing about the other two.
 */
export function seedGaps(spec, seed) {
  const have = (seed && typeof seed === "object" && !Array.isArray(seed)) ? seed : {};
  const filled = new Set();
  for (const [k, v] of Object.entries(have)) {
    // A KEY WITH AN EMPTY ARRAY IS NOT A FILLED TABLE, and this is one of the
    // three silent paths that produced the live failure — `seedSiteRows`
    // `continue`s on it without recording a skip, so it reads from the outside
    // exactly like a table nobody mentioned.
    if (Array.isArray(v) && v.some((r) => r && typeof r === "object" && !Array.isArray(r))) filled.add(String(k).toLowerCase());
  }
  const out = [];
  // THE SAME TOLERANCE `normalizeSchema` HAS, because this reads the RAW tool
  // input and the model's habits arrive here first. A map-shaped `tables`
  // (`{services: {...}}` — a form the normaliser deliberately ACCEPTS) made the
  // bare for..of throw `object is not iterable`, and seedGaps runs OUTSIDE
  // topUpSeed's try — so the net built to rescue a build crashed it instead,
  // voiding this module's own "it can never fail a build" contract. Found by
  // the 2026-08-13 audit, never fired live only because every run so far had no
  // gap to find. A string-shaped list (the a4fa208 recovery's exact case) was
  // one notch quieter: for..of iterates the CHARACTERS, none has `.name`, and
  // the net silently reports no gaps on a schema that has them.
  let src = (spec && spec.tables) || [];
  if (typeof src === "string") {
    try { const p = JSON.parse(src); src = (p && typeof p === "object") ? p : []; } catch { src = []; }
  }
  if (!Array.isArray(src)) {
    src = (src && typeof src === "object")
      ? Object.entries(src).map(([name, def]) => ({ name, ...(def && typeof def === "object" && !Array.isArray(def) ? def : {}) }))
      : [];
  }
  for (const t of src) {
    if (!t || !t.name) continue;
    if (accessNameFor(resolveAccess(t)) !== "display") continue;
    if (filled.has(String(t.name).toLowerCase())) continue;
    const columns = writableColumns(t);
    // Nothing writable means nothing to write. `seedSiteRows` would refuse it
    // anyway; asking the model to invent rows for it would be paying to be told
    // the same thing.
    if (!columns.length) continue;
    out.push({ name: String(t.name), columns });
    if (out.length >= MAX_GAP_TABLES) break;
  }
  return out;
}

const TOOL = {
  name: "write_rows",
  description:
    "Starter rows for the tables named below. Every one of them will be EMPTY FOREVER without this: nothing on " +
    "the published site can write to them, so an empty list stays empty and any form field that picks from one " +
    "renders with no options at all.",
  input_schema: {
    type: "object",
    properties: {
      rows: {
        type: "object",
        description:
          "Keyed by table name, each an array of " + (MAX_GAP_ROWS - 3) + "-" + MAX_GAP_ROWS + " rows. " +
          "Use ONLY that table's listed columns. Make them real for THIS business — real service names, real " +
          "prices, real opening times — never 'Item 1' or 0.00. Prices are plain numbers with no currency symbol.",
        additionalProperties: { type: "array", items: { type: "object" } },
      },
    },
    required: ["rows"],
  },
};

export function seedRequest({ brief = "", tables = [], model = SEED_MODEL } = {}) {
  const list = (Array.isArray(tables) ? tables : []).slice(0, MAX_GAP_TABLES);
  const spec = list.map((t) => "- " + t.name + " (" + t.columns.join(", ") + ")").join("\n");
  return {
    model,
    max_tokens: SEED_MAX_TOKENS,
    tools: [TOOL],
    // FORCED, like every other structured call here. Prose is unusable: the
    // caller has no field to read and the fallback is the empty menu this
    // exists to prevent.
    tool_choice: { type: "tool", name: "write_rows" },
    system: [{
      type: "text",
      text: "You write realistic starter content for a small business's own website. " +
        "You are given the business's brief and the tables that hold its public content, and you fill them in. " +
        "Everything you write is shown to that business's customers, so it must read like the real thing.",
    }],
    messages: [{
      role: "user",
      content: "THE BUSINESS\n" + String(brief || "").trim().slice(0, 4000) +
        "\n\nTHE TABLES TO FILL, with the only columns each one has\n" + spec,
    }],
  };
}

/**
 * The rows, filtered back against what was actually asked for.
 *
 * This is model output on its way into a real customer's database, so the answer
 * is narrowed rather than trusted: a table nobody asked about is dropped (the
 * seeder would refuse it, but a `collect` table's rows are fabricated customer
 * submissions and this must not be the second place that could ever produce
 * them), a column the table does not have is dropped, and anything that is not a
 * plain scalar goes with it.
 */
export function readSeedRows(reply, tables) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.rows) || null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const wanted = new Map((Array.isArray(tables) ? tables : [])
    .filter((t) => t && t.name)
    .map((t) => [String(t.name).toLowerCase(), new Set(t.columns || [])]));
  const out = {};
  for (const [table, rows] of Object.entries(raw)) {
    const cols = wanted.get(String(table).toLowerCase());
    if (!cols || !Array.isArray(rows)) continue;
    const kept = [];
    for (const row of rows.slice(0, MAX_GAP_ROWS)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const one = {};
      for (const [k, v] of Object.entries(row)) {
        if (!cols.has(String(k).toLowerCase())) continue;
        // Scalars only. An object here would be stored as JSON in a text column
        // and render to a visitor as `[object Object]`.
        if (v === null || ["string", "number", "boolean"].includes(typeof v)) one[String(k).toLowerCase()] = v;
      }
      if (Object.keys(one).length) kept.push(one);
    }
    // An entry with nothing usable in it is not written at all, or the merge
    // below marks the table as filled and the real gap is hidden.
    if (kept.length) out[wanted.has(String(table).toLowerCase()) ? String(table) : table] = kept;
  }
  return out;
}

/** Tokens spent, in the shape the one price table reads. */
function seedUsage(reply, model) {
  const u = (reply && reply.usage) || null;
  if (!u) return null;
  return {
    in: u.input_tokens || 0,
    out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
    // PRICED AT ITS OWN MODEL'S RATES. This call is Haiku while the schema call
    // may be Sonnet or Opus, so the two usages can never be added together into
    // one object — that is the `sumUsage` bug this repo already paid for once.
    // They are summed as DOLLARS by `pageCredits`, which rounds once.
    model,
  };
}

/**
 * Fill whatever the designer left empty. Returns `{rows, usage, gaps}`.
 *
 * IT CAN NEVER FAIL A BUILD. Every failure — no gaps, a throw, an unreadable
 * answer, an answer about tables nobody asked for — returns no rows and no
 * usage, which leaves the site in exactly the state it would have been in
 * without this function: published, with an empty list. That is the state this
 * is trying to improve on, so it is the only honest thing to degrade to.
 */
export async function topUpSeed(deps, { brief = "", spec = null, seed = null, model = SEED_MODEL } = {}) {
  const gaps = seedGaps(spec, seed);
  // THE PROPERTY THAT MAKES THIS AFFORDABLE: a build the designer got right
  // makes no call at all.
  if (!gaps.length) return { rows: {}, usage: null, gaps: [] };
  let reply;
  try {
    reply = await deps.send(seedRequest({ brief, tables: gaps, model }));
  } catch {
    return { rows: {}, usage: null, gaps: gaps.map((g) => g.name), failed: true };
  }
  const rows = readSeedRows(reply, gaps);
  // Usage is reported whether or not the answer was usable: the tokens were
  // spent either way, and the rule here is charge for what is used.
  return { rows, usage: seedUsage(reply, SEED_MODEL), gaps: gaps.map((g) => g.name) };
}

/**
 * The designer's own seed with the top-up merged in.
 *
 * MERGED, NEVER REPLACED — a designer that filled two tables of three keeps
 * both, and the top-up only ever adds the table it was asked about. The
 * designer's own rows win on a key collision, because it is the call that read
 * the whole brief and this one only saw a summary of it.
 */
export function mergeSeed(seed, rows) {
  const base = (seed && typeof seed === "object" && !Array.isArray(seed)) ? seed : {};
  const add = (rows && typeof rows === "object" && !Array.isArray(rows)) ? rows : {};
  const out = { ...base };
  const have = new Set(Object.keys(base).map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(add)) {
    const key = k.toLowerCase();
    // A key the designer already used but left EMPTY is the case this is for, so
    // "already present" is not the test — `seedGaps` has already decided which
    // tables are genuinely unfilled, and anything it returned may be written.
    const existing = have.has(key) ? base[Object.keys(base).find((n) => n.toLowerCase() === key)] : null;
    const filled = Array.isArray(existing) && existing.some((r) => r && typeof r === "object" && !Array.isArray(r));
    if (filled) continue;
    out[k] = v;
  }
  return out;
}
