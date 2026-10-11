// A CORRECTED ANSWER IS PROCESSED EXACTLY AS A FIRST ANSWER IS (2026-10-11,
// round 10, after Codex's review of 4074eb38).
//
// Codex's reproduction: an About-page FAQ with collapsible answers. The first
// component answer names /does-not-exist and lists no requirements; the
// correction names /about and lists the explicitly requested collapsible-answer
// requirement; the page writer builds ordinary static cards. When that valid
// answer came first, the requirement judge ran and the request was partial with
// the requirement still to do. When it came through the correction the judge
// never ran and the request said done: the requirements, suggestions, skipped
// entries, trace mark and stored record had all been taken from the refused
// answer, before the correction replaced it.
//
// Now the cleaner reads each answer first, and one path processes whichever
// answer is final. These cases run through the real request driver, queue
// consumer, routes and job runner, with supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { carrySuperseded } from "../builder/site-requirements.mjs";

blockNetwork();

const slugOf = (k) => "ca-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.notDone]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }];
// THE WRITER BUILDS ORDINARY STATIC CARDS: nothing opens or closes.
const ABOUT_CARDS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { Card } from '@/components/ui/card'\n"
  + "export const Route = createFileRoute('/about')({ component: Page })\n"
  + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
const ASK = "add a questions section to the About page with collapsible answers";
const NEED = "Each answer opens and closes when its question is tapped";
const REQ = (need = NEED) => ({ need, basis: "asked", words: "collapsible answers", status: "covered", by: "the questions section", item: "/about", kind: "page" });
const FAQ = (page, requirements = []) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }], requirements });
// THE JUDGE, AS A MODEL WOULD ANSWER: the writer built static cards, so a
// requirement about answers opening and closing is not carried.
const judge = (args) => {
  const text = (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
  const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{"));
  judged.push(lines.length);
  return { verdicts: lines.map((l) => JSON.parse(l)).map((e) => ({ id: e.id, follows: "asked", carried: "no", reason: "the answers are static cards" })) };
};
let judged = [];
const one = (component) => ({
  route: { intent: "addon" },
  [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: ASK, uses: [] }] },
  "add:component": component,
  [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_CARDS }] },
  judge_requirements: judge,
});
const notDoneNeeds = (rec) => (rec.parts[0].notDone || []).map((x) => x.what);

test("CA 0 control — THE VALID ANSWER FIRST: the requirement is judged, the static cards do not carry it, and the request is partial with it still to do", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  await withPlatform({ slug: slugOf("0"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return FAQ("/about", [REQ()]); }) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.deepEqual(notDoneNeeds(rec), [NEED]);
    assert.equal(n, 1);
    assert.ok(judged.length >= 1, "the judge never ran");
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    once(P);
  });
});

test("CA 1 — CODEX'S REPRODUCTION: the first answer names /does-not-exist with no requirements; the correction names /about with the asked-for requirement; the judge runs on the corrected answer and the request is partial with it still to do — exactly as when it came first; 2 calls", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  await withPlatform({ slug: slugOf("1"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return n === 1 ? FAQ("/does-not-exist") : FAQ("/about", [REQ()]); }) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.deepEqual(notDoneNeeds(rec), [NEED]);
    assert.equal(n, 2);
    assert.ok(judged.length >= 1, "the judge never ran on the corrected answer");
    once(P);
  });
});

test("CA 2 — A REQUIREMENT ONLY THE REFUSED ANSWER LISTED IS NOT LOST: the first answer names a missing page but lists the asked-for requirement; the correction lists none; the requirement is still judged and told, never claimed covered", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  await withPlatform({ slug: slugOf("2"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [REQ()]) : FAQ("/about"); }) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.deepEqual(notDoneNeeds(rec), [NEED]);
    assert.equal(n, 2);
    once(P);
  });
});

test("CA 3 — A CHANGED REQUIREMENT: the refused answer and the correction quote the same words with different wording; only the correction's is told, once", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  const NEW_NEED = "A visitor can show or hide each answer";
  await withPlatform({ slug: slugOf("3"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return n === 1 ? FAQ("/does-not-exist", [REQ()]) : FAQ("/about", [REQ(NEW_NEED)]); }) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.deepEqual(notDoneNeeds(rec), [NEW_NEED]);
    once(P);
  });
});

