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
import { SERIOUS } from "../builder/site-render.mjs";
// THE CAP IS THE ROUTE'S OWN, never a second number beside it: the addon route
// slices the customer's message at `MAX_MESSAGE`, so a harness that took more
// would send words the step silently drops and then judge the answer on them.
import { MAX_MESSAGE } from "../builder/site-add.mjs";
// THE PRODUCT'S OWN READERS, never a second copy. `photoUrls` is what the route
// itself counts as "a photograph this site owns", so a before/after inventory
// taken with it cannot disagree with the wall that refuses a change for losing
// one; `qrEncodes`/`qrFile` are the emitter's own inverse and its own naming.
import { photoUrls } from "../builder/site-images.mjs";
import { qrEncodes, qrFile } from "../builder/site-qr.mjs";

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
// THE CUSTOMER'S OWN WORDING (owner, 2026-09-13: "Add free-text input to the
// harness so it can test the actual customer wording"). Not lowercased and not
// trimmed of its punctuation the way a case NAME is — this is a sentence a
// person typed, and the step's whole job is to read it as written.
const ASK = String(process.env.SWEEP_ASK || "").trim().slice(0, MAX_MESSAGE);
// ── FIRING A SCHEDULED JOB, AND WHY IT IS ITS OWN SWITCH ──────────────────────
//
// A job is the one kind whose work does not happen during the addon request: the
// request REGISTERS it and a later cron tick RUNS it, so a run that only reads
// the reply proves the schedule was written down and nothing about whether it
// works. `POST {name, run: true}` is the product's own "Run now" — the SAME deps
// the cron uses, so what this presses is what the schedule would send.
//
// EMPTY MEANS DO NOT PRESS, and that default is the point rather than caution:
// the press really runs the site's job, and on a site whose owner HAS pasted a
// provider key it really sends. `auto` fires only a job THIS run registered,
// which is the one case where nothing pre-existing can be set off by accident.
const RUN_JOB = String(process.env.SWEEP_RUN_JOB || "").trim().toLowerCase();

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
// Exported so a guard's snapshot reads `text` off `html` the way the harness
// does, instead of typing a second copy of what the page says.
export const strip = (html) => String(html || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

/**
 * THE SITE'S OWN RENDER VERDICT, read off the reply (run 34, 2026-09-04).
 *
 * The gear addon published, the table was made, the build moved — and the
 * reply's `render.findings` said five real routes THREW (the new page and the
 * home page's language variants: a form primitive used outside its form) and
 * `renderNote` said so in a sentence. This harness read neither and would have
 * called the case ok with the home page showing an error card to every
 * visitor. A serious finding — `threw` or `blank`, the two kinds the render
 * check itself calls serious — on a REAL route is what this answers; a
 * `-parts/` component answers 404 by construction (task #44) and is left out.
 * A reply with no render report answers nothing: cannot-tell is not broken.
 */
export function crashedRoutes(body) {
  const findings = body && body.render && Array.isArray(body.render.findings) ? body.render.findings : [];
  // DERIVED FROM `SERIOUS`, NOT A SECOND COPY OF IT (task #87). This listed
  // "threw" and "blank" by hand, which was the same set said twice — and the
  // moment `slow` arrived beside them the two copies would have disagreed about
  // whether a container that was merely busy ends a run. The check owns the
  // severity rule; this asks it.
  return findings.filter((f) => f && SERIOUS.has(f.kind) && !/^\/-parts\//.test(String(f.route || "")));
}

/** A case that ends the run: a lie, a lost answer, or a site that says one of its own pages is down. */
export function stopsRun(verdict) {
  return verdict === "LIE" || verdict === "NO ANSWER" || verdict === "BROKEN";
}

/**
 * A verdict that says the addition SHIPPED — the two things a shipped verdict
 * earns: the site's own render findings applied to it, and a screenshot.
 *
 * IT IS A FUNCTION BECAUSE THERE ARE TWO SUCH WORDS NOW. Both were written as
 * `verdict.startsWith("ok")` inline, which is exactly right for the case table
 * (whose passes all begin "ok") and silently wrong for the free-text ask, whose
 * pass is "reported": a stranger's sentence could publish a page the site's own
 * render check calls broken, and the run would have printed a clean word and no
 * picture. Two copies of a rule drift; this is one.
 */
export function shipped(verdict) {
  const v = String(verdict || "");
  return v.startsWith("ok") || v === "reported";
}

/**
 * The verdict word for a free-text ask, from the SHAPE of what came back.
 *
 * A FUNCTION BECAUSE A REFUSAL IS THE PRODUCT WORKING. Written inline, the one
 * decision that separates "the step refused and said why" from "the step lied"
 * had no observable half: both words are unshipped, so the screenshot and the
 * render downgrade behave identically and only the RUN'S EXIT CODE differs —
 * which no unit test reached. Calling a named refusal a LIE fails a run that
 * found nothing wrong, and this repository rates a false alarm worse than a
 * miss.
 */
export function askVerdict({ status, escalated, claimedOk, checkOk }) {
  if (Number(status) >= 500) return "failed (server)";
  if (escalated) return "escalated";
  if (!claimedOk) return "refused";
  return checkOk ? "reported" : "LIE";
}

/**
 * What a free-text run says before it spends anything: which of its two inputs
 * lost, and whether the sentence was cut.
 *
 * RUN 16'S LESSON IS THE WHOLE REASON IT EXISTS — a filter on a person's input
 * is a silent drop and a check is a sentence — so the sentence itself must be
 * something a guard can read. Inline it was a bare `console.log` nothing could
 * drive, and `if (false)` around it left every landmark exactly where a source
 * read looks for them.
 */
export function ignoredNote(ask, want, rawAsk) {
  const out = [];
  const said = String(ask || "").trim();
  if (!said) return out;
  const list = String(want || "").trim();
  if (list && list !== "all") out.push(`(an ask was given, so the case list "${list}" is not used)`);
  if (String(rawAsk === undefined ? ask : rawAsk || "").trim().length > MAX_MESSAGE) {
    out.push(`(the ask was cut to ${MAX_MESSAGE} characters, which is what the route itself keeps)`);
  }
  return out;
}

/**
 * The developer's half of a free-text run: which kinds the picker chose, and
 * every line of the coverage record behind it.
 *
 * THIS IS WHAT THE RUN WAS BOUGHT FOR, and as inline `console.log`s it was the
 * one part of the harness nothing could observe — three sweep mutants silenced
 * three different lines and every guard stayed green. Lines out, printing at the
 * call site: the absence of a record is a SENTENCE and never a blank, because
 * "nothing was recorded" and "nothing was outstanding" are the two readings a
 * blank collapses.
 */
/**
 * ── WHAT THE SITE HAS SCHEDULED, AS ROWS ──────────────────────────────────────
 *
 * `GET /api/site/<slug>/jobs` is the only reader of what was really PERSISTED —
 * the reply's `jobs` array is what the designer answered, and the two can
 * disagree in exactly the way that matters (a job the reply names and the
 * registration dropped). Keyed by NAME, because that is the identity
 * `site_functions` stores and the identity "Run now" presses by.
 *
 * A READ THAT FAILED IS NOT A SITE WITH NO JOBS. `null` for unreadable against
 * `{}` for none — the route itself makes that distinction (it answers 503 rather
 * than an empty list on a bad read) and collapsing it here would report a broken
 * reader as a working site that scheduled nothing, which is this repository's
 * most-repeated wrong answer.
 */
export function jobRows(answer) {
  if (!answer || typeof answer !== "object" || !Array.isArray(answer.jobs)) return null;
  const out = {};
  for (const j of answer.jobs) {
    if (!j || typeof j !== "object" || !j.name) continue;
    out[String(j.name)] = {
      // THE REFERENCE, not the job's own name. An identical count is not proof
      // of which function was called, and on run 50 the two shared a name.
      fn: typeof j.fn === "string" ? j.fn : "",
      everyMinutes: Number(j.everyMinutes) || 0,
      at: typeof j.at === "string" ? j.at : null,
      tz: typeof j.tz === "string" ? j.tz : null,
      enabled: j.enabled !== false,
      lastRun: j.lastRun || null,
      lastResult: typeof j.lastResult === "string" ? j.lastResult : null,
    };
  }
  return out;
}

/**
 * THE JOBS THIS RUN REALLY ADDED — the names present after and absent before.
 *
 * DERIVED FROM THE TWO READS, never from the reply. A job the reply names and
 * the registry does not have is the defect this exists to see, so taking the
 * reply's word for which names are new would hide it in the one direction that
 * matters. Either read being unreadable answers `[]`: "I could not tell" must
 * never arrive as "it added nothing".
 */
export function newJobs(before, after) {
  if (!before || !after) return [];
  return Object.keys(after).filter((n) => !Object.hasOwn(before, n)).sort();
}

/**
 * WHICH JOB THE PRESS SHOULD FIRE, given the switch and what this run added.
 *
 * `auto` is deliberately NOT "the first job on the site" — it is the one job
 * this run registered, and it REFUSES when the run added none or added several.
 * A press that silently picked one of two would run a job nobody chose, on a
 * site whose owner may have pasted a real provider key; and firing a job that
 * was already there tests the registry rather than the change.
 * A NAME is taken as typed and checked against what the site really has, so a
 * typo is a refusal rather than a quiet no-op.
 */
export function jobToRun(want, added, have) {
  const w = String(want || "").trim().toLowerCase();
  if (!w) return { run: false, why: "not asked for" };
  if (!have) return { run: false, why: "the jobs list could not be read" };
  if (w === "auto") {
    if (added.length === 1) return { run: true, name: added[0] };
    return { run: false, why: added.length ? `this run added ${added.length} jobs (${added.join(", ")}) — name one` : "this run added no job" };
  }
  const hit = Object.keys(have).find((n) => n.toLowerCase() === w);
  return hit ? { run: true, name: hit } : { run: false, why: `the site has no scheduled job called ${JSON.stringify(w)}` };
}

/**
 * THE JOB LINES OF THE REPORT.
 *
 * SAID EVEN WHEN EMPTY, the rule the coverage lines already follow: "the site
 * scheduled nothing" and "nobody looked" are different readings and a missing
 * line collapses them.
 *
 * FOUR ARGUMENTS BECAUSE THE PRESS HAS TWO SIDES, AND THEY MUST NOT BE FOLDED.
 * `after` is the read taken BEFORE the press — what the change persisted, which
 * is the schedule and the zone. `verify` is the read taken AFTER it — what the
 * run recorded, which is `lastRun` and `lastResult`. The first draft used ONE
 * map and fell back to the pre-press value when the re-read failed, so an
 * unreadable verification printed `lastRun never` and read as a press that did
 * nothing at all: cannot-tell arriving as a value, in the function written to
 * stop exactly that. A failed re-read says so now, and prints no stamp.
 */
export function jobLines(before, after, ran, verify) {
  const out = [];
  if (!after) { out.push(`   scheduled jobs: COULD NOT BE READ`); return out; }
  const added = newJobs(before, after);
  const names = Object.keys(after).sort();
  out.push(`   scheduled jobs on the site: ${names.length ? JSON.stringify(names) : "none"}${before ? ` (this run added ${added.length ? JSON.stringify(added) : "none"})` : " (nothing to compare against)"}`);
  for (const n of names) {
    const j = after[n];
    // THE ZONE IS PRINTED BESIDE THE CLOCK TIME AND NEVER INSTEAD OF IT. "09:00"
    // is not a time until something says whose nine o'clock, and the zone is the
    // BROWSER's — the one field on this row that no model chose.
    const when = j.at ? `at ${j.at} ${j.tz || "(NO ZONE)"} every ${j.everyMinutes}m` : `every ${j.everyMinutes}m`;
    // THE FUNCTION IS NAMED EVEN WHEN IT MATCHES THE JOB'S OWN NAME — that is
    // the case the omission hid on run 50 — and an absent one is said out loud,
    // because a job with no reference is a job that can never run.
    out.push(`     · ${n}: runs ${j.fn ? j.fn + "()" : "(NO FUNCTION)"} ${when}${j.enabled ? "" : "  DISABLED"}  lastRun ${j.lastRun || "never"}  lastResult ${j.lastResult === null ? "(none)" : JSON.stringify(j.lastResult)}`);
  }
  if (!ran) return out;
  if (!ran.run) { out.push(`   did not run any job now: ${ran.why}`); return out; }
  out.push(`   ran ${ran.name} now: ${ran.status} sent ${ran.sent} — ${JSON.stringify(ran.result || "")}`);
  // THE ROUTE'S ANSWER AND THE PERSISTED OUTCOME ARE TWO CLAIMS. The answer is
  // what `runJob` returned; `last_result` is what `recordJobOutcome` wrote, and
  // the write can fail on its own. Reporting the first as though it settled the
  // second is how "it ran" comes to mean "the panel will show it".
  if (!verify) { out.push(`     the persisted outcome COULD NOT BE VERIFIED — the re-read after the press failed`); return out; }
  const row = verify[ran.name];
  if (!row) { out.push(`     the persisted outcome COULD NOT BE VERIFIED — ${JSON.stringify(ran.name)} is not in the re-read`); return out; }
  out.push(`     persisted: lastRun ${row.lastRun || "STILL never"}  lastResult ${row.lastResult === null ? "(none)" : JSON.stringify(row.lastResult)}`);
  // AND THE TWO ARE COMPARED, not merely printed near each other. "the route
  // said X and the row says X" is the check; two lines a reader has to hold in
  // their head is how a disagreement gets skimmed past. A row with no result
  // yet is neither agreement nor disagreement and says so — the write can lag
  // or fail on its own, which is the whole reason these are two claims.
  const said = String(ran.result == null ? "" : ran.result);
  if (row.lastResult === null) out.push(`     the route's answer and the persisted result CANNOT BE COMPARED — nothing is recorded on the row yet`);
  else if (row.lastResult === said) out.push(`     the route's answer and the persisted result AGREE`);
  else out.push(`     the route's answer and the persisted result DISAGREE — route ${JSON.stringify(said)} vs row ${JSON.stringify(row.lastResult)}`);
  return out;
}

export function askLines(record, kinds) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const out = [`   the picker chose: ${JSON.stringify(arr(kinds))}`];
  const cv = record && typeof record.coverage === "object" && record.coverage ? record.coverage : null;
  if (!cv) { out.push(`   (no coverage record on the stored answer)`); return out; }
  out.push(`   coverage record: ${JSON.stringify(cv.counts || {})}`);
  for (const q of arr(cv.requirements)) {
    out.push(`     · ${q.status}: ${JSON.stringify(q.need)}${q.by ? " — " + q.by : ""}${q.why ? " — " + q.why : ""}${q.step ? " → " + q.step : ""}`);
  }
  for (const u of arr(cv.unreadable)) out.push(`     · UNREADABLE (${u.why}): ${JSON.stringify(u.need)}`);
  if (arr(cv.invalidProps).length) out.push(`     · properties the tool does not offer: ${JSON.stringify(cv.invalidProps)}`);
  if (cv.handedTo && Object.keys(cv.handedTo).length) out.push(`     · handed to: ${JSON.stringify(cv.handedTo)}`);

  // ── WHAT EACH DESIGNER WAS SHOWN (2026-09-16) ──────────────────────────────
  //
  // `shownSteps` is the route's per-kind input capture, written ABOVE each call
  // from the object really handed to it. It is the ONLY thing in the record
  // that can answer "did the function step see `bookings.drop_off_day`?" as a
  // stored fact rather than an inference — run 48's whole first demonstration
  // rested on inference because this did not exist, and run 47's defect IS
  // `hasDatabase: false` on a site that has one.
  //
  // IT WAS WRITTEN AND NOT READ. The route has recorded it since it shipped and
  // nothing printed it, so a run bought to prove schema receipt would have come
  // back without the receipt — this repository's own wiring defect, in the
  // instrument built to settle it. Two lines per step: a HEADLINE carrying the
  // two facts a person reads (`hasDatabase`, and which tables), and the entry
  // WHOLE as JSON underneath, so nothing is lost to formatting.
  //
  // AN EMPTY LIST IS A SENTENCE. "No step was recorded" and "no step saw
  // anything" are two readings a blank collapses into one — the same rule the
  // missing-record line above follows.
  const shown = arr(cv.shownSteps).filter((s) => s && typeof s === "object");
  out.push(`   what each designer was SHOWN about the database (per step, in run order):`);
  if (!shown.length) {
    out.push(`     (none recorded — an answer stored before the capture shipped, or no designer ran)`);
    return out;
  }
  for (const s of shown) {
    const tables = arr(s.tables);
    out.push(`     · ${s.kind || "?"} — database: ${s.hasDatabase ? "YES" : "NO"} — ${tables.length} table(s): ${JSON.stringify(tables)}`);
    out.push(`       ${JSON.stringify(s)}`);
  }
  return out;
}

/**
 * WHAT THE CHANGE DID ABOUT PHOTOGRAPHS — read on EVERY outcome, refusals
 * included.
 *
 * THE HARNESS WAS PHOTOGRAPH-BLIND UNTIL THIS, and it was measured rather than
 * suspected: `pictures`, `pictureNote`, `photos` and `lostPhotos` occurred ZERO
 * times in this file. So a run bought to prove a photograph was bought,
 * preserved and placed would have come back with no reading of any of it —
 * this repository's own recorded wiring defect (`shownSteps` was recorded by
 * the route for a milestone and printed by nobody), in the instrument built to
 * settle the question.
 *
 * ABSENT IS NOT ZERO, AND THE DIFFERENCE IS THE READING. `photos` — the empty
 * frames left over — rides every SUCCESS whatever was asked for; `pictures`
 * rides only a change that really bought one. So `photos` present with
 * `pictures` absent is *it shipped and bought none*, and BOTH absent is *the
 * request never reached the purchase*: a refusal, or no answer at all. A bare
 * `0` for either collapses those two into one, which is cannot-tell arriving
 * as a value in the one field the run is bought to read.
 *
 * AND IT PROVES NOTHING ON ITS OWN. These are the route's own numbers about
 * its own work. That existing photographs were PRESERVED is `lostPhotos` empty
 * *and* the before/after inventory agreeing; that a new one was PLACED is the
 * published page's own `src` and a render. This reports; the checklist checks.
 */
export function photoLines(reply) {
  const r = (reply && typeof reply === "object") ? reply : {};
  const lost = Array.isArray(r.lostPhotos) ? r.lostPhotos : [];
  const said = (v) => (Number.isFinite(v) ? String(v) : "(not said)");
  const out = [];
  out.push(`photographs: bought ${said(r.pictures)}; empty frames left ${said(r.photos)}; existing ones LOST ${lost.length}${lost.length ? ` — ${JSON.stringify(lost.slice(0, 6))}` : ""}`);
  // THE SENTENCE IS THE ONE THING THAT CAN TELL FOUR IDENTICAL BLANK FRAMES
  // APART — bought, unaffordable, refused by the provider, none asked for —
  // so it is printed VERBATIM and never summarised into a word of our own.
  // Its absence is itself an answer and says which one.
  out.push(`   the picture sentence: ${typeof r.pictureNote === "string" && r.pictureNote ? JSON.stringify(r.pictureNote) : "(none — this change neither bought a photograph nor left a frame to explain)"}`);
  return out;
}

/**
 * THE COMPLETE CUSTOMER REPLY, as the SERVER composed it.
 *
 * `coverNote` alone was printed, which is one sentence of several: a refusal's
 * whole reply is `msg`, and a success can carry a picture sentence, a
 * kept-components sentence and a render sentence beside the coverage one. A run
 * that read one of them and reported it as "the customer was told" was quoting
 * a fragment as the whole.
 *
 * DISCOVERED FROM THE REPLY ITSELF (`msg`, then every `*Note` that really
 * carries a string), never from a list typed here. A second list of the
 * server's sentence fields is the recorded two-copies trap, and the copy that
 * drifts is always the reader's — a sentence added next month would simply
 * stop being printed, silently, which is exactly how this started.
 *
 * NOT A RE-COMPOSITION. The browser glues these together with clauses of its
 * own (`photoNote`, the skipped-photo line, the reverted-pages line); writing
 * that concatenation out here would be a second copy of `addonReplyText`, which
 * is the thing its own guard forbids. Each sentence labelled and whole is
 * strictly more than the glued string and loses nothing.
 */
export function customerLines(reply) {
  const r = (reply && typeof reply === "object") ? reply : {};
  const str = (v) => (typeof v === "string" && v.trim() ? v : "");
  const out = [];
  // `msg` FIRST, because on a refusal it IS the whole reply — and a refusal is
  // exactly the outcome whose sentence used to be dropped on the floor here.
  const parts = [["msg", str(r.msg)], ...Object.keys(r).filter((k) => /Note$/.test(k)).sort().map((k) => [k, str(r[k])])];
  const carried = parts.filter(([, v]) => v);
  if (!carried.length) { out.push(`the customer was told: NOTHING — this reply carries no sentence at all`); return out; }
  out.push(`the customer was told, sentence by sentence (${carried.length}):`);
  for (const [k, v] of carried) out.push(`     · ${k}: ${JSON.stringify(v)}`);
  return out;
}

/**
 * WHAT THE SITE HAS, BEFORE AND AFTER — routes, QR codes and photographs,
 * read out of the STORED source rather than guessed at.
 *
 * ── WHY NOT THE SITEMAP AND A FEW FILENAMES ─────────────────────────────────
 *
 * Because neither is an inventory. A sitemap is a list the publish COMPOSES,
 * it is cached as its own object at the edge (run 23: a real new page was
 * missing from it for a minute and the harness called the page a lie), and it
 * says nothing at all about codes or pictures. Probing `/qr-gallery.svg`
 * answers about the name somebody guessed and about no other. `GET
 * /api/site/source?slug=` is the store itself: every page, every component, and
 * `assets` — which already carries each code's file name AND the drawing the
 * build bakes, because the explorer needs exactly that.
 *
 * ONE FREE AUTHENTICATED READ, and the same one both sides of the change, so a
 * difference is a difference in the site rather than in how it was asked.
 */
export function inventoryOf(source, slug) {
  const src = (source && typeof source === "object") ? source : {};
  const list = (v) => (Array.isArray(v) ? v : []);
  const pages = list(src.pages), parts = list(src.parts);
  // A CODE IS A FILE THE BUILD WRITES, discovered by the emitter's OWN naming
  // rule rather than by a `qr-` prefix typed here: `qrFile("wifi")` is the one
  // definition of what a code is called, and the legacy single code is
  // `qr.svg` with no name in it at all — which a prefix test written today
  // would quietly miss on exactly the oldest sites.
  const qrs = {};
  for (const a of list(src.assets)) {
    if (!a || typeof a.path !== "string") continue;
    const file = a.path.replace(/^public\//, "");
    if (!/^qr(?:-[a-z][a-z0-9]*)?\.svg$/.test(file)) continue;
    qrs[file] = typeof a.source === "string" ? a.source : "";
  }
  return {
    ok: !!src.ok,
    // `sitePathOf` IS THE HARNESS'S ONE READER of a stored file's address, the
    // same one the reply's own `added`/`changed` go through — so a route from
    // the inventory and a route from the reply are comparable strings.
    routes: [...new Set(pages.map((p) => sitePathOf(p && p.path)).filter(Boolean))].sort(),
    qrs,
    qrFiles: Object.keys(qrs).sort(),
    // THE PRODUCT'S OWN READER, over pages AND components — a photograph inside
    // a section is a photograph, and reading only the pages is the defect this
    // repository fixed one milestone ago. `photoUrls` takes ONE file's source
    // and answers a Set, exactly as `keptImages` folds it, so the inventory and
    // the wall that refuses a change for losing a picture count the same thing.
    photos: [...new Set([...pages, ...parts].flatMap((p) => [...photoUrls(p && p.source, slug)]))].sort(),
    pages: pages.length, parts: parts.length,
  };
}

/** What moved between two of those, each direction named rather than counted. */
export function inventoryDiff(before, after) {
  const gone = (a, b) => a.filter((x) => !b.includes(x));
  return {
    routesAdded: gone(after.routes, before.routes), routesLost: gone(before.routes, after.routes),
    qrsAdded: gone(after.qrFiles, before.qrFiles), qrsLost: gone(before.qrFiles, after.qrFiles),
    photosAdded: gone(after.photos, before.photos), photosLost: gone(before.photos, after.photos),
  };
}

/**
 * WHICH ADDRESS A CODE REALLY OPENS — asked of every candidate, never assumed.
 *
 * *"Decode the generated QR and assert that it opens the actual new gallery
 * URL. Discover its name from the result instead of assuming 'gallery'."*
 * (owner, 2026-09-18). The NAME comes from the inventory diff — the file that
 * appeared — and the DESTINATION is established by re-encoding each address the
 * site really has and comparing module for module, which is `qrEncodes`: the
 * guard's own comparison, lifted into the module that draws the path so the
 * live check and the guard cannot disagree about our own artwork.
 *
 * REPORTED AS WHAT IT OPENS, NOT AS PASS/FAIL, because a code for the WRONG
 * page and a code for no page at all are different findings and the caller is
 * the one that knows which address it wanted. A code we could not read at all
 * is its own answer again — that is a broken drawing, not a wrong address.
 */
/**
 * THE BEFORE/AFTER, as lines — said even when nothing moved.
 *
 * `before`/`after` are `inventoryOf` answers or `null` for a read that failed,
 * and the `null` is the reading: a run that could not take the inventory must
 * say so rather than report an empty diff, which is indistinguishable from a
 * change that added nothing. `opens` maps each code's file to `qrOpens`'
 * answer; `drew` is the browser's picture list (`null` = nobody looked).
 */
export function inventoryLines(before, after, { opens = {}, drew = null, want = "" } = {}) {
  const out = [];
  if (!before || !after) {
    out.push(`inventory: NOT TAKEN — ${!before && !after ? "neither read" : !before ? "the before read" : "the after read"} came back, so nothing can be compared`);
    return out;
  }
  const d = inventoryDiff(before, after);
  const say = (a) => (a.length ? JSON.stringify(a) : "none");
  out.push(`inventory (stored source, both sides): routes ${before.routes.length}→${after.routes.length}, codes ${before.qrFiles.length}→${after.qrFiles.length}, photographs ${before.photos.length}→${after.photos.length}`);
  out.push(`   routes  +${say(d.routesAdded)}  −${say(d.routesLost)}`);
  out.push(`   codes   +${say(d.qrsAdded)}  −${say(d.qrsLost)}`);
  out.push(`   photos  +${say(d.photosAdded)}  −${say(d.photosLost)}`);
  // ANY LOSS IS SAID LOUDLY AND SEPARATELY. An addition may only add: a route,
  // a code or a photograph that was there before and is not there now is the
  // finding this whole inventory exists to catch, and it must not be something
  // a reader has to spot by comparing two lists of paths.
  const lost = [...d.routesLost.map((x) => "route " + x), ...d.qrsLost.map((x) => "code " + x), ...d.photosLost.map((x) => "photograph " + x)];
  if (lost.length) out.push(`   ⚠ THIS CHANGE LOST ${lost.length}: ${JSON.stringify(lost.slice(0, 8))}`);
  for (const file of d.qrsAdded) {
    const o = opens[file];
    if (!o) { out.push(`   code ${file}: NOT READ — the drawing never reached the check`); continue; }
    const hit = o.ok && want && o.url === want;
    out.push(`   code ${file} opens ${o.ok ? o.url : "NOTHING WE CAN NAME — " + o.why}${want ? (hit ? "  ✓ the address that was asked for" : "  ✗ the address asked for was " + want) : ""}`);
  }
  if (drew === null) out.push(`   pictures on the new page: NOBODY LOOKED — no browser on this runner`);
  else {
    const broken = drew.filter((i) => !(i.w > 0 && i.h > 0));
    out.push(`   pictures on the new page: ${drew.length} drawn, ${broken.length} of them rendering NOTHING`);
    for (const i of drew.slice(0, 8)) out.push(`     · ${i.w}×${i.h} ${i.w > 0 ? "" : "(BLANK) "}${JSON.stringify(String(i.src).slice(-70))} alt=${JSON.stringify(String(i.alt).slice(0, 60))}`);
  }
  return out;
}

export function qrOpens(svg, candidates) {
  const list = (Array.isArray(candidates) ? candidates : []).filter((u) => typeof u === "string" && u);
  if (!list.length) return { ok: false, url: null, why: "no candidate address was offered — nothing was compared" };
  let read = null;
  for (const url of list) {
    const r = qrEncodes(svg, url);
    if (r.ok) return { ok: true, url, why: null };
    // KEEP THE FIRST READING ERROR, which is about the DRAWING and is the same
    // whichever address is tried; a mismatch is about the address and is not.
    if (!read && /could not be read|not one we would ever draw/.test(r.why || "")) read = r.why;
  }
  return { ok: false, url: null, why: read || `the code opens none of the ${list.length} address(es) this site has` };
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
/**
 * The sentences a page said before that it no longer says (owner, 2026-09-04:
 * an addition adds; what was there stays). Read off the visible text, so a
 * sentence of at least 25 characters that was on the page must still be on
 * it — reworded, shortened or dropped is lost. Run 35 is why: the harness
 * read the shrink and could not say what had gone.
 */
export function lostSentences(before, after) {
  const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  const hay = norm(after);
  return norm(before).split(/(?<=[.!?…”"])\s+/).map((s) => s.trim()).filter((s) => s.length >= 25).filter((s) => !hay.includes(s));
}

// ── BUILT THE WAY THE FIRST ONE IS (owner, 2026-09-04: "new components
// should copy existing design") ─────────────────────────────────────────────
//
// Run 36 added the second testimonials band as stacked full-width cards under
// a first band of three across: the words landed, every sentence stayed, and
// the page carried two designs of one thing. The words check and the loss
// check cannot see that; this reads the STRUCTURE of the served page — tags,
// the kit's `data-slot` names and the layout classes, never a word — and asks
// whether the new section is built the way the section it copies is built.

/** Every top-level `<section>` in a served document, each as its own HTML; a
 *  section nested in another stays inside its parent. */
export function sectionsOf(html) {
  const s = String(html == null ? "" : html);
  const out = [];
  const open = /<section\b[^>]*>/g;
  let m;
  while ((m = open.exec(s))) {
    const tag = /<\/?section\b[^>]*>/g;
    tag.lastIndex = open.lastIndex;
    let depth = 1, end = s.length, t;
    while (depth > 0 && (t = tag.exec(s))) { depth += t[0].startsWith("</") ? -1 : 1; end = tag.lastIndex; }
    out.push(s.slice(m.index, end));
    open.lastIndex = end;
  }
  return out;
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/** The classes that decide a layout — a grid and its columns, a flex row or
 *  column, the spacing between siblings, the width — and nothing about colour,
 *  type or radius, which the design system already holds constant. */
const LAYOUT_CLASS = /^(?:grid|flex|inline-flex|flex-col|flex-row|flex-wrap|columns-\d+|grid-cols-\d+|(?:sm|md|lg|xl|2xl):(?:grid-cols-\d+|flex-row|flex-col|columns-\d+)|space-[xy]-\d+|gap-(?:[xy]-)?\d+|w-full|max-w-[\w./-]+|justify-\w+|items-\w+)$/;

/**
 * The structure of a piece of HTML as one string: each element's tag, its
 * `data-slot` and its layout classes, nested as they nest, with a run of
 * identical siblings collapsed to one — so a band of three cards and a band
 * of four read the same, and a grid of cards and a stack of cards do not. An
 * `<svg>` is a leaf (an icon's paths are not a layout), and words are not
 * read at all.
 */
export function skeletonOf(html) {
  const s = String(html == null ? "" : html);
  const root = { name: "#", slot: "", layout: "", kids: [] };
  const stack = [root];
  const tag = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m, svg = 0;
  while ((m = tag.exec(s))) {
    const close = m[1], name = m[2].toLowerCase(), attrs = m[3], self = m[4];
    if (svg) {
      if (name === "svg") svg += close ? -1 : 1;
      continue;
    }
    if (close) {
      for (let i = stack.length - 1; i > 0; i--) { if (stack[i].name === name) { stack.length = i; break; } }
      continue;
    }
    const slot = (/\bdata-slot="([^"]*)"/.exec(attrs) || [])[1] || "";
    const cls = (/\bclass="([^"]*)"/.exec(attrs) || [])[1] || "";
    const layout = cls.split(/\s+/).filter((c) => LAYOUT_CLASS.test(c)).sort().join(" ");
    const node = { name, slot, layout, kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (name === "svg") { svg = 1; continue; }
    if (!self && !VOID_TAGS.has(name)) stack.push(node);
  }
  const canon = (n) => {
    const kids = [];
    for (const k of n.kids) { const c = canon(k); if (kids[kids.length - 1] !== c) kids.push(c); }
    return n.name + (n.slot ? "[" + n.slot + "]" : "") + (n.layout ? "{" + n.layout + "}" : "") + (kids.length ? "(" + kids.join(",") + ")" : "");
  };
  return root.kids.map(canon).join(",");
}

/** Two pieces of HTML built the same way — same tags, slots and layout, however many items and whatever words. */
export function sameSkeleton(a, b) {
  return !!a && !!b && skeletonOf(a) === skeletonOf(b);
}

/** The sections `after` has that `before` did not, by what they say. */
export function newSections(beforeHtml, afterHtml) {
  const key = (s) => strip(s);
  const had = new Set(sectionsOf(beforeHtml).map(key));
  return sectionsOf(afterHtml).filter((s) => !had.has(key(s)));
}

/**
 * Is what the page gained built the way the section it copies is built?
 * `like` finds that section on the page after (the FIRST of its kind: a
 * second one copies the one that was there first). No new section is a
 * failure by itself; a page with no such section yet has nothing to copy,
 * which is said rather than failed.
 */
export function builtLike(b, a, like) {
  const fresh = newSections(b && b.html, a && a.html);
  if (!fresh.length) return { ok: false, note: "no new section on the page" };
  const model = sectionsOf(a && a.html).find((s) => like.test(s));
  if (!model) return { ok: true, note: "first of its kind on the page, nothing to copy" };
  const bad = fresh.filter((s) => s !== model && !sameSkeleton(model, s));
  // The note quotes the band by its first words; a quote mark the page
  // opens with is not a word, so it comes off before the clip.
  const words = (s) => strip(s).replace(/^[“”"'\s]+/, "").slice(0, 60);
  return bad.length
    ? { ok: false, note: `BUILT DIFFERENTLY from the band it should copy — new “${words(bad[0])}…” is ${skeletonOf(bad[0]).slice(0, 140)} where the first is ${skeletonOf(model).slice(0, 140)}` }
    : { ok: true, note: "built the way the first one is" };
}

/** The first testimonials band on fretwork-1 — the kit's `TestimonialGrid`, three across — which a second one copies. */
export const TESTIMONIALS_LIKE = /data-slot="testimonial-grid"/;

export const CASES = [
  // A SECTION IS A COMPONENT (owner, 2026-09-02): the ask is a customer's
  // word for it; the step names a kit component or writes one.
  // A SECOND ONE (owner, 2026-09-04): fretwork-1 has carried this very
  // section since run 22, so the ask now proves the decision — a second
  // band with new quotes, and every sentence the page had still on it. Run
  // 35 kept the section and rewrote its three quotes shorter, and this check
  // read only the shrink.
  { name: "component", kinds: ["component"],
    ask: "Add a testimonials section to the home page with three short quotes from beginner students",
    check: (b, a, r) => {
      const changed = (Array.isArray(r.changed) ? r.changed : []).map(sitePathOf);
      const words = /testimonial|student|lesson/i.test(a.text) && a.text.length > b.text.length + 80;
      const lost = lostSentences(b.text, a.text);
      // AND BUILT THE WAY THE FIRST BAND IS (owner, 2026-09-04): run 36's
      // second band was stacked cards under a grid of three, and this check
      // called it ok.
      const built = builtLike(b, a, TESTIMONIALS_LIKE);
      return { ok: changed.includes("/") && a.build !== b.build && words && !lost.length && built.ok,
               note: `changed ${JSON.stringify(changed)}; home text ${b.text.length}→${a.text.length} chars${words ? "" : " (no new quotes on the page)"}` +
                     (lost.length ? `; LOST what the page said: ${lost.slice(0, 2).map((s) => JSON.stringify(s)).join(", ")}` : "; everything it said is still there") +
                     "; " + built.note };
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
  // THE HOST MOVED (run 34, 2026-09-04): `api.frankfurter.app/latest` answers
  // a 301 to `api.frankfurter.dev/v1/latest`, and a connection deliberately
  // does not follow a redirect (`site-apis.mjs`: a third-party read that
  // redirects is a misconfigured endpoint, said to the owner rather than
  // chased). So run 34's page read a 502 — "that service redirected, which
  // this connection does not follow" — and, by its own code, showed nothing.
  // The ask names the host that answers; the refusal is the product's, and
  // the stale address was this file's.
  { name: "api", kinds: ["api", "component", "page"],
    ask: "Show today's GBP to EUR exchange rate on the prices page, read live from https://api.frankfurter.dev/v1/latest?from=GBP&to=EUR (no key needed)",
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

// ── A SENTENCE A PERSON TYPED ──────────────────────────────────────────────
//
// Owner, 2026-09-13: "Add free-text input to the harness so it can test the
// actual customer wording."
//
// WHY IT IS A CASE OF ITS OWN AND NEVER A SWAPPED-IN `ask`. Every case in the
// table above pairs its ask with a check written FOR that ask — the component
// case matches /testimonial|student|lesson/, the page case counts new routes.
// Putting a stranger's sentence behind one of those checks produces a verdict
// about words the customer never used, which is worse than no verdict: this
// repository rates a false alarm above a miss and a false ALL-CLEAR above
// either.
//
// SO IT REPORTS, AND IT JUDGES EXACTLY ONE THING. What the run is FOR is
// reading what the step did — which tables, which pages, what it said it could
// not cover — and none of that is knowable in advance. The one property that
// IS knowable is this repository's own rule: an answer may do less than was
// asked, and it may not do less while saying it did. So `ok` is false for a
// success that added nothing, changed nothing, moved nothing and explained
// nothing; for a 5xx; and for no answer at all. A NAMED refusal is `ok` —
// refusing with a reason is the product working, and the canary entry records
// that decision.
export function askCase(ask) {
  const said = String(ask || "");
  return {
    name: "ask",
    // NO KINDS ARE FORCED. The picker is the thing under test: which kind a
    // sentence routes to is the answer, not the input.
    kinds: [],
    ask: said,
    freeText: true,
    check: (b, a, r, x) => {
      const list = (v) => (Array.isArray(v) ? v : []);
      const names = (v) => list(v).map((e) => (e && typeof e === "object" ? (e.name || e.path || "") : e)).filter(Boolean);
      const pages = [...list(r && r.added), ...list(r && r.changed)].map(sitePathOf).filter(Boolean);
      const moved = list(r && r.moved);
      const built = a.build !== b.build;
      // WHAT IT MADE IN THE DATABASE, each read off the reply's own field —
      // the database leaves no mark on the page, so the reply is the record.
      const db = [
        names(r && r.tables).length ? `tables ${JSON.stringify(names(r.tables))}` : "",
        names(r && r.functions).length ? `functions ${JSON.stringify(names(r.functions))}` : "",
        names(r && r.apis).length ? `connections ${JSON.stringify(names(r.apis))}` : "",
        names(r && r.jobs).length ? `jobs ${JSON.stringify(names(r.jobs))}` : "",
        r && r.provisioned ? "AND THE SITE GOT ITS DATABASE FOR IT" : "",
        names(r && r.functionErrors).length ? `FAILED to create ${JSON.stringify(names(r.functionErrors))}` : "",
      ].filter(Boolean);
      // WHAT IT COULD NOT COVER. The counts are the step's own; the open list
      // is what the customer is owed. Printed even when empty, because "it
      // said nothing was outstanding" and "it never answered the question"
      // are different readings and an absent line collapses them.
      const cov = (r && typeof r.coverage === "object" && r.coverage) || null;
      const open = list(r && r.requirements);
      const bad = list(r && r.invalidProps).filter((s) => typeof s === "string");
      const coverage = cov
        ? `coverage ${cov.covered}/${cov.total} covered, ${cov.elsewhere} handed on, ${cov.unsupported} unsupported, ${cov.unreadable} unreadable`
        : "coverage: the answer carried none";
      const outstanding = open.length
        ? "STILL OWED: " + open.slice(0, 6).map((q) => `${JSON.stringify(q && q.need)} (${q && q.status}${q && q.why ? ": " + q.why : ""}${q && q.step ? " → " + q.step : ""})`).join("; ")
        : "nothing left outstanding";
      // THE PHOTOGRAPH NUMBERS AND THE WHOLE REPLY, BOTH ON EVERY OUTCOME.
      // This branch is the one that runs the check on a refusal as well as a
      // success, so reading either of these out of `r` unconditionally — never
      // behind `r.ok` — is what makes a 422's own sentence and its `lostPhotos`
      // list readable at all.
      const pics = photoLines(r).join("\n      ");
      const told = customerLines(r).join("\n      ");
      const props = bad.length ? `; asked for ${bad.length} guarantee(s) the tool does not offer: ${JSON.stringify(bad.slice(0, 6))}` : "";
      const refused = r && r.error ? String(r.error) : "";
      const claimed = r && r.ok === true;
      const didSomething = pages.length > 0 || moved.length > 0 || db.length > 0 || built;
      const explained = !!(refused || (r && r.notAdded && list(r.notAdded).length) || open.length || (r && r.coverNote));
      // THE ONE FALSIFIABLE CLAUSE, and it is the repo's own rule: doing less
      // than was asked while saying it was done.
      const hollow = claimed && !didSomething && !explained;
      return {
        ok: !hollow,
        note: `REPORTED, NOT JUDGED — a free-text ask has no expected answer, so read the lines below.` +
          `\n      routed to: ${JSON.stringify(list(x && x.askKinds))}` +
          `\n      database: ${db.length ? db.join("; ") : "nothing"}` +
          `\n      pages: ${JSON.stringify(pages)}${moved.length ? `; look fields moved ${JSON.stringify(moved)}` : ""}; build ${built ? "moved" : "UNMOVED"}` +
          `\n      home text ${b.text.length}→${a.text.length} chars` +
          `\n      ${coverage}` +
          `\n      ${outstanding}${props}` +
          `\n      ${pics}` +
          `\n      ${told}` +
          (refused ? `\n      refused: ${refused}` : "") +
          (hollow ? `\n      FAILED: it reported success and added nothing, changed nothing and explained nothing.` : ""),
      };
    },
  };
}

/**
 * The cases this run will use: the table, or the one sentence a person typed.
 *
 * A FREE-TEXT ASK REPLACES THE TABLE RATHER THAN JOINING IT, and the caller
 * SAYS SO when a lane list was also given. Run 16's lesson is that a filter on
 * a person's input is a silent drop and a check is a sentence — so the one
 * input that decides what the money buys never quietly loses to the other.
 */
export function casesFor(ask, cases = CASES) {
  const said = String(ask || "").trim();
  return said ? [askCase(said)] : cases;
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

/**
 * EVERY PICTURE THE PAGE REALLY DREW, with the size the browser decoded it at.
 *
 * *"…and check the new image visibly renders."* (owner, 2026-09-18). A 200 on
 * the file says the bytes are served; a `src` in the markup says the page asked
 * for it. Neither says a visitor sees anything — a broken image, a zero-byte
 * file and one the CSP refused all render as nothing with no console error a
 * screenshot can carry. `naturalWidth` is the browser's own answer to "did this
 * decode", and it is the only instrument here that can give it.
 *
 * `null` WHEN THERE IS NO BROWSER, never `[]`: a runner without playwright and
 * a page with no pictures on it are different facts, and an empty list would
 * read as the second while being the first.
 */
async function imagesOn(url) {
  if (!browser) return null;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const seen = await page.evaluate(() => Array.from(document.images).map((i) => ({
      src: i.currentSrc || i.getAttribute("src") || "", alt: i.getAttribute("alt") || "",
      w: i.naturalWidth, h: i.naturalHeight, done: !!i.complete,
    })));
    await page.close();
    return seen;
  } catch (e) { console.log(`   (image read failed: ${String(e && e.message).slice(0, 80)})`); return null; }
}

/**
 * WHICH CODE THE CALLER DEMANDED, read off the environment.
 *
 * Owner, 2026-09-15: *"Verify that both the Worker and the container executing
 * the test use the merged changes. Elapsed rollout time alone is insufficient
 * evidence."* Set either and a mismatch refuses BEFORE the first credit.
 *
 * ITS OWN FUNCTION, TAKING THE ENVIRONMENT, so the hop from a box on a form to
 * the decision that spends money can be DRIVEN. As two module constants it was
 * exactly the shape this repository has shipped twelve dead features in — a
 * value read correctly and never forwarded — and a sweep proved it: two mutants
 * cutting the expectations out of the call survived every guard, because a
 * constant handed over or not handed over looks identical from outside.
 *
 * ONE READER OF THE PAIR, so a renamed variable cannot leave a second copy
 * reading a name the workflow stopped sending.
 */
export function expectedCode(env = {}) {
  return {
    expectDeploy: String(env.SWEEP_EXPECT_DEPLOY || "").trim(),
    // LOWERCASED, because an image id is sixteen hex characters and a person
    // pasting one off a deploy log may bring capitals with it; the answer side
    // is lowercased to match, so the comparison is about the id and not the
    // keyboard.
    expectImage: String(env.SWEEP_EXPECT_IMAGE || "").trim().toLowerCase(),
  };
}

/**
 * EVERY REASON NOT TO SPEND, as a pure list — `[]` means go.
 *
 * SPLIT OUT FROM THE I/O DELIBERATELY. The one branch that matters most here
 * is the one that costs money when it is wrong, and a decision reachable only
 * through two authenticated routes and a live container is a decision nobody
 * can drive: this repository's own recorded "a wall nobody can drive is a wall
 * nobody is guarding". The wrapper fetches and prints; this decides.
 *
 * `deploy` and `image` are what the platform ANSWERED (each `""` when it could
 * not tell), `runtimeDeploy` is the second reader's answer, `queued` is the
 * runtime route's own `async` — whether this site's next edit goes to the queue
 * — and the two `expect*` are what the caller demanded.
 */
export function codeRefusals({ deploy = "", image = "", runtimeDeploy = "", queued, expectDeploy = "", expectImage = "" } = {}) {
  const no = [];
  // ── QUEUED WORK IS REQUIRED, AND IT IS NOT AN EXPECTATION THE CALLER SETS ──
  //
  // `async` off means the addon runs INSIDE THE WORKER'S ISOLATE, bounded by
  // the customer's own connection at ~270 s. Run 45 died at 270,025 ms with the
  // credits gone, which is the whole reason the queued path exists; every paid
  // case this harness has ever posted does work longer than that wall.
  //
  // UNCONDITIONAL, DELIBERATELY, and that is the one property here that is not
  // about which code. The `expect*` pair asks "is this the build I meant", and
  // with no demand there is nothing to answer; this asks "can the work survive
  // at all", which is true of every run whatever it demanded. As a caller's
  // flag it would be an input, and this repository's recorded rule is that an
  // input cannot be the wall — a forgotten box fails OPEN, which is the
  // direction that spends.
  //
  // AND `false` AND CANNOT-TELL GET DIFFERENT SENTENCES. One is a switch
  // somebody can turn on; the other is a route that did not answer, and reading
  // the second as the first sends a person to flip a flag that is already set.
  // `!== true` rather than a falsy test, so the string "false" — which is what
  // a JSON body mangled one hop away looks like — is cannot-tell and not a yes.
  if (queued !== true) {
    no.push(queued === false
      ? `queued work is OFF for this site (runtime async=false) — this addon would run inside the Worker's isolate and die at the ~270 s wall with the credits spent`
      : `could not read whether queued work is on for this site (runtime async=${JSON.stringify(queued === undefined ? null : queued)}) — cannot-tell is not a yes`);
  }
  // THE TWO READERS MUST AGREE. `build-health` and `runtime` each read
  // `deployIdOf(env)` from their own isolate; a disagreement means a deploy is
  // rolling underneath, and the honest answer to "which code" is "both".
  // Checked WITHOUT an expectation too — it is a fact about the platform, not
  // about what this caller wanted.
  if (deploy && runtimeDeploy && deploy !== runtimeDeploy) {
    no.push(`the two routes disagree about the deploy (${deploy} vs ${runtimeDeploy}) — a roll is in flight`);
  }
  if (expectDeploy) {
    // A PREFIX IS ALLOWED so a short sha works, bounded at 7 either way so it
    // cannot be a coincidence. An empty answer is a REFUSAL, never a pass:
    // cannot-tell must never read as a match.
    const a = String(expectDeploy), b = String(deploy);
    const ok = !!b && a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a));
    if (!ok) no.push(`worker deploy is ${b || "(cannot tell)"}, expected ${a}`);
  }
  if (expectImage) {
    // EXACT, because the id IS sixteen hex characters: a prefix of a hash is
    // not a weaker claim, it is a different one. `unstamped` arrives here as
    // "" through `healthImage`, and refuses.
    if (String(image) !== String(expectImage)) no.push(`container image is ${image || "(cannot tell)"}, expected ${expectImage}`);
  }
  return no;
}

// ── WHICH CODE IS ANSWERING, ASKED BEFORE ANYTHING IS SPENT ────────────────
//
// **TWO HALVES, AND A ROLLOUT MOVES THEM SEPARATELY.** The Worker is its
// `DEPLOY_ID` — the deploy's own sha — and the container is the image id its
// `/health` line stamps, which only a COLD START reads. A run that reads one
// and assumes the other is the recorded "a rule true because of a layer below
// it": the Worker can be new while an instance started seconds earlier is
// still on the previous image. `/api/site/build-health` answers BOTH in one
// call, which is why it is the instrument and a clock is not.
//
// **CANNOT-TELL IS A REFUSAL, NEVER A MATCH.** An `unstamped` image, a route
// that failed, an empty sha — each reads as "do not spend" when an expectation
// was given. The wrong direction here is the expensive one: a run against the
// PREVIOUS build produces a complete, plausible, green-looking result about
// code that is not under test, and nothing downstream can tell.
//
// With no expectation set it still PRINTS both, so every run's own log records
// which code answered it rather than leaving that to be inferred later.
async function whichCode(token) {
  const h = await call("GET", "/api/site/build-health", { token });
  const rt = await call("GET", `/api/site/runtime?slug=${encodeURIComponent(SLUG)}`, { token });
  const health = h.json || {};
  const runtime = rt.json || {};
  const image = String(health.image || "").toLowerCase();
  const deploy = String(health.deploy || "");
  console.log(`worker deploy: ${deploy || "(none)"}  [build-health ${h.status}]`);
  console.log(`container image (cold start, lane ${health.lane || "?"}): ${image || "(cannot tell)"}  health=${JSON.stringify(health.body || "")} in ${health.ms}ms`);
  console.log(`runtime for ${SLUG}: deploy=${runtime.deploy || "(none)"} runner=${runtime.runner} async=${runtime.async}  [${rt.status}]`);

  const want = expectedCode(process.env);
  // `runtime.async` IS THE QUEUED-WORK ANSWER, handed over WITHOUT a default:
  // a route that 401'd or failed leaves `runtime` as `{}` and this as
  // `undefined`, which the decision reads as cannot-tell and refuses. A `||
  // false` here would turn "nobody answered" into "the switch is off", which is
  // a different sentence pointing at a different fix.
  const no = codeRefusals({ deploy, image, runtimeDeploy: runtime.deploy, queued: runtime.async, ...want });
  if (no.length) {
    console.error("\nREFUSING TO SPEND — the code answering is not the code under test:");
    for (const line of no) console.error(`  - ${line}`);
    console.error("Nothing was charged. Wait for the roll, or correct the expectation.");
    process.exit(1);
  }
  // GETTING PAST THE GATE NOW SAYS TWO THINGS, and only one of them depends on
  // the caller having demanded anything: queued work is ON (asked every run),
  // and — when a demand was given — the code answering is the code meant.
  console.log(want.expectDeploy || want.expectImage
    ? "queued work is on, and the code under test is the code answering — proceeding\n"
    : "queued work is on — proceeding (no build was demanded, so which code answered is only recorded above)\n");
}

// ── RUN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!confirmed(process.env.SWEEP_CONFIRM)) { console.error("SWEEP_CONFIRM must be the word `spend` — this harness costs real credits on a live site."); process.exit(1); }
  if (!EMAIL || !SERVICE_KEY || !SLUG) { console.error("OWNER_EMAIL, SUPABASE_SERVICE_KEY and SWEEP_SLUG are required"); process.exit(1); }
  // THE SENTENCE WINS OVER THE TABLE, AND IT IS SAID OUT LOUD. Run 16's lesson
  // is that a filter on a person's input is a silent drop and a check is a
  // sentence; the one input that decides what the money buys must never lose
  // to the other without a word.
  const RUN_CASES = casesFor(ASK);
  for (const line of ignoredNote(ASK, WANT, process.env.SWEEP_ASK)) console.log(line);
  let names;
  try { names = chooseCases(ASK ? "all" : WANT, RUN_CASES); } catch (e) { console.error(String(e && e.message)); process.exit(1); }
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
  // BEFORE THE BROWSER, THE BALANCE OR THE FIRST POST — a refusal here has
  // spent nothing, which is the only reason it can be a refusal rather than a
  // warning printed over a run already under way.
  await whichCode(TOKEN);
  await openBrowser();
  const start = await balance();
  console.log(`balance at start: ${start}\n`);
  let before = await snapshot();
  if (before.status !== 200) { console.error(`the site does not answer 200 (${before.status}) — nothing to sweep against`); process.exit(1); }
  console.log(`site is up, build ${before.build}, routes ${JSON.stringify(before.routes)}\n`);

  const results = [];
  let n = 0;
  for (const name of names) {
    const c = RUN_CASES.find((x) => x.name === name);
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
    // READ BEFORE THE POST, or "this run added it" is not a claim anybody can
    // make: the site may have carried a job of that name since a run in March.
    const jobsBefore = jobRows((await call("GET", `/api/site/${encodeURIComponent(SLUG)}/jobs`, { token: TOKEN })).json);
    // ── THE BEFORE-INVENTORY, TAKEN IMMEDIATELY BEFORE THE POST ────────────
    //
    // *"Record a fresh before-inventory of routes, QR codes and existing image
    // references."* (owner, 2026-09-18). FRESH is the word that matters: a
    // reading taken earlier in a session is a reading of a site something else
    // may have republished since — measured on repairbench-1, which moved
    // between two baselines four minutes apart — so it is taken here, on the
    // line before the money goes, and never reused across cases.
    const srcBefore = await call("GET", `/api/site/source?slug=${encodeURIComponent(SLUG)}`, { token: TOKEN });
    const invBefore = srcBefore.status === 200 ? inventoryOf(srcBefore.json, SLUG) : null;
    if (!invBefore) console.log(`   (the before-inventory could not be read: /api/site/source answered ${srcBefore.status})`);
    else console.log(`   before: ${invBefore.routes.length} route(s) ${JSON.stringify(invBefore.routes)}, ${invBefore.qrFiles.length} code(s) ${JSON.stringify(invBefore.qrFiles)}, ${invBefore.photos.length} photograph(s)`);
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
    // ── THE AFTER-INVENTORY, THE CODES IT ADDED, AND WHAT A BROWSER DREW ───
    //
    // TAKEN ON EVERY OUTCOME, not only a success: a refusal that was supposed
    // to change nothing is exactly the run whose inventory is worth comparing,
    // and taking it only when the route said `ok` would leave the one claim a
    // refusal makes — *"your site is untouched"* — unchecked.
    extra.invBefore = invBefore;
    {
      const srcAfter = await call("GET", `/api/site/source?slug=${encodeURIComponent(SLUG)}`, { token: TOKEN });
      extra.invAfter = srcAfter.status === 200 ? inventoryOf(srcAfter.json, SLUG) : null;
    }
    extra.qrOpens = {};
    if (invBefore && extra.invAfter) {
      // THE CANDIDATES ARE EVERY ADDRESS THE SITE REALLY HAS, so the answer is
      // *which page this code opens* rather than *does it open the one I
      // guessed*. The name is whichever FILE appeared, discovered from the
      // diff; `assets` carries each code's own drawing, so nothing is fetched
      // and no filename is guessed.
      const origin = SITE;
      const urls = [origin + "/", ...extra.invAfter.routes.map((r) => origin + (r === "/" ? "" : r))];
      for (const file of inventoryDiff(invBefore, extra.invAfter).qrsAdded) {
        extra.qrOpens[file] = qrOpens(extra.invAfter.qrs[file], [...new Set(urls)]);
      }
    }
    // THE PICTURES, ON THE PAGE THE CHANGE MADE — or the home page when it made
    // none, which is where a component's picture lands.
    extra.drew = await imagesOn(SITE + ((extra.newRoutes && extra.newRoutes[0]) || "/"));
    for (const line of inventoryLines(invBefore, extra.invAfter, { opens: extra.qrOpens, drew: extra.drew })) console.log(`   ${line}`);
    const claimedOk = body.ok === true;
    const escalated = body.escalate === true;
    // THE DEVELOPER RECORD IS READ BEFORE THE VERDICT ON A FREE-TEXT ASK, and
    // the order is the whole of why this sits here rather than beside the
    // decline reader below: the check PRINTS which kinds the picker chose, and
    // a record fetched after the check has nothing to print into. The recorded
    // "a value computed and never forwarded", avoided by reading first.
    if (c.freeText) {
      const kept = await call("GET", `/api/site/answer?slug=${encodeURIComponent(SLUG)}&kind=addon`, { token: TOKEN });
      const ans = (kept.json && kept.json.answer) || {};
      extra.askKinds = Array.isArray(ans.kinds) ? ans.kinds : [];
      extra.askRecord = ans;
    }
    // ── WHAT WAS PERSISTED, AND WHAT IT DOES WHEN FIRED ───────────────────
    //
    // The registry read is unconditional; the PRESS is not. A job registered
    // on a schedule is a fact about the row, and the only way to see the
    // runner work without waiting out the schedule is the product's own
    // "Run now" — which really runs it, so it happens only when asked for.
    //
    // THE ORDER IS READ → PRESS → READ. The last read is what carries
    // `lastRun` and `lastResult` back, and those are written by the route
    // AFTER the run, so a single read taken before the press cannot see them.
    extra.jobsBefore = jobsBefore;
    extra.jobsAfter = jobRows((await call("GET", `/api/site/${encodeURIComponent(SLUG)}/jobs`, { token: TOKEN })).json);
    const pick = jobToRun(RUN_JOB, newJobs(jobsBefore, extra.jobsAfter), extra.jobsAfter);
    if (pick.run) {
      const rr = await call("POST", `/api/site/${encodeURIComponent(SLUG)}/jobs`, { token: TOKEN, body: { name: pick.name, run: true } });
      const rb = (rr.json && typeof rr.json === "object") ? rr.json : {};
      extra.ranJob = { run: true, name: pick.name, status: rr.status, sent: Number(rb.sent) || 0, result: rb.result || rb.error || "" };
      // ITS OWN MAP, AND NO FALLBACK. Folding this back into `jobsAfter` when
      // the re-read fails prints the PRE-press stamp — `lastRun never` — which
      // reads as a press that did nothing. `null` here is reported as "could
      // not be verified", which is the true statement.
      extra.jobsVerify = jobRows((await call("GET", `/api/site/${encodeURIComponent(SLUG)}/jobs`, { token: TOKEN })).json);
    } else extra.ranJob = pick;
    let verdict, note;
    if (p.status === 0) { verdict = "NO ANSWER"; note = `the request died: ${p.why || "?"}`; }
    // ── A FREE-TEXT ASK IS ALWAYS REPORTED, WHATEVER HAPPENED ──────────────
    //
    // Every branch below this one decides a verdict FIRST and calls the check
    // only on the shapes it expects — so a refusal, an escalate or a 5xx on a
    // stranger's sentence would print a one-line reason and never reach the
    // coverage lines, which are the whole reason the run was bought. This
    // branch runs the check on every outcome and lets the SHAPE pick the word.
    else if (c.freeText) {
      const chk = c.check(before, after, body, extra);
      verdict = askVerdict({ status: p.status, escalated, claimedOk, checkOk: chk.ok });
      note = chk.note +
        (escalated ? `\n      escalate ${body.reason} layer ${body.layer || "-"}` : "") +
        (!claimedOk && !escalated ? `\n      ${p.status} ${String(body.error || "")} — ${String(body.detail || body.msg || "").slice(0, 200)}` : "");
    }
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
    // A FREE-TEXT ASK READS IT EVERY TIME, whatever the verdict. The record is
    // where the kinds the picker chose and the coverage the designers answered
    // live — a decline is only the loudest reason to want them, and on a
    // stranger's sentence "what did it decide to do" is the question itself.
    if (c.freeText || (verdict === "failed" && String(body.error) === "declined")) {
      const ans = c.freeText ? (extra.askRecord || {})
        : ((await call("GET", `/api/site/answer?slug=${encodeURIComponent(SLUG)}&kind=addon`, { token: TOKEN })).json || {}).answer || {};
      if (c.freeText) for (const line of askLines(ans, extra.askKinds)) console.log(line);
      // THE REGISTRY BESIDE THE RECORD. The record says what the designers
      // ANSWERED; these lines say what the site really carries, and a job the
      // reply names with no row behind it is exactly the gap between them.
      if (c.freeText) for (const line of jobLines(extra.jobsBefore, extra.jobsAfter, extra.ranJob, extra.jobsVerify)) console.log(line);
      const replies = Array.isArray(ans.replies) ? ans.replies : [];
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
    // THE SITE'S OWN RENDER VERDICT IS READ (run 34, 2026-09-04) — see
    // `crashedRoutes`. A publish the site itself says broke a page is BROKEN:
    // shipped, and down.
    const crashed = crashedRoutes(body);
    if (shipped(verdict) && crashed.length) {
      verdict = "BROKEN";
      note += `; the site's own render check: ${crashed.length} serious finding${crashed.length === 1 ? "" : "s"} — ${crashed[0].route} ${crashed[0].kind}: ${String(crashed[0].detail || "").slice(0, 140)}`;
    }
    // WHAT THE REPAIR ROUND DID (owner, 2026-09-04: "try to fix it, if not
    // fix, send as it is"), read off the reply so a BROKEN verdict says
    // whether a fix was tried, held, or had no room — the difference between
    // the product doing what it was told and the product doing nothing.
    if (body && body.repair && typeof body.repair === "object") {
      const rp = body.repair;
      note += rp.ran
        ? `; repair ran: ${(rp.repaired || []).length ? "fixed " + rp.repaired.join(", ") : "fixed nothing"}${rp.failed ? " (" + rp.failed + ")" : ""}${(rp.refused || []).length ? "; refused " + rp.refused.map((x) => x && x.route).filter(Boolean).join(", ") : ""}`
        : `; repair ${rp.why || "skipped"}${(rp.routes || []).length ? " for " + rp.routes.join(", ") : ""}`;
    }
    const kinds = Array.isArray(body.kinds) ? body.kinds : [];
    // A FREE-TEXT ASK FORCES NO KIND — which kind a sentence routes to is the
    // answer under test, so "the picker named the wrong kind" is not a thing
    // this case can say. Written as its own clause rather than left to fall
    // out of an empty `c.kinds`, which reads as wrong the day a reply carries
    // its kinds.
    const pickedRight = c.freeText || !kinds.length || kinds.some((k) => c.kinds.includes(k));
    // THE PICTURES, on a publish only: the home page, and the new page if one.
    const shots = [];
    if (shipped(verdict) && after.build !== before.build) {
      const tag = String(n).padStart(2, "0") + "-" + name;
      const a = await shot(SITE + "/", path.join(SHOTS, `addon-${tag}.png`)); if (a) shots.push(a);
      for (const [i, p] of (extra.newRoutes || []).entries()) { const b = await shot(SITE + p, path.join(SHOTS, `addon-${tag}-page${extra.newRoutes.length > 1 ? "-" + (i + 1) : ""}.png`)); if (b) shots.push(b); }
    }
    console.log(`   kinds ${JSON.stringify(kinds)}${pickedRight ? "" : "  ← NOT " + JSON.stringify(c.kinds)}  cost=${cost}  ${wall.toFixed(0)}s  build ${before.build}→${after.build}${shots.length ? "  shots " + shots.join(", ") : ""}`);
    console.log(`   ${verdict.toUpperCase()}: ${note}\n`);
    results.push({ name, kinds, verdict, note, cost, wall: Math.round(wall), build: after.build, pickedRight, shots });
    if (stopsRun(verdict)) { console.log(`STOPPING on ${name}: ${verdict}`); break; }
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
  const bad = results.filter((r) => /LIE|NO ANSWER|BROKEN|^failed$/.test(r.verdict));
  process.exit(bad.length ? 1 : 0);
}

// Importable for its CASES without running: the test reads the table.
if (process.argv[1] && /addon-sweep\.mjs$/.test(process.argv[1])) main();
