// One real build as the OWNER'S OWN ACCOUNT, with a step log for review.
//
// Written 2026-08-21 at the owner's request ("run the build with my account,
// log every single step"). This is deliberately NOT the smoke test: it makes
// no assertions, tears NOTHING down — no user delete, no site delete, no Neon
// delete — and the site it builds belongs to the real account, which is what
// makes the orphan bug (SMOKE_KEEP_SITE vs the user-delete cascade) impossible
// here by construction.
//
// NO PASSWORD ANYWHERE. The runner holds the Supabase service key, so it signs
// in via an ADMIN magic link: generate_link returns a one-time token hash,
// /verify exchanges it for a session. The password is never asked for, never
// stored, never printed — and neither is any token or key: the log prints
// lengths and statuses, never values.
//
// EVERY STEP IS LOGGED twice — to stdout (the Actions job log) and to
// build-as-owner-log.md, which the workflow uploads as an artifact so the
// owner can read the whole run afterwards.

import fs from "node:fs";
import https from "node:https";
import { ownerSession, desc } from "./owner-session.mjs";

/**
 * POST with NO HEADERS TIMEOUT, because `fetch` has one and a build can outrun it.
 *
 * MEASURED, NOT GUESSED: undici — the engine behind Node's global fetch — gives up
 * if response headers have not arrived in 300s, and it is not overridable through
 * the fetch options (an AbortSignal set longer does not raise it; the headers
 * timeout fires first). GatherHire returned in 272.2s and the Arabic build ran
 * past 300s, so the ceiling had always been one slow build away.
 *
 * THE SECOND HALF OF THAT PARAGRAPH USED TO SAY the cost of hitting it is the
 * BUILD, because Cloudflare cancels a Worker when its client goes away. TRUE
 * UNTIL 2026-08-23 AND FALSE SINCE: the build is a queued job now — the POST
 * stores it, sends a message, and a consumer runs it — so a dropped connection
 * costs the ANSWER and not the SITE. Proven live: a socket destroyed at 30.0s
 * and the site published 11m58s later. The catch below already says so.
 *
 * `node:https` has no such timeout of its own, which is the whole reason it is
 * here rather than fetch. Everything else in this file still uses fetch: those
 * calls answer in milliseconds and none of them can be worth a second mechanism.
 *
 * ── AND HAVING NO CEILING AT ALL WAS THE BUG (2026-08-24) ───────────────────
 *
 * Measured on run 32723813218: the build FINISHED at 12:02:02Z (`site_builds`
 * says `done: true, ok: true, total_ms: 528542`, and the site answers 200), and
 * this step was still running **75 minutes later**. `req.on("error")` fires only
 * on a real socket error, so a connection that dies SILENTLY — no FIN, no RST,
 * which is what a middlebox dropping state on a long-idle connection produces —
 * hangs here for ever, or until the 350-minute job cap.
 *
 * WHAT MADE IT SURVIVE IS THAT THE JUSTIFICATION WENT STALE A DAY BEFORE. While
 * hanging up really did kill the build, having no ceiling was correct and there
 * was nothing to weigh; the queue reversed that and nobody re-asked the timeout
 * question. A rule true because of something one layer down expires when that
 * layer moves, and nothing announces it.
 *
 * THE BOUND IS THE WORKER'S OWN, PLUS DELIVERY. `QUEUE_WAIT_MS` is 16 minutes:
 * past it the Worker stops waiting on the consumer and answers, so a reply that
 * has not arrived by 18 has no path left to arrive by. One number, one meaning
 * — not a second guess at how long a build takes.
 *
 * IT REJECTS RATHER THAN RESOLVING, so it lands in the branch that already
 * exists: `disconnected = true`, then watch the trace and the site. That path is
 * proven (arm C, 2026-08-23) and is strictly better than waiting — it can see a
 * build that finished. Until now the ONLY way to reach it was a reset.
 *
 * AND IT NAMES ITSELF. The catch prints `e.code || e.message`, so a bare timeout
 * would read as a network fault on a run where the network was fine.
 */
const QUEUE_WAIT_MINUTES = 16;                     // worker.js: QUEUE_WAIT_MS
const POST_CEILING_MS = (QUEUE_WAIT_MINUTES + 2) * 60 * 1000;

function postLong(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = Buffer.from(body, "utf8");
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { ...headers, "content-length": payload.length },
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { text += c; });
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", reject);
    // CLEARED ON RESPONSE AND ON CLOSE, so a healthy run never carries a live
    // timer — an uncleared one holds the process open past its own exit.
    const stop = setTimeout(() => req.destroy(new Error(
      `no answer in ${POST_CEILING_MS / 60000} minutes — past the Worker's own ${QUEUE_WAIT_MINUTES}-minute wait, so none is coming`,
    )), POST_CEILING_MS);
    const clear = () => clearTimeout(stop);
    req.on("response", clear);
    req.on("close", clear);
    req.write(payload);
    req.end();
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
// The anon key is the PUBLIC client key — it ships in public/auth.js on
// every page load, so defaulting it here is reading our own frontend, not
// weakening anything. The first run died on `secrets.SUPABASE_ANON_KEY`
// being unset in the repo; the smoke workflow lists the same name, which
// means its own anon-dependent paths inherit the same hole — recorded, not
// chased tonight.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
// THE DISPATCHED BRIEF WINS, THE STOCK ONE IS THE FALLBACK (2026-08-30). The
// workflow could vary the slug, the instruction, the layer and the model but not
// the business — so every owner build was the same shoe shop, which can never
// reach an optional design field it has no use for.
const BRIEF = String(process.env.OWNER_BRIEF || "").trim() || process.env.OWNER_BRIEF_DEFAULT || "";
const SLUG = String(process.env.OWNER_SLUG || "").trim().toLowerCase();
// Which model builds. Unset sends nothing and the Worker uses its own default,
// so a run that does not care is byte-identical to what this script always sent.
const PICKER = String(process.env.OWNER_PICKER || "").trim();

