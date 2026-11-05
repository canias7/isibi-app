// FAILURE MESSAGES WRITTEN BY THE AI (2026-11-04, the owner's "3A", carry-over
// M-83): the site agent's failure endings go through the reply writer when
// AI_FAILURE_REPLIES is "on"; the fixed text is the fact and the fallback. Off
// by default until the owner has seen it live. Nothing here calls a model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const D = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const J = readFileSync(new URL("../builder/edit-job.mjs", import.meta.url), "utf8");
const fn = W.slice(W.indexOf("async function aiFailureText("), W.indexOf("async function aiFailureText(") + 1400);

test("AF1 off unless the switch says on; the fixed text is the fact and the fallback; never throws", () => {
  assert.ok(fn.length > 200, "the landmark exists");
  assert.match(fn, /if \(!fixed \|\| !env \|\| env\.AI_FAILURE_REPLIES !== "on"\) return fixed;/);
  assert.match(fn, /facts: \[\{ id: "f1", kind: "not-done", text: fixed \}\]/);
  assert.match(fn, /return out && out\.ok && typeof out\.text === "string" && out\.text\.trim\(\) \? out\.text\.trim\(\) : fixed;/);
  assert.match(fn, /catch \(e\) \{ console\.error\("reply: agent failure", errorClassForLog\(e\)\); return fixed; \}/);
});

test("AF2 every agent failure ending is told through it: the save failures, the stop, the provider pause", () => {
  assert.match(W, /\.\.\.\(await putBackNote\(body\)\) \} \};/);
  assert.match(W, /msg: await aiFailureText\(env, \(retried \? "It was tried twice\. " : ""\) \+ stoppedFacts\(ag\) \+ " Nothing was charged\.", \{ request: words, picker \}\)/);
  assert.match(W, /msg: await aiFailureText\(env, "The AI provider is not answering right now, so I paused\./);
});

test("AF3 the switch reaches the Worker (off by default) and container jobs", () => {
  assert.match(D, /AI_FAILURE_REPLIES: \$\{\{ secrets\.AI_FAILURE_REPLIES \|\| 'off' \}\}/);
  assert.match(D, /\n\s+AI_FAILURE_REPLIES\n/, "listed among the deploy's secrets");
  assert.match(J, /"AI_FAILURE_REPLIES",/);
});
