// PAY ONLY FOR WHAT LANDED (owner, 2026-10-24: "if 20 things are asked and 1
// ends up a stand-in or kept as it was, charge only for what worked").
//
// A file a writer produced that salvage kept as it was or stood in is not
// charged its share of that writer's spend: by its own usage when known (a
// band writer), otherwise by count of the files the writer produced. Driven
// through the real edit and add-on routes and the build's own billing seam
// (`publishPages`) with supplied answers and a stub compiler: nothing is spent,
// no model is called, nothing live is written.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { landedBill, scaleUsage, salvageKey } from "../builder/change-salvage.mjs";
import { pageCredits } from "../builder/publish-pages.mjs";
import { publishPages } from "../builder/publish-pages.mjs";
import { editReplyFacts, addonReplyFacts, buildReplyFacts, salvageRefundFact } from "../builder/site-reply.mjs";
import { buildFacts } from "../builder/build-answer.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { tweakInput } from "./fixtures/tweak-edits.mjs";
import { addon, writtenPage, storedPage } from "./fixtures/addon-route.mjs";

const said = (facts) => JSON.stringify(facts);
const BIG = { in: 20000, out: 300000, cacheRead: 0, cacheWrite: 0, model: "grok-4.6" };

/* ───────────────────────────── the arithmetic, pure ───────────────────────── */

test("BILL: by count, by each file's own usage, nothing salvaged, everything salvaged, and only the writer's share moves", () => {
  const written = ["src/routes/index.tsx", "-parts/a.tsx", "-parts/b.tsx", "-parts/c.tsx"];
  const one = landedBill({ writer: [BIG], written, salvaged: { kept: ["-parts/a.tsx"], standIn: [] } });
  assert.deepEqual(one.hit, ["-parts/a.tsx"]);
  assert.equal(one.of, 4);
  assert.equal(one.full, pageCredits(BIG));
  assert.equal(one.landed, pageCredits(scaleUsage(BIG, 0.75)));
  assert.equal(one.refund, one.full - one.landed);
  assert.ok(one.refund > 0 && Math.abs(one.refund - one.full / 4) <= 1, JSON.stringify(one));
  // NOTHING SALVAGED: unchanged.
  const none = landedBill({ writer: [BIG], written, salvaged: { kept: [], standIn: [] } });
  assert.equal(none.refund, 0);
  assert.equal(none.landed, none.full);
  // A SALVAGED FILE THE WRITER DID NOT WRITE is not its share.
  assert.equal(landedBill({ writer: [BIG], written, salvaged: { kept: ["about.tsx"], standIn: [] } }).refund, 0);
  // OTHERS ON THE BILL STAY: a routing call is never given back.
  const pick = { in: 50000, out: 50000, model: "grok-4.6" };
  const withPick = landedBill({ writer: [BIG], others: [pick], written, salvaged: { kept: [], standIn: ["-parts/a.tsx"] } });
  assert.equal(withPick.landed, pageCredits(pick, scaleUsage(BIG, 0.75)));
  // BY THE FILE'S OWN USAGE when known: a band that cost a tenth gives back a tenth.
  const perFile = { "-parts/a.tsx": scaleUsage(BIG, 0.1) };
  const own = landedBill({ writer: [BIG], written, salvaged: { kept: [], standIn: ["-parts/a.tsx"] }, perFile });
  assert.equal(own.landed, pageCredits(scaleUsage(BIG, 0.9)));
  // EVERYTHING SALVAGED: the bill is the floor of one credit, never negative.
  const all = landedBill({ writer: [BIG], written, salvaged: { kept: written, standIn: [] } });
  assert.equal(all.landed, 1);
  assert.ok(all.refund <= all.full && all.refund >= 0);
  assert.equal(salvageKey("src/routes/menu.tsx"), "menu.tsx");
  // THE FACT: stated only when something was given back.
  const F = []; salvageRefundFact({ add: (k, t) => F.push([k, t]) }, { credits: 3 });
  assert.equal(F.length, 1); assert.match(F[0][1], /3 credits/);
  const G = []; salvageRefundFact({ add: (k, t) => G.push([k, t]) }, { credits: 0 });
  assert.equal(G.length, 0);
});

