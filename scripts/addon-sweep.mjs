// The addon sweep: one real ask per KIND the ADD step can add, posted straight
// to the addon route on a live site, and after each the SITE is read to see
// whether the thing is there.
//
// ── WHY A THIRD HARNESS ────────────────────────────────────────────────────
//
// The lane sweep exercises the EDIT path through its picker; the gap sweep
// the edit rungs no lane reaches. Neither touches the addon route (owner:
// "IM TALKING ABOUT THE EDIT PATH, NOT THE ADDON"), and until 2026-09-02 the
// addon was the build's designer anchored on the stored look. It is its own
// step now (`builder/site-add.mjs`): a picker that names WHAT is being added,
// one small designer per kind, the page call, one publish. Nothing here has
// run live yet — every claim in the tree is "tested", and this is how one
// becomes "proven on the site".
//
// ── WHAT "WORKS" MEANS HERE ────────────────────────────────────────────────
//
// The same rule as the other two: the reply is the server's claim and the
// site is the evidence. A new route answering 200, listed in the sitemap and
// linked from the home page; a band whose words are on the home page and were
// not before; a build id that moved — or did not, on a refusal. Two kinds are
// driven to their REFUSALS on this site, deliberately: `qr` and `three` on a
// site that already carries both (the add step's mirror of the edit route's
// wall), and `table` on a site with no database. An honest refusal leaves the
// build where it was; a refusal that moved it is a lie.
//
// ── THE ADDON ROUTE IS SYNCHRONOUS ─────────────────────────────────────────
//
// Not on the queue. Each case is one long request — a few model calls and a
// container compile — so `node:https` rather than fetch (undici gives up at
// 300 s). The one hop (`photo` → the picture rung) lands on the edit route,
// which IS queued on the allowlisted site, and is polled the way the lane
// sweep polls.
//
// ── HOW IT SIGNS IN ────────────────────────────────────────────────────────
//
// Admin magic-link, as the other two do.
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { confirmed } from "./lane-sweep.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const SLUG = String(process.env.SWEEP_SLUG || "fretwork-1").trim().toLowerCase();
const PICKER = String(process.env.SWEEP_PICKER || "grok").trim().toLowerCase();
const BUDGET = Number(process.env.SWEEP_BUDGET || 40);
const WANT = String(process.env.SWEEP_LANES || "all").trim().toLowerCase();
const SHOTS = String(process.env.GAP_SHOTS_DIR || "docs/edits").trim();

/** `node:https` rather than fetch — undici gives up at 300s and an addon outlives that. */
function call(method, urlOrPath, { body, headers, token } = {}) {
  return new Promise((resolve) => {
    const u = new URL(/^https?:/.test(urlOrPath) ? urlOrPath : BASE + urlOrPath);
    const t0 = Date.now();
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "content-type": "application/json", ...(headers || {}) },
    }, (res) => {
      let text = "";
      res.on("data", (c) => { text += c; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, ms: Date.now() - t0, json, text, headers: res.headers });
      });
    });
    req.on("error", (e) => resolve({ status: 0, ms: Date.now() - t0, why: e.code || e.message, headers: {}, text: "", json: null }));
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

const SITE = `https://${SLUG}.gofarther.app`;

/** The live site, read plainly and WITHOUT following redirects. */
async function site(p) {
  const r = await fetch(SITE + p, { redirect: "manual", headers: { "accept-encoding": "identity" } }).catch(() => null);
  if (!r) return { status: 0, text: "", headers: new Headers() };
  return { status: r.status, text: await r.text().catch(() => ""), headers: r.headers };
}

