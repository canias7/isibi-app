// HOW LONG A CONTAINER JOB MAY RUN — ONE SETTING, AND EVERYTHING ELSE DERIVED.
//
// ── WHY THIS FILE EXISTS (2026-09-14) ────────────────────────────────────────
//
// Owner: *"Make the overall job duration one explicit, configurable setting…
// Align the supporting deadlines, database allowance, container hold, and
// browser polling with that setting."*
//
// Before this the fifty minutes was typed in TWO places (`BUILD_JOB_MS` and
// `CONTAINER_EDIT_JOB_MS`), the hold derived from one of them, the database's
// allowance derived from the hold, and the browser's give-up was an attempt
// COUNT that happened to land near the same number. Five copies of one
// decision, four of them arithmetic downstream of a literal — so raising the
// setting meant finding all five and getting the chain right by hand, and
// getting it wrong is silent in the direction that matters: a hold shorter than
// the deadline makes the graceful stop unreachable, which is a defect this
// repository has already shipped once.
//
// ── THE CHAIN, AND WHY EACH LINK IS WHERE IT IS ─────────────────────────────
//
//   JOB_MAX_MS      the work may run this long. THE setting.
//   + KILL_GRACE    SIGTERM: the runner ends the job AS A JOB — the refund
//                   through the row's own door, the customer's sentence.
//   + TERM_GRACE    SIGKILL: for a process that ignores the stop.
//   + SLACK         the container is held past the SIGKILL, never before it.
//                   THIS IS THE ONE THAT WAS WRONG: the hold used to equal the
//                   deadline, so a job that ran to its clock had its container
//                   stopped a minute BEFORE the signal that lets it finish.
//   = holdMs        how long a BUSY container is held. The bill.
//   → handoffTtlS   what `edit_handoff` is asked for, in seconds.
//
// ── AND THE LAST LINK IS NOT OURS ───────────────────────────────────────────
//
// `edit_handoff` raises `bad ttl` past 3600 seconds. That is a live Postgres
// function, so the ceiling on this whole chain is a MIGRATION and not a
// constant — which is why `assertJobDuration` refuses a setting that would
// breach it rather than letting a deploy discover it at the first handoff.
// Fifty minutes leaves 450 seconds of headroom; the arithmetic caps the
// setting at 57.5 minutes.
//
// ── CONFIGURABLE, AND `readJobMaxMs` IS THE ONE DOOR ────────────────────────
//
// The setting is read from the environment so it can be moved without a code
// change, and the reader REFUSES anything that is not a finite positive number
// of minutes — `String(["50"])` is `"50"`, which this repository has shipped as
// a real bug three times — and refuses anything the database would reject, so
// a typo cannot quietly buy a chain no handoff can serve. A refusal falls back
// to the built-in default and says so; it never throws at import, because a bad
// environment value must not take the whole Worker down.

import { JOB_KILL_GRACE_MS, JOB_TERM_GRACE_MS } from "./job-clock.mjs";

/** THE SETTING: how long the work in a container job may run, end to end. */
export const JOB_MAX_MS = 50 * 60_000;

/**
 * The slack between the SIGKILL and the container being let go. A job that has
 * been killed still has its outcome to record through the gateway, and the hold
 * is what keeps the instance alive while it does.
 */
export const HOLD_SLACK_MS = 60_000;

/**
 * THE DATABASE'S OWN CEILING, in seconds — `edit_handoff` raises `bad ttl` past
 * this. Not ours to change here: it is the live function's, and moving it is a
 * migration. Named rather than buried in the arithmetic so a session that needs
 * a longer job knows exactly what it has to go and change.
 */
export const HANDOFF_MAX_S = 3600;

/**
 * The whole chain for one setting. Pure arithmetic, no clock read — the caller
 * supplies `now` when it wants absolute times.
 */
export function jobDurationPlan(maxMs = JOB_MAX_MS) {
  const work = Number(maxMs);
  const termAt = work + JOB_KILL_GRACE_MS;
  const killAt = termAt + JOB_TERM_GRACE_MS;
  const holdMs = killAt + HOLD_SLACK_MS;
  const handoffTtlS = Math.round(holdMs / 1000);
  return {
    workMs: work,
    termMs: termAt,
    killMs: killAt,
    holdMs,
    handoffTtlS,
    // The browser has to keep watching for at least as long as the job can run,
    // plus the graces — a page that gives up first tells a customer their edit
    // is lost while it is still running and about to publish.
    watchMs: holdMs,
    fits: Number.isFinite(work) && work > 0 && handoffTtlS <= HANDOFF_MAX_S,
  };
}

/**
 * The largest setting this chain can carry without a migration. Derived, so it
 * moves on its own if a grace ever does.
 */
export function maxJobMs() {
  return HANDOFF_MAX_S * 1000 - JOB_KILL_GRACE_MS - JOB_TERM_GRACE_MS - HOLD_SLACK_MS;
}

/**
 * Read the setting from the environment, refusing anything the chain cannot
 * serve. Answers `{ ms, from, why }` — never throws, because a bad value in a
 * deploy secret must degrade to the default rather than take the Worker down.
 */
export function readJobMaxMs(env, fallback = JOB_MAX_MS) {
  const raw = env && env.JOB_MAX_MINUTES;
  // NON-STRINGS REFUSED, NEVER COERCED: `String(["50"])` is `"50"`.
  if (typeof raw !== "string" || !raw.trim()) return { ms: fallback, from: "default", why: "" };
  const mins = Number(raw.trim());
  if (!Number.isFinite(mins) || mins <= 0) return { ms: fallback, from: "default", why: "JOB_MAX_MINUTES is not a positive number of minutes" };
  const ms = Math.round(mins * 60_000);
  if (!jobDurationPlan(ms).fits) {
    return { ms: fallback, from: "default", why: "JOB_MAX_MINUTES is past what edit_handoff accepts (" + Math.floor(maxJobMs() / 60_000) + " minutes without a migration)" };
  }
  return { ms, from: "env", why: "" };
}

/**
 * Refuse a setting the chain cannot serve, LOUDLY. Called by the test that owns
 * this decision rather than at import: the shipped default is checked in CI, and
 * an environment value is checked by `readJobMaxMs`, which falls back instead.
 */
export function assertJobDuration(maxMs = JOB_MAX_MS) {
  const p = jobDurationPlan(maxMs);
  if (!p.fits) {
    throw new Error("a job of " + maxMs + "ms needs a handoff ttl of " + p.handoffTtlS
      + "s, and edit_handoff refuses anything past " + HANDOFF_MAX_S
      + "s — raising it is a migration, not a constant");
  }
  return p;
}