// ── BUILD OR EDIT, ONE ACCOUNT, ONE SIGN-IN ─────────────────────────────────
//
// Both paths share everything hard — the admin sign-in, the balance read, the
// reachability probe — and a forked copy of the auth block is two lists of the
// same thing waiting to drift, this repo's most-recorded trap. So `edit` is a
// branch after sign-in, not a second script.
//
// `edit` POSTs THE CHEAP LADDER, not the whole revise. The chatbox routes a
// later message through `/api/site/route` (a Haiku classifier) and, for a look
// or text or data change, calls `/api/site/<slug>/edit` with a LAYER — a
// ~0.3–1 credit change that does NOT rewrite pages. `/api/site/react-revise`
// is the ~25-credit fallback for the cases the ladder cannot express, and
// posting straight to it (as a first cut of this script did) tests the wrong
// thing at 20× the cost. So the edit branch hits the ladder endpoint with the
// layer named — `look` by default, which is the free-CSS lane.
const MODE = String(process.env.OWNER_MODE || "build").trim().toLowerCase();
const INSTRUCTION = process.env.OWNER_INSTRUCTION || "";
// The layer the edit lives in — `look` (free CSS), `text`, `data`, `nav`,
// `picture`, `logo`, `rules`, `page`. Forced rather than routed so the test
// aims at exactly the lane it means to, instead of trusting the classifier.
const LAYER = String(process.env.OWNER_LAYER || "look").trim().toLowerCase();
const IS_EDIT = MODE === "edit";

const LOG_FILE = "build-as-owner-log.md";
const t0 = Date.now();
const lines = ["# Build-as-owner run log", "", "Started " + new Date().toISOString(), ""];
function log(msg) {
  const line = `[+${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(6)}s] ${msg}`;
  console.log(line);
  lines.push(line);
  fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}
function fail(msg) { log("FATAL: " + msg); process.exit(1); }

// Redaction discipline: a secret is described by its length, never shown.
// ONE COPY, in owner-session.mjs, where the sign-in that uses it most now lives.

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
if (IS_EDIT) {
  if (!SLUG) fail("OWNER_MODE=edit needs OWNER_SLUG — there is nothing to revise without a site");
  if (!INSTRUCTION) fail("OWNER_MODE=edit needs OWNER_INSTRUCTION — the change to make");
} else if (!BRIEF) {
  fail("OWNER_BRIEF is not set");
}
log(`step 0 — inputs: mode=${MODE}${IS_EDIT ? ` layer=${LAYER}` : ""} email=${EMAIL} base=${BASE} service_key=${desc(SERVICE_KEY)} anon_key=${desc(ANON_KEY)}`);
log(IS_EDIT
  ? `step 0 — edit "${SLUG}" [${LAYER}] (${INSTRUCTION.length} chars): ${INSTRUCTION}`
  : `step 0 — brief (${BRIEF.length} chars): ${BRIEF}`);

// ── steps 1 and 2: sign in as the owner via an admin magic link ─────────────
//
// IMPORTED, NOT WRITTEN HERE, since `answer-read.mjs` started needing the same
// handshake. Its own log lines are unchanged — they are inside the module, so
// the two callers cannot describe one sign-in two ways. See owner-session.mjs.
let auth;
try {
  ({ auth } = await ownerSession({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, anonKey: ANON_KEY, email: EMAIL, log }));
} catch (e) { fail(String((e && e.message) || e)); }

// ── step 3: balance before ──────────────────────────────────────────────────
const before = await fetch(`${BASE}/api/credits`, { headers: auth }).then((r) => r.json()).catch(() => null);
log(`step 3 — balance BEFORE: ${JSON.stringify(before)}`);

