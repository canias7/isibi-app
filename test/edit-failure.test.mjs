// EVERY WAY THE EDIT ROUTE DECLINES, CLASSIFIED — AND WHAT THE CUSTOMER'S
// SCREEN THEN DOES (2026-09-23).
//
// Owner, after reproducing two of them independently through the edit route
// and the browser handler: *"Both produce no customer sentence and would start
// the full paid rewrite. Fix this failure handling first."*
//
//   1. Removing a page the site does not have must end with an accurate
//      explanation and no paid follow-up.
//   2. When every step of a message is refused, surface their explanations —
//      never discard `partial[].msg` and fall through to a rewrite.
//   3. The incomplete-database and component-only-photo cases resolve through
//      an existing capable path; where none exists, the limitation is said.
//   4. Successful edits and partial-success reporting keep working, and the
//      edit's charge is told apart from the routing call's.
//
// THE SHAPE OF EVERY ROUTE CASE BELOW IS THE OWNER'S ACCEPTANCE: the real
// `POST /api/site/<slug>/edit` is driven, then the real browser handler
// (`editBrowserReply` runs `public/chat.js`'s own `editAnswer` with its paid
// arms injected as RECORDERS), and each case asserts the final stored source,
// the response, the sentence on the screen and every follow-up action the
// browser would start. The controls — a successful edit, a partial success and
// each legitimate escalation — are in the same file so the fix cannot pass by
// turning everything off: a refusal that says a sentence and a climb the
// browser acts on are both asserted, side by side.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer is SUPPLIED per tool, so
// what is established is the route's and the browser's handling of each
// answer — never that a real model answers that way. And every case runs the
// SYNCHRONOUS path; on the job path the consumer refunds whatever a refused
// reply reserved (`edit_refund`), which is why the merge reports a refused
// message's cost as 0 there. That half is read, not driven here.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { EDIT_FAILURES, editFailure, failureMsg, stepMsg, pageList, reasonsOf } from "../builder/edit-failure.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM — a hand-typed name is
// a stub that never matches, and a case that "fails" for a reason unrelated to
// its subject.
import { pickTool, editTool } from "../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { TEXT_TOOL, DATA_TOOL, MAX_TEXT_ITEMS } from "../builder/site-apply.mjs";
import { PICTURE_TOOL } from "../builder/site-picture.mjs";
// THE PATH A COMPONENT IS SHOWN UNDER, from the one function that makes it —
// a hand-typed path is a slot the model's answer can never match.
import { partPath } from "../builder/site-files.mjs";
import { RENAME_TOOL } from "../builder/site-alias.mjs";
// ⚠ `editBrowserReply`, NOT `browserReply` — the add composer answers a
// plausible "✅ Done." for an edit body rather than throwing.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = {
  pick: pickTool().name,
  lane: editTool("css").name,
  tweak: TWEAK_TOOL.name,
  pages: SITE_PAGES_TOOL.name,
  text: TEXT_TOOL.name,
  data: DATA_TOOL.name,
  picture: PICTURE_TOOL.name,
  rename: RENAME_TOOL.name,
};

// ─────────────────────────────────────────────────────────────────────────────
// THE HARNESS
// ─────────────────────────────────────────────────────────────────────────────

const USER = { id: "u-editfail-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SOURCE_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";
const PROJECT_CONN = "postgres://u:p@host.neon.tech/neondb";
const LOOK = { brand: "Harbour Loaf", theme: "broadsheet" };

// A PAGE IN THE SHAPE `validatePages` ACCEPTS — `createFileRoute(` is
// required, or a rung refuses for a reason that has nothing to do with the case.
const head = (route, imports = "") => "import { createFileRoute } from '@tanstack/react-router'\n" + imports
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n";
const page = (route, body, imports) => head(route, imports) + "function Page(){ return <main>" + body + "</main> }\n";
const SAFE_IMAGE = "import { SafeImage } from '@/components/ui/safe-image'\n";

/**
 * THE SITE'S STORE. `down` names keys whose READ throws — a store that blinked,
 * which is a different fact from a key that is absent. `list` answers the
 * owner's upload library and nothing else, as every other edit harness does.
 */
function bucket(slug, { pages, parts = [], config = { look: LOOK, css: "" }, uploads = [], down = [], downOnce = [] } = {}) {
  const store = new Map();
  if (pages !== undefined) store.set(SOURCE_KEY(slug), JSON.stringify(pages));
  store.set(PARTS_KEY(slug), JSON.stringify(parts));
  store.set(CONFIG_KEY(slug), JSON.stringify(config));
  for (const name of uploads) store.set("uploads/" + slug + "/" + name, "jpeg-bytes");
  return {
    store,
    async get(k) {
      if (down.includes(k)) throw new Error("R2 is unavailable");
      // A READ THAT BLINKS ONCE: the first read of the key throws, the next answers.
      const once = downOnce.indexOf(k);
      if (once >= 0) { downOnce.splice(once, 1); throw new Error("R2 blinked"); }
      const v = store.get(k);
      return v === undefined ? null : { text: async () => v, json: async () => JSON.parse(v) };
    },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list(o) {
      const prefix = String((o && o.prefix) || "");
      if (!prefix.startsWith("uploads/")) return { objects: [], truncated: false };
      return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 10 })), truncated: false };
    },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/** Every byte the store holds, in a comparable form. */
const snapshot = (b) => JSON.stringify([...b.store.entries()].sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0)));
const storedPages = (b, slug) => JSON.parse(b.store.get(SOURCE_KEY(slug)));
const storedParts = (b, slug) => JSON.parse(b.store.get(PARTS_KEY(slug)));

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

/**
 * THE WIRE. The model is answered per TOOL and a tool with no stub is refused
 * rather than given a plausible answer, so a case can only pass on the calls
 * it names. Every debit (`use_credits`) and every write to the site's backend
 * reference (`PATCH site_backends`) is recorded, never answered as a success
 * nobody asked for.
 */
function withWire(wire, run) {
  const real = globalThis.fetch;
  const seen = { calls: [], sql: [], patches: [], debits: [] };
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    const method = String((init && init.method) || "GET").toUpperCase();
    if (wire.route) { const hit = await wire.route(url, init); if (hit) return hit; }
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      seen.debits.push(want);
      return json(want);
    }
    if (url.includes("/rest/v1/site_backends")) {
      if (method === "PATCH") { seen.patches.push(url); return json([]); }
      return json(wire.backends || [{ uid: USER.id, brief: "", neon_db: "" }]);
    }
    if (url.includes("/rest/v1/site_project")) return json(wire.project || []);
    if (url.includes("/rest/v1/site_aliases")) return json([]);
    if (/neon\.tech|\/sql$/.test(url)) {
      let asked = "";
      try { asked = String(JSON.parse(String((init && init.body) || "{}")).query || ""); }
      catch { asked = String((init && init.body) || ""); }
      seen.sql.push(asked);
      const a = wire.sql ? wire.sql(asked) : { rows: [], fields: ["x"] };
      if (a.fail) return new Response("could not connect", { status: 500 });
      const fields = a.fields.map((n) => ({ name: n, dataTypeID: 25, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" }));
      return json({ command: "SELECT", rowCount: a.rows.length, rows: a.rows, fields });
    }
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      seen.calls.push(tool);
      if (!Object.hasOwn(wire.answers || {}, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      const a = wire.answers[tool];
      const input2 = typeof a === "function" ? a(seen.calls.filter((c) => c === tool).length - 1, body) : a;
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: input2 }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => {
    try { return await run(seen); } finally { globalThis.fetch = real; }
  })();
}

/**
 * THE ROUTING REPLY THE BROWSER HOLDS while the edit runs — `layer` decides
 * whether an escalate is a sideways hop, and `cost` is the routing call's own
 * charge, which the screen states beside the edit's. Two credits is what run 9
 * measured; any positive number exercises the clause.
 */
const ROUTED = (layer, pagePath) => ({ intent: "edit", layer, page: pagePath || "", cost: 2 });

/** One message through the real route, then through the browser's own handler. */
async function edit(slug, store, wire, body, extraEnv = {}) {
  const compiler = installCompiler();
  try {
    const worker = await loadWorker();
    return await withWire(wire, async (seen) => {
      const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: TOKEN },
        body: JSON.stringify({ layer: "", page: "", remove: false, rename: "", tab: false, picker: "sonnet", ...body }),
      });
      const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv(), ...extraEnv }, makeCtx());
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      const said = editBrowserReply(parsed, res.ok, ROUTED(body.layer, body.page));
      assert.ok(said.ok, "the browser's own handler could not run on this reply: " + said.why);
      return { status: res.status, body: parsed, said, seen, compiles: compiler.calls.length, compiled: compiler.calls };
    });
  } finally { compiler.uninstall(); }
}

