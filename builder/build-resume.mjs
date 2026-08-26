// THE BUILD COMES BACK TO A JOB IT ALREADY STARTED.
//
// WHAT THIS IS FOR. Moving the generation CALL into the container was only half
// the problem. The Worker still WAITED for it, on the side with a hard
// fifteen-minute consumer cap — so a build whose design takes ~170s and whose
// generation takes 334k-620k ms is past the ceiling on a slow draw, and runs 38
// and 39 both died at the budget having published nothing. Two consecutive cuts
// at the same wall, ~13 minutes and ~6 credits each.
//
// The shape that fixes it: one consumer invocation does the design, FIRES the
// generation at the container and returns; a later, short invocation reads the
// answer and finishes. No single invocation is ever long, and the cap stops
// binding. What has to survive between them is this record.
//
// WHY THIS IS A MODULE. Every decision here is one two DIFFERENT consumer
// invocations have to agree on exactly — the key, the shape, the clock, and
// above all what has already been charged. Two copies of that agreement is how
// one invocation starts charging for what the other already took. It has no R2,
// no queue, no clock of its own and no request, so all of it is driven in the
// unit suite.
//
// NOTHING HERE PERFORMS I/O, and that is asserted rather than merely intended.
// The caller does every read, every write and every ledger call; a mistake in
// this file cannot be a mistake about a bucket or about money.
//
// AND NOTHING HERE READS A CLOCK. `now` is a parameter at every site, so a
// decision is reproducible — a rule that consults `Date.now()` cannot be driven
// past its own deadline in a test, which is exactly the case that matters.

import { BUILDER_CALL_MS, retryHere } from "./build-call.mjs";

// The one prefix, shared with `build-job.mjs` — under `jobs/`, which nothing
// serves. A resume record holds the caller's own access token for the same
// reason the job does (`use_credits` reads `auth.uid()`, so a service key
// cannot charge a user at all), and being unreachable from outside is what
// makes that allowable.
export const RESUME_PREFIX = "jobs/";

// The envelope's own kind and version. A record written by an older deploy and
// picked up by a newer one is REFUSED rather than reinterpreted: the fields
// that would be misread are the auth token and the list of what has already
// been taken from somebody's ledger.
export const RESUME_KIND = "site-build-resume";
export const RESUME_VERSION = 1;

// HOW MANY CARRIED MARKS A RECORD MAY HOLD. A fire's whole trace is ~16, and
// this record is read and re-written on every look — so an unbounded list is a
// record that grows for as long as a build keeps being looked at. The OLDEST go,
// because the marks nearest the failure are the ones anybody is reading for.
export const MAX_RESUME_STEPS = 40;

// CLOUDFLARE'S OWN CEILING ON A DELAYED MESSAGE — 24 hours, for `send()` and
// `msg.retry()` alike (verified against their documentation rather than
// assumed). A value past it is not a slower resume, it is a call the platform
// REFUSES — the class that shipped nothing on three consecutive merges here.
export const MAX_DELAY_SECONDS = 86_400;

/**
 * HOW THE TWO INVOCATIONS AVOID BOTH CHARGING FOR ONE BUILD.
 *
 * A queue delivers AT LEAST ONCE. `use_credits` is atomic and is NOT
 * idempotent, so two invocations that both believe they are the first take the
 * money twice. Two independent things stop that and BOTH are needed:
 *
 *   SEQUENTIAL — a redelivery that arrives after the first finished reads
 *   `charged` and skips what is named there. That is `alreadyCharged`.
 *
 *   CONCURRENT — two invocations in flight together both read `charged: []`,
 *   so the list cannot help. What separates them is a compare-and-set on the
 *   record itself: R2's `put(key, value, { onlyIf: { etagMatches } })` returns
 *   NULL when the condition fails (Cloudflare's own words: "In the event that a
 *   precondition specified in options fails, put() returns null, and the object
 *   will not be stored"). So the loser is told, rather than silently winning a
 *   race it should have lost.
 *
 * THE CLAIM IS THE LOOK BUMP, AND IT COMES BEFORE ANY MONEY MOVES:
 *
 *   1. read the record, keeping its etag
 *   2. decide (`resumeDecision`)
 *   3. write `nextLook(record)` back with `onlyIf: { etagMatches: <etag> }`
 *      · null  → somebody else holds this build. Do nothing, ack, stop.
 *      · ok    → the claim is ours; poll, publish, charge, record the charge
 *
 * `delete()` HAS NO `onlyIf`, which is why the claim is on the PUT and never on
 * the removal — a conditional delete would be the obvious shape and does not
 * exist.
 *
 * THE ONE CASE THIS GETS WRONG, STATED: an invocation that claims, publishes,
 * and then dies before recording the charge leaves a site published and unpaid
 * for. That is the SAFE direction — the customer has what they asked for and we
 * are out of pocket — and it is the opposite of the failure the whole mechanism
 * exists to prevent, which is billing somebody twice for one site.
 */

