// The routing-only batch: each message routed once by the real router, and
// nothing ever acted on (the router audit, 2026-10-02, on the owner's word).
//
// ── WHY A MODE OF ITS OWN ──────────────────────────────────────────────────
//
// The audit's questions are about one call: what the real router answers for
// a message, and whether that answer is the model's own or a conversion. The
// edit canary could ask that only as the first step of a paid edit: a matching
// route went on to post the edit, so each question cost an edit as well, and
// each needed a press of its own. This mode asks every question in one press
// and posts nothing but the routing call.
//
// ── IT CANNOT EDIT, ADD, BUILD OR PUBLISH, AND THAT IS ENFORCED, NOT PROMISED ─
//
// Three walls, each enough on its own:
//   1. the flow here is handed two functions, a page-list read and the routing
//      call, and has no other verb to reach for;
//   2. in this mode the canary's own request helper (`call`) asks
//      `assertProbeCall` first, which allows exactly the reads and the one
//      routing call `probeCallAllowed` names and THROWS on anything else
//      before a byte leaves; and its `fetch` is wrapped by `guardFetch`, which
//      allows the balance read alone;
//   3. the canary EXITS at the end of this mode, above every free edit check,
//      the inventory and the paid edit, so none of that code runs.
//
// ── THE BATCH IS A COMMITTED FILE, NAMED IN THE BOX ────────────────────────
//
// The form takes a batch's name, never its messages: the probes, their sites
// and their intended outcomes are reviewed in the repository
// (`scripts/router-probes/<name>.json`), and the press prints the file's
// sha256 so the run says exactly which list it routed.
//
// ── A DIFFERENT ANSWER IS A FINDING, NOT A FAILURE ─────────────────────────
//
// Each answer is set beside its intended outcome and its decision source. The
// batch stops early only when it cannot read an answer honestly: signed out, a
// route that does not answer 200, or a reply with no readable decision (a
// Worker that does not report where its answers come from, whose `addon`
// could be a conversion).
//
// ── A HELD-BACK PART IS JUDGED BY WHAT IT HOLDS BACK, NEVER BY BEING THERE ─
//
// An intended answer that holds a part back names that part (`held`) and the
// part its own route must make (`runs`), both in the probe's own words. The
// answer's `alsoAsked` is then read with the product's own locator
// (`heldBack`, the one the route uses) over the probe's message: what the
// route would really take out, and what it would really run. Text the
// message does not contain, the wrong clause, part of a clause, or more than
// the other part is a difference, never a match (the owner's review,
// 2026-10-02: C1 had matched for `addon` holding back the addition, which
// leaves the price edit to run on the add-on path).
import { createHash } from "node:crypto";
import { ASK_TOOL, EDIT_LAYERS, MAX_MESSAGE, ROUTE_REASONS, ROUTE_SOURCES, heldBack, wordsIn } from "../builder/site-ask.mjs";

/** Where committed batches live, relative to the repository's root. */
export const PROBE_DIR = "scripts/router-probes";
/** At most this many probes in one press. */
export const MAX_PROBES = 20;
/** The most one routing call has cost in recent runs (2 in most, 3 in run 88): the batch's balance floor is this per probe. */
export const PROBE_COST_MAX = 3;

const INTENTS = ASK_TOOL.input_schema.properties.intent.enum;
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const BATCH_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;
const PROBE_ID = /^[A-Z][A-Z0-9-]{0,11}$/;
const PROBE_KEYS = ["id", "site", "name", "message", "attached", "given", "intended", "basis", "note"];
const ALT_KEYS = ["intent", "layer", "page", "remove", "alsoAsked", "held", "runs"];
/** The answer's own fields an alternative is matched on; `held` and `runs` say what `alsoAsked: "some"` must be. */
const FIELD_KEYS = ["intent", "layer", "page", "remove", "alsoAsked"];

/**
 * The form's box, read whole. Blank is no batch; anything else must be a
 * committed batch's name: lowercase letters, digits and dashes, so it can
 * never name a path outside `PROBE_DIR`.
 *
 * @returns {{ ok: true, name: string | null } | { ok: false, msg: string }}
 */
