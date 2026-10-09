// ── PROGRESS MESSAGES WHILE AN EDIT OR AN ADD-ON RUNS (2026-10-06) ──────────
//
// The owner, approving the plan (docs/investigations/progress-messages-plan.md):
// *"Proceed with model-written progress for Edit and Add-on using the
// recommended defaults: the existing selected quick model, platform-absorbed
// narration cost, progress retained above the final reply, both request and
// standalone-job paths, and fixed status labels alongside natural
// model-written messages."* And the corrections that came with it: *"do not
// claim that matching says metadata proves the prose truthful; ground the
// model in verified facts, distinguish designed, saved, applied and published
// outcomes … Define one writer per job with recoverable persistence, queue
// delivery and index updates … Check authoritative job state and writer
// ownership before starting and committing narration … Keep instructions
// concise rather than relying on an arbitrary short character limit."*
//
// THREE PARTS, AND EACH KEEPS TO ITS OWN JOB.
//
//   THE MILESTONES are recorded by the running job at a few real boundaries
//   (the edit's plan and its publish; the add-on's picked kinds, each design,
//   its database change, its pages and its publish), as facts read off that
//   step's own result, each with the state it is really in
//   (`PROGRESS_STATES`). Nothing is recorded before a job starts, and no fact
//   ever says "published": being live is said by the final reply alone.
//
//   THE RECORD is one object per job (`progressKey`): the milestones, the
//   lines written for them, and the one writer's lease. It is changed only by
//   a conditional write on the etag it was read under, so it is its own index
//   — there is no second object to fall out of step with it.
//
//   THE WRITER is one queued task per job at a time. It claims the lease,
//   reads the job's own row, asks the picked quick model for one line that
//   covers every milestone not yet said, reads the row again, and commits the
//   line on the etag it read. Everything it decides is a function here; the
//   Worker supplies the reads, the writes and the call.
//
// AND EACH TASK'S OWN LINE (2026-10-06), the owner's clarification: *"make
// the assistant's task summaries and progress updates conversational and
// first-person … Let the model generate the wording naturally from context,
// matching whether the work is planned, happening or finished. Don't add
// hardcoded prefixes to the user's words."* A request's card named each part
// by the customer's own words, which are also that part's instruction to its
// job and so stay as they are. Now the same writer, on the same record, asks
// the model for each task's line in every state it can be in
// (`TASK_STATES`) — a request's parts on a record of the
// request's own, a page-filed job's one task on the job's — and the page
// shows the one its authoritative status calls for. The model never decides
// which state is true, so a line written late can never claim one; until
// they are written the customer's words show, unprefixed. SEVEN STATES since
// the outcome round (2026-10-06): a part waiting for the customer, one whose
// publish could not be confirmed, and one done only in part each have a line
// of their own, so none is named by a line that says something else.
//
// AND A LINE IS SHOWN ONLY ONCE IT IS CONFIRMED (2026-10-06, the owner: *"Close
// the documented race where a failed or timed-out progress close lets a writer
// commit after its last job-state check and after finalization; ensure stale
// narration cannot appear …"*). A line is committed unconfirmed, and confirmed
// only by a read of the job's row made AFTER it was committed that finds the
// job still running under its run (`confirmLines`). A line committed after the
// job's end — its close failed or timed out, and the writer's last check came
// just before the finalize — finds no such read, so no reader is ever handed
// it (`linesOf`). Nothing waits on a clock and nothing holds the job's end.
//
// WHAT THE `says` CHECK PROVES, AND WHAT IT DOES NOT. The model lists every
// fact it described, with the state it described it as, and a fact listed in
// any other state than its own is refused and asked for once more. That
// catches a model that reports calling a running step finished. It does NOT
// read the words: a model can list every fact in its true state and still
// write "your page is live". No code here looks for such words — the owner
// rules out keyword filters — so that remaining limit is the instructions'
// to prevent and the final reply's to correct, and it is pinned by a test
// (`test/progress.test.mjs`, "contradictory prose") and written down in the
// plan's limits.
//
// DEPENDENCY-LIGHT: the Worker and the job child both import it, and the job
// image copies `builder/` modules by name (the Dockerfile's worker line).

import { TERMINAL_STATES } from "./edit-job.mjs";
import { pathOf } from "./site-reply.mjs";
import { REQUEST_KEY_RE } from "./clarify.mjs";
import { prepState } from "./request.mjs";

/** The switch: `PROGRESS_REPLIES` = "on". Anything else records nothing, writes nothing and changes no answer. */
export function progressOn(env) {
  return !!(env && typeof env.PROGRESS_REPLIES === "string" && env.PROGRESS_REPLIES.trim().toLowerCase() === "on");
}

/** Where a job's progress is kept: beside its other objects under `jobs/`, whose seven-day sweep (`job-retention.mjs`) takes it out. */
export const progressKey = (job) => "jobs/" + job + ".progress.json";

// ── WHAT A FACT CAN SAY ─────────────────────────────────────────────────────
//
// The owner: *"distinguish designed, saved, applied and published outcomes."*
// Every fact carries one of these, from where it was recorded, never from the
// request's wording:
//   decided    worked out what to do; nothing has changed yet;
//   designed   designed; nothing has been built yet;
//   prepared   made in the builder and kept for the publish — not published,
//              so visitors cannot see it. (The site's source is SAVED inside
//              the publish itself, so no milestone can say "saved" apart from
//              publishing: until then a change is prepared.)
//   applied    in effect in the site's database;
//   doing      happening now, not finished;
//   next       planned, not started;
//   notdone    could not be made; the final message says why.
// There is no "published" and no "finished": the final reply says those.
export const PROGRESS_STATES = Object.freeze(["decided", "designed", "prepared", "applied", "doing", "next", "notdone"]);

// ── THE WRITER'S BUDGET, AND WHY EACH NUMBER IS WHAT IT IS ─────────────────
//
// A line is worth something only while the job runs, so the budget is the
// moment's, not the final reply's (`REPLY_BG_*`): one call has 45 s and an
// attempt — two calls at most — 75 s; the lease outlives an attempt by a
// minute, so a writer still inside its attempt is never taken over. A batch
// is tried twice, 20 s apart, and then given up (`failed`): the fixed label
// stays, and the next milestone starts afresh.
export const PROGRESS_CALL_MS = 45000;
export const PROGRESS_DEADLINE_MS = 75000;
export const PROGRESS_LEASE_MS = PROGRESS_DEADLINE_MS + 60000;
export const PROGRESS_TRIES = 2;
export const PROGRESS_RETRY_MS = 20000;
/** A writer asked for this long ago that never started is a lost message: the recorder or the cron asks again. */
export const PROGRESS_ASK_GRACE_MS = 60000;
/** How early a retry's own message may be taken: two machines' clocks disagreeing, never an early delivery (`REPLY_RETRY_SKEW_MS`'s rule). */
export const PROGRESS_RETRY_SKEW_MS = 2000;
/**
 * What one call may write: the line and its list. A ceiling against a runaway
 * answer, not a length to aim for — the instructions ask for a short line. An
 * answer cut there is not used (`cut`, said in the log), never shortened.
 */
export const PROGRESS_MAX_TOKENS = 1000;
/** Lines one task writes before it hands the rest to a fresh delivery of itself. */
export const PROGRESS_LINES_PER_TASK = 8;
/**
 * A JOB'S MILESTONES, AT MOST. A technical guard against a recorder called in
 * a loop, not a budget: a job records about two to eight. One past it is
 * refused and said in the log, never cut from what is there.
 */
export const PROGRESS_MAX_MARKS = 200;
/**
 * A MILESTONE'S DELIVERY, TRIED AGAIN (2026-10-06, the owner: *"Fix
 * makeProgress dropping a milestone when JOB_PROGRESS fails: retain its
 * identity and retry automatically while appropriate, without needing another
 * milestone or an open browser, and prevent duplicates when the first
 * delivery landed but its response was lost."*). The waits between tries, so a
 * delivery is tried `PROGRESS_SEND_WAITS_MS.length + 1` times over about half a
 * minute while the job runs; the job's end cuts a wait short, for one last try.
 * Each try carries the milestone's own number, so one that landed and whose
 * answer was lost is recorded once (`appendMark`'s `already`).
 */
