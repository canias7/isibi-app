// The canary: prove the queued edit path against the deployed Worker.
//
// ── IT IS FREE UNLESS TOLD OTHERWISE ───────────────────────────────────────
//
// Four checks run by default and NONE of them spends a credit. The trick is
// `escalate("empty")`: the edit route refuses an empty instruction with
// `cost: 0` before any model call, and that refusal sits AFTER the async fork.
// So an empty instruction exercises the entire round trip — enqueue, claim,
// replay, finalize — and stops one line short of the first thing that costs
// money.
//
// The paid edit runs only when `CANARY_SPEND=1`, and it runs exactly once. It
// ROUTES FIRST — see the comment above it — because the edit route does not
// decide its own layer and an edit posted without one costs nothing, changes
// nothing, and still answers 200.
//
// ── HOW IT SIGNS IN ────────────────────────────────────────────────────────
//
// Admin magic-link, the same way `wall-probe.mjs` and `build-as-owner.mjs` do:
// no password anywhere, and the session is minted for this run and thrown away.
import https from "node:https";
import { mkdirSync, writeFileSync } from "node:fs";
// THE CUSTOMER'S OWN SCREEN, EXECUTED — never re-composed here. `editAnswer`
// is the browser's real selection and `editBrowserReply` runs it with the
// outward arms injected as recorders, which is the only way a harness can
// report what the customer would read rather than a second copy of it.
import { editBrowserReply } from "./addon-sweep.mjs";
// THE INSTRUCTION WALL AND THE WATCH, lifted out so they can be driven. This
// file is a script with top-level await that spends money, so a test cannot
// import it to reach a function — see the header of `canary-watch.mjs`.
import { EditPoll, readInstruction, instructionRefusal, watchEdit, watchReport, readRoutes, routesRefusal } from "./canary-watch.mjs";
// THE AFTER-READ'S WAIT AND ITS VERDICT (run 32), in the same module for the
// same reason: whether a comparison is about this job is a decision worth
// driving, and it cannot be reached through a script that spends money.
import { afterReadTarget, awaitVersion, afterReadVerdict, sameVersion, verdictSentence, readBalance } from "./canary-watch.mjs";
// THE READ-ONLY LOOKUP. Its own module for the same reason: the decisions it
// makes about billing and about what the old watch would have seen are worth
// driving, and they cannot be reached through a script that spends money.
import { readJobRecords, describeJob } from "./canary-read-job.mjs";
// THE RESTORE MODE. Its own module for the same reason: what it will and will
// not post is worth driving, and it cannot be reached through this script.
import { readRestoreId, restoreFlow, describeRestore } from "./canary-restore.mjs";
// THE UI MODE. Its own module, for the reason the other modes have theirs: what
// it will send, and where it stops, is decided there and driven by tests. It
// loads a browser only when a scenario is named, so an ordinary run never does.
import { readUiScenario, runUi, describeUi, chainVerdict, finalReplyOf } from "./canary-ui.mjs";
// AND ITS VERDICTS FOR A SCENARIO THAT CHANGES A ROW (Test 4b's D1): what left
// the page, what the job stored, the money and the publish that must not have
// happened — each decided in the module, where tests drive it.
import { requestVerdict, storedReplyVerdict, moneyVerdict, unpublishedVerdict, routeCostsOf } from "./canary-ui.mjs";
// TEST 5: a page removal is judged by what its operations did, never by how
// many replies came back.
import { removalVerdict } from "./canary-remove.mjs";
import { OWNER_ROWS_LIMIT } from "./canary-rows.mjs";
// BATCH 1: the route a paid press expects, read from its own box and compared
// with the router's answer before the edit is posted.
import { readExpectRoute, routeVerdict, expectSaid, mismatchSaid } from "./canary-route.mjs";
import { publishedVersion } from "./canary-watch.mjs";
// TEST 6: the description in the site's settings, beside the one the head serves.
import { readStoredHead, storedHeadSaid } from "./canary-watch.mjs";
// AND THE RULES TEST'S (lido-axes-b): its approvals, its readers' verdicts, and
// what "nothing published" means on a site with no version header — each
// decided in the module, where tests drive it.
import {
  readAllow, runIdOf, NEWEST_ROWS, readSurface, surfaceSame, sourceSame, legacyUnpublishedVerdict,
  bookingBodyVerdict, EVIDENCE_BOUNDARY, rulesRecordable,
} from "./canary-rules.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const CANARY = String(process.env.CANARY_SLUG || "").trim().toLowerCase();
const CONTROL = String(process.env.CONTROL_SLUG || "").trim().toLowerCase();
const SPEND = process.env.CANARY_SPEND === "1";
// THE DEMANDS, AND THEY ARE OPTIONAL BY DESIGN. Unset, the preflight still
// READS both identifiers and prints them — what it will not do is claim a
// match nobody asked for. `lane-sweep.yml` carries the same pair under the
// same names, so one habit covers both harnesses.
const EXPECT_DEPLOY = String(process.env.EXPECT_DEPLOY || "").trim();
const EXPECT_IMAGE = String(process.env.EXPECT_IMAGE || "").trim();
// WHERE THE EVIDENCE GOES. A directory the workflow uploads, so the whole
// before/after record is readable without a browser or a developer console.
const EVID = String(process.env.CANARY_EVIDENCE_DIR || "docs/edits/canary").trim();
// READ ONE EXISTING JOB AND STOP. Set, everything below the sign-in is skipped
// — see the branch above the preflight.
const READ_JOB = String(process.env.CANARY_READ_JOB || "").trim();
// PUT ONE SAVED VERSION BACK, THEN READ IT AND STOP. Set, the free checks run,
// the version is restored, the inventory reads the restored site, and nothing
// past the inventory runs — see the branch above the inventory.
const RESTORE = String(process.env.CANARY_RESTORE || "").trim();
// RUN A SCENARIO THROUGH THE REAL APP, IN A REAL BROWSER. Set, the free checks
// and the before-inventory run, then the scenario, and nothing past it runs —
// see the branch below the balance.
const UI = String(process.env.CANARY_UI || "").trim();

// THE READ MODE DOES NOT NEED A SLUG, and demanding one would be a false
// demand with a real cost: the job row CARRIES its slug, so asking the caller
// to name one invites them to name the wrong one, and a lookup of a job on
// another site would be refused for a reason that has nothing to do with it.
if (!EMAIL || !SERVICE_KEY || (!CANARY && !READ_JOB)) {
  console.error("OWNER_EMAIL, SUPABASE_SERVICE_KEY and CANARY_SLUG are required (CANARY_SLUG is not needed with CANARY_READ_JOB)");
  process.exit(1);
}

// A MALFORMED VERSION REFUSES BEFORE ANYTHING IS SIGNED IN OR READ: the id is
// what the caller can fix, and nothing about the platform is needed to say so.
// The read mode ignores every input below it, this one included.
const RESTORE_ASK = RESTORE && !READ_JOB ? readRestoreId(RESTORE) : null;
if (RESTORE_ASK && !RESTORE_ASK.ok) {
  console.error(`REFUSING TO RESTORE: ${RESTORE_ASK.msg}`);
  process.exit(2);
}
// A SCENARIO IS A NAME, REFUSED WHOLE BEFORE THE SIGN-IN, and it is written for
// one site: a site box naming another refuses too. A version to put back and a
// scenario to run are two different runs, so naming both refuses rather than
// letting one of them win quietly.
const UI_ASK = UI && !READ_JOB ? readUiScenario(UI, CANARY) : null;
if (UI_ASK && !UI_ASK.ok) {
  console.error(`REFUSING THE UI MODE: ${UI_ASK.msg}`);
  process.exit(2);
}
if (UI_ASK && RESTORE_ASK) {
  console.error("REFUSING: a version to put back and a UI scenario are two different runs — name one of them");
  process.exit(2);
}
// THE RULES TEST'S APPROVALS, from their own box: `cleanup`, and the send
// channels the owner accepts if the test booking goes in anyway. Read whole
// before the sign-in — a word that is not one of those refuses rather than
// being guessed at — and only for the rules scenario: approvals beside any
// other run are a box filled in for a different press.
const ALLOW_RAW = String(process.env.CANARY_ALLOW || "").trim();
const ALLOW = readAllow(ALLOW_RAW);
if (!ALLOW.ok) {
  console.error(`REFUSING THE APPROVALS: ${ALLOW.msg}`);
  process.exit(2);
}
if (ALLOW_RAW && !(UI_ASK && UI_ASK.scenario.rules)) {
  console.error("REFUSING: the approvals box is for the rules scenario only, and this run names no rules scenario");
  process.exit(2);
}
// THE ROUTE THIS PRESS EXPECTS, from its own box (`canary-route.mjs`). Read
// whole before the sign-in, so a typo costs nothing, and only for the one paid
// edit: a read, a restore and a browser scenario make no routing call of this
// script's, so an expectation beside them would be a check that never runs.
const EXPECT_ROUTE = readExpectRoute(process.env.CANARY_EXPECT_ROUTE);
if (!EXPECT_ROUTE.ok) {
  console.error(`REFUSING THE EXPECTED ROUTE: ${EXPECT_ROUTE.msg}`);
  process.exit(2);
}
if (EXPECT_ROUTE.expect && (READ_JOB || RESTORE || UI)) {
  console.error("REFUSING: the expected-route box is for the one paid edit, and this run names another mode");
  process.exit(2);
}
if (EXPECT_ROUTE.expect) {
  console.log(`EXPECTED ROUTE  ${expectSaid(EXPECT_ROUTE.expect)}  (checked after routing, before the edit is posted${SPEND ? "" : "; this run does not spend, so it routes nothing"})\n`);
}
// THIS RUN'S OWN ID, which goes into the rules test's marker booking's name.
const RUN_ID = runIdOf(process.env);

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }),
});
const glBody = await gl.json().catch(() => ({}));
const hashed = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
if (!hashed) { console.error("could not generate a sign-in link:", gl.status); process.exit(1); }
const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: hashed }),
});
const session = await vr.json().catch(() => ({}));
if (!session.access_token) { console.error("could not open a session:", vr.status); process.exit(1); }
const TOKEN = session.access_token;
const UID = (session.user || {}).id || "";
console.log(`signed in as ${(session.user || {}).email}  uid=${UID}\n`);

