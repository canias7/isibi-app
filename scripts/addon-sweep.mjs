// The addon sweep: one real ask per KIND the ADD step can add (a component, a
// page, a table, a database function, an outside connection, a scheduled job,
// a code, a scene, a photograph), posted straight to the addon route on a live
// site, and after each the SITE is read to see whether the thing is there.
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

/**
 * WATCH A QUEUED JOB TO ITS STORED REPLY, the way the lane sweep does — and
 * the way the browser does: the poll route's `x-gf-edit: final` header is the
 * voice that says "this is the answer", a 404 is the end of the road, and a
 * terminal state with no stored reply (lost, cancelled) is read off the body.
 *
 * ONE COPY FOR BOTH POSTS (2026-09-03): the addon route files a job now — run
 * 21's synchronous POST was reset at 257.6s — so the addition itself is watched
 * exactly as the photo hop's edit always was. Fifteen minutes of five-second
 * looks, which outlasts the consumer's own ceiling; null means nothing terminal
 * arrived inside that, which the caller reports as NO ANSWER rather than as a
 * refusal.
 *
 * THE TOKEN IS A PARAMETER, NOT A CAPTURE (run 22, 2026-09-03). The first cut
 * sat here at module scope and read `TOKEN`, which is a local of `main` — so
 * the first poll threw `ReferenceError: TOKEN is not defined` five seconds
 * after printing "watching", the harness died, and the job it had stopped
 * watching went on to publish (12 credits, 5m36s, the testimonials on the
 * page). Nothing static catches a free identifier that happens to be defined
 * somewhere else in the file, which is why `get` and `nap` are injectable:
 * the loop's four answers are DRIVEN in test/addon-sweep.test.mjs, and the
 * guard there also reads that this function never names `TOKEN`.
 */
export async function watchJob(job, token, { get, nap, looks = 180 } = {}) {
  const read = get || ((p) => call("GET", p, { token }));
  const wait = nap || (() => sleep(5000));
  for (let i = 0; i < looks; i++) {
    await wait();
    const q = await read(`/api/site/edit/${job}`);
    if (!q) continue;
    if (q.status === 404) return q;
    if (((q.headers && q.headers["x-gf-edit"]) || "") === "final") return q;
    if (q.json && ["failed", "cancelled", "lost"].includes(q.json.status)) return q;
  }
  return null;
}
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

/**
 * A thing the site either has or gets — judged off the page, both ways.
 *
 * `mark` is the thing's trace in the served HTML (a QR's `qr.svg`, a scene's
 * `<canvas>`). A refusal is honest only when the mark was already on the page
 * and the build stayed put; a publish is honest only when the mark was NOT on
 * the page before, is on it after, and the build moved.
 */
export function eitherWay(b, a, r, mark, what) {
  // COUNTED, NOT MERELY FOUND (2026-09-03): a site carries several QR codes,
  // so "add a code" on a site that has one is a publish that leaves MORE marks
  // on the page, not a mark where there was none. `mark` is a global regex;
  // distinct matches are counted, so one file referenced twice is one code.
  const count = (html) => new Set([...String(html || "").matchAll(mark)].map((m) => m[0])).size;
  const before = count(b.html);
  const after = count(a.html);
  const moved = a.build !== b.build;
  if (r && r.ok === true) {
    return { ok: after > before && moved,
             note: `${what}: ${before} on the page before, ${after} after; build ${moved ? "moved" : "unmoved"}` };
  }
  return { ok: before > 0 && !moved,
           note: `${before ? what + " was on the page, so the refusal was right" : "NO " + what + " on the page, so the refusal was wrong"}; build ${moved ? "moved on a refusal" : "unmoved"}` };
}

/**
 * A backend tier — a function, a connection, a job — judged off the REPLY's
 * own evidence, because none of them leaves a mark on the page a mirror can
 * read: a function is a row in the site's database, a connection is read by
 * the page at runtime, a job runs on a timer. `field` is the reply's list
 * (`functions`, `apis`, `jobs`); it must name at least one thing, and no
 * function may have failed to create. What the page path CAN show is a moved
 * build with a page changed — a page calling the function, a page reading the
 * connection — so `pageChange` demands that; a job changes no page, and there
 * the build must NOT have moved. Said in the note rather than pretended.
 */
