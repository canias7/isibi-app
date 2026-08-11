// The edit lane: change what the site already has, and nothing else.
//
// WHAT THIS IS FOR. Until it existed there was one work lane, and every change
// to a live site re-entered at the top of it: designer, all pages regenerated,
// container, republish, ~25 credits. "Change the phone number in the header" and
// "build me a barber shop" ran the identical ten steps, and the bill was almost
// entirely the pages step — ~23 credits of output tokens re-emitting five pages
// that did not change.
//
// THE PROTECTION IS THAT THE STEPS ARE ABSENT, NOT THAT A RULE FORBIDS THEM.
// Nothing in this module can reach `applySiteSchema`, `seedSiteRows` or the page
// generator, so "an edit never touches the database" is a property of the lane
// rather than an instruction somebody has to remember. That is the same argument
// `site-rls.mjs` makes about a `collect` table having no SELECT policy: an
// omission cannot be weakened by putting a filter in the wrong clause.
//
// TWO OF THE THREE LAYERS NEED NO PAGE MODEL CALL AT ALL, and that is the whole
// saving rather than a detail:
//
//   text — the words are lifted out of the stored source by `site-text.mjs`,
//          a cheap model picks which ones change, and they go back at the exact
//          offsets they came from. No page is rewritten.
//   look — the designer already knows how to move theme, family, fonts, corners
//          and colours WITHOUT touching a page (site-edit.mjs, absent means
//          unchanged), and `recompileAndPublish` reads the look out of `_meta`
//          rather than being handed it. So the whole layer is: decide, store,
//          recompile. Not one page goes through a model.
//   page — one page's source through the page model, instead of all of them.
//
// Plain module with its side effects injected, like `site-ask.mjs` and
// `publish-pages.mjs`, so every decision here is tested with no network, no
// container and no Worker.

import { extractText, applyEdits } from "./site-text.mjs";

/** Haiku. Choosing which of a list of strings to change is not a design task. */
export const TEXT_MODEL = "claude-haiku-4-5";

/**
 * Enough for a handful of replacements and not enough for an essay.
 *
 * The model returns short strings and an id each, so this is generous. Output
 * bills at 5x input; a text edit that wanted more than this is not a text edit.
 */
export const TEXT_MAX_TOKENS = 1500;

/**
 * HOW MANY STRINGS THE MODEL IS EVEN SHOWN.
 *
 * A five-page site offers a few hundred. The cap is on the INPUT because that is
 * what is paid for on every text edit, and the strings are offered in source
 * order so what gets dropped is the tail of the longest page rather than an
 * arbitrary scatter. A change that needed a string past the cap comes back as
 * "nothing matched", which escalates — the honest outcome, and not a silent miss.
 */
export const MAX_TEXT_ITEMS = 400;

/** One replacement. Matches `site-text.mjs`'s own ceiling on a label. */
export const MAX_TEXT_CHARS = 400;

export const TEXT_TOOL = {
  name: "write_text_edits",
  description: "Choose which of the numbered pieces of text on this site should change, and what each should say instead.",
  input_schema: {
    type: "object",
    properties: {
      edits: {
        type: "array",
        description:
          "One entry per piece of text that this change actually alters. LEAVE OUT everything the change does not " +
          "mention — an entry that puts back what is already there costs the customer a rebuild for nothing, and an " +
          "entry that rewords something nobody asked about is the exact failure this lane exists to prevent.\n" +
          "IF THE SAME THING APPEARS ON SEVERAL PAGES — a phone number in a footer, a business name in a header — " +
          "change EVERY one of them. Half-applied is worse than not applied, because the site then disagrees with itself.\n" +
          "If nothing in the list is what they meant, return an empty array rather than guessing at the nearest thing.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "The number printed beside the text in the list below. Never invent one.",
            },
            to: {
              type: "string",
              description:
                "What that text should say instead. Plain words only: no quotes, no braces, no angle brackets and no " +
                "backslashes — this is written straight into the page's source, where any of those stops the site " +
                "compiling. Keep it about as long as what it replaces; a heading that triples in length breaks the layout.",
            },
          },
          required: ["id", "to"],
        },
      },
    },
    required: ["edits"],
  },
};

