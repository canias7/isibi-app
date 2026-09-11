// A BUILD THAT SHIPPED NOTHING, AT A STAGE THAT IS OURS, IS NOT PAID FOR — AND
// THE SCREEN SAYS WHAT THE LEDGER DID (2026-09-11, owner: "yes merge and go on
// the charging one").
//
// MEASURED LIVE on `saltmarsh-kayak-co`. Two builds, both producing no site:
// the first died at `stage: "build"` (vite could not resolve an import our own
// prompt never specified), the second at `stage: "resume"` (the collector gave
// up). **19 credits taken between them — `:deposit` and `:settle` on each — and
// not one reversal row**, while the browser told the customer "you weren't
// charged".
//
// THE RULE WAS ALREADY WRITTEN AND GOVERNED ONE OF THE TWO CHARGES.
// `ourFault(stage)` is `!CHARGED_STAGES.has(stage)`, and `CHARGED_STAGES` is
// `published`, `validate`, `home`, `typecheck` — the model output's own
// failures. `build`, `resume`, `publish`, `generate` and anything unrecognised
// are OURS by its own stated design. `publishPages` asks it before billing the
// PAGE call, which is why neither failed build has a `:pages` row; the DESIGN's
// deposit and settle are taken by the route BEFORE the page call, and every
// other `refundFields()` on that route sits in an early refusal above it. So
// once a build had started, nothing could reverse it.
//
// WHAT IS DRIVEN HERE AND WHAT IS READ, said plainly. The route's post-build
// reversal cannot be reached by `test/credit-debit.test.mjs`'s harness — that
// one makes the design call THROW, which is how it reaches the design catch, so
// it never gets to a build outcome at all. So the two REVERSAL FUNCTIONS are
// cut out of their files and RUN against stubs, and the three call sites are
// read by their own conditions. A read is the weaker instrument and it is used
// only where the stronger one cannot go.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ourFault, CHARGED_STAGES } from "../builder/publish-pages.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// Whole-line comments only, length preserving. Never the general `//` blanker:
// it eats the `)` after a "https://…" and swallows the rest of the file.
const blankJs = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));

/**
 * Cut one `function name(...) { … }` out of a source by brace depth.
 *
 * `async` IS PART OF THE DECLARATION and cutting from `function` drops it —
 * which is not a subtle failure (`await is only valid in async functions`) but
 * it IS a silent one in the other direction: a function whose body happens not
 * to await would come back sync and pass. Taken with the keyword when it is
 * there, and the cut is proved to still parse by the `new Function` below.
 */
function fnSource(src, name) {
  let at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is not declared — rescope this guard");
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  assert.fail(name + " never closes");
}

/* ───────────────────── the reversal the collector uses, driven ───────────── */

// `refundBuildByRef` is not exported — worker.js exports a fetch handler and
// nothing else — so it is cut out and run with `reverseCredits` stubbed. That
// is a drive of the REAL function, not a re-implementation of it: a second copy
// here would agree with itself for ever.
function loadRefund(reverse, extra = {}) {
  const steps = /const BUILD_DEBIT_STEPS = ([^;]+);/.exec(WORKER);
  const whole = /const REVERSE_WHOLE = (\d+);/.exec(WORKER);
  assert.ok(steps && whole, "BUILD_DEBIT_STEPS or REVERSE_WHOLE moved — rescope this guard");
  const body = [
    "const BUILD_DEBIT_STEPS = " + steps[1] + ";",
    "const REVERSE_WHOLE = " + whole[1] + ";",
    fnSource(WORKER, "refundBuildByRef"),
    "return { refundBuildByRef, REVERSE_WHOLE, BUILD_DEBIT_STEPS };",
  ].join("\n");
  return new Function("reverseCredits", "console", body)(reverse, { error: () => {}, log: () => {}, ...extra });
}

const OK = (refunded, debited = refunded) => ({ ok: true, refunded, already: 0, debited, repeat: false });
/** What `reverseCredits` answers when it could not tell — its own `none`. */
const NONE = { ok: false, refunded: 0, already: 0, debited: 0, repeat: false };

