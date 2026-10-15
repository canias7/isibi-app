// THE FIRST-BUILD CHECK'S REAL NETWORK (2026-10-10): `runBuildCheck`
// (canary-build.mjs) with every read and write it makes, as the owner's
// account. Reached from build-as-owner.mjs with `OWNER_MODE=check`, so it
// shares that workflow's sign-in, its deploy wait and its artifact; it sends
// the build only with `OWNER_SPEND=yes`. No token, key or link is printed:
// the log names lengths, statuses and the build's own records.
import fs from "node:fs";
import https from "node:https";
import { ownerSession } from "./owner-session.mjs";
import { runBuildCheck, judgeBuild, BUILD_CHECK, BUILD_CHECK_NO_IMAGES, windowComplete, readBuildOptIn } from "./canary-build.mjs";
import { uploadsOf } from "./canary-requests.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const SPEND = String(process.env.OWNER_SPEND || "").trim().toLowerCase() === "yes";
// THE IMAGE-FREE CHECK (2026-10-11): `mode: check-no-images`.
const MODE_NAME = String(process.env.OWNER_MODE || "").trim().toLowerCase();
const SPEC = MODE_NAME === "check-no-images" || MODE_NAME === "judge-no-images" ? BUILD_CHECK_NO_IMAGES : BUILD_CHECK;
// THE FREE JUDGE (2026-10-14): one finished build, named by its job id.
const JUDGE = MODE_NAME === "judge-no-images";
const JOB = String(process.env.OWNER_JOB || "").trim().toLowerCase();
const LOG_FILE = "build-check.json";
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

/** The build's POST outlives fetch's 300-second header wait, so it goes over `node:https` (see build-as-owner.mjs). */
function postLong(url, headers, body) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = Buffer.from(body, "utf8");
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: "POST", headers: { ...headers, "content-length": payload.length } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { const text = Buffer.concat(chunks).toString("utf8"); let json = null; try { json = JSON.parse(text); } catch { /* kept as status only */ } resolve({ status: res.statusCode, json }); });
    });
    req.on("error", (e) => resolve({ status: 0, json: null, why: String((e && e.code) || (e && e.message) || e) }));
    req.setTimeout(18 * 60_000, () => req.destroy(new Error("no answer in 18 minutes")));
    req.write(payload);
    req.end();
  });
}
const get = async (path, token) => {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, json: await r.json().catch(() => null) };
  } catch (e) { return { status: 0, json: null, why: String((e && e.message) || e).slice(0, 120) }; }
};

