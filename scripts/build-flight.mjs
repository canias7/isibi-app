// DID THE FIRED BUILD'S RESUME EVER RUN?
//
// Run 40 fired correctly — `202 after 204.0s` with a job id, which is stage 2
// working — and then produced no site, and NOTHING could say why. Three failures
// with completely different fixes produce exactly the same three observations:
//
//   the delayed message was never delivered
//   the container lost the work and the fallback failed
//   a resume looked, lost its claim, and kept losing it
//
// On all three the site serves the stand-in (which it also does while a build is
// working perfectly), the trace goes quiet, and the result route answers a bare
// `pending`. An hour of watching separated none of them.
//
// ── WHAT THIS READS, AND WHY THAT DECIDES IT ────────────────────────────────
//
// The resume record lives at `jobs/<id>.resume.json` and carries the count of
// looks it has really had. `flightOf` puts that beside the count the SCHEDULE is
// due, derived from the same two constants that do the scheduling. Those two
// numbers are the whole diagnosis:
//
//   looks 0, due 0    too early — the first look is `RESUME_FIRST_SECONDS` away.
//   looks 0, due N>0  NO RESUME EVER RAN. The record is here, so the fire stored
//                     it; what did not happen is the delivery of a DELAYED
//                     message, and nothing before stage 2 ever exercised one.
//   looks ≈ due       the resume is running; the generation is still going.
//   looks << due      looks are arriving and losing their claim, or failing to
//                     schedule the next one.
//
// ── WHY THIS IS FREE ────────────────────────────────────────────────────────
//
// One authenticated GET against a route that reads two R2 keys. No model call,
// no container, no build, no Neon project, no publish, nothing billed. It is the
// instrument that should have existed before run 40 was bought.
//
// IT CONSUMES A FINISHED RESULT, and that is the one thing to know before
// pointing it at a live job. `GET /api/site/build/<job>` deletes the result on
// read — deliberately, because an answer has reached its owner — so running this
// against a build somebody is still polling for takes their answer. Point it at
// an abandoned job, which is what it is for.

import fs from "node:fs";
import { anonKeyFromFrontend } from "./anon-key.mjs";

const t0 = Date.now();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
// Read out of the frontend rather than kept as a fourth copy — `secrets.SUPABASE_ANON_KEY`
// has never existed in this repo and comes through empty in every workflow that lists it.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || anonKeyFromFrontend();
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const JOB = String(process.env.PROBE_JOB || "").trim();
// AND WHY THE CONTAINER STOPPED, which is a different question about the same
// dead build and the only record that survives the container itself. Run 41 lost
// two generations: the container answered `pending` for four minutes and then
// answered `unknown`, and nothing anywhere could say which of five things
// stopped it. `onActivityExpired` writes its decision to Durable Object storage,
// which outlives the container by design — see `builder/container-hold.mjs` for
// the five reasons and why each wants a different response.
const SLUG = String(process.env.PROBE_SLUG || "").trim();

const LOG_FILE = process.env.FLIGHT_LOG || "flight-probe.md";
const lines = ["# Fired-build flight probe", "", "Started " + new Date().toISOString(), ""];
function log(msg) {
  const line = `[+${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(6)}s] ${msg}`;
  console.log(line);
  lines.push(line);
  fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}
function fail(msg) { log("FATAL: " + msg); process.exit(1); }
// A secret is described by its length and never shown.
const desc = (v) => (v ? `set (${String(v).length} chars)` : "MISSING");

// A JOB ID IS 32 HEX AND IS CHECKED HERE, not left to the route. An unset or
// mistyped one answers 404 there, which reads exactly like "that build has no
// record" — the false negative this probe exists to avoid producing.
if (!JOB && !SLUG) fail("neither PROBE_JOB nor PROBE_SLUG is set — nothing to look up");
if (JOB && !/^[0-9a-f]{32}$/.test(JOB)) fail(`PROBE_JOB is not a job id (32 hex): ${JOB.slice(0, 40)}`);
if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
log(`step 0 — base=${BASE} job=${JOB || "-"} slug=${SLUG || "-"} email=${EMAIL} service_key=${desc(SERVICE_KEY)} anon_key=${desc(ANON_KEY)}`);

// ── sign in as the owner (admin magic link; no password anywhere) ────────────
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }),
});
const glBody = await gl.json().catch(() => ({}));
const tokenHash = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
log(`step 1 — generate_link answered ${gl.status}; token_hash ${desc(tokenHash)}`);
if (!gl.ok || !tokenHash) fail("could not generate a sign-in link: " + JSON.stringify(glBody).slice(0, 300));

const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
});
const session = await vr.json().catch(() => ({}));
const jwt = session.access_token;
log(`step 2 — verify answered ${vr.status}; access_token ${desc(jwt)}`);
if (!vr.ok || !jwt) fail("could not open a session: " + JSON.stringify(session).slice(0, 300));

