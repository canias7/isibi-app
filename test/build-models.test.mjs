// The Builder picker, and the chain that makes it do anything.
//
// This control shipped, sat in the composer with a tooltip promising a choice,
// and was read ZERO times: `body.picker` appeared nowhere in worker.js and both
// build calls hardcoded `claude-sonnet-5`. That is the failure this repo keeps
// recording — a feature dead at one layer while every other layer is fine — and
// it has been dead at five layers at once before now.
//
// So the tests here run in two halves. The first is ordinary unit testing of the
// allow-list. The second is a REACHABILITY CHAIN, derived from the source at
// both ends, because any one broken link puts the control straight back to being
// decoration and nothing else in the suite would notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILD_MODELS, DEFAULT_PICKER, modelsFor } from "../builder/build-models.mjs";
import { MODEL_RATES, buildFloor, MIN_CREDITS, SCHEMA_PROFILE, SEED_PROFILE, pageCredits } from "../builder/publish-pages.mjs";
import { pagesRequest } from "../builder/page-gen.mjs";
import { buildPathFn } from "./fixtures/build-path.mjs";

// What `use_credits` grants an account on first touch — the Postgres RPC's
// number, restated because this file cannot reach the database. If it moves
// there and not here, the guard below silently starts checking the wrong
// budget, which is why it is named rather than inlined.
const FREE_GRANT = 20;

const ROOT = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), "utf8");
// Comments are BLANKED, never removed, so offsets stay valid against the real
// text — the mistake this codebase made three separate times in one session.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const worker = read("worker.js");
const workerCode = code(worker);
const chat = read("public/chat.js");

test("the pickers resolve to the models they promise, and Grok is the default", () => {
  // `quick` JOINED 2026-08-31 — the model for the small calls: the intent router,
  // the lane picker, and the text/data/nav/picture/rules/tweak/seed rungs. It was
  // a hardcoded `claude-haiku-4-5` in eight modules until run 93 died on an
  // Anthropic billing refusal with the whole cheap ladder behind that one
  // provider, while builds on Grok carried on fine. Owner's call: the picked
  // model does everything.
  assert.deepEqual(modelsFor("sonnet"), { picker: "sonnet", design: "claude-sonnet-5", pages: "claude-sonnet-5", quick: "claude-sonnet-5" });
  assert.deepEqual(modelsFor("opus"), { picker: "opus", design: "claude-opus-5", pages: "claude-opus-5", quick: "claude-opus-5" });
  // AND NO PICKER MAY LEAVE A PROVIDER BEHIND. The whole point of the change is
  // that a customer on Grok has no Anthropic in their path at all, so `quick`
  // being some other family's model would restore exactly the outage it was
  // made to end. Derived from the entry rather than listed again.
  for (const key of Object.keys(BUILD_MODELS)) {
    const m = modelsFor(key);
    assert.equal(m.quick, m.design,
      "`" + key + "` sends its small calls to a different model from its build — a second provider is back in that customer's path");
  }
  // THE DEFAULT IS THE CHEAP ONE, and that is a decision rather than a habit:
  // a cold Opus schema call is 15 credits against a 20-credit grant, which left
  // a new account unable to finish its own first build. Asserted against the
  // real floor below rather than pinned as a name, so the two cannot disagree.
  // GROK FROM 2026-08-22 (owner's call) — see builder/build-models.mjs for the
  // two reasons, of which the load-bearing one is that a new account could not
  // build cold on Sonnet and can on Grok.
  assert.equal(DEFAULT_PICKER, "grok");
  assert.deepEqual(modelsFor(), modelsFor("grok"));
  // `auto` was removed the same day it was wired. A stored picker from those
  // hours must resolve to the default, not to an undefined pair.
  assert.ok(!Object.hasOwn(BUILD_MODELS, "auto"), "auto is back — check the grant covers a ~23-credit build");
  // DERIVED, not pinned to a spelling — this named "sonnet" and went red on a
  // correct flip of the default. What it is about is that a stored picker the
  // table no longer has resolves to WHATEVER the default is, and that claim
  // needs no edit the next time the default moves.
  assert.deepEqual(modelsFor("auto"), modelsFor(DEFAULT_PICKER), "a stale stored picker must fall back to the default");
});