export async function main() {
  // THE OWNER'S BALANCE BOX (2026-10-14), read before the sign-in: malformed,
  // closed, or for another mode, nothing is read or sent (exit 2).
  const optIn = readBuildOptIn(process.env.OWNER_ACCEPT_BALANCE, { mode: process.env.OWNER_MODE });
  if (!optIn.ok) { console.log(`REFUSED before the sign-in: ${optIn.msg}`); return 2; }
  if (!EMAIL || !SERVICE_KEY || !ANON_KEY) { console.log("FATAL: OWNER_EMAIL, SUPABASE_SERVICE_KEY and SUPABASE_ANON_KEY are needed"); return 1; }
  let uid = "";
  const io = {
    log: (m) => console.log(m),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    signIn: async () => {
      const s = await ownerSession({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, anonKey: ANON_KEY, email: EMAIL });
      uid = (s.user && s.user.id) || uid;
      return { token: s.jwt, uid: (s.user && s.user.id) || "" };
    },
    balance: async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${uid}&select=balance`, { headers: svc });
      const rows = await r.json().catch(() => null);
      return Array.isArray(rows) && rows[0] && Number.isFinite(Number(rows[0].balance)) ? Number(rows[0].balance) : null;
    },
    // THE SLUG'S THREE READINGS (`slugFreeVerdict`): the site table and the
    // build records with the service key (the slug column only), and the
    // address. A thrown read is status 0: cannot-tell.
    existing: async (slug) => {
      const rows = async (table) => {
        try {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=slug`, { headers: svc });
          return { status: r.status, rows: await r.json().catch(() => null) };
        } catch { return { status: 0, rows: null }; }
      };
      let host = { status: 0 };
      try { host = { status: (await fetch(`https://${slug}.gofarther.app/`, { redirect: "manual" })).status }; } catch { /* cannot tell */ }
      return { backends: await rows("site_backends"), builds: await rows("site_builds"), host };
    },
    ledgerLast: async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/credit_events?uid=eq.${uid}&select=id&order=id.desc&limit=1`, { headers: svc });
        const rows = await r.json().catch(() => null);
        if (r.status !== 200 || !Array.isArray(rows)) return { ok: false };
        return { ok: true, id: rows[0] ? Number(rows[0].id) : 0 };
      } catch { return { ok: false }; }
    },
    post: (token, body) => postLong(`${BASE}/api/site/react-build`, { Authorization: `Bearer ${token}`, "content-type": "application/json" }, JSON.stringify(body)),
    poll: (token, job) => get(`/api/site/build/${encodeURIComponent(job)}`, token),
    trace: async (slug) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_builds?slug=eq.${encodeURIComponent(slug)}&select=done,ok,steps,started_at,updated_at`, { headers: svc });
      const rows = await r.json().catch(() => null);
      return Array.isArray(rows) && rows[0] ? rows[0] : null;
    },
    // THE ACCOUNT'S LISTED BUILDS, each with the attempt key its send carried
    // (2026-10-14, after run 117): how a lost answer finds its own job.
    builds: (token) => get("/api/site/builds", token).then((r) => (r && r.status === 200 ? r.json : null)),
    // THE JOB'S OWN ROW, by id, non-secret columns only: binds the per-slug trace to this job.
    jobRow: async (job) => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/edit_jobs?id=eq.${encodeURIComponent(job)}&select=id,slug,op,state,created_at,updated_at`, { headers: svc });
        const rows = await r.json().catch(() => null);
        return r.status === 200 && Array.isArray(rows) && rows[0] ? rows[0] : null;
      } catch { return null; }
    },
    source: (token, slug) => get(`/api/site/source?slug=${encodeURIComponent(slug)}`, token),
    // ONE JOB'S OWN STORED VERSION (2026-10-14): the version whose manifest
    // names the job, never the site as it stands now.
    sourceJob: (token, slug, job) => get(`/api/site/source?slug=${encodeURIComponent(slug)}&job=${encodeURIComponent(job)}`, token),
    served: async (slug) => {
      try { const r = await fetch(`https://${slug}.gofarther.app/`, { headers: { "cache-control": "no-cache" } }); return { status: r.status, html: await r.text() }; }
      catch { return { status: 0, html: "" }; }
    },
    image: async (slug, path) => {
      try { const r = await fetch(`https://${slug}.gofarther.app${path}`); const b = Buffer.from(await r.arrayBuffer()); return { status: r.status, type: String(r.headers.get("content-type") || ""), bytes: b.length }; }
      catch { return { status: 0 }; }
    },
    uploads: async (token, slug) => uploadsOf(await get(`/api/site/${encodeURIComponent(slug)}/uploads`, token)),
    // THE LIVE WORKER'S SWITCHES, on a site the account owns (free).
    runtime: (token, slug) => get(`/api/site/runtime?slug=${encodeURIComponent(slug)}`, token),
    // THE WINDOW, READ WHOLE: the exact count asked for, and the answer's
    // range must describe every row it served (`0-(n-1)/n`, or `*/0`).
    // EVERY LEDGER ROW WHOSE REF IS THIS JOB'S, and nothing else (the judge's charges).
    ledgerByJob: async (job) => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/credit_events?uid=eq.${uid}&ref=like.${encodeURIComponent(`build:${job}:*`)}&select=id,kind,reason,delta,ref,at&order=id.asc`, { headers: svc });
        const rows = await r.json().catch(() => null);
        return { ok: r.status === 200 && Array.isArray(rows), rows: Array.isArray(rows) ? rows : null };
      } catch { return { ok: false, rows: null }; }
    },
    ledgerWindow: async (from, to) => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/credit_events?uid=eq.${uid}&id=gt.${Number(from)}&id=lte.${Number(to)}&select=id,kind,reason,delta,ref,at&order=id.asc`, { headers: { ...svc, Prefer: "count=exact" } });
        const rows = await r.json().catch(() => null);
        const range = String(r.headers.get("content-range") || "");
        const complete = windowComplete({ status: r.status, rows, range });
        return { ok: r.status === 200 && Array.isArray(rows), complete, rows: Array.isArray(rows) ? rows : null, range };
      } catch { return { ok: false, complete: false, rows: null }; }
    },
  };
  if (JUDGE) {
    // NOTHING IS SENT: no spend, no balance box, no routing or build call.
    console.log(`JUDGING ONE FINISHED BUILD (sends nothing): slug ${SPEC.slug}, job ${JOB || "(none)"}`);
    const jr = await judgeBuild(io, { spec: SPEC, job: JOB });
    fs.writeFileSync(LOG_FILE, JSON.stringify(jr, null, 2));
    if (jr.stopped) { console.log(`STOPPED: ${jr.stopped}`); return 1; }
    console.log(`PAGES: ${JSON.stringify(jr.shape && jr.shape.pages)}  KIT: ${JSON.stringify(jr.shape && jr.shape.kit)}  WRITTEN: ${JSON.stringify(jr.shape && jr.shape.parts)}`);
    console.log(`TIMELINE: ${jr.order || "(no trace)"}`);
    for (const c of jr.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.why}`}`);
    for (const u of jr.unverified || []) console.log(`  UNVERIFIED  ${u}`);
    console.log(jr.ok ? "JUDGED: PASS" : "JUDGED: FAILED");
    return jr.ok ? 0 : 1;
  }
  console.log(`THE FIRST-BUILD CHECK${SPEC === BUILD_CHECK_NO_IMAGES ? " (no photographs)" : ""}: slug ${SPEC.slug}, budget ${SPEC.budget}, hard cap ${SPEC.cap}, spend ${SPEND ? "yes" : "no"}`);
  const pressFrom = new Date().toISOString();
  const rec = await runBuildCheck(io, { spec: SPEC, spend: SPEND, named: optIn.value });
  fs.writeFileSync(LOG_FILE, JSON.stringify(rec, null, 2));
  // THE BUILD'S OWN NARRATION, MEASURED (2026-10-15, after run 38646089624,
  // whose workflow had no step to read it, so whether its lines were ever
  // written could not be told): the job and the window, for the workflow's
  // next step (`scripts/narration-usage.mjs`), which reads the Worker's own
  // log lines for it. Written whenever a build was sent and its job is known.
  if (rec.sent && rec.job) {
    const dir = process.env.CANARY_EVIDENCE_DIR || "canary-evidence";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/narration-ids.json`, JSON.stringify({ scenario: "build-check", slug: SPEC.slug, from: pressFrom, to: new Date().toISOString(), requests: [], jobs: [rec.job] }, null, 2));
  }
  if (rec.stopped) { console.log(`\n${rec.stopped}`); return rec.sent ? 1 : 0; }
  console.log(`\nACCEPTANCE: ${rec.acceptance === "prompt" ? "prompt — the send's own answer handed the job back" : rec.acceptance === "discovered" ? "discovered — the job was found by this send's attempt key while the send was still out, and followed from then (not prompt acceptance)" : rec.acceptance === "recovered" ? "recovered — the answer was lost; the job was found afterwards by this send's attempt key (not prompt acceptance)" : "none — no job was handed back or found"}`);
  console.log(`THE SEND'S OWN ANSWER: ${rec.accepted ? `${rec.accepted.status}${rec.accepted.why ? ` (${rec.accepted.why})` : ""}${Number.isFinite(rec.accepted.ms) ? ` after ${Math.round(rec.accepted.ms / 1000)} s` : ""}` : "(not sent)"}`);
  console.log(`THE BUILD'S TIMELINE: ${rec.order || "(no trace)"}`);
  if (rec.overlap) console.log(`OVERLAP: ${rec.overlap.ok ? `${rec.overlap.by} — ${rec.overlap.detail}` : rec.overlap.why}`);
  console.log("\nTHE MODEL'S LINES:");
  for (const l of rec.lines || []) console.log(`  ${l.n}: ${l.text}`);
  console.log("\nTHE CHECKS:");
  for (const c of rec.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.why}`}`);
  console.log("\nNOT VERIFIED (said, never passed):");
  for (const u of rec.unverified || []) console.log(`  ${u}`);
  console.log("  the browser reconnecting to a build in flight: this press follows the build through the API only");
  console.log("  whether the build's narration calls ran, and what they cost: read by the workflow's next step from the Worker's own logs");
  console.log(`\nbalance ${rec.balanceStart} -> ${rec.balanceEnd}; ${rec.ok ? "PASSED" : "FAILED"}`);
  return rec.ok ? 0 : 1;
}
