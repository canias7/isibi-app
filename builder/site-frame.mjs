// THE WRITTEN FRAME: editing a header and a footer the model wrote itself
// (2026-10-23, `build-ai-writes-all`).
//
// A first build since that branch has no `SiteChrome`. Its header and footer
// are the site's own components, `-parts/site-header.tsx` and
// `-parts/site-footer.tsx`, written by two writers beside the bands (or by the
// one call's fallback, told to write the same two files). The menu editor
// (`site-nav.mjs`) reads `SiteChrome`'s props — `links`, `action`, `contact`,
// `social`, `hours` — and finds none on such a site, so "take Gallery out of
// the menu" or "add Instagram to the footer" would answer `no-nav`.
//
// SO A SITE WITH A WRITTEN FRAME IS EDITED AS SOURCE. One model call is shown
// the change, the site's routes and the two files whole, and answers each file
// it changed, whole. Nothing here knows what a menu or a footer link is: the
// model edits the TSX the way the page writer does, and this module checks the
// answer the way the band path checks a band — and the publish that follows
// compiles it, so a file that does not build leaves the site untouched.
//
// WHAT IS CHECKED, MECHANICALLY, before anything is published:
//   - a file answered is a string under the size bound, and still has its
//     default export (the shell imports the default);
//   - no `SiteChrome`, and nothing from the kit but the plumbing modules;
//   - every internal link (`to="/x"`, `href="/x"`) is one of the site's routes,
//     so a menu item can never point at a page the site does not have;
//   - a file answered unchanged is not a change.
//
// A SITE WITH `SiteChrome` IS NEVER READ HERE (`writtenFrame` answers null),
// so every kit site's menu edits run exactly as before.
//
// Plain module, the model call injected, never throws.

import { modelsFor } from "./build-models.mjs";
import { QUESTION_FIELD, askOf } from "./clarify.mjs";
import { OWN_PARTS_RULE } from "./page-bands.mjs";
import { retryRequest, addUsages } from "./retry-reason.mjs";
import { resolveAccess, isManagedColumn } from "../site-access.mjs";

export const FRAME_PARTS = [
  { role: "header", file: "site-header", name: "SiteHeader" },
  { role: "footer", file: "site-footer", name: "SiteFooter" },
];
export const FRAME_EDIT_MODEL = modelsFor().quick;
export const FRAME_EDIT_MAX_TOKENS = 12000;
export const MAX_FRAME_CHARS = 24000;
export const FRAME_PLUMBING = ["@/components/ui/safe-image", "@/components/ui/lang-switch"];

const CHROME_RE = /\bSiteChrome\b/;

/**
 * The site's written frame, or `null` when it has none.
 *
 * A FACT ABOUT THE FILES, NEVER ABOUT THE REQUEST: at least one of the two
 * frame parts is stored, and no page names `SiteChrome`. A site carrying both
 * (a hand edit, an old page beside a new one) is a kit site here — the menu
 * editor still has its props to read, and that path is unchanged.
 */
export function writtenFrame(pages, parts) {
  const list = Array.isArray(parts) ? parts : [];
  const got = {};
  for (const f of FRAME_PARTS) {
    const p = list.find((x) => x && typeof x.name === "string" && x.name.trim().toLowerCase() === f.file && typeof x.source === "string" && x.source.trim());
    if (p) got[f.role] = { name: p.name, source: p.source };
  }
  if (!got.header && !got.footer) return null;
  for (const p of Array.isArray(pages) ? pages : []) {
    if (p && typeof p.source === "string" && CHROME_RE.test(p.source)) return null;
  }
  return got;
}

/** Whether a site writes its own parts: the same fact, as a boolean. */
export function ownPartsSite(pages, parts) {
  return writtenFrame(pages, parts) !== null;
}

export const FRAME_EDIT_TOOL = {
  name: "edit_frame",
  description: "Answer the site's header and/or footer file, changed as asked.",
  input_schema: {
    type: "object",
    properties: {
      header: {
        type: "string",
        description: "The COMPLETE new source of the header file, only when the change needs it changed. Leave it out otherwise.",
      },
      footer: {
        type: "string",
        description: "The COMPLETE new source of the footer file, only when the change needs it changed. Leave it out otherwise.",
      },
      cannot: {
        type: "string",
        description: "Only when the change cannot be made in the header or the footer: one short sentence to the customer saying why. Leave both files out then.",
      },
      question: QUESTION_FIELD,
    },
  },
};

