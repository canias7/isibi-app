// ── A SITE WHOSE HEADER AND FOOTER THE MODEL WROTE (2026-10-23) ─────────────
//
// `build-ai-writes-all`: a first build has no `SiteChrome`; its header and
// footer are its own files, `-parts/site-header.tsx` and
// `-parts/site-footer.tsx`. Three things had to follow before it could ship:
//
//   1. the menu, header button, footer contact/social and logo edits, which
//      read `SiteChrome`'s props, edit those two files instead
//      (`site-frame.mjs`), through the real edit route, compiled by the
//      publish; a `SiteChrome` site runs exactly as before;
//   2. such a site's writers read an own-parts rules block (`pageRulesFor`
//      with `ownParts`), never "THE KIT FOR EVERY CONTROL"; a kit site's block
//      is byte-identical; edits of such a site are told the same;
//   3. the single-call fallback of a first build writes the frame itself
//      (`ownFallbackDirective`, the own-parts block), never the kit's
//      `SiteChrome`.
//
// Nothing here reads the customer's words: the frame editor's answers are
// supplied, the shape its tool asks for, and the route is judged by what it
// stored, compiled, charged and said.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { NAV_TOOL } from "../builder/site-nav.mjs";
import {
  writtenFrame, ownPartsSite, frameFileProblems, readFrameEdit, runFrameEdit, frameEditRequest, FRAME_EDIT_TOOL, internalLinks,
} from "../builder/site-frame.mjs";
import { pageRulesFor, ownPartsRules, pagesRequest, generateSitePages, PAGE_RULES, FRONTEND_PAGE_RULES, OWN_PARTS_NOTE } from "../builder/page-gen.mjs";
import { bandRequest, frameRequest, ownFallbackDirective } from "../builder/page-bands.mjs";

const SLUG = "tidewater-rowing";
const USER = { id: "u-frame-1", email: "owner@example.com" };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const SHELL = `import { createFileRoute } from "@tanstack/react-router";
import Band1Hero from "@/routes/-parts/band-1-hero";
import SiteHeader from "@/routes/-parts/site-header";
import SiteFooter from "@/routes/-parts/site-footer";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Band1Hero />
      </main>
      <SiteFooter />
    </div>
  );
}
`;
const GALLERY = `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/gallery")({ component: G });
function G() { return <main><h1>Gallery</h1></main>; }
`;
const HEADER = `import { Link } from "@tanstack/react-router";
import { SITE_LOGO } from "@/site-brand";

function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-semibold">Tidewater Rowing</Link>
        <nav className="flex gap-4">
          <Link to="/">Home</Link>
          <Link to="/gallery">Gallery</Link>
        </nav>
        <a href="#join" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Join the club</a>
      </div>
    </header>
  );
}

export default SiteHeader;
`;
const FOOTER = `function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted text-muted-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">Tidewater Rowing · Boathouse Lane</div>
    </footer>
  );
}

export default SiteFooter;
`;
const BAND = `function Band1Hero() { return <section className="py-16"><h1>Row with us</h1></section>; }

export default Band1Hero;
`;
const PAGES = [{ path: "index.tsx", source: SHELL }, { path: "gallery.tsx", source: GALLERY }];
const PARTS = [{ name: "band-1-hero", source: BAND }, { name: "site-header", source: HEADER }, { name: "site-footer", source: FOOTER }];
const ROUTES = ["/", "/gallery"];

const KIT_PAGE = `import { SiteChrome } from "@/components/ui/site-chrome";
export default function Home() {
  return <SiteChrome name="Tidewater Rowing" links={[{ label: "Home", href: "/" }, { label: "Gallery", href: "/gallery" }]}><p>Row.</p></SiteChrome>;
}
`;

