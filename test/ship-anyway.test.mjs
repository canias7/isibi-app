// A BUILD MUST NEVER LEAVE THE CUSTOMER WITH NOTHING.
//
// Owner's call 2026-08-25: *"the whole site cant no go live if one step breaks,
// we need to fix that, if one step breaks its gotta ship like that, however it
// is."* Both halves are held here.
//
// THE FAILURE THIS IS WRITTEN AFTER. `helm` and `northgroup` are both 404 with
// every fallback path in this repo intact and none of them reached: Cloudflare
// stops a queue consumer at fifteen minutes, and a stopped isolate publishes
// nothing, logs nothing and answers nobody. Every ceiling we had was four to
// eight times that, so none could fire first.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CONSUMER_MS, BUILD_BUDGET_MS, PUBLISH_RESERVE_MS, CONTAINER_CALL_MS, makeBudget,
} from "../builder/build-budget.mjs";
import { photoWait, imageNote, PHOTO_FLOOR_MS } from "../builder/site-images.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// Comments in this repo argue the thing they sit above, so they spell it —
// prose containing the thing it asserts is this file's most-recorded own-goal.
// Blanked length-preservingly and by WHOLE LINE, so offsets stay valid.
function bare(src) {
  return src
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l))
    .join("\n");
}
const CODE = bare(WORKER);
assert.equal(CODE.length, WORKER.length, "the blanker must preserve length");

/**
 * ONE FUNCTION'S SOURCE, bounded by the next TOP-LEVEL declaration.
 *
 * Both windows here used to run to `svcHeaders`, five declarations away, and
 * both went red on 2026-08-25 the moment `clearPlaceholder` was declared between
 * them — a test about what happens to sit next to the thing it asserts. A
 * landmark that is another declaration's spelling is one the next insert moves;
 * where a function ENDS is a fact about that function.
 */
function topLevel(src, decl) {
  const from = src.indexOf(decl);
  assert.ok(from >= 0, decl + " is gone from worker.js");
  const rest = src.slice(from + decl.length);
  // A top-level doc comment belongs to what follows it, so `/**` closes the
  // window too — `CODE` is blanked here, so that arm rarely fires, and the two
  // copies of this helper stay the same rule rather than two subtly different ones.
  const next = rest.match(/\n(?:\/\*\*|(?:export )?(?:async )?(?:function|class|const|let) )/);
  return rest.slice(0, next ? next.index : rest.length);
}

test("EVERY CEILING SITS UNDER THE ONE CLOUDFLARE ENFORCES", () => {
  // Derived over every `*_MS` the budget module exports rather than a list of
  // the three that exist today — a hand-kept list is exactly what leaves the
  // fourth one unbounded, and an unreachable bound is indistinguishable from no
  // bound at all right up until a build ships nothing.
  assert.ok(BUILD_BUDGET_MS < CONSUMER_MS, `budget ${BUILD_BUDGET_MS} >= consumer ${CONSUMER_MS}`);
  assert.ok(CONTAINER_CALL_MS < CONSUMER_MS, `container ${CONTAINER_CALL_MS} >= consumer ${CONSUMER_MS}`);
  // AND THE MODEL CALLS, which live in worker.js and are resolved rather than
  // matched — a bound asserted by its spelling is one the next edit moves.
  const m = CODE.match(/const BUILDER_CALL_MS = (\d+);/);
  assert.ok(m, "BUILDER_CALL_MS is gone from worker.js");
  assert.ok(Number(m[1]) < CONSUMER_MS, `builder ${m[1]} >= consumer ${CONSUMER_MS}`);
  // THE WAIT ON THE QUEUE TOO. The Worker stops waiting for the consumer at
  // `QUEUE_WAIT_MS`; past the consumer's own ceiling there is nothing left that
  // could ever answer, so a longer wait is a customer held for no reason.
  const q = CODE.match(/const QUEUE_WAIT_MS = ([^;]+);/);
  assert.ok(q, "QUEUE_WAIT_MS is gone");
  // eslint-disable-next-line no-eval
  assert.ok(eval(q[1]) <= CONSUMER_MS + 60000, `the queue wait outlives the consumer it waits for`);
});

