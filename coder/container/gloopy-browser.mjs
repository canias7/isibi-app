// GLOOPY'S BROWSER (owner, 2026-11-09: "look at the docs of grok bot and dots and start doing the stuff, lets start with
// tools first"). Both give their agent a browser on its own cloud computer, which stays signed in to sites and which the
// owner can watch and take over. This is Gloopy's: Playwright's Chromium with a profile of its own (so a site's sign-in
// stays), kept running by a small local server (`serve`), because a page's numbered outline (Playwright's ariaSnapshot in
// "ai" mode: "button "Go" [ref=e5]") belongs to the page that made it.
//
// ITS OWN USER, DRIVEN ONLY BY CODER'S SERVICE (owner, 2026-11-09: "Ok do that", approvals and the private sign-in form):
// the browser runs as the machine's `gloopyweb` user, in a folder only that user can read, and its control socket is in
// that folder. The AI's commands run as `dev` (or in the admin sandbox, which does not see that folder), so they can
// neither drive the signed-in browser past the service's checks (approvals) nor read its sign-ins. The service asks it
// for one action at a time (makeBrowserHub); each answer is the page's title, its address, its outline and a screenshot.
// Two actions are the service's own and never the AI's: `describe` (what an element is, for the check before an action)
// and `fill` (the owner's sign-in, typed into the page from the private form; the AI never sees it). Whatever is in a
// password field is blanked out of every outline.
//
// THE OWNER WATCHES AND TAKES OVER (owner, 2026-11-09: "Ok you can start"; Grok Bot's "Open computer, Take control",
// dots' "Take over, Return control"): `screen` is the page as it is now, for the owner's live view (never the AI's), taken
// at once even while an action runs; the owner's own clicks, typing, keys, scrolling and Back (`input`) are the
// service's, sent only while the owner has control (server.mjs).
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, chownSync, chmodSync, openSync, closeSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const BROWSER_ACTIONS = Object.freeze(["open", "look", "click", "type", "press", "select", "scroll", "back"]);
/** The most of a page's outline one answer carries (a big page's goes on past it; the screenshot shows what is in view). */
export const OUTLINE_MAX = 20000;
export const VIEW = Object.freeze({ width: 1280, height: 800 });
/** How long one action may take, how long the browser may take to start, and after how long unused it closes itself. */
export const ACT_MS = 45_000, START_MS = 30_000, IDLE_MS = 30 * 60 * 1000;
const SETTLE_MS = 800;
/** Keys the browser presses: one key, with Control, Shift, Alt or Meta held if asked ("Control+A"). */
export const KEY_RE = /^(?:(?:Control|Shift|Alt|Meta)\+){0,3}(?:[A-Za-z0-9]|Enter|Escape|Tab|Backspace|Delete|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PageUp|PageDown|Home|End|F[1-9]|F1[0-2])$/;
// An element's number in the outline: e12, or f2e12 once the page has changed (Playwright numbers each new outline so).
export const REF_RE = /^(?:f\d{1,5})?e\d{1,6}$/;
export const PASSWORD_REFUSED = "that is a password field: you never type passwords. When a site needs the owner to sign in, use sign_in: the owner types the password into a private form and it goes straight into the page.";
/** Said when the machine has no browser (Coder's small image, on Cloudflare's backup machines). */
export const NO_BROWSER = "there is no browser on this computer (it is a small backup machine): use your web search and web_fetch instead, and tell the owner the browser was not available.";
/** What a password field holds, as every outline shows it. */
export const BLANKED = "••••••";
/** What the owner can do in the browser once they have taken over. */
export const OWNER_INPUTS = Object.freeze(["click", "type", "key", "scroll", "back"]);

/**
 * THE ADDRESS TO OPEN: http or https only (a bare name gets https://, a local one http://), never the machine's own
 * settings service (169.254.x.x, where clouds keep a machine's keys).
 */
