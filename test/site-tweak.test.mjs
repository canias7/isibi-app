// The cheap rung of the `page` layer.
//
// WHAT IS ACTUALLY BEING ASSERTED is one promise: a tweak changes how a page
// LOOKS and cannot change what it SAYS. Everything else here exists to make
// that promise safe to rely on — the guard has to fire on a rewording and must
// NOT fire on the changes the rung exists for, and this repo has recorded
// several times that a check crying wolf on correct output is worse than the
// miss it prevents.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  readTweak, runTweak, tweakable, sameProse, proseOf, routeIdOf, tweakUsage,
  tweakRequest, tweakReply, TWEAK_MODEL, TWEAK_TOOL, TWEAK_RULES, MAX_TWEAK_CHARS,
} from "../builder/site-tweak.mjs";
// The extractor the guarantee is built on — used here to splice at its OWN
// offsets, so the negative case covers every page rather than the fifth that
// happen to carry a long quoted string.
import { extractText } from "../builder/site-text.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const PAGE = read("../builder/lovable/template/src/routes/index.tsx");
const worker = read("../worker.js");

/** The raw API reply shape, because that is what the lane really receives. */
const reply = (input, usage) => ({
  content: [{ type: "tool_use", name: TWEAK_TOOL.name, input }],
  usage: usage || { input_tokens: 3400, output_tokens: 3300 },
});

/* ── the promise ─────────────────────────────────────────────────────────── */

test("THE PROSE CANNOT MOVE, and a rewording is caught", () => {
  const one = proseOf(PAGE);
  assert.ok(one.length > 200, "the reference page yielded almost no prose — the extractor is not reading it");
  // A visual change keeps every word.
  const bigger = PAGE.replace(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/, "text-6xl");
  assert.notEqual(bigger, PAGE, "the fixture has no size class to change");
  assert.ok(sameProse(PAGE, bigger));
  assert.equal(readTweak(reply({ source: bigger }), { source: PAGE }).ok, true);
  // A rewording does not, and is refused rather than published.
  const said = PAGE.replace("Walk-ins welcome", "Walk in whenever");
  assert.notEqual(said, PAGE, "the fixture has no heading to reword");
  assert.equal(readTweak(reply({ source: said }), { source: PAGE }).reason, "reworded");
});

test("REORDERING IS ALLOWED, which is why the comparison is a multiset", () => {
  // "Move the opening hours above the map" is one of the six asks this rung
  // exists for, and it changes every offset after the block it moved. Anything
  // positional would refuse the feature — so the sorted texts are compared, and
  // a page with its own paragraphs swapped has to read as unchanged.
  const swap = "AAA-first-marker", other = "ZZZ-second-marker";
  const src = `const a = "${swap}"; const b = "${other}";`;
  const moved = `const b = "${other}"; const a = "${swap}";`;
  assert.equal(proseOf(src), proseOf(moved), "a reordered page reads as reworded");
});

test("…and the corpus says it does not cry wolf", () => {
  // THE MEASUREMENT THIS RUNG RESTS ON, kept as a test rather than as a number
  // in a comment: a guard that starts refusing correct tweaks turns the cheap
  // path into a permanent fall-through to the 10-credit rewrite, silently.
  const root = new URL("../builder/lovable/template/src/", import.meta.url);
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) files.push(p);
    }
  };
  for (const d of ["family-pages", "routes"]) {
    const abs = path.join(root.pathname, d);
    if (fs.existsSync(abs)) walk(abs);
  }
  assert.ok(files.length >= 300, "only " + files.length + " corpus pages found — the sweep broke");

  const TWEAKS = [
    (s) => s.replace(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/, "text-6xl"),
    (s) => s.replace(/\bp([xyby]?)-(\d+)\b/, (m, a) => "p" + a + "-24"),
    (s) => s.replace(/\bgap-(\d+)\b/, "gap-1"),
    (s) => s.replace(/<SectionHeader\b(?![^>]*align=)/, '<SectionHeader align="center"'),
    (s) => s.replace(/columns=\{[234]\}/, "columns={4}"),
    (s) => s.replace(/ratio="[^"]+"/, 'ratio="4/3"'),
    (s) => s.replace(/\brounded-(sm|md|lg|xl|2xl)\b/, "rounded-xl border"),
    (s) => s.replace(/\bmax-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|prose)\b/, "max-w-6xl"),
  ];
  let applied = 0, moved = 0, caught = 0, checked = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const fn of TWEAKS) {
      const out = fn(src);
      if (out === src) continue;
      applied++;
      if (!sameProse(src, out)) moved++;
    }
    // The negative on every page, or a zero false-alarm rate is equally
    // satisfied by a comparison that always answers "same".
    //
    // SPLICED AT THE EXTRACTOR'S OWN OFFSET rather than by searching for a
    // quoted string: a first draft looked for `"…"` of twelve characters or
    // more and only 65 of the 329 pages had one it also counted as prose, so
    // the negative covered a fifth of the corpus and read as if it covered all
    // of it.
    const strings = extractText(src);
    if (!strings.length) continue;
    checked++;
    const one = strings[0];
    const reworded = src.slice(0, one.at) + "Totally different wording" + src.slice(one.at + one.text.length);
    if (!sameProse(src, reworded)) caught++;
  }
  assert.ok(applied >= 1000, "only " + applied + " tweaks applied — the sweep is not exercising the guard");
  assert.equal(moved, 0, moved + " of " + applied + " real tweaks were refused as rewordings");
  assert.ok(checked >= 200, "only " + checked + " pages could be reworded — the negative is too thin");
  assert.equal(caught, checked, (checked - caught) + " rewordings slipped past");
});

