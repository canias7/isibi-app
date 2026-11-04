// The chart layer, and the guards that keep it reachable and honest.
//
// This tier has the exact shape of two things this repo installed and then
// deleted: the 27 blocks and the 196 examples were both on disk, both compiled,
// and both were reachable by NOTHING, because no rule ever told the model they
// existed. The difference has to be asserted, not assumed — so these tests check
// the whole chain, from a file on disk to a name in the prompt to a lint that
// refuses the wrong import.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, render, exportedNames } from "../builder/gen-chart-api.mjs";
import { build as buildUsage, render as renderUsage, fabricates } from "../builder/gen-chart-usage.mjs";
import { CHART_USAGE } from "../builder/chart-usage.mjs";
import { CHART_COMPONENTS, CHART_API } from "../builder/chart-api.mjs";
import { PAGE_RULES, CHART_CATALOGUE, lintPages, importedComponentApi, importedChartUsage,
  pagesPrompt, pagesRequest, repairPrompt } from "../builder/page-gen.mjs";

const TEMPLATE = "builder/lovable/template";
const LIB = path.join(TEMPLATE, "src/components/charts/lib");
const lint = (source, spec = { tables: [] }) => lintPages([{ path: "index.tsx", source }], spec);

test("the committed chart api matches what the modules actually export", () => {
  const fresh = render(build());
  const committed = fs.readFileSync("builder/chart-api.mjs", "utf8");
  assert.equal(fresh, committed,
    "builder/chart-api.mjs is stale — run `node builder/gen-chart-api.mjs`");
});



