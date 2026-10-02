// ONE ENTRY OF A LIST TAKEN OFF KEEPS THE OTHERS — AND ONLY WHAT THE MODEL
// NAMED, CHECKED BY CODE, COMES OFF (2026-10-02, the whole-router audit's W2,
// and the owner's review of batch 1).
//
// A removal on the look door made no lane call: the field was emptied by name
// (`mergeLook`'s `clear`). Right for a value that is one thing; wrong for a
// list. REPRODUCED FIRST on 5ce037a0 through the real route:
//
//   "We've stopped teaching in Spanish, so take the Spanish version of the site
//    down."                                   langs ["fr", "es"] → []
//   "Take the Scan for prices QR code off the home page but keep the one for
//    ringing us."                             qr [prices, ring] → [] — and the
//                                             home page still read both codes'
//                                             bindings, which no longer existed
//
// BATCH 1 (22b0f93b) asked the field's lane only when the list held more than
// one entry, and the qr lane answered ONE name. The owner's review: *"list
// length does not establish which item the customer meant, so a request for an
// absent language or code must preserve the existing item"*, and a single-name
// patch cannot take several codes off, or every one. REPRODUCED on d4e3f1c7:
// German asked off a site offered only in French → French gone, no call;
// "both codes" → the ringing code stayed; the wifi code asked off a site whose
// one code is for prices → the prices code and its figure gone.
//
// THE CONTRACT NOW: every removal on a list is one small call (`take_off`).
// The model is shown each entry by its name and answers the names of the
// entries the customer asked to take off — one, several, every one, or none.
// The route checks each name against the stored list (`takeOffTargets`): a
// name on the list comes off, a name not on it takes nothing off and is said,
// and every entry not named stays exactly as stored. A removal that names
// nothing on the list changes nothing (422, nothing charged for the edit).
// Every code that comes off takes its figure off the pages and components that
// show it (`codeFigureRemoval`), or nothing changes. NOTHING READS THE
// CUSTOMER'S WORDS BUT THE MODEL: the same words with a different answer take a
// different entry off (the control below).
//
// WHAT EVERY CASE ASSERTS, through the real `POST /api/site/<slug>/edit`, the
// sync and queued paths, every model answer SUPPLIED: the model calls made,
// what the removal was shown, the stored look field by field, the pages and
// components in the compiler payload and the store byte by byte, the reply,
// and what was charged.
//
// ⚠ NOT CLAIMED: that a real model names the right entries. The answer is
// supplied; what is shown is what the route does with it.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool } from "../builder/site-lanes.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const PICK = pickTool().name;
const USER = { id: "u-partial-1", email: "owner@example.com" };

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
  const slug = "partial-" + mode + "-" + hex(4);
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
        if (off === null) return new Response("no stub for tool take_off", { status: 503 });
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
      if (tool === "write_translation") return new Response("translation not under test", { status: 503 });
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
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


const SPANISH = "We've stopped teaching in Spanish, so take the Spanish version of the site down.";
const GERMAN = "We've stopped teaching in German, so take the German version of the site down.";
const ONE_CODE = "Take the Scan for prices QR code off the home page but keep the one for ringing us.";
const TWO_CODES = "Take the prices and wifi QR codes off, keep the one for ringing us.";
const BOTH_CODES = "Take both QR codes off the home page, we've stopped using them.";
const WIFI = "Take the wifi QR code off the home page.";
const REMOVE = (field) => ({ fields: [field], removes: [field] });
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "prices.tsx", source: PRICES }];
const WIFI_CODE = { name: "wifi", points: "WIFI:T:WPA;S:Crookes;P:strings;;", label: "Scan to join our wifi" };
const WIFI_FIG = "      <Figure caption={SITE_QRS.wifi.label}><img src={SITE_QRS.wifi.src} alt={SITE_QRS.wifi.label} /></Figure>\n";
// THE RINGING CODE'S WRAPPER HAS CLASSES OF ITS OWN, so when that code comes
// off the wrapper is kept, emptied — a photograph's rule (`codeFigureRemoval`).
const RING_EMPTIED = "      <div className=\"mx-auto max-w-6xl px-6 py-8\">\n      </div>\n";

