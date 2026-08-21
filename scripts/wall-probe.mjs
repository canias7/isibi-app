// WHERE IS THE WALL, AND WHICH KIND IS IT?
//
// Four builds clustered around one ceiling on 2026-08-21 — 272s published, then
// 286s, 291s and 301s died — across two providers and two languages. So the wall
// is real, provider-independent and load-bearing, and NOTHING about it was
// known: not the number, and not whether it is the connection timing out or the
// Worker being killed.
//
// THAT DISTINCTION DECIDES THE FIX AND THE TWO FIXES ARE OPPOSITES. Streaming a
// response keeps a CONNECTION alive and does nothing if the Worker is stopped;
// moving the work off the request survives a Worker being stopped and does
// nothing if the connection is what times out. Guessing costs a ~130-credit
// build to find out.
//
// This costs NOTHING: `/api/_slow` sleeps and returns. No model call, no Neon
// project, no container, no publish, no ledger. The only thing it spends is
// wall-clock.
//
// FIRST RUN, 2026-08-21: DURATION IS NOT THE WALL. Plain and streamed both
// returned at every step up to 420s — well past the 301s that died — so the
// connection is not timing out and the clock is not the ceiling. That killed
// the streaming fix before it cost a build, which is what this was for.
//
// So the wall is about what a build DOES between the waits, and the two
// remaining candidates still have opposite fixes: CPU is a line of config
// (Workers Paid defaults to 30s and this repo had never set `limits`), memory
// is a rewrite of the publish path. `burn` and `mem` are the two questions.

import https from "node:https";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();

if (!EMAIL || !SERVICE_KEY) { console.error("OWNER_EMAIL and SUPABASE_SERVICE_KEY are required"); process.exit(1); }

// Same admin magic-link sign-in as build-as-owner: no password anywhere.
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }),
});
const glBody = await gl.json().catch(() => ({}));
const tokenHash = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
if (!tokenHash) { console.error("could not generate a sign-in link:", gl.status); process.exit(1); }
const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
});
const session = await vr.json().catch(() => ({}));
if (!session.access_token) { console.error("could not open a session:", vr.status); process.exit(1); }
console.log(`signed in as ${(session.user || {}).email}\n`);

/**
 * GET with NO client-side timeout of its own, so the only thing that can end
 * the request is the far end. `node:https` rather than fetch for the reason
 * build-as-owner records: undici gives up at 300s and that ceiling is inside the
 * range being measured, which would make the harness the thing under test.
 */
function get(path, token) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path);
    const t0 = Date.now();
    let bytes = 0, firstByteAt = 0, ticks = 0;
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      res.on("data", (c) => {
        if (!firstByteAt) firstByteAt = Date.now() - t0;
        bytes += c.length;
        ticks += (c.toString().match(/"tick"/g) || []).length;
      });
      res.on("end", () => resolve({ ok: true, status: res.statusCode, ms: Date.now() - t0, bytes, firstByteAt, ticks }));
      res.on("error", (e) => resolve({ ok: false, why: e.code || e.message, ms: Date.now() - t0, firstByteAt, ticks }));
    });
    req.on("error", (e) => resolve({ ok: false, why: e.code || e.message, ms: Date.now() - t0, firstByteAt, ticks }));
    req.end();
  });
}

// Around the observed cluster: one comfortably under, then across it, then well
// past. 420s is deliberately beyond anything a build has ever taken — if a
// STREAMED response survives that, the ceiling is not about total duration.
const STEPS = (process.env.WALL_STEPS || "240,300,360,420").split(",").map((s) => Number(s.trim())).filter(Boolean);

// Megabytes, for `mem`. A Worker has 128MB, so the interesting range straddles
// it: 64 should be comfortable, 192 should not be, and where exactly it stops
// is the answer.
const MB = (process.env.WALL_MB || "32,64,96,128,192").split(",").map((s) => Number(s.trim())).filter(Boolean);

// EACH MODE ASKS A DIFFERENT QUESTION AND ONLY ONE OF THEM IS ABOUT TIME.
//   plain   waits on a timer            — ANSWERED, no wall to 420s
//   stream  waits and heartbeats        — ANSWERED, no wall to 420s
//   burn    spends CPU                  — Workers Paid defaults to 30s of it
//   mem     holds memory                — a Worker has 128MB
//   sub     waits on an OUTBOUND FETCH  — the shape a build actually has
//
// The default is the three UNANSWERED ones. `plain` and `stream` cost 22
// minutes each to re-prove something already measured, and the run has to fit
// inside its job timeout — re-running an answered question is how a probe stops
// being worth running. Both are still reachable through WALL_MODES.
const MODES = (process.env.WALL_MODES || "burn,mem,sub").split(",").map((s) => s.trim()).filter(Boolean);

