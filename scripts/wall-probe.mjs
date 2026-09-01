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
//
// SECOND RUN, 2026-08-21, WITH `limits.cpu_ms` ALREADY AT THE MAXIMUM:
//   burn 240s   DIED (ECONNRESET) after 300.0s
//   mem  192MB  RETURNED in 2.1s — memory is not the wall
//   sub  240s   NOT MEASURED — inner status 522, inner fetch waited 0.0s
//
// STAGE 1 IS DEPLOYED (2026-09-01, ad64d6e7). The container image carrying
// `/slowreply` rolled with it, so the preflight below should confirm on its
// first or second poll rather than waiting out its twenty-five minutes. If it
// does not, the image has not finished rolling and the run refuses rather than
// printing four NOT MEASURED rows — which is the whole point of it.
//
// AND THAT IS WHY THIS FILE IS BEING TOUCHED AGAIN ON 2026-09-01. Two edits have
// now died at 273.2s and 273.1s (the second an outright `ECONNRESET`), and an
// EDIT IS NOT CPU-BOUND — it waits on a model call, then on the container, and
// burns almost nothing in between. The `burn` verdict cannot explain it and
// `plain` says waiting survives 420s, so the only candidate left is the shape
// neither of them tests: a Worker HOLDING AN OUTBOUND FETCH. That is `sub`, and
// `sub` has never once produced a measurement.

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
    let bytes = 0, firstByteAt = 0, ticks = 0, text = "";
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      res.on("data", (c) => {
        if (!firstByteAt) firstByteAt = Date.now() - t0;
        bytes += c.length;
        const s = c.toString();
        // Bounded: a heartbeat stream is unbounded and only the LAST line is
        // ever read, so keeping the whole thing would grow without limit for
        // nothing.
        text = (text + s).slice(-4096);
        ticks += (s.match(/"tick"/g) || []).length;
      });
      res.on("end", () => {
        // The final line is the JSON result in every mode, so the fields a mode
        // reports about ITSELF are readable here. That is what lets a row be
        // judged on whether it did the work rather than on its status code.
        let body = null;
        try { body = JSON.parse(text.trim().split("\n").pop()); } catch { /* not JSON, or truncated */ }
        resolve({ ok: true, status: res.statusCode, ms: Date.now() - t0, bytes, firstByteAt, ticks, body });
      });
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
//   plain    waits on a timer            — ANSWERED 08-21: no wall to 420s
//   stream   waits and heartbeats        — ANSWERED 08-21: no wall to 420s
//   mem      holds memory                — ANSWERED 08-21: 192MB held, fine
//   burn     spends CPU                  — ANSWERED 08-21: ECONNRESET at 300.0s
//   sub      waits on an OUTBOUND FETCH  — the shape an edit actually has
//   subself  the same, to our own zone   — demonstrates Cloudflare's 522
//
// THE DEFAULT IS `sub` ALONE, because it is the only unanswered question left
// and the only one shaped like the thing that dies. The other three each cost up
// to 22 minutes to re-prove something already measured, and the run has to fit
// inside its job timeout — re-running an answered question is how a probe stops
// being worth running. All of them stay reachable through WALL_MODES.
//
// `sub` HAS NEVER MEASURED, across every run. Its inner fetch went to our own
// hostname and Cloudflare answered 522 in 0.0s: a Worker cannot call the zone it
// serves. It now calls the CONTAINER's `/slowreply`, which is the honest far end
// rather than a workaround — the longest await an edit performs IS the container
// fetch. `subself` keeps the old form so the 522 stays reproducible.
const MODES = (process.env.WALL_MODES || "sub").split(",").map((s) => s.trim()).filter(Boolean);

// What the first run measured, so a verdict comparing against "waiting" does
// not have to re-run waiting — and so it is never silently sourced from a mode
// that did not run in THIS pass.
const PLAIN_MEASURED = 420;