// ── EDIT: THE CHEAP LADDER, ITS OWN SHORT PATH ──────────────────────────────
//
// `/api/site/<slug>/edit` answers synchronously with a JSON verdict — the
// client's `siteEdit` reads `r.json()` and follows no job, because a cheap
// layer recompiles and returns rather than firing an async build. So the edit
// path is post → read → measure, no ticker and no resume: everything the build
// block needs those for is a property of the build, not of a layer edit.
//
// The body mirrors `siteEdit` exactly — the layer, and the fields the router
// would fill for the richer layers (a page path, a removal, a rename, a tab
// slot) sent empty, so the ONE shape covers every layer and cannot disagree
// with the client's for the one under test.
if (IS_EDIT) {
  log(`step 4 — POST /api/site/${SLUG}/edit  [layer ${LAYER}]${PICKER ? ` picker "${PICKER}"` : ""}`);
  const et = Date.now();
  const res = await postLong(`${BASE}/api/site/${encodeURIComponent(SLUG)}/edit`, auth, JSON.stringify({
    layer: LAYER,
    page: "",
    remove: false,
    rename: "",
    tab: false,
    instruction: INSTRUCTION,
    ...(PICKER ? { picker: PICKER } : {}),
  }));
  const secs = ((Date.now() - et) / 1000).toFixed(1);
  let e = null;
  try { e = JSON.parse(res.text); } catch { /* printed raw below */ }
  log(`step 4 — answered ${res.status} in ${secs}s`);
  if (!e) {
    log(`step 4 — body was not JSON: ${String(res.text).slice(0, 400)}`);
  } else {
    // THE VERDICT, READ OFF THE RESPONSE. `escalate` means the layer could not
    // express the change and the ladder would climb — a real answer, not a
    // failure. `ok`, the layer it ran, whatever it moved, and the builder's own
    // words are each printed when present rather than assumed.
    log(`step 5 — ok=${e.ok} layer=${e.layer || LAYER}${e.escalate ? ` ESCALATE→${e.escalate}` : ""}`);
    if (e.moved) log(`step 5 — moved: ${JSON.stringify(e.moved)}`);
    if (e.cssMoved !== undefined) log(`step 5 — cssMoved=${e.cssMoved}`);
    if (e.cost !== undefined || e.billed !== undefined) log(`step 5 — cost=${JSON.stringify(e.cost)} billed=${e.billed}`);
    if (e.msg || e.notes) log(`step 5 — reply: ${e.msg || e.notes}`);
    if (e.cssNote) log(`step 5 — css note: ${e.cssNote}`);
    if (e.render || e.renderNote) log(`step 5 — render: ${JSON.stringify(e.render || e.renderNote)}`);
    if (e.error) log(`step 5 — error: ${e.error}`);
    // THE DETAIL, WHICH THIS DID NOT PRINT AND SHOULD HAVE. Two live runs were
    // spent diagnosing a refusal from its customer-facing sentence alone, while
    // `detail` — "no site recorded for <slug>" — was sitting on the same
    // response unread. A harness that hides the diagnostic half of an answer
    // turns every failure into a guess.
    if (e.detail) log(`step 5 — detail: ${e.detail}`);
    if (e.reason) log(`step 5 — reason: ${e.reason}`);
    // AND THE SAME TRAP AGAIN, ONE FIELD-SET OVER (run 95, 2026-08-31). The
    // note above was written for `detail`/`reason`, which is what an ESCALATE
    // carries. A model-call failure is a different envelope — `modelDown` sends
    // `upstream`, `upstreamType`, `billing`, `timeout`, `waitedMs` and `kind` —
    // and this printed none of them, so a run that answered `error: send` in
    // 27.7s said nothing about which side had failed. `kind` was `TimeoutError`
    // on the wire the whole time. Fixing one envelope's diagnostics is not
    // fixing the harness; print whatever the failure came with.
    if (e.timeout) log(`step 5 — OUR ceiling, not the provider: waited ${e.waitedMs}ms`);
    if (e.upstream || e.upstreamType || e.billing) {
      log(`step 5 — upstream: status=${e.upstream} type=${e.upstreamType}${e.billing ? " BILLING" : ""}`);
    }
    if (e.kind) log(`step 5 — kind: ${e.kind}`);
    // RUN 96 READS THIS BLOCK AS MUCH AS IT READS THE LANE. If the ceiling was
    // the whole story the edit now goes through; if it was not, these lines are
    // what turn the next failure from a guess into a fact.
  }

  const eAfter = await fetch(`${BASE}/api/credits`, { headers: auth }).then((r) => r.json()).catch(() => null);
  log(`step 6 — balance AFTER: ${JSON.stringify(eAfter)}`);
  if (before && eAfter) log(`step 6 — spent this edit: ${Number(before.balance) - Number(eAfter.balance)} credits`);

  const eUrl = `https://${SLUG}.gofarther.app/`;
  try {
    const site = await fetch(eUrl, { redirect: "follow" });
    const html = await site.text().catch(() => "");
    const cssHash = (html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.css)/) || [])[1] || "(none)";
    log(`step 7 — GET ${eUrl} -> ${site.status} (${html.length} bytes); stylesheet ${cssHash}`);
  } catch (err) {
    log(`step 7 — could not probe the site (${String((err && err.message) || err).slice(0, 120)})`);
  }
  log(`the site: ${eUrl}`);
  process.exit(0);
}

// ── step 4: the build ───────────────────────────────────────────────────────
// An explicit slug is OPTIONAL and exists for one reason: a slug is claimed by
// whoever builds it first, including by a build that then died, so a retry of a
// failed run would be read as a REVISE of the husk it left. Naming a fresh one
// keeps a re-run a genuine first build. Left unset, the designer names the site.
log(`step 4 — POST /api/site/react-build (${SLUG ? `slug "${SLUG}"` : "the designer names the site and the slug"}` +
  `${PICKER ? `, picker "${PICKER}"` : ""})`);