/* ───────────────────────────── the edit route ───────────────────────────── */

const USER = { id: "u-standin-refund", email: "owner@example.com" };
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const HOME = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import BandA from '@/routes/-parts/band-a'\nimport BandB from '@/routes/-parts/band-b'\nimport BandC from '@/routes/-parts/band-c'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><BandA /><BandB /><BandC /><h1>Ravenscroft</h1><section><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
const band = (n, extra = "") => "export default function Band() { return <div" + extra + ">band " + n + "</div>; }\n";
const BAND_ERR = "src/routes/-parts/band-a.tsx(1,40): error TS2304: Cannot find name 'brokenStandin'.";

async function driveEdit({ answerHome, answerParts, judge }) {
  const slug = "refund-" + Math.random().toString(16).slice(2, 10);
  const stored = ["a", "b", "c"].map((n) => ({ name: "band-" + n, source: band(n) }));
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    [PARTS_KEY(slug), JSON.stringify(stored)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]);
  const b = {
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  const charges = [], backs = [], reversals = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) { charges.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100000);
    if (u.includes("/rpc/credit_back")) { backs.push(Number(args.amount) || 0); return new Response(null, { status: 204 }); }
    if (u.includes("/rpc/credit_reverse")) { reversals.push(args); return json({ ok: true, refunded: 0 }); }
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      let a;
      let usage = { input_tokens: 1000, output_tokens: 500 };
      if (tool === TWEAK_TOOL.name) a = { cannot: "too large" };
      else if (tool === SITE_PAGES_TOOL.name) { a = { pages: [{ path: "src/routes/index.tsx", source: answerHome }], parts: answerParts }; usage = { input_tokens: 20000, output_tokens: 300000 }; }
      if (a === undefined) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: tool === TWEAK_TOOL.name ? tweakInput(a, args) : a }], usage });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({ judge });
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: "make the heading bigger and brighten all three bands", picker: "sonnet" }),
    }), env, ctx);
    const body = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    return { body, charges, backs, reversals };
  } finally { c.uninstall(); globalThis.fetch = real; }
}
const BIGHOME = HOME.replace("<h1>", '<h1 className="text-6xl">');
const brighter = (n, broken) => ({ name: "band-" + n, source: band(n, broken ? " data-x={brokenStandin}" : ' className="bright"') });

test("EDIT: 1 of the 4 files the page writer produced is kept as it was, so a quarter of its charge is given back; the stated cost and the reply say the real charge", async () => {
  const judge = (body) => ((body.parts || []).some((p) => String(p.source).includes("brokenStandin")) ? BAND_ERR : null);
  const r = await driveEdit({ answerHome: BIGHOME, answerParts: [brighter("a", true), brighter("b"), brighter("c")], judge });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.deepEqual(r.body.salvaged, { kept: ["-parts/band-a.tsx"], standIn: [] });
  const clean = await driveEdit({ answerHome: BIGHOME, answerParts: [brighter("a"), brighter("b"), brighter("c")], judge: () => null });
  assert.equal(clean.body && clean.body.ok, true);
  // THE SAME RESERVE FIRST (the writer ran in full), THEN ITS SHARE BACK.
  assert.deepEqual(r.charges, clean.charges);
  const full = clean.charges.reduce((s, n) => s + n, 0);
  assert.ok(full >= 20, "the writer's charge is too small to show a share: " + full);
  const back = r.backs.reduce((s, n) => s + n, 0);
  assert.ok(back > 0, "nothing was given back");
  assert.ok(Math.abs(back - full / 4) <= 1, "not a quarter of the writer's charge: " + back + " of " + full);
  assert.deepEqual(r.body.salvageRefund, { credits: back, files: ["-parts/band-a.tsx"] });
  assert.equal(r.body.cost, clean.body.cost - back, "the stated cost is not the real charge");
  assert.equal(r.reversals.length, 0, "a synchronous edit has no reserve ref to reverse");
  assert.ok(said(editReplyFacts(r.body).facts).includes(back + " credits of the writing"), said(editReplyFacts(r.body).facts));
  // NO SALVAGE: nothing given back, the cost unchanged.
  assert.equal(clean.backs.length, 0);
  assert.equal(clean.body.salvageRefund, undefined);
  assert.equal(clean.body.cost, full);
});

