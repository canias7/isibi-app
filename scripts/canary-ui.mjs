// ── THE CANARY'S UI MODE: THE REAL APP, IN A REAL BROWSER, AS THE OWNER ─────
//
// Every other harness here posts to the API, and at most EXECUTES the browser's
// reply composer in Node (`editBrowserReply`). A customer does neither: they
// press the + button, pick a file, type into the message box, press Send and
// wait for the reply before typing the next thing. Test 4a's Part B is about
// exactly that surface — an attachment sent from the real composer, and second
// messages from one tab — so it is driven here the way a person drives it: on
// gofarther.dev, in a real Chromium, one tab, no reload.
//
// SIGNED IN WITHOUT A PASSWORD, AND WITHOUT A SECOND WAY IN. The canary already
// opens an owner session (a magic link minted with the service key and
// verified); this module plants THAT session where `auth.js` keeps one
// (`zephyr_session_v1`), for the app's own origin only, before the page's first
// script runs. The app then boots signed in through its own code path.
//
// WHAT IT REFUSES, AND WHERE. Everything that can be checked for free is
// checked before the first Send: the app opened signed in as the right
// account, the site's card opened its workspace, the composer is idle, the file
// landed in the attachment strip and the words are in the box. Without `spend`
// it stops there (a rehearsal: nothing is sent). With it, each message is sent
// only when the previous reply is on screen and the composer is idle again, and
// the scenario stops — sending nothing more — on a reply that never comes, a
// composer that stays busy, a balance it cannot read, or a spend past the
// scenario's budget.
//
// NOTHING SECRET IS RECORDED. No header is kept, auth traffic is not recorded,
// and an attached image travels into the record as its name, size and sha256.

import fs from "node:fs";
import crypto from "node:crypto";
import {
  readBoth, baselineVerdict, changeVerdict, restorePlan, restoreRow, recoverRow, rowDiff, shownVerdict, lineIsFor,
  describeRows, describeRecovery, probeBody, probeVerdict,
} from "./canary-rows.mjs";

export const SESSION_KEY = "zephyr_session_v1";

// ── TEST 4b's D1: ONE ROW OF A LIVE SITE'S DATABASE ─────────────────────────
//
// The proposal's record of fold-lane-bakery's `loaves`, as a visitor's read
// answered it at 2026-09-27 01:31:00Z. D1 takes its own baseline immediately
// before its message and judges everything against THAT; the record is what
// that baseline is compared with (said, not refused), and what the recovery
// run compares a visitor's read with when D1's own run could not finish.
const LOAVES_RECORD = Object.freeze([
  Object.freeze({ id: 1, name: "Country White", description: "Our everyday loaf. Open crumb, thin crisp crust, a little wheat sweetness.", price: 4.8, photo: null, created_at: "2026-08-21 23:06:22" }),
  Object.freeze({ id: 2, name: "Dark Rye", description: "Dense and malty. Good with smoked fish or a sharp cheddar.", price: 5.2, photo: null, created_at: "2026-08-21 23:06:22" }),
  Object.freeze({ id: 3, name: "Seeded Wholemeal", description: "Toasted sunflower, flax and sesame through a wholemeal dough.", price: 5.4, photo: null, created_at: "2026-08-21 23:06:22" }),
  Object.freeze({ id: 4, name: "Olive & Rosemary", description: "Green olives and a handful of rosemary from the morning bunches.", price: 5.8, photo: null, created_at: "2026-08-21 23:06:23" }),
  Object.freeze({ id: 5, name: "Walnut Levain", description: "Butter walnuts folded through a long-fermented white dough.", price: 6, photo: null, created_at: "2026-08-21 23:06:23" }),
  Object.freeze({ id: 6, name: "Sea Salt Focaccia", description: "A tray bake, heavy on the oil, finished with flaky salt.", price: 4.5, photo: null, created_at: "2026-08-21 23:06:23" }),
]);

// THE ONE CHANGE, AND THE ONLY FIELD EVER WRITTEN BACK: loaves id 6 (it must
// still be the Sea Salt Focaccia), price 4.5 -> 4.6. `from`/`to` are compared
// as decimals, so a NUMERIC read back as "4.60" is 4.6. `shown` is where a
// visitor sees it: the order page's loaf list, one radio card per loaf.
const D1_ROW = Object.freeze({
  table: "loaves",
  id: 6,
  match: Object.freeze({ name: "Sea Salt Focaccia" }),
  field: "price",
  from: "4.5",
  to: "4.6",
  shown: Object.freeze({ path: "/order", sel: 'input[type="radio"]', before: "£4.50", after: "£4.60" }),
  record: LOAVES_RECORD,
});

/**
 * THE SCENARIOS, BY NAME. A form box takes a name and never a script: what is
 * sent is written here, reviewed with the code, and tied to the one site its
 * words describe — Part B's messages name that bakery's photograph and pages.
 */
export const UI_SCENARIOS = Object.freeze({
  "4a-part-b": Object.freeze({
    site: "fold-lane-bakery",
    // Credits this scenario may spend in all (routing calls included) before
    // it sends nothing more. Part B was estimated at about 7-8.
    budget: 15,
    steps: Object.freeze([
      Object.freeze({ attach: "test/fixtures/ui-logo.png", say: "Use this picture as the logo." }),
      Object.freeze({ say: "Show more of the top of the photo of the sourdough boule cooling." }),
      Object.freeze({ say: "Move the starter page to /starter." }),
    ]),
  }),
  // TEST 4b's D1 — one row, through the real app, and back with no model call.
  // `layers` is the wall: the one edit that may leave the page is an edit at
  // the data layer; text, page, rules, look, the add-on, a build and the full
  // rewrite are aborted in the browser and recorded, so a misroute costs the
  // routing call and changes nothing. The data rung writes display rows only.
  "4b-d1-price": Object.freeze({
    site: "fold-lane-bakery",
    // Routing 1-2 and the data rung's one call, about 1.
    budget: 5,
    layers: Object.freeze(["data"]),
    // A data edit publishes nothing: no page, no version, the site stays on
    // the version its before-read saw.
    publishes: 0,
    // What the screen and the job's own stored reply must say.
    reply: "✅ Updated one entry in loaves.",
    applied: Object.freeze([Object.freeze({ table: "loaves", id: 6, columns: Object.freeze(["price"]) })]),
    row: D1_ROW,
    steps: Object.freeze([
      Object.freeze({ say: "In today's bake list, change the Sea Salt Focaccia's price to £4.60." }),
    ]),
  }),
  // D1's RECOVERY ON ITS OWN, for a run that could not finish it (a reply that
  // never came, a runner that died between the edit and the write). It sends
  // no message and opens no app: it reads the row and, with spend=yes, writes
  // the focaccia's price back to 4.5 ONLY while it reads 4.6 — that field
  // alone. With spend=no it reads and says what it would write. Free.
  "4b-d1-restore": Object.freeze({
    site: "fold-lane-bakery",
    budget: 0,
    layers: Object.freeze([]),
    publishes: 0,
    row: D1_ROW,
    steps: Object.freeze([]),
  }),
});

