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
// PAYMENT CARDS (owner, 2026-11-09: "can we try both"): `fillCard` types the owner's card, from the private card form,
// into the page's card fields (each value only into a field for it, the card's own fields on one site). The AI never
// types into a card field; what is in one is blanked out of every outline and masked in every screenshot it gets.
//
// THE OWNER WATCHES AND TAKES OVER (owner, 2026-11-09: "Ok you can start"; Grok Bot's "Open computer, Take control",
// dots' "Take over, Return control"): `screen` is the page as it is now, for the owner's live view (never the AI's), taken
// at once even while an action runs; the owner's own clicks, typing, keys, scrolling and Back (`input`) are the
// service's, sent only while the owner has control (server.mjs).
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, chownSync, chmodSync, openSync, closeSync, readdirSync, lstatSync } from "node:fs";
import { mkdir, rm, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { cookieForSite, originForSite } from "./gloopy-check.mjs";
import { okZone } from "./gloopy-schedule.mjs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

export const BROWSER_ACTIONS = Object.freeze(["open", "look", "click", "type", "press", "select", "scroll", "back", "screenshot", "upload"]);
/**
 * "ARE YOU SURE?" (owner, 2026-11-10: "yes go ahead", fix 6): the steps that may be asked with confirm: true, which
 * answers OK when the page asks to confirm (a confirm box, or "Leave this page?"). Without it the page is answered Cancel
 * (it stays as it was), and the answer says so. A step with confirm is checked first, like a click.
 */
export const CONFIRM_ACTIONS = Object.freeze(["open", "click", "type", "press", "select", "back"]);
/**
 * DOWNLOADS (fix 2): saved by the browser, then put in Gloopy's work folder by Coder's service. At most DOWNLOAD_MAX
 * downloading at once (one bigger is stopped); a step waits for one it started up to DOWNLOAD_WAIT_MS.
 */
export const DOWNLOAD_MAX = 25 * 1024 * 1024, DOWNLOAD_WAIT_MS = 20_000;
/** UPLOADS (fix 3): a file from Gloopy's work folder, at most this big (as a file Gloopy sends the owner). */
export const UPLOAD_MAX = 5 * 1024 * 1024;
/** How long a file made ready to upload waits for the owner's OK on a card. */
export const STAGED_MS = 24 * 60 * 60 * 1000;
/** The most one request to the browser carries (a file to upload, as base64, in JSON). */
const BODY_MAX = 8 * 1024 * 1024;
/** SCREENSHOTS AS FILES (fix 1): PNG, or JPEG when a whole page's PNG would be bigger than this. */
export const SHOT_FILE_MAX = 8 * 1024 * 1024;
const STAGED_RE = /^u[0-9a-f]{12}$/;
/** A file's name from a site or a folder, safe to save: no folders, no hidden characters, no leading dot. */
export function fileNameOf(raw, fallback = "download") {
  const s = String(raw == null ? "" : raw).replace(/[\p{Cf}\p{Cc}]/gu, "").replace(/[\/\\]/g, "_").replace(/^[\s.]+/, "").trim().slice(0, 120).trim();
  return s || fallback;
}
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
/** Copy, cut and paste, which the AI's browser never does (2026-11-09). */
export const CLIPBOARD_KEY = /^(?:(?:Shift|Alt)\+)*(?:Control|Meta)\+(?:(?:Shift|Alt)\+)*(?:c|x|v|Insert)$|^(?:(?:Control|Alt)\+)*Shift\+(?:(?:Control|Alt)\+)*(?:Insert|Delete)$/i;
export const CLIPBOARD_REFUSED = "copy and paste aren't available in your browser: read the text from the outline, and type what you need with type.";
export const CARD_REFUSED = "that is a payment card field: you never type card details. At a checkout the owner asked for, use pay: the owner gives their card on a private form and it goes straight into the page.";
/**
 * A PAGE'S PAYMENT CARD FIELDS, in any frame (2026-11-09): the number, security code and expiry, by the words payment
 * forms give them (autocomplete cc-number, cc-csc, cc-exp; names like cardnumber, cvc, cvv), and any the service filled.
 */
export const CARD_FIELDS = ['input[autocomplete~="cc-number" i]', 'input[autocomplete~="cc-csc" i]', 'input[autocomplete~="cc-exp" i]', 'input[autocomplete~="cc-exp-month" i]', 'input[autocomplete~="cc-exp-year" i]', 'input[name*="cardnumber" i]', 'input[name*="card-number" i]', 'input[name*="card_number" i]', 'input[name*="ccnumber" i]', 'input[name*="cc-number" i]', 'input[name*="cvc" i]', 'input[name*="cvv" i]', 'input[name*="securitycode" i]', 'input[name*="security_code" i]', 'input[name*="verification_value" i]', 'input[id*="cardnumber" i]', 'input[id*="card-number" i]', 'input[id*="card_number" i]', 'input[id*="cvc" i]', 'input[id*="cvv" i]', 'input[data-fieldtype^="encrypted" i]', "[data-gloopy-card]"].join(", ");
/** Said when the machine has no browser (Coder's small image, on Cloudflare's backup machines). */
export const NO_BROWSER = "there is no browser on this computer (it is a small backup machine): use your web search and web_fetch instead, and tell the owner the browser was not available.";
/** What a password field holds, as every outline shows it. */
export const BLANKED = "••••••";
/**
 * What the owner can do in the browser once they have taken over: their own clicks, typing, keys, scrolling and Back;
 * since the second docs check (2026-11-10: dots' Take over gives "its mouse and keyboard", Grok Bot's "take control"),
 * also an address of their own, Forward, Reload, and a file from their own device when the page asks for one.
 */
export const OWNER_INPUTS = Object.freeze(["click", "type", "key", "scroll", "back", "forward", "reload", "open", "file"]);
/** How long a page's request for a file waits for the owner to pick one. */
export const CHOOSER_MS = 2 * 60 * 1000;
/** The live view's frames (2026-11-10): at most one every CAST_GAP_MS; stopped CAST_IDLE_MS after the last look; a look waits at most CAST_WAIT_MS for the next. */
export const CAST_GAP_MS = 150, CAST_IDLE_MS = 15_000, CAST_WAIT_MS = 8000;
/** Gloopy's helpers' own tabs (2026-11-10): at most LANES_MAX; one is closed LANE_IDLE_MS after its last step. */
export const LANES_MAX = 4, LANE_IDLE_MS = 5 * 60 * 1000;
/** TEACH A TASK (Grok Bot's: "records visible computer interaction for up to ten minutes"): at most this long, and steps. */
export const TEACH_MS = 10 * 60 * 1000, TEACH_STEPS = 100;

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

/**
 * What the AI asked, checked: { action, url?, ref?, text?, submit?, key?, option?, direction?, full?, staged?, confirm? };
 * throws with what to fix. `staged`: a file Coder's service made ready to upload (the AI gives its path; the service
 * reads it from the work folder). `keep`: the service's own (a step from a card: its downloads wait for the next step).
 */
export function checkAsk(a) {
  const x = a && typeof a === "object" ? a : {};
  const action = String(x.action || "");
  if (!BROWSER_ACTIONS.includes(action)) throw new Error("action is one of: " + BROWSER_ACTIONS.join(", "));
  const out = { action };
  if (action === "open") out.url = pageAddress(x.url);
  if (["click", "type", "select", "upload"].includes(action)) out.ref = needRef(x);
  if (action === "upload") {
    const id = String(x.staged || "");
    if (!STAGED_RE.test(id)) throw new Error("give path: the file in your work folder to upload");
    out.staged = id;
    // The button that then sends it, pressed in the same step (found live, 2026-11-10: choosing the file and pressing
    // Upload were two steps, so the owner OK'd one upload twice).
    if (x.submit_ref) out.submit_ref = needRef(x, "submit_ref");
  }
  if (action === "screenshot") out.full = x.full === true;
  if (x.confirm === true && CONFIRM_ACTIONS.includes(action)) out.confirm = true;
  if (x.keep === true) out.keep = true;
  if (action === "type") { if (typeof x.text !== "string") throw new Error("give text: what to type"); out.text = x.text.slice(0, 5000); out.submit = x.submit === true; }
  if (action === "press") {
    const key = String(x.key || "").trim();
    if (!KEY_RE.test(key)) throw new Error("give key: one key like Enter, Escape, Tab, ArrowDown or PageDown (Control+A for a shortcut)");
    // NO COPY AND PASTE (2026-11-09): what is in a card field could be copied out of it into a box anyone can read.
    if (CLIPBOARD_KEY.test(key)) throw new Error(CLIPBOARD_REFUSED);
    out.key = key;
  }
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
  if (kind === "open") return { kind, url: pageAddress(x.url) };
  if (kind === "file") {
    const name = fileNameOf(x.name, "");
    if (!name || typeof x.data !== "string" || !/^[A-Za-z0-9+/]*=*$/.test(x.data) || !x.data) throw new Error("choose a file");
    if (Math.floor((x.data.length * 3) / 4) > UPLOAD_MAX + 3) throw new Error("the file is over " + UPLOAD_MAX / 1048576 + " MB");
    return { kind, name, data: x.data };
  }
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

/**
 * NOTHING IN A PAYMENT CARD FIELD REACHES THE AI (2026-11-09): a card number is blanked wherever it shows, however it is
 * spaced; a security code or an expiry (a few digits, which elsewhere are other things) in its field's own line.
 */
export function redactCards(text, values) {
  let out = String(text);
  const short = new Set();
  for (const v of [...new Set((values || []).filter((x) => typeof x === "string" && x.trim()))]) {
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 12) {
      const spaced = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
      const amex = digits.length === 15 ? digits.replace(/^(\d{4})(\d{6})(\d{5})$/, "$1 $2 $3") : "";
      for (const form of [v, v.trim(), digits, spaced, spaced.replace(/ /g, "-"), amex].filter(Boolean)) out = out.split(form).join(BLANKED);
    } else short.add(v.trim());
  }
  if (!short.size) return out;
  // In any line that holds only that ("- textbox "CVC" [ref=e5]: 123", "- text: 123" under a field with a placeholder, a
  // card picture's "- generic [ref=f1e9]: 123"); the same few digits inside other words are other things.
  return out.split("\n").map((line) => {
    const m = /^(\s*- (?:[^\n]*\]|text|[a-z]+)): "?(.*?)"?$/.exec(line);
    return m && short.has(m[2]) ? m[1] + ": " + BLANKED : line;
  }).join("\n");
}

/**
 * Playwright, from where the machine installed it (NODE_PATH; the image's global folder), told where the image keeps
 * its Chromium (/opt/pw-browsers) before it is first loaded: Playwright reads that once, and Coder's service is not
 * started with it set (live test on the test copy, 2026-11-10: Gloopy's browser was "not on this computer" on Fly.io,
 * though Chromium was there).
 */
