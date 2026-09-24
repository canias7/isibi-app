// THE FULL PAGE WRITER DROPS UNRELATED CONTENT SILENTLY — REPRODUCED, NOT
// FIXED (2026-09-24).
//
// Owner: *"investigate whether the full page writer can silently drop
// unrelated content during a small requested edit. Reproduce through the real
// edit route with supplied model output."* Then, confirming it independently
// through the route: *"Both omitted-section cases publish and say “Updated /”;
// correct narrow edits and intentional removals also pass. … Commit the focused
// reproduction cases so the evidence is reviewable. Include the correct edit,
// reorder, intentional removal through both routes, and authorized removal
// accompanied by an unrelated loss."*
//
// ⚠ WHAT THIS FILE IS: A CHARACTERISATION OF TODAY'S BEHAVIOUR, NOT A GUARD
// FOR A FIX. No product code changed with it. Two kinds of case:
//
//   OPEN DEFECT — the writer's answer loses something the customer never asked
//     about, and the route PUBLISHES it: the compiler payload and the store both
//     carry the loss and the screen says "✅ Updated /.". These cases assert that
//     the loss IS published, so the evidence is reviewable and runs in CI; the
//     protection, when it lands, must flip each one deliberately into a refusal
//     case. A fix that leaves one of these green has not fixed that shape.
//
//   MUST STAY PUBLISHED — what any protection has to preserve, and what the
//     first proposal would have broken: the correct narrow edit, a reorder, an
//     intentional section removal through BOTH routes (look, and straight to
//     page), a requested retarget, and a component the rewrite still renders
//     through an alias — an UNCERTAIN reading, which is not a confirmed absence.
//
// ALSO PINNED, BECAUSE THE REVISED DESIGN IS BUILT ON THEM: what the EXISTING
// readers answer on each fixture — `linkSlots` (in-body literal links, by
// words and destination) and `partUse` (whether a source renders one of the
// site's own components: `rendered` · `unused` · `unsure` · `none`). A reader
// that changes must change this evidence visibly, not quietly under a design
// that assumed it.
//
// THE PAGE: four sections — a hero with a link to /menu, opening hours, "Order
// ahead" rendering the site's OWN component `order-form`, and "Find us" with a
// "Directions" link to /visit. Every answer is SUPPLIED: the cheap tweak rung
// declines (`cannot`) so the full writer is the path under test, and the full
// writer's answer is whatever each case hands it.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer is supplied, so nothing
// here says a real model drops sections, or how often — only that when a
// writer's answer does, nothing between it and the publish notices. And the
// plain-text / kit-only section (a section with no literal link and none of the
// site's own components) is NOT in the protected inventory the revised design
// proposes: that loss stays OPEN, and the "Opening hours" drop below is kept as
// its reproduction.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { pickTool } from "../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { linkSlots } from "../builder/site-nav.mjs";
import { localParts, partUse } from "../builder/site-files.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = { pick: pickTool().name, tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name };
const USER = { id: "u-keep-1", email: "owner@example.com" };

// ── THE SITE ────────────────────────────────────────────────────────────────
const IMPORTS = "import { createFileRoute, Link } from '@tanstack/react-router'\n";
const PART_IMPORT = "import OrderForm from \"./-parts/order-form\"\n";
const ROUTE = "export const Route = createFileRoute('/')({ component: Home })\n";
const HERO = "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p><Link to=\"/menu\">See the menu</Link></section>";
const HOURS = "<section className=\"hours\"><h2>Opening hours</h2><p>Open from 7am on weekdays.</p></section>";
const HOURS_NEW = "<section className=\"hours\"><h2>Opening hours</h2><ul><li>Weekdays 7am to 4pm</li><li>Saturday 8am to 2pm</li></ul></section>";
const ORDER = "<section className=\"order\"><h2>Order ahead</h2><OrderForm /></section>";
const VISIT = "<section className=\"visit\"><h2>Find us</h2><p>Quay Street, by the lifeboat station.</p><Link to=\"/visit\">Directions</Link></section>";
const body = (...blocks) => "function Home(){return <main>" + blocks.join("") + "</main>}\n";
// `home` keeps the component's import; `bare` is the same page with the import
// line gone too — the two spellings of "the component is off the page".
const home = (...blocks) => IMPORTS + PART_IMPORT + ROUTE + body(...blocks);
const bare = (...blocks) => IMPORTS + ROUTE + body(...blocks);
const HOME = home(HERO, HOURS, ORDER, VISIT);