/** `node:https` rather than fetch — undici gives up at 300s and the sync path can outlive that. */
function call(method, path, { body, headers } = {}) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path);
    const t0 = Date.now();
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(headers || {}) },
    }, (res) => {
      // BYTES, DECODED ONCE. Adding each chunk to a string decodes it on its
      // own, so a multi-byte character split across two chunks turns into
      // replacement characters: run 35 read an en dash in order.tsx back as
      // three U+FFFD, and a body comparison would call that a changed page.
      const chunks = [];
      res.on("data", (c) => { chunks.push(c); });
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        // THE HEADERS RIDE ALONG, because `x-gf-edit: final` is the ONLY thing
        // that separates a stored reply from a poll that failed — the body
        // cannot carry it (it is the synchronous reply unchanged) and neither
        // can the status (a stored 503 and a transient 503 are the same
        // number). Dropping them here is what made run 14's watch blind.
        resolve({ status: res.statusCode, ms: Date.now() - t0, json, headers: res.headers || {}, text: text.slice(0, 400) });
      });
    });
    req.on("error", (e) => resolve({ status: 0, ms: Date.now() - t0, why: e.code || e.message }));
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
  if (!ok) failed++;
};
const hex32 = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

// ── READ ONE EXISTING JOB, AND THEN STOP ───────────────────────────────────
//
// A mode, not a flag beside the others: it EXITS, so nothing below it runs.
// `backend-repair.mjs` argues the same shape — "a flag beside `--apply` would
// be a two-field invariant, and a forgotten flag fails OPEN" — and the failure
// this one is guarding against is the expensive direction: a lookup that also
// dispatched an edit.
//
// IT SITS ABOVE THE PREFLIGHT ON PURPOSE. The preflight's own reads are
// harmless GETs, but what makes the read-only claim checkable is the LINE it
// stops at rather than the harmlessness of each thing past it. Everything
// below — the routing call, the POST, the watch, the inventory, the browser —
// is unreachable from here.
if (READ_JOB) {
  console.log(`READ-ONLY — job ${READ_JOB}\n`);
  const rec = await readJobRecords({
    job: READ_JOB,
    // TWO GETTERS AND NOTHING ELSE. The method is bound HERE, so the module
    // has no verb to reach for: it cannot route, edit, replay, cancel or
    // retry, because none of those is in scope for it. A promise in a comment
    // would be the weaker form of the same claim.
    // ⚠ THE BODY GOES OVER AS IT CAME, AND THE COERCION THAT USED TO BE HERE
    // WAS THE WHOLE DEFECT. This read `Array.isArray(rows) ? rows : []`, so a
    // PostgREST error object at HTTP 200 arrived at `readJobRecords` already
    // wearing the shape that means "no rows" — and its `Array.isArray` check,
    // written for exactly that case, could never fire from the one caller that
    // runs in production. The guards drove the module through an injected
    // store and were green about a branch the press cannot reach.
    //
    // This repo's own wiring trap, in the fix for the class it belongs to:
    // *the module perfect, one hop cutting it, and from outside "the body was
    // a list" and "we made it one" are the same value.* The decision is the
    // module's; this is transport.
    sb: async (path) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svc });
      const rows = await r.json().catch(() => null);
      return { status: r.status, rows };
    },
    poll: () => call("GET", `/api/site/edit/${encodeURIComponent(READ_JOB)}`),
  });
  const account = describeJob(rec);
  console.log(account);
  mkdirSync(EVID, { recursive: true });
  writeFileSync(`${EVID}/job-${READ_JOB}.json`, JSON.stringify(rec, null, 2));
  writeFileSync(`${EVID}/job-${READ_JOB}.txt`, account + "\n");
  console.log(`\nwritten to ${EVID}/job-${READ_JOB}.{json,txt}`);
  process.exit(rec.row ? 0 : 1);
}

// ── PREFLIGHT: WHICH CODE IS ANSWERING, AND IS IT READY ────────────────────
//
// `scripts/addon-sweep.mjs` refuses to spend against the wrong build BEFORE
// the browser, the balance or the first post, and the reason it can be a
// refusal rather than a warning is that nothing has been spent yet. The same
// discipline, the same two readers:
//
//   /api/site/build-health   the Worker's DEPLOY_ID *and* the container's
//                            cold-start image, in ONE call
//   /api/site/runtime?slug=  `async` and `runner` — the effective
//                            eligibilities — plus the sha as a SECOND reader
//
// CANNOT-TELL IS A REFUSAL, NEVER A MATCH. An unstamped image arrives as `""`
// and refuses; so does a route that failed. The wrong direction is the
// expensive one: a run against the PREVIOUS build produces a complete,
// plausible, green-looking result about code that is not under test.
//
// A SHA MATCHES BY PREFIX, FLOORED AT 7 ON BOTH SIDES; AN IMAGE ID MATCHES
// WHOLE. A prefix of a hash is not a weaker claim, it is a different one.
console.log("PREFLIGHT — which code is answering, and is it ready\n");

const health = await call("GET", "/api/site/build-health");
const runtime = await call("GET", `/api/site/runtime?slug=${encodeURIComponent(CANARY)}`);
// THE CONTROL'S OWN ELIGIBILITY, READ RATHER THAN ASSUMED — see check 2.
const cRuntime = CONTROL ? await call("GET", `/api/site/runtime?slug=${encodeURIComponent(CONTROL)}`) : { status: 0 };
const cAsync = (cRuntime.json || {}).async;
const hDeploy = String((health.json || {}).deploy || "");
const hImage = String((health.json || {}).image || "");
const rDeploy = String((runtime.json || {}).deploy || "");
const rAsync = (runtime.json || {}).async;
const rRunner = (runtime.json || {}).runner;

console.log(`  build-health  ${health.status}  deploy=${hDeploy.slice(0, 12) || "(none)"}  image=${hImage || "(none/unstamped)"}`);
console.log(`  runtime       ${runtime.status}  deploy=${rDeploy.slice(0, 12) || "(none)"}  async=${rAsync}  runner=${rRunner}`);
if (CONTROL) console.log(`  control       ${cRuntime.status}  ${CONTROL} async=${cAsync}`);

/** Floored at 7 on BOTH sides, so a short expectation cannot pass by being short. */
function shaMatches(saw, want) {
  const a = String(saw || ""), b = String(want || "");
  if (a.length < 7 || b.length < 7) return false;
  const n = Math.min(a.length, b.length);
  return a.slice(0, n) === b.slice(0, n);
}

// THE TWO READERS MUST AGREE, asked with no expectation set — a disagreement
// means a roll is in flight, which is a fact about the platform rather than
// about what the caller wanted.
check("build-health answered", health.status === 200 && !!hDeploy, `${health.status} ${hDeploy.slice(0, 12) || health.text.slice(0, 60)}`);
check("runtime answered", runtime.status === 200 && !!rDeploy, `${runtime.status} ${rDeploy.slice(0, 12) || runtime.text.slice(0, 60)}`);
check("the two deploy readers agree", shaMatches(hDeploy, rDeploy), `${hDeploy.slice(0, 12)} vs ${rDeploy.slice(0, 12)}`);
// REQUIRED, NOT ADVISORY. `async` off means the edit runs inside the Worker's
// isolate bounded by this connection at ~270s; `runner` off means the job was
// never handed to the site's own container. Either one turns a green result
// into a statement about a different path.
check("async is true", rAsync === true, String(rAsync));
check("runner is true", rRunner === true, String(rRunner));

if (EXPECT_DEPLOY) {
  check(`the Worker is the expected build (${EXPECT_DEPLOY.slice(0, 12)})`, shaMatches(hDeploy, EXPECT_DEPLOY), hDeploy.slice(0, 12) || "(none)");
}
if (EXPECT_IMAGE) {
  check(`a cold container gets the expected image (${EXPECT_IMAGE})`, !!hImage && hImage === EXPECT_IMAGE, hImage || "(none/unstamped)");
}

console.log("");

// ── THE FOUR FREE CHECKS ───────────────────────────────────────────────────

console.log("ZERO-COST CONFIRMATIONS\n");

// 1. THE CANARY GETS THE ASYNC SHAPE. An empty instruction is refused with
//    cost 0 AFTER the fork, so this exercises the whole round trip for nothing.
const a = await call("POST", `/api/site/${encodeURIComponent(CANARY)}/edit`,
  { body: { instruction: "", layer: "", idem: hex32() } });
const asyncShape = a.status === 202 && a.json && a.json.ok === true && typeof a.json.job === "string";
check(`the canary (${CANARY}) receives the ASYNC shape`, asyncShape,
  `${a.status} ${a.json ? JSON.stringify({ job: a.json.job, status: a.json.status, poll: a.json.poll }) : a.text}`);
const JOB = asyncShape ? a.json.job : "";

// 2. A SECOND SITE'S SHAPE FOLLOWS ITS OWN ELIGIBILITY.
//
// ── THIS CHECK USED TO HARDCODE THE ANSWER, AND THE PLATFORM MOVED UNDER IT ─
//
// It was written 2026-09-01 as *"a non-canary still receives the SYNCHRONOUS
// shape"* — a true and useful thing to assert while `EDIT_ASYNC_CANARY` named
// one slug and everybody else was synchronous. `EDIT_ASYNC_EVERYONE` opened
// the door to everyone on 2026-09-04 (`dacc9b51`) and this file was not
// touched again, so the assertion went on demanding a state the platform had
// left — and because a failed free check REFUSES TO SPEND, a stale control
// would block every paid dispatch for a reason that has nothing to do with
// the code under test. This repo's own trap: *a rule true because of a layer
// below it expires when that layer moves, and nothing announces it.*
//
// THE PROPERTY IS THE DURABLE HALF: the route's shape follows the SITE'S OWN
// eligibility, whichever way the flags are set. `/api/site/runtime` is the
// one reader of that, so the expectation is derived from it rather than typed.
//
// AND AN UNREADABLE CONTROL IS OUTSTANDING COVERAGE, NEVER A REFUSAL. The
// route is owner-scoped, so a control the building account does not own
// answers the 404 a missing site gets — a fact about a DIFFERENT site, which
// must not stop a paid run aimed at this one. The preflight's own demands are
// where cannot-tell refuses; this is not one of them.
if (!CONTROL) {
  console.log("  NOTE  CONTROL_SLUG is not set, so the second-site shape check is OUTSTANDING.");
} else if (cRuntime.status !== 200 || typeof cAsync !== "boolean") {
  console.log(`  NOTE  ${CONTROL}'s eligibility is unreadable (${cRuntime.status}) — the second-site`);
  console.log("        shape check is OUTSTANDING for this run. Not disproved, untested.");
} else {
  const b = await call("POST", `/api/site/${encodeURIComponent(CONTROL)}/edit`,
    { body: { instruction: "", layer: "", idem: hex32() } });
  const got = b.status === 202 && b.json && b.json.ok === true && typeof b.json.job === "string" ? "async"
    : b.status === 200 && b.json && b.json.escalate === true && !b.json.job ? "sync" : "neither";
  const want = cAsync ? "async" : "sync";
  check(`${CONTROL} (async=${cAsync}) receives the ${want.toUpperCase()} shape`, got === want,
    `${b.status} got=${got} ${b.json ? JSON.stringify({ job: b.json.job, escalate: b.json.escalate, reason: b.json.reason, cost: b.json.cost }) : b.text}`);
}