function loadPlaywright() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("/opt/pw-browsers")) process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
  const dirs = [...String(process.env.NODE_PATH || "").split(":"), "/opt/node22/lib/node_modules"].filter(Boolean);
  for (const d of dirs) { try { return createRequire(join(d, "noop.js"))("playwright"); } catch { /* not there */ } }
  return createRequire(import.meta.url)("playwright");
}
/** Whether this machine has Playwright and its Chromium (only the full image does). */
export function hasBrowser() {
  try { const pw = loadPlaywright(); return existsSync(pw.chromium.executablePath()); } catch { return false; }
}

/**
 * An error from Playwright, in a line the AI can act on. Its call log names the element ("aria-ref=e12") whatever went
 * wrong (found 2026-11-10: a click on a covered button said "the page changed since your last look", so Gloopy would look
 * and try the same again): a number no longer on the page is one the log never found; one in front is said so.
 */
export function plainError(e, ask) {
  const m = String((e && e.message) || e);
  const first = m.split("\n")[0];
  const gone = /No node found|resolved to 0 elements|strict mode violation|no element for that number/i.test(m) || (/Timeout \d+ms exceeded/.test(first) && /waiting for locator\('aria-ref=/.test(m) && !/locator resolved to/.test(m));
  if (gone && ask.ref) return "the page changed since your last look: there is no " + ask.ref + " on it now. Look again (action look) and use a number from the new outline.";
  if (/intercepts pointer events/.test(m)) return "something on the page is in front of that element, so it could not be clicked: close what covers it (a pop-up, a cookie banner, a menu), scroll, or look again.";
  if (/Timeout \d+ms exceeded/.test(first)) return (ask.action === "open" || ask.action === "back" ? "the page took too long to load" : "the element did not respond in time (it may be hidden or covered: look again, scroll, or close what covers it)") + ".";
  if (/net::ERR_NAME_NOT_RESOLVED/.test(m)) return "no site has that address (the name could not be found).";
  if (/net::ERR_/.test(m)) return "the page could not be loaded (" + (/(net::ERR_[A-Z_]+)/.exec(m) || [])[1] + ").";
  return m.split("\n")[0].slice(0, 400);
}

/**
 * THE NAME THE BROWSER GIVES SITES (the owner, 2026-11-10: "Call it Chrome"): ordinary Chrome's for the version it is,
 * never "HeadlessChrome" (WhatsApp Web turned Gloopy's browser away for that word), in its user agent and in its client
 * hints (the brands a page reads, and the sec-ch-ua header), the brands as Chromium itself lists them for that version
 * (user_agent_utils.cc). Its automation flag (navigator.webdriver) is left as it is: the name changes; it doesn't hide
 * that it is automated. Null when the version can't be read (then the browser keeps its own name).
 */
export function chromeName(version, arch = process.arch) {
  const m = /(\d+)\.(\d+)\.(\d+)\.(\d+)/.exec(String(version || ""));
  if (!m) return null;
  const major = Number(m[1]), full = m.slice(1, 5).join(".");
  const chars = [" ", "(", ":", "-", ".", "/", ")", ";", "=", "?", "_"], versions = ["8", "99", "24"];
  const grease = { brand: "Not" + chars[major % 11] + "A" + chars[(major + 1) % 11] + "Brand", version: versions[major % 3] };
  const chromium = { brand: "Chromium", version: String(major) };
  const brands = major % 2 ? [chromium, grease] : [grease, chromium];
  return {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + major + ".0.0.0 Safari/537.36",
    secChUa: brands.map((b) => '"' + b.brand + '";v="' + b.version + '"').join(", "),
    metadata: { brands, fullVersionList: brands.map((b) => ({ brand: b.brand, version: b === chromium ? full : b.version + ".0.0.0" })), fullVersion: full, platform: "Linux", platformVersion: "", architecture: arch === "arm64" ? "arm" : "x86", model: "", mobile: false, bitness: "64", wow64: false },
  };
}

/** THE BROWSER ITSELF, kept running (node gloopy-browser.mjs serve <dir>): answers POST /act on <dir>/ctl.sock. */
export async function serve(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const { chromium } = loadPlaywright();
  // THE OWNER'S TIME ZONE (owner, 2026-11-10: "yes go ahead", fix 7): pages see the owner's own clock (a booking site's
  // times, "today"), as the owner's device says it (GLOOPY_TZ, from Coder's service); the machine's (UTC) otherwise.
  const zone = okZone(process.env.GLOOPY_TZ || "") ? process.env.GLOOPY_TZ : "";
  // DOWNLOADS (fix 2) land in a folder of the browser's own, then go to Gloopy's work folder through Coder's service.
  const dlDir = join(dir, "downloads"), upDir = join(dir, "uploads");
  await rm(dlDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(dlDir, { recursive: true, mode: 0o700 });
  // Its name: ordinary Chrome's (see chromeName), for every page from its first request (new tabs too).
  const name = (() => { try { return chromeName(spawnSync(chromium.executablePath(), ["--version"], { timeout: 10_000 }).stdout); } catch { return null; } })();
  const ctx = await chromium.launchPersistentContext(join(dir, "profile"), { headless: true, viewport: VIEW, acceptDownloads: true, downloadsPath: dlDir, ...(zone ? { timezoneId: zone } : {}), ...(name ? { userAgent: name.userAgent, extraHTTPHeaders: { "sec-ch-ua": name.secChUa } } : {}) });
  // A new tab's first page runs before its brands can be set (see watch): there, and only while they still say
  // "HeadlessChrome", the page reads Chrome's own list too.
  if (name) await ctx.addInitScript(([brands, full]) => {
    try {
      const d = navigator.userAgentData;
      if (!d || !d.brands.some((b) => /Headless/.test(b.brand))) return;
      const p = Object.getPrototypeOf(d), copy = (l) => l.map((b) => ({ brand: b.brand, version: b.version }));
      const high = p.getHighEntropyValues, json = p.toJSON;
      Object.defineProperty(p, "brands", { get: () => copy(brands), configurable: true });
      p.getHighEntropyValues = function (hints) { return high.call(this, hints).then((v) => ({ ...v, brands: copy(brands), ...(v.fullVersionList ? { fullVersionList: copy(full) } : {}) })); };
      p.toJSON = function () { return { ...json.call(this), brands: copy(brands) }; };
    } catch { /* not a page that has them */ }
  }, [name.metadata.brands, name.metadata.fullVersionList]).catch(() => {});
  // ITS SIGN-INS, BACK ON A NEW COMPUTER (the audit, 2026-11-10): the copy Coder's Worker kept (cookies, and each site's
  // local storage), left here by Coder's service before the browser first started on this disk, then gone.
  await restoreState(ctx, join(dir, RESTORE_FILE)).catch(() => {});
  let page = ctx.pages()[0] || (await ctx.newPage());
  // A PAGE'S OWN QUESTIONS (fix 6): a message (alert) is closed with OK; "Are you sure?" (confirm) and "Leave this page?"
  // (beforeunload) are answered OK only for a step asked with confirm: true (`armed`, checked first) or the owner's own
  // input while they have control (`ownerHand`: their own click), else Cancel; a question that wants typed text (prompt)
  // is always cancelled. Each is said in the step's answer.
  let ownerHand = false;
  // GLOOPY'S HELPERS' OWN TABS (the owner, 2026-11-10: "all of it"; several browsers at once): a lane is a tab with its own
  // page and step-by-step state (the page's questions, a step armed to answer OK, a file being given, a page asking for a
  // file, its downloads, its queue). Lane 0 is Gloopy's own page, the one the owner watches and takes over; a helper's
  // lane is opened at its first step and closed when the helpers are done (or LANE_IDLE_MS after its last step). All the
  // lanes are tabs of this one browser, so the owner's sign-ins are theirs too.
  // DOWNLOADS (fix 2), per lane: the ones going, the ones done (waiting to be handed over) and what to say about the others.
  const laneState = () => ({ dialogs: [], armed: false, uploading: false, fileAsked: false, dl: { going: new Map(), ready: [], notes: [] }, busy: Promise.resolve(), last: Date.now() });
  const L0 = Object.assign(laneState(), { id: 0 });
  Object.defineProperty(L0, "page", { get: () => page, set: (p) => { page = p; } });
  const lanes = new Map();
  const laneOf = (p) => (p === page ? L0 : [...lanes.values()].find((L) => L.page === p) || null);
  const laneOpen = (k) => {
    const L = Object.assign(laneState(), { id: k, page: null, pages: new Set() });
    L.ready = ctx.newPage().then((p) => { watch(p); L.page = p; L.pages.add(p); });
    L.ready.catch(() => {});
    lanes.set(k, L);
    return L;
  };
  const laneDrop = async (k) => { const L = lanes.get(k); lanes.delete(k); if (!L) return; await L.ready.catch(() => {}); for (const p of L.pages) await p.close().catch(() => {}); };
  const lanesClose = async () => { const n = lanes.size; for (const k of [...lanes.keys()]) await laneDrop(k); return { ok: true, closed: n }; };
  // The helpers' tabs, for the owner's live view: which there are, and where each is.
  const lanesNow = () => Promise.all([...lanes.values()].filter((L) => L.page && !L.page.isClosed()).map(async (L) => ({ id: L.id, url: L.page.url(), title: await L.page.title().catch(() => "") })));
  const dl = L0.dl;
  const sizeNow = () => {
    let n = 0;
    try { for (const f of readdirSync(dlDir)) { try { n += lstatSync(join(dlDir, f)).size; } catch { /* gone */ } } } catch { /* no folder */ }
    return n - [L0, ...lanes.values()].reduce((sum, L) => sum + L.dl.ready.reduce((k, r) => k + r.size, 0), 0);
  };
  const onDownload = (d) => {
    const dl = (laneOf(d.page()) || L0).dl;
    const name = fileNameOf(d.suggestedFilename());
    const job = (async () => {
      let over = false;
      const timer = setInterval(() => { if (!over && sizeNow() > DOWNLOAD_MAX) { over = true; d.cancel().catch(() => {}); } }, 250);
      try {
        const failure = await d.failure();
        if (over) { dl.notes.push(quote(name) + " was stopped: downloads are at most " + DOWNLOAD_MAX / 1048576 + " MB"); return; }
        if (failure) { dl.notes.push(quote(name) + " did not download (" + String(failure).slice(0, 100) + ")"); return; }
        const path = await d.path();
        const size = (await stat(path)).size;
        if (size > DOWNLOAD_MAX) { dl.notes.push(quote(name) + " was not kept: downloads are at most " + DOWNLOAD_MAX / 1048576 + " MB"); await d.delete().catch(() => {}); return; }
        dl.ready.push({ name, size, path, d });
      } catch { dl.notes.push(quote(name) + " did not download"); } finally { clearInterval(timer); dl.going.delete(job); }
    })();
    dl.going.set(job, name);
  };
  const watched = new WeakSet();
  const watch = (p) => {
    if (watched.has(p)) return;
    watched.add(p);
    // Its brands, as a page reads them, said as ordinary Chrome's too (the user agent and the header are the context's).
    if (name) ctx.newCDPSession(p).then((s) => s.send("Emulation.setUserAgentOverride", { userAgent: name.userAgent, userAgentMetadata: name.metadata })).catch(() => {});
    p.on("dialog", (d) => {
      const type = d.type(), message = String(d.message()).replace(/\s+/g, " ").trim().slice(0, 300);
      const L = laneOf(p) || L0;
      const yes = type === "alert" || (["confirm", "beforeunload"].includes(type) && (L.armed || (L === L0 && ownerHand)));
      L.dialogs.push({ type, message, yes });
      (yes ? d.accept() : d.dismiss()).catch(() => {});
    });
    p.on("download", onDownload);
    // A PAGE ASKING FOR A FILE is always caught here (found 2026-11-10: one left to Chromium opens a box no one can see in
    // a headless browser, and blocks the next): the owner's own click gets a file prompt in their live view; Gloopy's
    // upload step gives its file; any other is said in the step's answer.
    p.on("filechooser", (fc) => { const L = laneOf(p) || L0; if (ownerHand && L === L0) chooser = { fc, at: Date.now(), multiple: fc.isMultiple() }; else if (!L.uploading) L.fileAsked = true; });
    // A link that opens a new tab: that tab is its lane's page from then on (Gloopy's own, or a helper's).
    p.on("popup", (np) => { watch(np); const L = laneOf(p); if (L) { L.page = np; if (L.pages) L.pages.add(np); } });
    // WHETHER THE PAGE CAME FROM A PLAIN ADDRESS (a GET), for the owner's Reload: a page a form sent (an order's "thank
    // you") is never reloaded by sending the form again (found in the live test, 2026-11-10: Playwright's reload sends it
    // again without asking, where a browser asks "Confirm Form Resubmission"). Restored from history, it isn't known.
    p.on("request", (r) => { try { if (r.isNavigationRequest() && r.frame() === p.mainFrame()) navAsked.set(p, { url: r.url(), get: r.method() === "GET" }); } catch { /* a request of no frame */ } });
    p.on("framenavigated", (f) => { if (f !== p.mainFrame()) return; const n = navAsked.get(p); plainPage.set(p, !!(n && n.get && n.url.split("#")[0] === f.url().split("#")[0])); navAsked.delete(p); });
  };
  const navAsked = new WeakMap(), plainPage = new WeakMap();
  ctx.pages().forEach(watch);
  // Every new tab is watched; one a link opened belongs to the lane it was opened from (see watch).
  ctx.on("page", (p) => watch(p));
  const settle = async (L = L0) => {
    await L.page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    await L.page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
    await L.page.waitForTimeout(SETTLE_MS);
  };
  // What is in the page's password fields and payment card fields now, in every frame (to blank it out of what is
  // reported), and the card numbers this browser typed (blanked wherever they show, for as long as it runs).
  const typedCards = new Set();
  // The codes the owner typed on the sign-in card (the audit, 2026-11-10): blanked as a card's few digits are, wherever a
  // field shows one again (a page that asks again with the code still in its box is a new page, not marked).
  const typedCodes = new Set();
  const secrets = async (L = L0) => {
    const passwords = [], cards = [...typedCards, ...typedCodes];
    for (const f of L.page.frames()) {
      try {
        const v = await f.evaluate((sel) => ({ p: [...document.querySelectorAll("input[type=password]")].map((i) => i.value).filter(Boolean), c: [...document.querySelectorAll(sel)].map((i) => i.value).filter(Boolean) }), CARD_FIELDS);
        passwords.push(...v.p); cards.push(...v.c);
      } catch { /* a frame that went away */ }
    }
    return { passwords, cards };
  };
  // MASKED IN EACH SCREENSHOT THE AI GETS (the owner's live view shows the page as it is): the card fields of every frame,
  // and any text that shows what is in them (a card picture beside the fields; a number however it is spaced).
  const cardMasks = (values, L = L0) => {
    const nums = [], shorts = new Set();
    for (const v of new Set(values)) { const d = v.replace(/\D/g, ""); if (d.length >= 12) nums.push(new RegExp(d.split("").join("[\\s-]?"))); else if (v.trim()) shorts.add(v.trim()); }
    const out = [];
    for (const f of L.page.frames()) {
      if (f.isDetached()) continue;
      out.push(f.locator(CARD_FIELDS));
      for (const re of nums) out.push(f.getByText(re));
      for (const t of shorts) out.push(f.getByText(t, { exact: true }));
    }
    return out;
  };
  // What the page asked during a step, in words (the site's own words quoted: data, never instructions).
  const asked = (L = L0) => L.dialogs.splice(0).map((g) => {
    const m = g.message ? " " + quote(g.message, 200) : "";
    if (g.type === "alert") return "The page showed a message" + m + ", closed with OK.";
    if (g.type === "prompt") return "The page asked for text" + m + "; it was cancelled (you can't answer those: tell the owner if it matters).";
    if (g.type === "beforeunload") return g.yes ? "The page asked whether to leave it (changes may not be saved); it was left." : "The page asked whether to leave it (changes may not be saved); it stayed. To leave anyway, do the step again with confirm: true.";
    return g.yes ? "The page asked" + m + " and it was answered OK." : "The page asked" + m + " and it was answered Cancel, so that most likely did nothing. If the owner wants it done, do the same step again with confirm: true (it is checked first).";
  });
  const report = async (did, { picture = null } = {}, L = L0) => {
    const page = L.page;
    const title = await page.title().catch(() => "");
    let outline = await page.locator("body").ariaSnapshot({ mode: "ai", timeout: 10000 }).catch((e) => "(the page's outline could not be read: " + plainError(e, {}) + ")");
    const hide = await secrets(L);
    outline = redactCards(redactPasswords(outline, hide.passwords), hide.cards);
    let cut = "";
    if (outline.length > OUTLINE_MAX) { outline = outline.slice(0, OUTLINE_MAX); cut = "\n[the outline goes on past " + OUTLINE_MAX.toLocaleString("en-US") + " characters; the screenshot shows what is in view: scroll and look to see more]"; }
    const shot = await page.screenshot({ type: "jpeg", quality: 55, timeout: 10000, mask: cardMasks(hide.cards, L), maskColor: "#9ca3af" }).catch(() => null);
    const said = asked(L).map((x) => "\n" + x).join("") + (L.fileAsked ? "\nThe page asked for a file: to give it one from your work folder, use upload (path, and ref: its file field or upload button)." : "");
    L.fileAsked = false;
    // Blanked in all of it, what was done too (a step's words name an element, never what is typed in it, but never trust that alone).
    const text = redactCards(redactPasswords("Did: " + did + "\nPage: " + (title || "(no title)") + "\nAddress: " + page.url() + said + "\n\n" + outline + cut, hide.passwords), hide.cards);
    // SCREENSHOTS AS FILES (fix 1): the page as a PNG (in view, or the whole page), masked as the AI's own screenshot is.
    let file = null;
    if (picture) {
      const take = (o) => page.screenshot({ fullPage: !!picture.full, timeout: 20000, mask: cardMasks(hide.cards, L), maskColor: "#9ca3af", ...o });
      let buf = await take({ type: "png" }), type = "png";
      if (buf.length > SHOT_FILE_MAX) { buf = await take({ type: "jpeg", quality: 80 }); type = "jpeg"; }
      if (buf.length > SHOT_FILE_MAX) throw new Error("the whole page is too long for one screenshot: take one of what is in view (without full), scrolling between them");
      file = { type, data: buf.toString("base64") };
    }
    return { text, shot: shot ? shot.toString("base64") : "", ...(file ? { picture: file } : {}) };
  };
  // DOWNLOADS HANDED OVER (fix 2): each one done, as base64 (then gone from here), and what to say about the others. A
  // step from a card (`keep`) hands over none: they wait for the next step (Coder's service asks at the next turn's start).
  const handOver = async (keep = false, L = L0) => {
    const dl = L.dl;
    const notes = dl.notes.splice(0);
    for (const name of dl.going.values()) notes.push(quote(name) + " is still downloading: it goes in your work folder when it is done (at your next step)");
    const downloads = [];
    if (keep) for (const r of dl.ready) notes.push(quote(r.name) + " was downloaded: it goes in your work folder at your next step");
    else {
      for (const r of dl.ready.splice(0)) {
        try { downloads.push({ name: r.name, size: r.size, data: (await readFile(r.path)).toString("base64") }); } catch { notes.push(quote(r.name) + " was downloaded but could not be read"); }
        await r.d.delete().catch(() => {});
      }
    }
    return { ...(downloads.length ? { downloads } : {}), ...(notes.length ? { downloadNotes: notes } : {}) };
  };
  // A FILE MADE READY TO UPLOAD (fix 3), by Coder's service: read by it from Gloopy's work folder (as `dev`, never
  // through a link), kept here (only this user's) for STAGED_MS, while a card waits and while the page may send it.
  const stage = async (x) => {
    const name = fileNameOf(x.name, "");
    if (!name || name !== String(x.name || "")) throw new Error("give the file's name");
    if (typeof x.data !== "string" || !/^[A-Za-z0-9+/]*=*$/.test(x.data)) throw new Error("give the file's data");
    const buf = Buffer.from(x.data, "base64");
    if (!buf.length) throw new Error("the file is empty");
    if (buf.length > UPLOAD_MAX) throw new Error("the file is over " + UPLOAD_MAX / 1048576 + " MB");
    await mkdir(upDir, { recursive: true, mode: 0o700 });
    await tidyUploads();
    const id = "u" + randomBytes(6).toString("hex");
    await mkdir(join(upDir, id), { mode: 0o700 });
    await writeFile(join(upDir, id, name), buf, { mode: 0o600, flag: "wx" });
    return { staged: id, name, size: buf.length };
  };
  const tidyUploads = async () => {
    for (const old of await readdir(upDir).catch(() => [])) {
      const st = await stat(join(upDir, old)).catch(() => null);
      if (!st || Date.now() - st.mtimeMs > STAGED_MS) await rm(join(upDir, old), { recursive: true, force: true }).catch(() => {});
    }
  };
  tidyUploads().catch(() => {});
  const stagedFile = async (id) => {
    const names = STAGED_RE.test(id) ? await readdir(join(upDir, id)).catch(() => []) : [];
    if (names.length !== 1) throw new Error("that file is no longer ready to upload (it waited over a day): upload it again (give its path)");
    return { path: join(upDir, id, names[0]), name: names[0] };
  };
  const target = (ref, L = L0) => L.page.locator("aria-ref=" + ref);
  // WHAT A FORM HOLDS NOW (the second docs check, 2026-11-10: dots' review "checks who will receive it and what the
  // message contains"; Grok Bot's card shows an action's inputs): the filled-in fields of the form the element is in (or
  // its dialog, or the nearest group of fields around it), for the check and the owner's card. Never a password or a
  // payment card field, nor one the service filled (a code); each value at most 300 characters, 15 fields in all.
  const FORM_JS = (start, cardSel) => {
    const isField = (n) => (n instanceof HTMLInputElement && !/^(hidden|submit|button|reset|image|password)$/i.test(n.type)) || n instanceof HTMLTextAreaElement || n instanceof HTMLSelectElement || (n instanceof HTMLElement && n.isContentEditable && !(n.parentElement && n.parentElement.isContentEditable));
    const all = (box) => [...box.querySelectorAll("input, textarea, select, [contenteditable]")];
    const c = start instanceof HTMLLabelElement && start.control ? start.control : start;
    if (!c || !(c instanceof Element)) return [];
    let box = c.form || c.closest("form") || c.closest("[role=dialog], [aria-modal=true], dialog");
    for (let n = c.parentElement, i = 0; !box && n && n !== document.body && i < 8; n = n.parentElement, i++) { const f = all(n); if (f.some(isField) && f.length <= 40) box = n; }
    if (!box) return [];
    const out = [];
    let total = 0;
    for (const f of all(box).filter(isField)) {
      if (out.length >= 15 || total > 1500) break;
      if (f.matches(cardSel) || f.closest("[data-gloopy-card]")) continue;
      const r = f.getBoundingClientRect();
      if (!r.width && !r.height && !(f instanceof HTMLInputElement && f.type === "file") && !(f instanceof HTMLSelectElement)) continue;
      let value = "";
      if (f instanceof HTMLInputElement && (f.type === "checkbox" || f.type === "radio")) { if (!f.checked) continue; value = "chosen"; }
      else if (f instanceof HTMLInputElement && f.type === "file") value = [...(f.files || [])].map((x) => x.name).join(", ");
      else if (f instanceof HTMLSelectElement) value = [...f.selectedOptions].map((o) => o.text).join(", ");
      else if (!(f instanceof HTMLInputElement) && !(f instanceof HTMLTextAreaElement)) value = f.innerText;
      else value = f.value;
      value = String(value || "").replace(/\s+/g, " ").trim();
      if (!value) continue;
      const labels = f.labels ? [...f.labels].map((l) => l.innerText).join(" ") : "";
      const label = String(f.getAttribute("aria-label") || labels || f.getAttribute("placeholder") || f.getAttribute("name") || f.id || f.getAttribute("type") || "field").replace(/\s+/g, " ").trim().slice(0, 60);
      const v = value.slice(0, 300) + (value.length > 300 ? "…" : "");
      out.push({ label, value: v });
      total += label.length + v.length;
    }
    return out;
  };
  const formOf = async (ref, L = L0) => {
    let raw = [];
    try { raw = await (ref ? target(ref, L) : L.page.locator(":focus").first()).evaluate(FORM_JS, CARD_FIELDS, { timeout: ref ? 5000 : 1000 }); } catch { raw = []; }
    if (!Array.isArray(raw) || !raw.length) return [];
    const hide = await secrets(L);
    return raw.map((f) => ({ label: redactCards(redactPasswords(String(f.label || ""), hide.passwords), hide.cards), value: redactCards(redactPasswords(String(f.value || ""), hide.passwords), hide.cards) }));
  };
  // GLOOPY'S LAST STEP, FOR THE OWNER'S LIVE VIEW (the second docs check: Grok Bot's preview shows "clicks, typing,
  // navigation"): what it did, and where on the page (the element's box, in the screenshot's pixels), for a while.
  let lastAct = null;
  // A PAGE ASKING THE OWNER FOR A FILE (their own click on a file field while they have control): kept for CHOOSER_MS.
  let chooser = null;
  // WHAT THE OWNER MARKED ON THE PAGE (dots' annotations: "Select the part of the page you want to discuss, add a comment,
  // and send it to your dot"): the words and controls inside a box of the page (the screenshot's pixels), never what is
  // in a password or card field. { url, title, text, items: [{ what, name }] }
  const area = async (x) => {
    const r = { x: Math.max(0, Math.round(Number(x.x) || 0)), y: Math.max(0, Math.round(Number(x.y) || 0)), w: Math.round(Number(x.w) || 0), h: Math.round(Number(x.h) || 0) };
    if (r.w < 4 || r.h < 4 || r.x >= VIEW.width || r.y >= VIEW.height) throw new Error("mark a part of the page");
    r.w = Math.min(r.w, VIEW.width - r.x); r.h = Math.min(r.h, VIEW.height - r.y);
    const got = await page.evaluate(([r, cardSel]) => {
      const items = [], texts = [];
      const hit = (b) => b.right > r.x && b.left < r.x + r.w && b.bottom > r.y && b.top < r.y + r.h;
      const centred = (b) => { const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2; return b.width > 0 && b.height > 0 && cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h; };
      // Its links, buttons, fields, pictures and headings: those whose middle is in the box and shows there (found all, not
      // sampled: a small link between the points tried was missed).
      const seen = (n, b) => { const top = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); return !!top && (top === n || n.contains(top) || top.contains(n)); };
      for (const n of document.querySelectorAll("a[href], button, [role=button], input:not([type=hidden]), textarea, select, img, h1, h2, h3, h4, h5, h6")) {
        if (items.length >= 20) break;
        const b = n.getBoundingClientRect();
        if (!centred(b) || !seen(n, b)) continue;
        const tag = n.tagName.toLowerCase();
        const what = tag === "a" ? "link" : tag === "button" || n.getAttribute("role") === "button" ? "button" : /^(input|textarea|select)$/.test(tag) ? "field" : tag === "img" ? "picture" : "heading";
        const secret = (n instanceof HTMLInputElement && n.type === "password") || (n.matches && n.matches(cardSel));
        const name = String(n.getAttribute("aria-label") || (n.labels && n.labels[0] && n.labels[0].innerText) || n.getAttribute("alt") || n.innerText || n.getAttribute("placeholder") || n.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 100);
        if (name) items.push({ what, name: secret ? name + " (its value is not shown)" : name });
      }
      // ITS WORDS: each piece of text whose line shows in the box, and is seen there (not under a pop-up). Never the whole
      // of an element that only reaches into it (live test, 2026-11-10: a paragraph flowing around a marked info box, its
      // box running under it, came whole).
      const range = document.createRange(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let len = 0;
      for (let t = tw.nextNode(), i = 0; t && i < 40000 && len < 1600; t = tw.nextNode(), i++) {
        const pe = t.parentElement, words = String(t.nodeValue || "").replace(/\s+/g, " ").trim();
        if (!words || !pe || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/.test(pe.tagName) || !hit(pe.getBoundingClientRect())) continue;
        range.selectNodeContents(t);
        const line = [...range.getClientRects()].find(centred);
        if (!line) continue;
        const top = document.elementFromPoint((line.left + line.right) / 2, (line.top + line.bottom) / 2);
        if (!top || !(top === pe || pe.contains(top) || top.contains(pe))) continue;
        texts.push(words); len += words.length + 1;
      }
      // Pieces joined as they read ("Tomatoes, mozzarella", not "Tomatoes , mozzarella").
      return { text: texts.join(" ").replace(/ ([,.;:!?%)\]])/g, "$1").replace(/([(\[]) /g, "$1").slice(0, 1500), items };
    }, [r, CARD_FIELDS]);
    const hide = await secrets();
    const clean = (t) => redactCards(redactPasswords(String(t || ""), hide.passwords), hide.cards);
    return { url: page.url(), title: await page.title().catch(() => ""), box: r, text: clean(got.text), items: got.items.map((it) => ({ what: it.what, name: clean(it.name) })) };
  };
  // TEACH A TASK (Grok Bot's "Teach a task": "demonstrate a browser workflow once and let the Bot turn it into a draft
  // skill"): while it is on, the owner's own steps are written down as they go (the element clicked, the field typed
  // into, the page), never a password or card details typed; at most TEACH_STEPS steps and TEACH_MS.
  let teach = null;
  const focusInfo = () => page.evaluate((cardSel) => { const n = document.activeElement; if (!n || n === document.body) return null; const labels = n.labels ? [...n.labels].map((l) => l.innerText).join(" ") : ""; return { name: String(n.getAttribute("aria-label") || labels || n.getAttribute("placeholder") || n.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 80), secret: (n instanceof HTMLInputElement && n.type === "password") || !!(n.matches && n.matches(cardSel)) || !!n.closest("[data-gloopy-card]") }; }, CARD_FIELDS).catch(() => null);
  const pointInfo = (x, y) => page.evaluate(([x, y]) => { let n = document.elementFromPoint(x, y); for (let i = 0; n && i < 4 && !/^(a|button|input|textarea|select|label|summary)$/i.test(n.tagName) && n.getAttribute("role") !== "button" && n.getAttribute("role") !== "link"; i++) n = n.parentElement; if (!n) return null; const tag = n.tagName.toLowerCase(); const labels = n.labels ? [...n.labels].map((l) => l.innerText).join(" ") : ""; return { name: String(n.getAttribute("aria-label") || labels || n.innerText || n.getAttribute("alt") || n.getAttribute("placeholder") || n.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 80), what: tag === "a" || n.getAttribute("role") === "link" ? "link" : tag === "button" || n.getAttribute("role") === "button" ? "button" : /^(input|textarea|select)$/.test(tag) ? "field" : "" }; }, [x, y]).catch(() => null);
  const teachWrite = async (i) => {
    if (!teach) return;
    if (teach.steps.length >= TEACH_STEPS || Date.now() - teach.at > TEACH_MS) { teach.full = true; return; }
    const prev = teach.steps[teach.steps.length - 1];
    let line = "";
    if (i.kind === "click") { const el = await pointInfo(i.x, i.y); line = "Clicked " + (el && el.name ? (el.what ? "the " + el.what + " " : "") + quote(el.name) : "at " + i.x + "," + i.y + " on the page"); }
    else if (i.kind === "type") {
      const f = await focusInfo();
      if (f && f.secret) { if (!(prev && prev.secret && prev.field === f.name)) teach.steps.push({ line: "Typed a password or card details" + (f.name ? " into " + quote(f.name) : "") + " (not kept)", secret: true, field: f.name, url: page.url() }); return; }
      const field = f ? f.name : "";
      if (prev && prev.typed !== undefined && prev.field === field && prev.url === page.url()) { prev.typed += i.text; prev.line = "Typed " + quote(prev.typed, 200) + (field ? " into " + quote(field) : ""); return; }
      teach.steps.push({ line: "Typed " + quote(i.text, 200) + (field ? " into " + quote(field) : ""), typed: i.text, field, url: page.url() });
      return;
    }
    else if (i.kind === "key") line = "Pressed " + i.key;
    else if (i.kind === "scroll") { const dir = i.dy > 0 ? "down" : "up"; if (prev && prev.scroll === dir) return; teach.steps.push({ line: "Scrolled " + dir, scroll: dir, url: page.url() }); return; }
    else if (i.kind === "back") line = "Went back";
    else if (i.kind === "forward") line = "Went forward";
    else if (i.kind === "reload") line = "Reloaded the page";
    else if (i.kind === "open") line = "Went to " + i.url;
    else if (i.kind === "file") line = "Gave the page a file (" + quote(i.name) + ")";
    if (line) teach.steps.push({ line, url: page.url() });
  };
  const teachOnOff = async (x) => {
    if (x.on === true) { teach = { at: Date.now(), steps: [], start: { url: page.url(), title: await page.title().catch(() => "") } }; return { teaching: true }; }
    const t = teach;
    teach = null;
    if (!t) return { teaching: false, steps: [] };
    const hide = await secrets();
    const clean = (s) => redactCards(redactPasswords(s, hide.passwords), hide.cards);
    // The steps, with the page each one was on when it changed.
    const lines = [];
    let at = "";
    for (const st of t.steps) { if (st.url && st.url !== at) { at = st.url; lines.push("On " + at + ":"); } lines.push(clean(st.line)); }
    return { teaching: false, start: t.start, steps: lines.slice(0, TEACH_STEPS + 40), full: !!t.full };
  };
  // An element as a person would say it ("Go", "Search"), and what it is: for the words of what was done, and the check.
  // NEVER WHAT WAS TYPED IN A FIELD (found 2026-11-09: a password field's name was its value, so "Clicked" on it after a
  // sign-in said the password): a field is named by its label, placeholder or name. A label stands for its field (typing
  // into a label types into its field). `card`: which part of a payment card a field is for (number, cvc, exp, month,
  // year, name), or "".
  // A number no longer on the page fails at once (not after the 8 seconds a wait would take).
  const about = async (ref, L = L0) => { if (!(await target(ref, L).count().catch(() => 0))) throw new Error("no element for that number: " + ref); return aboutOf(ref, L); };
  const aboutOf = (ref, L = L0) => target(ref, L).evaluate((n) => {
    const c = n instanceof HTMLLabelElement && n.control ? n.control : n;
    const field = (c instanceof HTMLInputElement && !/^(submit|button|reset|image)$/i.test(c.type)) || c instanceof HTMLTextAreaElement || c instanceof HTMLSelectElement;
    const labels = c.labels ? [...c.labels].map((l) => l.innerText).join(" ") : "";
    // A checkbox or a choice with no label of its own: the words beside it ("<input type=checkbox> checkbox 1": the live
    // test, 2026-11-10, said "Clicked f10e11").
    const beside = () => { const w = (s) => (!s ? "" : s.nodeType === 3 ? s.textContent : s.nodeType === 1 && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(s.tagName) ? s.textContent : ""); return String(w(c.nextSibling) || w(c.previousSibling) || "").replace(/\s+/g, " ").trim().slice(0, 80); };
    const name = n !== c ? n.innerText : field ? c.getAttribute("aria-label") || c.getAttribute("title") || labels || c.getAttribute("placeholder") || (/^(checkbox|radio)$/i.test(c.type) ? beside() : "") || c.getAttribute("name") || ""
      : n.getAttribute("aria-label") || n.getAttribute("title") || n.innerText || n.value || n.getAttribute("placeholder") || n.getAttribute("name") || n.getAttribute("alt") || "";
    const ac = String(c.getAttribute("autocomplete") || "").toLowerCase().split(/\s+/);
    const attrs = [c.getAttribute("name"), c.id, c.getAttribute("data-fieldtype"), c.getAttribute("data-elements-stable-field-name")].join(" ").toLowerCase();
    const words = [c.getAttribute("aria-label"), c.getAttribute("placeholder"), labels].join(" ").toLowerCase();
    const all = attrs + " " + words;
    const card = !field ? ""
      : ac.includes("cc-csc") || /cvc|cvv|\bcsc\b|securitycode|security_code|security-code|verification_value|encryptedsecuritycode/.test(attrs) || /\bcvc\b|\bcvv\b|\bcsc\b|card.?security|card.?verification/.test(words) ? "cvc"
      : ac.includes("cc-exp-month") || /exp\w*.?month|month.?exp/.test(all) ? "month"
      : ac.includes("cc-exp-year") || /exp\w*.?year|year.?exp/.test(all) ? "year"
      : ac.includes("cc-exp") || /exp-?date|expiry|expiration|encryptedexpiry/.test(attrs) || /expir|mm\s*\/\s*yy/.test(words) ? "exp"
      : ac.includes("cc-name") || /cardholder|card.?holder|name.?on.?card|nameoncard/.test(all) ? "name"
      : ac.includes("cc-number") || /cardnumber|card.?number|ccnumber|cc-number|creditcard|encryptedcardnumber/.test(attrs) || /card number|credit or debit card|\b\d{4} \d{4} \d{4} \d{4}\b/.test(words) ? "number"
      : "";
    return {
      name: String(name).replace(/\s+/g, " ").trim().slice(0, 120),
      tag: c.tagName.toLowerCase(), type: String(c.getAttribute("type") || "").toLowerCase(), role: String(c.getAttribute("role") || ""),
      password: c instanceof HTMLInputElement && c.type === "password", card,
      form: !!(c.form || (c.closest && c.closest("form"))), formAction: String((c.form && c.form.action) || ""), href: String(n.href || ""),
      // The site the element itself is on: its own frame's (a box from another site, framed in the page, is that site's).
      origin: String(window.origin || ""),
    };
  }, null, { timeout: 8000 });
  const siteOf = (origin) => { try { const u = new URL(origin); return /^https?:$/.test(u.protocol) ? u.host : ""; } catch { return ""; } };
  const quote = (t, max = 60) => "“" + String(t).replace(/\s+/g, " ").trim().slice(0, max) + (String(t).length > max ? "…" : "") + "”";
  // One of the AI's steps, done on the page.
  const step = async (ask, el, file, L = L0) => {
    const page = L.page, target_ = (ref) => target(ref, L);
    if (ask.action === "open") await page.goto(ask.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    else if (ask.action === "click") await target_(ask.ref).click({ timeout: 8000 });
    else if (ask.action === "type") {
      if (el.password) throw new Error(PASSWORD_REFUSED);
      if (["number", "cvc", "exp"].includes(el.card)) throw new Error(CARD_REFUSED);
      await target_(ask.ref).fill(ask.text, { timeout: 8000 });
      if (ask.submit) await target_(ask.ref).press("Enter", { timeout: 8000 });
    } else if (ask.action === "press") await page.keyboard.press(ask.key);
    else if (ask.action === "select") await target_(ask.ref).selectOption({ label: ask.option }, { timeout: 8000 }).catch(() => target_(ask.ref).selectOption(ask.option, { timeout: 8000 }));
    else if (ask.action === "scroll") await page.mouse.wheel(0, ask.direction === "up" ? -700 : 700);
    else if (ask.action === "back") await page.goBack({ waitUntil: "domcontentloaded", timeout: 20000 });
    else if (ask.action === "upload") {
      // A page's file field takes the file at once; a button that opens a file chooser is clicked, and the chooser given it.
      L.uploading = true;
      try {
        if (el && el.tag === "input" && el.type === "file") await target_(ask.ref).setInputFiles(file.path, { timeout: 8000 });
        else {
          const asked = page.waitForEvent("filechooser", { timeout: 8000 });
          asked.catch(() => {});
          await target_(ask.ref).click({ timeout: 8000 });
          const fc = await asked.catch(() => null);
          if (!fc) throw new Error("that did not open a file chooser: give the page's file field or its upload button (look again)");
          await fc.setFiles(file.path);
        }
      } finally { L.uploading = false; }
      if (ask.submit_ref) await target_(ask.submit_ref).click({ timeout: 8000 });
      // Kept (STAGED_MS): the page reads the file only when it sends it (found 2026-11-10: gone at once, the form failed).
    }
  };
  const run = async (ask, L = L0) => {
    const t0 = Date.now();
    const el = ask.ref ? await about(ask.ref, L) : null;
    // An element of no name is said by its kind, never by its number ("Clicked the checkbox", not "Clicked f10e11").
    const kind = (e) => (e.tag === "a" ? "the link" : e.tag === "button" || e.role === "button" || /^(submit|button|reset|image)$/.test(e.type) ? "the button" : e.type === "checkbox" ? "the checkbox" : e.type === "radio" ? "the choice" : e.tag === "select" ? "the list" : /^(input|textarea)$/.test(e.tag) ? "the field" : e.tag === "img" ? "the picture" : "");
    const it = el && el.name ? quote(el.name) : (el && kind(el)) || ask.ref;
    const file = ask.action === "upload" ? await stagedFile(ask.staged) : null;
    let did = { open: "Opened " + ask.url, look: "Looked at the page", click: "Clicked " + it, type: "Typed " + quote(ask.text || "") + " into " + it, press: "Pressed " + ask.key, select: "Chose " + quote(ask.option || "") + " in " + it, scroll: "Scrolled " + ask.direction, back: "Went back", screenshot: "Took a screenshot of " + (ask.full ? "the whole page" : "what is in view"), upload: "Uploaded " + quote(file ? file.name : "") + " with " + it }[ask.action];
    if (ask.action === "upload" && ask.submit_ref) { const b = await about(ask.submit_ref, L); did += " and clicked " + (b && b.name ? quote(b.name) : ask.submit_ref); }
    L.dialogs = [];
    L.fileAsked = false;
    // Where the step acts, for the owner's live view (before it acts: a click may take the element away).
    const box = ask.ref && L === L0 ? await target(ask.ref, L).boundingBox({ timeout: 2000 }).catch(() => null) : null;
    // Armed through the step and the wait after it (a page may ask a moment after the click).
    L.armed = ask.confirm === true;
    try {
      try { await step(ask, el, file, L); } catch (e) {
        // A file's own address (a PDF, an attachment): the browser downloads it instead of showing a page (found
        // 2026-11-10: the step failed with "Download is starting", though the file came).
        if (ask.action === "open" && /Download is starting/.test(String((e && e.message) || e))) did = "Opened " + ask.url + ": it is a file, so the browser downloaded it (the page is as it was)";
        // "Leave this page?" answered Cancel stops the page from going: that is the step's answer, not an error.
        else if (L.dialogs.some((g) => g.type === "beforeunload" && !g.yes)) did = "Stayed on the page (it asked whether to leave it)";
        else throw e;
      }
      await settle(L);
    } finally { L.armed = false; }
    if (L === L0 && ask.action !== "look" && ask.action !== "screenshot") {
      lastAct = { at: Date.now(), did, ...(box ? { box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } } : {}) };
      // The live view hears of the step at once, though the page may not have changed (a stream, live test 2026-11-10).
      wakeSoon();
    }
    // A download the step started: waited for a while (the step's answer comes within its time all the same).
    if (L.dl.going.size) await Promise.race([Promise.allSettled([...L.dl.going.keys()]), new Promise((ok) => setTimeout(ok, Math.max(0, Math.min(DOWNLOAD_WAIT_MS, 28_000 - (Date.now() - t0)))))]);
    const out = await report(did, { picture: ask.action === "screenshot" ? { full: ask.full } : null }, L);
    return { ...out, ...(await handOver(ask.keep === true, L)) };
  };
  // THE SERVICE'S OWN: what an element is (none: the one with the focus), and where the page is.
  const describe = async (x, L = L0) => {
    const page = L.page;
    const ref = x.ref ? needRef(x) : "";
    const el = ref ? await about(ref, L) : await page.evaluate(() => { const n = document.activeElement; return n && n !== document.body ? { name: String(n.getAttribute("aria-label") || n.innerText || n.getAttribute("name") || "").replace(/\s+/g, " ").trim().slice(0, 120), tag: n.tagName.toLowerCase(), type: String(n.getAttribute("type") || "").toLowerCase(), role: String(n.getAttribute("role") || ""), password: n instanceof HTMLInputElement && n.type === "password", form: !!(n.form || n.closest("form")), formAction: String((n.form && n.form.action) || ""), href: String(n.href || "") } : null; });
    let host = "";
    try { host = new URL(page.url()).host; } catch { host = ""; }
    // host: the page's; frameHost: the site of the element itself ("" for none: a frame with no web address of its own).
    const fields = el && (el.form || ref) ? await formOf(ref, L) : [];
    return { element: el, url: page.url(), host, frameHost: el && ref ? siteOf(el.origin) : host, title: await page.title().catch(() => ""), ...(fields.length ? { fields } : {}) };
  };
  // THE OWNER'S SIGN-IN, from the private form: typed into the page here, then sent; never reported back.
  const fill = async (x) => {
    const passRef = needRef(x, "passRef"), userRef = x.userRef ? needRef(x, "userRef") : "", submitRef = x.submitRef ? needRef(x, "submitRef") : "";
    if (typeof x.password !== "string" || !x.password) throw new Error("no password was given");
    const pw = await about(passRef);
    if (!pw.password) throw new Error("the field asked for is not a password field");
    // ONLY ON THE SITE THE LOGIN IS FOR (2026-11-09; as a browser's password manager): the password field itself must be
    // on that site, not in a box from another site framed in the page; the username field too.
    const on = siteOf(pw.origin);
    if (!x.site || on !== String(x.site)) throw new Error("the password field is not on " + (x.site || "the site") + " (it is on " + (on || "no site") + "), so nothing was typed");
    if (userRef && (await about(userRef)).origin !== pw.origin) throw new Error("the username field is not on the same site as the password field, so nothing was typed");
    if (userRef) await target(userRef).fill(String(x.username || ""), { timeout: 8000 });
    await target(passRef).fill(x.password, { timeout: 8000 });
    if (submitRef) await target(submitRef).click({ timeout: 8000 }); else await target(passRef).press("Enter", { timeout: 8000 });
    await settle();
    // Still showing a password field (the site's form again, or the same one): the sign-in most likely did not go through.
    let still = false;
    for (const f of page.frames()) { try { if (await f.evaluate(() => [...document.querySelectorAll("input[type=password]")].some((i) => i.offsetParent !== null))) still = true; } catch { /* a frame that went away */ } }
    return { ok: true, url: page.url(), title: await page.title().catch(() => ""), still };
  };
  // A CODE THE SITE SENT THE OWNER, from the private sign-in card (the audit, 2026-11-10; dots' sign-in card has a code
  // box): typed into the page's code field here, then sent; never reported back. Only into a field on that site (`site`);
  // the field (and a code split into one box per character, every box) is marked, so it stays masked and blanked.
  const fillCode = async (x) => {
    const codeRef = needRef(x, "codeRef"), submitRef = x.submitRef ? needRef(x, "submitRef") : "";
    const code = String(x.code || "").replace(/\s+/g, "");
    if (!/^[A-Za-z0-9-]{3,16}$/.test(code)) throw new Error("no code was given");
    const el = await about(codeRef);
    if (!["input", "textarea"].includes(el.tag) || /^(checkbox|radio|file|hidden|submit|button|reset|image|range|color)$/.test(el.type) || el.card) throw new Error("the field asked for is not one for a code, so nothing was typed");
    const on = siteOf(el.origin);
    if (!x.site || on !== String(x.site)) throw new Error("the code field is not on " + (x.site || "the site") + " (it is on " + (on || "no site") + "), so nothing was typed");
    typedCodes.add(code);
    const boxes = await target(codeRef).evaluate((n) => {
      const split = Number(n.maxLength) === 1;
      const all = split ? [...((n.form || n.parentElement || document).querySelectorAll("input"))].filter((i) => Number(i.maxLength) === 1) : [n];
      for (const i of all) i.setAttribute("data-gloopy-card", "code");
      return split ? all.length : 1;
    }).catch(() => 1);
    if (boxes > 1) { await target(codeRef).click({ timeout: 8000 }); await page.keyboard.type(code, { delay: 40 }); }
    else await target(codeRef).fill(code, { timeout: 8000 });
    if (submitRef) await target(submitRef).click({ timeout: 8000 }); else await page.keyboard.press("Enter");
    await settle();
    return { ok: true, url: page.url(), title: await page.title().catch(() => "") };
  };
  // THE OWNER'S CARD, from the private card form (2026-11-09): typed into the page's card fields here; never reported
  // back. Only on the page the owner was asked about (`site`); each value only into a field for it (the number into a
  // card number field, ...), and the card's number, expiry and security code into fields of one site (a payment form's
  // frames are its payment service's). The fields are marked, so they stay masked and blanked.
  const CARD_PARTS = { number: "card number", exp: "expiry date", month: "expiry month", year: "expiry year", cvc: "security code", name: "name on card", postal: "postal code" };
  const fillCard = async (x) => {
    const c = x.card && typeof x.card === "object" ? x.card : {};
    const digits = String(c.number || "").replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) throw new Error("no card number was given");
    let top = "";
    try { top = new URL(page.url()).host; } catch { top = ""; }
    if (!x.site || top !== String(x.site)) throw new Error("the browser is not on " + (x.site || "the site") + " any more (it is on " + (top || "no site") + "), so nothing was typed");
    const refs = {}, els = {};
    for (const k of Object.keys(CARD_PARTS)) if (x[k + "Ref"]) refs[k] = needRef(x, k + "Ref");
    if (!refs.number) throw new Error("give the card number field");
    for (const [k, ref] of Object.entries(refs)) els[k] = await about(ref);
    for (const [k, el] of Object.entries(els)) {
      const own = ["number", "exp", "month", "year", "cvc"].includes(k);
      if (own ? el.card !== k : el.password || ["number", "cvc", "exp"].includes(el.card) || !["input", "textarea"].includes(el.tag)) throw new Error("the field given for the " + CARD_PARTS[k] + " (" + refs[k] + ") is not one, so nothing was typed");
      if (own && el.origin !== els.number.origin) throw new Error("the " + CARD_PARTS[k] + " field is not on the same site as the card number field, so nothing was typed");
    }
    if (!siteOf(els.number.origin)) throw new Error("the card number field has no web address of its own, so nothing was typed");
    typedCards.add(digits);
    const mark = (ref) => target(ref).evaluate((n) => (n instanceof HTMLLabelElement && n.control ? n.control : n).setAttribute("data-gloopy-card", "1")).catch(() => {});
    // Typed at once; a field that formats as it is typed (a payment service's own) and kept nothing of it, key by key.
    const put = async (ref, value, check = "", own = true) => {
      if (own) await mark(ref);
      const loc = target(ref);
      await loc.fill(value, { timeout: 8000 });
      if (!check) return;
      const got = await loc.evaluate((n, want) => String((n instanceof HTMLLabelElement && n.control ? n.control : n).value || "").replace(/\D/g, "").endsWith(want), check);
      if (!got) { await loc.fill("", { timeout: 8000 }).catch(() => {}); await loc.pressSequentially(check, { delay: 25, timeout: 20000 }); }
    };
    const choose = async (ref, options) => {
      await mark(ref);
      for (const o of options) { try { await target(ref).selectOption(o, { timeout: 3000 }); return; } catch { /* written another way */ } }
      throw new Error("the " + CARD_PARTS[Object.keys(refs).find((k) => refs[k] === ref)] + " could not be chosen");
    };
    const month = Math.max(1, Math.min(12, Number(c.month) || 0)), year = Number(c.year) || 0;
    const mm = String(month).padStart(2, "0"), yy = String(year).slice(-2);
    await put(refs.number, digits, digits.slice(-4));
    if (refs.exp) await put(refs.exp, mm + "/" + yy, mm + yy);
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (refs.month) { if (els.month.tag === "select") await choose(refs.month, [mm, String(month), MONTHS[month - 1], MONTHS[month - 1].slice(0, 3), mm + " - " + MONTHS[month - 1]]); else await put(refs.month, mm, mm); }
    if (refs.year) { if (els.year.tag === "select") await choose(refs.year, [String(year), yy]); else await put(refs.year, String(year), yy); }
    if (refs.cvc) { const cvc = String(c.cvc || "").replace(/\D/g, ""); if (cvc) await put(refs.cvc, cvc, cvc); }
    if (refs.name && c.name) await put(refs.name, String(c.name).slice(0, 100), "", false);
    if (refs.postal && c.postal) await put(refs.postal, String(c.postal).slice(0, 12), "", false);
    await settle();
    return { ok: true, url: page.url(), title: await page.title().catch(() => ""), filled: Object.keys(refs) };
  };
  // THE LIVE VIEW'S FRAMES (the owner, 2026-11-10: "all of it"; both apps stream the screen): while someone watches,
  // Chromium sends a frame each time the page changes (its screencast), at most one every CAST_GAP_MS (the next comes
  // only once the last is acknowledged); it stops CAST_IDLE_MS after the last look. `newest` is the newest picture the
  // view could be given: a frame, or a screenshot taken when the page sent none.
  const cast = { s: null, page: null, last: 0, timer: null, starting: null, waiters: [] };
  let newest = { hash: "", shot: "", from: "", page: null };
  const wake = () => { for (const w of cast.waiters.splice(0)) w(); };
  // Waiting looks are woken at most once every CAST_GAP_MS (Chromium may send frames faster than they are acknowledged).
  let wokeAt = 0, wakeTimer = null;
  const wakeSoon = () => {
    const due = wokeAt + CAST_GAP_MS - Date.now();
    if (due <= 0) { wokeAt = Date.now(); wake(); }
    else if (!wakeTimer) wakeTimer = setTimeout(() => { wakeTimer = null; wokeAt = Date.now(); wake(); }, due);
  };
  const castStop = async () => {
    const s = cast.s;
    cast.s = null; cast.page = null;
    if (cast.timer) { clearInterval(cast.timer); cast.timer = null; }
    if (newest.from === "cast") newest = { hash: "", shot: "", from: "", page: null };
    wake();
    if (s) { await s.send("Page.stopScreencast").catch(() => {}); await s.detach().catch(() => {}); }
  };
  const castOn = async () => {
    cast.last = Date.now();
    if (cast.s && cast.page === page) return;
    if (!cast.starting) cast.starting = (async () => {
      await castStop();
      const p = page, s = await ctx.newCDPSession(p);
      cast.s = s; cast.page = p;
      s.on("Page.screencastFrame", ({ data, sessionId }) => {
        if (cast.s !== s) return;
        newest = { hash: createHash("sha1").update(data).digest("hex").slice(0, 16), shot: data, from: "cast", page: p };
        wakeSoon();
        setTimeout(() => { if (cast.s === s) s.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); }, CAST_GAP_MS);
      });
      await s.send("Page.startScreencast", { format: "jpeg", quality: 60, maxWidth: VIEW.width, maxHeight: VIEW.height });
      cast.timer = setInterval(() => { if (Date.now() - cast.last > CAST_IDLE_MS || cast.page !== page) castStop(); }, 2000);
    })().finally(() => { cast.starting = null; });
    await cast.starting;
  };
  // THE OWNER'S LIVE VIEW: the page as it is now (a JPEG), with its address and title; nothing new when it has not changed
  // since the one they have (`since`). Asked with `wait` (ms), a look that already has the newest picture waits for the
  // next frame (at most CAST_WAIT_MS): near-video while the page moves, one answer every few seconds while it doesn't.
  // A moment when no picture can be taken (a page being loaded) gives none.
  const screen = async (x) => {
    // A HELPER'S TAB (2026-11-10), for the owner to watch (it is never theirs to use): its page, as it is now.
    const others = await lanesNow();
    const lane = x && Number.isInteger(x.lane) && x.lane > 0 ? x.lane : 0;
    if (lane) {
      const L = lanes.get(lane);
      if (!L || !L.page || L.page.isClosed()) return { off: true, lane, lanes: others };
      const where = { url: L.page.url(), title: await L.page.title().catch(() => ""), lane, lanes: others };
      const shot = await L.page.screenshot({ type: "jpeg", quality: 60, timeout: 5000 }).catch(() => null);
      if (!shot) return { ...where, same: true };
      const hash = createHash("sha1").update(shot).digest("hex").slice(0, 16);
      return x.since === hash ? { ...where, same: true, hash } : { ...where, hash, shot: shot.toString("base64"), w: VIEW.width, h: VIEW.height };
    }
    const wait = Math.max(0, Math.min(CAST_WAIT_MS, Number(x && x.wait) || 0));
    if (wait) {
      try { await castOn(); } catch { /* a screenshot, as before */ }
      if (x.since && x.since === newest.hash && newest.page === page) await new Promise((ok) => { const t = setTimeout(ok, wait); cast.waiters.push(() => { clearTimeout(t); ok(); }); });
    }
    const last = lastAct && Date.now() - lastAct.at < 20_000 ? { did: lastAct.did, ...(lastAct.box ? { box: lastAct.box } : {}), ago: Date.now() - lastAct.at } : null;
    if (chooser && Date.now() - chooser.at > CHOOSER_MS) chooser = null;
    const where = { url: page.url(), title: await page.title().catch(() => ""), ...(last ? { last } : {}), ...(chooser ? { chooser: { multiple: chooser.multiple } } : {}), ...(teach ? { teaching: { steps: teach.steps.length, full: !!teach.full } } : {}), ...(others.length ? { lanes: others } : {}) };
    if (wait && newest.from === "cast" && newest.page === page && newest.hash) return x.since === newest.hash ? { ...where, same: true, hash: newest.hash } : { ...where, hash: newest.hash, shot: newest.shot, w: VIEW.width, h: VIEW.height };
    const shot = await page.screenshot({ type: "jpeg", quality: 60, timeout: 5000 }).catch(() => null);
    if (!shot) return { ...where, same: true };
    const hash = createHash("sha1").update(shot).digest("hex").slice(0, 16);
    if (wait) newest = { hash, shot: shot.toString("base64"), from: "shot", page };
    return x && x.since === hash ? { ...where, same: true, hash } : { ...where, hash, shot: shot.toString("base64"), w: VIEW.width, h: VIEW.height };
  };
  // THE OWNER'S OWN CLICKS, TYPING, KEYS, SCROLLING AND BACK, while they have control; then the page as it is. A page's
  // "Are you sure?" after their own click is answered OK (their click is their own decision; the live view cannot show
  // the box), and said with the page (`said`).
  const input = async (x) => {
    const i = checkInput(x);
    L0.dialogs = [];
    ownerHand = true;
    // A file field the owner clicks asks them for a file (the page shows no box of its own here: see watch).
    await teachWrite(i);
    try {
      if (i.kind === "click") await page.mouse.click(i.x, i.y);
      else if (i.kind === "type") await page.keyboard.type(i.text);
      else if (i.kind === "key") await page.keyboard.press(i.key);
      else if (i.kind === "scroll") await page.mouse.wheel(0, i.dy);
      else if (i.kind === "back") await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      else if (i.kind === "forward") await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      // A page not known to come from a plain address is opened again at its address: a form is never sent twice.
      else if (i.kind === "reload") await (plainPage.get(page) ? page.reload({ waitUntil: "domcontentloaded", timeout: 20000 }) : page.goto(page.url(), { waitUntil: "domcontentloaded", timeout: 20000 })).catch(() => {});
      else if (i.kind === "open") await page.goto(i.url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => { if (!/Download is starting/.test(String((e && e.message) || e))) throw e; });
      else if (i.kind === "file") {
        if (!chooser || Date.now() - chooser.at > CHOOSER_MS) { chooser = null; throw new Error("the page is not asking for a file now: click its file field or upload button first"); }
        const fc = chooser.fc;
        chooser = null;
        await fc.setFiles({ name: i.name, mimeType: "application/octet-stream", buffer: Buffer.from(i.data, "base64") });
      }
      await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(350);
    } finally { ownerHand = false; }
    const said = L0.dialogs.splice(0).map((g) => (g.type === "prompt" ? "The page asked for text and it was cancelled" : g.type === "beforeunload" ? "The page asked whether to leave it, and it was left" : g.type === "alert" ? "The page showed a message" : "The page asked to confirm, and it was answered OK") + (g.message ? ": " + quote(g.message, 200) : "") + ".").join(" ");
    return { ...(await screen({})), ...(said ? { said } : {}) };
  };
  let last = Date.now(), busy = Promise.resolve();
  const sock = join(dir, "ctl.sock");
  await rm(sock, { force: true });
  const server = http.createServer((req, res) => {
    last = Date.now();
    // The request, whole (a file to upload is several MB), or refused when bigger than BODY_MAX.
    const parts = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size <= BODY_MAX) parts.push(c); });
    req.on("end", () => {
      const body = size > BODY_MAX ? "" : Buffer.concat(parts).toString("utf8");
      if (size > BODY_MAX) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "that was too big for the browser" })); return; }
      // THE OWNER'S TIME ZONE CHANGED (fix 7): the browser stops (after what it is doing), for Coder's service to start it
      // again with the new one. Its sign-ins stay (they are on disk).
      if (req.url === "/quit") {
        busy = busy.then(async () => {
          clearInterval(idle);
          await ctx.close().catch(() => {});
          server.close();
          await rm(sock, { force: true }).catch(() => {});
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true }), () => process.exit(0));
        });
        return;
      }
      // The owner's live view is answered at once, even while an action runs.
      if (req.url === "/screen") {
        let x = {};
        try { x = JSON.parse(body || "{}"); } catch { x = {}; }
        screen(x).then((out) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out)); }, (e) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ error: plainError(e, {}) })); });
        return;
      }
      // A HELPER'S STEP (2026-11-10): in its own tab (lane), one at a time there, side by side with the other tabs'.
      let xl = 0;
      try { const x0 = JSON.parse(body || "{}"); xl = x0 && Number.isInteger(x0.lane) && x0.lane > 0 && x0.lane <= LANES_MAX ? x0.lane : 0; } catch { xl = 0; }
      if (xl && req.url !== "/ping") {
        const L = lanes.get(xl) || laneOpen(xl);
        L.busy = L.busy.then(async () => {
          let out, ask = null;
          try {
            await L.ready;
            const x = JSON.parse(body || "{}");
            if (x.action === "describe") out = await describe(x, L);
            else { ask = checkAsk(x); if (ask.action === "upload") throw new Error("a helper's tab can't upload files: say in your answer what should go where, and Gloopy will do it"); out = await run(ask, L); }
          } catch (e) { out = { error: e && [PASSWORD_REFUSED, CARD_REFUSED].includes(e.message) ? e.message : plainError(e, ask || {}) }; }
          L.last = last = Date.now();
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(out));
        });
        return;
      }
      // One action at a time, in the order asked.
      busy = busy.then(async () => {
        let out, ask = null;
        try {
          const x = req.url === "/ping" ? null : JSON.parse(body || "{}");
          if (!x) out = { ok: true, zone };
          else if (x.action === "describe") out = await describe(x);
          else if (x.action === "fill") out = await fill(x);
          else if (x.action === "fillCard") out = await fillCard(x);
          else if (x.action === "fillCode") out = await fillCode(x);
          else if (x.action === "state") out = await stateOf(ctx);
          else if (x.action === "signOut") out = await signOutOf(ctx, page, x);
          else if (x.action === "input") out = await input(x);
          else if (x.action === "stage") out = await stage(x);
          else if (x.action === "area") out = await area(x);
          else if (x.action === "teach") out = await teachOnOff(x);
          else if (x.action === "collect") out = await handOver(false);
          else if (x.action === "closeLanes") out = await lanesClose();
          else { ask = checkAsk(x); out = await run(ask); }
        } catch (e) { out = { error: e && [PASSWORD_REFUSED, CARD_REFUSED].includes(e.message) ? e.message : plainError(e, ask || {}) }; }
        last = Date.now();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(out));
      });
    });
  });
  const shutdown = async () => { clearInterval(idle); server.close(); await ctx.close().catch(() => {}); await rm(sock, { force: true }).catch(() => {}); process.exit(0); };
  const idle = setInterval(() => {
    if (Date.now() - last > IDLE_MS) return shutdown();
    // A helper's tab with nothing to do for a while is closed (its helper is long done).
    for (const [k, L] of lanes) if (Date.now() - L.last > LANE_IDLE_MS) laneDrop(k);
  }, 60_000);
  process.on("SIGTERM", shutdown);
  await new Promise((ok) => server.listen(sock, ok));
}

