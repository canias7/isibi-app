// THE EDIT ROUTE IGNORES THE ROUTER'S VERBS ON A HAND-OVER (2026-10-02, the
// whole-router audit's W1, the route's half).
//
// The browser marks a hand-over `handedOff: true` and no longer sends the first
// answer's `remove`, `rename` or `tab` on one (test/handover-operations.test.mjs).
// This is the route's own half: the verbs belong to the step the ROUTER chose,
// so on a request marked as a hand-over they are not read, whatever is sent —
// a photograph's removal handed to the page step can never delete the page.
//
// REPRODUCED FIRST on 5ce037a0, through the real `POST /api/site/<slug>/edit`:
// `{layer: "page", page: "/gallery", remove: true}` arriving as a hand-over
// deleted /gallery with no model call, and a move handed over moved the page.
//
// WHAT EVERY CASE ASSERTS: the real route, both money paths (the synchronous
// `use_credits` and the queued `edit_reserve`), every model answer SUPPLIED;
// the page writer's calls and the file it was shown; the compiler payload and
// the store, page by page — the intended change made, every neighbouring page
// byte-identical; and, as the control, the router's own removal still removing.
//
// ⚠ NOT CLAIMED: that a real page writer removes a photograph well. The writer
// is a stub that applies the change to the file it is SHOWN, so what is shown
// is which operation the route runs, never what a model writes.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

const T = { tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name };
const USER = { id: "u-handover-1", email: "owner@example.com" };

const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/ui/safe-image'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
const PHOTO = "<SafeImage src=\"/u/s/ovens.jpg\" alt=\"The ovens at dawn\" />";
const HOME = page("/", "<section><h2>Welcome in</h2><p>Bread from the harbour, every morning.</p></section>");
const GALLERY = page("/gallery", "<section><h2>From the ovens</h2>" + PHOTO + "<p>Loaves, buns and the odd pie.</p></section>");
const VISIT = page("/visit", "<section><h2>Find us</h2><p>Quay Street, by the lifeboat station.</p></section>");
const STORED = [
  { path: "index.tsx", source: HOME },
  { path: "gallery.tsx", source: GALLERY },
  { path: "visit.tsx", source: VISIT },
];
// THE WRITER'S CHANGE: the photograph's element out of the file it was shown,
// and nothing else — so a writer shown the wrong page changes nothing.
const takePhoto = (src) => src.split(PHOTO).join("");
const ASK = "Take the photo off the gallery page.";

function shownFile(body) {
  const content = String((body && body.messages && body.messages[0] && body.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2) };
}

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(STORED)],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" } })],
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

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/**
 * One request through the real route, on either money path; `routed` is the
 * posted body's routing fields. `ask` is the customer's message (2026-10-02,
 * batch 2: a mixed message, with a part put off), and `setup` may change the
 * stored site before the request — a site whose pages cannot be read.
 */
