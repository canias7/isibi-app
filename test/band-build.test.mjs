// A BUILD DECIDES TO SPLIT, FIRES N CALLS, AND ASSEMBLES ONE PAGE
// (2026-09-09, owner: "ok go build it").
//
// `test/page-bands.test.mjs` proves the MODULE — the splitter, the request, the
// assembler — and `test/model-fanout.test.mjs` proves the container holds N
// calls at once. This file proves the hop between them, which is the one that
// has never existed and is the one this repository keeps shipping dead: a value
// computed and never forwarded, a module nobody calls, a decision made in a
// place the answer cannot reach.
//
// WHAT EACH CASE IS FOR, and every one is a way the split ships looking right:
//
//   * the flag asked in the wrong file — `readCanaryList` is deliberately not
//     imported into `worker.js`, and a second copy of that reader is the
//     widening-by-typo failure it exists to prevent;
//   * the RESUME re-asking the flag, which a deploy can flip under a build in
//     flight — and neither wrong answer fails loudly: a list handed to the
//     single-call reader writes nothing, one answer handed to the assembler
//     stubs every band;
//   * `resumeFanout` computed at the collector and never forwarded, which is
//     the wiring trap by name;
//   * the no-fan-out fallback deleted, so a minute of an asynchronous image
//     rollout is a minute of failed builds rather than a minute of single
//     calls;
//   * the module missing from the image's COPY line, which is a container that
//     dies at import with the sentence a customer reads as "our build service
//     was restarting".
//
// THE STRONGEST CASE HERE IS THE LAST ONE. Everything above is a claim about
// text; only running the real orchestration against a fake container — out-of-
// order answers, one call failed — and PARSING what comes out answers "would
// this build have shipped a page".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { splitPlan, generateSiteBands, bandFile, bandName, bandsFromAnswers } from "../builder/page-bands.mjs";
import { bandSplitFor, bandSplitEveryone, readCanaryList } from "../builder/edit-job.mjs";
import { readGenReport, resumeDecision, noFanoutError, isNoFanout, NO_FANOUT_NAME } from "../builder/build-resume.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
// WHOLE-LINE COMMENTS BLANKED, LENGTH PRESERVED. Every offset below stays
// honest and no scan can be satisfied by prose that names the thing it forbids
// — which this repository has hit nine times, several of them inside the guard
// written for that trap.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const WORKER = read("worker.js");
const WCODE = code(WORKER);

/** Window from landmark to landmark, both asserted, the closing one searched
 *  FROM the opening one — `indexOf(end)` alone finds an earlier mention and
 *  gives `slice(bigger, smaller)`, the empty string, which passes everything
 *  inside it. */
function between(src, open, close, what) {
  const a = src.indexOf(open);
  assert.ok(a >= 0, what + ": the opening landmark is gone — " + open);
  const b = src.indexOf(close, a + open.length);
  assert.ok(b > a, what + ": the closing landmark is gone — " + close);
  return src.slice(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DOOR
// ─────────────────────────────────────────────────────────────────────────────

test("the split is off unless somebody switched it on, and both doors work", () => {
  assert.equal(bandSplitFor({}, { slug: "fretwork-1" }), false, "nothing set must split nothing");
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "" }, { slug: "fretwork-1" }), false);
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "-" }, { slug: "-" }), false, "`-` is the deploy default and means nobody");

  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "fretwork-1" }, { slug: "fretwork-1" }), true);
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "fretwork-1" }, { slug: "someone-else" }), false);
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "fretwork-1 crookes-guitar" }, { slug: "crookes-guitar" }), true, "a list is a list");
  // MATCHED ON EITHER, because the two questions a canary asks are different:
  // one account's every build, or one site's every build whoever makes it.
  const uid = "11111111-2222-3333-4444-555555555555";
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: uid }, { uid, slug: "any" }), true);
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: uid }, { slug: "any" }), false);

  assert.equal(bandSplitFor({ BAND_SPLIT_EVERYONE: "on" }, { slug: "any" }), true);
  assert.equal(bandSplitFor({ BAND_SPLIT_EVERYONE: "yes" }, { slug: "any" }), true);
  // EVERYONE STILL NEEDS SOMEBODY: a call with no string identity has nothing
  // to route, under the wide door exactly as under the narrow one.
  assert.equal(bandSplitFor({ BAND_SPLIT_EVERYONE: "on" }, {}), false);
  assert.equal(bandSplitEveryone({ BAND_SPLIT_EVERYONE: "off" }), false);
  assert.equal(bandSplitEveryone({ BAND_SPLIT_EVERYONE: true }), false, "a non-string is not an affirmative word");
});

test("a non-string identity is refused, never coerced", () => {
  // `String(["fretwork-1"])` is `"fretwork-1"`, shipped as a real bug three
  // times here — and the direction it fails in is WIDENING a canary.
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "fretwork-1" }, { slug: ["fretwork-1"] }), false);
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "fretwork-1" }, { uid: ["fretwork-1"] }), false);
  assert.equal(bandSplitFor({ BAND_SPLIT_EVERYONE: "on" }, { slug: ["x"] }), false);
  assert.equal(bandSplitFor({ BAND_SPLIT_EVERYONE: "on" }, { slug: 7 }), false);
});

