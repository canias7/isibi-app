// A MESSAGE TYPED BESIDE A WAITING QUESTION IS NOT SWALLOWED (2026-10-26).
//
// Live case (driftwood-and-daughters-5, 19:26 and 19:28 UTC): a question from
// a part was waiting; the customer typed "Put the reviews section above the
// lessons section on the home page, and make sure only I can see who signed
// up to the newsletter." The router read it as the answer (`answered` true),
// the old request resumed with the old instruction, and the newsletter half
// was never made a part. Now the router names the new work beside an answer
// (`alsoNew`, the customer's own words), and it is added to the same request
// as parts of its own, routed when their turn comes.
//
// The four cases, with supplied router answers:
//   pure answer      → resumes, nothing new
//   new request only → answered false: the question is superseded and the
//                      message routed fresh (the route's existing branch)
//   answer + new     → resumes AND the new work becomes parts
//   button press     → `chosen` is an answer, as before
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeMessage, LIVE_ASK_TOOL } from "../builder/site-ask.mjs";
import * as RQ from "../builder/request.mjs";

const SITE = { name: "Driftwood", url: "https://driftwood-and-daughters-5.gofarther.app", pages: ["/", "/cafe"], tables: ["newsletter_signups"] };
const said = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: LIVE_ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
const MSG = "Reviews is the one headed What people say. Also make sure only I can see who signed up to the newsletter.";
const NEW = "make sure only I can see who signed up to the newsletter";
const pending = { request: "Put the reviews section above the lessons section", question: { text: "Which block is reviews?", options: ["Band3Split", "Band4Four"] } };

async function route(input, opts = {}) {
  let sent = null;
  const r = await routeMessage({ send: async (req) => { sent = req; return said(input); } },
    { message: MSG, site: SITE, hasSite: true, model: "test-model", canAsk: true, pending, ...opts });
  return { r, sent };
}

test("the live tool and the waiting-question block offer `alsoNew`", async () => {
  const p = LIVE_ASK_TOOL.input_schema.properties;
  assert.ok(p.alsoNew && p.alsoNew.type === "array", "no alsoNew field on the live tool");
  const { sent } = await route({ intent: "edit", layer: "page", answered: true });
  const shown = JSON.stringify(sent);
  assert.ok(shown.includes("THEIR LAST REQUEST IS WAITING ON AN ANSWER"), "observer dead: the waiting block was not sent");
  assert.ok(/answers AND asks for something new[^"]*alsoNew/.test(shown), "the waiting block does not tell the router to name new work in alsoNew");
});

test("pure answer: resumes, nothing new", async () => {
  const { r } = await route({ intent: "edit", layer: "page", answered: true });
  assert.equal(r.answered, true);
  assert.equal(r.failed, undefined);
  assert.equal(r.alsoNew, undefined);
});

test("answer + new work: the new work comes back in the customer's own words", async () => {
  const { r } = await route({ intent: "edit", layer: "page", answered: true, alsoNew: [NEW] });
  assert.equal(r.answered, true);
  assert.notEqual(r.failed, true);
  assert.deepEqual(r.alsoNew, [NEW]);
});

test("new work not found in the message is never run: the answer is unusable, unbilled", async () => {
  const { r } = await route({ intent: "edit", layer: "page", answered: true, alsoNew: ["lock the bookings table"] });
  assert.equal(r.failed, true);
  assert.equal(r.usage, null);
  assert.ok(String(r.decision && JSON.stringify(r.decision)).includes("also-new-unread"));
});

test("a malformed alsoNew is no answer at all", async () => {
  const { r } = await route({ intent: "edit", layer: "page", answered: true, alsoNew: [42] });
  assert.equal(r.failed, true);
});

test("new request only: answered false carries no alsoNew (the route supersedes and routes fresh)", async () => {
  const { r } = await route({ intent: "edit", layer: "rules", answered: false, alsoNew: [NEW] });
  assert.equal(r.answered, false);
  assert.equal(r.alsoNew, undefined);
});

test("button press: chosen is an answer, as before", async () => {
  const { r } = await route({ intent: "edit", layer: "page" }, { message: "Band3Split", pending: { ...pending, chosen: true } });
  assert.equal(r.answered, true);
  assert.equal(r.alsoNew, undefined);
});

const KA = "a".repeat(20), KB = "b".repeat(20);
const rec = () => ({ key: KA, message: pending.request, ended: false, stop: false, joined: [], parts: [
  { n: 0, words: pending.request, at: -1, needs: [], held: [], putOff: [], status: "waiting", jobs: [], targets: null },
] });

test("appendNewWork: one unrouted part per entry, idempotent on the key, refused on an ended request", () => {
  const r = RQ.appendNewWork(rec(), { key: KB, items: [NEW] });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.parts, [1]);
  const p = r.rec.parts[1];
  assert.equal(p.words, NEW);
  assert.equal(p.route, null, "new work must be routed when its turn comes, not run on the answer's route");
  assert.equal(p.phase, "route");
  assert.equal(p.status, "ready");
  assert.ok(r.rec.message.includes(NEW));
  assert.ok(RQ.appendNewWork(r.rec, { key: KB, items: [NEW] }).duplicate);
  assert.equal(RQ.appendNewWork({ ...rec(), ended: true }, { key: KB, items: [NEW] }).why, "ended");
  assert.equal(RQ.appendNewWork(rec(), { key: KB, items: [] }).ok, false);
});

// THE WIRING: the route hands `alsoNew` to the resume, and the resume writes it
// in the same save as the answer. Read landmark to landmark.
test("worker: the route carries alsoNew into rAsk and the resume appends it before saving", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("async function resumeRequestPart(");
  const b = src.indexOf("saveRequestRecord(env, next, at.etag)", a);
  assert.ok(a > 0 && b > a, "landmarks missing");
  const body = src.slice(a, b);
  assert.ok(/const more = appendNewWork\(next, \{ key, items: ask\.alsoNew \}\);\s*if \(more\.ok && !more\.duplicate\) next = more\.rec;/.test(body), "the resume does not write the new work into the record it saves");
  const r1 = src.indexOf("const rNew = resumed && Array.isArray(routed.alsoNew)");
  assert.ok(r1 > 0, "the route does not read alsoNew");
  const sets = src.match(/rAsk = \{ answered: true,[^\n]*alsoNew: rNew/g) || [];
  assert.equal(sets.length, 2, "both answered branches must carry alsoNew");
});