// HOW LONG BETWEEN LOOKS, AND THE CEILING IS NOT ARBITRARY.
//
// `SiteBuildContainer.sleepAfter` is FIVE MINUTES. The busy counter is the
// primary keep-alive — `oneAtATime` holds it for the whole generation and
// `onActivityExpired` refuses to stop a busy container — but every request
// through the container proxy ALSO pushes the activity timeout to now+5m, so a
// poll well inside that window means the hook rarely has to fire at all.
//
// Sixty seconds: a fifth of the idle window, and ~10 looks across a real
// ten-minute generation. Shorter buys nothing (the answer is minutes away);
// longer walks toward the one failure that loses everything — a container
// stopped with the answer in its memory.
export const RESUME_POLL_SECONDS = 60;

// THE FIRST LOOK IS LATER THAN THE REST, because the answer cannot possibly be
// ready sooner. The five measured samples of one brief are 333,716 · 340,277 ·
// 595,900 · 608,372 · 619,822 ms, so nothing has ever come back inside four
// minutes. Looking at 60s would spend five invocations to be told `pending`.
export const RESUME_FIRST_SECONDS = 240;

// PAST THIS, NO ANSWER IS COMING. The container caps the call at
// `BUILDER_CALL_MS` with its own `AbortSignal`, so a generation that has not
// settled by then has been aborted — and an aborted one reports `failed`, not
// `pending`. Slack on top for the fire, the queue and the poll itself.
export const RESUME_SLACK_MS = 90_000;
export const RESUME_DEADLINE_MS = BUILDER_CALL_MS + RESUME_SLACK_MS;

// A BOUND ON THE LOOKS THEMSELVES, beside the clock rather than instead of it.
// The clock is what SHOULD end this; the count is what ends it if a clock is
// broken or a record is hand-edited — the same reason `site-teardown.mjs`
// escalates on attempts as well as on time. Generous enough that no honest
// build reaches it: the deadline is hit ~11 minutes in, which is ~11 looks.
export const RESUME_MAX_LOOKS = 40;

// ── WHEN THE CONTAINER HAS NOT GOT IT: FIRE AGAIN, ON THE SIDE WITH NO CLOCK ──
//
// THIS REPLACES A FALLBACK THAT WAS DOOMED BY ARITHMETIC. Until 2026-08-26 a
// container that could not produce the answer sent the resume down `here`: the
// Worker re-ran the WHOLE generation itself under `capMs(BUILDER_CALL_MS)`, ten
// minutes. This brief measures 333k-620k ms with two recent runs CUT past 600k,
// so that fallback walked straight back into the ceiling stage 2 exists to
// escape — and run 40 died in exactly it, `TimeoutError`, no site.
//
// The container has no fixed runtime limit. So the answer to "the work is gone"
// is to start it again THERE, not here.
//
// ONE, AND THE NUMBER IS A MONEY DECISION RATHER THAN A TUNING ONE. Each re-fire
// is a real generation somebody pays a provider for. One is exactly what the old
// `here` already cost — a single extra call — so this is not a new spend, it is
// the same spend moved to the side that can finish it. Past it the build stops
// and says so, which is more honest than another ten minutes of waiting for a
// call that cannot fit.
//
// A RE-FIRE IS NOT A CHARGE OF OURS, which is why it must not claim the `pages`
// mark: nothing has left the ledger, and marking it would make the very next
// look refuse the build outright.
export const RESUME_MAX_REFIRES = 1;

/**
 * The acts that END a build, and therefore the ones whose claim marks `pages`.
 *
 * DERIVED FROM HERE RATHER THAN SPELLED AT THE CALL SITE, because the call site
 * used to read `act === "wait" ? claim : chargeClaim` — a rule stated as "every
 * act except one", which was true while `wait` was the only non-terminal act and
 * silently wrong the moment `refire` existed. A refire marked as charged is a
 * build that fires a second generation and then refuses to collect it.
 */
