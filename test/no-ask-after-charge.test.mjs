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
} from "../builder/clarify.mjs";
import { editReplyFacts, addonReplyFacts } from "../builder/site-reply.mjs";
import { replayer, recorder } from "../builder/prepared.mjs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import {
  T, HOME, VISIT, page, SOURCE_KEY, freshSlug, bucket, question, withWire, envFor, routeCall, browserPost, postRoute, SITE, storedPage,
} from "./fixtures/live-ask.mjs";
import { platform, sendMessage, settle, T as RT } from "./fixtures/request-flow.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const TOOL = { name: "do_it", input_schema: { type: "object", properties: { change: { type: "string" }, question: QUESTION_FIELD }, required: ["change"] } };
const REQ = { model: "m", tool_choice: { type: "tool", name: "do_it" }, tools: [TOOL], messages: [{ role: "user", content: "Make it nicer." }] };
const reply = (input) => ({ content: [{ type: "tool_use", name: "do_it", input }], usage: { input_tokens: 1, output_tokens: 1 } });
const ASK = { text: "Two columns or one?", options: ["Two columns", "One column"] };
const props = (req) => Object.keys(req.tools[0].input_schema.properties);
const lastUser = (req) => String(req.messages.at(-1).content);

// ── 1. THE TRANSPORT ────────────────────────────────────────────────────────

test("BEFORE ANY CHARGE the request offers the question field as built, and a question comes back as asked", async () => {
  const sent = [];
  const send = clarifyTransport(async (r) => { sent.push(r); return reply({ question: ASK }); }, { charged: () => false });
  const got = await send(REQ);
  assert.deepEqual(props(sent[0]), ["change", "question"]);
  assert.equal(sent.length, 1);
  assert.deepEqual(got.content[0].input.question, ASK);
});

test("AFTER A CHARGE the request has no question field — `defaulted` in its place, `required` untouched — and what the model states it assumed is heard", async () => {
  const sent = [];
  const heard = [];
  const send = clarifyTransport(async (r) => { sent.push(r); return reply({ change: "x", defaulted: [{ assumed: "two columns", instead: "one column" }] }); },
    { charged: () => true, onDefault: (d) => heard.push(...d) });
  await send(REQ);
  assert.equal(sent.length, 1);
  assert.deepEqual(props(sent[0]), ["change", "defaulted"]);
  assert.deepEqual(sent[0].tools[0].input_schema.required, ["change"]);
  assert.equal(sent[0].tools[0].input_schema.properties.defaulted, DEFAULTED_FIELD);
  assert.deepEqual(heard, [{ assumed: "two columns", instead: "one column" }]);
  // THE ORIGINAL REQUEST IS NOT MUTATED.
  assert.deepEqual(props(REQ), ["change", "question"]);
});

test("AFTER A CHARGE A QUESTION THAT ARRIVES ANYWAY is not returned: the model is sent once more told it cannot ask and which answer to use, and that default is recorded even when it states none", async () => {
  const sent = [];
  const heard = [];
  const send = clarifyTransport(async (r) => { sent.push(r); return sent.length === 1 ? reply({ question: ASK }) : reply({ change: "done" }); },
    { charged: () => true, onDefault: (d) => heard.push(...d) });
  const got = await send(REQ);
  assert.equal(sent.length, 2);
  assert.ok(sent.every((r) => !props(r).includes("question")), "a request after the charge offered the question field");
  assert.ok(lastUser(sent[1]).endsWith(defaultNote(ASK)), "the second request was not told it cannot ask");
  assert.match(defaultNote(ASK), /“Two columns”/);
  assert.equal(got.content[0].input.change, "done");
  assert.equal(got.content[0].input.question, undefined);
  assert.deepEqual(heard, [{ assumed: "Two columns", instead: "One column" }]);
});

test("AFTER A CHARGE A MODEL THAT STILL ASKS is returned with its question (the step ends in it), and nothing is recorded as assumed", async () => {
  const heard = [];
  let n = 0;
  const send = clarifyTransport(async () => { n++; return reply({ question: ASK }); }, { charged: () => true, onDefault: (d) => heard.push(...d) });
  const got = await send(REQ);
  assert.equal(n, 2, "it was sent more than once again, or never");
  assert.deepEqual(got.content[0].input.question, ASK);
  assert.deepEqual(heard, []);
});

