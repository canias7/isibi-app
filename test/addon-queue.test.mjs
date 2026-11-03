// The addon route's queue fork (2026-09-03): the edit route's shape, hop for
// hop, read at the layer the edit-queue guards read theirs.
//
// ── WHY ────────────────────────────────────────────────────────────────────
//
// Run 21 — the first addon ever fired on the live site, on the allowlisted
// canary — was reset at 257.6s with ECONNRESET on the inbound socket: nothing
// charged, the site untouched, the harness reporting NO ANSWER. That is the
// ~273s wall the edit path left on 2026-09-01 (273.2s, 273.1s, and the probes'
// 274–300s), met on the one route that was still on the customer's
// connection. An addition is a picker, a designer per kind, a whole page call
// on the pages model and a container compile — four to eight minutes on Grok —
// and no part of it can be made to fit under the wall.
//
// So the addon route files a job through the same queue, and every hop below
// is one the edit route already proved live. A hop missing here is a queued
// addon that publishes past the lease and cancel gates, bills through a bearer
// token it does not carry, runs a model call with no clock, or is never read
// back by the browser. Each of those is silent from outside.
//
// ── WHAT IS READ ───────────────────────────────────────────────────────────
//
// Order and absence, anchored on landmarks, comments blanked first — the
// edit-queue file's conventions. A handful of properties are driven: the
// harness's watch is checked against the consumer's real ceiling, and the
// marker header name against the module that owns it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPLAY_HEADER, CONSUMER_CEILING_MS } from "../builder/edit-job.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const CHAT_RAW = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const HARNESS_RAW = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** Length-preserving comment blanking, string-aware. See wall-probe.test.mjs. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const CODE = blankComments(W);
const CHAT = blankComments(CHAT_RAW);
const HARNESS = blankComments(HARNESS_RAW);

/** `indexOf` that refuses -1, so nothing below asserts about `slice(-1, -1)`. */
function at(src, needle, label) {
  const i = src.indexOf(needle);
  assert.ok(i > 0, `${label}: landmark gone (${needle})`);
  return i;
}

/** A window between two landmarks, proving both exist and are in order. */
function between(src, open, close, label) {
  const a = at(src, open, label);
  const b = src.indexOf(close, a);
  assert.ok(b > a, `${label}: the closing landmark does not follow the opening one (${close})`);
  return src.slice(a, b);
}

/** The condition of the last `if (` in a chunk, counting parentheses (depth-aware — see edit-queue.test.mjs). */
function lastCondition(chunk) {
  const open = chunk.lastIndexOf("if (");
  if (open < 0) return null;
  let depth = 0;
  for (let i = open + 3; i < chunk.length; i++) {
    if (chunk[i] === "(") depth++;
    else if (chunk[i] === ")") { depth--; if (depth === 0) return chunk.slice(open + 4, i).trim(); }
  }
  return null;
}

const addonBlock = () => between(CODE, "\n          if (ad) {", "\n          if (tx) {", "addon block");
const addonFork = () => between(CODE, "const aRawMarker = request.headers.get(REPLAY_HEADER)", "const aQuick = ", "addon fork");
const editFork = () => between(CODE, "const eRawMarker = request.headers.get(REPLAY_HEADER)", "editTrace = newTrace(", "edit fork");