export const TERMINAL_ACTS = Object.freeze(["finish", "stop"]);

/** Does this decision end the build — i.e. is it about to spend? */
export function isTerminal(act) {
  return TERMINAL_ACTS.includes(act);
}

/** The names of the things that cost money, so "what has already been taken"
 *  is a closed vocabulary rather than whatever string a call site invents. A
 *  typo in a free-form name is a second charge for work already paid for, and
 *  nothing would report it. */
export const CHARGE_STEPS = Object.freeze(["deposit", "schema", "pages"]);

/**
 * HOW "I FIRED IT, I AM NOT WAITING" GETS OUT OF THE GENERATOR.
 *
 * `generateSitePages` takes the model call as a PARAMETER and has no catch
 * around it, which is what makes both halves of this possible with no change to
 * that file at all:
 *
 *   FIRING   a `call` that starts the job and throws this — the request has been
 *            built and sent, and there is no answer to return.
 *   RESUMING a `call` that returns the STORED answer, so the generator parses
 *            it, extracts the usage and prices the build through the IDENTICAL
 *            code the synchronous path uses. No second copy of the billing.
 *
 * AN ERROR RATHER THAN A RETURN VALUE because a `call` must answer with a model
 * response or not at all — anything else would have to be understood by
 * `generateSitePages`, and teaching it a second shape is how the parse and the
 * usage extraction come to have two paths, one of which nobody drives.
 *
 * IT MUST NEVER LOOK LIKE A FAILURE. `retryHere` reads `e.name` to decide
 * whether money was spent, so this name may not collide with an abort's
 * (`TimeoutError`/`AbortError`) and the sentinel must be recognised BEFORE any
 * failure handling — a fire read as a failed call would be retried in the
 * Worker, which is a second ten-minute generation nobody asked for.
 */
export const FIRED_NAME = "PagesFired";

export function firedError(resume) {
  const e = new Error("generation was fired at the container; there is no answer to return here");
  e.name = FIRED_NAME;
  e.resume = resume || null;
  return e;
}

/** The one reader. Answers the resume details, or null for any other throw —
 *  so a caller cannot mistake an ordinary failure for a fire by checking the
 *  name and forgetting the payload. */
export function readFired(e) {
  if (!e || e.name !== FIRED_NAME) return null;
  const r = e.resume;
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  if (typeof r.genId !== "string" || !r.genId) return null;
  if (typeof r.lane !== "string" || !r.lane) return null;
  if (!Number.isFinite(r.firedAt) || r.firedAt <= 0) return null;
  // THE REPORT TOKEN IS OPTIONAL AND THE OTHER THREE ARE NOT, deliberately. A
  // fire with no token still produces a resumable build — the answer is only in
  // the container's memory, which is what every build did before it existed — so
  // refusing one here would turn a durability improvement into a way to lose a
  // generation that is running perfectly well.
  return { genId: r.genId, lane: r.lane, report: isReportToken(r.report) ? r.report : "", firedAt: Math.trunc(r.firedAt) };
}

/** A resume id is the BUILD's own job id — 32 hex characters, minted by
 *  `build-job.mjs`. One record per build, so re-deriving an id here would be a
 *  second answer to a question that already has one. */
const ID_RE = /^[0-9a-f]{32}$/;

export function isResumeId(id) {
  return typeof id === "string" && ID_RE.test(id);
}

/**
 * The record's key. Built only from an id we minted — an unvalidated id is a
 * path a caller chooses, and the id also reaches a log line.
 *
 * `.resume.json` rather than a second prefix, so an operator listing a stranded
 * build sees its job, its result and its resume together.
 */
export function resumeKey(id) {
  if (!isResumeId(id)) throw new Error("build-resume: refusing to build a key from an id we did not mint");
  return `${RESUME_PREFIX}${id}.resume.json`;
}