const NO_GALLERY = HEADER.replace('          <Link to="/gallery">Gallery</Link>\n', "");
const NEW_BUTTON = HEADER.replace("Join the club", "Book a taster session");
const WITH_INSTAGRAM = FOOTER.replace("Tidewater Rowing · Boathouse Lane", 'Tidewater Rowing · Boathouse Lane · <a href="https://instagram.com/tidewaterrowing">Instagram</a>');
const LOGO_BESIDE = HEADER.replace('<Link to="/" className="font-semibold">Tidewater Rowing</Link>',
  '<Link to="/" className="flex items-center gap-2 font-semibold">{SITE_LOGO ? <img src={SITE_LOGO} alt="Tidewater Rowing" className="h-7 w-auto" /> : null}Tidewater Rowing</Link>');

// ── THE MODULE ────────────────────────────────────────────────────────────────

test("writtenFrame: the two frame parts and no SiteChrome is a written frame; SiteChrome anywhere is a kit site", () => {
  const f = writtenFrame(PAGES, PARTS);
  assert.ok(f && f.header && f.footer, "the frame was not found");
  assert.equal(f.header.source, HEADER);
  assert.equal(ownPartsSite(PAGES, PARTS), true);
  assert.equal(writtenFrame([{ path: "index.tsx", source: KIT_PAGE }], PARTS), null, "a page with SiteChrome is a kit site");
  assert.equal(writtenFrame([{ path: "index.tsx", source: KIT_PAGE }], []), null);
  assert.equal(writtenFrame(PAGES, [{ name: "band-1-hero", source: BAND }]), null, "no frame parts is no frame");
  assert.equal(ownPartsSite(PAGES, null), false);
});

test("frameFileProblems: routes, kit, SiteChrome and the default export are checked; a clean file passes", () => {
  assert.deepEqual(frameFileProblems(HEADER, ROUTES), []);
  assert.deepEqual(frameFileProblems(WITH_INSTAGRAM, ROUTES), [], "an outside link is not a route");
  assert.deepEqual(internalLinks(HEADER), ["/", "/", "/gallery"]);
  assert.ok(frameFileProblems(HEADER.replace("/gallery", "/shop"), ROUTES).includes("route:/shop"));
  assert.ok(frameFileProblems('import { Button } from "@/components/ui/button";\n' + HEADER, ROUTES).includes("kit:@/components/ui/button"));
  assert.deepEqual(frameFileProblems('import { LangSwitch } from "@/components/ui/lang-switch";\n' + HEADER, ROUTES), [], "plumbing stays importable");
  assert.ok(frameFileProblems(HEADER.replace("export default SiteHeader;", ""), ROUTES).includes("no-default-export"));
  assert.ok(frameFileProblems(HEADER + "\n// <SiteChrome />", ROUTES).includes("site-chrome"));
  assert.deepEqual(frameFileProblems("", ROUTES), ["empty"]);
});

const answer = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: FRAME_EDIT_TOOL.name, input }], usage: { input_tokens: 1500, output_tokens: 600 } });

test("readFrameEdit: a changed file replaces its part; an unchanged one is no change; a bad one refuses all", () => {
  const f = writtenFrame(PAGES, PARTS);
  const ok = readFrameEdit(answer({ header: NO_GALLERY }), f, ROUTES);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.changed, ["header"]);
  assert.equal(ok.frame.footer.source, FOOTER, "the footer was not kept");
  assert.deepEqual(readFrameEdit(answer({ header: HEADER }), f, ROUTES), { ok: false, reason: "unchanged", cannot: "" });
  assert.equal(readFrameEdit(answer({ cannot: "That is a page change." }), f, ROUTES).reason, "cannot");
  const bad = readFrameEdit(answer({ header: NO_GALLERY, footer: FOOTER.replace("Boathouse Lane", '<a href="/contact">Contact</a>') }), f, ROUTES);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.problems, ["footer:route:/contact"]);
});

