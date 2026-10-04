// ── THE ADDITIONS BATCH: EACH NEW THING, JUDGED BY WHAT LANDED ──────────────
//
// Run 90 (2026-10-02) routed five additions — a footer link, a menu link, a
// header button, a line on a page and a photograph on a page — to edits, and
// the add-on step could deliver none of them. The fix sends them to the add-on
// step and has it deliver each one (`frame`, `words` and `photo` in
// `builder/site-add.mjs`; a frame item goes on to the menu editor as an
// addition). This module judges the press that shows it live: the five
// messages, unchanged, through the real app in one tab (`12-additions` in
// canary-ui.mjs).
//
// A REPLY IS NOT AN ADDITION (run 47's lesson, and Test 5's rule). Each message
// passes on what its operations did, each read from its own record:
//   * what left the page: one routing call with the words, answered `addon`
//     by the router model itself (the decision it reports: the model's own
//     answer, its raw intent `addon`, no failure — the route falls back to
//     `addon` on a site, so the final intent alone cannot tell);
//     one add-on request with the words; and for an item in the frame, one
//     edit at the menu editor carrying the words and the addition flag, which
//     only the add-on step's hand-over sets — and no edit at all otherwise;
//   * what each job stored: the add-on step's hand-over and the menu editor's
//     success, or the add-on step's own success;
//   * the chain: every message published once, in order, and the after-read
//     saw the last version;
//   * the stored source: each thing asked for is there, exactly once, where it
//     was asked for, and nothing else moved — read with the product's own
//     readers (the menus, the buttons, the footer's lists and details, the
//     page's words, its photographs), so a pass means what the builder itself
//     would read back;
//   * what a visitor is served: the same five things in the published pages.
//
// Everything here is pure: the canary reads, this module decides.
import { navSlots, actionSlots, chromeListSlots, contactSlots, applyNav, applyAction, applyChromeList } from "../builder/site-nav.mjs";
import { extractText } from "../builder/site-text.mjs";
import { imageRefCounts, photoAlts } from "../builder/site-images.mjs";
import { requestKeyOf } from "./canary-ui.mjs";

const byPath = (list) => new Map((Array.isArray(list) ? list : []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));
const one = (path, source) => [{ path, source }];
const lower = (s) => String(s == null ? "" : s).trim().toLowerCase();
/** Words as a visitor reads them: curly quotes straightened, spacing collapsed, case folded. */
export const plain = (s) => lower(String(s == null ? "" : s).replace(/[‘’′]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " "));

/**
 * A telephone link's number in the national form, or "" when it is not one:
 * `tel:+44 117 496 0000` and `tel:01174960000` are the same number.
 */
export function telNumber(href) {
  const m = /^tel:(.+)$/i.exec(String(href || "").trim());
  if (!m) return "";
  let d = m[1].replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = "0" + d.slice(3);
  else if (d.startsWith("0044")) d = "0" + d.slice(4);
  return /^\d{6,15}$/.test(d) ? d : "";
}