const SYSTEM =
  "You change the wording on a small business's published website. You are given every piece of text on it, numbered, " +
  "and one instruction from the owner. Say which numbers change and what they should say.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. This is the entire job. The owner asked for one thing; everything else on their " +
  "site is there because they wanted it, and improving it while you are in there is not a favour — they cannot see " +
  "what you touched, and the next thing they notice is that a heading they liked is gone.\n\n" +
  "You are not writing copy. If they say what the new text is, use their words exactly, including their spelling and " +
  "capitalisation. Only write something yourself when they describe a change rather than dictating one, and then " +
  "match the voice of the text around it.\n\n" +
  "Some pieces of text are labels, some are headings, some are whole sentences. Length matters: a button that says " +
  "\"Book\" cannot become a sentence, and a heading that doubles in length wraps badly on a phone.";

/**
 * The one definition of the text-edit call.
 *
 * Extracted the way `askRequest` and `pagesRequest` were, and for the same
 * reason: two places constructing this means a test tunes something production
 * does not run.
 *
 * NUMBERED IDS, NOT OFFSETS. The model never sees or returns a character
 * position — it picks numbers off a list we printed, and the caller maps them
 * back. A model that cannot name an offset cannot name a WRONG one, which on a
 * page of TSX is the difference between a typo fix and a site that will not
 * compile. `site-text.mjs` still refuses the edit if the source has moved under
 * it; this makes that the second line of defence rather than the first.
 */
export function textRequest({ instruction, items }) {
  const list = (Array.isArray(items) ? items : []).slice(0, MAX_TEXT_ITEMS);
  const lines = list.map((it, i) => i + ". [" + it.path + "] " + it.text);
  return {
    model: TEXT_MODEL,
    max_tokens: TEXT_MAX_TOKENS,
    tools: [TEXT_TOOL],
    tool_choice: { type: "tool", name: "write_text_edits" },
    system: [{ type: "text", text: SYSTEM }],
    messages: [{
      role: "user",
      content:
        "THE TEXT ON THEIR SITE\n" + lines.join("\n") +
        "\n\nWHAT THEY ASKED FOR\n" + String(instruction || "").trim().slice(0, 2000),
    }],
  };
}

/**
 * Rename the business everywhere its name is WRITTEN, with no model call.
 *
 * THE NAME LIVES IN TWO PLACES AND ONLY ONE OF THEM WAS MOVING. `_meta.site_look`
 * holds the brand, which the container puts in `<title>` and the publish puts in
 * the link preview; every page ALSO carries it as a literal — `<SiteChrome
 * name="Tenfold Nails">` and in headings and copy — and that is the half a
 * visitor actually reads. So "call it Sharp Fade instead" changed the browser tab
 * and the WhatsApp preview, left every heading saying the old name, and reported
 * success. The router's own layer description offers "the site's name", so this
 * is a request the platform invites.
 *
 * IT REUSES `extractText`, WHICH IS THE WHOLE SAFETY ARGUMENT. A blind
 * `split(old).join(new)` would rewrite the name inside an import path, a route
 * id, a className or a URL — a site that does not compile, or one whose links
 * 404. `extractText` already answers "is this string prose a visitor reads", is
 * already tested, and is the same discrimination the free text editor runs on;
 * a second, looser rule here is a second thing that can be wrong.
 *
 * Deterministic, so it costs nothing: no model call, no tokens.
 */
export function renamePages(pages, from, to) {
  const was = String(from == null ? "" : from).trim();
  const now = String(to == null ? "" : to).trim();
  // A rename to the same name, or to or from nothing, is not a rename. A very
  // short old name is refused outright — replacing every "A" on a site is not a
  // rename, it is damage, and no business is helped by us guessing.
  if (!was || !now || was === now || was.length < 2) return { pages: Array.isArray(pages) ? pages : [], applied: 0 };
  const edits = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    for (const it of extractText(p.source)) {
      if (!it.text.includes(was)) continue;
      const next = it.text.split(was).join(now);
      // The same bound the text editor applies to a replacement, for the same
      // reason: a very long string is not a label and rewriting it wholesale is
      // not what was asked for.
      if (next === it.text || next.length > MAX_TEXT_CHARS) continue;
      // `extractText` yields `{text, at}` and no path — the page is the one we
      // are iterating, which is exactly how `textItems` pairs them one function
      // below.
      edits.push({ path: p.path, at: it.at, from: it.text, to: next });
    }
  }
  if (!edits.length) return { pages: Array.isArray(pages) ? pages : [], applied: 0 };
  const r = applyEdits(pages, edits);
  // A REFUSAL LEAVES THE PAGES EXACTLY AS THEY WERE. `applyEdits` fails the whole
  // batch on one bad offset, and a rename that could not be applied must not
  // stop the brand being stored — the title and the link preview are still
  // worth correcting.
  //
  // BELT AND BRACES, AND SAYING SO RATHER THAN PRETENDING IT IS TESTED: a
  // mutation removing this `r.ok` check survives, because `applyEdits` already
  // returns the untouched originals on failure (it edits a separate draft map
  // precisely so it can). That is an EMERGENT property of a function one edit
  // away from changing, and its own comment explains it is deliberate — so the
  // check stays, and the alternative is silently depending on another module's
  // failure shape.
  return r.ok ? { pages: r.pages, applied: r.applied } : { pages: Array.isArray(pages) ? pages : [], applied: 0 };
}