test("THE RESERVE IS REAL — it leaves room for the steps that come after the pictures", () => {
  // Measured on `oak-and-ash`, the only frontend build that has published:
  // compile 27,326 + container 111,717 + og 122 + pages 33,996 = 173,161ms.
  // A reserve under that is a reserve that does not reserve anything.
  const MEASURED_TAIL_MS = 173161;
  assert.ok(PUBLISH_RESERVE_MS > MEASURED_TAIL_MS,
    `reserve ${PUBLISH_RESERVE_MS} does not cover the measured tail ${MEASURED_TAIL_MS}`);
  // AND IT LEAVES ROOM TO BUILD. A reserve so large that nothing can be done
  // before it would refuse every build on the platform — the mirror failure,
  // and the cheaper one to make.
  assert.ok(PUBLISH_RESERVE_MS < BUILD_BUDGET_MS / 2,
    "the reserve eats more than half the build");
});

test("THE BUDGET CLEARS THE ONLY BUILD THAT HAS EVER PUBLISHED", () => {
  // `oak-and-ash` ran 594,054ms end to end. A budget under that would have
  // refused the one build we know works, which is how a fix for a 404 becomes a
  // cause of them.
  const PUBLISHED_MS = 594054;
  assert.ok(BUILD_BUDGET_MS > PUBLISHED_MS,
    `budget ${BUILD_BUDGET_MS} would have cut off a build that published in ${PUBLISHED_MS}`);
});

test("THE PLACEHOLDER IS PUBLISHED BEFORE THE EXPENSIVE HALF, not only after it fails", () => {
  // THE HALF THAT SURVIVES BEING KILLED. Every other fallback in this repo needs
  // our code to run at the moment of failure; being stopped by the platform
  // means no code runs. A write that has ALREADY happened needs nothing.
  const early = CODE.indexOf("publishPlaceholder(env, slug, brand, spec, { building: true })");
  const build = CODE.indexOf("buildAndPublishPages(env, {", early > 0 ? early : 0);
  assert.ok(early > 0, "the early placeholder write is gone");
  assert.ok(build > early, "the placeholder is no longer written before the build");
  // AWAITED. Started and not awaited, the isolate can be stopped between
  // deciding to publish it and doing so — the same failure, moved a few hundred
  // milliseconds.
  assert.match(CODE.slice(early - 12, early), /await\s+$/, "the early write is not awaited");
});

test("ONE WRITER, AND IT REFUSES TO OVERWRITE A LIVE SITE", () => {
  const fn = topLevel(CODE, "async function publishPlaceholder(");
  assert.ok(fn.length > 200, "publishPlaceholder is gone");
  // The liveness marker, not `index.html` — Start publishes no top-level HTML,
  // so a head on that document always missed and the guard could never fire.
  assert.match(fn, /head\("sites\/" \+ slug \+ "\/" \+ SITE_LIVE_FILE\)/, "the guard heads the wrong object");
  assert.match(fn, /if \(live\) return false/, "a live site is no longer protected");
  // A READ THAT THROWS IS NOT "nothing is published". Read as an empty slug it
  // would overwrite a working site with a stand-in — the outcome this exists to
  // prevent — so the catch must skip the write rather than fall through to it.
  const put = fn.indexOf(".put(");
  const cat = fn.indexOf("catch");
  assert.ok(put > 0 && cat > put, "the catch no longer sits after the write it must skip");
});