test("CA 4 — A CORRECTION THAT ASKS: the correction asks where the questions go; the job waits on that question; after the answer the designer is asked once more (never answered from the refused reply), its requirement judged, and the request ends partial; 3 calls", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  const Q = { question: { text: "Above or below the story?", options: ["Above", "Below"] } };
  await withPlatform({ slug: slugOf("4"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return n === 1 ? FAQ("/does-not-exist") : n === 2 ? Q : FAQ("/about", [REQ()]); }) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", why(s1.rec));
    const q = P.question();
    assert.ok(q && q.by === "add:component", JSON.stringify(q));
    await sendMessage(P, { message: "Below", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "partial", why(s2.rec));
    assert.deepEqual(notDoneNeeds(s2.rec), [NEED]);
    assert.equal(n, 3);
    once(P);
  });
});

test("CA 5 — A CORRECTION THAT NEEDS A RESULT IT WAS NOT SHOWN: beside a table, the component's first answer names a missing page; its correction says it needs the table; it is asked again, shown the table and the reason, and lands; component 3 calls, the table made once", { timeout: 30000 }, async () => {
  const db = rowsDb({ tables: {} });
  const seen = [];
  let n = 0;
  const W_TABLE = "add a signups table with a name column";
  await withPlatform({
    slug: slugOf("5"), pages: PAGES, replies: true, balance: 400, db,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["table", "component"], scopes: [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: ASK, uses: [] }] },
      "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] },
      "add:component": async (args) => { n++; seen.push(JSON.stringify(args.messages || [])); return n === 1 ? FAQ("/does-not-exist") : n === 2 ? { needs: ["table"] } : FAQ("/about"); },
      [T.pages]: { pages: [{ path: "src/routes/about.tsx", source: ABOUT_CARDS }] },
      judge_requirements: judge,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + W_TABLE + ", and " + ASK + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    assert.equal(n, 3);
    assert.match(seen[2], /signups/, "the re-ask was not shown the table");
    assert.match(seen[2], /YOUR LAST ANSWER COULD NOT BE USED/, "the re-ask lost the correction's reason");
    assert.equal(db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length, 1);
    once(P);
  });
});

test("CA 6 — A SECOND INVALID ANSWER: the correction also names a missing page and lists the requirement; the addition is refused, nothing applied, and the requirement is judged before the refusal; exactly 2 calls", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  await withPlatform({ slug: slugOf("6"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return FAQ("/nowhere-" + n, [REQ()]); }) }, async (P) => {
    const before = P.page("about.tsx");
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    const { rec } = await settle(P, r.key);
    assert.notEqual(rec.parts[0].status, "done", why(rec));
    assert.equal(n, 2);
    assert.ok(judged.length >= 1, "the corrected answer's requirement was not judged before the refusal");
    assert.equal(P.page("about.tsx"), before);
  });
});

test("CA 7 — DUPLICATE DELIVERY AND RESTART OVER CODEX'S REPRODUCTION: every queued message delivered twice at once, then every message delivered again — still partial with the requirement, 2 calls, nothing charged twice", { timeout: 30000 }, async () => {
  judged = [];
  let n = 0;
  await withPlatform({ slug: slugOf("7"), pages: PAGES, replies: true, balance: 400, answers: one(async () => { n++; return n === 1 ? FAQ("/does-not-exist") : FAQ("/about", [REQ()]); }) }, async (P) => {
    const r = await sendMessage(P, { message: "Please " + ASK + "." });
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
    const { rec } = await settle(P, r.key);
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.deepEqual(notDoneNeeds(rec), [NEED]);
    assert.equal(n, 2);
    once(P);
  });
});

test("CA 8 — carrySuperseded: a requirement the correction no longer lists is carried unsupported and superseded, never with its old claim of covering; the same quoted words or the same hand-off answered is the same requirement", () => {
  const prev = [REQ(), { need: "x", basis: "needed", words: "w", answers: "table#0", status: "covered" }];
  assert.deepEqual(carrySuperseded(prev, [REQ("Reworded")]).map((r) => r.need), ["x"]);
  const [c] = carrySuperseded([REQ()], []);
  assert.equal(c.status, "unsupported");
  assert.equal(c.superseded, true);
  assert.ok(!("by" in c) && !("item" in c) && !("kind" in c));
  assert.deepEqual(carrySuperseded(prev, [{ answers: "table#0", words: "other" }]).map((r) => r.need), [NEED]);
});
