// READ BACK WHAT THE GENERATOR WROTE ON A SITE'S LAST BUILD. FREE, READ-ONLY.
//
// WHY THIS EXISTS. Run 90 (`coalhole-1`, 2026-08-30) died in the bundler with
//
//     Error transforming route file /app/src/routes/index.tsx:
//     SyntaxError: Identifier 'createFileRoute' has already been declared. (3:9)
//
// and nothing could say why the model wrote that line twice, because the page was
// only ever stored on SUCCESS. `publishPages` keeps the raw tool payload now, the
// moment it arrives and before anything can refuse it, and `GET /api/site/answer`
// serves it back to the site's owner. This is the thing that calls it.
//
// SEPARATE FROM build-as-owner.mjs ON PURPOSE, even though that script prints the
// same source at its step 5b. That one only sees a build it watched to the end —
// and the case this is needed for is precisely the one where it did not: a slow
// build whose answer lands after the runner stopped looking, or any failure read
// the next day. A build's log is a snapshot; this is the store.
//
// IT SPENDS NOTHING. One sign-in and one GET. No container, no model call, no
// credits — so it can be run on any site, any number of times, without asking.
import { ownerSession, desc } from "./owner-session.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
// The PUBLIC client key, the same default and for the same reason as
// build-as-owner.mjs: it ships in public/auth.js on every page load.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const SLUG = String(process.env.OWNER_SLUG || "").trim().toLowerCase();

const LOG_FILE = "answer-read-log.md";
const lines = ["# What the generator wrote", "", "Read " + new Date().toISOString(), ""];
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
log(`step 0 — reading the stored answer for "${SLUG}" as ${EMAIL} at ${BASE} (service_key ${desc(SERVICE_KEY)})`);

let auth;
try {
  ({ auth } = await ownerSession({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, anonKey: ANON_KEY, email: EMAIL, log }));
} catch (e) { fail(String((e && e.message) || e)); }

log(`step 3 — GET /api/site/answer?slug=${SLUG}`);
const r = await fetch(`${BASE}/api/site/answer?slug=${encodeURIComponent(SLUG)}`, { headers: auth });
const body = await r.json().catch(() => null);
log(`step 3 — answered ${r.status}`);
if (!r.ok || !body || !body.ok) fail(`the answer store refused: ${JSON.stringify(body).slice(0, 400)}`);

// NOTHING STORED IS A REAL ANSWER AND NOT A FAILURE. Every site built before the
// store shipped is in this branch, and so is any site whose last build never
// reached generation at all.
if (!body.answer) {
  log(`step 4 — nothing stored: ${body.why || "(no reason given)"}`);
  process.exit(0);
}

const a = body.answer;
log(`step 4 — stored ${a.at}${a.truncated ? "  (the answer was TRUNCATED at max_tokens)" : ""}`);
// PRINTED FIRST, because on this path everything below is empty and the reason
// must not read as a broken dump.
if (a.shape) log(`step 4 — the model never called the tool: ${JSON.stringify(a.shape)}`);
const pages = (a.input && a.input.pages) || [];
const parts = (a.input && a.input.parts) || [];
log(`step 4 — ${pages.length} page(s), ${parts.length} hand-written component(s)`);
if (a.input && a.input.notes) log(`step 4 — the builder's own reply: ${a.input.notes}`);

// WHOLE AND UNTRIMMED. A capped dump is how a diagnosis ends up guessing again:
// run 90's defect was on line 3 and run 85's on line 96, and no cap is right for
// both. It is the owner's own page, in the owner's own log.
for (const p of pages) {
  log("");
  log(`## src/routes/${p.path}  (${String(p.source || "").length} chars)`);
  log("```tsx\n" + String(p.source || "") + "\n```");
}
for (const p of parts) {
  log("");
  log(`## src/routes/-parts/${p.name}.tsx  (${String(p.source || "").length} chars)`);
  log("```tsx\n" + String(p.source || "") + "\n```");
}
log("");
log(`done — ${LOG_FILE} holds the whole thing. Nothing was spent.`);