export function pageAddress(raw) {
  let s = String(raw || "").trim();
  if (!s) throw new Error("give the address to open (url)");
  if (s.length > 4000) throw new Error("that address is too long");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = (/^(localhost|127\.|\[::1\])/i.test(s) ? "http://" : "https://") + s;
  let u;
  try { u = new URL(s); } catch { throw new Error("that is not a web address: " + String(raw).slice(0, 200)); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("only http and https pages open in the browser");
  if (/^169\.254\./.test(u.hostname) || u.hostname === "metadata.google.internal" || u.hostname === "metadata") throw new Error("that address is the machine's own settings service, which the browser never opens");
  return u.href;
}

const needRef = (x, field = "ref") => {
  const ref = String((x && x[field]) || "").trim();
  if (!REF_RE.test(ref)) throw new Error("give " + field + ": the number of the element in the page's outline, like e12 or f2e12 (look first if you have no outline)");
  return ref;
};

/** What the AI asked, checked: { action, url?, ref?, text?, submit?, key?, option?, direction? }; throws with what to fix. */
export function checkAsk(a) {
  const x = a && typeof a === "object" ? a : {};
  const action = String(x.action || "");
  if (!BROWSER_ACTIONS.includes(action)) throw new Error("action is one of: " + BROWSER_ACTIONS.join(", "));
  const out = { action };
  if (action === "open") out.url = pageAddress(x.url);
  if (["click", "type", "select"].includes(action)) out.ref = needRef(x);
  if (action === "type") { if (typeof x.text !== "string") throw new Error("give text: what to type"); out.text = x.text.slice(0, 5000); out.submit = x.submit === true; }
  if (action === "press") { const key = String(x.key || "").trim(); if (!KEY_RE.test(key)) throw new Error("give key: one key like Enter, Escape, Tab, ArrowDown or PageDown (Control+A for a shortcut)"); out.key = key; }
  if (action === "select") { if (typeof x.option !== "string" || !x.option) throw new Error("give option: the choice to pick, as the outline shows it"); out.option = x.option.slice(0, 500); }
  if (action === "scroll") out.direction = x.direction === "up" ? "up" : "down";
  return out;
}

/**
 * THE OWNER'S OWN INPUT, checked: a click at a point of the page (its pixels, as in the screenshot), text typed where the
 * focus is, one key, a scroll, or Back. Throws with what is wrong.
 */
export function checkInput(a) {
  const x = a && typeof a === "object" ? a : {};
  const kind = String(x.kind || "");
  if (!OWNER_INPUTS.includes(kind)) throw new Error("kind is one of: " + OWNER_INPUTS.join(", "));
  if (kind === "click") {
    const px = Number(x.x), py = Number(x.y);
    if (!Number.isFinite(px) || !Number.isFinite(py) || px < 0 || py < 0 || px >= VIEW.width || py >= VIEW.height) throw new Error("click inside the page");
    return { kind, x: Math.round(px), y: Math.round(py) };
  }
  if (kind === "type") { if (typeof x.text !== "string" || !x.text || x.text.length > 1000) throw new Error("type 1 to 1000 characters"); return { kind, text: x.text }; }
  if (kind === "key") { const key = String(x.key || ""); if (!KEY_RE.test(key)) throw new Error("that key cannot be pressed"); return { kind, key }; }
  if (kind === "scroll") { const dy = Math.round(Number(x.dy)); if (!Number.isFinite(dy) || !dy) throw new Error("scroll up or down"); return { kind, dy: Math.max(-3000, Math.min(3000, dy)) }; }
  return { kind };
}

/**
 * NOTHING IN A PASSWORD FIELD REACHES THE AI (found 2026-11-09: Playwright's outline shows a password field's value as
 * it shows any other's). Each value is blanked in the outline's line for that field, and anywhere else it appears.
 */
export function redactPasswords(text, values) {
  let out = String(text);
  for (const v of [...new Set((values || []).filter((x) => typeof x === "string" && x))]) out = out.split(v).join(BLANKED);
  return out;
}

/** Playwright, from where the machine installed it (NODE_PATH; the image's global folder). */
function loadPlaywright() {
  const dirs = [...String(process.env.NODE_PATH || "").split(":"), "/opt/node22/lib/node_modules"].filter(Boolean);
  for (const d of dirs) { try { return createRequire(join(d, "noop.js"))("playwright"); } catch { /* not there */ } }
  return createRequire(import.meta.url)("playwright");
}
/** Whether this machine has Playwright and its Chromium (only the full image does). */
export function hasBrowser() {
  try { const pw = loadPlaywright(); return existsSync(pw.chromium.executablePath()); } catch { return false; }
}

/** An error from Playwright, in a line the AI can act on. */
function plainError(e, ask) {
  const m = String((e && e.message) || e);
  if (/aria-ref|No node found|not found|resolved to 0 elements|strict mode violation/i.test(m) && ask.ref) return "the page changed since your last look: there is no " + ask.ref + " on it now. Look again (action look) and use a number from the new outline.";
  if (/Timeout \d+ms exceeded/.test(m)) return (ask.action === "open" || ask.action === "back" ? "the page took too long to load" : "the element did not respond in time (it may be hidden or covered: look again, scroll, or close what covers it)") + ".";
  if (/net::ERR_NAME_NOT_RESOLVED/.test(m)) return "no site has that address (the name could not be found).";
  if (/net::ERR_/.test(m)) return "the page could not be loaded (" + (/(net::ERR_[A-Z_]+)/.exec(m) || [])[1] + ").";
  return m.split("\n")[0].slice(0, 400);
}

/** THE BROWSER ITSELF, kept running (node gloopy-browser.mjs serve <dir>): answers POST /act on <dir>/ctl.sock. */
export async function serve(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const { chromium } = loadPlaywright();
  const ctx = await chromium.launchPersistentContext(join(dir, "profile"), { headless: true, viewport: VIEW, acceptDownloads: false });
  let page = ctx.pages()[0] || (await ctx.newPage());
  let dialog = "";
  const watch = (p) => p.on("dialog", (d) => { dialog = d.type() + ": " + String(d.message()).slice(0, 300); d.dismiss().catch(() => {}); });
  ctx.pages().forEach(watch);
  // A link that opens a new tab: the new tab is the page from then on.
  ctx.on("page", (p) => { watch(p); page = p; });
  const settle = async () => {
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
  };
  // What is in the page's password fields now, in every frame (to blank it out of what is reported).
  const passwords = async () => {
    const out = [];
    for (const f of page.frames()) { try { out.push(...(await f.evaluate(() => [...document.querySelectorAll("input[type=password]")].map((i) => i.value).filter(Boolean)))); } catch { /* a frame that went away */ } }
    return out;
  };
  const report = async (did) => {
    const title = await page.title().catch(() => "");
    let outline = await page.locator("body").ariaSnapshot({ mode: "ai", timeout: 10000 }).catch((e) => "(the page's outline could not be read: " + plainError(e, {}) + ")");
    outline = redactPasswords(outline, await passwords());
    let cut = "";
    if (outline.length > OUTLINE_MAX) { outline = outline.slice(0, OUTLINE_MAX); cut = "\n[the outline goes on past " + OUTLINE_MAX.toLocaleString("en-US") + " characters; the screenshot shows what is in view: scroll and look to see more]"; }
    const shot = await page.screenshot({ type: "jpeg", quality: 55, timeout: 10000 }).catch(() => null);
    const said = dialog ? "\nA dialog came up and was closed (" + dialog + ")." : "";
    dialog = "";
    return { text: "Did: " + did + "\nPage: " + (title || "(no title)") + "\nAddress: " + page.url() + said + "\n\n" + outline + cut, shot: shot ? shot.toString("base64") : "" };
  };
  const target = (ref) => page.locator("aria-ref=" + ref);
  // An element as a person would say it ("Go", "Search"), and what it is: for the words of what was done, and the check.
  const about = (ref) => target(ref).evaluate((n) => ({
    name: String(n.getAttribute("aria-label") || n.getAttribute("title") || n.innerText || n.value || n.getAttribute("placeholder") || n.getAttribute("name") || n.getAttribute("alt") || "").replace(/\s+/g, " ").trim().slice(0, 120),
    tag: n.tagName.toLowerCase(), type: String(n.getAttribute("type") || "").toLowerCase(), role: String(n.getAttribute("role") || ""),
    password: n instanceof HTMLInputElement && n.type === "password",
    form: !!(n.form || (n.closest && n.closest("form"))), formAction: String((n.form && n.form.action) || ""), href: String(n.href || ""),
  }), null, { timeout: 8000 });
  const quote = (t, max = 60) => "“" + String(t).replace(/\s+/g, " ").trim().slice(0, max) + (String(t).length > max ? "…" : "") + "”";
  const run = async (ask) => {
    const el = ask.ref ? await about(ask.ref) : null;
    const it = el && el.name ? quote(el.name) : ask.ref;
    const did = { open: "Opened " + ask.url, look: "Looked at the page", click: "Clicked " + it, type: "Typed " + quote(ask.text || "") + " into " + it, press: "Pressed " + ask.key, select: "Chose " + quote(ask.option || "") + " in " + it, scroll: "Scrolled " + ask.direction, back: "Went back" }[ask.action];
    if (ask.action === "open") await page.goto(ask.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    else if (ask.action === "click") await target(ask.ref).click({ timeout: 8000 });
    else if (ask.action === "type") {
      if (el.password) throw new Error(PASSWORD_REFUSED);
      await target(ask.ref).fill(ask.text, { timeout: 8000 });
      if (ask.submit) await target(ask.ref).press("Enter", { timeout: 8000 });
    } else if (ask.action === "press") await page.keyboard.press(ask.key);
    else if (ask.action === "select") await target(ask.ref).selectOption({ label: ask.option }, { timeout: 8000 }).catch(() => target(ask.ref).selectOption(ask.option, { timeout: 8000 }));
    else if (ask.action === "scroll") await page.mouse.wheel(0, ask.direction === "up" ? -700 : 700);
    else if (ask.action === "back") await page.goBack({ waitUntil: "domcontentloaded", timeout: 20000 });
    await settle();
    return report(did);
  };
  // THE SERVICE'S OWN: what an element is (none: the one with the focus), and where the page is.
  const describe = async (x) => {
    const ref = x.ref ? needRef(x) : "";
    const el = ref ? await about(ref) : await page.evaluate(() => { const n = document.activeElement; return n && n !== document.body ? { name: String(n.getAttribute("aria-label") || n.innerText || n.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 120), tag: n.tagName.toLowerCase(), type: String(n.getAttribute("type") || "").toLowerCase(), role: String(n.getAttribute("role") || ""), password: n instanceof HTMLInputElement && n.type === "password", form: !!(n.form || n.closest("form")), formAction: String((n.form && n.form.action) || ""), href: String(n.href || "") } : null; });
    let host = "";
    try { host = new URL(page.url()).host; } catch { host = ""; }
    return { element: el, url: page.url(), host, title: await page.title().catch(() => "") };
  };
  // THE OWNER'S SIGN-IN, from the private form: typed into the page here, then sent; never reported back.
  const fill = async (x) => {
    const passRef = needRef(x, "passRef"), userRef = x.userRef ? needRef(x, "userRef") : "", submitRef = x.submitRef ? needRef(x, "submitRef") : "";
    if (typeof x.password !== "string" || !x.password) throw new Error("no password was given");
    const pw = await about(passRef);
    if (!pw.password) throw new Error("the field asked for is not a password field");
    if (userRef) await target(userRef).fill(String(x.username || ""), { timeout: 8000 });
    await target(passRef).fill(x.password, { timeout: 8000 });
    if (submitRef) await target(submitRef).click({ timeout: 8000 }); else await target(passRef).press("Enter", { timeout: 8000 });
    await settle();
    // Still showing a password field (the site's form again, or the same one): the sign-in most likely did not go through.
    let still = false;
    for (const f of page.frames()) { try { if (await f.evaluate(() => [...document.querySelectorAll("input[type=password]")].some((i) => i.offsetParent !== null))) still = true; } catch { /* a frame that went away */ } }
    return { ok: true, url: page.url(), title: await page.title().catch(() => ""), still };
  };
  // THE OWNER'S LIVE VIEW: the page as it is now (a JPEG), with its address and title; nothing new when it has not changed
  // since the one they have (`since`). A moment when no picture can be taken (a page being loaded) gives none.
  const screen = async (x) => {
    const where = { url: page.url(), title: await page.title().catch(() => "") };
    const shot = await page.screenshot({ type: "jpeg", quality: 60, timeout: 5000 }).catch(() => null);
    if (!shot) return { ...where, same: true };
    const hash = createHash("sha1").update(shot).digest("hex").slice(0, 16);
    return x && x.since === hash ? { ...where, same: true, hash } : { ...where, hash, shot: shot.toString("base64"), w: VIEW.width, h: VIEW.height };
  };
  // THE OWNER'S OWN CLICKS, TYPING, KEYS, SCROLLING AND BACK, while they have control; then the page as it is.
  const input = async (x) => {
    const i = checkInput(x);
    if (i.kind === "click") await page.mouse.click(i.x, i.y);
    else if (i.kind === "type") await page.keyboard.type(i.text);
    else if (i.kind === "key") await page.keyboard.press(i.key);
    else if (i.kind === "scroll") await page.mouse.wheel(0, i.dy);
    else if (i.kind === "back") await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
    return screen({});
  };
  let last = Date.now(), busy = Promise.resolve();
  const sock = join(dir, "ctl.sock");
  await rm(sock, { force: true });
  const server = http.createServer((req, res) => {
    last = Date.now();
    let body = "";
    req.on("data", (c) => { if (body.length < 100_000) body += c; });
    req.on("end", () => {
      // The owner's live view is answered at once, even while an action runs.
      if (req.url === "/screen") {
        let x = {};
        try { x = JSON.parse(body || "{}"); } catch { x = {}; }
        screen(x).then((out) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out)); }, (e) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ error: plainError(e, {}) })); });
        return;
      }
      // One action at a time, in the order asked.
      busy = busy.then(async () => {
        let out, ask = null;
        try {
          const x = req.url === "/ping" ? null : JSON.parse(body || "{}");
          if (!x) out = { ok: true };
          else if (x.action === "describe") out = await describe(x);
          else if (x.action === "fill") out = await fill(x);
          else if (x.action === "input") out = await input(x);
          else { ask = checkAsk(x); out = await run(ask); }
        } catch (e) { out = { error: e && e.message === PASSWORD_REFUSED ? PASSWORD_REFUSED : plainError(e, ask || {}) }; }
        last = Date.now();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
      });
    });
  });
  const shutdown = async () => { clearInterval(idle); server.close(); await ctx.close().catch(() => {}); await rm(sock, { force: true }).catch(() => {}); process.exit(0); };
  const idle = setInterval(() => { if (Date.now() - last > IDLE_MS) shutdown(); }, 60_000);
  process.on("SIGTERM", shutdown);
  await new Promise((ok) => server.listen(sock, ok));
}

