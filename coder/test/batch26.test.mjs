import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoSettings, scrubFrom, retryEnv, withRepoOwn } from "../container/server.mjs";
import { maxRetriesOf } from "../container/coder-model.mjs";

test("B26a a repository's .claude/settings.json env sets the extra folders' instructions switch, the retry count, the scrub and its caps", () => {
  const dir = mkdtempSync(join(tmpdir(), "b26-"));
  mkdirSync(join(dir, ".claude"));
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ env: { CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1", CLAUDE_CODE_MAX_RETRIES: "2", CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1", CLAUDE_CODE_SCRIPT_CAPS: "{\"x\":1}" } }));
  const own = repoSettings(dir).own;
  assert.equal(own.CODER_ADDITIONAL_DIRECTORIES_CODER_MD, "1");
  assert.equal(own.CODER_MAX_RETRIES, "2");
  assert.equal(own.CODER_SUBPROCESS_ENV_SCRUB, "1");
  assert.equal(own.CODER_SCRIPT_CAPS, "{\"x\":1}");
  // The retry count reaches the model client; the owner's own wins.
  assert.equal(maxRetriesOf(retryEnv({}, withRepoOwn({}, own))), 2);
  assert.equal(maxRetriesOf(retryEnv({}, withRepoOwn({ CODER_MAX_RETRIES: "5" }, own))), 5);
  assert.equal(maxRetriesOf(retryEnv({}, {})), 10);
});

test("B26b a repository may turn the scrub on but never off; its caps only while the scrub is on, the owner's first", () => {
  assert.deepEqual(scrubFrom({}, { CODER_SUBPROCESS_ENV_SCRUB: "1", CODER_SCRIPT_CAPS: "r" }, false), { on: true, caps: "r" });
  assert.deepEqual(scrubFrom({}, { CODER_SUBPROCESS_ENV_SCRUB: "0" }, true), { on: true, caps: "" });
  assert.deepEqual(scrubFrom({ CODER_SUBPROCESS_ENV_SCRUB: "1" }, { CODER_SUBPROCESS_ENV_SCRUB: "0" }, false).on, true);
  assert.deepEqual(scrubFrom({}, { CODER_SCRIPT_CAPS: "r" }, false), { on: false, caps: "" });
  assert.deepEqual(scrubFrom({ CODER_SUBPROCESS_ENV_SCRUB: "1", CODER_SCRIPT_CAPS: "o" }, { CODER_SCRIPT_CAPS: "r" }, false).caps, "o");
});