/** Whether an address is the named profile on the named network: either host, any case, one trailing slash. */
export function profileMatches(href, want) {
  let u = null;
  try { u = new URL(String(href || "")); } catch { return false; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return /^https?:$/.test(u.protocol) && host === want.host && lower(u.pathname.replace(/\/$/, "")) === lower(want.path);
}

/** Each kind of addition this batch knows, and how one item of it is recognised. */
export const ADDITION_KINDS = Object.freeze({
  menu: (it, want) => !!(it && lower(it.label) === lower(want.label) && it.href === want.href),
  social: (it, want) => !!(it && lower(it.network) === lower(want.network) && profileMatches(it.href, want)),
  button: (it, want) => !!(it && lower(it.label) === lower(want.label) && telNumber(it.href) === want.tel),
});

/**
 * WHAT LEFT THE PAGE FOR ONE MESSAGE, from the page's own record: one routing
 * call carrying the words exactly and answered `addon` by the router model
 * itself, one add-on request of this site carrying them, and — for an item in
 * the frame — exactly one edit at the layer the add-on step hands it to,
 * carrying the same words and the addition flag. A message that is not a
 * frame item makes no edit at all.
 *
 * THE MODEL'S OWN CHOICE, NOT A FALLBACK (review, 2026-10-02). On a site the
 * route's fallback is `addon` (`FALLBACK_WITH_SITE`): an edit naming no step,
 * an unreadable answer and a failed call all come back `intent: "addon"`. So
 * the decision the route reports must say the model answered (`source:
 * "model"`), that the model's own intent was `addon` (`raw.intent`), and no
 * failure may be marked. A response with no decision cannot tell, and fails.
 */
export function additionRequestVerdict(step, site, expect) {
  const net = Array.isArray(step && step.network) ? step.network : [];
  const said = step && step.say;
  const routes = net.filter((e) => e.method === "POST" && e.path === "/api/site/route");
  const adds = net.filter((e) => e.method === "POST" && e.path === `/api/site/${encodeURIComponent(site)}/addon`);
  const edits = net.filter((e) => e.method === "POST" && /^\/api\/site\/[^/]+\/edit$/.test(e.path));
  const res = routes[0] && routes[0].res && typeof routes[0].res === "object" ? routes[0].res : {};
  const hop = expect && typeof expect.hop === "string" ? expect.hop : "";
  const out = {
    routes: routes.length,
    routedWords: !!(routes[0] && routes[0].req && routes[0].req.message === said),
    routedIntent: typeof res.intent === "string" ? res.intent : "",
    routedLayer: typeof res.layer === "string" ? res.layer : "",
    routeCost: Number.isFinite(res.cost) ? res.cost : null,
    decisionSource: res.decision && typeof res.decision === "object" && typeof res.decision.source === "string" ? res.decision.source : "",
    rawIntent: res.decision && typeof res.decision === "object" && res.decision.raw && typeof res.decision.raw === "object" && typeof res.decision.raw.intent === "string" ? res.decision.raw.intent : "",
    routeFailed: res.failed !== undefined || res.failure !== undefined,
    adds: adds.length,
    addWords: adds.length > 0 && adds.every((e) => e.req && e.req.instruction === said),
    edits: edits.length,
    editLayers: edits.map((e) => (e.req && typeof e.req.layer === "string" ? e.req.layer : null)),
    editWords: edits.every((e) => e.req && e.req.instruction === said),
    editAddition: edits.every((e) => e.req && e.req.addition === true),
  };
  const routedOk = out.routes === 1 && out.routedWords && out.routedIntent === "addon" &&
    out.decisionSource === "model" && out.rawIntent === "addon" && !out.routeFailed;
  // TAKEN ON AS A REQUEST (2026-10-03): the page posts nothing after the
  // routing call; the request's one part ran the add-on step (and, for a frame
  // item, the edit it handed the item to, as an addition) and ended done.
  const key = requestKeyOf(net);
  if (key) {
    const fin = step && step.request ? step.request.final : null;
    const parts = fin && Array.isArray(fin.parts) ? fin.parts : [];
    const p = parts[0] || null;
    out.request = { key, ended: !!(fin && fin.ended === true), parts: parts.map((q) => ({ n: q.n, status: q.status, route: q.route || "", addition: q.addition === true, jobs: Array.isArray(q.ids) ? q.ids.length : 0 })) };
    const partOk = !!p && parts.length === 1 && p.status === "done" && Array.isArray(p.ids) &&
      (hop ? p.route === hop && p.addition === true && p.ids.length === 2 : p.route === "addon" && p.ids.length === 1);
    out.ok = routedOk && out.adds === 0 && out.edits === 0 && out.request.ended && partOk;
    return out;
  }
  const editsOk = hop
    ? out.edits === 1 && out.editLayers[0] === hop && out.editWords && out.editAddition
    : out.edits === 0;
  out.ok = routedOk && out.adds === 1 && out.addWords && editsOk;
  return out;
}

/**
 * WHAT EACH JOB STORED for one message, as the page read it under
 * `x-gf-edit: final`: for a frame item, the add-on step's hand-over to the
 * layer named and then that layer's success; otherwise the add-on step's own
 * success. And the reply on screen is a success.
 */
export function additionReplyVerdict(step, expect) {
  const fin = (Array.isArray(step && step.network) ? step.network : []).filter((e) => e.final && e.res && typeof e.res === "object").map((e) => e.res);
  const hop = expect && typeof expect.hop === "string" ? expect.hop : "";
  const shown = Array.isArray(step && step.replies) && step.replies.length ? step.replies.join("\n") : String((step && step.reply) || "");
  const out = { finals: fin.length, shown: shown.slice(0, 200) };
  // A REQUEST'S PAGE READS ONLY THE STEP THAT ANSWERED (2026-10-03): a
  // hand-over is the server's to act on, so the add-on step's own reply is
  // never fetched, and the edit it handed the item to is the one read.
  if (hop && requestKeyOf(step && step.network)) {
    if (fin.length !== 1) return { ...out, ok: false, why: `${fin.length} stored replies read, not the ${hop} step's one` };
    if (!(fin[0].ok === true && fin[0].layer === hop)) return { ...out, ok: false, why: `the ${hop} step did not succeed (${JSON.stringify({ ok: fin[0].ok, layer: fin[0].layer, error: fin[0].error })})` };
  } else if (hop) {
    const [handed, done] = fin;
    if (fin.length !== 2) return { ...out, ok: false, why: `${fin.length} stored repl${fin.length === 1 ? "y" : "ies"}, not the hand-over and the ${hop} step's answer` };
    if (!(handed.ok !== true && handed.escalate === true && handed.layer === hop)) return { ...out, ok: false, why: `the add-on step did not hand the item to ${hop} (${JSON.stringify({ ok: handed.ok, escalate: handed.escalate, layer: handed.layer, error: handed.error })})` };
    if (!(done.ok === true && done.layer === hop)) return { ...out, ok: false, why: `the ${hop} step did not succeed (${JSON.stringify({ ok: done.ok, layer: done.layer, error: done.error })})` };
  } else {
    if (fin.length !== 1) return { ...out, ok: false, why: `${fin.length} stored replies, not the add-on step's one` };
    if (fin[0].ok !== true) return { ...out, ok: false, why: `the add-on step did not succeed (${fin[0].error || "no error named"}${fin[0].msg ? " — " + fin[0].msg : ""})` };
  }
  if (!shown.startsWith("✅")) return { ...out, ok: false, why: "the reply on screen is not a success" };
  return { ...out, ok: true, why: "" };
}

/** The frame as the menu editor reads it, page by page. */
export function frameOf(pages) {
  const out = new Map();
  const at = (page) => {
    if (!out.has(page)) out.set(page, { menus: [], action: null, second: null, social: [], contact: null });
    return out.get(page);
  };
  for (const s of navSlots(pages)) at(s.page).menus.push(s.items.map((it) => ({ label: it.label, href: it.href })));
  for (const s of actionSlots(pages, "action")) if (s.action) at(s.page).action = { label: s.action.label, href: s.action.href };
  for (const s of actionSlots(pages, "secondAction")) if (s.action) at(s.page).second = { label: s.action.label, href: s.action.href };
  for (const s of chromeListSlots(pages, "social")) if (Array.isArray(s.items)) at(s.page).social.push(...s.items.map((it) => ({ network: it.network, href: it.href })));
  for (const s of contactSlots(pages)) if (s.contact) at(s.page).contact = s.contact;
  return out;
}

/** The index of the brace, bracket or `>` that closes what opens at `open`, skipping strings; -1 when it never closes. */
function closeOf(s, open, opens, closes) {
  let depth = 0;
  let quote = "";
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (opens.includes(c)) depth++;
    else if (closes.includes(c) && --depth === 0) return i;
  }
  return -1;
}

