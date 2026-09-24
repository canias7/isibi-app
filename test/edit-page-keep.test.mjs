// A PAGE REWRITE MAY NOT QUIETLY LOSE WHAT NOBODY ASKED ABOUT (2026-09-24).
//
// Owner: *"investigate whether the full page writer can silently drop
// unrelated content during a small requested edit. Reproduce through the real
// edit route with supplied model output."* Reproduced, and committed at
// `32e0966b` as a CHARACTERISATION: five OPEN DEFECT cases asserting that the
// loss WAS published and the screen said "✅ Updated /.". Then, approving the
// revised design: *"Proceed with the bounded implementation of the revised
// preservation check … Flip the five in-scope defect cases into protection
// tests; retain the successful controls."*
//
// SO THIS FILE IS NOW THE PROTECTION'S GUARD, IN FOUR PARTS:
//
//   PROTECTED — the five reproductions, flipped: the writer's answer loses
//     something the customer never asked about, and the route REFUSES — 409
//     `withheld`, nothing compiled, nothing stored, nothing charged, and the
//     customer told what the change would also have done.
//   MUST STAY PUBLISHED — the correct narrow edit, a reorder, an intentional
//     section removal through BOTH routes (look, and straight to page), and a
//     requested retarget; plus the uncertain component (an alias the reader
//     cannot see drawn), which publishes and is NAMED, never refused and
//     never counted as kept.
//   NEGATIVE CONTROLS — "keep the order form", an unrelated removal
//     instruction, a genuine quote attached to the wrong item, and a quote
//     that is not in the message.
//   BOTH WRITERS AND THE MONEY — the same check on the cheap tweak rung (whose
//     refusal must not buy the rewrite), a judge that cannot answer, the job
//     path's reservations, and a mixed request where another step succeeded.
//
// ⚠ EVERY MODEL ANSWER HERE IS SUPPLIED — the writers' AND THE JUDGE'S. What
// these cases prove is the PATH: which losses are found, that each is asked
// about, how an answer is read and checked, and what happens to the site and
// the money in each outcome. They prove NOTHING about whether a real model,
// shown this prompt, judges a message correctly. The judge's rules tell it that
// a request to keep something is not a request to remove it; one case below
// supplies a judge that ignores that, and the loss publishes — because a quote
// that is really in the message and names its item is all code can check.
//
// ⚠ AND WHAT STAYS OPEN: a section of plain words or kit-only markup has no
// literal link and none of the site's own components, so nothing here reads
// its loss. The "Opening hours" drop is kept as that reproduction, and it
// still publishes.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { pickTool, editTool } from "../builder/site-lanes.mjs";
import { TWEAK_TOOL } from "../builder/site-tweak.mjs";
import { SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { pageCredits } from "../builder/publish-pages.mjs";
import { modelsFor } from "../builder/build-models.mjs";
import { linkSlots } from "../builder/site-nav.mjs";
import { localParts, partUse } from "../builder/site-files.mjs";
import {
  KEEP_TOOL, KEEP_RULES, KEEP_UNCHECKED_MSG, keepInventory, pairLinks, partStates, quoteInMessage,
  quoteNamesItem, readKeep, keepRequest, keepWithheldMsg,
} from "../builder/page-keep.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const T = {
  pick: pickTool().name, tweak: TWEAK_TOOL.name, pages: SITE_PAGES_TOOL.name,
  keep: KEEP_TOOL.name, lane: editTool("css").name,
};
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
const KEEP_ASK = "Show the opening hours on the home page as a short list: weekdays 7am to 4pm, Saturday 8am to 2pm — and keep the order form.";
const PHONE_ASK = "Take the phone number off the home page.";
const BIGGER_ASK = "Make the “Opening hours” heading on the home page bigger.";

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
// no literal link and none of the site's own components: the class this
// protection does NOT reach, kept so the gap stays visible.
const HERO_NEW = HERO.replace("Bread from the harbour", "Fresh bread from the harbour");
const DROPS_HOURS = home(HERO_NEW, ORDER, VISIT);
// THE CHEAP WRITER'S ANSWERS. A tweak may not move words (`sameProse`) and may
// not move one of the site's own components (`partEligible`), so what can
// reach the check on this rung is a link pointed somewhere else.
const HOURS_BIG = HOURS.replace("<h2>", "<h2 className=\"text-3xl\">");
const TWEAK_NARROW = home(HERO, HOURS_BIG, ORDER, VISIT);
const TWEAK_WIDE = home(HERO, HOURS_BIG, ORDER, VISIT.replace("to=\"/visit\"", "to=\"/contact\""));

// ── WHAT THE JUDGE ANSWERS (always supplied) ────────────────────────────────
const asks = (n, quote) => ({ n, asked: true, quote });
const no = (n) => ({ n, asked: false });
const judged = (...answers) => ({ answers });

