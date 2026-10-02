// ONE ENTRY OF A LIST TAKEN OFF KEEPS THE OTHERS (2026-10-02, the whole-router
// audit's W2).
//
// A removal on the look door made no lane call: the field was emptied by name
// (`mergeLook`'s `clear`). Right for a value that is one thing; wrong for a
// list. REPRODUCED FIRST on 5ce037a0 through the real route, with the picker's
// answer supplied (`removes: [field]`):
//
//   "We've stopped teaching in Spanish, so take the Spanish version of the site
//    down."                                   langs ["fr", "es"] → []
//   "Take the Scan for prices QR code off the home page but keep the one for
//    ringing us."                             qr [prices, ring] → [] — and the
//                                             home page still read both codes'
//                                             bindings, which no longer existed
//
// THE FIX: when the stored list holds more than one entry, the field's own lane
// answers the removal (`removalNote`): `langs` and `behavior` answer the list
// with the named entry gone, `qr` names the code that goes (`patchQr` with
// `remove`). Every code that comes off — one of several or the only one — takes
// its figure off the pages and components that show it (`codeFigureRemoval`),
// or nothing changes. A field holding one entry is still emptied for nothing.
//
// WHAT EVERY CASE ASSERTS, through the real `POST /api/site/<slug>/edit`, both
// money paths, every model answer SUPPLIED: the model calls made, what the
// lane was told, the stored look field by field, the pages and components in
// the compiler payload and the store byte by byte, and what was charged.
//
// ⚠ NOT CLAIMED: that a real lane names the right entry. The lane's answer is
// supplied; what is shown is what the route does with it.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool } from "../builder/site-lanes.mjs";

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
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/** One message through the real route; `pick` is the picker's answer, `lane` the lane's (or null: none supplied). */
async function drive({ mode = "sync", ask, pick, lane = null, setup = {} }) {
  const slug = "partial-" + mode + "-" + hex(4);
  const b = bucket(slug, setup);
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, instruction: ask, picker: "sonnet", idem: "idem" + hex(10) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { calls: [], laneSaw: [], rpc: [], debits: [] };
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
      status, reply, calls: seen.calls, laneSaw: seen.laneSaw, compiles: c.calls.length,
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
const ONE_CODE = "Take the Scan for prices QR code off the home page but keep the one for ringing us.";

/** Every look field but the ones named stays exactly as stored. */
function assertLookKept(look, except, label) {
  for (const [k, v] of Object.entries(LOOK)) {
    if (except.includes(k)) continue;
    assert.deepEqual(look[k], v, label + ": the stored `" + k + "` changed");
  }
}
/** Charged for exactly one lane call, on the path the job ran. */
function assertCharged(r, mode, label) {
  const total = mode === "sync" ? r.debits.reduce((a, b) => a + b, 0) : r.reserves.reduce((a, b) => a + b, 0);
  assert.ok(total >= 1, label + ": the lane call was not charged");
  assert.equal(r.reply.cost, total, label + ": the reply's cost is not what was charged");
}

for (const mode of ["sync", "job"]) {
  test("W2 — taking ONE language off keeps the other, through the language lane (" + mode + ")", async () => {
    const r = await drive({ mode, ask: SPANISH, pick: { fields: ["langs"], removes: ["langs"] }, lane: { langs: ["fr"] } });
    const label = "one language (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    // THE LANE RAN — before the fix there was no lane call and the field emptied —
    // shown the stored list and told what it is being asked.
    assert.deepEqual(r.calls.filter((t) => t !== "write_translation"), [PICK, "edit_site"], label + ": model calls");
    assert.match(r.laneSaw[0], /\["fr","es"\]/, label + ": the lane was not shown the stored list");
    assert.match(r.laneSaw[0], /TAKEN OFF THIS LIST/, label + ": the lane was not told this is a removal");
    assert.deepEqual(r.look.langs, ["fr"], label + ": French was not kept");
    assertLookKept(r.look, ["langs"], label);
    // NOTHING ELSE MOVED: the pages and components are the stored ones.
    assert.equal(r.compiles, 1, label + ": compiles");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "prices.tsx": PRICES }, label + ": a page changed");
    assert.deepEqual(r.parts, [PART], label + ": a component changed");
    assertCharged(r, mode, label);
  });

  test("W2 — taking ONE QR code off keeps the other code and its figure, and takes the removed code's figure off (" + mode + ")", async () => {
    const r = await drive({ mode, ask: ONE_CODE, pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: { name: "prices" } } });
    const label = "one code (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls.filter((t) => t !== "write_translation"), [PICK, "edit_site"], label + ": model calls");
    assert.match(r.laneSaw[0], /TAKEN OFF THE SITE/, label + ": the qr lane was not told this is a removal");
    // THE LIST: the ringing code, exactly as stored.
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

  test("CONTROL: the ONLY language is still taken off for nothing, with no lane call (" + mode + ")", async () => {
    const r = await drive({ mode, ask: SPANISH, pick: { fields: ["langs"], removes: ["langs"] }, setup: { look: { ...LOOK, langs: ["es"] } } });
    const label = "only language (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [PICK], label + ": a lane was called for the only entry");
    assert.deepEqual(r.look.langs, [], label + ": the only language was not taken off");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "prices.tsx": PRICES }, label + ": a page changed");
  });

  test("the ONLY QR code comes off with its figure, for nothing (" + mode + ")", async () => {
    const home = route("/", QR_IMPORTS, HOME_TOP + PRICES_FIG);
    const r = await drive({ mode, ask: "Take the QR code off, we don't use it.", pick: { fields: ["qr"], removes: ["qr"] },
      setup: { look: { ...LOOK, qr: [PRICES_CODE] }, pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
    const label = "only code (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls.filter((t) => t !== "write_translation"), [PICK], label + ": a lane was called for the only code");
    assert.deepEqual(r.look.qr, [], label + ": the code was not taken off");
    // BEFORE THE FIX the figure stayed, reading a binding the publish no longer writes.
    assert.equal(r.stored["index.tsx"], route("/", QR_IMPORTS, HOME_TOP), label + ": the figure was not taken off");
    assert.equal(r.stored["prices.tsx"], PRICES, label + ": another page changed");
  });

  test("a removed code whose figure sits inside a condition is REFUSED: nothing written, nothing published, nothing charged (" + mode + ")", async () => {
    const guarded = "      {SITE_QRS.prices && <Figure caption={SITE_QRS.prices.label}><img src={SITE_QRS.prices.src} alt={SITE_QRS.prices.label} /></Figure>}\n";
    const home = route("/", QR_IMPORTS, HOME_TOP + guarded + RING_FIG);
    const r = await drive({ mode, ask: ONE_CODE, pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: { name: "prices" } },
      setup: { pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
    const label = "guarded figure (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "figure-part", label + ": the refusal's reason");
    assert.match(r.reply.msg, /couldn't take the `prices` code off the page/, label + ": the sentence");
    assert.equal(r.reply.unchanged, true, label + ": the refusal does not say nothing changed");
    assert.equal(r.compiles, 0, label + ": something was published");
    assert.deepEqual(r.look, LOOK, label + ": the stored look moved");
    assert.equal(r.stored["index.tsx"], home, label + ": the page moved");
    assert.equal(r.reply.cost, 0, label + ": a refusal was charged");
  });

  test("a removal on a site with several codes where the lane names none is asked which, and changes nothing (" + mode + ")", async () => {
    const r = await drive({ mode, ask: "Take the QR code off.", pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: {} } });
    const label = "which code (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "which-code", label + ": the refusal's reason");
    assert.equal(r.compiles, 0, label + ": something was published");
    assert.deepEqual(r.look, LOOK, label + ": the stored look moved");
  });
}

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
  const r = await drive({ ask: ONE_CODE, pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: { name: "prices" } },
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
  const r = await drive({ ask: ONE_CODE, pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: { name: "prices" } },
    setup: { pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.equal(r.stored["index.tsx"], route("/", QR_IMPORTS, HOME_TOP + RING_FIG), "both copies did not come off, or something else moved");
  assert.equal(r.compiled("index.tsx"), r.stored["index.tsx"]);
});

for (const mode of ["sync", "job"]) {
  test("a component store that cannot be read STOPS the removal: nothing written, nothing published, nothing charged (" + mode + ")", async () => {
    const r = await drive({ mode, ask: ONE_CODE, pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: { name: "prices" } }, setup: { parts: "unreadable" } });
    const label = "unreadable components (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "figure-unchecked", label + ": the refusal's reason");
    assert.match(r.reply.msg, /couldn't check where/, label + ": the sentence");
    assert.equal(r.compiles, 0, label + ": something was published");
    assert.deepEqual(r.look, LOOK, label + ": the stored look moved");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "prices.tsx": PRICES }, label + ": a page moved");
    assert.equal(r.reply.cost, 0, label + ": the refusal was charged");
  });
}

test("a code no page shows yet is taken off without a placement step and without touching a page", async () => {
  const home = route("/", QR_IMPORTS, HOME_TOP + RING_FIG);
  const r = await drive({ ask: ONE_CODE, pick: { fields: ["qr"], removes: ["qr"] }, lane: { qr: { name: "prices" } },
    setup: { pages: [{ path: "index.tsx", source: home }, { path: "prices.tsx", source: PRICES }] } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  // BEFORE: the placement step read the codes as they stood and asked the page
  // writer to PLACE the code being taken off. A removal places nothing.
  assert.deepEqual(r.calls.filter((t) => t !== "write_translation"), [PICK, "edit_site"], "a page writer was asked to place a code being removed");
  assert.deepEqual(r.look.qr, [RING_CODE]);
  assert.deepEqual(r.stored, { "index.tsx": home, "prices.tsx": PRICES }, "a page changed");
  assert.equal(r.reply.qrPages, undefined, "a page was reported changed");
});

test("every extra language asked off: the lane's empty list empties the field", async () => {
  const r = await drive({ ask: "Stop offering the site in any other language.", pick: { fields: ["langs"], removes: ["langs"] }, lane: { langs: [] } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.look.langs, []);
  assertLookKept(r.look, ["langs"], "all languages");
});

test("one control of several stops, the others keep what they do", async () => {
  const filter = { el: "the filter chips", does: "show only the lessons for that instrument", how: "existing" };
  const tabs = { el: "the term tabs", does: "switch between autumn and spring timetables", how: "existing" };
  const r = await drive({ ask: "Stop the term tabs switching, leave them showing autumn.", pick: { fields: ["behavior"], removes: ["behavior"] },
    lane: { behavior: [filter] }, setup: { look: { ...LOOK, behavior: [filter, tabs] } } });
  assert.equal(r.reply.ok, true, JSON.stringify(r.reply));
  assert.deepEqual(r.calls.filter((t) => t !== "write_translation"), [PICK, "edit_site"], "the behaviour lane did not answer the removal");
  assert.deepEqual(r.look.behavior, [filter], "the other control's behaviour was not kept");
});
