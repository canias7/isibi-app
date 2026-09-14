// FIRE ONE OF THE TWO CONTAINER PROBES AND READ IT BACK, AS THE OWNER.
//
// ── WHY THIS EXISTS AS A WORKFLOW AND NOT AS A CURL COMMAND (2026-09-14) ─────
//
// Owner: *"If workflow dispatch still returns 403, finish everything your
// access permits, then give me the exact workflow links, inputs, and order for
// the runs I must start. **Don't ask me to share secrets.**"*
//
// `POST /api/site/job-probe` is owner-gated by `authUser`, so running it by hand
// means holding a session token — which is the one thing the owner ruled out.
// The secret is already in GitHub Actions; this signs in with it, on the runner,
// and prints no credential. So the owner's half of the job is pressing a button.
//
// COSTS NOTHING. No model call, no credit, no row, no ledger, no publish. It
// occupies one build lane for the length of the probe and nothing else. That
// lane is the hold probe's own (`laneName("hold-probe")`, pinned in the route),
// so a probe can never starve a real customer's build.
//
// ── WHAT IS READABLE WHILE IT RUNS, AND WHAT ONLY ARRIVES AT THE END ─────────
//
// Found by reading the consumer rather than trusting the plan: `build-server.mjs`
// writes a job's `tail` — its last five stdout lines — ONLY in the `close`
// handler. A RUNNING record carries `{state, kind, startedAt, pid, touchedAt,
// deadlineAt}` and no tail at all. So:
//
//   while running   `state: "running"` past the elapsed time in question IS the
//                   duration answer. That is what the polling below reads.
//   at the end      `ms`, `code`, `signal`, `stopped` and the pulse tail arrive
//                   together, and the tail is where the wire probe's verdict is.
//
// A JOB THAT VANISHES IS NOT A JOB THAT FINISHED. `GET /job/<id>` answers 404
// for an id the service has never seen AND for one whose record went with a
// recycled container, so a 404 after a successful fire is reported as its own
// outcome and never as a completion. Cannot-tell must not read as an answer.
//
// ── AND IT SAYS WHICH DEPLOY ANSWERED ───────────────────────────────────────
//
// An instance started seconds after a deploy keeps the PREVIOUS image for its
// whole life, so a probe fired inside the roll window measures the image before
// its own — this repository has already paid for that once. `/api/site/runtime`
// answers the live Worker's deploy sha, so the run's own log says which code it
// measured instead of leaving it to be inferred from a timestamp.

import fs from "node:fs";
import { anonKeyFromFrontend } from "./anon-key.mjs";
// THE TWO READINGS ARE THE PROBE MODULE'S, NEVER RE-DERIVED HERE. It is the one
// that knows what shape `probeHold` and `probeWire` produced, and a second
// reader in this file is two lists of the same thing with a container between
// them — the drift being silent, because a wrong verdict still prints.
import { holdVerdict, wireVerdict } from "../builder/job-probe.mjs";

const t0 = Date.now();
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
// THE ANON KEY IS READ OUT OF THE FRONTEND — see container-hold-probe.mjs for
// the whole argument. It is the PUBLIC client key, `secrets.SUPABASE_ANON_KEY`
// has never existed in this repo, and a third hardcoded copy is how a rotation
// leaves one script sending a dead key with nothing to say so.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || anonKeyFromFrontend();
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();

const SHAPE = String(process.env.PROBE_SHAPE || "hold").trim();
// NON-NUMBERS FALL TO THE DEFAULT rather than being coerced: `Number("")` is 0,
// and a zero here would fire a probe that measures nothing and report it as a
// run. The route clamps again on its own side; this is the caller's half.
const num = (v, d) => { const n = Number(String(v || "").trim()); return Number.isFinite(n) && n > 0 ? n : d; };
const MS = num(process.env.PROBE_MS, SHAPE === "wire" ? 300_000 : 1_200_000);
const EVERY_MS = num(process.env.PROBE_EVERY_MS, 20_000);
const SITE = String(process.env.PROBE_SITE || "fretwork-1").trim();
const POLL_MS = 30_000;
// THE WIRE SHAPE HOLDS TWO CONNECTIONS IN TURN, NEVER RACED, so its wall-clock
// is about twice what it was asked for. Plus the fire, the sign-in and slack.
const BOUND_MS = (SHAPE === "wire" ? 2 * MS : MS) + 6 * 60_000;