const modelCalls = (r) => r.calls.filter((t) => t !== "write_translation");
const shown = (r) => String((r.offReq[0] && r.offReq[0].messages && r.offReq[0].messages[0] && r.offReq[0].messages[0].content) || "");

/** Every look field but the ones named stays exactly as stored. */
function assertLookKept(look, except, label, base = LOOK) {
  for (const [k, v] of Object.entries(base)) {
    if (except.includes(k)) continue;
    assert.deepEqual(look[k], v, label + ": the stored `" + k + "` changed");
  }
}
/** Charged for the one removal call, on the path the job ran. */
function assertCharged(r, mode, label) {
  const total = mode === "sync" ? r.debits.reduce((a, b) => a + b, 0) : r.reserves.reduce((a, b) => a + b, 0);
  assert.ok(total >= 1, label + ": nothing was charged");
  assert.equal(r.reply.cost, total, label + ": the reply's cost is not what was charged");
  // THE REMOVAL CALL IS ON THE BILL, by its own usage — the picker's call is
  // billed whatever happens, so a total of one or more alone would pass with
  // this call left off.
  const bill = (r.reply.usage && Array.isArray(r.reply.usage.langUsage)) ? r.reply.usage.langUsage : [];
  assert.ok(bill.some((u) => u && u.in === OFF_USAGE.input_tokens && u.out === OFF_USAGE.output_tokens), label + ": the removal call is not on the bill: " + JSON.stringify(bill));
}
/** Refused: nothing stored, nothing published, nothing charged. */
function assertRefused(r, look, pages, label) {
  assert.equal(r.reply.unchanged, true, label + ": the refusal does not say nothing changed");
  assert.equal(r.reply.cost, 0, label + ": the refusal was charged");
  assert.deepEqual(r.debits.filter(Boolean), [], label + ": something was debited");
  assert.deepEqual(r.reserves, [], label + ": something was reserved");
  assert.equal(r.compiles, 0, label + ": something was published");
  assert.deepEqual(r.look, look, label + ": the stored look moved");
  assert.deepEqual(r.stored, Object.fromEntries(pages.map((p) => [p.path, p.source])), label + ": a page moved");
  assert.deepEqual(r.parts, [PART], label + ": a component moved");
}

