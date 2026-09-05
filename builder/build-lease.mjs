// THE BUILD'S ROW, AND THE LEASE THAT MOVES ALONG ITS CHAIN (stage 2c, 2026-09-05).
//
// WHAT THIS IS FOR. A build had an R2 record with an etag claim and charge
// marks (`build-resume.mjs`) and nothing else: no row, no lease, no heartbeat,
// no sweep. A consumer evicted mid-design (run 17's shape, nine minutes after
// a deploy) or a resume chain the queue stopped delivering (run 41 lost two
// generations on a rollout) left the customer with the stand-in page and a
// browser polling `pending` until its own twenty-minute bound. Nothing could
// say the build was gone, because nothing held it.
//
// Now a build files a row in `edit_jobs` — op `build`, billed `external` —
// and ONE lease travels with the work: the consumer claims and beats through
// the design; at fire time it HANDS the lease to the container that generates
// (`container:<genId>`, for the generation bound); the container beats while
// it works and its report RELEASES the lease (a short expiry, the owner
// kept); the collector claims the released lease, or takes it over from the
// container BY NAME when the report never landed; and the sweep marks a
// chain nobody renews `lost` with nothing moved, exactly as it marks an edit.
// The browser's poll then reads `lost` off the row instead of polling.
//
// THE ROW IS AN INSTRUMENT, NEVER THE AUTHORITY. Every money and site
// decision on the build path stays with the R2 record (`alreadyCharged`, the
// etag claim): a look that cannot claim the row still does its work, a row
// that reads `lost` does not stop a resume that is alive, and a build that
// cannot file a row builds exactly as it did before this existed. What the
// row buys is a verdict for the customer and an operator, and a sweep that
// closes a chain nobody will ever come back to.
//
// WHY `external`. The build's money moves through its own ledger —
// `credit_debit` under `build:<jobId>` refs since stage 1c — never through a
// reserve on this row, so `edit_refund` and `edit_reconcile` must never move
// it. `none` behaves identically inside every RPC today; the word says why the
// row's `cost` is zero on a build that cost forty credits, which `none` reads
// as "free". `edit_create` decides it from the op, so no caller can file a
// build under a reserve by mistake.
//
// NOTHING HERE PERFORMS I/O. The Worker does every RPC and every read; what
// is here is the vocabulary both ends of the chain have to agree on, and the
// verdict the poll route derives from a row — all of it driven with literals.

import { MAX_BUSY_HOLD_MS } from "./container-hold.mjs";

/** The op a build's row is filed under. Part of the idempotency key, so a build
 *  and an edit on one site can never be one row however their keys fall. */
export const BUILD_OP = "build";

/** The billing a build row carries: money that moved outside this row. */
export const BUILD_BILLING = "external";

/** The state while the container holds the lease. Admitted by the CHECK
 *  constraint since the stage-2c migration; `edit_handoff` sets it by name. */
export const GENERATING = "generating";

/**
 * HOW LONG THE CONTAINER MAY HOLD THE LEASE: the generation bound, as the plan
 * says. `MAX_BUSY_HOLD_MS` is the container's own ceiling on a busy hold —
 * thirty minutes — so a container that never beats (an older image, a network
 * that refuses) still expires, and expires after any honest generation has
 * either reported or been cut by `BUILDER_CALL_MS`. DERIVED, never restated:
 * a second copy of that number drifts the day the first moves.
 */
export const HANDOFF_TTL_S = Math.round(MAX_BUSY_HOLD_MS / 1000);

/**
 * HOW LONG A RELEASED LEASE STANDS. The container's report landed and it no
 * longer holds the work; what is expected next is a resume look, which comes
 * every `RESUME_POLL_SECONDS` (60 s). Five minutes is five missed looks —
 * enough that a slow queue cannot turn a finishing build into a `lost` one,
 * short enough that a collector that never comes is said so within the
 * customer's patience. NOT "now": a release to now followed by the sweep's
 * two-minute tick would mark a build lost sixty seconds before its collector
 * claimed it, and the collector would then publish a site the customer had
 * just been told was gone.
 */
export const RELEASE_TTL_S = 300;

/**
 * THE CONTAINER'S OWN RENEWAL. `edit_beat` caps a TTL at 600 s; a beat every
 * `GEN_BEAT_MS` keeps the lease ten minutes ahead, so a container that dies is
 * `lost` within ten minutes plus the sweep's grace rather than thirty. The
 * first beat SHORTENS the handoff's thirty minutes to ten — deliberately: a
 * container that has proved it can beat is one whose silence means something.
 */
export const CONTAINER_BEAT_TTL_S = 600;

/** How often the container beats while it generates. The Worker tells the
 *  container at fire time; the container never chooses its own cadence. */
