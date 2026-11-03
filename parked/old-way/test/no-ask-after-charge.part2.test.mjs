// PARKED (2026-11-03, park-old-way): the old-way half of test/no-ask-after-charge.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// NO QUESTION AFTER A CHARGE (owner, 2026-10-24) — SUPERSEDED IN THE ROUTES by
// "any step may ask, at any stage" (owner, 2026-10-26; test/ask-anywhere.test.mjs):
// the routes no longer pass `charged`, so the route cases below now assert that
// a step after a charge is still offered its question and that the question is
// never charged. The transport's `charged` option itself is unchanged and its
// unit cases stand.
//
// Owner: *"the model may ask the customer a question only BEFORE anything is
// charged; once work has been charged, it must not stop to ask — it goes ahead
// with a sensible stated default and says so in the reply facts."* Evidence:
// docs/plans/2026-10-24-model-wrong-failures.md §3 — three add-on page writers
// asked about design choices after 12–13 credits had been reserved.
//
// WHAT IS DRIVEN: the transport every step's model call goes through
// (`clarifyTransport`), the reply facts, and the real edit and add-on routes
// with supplied model answers (sync and as a queued job): after a charge a
// step's model request carries no question field; a question that arrives
// anyway is not shown, its first offered answer is used and said; a step that
// still asks ends in a question that is never charged; and before any charge
// the router's and a step's questions work exactly as before.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: whether a real model states its defaults, and
// how often it asks when not offered the field, are live measurements.
import test from "node:test";
import assert from "node:assert/strict";
import {
  clarifyTransport, noAskRequest, defaultedOf, defaultNote, defaultedReport, DEFAULTED_FIELD, QUESTION_FIELD, contextBlock,
} from "../../../builder/clarify.mjs";
import { editReplyFacts, addonReplyFacts } from "../../../builder/site-reply.mjs";
import { replayer, recorder } from "../../../builder/prepared.mjs";
import { loadWorker } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import {
  T, HOME, VISIT, page, SOURCE_KEY, freshSlug, bucket, question, withWire, envFor, routeCall, browserPost, postRoute, SITE, storedPage,
} from "../../../test/fixtures/live-ask.mjs";
import { platform, sendMessage, settle, T as RT } from "../../../test/fixtures/request-flow.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { rowsDb } from "../../../test/fixtures/rows-db.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";

blockNetwork();

const TOOL = { name: "do_it", input_schema: { type: "object", properties: { change: { type: "string" }, question: QUESTION_FIELD }, required: ["change"] } };
const REQ = { model: "m", tool_choice: { type: "tool", name: "do_it" }, tools: [TOOL], messages: [{ role: "user", content: "Make it nicer." }] };
const reply = (input) => ({ content: [{ type: "tool_use", name: "do_it", input }], usage: { input_tokens: 1, output_tokens: 1 } });
const ASK = { text: "Two columns or one?", options: ["Two columns", "One column"] };
const props = (req) => Object.keys(req.tools[0].input_schema.properties);
const lastUser = (req) => String(req.messages.at(-1).content);

// ── 3. THE EDIT ROUTE: a heading charged, then the photo step ───────────────

const PIC = "choose_pictures";
const CONTACT = page("/contact", "<section className=\"find\"><h1>Find us</h1><SafeImage src=\"/u/shop/front.jpg\" alt=\"The shop front at dawn\" /></section>");
const HOME_BIG = HOME.replace("<h1>Harbour Loaf</h1>", "<h1 className=\"text-6xl\">Harbour Loaf</h1>");
const HEADING = "Make the home page heading bigger";
const PHOTO = "show more of the top of the photo";
const QPIC = { text: "The shop-front photo shows a sign and a doorway — which should stay in view?", options: ["The sign", "The doorway"] };
const offers = (args) => !!(args && Array.isArray(args.tools) && args.tools[0] && Object.hasOwn(args.tools[0].input_schema.properties || {}, "question"));
const reserves = (seen) => seen.debits.length + seen.rpc.filter((r) => r.fn === "edit_reserve").length;
const focusOf = (src) => { const m = /focus="(\w+)"/.exec(String(src || "")); return m ? m[1] : null; };
const SITE3 = (slug) => ({ ...SITE(slug), pages: [{ path: "/" }, { path: "/visit" }, { path: "/contact" }] });

