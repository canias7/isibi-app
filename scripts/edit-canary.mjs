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

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const CANARY = String(process.env.CANARY_SLUG || "").trim().toLowerCase();
const CONTROL = String(process.env.CONTROL_SLUG || "").trim().toLowerCase();
const SPEND = process.env.CANARY_SPEND === "1";

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
        resolve({ status: res.statusCode, ms: Date.now() - t0, json, text: text.slice(0, 400) });
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

// 2. A NON-CANARY STILL GETS THE SYNCHRONOUS SHAPE — the same empty
//    instruction, answered inline with an escalate rather than a job.
if (CONTROL) {
  const b = await call("POST", `/api/site/${encodeURIComponent(CONTROL)}/edit`,
    { body: { instruction: "", layer: "", idem: hex32() } });
  const syncShape = b.status === 200 && b.json && b.json.escalate === true && !b.json.job;
  check(`a non-canary (${CONTROL}) still receives the SYNCHRONOUS shape`, syncShape,
    `${b.status} ${b.json ? JSON.stringify({ escalate: b.json.escalate, reason: b.json.reason, cost: b.json.cost, job: b.json.job }) : b.text}`);
} else {
  check("a non-canary still receives the SYNCHRONOUS shape", false, "CONTROL_SLUG not set");
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

if (!SPEND) {
  console.log("CANARY_SPEND is not 1 — stopping before the paid edit. Nothing was charged.");
  process.exit(failed ? 1 : 0);
}
if (failed) {
  console.log("REFUSING TO SPEND: a free check failed, and the paid edit would tell us less than these already did.");
  process.exit(1);
}

// ── THE ONE PAID EDIT ──────────────────────────────────────────────────────

console.log("PAID CANARY EDIT — exactly one\n");
const before = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${UID}&select=balance`, { headers: svc })
  .then((r) => r.json()).then((r) => Number((r[0] || {}).balance || 0)).catch(() => -1);
console.log(`  balance before: ${before}`);

const INSTRUCTION = process.env.CANARY_INSTRUCTION || "make the main call-to-action button background a deeper green";

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

let done = null;
for (let i = 0; i < 260; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const q = await call("GET", `/api/site/edit/${job}`);
  if (q.status === 200) { done = q; break; }
  if (q.json && (i % 4 === 0)) {
    console.log(`  ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ${q.json.status || "?"}${q.json.phase ? " / " + q.json.phase : ""}  cost=${q.json.cost ?? "?"}`);
  }
}
console.log(`\n  settled after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("  " + (done ? done.text.slice(0, 600) : "NO TERMINAL ANSWER — the job did not finish inside the watch"));

const after = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${UID}&select=balance`, { headers: svc })
  .then((r) => r.json()).then((r) => Number((r[0] || {}).balance || 0)).catch(() => -1);
console.log(`\n  balance after: ${after}  (moved ${(before - after).toFixed(2)})`);

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
if (!done) console.error("\nCANARY FAILED: no terminal answer inside the watch.");
else if (!published) {
  console.error(`\nCANARY FAILED: the edit did not publish — ${body && body.escalate ? "escalated on `" + body.reason + "`" : "answered " + JSON.stringify(body && body.error)}.`);
  console.error("This is a completed round trip that changed nothing. Do not read it as a pass.");
} else {
  console.log(`\nCANARY PASSED: layer=${body.layer || "?"} published, cost=${body.cost ?? "?"}`);
}
process.exit(published ? 0 : 1);