test("the collector's reversal returns every step of a build, by ref", async () => {
  const asked = [];
  const { refundBuildByRef, REVERSE_WHOLE, BUILD_DEBIT_STEPS } = loadRefund(async (env, uid, ref, reason, amount) => {
    asked.push({ ref, reason, amount });
    return OK(ref.endsWith(":deposit") ? 2 : ref.endsWith(":settle") ? 7 : 0, ref.endsWith(":pages") ? 0 : 5);
  });
  const r = await refundBuildByRef({}, "u1", "build:job1", "refund");

  // EVERY step, under the build's own ref, and the ask is the ceiling — the
  // LEDGER bounds the refund at `least(p_amount, debited − already)`, so the
  // caller never carries a second copy of what the row holds.
  assert.deepEqual(asked.map((a) => a.ref), BUILD_DEBIT_STEPS.map((s) => "build:job1:" + s));
  assert.ok(asked.every((a) => a.amount === REVERSE_WHOLE), "a step asked for something other than the whole");
  assert.ok(asked.every((a) => a.reason === "refund"), "the reason did not reach the ledger");
  assert.deepEqual(r, { returned: 9, short: false });
});

test("a step that was never debited is not a reversal that fell short", async () => {
  // `credit_reverse` answers `{ok: true, refunded: 0, debited: 0}` for a ref
  // with no row — which is EVERY build that died before the pages debit. Read
  // as short, every single failed build would report money still owed.
  const { refundBuildByRef } = loadRefund(async () => OK(0, 0));
  assert.deepEqual(await refundBuildByRef({}, "u1", "build:job1", "refund"), { returned: 0, short: false });
});

test("a ledger that could not answer is SHORT, never a clean zero", async () => {
  // THE FIRST DRAFT OF THIS FUNCTION GOT IT WRONG and the fixture is why it is
  // pinned. It tested `r.debited > 0` to tell "nothing to reverse" from "could
  // not reverse" — and `reverseCredits`' own `none` carries `debited: 0` as
  // well, so a dead ledger would have been swallowed as "there was nothing to
  // give back". `ok` is the only field that separates them.
  const { refundBuildByRef } = loadRefund(async () => NONE);
  assert.deepEqual(await refundBuildByRef({}, "u1", "build:job1", "refund"), { returned: 0, short: true });

  // AND ONE BAD STEP AMONG GOOD ONES still reports short, rather than being
  // averaged away by the two that worked.
  const { refundBuildByRef: mixed } = loadRefund(async (e, u, ref) => (ref.endsWith(":settle") ? NONE : OK(2)));
  const r = await mixed({}, "u1", "build:job1", "refund");
  assert.equal(r.short, true, "a step that could not be reversed was not reported");
  assert.equal(r.returned, 4, "the steps that DID reverse were not counted");
});

test("no ref and no account are a no-op, not a reversal of nothing", async () => {
  let called = 0;
  const { refundBuildByRef } = loadRefund(async () => { called++; return OK(1); });
  assert.deepEqual(await refundBuildByRef({}, "u1", "", "refund"), { returned: 0, short: false });
  assert.deepEqual(await refundBuildByRef({}, "", "build:job1", "refund"), { returned: 0, short: false });
  assert.equal(called, 0, "the ledger was called with no ref or no account");
});