export function readProbeBox(raw) {
  if (raw === undefined || raw === null) return { ok: true, name: null };
  if (typeof raw !== "string") return { ok: false, msg: "the batch name is not text" };
  const name = raw.trim();
  if (!name) return { ok: true, name: null };
  if (!BATCH_NAME.test(name)) return { ok: false, msg: `"${name}" is not a batch name (lowercase letters, digits and dashes, from ${PROBE_DIR})` };
  return { ok: true, name };
}

/** The committed file a name the box accepted refers to. */
export function batchPath(name) {
  return `${PROBE_DIR}/${name}.json`;
}

/** One intended alternative, read strictly: fixed keys, each value from its own list. */
function readAlt(alt, where) {
  if (!alt || typeof alt !== "object" || Array.isArray(alt)) return `${where} is not an object`;
  const keys = Object.keys(alt);
  if (!keys.length) return `${where} names nothing`;
  for (const k of keys) if (!ALT_KEYS.includes(k)) return `${where}: "${k}" is not one of ${ALT_KEYS.join(", ")}`;
  if (!Object.hasOwn(alt, "intent")) return `${where} names no intent`;
  if (!INTENTS.includes(alt.intent)) return `${where}: intent is one of ${INTENTS.join(", ")}`;
  if (Object.hasOwn(alt, "layer") && !EDIT_LAYERS.includes(alt.layer)) return `${where}: layer is one of ${EDIT_LAYERS.join(", ")}`;
  if (Object.hasOwn(alt, "layer") && alt.intent !== "edit") return `${where}: a layer belongs to an edit`;
  if (Object.hasOwn(alt, "page") && !(alt.page === "none" || (typeof alt.page === "string" && alt.page.startsWith("/")))) return `${where}: page is a path or "none"`;
  if (Object.hasOwn(alt, "remove") && typeof alt.remove !== "boolean") return `${where}: remove is true or false`;
  if (Object.hasOwn(alt, "alsoAsked") && alt.alsoAsked !== "none" && alt.alsoAsked !== "some") return `${where}: alsoAsked is "none" or "some"`;
  // "SOME" NAMES ITS PART: nonempty text alone proves nothing about which part.
  const naming = Object.hasOwn(alt, "held") || Object.hasOwn(alt, "runs");
  if (alt.alsoAsked === "some") {
    for (const k of ["held", "runs"]) {
      if (typeof alt[k] !== "string" || !alt[k].trim() || alt[k].length > MAX_MESSAGE) return `${where}: an answer that holds a part back names it — "held", the part held back, and "runs", the part its own route makes, each in the message's own words`;
    }
  } else if (naming) return `${where}: "held" and "runs" belong to an answer that holds a part back (alsoAsked "some")`;
  return "";
}

/**
 * The two parts an alternative names, checked against the probe's own message
 * with the product's locator: each is there, and holding back `held` leaves
 * `runs` to run and nothing of `held`. An expectation the route itself could
 * never meet is refused with the batch.
 */
function groundAlt(alt, message, where) {
  if (alt.alsoAsked !== "some") return "";
  for (const k of ["held", "runs"]) if (!wordsIn(message, alt[k])) return `${where}: "${k}" is not in the probe's message`;
  const cut = heldBack(message, alt.held);
  if (!cut.ok || !wordsIn(cut.run, alt.runs) || wordsIn(cut.run, alt.held)) return `${where}: holding back "held" must leave "runs" to run, and nothing of "held"`;
  return "";
}

/**
 * A committed batch, read whole and strictly. A batch that names a different
 * name, has no probes or more than `MAX_PROBES`, repeats an id, or carries a
 * field this reader does not know refuses before anything is signed in.
 *
 * @returns {{ ok: true, batch: { name: string, probes: object[] }, sha256: string } | { ok: false, msg: string }}
 */
