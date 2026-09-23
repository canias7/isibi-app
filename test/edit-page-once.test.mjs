// ONE PAGE OPERATION FOR NEIGHBOURING PAGE LANES (2026-09-23).
//
// Owner: *"Reproduce one look request whose selected fields include shape and
// components, both targeting the same page. Measure how many page-writer
// calls, compilations and charges it causes, and whether the second execution
// repeats or reverses the first. For compatible changes to the same page,
// prepare one page operation carrying both requested changes. Preserve
// genuinely different page targets and operations that require separate
// ordering."*
//
// THE DEFECT, MEASURED THROUGH THIS ROUTE BEFORE THE FIX (supplied answers):
//
//   `components` and `shape` both dispatch to the page rung, and the look door
//   pushed one step per lane. The page rung reads the customer's sentence and
//   none of the lane names, so the message was ONE operation run TWICE on one
//   page, the second run shown the first one's output:
//
//     a swap ("swap the opening hours and the market times")
//       2 page-writer calls · 1 compile · the publication carried the ORIGINAL
//       page (the second run swapped it back) · billed 3 + 2 on the
//       synchronous path, reserved 3 then 2 on the job path · the screen said
//       "✅ Updated the look."
//     a placement ("put the market times at the top")
//       3 page-writer calls (the second run's cheap writer found nothing to do,
//       then its full writer returned the page unchanged) · 1 compile · the
//       change shipped · the screen added a false "I read the / page and
//       couldn't find a change to make for that."
//
// WHAT EVERY ROUTE CASE ASSERTS, per the owner's acceptance: the real
// `POST /api/site/<slug>/edit` driven with every model answer SUPPLIED; both
// requested changes in the compiler payload AND the store; the unrelated page
// byte-identical in both; the customer's screen composed by the browser's own
// handler (`editBrowserReply`); and the money — one charge, equal to what the
// same message costs with ONE page lane picked, so no duplicate page operation
// is billed. Single-lane messages are the controls.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. The page writers are stubs that apply the
// request to whatever file they are SHOWN — which is what makes a repeated
// execution visible — so what is established is the route's handling of one
// operation against two. Whether a real model applies both changes correctly
// in one call is a separate question and is not asked here.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM — a hand-typed name is
// a stub that never matches.
import { pickTool, mergePageSteps, laneLayer, LANE_FIELDS } from "../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { PICTURE_TOOL } from "../builder/site-picture.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible "✅ Done." for an edit body rather than throwing.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = { pick: pickTool().name, tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name, picture: PICTURE_TOOL.name };
const USER = { id: "u-once-1", email: "owner@example.com" };

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE: a home page with three sections, and a gallery nobody asks about
// ─────────────────────────────────────────────────────────────────────────────