const hex32 = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const strip = (html) => String(html || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * `src/routes/gallery.tsx` OR a bare `gallery.tsx` → `/gallery`. Kept in step
 * with `routeOf` in builder/site-addon.mjs, which the reply's paths are read
 * by — both spellings accepted, for the reason recorded there.
 */
export function sitePathOf(file) {
  const m = String(file || "").match(/^(?:src\/routes\/)?(.+)\.tsx$/i);
  if (!m) return "";
  const rel = m[1];
  const cut = rel.lastIndexOf("/");
  const dir = cut < 0 ? "" : rel.slice(0, cut + 1);
  const segs = (cut < 0 ? rel : rel.slice(cut + 1)).split(".").filter(Boolean).map((s) => s.replace(/_$/, ""));
  if (segs.some((s) => s.charAt(0) === "_")) return "";
  if (segs[segs.length - 1] === "index") segs.pop();
  return "/" + (dir + segs.join("/")).replace(/\/$/, "");
}

// ── WHAT THE SITE LOOKS LIKE, in the terms these cases change ──────────────
async function snapshot() {
  const home = await site("/");
  const html = home.text;
  const sitemap = await site("/sitemap.xml");
  return {
    build: home.headers.get("x-site-build") || "",
    status: home.status,
    html,
    text: strip(html),
    hrefs: [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
    routes: [...sitemap.text.matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "")),
  };
}

// ── THE CASES ──────────────────────────────────────────────────────────────
//
// One per kind. `ask` is what a customer would type. `kinds` is what the
// picker must name (any of them). `check(before, after, reply, extra)`
// answers { ok, note } about the SITE. `mayRefuse` names the refusal that is
// the CORRECT answer on this site — a pass with a note, never a failure.
// `hop` names the edit layer the reply must escalate to.
export const CASES = [
  { name: "section", kinds: ["section"],
    ask: "Add a testimonials section to the home page with three short quotes from beginner students",
    check: (b, a, r) => {
      const changed = (Array.isArray(r.changed) ? r.changed : []).map(sitePathOf);
      const words = /testimonial|student|lesson/i.test(a.text) && a.text.length > b.text.length + 80;
      return { ok: changed.includes("/") && a.build !== b.build && words,
               note: `changed ${JSON.stringify(changed)}; home text ${b.text.length}→${a.text.length} chars${words ? "" : " (no new quotes on the page)"}` };
    } },
  { name: "page", kinds: ["page"],
    ask: "Add a pricing page listing lesson prices: a single 30-minute lesson, an hour, and a block of five",
    // Judged by the runner's extra: the new route read live, the sitemap, and
    // a link to it from the home page.
    check: (b, a, r, x) => {
      const fresh = Array.isArray(x.newRoutes) ? x.newRoutes : [];
      const one = fresh.length === 1 ? fresh[0] : "";
      const served = one && x.newStatus === 200;
      const listed = one && a.routes.includes(one);
      const linked = one && a.hrefs.some((h) => h === one || h.startsWith(one + "?") || h.endsWith(one));
      return { ok: !!(one && served && listed && linked && a.build !== b.build),
               note: `added ${JSON.stringify(fresh)}; ${one || "(no route)"} answers ${x.newStatus}; ${listed ? "in" : "NOT in"} the sitemap; ${linked ? "linked" : "NOT linked"} from the home page` };
    } },
  { name: "table", kinds: ["table", "page", "section"],
    ask: "Add a booking form so students can book a trial lesson with their name, email and preferred day",
    // fretwork-1 has no database, so the honest answer is the named refusal.
    mayRefuse: ["no-database"],
    check: (b, a) => ({ ok: a.build === b.build, note: a.build === b.build ? "build unmoved" : "the build moved on a refusal" }) },
  { name: "qr", kinds: ["qr"],
    ask: "Add a QR code that opens the booking page",
    // The site already carries a code (sweep five placed it), so the add step
    // must refuse a second and name the edit path.
    mayRefuse: ["already"],
    check: (b, a) => ({ ok: a.build === b.build, note: a.build === b.build ? "build unmoved" : "the build moved on a refusal" }) },
  { name: "three", kinds: ["three"],
    ask: "Add a 3D model of a guitar you can spin round with the mouse",
    // The site already carries a scene — drawn by the page rung in sweep five,
    // stored as no design field — so "already" here proves the page-source
    // half of the mirror.
    mayRefuse: ["already"],
    check: (b, a) => ({ ok: a.build === b.build, note: a.build === b.build ? "build unmoved" : "the build moved on a refusal" }) },
  { name: "photo", kinds: ["photo"], hop: "picture",
    ask: "Add a photograph of the teaching room to the home page",
    // The add step hands a photograph to the picture rung. The hop itself is
    // the claim under test; what that rung then does (the image balance is
    // empty, so a placeholder or an honest "couldn't be made") is noted.
    check: (b, a, r, x) => ({ ok: x.hopped === "picture", note: `hopped to ${x.hopped || "nowhere"}; the picture rung answered ${x.hopNote || "(nothing)"}` }) },
];

/**
 * Which cases to run — `all`, or a comma list typed exactly.
 *
 * A NAME THE HARNESS DOES NOT KNOW REFUSES, before the sign-in and the
 * balance read (run 16's `kind,slug.`); punctuation at the ends of a name is
 * forgiven, and the list is de-duplicated.
 */
export function chooseCases(want, cases) {
  const trim = (s) => s.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  const w = trim(String(want || "all").trim().toLowerCase());
  if (!w || w === "all") return cases.map((c) => c.name);
  const names = [...new Set(w.split(/[\s,;]+/).map(trim).filter(Boolean))];
  const known = cases.map((c) => c.name);
  const strangers = names.filter((n) => !known.includes(n));
  if (strangers.length) throw new Error(`not a case: ${strangers.map((s) => `"${s}"`).join(", ")} — the cases are ${known.join(", ")}`);
  return names;
}

// ── A BROWSER, IF THERE IS ONE ─────────────────────────────────────────────
//
// Screenshots of every addition (owner: "always show UI changes as
// screenshots"). Optional — a runner without playwright still judges.
let browser = null;
async function openBrowser() {
  try {
    const pw = await import("playwright");
    browser = await pw.chromium.launch({ args: ["--no-sandbox"] });
    return true;
  } catch (e) { console.log(`   (no browser: ${String(e && e.message).split("\n")[0].slice(0, 80)} — screenshots are skipped)`); return false; }
}
async function shot(url, file) {
  if (!browser) return "";
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    // The kit reveals sections on scroll and a headless full-page capture
    // leaves them at opacity 0 — an instrument artefact this repo recorded.
    await page.addStyleTag({ content: "[data-slot],section,main *{opacity:1 !important;animation:none !important;transform:none !important;visibility:visible !important}" }).catch(() => {});
    await page.waitForTimeout(800);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true });
    await page.close();
    return file;
  } catch (e) { console.log(`   (screenshot failed: ${String(e && e.message).slice(0, 80)})`); return ""; }
}

