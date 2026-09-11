// ONE AGENT PER THING, AND A PART IS A THING (2026-09-11, owner: "one agent per
// thing like the design one , just make it wait if its requires from something
// to wait for other thing").
//
// ── THE ANSWER TO THE SECOND HALF IS "NOTHING WAITS", AND IT IS READ OFF THE
//    PROMPTS RATHER THAN REASONED ABOUT ───────────────────────────────────────
//
// The design graph's own record says this file has been wrong three times by
// reasoning about what SOUNDS like it needs an input instead of reading what the
// field says. So the edges here were derived the same way, from the prose:
//
//   * the band prompt states INDEPENDENCE in as many words — "The bands above
//     and below yours are being written at the same time by someone else";
//   * a part's whole input is its DECLARATION (name, what it does, its props,
//     its import path), every one of which the design answered before any of
//     this ran;
//   * a band that imports a part reads that same declaration.
//
// Neither reads the other's source, so there is no edge to draw — the same
// answer the design graph reached for fifteen of its twenty-two fields. This
// file asserts that, so a later session adding a wait has to disagree with the
// prompt in writing first.
//
// WHAT ONE AGENT PER THING ACTUALLY BOUGHT is the `tsx` refusal. Until today
// `planRefusal` refused to split ANY build whose design declared a component,
// and its own comment said why: "a band writes one section and cannot write a
// part… A band step that writes parts is a later change, not a smaller one."
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  partsOf, partStub, partsFromAnswers, partRequest, partPrompt, PART_TOOL, BAND_TOOL,
  answerSource, slotName, planRefusal, splitPlan, generateSiteBands, bandMarks, MAX_BANDS,
} from "../builder/page-bands.mjs";
import { pageRulesFor, tsxDirective } from "../builder/page-gen.mjs";
import { MAX_MODEL_FANOUT, MAX_FANOUT_REQS } from "../builder/model-fanout.mjs";
import { MAX_TSX } from "../builder/site-plan.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const blank = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
const BANDS = read("builder/page-bands.mjs");
const WORKER = read("worker.js");
const WCODE = blank(WORKER);

const DECL = [
  { name: "ChordDiagram", does: "draws a guitar chord on a fretboard", props: "chord: string" },
  { name: "Tuner", does: "a tuner that listens to the microphone" },
];
const args = (extra = {}) => ({
  lines: ["a hero with the workshop name", "the price list"], route: "/",
  brief: "a guitar school", brand: "Fretwork", spec: {}, kind: "shopfront", model: "m",
  chrome: { name: "Fretwork", tagline: "", links: [], action: null },
  ...extra,
});
const band = (n) => `function ${n}() {\n  return <section data-slot="x">${n}</section>;\n}`;
const part = (n) => `export default function ${n}() {\n  return <div>${n}</div>;\n}`;

test("the declarations become agents, and only the ones a directive would have named", () => {
  assert.deepEqual(partsOf(DECL).map((p) => p.name), ["ChordDiagram", "Tuner"]);
  // THE SAME TWO `tsxDirective` REQUIRES — a name and what it does — so a part
  // this fans out for is a part the single-call path would also have been told
  // to write. A row it drops is a row nothing would have written either way.
  assert.deepEqual(partsOf([{ name: "", does: "x" }, { name: "A", does: "" }, { does: "d" }, { name: "B" }]), []);
  // Capped at the DESIGN's own ceiling, never a second number beside it.
  const many = Array.from({ length: MAX_TSX + 4 }, (_, i) => ({ name: "C" + i, does: "d" }));
  assert.equal(partsOf(many).length, MAX_TSX, "the cap drifted from the design's own");
  for (const junk of [null, undefined, "x", 7, [null], [[]], [{}]]) {
    assert.deepEqual(partsOf(junk), [], "junk answered a part: " + JSON.stringify(junk));
  }
});

