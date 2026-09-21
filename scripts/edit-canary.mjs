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
import { EditPoll, readInstruction, instructionRefusal, watchEdit, watchReport } from "./canary-watch.mjs";

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

if (!EMAIL || !SERVICE_KEY || !CANARY) {
  console.error("OWNER_EMAIL, SUPABASE_SERVICE_KEY and CANARY_SLUG are required");
  process.exit(1);
}

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
      let text = "";
      res.on("data", (c) => { text += c; });
      res.on("end", () => {
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

async function inventory(label) {
  mkdirSync(`${EVID}/${label}`, { recursive: true });
  const src = await call("GET", `/api/site/source?slug=${encodeURIComponent(CANARY)}`);
  const sb = src.json || {};
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
    let html = "";
    try { html = await fetch(origin + r).then((x) => x.text()); } catch (e) { html = ""; }
    const file = (r === "/" ? "_home" : r.replace(/[^a-z0-9]+/gi, "_"));
    writeFileSync(`${EVID}/${label}/route${file}.html`, html);
    render[r] = { bytes: html.length, photos: onPagePhotos(html, CANARY), headings: headingOrder(html), words: proseBag(html).length };
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
  };
  // THE BODIES TOO, because "complete before-inventory" means the source a
  // comparison can be made against, not a table of sizes.
  writeFileSync(`${EVID}/${label}/source.json`, JSON.stringify({ pages: sb.pages || [], parts: sb.parts || [] }, null, 2));
  writeFileSync(`${EVID}/${label}/inventory.json`, JSON.stringify(inv, null, 2));
  return inv;
}

console.log(`INVENTORY — before (written to ${EVID}/before)\n`);
const BEFORE = await inventory("before");
console.log(`  source ${BEFORE.status}  reads=${JSON.stringify(BEFORE.reads)}  complete=${BEFORE.readsComplete}`);
console.log(`  pages  ${BEFORE.pages.map((p) => `${p.path}(${p.bytes}b)`).join(" ") || "(none)"}`);
console.log(`  parts  ${BEFORE.parts.map((p) => `${p.path}(${p.bytes}b)`).join(" ") || "(NONE — component coverage is outstanding for this run)"}`);
for (const [r, v] of Object.entries(BEFORE.render)) {
  console.log(`  ${r.padEnd(14)} ${String(v.bytes).padStart(6)}b  photos=${v.photos.length}  headings: ${v.headings.join(" | ")}`);
}
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
async function balanceNow() {
  return fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${UID}&select=balance`, { headers: svc })
    .then((r) => r.json()).then((r) => Number((r[0] || {}).balance || 0)).catch(() => -1);
}
const BAL = await balanceNow();
console.log(`  balance ${BAL < 0 ? "UNREADABLE" : BAL}`);
check("the balance is readable", BAL >= 0, String(BAL));
console.log("");

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
const digest = { name: CANARY, url: `https://${CANARY}.gofarther.app`, pages: [], tables: [] };
const rt = await call("POST", "/api/site/route", {
  body: { message: INSTRUCTION, site: digest, firstBuild: false, brief: INSTRUCTION,
          qa: [], answering: false, attached: false, slug: CANARY, hasSite: true },
});
const rd = (rt.json || {});
console.log(`  routed in ${(rt.ms / 1000).toFixed(1)}s: intent=${rd.intent || "?"} layer=${rd.layer || "-"} page=${rd.page || "-"} cost=${rd.cost ?? "?"}${rd.failed ? " FAILED" : ""}`);

// REFUSE TO SPEND BLIND. A blank layer costs nothing and proves nothing, and
// the whole danger is that it PASSES: the round trip completes, the poll
// returns a terminal answer, and the canary reports green having tested the
// queue and none of the work. A visible refusal is the only honest outcome.
if (rt.status !== 200 || rd.intent !== "edit" || !rd.layer) {
  console.error(`  REFUSING TO SPEND: the router did not name an edit layer (${rt.status} ${rt.text.slice(0, 160)}).`);
  console.error("  Posting the edit anyway would escalate on `layer` for cost 0 and prove nothing.");
  process.exit(1);
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
writeFileSync(`${EVID}/routing.json`, JSON.stringify({ instruction: INSTRUCTION, status: rt.status, ms: rt.ms, body: rd }, null, 2));
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
const said = rep.compose ? editBrowserReply(rb, done.status >= 200 && done.status < 300) : null;
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

// ── BEFORE / AFTER EVIDENCE ────────────────────────────────────────────────
console.log(`\nINVENTORY — after (written to ${EVID}/after)\n`);
const AFTER = await inventory("after");
const cmp = { slug: CANARY, routes: {}, parts: {} };
for (const r of Object.keys(BEFORE.render)) {
  const b = BEFORE.render[r], a = AFTER.render[r] || { photos: [], headings: [], words: 0 };
  const lostPix = b.photos.filter((u) => !a.photos.includes(u));
  const newPix = a.photos.filter((u) => !b.photos.includes(u));
  const moved = JSON.stringify(b.headings) !== JSON.stringify(a.headings);
  cmp.routes[r] = { photosBefore: b.photos.length, photosAfter: a.photos.length, lost: lostPix, gained: newPix,
                    headingsBefore: b.headings, headingsAfter: a.headings, orderChanged: moved,
                    wordsBefore: b.words, wordsAfter: a.words };
  console.log(`  ${r.padEnd(14)} photos ${b.photos.length}->${a.photos.length}${lostPix.length ? "  LOST " + lostPix.length : ""}  order ${moved ? "CHANGED" : "same"}`);
  if (moved) { console.log(`      before: ${b.headings.join(" | ")}`); console.log(`      after : ${a.headings.join(" | ")}`); }
}
const partsBefore = BEFORE.parts.map((p) => p.path).sort();
const partsAfter = AFTER.parts.map((p) => p.path).sort();
cmp.parts = { before: partsBefore, after: partsAfter, preserved: JSON.stringify(partsBefore) === JSON.stringify(partsAfter) };
console.log(`  components  ${partsBefore.length} -> ${partsAfter.length}  ${cmp.parts.preserved ? "preserved" : "CHANGED"}`);
writeFileSync(`${EVID}/compare.json`, JSON.stringify(cmp, null, 2));

// THE PRESERVATION VERDICT, stated as its own line so a published edit that
// lost a photograph cannot read as a pass on the strength of `ok: true`.
const anyLost = Object.values(cmp.routes).some((v) => v.lost.length > 0);
check("no route lost an on-page photograph", !anyLost,
  anyLost ? Object.entries(cmp.routes).filter(([, v]) => v.lost.length).map(([r, v]) => `${r}:${v.lost.length}`).join(" ") : "none lost");
check("the stored components are preserved", cmp.parts.preserved, `${partsBefore.length} -> ${partsAfter.length}`);
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
const body = done && done.json ? done.json : null;
const published = !!(body && body.ok === true);
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
}
process.exit(published ? 0 : 1);