/**
 * WHERE THE ANSWER LIVES ONCE IT IS OUT OF THE CONTAINER'S MEMORY.
 *
 * THE PROBLEM THIS SOLVES. `MODEL_JOBS` is a `Map` in ONE container instance's
 * memory holding whole model answers — the container's own comment says
 * "megabytes each". If that instance goes, the generation is unrecoverable: the
 * poll answers `unknown` and the only way back is to buy another one. Cloudflare
 * gives no guarantee an instance survives, so the answer must not live only
 * there.
 *
 * KEYED BY THE REPORT TOKEN, NOT BY THE JOB ID, and that is forced rather than
 * chosen: the container is told where to report at FIRE time, and the fire does
 * not know the resume id — the id is minted by the caller from the sentinel this
 * throws. A token minted before the POST is the one name both sides can agree on
 * without a second round trip.
 *
 * SO THE TOKEN IS ALSO THE CREDENTIAL, and it is the only one. The route that
 * receives the report is unauthenticated — the container holds no session — so
 * whoever knows the token can write one generation's answer. 128 bits, minted
 * per job, stored in the record, never returned to any caller and never logged.
 * The alternative was a presigned R2 PUT, which needs SigV4 and therefore R2 S3
 * credentials in the Worker: a new credential type and a new secret to rotate,
 * for the same scoping this already has.
 *
 * VALIDATED BEFORE IT REACHES A KEY, by the same rule `isResumeId` exists for: a
 * value a caller supplies is a path a caller chooses.
 */
export function isReportToken(t) {
  return typeof t === "string" && /^[0-9a-f]{32}$/.test(t);
}

export function genKey(token) {
  if (!isReportToken(token)) throw new Error("build-resume: refusing to build a key from a token we did not mint");
  return `${RESUME_PREFIX}gen-${token}.json`;
}

/**
 * WHAT THE CONTAINER REPORTED, READ BACK IN THE SHAPE THE POLL ALREADY SPEAKS.
 *
 * ONE VOCABULARY, DELIBERATELY. `resumeDecision` reads `{state, answer|status,
 * kind, message}` — the body of `GET /model/result` — and this hands back the
 * same thing, so a stored answer and a polled one are indistinguishable to every
 * branch below. A second shape here would be a second set of branches, one of
 * which nobody drives.
 *
 * THE PRESENCE OF THE OBJECT IS THE STATUS. There is no `completed` flag to
 * write after the bytes, so there is no window in which a record says the answer
 * is ready and the answer is not — the ordering problem is removed rather than
 * solved.
 */
export function readGenReport(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.state === "done") return raw.answer && typeof raw.answer === "object" ? { state: "done", answer: raw.answer } : null;
  if (raw.state !== "failed") return null;
  return {
    state: "failed",
    status: Number.isFinite(raw.status) && raw.status > 0 ? Math.trunc(raw.status) : null,
    detail: typeof raw.detail === "string" ? raw.detail : "",
    message: typeof raw.message === "string" ? raw.message : "",
    kind: typeof raw.kind === "string" && raw.kind ? raw.kind : "Error",
  };
}

/**
 * WHAT THE FIRST INVOCATION LEAVES BEHIND.
 *
 * `gen` is where the answer will be: the container's own job id AND the lane it
 * was fired into. THE LANE IS NOT OPTIONAL — the answer lives in ONE container's
 * memory, and `laneName(slug)` is what resolves to that instance. A resume that
 * asked a different lane would get `unknown` from a container that never had the
 * work, which reads as "the generation was lost" on a build that is fine.
 *
 * `charged` is the list of steps already taken from the ledger. It is the
 * SEQUENTIAL half of exactly-once: a second look must not re-take the deposit or
 * re-settle the design call. The CONCURRENT half is the caller's claim on this
 * record, because a queue delivers at least once and two invocations reading the
 * same `charged: []` would both charge.
 *
 * `firedAt` is when the generation started, and the deadline is derived from it
 * rather than stored — a stored deadline is a second opinion about the same
 * fact, and the one that can be edited.
 *
 * `design` IS WHAT THE FIRST INVOCATION BOUGHT AND THE SECOND CANNOT RE-DERIVE.
 * The spec, the plan, the stylesheet, the brand — all of it came out of a model
 * call that has already been paid for, and between the two invocations this
 * record is the ONLY place it exists. Dropping it would mean the resume has the
 * generated pages and nothing to publish them as; re-asking for it would charge
 * a customer twice for one design.
 *
 * IT IS CARRIED OPAQUELY, deliberately. What is inside it is the route's own
 * schema and changes with the design tool; this module's job is the envelope,
 * the clock and the charges. A validator here would be a second opinion about a
 * shape that already has one, and the day they disagree the resume refuses a
 * design that is perfectly good.
 */