/**
 * Every string on the site, in one flat numbered list.
 *
 * FLAT AND CROSS-PAGE ON PURPOSE. A phone number lives in a footer that is on
 * every page, and a list scoped to one page would change it in one place and
 * leave the site disagreeing with itself — which is worse than not changing it,
 * because nobody notices.
 */
export function textItems(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string") continue;
    for (const it of extractText(p.source)) {
      out.push({ path: p.path, text: it.text, at: it.at });
      if (out.length >= MAX_TEXT_ITEMS) return out;
    }
  }
  return out;
}

/**
 * Turn what the model chose back into edits `site-text.mjs` will accept.
 *
 * EVERY REJECTION HERE IS SILENT AND DELIBERATE. An id nobody offered, a
 * replacement that is empty, one carrying a character that would break the
 * source: none of them is an error the customer can act on, and failing the
 * whole batch over one malformed entry would lose the four good ones beside it.
 * What matters is the count — zero edits is an outcome the lane reports and
 * escalates on, and that is where a model that understood nothing surfaces.
 *
 * `from` IS TAKEN FROM OUR OWN LIST, never from the model. It is what
 * `applyEdit` checks the source still says at that offset, so letting the model
 * supply it would let it authorise its own overwrite.
 */
export function readTextEdits(reply, items) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.edits) || [];
  const list = Array.isArray(items) ? items : [];
  const out = [];
  const seen = new Set();
  for (const e of Array.isArray(raw) ? raw : []) {
    if (!e || typeof e !== "object") continue;
    const id = Math.floor(Number(e.id));
    if (!Number.isFinite(id) || id < 0 || id >= list.length) continue;
    if (seen.has(id)) continue;
    const to = typeof e.to === "string" ? e.to.trim() : "";
    if (!to || to.length > MAX_TEXT_CHARS) continue;
    // The same characters `applyEdit` refuses, checked here so a bad entry costs
    // itself rather than the batch it travelled in.
    if (/["'`{}<>\\]/.test(to)) continue;
    const it = list[id];
    if (to === it.text) continue; // putting back what is already there is not an edit
    seen.add(id);
    out.push({ path: it.path, at: it.at, from: it.text, to });
  }
  return out;
}

/** The four token kinds, in the shape `pageCredits` prices. One price table, everywhere. */
export function textUsage(reply) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model: TEXT_MODEL,
  };
}

/**
 * The whole text layer: strings out, a cheap model call, strings back.
 *
 * `deps.send(request)` → the raw Messages API response.
 *
 * ESCALATES RATHER THAN REPORTING SUCCESS HAVING DONE NOTHING. Three ways to
 * find no target — a site with no extractable words, a model that matched none
 * of them, a batch every entry of which was malformed — and all three answer
 * `{ok:false, escalate:true}`, because the honest reading of "I could not find
 * what you meant" is that this was not a text change. The rung above can do it.
 *
 * A THROW ESCALATES TOO, and bills nothing: `usage` is null on that path, the
 * same our-fault rule the build path follows.
 */
export async function runTextEdit(deps, { instruction, pages } = {}) {
  const items = textItems(pages);
  if (!items.length) return { ok: false, escalate: true, reason: "no-text", usage: null };
  let reply;
  try {
    reply = await deps.send(textRequest({ instruction, items }));
  } catch (e) {
    return { ok: false, escalate: true, reason: "model", detail: String((e && e.message) || "").slice(0, 200), usage: null };
  }
  const usage = textUsage(reply);
  const edits = readTextEdits(reply, items);
  if (!edits.length) return { ok: false, escalate: true, reason: "no-match", usage };
  const ed = applyEdits(pages, edits);
  // A REFUSAL FROM `applyEdits` IS NOT AN ESCALATION, and it is DEFENSIVE rather
  // than a path this function can reach on its own: the offsets it sends are the
  // ones `textItems` just read out of the same objects, so within one call they
  // agree by construction. What it catches is the source moving underneath —
  // a concurrent build finishing between the extract and the apply — which is
  // real and is exactly the case a shared `applyEdits` refuses for.
  //
  // It must NOT go up the ladder: the rung above would be working from the same
  // out-of-date copy, so retrying is what fixes it and a bigger lane is not.
  // Nothing is published either way; `ok:false` is the whole contract.
  if (!ed.ok) return { ok: false, escalate: false, reason: "stale", detail: ed.error, usage };
  return { ok: true, pages: ed.pages, applied: ed.applied, edits, usage };
}

