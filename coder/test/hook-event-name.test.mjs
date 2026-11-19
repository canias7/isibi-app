// L-second-32 (2026-11-19): a hook whose hookEventName cannot become text gives a hook error notice and the job goes on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hookResult, hookResultSafe, wrongEvent } from "../container/coder-hooks.mjs";

const out = JSON.stringify({ hookSpecificOutput: { hookEventName: { toString: 1 } } });

test("L-second-32 an object hookEventName is a hook error, at every event; an unreadable answer is too", () => {
  assert.match(wrongEvent("Stop", JSON.parse(out)), /expected 'Stop' but got '\{"toString":1\}'/);
  for (const ev of ["UserPromptSubmit", "SessionStart", "PreToolUse", "Stop"]) {
    const r = hookResult(ev, { code: 0, stdout: out, stderr: "" }, { type: "command", command: "x" });
    assert.notEqual(r.kind, "ok", ev);
    assert.match(String(r.notice || r.reason), /incorrect event name/, ev);
  }
  const run = { code: 0, stderr: "", get stdout() { throw new TypeError("boom"); } };
  const r = hookResultSafe("Stop", run, { type: "command", command: "x" });
  assert.equal(r.kind, "error");
});
