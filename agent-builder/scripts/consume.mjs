#!/usr/bin/env node
/**
 * A CONSUMER, ON ITS OWN, IN ITS OWN PROCESS. `node scripts/consume.mjs`.
 *
 * **THIS IS THE PROOF THAT THE WORK IS A ROW AND NOT A CLOSURE.** It was not
 * running when the request arrived, it never saw the request, and it holds nothing
 * from it: it reads the database, finds work nobody is holding a lease on, claims
 * it and runs it. If durability were still `ctx.waitUntil`, there would be nothing
 * here for this process to find.
 *
 * It uses the SWEEPER as its transport, deliberately — no queue, no doorbell, no
 * message. That is the worst case for latency and the best case for proving the
 * point.
 *
 *   SUPABASE_URL  SUPABASE_SERVICE_KEY  SUPABASE_PUBLISHABLE_KEY  [MODEL]
 *   [POLL_MS]     how often to look for dropped work (default 1000)
 *   [GRACE_S]     how long a lapsed lease must have been lapsed (default 0)
 *
 * Every outcome is printed as one JSON line, so a parent process can read what
 * happened without parsing prose.
 */
import { buildRunner, missingSettings } from "../src/worker.mjs";
import { LEASE_TTL_S, BEAT_EVERY_MS } from "../src/runner.mjs";

const POLL_MS = Number(process.env.POLL_MS) || 1000;
const GRACE_S = Number.isFinite(Number(process.env.GRACE_S)) ? Number(process.env.GRACE_S) : 0;

/**
 * The lease's timings, overridable HERE AND NOWHERE ELSE.
 *
 * **THE DEPLOYED WORKER NEVER READS THESE**: `worker.mjs` builds its runner with the
 * module's own constants, and `wrangler.jsonc` sets neither. They exist because a
 * handover takes a beat plus the sweep's grace, and at the real 30 s beat that is a
 * minute of waiting in every local exercise of it — so a local driver can compress
 * the clock without the production numbers being a variable anybody can set.
 *
 * **THE ONE INVARIANT IS ENFORCED, not trusted**: the grace must be at least a beat,
 * or a lapsed lease is handed on before its holder can notice, which is two workers
 * on one run. A setting that breaks it is refused rather than clamped.
 */
const LEASE_S = Number(process.env.LEASE_TTL_S) || LEASE_TTL_S;
const BEAT_MS = Number(process.env.BEAT_MS) || BEAT_EVERY_MS;
if (GRACE_S * 1000 < BEAT_MS) {
  console.log(JSON.stringify({ at: "start", error: `GRACE_S ${GRACE_S}s is shorter than a beat (${BEAT_MS}ms): a lapsed lease would be handed on before its holder could notice` }));
  process.exit(2);
}
if (LEASE_S * 1000 <= BEAT_MS) {
  console.log(JSON.stringify({ at: "start", error: `LEASE_TTL_S ${LEASE_S}s is not longer than a beat (${BEAT_MS}ms): a healthy worker would lose its own run` }));
  process.exit(2);
}

const env = { ...process.env };
// The consumer never produces, so the queue binding is not one of its settings —
// but the project is. Reported by NAME and never by value.
const missing = missingSettings(env).filter((k) => k !== "RUN_QUEUE");
if (missing.length) {
  console.log(JSON.stringify({ at: "start", error: `not configured: ${missing.join(", ")}` }));
  process.exit(2);
}

let runner;
try { runner = buildRunner(env, { leaseTtlS: LEASE_S, beatEveryMs: BEAT_MS }); }
catch (e) { console.log(JSON.stringify({ at: "start", error: String(e?.message ?? e) })); process.exit(2); }

let stop = false;
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { stop = true; });

console.log(JSON.stringify({ at: "start", pollMs: POLL_MS, graceS: GRACE_S, leaseS: LEASE_S, beatMs: BEAT_MS, pid: process.pid }));

while (!stop) {
  let dropped = [];
  try { dropped = await runner.reclaimable({ graceS: GRACE_S, limit: 10 }); }
  catch (e) { console.log(JSON.stringify({ at: "sweep", error: String(e?.message ?? e) })); }

  for (const row of dropped) {
    if (stop) break;
    try {
      const out = await runner.deliver(row.runId);
      console.log(JSON.stringify({ at: "deliver", runId: out.runId, why: out.why, stop: out.stop?.reason ?? null }));
    } catch (e) {
      // `deliver` is documented never to throw. Said out loud if it ever does.
      console.log(JSON.stringify({ at: "deliver", runId: row.runId, error: String(e?.message ?? e) }));
    }
  }
  if (!dropped.length) await new Promise((r) => setTimeout(r, POLL_MS));
}
console.log(JSON.stringify({ at: "stop" }));
