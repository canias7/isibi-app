// WHAT BECAME OF A CHANGE THAT STOPPED MID-PUBLISH. FREE, READ-ONLY BY DEFAULT.
//
// WHY THIS EXISTS (stage 3b, 2026-09-05). A job that began publishing and never
// recorded its commit sits in review — the site closed to new edits, the money
// untouched — until somebody says `kept` or `refunded`. The Worker now forms
// that verdict from three facts stage 7 made readable (the pointer, the live
// script's own stamps, the job's staged version) and applies it itself, in the
// consumer and on every sweep tick. This is the owner's window on the same
// decision: `GET /api/site/reconcile` lists every row of theirs under review on
// a site with the facts as read NOW and the verdict they give, DRY — and with
// RECONCILE_APPLY=1 applies it through the same function.
//
// IT SPENDS NOTHING. One sign-in and one GET. No container, no model call, no
// credits. Applying moves money only the way a hand verdict would: a refund of
// the job's own reserve, or a kept charge.
import { ownerSession, desc } from "./owner-session.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
// The PUBLIC client key, the same default and for the same reason as
// answer-read.mjs: it ships in public/auth.js on every page load.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const SLUG = String(process.env.OWNER_SLUG || "").trim().toLowerCase();
const JOB = String(process.env.RECONCILE_JOB || "").trim();
// AFFIRMATIVE WORDS ONLY, the flag pattern everywhere else here: "1", "on",
// "yes" or "true" applies; anything else — including a typo — reads.
const APPLY = /^(1|on|yes|true)$/i.test(String(process.env.RECONCILE_APPLY || "").trim());

const LOG_FILE = "reconcile-check-log.md";
const lines = ["# What became of the changes under review", "", "Read " + new Date().toISOString(), ""];
const fs = await import("node:fs");
function log(msg) {
  console.log(msg);
  lines.push(msg);
  fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}
function fail(msg) { log("FATAL: " + msg); process.exit(1); }

if (!EMAIL) fail("OWNER_EMAIL is not set");
if (!SERVICE_KEY) fail("SUPABASE_SERVICE_KEY is not set");
if (!SLUG) fail("OWNER_SLUG is not set — there is no site to read");
if (JOB && !/^[a-z0-9_-]{8,64}$/i.test(JOB)) fail("RECONCILE_JOB is not a job id");
log(`step 0 — reading the rows under review for "${SLUG}"${JOB ? " (job " + JOB + ")" : ""} as ${EMAIL} at ${BASE} (service_key ${desc(SERVICE_KEY)}) — ${APPLY ? "APPLYING the verdicts" : "dry: nothing is applied"}`);

let auth;
try {
  ({ auth } = await ownerSession({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, anonKey: ANON_KEY, email: EMAIL, log }));
} catch (e) { fail(String((e && e.message) || e)); }

const q = new URLSearchParams({ slug: SLUG });
if (JOB) q.set("job", JOB);
if (APPLY) q.set("apply", "1");
log(`step 3 — GET /api/site/reconcile?${q}`);
const r = await fetch(`${BASE}/api/site/reconcile?${q}`, { headers: auth });
const body = await r.json().catch(() => null);
log(`step 3 — answered ${r.status}`);
if (!r.ok || !body || !body.ok) fail(`the reconcile route refused: ${JSON.stringify(body).slice(0, 400)}`);

const rows = Array.isArray(body.rows) ? body.rows : [];
// NOTHING UNDER REVIEW IS THE ORDINARY ANSWER AND NOT A FAILURE: every site
// whose last change shipped clean is in this branch.
if (!rows.length) {
  log(`step 4 — nothing under review on ${SLUG}${JOB ? " under that job id" : ""}. Nothing to decide.`);
  process.exit(0);
}
log(`step 4 — ${rows.length} row${rows.length === 1 ? "" : "s"} under review${body.applied ? ", verdicts APPLIED" : ", verdicts NOT applied (dry)"}`);
for (const x of rows) {
  log("");
  log(`## ${x.job}  ${x.op || ""} ${x.state || ""}${x.note ? "  (" + x.note + ")" : ""}`);
  log(`verdict: **${x.verdict}** (${x.kind}) — ${x.why || ""}${x.applied ? "  → applied" + (x.refunded ? ", refunded " + x.refunded : "") : x.error ? "  → NOT applied: " + x.error : ""}`);
  const f = x.facts || {};
  log(`pointer: ${JSON.stringify(f.pointer)}`);
  log(`live:    ${JSON.stringify(f.live)}`);
  log(`mine:    ${JSON.stringify(f.mine)}   builds: ${JSON.stringify(f.builds)}`);
}
log("");
log(`done — ${LOG_FILE} holds the whole thing. ${body.applied ? "Verdicts were applied through edit_reconcile." : "Nothing was changed; set RECONCILE_APPLY=1 to apply."}`);