export const GEN_BEAT_MS = 60_000;

/** The floor under a cadence the Worker asks for. The container harness asks
 *  for five seconds so a beat can be seen inside a short fake generation;
 *  anything under this is a way to hammer the Worker and is refused there. */
export const MIN_GEN_BEAT_MS = 5_000;

const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const JOB_RE = /^[0-9a-f]{32}$/;

/**
 * The lease owner a container holds the row under. `container:<genId>` —
 * the container's own job id, which it mints and knows, so the beat and the
 * release can name the holder without being told anything else. Validated
 * because the owner reaches an RPC's `where lease_owner = p_owner`, and an
 * empty or oversized name is a stranger's, never ours.
 */
export function containerOwner(genId) {
  if (typeof genId !== "string" || !genId || genId.length > 80) throw new Error("build-lease: not a generation id");
  return "container:" + genId;
}

/**
 * THE SLUG A BUILD ROW IS FILED UNDER. A revise names its site, so the row
 * carries it and `edit_create`'s review wall applies as it does to an edit. A
 * FIRST build lets the designer invent the name minutes later, so the row is
 * filed under a placeholder that can never be a site — `build:<jobId>` — and
 * the handoff at fire time, which knows the slug, sets the real one.
 *
 * NEVER THE EMPTY STRING. `edit_create` refuses a slug with a row in review,
 * matched by equality; a build row parked under `''` would refuse every first
 * build on the platform, for ever, by matching them all. The placeholder is
 * unique per job, so it can match nothing but itself.
 */
export function buildRowSlug(named, jobId) {
  const s = cleanBuildSlug(named);
  if (s) return s;
  if (typeof jobId !== "string" || !JOB_RE.test(jobId)) throw new Error("build-lease: refusing to name a row for an id we did not mint");
  return "build:" + jobId;
}

/**
 * THE BUILD ROUTE'S OWN SLUG CLEANER, character for character (`cleanSlug`,
 * a local of `runSiteBuild`): lower-cased, anything but a-z 0-9 and dashes
 * dropped, sixty at most, dashes trimmed at both ends. The row is filed
 * before that function runs, so the route cannot hand its own cleaner over;
 * a guard holds the two expressions equal instead. Empty when nothing
 * survives, which is what a first build's body says.
 */
