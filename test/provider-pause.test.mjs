// THE AI PROVIDER DOWN PART-WAY (2026-11-04, the owner's "4A": pause like the
// credit pause). A part whose agent stopped because the provider was down is
// paused (`provider`), not lost and not charged; the tick runs it again after
// PROVIDER_RETRY_MS from its kept work, Continue runs it at once, and after
// PROVIDER_MAX_RUNS tries it ends as any refusal.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settleState, providerPaused, resumeProvider, nextStep, PART_TERMINAL, NOT_JOINABLE, PROVIDER_RETRY_MS, PROVIDER_MAX_RUNS } from "../builder/request.mjs";

const R = readFileSync(new URL("../builder/request.mjs", import.meta.url), "utf8");
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const C = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("PP1 a provider-paused part keeps the request open, is not picked, and resumes only when its wait is over (or on Continue)", () => {
  const rec = settleState({ key: "k", parts: [{ n: 0, status: "done", jobs: [] }, { n: 1, status: "provider", retryAt: 1000, jobs: [] }] }, 0);
  assert.equal(rec.state, "provider");
  assert.equal(rec.ended, false);
  assert.ok(!PART_TERMINAL.includes("provider") && NOT_JOINABLE.includes("provider"));
  assert.deepEqual(providerPaused(rec), [1]);
  void nextStep; // nextStep files only ready parts; a paused part is not one (asserted by its status)
  assert.equal(resumeProvider(rec, 999), null, "not before its wait is over");
  const up = resumeProvider(rec, 1000);
  assert.equal(up.parts[1].status, "ready");
  assert.equal(up.parts[1].providerRuns, 1);
  assert.equal(up.parts[1].retryAt, undefined);
  assert.equal(up.state, "running");
  assert.equal(resumeProvider(rec, 0, { force: true }).parts[1].status, "ready", "Continue runs it at once");
  assert.equal(PROVIDER_RETRY_MS, 120000);
  assert.equal(PROVIDER_MAX_RUNS, 30);
});

test("PP2 the engine reads the agent's provider ending as a pause, capped; the worker resumes on the tick and on Continue; the chat labels it", () => {
  assert.match(R, /read\.error === "agent-stopped" && ans\.body\.waiting === true && !leftOf\(ans\.body\) && !p\.left && \(Number\(p\.providerRuns\) \|\| 0\) < PROVIDER_MAX_RUNS\) \{\s*job\.end\.act = "provider";[\s\S]{0,200}p\.status = "provider"; p\.why = "provider";\s*p\.retryAt = now \+ PROVIDER_RETRY_MS;/);
  assert.match(W, /base = await creditsStep\(env, base\);\s*\/\/[^\n]*\n[^\n]*\n\s*\{ const r = resumeProvider\(base, Date\.now\(\)\); if \(r\) \{/);
  assert.match(W, /if \(resume === true && !creditsPaused\(next\)\.length && providerPaused\(next\)\.length\) \{\s*next = resumeInLine\(resumeProvider\(next, Date\.now\(\), \{ force: true \}\)\);/);
  assert.match(W, /error: "agent-stopped", waiting: true, wait: ag\.wait, layer: "agent", cost: 0/, "the agent's ending the engine reads");
  assert.match(C, /provider: 'aidown',/);
  assert.match(C, /aidown: 'paused: the AI is down, retrying'/);
});
