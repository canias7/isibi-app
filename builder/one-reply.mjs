/**
 * ONE REPLY PER MESSAGE (2026-11-01, the owner: "Ok yes, but model written
 * please"; plan `docs/plans/2026-11-01-one-reply.md`).
 *
 * Before this, several voices each judged one piece of a message: each split
 * part's own reply, the per-part state lines, the agent's own summary. Each
 * was right about its piece and could be wrong about the whole ("linking it
 * in the header was not done" while a sibling part had done it). Now:
 *
 * 1. `requestFacts` gathers the whole message's facts from the request's
 *    records once every part has ended (or the message is paused for
 *    credits): each part's ending and reason, the files added, changed and
 *    removed across every part (by page or component name), table rows,
 *    rules and tables, keys still missing, draft or published, and the
 *    credits charged. Nothing is taken from the request's wording or from
 *    any step's own prose (`made`, `msg`, the agent's summary).
 * 2. `writeOneReply` asks the customer's chosen builder model once, at low
 *    effort, for one short reply from the customer's message and those facts.
 * 3. `checkReply` refuses a reply that names a page, table or key not in the
 *    facts, a file path, a "not done" when every part finished, or leaves out
 *    the key box when keys are missing; then, as when the call fails, the
 *    reply is `fallbackReply`, composed from the facts alone.
 *
 * Pure: no I/O here. The Worker supplies `send` and stores the result.
 */

const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
const uniq = (a) => [...new Set(a)];
const KEY_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
const TABLE_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

// ── NAMES, NEVER PATHS ───────────────────────────────────────────────────────

/**
 * A site file as the customer would name it: `{ kind: "page", name: "/about" }`
 * for a route file, `{ kind: "component", name: "site-header" }` for a
 * component, `{ kind: "style", name: "stylesheet" }` for CSS, else
 * `{ kind: "file", name: <base name> }`. Null for what does not read.
 */