/** Where Coder's service leaves the copy of the browser's sign-ins for a new disk (read once, then gone). */
export const RESTORE_FILE = "restore.json";
/** The most of a copy of the sign-ins: cookies, and each site's local storage in all. */
export const STATE_COOKIES_MAX = 3000, STATE_STORAGE_MAX = 1024 * 1024;

/** What is kept of the browser's sign-ins: { cookies, origins: [{ origin, localStorage: [{ name, value }] }] }, within the limits. */
export async function stateOf(ctx) {
  const st = await ctx.storageState();
  const origins = [];
  let size = 0;
  for (const o of Array.isArray(st.origins) ? st.origins : []) {
    const n = JSON.stringify(o).length;
    if (size + n > STATE_STORAGE_MAX) continue;
    size += n; origins.push(o);
  }
  return { cookies: (Array.isArray(st.cookies) ? st.cookies : []).slice(0, STATE_COOKIES_MAX), origins };
}

/** The copy of the sign-ins put back (cookies at once; each site's local storage when a page of it opens, never over what is there), and the file gone. */
export async function restoreState(ctx, file) {
  let st;
  try { st = JSON.parse(await readFile(file, "utf8")); } finally { await rm(file, { force: true }).catch(() => {}); }
  if (!st || typeof st !== "object") return { cookies: 0 };
  const cookies = (Array.isArray(st.cookies) ? st.cookies : []).filter((c) => c && typeof c.name === "string" && typeof c.domain === "string").slice(0, STATE_COOKIES_MAX);
  if (cookies.length) await ctx.addCookies(cookies);
  const origins = (Array.isArray(st.origins) ? st.origins : []).filter((o) => o && typeof o.origin === "string" && Array.isArray(o.localStorage));
  if (origins.length) await ctx.addInitScript((list) => { const o = list.find((x) => x.origin === location.origin); if (!o) return; try { for (const { name, value } of o.localStorage) if (localStorage.getItem(name) === null) localStorage.setItem(name, value); } catch { /* storage not allowed here */ } }, origins);
  return { cookies: cookies.length };
}

