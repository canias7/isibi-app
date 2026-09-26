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

export const SESSION_KEY = "zephyr_session_v1";

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
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (route) await route(context);
    // Registered after any test route, so it is asked first; anything it does
    // not refuse falls back to that route, or to the network.
    await context.route((u) => u.origin === origin && u.pathname.startsWith("/api/site/"), async (r) => {
      const req = r.request();
      const u = new URL(req.url());
      if (!blocksPost(req.method(), u.pathname)) return r.fallback();
      rec.blocked.push({ ms: Date.now() - t0, method: req.method(), path: u.pathname });
      log(`  BLOCKED ${req.method()} ${u.pathname}: work this scenario never asks for`);
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
    rec.balance.end = await balanceNow();
    return rec;
  } finally {
    await browser.close().catch(() => {});
  }
}

/** The account a person reads: each message, its reply, the composer, the money. */
export function describeUi(rec) {
  const out = [];
  out.push(`UI MODE — ${rec.base}, site ${rec.slug}, ${rec.spend ? "PAID" : "rehearsal (nothing sent)"}`);
  out.push(`  opened: ${rec.opened ? `signed in ${rec.opened.signedIn} as ${rec.opened.uid || "?"}${rec.opened.gate ? ", SIGN-IN GATE SHOWN" : ""}` : "no"}  card ${rec.card || "(none)"}`);
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
  for (const b of rec.blocked || []) out.push(`  BLOCKED ${b.method} ${b.path}: the page tried to start work this scenario never asks for`);
  if (rec.stopped) out.push(`  STOPPED at ${rec.stopped.at}: ${rec.stopped.msg}`);
  out.push(`  sent ${rec.sent} of ${rec.steps.length ? rec.steps.length : 0} reached; balance ${rec.balance.start} -> ${rec.balance.end}`);
  out.push(`  console errors ${rec.consoleErrors.length}, page errors ${rec.pageErrors.length}`);
  return out.join("\n");
}