/* ───────────────────────────── the add-on route ─────────────────────────── */

const FRAME = [
  { name: "site-header", source: "export default function SiteHeader(){ return <header>h</header>; }\n" },
  { name: "site-footer", source: "export default function SiteFooter(){ return <footer>f</footer>; }\n" },
];
const BROKEN_GALLERY = (() => { const w = writtenPage("/gallery"); return { ...w, source: 'import { Thing } from "@/components/ui/no-such-module-zz";\n' + w.source }; })();
const GALLERY_ERR = "Could not resolve \"@/components/ui/no-such-module-zz\" from \"src/routes/gallery.tsx\"";
const fileOf = (body, re) => { const f = (body && body.files) || {}; const k = Object.keys(f).find((x) => re.test(x)); return k ? f[k] : null; };
const sumOf = (xs) => xs.reduce((s, n) => s + n, 0);
const runAddon = (slug, gallery, judge) => addon(slug, "add a gallery page, a contact page and an about page", {
  kinds: ["page"], publishes: true, credits: 100000,
  storedPages: [storedPage("/")], parts: FRAME,
  written: [gallery, writtenPage("/contact"), writtenPage("/about")],
  writeUsage: { input_tokens: 20000, output_tokens: 300000 },
  answers: { page: { page: [
    { path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a grid of photographs"], components: ["card"] },
    { path: "/contact", name: "Contact", purpose: "reach us", sections: ["a form"], components: ["card"] },
    { path: "/about", name: "About", purpose: "who we are", sections: ["our story"], components: ["card"] }] },
  source: { source: BROKEN_GALLERY.source } },
  compileJudge: judge,
});

test("ADD-ON: 1 of the 3 new pages stands in, so a third of the writer's share is given back; the stated cost and the reply say the real charge", async () => {
  const r = await runAddon("fw-refund-ok", BROKEN_GALLERY, (body) => (String(fileOf(body, /gallery\.tsx$/) || "").includes("no-such-module-zz") ? GALLERY_ERR : null));
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.deepEqual(r.body.salvaged, { kept: [], standIn: ["gallery.tsx"] });
  const clean = await runAddon("fw-refund-clean", writtenPage("/gallery"), () => null);
  assert.equal(clean.body && clean.body.ok, true);
  const full = sumOf(clean.charges);
  assert.deepEqual(r.charges, clean.charges, "the collect itself moved");
  const back = sumOf(r.backs);
  assert.ok(full >= 20, "the writer's charge is too small to show a share: " + full);
  assert.ok(back > 0, "the stand-in was charged in full");
  assert.ok(Math.abs(back - full / 3) <= 2, "not a third of the writer's share: " + back + " of " + full);
  assert.deepEqual(r.body.salvageRefund, { credits: back, files: ["gallery.tsx"] });
  assert.equal(r.body.cost, full - back, "the stated cost is not the real charge");
  assert.ok(said(addonReplyFacts(r.body).facts).includes(back + " credits of the writing"), said(addonReplyFacts(r.body).facts));
  // NO SALVAGE: unchanged, nothing given back.
  assert.equal(clean.backs.length, 0);
  assert.equal(clean.body.salvageRefund, undefined);
  assert.equal(clean.body.cost, full);
});

/* ───────────────────────────── the build (publishPages) ─────────────────── */

const BHOME = {
  path: "src/routes/index.tsx",
  source: 'import { createFileRoute } from "@tanstack/react-router";\n' +
    'import Band1 from "@/routes/-parts/band-1";\nimport Band2 from "@/routes/-parts/band-2";\nimport Band3 from "@/routes/-parts/band-3";\n' +
    'export const Route = createFileRoute("/")({ component: Page });\n' +
    "function Page() { return <main><Band1 /><Band2 /><Band3 /></main>; }\n",
};
const BBAND = (n, bad) => "export default function Band" + n + "() { return <section>" + (bad ? "{brokenBandSrc}" : "") + "<h2>Band " + n + "</h2></section>; }\n";
const B_ERR = 'src/routes/-parts/band-1.tsx(1,40): error TS2304: Cannot find name \'brokenBandSrc\'.';
const okBuild = { ok: true, files: { "index.html": { t: "<built>" } }, render: { ok: true, findings: [] } };
const BAND_USE = (f) => scaleUsage({ in: 10000, out: 100000, cacheRead: 0, cacheWrite: 0, model: "grok-4.6" }, f);

function buildDeps({ bad = true, perFile = true, exempt = false } = {}) {
  const debits = [];
  const usage = BAND_USE(1);
  const deps = {
    generate: async () => ({
      input: { pages: [BHOME], parts: [1, 2, 3].map((n) => ({ name: "band-" + n, source: BBAND(n, bad && n === 1) })), notes: "" },
      usage: { ...usage },
      // BAND 1 COST A FIFTH OF THE WRITING, BANDS 2 AND 3 THE REST.
      ...(perFile ? { fileUsage: { "-parts/band-1.tsx": BAND_USE(0.2), "-parts/band-2.tsx": BAND_USE(0.4), "-parts/band-3.tsx": BAND_USE(0.4) } } : {}),
    }),
    compile: async (pages, parts) => ((parts || []).some((p) => String(p.source).includes("brokenBandSrc")) ? { ok: false, stage: "build", error: B_ERR } : okBuild),
    publish: async () => {},
    readCredits: async () => 100000,
    useCredits: async (n) => { debits.push(n); return exempt ? { ok: true, exempt: true, taken: 0 } : { ok: true, taken: n }; },
    note: () => {},
  };
  return { deps, debits };
}

test("BUILD: a band that publishes as a stand-in is not charged its own writer's share (by its own usage), the cost and the reply say so; no salvage is unchanged", async () => {
  const clean = buildDeps({ bad: false });
  const c = await publishPages(clean.deps, { spec: { tables: [] }, slug: "refund-build-clean", livePages: [] });
  assert.equal(c.salvagedParts, undefined);
  assert.equal(c.salvageRefund, undefined);
  const full = clean.debits[0];
  assert.equal(full, pageCredits(BAND_USE(1)));
  const s = buildDeps({ bad: true });
  const out = await publishPages(s.deps, { spec: { tables: [] }, slug: "refund-build-band", livePages: [] });
  assert.deepEqual(out.salvagedParts, ["band-1"], JSON.stringify(out.salvage));
  assert.equal(s.debits.length, 1, "one debit, already reduced");
  assert.equal(s.debits[0], pageCredits(BAND_USE(0.8)), "the stand-in's own fifth was charged");
  assert.deepEqual(out.salvageRefund, { credits: full - s.debits[0], files: ["-parts/band-1.tsx"] });
  assert.equal(out.cost, s.debits[0]);
  const bf = buildFacts({ salvagedParts: out.salvagedParts, salvageRefund: out.salvageRefund });
  assert.ok(said(buildReplyFacts(bf).facts).includes((full - s.debits[0]) + " credits of the writing"), said(buildReplyFacts(bf).facts));
  // WITHOUT EACH FILE'S USAGE, BY COUNT: a quarter (home and three bands written).
  const p = buildDeps({ bad: true, perFile: false });
  await publishPages(p.deps, { spec: { tables: [] }, slug: "refund-build-count", livePages: [] });
  assert.equal(p.debits[0], pageCredits(BAND_USE(0.75)));
});

test("FOUNDER: an exempt account is never credited back — the build takes nothing and gives nothing; the job paths give back only what the writer's own reserve took", async () => {
  const f = buildDeps({ bad: true, exempt: true });
  const out = await publishPages(f.deps, { spec: { tables: [] }, slug: "refund-build-founder", livePages: [] });
  assert.equal(out.cost, 0);
  assert.equal(out.exempt, true);
  assert.equal(out.charged, false);
  // NOTHING ON THE BUILD PATH CREDITS AN ACCOUNT: the reduction is off the one debit.
  const src = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const at = src.indexOf("PAY ONLY FOR WHAT LANDED");
  const debit = src.indexOf("await deps.useCredits(owed)", at);
  assert.ok(at > 0 && debit > at, "the reduction is not ahead of the one debit");
  assert.ok(!/creditBack|credit_back|reverseCredits/.test(src.slice(at, debit)));
  // THE JOB PATHS: bounded by the reserve's own take (a founder's reserve answers 0), by its own ref.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const e = w.indexOf("let eSalvageRefund = null;");
  const eEnd = w.indexOf("const merged = {", e);
  assert.ok(e > 0 && eEnd > e);
  const eBlock = w.slice(e, eEnd);
  assert.ok(eBlock.includes("Math.min(bill.refund, wb.took)") && eBlock.includes('reverseCredits(env, ou.id, wb.ref, "salvage", give)') && eBlock.includes("creditBack(env, ou.id, ch)"));
  assert.ok(eBlock.indexOf("finalPub && finalPub.ok && finalPub.salvaged") >= 0, "the refund is not after the publish");
  assert.ok(w.includes("if (eSalvageRefund) merged.cost = Math.max(0, merged.cost - eSalvageRefund.credits);"), "the stated cost does not carry the refund");
  assert.ok(w.includes("if (eLast && took > 0) eWriterBills.push("), "a writer bill is recorded when nothing was taken");
  const a = w.indexOf("const aSalvageBill = ");
  const aBlock = w.slice(a, w.indexOf("const aMenuParse", a));
  assert.ok(aBlock.includes("Math.min(aSalvageBill.refund, aJob ? aWriterTook : aCost)") && aBlock.includes('reverseCredits(env, ou.id, aJob.id + "#" + (aFirstPlaced ? 4 : 1), "salvage", aGive)'));
  assert.ok(w.includes("const aWriterTook = aJob ? (aFirstPlaced ? aCost - aFirst : aCost) : 0;"), "the writer's reserve is not what the job's own charge took");
});

test("BANDS: the fan-out hands each file its own writer's usage, under the key salvage names it by, so a stand-in band gives back its own share", async () => {
  const { generateSiteBands } = await import("../builder/page-bands.mjs");
  const ans = (source, out) => ({ content: [{ type: "tool_use", input: { source } }], usage: { input_tokens: 100, output_tokens: out } });
  const out = await generateSiteBands({ brief: "b", spec: {}, brand: "B", model: "grok-4.6", route: "/", lines: ["hero", "prices"], chrome: { name: "B" } },
    null, async () => [
      { i: 0, state: "done", answer: ans("function Band1Hero() { return <section/>; }", 1000) },
      { i: 1, state: "done", answer: ans("function Band2Prices() { return <section/>; }", 2000) },
      { i: 2, state: "done", answer: ans("function SiteHeader() { return <header/>; }", 3000) },
      { i: 3, state: "done", answer: ans("function SiteFooter() { return <footer/>; }", 4000) },
    ]);
  const names = out.input.parts.map((p) => "-parts/" + p.name + ".tsx");
  assert.deepEqual(Object.keys(out.fileUsage).sort(), names.slice().sort());
  assert.deepEqual(names.map((k) => out.fileUsage[k].out), [1000, 2000, 3000, 4000]);
  assert.ok(names.every((k) => out.fileUsage[k].model === "grok-4.6"));
});