const page = (route, inner) => "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: P })\nfunction P(){return <main>" + inner + "</main>}\n";
const OTHER_PAGES = [
  { path: "menu.tsx", source: page("/menu", "<h1>Menu</h1><p>Sourdough, rye and buns.</p>") },
  { path: "visit.tsx", source: page("/visit", "<h1>Visit</h1><p>Quay Street.</p>") },
  { path: "contact.tsx", source: page("/contact", "<h1>Contact</h1><p>Ring the bakery.</p>") },
];
const ORDER_FORM = "export default function OrderForm(){return <form data-slot=\"order-form\"><label>Your name<input name=\"name\" /></label><button type=\"submit\">Place order</button></form>}";

// ── WHAT THE CUSTOMER ASKS ──────────────────────────────────────────────────
const HOURS_ASK = "Show the opening hours on the home page as a short list: weekdays 7am to 4pm, Saturday 8am to 2pm.";
const REORDER_ASK = "Put the \"Find us\" section at the top of the home page.";
const REMOVE_ASK = "Take the \"Find us\" section off the home page.";
const RETARGET_ASK = "Send the Directions link on the home page to the contact page instead of the visit page.";
const HERO_ASK = "Change the line under “Harbour Loaf” to say “Fresh bread from the harbour, every morning.”";

// ── WHAT THE WRITER ANSWERS ─────────────────────────────────────────────────
const CORRECT = home(HERO, HOURS_NEW, ORDER, VISIT);
const REORDERED = home(VISIT, HERO, HOURS, ORDER);
const REMOVED = home(HERO, HOURS, ORDER);
const RETARGETED = home(HERO, HOURS, ORDER, VISIT.replace("to=\"/visit\"", "to=\"/contact\""));
// The hours changed as asked AND "Find us" — with its Directions link — is gone.
const DROPS_VISIT = home(HERO, HOURS_NEW, ORDER);
// The hours changed as asked AND "Order ahead" is gone; the import line stays.
const DROPS_ORDER = home(HERO, HOURS_NEW, VISIT);
// The same loss, with the writer taking the import line out as well.
const DROPS_ORDER_BARE = bare(HERO, HOURS_NEW, VISIT);
// Directions removed and a DIFFERENT link added: the in-body link COUNT is
// unchanged, which is why a count cannot be the check.
const SWAPS_LINK = home(HERO, HOURS_NEW.replace("</section>", "<Link to=\"/contact\">Get in touch</Link></section>"),
  ORDER, VISIT.replace("<Link to=\"/visit\">Directions</Link>", ""));
// "Find us" removed as asked AND "Order ahead" dropped beside it.
const REMOVED_PLUS = home(HERO, HOURS);
// The order form still on the page, reached through an alias: `partUse`
// cannot SEE it rendered and says so — "unsure", never "unused".
const ALIASED = IMPORTS + PART_IMPORT + ROUTE + "const Form = OrderForm\n"
  + body(HERO, HOURS_NEW, "<section className=\"order\"><h2>Order ahead</h2><Form /></section>", VISIT);
// The hero line changed as asked AND "Opening hours" is gone — a section with
// no literal link and none of the site's own components, so the class the
// proposed inventory does NOT reach. Kept as its reproduction, and expected to
// stay green under that protection, which is the point of keeping it.
const HERO_NEW = HERO.replace("Bread from the harbour", "Fresh bread from the harbour");
const DROPS_HOURS = home(HERO_NEW, ORDER, VISIT);

// ── THE HARNESS ─────────────────────────────────────────────────────────────
function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: HOME }, ...OTHER_PAGES])],
    ["source/" + slug + "/parts.json", JSON.stringify([{ name: "order-form", source: ORDER_FORM }])],
    [CONFIG_KEY(slug), JSON.stringify({
      look: { brand: "Harbour Loaf", theme: "broadsheet", tsx: [{ name: "order-form", does: "the order-ahead form", props: "none" }] },
      css: "",
    })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v) });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