// 3. A FORGED REPLAY MARKER IS REFUSED. Well-formed but never minted here, so
//    nothing in the isolate holds its secret.
const c = await call("POST", `/api/site/${encodeURIComponent(CANARY)}/edit`,
  { body: { instruction: "", layer: "", idem: hex32() }, headers: { "x-gf-job": `${hex32()}.${hex32()}` } });
check("a forged replay marker returns 404", c.status === 404, `${c.status} ${c.text.slice(0, 80)}`);

// 4. A JOB THAT IS NOT YOURS IS INDISTINGUISHABLE FROM ONE THAT DOES NOT EXIST.
const d = await call("GET", `/api/site/edit/${hex32()}`);
check("polling a job that is not yours returns 404", d.status === 404, `${d.status} ${d.text.slice(0, 80)}`);

// The free job from check 1 is watched to its end, because that IS the round
// trip: enqueue, claim, replay, refuse for nothing, finalize.
if (JOB) {
  console.log("\n  watching the free job to its end…");
  let last = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const p = await call("GET", `/api/site/edit/${JOB}`);
    last = p;
    const st = (p.json && (p.json.status || (p.json.escalate ? "escalate" : ""))) || p.status;
    if (p.status === 200) { console.log(`    settled after ~${(i + 1) * 2}s: ${p.text.slice(0, 200)}`); break; }
    if (i % 5 === 0) console.log(`    ${(i + 1) * 2}s  ${p.status} ${st}`);
  }
  check("the free job reached a terminal state", !!(last && last.status === 200), last ? `${last.status}` : "no answer");
}

console.log(`\n${failed ? "FAILED — " + failed + " check(s)" : "ALL FREE CHECKS PASSED"}\n`);

// ── RESTORE ONE SAVED VERSION, THEN READ WHAT IS LIVE ──────────────────────
//
// BELOW THE FREE CHECKS, so a Worker that is not the expected build — or a
// platform failing its own round trip — never has a version put back through
// it. ABOVE THE INVENTORY, so the source read that follows is of the restored
// site. A restore that did not take STOPS the run: an inventory taken after it
// would be a perfectly good record of the WRONG site, read as the restored one.
if (RESTORE_ASK) {
  if (failed) {
    console.log("REFUSING TO RESTORE: a free check failed, so the platform is not the one this run expected.");
    process.exit(1);
  }
  const rs = await restoreFlow({
    id: RESTORE_ASK.id,
    listVersions: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/versions`),
    // THE APP'S OWN CALL: the Versions panel posts `{ id }` to this route.
    postRestore: (id) => call("POST", `/api/site/${encodeURIComponent(CANARY)}/versions/restore`, { body: { id } }),
    // THE SITE ITSELF, not the route: `x-site-version` is what the live script
    // bakes, so it is the one reading that says what a visitor is served.
    readLive: async () => {
      try {
        const r = await fetch(`https://${CANARY}.gofarther.app/?restore-check=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
        return String(r.headers.get("x-site-version") || "");
      } catch { return ""; }
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
  const told = describeRestore(rs, CANARY);
  console.log(told + "\n");
  mkdirSync(EVID, { recursive: true });
  writeFileSync(`${EVID}/restore.json`, JSON.stringify(rs, null, 2));
  writeFileSync(`${EVID}/restore.txt`, told + "\n");
  if (!rs.ok) process.exit(1);
}

// ── THE INVENTORY, CAPTURED BEFORE ANYTHING IS SPENT ───────────────────────
//
// Two halves, and they answer different questions:
//
//   the SOURCE   what the site is made of — pages and components, with their
//                bodies — read through `/api/site/source`, which carries
//                `reads` because it answers `200 ok:true` with EMPTY LISTS
//                for a store that threw. A missing `reads` is an older Worker
//                and is CANNOT-TELL, never "complete".
//   the RENDER   what a visitor actually gets, per route, which is the only
//                half that can show a section order or a photograph loading.
//
// Captured on EVERY run, paid or not, so one free dispatch produces the whole
// before-record for review.

/** og:image is a SHARE CARD, not a picture on a page — `photoUrls`' own rule. */
function onPagePhotos(html, slug) {
  const body = String(html || "").replace(/<meta[^>]*og:image[^>]*>/g, "");
  const found = new Set();
  for (const m of body.matchAll(/<img[^>]*>/g)) {
    const src = /src="([^"]*)"/.exec(m[0]);
    if (src && src[1].includes(`/u/${slug}/`)) found.add(src[1]);
  }
  return [...found].sort();
}

/** Headings in DOCUMENT ORDER — what "the section order" means to a visitor. */
function headingOrder(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/g)) {
    const t = m[2].replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim();
    if (t) out.push(t);
  }
  return out;
}