test("A CALL PREPARED BEFORE THE CHARGE is replayed for its exact request (question offered), never sent again without it", async () => {
  const rec = recorder();
  const prepared = await rec.wrap(async () => reply({ change: "prepared" }))(REQ);
  assert.equal(prepared.content[0].input.change, "prepared");
  const rp = replayer({ calls: rec.calls });
  let made = 0;
  const send = clarifyTransport(rp.wrap(async () => { made++; return reply({ change: "fresh" }); }), { charged: () => true, replayHas: (r) => rp.has(r) });
  const got = await send(REQ);
  assert.equal(made, 0, "the prepared answer was not replayed");
  assert.equal(got.content[0].input.change, "prepared");
});

test("A LEDGER READING THAT THROWS is no charge; and `defaultedOf` reads only well-formed entries, bounded", async () => {
  const sent = [];
  await clarifyTransport(async (r) => { sent.push(r); return reply({}); }, { charged: () => { throw new Error("x"); } })(REQ);
  assert.deepEqual(props(sent[0]), ["change", "question"]);
  assert.deepEqual(defaultedOf(reply({ defaulted: [{ assumed: "  a  " }, { assumed: 3 }, "b", null, { instead: "c" }] })), [{ assumed: "a" }, { assumed: "b" }]);
  assert.equal(noAskRequest({ messages: [] }).tools, undefined);
  const req2 = { ...REQ, tools: [{ ...TOOL, input_schema: { ...TOOL.input_schema, required: ["question", "change"] } }] };
  assert.deepEqual(noAskRequest(req2).tools[0].input_schema.required, ["change"], "a required question survived the swap");
});

test("THE QUESTION FIELD, WHERE IT IS STILL OFFERED, FORBIDS ASKING FOR WHAT THE SITE OR THEIR WORDS ALREADY ANSWER OR IMPLY (no keyword rule: a purpose)", () => {
  assert.match(QUESTION_FIELD.description, /already answer or imply/);
  assert.match(QUESTION_FIELD.description, /where a link or button should lead/);
});

// ── 2. THE REPLY FACTS ──────────────────────────────────────────────────────

test("WHAT WAS ASSUMED IS A FACT THE REPLY STATES — edit and add-on, on a finished answer only; `defaultedReport` puts it on an ok answer only", async () => {
  const D = [{ assumed: "Two columns", instead: "One column" }];
  const e = editReplyFacts({ ok: true, layer: "page", page: "/about", defaulted: D });
  assert.ok(e.facts.some((f) => /used “Two columns”/.test(f.text) && /“One column” instead/.test(f.text)), JSON.stringify(e.facts));
  const a = addonReplyFacts({ ok: true, kinds: ["component"], defaulted: [{ assumed: "Above the story" }] });
  assert.ok(a.facts.some((f) => /used “Above the story”/.test(f.text)), JSON.stringify(a.facts));
  const no = editReplyFacts({ ok: false, error: "compile", msg: "It did not build.", defaulted: D });
  assert.ok(!no.facts.some((f) => /Two columns/.test(f.text)));
  const json = (b) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
  assert.deepEqual((await (await defaultedReport(json({ ok: true }), D)).json()).defaulted, D);
  assert.equal((await (await defaultedReport(json({ ok: false }), D)).json()).defaulted, undefined);
  assert.equal((await (await defaultedReport(json({ ok: true }), [])).json()).defaulted, undefined);
});

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