// WHAT THE SCREEN ADDS on a reply whose every step wrote nothing — the edit's
// cost and the routing call's, as two amounts.
const NOTHING_CHANGED = " Nothing on your site changed, and this edit cost you nothing.";
const ROUTING_2 = " Reading your message cost 2 credits.";
const REWRITE = "start the FULL ~25-credit rewrite (the browser's `fallback`)";
const REFRESH = "refresh the credit balance";
/** Every action the browser would start that costs the customer something. */
const paid = (said) => said.actions.filter((a) => /PAID|rewrite/i.test(a));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * THE ASSERTIONS EVERY EXPLAINED REFUSAL SHARES — written once, because the
 * one written out six times is the one that drifts.
 */
function assertExplained(r, before, store, { key, facts, status = 422, ours = false, calls }) {
  const f = editFailure(key);
  assert.ok(f && f.cls === "explain", key + " is not an explained refusal in the table");
  assert.equal(r.status, status, key + ": the status is wrong");
  assert.equal(r.body.ok, false, key + ": the reply claims success");
  assert.equal(r.body.escalate, undefined, key + ": the reply still escalates, which the browser reads as a climb");
  assert.equal(r.body.error, f.reason, key + ": the reply names the wrong reason");
  assert.equal(r.body.cost, 0, key + ": the edit reported a cost");
  assert.equal(r.body.unchanged, true, key + ": the rung did not say it wrote nothing");
  assert.equal(r.body.ours, ours || undefined, key + ": `ours` is wrong");
  const msg = failureMsg(key, facts);
  assert.ok(msg.length > 20, key + ": the table has no sentence for this refusal");
  assert.equal(r.body.msg, msg, key + ": the reply's sentence is not the table's");
  // NOTHING WAS WRITTEN, NOTHING WAS COMPILED, NOTHING WAS DEBITED.
  assert.equal(snapshot(store), before, key + ": the store moved on a refusal");
  assert.equal(r.compiles, 0, key + ": something was compiled on a refusal");
  assert.deepEqual(r.seen.debits, [], key + ": a refusal that reports cost 0 debited credits");
  assert.deepEqual(r.seen.patches, [], key + ": a refusal wrote the site's backend reference");
  if (calls) assert.deepEqual(r.seen.calls, calls, key + ": the model calls are not the ones this refusal needs");
  // THE SCREEN: the sentence, then what the edit and the routing call cost,
  // and NOT ONE follow-up action — above all, no rewrite.
  assert.equal(r.said.shown, true, key + ": the browser showed nothing");
  assert.equal(r.said.text, "⚠️ " + msg + NOTHING_CHANGED + ROUTING_2, key + ": the screen does not say what happened");
  assert.deepEqual(r.said.actions, [], key + ": the browser started a follow-up on a refusal");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE TWO REPRODUCED FAILURES
// ─────────────────────────────────────────────────────────────────────────────

const TWO_PAGES = (slug) => [
  { path: "index.tsx", source: page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>") },
  { path: "news.tsx", source: page("/news", "<h1>News from the bakery</h1>") },
];

test("taking off a page the site does not have, through the lane picker, is a sentence and buys nothing", async () => {
  // THE OWNER'S FIRST REPRODUCTION, VERBATIM: "take the blog page off" on a
  // site with no blog page. The route escalated `no-page` with no layer, the
  // browser read that as `up`, and a full rewrite of every page started with
  // no sentence on the screen.
  const slug = "fail-remove-missing";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: { [T.pick]: { fields: ["pages"], removes: ["pages"], pageVerb: "remove", pageName: "/blog" } },
  }, { layer: "look", instruction: "Take the blog page off the site." });
  assertExplained(r, before, store, {
    key: "pages/no-page", facts: { page: "/blog", verb: "remove", routes: ["/", "/news"] }, calls: [T.pick],
  });
  // THE SENTENCE ITSELF, PINNED: accurate about what was asked, and naming the
  // pages the site really has.
  assert.equal(r.said.text,
    "⚠️ Your site doesn't have a /blog page, so there was nothing to take off. Its pages are / and /news."
    + " Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.");
});

test("taking off a page the site does not have, through the page rung, is the same sentence at no model call", async () => {
  const slug = "fail-remove-missing-page-rung";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: {} }, { layer: "page", page: "/blog", remove: true, instruction: "Delete the blog page." });
  assertExplained(r, before, store, {
    key: "page/no-page", facts: { page: "/blog", verb: "remove", routes: ["/", "/news"] }, calls: [],
  });
});

test("moving a page the site does not have says there is nothing to move", async () => {
  const slug = "fail-move-missing";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: { [T.pick]: { fields: ["pages"], pageVerb: "move", pageName: "/blog", pageTo: "/journal" } },
  }, { layer: "look", instruction: "Move the blog page to /journal." });
  assertExplained(r, before, store, {
    key: "pages/no-page", facts: { page: "/blog", verb: "move", routes: ["/", "/news"] }, calls: [T.pick],
  });
  assert.match(r.body.msg, /doesn't have a \/blog page to move\. Its pages are \/ and \/news\./);
});

test("an edit aimed at a page the site does not have lists the real ones and asks which (run 23's /book)", async () => {
  // Run 23: the router named `/book` from the sentence, the site has no such
  // page, and the reply escalated `no-page` — the full rewrite. Which page
  // gets targeted is its own next task; this case is only what the customer
  // is told when the named page is not there.
  const slug = "fail-edit-missing";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: {} }, { layer: "page", page: "/book", instruction: "Change the heading on the booking page." });
  assertExplained(r, before, store, { key: "page/no-page", facts: { page: "/book", verb: "", routes: ["/", "/news"] }, calls: [] });
  assert.equal(r.body.msg, "Your site doesn't have a /book page. Its pages are / and /news. Say which one you meant, or ask me to add a /book page.");
});

// A PAGE SHOWING ONE OF THE SITE'S OWN PHOTOGRAPHS, and the writer's answer
// that deletes the element outright — a loss `keepPhotos` has no slot to put
// back into, so every page step is WITHHELD.
const withPhoto = (slug) => head("/", SAFE_IMAGE) + "function Page(){ return <main><h1>Harbour Loaf</h1><section className=\"p-4\"><h2>The bench</h2>"
  + "<SafeImage src=\"/u/" + slug + "/3f2a.jpg\" alt=\"our workbench\" ratio={4/3} /></section></main> }\n";
const photoGone = (slug) => withPhoto(slug).replace("className=\"p-4\"", "className=\"p-8\"").replace(/<SafeImage[^>]*\/>/, "");