export const FRAME_EDIT_RULES =
  "You edit the header and the footer of a small business website. They are two React components in TypeScript, " +
  "each in its own file with a default export, placed around every page. You are given the change the customer asked " +
  "for, the site's pages, and both files whole.\n\n" +
  "HOW YOU ANSWER\n" +
  "- Answer only the file(s) the change needs, each COMPLETE, through edit_frame. A file you leave out is kept exactly as it is.\n" +
  "- Change only what was asked. Keep every other word, link, class, import and behaviour exactly as it is.\n" +
  "- Keep the file's default export and its component's name.\n" +
  "- A link to a page of this site uses <Link to=\"/path\"> from \"@tanstack/react-router\" and ONLY a path from THE SITE'S PAGES. " +
  "Anything else (another site, a social account, mailto:, tel:) is an <a href=…>.\n" +
  "- Never invent a phone number, an email, an address, opening hours or a social account the customer did not give you: " +
  "when the change needs one and it is not in their words or the files, ask through `question`.\n" +
  "- The logo: `SITE_LOGO` from \"@/site-brand\" is the logo's address, or \"\" when there is none.\n" +
  "- When the change is not about the header or the footer, answer `cannot`.\n" +
  // THE CHECK'S OWN LIST, SAID (2026-10-25, driftwood-and-daughters-5's job
  // 75f25f2f): `frameFileProblems` refuses every "@/components/ui/" or
  // "@/components/charts/" import but these, and the rules never named them —
  // the model imported `@/components/ui/figure` for a footer and the whole
  // edit was refused (`footer:kit:@/components/ui/figure`).
  "- From \"@/components/ui/\" and \"@/components/charts/\" these files may import ONLY " + FRAME_PLUMBING.map((p) => "\"" + p + "\"").join(" and ") +
  ", and only where the file already does. Any other module there is refused and nothing is changed: write the markup yourself " +
  "(a sign-up form is a plain <form> with an <input> and a <button>).\n" +
  "- A form that stores what a visitor sends (a newsletter sign-up, a message) stores it in ONE of the TABLES A FORM HERE MAY STORE INTO, " +
  "the one that fits: `const add = useCreateRow(\"<table>\")` from \"@/lib/rows\", and on submit `add.mutate({ <column>: value })` with only that table's columns, " +
  "every required one filled; show a thank-you after `add.isSuccess` and a short error after `add.isError`. Spam protection is added by the site on its own. " +
  "Never name a table that is not listed; when none fits, answer `cannot` for that form.\n\n" + OWN_PARTS_RULE;

// ── A FORM IN THE FRAME THAT STORES WHAT IT IS SENT (2026-10-25, frame-parallel) ──
//
// Live on driftwood-and-daughters-5: "a newsletter sign-up in the footer". The
// site HAS a `newsletter_signups` table a visitor may write, and the frame's
// files may import "@/lib/rows" (only the kit is refused), but the call was
// never told the site's tables: its only instruction was "a plain <form>", so
// a sign-up either stored nothing or named a table the check could not know.
// Now the tables a visitor may write (`write: "anyone"`, read from the site's
// own schema by `resolveAccess`, never by preset name) are listed with their
// columns, the rule says how to store into one (`useCreateRow`, which also
// carries the site's spam protection), and the check refuses a frame naming a
// table it was not shown (`table:<name>`), which the one retry then fixes.

/** The tables a visitor's form may write, `[{ name, columns }]`, from a schema. */
export function frameTables(spec) {
  const list = spec && Array.isArray(spec.tables) ? spec.tables : [];
  const out = [];
  for (const t of list) {
    if (!t || typeof t.name !== "string" || !t.name.trim() || t.retired) continue;
    if (resolveAccess(t).write !== "anyone") continue;
    const cols = (Array.isArray(t.columns) ? t.columns : [])
      .filter((c) => c && typeof c.name === "string" && c.name && !isManagedColumn(c.name))
      .map((c) => ({ name: c.name, type: typeof c.type === "string" ? c.type : "", required: c.required === true || c.notnull === true }));
    out.push({ name: t.name, columns: cols });
  }
  return out;
}

function tablesBlock(tables) {
  const list = Array.isArray(tables) ? tables : [];
  if (!list.length) return "\n\nTABLES A FORM HERE MAY STORE INTO\nNone. A form that would store what a visitor sends (a sign-up, a message) cannot be made here: answer `cannot` for it, saying that it needs somewhere to store the entries.";
  return "\n\nTABLES A FORM HERE MAY STORE INTO (a visitor may add a row; nothing else)\n" + list.map((t) =>
    "- " + t.name + ": " + (t.columns.length ? t.columns.map((c) => c.name + (c.type ? " " + c.type : "") + (c.required ? " (required)" : "")).join(", ") : "(no columns)")).join("\n");
}

