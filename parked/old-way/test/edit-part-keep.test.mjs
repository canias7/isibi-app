// PARKED (2026-11-03, park-old-way): the old-way half of test/edit-part-keep.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A PAGE EDIT AND THE SITE'S OWN COMPONENTS (audit A21-2, finding 39, 2026-10-22).
//
// The page rung kept every component its writer returned, checked for
// photographs and nothing else: its text and link checks compared the PAGE, so
// a page handed back unchanged beside a rewritten component passed both on two
// equal strings. Reproduced here through `POST /api/site/<slug>/edit`, with the
// wire stubbed and the opt-in compiler installed. Nothing reaches a model.
//
//   - the audit's example: "Change the sourdough price on the menu card to
//     £5", the writer returns /menu unchanged, `menu-card` with the price
//     changed AND two loaves deleted, and `visit-map` (drawn only by /visit)
//     reworded. Both components are put back as they were and the reply says
//     so; nothing about the menu is claimed as done;
//   - controls: the price alone ships; an asked-for removal in a component
//     ships; a brand-new component ships; a component the page draws through
//     another component is the page's.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";
import { TWEAK_TOOL } from "../../../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../../../builder/page-gen.mjs";
import { KEEP_TOOL } from "../../../builder/page-keep.mjs";
import { partsReached, partTextItems, partKeepCheck, partsHeldMsg } from "../builder/part-keep.mjs";
import { tweakParser } from "../../../builder/site-tweak.mjs";
import { editBrowserReply } from "../../../scripts/addon-sweep.mjs";

const USER = { id: "u-partkeep-1", email: "owner@example.com" };
const TOKEN = "Bearer some-token";
const SRC_KEY = (slug) => "source/" + slug + "/pages.json";
const PARTS_KEY = (slug) => "source/" + slug + "/parts.json";

const page = (route, comp, imports, body) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + imports
  + "export const Route = createFileRoute('" + route + "')({ component: " + comp + " })\n"
  + "function " + comp + "(){return <main>" + body + "</main>}\n";

const MENU = page("/menu", "Menu", 'import MenuCard from "./-parts/menu-card"\n', "<h1>Our menu</h1><MenuCard />");
const VISIT = page("/visit", "Visit", 'import VisitMap from "./-parts/visit-map"\n', "<h1>Visit us</h1><VisitMap />");

const card = (items) => 'export default function MenuCard(){return <section><h2>Our loaves</h2><ul>'
  + items.map(([n, p]) => "<li><h3>" + n + "</h3><p>" + p + "</p></li>").join("")
  + '</ul><a href="/order">Order a loaf</a></section>}';
const CARD = card([["Sourdough", "£4"], ["Rye", "£3"], ["Spelt", "£4.50"]]);
const MAP_OLD = 'export default function VisitMap(){return <section><h2>Find us</h2><p>Twelve Mill Lane, open from eight.</p></section>}';
const MAP_NEW = 'export default function VisitMap(){return <section><h2>Where we are</h2><p>Come and see us on Mill Lane.</p></section>}';

const LOOK = { brand: "Fold Lane", theme: "broadsheet", tsx: [
  { name: "menu-card", does: "the menu card", props: "none" },
  { name: "visit-map", does: "the visit map", props: "none" },
] };

function bucket(slug, parts = [{ name: "menu-card", source: CARD }, { name: "visit-map", source: MAP_OLD }]) {
  const store = new Map([
    [SRC_KEY(slug), JSON.stringify([{ path: "menu.tsx", source: MENU }, { path: "visit.tsx", source: VISIT }])],
    [PARTS_KEY(slug), JSON.stringify(parts)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...LOOK }, css: ":root{--background:oklch(100% 0 0)}" })],
  ]);
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : { text: async () => v }; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

