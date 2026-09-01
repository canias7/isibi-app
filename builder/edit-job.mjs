// One edit, run as a queued job instead of on the customer's connection.
//
// ── WHY (2026-09-01) ───────────────────────────────────────────────────────
//
// The synchronous edit request is reset at ~273 seconds. Measured twice: run
// 101 at 273.2s and run 104 at 273.1s, the second naming it outright as
// ECONNRESET on the inbound TLS socket. Nothing we configure is 273 — the
// ceilings in this repo are 240s, 600s, 780s and 1080s — so the wall is
// infrastructure and no amount of tuning moves it. The work has to leave the
// connection.
//
// ── WHY IT IS A LEAF MODULE ────────────────────────────────────────────────
//
// No imports, no bindings, no I/O. Every decision that can be WRONG is here and
// is driven with literal values in the tests — the budget arithmetic especially,
// which decides whether a correction round is started and therefore whether a
// customer's money is spent on work that cannot finish. Same split as
// `edit-trace.mjs` and `site-render.mjs`: the part that judges is separable from
// the part that acts.

/** The queue message kind. `site-build` is the other one and neither may guess. */
export const EDIT_JOB_KIND = "site-edit";

/** Where a job's replayable request lives in R2, beside the build jobs. */
export const EDIT_JOB_PREFIX = "jobs/edit/";

// ── THE CLOCKS ─────────────────────────────────────────────────────────────
//
// A QUEUE CONSUMER IS STOPPED AT FIFTEEN MINUTES and that is a hard platform
// cap, not a setting. Everything below has to fit inside it with room for the
// job to record what happened while the isolate is still alive.

/** The platform's cap, named so the arithmetic below can be checked against it. */
export const CONSUMER_CEILING_MS = 900000;

/**
 * The whole job's clock — THIRTEEN MINUTES, the same figure and the same
 * reasoning as `BUILD_BUDGET_MS`.
 *
 * IT IS FIXED AT CLAIM AND NOTHING EXTENDS IT. Heartbeats renew the LEASE,
 * which says who may act; they do not and cannot buy execution time, because the
 * thing that stops the isolate is Cloudflare's ceiling and it is not listening.
 * The same goes for the publish lease. That separation is structural here:
 * `makeEditBudget` closes over its start and exposes no setter.
 *
 * The 120 seconds between this and the ceiling is the isolate's own teardown
 * room — the terminal state write, the refund and the trace, which all have to
 * complete AFTER the deadline fires.
 */
export const EDIT_JOB_MS = 780000;

/**
 * Held back for the publish sweep: the dist write, the archive, the source, the
 * landmarks and the site Worker upload.
 *
 * CONSERVATIVE AND UNMEASURED, AND SAID SO. The R2 publish phase has never been
 * timed on its own — `PUBLISH_RESERVE_MS` on the build path covers compile plus
 * container plus pages, which is a different quantity. The trace records
 * `publish` from the first run so this becomes a measurement instead of a guess;
 * until then it is deliberately generous, because the cost of it being too small
 * is a job that dies mid-publish and needs a human.
 */
export const PUBLISH_RESERVE_MS = 90000;

/**
 * Held back for recording the outcome: the terminal state, the refund, the
 * result and the trace. Small, but it must exist — a job that spends its last
 * millisecond publishing has no time left to say that it did.
 */
export const TERMINAL_RESERVE_MS = 15000;

/**
 * The floor under a correction round, and its parts are named rather than summed
 * into one number so a later measurement can move one of them.
 *
 * ── WHY THESE ARE MINIMUMS AND NOT CEILINGS ──────────────────────────────
 *
 * "Enough budget for correction, build 2, verification, publishing and the final
 * writes" cannot be read as the per-call CEILINGS, and the arithmetic says why:
 * a correction call may take 240s and a container call 600s, which with the two
 * reserves is 945s — more than the whole 780s budget and more than the
 * platform's 900s. Read that way a correction could never start under any
 * circumstances, and the feature would be dead on arrival.
 *
 * So the reserve is guaranteed STRUCTURALLY and the floor is a separate,
 * weaker thing:
 *
 *   - `capMs` subtracts both reserves from every pre-publish call, so no model
 *     call and no container call can eat the publish window. That is the
 *     guarantee, and it holds whatever these numbers say.
 *   - This floor stops work that is *obviously* doomed — below it there is no
 *     point spending the customer's money on a round that cannot land.
 *
 * The numbers are the smallest a real round has been observed to need, not the
 * largest it may take: a lane call is tens of seconds and an edit's container
 * build is one to two minutes (vite is ~7s over 2,186 modules, the render check
 * ~6s). Conservative on the safe side — too high only skips a correction and
 * refunds, which is the defined outcome anyway.
 */