export const PROGRESS_SEND_WAITS_MS = Object.freeze([250, 500, 1000, 2000, 4000, 8000, 15000]);
/** How long a standalone job stays discoverable from another device after it ends: the request list's day. */
export const PROGRESS_DISCOVERY_MS = 24 * 3600 * 1000;

/** The states of a milestone: waiting for a line, said by one, set aside when the job ended, or given up. */
export const MARK_STATES = Object.freeze(["pending", "said", "skipped", "failed"]);

/**
 * THE STATES A TASK'S LINE IS WRITTEN IN, and the page shows the one its
 * status calls for: planned (still to be done), doing (happening now), waiting
 * (on the customer's answer or go-ahead), unconfirmed (its publish began and
 * could not be confirmed: never said as happening now, never as done), done,
 * partial (done in part) and notdone (not done) — the final message says why.
 */
export const TASK_STATES = Object.freeze(["planned", "doing", "waiting", "unconfirmed", "done", "partial", "notdone"]);
/** A record's tasks, at most: a technical guard, as `PROGRESS_MAX_MARKS` is — a request holds a handful of parts. */
export const PROGRESS_MAX_TASKS = 50;
/** What one task-lines call may write: up to `TASK_BATCH` tasks in every state, so more than a line's ceiling, and an answer cut there is not used, never shortened. */
export const TASK_MAX_TOKENS = 4000;
/** Tasks one call writes, at most: more wait for the next call, so one answer stays well inside its ceiling whatever the request's size. */
export const TASK_BATCH = 8;

const JOB_RE = /^[0-9a-f]{32}$/;
const RUN_RE = /^[A-Za-z0-9_:-]{4,80}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v) => (typeof v === "string" ? v : "");
/** Text on one line, whole: control characters and runs of space made single spaces, never shortened. */
const flat = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const listOf = (items) => (items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);
const quote = (v) => "“" + flat(v) + "”";

// ── THE RECORD ──────────────────────────────────────────────────────────────

function readFact(f) {
  if (!f || typeof f !== "object" || typeof f.id !== "string" || !/^f\d{1,6}$/.test(f.id)) return null;
  if (typeof f.state !== "string" || !PROGRESS_STATES.includes(f.state)) return null;
  const text = flat(f.text);
  return text ? { id: f.id, state: f.state, text } : null;
}

function readMark(m) {
  if (!m || typeof m !== "object" || !Number.isInteger(m.n) || m.n < 0) return null;
  if (typeof m.stage !== "string" || !/^[a-z][a-z-]{0,30}$/.test(m.stage)) return null;
  if (typeof m.state !== "string" || !MARK_STATES.includes(m.state)) return null;
  const at = num(m.at);
  if (at === null || !Array.isArray(m.facts)) return null;
  const facts = m.facts.map(readFact);
  if (facts.some((f) => !f)) return null;
  return {
    n: m.n, stage: m.stage, at, facts, state: m.state,
    ...(Number.isInteger(m.key) && m.key >= 0 ? { key: m.key } : {}),
    ...(Number.isInteger(m.line) && m.line >= 0 ? { line: m.line } : {}),
    ...(typeof m.why === "string" && m.why ? { why: m.why.slice(0, 40) } : {}),
  };
}

function readLine(l) {
  if (!l || typeof l !== "object" || !Number.isInteger(l.n) || l.n < 0) return null;
  const at = num(l.at);
  const text = typeof l.text === "string" ? l.text.replace(/\r\n/g, "\n").trim() : "";
  if (at === null || !text || !Array.isArray(l.marks) || l.marks.some((n) => !Number.isInteger(n) || n < 0)) return null;
  return { n: l.n, at, text, marks: l.marks.slice(), ...(l.confirmed === true ? { confirmed: true } : {}) };
}

/** What each task is, in the customer's words: `[{ n, words }]`, [] when there are none, null when the list does not read. */
function readTaskWords(v) {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > PROGRESS_MAX_TASKS) return null;
  const out = [];
  for (const t of v) {
    if (!t || typeof t !== "object" || !Number.isInteger(t.n) || t.n < 0 || typeof t.words !== "string" || !t.words.trim()) return null;
    if (out.some((o) => o.n === t.n)) return null;
    out.push({ n: t.n, words: t.words.trim() });
  }
  return out;
}

/** One task's lines in every state, each a string with words in it; null when any is missing. */
function readSaid(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return null;
  const out = {};
  for (const k of TASK_STATES) {
    const v = typeof e[k] === "string" ? e[k].replace(/\r\n/g, "\n").trim() : "";
    if (!v) return null;
    out[k] = v;
  }
  return out;
}

/**
 * The written task lines: null when none are written yet, false when they do
 * not read — an entry for no task, a task twice, a state missing. They may
 * cover only some of the tasks: a task added since (a request's part carved
 * from another) waits for its own.
 */
function readTaskLines(v, words) {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length > words.length) return false;
  const out = [];
  for (const e of v) {
    if (!e || typeof e !== "object" || !words.some((t) => t.n === e.n) || out.some((o) => o.n === e.n)) return false;
    const said = readSaid(e);
    if (!said) return false;
    out.push({ n: e.n, ...said });
  }
  return out.length ? out : null;
}

/**
 * A JOB'S PROGRESS RECORD, AS STORED, read strictly: the record, or null when
 * it is no record at all. Every list is all-or-nothing — one entry that does
 * not read makes the record unreadable, never a shorter list read as whole.
 */
/** A job's place in a request — `{ key, part }` — or null: none, or one that does not read (2026-10-07). */
export function readRequestRef(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  if (typeof v.key !== "string" || !REQUEST_KEY_RE.test(v.key) || !Number.isInteger(v.part) || v.part < 0) return null;
  return { key: v.key, part: v.part };
}

export function readProgressRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== 1) return null;
  if (typeof raw.job !== "string" || !JOB_RE.test(raw.job)) return null;
  if (typeof raw.uid !== "string" || !raw.uid || raw.uid.length > 80) return null;
  if (typeof raw.slug !== "string" || !SLUG_RE.test(raw.slug)) return null;
  // A REQUEST'S OWN RECORD (`op: "request"`) holds its parts' task lines and nothing else.
  if (raw.op !== "edit" && raw.op !== "addon" && raw.op !== "request") return null;
  if (typeof raw.run !== "string" || !RUN_RE.test(raw.run)) return null;
  const at = num(raw.at);
  if (at === null || !Array.isArray(raw.marks) || !Array.isArray(raw.lines) || !Number.isInteger(raw.nf) || raw.nf < 0) return null;
  const marks = raw.marks.map(readMark);
  const lines = raw.lines.map(readLine);
  if (marks.some((m) => !m) || lines.some((l) => !l)) return null;
  const taskWords = readTaskWords(raw.taskWords);
  if (taskWords === null) return null;
  const tasks = readTaskLines(raw.tasks, taskWords);
  if (tasks === false) return null;
  const w = raw.writer;
  const writer = w && typeof w === "object" && typeof w.owner === "string" && w.owner && num(w.until) !== null && Number.isInteger(w.attempt)
    ? { owner: w.owner, until: w.until, attempt: w.attempt } : null;
  const c = raw.closed;
  const closed = c && typeof c === "object" && num(c.at) !== null && typeof c.why === "string" ? { at: c.at, why: c.why.slice(0, 40) } : null;
  return {
    v: 1, job: raw.job, uid: raw.uid, slug: raw.slug, op: raw.op, run: raw.run, at,
    words: str(raw.words), picker: typeof raw.picker === "string" ? raw.picker : "",
    pages: Array.isArray(raw.pages) ? raw.pages.filter((p) => typeof p === "string" && p.charAt(0) === "/") : [],
    nf: raw.nf, marks, lines, writer, closed,
    asked: num(raw.asked) || 0,
    tries: Number.isInteger(raw.tries) && raw.tries >= 0 ? raw.tries : 0,
    ...(num(raw.retryAt) !== null ? { retryAt: raw.retryAt } : {}),
    taskWords, tasks,
    taskTries: Number.isInteger(raw.taskTries) && raw.taskTries >= 0 ? raw.taskTries : 0,
    tasksWhy: typeof raw.tasksWhy === "string" && raw.tasksWhy ? raw.tasksWhy.slice(0, 40) : null,
    // A JOB'S PLACE IN ITS REQUEST (2026-10-07), so its writer can be told the
    // request's other parts as they stand; a record from before then has none.
    ...(readRequestRef(raw.request) ? { request: readRequestRef(raw.request) } : {}),
  };
}