// Bounds. A step is one message: its routing call, its job and its publish.
// Part A's whole edit took 220 s; the slowest page edit on record took 646 s.
export const UI_OPEN_MS = 90_000;
export const UI_ATTACH_MS = 20_000;
export const UI_START_MS = 30_000;
export const UI_STEP_MS = 12 * 60_000;
export const UI_POLL_MS = 1000;

/** The scenario a form box names, refused whole rather than guessed. */
export function readUiScenario(raw, slug) {
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!name) return { ok: false, msg: "no scenario is named" };
  if (!Object.hasOwn(UI_SCENARIOS, name)) {
    return { ok: false, msg: `there is no scenario called "${name}" (known: ${Object.keys(UI_SCENARIOS).join(", ")})` };
  }
  const scenario = UI_SCENARIOS[name];
  if (scenario.site !== slug) {
    return { ok: false, msg: `scenario "${name}" is written for ${scenario.site}, and the site box says ${slug || "nothing"}` };
  }
  return { ok: true, name, scenario };
}

/**
 * IDLE MEANS EVERY SIGN OF IT AT ONCE: the page's own busy flag down, the Send
 * button drawn (the workspace draws Stop instead while busy), no "Working" row
 * in the thread, and a box that takes typing. Any one alone has been true of a
 * page that was still busy.
 */
export function composerReady(s) {
  return !!s && s.busy === false && s.send === true && s.sendDisabled === false && s.stop === false &&
    s.working === 0 && s.textarea === true && s.disabled === false;
}

/** The replies that arrived after a send: the assistant's messages past the ones already there. */
export function newReplies(beforeCount, messages) {
  const list = Array.isArray(messages) ? messages : [];
  return list.slice(Math.max(0, Number(beforeCount) || 0)).filter((m) => m && m.who === "a" && !m.busy);
}

/** The recovery's condition probe through the canary's own PATCH; a throw is cannot-tell. */
export async function conditionProbe(rows, spec) {
  const res = await Promise.resolve()
    .then(() => rows.patch(spec.id, probeBody(spec)))
    .catch((e) => ({ status: 0, json: { error: String((e && e.message) || e).slice(0, 200) } }));
  return probeVerdict(res);
}

/**
 * The spend so far against the scenario's budget. An unreadable balance is a
 * refusal: whether the budget is spent is then not known, and the direction
 * that costs money is the one to refuse.
 */
export function budgetRefusal({ start, now, budget }) {
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(now) && now >= 0)) {
    return "the balance could not be read, so the spend so far is not known";
  }
  const spent = start - now;
  return spent >= budget ? `the scenario has spent ${spent} of its ${budget}-credit budget` : "";
}

