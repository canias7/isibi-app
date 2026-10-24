// A03-6 (audit 2026-10-17, fixed 2026-10-22): RENAMING THE BUSINESS through the
// look `brand` lane rewrote the old name in the page files only. On a site
// split into bands the visible copy lives in its components (`-parts/`), so
// the hero, about and footer kept the old name while the reply said renamed.
// Driven through the real edit route, sync and queued, with supplied answers.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool } from "../builder/site-lanes.mjs";

const PICK = pickTool().name;
const USER = { id: "u-rename-1", email: "owner@example.com" };

const route = (path, imports, body) => "import { createFileRoute } from '@tanstack/react-router'\n" + imports
  + "export const Route = createFileRoute('" + path + "')({ component: Page })\n"
  + "function Page() {\n  return (\n    <main>\n" + body + "    </main>\n  );\n}\n";
const QR_IMPORTS = "import { Figure } from '@/components/ui/figure'\nimport { SITE_QRS } from '@/site-brand'\n";
const PRICES_FIG = "      <Figure caption={SITE_QRS.prices.label}><img src={SITE_QRS.prices.src} alt={SITE_QRS.prices.label} /></Figure>\n";
const RING_FIG = "      <div className=\"mx-auto max-w-6xl px-6 py-8\">\n        <Figure caption={SITE_QRS.ring.label}><img src={SITE_QRS.ring.src} alt={SITE_QRS.ring.label} /></Figure>\n      </div>\n";
const HOME_TOP = "      <h1>Crookes Guitar School</h1>\n      <p>Lessons for every age, in Welsh, French and Spanish.</p>\n";
const HOME = route("/", QR_IMPORTS, HOME_TOP + PRICES_FIG + RING_FIG);
const PRICES = route("/prices", "", "      <h1>Prices</h1>\n      <p>An hour is forty pounds.</p>\n");
const PART = { name: "visit-band", source: "export function VisitBand() {\n  return <section><h2>Visit</h2><p>Crookes, Sheffield.</p></section>;\n}\n" };
const PRICES_CODE = { name: "prices", points: "https://crookes.gofarther.app/prices", label: "Scan for prices" };
const RING_CODE = { name: "ring", points: "tel:+441140000000", label: "Scan to ring and book" };
const LOOK = { brand: "Crookes Guitar School", theme: "broadsheet", lang: "cy", langs: ["fr", "es"], qr: [PRICES_CODE, RING_CODE] };