test("frameEditRequest: shown the change, the routes and both files whole, with the own-parts rule", () => {
  const req = frameEditRequest({ instruction: "Take Gallery out of the menu.", frame: writtenFrame(PAGES, PARTS), routes: ROUTES });
  const text = req.messages[0].content;
  assert.ok(text.includes("Take Gallery out of the menu."));
  assert.ok(text.includes("/, /gallery"));
  assert.ok(text.includes(HEADER) && text.includes(FOOTER));
  assert.equal(req.tool_choice.name, "edit_frame");
  assert.match(req.system, /WRITE EVERY PART YOURSELF/);
  assert.doesNotMatch(req.system, /THE KIT FOR EVERY CONTROL/);
});

test("runFrameEdit never throws: a provider failure is `send`, a question is `ask`", async () => {
  const boom = await runFrameEdit({ send: async () => { throw new Error("down"); } }, { instruction: "x", pages: PAGES, parts: PARTS, routes: ROUTES });
  assert.equal(boom.reason, "send");
  const kit = await runFrameEdit({ send: async () => answer({ header: NO_GALLERY }) }, { instruction: "x", pages: [{ path: "index.tsx", source: KIT_PAGE }], parts: PARTS, routes: ROUTES });
  assert.equal(kit.reason, "no-frame");
  const done = await runFrameEdit({ send: async () => answer({ header: NO_GALLERY }) }, { instruction: "x", pages: PAGES, parts: PARTS, routes: ROUTES });
  assert.equal(done.ok, true);
  assert.equal(done.parts.find((p) => p.name === "site-header").source, NO_GALLERY);
  assert.equal(done.parts.find((p) => p.name === "band-1-hero").source, BAND);
});

