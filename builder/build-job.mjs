// THE BUILD IS A JOB, NOT A HELD SOCKET.
//
// WHAT THIS IS FOR. A build takes six to twelve minutes and ran inside the
// request that asked for it. `ctx.waitUntil` was believed to keep it alive past
// a disconnect and does not: Cloudflare's own documentation is explicit that
// waitUntil "can extend execution for up to 30 seconds after the response is
// sent or the client disconnects" and that "if any Promises have not settled
// after 30 seconds, they are canceled". Thirty seconds against a twelve-minute
// build. The builds that survived a reset did so because the disconnect was at
// a hop Cloudflare did not observe — run 14 ran 300 seconds past its own reset
// and arm A 332, both impossible under a 30-second rule. That is luck, and it
// fails hardest on the ordinary case of somebody closing the tab.
//
// A queue consumer is a non-HTTP invocation, which Cloudflare guarantees 15
// minutes of runtime that does not depend on anybody still being connected. So
// the request hands the build to the queue and then WAITS for the answer: the
// customer's experience is unchanged, and a dropped connection now costs the
// ANSWER and never the SITE.
//
// WHY THE BODY GOES TO R2 AND THE MESSAGE CARRIES AN ID. A queue message is
// capped at 128KB and a build body reaches 24MB with attachments — three images
// and a PDF. The message is therefore the smallest thing that can name the
// work, and everything else is an object.
//
// WHY THIS IS A MODULE. Every decision here is one the producer and the consumer
// have to agree on exactly — the key, the envelope, what counts as a readable
// message — and two copies of an agreement is how one side starts writing where
// the other is not looking. It has no R2, no queue and no request, so all of it
// is driven in the unit suite.
//
// NOTHING HERE PERFORMS I/O, and that is asserted rather than merely intended:
// the caller does every read and write, so a mistake in this file cannot be a
// mistake about a bucket.

// The one prefix. Under `jobs/`, which nothing serves — `sites/<slug>/` is the
// public prefix and `source/`, `backups/`, `versions/` and `orphans/` are the
// private ones this joins. A job carries the caller's own access token, so it
// being unreachable from the outside is the whole reason it may hold one.
import { JOB_MAX_MS } from "./job-duration.mjs";

export const JOB_PREFIX = "jobs/";

// The message's own kind. The consumer refuses anything else rather than
// guessing, because a message it cannot read is a producer somebody added
// without the consumer to match — and running a build against a shape nobody
// designed is the one recovery worse than none.
export const JOB_KIND = "site-build";

// The envelope's version. Bumped when the shape changes; a job written by an
// older deploy and picked up by a newer one is REFUSED rather than reinterpreted,
// because the fields that would be misread are the auth token and the body.
export const JOB_VERSION = 1;

// A BUILD'S OUTER BOUND INSIDE THE SITE'S CONTAINER (stage 5b, 2026-09-06;
// re-framed and raised 2026-09-14, owner: "Containers shouldn't have a time
// limit"). The launch's deadline and the token's expiry are minted from it.
//
// IT IS NOT A WORK BUDGET ANY MORE. `CONTAINER_BUILD_BUDGET_MS` is `Infinity`
// now — the work is bounded by its own per-step ceilings and by nothing else —
// so this number does exactly two jobs, neither of them "how long a build may
// take":
//
//   1. THE TOKEN'S LIFETIME. The launch carries a signed credential that opens
//      the platform gateway for this job. One with no expiry is a permanent
//      credential left in a container.
//   2. A WEDGE-BREAKER for a child that is alive and never finishing — our own
//      bug, since every step it could be in is separately bounded. The lease
//      covers the commoner case and covers it better: `edit_sweep_lost` reads
//      `lease_expires_at`, not elapsed, so a dead job is reclaimed in ~90s and
//      a beating one is never swept.
//
// FIFTY MINUTES, matching CONTAINER_EDIT_JOB_MS, whose comment carries the
// trade in full — including why it is not larger: `HANDOFF_TTL_S` derives from
// `MAX_BUSY_HOLD_MS` and `edit_handoff` refuses a TTL past 3600 s, so the whole
// chain caps this at 57.5 minutes and lifting it needs a migration. `MAX_BUSY_HOLD_MS` must stay ABOVE it plus both kill graces, or the
// container is stopped before the terminator's SIGTERM can reach the child and
// the graceful stop is unreachable — which is what the two being EQUAL at
// thirty minutes quietly meant until today.
export const BUILD_JOB_MS = JOB_MAX_MS;