// What the first run measured, so a verdict comparing against "waiting" does
// not have to re-run waiting — and so it is never silently sourced from a mode
// that did not run in THIS pass.
const PLAIN_MEASURED = 420;

const rows = [];
for (const mode of MODES) {
  // `mem` sweeps SIZE, not duration — the other two sweep duration. Sharing one
  // loop would have sent it four identical requests wearing four labels.
  const steps = mode === "mem" ? MB : STEPS;
  const unit = mode === "mem" ? "MB" : "s";
  for (const n of steps) {
    const q = mode === "mem"
      ? `/api/_slow?ms=0&mem=1&mb=${n}`
      : `/api/_slow?ms=${n * 1000}` + (mode === "plain" ? "" : `&${mode}=1`);
    process.stdout.write(`  ${mode.padEnd(6)} ${String(n).padStart(4)}${unit} ... `);
    const r = await get(q, session.access_token);
    const verdict = r.ok && r.status === 200 ? "RETURNED" : "DIED (" + (r.why || r.status) + ")";
    console.log(`${verdict} after ${(r.ms / 1000).toFixed(1)}s` +
      (r.firstByteAt ? ` · first byte ${(r.firstByteAt / 1000).toFixed(1)}s` : "") +
      (r.ticks ? ` · ${r.ticks} heartbeats` : ""));
    rows.push({ mode, n, ok: r.ok && r.status === 200, ms: r.ms });
    // A mode that has already died will die at every larger step too, and each
    // costs its full wall-clock to prove. Stop that mode there.
    if (!(r.ok && r.status === 200)) break;
  }
}

const last = (m) => rows.filter((r) => r.mode === m && r.ok).map((r) => r.n).pop() || 0;
const top = (m) => (m === "mem" ? MB : STEPS)[(m === "mem" ? MB : STEPS).length - 1];
console.log("");
for (const m of MODES) console.log(`  ${m.padEnd(6)} survived up to ${last(m)}${m === "mem" ? "MB" : "s"}`);

// The control every other verdict is read against: either measured in THIS run,
// or the first run's number, named as such.
const waits = MODES.includes("plain") && last("plain")
  ? `${last("plain")}s`
  : `${PLAIN_MEASURED}s (measured 2026-08-21)`;

console.log("");
if (MODES.includes("plain") && last("plain") >= top("plain")) {
  console.log(`  => NOT A DURATION WALL: a request that only WAITS returns fine at ${top("plain")}s,`);
  console.log(`     which is well past every build that died (272s published; 286/291/301s did not).`);
}
if (MODES.includes("burn")) {
  if (last("burn") < top("burn")) {
    console.log(`  => THE WALL IS CPU: burning stops at ${last("burn")}s while waiting survives ${waits}.`);
    console.log(`     limits.cpu_ms in wrangler.jsonc is the fix (Workers Paid allows up to 300000).`);
  } else {
    console.log(`  => CPU IS NOT THE WALL at this level of work: burning survives ${top("burn")}s.`);
  }
}
if (MODES.includes("mem")) {
  if (last("mem") < top("mem")) {
    console.log(`  => MEMORY IS A CEILING, at somewhere over ${last("mem")}MB.`);
    console.log(`     NO CONFIG RAISES IT — the publish path has to stream the dist rather than`);
    console.log(`     buffer it as JSON plus base64. That is a real change, not a setting.`);
  } else {
    console.log(`  => MEMORY IS NOT THE WALL up to ${top("mem")}MB held at once.`);
  }
}
if (MODES.includes("sub")) {
  if (last("sub") < top("sub")) {
    console.log(`  => THE WALL IS A SUBREQUEST: an outbound fetch stops being held at ${last("sub")}s`);
    console.log(`     while the same wait on a timer survives ${waits}. A build's model`);
    console.log(`     calls and container build are exactly this shape.`);
  } else {
    console.log(`  => A SUBREQUEST CAN BE HELD FOR ${top("sub")}s, so no single outbound wait is the wall.`);
  }
}
// Only ever printed when something is left unexplained, so a clean sweep does
// not end on a shrug.
if (MODES.every((m) => last(m) >= top(m))) {
  console.log(`  => NOTHING TESTED HERE IS THE WALL. Whatever ends a build is about what it`);
  console.log(`     DOES — a subrequest, the container, or a step with its own timeout.`);
}