const page = (route, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
const HERO = "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>";
const HOURS = "<section className=\"hours\"><h2>Opening hours</h2><p>Open from 7am on weekdays.</p></section>";
const MARKET = "<section className=\"market\"><h2>When to find us</h2><p>Saturday market, eight till noon.</p></section>";
const HOME = page("/", HERO + HOURS + MARKET);
const GALLERY = page("/gallery", "<section className=\"grid\"><h2>From the ovens</h2><p>Loaves, buns and the odd pie.</p></section>");

// THE TWO REQUESTED CHANGES, each computed from the file the writer is SHOWN.
//   swap — a LAYOUT change: the hours and the market trade places. Applied
//          twice it is undone, which is how a second execution loses it.
//   card — a COMPONENT change: the hours section becomes a card. Idempotent,
//          so a second execution leaves it standing — which is exactly why the
//          old path shipped one of the two changes and lost the other.
// ⚠ EACH SECTION IS FOUND BY ITS CLASS, NOT BY ITS WHOLE TEXT. The first cut
// matched the literal `HOURS` string, which `card` changes — so on a page the
// first execution had already carded, the swap matched nothing, and "applied
// twice" read as "applied once": a fixture that could not see the defect it
// exists for. The discriminating assertions in case 1 are what caught it.
const block = (src, cls) => {
  const m = src.match(new RegExp("<section className=\"" + cls + "\"[^>]*>.*?</section>"));
  return m ? m[0] : null;
};
const swap = (src) => {
  const h = block(src, "hours"), m = block(src, "market");
  return h && m ? src.replace(h, "\u0000").replace(m, h).replace("\u0000", m) : src;
};
const card = (src) => src.replace("<section className=\"hours\">", "<section className=\"hours\" data-slot=\"card\">");
const BOTH = (src) => card(swap(src));
const ASK = "Swap the opening hours and the market times on the home page, and show the opening hours as a card.";
// THE PLACEMENT SHAPE — the one whose second execution REPEATS rather than
// reverses: applied to a page that already has it, it changes nothing.
const toTop = (src) => (src.includes("<main>" + MARKET) ? src : src.replace(MARKET, "").replace("<main>", "<main>" + MARKET));
const TOP_ASK = "Put the market times at the top of the home page.";

/** The file a cheap-writer (`write_tweak`) call was shown: its prompt carries it after "THE FILE (". */
function shownFile(body) {
  const content = String((body && body.messages && body.messages[0] && body.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2) };
}

function bucket(slug, home = HOME) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: home }, { path: "gallery.tsx", source: GALLERY }])],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: { brand: "Harbour Loaf", theme: "broadsheet" }, css: "" })],
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
 * ONE MESSAGE THROUGH THE REAL ROUTE, on either money path.
 *
 * `sync` posts to the route and reads `use_credits`; `job` stores the request
 * the way the route files it and hands its id to the REAL queue consumer, with
 * the `edit_*` RPCs faked, and reads `edit_reserve`. A model tool with no
 * answer is recorded and then refused (503), so a case can only pass on the
 * calls it names — and the call is in the log either way, which is what lets
 * the ordering case see a rung it did not answer.
 */
async function drive({ mode = "sync", fields, apply = BOTH, ask = ASK, home = HOME }) {
  const slug = "once-" + mode + "-" + fields.join("-") + "-" + hex32().slice(0, 6);
  const b = bucket(slug, home);
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "/", remove: false, rename: "", tab: false, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { calls: [], shown: [], rpc: [], debits: [] };
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
    if (u.includes("/rpc/credit_back")) { seen.rpc.push({ fn: "credit_back", args }); return new Response(null, { status: 204 }); }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      const usage = { input_tokens: 1000, output_tokens: 500 };
      if (tool === T.pick) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { fields } }], usage });
      if (tool === T.tweak) {
        const f = shownFile(args);
        seen.shown.push(f && f.source);
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: { source: apply(f.source) } }], usage });
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
    let reply = null, status = 0, ok = false;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      const fin = seen.rpc.find((r) => r.fn === "edit_finalize");
      assert.ok(fin, "the queued job never finalized: " + JSON.stringify(seen.rpc.map((r) => r.fn)));
      reply = JSON.parse(fin.args.p_result.body);
      status = fin.args.p_result.status;
      ok = status >= 200 && status < 300;
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      status = res.status; ok = res.ok;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const payloads = c.calls.map((k) => (k.body && k.body.files) || {});
    const sent = (files, name) => {
      const key = Object.keys(files).find((p) => p === name || p.endsWith("/" + name));
      return key === undefined ? undefined : files[key];
    };
    const stored = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    return {
      status, reply, calls: seen.calls, shown: seen.shown, compiles: c.calls.length,
      sentHome: payloads.map((f) => sent(f, "index.tsx")),
      sentGallery: payloads.map((f) => sent(f, "gallery.tsx")),
      storedHome: (stored.find((p) => p.path === "index.tsx") || {}).source,
      storedGallery: (stored.find((p) => p.path === "gallery.tsx") || {}).source,
      storedPaths: stored.map((p) => p.path),
      debits: seen.debits,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => ({ seq: r.args.p_seq, cost: Number(r.args.p_cost) })),
      finalized: seen.rpc.filter((r) => r.fn === "edit_finalize").map((r) => r.args.p_ok),
      refunds: seen.rpc.filter((r) => r.fn === "edit_refund" || r.fn === "credit_back").length,
      // THE CUSTOMER'S SCREEN, from the browser's own handler — with the routing
      // reply's cost handed in, as `siteEdit` hands it.
      said: editBrowserReply(reply, ok, { cost: 2 }),
    };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const pageWriterCalls = (r) => r.calls.filter((t) => t === T.tweak || t === T.pages);

