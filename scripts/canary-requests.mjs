// ── THE REQUEST BATCH: EACH PRESS JUDGED BY WHAT LANDED, AND WHICH PATH IT TOOK ──
//
// The combined request flow's real-model batch (2026-10-03,
// docs/investigations/request-flow-rollout.md): six presses on the bakery,
// each one message the server takes on as a request (`rq-*` in
// canary-ui.mjs). This module judges a press from what the canary read; it
// reads nothing itself.
//
// TWO KINDS OF VERDICT, NEVER MIXED (the owner, 2026-10-03: *"Record valid
// alternative execution paths accurately, distinguishing a successful user
// outcome from coverage of a particular internal handoff."*):
//   * CHECKS — what the customer asked for happened, and nothing else: the
//     request was taken on and ended with every part done where the press
//     allows it, the site holds exactly the named changes, nothing else moved,
//     no part ran before a part it needed had finished, and each reply is the
//     model's own and on screen. A check that fails fails the press.
//   * COVERAGE — which internal hand-over the run went through: whether the
//     add-on step set the menu link aside, whether a part waited for another,
//     whether a step asked the question rather than the router. The router and
//     each step choose their own path, and a prior model answer does not
//     guarantee the next one, so the same message can reach the same outcome
//     by another valid path. Coverage is recorded, covered or not, and never
//     fails a press.
//
// A REPLY IS NOT AN OUTCOME (run 47): every check reads what the operations
// did — the request's own view, the stored source, the served pages, the
// owner's table listing, the logo's bytes — never how many replies came back.
import { frameOf, withoutAdditions, profileMatches, plain, states, wordsOf, less, changedSpan, anchors, region, visible, photosOf } from "./canary-additions.mjs";
import { requestKeyOf, routeCallOf } from "./canary-ui.mjs";

const byPath = (list) => new Map((Array.isArray(list) ? list : []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));
const listOf = (v) => (typeof v === "string" && v ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);

/** A part's statuses that mean a job was filed for it, or it may start now: never before a part it needs is done. */
export const PART_STARTED = Object.freeze(["ready", "queued", "started", "waiting", "unverified", "done", "partial", "failed"]);
/** A part running, or about to run. */
export const PART_LIVE = Object.freeze(["ready", "queued", "started"]);