/** A data URL as what can be compared without carrying it: name, bytes, sha256. */
export function imageFacts(img) {
  const name = img && typeof img.name === "string" ? img.name : "";
  const data = img && typeof img.data === "string" ? img.data : "";
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(data);
  if (!m) return { name, bytes: 0, sha256: "", type: "" };
  const buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { name, type: m[1], bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

/** A request body as recordable: parsed, with every attachment reduced to its facts. */
export function recordableRequest(raw) {
  let body;
  try { body = JSON.parse(raw); } catch { return raw ? { unparsed: String(raw).slice(0, 200) } : null; }
  if (body && Array.isArray(body.images)) body = { ...body, images: body.images.map(imageFacts) };
  return body;
}

/**
 * THE WORK A SCENARIO NEVER ASKS FOR, AND THE HARNESS REFUSES TO START.
 * Every scenario here is edits. A message the router sent to the add-on route,
 * or that fell to a build or the full rewrite, would spend money nobody
 * authorised — so such a request is aborted in the browser before it leaves,
 * and recorded. What the page then says is the harness's doing, and the record
 * says so.
 */
export function blocksPost(method, pathname) {
  if (method !== "POST") return false;
  if (pathname === "/api/site/react-build" || pathname === "/api/site/build" || pathname === "/api/site/react-revise") return true;
  return /^\/api\/site\/[^/]+\/addon$/.test(pathname);
}

/**
 * THE WALL, PER SCENARIO. Every scenario refuses the work none of them asks for
 * (`blocksPost`). A scenario that names its `layers` goes further and is a
 * POSITIVE list for everything that writes: a request that is not a read may
 * leave the page only if it is the routing call, or an edit of this
 * scenario's own site at one of its layers. An edit whose layer cannot be
 * read is refused, not guessed. Returns the reason to abort, or "".
 */
export function wallRefusal({ method, pathname, body, scenario } = {}) {
  if (blocksPost(method, pathname)) return "work this scenario never asks for";
  const layers = scenario && Array.isArray(scenario.layers) ? scenario.layers : null;
  if (!layers) return "";
  if (method === "GET" || method === "HEAD") return "";
  if (method === "POST" && pathname === "/api/site/route") return layers.length ? "" : "a message this scenario never sends";
  const m = /^\/api\/site\/([^/]+)\/edit$/.exec(String(pathname || ""));
  if (method === "POST" && m) {
    let slug = "";
    try { slug = decodeURIComponent(m[1]); } catch { slug = ""; }
    if (slug !== scenario.site) return `an edit of ${slug || "another site"}, which is not this scenario's site`;
    let layer = null;
    try {
      const b = JSON.parse(String(body || ""));
      layer = b && typeof b.layer === "string" ? b.layer : null;
    } catch { layer = null; }
    if (layer === null) return "an edit whose layer cannot be read";
    return layers.includes(layer) ? "" : `an edit at the ${layer || "(blank)"} layer, which this scenario does not allow`;
  }
  return `a ${method} this scenario never makes`;
}

/**
 * WHAT LEFT THE PAGE FOR ONE MESSAGE, against what the scenario sends: one
 * routing call carrying the words exactly, answered with one of the
 * scenario's layers, and exactly one edit at that layer carrying the same
 * words. The request bodies are the page's own, as its network listener saw
 * them — not a second copy composed here.
 */
export function requestVerdict(step, scenario) {
  const net = Array.isArray(step && step.network) ? step.network : [];
  const said = step && step.say;
  const routes = net.filter((e) => e.method === "POST" && e.path === "/api/site/route");
  const edits = net.filter((e) => e.method === "POST" && /^\/api\/site\/[^/]+\/edit$/.test(e.path));
  const route = routes[0] || null;
  const res = route && route.res && typeof route.res === "object" ? route.res : {};
  const layers = scenario && Array.isArray(scenario.layers) ? scenario.layers : [];
  const out = {
    routes: routes.length,
    routedWords: !!(route && route.req && route.req.message === said),
    routedIntent: typeof res.intent === "string" ? res.intent : "",
    routedLayer: typeof res.layer === "string" ? res.layer : "",
    routeCost: Number.isFinite(res.cost) ? res.cost : null,
    edits: edits.length,
    editLayers: edits.map((e) => (e.req && typeof e.req.layer === "string" ? e.req.layer : null)),
    editWords: edits.length > 0 && edits.every((e) => e.req && e.req.instruction === said),
  };
  out.ok = out.routes === 1 && out.routedWords && out.routedIntent === "edit" && layers.includes(out.routedLayer) &&
    out.edits === 1 && out.editWords && out.editLayers.every((l) => layers.includes(l));
  return out;
}

/**
 * THE JOB'S OWN STORED REPLY, the one the page was handed under
 * `x-gf-edit: final`: it must be the scenario's layer answering ok, naming
 * exactly the rows and columns the scenario changes, with nothing failed and
 * nothing compiled.
 */
export function storedReplyVerdict(step, scenario) {
  const fin = (Array.isArray(step && step.network) ? step.network : []).filter((e) => e.final && e.res && typeof e.res === "object");
  const r = fin.length ? fin[fin.length - 1].res : null;
  if (!r) return { ok: false, why: "no stored reply was read" };
  const layer = scenario && Array.isArray(scenario.layers) ? scenario.layers[0] : "";
  const applied = JSON.stringify(Array.isArray(r.applied) ? r.applied : null) === JSON.stringify(scenario.applied || null);
  const out = { ok: false, layer: r.layer, applied: r.applied, failed: r.failed, files: r.files, sort: r.sort, cost: r.cost };
  if (r.ok !== true) return { ...out, why: "the stored reply is not ok" };
  if (r.layer !== layer) return { ...out, why: `the stored reply is the ${r.layer} layer's` };
  if (!applied) return { ...out, why: "the stored reply names other rows or columns" };
  if (r.failed) return { ...out, why: `${r.failed} change(s) failed` };
  if (r.files !== undefined || r.sort !== undefined) return { ...out, why: "the stored reply compiled or reordered pages" };
  return { ...out, ok: true, why: "" };
}

/**
 * What each routing call the page made said it cost, message by message, read
 * off the page's own recorded answers. A call whose answer carried no readable
 * cost gives `undefined`, which `moneyVerdict` refuses rather than counts as 0.
 */
export function routeCostsOf(steps) {
  return (Array.isArray(steps) ? steps : []).flatMap((s) => (Array.isArray(s && s.network) ? s.network : [])
    .filter((e) => e.method === "POST" && e.path === "/api/site/route")
    .map((e) => (e.res && typeof e.res === "object" ? e.res.cost : undefined)));
}

/**
 * THE MONEY, CLOSED OR NOT. The balance before the first message less the
 * balance at the end must be exactly the routing calls' own costs plus each
 * job's charge — and each job's charge must be what its own row says AND what
 * the ledger took under it, with nothing refunded. An exempt job takes no
 * ledger row. Anything that cannot be read is a refusal, never a zero.
 */
export function moneyVerdict({ start, end, routeCosts, jobs } = {}) {
  const bad = (why, extra = {}) => ({ ok: false, why, ...extra });
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(end) && end >= 0)) return bad("the balance could not be read at both ends");
  const costs = Array.isArray(routeCosts) ? routeCosts : [];
  if (costs.some((c) => !Number.isFinite(c) || c < 0)) return bad("a routing call's cost is not a number");
  const routing = costs.reduce((a, b) => a + b, 0);
  let edits = 0;
  for (const j of Array.isArray(jobs) ? jobs : []) {
    const id = (j && j.job) || "?";
    if (!j || !j.row) return bad(`job ${id} has no readable row`);
    if (!j.ledgerRead || j.ledgerRead.ok !== true || !Array.isArray(j.ledger)) return bad(`job ${id}'s ledger could not be read`);
    let debits = 0, refunds = 0;
    for (const e of j.ledger) {
      const d = Number(e && e.delta);
      if (!Number.isFinite(d)) return bad(`job ${id} has a ledger row with no amount`);
      if (d < 0) debits -= d; else refunds += d;
    }
    if (j.row.billing === "finalized") {
      if (!(Number.isSafeInteger(j.row.cost) && j.row.cost >= 0)) return bad(`job ${id}'s cost is not a whole number`);
      if (debits !== j.row.cost || refunds !== 0) return bad(`job ${id}: its row says ${j.row.cost}; the ledger took ${debits} and returned ${refunds}`);
      edits += j.row.cost;
    } else if (j.row.billing === "exempt") {
      if (j.ledger.length) return bad(`job ${id} is exempt and the ledger names it`);
    } else {
      return bad(`job ${id} is ${j.row.billing}, not settled`);
    }
  }
  const spent = start - end;
  return spent === routing + edits
    ? { ok: true, why: "", spent, routing, edits }
    : bad(`the balance moved ${spent}; routing ${routing} + edits ${edits} is ${routing + edits}`, { spent, routing, edits });
}

