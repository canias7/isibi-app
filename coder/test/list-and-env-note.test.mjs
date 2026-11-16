// The one-message live test, 2026-11-16: Grok skipped "Undo the last job" and "Rename the chat" as "you did not ask", and the
// chat said "The environment changed: network Limited" after cards that changed nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");

test("LE1 Coder's instructions: every line of a list is a request; one that can't be done says why", () => {
  assert.match(agent, /Each line of a list the user sent is a request: do every item, in order\. Never skip one as "not asked"\./);
  assert.ok(agent.indexOf("Each line of a list") < agent.indexOf("end with a compact table"), "before the table line");
});

test("LE2 the machine says the environment changed only when its network or keys really changed", () => {
  const i = server.indexOf('url.pathname === "/network"') > 0 ? server.indexOf('url.pathname === "/network"') : server.indexOf("const nn = normNetwork(body.setup && body.setup.network);");
  const body = server.slice(i, i + 6000);
  const sig = body.indexOf("const was = t.netSig; t.netSig = sig;"), same = body.indexOf("if (was === sig) return send(200, { ok: true, applied: true, same: true });"), note = body.indexOf('text: "The environment changed: network "');
  assert.ok(sig > 0 && same > sig && note > same, "compared, and returned without a note, before the note is written");
  // The rule, applied twice to the same settings: one note, then none.
  const t = {}; const notes = [];
  const apply = (nn, list) => { const s = JSON.stringify({ n: nn, k: list }); const was = t.netSig; t.netSig = s; if (was === s) return; notes.push(nn.mode); };
  apply({ mode: "trusted" }, []); apply({ mode: "trusted" }, []); apply({ mode: "full" }, []);
  assert.deepEqual(notes, ["trusted", "full"]);
});

test("LE3 the job's starting network is remembered, so the first /network with the same settings says nothing", () => {
  assert.match(server, /t\.netSig = JSON\.stringify\(\{ n: nn, k: secretList\.map\(\(s\) => \[s\.host \|\| "", s\.hosts \|\| \[\], s\.header \|\| "", s\.name \|\| ""\]\) \}\);/);
  assert.match(server, /const sig = JSON\.stringify\(\{ n: nn, k: list\.map\(\(s\) => \[s\.host \|\| "", s\.hosts \|\| \[\], s\.header \|\| "", s\.name \|\| ""\]\) \}\);/);
});