// One edit through `POST /api/site/<slug>/edit`, the synchronous path. `route`
// is what the router decided (layer and page); `pick` is the lane picker's
// answer when the route is `look`; `answer` is the full writer's page.
async function drive({ route, ask, pick = null, answer }) {
  const slug = "keep-" + randomBytes(4).toString("hex");
  const b = bucket(slug);
  const seen = { calls: [], debits: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    if (u.includes("/rpc/use_credits")) { seen.debits.push(Number(args.cost) || 0); return json(Number(args.cost) || 0); }
    if (u.includes("/rpc/get_credits")) return json(100);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    if (u.includes("/rest/v1/site_project") || u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.calls.push(tool);
      const usage = { input_tokens: 1000, output_tokens: 500 };
      const said = (input) => json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input }], usage });
      if (tool === T.pick && pick) return said(pick);
      if (tool === T.tweak) return said({ cannot: "that needs the page rewritten" });
      if (tool === T.pages) return said({ pages: [{ path: "src/routes/index.tsx", source: answer }] });
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = {
      SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key",
      SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv(),
    };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({
        layer: "page", page: "/", remove: false, rename: "", tab: false, ...route,
        instruction: ask, picker: "sonnet", idem: "idem" + randomBytes(8).toString("hex"),
      }),
    }), env, makeCtx());
    const reply = await res.json().catch(() => null);
    const files = c.calls.map((k) => (k.body && k.body.files) || {});
    const compiledOf = (f) => f["src/routes/index.tsx"] || f["index.tsx"] || null;
    const pages = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    const parts = JSON.parse(b.store.get("source/" + slug + "/parts.json"));
    return {
      status: res.status, reply, calls: seen.calls, debits: seen.debits,
      compiles: c.calls.length, compiled: files.length ? compiledOf(files[0]) : null,
      stored: pages.find((p) => p.path === "index.tsx").source,
      others: OTHER_PAGES.map((o) => (pages.find((p) => p.path === o.path) || {}).source),
      parts,
      said: editBrowserReply(reply, res.ok, { cost: 2 }),
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

// What EVERY publishing case shares: one full-writer call after the tweak
// declined, one compile carrying the writer's answer, the same answer stored,
// the other pages and the component FILE untouched, and one debit. The screen
// is asserted by each case, because what it says is the evidence.
function published(r, answer, { calls, debits }) {
  assert.equal(r.status, 200, "the edit published");
  assert.deepEqual(r.calls, calls, "the tweak declined and the full writer answered");
  assert.equal(r.compiles, 1, "one compile");
  assert.equal(r.compiled, answer, "the compiler payload is the writer's answer, byte for byte");
  assert.equal(r.stored, answer, "the store holds the writer's answer, byte for byte");
  assert.deepEqual(r.others, OTHER_PAGES.map((o) => o.source), "the other pages are byte-identical");
  assert.deepEqual(r.parts, [{ name: "order-form", source: ORDER_FORM }], "the component's FILE is untouched");
  assert.deepEqual(r.debits, debits, "charged as an ordinary page edit");
}
const PAGE = { calls: [T.tweak, T.pages], debits: [3] };
const LOOK = { calls: [T.pick, T.tweak, T.pages], debits: [4] };
const UPDATED = "✅ Updated /.";

// ── WHAT THE EXISTING READERS SEE ───────────────────────────────────────────
const links = (src) => linkSlots([{ path: "index.tsx", source: src }]).map((l) => l.label + " → " + l.href);
const use = (src) => partUse(src, "order-form");

test("the readers the design leans on see the page's two links and its own component, rendered", () => {
  assert.deepEqual(links(HOME), ["See the menu → /menu", "Directions → /visit"]);
  assert.deepEqual(localParts(HOME).map((p) => p.name), ["order-form"]);
  assert.equal(use(HOME), "rendered");
});

// ═════ MUST STAY PUBLISHED ═════════════════════════════════════════════════

test("MUST STAY PUBLISHED: the correct narrow edit", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: CORRECT });
  published(r, CORRECT, PAGE);
  assert.equal(r.said.text, UPDATED);
  assert.deepEqual(links(CORRECT), links(HOME), "every link kept, words and destination");
  assert.equal(use(CORRECT), "rendered");
});

test("MUST STAY PUBLISHED: a reorder — every section moved, nothing lost", async () => {
  const r = await drive({ route: { layer: "page" }, ask: REORDER_ASK, answer: REORDERED });
  published(r, REORDERED, PAGE);
  assert.equal(r.said.text, UPDATED);
  assert.deepEqual([...links(REORDERED)].sort(), [...links(HOME)].sort(), "the same links, in a new order");
  assert.equal(use(REORDERED), "rendered");
});

test("MUST STAY PUBLISHED: an intentional section removal through look (the picker marks a removal)", async () => {
  const r = await drive({
    route: { layer: "look" }, ask: REMOVE_ASK,
    pick: { fields: ["components"], removes: ["components"] }, answer: REMOVED,
  });
  published(r, REMOVED, LOOK);
  assert.equal(r.said.text, UPDATED);
  assert.deepEqual(links(REMOVED), ["See the menu → /menu"], "Directions went with the section, as asked");
  assert.equal(use(REMOVED), "rendered", "the order form was not part of the removal and is still there");
});

test("MUST STAY PUBLISHED: the same removal routed straight to the page layer — no picker, no removal signal of any kind", async () => {
  const r = await drive({ route: { layer: "page" }, ask: REMOVE_ASK, answer: REMOVED });
  published(r, REMOVED, PAGE);
  assert.equal(r.said.text, UPDATED);
  // THE FIRST PROPOSAL WOULD HAVE REFUSED THIS: its only permission was the
  // look door's picker signal, which this route never carries. The customer's
  // own words are the one thing both routes have.
  assert.ok(!r.calls.includes(T.pick), "no lane picker ran on this route");
  assert.deepEqual(r.reply && r.reply.lanes, [], "and no lane was named");
});