// ── why did the container stop? ──────────────────────────────────────────────
//
// FIRST, because it is the pure read: the job lookup below is DELETE-ON-READ and
// a failure there must not cost this answer too. Runs on its own gate, so a
// slug-only probe is a complete run.
if (SLUG) {
  const hl = await fetch(`${BASE}/api/_hold?log=1&slug=${encodeURIComponent(SLUG)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(30000),
  }).then(async (x) => ({ status: x.status, body: await x.text() })).catch((e) => ({ status: 0, body: String((e && e.message) || e) }));
  log(`step 2c — the hook's record for ${SLUG}: ${hl.status} ${String(hl.body).slice(0, 400)}`);
  let rec = null;
  try { rec = JSON.parse(hl.body); } catch { rec = null; }
  const last = rec && rec.last;

  // ── IS THIS RECORD EVEN ABOUT THE BUILD BEING ASKED ABOUT? ────────────────
  //
  // `lastExpiry` is the LAST one, and a lane is a SLUG — so a slug reused by two
  // builds keeps only the newer record, and a lane whose latest build never
  // expired keeps the OLDER one. The first run of this probe read a record from
  // 2026-08-25T20:07 for `northgroup-5` and narrated it as though it described
  // run 41, fourteen hours later: the disease this whole probe exists to end,
  // arriving inside the cure. `gen probe` printed "STILL FAILED" about a job
  // that had settled, for exactly this reason.
  //
  // PROBE_SINCE is when the build being asked about started — an ISO time or
  // epoch ms. Without it the record is REPORTED and no verdict is drawn, because
  // "we do not know whether this is about your build" is the honest answer and a
  // confident wrong one sends the next session at the wrong layer.
  const sinceRaw = String(process.env.PROBE_SINCE || "").trim();
  const since = sinceRaw ? (Number.isFinite(Number(sinceRaw)) ? Number(sinceRaw) : Date.parse(sinceRaw)) : NaN;
  const at = last && Number.isFinite(Number(last.at)) ? Number(last.at) : NaN;
  const stale = Number.isFinite(since) && Number.isFinite(at) && at < since;

  log("");
  if (last && Number.isFinite(since) && !Number.isFinite(at)) {
    log("HOOK RECORD: present but undated — it cannot be placed against your build.");
    log("  " + JSON.stringify(last));
  } else if (stale) {
    // A RECORD OLDER THAN THE BUILD IS THE SAME ANSWER AS NO RECORD AT ALL, and
    // it is a real one: the hook was NOT called for this lane while that build
    // ran. So the idle timer is not what stopped it.
    const oldBy = ((since - at) / 60000).toFixed(1);
    log(`HOOK RECORD: STALE — the last expiry for this lane was ${oldBy} minutes BEFORE the build you are asking about.`);
    log(`  (why=${last.why} at ${new Date(at).toISOString()}, build started ${new Date(since).toISOString()})`);
    log("");
    log("VERDICT: `onActivityExpired` was NEVER CALLED for this lane while that");
    log("  build ran, so the idle timer is not what stopped its container. What");
    log("  is left is Cloudflare reclaiming the instance, or the Node process");
    log("  exiting — a crash, an OOM, or a platform lifetime cap. None of those");
    log("  is reachable from here; the container's own stderr is where they live.");
  } else if (hl.status !== 200 || !rec || rec.ok !== true) {
    log("HOOK RECORD: COULD NOT ASK. That is a fault in this probe or the route,");
    log("  never a verdict about the container — do not read it as one.");
  } else if (!last) {
    // THE HOOK NEVER RAN. Which is itself an answer, and the one that rules the
    // hold mechanism out entirely: the container was stopped by something that
    // never consulted us — Cloudflare reclaiming the instance, or the process
    // exiting on its own.
    log("HOOK RECORD: NONE — `onActivityExpired` was never called for this lane.");
    log("  So the idle timer is NOT what stopped that container. What is left is");
    log("  Cloudflare reclaiming the instance, or the Node process exiting (a");
    log("  crash or an OOM). Neither is reachable from here; the container's own");
    log("  stderr is where that lives.");
  } else {
    const ago = Number.isFinite(at) ? ((Date.now() - at) / 60000).toFixed(1) + "m ago" : "at ?";
    log(`HOOK RECORD: why=${last.why} hold=${last.hold} busy=${last.busy} jobs=${last.jobs} sinceMs=${last.sinceMs} (${ago})`);
    log("");
    if (!Number.isFinite(since)) {
      // NOT DATED AGAINST ANYTHING. Every verdict below assumes this record is
      // about the build you are asking about, and only PROBE_SINCE can say so.
      log("  (PROBE_SINCE is not set, so nothing places this record against a particular");
      log("   build. Read the verdict below as being about the LAST expiry on this lane,");
      log("   whenever that was.)");
      log("");
    }
    // FIVE REASONS, FIVE DIFFERENT FIXES — the whole point of keeping them
    // apart in `holdDecision` rather than collapsing them to a boolean.
    if (last.why === "busy") {
      log("VERDICT: THE HOOK HELD IT. The hold mechanism did its job, so whatever");
      log("  stopped that container did not go through us. Same shortlist as the");
      log("  no-record case: eviction, or the process exiting.");
    } else if (last.why === "no-answer") {
      log("VERDICT: THE HOOK STOPPED A CONTAINER IT COULD NOT REACH.");
      log("  `containerFetch` to /busy failed or timed out inside the alarm and");
      log("  `holdDecision` fails CLOSED, so a container that was mid-generation");
      log("  was stopped. That is a silent kill of live work, and the fix is in");
      log("  `holdDecision` — the trade it makes is stated in its own source.");
    } else if (last.why === "idle") {
      log("VERDICT: THE CONTAINER SAID IT WAS IDLE WHILE A GENERATION WAS RUNNING.");
      log("  The busy counter is what `oneAtATime` holds for exactly this, so it");
      log("  was released early — a real bug in the container, not in the hook.");
    } else if (last.why === "unreadable") {
      log("VERDICT: VERSION SKEW. The container answered /busy in a shape the");
      log("  Worker does not understand, so it could not be capped and was");
      log("  stopped. A deploy problem rather than a wedge.");
    } else if (last.why === "stuck") {
      log("VERDICT: HELD PAST MAX_BUSY_HOLD_MS and then stopped. Re-measure that");
      log("  bound against how long a generation really takes.");
    } else {
      // REPORTED RATHER THAN NARRATED. An unanticipated reason must never be
      // described by a branch written for something else — `gen probe` printed
      // "STILL FAILED" about a job that had settled, for exactly that reason.
      log("VERDICT: an outcome none of these branches knows: " + JSON.stringify(last));
    }
  }
  log("");
}

if (!JOB) {
  log("PROBE_JOB is not set, so there is no stored result to collect. Done.");
  process.exit(0);
}

// ── ask the route ────────────────────────────────────────────────────────────
let r, raw, body;
try {
  r = await fetch(`${BASE}/api/site/build/${JOB}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(30000),
  });
  raw = await r.text();
  try { body = JSON.parse(raw); } catch { body = null; }
} catch (e) {
  fail(`could not reach ${BASE}/api/site/build/${JOB}: ${String((e && e.message) || e)}`);
}
log(`step 3 — the route answered ${r.status}`);
if (!body) fail(`the route answered ${r.status} with something that is not JSON: ${String(raw).slice(0, 300)}`);

// ── the verdict ──────────────────────────────────────────────────────────────
log("");
if (r.status === 200) {
  // The resume ran to a terminal outcome and wrote a result. Whatever it says,
  // the mechanism worked: a second invocation picked the build up.
  log("VERDICT: the resume RAN and finished. Stage 2's second half works.");
  log(`  page=${body.page} ok=${body.ok} stage=${body.stage} resumed=${body.resumed || "-"}`);
  if (body.error) log(`  error=${String(body.error).slice(0, 200)}`);
  log("  (reading this consumed the stored result — it is delete-on-read.)");
} else if (r.status === 404) {
  // Not "no such build": the route answers 404 for a malformed id AND for a
  // result owned by somebody else. The id was shape-checked above, so this is
  // ownership — or a job this account never started.
  log("VERDICT: NOT THIS ACCOUNT'S BUILD, or no such job.");
  log("  The id is well formed, so the route is refusing on ownership. Check");
  log("  OWNER_EMAIL is the account that made the build.");
} else if (r.status === 202 && body.flight) {
  const f = body.flight;
  const mins = (f.elapsedMs / 60000).toFixed(1);
  log(`IN FLIGHT — slug=${f.slug} fired ${mins} minutes ago, looks=${f.looks} due=${f.due}`);
  log("");
  if (f.due === 0) {
    log("VERDICT: TOO EARLY TO TELL. The first look is not due yet.");
  } else if (f.looks === 0) {
    log("VERDICT: NO RESUME EVER RAN — the delayed message was not delivered.");
    log(`  The record is here, so the fire stored it and the send did not throw.`);
    log(`  ${f.due} look(s) were due and ZERO happened, so nothing came back to`);
    log("  pick the build up. Delayed delivery (`send` with `delaySeconds`) is");
    log("  the one link in this path that nothing before stage 2 exercised —");
    log("  immediate delivery is proven, because the consumer ran the build.");
  } else if (f.looks < f.due - 1) {
    log("VERDICT: LOOKS ARE ARRIVING AND NOT PROGRESSING.");
    log(`  ${f.looks} of ${f.due} — so messages ARE delivered, and something`);
    log("  after that is losing them: a claim lost to a concurrent look, or a");
    log("  `send` for the next look that failed. Both say so in the log.");
  } else {
    log("VERDICT: THE RESUME IS RUNNING NORMALLY. The generation has not finished.");
  }
} else if (r.status === 202) {
  // No flight block: the resume record is gone (or was never written).
  log("VERDICT: NO RESUME RECORD, AND NO RESULT.");
  log("  Both halves are absent, which is three different things: the build was");
  log("  never fired (an ordinary queued build still running), or a terminal");
  log("  resume deleted the record and then failed to write its result, or the");
  log("  record was refused on ownership. The trace row for the slug is the next");
  log("  reader — `at=fired` with `done:false` is a build that fired and stopped.");
} else {
  log(`VERDICT: THE ROUTE COULD NOT ANSWER — ${r.status}.`);
  log(`  ${String(raw).slice(0, 300)}`);
}

log("");
log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — nothing was charged`);
