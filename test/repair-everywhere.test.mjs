// COMPILE REPAIR EVERYWHERE (2026-10-24, owner: "the repair has to be
// everywhere … like literally everywhere").
//
// Live on `driftwood-and-daughters-2` (2026-10-24 03:19, site_builds error):
// `vite build` refused `src/routes/-parts/band-1-bleed.tsx (2:7): "default" is
// not exported by "src/components/ui/safe-image.tsx"`. The compile repair never
// ran (it searched the PAGES only; the band is a part), salvage refused (the
// home page imports the part), and the build fell to the placeholder.
//
// Driven with supplied answers only: every model call is a stub, the compiler
// is a stub, nothing is spent and nothing live is written.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tweakInput } from "./fixtures/tweak-edits.mjs";
import { publishPages, salvagePlan, partStandIn } from "../builder/publish-pages.mjs";
import { repairImports, exportsOfSource } from "../builder/page-gen.mjs";
import { compileRepairRounds, pagesForError, partFiles, withParts, splitParts, isKitFile } from "../builder/compile-repair.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { FRAME_PARTS } from "../builder/site-frame.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

// THE EXACT STORED ERROR, as `site_builds.error` holds it.
const LIVE_ERR = 'src/routes/-parts/band-1-bleed.tsx (2:7): "default" is not exported by "src/components/ui/safe-image.tsx"';

const HOME = {
  path: "src/routes/index.tsx",
  source: 'import { createFileRoute } from "@tanstack/react-router";\n' +
    'import Band1Bleed from "@/routes/-parts/band-1-bleed";\n' +
    'export const Route = createFileRoute("/")({ component: Page });\n' +
    "function Page() { return <main><Band1Bleed /></main>; }\n",
};
// A BAND THE COMPILER REFUSES. The binding style is already right (so the
// pre-fix leaves it), and the stub compiler answers the live error for it.
const BAD_BAND = 'import { SafeImage } from "@/components/ui/safe-image";\n' +
  "export default function Band1Bleed() { return <section><SafeImage src={brokenBandSrc} alt=\"the shore\" /><h2>Driftwood</h2></section>; }\n";
const GOOD_BAND = 'import { SafeImage } from "@/components/ui/safe-image";\n' +
  "export default function Band1Bleed() { return <section><SafeImage src=\"\" alt=\"the shore\" /><h2>Driftwood</h2></section>; }\n";
const USAGE = { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 };
const tweakAnswer = (req, source) => ({ content: [{ type: "tool_use", name: "write_tweak", input: tweakInput({ source }, req) }], usage: { input_tokens: 3000, output_tokens: 600 } });
const okBuild = { ok: true, files: { "index.html": { t: "<built>" } }, render: { ok: true, findings: [] } };
const bandOf = (parts) => (parts || []).find((p) => p.name === "band-1-bleed");

function harness({ band = BAD_BAND, fix = null, err = LIVE_ERR } = {}) {
  const calls = { compiledPages: [], compiledParts: [], stored: [], fix: [], notes: [] };
  const deps = {
    generate: async () => ({ input: { pages: [HOME], parts: [{ name: "band-1-bleed", source: band }], notes: "" }, usage: { ...USAGE } }),
    compile: async (pages, parts) => {
      calls.compiledPages.push(pages); calls.compiledParts.push(parts);
      const b = bandOf(parts);
      return b && b.source.includes("brokenBandSrc") ? { ok: false, stage: "build", error: err } : okBuild;
    },
    publish: async (dist, src) => { calls.stored.push(src); },
    readCredits: async () => 500,
    useCredits: async (n) => n,
    note: (s, x) => calls.notes.push([s, x || null]),
  };
  if (fix) { deps.compileRepair = (req) => { calls.fix.push(req); return fix(req); }; deps.compileRepairModel = "grok-4.6"; }
  return { deps, calls };
}
const steps = (calls) => calls.notes.filter(([s]) => s.startsWith("compile-fix")).map(([s, n]) => s + ":" + ((n && (n.why || n.pages || n.failed)) ?? ""));

/* ───────────────────────────── the build path (publishPages) ───────────── */