for (const mode of ["sync", "job"]) {
  test("EDIT ROUTE (" + mode + "): after the heading is charged the photo step is still offered its question (owner, 2026-10-26); the question is kept and the photo is neither made nor charged", async () => {
    const slug = freshSlug("no-ask-" + mode);
    const store = bucket(slug);
    store.poke(SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "contact.tsx", source: CONTACT }]));
    const worker = await loadWorker();
    const compiler = installCompiler();
    const offered = [];
    try {
      await withWire({
        [T.pick]: { fields: ["shape", "images"], scopes: [{ part: "shape", page: "/", words: HEADING, answers: [] }, { part: "images", words: PHOTO, answers: [] }] },
        [T.tweak]: { source: HOME_BIG },
        [PIC]: (args) => { offered.push(offers(args)); return { pictures: [], question: QPIC }; },
      }, async (seen) => {
        const m0 = reserves(seen);
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE3(slug), { intent: "edit", layer: "look" }, HEADING + " and " + PHOTO + "."), mode);
        const why = " (" + mode + "): " + JSON.stringify(r.body).slice(0, 500);
        assert.ok(offered.length >= 1 && offered.every((o) => o === true), "after the charge the photo step was not offered its question: " + JSON.stringify(offered));
        assert.equal(storedPage(store, slug, "contact.tsx"), CONTACT, "the photo was made beside its question" + why);
        assert.equal(r.body.defaulted, undefined, why);
        assert.ok(question(store, slug), "the question was not kept" + why);
        assert.ok(reserves(seen) - m0 <= 1, "the step that asked was charged" + why);
      }, { slug });
    } finally { compiler.uninstall(); }
  });

  test("EDIT ROUTE (" + mode + "): a step that asks even when told it cannot ends in its question, and that step is never charged", async () => {
    const slug = freshSlug("no-ask-still-" + mode);
    const store = bucket(slug);
    store.poke(SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "contact.tsx", source: CONTACT }]));
    const worker = await loadWorker();
    const compiler = installCompiler();
    try {
      await withWire({
        [T.pick]: { fields: ["shape", "images"], scopes: [{ part: "shape", page: "/", words: HEADING, answers: [] }, { part: "images", words: PHOTO, answers: [] }] },
        [T.tweak]: { source: HOME_BIG },
        [PIC]: { pictures: [{ page: "contact.tsx", alt: "The shop front at dawn", focus: "top" }], question: QPIC },
      }, async (seen) => {
        const m0 = reserves(seen);
        const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE3(slug), { intent: "edit", layer: "look" }, HEADING + " and " + PHOTO + "."), mode);
        assert.equal(storedPage(store, slug, "contact.tsx"), CONTACT, "what was proposed beside the question was made");
        assert.equal(reserves(seen) - m0, 1, "the step that ended in a question was charged");
        assert.equal(r.body.defaulted, undefined);
        assert.ok(question(store, slug), "the question was not kept");
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}

// ── 4. THE ADD-ON ROUTE, AS A QUEUED JOB ────────────────────────────────────

const HOME_P = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME_P }, { path: "about.tsx", source: ABOUT }];
const ABOUT_LIST = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section><h2>Our suppliers</h2></section></main> }\n";
const QPAGES = { text: "Should the suppliers go above or below the story?", options: ["Below the story", "Above the story"] };
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const slugOf = (k) => "nask-" + k + "-" + Math.random().toString(16).slice(2, 8);
const net = (P, kind) => P.ledger.filter((e) => e.kind === kind).reduce((n, e) => n + e.delta, 0);
const TABLE_ADD = {
  route: { intent: "addon" },
  [RT.adds]: { kinds: ["table"], scopes: [{ kind: "table", words: "add a suppliers list to the About page", uses: [] }] },
  "add:table": { table: [{ table: { name: "suppliers", access: "public", columns: [{ name: "name", type: "text" }] }, seed: [{ name: "Mill Farm" }], shows: "/about" }] },
};