test("MUST STAY PUBLISHED: a requested retarget — the same words, a new destination", async () => {
  const r = await drive({ route: { layer: "page" }, ask: RETARGET_ASK, answer: RETARGETED });
  published(r, RETARGETED, PAGE);
  assert.equal(r.said.text, UPDATED);
  assert.deepEqual(links(RETARGETED), ["See the menu → /menu", "Directions → /contact"]);
});

test("MUST STAY PUBLISHED: a component the rewrite still renders through an alias reads UNSURE, not absent", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: ALIASED });
  published(r, ALIASED, PAGE);
  assert.equal(r.said.text, UPDATED);
  // The reader cannot SEE `<OrderForm` any more and does not pretend to: a
  // binding still referenced in code is "unsure". A protection that read this
  // as a loss would refuse a page that still shows the form.
  assert.equal(use(ALIASED), "unsure");
});

// ═════ OPEN DEFECT — each asserts the loss IS published today ══════════════

test("OPEN DEFECT: a narrow edit whose answer also drops an unrelated section with a link publishes, and says “Updated /”", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_VISIT });
  published(r, DROPS_VISIT, PAGE);
  assert.ok(!r.compiled.includes("Find us") && !r.stored.includes("to=\"/visit\""), "\"Find us\" and its link are gone from both");
  assert.equal(r.said.text, UPDATED, "and the screen says nothing about it");
  assert.deepEqual(links(DROPS_VISIT), ["See the menu → /menu"], "the reader sees Directions gone");
});

test("OPEN DEFECT: the section rendering the site's own component is dropped, the import line kept — published", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_ORDER });
  published(r, DROPS_ORDER, PAGE);
  assert.ok(!r.stored.includes("<OrderForm"), "the order form is off the page");
  assert.ok(r.stored.includes(PART_IMPORT.trim()), "while its import line stays");
  assert.equal(r.said.text, UPDATED);
  assert.equal(use(DROPS_ORDER), "unused", "a CONFIRMED absence: imported, never rendered, never mentioned");
});

test("OPEN DEFECT: the same component dropped with its import line taken out too — published", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_ORDER_BARE });
  published(r, DROPS_ORDER_BARE, PAGE);
  assert.ok(!r.stored.includes("OrderForm"), "no import, no tag, no mention");
  assert.equal(r.said.text, UPDATED);
  // "none" — the page no longer imports it at all. Read against the BEFORE,
  // which rendered it, that is a confirmed absence as well; a reader keyed only
  // on the after page's own imports would never have asked about it.
  assert.equal(use(DROPS_ORDER_BARE), "none");
});

test("OPEN DEFECT: a link removed while a DIFFERENT link is added — the count is unchanged and the loss publishes", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: SWAPS_LINK });
  published(r, SWAPS_LINK, PAGE);
  assert.equal(r.said.text, UPDATED);
  const before = links(HOME), after = links(SWAPS_LINK);
  assert.equal(after.length, before.length, "two links before, two after — a count sees nothing");
  assert.ok(!after.includes("Directions → /visit"), "Directions is gone");
  assert.ok(after.includes("Get in touch → /contact"), "and an unasked-for link stands in its place");
});

test("OPEN DEFECT: an authorised removal of “Find us” accompanied by an unrelated loss publishes both (look, the picker marks a removal)", async () => {
  // The first proposal's permission was this picker signal — lane-wide, not
  // target-scoped — so it would have allowed the order form's loss too. The
  // customer asked for ONE section.
  const r = await drive({
    route: { layer: "look" }, ask: REMOVE_ASK,
    pick: { fields: ["components"], removes: ["components"] }, answer: REMOVED_PLUS,
  });
  published(r, REMOVED_PLUS, LOOK);
  assert.ok(!r.stored.includes("Find us"), "the section that was asked for is gone, correctly");
  assert.ok(!r.stored.includes("<OrderForm"), "and so is the order form, which nobody asked about");
  assert.equal(r.said.text, UPDATED);
  assert.equal(use(REMOVED_PLUS), "unused");
});

test("OPEN, AND OUTSIDE THE PROPOSED INVENTORY: a section of plain words (no link, no own component) dropped — published", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HERO_ASK, answer: DROPS_HOURS });
  published(r, DROPS_HOURS, PAGE);
  assert.ok(r.stored.includes("Fresh bread from the harbour"), "the line that was asked for changed");
  assert.ok(!r.stored.includes("Opening hours"), "and the hours section, which nobody mentioned, is gone");
  assert.equal(r.said.text, UPDATED);
  // Nothing the proposed inventory reads moved: both links and the component
  // are where they were. The protection would not see this loss — kept here so
  // that stays visible rather than being mistaken for coverage.
  assert.deepEqual(links(DROPS_HOURS), links(HOME));
  assert.equal(use(DROPS_HOURS), "rendered");
});