const bt = Date.now();
// A DEAD CONNECTION IS A DIAGNOSIS, NOT A STACK TRACE. Both Arabic attempts
// ended here — one at 301s (our own fetch ceiling, since fixed) and one at 286s
// with ECONNRESET from the far end — and the second printed a raw
// `Error: read ECONNRESET` with no elapsed time and no hint that the BUILD was
// the thing that died. The seconds are the whole diagnosis: they say the build
// ran past the wall rather than failing at it.
let build;
let disconnected = false;
// ── A LIVE TICKER WHILE THE SOCKET IS HELD ──────────────────────────────────
//
// THE HEALTHY RUN WAS THE SILENT ONE, which is exactly backwards. The POST
// waits for the whole build — up to eighteen minutes — and printed NOTHING
// while it did, so from the Actions log a working build and a wedged one are
// the same thing: `step 4 — POST ...` and then nothing until the answer. Every
// other long wait in this script narrates itself; this one, the only one that
// matters, did not. Same "a failure that cannot name itself" shape this repo
// keeps recording, wearing a success this time.
//
// NOTHING NEW IS MEASURED. `site_builds` is already written as the build walks
// its marks and `traceLine` already reads it — this prints it on the CONNECTED
// path too rather than only after a reset. One Supabase read every 30s, no
// model call, no cost.
//
// IT NEEDS A SLUG WE ALREADY KNOW, so it only arms when one was named. With
// the designer naming the site there is nothing to look up yet, and guessing
// would print some other site's trace — the `discoverSlug` hazard, which is
// answerable after a reset and not before one.
let ticker = null;
if (SLUG) {
  let busy = false;
  ticker = setInterval(async () => {
    // A SLOW READ MUST NOT STACK TICKS. Without the guard a Supabase blip that
    // outlasts the interval queues a second read behind the first, and the log
    // then reports marks out of order — which reads as the build going
    // backwards.
    if (busy) return;
    busy = true;
    try {
      const mins = ((Date.now() - bt) / 60000).toFixed(1);
      log(`step 4 — +${mins}m  ${await traceLine(SLUG)}`);
    } catch { /* a ticker must never break the build it is watching */ }
    busy = false;
  }, 30000);
  // NEVER HOLD THE PROCESS OPEN. An interval keeps the event loop alive, so a
  // run that finished would sit there ticking until the job cap.
  ticker.unref?.();
}
try {
  build = await postLong(`${BASE}/api/site/react-build`, auth, JSON.stringify({
    brief: BRIEF,
    ...(SLUG ? { slug: SLUG } : {}),
    // OMITTED WHEN UNSET rather than defaulted here. `modelsFor` is an
    // allow-list with its own default, and a second copy of that default in the
    // harness is a way for the two to disagree about what a plain run sends.
    ...(PICKER ? { picker: PICKER } : {}),
  }));
} catch (e) {
  // A DEAD CONNECTION IS NO LONGER A DEAD BUILD, AND THAT REVERSES WHAT THIS
  // BRANCH USED TO DO. It called fail() on the reasoning that Cloudflare
  // cancels a Worker when its client goes away — true until `ctx.waitUntil`
  // landed, and PROVEN false since: run 14's connection reset at 291.9s and the
  // site published ten minutes later (`pierhead-lido`, live now). So the reset
  // costs the ANSWER and not the SITE, and a harness that exits here throws
  // away a build the owner has already paid for.
  //
  // The ~285s wall is Cloudflare's rather than ours — five instances now, all
  // within seven seconds of each other — so there is nothing on our side to
  // raise. What there is to do is stop waiting on the socket and start watching
  // the site.
  disconnected = true;
  const secs = ((Date.now() - bt) / 1000).toFixed(1);
  log(`step 4 — the connection died after ${secs}s (${(e && e.code) || (e && e.message) || e})`);
  log("step 4 — EXPECTED, not fatal: the build is registered on ctx.waitUntil and keeps running.");
  log("step 4 — watching the site and its build trace instead of the socket.");
} finally {
  // CLEARED ON BOTH PATHS, in a `finally` rather than after the try. On the
  // reset path step 4b starts its own watch on the same slug, and two tickers
  // reading one trace interleave into a log that reads as two builds.
  if (ticker) clearInterval(ticker);
}
const raw = build ? build.text : "";
let d = null; try { d = JSON.parse(raw); } catch { /* logged below */ }
if (build) {
  log(`step 4 — build answered ${build.status} after ${((Date.now() - bt) / 1000).toFixed(1)}s`);
  if (!d) fail("the build response was not JSON: " + raw.slice(0, 500));
}

// ── A 202 IS THE POINT, NOT A FAILURE ───────────────────────────────────────
//
// The generation runs in the container, which has no fifteen-minute cap, and
// this invocation ends in seconds. So the answer this script exists to PRINT —
// the cost, the models, the images, the notes — arrives minutes later at
// `/api/site/build/<job>` rather than here.
//
// WITHOUT THIS, STEP 5 PRINTS `page=undefined cost=undefined` on a build that
// worked perfectly: every measurement this run is for, reading as absent when
// it has simply not happened yet. Same shape as the run-34 line that logged its
// one claim on a branch that did not execute.
let firedJob = null;
if (build && build.status === 202 && d && d.job) {
  firedJob = d.job;
  log(`step 4 — FIRED: the generation is running in the container (job ${firedJob}).`);
  log("step 4 — this invocation is over. That is the whole point — no Worker holds the wait.");
}

