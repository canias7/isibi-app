// THE STAND-IN ON EVERY PATH (owner, 2026-10-24: "use it everywhere … I
// don't think it should fail, but use it everywhere").
//
// An edit or an add-on whose compile still fails after compile repair is
// salvaged file by file: a file the site already had goes back to its stored
// version, a new file stands in, and the rest is published. Driven through
// the real edit and add-on routes with supplied answers and a stub compiler
// that judges what it was sent: nothing is spent, no model is called, nothing
// live is written.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { salvageRound, anythingLanded, pageStandIn } from "../builder/change-salvage.mjs";
import { salvageFact, editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";
import { salvageFacts } from "../builder/site-progress.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { tweakInput } from "./fixtures/tweak-edits.mjs";
import { addon, writtenPage, storedPage, addedTo } from "./fixtures/addon-route.mjs";

const factsOf = (fn, x) => { const out = []; fn({ add: (k, t) => out.push([k, t]) }, x); return out; };

/* ───────────────────────────── the plan, pure ───────────────────────────── */

test("ROUND: a cited file the site had goes back to its stored source; a cited new page and new part stand in; an uncited file is left", () => {
  const storedPages = [{ path: "index.tsx", source: "OLD HOME" }, { path: "about.tsx", source: "OLD ABOUT" }];
  const storedParts = [{ name: "band-a", source: "OLD BAND" }, { name: "site-header", source: "H" }, { name: "site-footer", source: "F" }];
  const pages = [{ path: "index.tsx", source: "NEW HOME" }, { path: "about.tsx", source: "NEW ABOUT" }, { path: "menu.tsx", source: "NEW MENU" }];
  const parts = [...storedParts.slice(0, 1).map((p) => ({ ...p, source: "BROKEN BAND" })), storedParts[1], storedParts[2], { name: "band-new", source: "export const Card = 1; export default function X(){}" }];
  const err = "src/routes/-parts/band-a.tsx(1,1): e\nsrc/routes/menu.tsx(2,2): e\nsrc/routes/-parts/band-new.tsx(3,3): e";
  const r = salvageRound({ error: err, pages, parts, storedPages, storedParts });
  assert.equal(r.moved, true);
  assert.deepEqual(r.kept, ["-parts/band-a.tsx"]);
  assert.deepEqual(r.standIn, ["menu.tsx", "-parts/band-new.tsx"]);
  assert.equal(r.parts[0].source, "OLD BAND");
  assert.match(r.parts[3].source, /export const Card/);
  assert.match(r.pages[2].source, /createFileRoute\("\/menu"\)/);
  assert.match(r.pages[2].source, /<SiteHeader \/>/);
  assert.match(r.pages[2].source, /<SiteFooter \/>/);
  assert.equal(r.pages[0].source, "NEW HOME", "an uncited file was touched");
  assert.equal(r.pages[1].source, "NEW ABOUT");
  assert.equal(anythingLanded({ pages: r.pages, parts: r.parts, storedPages, storedParts, kept: r.kept, standIn: r.standIn }), true);
});

test("ROUND: a cited file the change did not move, an unreadable store, and a change with nothing else left are not salvage", () => {
  const storedPages = [{ path: "index.tsx", source: "HOME" }];
  const same = salvageRound({ error: "src/routes/index.tsx(1,1): e", pages: [{ path: "index.tsx", source: "HOME" }], parts: [], storedPages, storedParts: [] });
  assert.equal(same.moved, false);
  const samePart = salvageRound({ error: "src/routes/-parts/band.tsx(1,1): e", pages: [], parts: [{ name: "band", source: "B" }], storedPages, storedParts: [{ name: "band", source: "B" }] });
  assert.equal(samePart.moved, false, "an unmoved cited part was salvaged");
  const back = salvageRound({ error: "src/routes/index.tsx(1,1): e", pages: [{ path: "index.tsx", source: "BROKE" }, { path: "new.tsx", source: "N" }], parts: [], storedPages, storedParts: [] });
  assert.equal(back.pages[0].source, "HOME", "an existing page was not put back to its stored source");
  assert.deepEqual(back.kept, ["index.tsx"]);
  const blind = salvageRound({ error: "src/routes/index.tsx(1,1): e", pages: [{ path: "index.tsx", source: "X" }], parts: [], storedPages: null, storedParts: [] });
  assert.equal(blind.moved, false);
  const only = salvageRound({ error: "src/routes/index.tsx(1,1): e", pages: [{ path: "index.tsx", source: "X" }], parts: [], storedPages, storedParts: [] });
  assert.equal(only.moved, true);
  assert.equal(anythingLanded({ pages: only.pages, parts: only.parts, storedPages, storedParts: [], kept: only.kept, standIn: only.standIn }), false);
  // A SITE WITH NO WRITTEN FRAME: an empty main, still a valid route.
  const plain = pageStandIn("blog/index.tsx", []);
  assert.match(plain, /createFileRoute\("\/blog"\)/);
  assert.doesNotMatch(plain, /SiteHeader|SiteFooter/);
});

test("FACTS: the reply and the narration name the file kept as it was and the new part standing in", () => {
  const f = factsOf(salvageFact, { kept: ["-parts/band-a.tsx"], standIn: ["gallery.tsx"] });
  assert.equal(f.length, 2);
  assert.ok(f[0][1].includes("band-a") && /kept exactly as it was/.test(f[0][1]));
  assert.ok(f[1][1].includes("gallery") && /stand-in/.test(f[1][1]));
  assert.deepEqual(factsOf(salvageFact, null), []);
  const p = salvageFacts({ kept: ["-parts/band-a.tsx"], standIn: ["gallery.tsx"] });
  assert.equal(p.length, 2);
  assert.ok(p[0].text.includes("band-a") && p[1].text.includes("gallery"));
  assert.deepEqual(salvageFacts(null), []);
});

/* ───────────────────────────── the edit route ───────────────────────────── */

const USER = { id: "u-standin-1", email: "owner@example.com" };
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const HOME = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import Band from '@/routes/-parts/band-a'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){return <main><Band /><h1>Ravenscroft</h1><section><h2>Opening hours</h2><p>Nine until five.</p></section></main>}\n";
const GOOD_BAND = "export default function Band() { return <div>band</div>; }\n";
const BROKEN_BAND = "export default function Band() { return <div data-x={brokenStandin}>band</div>; }\n";
const BAND_ERR = "src/routes/-parts/band-a.tsx(1,40): error TS2304: Cannot find name 'brokenStandin'.";
const HOME_ERR = "src/routes/index.tsx(4,20): error TS2304: Cannot find name 'brokenStandin'.";