test("LIVE REPLAY: the stored band error reaches the repair through the real publishPages, and the fixed band compiles and is kept", async () => {
  const { deps, calls } = harness({ fix: async (req) => tweakAnswer(req, GOOD_BAND) });
  const out = await publishPages(deps, { spec: { tables: [] }, slug: "driftwood-and-daughters-2", livePages: [] });
  assert.equal(calls.fix.length, 1, "the repair never ran on the band the error cites");
  const msg = JSON.stringify(calls.fix[0].messages);
  assert.ok(msg.includes("band-1-bleed") && msg.includes("brokenBandSrc"), "the band's own source was not sent");
  assert.ok(msg.includes('\\"default\\" is not exported by'), "the compiler's words did not reach the writer");
  assert.equal(calls.compiledParts.length, 2, "the failing compile and the repaired one");
  assert.equal(bandOf(calls.compiledParts[1]).source, GOOD_BAND, "the second compile did not carry the repaired band");
  assert.deepEqual(out.compileRepair.fixed, ["-parts/band-1-bleed.tsx"]);
  assert.deepEqual(out.compileRepair.parts, ["band-1-bleed"], "the repaired part is not written back where parts live");
  assert.equal(out.salvaged, undefined);
  assert.equal(out.salvagedParts, undefined, "a repaired band must not also be a stand-in");
  assert.deepEqual(steps(calls), ["compile-fixing:1", "compile-fixed:1"]);
  // The pages stored are pages only: no part file leaks into them.
  assert.ok(calls.stored[0].every((p) => !String(p.path).includes("-parts/")), JSON.stringify(calls.stored[0].map((p) => p.path)));
});

test("SALVAGE: a band still failing after repair is a stand-in even though home imports it — never the placeholder — and the reply says which section", async () => {
  const { deps, calls } = harness({ fix: async (req) => tweakAnswer(req, BAD_BAND.replace("Driftwood", "Driftwood!")) });
  // The tweak reader refuses a wording change; either way the band still fails.
  const out = await publishPages(deps, { spec: { tables: [] }, slug: "driftwood-and-daughters-2", livePages: [] });
  assert.deepEqual(out.salvagedParts, ["band-1-bleed"], JSON.stringify(out.salvage));
  assert.equal(out.salvage.reason, "");
  const last = bandOf(calls.compiledParts.at(-1));
  assert.equal(last.stub, true);
  assert.match(last.source, /export default function Part/);
  assert.equal(calls.stored.length, 1, "the build did not publish");
  // Home is untouched: it still imports the band, now a stand-in.
  assert.equal(calls.stored[0].find((p) => /index\.tsx$/.test(p.path)).source, HOME.source);
  const bf = buildFacts({ salvagedParts: out.salvagedParts });
  assert.deepEqual(bf.standIn, ["band-1-bleed"]);
  const said = buildReplyFacts(bf).facts.map((f) => f.text || f).join(" | ");
  assert.match(said, /One section of the page \(.band-1-bleed.\) did not compile/, said);
});

test("SALVAGE PLAN: a part home imports is stubbed (homeParts), a broken home page itself still refuses, a published user still keeps the site", () => {
  const parts = [{ name: "band-1-bleed", source: BAD_BAND }];
  const pages = [{ path: "index.tsx", source: HOME.source }];
  const p = salvagePlan(LIVE_ERR, pages, [], parts);
  assert.deepEqual(p.parts, ["band-1-bleed"]);
  assert.equal(p.homeParts, true);
  assert.equal(p.reason, "");
  assert.match(salvagePlan("src/routes/index.tsx(3,1): error TS1: x", pages, [], parts).reason, /home page/);
  assert.deepEqual(salvagePlan(LIVE_ERR, pages, ["index.tsx"], parts).kept, ["index.tsx"], "a published user must keep the site as it is");
});

test("STAND-IN: keeps every name the part exported, so a named import of it still compiles", () => {
  const s = partStandIn("export function Hero(){}\nexport const tagline = 1;\nexport { a as Banner, type T };\nexport default Hero;");
  assert.match(s, /export default function Part/);
  for (const n of ["Hero", "tagline", "Banner", "T"]) assert.match(s, new RegExp("export const " + n + ": any"), n);
  assert.ok(!/export const default/.test(s));
});

test("NEVER SILENT: the repair off, a kit-only error and a refused round each record compile-fix-skip / compile-fix-failed with why", async () => {
  const off = harness();
  await publishPages(off.deps, { spec: { tables: [] }, slug: "s", livePages: [] });
  assert.deepEqual(steps(off.calls)[0], "compile-fix-skip:off");

  const kitErr = 'src/components/ui/safe-image.tsx (2:7): ERROR: oops';
  const kit = harness({ err: kitErr, fix: async () => { throw new Error("must not be called"); } });
  const out = await publishPages(kit.deps, { spec: { tables: [] }, slug: "s", livePages: [] });
  assert.equal(kit.calls.fix.length, 0, "a kit file is never handed to the writer");
  assert.deepEqual(steps(kit.calls), ["compile-fix-skip:kit-only"]);
  assert.equal(out.compileRepairSkipped, "kit-only");

  const refused = harness({ fix: async () => ({ content: [{ type: "tool_use", name: "write_tweak", input: { cannot: "no" } }], usage: { input_tokens: 10, output_tokens: 1 } }) });
  await publishPages(refused.deps, { spec: { tables: [] }, slug: "s", livePages: [] });
  assert.deepEqual(steps(refused.calls).slice(0, 2), ["compile-fixing:1", "compile-fix-failed:refused"]);
});