export function cleanBuildSlug(v) {
  return (typeof v === "string" ? v : "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60).replace(/^-+|-+$/g, "");
}

/** Is this a site's slug, rather than the placeholder a first build is filed under? */
export function isRowSlug(s) {
  return typeof s === "string" && SLUG_RE.test(s);
}

/**
 * WHAT A BUILD'S ANSWER MEANS FOR ITS ROW. Three outcomes, and collapsing any
 * two is a wrong terminal state:
 *
 *   resuming  the generation is running in the container; the lease has been
 *             handed on and this invocation touches the row no further
 *   done      the build answered — a site, a placeholder, a refusal the
 *             customer can read. The job is over and its answer is in R2
 *   failed    the build threw or refused with an error status; the row says
 *             so in case the answer object is never written or is collected
 *             before a second reader asks
 *
 * A REFUSAL IS `failed`, NOT `done`: 402, 409, 501 are builds that made no
 * site, and a second reader of the row must not be told one finished.
 */
export function buildOutcome(status, body) {
  const st = Number(status);
  if (st === 202 && body && typeof body === "object" && body.stage === "resuming") return "resuming";
  if (Number.isFinite(st) && st < 400 && !(body && typeof body === "object" && body.ok === false)) return "done";
  return "failed";
}

// THE SENTENCES THE CUSTOMER READS OFF A ROW. Composed here, once, so the poll
// route and its guard read the same words — the reply the sweep writes for an
// edit is composed the same way (`outcomeMessage("recovered")`).
export const LOST_SITE_MSG = "That build stopped part-way and we lost track of it on our side. There's a stand-in page at your address; send your brief again to build the site. You weren't charged for the pages.";
export const LOST_MSG = "That build stopped before it got anywhere and we lost track of it on our side. Send your brief again to build the site.";
export const FAILED_MSG = "That build didn't finish. Send your brief again to try it once more.";
export const CANCELLED_MSG = "That build was stopped.";
export const COLLECTED_MSG = "That build has finished and its answer was already collected — open your project to see the site.";
// ONE JOB PER SITE AT A TIME (stage 6): a job whose site stayed busy for the
// whole of its wait is failed by the claim itself, with nothing charged.
export const BUSY_BUILD_MSG = "Your site was busy with another change for the whole time this build waited, so it was set aside — nothing was charged for it. Send your brief again once the other change has finished.";
export const BUSY_EDIT_MSG = "Your site was busy with another change for the whole time this edit waited, so it was set aside — nothing was charged for it. Ask again once the other change has finished.";
// THE DEPLOY GATE (stage 3a): a job refused for the whole of its wait because a
// deploy's gate stood under another id — reachable only when a gate is left
// standing with no new Worker behind it, since new code claims through its own.
export const GATED_BUILD_MSG = "Our platform was being updated for the whole time this build waited, so it was set aside — nothing was charged for it. Send your brief again in a few minutes.";
export const GATED_EDIT_MSG = "Our platform was being updated for the whole time this edit waited, so it was set aside — nothing was charged for it. Ask again in a few minutes.";
// A QUEUED JOB NOBODY PICKED UP (stage 3a): its message sent again once by the
// sweep, then failed with nothing charged — a build's deposit given back.
export const STALE_BUILD_MSG = "That build was never picked up on our side, so it was set aside — nothing was charged for it. Send your brief again.";
export const STALE_EDIT_MSG = "That change was never picked up on our side, so it was set aside — nothing was charged for it. Ask again.";

/**
 * WHAT THE POLL ROUTE ANSWERS FROM THE ROW ALONE — asked only when the answer
 * object is not there, because the object is the build's own reply and always
 * wins. `null` means "still pending": the row is in flight, or there is no
 * row, and the route answers the 202 it always did.
 *
 * A LOST BUILD WITH A SLUG IS SHAPED AS A PLACEHOLDER BUILD, deliberately:
 * status 200, `slug`, `page: "placeholder"`, the sentence in `notes`. The
 * browser's success gate is `r.ok && d.slug`, and inside it `page` decides
 * the ⚠️ sentence and the slug is RECORDED — which it must be, because the
 * slug is claimed and the stand-in is live at it; a project that forgets
 * sends the next message as a fresh first build against a name it already
 * owns and gets a 409 it cannot explain. `ok: false` says what happened; the
 * gate does not read it. A lost build with NO slug (nothing was claimed) and
 * every other terminal state answer 410 with a sentence, which the browser
 * renders as the refusal it is.
 */
export function rowVerdict(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const state = typeof row.state === "string" ? row.state : "";
  const job = typeof row.job === "string" ? row.job : "";
  const slug = isRowSlug(row.slug) ? row.slug : "";
  if (state === "lost") {
    if (slug) {
      return { status: 200, body: { ok: false, lost: true, stage: "queue", job, slug, page: "placeholder", error: "the build was lost", notes: LOST_SITE_MSG, msg: LOST_SITE_MSG } };
    }
    return { status: 410, body: { ok: false, lost: true, stage: "queue", job, msg: LOST_MSG } };
  }
  if (state === "failed") {
    // FAILED BY THE CLAIM, NOT BY THE BUILD (stage 6): the row's own reason
    // says the site was busy for the whole wait, and the sentence says so
    // instead of blaming a build that never started.
    const kind = row.error && typeof row.error === "object" && !Array.isArray(row.error) ? String(row.error.kind || "") : "";
    if (kind === "site-busy") return { status: 410, body: { ok: false, failed: true, busy: true, stage: "queue", job, msg: BUSY_BUILD_MSG } };
    // FAILED BY THE CLAIM UNDER A DEPLOY GATE, OR NEVER PICKED UP (stage 3a):
    // each its own reason on the row and its own sentence, never the build's.
    if (kind === "deploy-gated") return { status: 410, body: { ok: false, failed: true, gated: true, stage: "queue", job, msg: GATED_BUILD_MSG } };
    if (kind === "stale") return { status: 410, body: { ok: false, failed: true, stale: true, stage: "queue", job, msg: STALE_BUILD_MSG } };
    return { status: 410, body: { ok: false, failed: true, stage: "queue", job, msg: FAILED_MSG } };
  }
  if (state === "cancelled") return { status: 410, body: { ok: false, cancelled: true, stage: "queue", job, msg: CANCELLED_MSG } };
  if (state === "done") return { status: 410, body: { ok: false, collected: true, stage: "queue", job, msg: COLLECTED_MSG } };
  return null;
}

/**
 * DOES THIS REPORT TOKEN BELONG TO THIS GENERATION OF THIS BUILD? The report
 * route's only credential is the 128-bit token minted at fire time; it
 * authorises writing ONE generation's answer. A beat or a release names a
 * row, and naming a row is more than the token was minted for — so both are
 * bound through the resume record: the record the Worker wrote for that job
 * must carry this token AND this generation id. A stranger who guessed a job
 * id and a generation id but not the token gets nothing; so does the
 * container of a generation that was re-fired, whose token the record no
 * longer carries.
 */
export function genBound(record, token, genId) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  if (typeof token !== "string" || !token || typeof genId !== "string" || !genId) return false;
  return record.report === token && record.genId === genId;
}