test("the owner's all-withheld reproduction is one page operation now, and it says why without a rewrite", async () => {
  // THE OWNER'S SECOND REPRODUCTION: `components` + `tsx` on a page showing a
  // photograph the writer's answer deletes. It used to run the page rung
  // TWICE — one step per lane — so both steps were withheld, the merged reply
  // carried the sentences in `partial[].msg` and none at the top, and the
  // browser's refusal branch, finding no `msg`, started the full rewrite of
  // every page.
  //
  // ⚠ RE-ANCHORED 2026-09-23 WITH THE ONE-OPERATION FIX (`mergePageSteps`,
  // `test/edit-page-once.test.mjs`). Neighbouring page lanes on one page are
  // ONE page operation, so this message is one step and its refusal is the
  // rung's own — 409, its own sentence at the top — and the screen reads
  // exactly what the merged reply was fixed to read: the sentence once, the
  // whole-request clause, and no follow-up. The merge's all-refused law is
  // still driven, through a shape that still runs two page steps: the next case.
  const slug = "fail-all-withheld";
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: withPhoto(slug) }] });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: {
      [T.pick]: { fields: ["components", "tsx"] },
      [T.tweak]: { cannot: "needs the page rewritten" },
      [T.pages]: () => ({ pages: [{ path: "src/routes/index.tsx", source: photoGone(slug) }] }),
    },
  }, { layer: "look", instruction: "Give the bench section more padding." });
  assert.equal(r.status, 409, "the single page step did not answer with its own refusal");
  assert.equal(r.body.ok, false);
  assert.equal(r.body.escalate, undefined, "the refusal escalates, which the browser would act on");
  assert.equal(r.body.error, "withheld");
  assert.equal(r.body.cost, 0, "a refused message reported a cost");
  assert.equal(r.body.photosBlocked, 1);
  assert.ok(typeof r.body.msg === "string" && r.body.msg.length > 40, "the refusal carries no sentence at the top");
  assert.equal(r.body.partial, undefined, "one page operation was reported as several steps");
  // ONE PAGE OPERATION: the cheap writer declined and the rewrite ran ONCE,
  // where the old path ran that pair twice.
  assert.deepEqual(r.seen.calls.filter((t) => t === T.tweak || t === T.pages), [T.tweak, T.pages],
    "the page rung ran more than once for one message: " + JSON.stringify(r.seen.calls));
  assert.equal(snapshot(store), before, "the store moved on a refused message");
  assert.equal(r.compiles, 0);
  assert.deepEqual(r.seen.debits, []);
  assert.equal(r.said.text, "⚠️ " + r.body.msg + NOTHING_CHANGED + ROUTING_2);
  assert.match(r.said.text, /taking a photograph off your site/);
  assert.deepEqual(r.said.actions, [], "a refused message started a follow-up");
});

test("when every step is refused, each says why — the steps' own sentences, once each, and no rewrite", async () => {
  // THE MERGE'S ALL-REFUSED LAW, still reachable: two page lanes with the
  // picture rung BETWEEN them stay two page operations (joining them would
  // move one across that rung), so this message runs three steps and every
  // one declines — the page writer finds nothing to change, twice, and the
  // picture rung finds no photograph. The two page steps write the SAME
  // sentence, and printing it twice would read as two problems.
  const slug = "fail-all-refused";
  const home = page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>");
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: home }] });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: {
      [T.pick]: { fields: ["components", "images", "tsx"] },
      [T.tweak]: { cannot: "needs the page rewritten" },
      [T.pages]: () => ({ pages: [{ path: "src/routes/index.tsx", source: home }] }),
    },
  }, { layer: "look", instruction: "Tidy the opening hours block and swap the photo." });
  assert.equal(r.status, 422, "a message that did nothing answered as if it had");
  assert.equal(r.body.ok, false);
  assert.equal(r.body.escalate, undefined, "the merged reply escalates, which the browser would act on");
  assert.equal(r.body.cost, 0, "a message whose every step was refused reported a cost");
  assert.equal(r.body.unchanged, true, "every step wrote nothing, and the reply does not say so");
  const noChange = failureMsg("page/no-change", { page: "/" });
  const noSlots = failureMsg("picture/no-slots");
  assert.deepEqual(r.body.partial.map((p) => p.msg), [noChange, noSlots, noChange], "each step's own sentence is not on the reply");
  for (const p of r.body.partial) assert.equal(p.unchanged, true, "a refused step is not recorded as having written nothing");
  // THE PAGE RUNG REALLY RAN TWICE — the premise of this case — with the
  // picture rung between; without it the dedupe below would be vacuous.
  assert.deepEqual(r.seen.calls.filter((t) => t === T.tweak || t === T.pages), [T.tweak, T.pages, T.tweak, T.pages],
    "this case's premise is two page operations, and they did not both run: " + JSON.stringify(r.seen.calls));
  assert.equal(snapshot(store), before, "the store moved on a message whose every step was refused");
  assert.equal(r.compiles, 0);
  assert.deepEqual(r.seen.debits, []);
  // THE SCREEN: each distinct sentence ONCE, in the order the steps ran, then
  // the whole-request clause — and not one follow-up.
  assert.equal(r.said.text, "⚠️ " + noChange + " " + noSlots + NOTHING_CHANGED + ROUTING_2);
  assert.deepEqual(r.said.actions, [], "a message whose every step was refused started a follow-up");
});

test("steps refused for different reasons each keep their own sentence", async () => {
  // A picture step that finds no photograph anywhere, beside a page step whose
  // writer changed nothing. Both used to escalate with no layer; both are said.
  const slug = "fail-mixed";
  const home = page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>");
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: home }] });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: {
      [T.pick]: { fields: ["images", "tsx"] },
      [T.tweak]: { cannot: "needs the page rewritten" },
      [T.pages]: () => ({ pages: [{ path: "src/routes/index.tsx", source: home }] }),
    },
  }, { layer: "look", instruction: "Swap the photo and tidy the opening hours block." });
  assert.equal(r.status, 422);
  assert.equal(r.body.cost, 0);
  assert.equal(r.body.unchanged, true);
  const noSlots = failureMsg("picture/no-slots");
  const noChange = failureMsg("page/no-change", { page: "/" });
  assert.deepEqual(r.body.partial.map((p) => p.msg), [noSlots, noChange], "each step's own sentence is not on the reply");
  assert.equal(r.said.text, "⚠️ " + noSlots + " " + noChange + NOTHING_CHANGED + ROUTING_2);
  assert.deepEqual(r.said.actions, []);
  assert.equal(snapshot(store), before);
  assert.deepEqual(r.seen.debits, []);
});

test("a lane picker that places the message nowhere asks which part, instead of rewriting every part", async () => {
  // "don't assume no-lane … proves a rewrite can safely solve the request."
  const slug = "fail-no-lane";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: { [T.pick]: { fields: [] } } }, { layer: "look", instruction: "Make it pop more." });
  assertExplained(r, before, store, { key: "picker/no-lane", facts: {}, calls: [T.pick] });
});

test("a look lane that could not express the change is said, not climbed", async () => {
  // The lane named nothing. The rewrite recompiles from the same stored look —
  // the route's own argument — so it could not express it either.
  const slug = "fail-look-no-change";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: { [T.pick]: { fields: ["css"] }, [T.lane]: {} },
  }, { layer: "look", instruction: "Make the site feel more premium." });
  assertExplained(r, before, store, { key: "look/no-change", facts: {}, calls: [T.pick, T.lane] });
});

test("a page writer that saw the page and changed nothing is said — the reversed 2026-09-20 control", async () => {
  // ⚠ THIS REVERSES A CONTROL: on 2026-09-20 a genuine no-change was kept
  // escalating to the rewrite. The page's own writer saw the page and the
  // request; a rewrite of EVERY page is no evidence it would do better, and it
  // risks the pages nobody asked about.
  const slug = "fail-page-no-change";
  const home = page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>");
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: home }] });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: {
      [T.tweak]: { cannot: "needs the page rewritten" },
      [T.pages]: () => ({ pages: [{ path: "src/routes/index.tsx", source: home }] }),
    },
  }, { layer: "page", page: "/", instruction: "Make the opening hours block feel friendlier." });
  assertExplained(r, before, store, { key: "page/no-change", facts: { page: "/" }, calls: [T.tweak, T.pages] });
});

