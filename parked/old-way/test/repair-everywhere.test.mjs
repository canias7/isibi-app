// PARKED (2026-11-03, park-old-way): the old-way half of test/repair-everywhere.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { tweakInput } from "../../../test/fixtures/tweak-edits.mjs";
import { publishPages, salvagePlan, partStandIn } from "../../../builder/publish-pages.mjs";
import { repairImports, exportsOfSource } from "../../../builder/page-gen.mjs";
import { compileRepairRounds, pagesForError, partFiles, withParts, splitParts, isKitFile } from "../../../builder/compile-repair.mjs";
import { buildFacts } from "../../../builder/build-answer.mjs";
import { buildReplyFacts } from "../../../builder/site-reply.mjs";
import { FRAME_PARTS } from "../../../builder/site-frame.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { TWEAK_TOOL } from "../../../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../../../builder/page-gen.mjs";

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
      const tool = (args.tool_choice && args.tool_choice.name) || "";
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
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("async function recompileAndPublish(env, {");
  const end = w.indexOf("\nasync function ", at + 10);
  assert.ok(at > 0 && end > at, "landmarks");
  const seam = w.slice(at, end);
  assert.match(seam, /const prePages = repairImports\(pages, \{ parts: preParts \}\);/);
  assert.match(seam, /fix = await compileHook\(\{[\s\S]{0,200}pages: hasParts \? withParts\(pages, siteParts\) : pages/);
  assert.match(seam, /const partsToSave = partsRepaired && Array\.isArray\(siteParts\) \? siteParts : parts;/);
  assert.match(w, /onCompileFail: aOnCompileFail,/);
});
