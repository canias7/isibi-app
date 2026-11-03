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

import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
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
      let asked = "", params = [];
      try { const b = JSON.parse(String((init && init.body) || "{}")); asked = String(b.query || ""); params = Array.isArray(b.params) ? b.params : []; }
      catch { asked = String((init && init.body) || ""); }
      seen.sql.push(asked);
      const a = wire.sql ? wire.sql(asked, params) : { rows: [], fields: ["x"] };
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
  // `wire.compileFails`: every build answers the container's own refusal.
  const compiler = installCompiler(wire.compileFails ? { ok: false, error: "src/routes/index.tsx(3,1): error TS1005: ';' expected." } : {});
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
  assert.equal(r.said.text, msg + NOTHING_CHANGED + ROUTING_2, key + ": the screen does not say what happened");
  assert.deepEqual(r.said.actions, [], key + ": the browser started a follow-up on a refusal");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE TWO REPRODUCED FAILURES
// ─────────────────────────────────────────────────────────────────────────────

const TWO_PAGES = (slug) => [
  { path: "index.tsx", source: page("/", "<h1>Harbour Loaf</h1><p>Open from 7am on weekdays</p>") },
  { path: "news.tsx", source: page("/news", "<h1>News from the bakery</h1>") },
];

// A PAGE SHOWING ONE OF THE SITE'S OWN PHOTOGRAPHS, and the writer's answer
// that deletes the element outright — a loss `keepPhotos` has no slot to put
// back into, so every page step is WITHHELD.
const withPhoto = (slug) => head("/", SAFE_IMAGE) + "function Page(){ return <main><h1>Harbour Loaf</h1><section className=\"p-4\"><h2>The bench</h2>"
  + "<SafeImage src=\"/u/" + slug + "/3f2a.jpg\" alt=\"our workbench\" ratio={4/3} /></section></main> }\n";
const photoGone = (slug) => withPhoto(slug).replace("className=\"p-4\"", "className=\"p-8\"").replace(/<SafeImage[^>]*\/>/, "");

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
const menuDb = ({ probeFails = false } = {}) => (q, params = []) => {
  if (probeFails) return { fail: true };
  // A CHANGED ROW HANDS ITSELF BACK, as Postgres answers `RETURNING` (2026-10-07).
  if (/^UPDATE "menu" SET "price" = \$1 WHERE id = \$2 RETURNING \*$/.test(q)) {
    return { rows: String(params[1]) === "1" ? [[1, "Sourdough", String(params[0])]] : [], fields: ["id", "item", "price"] };
  }
  if (/information_schema\.columns/i.test(q)) return { rows: [["menu", "id", "int"], ["menu", "item", "text"], ["menu", "price", "text"]], fields: ["t", "c", "ty"] };
  if (/_meta/i.test(q) && /schema/i.test(q)) return { rows: [[JSON.stringify(MENU_SPEC)]], fields: ["v"] };
  if (/FROM "menu"/i.test(q)) return { rows: [[1, "Sourdough", "£4.50"]], fields: ["id", "item", "price"] };
  return { rows: [], fields: ["x"] };
};
const INCOMPLETE = { backends: [{ uid: USER.id, brief: "", neon_db: "" }], project: [{ uid: USER.id, neon_conn: PROJECT_CONN }] };

// A HOME PAGE WHOSE ONLY PHOTOGRAPH LIVES IN ONE OF THE SITE'S OWN COMPONENTS
// — where the band split puts a section.
const PART_HOME = head("/", "import PhotoWall from './-parts/photo-wall'\n")
  + "function Page(){ return <main><h1>Harbour Loaf</h1><PhotoWall /></main> }\n";
const wallWith = (slug, file) => SAFE_IMAGE + "export default function PhotoWall(){ return <section><h2>The bench</h2>"
  + "<SafeImage src=\"/u/" + slug + "/" + file + "\" alt=\"our workbench\" ratio={4/3} /></section> }\n";

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
  assert.doesNotMatch(r.said.text, PICTOGRAPH);
  assert.ok(!r.said.text.includes("Nothing on your site changed"), "a published edit is reported as changing nothing");
  assert.deepEqual(r.said.actions, [REFRESH]);
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

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE BROWSER'S OWN HANDLER, DRIVEN WITH BODIES THE ROUTE CAN SEND
// ─────────────────────────────────────────────────────────────────────────────