async function driveEdit({ answerHome, answerParts, judge }) {
  const slug = "standin-" + Math.random().toString(16).slice(2, 10);
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }])],
    [PARTS_KEY(slug), JSON.stringify([{ name: "band-a", source: GOOD_BAND }])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Ravenscroft", theme: "broadsheet" }, css: "" })],
  ]);
  const b = {
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  const charges = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) { charges.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && (args.tool_choice.name || (args.tool_choice.type === "any" && args.tools && args.tools[0] && args.tools[0].name))) || "";
      let a;
      // THE REPAIR WRITER CANNOT FIX IT: every tweak answers "cannot".
      if (tool === TWEAK_TOOL.name) a = { cannot: "too large" };
      else if (tool === SITE_PAGES_TOOL.name) a = { pages: [{ path: "src/routes/index.tsx", source: answerHome }], parts: answerParts };
      if (a === undefined) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: tool === TWEAK_TOOL.name ? tweakInput(a, args) : a }], usage: { input_tokens: 1000, output_tokens: 500 } });
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
      body: JSON.stringify({ layer: "page", page: "/", remove: false, rename: "", tab: false, instruction: "make the heading bigger and the band brighter", picker: "sonnet" }),
    }), env, ctx);
    const body = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    const builds = c.calls.filter((k) => k.body && k.body.files);
    return { body, builds, charges, storedParts: JSON.parse(store.get(PARTS_KEY(slug)) || "[]"), storedPages: JSON.parse(store.get(SRC_KEY(slug)) || "[]") };
  } finally { c.uninstall(); globalThis.fetch = real; }
}
const bandSent = (k) => ((k.body.parts || []).find((p) => p.name === "band-a") || {}).source || "";
const homeSent = (k) => { const f = k.body.files || {}; const key = Object.keys(f).find((x) => /(^|\/)index\.tsx$/.test(x)); return key ? f[key] : ""; };