export const MIN_CORRECT_MS = 60000;
export const MIN_BUILD_MS = 180000;
export const MIN_VERIFY_MS = 10000;
export const CORRECT_FLOOR_MS =
  MIN_CORRECT_MS + MIN_BUILD_MS + MIN_VERIFY_MS + PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS;

// ── THE LEASE ──────────────────────────────────────────────────────────────

/** How long a claim is good for. Three missed renewals before it can go stale. */
export const LEASE_TTL_S = 90;

/**
 * How often it is renewed.
 *
 * A TIMER, NEVER A PHASE BOUNDARY, and this is the one lease decision that is
 * not a matter of taste. The container call is a single await of up to ten
 * minutes with no boundary inside it, so a heartbeat that only fired between
 * phases would let the lease expire during every single build — the sweep would
 * then steal a healthy job and refund a customer whose edit was still running.
 */
export const HEARTBEAT_S = 30;

/**
 * How far past expiry a lease has to be before the sweep may take it. One extra
 * TTL of grace, so a slow renewal costs nothing.
 */
export const STALE_GRACE_S = 60;

/**
 * The window `edit_may_publish` grants.
 *
 * IT IS NOT EXECUTION TIME. It is longer than the publish reserve on purpose —
 * the sweep needs `expiry + STALE_GRACE_S` to elapse before it can act, so a
 * publish that runs to its full reserve still cannot be stolen mid-flight. The
 * consumer's own budget is what limits how long it may actually run, and it is
 * shorter.
 */
export const PUBLISH_LEASE_S = 300;

// ── STATES ─────────────────────────────────────────────────────────────────

/** Every state the database's own CHECK constraint admits, in order. */
export const EDIT_PHASES = Object.freeze([
  "queued", "claimed", "routing", "editing", "building",
  "verifying", "correcting", "rebuilding", "publishing",
]);

/** Nothing moves out of these. Kept in step with the CHECK constraint by a test. */
export const TERMINAL_STATES = Object.freeze(["done", "failed", "cancelled", "lost"]);

/**
 * A NON-STRING IS NOT TERMINAL, and it is not coerced into one either.
 *
 * The first draft of this line was `TERMINAL_STATES.includes(String(s || ""))`,
 * which answers TRUE for `["done"]` — `String(["done"])` is `"done"`. That is
 * this repo's own recorded trap, shipped for a fourth time, and caught by the
 * test written for it in the same commit. The direction of the mistake here is a
 * running job read as finished.
 */
export const isTerminalEdit = (s) => typeof s === "string" && TERMINAL_STATES.includes(s);

/**
 * The whole-job clock.
 *
 * `capMs` HANDS BACK WHICHEVER IS SOONER — the per-call bound, or what is left
 * of the job minus the reserves. That is what makes the two bounds compose
 * rather than compete, and it is the same shape as `makeBudget` on the build
 * path, deliberately: one idea, two clocks, no second way of thinking about it.
 */