/* ── the other refusals ──────────────────────────────────────────────────── */

test("a page may not move its own address", () => {
  // A route id is typed against the tree `tsr generate` emits, so a page that
  // renames itself turns every <Link> to it into a compile error. `renameRoute`
  // does it properly, with the redirect; this rung has no business near it.
  const moved = PAGE.replace('createFileRoute("/")', 'createFileRoute("/somewhere")');
  assert.notEqual(moved, PAGE);
  assert.equal(readTweak(reply({ source: moved }), { source: PAGE }).reason, "moved-route");
  assert.equal(routeIdOf(PAGE), "/");
  assert.equal(routeIdOf("no route here"), null);
});

test("every other unusable answer has its own name", () => {
  assert.equal(readTweak(reply({ source: PAGE }), { source: PAGE }).reason, "no-change");
  assert.equal(readTweak(reply({ source: PAGE.slice(0, 200) }), { source: PAGE }).reason, "truncated");
  assert.equal(readTweak(reply({ cannot: "needs a new section" }), { source: PAGE }).reason, "cannot");
  assert.equal(readTweak(reply({ cannot: "needs a new section" }), { source: PAGE }).why, "needs a new section");
  assert.equal(readTweak({ content: [{ type: "text", text: "hi" }] }, { source: PAGE }).reason, "unreadable");
  assert.equal(readTweak(null, { source: PAGE }).reason, "unreadable");
  // NAMED SEPARATELY ON PURPOSE. All five escalate, so a single reason would
  // still work — and a log of them is the only way to tell "the model keeps
  // refusing" from "the model keeps rewording", which want opposite fixes.
  const names = new Set(["no-change", "truncated", "cannot", "unreadable", "moved-route", "reworded"]);
  assert.equal(names.size, 6);
});

test("a page too big to send cheaply never pays for the call", () => {
  assert.equal(tweakable(PAGE).ok, true);
  assert.equal(tweakable("x".repeat(MAX_TWEAK_CHARS + 1)).reason, "too-big");
  assert.equal(tweakable("").reason, "empty");
  assert.equal(tweakable(null).reason, "empty");
});

/* ── the runner ──────────────────────────────────────────────────────────── */

test("runTweak NEVER THROWS, whatever the provider does", async () => {
  // It sits in front of a path that already works, so an exception escaping
  // would turn "the cheap rung was unavailable" into "the edit failed" — worse
  // than not having built it.
  const boom = await runTweak({ instruction: "x", path: "p.tsx", source: PAGE, send: async () => { throw new Error("down"); } });
  assert.equal(boom.reason, "send");
  assert.equal(boom.usage, null, "a call that never reached the provider must bill nothing");
  const junk = await runTweak({ instruction: "x", path: "p.tsx", source: PAGE, send: async () => null });
  assert.equal(junk.reason, "unreadable");
});