// A job id is 32 hex characters — 128 bits from `crypto.getRandomValues`. It is
// unguessable on purpose: whoever holds it names an R2 key holding a live access
// token. Nothing outside the Worker can read that bucket, so this is depth
// rather than the boundary, and it costs nothing.
const ID_RE = /^[0-9a-f]{32}$/;

export function isJobId(id) {
  return typeof id === "string" && ID_RE.test(id);
}

/**
 * The job's own object, and the result's. TWO KEYS RATHER THAN ONE, because the
 * producer polls for the result and must never see a half-written job as an
 * answer — R2 has no partial reads, but "the object exists" is the whole test
 * and an object that exists for a different reason would pass it.
 *
 * BOTH DERIVE FROM ONE `jobId` CHECK. A key built from an unvalidated id is a
 * path an attacker chooses, and `..` in an R2 key is a literal rather than a
 * traversal — but the id also reaches a log line and a response, so refusing
 * anything that is not the shape we mint is the cheaper rule to keep.
 */
export function jobKey(id) {
  if (!isJobId(id)) throw new Error("build-job: refusing to build a key from an id we did not mint");
  return `${JOB_PREFIX}${id}.json`;
}

/**
 * WHAT RECOVERY NEEDS TO KNOW ABOUT A JOB, KEPT APART FROM THE JOB ITSELF
 * (2026-10-08, Codex's review of `41731e86`). The envelope (`jobKey`) holds
 * the customer's session and is deleted the moment the consumer reads it —
 * so a flag inside it (`fenced`) is gone by the time a lost build is
 * recovered. This record holds no credential: only which protocol the job
 * was filed under. It is written once, create-only, when the envelope is
 * written and again (if absent) at the consumer before the envelope goes;
 * never overwritten. Absent means "not known" — an older job, or a write
 * that failed — and recovery treats that as unknown, never as fenced.
 */
export const JOB_META_VERSION = 1;
export function jobMetaKey(id) {
  if (!isJobId(id)) throw new Error("build-job: refusing to build a key from an id we did not mint");
  return `${JOB_PREFIX}${id}.meta.json`;
}
export function packJobMeta({ fenced } = {}) {
  return { v: JOB_META_VERSION, fenced: fenced === true };
}
/** `{ fenced }` from a stored record, or null for anything that is not one. */
export function readJobMeta(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== JOB_META_VERSION || typeof raw.fenced !== "boolean") return null;
  return { fenced: raw.fenced };
}

/**
 * WHAT A QUEUED BUILD READ, KEPT FOR WHOEVER FINISHES IT (2026-10-08, the
 * sixth batch): the structured context facts (`contextFacts`) — which links
 * were used, partly used, unread or never opened, and whether research found
 * anything. Written by the build before its generation is handed to the
 * container, read by the resume, a refire and recovery, none of which can
 * see the linked pages again. No credential, no page text.
 */
export function contextKey(id) {
  if (!isJobId(id)) throw new Error("build-job: refusing to build a key from an id we did not mint");
  return `${JOB_PREFIX}${id}.context.json`;
}

export function resultKey(id) {
  if (!isJobId(id)) throw new Error("build-job: refusing to build a key from an id we did not mint");
  return `${JOB_PREFIX}${id}.result.json`;
}

/**
 * Mint an id. Randomness is INJECTED rather than reached for, so the module
 * stays pure and the test can prove the shape without hoping the platform's
 * generator is available.
 */