test("the default picker's build fits inside the free grant", () => {
  // THE REGRESSION, PINNED. Wiring the picker made `auto` real, `auto` put the
  // schema call on Opus, and a cold Opus schema call is 15 credits against a
  // grant of 20 — leaving less than `MIN_CREDITS`, so the pages call was refused
  // and the customer paid 15 for a placeholder. Measured by `build smoke` going
  // red on the first run after the merge, with `stage: "credits"`.
  //
  // No unit test could have caught it: they all asserted the picker sends the
  // right model and prices it correctly, which it did. Nothing modelled a whole
  // build against a real starting balance. This is that test.
  // THE SHORTFALL IS PINNED, NOT WISHED AWAY, and that reversal is the point.
  //
  // This used to assert the floor FITS. It stopped being true twice over, and
  // the second time is an audit fix rather than a regression: `buildFloor`
  // priced the designer call alone while the same deposit settles designer PLUS
  // the seed top-up, so the gate passed and the build was then refused for want
  // of credits HAVING ALREADY CHARGED. Pricing both is correct and moved the
  // floor 20 -> 22.
  //
  // It was already false before that, for a different reason nobody had folded
  // in: the routing call spends 1 credit BEFORE the gate is reached, so a floor
  // of exactly the grant was still one credit short. The owner's decision
  // (recorded in CLAUDE.md) is NOT to raise the grant — `build smoke` runs as a
  // funded account instead — so what this file owes the reader is the number,
  // kept current, rather than a green tick over a claim that stopped holding.
  //
  // Asserted as an EXACT relationship so movement in EITHER direction goes red:
  // shrinking the cold schema call, or raising the grant, must come here and
  // re-record it. A `>=` would let the gap widen silently, which is how the
  // original claim rotted.
  // ── AND IT FITS AGAIN FROM 2026-08-22, WHICH IS WHY THE PIN BELOW IS GONE.
  //
  // The shortfall was 3 credits and the fix was not the grant: it was the
  // default picker. `buildFloor("claude-sonnet-5")` is 22 and
  // `buildFloor("grok-4.6")` is 16, so flipping DEFAULT_PICKER to grok took a
  // cold first build from 23 to 17 against a grant of 20. The separate pin that
  // recorded the shortfall told this guard exactly what to do when it closed —
  // "delete this pin and tighten the guard above to include ROUTING_CREDITS" —
  // and that is what happened.
  //
  // ROUTING IS COUNTED HERE NOW rather than in a second test, because the whole
  // reason the old claim rotted is that the two halves lived apart and only one
  // of them was maintained.
  const floor = buildFloor(modelsFor().design);
  const need = floor + ROUTING_CREDITS;
  assert.ok(need <= FREE_GRANT,
    "a new account can no longer build cold: floor " + floor + " + " + ROUTING_CREDITS +
    " routing = " + need + " against a grant of " + FREE_GRANT + ". Either the schema call " +
    "got dearer or the default picker moved to a costlier model — this is the regression " +
    "`auto` was reverted for, and the customer sees it as paying for a placeholder.");
  // AND THE HEADROOM IS RECORDED, not just the direction. A guard that only says
  // "it fits" goes quiet as the margin erodes to nothing; this goes red while
  // there is still room to act.
  assert.ok(FREE_GRANT - need >= 2,
    "a cold first build fits with only " + (FREE_GRANT - need) + " credits to spare — " +
    "re-measure SCHEMA_PROFILE and decide before it stops fitting at all");
  // And the expensive option genuinely does not fit, or this guard is passing
  // because the floor stopped meaning anything.
  assert.ok(buildFloor(BUILD_MODELS.opus.design) > FREE_GRANT,
    "Opus now fits in the grant — restoring `auto` may be worth revisiting");
});

test("every choice is genuinely a different one, not one wearing two labels", () => {
  // The whole point of wiring this was that every option produced byte-identical
  // requests. A change that collapses any two of them back together brings that
  // state back, and every other test here would still pass. Derived from the
  // table rather than counting to a number, so removing `auto` did not need this
  // test edited — and adding one back cannot slip past it.
  const seen = new Set(Object.keys(BUILD_MODELS).map((k) => {
    const m = modelsFor(k);
    return m.design + "|" + m.pages;
  }));
  assert.equal(seen.size, Object.keys(BUILD_MODELS).length, "two pickers now send the same pair of models");
});