test("a reply the browser cannot read says so and buys nothing", () => {
  const said = editBrowserReply(null, true, ROUTED("page", "/"));
  assert.ok(said.ok, said.why);
  assert.match(said.text, /^I couldn’t read the answer to that change, so I can’t tell whether it went through\./);
  assert.deepEqual(said.actions, [], "an unreadable reply started a paid rewrite");
});

test("a refusal with no sentence at all is still a refusal, never the rewrite", () => {
  const said = editBrowserReply({ ok: false, error: "something", cost: 0 }, false, ROUTED("page", "/"));
  assert.ok(said.ok, said.why);
  assert.equal(said.shown, true);
  assert.doesNotMatch(said.text, PICTOGRAPH);
  assert.deepEqual(said.actions, []);
});

test("the screen states the edit's own charge and the routing charge as two amounts", () => {
  const msg = "I couldn't find that wording on your site.";
  // An edit that cost something while changing nothing, and a routing call of
  // one credit: singular, and apart.
  const said = editBrowserReply({ ok: false, error: "no-match", cost: 3, unchanged: true, msg }, false, { intent: "edit", layer: "text", cost: 1 });
  assert.equal(said.text, msg + " Nothing on your site changed, but this edit cost 3 credits. Reading your message cost 1 credit.");
  // A watch resumed after a refresh holds no routing reply: nothing is said
  // about the routing call rather than a guess.
  const resumed = editBrowserReply({ ok: false, error: "no-match", cost: 0, unchanged: true, msg }, false, undefined);
  assert.equal(resumed.text, msg + NOTHING_CHANGED);
  // A refusal that does NOT say it wrote nothing makes no claim about the
  // site — and states the money it recorded all the same (2026-09-25).
  const unsure = editBrowserReply({ ok: false, error: "compile", cost: 0, msg }, false, ROUTED("data"));
  assert.equal(unsure.text, msg + " This edit cost you nothing. Reading your message cost 2 credits.");
  const charged = editBrowserReply({ ok: false, error: "no-match", cost: 1, msg }, false, ROUTED("data"));
  assert.equal(charged.text, msg + " This edit cost 1 credit. Reading your message cost 2 credits.");
  // A COST THAT IS NOT A RECORDED NUMBER SAYS NOTHING ABOUT THE EDIT — the
  // poll route leaves it off a job whose own row does not settle it — and the
  // routing call is still said.
  const unsettled = editBrowserReply({ ok: false, error: "stopped", msg }, false, ROUTED("data"));
  assert.equal(unsettled.text, msg + " Reading your message cost 2 credits.");
  const unsettledSame = editBrowserReply({ ok: false, error: "no-match", unchanged: true, msg }, false, ROUTED("data"));
  assert.equal(unsettledSame.text, msg + " Nothing on your site changed. Reading your message cost 2 credits.");
});

// NAMED, NOT COUNTED, SINCE 2026-10-03 (the mixed-work fixes: *"Do not replace
// missing targets with a vague count."*): a step with no sentence is named by
// what it was about — here only its layer is known.
test("a refused step with no sentence of its own is still named, never dropped", () => {
  const said = editBrowserReply({ ok: false, cost: 0, partial: [{ layer: "page", error: "compile" }] }, false, ROUTED("look"));
  assert.match(said.text, /^A page didn’t go through\. Ask for it again on its own and I’ll tell you why\./);
  assert.deepEqual(said.actions, []);
});