test("a declaration reads the SAME here as it reads in the directive, hostile shapes included", () => {
  // THE AGREEMENT IS THE PROPERTY, not the coercion. `tsxDirective` is the
  // single-call path's reader of these same declarations and it coerces
  // (`String(t.name || "")`), so `partsOf` coercing is what keeps one design
  // answer producing ONE component whichever generator runs. A reader that
  // passed a non-string name straight through would hand `validatePages` a
  // name the other path never sees — and `String(["ChordDiagram"])` is
  // `"ChordDiagram"`, the recorded trap, so the two readings differ silently.
  // Asserted against the directive's OWN output rather than a retyped
  // expectation, which would be a second copy of the thing under test.
  const hostile = [
    { name: ["ChordDiagram"], does: "draws a chord" },
    { name: "  Tuner  ", does: "  listens  ", props: ["chord: string"] },
  ];
  const got = partsOf(hostile);
  const directive = tsxDirective(hostile);
  assert.equal(got.length, 2, "the directive's two rows did not both survive here");
  for (const p of got) {
    assert.equal(typeof p.name, "string", "a non-string name reached a file name");
    assert.equal(typeof p.props, "string", "a non-string props reached the prompt");
    assert.ok(
      directive.includes("**" + p.name + "**"),
      "the directive does not name " + JSON.stringify(p.name) + ", so the two paths read one declaration two ways",
    );
    assert.ok(
      directive.includes("`@/routes/-parts/" + p.name + "`"),
      "the import path the directive writes is not the name this fans out for: " + JSON.stringify(p.name),
    );
  }
  assert.deepEqual(got.map((p) => p.name), ["ChordDiagram", "Tuner"]);
});

test("a part agent is asked for ONE component, and shares the page's cached rules byte for byte", () => {
  const req = partRequest({ ...args(), part: DECL[0] });
  // ONE PROPERTY IS THE WALL RATHER THAN THE RULE, and it bites harder for a
  // part than for a band: the design assigned the NAME and the page's imports
  // are written against it, so a writer that could answer its own would
  // eventually answer one and the page would import a file that is not there.
  assert.deepEqual(Object.keys(PART_TOOL.input_schema.properties), ["source"]);
  assert.deepEqual(PART_TOOL.input_schema.required, ["source"]);
  assert.notEqual(PART_TOOL.name, BAND_TOOL.name, "a part and a band answer the same tool — the two jobs are not the same job");
  assert.equal(req.tool_choice.name, PART_TOOL.name, "the part call does not compel its own tool");
  assert.deepEqual(req.tools, [PART_TOOL]);

  // THE CACHED SYSTEM BLOCK IS `pageRulesFor`'s, BY IDENTITY over every
  // spec/kind combination — not a fragment match, which passes a copy that
  // starts the same and drifts later, and a drifted copy is a second cold cache
  // prefix from the first byte that differs. A part obeys the same rules about
  // what the kit has and what may never be imported.
  for (const spec of [{}, { tables: [{ name: "bookings", columns: [] }] }]) {
    for (const kind of ["shopfront", "tool"]) {
      const r = partRequest({ ...args(), spec, kind, part: DECL[0] });
      assert.equal(r.system[0].text, pageRulesFor(spec, kind), "the part's rules are a copy, not the page's own");
      assert.equal(r.system[0].cache_control.type, "ephemeral", "the part's rules block is uncached");
    }
  }

  const text = partPrompt({ ...args(), part: DECL[0] });
  // THE FOUR FACTS ARE THE DIRECTIVE'S OWN, and the import path is the one that
  // makes the page compile: the page's import is written against the declared
  // name, so a prompt that named the file differently is a build that dies.
  assert.match(text, /ChordDiagram/, "the part is not told its own name");
  assert.match(text, /draws a guitar chord on a fretboard/, "the part is not told what it does");
  assert.match(text, /chord: string/, "the part is not told its props");
  assert.match(text, /@\/routes\/-parts\/ChordDiagram/, "the part is not told the path the page imports it by");
  assert.match(text, /default/i, "the part is not told to export as the default, which is what the import expects");
  assert.match(text, /a guitar school/, "the brief never reaches the part");
  // IT IS TOLD THE PAGE'S PLAN and NOT which band imports it: no band decides
  // that, and every one of them is being written at this moment.
  assert.match(text, /the price list/, "the part has no idea what page it lands on");
  assert.ok(!/YOURS IS Band/.test(text), "a part was told it was a band");
});