test("the canary list is not read in worker.js, and the band door is why that still holds", () => {
  // The runtime diagnostic's own comment states this as a security property: a
  // route one edit away from the list is a route one edit away from handing one
  // customer another's slugs. The band flag needed the same list, so the risk
  // was a SECOND copy of the reader landing here — asked in edit-job.mjs
  // instead, answering a boolean.
  assert.ok(!/\breadCanaryList\b/.test(WCODE), "readCanaryList is imported or called in worker.js");
  assert.ok(/\bbandSplitFor\b/.test(WCODE), "the band door is not asked in worker.js at all");
  // And the door really is the one that reads the list.
  assert.ok(/readCanaryList\(env && env\.BAND_SPLIT_CANARY\)/.test(code(read("builder/edit-job.mjs"))),
    "bandSplitFor no longer resolves the canary through the one reader");
  // The reader is unchanged and still has NO WILDCARD, which is what makes
  // "nobody by default" survive a typo in the secret: `*` is dropped outright,
  // and `all` — the other thing somebody would type meaning everybody — is
  // admitted as the ordinary SLUG it looks like, matching a site called `all`
  // and nothing else. Widening to the platform is its own variable and cannot
  // be what a mistyped allowlist does.
  assert.deepEqual(readCanaryList("*"), []);
  assert.deepEqual(readCanaryList("all"), ["all"], "`all` must be a slug, not a wildcard");
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "*" }, { slug: "fretwork-1" }), false);
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "all" }, { slug: "fretwork-1" }), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DECISION
// ─────────────────────────────────────────────────────────────────────────────

test("splitPlan reads the stored design args and nothing else, so a resume re-derives the same lines", () => {
  const shape = [{ path: "/", sections: ["a hero", "the prices", "an enquiry form"] }];
  const args = { shape, route: "/", mode: "build" };
  assert.equal(splitPlan(args).length, 3);
  // Deterministic: the same args twice, the same answer. This is what lets the
  // resume re-derive the LINES while the store decides the PATH.
  assert.deepEqual(splitPlan(args), splitPlan(args));
  // Every refusal, each a fallback to a path that already works.
  // RE-ANCHORED 2026-09-11, NOT APPEASED. A `tsx` declaration used to refuse the
  // split outright, because a band could not write a part. It is its own agent
  // now, so the plan splits and the parts ride out beside the bands — asserted
  // rather than deleted, since a build that declares a component splitting AT
  // ALL is the whole change.
  assert.equal(splitPlan({ ...args, tsx: [{ name: "ChordDiagram", does: "draws a chord" }] }).length, 3,
    "a declared component still refuses the split");
  // …and the wall that DID replace it: the whole list has to fit in one job.
  assert.equal(splitPlan({
    shape: [{ path: "/", sections: ["one", "two", "tri", "four", "five", "six", "sevn", "ate"] }],
    route: "/", mode: "build",
    tsx: [{ name: "A", does: "a" }, { name: "B", does: "b" }, { name: "C", does: "c" }],
  }).length, 0, "eleven calls were sent to a container that holds eight");
  assert.equal(splitPlan({ ...args, mode: "revise" }).length, 0, "a revise must not split");
  assert.equal(splitPlan({ ...args, priorPages: [{ path: "index.tsx" }] }).length, 0, "a page rewrite must not split");
  assert.equal(splitPlan({ shape: [{ path: "/", sections: ["only one"] }], route: "/", mode: "build" }).length, 0,
    "one band is the whole page with extra steps");
  assert.equal(splitPlan({ ...args, route: "menu" }).length, 0, "a route with no leading slash is not a file");
  assert.equal(splitPlan({ ...args, route: "/does-not-exist" }).length, 0, "a route the shape does not plan has no bands");
  assert.equal(splitPlan({}).length, 0);
  // The file the page lands at, through `routeOf`'s own inverse.
  assert.equal(bandFile("/"), "index.tsx");
  assert.equal(bandFile("/prices"), "prices.tsx");
  assert.equal(bandFile("index.tsx"), "", "a FILE is not a route — the direction matters and has been wrong here before");
});