/** The exact body sent. */
export function frameEditRequest({ instruction, frame, routes, addition = false, note = "", tables = null, model = FRAME_EDIT_MODEL } = {}) {
  const f = frame && typeof frame === "object" ? frame : {};
  const pages = (Array.isArray(routes) ? routes : []).filter((r) => typeof r === "string" && r);
  const files = FRAME_PARTS.filter((p) => f[p.role]).map((p) =>
    "THE " + p.role.toUpperCase() + " FILE (src/routes/-parts/" + p.file + ".tsx)\n" + f[p.role].source).join("\n\n");
  return {
    model,
    max_tokens: FRAME_EDIT_MAX_TOKENS,
    system: FRAME_EDIT_RULES,
    tools: [FRAME_EDIT_TOOL],
    tool_choice: { type: "tool", name: FRAME_EDIT_TOOL.name },
    messages: [{
      role: "user",
      content:
        "THE CHANGE THEY ASKED FOR\n" + String(instruction == null ? "" : instruction).trim() +
        (addition ? "\n\nTHIS IS AN ADDITION: add what was asked and change nothing that is already there." : "") +
        (note ? "\n\n" + String(note) : "") +
        "\n\nTHE SITE'S PAGES\n" + (pages.length ? pages.join(", ") : "/") +
        tablesBlock(tables) +
        "\n\n" + files,
    }],
  };
}

function toolInput(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use" && b.name === FRAME_EDIT_TOOL.name);
  return use && use.input && typeof use.input === "object" ? use.input : null;
}

