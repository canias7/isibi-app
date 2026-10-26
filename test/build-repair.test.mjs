// The build repair (owner-approved ideas #11, #12, #13, 2026-10-22):
//   #12 the render check keeps each route's browser errors as data;
//   #11 one automatic repair try at a page that did not compile, before salvage;
//   #13 the instruction names the real cause, and the same failure is never
//       tried twice in one build.
// Driven with supplied answers only — no model is called here.
import { test } from "node:test";
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderReport, runtimeErrorsOf, MAX_RUNTIME_ERRORS, MAX_RUNTIME_PER_ROUTE } from "../builder/site-render.mjs";
import { stackSource, runtimeOfConsole, shortSource, REJECTION_MARK } from "../builder/render-check.mjs";
import {
  buildRepairOn, namedCause, failureSignature, compileInstruction, compileBrief, compileRepairPages,
  repairBrief, repairPages, runtimeLines, COMPILE_REPAIR_RULES, MAX_REPAIRS,
} from "../builder/site-repair.mjs";
import { publishPages, pageCredits, errorCitations } from "../builder/publish-pages.mjs";
import { talkBuildStepFacts } from "../builder/site-progress.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "name", type: "text" }] },
    { name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] },
  ],
};
const HOME = { path: "index.tsx", source: `import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Page });
function Page() { const { data } = useRows("services"); return <div>{data?.length}</div>; }` };
const BROKEN = `import { createFileRoute } from "@tanstack/react-router";
import { Nope } from "@/components/ui/nope";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/menu")({ component: Page });
function Page() { const { data } = useRows("services"); return <div className="menu">{data?.length}</div>; }`;
const FIXED = BROKEN.replace('import { Nope } from "@/components/ui/nope";\n', "");
const MENU = { path: "menu.tsx", source: BROKEN };
const VITE_ERR = '[vite]: Rollup failed to resolve import "@/components/ui/nope" from "/app/src/routes/menu.tsx".';
const TSC_ERR = "src/routes/menu.tsx(2,22): error TS2307: Cannot find module '@/components/ui/nope' or its corresponding type declarations.";
const tweakAnswer = (req, source, usage = { input_tokens: 4000, output_tokens: 900 }) => ({ content: [{ type: "tool_use", name: "write_tweak", input: tweakInput({ source }, req) }], usage });

/* ------------------------------------------------------------- #12 */

test("#12: each route's exceptions, rejections and console errors ride the report as data", () => {
  const r = renderReport([
    { route: "/", viewport: "phone", hasRoot: true, textLength: 500, runtime: [
      { kind: "exception", message: "Cannot read properties of undefined (reading 'EUR')", source: "/assets/index-abc.js:3:120" },
      { kind: "console", message: "Failed to load resource", source: null },
    ] },
    { route: "/", viewport: "desktop", hasRoot: true, textLength: 500, runtime: [
      { kind: "exception", message: "Cannot read properties of undefined (reading 'EUR')", source: "/assets/index-abc.js:3:120" },
    ] },
    { route: "/book", viewport: "phone", hasRoot: true, textLength: 500, runtime: [{ kind: "rejection", message: "fetch failed", source: null }] },
  ]);
  assert.deepEqual(r.runtimeErrors, [
    { route: "/", kind: "exception", message: "Cannot read properties of undefined (reading 'EUR')", source: "/assets/index-abc.js:3:120" },
    { route: "/", kind: "console", message: "Failed to load resource", source: null },
    { route: "/book", kind: "rejection", message: "fetch failed", source: null },
  ], "deduped across widths, one entry per route, kind and message");
});

// A19-3: a cut-short check reached only some routes and viewports, so it
// cannot call a rule dead; a whole run still can.
test("A19-3: a cut render report carries no dead selectors; a whole one does", () => {
  const obs = [{ route: "/", viewport: "phone", hasRoot: true, textLength: 500, runtime: [] }];
  const cut = renderReport(obs, { cut: true, deadSelectors: ["body[data-page=\"/es/menu\"] h1"], selectorsLooked: 1 });
  assert.equal(cut.partial, true);
  assert.equal(Object.hasOwn(cut, "deadSelectors"), false, "a partial run reported a rule dead");
  const whole = renderReport(obs, { deadSelectors: ["header button"], selectorsLooked: 1 });
  assert.deepEqual(whole.deadSelectors, ["header button"], "control: a whole run lost its dead rule");
});

