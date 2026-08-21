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

/**
 * POST with NO HEADERS TIMEOUT, because `fetch` has one and a build can outrun it.
 *
 * MEASURED, NOT GUESSED: undici — the engine behind Node's global fetch — gives up
 * if response headers have not arrived in 300s, and it is not overridable through
 * the fetch options (an AbortSignal set longer does not raise it; the headers
 * timeout fires first). GatherHire returned in 272.2s and the Arabic build ran
 * past 300s, so the ceiling had always been one slow build away.
 *
 * AND THE COST OF HITTING IT IS NOT A LOST LOG LINE. Cloudflare cancels a Worker
 * when the client goes away, so hanging up KILLS THE BUILD MID-FLIGHT: measured
 * on that run, the customer was left with a claimed slug, a live Neon project, a
 * 20-credit schema charge and no site. So this is not harness tidiness — the
 * client staying connected is what lets the build finish at all.
 *
 * `node:https` has no such timeout of its own, which is the whole reason it is
 * here rather than fetch. Everything else in this file still uses fetch: those
 * calls answer in milliseconds and none of them can be worth a second mechanism.
 */
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
const BRIEF = process.env.OWNER_BRIEF || "";
const SLUG = String(process.env.OWNER_SLUG || "").trim().toLowerCase();

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
const desc = (v) => (v ? `set (${String(v).length} chars)` : "MISSING");

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY is not set");
if (!BRIEF) fail("OWNER_BRIEF is not set");
log(`step 0 — inputs: email=${EMAIL} base=${BASE} service_key=${desc(SERVICE_KEY)} anon_key=${desc(ANON_KEY)}`);
log(`step 0 — brief (${BRIEF.length} chars): ${BRIEF}`);

const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };

// ── step 1: sign in as the owner via an admin magic link ────────────────────
log("step 1 — asking GoTrue admin for a one-time magic link (no password involved)");
const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST", headers: svc,
  body: JSON.stringify({ type: "magiclink", email: EMAIL }),
});
const glBody = await gl.json().catch(() => ({}));
const tokenHash = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
log(`step 1 — generate_link answered ${gl.status}; token_hash ${desc(tokenHash)}`);
if (!gl.ok || !tokenHash) fail("could not generate a sign-in link: " + JSON.stringify(glBody).slice(0, 300));

log("step 2 — exchanging the one-time token for a session (consumes the link)");
const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
});
const session = await vr.json().catch(() => ({}));
const jwt = session.access_token;
log(`step 2 — verify answered ${vr.status}; access_token ${desc(jwt)}; user=${(session.user && session.user.email) || "?"}`);
if (!vr.ok || !jwt) fail("could not open a session: " + JSON.stringify(session).slice(0, 300));
if (session.user && session.user.email && session.user.email !== EMAIL) {
  fail(`signed in as ${session.user.email}, expected ${EMAIL} — refusing to spend anybody else's credits`);
}
const auth = { Authorization: `Bearer ${jwt}`, "content-type": "application/json" };

// ── step 3: balance before ──────────────────────────────────────────────────
const before = await fetch(`${BASE}/api/credits`, { headers: auth }).then((r) => r.json()).catch(() => null);
log(`step 3 — balance BEFORE: ${JSON.stringify(before)}`);

// ── step 4: the build ───────────────────────────────────────────────────────
// An explicit slug is OPTIONAL and exists for one reason: a slug is claimed by
// whoever builds it first, including by a build that then died, so a retry of a
// failed run would be read as a REVISE of the husk it left. Naming a fresh one
// keeps a re-run a genuine first build. Left unset, the designer names the site.
log(`step 4 — POST /api/site/react-build (${SLUG ? `slug "${SLUG}"` : "the designer names the site and the slug"})`);
const bt = Date.now();
// A DEAD CONNECTION IS A DIAGNOSIS, NOT A STACK TRACE. Both Arabic attempts
// ended here — one at 301s (our own fetch ceiling, since fixed) and one at 286s
// with ECONNRESET from the far end — and the second printed a raw
// `Error: read ECONNRESET` with no elapsed time and no hint that the BUILD was
// the thing that died. The seconds are the whole diagnosis: they say the build
// ran past the wall rather than failing at it.
let build;
try {
  build = await postLong(`${BASE}/api/site/react-build`, auth,
    JSON.stringify(SLUG ? { brief: BRIEF, slug: SLUG } : { brief: BRIEF }));
} catch (e) {
  const secs = ((Date.now() - bt) / 1000).toFixed(1);
  log(`step 4 — THE CONNECTION DIED after ${secs}s (${(e && e.code) || (e && e.message) || e})`);
  log("step 4 — Cloudflare cancels a Worker when the client goes away, so the build was almost");
  log("         certainly killed mid-flight: expect a claimed slug, a live Neon project and a");
  log("         schema charge with no site. Check the ledger and site_backends before retrying.");
  fail("the build connection did not survive — nothing to report from this run");
}
const raw = build.text;
let d = null; try { d = JSON.parse(raw); } catch { /* logged below */ }
log(`step 4 — build answered ${build.status} after ${((Date.now() - bt) / 1000).toFixed(1)}s`);
if (!d) fail("the build response was not JSON: " + raw.slice(0, 500));

// The full response IS the record — cost, usage, seeded rows, image report,
// notes, problems. Nothing in it is a credential.
log("step 4 — full response:");
log(JSON.stringify(d, null, 2));

// ── step 5: what the images did (the first funded run ever) ─────────────────
log(`step 5 — page=${d.page} slug=${d.slug} url=${d.url}`);
log(`step 5 — cost=${JSON.stringify(d.cost)} charged=${d.charged}`);
if (d.images) log(`step 5 — images: ${JSON.stringify(d.images)}`);
if (d.imageNote || d.imagesNote) log(`step 5 — image note: ${d.imageNote || d.imagesNote}`);
if (d.notes) log(`step 5 — the builder's own reply: ${d.notes}`);
if (d.problems && d.problems.length) log(`step 5 — problems: ${JSON.stringify(d.problems)}`);

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
