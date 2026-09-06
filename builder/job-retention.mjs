// NOTHING SWEEPS `jobs/` — and the code says so in three places (stage 9,
// 2026-09-06).
//
// WHAT LEAKS. Every object under `jobs/` is deleted on its happy path: the
// build's request the moment the consumer has read it, the edit's the moment
// the claim lands, the resume record when the chain settles, the result when
// somebody collects it. What is left behind is the unhappy paths, and each is
// a real one:
//
//   jobs/<id>.json          a build whose message was never delivered, or
//                           whose consumer died between the read and the run
//   jobs/<id>.result.json   an answer nobody came back for — a closed tab, a
//                           build the browser stopped watching, the stale
//                           sweep's own 409 for a job nobody is polling
//   jobs/<id>.resume.json   a generation whose collector never came, or gave
//                           up: "a stranded record is a few kilobytes;
//                           NOTHING sweeps `jobs/`", three times over
//   jobs/edit/<id>          a request whose row was failed before any
//                           consumer claimed it (the stale sweep closes the
//                           ROW and leaves the object)
//
// AND THEY ARE NOT ALL SMALL. A build's request carries the customer's whole
// POST body — up to 24MB with attachments, which is why it is an object and
// not a queue message in the first place. "A few kilobytes" was true of the
// resume record and was never true of the job.
//
// ── WHY AGE ALONE IS ENOUGH, AND NO ROW IS READ ──────────────────────────
//
// The longest a job can legitimately hold one of these is bounded from every
// side: a job's own clock is fourteen minutes (thirty in the container), a
// deferral chain gives up after forty-five, the browser's watch after
// fifty-three, and the build's own wait at sixteen. `JOB_RETENTION_MS` is
// SEVEN DAYS — two orders of magnitude above the longest of those — so an
// object older than it cannot belong to anything running, and this needs no
// lease, no row and no coordination with the consumers. An operator reading a
// stranded job still has a week to find it.
//
// ── A ROTATION, NOT A SCAN ───────────────────────────────────────────────
//
// R2 lists lexicographically and a job id is random hex, so a fixed page of
// `jobs/` is a random sample of it — and a bucket with more objects than one
// page would hide its tail for ever behind whatever sorts first. So each tick
// takes ONE NIBBLE (`jobs/7`, `jobs/edit/7`), chosen from the clock, and the
// sixteen come round every thirty-two minutes at the cron's two-minute tick.
// Deterministic coverage, one small listing per tick, and no cursor to keep
// across isolates that do not survive the tick.
//
// Pure but for the two deps, so every decision here is driven with no R2.

/** How long an object under `jobs/` may sit before it is somebody's litter. */
export const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** The cron's own period, named so the rotation's coverage can be checked. */
export const RETENTION_TICK_MS = 120_000;

/** The sixteen buckets a job id's first character falls into. */
export const RETENTION_NIBBLES = "0123456789abcdef";

/**
 * How much one tick may take. A listing is one subrequest per prefix and a
 * delete is one for the batch, so this shares a tick with four other sweeps
 * and stays well inside the invocation.
 */
export const RETENTION_LIST_LIMIT = 300;
export const MAX_RETENTION_DELETES = 100;

/**
 * THE TWO PREFIXES THIS TICK LOOKS AT. `jobs/edit/` needs its own because a
 * key under it is `jobs/edit/<id>` — the nibble is not where `jobs/<nibble>`
 * looks — and the `e` bucket therefore sees every edit object as well as its
 * own, which costs one listing and loses nothing.
 */
export function retentionPrefixes(now, tickMs = RETENTION_TICK_MS) {
  const t = Number.isFinite(now) ? now : 0;
  const step = Number.isFinite(tickMs) && tickMs > 0 ? tickMs : RETENTION_TICK_MS;
  const n = RETENTION_NIBBLES[Math.abs(Math.floor(t / step)) % RETENTION_NIBBLES.length];
  return ["jobs/" + n, "jobs/edit/" + n];
}

/**
 * WHICH OF THESE OBJECTS ARE OLD ENOUGH TO GO.
 *
 * A key outside `jobs/` is never returned however it got into the listing —
 * the prefix is the caller's and this is the wall — and an object whose age
 * CANNOT BE READ is kept: R2 gives `uploaded` as a Date, and a shape this
 * does not recognise is a reason to leave the object alone rather than to
 * guess it is old (the recorded "cannot-tell must never read as
 * nothing-there", pointed at a delete).
 */
export function expiredJobKeys(objects, { now, retainMs = JOB_RETENTION_MS, max = MAX_RETENTION_DELETES } = {}) {
  const t = Number.isFinite(now) ? now : Date.now();
  const keep = Number.isFinite(retainMs) && retainMs > 0 ? retainMs : JOB_RETENTION_MS;
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : MAX_RETENTION_DELETES;
  const out = [];
  for (const o of Array.isArray(objects) ? objects : []) {
    if (out.length >= cap) break;
    const key = o && typeof o.key === "string" ? o.key : "";
    if (!key.startsWith("jobs/")) continue;
    const at = o && o.uploaded;
    const ms = at instanceof Date ? at.getTime() : (typeof at === "number" ? at : NaN);
    if (!Number.isFinite(ms)) continue;
    if (t - ms >= keep) out.push(key);
  }
  return out;
}

/**
 * One tick.
 *
 * deps:
 *   list(prefix, limit) → [{key, uploaded}]
 *   remove(keys)        → void            (R2 takes an array)
 *
 * IT CANNOT THROW. This shares a cron tick with the backups, the teardown
 * queue, the domain watch, the webhook queue and the edit sweeps, and litter
 * is the least important thing on it: a listing that fails is reported and
 * the tick goes on.
 */
export async function sweepJobObjects(deps, { now = Date.now(), retainMs = JOB_RETENTION_MS, max = MAX_RETENTION_DELETES, tickMs = RETENTION_TICK_MS, limit = RETENTION_LIST_LIMIT } = {}) {
  const prefixes = retentionPrefixes(now, tickMs);
  const out = { prefixes, listed: 0, deleted: 0, errors: [] };
  const doomed = [];
  for (const prefix of prefixes) {
    let objs = [];
    try { objs = (await deps.list(prefix, limit)) || []; }
    catch (e) { out.errors.push("list " + prefix + ": " + String((e && e.message) || e).slice(0, 120)); continue; }
    out.listed += objs.length;
    for (const key of expiredJobKeys(objs, { now, retainMs, max: max - doomed.length })) doomed.push(key);
    if (doomed.length >= max) break;
  }
  if (!doomed.length) return out;
  try { await deps.remove(doomed); out.deleted = doomed.length; }
  catch (e) { out.errors.push("remove: " + String((e && e.message) || e).slice(0, 120)); }
  return out;
}