export function packResume({ id, auth, uid, slug, lane, genId, report, firedAt, charged, looks, refires, steps, design }) {
  return {
    v: RESUME_VERSION,
    kind: RESUME_KIND,
    id: String(id || ""),
    auth: String(auth || ""),
    uid: String(uid || ""),
    slug: String(slug || ""),
    lane: String(lane || ""),
    genId: String(genId || ""),
    // WHERE THE CONTAINER WAS TOLD TO PUT THE ANSWER, and therefore where to
    // look for it before asking that container anything. OPTIONAL: every record
    // written before this existed has none, and such a build must still resume —
    // it simply falls back to polling, which is what it did all along.
    report: isReportToken(report) ? report : "",
    firedAt: Number(firedAt) || 0,
    charged: normalizeCharged(charged),
    looks: Number.isFinite(looks) && looks > 0 ? Math.trunc(looks) : 0,
    // HOW MANY GENERATIONS THIS BUILD HAS ALREADY STARTED, over and above the
    // first. It is the ONLY thing bounding the re-fire, and each one is a real
    // provider call — so it is stored rather than derived, and it survives the
    // clock being reset (a re-fire IS a new generation, so `firedAt` and `looks`
    // both go back; if the count went with them nothing would ever stop).
    refires: Number.isFinite(refires) && refires > 0 ? Math.trunc(refires) : 0,
    // WHAT THIS BUILD HAD ALREADY RECORDED WHEN IT FIRED.
    //
    // `site_builds` is one row per SLUG and every invocation starts a fresh
    // recorder, so without this each resume REPLACES the build's history with
    // its own two or three marks. Measured on `northgroup-5`: the row for a
    // build that made a design call, provisioned, fired, refired and gave up
    // read `[{resume:stop}, {fonts}] total_ms 56`. The trace exists precisely so
    // a build nobody is watching can still say where it got to, and on the one
    // path where nobody IS watching it was erasing itself.
    //
    // BOUNDED AND NARROWED, because this is a record read back and re-written on
    // every look: a name and finite numbers only, oldest dropped past the cap.
    // OPTIONAL — a record written before this has none and resumes exactly as it
    // did, with a short trace rather than no build.
    steps: normalizeSteps(steps),
    design: design && typeof design === "object" && !Array.isArray(design) ? design : null,
  };
}

/** The same bar a live mark clears: a name, and numbers that are numbers. */
function normalizeSteps(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list.slice(-MAX_RESUME_STEPS)) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const name = typeof s.s === "string" ? s.s.slice(0, 40) : "";
    if (!name) continue;
    const step = { s: name };
    for (const [k, v] of Object.entries(s)) {
      if (k === "s") continue;
      if (typeof v === "number" && Number.isFinite(v)) step[k] = v;
    }
    out.push(step);
  }
  return out;
}

/** An unknown step name is DROPPED rather than kept. What a kept typo produces
 *  is a step nothing recognises, so the charge it was meant to suppress happens
 *  anyway — but it also means `charged` can never grow on junk somebody sent. */
function normalizeCharged(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) if (CHARGE_STEPS.includes(s) && !out.includes(s)) out.push(s);
  return out;
}

/**
 * Read one back, and REFUSE anything that is not what we wrote.
 *
 * THE REFUSAL IS THE SAFE DIRECTION HERE, unlike most tolerant readers in this
 * repo, and it is worth saying why: a record that half-parses hands a live
 * access token and a charge history to code that will act on both. A build that
 * cannot be resumed is a build that ends with the stand-in still up, which is
 * exactly what a build with no resume mechanism at all does.
 *
 * `genId`, `lane` AND `design` ARE ALL REQUIRED, and each is required for its
 * own reason. A record naming a job with no lane cannot find its own answer; a
 * lane with no job cannot ask for one; and a record with no design has nothing
 * to publish the generated pages AS. Any of the three alone is a record that
 * reads as resumable and is not — which is worse than one that refuses, because
 * it fails later and with a worse message.
 */