function bucket(slug, { look = LOOK, pages, parts = [PART] } = {}) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(pages || [{ path: "index.tsx", source: HOME }, { path: "prices.tsx", source: PRICES }])],
    // A STRING IS STORED AS IT IS — an unreadable store, for the case that needs one.
    ["source/" + slug + "/parts.json", typeof parts === "string" ? parts : JSON.stringify(parts)],
    [CONFIG_KEY(slug), JSON.stringify({ look })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

const hex = (n) => randomBytes(n).toString("hex");
const OFF_USAGE = { input_tokens: 777, output_tokens: 33 };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/**
 * One message through the real route. `pick` is the picker's answer, `lane` an
 * edit lane's, `off` the removal's: a list of names (`{ targets }`), any other
 * value the tool's raw input, a function of the request answering either, or
 * null — no answer, so the call fails.
 */
async function drive({ mode = "sync", ask, pick, lane = null, off = null, setup = {} }) {
  const slug = "rename-" + mode + "-" + hex(4);
  const b = bucket(slug, setup);
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, instruction: ask, picker: "sonnet", idem: "idem" + hex(10) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { calls: [], laneSaw: [], offReq: [], rpc: [], debits: [] };
  let reserved = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": reserved += Number(args.p_cost); return json({ ok: true, charged: Number(args.p_cost), cost: reserved, billing: "reserved" });
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize": return json(args.p_ok ? { ok: true, billing: "finalized" } : { ok: false, error: "not-published" });
        case "edit_refund": return json({ ok: true, refunded: reserved, billing: "reserved" });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      const usage = { input_tokens: 500, output_tokens: 60 };
      if (tool === PICK) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: pick }], usage });
      if (tool === "take_off") {
        seen.offReq.push(args);
        if (off === null) return new Response("no stub for tool take_off", { status: 400 });
        const said = typeof off === "function" ? off(args) : off;
        // ITS OWN USAGE, so the bill can be read for this call by name.
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: Array.isArray(said) ? { targets: said } : said }], usage: OFF_USAGE });
      }
      if (tool === "edit_site" && lane) {
        seen.laneSaw.push(String((args.messages && args.messages[0] && args.messages[0].content) || ""));
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: lane }], usage });
      }
      // THE PUBLISH TRANSLATES THE EXTRA LANGUAGES; answered empty, so a
      // language left out of the stored list is visible as one never asked for.
      if (tool === "write_translation") return new Response("translation not under test", { status: 400 });
      return new Response("no stub for tool " + tool, { status: 400 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("no stub (test fixture)", { status: 400 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let reply = null, status = 0;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
      assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
      reply = JSON.parse(fin.args.p_result.body);
      status = fin.args.p_result.status;
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      status = res.status;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const files = c.calls.map((k) => (k.body && k.body.files) || {});
    const pick1 = (fs, name) => { const k = Object.keys(fs).find((p) => p.endsWith("/" + name) || p === name); return k ? fs[k] : undefined; };
    const stored = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    return {
      status, reply, calls: seen.calls, laneSaw: seen.laneSaw, offReq: seen.offReq, compiles: c.calls.length,
      compiled: (name) => (files[0] ? pick1(files[0], name) : undefined),
      compiledParts: c.calls[0] && c.calls[0].body ? c.calls[0].body.parts : undefined,
      qrPayload: c.calls[0] && c.calls[0].body ? (c.calls[0].body.qr || []) : null,
      look: JSON.parse(b.store.get(CONFIG_KEY(slug))).look,
      stored: Object.fromEntries(stored.map((p) => [p.path, p.source])),
      parts: (() => { try { return JSON.parse(b.store.get("source/" + slug + "/parts.json")); } catch { return b.store.get("source/" + slug + "/parts.json"); } })(),
      debits: seen.debits,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
    };
  } finally { c.uninstall(); globalThis.fetch = real; }
}


const OLD = "Crookes Guitar School", NEW = "Northwind Guitar School";
const HERO = { name: "hero-band", source: "export function HeroBand() {\n  return <section><h1>Welcome to " + OLD + "</h1><p>Lessons for every age.</p></section>;\n}\n" };
const FOOT = { name: "footer-band", source: "export function FooterBand() {\n  return <footer><p>" + OLD + ", Crookes, Sheffield.</p><a href=\"/" + OLD + "\">Home</a></footer>;\n}\n" };
const SHELL = route("/", "import { HeroBand } from '@/components/site-parts/hero-band'\n", "      <HeroBand />\n");
const ASK = "We're now called " + NEW + ".";
const RENAME = { look: { ...LOOK, qr: [] }, pages: [{ path: "index.tsx", source: SHELL }, { path: "prices.tsx", source: PRICES }], parts: [HERO, FOOT, PART] };
const prose = (s) => s.replace("<h1>Welcome to " + OLD, "<h1>Welcome to " + NEW).replace("<p>" + OLD, "<p>" + NEW);

for (const mode of ["sync", "job"]) {
  test("A03-6 — a rename reaches the site's own components, and only the prose (" + mode + ")", async () => {
    const r = await drive({ mode, ask: ASK, pick: { fields: ["brand"] }, lane: { brand: NEW }, setup: RENAME });
    const label = "rename (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.look.brand, NEW, label + ": the brand was not stored");
    const parts = Object.fromEntries(r.parts.map((p) => [p.name, p.source]));
    assert.equal(parts["hero-band"], prose(HERO.source), label + ": the hero kept the old name");
    // THE PROSE ONLY: the footer's link address is not prose and stays.
    assert.equal(parts["footer-band"], prose(FOOT.source), label + ": the footer was not renamed as prose only");
    assert.equal(parts["visit-band"], PART.source, label + ": a component without the name changed");
    assert.equal(r.parts.length, 3, label + ": a component was lost");
    const sent = Object.fromEntries((r.compiledParts || []).map((p) => [p.name, p.source]));
    assert.equal(sent["hero-band"], parts["hero-band"], label + ": the publish did not carry the renamed hero");
    assert.equal(r.reply.renamed, 2, label + ": the reply's count is not what changed");
  });

  test("A03-6 — an unreadable components store refuses the rename before anything is written (" + mode + ")", async () => {
    const r = await drive({ mode, ask: ASK, pick: { fields: ["brand"] }, lane: { brand: NEW }, setup: { ...RENAME, parts: "{not json" } });
    const label = "unreadable (" + mode + ")";
    assert.equal(r.reply.ok, false, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.error, "parts-unreadable", label + ": the refusal");
    assert.equal(r.reply.cost, 0, label + ": charged");
    assert.equal(r.look.brand, OLD, label + ": the brand was stored anyway");
    assert.equal(r.compiles, 0, label + ": something was published");
  });

  test("A03-6 control — a rename on a site with no components still renames its pages (" + mode + ")", async () => {
    const home = route("/", "", "      <h1>" + OLD + "</h1>\n");
    const r = await drive({ mode, ask: ASK, pick: { fields: ["brand"] }, lane: { brand: NEW }, setup: { ...RENAME, pages: [{ path: "index.tsx", source: home }], parts: [] } });
    const label = "no parts (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.stored["index.tsx"], home.split(OLD).join(NEW), label + ": the page was not renamed");
    assert.equal(r.reply.renamed, 1, label + ": count");
  });

  test("A03-6 — a rename beside a QR code's removal renames the components that removal read (" + mode + ")", async () => {
    const r = await drive({ mode, ask: "Take the prices QR code off and we're now called " + NEW + ".",
      pick: { fields: ["qr", "brand"], removes: ["qr"] }, lane: { brand: NEW }, off: ["prices"],
      setup: { look: LOOK, parts: [HERO, PART] } });
    const label = "rename beside a removal (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.look.brand, NEW, label + ": brand");
    assert.deepEqual(r.look.qr, [RING_CODE], label + ": codes");
    const parts = Object.fromEntries(r.parts.map((p) => [p.name, p.source]));
    assert.equal(parts["hero-band"], prose(HERO.source), label + ": the hero kept the old name");
    assert.equal(parts["visit-band"], PART.source, label + ": visit band changed");
  });
}