const LOG_FILE = process.env.PROBE_LOG || "job-probe.md";
const lines = ["# Job probe — " + SHAPE, "", "Started " + new Date().toISOString(), ""];
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

// AN ANSWER THAT IS NOT JSON MUST NAME ITSELF (2026-09-14, the first real press).
// `fetch(...).then(r => r.json())` throws `Unexpected token '<'` and drops the
// status, the content-type and the body on the floor — the recorded "a failure
// that cannot name itself", in the instrument written to diagnose failures. It
// cost a whole round: the run said only that something was not valid JSON, when
// what it had was a 500 and Cloudflare's error page, which names the cause.
//
// The STATUS is the half that separates the three shapes this route can fail in:
// 401 is a token that did not take, 404 is a Worker without the route (a probe
// fired before its own deploy), and a 5xx with an HTML body is the Worker
// throwing — `handleRequest` has no try/catch, so an exception inside a route
// leaves Cloudflare to answer, and it answers in HTML.
async function readJson(res, what) {
  const status = res.status;
  const ctype = String(res.headers.get("content-type") || "");
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    // The snippet is the diagnosis and the body is a machine's, not a person's,
    // so 300 characters is plenty and an unbounded paste is noise.
    return { __notJson: true, what, status, ctype, snippet: text.slice(0, 300) };
  }
}
const notJson = (o) => !!(o && o.__notJson);
const sayNotJson = (o) =>
  `${o.what}: HTTP ${o.status} ${o.ctype || "(no content-type)"} — the body is not JSON: ${JSON.stringify(o.snippet)}`;

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
if (SHAPE !== "hold" && SHAPE !== "wire") fail(`PROBE_SHAPE ${JSON.stringify(SHAPE)} is neither "hold" nor "wire"`);

log(`step 0 — base=${BASE} shape=${SHAPE} ms=${MS} everyMs=${EVERY_MS} site=${SITE}`);
log(`step 0 — email=${EMAIL} service_key=${desc(SERVICE_KEY)} anon_key=${desc(ANON_KEY)}`);
log(`step 0 — bound: give up after ${(BOUND_MS / 60000).toFixed(1)} min, polling every ${POLL_MS / 1000}s`);

// ── step 1: sign in as the owner (admin magic link; no password anywhere) ────
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

// ── step 3: WHICH DEPLOY IS ANSWERING? ───────────────────────────────────────
//
// Booleans and a sha only — that route hands back no value and no canary list.
// `runner` matters as much as the sha: with it false an addon runs INLINE in the
// Worker, where the fourteen-minute ceiling still applies whatever the
// container's clock says, so a duration reading would be about the wrong layer.
const rt = await fetch(`${BASE}/api/site/runtime?slug=${encodeURIComponent(SITE)}`, { headers: auth })
  .then((r) => readJson(r, "GET /api/site/runtime")).catch((e) => ({ err: String(e) }));
if (notJson(rt)) log(`step 3 — ${sayNotJson(rt)}`);
log(`step 3 — runtime: ${JSON.stringify(rt)}`);
if (rt && rt.deploy) log(`step 3 — the live Worker is deploy ${rt.deploy}; runner=${rt.runner} async=${rt.async}`);
else log("step 3 — the runtime route gave no readable deploy sha; this run cannot say which image it measured");

// ── step 4: fire ─────────────────────────────────────────────────────────────
const fired = await fetch(`${BASE}/api/site/job-probe`, {
  method: "POST", headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ probe: SHAPE, ms: MS, everyMs: EVERY_MS }),
}).then((r) => readJson(r, "POST /api/site/job-probe")).catch((e) => ({ err: String(e) }));
log(`step 4 — fired: ${JSON.stringify(fired).slice(0, 600)}`);
if (notJson(fired)) fail(sayNotJson(fired));
if (!fired || fired.ok !== true || !fired.id) {
  fail("the probe did not start: " + JSON.stringify(fired).slice(0, 400));
}
const id = fired.id;

