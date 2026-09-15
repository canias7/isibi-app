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

const POLL_MS = Number(process.env.POLL_MS) || 1000;
const GRACE_S = Number.isFinite(Number(process.env.GRACE_S)) ? Number(process.env.GRACE_S) : 0;

const env = { ...process.env };
// The consumer never produces, so the queue binding is not one of its settings —
// but the project is. Reported by NAME and never by value.
const missing = missingSettings(env).filter((k) => k !== "RUN_QUEUE");
if (missing.length) {
  console.log(JSON.stringify({ at: "start", error: `not configured: ${missing.join(", ")}` }));
  process.exit(2);
}

let runner;
try { runner = buildRunner(env); }
catch (e) { console.log(JSON.stringify({ at: "start", error: String(e?.message ?? e) })); process.exit(2); }

let stop = false;
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { stop = true; });

console.log(JSON.stringify({ at: "start", pollMs: POLL_MS, graceS: GRACE_S, pid: process.pid }));

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
