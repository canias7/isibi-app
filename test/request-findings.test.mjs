// THE TWO FINDINGS OF RUN 95's R1, REPRODUCED (2026-10-04, on the owner's
// word: *"yes look into both problems"*). Free: the product's own functions,
// run on what run 95 recorded (test/fixtures/run95-r1.json — the bakery's six
// stored pages after R1, and the three job results the page read for R1's
// parts), with supplied model answers. Nothing here is a fix: each FOUND case
// asserts the behaviour as it is, so the fix that changes it flips the case.
//
// F1. A menu link handed from the add-on step to the menu step was refused
//     `no-menu`. Two layers: the add-on's page step links a new page from ONE
//     page (its directive: "Link it from the header menu: return that page
//     too"), while every page in this kit carries its own menu; and the menu
//     step, shown one menu (the union of every page's), reads an item any page
//     carries as present everywhere, so an addition finds nothing new.
//
// F2. R1's parts got no model-written reply. The reply's context was stored
//     with each result and the facts are built from each (nothing skipped), so
//     the reply call itself fell back — and each way it can (a deadline, a send
//     error, an unreadable answer, a fact left uncovered twice) leaves exactly
//     what R1 showed: the result with no reply. The run's own timings name the
//     way: every read with a reply to write took about 12 s longer than one
//     without, the reply call's own ceiling (`REPLY_CALL_MS`), and a call cut
//     there is read as `send`, with no second try. The Worker's own log line
//     (`reply: <kind> fell back (<why>)`) confirms it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runNavEdit, navSlots, frameNow, actionSlots, contactSlots, NAV_TOOL } from "../builder/site-nav.mjs";
import { addDirective } from "../builder/site-add.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import { editReplyFacts, addonReplyFacts, writeReply, withReplyText, REPLY_TOOL, REPLY_CALL_MS, REPLY_DEADLINE_MS } from "../builder/site-reply.mjs";
import { callBuilderModel } from "../builder/build-call.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const F = JSON.parse(fs.readFileSync(ROOT + "test/fixtures/run95-r1.json", "utf8"));
const PAGES = F.pages.map((p) => ({ path: "src/routes/" + p.path, source: p.source }));
const ROUTES = [...new Set(PAGES.map((p) => routeOf(p.path)).filter(Boolean))];
const menuOf = (file) => (navSlots(PAGES).find((s) => s.page === "src/routes/" + file) || { items: [] }).items.map((i) => i.href);
const navAnswer = (links) => async () => ({ content: [{ type: "tool_use", name: NAV_TOOL.name, input: { links } }], usage: { input_tokens: 100, output_tokens: 20 }, stop_reason: "tool_use" });

// ── F1 ────────────────────────────────────────────────────────────────────

test("FOUND (run 95, F1): after R1 the Classes link is in the menu of the home page and the new page only", () => {
  assert.deepEqual(ROUTES, ["/", "/order", "/starter", "/visit", "/gallery", "/classes"]);
  assert.ok(menuOf("index.tsx").includes("/classes"));
  assert.ok(menuOf("classes.tsx").includes("/classes"));
  for (const f of ["order.tsx", "visit.tsx", "gallery.tsx"]) assert.ok(!menuOf(f).includes("/classes"), `${f} has the link`);
  // The menus differ by design too: Order and Visit carry no Gallery.
  for (const f of ["order.tsx", "visit.tsx"]) assert.ok(!menuOf(f).includes("/gallery"));
  assert.ok(menuOf("gallery.tsx").includes("/gallery"));
});

test("FOUND (run 95, F1): the add-on's page step tells the page writer to link the new page from one page", () => {
  const d = addDirective("page", { file: "classes.tsx", path: "/classes", name: "Classes", purpose: "a page about the classes", sections: [] }, {});
  assert.match(d, /- Link it from the header menu: return that page too, with the link added and nothing else changed\./);
});

test("FOUND (run 95, F1): the menu step reads an item any page carries as present on every page, so the addition finds nothing new and refuses no-menu", async () => {
  const slots = navSlots(PAGES);
  const now = frameNow({ slots, actions: actionSlots(PAGES), seconds: actionSlots(PAGES, "secondAction"), contacts: contactSlots(PAGES), lists: [] });
  assert.ok(now.menu.some((i) => i.href === "/classes"), "the frame's menu does not count the link two pages carry");
  // What the editor is shown is that union, and a model asked to add the link
  // answers it with Classes in it (it already is), or with Classes added to a
  // page's own menu — either way, nothing in the answer is new.
  for (const links of [
    now.menu.map((i) => ({ label: i.label, href: i.href })),
    [...menuOf("order.tsx").map((href) => ({ label: href, href })), { label: "Classes", href: "/classes" }],
  ]) {
    const out = await runNavEdit({ send: navAnswer(links) }, { instruction: "put a link to the new Classes page in the menu", pages: PAGES, routes: ROUTES, addition: true });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "no-menu");
    assert.equal(out.msg, "I couldn't work out what the menu should be. Tell me what to add, take out or move.");
  }
});

// ── F2 ────────────────────────────────────────────────────────────────────

const factsOf = (r) => (Array.isArray(r.body.kinds) ? addonReplyFacts(r.body, { routedCost: 3, inRequest: true }) : editReplyFacts(r.body, { routedCost: 3, inRequest: true }));

