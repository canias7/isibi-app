// L-machine-39 (2026-11-19): a command stopped at its time limit answers even when something it started in its own
// session (setsid) still holds its output open, as Claude Code answers "Command timed out".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { execIn } from "../container/server.mjs";

const tag = (n) => "coder_detached_" + process.pid + "_" + n;
const tidy = (n) => { try { execSync("pkill -f " + tag(n)); } catch { /* none left */ } };

test("L-machine-39 a timed-out command with a detached child still answers (kill: true and stopAtTimeout)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "coder-td-"));
  try {
    let t0 = Date.now();
    const a = await execIn(dir, "setsid bash -c 'sleep 9 # " + tag(1) + "' & sleep 30", 2, { kill: true });
    assert.ok(Date.now() - t0 < 5000, "answered within ~4 s, took " + (Date.now() - t0));
    assert.equal(a.timedOut, true);
    t0 = Date.now();
    const b = await execIn(dir, "setsid bash -c 'sleep 9 # " + tag(2) + "' & sleep 30", 2, { stopAtTimeout: true, spillDir: join(dir, "out") });
    assert.ok(Date.now() - t0 < 5000, "answered within ~4 s, took " + (Date.now() - t0));
    assert.match(b.output, /^Command timed out after 2s/);
    assert.equal(b.code, 143);
  } finally { tidy(1); tidy(2); }
});