/* ───────────────────────────── the deterministic pre-fix ──────────────── */

test("PRE-FIX: a default import of a kit module becomes the named import its export list says, before any compile", async () => {
  const band = 'import SafeImage from "@/components/ui/safe-image";\nexport default function Band1Bleed() { return <SafeImage src="" alt="x" />; }\n';
  const { deps, calls } = harness({ band });
  const out = await publishPages(deps, { spec: { tables: [] }, slug: "s", livePages: [] });
  assert.equal(calls.compiledParts.length, 1, "it compiled first time");
  assert.match(bandOf(calls.compiledParts[0]).source, /^import \{ SafeImage \} from "@\/components\/ui\/safe-image";/);
  assert.equal(out.salvagedParts, undefined);
});

test("PRE-FIX: by the module's real exports — kit aliasing, part default/named both ways, nothing guessed, and it settles", () => {
  const parts = [
    { name: "hero", source: "export default function Hero(){ return null }" },
    { name: "band", source: "export function Band(){ return null }" },
    { name: "both", source: "export function A(){}\nexport function B(){}" },
  ];
  const src = [
    'import Pic from "@/components/ui/safe-image";',
    'import { Hero } from "@/routes/-parts/hero";',
    "import Band from './-parts/band';",
    'import Both from "@/routes/-parts/both";',
    'import Mystery from "@/components/ui/no-such-module-zz";',
    'import type { ImageFocus } from "@/components/ui/safe-image";',
  ].join("\n");
  const r = repairImports([{ path: "index.tsx", source: src }], { parts });
  const out = r.pages[0].source;
  assert.match(out, /import \{ SafeImage as Pic \} from "@\/components\/ui\/safe-image";/);
  assert.match(out, /import Hero from "@\/routes\/-parts\/hero";/);
  assert.match(out, /import \{ Band \} from "\.\/-parts\/band";/);
  assert.match(out, /import Both from "@\/routes\/-parts\/both";/, "two named exports: no guess");
  assert.match(out, /import Mystery from "@\/components\/ui\/no-such-module-zz";/, "unknown module: left for the compiler");
  assert.match(out, /import type \{ ImageFocus \}/);
  assert.equal(r.fixed.filter((f) => f.binding).length, 3);
  assert.equal(repairImports(r.pages, { parts }).fixed.length, 0, "the pre-fix does not settle");
  assert.deepEqual([...exportsOfSource("export default X; export { y as Z }").names], ["Z"]);
});

test("GUARD: the kit exports by name only, which is what the kit half of the pre-fix relies on", () => {
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
  assert.ok(files.length > 1000, "the kit was not read: " + files.length);
  const withDefault = files.filter((f) => /\bexport\s+default\b/.test(fs.readFileSync(new URL(f, dir), "utf8")));
  assert.deepEqual(withDefault, []);
});

/* ───────────────────────── the shared module (every seam) ─────────────── */

test("THE ROUND: a cited part is repaired even when the change did not write it (the add-on's own hook and the seam's both use this)", async () => {
  const pages = withParts([{ path: "gallery.tsx", source: "page" }], [{ name: "band-1-bleed", source: BAD_BAND }]);
  assert.deepEqual(pages.map((p) => p.path), ["gallery.tsx", "-parts/band-1-bleed.tsx"]);
  assert.deepEqual(pagesForError(LIVE_ERR, pages, ["gallery.tsx"]).map((p) => p.path), ["-parts/band-1-bleed.tsx"]);
  let compiled = null;
  const sent = [];
  const r = await compileRepairRounds({
    error: LIVE_ERR, pages, touched: ["gallery.tsx"],
    send: async (req) => { sent.push(req); return tweakAnswer(req, GOOD_BAND); },
    compile: async (list) => { compiled = list; return { ok: true, files: { x: 1 } }; },
  });
  assert.ok(r.built, JSON.stringify(r.refused));
  assert.deepEqual(r.repaired, ["-parts/band-1-bleed.tsx"]);
  assert.ok(JSON.stringify(sent[0].messages).includes("This component did not compile"));
  const back = splitParts(compiled, [{ name: "band-1-bleed", source: BAD_BAND }]);
  assert.deepEqual(back.pages.map((p) => p.path), ["gallery.tsx"]);
  assert.equal(back.parts[0].source, GOOD_BAND);
  assert.equal(isKitFile("src/components/ui/safe-image.tsx"), true);
  assert.equal(isKitFile("src/routes/-parts/x.tsx"), false);
  assert.deepEqual(partFiles([{ name: "" }, null]), []);
});