test("picker is an ALLOW-LIST, and a prototype key is not a model", () => {
  // `picker` comes out of a request body. An unknown value is not a model id to
  // pass to the API, it is a field to ignore.
  for (const junk of ["", "haiku", "gpt-4", "OPUS", "auto ", 7, null, undefined, {}, ["opus"]]) {
    assert.equal(modelsFor(junk).picker, DEFAULT_PICKER, JSON.stringify(junk) + " was not refused");
  }
  // SHIPPED ONCE ALREADY, in the Stripe plan lookup: `PLANS[String(body.plan)]`
  // accepted "__proto__" and "constructor" because both are truthy, and Stripe
  // was sent `unit_amount: "undefined"`.
  for (const k of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    const m = modelsFor(k);
    assert.equal(m.picker, DEFAULT_PICKER, k + " resolved through the prototype");
    assert.equal(typeof m.design, "string");
    assert.equal(typeof m.pages, "string");
  }
  // No argument at all is the default too — that is what `pagesRequest` and
  // `designSiteSchema` fall back to, and what a caller offering no choice gets.
  assert.deepEqual(modelsFor(), modelsFor(DEFAULT_PICKER));
  assert.ok(Object.hasOwn(BUILD_MODELS, DEFAULT_PICKER), "the default names no picker");
});

test("every model a picker can select has a price", () => {
  // The pair that decides whether wiring this shipped a silent undercharge.
  // Derived from both files rather than listed, because a model added to one and
  // not the other is invisible: `ratesFor` falls back rather than throwing.
  for (const [key, pair] of Object.entries(BUILD_MODELS)) {
    for (const half of ["design", "pages"]) {
      assert.ok(Object.hasOwn(MODEL_RATES, pair[half]),
        `picker "${key}" sends ${pair[half]} for ${half} and nothing prices it`);
    }
  }
});

// ── the chain ────────────────────────────────────────────────────────────────

test("the composer sends the picker on a build AND on a revise", () => {
  // THE REVISE DID NOT SEND IT AT ALL. So the one path where somebody has
  // already seen a result and is reaching for a better model was the path that
  // could not ask for one — a gap that looks exactly like the feature working.
  const i = chat.indexOf("const body = mode === 'build'");
  assert.ok(i > 0, "the send body moved; this guard is now watching nothing");
  const block = chat.slice(i, i + 500);
  const halves = block.split("slug: site.slug");
  assert.equal(halves.length, 2, "the build/revise split is no longer recognisable here");
  assert.match(halves[0], /picker: buildPicker/, "a build sends no picker");
  assert.match(halves[1], /picker: buildPicker/, "a revise sends no picker");
});