/**
 * THE PAGE WITH ONLY WHAT THESE ADDITIONS MAY CHANGE TAKEN OUT (review,
 * 2026-10-02): the menus' items, the second button and the footer's social
 * links — each by the menu editor's own writers, and each only when the batch
 * adds one — so the business name, the tagline, the first button, the
 * footer's details and small-print links, the frame's arrangement and the
 * rest of the page are compared byte for byte. Blanking the whole frame
 * object hid a change to any of them. What is taken out is what the
 * additions' own checks judge.
 */
export function withoutAdditions(path, src, want = {}) {
  let pages = [{ path, source: String(src == null ? "" : src) }];
  if (want && want.menu) pages = applyNav(pages, []).pages;
  if (want && want.button) pages = applyAction(pages, null, true, "secondAction").pages;
  if (want && want.social) pages = applyChromeList(pages, "social", []).pages;
  return pages[0].source;
}

/**
 * THE FRAME AS WRITTEN: the shared `const CHROME = { … }` object and every
 * `<SiteChrome …>` / `<SiteHeader …>` opening tag, in order — "" for a page
 * with no frame. Compared on every page, the one the line and the photograph
 * go on included.
 */
export function frameText(src) {
  const s = String(src == null ? "" : src);
  const parts = [];
  const m = /const CHROME\s*=\s*\{/.exec(s);
  if (m) {
    const open = m.index + m[0].length - 1;
    const close = closeOf(s, open, "{", "}");
    if (close > 0) parts.push(s.slice(m.index, close + 1));
  }
  for (const t of s.matchAll(/<Site(?:Chrome|Header)\b/g)) {
    // The tag runs to the first `>` outside braces and strings.
    let depth = 0, quote = "", end = -1;
    for (let i = t.index; i < s.length; i++) {
      const c = s[i];
      if (quote) { if (c === "\\") { i++; continue; } if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) { end = i; break; }
    }
    if (end > 0) parts.push(s.slice(t.index, end + 1));
  }
  return parts.join("\n");
}

/** A word that denies what follows it in its clause: "not", "never", "no", "nor", "without", or a contraction ending in n't. */
const DENIES = /(?:^|[^a-z'])(?:not|never|no|nor|without)(?![a-z'])|n't(?![a-z])/;

/**
 * WHETHER `text` STATES `says` (review, 2026-10-02): the words whole, on word
 * boundaries, with nothing before them in their own clause that denies them.
 * "We're NOT closed on bank holidays" contains "closed on bank holidays" and
 * says the opposite. A clause runs back to the last `.`, `!`, `?`, `;` or `:`;
 * any one occurrence that is stated is enough.
 */
export function states(text, says) {
  const t = plain(text), w = plain(says);
  if (!t || !w) return false;
  for (let at = t.indexOf(w); at >= 0; at = t.indexOf(w, at + 1)) {
    const okBefore = at === 0 || !/[a-z0-9]/.test(t[at - 1]);
    const okAfter = !/[a-z0-9]/.test(t[at + w.length] || "");
    if (!okBefore || !okAfter) continue;
    const before = t.slice(0, at);
    const clause = before.slice(Math.max(...[".", "!", "?", ";", ":"].map((c) => before.lastIndexOf(c))) + 1);
    if (!DENIES.test(clause)) return true;
  }
  return false;
}

/** The words a page's source shows (the additions' own places already taken out), as a multiset of plain lines. */
export function wordsOf(src) {
  const bag = new Map();
  for (const w of extractText(src)) {
    const t = plain(w.text);
    if (t) bag.set(t, (bag.get(t) || 0) + 1);
  }
  return bag;
}

/** What `after` holds that `before` does not, as one span: everything between their common start and their common end. */
export function changedSpan(before, after) {
  const x = String(before == null ? "" : before), y = String(after == null ? "" : after);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0;
  while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  return y.slice(i, y.length - j);
}

/** `a` less `b`, as multisets. */
export function less(a, b) {
  const out = [];
  for (const [k, n] of a) for (let i = (b.get(k) || 0); i < n; i++) out.push(k);
  return out;
}

/** The photographs a page draws, as a multiset of addresses. */
export function photosOf(src, slug) {
  return imageRefCounts(String(src || ""), slug);
}

/**
 * THE VERDICT ON THE STORED SOURCE, one check per thing asked for and one for
 * everything that must not move. `spec.additions` names what each message
 * adds; `before` and `after` are the canary's source reads.
 */
export function storedAdditionsVerdict({ spec, before, after, slug }) {
  const checks = [];
  const add = (name, ok, why) => checks.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const want = spec.additions || {};
  const b = byPath(before && before.pages), a = byPath(after && after.pages);
  const complete = !!(before && before.complete === true && after && after.complete === true);
  add("both source reads are complete", complete, "a store read did not answer, so an absence proves nothing");
  add("the same page files before and after", complete && JSON.stringify([...b.keys()].sort()) === JSON.stringify([...a.keys()].sort()),
    `before ${JSON.stringify([...b.keys()].sort())}, after ${JSON.stringify([...a.keys()].sort())}`);
  add("the stored components are byte for byte what they were", complete && JSON.stringify(before && before.parts) === JSON.stringify(after && after.parts), "the component list or a body changed");

  const fb = frameOf(before && before.pages), fa = frameOf(after && after.pages);
  const framed = [...fb.keys()].filter((p) => fb.get(p).menus.length);
  add("the frame was read on the pages that have one", framed.length > 0, "no page's menu could be read, so nothing below could be judged");

  // THE MENU: every menu on every page is its old self plus exactly one item
  // that is the link asked for — in any place, the rest in their own order.
  if (want.menu) {
    const bad = [];
    for (const p of framed) {
      const was = fb.get(p).menus, now = (fa.get(p) || { menus: [] }).menus;
      if (now.length !== was.length) { bad.push(`${p} has ${now.length} menus, not ${was.length}`); continue; }
      was.forEach((items, i) => {
        const got = now[i];
        const extra = got.filter((it) => !items.some((x) => x.label === it.label && x.href === it.href));
        const kept = got.filter((it) => items.some((x) => x.label === it.label && x.href === it.href));
        if (extra.length !== 1 || !ADDITION_KINDS.menu(extra[0], want.menu)) bad.push(`${p}'s menu gained ${JSON.stringify(extra)}`);
        if (JSON.stringify(kept) !== JSON.stringify(items)) bad.push(`${p}'s menu did not keep its own items in their order`);
      });
    }
    add(`every page's menu gained "${want.menu.label}" → ${want.menu.href} and kept every item it had`, complete && !bad.length, bad.join("; "));
  }
  // THE FOOTER'S SOCIAL LINKS: the one profile asked for, once, beside what was there.
  if (want.social) {
    const bad = [];
    for (const p of framed) {
      const was = fb.get(p).social, now = (fa.get(p) || { social: [] }).social;
      const extra = now.filter((it) => !was.some((x) => x.network === it.network && x.href === it.href));
      if (extra.length !== 1 || !ADDITION_KINDS.social(extra[0], want.social)) bad.push(`${p}'s footer gained ${JSON.stringify(extra)}`);
      if (!was.every((x) => now.some((it) => it.network === x.network && it.href === x.href))) bad.push(`${p}'s footer lost a link`);
    }
    add(`every page's footer gained the ${want.social.network} link to ${want.social.host}${want.social.path} and kept every link it had`, complete && !bad.length, bad.join("; "));
  }
  // THE HEADER: the button they had stays as it was, and the new one is the second.
  if (want.button) {
    const bad = [];
    for (const p of framed) {
      const was = fb.get(p), now = fa.get(p) || {};
      if (JSON.stringify(now.action) !== JSON.stringify(was.action)) bad.push(`${p}'s button changed: ${JSON.stringify(was.action)} → ${JSON.stringify(now.action)}`);
      if (was.second) bad.push(`${p} already had a second button`);
      else if (!ADDITION_KINDS.button(now.second, want.button)) bad.push(`${p}'s second button is ${JSON.stringify(now.second)}`);
    }
    add(`every page's header kept its button and gained "${want.button.label}" ringing ${want.button.tel} beside it`, complete && !bad.length, bad.join("; "));
  }
  // THE FOOTER'S DETAILS: no addition here asks to change one.
  {
    const bad = framed.filter((p) => JSON.stringify((fa.get(p) || {}).contact) !== JSON.stringify(fb.get(p).contact));
    add("every page's footer details are what they were", complete && !bad.length, bad.map((p) => `${p}'s details changed`).join("; "));
  }

  // THE PAGES, WITH ONLY THE ADDITIONS' OWN PLACES TAKEN OUT (`withoutAdditions`,
  // review 2026-10-02): every page but the one the words and the photograph
  // were asked for is byte for byte what it was — the frame's other fields
  // included — and every page's frame keeps everything else it had.
  const rest = (p, src) => withoutAdditions(p, src, want);
  const target = [...new Set([want.words && want.words.page, want.photo && want.photo.page].filter(Boolean))];
  const moved = [...b.keys()].filter((p) => !target.includes(p) && rest(p, a.get(p)) !== rest(p, b.get(p)));
  add(`every page but ${target.join(", ") || "none"} is byte for byte as it was, apart from the additions' own places`, complete && !moved.length, moved.map((p) => `${p} changed beyond the additions`).join("; "));
  const reframed = [...b.keys()].filter((p) => a.has(p) && frameText(rest(p, a.get(p))) !== frameText(rest(p, b.get(p))));
  add("every page's frame keeps everything else it had: the name, the tagline, the first button, the footer's details and small-print links, the arrangement",
    complete && framed.length > 0 && !reframed.length, reframed.map((p) => `${p}'s frame changed beyond the additions`).join("; ") || "no frame was read");

  for (const p of target) {
    const was = b.get(p), now = a.get(p);
    if (was === undefined || now === undefined) { add(`${p} was read before and after`, false, `${p} is missing from a read`); continue; }
    if (rest(p, now) === rest(p, was)) { add(`${p} changed`, false, `${p} is byte for byte as it was`); continue; }
    // NOTHING THE PAGE SAID IS GONE, and what is new is the line and the
    // photograph's own description, nothing more.
    const wb = wordsOf(rest(p, was)), wa = wordsOf(rest(p, now));
    const lost = less(wb, wa);
    add(`${p} still says everything it said`, !lost.length, `lost: ${JSON.stringify(lost.slice(0, 6))}`);
    const pb = photosOf(was, slug), pa = photosOf(now, slug);
    const gone = [...pb].filter(([u, n]) => (pa.get(u) || 0) < n).map(([u]) => u);
    add(`${p} still shows every photograph it showed`, !gone.length, `gone: ${JSON.stringify(gone)}`);
    const newPhotos = [];
    for (const [u, n] of pa) for (let i = pb.get(u) || 0; i < n; i++) newPhotos.push(u);
    const alts = photoAlts(one(p, now));
    const newAlts = newPhotos.map((u) => plain(alts.get(u) || ""));
    let extra = less(wa, wb);
    if (want.photo && want.photo.page === p) {
      add(`${p} shows exactly one more photograph, and its description is about ${want.photo.about}`,
        newPhotos.length === 1 && newAlts[0].includes(plain(want.photo.about)),
        `new: ${JSON.stringify(newPhotos.map((u, i) => ({ src: u, alt: newAlts[i] })))}`);
      extra = extra.filter((t) => !newAlts.includes(t));
    } else {
      add(`${p} shows no new photograph`, !newPhotos.length, `new: ${JSON.stringify(newPhotos)}`);
    }
    if (want.words && want.words.page === p) {
      const line = extra.join(" ");
      const says = plain(want.words.says);
      // STATED, NOT DENIED (`states`, review 2026-10-02): "we're NOT closed
      // on bank holidays" contains the words and says the opposite.
      // AND READ AS A VISITOR WOULD, off the span the page gained: the text
      // rung's reader skips a lone lowercase word, so "we're <strong>not</strong>
      // closed…" reached `line` without its "not".
      const gained = visible(changedSpan(rest(p, was), rest(p, now)));
      add(`${p} gained one line saying "${want.words.says}", and no other words`,
        states(line, says) && states(gained, says) && !plain([...wb.keys()].join(" ")).includes(says) && line.length <= says.length + 160,
        `new words: ${JSON.stringify(extra.slice(0, 6))}; read off the change: ${JSON.stringify(gained.slice(0, 160))}`);
    } else {
      add(`${p} gained no words`, !extra.length, `new words: ${JSON.stringify(extra.slice(0, 6))}`);
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}

/** The anchors in one region of served HTML, as `{ href, text }`. */
export function anchors(html) {
  return [...String(html || "").matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ href: m[1].replace(/&amp;/g, "&"), text: plain(m[2].replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&")) }));
}
export const region = (html, tag) => (String(html || "").match(new RegExp("<" + tag + "\\b[\\s\\S]*?<\\/" + tag + ">")) || [""])[0];
export const visible = (html) => plain(String(html || "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&"));

/**
 * WHAT A VISITOR IS SERVED, read off the published pages the after-read
 * fetched (`served`: route → HTML): the frame's three on every page that has a
 * header, and the line and the photograph on their page.
 */
export function servedAdditionsVerdict({ spec, served }) {
  const checks = [];
  const add = (name, ok, why) => checks.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const want = spec.additions || {};
  const pages = Object.entries(served && typeof served === "object" ? served : {}).filter(([, h]) => typeof h === "string" && h);
  const framed = pages.filter(([, h]) => region(h, "header"));
  add("the published pages were read", framed.length > 0, "no served page with a header was read");
  if (want.menu) {
    const off = framed.filter(([, h]) => !anchors(region(h, "header")).some((x) => x.href === want.menu.href && x.text === lower(want.menu.label))).map(([r]) => r);
    add(`every published header links "${want.menu.label}" to ${want.menu.href}`, framed.length && !off.length, `not on ${off.join(", ")}`);
  }
  if (want.social) {
    const off = framed.filter(([, h]) => !anchors(region(h, "footer")).some((x) => profileMatches(x.href, want.social))).map(([r]) => r);
    add(`every published footer links to ${want.social.host}${want.social.path}`, framed.length && !off.length, `not on ${off.join(", ")}`);
  }
  if (want.button) {
    const off = framed.filter(([, h]) => !anchors(region(h, "header")).some((x) => telNumber(x.href) === want.button.tel && x.text === lower(want.button.label))).map(([r]) => r);
    add(`every published header has "${want.button.label}" ringing ${want.button.tel}`, framed.length && !off.length, `not on ${off.join(", ")}`);
  }
  if (want.words) {
    const route = want.words.route;
    const h = served && served[route];
    add(`the published ${route} says "${want.words.says}"`, typeof h === "string" && states(visible(region(h, "main") || h), want.words.says), typeof h === "string" ? "the words are not on the page, or are denied there" : `${route} was not read`);
  }
  if (want.photo) {
    const route = want.photo.route;
    const h = served && served[route];
    const imgs = typeof h === "string" ? [...h.matchAll(/<img\b[^>]*>/g)].map((m) => plain(((/\balt="([^"]*)"/.exec(m[0]) || [])[1] || "").replace(/&#x27;|&#39;/g, "'"))) : [];
    add(`the published ${route} shows a photograph described as ${want.photo.about}`, imgs.some((alt) => alt.includes(plain(want.photo.about))), typeof h === "string" ? `descriptions: ${JSON.stringify(imgs)}` : `${route} was not read`);
  }
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * THE WHOLE VERDICT: each message's requests and stored replies, the chain of
 * publishes, the stored source and the served pages. Taken whether or not
 * every message was sent, so a stopped run records why it did not pass.
 */
export function additionsVerdict({ spec, steps, chain, before, after, served, slug }) {
  const checks = [];
  const add = (name, ok, why) => checks.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const want = Array.isArray(spec.steps) ? spec.steps : [];
  want.forEach((st, i) => {
    const s = (Array.isArray(steps) ? steps : [])[i];
    const n = i + 1;
    if (!s || !s.sent) { add(`message ${n} was sent`, false, "it was not sent"); return; }
    const rq = additionRequestVerdict(s, spec.site, st);
    add(`message ${n} left word for word, was routed to the add-on step${st.hop ? `, which handed it to ${st.hop} as an addition` : " and made no edit"}`, rq.ok, JSON.stringify(rq));
    const rp = additionReplyVerdict(s, st);
    add(`message ${n}'s stored repl${st.hop ? "ies are the hand-over and the menu editor's success" : "y is the add-on step's success"}, shown as a success`, rp.ok, rp.why);
  });
  add(`all ${want.length} messages published, in order, and the after-read saw the last version`,
    !!(chain && chain.verified === true && chain.links === want.length),
    chain ? (chain.verified ? `${chain.links} publish(es), not ${want.length}` : chain.why) : "the chain was not read");
  const stored = storedAdditionsVerdict({ spec, before, after, slug });
  const shown = servedAdditionsVerdict({ spec, served });
  checks.push(...stored.checks, ...shown.checks);
  return { ok: checks.every((c) => c.ok), checks };
}