export function readResume(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== RESUME_VERSION) return null;
  if (raw.kind !== RESUME_KIND) return null;
  if (!isResumeId(raw.id)) return null;
  if (typeof raw.genId !== "string" || !raw.genId) return null;
  if (typeof raw.lane !== "string" || !raw.lane) return null;
  if (typeof raw.auth !== "string") return null;
  if (!Number.isFinite(raw.firedAt) || raw.firedAt <= 0) return null;
  if (!raw.design || typeof raw.design !== "object" || Array.isArray(raw.design)) return null;
  return {
    id: raw.id,
    auth: raw.auth,
    uid: typeof raw.uid === "string" ? raw.uid : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    lane: raw.lane,
    genId: raw.genId,
    // NOT REQUIRED, unlike `genId` and `lane`. A record with no report token is
    // one written before the answer was persisted at all, and it resumes exactly
    // as it always did — by polling. Refusing it would strand every build in
    // flight at the moment this shipped.
    report: isReportToken(raw.report) ? raw.report : "",
    firedAt: Math.trunc(raw.firedAt),
    charged: normalizeCharged(raw.charged),
    looks: Number.isFinite(raw.looks) && raw.looks > 0 ? Math.trunc(raw.looks) : 0,
    // ABSENT READS AS ZERO, which is the right answer for every record written
    // before this field existed: such a build has fired once and is owed its one
    // re-fire. Reading a missing count as "already spent" would refuse the
    // recovery to exactly the in-flight builds this shipped to rescue.
    refires: Number.isFinite(raw.refires) && raw.refires > 0 ? Math.trunc(raw.refires) : 0,
    // NARROWED AGAIN ON THE WAY OUT, not merely on the way in. These marks go
    // straight into a row, and a record written by an older version — or edited
    // by hand while somebody was debugging — has never been through the writer
    // above. One reading, both directions.
    steps: normalizeSteps(raw.steps),
    design: raw.design,
  };
}

/**
 * THE MESSAGE THAT BRINGS A BUILD BACK, and its OWN kind.
 *
 * `build-job.mjs`'s `readMessage` answers only `site-build`, and it refuses
 * anything else rather than guessing — which is right, and means a resume
 * message added without a matching branch in the consumer is DROPPED with a log
 * line and no build. So the consumer has to dispatch on kind, and the two kinds
 * have to be distinguishable: one starts a build from nothing, the other picks
 * one up mid-flight, and running the wrong one for the other is either a second
 * charge for a whole design or a resume of a build that was never fired.
 */
export function packResumeMessage(id) {
  if (!isResumeId(id)) throw new Error("build-resume: refusing to enqueue an id we did not mint");
  return { kind: RESUME_KIND, id };
}

export function readResumeMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.kind !== RESUME_KIND) return null;
  if (!isResumeId(body.id)) return null;
  return { id: body.id };
}

/**
 * WHAT THE CLAIM WRITES. One look more, and nothing else touched.
 *
 * Written back with `onlyIf: { etagMatches }`, so a `null` return means another
 * invocation got there first. It is deliberately the SMALLEST possible change:
 * the claim happens before any money moves, so anything else changed here would
 * be changed by an invocation that may be about to discover it has lost.
 */
export function nextLook(record) {
  const looks = (record && Number(record.looks)) || 0;
  return { ...record, looks: (Number.isFinite(looks) && looks > 0 ? Math.trunc(looks) : 0) + 1 };
}

/**
 * The delay, in the shape the queue takes, clamped to what the platform accepts.
 *
 * A whole number of seconds — `delaySeconds` is documented in seconds and a
 * fraction is a value nobody has tested — inside [0, 24 hours]. A value past
 * the ceiling is not a slower resume, it is a `send()` the platform REFUSES,
 * and the build stops there with no message and nobody coming back.
 */
export function queueDelay(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.trunc(n), MAX_DELAY_SECONDS);
}

/** Has this step already been taken from somebody's ledger? The one reader, so
 *  a call site cannot answer it a second way. */
export function alreadyCharged(record, step) {
  if (!record || !Array.isArray(record.charged)) return false;
  return record.charged.includes(step);
}

/**
 * Record a step as taken. Returns a NEW record rather than mutating, because
 * the caller writes the result back and a mutated object makes "what is stored"
 * and "what we think is stored" the same variable — which is how a failed write
 * comes to look like a successful one.
 *
 * A STEP NOT IN THE VOCABULARY IS REFUSED LOUDLY. Silently dropping it would
 * mean the caller believes a charge is recorded and the next look charges again,
 * which is the one bug this whole record exists to prevent.
 */
export function withCharged(record, step) {
  if (!CHARGE_STEPS.includes(step)) throw new Error(`build-resume: not a charge step: ${String(step)}`);
  const charged = normalizeCharged(record && record.charged);
  if (!charged.includes(step)) charged.push(step);
  return { ...record, charged };
}