test("NOTHING WAITS, and the prompts are what say so", () => {
  // THE BAND PROMPT STATES INDEPENDENCE IN AS MANY WORDS. This is the sentence
  // the "no edges" answer rests on, so it is pinned: a session that wants a band
  // to wait for another has to change this first, deliberately.
  const bandText = BANDS.slice(BANDS.indexOf("export function bandPrompt"));
  assert.match(bandText, /being " \+\s*"written at the same time by someone else/,
    "the band prompt no longer tells a band its neighbours are simultaneous — the fan-out's own premise moved");

  // AND A PART READS ITS DECLARATION, NEVER A BAND. Driven rather than read:
  // the same declaration produces the same prompt whatever the bands say, which
  // is what "no edge" MEANS — and a prompt that quietly grew a dependency on
  // another agent's output could not have this property.
  const one = partPrompt({ ...args({ lines: ["x1", "x2"] }), part: DECL[0] });
  const two = partPrompt({ ...args({ lines: ["x1", "x2"] }), part: DECL[0] });
  assert.equal(one, two, "the part prompt is not deterministic in its own inputs");
});

test("the parts ride out beside the bands, in `write_pages`' own shape", async () => {
  const names = ["Band1A", "Band2The"];
  const out = await generateSiteBands(args({ tsx: DECL }), null, async (keys, reqs) => {
    // BANDS FIRST, PARTS AFTER — `bandsFromAnswers` pairs an answer to a band BY
    // ITS RAW INDEX, so the bands must occupy 0…N-1 for that pairing to be the
    // identity it has always been.
    assert.equal(reqs.length, 4, "the fan-out did not carry both kinds");
    assert.deepEqual(reqs.map((r) => r.tools[0].name),
      ["write_band", "write_band", "write_part", "write_part"], "the parts are not after the bands");
    return reqs.map((r, i) => ({
      i, state: "done", ms: (i + 1) * 10, waveMs: 40,
      answer: { content: [{ type: "tool_use", input: { source: i < 2 ? band(names[i]) : part(DECL[i - 2].name) } }], usage: {} },
    }));
  });

  assert.equal(out.bands, 2);
  assert.equal(out.wrote, 2);
  assert.equal(out.parts, 2);
  assert.equal(out.wroteParts, 2);
  // `{ name, source }` IS `write_pages`' OWN SHAPE FOR A PART. `validatePages`
  // owns what a component may be called, refuses an empty one and repairs
  // duplicate imports; handing it anything else would make the two generators
  // produce different things for one declaration.
  //
  // RE-ANCHORED 2026-09-11, when the BANDS became files too. The declared
  // components were the whole of `parts` and are now its tail: band files come
  // FIRST, because `bandsFromAnswers` pairs a band to its answer by RAW INDEX
  // and the declared parts sit above the bands in the request list. What was
  // never the property is that this list holds only what the design declared;
  // what IS the property is that each declaration still arrives under its own
  // name, in this shape, exactly once.
  const partNames = out.input.parts.map((p) => p.name);
  assert.deepEqual(partNames.slice(-2), ["ChordDiagram", "Tuner"], "a declared component lost its name or its place");
  assert.deepEqual(partNames.slice(0, -2), ["band-1-a", "band-2-the"], "the bands did not become files ahead of the declarations");
  assert.equal(new Set(partNames).size, partNames.length, "two files claimed one name — validatePages refuses the second");
  for (const p of out.input.parts) {
    assert.equal(typeof p.source, "string");
    assert.ok(p.source.trim(), "a part reached validation with no code in it");
    assert.ok(!("path" in p), "a part was handed a path — `validatePages` names the file from `name`");
  }
  // NEVER IN `pages`: a component in the page list would be counted against the
  // page cap, put in the nav manifest, published in `sitemap.xml` and stubbed.
  assert.deepEqual(out.input.pages.map((p) => p.path), ["index.tsx"]);
  // AND THE COUNTS STAY APART. `parts`/`wroteParts` count the DESIGN'S declared
  // components and not the band files beside them — a row that added them up
  // could not be undone, and every instrument built on those numbers reads what
  // it has always read.
  assert.equal(out.parts, 2, "the band files were counted as declared components");
  assert.equal(out.bands, 2);
  // A SITE THAT DECLARES NOTHING NOW CARRIES `parts` ALL THE SAME — inverted
  // deliberately, and it is the shape change this whole entry is about. Before
  // 2026-09-11 a build with no declared component sent no `parts` key at all,
  // because a band was a local function; every split build sends one now, and
  // it holds one file per band.
  const plain = await generateSiteBands(args(), null, async (keys, reqs) => reqs.map((r, i) => ({
    i, state: "done", ms: 10, waveMs: 10,
    answer: { content: [{ type: "tool_use", input: { source: band(names[i]) } }], usage: {} },
  })));
  assert.deepEqual(plain.input.parts.map((p) => p.name), ["band-1-a", "band-2-the"],
    "a split build's bands did not reach `parts` as files");
  assert.equal(plain.parts, 0, "a site that declared no component was counted as having some");
});

