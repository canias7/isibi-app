// DOES A CLOUDFLARE CONTAINER SURVIVE ITS IDLE TIMEOUT WITH NOBODY CONNECTED?
//
// The one question about `SiteBuildContainer.onActivityExpired` that no unit
// test can reach, because what is under test is Cloudflare's lifecycle rather
// than our arithmetic. The rule, the busy counter and the wiring are all covered
// by `test/container-hold.test.mjs` and a 14-mutant sweep; this is the half that
// needs a real Durable Object, a real alarm and a real container.
//
// ── THE TRAP IN THE OBVIOUS DESIGN, AND IT WOULD HAVE MADE THIS VACUOUS ──────
//
// The natural probe holds a container, then POLLS every thirty seconds and
// reports when it disappears. That measures NOTHING, and the library's source
// says why: `containerFetch` calls `renewActivityTimeout()` on every proxied
// request. So each poll pushes `sleepAfterMs` to now+5m, `isActivityExpired()`
// never returns true, the alarm never calls the hook, and the container stays up
// whether or not the override exists. A green run would have proved that
// polling keeps a container alive — which nobody doubted.
//
// So this probe is SILENT during the window. One request to start the hold, then
// nothing at all for longer than the idle timeout, then exactly one look. The
// quiet is the instrument.
//
// ── WHAT EACH OUTCOME MEANS ─────────────────────────────────────────────────
//
//   busy: true   → the container was still working after the alarm must have
//                  fired. The override held it. PROVEN.
//   busy: false  → it was stopped and our `check` restarted it (containerFetch
//                  starts a stopped container), OR the hold ended early. The
//                  hold is far longer than the wait, so this means stopped.
//   no answer    → something else is wrong; reported as such rather than as a
//                  verdict either way.
//
// COSTS NO CREDITS. No model call, no build, no Neon project, no publish.

import fs from "node:fs";

const t0 = Date.now();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();

// HOW LONG THE CONTAINER IS ASKED TO WORK, and how long we stay away. The wait
// must exceed `sleepAfter` (5m) by enough for the alarm to have fired — the
// library schedules one at most three minutes out and again at `sleepAfterMs`,
// so seven minutes is comfortably past the first opportunity. The hold is longer
// still, so "not busy" at the end cannot mean "the work finished".
// The gap between them is a margin on BOTH sides: three minutes of hold left
// when the check lands, so a slow runner cannot turn "still working" into a
// false NOT PROVEN — and only three minutes of the lane held afterwards, since
// a probe lane a real build hashes into is one that build queues behind.
const HOLD_MS = 10 * 60 * 1000;
const WAIT_MS = 7 * 60 * 1000;

const LOG_FILE = process.env.HOLD_LOG || "hold-probe.md";
const lines = ["# Container hold probe", "", "Started " + new Date().toISOString(), ""];
function log(msg) {
  const line = `[+${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(7)}s] ${msg}`;
  console.log(line);
  lines.push(line);
  fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}
function fail(msg) { log("FATAL: " + msg); process.exit(1); }
// Redaction discipline, copied from build-as-owner: a secret is described by its
// length and never shown.
const desc = (v) => (v ? `set (${String(v).length} chars)` : "MISSING");

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
log(`step 0 — base=${BASE} email=${EMAIL} service_key=${desc(SERVICE_KEY)} anon_key=${desc(ANON_KEY)}`);
log(`step 0 — plan: hold ${HOLD_MS / 1000}s, stay silent ${WAIT_MS / 1000}s, then look ONCE`);

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
log(`step 2 — verify answered ${vr.status}; access_token ${desc(jwt)}; user=${(session.user && session.user.email) || "?"}`);
if (!vr.ok || !jwt) fail("could not open a session: " + JSON.stringify(session).slice(0, 300));
const auth = { Authorization: `Bearer ${jwt}` };

// ── step 3: is the lane idle before we start? ────────────────────────────────
//
// A lane that is ALREADY busy would make the whole run meaningless — a real
// build in it would keep the container alive on its own and this would report a
// success it did not earn. Checked rather than assumed.
const pre = await fetch(`${BASE}/api/_hold?check=1`, { headers: auth }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
log(`step 3 — lane before: ${JSON.stringify(pre)}`);
let preBusy = null;
try { preBusy = JSON.parse(pre.body).busy; } catch { /* not JSON — reported below */ }
if (preBusy === true) {
  fail("the probe lane is ALREADY busy — something else is using it, and a container kept alive " +
       "by real work would report a success this run did not earn");
}

// ── step 4: start the hold and WALK AWAY ─────────────────────────────────────
const start = await fetch(`${BASE}/api/_hold?ms=${HOLD_MS}`, { headers: auth }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
log(`step 4 — hold started: ${JSON.stringify(start)}`);
if (!start || start.ok !== true) fail("could not start the hold: " + JSON.stringify(start).slice(0, 300));

// ── step 5: SILENCE ──────────────────────────────────────────────────────────
//
// Not a poll. See the header: every request through `containerFetch` renews the
// activity timeout, so polling here would keep the container alive by itself and
// the run would prove nothing. Nothing touches the container until the wait is
// over.
log(`step 5 — going silent for ${WAIT_MS / 1000}s. NO requests to the container in this window, ` +
    "because each one would renew the very timeout under test.");
await new Promise((r) => setTimeout(r, WAIT_MS));

// ── step 6: one look ─────────────────────────────────────────────────────────
const after = await fetch(`${BASE}/api/_hold?check=1`, { headers: auth }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
const waited = ((Date.now() - t0) / 1000).toFixed(0);
log(`step 6 — after ${waited}s total, the lane answered: ${JSON.stringify(after)}`);

let busy = null, sinceMs = null;
try { const b = JSON.parse(after.body); busy = b.busy; sinceMs = b.sinceMs; } catch { /* reported below */ }

log("");
if (busy === true) {
  log(`RESULT: PROVEN — the container was still working ${Math.round(Number(sinceMs) / 1000)}s in, ` +
      "well past its five-minute idle timeout, with nothing connected to it for the whole window.");
  log("        onActivityExpired asked, was told the container was busy, and held it.");
  log("        Fire-and-forget is viable: generation can move into the container.");
  process.exit(0);
}
if (busy === false) {
  log("RESULT: NOT PROVEN — the lane answered, and it is IDLE. The hold was still supposed to be");
  log("        running, so the container was stopped during the silent window and this check");
  log("        restarted it. The override did not hold. Do NOT build fire-and-forget on this.");
  process.exit(1);
}
log("RESULT: INCONCLUSIVE — the lane did not give a readable answer, so this run says nothing");
log("        either way. That is a fault in the probe or the route, not a verdict about the");
log("        container. Raw: " + JSON.stringify(after).slice(0, 300));
process.exit(1);
