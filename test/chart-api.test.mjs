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

test("every domain on disk is in the catalogue, and every catalogued one exists", () => {
  // BOTH directions, because each failure is silent in its own way: a module on
  // disk the model is never told about is dead weight of the kind deleted twice
  // already, and a module in the prompt that does not exist is an import the
  // model is invited to write and tsc then refuses.
  const onDisk = fs.readdirSync(LIB).filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, "")).sort();
  assert.deepEqual(Object.keys(CHART_COMPONENTS).sort(), onDisk);
  assert.ok(onDisk.length > 100, `only ${onDisk.length} chart domains — something has gone missing`);
});

test("every name in the catalogue is really exported by the module it is listed under", () => {
  // The listing is what the model picks from; if a name is filed under the wrong
  // domain the import compiles nowhere and the lint below cannot help, because
  // the lint reads this same table.
  for (const [domain, names] of Object.entries(CHART_COMPONENTS)) {
    const real = exportedNames(fs.readFileSync(path.join(LIB, domain + ".tsx"), "utf8"));
    assert.deepEqual(names, real, `${domain} is listed with names it does not export`);
  }
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

test("a demo import is refused by name, not left to tsc", () => {
  // The examples lint rule was retired when its folder went, on the reasoning
  // that a missing module is caught by tsc like any other. These 1,140 files are
  // NOT missing: an import of one compiles, bundles and publishes invented
  // figures to a real business's visitors, which nothing else in the pipeline
  // can distinguish from a real chart.
  const got = lint('import Chart from "@/components/charts/chart-bullet-default";');
  assert.equal(got.length, 1);
  assert.match(got[0], /DEMO/);
  assert.match(got[0], /charts\/lib\//, "the message has to say where the real one is");
  // The premise, asserted rather than assumed — delete the demos and this rule
  // should go the way the examples rule did.
  const demos = fs.readdirSync(path.join(TEMPLATE, "src/components/charts"))
    .filter((f) => f.endsWith(".tsx"));
  assert.ok(demos.length > 0,
    "no demo files left — this lint rule now guards a path that does not resolve, and should be removed");
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

test("a name imported from the wrong domain is pointed at the right one", () => {
  // Six names live in two modules each, so "does this name exist" is not the
  // question — "does it exist HERE" is.
  const dupes = {};
  for (const [domain, names] of Object.entries(CHART_COMPONENTS)) {
    for (const n of names) (dupes[n] ??= []).push(domain);
  }
  const shared = Object.entries(dupes).filter(([, ds]) => ds.length > 1);
  assert.ok(shared.length > 0, "no shared names — this rule is guarding nothing");

  const [name, domains] = shared[0];
  const wrong = Object.keys(CHART_COMPONENTS).find((d) => !domains.includes(d));
  const got = lint(`import { ${name} } from "@/components/charts/lib/${wrong}";`);
  assert.equal(got.length, 1);
  for (const d of domains) assert.match(got[0], new RegExp(d), "the real domains are named");
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

test("no worked example teaches the model to fabricate data", () => {
  // Several lib modules export a generator beside the component — `sampleBoxes`,
  // `sampleCandles`, `sample`, `rng`. They are real exports, so an example using
  // one COMPILES, and that is the danger: the model copies
  // `sampleBoxes(["Mon","Tue"], 9)` into a real page and a business publishes
  // random numbers. The demo-import lint exists to stop exactly that, and an
  // example is a second door into it.
  //
  // It also shows nothing. The whole value here is the SHAPE of the data, which
  // a generator call hides behind a function name.
  const dirty = Object.entries(CHART_USAGE).filter(([, v]) => fabricates(v));
  assert.deepEqual(dirty.map(([k]) => k), []);
  // The rule must be doing work: `boxplot.BoxPlot`'s only demo fabricates, so it
  // has to be absent. Without that this test passes on a build where the filter
  // was never applied because nothing fabricated in the first place.
  assert.ok(!CHART_USAGE["boxplot.BoxPlot"],
    "boxplot.BoxPlot's demo calls sampleBoxes — it must be dropped, not cleaned up");
  assert.ok(CHART_USAGE["waterfall.Waterfall"], "a clean example must still survive");
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

test("a repair gets worked calls only for the charts the page imported", () => {
  const usage = importedChartUsage([{
    path: "index.tsx",
    source: 'import { Waterfall } from "@/components/charts/lib/waterfall";\n' +
            'import { Button } from "@/components/ui/button";',
  }]);
  assert.match(usage, /^waterfall\.Waterfall$/m);
  assert.match(usage, /<Waterfall steps=/);
  // The shape a bare signature could never give: `Step` is a name the model
  // cannot resolve, and the example shows its fields AND the optional `total`.
  assert.match(usage, /label:/);
  assert.match(usage, /total: true/);
  assert.ok(!/histogram\./.test(usage), "only what the page imported");

  assert.equal(importedChartUsage([{ path: "index.tsx", source: "const x = 1;" }]), null,
    "a page with no chart imports adds no section at all");

  // An IMPORTED primitive with no mined example must be omitted, not emitted
  // empty. `salon` has no demo — like every one of the 96 industry domains — so
  // this is the common case, not an edge one, and a survivor proved nothing was
  // checking it: without the guard the prompt gets "salon.StationHours" followed
  // by the word `undefined`, which reads as a worked call showing no props.
  const none = importedChartUsage([{
    path: "index.tsx",
    source: 'import { StationHours } from "@/components/charts/lib/salon";',
  }]);
  assert.equal(none, null, "a primitive with no example must add nothing");
  const mixed = importedChartUsage([{
    path: "index.tsx",
    source: 'import { StationHours } from "@/components/charts/lib/salon";\n' +
            'import { Waterfall } from "@/components/charts/lib/waterfall";',
  }]);
  assert.ok(!/undefined/.test(mixed), "never the string `undefined` in the prompt");
  assert.ok(!/salon\./.test(mixed), "the unmined one is left out entirely");
});

test("worked examples ride on the repair only, never the first call", () => {
  const pages = [{ path: "index.tsx", source: 'import { Waterfall } from "@/components/charts/lib/waterfall";' }];
  const repair = repairPrompt("a cafe", { tables: [] }, pages, ["boom"], "Cafe");
  assert.match(repair, /WORKING CALLS FOR THE CHARTS YOU IMPORTED/);
  // Ordering is deliberate: the signature is the whole surface, the example is
  // one working point on it. Read the other way round, a call showing four of
  // nine props reads as the four that exist.
  //
  // BOTH markers are asserted present FIRST. Written as a bare `<` comparison
  // this passed with the signatures gone entirely — `indexOf` answers -1, and
  // -1 is less than any real index, so a mutant deleting the section survived an
  // assertion whose whole subject was that section.
  const props = repair.indexOf("THE EXACT PROPS");
  const calls = repair.indexOf("WORKING CALLS");
  assert.ok(props >= 0, "the signatures section is missing");
  assert.ok(calls >= 0, "the worked-calls section is missing");
  assert.ok(props < calls, "signatures must come before examples");

  const plain = pagesRequest({ brief: "a cafe", spec: { tables: [] }, brand: "Cafe" });
  assert.ok(!/WORKING CALLS/.test(plain.system[0].text + plain.messages[0].content),
    "a build that worked must not pay for these");
});

test("the examples cover the demoed domains and cannot cover the others", () => {
  // An honest statement of the ceiling. The 1,140 demos import only 45 of the
  // 141 lib modules, so 96 domains — every industry one, which is what this
  // platform actually builds for — can never have a mined example. That is a
  // property of the demos, not a bug here, and it is the reason the signatures
  // have to stand on their own.
  const domains = new Set(Object.keys(CHART_USAGE).map((k) => k.split(".")[0]));
  assert.ok(domains.size > 20, `only ${domains.size} domains have an example — the miner has regressed`);
  assert.ok(domains.size < Object.keys(CHART_COMPONENTS).length,
    "if every domain has an example the demos have grown — re-check this claim");
  assert.ok(!domains.has("salon"), "salon has no demo, so it cannot have a mined example");
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