test("#12: a clean report carries no runtime field (byte-identical)", () => {
  const r = renderReport([{ route: "/", viewport: "phone", hasRoot: true, textLength: 500, runtime: [] }]);
  assert.equal(Object.hasOwn(r, "runtimeErrors"), false);
  assert.equal(Object.hasOwn(r, "runtimeMore"), false);
});

test("#12: capped per route and in all, the rest counted", () => {
  const many = (route, n) => ({ route, runtime: Array.from({ length: n }, (_, i) => ({ kind: "console", message: route + " e" + i })) });
  const one = runtimeErrorsOf([many("/", 9)]);
  assert.equal(one.errors.length, MAX_RUNTIME_PER_ROUTE);
  assert.equal(one.more, 9 - MAX_RUNTIME_PER_ROUTE);
  const all = runtimeErrorsOf(Array.from({ length: 10 }, (_, i) => many("/r" + i, 5)));
  assert.equal(all.errors.length, MAX_RUNTIME_ERRORS);
  assert.equal(all.more, 50 - MAX_RUNTIME_ERRORS);
});

test("#12: one rejection reported twice by the browser is one entry; junk is refused", () => {
  const { errors } = runtimeErrorsOf([{ route: "/", runtime: [
    { kind: "exception", message: "boom" }, { kind: "rejection", message: "boom" },
    { kind: "weird", message: "x" }, { kind: "console", message: ["a"] }, null,
  ] }]);
  assert.deepEqual(errors, [{ route: "/", kind: "rejection", message: "boom", source: null }]);
});

test("#12: an older observation's string lists are read with no source", () => {
  const { errors } = runtimeErrorsOf([{ route: "/x", pageErrors: ["e1"], consoleErrors: ["c1"] }]);
  assert.deepEqual(errors, [
    { route: "/x", kind: "exception", message: "e1", source: null },
    { route: "/x", kind: "console", message: "c1", source: null },
  ]);
});

test("#12: the observer's helpers — stack frame, console rejection, short source", () => {
  assert.equal(stackSource("TypeError: x\n    at Page (http://127.0.0.1:4111/assets/index-abc.js?v=1:3:120)\n    at y"), "/assets/index-abc.js:3:120");
  assert.equal(stackSource("no frames here"), null);
  assert.deepEqual(runtimeOfConsole("[unhandledrejection] fetch failed", "/a.js:1:1"), { kind: "rejection", message: "fetch failed", source: "/a.js:1:1" });
  assert.deepEqual(runtimeOfConsole("Uncaught (in promise) Error: nope"), { kind: "rejection", message: "Error: nope", source: null });
  assert.deepEqual(runtimeOfConsole("plain error"), { kind: "console", message: "plain error", source: null });
  assert.equal(shortSource("http://127.0.0.1:9/x/y.js?z#q"), "/x/y.js");
  assert.ok(REJECTION_MARK.test("[unhandledrejection] a"));
});

test("#12: the checker wires the data and keeps its own observer line out of the findings", () => {
  const src = fs.readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("obs.runtime = runtime;"), "the observation carries the runtime list");
  assert.ok(/if \(!text\.startsWith\(OBSERVER_MARK\)\) consoleErrors\.push/.test(src), "the observer's line never becomes a `logged` finding");
  assert.ok(src.includes('addEventListener("unhandledrejection"'), "rejections are observed");
});

/* ------------------------------------------------------------- #13 */

test("#13: the cause is named, not the symptom", () => {
  assert.match(namedCause('"Buton" is not exported by "/app/src/components/ui/button.tsx"'), /imports `Buton` from `src\/components\/ui\/button.tsx`.*no export/);
  assert.match(namedCause(VITE_ERR), /module `@\/components\/ui\/nope` does not exist/);
  assert.match(namedCause(TSC_ERR), /module `@\/components\/ui\/nope` does not exist/);
  assert.match(namedCause("Module '\"@/components/ui/card\"' has no exported member 'CardBody'."), /imports `CardBody`/);
  assert.match(namedCause("Error transforming route file /app/src/routes/index.tsx: SyntaxError: Identifier 'createFileRoute' has already been declared. (3:9)"), /declared twice/);
  assert.match(namedCause("Error transforming route file /app/src/routes/x.tsx: SyntaxError: Unexpected token (4:2)"), /path is fine; the fault is inside it: SyntaxError: Unexpected token/);
  assert.match(namedCause("ENOENT: no such file or directory, open '/app/src/routes/x.tsx'"), /about a file path, not the code/);
  assert.match(namedCause("ReferenceError: Badge is not defined"), /`Badge` is used but never imported/);
  assert.match(namedCause("useFormField should be used within <FormField>"), /`useFormField` is called outside the `FormField`/);
  assert.equal(namedCause("something nobody has seen"), null, "no guess");
});

