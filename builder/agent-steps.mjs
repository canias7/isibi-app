// THE OLD STEPS, AS THE SITE AGENT'S TOOLS (2026-10-30, the owner: port them all).
//
// Since 2026-10-28 one agent takes every message, and it could change files,
// the stylesheet and table rows only. The router's ladder could also store the
// site's settings, put the owner's logo in place, change a table's rules,
// rename a page with a redirect, ask the owner a question with answer buttons,
// make a QR code and keep a change to some screen sizes. These are the input
// readers for those tools: each REUSES the step's own code (`cleanHeadDescription`,
// `readRules` / `splitAlready` / `ungroundedWidenings` / `mergeRules`,
// `renameRoute`, `readAsk`, `qrSvg`) and answers either what to queue or an
// error the agent reads. Nothing here writes anything: what is queued is
// saved by the Worker (`runAgentChange`) after the agent finishes, beside the
// stylesheet, with the same put-back when the publish fails.
import { cleanHeadDescription } from "../site-head-edit.mjs";
import { readRules, splitAlready, ungroundedWidenings } from "./site-rules.mjs";
import { renameRoute } from "./site-apply.mjs";
import { routeOf } from "./site-addon.mjs";
import { readAsk } from "./site-ask.mjs";
import { qrSvg } from "./site-qr.mjs";
import { markRemove } from "./site-mark.mjs";

export const MAX_NAME_CHARS = 80;
export const MAX_LANGS = 12;
const LANG_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const has = (o, k) => Object.hasOwn(o, k) && o[k] !== undefined && o[k] !== null;
const str = (v) => (typeof v === "string" ? v.trim() : null);

/**
 * `set_site_settings`: the business's name (the browser tab's title and the
 * link preview's), the description search engines and link previews show, the
 * link-preview picture and the tab icon. A picture is one of the owner's own
 * uploads, checked by `checkUpload(name)` → `{ ok, name, url }` (the share
 * route's rule: the owner's, a picture, still there). Answers `{ settings }` or
 * `{ error }`.
 */
export async function readSettingsInput(input, { checkUpload = null } = {}) {
  const i = input && typeof input === "object" ? input : {};
  const out = {};
  const name = has(i, "name") ? i.name : i.title;
  if (name !== undefined && name !== null) {
    const n = str(name);
    if (n === null) return { error: "the name is text" };
    if (!n || n.length > MAX_NAME_CHARS) return { error: "the name is 1 to " + MAX_NAME_CHARS + " characters" };
    if (has(i, "name") && has(i, "title") && str(i.title) !== n) return { error: "the title is the business's name: send one of name or title" };
    out.name = n.replace(/\s+/g, " ");
  }
  if (has(i, "description")) {
    const d = cleanHeadDescription(i.description);
    if (!d.ok) return { error: "description: " + d.error };
    out.description = d.value;
  }
  for (const [k, field] of [["shareImage", "share"], ["favicon", "favicon"]]) {
    if (!has(i, k)) continue;
    const v = str(i[k]);
    if (v === null) return { error: k + " is the name or address of one of the owner's uploads" };
    if (!v) { out[field] = ""; continue; }
    if (typeof checkUpload !== "function") return { error: "pictures cannot be checked here, so " + k + " cannot be set" };
    let c = null;
    try { c = await checkUpload(v); } catch { c = null; }
    if (!c || c.ok !== true) return { error: k + ": " + String((c && c.why) || "that is not one of the owner's uploaded pictures") };
    out[field] = field === "share" ? c.name : c.url;
  }
  if (has(i, "lang") || has(i, "langs")) return { error: "languages are set with set_languages" };
  if (!Object.keys(out).length) return { error: "name at least one setting: name, description, shareImage or favicon" };
  return { settings: out };
}