// ── THE MONEY ───────────────────────────────────────────────────────────────
// Every writer call reports the same usage and the judge a larger one, so a
// judge billed on a publish moves the charge where a reader can see it.
const MODEL = modelsFor("sonnet").quick;
const CALL = { input_tokens: 1000, output_tokens: 500 };
const JUDGE = { input_tokens: 2000, output_tokens: 1000 };
const LANE = { input_tokens: 300, output_tokens: 60 };
const U = (u) => ({ model: MODEL, in: u.input_tokens, out: u.output_tokens, cacheRead: 0, cacheWrite: 0 });
const credits = (...us) => pageCredits(...us.map(U));

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
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const hex = (n) => randomBytes(n).toString("hex");

// The file a cheap-writer call was shown: its prompt carries it after "THE FILE (".
function shownFile(args) {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  return rest.slice(rest.indexOf(")\n") + 2);
}

/**
 * ONE EDIT THROUGH `POST /api/site/<slug>/edit`, on either money path.
 *
 * `route` is what the router decided; `pick` the lane picker's answer on the
 * look route; `tweak` the cheap writer's page as a function of what it was
 * shown (absent: it declines, so the full writer runs); `answer` the full
 * writer's page; `judge` the preservation judge's answer — an object, a
 * function of the request, or "fail" / "garbled"; `lane` the css lane's answer.
 * A model tool with no supplied answer is recorded and refused (503), so a case
 * passes only on the calls it names — and every call is in the log either way.
 */
async function drive({ mode = "sync", route, ask, pick = null, tweak = null, answer = null, judge = null, lane = null }) {
  const slug = "keep-" + mode + "-" + hex(4);
  const b = bucket(slug);
  const id = hex(16), secret = hex(16);
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const reqBody = JSON.stringify({
    layer: "page", page: "/", remove: false, rename: "", tab: false, ...route,
    instruction: ask, picker: "sonnet", idem: "idem" + hex(8),
  });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body: reqBody, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { calls: [], debits: [], judged: [], rpc: [] };
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
      const said = (input, usage = CALL) => json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input }], usage });
      if (tool === T.pick && pick) return said(pick);
      if (tool === T.tweak) return tweak ? said({ source: tweak(shownFile(args)) }) : said({ cannot: "that needs the page rewritten" });
      if (tool === T.pages && answer) return said({ pages: [{ path: "src/routes/index.tsx", source: answer }] });
      if (tool === T.lane && lane) return said(lane, LANE);
      if (tool === T.keep) {
        seen.judged.push(args);
        if (judge === "fail") return new Response("overloaded", { status: 503 });
        if (judge === "garbled") return json({ stop_reason: "end_turn", content: [{ type: "text", text: "Probably fine." }], usage: JUDGE });
        const input = typeof judge === "function" ? judge(args) : judge;
        if (input) return said(input, JUDGE);
      }
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
      const res = await worker.fetch(new Request(url, {
        method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body: reqBody,
      }), env, ctx);
      status = res.status; ok = res.ok;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const files = c.calls.map((k) => (k.body && k.body.files) || {});
    const compiledOf = (f) => f["src/routes/index.tsx"] || f["index.tsx"] || null;
    const pages = JSON.parse(b.store.get("source/" + slug + "/pages.json"));
    const parts = JSON.parse(b.store.get("source/" + slug + "/parts.json"));
    const config = JSON.parse(b.store.get(CONFIG_KEY(slug)));
    return {
      status, reply, calls: seen.calls, debits: seen.debits, judged: seen.judged,
      compiles: c.calls.length, compiled: files.length ? compiledOf(files[0]) : null,
      stored: pages.find((p) => p.path === "index.tsx").source,
      others: OTHER_PAGES.map((o) => (pages.find((p) => p.path === o.path) || {}).source),
      parts, css: config.css,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => ({ seq: r.args.p_seq, cost: Number(r.args.p_cost) })),
      finalized: seen.rpc.filter((r) => r.fn === "edit_finalize").map((r) => r.args.p_ok),
      said: editBrowserReply(reply, ok, { cost: 2 }),
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

// What EVERY publishing case shares: one compile carrying the writer's answer,
// the same answer stored, the other pages and the component FILE untouched.
function published(r, answer, { calls, debits }) {
  assert.equal(r.status, 200, "the edit published: " + JSON.stringify(r.reply));
  assert.deepEqual(r.calls, calls, "the model calls");
  assert.equal(r.compiles, 1, "one compile");
  assert.equal(r.compiled, answer, "the compiler payload is the writer's answer, byte for byte");
  assert.equal(r.stored, answer, "the store holds the writer's answer, byte for byte");
  assert.deepEqual(r.others, OTHER_PAGES.map((o) => o.source), "the other pages are byte-identical");
  assert.deepEqual(r.parts, [{ name: "order-form", source: ORDER_FORM }], "the component's FILE is untouched");
  assert.deepEqual(r.debits, debits, "the charge");
}