// ── THE DATA LAYER: the content the site STORES ──────────────────────────────
//
// FOUND BY AUDIT, and it is the hole that mattered. A generated site keeps its
// menu, its prices, its services and its opening times in a `display` table and
// renders them with `useRows` — so those words are NOT in the page source, and
// none of the three page-facing layers can reach them. "Change the price of a
// haircut to £25" found no string, escalated to addon, escalated to build, and
// came back ~25 credits later with the price unchanged. Three lanes, real money,
// nothing done: the worst shape there is, and the commonest thing a small
// business asks for.
//
// IT IS ALSO THE CHEAPEST LAYER, and by a distance. Rows are read at RUNTIME by
// the published bundle, so nothing is recompiled and nothing is republished —
// the change is live the moment the UPDATE commits. One Haiku call, no container.
//
// `display` TABLES ONLY, and that is a boundary rather than a simplification. A
// `collect` table holds customers' bookings and enquiries: those rows are the
// visitor's data, not the owner's content, and "cancel John's booking" is not a
// sentence to hand a model. The owner still has the Data panel for those, where
// they can see the row they are changing.

/** Haiku. Picking which row and which column is not a design task. */
export const DATA_MODEL = "claude-haiku-4-5";
export const DATA_MAX_TOKENS = 1200;
/** How many rows the model is shown. A menu is a dozen; a hundred is not a menu. */
export const MAX_DATA_ROWS = 60;
/** How many changes one instruction may make. "Put the prices up by 10%" is a real ask. */
export const MAX_DATA_OPS = 20;

export const DATA_TOOL = {
  name: "write_row_changes",
  description: "Change the content this site stores — a price, a menu item, an opening time — or add a new one.",
  input_schema: {
    type: "object",
    properties: {
      changes: {
        type: "array",
        description:
          "One entry per row that this instruction actually changes, and nothing else. A row you do not mention is " +
          "left exactly as it is.\n" +
          "IF THE INSTRUCTION CANNOT BE DONE BY CHANGING OR ADDING ROWS — it asks to DELETE one, or it is about the " +
          "look of the page rather than what is stored — return an empty array. Guessing at the nearest row is worse " +
          "than saying you could not do it.",
        items: {
          type: "object",
          properties: {
            table: { type: "string", description: "The table name, exactly as listed below." },
            id: { type: "integer", description: "The id of the row to change. LEAVE THIS OUT to add a new row." },
            values: {
              type: "object",
              description:
                "The columns to set, and their new values. Only the columns that change — a column you do not " +
                "mention keeps what it has. Use the column names exactly as listed below. When adding a row, give " +
                "every column the others have, or the new one will look broken beside them. Leave this out when " +
                "you are removing a row.",
            },
            remove: {
              type: "boolean",
              description:
                "True to DELETE the row with this id. Give the `table` and the `id` and nothing else.\n" +
                "ONLY when they clearly asked for something to be taken off the site — \"take the beard trim off " +
                "the menu\", \"we don't do that any more\". Never as a way of replacing a row: to change one, set " +
                "its values. There is no undo for a deleted row.",
            },
          },
          required: ["table"],
        },
      },
    },
    required: ["changes"],
  },
};

const DATA_SYSTEM =
  "You change the content stored by a small business's website — the menu, the prices, the services, the opening " +
  "times. You are given the tables, their columns and their current rows, and one instruction from the owner.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. Everything else is there because they wanted it, and tidying it while you are " +
  "in there is not a favour: they cannot see what you touched.\n\n" +
  "Use their words and their formatting. If the prices around it are written \"£24\", a new one is \"£26\" and not " +
  "\"26.00\". Match what is already there.\n\n" +
  "If they say what the new value is, use it exactly. Only write something yourself when they describe a change " +
  "rather than dictating one.";