function withWire(answers, run) {
  const real = globalThis.fetch;
  const calls = [];
  const json = (v) => new Response(typeof v === "string" ? v : JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) return json(USER);
    if (url.includes("/rpc/use_credits")) {
      let want = 0;
      try { want = Number(JSON.parse(String(init && init.body) || "{}").cost) || 0; } catch { want = 0; }
      return json(String(want));
    }
    if (url.includes("/rest/v1/site_project")) return json("[]");
    if (url.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "" }]);
    if (url.includes("/v1/messages")) {
      let body = {};
      try { body = JSON.parse(String(init && init.body) || "{}"); } catch { body = {}; }
      const tool = body.tool_choice?.name || "";
      calls.push({ tool, body });
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answers[tool] }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(url)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  return (async () => { try { return await run(calls); } finally { globalThis.fetch = real; } })();
}

async function edit(slug, instruction, store) {
  const worker = await loadWorker();
  const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: TOKEN },
    body: JSON.stringify({ layer: "page", page: "/menu", remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
  });
  const res = await worker.fetch(req, { SITES_BUCKET: store, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
  const body = await res.clone().json().catch(() => null);
  return { status: res.status, body, said: editBrowserReply(body, res.ok) };
}

function storedParts(store, slug) {
  const out = {};
  for (const p of JSON.parse(store.store.get(PARTS_KEY(slug)))) out[p.name] = p.source;
  return out;
}

/** The components the publish really sent to the compiler. */
function sentParts(c) {
  if (!c.calls.length) return null;
  const out = {};
  for (const p of (c.calls[c.calls.length - 1].body || {}).parts || []) out[p.name] = p.source;
  return out;
}

const pagesAnswer = (parts) => ({ pages: [{ path: "src/routes/menu.tsx", source: MENU }], parts });
const TWEAK_NO = { cannot: "that needs the component rewritten" };

test("partsReached follows components that draw components, and an unreadable import counts as drawn", () => {
  const inner = { name: "price-row", source: "export default function P(){return <p>£4</p>}" };
  const outer = { name: "menu-card", source: 'import PriceRow from "./price-row"\nexport default function M(){return <PriceRow/>}' };
  const other = { name: "visit-map", source: MAP_OLD };
  const r = partsReached([MENU], "menu.tsx", [inner, outer, other]);
  assert.deepEqual([...r].sort(), ["menu-card", "price-row"]);
  // A namespace import cannot be read as names: cannot-tell is never "not drawn".
  const ns = page("/menu", "Menu", 'import * as Card from "./-parts/menu-card"\n', "<Card.default />");
  assert.ok(partsReached([ns], "menu.tsx", [outer]).has("menu-card"));
  // A component edited as the target draws itself.
  assert.ok(partsReached([MAP_OLD], "-parts/visit-map.tsx", [other]).has("visit-map"));
});

test("partTextItems: a changed line is one change, a deleted line is a loss, each under its heading", async () => {
  const parse = await tweakParser();
  assert.deepEqual(partTextItems(CARD, card([["Sourdough", "£5"], ["Rye", "£3"], ["Spelt", "£4.50"]]), parse),
    [{ kind: "text-changed", label: "£4", to: "£5", section: "Sourdough" }]);
  assert.deepEqual(partTextItems(CARD, card([["Sourdough", "£4"], ["Spelt", "£4.50"]]), parse),
    [{ kind: "text-lost", label: "Rye", section: "Sourdough" }, { kind: "text-lost", label: "£3", section: "Rye" }]);
  assert.deepEqual(partTextItems(CARD, CARD, parse), []);
  assert.equal(partTextItems(CARD, "export default function (", parse), null);
});

test("partKeepCheck never reads cannot-tell as kept, and an unchanged component costs nothing", async () => {
  let sent = 0;
  const send = async () => { sent++; return null; };
  assert.equal((await partKeepCheck({ message: "x", before: CARD, after: CARD, send })).verdict, "kept");
  assert.equal((await partKeepCheck({ message: "x", before: CARD, after: MAP_NEW, send, parse: null })).verdict, "unchecked");
  assert.equal((await partKeepCheck({ message: "x", before: CARD, after: "export default function (", send })).verdict, "unchecked");
  assert.equal(sent, 0);
  assert.equal((await partKeepCheck({ message: "x", before: CARD, after: card([["Sourdough", "£4"]]), send })).verdict, "unchecked");
  assert.equal(sent, 1);
  assert.equal(partsHeldMsg([], []), "");
});