/**
 * A record as it opens: a job's at its start, with no milestone yet, or a
 * request's at its acceptance (`op: "request"`). `tasks` is what each task is
 * in the customer's words — a page-filed job's one, a request's parts — for
 * the writer to give each its line in every state; none, and there is
 * nothing for a writer until a milestone comes.
 */
export function openRecord({ job, uid, slug, op, run, words = "", picker = "", pages = [], tasks = [], at, request = null }) {
  if (typeof job !== "string" || !JOB_RE.test(job) || typeof run !== "string" || !RUN_RE.test(run)) return null;
  if (typeof uid !== "string" || !uid || typeof slug !== "string" || !SLUG_RE.test(slug) || (op !== "edit" && op !== "addon" && op !== "request")) return null;
  const ref = op === "request" ? null : readRequestRef(request);
  return readProgressRecord({
    v: 1, job, uid, slug, op, run, at, words: typeof words === "string" ? words : "",
    picker: typeof picker === "string" ? picker : "", pages: Array.isArray(pages) ? pages : [],
    nf: 0, marks: [], lines: [], writer: null, closed: null, asked: 0, tries: 0,
    taskWords: Array.isArray(tasks) ? tasks : [], tasks: null, taskTries: 0, tasksWhy: null,
    ...(ref ? { request: ref } : {}),
  });
}

/** The record as it is written: the same fields, with nothing the reader would refuse. */
export function packRecord(rec) {
  const { retryAt, ...rest } = rec;
  return { ...rest, v: 1, ...(num(retryAt) !== null ? { retryAt } : {}) };
}

/**
 * A MILESTONE ADDED: `{ rec, n }`, `{ already, n }` when the recorder's own
 * number for it (`key`) is on the record — a write made twice because its
 * first answer was lost — or `{ refused }`: a closed record (the job ended or
 * another run's), no facts, a fact that does not read, or one past
 * `PROGRESS_MAX_MARKS`. Each fact gets its id here, from the record's own
 * counter, so ids never repeat inside a job.
 */
export function appendMark(rec, { stage, facts, at, key }) {
  if (!rec) return { refused: "no-record" };
  const had = Number.isInteger(key) ? rec.marks.find((m) => m.key === key) : null;
  if (had) return { already: true, n: had.n };
  if (rec.closed) return { refused: "closed" };
  if (typeof stage !== "string" || !/^[a-z][a-z-]{0,30}$/.test(stage)) return { refused: "stage" };
  const list = Array.isArray(facts) ? facts : [];
  if (!list.length) return { refused: "no-facts" };
  if (rec.marks.length >= PROGRESS_MAX_MARKS) return { refused: "full" };
  let nf = rec.nf;
  const out = [];
  for (const f of list) {
    const read = readFact({ ...f, id: "f" + (nf + 1) });
    if (!read) return { refused: "fact" };
    nf += 1;
    out.push(read);
  }
  const n = rec.marks.length;
  return { rec: { ...rec, nf, marks: [...rec.marks, { n, stage, at, facts: out, state: "pending", ...(Number.isInteger(key) && key >= 0 ? { key } : {}) }] }, n };
}

/** The record closed: no milestone added after, no line committed after, and every milestone still waiting set aside. */
export function closeRecord(rec, why, at) {
  if (!rec || rec.closed) return null;
  return {
    ...rec,
    marks: rec.marks.map((m) => (m.state === "pending" ? { ...m, state: "skipped", why: String(why || "ended").slice(0, 40) } : m)),
    writer: null, retryAt: undefined,
    closed: { at, why: String(why || "ended").slice(0, 40) },
  };
}

/** The milestones still waiting for a line, in order. */
export const pendingMarks = (rec) => (rec ? rec.marks.filter((m) => m.state === "pending") : []);

/** Is a writer's lease on the record live now? */
export const writerLive = (rec, now) => !!(rec && rec.writer && rec.writer.until > now);

/**
 * DO THE TASKS STILL NEED THEIR LINES? Even on a closed record: a task's lines
 * carry no state — the page picks one from the status it reads — so a job
 * that ended before they were written still gets them, for the card that
 * shows it finished.
 */
export const tasksNeeded = (rec) => !!(rec && !rec.tasksWhy && unwrittenTasks(rec).length > 0);
/** The tasks with no lines yet, in the customer's words, in order: what a writer is asked to write. */
export const unwrittenTasks = (rec) => (rec && Array.isArray(rec.taskWords) ? rec.taskWords.filter((t) => !(Array.isArray(rec.tasks) && rec.tasks.some((x) => x.n === t.n))) : []);
/** Do the record's milestones need a line? Only while it is open. */
const linesNeeded = (rec) => !!(rec && !rec.closed && pendingMarks(rec).length > 0);

/**
 * DOES THE RECORD NEED A WRITER ASKED FOR NOW — the one rule the recorder, the
 * writer letting go and the cron's recovery all read:
 *   none   closed, or nothing waiting;
 *   wait   a writer holds a live lease, a retry is not due yet, or a writer
 *          asked for (`asked`, which a claim clears and a scheduled retry sets
 *          to its time) may still be on its way, within the grace;
 *   ask    a milestone waits and nobody is on it: ask (and say so on the record).
 */
export function writerNeeded(rec, now) {
  if (!linesNeeded(rec) && !tasksNeeded(rec)) return "none";
  if (writerLive(rec, now)) return "wait";
  if (num(rec.retryAt) !== null && rec.retryAt > now) return "wait";
  if (rec.asked && now - rec.asked < PROGRESS_ASK_GRACE_MS) return "wait";
  return "ask";
}

/** The record with a writer asked for now. */
export const markAsked = (rec, now) => ({ ...rec, asked: now });

/**
 * THE ONE WRITER CLAIMS THE RECORD: `{ rec, claimed: true }` with its lease;
 * `{ rec, gaveUp: true }` when every try of what waits is spent — a writer
 * whose lease ran out before it committed spent one too — so what waits is
 * given up with no call; or null when it is not this writer's to take:
 * closed, nothing waiting, another writer's lease still live, or a retry not
 * yet due. A lease already this writer's (its claim landed and the answer was
 * lost) is this writer's still.
 */
export function claimWriter(rec, owner, now) {
  if (!linesNeeded(rec) && !tasksNeeded(rec)) return null;
  if (typeof owner !== "string" || !owner) return null;
  if (rec.writer && rec.writer.owner === owner) return { rec: { ...rec, writer: { ...rec.writer, until: now + PROGRESS_LEASE_MS } }, claimed: true };
  if (writerLive(rec, now)) return null;
  if (num(rec.retryAt) !== null && rec.retryAt - now > PROGRESS_RETRY_SKEW_MS) return null;
  // THE TASKS' LINES FIRST, ON TRIES OF THEIR OWN, so a call for them that
  // keeps failing never costs the milestones theirs: given up after
  // `PROGRESS_TRIES` (`tasksWhy`), and the customer's words stay on the card.
  if (tasksNeeded(rec)) {
    const t = rec.taskTries || 0;
    if (t < PROGRESS_TRIES) return { rec: { ...rec, writer: { owner, until: now + PROGRESS_LEASE_MS, attempt: t + 1 }, taskTries: t + 1, retryAt: undefined, asked: 0 }, claimed: true };
    rec = { ...rec, taskTries: 0, tasksWhy: "tries" };
    if (!linesNeeded(rec)) return { rec: { ...rec, writer: null, retryAt: undefined, asked: 0 }, gaveUp: true };
  }
  const tries = rec.tries || 0;
  if (tries >= PROGRESS_TRIES) {
    return { rec: { ...rec, writer: null, tries: 0, retryAt: undefined, asked: 0, marks: rec.marks.map((m) => (m.state === "pending" ? { ...m, state: "failed", why: "tries" } : m)) }, gaveUp: true };
  }
  // A TRY IS COUNTED WHEN IT IS CLAIMED, so one that never commits still
  // counts. AND THE ASK IS ANSWERED: a milestone that arrives after this writer
  // lets go is asked for at once, never left waiting out an ask already used.
  return { rec: { ...rec, writer: { owner, until: now + PROGRESS_LEASE_MS, attempt: tries + 1 }, tries: tries + 1, retryAt: undefined, asked: 0 }, claimed: true };
}

