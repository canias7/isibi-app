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
const BRIEF = process.env.OWNER_BRIEF || "";
const SLUG = String(process.env.OWNER_SLUG || "").trim().toLowerCase();
// Which model builds. Unset sends nothing and the Worker uses its own default,
// so a run that does not care is byte-identical to what this script always sent.
const PICKER = String(process.env.OWNER_PICKER || "").trim();

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
}
const raw = build ? build.text : "";
let d = null; try { d = JSON.parse(raw); } catch { /* logged below */ }
if (build) {
  log(`step 4 — build answered ${build.status} after ${((Date.now() - bt) / 1000).toFixed(1)}s`);
  if (!d) fail("the build response was not JSON: " + raw.slice(0, 500));
}

// ── step 4b: the build outlived the socket — watch for it to publish ────────
// THE TRACE IS THE OTHER HALF, and it is what six failed builds could not
// produce. `site_builds` is one row per slug, upserted as the build walks its
// marks, RLS on with NO policies — service key only, which this runner holds.
// So a build with no client attached is still narrating itself, and printing
// the last mark each poll turns "26 minutes of silence" into "it has been in
// `gen` for 8 minutes", which names a provider and a fix.
async function traceLine(slug) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_builds?slug=eq.${encodeURIComponent(slug)}&select=done,ok,page,total_ms,at,steps`,
      { headers: svc });
    if (!r.ok) return `trace read ${r.status}`;
    const rows = await r.json();
    const row = rows && rows[0];
    if (!row) return "no trace row yet";
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
    const shape = [db, tabs].filter(Boolean).join(" ");
    return `done=${row.done} ok=${row.ok} page=${row.page || "?"} marks=${steps.length} at=${row.at || "(none)"}` +
      (shape ? `  ${shape}` : "") + (tail ? `  [${tail}]` : "");
  } catch (e) {
    return `trace unreadable (${String((e && e.message) || e).slice(0, 60)})`;
  }
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

if (disconnected) {
  let slug = SLUG;
  if (!slug) {
    log("step 4b — the connection died before the slug came back; reading it off site_backends");
    slug = await discoverSlug();
  }
  if (!slug) {
    fail("the connection died and this build never claimed a slug, so there is no address to " +
      "watch — it did not get as far as provisioning. Check site_builds for how far it got.");
  }
  // The public address. `/s/<slug>/` on the platform 301s to it, so either
  // reaches the site; the subdomain is the one a customer is given.
  const watch = `https://${slug}.gofarther.app/`;
  log(`step 4b — watching ${watch} — the build publishes when it publishes, no ceiling here`);
  const waitedFrom = Date.now();
  let published = false;
  // Poll for as long as this job is allowed to live. The runner's own cap is
  // the only bound, deliberately: the owner's instruction was to let the model
  // work, and a bound here would be exactly the ceiling we just removed.
  for (let i = 1; i <= 240; i++) {
    const mins = ((Date.now() - waitedFrom) / 60000).toFixed(1);
    let status = 0;
    try {
      const r = await fetch(watch, { redirect: "follow" });
      status = r.status;
      if (r.ok) { published = true; }
    } catch (e) {
      status = `err ${String((e && e.code) || (e && e.message) || e).slice(0, 40)}`;
    }
    log(`step 4b — +${mins}m  site ${status}  |  ${await traceLine(slug)}`);
    if (published) break;
    await new Promise((r) => setTimeout(r, 15000));
  }
  if (!published) {
    log("step 4b — the site never came up inside this job. The trace line above names the mark it");
    log("         stopped on; the row survives, so `select steps from site_builds where slug=...`");
    log("         is still the diagnosis after this run ends.");
  } else {
    log(`step 4b — PUBLISHED after ${((Date.now() - waitedFrom) / 60000).toFixed(1)} minutes of waiting`);
  }
  // The response is gone with the socket, so everything it carried — cost,
  // notes, the image report, whether the model wrote its own CSS — has to be
  // read off the site and the ledger instead. Synthesise the one field the
  // steps below need rather than pretending we have the rest.
  d = { url: watch, slug };
}

// The full response IS the record — cost, usage, seeded rows, image report,
// notes, problems. Nothing in it is a credential.
if (!disconnected) {
  log("step 4 — full response:");
  log(JSON.stringify(d, null, 2));
}

// ── step 5: what the images did (the first funded run ever) ─────────────────
if (!disconnected) {
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
} else {
  log("step 5 — skipped: the response died with the socket, so the cost breakdown, the builder's");
  log("         own reply and the image report are all gone. The ledger below is what is left.");
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
