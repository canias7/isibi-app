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
//   GROUPS — the owner's reproduction (2026-09-24): *"Remove all links from
//     the home page, keeping their text and everything else"* was refused for
//     both links as `quote-not-about-item`, because a quote had to name each
//     item and a request about a group names none. A group the judge DECLARES
//     is now the other way a quote can cover an item, checked by the one thing
//     code can know without reading English — the item is a kind that group can
//     hold. Still judged item by item: "all the links except Directions", and a
//     links group asked beside an unrelated component loss, which is refused.
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
// The former plain-text Opening hours reproduction now refuses through
// page-prose.mjs. The route cases at the end exercise that independent parsed
// check, including acceptance, ambiguity, rendered output and queued billing.

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
  KEEP_TOOL, KEEP_RULES, KEEP_UNCHECKED_MSG, KEEP_GROUPS, keepInventory, pairLinks, partStates, quoteInMessage,
  quoteNamesItem, groupCovers, readKeep, keepRequest, keepWithheldMsg,
} from "../builder/page-keep.mjs";
import { PROSE_WITHHELD, preservePageProse } from "../builder/page-prose.mjs";
import { renderPart } from "./fixtures/render-part.mjs";
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
// A GROUP ASKED FOR AT ONCE. The first is the owner's reproduction, verbatim.
const ALL_LINKS_ASK = "Remove all links from the home page, keeping their text and everything else.";
const EXCEPT_ASK = "Remove all the links from the home page except Directions, keeping their text.";
const SECTIONS_ASK = "Take every section off the home page except the opening hours.";
const UNDER_ASK = "Remove all links under ‘Order ahead’, keeping their text.";
const FORM_ASK = "Take the order form out of ‘Order ahead’ on the home page.";
// The words a judge quotes for each group — really in its message.
const Q_ALL = "Remove all links from the home page";
const Q_EXCEPT = "Remove all the links from the home page";
const Q_SECTIONS = "Take every section off the home page";
const Q_UNDER = "Remove all links under ‘Order ahead’";
const Q_FORM = "Take the order form out";

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
// THE GROUP ANSWERS. A link taken off with its words left standing — what the
// owner's writer did: the `<Link>` wrapper goes, the text stays.
const unlink = (block, to, words) => block.replace("<Link to=\"" + to + "\">" + words + "</Link>", words);
const HERO_PLAIN = unlink(HERO, "/menu", "See the menu");
const VISIT_PLAIN = unlink(VISIT, "/visit", "Directions");
const UNLINKED = home(HERO_PLAIN, HOURS, ORDER, VISIT_PLAIN);
// "…except Directions", honoured: only the hero's link goes.
const UNLINKED_BUT_DIRECTIONS = home(HERO_PLAIN, HOURS, ORDER, VISIT);
// Every link off as asked — AND the order form gone beside them.
const UNLINKED_DROPS_ORDER = home(HERO_PLAIN, HOURS, VISIT_PLAIN);
// Every section off but the hours: the order form, and the two links that
// were inside the sections that went.
const HOURS_ONLY = home(HOURS);
// THE SHARED HEADING (owner, 2026-09-24). "Order ahead" holds a link of its own
// beside the form, so a quote naming the heading names BOTH of them — which is
// how a links group used to answer for the form: naming passed, and the group's
// kind was never asked. The link's words share nothing with the request; only
// the heading (and the form's own name) does.
const ORDER_LINKED = "<section className=\"order\"><h2>Order ahead</h2><p>Order by 6pm for the next morning.</p><Link to=\"/contact\">Large batches</Link><OrderForm /></section>";
const HOME_ORDER_LINKED = home(HERO, HOURS, ORDER_LINKED, VISIT);
const ORDER_LINKED_PLAIN = unlink(ORDER_LINKED, "/contact", "Large batches");
// The link's wrapper off under "Order ahead", its words and the form kept.
const UNDER_UNLINKED = home(HERO, HOURS, ORDER_LINKED_PLAIN, VISIT);
// The owner's writer: the wrapper off AND the form gone (its import kept).
const UNDER_UNLINKED_DROPS_FORM = home(HERO, HOURS, ORDER_LINKED_PLAIN.replace("<OrderForm />", ""), VISIT);
// The form taken out on its own; the link under the same heading kept.
const UNDER_DROPS_FORM = home(HERO, HOURS, ORDER_LINKED.replace("<OrderForm />", ""), VISIT);

// ── WHAT THE JUDGE ANSWERS (always supplied) ────────────────────────────────
const asks = (n, quote) => ({ n, asked: true, quote });
const no = (n) => ({ n, asked: false });
const judged = (...answers) => ({ answers });
// An item answered as one of a group the message asks for.
const inGroup = (n, quote, group) => ({ n, asked: true, quote, group });

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
function bucket(slug, before = HOME) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([{ path: "index.tsx", source: before }, ...OTHER_PAGES])],
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
 * function of the request, or "fail" / "garbled"; `lane` the css lane's answer;
 * `before` the home page the site starts from (the ordinary fixture unless a
 * case needs a different one).
 * A model tool with no supplied answer is recorded and refused (503), so a case
 * passes only on the calls it names — and every call is in the log either way.
 */