// ── step 5: poll until it ends, or until the bound ───────────────────────────
let last = null, ended = null, vanished = 0;
while (Date.now() - t0 < BOUND_MS) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  const rec = await fetch(`${BASE}/api/site/job-probe?id=${encodeURIComponent(id)}`, { headers: auth })
    .then(async (r) => ({ status: r.status, body: await readJson(r, "GET /api/site/job-probe?id=") }))
    .catch((e) => ({ status: 0, body: { err: String(e) } }));
  const j = rec.body || {};
  // A NON-JSON ANSWER MID-POLL IS A BLIP, NOT AN ENDING. Falling through would
  // set `ended` to a record with no `state` and report a job that is still
  // running as finished — the reading this instrument must never invent. It is
  // said rather than swallowed, and the loop simply asks again.
  if (notJson(j)) { log(`step 5 — ${sayNotJson(j)}; asking again`); continue; }
  if (rec.status === 404 || j.error === "no such job") {
    // NOT a completion. See the header: a record goes with a recycled container,
    // and reading that as "finished" is the one way this instrument can lie.
    vanished++;
    log(`step 5 — the service no longer has a record for this job (${vanished} in a row)`);
    if (vanished >= 2) { ended = { gone: true }; break; }
    continue;
  }
  vanished = 0;
  last = j;
  const ranMs = j.startedAt ? Date.now() - j.startedAt : null;
  if (j.state === "running") {
    log(`step 5 — running for ${ranMs === null ? "?" : (ranMs / 60000).toFixed(1)} min` +
        ` (pid ${j.pid}, deadline in ${j.deadlineAt ? ((j.deadlineAt - Date.now()) / 60000).toFixed(1) + " min" : "?"}` +
        `${j.stopping ? ", STOPPING: " + j.stopping : ""})`);
    continue;
  }
  ended = j;
  break;
}

// ── step 6: the verdict ──────────────────────────────────────────────────────
log("");
if (!ended) {
  log(`VERDICT — NOT PROVEN: the probe was still running at the bound (${(BOUND_MS / 60000).toFixed(1)} min).`);
  log(`          Last record: ${JSON.stringify(last).slice(0, 400)}`);
  log("          That is a bound on THIS RUN, not on the job — the job may still be going.");
  process.exit(1);
}
if (ended.gone) {
  log("VERDICT — CANNOT TELL: the job's record disappeared before it ended. A recycled");
  log("          container loses the in-memory record, so this says nothing either way.");
  process.exit(1);
}

log(`step 6 — final record: ${JSON.stringify(ended).slice(0, 1200)}`);
const tail = Array.isArray(ended.tail) ? ended.tail : [];
for (const t of tail) log(`step 6 — tail: ${t}`);

if (SHAPE === "hold") {
  // THE QUESTION IS FIFTEEN MINUTES, so the answer is the elapsed time and the
  // exit code together — a child killed at fourteen also produces a final
  // record, and `signal`/`stopped` is what tells the two apart.
  const v = holdVerdict(ended);
  log("");
  log(`VERDICT — ran ${v.ranMin.toFixed(1)} min, exit code ${ended.code}` +
      `${ended.signal ? ", signal " + ended.signal : ""}${ended.stopped ? ", stopped: " + ended.stopped : ""}`);
  if (v.proven) {
    log("          PROVEN: a job child ran past fifteen minutes inside the container and ended cleanly.");
    process.exit(0);
  }
  log("          NOT PROVEN: it " + v.why + ".");
  process.exit(1);
}

const { reading, line: readingLine } = wireVerdict(tail);
log("");
if (!reading) {
  log("VERDICT — CANNOT TELL: the job ended but no line in the tail carries a readable reading.");
  log(`          Tail had ${tail.length} line(s).`);
  process.exit(1);
}
log(`VERDICT — the wire reading is: ${reading}`);
log(`          from: ${String(readingLine).slice(0, 160)}`);
log("          idle-kill                     a quiet connection is killed; streaming IS the fix.");
log("          no-wall                       the failure was NOT reproduced. It does not settle");
log("                                        the historical cause — run 45 may have died of");
log("                                        something else, or of a condition not present now.");
log("          lifetime-cap                  both died; streaming cannot beat this one.");
log("          quiet-survived-trickle-did-not unexpected; read both rows before concluding.");
// A PLAIN EXIT, not `reading ? 0 : 1` — the unreadable case returned above, so
// that ternary's false arm was unreachable: a dead branch that reads as a
// second wall, which is this repository's own recorded shape.
process.exit(0);