/** Every internal path a file links to: `to="/x"`, `to={"/x"}`, `href="/x"`. */
export function internalLinks(source) {
  const out = [];
  const re = /\b(?:to|href)\s*=\s*\{?\s*["'`](\/[^"'`]*)["'`]/g;
  for (const m of String(source || "").matchAll(re)) out.push(m[1]);
  return out;
}

function routeKey(path) {
  const p = String(path || "").split("#")[0].split("?")[0];
  const t = p.length > 1 ? p.replace(/\/+$/, "") : p;
  return (t || "/").toLowerCase();
}

/** Every table a file names through "@/lib/rows" hooks. */
export function frameTableUses(source) {
  const out = [];
  const re = /\buse(?:CreateRow|Rows|Row|UpdateRow|DeleteRow)\s*(?:<[^>()]*>)?\s*\(\s*["'`]([^"'`]+)["'`]/g;
  for (const m of String(source || "").matchAll(re)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** What is wrong with one answered file, `[]` when nothing is. `tables`: the
 *  names a form may store into; a table hook naming any other is refused. */
export function frameFileProblems(source, routes, tables = []) {
  const s = typeof source === "string" ? source : null;
  if (s === null || !s.trim()) return ["empty"];
  const why = [];
  if (s.length > MAX_FRAME_CHARS) why.push("too-big");
  if (!/\bexport\s+default\b/.test(s)) why.push("no-default-export");
  if (CHROME_RE.test(s)) why.push("site-chrome");
  for (const m of s.matchAll(/from\s+["'](@\/components\/(?:ui|charts)\/[^"']+)["']/g)) {
    if (!FRAME_PLUMBING.includes(m[1])) { why.push("kit:" + m[1]); }
  }
  const allowed = new Set(["/", ...(Array.isArray(routes) ? routes : []).map(routeKey)]);
  for (const l of internalLinks(s)) {
    if (!allowed.has(routeKey(l))) why.push("route:" + l);
  }
  const okTables = new Set((Array.isArray(tables) ? tables : []).map((t) => (typeof t === "string" ? t : t && t.name)).filter(Boolean));
  const created = new Set();
  for (const m of s.matchAll(/\buseCreateRow\s*(?:<[^>()]*>)?\s*\(\s*["'`]([^"'`]+)["'`]/g)) created.add(m[1]);
  for (const t of frameTableUses(s)) {
    if (!created.has(t) || !okTables.has(t)) why.push("table:" + t);
  }
  return why;
}

/**
 * The model's answer, checked. `{ ok, frame, changed }` with the files it
 * changed replaced, or `{ ok: false, reason }`.
 */
export function readFrameEdit(reply, frame, routes, tables = []) {
  const input = toolInput(reply);
  if (!input) return { ok: false, reason: "no-answer" };
  const f = frame && typeof frame === "object" ? frame : {};
  const next = { ...f };
  const changed = [];
  const problems = [];
  for (const p of FRAME_PARTS) {
    if (!Object.hasOwn(input, p.role) || input[p.role] === undefined || input[p.role] === null) continue;
    if (!f[p.role]) { problems.push(p.role + ":absent"); continue; }
    const src = input[p.role];
    // A HOOK THE STORED FILE ALREADY HAD is the site's own and is not judged
    // again (only what this answer adds is).
    const had = new Set(frameTableUses(f[p.role].source));
    const why = frameFileProblems(src, routes, tables).filter((w) => !(w.startsWith("table:") && had.has(w.slice(6))));
    if (why.length) { problems.push(...why.map((w) => p.role + ":" + w)); continue; }
    if (src.trim() === f[p.role].source.trim()) continue;
    next[p.role] = { name: f[p.role].name, source: src.replace(/\s*$/, "\n") };
    changed.push(p.role);
  }
  if (problems.length) return { ok: false, reason: "refused", problems };
  if (!changed.length) {
    const cannot = typeof input.cannot === "string" && input.cannot.trim() ? input.cannot.trim().slice(0, 300) : "";
    return { ok: false, reason: cannot ? "cannot" : "unchanged", cannot };
  }
  return { ok: true, frame: next, changed };
}

/** The parts list with the frame's changed files put back, by name. */
export function withFrame(parts, frame, changed) {
  const f = frame && typeof frame === "object" ? frame : {};
  const roles = new Set(Array.isArray(changed) ? changed : []);
  return (Array.isArray(parts) ? parts : []).map((p) => {
    for (const r of FRAME_PARTS) {
      if (roles.has(r.role) && f[r.role] && p && p.name === f[r.role].name) return { ...p, source: f[r.role].source };
    }
    return p;
  });
}

export function frameUsage(reply, model = FRAME_EDIT_MODEL) {
  const u = reply && reply.usage;
  if (!u) return null;
  return {
    model,
    in: u.input_tokens || 0,
    out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
}

/** What the customer is told: which of the two files changed, on every page. */
export function frameReply(changed) {
  const c = Array.isArray(changed) ? changed : [];
  const what = c.includes("header") && c.includes("footer") ? "the header and the footer"
    : c.includes("footer") ? "the footer" : "the header";
  return "Done — I changed " + what + ", on every page.";
}

/**
 * One edit of the written frame. NEVER THROWS.
 *
 * `{ ok: true, parts, changed, msg, usage }` — `parts` is the whole stored list
 * with the changed files replaced, ready for the publish (which compiles it).
 * `{ ok: false, reason, msg, usage }` otherwise; `ask` when the model asked.
 */
/** The retry's reason, in plain words, from the check that refused the answer. */
export function frameRetryReason(read) {
  if (!read || read.reason === "no-answer") return "You did not answer through edit_frame. Answer the file(s) the change needs, each complete, through edit_frame.";
  const said = (Array.isArray(read.problems) ? read.problems : []).map((p) => {
    const [role, ...rest] = String(p).split(":");
    const w = rest.join(":");
    if (w.startsWith("kit:")) return "the " + role + " imports " + w.slice(4) + ", which is not allowed: only " + FRAME_PLUMBING.join(" and ") + " may be imported from the kit, so write that markup yourself";
    if (w.startsWith("route:")) return "the " + role + " links to " + w.slice(6) + ", which is not one of the site's pages";
    if (w === "no-default-export") return "the " + role + " lost its default export";
    if (w === "site-chrome") return "the " + role + " uses SiteChrome, which these files must not";
    if (w.startsWith("table:")) return "the " + role + " stores into or reads " + w.slice(6) + ", which is not one of the TABLES A FORM HERE MAY STORE INTO (only useCreateRow into a listed table is allowed)";
    if (w === "too-big") return "the " + role + " is longer than " + MAX_FRAME_CHARS + " characters";
    if (w === "absent") return "the site has no " + role + " file to change";
    if (w === "empty") return "the " + role + " was answered empty";
    return "the " + role + " failed a check (" + w + ")";
  });
  return "Nothing was changed, because your answer failed these checks: " + said.join("; ") + ". Answer again through edit_frame, each file complete, fixing exactly these and changing nothing else.";
}

export async function runFrameEdit(deps, { instruction, pages, parts, routes, addition = false, note = "", tables = null, model = FRAME_EDIT_MODEL } = {}) {
  const frame = writtenFrame(pages, parts);
  if (!frame) return { ok: false, reason: "no-frame", usage: null };
  let reply = null;
  const request = frameEditRequest({ instruction, frame, routes, addition, note, tables, model });
  try {
    reply = await deps.send(request);
  } catch (e) {
    return { ok: false, reason: "send", error: e, usage: null };
  }
  let usage = frameUsage(reply, model);
  const ask = askOf(reply);
  if (ask) return { ok: false, reason: "ask", ask, usage };
  let read = readFrameEdit(reply, frame, routes, tables || []);
  // NEVER A COMPLETE FAILURE WITHOUT ONE RETRY (owner, 2026-10-24/25): an
  // answer the checks refused, or no answer at all, is sent back once with the
  // check's own reason — the same request, the same model and effort
  // (`retryRequest`). `cannot` and `unchanged` are answers, never retried.
  let retried = false;
  if (!read.ok && (read.reason === "refused" || read.reason === "no-answer")) {
    retried = true;
    const reason = frameRetryReason(read);
    let again = null;
    try { again = await deps.send(retryRequest(request, reply, reason)); } catch { again = null; }
    if (again) {
      usage = addUsages(usage, frameUsage(again, model));
      const ask2 = askOf(again);
      if (ask2) return { ok: false, reason: "ask", ask: ask2, usage, retried };
      read = readFrameEdit(again, frame, routes, tables || []);
    }
  }
  if (!read.ok) {
    const msg = read.reason === "cannot" ? read.cannot
      : read.reason === "unchanged" ? "That's already how the header and footer are, so I left them as they were."
      : "I couldn't make that change to the header or footer safely, so your site is unchanged.";
    return { ok: false, reason: read.reason, problems: read.problems, msg, usage, retried };
  }
  return { ok: true, parts: withFrame(parts, read.frame, read.changed), changed: read.changed, msg: frameReply(read.changed), usage, retried };
}

// ── A NEW PAGE'S LINK IN THE WRITTEN FRAME (2026-10-23) ─────────────────────
//
// The add-on step puts a new page in every menu with `applyAdditions`, which
// writes `SiteChrome`'s `links` prop. A written frame has no such prop, so on
// such a site the link goes into the written header (and the footer, when it
// has a link list of its own) instead — in the same publish as the new page,
// which compiles the parts with the pages.
//
// DETERMINISTIC FIRST, AND ONLY WHERE THE LIST IS UNAMBIGUOUS: exactly one run
// of two or more link entries of one shape in the file — either objects
// `{ to: "/x", label: "X" }` (keys `to`/`href` and `label`/`name`/`title`/
// `text`, either order) in an array, or sibling `<Link to="/x" …>X</Link>`
// elements. The new entry is a copy of the run's last one with the path and
// the words replaced, so its classes and shape are the writer's own. Anything
// else is not guessed: the caller hands the change to `runFrameEdit` as an
// addition.

const LIST_KEY_TO = "(?:to|href)";
const LIST_KEY_LABEL = "(?:label|name|title|text)";
const OBJ_RE = new RegExp(
  "\\{\\s*(?:" + LIST_KEY_TO + "\\s*:\\s*([\"'])(\\/[^\"']*)\\1\\s*,\\s*" + LIST_KEY_LABEL + "\\s*:\\s*([\"'])([^\"']*)\\3" +
  "|" + LIST_KEY_LABEL + "\\s*:\\s*([\"'])([^\"']*)\\5\\s*,\\s*" + LIST_KEY_TO + "\\s*:\\s*([\"'])(\\/[^\"']*)\\7)\\s*,?\\s*\\}", "g");
const JSX_RE = /<Link\b[^>]*?\bto\s*=\s*(["'])(\/[^"']*)\1[^>]*>([^<{}]*)<\/Link>/g;

function runsOf(source, re, sepOk) {
  const runs = [];
  let cur = [];
  for (const m of String(source).matchAll(re)) {
    const prev = cur[cur.length - 1];
    if (prev && sepOk(source.slice(prev.index + prev[0].length, m.index))) cur.push(m);
    else { if (cur.length) runs.push(cur); cur = [m]; }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length >= 2);
}

const objPath = (m) => (m[2] !== undefined ? m[2] : m[8]);
const objLabel = (m) => (m[4] !== undefined ? m[4] : m[6]);
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The source with each add appended to its one link list; `null` when no list is unambiguous. */
export function insertFrameLinks(source, adds) {
  const s = typeof source === "string" ? source : "";
  const items = (Array.isArray(adds) ? adds : []).filter((a) => a && typeof a.href === "string" && a.href.startsWith("/") && typeof a.label === "string" && a.label.trim());
  if (!s || !items.length) return null;
  if (items.some((a) => /["'`{}<>\\\n$]/.test(a.label + a.href))) return null;
  const objRuns = runsOf(s, OBJ_RE, (gap) => /^\s*,\s*$/.test(gap));
  const jsxRuns = runsOf(s, JSX_RE, (gap) => /^\s*$/.test(gap));
  if (objRuns.length + jsxRuns.length !== 1) return null;
  const isObj = objRuns.length === 1;
  const run = isObj ? objRuns[0] : jsxRuns[0];
  const have = new Set(run.map((m) => routeKey(isObj ? objPath(m) : m[2])));
  const fresh = items.filter((a) => !have.has(routeKey(a.href)));
  if (!fresh.length) return { source: s, added: [] };
  const last = run[run.length - 1];
  const before = run[run.length - 2];
  const gap = s.slice(before.index + before[0].length, last.index);
  const clones = fresh.map((a) => {
    if (isObj) {
      const quoted = new RegExp("([\"'])" + reEsc(objLabel(last)) + "\\1");
      return last[0].replace(new RegExp("([\"'])" + reEsc(objPath(last)) + "\\1"), "$1" + a.href + "$1").replace(quoted, "$1" + a.label + "$1");
    }
    const words = last[3];
    const lead = words.match(/^\s*/)[0], tail = words.match(/\s*$/)[0];
    const open = last[0].slice(0, last[0].length - words.length - "</Link>".length).replace(/(\bto\s*=\s*["'])\/[^"']*/, "$1" + a.href);
    return open + lead + a.label + tail + "</Link>";
  });
  const end = last.index + last[0].length;
  const out = s.slice(0, end) + clones.map((c) => gap + c).join("") + s.slice(end);
  return { source: out, added: fresh.map((a) => a.href) };
}

/**
 * The new pages' links in the written frame. NEVER THROWS.
 *
 * `adds` are `menuLinkAdds`' entries (`{ item: { label, href } }`). The header
 * takes them; the footer takes them only when it has its own link list. When
 * the header's list is not unambiguous, one `runFrameEdit` call (an addition)
 * is asked instead, when `deps.send` is given.
 * `{ ok: true, parts, changed, how, usage }` or `{ ok: false, reason, usage }`.
 */
export async function addFrameLinks(deps, { pages, parts, routes, adds } = {}) {
  const frame = writtenFrame(pages, parts);
  if (!frame) return { ok: false, reason: "no-frame", usage: null };
  const items = (Array.isArray(adds) ? adds : []).map((a) => a && a.item).filter((i) => i && typeof i.href === "string" && typeof i.label === "string");
  if (!items.length) return { ok: false, reason: "nothing", usage: null };
  const head = frame.header ? insertFrameLinks(frame.header.source, items) : null;
  if (head) {
    const next = { ...frame };
    const changed = [];
    for (const p of FRAME_PARTS) {
      if (!frame[p.role]) continue;
      const r = p.role === "header" ? head : insertFrameLinks(frame[p.role].source, items);
      if (!r || !r.added.length) continue;
      const had = new Set(frameTableUses(frame[p.role].source));
      if (frameFileProblems(r.source, routes).filter((w) => !(w.startsWith("table:") && had.has(w.slice(6)))).length) return { ok: false, reason: "refused", usage: null };
      next[p.role] = { name: frame[p.role].name, source: r.source };
      changed.push(p.role);
    }
    if (!changed.length) return { ok: false, reason: "unchanged", usage: null };
    return { ok: true, parts: withFrame(parts, next, changed), changed, how: "inserted", usage: null };
  }
  if (!deps || typeof deps.send !== "function") return { ok: false, reason: "no-list", usage: null };
  const said = items.map((i) => "\"" + i.label + "\" (" + i.href + ")").join(", ");
  const out = await runFrameEdit(deps, {
    instruction: "Add a link to the new page" + (items.length > 1 ? "s " : " ") + said +
      " to the header's menu, after its other page links, and to the footer's page links if the footer lists the pages.",
    pages, parts, routes, addition: true,
  });
  if (!out.ok) return { ok: false, reason: out.reason, usage: out.usage || null };
  return { ok: true, parts: out.parts, changed: out.changed, how: "model", usage: out.usage };
}