async function drive({ mode = "sync", route, ask, pick = null, tweak = null, answer = null, judge = null, lane = null, before = HOME }) {
  const slug = "keep-" + mode + "-" + hex(4);
  const b = bucket(slug, before);
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
      status, reply, before, calls: seen.calls, debits: seen.debits, judged: seen.judged,
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
  assert.equal(r.reply.error, r.reply.proseBlocked ? "prose-preservation" : "withheld");
  assert.equal(r.reply.cost, 0, "the edit cost nothing");
  assert.deepEqual(r.calls, calls, "the model calls");
  assert.equal(r.compiles, 0, "nothing was compiled");
  assert.equal(r.stored, r.before, "the stored page is byte-identical to before");
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
// The numbered items the judge was shown, one line each — so a case whose
// judge answers three numbers can prove three items were really asked about.
const itemsShown = (r) => String(r.judged[0].messages[0].content).split("\n").filter((l) => /^\d+\. /.test(l));
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
// The refusal the route composes when the JUDGE answered no to every item —
// the one case its "didn't ask for" clause is said in.
const judgedNo = (items) => items.map((it) => ({ ...it, why: "not-asked" }));
const refusalFor = (after) => keepWithheldMsg(judgedNo(inv(after).items));

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

// ═════ A GROUP: DECLARED BY THE JUDGE, CHECKED BY KIND ═════════════════════

test("a declared group holds only the kinds of item it can hold — the inventory's own kinds, no word list", () => {
  assert.deepEqual(Object.keys(KEEP_GROUPS), ["links", "sections"]);
  const [menu] = inv(UNLINKED).items;
  const [moved] = inv(RETARGETED).items;
  const [form] = inv(DROPS_ORDER).items;
  assert.deepEqual([menu.kind, moved.kind, form.kind], ["link-lost", "link-moved", "part-gone"], "one of each kind");
  assert.equal(groupCovers("links", menu), true);
  assert.equal(groupCovers("links", moved), true, "pointing every link somewhere else is a links group too");
  assert.equal(groupCovers("links", form), "group-other-kind", "a group of links holds no section");
  assert.equal(groupCovers("sections", form), true);
  assert.equal(groupCovers("sections", menu), true, "a section taken off takes its links with it");
  assert.equal(groupCovers("sections", moved), "group-other-kind", "taking sections off points no link anywhere");
  assert.equal(groupCovers("pages", menu), "unknown-group");
  assert.equal(groupCovers("constructor", menu), "unknown-group", "an own-property test, never truthiness");
  assert.equal(groupCovers(["links"], menu), "unknown-group", "a list is never coerced into a name");
});

test("a declared group decides its answer alone, item by item — without one the quote must name the item, and either way it must be in the message", () => {
  const items = inv(UNLINKED_DROPS_ORDER).items;
  assert.deepEqual(items.map((i) => i.label || i.name), ["See the menu", "Directions", "order-form"]);
  const read = (message, ...answers) => readKeep({ content: [{ type: "tool_use", name: T.keep, input: judged(...answers) }] }, { message, items });
  const whys = (r) => r.unasked.map((u) => [u.label || u.name, u.why]);
  // THE OWNER'S ANSWER, AS THE JUDGE GAVE IT THEN: no group declared, and a
  // quote that names neither link. Still refused — code cannot tell it from a
  // quote attached to the wrong item without reading the English.
  assert.deepEqual(whys(read(ALL_LINKS_ASK, asks(1, Q_ALL), asks(2, Q_ALL), no(3))),
    [["See the menu", "quote-not-about-item"], ["Directions", "quote-not-about-item"], ["order-form", "not-asked"]]);
  // DECLARED: both links answered as the group, the form still judged alone.
  const g = read(ALL_LINKS_ASK, inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links"), no(3));
  assert.deepEqual(g.asked.map((a) => [a.label, a.group]), [["See the menu", "links"], ["Directions", "links"]]);
  assert.deepEqual(whys(g), [["order-form", "not-asked"]]);
  // STRETCHED OVER THE FORM: refused by kind, with the claim on the record.
  const s = read(ALL_LINKS_ASK, inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links"), inGroup(3, Q_ALL, "links"));
  assert.deepEqual(s.unasked.map((u) => [u.name, u.why, u.group]), [["order-form", "group-other-kind", "links"]]);
  // PRESENCE IS STILL REQUIRED OF A GROUP'S QUOTE, and so is a quote at all.
  assert.deepEqual(whys(read(ALL_LINKS_ASK, inGroup(1, "Delete every link", "links"), inGroup(2, Q_ALL, "links"), no(3)))[0],
    ["See the menu", "quote-not-in-message"]);
  assert.deepEqual(whys(read(ALL_LINKS_ASK, inGroup(1, "", "links"), inGroup(2, Q_ALL, "links"), no(3)))[0], ["See the menu", "no-quote"]);
  // A GROUP THAT IS NOT ONE OF OURS covers nothing.
  assert.deepEqual(whys(read(ALL_LINKS_ASK, inGroup(1, Q_ALL, "pages"), inGroup(2, Q_ALL, "links"), no(3)))[0], ["See the menu", "unknown-group"]);
  // A GROUP THAT IS NOT A STRING is a declaration nobody can read: refused as
  // an unknown group — never coerced (`String(["links"])` is "links", so a
  // coercion would accept it) and never ignored (which would hand the answer
  // back to naming).
  assert.deepEqual(whys(read(ALL_LINKS_ASK, inGroup(1, Q_ALL, ["links"]), inGroup(2, Q_ALL, "links"), no(3)))[0], ["See the menu", "unknown-group"]);
  // THE ORDER IN WHICH A GROUP IS ANSWERED is the judge's: one link in the
  // group and the other said no to is two separate answers, read separately.
  assert.deepEqual(whys(read(EXCEPT_ASK, inGroup(1, Q_EXCEPT, "links"), no(2), no(3))), [["Directions", "not-asked"], ["order-form", "not-asked"]]);
  // A DECLARED GROUP CONSTRAINS ITS ANSWER (owner, 2026-09-24). The form named
  // outright is accepted by its name when the answer declares no group — and
  // REFUSED when it declares a group that cannot hold a section: the answer
  // contradicts itself, and the words naming the item do not override the kind
  // it declared. This case used to assert the opposite, which is the bypass.
  const FORM = "Take the order form off the home page.";
  const byName = read(FORM, no(1), no(2), asks(3, "Take the order form off"));
  assert.deepEqual(byName.asked.map((a) => a.name), ["order-form"], "a named removal needs no group");
  // The two links are answered no in every read below, so they stand as
  // not-asked beside the form throughout; the form's row is what moves.
  const saidNo = [["See the menu", "not-asked"], ["Directions", "not-asked"]];
  const underLinks = read(FORM, no(1), no(2), inGroup(3, "Take the order form off", "links"));
  assert.deepEqual(whys(underLinks), [...saidNo, ["order-form", "group-other-kind"]],
    "a links group never answers for the form, however well the words name it");
  assert.equal(underLinks.unasked[2].group, "links", "the claimed group stays on the record");
  assert.deepEqual(underLinks.asked, []);
  // A GROUP NOBODY CAN READ is refused the same way, whether it is a string
  // that is not one of ours or not a string at all — neither regains the yes
  // through the naming it would have passed.
  assert.deepEqual(whys(read(FORM, no(1), no(2), inGroup(3, "Take the order form off", "components"))), [...saidNo, ["order-form", "unknown-group"]]);
  assert.deepEqual(whys(read(FORM, no(1), no(2), inGroup(3, "Take the order form off", ["sections"]))), [...saidNo, ["order-form", "unknown-group"]]);
  assert.deepEqual(whys(read(FORM, no(1), no(2), inGroup(3, "Take the order form off", 7))), [...saidNo, ["order-form", "unknown-group"]]);
  // NO GROUP IS NO DECLARATION: left out, null, or blank, the answer is read by
  // its naming exactly as an answer without the field.
  for (const none of [undefined, null, "", "  "]) {
    assert.deepEqual(read(FORM, no(1), no(2), inGroup(3, "Take the order form off", none)).asked.map((a) => a.name), ["order-form"], JSON.stringify(none));
  }
  // THE SECTIONS GROUP holds the form and the links inside the sections that went.
  const sec = readKeep({ content: [{ type: "tool_use", name: T.keep, input: judged(inGroup(1, Q_SECTIONS, "sections"), inGroup(2, Q_SECTIONS, "sections"), inGroup(3, Q_SECTIONS, "sections")) }] },
    { message: SECTIONS_ASK, items: inv(HOURS_ONLY).items });
  assert.deepEqual([sec.asked.length, sec.unasked.length], [3, 0]);
});

test("THE SHARED HEADING: a links group cannot answer for the form under the same heading, although the quote names it", () => {
  // THE OWNER'S BYPASS, AT THE READER. Both items sat under "Order ahead", so
  // the quote names both — and naming used to be asked first, so the group's
  // kind was never checked for the form.
  const items = keepInventory(HOME_ORDER_LINKED, UNDER_UNLINKED_DROPS_FORM, { does: DOES }).items;
  assert.deepEqual(items.map((i) => [i.kind, i.label || i.name, i.section]),
    [["link-lost", "Large batches", "Order ahead"], ["part-gone", "order-form", "Order ahead"]]);
  assert.ok(items.every((it) => quoteNamesItem(Q_UNDER, it)), "the premise: the quote names BOTH items, by their shared heading");
  const read = (...answers) => readKeep({ content: [{ type: "tool_use", name: T.keep, input: judged(...answers) }] }, { message: UNDER_ASK, items });
  const r = read(inGroup(1, Q_UNDER, "links"), inGroup(2, Q_UNDER, "links"));
  assert.deepEqual(r.asked.map((a) => [a.label, a.group]), [["Large batches", "links"]], "the link is one of the group");
  assert.deepEqual(r.unasked.map((u) => [u.name, u.why, u.group]), [["order-form", "group-other-kind", "links"]], "the form is not");
  // TWO ANSWERS TO ONE ITEM THAT DISAGREE ABOUT ITS GROUP ARE A CONFLICT, in
  // either order — otherwise the answer without a group could win the merge and
  // bring the naming back in.
  for (const pair of [[asks(2, Q_UNDER), inGroup(2, Q_UNDER, "links")], [inGroup(2, Q_UNDER, "links"), asks(2, Q_UNDER)],
    [inGroup(2, Q_UNDER, "links"), inGroup(2, Q_UNDER, "sections")]]) {
    const c = read(inGroup(1, Q_UNDER, "links"), ...pair);
    assert.deepEqual(c.unasked.map((u) => [u.name, u.why]), [["order-form", "conflicting"]], JSON.stringify(pair));
  }
  // AGREEING DUPLICATES ARE NOT A CONFLICT, as before.
  assert.deepEqual(read(inGroup(1, Q_UNDER, "links"), inGroup(1, Q_UNDER, "links"), no(2)).asked.map((a) => a.label), ["Large batches"]);
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
  // And the three the group cases lean on: how to declare a group, that it is
  // still answered item by item, and that it asks only for what it names.
  assert.ok(KEEP_RULES.includes("set group to what those words ask for — \"links\" or \"sections\""), KEEP_RULES);
  assert.ok(KEEP_RULES.includes("A group is still answered item by item."), KEEP_RULES);
  assert.ok(KEEP_RULES.includes("Asking for every link does not ask for any section"), KEEP_RULES);
  // The tool offers exactly the groups code can check, and nothing requires one.
  const item = KEEP_TOOL.input_schema.properties.answers.items;
  assert.deepEqual(item.properties.group.enum, Object.keys(KEEP_GROUPS));
  assert.deepEqual(item.required, ["n", "asked"], "a group is only for a quote that asks for one");
});

test("the refusal names what would also have happened, in the customer's words, and claims nothing about the whole request", () => {
  const items = judgedNo(inv(REMOVED_PLUS).items);
  const msg = keepWithheldMsg(items);
  assert.equal(msg, "I couldn't make that change without also taking the “Directions” link under “Find us” and the “Order ahead” section off the page, which your message didn't ask for — so I didn't make it. If you do want those changes, say so in your message and send it again.");
  assert.ok(!/order-form/.test(msg), "never a file name");
  assert.ok(!/Nothing on your site changed|charged|cost you nothing/.test(msg), "rung-scoped: the browser speaks for the whole request");
  assert.equal(keepWithheldMsg(judgedNo(inv(RETARGETED).items)),
    "I couldn't make that change without also pointing the “Directions” link at /contact instead of /visit, which your message didn't ask for — so I didn't make it. If you do want that change, say so in your message and send it again.");
});

test("“your message didn't ask for” is said only when the JUDGE said no — a check that could not confirm a yes says only that", () => {
  // THE OWNER'S COMPLAINT, AS A PROPERTY: the judge answered yes, a check
  // refused, and the screen told the customer their message had not asked.
  // A check can fail on a message that really did ask, so its refusal claims
  // only what it knows.
  const [directions, orderForm] = inv(REMOVED_PLUS).items;
  const WEAK = ", which I couldn't confirm your message asked for — so I didn't make it.";
  for (const why of ["no-quote", "quote-not-in-message", "quote-not-about-item", "unknown-group", "group-other-kind", "unanswered", "conflicting"]) {
    const msg = keepWithheldMsg([{ ...directions, why }]);
    assert.ok(msg.includes(WEAK), why + ": " + msg);
    assert.ok(!msg.includes("didn't ask for"), why + ": never the judge's reading when the judge did not give it");
  }
  // A MIXED LIST TAKES THE WEAKER CLAUSE, which is true of both items; the
  // stronger one would be false of the item the judge said yes to.
  const mixed = keepWithheldMsg([{ ...directions, why: "quote-not-about-item" }, { ...orderForm, why: "not-asked" }]);
  assert.ok(mixed.includes(WEAK) && !mixed.includes("didn't ask for"), mixed);
  assert.ok(keepWithheldMsg([{ ...orderForm, why: "not-asked" }]).includes(", which your message didn't ask for — "), "the judge's own no keeps its sentence");
});

// ═════ PROTECTED — the five reproductions, flipped ═════════════════════════

test("PROTECTED: a narrow edit whose answer also drops the “Find us” section and its link is refused", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HOURS_ASK, answer: DROPS_VISIT, judge: judged(no(1)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked, [{ kind: "link-lost", label: "Directions", href: "/visit", section: "Find us", why: "not-asked" }]);
  assert.equal(r.said.text, "⚠️ " + refusalFor(DROPS_VISIT) + WHOLE);
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

test("PROTECTED: intended hero edit plus unrelated plain hours deletion stops before publication", async () => {
  const r = await drive({ route: { layer: "page" }, ask: HERO_ASK, answer: DROPS_HOURS });
  refused(r, { calls: PAGE });
  assert.ok(r.stored.includes("Opening hours"));
  assert.ok(r.said.text.includes(PROSE_WITHHELD));
  assert.deepEqual(r.said.actions, [], "no rewrite or paid handoff");
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

test("PROTECTED: a judge cannot authorize collateral loss of the Order ahead text", async () => {
  // Kept so the boundary is on the record rather than assumed away: a verified
  // quote proves the words occur in the request, and whether they AUTHORISE
  // the loss is the model's judgement. This is supplied output; it says nothing
  // about how often a real model reads it this way.
  const r = await drive({ route: { layer: "page" }, ask: KEEP_ASK, answer: DROPS_ORDER, judge: judged(asks(1, "keep the order form")) });
  refused(r, { calls: PAGE_JUDGED });
  assert.equal(r.reply.msg, PROSE_WITHHELD);
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
  // THE JUDGE SAID YES and a check disagreed, so the customer is told only
  // that it could not be confirmed — never that their message did not ask.
  assert.ok(r.reply.msg.includes(", which I couldn't confirm your message asked for — "), r.reply.msg);
  assert.ok(!r.reply.msg.includes("didn't ask for"), r.reply.msg);
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
    assert.equal(blocked.msg, refusalFor(DROPS_ORDER));
    assert.ok(r.said.text.includes("⚠️ " + refusalFor(DROPS_ORDER)), r.said.text);
    assert.ok(!r.said.text.includes("Nothing on your site changed"), "something DID change, so the whole-request note must not say otherwise");
  });
}

// ═════ GROUPS — asked for at once, judged item by item ═════════════════════

test("GROUP: “remove all links, keeping their text” publishes — each link answered as one of the group the message asks for", async () => {
  // THE OWNER'S REPRODUCTION, with the judge now able to say that its quote
  // asks for a GROUP. The words and every section stay; only the wrappers go.
  assert.deepEqual(links(UNLINKED), [], "no in-body link is left");
  assert.equal(use(UNLINKED), "rendered", "the order form is still drawn");
  const r = await drive({
    route: { layer: "page" }, ask: ALL_LINKS_ASK, answer: UNLINKED,
    judge: judged(inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links")),
  });
  published(r, UNLINKED, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(r.said.text, UPDATED);
  const shown = r.judged[0].messages[0].content;
  assert.ok(shown.includes(ALL_LINKS_ASK), "the judge saw the customer's message verbatim");
  assert.ok(shown.includes("“See the menu”") && shown.includes("“Directions”"), shown);
  assert.ok(r.judged[0].system.includes("A message can ask for a whole group at once"), "the judge is told a group is a way to answer");
  assert.equal(itemsShown(r).length, 2, "the two links, and nothing else, were asked about");
  assert.ok(JSON.stringify(r.judged[0].tools).includes('"enum":["links","sections"]'), "the tool on the wire offers the groups");
});

test("GROUP, UNDECLARED: the owner's supplied answer — a group quote with no group named — still refuses, and is never told as “didn't ask”", async () => {
  // Code cannot tell this answer from the unrelated-removal control below
  // without reading English: in both, a quote really in the message names
  // nothing on the page. So without the judge's declaration it refuses — and
  // now says only what a check can know.
  const r = await drive({ route: { layer: "page" }, ask: ALL_LINKS_ASK, answer: UNLINKED, judge: judged(asks(1, Q_ALL), asks(2, Q_ALL)) });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.label, b.why]), [["See the menu", "quote-not-about-item"], ["Directions", "quote-not-about-item"]]);
  assert.equal(r.said.text, "⚠️ I couldn't make that change without also taking the “See the menu” link under “Harbour Loaf” and the “Directions” link under “Find us” off the page, which I couldn't confirm your message asked for — so I didn't make it. If you do want those changes, say so in your message and send it again." + WHOLE);
  assert.deepEqual(r.said.actions, [], "no rewrite is bought");
});

test("GROUP, EXCEPT ONE: “all the links except Directions”, honoured by the writer, publishes — only the one link was asked about", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: EXCEPT_ASK, answer: UNLINKED_BUT_DIRECTIONS,
    judge: judged(inGroup(1, Q_EXCEPT, "links")),
  });
  published(r, UNLINKED_BUT_DIRECTIONS, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.deepEqual(links(UNLINKED_BUT_DIRECTIONS), ["Directions → /visit"], "the named link stays");
  assert.ok(!r.judged[0].messages[0].content.includes("“Directions”"), "a link that was kept is never an item");
  assert.equal(itemsShown(r).length, 1);
  assert.equal(r.said.text, UPDATED);
});

test("GROUP, EXCEPT ONE: a writer that takes the named link off too is refused — for that link alone, as not asked", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: EXCEPT_ASK, answer: UNLINKED,
    judge: judged(inGroup(1, Q_EXCEPT, "links"), no(2)),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked, [{ kind: "link-lost", label: "Directions", href: "/visit", section: "Find us", why: "not-asked" }]);
  assert.ok(!r.reply.msg.includes("See the menu"), "the link the group did ask for is not complained about");
  assert.ok(r.reply.msg.includes(", which your message didn't ask for — "), "the judge said no, so that is what the customer hears");
});