/** The route a page file serves, read off its own `createFileRoute("…")`; "" when it names none. */
export function routeOfPage(source) {
  const m = /createFileRoute\(\s*(["'`])([^"'`]+)\1\s*\)/.exec(String(source || ""));
  return m ? m[2] : "";
}

/** The stored page that serves a route, or null. */
export function pageForRoute(pages, route) {
  for (const p of Array.isArray(pages) ? pages : []) {
    if (p && typeof p.path === "string" && routeOfPage(p.source) === route) return { path: p.path, source: String(p.source || "") };
  }
  return null;
}

// ── A HEADING CHANGED, THAT TEXT ONLY ───────────────────────────────────────

/** The ways a page's source may spell the same words: an apostrophe as typed, curled, or escaped. */
function spellings(s) {
  const t = String(s || "");
  return [...new Set([t, t.replace(/'/g, "’"), t.replace(/'/g, "&apos;"), t.replace(/'/g, "&#39;"), t.replace(/'/g, "\\'")])];
}

/** Words as written in a page's source, read as a visitor reads them: entities decoded, a JSX string's braces and quotes taken off. */
function sourceWords(s) {
  let t = String(s || "").trim();
  const m = /^\{\s*(["'`])([\s\S]*)\1\s*\}$/.exec(t);
  if (m) t = m[2];
  return plain(t.replace(/&apos;|&#39;|&#x27;|\\'/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

/**
 * WHETHER ONE PAGE'S SOURCE CHANGED IN ONE PLACE ONLY: the heading's words,
 * from `from` to `to`, and every other byte as it was. The old words must be
 * in the page exactly once (twice cannot say which one was meant); what
 * replaced them is read as words, so a JSX string or an escaped apostrophe
 * reads the same. A change beyond it, spacing included, is said as such.
 */
export function headingOnly(before, after, from, to) {
  const x = String(before == null ? "" : before), y = String(after == null ? "" : after);
  let at = -1, lit = "";
  for (const f of spellings(from)) {
    const i = x.indexOf(f);
    if (i < 0) continue;
    if (x.indexOf(f, i + 1) >= 0) return { ok: false, why: `"${from}" is in the page more than once, so which one changed cannot be told` };
    at = i; lit = f;
    break;
  }
  if (at < 0) return { ok: false, why: `"${from}" was not in the page before` };
  const head = x.slice(0, at), tail = x.slice(at + lit.length);
  if (y.length >= head.length + tail.length && y.startsWith(head) && y.endsWith(tail)) {
    const mid = y.slice(head.length, y.length - tail.length);
    return sourceWords(mid) === plain(to) ? { ok: true, why: "" } : { ok: false, why: `the heading reads ${JSON.stringify(mid.slice(0, 120))}, not "${to}"` };
  }
  const squash = (s) => s.replace(/\s+/g, "");
  const spaced = squash(y).startsWith(squash(head)) && squash(y).endsWith(squash(tail));
  return { ok: false, why: spaced ? "the page changed beyond that heading, in its spacing only" : "the page changed beyond that heading" };
}

// ── A LINE OF WORDS ADDED ───────────────────────────────────────────────────

/** A time as one spelling: "8 pm", "8:00pm", "8.00 PM" and "20:00" are all "8pm". */
export function timeWords(s) {
  return String(s == null ? "" : s)
    .replace(/\b(1[3-9]|2[0-3])[:.]00\b/g, (_, h) => `${Number(h) - 12}pm`)
    .replace(/\b(\d{1,2})(?:[:.]00)?\s*(am|pm|a\.m\.|p\.m\.)/gi, (_, h, m) => `${h}${m.toLowerCase().replace(/\./g, "")}`);
}

/**
 * Whether `text` names every stem, each at the start of a word: "class" names
 * "classes", and "bread" names "bread-making". Nothing to look for names
 * nothing: an empty list is never a pass.
 */
export function namesAll(text, stems) {
  const t = plain(text);
  const list = listOf(stems);
  return list.length > 0 && list.every((w) => {
    const s = plain(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !!s && new RegExp("(?:^|[^a-z0-9])" + s).test(t);
  });
}

/** Whether `text` states every fragment, each whole and undenied (`states`), times read as one spelling; an empty list is never a pass. */
export function statesAll(text, says) {
  const t = timeWords(text);
  const list = listOf(says);
  return list.length > 0 && list.every((w) => states(t, timeWords(w)));
}

// ── WHAT LEFT THE PAGE, AND WHAT THE REQUEST DID, MESSAGE BY MESSAGE ────────

/** The view of a request a message ended on, or null. */
const finalOf = (step) => (step && step.request && step.request.final && typeof step.request.final === "object" ? step.request.final : null);

/** Whether a part's route is one this press allows: an edit layer it lists, or the add-on step where it opens it. */
export function routeAllowed(route, scenario) {
  if (typeof route !== "string" || !route) return false;
  if (route === "addon") return !!(scenario && (scenario.addon === true || scenario.adds === true));
  return !!(scenario && Array.isArray(scenario.layers) && scenario.layers.includes(route));
}

/**
 * ONE MESSAGE, AS A REQUEST: one routing call carrying its words, nothing
 * posted from the page after it, and then — for a message that ends on a
 * question (`until: "question"`) — one part waiting on a step's question with
 * nothing else running, or the router's own question with no request opened
 * (another valid path, said as such); for every other message the request
 * ended with every part done at a route the press allows, nothing stopped by
 * the wall. A file the message carried rode the routing call byte for byte.
 * A message sent with the tab closed (`away`) ended with no page open and was
 * shown, ended, by the tab opened afterwards.
 */
export function requestStepChecks(step, scenario) {
  const out = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const n = step && step.n;
  const net = Array.isArray(step && step.network) ? step.network : [];
  if (!step || !step.sent) { add(`message ${n} was sent`, false, "it was not sent"); return out; }
  const routes = net.filter((e) => e && e.method === "POST" && e.path === "/api/site/route");
  const route = routeCallOf(net);
  add(`message ${n} left as one routing call carrying its words exactly`, routes.length === 1 && !!(route && route.req && route.req.message === step.say),
    `${routes.length} routing call(s)${route && route.req && route.req.message !== step.say ? "; the words differ" : ""}`);
  const posts = net.filter((e) => e && e.method === "POST" && /^\/api\/site\/[^/]+\/(edit|addon)$/.test(String(e.path || "")));
  add(`message ${n}: the page posted no edit or add-on of its own (the server runs every part)`, posts.length === 0, posts.map((e) => e.path).join(", "));
  if (step.file) {
    const got = route && route.req && Array.isArray(route.req.images) && route.req.images[0] ? route.req.images[0].sha256 : "";
    add(`message ${n}'s file rode the routing call byte for byte (sha256 ${String(step.file.sha256).slice(0, 16)}…)`, got === step.file.sha256, got || "no file on the routing call");
  }
  const key = requestKeyOf(net);
  const fin = finalOf(step);
  const parts = fin && Array.isArray(fin.parts) ? fin.parts : [];
  const wall = step.request && step.request.wall;
  if (step.mode === "question") {
    const q = step.question || null;
    if (q && q.by === "router") {
      add(`message ${n} ended on a question: the router's own, with no request opened (another valid path: the answer is routed whole)`,
        !key && !!(route && route.res && route.res.intent === "clarify"), key ? "a request was opened too" : "the routing answer is not a question");
      return out;
    }
    add(`message ${n} was taken on as a request`, !!key, "the routing answer names no request");
    const waiting = parts.filter((p) => p && p.status === "waiting" && p.question);
    // NOTHING ELSE RUNNING, NOR ENDED OTHERWISE: every other part is done, or
    // waits for this one (a part about to run or running is neither).
    const off = parts.filter((p) => p && p.status !== "waiting" && p.status !== "done" && p.status !== "blocked");
    add(`message ${n} ended on one part waiting with a step's question, the page showing it, and nothing else running`,
      !!q && q.by === "step" && waiting.length === 1 && q.part === waiting[0].n && !off.length && !wall,
      wall ? `the wall stopped part ${wall.n}: ${wall.why}` : !q ? "no question was shown" : `parts ${parts.map((p) => `${p.n}:${p.status}`).join(" ") || "(none read)"}`);
    return out;
  }
  add(`message ${n} was taken on as a request`, !!key, "the routing answer names no request");
  if (!key) return out;
  add(`message ${n}'s request ended`, !!(fin && fin.ended === true), fin ? `it is ${fin.state || "?"}` : "its view was never read");
  add(`message ${n}'s request: every part done, each at a route this press allows`,
    parts.length > 0 && parts.every((p) => p && p.status === "done" && routeAllowed(p.route, scenario)),
    parts.map((p) => `${p.n}:${p.status}${p.route ? "@" + p.route : ""}`).join(" ") || "no part read");
  add(`message ${n}: nothing was stopped by the wall`, !wall, wall ? `part ${wall.n}: ${wall.why}` : "");
  if (step.mode === "away") {
    const a = step.away || {};
    add(`message ${n}'s request ended while no page was open`, a.closed === true && a.ended === true, a.closed ? (a.ended ? "" : "it had not ended when the reads stopped") : "the tab was never closed");
    add(`nothing read message ${n}'s request route while the tab was closed (only the requests list, which moves nothing)`,
      a.closed === true && Array.isArray(a.calls) && a.calls.length === 0, (a.calls || []).map((c) => `${c.method} ${c.path}`).join(", ") || "not watched");
    add(`the tab opened afterwards showed message ${n}'s request ended, every part with its reply`,
      !!(a.reopened && a.reopened.closed === true), a.reopened ? a.reopened.why || "the page never closed the request" : "no tab was opened afterwards");
  }
  return out;
}

/**
 * WHICH PART NEEDS WHICH, as the routing answer numbered them (`dependsOn`,
 * change 0 being the part the answer makes and change i the i-th part held
 * back, `alsoAsked`), mapped onto the request's parts as it took the message
 * on. A change the request folded into another cannot be mapped and is
 * counted, never guessed.
 */
export function relationsOf(step) {
  const route = routeCallOf(step && step.network);
  const res = route && route.res && typeof route.res === "object" ? route.res : {};
  const accepted = res.request && Array.isArray(res.request.parts) ? res.request.parts : [];
  const also = listOf(res.alsoAsked);
  const numberOf = (c) => {
    if (c === 0) return accepted.some((p) => p && p.n === 0) ? 0 : undefined;
    const w = also[c - 1];
    const p = typeof w === "string" ? accepted.find((x) => x && x.words === w) : null;
    return p ? p.n : undefined;
  };
  const out = [], unread = [];
  for (const d of Array.isArray(res.dependsOn) ? res.dependsOn : []) {
    for (const a of Array.isArray(d && d.after) ? d.after : []) {
      const part = numberOf(d.change), needs = numberOf(a);
      if (Number.isInteger(part) && Number.isInteger(needs) && part !== needs) out.push({ part, needs });
      else unread.push({ change: d.change, after: a });
    }
  }
  return { relations: out, unread, blocked: accepted.filter((p) => p && p.status === "blocked").map((p) => p.n) };
}

/**
 * NO PART STARTED BEFORE A PART IT NEEDS HAD FINISHED, as the canary saw the
 * request: every view it read (`trail`, every 3 s with the tab open and every
 * 20 s with it closed) is checked against every relation. A part whose job is
 * filed, running or finished while the one it needs is not done is the flow
 * running out of order. No relation means nothing to order: the check holds,
 * and says so.
 */
export function jobOrderVerdict(step) {
  const { relations, unread } = relationsOf(step);
  const trail = step && step.request && Array.isArray(step.request.trail) ? step.request.trail : [];
  if (!relations.length) return { ok: true, vacuous: true, relations, unread, views: trail.length, why: "no part waited for another" };
  const bad = [];
  for (const v of trail) {
    const st = new Map(Array.isArray(v && v.parts) ? v.parts : []);
    for (const r of relations) {
      if (PART_STARTED.includes(st.get(r.part)) && st.get(r.needs) !== "done") {
        bad.push(`at ${Math.round((v.ms || 0) / 1000)} s part ${r.part} was ${st.get(r.part)} while part ${r.needs}, which it needs, was ${st.get(r.needs) || "unread"}`);
      }
    }
  }
  if (!trail.length) return { ok: false, relations, unread, views: 0, why: "the request was never read while it ran" };
  return { ok: !bad.length, relations, unread, views: trail.length, why: bad.slice(0, 3).join("; ") };
}

/**
 * EACH PART'S REPLY: the model's own (`replySource: "model"`) and on screen
 * in the browser, read off the job's stored answer the page was handed under
 * `x-gf-edit: final`. A question is the step's own words, shown on its card.
 * A reply composed because the model's could not be had is recorded as
 * composed, never passed as the model's. The request's own reply, when it has
 * one, is read the same way.
 */
export function repliesOf(step, seen = new Set()) {
  const out = [];
  const net = Array.isArray(step && step.network) ? step.network : [];
  const screen = (Array.isArray(step && step.replies) ? step.replies : []).map((t) => plain(t));
  const shown = (text) => {
    const w = plain(text).slice(0, 80);
    return !!w && screen.some((s) => s.includes(w));
  };
  const fin = finalOf(step);
  for (const p of fin && Array.isArray(fin.parts) ? fin.parts : []) {
    for (const job of Array.isArray(p && p.jobs) ? p.jobs : []) {
      // A JOB AN EARLIER MESSAGE OF THE SAME REQUEST SHOWED was judged there.
      if (seen.has(job)) continue;
      seen.add(job);
      const hits = net.filter((e) => e && e.final === true && e.res && typeof e.res === "object" && e.path === `/api/site/edit/${job}`);
      const res = hits.length ? hits[hits.length - 1].res : null;
      if (!res) { out.push({ part: p.n, job, source: "unread", shown: false }); continue; }
      const q = res.clarify && typeof res.clarify === "object" ? res.clarify : null;
      if (q && typeof q.text === "string") { out.push({ part: p.n, job, source: "question", text: q.text, shown: shown(q.text) }); continue; }
      const model = res.replySource === "model" && typeof res.reply === "string" && res.reply.trim() ? res.reply : "";
      out.push({ part: p.n, job, source: model ? "model" : "composed", text: model || String(res.msg || ""), shown: shown(model || res.msg || "") });
    }
  }
  const rr = step && step.request && step.request.reply;
  if (rr && typeof rr.text === "string" && rr.text) out.push({ part: "request", job: "", for: rr.for || "", source: rr.source === "model" ? "model" : "composed", text: rr.text, shown: shown(rr.text) });
  return out;
}

/** The replies as checks: each one the model's own and on screen; a question on screen. */
export function replyChecks(steps) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(steps) ? steps : []) {
    if (!s || !s.sent) continue;
    const list = repliesOf(s, seen);
    if (!list.length) { out.push({ name: `message ${s.n} had a reply`, ok: false, why: "no part's reply was read" }); continue; }
    for (const r of list) {
      const who = r.part === "request" ? `the request's own reply${r.for ? ` (${r.for})` : ""}` : `part ${r.part}'s ${r.source === "question" ? "question" : "reply"}`;
      if (r.source === "question") out.push({ name: `message ${s.n}: ${who} is on screen`, ok: r.shown, why: r.shown ? "" : JSON.stringify(r.text.slice(0, 120)) });
      else out.push({ name: `message ${s.n}: ${who} is the model's own, and on screen`, ok: r.source === "model" && r.shown, why: r.source !== "model" ? `${r.source}: ${JSON.stringify(String(r.text || "").slice(0, 120))}` : r.shown ? "" : "not on screen" });
    }
  }
  return out;
}

// ── WHAT LANDED ON THE SITE ─────────────────────────────────────────────────

/** The logos a served page's header draws, as addresses on the site's own upload path. */
export function headerLogos(html, slug) {
  const head = region(html, "header");
  const mark = `/u/${slug}/`;
  return [...head.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((u) => u.includes(mark)).map((u) => u.slice(u.indexOf(mark)));
}

/** The served home page's description, decoded; "" when it carries none. */
export function servedDescription(html) {
  const m = /<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/.exec(String(html || ""));
  return m ? m[1].replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&") : "";
}

/**
 * THE NEW PAGES, one per page the press asks for: a route the sitemap did not
 * list before, served 200, whose words are about what was asked (`about`),
 * with a stored page file that serves it. Any other new route is extra.
 */
export function newPagesFound({ want, before, after, served }) {
  const was = new Set(Object.keys((before && before.render) || {}));
  const fresh = Object.keys((after && after.render) || {}).filter((r) => !was.has(r)).sort();
  const files = (after && after.source && Array.isArray(after.source.pages) ? after.source.pages : []);
  const oldFiles = new Set((before && before.source && Array.isArray(before.source.pages) ? before.source.pages : []).map((p) => p.path));
  const used = new Set();
  const found = [];
  for (const w of Array.isArray(want) ? want : []) {
    const route = fresh.find((r) => !used.has(r) && listOf(w.about).every((a) => visible(served && served[r]).includes(plain(a))));
    if (!route) { found.push({ want: w, route: "", why: `no new page is about ${listOf(w.about).join(" and ")} (new routes: ${fresh.join(", ") || "none"})` }); continue; }
    used.add(route);
    const file = files.find((p) => p && !oldFiles.has(p.path) && routeOfPage(p.source) === route);
    const status = after && after.render && after.render[route] ? after.render[route].status : undefined;
    found.push({ want: w, route, path: file ? file.path : "", status, why: !file ? `no new stored page file serves ${route}` : status !== 200 ? `${route} answered ${status}` : "" });
  }
  return { found, fresh, extra: fresh.filter((r) => !used.has(r)) };
}

/**
 * THE SITE AGAINST THIS PRESS'S OWN BEFORE-READ: each named change there,
 * exactly, and everything not named as it was — every stored page byte for
 * byte apart from the named places (a menu item, a footer link, a heading's
 * words, a line), no page gone, no stored component changed, the stored
 * description and every header logo as they were unless named, and the
 * owner's table listing the same tables with the same rules, columns and row
 * counts. `found` is `newPagesFound`'s answer.
 */
export function outcomeChecks({ spec, before, after, served, beforeServed, logo, row, tables, slug }) {
  const out = [];
  const add = (name, ok, why) => out.push({ name, ok: !!ok, why: ok ? "" : String(why || "not established") });
  const want = (spec && spec.expect) || {};
  const bRender = (before && before.render) || {}, aRender = (after && after.render) || {};
  const complete = !!(before && before.complete === true && after && after.complete === true);
  add("both stored source reads are complete", complete, "a store read did not answer, so an absence proves nothing");
  const bPages = before && before.source ? before.source.pages : [], aPages = after && after.source ? after.source.pages : [];
  const b = byPath(bPages), a = byPath(aPages);
  const pf = newPagesFound({ want: want.pages, before, after, served });
  // EACH NEW PAGE, ANSWERING, ABOUT WHAT WAS ASKED.
  for (const f of pf.found) {
    add(`a new page about ${listOf(f.want.about).join(" and ")} was added, stored and served 200${f.route ? ` (${f.route})` : ""}`, !f.why && !!f.route, f.why);
  }
  add("no other page was added", !pf.extra.length, `also new: ${pf.extra.join(", ")}`);
  // EACH HEADING: the served page reads the new words and not the old; the
  // before-read read the old.
  for (const h of Array.isArray(want.headings) ? want.headings : []) {
    const was = (bRender[h.route] || {}).headings || [], now = (aRender[h.route] || {}).headings || [];
    const hasFrom = (l) => l.some((t) => plain(t) === plain(h.from)), hasTo = (l) => l.some((t) => plain(t) === plain(h.to));
    add(`${h.route}'s heading "${h.from}" now reads "${h.to}" on the served page`, hasFrom(was) && hasTo(now) && !hasFrom(now),
      `before ${JSON.stringify(was)}, after ${JSON.stringify(now)}`);
  }
  // THE DESCRIPTION, stored and served.
  const bs = before && before.stored, as = after && after.stored;
  if (want.description) {
    const d = want.description;
    const said = as && as.ok ? as.description : "";
    add(`the stored description now names ${listOf(d.says).join(", ")}`, !!(bs && bs.ok && as && as.ok) && namesAll(said, d.says) && !(d.absentBefore && namesAll(bs.description, d.absentBefore)) && said !== bs.description,
      `before ${JSON.stringify(bs && bs.ok ? bs.description : null)}, after ${JSON.stringify(said || null)}`);
    const home = servedDescription(served && served["/"]);
    add("the served home page carries that description", !!said && home === said, `served ${JSON.stringify(home)}`);
  } else {
    add("the stored description is what it was", !!(bs && bs.ok && as && as.ok && bs.description === as.description),
      `before ${JSON.stringify(bs && bs.ok ? bs.description : "UNREADABLE")}, after ${JSON.stringify(as && as.ok ? as.description : "UNREADABLE")}`);
  }
  // THE MENU: every page that had one gained exactly the one item, pointing at
  // the new page, and kept every item it had in its order; every served
  // header links it.
  const fb = frameOf(bPages), fa = frameOf(aPages);
  const framed = [...fb.keys()].filter((p) => fb.get(p).menus.length);
  // THE ROUTES THOSE PAGES SERVE: a served page is judged for its frame only
  // where its stored source has one (the bakery's unfinished page has none).
  const framedRoutes = framed.map((p) => routeOfPage(b.get(p))).filter(Boolean);
  if (want.menu) {
    const target = pf.found[want.menu.page || 0];
    const href = target && target.route;
    const bad = [];
    if (!href) bad.push("the page it links to was not found");
    for (const p of framed) {
      const was = fb.get(p).menus, now = (fa.get(p) || { menus: [] }).menus;
      if (now.length !== was.length) { bad.push(`${p} has ${now.length} menus, not ${was.length}`); continue; }
      was.forEach((items, i) => {
        const got = now[i];
        const extra = got.filter((it) => !items.some((x) => x.label === it.label && x.href === it.href));
        const kept = got.filter((it) => items.some((x) => x.label === it.label && x.href === it.href));
        if (extra.length !== 1 || extra[0].href !== href || !plain(extra[0].label).includes(plain(want.menu.label))) bad.push(`${p}'s menu gained ${JSON.stringify(extra)}`);
        if (JSON.stringify(kept) !== JSON.stringify(items)) bad.push(`${p}'s menu did not keep its own items in their order`);
      });
    }
    add(`every page's menu gained "${want.menu.label}" → ${href || "the new page"} and kept every item it had`, complete && framed.length > 0 && !bad.length, bad.join("; ") || "no menu was read");
    const off = framedRoutes.filter((r) => !anchors(region(served && served[r], "header")).some((x) => x.href === href && x.text.includes(plain(want.menu.label))));
    add(`every served header links "${want.menu.label}" to ${href || "the new page"}`, !!href && framedRoutes.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
  }
  // A LINK SOME MENUS ALREADY CARRY, FINISHED (2026-10-04, the focused check of
  // run 95's fixes): every menu that lacked it gained exactly it, keeping its
  // own items in their order; every menu that had it is as it was; at least
  // one menu gained it; and every served header links it. A page with no menu
  // is judged by the byte-for-byte check below, so none is given one.
  if (want.menuFinish) {
    const { label, href } = want.menuFinish;
    const bad = [];
    let gained = 0;
    for (const p of framed) {
      const was = fb.get(p).menus, now = (fa.get(p) || { menus: [] }).menus;
      if (now.length !== was.length) { bad.push(`${p} has ${now.length} menus, not ${was.length}`); continue; }
      was.forEach((items, i) => {
        const got = now[i];
        if (items.some((x) => x.href === href)) {
          if (JSON.stringify(got) !== JSON.stringify(items)) bad.push(`${p}'s menu already had it and changed to ${JSON.stringify(got)}`);
          return;
        }
        const extra = got.filter((it) => !items.some((x) => x.label === it.label && x.href === it.href));
        const kept = got.filter((it) => items.some((x) => x.label === it.label && x.href === it.href));
        if (extra.length !== 1 || extra[0].href !== href || !plain(extra[0].label).includes(plain(label))) bad.push(`${p}'s menu gained ${JSON.stringify(extra)}`);
        else gained++;
        if (JSON.stringify(kept) !== JSON.stringify(items)) bad.push(`${p}'s menu did not keep its own items in their order`);
      });
    }
    add(`every menu that lacked "${label}" → ${href} gained it, keeping its own items, and every menu that had it is as it was`, complete && framed.length > 0 && gained > 0 && !bad.length,
      bad.join("; ") || (framed.length ? "no menu gained it" : "no menu was read"));
    const off = framedRoutes.filter((r) => !anchors(region(served && served[r], "header")).some((x) => x.href === href && x.text.includes(plain(label))));
    add(`every served header links "${label}" to ${href}`, framedRoutes.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
  }
  // THE FOOTER'S SOCIAL LINKS: the one profile, once, beside what was there.
  if (want.social) {
    const bad = [];
    for (const p of framed) {
      const was = fb.get(p).social, now = (fa.get(p) || { social: [] }).social;
      const extra = now.filter((it) => !was.some((x) => x.network === it.network && x.href === it.href));
      if (extra.length !== 1 || plain(extra[0].network) !== plain(want.social.network) || !profileMatches(extra[0].href, want.social)) bad.push(`${p}'s footer gained ${JSON.stringify(extra)}`);
      if (!was.every((x) => now.some((it) => it.network === x.network && it.href === x.href))) bad.push(`${p}'s footer lost a link`);
    }
    add(`every page's footer gained the ${want.social.network} link to ${want.social.host}${want.social.path} and kept every link it had`, complete && framed.length > 0 && !bad.length, bad.join("; ") || "no footer was read");
    const off = framedRoutes.filter((r) => !anchors(region(served && served[r], "footer")).some((x) => profileMatches(x.href, want.social)));
    add(`every served footer links to ${want.social.host}${want.social.path}`, framedRoutes.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
  }
  // THE LINE OF WORDS, stored and served: nothing the page said is gone, and
  // what is new is one line stating what was asked, undenied.
  const rest = (p, src) => withoutAdditions(p, src, { menu: !!(want.menu || want.menuFinish), social: !!want.social });
  const wordsAt = want.words ? pageForRoute(bPages, want.words.route) : null;
  if (want.words) {
    const now = wordsAt ? a.get(wordsAt.path) : undefined;
    if (!wordsAt || now === undefined) add(`${want.words.route} was read before and after`, false, `${want.words.route} is missing from a read`);
    else {
      const wb = wordsOf(rest(wordsAt.path, wordsAt.source)), wa = wordsOf(rest(wordsAt.path, now));
      const lost = less(wb, wa);
      add(`${want.words.route} still says everything it said`, !lost.length, `lost: ${JSON.stringify(lost.slice(0, 6))}`);
      const line = less(wa, wb).join(" ");
      const gained = visible(changedSpan(rest(wordsAt.path, wordsAt.source), rest(wordsAt.path, now)));
      const cap = listOf(want.words.says).join(" ").length + 200;
      add(`${want.words.route} gained a line saying ${listOf(want.words.says).map((w) => `"${w}"`).join(" and ")}, and no more than a line's words`,
        statesAll(line, want.words.says) && statesAll(gained, want.words.says) && !statesAll([...wb.keys()].join(" "), want.words.says) && line.length <= cap,
        `new words: ${JSON.stringify(less(wa, wb).slice(0, 6))}; read off the change: ${JSON.stringify(gained.slice(0, 200))}`);
      const pb = photosOf(wordsAt.source, slug), pa = photosOf(now, slug);
      const moved = [...new Set([...pb.keys(), ...pa.keys()])].filter((u) => (pb.get(u) || 0) !== (pa.get(u) || 0));
      add(`${want.words.route} shows the same photographs as before`, !moved.length, `changed: ${JSON.stringify(moved)}`);
      const h = served && served[want.words.route];
      add(`the served ${want.words.route} says it`, typeof h === "string" && statesAll(visible(region(h, "main") || h), want.words.says), typeof h === "string" ? "the words are not on the page, or are denied there" : `${want.words.route} was not read`);
    }
  }
  // THE LOGO: every served header draws the attached file, by the address its
  // own bytes name, and the bytes served there are that file's.
  const heads = Object.entries(served || {}).filter(([, h]) => typeof h === "string" && region(h, "header"));
  if (want.logo) {
    const url = `/u/${slug}/${String(want.logo.sha256).slice(0, 32)}.png`;
    const off = heads.filter(([, h]) => { const l = headerLogos(h, slug); return !(l.length > 0 && l.every((u) => u === url)); }).map(([r]) => r);
    add(`every served header draws the attached picture as the logo (${url})`, heads.length > 0 && !off.length, `not on ${off.join(", ") || "any page read"}`);
    add("the logo's served bytes are the attached file's, byte for byte", !!(logo && logo.status === 200 && logo.sha256 === want.logo.sha256 && logo.url === url),
      logo ? `${logo.url || "?"} answered ${logo.status}, sha256 ${String(logo.sha256 || "").slice(0, 16)}…` : "not read");
  } else {
    // A PAGE THE PRESS ADDED had no logo to keep: only the pages served before are compared.
    const kept = heads.filter(([r]) => Object.hasOwn(bRender, r));
    const changed = kept.filter(([r, h]) => JSON.stringify(headerLogos(h, slug)) !== JSON.stringify(headerLogos(beforeServed && beforeServed[r], slug))).map(([r]) => r);
    add("every served header draws the logo it drew before", kept.length > 0 && !changed.length, `changed on ${changed.join(", ") || "no page read"}`);
  }
  // THE ROW (R2), read by the canary's own row readers around the message.
  if (spec && spec.row) {
    const r = row || {};
    const okOf = (k) => !!(r.shown && r.shown[k] && r.shown[k].verdict && r.shown[k].verdict.ok);
    add(`the baseline, immediately before the message: ${spec.row.table} id ${spec.row.id} is ${spec.row.match.name} at ${spec.row.from} on both readers`,
      !!(r.baselineVerdict && r.baselineVerdict.ok), r.baselineVerdict ? r.baselineVerdict.why : "not read");
    add(`the database change is exactly ${spec.row.table} id ${spec.row.id} ${spec.row.field} ${spec.row.from} -> ${spec.row.to}, and nothing else`,
      !!(r.change && r.change.exact), r.change ? JSON.stringify({ target: r.change.target, others: (r.change.others || []).length, added: r.change.added, gone: r.change.gone }) : "not read");
    add("a visitor's read shows that one change and nothing else", !!(r.visitorChange && r.visitorChange.exact), r.visitorChange ? JSON.stringify({ target: r.visitorChange.target }) : "not read");
    add(`the ${spec.row.shown.path} page shows ${spec.row.shown.after} for ${spec.row.match.name} and every other line as it was`, okOf("afterEdit"),
      r.shown && r.shown.afterEdit ? (r.shown.afterEdit.target || r.shown.afterEdit.why || "") : "not read");
    add("the canary wrote no row of its own (the change is kept, by the owner's demo-site rule)", !r.writes, `${r.writes} write(s) refused`);
  }
  // EVERYTHING NOT NAMED, AS IT WAS.
  const headed = new Map((Array.isArray(want.headings) ? want.headings : []).map((h) => [h.route, h]));
  const gone = [], moved = [];
  for (const [p, src] of b) {
    if (!a.has(p)) { gone.push(p); continue; }
    const route = routeOfPage(src);
    if (wordsAt && p === wordsAt.path) continue;
    const h = headed.get(route);
    if (h) {
      const v = headingOnly(rest(p, src), rest(p, a.get(p)), h.from, h.to);
      if (!v.ok) moved.push(`${p}: ${v.why}`);
    } else if (rest(p, a.get(p)) !== rest(p, src)) moved.push(`${p} changed`);
  }
  add("no stored page was removed", complete && !gone.length, `gone: ${gone.join(", ")}`);
  add("every stored page is byte for byte as it was, apart from the named changes", complete && !moved.length, moved.join("; "));
  const newFiles = [...a.keys()].filter((p) => !b.has(p));
  const meant = pf.found.map((f) => f.path).filter(Boolean);
  add(`no page file was added${meant.length ? " beyond the new page's own" : ""}`, complete && newFiles.every((p) => meant.includes(p)), `added: ${newFiles.filter((p) => !meant.includes(p)).join(", ")}`);
  const bParts = byPath(before && before.source ? before.source.parts : []), aParts = byPath(after && after.source ? after.source.parts : []);
  const partMoved = [...bParts].filter(([p, src]) => aParts.get(p) !== src).map(([p]) => p);
  const partNew = [...aParts.keys()].filter((p) => !bParts.has(p));
  add("every stored component is byte for byte as it was", complete && !partMoved.length, `changed or gone: ${partMoved.join(", ")}`);
  add(`no component was added${(want.pages || []).length ? " beyond what a new page brings" : ""}`, complete && (!partNew.length || (want.pages || []).length > 0), `added: ${partNew.join(", ")}`);
  const routesGone = Object.keys(bRender).filter((r) => !(aRender[r] && aRender[r].status === 200));
  add("every page that was served before is still served 200", !routesGone.length, `not served: ${routesGone.join(", ")}`);
  // THE DATABASE, AS ITS OWNER LISTS IT: the same tables, each with the same
  // rules, columns and number of rows. A new table, or a rule changed by a
  // part nobody asked for, shows here.
  const tb = tables && tables.before, ta = tables && tables.after;
  if (!(tb && tb.ok && ta && ta.ok)) add("the site's tables were read before and after", false, `${tb ? (tb.ok ? "after" : "before: " + tb.why) : "before"} not read${ta && !ta.ok ? "; after: " + ta.why : ""}`);
  else {
    const diff = [];
    for (const n of new Set([...tb.names, ...ta.names])) {
      const x = tb.tables[n], y = ta.tables[n];
      if (!x) { diff.push(`${n} is new`); continue; }
      if (!y) { diff.push(`${n} is gone`); continue; }
      if (x.access !== y.access) diff.push(`${n}'s rules ${x.access} -> ${y.access}`);
      if (JSON.stringify(x.columns) !== JSON.stringify(y.columns)) diff.push(`${n}'s columns changed`);
      if (x.rows !== y.rows) diff.push(`${n} ${x.rows} -> ${y.rows} rows`);
    }
    add("the site's tables are as they were: the same tables, rules, columns and row counts", !diff.length, diff.join("; "));
  }
  return { checks: out, newPages: pf };
}

// ── WHICH PATH THE RUN TOOK ─────────────────────────────────────────────────

/** Every part each message's request ended with, in order. */
const partsOf = (steps) => (Array.isArray(steps) ? steps : []).flatMap((s) => { const f = finalOf(s); return f && Array.isArray(f.parts) ? f.parts : []; });

/**
 * THE COVERAGE A PRESS IS FOR (`spec.covers`), each read off what the run did:
 * covered, not covered (the run took another valid path, or failed before
 * it), with why. Never a check: the same outcome may come by another path.
 */
export const COVERAGE = Object.freeze({
  "edit-and-addon": (steps) => {
    const done = partsOf(steps).filter((p) => p && p.status === "done");
    const add = done.some((p) => p.route === "addon"), edit = done.some((p) => p.route && p.route !== "addon" && p.addition !== true);
    return { covered: add && edit, why: `${add ? "an" : "no"} add-on part and ${edit ? "an" : "no"} edit part of the message's own finished` };
  },
  "several-parts": (steps) => {
    const n = partsOf(steps).length;
    return { covered: n >= 2, why: `${n} part(s)` };
  },
  "waits-for-prerequisite": (steps) => {
    const s = (steps || [])[0];
    const r = s ? relationsOf(s) : { relations: [], unread: [], blocked: [] };
    const j = s ? jobOrderVerdict(s) : null;
    return { covered: r.relations.length > 0 && !!j && j.ok && !j.vacuous, why: r.relations.length ? `${r.relations.map((x) => `part ${x.part} waited for part ${x.needs}`).join("; ")}${j && !j.ok ? ` — but ${j.why}` : ""}` : `the routing answer named no order${r.blocked.length ? ` (parts ${r.blocked.join(", ")} were blocked)` : ""}` };
  },
  "addon-sets-aside": (steps) => {
    const s = (steps || [])[0];
    const route = routeCallOf(s && s.network);
    const accepted = route && route.res && route.res.request && Array.isArray(route.res.request.parts) ? route.res.request.parts.length : 0;
    const carved = partsOf([s]).filter((p) => p && p.n >= accepted && p.addition === true);
    return { covered: carved.some((p) => p.status === "done"), why: carved.length ? carved.map((p) => `part ${p.n} "${p.words}" set aside by the add-on step, ${p.status}${p.route ? " @" + p.route : ""}`).join("; ") : `no part was set aside by the add-on step (the request began with ${accepted} part(s))` };
  },
  "step-question": (steps) => {
    const s = (steps || []).find((x) => x && x.mode === "question");
    const q = s && s.question;
    const other = s ? (finalOf(s) || { parts: [] }).parts.filter((p) => p && p.status === "done") : [];
    return { covered: !!q && q.by === "step" && other.length > 0, why: !q ? "no question was asked" : q.by !== "step" ? "the router asked the question, before any request was opened" : other.length ? `part ${q.part} asked while ${other.map((p) => "part " + p.n).join(", ")} finished` : `part ${q.part} asked, and no other part had finished` };
  },
  "answer-resumes": (steps) => {
    const i = (steps || []).findIndex((x) => x && x.mode === "question");
    const q = i >= 0 ? steps[i].question : null;
    const next = i >= 0 ? steps[i + 1] : null;
    const route = routeCallOf(next && next.network);
    const res = route && route.res && typeof route.res === "object" ? route.res : {};
    const ok = !!q && q.by === "step" && !!res.resumed && res.resumed.key === q.key && res.resumed.part === q.part;
    return { covered: ok, why: ok ? `the answer resumed part ${q.part} of request ${q.key}` : !q ? "no question was asked" : !next || !next.sent ? "the answer was not sent" : `the answer's routing names ${res.resumed ? JSON.stringify(res.resumed) : "no resumed part"}` };
  },
  "file-to-later-part": (steps) => {
    const s = (steps || []).find((x) => x && x.file);
    const logo = s ? partsOf([s]).find((p) => p && p.route === "logo") : null;
    return { covered: !!logo && logo.n > 0 && logo.status === "done", why: !logo ? "no part went to the logo step" : logo.n === 0 ? "the logo was the request's first part" : `part ${logo.n}, the logo, read the request's file, ${logo.status}` };
  },
  "closed-tab": (steps) => {
    const s = (steps || []).find((x) => x && x.mode === "away");
    const a = s && s.away;
    const ok = !!a && a.closed === true && a.ended === true && Array.isArray(a.calls) && a.calls.length === 0;
    return { covered: ok, why: !a ? "the tab was not closed" : ok ? `ended ${Math.round((a.endedMs || 0) / 1000)} s after the tab closed, read ${a.reads} time(s) through the list alone` : "the request did not end while the tab was closed" };
  },
});

export function coverageOf({ spec, steps }) {
  return listOf(spec && spec.covers).map((name) => {
    const f = Object.hasOwn(COVERAGE, name) ? COVERAGE[name] : null;
    if (!f) return { name, covered: false, why: "not a coverage this canary knows" };
    try { return { name, ...f(steps) }; } catch (e) { return { name, covered: false, why: `could not be read (${String((e && e.message) || e).slice(0, 80)})` }; }
  });
}

/**
 * THE WHOLE VERDICT OF ONE PRESS: each message's request, the job order, the
 * site's changes and everything else as it was, the replies — and, beside
 * them and never in them, the coverage. Taken whether or not every message was
 * sent, so a stopped press records why it did not pass.
 */
export function requestBatchVerdict({ spec, steps, before, after, served, beforeServed, logo, row, tables, slug }) {
  const checks = [];
  const want = Array.isArray(spec && spec.steps) ? spec.steps : [];
  want.forEach((_, i) => {
    const s = (Array.isArray(steps) ? steps : [])[i];
    if (!s || !s.sent) { checks.push({ name: `message ${i + 1} was sent`, ok: false, why: "it was not sent" }); return; }
    checks.push(...requestStepChecks(s, spec));
    const j = jobOrderVerdict(s);
    checks.push({ name: `message ${i + 1}: no part started before a part it needs had finished${j.vacuous ? " (no part waited for another)" : ""}`, ok: j.ok, why: j.ok ? "" : j.why });
  });
  const o = outcomeChecks({ spec, before, after, served, beforeServed, logo, row, tables, slug });
  checks.push(...o.checks);
  const replies = replyChecks(steps);
  const coverage = coverageOf({ spec, steps });
  return { ok: checks.every((c) => c.ok) && replies.every((c) => c.ok), checks, replies, coverage, newPages: o.newPages };
}