async function drive({ mode = "sync", routed, ask = ASK, setup = null }) {
  const slug = "handover-" + mode + "-" + hex32().slice(0, 8);
  const b = bucket(slug);
  if (setup) setup(b, slug);
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({
    layer: "page", page: "", remove: false, rename: "", tab: false,
    ...routed,
    instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20),
  });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { calls: [], shown: [], rpc: [], debits: [], traces: [] };
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
    // THE ROUTE'S BLACK BOX (2026-10-02): one row carrying `events`, as
    // `traceRow` writes it — read for the hand-over the route recorded.
    if (u.includes("/rest/v1/edit_traces")) {
      for (const e of (args && args.events) || []) seen.traces.push({ phase: e.p, status: e.s, detail: e.d });
      return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
    }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/rpc/credit_back")) { seen.rpc.push({ fn: "credit_back", args }); return new Response(null, { status: 204 }); }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      const usage = { input_tokens: 1000, output_tokens: 500 };
      // THE QUICK WRITER DECLINES — taking a photograph's element off is not a
      // visual tweak (its description goes with it) — so the page writer runs,
      // as it would for a real removal of an element on this rung.
      if (tool === T.tweak) {
        seen.shown.push(shownFile(args));
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { cannot: "taking the photograph off removes its description" } }], usage });
      }
      // THE PAGE WRITER, handed the one page: the change applied to the page
      // it was SHOWN, found in its prompt by the page's own source.
      if (tool === T.pages) {
        const prompt = JSON.stringify(args.messages || []);
        const shown = STORED.filter((p) => prompt.includes(JSON.stringify(p.source).slice(1, -1)));
        seen.written = shown.map((p) => p.path);
        const pages = shown.map((p) => ({ path: "src/routes/" + p.path, source: takePhoto(p.source) }));
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { pages, parts: [] } }], usage });
      }
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
    const payloads = c.calls.map((k) => {
      const files = (k.body && k.body.files) || {};
      const out = {};
      for (const [p, src] of Object.entries(files)) {
        const name = p.replace(/^src\/routes\//, "");
        if (name.endsWith(".tsx") && !name.includes("-parts/") && name !== "__root.tsx") out[name] = src;
      }
      return out;
    });
    const storedRaw = b.store.get("source/" + slug + "/pages.json");
    const stored = storedRaw ? JSON.parse(storedRaw) : [];
    return {
      status, reply, calls: seen.calls, shown: seen.shown, written: seen.written || [], compiles: c.calls.length, payloads,
      stored: Object.fromEntries(stored.map((p) => [p.path, p.source])),
      config: JSON.parse(b.store.get(CONFIG_KEY(slug)) || "null"),
      debits: seen.debits,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
      traces: seen.traces,
    };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

/** The site after the request, in the compiler payload AND the store: exactly these pages, these sources. */
function assertSite(r, expected, label) {
  assert.equal(r.compiles, 1, label + ": compiles");
  assert.deepEqual(Object.keys(r.payloads[0]).sort(), Object.keys(expected).sort(), label + ": the compiler was handed a different set of pages");
  assert.deepEqual(Object.keys(r.stored).sort(), Object.keys(expected).sort(), label + ": the store holds a different set of pages");
  for (const [file, src] of Object.entries(expected)) {
    assert.equal(r.payloads[0][file], src, label + ": the compiler got the wrong " + file);
    assert.equal(r.stored[file], src, label + ": the store holds the wrong " + file);
  }
}

for (const mode of ["sync", "job"]) {
  test("a hand-over to the page step carrying remove: true KEEPS the page and makes the change on it (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "page", page: "/gallery", remove: true, handedOff: true } });
    const label = "handed-over remove (" + mode + ")";
    assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    // THE WRITERS RAN ON THE GALLERY AS STORED, AND ON NOTHING ELSE. Before the
    // fix neither ran: the removal branch took the page away with no model call.
    assert.deepEqual(r.calls, [T.tweak, T.pages], label + ": model calls");
    assert.deepEqual(r.shown.map((f) => f && f.path), ["gallery.tsx"], label + ": the quick writer was shown the wrong file");
    assert.equal(r.shown[0].source, GALLERY, label + ": the quick writer was not shown the stored gallery");
    assert.deepEqual(r.written, ["gallery.tsx"], label + ": the page writer was shown the wrong pages");
    // THE GALLERY IS KEPT, WITHOUT ITS PHOTOGRAPH; THE OTHER PAGES BYTE-IDENTICAL.
    assertSite(r, { "index.tsx": HOME, "gallery.tsx": takePhoto(GALLERY), "visit.tsx": VISIT }, label);
    assert.equal(r.reply.removed, undefined, label + ": the reply says a page was removed");
  });

  test("a hand-over carrying rename does NOT move the page (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "page", page: "/gallery", rename: "/photos", handedOff: true } });
    const label = "handed-over rename (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [T.tweak, T.pages], label + ": model calls");
    assert.deepEqual(r.written, ["gallery.tsx"], label + ": the page writer was shown the wrong pages");
    assertSite(r, { "index.tsx": HOME, "gallery.tsx": takePhoto(GALLERY), "visit.tsx": VISIT }, label);
    assert.equal(r.reply.renamedTo, undefined, label + ": the reply says the page moved");
  });

  test("CONTROL: a hand-over mark that is not a real boolean is not one — the router's removal still removes (" + mode + ")", async () => {
    // NOTHING MERELY TRUTHY, the rule `remove` and `tab` already live under:
    // the browser sends `handedOff: true` or nothing, so a string that reads
    // "true" is not a mark the route may act on — and acting on it would drop
    // the router's own verb from the router's own step.
    for (const handedOff of ["true", 1, {}]) {
      const r = await drive({ mode, routed: { layer: "page", page: "/gallery", remove: true, handedOff } });
      const label = "truthy mark " + JSON.stringify(handedOff) + " (" + mode + ")";
      assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
      assert.deepEqual(r.calls, [], label + ": a model was called for a removal");
      assertSite(r, { "index.tsx": HOME, "visit.tsx": VISIT }, label);
    }
  });

  test("CONTROL: the router's own removal of a page still removes exactly that page, at no model call (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "page", page: "/gallery", remove: true } });
    const label = "router's removal (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [], label + ": a model was called for a removal");
    assertSite(r, { "index.tsx": HOME, "visit.tsx": VISIT }, label);
    assert.deepEqual(r.reply.removed, ["gallery.tsx"], label + ": the reply's removal");
  });
}