// ── THROUGH THE REAL EDIT ROUTE ───────────────────────────────────────────────

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function bucket(pages, parts) {
  const store = new Map([
    ["source/" + SLUG + "/pages.json", JSON.stringify(pages)],
    ["source/" + SLUG + "/parts.json", JSON.stringify(parts)],
    [CONFIG_KEY(SLUG), JSON.stringify({ look: { brand: "Tidewater Rowing", theme: "broadsheet" }, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, typeof v === "string" ? v : v); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

async function drive({ layer = "nav", frameAnswer = null, navAnswer = null, ask, pages = PAGES, parts = PARTS, images }) {
  const b = bucket(pages, parts);
  const url = "https://gofarther.dev/api/site/" + SLUG + "/edit";
  const body = JSON.stringify({ layer, page: "", remove: false, rename: "", tab: false, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20), ...(images ? { images } : {}) });
  const seen = { models: [], debits: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/rpc/use_credits")) { const n = Number(args.cost) || 0; seen.debits.push(n); return json(n > 0 ? n : -1); }
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/edit_traces")) return new Response(null, { status: 201 });
    if (u.includes("/rest/v1/site_backends")) return json(u.includes("slug=eq." + SLUG) ? [{ uid: USER.id, brief: "", neon_db: "" }] : []);
    if (u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push({ tool, args });
      if (tool === FRAME_EDIT_TOOL.name && frameAnswer) return json(answer(frameAnswer));
      if (tool === NAV_TOOL.name && navAnswer) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: navAnswer }], usage: { input_tokens: 2000, output_tokens: 400 } });
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({});
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
    const reply = await res.json().catch(() => null);
    await Promise.allSettled(ctx.pending);
    return {
      status: res.status, reply,
      pages: JSON.parse(b.store.get("source/" + SLUG + "/pages.json") || "[]"),
      parts: JSON.parse(b.store.get("source/" + SLUG + "/parts.json") || "[]"),
      builds: c.calls.map((k) => k.body), models: seen.models, debits: seen.debits,
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

const partOf = (r, n) => (r.parts.find((p) => p.name === n) || {}).source;
const compiled = (r, n) => {
  const parts = (r.builds[0] && r.builds[0].parts) || [];
  const p = (Array.isArray(parts) ? parts : []).find((x) => x && x.name === n);
  return p ? p.source : undefined;
};

function assertFrameShipped(r, want, label) {
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.equal(r.reply.ok, true, label);
  assert.equal(r.reply.frame, true, label + ": not the written frame's edit");
  assert.deepEqual(r.models.map((m) => m.tool), [FRAME_EDIT_TOOL.name], label + ": the models called");
  assert.equal(r.builds.length, 1, label + ": one compile");
  for (const [n, src] of Object.entries(want)) {
    assert.equal(partOf(r, n), src, label + ": " + n + " stored");
    assert.equal(compiled(r, n), src, label + ": " + n + " compiled");
  }
  assert.equal(partOf(r, "band-1-hero"), BAND, label + ": the band moved");
  assert.deepEqual(r.pages, PAGES, label + ": a page moved");
  assert.ok(r.reply.cost > 0, label + ": not charged");
  assert.deepEqual(r.debits, [r.reply.cost], label + ": the debit is not the reply's cost");
}

test("take Gallery out of the menu, on a written frame: the header file loses the link, compiled and stored", async () => {
  const r = await drive({ ask: "Take Gallery out of the menu.", frameAnswer: { header: NO_GALLERY } });
  assertFrameShipped(r, { "site-header": NO_GALLERY, "site-footer": FOOTER }, "menu");
  assert.deepEqual(r.reply.changed, ["header"]);
});

test("add Instagram to the footer, on a written frame: the footer file gains the outside link", async () => {
  const r = await drive({ ask: "Add our Instagram to the footer: instagram.com/tidewaterrowing", frameAnswer: { footer: WITH_INSTAGRAM } });
  assertFrameShipped(r, { "site-header": HEADER, "site-footer": WITH_INSTAGRAM }, "footer");
});

test("change the header button, on a written frame", async () => {
  const r = await drive({ ask: "Change the header button to Book a taster session.", frameAnswer: { header: NEW_BUTTON } });
  assertFrameShipped(r, { "site-header": NEW_BUTTON }, "button");
});

test("a frame answer linking to a page the site does not have is refused: nothing stored, nothing compiled", async () => {
  const r = await drive({ ask: "Add a Shop link to the menu.", frameAnswer: { header: HEADER.replace("/gallery", "/shop") } });
  assert.equal(r.status, 422);
  assert.equal(r.reply.ok, false);
  assert.deepEqual(r.reply.problems, ["header:route:/shop"]);
  assert.equal(r.builds.length, 0);
  assert.deepEqual(r.parts, PARTS);
  // ONE RETRY WITH THE REASON, THEN NOT CHARGED (owner, 2026-10-25).
  assert.deepEqual(r.models.map((m) => m.tool), [FRAME_EDIT_TOOL.name, FRAME_EDIT_TOOL.name]);
  assert.equal(r.reply.retried, true);
  assert.equal(r.reply.cost, 0);
});

test("runFrameEdit: a refused answer is sent back once with the check's reason, same model; a fixed second answer lands; cannot/unchanged are never retried", async () => {
  const KIT_FOOTER = 'import { Figure } from "@/components/ui/figure";\n' + FOOTER;
  const sent = [];
  const twice = await runFrameEdit({ send: async (req) => { sent.push(req); return answer(sent.length === 1 ? { footer: KIT_FOOTER } : { header: NO_GALLERY }); } }, { instruction: "x", pages: PAGES, parts: PARTS, routes: ROUTES });
  assert.equal(twice.ok, true, JSON.stringify(twice));
  assert.equal(twice.retried, true);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].model, sent[0].model);
  assert.equal(sent[1].system, sent[0].system);
  const last = JSON.stringify(sent[1].messages.at(-1));
  assert.match(last, /imports @\/components\/ui\/figure, which is not allowed/);
  assert.equal(twice.usage.in, 3000);
  // STILL REFUSED: one retry, never a loop.
  let n = 0;
  const still = await runFrameEdit({ send: async () => { n++; return answer({ footer: KIT_FOOTER }); } }, { instruction: "x", pages: PAGES, parts: PARTS, routes: ROUTES });
  assert.equal(still.reason, "refused");
  assert.equal(n, 2);
  // AN ANSWER, NOT A FAILURE: never retried.
  for (const input of [{ cannot: "Not the frame." }, { header: HEADER }]) {
    let k = 0;
    const r = await runFrameEdit({ send: async () => { k++; return answer(input); } }, { instruction: "x", pages: PAGES, parts: PARTS, routes: ROUTES });
    assert.ok(["cannot", "unchanged"].includes(r.reason));
    assert.equal(k, 1);
    assert.equal(r.retried, false);
  }
});

test("the frame rules name the only kit modules the check allows", () => {
  const req = frameEditRequest({ instruction: "x", frame: writtenFrame(PAGES, PARTS), routes: ROUTES });
  assert.match(req.system, /may import ONLY "@\/components\/ui\/safe-image" and "@\/components\/ui\/lang-switch"/);
});

test("a SiteChrome site still runs the menu editor, never the frame editor", async () => {
  const r = await drive({
    ask: "Take Gallery out of the menu.",
    pages: [{ path: "index.tsx", source: KIT_PAGE }, { path: "gallery.tsx", source: GALLERY }], parts: PARTS,
    navAnswer: { links: [{ label: "Home", href: "/" }] }, frameAnswer: { header: NO_GALLERY },
  });
  assert.ok(r.models.length >= 1, "no model was called");
  assert.ok(r.models.every((m) => m.tool === NAV_TOOL.name), "the frame editor ran on a kit site: " + r.models.map((m) => m.tool));
  assert.notEqual(r.reply && r.reply.frame, true);
  assert.equal(partOf(r, "site-header"), HEADER, "a kit site's parts were edited");
});

test("put a logo next to the name, on a written frame: the logo is stored and the header places it, one publish", async () => {
  const r = await drive({ layer: "logo", ask: "Put this logo next to the name.", images: [{ name: "logo.png", data: PNG }], frameAnswer: { header: LOGO_BESIDE } });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.equal(r.reply.layer, "logo");
  assert.deepEqual(r.reply.frame, ["header"]);
  assert.deepEqual(r.models.map((m) => m.tool), [FRAME_EDIT_TOOL.name]);
  assert.match(r.models[0].args.messages[0].content, /THE LOGO IS NOW SET/);
  assert.equal(r.builds.length, 1);
  assert.equal(partOf(r, "site-header"), LOGO_BESIDE);
  assert.equal(compiled(r, "site-header"), LOGO_BESIDE);
  assert.ok(r.reply.cost > 0);
});

// ── 2. THE RULES ──────────────────────────────────────────────────────────────

test("pageRulesFor: a kit site's block is byte-identical; an own-parts site's names no kit rule and no chart catalogue", () => {
  const db = { tables: [{ name: "t", columns: [] }] };
  for (const [spec, base] of [[{ tables: [] }, FRONTEND_PAGE_RULES], [db, null]]) {
    assert.equal(pageRulesFor(spec, ""), pageRulesFor(spec, "", { ownParts: false }));
    if (base) assert.equal(pageRulesFor(spec, ""), base, "the kit block moved");
    const own = pageRulesFor(spec, "", { ownParts: true });
    assert.doesNotMatch(own, /THE KIT FOR EVERY CONTROL/);
    assert.doesNotMatch(own, /\n## Charts/);
    assert.doesNotMatch(own, /A CHART COMES FROM/);
    assert.match(own, /THIS SITE WRITES ITS OWN PARTS — THESE RULES WIN/);
    assert.match(own, /3\. NO KIT: WRITE EVERY CONTROL YOURSELF/);
  }
  assert.doesNotMatch(ownPartsRules(PAGE_RULES), /through shadcn's `Form`/);
  assert.equal(pageRulesFor({ tables: [], surface: "app" }, "", { ownParts: true }), pageRulesFor({ tables: [], surface: "app" }, ""), "a phone app keeps its block");
});

test("the first build's band and frame writers read the own-parts block", () => {
  const spec = { tables: [] };
  const band = bandRequest({ brief: "b", spec, brand: "X", lines: ["Hero: a"], index: 0, name: "Band1Hero" });
  const frame = frameRequest({ brief: "b", spec, brand: "X", lines: ["Hero: a"], chrome: { name: "X" }, role: "header" });
  for (const r of [band, frame]) {
    assert.doesNotMatch(r.system[0].text, /THE KIT FOR EVERY CONTROL/);
    assert.match(r.system[0].text, /THIS SITE WRITES ITS OWN PARTS/);
  }
});

test("an edit of an own-parts site writes its own parts: the request carries the own-parts block and note", async () => {
  const kit = pagesRequest({ brief: "b", spec: { tables: [] }, brand: "X", mode: "page", target: "index.tsx", priorPages: PAGES });
  assert.match(kit.system[0].text, /THE KIT FOR EVERY CONTROL/, "a kit site's edit changed");
  assert.ok(!String(kit.messages[0].content).includes(OWN_PARTS_NOTE));
  let sent = null;
  await generateSitePages({}, "b", { tables: [] }, "X", [], "m", PAGES, "page", "index.tsx", null,
    async (_k, req) => { sent = req; throw new Error("stop"); }, "", [], { ownParts: true }).catch(() => {});
  assert.ok(sent, "the request was not sent");
  assert.doesNotMatch(sent.system[0].text, /THE KIT FOR EVERY CONTROL/);
  assert.ok(String(sent.messages[0].content).includes(OWN_PARTS_NOTE));
  // AND THE ROUTE HANDS IT OVER, on the page rung and the addition's writer.
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-10-24 (combine-d): beside the file picker's `only` on the page rung.
  assert.ok(/\{ ownParts: ownPartsSite\(eSrc, pStoredParts\)(?:, only: [^}]+)? \}\);/.test(W), "the page rung does not hand the own-parts fact over");
  assert.ok(/\{ ownParts: ownPartsSite\(aSrc, aStoredParts\)(?:, only: [^}]+)? \}\);/.test(W), "the addition's writer does not hand the own-parts fact over");
});

