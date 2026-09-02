// The gap sweep: the parts of the edit path the lane sweep could not reach,
// each driven once on a live site and judged by reading the site afterwards.
//
// ── WHY A SECOND HARNESS ───────────────────────────────────────────────────
//
// Owner, 2026-09-02: *"OK LETS TEST THE MISSING ONES"*, after the lane sweep
// had run nineteen of twenty-one lanes and the record showed what it could
// not reach. `lane-sweep.mjs` posts one ask per DESIGN FIELD through the lane
// picker; a rung with no lane of its own (`text`, `logo`, the `page` verbs
// `move` and `remove`, the addon route, `data`, `rules`) never gets a message,
// and a behaviour of the QUEUE rather than of a rung (cancel) is not an ask at
// all. Bolting those onto the lane table would break the guard that derives
// that table from `LANE_FIELDS` in both directions, and that guard has earned
// its keep twice. So: a second table, keyed on what is being exercised rather
// than on a field, with its own guard.
//
// ── WHAT "WORKS" MEANS HERE ────────────────────────────────────────────────
//
// The same rule as the lane sweep: the reply is the server's claim and the
// site is the evidence. A route that answers 200, a sitemap that lists it, a
// header link whose words changed, a row that reads back through the site's
// own data API, a build id that moved — or did not, on a cancel. Two cases
// (`rules`, `backend`) have no visitor-visible surface on a database this
// harness cannot read, and they SAY so: their verdict carries "reply-judged".
//
// ── TWO SITES ──────────────────────────────────────────────────────────────
//
// `fretwork-1` has no database, which is why the lane sweep's `backend` case
// was an honest refusal and why `data` and `rules` could not run there at
// all. Those three run on a site that HAS one (`the-lido-cafe` by default).
// That site is not on the async allowlist, so its edits answer synchronously
// — the same code, one hop shorter — and the runner below handles both shapes.
//
// ── HOW IT SIGNS IN ────────────────────────────────────────────────────────
//
// Admin magic-link, as the lane sweep and the canary do.
import https from "node:https";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { confirmed } from "./lane-sweep.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const SLUG = String(process.env.GAP_SLUG || "fretwork-1").trim().toLowerCase();
const DB_SLUG = String(process.env.GAP_DB_SLUG || "the-lido-cafe").trim().toLowerCase();
const PICKER = String(process.env.SWEEP_PICKER || "grok").trim().toLowerCase();
const BUDGET = Number(process.env.GAP_BUDGET || 60);
const WANT = String(process.env.GAP_CASES || "all").trim().toLowerCase();
const SHOTS = String(process.env.GAP_SHOTS_DIR || "docs/edits").trim();

/** `node:https` rather than fetch — undici gives up at 300s and the addon route can outlive that. */
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

const siteUrl = (slug) => `https://${slug}.gofarther.app`;

/** The live site, read plainly and WITHOUT following redirects — a moved page's 3xx is evidence. */
async function site(slug, p) {
  const r = await fetch(siteUrl(slug) + p, { redirect: "manual", headers: { "accept-encoding": "identity" } }).catch(() => null);
  if (!r) return { status: 0, text: "", headers: new Headers() };
  return { status: r.status, text: await r.text().catch(() => ""), headers: r.headers };
}

const hex32 = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const attr = (html, re) => { const m = re.exec(html); return m ? m[1] : ""; };
const pick = (html, re) => { const m = re.exec(html); return m ? m[0] : ""; };
const strip = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── WHAT THE SITE LOOKS LIKE, in the terms these cases change ──────────────
async function snapshot(slug) {
  const home = await site(slug, "/");
  const html = home.text;
  const sitemap = await site(slug, "/sitemap.xml");
  const header = pick(html, /<header[\s\S]*?<\/header>/);
  return {
    build: home.headers.get("x-site-build") || "",
    status: home.status,
    html,
    title: attr(html, /<title>([^<]*)<\/title>/),
    headerText: strip(header),
    headerLink: pick(html, /<a[^>]*data-slot="site-link"[^>]*>[\s\S]*?<\/a>/),
    // THE BRAND LINK, the first anchor in the header — where a logo lands.
    brandLink: pick(header, /<a[^>]*>[\s\S]*?<\/a>/),
    routes: [...sitemap.text.matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "")),
  };
}