test("THE CHAIN: the declared names are held back from the band files, so one answer is one file", async () => {
  // THE DECLARED COMPONENTS HAVE TO REACH `assembleBands` AS `taken`, and the
  // hop is one word on one line. A design may legally declare `band-1-hero` —
  // `TSX_ITEM.name` asks for a kebab name and every kebab string is one — and
  // with the hop cut, the band's file and the component's file claim one name:
  // `validatePages` refuses the second, the page imports a file nothing wrote,
  // and vite refuses the build. A paid build ending in a placeholder.
  //
  // DRIVEN THROUGH THE REAL `generateSiteBands` rather than by reading the line,
  // because `freeBandFile` works perfectly with the hop cut — the argument it is
  // handed is simply empty, which is this repository's own recorded wiring trap:
  // a value computed and never forwarded.
  // THE LINE STARTS WITH "hero" ON PURPOSE: `bandName` is `Band<n><FirstWord>`,
  // so this band is `Band1Hero` and `bandFileName` kebabs it to exactly the name
  // the design declared. A line reading "a hero with…" answers `Band1A` and
  // collides with nothing, which is how a fixture can look like this case and
  // test none of it.
  const clash = [{ name: "band-1-hero", does: "a hero band, hand written", props: "x: string" }];
  const out = await generateSiteBands(args({ tsx: clash, lines: ["hero band with the workshop name"] }), null,
    async (keys, reqs) => reqs.map((r, i) => ({
      i, state: "done", ms: 10, waveMs: 10,
      answer: { content: [{ type: "tool_use", input: { source: i === 0 ? band("Band1Hero") : part("band-1-hero") } }], usage: {} },
    })));
  const names = out.input.parts.map((p) => p.name);
  assert.equal(names.length, 2, "one of the two files was lost before it reached validation");
  assert.equal(new Set(names).size, 2,
    "the band took the declared component's file name — validatePages refuses one and the page cannot compile");
  assert.ok(names.includes("band-1-hero"), "the DECLARED name moved; it is written into the page by tsxDirective and cannot");
  // AND THE PAGE IMPORTS THE FILE THAT EXISTS, which is the half a name check
  // alone cannot see: the move has to reach the import in the same pass.
  const m = /import Band1Hero from "@\/routes\/-parts\/([a-z0-9-]+)"/.exec(out.input.pages[0].source);
  assert.ok(m, "the band is not imported at all");
  assert.ok(names.includes(m[1]), "the page imports a file no part answers");
  assert.notEqual(m[1], "band-1-hero", "the page's band import points at the DECLARED component's file");
});