test("A PLACEHOLDER SAYS SO, so nothing mistakes the stand-in for the site", () => {
  // It is published at the site's REAL address, so from outside it is a 200 like
  // any other — and it is now published EARLY, while the build is still running.
  // Without a machine-readable mark a watcher polling for the site to come up
  // reads the stand-in as a finished build.
  assert.match(CODE, /const PLACEHOLDER_MARK = "gofarther-page";/, "the mark is gone");
  // THE TAG IS ONE CONSTANT NOW, and re-anchoring on that is not tidying: the
  // reader of it is a DELETE of a document at the site's own address, so the two
  // spellings drifting apart does not mean "the mark stopped being recognised",
  // it means a publish stops taking its own stand-in down. The old form pinned
  // the inline concatenation and went red the moment it was named — a test about
  // word order, this repo's most repeated own-goal.
  assert.match(CODE, /const PLACEHOLDER_META = "<meta name=\\"" \+ PLACEHOLDER_MARK \+ "\\" content=\\"placeholder\\">";/,
    "the tag is no longer built from the mark");
  const fn = topLevel(CODE, "function schemaPlaceholderPage(");
  assert.match(fn, /\bPLACEHOLDER_META\b/, "the page no longer carries its mark");
  // AND A REAL SITE MUST NOT. The mark is only a signal while exactly one kind
  // of page carries it.
  assert.equal([...CODE.matchAll(/content=\\"placeholder/g)].length, 1,
    "something other than the placeholder claims the mark");
});

test("THE PICTURES GIVE WAY TO THE CLOCK — driven, all three answers", () => {
  // DRIVEN RATHER THAN READ, and that is the whole reason the decision was
  // lifted out of worker.js. My first two guards for this were source-reads
  // pinned to the inline expression and both went red the moment it moved —
  // the same own-goal this file's other re-anchorings record, made twice in one
  // sitting. What the answers MEAN is now a fact three literals can settle.
  const clock = (ms) => ({ remainingMs: () => ms });

  // Time to spare: wait, but only for what sits ABOVE the reserve. Racing the
  // whole remainder would end the wait with nothing left to compile or publish
  // with — a bounded image step and still no site, which fixes nothing.
  const spare = photoWait(clock(BUILD_BUDGET_MS));
  assert.equal(spare.wait, "race");
  assert.equal(spare.ms, BUILD_BUDGET_MS - PUBLISH_RESERVE_MS, "the reserve is not being left unspent");

  // Exactly the reserve, and less: nothing is waited for and nothing is bought.
  assert.equal(photoWait(clock(PUBLISH_RESERVE_MS)).wait, "none");
  assert.equal(photoWait(clock(PUBLISH_RESERVE_MS - 1)).wait, "none");
  assert.equal(photoWait(clock(0)).wait, "none");

  // THIS BLOCK ASSERTED THE BUG UNTIL RUN 37, and the inversion is the fix.
  // It read: one millisecond over the reserve is a `race` — "the boundary is
  // exact rather than approximately right". Exact, and about the wrong
  // quantity: 1ms of headroom bought a photograph nothing could wait for.
  // Whether to START is now the question, and a shot has never been observed to
  // land in under ~24.7s.
  for (const spare of [1, 1000, PHOTO_FLOOR_MS - 1]) {
    const w = photoWait(clock(PUBLISH_RESERVE_MS + spare));
    assert.equal(w.wait, "none", `${spare}ms of headroom still raced`);
    assert.equal(w.buy, false, `${spare}ms of headroom still bought a photograph`);
  }

  // RUN 37 ITSELF, to the millisecond. It reached the image step with 262,422ms
  // left, the race got 22,422ms, and its `compile` mark is 22,422ms — the timer
  // expiring, not an image model finishing. Money spent, an orphan in the
  // owner's library, an og:image on no page, and a message blaming the provider.
  const run37 = photoWait(clock(262422));
  assert.equal(run37.buy, false, "run 37's own clock would still buy a photograph it cannot wait for");

  // …and the boundary that IS exact now: a shot's worth of headroom buys.
  assert.equal(photoWait(clock(PUBLISH_RESERVE_MS + PHOTO_FLOOR_MS)).buy, true);
  assert.equal(photoWait(clock(PUBLISH_RESERVE_MS + PHOTO_FLOOR_MS)).ms, PHOTO_FLOOR_MS);
  assert.equal(photoWait(clock(PUBLISH_RESERVE_MS + PHOTO_FLOOR_MS - 1)).buy, false);
});

test("THE FLOOR IS CALIBRATED AGAINST BUILDS THAT REALLY BOUGHT ONE", () => {
  // A NUMBER MOVED PAST EITHER END GOES RED NAMING WHICH, the discipline
  // BUILD_BUDGET_MS and PUBLISH_RESERVE_MS already live under. The measured band
  // for a build that landed a photograph is 24.7s-32.6s; 110ms and 151ms are
  // builds that bought none.
  assert.ok(PHOTO_FLOOR_MS >= 32600,
    "the floor is under the SLOWEST shot ever observed, so a build can still buy one it cannot wait for");
  // And not so high that an ordinary build stops buying: a whole budget's
  // headroom must comfortably clear it.
  assert.ok(PHOTO_FLOOR_MS < BUILD_BUDGET_MS - PUBLISH_RESERVE_MS,
    "the floor is above the most headroom any build can have, so nothing would ever buy a photograph");
});

test("NO CLOCK — AND NO USABLE CLOCK — MEANS THE OLD BEHAVIOUR EXACTLY", () => {
  // One caller supplies a budget today. A second that knows nothing about a
  // build must wait as this did before the reserve existed, rather than have its
  // pictures cut short by a bound it never set: being wrong that way is silent,
  // and shows up as a site missing photographs nobody can account for.
  //
  // AND A BROKEN CLOCK IS NO CLOCK, which is `build-budget.mjs`'s own rule —
  // refusing a healthy build is the more expensive mistake.
  for (const junk of [undefined, null, {}, { remainingMs: 5 }, { remainingMs: () => NaN },
                      { remainingMs: () => "soon" }, { remainingMs() { throw new Error("clock"); } }]) {
    const w = photoWait(junk);
    assert.equal(w.wait, "all", `${JSON.stringify(junk)} was treated as a clock`);
    assert.equal(w.ms, null);
  }
  // A NONSENSE RESERVE IS THE REAL ONE, never zero. Read as zero it would mean
  // "wait for everything", which is the bug being fixed.
  for (const bad of [0, -1, NaN, "4m", null]) {
    assert.equal(photoWait({ remainingMs: () => PUBLISH_RESERVE_MS - 1 }, bad).wait, "none",
      `a ${String(bad)} reserve stopped reserving`);
  }
});

test("AND THE DECISION IS ACTUALLY WIRED — all three answers are acted on", () => {
  // The layer twelve features in this repo have shipped dead in: `photoWait` can
  // be perfectly correct and its answer discarded, and the symptom would be
  // exactly what it exists to prevent.
  const fn = CODE.slice(CODE.indexOf("async function buySitePhotos("), CODE.indexOf("async function injectGameAssets("));
  assert.ok(fn.length > 400, "buySitePhotos is gone");
  assert.match(fn, /photoWait\(clock\)/, "the image step no longer asks how long it may wait");
  assert.match(fn, /=== "all"[\s\S]{0,80}await shots;/, "the no-clock answer is not acted on");
  assert.match(fn, /=== "race"/, "the race answer is not acted on");
  assert.match(fn, /Promise\.race\(/, "the image step waits unconditionally again");
  // WHATEVER LANDED IS KEPT: what is returned is the map the shots write into,
  // not the resolved value of the race — so giving up on the wait discards no
  // photograph already bought.
  assert.match(fn, /return done\(urls,/, "the photographs already bought are being thrown away");

  // ── AND THE CLOCK BOUNDS THE SPEND, NOT ONLY THE WAIT ────────────────────
  //
  // The half run 37 was missing. `photoWait` could answer `buy: false`
  // perfectly and the shots be fired anyway — which is not a hypothetical, it
  // is precisely what that build did.
  assert.match(fn, /if \(!clockPlan\.buy\) affordable = 0;/,
    "the clock no longer clamps the spend, so a build can buy a photograph it cannot wait for");
  // BEFORE THE SHOTS ARE PLANNED, or the clamp is a value nothing reads.
  const clamp = fn.indexOf("if (!clockPlan.buy) affordable = 0;");
  const planned = fn.indexOf("planImages(pages, affordable)");
  assert.ok(clamp > 0 && planned > clamp,
    "the spend is clamped after the shots are already planned, which changes nothing");

  // ONE READING OF THE CLOCK, USED TWICE. Asking twice is asking a clock that
  // moved in between, so the half that decides to buy and the half that decides
  // to wait could answer differently about one build — which is the exact shape
  // being fixed, reintroduced through the back door.
  const readings = fn.match(/photoWait\(/g) || [];
  assert.equal(readings.length, 1,
    `the clock is read ${readings.length} times; the buy and the wait can disagree`);

  // AND THE CAUSE REACHES THE CUSTOMER. `slow` is what stops this build wearing
  // the image-model-failed sentence, and it is set only when the CLOCK is what
  // took the budget to zero — the discipline `full` already lives under.
  assert.match(fn, /outOfTime \? \{ slow: true \}/, "the out-of-time cause is computed and dropped");
  assert.match(fn, /const outOfTime = affordable === 0 && !clockPlan\.buy && beforeClock > 0;/,
    "`slow` no longer requires the clock to be what zeroed the budget, so it will claim the credit and library cases too");
});

test("the budget's own arithmetic still holds at the new numbers", () => {
  // Driven rather than read: `capMs` is what makes the per-call bounds compose
  // with the build clock, and with the budget finally able to bind it is what
  // decides whether a late call gets what is left or a fresh ten minutes.
  let t = 0;
  const b = makeBudget(BUILD_BUDGET_MS, () => t);
  assert.equal(b.remainingMs(), BUILD_BUDGET_MS);
  assert.equal(b.capMs(CONTAINER_CALL_MS), CONTAINER_CALL_MS, "an early call gets its own ceiling");
  t = BUILD_BUDGET_MS - 30000;
  assert.equal(b.capMs(CONTAINER_CALL_MS), 30000, "a late call must get what is LEFT, not a fresh ceiling");
  t = BUILD_BUDGET_MS + 1;
  assert.ok(b.expired(), "the budget can no longer expire");
  assert.ok(b.capMs(CONTAINER_CALL_MS) > 0, "a spent budget must not hand out a zero-length signal");
});