// ── A REAL PNG, DRAWN HERE, FOR THE LOGO CASE ──────────────────────────────
//
// The logo lane's whole contract is "the attachment IS the instruction", so
// the case needs a picture — and `site-logo.mjs` sniffs the bytes and refuses
// svg, so it has to be a real raster. Ninety-six by thirty-two, two colours in
// stripes, RGB, no dependencies: zlib is in Node.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
export function tinyPng(w = 96, h = 32) {
  const row = w * 3 + 1;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const i = y * row + 1 + x * 3;
      const stripe = Math.floor(x / 16) % 2 === 0;
      raw[i] = stripe ? 0x1f : 0xd6; raw[i + 1] = stripe ? 0x5c : 0x3a; raw[i + 2] = stripe ? 0x3a : 0x2e;
    }
  }
  const chunk = (type, data) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}
export const tinyPngDataUrl = () => "data:image/png;base64," + tinyPng().toString("base64");

// ── THE CASES ──────────────────────────────────────────────────────────────
//
// `name` is what is being exercised. `where` is `main` (the frontend-only
// site) or `db` (the one with a database). `via` says how the message goes in:
//   `route`  — ask `/api/site/route` first and post what it decides, as the
//              chatbox does. The one case that also tests the intent router.
//   `<layer>`— post that layer directly (the lane sweep's stated shortcut).
//   `addon`  — POST the addon route itself, synchronously.
// `ask` is a string or a function of the before-snapshot (a move needs the
// route the addon actually created). `body(before)` adds fields. `skip(before)`
// answers a reason to not spend at all. `publishes` says the build id must
// move on success. `judged` is `site` or `reply`, and the summary prints it.
// `cancel` marks the one case that DELETEs its own job once it is claimed.
export const CASES = [
  { name: "text", where: "main", via: "route", publishes: true, judged: "site",
    ask: 'Change the words "Get your first lesson free" to "Your first lesson is free"',
    skip: (b) => (/Get your first lesson free/.test(b.html) ? "" : "the phrase this case rewrites is not on the page"),
    check: (b, a) => {
      const was = (b.html.match(/Get your first lesson free/g) || []).length;
      const now = (a.html.match(/Get your first lesson free/g) || []).length;
      const has = /Your first lesson is free/.test(a.html);
      return { ok: has && now < was, note: `"Your first lesson is free" ${has ? "present" : "absent"}; old phrase ${was}→${now}` };
    } },
  { name: "logo", where: "main", via: "logo", publishes: true, judged: "site",
    ask: "Use this picture as the logo in the header",
    body: () => ({ images: [tinyPngDataUrl()] }),
    check: (b, a, r) => {
      const src = (l) => attr(l, /<img[^>]*src="([^"]+)"/);
      const before = src(b.brandLink), after = src(a.brandLink);
      const url = String((r && r.url) || "");
      // THE UPLOAD MUST BE WHAT THE HEADER SHOWS. A reply that names an upload
      // while the header still draws the wordmark is the lane storing a logo
      // nothing renders — the qr finding again, one slot over.
      const shown = !!after && after !== before && (!url || after.includes(url.replace(/^https?:\/\/[^/]+/, "")) || url.includes(after));
      return { ok: shown, note: `brand image ${before || "(none)"} → ${after || "(none)"}; reply url ${url || "(none)"}` };
    } },
  { name: "cancel", where: "main", via: "look", publishes: false, judged: "site", cancel: true,
    ask: "Add a testimonials band with two short quotes from students under the price list",
    check: (b, a, r, x) => ({ ok: a.build === b.build && x.state === "cancelled",
      note: `job state ${x.state || "?"}; build ${a.build === b.build ? "unchanged" : "MOVED"}; billing ${x.billing || "?"}` }) },
  // THE ADDON ROUTE REFUSES A SITE WITHOUT A DATABASE — `if (!adb) return
  // aEscalate("no-backend")` in worker.js — which is most sites on the
  // platform, and what `pages add` points at from every one of them. Recorded
  // here for nothing (the refusal comes before any model call) so the summary
  // says it in the owner's own numbers; then the real addon runs where it can.
  { name: "addon-nodb", where: "main", via: "addon", publishes: false, judged: "site", expectEscalate: ["no-backend"],
    ask: "Add a pricing page listing the lesson prices",
    check: (b, a) => ({ ok: a.build === b.build, note: "the addon route on a frontend-only site" }) },
  { name: "addon", where: "db", via: "addon", publishes: true, judged: "site",
    ask: "Add an opening hours page",
    skip: (b) => (b.routes.some((r) => /hour|times?$|open/i.test(r)) ? "the site already has an hours page" : ""),
    check: (b, a, r, x) => {
      const added = a.routes.filter((rt) => !b.routes.includes(rt));
      return { ok: added.length === 1 && x.pageStatus === 200, note: `routes added ${JSON.stringify(added)}; ${added[0] || "(none)"} answers ${x.pageStatus ?? "?"}; reply added ${JSON.stringify(r.added || [])}` };
    } },
  { name: "move", where: "db", via: "look", publishes: true, judged: "site",
    ask: (b, ctx) => `Move the page at ${ctx.added} to /times`,
    skip: (b, ctx) => (ctx.added && b.routes.includes(ctx.added) ? "" : "no page to move (the addon case did not add one)"),
    check: (b, a, r, x) => {
      const from = x.from;
      const redirected = x.oldStatus >= 300 && x.oldStatus < 400 && /\/times\/?$/.test(String(x.oldLocation || ""));
      return { ok: a.routes.includes("/times") && !a.routes.includes(from) && x.newStatus === 200 && redirected,
        note: `/times answers ${x.newStatus ?? "?"}; ${from} answers ${x.oldStatus ?? "?"}${x.oldLocation ? " → " + x.oldLocation : ""}; sitemap ${JSON.stringify(a.routes)}` };
    } },
  { name: "remove", where: "db", via: "look", publishes: true, judged: "site",
    ask: "Remove the page at /times",
    skip: (b) => (b.routes.includes("/times") ? "" : "no /times page to remove"),
    check: (b, a, r, x) => ({ ok: !a.routes.includes("/times") && x.newStatus === 404,
      note: `/times answers ${x.newStatus ?? "?"}; sitemap ${JSON.stringify(a.routes)}` }) },
  { name: "data", where: "db", via: "data", publishes: false, judged: "site",
    ask: "Add Cortado at £2.80 to the menu, under Coffee",
    check: (b, a, r, x) => {
      const row = (x.rows || []).find((m) => /cortado/i.test(String(m && m.name)));
      const rendered = typeof x.menuText === "string" ? /cortado/i.test(x.menuText) : null;
      return { ok: !!row && rendered !== false && a.build === b.build,
        note: `row ${row ? JSON.stringify({ name: row.name, price: row.price, category: row.category }) : "ABSENT"}; menu page ${rendered === null ? "not rendered (no browser)" : rendered ? "shows it" : "DOES NOT SHOW IT"}; build ${a.build === b.build ? "unchanged (data edits do not republish)" : "MOVED"}` };
    } },
  { name: "rules", where: "db", via: "rules", publishes: false, judged: "reply",
    ask: "Make the phone number required when someone books a table",
    check: (b, a, r) => ({ ok: Array.isArray(r.applied) && r.applied.length > 0 && a.build === b.build,
      note: `applied ${JSON.stringify(r.applied || [])}; refused ${JSON.stringify(r.refused || [])}; "${String(r.msg || "").slice(0, 120)}"` }) },
  { name: "backend", where: "db", via: "look", publishes: false, judged: "reply",
    ask: "Keep a note of any allergies with each table booking",
    check: (b, a, r) => ({ ok: r.layer === "rules" && Array.isArray(r.applied) && r.applied.length > 0 && a.build === b.build,
      note: `layer ${r.layer || "-"}; lanes ${JSON.stringify(r.lanes || [])}; applied ${JSON.stringify(r.applied || [])}; "${String(r.msg || "").slice(0, 120)}"` }) },
];

