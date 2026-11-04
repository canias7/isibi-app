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
test("DL3 the thread draws them, done, before the reply's text", () => {
  assert.match(chat, /: \(typeof siteReqDoneLines === 'function' \? \(\(dl\) => \(dl\.length \? progressListHTML\(dl, false, true\) : ''\)\)\(siteReqDoneLines\(m, site\)\) : ''\)\) \+ siteMsgText\(/);
});
test("DL4 the reply is the agent's own words: the step answer carries `said`, and the request keeps it", async () => {
  const RQ = await import("../builder/request.mjs");
  const src = readFileSync(new URL("../builder/request.mjs", import.meta.url), "utf8");
  assert.match(src, /p\.agentSaid = \(typeof ans\.body\.said === "string" && ans\.body\.said\.trim\(\) \? ans\.body\.said : ans\.body\.msg\)/);
  assert.match(readFileSync(new URL("../worker.js", import.meta.url), "utf8"), /msg: facts\.join\(" "\), facts, \.\.\.\(typeof ag\.summary === "string" && ag\.summary\.trim\(\) \? \{ said: ag\.summary\.trim\(\)\.slice\(0, 4000\) \} : \{\}\),/);
  assert.ok(RQ);
});