// ── RUN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!confirmed(process.env.SWEEP_CONFIRM)) { console.error("SWEEP_CONFIRM must be the word `spend` — this harness costs real credits on a live site."); process.exit(1); }
  if (!EMAIL || !SERVICE_KEY || !SLUG) { console.error("OWNER_EMAIL, SUPABASE_SERVICE_KEY and SWEEP_SLUG are required"); process.exit(1); }
  let names;
  try { names = chooseCases(WANT, CASES); } catch (e) { console.error(String(e && e.message)); process.exit(1); }
  if (!names.length) { console.error("no cases selected"); process.exit(1); }

  const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
  const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }) });
  const glBody = await gl.json().catch(() => ({}));
  const hashed = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
  if (!hashed) { console.error("could not generate a sign-in link:", gl.status); process.exit(1); }
  const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: hashed }) });
  const session = await vr.json().catch(() => ({}));
  const TOKEN = session.access_token; const UID = (session.user || {}).id || "";
  if (!TOKEN) { console.error("could not open a session:", vr.status); process.exit(1); }
  const balance = () => fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${UID}&select=balance`, { headers: svc })
    .then((r) => r.json()).then((r) => Number((r[0] || {}).balance || 0)).catch(() => -1);

  console.log(`signed in as ${(session.user || {}).email}  site=${SLUG}  picker=${PICKER}  budget=${BUDGET}`);
  console.log(`cases: ${names.join(", ")}\n`);
  await openBrowser();
  const start = await balance();
  console.log(`balance at start: ${start}\n`);
  let before = await snapshot();
  if (before.status !== 200) { console.error(`the site does not answer 200 (${before.status}) — nothing to sweep against`); process.exit(1); }
  console.log(`site is up, build ${before.build}, routes ${JSON.stringify(before.routes)}\n`);

  const results = [];
  let n = 0;
  for (const name of names) {
    const c = CASES.find((x) => x.name === name);
    n++;
    const spent = start - (await balance());
    if (spent > BUDGET) { console.log(`BUDGET EXHAUSTED (${spent} > ${BUDGET}) — stopping before ${name}`); break; }
    console.log(`━━ ${name}  "${c.ask}"`);
    const bal0 = await balance();
    const t0 = Date.now();
    const p = await call("POST", `/api/site/${encodeURIComponent(SLUG)}/addon`, { token: TOKEN, body: { instruction: c.ask, picker: PICKER } });
    console.log(`   answered ${p.status} in ${(p.ms / 1000).toFixed(1)}s`);
    const body = (p && p.json) || {};
    const extra = {};
    // ── THE HOP ───────────────────────────────────────────────────────────
    //
    // A photograph is the picture rung's: the add step escalates naming that
    // layer, and the browser hands the same sentence to the edit route as a
    // handed-off edit. The runner does the same, once, only for the case that
    // says so, and polls the queued job the way the lane sweep does.
    if (c.hop && body.escalate === true && body.layer === c.hop) {
      extra.hopped = body.layer;
      const e = await call("POST", `/api/site/${encodeURIComponent(SLUG)}/edit`,
        { token: TOKEN, body: { instruction: c.ask, layer: c.hop, page: "", remove: false, rename: "", tab: false, picker: PICKER, idem: hex32() } });
      let reply = e;
      if (e.status === 202 && e.json && e.json.job) {
        console.log(`   hopped to ${c.hop}; queued ${e.json.job}`);
        reply = null;
        for (let i = 0; i < 120; i++) {
          await sleep(5000);
          const q = await call("GET", `/api/site/edit/${e.json.job}`, { token: TOKEN });
          if (q.status === 404) { reply = q; break; }
          if ((q.headers["x-gf-edit"] || "") === "final") { reply = q; break; }
          if (q.json && ["failed", "cancelled", "lost"].includes(q.json.status)) { reply = q; break; }
        }
      } else {
        console.log(`   hopped to ${c.hop}; synchronous answer ${e.status}`);
      }
      const hb = (reply && reply.json) || {};
      extra.hopNote = reply ? `${reply.status} ${hb.ok === true ? "ok" : String(hb.error || hb.reason || "")}${hb.msg ? " — " + String(hb.msg).slice(0, 120) : ""}` : "no answer inside the watch";
      extra.hopOk = !!(hb.ok === true);
    }
    const wall = (Date.now() - t0) / 1000;
    const bal1 = await balance();
    const cost = bal0 - bal1;
    // THE EDGE IS NOT THE DATABASE: a claimed publish waits for the build id
    // to move, bounded; a refusal must NOT move it and is read at once.
    let seen = "";
    if (body.ok === true || extra.hopOk) {
      const t1 = Date.now();
      while (Date.now() - t1 < 90000) {
        const probe = await site("/");
        const id = probe.headers.get("x-site-build") || "";
        if (id && id !== before.build) { seen = id; break; }
        await sleep(5000);
      }
    }
    let after = await snapshot();
    for (let i = 0; seen && after.build !== seen && i < 6; i++) { await sleep(5000); after = await snapshot(); }
    // THE NEW PAGE'S EVIDENCE: the route the reply named, read live.
    if (body.ok === true) {
      extra.newRoutes = (Array.isArray(body.added) ? body.added : []).map(sitePathOf).filter(Boolean);
      if (extra.newRoutes.length === 1) extra.newStatus = (await site(extra.newRoutes[0])).status;
    }
    const claimedOk = body.ok === true;
    const escalated = body.escalate === true;
    let verdict, note;
    if (p.status === 0) { verdict = "NO ANSWER"; note = `the request died: ${p.why || "?"}`; }
    else if (c.hop) {
      const chk = c.check(before, after, body, extra);
      verdict = chk.ok ? "ok (hopped)" : (escalated ? "escalated" : (claimedOk ? "LIE" : "failed"));
      note = chk.note + (escalated && !chk.ok ? `; escalate ${body.reason} layer ${body.layer || "-"}` : "");
      if (!escalated && !claimedOk) note += `; ${p.status} ${String(body.error || "")} — ${String(body.detail || body.msg || "").slice(0, 160)}`;
    }
    else if (!claimedOk && c.mayRefuse && c.mayRefuse.includes(String(body.error))) {
      const chk = c.check(before, after, body, extra);
      verdict = chk.ok ? "ok (honest refusal)" : "LIE"; note = `refused ${body.error}${body.kind ? " " + body.kind : ""} — "${String(body.msg || "").slice(0, 120)}"; ${chk.note}`;
    }
    else if (escalated) { verdict = "escalated"; note = `reason ${body.reason} layer ${body.layer || "-"}${after.build !== before.build ? " — AND THE BUILD MOVED, which an escalate must never do" : ""}`; if (after.build !== before.build) verdict = "LIE"; }
    else if (!claimedOk) { verdict = "failed"; note = `${p.status} ${String(body.error || "")}${body.kind ? " " + body.kind : ""}${body.reason ? " " + body.reason : ""} — ${String(body.detail || body.msg || p.text || "").slice(0, 200)}`; }
    else {
      const chk = c.check(before, after, body, extra);
      const moved = after.build !== before.build;
      if (chk.ok && moved) { verdict = "ok"; note = chk.note; }
      else if (!moved) { verdict = "LIE"; note = `reply says ok but the build did not move; ${chk.note}`; }
      else { verdict = "LIE"; note = `reply says ok, build moved, but the addition is not on the site; ${chk.note}`; }
    }
    const kinds = Array.isArray(body.kinds) ? body.kinds : [];
    const pickedRight = !kinds.length || kinds.some((k) => c.kinds.includes(k));
    // THE PICTURES, on a publish only: the home page, and the new page if one.
    const shots = [];
    if (verdict.startsWith("ok") && after.build !== before.build) {
      const tag = String(n).padStart(2, "0") + "-" + name;
      const a = await shot(SITE + "/", path.join(SHOTS, `addon-${tag}.png`)); if (a) shots.push(a);
      if (extra.newRoutes && extra.newRoutes.length === 1) { const b = await shot(SITE + extra.newRoutes[0], path.join(SHOTS, `addon-${tag}-page.png`)); if (b) shots.push(b); }
    }
    console.log(`   kinds ${JSON.stringify(kinds)}${pickedRight ? "" : "  ← NOT " + JSON.stringify(c.kinds)}  cost=${cost}  ${wall.toFixed(0)}s  build ${before.build}→${after.build}${shots.length ? "  shots " + shots.join(", ") : ""}`);
    console.log(`   ${verdict.toUpperCase()}: ${note}\n`);
    results.push({ name, kinds, verdict, note, cost, wall: Math.round(wall), build: after.build, pickedRight, shots });
    if (verdict === "LIE" || verdict === "NO ANSWER") { console.log(`STOPPING on ${name}: ${verdict}`); break; }
    before = after;
  }

  const end = await balance();
  console.log("\n══ SUMMARY ══");
  console.log("case".padEnd(10) + "kinds".padEnd(22) + "cost".padEnd(6) + "s".padEnd(6) + "verdict");
  for (const r of results) console.log(r.name.padEnd(10) + JSON.stringify(r.kinds).padEnd(22) + String(r.cost).padEnd(6) + String(r.wall).padEnd(6) + r.verdict + (r.pickedRight ? "" : "  (picker named the wrong kind)"));
  console.log(`\nbalance ${start} → ${end}  (spent ${start - end})`);
  console.log(`\n${JSON.stringify(results)}`);
  try { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, "addon-sweep-results.json"), JSON.stringify({ at: new Date().toISOString(), site: SLUG, start, end, results }, null, 2)); } catch { /* the log carries it */ }
  if (browser) await browser.close().catch(() => {});
  // A FAILED CASE IS A RED RUN, as the lane sweep learned on run 17.
  const bad = results.filter((r) => /LIE|NO ANSWER|^failed$/.test(r.verdict));
  process.exit(bad.length ? 1 : 0);
}

// Importable for its CASES without running: the test reads the table.
if (process.argv[1] && /addon-sweep\.mjs$/.test(process.argv[1])) main();
