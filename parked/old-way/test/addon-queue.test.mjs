// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-queue.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { REPLAY_HEADER, CONSUMER_CEILING_MS } from "../../../builder/edit-job.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const CHAT_RAW = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const HARNESS_RAW = readFileSync(new URL("../../../scripts/addon-sweep.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");

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

// ── THE CLOCK ─────────────────────────────────────────────────────────────

test("every model call on the addon route rides the job's clock", () => {
  const b = addonBlock();
  // ONE WRAPPER, so the clock reaches every small call without one chance per
  // call to forget it — and `aJob` null keeps the flat 240s ceiling.
  // RE-ANCHORED 2026-10-02 (the owner's second review): the one wrapper is
  // itself wrapped, so every small call is also shown what they already told
  // us (`clarifyTransport`, builder/clarify.mjs) — the clock still rides the
  // `quickSend` inside it, and nothing else reaches `quickSend` (below).
  // RE-ANCHORED 2026-10-09 (the parallel-tasks batch): `jobSend` sits between,
  // so a preparation records each call and a job replays a prepared one; the
  // clock still rides the `quickSend` inside it.
  // RE-ANCHORED 2026-10-12 (after run 141): `aCounted` sits outside
  // `jobSend`, so a call made under the part's page scope is counted on the
  // job (`scoped`), replayed or not; it only counts and hands the request on,
  // and the clock still rides the `quickSend` inside.
  // RE-ANCHORED 2026-10-13 (correction reuse): `aQuick` hands `jobSend` an
  // option (`refusals`, read only by the replayer), and `aCounted` counts
  // after the call — every call made, never a first request a prior refusal
  // answered with no model; it still only counts and hands the request on.
  assert.match(b, /const aQuick = \(what = "", opts\) => clarifyTransport\(aCounted\(jobSend\(aJob, (?:mappedSend\(env, ownerSlug, "site", )?quickSend\(env, what, aJob && aJob\.budget\)\)?, opts\)\), \{/, "aQuick does not carry the job's budget");
  assert.match(b, /const aCounted = \(send\) => async \(req\) => \{\n\s+try \{ const r = await send\(req\); if \(aScoped\) noteSeen\(aJob, "scope"\); return r; \}\n\s+catch \(e\) \{ if \(aScoped && !priorRefusalOf\(e\)\) noteSeen\(aJob, "scope"\); throw e; \}\n\s+\};/, "aCounted does more than count and hand the request on");
  // TWO DIRECT CALLS SINCE 2026-09-04 (run 36), and the second is the job's
  // clock too, seen through `repairClock`: the repair call holds back the
  // second compile as well as the reserves, which `aQuick`'s view cannot
  // express. Anything else reaching `quickSend` directly is a call off the
  // clock, which is what this guard exists to refuse.
  const bare = [...b.matchAll(/quickSend\(env/g)].length;
  // THREE (2026-10-23): aQuick's own definition, the seam's repair round and the compile repair round — both repairs ride `repairClock`.
  // FOUR (2026-10-25, feature-verify): the requirement retry round, the seam's own second pass, rides `repairClock` too.
  assert.equal(bare, 4, `${bare} calls reach quickSend directly — only aQuick's own definition, the two repair rounds and the retry round may`);
  assert.equal([...b.matchAll(/quickSend\(env, "repair", repairClock\(aClock\)\)/g)].length, 3, "a repair call does not ride the job's clock");
  assert.match(b, /quickSend\(env, "repair", repairClock\(aClock\)\)/, "the repair call does not ride the job's clock through repairClock");
  assert.match(b, /const aClock = job && job\.budget && typeof job\.budget\.canRepair === "function" \? job\.budget : null;/,
    "aClock is not the job's own budget, so the repair clock is not the job's");
  const wrapped = [...b.matchAll(/send: aQuick\(/g)].length;
  assert.ok(wrapped >= 3, `only ${wrapped} small calls go through aQuick — the picker, one per kind and the seed net all must`);
  // AND THE PAGE CALL, the one call that does not go through aQuick and the
  // longest: the budget rides the argument `generateSitePages` names for it.
  // RE-ANCHORED 2026-09-17: the call's argument list grew a tail (`kind`,
  // `keep` — which pages to show first on a site too large to show whole), so
  // pinning the budget as the LAST argument was a claim about the signature's
  // length rather than about the clock. The property is that the budget rides
  // the argument after `target`, which is where `generateSitePages` names it.
  // RE-ANCHORED 2026-10-11 (the parallel-work goal): the pages it is shown are
  // `aWriterSrc` — the site, or a prepared part's declared scope of it.
  assert.match(b, /aWriterSrc, "addon", undefined, aJob && aJob\.budget[,)]/, "the page call runs with no clock under a job");
});

test("cancel and budget are re-asked before the page call and before the publish", () => {
  const b = addonBlock();
  const gen = at(b, "aGen = await generateSitePages(", "page call");
  const pub = at(b, "const aPub = await recompileAndPublish(env, {", "publish");
  const g1 = at(b, 'aJob.gate("editing")', "editing gate");
  const g2 = at(b, 'aJob.gate("build")', "build gate");
  assert.ok(g1 < gen, "the editing gate does not precede the page call");
  assert.ok(gen < g2 && g2 < pub, "the build gate is not between the page call and the publish");
  // EACH ANSWERS THE CUSTOMER THROUGH THE ONE FUNCTION THAT REFUNDS — WITH
  // WHAT STANDS (2026-10-07): the outcome its own evidence reads, so a stop
  // after a database was made is never told as one that recorded nothing.
  for (const [i, name] of [[g1, "editing"], [g2, "build"]]) {
    const after = b.slice(i, i + 400);
    assert.match(after, /return await editStopped\(env, \{ job: aJob, why: [^,]+, phase: "[a-z]+", trace: editTrace, ctx, extra: aStopEvidence\(\) \}\)/, `the ${name} gate does not stop through editStopped with its evidence`);
  }
});

// ── THE MONEY ─────────────────────────────────────────────────────────────

test("one bill; reserved before the publish under a job, collected after it synchronously", () => {
  const b = addonBlock();
  const bills = [...b.matchAll(/pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, aPick && aPick\.usage\)/g)].length;
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
  // RE-ANCHORED 2026-09-05 (stage 1a-ii): the bill is the page call alone
  // once #1 went ahead of a schema apply, the whole spend otherwise.
  const bill = at(b, "const aBill = aFirstPlaced ?", "bill");
  const pub = at(b, "const aPub = await recompileAndPublish(env, {", "publish");
  // RE-ANCHORED 2026-09-05 (stage 1a-ii): when sequence #1 went ahead of a
  // schema apply, the page call is its own reserve, #4, and the reply carries
  // the sum; with no backend the one bill is reserved here as before. The
  // property is unchanged — the reserve sits between the bill and the publish.
  const reserveCall = at(b, "if (aJob) aCost = aFirstPlaced ? aFirst + await aCharge(aBill, 4) : await aCharge(aBill);", "the page path's reserve");
  // RE-ANCHORED 2026-09-04: the synchronous collect no longer spells `aBill`
  // — it is the same usages plus the repair round's, one `pageCredits` and one
  // rounding — so the landmark is the call and the property is what it bills.
  const collectCall = at(b, "if (!aJob) aCost = await aCharge(", "the page path's collect");
  const collectLine = b.slice(collectCall, b.indexOf("\n", collectCall));
  // RE-ANCHORED 2026-09-04 (run 39): the translations' usage joined this one
  // collect too (`...aLangUsage`), so the line lists one more spread. The
  // property is the reserve's usages plus the repair round's, plus whatever
  // else the publish spent — one `pageCredits`, one rounding.
  // RE-ANCHORED 2026-09-17: the photographs joined it, as a single
  // `{images: n}` term rather than a spread — `pageCredits` is variadic and a
  // picture is priced at the flat `IMAGE_USD`. The property is unchanged: one
  // `pageCredits`, one rounding, over the reserve's usages plus everything else
  // the route spent, so a trailing non-spread term is admitted and the four
  // named ones are still required.
  assert.match(collectLine, /pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, \.\.\.aRepairUsage(?:, (?:\.\.\.)?\w+)*\)/,
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
  // (Parenthesised since run 39, when the translations' reserve was added to
  // the same sum; the landmark is the round's charge joining the job's cost.)
  const jobAdd = at(b, "else aCost += (Number(aRepairRound && aRepairRound.charged) || 0)", "the job path's repair charge");
  assert.ok(jobAdd > collectCall, "the job path adds the repair charge before the collect line — the two paths are not two branches of one decision");
  // ⚠ AND EVERY RESERVE THIS ROUTE TAKES JOINS THAT SUM — A CENSUS, NOT A LIST
  // (2026-09-17). Under a job each reserve is its own `aCharge(..., n)` call
  // whose answer is kept in an accumulator; the reply's `cost` is this line and
  // nothing else, so an accumulator that does not join it is money the customer
  // paid and was never told about. The names are DERIVED from their own
  // declarations rather than typed, so a sixth reserve added next month fails
  // by existing. The job branch cannot be driven from a route guard (it needs a
  // real queue delivery), which is why the property is read here — and reading
  // it is what makes the reserve a wall rather than a line nobody checks.
  const jobLine = b.slice(jobAdd, b.indexOf("\n", jobAdd));
  const accumulators = [...b.matchAll(/let (a\w+Charged) = 0;/g)].map((m) => m[1]);
  assert.ok(accumulators.length >= 2,
    "no reserve accumulators found — this census is asserting nothing: " + JSON.stringify(accumulators));
  for (const name of accumulators) {
    assert.ok(new RegExp("\\+ " + name + "\\b").test(jobLine),
      `the job path's cost does not add ${name}, so a customer under a job is told a price that is missing it: ${jobLine}`);
  }
  // AND THE PAGELESS ANSWER TAKES ITS MONEY THROUGH THE SAME CLOSURE — after
  // the schema apply and before the page call. RE-ANCHORED 2026-09-05 (stage
  // 1a-ii): the closure is declared ABOVE the apply now, because the apply is
  // preceded by sequence #1 under a job, and a `const` called before its line
  // is a dead zone `node --check` cannot see — the first draft did exactly
  // that. Under a job the pageless answer reports #1; synchronously it still
  // collects here, after the work.
  // RE-ANCHORED 2026-09-05 (stage 8): the apply is a CLOSURE now
  // (`aApplyBackend`, built inside the backend block after sequence #1), run
  // by the pageless path itself — `await aApplyBackend(null)` — and by the
  // seam hook on the page path. So "after the schema apply" is no longer a
  // text position: the pageless block calls the closure BEFORE it takes its
  // money, and sequence #1 still precedes the closure's construction.
  const pageless = at(b, "if (pageless(aAnswers)) {", "pageless");
  const applyClosure = at(b, "aApplyBackend = async (version) => {", "the apply closure");
  const gen = at(b, "aGen = await generateSitePages(", "page call");
  const first = at(b, "aFirst = await aCharge(pageCredits(...aDesignUsage, aSeedUsage));", "sequence #1");
  assert.ok(charge < first && first < applyClosure, "the charge closure is not declared before sequence #1, which sits before the apply closure is built");
  assert.ok(pageless > applyClosure && pageless < gen, "the pageless answer is not between the apply closure and the page call");
  const pl = b.slice(pageless, gen);
  const directApply = at(pl, "await aApplyBackend(null)", "the pageless path's own apply");
  const costAt = at(pl, "const aCostNow = aFirstPlaced ? aFirst : await aCharge(pageCredits(...aDesignUsage, aSeedUsage));", "the pageless charge");
  assert.ok(directApply < costAt, "the pageless answer takes its money before it applies the schema, or does not report #1 under a job, or does not bill through aCharge synchronously");
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

test("the marker header the consumer sends is the one the addon fork reads", () => {
  // Driven, not read: the constant both ends import.
  assert.equal(REPLAY_HEADER, "x-gf-job");
  assert.match(addonFork(), /request\.headers\.get\(REPLAY_HEADER\)/, "the addon fork reads a different header from the one the consumer sends");
});
