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
  answerSource, slotName, planRefusal, generateSiteBands, bandMarks,
} from "../builder/page-bands.mjs";
import { pageRulesFor, tsxDirective } from "../builder/page-gen.mjs";
import { MAX_MODEL_FANOUT } from "../builder/model-fanout.mjs";
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
  assert.deepEqual(out.input.parts.map((p) => p.name), ["ChordDiagram", "Tuner"]);
  for (const p of out.input.parts) {
    assert.equal(typeof p.source, "string");
    assert.ok(p.source.trim(), "a part reached validation with no code in it");
    assert.ok(!("path" in p), "a part was handed a path — `validatePages` names the file from `name`");
  }
  // NEVER IN `pages`: a component in the page list would be counted against the
  // page cap, put in the nav manifest, published in `sitemap.xml` and stubbed.
  assert.deepEqual(out.input.pages.map((p) => p.path), ["index.tsx"]);
  // A build that declares nothing carries no `parts` key at all, so the single
  // path's own answer shape is unchanged for every ordinary site.
  const plain = await generateSiteBands(args(), null, async (keys, reqs) => reqs.map((r, i) => ({
    i, state: "done", ms: 10, waveMs: 10,
    answer: { content: [{ type: "tool_use", input: { source: band(names[i]) } }], usage: {} },
  })));
  assert.ok(!("parts" in plain.input), "a site with no declared components carries an empty parts list");
  assert.equal(plain.parts, 0);
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
  assert.deepEqual(out.input.parts.map((p) => p.name), ["ChordDiagram", "Tuner"],
    "the failed part was DROPPED — the page now imports a file nothing wrote");
  const stub = out.input.parts[0];
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

test("the whole list has to fit in ONE job, and the bound has one home", () => {
  // `wide` IS WHAT REPLACED `tsx` AS A REFUSAL. Refusing the SPLIT is right;
  // dropping a band or a part to make the list fit would ship a page missing a
  // section or importing a file nothing wrote.
  const sections = (n) => Array.from({ length: n }, (_, i) => "band number " + i);
  const decls = (n) => Array.from({ length: n }, (_, i) => ({ name: "C" + i, does: "d" }));
  const at = (b, p) => planRefusal({ shape: [{ path: "/", sections: sections(b) }], route: "/", mode: "build", tsx: decls(p) });
  assert.equal(at(MAX_MODEL_FANOUT, 0), "", "exactly the bound must split");
  assert.equal(at(MAX_MODEL_FANOUT - 1, 1), "", "exactly the bound must split, whatever the mix");
  assert.equal(at(MAX_MODEL_FANOUT, 1), "wide", "one over the bound was sent to the container anyway");
  assert.equal(at(2, MAX_TSX), "", "a small page with every declaration must still split");
  // DERIVED FROM THE ONE HOME, so the Worker's decision and the container's
  // refusal cannot disagree about what fits.
  const fanoutMod = read("builder/model-fanout.mjs");
  assert.match(fanoutMod, /export const MAX_MODEL_FANOUT/, "the bound is not exported from the module about fan-outs");
  assert.match(blank(BANDS), /import \{[^}]*MAX_MODEL_FANOUT[^}]*\} from "\.\/model-fanout\.mjs";/,
    "the page splitter carries its own copy of the container's bound");
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