/**
 * WHAT TO DO, GIVEN WHAT THE CONTAINER JUST SAID.
 *
 * Four answers, and collapsing any two is a real failure:
 *
 *   finish  the answer is in hand — publish, then charge for the pages
 *   wait    still running, look again in `delaySeconds`
 *   refire  the work is gone — start it again IN THE CONTAINER and keep waiting
 *   stop    give up on generation and publish what we have
 *
 * `poll` is the body of `GET /model/result`, passed in rather than fetched, so
 * every branch is drivable with a literal.
 *
 * THE ASYMMETRY THAT DECIDES `refire` VERSUS `stop` IS MONEY, and it is the same
 * question `retryHere` already answers on the synchronous path: a numeric
 * `status` is a provider's own answer, so the tokens are gone and repeating the
 * call spends them twice AND replaces a message the customer can act on with a
 * second identical failure. Everything else means no request was ever made.
 *
 * ── `here` IS GONE, AND ITS REMOVAL IS THE POINT ─────────────────────────────
 *
 * There used to be a fifth: make the call in the WORKER instead. It read as the
 * safe fallback and was the opposite. The Worker's side is the one with the
 * ceiling — `capMs(BUILDER_CALL_MS)`, ten minutes — and this brief measures
 * 333k-620k ms with two recent runs cut off past 600k. So "the container could
 * not do it, so we will" meant "retry the ten-minute job on the ten-minute
 * clock", and run 40 died in it after walking the rest of stage 2 perfectly.
 *
 * Deleting it also makes a rule structural rather than remembered: on the FIRED
 * path the Worker never calls the model. `runResumedSiteBuild` always supplies a
 * `resumeCall` now, so `publishPages` can no longer build its own caller there.
 */
export function resumeDecision({ poll, record, now }) {
  const looks = (record && Number(record.looks)) || 0;
  const firedAt = (record && Number(record.firedAt)) || 0;
  const elapsed = Number.isFinite(now) && firedAt > 0 ? now - firedAt : 0;
  const late = firedAt > 0 && elapsed > RESUME_DEADLINE_MS;
  const spent = looks >= RESUME_MAX_LOOKS;
  const refires = (record && Number(record.refires)) || 0;

  /** START IT AGAIN, OR ADMIT WE CANNOT — one place, because the bound is the
   *  only thing standing between "recover a lost generation" and "buy a
   *  generation every minute for ever". Both arms carry the ORIGINAL `why`, so a
   *  log can still say whether the work was lost or never left the container;
   *  collapsing them into one "gave up" loses the half that says where to look. */
  const again = (why, extra) => (refires >= RESUME_MAX_REFIRES
    ? { act: "stop", why: "refires", was: why, refires, ...extra }
    : { act: "refire", why, refires, ...extra });

  // AN UNREADABLE ANSWER IS NOT A FINISHED GENERATION. A container that
  // answered something we cannot parse has told us nothing about the work, so
  // this falls in with `pending` — bounded by the same clock, which is what
  // stops "we could not read it" becoming an infinite poll.
  const state = poll && typeof poll.state === "string" ? poll.state : "";

  if (state === "done") return { act: "finish", answer: poll.answer };

  if (state === "failed") {
    const message = typeof poll.message === "string" ? poll.message : "";
    // WHETHER TO REDO IT IS `retryHere`'S QUESTION, NOT A SECOND ONE. That
    // function already owns "was money spent" for the synchronous path, and it
    // is the same failure object arriving by a different route — so a copy here
    // is a MONEY RULE in two places, which is the shape this repo has paid for.
    //
    // The first draft did write that copy, and it was wrong in exactly the way
    // `isCallTimeout` exists to prevent: it matched the MESSAGE for "timeout",
    // and a message is the runtime's rather than ours. `retryHere` reads the
    // error's NAME, because one abort reaches workerd as `TimeoutError` and Node
    // as `AbortError` — and this decides whether somebody is billed twice.
    if (retryHere(poll)) return again("no-request", { message });
    // Not retryable, and WHY is worth keeping apart: a provider's own numeric
    // status is a refusal the customer can act on ("rate limited, try in a
    // minute"), where a timeout is nobody having answered at all. Collapsed,
    // an operator cannot tell them apart in a log.
    if (Number.isFinite(poll.status) && poll.status > 0) {
      return { act: "stop", why: "upstream", status: Math.trunc(poll.status), detail: typeof poll.detail === "string" ? poll.detail : "", message };
    }
    return { act: "stop", why: "timeout", message };
  }

  if (state === "unknown") {
    // THE CONTAINER HAS LOST THE WORK. Its own TTL is far longer than this
    // deadline, so inside the window `unknown` means the instance was recycled
    // rather than that the answer aged out — the generation is not running
    // anywhere and nobody is going to answer for it.
    //
    // STARTED AGAIN rather than stopped, and the reason is the same asymmetry:
    // a recycled container spent nothing we can observe, and the alternative is
    // a customer with no site over an instance Cloudflare reclaimed.
    return again("lost");
  }

  // Still running, or an answer we could not read.
  if (late) return { act: "stop", why: "deadline", elapsed };
  if (spent) return { act: "stop", why: "looks", looks };
  return { act: "wait", delaySeconds: looks === 0 ? RESUME_FIRST_SECONDS : RESUME_POLL_SECONDS, elapsed };
}