test("FOUND (run 95, F2): R1's three part results reached the page with no model reply, though each gives the writer facts — nothing was skipped", () => {
  assert.deepEqual(F.partResults.map((r) => [r.job.slice(0, 8), r.status]), [["4ad20b96", 200], ["073e0a57", 200], ["ac0a5b9f", 422]]);
  for (const r of F.partResults) {
    assert.equal(r.body.reply, undefined, `${r.job} carried a reply`);
    assert.equal(r.body.replySource, undefined);
    assert.equal(r.body.replyFor, undefined, "the private reply context was served");
    const f = factsOf(r);
    assert.equal(f.skip, null, `${r.job}'s facts skipped (${f.skip})`);
    assert.ok(f.facts.length >= 2, `${r.job} gave ${f.facts.length} fact(s)`);
  }
  // Part 0's are the description and the two parts it put off, each told as its own part of the same request.
  assert.deepEqual(factsOf(F.partResults[0]).facts.map((x) => x.kind), ["changed", "pending", "pending"]);
});

test("each way the reply call can fall back leaves the result without a reply, exactly as R1's were; an answer that covers every fact attaches one", async () => {
  const facts = factsOf(F.partResults[0]).facts;
  const ids = facts.map((x) => x.id);
  const tool = (input) => async () => ({ content: [{ type: "tool_use", name: REPLY_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 10 } });
  const covers = await writeReply({ send: tool({ reply: "The description now mentions the classes; the menu link and the page come next.", covers: ids }) }, { facts, model: "m" });
  assert.equal(covers.ok, true);
  assert.equal(withReplyText(F.partResults[0].body, covers.text).replySource, "model");
  // A fact left out twice: `uncovered`.
  const short = await writeReply({ send: tool({ reply: "The description is changed.", covers: [ids[0]] }) }, { facts, model: "m" });
  assert.deepEqual([short.ok, short.why, short.attempts], [false, "uncovered", 2]);
  // An answer that is not the tool's: `unreadable`, after one call.
  const bad = await writeReply({ send: async () => ({ content: [{ type: "text", text: "Done." }] }) }, { facts, model: "m" });
  assert.deepEqual([bad.ok, bad.why, bad.attempts], [false, "unreadable", 1]);
  // A call that throws: `send`.
  const down = await writeReply({ send: async () => { throw new Error("upstream 500"); } }, { facts, model: "m" });
  assert.deepEqual([down.ok, down.why], [false, "send"]);
  // A call slower than the deadline: `deadline`.
  const slow = await writeReply({ send: () => new Promise((r) => setTimeout(() => r(null), 200)) }, { facts, model: "m", deadlineMs: 20 });
  assert.deepEqual([slow.ok, slow.why], [false, "deadline"]);
});

test("FOUND (run 95, F2): a reply call is cut by its own 12 s timer, and the writer reads the cut as `send` — after one call, with no second try — so a reply slower than 12 s is never written", async () => {
  assert.equal(REPLY_CALL_MS, 12000);
  assert.equal(REPLY_DEADLINE_MS, 20000);
  // THE WORKER HANDS EVERY REPLY CALL THAT CEILING: its budget answers
  // REPLY_CALL_MS whatever cap it is asked about, and the reply is sent with it.
  const W = fs.readFileSync(ROOT + "worker.js", "utf8");
  const b = W.indexOf("const replyBudget = ");
  const m = W.indexOf("async function writeModelReply(");
  assert.ok(b >= 0 && m >= 0, "a landmark in worker.js moved");
  assert.match(W.slice(b, W.indexOf("\n", b)), /\{ capMs: \(\) => REPLY_CALL_MS \}/);
  assert.match(W.slice(m, W.indexOf("\n}\n", m)), /quickSend\(env, "reply", replyBudget\)/);
  // THE BUDGET BECOMES A TIMER ON THE CALL ITSELF (the real model call, here
  // given 40 ms for 12 s), and a transport that has not answered by then — as a
  // slow model has not — is cut. The writer reads that as `send`, not as its
  // own deadline, and does not ask again.
  const facts = factsOf(F.partResults[0]).facts;
  let sent = 0;
  const silent = (url, init) => { sent++; return new Promise((_, no) => init.signal.addEventListener("abort", () => no(init.signal.reason), { once: true })); };
  const t0 = Date.now();
  const cut = await writeReply({ send: (req) => callBuilderModel({ xai: "k" }, req, { capMs: () => 40 }, silent) }, { facts, model: "grok-4.6" });
  assert.deepEqual([cut.ok, cut.why, cut.attempts, sent], [false, "send", 1, 1]);
  assert.ok(Date.now() - t0 < REPLY_DEADLINE_MS / 10, "the writer's own deadline ended it, not the call's timer");
  // The same path, answered inside the call's time, is written: the cut above is the timer's, not the stub's.
  const ids = facts.map((x) => x.id);
  const quick = async () => new Response(JSON.stringify({
    choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ function: { name: REPLY_TOOL.name, arguments: JSON.stringify({ reply: "The description now names the classes; the menu link and the page come next.", covers: ids }) } }] } }],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  }), { status: 200, headers: { "content-type": "application/json" } });
  const written = await writeReply({ send: (req) => callBuilderModel({ xai: "k" }, req, { capMs: () => 40 }, quick) }, { facts, model: "grok-4.6" });
  assert.deepEqual([written.ok, written.attempts], [true, 1]);
});
