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
import { anonKeyFromFrontend } from "./anon-key.mjs";

const t0 = Date.now();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";

// THE ANON KEY IS READ OUT OF THE FRONTEND, and there is no fourth copy of it.
//
// `secrets.SUPABASE_ANON_KEY` HAS NEVER EXISTED in this repo — the first run of
// this probe died on it in 0.0s, exactly as `build-as-owner`'s first run did,
// and that script's own comment records it. Five workflows list the name and it
// comes through EMPTY in all five.
//
// It is not a secret to be found: the anon key is the PUBLIC client key and
// `public/auth.js` sends it on every page load, so reading it from there is
// reading our own frontend rather than weakening anything. Two scripts already
// carry it as a hardcoded literal; a third copy is how a rotation leaves one of
// them sending a dead key with nothing to say so. The extraction lives in
// `scripts/anon-key.mjs` because a test that RESTATES it asserts its own copy —
// measured, that mutant survived — where an importable one can be driven.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || anonKeyFromFrontend();
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();

// HOW LONG THE CONTAINER IS ASKED TO WORK, and how long we stay away.
//
// The wait must exceed `sleepAfter` (5m) by enough for the alarm to have fired
// — the library schedules one at most three minutes out and again at
// `sleepAfterMs` — which seven minutes satisfied. IT IS 9.5 NOW, AND THE GAP IS
// THE FINDING: run 41's two container instances died at IDENTICAL ages, 7.1 to
// 8.4 minutes, minutes after an image deploy — and both of this repo's survival
// probes had stopped looking JUST short of that window (`gen probe`'s idle
// check last looked at +425.8s = 7.1m; this one's single look landed at 7.0m).
// A probe that stops looking at the near edge of the death window proves
// survival of nothing. 9.5 minutes is past the far edge with margin.
//
// The hold is longer still — 2.5 minutes of hold left when the look lands, so a
// slow runner cannot turn "still working" into a false NOT PROVEN, and "not
// busy" at the look cannot mean "the work finished". It means the instance is
// gone: culled by the platform, or culled and the SIGTERM drain in
// `build-server.mjs` failed to hold it — the log now says which, since
// observability retains the container's own last words.
const HOLD_MS = 12 * 60 * 1000;
const WAIT_MS = 9.5 * 60 * 1000;

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