/** One request to the running browser, or { down: true } when none answers. */
function ask(sock, path, body, timeoutMs) {
  return new Promise((done) => {
    const req = http.request({ socketPath: sock, path, method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      let s = "";
      res.on("data", (c) => { s += c; });
      res.on("end", () => { try { done(JSON.parse(s)); } catch { done({ error: "the browser gave no answer" }); } });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); done({ error: "the browser took too long to answer" }); });
    req.on("error", () => done({ down: true }));
    req.end(JSON.stringify(body || {}));
  });
}

/** THE CHAT'S SMALL COPY OF A SCREENSHOT (a JPEG data URL, at most 320 pixels on a side), or "" (no ImageMagick). */
export function thumbOf(b64) {
  if (!b64) return "";
  const r = spawnSync("convert", ["jpeg:-", "-thumbnail", "320x320>", "-strip", "-quality", "70", "jpeg:-"], { input: Buffer.from(b64, "base64"), timeout: 10000, maxBuffer: 1 << 20 });
  const u = r.status === 0 && r.stdout && r.stdout.length ? "data:image/jpeg;base64," + r.stdout.toString("base64") : "";
  return u.length <= 60_000 ? u : "";
}

/** The browser's own environment: nothing of the service's (no keys), only what Chromium and Playwright need. */
export function browserEnv(dir, env = process.env) {
  return {
    HOME: dir, LANG: "C.UTF-8", PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    NODE_PATH: env.NODE_PATH || "/opt/node22/lib/node_modules",
    ...(env.PLAYWRIGHT_BROWSERS_PATH || existsSync("/opt/pw-browsers") ? { PLAYWRIGHT_BROWSERS_PATH: env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers" } : {}),
  };
}

/**
 * GLOOPY'S BROWSER, AS CODER'S SERVICE DRIVES IT: started the first time (as `uid`/`gid` when given: the machine's
 * `gloopyweb`), in `dir` (made here, only that user's). `act`: one of the AI's actions; `describe` and `fill`: the
 * service's own. Each answers what the browser said, or throws with what went wrong.
 */
export function makeBrowserHub({ dir, uid = null, gid = null, timeoutMs = ACT_MS, startMs = START_MS, env = process.env } = {}) {
  const sock = join(dir, "ctl.sock");
  const start = async () => {
    if (!hasBrowser()) throw new Error(NO_BROWSER);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (uid !== null) chownSync(dir, uid, gid ?? uid);
    chmodSync(dir, 0o700);
    const log = openSync(join(dir, "browser.log"), "a", 0o600);
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", dir], { detached: true, stdio: ["ignore", log, log], env: browserEnv(dir, env), ...(uid !== null ? { uid, gid: gid ?? uid } : {}) });
    child.unref();
    closeSync(log);
    const until = Date.now() + startMs;
    while (Date.now() < until) { await new Promise((ok) => setTimeout(ok, 300)); const p = await ask(sock, "/ping", {}, 2000); if (p && p.ok) return; }
    throw new Error("the browser could not be started (" + join(dir, "browser.log") + " says why)");
  };
  const call = async (body) => {
    let r = await ask(sock, "/act", body, timeoutMs);
    if (r && r.down) { await start(); r = await ask(sock, "/act", body, timeoutMs); }
    if (!r || r.down) throw new Error("the browser stopped answering");
    if (r.error) throw new Error(r.error);
    return r;
  };
  return {
    act: async (args) => { const r = await call(checkAsk(args)); const shot = typeof r.shot === "string" ? r.shot : ""; return { text: String(r.text || ""), shot, thumb: thumbOf(shot) }; },
    describe: (ref) => call({ action: "describe", ...(ref ? { ref } : {}) }),
    fill: ({ userRef = "", passRef, submitRef = "", username = "", password }) => call({ action: "fill", userRef, passRef, submitRef, username, password }),
    // Only when it is running already (no browser is started to be told nothing).
    running: async () => !!(await ask(sock, "/ping", {}, 2000)).ok,
    // THE OWNER'S LIVE VIEW: { shot, hash, url, title } (or { same: true } when unchanged since `since`); { off: true } when
    // the browser is not running (it is not started for a look).
    screen: async ({ since = "" } = {}) => { const r = await ask(sock, "/screen", { since: String(since || "").slice(0, 40) }, 10_000); if (r && r.down) return { off: true }; if (r && r.error) throw new Error(r.error); return r; },
    // THE OWNER TAKES OVER: the browser started if it is not running, then the page as it is.
    wake: async () => { const p = await ask(sock, "/ping", {}, 2000); if (!p || !p.ok) await start(); const r = await ask(sock, "/screen", {}, 10_000); if (r && (r.down || r.error)) throw new Error(r.error || "the browser stopped answering"); return r; },
    // The owner's own click, typing, key, scroll or Back; then the page as it is.
    input: (x) => call({ action: "input", ...checkInput(x) }),
  };
}

if (process.argv[1] && import.meta.url === "file://" + process.argv[1] && process.argv[2] === "serve") {
  serve(process.argv[3]).catch((e) => { console.error("gloopy browser: " + String((e && e.message) || e)); process.exit(1); });
}