/**
 * The tables and rows the model may change, as text.
 *
 * IDS ARE SHOWN AND EVERYTHING ELSE IS THE ROW'S OWN CONTENT. The model picks an
 * id off this list and the caller checks it against the same list before it
 * reaches SQL, so a model cannot name a row it was not offered.
 */
export function dataDigest(tables) {
  const out = [];
  for (const t of Array.isArray(tables) ? tables : []) {
    if (!t || !t.name || !Array.isArray(t.rows)) continue;
    const cols = (Array.isArray(t.columns) ? t.columns : []).filter((c) => typeof c === "string");
    out.push("TABLE " + t.name + " — columns: " + (cols.join(", ") || "(none declared)"));
    for (const r of t.rows.slice(0, MAX_DATA_ROWS)) {
      const bits = cols.map((c) => c + "=" + JSON.stringify(r[c] === undefined ? null : r[c]));
      out.push("  id " + r.id + ": " + bits.join(", "));
    }
    if (!t.rows.length) out.push("  (no rows yet)");
  }
  return out.join("\n");
}

/** At most this many removed rows are carried forward as undo context. */
export const MAX_RECENT = 3;

/**
 * What was just deleted, so "put it back" has something to refer to.
 *
 * THE REPLY PROMISES AN UNDO AND THIS IS THE ONLY THING THAT MAKES IT TRUE. A
 * deleted row is gone from the table, so `dataDigest` — which lists what the
 * site has NOW — cannot mention it, and a model asked to "put the beard trim
 * back" was handed an instruction with no referent and rows that no longer
 * contain it. It matched nothing and refused, on a promise made one message
 * earlier.
 *
 * The contents come from the client, which rendered them; they are not trusted
 * for anything except being SHOWN to the model. Whatever it does with them still
 * goes through `readDataChanges`, which admits only declared tables, declared
 * columns and scalar values — so this widens what can be ASKED for and nothing
 * about what can be written.
 *
 * WORDED SO IT IS NOT AN INSTRUCTION TO RE-ADD. It rides on every data edit
 * while it is the latest removal, so a block that read as "restore these" would
 * put a row back on an unrelated change. It says plainly that it is only for a
 * request to undo.
 */
export function recentBlock(recent) {
  const rows = (Array.isArray(recent) ? recent : [])
    .filter((r) => r && typeof r.table === "string" && r.was && typeof r.was === "object" && !Array.isArray(r.was))
    .slice(0, MAX_RECENT);
  if (!rows.length) return "";
  const lines = rows.map((r) => {
    const bits = Object.keys(r.was)
      .filter((k) => k !== "id" && (typeof r.was[k] === "string" || typeof r.was[k] === "number" || typeof r.was[k] === "boolean"))
      .slice(0, 12)
      .map((k) => k + "=" + JSON.stringify(String(r.was[k]).slice(0, 200)));
    return "  " + r.table + ": " + bits.join(", ");
  }).filter((l) => l.trim().length > 3);
  if (!lines.length) return "";
  return "\n\nJUST REMOVED FROM THIS SITE\nThese rows were deleted a moment ago and are no longer in the tables above.\n" +
    lines.join("\n") +
    "\nONLY USE THIS IF THEY ARE ASKING FOR SOMETHING TO BE PUT BACK — \"undo that\", \"put it back\", \"I didn't " +
    "mean to delete that\". Then add the row again with these values. For any other instruction, ignore this " +
    "entirely: it is a record of what went, not a list of things to restore.";
}

export function dataRequest({ instruction, tables, recent }) {
  return {
    model: DATA_MODEL,
    max_tokens: DATA_MAX_TOKENS,
    tools: [DATA_TOOL],
    tool_choice: { type: "tool", name: "write_row_changes" },
    system: [{ type: "text", text: DATA_SYSTEM }],
    messages: [{
      role: "user",
      content: "WHAT THIS SITE STORES\n" + dataDigest(tables) + recentBlock(recent) +
        "\n\nWHAT THEY ASKED FOR\n" + String(instruction || "").trim().slice(0, 2000),
    }],
  };
}

/**
 * What came back, checked against what was offered.
 *
 * EVERY REJECTION IS SILENT AND THE COUNT IS WHAT MATTERS — zero changes is an
 * outcome the caller reports rather than an error, and it is where a model that
 * understood nothing surfaces. A table nobody offered, a column the table does
 * not declare, an id that is not in the list: each is dropped on its own rather
 * than failing the batch beside it.
 *
 * A VALUE MUST BE A SCALAR. An object or an array in a column is the `Row` index
 * signature error this repo already records, arriving from the other direction.
 */
