// GLOOPY'S BROWSER (owner, 2026-11-09: "look at the docs of grok bot and dots and start doing the stuff, lets start with
// tools first"). Both give their agent a browser on its own cloud computer, which stays signed in to sites and which the
// owner can watch and take over. This is Gloopy's: Playwright's Chromium with a profile of its own in Gloopy's home (so a
// site's sign-in stays), kept running on Gloopy's machine by a small local server (`serve`), because a page's numbered
// outline (Playwright's ariaSnapshot in "ai" mode: "button "Go" [ref=e5]") belongs to the page that made it. The browser
// tool (coder-tools.mjs, as the AI's own user) asks it for one action at a time; each answer is the page's title, its
// address, its outline and a screenshot. Gloopy never types into a password field: signing in is the owner's (a private
// login form comes next, as in Grok Bot and dots).
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, rm, open as openFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
export const PASSWORD_REFUSED = "that is a password field: you never type passwords. Ask the owner to sign in to this site themselves (say which site and why); a private sign-in form for this is coming.";
export const browserDir = (home) => join(home, ".gloopy-browser");
/** Said when the machine has no browser (Coder's small image, on Cloudflare's backup machines). */
export const NO_BROWSER = "there is no browser on this computer (it is a small backup machine): use your web search and web_fetch instead, and tell the owner the browser was not available.";

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

/** What was asked, checked: { action, url?, ref?, text?, submit?, key?, option?, direction? }; throws with what to fix. */
export function checkAsk(a) {
  const x = a && typeof a === "object" ? a : {};
  const action = String(x.action || "");
  if (!BROWSER_ACTIONS.includes(action)) throw new Error("action is one of: " + BROWSER_ACTIONS.join(", "));
  const out = { action };
  if (action === "open") out.url = pageAddress(x.url);
  if (["click", "type", "select"].includes(action)) {
    const ref = String(x.ref || "").trim();
    if (!REF_RE.test(ref)) throw new Error("give ref: the number of the element in the page's outline, like e12 or f2e12 (look first if you have no outline)");
    out.ref = ref;
  }
  if (action === "type") { if (typeof x.text !== "string") throw new Error("give text: what to type"); out.text = x.text.slice(0, 5000); out.submit = x.submit === true; }
  if (action === "press") { const key = String(x.key || "").trim(); if (!KEY_RE.test(key)) throw new Error("give key: one key like Enter, Escape, Tab, ArrowDown or PageDown (Control+A for a shortcut)"); out.key = key; }
  if (action === "select") { if (typeof x.option !== "string" || !x.option) throw new Error("give option: the choice to pick, as the outline shows it"); out.option = x.option.slice(0, 500); }
  if (action === "scroll") out.direction = x.direction === "up" ? "up" : "down";
  return out;
}