// ── A STEP WITH NO SENTENCE, BESIDE ONE THAT HAS ONE ────────────────────────
//
// THE OWNER'S BROWSER-COMPOSER REPRODUCTION (2026-09-23): `partial:
// [{msg}, {error: "compile"}]` printed the first sentence and nothing else —
// byte-identical to a reply holding that failure ALONE. A step with no
// sentence must never vanish beside one that has one, and two such steps are
// two. SINCE 2026-10-03 (the mixed-work fixes) each is NAMED by its target —
// its own words, its part of the site, its page — never counted: *"Do not
// replace missing targets with a vague count."* Driven at the browser, where
// the defect lived; the route writes such an entry for a step whose reply
// could not be read or whose failure carried no `msg`.
const REFUSED = "The photo change was refused.";
const EXPLAINED = { layer: "picture", lanes: ["images"], page: "/", words: ["swap the window photo"], msg: REFUSED };
const SILENT = (lanes, page, words) => ({ layer: "page", lanes, page, ...(words ? { words } : {}), error: "compile" });
const ASK_AGAIN = " didn’t go through. Ask for it again on its own and I’ll tell you why.";
const TOOK = "Took the picture off “the window”.";
const EXPLAINED_SAID = "“swap the window photo” on /: " + REFUSED;

// WHAT A REFUSAL ALSO STATES (2026-09-25): the edit's recorded cost and the
// routing call's, after whatever the steps said.
const PAID = " This edit cost you nothing. Reading your message cost 2 credits.";
test("a refusal names the steps that gave no reason beside the ones that did — the owner's reproduction, by target", () => {
  const refuse = (partial) => editBrowserReply({ ok: false, cost: 0, partial }, false, ROUTED("look"));
  const alone = refuse([EXPLAINED]);
  const mixed = refuse([EXPLAINED, SILENT(["shape"], "/visit", ["move the order band up"])]);
  assert.equal(alone.text, EXPLAINED_SAID + PAID, "one explained failure alone");
  assert.equal(mixed.text, EXPLAINED_SAID + " “move the order band up” on /visit" + ASK_AGAIN + PAID,
    "the step with no reason vanished beside the one with a reason, or was not named");
  assert.notEqual(mixed.text, alone.text, "two failures read byte-identically to one");
  // A DUPLICATE SENTENCE ON ONE PAGE IS ONE PROBLEM; TWO STEPS WITH NO SENTENCE
  // ARE TWO — each named, even two that look alike, because each is its own step.
  assert.equal(refuse([EXPLAINED, EXPLAINED, SILENT(["tsx"], "/"), SILENT(["components"], "/")]).text,
    EXPLAINED_SAID + " A part built for the site on /" + ASK_AGAIN + " A page’s building blocks on /" + ASK_AGAIN + PAID);
  // EVERY EXPLANATION, NOT TWO AND A COUNT: three steps with three sentences are three.
  assert.equal(refuse([EXPLAINED, { layer: "nav", lanes: ["action"], msg: "The menu change was refused." }, { layer: "look", lanes: ["css"], msg: "The colour change was refused." }]).text,
    EXPLAINED_SAID + " The menu or the header button: The menu change was refused. The styling: The colour change was refused." + PAID);
  for (const partial of [[EXPLAINED], [EXPLAINED, SILENT(["shape"], "/visit")], [EXPLAINED, EXPLAINED, SILENT(["tsx"], "/"), SILENT(["components"], "/")]]) {
    const r = refuse(partial);
    assert.ok(r.ok, r.why);
    assert.equal(r.shown, true, "the browser showed nothing");
    assert.deepEqual(r.actions, [], "a refusal started a follow-up: " + JSON.stringify(r.actions));
  }
});