export function readDataChanges(reply, tables) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.changes) || [];
  const byName = new Map();
  for (const t of Array.isArray(tables) ? tables : []) {
    if (t && t.name) byName.set(String(t.name), {
      cols: new Set((Array.isArray(t.columns) ? t.columns : []).filter((c) => typeof c === "string")),
      ids: new Set((Array.isArray(t.rows) ? t.rows : []).map((r) => Number(r.id))),
      rows: Array.isArray(t.rows) ? t.rows : [],
    });
  }
  const out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== "object") continue;
    const t = byName.get(String(c.table || ""));
    if (!t) continue;
    // A REMOVAL, and it must name a row we offered. The row's own contents are
    // carried along from OUR list — never the model's — because the reply echoes
    // them back, and that echo is the ONLY undo a deleted row has. Pages are
    // archived on every publish and can be restored; rows are not.
    if (c.remove === true) {
      const rid = Math.floor(Number(c.id));
      if (!Number.isFinite(rid) || !t.ids.has(rid)) continue;
      const was = t.rows.find((r) => Number(r.id) === rid) || null;
      out.push({ table: String(c.table), id: rid, remove: true, was });
      if (out.length >= MAX_DATA_OPS) break;
      continue;
    }
    const values = c.values && typeof c.values === "object" && !Array.isArray(c.values) ? c.values : null;
    if (!values) continue;
    const set = {};
    for (const [k, v] of Object.entries(values)) {
      if (!t.cols.has(k)) continue;
      if (v === null) { set[k] = null; continue; }
      if (typeof v === "object") continue; // a shape in a column is not a value
      set[k] = typeof v === "string" ? v.slice(0, 2000) : v;
    }
    if (!Object.keys(set).length) continue;
    if (c.id === undefined || c.id === null) { out.push({ table: String(c.table), values: set }); }
    else {
      const id = Math.floor(Number(c.id));
      // AN ID WE DID NOT OFFER IS NOT A ROW. Checked against the list the model
      // was shown, so it cannot reach SQL by naming a number.
      if (!Number.isFinite(id) || !t.ids.has(id)) continue;
      out.push({ table: String(c.table), id, values: set });
    }
    if (out.length >= MAX_DATA_OPS) break;
  }
  return out;
}

/** The four token kinds, in the shape `pageCredits` prices. One price table, everywhere. */
export function dataUsage(reply) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model: DATA_MODEL,
  };
}

/**
 * The whole data layer.
 *
 * `deps.send(request)` → the Messages API response.
 * `deps.apply(change)`  → performs one update or insert, returns truthy on success.
 *
 * NO PUBLISH STEP AT ALL. The published bundle reads these rows at runtime, so
 * the change is live the moment it commits — this is the only layer that costs
 * no container time.
 *
 * ESCALATES ONLY WHEN THERE WAS NOTHING TO WORK WITH. A site with no `display`
 * table really might want a page change instead. But a model that read the rows
 * and matched none of them does NOT escalate: the rungs above cannot change a
 * row either, so sending them up spends ~25 credits to fail differently.
 */
export async function runDataEdit(deps, { instruction, tables, recent } = {}) {
  const usable = (Array.isArray(tables) ? tables : []).filter((t) => t && t.name && Array.isArray(t.rows));
  if (!usable.length) return { ok: false, escalate: true, reason: "no-data", usage: null };
  let reply;
  try {
    reply = await deps.send(dataRequest({ instruction, tables: usable, recent }));
  } catch (e) {
    return { ok: false, escalate: true, reason: "model", detail: String((e && e.message) || "").slice(0, 200), usage: null };
  }
  const usage = dataUsage(reply);
  const changes = readDataChanges(reply, usable);
  if (!changes.length) return { ok: false, escalate: false, reason: "no-match", usage };

  const applied = [], failed = [];
  for (const c of changes) {
    try {
      const ok = await deps.apply(c);
      (ok ? applied : failed).push(c);
    } catch { failed.push(c); }
  }
  // A PARTIAL APPLY IS REPORTED, NOT HIDDEN. Rows are independent — unlike a
  // page, where half an edit is a file that does not compile — so the four that
  // worked are worth keeping, and the owner has to be told about the one that
  // did not or they will believe all five landed.
  if (!applied.length) return { ok: false, escalate: false, reason: "write", usage, failed: failed.length };
  return { ok: true, applied, failed: failed.length, usage };
}