/**
 * HOW MANY LOOKS THE SCHEDULE SHOULD HAVE PRODUCED BY NOW.
 *
 * DERIVED FROM THE TWO CONSTANTS THAT DO THE SCHEDULING, never restated. The
 * whole value of this number is that it can be compared against the looks a
 * record has REALLY had, and a second hand-written copy of the cadence would
 * drift the first time either constant moved — at which point the comparison
 * starts reporting a healthy build as stalled, or a stalled one as healthy.
 *
 * THE FIRST INTERVAL IS COUNTED TWICE, and that is the schedule rather than an
 * off-by-one. The fire sends with `RESUME_FIRST_SECONDS`; the look that arrives
 * then sees `looks === 0` and `resumeDecision` gives it `RESUME_FIRST_SECONDS`
 * AGAIN — read off that expression rather than remembered, because it is the
 * one line that decides it. Every look after the second is `RESUME_POLL_SECONDS`.
 *
 * BOUNDED BY `RESUME_MAX_LOOKS`, or an abandoned record hours old reports a
 * number that says nothing: past the cap no further look is scheduled whatever
 * the clock says.
 */
export function looksDue(elapsedMs) {
  const e = Number(elapsedMs);
  if (!Number.isFinite(e) || e <= 0) return 0;
  const first = RESUME_FIRST_SECONDS * 1000;
  if (e < first) return 0;
  if (e < first * 2) return 1;
  const after = Math.floor((e - first * 2) / (RESUME_POLL_SECONDS * 1000));
  return Math.min(2 + after, RESUME_MAX_LOOKS);
}

/**
 * WHAT A BUILD THAT HAS BEEN FIRED AND HAS NOT ANSWERED CAN SAY ABOUT ITSELF.
 *
 * A fired build was UNOBSERVABLE between the fire and the publish, and run 40
 * is what that cost: the site serves the stand-in (which it also does while a
 * build is working perfectly), the trace goes quiet, and the only other reader
 * answers a bare `pending`. Every way it can go wrong — the message never
 * delivered, the container losing the work, a resume looping — produced exactly
 * the same three observations, so an hour of watching could not separate them.
 *
 * `looks` VERSUS `due` IS THE MEASUREMENT THAT SEPARATES THEM, and it is worth
 * saying which failure each shape names:
 *
 *   looks 0, due 0    too early to tell; the first look is minutes away.
 *   looks 0, due N>0  NO RESUME EVER RAN. The record is here, so the fire
 *                     stored it — what did not happen is the delivery of a
 *                     DELAYED message, which nothing before stage 2 exercised.
 *   looks ≈ due       the resume is running and the generation is still going.
 *   looks << due      looks are happening and losing their claim, or failing
 *                     to schedule the next one.
 *
 * IT CARRIES COUNTERS AND THE SLUG AND NOTHING ELSE. The record also holds the
 * caller's own access token and the whole design; neither has any business in a
 * response, and the way that stays true is that this function is the only thing
 * that ever shapes one — a route reaching into the record itself is one edit
 * from returning the token with it.
 */
export function flightOf(record, now) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const firedAt = Number(record.firedAt) || 0;
  const looks = Number.isFinite(record.looks) && record.looks > 0 ? Math.trunc(record.looks) : 0;
  const elapsedMs = Number.isFinite(now) && firedAt > 0 ? Math.max(0, Math.trunc(now - firedAt)) : 0;
  return {
    slug: typeof record.slug === "string" ? record.slug : "",
    firedAt,
    elapsedMs,
    looks,
    due: looksDue(elapsedMs),
  };
}