// What EVERY refusal shares: NOTHING compiled, NOTHING stored, NOTHING charged,
// and the refusal's shape the photo protection already established — so the
// merge, the browser and the job path read it without a new branch.
function refused(r, { calls, status = 409 }) {
  assert.equal(r.status, status, "refused: " + JSON.stringify(r.reply));
  assert.equal(r.reply && r.reply.ok, false);
  assert.equal(r.reply.error, "withheld");
  assert.equal(r.reply.cost, 0, "the edit cost nothing");
  assert.deepEqual(r.calls, calls, "the model calls");
  assert.equal(r.compiles, 0, "nothing was compiled");
  assert.equal(r.stored, HOME, "the stored page is byte-identical to before");
  assert.deepEqual(r.others, OTHER_PAGES.map((o) => o.source), "the other pages are byte-identical");
  assert.deepEqual(r.parts, [{ name: "order-form", source: ORDER_FORM }], "the component's FILE is untouched");
  assert.deepEqual(r.debits, [], "nothing was charged");
}
const PAGE = [T.tweak, T.pages];
const PAGE_JUDGED = [T.tweak, T.pages, T.keep];
const LOOK_JUDGED = [T.pick, T.tweak, T.pages, T.keep];
const UPDATED = "✅ Updated /.";
const WHOLE = " Nothing on your site changed, and this edit cost you nothing. Reading your message cost 2 credits.";

// ── WHAT THE EXISTING READERS SEE ───────────────────────────────────────────
const links = (src) => linkSlots([{ path: "index.tsx", source: src }]).map((l) => l.label + " → " + l.href);
const use = (src) => partUse(src, "order-form");

test("the readers the check leans on see the page's two links and its own component, rendered", () => {
  assert.deepEqual(links(HOME), ["See the menu → /menu", "Directions → /visit"]);
  assert.deepEqual(localParts(HOME).map((p) => p.name), ["order-form"]);
  assert.equal(use(HOME), "rendered");
});

// ═════ THE INVENTORY, DRIVEN ═══════════════════════════════════════════════

const DOES = [{ name: "order-form", does: "the order-ahead form", props: "none" }];
const inv = (after) => keepInventory(HOME, after, { does: DOES });
const brief = (it) => [it.kind, it.label || it.name, it.href || "", it.to || "", it.section];

test("the inventory finds exactly what each answer lost, and nothing in a correct one", () => {
  assert.deepEqual(inv(CORRECT).items, [], "a correct narrow edit loses nothing");
  assert.deepEqual(inv(REORDERED).items, [], "a reorder loses nothing");
  assert.deepEqual(inv(DROPS_HOURS).items, [], "a plain-words section is outside the inventory — the open class");
  assert.deepEqual(inv(DROPS_VISIT).items.map(brief), [["link-lost", "Directions", "/visit", "", "Find us"]]);
  assert.deepEqual(inv(SWAPS_LINK).items.map(brief), [["link-lost", "Directions", "/visit", "", "Find us"]],
    "the added link does not offset the lost one");
  assert.deepEqual(inv(RETARGETED).items.map(brief), [["link-moved", "Directions", "/visit", "/contact", "Find us"]]);
  assert.deepEqual(inv(DROPS_ORDER).items.map((i) => [i.kind, i.name, i.section, i.how, i.does]),
    [["part-gone", "order-form", "Order ahead", "import-kept", "the order-ahead form"]]);
  assert.deepEqual(inv(DROPS_ORDER_BARE).items.map((i) => [i.kind, i.name, i.how]),
    [["part-gone", "order-form", "import-removed"]], "the import line gone too is still a confirmed absence");
  assert.deepEqual(inv(REMOVED_PLUS).items.map((i) => i.kind), ["link-lost", "part-gone"]);
});

test("an uncertain component is kept apart from a confirmed loss: never an item to refuse on", () => {
  const a = inv(ALIASED);
  assert.deepEqual(a.items, [], "an alias the reader cannot see drawn is NOT a loss");
  assert.deepEqual(a.unsure.map((u) => [u.name, u.how, u.section]), [["order-form", "not-provably-drawn", "Order ahead"]]);
});

test("the component table, row by row", () => {
  const S = (after) => partStates(HOME, after);
  assert.deepEqual(S(CORRECT), { gone: [], unsure: [] }, "rendered → rendered is kept");
  assert.deepEqual(S(DROPS_ORDER).gone.map((g) => g.how), ["import-kept"], "rendered → unused");
  assert.deepEqual(S(DROPS_ORDER_BARE).gone.map((g) => g.how), ["import-removed"], "rendered → none, no tag left");
  // The import gone but the tag still drawn: a local definition, or a page that
  // no longer compiles — either way the reader cannot say the site's own form
  // is on the page, and cannot say it is not.
  const TAG_NO_IMPORT = bare(HERO, HOURS, ORDER, VISIT);
  assert.deepEqual(S(TAG_NO_IMPORT), { gone: [], unsure: [{ name: "order-form", section: "Order ahead", how: "tag-without-import" }] });
  assert.deepEqual(S(ALIASED).unsure.map((u) => u.how), ["not-provably-drawn"], "rendered → unsure");
  // A before the reader never confirmed: nothing is protected, only reported.
  const ALIAS_BEFORE = IMPORTS + PART_IMPORT + ROUTE + "const Form = OrderForm\n" + body(HERO, HOURS, "<section><h2>Order ahead</h2><Form /></section>", VISIT);
  assert.deepEqual(partStates(ALIAS_BEFORE, DROPS_ORDER), { gone: [], unsure: [{ name: "order-form", section: "", how: "never-confirmed" }] },
    "unsure → unused is uncertain, never a confirmed loss");
  assert.deepEqual(partStates(ALIAS_BEFORE, HOME), { gone: [], unsure: [] }, "unsure → rendered reports nothing");
});