test("a failure of ours is said as ours, never climbed: a missing model key and an unreadable store", async () => {
  // THE PICKED MODEL IS NOT SET UP: the rewrite runs on the same picker and
  // would meet the same missing key.
  {
    const slug = "fail-unconfigured";
    const store = bucket(slug, { pages: TWO_PAGES(slug) });
    const before = snapshot(store);
    const r = await edit(slug, store, { answers: {} }, { layer: "text", instruction: "Say we open at 8." }, { ANTHROPIC_API_KEY: "" });
    assertExplained(r, before, store, { key: "route/unconfigured", facts: {}, status: 503, ours: true, calls: [] });
  }
  // THE PAGES COULD NOT BE READ: a transient store failure bought a rewrite
  // that anchors on the very same store.
  {
    const slug = "fail-source-down";
    const store = bucket(slug, { pages: TWO_PAGES(slug), down: [SOURCE_KEY(slug)] });
    const before = snapshot(store);
    const r = await edit(slug, store, { answers: {} }, { layer: "text", instruction: "Say we open at 8." });
    assertExplained(r, before, store, { key: "route/no-source-unreadable", facts: {}, status: 503, ours: true, calls: [] });
  }
  // THE READ BLINKED ONCE: the repairing read answered nothing and a second,
  // bare read found the pages. They are NOT edited — that copy was never
  // repaired, and every read that publishes goes through the repair — so the
  // honest answer is the same "couldn't read just now", and above all not the
  // rewrite `no-source` would buy for a site that has pages.
  {
    const slug = "fail-source-blink";
    const store = bucket(slug, { pages: TWO_PAGES(slug), downOnce: [SOURCE_KEY(slug)] });
    const before = snapshot(store);
    const r = await edit(slug, store, { answers: {} }, { layer: "text", instruction: "Say we open at 8." });
    assertExplained(r, before, store, { key: "route/no-source-unreadable", facts: {}, status: 503, ours: true, calls: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE TWO REPORTED CASES — RESOLVED THROUGH AN EXISTING CAPABLE PATH
// ─────────────────────────────────────────────────────────────────────────────

// A `display` table with one row and a stored schema declaring it, answered in
// the serverless driver's shape (`rows` are arrays of VALUES).
const MENU_SPEC = { tables: [{ name: "menu", columns: [{ name: "item", type: "text" }, { name: "price", type: "text" }], read: "public", write: "none" }] };
const menuDb = ({ probeFails = false } = {}) => (q) => {
  if (probeFails) return { fail: true };
  if (/information_schema\.columns/i.test(q)) return { rows: [["menu", "id", "int"], ["menu", "item", "text"], ["menu", "price", "text"]], fields: ["t", "c", "ty"] };
  if (/_meta/i.test(q) && /schema/i.test(q)) return { rows: [[JSON.stringify(MENU_SPEC)]], fields: ["v"] };
  if (/FROM "menu"/i.test(q)) return { rows: [[1, "Sourdough", "£4.50"]], fields: ["id", "item", "price"] };
  return { rows: [], fields: ["x"] };
};
const INCOMPLETE = { backends: [{ uid: USER.id, brief: "", neon_db: "" }], project: [{ uid: USER.id, neon_conn: PROJECT_CONN }] };

test("the data rung on an incomplete site changes the row through the four-state reader, and writes no reference", async () => {
  // THE REPORTED CASE: the database is real and `site_backends.neon_db` is
  // blank. The fast reader answers `null`, and the rung escalated with no
  // layer — a rewrite of every page, which cannot change a row at all.
  const slug = "fail-data-incomplete";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    ...INCOMPLETE, sql: menuDb(),
    answers: { [T.data]: { changes: [{ table: "menu", id: 1, values: { price: "£5" } }] } },
  }, { layer: "data", instruction: "Change the price of the sourdough to £5." });
  assert.equal(r.status, 200, "the change did not go through: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.layer, "data");
  assert.deepEqual(r.body.applied, [{ table: "menu", id: 1, columns: ["price"] }]);
  // THE ROW REALLY CHANGED, through the connection the four-state reader proved.
  const update = r.seen.sql.find((q) => /^UPDATE "menu" SET "price" = /.test(q));
  assert.ok(update, "no UPDATE reached the database");
  assert.ok(r.seen.sql.some((q) => /^SELECT 1$/.test(q.trim())), "the derived connection was used without being proved");
  // NOTHING IS WRITTEN BACK: an incomplete reference is the backend repair's.
  assert.deepEqual(r.seen.patches, [], "the data rung wrote the site's backend reference");
  // A ROW IS LIVE THE MOMENT IT COMMITS — nothing is recompiled or republished.
  assert.equal(r.compiles, 0);
  assert.equal(snapshot(store), before);
  // THE CHARGE IS WHAT WAS DEBITED.
  assert.ok(r.body.cost > 0, "a successful edit reported no cost");
  assert.equal(sum(r.seen.debits), r.body.cost, "the reply's cost is not what was debited");
  assert.match(r.said.text, /^✅/, "the screen does not report a made change");
  assert.deepEqual(r.said.actions, [REFRESH]);
});

test("the data rung with no database at all hops to the words — a legitimate escalation, bounded", async () => {
  // CONTROL: a site that genuinely has no database. The words the customer
  // means are in the page source, and the text rung changes words for ~1
  // credit — a hop the browser takes, never the rewrite.
  const slug = "fail-data-none";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: {} }, { layer: "data", instruction: "Change the price of the sourdough to £5." });
  assert.equal(r.status, 200);
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "no-backend");
  assert.equal(r.body.layer, "text");
  assert.equal(editFailure("data/no-backend").cls, "hop");
  assert.equal(snapshot(store), before);
  assert.equal(r.said.shown, false, "the browser printed a sentence instead of acting on a hop");
  assert.deepEqual(r.said.actions, ['post a SECOND, PAID request to the edit route (layer "text")']);
});

test("the data rung on a database it cannot reach says so, and buys nothing", async () => {
  const slug = "fail-data-down";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { ...INCOMPLETE, sql: menuDb({ probeFails: true }), answers: {} },
    { layer: "data", instruction: "Change the price of the sourdough to £5." });
  assertExplained(r, before, store, { key: "data/backend-unreadable", facts: {}, status: 503, ours: true, calls: [] });
  assert.equal(r.body.backend, "derived-database-unreachable");
});

// A HOME PAGE WHOSE ONLY PHOTOGRAPH LIVES IN ONE OF THE SITE'S OWN COMPONENTS
// — where the band split puts a section.
const PART_HOME = head("/", "import PhotoWall from './-parts/photo-wall'\n")
  + "function Page(){ return <main><h1>Harbour Loaf</h1><PhotoWall /></main> }\n";
const wallWith = (slug, file) => SAFE_IMAGE + "export default function PhotoWall(){ return <section><h2>The bench</h2>"
  + "<SafeImage src=\"/u/" + slug + "/" + file + "\" alt=\"our workbench\" ratio={4/3} /></section> }\n";

test("a photograph that lives only in a component is swapped where it lives, and the pages are untouched", async () => {
  // THE REPORTED CASE: the picture rung read the pages alone, found no slot,
  // and escalated `no-slots` with no layer — the rewrite of every page, to
  // swap one picture.
  const slug = "fail-picture-part";
  const store = bucket(slug, {
    pages: [{ path: "index.tsx", source: PART_HOME }],
    parts: [{ name: "photo-wall", source: wallWith(slug, "3f2a.jpg") }],
    uploads: ["window.jpg"],
  });
  const r = await edit(slug, store, {
    answers: { [T.picture]: { pictures: [{ page: partPath("photo-wall"), alt: "our workbench", file: "window.jpg" }] } },
  }, { layer: "picture", instruction: "Swap the workbench photo for the one of our window display." });
  assert.equal(r.status, 200, "the swap did not go through: " + JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.layer, "picture");
  // THE COMPONENT CARRIES THE NEW PICTURE — in what was compiled AND in what
  // was stored — and the page is byte for byte what it was.
  assert.equal(r.compiles, 1);
  const sent = r.compiled[0].body;
  const sentWall = (sent.parts || []).find((p) => p.name === "photo-wall");
  assert.ok(sentWall && sentWall.source.includes("/u/" + slug + "/window.jpg"), "the compiled component does not carry the new photograph");
  assert.ok(!sentWall.source.includes("3f2a.jpg"), "the old photograph is still in the compiled component");
  assert.equal(storedParts(store, slug).find((p) => p.name === "photo-wall").source, wallWith(slug, "window.jpg"),
    "the stored component is not the swapped one");
  assert.equal(storedPages(store, slug)[0].source, PART_HOME, "a page moved on a component's photograph swap");
  assert.equal(sum(r.seen.debits), r.body.cost, "the reply's cost is not what was debited");
  assert.match(r.said.text, /^✅/);
  assert.deepEqual(r.said.actions, [REFRESH]);
});