export function makeEditBudget(totalMs = EDIT_JOB_MS, now = () => Date.now()) {
  const t0 = now();
  const left = () => Math.max(0, totalMs - Math.max(0, now() - t0));
  return {
    startedAt: t0,
    elapsed: () => Math.max(0, now() - t0),
    /** What remains of the whole job, reserves included. */
    remaining: left,
    /**
     * What remains for WORK — the job's time less both reserves.
     *
     * This is the number every gate reads, and it is what makes the publish
     * window safe by construction rather than by anybody remembering to leave
     * room for it.
     */
    spendable: () => Math.max(0, left() - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS),
    /**
     * The ceiling for one call. `publishing: true` releases the publish reserve,
     * because at that point the publish IS the work being bounded.
     *
     * NEVER ZERO for the same reason `capMs` on the build path is never zero: a
     * timer of 0 fires immediately, which turns "no time left" into "this call
     * failed instantly" and hides the real reason under a wrong one. A caller
     * that must refuse asks `expired()`.
     */
    capMs(cap, { publishing = false } = {}) {
      const room = publishing
        ? Math.max(0, left() - TERMINAL_RESERVE_MS)
        : Math.max(0, left() - PUBLISH_RESERVE_MS - TERMINAL_RESERVE_MS);
      return Math.max(1, Math.min(Number(cap) || 0, room));
    },
    /** No time left to do any work in. */
    expired: () => left() <= PUBLISH_RESERVE_MS + TERMINAL_RESERVE_MS,
    /**
     * May a correction round START?
     *
     * Asked BEFORE the round, never during. A round begun with too little left
     * spends the model call and the container run and then fails anyway — the
     * customer is refunded either way, so the only difference is whether we
     * spent their credits to reach the same place.
     */
    canCorrect: () => left() >= CORRECT_FLOOR_MS,
  };
}

/**
 * The client's idempotency key, or nothing.
 *
 * REFUSES, NEVER REPAIRS AND NEVER GENERATES. A key minted here would make every
 * retry a distinct job, which is exactly the double charge the key exists to
 * prevent — the failure is silent and costs the customer money, so the bias
 * inverts here the way it does for the `pages` verb and for `cleanAlias`.
 *
 * AND IT REFUSES A NON-STRING RATHER THAN COERCING ONE. `String(["abc"])` is
 * `"abc"` — a perfectly good key assembled out of a shape mistake — and this
 * repo has shipped that coercion as a real bug three times.
 */
export function cleanIdemKey(v) {
  if (typeof v !== "string") return null;
  return /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

/**
 * A consumer instance's name, for the lease.
 *
 * NOT THE JOB ID. Two consumers racing for one job must be distinguishable, and
 * naming the lease after the job makes every holder look like every other one —
 * which is the whole thing the lease is for.
 */
export function newLeaseOwner(rnd = Math.random) {
  return "c_" + rnd().toString(36).slice(2).padEnd(8, "0").slice(0, 8);
}

/**
 * Read one queue message, and REFUSE anything that is not ours.
 *
 * THE REFUSAL IS THE POINT. Three kinds share this queue and each has its own
 * handler; a reader that guessed would put an edit through the BUILD path, which
 * replays the request as a build — a second design call and a second charge on a
 * job that has already been billed. `readMessage` in `build-job.mjs` refuses
 * everything but `site-build` for exactly this reason, and this is its mirror.
 */
export function readEditMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.kind !== EDIT_JOB_KIND) return null;
  // A NON-STRING ID IS REFUSED, NOT COERCED. `String(["abc"])` is `"abc"`.
  if (typeof body.id !== "string" || !/^[0-9a-f]{32}$/.test(body.id)) return null;
  return { kind: EDIT_JOB_KIND, id: body.id };
}

/**
 * The header that tells the front door this request IS the replay.
 *
 * WITHOUT IT THE CONSUMER WOULD ENQUEUE ITSELF for ever — the replayed request
 * hits the same route, sees the flag on, and files another job. The marker is
 * the base case.
 *
 * ── AND ITS PRESENCE PROVES NOTHING ON ITS OWN ────────────────────────────
 *
 * A header name is public and a job id is handed to the customer in the 202, so
 * neither is evidence of anything. The first cut of this treated the header's
 * PRESENCE as the test — and any signed-in owner could send it and drop
 * straight into the inline pipeline, skipping the queue, the budget, the lease
 * and, worst of all, `edit_create`'s `needs_review` refusal, which is the only
 * thing stopping a new edit on a site whose last publish state is unknown.
 *
 * So the marker is `<jobId>.<secret>`, and the secret is 32 random hex minted
 * server-side, stored only in the service-role-only job object, and never sent
 * to any client. Knowing your own job id is not enough; there is nothing a
 * customer can observe that lets them build one.
 */