/** Does `owner` still hold a live lease on the record, which is still open? */
export const holds = (rec, owner, now) => !!(rec && !rec.closed && rec.writer && rec.writer.owner === owner && rec.writer.until > now);
/** Does `owner` still hold a live lease on the record, open or not — all a task's lines need, carrying no state. */
const leaseHeld = (rec, owner, now) => !!(rec && rec.writer && rec.writer.owner === owner && rec.writer.until > now);

/**
 * THE TASKS' LINES COMMITTED: on the lease alone (a closed record takes them
 * — see `tasksNeeded`), each in every state, beside the lines already written,
 * which are kept. Null when the lease is gone, nothing new is in them, or any
 * of them does not read or names no task the record holds. A task added while
 * the call ran still waits (`tasksNeeded`), for the writer to be asked again.
 */
export function commitTasks(rec, { owner, tasks, now }) {
  if (!leaseHeld(rec, owner, now) || !tasksNeeded(rec) || !Array.isArray(tasks)) return null;
  const had = Array.isArray(rec.tasks) ? rec.tasks : [];
  const fresh = tasks.filter((t) => !(t && typeof t === "object" && had.some((h) => h.n === t.n)));
  if (!fresh.length) return null;
  const read = readTaskLines([...had, ...fresh], rec.taskWords);
  if (!read) return null;
  return { ...rec, tasks: read, writer: null, taskTries: 0, retryAt: undefined };
}

/**
 * TASKS ADDED TO A RECORD: a request's parts carved after its acceptance — a
 * job's held additions, put off for later — each new one, by its number, in
 * the customer's words, with the writer's tries begun again so it gets its
 * lines (and any given up before it, a second time). `{ rec, added }`;
 * `{ already: true }` when the record holds every one; null when one does not
 * read or the record would hold more than `PROGRESS_MAX_TASKS`, and those
 * parts are named by their words.
 */
export function addTasks(rec, tasks) {
  if (!rec || !Array.isArray(rec.taskWords) || !Array.isArray(tasks)) return null;
  const fresh = [];
  for (const t of tasks) {
    if (!t || typeof t !== "object" || rec.taskWords.some((w) => w.n === t.n) || fresh.some((f) => f.n === t.n)) continue;
    fresh.push(t);
  }
  if (!fresh.length) return { already: true };
  const taskWords = readTaskWords([...rec.taskWords, ...fresh]);
  if (!taskWords) return null;
  return { rec: { ...rec, taskWords, taskTries: 0, tasksWhy: null }, added: fresh.length };
}

/** A call for the tasks' lines that wrote nothing: tried again later while it has tries left, then given up with why. `{ rec, retry }`, or null without the lease. */
export function failTasks(rec, { owner, why, now }) {
  if (!leaseHeld(rec, owner, now)) return null;
  if ((rec.taskTries || 0) < PROGRESS_TRIES) return { rec: { ...rec, writer: null, retryAt: now + PROGRESS_RETRY_MS, asked: now + PROGRESS_RETRY_MS }, retry: true };
  return { rec: { ...rec, writer: null, taskTries: 0, retryAt: undefined, tasksWhy: String(why || "send").slice(0, 40) }, retry: false };
}

/** One task's lines for a reader — one per state in `TASK_STATES` — or null when they are not written. */
export function saidOf(rec, n) {
  const t = rec && Array.isArray(rec.tasks) ? rec.tasks.find((x) => x.n === n) : null;
  return t ? Object.fromEntries(TASK_STATES.map((k) => [k, t[k]])) : null;
}

/**
 * WHAT THE NEXT LINE MUST COVER: the milestones waiting, and their facts.
 * Settled facts (decided, designed, prepared, applied, notdone) come from
 * every waiting milestone; what is happening now and what comes next only
 * from the LAST — an earlier milestone's "publishing now" is no longer true
 * once a later one is recorded (a correction began, say), and its outcome is
 * not this record's to know, so it is left unsaid rather than said wrong.
 */
export function batchFor(rec) {
  const marks = pendingMarks(rec);
  const last = marks.length ? marks[marks.length - 1] : null;
  const facts = [];
  for (const m of marks) {
    for (const f of m.facts) {
      if ((f.state === "doing" || f.state === "next") && m !== last) continue;
      facts.push(f);
    }
  }
  return { marks: marks.map((m) => m.n), facts };
}

/**
 * THE LINE COMMITTED: the record with the line added and its milestones said,
 * the lease let go — or null when `owner` no longer holds a live lease on an
 * open record, which is a writer that lost its claim, a job that ended, or a
 * newer writer: its line is not used. COMMITTED UNCONFIRMED: no reader is
 * handed it until a read of the job's row made after this finds the job still
 * running (`confirmLines`).
 */
export function commitLine(rec, { owner, marks, text, now }) {
  if (!holds(rec, owner, now)) return null;
  const t = typeof text === "string" ? text.replace(/\r\n/g, "\n").trim() : "";
  if (!t) return null;
  const covered = new Set(Array.isArray(marks) ? marks : []);
  const n = rec.lines.length;
  return {
    ...rec,
    marks: rec.marks.map((m) => (covered.has(m.n) && m.state === "pending" ? { ...m, state: "said", line: n } : m)),
    lines: [...rec.lines, { n, at: now, text: t, marks: [...covered].sort((a, b) => a - b) }],
    writer: null, tries: 0, retryAt: undefined,
  };
}

/**
 * AN ATTEMPT THAT WROTE NOTHING: tried again `PROGRESS_RETRY_MS` later while
 * it has tries left, and then its milestones given up (`failed`, the reason
 * kept). Null when `owner` no longer holds the lease. `{ rec, retry }`.
 */
export function failBatch(rec, { owner, marks, why, now }) {
  if (!holds(rec, owner, now)) return null;
  const tries = rec.tries || 0;
  // THE RETRY'S OWN MESSAGE IS THE ASK, AT ITS TIME: nobody asks again before
  // it is due and its grace has passed.
  if (tries < PROGRESS_TRIES) return { rec: { ...rec, writer: null, retryAt: now + PROGRESS_RETRY_MS, asked: now + PROGRESS_RETRY_MS }, retry: true };
  const tried = new Set(Array.isArray(marks) ? marks : []);
  return {
    rec: {
      ...rec, writer: null, tries: 0, retryAt: undefined,
      marks: rec.marks.map((m) => (tried.has(m.n) && m.state === "pending" ? { ...m, state: "failed", why: String(why || "send").slice(0, 40) } : m)),
    },
    retry: false,
  };
}

/** The lease let go with nothing written or given up — a writer that stops early. */
export function releaseWriter(rec, owner) {
  if (!rec || !rec.writer || rec.writer.owner !== owner) return null;
  return { ...rec, writer: null };
}

/**
 * WHAT A READER IS HANDED: the CONFIRMED lines, in order, each with how far
 * into the job it was written — never the facts, the lease or anything
 * private. A line not confirmed is no reader's: the poll, a request's view,
 * the list, a reload and another device all read through here.
 */
export function linesOf(rec) {
  if (!rec) return [];
  return rec.lines.filter((l) => l.confirmed === true).map((l) => ({ n: l.n, ms: Math.max(0, l.at - rec.at), text: l.text }));
}