test("a site with no photograph anywhere is told how to ask for one, and nothing is bought", async () => {
  const slug = "fail-picture-none";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: {} }, { layer: "picture", instruction: "Swap the workbench photo." });
  assertExplained(r, before, store, { key: "picture/no-slots", facts: {}, calls: [] });
});

test("components that cannot be read are the store's fault, not a site with no photographs", async () => {
  // ⚠ AND THE ONE WRONG ANSWER HERE WOULD BE "YOUR SITE HAS NO PHOTOGRAPH":
  // it may well be in a component nobody could read.
  const slug = "fail-picture-parts-down";
  const store = bucket(slug, {
    pages: [{ path: "index.tsx", source: PART_HOME }],
    parts: [{ name: "photo-wall", source: wallWith(slug, "3f2a.jpg") }],
    down: [PARTS_KEY(slug)],
  });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: {} }, { layer: "picture", instruction: "Swap the workbench photo." });
  assertExplained(r, before, store, { key: "picture/parts-unreadable", facts: {}, status: 503, ours: true, calls: [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE CONTROLS — SUCCESS, PARTIAL SUCCESS, AND EVERY KIND OF LEGITIMATE CLIMB
// ─────────────────────────────────────────────────────────────────────────────

test("control: an ordinary wording edit publishes, and the screen reports it", async () => {
  const slug = "ctl-text";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const r = await edit(slug, store, {
    answers: { [T.text]: { edits: [{ id: 1, to: "Open from 8am on weekdays" }] } },
  }, { layer: "text", instruction: "We open at 8 now, not 7." });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.compiles, 1);
  const home = storedPages(store, slug).find((p) => p.path === "index.tsx").source;
  assert.ok(home.includes("Open from 8am on weekdays") && !home.includes("7am"), "the stored page does not carry the change");
  assert.equal(storedPages(store, slug).find((p) => p.path === "news.tsx").source, TWO_PAGES(slug)[1].source, "an unrelated page moved");
  assert.ok(r.body.cost > 0);
  assert.equal(sum(r.seen.debits), r.body.cost, "the reply's cost is not what was debited");
  assert.match(r.said.text, /^✅/);
  assert.ok(!r.said.text.includes("Nothing on your site changed"), "a published edit is reported as changing nothing");
  assert.deepEqual(r.said.actions, [REFRESH]);
});

test("control: a partial success keeps its green tick and names the half that did not happen", async () => {
  // One step lands (the stylesheet), one is refused (the page writer changed
  // nothing). The refusal's sentence rides after the tick, and the
  // whole-request clause does NOT — part of the site did change.
  const slug = "ctl-partial";
  const home = page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>");
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: home }] });
  const r = await edit(slug, store, {
    answers: {
      [T.pick]: { fields: ["css", "tsx"] },
      [T.lane]: { css: "[data-slot=\"site-footer\"]{background:#1f2a44;color:#fff}" },
      [T.tweak]: { cannot: "needs the page rewritten" },
      [T.pages]: () => ({ pages: [{ path: "src/routes/index.tsx", source: home }] }),
    },
  }, { layer: "look", instruction: "Make the footer navy and tidy the opening hours block." });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.unchanged, undefined, "a message that shipped a change claims it changed nothing");
  const noChange = failureMsg("page/no-change", { page: "/" });
  assert.deepEqual((r.body.partial || []).map((p) => p.msg), [noChange]);
  assert.equal(JSON.parse(store.store.get(CONFIG_KEY(slug))).css.includes("#1f2a44"), true, "the stylesheet change was not stored");
  assert.match(r.said.text, /^✅/);
  assert.ok(r.said.text.includes(" ⚠️ " + noChange), "the refused half is not named after the tick");
  assert.ok(!r.said.text.includes("Nothing on your site changed"), "a partial success claims nothing changed");
  assert.equal(sum(r.seen.debits), r.body.cost, "the reply's cost is not what was debited");
  assert.deepEqual(r.said.actions, [REFRESH]);
});

test("control: too much wording for one-at-a-time edits still climbs to the rewrite", async () => {
  // A LEGITIMATE `up`: the rung itself established the change is beyond it.
  const slug = "ctl-too-much";
  const many = Array.from({ length: MAX_TEXT_ITEMS + 10 }, (_, i) => "<p>Line number " + i + " of the menu</p>").join("");
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: page("/", many) }] });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: {} }, { layer: "text", instruction: "Reword the menu." });
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "too-much-text");
  assert.equal(r.body.layer, undefined, "a climb to the rewrite names a layer");
  assert.equal(editFailure("text/too-much-text").cls, "up");
  assert.equal(snapshot(store), before);
  assert.deepEqual(r.seen.calls, []);
  assert.equal(r.said.shown, false);
  assert.deepEqual(r.said.actions, [REWRITE]);
});

test("control: changing what kind of site this is climbs to the rebuild", async () => {
  const slug = "ctl-kind";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: { [T.pick]: { fields: ["kind"] } } }, { layer: "look", instruction: "Turn this into a booking tool instead of a shop." });
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "build");
  assert.equal(editFailure("picker/build").cls, "up");
  assert.equal(snapshot(store), before);
  assert.deepEqual(r.said.actions, [REWRITE]);
});

test("control: a site from before designs were stored climbs when EVERY step needs the rewrite", async () => {
  // UNANIMOUS: the look step and the page step both escalate `no-look` to the
  // same place, so the message as a whole needs the rewrite and the browser
  // acts on it exactly as it would on one step.
  const slug = "ctl-no-look";
  const store = bucket(slug, { pages: TWO_PAGES(slug), config: { look: null, css: "" } });
  const before = snapshot(store);
  const r = await edit(slug, store, {
    answers: { [T.pick]: { fields: ["css", "components"] }, [T.tweak]: { cannot: "needs the page rewritten" } },
  }, { layer: "look", instruction: "Make the footer navy and tighten the sections." });
  assert.equal(r.status, 200);
  assert.equal(r.body.escalate, true, "a unanimous climb was said instead of acted on");
  assert.equal(r.body.reason, "no-look");
  assert.equal(r.body.layer, undefined);
  assert.equal(editFailure("look/no-look").cls, "up");
  assert.equal(editFailure("page/no-look").cls, "up");
  assert.equal(snapshot(store), before);
  assert.deepEqual(r.said.actions, [REWRITE]);
});

test("control: a site whose store holds no pages at all climbs to the rewrite, the one rung that regenerates them", async () => {
  const slug = "ctl-no-source";
  const store = bucket(slug, { pages: undefined });
  const r = await edit(slug, store, { answers: {} }, { layer: "text", instruction: "Say we open at 8." });
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "no-source");
  assert.equal(editFailure("route/no-source").cls, "up");
  assert.deepEqual(r.said.actions, [REWRITE]);
});

test("control: something the site does not have yet goes to the add-on step", async () => {
  const slug = "ctl-add-three";
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: { [T.pick]: { fields: ["three"] } } }, { layer: "look", instruction: "Put a spinning 3D loaf on the home page." });
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "addon");
  assert.equal(r.body.layer, "addon");
  assert.equal(editFailure("picker/addon").cls, "addon");
  assert.equal(snapshot(store), before);
  assert.deepEqual(r.said.actions, ["post a PAID request to the addon route"]);
});

