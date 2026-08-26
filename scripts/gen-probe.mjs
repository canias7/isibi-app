// DRIVE THE FIRE-AND-COLLECT PAIR AND WATCH WHAT THE CONTAINER SAYS.
//
// `container reach` proves the container can reach a provider. It does NOT
// prove the mechanism stage 2 rests on: `/model/start` takes a job, runs the
// call in the BACKGROUND, and `/model/result` hands the answer to a LATER,
// separate Worker invocation. Run 40 walked that whole path and came back
// `TimeoutError`, and every attempt to name the broken link since has been an
// inference off an error's name.
//
// ── WHAT IT MEASURES, AND WHY IT IS FREE ────────────────────────────────────
//
// PHASE 1 — fire and collect at once. The request names a model no provider
// has, so it is refused before a token is generated: no spend, and the STATUS
// is the measurement.
//
//   failed, status 404   the container's KEY WAS ACCEPTED and the model was not.
//                        Fire, background call, store and collect all work.
//   failed, status 401   the container has no usable key. That is a `retryHere`
//                        `here` on every build — the Worker re-runs the whole
//                        generation under a ten-minute cap — and it is exactly
//                        the shape run 40 died in.
//   failed, no status    no request left the container at all. Also `here`, and
//                        `kind` names which layer refused.
//   done                 impossible for this request; if it happens, the model
//                        id is no longer refused and this probe needs a new one.
//   unknown              the container lost the job between two calls SECONDS
//                        apart, which is the store or the instance, not idling.
//
// PHASE 2 — collect the SAME id again after an idle wait longer than
// `SiteBuildContainer`'s `sleepAfter`. A failed job holds no busy counter, so
// nothing is keeping the container awake — which is the honest test of whether
// an instance survives the gap between two checkpoints.
//
//   still failed         the instance survived. `unknown` on a real build is
//                        then NOT idle recycling and the hunt moves elsewhere.
//   unknown              the instance was recycled inside the window. That is
//                        one of exactly two shapes that send a resume down
//                        `here`, and the one a fired build cannot survive.
//
// COSTS NOTHING: no tokens, no build, no Neon project, no publish, no credits.
// Two authenticated GETs and one container spin-up.

import fs from "node:fs";
import { anonKeyFromFrontend } from "./anon-key.mjs";

const t0 = Date.now();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || anonKeyFromFrontend();
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
// The idle wait for phase 2. `SiteBuildContainer.sleepAfter` is "5m", so the
// default is past it with a margin — a wait SHORTER than the timeout measures
// nothing, and reading a survival there as proof would be the worst outcome.
const IDLE_MS = Number(process.env.PROBE_IDLE_MS || 7 * 60 * 1000);

const LOG_FILE = process.env.GEN_PROBE_LOG || "gen-probe.md";
const lines = ["# Fire-and-collect probe", "", "Started " + new Date().toISOString(), ""];
function log(msg) {
  const line = `[+${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(6)}s] ${msg}`;
  console.log(line);
  lines.push(line);
  fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}
function fail(msg) { log("FATAL: " + msg); process.exit(1); }
const desc = (v) => (v ? `set (${String(v).length} chars)` : "MISSING");

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
log(`step 0 — base=${BASE} email=${EMAIL} idle_wait=${(IDLE_MS / 60000).toFixed(1)}m service_key=${desc(SERVICE_KEY)}`);

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

const AUTH = { Authorization: `Bearer ${jwt}` };
async function ask(qs) {
  const r = await fetch(`${BASE}/api/site/genprobe${qs}`, { headers: AUTH, signal: AbortSignal.timeout(60000) });
  const raw = await r.text();
  let body = null; try { body = JSON.parse(raw); } catch { body = null; }
  return { status: r.status, body, raw };
}