test("EDIT: a change that breaks an existing band keeps the band as it was and publishes the rest; the reply says so; the failed repair is not charged", async () => {
  const BIG = HOME.replace("<h1>", '<h1 className="text-6xl">');
  const r = await driveEdit({ answerHome: BIG, answerParts: [{ name: "band-a", source: BROKEN_BAND }],
    judge: (body) => ((body.parts || []).some((p) => String(p.source).includes("brokenStandin")) ? BAND_ERR : null) });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const last = r.builds[r.builds.length - 1];
  assert.equal(bandSent(last), GOOD_BAND, "the band was not put back before the last compile");
  assert.ok(homeSent(last).includes("text-6xl"), "the rest of the change was not published");
  assert.equal(r.storedParts.find((p) => p.name === "band-a").source, GOOD_BAND, "the stored band moved");
  assert.ok(r.storedPages.find((p) => p.path === "index.tsx").source.includes("text-6xl"), "the home change was not stored");
  assert.deepEqual(r.body.salvaged, { kept: ["-parts/band-a.tsx"], standIn: [] });
  assert.ok(!r.body.compileRepaired, "a repair that did not fix is not reported as fixed");
  // THE REPLY WRITER IS TOLD (facts, not our sentence).
  assert.ok(JSON.stringify(editReplyFacts(r.body).facts).includes("kept exactly as it was"), "the reply facts do not name the band kept as it was");
  // CHARGED AS THE SAME CHANGE THAT COMPILED CLEAN: the repair that did not fix and the salvage cost nothing more.
  const clean = await driveEdit({ answerHome: BIG, answerParts: [{ name: "band-a", source: GOOD_BAND }], judge: () => null });
  assert.equal(clean.body && clean.body.ok, true);
  assert.deepEqual(r.charges, clean.charges);
});

test("EDIT: still broken after salvage is refused as before, and so is a change with nothing left that landed", async () => {
  // THE BAND PUT BACK, AND THE HOME PAGE STILL CITED: nothing is published.
  const BIG = HOME.replace("<h1>", '<h1 className="text-6xl">');
  const still = await driveEdit({ answerHome: BIG, answerParts: [{ name: "band-a", source: BROKEN_BAND }],
    judge: (body) => ((body.parts || []).some((p) => String(p.source).includes("brokenStandin")) ? BAND_ERR : "src/components/ui/button.tsx(1,1): error kit") });
  assert.equal(still.body && still.body.ok, false, JSON.stringify(still.body).slice(0, 400));
  assert.equal(still.storedParts.find((p) => p.name === "band-a").source, GOOD_BAND);
  assert.ok(!still.storedPages[0].source.includes("text-6xl"), "a broken change was stored");
  // ONLY THE HOME PAGE CHANGED AND IT BROKE: putting it back leaves nothing, refused.
  const BROKEN_HOME = HOME.replace("<h1>", "<h1 data-x={brokenStandin}>");
  const none = await driveEdit({ answerHome: BROKEN_HOME, answerParts: [],
    judge: (body) => (homeSent({ body }).includes("brokenStandin") ? HOME_ERR : null) });
  assert.equal(none.body && none.body.ok, false, JSON.stringify(none.body).slice(0, 400));
  assert.ok(!none.storedPages[0].source.includes("brokenStandin"));
});

/* ───────────────────────────── the add-on route ─────────────────────────── */