test("control: a picture asked for where the page has no frame hops to that page's rung", async () => {
  const slug = "ctl-needs-place";
  const store = bucket(slug, { pages: [
    { path: "index.tsx", source: withPhoto(slug) },
    { path: "news.tsx", source: page("/news", "<h1>News from the bakery</h1>") },
  ] });
  const before = snapshot(store);
  const r = await edit(slug, store, { answers: { [T.picture]: { pictures: [], needsPlace: "/news" } } },
    { layer: "picture", instruction: "Put a photo of the shop on the news page." });
  assert.equal(r.body.escalate, true);
  assert.equal(r.body.reason, "needs-place");
  assert.equal(r.body.layer, "page");
  assert.equal(r.body.page, "/news");
  const f = editFailure("picture/needs-place");
  assert.equal(f.cls, "hop");
  assert.equal(f.layer, r.body.layer, "the table's layer for this hop is not the one the route sends");
  assert.equal(snapshot(store), before);
  assert.deepEqual(r.said.actions, ['post a SECOND, PAID request to the edit route (layer "page")']);
});

test("a message whose steps did not all write nothing never claims the site is unchanged, and its cost is what was debited", async () => {
  // A rename step refused AFTER its model call (charged, and not flagged as
  // writing nothing) beside a page step that changed nothing. Each sentence
  // is said; "nothing on your site changed" is not, because this route cannot
  // establish it for the rename step.
  const slug = "ctl-mixed-charged";
  const home = page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>");
  const store = bucket(slug, { pages: [{ path: "index.tsx", source: home }] });
  const r = await edit(slug, store, {
    answers: {
      [T.pick]: { fields: ["slug", "tsx"] },
      [T.rename]: {},
      [T.tweak]: { cannot: "needs the page rewritten" },
      [T.pages]: () => ({ pages: [{ path: "src/routes/index.tsx", source: home }] }),
    },
  }, { layer: "look", instruction: "Change our address and tidy the hours block." }, { SUPABASE_SERVICE_KEY: "svc-test" });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.ok, false);
  assert.equal(r.body.unchanged, undefined, "the reply claims nothing changed when one step cannot say so");
  assert.ok(r.body.cost > 0, "the rename step's charge vanished from the reply");
  assert.equal(sum(r.seen.debits), r.body.cost, "the reply's cost is not what was debited");
  // THE STEPS RUN IN LANE ORDER (`tsx` before `slug`), and so does `partial`.
  const byLayer = Object.fromEntries(r.body.partial.map((p) => [p.layer, p]));
  assert.deepEqual(r.body.partial.map((p) => p.layer), ["page", "rename"]);
  assert.equal(byLayer.page.msg, failureMsg("page/no-change", { page: "/" }));
  assert.equal(byLayer.page.unchanged, true);
  assert.match(byLayer.rename.msg, /what you would like the address to be/);
  assert.equal(byLayer.rename.unchanged, undefined, "a refusal that collected a charge is recorded as having done nothing");
  assert.equal(r.said.text, "⚠️ " + byLayer.page.msg + " " + byLayer.rename.msg);
  assert.deepEqual(r.said.actions, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE BROWSER'S OWN HANDLER, DRIVEN WITH BODIES THE ROUTE CAN SEND
// ─────────────────────────────────────────────────────────────────────────────

test("a reply the browser cannot read says so and buys nothing", () => {
  const said = editBrowserReply(null, true, ROUTED("page", "/"));
  assert.ok(said.ok, said.why);
  assert.match(said.text, /^⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through\./);
  assert.deepEqual(said.actions, [], "an unreadable reply started a paid rewrite");
});

test("a refusal with no sentence at all is still a refusal, never the rewrite", () => {
  const said = editBrowserReply({ ok: false, error: "something", cost: 0 }, false, ROUTED("page", "/"));
  assert.ok(said.ok, said.why);
  assert.equal(said.shown, true);
  assert.match(said.text, /^⚠️ /);
  assert.deepEqual(said.actions, []);
});

test("the screen states the edit's own charge and the routing charge as two amounts", () => {
  const msg = "I couldn't find that wording on your site.";
  // An edit that cost something while changing nothing, and a routing call of
  // one credit: singular, and apart.
  const said = editBrowserReply({ ok: false, error: "no-match", cost: 3, unchanged: true, msg }, false, { intent: "edit", layer: "text", cost: 1 });
  assert.equal(said.text, "⚠️ " + msg + " Nothing on your site changed, but this edit cost 3 credits. Reading your message cost 1 credit.");
  // A watch resumed after a refresh holds no routing reply: nothing is said
  // about the routing call rather than a guess.
  const resumed = editBrowserReply({ ok: false, error: "no-match", cost: 0, unchanged: true, msg }, false, undefined);
  assert.equal(resumed.text, "⚠️ " + msg + NOTHING_CHANGED);
  // A refusal that does NOT say it wrote nothing makes no whole-request claim.
  const unsure = editBrowserReply({ ok: false, error: "compile", cost: 0, msg }, false, ROUTED("data"));
  assert.equal(unsure.text, "⚠️ " + msg);
});

test("a refused step with no sentence of its own is still counted, never dropped", () => {
  const said = editBrowserReply({ ok: false, cost: 0, partial: [{ layer: "page", error: "compile" }] }, false, ROUTED("look"));
  assert.match(said.text, /^⚠️ One part of that message didn’t go through\./);
  assert.deepEqual(said.actions, []);
});

// ── A STEP WITH NO SENTENCE, BESIDE ONE THAT HAS ONE ────────────────────────
//
// THE OWNER'S BROWSER-COMPOSER REPRODUCTION (2026-09-23): `partial:
// [{msg}, {error: "compile"}]` printed the first sentence and nothing else —
// byte-identical to a reply holding that failure ALONE. The count of steps
// with no sentence lived in the branch reached only when NO step had one, so
// a single explained step made every unexplained one vanish, in both of the
// composer's callers. Driven at the browser only, because that is where the
// defect lived; a step whose reply could not be read (`body` null) or whose
// failure carried no `msg` is how the route can still write one.
const REFUSED = "The photo change was refused.";
const EXPLAINED = { layer: "page", msg: REFUSED };
const SILENT = (layer) => ({ layer, error: "compile" });
const MORE_1 = " One more part of that message didn’t go through. Ask for it again on its own and I’ll tell you why.";
const MORE_2 = " 2 more parts of that message didn’t go through. Ask for them again on their own and I’ll tell you why.";
const TOOK = "✅ Took the picture off “the window”.";

test("a refusal counts the steps that gave no reason beside the ones that did — the owner's reproduction", () => {
  const refuse = (partial) => editBrowserReply({ ok: false, cost: 0, partial }, false, ROUTED("look"));
  const alone = refuse([EXPLAINED]);
  const mixed = refuse([EXPLAINED, SILENT("look")]);
  assert.equal(alone.text, "⚠️ " + REFUSED, "control: one explained failure alone reads as it always did");
  assert.equal(mixed.text, "⚠️ " + REFUSED + MORE_1, "the step with no reason vanished beside the one with a reason");
  assert.notEqual(mixed.text, alone.text, "two failures read byte-identically to one");
  // A DUPLICATE SENTENCE IS ONE PROBLEM; TWO STEPS WITH NO SENTENCE ARE TWO —
  // even two that look exactly alike, because each entry is its own step.
  assert.equal(refuse([EXPLAINED, EXPLAINED, SILENT("page"), SILENT("page")]).text, "⚠️ " + REFUSED + MORE_2);
  // THE TWO COUNTS STAY APART: explanations past the first two are counted
  // as they always were, and the steps with none are counted after them.
  assert.equal(refuse([EXPLAINED, { layer: "nav", msg: "The menu change was refused." }, { layer: "look", msg: "The colour change was refused." }, SILENT("page")]).text,
    "⚠️ " + REFUSED + " The menu change was refused. (1 more part of that message didn’t go through either.)" + MORE_1);
  // CONTROLS — one kind of step alone reads exactly as it did before.
  assert.equal(refuse([EXPLAINED, { layer: "nav", msg: "The menu change was refused." }]).text, "⚠️ " + REFUSED + " The menu change was refused.");
  assert.equal(refuse([SILENT("page"), SILENT("look")]).text,
    "⚠️ 2 parts of that message didn’t go through. Ask for them again on their own and I’ll tell you why.");
  for (const partial of [[EXPLAINED], [EXPLAINED, SILENT("look")], [EXPLAINED, EXPLAINED, SILENT("page"), SILENT("page")]]) {
    const r = refuse(partial);
    assert.ok(r.ok, r.why);
    assert.equal(r.shown, true, "the browser showed nothing");
    assert.deepEqual(r.actions, [], "a refusal started a follow-up: " + JSON.stringify(r.actions));
  }
});

test("a partial success counts them too, after the tick, and starts nothing paid", () => {
  const land = (partial) => editBrowserReply({ ok: true, layer: "picture", msg: TOOK, partial }, true, ROUTED("look"));
  const alone = land([EXPLAINED]);
  const mixed = land([EXPLAINED, SILENT("look")]);
  const doubled = land([EXPLAINED, EXPLAINED, SILENT("page"), SILENT("page")]);
  assert.equal(alone.text, TOOK + " ⚠️ " + REFUSED, "control: one explained failure after the tick reads as it always did");
  assert.equal(mixed.text, TOOK + " ⚠️ " + REFUSED + MORE_1, "the step with no reason vanished after the tick");
  assert.notEqual(mixed.text, alone.text, "two failures read byte-identically to one");
  assert.equal(doubled.text, TOOK + " ⚠️ " + REFUSED + MORE_2);
  for (const r of [alone, mixed, doubled]) {
    assert.ok(r.ok, r.why);
    assert.ok(!r.text.includes("Nothing on your site changed"), "a partial success claims nothing changed");
    assert.deepEqual(paid(r), [], "something paid was started: " + JSON.stringify(r.actions));
    assert.deepEqual(r.actions, [REFRESH], "a published edit did something other than refresh the balance");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE CLASSIFICATION — THE TABLE, AND THE ROUTE HELD TO IT
// ─────────────────────────────────────────────────────────────────────────────

const CLASSES = ["up", "addon", "hop", "explain"];

test("the table: every entry is classified, justified, and the explained ones have a rung-scoped sentence", () => {
  assert.ok(EDIT_FAILURES.length >= 40, "the table is nearly empty, so every check below is about nothing");
  const keys = EDIT_FAILURES.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, "a key appears twice in the table");
  const facts = { page: "/blog", verb: "", routes: ["/", "/news"], what: "a QR code" };
  for (const f of EDIT_FAILURES) {
    assert.match(f.key, /^[a-z]+\/[a-z-]+$/, f.key + ": a key is `<rung>/<name>`");
    assert.ok(CLASSES.includes(f.cls), f.key + ": an unknown class");
    assert.ok(typeof f.reason === "string" && f.reason, f.key + ": no reason on the wire");
    assert.ok(typeof f.why === "string" && f.why.length >= 40, f.key + ": no justification for the class");
    if (f.cls === "hop") {
      assert.ok(typeof f.layer === "string" && f.layer && f.layer !== "addon", f.key + ": a hop names no cheaper layer");
    } else {
      assert.equal(f.layer, undefined, f.key + ": only a hop names a layer");
    }
    const msg = failureMsg(f.key, facts);
    if (f.cls === "explain") {
      assert.ok(msg.length > 20, f.key + ": an explained refusal has no sentence");
      // RUNG-SCOPED: a rung is one step of a message that may run several, so
      // a whole-request claim printed beside a step that shipped would lie.
      for (const claim of [/nothing on your site changed/i, /haven['’]t been charged/i, /cost you nothing/i, /nothing was changed/i]) {
        assert.doesNotMatch(msg, claim, f.key + ": the sentence makes a claim about the whole request");
      }
      // A FAILURE OF OURS SAYS SO, AND NOTHING ELSE CLAIMS TO BE OURS.
      if (f.ours) assert.match(msg, /this is on us/, f.key + ": a failure of ours does not say so");
      else assert.doesNotMatch(msg, /on us/, f.key + ": the customer's own situation is described as our failure");
    } else {
      // A SENTENCE FOR A CLIMB WOULD NEVER REACH THE SCREEN — the browser acts
      // on an escalate instead of printing it.
      assert.equal(msg, "", f.key + ": a climb carries a sentence nobody will read");
      assert.equal(f.ours, undefined, f.key + ": a climb is marked as a failure of ours");
    }
  }
  // THE CLASSES ARE ALL IN USE, and the reasons are derived per class.
  for (const cls of CLASSES) assert.ok(reasonsOf(cls).length >= 1, "no entry is classed " + cls);
  assert.deepEqual(reasonsOf("addon").sort(), ["addon", "no-backend", "no-meta", "no-tables"]);
});

test("the sentences read as a person reads them: page lists and step sentences", () => {
  assert.equal(pageList(["/"]), "/");
  assert.equal(pageList(["/", "/news"]), "/ and /news");
  assert.equal(pageList(["/", "/prices", "/gear"]), "/, /prices and /gear");
  assert.equal(pageList(["/", "/", "/news", ""]), "/ and /news", "a duplicate or blank route is listed");
  assert.equal(pageList(Array.from({ length: 11 }, (_, i) => "/p" + i)), "/p0, /p1, /p2, /p3, /p4, /p5, /p6, /p7 and 3 more");
  assert.equal(pageList([]), "");
  assert.equal(failureMsg("page/no-page", { page: "/blog", verb: "remove", routes: ["/"] }),
    "Your site doesn't have a /blog page, so there was nothing to take off. Its one page is /.");
  // A STEP THAT CLIMBED, BESIDE OTHER STEPS, IS SAID — never acted on — and
  // every climb the route can send has a sentence of its own.
  for (const f of EDIT_FAILURES.filter((x) => x.cls !== "explain")) {
    const s = stepMsg({ escalate: true, reason: f.reason, layer: f.cls === "addon" ? "addon" : f.layer, page: "/news" });
    assert.ok(s.length > 20 && /ask/i.test(s), f.key + ": a climbing step has no sentence to say beside other steps");
  }
  assert.match(stepMsg({ escalate: true, reason: "needs-place", layer: "page", page: "/news" }), /\/news/);
  assert.match(stepMsg({ escalate: true, reason: "no-meta", layer: "addon" }), /add one first/);
});

/**
 * THE EDIT ROUTE'S OWN SOURCE, LANDMARK TO LANDMARK, COMMENTS BLANKED.
 *
 * Both landmarks are proved present before the window is believed — `indexOf`
 * answering -1 turns a slice into `""` or the rest of the file, and either one
 * passes every negative assertion made inside it. Whole-line comments and
 * blocks that open at the start of a line are blanked LENGTH-PRESERVING: this
 * route explains its old escalates in prose, and a census that read the prose
 * would count the calls it replaced.
 */
function editRouteSource() {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const START = "const escalate = (reason, extra) =>";
  const END = "return Response.json(merged);";
  const at = src.indexOf(START);
  assert.ok(at >= 0, "the edit route's escalate helper is gone, so nothing below reads the route");
  assert.equal(src.indexOf(START, at + 1), -1, "a second escalate helper — the window would be ambiguous");
  const end = src.indexOf(END, at);
  assert.ok(end > at, "the edit route's final answer is gone or above its start");
  const raw = src.slice(at, end + END.length);
  let inBlock = false;
  const blanked = raw.split("\n").map((line) => {
    const t = line.trimStart();
    if (inBlock) { if (line.includes("*/")) inBlock = false; return " ".repeat(line.length); }
    if (t.startsWith("//")) return " ".repeat(line.length);
    if (t.startsWith("/*")) { if (!t.includes("*/")) inBlock = true; return " ".repeat(line.length); }
    return line;
  }).join("\n");
  return { raw, blanked };
}

/** The text of a call's arguments, depth-aware, from just after the `(`. */
function argsOf(s, open) {
  let depth = 0, quote = "";
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === "\\") { i++; continue; } if (c === quote) quote = ""; continue; }
    if (c === "\"" || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") { if (depth === 0) return s.slice(open, i); depth--; }
  }
  return null;
}

test("the route is held to the table: every escalate and explain it can send is classified, both ways", () => {
  const { raw, blanked } = editRouteSource();
  assert.equal(blanked.length, raw.length, "the blanker is not length-preserving");
  assert.ok(raw.length > 100000, "the window is far smaller than the edit route, so the census reads a fragment");
  // THE BLANKER IS ALIVE: the route's prose names escalates it no longer makes.
  const count = (s, re) => [...s.matchAll(re)].length;
  const ESC = /(?<![\w.$])escalate\(/g;
  const EXP = /(?<![\w.$])explain\(/g;
  assert.ok(count(raw, ESC) > count(blanked, ESC), "no commented escalate was blanked, so the blanker is not running");

  // ── ESCALATES ──────────────────────────────────────────────────────────
  // THE ONE PRODUCER of an escalate body is the helper.
  assert.equal(count(blanked, /escalate: true/g), 1, "an escalate body is produced somewhere other than the helper");
  const calls = [];
  for (const m of blanked.matchAll(ESC)) {
    const args = argsOf(blanked, m.index + m[0].length);
    assert.ok(args !== null, "an escalate call's arguments never close");
    const lit = /^\s*"([a-z-]+)"\s*(?:,|$)/.exec(args);
    assert.ok(lit, "an escalate with a COMPUTED reason — unclassifiable, and how the missing page came to buy a rewrite: escalate(" + args.slice(0, 60));
    const layer = /\blayer:\s*(?:"([^"]*)"|([\w.]+))/.exec(args);
    const cls = !layer ? "up" : layer[1] === "addon" ? "addon" : "hop";
    calls.push({ reason: lit[1], cls, layer: layer ? (layer[1] !== undefined ? layer[1] : null) : undefined });
  }
  assert.ok(calls.length >= 12, "the census found almost no escalates, so its answer is about nothing");
  // BOTH WAYS, AS A MULTISET: every call site is one table entry and every
  // climbing table entry is one call site. A new escalate with no entry fails
  // by existing; an entry whose call was deleted fails by being stale.
  const pair = (x) => x.reason + "|" + x.cls;
  assert.deepEqual(calls.map(pair).sort(), EDIT_FAILURES.filter((f) => f.cls !== "explain").map(pair).sort(),
    "the route's escalates and the table's climbing entries disagree");
  // A HOP'S LAYER IS THE TABLE'S — where the call spells it. The one hop whose
  // layer is computed (`needs-place`, from the picture module) is driven
  // through the route above and arrives as the table says.
  for (const c of calls.filter((x) => x.cls === "hop")) {
    const entry = EDIT_FAILURES.find((f) => f.cls === "hop" && f.reason === c.reason && (c.layer === null || f.layer === c.layer));
    assert.ok(entry, "a hop the table does not know: " + c.reason + " → " + c.layer);
  }
  assert.deepEqual(calls.filter((c) => c.layer === null).map((c) => c.reason), ["needs-place"],
    "a hop whose layer is computed, and no case drives it");

  // ── EXPLAINS ───────────────────────────────────────────────────────────
  const keys = [];
  for (const m of blanked.matchAll(EXP)) {
    const args = argsOf(blanked, m.index + m[0].length);
    const lit = args && /^\s*"([a-z]+\/[a-z-]+)"\s*(?:,|$)/.exec(args);
    assert.ok(lit, "an explain with a COMPUTED key — unclassifiable: explain(" + String(args).slice(0, 60));
    keys.push(lit[1]);
  }
  assert.ok(keys.length >= 20, "the census found almost no explained refusals");
  for (const k of new Set(keys)) {
    const f = editFailure(k);
    assert.ok(f, "the route explains with a key the table does not have: " + k);
    assert.equal(f.cls, "explain", k + " is explained by the route and classed " + (f && f.cls) + " in the table");
  }
  for (const f of EDIT_FAILURES.filter((x) => x.cls === "explain")) {
    assert.ok(keys.includes(f.key), "the table explains " + f.key + " and the route never does — a stale entry");
  }
});

test("the browser starts the rewrite from an escalate and from nothing else", () => {
  // THE DRIVEN CASES ABOVE ARE THE EVIDENCE; this is the census beside them,
  // for the one hop they cannot reach: a dropped connection in `siteEdit`.
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const blank = (s) => s.split("\n").map((l) => (l.trimStart().startsWith("//") ? " ".repeat(l.length) : l)).join("\n");
  const body = (name) => {
    const at = src.indexOf("\nfunction " + name + "(");
    assert.ok(at >= 0, name + " is gone from chat.js");
    const end = src.indexOf("\nfunction ", at + 1);
    assert.ok(end > at, name + " has no end");
    return blank(src.slice(at, end));
  };
  assert.doesNotMatch(body("editAnswer"), /fallback\s*\(/, "editAnswer can start the rewrite without an escalate");
  assert.match(body("escalatedEdit"), /o\.fallback\(\)/, "the escalate handler no longer reaches the rewrite at all");
  const edit = body("siteEdit");
  const catchAt = edit.lastIndexOf(".catch(");
  assert.ok(catchAt > 0, "siteEdit's catch is gone");
  const tail = edit.slice(catchAt);
  assert.match(tail, /unreadEditMsg\(\)/, "a dropped connection no longer says the answer could not be read");
  assert.doesNotMatch(tail, /fallback\s*\(/, "a dropped connection starts the rewrite on top of an edit that may have gone through");
  // THE ROUTING CHARGE ON THE SCREEN IS THE ROUTING REPLY'S OWN `cost`, handed
  // to the answer reader on both the synchronous and the queued path.
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(worker, /\n\s+cost: rCost,\n/, "the routing reply no longer carries its own cost");
  assert.match(edit, /editAnswer\(r && r\.ok, e, \{ site, d,/, "the synchronous answer is not handed the routing reply");
  assert.match(body("watchEditJob"), /reader\([^;]*\{ site, d,/, "the queued answer is not handed the routing reply");
});

for (const bad of ['config', 'backend', 'malformed-source']) {
  test('reconstruction stops when missing source is combined with ' + bad, async () => {
    const slug = 'review-no-source-' + bad;
    const store = bucket(slug, { down: bad === 'config' ? [CONFIG_KEY(slug)] : [] });
    if (bad === 'malformed-source') store.store.set(SOURCE_KEY(slug), '{broken');
    const wire = { answers: {}, ...(bad === 'backend' ? { route: (url) => url.includes('/rest/v1/site_backends') ? json({ error: 'unreadable' }, 503) : null } : {}) };
    const r = await edit(slug, store, wire, { layer: 'text', instruction: 'Say we open at 8.' });
    assert.equal(r.body.ok, false);
    assert.notEqual(r.body.escalate, true, JSON.stringify(r.body));
    assert.deepEqual(paid(r.said), []);
    assert.equal(r.compiles, 0);
    assert.deepEqual(r.seen.debits, []);
  });
}

for (const hasSource of [false, true]) {
  test('failed editable recovery stops before editing or reconstruction; source present=' + hasSource, async () => {
    const slug = 'review-recovery-' + hasSource;
    const store = bucket(slug, { pages: hasSource ? TWO_PAGES(slug) : undefined, down: ['current/' + slug + '.json'] });
    const r = await edit(slug, store, {answers:{}}, {layer:'page',instruction:'Move the opening hours above the map.'});
    assert.equal(r.body.ok, false);
    assert.notEqual(r.body.escalate, true);
    assert.notEqual(r.body.unchanged, true);
    assert.match(r.body.msg, /recover/i);
    assert.deepEqual(paid(r.said), []);
    assert.equal(r.compiles, 0);
    assert.deepEqual(r.seen.debits, []);
  });
}