test("the catalogue is in the prompt, or none of this is reachable", () => {
  // The single assertion this whole tier stands on. Everything else here can be
  // perfect and the charts are still dead if the model is never handed the names.
  assert.ok(PAGE_RULES.includes(CHART_CATALOGUE), "the chart catalogue is not in PAGE_RULES");
  assert.match(PAGE_RULES, /@\/components\/charts\/lib\//, "the import path is never stated");
  // Spot-check a real one end to end rather than trusting the includes() alone.
  assert.match(PAGE_RULES, /^bullet: .*\bBullet\b/m);
  const total = Object.values(CHART_COMPONENTS).reduce((n, v) => n + v.length, 0);
  assert.ok(PAGE_RULES.includes(String(total)), "the stated count disagrees with the catalogue");
});

test("the rules never tell the model the kit stops at @/components/ui", () => {
  // Rule 3 said "These exist and nothing else does" about the ui folder — an
  // absolute sentence, ten rules BEFORE the one that tells the model 882 more
  // components exist. Nothing was broken and nothing failed; the model just
  // reads the flat denial first and has no reason to go looking. That is how a
  // whole tier stays unused while every test passes, which is the failure mode
  // this file exists for.
  assert.ok(!/nothing else does:/.test(PAGE_RULES),
    "an unqualified 'nothing else exists' contradicts the chart catalogue below it");
  // And the charts must be presented as the same kit, not a separate system.
  assert.match(PAGE_RULES, /part of the\s+same kit/);
});


test("a good chart import passes clean", () => {
  assert.deepEqual(lint('import { Bullet } from "@/components/charts/lib/bullet";'), []);
  assert.deepEqual(lint('import { Bullet as B } from "@/components/charts/lib/bullet";'), [],
    "an alias imports the real name; the local name is the page's business");
});

test("the demo rule spares lib/ and still reaches a nested path", () => {
  // Both halves in one test, because they are one regex and each without the
  // other is wrong. The path class allows `/` so a nested demo is caught; the
  // negative lookahead is what then keeps every real chart import out of it.
  // With the class written `[a-z0-9-]+` the lookahead was a no-op — it could not
  // have mattered, since the class never crossed a slash — and removing it
  // passed the entire suite. So the pair is asserted together.
  assert.deepEqual(lint('import { Bullet } from "@/components/charts/lib/bullet";'), [],
    "lib/ must never be mistaken for a demo");
  const nested = lint('import X from "@/components/charts/some/nested/demo";');
  assert.equal(nested.length, 1, "a nested path under charts/ is still not a component");
  assert.match(nested[0], /DEMO/);
});


test("an unknown domain and an unknown name are both caught", () => {
  const badDomain = lint('import { Bullet } from "@/components/charts/lib/nosuchthing";');
  assert.equal(badDomain.length, 1);
  assert.match(badDomain[0], /not a chart domain/);

  const badName = lint('import { Sparkline } from "@/components/charts/lib/bullet";');
  assert.equal(badName.length, 1);
  assert.match(badName[0], /not exported/);
  assert.match(badName[0], /Bullet, BulletList/, "the message lists what is actually there");
});

test("one wrong name among several is still caught", () => {
  const got = lint('import { Bullet, Nope } from "@/components/charts/lib/bullet";');
  assert.equal(got.length, 1);
  assert.match(got[0], /"Nope"/);
});

test("a chart import inside a comment is not a chart import", () => {
  assert.deepEqual(lint('// import Chart from "@/components/charts/chart-bullet-default";'), []);
  assert.deepEqual(lint('/* import { X } from "@/components/charts/lib/nope"; */'), []);
});

test("a repair gets the signatures of the chart domains the page used, and no others", () => {
  const api = importedComponentApi([{
    path: "index.tsx",
    source: 'import { Bullet } from "@/components/charts/lib/bullet";\n' +
            'import { Button } from "@/components/ui/button";',
  }]);
  assert.match(api, /^charts\/lib\/bullet — Bullet\(/m);
  // The other 140 must not be in there, or the repair prompt costs what the
  // whole compose/repair split exists to avoid.
  assert.equal(api.split("\n").filter((l) => l.startsWith("charts/lib/")).length, 1);
});

test("chart signatures are on the repair only; the names are on every call", () => {
  const plain = pagesPrompt("a gym", { tables: [] }, "Gym");
  assert.ok(!/charts\/lib\/bullet — /.test(plain), "signatures must not ride on every build");

  // The names live in the SYSTEM block, which carries cache_control: ephemeral —
  // so the catalogue is a cache read on every build after the first rather than
  // fresh input tokens, which is most of why the full 882 is affordable at all.
  const req = pagesRequest({ brief: "a gym", spec: { tables: [] }, brand: "Gym" });
  assert.match(req.system[0].text, /^bullet: /m, "the names must be in the prompt or nothing is importable");
  assert.equal(req.system[0].cache_control.type, "ephemeral",
    "the catalogue is only affordable because this block is cached");
});

test("the chart lib is typechecked by something", () => {
  // It was typechecked by NOTHING until the day it was wired: tsconfig.json
  // excludes all of src/components/charts, tsconfig.kit.json covered only `ui`,
  // and the demos that import it are excluded too — so no import was ever
  // followed into it. It happened to be clean, which is luck and not a check.
  const kit = JSON.parse(fs.readFileSync(path.join(TEMPLATE, "tsconfig.kit.json"), "utf8")
    .replace(/^\s*\/\/[^\n]*$/gm, ""));
  assert.ok(kit.include.some((g) => g.includes("charts/lib")),
    "tsconfig.kit.json does not cover charts/lib — the primitives are unchecked");
  assert.ok(!kit.include.some((g) => /charts\/\*|charts\/\*\*/.test(g)),
    "the 1,140 demos must stay out of the typecheck; they are a catalogue");
});

test("no chart primitive is a type, which cannot be rendered", () => {
  // `export type` is deliberately not collected. Listing one among the
  // components invites importing it as a value — a compile error the model
  // would have been talked into by our own prompt.
  const types = [];
  for (const domain of Object.keys(CHART_COMPONENTS)) {
    const src = fs.readFileSync(path.join(LIB, domain + ".tsx"), "utf8");
    for (const m of src.matchAll(/^export type ([A-Za-z0-9_]+)/gm)) {
      if (CHART_COMPONENTS[domain].includes(m[1])) types.push(`${domain}.${m[1]}`);
    }
  }
  assert.deepEqual(types, [], "a type is listed as a component");
});

test("a signature names every required prop, not just the first", () => {
  // THE BUG THIS EXISTS FOR, and it shipped. The chart lib is written WITHOUT
  // semicolons, and the first version borrowed the component kit's extractor,
  // which collapses whitespace and splits the prop block on `;`. With no
  // semicolons the whole block is one part, `indexOf(":")` finds the first
  // colon, and all 141 domains came out as one prop typed `object` —
  // `ServiceMix(services: object)` for something that really takes a five-field
  // row array. Handed to the model as "the real signatures, taken from the
  // components themselves".
  //
  // Derived from the source at both ends, so it cannot be satisfied by a
  // hardcoded example.
  const wrong = [];
  for (const [domain, sig] of Object.entries(CHART_API)) {
    const src = fs.readFileSync(path.join(LIB, domain + ".tsx"), "utf8");
    for (const one of sig.split(" · ")) {
      const name = one.slice(0, one.indexOf("("));
      const documented = new Set([...one.matchAll(/(?:\(|, )([a-zA-Z_]\w*)\??:/g)].map((m) => m[1]));
      // The component's own destructuring is the truth about what it takes.
      const at = src.search(new RegExp("export function " + name + "\\s*\\("));
      if (at < 0) continue;
      const open = src.indexOf("{", at);
      const close = src.indexOf("}", open);
      // Comments out FIRST. A doc comment inside the destructuring can contain a
      // comma — `/** marks[student][assessment], null = not sat */` — and
      // splitting before stripping made `null` look like a prop the signature
      // had forgotten. The test reporting a bug in correct code is the same
      // class of wrong as missing a real one.
      const taken = src.slice(open + 1, close)
        .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")
        .split(",").map((s) => s.split("=")[0].trim())
        .filter((s) => /^[a-zA-Z_]\w*$/.test(s) && s !== "className");
      for (const prop of taken) {
        if (!documented.has(prop)) wrong.push(`${domain}.${name} does not document \`${prop}\``);
      }
    }
  }
  assert.deepEqual(wrong.slice(0, 12), [], `${wrong.length} signatures are missing props`);
});


test("every documented signature belongs to a catalogued domain", () => {
  for (const domain of Object.keys(CHART_API)) {
    assert.ok(CHART_COMPONENTS[domain], `${domain} has signatures but is not in the catalogue`);
  }
});

test("the committed worked examples match what the demos actually do", () => {
  const fresh = renderUsage(buildUsage());
  const committed = fs.readFileSync("builder/chart-usage.mjs", "utf8");
  assert.equal(fresh, committed,
    "builder/chart-usage.mjs is stale — run `node builder/gen-chart-usage.mjs`");
});


test("every worked example names a primitive that exists", () => {
  for (const key of Object.keys(CHART_USAGE)) {
    const [domain, name] = key.split(".");
    assert.ok(CHART_COMPONENTS[domain], `${key} names a domain that does not exist`);
    assert.ok(CHART_COMPONENTS[domain].includes(name), `${key} names an export that does not exist`);
    // And the example must actually call it, or it is documentation of
    // something else that happened to sit in the same demo.
    assert.match(CHART_USAGE[key], new RegExp("<" + name + "[\\s/>]"), `${key} does not call ${name}`);
  }
});




test("nothing in the chart lib carries meaning by colour alone", () => {
  // The prompt tells the model these are monochrome. That sentence was FALSE
  // when it was written: eight reference lines across seven modules — a "Now"
  // line, a mean, a playhead, a zero crossing — were drawn in `destructive`,
  // which is red. None of them meant anything destructive; they were positions
  // distinguished only by hue, so each one vanished into the plot in greyscale,
  // in print, and for anyone who cannot see the difference. Found by RENDERING
  // one, which is the only thing that finds a colour bug: it typechecks, it
  // bundles, and every other test in this repo passes.
  //
  // A claim in the prompt that nothing holds is how this codebase has been
  // bitten repeatedly, so the claim is held here.
  const offenders = [];
  for (const domain of Object.keys(CHART_COMPONENTS)) {
    const src = fs.readFileSync(path.join(LIB, domain + ".tsx"), "utf8");
    if (/\b(?:bg|text|border|fill|stroke)-destructive\b|var\(--destructive\)/.test(src)) {
      offenders.push(domain + " uses the destructive token");
    }
    // A literal hex or named colour is the other way in, and it bypasses the
    // theme entirely — so it survives a dark-mode switch as the wrong colour.
    const literal = src.match(/(?:stroke|fill|color|background)="(?:#[0-9a-fA-F]{3,8}|red|blue|green|orange|purple|crimson)"/);
    if (literal) offenders.push(`${domain} hard-codes ${literal[0]}`);
  }
  assert.deepEqual(offenders, [],
    "a chart is carrying state in colour — use fill, weight, dashing or a written label");
});