// ═════ PAIRING: EXACT IDENTITY FIRST, SO REPEATS AND REORDERS MANUFACTURE NOTHING

const band = (title, ...links) => "<section><h2>" + title + "</h2>" + links.join("") + "</section>";
const L = (to, words) => "<Link to=\"" + to + "\">" + words + "</Link>";
const pg = (...blocks) => IMPORTS + ROUTE + body(...blocks);
const summary = (p) => ({
  lost: p.lost.map((l) => l.label + " → " + l.href + " @" + l.section),
  retargeted: p.retargeted.map((l) => l.label + " " + l.href + "→" + l.to + " @" + l.section),
  relabeled: p.relabeled.length, added: p.added.length,
});
const NOTHING = { lost: [], retargeted: [], relabeled: 0, added: 0 };

test("reordered sections and reordered links pair every link with itself", () => {
  const before = pg(band("Classes", L("/book", "Book now"), L("/prices", "Prices")), band("Parties", L("/book", "Book now")));
  const sectionsSwapped = pg(band("Parties", L("/book", "Book now")), band("Classes", L("/book", "Book now"), L("/prices", "Prices")));
  const linksSwapped = pg(band("Classes", L("/prices", "Prices"), L("/book", "Book now")), band("Parties", L("/book", "Book now")));
  assert.deepEqual(summary(pairLinks(before, sectionsSwapped)), NOTHING);
  assert.deepEqual(summary(pairLinks(before, linksSwapped)), NOTHING);
});

test("a repeated label: removing ONE section loses the link in THAT section, whichever comes first", () => {
  const before = pg(band("Classes", L("/book", "Book now")), band("Parties", L("/book", "Book now")));
  assert.deepEqual(summary(pairLinks(before, pg(band("Classes", L("/book", "Book now"))))),
    { ...NOTHING, lost: ["Book now → /book @Parties"] }, "the second section removed");
  // THE DISCRIMINATING HALF: document order alone would pair the first
  // before-link with the survivor and report the loss in the wrong section.
  assert.deepEqual(summary(pairLinks(before, pg(band("Parties", L("/book", "Book now"))))),
    { ...NOTHING, lost: ["Book now → /book @Classes"] }, "the FIRST section removed");
});

test("a link that moved to another section keeps its identity, even when a same-words link to a new place appears first", () => {
  // THE OWNER'S ORDER, DRIVEN: exact identity across the whole page BEFORE any
  // retarget. Asked in document order alone, "Book now → /offers" would claim
  // the moved "Book now → /book" as a retarget — a change the writer never made.
  const before = pg(band("Classes", L("/book", "Book now")));
  const after = pg(band("Offers", L("/offers", "Book now")), band("Parties", L("/book", "Book now")));
  assert.deepEqual(summary(pairLinks(before, after)), { ...NOTHING, added: 1 });
});

test("a repeated label with one link re-pointed: the retarget lands in its own section and the twin is kept", () => {
  const before = pg(band("Classes", L("/book", "Book now")), band("Parties", L("/book", "Book now")));
  const after = pg(band("Classes", L("/book", "Book now")), band("Parties", L("/parties", "Book now")));
  assert.deepEqual(summary(pairLinks(before, after)), { ...NOTHING, retargeted: ["Book now /book→/parties @Parties"] });
});

test("new words on the same destination are a relabel, kept; a link gone with another added is a loss plus an addition", () => {
  const before = pg(band("Find us", L("/visit", "Directions")));
  assert.deepEqual(summary(pairLinks(before, pg(band("Find us", L("/visit", "How to get here"))))), { ...NOTHING, relabeled: 1 });
  assert.deepEqual(summary(pairLinks(before, pg(band("Find us", L("/contact", "Get in touch"))))),
    { ...NOTHING, lost: ["Directions → /visit @Find us"], added: 1 });
});

test("a wordless link pairs by destination alone: kept where it stayed, lost where it moved", () => {
  const before = pg(band("Hello", "<Link to=\"/\"><img src=\"/logo.svg\" alt=\"\" /></Link>"));
  assert.deepEqual(summary(pairLinks(before, before)), NOTHING);
  const moved = pairLinks(before, pg(band("Hello", "<Link to=\"/menu\"><img src=\"/logo.svg\" alt=\"\" /></Link>")));
  assert.equal(moved.retargeted.length, 0, "no words to recognise it by, so never a retarget");
  assert.deepEqual(moved.lost.map((l) => l.href), ["/"]);
});