/**
 * NOTHING PUBLISHED, from three readers that do not borrow from each other:
 * the site's own version list names no build for any job, every job's row
 * says no publish ever began, and the after-read saw the version the
 * before-read saw (the chain, with no links).
 */
export function unpublishedVerdict({ published, jobs, chain } = {}) {
  const pub = Array.isArray(published) ? published : [];
  if (pub.length) return { ok: false, why: `the version list names ${pub.length} build(s) for this scenario's jobs` };
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || !j.row) return { ok: false, why: `job ${(j && j.job) || "?"} has no readable row` };
    if (j.row.publish_started_at || j.row.published_at) return { ok: false, why: `job ${j.job}'s row says a publish began` };
  }
  if (!chain || chain.verified !== true || chain.links !== 0) return { ok: false, why: `the after-read is ${chain ? chain.why : "not taken"}` };
  return { ok: true, why: "" };
}

/** The API calls whose bodies are the evidence; everything else is recorded by status alone. */
export function recordsBody(method, pathname) {
  if (method === "POST" && pathname === "/api/site/route") return true;
  if (method === "POST" && /^\/api\/site\/[^/]+\/(edit|addon)$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/site\/edit\/[^/]+$/.test(pathname)) return true;
  return false;
}

/**
 * THE CHAIN OF PUBLISHES A SCENARIO MADE, checked link by link. Each published
 * version must have been built from the one before it — the first from the
 * version the before-read saw — and the after-read must have seen the last.
 * A job that did not publish leaves the chain where it was.
 */
export function chainVerdict({ before, published, wait, after } = {}) {
  const rows = Array.isArray(published) ? published : [];
  if (!before) return { verified: false, why: "before-unknown", target: "" };
  let prev = before;
  for (const p of rows) {
    if (!p || !p.id) return { verified: false, why: "not-listed", target: prev };
    if (p.parent !== prev) return { verified: false, why: "parent-mismatch", target: p.id, job: p.job, parent: p.parent, expected: prev };
    prev = p.id;
  }
  if (!wait || wait.kind !== "match") return { verified: false, why: wait ? wait.kind : "not-waited", target: prev };
  const pages = after && typeof after === "object" ? Object.entries(after) : [];
  const off = pages.filter(([, v]) => !v || v.version !== prev).map(([r]) => r);
  if (!pages.length) return { verified: false, why: "no-pages", target: prev };
  if (off.length) return { verified: false, why: "page-version", target: prev, off };
  return { verified: true, why: "verified", target: prev, links: rows.length };
}

// ── IN THE PAGE ─────────────────────────────────────────────────────────────
// These run inside gofarther.dev, so every free name in them is the app's own.

/** Everything the steps decide on, read in one pass. */
function readComposerInPage() {
  const ta = document.getElementById("stRevise");
  const send = document.getElementById("stSend");
  const gate = document.getElementById("authGate");
  let attached = null;
  try { attached = siteDraft(siteAttachFor).imgs.length; } catch (e) { attached = null; }
  return {
    signedIn: !!(window.Auth && Auth.isSignedIn && Auth.isSignedIn()),
    uid: window.Auth && Auth.userId ? Auth.userId() : "",
    gate: !!gate && getComputedStyle(gate).display !== "none",
    workspace: !!ta && !!document.getElementById("stPlus"),
    busy: typeof siteBusy === "boolean" ? siteBusy : null,
    send: !!send,
    sendDisabled: send ? !!send.disabled : null,
    stop: !!document.getElementById("stStop"),
    textarea: !!ta,
    disabled: ta ? !!ta.disabled : null,
    value: ta ? ta.value : null,
    working: document.querySelectorAll("#stThread .st-busy").length,
    attached,
    strip: document.querySelectorAll("#stAttach > *").length,
    messages: [...document.querySelectorAll("#stThread .st-msg")].map((m) => ({
      who: m.classList.contains("u") ? "u" : "a",
      busy: m.classList.contains("st-busy"),
      text: String(m.innerText || m.textContent || "").replace(/⧉\s*$/, "").trim(),
    })),
  };
}

/**
 * A list a visitor sees, read off the SITE's own page: each matching control's
 * card as text (the order page draws one radio card per loaf). Runs in the
 * site's page, not the app's.
 */
function shownListInPage(sel) {
  return [...document.querySelectorAll(sel)].map((el) => {
    const card = el.closest("label") || el.parentElement;
    return card ? String(card.innerText || card.textContent || "").trim().replace(/\s+/g, " ") : "";
  });
}

/** The start screen's card for a slug: the id the app itself gave it, or "". */
function cardIdInPage(slug) {
  try {
    const all = SiteList.merge(sitesLoad(), sitesRemote, sitesRemote !== null);
    const s = all.find((x) => x && x.slug === slug);
    if (s && document.querySelector('.st-card[data-open="' + CSS.escape(s.id) + '"]')) return s.id;
  } catch (e) { /* fall through to the list's own id for a site this browser never built */ }
  return document.querySelector('.st-card[data-open="srv_' + slug + '"]') ? "srv_" + slug : "";
}

// ── THE DRIVER ──────────────────────────────────────────────────────────────

/** A real Chromium: the runner's `playwright` in CI, or `playwright-core` here. */
export async function defaultLaunch() {
  let pw;
  try { pw = await import("playwright"); } catch { pw = await import("playwright-core"); }
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  return chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.CHROMIUM_PATH || undefined });
}