// ── WAIT FOR THE CONTAINER IMAGE, NOT JUST THE DEPLOY ─────────────────────
//
// The workflow waits for deploy.yml and that is NOT enough for this mode. A
// push touching `builder/` rolls the container image and the roll takes 15–20
// minutes, so an instance started three minutes after "deploy completed" is
// still running the PREVIOUS image — one with no `/slowreply` in it. That
// answers 404 instantly, `innerMs` comes back 0, and the run scores NOT
// MEASURED: the exact non-answer this whole change exists to end, reproduced by
// firing too early.
//
// A PROBE RATHER THAN A SLEEP. A fixed wait is a guess that is either wasteful
// or wrong; asking the container whether it can hold for one second is the
// question itself, at 1/240th of the cost. Nothing is spent either way.
async function waitForSlowreply(token, minutes = 25) {
  const until = Date.now() + minutes * 60_000;
  for (let attempt = 1; Date.now() < until; attempt++) {
    const r = await get("/api/_slow?ms=1000&sub=1", token);
    const inner = Number((r.body || {}).innerMs || 0);
    // 800ms OF A 1000ms ASK — the same 0.8 tolerance the row validator uses, so
    // the preflight and the scoring cannot disagree about what "it waited"
    // means. A container on the old image answers in single-digit milliseconds.
    if (inner >= 800) { console.log(`  container is on the new image (held ${inner}ms, poll ${attempt})\n`); return true; }
    console.log(`  waiting for the container image ... held ${inner}ms (poll ${attempt})`);
    await new Promise((res) => setTimeout(res, 30_000));
  }
  return false;
}

// NAMED RATHER THAN INLINE, and a guard is why. `test/worker-limits.test.mjs`
// finds each verdict block by the FIRST `MODES.includes("<mode>")` in the file,
// so an inline condition here silently stole `sub`'s anchor and made that guard
// report a working verdict as ungated. Its window is fixed below too — but the
// collision is worth not creating in the first place.
const wantsContainerSub = MODES.includes("sub");
if (wantsContainerSub) {
  console.log("preflight: can the container hold a reply at all?");
  if (!await waitForSlowreply(session.access_token)) {
    // REFUSE RATHER THAN MEASURE. Running the sweep now would print four NOT
    // MEASURED rows and no verdict, which is indistinguishable from the defect
    // being fixed — and a harness that cannot fail honestly is worse than none.
    console.error("  the container never held a 1s reply — it is still on an image without /slowreply.");
    console.error("  Nothing was measured. Re-run once the image has rolled.");
    process.exit(1);
  }
}

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
    const returned = r.ok && r.status === 200;

    // DID THE ROW ACTUALLY DO ITS WORK? A 200 alone is not survival — a `sub`
    // request whose inner fetch never waited comes back 200 in a tenth of a
    // second and, scored on status, reads as having held a subrequest open for
    // four minutes. That is precisely what the first run reported. `valid` is
    // the difference between a measurement and a green tick.
    const b = r.body || {};
    let valid = true, note = "";
    // BOTH SUB FORMS, and the prefix is the point rather than a shortcut: the
    // whole reason `subself` exists is that it returns 200 without waiting, so a
    // check that named only `sub` would score the demonstration of the bug as a
    // clean pass.
    if (mode.startsWith("sub")) {
      const inner = Number(b.innerMs || 0);
      if (inner < n * 1000 * 0.8) {
        valid = false;
        note = ` · INVALID: the inner fetch took ${(inner / 1000).toFixed(1)}s, not ${n}s` +
          (b.innerStatus ? ` (inner status ${b.innerStatus})` : "") +
          (b.why ? ` (${b.why})` : "");
      }
    }
    if (mode === "mem" && returned && Number(b.heldMb || 0) < n) {
      valid = false;
      note = ` · INVALID: held ${b.heldMb}MB, not ${n}MB`;
    }

    const verdict = returned ? (valid ? "RETURNED" : "NOT MEASURED") : "DIED (" + (r.why || r.status) + ")";
    console.log(`${verdict} after ${(r.ms / 1000).toFixed(1)}s` +
      (r.firstByteAt ? ` · first byte ${(r.firstByteAt / 1000).toFixed(1)}s` : "") +
      (r.ticks ? ` · ${r.ticks} heartbeats` : "") +
      (mode === "burn" && b.slices ? ` · ${b.slices} slices` : "") +
      note);
    rows.push({ mode, n, ok: returned && valid, invalid: returned && !valid, ms: r.ms });
    // A mode that has already died will die at every larger step too, and each
    // costs its full wall-clock to prove. Stop that mode there. An INVALID row
    // stops it as well: every larger step would be invalid for the same reason,
    // and re-running it just prints the same non-answer more slowly.
    if (!returned || !valid) break;
  }
}