export const REPLAY_HEADER = "x-gf-job";

/** A per-job replay secret. Never leaves the server, never reaches a client. */
export function newReplaySecret(fill) {
  const b = new Uint8Array(16);
  fill(b);
  let out = "";
  for (const x of b) out += x.toString(16).padStart(2, "0");
  return out;
}

/** `<jobId>.<secret>`, the only form the front door accepts. */
export function packReplayMarker(id, secret) {
  return String(id || "") + "." + String(secret || "");
}

/**
 * Split a marker, and REFUSE anything that is not exactly one.
 *
 * Both halves are checked for shape here so the caller's comparison is between
 * two known-good strings rather than between whatever arrived and a stored
 * value — and a non-string is refused rather than coerced, because
 * `String(["a…"])` is `"a…"` and this repo has shipped that three times.
 */
export function readReplayMarker(v) {
  if (typeof v !== "string" || !v) return null;
  const dot = v.indexOf(".");
  if (dot < 0) return null;
  const id = v.slice(0, dot);
  const secret = v.slice(dot + 1);
  if (!/^[0-9a-f]{32}$/.test(id) || !/^[0-9a-f]{32}$/.test(secret)) return null;
  return { id, secret };
}

/**
 * WHAT THE CONSUMER REPLAYS. Deliberately NOT the build path's `packJob`.
 *
 * ── NO BEARER TOKEN, AND THAT IS THE POINT ────────────────────────────────
 *
 * `packJob` stores the customer's own `Authorization` header, because a build's
 * ledger calls go through `use_credits`, which resolves the user from
 * `auth.uid()` and so cannot be made by a service key. An async edit has no such
 * need: its money moves through `edit_reserve`, which is service-role and takes
 * the uid explicitly.
 *
 * Storing one anyway would buy three problems for nothing — a live credential at
 * rest, a job that fails because a token expired while it sat in the queue, and
 * an identity broader than the one job it is for. The `uid` and `slug` here are
 * the immutable record instead, and the consumer's authority is the LEASE.
 */
export function packEditJob({ url, body, uid, slug, secret, at }) {
  return {
    v: 1,
    url: String(url || ""),
    body: String(body || ""),
    uid: String(uid || ""),
    slug: String(slug || "").toLowerCase(),
    secret: String(secret || ""),
    at: Number(at) || 0,
  };
}

/** And back, refusing any shape we did not write. */
export function readEditJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.v !== 1) return null;
  for (const k of ["url", "body", "uid", "slug", "secret"]) {
    if (typeof raw[k] !== "string" || !raw[k]) return null;
  }
  if (!/^[0-9a-f]{32}$/.test(raw.secret)) return null;
  return { url: raw.url, body: raw.body, uid: raw.uid, slug: raw.slug, secret: raw.secret, at: Number(raw.at) || 0 };
}

/**
 * Rebuild the customer's request for the consumer to run.
 *
 * TWO HEADERS, AND NO AUTHORIZATION. Copying more would be a bug rather than a
 * kindness: `content-length` would describe a body that has been through JSON,
 * and any conditional header would apply to a request nobody is waiting on. The
 * absent one is the deliberate part — see `packEditJob`.
 */
export function replayEditRequest({ url, body, marker }) {
  const headers = { "content-type": "application/json" };
  if (marker) headers[REPLAY_HEADER] = String(marker);
  return new Request(String(url || ""), { method: "POST", headers, body: String(body || "") });
}

/**
 * How long each phase actually took, from a trace's events.
 *
 * ── WHY THIS EXISTS (owner, 2026-09-01) ───────────────────────────────────
 *
 * "Do not treat observed minimums as the permanent admission threshold…
 * persist real durations from every async edit, then derive the correction
 * requirement from measured p90/p95."
 *
 * The trace already records a `start` and an outcome for every phase, but the
 * numbers on them are ELAPSED-SINCE-JOB-START, not durations — so a percentile
 * query over the raw events would be computing percentiles of "how late in the
 * job this happened", which is a different quantity that happens to look
 * plausible. Subtracting here, once, is what makes the stored numbers mean what
 * a later query will assume they mean.
 *
 * A phase that started and never finished contributes NOTHING rather than a
 * zero: it is the one that was running when the job died, and folding it in as
 * 0ms would drag every percentile down at exactly the moment the data is about
 * a job that ran too long.
 */