/** How many lines the record holds that are not confirmed yet. */
export const unconfirmedLines = (rec) => (rec ? rec.lines.filter((l) => l.confirmed !== true).length : 0);

/**
 * LINES CONFIRMED, ON EVIDENCE: every line numbered below `below` — the lines
 * the record held before the job's row was read — once that read found the job
 * still running under its run (`jobVerdict` ok). Such a line was committed
 * before the read, so before the job's end and its final reply. Open or
 * closed, with or without a lease: the read is the evidence, and a line
 * committed after it is never covered (lines are only appended, numbered in
 * order). Null when none changes.
 */
export function confirmLines(rec, below) {
  if (!rec || !Number.isInteger(below) || below <= 0) return null;
  let changed = false;
  const lines = rec.lines.map((l) => {
    if (l.n >= below || l.confirmed === true) return l;
    changed = true;
    return { ...l, confirmed: true };
  });
  return changed ? { ...rec, lines } : null;
}

// ── THE JOB'S OWN ROW DECIDES WHETHER A LINE MAY BE WRITTEN ─────────────────
//
// Owner: *"Check authoritative job state and writer ownership before starting
// and committing narration so completion, failure, cancellation or a newer
// attempt cannot produce stale updates after the final reply."* The row is
// `edit_jobs` as the service key reads it; `undefined` when it could not be
// read (never read as "gone"), null when there is none.
//   ok          running, under the run that recorded the milestones, its lease live;
//   unread      the row could not be read: write nothing now;
//   gone        no such job, or not this owner's;
//   ended       done, failed, cancelled or lost;
//   cancelled   the customer asked it to stop;
//   review      held for a person to settle;
//   superseded  another run holds it now;
//   stalled     its lease ran out — the runner is not renewing it.
const msOf = (v) => (typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN);
export function jobVerdict(row, rec, now) {
  if (row === undefined) return { ok: false, why: "unread" };
  if (!row || typeof row !== "object" || !rec) return { ok: false, why: "gone" };
  if (row.uid !== rec.uid) return { ok: false, why: "gone" };
  if (typeof row.state !== "string" || TERMINAL_STATES.includes(row.state)) return { ok: false, why: "ended" };
  if (row.cancel_requested_at !== null && row.cancel_requested_at !== undefined) return { ok: false, why: "cancelled" };
  if (row.needs_review === true) return { ok: false, why: "review" };
  if (row.lease_owner !== rec.run) return { ok: false, why: "superseded" };
  const until = msOf(row.lease_expires_at);
  if (!Number.isFinite(until) || until <= now) return { ok: false, why: "stalled" };
  return { ok: true };
}

// ── THE MILESTONES' FACTS, FROM EACH STEP'S OWN RESULT ──────────────────────
//
// Code writes these and the model only puts them into words: a fact is what a
// step returned, in the builder's own terms where it has no others (a lane's
// name, a page's address), and the model is told to say it in the customer's.

const fact = (state, text) => ({ state, text: flat(text) });
/** Names off a list of strings or objects (`name`, then `table`), each once, in order. */
const namesOf = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? str(x.name) || str(x.table) : "")).map(flat).filter(Boolean))];

/** One step of an edit, as the builder names it: what it changes, and on which page. */
function stepSaid(step) {
  const s = step && typeof step === "object" ? step : {};
  const fields = Array.isArray(s.fields) ? s.fields.filter((f) => typeof f === "string" && f) : [];
  const what = fields.length ? fields.join(", ") : str(s.layer) || "the site";
  const verb = s.remove === true ? "remove " : typeof s.rename === "string" && s.rename ? "move to " + s.rename + ": " : "";
  const page = typeof s.page === "string" && s.page ? " on " + s.page : "";
  return verb + what + page;
}
/** The layers whose change is made in the site's database rather than its pages. */
const DB_LAYERS = ["data", "rules"];

/** An edit's plan, at the steps it will run (a withheld step runs nothing, so is no plan). */
export function editPlanFacts(steps) {
  const run = (Array.isArray(steps) ? steps : []).filter((s) => s && typeof s === "object" && !s.withheld);
  if (!run.length) return [];
  return [
    fact("decided", "Worked out what to change, in the builder's terms: " + listOf(run.map(stepSaid)) + ". Nothing is changed yet."),
    fact("next", run.length === 1 ? "Make that change next." : "Make those changes next."),
  ];
}

/**
 * AN EDIT AT ITS PUBLISH: each step that worked, prepared (or applied, when its
 * change is in the database), each that did not, and the publish starting. A
 * failed step a later one did after all (`superseded`) is not told as failed.
 */
export function editPublishFacts(done) {
  const out = [];
  for (const d of Array.isArray(done) ? done : []) {
    if (!d || !d.step) continue;
    const what = stepSaid(d.step);
    if (!d.failed) out.push(DB_LAYERS.includes(d.step.layer) ? fact("applied", "Changed in the site's database: " + what + ".") : fact("prepared", "Made, not published yet: " + what + "."));
    else if (!d.superseded) out.push(fact("notdone", "Could not be made: " + what + ". The final message will say why."));
  }
  out.push(fact("doing", "Publishing the site with the changes now."));
  return out;
}

/** The publish found a style rule that would match nothing on the page, and a correction began. */
export function editCorrectFacts() {
  return [fact("doing", "The check before publishing found a style change that would not show on the page. Correcting it now.")];
}

/** The second publish, after a correction. */
export function editRepublishFacts() {
  return [fact("doing", "Publishing again with the correction.")];
}

// An add-on's kinds as a customer would call them — the facts' words, never a
// message: the model writes the message from them.
const KIND_SAID = Object.freeze({
  table: "a table to store information", row: "new entries in a list the site has", function: "a database function",
  api: "a connection to an outside service", job: "a task that runs on a timer", page: "a new page",
  component: "a new section on a page", words: "new words on a page", frame: "a new item in the menu, header or footer",
  qr: "a QR code", three: "a 3D scene", photo: "a photograph on a page",
});
const kindSaid = (k) => (Object.hasOwn(KIND_SAID, k) ? KIND_SAID[k] : flat(k));

/** What one design is, from the fields a design carries: its name, where it goes, its columns. */
function designSaid(kind, v) {
  const base = kindSaid(kind);
  if (!v || typeof v !== "object") return base;
  const bits = [];
  const name = str(v.name) || str(v.title) || str(v.label);
  const where = (typeof v.path === "string" && v.path.charAt(0) === "/" ? v.path : "") || str(v.route) || str(v.page) || pathOf(v.file);
  if (name) bits.push(quote(name));
  if (where) bits.push(where);
  if (str(v.table) && kind !== "table") bits.push("in " + quote(v.table));
  const cols = Array.isArray(v.columns) ? namesOf(v.columns) : [];
  if (cols.length) bits.push("columns " + listOf(cols.map(quote)));
  return bits.length ? base + " (" + bits.join(", ") + ")" : base;
}

/** The kinds an add-on chose, and that each is to be designed next. */
export function addonPickedFacts(kinds) {
  const ks = [...new Set((Array.isArray(kinds) ? kinds : []).filter((k) => typeof k === "string" && k))];
  if (!ks.length) return [];
  return [
    fact("decided", "Worked out what to add: " + listOf(ks.map(kindSaid)) + ". Nothing is built yet."),
    fact("next", ks.length === 1 ? "Design it next." : "Design each of them next."),
  ];
}

/** One kind designed — a list kind's every item — and what is designed or built next. */
export function addonDesignedFacts(kind, value, rest = []) {
  const items = (Array.isArray(value) ? value : [value]).filter((v) => v !== undefined && v !== null);
  const said = items.map((v) => designSaid(kind, v));
  const left = [...new Set((Array.isArray(rest) ? rest : []).filter((k) => typeof k === "string" && k))];
  return [
    fact("designed", "Designed, not built yet: " + listOf(said.length ? said : [kindSaid(kind)]) + "."),
    fact("next", left.length ? "Design " + listOf(left.map(kindSaid)) + " next." : "Build the additions next."),
  ];
}