// ── THE LOGO STEP'S OWN VERB, THE SAME WAY ───────────────────────────────────
//
// `tab` sends the artwork to the browser-tab slot instead of the header. It is
// the router's word for the logo step it chose, so on a hand-over it is not
// read: a picture handed to the logo step lands where an unmarked logo goes.
// The browser no longer sends it on one (`EditPoll.handOver`); this is the
// route holding the same line for a client that does.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
for (const mode of ["sync", "job"]) {
  test("a hand-over to the logo step carrying tab: true puts the picture in the header, not the tab (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "logo", page: "", tab: true, handedOff: true, images: [PNG] } });
    const label = "handed-over tab (" + mode + ")";
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [], label + ": a model was called for an upload");
    const look = (r.config && r.config.look) || {};
    assert.equal(look.wordmark && look.wordmark.form, "image", label + ": the picture is not the header's logo");
    assert.equal(look.favicon, undefined, label + ": the picture went to the browser tab");
    assert.equal(look.brand, "Harbour Loaf", label + ": the rest of the look was not kept");
  });

  test("CONTROL: the router's own tab flag still puts the picture in the browser tab (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "logo", page: "", tab: true, images: [PNG] } });
    const label = "router's tab (" + mode + ")";
    assert.equal(r.reply && r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    const look = (r.config && r.config.look) || {};
    assert.equal(look.favicon && look.favicon.form, "image", label + ": the picture is not the tab icon");
    assert.equal(look.wordmark, undefined, label + ": the picture went to the header");
  });
}

// ── BATCH 2: A PART PUT OFF, ON EVERY ENDING, AND A REMOVAL THAT STAYS AN EDIT ──
//
// (2026-10-02, the whole-router audit's W5, W7 and W24, the edit route's half.)
//
// W5: "Take the Events page off the site and add a page for our cake orders",
// answered `page` + `remove` for /events with the addition put off, on a site
// without /events. The router's reader used to turn that into the add-on step
// — which cannot take a page away — while the addition it COULD make waited.
// It stays the edit now, and this is what the edit route does with it: the
// page step finds no stored route for /events and refuses before anything is
// removed, naming the site's real pages, at no cost (`page/no-page`).
//
// W7: whatever the ending, the reply names the part put off (`deferred`) — the
// refusal above, an escalation, and a success alike — from the parts the route
// really took out of the message, never from the request's wording.
//
// W24: a hand-over is checked and recorded where it arrives.
const MIXED = "Take the Events page off the site and add a page for our cake orders.";
const HELD = "add a page for our cake orders";