export function readProbeBatch(text, name) {
  if (typeof text !== "string") return { ok: false, msg: "the batch file is not text" };
  let j;
  try { j = JSON.parse(text); } catch { return { ok: false, msg: "the batch file is not JSON" }; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, msg: "the batch file is not an object" };
  if (j.batch !== name) return { ok: false, msg: `the file names the batch ${JSON.stringify(j.batch)}, not "${name}"` };
  if (!Array.isArray(j.probes) || !j.probes.length) return { ok: false, msg: "the batch has no probes" };
  if (j.probes.length > MAX_PROBES) return { ok: false, msg: `the batch has ${j.probes.length} probes; one press routes at most ${MAX_PROBES}` };
  const seen = new Set();
  const probes = [];
  for (const [i, p] of j.probes.entries()) {
    const at = `probe ${i + 1}`;
    if (!p || typeof p !== "object" || Array.isArray(p)) return { ok: false, msg: `${at} is not an object` };
    for (const k of Object.keys(p)) if (!PROBE_KEYS.includes(k)) return { ok: false, msg: `${at}: "${k}" is not one of ${PROBE_KEYS.join(", ")}` };
    if (typeof p.id !== "string" || !PROBE_ID.test(p.id)) return { ok: false, msg: `${at}: the id is a capital letter and up to 11 more capitals, digits or dashes` };
    if (seen.has(p.id)) return { ok: false, msg: `${p.id} is named twice` };
    seen.add(p.id);
    if (typeof p.site !== "string" || !SLUG.test(p.site)) return { ok: false, msg: `${p.id}: the site is a slug` };
    if (p.name !== undefined && (typeof p.name !== "string" || !p.name.trim() || p.name.length > 80)) return { ok: false, msg: `${p.id}: the name is a site's name, up to 80 characters` };
    if (typeof p.message !== "string" || !p.message.trim() || p.message.length > MAX_MESSAGE) return { ok: false, msg: `${p.id}: the message is text, up to ${MAX_MESSAGE} characters` };
    if (p.attached !== undefined && typeof p.attached !== "boolean") return { ok: false, msg: `${p.id}: attached is true or false` };
    if (typeof p.basis !== "string" || !p.basis.trim() || p.basis.length > 200) return { ok: false, msg: `${p.id}: the basis says, in up to 200 characters, why the intended outcome is intended` };
    if (p.note !== undefined && (typeof p.note !== "string" || p.note.length > 400)) return { ok: false, msg: `${p.id}: the note is text, up to 400 characters` };
    if (p.given !== undefined && (typeof p.given !== "string" || !p.given.trim() || p.given.length > 400)) return { ok: false, msg: `${p.id}: given is the starting condition the probe depends on, as verified, in up to 400 characters` };
    if (p.intended !== null) {
      if (!Array.isArray(p.intended) || !p.intended.length || p.intended.length > 4) return { ok: false, msg: `${p.id}: intended is null (not set) or a list of one to four acceptable answers` };
      for (const [k, alt] of p.intended.entries()) {
        const bad = readAlt(alt, `${p.id}'s answer ${k + 1}`) || groundAlt(alt, p.message, `${p.id}'s answer ${k + 1}`);
        if (bad) return { ok: false, msg: bad };
      }
    }
    probes.push({ id: p.id, site: p.site, name: p.name || "", message: p.message, attached: p.attached === true, given: p.given || "", intended: p.intended, basis: p.basis, note: p.note || "" });
  }
  return { ok: true, batch: { name, probes }, sha256: createHash("sha256").update(text).digest("hex") };
}

// ── THE WALL ───────────────────────────────────────────────────────────────

/** The routing call's path: the one this mode posts to, and the one its wall allows. */
export const ROUTE_PATH = "/api/site/route";

/**
 * The only requests this mode may make to the app: the two runtime readers,
 * a site's page list, and the routing call. Nothing that edits, adds, builds,
 * publishes, restores, renames, polls a job or writes a row is on it.
 */