test("#13: one failure, one signature, whatever its line numbers and directory", () => {
  const a = failureSignature("menu.tsx", "/app/src/routes/menu.tsx:12:3: ERROR: Expected \";\"");
  const b = failureSignature("menu.tsx", "/build/x/src/routes/menu.tsx:40:9: ERROR: Expected \";\"");
  assert.equal(a, b);
  assert.notEqual(a, failureSignature("menu.tsx", "/app/src/routes/menu.tsx:12:3: ERROR: Unexpected \"}\""));
  assert.notEqual(a, failureSignature("about.tsx", "/app/src/routes/menu.tsx:12:3: ERROR: Expected \";\""));
});

test("#13: a page whose failure was already tried is not tried again, and says so", async () => {
  const cites = errorCitations(VITE_ERR);
  const sig = compileInstruction({ path: "menu.tsx", error: VITE_ERR }).signature;
  let calls = 0;
  const r = await compileRepairPages({ error: VITE_ERR, pages: [HOME, MENU], citations: cites, send: async (req) => { calls++; return tweakAnswer(req, FIXED); }, tried: new Set([sig]) });
  assert.equal(calls, 0, "the same failure is never paid for twice");
  assert.deepEqual(r.skipped, [{ path: "menu.tsx", reason: "same-error" }]);
  // and the render repair skips a route whose failure signature is recorded
  const report = { ok: true, findings: [{ route: "/menu", kind: "threw", detail: "boom" }] };
  const first = repairBrief(report, [HOME, MENU], { runtime: true });
  assert.equal(first.work.length, 1);
  const again = repairBrief(report, [HOME, MENU], { runtime: true, tried: new Set([first.work[0].signature]) });
  assert.equal(again.work.length, 0);
});

/* ------------------------------------------------------------- #11 */

test("#11: the repair request — the failing page, its exact errors, the cause, the build's model", async () => {
  const sent = [];
  const r = await compileRepairPages({
    error: VITE_ERR, typeErrors: TSC_ERR + "\nsrc/routes/index.tsx(1,1): error TS1: other file", pages: [HOME, MENU],
    citations: errorCitations(VITE_ERR), cited: ["menu.tsx:2: import { Nope } from \"@/components/ui/nope\";"],
    send: async (req) => { sent.push(req); return tweakAnswer(req, FIXED); }, model: "grok-4.6", tried: new Set(),
  });
  assert.equal(sent.length, 1, "one call for the one failing page");
  const req = sent[0];
  assert.equal(req.model, "grok-4.6", "the build's own pages model");
  assert.equal(req.system, COMPILE_REPAIR_RULES);
  const msg = req.messages[0].content;
  assert.ok(msg.includes("THE FILE (/menu)") && msg.includes(BROKEN), "the failing page's whole source");
  assert.ok(msg.includes(VITE_ERR), "the bundler's exact words");
  assert.ok(msg.includes(TSC_ERR), "tsc's words for this file");
  assert.ok(!msg.includes("other file"), "never another file's errors");
  assert.match(msg, /THE CAUSE: The module `@\/components\/ui\/nope` does not exist/);
  assert.deepEqual(r.repaired, [{ path: "menu.tsx", route: "/menu" }]);
  assert.equal(r.pages.find((p) => p.path === "menu.tsx").source, FIXED);
  assert.equal(r.pages.find((p) => p.path === "index.tsx"), HOME, "an untouched page comes back as it went in");
  assert.deepEqual(r.usage, [{ model: "grok-4.6", in: 4000, out: 900, cacheRead: 0, cacheWrite: 0 }]);
});

test("#11: every page the compiler names is sent (no cap, 2026-10-24); a page the build did not write is never sent", () => {
  const pages = Array.from({ length: 5 }, (_, i) => ({ path: "p" + i + ".tsx", source: BROKEN }));
  const err = pages.map((p) => `/app/src/routes/${p.path}:1:1: ERROR: Expected ";"`).join("\n") + "\n/app/src/components/ui/x.tsx:1:1: ERROR: y";
  const b = compileBrief({ error: err, pages, citations: errorCitations(err) });
  assert.equal(MAX_REPAIRS, Infinity);
  assert.equal(b.work.length, 5);
  assert.equal(b.dropped, 0);
  assert.ok(b.work.every((w) => w.path.startsWith("p")));
});