// ── step 2b: CAN THE CONTAINER REACH THE MODEL PROVIDERS? ────────────────────
//
// The second thing that decides whether generation can move into the container,
// and the image makes zero outbound provider calls today — measured, `fetch(`
// appears in `builder/*.mjs` exactly once and it is a loopback. So this has
// never been observed on Cloudflare's network, only documented.
//
// A 401 IS THE PROOF, AND THAT IS WHAT MAKES IT FREE. The container sends no
// credentials, so an answer at all can only mean DNS resolved, TLS completed,
// the request was routed and a live server replied. Nothing spent, no key in
// the image to leak.
//
// FOLDED INTO THIS RUN RATHER THAN GIVEN ITS OWN WORKFLOW. It takes two seconds
// beside a seven-minute wait, and a standing check is worth more than a one-off:
// container networking is Cloudflare's to change, and the way that would
// otherwise surface is a build failing at a model call for no stated reason.
//
// BEFORE THE IDLE CHECK, deliberately. This warms the same lane, so doing it
// after would leave the pre-check reading a container this probe had just
// touched — and the pre-check's whole job is to establish the lane was quiet
// before we started.
const eg = await fetch(`${BASE}/api/_egress`, { headers: auth }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
log(`step 2b — container egress: ${JSON.stringify(eg)}`);
let egress = null;
try { egress = JSON.parse(eg.body); } catch { /* reported in the verdict */ }
const reached = egress ? ["anthropic", "xai"].filter((k) => egress[k] && egress[k].reached === true) : [];
if (egress) {
  for (const k of ["anthropic", "xai"]) {
    const v = egress[k] || {};
    log(`step 2b — ${k}: ${v.reached === true ? "REACHED, answered " + v.status : "NOT reached (" + (v.kind || "?") + ": " + (v.why || "?") + ")"} in ${v.ms}ms`);
  }
} else {
  // NOT the same as "cannot reach". The route or the container answered
  // something unreadable, which is a fault here rather than a verdict about
  // Cloudflare's network — and collapsing the two is how a working thing gets
  // reported as broken.
  log("step 2b — the egress probe gave no readable answer; that is a fault in the probe, not a verdict");
}

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

// ── step 6: one look, and then ASK THE HOOK WHAT IT DID ─────────────────────
const after = await fetch(`${BASE}/api/_hold?check=1`, { headers: auth }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
const waited = ((Date.now() - t0) / 1000).toFixed(0);
log(`step 6 — after ${waited}s total, the lane answered: ${JSON.stringify(after)}`);

// THE HOOK'S OWN RECORD, which is the difference between a verdict and a
// diagnosis. The first live run reported NOT PROVEN and could not say which of
// four things had happened; this is read from Durable Object storage, which
// survives the container being stopped, so it answers even when the container
// does not.
//
// READ AFTER the check, deliberately: the check is the thing that would restart
// a stopped container, and reading the record first would leave a reader unable
// to tell a hook that ran before our check from one that ran because of it.
const hook = await fetch(`${BASE}/api/_hold?log=1`, { headers: auth }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
log(`step 6 — the hook's own record: ${JSON.stringify(hook)}`);

let busy = null, sinceMs = null;
try { const b = JSON.parse(after.body); busy = b.busy; sinceMs = b.sinceMs; } catch { /* reported below */ }

// WHAT THE HOOK SAYS, turned into the sentence a reader can act on. Each of
// these wants a completely different next step, and collapsing them into "NOT
// PROVEN" is what made the first run cost a source audit instead of a glance.
const rec = hook && hook.last;
function whyLine(heldOk) {
  if (!rec) {
    return "        THE HOOK NEVER RAN. No record at all, so `onActivityExpired` was not called in this\n" +
           "        window — the container was stopped by something other than the idle timeout, or the\n" +
           "        alarm never fired. Neither is about the override.";
  }
  const ago = Math.round((Date.now() - Number(rec.at)) / 1000);
  const head = `        THE HOOK RAN ${ago}s ago and decided "${rec.why}" (hold=${rec.hold}).\n`;
  if (rec.why === "idle") {
    return head +
      "        It asked, and the container really was IDLE — so the hold never reached it. That is a\n" +
      "        fault in the PROBE's plumbing, not in the override: an abandoned fetch in a Worker is\n" +
      "        cancelled when the response returns. Check the hold is held on ctx.waitUntil.";
  }
  if (rec.why === "no-answer" || rec.why === "unreadable") {
    return head +
      "        It could not read the container, so the fail-closed default fired and stopped a\n" +
      "        container that may well have been working. That is `containerFetch` failing INSIDE the\n" +
      "        alarm — the one place it is never exercised in a unit test.";
  }
  if (rec.why === "stuck") {
    return head + "        It judged the container wedged past MAX_BUSY_HOLD_MS and stopped it deliberately.";
  }
  // THE SAME RECORD MEANS OPPOSITE THINGS ON THE TWO VERDICTS, and the first
  // draft had one sentence for both — so the run that PROVED this printed "so
  // something else stopped it" directly under "the container was still
  // working". A diagnostic that contradicts the verdict above it is worse than
  // none, because the reader has to decide which half to believe.
  if (heldOk) {
    // THE TIMING IS THE EVIDENCE, and repeating the verdict is not. The hook's
    // own `sinceMs` says WHEN the alarm fired relative to the hold starting: at
    // `sleepAfter` it is the idle timeout doing exactly what it is for, and the
    // whole claim rests on that rather than on the container merely being up.
    const at = Number(rec.sinceMs);
    const mins = Number.isFinite(at) ? (at / 60000).toFixed(1) : "?";
    return head +
      `        The alarm fired ${at}ms into the hold — ${mins} minutes, i.e. the sleepAfter window itself.\n` +
      "        So containerFetch worked from inside the alarm, the decision was made on a real reading\n" +
      "        of a real container, and the hold is what kept it. Not luck and not a missed alarm.";
  }
  return head + "        It HELD the container. So something else stopped it, and the override is not the fault.";
}

// THE EGRESS VERDICT IS ITS OWN, and does not decide this run's exit status.
// The two questions are independent: the container can survive its idle timeout
// whether or not it can reach a provider, and reporting one as the other would
// make a green run about the wrong thing. It is stated loudly either way,
// because "generation can move into the container" needs BOTH and a reader
// looking at a PROVEN hold should not have to infer the other half.
log("");
if (reached.length === 2) {
  log("EGRESS: PROVEN — the container reached BOTH providers from Cloudflare's network, with no");
  log("        credentials sent. The refusal status IS the proof: only DNS, TLS, routing and a live");
  log("        server can produce one.");
} else if (egress && reached.length === 1) {
  log(`EGRESS: PARTIAL — reached ${reached[0]} and not the other. Generation could move for one provider`);
  log("        and not the one every build uses by default, which is not a state to build on.");
} else if (egress) {
  log("EGRESS: BLOCKED — the container reached NEITHER provider. Generation cannot move into the");
  log("        container until this is solved; the reasons above name which failure it was.");
} else {
  log("EGRESS: UNKNOWN — no readable answer, so this run says nothing about it either way.");
}

log("");
if (busy === true) {
  log(`RESULT: PROVEN — the container was still working ${Math.round(Number(sinceMs) / 1000)}s in, ` +
      "well past its five-minute idle timeout, with nothing connected to it for the whole window.");
  log("        onActivityExpired asked, was told the container was busy, and held it.");
  log("        Fire-and-forget is viable: generation can move into the container.");
  log(whyLine(true));
  process.exit(0);
}
if (busy === false) {
  log("RESULT: NOT PROVEN — the lane answered, and it is IDLE. The hold was still supposed to be");
  log("        running, so the container did not survive the silent window.");
  log(whyLine());
  process.exit(1);
}
log("RESULT: INCONCLUSIVE — the lane did not give a readable answer, so this run says nothing");
log("        either way. That is a fault in the probe or the route, not a verdict about the");
log("        container. Raw: " + JSON.stringify(after).slice(0, 300));
log(whyLine());
process.exit(1);