/** The one route the addon case added — remembered in `ctx` for the verbs that follow it. */
export const addedRoute = (before, after) => {
  const added = (after.routes || []).filter((r) => !(before.routes || []).includes(r));
  return added.length === 1 ? added[0] : "";
};

export function chooseCases(want, cases) {
  const w = String(want || "all").trim().toLowerCase();
  if (w === "all") return cases.map((c) => c.name);
  const names = w.split(/[\s,;]+/).filter(Boolean);
  const known = new Set(cases.map((c) => c.name));
  return names.filter((n) => known.has(n));
}

// ── A BROWSER, IF THERE IS ONE ─────────────────────────────────────────────
//
// Screenshots of every edit (owner: "make sure you save screenshots of the
// past edits so we can look at them"), and the one check that needs a
// rendered page: the lido menu is drawn from rows at runtime, so the item is
// not in the served HTML and only a browser can say whether a visitor sees it.
// Optional — a runner without playwright still judges everything else.
let browser = null;
async function openBrowser() {
  try {
    const pw = await import("playwright");
    browser = await pw.chromium.launch({ args: ["--no-sandbox"] });
    return true;
  } catch (e) { console.log(`   (no browser: ${String(e && e.message).split("\n")[0].slice(0, 80)} — screenshots and the rendered-menu check are skipped)`); return false; }
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
async function renderText(url) {
  if (!browser) return null;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    await page.close();
    return String(text || "");
  } catch { return null; }
}