/* ─────────────────── the shared publish seam, through the real Worker ───── */

const USER = { id: "u-everywhere-1", email: "owner@example.com" };
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const SEAM_HOME = (part, Name) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import " + Name + " from '@/routes/-parts/" + part + "'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><" + Name + " /><h1>Ravenscroft</h1><section><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

async function driveSeam({ part, Name, badPart, goodPart, err }) {
  const slug = "everywhere-" + Math.random().toString(16).slice(2, 10);
  const home = SEAM_HOME(part, Name);
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "index.tsx", source: home }])],
    [PARTS_KEY(slug), JSON.stringify([{ name: part, source: badPart }])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]);
  const b = {
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  const prompts = [];
  // The page rung's own answer, then the repair's answer for the PART.
  const tweaks = [{ cannot: "too large" }, { source: goodPart }];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) return json(Number(args.cost) || 0);
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && (args.tool_choice.name || (args.tool_choice.type === "any" && args.tools && args.tools[0] && args.tools[0].name))) || "";
      prompts.push(JSON.stringify(args.messages || ""));
      let a;
      if (tool === TWEAK_TOOL.name) a = tweaks.length > 1 ? tweaks.shift() : tweaks[0];
      else if (tool === SITE_PAGES_TOOL.name) a = { pages: [{ path: "src/routes/index.tsx", source: home.replace("<h1>", '<h1 className="text-6xl">') }], parts: [] };
      if (a === undefined) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: tool === TWEAK_TOOL.name ? tweakInput(a, args) : a }], usage: { input_tokens: 1000, output_tokens: 500 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({ failFirst: 1, error: err });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: "make the heading bigger", picker: "sonnet" }),
    }), env, ctx);
    const body = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    const sentParts = c.calls.filter((k) => k.body && k.body.files).map((k) => ((k.body.parts || []).find((p) => p.name === part) || {}).source);
    const storedParts = JSON.parse(store.get(PARTS_KEY(slug)) || "[]");
    const storedPages = JSON.parse(store.get(SRC_KEY(slug)) || "[]");
    return { body, prompts, sentParts, storedParts, storedPages };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const seamBad = (Name) => "export default function " + Name + "() { return <div data-x={brokenSeamName}>band</div>; }\n";
const seamGood = (Name) => "export default function " + Name + "() { return <div>band</div>; }\n";

test("EDIT SEAM: a stored band the error cites is repaired at the shared publish seam, recompiled, and stored where parts live", async () => {
  const r = await driveSeam({ part: "band-1-bleed", Name: "Band1Bleed", badPart: seamBad("Band1Bleed"), goodPart: seamGood("Band1Bleed"), err: LIVE_ERR });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.sentParts.length, 2, "the failing compile and the repaired one");
  assert.equal(r.sentParts[0], seamBad("Band1Bleed"));
  assert.equal(r.sentParts[1], seamGood("Band1Bleed"), "the second compile did not carry the repaired band");
  assert.ok(r.prompts.some((p) => p.includes("This component did not compile") && p.includes("brokenSeamName")), "the band was not sent to the writer");
  assert.equal(r.storedParts.find((p) => p.name === "band-1-bleed").source, seamGood("Band1Bleed"), "the repaired band was not stored");
  assert.ok(r.storedPages.every((p) => !String(p.path).includes("-parts/")), "a part file leaked into the pages");
  assert.deepEqual(r.body.compileRepaired.pages, ["-parts/band-1-bleed.tsx"]);
});

test("FRAME: an error in the written frame (a frame part) is repaired at the same seam", async () => {
  const f = FRAME_PARTS[0];
  const err = "src/routes/-parts/" + f.file + ".tsx(1,40): error: brokenSeamName is not defined";
  const r = await driveSeam({ part: f.file, Name: f.name, badPart: seamBad(f.name), goodPart: seamGood(f.name), err });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.sentParts[1], seamGood(f.name));
  assert.equal(r.storedParts.find((p) => p.name === f.file).source, seamGood(f.name));
});

test("GUARD: the seam pre-fixes imports on every publish and offers every part to whichever hook runs (the add-on's included)", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("async function recompileAndPublish(env, {");
  const end = w.indexOf("\nasync function ", at + 10);
  assert.ok(at > 0 && end > at, "landmarks");
  const seam = w.slice(at, end);
  assert.match(seam, /const prePages = repairImports\(pages, \{ parts: preParts \}\);/);
  assert.match(seam, /fix = await compileHook\(\{[\s\S]{0,200}pages: hasParts \? withParts\(pages, siteParts\) : pages/);
  assert.match(seam, /const partsToSave = partsRepaired && Array\.isArray\(siteParts\) \? siteParts : parts;/);
  assert.match(w, /onCompileFail: aOnCompileFail,/);
});