test("a partial success names them too, after the tick, and starts nothing paid", () => {
  const land = (partial) => editBrowserReply({ ok: true, layer: "picture", msg: TOOK, partial }, true, ROUTED("look"));
  const alone = land([EXPLAINED]);
  const mixed = land([EXPLAINED, SILENT(["shape"], "/visit", ["move the order band up"])]);
  assert.equal(alone.text, TOOK + " " + EXPLAINED_SAID, "one explained failure after the tick");
  assert.equal(mixed.text, TOOK + " " + EXPLAINED_SAID + " “move the order band up” on /visit" + ASK_AGAIN, "the step with no reason vanished after the tick");
  assert.notEqual(mixed.text, alone.text, "two failures read byte-identically to one");
  for (const r of [alone, mixed]) {
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
  // RE-ANCHORED 2026-10-02 (the audit's W8): with the one hand-over.
  assert.match(body("escalatedEdit"), /o\.fallback\(EditPoll\.handOver\(/, "the escalate handler no longer reaches the rewrite at all");
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

for (const bad of ['config', 'backend', 'malformed-source', 'malformed-config', 'parts']) {
  test('reconstruction stops when missing source is combined with ' + bad, async () => {
    const slug = 'review-no-source-' + bad;
    const store = bucket(slug, { down: bad === 'config' ? [CONFIG_KEY(slug)] : bad === 'parts' ? [PARTS_KEY(slug)] : [] });
    if (bad === 'malformed-source') store.store.set(SOURCE_KEY(slug), '{broken');
    if (bad === 'malformed-config') store.store.set(CONFIG_KEY(slug), '{"look":42}');
    const wire = { answers: {}, ...(bad === 'backend' ? { route: (url) => url.includes('select=neon_db,uid') ? json({ error: 'unreadable' }, 503) : null } : {}) };
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

test('editable recovery returning ok false is as decisive as a thrown read', async () => {
  const slug = 'review-recovery-return';
  const store = bucket(slug, { pages: TWO_PAGES(slug) });
  store.store.set('current/' + slug + '.json', JSON.stringify({version:'20260925000000-probe'}));
  const r = await edit(slug, store, {answers:{}}, {layer:'page',instruction:'Move the opening hours above the map.'});
  assert.equal(r.body.ok, false);
  assert.notEqual(r.body.escalate, true);
  assert.notEqual(r.body.unchanged, true);
  assert.match(r.body.msg, /recover/i);
  assert.deepEqual(paid(r.said), []);
  assert.equal(r.compiles, 0);
  assert.deepEqual(r.seen.debits, []);
});

test('a recorded database without a readable connection cannot authorize source reconstruction', async () => {
  const slug = 'review-reconstruction-no-connection';
  const store = bucket(slug);
  const r = await edit(slug, store, {answers:{}, backends:[{uid:USER.id,neon_db:'existing_db'}], project:[]}, {layer:'text',instruction:'Say we open at 8.'});
  assert.notEqual(r.body.escalate, true, JSON.stringify(r.body));
  assert.deepEqual(paid(r.said), []);
  assert.equal(r.compiles, 0);
  assert.deepEqual(r.seen.calls, []);
  assert.deepEqual(r.seen.debits, []);
});

for (const schema of [{tables:42}, [], {tables:[]}]) {
  test('missing-source reconstruction distinguishes malformed schema from empty schema: ' + JSON.stringify(schema), async () => {
    const slug = 'review-reconstruction-schema-' + (Array.isArray(schema) ? 'array' : Array.isArray(schema.tables) ? 'empty' : 'bad');
    const store = bucket(slug);
    const r = await edit(slug, store, {...INCOMPLETE, answers:{}, sql:q => /SELECT v FROM/.test(q) ? {rows:[[JSON.stringify(schema)]],fields:['v']} : {rows:[],fields:['x']}}, {layer:'text',instruction:'Say we open at 8.'});
    assert.ok(r.seen.sql.some(q=>/SELECT v FROM/.test(q)), 'the schema read was not reached');
    if (!Array.isArray(schema) && Array.isArray(schema.tables)) assert.equal(r.body.escalate,true);
    else {
      assert.notEqual(r.body.escalate,true,JSON.stringify(r.body));
      assert.deepEqual(paid(r.said),[]);
    }
    assert.deepEqual(r.seen.calls,[]);
    assert.deepEqual(r.seen.debits,[]);
    assert.equal(r.compiles,0);
  });
}

// A SAVED ROW IS THE SAME: live when the data rung writes it, and its list's new
// order is what waits for the publish. A row change with an order change whose
// publish then failed answered "That didn't compile, so your site is untouched".
const MENU_PAGE = (slug) => [{ path: "index.tsx", source: "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { useRows } from '@/lib/rows'\n"
  + "export const Route = createFileRoute('/')({ component: Home })\n"
  + "function Home(){ const q = useRows(\"menu\"); return <main><h1>Menu</h1>{(q.data || []).map((r) => <p key={r.id}>{r.item}</p>)}</main> }\n" }];