export function phaseDurations(events) {
  if (!Array.isArray(events)) return {};
  const open = new Map();
  const out = {};
  for (const e of events) {
    if (!e || typeof e.p !== "string") continue;
    const at = Number(e.ms);
    if (!Number.isFinite(at)) continue;
    if (e.s === "start") { open.set(e.p, at); continue; }
    if (e.s !== "ok" && e.s !== "fail") continue;
    if (!open.has(e.p)) continue;
    // LAST WINS for a phase that ran twice under one name. Nothing does today
    // (the two publishes are `publish:1` and `publish:2`), and a silent sum
    // would be a number no percentile could be read from.
    out[e.p] = Math.max(0, at - open.get(e.p));
    open.delete(e.p);
  }
  return out;
}

/**
 * Is the async edit path on AT ALL?
 *
 * OPTIONAL, AND OFF IS THE DEFAULT INCLUDING WHEN THE VALUE IS NONSENSE. An
 * unreadable flag must not turn a customer-facing path on by accident, so
 * anything that is not an affirmative word is off.
 *
 * ON ITS OWN THIS IS NOT ENOUGH TO ROUTE ANYTHING. See `editAsyncFor`: the flag
 * is the master switch and the allowlist is who it applies to, and both have to
 * say yes.
 */
export function editAsyncOn(env) {
  const v = env && env.EDIT_ASYNC;
  if (typeof v !== "string") return false;
  return ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

/**
 * WHO THE ASYNC PATH APPLIES TO — a list of uids and slugs, and nothing else.
 *
 * ── THERE IS NO WILDCARD, DELIBERATELY ────────────────────────────────────
 *
 * Not `*`, not `all`, not an empty string meaning everybody. The one mistake
 * this must never make is turning a canary into general traffic because a value
 * was typed wrong, so an entry that is not a well-formed uuid or slug is
 * DROPPED, and a list with nothing well-formed in it is an empty list — which
 * keeps every edit synchronous.
 *
 * That is the safe direction and it is worth being explicit about which way it
 * fails: a malformed allowlist means the canary does not get the new path,
 * which is visible in one test edit. The opposite mistake is every customer on
 * a path that has never run.
 */
export function readCanaryList(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const out = [];
  for (const piece of raw.split(/[\s,;]+/)) {
    const v = piece.trim().toLowerCase();
    if (!v) continue;
    // A uuid, or a slug of the shape every other route in this codebase admits.
    // Anything else — a wildcard, a regex, a hostname, a stray quote — is not a
    // narrower match, it is a value nobody meant, so it is dropped rather than
    // interpreted.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) { out.push(v); continue; }
    if (/^[a-z0-9][a-z0-9-]{0,80}$/.test(v)) { out.push(v); continue; }
  }
  return out;
}

/**
 * Does THIS edit go through the queue?
 *
 * BOTH HAVE TO SAY YES. The flag is the master switch and the allowlist is the
 * blast radius; either alone routes nothing. An empty allowlist with the flag
 * on is a deploy that changed no behaviour at all, which is exactly what a
 * first deployment of this should be.
 *
 * MATCHED ON EITHER THE ACCOUNT OR THE SITE, because the two questions a canary
 * asks are different: one account's every edit, or one site's every edit
 * whoever makes it. Both are narrow and neither implies the other.
 */
export function editAsyncFor(env, { uid = "", slug = "" } = {}) {
  if (!editAsyncOn(env)) return false;
  const list = readCanaryList(env && env.EDIT_ASYNC_CANARY);
  if (!list.length) return false;
  // NON-STRINGS ARE REFUSED, NOT COERCED. `String(["u1"])` is `"u1"`, and a
  // shape mistake that let an array match an allowlist entry would widen the
  // canary silently — the one direction this must never fail in.
  const u = typeof uid === "string" ? uid.toLowerCase() : "";
  const s = typeof slug === "string" ? slug.toLowerCase() : "";
  return (!!u && list.includes(u)) || (!!s && list.includes(s));
}