test("a fire asks the flag; a resume asks the store, and never the flag", () => {
  // ── THE PROPERTY, STATED ──────────────────────────────────────────────────
  //
  // The flag can move between the fire and the collector — a deploy takes ~3
  // minutes and a generation takes eight — and BOTH wrong answers are silent:
  // a list handed to `generateSitePages` parses as one answer object and finds
  // no tool_use, one object handed to `generateSiteBands` pairs against no
  // index and stubs every band. So the resume reads the SHAPE it is holding.
  // RE-ANCHORED 2026-09-10 (the refusal mark), and the spelling that moved is
  // named: the fire's three conditions were ONE expression,
  // `canFire && bandLines.length > 0 && bandSplitFor(…)`, and they are now the
  // inputs to `bandRefusal` across three lines — because the decision had to
  // start saying WHICH of them refused. Being one expression was never the
  // property; asking all three, and asking none of them on a resume, is.
  const dec = between(WCODE, "const bandDoor =", "if (useBands && !bandLines.length)", "the split decision");
  assert.ok(/\?\s*resumeFanout/.test(dec), "the resume no longer asks the store");
  // All three of the fire's conditions still reach the decision.
  assert.ok(/bandSplitFor\(/.test(dec), "the fire branch no longer asks the flag");
  assert.ok(/canFire/.test(dec), "the fire branch no longer asks canFire");
  assert.ok(/shape: plan && plan\.shape, route: planned\[0\], tsx, priorPages/.test(dec),
    "the fire branch no longer asks the stored plan args");
  assert.ok(/const useBands = resumeCall \? resumeFanout : !bandWhy;/.test(dec),
    "useBands is no longer derived from the one reason — a separate condition is two lists of the same thing");
  // The flag must not be asked on the resume branch, and there are TWO ternaries
  // to hold to that now. Each is read by SIDE: everything before the `:` is the
  // resume's answer, and neither may reach `env`.
  for (const [name, line] of [["bandWhy", /const bandWhy = [^;]*;/], ["useBands", /const useBands = [^;]*;/]]) {
    const m = dec.match(line);
    assert.ok(m, `the ${name} line is gone`);
    const resumeSide = m[0].slice(0, m[0].indexOf(":"));
    assert.ok(/resumeCall/.test(resumeSide), `${name} no longer asks whether this is a resume`);
    assert.ok(!/bandSplitFor/.test(resumeSide), `${name}'s resume branch asks the flag — a deploy can then flip a build in flight`);
    assert.ok(!/splitPlan|bandRefusal/.test(resumeSide), `${name}'s resume branch re-decides rather than reading the store`);
  }
  // AND THE DOOR ITSELF IS FENCED OFF THE RESUME, which the old single
  // expression got for free by living inside the ternary and this does not.
  const doorLine = dec.match(/const bandDoor = [^;]*;/);
  assert.ok(doorLine, "the bandDoor line is gone");
  assert.ok(/!resumeCall &&/.test(doorLine[0]), "a resume now reads the flag — the exact race this case exists for");

  // AND THE LINES ARE DERIVED EITHER WAY, above the decision, from the stored
  // design args — never from `env`.
  // THE CLOSING LANDMARK IS THE TRUE NEXT SIBLING, and it moved: this window
  // ran to `const useBands`, and `const bandDoor` — which reads `env`, exactly
  // as it must — was inserted between the two. So the window swallowed it and
  // reported the LINES as env-dependent when they are not. The recorded
  // overlapping-window trap: a window that runs to a named neighbour swallows
  // whatever is inserted between them. The property below is unchanged.
  const lines = between(WCODE, "const bandLines = planned.length === 1", "const bandDoor", "the band lines");
  assert.ok(/splitPlan\(\{ shape: plan && plan\.shape, route: planned\[0\], tsx, priorPages, mode: revise \? "revise" : "build" \}\)/.test(lines),
    "the lines are no longer derived from the stored design args");
  assert.ok(!/\benv\b/.test(lines), "the lines now depend on env, so a resume can derive different ones");
});

test("a store that disagrees with the plan is said, not papered over", () => {
  const w = between(WCODE, "if (useBands && !bandLines.length)", "try {", "the disagreement wall");
  assert.ok(/throw new Error\(/.test(w), "a fan-out answer with no bands to pair it against no longer refuses");
  assert.ok(/fan-out/.test(WORKER.slice(WORKER.indexOf("if (useBands && !bandLines.length)"), WORKER.indexOf("if (useBands && !bandLines.length)") + 400)),
    "the refusal no longer names what went wrong");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRING — every hop the answer travels, derived from its route
// ─────────────────────────────────────────────────────────────────────────────

test("resumeFanout is computed at the collector, forwarded, and read at the build", () => {
  // THE THREE HOPS BY NAME. This is the trap that shipped `three`, `parts`, the
  // Code tab's host and `resumeEditJob`: the producer is right, the consumer is
  // right, and one hop between them is missing — from outside, "we did not
  // forward it" and "there was nothing to forward" are the same `false`.
  //
  // 1. PRODUCED: the collector reads the shape of what it is holding.
  assert.ok(/resumeFanout: Array\.isArray\(decision\.answer\)/.test(WCODE),
    "the collector no longer derives the answer's shape");
  // 2. RECEIVED: the build takes it, defaulting to the single call.
  assert.ok(/resumeFanout = false,/.test(WCODE),
    "buildAndPublishPages no longer takes resumeFanout, or its default is not the safe one");
  // 3. READ: exactly where the path is chosen.
  const uses = (WCODE.match(/\bresumeFanout\b/g) || []).length;
  assert.equal(uses, 3, "resumeFanout is read " + uses + " times, not 3 — a hop was added or cut");
});

test("the fan-out and the single call share one caller, one budget and one sentinel", () => {
  const blk = between(WCODE, "const call = resumeCall", "return await generateSitePages(env, briefWithLayout", "the generate dep");
  // ONE `call`. The fire, the report, the lease and the sentinel are the ones
  // the single path already uses; the only difference is what is handed over.
  assert.ok(/generateSiteBands\(\{/.test(blk), "the fan-out is not called at all");
  assert.ok(/\}, env, call, budget\)/.test(blk), "the fan-out no longer takes the same caller and budget");
  assert.equal((blk.match(/containerPagesFire|containerPagesCall/g) || []).length, 2,
    "the two callers are built more than once — a second copy of the fire is a second thing to keep in step");
  // THE SAME COMPOSED BRIEF. A band that got a different brief would be written
  // for a different site's layout, images and bindings.
  const composed = (blk.match(/briefWithLayout\(\{ brief, plan, tsx, gif, qr, three, images: imgBrief \}\)/g) || []).length;
  assert.equal(composed, 1, "the fan-out no longer gets the one composer's brief");
  assert.ok(/brief: briefWithLayout\(/.test(blk), "the fan-out's brief is not the composed one");
});

test("a container that will not take a fan-out falls through to the one call", () => {
  // AN OLDER IMAGE HAS NO `/model/start` TAKING `reqs` AT ALL, and an image
  // rollout is asynchronous — so for a minute after a deploy the previous image
  // can still be serving. That minute must be single-call builds, not failed
  // ones.
  const blk = between(WCODE, "generateSiteBands({", "return await generateSitePages(env, briefWithLayout", "the fallback");
  assert.ok(/if \(!isNoFanout\(e\)\) throw e;/.test(blk), "every throw is now swallowed, or none is");
  // The sentinel is thrown by the fire and by nothing else, and only for a list.
  assert.ok(/if \(!genId && Array\.isArray\(req\)\) throw noFanoutError\(\);/.test(WCODE),
    "the fire no longer refuses a fan-out it could not start");
  assert.equal((WCODE.match(/noFanoutError\(\)/g) || []).length, 1, "the sentinel is thrown from more than one place");
  // Driven, because a name comparison is the whole of `isNoFanout` and a
  // mutant that compares the wrong field is invisible in a read.
  const e = noFanoutError();
  assert.equal(e.name, NO_FANOUT_NAME);
  assert.equal(isNoFanout(e), true);
  assert.equal(isNoFanout(new Error("something else")), false);
  assert.equal(isNoFanout(null), false);
  assert.equal(isNoFanout({ name: NO_FANOUT_NAME }), true);
  // AND THE SENTINEL A FIRED GENERATION THROWS MUST STILL GET THROUGH. It is
  // how the whole async build path works, so swallowing it would hang builds.
  const fired = new Error("fired"); fired.name = "PagesFired";
  assert.equal(isNoFanout(fired), false);
});

test("the fire sends a list as `reqs` and one request as `req`, never both", () => {
  const fire = between(WCODE, "body: JSON.stringify({ ...(Array.isArray(req)", "signal: AbortSignal.timeout(FIRE_HOP_MS)", "the fire body");
  assert.ok(/\{ reqs: req \} : \{ req \}/.test(fire), "the fire no longer picks one field by shape");
  // The container's own reader takes them apart the same way — the two ends of
  // one wire, so a rename on either side has to move both.
  const srv = code(read("builder/build-server.mjs"));
  assert.ok(/Array\.isArray\(payload && payload\.reqs\)/.test(srv), "the container no longer reads `reqs`");
  assert.ok(/payload && payload\.req\b/.test(srv), "the container no longer reads `req`");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE RESUME'S TWO SHAPES
// ─────────────────────────────────────────────────────────────────────────────

const band = (src) => ({
  content: [{ type: "tool_use", name: "write_band", input: { source: src } }],
  usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 },
});

test("a stored report carries a fan-out's list, and an empty list is not an answer", () => {
  const many = readGenReport({ state: "done", answers: [{ i: 0, state: "done", answer: band("x") }] });
  assert.equal(many.state, "done");
  assert.ok(Array.isArray(many.answer), "the list is not carried under the one field the resume speaks");
  assert.equal(many.answer.length, 1);
  // AN EMPTY LIST IS NOT AN ANSWER. `[]` would read as a generation that
  // finished with nothing and settle a build that never produced a page;
  // unreadable reads as still-pending, which the deadline bounds.
  assert.equal(readGenReport({ state: "done", answers: [] }), null);
  // A single call is untouched.
  const one = readGenReport({ state: "done", answer: band("y") });
  assert.equal(one.state, "done");
  assert.equal(Array.isArray(one.answer), false);
  // And the two are never both read: a report carrying `answers` never falls
  // through to the `answer` branch.
  const both = readGenReport({ state: "done", answers: [{ i: 0 }], answer: band("z") });
  assert.ok(Array.isArray(both.answer), "a report carrying both read the single field");
});

test("resumeDecision finishes with a list for a fan-out and an object for one call", () => {
  const record = { firedAt: Date.now(), looks: 0, genId: "g", lane: "l" };
  const now = Date.now();
  // The container's own `/model/result` shape, which reaches the decision raw.
  const fan = resumeDecision({ poll: { state: "done", answers: [{ i: 0, state: "done" }] }, record, now });
  assert.equal(fan.act, "finish");
  assert.ok(Array.isArray(fan.answer), "a fan-out finished with something that is not a list");
  // The stored-report shape, where `readGenReport` has already moved the list
  // under `answer` — read by the second branch, which is why it must not test
  // `poll.answer` for an object.
  const stored = resumeDecision({ poll: { state: "done", answer: [{ i: 0, state: "done" }] }, record, now });
  assert.equal(stored.act, "finish");
  assert.ok(Array.isArray(stored.answer), "the stored fan-out was not carried through");
  const one = resumeDecision({ poll: { state: "done", answer: { content: [] } }, record, now });
  assert.equal(one.act, "finish");
  assert.equal(Array.isArray(one.answer), false);
  // An EMPTY list is not a finish: it would settle a build with no page.
  assert.notEqual(resumeDecision({ poll: { state: "done", answers: [] }, record, now }).act, "finish");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WHOLE THING, RUN
// ─────────────────────────────────────────────────────────────────────────────

test("a real split build: answers arrive out of order, one call fails, and the page PARSES", async () => {
  // THE ONLY CASE HERE THAT ANSWERS "WOULD THIS BUILD HAVE SHIPPED A PAGE".
  // Everything above is a claim about text.
  const require = createRequire(new URL("../builder/lovable/template/package.json", import.meta.url));
  const ts = require("typescript");

  const shape = [{ path: "/", sections: ["a hero with the shop name", "three lesson prices", "an enquiry form", "the footer"] }];
  const lines = splitPlan({ shape, route: "/", mode: "build" });
  assert.equal(lines.length, 4);

  let sent = null;
  const out = await generateSiteBands({
    brief: "A guitar school in Sheffield.", spec: { tables: [] }, brand: "Crookes Guitar School",
    model: "grok-4.6", kind: "shopfront", route: "/",
    chrome: { name: "Crookes Guitar School", links: [{ label: "Home", to: "/" }] }, lines,
  }, {}, async (keys, reqs) => {
    sent = reqs;
    // OUT OF ORDER, WHICH IS THE POINT. The calls run at once, so the list
    // comes back in finishing order and the index on each entry is the only
    // thing tying an answer to the band it was asked for. Band 1 fails.
    return [
      { i: 2, state: "done", answer: band('import { Form } from "@/components/ui/form";\nfunction Band3An() {\n  const [sent, setSent] = useState(false);\n  return <Form onDone={() => setSent(true)}>{sent ? "Thanks" : "Send"}</Form>;\n}') },
      { i: 0, state: "done", answer: band('import { Hero } from "@/components/ui/hero";\nfunction Band1A() { return <Hero title="Crookes" />; }') },
      { i: 1, state: "failed", message: "XAI_API_KEY is not set" },
      { i: 3, state: "done", answer: band('import { Hero } from "@/components/ui/hero";\nfunction Band4The() { return <footer>© Crookes — we didn\'t forget you</footer>; }') },
    ];
  }, null);

  // ONE REQUEST PER BAND, ALL ON ONE MODEL — which is what makes summing the
  // usage sound, since one rate column prices them all.
  assert.equal(sent.length, 4);
  assert.equal(new Set(sent.map((r) => r.model)).size, 1);

  // THE PAGE. `generateSitePages`' exact return shape, so nothing downstream
  // can tell which generator ran.
  assert.equal(out.input.pages.length, 1);
  assert.equal(out.input.pages[0].path, "index.tsx");
  assert.equal(out.bands, 4);
  assert.equal(out.wrote, 3, "the failed call was counted as written");

  const src = out.input.pages[0].source;
  // ORDER IS THE DESIGN'S, NOT THE FINISHING ORDER — the whole point of running
  // them at once, and invisible in a diff. The answers above came back 2,0,1,3.
  const at = (n) => src.indexOf("<" + bandName(lines[n], n) + " />");
  assert.ok(at(0) >= 0 && at(1) > at(0) && at(2) > at(1) && at(3) > at(2),
    "the bands are composed in the order they finished, not the order they were planned");
  // The failed band is a STUB, not a missing name: dropping it would leave the
  // shell composing something nothing declares, which does not compile.
  assert.ok(src.includes("function " + bandName(lines[1], 1) + "("), "the failed band was dropped rather than stubbed");
  assert.deepEqual(out.refused.map((r) => r.name), [bandName(lines[1], 1)]);
  // ONE `Hero` IMPORT for two bands that both asked for it — the repeat that
  // killed run 90's build in the bundler.
  assert.equal((src.match(/from "@\/components\/ui\/hero"/g) || []).length, 1);

  // AND IT COMPILES. The template's own TypeScript, over the assembled file —
  // including a band whose JSX text carries an apostrophe, which is this
  // repository's recorded "JSX text is not JavaScript" trap.
  const r = ts.transpileModule(src, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  const msgs = (r.diagnostics || []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
  assert.deepEqual(msgs, [], "the assembled page does not parse");

  // THE MONEY. One usage object, summed across the calls, so `pageCredits`
  // rounds ONCE across the build exactly as it does for a single call — N
  // roundings would charge a floor per band.
  assert.deepEqual(out.usage, { in: 300, out: 150, cacheRead: 30, cacheWrite: 15, model: "grok-4.6" });
});

test("a failed call that carries half an answer is stubbed, not assembled", async () => {
  // ── WHY THIS CASE EXISTS ──────────────────────────────────────────────────
  //
  // The sweep found `if (a.state !== "done") continue;` survivable, and it was
  // right: every entry `runFanout` produces today puts `status`/`detail`/
  // `message` on a failure and NO `answer`, so the `if (src)` guard one line
  // below drops it anyway. Two redundant walls, which reads exactly like a
  // missing test — this repository's own recorded trap, and the reason the next
  // session deletes the second wall.
  //
  // It is redundant against today's producer and not against the shape this
  // path is one change away from. Every band call rides `stream: true`, and a
  // streamed transcript folded back after a cut-off can carry a HALF-WRITTEN
  // tool_use beside its failure. So the case drives that entry: a failure that
  // DOES carry usable-looking source. Assembling it would put code nobody
  // finished into a customer's page, which is worse than a missing section.
  const lines = splitPlan({ shape: [{ path: "/", sections: ["a hero", "the prices", "the footer"] }], route: "/", mode: "build" });
  const half = { content: [{ type: "tool_use", input: { source: 'function Band2The() { return <div>hal' } }], usage: {} };
  const out = await generateSiteBands({ brief: "b", spec: {}, brand: "B", model: "grok-4.6", route: "/", chrome: { name: "B" }, lines },
    {}, async () => [
      { i: 0, state: "done", answer: band('function Band1A() { return <h1>Hi</h1>; }') },
      { i: 1, state: "failed", status: 500, message: "the stream was cut", answer: half },
      { i: 2, state: "done", answer: band('function Band3The() { return <footer/>; }') },
    ], null);
  assert.equal(out.wrote, 2, "the cut-off band was counted as written");
  assert.deepEqual(out.refused.map((r) => r.name), [bandName(lines[1], 1)]);
  const src = out.input.pages[0].source;
  assert.ok(!src.includes("hal"), "half a band reached the page");
  assert.ok(src.includes("This band could not be written"), "the cut-off band was not stubbed");
});

test("an entry naming no position is dropped, never landed on the first band", () => {
  // The other half of the redundancy above, and this one is NOT inert: an entry
  // with no `i` coerced to 0 overwrites whatever band 0 wrote — a page whose
  // hero is somebody else's section, on a build where nothing failed. The Map
  // itself would silently drop such an entry, but only while the key stays the
  // index; the check is what says the position must be a real one.
  const lines = ["a hero", "the prices", "the footer"];
  const src = (t) => ({ content: [{ type: "tool_use", input: { source: t } }] });
  const bands = bandsFromAnswers([
    { i: 0, state: "done", answer: src("function Band1A() {}") },
    { state: "done", answer: src("function Stray() {}") },
    { i: "1", state: "done", answer: src("function Strung() {}") },
    { i: 1.5, state: "done", answer: src("function Half() {}") },
  ], lines);
  assert.equal(bands.length, 3);
  assert.ok(bands[0].source.includes("Band1A"), "the indexless entry displaced the first band");
  assert.ok(!bands.some((b) => /Stray|Strung|Half/.test(b.source)), "an entry with no real position reached a band");
  assert.equal(bands[1].source, "");
  assert.equal(bands[2].source, "");
});

test("every call failing is not a page, and says so the way the one call says it", async () => {
  const lines = splitPlan({ shape: [{ path: "/", sections: ["a hero", "the prices", "the footer"] }], route: "/", mode: "build" });
  const out = await generateSiteBands({ brief: "b", spec: {}, brand: "B", model: "grok-4.6", route: "/", chrome: { name: "B" }, lines },
    {}, async () => lines.map((_, i) => ({ i, state: "failed", message: "no key" })), null);
  // `input: null` is the same answer the one-call generator gives when the
  // model produced nothing usable, so `publishPages` reports it the way it
  // already reports that. A shell composing N stubs would be a page that
  // compiles, says nothing, and publishes as a success.
  assert.equal(out.input, null);
  assert.equal(out.wrote, 0);
  assert.equal(out.shape.stopReason, "no-bands");
  // The usage is still summed and still answered: nothing was generated, so it
  // is zero, but a failed fan-out that answered NO usage would be a build that
  // could not price what it spent.
  assert.equal(out.usage.in, 0);
  assert.equal(out.usage.model, "grok-4.6");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE DEPLOYMENT
// ─────────────────────────────────────────────────────────────────────────────

test("both flags are uploaded with a fallback, and the canary names ONE identity", () => {
  const dep = read(".github/workflows/deploy.yml");
  // AN OPTIONAL SECRET MUST CARRY A FALLBACK. Listing a name with no value
  // fails the WHOLE deploy — three merges have shipped nothing that way.
  const canary = /BAND_SPLIT_CANARY: \$\{\{ secrets\.BAND_SPLIT_CANARY \|\| '([^']*)' \}\}/.exec(dep);
  const everyone = /BAND_SPLIT_EVERYONE: \$\{\{ secrets\.BAND_SPLIT_EVERYONE \|\| '([^']*)' \}\}/.exec(dep);
  assert.ok(canary && everyone, "a band-split flag is uploaded without a fallback");
  // And both are on the secret list, or they never reach the Worker at all.
  const list = between(dep, "          secrets: |", "        env:", "the secret list");
  for (const n of ["BAND_SPLIT_CANARY", "BAND_SPLIT_EVERYONE"]) {
    assert.ok(list.includes(n), n + " is set in env but never uploaded");
  }

  // RE-ANCHORED 2026-09-10 (owner: "switch it on"). This pinned the canary's
  // default as the literal `-` and went red for the owner opening the door,
  // which is the recorded "assert the property, not the spelling": the property
  // is that a DEFAULT — what ships when nobody has set a secret — may widen this
  // to exactly one named identity and no further, never to the whole platform.
  const env = { BAND_SPLIT_CANARY: canary[1], BAND_SPLIT_EVERYONE: everyone[1] };
  assert.equal(bandSplitEveryone(env), false, "the shipped default splits every page on the platform");
  const named = readCanaryList(canary[1]);
  assert.equal(named.length, 1, "the shipped canary names " + named.length + " identities, not one: " + JSON.stringify(canary[1]));
  // The door reads its list against BOTH halves and does not care which column
  // an identity arrives in, so drive the default in the column it belongs to.
  // A UID here is deliberate and is the difference from the runner's canary:
  // this is asked at page time, when a NEW build already has a slug, so a slug
  // would split that one site's edits and leave every new build on the single
  // call — the half-on state, since the design door one block over can only be
  // keyed on an account.
  const uidish = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(named[0]);
  assert.equal(bandSplitFor(env, uidish ? { uid: named[0], slug: "any-site-1" } : { uid: "x", slug: named[0] }), true,
    "the shipped canary does not reach the identity it names");
  assert.equal(bandSplitFor(env, { uid: "99999999-8888-7777-6666-555555555555", slug: "somebody-else-1" }), false,
    "the shipped default splits a stranger's page");
  assert.equal(bandSplitFor(env, {}), false, "the shipped default splits a page with no identity at all");
  // And `-` is still what turning it back off looks like, asked of the reader.
  assert.deepEqual(readCanaryList("-"), [], "`-` must stay a value the reader drops");
  assert.equal(bandSplitFor({ BAND_SPLIT_CANARY: "-", BAND_SPLIT_EVERYONE: "off" }, { uid: named[0], slug: named[0] }), false);
});

test("the door is asked with the account, and the account is the one the caller has", () => {
  // ── THE CASE THE FIRST LIVE SPLIT BUILD NEEDED (2026-09-10) ────────────────
  //
  // `thornbury-kiln` recorded `bands:door` and the door was shut by a BUG: the
  // decision read `uid: (auth && auth.id) || ""`, and `auth` inside
  // `buildAndPublishPages` is the raw Authorization HEADER STRING that
  // `runSiteBuild` was handed — it goes to `readCredits`/`collectCredits`, which
  // want exactly that. A string is truthy and a string has no `.id`, so the door
  // was asked `uid: ""` on every build, the canary is a uid, and an empty uid
  // matches nothing. The band split was unreachable for every account from the
  // day it shipped, and nothing failed or logged: a wrong identity and a
  // customer genuinely outside the canary are the same `false`.
  //
  // TWO GUARDS WATCHED THIS AND NEITHER COULD SEE IT, both the recorded wiring
  // trap. `band-refusal` pinned the buggy literal as a requirement. And the
  // cases above DRIVE `bandSplitFor` with a uid handed in — which proves the
  // door READS one and says nothing about whether anybody SUPPLIES one. That is
  // `picked-model`'s lesson word for word: the chain asserted at the layer below
  // the break.
  //
  // So this drives the CHAIN. Both hops are cut out of worker.js and RUN: what
  // the caller computes for `uid`, fed into what the door does with it. Neither
  // is a text match, so a hop that exists in the file and answers the wrong
  // thing cannot pass — which is the whole defect.
  const dep = read(".github/workflows/deploy.yml");
  const canary = /BAND_SPLIT_CANARY: \$\{\{ secrets\.BAND_SPLIT_CANARY \|\| '([^']*)' \}\}/.exec(dep);
  assert.ok(canary, "the band canary is uploaded without a fallback");
  const named = readCanaryList(canary[1]);
  assert.equal(named.length, 1, "the shipped canary names " + named.length + " identities, not one");
  const env = { BAND_SPLIT_CANARY: canary[1], BAND_SPLIT_EVERYONE: "off" };

  // HOP 1 — what the BUILD ROUTE hands down as the account. Windowed from the
  // bearer token beside it, because the pair is the point: two fields, two
  // different facts, and reading one for the other is the defect.
  const pair = between(WCODE, "auth: auth,", "mark: (n, x) => tr.at(n, x)", "buildArgs' identity pair");
  const argExpr = /\buid:\s*([^\n,]+),/.exec(pair);
  assert.ok(argExpr, "buildArgs no longer carries a uid beside the bearer token — the door has nothing to ask with");
  const uidOf = new Function("bu", "return (" + argExpr[1] + ");");

  // HOP 2 — what the DECISION does with it.
  const doorWin = between(WCODE, "const bandDoor =", "const bandWhy =", "the band door");
  const doorExpr = doorWin.slice(doorWin.indexOf("=") + 1).trim().replace(/;[\s\S]*$/, "");
  const doorOf = new Function("resumeCall", "canFire", "bandSplitFor", "env", "uid", "slug",
    "return (" + doorExpr + ");");

  // THE CHAIN, END TO END: the canary account's own build really opens the door.
  const bu = { id: named[0] };
  assert.equal(doorOf(null, true, bandSplitFor, env, uidOf(bu), "a-brand-new-site-1"), true,
    "the canary account's own build does not open the band door — the identity is lost between the route and the decision");
  // AND THE CONTROL, without which "always true" would pass: a stranger is still
  // refused, and so is a call whose caller could not be identified at all.
  assert.equal(doorOf(null, true, bandSplitFor, env, uidOf({ id: "99999999-8888-7777-6666-555555555555" }), "somebody-else-1"), false,
    "the shipped default opens the door for a stranger");
  assert.equal(doorOf(null, true, bandSplitFor, env, uidOf(null), "a-brand-new-site-1"), false,
    "a build with no identifiable account opens the door");
  // AND "NO ACCOUNT" MUST BE FALSY, NEVER A PLACEHOLDER. `bandSplitFor` tests
  // its list against the uid AND the slug, so a junk uid changes no answer while
  // the canary holds real uids — which is why a sweep mutant writing
  // `String(bu && bu.id)` (`"null"` for an unauthenticated caller) and one
  // defaulting the parameter to `"-"` both survived: MEASURED inert, in both
  // flag states, and unreachable besides (`runSiteBuild` answers UNAUTHED before
  // `buildArgs` is built, and every caller passes a uid).
  //
  // What is NOT inert is the value itself. A truthy placeholder is a string
  // somebody can put in a canary — `-` is the very word this platform spells
  // "nobody" with — so an absent account has to be absent, at both hops, and
  // that is a property a driven check can hold whatever the flags say.
  assert.ok(!uidOf(null), "the caller turns an unidentifiable build into a truthy placeholder account");
  // The SIGNATURE's own default, DRIVEN — the destructure is cut out and RUN
  // with nothing, rather than its spelling matched. That is what a resume record
  // written before this change gets on a refire.
  const sigAt = WCODE.indexOf("async function buildAndPublishPages(env, {");
  assert.ok(sigAt > 0, "buildAndPublishPages is not declared the way this scan expects");
  const braceAt = WCODE.indexOf("{", sigAt + "async function buildAndPublishPages(env,".length);
  const sigEnd = WCODE.indexOf("}", braceAt);
  assert.ok(sigEnd > braceAt, "the parameter object is not closed on one line");
  const defaultUid = new Function("o", "const {" + WCODE.slice(braceAt + 1, sigEnd) + "} = o; return uid;")({});
  assert.ok(!defaultUid, "an absent account defaults to a truthy placeholder: " + JSON.stringify(defaultUid));
  // The two conditions this file owns are still asked, driven rather than read.
  assert.equal(doorOf({}, true, bandSplitFor, env, uidOf(bu), "a-brand-new-site-1"), false, "a resume asks the flag");
  assert.equal(doorOf(null, false, bandSplitFor, env, uidOf(bu), "a-brand-new-site-1"), false, "a synchronous build asks the flag");

  // AND THE CENSUS THAT MAKES THE CLASS UNREPEATABLE. `auth` is a bearer header
  // string everywhere in worker.js — `packResume` has stored `auth` and `uid`
  // side by side since the day it was written, which was the tell — so NO
  // property may ever be read off a bare `auth`. The lookbehind lets
  // `info.auth.url` through, which is a different object entirely.
  const AUTH_READ = "(?<![.\\w$])auth\\s*\\.\\s*[A-Za-z_$][\\w$]*";
  const reads = [...WCODE.matchAll(new RegExp(AUTH_READ, "g"))].map((m) => m[0]);
  assert.deepEqual(reads, [], "a property is read off the bearer header, which is always undefined: " + reads.join(", "));
  // AND THE OBSERVER IS PROVED ALIVE, because `[].every` is true and a negative
  // assertion with no subjects reports a clean file whatever the code says — the
  // recorded trap, and a sweep mutant that simply misspelled the pattern
  // SURVIVED this case until these three lines existed. Two floors: the scan has
  // real `auth` tokens to look at, and the pattern still matches the exact shape
  // it forbids while still letting a different object's `auth` field through.
  const bare = (WCODE.match(/(?<![.\w$])auth\b/g) || []).length;
  assert.ok(bare >= 3, `the scan found ${bare} bare \`auth\` tokens — it has nothing to look at`);
  assert.equal(new RegExp(AUTH_READ).test('uid: (auth && auth.id) || ""'), true,
    "the census pattern no longer matches the defect it exists to forbid");
  assert.equal(new RegExp(AUTH_READ).test("info.auth.url"), false,
    "the census pattern eats a different object's auth field");

  // AND THE REFIRE — the one resumed path that asks the flag again — must keep
  // it. `design` is `buildArgs` minus a named few, so the account rides along by
  // derivation; naming `uid` in that destructure would strip it silently and put
  // the refire straight back where the fire was.
  const drop = /const \{ attachments: _drop,[^}]*\} = buildArgs \|\| \{\};/.exec(WCODE);
  assert.ok(drop, "the resume record's design is no longer derived from buildArgs");
  assert.doesNotMatch(drop[0], /\buid\b/, "the resume's design drops the account, so a refire asks the door with nothing");
});

test("the image carries the band module, because worker.js imports it", () => {
  // The container runs the Worker's own module as the job runtime, so an
  // import worker.js gained is a name the image's COPY line needs — and a
  // container that dies at import reaches the customer as "our build service
  // was restarting", the sentence that has already hidden two other causes.
  assert.ok(/from "\.\/builder\/page-bands\.mjs"/.test(WCODE), "worker.js no longer imports the band module");
  const dock = read("Dockerfile");
  assert.ok(/builder\/page-bands\.mjs/.test(dock), "the image does not carry builder/page-bands.mjs");
});

test("the runtime diagnostic answers whether this site's next build splits", () => {
  // Two more deploy secrets with a workflow fallback — the exact class of fact
  // that route exists for — and the one flag whose effect is invisible from
  // outside: a split build and a single-call build publish the same page to the
  // same address.
  // WINDOWED TO THE NEXT ROUTE, in the BLANKED source — the neighbour is named
  // in a comment above itself, and a landmark inside prose is a landmark that
  // moves when somebody edits the prose.
  const route = between(WCODE, 'url.pathname === "/api/site/runtime"', 'url.pathname === "/api/site/reach"', "the runtime route");
  assert.ok(/bands: bandSplitFor\(env, who\)/.test(route), "the diagnostic does not answer the effective split");
  assert.ok(/bandsEveryone: bandSplitEveryone\(env\)/.test(route), "the switch behind it is not reported");
  // Still booleans and never a list — the property that route was written with.
  assert.ok(!/BAND_SPLIT_CANARY/.test(route), "the canary list reached the diagnostic");
});