// ── step 4b: the build outlived the socket — watch for it to publish ────────
// THE TRACE IS THE OTHER HALF, and it is what six failed builds could not
// produce. `site_builds` is one row per slug, upserted as the build walks its
// marks, RLS on with NO policies — service key only, which this runner holds.
// So a build with no client attached is still narrating itself, and printing
// the last mark each poll turns "26 minutes of silence" into "it has been in
// `gen` for 8 minutes", which names a provider and a fix.
// ONE READ, TWO CONSUMERS — the log line and the decision below it.
//
// Split out on 2026-08-25 because the watch was reading the trace, PRINTING
// `done=false`, and then declaring the build published on the same line. The
// fact it needed was already in its hand and only the formatter could see it.
//
// A read that FAILS is `{err}` and never `{row: null}`: "Supabase would not
// answer" and "this build has no row" are different, and the second is what a
// build that never started looks like.
async function readTrace(slug) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_builds?slug=eq.${encodeURIComponent(slug)}&select=done,ok,page,total_ms,at,steps,updated_at`,
      { headers: svc });
    if (!r.ok) return { err: `trace read ${r.status}` };
    const rows = await r.json();
    const row = rows && rows[0];
    if (!row) return { err: "no trace row yet" };
    // ── SCOPED TO THIS BUILD, THE WAY `discoverSlug` ALREADY IS ───────────────
    //
    // `site_builds` is ONE ROW PER SLUG, upserted — so on a revise the row
    // sitting there at the first poll belongs to the PREVIOUS build of this
    // site. Run 40 (2026-08-26) is what this cost: the watch's first look read
    // `done: true` off run 39's day-old row, concluded the build was over, and
    // stopped after one poll on a build that had just been fired.
    //
    // Same argument `discoverSlug` makes about `site_backends` in as many
    // words: an unscoped row "answers with a site published hours ago" and
    // reports an outcome that did not happen. A row from before this build's
    // own POST is not evidence about this build, so it is reported as a row we
    // cannot use rather than as a fact — which keeps the watch WAITING, the
    // same safe direction an unreadable read already takes.
    const at = Date.parse(row.updated_at || "");
    if (Number.isFinite(at) && at < bt - 60000) {
      return { err: `the trace row is from an earlier build (${((bt - at) / 60000).toFixed(1)}m before this POST)` };
    }
    return { row };
  } catch (e) {
    return { err: `trace unreadable (${String((e && e.message) || e).slice(0, 60)})` };
  }
}

function traceText(got) {
  {
    if (got.err) return got.err;
    const row = got.row;
    // `steps` IS AN ARRAY OF `{s, ms}`, NOT A MAP — and the first draft read it
    // with `Object.keys`, which on an array yields INDICES. So arm B's whole
    // watch printed `last=19`, `last=21`, `last=22`: a number that reads like a
    // mark and names nothing. The one question this line exists to answer is
    // WHICH STEP, and it was the one thing it could not say.
    //
    // `at` is the row's own copy of the last step's NAME, written by rowFor
    // from the same array, so reading it here cannot disagree with the trace.
    // The tail is printed beside it because a name alone does not say whether
    // the build is moving — three marks in ten seconds and one mark in eight
    // minutes want different responses.
    const steps = Array.isArray(row.steps) ? row.steps : [];
    const tail = steps.slice(-3).map((s) => `${s && s.s}${Number.isFinite(s && s.ms) ? `(${Math.round(s.ms)}ms)` : ""}`).join(" -> ");
    // WHETHER THIS BUILD MADE A DATABASE, off the trace rather than the response.
    //
    // ADDED AFTER RUN 34 (2026-08-25), which is the run that needed it: step 5
    // logs `backend`/`tables` off the response, the socket died at ~263s, and
    // step 5 sits inside `if (!disconnected)` — so the ONE line written to prove
    // the frontend-only split never executed, on the very run that proved it.
    // The claim survived only because the trace carries the same fact
    // independently, and this line is that fact where the log can always reach
    // it. `provision` writes `{db: 0}` ONLY on the no-database path and `schema`
    // writes the table count either way, so absent-vs-0 is a real distinction
    // and neither is invented here: a build that never reached provisioning says
    // nothing rather than saying no.
    const prov = steps.find((s) => s && s.s === "provision");
    const schema = steps.find((s) => s && s.s === "schema");
    const db = prov && prov.db === 0 ? "db=none" : prov ? "db=made" : "";
    const tabs = schema && Number.isFinite(schema.tables) ? `tables=${schema.tables}` : "";
    // AND WHICH SIDE HELD THE TEN-MINUTE CALL — the whole measurement of the
    // 2026-08-25 change, and the reason it is HERE rather than only on the
    // response. `genVia` rides on the build's answer, and the answer is what the
    // ~285s edge reset destroys — eleven recorded times, including every run
    // from 35 to 38. So a measurement that lives only there is one this harness
    // has a measured history of never seeing. The trace survives.
    //
    // `container` says the generation call ran on the side with no clock, which
    // is the proof. `worker` says the container could not reach a provider at
    // all and the Worker made the call instead — the build still finished, and
    // the reason is in the Worker's log. ABSENT means generation never ran,
    // which is a real third answer and is not invented here.
    //
    // READ OFF `pages` FIRST, AND `img` ONLY AS THE FALLBACK, because the `img`
    // mark needs generation to have RETURNED. Run 38 died mid-generation and
    // has no `img` mark at all, so a reader anchored there says nothing about
    // the one question the run existed to settle. `pages` is written on the way
    // out whether the build succeeded or was killed.
    //
    // `holding` IS THE THIRD ANSWER AND IT IS THE INFORMATIVE ONE ON A DEAD
    // BUILD: the hop was made and never came back, so the container was still
    // waiting on the provider when the clock ran out — which means it REACHED
    // one, since a refusal is milliseconds rather than minutes.
    const pg = steps.find((s) => s && s.s === "pages");
    const img = steps.find((s) => s && s.s === "img");
    const src = pg && (pg.genTried || Number.isFinite(pg.genVia)) ? pg : null;
    const via = src
      ? (Number.isFinite(src.genVia) ? `gen=${src.genVia ? "container" : "worker"}` : "gen=container-holding")
      : (img && Number.isFinite(img.viaContainer) ? `gen=${img.viaContainer ? "container" : "worker"}` : "");
    const shape = [db, tabs, via].filter(Boolean).join(" ");
    return `done=${row.done} ok=${row.ok} page=${row.page || "?"} marks=${steps.length} at=${row.at || "(none)"}` +
      (shape ? `  ${shape}` : "") + (tail ? `  [${tail}]` : "");
  }
}

// The ticker's one-liner, unchanged in what it prints.
async function traceLine(slug) { return traceText(await readTrace(slug)); }

// ── IS THIS 200 THE SITE, OR THE STAND-IN? ──────────────────────────────────
//
// THE BUG THIS EXISTS FOR, MEASURED ON RUN 36 (2026-08-25). The socket reset at
// 258s, the watch below polled the site, got a 200 — and the 200 was the EARLY
// PLACEHOLDER, up since 3m49s. It printed `done=false ok=null at=gen` and on the
// next line said "PUBLISHED after 0.0 minutes of waiting", seven minutes before
// the real site existed. The build happened to succeed, so the run was right by
// luck; on run 35, which never published, it would have reported a site that
// does not exist.
//
// THE MARKER WAS BUILT FOR EXACTLY THIS AND WAS WIRED TO NOTHING. `worker.js`
// stamps `<meta name="gofarther-page" content="placeholder">` on the stand-in
// and the unit suite asserts exactly one kind of page carries it — and the one
// watcher that needed to read it never did. The wiring layer, again.
//
// READ OFF THE BODY, NOT THE TRACE, and the asymmetry is deliberate. The body
// is the thing a visitor gets, so it cannot lag or be unreadable the way a
// database row can; a trace that is behind must never block a genuine success.
// The trace decides only when to STOP waiting — see below.
const PLACEHOLDER_MARK = 'name="gofarther-page" content="placeholder"';
function isPlaceholder(html) {
  return typeof html === "string" && html.includes(PLACEHOLDER_MARK);
}

// ── THE SLUG THE DESIGNER CHOSE, RECOVERED FROM THE LEDGER ──────────────────
// A RESET WITH NO SLUG USED TO END THE RUN, and that is the one shape the whole
// watch-the-site design exists to survive. Arm C (2026-08-23) hit it: the
// connection died at 264.8s, the build carried on server-side, and the harness
// exited because the only copy of the slug was in the answer that was lost.
// Arms A and B survived the identical reset purely because they had been given
// explicit names. So "the designer names the site" and "a reset is survivable"
// were mutually exclusive, which is exactly backwards — a customer's build
// names itself too.
//
// `site_backends` is where the route records the claim, and it is written at
// PROVISIONING (~90s in), long before the reset. So by the time the socket dies
// the answer is already in the database.
//
// SCOPED TO THIS RUN, AND THAT IS THE WHOLE CORRECTNESS ARGUMENT. Taking the
// owner's newest site unconditionally would, on a build that died before
// provisioning, hand back a site published hours ago — which answers 200 at
// once and reports a SUCCESS THAT DID NOT HAPPEN, the most expensive wrong
// answer this harness can give. Two filters: the row must belong to this
// account, and it must have been created at or after this build's own POST.
// The 60s of slack is clock skew between the runner and Postgres and nothing
// else; the log prints the age against the POST so a human can see the pick.
//
// It RETRIES rather than asking once: a slow design call can put provisioning
// after the reset. Finding nothing after two minutes is honest — that build
// never claimed a slug, so there is no address and never will be.
async function discoverSlug() {
  const uid = session.user && session.user.id;
  if (!uid) return null;
  const since = new Date(bt - 60000).toISOString();
  for (let i = 1; i <= 8; i++) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/site_backends?uid=eq.${encodeURIComponent(uid)}` +
        `&created_at=gte.${encodeURIComponent(since)}` +
        `&select=slug,created_at&order=created_at.desc&limit=5`,
        { headers: svc });
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length) {
          for (const row of rows) {
            const age = ((new Date(row.created_at).getTime() - bt) / 1000).toFixed(1);
            log(`step 4b — site_backends: "${row.slug}" claimed ${age}s after the POST`);
          }
          if (rows.length > 1) log(`step 4b — ${rows.length} claims in this window; taking the newest`);
          return String(rows[0].slug);
        }
      } else {
        log(`step 4b — site_backends read ${r.status} (try ${i})`);
      }
    } catch (e) {
      log(`step 4b — site_backends unreadable (${String((e && e.message) || e).slice(0, 60)}) (try ${i})`);
    }
    log(`step 4b — no claim recorded yet, looking again (try ${i}/8)`);
    await new Promise((s) => setTimeout(s, 15000));
  }
  return null;
}

