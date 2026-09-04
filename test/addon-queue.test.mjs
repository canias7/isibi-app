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

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT_RAW = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const HARNESS_RAW = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");

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

// ── THE FORK ──────────────────────────────────────────────────────────────

test("the addon fork mirrors the edit fork, hop for hop", () => {
  const a = addonFork();
  const e = editFork();
  // AN UNVERIFIABLE MARKER IS REFUSED, NOT IGNORED — the hole the edit fork's
  // first cut had, and the addon's must not reopen: a forged header would drop
  // straight into the inline pipeline past the queue, the budget, the lease
  // and `edit_create`'s needs-review refusal.
  assert.match(a, /if \(aRawMarker && !aJob\) return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\)/,
    "an unverifiable replay marker on the addon route no longer refuses the request");
  // THE ENQUEUE IS GATED ON THE VERIFIED JOB, never on the raw header.
  assert.match(a, /if \(!aJob && editAsyncFor\(env, \{ uid: ou\.id, slug: ownerSlug \}\)\)/,
    "the addon enqueue is not gated on the verified job and the same flag+allowlist the edit route uses");
  assert.doesNotMatch(a, /if \(!aRawMarker && editAsync/, "the addon enqueue is gated on the raw header, which a forger controls");
  // THE SAME FLAG AND ALLOWLIST DECIDE BOTH ROUTES — a customer on the canary
  // is on it for the whole site, not for one door.
  assert.match(e, /editAsyncFor\(env, \{ uid: ou\.id, slug: ownerSlug \}\)/, "the edit fork's flag call moved — re-derive the pair");
  // FILED UNDER ITS OWN OP, so an addon and an edit are never one job however
  // their keys fall, and the row says which route's reply a poll hands back.
  assert.match(a, /enqueueReply\(await enqueueEditJob\(env, \{[\s\S]*?op: "addon"[\s\S]*?\}\)\)/, "the addon does not file its job under op addon");
  // AND THE TRACE KNOWS THE JOB, so the durations reach the row.
  assert.match(a, /if \(aJob\) editTraceJob = aJob\.id;/, "a queued addon's trace is not tied to its job");
});