/**
 * SIGNED OUT OF ONE SITE (the audit, 2026-11-10): its cookies (and its parent's it shares), one by one, and its pages'
 * own storage (local storage, databases, caches), only for the exact page addresses the browser has. Never a cookie by
 * Chromium's "clear this origin" (found 2026-11-10: given an address it could not place, like "https://www.127.0.0.1",
 * it cleared every site's cookies and storage).
 */
export async function signOutOf(ctx, page, x) {
  const site = String((x && x.site) || "").toLowerCase().trim();
  if (!/^[a-z0-9.-]+\.[a-z0-9-]+(:\d+)?$/.test(site)) throw new Error("give a site, like shop.example");
  const gone = (await ctx.cookies()).filter((c) => cookieForSite(c.domain, site));
  for (const c of gone) await ctx.clearCookies({ name: c.name, domain: c.domain, path: c.path });
  const st = await ctx.storageState().catch(() => ({ origins: [] }));
  const origins = [...new Set((st.origins || []).map((o) => String(o.origin || "")).filter((o) => /^https?:\/\/[^/\s]+$/.test(o) && originForSite(o, site)))];
  let cdp = null;
  try { cdp = origins.length ? await ctx.newCDPSession(page) : null; for (const origin of origins) await cdp.send("Storage.clearDataForOrigin", { origin, storageTypes: "local_storage,indexeddb,cache_storage,service_workers,file_systems,websql" }).catch(() => {}); } catch { /* not Chromium's own protocol */ } finally { if (cdp) await cdp.detach().catch(() => {}); }
  return { ok: true, site, cookies: gone.length, storage: origins.length };
}