/** `set_logo`: the owner's uploaded logo in the header (`target` "logo") or the tab icon ("icon"). */
export async function readLogoInput(input, { checkUpload = null } = {}) {
  const i = input && typeof input === "object" ? input : {};
  const target = i.target === undefined ? "logo" : i.target;
  if (target !== "logo" && target !== "icon") return { error: "target is \"logo\" (the header) or \"icon\" (the browser tab)" };
  const field = target === "icon" ? "favicon" : "wordmark";
  if (i.remove === true) return { settings: { [field]: "" } };
  const v = str(i.upload);
  if (!v) return { error: "name the uploaded logo (its name or its /u/ address), or remove: true" };
  if (typeof checkUpload !== "function") return { error: "uploads cannot be checked here" };
  let c = null;
  try { c = await checkUpload(v); } catch { c = null; }
  if (!c || c.ok !== true) return { error: String((c && c.why) || "that is not one of the owner's uploaded pictures") };
  return { settings: { [field]: c.url } };
}

/**
 * `set_languages`: `lang` declares the language the pages are ALREADY written
 * in (never a translation); `langs` is the WHOLE list of extra languages the
 * site is also offered in (the publish's translator writes them), `[]` for none.
 */
export function readLanguagesInput(input) {
  const i = input && typeof input === "object" ? input : {};
  const out = {};
  if (has(i, "lang")) {
    const l = str(i.lang);
    if (!l || !LANG_TAG.test(l)) return { error: "lang is one language tag, like \"es\" or \"pt-BR\"" };
    out.lang = l;
  }
  if (has(i, "langs")) {
    if (!Array.isArray(i.langs)) return { error: "langs is the whole list of extra languages, like [\"es\", \"fr\"]" };
    if (i.langs.length > MAX_LANGS) return { error: "at most " + MAX_LANGS + " extra languages" };
    const seen = new Set();
    for (const t of i.langs) {
      const l = str(t);
      if (!l || !LANG_TAG.test(l)) return { error: "not a language tag: " + String(t).slice(0, 20) };
      if (!seen.has(l.toLowerCase())) { seen.add(l.toLowerCase()); out.langs = [...(out.langs || []), l]; }
    }
    if (!out.langs) out.langs = [];
    const main = out.lang || "";
    if (main && out.langs.some((l) => l.toLowerCase() === main.toLowerCase())) return { error: "the site's own language is not an extra one" };
  }
  if (!Object.keys(out).length) return { error: "send lang, langs or both" };
  return { settings: out };
}

/**
 * `set_table_rules`: one table's rules, read exactly as the rules step reads
 * its model's answer (`readRules`), with what is already so set aside
 * (`splitAlready`), and a WIDER read refused unless the owner's own words say
 * so (`ungroundedWidenings`: the agent asks them first). `tables` carries each
 * table's stored rules; `asked` the owner's words this turn.
 */
export function readRulesInput(input, tables, asked = []) {
  const i = input && typeof input === "object" ? input : {};
  const list = Array.isArray(tables) ? tables.filter((t) => t && typeof t.name === "string") : [];
  if (!list.length) return { error: "this site has no tables" };
  const name = str(i.table) || "";
  if (!list.some((t) => t.name.toLowerCase() === name.toLowerCase())) return { error: "no such table; the site's tables are " + list.map((t) => t.name).join(", ") };
  const read = readRules({ content: [{ type: "tool_use", input: { tables: [{ ...i, table: name }] } }] }, list);
  if (read.refused.length) return { error: "refused: " + read.refused.map((r) => r.rule + " (" + r.why + ")").join("; ") };
  const { changes, already } = splitAlready(read.changes, list);
  if (!changes.length) return already.length ? { already } : { error: "nothing to change: name read, write, unique, oncePerUser, noOverlap, maxRows or retired" };
  const wide = ungroundedWidenings(changes, list, asked);
  if (wide.length) return { error: "this would let more people see the entries in " + wide.map((w) => w.table).join(", ") + " (" + wide.map((w) => w.from + " → " + w.read).join(", ") + "), and the owner's own words do not say so: ask the owner first (ask_owner), and quote their words in readWords" };
  return { changes, already };
}