test("A FAILED PART IS STUBBED, NEVER DROPPED — the page already imports it", async () => {
  // THIS IS THE WHOLE REASON THE PATH IS SAFE TO TAKE. The design declared the
  // component, so a band may already have imported it: a file that is not there
  // is not a page missing a section, it is `vite` refusing the build — which is
  // precisely the failure `planRefusal` refused `tsx` to avoid.
  const names = ["Band1A", "Band2The"];
  const out = await generateSiteBands(args({ tsx: DECL }), null, async (keys, reqs) => reqs.map((r, i) => (
    i === 2
      ? { i, state: "failed", ms: 5, waveMs: 40, message: "upstream said no", status: 429 }
      : { i, state: "done", ms: 10, waveMs: 40,
          answer: { content: [{ type: "tool_use", input: { source: i < 2 ? band(names[i]) : part("Tuner") } }], usage: {} } }
  )));

  assert.equal(out.parts, 2, "the declaration stopped being counted");
  assert.equal(out.wroteParts, 1, "a stub was counted as written");
  // RE-ANCHORED 2026-09-11: the band files sit ahead of the declarations, so the
  // declared pair is the TAIL rather than the whole list. Being the whole list
  // was never the property — a declared component arriving at all, under its own
  // name, is.
  assert.deepEqual(out.input.parts.map((p) => p.name).slice(-2), ["ChordDiagram", "Tuner"],
    "the failed part was DROPPED — the page now imports a file nothing wrote");
  const stub = out.input.parts.find((p) => p.name === "ChordDiagram");
  assert.ok(stub, "the failed declaration produced no file at all");
  assert.match(stub.source, /export default function ChordDiagram/, "the stub is not importable by the name the page uses");
  assert.match(partStub("X"), /export default/, "a stub with no default export is not importable");
  assert.match(partStub("X"), /return null/, "a stub that renders something is not a stub");
  // A NAMELESS ONE STILL COMPILES rather than emitting `function ()`.
  assert.match(partStub(""), /export default function Part\b/);
  assert.match(partStub(null), /export default function Part\b/);
});

test("one source reader for both kinds, and the slot says which is which", async () => {
  // ONE READER: a band and a part answer different TOOLS and the same SHAPE, so
  // two readers would be "two lists of the same thing" over the one expression
  // that decides whether an agent's work is kept at all.
  assert.equal(answerSource({ content: [{ type: "tool_use", input: { source: "x" } }] }), "x");
  assert.equal(answerSource({ content: [{ type: "text", text: "x" }] }), "", "prose was read as source");
  // A PREAMBLE IS THE ORDINARY SHAPE AND IS THE ONE THAT SEPARATES THE TWO
  // READINGS. A model very often writes a sentence before it calls the tool, so
  // the tool_use is the SECOND block; the case above — prose and nothing else —
  // answers "" under a reader that takes the first block whatever it is, so it
  // cannot tell that reader from this one. This can: taking block 0 here finds
  // a text block with no `input` and answers "", which stubs every band and
  // every part of a build whose model happened to think out loud first.
  assert.equal(
    answerSource({ content: [{ type: "text", text: "Here is the hero." },
                             { type: "tool_use", input: { source: "real" } }] }),
    "real",
    "an answer that opened with a sentence lost its source",
  );
  for (const junk of [null, undefined, {}, { content: null }, { content: [{ type: "tool_use" }] },
    { content: [{ type: "tool_use", input: { source: 7 } }] }]) {
    assert.equal(answerSource(junk), "", "junk answered a source: " + JSON.stringify(junk));
  }
  // IT DOES NOT CHECK THE TOOL'S NAME, deliberately: `tool_choice` names it on
  // the way out, and a reader that re-checked would refuse a good answer the day
  // either tool is renamed on one side only.
  assert.equal(answerSource({ content: [{ type: "tool_use", name: "anything", input: { source: "y" } }] }), "y");

  // THE PAIRING IS BY SLOT, and an answer naming a slot nothing planned is
  // dropped rather than guessed at.
  assert.deepEqual(partsFromAnswers([], DECL, 2).map((p) => !!p.stub), [true, true]);
  const late = partsFromAnswers(
    [{ i: 3, state: "done", answer: { content: [{ type: "tool_use", input: { source: part("Tuner") } }] } },
     { i: 9, state: "done", answer: { content: [{ type: "tool_use", input: { source: "stray" } }] } }],
    DECL, 2);
  assert.equal(late[1].stub, undefined, "the answer at slot 3 did not reach part 2");
  assert.equal(late[0].stub, true, "part 1 answered nothing and was not stubbed");
  // A BAND'S SLOT IS NEVER READ AS A PART'S: slot 1 is inside the bands.
  const crossed = partsFromAnswers(
    [{ i: 1, state: "done", answer: { content: [{ type: "tool_use", input: { source: "a band" } }] } }], DECL, 2);
  assert.deepEqual(crossed.map((p) => !!p.stub), [true, true], "a band's answer was filed as a part");
});