/** Downloads in a browser's answer: the finished ones ({ name, size, data }) and what became of the others (words). */
function handed(r) {
  const downloads = (Array.isArray(r && r.downloads) ? r.downloads : []).filter((f) => f && typeof f.data === "string").map((f) => ({ name: fileNameOf(f.name), size: Number(f.size) || 0, data: f.data }));
  const notes = (Array.isArray(r && r.downloadNotes) ? r.downloadNotes : []).filter((x) => typeof x === "string").map((x) => x.slice(0, 300)).slice(0, 10);
  return { ...(downloads.length ? { downloads } : {}), ...(notes.length ? { downloadNotes: notes } : {}) };
}

/** One request to the running browser, or { down: true } when none answers. */
function ask(sock, path, body, timeoutMs) {
  return new Promise((done) => {
    const req = http.request({ socketPath: sock, path, method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      // Whole, then read (a download is several MB, and a character may be cut between two parts).
      const parts = [];
      res.on("data", (c) => { parts.push(c); });
      res.on("end", () => { try { done(JSON.parse(Buffer.concat(parts).toString("utf8"))); } catch { done({ error: "the browser gave no answer" }); } });
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
export function makeBrowserHub({ dir, uid = null, gid = null, timeoutMs = ACT_MS, startMs = START_MS, env = process.env, zone = "" } = {}) {
  const sock = join(dir, "ctl.sock");
  // The owner's time zone the browser is started with (fix 7).
  let want = okZone(zone) ? zone : "";
  const start = async () => {
    if (!hasBrowser()) throw new Error(NO_BROWSER);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (uid !== null) chownSync(dir, uid, gid ?? uid);
    chmodSync(dir, 0o700);
    const log = openSync(join(dir, "browser.log"), "a", 0o600);
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", dir], { detached: true, stdio: ["ignore", log, log], env: { ...browserEnv(dir, env), ...(want ? { GLOOPY_TZ: want } : {}) }, ...(uid !== null ? { uid, gid: gid ?? uid } : {}) });
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
    // One of the AI's steps: the page in words and a screenshot; with a screenshot step, the picture as a file
    // (`picture`: { type, data }); downloads it finished (`downloads`: [{ name, size, data }]) and what became of others.
    act: async (args, lane = 0) => {
      const r = await call({ ...checkAsk(args), ...(Number.isInteger(lane) && lane > 0 ? { lane } : {}) });
      const shot = typeof r.shot === "string" ? r.shot : "";
      return { text: String(r.text || ""), shot, thumb: thumbOf(shot), ...handed(r), ...(r.picture && typeof r.picture.data === "string" ? { picture: { type: r.picture.type === "jpeg" ? "jpeg" : "png", data: r.picture.data } } : {}) };
    },
    // A FILE TO UPLOAD (fix 3), made ready: { name, data } (base64, from the work folder) → { staged, name, size }.
    stage: ({ name, data }) => call({ action: "stage", name, data }),
    // Downloads finished since the last step (a step from a card, or the owner's own while they had control).
    collect: async () => handed(await call({ action: "collect" })),
    // GLOOPY'S HELPERS' OWN TABS (2026-11-10): closed when the helpers are done.
    closeLanes: () => call({ action: "closeLanes" }),
    // THE OWNER'S TIME ZONE (fix 7): kept for the next start; a browser running with another one is stopped (it starts
    // again at the next step, with its sign-ins). Never while the owner has control (Coder's service asks only then).
    setZone: async (z) => {
      if (!okZone(z)) return { zone: want };
      want = z;
      const p = await ask(sock, "/ping", {}, 2000);
      if (!p || !p.ok || String(p.zone || "") === want) return { zone: want };
      await ask(sock, "/quit", {}, 20_000);
      for (let i = 0; i < 50 && (await ask(sock, "/ping", {}, 1000)).ok; i++) await new Promise((ok) => setTimeout(ok, 200));
      return { zone: want, restarted: true };
    },
    describe: (ref, lane = 0) => call({ action: "describe", ...(ref ? { ref } : {}), ...(Number.isInteger(lane) && lane > 0 ? { lane } : {}) }),
    fill: ({ site = "", userRef = "", passRef, submitRef = "", username = "", password }) => call({ action: "fill", site, userRef, passRef, submitRef, username, password }),
    // THE OWNER'S CARD (2026-11-09): { site, numberRef, expRef?, monthRef?, yearRef?, cvcRef?, nameRef?, postalRef?, card }.
    fillCard: ({ site = "", card, numberRef, expRef = "", monthRef = "", yearRef = "", cvcRef = "", nameRef = "", postalRef = "" }) => call({ action: "fillCard", site, card, numberRef, expRef, monthRef, yearRef, cvcRef, nameRef, postalRef }),
    // A code from the private sign-in card (the audit, 2026-11-10), typed into the page's code field.
    fillCode: ({ site = "", codeRef, submitRef = "", code }) => call({ action: "fillCode", site, codeRef, submitRef, code }),
    // ITS SIGN-INS (the audit, 2026-11-10): what to keep a copy of (cookies, each site's local storage), and one site's
    // taken away (the owner signs Gloopy out of it).
    state: () => call({ action: "state" }),
    signOut: ({ site = "" }) => call({ action: "signOut", site }),
    // Only when it is running already (no browser is started to be told nothing).
    running: async () => !!(await ask(sock, "/ping", {}, 2000)).ok,
    // THE OWNER'S LIVE VIEW: { shot, hash, url, title } (or { same: true } when unchanged since `since`); { off: true } when
    // the browser is not running (it is not started for a look).
    screen: async ({ since = "", wait = 0, lane = 0 } = {}) => { const w = Math.max(0, Math.min(CAST_WAIT_MS, Number(wait) || 0)); const r = await ask(sock, "/screen", { since: String(since || "").slice(0, 40), ...(w ? { wait: w } : {}), ...(Number.isInteger(lane) && lane > 0 && lane <= LANES_MAX ? { lane } : {}) }, 10_000 + w); if (r && r.down) return { off: true }; if (r && r.error) throw new Error(r.error); return r; },
    // THE OWNER TAKES OVER: the browser started if it is not running, then the page as it is.
    wake: async () => { const p = await ask(sock, "/ping", {}, 2000); if (!p || !p.ok) await start(); const r = await ask(sock, "/screen", {}, 10_000); if (r && (r.down || r.error)) throw new Error(r.error || "the browser stopped answering"); return r; },
    // The owner's own click, typing, key, scroll or Back; then the page as it is.
    input: (x) => call({ action: "input", ...checkInput(x) }),
    // What is inside a box the owner marked on the page (dots' annotations): { x, y, w, h } in the screenshot's pixels.
    area: ({ x, y, w, h }) => call({ action: "area", x, y, w, h }),
    // Teach a task (Grok Bot's): on, then off (the owner's steps written down).
    teach: (on) => call({ action: "teach", on: on === true }),
  };
}

if (process.argv[1] && import.meta.url === "file://" + process.argv[1] && process.argv[2] === "serve") {
  serve(process.argv[3]).catch((e) => { console.error("gloopy browser: " + String((e && e.message) || e)); process.exit(1); });
}