// ── 3. THE SINGLE-CALL FALLBACK ───────────────────────────────────────────────

test("the fallback directive asks for the frame as the two parts, composed with no SiteChrome and no kit", () => {
  const d = ownFallbackDirective({ spec: { tables: [] }, brand: "X", lines: ["Hero: a"], chrome: { name: "X", links: [{ label: "Home", href: "/" }] }, actions: ["Join"] });
  assert.match(d, /\*\*site-header\*\*/);
  assert.match(d, /\*\*site-footer\*\*/);
  assert.match(d, /@\/routes\/-parts\/site-header/);
  assert.match(d, /no SiteChrome/);
  assert.match(d, /WRITE EVERY PART YOURSELF/);
  assert.match(d, /Home → \//, "the frame's facts were not carried");
  assert.match(d, /"Join"/);
});

test("a first build's one call is the own-parts call with the frame directive; a revise is unchanged", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = W.indexOf("const ownFirst = !revise && !priorPages");
  assert.ok(at > 0, "the first-build landmark is gone");
  const end = W.indexOf("} catch (e) {", at);
  assert.ok(end > at);
  const win = W.slice(at, end);
  assert.ok(win.includes("ownFallbackDirective({"), "the frame directive is not composed");
  assert.ok(win.includes("media, devices: deviceWishes }) + ownTail, spec,"), "the directive does not reach the one call's brief");
  // RE-ANCHORED 2026-10-24 (combine-d): the rewrite's file pick and question (rebuild-scope) and a first build's (`pageAsk`, build-questions) ride the same options.
  assert.ok(win.includes("plan && plan.kind, [], { ownParts: ownFirst, only: reviseOnly, ...((revise || priorPages) ? { ask: canAskPages } : pageAsk) });"), "the one call is not told own parts on a first build");
  assert.ok(win.includes('ownFirst ? "\\n\\n" + ownFallbackDirective'), "a revise would get the directive");
});