/**
 * WHAT THE ADD-ON'S DATABASE CHANGE MADE, as its own result names it — and
 * nothing said to come next (2026-10-07): the apply runs at the publish's own
 * seam, after the pages were written, or on an addition with no page at all,
 * so "write the pages next" was never true of it. At the seam the publish is
 * still what is happening (`publishing`), and is said so.
 */
export function addonSchemaFacts({ tables = [], altered = [], functions = [], jobs = [] } = {}, { publishing = false } = {}) {
  const t = namesOf(tables), a = namesOf(altered), f = namesOf(functions), j = namesOf(jobs);
  const out = [];
  if (t.length) out.push(fact("applied", "Created in the site's database: " + (t.length === 1 ? "the table " : "the tables ") + listOf(t.map(quote)) + "."));
  if (a.length) out.push(fact("applied", "Changed in the site's database: " + listOf(a.map(quote)) + "."));
  if (f.length) out.push(fact("applied", "Set up in the site's database: " + listOf(f.map(quote)) + "."));
  if (j.length) out.push(fact("applied", "Set to run on a timer: " + listOf(j.map(quote)) + "."));
  if (!out.length) return [];
  if (publishing) out.push(fact("doing", "Publishing the site with the additions now."));
  return out;
}

/** Each address once, in order, from strings or `{ path }`. */
const pathsOf = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? pathOf(x) : x && typeof x === "object" ? pathOf(x.path) : "")).filter(Boolean))];

/**
 * THE ADD-ON'S PAGES, AS THEY WILL BE PUBLISHED (2026-10-07, after run 105):
 * recorded once the merge and the code's own menu links have settled them, in
 * three kinds a reader must not mix up — the new pages, the existing pages
 * this addition changed, and the existing pages whose one change is a menu
 * link to a new page (by the page each links to). Every address is named; a
 * page the merge put back as it was is in none of them. Run 105's line named
 * "the classes page" for a page whose writer's change was put back and whose
 * one change was that link, beside another part that was about that page.
 */
export function addonPagesFacts({ added = [], changed = [], linked = [] } = {}) {
  const out = [];
  const a = pathsOf(added);
  const c = pathsOf(changed).filter((x) => !a.includes(x));
  if (a.length) out.push(fact("prepared", (a.length === 1 ? "New page written, not published yet: " : "New pages written, not published yet: ") + listOf(a) + "."));
  if (c.length) out.push(fact("prepared", (c.length === 1 ? "Existing page changed for this addition, not published yet: " : "Existing pages changed for this addition, not published yet: ") + listOf(c) + "."));
  // ONE FACT FOR EACH SET OF NEW PAGES LINKED TO, naming every page that got it.
  const groups = new Map();
  for (const l of Array.isArray(linked) ? linked : []) {
    const at = l && typeof l === "object" ? pathOf(l.path) : "";
    const to = pathsOf(l && l.to);
    if (!at || !to.length || a.includes(at) || c.includes(at)) continue;
    const key = to.join("\n");
    if (!groups.has(key)) groups.set(key, { to, at: [] });
    if (!groups.get(key).at.includes(at)) groups.get(key).at.push(at);
  }
  for (const g of groups.values()) {
    out.push(fact("prepared", "A menu link to " + listOf(g.to) + " added, and nothing else changed, not published yet, on " + (g.at.length === 1 ? "the existing page " : "the existing pages ") + listOf(g.at) + "."));
  }
  if (!out.length) return [];
  out.push(fact("next", "Publish the site next."));
  return out;
}

/** The add-on's publish starting. */
export function addonPublishFacts() {
  return [fact("doing", "Publishing the site with the additions now.")];
}

// ── THE CALL ────────────────────────────────────────────────────────────────

export const PROGRESS_TOOL = {
  name: "write_progress",
  description: "Write the one progress update the customer reads now, and list each fact you described with the state you described it as.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The update, in your own words." },
      says: {
        type: "array",
        description: "Every fact's id, exactly as written in brackets, with the state you described it as.",
        items: {
          type: "object",
          properties: { id: { type: "string" }, as: { type: "string", enum: [...PROGRESS_STATES] } },
          required: ["id", "as"],
        },
      },
    },
    required: ["text", "says"],
  },
};

// CONCISE ON PURPOSE (the owner: *"Keep instructions concise rather than
// relying on an arbitrary short character limit"*). It asks for a short line;
// nothing in code measures one.
export const PROGRESS_SYSTEM =
  "You are an AI website builder, writing one short progress update in the chat while you are still working on a customer's request. " +
  "Your code records each step as it really happens and gives you the facts since your last update, each with an id and a state. " +
  "Tell the customer yourself what has happened and what comes next.\n\n" +
  "THE STATES\n" +
  "decided: worked out what to do; nothing has changed yet.\n" +
  "designed: designed; nothing has been built yet.\n" +
  "prepared: made in the builder but not published; visitors cannot see it.\n" +
  "applied: in effect in the site's database.\n" +
  "doing: happening now; not finished.\n" +
  "next: planned; not started.\n" +
  "notdone: could not be made; the final message will say why.\n\n" +
  "RULES\n" +
  "- Speak in the first person, naturally and conversationally, the way you would tell them yourself: next facts as what you will do, doing facts as what you are doing now, the rest as what you have done or could not do.\n" +
  "- Describe each fact as its state says, and say nothing the facts do not: no other steps, results, times or problems.\n" +
  "- Never say or suggest that anything is published or live, or that their request is finished: the builder's final message says that.\n" +
  "- Do not repeat what your earlier updates said.\n" +
  "- The request's other parts are separate work: never describe them as this update's, or as done unless their state says finished.\n" +
  "- Describe their site in their own words; never mention steps, tools, files, code, models, ids or states.\n" +
  "- Write in the language of their request. Keep it short, usually a sentence or two, with no greeting or sign-off.\n" +
  "- In says, list every fact's id with the state you described it as.";

// ── EACH TASK'S LINE, IN EVERY STATE IT CAN BE IN ──────────────────────────

export const TASK_TOOL = {
  name: "write_tasks",
  description: "Write, for every task, the line you would show the customer in each of its states.",
  input_schema: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        description: "One entry per task, its id exactly as written in brackets.",
        items: {
          type: "object",
          properties: { id: { type: "string" }, ...Object.fromEntries(TASK_STATES.map((k) => [k, { type: "string" }])) },
          required: ["id", ...TASK_STATES],
        },
      },
    },
    required: ["tasks"],
  },
};

// CONCISE, AND NO EXAMPLE TO COPY (the owner: *"These are tone examples, not
// templates … Don't add hardcoded prefixes to the user's words."*). The model
// writes every state; code shows the one the task is really in.
export const TASK_SYSTEM =
  "You are an AI website builder. For each task in a customer's request, write the short line you would show them about it, once for each state it can be in; " +
  "your code shows the line for the state the task is really in.\n\n" +
  "THE STATES\n" +
  "planned: still to be done; say you will do it.\n" +
  "doing: happening now; say you are doing it.\n" +
  "waiting: it cannot go on until they answer you or give you the go-ahead; say you need that from them.\n" +
  "unconfirmed: you tried to make it but cannot yet tell whether it went through; say so, without saying it is happening now or that it is done.\n" +
  "done: finished; say you did it.\n" +
  "partial: some of it was done and some was not; say so.\n" +
  "notdone: it was not done; say so.\n" +
  "Give no reasons: the final message gives them.\n\n" +
  "RULES\n" +
  "- Speak in the first person, naturally and conversationally, the way you would tell them yourself.\n" +
  "- Say what the task is in your own words; never hand their words back as an instruction.\n" +
  "- Never say a change is published or live, and never mention steps, tools, files, code, models or ids.\n" +
  "- Write in the language of their request. Keep each line short, usually one sentence, with no greeting.";