test("BEFORE ANY CHARGE an edit step still asks: a single photo change's step is offered its question and the question is kept, nothing charged", async () => {
  const slug = freshSlug("no-ask-pre");
  const store = bucket(slug);
  store.poke(SOURCE_KEY(slug), JSON.stringify([{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }, { path: "contact.tsx", source: CONTACT }]));
  const worker = await loadWorker();
  const compiler = installCompiler();
  const offered = [];
  try {
    await withWire({
      [T.pick]: { fields: ["images"], scopes: [{ part: "images", words: PHOTO, answers: [] }] },
      [PIC]: (args) => { offered.push(offers(args)); return { pictures: [], question: QPIC }; },
    }, async (seen) => {
      const m0 = reserves(seen);
      const r = await postRoute(worker, envFor(store), store, seen, slug, browserPost(SITE3(slug), { intent: "edit", layer: "look" }, PHOTO + "."), "sync");
      assert.deepEqual(offered, [true], "before any charge the step was not offered its question");
      assert.equal(r.body.clarify && r.body.clarify.text, QPIC.text, JSON.stringify(r.body).slice(0, 300));
      assert.equal(reserves(seen) - m0, 0);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("BEFORE ANY CHARGE the router still asks, and its answer resumes the request", async () => {
  const slug = freshSlug("no-ask-router");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ route: [{ intent: "clarify", question: ASK }, { intent: "edit", layer: "look", answered: true }] }, async (seen) => {
    const a = (await routeCall(worker, envFor(store), { slug, message: "Make the about page nicer." })).body;
    assert.equal(a.question && a.question.text, ASK.text, JSON.stringify(a).slice(0, 300));
    assert.match(String(seen.routerAsked[0].messages[0].content), /A QUESTION MAY BE ASKED/);
    const b = (await routeCall(worker, envFor(store), { slug, message: "Two columns", ask: { id: a.question.id } })).body;
    assert.equal(b.instruction, "Make the about page nicer.");
    assert.ok(contextBlock(b.ask.context).includes("Two columns"));
  }, { slug });
});

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

test("ADD-ON ROUTE (job): after the first reserve the page writer is still offered its question (owner, 2026-10-26): the addition waits on it with its reserve refunded, and the answer resumes it — the addition lands, charged once", { timeout: 30000 }, async () => {
  let n = 0;
  await withPlatform({
    slug: slugOf("a"), pages: PAGES, replies: true, balance: 400, db: rowsDb({ tables: {} }),
    answers: { ...TABLE_ADD, route: [{ intent: "addon" }, { intent: "addon", answered: true }], [RT.pages]: async (args) => (/Below the story/.test(JSON.stringify(args.messages)) ? { pages: [{ path: "src/routes/about.tsx", source: ABOUT_LIST }] } : (++n, { question: QPAGES })) },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please add a suppliers list to the About page." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    const writes = P.modelLog.filter((m) => m.tool === RT.pages);
    assert.ok(writes.length >= 1 && writes.every((w) => w.props.includes("question") && !w.props.includes("defaulted")), "a page writer request after the reserve was not offered its question: " + JSON.stringify(writes.map((w) => w.props)));
    assert.equal(net(P, "edit"), 0, "the addition waiting on its question kept a charge: " + JSON.stringify(P.ledger));
    const q = P.question();
    assert.equal(q && q.question.text, QPAGES.text);
    await sendMessage(P, { message: "Below the story", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("about.tsx").includes("Our suppliers"));
    assert.ok(net(P, "edit") < 0, "the addition was not charged");
    assert.ok(n >= 1);
  });
});

test("ADD-ON ROUTE (job): a page writer that asks even when told it cannot ends the addition in its question — nothing applied, and the addition's reserve refunded", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  await withPlatform({
    slug: slugOf("b"), pages: PAGES, replies: true, balance: 400, db,
    answers: { ...TABLE_ADD, [RT.pages]: { question: QPAGES } },
  }, async (P) => {
    const before = P.page("about.tsx");
    const r = await sendMessage(P, { message: "Please add a suppliers list to the About page." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "waiting", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.page("about.tsx"), before);
    assert.equal(net(P, "edit"), 0, "the addition that ended in a question kept a charge: " + JSON.stringify(P.ledger));
  });
});

test("ADD-ON ROUTE (job), BEFORE ANY CHARGE: a component addition's page writer (no reserve before it) is still offered its question", { timeout: 30000 }, async () => {
  await withPlatform({
    slug: slugOf("c"), pages: PAGES, replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [RT.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: "add a questions section to the About page", uses: [] }] },
      "add:component": { component: [{ page: "/about", where: "on the About page", does: "answers common questions", components: ["card"] }] },
      [RT.pages]: { question: QPAGES },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please add a questions section to the About page." });
    await settle(P, r.key);
    const writes = P.modelLog.filter((m) => m.tool === RT.pages);
    assert.ok(writes.length >= 1 && writes[0].props.includes("question"), "before any charge the page writer was not offered its question");
    assert.ok(P.question(), "the question before any charge was not kept");
  });
});