// ── phase 1: fire ────────────────────────────────────────────────────────────
log("step 3 — firing a generation the provider will refuse (no tokens are generated)");
const start = await ask("");
if (!start.body) fail(`the route answered ${start.status} with something that is not JSON: ${start.raw.slice(0, 300)}`);
log(`step 3 — route ${start.status}, container ${start.body.containerStatus}, lane=${start.body.lane}, id=${start.body.id || "-"} in ${start.body.ms}ms`);
if (!start.body.id) {
  log("");
  log("VERDICT: THE CONTAINER WOULD NOT TAKE THE JOB.");
  log(`  ${JSON.stringify(start.body).slice(0, 400)}`);
  log("  So the fire itself is what breaks, and every fired build has been");
  log("  falling back to the synchronous path — which is stage 2 switched off.");
  log("");
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — nothing was charged`);
  process.exit(0);
}
const id = start.body.id;

// The refusal is milliseconds of work, but the store is written by a promise
// nobody awaited — so poll rather than reading once, or a `pending` here is
// scheduling rather than a finding.
let first = null;
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  first = await ask("?id=" + encodeURIComponent(id));
  if (!first.body) fail(`the result route answered ${first.status}: ${first.raw.slice(0, 300)}`);
  log(`step 4 — poll ${i + 1}: state=${first.body.state} status=${first.body.status ?? "-"} kind=${first.body.kind || "-"}`);
  if (first.body.state !== "pending") break;
}

log("");
const f = first.body;
// THE STATUS IS THE ANSWER, NOT ONE PARTICULAR NUMBER. The first draft branched
// on 404, and xAI answers an unknown model with 400 — so the run that PROVED the
// mechanism fell through every branch and printed "STILL FAILED AFTER 20
// SECONDS" about a job that settled in two. A verdict with no branch for the
// answer it got is the works-but-cannot-say-so disease inside the instrument
// built to cure it.
//
// What discriminates is not the number, it is WHOSE refusal it is: any status at
// all means the provider answered, which means the key was accepted and the
// request left the container. Only 401/403 say the credential itself was
// refused.
const spoke = f.state === "failed" && Number.isFinite(f.status) && f.status > 0;
if (spoke && (f.status === 401 || f.status === 403)) {
  log(`PHASE 1 VERDICT: THE CONTAINER'S KEY IS NOT USABLE — ${f.status}.`);
  log("  The request left the container and the provider refused the credential.");
  log("  Every real generation then fails the same way, `retryHere` reads it as");
  log("  money-not-spent, and the resume re-runs the WHOLE generation in the");
  log("  Worker under a ten-minute cap.");
} else if (spoke) {
  log(`PHASE 1 VERDICT: THE WHOLE MECHANISM WORKS — the provider answered ${f.status}.`);
  log("  A status is the PROVIDER's own answer, so the container's key was");
  log("  accepted and only the model name was refused. The fire landed, the");
  log("  background call went out over the network, the answer was stored, and a");
  log("  separate later call collected it.");
  log("  So `here / no-request` is not reachable on a healthy container: a");
  log("  failure that reaches the provider carries a status, and `retryHere`");
  log("  refuses to retry one.");
} else if (f.state === "failed") {
  log("PHASE 1 VERDICT: NO REQUEST LEFT THE CONTAINER AT ALL.");
  log(`  kind=${f.kind || "-"} message=${String(f.message || "").slice(0, 200)}`);
  log("  No provider answered, so this is the container's own side: a missing");
  log("  key, a refused egress, or a throw before the fetch. That is exactly");
  log("  `retryHere` -> `here / no-request` — every build falls back to a");
  log("  ten-minute generation in the Worker.");
} else if (f.state === "unknown") {
  log("PHASE 1 VERDICT: THE CONTAINER LOST THE JOB WITHIN SECONDS.");
  log("  Not idling — nothing had time to go idle. The store or the instance is");
  log("  not surviving between two calls, which no resume cadence can fix.");
} else if (f.state === "done") {
  log("PHASE 1 VERDICT: THE PROBE'S MODEL ID IS NO LONGER REFUSED.");
  log("  Something answered where nothing should have. Pick a new id before");
  log("  reading anything else here — this run may have spent money.");
} else if (f.state === "pending") {
  log("PHASE 1 VERDICT: STILL PENDING AFTER 20 SECONDS.");
  log("  A refused request should settle in milliseconds, so the background call");
  log("  is not running or not settling. That is the fire's own half.");
} else {
  // THE HONEST CATCH-ALL, and it can never lie: it names the answer rather than
  // describing one. Every branch above claims something; this one only reports.
  log(`PHASE 1 VERDICT: AN ANSWER THIS PROBE HAS NO BRANCH FOR — state=${String(f.state)}.`);
  log(`  ${JSON.stringify(f).slice(0, 400)}`);
}

// ── phase 2: does the instance survive an idle window ───────────────────────
if (f.state === "unknown" || !IDLE_MS) {
  log("");
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — nothing was charged`);
  process.exit(0);
}
log("");
log(`step 5 — waiting ${(IDLE_MS / 60000).toFixed(1)} minutes with NOTHING touching the container.`);
log("  A failed job holds no busy counter, so this is the honest test of whether");
log("  an instance survives the gap between two checkpoints of a real build.");
await new Promise((r) => setTimeout(r, IDLE_MS));

const later = await ask("?id=" + encodeURIComponent(id));
if (!later.body) fail(`the result route answered ${later.status}: ${later.raw.slice(0, 300)}`);
log(`step 5 — after the wait: state=${later.body.state} status=${later.body.status ?? "-"}`);
log("");
if (later.body.state === "unknown") {
  log("PHASE 2 VERDICT: THE INSTANCE WAS RECYCLED INSIDE THE IDLE WINDOW.");
  log("  The job is gone, and its TTL is 45 minutes, so this is the container");
  log("  being stopped rather than the entry ageing out. On a real build that is");
  log("  `unknown` -> `here` -> the Worker re-runs a ten-minute generation under");
  log("  a ten-minute cap. The resume's polling is what keeps it awake, so the");
  log("  gap between looks and `sleepAfter` is the pair to look at next.");
} else if (later.body.state === f.state) {
  log("PHASE 2 VERDICT: THE INSTANCE SURVIVED THE IDLE WINDOW.");
  log("  The same answer came back, so idle recycling is NOT what sends a resume");
  log("  down `here`. The remaining shape is the container failing to make the");
  log("  call — which phase 1 above reports directly.");
} else {
  log(`PHASE 2 VERDICT: THE ANSWER CHANGED — ${f.state} -> ${later.body.state}.`);
  log("  A settled job must never move. Read the two states above before drawing");
  log("  anything from the rest of this run.");
}

log("");
log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — nothing was charged`);