const of = (m) => rows.filter((r) => r.mode === m);
const last = (m) => of(m).filter((r) => r.ok).map((r) => r.n).pop() || 0;
const top = (m) => (m === "mem" ? MB : STEPS)[(m === "mem" ? MB : STEPS).length - 1];
const unit = (m) => (m === "mem" ? "MB" : "s");
// A mode that never produced a valid row measured NOTHING, and must not be
// given a verdict. Reporting `last(m)` of 0 as "stops at 0s" is how the first
// run printed a ceiling for a mode that had simply not run.
const measured = (m) => of(m).some((r) => r.ok);
const cutOff = (m) => of(m).some((r) => !r.ok && !r.invalid);   // genuinely died
const firstBad = (m) => (of(m).find((r) => !r.ok) || {}).n;

console.log("");
for (const m of MODES) {
  if (!measured(m) && !cutOff(m)) console.log(`  ${m.padEnd(6)} NOT MEASURED — see the row above`);
  else if (cutOff(m)) console.log(`  ${m.padEnd(6)} survived up to ${last(m)}${unit(m)}, cut off at ${firstBad(m)}${unit(m)}`);
  else console.log(`  ${m.padEnd(6)} survived up to ${last(m)}${unit(m)}`);
}

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
// EVERY VERDICT IS GATED ON THE MODE HAVING MEASURED SOMETHING. A mode whose
// rows were all invalid gets a sentence saying so and no ceiling — the
// alternative is what the first run did: print a confident diagnosis sourced
// from a request that never happened.
if (MODES.includes("burn")) {
  if (!measured("burn") && !cutOff("burn")) console.log(`  => CPU: NOT MEASURED. No verdict.`);
  else if (cutOff("burn")) {
    console.log(`  => THE WALL IS CPU: burning is cut off at ${firstBad("burn")}s while waiting survives ${waits}.`);
    console.log(`     limits.cpu_ms in wrangler.jsonc is the lever (Workers Paid allows up to 300000).`);
  } else console.log(`  => CPU IS NOT THE WALL at this level of work: burning survives ${top("burn")}s.`);
}
if (MODES.includes("mem")) {
  if (!measured("mem") && !cutOff("mem")) console.log(`  => MEMORY: NOT MEASURED. No verdict.`);
  else if (cutOff("mem")) {
    console.log(`  => MEMORY IS A CEILING, at somewhere over ${last("mem")}MB.`);
    console.log(`     NO CONFIG RAISES IT — the publish path has to stream the dist rather than`);
    console.log(`     buffer it as JSON plus base64. That is a real change, not a setting.`);
  } else console.log(`  => MEMORY IS NOT THE WALL up to ${top("mem")}MB held at once.`);
}
if (MODES.includes("sub")) {
  if (!measured("sub") && !cutOff("sub")) {
    console.log(`  => SUBREQUESTS: NOT MEASURED — the inner fetch did not wait, so nothing`);
    console.log(`     about holding one open was tested. No verdict.`);
  } else if (cutOff("sub")) {
    console.log(`  => THE WALL IS A SUBREQUEST: an outbound fetch stops being held at ${firstBad("sub")}s`);
    console.log(`     while the same wait on a timer survives ${waits}. A build's model`);
    console.log(`     calls and container build are exactly this shape.`);
  } else console.log(`  => A SUBREQUEST CAN BE HELD FOR ${top("sub")}s, so no single outbound wait is the wall.`);
}
// `subself` IS A DEMONSTRATION, NOT A CEILING. It exists to keep the 522
// reproducible, so the only reading worth printing is whether it still does
// what it did — and NOT MEASURED is its success condition, which is why it
// gets its own sentence rather than borrowing `sub`'s.
if (MODES.includes("subself")) {
  if (!measured("subself")) console.log(`  => SELF-CALL: refused, as expected — a Worker cannot fetch its own zone.`);
  else console.log(`  => SELF-CALL: it WAITED this time, up to ${last("subself")}s — the 522 is gone, so the comment in worker.js is stale.`);
}
// Only ever printed when everything really was measured and everything really
// survived, so a clean sweep does not end on a shrug — and an UNMEASURED sweep
// can never reach it and claim one.
if (MODES.every((m) => measured(m) && last(m) >= top(m))) {
  console.log(`  => NOTHING TESTED HERE IS THE WALL. Whatever ends a build is about what it`);
  console.log(`     DOES — the container, or a step with its own timeout.`);
}