test("LIMIT, NOT A PROTECTION: a judge that counts the excepted link into the group is believed — code does not read “except”", async () => {
  // Kept so the boundary is on the record: the quote is really in the message
  // and the links group can hold a link, so nothing here can disagree with the
  // judge. Supplied output; it says nothing about how often a real model does it.
  const r = await drive({
    route: { layer: "page" }, ask: EXCEPT_ASK, answer: UNLINKED,
    judge: judged(inGroup(1, Q_EXCEPT, "links"), inGroup(2, Q_EXCEPT, "links")),
  });
  published(r, UNLINKED, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(itemsShown(r).length, 2, "Directions WAS an item, and the judge's yes covered it");
});

test("GROUP + COLLATERAL: every link off as asked, and the order form lost beside them — the collateral loss alone is refused", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: ALL_LINKS_ASK, answer: UNLINKED_DROPS_ORDER,
    judge: judged(inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links"), no(3)),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.kind, b.name, b.section, b.why]), [["part-gone", "order-form", "Order ahead", "not-asked"]]);
  assert.equal(r.said.text, "⚠️ I couldn't make that change without also taking the “Order ahead” section off the page, which your message didn't ask for — so I didn't make it. If you do want that change, say so in your message and send it again." + WHOLE);
});

test("GROUP + COLLATERAL: a judge that stretches the links group over the order form is refused by kind — a links group holds no section", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: ALL_LINKS_ASK, answer: UNLINKED_DROPS_ORDER,
    judge: judged(inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links"), inGroup(3, Q_ALL, "links")),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked, [{ kind: "part-gone", name: "order-form", section: "Order ahead", group: "links", why: "group-other-kind" }]);
  assert.ok(r.reply.msg.includes(", which I couldn't confirm your message asked for — "), "the judge said yes, so the customer is not told it said no");
});

test("GROUP + COLLATERAL, THE JOB PATH: the refusal reserves nothing, compiles nothing and stores nothing", async () => {
  const r = await drive({
    mode: "job", route: { layer: "page" }, ask: ALL_LINKS_ASK, answer: UNLINKED_DROPS_ORDER,
    judge: judged(inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links"), no(3)),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reserves, [], "no reservation was made");
  assert.deepEqual(r.finalized, [false], "the job finalized as not published");
});

test("PROTECTED: a links quote cannot authorize collateral section text loss", async () => {
  // The kind check stops a group being stretched over a thing it cannot hold;
  // it cannot stop the judge naming the wrong group for the words, because
  // telling "all links" from "all sections" is reading English. Supplied output.
  const r = await drive({
    route: { layer: "page" }, ask: ALL_LINKS_ASK, answer: UNLINKED_DROPS_ORDER,
    judge: judged(inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links"), inGroup(3, Q_ALL, "sections")),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.equal(r.reply.msg, PROSE_WITHHELD);
  assert.equal(itemsShown(r).length, 3, "the order form WAS an item, and the third answer covered it");
});

test("GROUP OF SECTIONS: “every section off except the hours” publishes — the order form and the links inside the sections that went", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: SECTIONS_ASK, answer: HOURS_ONLY,
    judge: judged(inGroup(1, Q_SECTIONS, "sections"), inGroup(2, Q_SECTIONS, "sections"), inGroup(3, Q_SECTIONS, "sections")),
  });
  published(r, HOURS_ONLY, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(itemsShown(r).length, 3, "both links and the order form were each asked about");
  assert.equal(r.said.text, UPDATED);
});

test("GROUP, THE TWEAK: taking every link's wrapper off through the cheap writer publishes, the judge billed with it", async () => {
  const r = await drive({
    route: { layer: "page" }, ask: ALL_LINKS_ASK, tweak: () => UNLINKED,
    judge: judged(inGroup(1, Q_ALL, "links"), inGroup(2, Q_ALL, "links")),
  });
  published(r, UNLINKED, { calls: [T.tweak, T.keep], debits: [credits(CALL, JUDGE)] });
  assert.equal(r.reply.tweak, true, "the cheap rung answered");
  assert.equal(itemsShown(r).length, 2);
});

test("GROUP, THE TWEAK: the owner's undeclared answer on the cheap writer refuses there, and the rewrite is NOT bought", async () => {
  const r = await drive({ route: { layer: "page" }, ask: ALL_LINKS_ASK, tweak: () => UNLINKED, judge: judged(asks(1, Q_ALL), asks(2, Q_ALL)) });
  refused(r, { calls: [T.tweak, T.keep] });
  assert.deepEqual(r.reply.contentBlocked.map((b) => b.why), ["quote-not-about-item", "quote-not-about-item"]);
});

// ═════ THE SHARED HEADING — a declared group constrains its answer ═════════

const UNDER_REFUSAL = "⚠️ I couldn't make that change without also taking the “Order ahead” section off the page, which I couldn't confirm your message asked for — so I didn't make it. If you do want that change, say so in your message and send it again.";

test("SHARED HEADING (the owner's bypass): the link and the form under “Order ahead” both gone — a links group cannot answer for the form, whatever words name it", async () => {
  // THE OWNER'S REPRODUCTION THROUGH THE ROUTE. The writer took the link's
  // wrapper off AND the form; the judge answered both as the links group,
  // quoting the request. The quote names the form by its heading, and that
  // used to be asked first — so the group's kind was never checked, and the
  // form went out with "✅ Updated /."
  assert.equal(use(HOME_ORDER_LINKED), "rendered");
  assert.equal(use(UNDER_UNLINKED_DROPS_FORM), "unused", "the answer really drops the form");
  const r = await drive({
    route: { layer: "page" }, ask: UNDER_ASK, before: HOME_ORDER_LINKED, answer: UNDER_UNLINKED_DROPS_FORM,
    judge: judged(inGroup(1, Q_UNDER, "links"), inGroup(2, Q_UNDER, "links")),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.equal(itemsShown(r).length, 2, "the link and the form were each asked about");
  assert.deepEqual(r.reply.contentBlocked, [{ kind: "part-gone", name: "order-form", section: "Order ahead", group: "links", why: "group-other-kind" }],
    "only the form is refused; the link WAS one of the group");
  assert.equal(r.said.text, UNDER_REFUSAL + WHOLE, "the judge said yes, so the customer is not told it said no");
  assert.deepEqual(r.said.actions, [], "no rewrite is bought");
});

test("SHARED HEADING, THE JOB PATH: the refusal reserves nothing, compiles nothing and stores nothing", async () => {
  const r = await drive({
    mode: "job", route: { layer: "page" }, ask: UNDER_ASK, before: HOME_ORDER_LINKED, answer: UNDER_UNLINKED_DROPS_FORM,
    judge: judged(inGroup(1, Q_UNDER, "links"), inGroup(2, Q_UNDER, "links")),
  });
  refused(r, { calls: PAGE_JUDGED });
  assert.deepEqual(r.reply.contentBlocked.map((b) => [b.name, b.why]), [["order-form", "group-other-kind"]]);
  assert.deepEqual(r.reserves, [], "no reservation was made");
  assert.deepEqual(r.finalized, [false], "the job finalized as not published");
});

test("SHARED HEADING, LINK ONLY: the link's wrapper off under “Order ahead”, its words and the form kept — publishes, the judge billed with the edit", async () => {
  assert.deepEqual(links(UNDER_UNLINKED), ["See the menu → /menu", "Directions → /visit"], "only the link under “Order ahead” went");
  assert.equal(use(UNDER_UNLINKED), "rendered", "the form is still drawn");
  const r = await drive({
    route: { layer: "page" }, ask: UNDER_ASK, before: HOME_ORDER_LINKED, answer: UNDER_UNLINKED,
    judge: judged(inGroup(1, Q_UNDER, "links")),
  });
  published(r, UNDER_UNLINKED, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(itemsShown(r).length, 1, "the one link, and nothing else, was asked about");
  assert.equal(r.said.text, UPDATED);
});

test("SHARED HEADING, THE FORM NAMED ON ITS OWN: “take the order form out of ‘Order ahead’”, answered with no group, publishes — a named removal needs no group", async () => {
  assert.deepEqual(links(UNDER_DROPS_FORM), ["See the menu → /menu", "Large batches → /contact", "Directions → /visit"], "the link under the same heading stays");
  assert.equal(use(UNDER_DROPS_FORM), "unused");
  const r = await drive({
    route: { layer: "page" }, ask: FORM_ASK, before: HOME_ORDER_LINKED, answer: UNDER_DROPS_FORM,
    judge: judged(asks(1, Q_FORM)),
  });
  published(r, UNDER_DROPS_FORM, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(itemsShown(r).length, 1, "only the form was an item");
  assert.equal(r.said.text, UPDATED);
});

test("LIMIT, NOT A PROTECTION: the form answered with NO group, quoting the links request that shares its heading, is believed — naming reads words, not intent", async () => {
  // Kept so the boundary is on the record. A declared group now constrains its
  // answer; an answer that declares NO group is read by its naming, and the
  // heading's words really do name the form. Telling "the links under Order
  // ahead" from "Order ahead" is reading English — the judge's call, which the
  // rules already steer ("Asking for every link does not ask for any section").
  // Supplied output; it says nothing about how often a real model answers so.
  const r = await drive({
    route: { layer: "page" }, ask: UNDER_ASK, before: HOME_ORDER_LINKED, answer: UNDER_UNLINKED_DROPS_FORM,
    judge: judged(inGroup(1, Q_UNDER, "links"), asks(2, Q_UNDER)),
  });
  published(r, UNDER_UNLINKED_DROPS_FORM, { calls: PAGE_JUDGED, debits: [credits(CALL, CALL, JUDGE)] });
  assert.equal(itemsShown(r).length, 2, "the form WAS an item, and the judge's yes covered it");
});


// Parsed prose regressions use the same real route, compiler capture, storage
// and browser composer above. The model/provider outputs remain fixtures.
function renderedHome(source) {
  const component = source.replace(/^import .*\n/gm, "")
    .replace(/^export const Route = .*\n/gm, "")
    + "\nconst Link = ({to, children}) => <a href={to}>{children}</a>;\n"
    + ORDER_FORM.replace("export default ", "") + "\nexport default Home;";
  return renderPart(component, {});
}
for (const mode of ["sync", "job"]) {
  test("PROSE " + mode + ": reword and rename hours, preserve and render neighbors", async () => {
    const next = home(HERO, HOURS_NEW.replace("Opening hours", "When we open"), ORDER, VISIT);
    const r = await drive({ mode, ask: "Rewrite the Opening hours section as a short list and rename its heading.", answer: next });
    assert.equal(r.status, 200, JSON.stringify(r.reply));
    assert.equal(r.compiled, next); assert.equal(r.stored, next);
    assert.equal(r.said.text, UPDATED); assert.deepEqual(r.said.actions, ["refresh the credit balance"]);
    const rendered = renderedHome(r.stored);
    assert.match(rendered.text, /When we open Weekdays 7am to 4pm Saturday 8am to 2pm/);
    assert.match(rendered.text, /Bread from the harbour, every morning/);
    assert.match(rendered.html, /href="\/visit"/); assert.match(rendered.html, /<form/);
  });
  test("PROSE " + mode + ": explicit text-only section deletion preserves neighbors", async () => {
    const next = home(HERO, ORDER, VISIT);
    const r = await drive({ mode, ask: "Remove the Opening hours section.", answer: next });
    assert.equal(r.status, 200, JSON.stringify(r.reply));
    assert.equal(r.compiled, next); assert.equal(r.stored, next); assert.equal(r.said.text, UPDATED);
    assert.doesNotMatch(renderedHome(r.stored).text, /Opening hours/);
    assert.match(renderedHome(r.stored).text, /Harbour Loaf.*Order ahead.*Find us/);
  });
  test("PROSE " + mode + ": movement preserves rendered words and changes order", async () => {
    const next = home(HOURS, HERO, ORDER, VISIT);
    const r = await drive({ mode, ask: "Move Opening hours above the hero.", answer: next });
    assert.equal(r.status, 200, JSON.stringify(r.reply));
    assert.equal(r.compiled, next); assert.equal(r.stored, next); assert.equal(r.said.text, UPDATED);
    assert.match(renderedHome(r.stored).text, /^Opening hours.*Harbour Loaf/);
  });
  for (const [label, ask, before, answer] of [
    ["hero change cannot discard hours", HERO_ASK, HOME, DROPS_HOURS],
    ["unchanged heading cannot hide lost body", HERO_ASK, HOME, home(HERO_NEW, HOURS.replace("<p>Open from 7am on weekdays.</p>", ""), ORDER, VISIT)],
    ["a reword request is not section deletion", HOURS_ASK, HOME, home(HERO, ORDER, VISIT)],
    ["replacement wording mentioning hours grants no hours permission", "Change the Harbour Loaf heading to Opening hours.", HOME, home(HERO.replace("Harbour Loaf", "Opening hours"), ORDER, VISIT)],
    ["duplicate headings require disambiguation", "Rewrite Opening hours as a list.", home(HERO, HOURS, HOURS.replace("7am", "9am"), ORDER, VISIT), home(HERO, HOURS_NEW, HOURS.replace("7am", "9am"), ORDER, VISIT)],
    ["vague targeting stops", "Change that section.", HOME, home(HERO, HOURS_NEW, ORDER, VISIT)],
    ["negated target stops", "Do not remove Opening hours.", HOME, home(HERO, ORDER, VISIT)],
    ["literal text in a hidden branch is not preserved", HERO_ASK, HOME, home(HERO_NEW, "{false && " + HOURS + "}", ORDER, VISIT)],
    ["literal text in unused code is not preserved", HERO_ASK, HOME, home(HERO_NEW, ORDER, VISIT) + "function Unused(){return " + HOURS + "}"],
  ]) {
    test("PROSE " + mode + ": " + label, async () => {
      const r = await drive({ mode, ask, before, answer });
      refused(r, { calls: PAGE });
      assert.equal(r.reply.msg, PROSE_WITHHELD);
      assert.ok(r.said.text.includes(PROSE_WITHHELD));
      assert.ok(!r.said.text.includes("Nothing on your site changed"));
      assert.ok(!r.said.text.includes("cost you nothing"));
      assert.deepEqual(r.said.actions, []); assert.deepEqual(r.reserves, []);
    });
  }
  test("PROSE " + mode + ": a successful style step survives a refused text-loss step", async () => {
    const r = await drive({ mode, route: { layer: "look" }, ask: "Make the footer dark green and change the Harbour Loaf heading.",
      pick: { fields: ["css", "components"] }, lane: { css: FOOTER }, answer: DROPS_HOURS });
    assert.equal(r.status, 200); assert.equal(r.compiles, 1);
    assert.equal(r.compiled, HOME); assert.equal(r.stored, HOME); assert.equal(r.css, FOOTER);
    assert.ok(r.reply.partial.some(p => p.error === "prose-preservation" && p.msg === PROSE_WITHHELD));
    assert.ok(r.said.text.includes(PROSE_WITHHELD));
    assert.ok(!r.said.text.includes("Nothing on your site changed"));
    assert.deepEqual(r.said.actions, ["refresh the credit balance"]);
    if (mode === "sync") assert.deepEqual(r.debits, [credits(CALL, LANE)]);
    else assert.deepEqual(r.reserves, [{ seq: 1, cost: credits(CALL, LANE) }]);
  });
}
test("PROSE: heading-only permission does not cover its paragraph", async () => {
  const r = await drive({ ask: "Rename the Opening hours heading to When we open.", answer: home(HERO, HOURS_NEW.replace("Opening hours", "When we open"), ORDER, VISIT) });
  refused(r, { calls: PAGE });
});
test("PROSE: unique section id disambiguates duplicate headings", async () => {
  const first = HOURS.replace("<section", '<section id="weekday-hours"');
  const second = HOURS.replace("7am", "9am");
  const before = home(HERO, first, second, ORDER, VISIT);
  const next = home(HERO, first.replace("7am", "8am"), second, ORDER, VISIT);
  const r = await drive({ ask: "Change the weekday-hours section to say we open at 8am.", before, answer: next });
  published(r, next, { calls: PAGE, debits: [credits(CALL, CALL)] });
});
test("PROSE: no parser and malformed source stop rather than inventing an empty inventory", async () => {
  assert.deepEqual(await preservePageProse({ before: HOME, after: DROPS_HOURS, message: HERO_ASK, parse: null }), { ok: false, why: "no-parser" });
  assert.equal((await preservePageProse({ before: HOME, after: "function Broken(){ return <", message: HERO_ASK })).why, "unparsed");
});


test("PROSE: changing a line under a heading cannot rename the heading too", async () => {
  const r = await drive({ ask: HERO_ASK, answer: home(HERO_NEW.replace("Harbour Loaf", "Different business"), HOURS, ORDER, VISIT) });
  refused(r, { calls: PAGE });
});
test("PROSE: an image target under a section is not authority to rewrite its prose", async () => {
  const r = await drive({ ask: "Change the image under Opening hours.", answer: home(HERO, HOURS_NEW, ORDER, VISIT) });
  refused(r, { calls: PAGE });
});
test("PROSE: accepted wording preserves literal photo, links, and custom component beside text", async () => {
  const photo = '<img src="https://images.unsplash.com/photo-1509440159596-0249088772ff" alt="Bread on the bench" />';
  const before = home(HERO + photo, HOURS, ORDER, VISIT);
  const next = home(HERO + photo, HOURS_NEW, ORDER, VISIT);
  const r = await drive({ before, ask: HOURS_ASK, answer: next });
  published(r, next, { calls: PAGE, debits: [credits(CALL, CALL)] });
  const html = renderedHome(r.stored).html;
  assert.match(html, /<img[^>]*alt="Bread on the bench"/);
  assert.match(html, /href="\/menu"/); assert.match(html, /href="\/visit"/);
  assert.match(html, /<form/); assert.match(html, /Weekdays 7am to 4pm/);
});
test("PROSE: deleting text cannot be hidden by a comment containing the old section", async () => {
  const r = await drive({ ask: HERO_ASK, answer: DROPS_HOURS + '\n/* ' + HOURS + ' */' });
  refused(r, { calls: PAGE });
});
test("PROSE: exact text targeting works without a semantic section wrapper", async () => {
  const before = page('/', '<h1>Bakery</h1><p>Open from 7am on weekdays.</p><p>Quay Street.</p>');
  const next = before.replace('Open from 7am on weekdays.', 'Open from 8am on weekdays.');
  const r = await drive({ before, ask: 'Change "Open from 7am on weekdays." to "Open from 8am on weekdays."', answer: next });
  published(r, next, { calls: PAGE, debits: [credits(CALL, CALL)] });
});


test("PROSE: a shared sentence in another section cannot mask a lost local sentence", async () => {
  const shared = HOURS.replace('className="hours"', 'className="weekend"').replace('Opening hours', 'Weekend hours');
  const before = home(HERO, HOURS, shared, ORDER, VISIT);
  const after = home(HERO, HOURS_NEW, shared.replace('<p>Open from 7am on weekdays.</p>', ''), ORDER, VISIT);
  const r = await drive({ before, ask: HOURS_ASK, answer: after });
  refused(r, { calls: PAGE });
});
test("PROSE: explicit removal with a repeated sentence keeps the other section's instance", async () => {
  const shared = HOURS.replace('className="hours"', 'className="weekend"').replace('Opening hours', 'Weekend hours');
  const before = home(HERO, HOURS, shared, ORDER, VISIT);
  const next = home(HERO, shared, ORDER, VISIT);
  const r = await drive({ before, ask: 'Remove the Opening hours section.', answer: next });
  published(r, next, { calls: PAGE, debits: [credits(CALL, CALL)] });
});
test("PROSE: a heading can be renamed without any persisted section identifier", async () => {
  const before = home(HERO, HOURS.replace(' className="hours"', ''), ORDER, VISIT);
  const next = before.replace('Opening hours', 'When we open');
  const r = await drive({ before, ask: 'Rename the Opening hours heading to When we open.', answer: next });
  published(r, next, { calls: PAGE, debits: [credits(CALL, CALL)] });
  assert.match(renderedHome(r.stored).text, /When we open Open from 7am on weekdays/);
});


test("PROSE: an explicit keep clause overrides a surrounding rewrite permission", async () => {
  const r = await drive({ ask: 'Rewrite the Opening hours section as a list, but keep "Open from 7am on weekdays." exactly.', answer: CORRECT });
  refused(r, { calls: PAGE });
});
test("PROSE: conflicting removal and preservation asks are refused", async () => {
  const r = await drive({ ask: 'Remove Opening hours and keep Opening hours.', answer: home(HERO, ORDER, VISIT) });
  refused(r, { calls: PAGE });
});

// Authorization operands: each control uses the real route and browser composer.
for (const mode of ['sync', 'job']) {
  const weekend = HOURS.replace('className="hours"', 'className="weekend"').replace('Opening hours', 'Weekend hours').replace('7am', '9am');
  const before = home(HERO, HOURS, weekend, ORDER, VISIT);
  const dropHours = home(HERO, weekend, ORDER, VISIT);
  const dropBoth = home(HERO, ORDER, VISIT);
  const changed = home(HERO, HOURS_NEW, weekend, ORDER, VISIT);
  const cases = [
    ['positional reference', 'Remove the Opening hours section above Weekend hours.', before, dropHours, dropBoth],
    ['comparison', 'Rewrite the Opening hours section like Weekend hours.', before, changed, home(HERO, HOURS_NEW, ORDER, VISIT)],
    ['comparison collateral rewording', 'Rewrite Opening hours compared to Weekend hours.', before, changed, home(HERO, HOURS_NEW, weekend.replace('9am', 'noon'), ORDER, VISIT)],
    ['destination', 'Move Opening hours after Weekend hours.', before, home(HERO, weekend, HOURS, ORDER, VISIT), dropBoth],
    ['replacement names and commands', 'Rewrite Opening hours as "Weekend hours; remove Weekend hours and delete Opening hours."', before, changed, home(HERO, HOURS_NEW, ORDER, VISIT)],
    ['two explicit targets', 'Remove the Opening hours section and the Weekend hours section.', before, dropBoth, home(HERO.replace('Bread from the harbour, every morning.', ''), ORDER, VISIT)],
    ['two explicit operations', 'Rewrite Opening hours as a list and remove Weekend hours.', before, home(HERO, HOURS_NEW, ORDER, VISIT), home(HERO.replace('Bread from the harbour, every morning.', ''), HOURS_NEW, ORDER, VISIT)],
    ['keep constraint', 'Remove Opening hours and keep Weekend hours.', before, dropHours, dropBoth],
    ['except constraint', 'Remove all sections except Weekend hours.', home(HOURS, weekend), home(weekend), home()],
    ['duplicate explicit id', 'Remove weekday-hours section above Opening hours.', home(HERO, HOURS.replace('<section', '<section id="weekday-hours"'), HOURS.replace('7am', '9am'), ORDER, VISIT), home(HERO, HOURS.replace('7am', '9am'), ORDER, VISIT), dropBoth],
    ['quoted heading replacement', 'Rename Opening hours heading to "Weekend hours".', before, home(HERO, HOURS.replace('Opening hours', 'Weekend hours'), weekend, ORDER, VISIT), home(HERO, HOURS.replace('Opening hours', 'Weekend hours'), ORDER, VISIT)],
  ];
  for (const [label, ask, source, good, bad] of cases) {
    test(`AUTH ${mode}: ${label}: intended output`, async () => {
      const r = await drive({ mode, before: source, ask, answer: good });
      assert.equal(r.status, 200, JSON.stringify(r.reply));
      assert.equal(r.compiled, good); assert.equal(r.stored, good);
      assert.equal(r.said.text, UPDATED);
      assert.deepEqual(r.said.actions, ['refresh the credit balance']);
    });
    test(`AUTH ${mode}: ${label}: collateral loss`, async () => {
      const r = await drive({ mode, before: source, ask, answer: bad });
      refused(r, { calls: PAGE });
      assert.equal(r.stored, source); assert.equal(r.compiles, 0);
      assert.equal(r.reply.msg, PROSE_WITHHELD);
      assert.ok(r.said.text.includes(PROSE_WITHHELD));
      assert.deepEqual(r.said.actions, []); assert.deepEqual(r.reserves, []);
    });
  }
  for (const ask of ['Remove Opening hours near Weekend hours.', 'Remove Opening hours or Weekend hours.', 'Remove Opening hours except Weekend hours.', 'Remove Opening hours and remove all sections except Opening hours.', 'Remove Opening hours above "Weekend hours; remove Weekend hours.']) {
    test(`AUTH ${mode}: unsupported grammar refuses loss: ${ask}`, async () => {
      const r = await drive({ mode, before, ask, answer: dropBoth });
      refused(r, { calls: PAGE }); assert.equal(r.reply.msg, PROSE_WITHHELD);
    });
  }
}