// ═════ THE QUOTE: IN THE MESSAGE, AND ABOUT THE ITEM ═══════════════════════

test("a quote must really occur in the message — whole words, case, spacing and quote marks folded", () => {
  assert.equal(quoteInMessage(REMOVE_ASK, "Take the “Find us” section off"), true, "curly quotes against straight ones");
  assert.equal(quoteInMessage(REMOVE_ASK, "take   the find us SECTION off"), true, "case and spacing");
  assert.equal(quoteInMessage(REMOVE_ASK, "remove the Find us section"), false, "a paraphrase is not a quote");
  assert.equal(quoteInMessage(REMOVE_ASK, "us"), false, "too short to mean anything");
  assert.equal(quoteInMessage("Keep yours as it is", "ours"), false, "whole words only");
  assert.equal(quoteInMessage(REMOVE_ASK, ""), false);
});

test("a quote must name its item: the genuine “Find us” quote answers for Directions and not for the order form", () => {
  const [directions, orderForm] = inv(REMOVED_PLUS).items;
  const q = "Take the \"Find us\" section off";
  assert.equal(quoteNamesItem(q, directions), true, "Directions sat under “Find us”");
  assert.equal(quoteNamesItem(q, orderForm), false, "the order form sat under “Order ahead”");
  // ⚠ THE LIMIT, STATED IN THE GUARD: naming is not authorising. "keep the
  // order form" names the order form perfectly well — whether it asks for the
  // form to GO is the judge's reading, and nothing here can check it.
  assert.equal(quoteNamesItem("keep the order form", orderForm), true);
});

test("the judge's answer is read fail-closed, each refusal with its own reason", () => {
  const items = inv(REMOVED_PLUS).items;
  const reply = (input) => ({ content: [{ type: "tool_use", name: T.keep, input }] });
  const why = (input, message = REMOVE_ASK) => readKeep(reply(input), { message, items }).unasked.map((u) => u.why);
  assert.deepEqual(readKeep({ content: [{ type: "text", text: "yes" }] }, { message: REMOVE_ASK, items }), { ok: false, why: "no-answer" });
  assert.deepEqual(why(judged()), ["unanswered", "unanswered"], "an item left out is not asked");
  assert.deepEqual(why(judged(no(1), no(2))), ["not-asked", "not-asked"]);
  assert.deepEqual(why(judged(asks(1, "Take the \"Find us\" section off"), no(1), no(2))), ["conflicting", "not-asked"]);
  assert.deepEqual(why(judged({ n: 1, asked: "true", quote: "Take the \"Find us\" section off" }, no(2))), ["not-asked", "not-asked"],
    "the string \"true\" is not a yes");
  assert.deepEqual(why(judged(asks(1, ""), no(2))), ["no-quote", "not-asked"]);
  assert.deepEqual(why(judged(asks(1, "remove the directions"), no(2))), ["quote-not-in-message", "not-asked"]);
  assert.deepEqual(why(judged(asks(1, "Take the \"Find us\" section off"), asks(2, "Take the \"Find us\" section off"))), ["quote-not-about-item"],
    "the genuine quote is accepted for the item it names and refused for the one it does not");
  assert.deepEqual(readKeep(reply(judged(asks(1, "Take the \"Find us\" section off"), no(2))), { message: REMOVE_ASK, items }).asked.map((a) => a.label), ["Directions"]);
});

test("the judge is shown the message verbatim and every item by its words, destination and heading", () => {
  const req = keepRequest({ message: REMOVE_ASK, items: inv(REMOVED_PLUS).items, model: "sentinel-model" });
  assert.equal(req.model, "sentinel-model", "the picker's model, not a pinned one");
  assert.deepEqual(req.tool_choice, { type: "tool", name: T.keep });
  assert.equal(req.system, KEEP_RULES);
  const content = req.messages[0].content;
  assert.ok(content.includes(REMOVE_ASK), "the message, word for word");
  assert.ok(content.includes("1. A link that is no longer on the page — its words “Directions”, it went to /visit, under the heading “Find us”."), content);
  assert.ok(content.includes("2. One of the site's own sections, no longer on the page — the component “order-form”, which is the order-ahead form, under the heading “Order ahead”."), content);
  // The rules say the two things the negative controls below lean on.
  assert.ok(KEEP_RULES.includes("A message that asks to KEEP something, or only mentions it, does not ask for it to go."));
  assert.ok(KEEP_RULES.includes("Asking for one thing never asks for anything else."));
});