/* --------------------------------------------- inside publishPages */

function harness(over = {}) {
  const calls = { compile: [], publish: [], stored: [], charges: [], fix: [], notes: [] };
  const deps = {
    generate: async () => ({ input: { pages: [HOME, MENU], notes: "" }, usage: { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 } }),
    compile: async (pages) => { calls.compile.push(pages); return over.compile(calls.compile.length - 1, pages); },
    publish: async (dist, pages) => { calls.publish.push(dist); calls.stored.push(pages); },
    readCredits: async () => 500,
    useCredits: async (k) => { calls.charges.push(k); return k; },
    note: (s, x) => calls.notes.push([s, x || null]),
  };
  if (over.fix) { deps.compileRepair = (req) => { calls.fix.push(req); return over.fix(req); }; deps.compileRepairModel = "grok-4.6"; }
  return { deps, calls };
}
const fails = { ok: false, stage: "build", error: VITE_ERR, typeErrors: TSC_ERR };
const okBuild = (t) => ({ ok: true, files: { "index.html": { t } }, render: { ok: true, findings: [] } });
// THE FAKE FAILS ON THE BROKEN SOURCE EVERY TIME, as the real bundler does.
// A failure citing a page is not retried (A22-3, 2026-10-23), so one compile.
const byContent = (t) => (i, pages) => (pages.find((p) => p.path === "menu.tsx").source === BROKEN ? fails : okBuild(t));
// A FIX THAT PARSES BUT THE BUNDLER REFUSES (re-anchored 2026-10-22, A03-5):
// a fix that does not parse is now refused by the tweak reader before any
// compile, so the "fix fails at the bundler" path needs one that parses.
const WORSE = FIXED.replace('className="menu"', 'className="menu worse"');
const facts = (calls) => calls.notes.flatMap(([s, x]) => talkBuildStepFacts({ s, ...(x || {}) })).map((f) => f.text || JSON.stringify(f));

test("FLAG OFF (no dep): no call, and salvage stubs the page exactly as before", async () => {
  const { deps, calls } = harness({ compile: byContent("<salvaged>") });
  const out = await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.fix.length, 0);
  assert.equal(calls.compile.length, 2, "the first compile (citing a page, so not retried) and salvage's");
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(out.compileRepair, undefined);
  // NEVER SILENT (2026-10-24): the round that did not run says why.
  assert.deepEqual(calls.notes.filter(([s]) => s.startsWith("compile-fix")).map(([s, n]) => [s, n && n.why]), [["compile-fix-skip", "off"]]);
});

