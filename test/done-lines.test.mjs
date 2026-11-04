// A FINISHED MESSAGE KEEPS ITS STEPS (owner, 2026-11-04: the progress lines
// "disappear" when the reply comes, Market Lane's Stripe change). Once the reply
// is in, the steps its job said are drawn as done above it; none while it works.
// Also: the reply is the agent's own words (`said`), never the stitched record.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const cut = (head) => { const at = chat.indexOf(head); assert.ok(at >= 0, head); return chat.slice(at, chat.indexOf("\n}\n", at) + 2); };
const ctx = vm.createContext({ siteReqTalk: new Map(), siteReqWorkingLine: (m, site) => site.working === true });
vm.runInContext(cut("function siteReqDoneLines("), ctx);
const J = "a".repeat(32);
const site = (extra = {}) => ({ requests: { rq1: { view: { parts: [{ status: "done", jobs: [J], progress: [{ job: J, text: "Reading the buy page" }, { job: J, text: "Writing the checkout" }] }] } } }, ...extra });

test("DL1 a finished one-part message's steps are kept for drawing above its reply", () => {
  assert.deepEqual(ctx.siteReqDoneLines({ request: "rq1", t: "Added card payments." }, site()).map((l) => l.text), ["Reading the buy page", "Writing the checkout"]);
});
test("DL2 none while it still works, and none before its reply", () => {
  assert.equal(ctx.siteReqDoneLines({ request: "rq1", t: "x" }, site({ working: true })).length, 0);
  assert.equal(ctx.siteReqDoneLines({ request: "rq1", t: "" }, site()).length, 0);
});
test("DL4 the reply as siteReqPut really puts it (marked `req`, not `request`) gets the steps; its card does not", () => {
  // THE REAL PRODUCER (2026-11-04): DL1's hand-made `request` mark was not what
  // the thread holds, so the steps still disappeared live.
  const c2 = vm.createContext({ siteReqTalk: new Map(), siteReqWorkingLine: (m, s) => s.working === true, siteMsgsSent: new Map(), siteReqCardAt: () => 0 });
  for (const h of ["function siteReqDoneLines(", "function siteReqOwnMsg(", "function siteReqCard(", "function siteReqPut("]) vm.runInContext(cut(h), c2);
  const s = { msgs: [], ...site() };
  const reply = c2.siteReqPut(s, "rq1", { r: "a", t: "Removed the strip.", for: "end:1", one: true });
  assert.equal(reply.request, undefined);
  assert.equal(reply.req, "rq1");
  assert.deepEqual(c2.siteReqDoneLines(reply, s).map((l) => l.text), ["Reading the buy page", "Writing the checkout"]);
  const card = s.msgs.find((m) => m.request === "rq1");
  assert.ok(card, "the card exists");
  assert.equal(c2.siteReqDoneLines(card, s).length, 0, "the empty card drew the steps too");
});
test("DL3 the thread draws them, done, before the reply's text", () => {
  assert.match(chat, /: \(typeof siteReqDoneLines === 'function' \? \(\(dl\) => \(dl\.length \? progressListHTML\(dl, false, true\) : ''\)\)\(siteReqDoneLines\(m, site\)\) : ''\)\) \+ siteMsgText\(/);
});
test("DL4 the reply is the agent's own words: the step answer carries `said`, and the request keeps it", async () => {
  const RQ = await import("../builder/request.mjs");
  const src = readFileSync(new URL("../builder/request.mjs", import.meta.url), "utf8");
  assert.match(src, /p\.agentSaid = \(typeof ans\.body\.said === "string" && ans\.body\.said\.trim\(\) \? ans\.body\.said : ans\.body\.msg\)/);
  // The agent's own words, with what really failed added (carry-over M-66, 2026-11-04).
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const said = agentSaidTruth\(ag\.summary, \{ failed: facts\.filter/);
  assert.match(w, /msg: facts\.join\(" "\), facts, \.\.\.\(said \? \{ said \} : \{\}\),/);
  assert.ok(RQ);
});

// THE WORKING SIGN UNDER THE ANSWER (owner, 2026-11-04, Market Lane's photo: the
// dots stayed above the question while it worked on "Stripe").
test("DL5 answering a request's question moves its empty working card to just under the answer", () => {
  const fn = chat.slice(chat.indexOf("function siteAskReply("), chat.indexOf("\n}\n", chat.indexOf("function siteAskReply(")));
  const push = fn.indexOf("site.msgs.push(siteSentMsg({ r: 'u', t: said");
  const move = fn.indexOf("site.msgs.push(site.msgs.splice(at, 1)[0])");
  assert.ok(push > 0 && move > push, "the card is not moved after the answer is pushed");
  assert.match(fn, /m\.r === 'a' && m\.request === asked\.request\.key && !m\.t/);
});