/** Every word a visitor reads, as a sorted multiset — the prose-preservation check. */
function proseBag(html) {
  const body = String(html || "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  return body.toLowerCase().replace(/&[a-z#0-9]+;/g, " ").split(/[^a-z0-9']+/).filter(Boolean).sort();
}

// A PAGE READ AT THE WRONG VERSION IS RE-READ, BOUNDED: five reads three
// seconds apart, then the page is kept as it came and the verdict says so.
const PAGE_POLLS = 5;
const PAGE_GAP_MS = 3000;

async function inventory(label, expect = "") {
  mkdirSync(`${EVID}/${label}`, { recursive: true });
  const src = await call("GET", `/api/site/source?slug=${encodeURIComponent(CANARY)}`);
  const sb = src.json || {};
  // THE DESCRIPTION IN THE SITE'S SETTINGS (Test 6): what the NEXT publish will
  // ship, beside the served head, which is what the last one did. The app's own
  // SEO & Social route, read and never written. See `readStoredHead`.
  const seo = await call("GET", `/api/site/${encodeURIComponent(CANARY)}/seo`);
  const stored = readStoredHead(seo.status, seo.json);
  // THE PUBLIC ORIGIN IS THE SITEMAP'S OWN, never assembled from the slug: a
  // renamed site serves at its ALIAS and `sitemap.xml` carries the address
  // the platform substitutes at serve time.
  let origin = `https://${CANARY}.gofarther.app`;
  let routes = ["/"];
  try {
    const sm = await fetch(`${origin}/sitemap.xml`).then((r) => r.text());
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (locs.length) {
      origin = new URL(locs[0]).origin;
      routes = [...new Set(locs.map((l) => new URL(l).pathname || "/"))].sort();
    }
  } catch { /* the render half degrades to the home page; the source half is unaffected */ }

  const render = {};
  for (const r of routes) {
    // THE VERSION EACH PAGE WAS READ AT IS RECORDED, because a page is only
    // evidence about the build that served it — run 32's after-read was the
    // previous build, 7.9 s after the publish, and nothing in the record said
    // so. `x-site-version` is what the live script bakes.
    const readPage = async () => {
      try {
        const x = await fetch(origin + r);
        // A SITE ON THE OLDER LAYOUT carries no version header, and its build
        // header is the one that says which build served the page.
        return { version: String(x.headers.get("x-site-version") || ""), build: String(x.headers.get("x-site-build") || ""), html: await x.text() };
      } catch { return { version: "", build: "", html: "" }; }
    };
    let got;
    if (expect) {
      const w = await awaitVersion({ read: readPage, expect, polls: PAGE_POLLS, gapMs: PAGE_GAP_MS });
      got = { html: "", version: "", ...(w.last || {}), reads: w.reads };
    } else {
      got = { ...(await readPage()), reads: 1 };
    }
    const html = got.html || "";
    const file = (r === "/" ? "_home" : r.replace(/[^a-z0-9]+/gi, "_"));
    writeFileSync(`${EVID}/${label}/route${file}.html`, html);
    render[r] = { bytes: html.length, version: got.version, build: got.build || "", reads: got.reads, photos: onPagePhotos(html, CANARY), headings: headingOrder(html), words: proseBag(html).length };
  }

  const inv = {
    at: new Date().toISOString(), slug: CANARY, origin, label,
    status: src.status,
    // THREE STATES, and the third is the one that matters.
    reads: sb.reads || null,
    readsComplete: sb.reads ? (sb.reads.pages === true && sb.reads.parts === true && sb.reads.assets === true) : null,
    pages: (sb.pages || []).map((p) => ({ path: p.path, bytes: String(p.source || "").length })),
    parts: (sb.parts || []).map((p) => ({ path: p.path || p.name, bytes: String(p.source || "").length })),
    render,
    stored,
  };
  // THE BODIES TOO, because "complete before-inventory" means the source a
  // comparison can be made against, not a table of sizes.
  const source = { pages: sb.pages || [], parts: sb.parts || [] };
  writeFileSync(`${EVID}/${label}/source.json`, JSON.stringify(source, null, 2));
  writeFileSync(`${EVID}/${label}/inventory.json`, JSON.stringify(inv, null, 2));
  // The bodies ride along in memory, not in inventory.json: a run that must
  // publish nothing compares them before and after, file by file.
  return { ...inv, source };
}

console.log(`INVENTORY — before (written to ${EVID}/before)\n`);
const BEFORE = await inventory("before");
console.log(`  source ${BEFORE.status}  reads=${JSON.stringify(BEFORE.reads)}  complete=${BEFORE.readsComplete}`);
console.log(`  pages  ${BEFORE.pages.map((p) => `${p.path}(${p.bytes}b)`).join(" ") || "(none)"}`);
console.log(`  parts  ${BEFORE.parts.map((p) => `${p.path}(${p.bytes}b)`).join(" ") || "(NONE — component coverage is outstanding for this run)"}`);
for (const [r, v] of Object.entries(BEFORE.render)) {
  console.log(`  ${r.padEnd(14)} ${String(v.bytes).padStart(6)}b  version=${v.version || (v.build ? "(none; build " + v.build + ")" : "(unreadable)")}  photos=${v.photos.length}  headings: ${v.headings.join(" | ")}`);
}
console.log(`  stored     description ${storedHeadSaid(BEFORE.stored)}`);
check("the source read is complete (reads all true)", BEFORE.readsComplete === true, JSON.stringify(BEFORE.reads));

// ── THE BALANCE, READ ON EVERY RUN ─────────────────────────────────────────
//
// It used to be read inside the paid half, so a FREE dispatch — the one whose
// whole job is to say whether the paid one is worth pressing — never printed
// the one number that decides it. `buildFloor` refuses before spending and
// that refusal reads as a broken build, so *"read the ledger; do not trust
// this line"* wants a reader on the free path too.
//
// THE NUMBER ONLY. The service key is in the header and never in the output,
// and nothing here prints a token, a url with credentials in it, or a row.
//
// CANNOT-TELL IS -1, NEVER 0: a missing row or an error body used to read as a
// balance of 0 (`readBalance`, in canary-watch.mjs, says why that matters).
async function balanceNow() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${UID}&select=balance`, { headers: svc });
    return readBalance(r.ok, await r.json().catch(() => null));
  } catch { return -1; }
}
const BAL = await balanceNow();
console.log(`  balance ${BAL < 0 ? "UNREADABLE" : BAL}`);
check("the balance is readable", BAL >= 0, String(BAL));
console.log("");

// THE RESTORE MODE STOPS HERE WHATEVER `spend` SAYS. The workflow already holds
// `CANARY_SPEND` at 0 while a version is named; this is the second wall, in the
// script, because a restore that went on to spend would be an edit against a
// site nobody has compared yet.
if (RESTORE_ASK) {
  console.log("RESTORE MODE — stopping before the paid edit. Nothing was charged.");
  process.exit(failed ? 1 : 0);
}
// ── THE UI MODE: THE REAL APP, IN A REAL BROWSER, AS THE OWNER ─────────────
//
// A MODE, LIKE THE RESTORE: it runs its scenario and EXITS, so the one API edit
// below is unreachable from it. It sits below the free checks and the
// before-inventory, so a platform that is not the expected build never has a
// message typed into it, and the record starts from a complete before-read.
// `spend` decides whether anything is SENT: without it the scenario stops at
// the first Send, having shown that the app opens signed in and the file
// attaches.
if (UI_ASK) {
  // THE RULES TEST NEEDS THE APP'S PAGE LIST TOO: on a site that has pages the
  // app will not route a message without it, so a run that cannot read it
  // stops here, before the browser, rather than reading as a test of the rules
  // rung. The browser's own filter reads it; a GET, and nothing else.
  const RULES = UI_ASK.scenario.rules || null;
  if (RULES) {
    const rr = await call("GET", `/api/site/routes?slug=${encodeURIComponent(CANARY)}`);
    const pl = readRoutes(rr.status, rr.json);
    check("the app can read the site's page list (without one it stops before routing a message)", pl.ok, pl.ok ? pl.pages.join(" ") : pl.why);
  }
  if (failed) {
    console.log("REFUSING TO OPEN THE APP: a free check failed, so the platform is not the one this run expected.");
    process.exit(1);
  }
  console.log(`UI MODE — scenario ${UI_ASK.name} on ${CANARY}, ${SPEND ? "PAID: each message is sent" : "a rehearsal: nothing is sent"}\n`);
  // A SCENARIO THAT CHANGES A ROW IS HANDED ITS READERS. The owner route reads
  // the stored rows whole and is the one door the recovery writes through —
  // one field, by the rules in canary-rows.mjs; the visitor route is what the
  // site's own pages read, kept as text so "as it was" is asked byte for byte.
  const ROW = UI_ASK.scenario.row || null;
  const rowReaders = ROW ? {
    owner: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/rows/${encodeURIComponent(ROW.table)}?order=id&dir=asc&limit=${OWNER_ROWS_LIMIT}`),
    pub: async () => {
      try {
        const r = await fetch(`${BEFORE.origin}/api/db/${encodeURIComponent(CANARY)}/data/${encodeURIComponent(ROW.table)}?select=*&order=id.asc`, { headers: { "cache-control": "no-cache" } });
        return { status: r.status, text: Buffer.from(await r.arrayBuffer()).toString("utf8") };
      } catch (e) { return { status: 0, why: String((e && e.message) || e) }; }
    },
    patch: (id, body) => call("PATCH", `/api/site/${encodeURIComponent(CANARY)}/rows/${encodeURIComponent(ROW.table)}/${id}`, { body }),
  } : null;
  // THE RULES TEST'S READERS, AND ITS ONE WRITE. The owner's table listing and
  // the newest rows of the booking table (the exact count and the newest ids),
  // the owner's secrets list (NAMES are all that is kept — `readSecretNames`),
  // the platform's notification record for the site (two columns, nothing
  // secret), a visitor's reads of the menu and of the booking table, and the
  // site's surface — every page on its build, and its stylesheet byte for byte.
  // The DELETE is the exact cleanup's, made only for this run's own row.
  const visitorText = async (path) => {
    try {
      const r = await fetch(`${BEFORE.origin}${path}`, { headers: { "cache-control": "no-cache" } });
      return { status: r.status, text: Buffer.from(await r.arrayBuffer()).toString("utf8") };
    } catch (e) { return { status: 0, why: String((e && e.message) || e) }; }
  };
  const rulesIo = RULES ? {
    tables: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/rows`),
    newest: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/rows/${encodeURIComponent(RULES.table)}?order=id&dir=desc&limit=${NEWEST_ROWS}`),
    secrets: () => call("GET", `/api/site/${encodeURIComponent(CANARY)}/secrets`),
    stamp: async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(CANARY)}&select=notify,notified_at`, { headers: svc });
      return { status: r.status, rows: await r.json().catch(() => null) };
    },
    menu: () => visitorText(`/api/db/${encodeURIComponent(CANARY)}/data/${encodeURIComponent(RULES.record.menu.table)}?${RULES.record.menu.query}`),
    bookingsRead: () => visitorText(`/api/db/${encodeURIComponent(CANARY)}/data/${encodeURIComponent(RULES.table)}?select=*`),
    surface: () => readSurface({
      origin: BEFORE.origin, routes: RULES.record.routes,
      get: async (url) => {
        const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
        return { status: r.status, headers: r.headers, bytes: Buffer.from(await r.arrayBuffer()) };
      },
    }),
    del: (id) => call("DELETE", `/api/site/${encodeURIComponent(CANARY)}/rows/${encodeURIComponent(RULES.table)}/${id}`),
  } : null;
  // D1's RECOVERY ON ITS OWN: a row scenario with no messages opens no app.
  const recoverOnly = !!ROW && !UI_ASK.scenario.steps.length;
  const ui = await runUi({ base: BASE, session, slug: CANARY, scenario: UI_ASK.scenario, spend: SPEND, balanceNow, evid: EVID, rows: rowReaders, siteOrigin: BEFORE.origin, rules: rulesIo, allow: ALLOW, runId: RUN_ID });
  const told = describeUi(ui);
  console.log("\n" + told + "\n");
  if (!recoverOnly) {
    check("the app opened signed in as the canary's account",
      !!(ui.opened && ui.opened.signedIn && !ui.opened.gate && ui.opened.uid === UID), JSON.stringify(ui.opened));
  }
  const first = ui.steps[0];
  if (first && first.attach) check("the file landed in the attachment strip", first.attached === true, String(first.attached));
  // ONE BRANCH EACH WAY, and deliberately not spelled as the spend gate below:
  // that line is the landmark every guard uses to find where spending begins.
  if (SPEND) {
    check("every message in the scenario was sent", ui.sent === UI_ASK.scenario.steps.length, `${ui.sent} of ${UI_ASK.scenario.steps.length}`);
    for (const s of ui.steps.filter((x) => x.sent)) {
      check(`message ${s.n} got a reply on screen`, !!s.reply, s.reply ? s.reply.slice(0, 80) : "(none)");
      check(`the composer was usable again after message ${s.n}`, s.usable === true, JSON.stringify(s.composer));
      if (s.file) {
        const post = (s.network || []).find((e) => e.method === "POST" && /\/edit$/.test(e.path));
        const got = post && post.req && Array.isArray(post.req.images) && post.req.images[0] ? post.req.images[0].sha256 : "";
        check(`message ${s.n}'s file reached the edit request byte for byte`, got === s.file.sha256, got || "(no image on the request)");
      }
    }
    check("nothing outside the scenario was started", ui.blocked.length === 0, JSON.stringify(ui.blocked));
  } else {
    check("the rehearsal stopped before sending anything",
      ui.sent === 0 && !ui.network.some((e) => e.method === "POST"), `sent ${ui.sent}`);
  }
  // ── THE ROW: WHERE IT STARTED, WHAT CHANGED, AND THAT IT WENT BACK ────────
  if (ROW) {
    const r = ui.row || {};
    const shownOk = (k) => !!(r.shown && r.shown[k] && r.shown[k].verdict && r.shown[k].verdict.ok);
    const shownSays = (k) => (r.shown && r.shown[k] ? (r.shown[k].target || r.shown[k].why || "") + (r.shown[k].verdict && !r.shown[k].verdict.ok ? ` [${r.shown[k].verdict.why}]` : "") : "not read");
    // THE RECOVERY'S WRITE IS CONDITIONAL, OR IT IS NOT MADE: asked with a
    // write no row can meet, before anything else is written.
    check("the Worker writes a row only while it still matches: a conditional write no row can meet changed nothing",
      !!(r.capability && r.capability.ok), r.capability ? `${r.capability.why} (${r.capability.status})${r.capability.detail ? " — " + r.capability.detail : ""}` : "not asked");
    if (recoverOnly) {
      const x = r.recovery || null;
      check("the recovery read the row on both readers", !!(x && x.pre && x.pre.owner.ok && x.pre.pub.ok),
        x && x.pre ? `owner ${x.pre.owner.ok ? "ok" : x.pre.owner.why}, visitor ${x.pre.pub.ok ? "ok" : x.pre.pub.why}` : "not read");
      check("the recovery refused nothing: it writes the one field back, or nothing", !!(x && x.plan && x.plan.act !== "refuse"),
        x && x.plan ? `${x.plan.act} (${x.plan.why})${x.plan.detail ? " — " + x.plan.detail : ""}` : "no plan");
      if (SPEND && x && x.plan && x.plan.act === "patch") {
        check("no other write changed the row between the recovery's read and its write", !x.conflict, x.conflict || (x.sent ? "" : "no write was sent"));
        check(`${ROW.field} was written back, that field alone`, !!(x.patched && x.patched.verdict.ok), x.patched ? `${x.patched.status} ${x.patched.verdict.why || ""}` : "not sent");
        check("the row is its recorded value again on both readers", !!(x.verdict && x.verdict.restored), x.verdict ? x.verdict.why : "not read");
        check(`the ${ROW.shown.path} page shows ${ROW.match.name} at ${ROW.shown.before} and every other card as it was`, shownOk("afterRestore"), shownSays("afterRestore"));
      }
      check("nothing was spent", ui.balance.start >= 0 && ui.balance.start === ui.balance.end, `${ui.balance.start} -> ${ui.balance.end}`);
    } else {
      check(`the fresh baseline, immediately before the message: ${ROW.table} id ${ROW.id} is ${ROW.match.name} and reads ${ROW.from} on both readers`,
        !!(r.baselineVerdict && r.baselineVerdict.ok), r.baselineVerdict ? `${r.baselineVerdict.why}${r.baselineVerdict.detail ? " — " + r.baselineVerdict.detail : ""}` : "not read");
      check(`the ${ROW.shown.path} page showed ${ROW.match.name} at ${ROW.shown.before} before anything was sent`, shownOk("before"), shownSays("before"));
      // ONE BRANCH EACH WAY, spelled like the one above it and never like the
      // spend gate below: that line is the landmark every guard finds it by.
      if (SPEND) {
        const s = ui.steps[0] || {};
        const rq = requestVerdict(s, UI_ASK.scenario);
        check(`the message left word for word, was routed to the ${UI_ASK.scenario.layers.join("/")} layer, and went out as one edit there`, rq.ok, JSON.stringify(rq));
        check("the reply on screen is the one the scenario expects", s.reply === UI_ASK.scenario.reply, JSON.stringify(s.reply || ""));
        const sr = storedReplyVerdict(s, UI_ASK.scenario);
        check(`the job's stored reply names exactly ${ROW.table} id ${ROW.id}, ${ROW.field}`, sr.ok, sr.why || JSON.stringify(sr.applied));
        check(`the database change is exactly ${ROW.table} id ${ROW.id} ${ROW.field} ${ROW.from} -> ${ROW.to}, and nothing else`,
          !!(r.change && r.change.exact), r.change ? JSON.stringify({ target: r.change.target, others: r.change.others.length, added: r.change.added, gone: r.change.gone }) : "not read");
        check("a visitor's read shows that one change and nothing else", !!(r.visitorChange && r.visitorChange.exact),
          r.visitorChange ? JSON.stringify({ target: r.visitorChange.target, others: r.visitorChange.others.length }) : "not read");
        check(`the ${ROW.shown.path} page showed ${ROW.shown.after} for ${ROW.match.name} and every other card unchanged`, shownOk("afterEdit"), shownSays("afterEdit"));
        const x = r.restore || {};
        check("no other write changed the row between the recovery's read and its write", !x.conflict, x.conflict || (x.patched ? "" : "no write was sent"));
        check(`the recovery wrote ${ROW.field} back alone, from the baseline`,
          !!(x.plan && x.plan.act === "patch" && x.patched && x.patched.verdict.ok),
          x.skipped || (x.plan ? `${x.plan.act} (${x.plan.why})${x.patched ? " -> " + x.patched.status + " " + (x.patched.verdict.why || "") : ""}` : "no plan"));
        check("the row is its baseline again, field for field, on both readers", !!(x.verdict && x.verdict.restored), x.verdict ? x.verdict.why : (x.skipped || "not read"));
        check("a visitor's read is byte-identical to the baseline", !!(x.verdict && x.verdict.bytes === true), x.verdict ? String(x.verdict.bytes) : "not read");
        check(`the ${ROW.shown.path} page is exactly as it was before`, shownOk("afterRestore"), shownSays("afterRestore"));
      } else {
        check("against this baseline the recovery would write nothing", !!(r.planAtBaseline && r.planAtBaseline.act === "none"),
          r.planAtBaseline ? `${r.planAtBaseline.act} (${r.planAtBaseline.why})` : "not decided");
      }
    }
  }
  // ── THE RULES TEST: WHERE IT STARTED, WHAT CLOSED, WHAT A BOOKING GOT ────
  // Either supported way of closing is accepted: the verdict reads what the
  // job's stored reply says it changed, what the owner's listing shows, and
  // what a real booking gets back — never one implementation's wording.
  if (RULES) {
    const R = ui.rules || {};
    const b0 = R.before || {};
    if (R.start) {
      for (const c of R.start.checks) check(`the rules test starts where it was written to — ${c.name}`, c.ok, c.why);
    } else {
      check("the rules test's starting point was read", false, ui.stopped ? ui.stopped.msg : "not read");
    }
    // ONE BRANCH EACH WAY, spelled like the ones above and never like the
    // spend gate below: that line is the landmark every guard finds it by.
    if (SPEND) {
      const s = ui.steps[0] || {};
      const rq = requestVerdict(s, UI_ASK.scenario);
      check(`the message left word for word, was routed to the ${UI_ASK.scenario.layers.join("/")} layer, and went out as one edit there`, rq.ok, JSON.stringify(rq));
      check(`the reply on screen is a success that names ${RULES.table}`, /^✅/.test(s.reply || "") && String(s.reply || "").includes(RULES.table), JSON.stringify(s.reply || ""));
      const cl = R.closing || null;
      check(`the job's stored reply closed ${RULES.table} by a supported way and changed nothing else, and the owner's listing agrees`, !!(cl && cl.ok),
        cl ? (cl.ok ? `by ${cl.method} (fields ${cl.fields.join(", ")}; ${cl.access.before} -> ${cl.access.after})${cl.refused.length ? `; refused beside it: ${JSON.stringify(cl.refused)}` : ""}` : cl.why)
          : (R.booking && R.booking.skipped) || "not decided");
      const bk = R.booking || {};
      const post = Array.isArray(bk.posts) ? bk.posts[0] : null;
      check("one visitor booking went out through the site's own form, exactly once", !!(bk.pressed && bk.posts.length === 1 && post && post.sent === true),
        bk.skipped || bk.why || `${Array.isArray(bk.posts) ? bk.posts.length : 0} booking request(s)`);
      const body = post ? bookingBodyVerdict(post.body, R.marker) : { ok: false, why: "no booking request was made" };
      check("the booking sent exactly the marker booking's five fields", body.ok, body.why);
      check("the gate let it out before it left, as the one exact request", !!(post && post.sent === true && post.exact === true),
        post ? (post.exact ? "" : post.exactWhy || "") : "no booking request was made");
      const v = R.bookingVerdict || { verdict: "none", why: bk.skipped || "no booking was submitted" };
      check(`the booking was refused at the privilege check: 403, 42501, "permission denied for table ${RULES.table}"`, v.verdict === "pass", `${String(v.verdict).toUpperCase()}: ${v.why}`);
      check("the page did not say the table was booked", !!(bk.message && bk.message.success === false),
        bk.message ? `the page said ${JSON.stringify(bk.message.toasts)}` : "the page's own words were not read");
      const ins = R.insertion || null;
      check(`no row was added to ${RULES.table}: the count and the newest ids as before, and no row carries the marker`, !!(ins && ins.ok), ins ? ins.why : "the owner's view was not read afterwards");
      if (R.cleanup) {
        const x = R.cleanup;
        check("the test's own booking was deleted, that row alone, and the table is back to its count", !!(x.verified && x.verified.ok),
          x.skipped || (x.recheck && !x.recheck.ok ? x.recheck.why : "") || (x.deleted && !x.deleted.ok ? x.deleted.why : "") || (x.verified ? x.verified.why : x.plan.why));
      }
      const a0 = R.after || {};
      check("the notification stamp did not move", !!(a0.stamp && a0.stamp.ok && b0.stamp && b0.stamp.ok && a0.stamp.notifiedAt === b0.stamp.notifiedAt),
        `before ${b0.stamp && b0.stamp.ok ? b0.stamp.notifiedAt || "never" : "UNREADABLE"}, after ${a0.stamp && a0.stamp.ok ? a0.stamp.notifiedAt || "never" : "UNREADABLE"}`);
      check("a visitor's read of the menu is byte for byte what it was", !!(a0.menu && b0.menu && a0.menu.status === 200 && a0.menu.bytes === b0.menu.bytes && a0.menu.sha256 === b0.menu.sha256),
        a0.menu && b0.menu ? `${b0.menu.status} ${b0.menu.bytes} b -> ${a0.menu.status} ${a0.menu.bytes} b` : "not read");
      const rr = RULES.record.bookingsRead;
      check(`a visitor's read of ${RULES.table} is still refused as it was`, !!(a0.bookingsRead && a0.bookingsRead.status === rr.status && a0.bookingsRead.code === rr.code && a0.bookingsRead.message === rr.message),
        a0.bookingsRead ? `${a0.bookingsRead.status} ${a0.bookingsRead.code} "${a0.bookingsRead.message}"` : "not read");
    } else {
      const d = R.dry || {};
      const post = Array.isArray(d.posts) ? d.posts[0] : null;
      check("the rehearsal filled the site's own booking form and pressed once, and the request was stopped in the browser",
        !!(d.pressed && d.posts.length === 1 && post && post.sent === false && !d.response), d.why || `${Array.isArray(d.posts) ? d.posts.length : 0} booking request(s)${d.response ? ", and an answer arrived" : ""}`);
      const body = post ? bookingBodyVerdict(post.body, R.marker) : { ok: false, why: "no booking request was made" };
      check("what it would have sent is exactly the marker booking's five fields", body.ok, body.why);
      check("the paid run's gate would let that request out: the first, exactly the marker, no query string, no prefer or authorization header",
        !!(post && post.exact === true), post ? post.exactWhy || "" : "no booking request was made");
      check("the booking page made no other write", !!(Array.isArray(d.aborted) && !d.aborted.length), (d.aborted || []).join("; ") || "not read");
      const da = R.dryAfter || null;
      const same = !!(da && da.ok && b0.census && b0.census.ok && da.count === b0.census.count && JSON.stringify(da.ids) === JSON.stringify(b0.census.ids));
      check(`the rehearsal left ${RULES.table} as it was`, same, da ? (da.ok ? `${b0.census && b0.census.ok ? b0.census.count : "?"} -> ${da.count} rows` : da.why) : "not read");
    }
    console.log(`\n  ${EVIDENCE_BOUNDARY}`);
  }
  let chain = null;
  let removal = null;
  if (SPEND && ui.sent) {
    // THE OLDER LAYOUT (a site published before the versioned builds) serves no
    // version header, so there is no version to wait for and no chain to walk:
    // "nothing published" is read off the build header, the pages, the
    // stylesheet and the stored source instead, beside the version list and
    // the job's own row.
    const legacy = UI_ASK.scenario.layout === "legacy";
    // THE CHAIN OF PUBLISHES, read off the site's own version list by each
    // job's id, and the after-read taken at the last one — the wait and the
    // inventory the one-edit path uses, applied to however many published.
    const beforeV = sameVersion(Object.values(BEFORE.render).map((v) => v.version));
    // Every job each message filed, in order: a hand-off to another layer is a
    // second job, and it can publish too.
    const filed = ui.steps.flatMap((s) => (Array.isArray(s.jobs) ? s.jobs : []).map((job) => ({ n: s.n, job })));
    const jobs = filed.map((f) => f.job);
    const list = jobs.length ? await call("GET", `/api/site/${encodeURIComponent(CANARY)}/versions`) : null;
    const published = [];
    for (const f of filed) {
      const pv = publishedVersion(list, f.job);
      if (pv.ok) published.push({ n: f.n, job: f.job, id: pv.id, parent: pv.parent });
    }
    let after = null;
    if (legacy) {
      console.log(`INVENTORY — after (written to ${EVID}/after)\n`);
      after = await inventory("after");
      for (const [r, v] of Object.entries(after.render)) {
        console.log(`  ${r.padEnd(14)} version=${v.version || (v.build ? "(none; build " + v.build + ")" : "(unreadable)")}  photos=${v.photos.length}  headings: ${v.headings.join(" | ")}`);
      }
      console.log(`\n  versions   ${list ? list.status : "not read"}; publishes ${published.map((p) => `${p.n}: ${p.id}`).join("; ") || "none"}`);
    } else {
      const target = published.length ? published[published.length - 1].id : beforeV;
      const readHome = async () => {
        try {
          const r = await fetch(`${BEFORE.origin}/?after-check=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
          return { version: String(r.headers.get("x-site-version") || "") };
        } catch { return { version: "" }; }
      };
      const wait = target ? await awaitVersion({ read: readHome, expect: target }) : { kind: "no-target", reads: 0, seen: "" };
      console.log(`INVENTORY — after (written to ${EVID}/after)\n`);
      after = await inventory("after", wait.kind === "match" ? target : "");
      for (const [r, v] of Object.entries(after.render)) {
        console.log(`  ${r.padEnd(14)} version=${v.version || "(unreadable)"}  photos=${v.photos.length}  headings: ${v.headings.join(" | ")}`);
      }
      chain = chainVerdict({ before: beforeV, published, wait, after: after.render });
      console.log(`\n  publishes  ${published.map((p) => `${p.n}: ${p.id} (from ${p.parent || "-"})`).join("; ") || "none"}`);
      console.log(`  chain      ${chain.verified ? "VERIFIED" : "UNVERIFIED (" + chain.why + ")"} — before ${beforeV || "?"}, after-read at ${chain.target || "?"}`);
    }
    // THE MONEY, PER JOB, from its own row and the ledger: the read mode's
    // reader, asked once for each job this scenario filed.
    const jobRecords = [];
    for (const job of jobs) {
      const jr = await readJobRecords({
        job,
        sb: async (path) => {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svc });
          const rows = await r.json().catch(() => null);
          return { status: r.status, rows };
        },
        poll: () => call("GET", `/api/site/edit/${encodeURIComponent(job)}`),
      });
      const account = describeJob(jr);
      console.log("\n" + account);
      writeFileSync(`${EVID}/job-${job}.txt`, account + "\n");
      jobRecords.push(jr);
    }
    // A SCENARIO THAT MUST PUBLISH NOTHING, AND WHOSE MONEY MUST CLOSE. Three
    // readers say nothing published (the site's version list, each job's own
    // row, the after-read at the before-read's version); the balance's move
    // must be exactly the routing calls' costs plus what each job's row and
    // the ledger both say it took.
    // A PAGE REMOVAL PASSES ON WHAT ITS OPERATIONS DID: each job's stored
    // reply, the chain of publishes, the stored source before and after, and
    // the old address read without following redirects. Taken whether or not
    // both messages were sent, so a stopped run records why it did not pass.
    if (UI_ASK.scenario.removal) {
      const rm = UI_ASK.scenario.removal;
      let address = null;
      try {
        const x = await fetch(`${BEFORE.origin}${rm.route}`, { redirect: "manual", headers: { "cache-control": "no-cache" } });
        address = { status: x.status, location: String(x.headers.get("location") || "") };
      } catch { address = null; }
      removal = removalVerdict({
        spec: rm,
        replies: UI_ASK.scenario.steps.map((_, i) => (ui.steps[i] && ui.steps[i].sent ? finalReplyOf(ui.steps[i]) : null)),
        chain,
        before: { ...BEFORE.source, complete: BEFORE.readsComplete === true },
        after: after ? { ...after.source, complete: after.readsComplete === true } : null,
        address, origin: BEFORE.origin,
      });
      removal.address = address;
      console.log("");
      for (const c of removal.checks) check(c.name, c.ok, c.why);
    }
    if (UI_ASK.scenario.publishes === 0) {
      check("the message filed exactly one job", jobs.length === 1, jobs.join(", ") || "none");
      if (legacy) {
        // THE READERS, EACH ITS OWN: the version list, the job's row, every
        // page on the same build and the same once render times are masked,
        // the stylesheet byte for byte, and every stored page and component.
        check("the site's version list was read", !!(list && list.status === 200), list ? String(list.status) : "not read");
        const R = ui.rules || {};
        const surface = surfaceSame(R.before && R.before.surface, R.after && R.after.surface);
        const source = sourceSame(BEFORE.source, after && after.source);
        const up = legacyUnpublishedVerdict({ published, jobs: jobRecords, surface, source });
        check("nothing was published: no version names the job, its row says no publish began, every page is on the same build and the same, the stylesheet and the stored source are byte for byte what they were", up.ok, up.why);
      } else {
        const up = unpublishedVerdict({ published, jobs: jobRecords, chain });
        check("no page was published: no version names the job, its row says no publish began, and every page is still the before version", up.ok, up.why);
      }
      const money = moneyVerdict({ start: ui.balance.start, end: ui.balance.end, routeCosts: routeCostsOf(ui.steps), jobs: jobRecords });
      check(`the money closes: routing ${money.routing ?? "?"} + edit ${money.edits ?? "?"} = the balance's move of ${money.spent ?? "?"}`, money.ok, money.why || `${ui.balance.start} -> ${ui.balance.end}`);
    }
  }
  mkdirSync(EVID, { recursive: true });
  // THE RULES RECORD IS WRITTEN WITH ROW IDS AND NEVER ROW CONTENTS: a
  // booking table's rows are its visitors' names and numbers.
  writeFileSync(`${EVID}/ui.json`, JSON.stringify({ scenario: UI_ASK.name, spend: SPEND, ui: ui.rules ? { ...ui, rules: rulesRecordable(ui.rules) } : ui, chain, removal }, null, 2));
  writeFileSync(`${EVID}/ui.txt`, told + (chain ? `\n  chain ${chain.verified ? "VERIFIED" : "UNVERIFIED (" + chain.why + ")"}\n` : "\n")
    + (removal ? `  page removal ${removal.ok ? "HAPPENED" : "DID NOT HAPPEN"}\n${removal.checks.map((c) => `    ${c.ok ? "ok  " : "FAIL"}  ${c.name}${c.ok ? "" : " — " + c.why}`).join("\n")}\n` : ""));
  console.log(`\n${failed ? "UI MODE FAILED" : "UI MODE PASSED"}: ${ui.sent} message${ui.sent === 1 ? "" : "s"} sent${ui.stopped ? `; stopped at ${ui.stopped.at}` : ""}`);
  process.exit(failed ? 1 : 0);
}
if (!SPEND) {
  console.log("CANARY_SPEND is not 1 — stopping before the paid edit. Nothing was charged.");
  process.exit(failed ? 1 : 0);
}
if (failed) {
  console.log("REFUSING TO SPEND: a free check failed, and the paid edit would tell us less than these already did.");
  process.exit(1);
}

// ── AND THE ASK ITSELF IS DEMANDED, ABOVE EVERY PAID CALL ──────────────────
//
// ⚠ RUN 14 (2026-09-21) WAS DISPATCHED WITH THIS FIELD EMPTY AND SPENT ANYWAY.
// The read was `process.env.CANARY_INSTRUCTION || "<a CTA-colour ask>"`, so a
// blank form field became a real paid request for something nobody had asked
// for — and it routed correctly, which is the worst available outcome: the run
// produced a complete, plausible routing answer about a request that was never
// made, and it was written up as evidence about the one that was.
//
// THE REFUSAL SITS ABOVE THE ROUTING CALL, not beside the edit POST. Routing
// is billed on its own — run 14 moved the balance by 2 for it and published
// nothing — so a gate below it is a gate that has already spent.
const ASKED = readInstruction(process.env.CANARY_INSTRUCTION);
if (!ASKED.ok) {
  console.error(instructionRefusal(ASKED.why));
  process.exit(1);
}
const INSTRUCTION = ASKED.instruction;

// ── THE ONE PAID EDIT ──────────────────────────────────────────────────────

console.log("PAID CANARY EDIT — exactly one\n");
// RE-READ RATHER THAN REUSE `BAL`: the free half runs a whole job between
// them, and the number this run is measured against is the one immediately
// before the spend. One reader, asked twice.
const before = await balanceNow();
console.log(`  balance before: ${before}`);

// WHAT WAS REALLY SENT, WRITTEN DOWN BEFORE ANYTHING IS SPENT. The evidence
// bundle recorded the routing answer, the terminal body and the customer's
// screen, and nowhere in it the one input that decides all three. From outside,
// a run that asked for X and a run that asked for Y are indistinguishable.
console.log(`  instruction: ${JSON.stringify(INSTRUCTION)}`);
writeFileSync(`${EVID}/request.json`, JSON.stringify({
  slug: CANARY, control: CONTROL, instruction: INSTRUCTION,
  instructionChars: INSTRUCTION.length, source: "CANARY_INSTRUCTION",
}, null, 2));

// ── ROUTE FIRST, BECAUSE THAT IS WHERE THE LAYER COMES FROM ────────────────
//
// THE EDIT ROUTE DOES NOT DECIDE ITS OWN LAYER. `/api/site/route` does, and
// `public/chat.js` posts the answer on — so an edit POSTed with `layer: ""`
// matches none of the nine branches and falls through to `escalate("layer")`
// for nothing. That is exactly what the first paid canary did on 2026-09-01:
// 202 in 1.0s, queued, claimed, replayed, terminal in 7.9s, `billing: none`,
// `cost: 0`, balance unmoved — a run that looked like a complete pass and had
// not made a single model call, run a lane, compiled anything or published.
//
// It is this repo's own wiring trap seen from the CALLER's side, and worse
// than the usual shape because the missing hop wore the costume of success.
// The edit route's `layer:` field carries a comment about the same field being
// dropped from the ROUTE's response — the identical cut, one hop upstream.
//
// SO THE CANARY DOES WHAT THE CLIENT DOES: ask the router, carry every field
// it decides. The routing call is a real ~0.3-credit charge and belongs to the
// paid half, which is why it sits below the free checks and behind CANARY_SPEND.
//
// AND THE ROUTER IS TOLD THE SITE'S PAGES, THE WAY THE BROWSER TELLS IT. This
// sent `pages: []` until run 23, so the router named a page from the sentence
// alone and `readEdit`'s check against the real list never ran: the
// places-left ask routed to `/book`, which fretwork-1 does not have, and the
// run paid for routing and edited nothing. The browser fills the list from
// this same route (`siteRoutesFetch`), so the harness asks it too and refuses
// to spend on an answer it cannot read — see `readRoutes`.
//
// `tables: []` is what a browser sends for a site it adopted off the list
// (`fromRow` carries none); a browser that built the site sends the build's.
const rr = await call("GET", `/api/site/routes?slug=${encodeURIComponent(CANARY)}`);
const RP = readRoutes(rr.status, rr.json);
if (!RP.ok) {
  console.error("  " + routesRefusal(CANARY, RP.why));
  process.exit(1);
}
console.log(`  pages sent to the router: ${RP.pages.join(", ")}`);
const digest = { name: CANARY, url: `https://${CANARY}.gofarther.app`, pages: RP.pages, tables: [] };
const rt = await call("POST", "/api/site/route", {
  body: { message: INSTRUCTION, site: digest, firstBuild: false, brief: INSTRUCTION,
          qa: [], answering: false, attached: false, slug: CANARY, hasSite: true },
});
const rd = (rt.json || {});
console.log(`  routed in ${(rt.ms / 1000).toFixed(1)}s: intent=${rd.intent || "?"} layer=${rd.layer || "-"} page=${rd.page || "-"} cost=${rd.cost ?? "?"}${rd.failed ? " FAILED" : ""}`);

// THE ANSWER IS WRITTEN DOWN BEFORE ANYTHING IS DECIDED ON IT. `routing.json`
// was written after the watch, so a refusal below left no record of the answer
// it refused (Batch 1). The expectation and its verdict ride along only when
// the press named one, so an ordinary run's file keeps its shape.
const ROUTE_VERDICT = EXPECT_ROUTE.expect ? routeVerdict(EXPECT_ROUTE.expect, rd) : null;
writeFileSync(`${EVID}/routing.json`, JSON.stringify({ instruction: INSTRUCTION, site: digest, status: rt.status, ms: rt.ms, body: rd,
  ...(ROUTE_VERDICT ? { expected: EXPECT_ROUTE.expect, verdict: ROUTE_VERDICT } : {}) }, null, 2));

// REFUSE TO SPEND BLIND. A blank layer costs nothing and proves nothing, and
// the whole danger is that it PASSES: the round trip completes, the poll
// returns a terminal answer, and the canary reports green having tested the
// queue and none of the work. A visible refusal is the only honest outcome.
if (rt.status !== 200 || rd.intent !== "edit" || !rd.layer) {
  console.error(`  REFUSING TO SPEND: the router did not name an edit layer (${rt.status} ${rt.text.slice(0, 160)}).`);
  console.error("  Posting the edit anyway would escalate on `layer` for cost 0 and prove nothing.");
  process.exit(1);
}
// AND THE ROUTE THIS PRESS EXPECTED, when it named one. Another answer is
// refused here, above the edit POST: the routing call is spent and nothing else
// is. A matching answer is posted exactly as it came, because the body below
// never reads the expectation.
if (ROUTE_VERDICT) {
  if (!ROUTE_VERDICT.ok) {
    console.error(`  REFUSING TO POST THE EDIT: not the route this press expected — ${mismatchSaid(ROUTE_VERDICT)}.`);
    console.error(`  Expected ${expectSaid(EXPECT_ROUTE.expect)}. The routing call is spent and nothing else is; the answer is in ${EVID}/routing.json.`);
    process.exit(1);
  }
  console.log(`  the route matches the expectation (${expectSaid(EXPECT_ROUTE.expect)}); the answer is posted as it came`);
}

const idem = hex32();
const t0 = Date.now();
const p = await call("POST", `/api/site/${encodeURIComponent(CANARY)}/edit`,
  { body: {
      instruction: INSTRUCTION, idem,
      // EVERY FIELD THE ROUTER DECIDES, carried exactly as `siteEdit` carries
      // them. Sending only `layer` would work today and break the moment the
      // canary's instruction routes to a rung that needs one of the others.
      layer: String(rd.layer || ""),
      page: rd.page ? String(rd.page) : "",
      remove: rd.remove === true,
      rename: typeof rd.rename === "string" ? rd.rename : "",
      tab: rd.tab === true,
      // AND WHAT THE ROUTER HELD BACK (2026-09-29), which the route takes out
      // of the instruction before anything runs — run 52 is why.
      alsoAsked: typeof rd.alsoAsked === "string" && rd.alsoAsked ? rd.alsoAsked : undefined,
    } });
console.log(`  POST returned ${p.status} in ${(p.ms / 1000).toFixed(1)}s: ${p.text.slice(0, 200)}`);
if (p.status !== 202 || !p.json || !p.json.job) { console.error("  the POST did not queue a job"); process.exit(1); }
const job = p.json.job;

// ── THE WATCH IS THE BROWSER'S, NOT A SECOND IDEA OF IT ────────────────────
//
// ⚠ THIS LOOP USED TO END ONLY ON HTTP 200, AND RUN 14 IS WHAT THAT COSTS.
// A finished edit hands back its STORED REPLY under `x-gf-edit: final`, and
// that reply keeps its OWN status — 422 for a compile failure, 503 for a model
// outage. By number alone a stored 503 is a transient one, which is the exact
// sentence `EditPoll.readPoll`'s comment already carried; reading it that way
// polls past the thing being waited for. Run 14 ran all 260 iterations
// (260 × 3s + latency = 845.2s), then reported "the job did not finish inside
// the watch" — a claim about the JOB made from a fact about the HARNESS.
//
// `readPoll` is the browser's own four-way answer and it is asked here rather
// than re-derived, so the harness and the customer's screen can never disagree
// about what a given response meant.
const watch = await watchEdit((i) => call("GET", `/api/site/edit/${job}`), {
  onTick: (i, q, act) => {
    if (i % 4 !== 0) return;
    const b = q.json || {};
    // THE HTTP STATUS AND THE ACT ARE ON THE LINE. Without them a run that
    // spent its whole watch retrying a 503 logs identically to one that waited
    // on a job still genuinely running — and run 14's log is the proof: its
    // `? / verify` rows cannot be read either way, because the status was
    // never printed.
    console.log(`  ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ${q.status}  ${act.act.padEnd(5)}  ${b.status || "?"}${b.phase ? " / " + b.phase : ""}  cost=${b.cost ?? "?"}`);
  },
});
const rep = watchReport(watch);
// `done` IS A STORED REPLY OR NOTHING. Every downstream reader of it — the
// evidence write, the execution-path print, the customer's composer — is a
// reader of the EDIT'S answer, and a job-state row is not that.
const done = watch.kind === "reply" ? watch.q : null;
console.log(`\n  settled after ${((Date.now() - t0) / 1000).toFixed(1)}s — ${rep.headline}`);
console.log(`  polls ${watch.polls}, transient read failures ${watch.retries}`);
if (done) console.log("  " + done.text.slice(0, 600));
else if (rep.message) console.log("  the browser would say: " + rep.message);

const after = await balanceNow();
console.log(`\n  balance after: ${after}  (moved ${(before - after).toFixed(2)})`);

// ── WHAT ACTUALLY HAPPENED, AND WHAT THE CUSTOMER WOULD READ ───────────────
//
// THE EXECUTION PATH IS READ, NEVER INFERRED. The merged reply carries
// `lanes` — a deduped union of every rung's fields — so the lanes the picker
// chose are on the wire. `tweak: true` marks a PUBLISHED TWEAK, and its
// ABSENCE proves nothing on its own: it reads the same for a `withheld`
// refusal, a lane that never reached the page rung, an escalate and a
// failure. Print all of it and let the reader judge.
const rb = done && done.json ? done.json : null;
// `routing.json` is written above, the moment the router answers.
// THE STATUS AND THE FINAL HEADER SURVIVE INTO THE RECORD, because they are
// what separates the three outcomes that used to write the same file: a
// completed failure (a stored reply at 422/503), a terminal job with nothing
// stored, and a watch that simply ran out. Run 14 wrote `{status: 0, body:
// null}` for the third and the bundle could not say which it had been.
writeFileSync(`${EVID}/terminal.json`, JSON.stringify({
  watch: watch.kind,
  outcome: watch.outcome || null,
  headline: rep.headline,
  polls: watch.polls,
  transientReadFailures: watch.retries,
  status: done ? done.status : null,
  finalHeader: done ? (done.headers || {})[EditPoll.FINAL_HEADER] || null : null,
  body: rb,
  text: done ? done.text : "",
}, null, 2));

console.log("\nEXECUTION PATH");
console.log(`  router      intent=${rd.intent || "?"} layer=${rd.layer || "-"} page=${rd.page || "-"} cost=${rd.cost ?? "?"}`);
console.log(`  lanes       ${Array.isArray(rb && rb.lanes) ? rb.lanes.join(", ") : "(none on the reply)"}`);
console.log(`  layer       ${(rb && rb.layer) || "-"}`);
console.log(`  tweak       ${rb && rb.tweak === true ? "true (a published tweak)" : "absent — NOT proof a rewrite ran"}`);
console.log(`  cost        ${rb ? rb.cost : "?"}`);
console.log(`  photosKept  ${rb && rb.photosKept != null ? rb.photosKept : "absent (nothing needed restoring — the ordinary outcome)"}`);
console.log(`  photosRemoved ${rb && rb.photosRemoved != null ? rb.photosRemoved : "absent"}`);
if (rb && rb.error) console.log(`  error       ${rb.error}  ${rb.msg || ""}`);
if (rb && Array.isArray(rb.partial) && rb.partial.length) console.log(`  partial     ${JSON.stringify(rb.partial)}`);

// THE CUSTOMER'S OWN SCREEN, composed by the browser's real selection.
//
// ⚠ THE TEXT IS HALF THE ANSWER AND THE SILENT HALF IS THE EXPENSIVE ONE
// (2026-09-21, run 12). `editBrowserReply` has ALWAYS returned `actions` — a
// record of what the real browser would do beside printing — and this block
// read only `.text`, so an escalate wrote an EMPTY `customer-reply.txt` and
// the capture said nothing at all about the ~25-credit rewrite the page would
// then start. `addonAnswer`'s own reader (`customerLines`) had printed the
// actions for weeks; this one never did.
//
// `shown` IS WHY THE BLANK IS NOT A FAILURE TO COMPOSE. The escalate and hop
// branches never call `finish`, so an empty string here is a branch that ACTS
// instead of printing — and a harness that cannot tell that from a composer
// that answered "" is reporting two opposite outcomes as one.
//
// NOTHING IS DONE. The two arms that reach outside are injected recorders and
// `siteById` answers `null`, so this costs nothing and posts nothing.
//
// ⚠ AND IT RUNS ON A STORED REPLY OR NOT AT ALL (2026-09-21, run 14).
// `editAnswer`'s FIRST branch is `if (!e) … return o.fallback()`, under its own
// comment that a body we cannot read is not a refusal — so composing over a
// null body records the ~25-credit rewrite as the action the page would take.
// Run 14's watch gave up, handed this `null`, and the bundle reported that
// fallback as a finding about the product. A real browser polling a running
// job shows `running`; it is never handed null. So `watchReport` decides
// whether there is anything to compose FROM, and an unknown outcome says so.
// (And `editAnswer` no longer falls back on a null body at all — 2026-09-23 —
// so even composed it would now read "can't tell", not a rewrite.)
//
// `rd` IS THE ROUTING REPLY, handed over as the browser holds it (2026-09-23):
// its `layer` is what a sideways hop is decided against, and its `cost` is the
// routing charge the screen now states beside the edit's own on a refusal.
const said = rep.compose ? editBrowserReply(rb, done.status >= 200 && done.status < 300, rd) : null;
const sActs = said && Array.isArray(said.actions) ? said.actions : [];
console.log("\nWHAT THE CUSTOMER READS");
if (!said) console.log(`  (not composed — ${rep.headline})${rep.message ? "\n  the browser's own sentence: " + rep.message : ""}`);
else if (!said.ok) console.log(`  (could not compose: ${said.why})`);
else if (said.text) console.log("  " + said.text);
else console.log(said.shown
  ? "  (the composer answered an empty string — the screen shows nothing)"
  : "  (nothing is shown — this reply takes a branch that ACTS instead of printing)");
if (sActs.length) {
  console.log(`\n  and the browser would then (NOT done here — recorded only), ${sActs.length}:`);
  for (const a of sActs) console.log(`    -> ${a}`);
}
writeFileSync(`${EVID}/customer-reply.txt`, !said
  // NOT "" AND NOT A GUESS. An unknown outcome has no customer screen to
  // record, and a blank file here reads identically to a composer that
  // answered nothing — which is the pair run 12 already had to split apart.
  ? `not composed — ${rep.headline}${rep.message ? "\n\nthe browser's own sentence for this outcome:\n  " + rep.message : ""}`
  : said.ok
  ? [said.text || (said.shown ? "(the composer answered an empty string)" : "(nothing shown — this reply ACTS instead of printing)"),
     ...(sActs.length ? ["", `the browser would then (NOT done here — recorded only), ${sActs.length}:`, ...sActs.map((a) => "  -> " + a)] : [])].join("\n")
  : `could not compose: ${said.why}`);

// ── THE AFTER-READ WAITS FOR THIS JOB'S OWN VERSION ────────────────────────
//
// ⚠ RUN 32 (2026-09-25) READ THE PREVIOUS BUILD. The after-read ran as soon as
// the stored reply arrived, 7.9 s after the job recorded its publish, and the
// old script answered: `compare.json` compared the old page with itself and
// reported a real section move as no change. A read a minute later got the new
// build. So the after-read now waits — BOUNDED — for the site to report the
// version THIS job published, found by this job's own id in the site's version
// list, never "whatever is newest". A wait that runs out, or a later publish
// landing first, leaves the comparison UNVERIFIED, and it is said.
const body = done && done.json ? done.json : null;
const published = !!(body && body.ok === true);
const BEFORE_VERSION = sameVersion(Object.values(BEFORE.render).map((v) => v.version));
const versionList = published ? await call("GET", `/api/site/${encodeURIComponent(CANARY)}/versions`) : null;
const TARGET = afterReadTarget({ published, before: BEFORE_VERSION, list: versionList, job });
console.log("\nWHICH BUILD THE AFTER-READ MUST SEE");
console.log(`  before-read  ${BEFORE_VERSION || "(not one readable version)"}`);
console.log(`  target       ${TARGET.ok ? TARGET.id + (published ? `  (this job's; built from ${TARGET.parent || "-"})` : "  (unpublished: nothing should have moved)") : "none — " + TARGET.why}`);
const liveRead = async () => {
  try {
    const r = await fetch(`${BEFORE.origin}/?after-check=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
    return { version: String(r.headers.get("x-site-version") || "") };
  } catch { return { version: "" }; }
};
const WAIT = TARGET.ok ? await awaitVersion({ read: liveRead, expect: TARGET.id }) : { kind: "no-target", reads: 0, seen: "" };
console.log(`  wait         ${WAIT.kind} after ${WAIT.reads} read${WAIT.reads === 1 ? "" : "s"}${WAIT.seen && WAIT.kind !== "match" ? " (last read " + WAIT.seen + ")" : ""}`);

// ── BEFORE / AFTER EVIDENCE ────────────────────────────────────────────────
console.log(`\nINVENTORY — after (written to ${EVID}/after)\n`);
const AFTER = await inventory("after", WAIT.kind === "match" ? TARGET.id : "");
const VERDICT = afterReadVerdict({ published, before: BEFORE_VERSION, target: TARGET, wait: WAIT, after: AFTER.render });
const SAID = verdictSentence(VERDICT);
const cmp = { slug: CANARY, comparison: { ...VERDICT, sentence: SAID, wait: { kind: WAIT.kind, reads: WAIT.reads, seen: WAIT.seen } }, routes: {}, parts: {} };
for (const r of Object.keys(BEFORE.render)) {
  const b = BEFORE.render[r], a = AFTER.render[r] || { photos: [], headings: [], words: 0 };
  const lostPix = b.photos.filter((u) => !a.photos.includes(u));
  const newPix = a.photos.filter((u) => !b.photos.includes(u));
  const moved = JSON.stringify(b.headings) !== JSON.stringify(a.headings);
  cmp.routes[r] = { versionBefore: b.version || "", versionAfter: a.version || "",
                    photosBefore: b.photos.length, photosAfter: a.photos.length, lost: lostPix, gained: newPix,
                    headingsBefore: b.headings, headingsAfter: a.headings, orderChanged: moved,
                    wordsBefore: b.words, wordsAfter: a.words };
  console.log(`  ${r.padEnd(14)} photos ${b.photos.length}->${a.photos.length}${lostPix.length ? "  LOST " + lostPix.length : ""}  order ${moved ? "CHANGED" : "same"}`);
  if (moved) { console.log(`      before: ${b.headings.join(" | ")}`); console.log(`      after : ${a.headings.join(" | ")}`); }
}
const partsBefore = BEFORE.parts.map((p) => p.path).sort();
const partsAfter = AFTER.parts.map((p) => p.path).sort();
cmp.parts = { before: partsBefore, after: partsAfter, preserved: JSON.stringify(partsBefore) === JSON.stringify(partsAfter) };
console.log(`  components  ${partsBefore.length} -> ${partsAfter.length}  ${cmp.parts.preserved ? "preserved" : "CHANGED"}`);
cmp.stored = { before: BEFORE.stored, after: AFTER.stored };
console.log(`  stored description  ${storedHeadSaid(BEFORE.stored)} -> ${storedHeadSaid(AFTER.stored)}`);
writeFileSync(`${EVID}/compare.json`, JSON.stringify(cmp, null, 2));

// THE PRESERVATION VERDICT, stated as its own line so a published edit that
// lost a photograph cannot read as a pass on the strength of `ok: true`.
//
// ⚠ AND ONLY A VERIFIED COMPARISON MAY PASS OR FAIL IT (run 32). Pages read
// from the wrong build pass every one of these checks while saying nothing
// about this job, so an unverified comparison is printed as UNVERIFIED — never
// as ok, never as FAIL.
console.log(`\n  comparison  ${SAID}`);
const anyLost = Object.values(cmp.routes).some((v) => v.lost.length > 0);
if (VERDICT.verified) {
  check("no route lost an on-page photograph", !anyLost,
    anyLost ? Object.entries(cmp.routes).filter(([, v]) => v.lost.length).map(([r, v]) => `${r}:${v.lost.length}`).join(" ") : "none lost");
  check("the stored components are preserved", cmp.parts.preserved, `${partsBefore.length} -> ${partsAfter.length}`);
} else {
  console.log("  UNVERIFIED  no route lost an on-page photograph — the pages were not read at this job's version");
  console.log("  UNVERIFIED  the stored components are preserved — the comparison is not tied to this job's version");
}
if (!partsBefore.length) {
  console.log("  NOTE  this fixture has no stored component, so the components half of the");
  console.log("        preservation guard is OUTSTANDING after this run — not disproved, untested.");
}

// ── A TERMINAL ANSWER IS NOT A PASS ────────────────────────────────────────
//
// The first paid canary reached a terminal state in 7.9 seconds and reported
// nothing wrong: the queue had done its whole job and the EDIT had not
// happened. `done` alone therefore certifies the transport and nothing else,
// which is precisely how that run passed.
//
// What this run exists to prove is that a queued edit REACHES A LIVE SITE, so
// the verdict is `ok: true` — a rung that ran, compiled and published. An
// escalate is a legitimate product answer and a failed canary: it means the
// paid half stopped before the thing under test.
// ⚠ AND THE THREE NON-REPLY OUTCOMES GET THREE SENTENCES, NOT ONE. "No
// terminal answer inside the watch" was written for every one of them and is
// only true of the last — a completed failure DID answer, and a lost job DID
// reach a terminal state. Saying it of a timeout also overstates it: what ran
// out was this watch, not the job.
if (!done) console.error(`\nCANARY FAILED: ${rep.headline}.`);
else if (!published) {
  console.error(`\nCANARY FAILED: the edit did not publish — ${body && body.escalate ? "escalated on `" + body.reason + "`" : "answered " + JSON.stringify(body && body.error)}.`);
  console.error("This is a completed round trip that changed nothing. Do not read it as a pass.");
} else {
  console.log(`\nCANARY PASSED: layer=${body.layer || "?"} published, cost=${body.cost ?? "?"}`);
  // THE VERDICT ON THE TRANSPORT IS NOT A VERDICT ON THE COMPARISON, and the
  // line after it says which one this run has.
  console.log(`The before/after comparison: ${SAID}`);
}
process.exit(published ? 0 : 1);