// A CENSUS, because the steps are a list in one file and minted in another.
// `debitRef(step)` in the route mints `build:<id>:<step>`; this is the only
// place outside that closure that has to name them, and a fourth step added
// next month must not be left un-reversed on the path that cannot see it.
test("BUILD_DEBIT_STEPS is every step the route actually debits under", () => {
  const w = blankJs(WORKER);
  const minted = new Set();
  for (const m of w.matchAll(/debitRef\("([a-z]+)"\)/g)) minted.add(m[1]);
  // The pages debit spells its own suffix inline rather than going through
  // `debitRef`, so it is read from that spelling.
  for (const m of w.matchAll(/billRef \+ ":([a-z]+)"/g)) minted.add(m[1]);
  assert.ok(minted.size >= 3, "the scan found only " + minted.size + " debit steps — it has drifted");
  const listed = JSON.parse(/const BUILD_DEBIT_STEPS = Object\.freeze\((\[[^\]]*\])\)/.exec(WORKER)[1].replace(/'/g, '"'));
  assert.deepEqual([...minted].sort(), [...listed].sort(),
    "a step the route debits is not in BUILD_DEBIT_STEPS, or the other way round");
});

/* ─────────────────────────── the three call sites, read ──────────────────── */

test("the route reverses a build that shipped nothing at a stage that is ours", () => {
  const w = blankJs(WORKER);
  // BOTH CONDITIONS. Without the first, a salvaged site that IS live would be
  // refunded; without the second, a `typecheck` failure — the model's own
  // output, and the commonest real one — would go free.
  assert.match(w, /if \(pages\.page !== "app" && ourFault\(pages\.stage\)\) await refundFields\(\);/,
    "the route no longer reverses a build that shipped nothing at an our-fault stage");
  // AND IT IS IMPORTED. Until this change `ourFault` was named in three
  // comments in worker.js and called in none of them.
  assert.match(w, /import \{[^}]*\bourFault\b[^}]*\} from "\.\/builder\/publish-pages\.mjs";/,
    "ourFault is not imported into worker.js, so the line above cannot run");
  // BEFORE THE REPLY IS COMPOSED, because `refundFields` rewrites `schemaCost`
  // and the reply's `cost` reads it. Asserted by position against the reply's
  // own landmark, with both ends proved present.
  const rev = w.indexOf('if (pages.page !== "app" && ourFault(pages.stage))');
  const cost = w.indexOf("cost: schemaCost + pages.cost,", rev);
  assert.ok(rev > 0 && cost > rev, "the reversal no longer runs before the reply reads schemaCost");
});