/** The request one task-lines call sends: every task, each with its id and the customer's words for it. `fix` names what a first answer got wrong. */
export function taskRequest({ tasks, context = "", model, fix = null }) {
  const told = [];
  if (fix && fix.missing && fix.missing.length) told.push("YOUR LAST ANSWER LEFT OUT, OR LEFT A STATE EMPTY FOR, " + fix.missing.join(", ") + ".");
  if (fix && fix.ids) told.push("YOUR LAST ANSWER PUT A TASK'S ID IN A LINE.");
  const body = (context ? context + "\n\n" : "") +
    "THE TASKS (write each in every state; put its id in tasks):\n" +
    tasks.map((t) => "[t" + t.n + "] " + flat(t.words)).join("\n") +
    (told.length ? "\n\n" + told.join(" ") + " Write them again." : "");
  return {
    model,
    max_tokens: TASK_MAX_TOKENS,
    tools: [TASK_TOOL],
    tool_choice: { type: "tool", name: TASK_TOOL.name },
    system: [{ type: "text", text: TASK_SYSTEM }],
    messages: [{ role: "user", content: body }],
  };
}

/**
 * TASK LINES, READ AND CHECKED: every task, by its id, with a line in every
 * state, and no id in any line. `{ ok, tasks, missing, ids, why }`; the first
 * entry for an id is the one read. Like `readProgress`, this reads the
 * answer's shape, never its words — nothing here looks for a phrase.
 */
export function readTasks(reply, tasks) {
  const none = (why) => ({ ok: false, tasks: [], missing: [], ids: false, why });
  const block = reply && Array.isArray(reply.content) ? reply.content.find((b) => b && b.type === "tool_use" && b.name === TASK_TOOL.name) : null;
  const input = block && block.input && typeof block.input === "object" ? block.input : null;
  if (!input || !Array.isArray(input.tasks)) return none(reply && reply.stop_reason === "max_tokens" ? "cut" : "unreadable");
  const want = (Array.isArray(tasks) ? tasks : []).map((t) => "t" + t.n);
  const got = new Map();
  for (const e of input.tasks) {
    const id = e && typeof e.id === "string" ? e.id.trim() : "";
    if (!want.includes(id) || got.has(id)) continue;
    const said = readSaid(e);
    if (said) got.set(id, said);
  }
  const missing = want.filter((id) => !got.has(id));
  const ids = [...got.values()].some((said) => TASK_STATES.some((k) => /\[t\d+\]/.test(said[k])));
  const ok = want.length > 0 && !missing.length && !ids;
  return { ok, tasks: ok ? tasks.map((t) => ({ n: t.n, ...got.get("t" + t.n) })) : [], missing, ids, why: ok ? "" : ids ? "ids" : "uncovered" };
}

/**
 * WRITE THE TASKS' LINES. Never throws. `{ ok: true, tasks, usage, attempts }`,
 * or `{ ok: false, why, usage, attempts }` — `why` one of `no-tasks`, `send`,
 * `deadline`, `unreadable`, `cut`, `uncovered`, `ids`. At most two calls: a
 * first answer that left a task or a state out, or put an id in a line, is
 * asked once more, told which.
 */
export async function writeTasks(deps, { tasks, context = "", model, deadlineMs = PROGRESS_DEADLINE_MS, now = () => Date.now() } = {}) {
  const usage = [];
  if (!Array.isArray(tasks) || !tasks.length) return { ok: false, why: "no-tasks", usage, attempts: 0 };
  if (!deps || typeof deps.send !== "function") return { ok: false, why: "send", usage, attempts: 0 };
  const start = now();
  let fix = null;
  let attempts = 0;
  let why = "unreadable";
  while (attempts < 2) {
    const left = deadlineMs - (now() - start);
    if (left <= 0) return { ok: false, why: "deadline", usage, attempts };
    attempts++;
    let timer;
    let reply;
    try {
      reply = await Promise.race([
        Promise.resolve().then(() => deps.send(taskRequest({ tasks, context, model, fix }))),
        new Promise((_, no) => { timer = setTimeout(() => no(Object.assign(new Error("tasks deadline"), { deadline: true })), left); }),
      ]);
    } catch (e) {
      return { ok: false, why: e && e.deadline ? "deadline" : "send", usage, attempts };
    } finally {
      if (timer) clearTimeout(timer);
    }
    usage.push(progressUsage(reply, model));
    const read = readTasks(reply, tasks);
    if (read.ok) return { ok: true, tasks: read.tasks, usage, attempts };
    why = read.why;
    if (why === "unreadable" || why === "cut") break;
    fix = { missing: read.missing, ids: read.ids };
  }
  return { ok: false, why, usage, attempts };
}

/** What the model is shown besides the facts: their site, its pages, their words, and the updates already written. */
export function progressContext(rec, { others = [] } = {}) {
  const lines = [];
  if (rec && rec.slug) lines.push("THEIR SITE: " + rec.slug);
  if (rec && rec.pages && rec.pages.length) lines.push("ITS PAGES: " + rec.pages.join(", "));
  // WHAT KIND OF WORK THIS IS (2026-10-07): a change to what is there, or an
  // addition — the record has always known, and the writer was never told.
  if (rec && Object.hasOwn(WORK_SAID, rec.op)) lines.push("THIS WORK: " + WORK_SAID[rec.op]);
  const words = rec && typeof rec.words === "string" ? rec.words.trim() : "";
  if (words) lines.push("WHAT THEY ASKED FOR:\n" + flat(words));
  // THE REQUEST'S OTHER PARTS AS THEY STAND (2026-10-07, after run 105): work
  // of its own, finished or still to come, that this update must not take for
  // its own — read off the request when the line is written (`otherParts`).
  const rest = (Array.isArray(others) ? others : []).filter((o) => o && typeof o.words === "string" && o.words.trim() && Object.hasOwn(STATE_SAID, o.state));
  if (rest.length) lines.push("THE OTHER PARTS OF THE SAME REQUEST (separate work, not this update's):\n" + rest.map((o) => "- " + quote(flat(o.words)) + " (" + (Object.hasOwn(PREP_SAID, o.prep) ? PREP_SAID[o.prep] : STATE_SAID[o.state]) + ")").join("\n"));
  if (rec && rec.lines.length) lines.push("WHAT YOUR EARLIER UPDATES SAID, IN ORDER:\n" + rec.lines.map((l) => "- " + flat(l.text)).join("\n"));
  return lines.join("\n\n");
}

/** What each kind of job's work is, as the writer is told it. */
const WORK_SAID = Object.freeze({ edit: "a change to what the site already has", addon: "an addition to the site" });

/**
 * A REQUEST PART'S STATUS AS A TASK'S STATE — the very map the page uses to
 * pick a task's line (`SITE_SAID_FOR` in public/chat.js, which this module
 * cannot import; `test/progress-context.test.mjs` holds the two equal).
 */
export const PART_STATE = Object.freeze({
  blocked: "planned", ready: "planned", queued: "planned", waiting: "waiting", approval: "waiting",
  started: "doing", unverified: "unconfirmed", done: "done", partial: "partial",
  failed: "notdone", "not-run": "notdone", cancelled: "notdone", expired: "notdone", refused: "notdone", "needs-rewrite": "notdone",
});
/** Each state as the writer reads it beside another part. */
const STATE_SAID = Object.freeze({
  planned: "not started yet", waiting: "waiting on the customer", doing: "in progress", unconfirmed: "finished, its publish not confirmed",
  done: "finished", partial: "partly finished", notdone: "not done",
});

/**
 * A PART BEING PREPARED BESIDE THIS ONE (2026-10-09), as the writer is told
 * it: what has actually happened to it — worked out, or being worked out —
 * and that none of it is on the site yet, so no line says it is done.
 */
const PREP_SAID = Object.freeze({
  preparing: "being worked out alongside this one; nothing of it is on the site yet",
  prepared: "worked out and waiting its turn to go on the site; not on the site yet",
});

/**
 * THE OTHER PARTS OF A JOB'S REQUEST, from the request record as it stands:
 * each part but the job's own, in the customer's words as its card shows them
 * (`shown`, then `words`), with its state (`PART_STATE`). [] when the job is
 * no request's, the record is another owner's, or a part does not read.
 */