export function newJobId(fill) {
  const bytes = new Uint8Array(16);
  fill(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * WHAT THE PRODUCER STORES. The URL and the body are what rebuild the request;
 * `auth` is what the four ledger calls inside the build need, and `uid` is
 * recorded so an operator reading a stranded job knows whose it was without
 * decoding a token.
 *
 * THE TOKEN IS THE CALLER'S OWN AND IT IS SHORT-LIVED BY CONSTRUCTION. A
 * Supabase access token expires in an hour and a build takes minutes; the object
 * is deleted the moment the result is written. It is stored because the
 * alternatives are worse: `use_credits` reads `auth.uid()`, so a service key
 * cannot charge a user at all, and minting a fresh token in the consumer means a
 * GoTrue admin call plus an email lookup on the one path that has to be
 * reliable — new failure modes bought in exchange for not keeping something we
 * were already sent.
 */
// `fenced` (2026-10-08, Codex's review of `b4300a07`): every job written by
// this code claims the build fence before it activates, so recovery that wins
// the fence knows such a job never published. A job without it was filed by
// older code that published unfenced, and recovery stays careful with it.
export function packJob({ url, auth, body, uid, at }) {
  return { v: JOB_VERSION, url: String(url || ""), auth: String(auth || ""), body: String(body || ""), uid: String(uid || ""), at: Number(at) || 0, fenced: true };
}

/**
 * Read one back, and REFUSE anything that is not what we wrote. Four things can
 * put a wrong shape here and each is worth failing on rather than working
 * around: a version bump, a truncated write, a key collision, and a hand-edited
 * object. What a wrong shape produces if it is tolerated is a build charged to
 * whatever `auth` happened to parse as.
 */
export function readJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== JOB_VERSION) return null;
  if (typeof raw.url !== "string" || !raw.url) return null;
  if (typeof raw.body !== "string" || !raw.body) return null;
  if (typeof raw.auth !== "string") return null;
  return { url: raw.url, auth: raw.auth, body: raw.body, uid: typeof raw.uid === "string" ? raw.uid : "", at: Number(raw.at) || 0, fenced: raw.fenced === true };
}

/**
 * A `Response` CANNOT CROSS R2, so the consumer flattens one and the producer
 * rebuilds it. Status, content type and body — nothing else, because nothing
 * else on this route carries meaning and copying headers wholesale would move
 * `content-length` onto a body that has been through JSON.
 *
 * `ok` IS NOT A FIELD HERE. The build's own answers already carry one and it
 * means something different; a second one at the transport layer is two things
 * that can disagree about whether a build worked.
 */
export function packResult({ status, type, body, uid }) {
  return {
    v: JOB_VERSION,
    status: Number.isFinite(status) ? Math.trunc(status) : 500,
    type: typeof type === "string" && type ? type : "application/json",
    body: typeof body === "string" ? body : "",
    // WHOSE ANSWER THIS IS, so it can be asked for LATER by somebody other than
    // the request that started it. A build that fires its generation answers
    // 202 in seconds and its real outcome lands here minutes afterwards, with
    // the original request long gone — and without an owner on the object there
    // is nothing to authorise a second reader against. Optional, because the
    // waiting caller is already authorised by having started the build.
    uid: typeof uid === "string" && uid ? uid : "",
  };
}

/**
 * And back. A result that cannot be read is NOT an error the customer sees as a
 * broken build — the caller decides that — but it is never guessed at either,
 * because the one thing worse than no answer is somebody else's answer.
 */
export function readResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== JOB_VERSION) return null;
  if (!Number.isFinite(raw.status) || raw.status < 100 || raw.status > 599) return null;
  if (typeof raw.body !== "string") return null;
  return {
    status: Math.trunc(raw.status),
    type: typeof raw.type === "string" && raw.type ? raw.type : "application/json",
    body: raw.body,
    // ABSENT IS THE EMPTY STRING, NEVER A MATCH. Every result written before
    // this field existed has no owner, and a reader comparing it against a real
    // uid must fail rather than pass — so the empty string is what a caller can
    // never present, and the one place that compares refuses it explicitly.
    uid: typeof raw.uid === "string" ? raw.uid : "",
  };
}

/**
 * WHAT KIND OF ANSWER A STORED RESULT IS (2026-10-08, Codex's review of
 * `deb1fee5`: a stored "still building" 202 was taken for a final answer and
 * recovery's outcome was never delivered). Exactly one of:
 *
 *   "interim"     the build is still going (`stage: "resuming"`, the 202 a
 *                 fired build answers) and says nothing of how it ends; never delivery of an
 *                 outcome, and never kept over one
 *   "recovery"    recovery's own answer (`lost: true`)
 *   "terminal"    the build's own final answer — authoritative
 *   "unreadable"  not a result we can read; it proves no outcome
 *
 * Takes the stored object as parsed JSON (`packResult`'s shape).
 */