test("the collector reverses on both of its exits", () => {
  const w = blankJs(WORKER);
  // The returned-but-placeholder exit, on the same two conditions as the route.
  assert.match(w, /if \(pages && pages\.page !== "app" && ourFault\(pages\.stage\)\) \{\s+const r = await refundBuildByRef\(env, claimed\.uid, design\.billRef, "refund"\);/,
    "a collected build that shipped nothing no longer reverses");
  // The throw exit — `saltmarsh-kayak-co`'s second build — which is
  // unconditional because every answer packed there is `stage: "resume"`.
  const catchAt = w.indexOf('ok: false, stage: "resume", error: "the build failed"');
  assert.ok(catchAt > 0, "the collector's failure reply moved — rescope this");
  const before = w.slice(Math.max(0, catchAt - 1200), catchAt);
  assert.match(before, /await refundBuildByRef\(env, claimed\.uid, design\.billRef, "refund"\)/,
    "the collector's failure exit takes the money and says nothing");
  // AND IT CANNOT THROW OVER A NAMED FAILURE: a reversal that throws inside the
  // catch of a failed build would replace a diagnosis with an exception.
  assert.match(before, /try \{[\s\S]*refundBuildByRef[\s\S]*\} catch \(re\) \{[\s\S]*rFailShort = true;/,
    "the collector's reversal is unguarded, or a throw there goes unreported");
  // BOTH exits say when a reversal did not land.
  assert.match(w, /\.\.\.\(rShort \? \{ refundShort: true \} : \{\}\),/, "the collected reply cannot say a reversal fell short");
  assert.match(w, /\.\.\.\(rFailShort \? \{ refundShort: true \} : \{\}\),/, "the failed reply cannot say a reversal fell short");
});

test("`billRef` survives into the resume record, or the collector has no ref to reverse", () => {
  const w = blankJs(WORKER);
  // `design` is `buildArgs` minus a named few. If `billRef` ever joins that
  // list, the collector's reversal silently becomes a no-op — `refundBuildByRef`
  // answers `{returned: 0, short: false}` for an empty ref, which reads exactly
  // like a build that owed nothing.
  const m = /const \{ ([^}]*) \} = buildArgs \|\| \{\};/.exec(w);
  assert.ok(m, "the resume record's destructure moved — rescope this");
  assert.ok(!/\bbillRef\b/.test(m[1]), "billRef is stripped from the stored design, so the collector cannot reverse");
});

test("the stages that are ours are the stages this change relies on", () => {
  // Read from the real module, both directions, so the fix cannot be quietly
  // widened or narrowed by an edit to `CHARGED_STAGES` alone.
  for (const s of ["build", "resume", "publish", "generate", "", null, undefined, "something-new"]) {
    assert.equal(ourFault(s), true, "`" + s + "` stopped being our fault, so a failed build there now charges");
  }
  for (const s of [...CHARGED_STAGES]) {
    assert.equal(ourFault(s), false, "`" + s + "` became our fault, so the model's own output now goes free");
  }
});

/* ──────────────────────── what the screen says, driven ───────────────────── */

function loadWords() {
  const body = [
    fnSource(CHAT, "buildCostWords"),
    fnSource(CHAT, "buildErrOutcome"),
    "return { buildCostWords, buildErrOutcome };",
  ].join("\n");
  return new Function(body)();
}

test("the screen says what the ledger did, and nothing when it cannot tell", () => {
  const { buildCostWords, buildErrOutcome } = loadWords();

  // WHAT IT USED TO SAY UNCONDITIONALLY, now said only when it is true.
  assert.equal(buildCostWords({ cost: 0, short: false }), " You weren’t charged.");
  // WHAT IT COULD NEVER SAY.
  assert.equal(buildCostWords({ cost: 10, short: false }), " You were charged 10 credits.");
  assert.equal(buildCostWords({ cost: 1, short: false }), " You were charged 1 credit.", "the singular is not written");

  // CANNOT-TELL IS SILENCE, NEVER A ZERO — the whole point. A connection lost
  // mid-build reads nothing off the wire, and guessing "you weren't charged"
  // there is the same false claim in a different place.
  for (const shape of [null, undefined, {}, { cost: null }, { cost: undefined }, { cost: "0" },
    { cost: NaN }, { cost: Infinity }, { cost: -1 }, { cost: ["0"] }]) {
    assert.equal(buildCostWords(shape), "", "it spoke about money for " + JSON.stringify(shape));
  }

  // A REVERSAL THAT DID NOT LAND OUTRANKS A ZERO. `cost: 0` with `refundShort`
  // means we tried to give it back and could not, which is the one case where
  // claiming nothing was charged would be worst.
  assert.equal(buildCostWords({ cost: 0, short: true }), "", "a short reversal still claimed nothing was charged");

  // THE OUTCOME IS BUILT FROM THE SERVER'S OWN REPLY, and a reply that carried
  // no cost answers null rather than 0 — which is what keeps the silence above
  // reachable at all.
  assert.deepEqual(buildErrOutcome("c1", { cost: 9, refundShort: true }), { chatId: "c1", cost: 9, short: true });
  assert.deepEqual(buildErrOutcome("c1", {}), { chatId: "c1", cost: null, short: false });
  assert.deepEqual(buildErrOutcome("c1", null), { chatId: "c1", cost: null, short: false });
  assert.deepEqual(buildErrOutcome("c1", { cost: "9" }), { chatId: "c1", cost: null, short: false },
    "a non-number cost was coerced — String([\"9\"]) is \"9\", and this is where that gets in");
});

test("the card and the rail read the ONE sentence, and the literal is gone", () => {
  const c = blankJs(CHAT);
  // THE LITERAL IS GONE FROM BOTH. The card's was a string with no response in
  // scope at all; the rail's was the catch-all's fallback.
  assert.doesNotMatch(c, /didn’t go through — you weren’t charged/, "the card still asserts a charge it has not read");
  assert.doesNotMatch(c, /come together — you weren’t charged/, "the rail still asserts a charge it has not read");
  // BOTH READ THE SAME FUNCTION. Two readings would disagree on the first
  // reply that carried a cost the card rendered and the rail did not.
  assert.equal((c.match(/buildCostWords\(/g) || []).length, 3,
    "the cost sentence is written in a number of places other than its one definition and its two readers");
  assert.match(c, /<div class="st-err-b">' \+ esc\('That change didn’t go through\.' \+ buildCostWords\(siteErr\)\)/,
    "the error card does not read the outcome");
  assert.match(c, /'That didn’t come together\.' \+ buildCostWords\(siteErr\) \+ ' Try again in a moment\.'/,
    "the chat rail does not read the outcome");
  // AND THE CARD HAS SOMETHING TO READ. `siteErr` carried a chat id and nothing
  // else, which is why the sentence could only ever be a literal.
  assert.match(c, /siteErr = buildErrOutcome\(origin, d\);/, "siteErr no longer carries what the reply said");
});
