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
  return { genId: r.genId, lane: r.lane, firedAt: Math.trunc(r.firedAt) };
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
export function packResume({ id, auth, uid, slug, lane, genId, firedAt, charged, looks, design }) {
  return {
    v: RESUME_VERSION,
    kind: RESUME_KIND,
    id: String(id || ""),
    auth: String(auth || ""),
    uid: String(uid || ""),
    slug: String(slug || ""),
    lane: String(lane || ""),
    genId: String(genId || ""),
    firedAt: Number(firedAt) || 0,
    charged: normalizeCharged(charged),
    looks: Number.isFinite(looks) && looks > 0 ? Math.trunc(looks) : 0,
    design: design && typeof design === "object" && !Array.isArray(design) ? design : null,
  };
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
    firedAt: Math.trunc(raw.firedAt),
    charged: normalizeCharged(raw.charged),
    looks: Number.isFinite(raw.looks) && raw.looks > 0 ? Math.trunc(raw.looks) : 0,
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
 * Five answers, and collapsing any two is a real failure:
 *
 *   finish  the answer is in hand — publish, then charge for the pages
 *   wait    still running, look again in `delaySeconds`
 *   here    make the call in the Worker instead; nothing was spent there
 *   stop    give up on generation and publish what we have
 *
 * `poll` is the body of `GET /model/result`, passed in rather than fetched, so
 * every branch is drivable with a literal.
 *
 * THE ASYMMETRY THAT DECIDES `here` VERSUS `stop` IS MONEY, and it is the same
 * question `retryHere` already answers on the synchronous path: a numeric
 * `status` is a provider's own answer, so the tokens are gone and repeating the
 * call spends them twice AND replaces a message the customer can act on with a
 * second identical failure. Everything else means no request was ever made.
 */
export function resumeDecision({ poll, record, now }) {
  const looks = (record && Number(record.looks)) || 0;
  const firedAt = (record && Number(record.firedAt)) || 0;
  const elapsed = Number.isFinite(now) && firedAt > 0 ? now - firedAt : 0;
  const late = firedAt > 0 && elapsed > RESUME_DEADLINE_MS;
  const spent = looks >= RESUME_MAX_LOOKS;

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
    if (retryHere(poll)) return { act: "here", why: "no-request", message };
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
    // Retried here rather than stopped, and the reason is the same asymmetry:
    // a recycled container spent nothing we can observe, and the alternative is
    // a customer with no site over an instance Cloudflare reclaimed.
    return { act: "here", why: "lost" };
  }

  // Still running, or an answer we could not read.
  if (late) return { act: "stop", why: "deadline", elapsed };
  if (spent) return { act: "stop", why: "looks", looks };
  return { act: "wait", delaySeconds: looks === 0 ? RESUME_FIRST_SECONDS : RESUME_POLL_SECONDS, elapsed };
}