// ── RUN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!confirmed(process.env.SWEEP_CONFIRM)) { console.error("SWEEP_CONFIRM must be the word `spend` — this harness costs real credits on live sites."); process.exit(1); }
  if (!EMAIL || !SERVICE_KEY) { console.error("OWNER_EMAIL and SUPABASE_SERVICE_KEY are required"); process.exit(1); }
  const names = chooseCases(WANT, CASES);
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
  // THE JOB ROW IS THE GROUND TRUTH for a queued case: state, billing, cost.
  const jobRow = (id) => fetch(`${SUPABASE_URL}/rest/v1/edit_jobs?id=eq.${id}&select=state,billing,cost,needs_review,published_at,phase_ms`, { headers: svc })
    .then((r) => r.json()).then((r) => (Array.isArray(r) && r[0]) || {}).catch(() => ({}));

  console.log(`signed in as ${(session.user || {}).email}  main=${SLUG}  db=${DB_SLUG}  picker=${PICKER}  budget=${BUDGET}`);
  console.log(`cases: ${names.join(", ")}\n`);
  const start = await balance();
  console.log(`balance at start: ${start}`);
  console.log(`browser: ${(await openBrowser()) ? "yes" : "no"}\n`);

  const results = [];
  // WHAT ONE CASE LEAVES FOR THE NEXT: the route the addon added is the page
  // the move case moves and the remove case removes.
  const ctx = { added: "" };
  let n = 0;
  for (const name of names) {
    const c = CASES.find((x) => x.name === name);
    const slug = c.where === "db" ? DB_SLUG : SLUG;
    const spent = start - (await balance());
    if (spent > BUDGET) { console.log(`BUDGET EXHAUSTED (${spent} > ${BUDGET}) — stopping before ${name}`); break; }
    n++;
    const before = await snapshot(slug);
    if (before.status !== 200) { console.log(`━━ ${name}: ${slug} does not answer 200 (${before.status}) — skipped\n`); results.push({ name, slug, verdict: "skipped", note: `site answered ${before.status}`, cost: 0, wall: 0 }); continue; }
    const why = c.skip ? c.skip(before, ctx) : "";
    if (why) { console.log(`━━ ${name}: skipped — ${why}\n`); results.push({ name, slug, verdict: "skipped", note: why, cost: 0, wall: 0 }); continue; }
    const ask = typeof c.ask === "function" ? c.ask(before, ctx) : c.ask;
    console.log(`━━ ${name} on ${slug}  "${ask}"`);
    const bal0 = await balance();
    const t0 = Date.now();
    const extra = {};

    // ── THE MESSAGE GOES IN, one of three ways ──────────────────────────
    let p;
    if (c.via === "addon") {
      p = await call("POST", `/api/site/${encodeURIComponent(slug)}/addon`, { token: TOKEN, body: { instruction: ask, picker: PICKER } });
      console.log(`   addon route answered ${p.status} in ${(p.ms / 1000).toFixed(1)}s`);
    } else {
      let fields = { layer: c.via, page: "", remove: false, rename: "", tab: false };
      if (c.via === "route") {
        const digest = { name: slug, url: siteUrl(slug), pages: before.routes.map((r) => ({ path: r })), tables: [] };
        const rt = await call("POST", "/api/site/route", { token: TOKEN, body: { message: ask, site: digest, firstBuild: false, brief: ask, qa: [], answering: false, attached: false, slug, hasSite: true } });
        const rd = rt.json || {};
        extra.routed = { intent: rd.intent || "", layer: rd.layer || "", page: rd.page || "", cost: rd.cost };
        console.log(`   router: intent=${rd.intent || "?"} layer=${rd.layer || "-"} page=${rd.page || "-"} in ${(rt.ms / 1000).toFixed(1)}s`);
        if (rt.status !== 200 || rd.intent !== "edit" || !rd.layer) {
          const bal1 = await balance();
          console.log(`   ROUTER DID NOT NAME AN EDIT LAYER — not posting (would escalate on \`layer\` for nothing)\n`);
          results.push({ name, slug, verdict: "router", note: `intent ${rd.intent || "?"} layer ${rd.layer || "-"}`, cost: bal0 - bal1, wall: Math.round((Date.now() - t0) / 1000), routed: extra.routed });
          continue;
        }
        fields = { layer: String(rd.layer), page: rd.page ? String(rd.page) : "", remove: rd.remove === true, rename: typeof rd.rename === "string" ? rd.rename : "", tab: rd.tab === true };
      }
      const body = { ...fields, instruction: ask, picker: PICKER, idem: hex32(), ...(c.body ? c.body(before) : {}) };
      p = await call("POST", `/api/site/${encodeURIComponent(slug)}/edit`, { token: TOKEN, body });
    }

    // ── AND THE ANSWER COMES BACK, queued or inline ─────────────────────
    let reply = p; let job = "";
    if (p.status === 202 && p.json && p.json.job) {
      job = p.json.job;
      console.log(`   queued ${job} in ${(p.ms / 1000).toFixed(1)}s`);
      reply = null;
      let cancelledAt = 0;
      for (let i = 0; i < 200; i++) {
        await sleep(5000);
        const q = await call("GET", `/api/site/edit/${job}`, { token: TOKEN });
        if (q.status === 404) { reply = q; break; }
        if ((q.headers["x-gf-edit"] || "") === "final") { reply = q; break; }
        const st = (q.json && q.json.status) || "";
        if (["failed", "cancelled", "lost", "done"].includes(st)) { reply = q; break; }
        // THE CANCEL, once the job is claimed and the lane has had a moment to
        // start — the point is to stop work in flight, not a job still in the
        // queue. DELETEd exactly once; what the queue does next is the result.
        if (c.cancel && !cancelledAt && st && st !== "queued" && Date.now() - t0 > 15000) {
          const d = await call("DELETE", `/api/site/edit/${job}`, { token: TOKEN });
          cancelledAt = Date.now();
          extra.cancelReply = d.json || d.text.slice(0, 120);
          console.log(`   ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  DELETE → ${d.status} ${JSON.stringify(extra.cancelReply).slice(0, 120)}`);
        }
        if (i % 6 === 0 && q.json) console.log(`   ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ${st || "?"}${q.json.phase ? " / " + q.json.phase : ""}`);
      }
    } else if (c.via !== "addon") {
      console.log(`   synchronous answer ${p.status} in ${(p.ms / 1000).toFixed(1)}s`);
    }
    const wall = (Date.now() - t0) / 1000;
    const body = (reply && reply.json) || {};
    if (job) Object.assign(extra, await jobRow(job));
    const bal1 = await balance();
    const cost = bal0 - bal1;

    // THE EDGE IS NOT THE DATABASE — a claimed success waits, bounded, for
    // the build id to move before the site is read (the lane sweep's rule).
    if (c.publishes && body.ok === true) {
      const t1 = Date.now();
      while (Date.now() - t1 < 90000) {
        const probe = await site(slug, "/");
        if ((probe.headers.get("x-site-build") || "") !== before.build) break;
        await sleep(5000);
      }
    }
    const after = await snapshot(slug);

    // ── THE EVIDENCE EACH CASE NEEDS BEYOND THE HOME PAGE ───────────────
    if (c.name === "addon") {
      const target = addedRoute(before, after);
      if (target) { ctx.added = target; extra.pageStatus = (await site(slug, target)).status; }
    }
    if (c.name === "move") {
      extra.from = ctx.added;
      const o = await site(slug, ctx.added); extra.oldStatus = o.status; extra.oldLocation = o.headers.get("location") || "";
      extra.newStatus = (await site(slug, "/times")).status;
    }
    if (c.name === "remove") extra.newStatus = (await site(slug, "/times")).status;
    if (c.name === "data") {
      const rows = await fetch(`${siteUrl(slug)}/api/db/${slug}/data/menu_items?select=*`).then((r) => r.json()).catch(() => []);
      extra.rows = Array.isArray(rows) ? rows : [];
      extra.menuText = await renderText(`${siteUrl(slug)}/menu`);
    }

    // ── THE VERDICT ─────────────────────────────────────────────────────
    const claimedOk = body.ok === true;
    const escalated = body.escalate === true;
    let verdict, note;
    if (!reply) { verdict = "NO ANSWER"; note = "the job did not finish inside the watch"; }
    else if (body.review === true || body.error === "needs-review" || extra.needs_review === true) { verdict = "NEEDS REVIEW"; note = "stopping — do not retry"; }
    else if (c.cancel) {
      const chk = c.check(before, after, body, extra);
      if (chk.ok) { verdict = "ok"; note = chk.note; }
      else if (extra.state === "done" && after.build !== before.build) { verdict = "ok (too late)"; note = `the edit finished before the cancel landed — an honest outcome; ${chk.note}`; }
      else { verdict = "failed"; note = chk.note; }
    }
    else if (escalated && c.expectEscalate && c.expectEscalate.includes(String(body.reason))) {
      // THE REFUSAL THE CODE SAYS IT WILL MAKE. Not "ok" — the summary must not
      // read a platform gap as a pass — and not "escalated", which is the word
      // for a refusal nobody predicted. Its own word, so the table says it.
      const chk = c.check(before, after, body, extra);
      verdict = chk.ok && after.build === before.build ? "refused as coded" : "LIE"; note = `escalate ${body.reason}; ${chk.note}`;
    }
    else if (escalated) {
      verdict = after.build !== before.build ? "LIE" : "escalated";
      note = `reason ${body.reason}${body.page ? " (" + body.page + ")" : ""}${after.build !== before.build ? " — AND THE BUILD MOVED, which an escalate must never do" : ""}`;
    }
    else if (claimedOk && typeof body.lookNote === "string" && !(Array.isArray(body.moved) && body.moved.length) && after.build === before.build) { verdict = "ok (already so)"; note = body.lookNote; }
    else if (!claimedOk) { verdict = "failed"; note = `${reply.status} ${String(body.error || "")} — ${String(body.detail || body.msg || reply.text || "").slice(0, 220)}`; }
    else {
      const chk = c.check(before, after, body, extra);
      const moved = after.build !== before.build;
      if (c.publishes && !moved) { verdict = "LIE"; note = `reply says ok but the build did not move; ${chk.note}`; }
      else if (chk.ok) { verdict = c.judged === "reply" ? "ok (reply-judged)" : "ok"; note = chk.note; }
      else { verdict = "LIE"; note = `reply says ok but the site does not show it; ${chk.note}`; }
    }

    // ── THE PICTURE ─────────────────────────────────────────────────────
    const tag = `gap-${String(n).padStart(2, "0")}-${name}`;
    const shots = [];
    if (name !== "data" && !/escalated|refused/.test(verdict)) {
      const f = await shot(siteUrl(slug) + "/", path.join(SHOTS, `${tag}.png`)); if (f) shots.push(f);
      const page = name === "addon" ? ctx.added : name === "move" ? "/times" : "";
      if (page) { const g = await shot(siteUrl(slug) + page, path.join(SHOTS, `${tag}-page.png`)); if (g) shots.push(g); }
    }
    if (name === "data") { const f = await shot(siteUrl(slug) + "/menu", path.join(SHOTS, `${tag}.png`)); if (f) shots.push(f); }

    console.log(`   layer=${body.layer || (extra.routed && extra.routed.layer) || "-"}  lanes=${JSON.stringify(body.lanes || [])}  cost=${cost}  ${wall.toFixed(0)}s  build ${before.build}→${after.build}${job ? "  job " + job + " " + (extra.state || "?") + "/" + (extra.billing || "?") : ""}`);
    console.log(`   ${verdict.toUpperCase()}: ${note}${shots.length ? "\n   shots " + shots.join(", ") : ""}\n`);
    results.push({ name, slug, via: c.via, judged: c.judged, verdict, note, cost, wall: Math.round(wall), job, state: extra.state || "", billing: extra.billing || "", build: after.build, layer: body.layer || "", routed: extra.routed, shots });
    if (verdict === "LIE" || verdict === "NEEDS REVIEW" || verdict === "NO ANSWER") { console.log(`STOPPING on ${name}: ${verdict}`); break; }
  }

  if (browser) await browser.close().catch(() => {});
  const end = await balance();
  console.log("\n══ SUMMARY ══");
  console.log("case".padEnd(10) + "site".padEnd(16) + "via".padEnd(8) + "cost".padEnd(6) + "s".padEnd(6) + "verdict");
  for (const r of results) console.log(r.name.padEnd(10) + String(r.slug).padEnd(16) + String(r.via || "").padEnd(8) + String(r.cost).padEnd(6) + String(r.wall).padEnd(6) + r.verdict);
  console.log(`\nbalance ${start} → ${end}  (spent ${start - end})`);
  try { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, "gap-sweep-results.json"), JSON.stringify({ at: new Date().toISOString(), start, end, results }, null, 2)); } catch { /* the log carries it */ }
  console.log(`\n${JSON.stringify(results)}`);
  const bad = results.filter((r) => /LIE|NEEDS REVIEW|NO ANSWER/.test(r.verdict));
  process.exit(bad.length ? 1 : 0);
}

// Importable for its CASES without running: the test reads the table.
if (process.argv[1] && /gap-sweep\.mjs$/.test(process.argv[1])) main();