/**
 * THE SITE AS A VISITOR SEES IT: its page opened in a context of its own (no
 * planted session, no app), every request that is not a read aborted — so the
 * look can never submit the form on it — and the list read once the target's
 * card is drawn. Returns the lines, the target's own line and the version the
 * page was served at.
 */
export async function readShownSite(browser, { url, sel, name, ms = 45_000, pollMs = 500, route = null } = {}) {
  const out = { at: new Date().toISOString(), ok: false, why: "", url, version: "", lines: [], target: "", errors: [], aborted: [] };
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    if (route) await route(ctx, "site");
    await ctx.route(() => true, async (r) => {
      const req = r.request();
      const m = req.method();
      if (m === "GET" || m === "HEAD") return r.fallback();
      const u = String(req.url());
      if (!u.includes("/cdn-cgi/")) out.aborted.push(`${m} ${u}`);
      return r.abort("blockedbyclient");
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => out.errors.push(String((e && e.message) || e).slice(0, 300)));
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: ms });
    out.version = res && typeof res.headers === "function" ? String(res.headers()["x-site-version"] || "") : "";
    const end = Date.now() + ms;
    for (;;) {
      out.lines = await page.evaluate(shownListInPage, sel).catch(() => []);
      out.target = (out.lines || []).find((l) => lineIsFor(l, name)) || "";
      if (out.target || Date.now() >= end) break;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    out.ok = !!out.target;
    if (!out.ok) out.why = `the page never drew a card for ${name}`;
  } catch (e) {
    out.why = String((e && e.message) || e).slice(0, 200);
  } finally {
    if (ctx) { try { await ctx.close(); } catch { /* already gone */ } }
  }
  return out;
}

/**
 * Drive one scenario. Every dependency that touches the world is handed in, so
 * a test can drive the same code with a browser whose API answers are supplied.
 *   base        the app's origin (https://gofarther.dev)
 *   session     the GoTrue session the canary opened (access, refresh, user)
 *   slug        the site the scenario is written for
 *   scenario    a value from UI_SCENARIOS
 *   spend       false = rehearse up to the first Send and stop
 *   balanceNow  () => Promise<number>, -1 when unreadable
 *   evid        a directory for screenshots
 *   launch      () => Promise<Browser>
 *   route       optional (context) => Promise, to answer requests in tests
 */
