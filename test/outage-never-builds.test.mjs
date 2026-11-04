// A provider outage never starts a paid build (2026-11-04, carry-over G1).
// The old router answered "waiting" when the provider was down (owner,
// 2026-10-24); the agent's new-project path answered "build", and the page
// started a paid first build from "hi". Now the agent keeps the provider's
// notice, the new-project turn passes it up (the route then answers
// "waiting", which the page shows and retries), and no failure builds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runSiteAgent } from "../builder/site-agent.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const NOTICE = { kind: "provider-wait", title: "Grok is not answering", model: "grok", resumeAt: 1 };

const parked = () => { const e = new Error("503 unavailable"); e.parked = true; e.providerWait = { notice: NOTICE, facts: {} }; return e; };

test("the agent keeps the provider's waiting notice when its model call parks", async () => {
  const ag = await runSiteAgent({ send: async () => { throw parked(); }, canAsk: () => true, startBuild: () => true }, { request: "hi, a site for my bakery", pages: [], parts: [], history: "", model: "m", newProject: true, maxRounds: 4 });
  assert.equal(ag.ok, false);
  assert.equal(ag.stopped, "send");
  assert.deepEqual(ag.wait, NOTICE);
});

test("an ordinary failure carries no wait (control)", async () => {
  const ag = await runSiteAgent({ send: async () => { throw new Error("bad request"); }, canAsk: () => true, startBuild: () => true }, { request: "hi", pages: [], parts: [], history: "", model: "m", newProject: true, maxRounds: 4 });
  assert.equal(ag.ok, false);
  assert.equal(ag.wait, null);
});

const fnOf = (src, head) => { const a = src.indexOf(head); assert.ok(a > 0, head); return src.slice(a, src.indexOf("\n}\n", a)); };

test("the new-project turn never answers build on a failure, and passes the wait up", () => {
  const f = fnOf(worker, "async function newProjectTurn(").replace(/\/\/[^\n]*/g, "");
  const fail = f.slice(f.indexOf("if (!ag || !ag.ok) {"), f.indexOf("let cost = 0;"));
  assert.ok(fail.length > 20, "the observer is alive: the failure branch was found");
  assert.doesNotMatch(fail, /intent: "build"/, "a failed turn answers build");
  assert.match(fail, /ag && ag\.wait \? \{ wait: ag\.wait \}/);
  // The route already turns a failed answer carrying `wait` into "waiting".
  assert.match(worker, /if \(routed\.failed === true && routed\.wait && !rJob\) \{\s*return Response\.json\(\{ ok: false, waiting: true,/);
});

test("the page never starts a build on a failed or unreadable answer", () => {
  assert.doesNotMatch(chat, /if \(!r\.ok \|\| !d\) return go\(\);/, "a failed request still builds");
  assert.doesNotMatch(chat, /isBuild \? go\(\) : lost\(\)/, "a thrown request still builds a new project");
  assert.match(chat, /if \(!r\.ok \|\| !d \|\| d\.ok !== true \|\| d\.failed === true\) return lost\(r\);/);
  // …and that line comes after the waiting answer is handled, so a wait is shown, not lost.
  assert.ok(chat.indexOf("if (d && d.waiting === true && d.wait") < chat.indexOf("if (!r.ok || !d || d.ok !== true || d.failed === true) return lost(r);"));
});