// ── WHY THIS RUNS ON THE FIRED PATH TOO, AND IT IS THE WHOLE OF STAGE 2 ─────
//
// This block was written for the RESET — the socket dying at ~285s while the
// build carried on — and gated on `disconnected` because that was the only way
// an answer could arrive late. STAGE 2 MADE THAT THE ORDINARY CASE AND LEFT THE
// GATE BEHIND: the POST returns 202 in seconds now and the socket does NOT die,
// so `disconnected` is false and this watch would be skipped entirely. Step 4c
// would then ask for the answer two seconds after the generation started, get
// its `pending` 202, and step 5 would print `page=undefined cost=undefined` on
// a perfect build — every measurement this run exists for reading as absent.
// The comment above step 4c predicted exactly that failure; this gate is what
// would have caused it.
if (disconnected || firedJob) {
  // THE SLUG IS ALREADY IN HAND ON THE FIRED PATH. The 202 carries it — the
  // designer names the site before the generation fires — so `discoverSlug` is
  // a Supabase round trip for something we were just told. It stays as the
  // fallback for the reset, where the answer is the thing that was lost.
  let slug = SLUG || (d && d.slug) || "";
  if (!slug) {
    log("step 4b — no slug in hand; reading it off site_backends");
    slug = await discoverSlug();
  }
  if (!slug) {
    fail(disconnected
      ? "the connection died and this build never claimed a slug, so there is no address to " +
        "watch — it did not get as far as provisioning. Check site_builds for how far it got."
      : "the build fired but named no site, so there is no address to watch. That should not be " +
        "reachable — the slug is claimed before the generation fires. Check site_builds.");
  }
  // The public address. `/s/<slug>/` on the platform 301s to it, so either
  // reaches the site; the subdomain is the one a customer is given.
  const watch = `https://${slug}.gofarther.app/`;
  log(`step 4b — watching ${watch} — the build publishes when it publishes, no ceiling here`);
  const waitedFrom = Date.now();
  let published = false;
  let settled = "";
  // Poll for as long as this job is allowed to live. The runner's own cap is
  // the only bound, deliberately: the owner's instruction was to let the model
  // work, and a bound here would be exactly the ceiling we just removed.
  for (let i = 1; i <= 240; i++) {
    const mins = ((Date.now() - waitedFrom) / 60000).toFixed(1);
    let status = 0;
    let stand = false;
    try {
      const r = await fetch(watch, { redirect: "follow" });
      status = r.status;
      // THE BODY IS READ ON EVERY POLL, INCLUDING THE ONE THAT SAYS 200. That
      // is the whole fix: `r.ok` alone cannot tell the site from the stand-in,
      // because the stand-in is served at the site's own address and answers
      // 200 like anything else.
      if (r.ok) {
        stand = isPlaceholder(await r.text());
        if (!stand) published = true;
      }
    } catch (e) {
      status = `err ${String((e && e.code) || (e && e.message) || e).slice(0, 40)}`;
    }
    const got = await readTrace(slug);
    log(`step 4b — +${mins}m  site ${status}${stand ? " (PLACEHOLDER)" : ""}  |  ${traceText(got)}`);
    if (published) break;
    // WHEN TO STOP WAITING ON A STAND-IN, and this is the only thing the trace
    // decides. A build that FAILED leaves the placeholder as its final state —
    // so without this the watch polls a settled site for the rest of the job,
    // an hour of "still waiting" about a build that finished ten minutes ago.
    //
    // `done === true` STRICTLY, never truthiness: an unreadable trace answers
    // `{err}` and must keep us waiting rather than declare the run over, since
    // "Supabase blinked" and "the build gave up" want opposite responses.
    if (stand && got.row && got.row.done === true) { settled = "placeholder"; break; }
    // A BUILD THAT IS OVER AND PUBLISHED NOTHING AT ALL IS ALSO OVER. The stop
    // above needs a stand-in still being served; a build that died before it
    // could publish even that answers 404, and without this the watch polls a
    // dead address for the rest of the job. `ok === false` STRICTLY — the build
    // recorded its own failure — because `done` alone beside a site that is not
    // up yet can still be propagation, and giving up there would report a
    // working build as a dead one.
    if (!published && got.row && got.row.done === true && got.row.ok === false) {
      settled = "failed"; break;
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  if (settled === "failed") {
    log("step 4b — THE BUILD RECORDED ITS OWN FAILURE AND PUBLISHED NOTHING.");
    log("         `done=true ok=false` with no page at the address, so this is not a hang and");
    log("         waiting longer buys nothing. The trace line above names the mark it died on.");
  } else if (settled === "placeholder") {
    log("step 4b — THE BUILD FINISHED AND LEFT THE PLACEHOLDER STANDING.");
    log("         That is the ship-anyway path doing its job rather than a hang: the site has a");
    log("         real page at its real address, and it is the stand-in rather than the site the");
    log("         customer asked for. The trace line above names the mark it stopped on.");
  } else if (!published) {
    log("step 4b — the site never came up inside this job. The trace line above names the mark it");
    log("         stopped on; the row survives, so `select steps from site_builds where slug=...`");
    log("         is still the diagnosis after this run ends.");
  } else {
    log(`step 4b — PUBLISHED after ${((Date.now() - waitedFrom) / 60000).toFixed(1)} minutes of waiting`);
  }
  // MERGED, NEVER REPLACED, and the fired path is why. On a reset `d` is null —
  // the response died with the socket — so this synthesises the one field the
  // steps below need rather than pretending we have the rest. On the fired path
  // `d` is the 202, which carries the job id, the stage and the server's own
  // sentence; replacing it would throw away the job that step 4c is about to
  // collect against. The watched address wins over the 202's own `url`, because
  // it is the one this run actually proved answers.
  d = { ...(d || {}), url: watch, slug };
}

// ── THE FIRED BUILD'S REAL ANSWER, collected after the watch ────────────────
//
// Asked HERE rather than beside the POST, because by now the watch above has
// either seen the site publish or seen the trace settle — so the answer exists
// or it never will, and one look is enough. A failure to collect it is reported
// and not fatal: the site is what the customer has, and this run has already
// proved whether it came up.
//
// WHETHER `d` CARRIES THE BUILD'S OWN ANSWER — the cost, the models, the image
// report, the builder's reply. True when the POST returned it synchronously
// (the degraded path, where the container had no `/model/start` to fire at),
// and true again once this step has collected it. It is FALSE for two different
// reasons — a reset lost the response, or a fired generation had not finished
// by the time the watch stopped — and step 5 says which rather than printing
// one sentence for both.
let haveAnswer = !!build && !disconnected && !firedJob;
if (firedJob) {
  try {
    const rr = await fetch(`${BASE}/api/site/build/${firedJob}`, { headers: auth });
    const txt = await rr.text().catch(() => "");
    if (rr.status === 202) {
      log(`step 4c — the answer is still not written for job ${firedJob} — the generation has not finished.`);
    } else if (!rr.ok && rr.status !== 200) {
      log(`step 4c — could not collect the answer for job ${firedJob}: ${rr.status} ${txt.slice(0, 200)}`);
    } else {
      let got = null; try { got = JSON.parse(txt); } catch { got = null; }
      if (got) {
        // MERGED RATHER THAN REPLACED. The 202 carried the slug and the url and
        // step 4b has been watching them; the answer carries everything else.
        d = { ...d, ...got };
        haveAnswer = true;
        log(`step 4c — collected the fired build's answer (${rr.status}).`);
      } else {
        log(`step 4c — the answer for job ${firedJob} was not JSON: ${txt.slice(0, 200)}`);
      }
    }
  } catch (e) {
    log(`step 4c — could not reach the result route: ${String((e && e.message) || e).slice(0, 120)}`);
  }
}

// The full response IS the record — cost, usage, seeded rows, image report,
// notes, problems. Nothing in it is a credential.
if (haveAnswer) {
  log("step 4 — full response:");
  log(JSON.stringify(d, null, 2));
}

// ── step 5: what the images did (the first funded run ever) ─────────────────
if (haveAnswer) {
log(`step 5 — page=${d.page} slug=${d.slug} url=${d.url}`);
// WHICH PATH THE BUILD TOOK, which this log had no line for until 2026-08-25.
// A first build is frontend only since then — `backend` off the design tool, the
// data rules off the page prompt, and no Neon project provisioned — so
// `backend=false tables=null` IS that split's whole claim, and without this line
// the only way to tell a frontend build from a data build was to go and look at
// the site. Read off the RESPONSE rather than inferred from the brief: a brief
// that reads as a brochure can still declare a table, and then the build really
// did provision one and this run measured something else.
log(`step 5 — backend=${d.backend} tables=${JSON.stringify(d.tables)}`);
log(`step 5 — cost=${JSON.stringify(d.cost)} charged=${d.charged}`);
// WHICH MODELS ACTUALLY RAN, read off the response rather than assumed from
// what was asked for. `modelsFor` ignores a picker it does not recognise and
// falls back to the default — silently, by design — so a typo'd picker produces
// a perfectly good Sonnet build that would be reported here as a Grok one.
if (d.models) log(`step 5 — models: ${JSON.stringify(d.models)}`);
if (d.images) log(`step 5 — images: ${JSON.stringify(d.images)}`);
if (d.imageNote || d.imagesNote) log(`step 5 — image note: ${d.imageNote || d.imagesNote}`);
if (d.notes) log(`step 5 — the builder's own reply: ${d.notes}`);
if (d.problems && d.problems.length) log(`step 5 — problems: ${JSON.stringify(d.problems)}`);
} else if (disconnected) {
  log("step 5 — skipped: the response died with the socket, so the cost breakdown, the builder's");
  log("         own reply and the image report are all gone. The ledger below is what is left.");
} else {
  log("step 5 — skipped: the generation had not finished by the time this run stopped watching, so");
  log("         the cost breakdown, the builder's own reply and the image report are not written");
  log("         yet. They are NOT lost — the result is stored under the job id above and the");
  log("         ledger below still measures what was spent. This is a slow build, not a dead one.");
}

// ── step 5b: THE PAGE THE MODEL ACTUALLY WROTE ──────────────────────────────
//
// THE LINE RUN 90 DIED WITHOUT. It failed with `Identifier 'createFileRoute'
// has already been declared. (3:9)`, and by the time anybody read that the page
// existed nowhere: the container had been recycled and the only other copy was
// in a Worker's memory. Four rounds of "why was it repeated" followed, every one
// of them unanswerable from a single line of error text.
//
// The build now stores its raw answer the moment it arrives and before anything
// can refuse it (`keep`, in publish-pages.mjs), and `GET /api/site/answer` is
// what reads it back. This is the hop that puts it in the log — without it the
// store is a file nobody ever opens, which is the same place run 90's page was.
//
// ONLY WHEN THERE IS SOMETHING TO DIAGNOSE. A build that published clean has its
// source on the site, and tens of kilobytes of TSX in every green log would bury
// the run report it sits in. `typeErrors` counts as something to diagnose: since
// 2026-08-30 a page that does not typecheck SHIPS, so a green build can carry
// exactly the kind of defect this exists to read.
if (haveAnswer && (d.page !== "app" || d.typeErrors)) {
  const aslug = d.slug || SLUG;
  log(`step 5b — the build did not publish clean (page=${d.page}, kept=${d.kept}) — reading what the model wrote`);
  try {
    const r = await fetch(`${BASE}/api/site/answer?slug=${encodeURIComponent(aslug)}`, { headers: auth });
    const a = await r.json().catch(() => null);
    if (!r.ok || !a || !a.ok) {
      log(`step 5b — the answer store answered ${r.status}: ${JSON.stringify(a).slice(0, 200)}`);
    } else if (!a.answer) {
      log(`step 5b — nothing stored: ${a.why || "(no reason given)"}`);
    } else {
      const ans = a.answer;
      log(`step 5b — stored ${ans.at}${ans.truncated ? " (the answer was TRUNCATED at max_tokens)" : ""}`);
      // WHY THERE IS NO ANSWER, when there is none. A model that replied in prose
      // instead of calling the tool leaves `input: null` and this is the only
      // record of it — printed FIRST, because on that path everything below is
      // empty and the reason must not read as a broken dump.
      if (ans.shape) log(`step 5b — the model never called the tool: ${JSON.stringify(ans.shape)}`);
      const pages = (ans.input && ans.input.pages) || [];
      const parts = (ans.input && ans.input.parts) || [];
      log(`step 5b — ${pages.length} page(s), ${parts.length} hand-written component(s)`);
      // THE SOURCE ITSELF, WHOLE AND UNTRIMMED. A capped dump is how a diagnosis
      // ends up guessing again: the defect that killed run 90 was on line 3 and
      // the one before it was on line 96, and no cap is right for both. It is the
      // owner's own page, in the owner's own log.
      for (const p of pages) {
        log(`step 5b — ── src/routes/${p.path} (${String(p.source || "").length} chars) ──`);
        log("```tsx\n" + String(p.source || "") + "\n```");
      }
      for (const p of parts) {
        log(`step 5b — ── src/routes/-parts/${p.name}.tsx (${String(p.source || "").length} chars) ──`);
        log("```tsx\n" + String(p.source || "") + "\n```");
      }
    }
  } catch (e) {
    log(`step 5b — could not read the answer store: ${String((e && e.message) || e).slice(0, 160)}`);
  }
}

// ── step 6: balance after ───────────────────────────────────────────────────
const after = await fetch(`${BASE}/api/credits`, { headers: auth }).then((r) => r.json()).catch(() => null);
log(`step 6 — balance AFTER: ${JSON.stringify(after)}`);
if (before && after) log(`step 6 — spent this run: ${Number(before.balance) - Number(after.balance)} credits`);

// ── step 7: is it actually up (best-effort — the build is already done) ─────
// TWO LESSONS FROM RUN 2, WHICH DIED RIGHT HERE WITH A GREEN BUILD BEHIND IT.
// The response's `url` can be RELATIVE — the internal `/s/<slug>/` path — and
// fetch() outside a browser refuses a relative URL, so this threw
// `TypeError: Invalid URL` and painted a red ✗ on a run whose build had
// succeeded and been paid for. Resolve it against BASE (an absolute URL passes
// through `new URL` unchanged). And the probe can no longer fail the process:
// it OBSERVES the outcome, it is not part of it — by this line the money is
// spent and the site is published, so an exception here misreports both.
const siteUrl = d.url ? new URL(d.url, BASE).href : "";
try {
  if (siteUrl) {
    const site = await fetch(siteUrl, { redirect: "follow" });
    const html = await site.text().catch(() => "");
    log(`step 7 — GET ${siteUrl} -> ${site.status} (${html.length} bytes)`);
    const m = html.match(/<title>([^<]*)<\/title>/);
    log(`step 7 — <title>: ${m ? m[1] : "(none found)"}`);
    // Photographs land under /u/<slug>/ — count references in the served page.
    const photos = (html.match(new RegExp("/u/" + d.slug + "/", "g")) || []).length;
    log(`step 7 — references to bought photographs in the home document: ${photos}`);
  }
} catch (e) {
  log(`step 7 — could not probe the site (${String((e && e.message) || e).slice(0, 120)}) — the build itself already succeeded`);
}

log("done — NOTHING is torn down: the site, its database and the account all stay up");
log(`the site: ${siteUrl || "(no url in the response)"}`);