export async function runUi(opts) {
  const {
    base, session, slug, scenario, spend, balanceNow, evid,
    launch = defaultLaunch, route = null, log = console.log,
    openMs = UI_OPEN_MS, attachMs = UI_ATTACH_MS, startMs = UI_START_MS, stepMs = UI_STEP_MS, pollMs = UI_POLL_MS,
    // How long an answer's own network entry gets to land before a step's
    // share of the record is taken: the listener reads the body after the page
    // has already drawn the reply.
    settleMs = 1500,
    // A SCENARIO THAT CHANGES A ROW (`scenario.row`) is handed the canary's
    // own readers: `rows = { owner, pub, patch }` — the owner route's read,
    // the visitor route's read and the owner route's PATCH — and the site's
    // origin, where the page a visitor sees it on lives.
    rows = null, siteOrigin = "", shownMs = 45_000,
    root = new URL("../", import.meta.url).pathname,
  } = opts;
  const origin = new URL(base).origin;
  const t0 = Date.now();
  const rec = {
    at: new Date(t0).toISOString(), base: origin, slug, spend: spend === true,
    opened: null, card: "", steps: [], stopped: null, sent: 0, blocked: [],
    network: [], consoleErrors: [], pageErrors: [], balance: { start: null, end: null },
  };
  const stop = (at, msg) => { rec.stopped = { at, msg }; log(`  STOPPED at ${at}: ${msg}`); };
  const spec = scenario && scenario.row ? scenario.row : null;
  if (spec) {
    rec.row = { spec, shown: {} };
    if (!rows || typeof rows.owner !== "function" || typeof rows.pub !== "function" || typeof rows.patch !== "function" || !siteOrigin) {
      stop("open", "this scenario checks a database row and was not handed the row readers — nothing was sent or written");
      return rec;
    }
  }
  const shot = async (page, name) => {
    if (!evid) return "";
    fs.mkdirSync(evid, { recursive: true });
    const file = `${evid}/${name}.png`;
    try { await page.screenshot({ path: file }); return file; } catch { return ""; }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (page, test, ms) => {
    const end = Date.now() + ms;
    let s = null;
    for (;;) {
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
      if (s && test(s)) return { ok: true, s };
      if (Date.now() >= end) return { ok: false, s };
      await sleep(pollMs);
    }
  };

  const browser = await launch();
  // The visitor's page, read in a context of its own. The verdict against the
  // first reading is the caller's: what it must show changes from step to step.
  const shown = () => readShownSite(browser, {
    url: siteOrigin + spec.shown.path, sel: spec.shown.sel, name: String(spec.match.name || ""),
    ms: shownMs, pollMs: Math.max(pollMs, 250), route,
  });
  try {
    // ── A RECOVERY RUN: NO APP, NO MESSAGE, ONE FIELD AT MOST ──────────────
    // A row scenario with no steps is D1's recovery on its own. It never opens
    // the app and never sends anything; `spend` decides whether its one write
    // is made or only described.
    if (spec && !scenario.steps.length) {
      rec.balance.start = await balanceNow();
      const before = rec.row.shown.before = await shown();
      // Whether the write would be conditional is asked first, with a write no
      // row can meet; a Worker that cannot enforce it is never sent the real one.
      rec.row.capability = await conditionProbe(rows, spec);
      rec.row.recovery = await recoverRow({ spec, record: spec.record, readers: rows, patch: rows.patch, write: spend === true && rec.row.capability.ok });
      if (rec.row.recovery.sent) {
        const now = rec.row.shown.afterRestore = await shown();
        now.verdict = before.ok && now.ok ? shownVerdict(before.lines, now.lines, spec, spec.shown.before) : { ok: false, why: now.ok ? "no-before" : now.why };
      }
      if (!spend) stop("rehearsal", "spend is not yes: the recovery was read and decided, and nothing was written");
      else if (!rec.row.capability.ok) stop("condition", `${rec.row.capability.detail || rec.row.capability.why} — nothing was written`);
      rec.balance.end = await balanceNow();
      return rec;
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (route) await route(context);
    // Registered after any test route, so it is asked first; anything it does
    // not refuse falls back to that route, or to the network. It sees every API
    // call the app makes, because a scenario that names its layers refuses
    // every write that is not its own (`wallRefusal`).
    await context.route((u) => u.origin === origin && u.pathname.startsWith("/api/"), async (r) => {
      const req = r.request();
      const u = new URL(req.url());
      const why = wallRefusal({
        method: req.method(), pathname: u.pathname,
        body: typeof req.postData === "function" ? req.postData() : null, scenario,
      });
      if (!why) return r.fallback();
      rec.blocked.push({ ms: Date.now() - t0, method: req.method(), path: u.pathname, why });
      log(`  BLOCKED ${req.method()} ${u.pathname}: ${why}`);
      return r.abort("blockedbyclient");
    });
    // THE OWNER'S SESSION, PLANTED FOR THE APP'S ORIGIN AND NO OTHER. The same
    // script runs in the workspace's preview frame, which is the customer
    // site's origin — and a session written there would hand the owner's token
    // to that site's scripts. Written once: the app refreshes and rotates it.
    await context.addInitScript(({ o, key, value }) => {
      try { if (location.origin === o && !localStorage.getItem(key)) localStorage.setItem(key, value); } catch (e) { /* a frame with no storage */ }
    }, {
      o: origin, key: SESSION_KEY, value: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ? session.expires_at * 1000 : Date.now() + (session.expires_in || 3600) * 1000,
        user: session.user || null,
      }),
    });
    const page = await context.newPage();
    page.on("console", (m) => { if (m.type() === "error") rec.consoleErrors.push(m.text().slice(0, 300)); });
    page.on("pageerror", (e) => rec.pageErrors.push(String((e && e.message) || e).slice(0, 300)));
    page.on("response", async (res) => {
      const req = res.request();
      const url = req.url();
      if (!url.startsWith(origin + "/api/")) return;
      const u = new URL(url);
      const e = { ms: Date.now() - t0, method: req.method(), path: u.pathname + u.search, status: res.status() };
      if (res.headers()["x-gf-edit"] === "final") e.final = true;
      if (recordsBody(req.method(), u.pathname)) {
        if (req.method() === "POST") e.req = recordableRequest(req.postData());
        // A poll is recorded in full only when it is the answer; every other
        // poll is a status line, or the record is mostly "still running".
        if (req.method() === "POST" || e.final || e.status >= 400) {
          try { const txt = await res.text(); try { e.res = JSON.parse(txt); } catch { e.res = txt.slice(0, 400); } } catch { /* a body the browser no longer holds */ }
        }
      }
      rec.network.push(e);
    });

    // ── OPEN THE APP, SIGNED IN, AND THE SITE'S WORKSPACE ─────────────────
    await page.goto(origin + "/projects", { waitUntil: "domcontentloaded", timeout: openMs });
    const signed = await until(page, (s) => s.gate || (s.signedIn && !!s.uid), openMs);
    const want = (session.user && session.user.id) || "";
    rec.opened = { signedIn: !!(signed.s && signed.s.signedIn), uid: signed.s ? signed.s.uid : "", gate: !!(signed.s && signed.s.gate) };
    if (rec.opened.gate) { stop("open", "the app asked to sign in, so the planted session was refused — nothing was sent"); await shot(page, "ui-open"); return rec; }
    if (!signed.ok || !rec.opened.signedIn) { stop("open", "the app did not open signed in — nothing was sent"); await shot(page, "ui-open"); return rec; }
    if (!want || rec.opened.uid !== want) { stop("open", `the app is signed in as ${rec.opened.uid || "nobody"}, not the canary's account — nothing was sent`); return rec; }
    const cardEnd = Date.now() + openMs;
    let card = "";
    while (!card && Date.now() < cardEnd) {
      card = await page.evaluate(cardIdInPage, slug).catch(() => "");
      if (card) break;
      const g = await page.evaluate(readComposerInPage).catch(() => null);
      if (g && g.gate) { stop("open", "the app asked to sign in, so the planted session was refused — nothing was sent"); await shot(page, "ui-open"); return rec; }
      await sleep(pollMs);
    }
    rec.card = card;
    if (!card) { stop("open", `the start screen never showed ${slug}'s card — nothing was sent`); await shot(page, "ui-open"); return rec; }
    await page.click(`.st-card[data-open="${card}"] .st-card-name`);
    const ws = await until(page, (s) => s.workspace, openMs);
    if (!ws.ok) { stop("open", "the site's workspace never opened — nothing was sent"); await shot(page, "ui-open"); return rec; }
    const idle = await until(page, composerReady, openMs);
    if (!idle.ok) { stop("open", "the workspace opened busy and never became idle — nothing was sent"); await shot(page, "ui-open"); return rec; }
    rec.balance.start = await balanceNow();
    await shot(page, "ui-open");

    // ── ONE MESSAGE AT A TIME ─────────────────────────────────────────────
    for (const [i, step] of scenario.steps.entries()) {
      const n = i + 1;
      const r = { n, say: step.say, attach: step.attach || null };
      rec.steps.push(r);
      const pre = await until(page, composerReady, pollMs);
      if (!pre.ok) { stop(`step ${n}`, "the composer is not idle, so nothing more is sent"); break; }
      if (step.attach) {
        const file = new URL(step.attach, "file://" + root).pathname;
        const bytes = fs.readFileSync(file);
        r.file = { path: step.attach, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
        const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: attachMs }), page.click("#stPlus")]);
        await chooser.setFiles(file);
        const landed = await until(page, (s) => s.attached === 1 && s.strip >= 1, attachMs);
        r.attached = landed.ok;
        if (!landed.ok) { stop(`step ${n}`, "the file never landed in the attachment strip — nothing was sent"); await shot(page, `ui-step-${n}`); break; }
      }
      await page.fill("#stRevise", step.say);
      const typed = await page.evaluate(readComposerInPage);
      if (typed.value !== step.say) { stop(`step ${n}`, "the words did not land in the message box — nothing was sent"); break; }
      // ── THE FRESH BASELINE, IMMEDIATELY BEFORE THE FIRST MESSAGE ──────────
      // The condition probe first, then the page a visitor sees, then both
      // database readers last, so nothing but the budget's balance read stands
      // between the baseline and the Send. It is where the test must start: the
      // target row must be the one named and read exactly `from` on both
      // readers, and the page must show it at `shown.before` — or nothing is
      // sent.
      if (spec && n === 1) {
        // FIRST, WHETHER THE RECOVERY CAN BE CONDITIONAL AT ALL — asked with a
        // write no row can meet, so it changes nothing. A Worker that cannot
        // enforce a write's condition could not put the value back safely, so
        // a paid run is never sent on one; a rehearsal reports it.
        rec.row.capability = await conditionProbe(rows, spec);
        const before = rec.row.shown.before = await shown();
        before.verdict = before.ok && before.target.includes(spec.shown.before) ? { ok: true } : { ok: false, why: before.ok ? "wrong-price" : before.why };
        rec.row.baseline = await readBoth(rows);
        rec.row.baselineVerdict = baselineVerdict(rec.row.baseline, spec);
        if (rec.row.baseline.pub.ok) {
          const d = rowDiff(spec.record, rec.row.baseline.pub.rows);
          rec.row.record = { same: !d.changed.length && !d.added.length && !d.gone.length, diff: d };
        }
        if (!rec.row.baselineVerdict.ok) {
          stop("baseline", `the row is not where this test starts (${rec.row.baselineVerdict.why}${rec.row.baselineVerdict.detail ? ": " + rec.row.baselineVerdict.detail : ""}) — nothing was sent`);
          break;
        }
        if (!before.verdict.ok) { stop("baseline", `the ${spec.shown.path} page does not show ${spec.match.name} at ${spec.shown.before} (${before.verdict.why}) — nothing was sent`); break; }
        // What the recovery would write against this baseline, decided now:
        // with nothing sent it must be nothing at all.
        rec.row.planAtBaseline = restorePlan(rec.row.baseline.owner.rows, spec, rec.row.baselineVerdict.raw);
        if (spend && !rec.row.capability.ok) {
          stop("condition", `${rec.row.capability.detail || rec.row.capability.why} — nothing was sent`);
          break;
        }
      }
      if (!spend) {
        await shot(page, `ui-step-${n}-rehearsal`);
        stop("rehearsal", `spend is not yes: message ${n} is typed${step.attach ? " with its file attached" : ""} and NOT sent`);
        break;
      }
      const bal = await balanceNow();
      r.balanceBefore = bal;
      const over = budgetRefusal({ start: rec.balance.start, now: bal, budget: scenario.budget });
      if (over) { stop(`step ${n}`, `${over} — nothing more is sent`); break; }

      const before = typed.messages.length;
      const netFrom = rec.network.length;
      const sentAt = Date.now();
      await page.click("#stSend");
      rec.sent++;
      r.sent = true;
      const started = await until(page, (s) => s.busy === true || s.stop || newReplies(before, s.messages).length > 0, startMs);
      r.startedMs = started.ok ? Date.now() - sentAt : null;
      const done = await until(page, (s) => composerReady(s) && newReplies(before, s.messages).length > 0, stepMs);
      r.ms = Date.now() - sentAt;
      await sleep(settleMs);
      const after = done.s || (await page.evaluate(readComposerInPage).catch(() => null));
      r.replies = after ? newReplies(before, after.messages).map((m) => m.text) : [];
      r.reply = r.replies.join("\n");
      r.composer = after ? { busy: after.busy, send: after.send, sendDisabled: after.sendDisabled, stop: after.stop, working: after.working, disabled: after.disabled, value: after.value } : null;
      r.network = rec.network.slice(netFrom);
      // EVERY JOB THE MESSAGE FILED, IN ORDER. An edit the route hands to
      // another layer is a second edit request with a job of its own, and
      // following only the first would read the chain and the money short.
      r.jobs = r.network
        .filter((e) => e.method === "POST" && /\/(edit|addon)$/.test(e.path) && e.res && typeof e.res.job === "string" && e.res.job)
        .map((e) => e.res.job);
      r.job = r.jobs[0] || "";
      r.completed = done.ok;
      if (!done.ok) {
        await shot(page, `ui-step-${n}`);
        const mins = Math.max(1, Math.round(stepMs / 60000));
        stop(`step ${n}`, `no reply with an idle composer inside ${mins} minute${mins === 1 ? "" : "s"} — the outcome is unknown, and nothing more is sent`);
        break;
      }
      // USABLE, NOT MERELY DRAWN: the box takes typing and Send is live.
      await page.fill("#stRevise", "x");
      const probe = await page.evaluate(readComposerInPage);
      r.usable = probe.value === "x" && composerReady(probe);
      await page.fill("#stRevise", "");
      r.balanceAfter = await balanceNow();
      await shot(page, `ui-step-${n}`);
      log(`  step ${n} (${Math.round(r.ms / 1000)} s): ${r.reply.split("\n")[0].slice(0, 160)}  | composer ${r.usable ? "usable again" : "NOT usable"}${r.job ? `  | job ${r.job}` : ""}`);
    }
    // ── WHAT THE MESSAGE DID TO THE ROW, AND PUTTING IT BACK ───────────────
    // Only once every message that was sent has its reply on screen: the job
    // behind a reply has finished, so its write, if any, has landed. A reply
    // that never came leaves the outcome unknown, and writing then could race
    // the job — so nothing is written, and the recovery run is named instead.
    if (spec && rec.row.baseline && spend) {
      const sentSteps = rec.steps.filter((s) => s.sent);
      if (!sentSteps.length) {
        rec.row.restore = { skipped: "nothing was sent, so there is nothing to put back" };
      } else if (!sentSteps.every((s) => s.completed)) {
        rec.row.restore = { skipped: `a reply never came, so whether the edit wrote the row is not known yet — once its job has finished, run the recovery scenario, which writes ${spec.field} back only if it reads ${spec.to}` };
      } else {
        const base = rec.row.baseline;
        const after = rec.row.after = await readBoth(rows);
        rec.row.change = after.owner.ok ? changeVerdict(base.owner.rows, after.owner.rows, spec) : null;
        rec.row.visitorChange = after.pub.ok ? changeVerdict(base.pub.rows, after.pub.rows, spec) : null;
        const edited = rec.row.shown.afterEdit = await shown();
        edited.verdict = rec.row.shown.before.ok && edited.ok
          ? shownVerdict(rec.row.shown.before.lines, edited.lines, spec, spec.shown.after)
          : { ok: false, why: edited.ok ? "no-before" : edited.why };
        rec.row.restore = await restoreRow({ spec, base, after, readers: rows, patch: rows.patch });
        const back = rec.row.shown.afterRestore = await shown();
        const same = JSON.stringify(back.lines) === JSON.stringify(rec.row.shown.before.lines);
        back.verdict = back.ok && same ? { ok: true, exact: true } : { ok: false, why: back.ok ? "differs-from-before" : back.why };
        log(`  row: ${rec.row.change ? (rec.row.change.exact ? "the one expected change" : "NOT exactly the expected change") : "UNREADABLE after the edit"}; recovery ${rec.row.restore.plan ? rec.row.restore.plan.act : "-"}${rec.row.restore.verdict ? (rec.row.restore.verdict.restored ? ", restored" : ", NOT restored") : ""}`);
      }
    }
    rec.balance.end = await balanceNow();
    return rec;
  } finally {
    await browser.close().catch(() => {});
  }
}

