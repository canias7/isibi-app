// AN ANSWER ITS STEP REFUSED IS NEVER GIVEN AGAIN (2026-10-11, the validation
// round, after Codex's review of fb50298e).
//
// Codex's reproduction: an independent table designer asks a question while
// the component designer answers with a COMPLETE tool response placing the
// requested About-page FAQ on /does-not-exist. That reply passes the provider
// check (`unusableReply`), but the component's cleaner refuses its page. The
// job pauses on the table's question; after the answer, the component's
// identical request was answered from the record, refused again, and the
// request failed — the paused-job filter cannot help, because a paused job can
// hold another task's refused answer. With only that cached reply removed, the
// next call answered the About page and the request completed.
//
// The rule now: the step that validates a reply marks it when it refuses it
// (`rejectReply`), and that verdict travels with the record exactly as a
// cut-off does — kept for diagnosis, never replayed. At the step's own turn a
// refused answer is corrected ONCE, the model shown the step's structured
// reason; a second refusal is the answer (never a loop). A refusal by the
// model, a question and a no-op are its answers and are never retried.
//
// Through the real request driver, queue consumer, routes and job runner, with
// supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb } from "./fixtures/rows-db.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { rejectReply, recorder, readPrepared } from "../builder/prepared.mjs";

blockNetwork();

const slugOf = (k) => "va-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };

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
const FAQ_ON = (page) => ({ component: [{ page, where: "after the story", does: "answers common questions", components: ["card"] }] });
const EMAIL_Q = { question: { text: "Should signups also keep an email address?", options: ["Yes", "No"] } };
const creates = (db) => db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length;
const scopes2 = [{ kind: "table", words: W_TABLE, uses: [] }, { kind: "component", words: W_FAQ, uses: [] }];
const keptVerdicts = (P) => P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".kept.json")).flatMap((k) => JSON.parse(P.readObj(k)).calls.map((c) => c.unusable).filter(Boolean));

test("VA 0 — THE MARK TRAVELS WITH THE RECORD: a reply its step refused after it was recorded is written with its verdict and never read back as replayable; an unrefused reply beside it is", async () => {
  const tool = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "t", input }] });
  const rec = recorder();
  const send = rec.wrap(async (req) => tool({ n: req.n }));
  const a = await send({ model: "m", messages: [{ role: "user", content: "a" }], n: 1 });
  await send({ model: "m", messages: [{ role: "user", content: "b" }], n: 2 });
  rejectReply(a, "add:no-page");
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls }));
  assert.equal(stored.calls[0].unusable, "rejected:add:no-page");
  assert.equal(stored.calls[1].unusable, undefined);
  const read = readPrepared(stored);
  assert.equal(read.calls.length, 1);
  assert.deepEqual(read.discarded.map((d) => d.why), ["rejected:add:no-page"]);
});