test("the replay identity resolves for exactly the two queued routes, which are exactly the two that file jobs", () => {
  // THE GRANT IS ONE UID, ONE SLUG, ONE RUNNING JOB — and it must reach the
  // addon route, or the consumer's replay of an addon arrives with no token
  // and no identity and is refused as unsigned-in. Derived both ways: the
  // routes named in the condition, and the routes that call the enqueue.
  const m = CODE.match(/const eReplay = \(([^)]*)\) \? editReplayUser\(request, ownerSlug\) : null;/);
  assert.ok(m, "the replay identity line moved or lost its route condition");
  const named = m[1].split("||").map((s) => s.trim()).sort();
  // RE-ANCHORED 2026-09-06 (stage 9): a third route is replayed — the platform
  // rebuild, whose job the CRON files rather than the route itself, and which
  // refuses anything that is not a replay. So the property is no longer "the
  // identity's routes are the routes that file jobs"; it is that every route
  // offered the identity is one the QUEUE replays, and nothing else is. The
  // two halves are asserted apart below.
  assert.deepEqual(named, ["ad", "ed", "rb"], "the replay identity is offered to a different set of routes from the ones the queue replays");
  // WHO FILES. `await` distinguishes a call site from the function's own
  // definition. Two of the three are the customer-facing routes, in their own
  // blocks and nowhere else; the third is the platform rebuild's, filed by the
  // CRON for the site's owner — outside the router entirely, which is what
  // makes the rebuild route replay-only rather than a button.
  // RE-ANCHORED 2026-10-03 (the combined request flow): a FOURTH filer — the
  // request's own driver (`fileRequestJob`), which files each part's step for
  // the request's owner, outside the router like the rebuild's. Its replay is
  // the edit and add-on routes' own (above), and the routing route's, whose
  // replay door is its own and refuses a replay that is not a request's part
  // (asserted below).
  const forks = [...CODE.matchAll(/await enqueueEditJob\(env, \{/g)].map((x) => x.index);
  assert.equal(forks.length, 4, `${forks.length} places file jobs`);
  const edOpen = at(CODE, "\n          if (ed) {", "edit route");
  const adOpen = at(CODE, "\n          if (ad) {", "addon route");
  const txOpen = at(CODE, "\n          if (tx) {", "text route");
  const cron = at(CODE, "async function runSiteRebuild(env) {", "the rebuild drain");
  const driver = at(CODE, "async function fileRequestJob(env, rec, file) {", "the request's driver");
  const driverEnd = at(CODE, "\nasync function offerRequestQuestions(", "the end of the driver's filer");
  const inside = (i, a, b) => forks.filter((x) => x > a && x < b).length === 1;
  assert.ok(driver < driverEnd && inside(0, driver, driverEnd), "the request's driver does not file its parts' jobs in one place");
  const rest = forks.filter((x) => !(x > driver && x < driverEnd));
  assert.ok(rest[0] > cron && rest[0] < edOpen, "the platform rebuild's job is not filed by the cron");
  assert.ok(rest[1] > edOpen && rest[1] < adOpen, "the edit route's fork is not inside the edit route");
  assert.ok(rest[2] > adOpen && rest[2] < txOpen, "the addon route's fork is not inside the addon route");
  // THE ROUTING ROUTE'S OWN REPLAY DOOR: a part's routing job, for its own
  // site, and nothing else — a replay without a request's part is refused.
  const routeOpen = at(CODE, 'if (url.pathname === "/api/site/route" && request.method === "POST") {', "the routing route");
  const door = CODE.slice(routeOpen, routeOpen + 6000);
  assert.match(door, /const rr = editReplayUser\(request, rb\.slug\);\s*if \(!rr\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\);/, "the routing route's replay is not the job's own, for its own site");
  assert.match(door, /if \(rJob && !rPart\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\);/, "the routing route takes a replay that is not a request's part");
});

test("the addon body is read as text before the fork, stored verbatim, and parsed once", () => {
  const b = addonBlock();
  const text = at(b, "const abRaw = await request.text()", "text read");
  const fork = at(b, "enqueueEditJob(env, {", "fork");
  assert.ok(text < fork, "the body is not read before the fork, so there is nothing to store");
  assert.match(b, /body: abRaw,/, "the stored request is not the raw body the consumer must replay");
  // `request.json()` consumes the stream; a second read answers nothing.
  assert.doesNotMatch(b, /request\.json\(\)/, "the addon block reads the body twice");
  // RE-ANCHORED 2026-09-29: the sentence is read off the one parsed object as
  // `aAsked`, and what this turn runs is that sentence less the part the router
  // held back — read off the same object (`heldBack`). RE-ANCHORED 2026-10-02:
  // `heldParts`, the same reading for one part or several (a hand-over carries
  // what a step put off as the router's net too).
  assert.match(b, /const aAsked = String\(\(ab && ab\.instruction\) \|\| ""\)/, "the instruction is not read off the one parsed object");
  assert.match(b, /const aLater = heldParts\(aAsked, ab && ab\.alsoAsked\);/, "what was held back is not read off the one parsed object");
  assert.match(b, /const aInstruction = aLater\.ok \? aLater\.run : aAsked;/, "the add-on does not run the sentence less what was held back");
});

test("enqueueEditJob files under the op it is given, and edit by default", () => {
  const fn = between(CODE, "\nasync function enqueueEditJob(env, {", "\nfunction enqueueReply(q)", "enqueue");
  // RE-ANCHORED 2026-09-06 (stage 9): the parameter object gained `delayS`, so
  // the rebuild's own message can wait out the drain's claim mark. The property
  // is the OP and its default, read without pinning the whole list.
  assert.match(fn, /\{ slug, uid, url, body, idem, op = "edit"[,}]/, "the enqueue does not take an op that defaults to edit");
  assert.match(fn, /p_op: String\(op \|\| "edit"\)/, "the op is not what the row is filed under");
  // The edit route passes none (its calls have no `op:`), the addon route
  // passes its own — so an edit is still `edit` on the row.
  assert.doesNotMatch(editFork(), /op: "/, "the edit route files under an explicit op — the default is the edit's, deliberately");
});

// ── THE BROWSER ───────────────────────────────────────────────────────────

test("siteAddon mints one key per POST and watches a filed job with the addon's own reader", () => {
  const fn = between(CHAT, "\nfunction siteAddon(", "\nfunction addonAnswer(", "siteAddon");
  const mint = at(fn, "const idem = EditPoll.newIdemKey();", "mint");
  const post = at(fn, "apiFetch('/api/site/' + encodeURIComponent(slug) + '/addon'", "post");
  assert.ok(mint < post, "the key is not minted before the POST");
  // RE-ANCHORED 2026-09-03: the body gained the browser's zone (`tz`) for a
  // job's clock time; the property is that the minted key rides the POST.
  assert.match(fn, /body: JSON\.stringify\(\{ instruction: instruction, picker: buildPicker, \.\.\.\(typeof sendEffort === 'function' \? sendEffort\(\) : null\), idem: idem\b[^}]*\}\)/, "the key does not ride the POST");
  // A RECEIPT IS NOT AN OUTCOME: a job with no result is watched, not applied.
  // RE-ANCHORED 2026-09-24 (the owner's validation round): this pinned
  // `if (a && a.ok && a.job && !a.result)`, a truthiness reading that watched
  // `ok: "true"`, a receipt at a 503 and `job: 7`. The property is unchanged — a
  // receipt is watched and not applied — and what decides that it IS one is the
  // one reader of a reply, asked before anything is watched. Which shapes it
  // takes is driven in addon-failure.test.mjs.
  const asked = at(fn, "const said = readAddonReply(r.ok, a);", "the reader");
  const receipt = at(fn, "if (said.act === 'receipt') {", "the receipt branch");
  assert.ok(asked < receipt, "the receipt is decided before the reply is read");
  // RE-ANCHORED 2026-09-05 (stage 2b): the record carries the ask and which
  // route filed the job, so a watch resumed after a refresh reads the reply
  // with THIS route's reader; the property is that a filed addon is
  // remembered, as an addon, with its ask.
  assert.match(fn, /EditPoll\.rememberJob\(slug, \w+\.job, undefined, \{ ask: instruction, op: 'addon'/, "a filed addon is not remembered for a refresh with its ask and route");
  // RE-ANCHORED 2026-09-24: both calls hand on the POST's own latched finish
  // rather than the bare one, so the POST's catch never speaks over a sentence
  // already out. The property is that it is ONE finish, whatever it is called.
  // RE-ANCHORED 2026-10-02: the message's files ride the watch (`imgs`), so a
  // question the queued add-on asks keeps them for the answer.
  const watched = fn.match(/watchEditJob\(site, d, \w+\.job, origin, (\w+), fallback, instruction, imgs, addonAnswer\);/);
  assert.ok(watched, "a filed addon is not watched through the shared watcher with the addon reader");
  // …AND ONLY INSIDE THE BRANCH THE READER OPENED.
  assert.ok(fn.indexOf(watched[0]) > receipt, "a job is watched outside the receipt branch");
  // THE ONE READER, BOTH WAYS.
  // AND THE MESSAGE'S FILES SINCE 2026-10-02 (`imgs`), kept beside a question the add-on asks.
  const read = fn.match(/return addonAnswer\(r && r\.ok, a, \{ site, d, instruction, origin, finish(?:: (\w+))?, fallback, slug, imgs \}\);/);
  assert.ok(read, "the synchronous reply bypasses addonAnswer");
  assert.equal(read[1] || "finish", watched[1], "the queued and the synchronous reply are finished by different functions");
  // THE WORD, not the call: the watcher is handed the reader as a value, with
  // no parenthesis after it. FOUR since stage 2b: the resumed watch picks the
  // same reader, as a value, for a record an addon filed.
  // FIVE SINCE 2026-10-03: a part of a request the server finishes has its
  // job's stored reply read by the same reader (`siteRequestJobReply`).
  // SIX SINCE 2026-10-04: the watcher asks whether the reader it was handed is
  // the add-on's, so a held reply's ending is read by the add-on's own rule
  // (`replyTellsEnding`) — a comparison, never a call.
  // SEVEN SINCE 2026-10-06: a standalone job found from another device has its
  // stored reply said by the same reader, handed no site (`siteJobFollow`).
  const readers = (CHAT.match(/\baddonAnswer\b/g) || []).length;
  assert.equal(readers, 7, `addonAnswer has ${readers} mentions — one definition, the synchronous call, the watcher argument, the resumed watch's reader, a request part's reply, the watcher's comparison and a found job's reply, and no eighth copy`);
  assert.match(between(CHAT, "\nfunction siteJobFollow(", "\nconst editInFlight =", "a found job's reply"), /\(addon \? addonAnswer : editAnswer\)\(!!r\.ok, e, o\)/, "a found job's reply is not read by the routes' own readers");
  assert.match(between(CHAT, "\nfunction siteJobFollow(", "\nconst editInFlight =", "a found job's reply"), /const o = \{ site: null,/, "a found job's reply is handed a site to apply to");
  assert.match(between(CHAT, "\nfunction watchEditJob(", "\nfunction cancelEditJob(", "watch"), /replyTellsEnding\(httpOk, once, reader === addonAnswer\)/, "the watcher's sixth mention is not the comparison");
  assert.match(between(CHAT, "\nasync function siteRequestJobReply(", "\nfunction siteRequestStop(", "a part's reply"), /\(d\.intent === 'addon' \? addonAnswer : editAnswer\)\(!!r\.ok, body, o\)/, "a request part's reply is not read by the routes' own readers");
});

test("the shared watcher takes a reader and defaults to the edit's", () => {
  const w = between(CHAT, "\nfunction watchEditJob(", "\nfunction cancelEditJob(", "watch");
  assert.match(w, /function watchEditJob\(site, d, job, origin, finish, fallback, instruction, imgs, answer, handedOff\)/, "the watcher no longer takes a reader");
  assert.match(w, /const reader = typeof answer === 'function' \? answer : editAnswer;/, "the default reader is not the edit's");
  // THE FINISH IT IS HANDED IS THE ASK'S OWN, or — an ending a written reply
  // tells, its reply still being written (2026-10-04) — that finish behind the
  // one that holds the reply's place (`editReplyHold`).
  assert.match(w, /const httpOk = !!\(r0 && r0\.ok\);/);
  assert.match(w, /const said = held && once && replyTellsEnding\(httpOk, once, reader === addonAnswer\) \? editReplyHold\(origin, w\.job, once, finish\) : finish;/);
  assert.match(w, /return reader\(httpOk, once, \{ site, d, instruction, origin, finish: said, fallback, imgs, handedOff: !!handedOff, slug \}\);/,
    "the reader is not handed the poll's status and the same options the edit's reader gets");
  // The edit's own call site passes no reader, so nothing about a queued edit changed.
  // RE-ANCHORED 2026-09-24: the edit's receipt is read by `readEditReply` now,
  // and its job rides the reader's answer — the property is the argument list.
  assert.match(CHAT, /watchEditJob\(site, d, \w+\.job, origin, finish, fallback, instruction, imgs, undefined, handedOff\);/, "the edit's watch call gained or lost an argument");
});

test("addonAnswer reads the stored reply the way the synchronous tail did, and never rewrites for a lost ask", () => {
  // RE-ANCHORED 2026-09-24 (the owner's validation round). This pinned
  // `if (a.escalate) {` before `if (!httpOk || !a.ok) {` — each field read by
  // truthiness, so `escalate: "false"` hopped and `ok: "false"` printed "✅ Done".
  // One reader decides what a reply is now, and the branches below it are
  // exclusive, so their order is not the property. What is: the reader is asked
  // before any branch, the decision fields are read by NOTHING else here, and
  // the applied branch is the fall-through, reached only when every other act
  // has returned. Which reply reaches which branch is driven in
  // addon-failure.test.mjs.
  const whole = between(CHAT, "\nfunction addonAnswer(", "\nfunction readAddonReply(", "addonAnswer");
  const fn = whole.slice(0, whole.indexOf("\n}\n") + 3);
  assert.ok(fn.length > 3 && fn.endsWith("\n}\n"), "addonAnswer has no end before the reader");
  const asked = at(fn, "const said = readAddonReply(httpOk, a);", "the reader");
  const esc = at(fn, "if (said.act === 'hop' || said.act === 'climb') {", "escalate");
  const fail = at(fn, "if (said.act === 'refusal') {", "refusal");
  const apply = at(fn, "return applyAddonResult(a, o);", "apply");
  assert.ok(asked < esc && esc < fail && fail < apply, "the reader, the escalate, the refusal and the applied branch are not in that order");
  assert.match(fn.slice(apply), /^return applyAddonResult\(a, o\);\s*\}\s*$/, "something follows the applied branch — it is no longer the fall-through");
  // THE DECISION FIELDS HAVE ONE READER. Over the code with comments blanked,
  // since the notes about the old truthiness spell it.
  const code = fn.replace(/\/\/[^\n]*/g, "");
  assert.ok(code.includes("readAddonReply(httpOk, a)"), "the blanked window lost the code it is reading");
  for (const f of ["ok", "escalate", "layer", "page", "job"]) {
    assert.doesNotMatch(code, new RegExp("\\ba\\." + f + "\\b"), "addonAnswer reads a." + f + " itself, beside the one reader");
  }
  // A WATCH RESUMED AFTER A REFRESH holds no ask: an escalate there says so
  // rather than starting a ~25-credit rewrite for a sentence nobody re-typed.
  assert.match(fn, /const canFall = typeof o\.fallback === 'function' && !!o\.instruction;/, "the fallback is not gated on holding the ask");
  const branch = fn.slice(esc, fail);
  assert.match(branch, /if \(!canFall\) \{ o\.finish\(/, "an escalate with no ask falls to a rewrite");
  assert.ok(branch.indexOf("if (!canFall)") < branch.indexOf("return siteEdit("), "the lost-ask case is decided after the hop");
});

// ── THE HARNESS ───────────────────────────────────────────────────────────

test("the harness sends a key, watches a filed job to its stored reply, and its watch outlasts the consumer", () => {
  // RE-ANCHORED 2026-09-03: the body gained `tz` beside the key.
  assert.match(HARNESS, /\/addon`, \{ token: TOKEN, body: \{ instruction: c\.ask, picker: PICKER, idem: hex32\(\)[^}]*\} \}\)/, "the addon POST carries no retry key — the route refuses a queued addition without one");
  assert.match(HARNESS, /if \(p\.status === 202 && p\.json && p\.json\.job\) \{/, "a 202 receipt is judged as the reply");
  // BOTH CALLERS HAND THE WATCH THE TOKEN (run 22): the watch sits at module
  // scope, the token is a local of `main`, and the first cut read `TOKEN`
  // from inside the watch — a ReferenceError on the first poll, five seconds
  // after "watching", while the job it stopped watching went on to publish.
  const watches = (HARNESS.match(/await watchJob\([^)]*, TOKEN\)/g) || []).length;
  assert.equal(watches, 2, `watchJob is awaited with the token ${watches} times — the addition and the photo hop share one watch`);
  const fn = between(HARNESS, "\nexport async function watchJob(job, token,", "\n}\n", "watchJob");
  assert.doesNotMatch(fn, /\bTOKEN\b/, "the watch reads TOKEN, which is not in scope where it is defined");
  assert.match(fn, /x-gf-edit/, "the watch does not read the poll's final header");
  assert.match(fn, /q\.status === 404/, "a 404 is polled past");
  assert.match(fn, /\["failed", "cancelled", "lost"\]/, "a terminal state with no stored reply is polled past");
  // BOUNDED, AND LONGER THAN THE CONSUMER MAY RUN — derived from the loop's
  // default and the sleep, against the module's own ceiling, so a shorter
  // watch cannot report a job that finished late as NO ANSWER.
  const loop = fn.match(/looks = (\d+)/);
  const nap = fn.match(/sleep\((\d+)\)/);
  assert.ok(loop && nap, "the watch's default look count or its sleep moved");
  assert.ok(Number(loop[1]) * Number(nap[1]) >= CONSUMER_CEILING_MS, `the watch gives up after ${Number(loop[1]) * Number(nap[1])}ms, before the consumer's ${CONSUMER_CEILING_MS}ms ceiling`);
  // NO ANSWER, NOT A REFUSAL, when nothing terminal arrived inside the watch.
  assert.match(HARNESS, /why: "no answer inside the watch"/, "a watch that ran out is not reported as NO ANSWER");
});