/** The account a person reads: each message, its reply, the composer, the money. */
export function describeUi(rec) {
  const out = [];
  const recovery = !!(rec.row && rec.row.recovery);
  out.push(recovery
    ? `UI MODE — a row recovery on site ${rec.slug}, no app and no message, ${rec.spend ? "WRITES" : "a dry run (nothing written)"}`
    : `UI MODE — ${rec.base}, site ${rec.slug}, ${rec.spend ? "PAID" : "rehearsal (nothing sent)"}`);
  if (!recovery) out.push(`  opened: ${rec.opened ? `signed in ${rec.opened.signedIn} as ${rec.opened.uid || "?"}${rec.opened.gate ? ", SIGN-IN GATE SHOWN" : ""}` : "no"}  card ${rec.card || "(none)"}`);
  for (const s of rec.steps) {
    out.push(`  ${s.n}. "${s.say}"${s.attach ? `  [attached ${s.attach}${s.file ? `, ${s.file.bytes} b, sha256 ${s.file.sha256.slice(0, 16)}` : ""}${s.attached === false ? ", DID NOT LAND" : ""}]` : ""}`);
    if (!s.sent) { out.push("     not sent"); continue; }
    out.push(`     reply (${Math.round((s.ms || 0) / 1000)} s): ${s.reply ? s.reply.replace(/\n/g, " / ") : "(none)"}`);
    out.push(`     composer after: ${s.usable ? "usable again (took typing, Send live)" : "NOT usable"}  ${JSON.stringify(s.composer)}`);
    const route = (s.network || []).find((e) => e.path === "/api/site/route" && e.res);
    if (route) out.push(`     routed: ${route.status} ${JSON.stringify({ intent: route.res.intent, layer: route.res.layer, page: route.res.page, cost: route.res.cost })}  attached=${route.req && route.req.attached}`);
    for (const post of (s.network || []).filter((e) => e.method === "POST" && /\/(edit|addon)$/.test(e.path))) {
      const job = post.res && typeof post.res.job === "string" ? post.res.job : "";
      out.push(`     ${post.path} -> ${post.status}${post.req && post.req.layer ? ` layer ${post.req.layer}` : ""}${job ? ` job ${job}` : ""}${post.req && post.req.images ? `  images ${JSON.stringify(post.req.images)}` : ""}`);
    }
    const fin = (s.network || []).filter((e) => e.final);
    if (fin.length) out.push(`     final reply: ${fin[fin.length - 1].status} ${JSON.stringify(fin[fin.length - 1].res).slice(0, 400)}`);
    if (Number.isFinite(s.balanceBefore) && Number.isFinite(s.balanceAfter)) out.push(`     balance ${s.balanceBefore} -> ${s.balanceAfter}`);
  }
  for (const b of rec.blocked || []) out.push(`  BLOCKED ${b.method} ${b.path}: ${b.why || "the page tried to start work this scenario never asks for"}`);
  if (rec.row && rec.row.spec) {
    out.push(rec.row.recovery ? describeRecovery(rec.row.recovery, rec.row.spec, { write: rec.spend, capability: rec.row.capability }) : describeRows(rec.row, rec.row.spec));
    if (rec.row.recovery) {
      for (const [k, label] of [["before", "before  "], ["afterRestore", "restored"]]) {
        const sh = rec.row.shown && rec.row.shown[k];
        if (sh) out.push(`  shown      ${label}  ${sh.ok ? sh.url + " (" + (sh.version || "?") + "): " + sh.target : "UNREADABLE (" + sh.why + ")"}${sh.verdict ? (sh.verdict.ok ? "  ok" : "  FAIL " + sh.verdict.why) : ""}`);
      }
    }
  }
  if (rec.stopped) out.push(`  STOPPED at ${rec.stopped.at}: ${rec.stopped.msg}`);
  out.push(recovery
    ? `  balance ${rec.balance.start} -> ${rec.balance.end}`
    : `  sent ${rec.sent} of ${rec.steps.length ? rec.steps.length : 0} reached; balance ${rec.balance.start} -> ${rec.balance.end}`);
  out.push(`  console errors ${rec.consoleErrors.length}, page errors ${rec.pageErrors.length}`);
  return out.join("\n");
}
