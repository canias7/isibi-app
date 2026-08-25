// CAN A CLOUDFLARE CONTAINER REACH A MODEL PROVIDER?
//
// The one fact the whole container-generation change rests on, and it has never
// been observed. Every check of `/model` so far refuses BY NAME before a request
// is made — deliberately, so it can run on every push without spending — which
// means the first real build against it was also the first evidence.
//
// THAT COST TWO BUILDS AND ANSWERED NOTHING. Run 38 (`northgroup-4`) died
// mid-generation at the whole-build deadline with no record of which side held
// the call. Run 39 (`northgroup-5`) was bought specifically to read the flag
// added after run 38, and the flag rode on a return value that a thrown build
// never produces, so it died with the build too. ~13 minutes and ~6 credits
// each, twice, to read one boolean.
//
// ── WHY THIS IS FREE, AND WHY A 401 IS THE PROOF ────────────────────────────
//
// The container sends a request with NO CREDENTIAL, so a provider answers 401
// before it reads a token: nothing is generated and nothing is billed. And
// **any HTTP status at all is the answer** — DNS resolved, TCP connected, TLS
// negotiated and HTTP completed, which is every layer a real model call needs.
// Blocked egress cannot produce a status; it produces ENOTFOUND, ECONNREFUSED
// or a timeout instead.
//
// So the verdict is `reached`, never `ok`. Reading a 401 as a failure would
// report a working network as broken and send the next person to fix egress
// that is fine — the inversion this exists to avoid.
//
// ── WHAT EACH OUTCOME MEANS ─────────────────────────────────────────────────
//
//   xai reached      → generation really can run on the side with no clock.
//                      Stage 2 (moving the WAIT) is worth building.
//   xai NOT reached  → the container can never make the call. `retryHere` is
//                      correctly falling back to the Worker on every build, and
//                      stage 2 as designed is building on sand.
//   container down   → says so in its own words rather than borrowing the
//                      wording of "the container has no egress". That confusion
//                      is the entire reason this probe exists.
//
// COSTS NOTHING: no model call, no build, no Neon project, no publish, no
// credits. One container spin-up (~2.5s cold, 176ms warm, measured) and two
// credential-free GETs.

import fs from "node:fs";
import { anonKeyFromFrontend } from "./anon-key.mjs";

const t0 = Date.now();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
// Read out of the frontend rather than kept as a fourth copy — see the long note
// in container-hold-probe.mjs. `secrets.SUPABASE_ANON_KEY` has never existed in
// this repo and comes through empty in all five workflows that list it.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || anonKeyFromFrontend();
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();

const LOG_FILE = process.env.REACH_LOG || "reach-probe.md";
const lines = ["# Container egress probe", "", "Started " + new Date().toISOString(), ""];
function log(msg) {
  const line = `[+${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(6)}s] ${msg}`;
  console.log(line);
  lines.push(line);
  fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}
function fail(msg) { log("FATAL: " + msg); process.exit(1); }
// A secret is described by its length and never shown.
const desc = (v) => (v ? `set (${String(v).length} chars)` : "MISSING");

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
log(`step 0 — base=${BASE} email=${EMAIL} service_key=${desc(SERVICE_KEY)} anon_key=${desc(ANON_KEY)}`);

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

// ── ask the container ────────────────────────────────────────────────────────
log("step 3 — asking the build container what it can reach (no credential is sent to either provider)");
let r, body;
try {
  r = await fetch(`${BASE}/api/site/reach`, {
    headers: { Authorization: `Bearer ${jwt}` },
    // Generous: a COLD container start is ~2.5s and the probe itself bounds each
    // host at 10s, so anything past this is the platform rather than the network.
    signal: AbortSignal.timeout(120000),
  });
  const raw = await r.text();
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body) fail(`the route answered ${r.status} with something that is not JSON: ${raw.slice(0, 300)}`);
} catch (e) {
  fail(`could not reach ${BASE}/api/site/reach: ${String((e && e.message) || e)}`);
}

log(`step 3 — route answered ${r.status} in ${body.ms}ms (container status ${body.containerStatus})`);
if (!Array.isArray(body.results)) {
  fail(`the container did not report any results — ${JSON.stringify(body).slice(0, 300)}`);
}

// ── the verdict ──────────────────────────────────────────────────────────────
let xai = null;
for (const res of body.results) {
  if (res.reached) log(`  ${res.name.padEnd(10)} REACHED — HTTP ${res.status} in ${res.ms}ms`);
  else log(`  ${res.name.padEnd(10)} NOT REACHED — ${res.code} (${res.message}) after ${res.ms}ms`);
  if (res.name === "xai") xai = res;
}

log("");
if (!xai) {
  fail("the probe reported no result for xAI at all — the target list changed and this verdict is watching nothing");
}
if (xai.reached) {
  log("VERDICT: a Cloudflare container CAN reach api.x.ai.");
  log("  Generation really can run on the side with no clock, so moving the WAIT");
  log("  there is worth building. HTTP " + xai.status + " is the expected answer:");
  log("  the request carried no key, so the provider refused it before reading a");
  log("  token. What it proves is the path, not the credential.");
} else {
  log("VERDICT: a Cloudflare container CANNOT reach api.x.ai.");
  log("  " + xai.code + " — no HTTP response came back at all, so this is the");
  log("  network rather than an auth refusal. `retryHere` has been correctly");
  log("  falling back to the Worker on every build, and stage 2 as designed");
  log("  cannot work: the container would hold a call it can never make.");
  // NOT A FAILED RUN. A definitive negative is a RESULT — the probe did its job
  // and the answer is no. Exiting non-zero would make a workflow that runs on
  // every push permanently red, and a red check everybody knows about is a check
  // nobody reads, which this repo has already recorded as an incident.
}
log("");
log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — nothing was charged`);