for (const mode of ["sync", "job"]) {
  test("W2 — ONE language of two comes off by the name the removal gave; the other stays (" + mode + ")", async () => {
    const r = await drive({ mode, ask: SPANISH, pick: REMOVE("langs"), off: ["es"] });
    const label = "one language (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": model calls");
    // WHAT THE REMOVAL WAS SHOWN AND ASKED: every entry by the name to answer
    // with, the customer's words as they wrote them, and one forced tool whose
    // answer is a list of names.
    const req = r.offReq[0];
    assert.equal(req.tool_choice && req.tool_choice.name, "take_off", label + ": the removal's tool was not forced");
    assert.deepEqual(req.tools.map((t) => t.name), ["take_off"], label + ": the removal's tools");
    assert.deepEqual(req.tools[0].input_schema.properties.targets, { type: "array", items: { type: "string" }, description: req.tools[0].input_schema.properties.targets.description },
      label + ": the answer is not a list of names");
    assert.match(shown(r), /^- fr\n- es$/m, label + ": the removal was not shown the stored list by name");
    assert.ok(shown(r).endsWith("What they asked for:\n" + SPANISH), label + ": the customer's words were not passed as written");
    assert.deepEqual(r.look.langs, ["fr"], label + ": French was not kept");
    assertLookKept(r.look, ["langs"], label);
    // NOTHING ELSE MOVED: the pages and components are the stored ones.
    assert.equal(r.compiles, 1, label + ": compiles");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "prices.tsx": PRICES }, label + ": a page changed");
    assert.deepEqual(r.parts, [PART], label + ": a component changed");
    assert.equal(r.reply.takeOffNote, undefined, label + ": a note about a name that was there");
    assertCharged(r, mode, label);
  });

  test("THE OWNER'S CASE — a language the site is not offered in, asked off a site with ONE extra language, takes nothing off (" + mode + ")", async () => {
    const look = { ...LOOK, langs: ["fr"] };
    const r = await drive({ mode, ask: GERMAN, pick: REMOVE("langs"), off: ["de"], setup: { look } });
    const label = "absent language (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.error, "take-off", label + ": the refusal's error");
    assert.equal(r.reply.reason, "not-found", label + ": the refusal's reason");
    assert.deepEqual(r.reply.named, ["de"], label + ": the names the removal gave");
    assert.equal(r.reply.msg, "This site has no extra language `de` — its only extra language is `fr`.", label + ": the sentence");
    // THE REMOVAL WAS ASKED — the list's length decides nothing — and shown French.
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": model calls");
    assert.match(shown(r), /^- fr$/m, label + ": the removal was not shown the list");
    assertRefused(r, look, PAGES, label);
  });

  test("THE OWNER'S CASE — answered with no names at all, the one extra language stays (" + mode + ")", async () => {
    const look = { ...LOOK, langs: ["fr"] };
    const r = await drive({ mode, ask: GERMAN, pick: REMOVE("langs"), off: [], setup: { look } });
    const label = "nothing named (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "not-found", label + ": the refusal's reason");
    assert.equal(r.reply.msg, "Nothing you asked to take off is on this site — its only extra language is `fr`.", label + ": the sentence");
    assertRefused(r, look, PAGES, label);
  });

  test("the ONLY language, named, comes off — asked, not assumed from the list's length (" + mode + ")", async () => {
    const look = { ...LOOK, langs: ["es"] };
    const r = await drive({ mode, ask: SPANISH, pick: REMOVE("langs"), off: ["es"], setup: { look } });
    const label = "only language (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": the removal was not asked");
    assert.deepEqual(r.look.langs, [], label + ": the only language was not taken off");
    assertLookKept(r.look, ["langs"], label, look);
    assert.deepEqual(r.stored, { "index.tsx": HOME, "prices.tsx": PRICES }, label + ": a page changed");
    assertCharged(r, mode, label);
  });

  test("W2 — ONE QR code of two comes off with its figure; the other code and its figure stay (" + mode + ")", async () => {
    const r = await drive({ mode, ask: ONE_CODE, pick: REMOVE("qr"), off: ["prices"] });
    const label = "one code (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": model calls");
    assert.match(shown(r), /^- prices — “Scan for prices”, scanning it opens https:\/\/crookes\.gofarther\.app\/prices\n- ring — “Scan to ring and book”, scanning it opens tel:\+441140000000$/m,
      label + ": the removal was not shown the codes by name");
    assert.deepEqual(r.look.qr, [RING_CODE], label + ": the stored codes");
    assertLookKept(r.look, ["qr"], label);
    // THE PAGE: the prices figure gone, character for character, and the
    // ringing code's figure and every other line as they were.
    const expectHome = route("/", QR_IMPORTS, HOME_TOP + RING_FIG);
    assert.equal(r.stored["index.tsx"], expectHome, label + ": the home page as stored");
    assert.equal(r.compiled("index.tsx"), expectHome, label + ": the home page as compiled");
    assert.equal(r.stored["prices.tsx"], PRICES, label + ": a page that shows no code changed");
    assert.deepEqual(r.parts, [PART], label + ": a component changed");
    assert.deepEqual(r.qrPayload.map((q) => q.name), ["ring"], label + ": the codes drawn for the publish");
    assert.deepEqual(r.reply.qrRemoved, ["prices"], label + ": the reply's removed code");
    assert.deepEqual(r.reply.qrPages, ["index.tsx"], label + ": the reply's changed page");
    assertCharged(r, mode, label);
  });

  test("W2 — TWO codes of three come off with their figures; the third code and its figure stay (" + mode + ")", async () => {
    const look = { ...LOOK, qr: [PRICES_CODE, RING_CODE, WIFI_CODE] };
    const home = route("/", QR_IMPORTS, HOME_TOP + PRICES_FIG + RING_FIG + WIFI_FIG);
    const r = await drive({ mode, ask: TWO_CODES, pick: REMOVE("qr"), off: ["prices", "wifi"],
      setup: { look, pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
    const label = "two codes of three (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": model calls");
    assert.deepEqual(r.look.qr, [RING_CODE], label + ": the stored codes");
    assertLookKept(r.look, ["qr"], label, look);
    const expectHome = route("/", QR_IMPORTS, HOME_TOP + RING_FIG);
    assert.equal(r.stored["index.tsx"], expectHome, label + ": the home page as stored");
    assert.equal(r.compiled("index.tsx"), expectHome, label + ": the home page as compiled");
    assert.equal(r.stored["prices.tsx"], PRICES, label + ": a page that shows no code changed");
    assert.deepEqual(r.parts, [PART], label + ": a component changed");
    assert.deepEqual(r.qrPayload.map((q) => q.name), ["ring"], label + ": the codes drawn for the publish");
    assert.deepEqual(r.reply.qrRemoved, ["prices", "wifi"], label + ": the reply's removed codes");
    assertCharged(r, mode, label);
  });

  test("W2 — EVERY code asked off comes off, each with its figure (" + mode + ")", async () => {
    const r = await drive({ mode, ask: BOTH_CODES, pick: REMOVE("qr"), off: ["prices", "ring"] });
    const label = "every code (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": model calls");
    assert.deepEqual(r.look.qr, [], label + ": a code stayed");
    assertLookKept(r.look, ["qr"], label);
    // BOTH FIGURES OFF. The ringing code's classed wrapper stays, emptied; the
    // import of `SITE_QRS` stays and stays valid — every publish writes it,
    // as `{}` when the site has no codes.
    const expectHome = route("/", QR_IMPORTS, HOME_TOP + RING_EMPTIED);
    assert.equal(r.stored["index.tsx"], expectHome, label + ": the home page as stored");
    assert.equal(r.compiled("index.tsx"), expectHome, label + ": the home page as compiled");
    assert.equal(r.stored["prices.tsx"], PRICES, label + ": a page that shows no code changed");
    assert.deepEqual(r.parts, [PART], label + ": a component changed");
    assert.deepEqual(r.qrPayload, [], label + ": a code was drawn for the publish");
    assert.deepEqual(r.reply.qrRemoved, ["prices", "ring"], label + ": the reply's removed codes");
    assertCharged(r, mode, label);
  });

  test("THE OWNER'S CASE — a code the site does not have, asked off a site with ONE code, keeps that code and its figure (" + mode + ")", async () => {
    const look = { ...LOOK, qr: [PRICES_CODE] };
    const pages = [{ path: "index.tsx", source: route("/", QR_IMPORTS, HOME_TOP + PRICES_FIG) }, { path: "prices.tsx", source: PRICES }];
    const r = await drive({ mode, ask: WIFI, pick: REMOVE("qr"), off: ["wifi"], setup: { look, pages } });
    const label = "absent code (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "not-found", label + ": the refusal's reason");
    assert.deepEqual(r.reply.named, ["wifi"], label + ": the names the removal gave");
    assert.equal(r.reply.msg, "This site has no QR code `wifi` — its only QR code is `prices`.", label + ": the sentence");
    assert.deepEqual(modelCalls(r), [PICK, "take_off"], label + ": model calls");
    assertRefused(r, look, pages, label);
  });

  test("a removed code whose figure sits inside a condition is REFUSED: nothing written, nothing published, nothing charged (" + mode + ")", async () => {
    const guarded = "      {SITE_QRS.prices && <Figure caption={SITE_QRS.prices.label}><img src={SITE_QRS.prices.src} alt={SITE_QRS.prices.label} /></Figure>}\n";
    const pages = [{ path: "index.tsx", source: route("/", QR_IMPORTS, HOME_TOP + guarded + RING_FIG) }, { path: "prices.tsx", source: PRICES }];
    const r = await drive({ mode, ask: ONE_CODE, pick: REMOVE("qr"), off: ["prices"], setup: { pages } });
    const label = "guarded figure (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "figure-part", label + ": the refusal's reason");
    assert.equal(r.reply.msg, "I couldn't take the `prices` code off the pages that show it without changing more than the code itself.", label + ": the sentence");
    assertRefused(r, LOOK, pages, label);
  });

  test("a removal whose answer cannot be read changes nothing and says it could not tell (" + mode + ")", async () => {
    const r = await drive({ mode, ask: SPANISH, pick: REMOVE("langs"), off: { targets: "es" } });
    const label = "unreadable answer (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "unread", label + ": the refusal's reason");
    assert.deepEqual(r.reply.named, [], label + ": an unreadable answer named something");
    assert.equal(r.reply.msg, "I couldn't tell which extra language to take off — its extra languages are `fr`, `es`. Say which one.", label + ": the sentence");
    assertRefused(r, LOOK, PAGES, label);
  });
}

// ── THE MODEL DECIDES; CODE ONLY CHECKS ───────────────────────────────────────

test("CONTROL — the same words with a different answer take a different entry off: nothing here reads the customer's words", async () => {
  const r = await drive({ ask: SPANISH, pick: REMOVE("langs"), off: ["fr"] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.look.langs, ["es"], "the route did not take off what the removal named");
});

test("several languages of three: the two named come off, the third stays", async () => {
  const look = { ...LOOK, langs: ["fr", "es", "de"] };
  const r = await drive({ ask: "Stop offering the site in Spanish and German.", pick: REMOVE("langs"), off: ["es", "de"], setup: { look } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.look.langs, ["fr"]);
  assertLookKept(r.look, ["langs"], "two of three", look);
});

test("every extra language asked off empties the field", async () => {
  const r = await drive({ ask: "Stop offering the site in any other language.", pick: REMOVE("langs"), off: ["fr", "es"] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.look.langs, []);
  assertLookKept(r.look, ["langs"], "all languages");
});

test("one name on the list and one not: the one there comes off, and the reply says the other changed nothing — on the customer's screen too", async () => {
  const r = await drive({ ask: "Stop offering the site in Spanish and German.", pick: REMOVE("langs"), off: ["es", "de"] });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.look.langs, ["fr"]);
  const note = "There was no extra language `de` to take off, so that part changed nothing.";
  assert.equal(r.reply.takeOffNote, note);
  // THE BROWSER'S OWN COMPOSER, cut from `public/chat.js` and handed this
  // reply as the route returned it.
  const screen = editBrowserReply(r.reply, true);
  assert.equal(screen.ok, true, screen.why);
  // (Which words name the field is the look sentence's business — backlog —
  // so this pins the note's place after it, not those words.)
  assert.match(screen.text, /^✅ Updated the look[^.]*\. There was no extra language `de` to take off, so that part changed nothing\./, "the screen: " + JSON.stringify(screen.text));
  // CONTROL: the same reply without the note shows no note.
  const plain = editBrowserReply({ ...r.reply, takeOffNote: undefined }, true);
  assert.ok(plain.ok && !plain.text.includes("to take off"), "a reply with no note shows one: " + JSON.stringify(plain.text));
  for (const v of [7, ["x"], "  "]) assert.ok(!editBrowserReply({ ...r.reply, takeOffNote: v }, true).text.includes(String(v).trim() || "never"), "a note that is not a sentence was shown: " + JSON.stringify(v));
});

test("a removal that took nothing off is shown as its sentence, said once that nothing changed, and the browser starts nothing else", async () => {
  const look = { ...LOOK, langs: ["fr"] };
  const r = await drive({ ask: GERMAN, pick: REMOVE("langs"), off: ["de"], setup: { look } });
  assert.equal(r.status, 422, JSON.stringify(r.reply));
  const screen = editBrowserReply(r.reply, false);
  assert.equal(screen.ok, true, screen.why);
  // THE STEP SAYS WHAT IT FOUND; THE BROWSER SAYS NOTHING CHANGED AND WHAT IT
  // COST — once. The step's sentence said "Nothing was changed." as well until
  // the screenshot showed both.
  assert.equal(screen.text, "⚠️ This site has no extra language `de` — its only extra language is `fr`. Nothing on your site changed, and this edit cost you nothing.",
    "the screen: " + JSON.stringify(screen.text));
  assert.equal(screen.text.match(/[Nn]othing (?:on your site |was )?changed/g).length, 1, "the screen says twice that nothing changed");
  assert.deepEqual(screen.actions.filter((a) => /PAID/.test(a)), [], "the browser started a paid request after a refusal: " + JSON.stringify(screen.actions));
});

test("two removals in one message: each is shown only its own words, both come off, one publish", async () => {
  const ask = "Stop offering the site in Spanish, and take the prices QR code off the home page.";
  const langsWords = "Stop offering the site in Spanish";
  const qrWords = "take the prices QR code off the home page";
  const r = await drive({
    ask,
    pick: { fields: ["langs", "qr"], removes: ["langs", "qr"], scopes: [{ part: "langs", words: langsWords }, { part: "qr", words: qrWords }] },
    off: (req) => (/\(`qr`\)/.test(String(req.messages[0].content)) ? ["prices"] : ["es"]),
  });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(modelCalls(r), [PICK, "take_off", "take_off"], "model calls");
  const told = r.offReq.map((q) => String(q.messages[0].content));
  const forLangs = told.find((t) => t.includes("(`langs`)"));
  const forQr = told.find((t) => t.includes("(`qr`)"));
  assert.ok(forLangs && forQr, "each removal was not asked once: " + JSON.stringify(told));
  assert.ok(forLangs.endsWith("What they asked for:\n" + langsWords), "the language removal was handed more than its own words: " + forLangs.slice(-200));
  assert.ok(forQr.endsWith("What they asked for:\n" + qrWords), "the code removal was handed more than its own words: " + forQr.slice(-200));
  assert.deepEqual(r.look.langs, ["fr"]);
  assert.deepEqual(r.look.qr, [RING_CODE]);
  assertLookKept(r.look, ["langs", "qr"], "two removals");
  assert.equal(r.compiles, 1, "not one publish");
  assert.equal(r.stored["index.tsx"], route("/", QR_IMPORTS, HOME_TOP + RING_FIG), "the home page");
});

test("a removal call that fails changes nothing and charges nothing", async () => {
  const r = await drive({ ask: SPANISH, pick: REMOVE("langs"), off: null });
  assert.equal(r.status, 503, JSON.stringify(r.reply));
  assert.equal(r.reply.error, "send");
  assert.equal(r.reply.msg, "The editor is busy — try again in a moment.");
  assert.equal(r.reply.cost, 0);
  assert.equal(r.compiles, 0, "something was published");
  assert.deepEqual(r.look, LOOK, "the stored look moved");
});

test("a list with nothing on it asks no one: there is nothing to take off, and nothing changes", async () => {
  const look = { ...LOOK, langs: [] };
  const r = await drive({ ask: SPANISH, pick: REMOVE("langs"), setup: { look } });
  assert.equal(r.status, 422, JSON.stringify(r.reply));
  assert.deepEqual(modelCalls(r), [PICK], "a removal was asked about an empty list");
  assert.equal(r.reply.msg, "This site has no extra languages to take off.");
  assertRefused(r, look, PAGES, "empty list");
});

test("one control of several stops by the number the removal gave; the other keeps what it does", async () => {
  const filter = { control: "the filter chips", on: "pressing one", does: "shows only the lessons for that instrument", affects: "the lessons list", result: "the list narrows to one instrument", source: "component" };
  const tabs = { control: "the term tabs", on: "pressing one", does: "switches between the autumn and spring timetables", affects: "the timetable", result: "the other term shows", source: "component" };
  const look = { ...LOOK, behavior: [filter, tabs] };
  const r = await drive({ ask: "Stop the term tabs switching, leave them showing autumn.", pick: REMOVE("behavior"), off: ["2"], setup: { look } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(modelCalls(r), [PICK, "take_off"], "the removal was not asked");
  assert.match(shown(r), /^- 1 — the filter chips — pressing one — shows only the lessons for that instrument\n- 2 — the term tabs — pressing one — switches between the autumn and spring timetables$/m,
    "the controls were not shown by number");
  assert.deepEqual(r.look.behavior, [filter], "the other control's behaviour was not kept");
  assertLookKept(r.look, ["behavior"], "one control", look);
});

// ── WHERE ELSE A FIGURE CAN BE, AND WHAT STOPS THE CHANGE ─────────────────────
//
// The figure check reads every file the publish writes — the pages and the
// components they import — and a store it cannot read stops the change: a code
// taken off the list while its figure stays somewhere unread is a page reading
// a binding the publish no longer writes.
const QR_BAND = {
  name: "qr-band",
  source: QR_IMPORTS + "export function QrBand() {\n  return (\n    <section>\n" + PRICES_FIG + RING_FIG + "    </section>\n  );\n}\n",
};

test("a removed code's figure inside a COMPONENT comes off the component, which is handed to the publish; the pages stay", async () => {
  const home = route("/", "", HOME_TOP);
  const r = await drive({ ask: ONE_CODE, pick: REMOVE("qr"), off: ["prices"],
    setup: { pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }], parts: [PART, QR_BAND] } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  const band = QR_BAND.source.replace(PRICES_FIG, "");
  assert.ok(band !== QR_BAND.source && band.includes(RING_FIG), "the fixture's component does not hold both figures");
  assert.deepEqual(r.parts, [PART, { name: "qr-band", source: band }], "the stored component still shows the removed code");
  // THE COMPILE IS HANDED THE COMPONENTS BESIDE THE PAGES, in its own field.
  assert.deepEqual((r.compiledParts || []).find((p) => p && p.name === "qr-band"), { name: "qr-band", source: band },
    "the publish was not handed the component without the figure");
  assert.deepEqual(r.stored, { "index.tsx": home, "prices.tsx": PRICES }, "a page changed");
  assert.deepEqual(r.look.qr, [RING_CODE]);
});

test("the removed code shown twice on one page comes off in both places, and the code that stays is untouched", async () => {
  const home = route("/", QR_IMPORTS, HOME_TOP + PRICES_FIG + RING_FIG + PRICES_FIG);
  const r = await drive({ ask: ONE_CODE, pick: REMOVE("qr"), off: ["prices"],
    setup: { pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(r.stored["index.tsx"], route("/", QR_IMPORTS, HOME_TOP + RING_FIG), "both copies did not come off, or something else moved");
  assert.equal(r.compiled("index.tsx"), r.stored["index.tsx"]);
});

for (const mode of ["sync", "job"]) {
  test("a component store that cannot be read STOPS the removal: nothing written, nothing published, nothing charged (" + mode + ")", async () => {
    const r = await drive({ mode, ask: TWO_CODES, pick: REMOVE("qr"), off: ["prices", "ring"], setup: { parts: "unreadable" } });
    const label = "unreadable components (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "figure-unchecked", label + ": the refusal's reason");
    assert.equal(r.reply.msg, "I couldn't check where the `prices` and `ring` codes are shown on your pages — try again in a moment.", label + ": the sentence");
    assert.equal(r.compiles, 0, label + ": something was published");
    assert.deepEqual(r.look, LOOK, label + ": the stored look moved");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "prices.tsx": PRICES }, label + ": a page moved");
    assert.equal(r.parts, "unreadable", label + ": the component store was written");
    assert.equal(r.reply.cost, 0, label + ": the refusal was charged");
  });
}

test("a code no page shows yet is taken off without a placement step and without touching a page", async () => {
  const home = route("/", QR_IMPORTS, HOME_TOP + RING_FIG);
  const r = await drive({ ask: ONE_CODE, pick: REMOVE("qr"), off: ["prices"],
    setup: { pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  // BEFORE: the placement step read the codes as they stood and asked the page
  // writer to PLACE the code being taken off. A removal places nothing.
  assert.deepEqual(modelCalls(r), [PICK, "take_off"], "a page writer was asked to place a code being removed");
  assert.deepEqual(r.look.qr, [RING_CODE]);
  assert.deepEqual(r.stored, { "index.tsx": home, "prices.tsx": PRICES }, "a page changed");
  assert.equal(r.reply.qrPages, undefined, "a page was reported changed");
});