test("WHATEVER THE DESIGNER PLANS, THE GENERATE STEP TAKES — nothing is refused for its width", () => {
  // RE-ANCHORED 2026-09-11, NOT APPEASED, AND INVERTED ON PURPOSE (owner:
  // "whatever the designer does then it should go to the generate, if the
  // designer does 9 the generate needs 9 if 8, 8"). This case used to assert
  // that one piece over `MAX_MODEL_FANOUT` answered `wide`. That refusal stood
  // for one day and its cost was structural: a page may plan `MAX_BANDS` (8)
  // bands and a design may declare `MAX_TSX` (3) components, so the page that
  // most wants splitting — a rich one that also needs something the kit has not
  // got — was exactly the page that could never split. `ben-crowe-guitar`
  // recorded `bands:wide` and a single call of 407,694 ms.
  //
  // THE REFUSAL BEING THERE WAS NEVER THE PROPERTY. The property is that every
  // piece the designer planned gets its own agent, which is what this asserts
  // now, at the widest plan the two producers can compose.
  const sections = (n) => Array.from({ length: n }, (_, i) => "band number " + i);
  const decls = (n) => Array.from({ length: n }, (_, i) => ({ name: "C" + i, does: "d" }));
  const args = (b, p) => ({ shape: [{ path: "/", sections: sections(b) }], route: "/", mode: "build", tsx: decls(p) });
  const at = (b, p) => planRefusal(args(b, p));
  assert.equal(at(MAX_BANDS, 0), "", "a full page of bands must split");
  assert.equal(at(MAX_BANDS, MAX_TSX), "", "the widest plan there is must split — this is the case the owner asked for");
  assert.equal(at(MAX_MODEL_FANOUT + 1, 0), "", "a plan one over the SOCKET bound must split — the extra band queues");
  assert.equal(at(2, MAX_TSX), "", "a small page with every declaration must still split");
  // AND THE PIECES REALLY ARE ALL THERE — the count, not just the verdict, since
  // a splitter that silently dropped the ninth piece would answer "" too.
  assert.equal(
    splitPlan(args(MAX_BANDS, MAX_TSX)).length + partsOf(decls(MAX_TSX)).length,
    MAX_BANDS + MAX_TSX,
    "the widest plan lost a piece on its way into the fan-out",
  );

  // THE CLEARANCE, WHICH IS WHAT REPLACED THE REFUSAL. `planRefusal` has no
  // width test at all now, and that is only safe while the container's list
  // bound is at least what these two producers can compose. Asserted here rather
  // than claimed in a comment, so the day a product cap outgrows it a test goes
  // red and somebody decides on purpose — instead of every such build quietly
  // falling back to one call.
  assert.ok(
    MAX_BANDS + MAX_TSX <= MAX_FANOUT_REQS,
    `a plan can compose ${MAX_BANDS + MAX_TSX} requests and the container takes ${MAX_FANOUT_REQS} — `
    + "raise MAX_FANOUT_REQS, or the widest plans go back to being written in one call",
  );
  // A NEGATIVE ASSERTION MUST PROVE ITS OBSERVER IS ALIVE: no width refusal may
  // come back into this function by any spelling, and the scan has to be looking
  // at a function that really is there.
  const body = blank(BANDS).slice(
    blank(BANDS).indexOf("export function planRefusal("),
    blank(BANDS).indexOf("export function splitPlan("),
  );
  assert.ok(body.length > 100, "the planRefusal body was not found — this scan proves nothing");
  assert.match(body, /return "thin"/, "…and it is not the function this case means to read");
  assert.ok(!/MAX_MODEL_FANOUT|MAX_FANOUT_REQS|MAX_TSX/.test(body),
    "planRefusal refuses on width again — a plan the designer made is not the generate step's to decline");

  // THE BOUND STILL HAS ONE HOME, so the Worker's decision and the container's
  // refusal cannot disagree about what fits.
  const fanoutMod = read("builder/model-fanout.mjs");
  assert.match(fanoutMod, /export const MAX_FANOUT_REQS/, "the list bound is not exported from the module about fan-outs");
  assert.match(fanoutMod, /export const MAX_MODEL_FANOUT/, "the socket bound is not exported from the module about fan-outs");
  // …and the splitter no longer needs to know EITHER. It used to import the
  // socket bound for the refusal above; a module that knows a number it cannot
  // act on is one edit from acting on it.
  assert.ok(!/import \{[^}]*MAX_(MODEL_FANOUT|FANOUT_REQS)[^}]*\} from "\.\/model-fanout\.mjs";/.test(blank(BANDS)),
    "the page splitter still reads a fan-out bound it has nothing left to do with");
});