export function otherParts(rec, request) {
  if (!rec || !rec.request || !request || typeof request !== "object" || request.uid !== rec.uid || !Array.isArray(request.parts)) return [];
  const out = [];
  for (const p of request.parts) {
    if (!p || typeof p !== "object" || !Number.isInteger(p.n) || p.n === rec.request.part) continue;
    const words = (typeof p.shown === "string" && p.shown.trim()) ? p.shown : typeof p.words === "string" ? p.words : "";
    if (!words.trim() || !Object.hasOwn(PART_STATE, p.status)) continue;
    // A PART BEING PREPARED BESIDE THIS ONE (2026-10-08) is in progress, as
    // its card says — never finished until its own job applied it.
    // The record's own reading (`prepState`), freshness included.
    const prep = prepState(p);
    out.push({ n: p.n, words, state: prep ? "doing" : PART_STATE[p.status], ...(prep ? { prep } : {}) });
  }
  return out;
}

/** The request one progress call sends: every fact of the batch, whole. `fix` names what a first answer got wrong. */
export function progressRequest({ facts, context = "", model, fix = null }) {
  const told = [];
  if (fix && fix.missing && fix.missing.length) told.push("YOUR LAST UPDATE LEFT OUT " + fix.missing.join(", ") + ".");
  if (fix && fix.wrong && fix.wrong.length) told.push("YOUR LAST UPDATE DESCRIBED " + fix.wrong.map((w) => w.id + " as " + (w.as || "nothing") + ", but its state is " + w.state).join("; ") + ".");
  if (fix && fix.ids) told.push("YOUR LAST UPDATE PUT A FACT'S ID IN ITS TEXT.");
  const body = (context ? context + "\n\n" : "") +
    "WHAT HAS HAPPENED SINCE (describe each fact in its state; list each id with that state in says):\n" +
    facts.map((f) => "[" + f.id + "] (" + f.state + ") " + f.text).join("\n") +
    (told.length ? "\n\n" + told.join(" ") + " Write the update again." : "");
  return {
    model,
    max_tokens: PROGRESS_MAX_TOKENS,
    tools: [PROGRESS_TOOL],
    tool_choice: { type: "tool", name: PROGRESS_TOOL.name },
    system: [{ type: "text", text: PROGRESS_SYSTEM }],
    messages: [{ role: "user", content: body }],
  };
}

/**
 * AN UPDATE, READ AND CHECKED: the forced tool's `text`, carrying no fact id,
 * with every fact listed in `says` in its own state. `{ ok, text, missing,
 * wrong, ids, why }`. A fact listed twice in two states is a fact misstated.
 * ⚠ THIS READS WHAT THE MODEL SAYS IT DID, NOT ITS WORDS: an update that lists
 * every fact rightly and still calls the page live passes here (the module's
 * header says why, and what stands behind it instead).
 */
export function readProgress(reply, facts) {
  const none = (why) => ({ ok: false, text: "", missing: [], wrong: [], ids: false, why });
  const block = reply && Array.isArray(reply.content) ? reply.content.find((b) => b && b.type === "tool_use" && b.name === PROGRESS_TOOL.name) : null;
  const input = block && block.input && typeof block.input === "object" ? block.input : null;
  if (!input || typeof input.text !== "string" || !Array.isArray(input.says)) return none(reply && reply.stop_reason === "max_tokens" ? "cut" : "unreadable");
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (!text) return none("unreadable");
  const list = Array.isArray(facts) ? facts : [];
  const ids = list.some((f) => new RegExp("\\[" + f.id + "\\]").test(text));
  const said = new Map();
  const twice = new Set();
  for (const s of input.says) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.as !== "string") continue;
    const id = s.id.trim();
    const as = s.as.trim().toLowerCase();
    if (said.has(id) && said.get(id) !== as) twice.add(id);
    else said.set(id, as);
  }
  const missing = list.filter((f) => !said.has(f.id)).map((f) => f.id);
  const wrong = list.filter((f) => said.has(f.id) && (twice.has(f.id) || said.get(f.id) !== f.state)).map((f) => ({ id: f.id, as: twice.has(f.id) ? "two states" : said.get(f.id), state: f.state }));
  const ok = !ids && !missing.length && !wrong.length;
  return { ok, text: ok ? text : "", missing, wrong, ids, why: ok ? "" : ids ? "ids" : wrong.length ? "misstated" : "uncovered" };
}

/** The four token kinds of one answer, in the shape `pageCredits` prices. */
export function progressUsage(reply, model) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0, out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0, cacheWrite: Number(u.cache_creation_input_tokens) || 0, model,
  };
}

/**
 * WHAT ONE NARRATION CALL COST US, AS ONE LOG LINE (2026-10-07) — the line
 * `scripts/narration-usage.mjs` reads back (`parseCall`), built here for both
 * writers (`kind` "line" or "tasks") and printed as ONE string, so its shape
 * never rests on how a log joins arguments. With the cached input the answers
 * reported beside the fresh (`progressUsage`): the line used to print fresh
 * tokens only, so every cost read from it was a floor while the writer held
 * the rest. A `why` or a name is one word here, so the line always reads.
 */
export function usageLogLine({ kind, id, ok, why = "", model, milestones = 0, facts = 0, tasks = 0, attempts = 0, usage = [], ms = 0 } = {}) {
  const sum = (Array.isArray(usage) ? usage : []).reduce((t, u) => ({
    in: t.in + (Number(u && u.in) || 0), out: t.out + (Number(u && u.out) || 0),
    cacheRead: t.cacheRead + (Number(u && u.cacheRead) || 0), cacheWrite: t.cacheWrite + (Number(u && u.cacheWrite) || 0),
  }), { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 });
  const word = (v) => String(v == null ? "" : v).replace(/[\s()]+/g, "-") || "-";
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
  return "progress: " + (kind === "tasks" ? "tasks " : "") + word(id) + " " + (ok ? "written" : "not written (" + word(why) + ")") +
    " model " + word(model) + " " + (kind === "tasks" ? "tasks " + n(tasks) : "milestones " + n(milestones) + " facts " + n(facts)) +
    " attempts " + n(attempts) + " tokens " + n(sum.in) + "/" + n(sum.out) + " cache " + n(sum.cacheRead) + "/" + n(sum.cacheWrite) + " ms " + n(ms);
}

/**
 * WRITE ONE UPDATE. Never throws. `{ ok: true, text, usage, attempts }`, or
 * `{ ok: false, why, usage, attempts }` — `why` one of `no-facts`, `send`,
 * `deadline`, `unreadable`, `cut`, `uncovered`, `misstated`, `ids`. At most
 * two calls: a first answer that left a fact out, misstated one, or put an id
 * in its words is asked once more, told which.
 */
export async function writeProgress(deps, { facts, context = "", model, deadlineMs = PROGRESS_DEADLINE_MS, now = () => Date.now() } = {}) {
  const usage = [];
  if (!Array.isArray(facts) || !facts.length) return { ok: false, why: "no-facts", usage, attempts: 0 };
  if (!deps || typeof deps.send !== "function") return { ok: false, why: "send", usage, attempts: 0 };
  const start = now();
  let fix = null;
  let attempts = 0;
  let why = "unreadable";
  while (attempts < 2) {
    const left = deadlineMs - (now() - start);
    if (left <= 0) return { ok: false, why: "deadline", usage, attempts };
    attempts++;
    let timer;
    let reply;
    try {
      reply = await Promise.race([
        Promise.resolve().then(() => deps.send(progressRequest({ facts, context, model, fix }))),
        new Promise((_, no) => { timer = setTimeout(() => no(Object.assign(new Error("progress deadline"), { deadline: true })), left); }),
      ]);
    } catch (e) {
      return { ok: false, why: e && e.deadline ? "deadline" : "send", usage, attempts };
    } finally {
      if (timer) clearTimeout(timer);
    }
    usage.push(progressUsage(reply, model));
    const read = readProgress(reply, facts);
    if (read.ok) return { ok: true, text: read.text, usage, attempts };
    why = read.why;
    if (why === "unreadable" || why === "cut") break;
    fix = { missing: read.missing, wrong: read.wrong, ids: read.ids };
  }
  return { ok: false, why, usage, attempts };
}