/** Playwright, from where the machine installed it (NODE_PATH; the image's global folder). */
function loadPlaywright() {
  const dirs = [...String(process.env.NODE_PATH || "").split(":"), "/opt/node22/lib/node_modules"].filter(Boolean);
  for (const d of dirs) { try { return createRequire(join(d, "noop.js"))("playwright"); } catch { /* not there */ } }
  return createRequire(import.meta.url)("playwright");
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
  const report = async (did) => {
    const title = await page.title().catch(() => "");
    let outline = await page.locator("body").ariaSnapshot({ mode: "ai", timeout: 10000 }).catch((e) => "(the page's outline could not be read: " + plainError(e, {}) + ")");
    let cut = "";
    if (outline.length > OUTLINE_MAX) { outline = outline.slice(0, OUTLINE_MAX); cut = "\n[the outline goes on past " + OUTLINE_MAX.toLocaleString("en-US") + " characters; the screenshot shows what is in view: scroll and look to see more]"; }
    const shot = await page.screenshot({ type: "jpeg", quality: 55, timeout: 10000 }).catch(() => null);
    const said = dialog ? "\nA dialog came up and was closed (" + dialog + ")." : "";
    dialog = "";
    return { text: "Did: " + did + "\nPage: " + (title || "(no title)") + "\nAddress: " + page.url() + said + "\n\n" + outline + cut, shot: shot ? shot.toString("base64") : "" };
  };
  const target = (ref) => page.locator("aria-ref=" + ref);
  // An element's name as a person would say it ("Go", "Search"), for the words of what was done.
  const nameOf = (ref) => target(ref).evaluate((n) => String(n.getAttribute("aria-label") || n.getAttribute("title") || n.innerText || n.getAttribute("placeholder") || n.getAttribute("name") || n.getAttribute("alt") || "").replace(/\s+/g, " ").trim().slice(0, 80), null, { timeout: 8000 }).catch(() => "");
  const quote = (t, max = 60) => "\u201c" + String(t).replace(/\s+/g, " ").trim().slice(0, max) + (String(t).length > max ? "\u2026" : "") + "\u201d";
  const run = async (ask) => {
    const name = ask.ref ? await nameOf(ask.ref) : "";
    const it = name ? quote(name) : ask.ref;
    const did = { open: "Opened " + ask.url, look: "Looked at the page", click: "Clicked " + it, type: "Typed " + quote(ask.text || "") + " into " + it, press: "Pressed " + ask.key, select: "Chose " + quote(ask.option || "") + " in " + it, scroll: "Scrolled " + ask.direction, back: "Went back" }[ask.action];
    if (ask.action === "open") await page.goto(ask.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    else if (ask.action === "click") await target(ask.ref).click({ timeout: 8000 });
    else if (ask.action === "type") {
      const el = target(ask.ref);
      const pw = await el.evaluate((n) => n instanceof HTMLInputElement && n.type === "password", null, { timeout: 8000 });
      if (pw) throw new Error(PASSWORD_REFUSED);
      await el.fill(ask.text, { timeout: 8000 });
      if (ask.submit) await el.press("Enter", { timeout: 8000 });
    } else if (ask.action === "press") await page.keyboard.press(ask.key);
    else if (ask.action === "select") await target(ask.ref).selectOption({ label: ask.option }, { timeout: 8000 }).catch(() => target(ask.ref).selectOption(ask.option, { timeout: 8000 }));
    else if (ask.action === "scroll") await page.mouse.wheel(0, ask.direction === "up" ? -700 : 700);
    else if (ask.action === "back") await page.goBack({ waitUntil: "domcontentloaded", timeout: 20000 });
    await settle();
    return report(did);
  };
  let last = Date.now(), busy = Promise.resolve();
  const sock = join(dir, "ctl.sock");
  await rm(sock, { force: true });
  const server = http.createServer((req, res) => {
    last = Date.now();
    let body = "";
    req.on("data", (c) => { if (body.length < 100_000) body += c; });
    req.on("end", () => {
      // One action at a time, in the order asked.
      busy = busy.then(async () => {
        let out;
        if (req.url === "/ping") out = { ok: true };
        else {
          let ask = null;
          try { ask = checkAsk(JSON.parse(body)); out = await run(ask); } catch (e) { out = { error: e && e.message === PASSWORD_REFUSED ? PASSWORD_REFUSED : plainError(e, ask || {}) }; }
        }
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

/**
 * ONE BROWSER ACTION (the browser tool): the browser is started the first time (in the background, as the AI's own
 * user), then asked. Answers { text, shot } (shot: a JPEG screenshot, base64), or throws with what went wrong.
 */
export async function browserAct(args, { home = process.env.HOME || "/tmp", timeoutMs = ACT_MS, startMs = START_MS } = {}) {
  const want = checkAsk(args);
  const dir = browserDir(home);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const sock = join(dir, "ctl.sock");
  let r = await ask(sock, "/act", want, timeoutMs);
  if (r && r.down) {
    try { loadPlaywright(); } catch { throw new Error(NO_BROWSER); }
    const log = await openFile(join(dir, "browser.log"), "a");
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", dir], { detached: true, stdio: ["ignore", log.fd, log.fd], env: process.env });
    child.unref();
    await log.close();
    const until = Date.now() + startMs;
    let up = false;
    while (!up && Date.now() < until) { await new Promise((ok) => setTimeout(ok, 300)); const p = await ask(sock, "/ping", {}, 2000); up = !!(p && p.ok); }
    if (!up) throw new Error("the browser could not be started on your computer (" + dir + "/browser.log says why)");
    r = await ask(sock, "/act", want, timeoutMs);
  }
  if (!r || r.down) throw new Error("the browser stopped answering");
  if (r.error) throw new Error(r.error);
  return { text: String(r.text || ""), shot: typeof r.shot === "string" ? r.shot : "" };
}

if (process.argv[1] && import.meta.url === "file://" + process.argv[1] && process.argv[2] === "serve") {
  serve(process.argv[3] || browserDir(process.env.HOME || "/tmp")).catch((e) => { console.error("gloopy browser: " + String((e && e.message) || e)); process.exit(1); });
}
