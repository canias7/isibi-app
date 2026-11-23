// Live test r11 (2026-11-23): what the browser test of the 8 "Claude Code way" batches found, each run for real here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as A from "../container/coder-agent.mjs";

const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("R11a notebook_edit runs for real through Coder's loop (its check before the hooks gets notebook_path, the cell and the edit): live, every NotebookEdit was refused with \"give a path\"", async () => {
  const d = mkdtempSync(join(tmpdir(), "r11-nb-")), seen = mkdtempSync(join(tmpdir(), "r11-nb-seen-"));
  const nb = { cells: [{ cell_type: "code", id: "cell-1", metadata: {}, execution_count: null, outputs: [], source: ["print(1)"] }], metadata: { language_info: { name: "python" } }, nbformat: 4, nbformat_minor: 5 };
  writeFileSync(join(d, "nb.ipynb"), JSON.stringify(nb, null, 1) + "\n");
  const scripts = [];
  for (const how of [{ notebook_path: join(d, "nb.ipynb") }, { notebook_path: "nb.ipynb" }]) {
    const steps = [
      say("", [call("tool_search", { query: "select:notebook_edit", max_results: 1 }, "s1")]),
      say("", [call("read", { file_path: "nb.ipynb" }, "r1")]),
      say("", [call("notebook_edit", { ...how, cell_id: "cell-1", new_source: "print(2)" }, "n1")]),
      say("done"),
    ];
    let n = 0;
    const r = await A.runCoder({
      send: async () => steps[Math.min(n++, steps.length - 1)],
      exec: async (x) => {
        const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
        if (!tm) return { code: 0, output: "" };
        scripts.push(JSON.parse(Buffer.from(tm[1], "base64").toString()));
        const out = spawnSync("node", ["--no-warnings", TOOLS, tm[1]], { cwd: d, encoding: "utf8", env: { ...process.env, CODER_SEEN_DIR: seen } });
        return { code: out.status, output: out.stdout };
      },
      emit: () => {}, here: () => d, root: d, where: (p) => (p.startsWith("/") ? p : d + "/" + p), ask: async () => ({ choice: "yes" }),
    }, { text: "go", mode: "acceptEdits", messages: [] });
    const answer = r.messages.find((m) => m.tool_call_id === "n1").content;
    assert.doesNotMatch(answer, /give a path/, "the check before the hooks had the notebook's path");
    assert.match(answer, /^Updated cell cell-1 with print\(2\)/, JSON.stringify(how));
    const now = JSON.parse(readFileSync(join(d, "nb.ipynb"), "utf8"));
    assert.equal([].concat(now.cells[0].source).join(""), "print(2)");
    // Back to print(1) for the second way of naming it.
    writeFileSync(join(d, "nb.ipynb"), JSON.stringify(nb, null, 1) + "\n");
  }
  // The machine's check was asked about the notebook with its own inputs.
  const check = scripts.find((s) => s.tool === "file_check" && s.args.tool === "notebook_edit");
  assert.ok(check, "a file_check ran for notebook_edit");
  assert.equal(check.args.args.cell_id, "cell-1");
  assert.equal(check.args.args.new_source, "print(2)");
  assert.equal(typeof check.args.args.notebook_path, "string");
});