test("the four answers to a filed job are one copy, returned by both routes", () => {
  // The edit route carried bad-idem / needs-review / queue / the receipt
  // inline; the addon route needed the same four, and a second copy of a
  // refusal is one route giving an answer the other does not.
  const defs = (CODE.match(/\nfunction enqueueReply\(q\)/g) || []).length;
  assert.equal(defs, 1, "enqueueReply is not defined exactly once");
  const calls = (CODE.match(/enqueueReply\(await enqueueEditJob\(env, \{/g) || []).length;
  assert.equal(calls, 2, `enqueueReply is returned by ${calls} routes — the two queued routes are the edit and the addon`);
  const fn = between(CODE, "\nfunction enqueueReply(q)", "\nasync function runQueuedSiteEdit", "enqueueReply");
  assert.match(fn, /error: "bad-idem"[\s\S]*?\{ status: 400 \}/, "a missing key is not refused with 400");
  assert.match(fn, /error: "needs-review", job: q\.job[\s\S]*?\{ status: 409 \}/, "a site under review is not refused with 409 naming the job");
  assert.match(fn, /error: "queue", kind: String\(q\.error \|\| ""\) \}, \{ status: 503 \}/, "a queue that would not take it is not a 503");
  assert.match(fn, /poll: "\/api\/site\/edit\/" \+ q\.job/, "the receipt does not say where to poll");
  assert.match(fn, /\{ status: q\.duplicate \? 200 : 202 \}/, "a duplicate is a 202, as if something had been created");
  // NEITHER ROUTE KEEPS ITS OWN COPY of a refusal.
  assert.doesNotMatch(editFork(), /status: 409|status: 400|"queue"/, "the edit fork still carries its own refusals");
  assert.doesNotMatch(addonFork(), /status: 409|status: 400|"queue"/, "the addon fork carries its own refusals");
});

test("the replay identity resolves for exactly the two queued routes, which are exactly the two that file jobs", () => {
  // THE GRANT IS ONE UID, ONE SLUG, ONE RUNNING JOB — and it must reach the
  // addon route, or the consumer's replay of an addon arrives with no token
  // and no identity and is refused as unsigned-in. Derived both ways: the
  // routes named in the condition, and the routes that call the enqueue.
  const m = CODE.match(/const eReplay = \(([^)]*)\) \? editReplayUser\(request, ownerSlug\) : null;/);
  assert.ok(m, "the replay identity line moved or lost its route condition");
  const named = m[1].split("||").map((s) => s.trim()).sort();
  assert.deepEqual(named, ["ad", "ed"], "the replay identity is offered to a different set of routes from the two that file jobs");
  // The two forks live inside those two route blocks and nowhere else.
  // `await` distinguishes a call site from the function's own definition.
  const forks = [...CODE.matchAll(/await enqueueEditJob\(env, \{/g)].map((x) => x.index);
  assert.equal(forks.length, 2, `${forks.length} routes file jobs`);
  const edOpen = at(CODE, "\n          if (ed) {", "edit route");
  const adOpen = at(CODE, "\n          if (ad) {", "addon route");
  const txOpen = at(CODE, "\n          if (tx) {", "text route");
  assert.ok(forks[0] > edOpen && forks[0] < adOpen, "the first fork is not inside the edit route");
  assert.ok(forks[1] > adOpen && forks[1] < txOpen, "the second fork is not inside the addon route");
});

test("the addon body is read as text before the fork, stored verbatim, and parsed once", () => {
  const b = addonBlock();
  const text = at(b, "const abRaw = await request.text()", "text read");
  const fork = at(b, "enqueueEditJob(env, {", "fork");
  assert.ok(text < fork, "the body is not read before the fork, so there is nothing to store");
  assert.match(b, /body: abRaw,/, "the stored request is not the raw body the consumer must replay");
  // `request.json()` consumes the stream; a second read answers nothing.
  assert.doesNotMatch(b, /request\.json\(\)/, "the addon block reads the body twice");
  assert.match(b, /const aInstruction = String\(\(ab && ab\.instruction\) \|\| ""\)/, "the instruction is not read off the one parsed object");
});

// ── THE CLOCK ─────────────────────────────────────────────────────────────

test("every model call on the addon route rides the job's clock", () => {
  const b = addonBlock();
  // ONE WRAPPER, so the clock reaches every small call without one chance per
  // call to forget it — and `aJob` null keeps the flat 240s ceiling.
  assert.match(b, /const aQuick = \(what = ""\) => quickSend\(env, what, aJob && aJob\.budget\);/, "aQuick does not carry the job's budget");
  // TWO DIRECT CALLS SINCE 2026-09-04 (run 36), and the second is the job's
  // clock too, seen through `repairClock`: the repair call holds back the
  // second compile as well as the reserves, which `aQuick`'s view cannot
  // express. Anything else reaching `quickSend` directly is a call off the
  // clock, which is what this guard exists to refuse.
  const bare = [...b.matchAll(/quickSend\(env/g)].length;
  assert.equal(bare, 2, `${bare} calls reach quickSend directly — only aQuick's own definition and the repair round's may`);
  assert.match(b, /quickSend\(env, "repair", repairClock\(aClock\)\)/, "the repair call does not ride the job's clock through repairClock");
  assert.match(b, /const aClock = job && job\.budget && typeof job\.budget\.canRepair === "function" \? job\.budget : null;/,
    "aClock is not the job's own budget, so the repair clock is not the job's");
  const wrapped = [...b.matchAll(/send: aQuick\(/g)].length;
  assert.ok(wrapped >= 3, `only ${wrapped} small calls go through aQuick — the picker, one per kind and the seed net all must`);
  // AND THE PAGE CALL, the one call that does not go through aQuick and the
  // longest: the budget rides the argument `generateSitePages` names for it.
  assert.match(b, /aSrc, "addon", undefined, aJob && aJob\.budget\)/, "the page call runs with no clock under a job");
});

test("cancel and budget are re-asked before the page call and before the publish", () => {
  const b = addonBlock();
  const gen = at(b, "aGen = await generateSitePages(", "page call");
  const pub = at(b, "const aPub = await recompileAndPublish(env, {", "publish");
  const g1 = at(b, 'aJob.gate("editing")', "editing gate");
  const g2 = at(b, 'aJob.gate("build")', "build gate");
  assert.ok(g1 < gen, "the editing gate does not precede the page call");
  assert.ok(gen < g2 && g2 < pub, "the build gate is not between the page call and the publish");
  // EACH ANSWERS THE CUSTOMER THROUGH THE ONE FUNCTION THAT REFUNDS.
  for (const [i, name] of [[g1, "editing"], [g2, "build"]]) {
    const after = b.slice(i, i + 400);
    assert.match(after, /return await editStopped\(env, \{ job: aJob, why: [^,]+, phase: "[a-z]+", trace: editTrace, ctx \}\)/, `the ${name} gate does not stop through editStopped`);
  }
});

// ── THE MONEY ─────────────────────────────────────────────────────────────

test("one bill; reserved before the publish under a job, collected after it synchronously", () => {
  const b = addonBlock();
  const bills = [...b.matchAll(/pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage\)/g)].length;
  assert.equal(bills, 1, `the bill is computed ${bills} times — one number, two paths`);
  // RE-ANCHORED 2026-09-03: the reserve and the collect live in ONE closure
  // now (`aCharge`), because a second answer takes money — the pageless one,
  // a job or an internal function, which publishes nothing — and two copies
  // of the reserve would be two lists of the same thing. The properties are
  // unchanged: under a job the bill is reserved between the bill and the
  // publish; synchronously it is collected after the publish; each is
  // guarded on exactly the job, each way round; the reserve counts only on
  // `ok`; the collect never fails the route.
  // RE-ANCHORED 2026-09-04: the closure took a second parameter — the
  // ledger sequence — when the repair round's spend became a reserve of its
  // own (#2, after the first compile that finds the work). The property is
  // the closure, not its arity.
  const charge = at(b, "const aCharge = async (bill", "charge");
  const chargeEnd = b.indexOf("\n            };", charge);
  assert.ok(chargeEnd > charge, "aCharge does not close");
  const closure = b.slice(charge, chargeEnd);
  const reserve = at(closure, 'editRpc(env, "edit_reserve"', "reserve");
  assert.equal(lastCondition(closure.slice(0, reserve)), "aJob", "the reserve is not guarded on exactly the job");
  const okAt = closure.indexOf("r.ok === true", reserve);
  const noted = closure.indexOf("aJob.noteReserve()", reserve);
  assert.ok(okAt > 0 && noted > okAt, "the reserve is counted before, or without, the ok check");
  assert.match(closure, /return Number\(r\.charged\) \|\| 0;/, "the charge answered is not what the ledger charged");
  assert.match(closure, /try \{ return await collectCredits\(aAuth, bill\); \} catch \{ return 0; \}/, "the synchronous charge lost its never-fail-the-route catch");
  assert.equal((closure.match(/collectCredits\(/g) || []).length, 1);
  const bill = at(b, "const aBill = pageCredits(", "bill");
  const pub = at(b, "const aPub = await recompileAndPublish(env, {", "publish");
  const reserveCall = at(b, "if (aJob) aCost = await aCharge(aBill);", "the page path's reserve");
  // RE-ANCHORED 2026-09-04: the synchronous collect no longer spells `aBill`
  // — it is the same usages plus the repair round's, one `pageCredits` and one
  // rounding — so the landmark is the call and the property is what it bills.
  const collectCall = at(b, "if (!aJob) aCost = await aCharge(", "the page path's collect");
  const collectLine = b.slice(collectCall, b.indexOf("\n", collectCall));
  assert.match(collectLine, /pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, \.\.\.aRepairUsage\)/,
    "the synchronous collect does not bill the same usages as the reserve, plus the repair round's");
  assert.ok(bill < reserveCall && reserveCall < pub, "the reserve does not sit between the bill and the publish — the gate would read the job as unbilled and exempt it");
  assert.ok(pub < collectCall, "the synchronous charge precedes the publish, so a failed compile would cost");
  // UNDER A JOB the round's reserve landed inside the spine (sequence #2) and
  // only what the ledger charged is added to the answer.
  // (`aRepairRound` since the round became the add step's own, handed to the
  // spine's seam and read back off the route's closure, 2026-09-04 — and NOT
  // `aRepair`, which this route already uses for the import dedupe: the two
  // collided once, the Worker would not load, and only a test that compiles
  // the file saw it. test/spine-repair.test.mjs parses it as a module now.)
  const jobAdd = at(b, "else aCost += Number(aRepairRound && aRepairRound.charged) || 0;", "the job path's repair charge");
  assert.ok(jobAdd > collectCall, "the job path adds the repair charge before the collect line — the two paths are not two branches of one decision");
  // AND THE PAGELESS ANSWER TAKES ITS MONEY THROUGH THE SAME CLOSURE, after
  // the schema apply — the work that earns it — and before the page call.
  const pageless = at(b, "if (pageless(aAnswers)) {", "pageless");
  const apply = at(b, "aMade = await applySiteSchema(adb, merged);", "apply");
  const gen = at(b, "aGen = await generateSitePages(", "page call");
  assert.ok(charge > apply && pageless > charge && pageless < gen, "the pageless answer is not between the schema apply and the page call, after the charge closure");
  assert.match(b.slice(pageless, gen), /const aCostNow = await aCharge\(pageCredits\(\.\.\.aDesignUsage, aSeedUsage\)\);/, "the pageless answer does not bill through aCharge");
});

test("the spine is handed the job and the trace, or a queued addon publishes past every gate", () => {
  const b = addonBlock();
  const pub = at(b, "const aPub = await recompileAndPublish(env, {", "publish");
  const call = b.slice(pub, b.indexOf("});", pub));
  assert.match(call, /job: aJob/, "the publish spine is not handed the job — no lease check, no cancel, no billing gate, and finalize would run as if no job existed");
  assert.match(call, /trace: editTrace/, "the publish spine is not handed the trace");
  // The spine's gate reads it — proved in edit-queue.test.mjs; here the hop
  // that carries it is the property.
});

test("enqueueEditJob files under the op it is given, and edit by default", () => {
  const fn = between(CODE, "\nasync function enqueueEditJob(env, {", "\nfunction enqueueReply(q)", "enqueue");
  assert.match(fn, /\{ slug, uid, url, body, idem, op = "edit" \}/, "the enqueue does not take an op that defaults to edit");
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
  assert.match(fn, /body: JSON\.stringify\(\{ instruction: instruction, picker: buildPicker, idem: idem\b[^}]*\}\)/, "the key does not ride the POST");
  // A RECEIPT IS NOT AN OUTCOME: a job with no result is watched, not applied.
  assert.match(fn, /if \(a && a\.ok && a\.job && !a\.result\) \{/, "a 202 receipt is read as the addon's reply");
  assert.match(fn, /EditPoll\.rememberJob\(slug, a\.job\);/, "a filed addon is not remembered for a refresh");
  assert.match(fn, /watchEditJob\(site, d, a\.job, origin, finish, fallback, instruction, undefined, addonAnswer\);/,
    "a filed addon is not watched through the shared watcher with the addon reader");
  // THE ONE READER, BOTH WAYS.
  assert.match(fn, /return addonAnswer\(r && r\.ok, a, \{ site, d, instruction, origin, finish, fallback, slug \}\);/, "the synchronous reply bypasses addonAnswer");
  // THE WORD, not the call: the watcher is handed the reader as a value, with
  // no parenthesis after it.
  const readers = (CHAT.match(/\baddonAnswer\b/g) || []).length;
  assert.equal(readers, 3, `addonAnswer has ${readers} mentions — one definition, the synchronous call and the watcher argument, and no fourth copy`);
});

test("the shared watcher takes a reader and defaults to the edit's", () => {
  const w = between(CHAT, "\nfunction watchEditJob(", "\nfunction cancelEditJob(", "watch");
  assert.match(w, /function watchEditJob\(site, d, job, origin, finish, fallback, instruction, imgs, answer\)/, "the watcher no longer takes a reader");
  assert.match(w, /const reader = typeof answer === 'function' \? answer : editAnswer;/, "the default reader is not the edit's");
  assert.match(w, /return reader\(!!\(r0 && r0\.ok\), once, \{ site, d, instruction, origin, finish, fallback, imgs, handedOff: false, slug \}\);/,
    "the reader is not handed the poll's status and the same options the edit's reader gets");
  // The edit's own call site passes no reader, so nothing about a queued edit changed.
  assert.match(CHAT, /watchEditJob\(site, d, e\.job, origin, finish, fallback, instruction, imgs\);/, "the edit's watch call gained or lost an argument");
});

test("addonAnswer reads the stored reply the way the synchronous tail did, and never rewrites for a lost ask", () => {
  const fn = between(CHAT, "\nfunction addonAnswer(", "\nfunction applyAddonResult(", "addonAnswer");
  const esc = at(fn, "if (a.escalate) {", "escalate");
  const fail = at(fn, "if (!httpOk || !a.ok) {", "failure");
  const apply = at(fn, "return applyAddonResult(a, o);", "apply");
  assert.ok(esc < fail && fail < apply, "escalate, refusal, apply are not read in that order");
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

test("the marker header the consumer sends is the one the addon fork reads", () => {
  // Driven, not read: the constant both ends import.
  assert.equal(REPLAY_HEADER, "x-gf-job");
  assert.match(addonFork(), /request\.headers\.get\(REPLAY_HEADER\)/, "the addon fork reads a different header from the one the consumer sends");
});