test("the refusal names what would also have happened, in the customer's words, and claims nothing about the whole request", () => {
  const items = inv(REMOVED_PLUS).items;
  const msg = keepWithheldMsg(items);
  assert.equal(msg, "I couldn't make that change without also taking the “Directions” link under “Find us” and the “Order ahead” section off the page, which your message didn't ask for — so I didn't make it. If you do want those changes, say so in your message and send it again.");
  assert.ok(!/order-form/.test(msg), "never a file name");
  assert.ok(!/Nothing on your site changed|charged|cost you nothing/.test(msg), "rung-scoped: the browser speaks for the whole request");
  assert.equal(keepWithheldMsg(inv(RETARGETED).items),
    "I couldn't make that change without also pointing the “Directions” link at /contact instead of /visit, which your message didn't ask for — so I didn't make it. If you do want that change, say so in your message and send it again.");
});

// ═════ PROTECTED — the five reproductions, flipped ═════════════════════════

test("PROTECTED: a narrow edit whose answer also drops the “Find us” section and its link is refused", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_VISIT, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked, [{ kind: "link-lost", label: "Directions", href: "/visit", section: "Find us", why: "not-asked" }]);
  assert.equal(r.said.text, "⚠️ " + keepWithheldMsg(inv(DROPS_VISIT).items) + WHOLE);
  assert.deepEqual(r.said.actions, [], "nothing further is bought — no rewrite starts");
});

test("PROTECTED: the section rendering the site's own component dropped, its import line kept, is refused", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_ORDER, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.equal(use(DROPS_ORDER), "unused", "a CONFIRMED absence");
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.kind, b.name, b.section, b.why]), [["part-gone", "order-form", "Order ahead", "not-asked"]]);
  assert.ok(r.reply.msg.includes("the “Order ahead” section"), r.reply.msg);
  // The site's own declaration of what the component DOES reaches the judge
  // through the route — read from the stored look, not from the test.
  assert.ok(r.judged[0].messages[0].content.includes("which is the order-ahead form"), r.judged[0].messages[0].content);
});

test("PROTECTED: the same component dropped with its import line taken out too is refused", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_ORDER_BARE, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.equal(use(DROPS_ORDER_BARE), "none", "the after page no longer imports it — read against the BEFORE, it is still a loss");
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.name, b.why]), [["order-form", "not-asked"]]);
});

test("PROTECTED: a link removed while a DIFFERENT link is added is refused — the count is unchanged and does not hide it", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: SWAPS_LINK, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.equal(links(SWAPS_LINK).length, links(HOME).length, "two links before, two after");
  assert.deepEqual(r.reply.contentBlocked.map((b) => b.label), ["Directions"]);
});

test("PROTECTED: an authorised removal of “Find us” does not authorise losing the order form (look, the picker marks a removal)", async () => {
  const r = await drive({
    route: { layer: "look" }, ask: REMOVE_ASK,
    pick: { fields: ["components"], removes: ["components"] }, answer: REMOVED_PLUS,
    judge: judged(asks(1, "Take the \"Find us\" section off"), no(2)),
  });
  refused(r, { calls: LOOK_JUDGED });
  // THE ASKED-FOR HALF WAS ACCEPTED; ONLY THE OTHER IS NAMED.
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.kind, b.why]), [["part-gone", "not-asked"]]);
  assert.ok(!r.reply.msg.includes("Directions"), "the removal that WAS asked for is not complained about");
  assert.ok(r.reply.msg.includes("the “Order ahead” section"), r.reply.msg);
});

// ═════ MUST STAY PUBLISHED ═════════════════════════════════════════════════

test("MUST STAY PUBLISHED: the correct narrow edit — no judge call, the ordinary charge", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: CORRECT });
  published(r, CORRECT, { calls: PAGE, debits: [credits(CALL, CALL)] });
  assert.equal(r.said.text, UPDATED);
  assert.equal(r.reply.keepUsage, undefined, "nothing was lost, so nothing was asked and nothing billed for it");
});

test("MUST STAY PUBLISHED: a reorder — every section moved, nothing lost, no judge call", async () => {
  const r = await drive({ route: { layer: "page" }, ask: REORDER_ASK, answer: REORDERED });
  published(r, REORDERED, { calls: PAGE, debits: [credits(CALL, CALL)] });
  assert.equal(r.said.text, UPDATED);
});

test("MUST STAY PUBLISHED: an intentional section removal through look — asked item by item, and billed with the edit", async () => {
  const r = await drive({
    route: { layer: "look" }, ask: REMOVE_ASK,
    pick: { fields: ["components"], removes: ["components"] }, answer: REMOVED,
    judge: judged(asks(1, "Take the \"Find us\" section off")),
  });
  published(r, REMOVED, { calls: LOOK_JUDGED, debits: [credits(CALL, CALL, CALL, JUDGE)] });
  assert.equal(r.said.text, UPDATED);
  assert.ok(credits(CALL, CALL, CALL, JUDGE) > credits(CALL, CALL, CALL), "the judge's tokens really moved the charge");
  assert.deepEqual(r.reply.keepUsage, { model: MODEL, in: 2000, out: 1000, cacheRead: 0, cacheWrite: 0 });
  assert.equal(r.judged.length, 1);
  assert.ok(r.judged[0].messages[0].content.includes(REMOVE_ASK), "the judge saw the customer's message");
});

