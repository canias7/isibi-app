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
  const sig = body.indexOf("const was = t.netSig; t.netSig = sig;"), same = body.indexOf("if (was === sig) return send(200, { ok: true, applied: true, same: true });"), note = body.indexOf('text: envChangeText(was, sig, nn, list.length)');
  assert.ok(sig > 0 && same > sig && note > same, "compared, and returned without a note, before the note is written");
  // The rule, applied twice to the same settings: one note, then none.
  const t = {}; const notes = [];
  const apply = (nn, list) => { const s = JSON.stringify({ n: nn, k: list }); const was = t.netSig; t.netSig = s; if (was === s) return; notes.push(nn.mode); };
  apply({ mode: "trusted" }, []); apply({ mode: "trusted" }, []); apply({ mode: "full" }, []);
  assert.deepEqual(notes, ["trusted", "full"]);
});

test("LE3 the network as said in the chat is the same whatever shape it came in", async () => {
  const { netSigOf } = await import("../container/server.mjs");
  assert.match(server, /t\.netSig = netSigOf\(nn, secretList\);/);
  assert.match(server, /const sig = netSigOf\(nn, list\);/);
  const a = netSigOf({ mode: "custom", hosts: ["b.com", "a.com"], defaults: true }, [{ host: "api.x.com", header: "Authorization", name: "k" }]);
  const b = netSigOf({ mode: "custom", hosts: ["a.com", "b.com"], defaults: true, extra: 1 }, [{ hosts: ["api.x.com"] }]);
  assert.equal(a, b);
  assert.notEqual(a, netSigOf({ mode: "custom", hosts: ["a.com"], defaults: true }, [{ host: "api.x.com" }]));
});

test("LE4 the line says what changed: sites and keys added or removed, else the network's name", async () => {
  const { envChangeText, netSigOf } = await import("../container/server.mjs");
  const n1 = { mode: "custom", hosts: ["example.com"], defaults: true }, n2 = { mode: "custom", hosts: ["example.com", "ipv4.icanhazip.com"], defaults: true };
  assert.equal(envChangeText(netSigOf(n1, []), netSigOf(n2, []), n2, 0), "The environment changed: now also allows ipv4.icanhazip.com, from now on in this job.");
  assert.equal(envChangeText(netSigOf(n2, []), netSigOf(n1, [{ host: "api.x.com" }]), n1, 1), "The environment changed: no longer allows ipv4.icanhazip.com; a saved key for api.x.com, from now on in this job.");
  assert.equal(envChangeText(netSigOf({ mode: "trusted" }, []), netSigOf({ mode: "full" }, []), { mode: "full" }, 0), "The environment changed: network Full, from now on in this job.");
  assert.equal(envChangeText(undefined, netSigOf(n1, []), n1, 0), "The environment changed: network Limited, from now on in this job.");
  assert.doesNotMatch(server, /why: \{ was:/, "no hidden record kept on the line");
});