test("THE CHAIN: the Worker hands the fan-out the declarations, not only the brief's copy of them", () => {
  // A VALUE BUILT IS NOT A VALUE THAT ARRIVES. `briefWithLayout` folds `tsx`
  // into the PROSE a band reads, which is where it went before today — so a
  // generator that never received the LIST would compose a perfectly good page
  // and no components at all, silently, on every build that declared one.
  const at = WCODE.indexOf("await generateSiteBands({");
  assert.ok(at > 0, "the band fan-out is no longer called");
  const close = "}, env, call, budget);";
  const end = WCODE.indexOf(close, at);
  assert.ok(end > at, "the fan-out call's closing landmark is gone — re-derive this window");
  const call = WCODE.slice(at, end + close.length);

  // READ AS THE CALL'S OWN TOP-LEVEL KEYS, by depth — and that is not
  // fastidiousness, it is this guard's FIRST DRAFT being wrong in exactly the
  // way its comment above warns about. `/(^|[\s,{])tsx,/` matched
  // `briefWithLayout({ brief, plan, tsx, … })` — the brief's copy, nested one
  // call down — so the mutant that stopped handing the LIST survived a guard
  // written to catch precisely that. Caught by running the mutant, never by
  // reading the assertion.
  const open = call.indexOf("{");
  let depth = 0, closed = false, body = "";
  for (let k = open; k < call.length; k++) {
    const c = call[k];
    if (c === "{" || c === "(" || c === "[") { depth++; if (depth > 1) body += c; continue; }
    if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (!depth) { closed = true; break; }
      body += c; continue;
    }
    if (depth >= 1) body += c;
  }
  // THE BODY MUST COME OUT BALANCED, which the first draft's did not: it added
  // every closing bracket and no opening one, so the splitter's depth went
  // NEGATIVE and never returned to zero — no keys at all, and the guard read
  // that as "tsx is missing". A flat scan where depth matters, recorded here
  // five-plus times.
  assert.ok(closed && body, "the fan-out call's object could not be read — re-derive this window");
  const keys = [];
  let d = 0, seg = "";
  for (const c of body + ",") {
    if (c === "{" || c === "(" || c === "[") d++;
    else if (c === "}" || c === ")" || c === "]") d--;
    if (c === "," && d === 0) { keys.push(seg.trim()); seg = ""; continue; }
    seg += c;
  }
  const named = keys.map((k) => k.split(":")[0].trim()).filter(Boolean);
  assert.ok(named.includes("tsx"),
    "the fan-out is not handed the declarations — every declared component would go unwritten. Keys: " + named.join(","));
  assert.ok(named.includes("lines"), "the fan-out stopped being handed the bands");
  // A FLOOR, so a window that read nothing cannot pass by scanning nothing.
  assert.ok(named.length >= 6, "the call's key list came back too short to be the real one: " + named.join(","));

  // AND THE ROW SAYS WHAT IT WROTE. `parts` and `wroteParts` beside `bands` and
  // `wrote`, never folded in — a row that added them up could not say whether a
  // build wrote seven bands or five bands and two components.
  const m = bandMarks({ bands: 5, wrote: 5, parts: 2, wroteParts: 1, agentMs: 9, waveMs: 3, eachMs: { p2: 7 } });
  assert.equal(m.parts, 2);
  assert.equal(m.wroteParts, 1);
  assert.equal(m.p2Ms, 7, "a part's own time never reaches the row");
});