for (const mode of ["sync", "job"]) {
  test("W5 — a removal of a page the site does not have stays an edit: refused at no cost with the real pages, the part put off still named (" + mode + ")", async () => {
    const r = await drive({ mode, ask: MIXED, routed: { layer: "page", page: "/events", remove: true, alsoAsked: HELD } });
    const label = "missing-page removal (" + mode + ")";
    assert.equal(r.status, 422, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.ok, false, label);
    assert.equal(r.reply.error, "no-page", label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.msg, "Your site doesn't have a /events page, so there was nothing to take off. Its pages are /, /gallery and /visit.",
      label + ": the refusal does not say the page is not there and name the site's real pages");
    // NOTHING RAN, NOTHING WAS CHARGED, NOTHING WAS PUBLISHED.
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assert.equal(r.compiles, 0, label + ": something was compiled");
    assert.deepEqual(r.debits, [], label + ": a charge was taken");
    assert.deepEqual(r.reserves, [], label + ": a reserve was taken");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "gallery.tsx": GALLERY, "visit.tsx": VISIT }, label + ": the stored site moved");
    // AND THE PART PUT OFF IS NAMED ON THIS REFUSAL, in the customer's spelling.
    assert.equal(r.reply.deferred, HELD, label + ": the refusal does not name the part put off");
  });

  test("W7 — an escalation names the part put off too: a site whose pages cannot be read climbs, and says what waits (" + mode + ")", async () => {
    const r = await drive({
      mode, ask: MIXED, routed: { layer: "page", page: "/gallery", alsoAsked: HELD },
      setup: (b, slug) => { b.store.delete("source/" + slug + "/pages.json"); },
    });
    const label = "escalate (" + mode + ")";
    assert.equal(r.reply.escalate, true, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.reason, "no-source", label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.deferred, HELD, label + ": the escalation does not name the part put off");
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assert.equal(r.compiles, 0, label);
  });

  test("W7 — a part the route cannot find in the message is not guessed at: refused, nothing taken out, nothing named as put off (" + mode + ")", async () => {
    const r = await drive({ mode, ask: MIXED, routed: { layer: "page", page: "/gallery", alsoAsked: "move the map above the hours" } });
    const label = "held-unread (" + mode + ")";
    assert.equal(r.reply.ok, false, label);
    assert.equal(r.reply.error, "held-unread", label + ": " + JSON.stringify(r.reply));
    assert.equal(Object.hasOwn(r.reply, "deferred"), false, label + ": a part nobody took out was named as put off");
    assert.deepEqual(r.calls, [], label + ": a model was called");
    assert.deepEqual(r.stored, { "index.tsx": HOME, "gallery.tsx": GALLERY, "visit.tsx": VISIT }, label);
  });

  test("W7 — a success names the part put off, and the page step runs the rest alone (" + mode + ")", async () => {
    const ask = "Take the photo off the gallery page and add a page for our cake orders.";
    const r = await drive({ mode, ask, routed: { layer: "page", page: "/gallery", alsoAsked: HELD } });
    const label = "success (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    assert.equal(r.reply.deferred, HELD, label + ": the success does not name the part put off");
    assertSite(r, { "index.tsx": HOME, "gallery.tsx": takePhoto(GALLERY), "visit.tsx": VISIT }, label);
  });

  test("W24 — a hand-over is checked against the fixed lists and recorded where it arrives (" + mode + ")", async () => {
    const r = await drive({
      mode, routed: { layer: "page", page: "/gallery", handedOff: true,
        handOver: { from: "picture", reason: "needs-place", field: "nonsense", page: "/gallery", extra: "dropped" } },
    });
    const label = "hand-over recorded (" + mode + ")";
    assert.equal(r.reply.ok, true, label + ": " + JSON.stringify(r.reply));
    const mark = r.traces.find((t) => t.phase === "handover");
    assert.ok(mark, label + ": the route did not record the hand-over: " + JSON.stringify(r.traces.map((t) => t.phase)));
    // ONLY THE FIELDS THAT PASSED: a field not on the lists is not carried, and
    // nothing the request added rides through.
    assert.deepEqual(mark.detail, { from: "picture", reason: "needs-place", page: "/gallery" }, label);
  });
}