export function blindBackend(b, a, r, field, pageChange) {
  const got = r && r.ok === true && Array.isArray(r[field]) ? r[field] : [];
  const names = got.map((x) => (x && typeof x === "object" ? x.name : x)).filter(Boolean);
  const errs = r && Array.isArray(r.functionErrors) ? r.functionErrors : [];
  const moved = a.build !== b.build;
  const pages = [].concat(Array.isArray(r && r.changed) ? r.changed : [], Array.isArray(r && r.added) ? r.added : []).map(sitePathOf).filter(Boolean);
  const pageOk = pageChange ? (moved && pages.length > 0) : !moved;
  return { ok: names.length > 0 && errs.length === 0 && pageOk,
           note: `${field}: ${JSON.stringify(names)}${errs.length ? "; FAILED to create " + JSON.stringify(errs.map((e) => e && e.name)) : ""}` +
                 `; pages ${JSON.stringify(pages)}; build ${moved ? "moved" : "unmoved"}${pageChange ? "" : " (a job changes no page)"}` +
                 `; judged off the reply — the database leaves no mark on the page` };
}

// ── THE CASES ──────────────────────────────────────────────────────────────
//
// One per kind. `ask` is what a customer would type. `kinds` is what the
// picker must name (any of them). `check(before, after, reply, extra)`
// answers { ok, note } about the SITE. `mayRefuse` names the refusal that is
// the CORRECT answer on this site — a pass with a note, never a failure.
// `hop` names the edit layer the reply must escalate to. `pageless` marks a
// case whose right answer changes no page: the build must stay put and the
// runner does not wait for the edge.
export const CASES = [
  // A SECTION IS A COMPONENT (owner, 2026-09-02): the ask is a customer's
  // word for it; the step names a kit component or writes one.
  { name: "component", kinds: ["component"],
    ask: "Add a testimonials section to the home page with three short quotes from beginner students",
    check: (b, a, r) => {
      const changed = (Array.isArray(r.changed) ? r.changed : []).map(sitePathOf);
      const words = /testimonial|student|lesson/i.test(a.text) && a.text.length > b.text.length + 80;
      return { ok: changed.includes("/") && a.build !== b.build && words,
               note: `changed ${JSON.stringify(changed)}; home text ${b.text.length}→${a.text.length} chars${words ? "" : " (no new quotes on the page)"}` };
    } },
  { name: "page", kinds: ["page"],
    ask: "Add a pricing page listing lesson prices: a single 30-minute lesson, an hour, and a block of five",
    // Judged by the runner's extra: every new route read live, the sitemap,
    // and a link to each from the home page. EVERY route, not exactly one —
    // no low limits (owner), so an ask may add several pages and each must
    // be there.
    check: (b, a, r, x) => {
      const fresh = Array.isArray(x.newRoutes) ? x.newRoutes : [];
      const statuses = x.newStatuses || {};
      const served = fresh.length > 0 && fresh.every((p) => statuses[p] === 200);
      const listed = fresh.length > 0 && fresh.every((p) => a.routes.includes(p));
      const linked = fresh.length > 0 && fresh.every((p) => a.hrefs.some((h) => h === p || h.startsWith(p + "?") || h.endsWith(p)));
      return { ok: !!(served && listed && linked && a.build !== b.build),
               note: `added ${JSON.stringify(fresh)}; answers ${JSON.stringify(statuses)}; ${listed ? "all in" : "NOT all in"} the sitemap; ${linked ? "all linked" : "NOT all linked"} from the home page` };
    } },
  // ── EITHER ANSWER CAN BE HONEST, AND THE SITE SAYS WHICH (run 24) ──────
  //
  // These three were written for the site as it stood on 2026-09-02 — no
  // database, a code and a scene already on the page — and each check
  // accepted ONLY the refusal: "the build moved on a refusal" was its one
  // sentence. Run 16's rebuild gave the site a database and redrew the
  // scene away, so on run 24 "add a 3D model" was the right thing to ADD,
  // the step added it (a canvas, "drag to turn", 12 credits), and the check
  // called the publish a LIE. The eighth harness false alarm, the product
  // right again. So each judges BOTH outcomes off the site: a refusal is
  // honest only when the thing was really there and the build stayed put; a
  // publish is honest only when it was not there, is now, and the build
  // moved. `mayRefuse` still names the refusal the route really emits.
  // A TABLE IS NEVER REFUSED FOR WANT OF A DATABASE NOW (owner, 2026-09-03):
  // the first backend tier on a site without one makes it. So this case has
  // one honest outcome, a publish that made a table — and on a site with no
  // database it also carries `provisioned: true`, which the note prints.
  // THE ASK NAMES A THING NO TABLE THE SITE HAS CAN HOLD (run 30, 2026-09-03,
  // 16 credits). It used to ask for "a booking form so students can book a
  // trial lesson", on a site whose rebuild in run 16 had ALREADY given it a
  // `bookings` table and a form on it — so the designer, following its own
  // rule that "a second table for a thing one of them already holds is a
  // site that disagrees with itself", added a trial-lesson form as a
  // COMPONENT writing `{name, email, appointment_date, notes}` into the
  // table the site had, and made no table. The right answer. This check
  // demanded `tables.length > 0`, called it a LIE and stopped the run before
  // the three cases behind it. The tenth harness false alarm on a product
  // that was right; the case proves a TABLE only when the ask needs one.
  // A THIRD SUBJECT (run 33, 2026-09-03): the waiting-list ask reached the
  // schema apply and then the publish timed out, so fretwork-1's database may
  // carry a waiting-list table no page shows. Asked again, the designer would
  // rightly reuse it and make no table — the run-30 shape once more. This
  // names a thing nothing on the site holds; the leftover is noted, not used.
  { name: "table", kinds: ["table", "page", "component"],
    ask: "Add a second-hand gear board: a student lists a guitar for sale with the make, the price and their email, and I read the list",
    check: (b, a, r) => {
      const moved = a.build !== b.build;
      const tables = r && r.ok === true && Array.isArray(r.tables) ? r.tables : [];
      return { ok: moved && tables.length > 0,
               note: `made ${JSON.stringify(tables)}${r && r.provisioned ? " — and the site got its database for it" : ""}${!tables.length && moved ? " (a publish that made no table: either the designer reused one the site has, which is right only if the ask fits it, or the table was dropped on the way)" : ""}; build ${moved ? "moved" : "unmoved"}` };
    } },
  // ── THE OTHER THREE TIERS OF THE BACKEND (owner, 2026-09-03) ──────────
  //
  // Each judged by `blindBackend`. The function is one a page calls, so a
  // page must have changed; the connection needs no key (Frankfurter is an
  // open rates API), so the page can read it the moment it is published; the
  // job's builder is designed beside it — the picker names `function` too —
  // and the route answers without a compile, so the build must stay put. The
  // registered job fires on the runner's tick against the owner's own (unset)
  // mail key, so it sends nothing until a key is pasted in.
  { name: "function", kinds: ["function", "component", "page"],
    ask: "Add a lookup so a student can check whether a day still has space: a function that counts the bookings on a given preferred day, shown on the home page",
    check: (b, a, r) => blindBackend(b, a, r, "functions", true) },
  { name: "api", kinds: ["api", "component", "page"],
    ask: "Show today's GBP to EUR exchange rate on the prices page, read live from https://api.frankfurter.app/latest?from=GBP&to=EUR (no key needed)",
    check: (b, a, r) => blindBackend(b, a, r, "apis", true) },
  { name: "job", kinds: ["job", "function"], pageless: true,
    ask: "Every day, email each student a reminder the day before their lesson",
    check: (b, a, r) => blindBackend(b, a, r, "jobs", false) },
  // A SECOND CODE IS AN ADDITION (2026-09-03): the site's first code rings the
  // number, this one opens a page, and each has its own file — `qr.svg`, then
  // `qr-<name>.svg` — so the count of distinct code files on the page is what
  // a publish must raise. A refusal (`add` with a reason, or the old
  // `already`) is honest only while the build stays put.
  // THE PAGE IS NAMED BY ITS ROUTE'S OWN WORD (owner, 2026-09-03: "lets try
  // that"). Runs 26–28 asked for "the booking page" and the designer answered
  // nothing three times — the site's booking page is its home page, and its
  // routes never say the word. The list is what this case proves; the
  // customer's looser phrasing is a designer question and is tested apart.
  { name: "qr", kinds: ["qr"],
    ask: "Add a QR code that opens the prices page",
    mayRefuse: ["already", "add"],
    check: (b, a, r) => eitherWay(b, a, r, /\/qr(?:-[a-z0-9]+)?\.svg/g, "QR codes") },
  { name: "three", kinds: ["three"],
    ask: "Add a 3D model of a guitar you can spin round with the mouse",
    mayRefuse: ["already"],
    check: (b, a, r) => eitherWay(b, a, r, /<canvas\b/g, "a scene") },
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
    // THE RETRY KEY RIDES EVERY POST — the addon route refuses a queued
    // addition without one (`bad-idem`), and a synchronous one ignores it.
    // `tz` IS WHAT THE BROWSER SENDS (2026-09-03): a job's clock time is read
    // in the owner's zone, and fretwork-1 is in Sheffield.
    let p = await call("POST", `/api/site/${encodeURIComponent(SLUG)}/addon`, { token: TOKEN, body: { instruction: c.ask, picker: PICKER, idem: hex32(), tz: "Europe/London" } });
    console.log(`   answered ${p.status} in ${(p.ms / 1000).toFixed(1)}s`);
    // ── QUEUED: THE RECEIPT, THEN THE STORED REPLY (2026-09-03) ───────────
    //
    // A 202 naming a job is the route saying the work has left the
    // connection. What the case is judged on is the reply the consumer
    // stores, read back through the poll route, and it is the same object
    // the synchronous route would have answered with — so everything below
    // this reads `p` exactly as before.
    if (p.status === 202 && p.json && p.json.job) {
      console.log(`   queued ${p.json.job}; watching`);
      const fin = await watchJob(p.json.job, TOKEN);
      p = fin ? { ...fin, ms: Date.now() - t0 } : { status: 0, ms: Date.now() - t0, json: null, text: "", headers: {}, why: "no answer inside the watch" };
      console.log(`   the job answered ${p.status} in ${(p.ms / 1000).toFixed(1)}s`);
    }
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
        reply = await watchJob(e.json.job, TOKEN);
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
    // A PAGELESS CASE IS NOT WAITED FOR: its right answer moves nothing, and
    // ninety seconds of looking for a build that will not come is the
    // instrument, not the product.
    if ((body.ok === true && !c.pageless) || extra.hopOk) {
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
    //
    // AND THE SITEMAP IS ITS OWN OBJECT AT THE EDGE (run 23, 2026-09-03). The
    // document's build id had moved, and `/sitemap.xml`, cached separately,
    // still answered the old list: read two seconds after the publish it
    // lacked `/prices`, read a minute later it had it. The page case called a
    // real page a LIE on that — the seventh edge false alarm, and the product
    // was right again. So the snapshot is re-taken, bounded, until the
    // sitemap lists every new route, the rule the build id already gets, one
    // object over; only then are the routes read and the verdict given.
    if (body.ok === true) {
      extra.newRoutes = (Array.isArray(body.added) ? body.added : []).map(sitePathOf).filter(Boolean);
      const t2 = Date.now();
      while (extra.newRoutes.some((p) => !after.routes.includes(p)) && Date.now() - t2 < 90000) {
        await sleep(5000);
        after = await snapshot();
      }
      extra.newStatuses = {};
      for (const p of extra.newRoutes) extra.newStatuses[p] = (await site(p)).status;
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
    // A DECLINE IS READ, NOT GUESSED (run 28, 2026-09-03): the route keeps
    // every designer's raw reply on the site's own store, and three declines
    // in a row were diagnosed from a boolean because nobody could see it.
    if (verdict === "failed" && String(body.error) === "declined") {
      const kept = await call("GET", `/api/site/answer?slug=${encodeURIComponent(SLUG)}&kind=addon`, { token: TOKEN });
      const replies = kept.json && kept.json.answer && Array.isArray(kept.json.answer.replies) ? kept.json.answer.replies : [];
      for (const r of replies) {
        const said = (Array.isArray(r.content) ? r.content : []).map((b) => b && b.type === "text" ? String(b.text || "") : b && b.type === "tool_use" ? "tool_use " + JSON.stringify(b.input) : "").filter(Boolean).join(" | ");
        console.log(`   the ${r.kind} designer ${r.answered ? "answered" : "answered NOTHING"} (${r.stop_reason || "?"}): ${said.slice(0, 600) || "(empty reply)"}`);
      }
      if (!replies.length) console.log(`   (no kept reply to read: ${kept.status} ${String((kept.json && kept.json.why) || "").slice(0, 120)})`);
    }
    // A VERDICT ALREADY GIVEN STANDS (run 33, 2026-09-03). This chain used
    // to run for every reply, so a `failed` from the chain above — a 422
    // with the route's own error and detail — was overwritten by the branch
    // below with "reply says ok but the build did not move", said of a reply
    // that said ok: false. The compile timeout read as a lie for an hour.
    else if (verdict) { /* judged above; nothing to add */ }
    // A PAGELESS CASE IS JUDGED THE OTHER WAY ROUND (2026-09-03): a job
    // changes no page, so an ok reply with the build UNMOVED is the honest
    // outcome and a moved build is the lie.
    else if (c.pageless) {
      const chk = c.check(before, after, body, extra);
      verdict = chk.ok ? "ok" : "LIE"; note = chk.note + (after.build !== before.build ? " — the build MOVED on a change that touches no page" : "");
    }
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
      for (const [i, p] of (extra.newRoutes || []).entries()) { const b = await shot(SITE + p, path.join(SHOTS, `addon-${tag}-page${extra.newRoutes.length > 1 ? "-" + (i + 1) : ""}.png`)); if (b) shots.push(b); }
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