test("a fixed page is recompiled once, and the fixed build and source publish — no salvage", async () => {
  const { deps, calls } = harness({ compile: byContent("<fixed>"), fix: async (req) => tweakAnswer(req, FIXED) });
  const out = await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.fix.length, 1, "one try");
  assert.equal(calls.compile.length, 2, "the first compile and the one recompile");
  assert.equal(calls.publish[0]["index.html"].t, "<fixed>");
  assert.equal(calls.stored[0].find((p) => p.path === "menu.tsx").source, FIXED, "the fixed source is stored");
  assert.equal(out.salvaged, undefined);
  assert.deepEqual(out.compileRepair.fixed, ["menu.tsx"]);
  const said = facts(calls);
  assert.ok(said.some((t) => /Fixing a page that didn't build/.test(t)), said.join(" | "));
  assert.ok(said.some((t) => /Fixed it/.test(t)), said.join(" | "));
});

test("NEVER WORSE: fixes that do not compile leave salvage to stub the ORIGINAL page, after two rounds at most, uncharged", async () => {
  const WORSE2 = WORSE.replace("menu worse", "menu worse2");
  const answers = [WORSE, WORSE2];
  const { deps, calls } = harness({
    compile: (i, pages) => {
      const m = pages.find((p) => p.path === "menu.tsx").source;
      if (m === BROKEN) return fails;
      if (m === WORSE) return { ok: false, stage: "build", error: "/app/src/routes/menu.tsx:3:1: ERROR: worse" };
      if (m === WORSE2) return { ok: false, stage: "build", error: "/app/src/routes/menu.tsx:4:1: ERROR: worse again" };
      return okBuild("<salvaged>");
    },
    fix: async (req) => tweakAnswer(req, answers.shift() || WORSE2, { input_tokens: 200000, output_tokens: 50000 }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.fix.length, 2, "two rounds, no more");
  assert.ok(calls.fix[1].messages[0].content.includes("worse"), "round two was not fed the second compile's error");
  const last = calls.compile[calls.compile.length - 1];
  assert.equal(calls.compile.filter((ps) => ps.find((p) => p.path === "menu.tsx").source === WORSE).length, 1);
  assert.equal(calls.compile.filter((ps) => ps.find((p) => p.path === "menu.tsx").source === WORSE2).length, 1);
  assert.ok(last.find((p) => p.path === "menu.tsx").source !== BROKEN && last.find((p) => p.path === "menu.tsx").source !== WORSE2, "salvage stubbed it");
  assert.equal(last.find((p) => p.path === "index.tsx").source, HOME.source, "the home page as written");
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(out.compileRepair.failedStage, "build");
  assert.equal(out.compileRepair.rounds, 2);
  assert.match(out.error, /nope/, "the FIRST failure is what is diagnosed");
  // NOT CHARGED: the bill is the same as with no repair at all.
  const plain = harness({ compile: byContent("<s>") });
  const outP = await publishPages(plain.deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(out.billed, outP.billed, "a repair that did not fix the build was charged");
  const said = facts(calls);
  assert.ok(said.some((t) => /Couldn't fix it, so it's a placeholder for now/.test(t)), said.join(" | "));
});

test("ROUND TWO: fed the second compile's error, its fix publishes, and both rounds are charged", async () => {
  const answers = [WORSE, FIXED];
  const { deps, calls } = harness({
    compile: (i, pages) => {
      const m = pages.find((p) => p.path === "menu.tsx").source;
      if (m === BROKEN) return fails;
      if (m === WORSE) return { ok: false, stage: "build", error: "/app/src/routes/menu.tsx:3:1: ERROR: worse" };
      return okBuild("<fixed2>");
    },
    fix: async (req) => tweakAnswer(req, answers.shift()),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.fix.length, 2);
  assert.ok(calls.fix[1].messages[0].content.includes(WORSE), "round two did not work on round one's page");
  assert.equal(calls.publish[0]["index.html"].t, "<fixed2>");
  assert.deepEqual(out.compileRepair.fixed, ["menu.tsx"]);
  assert.equal(out.compileRepair.rounds, 2);
  assert.equal(out.salvaged, undefined);
  const gen = { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 };
  const u = { model: "grok-4.6", in: 4000, out: 900, cacheRead: 0, cacheWrite: 0 };
  assert.equal(out.billed, pageCredits(gen, null, null, u, u), "the two rounds are on the pages charge, one rounding");
  assert.equal(calls.charges.length, 1);
});

test("THE CLOCK: no room left, no repair call, salvage as today", async () => {
  const { deps, calls } = harness({ compile: byContent("<s>"), fix: async (req) => tweakAnswer(req, FIXED) });
  deps.compileRepairRoom = () => false;
  const out = await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.fix.length, 0);
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(out.compileRepairSkipped, "time");
});

test("a refused fix (cannot) is not recompiled; salvage as today", async () => {
  const cannot = { content: [{ type: "tool_use", name: "write_tweak", input: { cannot: "needs a new component" } }], usage: { input_tokens: 10, output_tokens: 5 } };
  const { deps, calls } = harness({ compile: byContent("<salvaged>"), fix: async () => cannot });
  const out = await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.compile.length, 2, "first, then salvage's — no recompile for a refusal");
  assert.deepEqual(out.salvaged, ["menu.tsx"]);
  assert.equal(out.compileRepair.refused[0].reason, "cannot");
});

test("BILLING: the repair's tokens land on the build's one bill, priced together", async () => {
  const usage = { input_tokens: 200000, output_tokens: 50000 };
  const a = harness({ compile: byContent("<s>") });
  const outA = await publishPages(a.deps, { spec: SPEC, slug: "s", livePages: [] });
  const b = harness({ compile: byContent("<f>"), fix: async (req) => tweakAnswer(req, FIXED, usage) });
  const outB = await publishPages(b.deps, { spec: SPEC, slug: "s", livePages: [] });
  const gen = { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 };
  assert.equal(outB.billed, pageCredits(gen, null, null, { model: "grok-4.6", in: 200000, out: 50000, cacheRead: 0, cacheWrite: 0 }));
  assert.ok(outB.billed > outA.billed, `${outA.billed} -> ${outB.billed}`);
  assert.equal(b.calls.charges.length, 1, "one charge, one rounding");
});

test("a failure that is ours (unreachable service) never reaches the repair", async () => {
  const { deps, calls } = harness({ compile: () => ({ ok: false, stage: "build", error: "the build service is unreachable: x" }), fix: async (req) => tweakAnswer(req, FIXED) });
  await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(calls.fix.length, 0);
});

test("the runtime half: under the switch the render repair carries the route's browser errors and the cause", async () => {
  const sent = [];
  const report = { ok: true, findings: [{ route: "/menu", kind: "threw", detail: "Cannot read properties of undefined (reading 'EUR')" }],
    runtimeErrors: [{ route: "/menu", kind: "exception", message: "Cannot read properties of undefined (reading 'EUR')", source: "/assets/menu-1.js:3:9" }] };
  const page = { path: "menu.tsx", source: FIXED };
  await repairPages({ report, pages: [HOME, page], send: async (r) => { sent.push(r); return tweakAnswer(r, FIXED.replace("data?.length", "data?.length ?? 0")); }, runtime: true, tried: new Set() });
  const msg = sent[0].messages[0].content;
  assert.match(msg, /THE CAUSE: The page reads `\.EUR` off a value that is undefined/);
  assert.match(msg, /- exception: Cannot read .* \(at \/assets\/menu-1\.js:3:9\)/);
  // off: the instruction is byte-identical to before
  const offSent = [];
  await repairPages({ report, pages: [HOME, page], send: async (r) => { offSent.push(r); return tweakAnswer(r, FIXED); } });
  assert.ok(!offSent[0].messages[0].content.includes("THE BROWSER'S ERRORS"));
  assert.equal(runtimeLines(report, "/elsewhere"), "");
});

test("inside publishPages, the switch on: the render repair is handed the route's browser errors", async () => {
  const sent = [];
  const report = { ok: true, findings: [{ route: "/", kind: "threw", detail: "Badge is not defined" }],
    runtimeErrors: [{ route: "/", kind: "exception", message: "ReferenceError: Badge is not defined", source: "/assets/i.js:1:2" }] };
  const { deps } = harness({ compile: () => ({ ok: true, files: { "index.html": { t: "x" } }, render: report }), fix: async (req) => tweakAnswer(req, FIXED) });
  deps.repair = async (r) => { sent.push(r); return { content: [{ type: "tool_use", name: "write_tweak", input: { cannot: "no" } }] }; };
  await publishPages(deps, { spec: SPEC, slug: "s", livePages: [] });
  assert.equal(sent.length, 1);
  assert.match(sent[0].messages[0].content, /THE BROWSER'S ERRORS ON THIS PAGE:\n- exception: ReferenceError: Badge is not defined \(at \/assets\/i\.js:1:2\)/);
});

test("the switch: BUILD_REPAIR on by default (owner, 2026-10-23), off only on a negative word", () => {
  assert.equal(buildRepairOn({}), true);
  assert.equal(buildRepairOn({ BUILD_REPAIR: "0" }), false);
  assert.equal(buildRepairOn({ BUILD_REPAIR: " Off " }), false);
  assert.equal(buildRepairOn({ BUILD_REPAIR: true }), true, "a non-string is not a no");
  assert.equal(buildRepairOn({ BUILD_REPAIR: "on" }), true);
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(/compileRepair: buildRepairOn\(env\) \? (?:exploredSend\(env, slug, )?\(req\) => callBuilderModel\(env, req,[^\n]*: undefined,/.test(w), "the dep is gated on the switch");
  assert.ok(w.includes("compileRepairModel: models.pages,"), "the build's own pages model");
  assert.ok(w.includes("compileRepairRoom: () => !budget || (!budget.expired() && budget.remainingMs() >= BUILD_REPAIR_NEED_MS),"), "the build's clock");
});

test("progress facts: fixing, fixed, couldn't fix (placeholder only when stubbed)", () => {
  const t = (s, x) => talkBuildStepFacts({ s, ...x }).map((f) => f.text || JSON.stringify(f)).join(" ");
  assert.match(t("compile-fixing", { pages: 1 }), /Fixing a page that didn't build…/);
  assert.match(t("compile-fixed", { pages: 1 }), /Fixed it/);
  assert.match(t("compile-fixed", { failed: 1, stubbed: 1 }), /Couldn't fix it, so it's a placeholder for now/);
  assert.doesNotMatch(t("compile-fixed", { failed: 1 }), /placeholder/);
});