test("MUST STAY PUBLISHED: the same removal routed straight to the page layer — the same permission, from the same words", async () => {
  const r = await drive({ route: { layer: "page" }, ask: REMOVE_ASK, answer: REMOVED, judge: judged(asks(1, "Take the \"Find us\" section off")) });
  published(r, REMOVED, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(r.said.text, UPDATED);
  assert.ok(!r.calls.includes(T.pick), "no lane picker ran on this route, so no removal mark of any kind");
});

test("MUST STAY PUBLISHED: a requested retarget — the same words, a new destination", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: RETARGET_ASK, answer: RETARGETED,
    judge: judged(asks(1, "Send the Directions link on the home page to the contact page")),
  });
  published(r, RETARGETED, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(r.said.text, UPDATED);
  assert.ok(r.judged[0].messages[0].content.includes("it went to /visit and now goes to /contact"), "the judge was told both destinations");
});

test("MUST STAY PUBLISHED: a component the rewrite still renders through an alias is NAMED as unconfirmed, never refused, never judged", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: ALIASED });
  published(r, ALIASED, { calls: PAGE, debits: [credits(CALL, CALL)] });
  assert.equal(use(ALIASED), "unsure");
  assert.deepEqual(r.reply.partsUnsure, ["the “Order ahead” section"]);
  assert.equal(r.said.text, UPDATED + " I couldn’t confirm that the “Order ahead” section is still on the page — have a look before you share it.");
});

test("OPEN, AND OUTSIDE THE INVENTORY: a section of plain words dropped still publishes — this protection does not reach it", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HERO_ASK, answer: DROPS_HOURS });
  published(r, DROPS_HOURS, { calls: PAGE, debits: [credits(CALL, CALL)] });
  assert.ok(!r.stored.includes("Opening hours"), "the hours section, which nobody mentioned, is gone");
  assert.equal(r.said.text, UPDATED);
  assert.deepEqual(links(DROPS_HOURS), links(HOME));
  assert.equal(use(DROPS_HOURS), "rendered");
});

// ═════ NEGATIVE CONTROLS ═══════════════════════════════════════════════════

test("NEGATIVE: “and keep the order form” is not permission to drop it — no code path treats a mention as a yes", async () => {
  const r = await drive({ route: { layer: "page" }, ask: KEEP_ASK, answer: DROPS_ORDER, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.ok(r.judged[0].system.includes("A message that asks to KEEP something, or only mentions it, does not ask for it to go."),
    "the rule the judge was given");
});

test("LIMIT, NOT A PROTECTION: a judge that misreads “keep the order form” as permission is believed — the quote is real and names the item", async () => {
  // Kept so the boundary is on the record rather than assumed away: a verified
  // quote proves the words occur in the request, and whether they AUTHORISE
  // the loss is the model's judgement. This is supplied output; it says nothing
  // about how often a real model reads it this way.
  const r = await drive({ route: { layer: "page" }, ask: KEEP_ASK, answer: DROPS_ORDER, judge: judged(asks(1, "keep the order form")) });
  published(r, DROPS_ORDER, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
});

test("NEGATIVE: an unrelated removal instruction does not cover a section it never named — even with the picker's removal mark", async () => {
  const r = await drive({
    route: { layer: "look" }, ask: PHONE_ASK,
    pick: { fields: ["components"], removes: ["components"] }, answer: DROPS_VISIT, judge: judged(no(1)),
  });
  refused(r, { calls: LOOK_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.label, b.why]), [["Directions", "not-asked"]]);
});

test("NEGATIVE: the unrelated removal's own words, attached by the judge to the lost link, are refused as not about it", async () => {
  const r = await drive({ route: { layer: "page" }, ask: PHONE_ASK, answer: DROPS_VISIT, judge: judged(asks(1, "Take the phone number off")) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => b.why), ["quote-not-about-item"]);
});

test("NEGATIVE: a genuine quote attached to the wrong item — accepted for the item it names, refused for the other", async () => {
  const q = "Take the \"Find us\" section off";
  const r = await drive({ route: { layer: "page" }, ask: REMOVE_ASK, answer: REMOVED_PLUS, judge: judged(asks(1, q), asks(2, q)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.kind, b.name, b.why]), [["part-gone", "order-form", "quote-not-about-item"]]);
});

test("NEGATIVE: a quote that is not in the message is not permission", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_ORDER, judge: judged(asks(1, "remove the order form")) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => b.why), ["quote-not-in-message"]);
});

// ═════ A JUDGE THAT CANNOT ANSWER — FAIL CLOSED, AND OURS ══════════════════