export function fileName(path) {
  if (typeof path !== "string" || !path.trim() || path.length > 300) return null;
  const p = path.trim().replace(/^\.?\//, "");
  const route = /^(?:src\/)?routes\/(.+)\.(?:tsx|jsx|ts|js)$/.exec(p);
  if (route) {
    const r = route[1].replace(/(^|\/)index$/, "").replace(/^__root$/, "");
    if (route[1] === "__root") return { kind: "component", name: "site-frame" };
    return { kind: "page", name: ("/" + r).replace(/\/+$/, "") || "/" };
  }
  if (/^\/[a-z0-9$_/-]*$/i.test(path.trim())) return { kind: "page", name: path.trim().replace(/\/+$/, "") || "/" };
  if (/\.css$/i.test(p)) return { kind: "style", name: "stylesheet" };
  const base = p.split("/").pop().replace(/\.(?:tsx|jsx|ts|js|mjs|json)$/i, "");
  if (!base) return null;
  if (/(^|\/)components?\//.test(p) || /\.(?:tsx|jsx)$/.test(p)) return { kind: "component", name: base };
  return { kind: "file", name: base };
}

/**
 * WHAT ONE STEP'S ANSWER SAYS IT REALLY DID, compactly, for its part's record:
 * files changed and removed (the agent's `agent.changed` / `agent.removed`,
 * the older steps' `added` / `removed` pages), table rows saved and failed,
 * tables whose rules changed, tables added, settings saved. Null when it
 * names nothing. Only what the answer's fields say: never its `msg`.
 */
export function partWork(body) {
  if (!plain(body)) return null;
  const ag = plain(body.agent) ? body.agent : {};
  const changed = uniq([...strs(ag.changed), ...strs(body.added)]).slice(0, 40);
  const removed = uniq([...strs(ag.removed), ...strs(body.removed)]).slice(0, 40);
  const added = strs(body.added).slice(0, 40);
  const rows = plain(body.rows) && Number.isInteger(body.rows.saved) && Number.isInteger(body.rows.failed) && body.rows.saved >= 0 && body.rows.failed >= 0
    ? { saved: body.rows.saved, failed: body.rows.failed } : null;
  const rules = uniq((Array.isArray(body.applied) ? body.applied : []).map((a) => (plain(a) && typeof a.table === "string" && TABLE_RE.test(a.table) && a.removed === undefined && a.id === undefined ? a.table : "")).filter(Boolean)).slice(0, 20);
  const tables = uniq(strs(body.tables).filter((t) => TABLE_RE.test(t))).slice(0, 20);
  const settings = uniq(strs(body.settings)).slice(0, 20);
  const out = {
    ...(changed.length ? { changed } : {}), ...(added.length ? { added } : {}), ...(removed.length ? { removed } : {}),
    ...(rows && (rows.saved || rows.failed) ? { rows } : {}), ...(rules.length ? { rules } : {}),
    ...(tables.length ? { tables } : {}), ...(settings.length ? { settings } : {}),
  };
  return Object.keys(out).length ? out : null;
}

/** A part's `work` read back strictly (from a record or a view); null when it does not read. */
export function readWork(v) {
  if (!plain(v)) return null;
  return partWork({ agent: { changed: v.changed, removed: v.removed }, added: v.added, rows: v.rows, applied: strs(v.rules).map((table) => ({ table })), tables: v.tables, settings: v.settings });
}

// ── THE FACTS ───────────────────────────────────────────────────────────────

/** How a part ended, as the progress words the page shows (owner, 2026-11-01). */
export const ENDINGS = Object.freeze({
  done: "done", partial: "partly done",
  waiting: "waiting for your answer", approval: "waiting for your go-ahead",
  credits: "paused for credits",
  cancelled: "stopped",
  failed: "not done", "not-run": "not done", refused: "not done", expired: "not done", "needs-rewrite": "not done",
});
/** Endings that mean the message did not get everything it asked for. */
const UNFINISHED = Object.freeze(["partly done", "not done", "stopped", "paused for credits", "waiting for your answer", "waiting for your go-ahead", "working"]);

/** Why a part did not finish, in plain words, from its recorded reason. "" when none is known. */
const REASONS = Object.freeze({
  insufficient: "there were not enough credits",
  unbilled: "there were not enough credits",
  stopped: "you stopped it",
  cancelled: "you stopped it",
  "question-cancelled": "the question it asked was cancelled",
  "too-big": "it was more than one change can make in one go",
  "routing-failed": "working out what it needed failed on our side",
  "no-answer": "it stopped before it finished, on our side",
  unapproved: "the go-ahead it needed was not given",
  "agent-stopped": "it stopped before it finished",
  "agent-unread": "the site's files could not be read, on our side",
  "outcome-unrecorded": "what it changed could not be confirmed",
  "photos-unconfirmed": "its photographs could not be confirmed",
  "checkpoint-unread": "what you asked for before its question could not be read back, on our side",
  "checkpoint-unsaved": "what you asked for before its question could not be saved, on our side",
  "checkpoint-refused": "what you asked for before its question could not be read back, on our side",
  unreadable: "its result could not be read, on our side",
});
function reasonOf(p) {
  const why = typeof p.why === "string" ? p.why : "";
  if (/^needs:\d+$/.test(why) || p.status === "not-run") return "it needed another part that did not finish";
  if (p.status === "expired") return why === "unapproved" ? REASONS.unapproved : "the question it asked went unanswered for a day";
  if (p.status === "refused") return "its order with the other parts could not be worked out";
  if (p.status === "needs-rewrite") return "only a rewrite of every page could make it";
  return Object.hasOwn(REASONS, why) ? REASONS[why] : "";
}

/**
 * THE WHOLE MESSAGE'S FACTS, from its request view (`requestView`) and the
 * site's keys still missing (`missingKeys`: names, or `{ name }`, asked and not
 * set). Never from the message's wording: a part's `words` are only the name
 * of what it asked for; whether it was done comes from its status.
 */
export function requestFacts(view, { missingKeys = null, answers = null } = {}) {
  const parts = plain(view) && Array.isArray(view.parts) ? view.parts.filter((p) => plain(p) && typeof p.status === "string") : [];
  const files = { added: [], changed: [], removed: [] };
  const data = { saved: 0, failed: 0, rules: [], tables: [], settings: [] };
  let drafts = 0, live = 0, charged = 0, chargeKnown = true;
  const asked = [];
  const out = [];
  const name = (f) => { const n = fileName(f); return n ? n.name : ""; };
  for (const p of parts) {
    const ending = Object.hasOwn(ENDINGS, p.status) ? ENDINGS[p.status] : "working";
    const w = readWork(p.work);
    const finished = p.status === "done" || p.status === "partial";
    if (w) {
      for (const f of strs(w.added)) files.added.push(name(f));
      for (const f of strs(w.changed)) if (!strs(w.added).includes(f)) files.changed.push(name(f));
      for (const f of strs(w.removed)) files.removed.push(name(f));
      if (w.rows) { data.saved += w.rows.saved; data.failed += w.rows.failed; }
      data.rules.push(...strs(w.rules)); data.tables.push(...strs(w.tables)); data.settings.push(...strs(w.settings));
      if (finished && (strs(w.changed).length || strs(w.removed).length)) { if (plain(p.draft)) drafts++; else live++; }
    } else if (finished && plain(p.draft)) drafts++;
    if (p.charged === null) chargeKnown = false;
    else if (Number.isInteger(p.charged) && p.charged > 0) charged += p.charged;
    for (const k of Array.isArray(p.needKeys) ? p.needKeys : []) if (plain(k) && typeof k.name === "string" && KEY_RE.test(k.name)) asked.push(k.name);
    const notMade = p.status === "partial" && Array.isArray(p.notDone)
      ? uniq(p.notDone.map((x) => (plain(x) && typeof x.what === "string" ? x.what.trim().slice(0, 160) : "")).filter((x) => x && !/^[a-z-]+$/.test(x))) : [];
    out.push({
      n: Number.isInteger(p.n) ? p.n : out.length, asked: String(p.words || "").slice(0, 300), ending,
      ...(finished || ending === "working" ? {} : ((r) => (r ? { reason: r } : {}))(reasonOf(p))),
      ...(notMade.length ? { notMade } : {}),
      ...(p.question && typeof p.question.text === "string" && p.status === "waiting" ? { question: p.question.text.slice(0, 300) } : {}),
    });
  }
  const clean = (a) => uniq(a.filter(Boolean));
  const fileOut = { added: clean(files.added), changed: clean(files.changed), removed: clean(files.removed) };
  // A FILE ONE PART ADDED AND ANOTHER CHANGED IS ADDED; ONE REMOVED IS NOT CHANGED.
  fileOut.changed = fileOut.changed.filter((x) => !fileOut.added.includes(x) && !fileOut.removed.includes(x));
  const missing = missingKeys === null
    ? clean(asked)
    : clean((Array.isArray(missingKeys) ? missingKeys : []).map((k) => (typeof k === "string" ? k : plain(k) ? k.name : "")).filter((k) => typeof k === "string" && KEY_RE.test(k)));
  const paused = out.filter((p) => p.ending === "paused for credits").length;
  // THE OWNER'S ANSWERS TO THE BUILDER'S QUESTIONS (2026-11-02, reply truth):
  // what they named there was asked for, as much as the message's own words.
  // Read strictly: a list that does not read whole adds nothing.
  const ans = Array.isArray(answers) && answers.every((c) => plain(c) && typeof c.q === "string" && typeof c.a === "string")
    ? clean(answers.map((c) => c.a.trim().slice(0, 300))) : [];
  return {
    ended: plain(view) && view.ended === true,
    parts: out,
    files: fileOut,
    data: { rowsSaved: data.saved, rowsFailed: data.failed, rules: clean(data.rules), tables: clean(data.tables), settings: clean(data.settings) },
    keysMissing: missing,
    site: drafts && live ? "some published, some saved as a draft" : drafts ? "saved as a draft, not published" : live ? "published" : "unchanged",
    credits: chargeKnown ? charged : null,
    ...(ans.length ? { answered: ans } : {}),
    ...(paused ? { paused, resumes: !(plain(view) && view.credits && view.credits.auto === false) } : {}),
  };
}

/** Whether every part of the facts finished (done, nothing left out). */
export function allFinished(facts) {
  return !!facts && Array.isArray(facts.parts) && facts.parts.length > 0 && facts.parts.every((p) => p.ending === "done");
}

// ── THE DETERMINISTIC FALLBACK ───────────────────────────────────────────────

const q = (s) => "“" + String(s).trim().replace(/\s+/g, " ").slice(0, 160) + "”";
const listOf = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const named = (n) => (n === "/" ? "the home page" : n.startsWith("/") ? "the " + n + " page" : n === "stylesheet" ? "the site's styles" : "the " + n.replace(/-/g, " "));

/** The reply composed from the facts alone: used when the writer fails or its reply does not pass the check. */
export function fallbackReply(facts) {
  const f = plain(facts) ? facts : { parts: [], files: { added: [], changed: [], removed: [] }, data: {}, keysMissing: [] };
  const out = [];
  const by = (e) => f.parts.filter((p) => p.ending === e);
  const done = by("done");
  if (done.length) out.push((done.length === f.parts.length ? "Done: " : "Done: ") + listOf(done.map((p) => q(p.asked))) + ".");
  for (const p of by("partly done")) out.push("Partly done: " + q(p.asked) + "." + (p.notMade && p.notMade.length ? " Not made: " + listOf(p.notMade.map(q)) + "." : ""));
  const fl = f.files || {};
  if ((fl.added || []).length) out.push("Added " + listOf(fl.added.map(named)) + ".");
  if ((fl.changed || []).length) out.push("Changed " + listOf(fl.changed.map(named)) + ".");
  if ((fl.removed || []).length) out.push("Removed " + listOf(fl.removed.map(named)) + ".");
  const d = f.data || {};
  if (d.rowsSaved) out.push("Saved " + (d.rowsSaved === 1 ? "one table entry" : d.rowsSaved + " table entries") + ".");
  if (d.rowsFailed) out.push((d.rowsFailed === 1 ? "One table entry" : d.rowsFailed + " table entries") + " could not be saved.");
  if ((d.tables || []).length) out.push("Added the " + listOf(d.tables) + " table" + (d.tables.length === 1 ? "" : "s") + ".");
  if ((d.rules || []).length) out.push("Changed who can see or change " + listOf(d.rules) + ".");
  for (const p of by("paused for credits")) out.push("Paused for credits: " + q(p.asked) + ". " + (f.resumes === false ? "Press Continue once credits are added and it carries on." : "It carries on by itself once credits are added."));
  for (const p of by("waiting for your answer")) out.push("Waiting for your answer: " + q(p.asked) + (p.question ? " (" + q(p.question) + ")" : "") + ".");
  for (const p of by("waiting for your go-ahead")) out.push("Waiting for your go-ahead: " + q(p.asked) + ".");
  for (const p of by("stopped")) out.push("Stopped: " + q(p.asked) + (p.reason ? ", because " + p.reason : "") + ".");
  for (const p of by("not done")) out.push("Not done: " + q(p.asked) + (p.reason ? ", because " + p.reason : "") + ".");
  for (const p of by("working")) out.push("Still going: " + q(p.asked) + ".");
  if (f.site === "saved as a draft, not published") out.push("It is saved as a draft and not published yet.");
  else if (f.site === "some published, some saved as a draft") out.push("Some of it is live; the rest is saved as a draft, not published yet.");
  if ((f.keysMissing || []).length) out.push("Your site still needs " + listOf(f.keysMissing) + ": paste " + (f.keysMissing.length === 1 ? "it" : "them") + " in the box below.");
  if (Number.isInteger(f.credits) && f.credits > 0) out.push("This used " + f.credits + " credit" + (f.credits === 1 ? "" : "s") + ".");
  if (!out.length) out.push("Nothing on the site was changed.");
  return out.join(" ");
}

// ── THE CHECK ────────────────────────────────────────────────────────────────

/** Words that may stand before "page" or "table" without naming one. */
const GENERIC = new Set(["the", "a", "an", "your", "this", "that", "these", "those", "new", "each", "every", "one", "same", "main", "whole", "other", "any", "its", "their", "my", "which", "web", "front", "landing", "home", "first", "own", "site", "two", "three", "both", "all", "no", "more", "another", "single", "data", "database", "key", "keys"]);
const NEGATIVE = /\b(not done|wasn['’]t done|was not done|couldn['’]t|could not|wasn['’]t able|was not able|didn['’]t|did not|failed|unable|not made|isn['’]t done|haven['’]t|have not)\b/i;

/** Every name the facts allow a reply to use, lowercase. */
function knownNames(facts) {
  const k = new Set();
  const addWords = (s) => { const t = String(s).toLowerCase(); k.add(t); for (const w of t.split(/[\s/_-]+/)) if (w) k.add(w); };
  const fl = facts.files || {};
  for (const n of [...(fl.added || []), ...(fl.changed || []), ...(fl.removed || [])]) addWords(n);
  const d = facts.data || {};
  for (const t of [...(d.tables || []), ...(d.rules || []), ...(d.settings || [])]) addWords(t);
  for (const t of facts.keysMissing || []) addWords(t);
  // WHAT WAS ASKED MAY BE NAMED: a reply says "the Events page you asked for was not made".
  for (const p of facts.parts || []) for (const w of String(p.asked || "").toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || []) k.add(w);
  for (const a of facts.answered || []) for (const w of String(a).toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || []) k.add(w);
  return k;
}
const pagePaths = (facts) => new Set([...(facts.files.added || []), ...(facts.files.changed || []), ...(facts.files.removed || [])].filter((n) => n.startsWith("/")).map((n) => n.toLowerCase()));

/**
 * `{ ok, why }`: whether a written reply may be shown. Refused: empty or too
 * long; a file path or file name; an address (`/x`) that is not a page in the
 * facts and was not asked for; a key-like name not in the facts; "the X
 * page" or "the X table" with X neither in the facts nor in what was asked; a
 * "not done" when every part finished; no word of the key box when keys are
 * missing.
 */
export function checkReply(text, facts) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, why: "empty" };
  if (text.length > 1500) return { ok: false, why: "too-long" };
  if (!plain(facts) || !Array.isArray(facts.parts)) return { ok: false, why: "no-facts" };
  if (/\bsrc\/|\.(?:tsx|jsx|ts|mjs|css|json)\b|\broutes\/|\bcomponents\//i.test(text)) return { ok: false, why: "file-path" };
  const known = knownNames(facts);
  const paths = pagePaths(facts);
  const askedText = [...facts.parts.map((p) => p.asked), ...(facts.answered || [])].map((x) => String(x || "").toLowerCase()).join(" ");
  for (const m of text.matchAll(/(?:^|[\s(“"'])(\/[a-z0-9][a-z0-9/_-]*)/gi)) {
    const pth = m[1].replace(/[/.]+$/, "").toLowerCase();
    if (!paths.has(pth) && !askedText.includes(pth)) return { ok: false, why: "page:" + pth };
  }
  for (const m of text.matchAll(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g)) if (!(facts.keysMissing || []).includes(m[0]) && !known.has(m[0].toLowerCase())) return { ok: false, why: "key:" + m[0] };
  for (const m of text.matchAll(/\b([A-Za-z][A-Za-z0-9-]*)\s+(page|pages|table|tables)\b/g)) {
    const w = m[1].toLowerCase();
    if (!GENERIC.has(w) && !known.has(w)) return { ok: false, why: m[2].replace(/s$/, "") + ":" + w };
  }
  if (allFinished(facts) && NEGATIVE.test(text)) return { ok: false, why: "not-done-claimed" };
  if ((facts.keysMissing || []).length && !/\bbelow\b/i.test(text)) return { ok: false, why: "key-box" };
  return { ok: true };
}

// ── THE WRITER ───────────────────────────────────────────────────────────────

export const ONE_REPLY_SYSTEM =
  "You write the one reply a website builder sends its customer after their message has been handled. " +
  "You are given their message and the facts of what really happened. " +
  "Say only what the facts show. Name what was asked and not done, and why, as the facts give it. " +
  "Never claim a change that is not in the facts. Use plain words a shop owner would use: no file paths, no code, no developer notes. " +
  "If keys are missing, say so and point to the key box below. If something is paused for credits, say it is paused and carries on after a top-up. " +
  "Keep it short: a few sentences.";

export const ONE_REPLY_MAX_TOKENS = 600;

/** The one call's request, in the builder model's own shape (`callBuilderModel`). */
export function oneReplyRequest({ message, facts, model }) {
  return {
    model,
    max_tokens: ONE_REPLY_MAX_TOKENS,
    system: [{ type: "text", text: ONE_REPLY_SYSTEM }],
    messages: [{ role: "user", content: "THEIR MESSAGE:\n" + String(message || "").slice(0, 4000) + "\n\nWHAT REALLY HAPPENED (facts):\n" + JSON.stringify(facts) }],
  };
}

/** The answer's text: its text blocks joined, trimmed; "" when none. */
export function replyText(answer) {
  const blocks = answer && Array.isArray(answer.content) ? answer.content : [];
  return blocks.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n").trim();
}

/** The four token kinds `pageCredits` prices. */
export function oneReplyUsage(answer, model) {
  const u = (answer && answer.usage) || {};
  return { in: Number(u.input_tokens) || 0, out: Number(u.output_tokens) || 0, cacheRead: Number(u.cache_read_input_tokens) || 0, cacheWrite: Number(u.cache_creation_input_tokens) || 0, model };
}

/**
 * WRITE THE ONE REPLY. Never throws. `{ text, source: "model" | "fallback",
 * why?, usage }`: the model's text when it passed the check, else the facts'
 * own fallback with why (`send`, `empty`, or the check's reason).
 */
export async function writeOneReply({ send, message, facts, model }) {
  const usage = [];
  if (typeof send !== "function") return { text: fallbackReply(facts), source: "fallback", why: "send", usage };
  let answer;
  try { answer = await send(oneReplyRequest({ message, facts, model })); }
  catch { return { text: fallbackReply(facts), source: "fallback", why: "send", usage }; }
  usage.push(oneReplyUsage(answer, model));
  const text = replyText(answer);
  const ok = checkReply(text, facts);
  return ok.ok ? { text, source: "model", usage } : { text: fallbackReply(facts), source: "fallback", why: ok.why, usage };
}

// ── WHEN, AND ONCE ───────────────────────────────────────────────────────────

/**
 * Which reply a request owes now, as a round name, or "" for none: `end:…`
 * once every part has ended, `paused:…` while it waits only on credits. The
 * round names the parts and the last resume, so a request that resumes and
 * finishes owes a new one, and a re-poll owes the same one.
 */
export function replyRound(rec) {
  if (!plain(rec) || !Array.isArray(rec.parts) || !rec.parts.length) return "";
  const tail = rec.parts.length + ":" + (Number.isFinite(rec.creditsResumedAt) ? rec.creditsResumedAt : 0);
  if (rec.ended === true) return "end:" + tail;
  if (rec.state === "credits" && !rec.stop) return "paused:" + tail;
  return "";
}

/** A request record's stored one reply, read strictly; null when none reads. */
export function readOneReply(v) {
  if (!plain(v) || typeof v.for !== "string" || !v.for) return null;
  if (v.state === "written" && typeof v.text === "string" && v.text.trim() && (v.source === "model" || v.source === "fallback")) return { for: v.for, state: "written", text: v.text, source: v.source, at: Number(v.at) || 0 };
  if (v.state === "writing" && typeof v.by === "string" && Number.isFinite(v.at)) return { for: v.for, state: "writing", by: v.by, at: v.at };
  return null;
}

/** How long a claim to write stands before another reader may take it over. */
export const ONE_REPLY_CLAIM_MS = 3 * 60 * 1000;

/**
 * What a reader does about the request's reply: `{ act: "none" }` (nothing
 * owed), `{ act: "serve", reply }`, `{ act: "wait" }` (another writer holds
 * a fresh claim), or `{ act: "claim", round }`.
 */
export function oneReplyNext(rec, now = Date.now()) {
  const round = replyRound(rec);
  if (!round) return { act: "none" };
  const cur = readOneReply(rec.oneReply);
  if (cur && cur.for === round && cur.state === "written") return { act: "serve", reply: cur };
  if (cur && cur.for === round && cur.state === "writing" && now - cur.at < ONE_REPLY_CLAIM_MS) return { act: "wait" };
  return { act: "claim", round };
}

/** What the request view carries of it: the written reply for the current round, or that one is being written. */
export function oneReplyView(rec, now = Date.now()) {
  const n = oneReplyNext(rec, now);
  if (n.act === "serve") return { reply: { for: n.reply.for, text: n.reply.text, source: n.reply.source } };
  if (n.act === "none") return {};
  return { replyState: "pending", replyFor: replyRound(rec) };
}

/**
 * Whether the one reply is in force: always, except under the unit suite's
 * `GF_OLD_LANES=1` (package.json's test script), which keeps the older
 * per-part replies' tests running, as `agentTakes` does for the agent.
 */
export function oneReplyOn() {
  const p = globalThis.process;
  return !(p && p.env && p.env.GF_OLD_LANES === "1");
}