const FRAME = [
  { name: "site-header", source: "export default function SiteHeader(){ return <header>h</header>; }\n" },
  { name: "site-footer", source: "export default function SiteFooter(){ return <footer>f</footer>; }\n" },
];
const BROKEN_GALLERY = (() => { const w = writtenPage("/gallery"); return { ...w, source: 'import { Thing } from "@/components/ui/no-such-module-zz";\n' + w.source }; })();
const GALLERY_ERR = "Could not resolve \"@/components/ui/no-such-module-zz\" from \"src/routes/gallery.tsx\"";
const fileOf = (body, re) => { const f = (body && body.files) || {}; const k = Object.keys(f).find((x) => re.test(x)); return k ? f[k] : null; };

const runAddon = (slug, judge) => addon(slug, "add a gallery page and a contact page", {
  kinds: ["page"], publishes: true, credits: 400,
  storedPages: [storedPage("/")], parts: FRAME,
  written: [BROKEN_GALLERY, writtenPage("/contact"), addedTo("/", '<p>See the <a href="/gallery">gallery</a> and <a href="/contact">contact</a>.</p>')],
  answers: { page: { page: [
    { path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a grid of photographs"], components: ["card"] },
    { path: "/contact", name: "Contact", purpose: "reach us", sections: ["a form"], components: ["card"] }] },
  // THE REPAIR ANSWERS THE SAME BROKEN PAGE: refused as no change.
  source: { source: BROKEN_GALLERY.source } },
  compileJudge: judge,
});

test("ADD-ON: a new page that will not compile stands in with the site's header and footer; the other new page and the link publish; the reply says so; the failed repair is not charged", async () => {
  const r = await runAddon("fw-standin-ok", (body) => (String(fileOf(body, /gallery\.tsx$/) || "").includes("no-such-module-zz") ? GALLERY_ERR : null));
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  const last = r.compiles.filter((k) => k.body && k.body.files).pop();
  const gallery = fileOf(last.body, /gallery\.tsx$/);
  assert.ok(gallery && !gallery.includes("no-such-module-zz"), "the broken page was published");
  assert.match(gallery, /createFileRoute\("\/gallery"\)/);
  assert.match(gallery, /<SiteHeader \/>[\s\S]*<main[\s\S]*<SiteFooter \/>/);
  assert.ok(String(fileOf(last.body, /contact\.tsx$/) || "").includes("Words for contact"), "the other new page was not published");
  assert.ok(String(fileOf(last.body, /(^|\/)index\.tsx$/) || "").includes('href="/contact"'), "the link on home was not published");
  assert.deepEqual(r.body.salvaged, { kept: [], standIn: ["gallery.tsx"] });
  assert.ok(!r.body.compileRepaired);
  // NO CHARGE FOR THE REPAIR THAT DID NOT FIX (reserve #6), and the salvage itself calls no model.
  assert.ok(JSON.stringify(addonReplyFacts(r.body).facts).includes("an empty stand-in holds"), "the reply facts do not name the stand-in");
  // CHARGED AS THE SAME ADDITION THAT COMPILED CLEAN: no repair charge (#6), nothing for the salvage.
  const clean = await runAddon("fw-standin-clean", () => null);
  assert.equal(clean.body && clean.body.ok, true);
  assert.deepEqual(r.charges, clean.charges);
});

test("ADD-ON: still broken after the stand-in is refused as before, nothing published", async () => {
  const r = await runAddon("fw-standin-fail", () => GALLERY_ERR.replace("gallery", "index"));
  assert.equal(r.body && r.body.ok, false, JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.error, "compile");
});

test("GUARD: the seam salvages after the repair hook and before the refusal, reads the stored source, and the routes carry `salvaged`", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const hook = src.indexOf('tm("compile-repair", "fail");');
  const salv = src.indexOf("salvageRound({", hook);
  const refuse = src.indexOf('ok: false, error: "compile", ours:', hook);
  assert.ok(hook > 0 && salv > hook && refuse > salv, "salvage is not between the repair and the refusal");
  assert.ok(src.slice(hook, salv).includes("readSiteSource(env, slug)") && src.slice(hook, salv).includes("readSiteParts(env, slug)"));
  assert.ok(src.includes("salvaged: finalPub && finalPub.salvaged ? finalPub.salvaged : undefined,"));
  assert.ok(src.includes("salvaged: aPub.salvaged || undefined,"));
});