/** What every successful single-operation outcome shares, asserted in one place so the cases cannot drift apart. */
function assertOneOperation(r, { expected, label }) {
  assert.equal(r.status, 200, label + ": the edit did not go through: " + JSON.stringify(r.reply));
  assert.equal(r.reply && r.reply.ok, true, label + ": the reply is not a success: " + JSON.stringify(r.reply));
  // ONE PAGE-WRITER CALL, and it was shown the page as stored — never a
  // version this same message had already changed.
  assert.deepEqual(pageWriterCalls(r), [T.tweak], label + ": the page writer ran more than once: " + JSON.stringify(r.calls));
  assert.deepEqual(r.shown, [HOME], label + ": the page writer was shown something other than the stored page");
  // ONE COMPILE, carrying the requested page and the untouched gallery.
  assert.equal(r.compiles, 1, label + ": compiles");
  assert.equal(r.sentHome[0], expected, label + ": the compiler was not handed the requested page");
  assert.equal(r.sentGallery[0], GALLERY, label + ": the gallery reached the compiler changed");
  // THE STORE: the requested page, the gallery byte-identical, no page added or lost.
  assert.equal(r.storedHome, expected, label + ": the store does not hold the requested page");
  assert.equal(r.storedGallery, GALLERY, label + ": the gallery was rewritten");
  assert.deepEqual(r.storedPaths, ["index.tsx", "gallery.tsx"], label + ": the store's page list moved");
  // THE REPLY names one page rung, and no refused step rides beside it.
  assert.deepEqual(r.reply.layers, ["page"], label + ": layers");
  assert.equal(r.reply.partial, undefined, label + ": a step was reported as not done: " + JSON.stringify(r.reply.partial));
  // THE SCREEN is the page rung's own sentence — true, since only the page changed.
  assert.equal(r.said.ok, true, label + ": the browser could not compose a reply: " + r.said.why);
  assert.equal(r.said.text, "✅ Updated /.", label + ": the customer's sentence");
  assert.deepEqual(r.said.actions, ["refresh the credit balance"], label + ": the browser started something paid");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE REPRODUCTION, FIXED — both money paths
// ─────────────────────────────────────────────────────────────────────────────

test("shape + components on one page: one page operation carrying both changes, billed once (synchronous path)", async () => {
  assert.equal(laneLayer("shape"), "page");
  assert.equal(laneLayer("components"), "page");
  // THE FIXTURE DISCRIMINATES: the old path ran BOTH twice, which leaves the
  // card standing and the swap undone — a publication with one of the two
  // changes. Measured here with the fixture's own functions, so the case
  // cannot rot into a story about a difference that was never there.
  assert.notEqual(BOTH(BOTH(HOME)), BOTH(HOME), "applying the ask twice is the same as once, so this case discriminates nothing");
  assert.equal(BOTH(BOTH(HOME)), card(HOME), "the second execution no longer reverses the swap, so the fixture changed meaning");

  const control = await drive({ fields: ["shape"] });
  const r = await drive({ fields: ["shape", "components"] });
  assertOneOperation(r, { expected: BOTH(HOME), label: "shape+components" });
  // BOTH REQUESTED CHANGES SURVIVE, each checked on its own, so a
  // publication carrying one of them cannot pass.
  assert.ok(r.storedHome.includes(MARKET.slice(0, 30)) && r.storedHome.indexOf("className=\"market\"") < r.storedHome.indexOf("className=\"hours\""),
    "the layout change (the swap) did not survive");
  assert.ok(r.storedHome.includes("data-slot=\"card\""), "the component change (the card) did not survive");
  // BOTH LANES ARE STILL NAMED — the merged step carries every field.
  assert.deepEqual(r.reply.lanes, ["components", "shape"], "the reply no longer names both lanes: " + JSON.stringify(r.reply.lanes));
  // NO DUPLICATE PAGE OPERATION IS BILLED: exactly one debit, it is the whole
  // cost the reply reports, and it is what the same message costs with ONE
  // page lane picked.
  assert.equal(r.debits.length, 1, "the page operation was billed more than once: " + JSON.stringify(r.debits));
  assert.equal(r.debits[0], r.reply.cost, "the debit and the reported cost disagree");
  assert.deepEqual(r.debits, control.debits, "two page lanes cost more than one: " + JSON.stringify({ two: r.debits, one: control.debits }));
  assert.equal(r.refunds, 0, "something was refunded on a message that succeeded");
});

test("shape + components on one page: one reservation on the job path, the same publication", async () => {
  const control = await drive({ mode: "job", fields: ["shape"] });
  const r = await drive({ mode: "job", fields: ["shape", "components"] });
  assertOneOperation(r, { expected: BOTH(HOME), label: "job shape+components" });
  // ONE SEQUENCED HOLD, where the old path took two (3, then 2).
  assert.deepEqual(r.reserves.map((x) => x.seq), [1], "the job path reserved more than once: " + JSON.stringify(r.reserves));
  assert.equal(r.reserves[0].cost, r.reply.cost, "the reservation and the reported cost disagree");
  assert.deepEqual(r.reserves, control.reserves, "two page lanes reserved more than one: " + JSON.stringify({ two: r.reserves, one: control.reserves }));
  assert.deepEqual(r.finalized, [true], "the job did not finalize as a success");
  assert.equal(r.refunds, 0, "something was refunded on a message that succeeded");
});

test("a placement asked through shape + components: one operation, and no false 'couldn't find a change'", async () => {
  // THE REPEAT SHAPE: the old second execution was shown a page that already
  // had the market at the top, its cheap writer found nothing to do, its full
  // writer returned the page unchanged, and the screen added a refusal for a
  // change that had shipped.
  assert.equal(toTop(toTop(HOME)), toTop(HOME), "the placement is not idempotent, so this case is the swap case again");
  const control = await drive({ fields: ["components"], apply: toTop, ask: TOP_ASK });
  const r = await drive({ fields: ["shape", "components"], apply: toTop, ask: TOP_ASK });
  assertOneOperation(r, { expected: toTop(HOME), label: "placement" });
  assert.ok(!r.said.text.includes("couldn't find a change"), "a refusal was reported beside a change that shipped: " + JSON.stringify(r.said.text));
  assert.deepEqual(r.debits, control.debits, "two page lanes cost more than one: " + JSON.stringify({ two: r.debits, one: control.debits }));
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE CONTROLS — a single page lane behaves exactly as it always did
// ─────────────────────────────────────────────────────────────────────────────

test("controls: shape alone and components alone each run one page operation", async () => {
  for (const fields of [["shape"], ["components"]]) {
    const r = await drive({ fields });
    assertOneOperation(r, { expected: BOTH(HOME), label: fields[0] + " alone" });
    assert.deepEqual(r.reply.lanes, fields, "a single lane is reported as more than itself");
    assert.equal(r.debits.length, 1, fields[0] + " alone was billed more than once");
    assert.equal(r.debits[0], r.reply.cost);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. WHAT MUST STAY APART — a rung between two page lanes keeps its place
// ─────────────────────────────────────────────────────────────────────────────

test("two page lanes with the picture rung between them stay two operations, in their order", async () => {
  // `LANE_FIELDS` puts `components` (page) before `images` (picture) and
  // `tsx` (page) after. Joining the two page steps would move one of them
  // across the picture rung — and that order is load-bearing: the picture
  // rung's work reaches a later page step through `eSrc`, which is what the
  // photograph protection reads. So they stay two steps.
  //
  // ⚠ WHAT THE SECOND EXECUTION THEN DOES IS THE RECORDED REMAINDER and is
  // deliberately NOT asserted here: it is shown the first one's output and
  // runs the same sentence again. Only the ORDER is this case's subject.
  const order = ["components", "images", "tsx"].map((f) => LANE_FIELDS.indexOf(f));
  assert.ok(order[0] < order[1] && order[1] < order[2], "the lane order no longer puts the picture lane between these two page lanes");
  // A PHOTOGRAPH ON THE PAGE, so the picture rung has a slot and calls its
  // model — which puts that rung in the call log, between the two page calls.
  // Its tool is left unanswered: refused, recorded, charged nothing.
  const photo = "<SafeImage src=\"/u/once/bench.jpg\" alt=\"the bench\" />";
  const withPhoto = HOME.replace("<p>Bread from the harbour, every morning.</p>", "<p>Bread from the harbour, every morning.</p>" + photo);
  const r = await drive({ fields: ["components", "images", "tsx"], home: withPhoto });
  const relevant = r.calls.filter((t) => t === T.tweak || t === T.pages || t === T.picture);
  assert.deepEqual(relevant, [T.tweak, T.picture, T.tweak],
    "the page operations were joined or reordered across the picture rung: " + JSON.stringify(r.calls));
  assert.equal(r.shown.length, 2);
  assert.equal(r.shown[0], withPhoto, "the first page operation was not shown the stored page");
  assert.equal(r.shown[1], BOTH(withPhoto), "the second page operation did not run on the first one's output, so the order is not the one the lanes set");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE RULE ITSELF — `mergePageSteps`, driven
// ─────────────────────────────────────────────────────────────────────────────

const P = (f, pg = "/") => ({ layer: "page", page: pg, fields: [f] });

test("mergePageSteps joins neighbouring page steps on one page, in order, carrying every field", () => {
  assert.deepEqual(mergePageSteps([P("components"), P("shape")]), [{ layer: "page", page: "/", fields: ["components", "shape"] }]);
  // Three in a row are one, and a look step ahead of them is untouched.
  const look = { layer: "look", page: "", fields: ["css"] };
  assert.deepEqual(mergePageSteps([look, P("purpose"), P("components"), P("shape")]),
    [look, { layer: "page", page: "/", fields: ["purpose", "components", "shape"] }]);
  // A field is never carried twice.
  assert.deepEqual(mergePageSteps([P("shape"), P("shape")]), [P("shape")]);
  // THE INPUT IS NOT MUTATED — the caller's list is its own.
  const input = [P("components"), P("shape")];
  const copy = JSON.stringify(input);
  mergePageSteps(input);
  assert.equal(JSON.stringify(input), copy, "the caller's steps were changed in place");
  // Nothing to join comes back as the same steps in the same order.
  const alone = [look, P("shape")];
  assert.deepEqual(mergePageSteps(alone), alone);
  assert.deepEqual(mergePageSteps([]), []);
  assert.deepEqual(mergePageSteps(null), []);
});

test("mergePageSteps keeps apart what is a different operation", () => {
  const pic = { layer: "picture", page: "", fields: ["images"] };
  // ANOTHER RUNG BETWEEN: no step moves across it.
  assert.deepEqual(mergePageSteps([P("components"), pic, P("tsx")]), [P("components"), pic, P("tsx")]);
  // A STEP WITH ITS OWN ASK (the QR placement's fixed text).
  const qr = { layer: "page", page: "/", fields: ["qr"], instruction: "place the code" };
  assert.deepEqual(mergePageSteps([P("components"), qr]), [P("components"), qr]);
  // …and the rule is the ASK, not the field: a dispatched lane carrying an ask stays apart too.
  const asked = { ...P("shape"), instruction: "something fixed" };
  assert.deepEqual(mergePageSteps([P("components"), asked]), [P("components"), asked]);
  // A `pages` VERB STEP — a removal or a move is another branch of the rung.
  const verb = { layer: "page", page: "/", fields: ["pages"] };
  assert.equal(laneLayer("pages"), null, "the pages lane dispatches by name now, so the verb rule needs looking at");
  assert.deepEqual(mergePageSteps([P("shape"), verb]), [P("shape"), verb]);
  // A DIFFERENT PAGE.
  assert.deepEqual(mergePageSteps([P("shape", "/"), P("tsx", "/menu")]), [P("shape", "/"), P("tsx", "/menu")]);
  // A step on another rung with a page lane's name is not a page step.
  const odd = { layer: "look", page: "/", fields: ["shape"] };
  assert.deepEqual(mergePageSteps([P("shape"), odd]), [P("shape"), odd]);
});
