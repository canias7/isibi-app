// The last two bash-tool items never tried live (the owner, 2026-11-13: "test what u are missing to test"): a test switch that
// makes Coder's network gate fail on a real machine, so its failing closed can be tried live on gofarther.dev.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const dir = (n) => mkdtemp(join(tmpdir(), "coder-missing-" + n + "-"));

test("CD560 the environment's CODER_TEST_NETWORK_GATE_FAIL makes the network gate fail to start, so its failing closed can be tried live: with a limited network, the chat says commands have no internet in this message and Coder is told the network is off; without it, the gate starts as before", async () => {
  const S = await import("../container/server.mjs");
  /** One message on Coder's real machine service, with the environment's network and variables given. */
  async function message(setup) {
    const r = { root: await dir("root"), gitRoot: await dir("git"), memRoot: await dir("mem"), bgRoot: await dir("bg"), home: await dir("home"), proxyDir: await dir("proxy") };
    const project = "missing-gate-" + Math.random().toString(36).slice(2, 8);
    const seen = [];
    const app = S.createApp({ ...r, send: async (req) => { seen.push(req); return say("Done."); } });
    const srv = http.createServer(app);
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    const base = "http://127.0.0.1:" + srv.address().port;
    try {
      const sent = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "check the network", messages: [], mode: "acceptEdits", setup }) });
      assert.equal(sent.status, 200);
      let st;
      for (let i = 0; i < 400; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
      assert.ok(st && st.result, "the message ended");
      return { events: st.events || [], told: String(((seen[0] || {}).messages || [])[0] && seen[0].messages[0].content || "") };
    } finally { srv.close(); }
  }
  const limited = { mode: "trusted" };
  // The switch on, a limited network: the gate doesn't start, and nothing gets out.
  const off = await message({ network: limited, vars: { CODER_TEST_NETWORK_GATE_FAIL: "1" } });
  assert.ok(off.events.some((e) => e.type === "error" && e.text === "The network settings could not be set up on this machine (" + S.GATE_TEST_FAIL + "); commands have no internet in this message."), JSON.stringify(off.events));
  assert.match(off.told, /NETWORK: OFF FOR THIS MESSAGE\. The network gate could not start on this machine, so commands have no internet access at all until it does/);
  assert.doesNotMatch(off.told, /NETWORK: this chat's environment is LIMITED/);
  // Off ("0"), or not set: the gate starts as before.
  for (const vars of [{ CODER_TEST_NETWORK_GATE_FAIL: "0" }, {}]) {
    const on = await message({ network: limited, vars });
    assert.equal(on.events.some((e) => e.type === "error" && /could not be set up on this machine/.test(String(e.text))), false, JSON.stringify(vars));
    assert.match(on.told, /NETWORK: this chat's environment is LIMITED/);
  }
  // Read only from the environment's own variables (a repository's settings can't set it), and it holds for the whole
  // message: a network change mid-message that needs the gate fails as the gate would.
  const src = await readFile(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /t\.gateTestFail = varOn\(varsGiven\.CODER_TEST_NETWORK_GATE_FAIL\);/);
  assert.match(src, /const varsGiven = body\.setup && body\.setup\.vars && typeof body\.setup\.vars === "object" \? body\.setup\.vars : \{\};/);
  assert.match(src, /if \(t\.gateTestFail && \(list\.length \|\| net\.limited\)\) throw new Error\(GATE_TEST_FAIL\);\n\s+if \(list\.length \|\| net\.limited\) \{\n\s+const px = await proxyFor\(\);/);
});
