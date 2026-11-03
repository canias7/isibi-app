// AN ANSWER THAT ARRIVED IS NOT AN ANSWER THAT CAN BE GIVEN AGAIN (2026-10-11,
// the unusable-answer round, after Codex's review of 648964d5).
//
// Codex's reproduction: one Add-on with an independent table and a FAQ
// component, both `uses: []`. The table's designer asks whether to keep an
// email address; beside it the component's designer answers with a provider
// reply cut off at `max_tokens`. The first job rightly waits for the table's
// answer — but it kept the cut-off reply with the rest, and after "No" the
// component's identical request was answered from that record: the request
// failed, and the component's designer was never asked again. Removing only
// that cached reply (Codex's control) let both changes complete.
//
// The rule now, at the one boundary every recorded answer passes (record,
// stage, read, replay — `builder/prepared.mjs`): a reply that is cut off,
// paused, an error, or not a reply at all is kept for the record but never
// given again, and a record stored before this rule is read under it too. A
// complete answer — a design, a question, a refusal, a reply that changes
// nothing — keeps its meaning and is replayed as before.
//
// Through the real request driver, queue consumer, routes and job runner, with
// supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, T, SOURCE_KEY } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { unusableReply, readPrepared, recorder, replayer } from "../builder/prepared.mjs";

blockNetwork();

const slugOf = (k) => "ua-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
const W_TABLE = "add a signups table with a name column";
const W_FAQ = "add a questions section to the About page";
const SIGNUPS = { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] };
const FAQ = { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["card"] }] };
const EMAIL_Q = { question: { text: "Should signups also keep an email address?", options: ["Yes", "No"] } };
// A PROVIDER REPLY CUT OFF AT ITS TOKEN LIMIT: half a tool call, delivered successfully.
const CUT = { __raw: { stop_reason: "max_tokens", content: [{ type: "tool_use", name: "design", input: { component: [{ page: "/about", where: "after" }] } }] } };
const creates = (db, name) => db.log().filter((q) => new RegExp("create table[^(]*" + name, "i").test(q.query)).length;
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };
const scopes2 = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_FAQ, uses: [] }];
const MSG2 = "Please " + W_TABLE + ", and " + W_FAQ + ".";

// ── 1. THE BOUNDARY ITSELF ──────────────────────────────────────────────────

test("UA 0 — WHICH REPLIES CAN BE GIVEN AGAIN: a design, a question, a refusal, prose that changes nothing are kept with their meaning; a reply cut off at its limit, paused, out of context, an error, or not a reply is never replayed — kept for the record, read under the same rule when stored before it", async () => {
  const tool = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "t", input }] });
  for (const ok of [tool({ a: 1 }), tool({ question: { text: "?" } }), { stop_reason: "refusal", content: [{ type: "text", text: "I can't help with that." }] }, { stop_reason: "end_turn", content: [{ type: "text", text: "Nothing to change." }] }, { stop_reason: "end_turn", content: [] }]) {
    assert.equal(unusableReply(ok), "", JSON.stringify(ok));
  }
  const bad = {
    "max_tokens": { stop_reason: "max_tokens", content: [{ type: "tool_use", name: "t", input: {} }] },
    "pause_turn": { stop_reason: "pause_turn", content: [] },
    "context": { stop_reason: "model_context_window_exceeded", content: [] },
    "error": { type: "error", error: { type: "overloaded_error" } },
    "content not a list": { stop_reason: "tool_use", content: "x" },
    "tool input not an object": { stop_reason: "tool_use", content: [{ type: "tool_use", name: "t", input: "{\"a\":" }] },
    "not an object": "a string",
  };
  for (const [name, r] of Object.entries(bad)) assert.notEqual(unusableReply(r), "", name);
  // RECORDED: kept with its verdict; a record stored without one is read under the rule.
  const rec = recorder();
  const send = rec.wrap(async (req) => (req.n === 1 ? bad.max_tokens : tool({ ok: req.n })));
  await send({ model: "m", messages: [{ role: "user", content: "1" }], n: 1 });
  await send({ model: "m", messages: [{ role: "user", content: "2" }], n: 2 });
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls }));
  assert.equal(stored.calls.length, 2, "the cut-off reply was not kept for the record");
  assert.match(stored.calls[0].unusable, /max_tokens/);
  const read = readPrepared(stored);
  assert.equal(read.calls.length, 1);
  assert.equal(read.discarded.length, 1);
  const old = { calls: stored.calls.map(({ h, reply }) => ({ h, reply })) };
  assert.equal(readPrepared(old).calls.length, 1, "a record stored before the rule replayed a cut-off reply");
  // REPLAYED: the usable one answered from the record, the cut-off one asked again.
  let made = 0;
  const rp = replayer(old);
  const again = rp.wrap(async () => { made++; return tool({ fresh: true }); });
  await again({ model: "m", messages: [{ role: "user", content: "1" }] });
  await again({ model: "m", messages: [{ role: "user", content: "2" }] });
  assert.equal(made, 1);
  assert.deepEqual(rp.used(), { calls: 1, rebased: 0, images: 0, missed: 1 });
});

// ── 2. THROUGH THE REAL PATHS ───────────────────────────────────────────────

async function tableAskComponentCut(P, db, { age = false, twice = false, changeAbout = null } = {}) {
  const r = await sendMessage(P, { message: MSG2 });
  const s1 = await settle(P, r.key);
  assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
  assert.equal(creates(db, "signups"), 0);
  const q = P.question();
  assert.ok(q && q.by === "add:table", "the question does not name the table's designer: " + JSON.stringify(q && q.by));
  if (age) {
    // RECORDS STORED BEFORE THE RULE: every kept answer as it was written then.
    const keys = P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".kept.json"));
    assert.ok(keys.length, "nothing was kept");
    for (const k of keys) { const v = JSON.parse(P.readObj(k)); P.writeObj(k, JSON.stringify({ calls: v.calls.map(({ h, reply }) => ({ h, reply })) })); }
  }
  if (changeAbout) P.writeObj(SOURCE_KEY(P.slug), JSON.stringify(JSON.parse(P.readObj(SOURCE_KEY(P.slug))).map((p) => (p.path === "about.tsx" ? { ...p, source: changeAbout } : p))));
  await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
  if (twice) {
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
  }
  return { r, s2: await settle(P, r.key) };
}

// ── 3. THE SAME RULE ON THE EDIT PATH ───────────────────────────────────────

const DESC = "Make the site description say Sourdough baked at dawn by the harbour";
const BRAND = "rename the business to Harbour Loaf & Co";
const NEW_DESC = "Sourdough baked at dawn by the harbour.";
const NEW_BRAND = "Harbour Loaf & Co";