for (const judge of ["fail", "garbled"]) {
  test("a judge that " + (judge === "fail" ? "cannot be reached" : "answers without the tool") + " refuses the change, ours, at no cost", async () => {
    const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_VISIT, judge });
    refused(r, { calls: PAGE_JUDGED, status: 503 });
    assert.equal(r.reply.ours, true);
    assert.equal(r.reply.msg, KEEP_UNCHECKED_MSG);
    assert.deepEqual(r.reply.contentUnchecked.map((b) => b.label), ["Directions"]);
    assert.equal(r.said.text, "⚠️ " + KEEP_UNCHECKED_MSG + WHOLE);
    assert.deepEqual(r.said.actions, []);
  });
}

// ═════ THE CHEAP TWEAK RUNG — THE SAME CHECK, AND NO FALL-THROUGH ══════════

test("TWEAK: a tweak that also re-points a link nobody mentioned is refused, and the rewrite is NOT bought", async () => {
  const r = await drive({ route: { layer: "page" }, ask: BIGGER_ASK, tweak: () => TWEAK_WIDE, judge: judged(no(1)) });
  refused(r, { calls: [T.tweak, T.keep] });
  assert.ok(!r.calls.includes(T.pages), "the full writer never ran");
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.kind, b.label, b.href, b.to]), [["link-moved", "Directions", "/visit", "/contact"]]);
});

test("TWEAK: a requested retarget through the tweak publishes, the judge billed with it", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: RETARGET_ASK, tweak: () => RETARGETED,
    judge: judged(asks(1, "Send the Directions link on the home page to the contact page")),
  });
  published(r, RETARGETED, { calls: [T.tweak, T.keep], debits: [credits(CALL, JUDGE)] });
  assert.equal(r.reply.tweak, true, "the cheap rung answered");
});

test("TWEAK: a visual tweak that loses nothing asks nobody", async () => {
  const r = await drive({ route: { layer: "page" }, ask: BIGGER_ASK, tweak: () => TWEAK_NARROW });
  published(r, TWEAK_NARROW, { calls: [T.tweak], debits: [credits(CALL)] });
  assert.equal(r.reply.tweak, true);
});

// ═════ THE MONEY ON THE JOB PATH, AND A MIXED REQUEST ══════════════════════

test("JOB PATH: a refusal reserves nothing, compiles nothing and stores nothing", async () => {
  const r = await drive({ mode: "job", route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_ORDER, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reserves, [], "no reservation was made");
  assert.deepEqual(r.finalized, [false], "the job finalized as not published");
});

test("JOB PATH: an asked-for removal reserves once, the judge in the one charge", async () => {
  const r = await drive({ mode: "job", route: { layer: "page" }, ask: REMOVE_ASK, answer: REMOVED, judge: judged(asks(1, "Take the \"Find us\" section off")) });
  assert.equal(r.status, 200, JSON.stringify(r.reply));
  assert.equal(r.stored, REMOVED);
  assert.deepEqual(r.reserves, [{ seq: 1, cost: credits(CALL, CALL, JUDGE) }]);
});

const FOOTER = "footer{background-color:#0b3d2e}";
for (const mode of ["sync", "job"]) {
  test("MIXED (" + mode + "): a stylesheet change beside a refused page change — the style ships, the page does not, only the style is charged", async () => {
    const r = await drive({
      mode, route: { layer: "look" }, ask: "Make the footer dark green, and show the opening hours as a short list.",
      pick: { fields: ["css", "components"] }, lane: { css: FOOTER }, answer: DROPS_ORDER, judge: judged(no(1)),
    });
    assert.equal(r.status, 200, "the message as a whole went through: " + JSON.stringify(r.reply));
    assert.deepEqual(r.calls, [T.pick, T.lane, T.tweak, T.pages, T.keep], "the model calls");
    assert.equal(r.compiles, 1, "one compile, for the stylesheet");
    assert.equal(r.compiled, HOME, "the compiler got the home page as it was — not the rewrite");
    assert.equal(r.stored, HOME, "the store keeps the home page as it was");
    assert.deepEqual(r.others, OTHER_PAGES.map((o) => o.source));
    assert.deepEqual(r.parts, [{ name: "order-form", source: ORDER_FORM }]);
    assert.equal(r.css, FOOTER, "the stylesheet change shipped");
    const styleOnly = credits(CALL, LANE);
    if (mode === "sync") assert.deepEqual(r.debits, [styleOnly], "charged for the picker and the stylesheet, nothing for the refused page");
    else assert.deepEqual(r.reserves, [{ seq: 1, cost: styleOnly }], "reserved for the picker and the stylesheet only");
    const blocked = (r.reply.partial || []).find((p) => p.error === "withheld");
    assert.ok(blocked, "the refused page step is on the reply: " + JSON.stringify(r.reply.partial));
    assert.equal(blocked.msg, keepWithheldMsg(inv(DROPS_ORDER).items));
    assert.ok(r.said.text.includes("⚠️ " + keepWithheldMsg(inv(DROPS_ORDER).items)), r.said.text);
    assert.ok(!r.said.text.includes("Nothing on your site changed"), "something DID change, so the whole-request note must not say otherwise");
  });
}