test("the build route resolves the picker ONCE and gives it to both calls", () => {
  assert.match(workerCode, /const models = modelsFor\(body\.picker\)/,
    "the route does not read body.picker through the allow-list");
  // Both calls, by name. Reading the field and then not using it is precisely
  // the state this whole change was fixing.
  // NOT ANCHORED ON THE CLOSING PAREN. This was `models\.design\)` and went red
  // the day the designer gained a fourth argument (the site's current state on
  // an edit) — a correct change failing a test about arity, which is this repo's
  // recurring source-guard bug.
  assert.match(workerCode, /designSiteSchema\(env, briefWithLinks, models\.design\b/,
    "the designer is not given the chosen model");
  assert.match(workerCode, /model: models\.pages/,
    "page generation is not given the chosen model");
  // ONCE. Two resolutions of one field is how the designer and the pages end up
  // on models chosen by two different readings of it.
  assert.equal((workerCode.match(/modelsFor\(body\.picker\)/g) || []).length, 1);
});

test("the model reaches the API, and the same one reaches the meter", () => {
  // Both calls build a request object and then stamp the usage from `req.model`,
  // so the model we bill for is the model we sent. A literal in either place is
  // a fourth copy of a model id and a place for the two to diverge.
  // THE SLICE ENDS AT THE NEXT FUNCTION, NOT AT A DISTANT LANDMARK. The first
  // draft ran both windows to the same far-off anchor, so the designer's window
  // swallowed the pages call — and a mutation deleting the designer's own stamp
  // SURVIVED, satisfied by the other function's copy a hundred lines below.
  const nextFn = (from) => {
    const m = /\n(?:async )?function [A-Za-z]/.exec(workerCode.slice(from + 1));
    return m ? from + 1 + m.index : workerCode.length;
  };
  // ONE OF THE TWO MOVED. `generateSitePages` is in build-call.mjs so the
  // container can make it; `buildPathFn` follows it by name and throws if it is
  // on neither file, so the vacuous case still fails loudly.
  for (const fn of ["designSiteSchema", "generateSitePages"]) {
    const found = buildPathFn(fn);
    const body = found.file === "worker.js"
      ? workerCode.slice(workerCode.indexOf("async function " + fn), nextFn(workerCode.indexOf("async function " + fn)))
      : found.body;
    assert.ok(body.length > 500 && body.length < 20000, fn + ": the window is not one function");
    assert.ok(!/model:\s*"claude-/.test(body), fn + " hardcodes a model again");
    assert.match(body, /model:\s*req\.model/, fn + " does not price what it sent");
  }
});

const nextResearchFn = (from) => {
  const m = /\n(?:export )?(?:async )?function [A-Za-z]/.exec(workerCode.slice(from + 1));
  return m ? from + 1 + m.index : workerCode.length;
};

test("research does NOT follow the picker, and is priced at what it sent", () => {
  // A STATED DECISION, pinned. Research is a factual lookup — run these
  // searches, report what came back — which is the step in a build where the
  // model matters least, and the server-side search tool is versioned per model,
  // so moving it is a way to break searching entirely in exchange for nothing
  // anybody would see. Left unpinned, that is a price change and a tool-version
  // risk that no test would mention.
  const i = workerCode.indexOf("async function siteWebResearch");
  assert.ok(i > 0, "the research call is gone; this guard watches nothing");
  // BOUNDED BY THE NEXT FUNCTION, whatever it is. This closed at
  // `generateSitePages`, which left worker.js — so `indexOf` answered -1 and
  // `slice(i, -1)` silently swept the whole rest of the file into the window,
  // which is the vacuous shape rather than a failure.
  const body = workerCode.slice(i, nextResearchFn(i));
  assert.match(body, /const RESEARCH_MODEL = "claude-sonnet-5"/,
    "research changed model — the web_search tool is versioned per model, so this needs proving, not assuming");
  assert.ok(!/models\.(design|pages)/.test(body), "research started following the Builder picker");
  // ONE CONSTANT, SENT AND BILLED, and the two assertions have to name
  // DIFFERENT lines or one satisfies the other. A bare /model: RESEARCH_MODEL/
  // for the request was answered by the usage line below it, so a mutation
  // putting a literal back in the request survived — the overlapping-window
  // mistake, a third time, in one change.
  assert.match(body, /model: RESEARCH_MODEL,\s*\n\s*max_tokens:/, "the request does not use the constant");
  assert.match(body, /searches: 0, model: RESEARCH_MODEL/, "the usage does not name what was sent");
  assert.ok(Object.hasOwn(MODEL_RATES, "claude-sonnet-5"));
});

test("pagesRequest honours an explicit model and defaults to the picker's", () => {
  const args = { brief: "a cafe", spec: { tables: [] }, brand: "Cafe" };
  assert.equal(pagesRequest(args).model, modelsFor().pages, "the default is not the default picker's");
  assert.equal(pagesRequest({ ...args, model: "claude-opus-5" }).model, "claude-opus-5");
  // Everything else about the request is unchanged by the choice — the cached
  // system block especially, since a different prompt would mean a different
  // cache entry and the picker would quietly cost a cache write.
  const a = pagesRequest(args);
  const b = pagesRequest({ ...args, model: "claude-opus-5" });
  assert.deepEqual(a.system, b.system, "changing the model changed the cached prefix");
  assert.deepEqual(a.messages, b.messages);
  assert.equal(a.max_tokens, b.max_tokens);
});

test("the response says which models actually ran", () => {
  // The RESOLVED picker, never `body.picker`. Echoing back what was sent reports
  // a typo as if it had been honoured — which is the exact state this control
  // spent its whole life in, and the reason nobody noticed.
  assert.match(workerCode, /models: \{ picker: models\.picker/, "the build response hides which models ran");
  assert.ok(!/picker: body\.picker/.test(workerCode), "the response echoes the request instead of the resolution");
});

test("Effort is visible and inert, and that is a DECISION", () => {
  // Owner's call 2026-08-08: "leave the effort thing off, leave it there but
  // doesn't work, i want it like that". Pinned because "we forgot" and "we
  // decided" look identical in a list of controls a year later — the same reason
  // `toast` has a test saying it was refused rather than overlooked.
  // RENDERED, not merely defined. The first draft matched `buildEffortHTML()`
  // anywhere in the file, which its own definition satisfies — so a mutation
  // dropping the call out of the composer markup SURVIVED with the control gone
  // from the screen. Same shape as the Bookmarks guard that matched its own
  // explanatory comment.
  const render = chat.indexOf("buildPickerHTML() +");
  assert.ok(render > 0, "the composer no longer renders the Builder control");
  assert.match(chat.slice(render, render + 200), /buildEffortHTML\(\) \+/,
    "the Effort control was removed; it is meant to stay visible");
  assert.match(chat, /effort: buildEffort/, "the composer stopped sending effort");
  // And the build route must still not read it. `/api/direct` does — that is a
  // different feature — so this is scoped to the builder's own handler.
  const i = workerCode.indexOf("const models = modelsFor(body.picker)");
  assert.ok(i > 0);
  const route = workerCode.slice(i, workerCode.indexOf("models: { picker: models.picker", i));
  assert.ok(route.length > 1000, "the build route block could not be located");
  assert.ok(!/body\.effort/.test(route), "the build route now reads body.effort — was that deliberate?");
});

test("the whole build is affordable before anything is spent", () => {
  // THE FIX FOR THE REGRESSION ABOVE. The route used to charge the deposit,
  // run the schema call, settle it — and only then did `publishPages` read the
  // ledger, find less than MIN_CREDITS and refuse to generate. The pages model
  // was never called at all: we spent their budget on step one and then declined
  // to do step two, which is ours and not theirs.
  const w = workerCode;
  const i = w.indexOf("const floor = buildFloor(models.design);");
  assert.ok(i > 0, "the build no longer checks it can afford itself");
  // BEFORE the schema call, or it is the same bug with an extra number in it.
  const design = w.indexOf("designSiteSchema(env, briefWithLinks");
  assert.ok(design > 0 && i < design, "the affordability check runs after the model call it is meant to gate");
  // ANCHORED ON A LANDMARK, not on a byte count. This was `w.slice(i, i + 900)`
  // and went red on a correct change: `floor` moved a few lines up so BOTH credit
  // refusals could quote it, which pushed `creditBack` to exactly +900 —
  // excluded by the slice — and `Sonnet 5` to +1290. A window sized in bytes is a
  // test about how much comment sits inside it, which is this repo's
  // most-recorded own-goal.
  const end = w.indexOf('tr.at("gate")', i);
  assert.ok(end > i, "the gate mark moved — rescope this");
  const block = w.slice(i, end);
  assert.ok(block.length > 400, "the affordability window is empty — rescope this");
  // Off the ledger value the deposit returned, not a second read that could race.
  assert.match(block, /balanceAfter \+ SITE_BUILD_FEE < floor/, "the floor is compared against something else");
  // The deposit comes BACK — nothing was spent, so this is a refusal and not a
  // failure. Without it the gate itself takes 2 credits for doing nothing.
  assert.match(block, /creditBack\(env, bu\.id, SITE_BUILD_FEE\)/, "the refusal keeps the deposit");
  assert.match(block, /status: 402/);
  // And it names the way out that is not "give us money" — the customer picking
  // Opus with 20 credits can simply pick Sonnet.
  assert.match(block, /Sonnet 5/, "an Opus refusal does not mention the option that would work");
});

test("`cost` means the same thing on both of the route's credit refusals", () => {
  // IT MEANT TWO THINGS ONE LINE APART. The deposit refusal answered
  // `cost: SITE_BUILD_FEE` (2 — what was being taken) and the floor refusal
  // `cost: floor` (20 — what a build needs), on consecutive branches of the same
  // route, so a caller reading the field could not act on it. Introduced by the
  // floor branch being inserted directly below a pre-existing refusal.
  //
  // AND THE DEPOSIT BRANCH CARRIED NO `msg`, while `public/chat.js` renders
  // `d.msg` and falls back to a sentence with no figure in it — so the customer
  // most likely to be short was the one told the least.
  // ANCHORED ON CODE, NOT ON A COMMENT. `workerCode` is comment-stripped, so a
  // first draft anchored on the prose above the deposit found nothing, indexOf
  // answered -1, and the window opened at the GAME route's `let balanceAfter;`
  // — sweeping in refusals that have nothing to do with this one. The vacuous
  // window, in the test written to fix a different one.
  const w = workerCode;
  const at = w.indexOf("const floor = buildFloor(models.design);");
  assert.ok(at > 0, "the affordability gate moved — rescope this");
  const block = w.slice(at, w.indexOf('tr.at("gate")', at));
  assert.ok(block.length > 400, "the credit-refusal window is empty — rescope this");

  const costs = [...block.matchAll(/cost: (\w+)/g)].map((m) => m[1]);
  assert.ok(costs.length >= 2, `only ${costs.length} credit refusals found — the scan stopped matching`);
  assert.deepEqual([...new Set(costs)], ["floor"],
    "the route's credit refusals disagree about what `cost` means: " + costs.join(", "));

  // EACH BRANCH SAYS SOMETHING, asserted per branch rather than by counting.
  // A count over the whole window passed with the deposit's `msg` deleted,
  // because the neighbouring 503's own `msg` kept the total up — a mutation
  // proved it. What matters is that THIS refusal speaks, not that the region
  // contains enough colons.
  const dep = block.slice(0, block.indexOf("balanceAfter + SITE_BUILD_FEE < floor"));
  assert.ok(dep.length > 100, "the deposit refusal moved — rescope this");
  const depRefusal = dep.slice(dep.indexOf("not enough credits"));
  assert.ok(depRefusal.length > 40, "the deposit refusal is gone — rescope this");
  assert.match(depRefusal, /msg:/,
    "the deposit refusal carries no msg, so the customer sees the generic sentence with no figure in it");
  assert.match(depRefusal, /floor/, "the deposit refusal does not quote what a build actually needs");

  // …and it quotes NO balance, deliberately: `use_credits` answers -1 for "the
  // bill exceeds the balance" and that is also where an unparseable RPC answer
  // lands, so a figure there is a claim we cannot support.
  assert.doesNotMatch(dep, /and you have/, "the deposit refusal quotes a balance it may not know");
});

test("the floor is derived from the price table, not a number somebody typed", () => {
  // Two models, two floors, and the dear one must really be dearer — a floor
  // computed from a constant would satisfy every other assertion here while
  // being wrong for one of the two pickers.
  const s = buildFloor("claude-sonnet-5");
  const o = buildFloor("claude-opus-5");
  assert.ok(o > s, "an Opus build's floor is not higher than a Sonnet one's");
  assert.ok(s > MIN_CREDITS, "the floor forgot the schema call entirely");
  // Exactly the calls the same deposit settles, plus what the pages call needs,
  // so every half stays visible rather than being folded into one tuned number.
  //
  // THE SEED CALL BELONGS IN HERE, and leaving it out was the defect: the gate
  // priced the designer alone while `schemaSettlement` bills designer AND seed
  // top-up, so the floor passed and the build was then refused for want of
  // credits having already charged the customer.
  //
  // PASSED AS SEPARATE PARTS, never pre-added: `pageCredits` is variadic and
  // rounds ONCE, and summing two separately-rounded figures charges twice for
  // the rounding — this repo's own lesson, and the reason the assertion mirrors
  // the call shape instead of the arithmetic.
  assert.equal(s, pageCredits({ ...SCHEMA_PROFILE, model: "claude-sonnet-5" }, SEED_PROFILE) + MIN_CREDITS);
  // And the seed half is REALLY in there. Without this the line above is
  // satisfied by a floor that dropped it, since it restates the same call.
  assert.ok(s > pageCredits({ ...SCHEMA_PROFILE, model: "claude-sonnet-5" }) + MIN_CREDITS,
    "the floor stopped pricing the seed top-up — the gate is back to under-estimating the bill it guards");
  // The profile is a MEASUREMENT and is cold on purpose: a gate that
  // under-estimates takes the money and then refuses to finish.
  assert.ok(SCHEMA_PROFILE.cacheWrite > 0 && SCHEMA_PROFILE.cacheRead === 0,
    "the profile went warm — the gate will now under-estimate the case it exists for");
});

test("the composer offers exactly the pickers that exist, and no more", () => {
  // DERIVED AT BOTH ENDS. A mutation adding `auto` back to the rendered list
  // survived everything: the composer would offer an option the server resolves
  // to the default, so the customer picks Opus-plans-Sonnet-builds and silently
  // gets Sonnet — a control lying about what it does, which is the exact state
  // this whole feature was fixing.
  // THE RENDERED LIST IS NOW DERIVED FROM `BUILD_PICKERS` (2026-08-21), which
  // is strictly better than the hand-written array this used to read: a fourth
  // picker added to the map renders without anybody remembering the loop. So
  // the drift that remains — and what this now checks — is between that MAP and
  // the server's own. Asserted that the menu really is derived, or a later edit
  // could hardcode a list again and this guard would be measuring the map while
  // the screen showed something else.
  const declared = Object.keys(BUILD_MODELS).sort();
  assert.match(chat, /Object\.keys\(BUILD_PICKERS\)\.map\(\(k\) => \{ const m = BUILD_PICKERS/,
    "the picker menu no longer renders from BUILD_PICKERS; this guard would check the wrong thing");
  const block = chat.slice(chat.indexOf("const BUILD_PICKERS = {"), chat.indexOf("const BUILD_PICKER_KEY"));
  assert.ok(block.length > 50, "could not read BUILD_PICKERS — this guard would be vacuous");
  const offered = [...block.matchAll(/^\s*(\w+):\s*\{\s*label:/gm)].map((m) => m[1]).sort();
  assert.deepEqual(offered, declared,
    "the composer offers " + offered.join("/") + " and the server knows " + declared.join("/"));

  // And the LABELS exist for each, or the menu renders "undefined".
  for (const k of declared) {
    assert.ok(new RegExp("\\b" + k + ":\\s*\\{\\s*label:").test(chat), k + " has no label in the composer");
  }
});

test("a picker stored from the hours `auto` existed falls back", () => {
  // It is in real browsers' localStorage. Without the fallback the button
  // renders `undefined` and every build sends a picker the server ignores —
  // visible to the customer as the control having broken.
  // DERIVED FROM THE SERVER'S OWN DEFAULT, never a spelling. This pinned
  // 'sonnet' twice and went red on a correct flip — a test about word order,
  // which is this repo's most repeated own-goal. Written this way it needs no
  // edit the next time the default moves, and it still fails if only one of the
  // two client sites is updated.
  assert.match(chat, new RegExp("if \\(!BUILD_PICKERS\\[buildPicker\\]\\) buildPicker = '" + DEFAULT_PICKER + "';"),
    "a stale stored picker is no longer repaired to the server's default");
  assert.match(chat, new RegExp("localStorage\\.getItem\\(BUILD_PICKER_KEY\\) \\|\\| '" + DEFAULT_PICKER + "'"),
    "the composer default disagrees with the server default");
  // The two defaults must BE the same, not merely both look right.
  assert.ok(chat.includes("'" + DEFAULT_PICKER + "'"), "the composer never names the server's default");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE JOURNEY, NOT THE STEP. `buildFloor <= FREE_GRANT` models the build in
// isolation, and a real first build is not in isolation: the customer types a
// brief, that goes through `/api/site/route` first, and a routing call rounds up
// to the 1-credit floor however cheap the model is. So the balance the build
// actually meets is the grant MINUS that.
//
// It is the difference between passing and failing right now. Measured
// 2026-08-13 with the re-taken SCHEMA_PROFILE: the floor is exactly 20 against a
// grant of exactly 20 — green with zero headroom — while a real new customer
// arrives at the gate with 19 and is refused.
const ROUTING_CREDITS = 1;

// THE COLD-BUILD SHORTFALL PIN WAS DELETED 2026-08-22, BY ITS OWN INSTRUCTION.
//
// It recorded, as a fact rather than a requirement, that a cold first build did
// not fit inside the free grant — and said what to do when that stopped being
// true: "Delete this pin and tighten the guard above to include ROUTING_CREDITS."
// Flipping DEFAULT_PICKER to grok closed it (23 -> 17 against a grant of 20), so
// the guard above now counts routing and asserts it FITS, with a headroom floor
// so the margin cannot erode back to nothing quietly.
//
// Recorded rather than silently removed: "we decided against it" and "we forgot"
// look identical in a diff a year later.

test("NO SMALL CALL PINS ITS OWN MODEL — the edit path follows the picker", () => {
  // THE REGRESSION THIS EXISTS FOR (run 93, 2026-08-31). Every classifier and
  // cheap rung on the platform carried a hardcoded `claude-haiku-4-5`, so a
  // customer who had picked Grok still had Anthropic in their path. Anthropic
  // refused on billing and the whole cheap ladder went down — the router, the
  // lane picker, and all eight rungs — while builds carried on fine because
  // generation was already on the picked model. A `css` edit answered 503 in
  // 5.3 seconds having spent nothing, and the lane under test never ran.
  //
  // Nothing asserted that, and nothing would have: each module's constant read
  // perfectly sensibly on its own, and the coupling was only visible by looking
  // at all eight at once. That is what this does.
  const MODULES = ["site-ask", "site-lanes", "site-apply", "site-nav",
    "site-picture", "site-rules", "site-tweak", "site-seed"];
  // A MODEL ID AS A STRING LITERAL. Deliberately both families — pinning Grok
  // here would be the same mistake wearing the other provider's name, and the
  // point is that these follow the picker rather than that they avoid Anthropic.
  const PINNED = /["'](?:claude-[a-z0-9.-]+|grok-[0-9][a-z0-9.-]*)["']/g;

  const offenders = [];
  let scanned = 0;
  for (const name of MODULES) {
    const src = read("builder/" + name + ".mjs");
    // BLANK THE COMMENTS FIRST. Every one of these modules now carries a note
    // explaining that the model is no longer `claude-haiku-4-5` — so an
    // unblanked scan reports the fix as the defect it fixed, which is this
    // repo's most-recorded own-goal.
    const body = code(src);
    scanned++;
    for (const m of body.matchAll(PINNED)) {
      offenders.push(name + ": " + m[0] + " at line " + body.slice(0, m.index).split("\n").length);
    }
  }
  // THE OBSERVER IS ALIVE. A typo'd path would read eight empty strings and
  // report a clean sweep over nothing.
  assert.equal(scanned, MODULES.length);
  for (const name of MODULES) {
    assert.ok(read("builder/" + name + ".mjs").length > 1000, name + " read as almost nothing — this scan proves nothing");
  }

  assert.deepEqual(offenders, [],
    "these modules pin a model instead of taking the picker's:\n  " + offenders.join("\n  ") +
    "\nEvery small call resolves through `modelsFor(picker).quick`, so one provider having a bad day " +
    "cannot take down a customer who chose the other. See BUILD_MODELS.");

  // AND THE SCAN CAN SEE ONE — without this, a regex that matched nothing and a
  // blanker that blanked everything both look like compliance.
  assert.equal([...code('const M = "claude-haiku-4-5";').matchAll(PINNED)].length, 1,
    "the scan cannot see a pinned Anthropic model");
  assert.equal([...code('const M = "grok-4.6";').matchAll(PINNED)].length, 1,
    "the scan cannot see a pinned xAI model");
  assert.equal([...code('// it was "claude-haiku-4-5" until run 93').matchAll(PINNED)].length, 0,
    "a model named in a comment is being read as a pin — every one of these modules has such a comment");
});