export function resultKind(raw) {
  const r = readResult(raw);
  if (!r) return "unreadable";
  let body = null;
  try { body = JSON.parse(r.body); } catch { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return "unreadable";
  if (body.lost === true) return "recovery";
  // THE SAME TEST AS THE ROW'S OWN (`buildOutcome`'s "resuming"), widened to
  // any status: a fired build's answer is `stage: "resuming"`; a 202 without
  // it is an answered build there, and is here.
  if (body.stage === "resuming") return "interim";
  return "terminal";
}

/**
 * THE SETTLEMENT FACTS A LOST BUILD'S RECOVERY RECORDED, as they ride on an
 * answer (2026-10-08, Codex's review of `366dc581`). From the settlement
 * record (`jobs/<id>.lost.json`) alone: the outcome recovery decided from the
 * fence and the pointer, why, what came back, and whether the return is
 * still short. Null when there is no decided settlement to carry.
 */
export function settlementFacts(mark) {
  const m = mark && typeof mark === "object" && !Array.isArray(mark) ? mark : null;
  if (!m || (m.outcome !== "published" && m.outcome !== "not-published")) return null;
  return {
    recovered: true,
    outcome: m.outcome,
    why: typeof m.why === "string" ? m.why : "",
    refunded: Math.max(0, Number(m.returned) || 0),
    short: m.short === true,
  };
}

const sameFacts = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

/**
 * THE SETTLEMENT FACTS AN ANSWER ALREADY CARRIES (2026-10-08, the seventh
 * batch: Codex failed the settlement record's read during the resume's
 * retry, and the final answer, told "no settlement", erased a recorded
 * refund of 6). When the record cannot be read, what the slot already holds
 * is still known: a terminal answer's `settlement`, or recovery's answer's
 * `settlement` / `buildFacts.settlement` — or, on a recovery answer from
 * before either existed, its own `recovered` / `refunded` / `refundShort`.
 * Null when the answer carries none of them. Never a guess: an answer that
 * says nothing about money yields nothing.
 */
export function knownSettlement(stored) {
  const r = readResult(stored);
  if (!r) return null;
  let body;
  try { body = JSON.parse(r.body); } catch { return null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const ok = (f) => f && typeof f === "object" && !Array.isArray(f) && (f.outcome === "published" || f.outcome === "not-published");
  const tidy = (f) => ({ recovered: true, outcome: f.outcome, why: typeof f.why === "string" ? f.why : "", refunded: Math.max(0, Number(f.refunded) || 0), short: f.short === true });
  if (ok(body.settlement)) return tidy(body.settlement);
  if (body.buildFacts && ok(body.buildFacts.settlement)) return tidy(body.buildFacts.settlement);
  if (body.lost === true) {
    if (body.recovered === true) return { recovered: true, outcome: "published", why: "", refunded: 0, short: false };
    if (Number.isFinite(Number(body.refunded))) return { recovered: true, outcome: "not-published", why: "", refunded: Math.max(0, Number(body.refunded) || 0), short: body.refundShort === true };
  }
  return null;
}

/**
 * A stored answer with the settlement facts on it: the body keeps every field
 * the writer gave it, and gains `settlement` (and, for a build that did not
 * publish, the `refunded` / `refundShort` the chat already reads). The facts
 * never replace what the answer says about publication — the build's own
 * terminal answer is authoritative for that; recovery's record is
 * authoritative for the money.
 */
export function withSettlement(stored, facts) {
  const r = readResult(stored);
  if (!r || !facts) return stored;
  let body;
  try { body = JSON.parse(r.body); } catch { return stored; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return stored;
  const next = { ...body, settlement: facts };
  if (facts.outcome === "not-published") {
    next.refunded = facts.refunded;
    if (facts.short) next.refundShort = true; else delete next.refundShort;
  }
  return { ...stored, body: JSON.stringify(next) };
}

/**
 * WHICH FACTS AN EXPLANATION EXPLAINS (2026-10-08, the eighth batch: Codex
 * kept a pages refund unavailable across two real recovery passes, both
 * recorded the same return of 4 and `short`, and the second pass dropped the
 * saved narration and paid the reply model again for an identical request).
 * A short, stable fingerprint of a build's facts (keys sorted, so the same
 * facts always give the same key): an explanation is reused only for the
 * facts it was written for, and a genuinely changed amount or outcome gets a
 * new one. Null when there are no facts.
 */
export function narrationKey(facts) {
  if (!facts || typeof facts !== "object") return null;
  const stable = (v) => (Array.isArray(v) ? "[" + v.map(stable).join(",") + "]"
    : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"
      : JSON.stringify(v === undefined ? null : v));
  const text = stable(facts);
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/**
 * WHAT RECOVERY MAY DO ABOUT AN EXPLANATION, given the one kept on the
 * settlement record (`narration`) and the key of the facts it would now
 * explain. One retry contract for every pass, overlapping or not:
 *   reuse  the kept explanation is for these facts and finished — its text,
 *          or that the writer could not answer — so it is delivered again
 *   hold   an attempt for these facts was claimed and its outcome is not
 *          known (a pass still running, or one whose result could not be
 *          saved): never paid for again; the facts go out on their own
 *   call   no finished or claimed attempt for these facts (none at all, one
 *          for different facts, or one never attempted because the switch was
 *          off): the writer may be asked, after the attempt is claimed
 * `factsUnread` (the kept context could not be read this pass): the facts
 * cannot be fingerprinted, so nothing new is asked — a finished explanation
 * of the same settlement is reused, anything else is held.
 */
export function narrationPlan(n, key, { settlementKey = null, factsUnread = false } = {}) {
  const kept = n && typeof n === "object" && !Array.isArray(n) ? n : null;
  const finished = (x) => x && (x.state === "written" || x.state === "unavailable");
  if (factsUnread) {
    if (kept && finished(kept) && settlementKey && kept.settlementKey === settlementKey) return { act: "reuse", narration: kept };
    return { act: "hold", why: "facts-unread" };
  }
  if (!key) return { act: "none" };
  if (kept && kept.key === key) {
    if (finished(kept)) return { act: "reuse", narration: kept };
    if (kept.state === "attempting") return { act: "hold", why: "attempt-uncertain" };
  }
  return { act: "call" };
}

/**
 * OF TWO EXPLANATION RECORDS, THE ONE TO KEEP when two writers of the
 * settlement record meet: the later attempt (`at`), and at the same moment a
 * finished one over a claim. A record with no explanation keeps the other's.
 */
export function newerNarration(a, b) {
  const ok = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (!ok(a)) return ok(b) ? b : null;
  if (!ok(b)) return a;
  const ta = Date.parse(a.at || "") || 0, tb = Date.parse(b.at || "") || 0;
  if (ta !== tb) return ta > tb ? a : b;
  const done = (x) => x.state === "written" || x.state === "unavailable";
  return done(b) && !done(a) ? b : a;
}

/**
 * ONE DELIVERY RULE FOR EVERY WRITER OF A BUILD'S ANSWER SLOT (2026-10-08,
 * Codex's review of `366dc581`: the resume's unconditional final write
 * replaced recovery's answer and its refund, in the ordering the previous
 * batch did not cover). Given what is in the slot now, what this writer
 * brings, its role, and the settlement facts recovery has recorded (or
 * null), answers what the slot should hold next — or null to leave it:
 *
 *   interim   a "still building" answer: only into an empty slot or over
 *             another interim one; never over an outcome
 *   final     the build's own terminal answer: it is the authority on what
 *             was published, so it replaces anything — carrying the recorded
 *             settlement facts, so the refund survives whichever wrote first
 *   recovery  recovery's answer: over anything but a terminal one; a terminal
 *             answer is kept and only gains the settlement facts it lacks
 *
 * Pure, so every writer applies the same decision; each writer then puts the
 * result conditionally on what it read, and a refused put reads and decides
 * again. In either order the slot ends as: the build's terminal answer with
 * recovery's settlement facts, or recovery's answer when no terminal one
 * ever came.
 */
export function nextResult(cur, incoming, role, facts = null) {
  const kind = cur ? resultKind(cur) : "nothing";
  if (role === "interim") {
    if (kind !== "nothing" && kind !== "interim") return { next: null, as: "kept" };
    return { next: incoming, as: "interim" };
  }
  if (role === "final") {
    return { next: facts ? withSettlement(incoming, facts) : incoming, as: "build" };
  }
  if (role === "recovery") {
    if (kind === "terminal") {
      if (!facts) return { next: null, as: "build" };
      let have = null;
      try { have = JSON.parse(readResult(cur).body).settlement || null; } catch { have = null; }
      return { next: sameFacts(have, facts) ? null : withSettlement(cur, facts), as: "build" };
    }
    if (kind === "recovery" && cur && sameFacts(cur, incoming)) return { next: null, as: "recovery" };
    return { next: incoming, as: "recovery" };
  }
  // REPAIR (2026-10-08, the seventh batch): recovery revisiting a settled,
  // delivered build whose answer may have been written while the settlement
  // record could not be read. It brings no answer of its own: a terminal
  // answer lacking the recorded facts gains them; anything else — an empty
  // (collected) slot, recovery's own answer, an interim or unreadable one —
  // is left exactly as it is. It never refunds and never reruns anything.
  if (role === "repair") {
    if (kind !== "terminal" || !facts) return { next: null, as: kind === "terminal" ? "build" : kind };
    let have = null;
    try { have = JSON.parse(readResult(cur).body).settlement || null; } catch { have = null; }
    return { next: sameFacts(have, facts) ? null : withSettlement(cur, facts), as: "build" };
  }
  throw new Error("nextResult: unknown role " + String(role));
}

/**
 * WHAT THE CONSUMER WILL ACT ON. Everything else is acknowledged and logged —
 * see the handler — so this only has to say yes to the shape we produce.
 */
export function readMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.kind !== JOB_KIND) return null;
  if (!isJobId(body.id)) return null;
  const tries = readTries(body);
  const out = tries === undefined ? { id: body.id } : { id: body.id, tries };
  // A RETRY'S OWN ATTEMPT (2026-10-10, round 5): the execution record's token
  // and the lease the attempt held, so the retry adopts that attempt and takes
  // its lease over by name. Anything not shaped like one is dropped.
  const name = /^[A-Za-z0-9:._-]{8,96}$/;
  if (typeof body.token === "string" && name.test(body.token)) out.token = body.token;
  if (typeof body.holder === "string" && name.test(body.holder)) out.holder = body.holder;
  // HOW MANY TIMES IT HAS WAITED ON THE EXECUTION RECORD: a small whole number.
  if (Number.isInteger(body.waits) && body.waits > 0 && body.waits <= 99) out.waits = body.waits;
  return out;
}

/**
 * HOW MANY TIMES A MESSAGE HAS BEEN SENT AGAIN BECAUSE ITS CLAIM COULD NOT BE
 * READ (stage 3a, 2026-09-05). A consumer that cannot ask the deploy gate —
 * the claim RPC failed in transport, was refused, or answered no shape — cannot
 * tell whether a deploy is rolling under it, so it sends its own message again
 * once, carrying this; the second delivery proceeds as the consumer always
 * did. ONE READER for the three message kinds, so the edit, the build and the
 * resume cannot read the count three ways. A small whole number or nothing: a
 * message from before this existed, or one carrying junk, reads as a first
 * delivery. The BOUND lives in the consumer (`CLAIM_RETRY_MAX`), never here.
 */
export function readTries(body) {
  const t = body && body.tries;
  return Number.isInteger(t) && t >= 0 && t <= 9 ? t : undefined;
}

/**
 * REBUILD THE REQUEST THE BUILD RUNS AGAINST. Used by BOTH sides — the consumer
 * has no request at all, and the producer has already read the body off its own,
 * which can only be read once. One expression, so the request the queue path
 * presents and the request the fall-through presents cannot differ.
 *
 * TWO HEADERS AND NOTHING ELSE, and that is measured rather than trimmed by
 * instinct. Scope-analysed with comments blanked, the build touches `request`
 * exactly three times: `authUser`, `readJsonBody` and `useQuota` — and all three
 * read only the Authorization header and the body. Copying the rest would carry
 * a stale `content-length` onto a body that has been through JSON.parse and
 * back, which `readJsonBody` checks first.
 */
export function replayRequest({ url, auth, body }) {
  const headers = { "content-type": "application/json" };
  if (auth) headers.authorization = auth;
  return new Request(url, { method: "POST", headers, body });
}

/**
 * HOW OFTEN THE PRODUCER LOOKS. Fast at first and then slower, because the two
 * kinds of answer are minutes apart: a refusal — unauthenticated, no credit, a
 * name already taken — comes back in about a second, and a real build in six to
 * twelve minutes. One interval serves neither; a flat 3s makes every refusal
 * feel broken, and a flat 500ms is 1,400 reads on a real build.
 *
 * Bounded at the top, so a queue that never delivers costs a read every few
 * seconds rather than a spin. The WAIT is what this bounds — the build is the
 * consumer's and outlives it either way, which is the entire point.
 */
export function pollDelayMs(attempt) {
  const n = Number(attempt) || 0;
  if (n < 6) return 500;
  if (n < 16) return 1500;
  return 3000;
}