const ALLOWED_CALLS = Object.freeze([
  ["GET", /^\/api\/site\/build-health$/],
  ["GET", /^\/api\/site\/runtime\?slug=[a-z0-9-]+$/],
  ["GET", /^\/api\/site\/routes\?slug=[a-z0-9-]+$/],
  ["POST", new RegExp("^" + ROUTE_PATH.replace(/\//g, "\\/") + "$")],
]);

/** Whether this mode may make a request to the app. */
export function probeCallAllowed(method, path) {
  if (typeof method !== "string" || typeof path !== "string") return false;
  return ALLOWED_CALLS.some(([m, re]) => m === method.toUpperCase() && re.test(path));
}

/**
 * The wall the canary's request helper asks first in this mode: an allowed
 * request returns and goes on unchanged; any other THROWS before it is made,
 * so a forbidden request never leaves the machine and the run stops on it.
 */
export function assertProbeCall(method, path) {
  if (!probeCallAllowed(method, path)) throw new Error(`routing-only mode refused ${method} ${path}: this mode routes and reads, nothing else`);
}

/** Whether this mode may fetch a URL outside the app: the balance read, and nothing else. */
export function probeFetchAllowed(url, method, supabaseUrl) {
  if (typeof url !== "string" || typeof supabaseUrl !== "string" || !supabaseUrl) return false;
  return String(method || "GET").toUpperCase() === "GET" && url.startsWith(`${supabaseUrl}/rest/v1/credits?`);
}

/** `fetch`, walled the same way: an allowed read goes through, anything else throws before it is made. */
export function guardFetch(fetchImpl, allowed) {
  return (input, init = {}) => {
    const url = String((input && input.url) || input);
    const method = (init && init.method) || (input && input.method) || "GET";
    if (!allowed(url, method)) throw new Error(`routing-only mode refused a fetch of ${url.split("?")[0]}: this mode routes and reads, nothing else`);
    return fetchImpl(input, init);
  };
}

// ── READING AN ANSWER ──────────────────────────────────────────────────────

/**
 * Whether a route's `decision` can be read: a source from the fixed list,
 * reasons all from `ROUTE_REASONS`, and, when present, the model's intent and
 * layer from their own lists. Anything else is unreadable, never coerced.
 */
export function decisionReadable(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  if (!ROUTE_SOURCES.includes(d.source)) return false;
  if (!Array.isArray(d.reasons) || !d.reasons.every((c) => typeof c === "string" && Object.hasOwn(ROUTE_REASONS, c))) return false;
  if (Object.hasOwn(d, "raw")) {
    const r = d.raw;
    if (!r || typeof r !== "object" || Array.isArray(r)) return false;
    if (!(INTENTS.includes(r.intent) || r.intent === "other" || r.intent === "none")) return false;
    if (!(EDIT_LAYERS.includes(r.layer) || r.layer === "other" || r.layer === "none")) return false;
  }
  return true;
}

/** One field of the route's answer, as the intended outcome spells it, or `undefined` when it cannot be read. */
function answered(a, key) {
  const v = Object.hasOwn(a, key) ? a[key] : undefined;
  if (key === "remove") {
    if (v === undefined || v === null) return false;
    return typeof v === "boolean" ? v : undefined;
  }
  if (key === "alsoAsked") {
    if (v === undefined || v === null) return "none";
    return typeof v === "string" ? (v.trim() ? "some" : "none") : undefined;
  }
  if (v === undefined || v === null || v === "") return "none";
  return typeof v === "string" ? v : undefined;
}

/**
 * Whether the answer holds back exactly the part an alternative names and
 * leaves its own part to run, read with the product's own locator over the
 * probe's message: null when it does, one difference when it does not.
 *
 * WHAT THE ROUTE WOULD REALLY DO decides it. `heldBack` is what the route
 * runs on the answer, so the part it finds is the part taken out and the rest
 * is what runs this turn. Text the message does not contain is refused there
 * (the route answers `held-unread`), so it can match nothing here; and with no
 * message to read it against, cannot-tell matches nothing either.
 */
function heldDiff(alt, a, message) {
  const want = `holds back ${JSON.stringify(alt.held)} and runs ${JSON.stringify(alt.runs)}`;
  const later = Object.hasOwn(a, "alsoAsked") ? a.alsoAsked : undefined;
  if (later === undefined || later === null || (typeof later === "string" && !later.trim())) return { key: "alsoAsked", want, got: "nothing held back" };
  if (typeof later !== "string" || typeof message !== "string") return { key: "alsoAsked", want, got: "unreadable" };
  const cut = heldBack(message, later);
  if (!cut.ok) {
    return { key: "alsoAsked", want, got: wordsIn(message, later)
      ? `${JSON.stringify(later)}, the whole message, so nothing would run`
      : `${JSON.stringify(later)}, which is not in the message (the route refuses it)` };
  }
  if (!wordsIn(cut.held, alt.held) || wordsIn(cut.run, alt.held)) return { key: "alsoAsked", want, got: `holds back ${JSON.stringify(cut.held)}` };
  if (!wordsIn(cut.run, alt.runs)) return { key: "alsoAsked", want, got: `holds back ${JSON.stringify(cut.held)}, which takes part of ${JSON.stringify(alt.runs)} too` };
  return null;
}

/**
 * The route's answer set beside a probe's intended outcomes. `intended` null
 * is "not set": the answer is recorded, never judged. Otherwise the answer
 * matches when one alternative's every field matches; a field that cannot be
 * read matches nothing, and a part held back must be the one the alternative
 * names, found in `message` (`heldDiff`). A match the decision did not
 * attribute to the model (a fallback or a rule produced it) is reported as
 * such, never as a match.
 */
export function probeVerdict(intended, body, message) {
  const a = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  if (a.failed === true) return { kind: "failed" };
  if (intended === null || intended === undefined) return { kind: "recorded" };
  let nearest = null;
  for (const [i, alt] of intended.entries()) {
    const diffs = [];
    for (const key of Object.keys(alt).filter((k) => FIELD_KEYS.includes(k))) {
      if (key === "alsoAsked" && alt.alsoAsked === "some") {
        const d = heldDiff(alt, a, message);
        if (d) diffs.push(d);
        continue;
      }
      const got = answered(a, key);
      if (got === undefined) diffs.push({ key, want: alt[key], got: "unreadable" });
      else if (got !== alt[key]) diffs.push({ key, want: alt[key], got });
    }
    if (!diffs.length) {
      const own = a.decision && a.decision.source === "model";
      return { kind: own ? "matches" : "matches-not-model", alt: i };
    }
    if (!nearest || diffs.length < nearest.diffs.length) nearest = { alt: i, diffs };
  }
  return { kind: "differs", alt: nearest.alt, diffs: nearest.diffs };
}

/** The body the browser posts to the route for this probe, with the site's real page list. */
export function probeBody(p, pages) {
  return {
    message: p.message,
    site: { name: p.name || p.site, url: `https://${p.site}.gofarther.app`, pages, tables: [] },
    firstBuild: false, brief: p.message, qa: [], answering: false, attached: p.attached === true, slug: p.site, hasSite: true,
  };
}

// ── THE FLOW ───────────────────────────────────────────────────────────────

/**
 * Every site's page list, read once, before any routing call. A list that
 * cannot be read stops the batch here, at no cost: routing without it lets
 * the router name a page the site does not have, and every page answer would
 * be read against nothing.
 */
export async function readProbePages({ probes, readPages }) {
  const pages = {};
  for (const site of [...new Set(probes.map((p) => p.site))]) {
    const r = await readPages(site);
    if (!r || r.ok !== true || !Array.isArray(r.pages)) return { ok: false, why: `the page list of ${site} could not be read (${(r && r.why) || "no answer"})`, pages };
    pages[site] = r.pages;
  }
  return { ok: true, pages };
}

/**
 * Each probe routed once, in order, through `postRoute` and nothing else.
 * Stops at the first answer it cannot read honestly; every other answer,
 * whatever it says, is recorded and the batch goes on.
 */
export async function routeProbes({ probes, pages, postRoute }) {
  const records = [];
  for (const p of probes) {
    const res = (await postRoute(probeBody(p, pages[p.site]))) || {};
    const body = res.json && typeof res.json === "object" && !Array.isArray(res.json) ? res.json : null;
    const rec = { id: p.id, site: p.site, message: p.message, attached: p.attached, given: p.given || "", intended: p.intended, basis: p.basis, status: res.status, ms: res.ms, body };
    const stop = (why) => { records.push({ ...rec, verdict: { kind: "stopped" } }); return { records, stopped: { at: p.id, why } }; };
    if (res.status === 401) return stop("signed out (401)");
    if (res.status !== 200 || !body || body.ok !== true) return stop(`the route answered ${res.status}${body ? "" : " with no readable body"}`);
    if (!decisionReadable(body.decision)) {
      return stop("the route's reply carries no readable decision, so the Worker answering is not one that reports where its answers come from; an `addon` from it could be a conversion");
    }
    records.push({ ...rec, verdict: probeVerdict(p.intended, body, p.message) });
  }
  return { records, stopped: null };
}

/** What the batch's routing calls reported costing, summed over numbers only. */
export function probesCost(records) {
  return (records || []).reduce((n, r) => n + (r.body && Number.isFinite(r.body.cost) ? r.body.cost : 0), 0);
}

const VERDICT_SAID = Object.freeze({
  matches: "matches the intended outcome (the model's own answer)",
  "matches-not-model": "matches the intended outcome only through a fallback or a rule, not the model's own answer",
  differs: "differs from the intended outcome",
  recorded: "recorded (no intended outcome is set)",
  failed: "the routing call failed",
  stopped: "the batch stopped here",
});

/** The answer in one line: intent, layer, page, removal, and whether a part was held back. */
export function answerSaid(body) {
  const a = body && typeof body === "object" ? body : {};
  const bits = [typeof a.intent === "string" ? a.intent : "?"];
  if (typeof a.layer === "string" && a.layer) bits.push(a.layer);
  if (typeof a.page === "string" && a.page) bits.push(a.page);
  if (a.remove === true) bits.push("remove");
  if (typeof a.rename === "string" && a.rename) bits.push("rename " + a.rename);
  if (typeof a.alsoAsked === "string" && a.alsoAsked.trim()) bits.push("holding back: " + JSON.stringify(a.alsoAsked.trim().slice(0, 80)));
  return bits.join(" · ");
}

/** The batch's report, one block per probe and a summary, for the log and the evidence. */
export function probesReport({ name, sha256, records, stopped, cost }) {
  const lines = [`ROUTING-ONLY BATCH ${name} (sha256 ${String(sha256 || "").slice(0, 16)}…): ${records.length} routed${stopped ? `, then stopped at ${stopped.at}` : ""}`, ""];
  for (const r of records) {
    const d = r.body && decisionReadable(r.body.decision) ? r.body.decision : null;
    lines.push(`  ${r.id}  ${JSON.stringify(r.message)}${r.attached ? "  (file attached)" : ""}`);
    if (r.given) lines.push(`      given    ${r.given}`);
    lines.push(`      answer   ${r.body ? answerSaid(r.body) : "(none)"}   cost ${r.body && Number.isFinite(r.body.cost) ? r.body.cost : "?"}`);
    lines.push(`      decision ${d ? `${d.source}${d.reasons.length ? ": " + d.reasons.join(", ") : ""}${d.raw ? `  (the model said intent=${d.raw.intent} layer=${d.raw.layer})` : ""}` : "(unreadable)"}`);
    const v = r.verdict || {};
    const diff = v.kind === "differs" ? `: ${v.diffs.map((x) => `${x.key} ${x.got}, intended ${x.want}`).join("; ")}` : "";
    lines.push(`      verdict  ${VERDICT_SAID[v.kind] || v.kind}${diff}`);
    lines.push(`      intended ${r.intended ? r.intended.map((alt) => Object.entries(alt).map(([k, x]) => `${k}=${k === "held" || k === "runs" ? JSON.stringify(x) : x}`).join(" ")).join("  OR  ") : "not set"}  (${r.basis})`);
  }
  const count = (k) => records.filter((r) => r.verdict && r.verdict.kind === k).length;
  lines.push("");
  lines.push(`SUMMARY  ${count("matches")} match (the model's own), ${count("matches-not-model")} match only through a fallback or rule, ${count("differs")} differ, ${count("recorded")} recorded only, ${count("failed")} failed; reported cost ${cost} credits`);
  if (stopped) lines.push(`STOPPED  at ${stopped.at}: ${stopped.why}`);
  return lines.join("\n");
}
