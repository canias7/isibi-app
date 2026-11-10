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
  // What is in the page's password fields and payment card fields now, in every frame (to blank it out of what is
  // reported), and the card numbers this browser typed (blanked wherever they show, for as long as it runs).
  const typedCards = new Set();
  // The codes the owner typed on the sign-in card (the audit, 2026-11-10): blanked as a card's few digits are, wherever a
  // field shows one again (a page that asks again with the code still in its box is a new page, not marked).
  const typedCodes = new Set();
  const secrets = async () => {
    const passwords = [], cards = [...typedCards, ...typedCodes];
    for (const f of page.frames()) {
      try {
        const v = await f.evaluate((sel) => ({ p: [...document.querySelectorAll("input[type=password]")].map((i) => i.value).filter(Boolean), c: [...document.querySelectorAll(sel)].map((i) => i.value).filter(Boolean) }), CARD_FIELDS);
        passwords.push(...v.p); cards.push(...v.c);
      } catch { /* a frame that went away */ }
    }
    return { passwords, cards };
  };
  // MASKED IN EACH SCREENSHOT THE AI GETS (the owner's live view shows the page as it is): the card fields of every frame,
  // and any text that shows what is in them (a card picture beside the fields; a number however it is spaced).
  const cardMasks = (values) => {
    const nums = [], shorts = new Set();
    for (const v of new Set(values)) { const d = v.replace(/\D/g, ""); if (d.length >= 12) nums.push(new RegExp(d.split("").join("[\\s-]?"))); else if (v.trim()) shorts.add(v.trim()); }
    const out = [];
    for (const f of page.frames()) {
      if (f.isDetached()) continue;
      out.push(f.locator(CARD_FIELDS));
      for (const re of nums) out.push(f.getByText(re));
      for (const t of shorts) out.push(f.getByText(t, { exact: true }));
    }
    return out;
  };
  const report = async (did) => {
    const title = await page.title().catch(() => "");
    let outline = await page.locator("body").ariaSnapshot({ mode: "ai", timeout: 10000 }).catch((e) => "(the page's outline could not be read: " + plainError(e, {}) + ")");
    const hide = await secrets();
    outline = redactCards(redactPasswords(outline, hide.passwords), hide.cards);
    let cut = "";
    if (outline.length > OUTLINE_MAX) { outline = outline.slice(0, OUTLINE_MAX); cut = "\n[the outline goes on past " + OUTLINE_MAX.toLocaleString("en-US") + " characters; the screenshot shows what is in view: scroll and look to see more]"; }
    const shot = await page.screenshot({ type: "jpeg", quality: 55, timeout: 10000, mask: cardMasks(hide.cards), maskColor: "#9ca3af" }).catch(() => null);
    const said = dialog ? "\nA dialog came up and was closed (" + dialog + ")." : "";
    dialog = "";
    // Blanked in all of it, what was done too (a step's words name an element, never what is typed in it, but never trust that alone).
    const text = redactCards(redactPasswords("Did: " + did + "\nPage: " + (title || "(no title)") + "\nAddress: " + page.url() + said + "\n\n" + outline + cut, hide.passwords), hide.cards);
    return { text, shot: shot ? shot.toString("base64") : "" };
  };
  const target = (ref) => page.locator("aria-ref=" + ref);
  // An element as a person would say it ("Go", "Search"), and what it is: for the words of what was done, and the check.
  // NEVER WHAT WAS TYPED IN A FIELD (found 2026-11-09: a password field's name was its value, so "Clicked" on it after a
  // sign-in said the password): a field is named by its label, placeholder or name. A label stands for its field (typing
  // into a label types into its field). `card`: which part of a payment card a field is for (number, cvc, exp, month,
  // year, name), or "".
  const about = (ref) => target(ref).evaluate((n) => {
    const c = n instanceof HTMLLabelElement && n.control ? n.control : n;
    const field = (c instanceof HTMLInputElement && !/^(submit|button|reset|image)$/i.test(c.type)) || c instanceof HTMLTextAreaElement || c instanceof HTMLSelectElement;
    const labels = c.labels ? [...c.labels].map((l) => l.innerText).join(" ") : "";
    const name = n !== c ? n.innerText : field ? c.getAttribute("aria-label") || c.getAttribute("title") || labels || c.getAttribute("placeholder") || c.getAttribute("name") || ""
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
  const run = async (ask) => {
    const el = ask.ref ? await about(ask.ref) : null;
    const it = el && el.name ? quote(el.name) : ask.ref;
    const did = { open: "Opened " + ask.url, look: "Looked at the page", click: "Clicked " + it, type: "Typed " + quote(ask.text || "") + " into " + it, press: "Pressed " + ask.key, select: "Chose " + quote(ask.option || "") + " in " + it, scroll: "Scrolled " + ask.direction, back: "Went back" }[ask.action];
    if (ask.action === "open") await page.goto(ask.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    else if (ask.action === "click") await target(ask.ref).click({ timeout: 8000 });
    else if (ask.action === "type") {
      if (el.password) throw new Error(PASSWORD_REFUSED);
      if (["number", "cvc", "exp"].includes(el.card)) throw new Error(CARD_REFUSED);
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
    // host: the page's; frameHost: the site of the element itself ("" for none: a frame with no web address of its own).
    return { element: el, url: page.url(), host, frameHost: el && ref ? siteOf(el.origin) : host, title: await page.title().catch(() => "") };
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
          else if (x.action === "fillCard") out = await fillCard(x);
          else if (x.action === "fillCode") out = await fillCode(x);
          else if (x.action === "input") out = await input(x);
          else { ask = checkAsk(x); out = await run(ask); }
        } catch (e) { out = { error: e && [PASSWORD_REFUSED, CARD_REFUSED].includes(e.message) ? e.message : plainError(e, ask || {}) }; }
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
    fill: ({ site = "", userRef = "", passRef, submitRef = "", username = "", password }) => call({ action: "fill", site, userRef, passRef, submitRef, username, password }),
    // THE OWNER'S CARD (2026-11-09): { site, numberRef, expRef?, monthRef?, yearRef?, cvcRef?, nameRef?, postalRef?, card }.
    fillCard: ({ site = "", card, numberRef, expRef = "", monthRef = "", yearRef = "", cvcRef = "", nameRef = "", postalRef = "" }) => call({ action: "fillCard", site, card, numberRef, expRef, monthRef, yearRef, cvcRef, nameRef, postalRef }),
    // A code from the private sign-in card (the audit, 2026-11-10), typed into the page's code field.
    fillCode: ({ site = "", codeRef, submitRef = "", code }) => call({ action: "fillCode", site, codeRef, submitRef, code }),
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