/**
 * `rename_page`: the page step's rename (`renameRoute`): the file moves, every
 * link to the old address in the pages AND the components is rewritten, and
 * the old address is sent to the new one (a 301, recorded as a move the publish
 * merges into the stored redirects). `files` is `[{ path, source }]`, a
 * component's path `-parts/<name>`.
 */
export function readRenameInput(input, files) {
  const i = input && typeof input === "object" ? input : {};
  const from = str(i.from), to = str(i.to);
  if (!from || !to) return { error: "send from and to, page addresses like \"/menu\" and \"/food\"" };
  const read = (p) => (typeof p === "string" && p.startsWith("-parts/") ? "" : routeOf(p));
  const r = renameRoute(files, from, to, read);
  if (!r.ok) return { error: r.reason };
  return { files: r.pages, redirect: r.redirect, changed: r.changed };
}

/** `ask_owner`: one question with two to four short answers, read as every step's question is (`readAsk`). */
export function readAskInput(input) {
  const i = input && typeof input === "object" ? input : {};
  if (!Array.isArray(i.options) || i.options.length < 2 || i.options.length > 4) return { error: "give two to four answers to choose from" };
  if (i.options.some((o) => typeof o !== "string" || !o.trim() || o.trim().length > 60)) return { error: "each answer is a short label, at most 60 characters" };
  const a = readAsk({ text: i.question, options: i.options });
  if (!a || a.unusable) return { error: "the question could not be read: ask it as one short line" };
  if (a.options.length < 2) return { error: "give two to four different answers" };
  return { ask: a };
}

/**
 * `make_qr`: a QR code for one of the site's pages (or any web address), made
 * by the QR step's own encoder (`qrSvg`), as a picture address the agent puts
 * in an `<img>`. `siteUrl` is the site's public address.
 */
export function readQrInput(input, siteUrl) {
  const i = input && typeof input === "object" ? input : {};
  let text = "";
  if (has(i, "page")) {
    const p = str(i.page);
    if (!p || !/^\/[a-z0-9/_-]*$/i.test(p)) return { error: "a page address starts with / (\"/\", \"/menu\")" };
    if (typeof siteUrl !== "string" || !/^https:\/\//.test(siteUrl)) return { error: "this site's address is not known here" };
    text = siteUrl.replace(/\/+$/, "") + (p === "/" ? "/" : p);
  } else if (has(i, "url")) {
    const u = str(i.url);
    if (!u || !/^https?:\/\/[^\s]+$/i.test(u)) return { error: "url is a web address starting with https://" };
    text = u;
  } else return { error: "send page (\"/menu\") or url" };
  const q = qrSvg(text);
  if (!q || !q.svg) return { error: "that address cannot be made into a QR code" + (q && q.why ? ": " + q.why : "") };
  const src = "data:image/svg+xml;base64," + (typeof btoa === "function" ? btoa(q.svg) : Buffer.from(q.svg).toString("base64"));
  return { text, src };
}

/**
 * The config patch for queued settings, merged into the stored look (never a
 * bare `{ look: { … } }`: `withConfig` replaces a field whole, so the theme,
 * the brand and every language would go). A mark is stored as the logo step
 * stores it (`{ form: "image", url }`), and taken off as it does (`markRemove`).
 */
export function agentSettingsPatch(config, settings) {
  const c = config && typeof config === "object" ? config : {};
  const s = settings && typeof settings === "object" ? settings : {};
  const look = { ...(c.look && typeof c.look === "object" ? c.look : {}) };
  let touched = false;
  const set = (k, v) => { look[k] = v; touched = true; };
  if (typeof s.name === "string" && s.name) set("brand", s.name);
  if (typeof s.description === "string") set("description", s.description);
  for (const f of ["wordmark", "favicon"]) if (typeof s[f] === "string") set(f, s[f] ? { form: "image", url: s[f] } : markRemove(c, f));
  if (typeof s.lang === "string" && s.lang) set("lang", s.lang);
  if (Array.isArray(s.langs)) set("langs", s.langs.slice());
  const out = touched ? { look } : {};
  if (typeof s.share === "string") out.share = s.share;
  return out;
}