test("a REFUSAL is still billed — the call really happened", async () => {
  // The rule the whole charging tier rests on. A refusal is ~1 credit against
  // the 10 the rewrite costs, and hiding it would be a silent undercharge on
  // the commonest failure this rung has.
  const out = await runTweak({
    instruction: "add a section about our history", path: "p.tsx", source: PAGE,
    send: async () => reply({ cannot: "that needs new words" }),
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "cannot");
  assert.ok(out.usage && out.usage.in > 0, "a refusal reported no usage");
  assert.equal(out.usage.model, TWEAK_MODEL);
});

test("the request carries the instruction FIRST, and forces the tool", () => {
  const req = tweakRequest({ instruction: "make the heading bigger", path: "index.tsx", source: PAGE });
  assert.equal(req.model, TWEAK_MODEL);
  assert.deepEqual(req.tool_choice, { type: "tool", name: TWEAK_TOOL.name });
  const body = req.messages[0].content;
  // NOT BURIED UNDER TEN THOUSAND CHARACTERS OF TSX — the same ordering the
  // addon lane uses for prior source, and for the same reason.
  assert.ok(body.indexOf("make the heading bigger") < body.indexOf("THE FILE ("), "the file comes before the ask");
  assert.ok(body.includes(PAGE), "the file did not reach the request");
  assert.equal(tweakUsage(null), null);
});

test("HAIKU, because the saving IS the model", () => {
  // Measured on a real 12,044-character page: 3 credits here against 10 for the
  // rewrite, and most of the difference is NOT the model — it is that this call
  // does not send the ~36,000-token generator prompt. Both halves are pinned.
  assert.equal(TWEAK_MODEL, "claude-haiku-4-5");
  assert.ok(!/PAGE_RULES|COMPONENT_API|CHART_COMPONENTS/.test(TWEAK_RULES),
    "the tweak prompt has grown the generator's rules — the saving is gone");
  assert.ok(TWEAK_RULES.length < 2000, "the tweak prompt is " + TWEAK_RULES.length + " characters");
});

test("the prompt states the two things the code also enforces", () => {
  // A rule the model is merely told is not a guarantee — `readTweak` is the
  // guarantee. It is in the prompt as well so the model does not spend an
  // answer being thrown away, which is the `MAX_CLARIFY` shape.
  assert.match(TWEAK_RULES, /DO NOT CHANGE ANY OF THE WORDS/);
  assert.match(TWEAK_RULES, /DO NOT CHANGE THE PAGE'S ADDRESS/);
  // AND THAT SAYING `cannot` IS FREE, or it does something approximate instead —
  // the worst outcome here, because an approximate answer publishes.
  assert.match(TWEAK_TOOL.input_schema.properties.cannot.description, /perfectly good answer|costs nothing/);
  // A COLOUR IS SOMEBODY ELSE'S JOB. Hard-coding one in a page would fight the
  // site-wide and per-page token patches, and the lint refuses it anyway.
  assert.match(TWEAK_RULES, /colour/i);
});

/* ── the wiring ──────────────────────────────────────────────────────────── */

test("IT IS REACHED, AND IT IS TRIED BEFORE THE REWRITE", () => {
  // The layer this repo has shipped dead twelve times. A module that decides
  // correctly and is called by nothing is the whole failure mode.
  assert.match(worker, /import \{[^}]*\brunTweak\b[^}]*\} from "\.\/builder\/site-tweak\.mjs"/,
    "runTweak is used without being imported — a ReferenceError on the edit path");
  const at = worker.indexOf("const tw = await runTweak(");
  assert.ok(at > 0, "nothing in the page layer calls the cheap rung");
  // BEFORE the expensive one, or it is a second bill rather than a saving.
  const gen = worker.indexOf("eGen = await generateSitePages(");
  assert.ok(gen > at, "the cheap rung runs after the rewrite it exists to avoid");
});

test("a failed cheap attempt FALLS THROUGH rather than answering", () => {
  // The one place this rung differs from every other lane. The rewrite below is
  // a genuinely different attempt at the same request by a stronger model, so
  // answering "that didn't work" here would refuse the customer a path that
  // still works.
  const at = worker.indexOf("const tw = await runTweak(");
  const win = worker.slice(at, worker.indexOf("const eDb = await siteBackendBySlug", at));
  assert.ok(win.length > 400, "the tweak window is empty — the anchor moved");
  // Only ONE return, and it is inside the success branch.
  const returns = [...win.matchAll(/return Response\.json\(/g)];
  assert.equal(returns.length, 1, "the cheap rung answers on " + returns.length + " paths — a failure must fall through");
  // BOTH ANCHORS PROVED TO EXIST BEFORE THEY ARE ORDERED. `indexOf` answers -1
  // for a string that is not there and -1 is less than everything, so a mutant
  // deleting the gate entirely — `if (tw.ok)` → `if (false)`, which pays for
  // the cheap call and throws its answer away — SURVIVED this assertion. The
  // vacuous-ordering trap this repo has already recorded twice.
  const gate = win.indexOf("if (tw.ok) {");
  assert.ok(gate >= 0, "the success gate is gone — the cheap rung's answer is unreachable");
  assert.ok(gate < returns[0].index, "the only answer is not inside the success branch");
});

test("WHAT THE CHEAP ATTEMPT COST IS BILLED WITH THE REWRITE, once", () => {
  // `eCharge` is variadic precisely so two calls on one path round up ONCE —
  // the lesson `pageCredits` already carries, where summing separately-rounded
  // credits charged twice for the rounding.
  assert.match(worker, /cost: await eCharge\(eGen && eGen\.usage, twSpent\)/,
    "the rewrite bills without the cheap attempt that preceded it");
  // …and a provider that was never reached bills nothing.
  assert.match(worker, /const twSpent = tw\.reason === "send" \? null : tw\.usage/);
});

test("the reply names the page and the promise", () => {
  // A tweak is invisible from anywhere else on the site, so a reply with no
  // address sends somebody to the home page to look for a change made on /book.
  const said = tweakReply("/book");
  assert.match(said, /\/book/);
  assert.match(said, /wording/i, "the reply does not state the guarantee that makes this rung worth using");
  assert.ok(!tweakReply("").includes("undefined"));
});
