// PARKED (2026-11-03, park-old-way): the old-way half of test/written-frame-edit.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { NAV_TOOL } from "../../../builder/site-nav.mjs";
import {
  writtenFrame, ownPartsSite, frameFileProblems, readFrameEdit, runFrameEdit, frameEditRequest, FRAME_EDIT_TOOL, internalLinks,
} from "../../../builder/site-frame.mjs";
import { pageRulesFor, ownPartsRules, pagesRequest, generateSitePages, PAGE_RULES, FRONTEND_PAGE_RULES, OWN_PARTS_NOTE } from "../../../builder/page-gen.mjs";
import { bandRequest, frameRequest, ownFallbackDirective } from "../../../builder/page-bands.mjs";

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

const answer = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: FRAME_EDIT_TOOL.name, input }], usage: { input_tokens: 1500, output_tokens: 600 } });

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
  const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-10-24 (combine-d): beside the file picker's `only` on the page rung.
  assert.ok(/\{ ownParts: ownPartsSite\(eSrc, pStoredParts\)(?:, only: [^}]+)? \}\);/.test(W), "the page rung does not hand the own-parts fact over");
  assert.ok(/\{ ownParts: ownPartsSite\(aSrc, aStoredParts\)(?:, only: [^}]+)? \}\);/.test(W), "the addition's writer does not hand the own-parts fact over");
});
