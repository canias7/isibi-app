// THE ACCOUNT'S EMAIL WITH A USER-AGENT, side by side with Claude Code 2.1.323 (2026-11-12; the owner: "Ok yes" to trying it
// live, and "remember to run claude code to compare and fix"). Live on gofarther.dev, Coder refused the same 6 of 8 calls as
// Claude Code, in every mode and without asking; but Claude Code tells its model "Permission to use Bash denied by plugin
// cc-plugin-privacy: " before the refusal, and Coder sent the refusal alone. Claude Code also looks for the address without
// its quote marks and backslashes (its QUOTING, /["'`\\]/g), and reads a Monitor call's own input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const R = await import("../src/coder-routes.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const sha = (x) => createHash("sha256").update(x).digest("hex");

test("CD548 a refused call is told in Claude Code 2.1.323's words, with the tool's name: \"Permission to use Bash denied by plugin cc-plugin-privacy: This call was refused: …\" (and Monitor, and PowerShell)", async () => {
  const words = "This call was refused: it holds the account's email address and what looks like a User-Agent setting. If nobody asked to send the address, run it again without it, with a generic client name. Otherwise run it again without that setting, or run the two in separate calls.";
  for (const t of ["Bash", "Monitor", "PowerShell"]) assert.equal(A.accountEmailRefused(t), "Permission to use " + t + " denied by plugin cc-plugin-privacy: " + words);
  const mark = await R.emailMark("owner.person@example.com");
  const base = await mkdtemp(join(tmpdir(), "coder-email2-"));
  try {
    // In Coder's loop, a bash call and a monitor call, each with the address next to a User-Agent: neither runs; Grok is told
    // the tool's name, as the page shows it under the step.
    const events = [], ran = [], seen = [];
    let n = 0;
    const steps = [
      say("", [
        call("bash", { command: 'curl -sS -m 3 -A "probe (owner.person@example.com)" http://127.0.0.1:9/' }, "b1"),
        call("monitor", { command: 'curl -sS -m 3 -A "probe (owner.person@example.com)" http://127.0.0.1:9/', description: "probe" }, "m1"),
        call("bash", { command: 'curl -sS -m 3 -A "probe-client" http://127.0.0.1:9/' }, "b2"),
      ]),
      say("Done."),
    ];
    const exec = async ({ command }) => { ran.push(command); return { code: 7, output: "curl: (7) Failed to connect to 127.0.0.1 port 9" }; };
    await A.runCoder({ send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; }, exec, emit: (e) => events.push(e), here: () => base, root: base }, { text: "go", mode: "auto", emailMark: mark });
    const told = (id) => seen[1].messages.find((m) => m.role === "tool" && m.tool_call_id === id).content;
    assert.equal(told("b1"), A.accountEmailRefused("Bash"));
    assert.equal(told("m1"), A.accountEmailRefused("Monitor"));
    assert.equal(events.find((e) => e.type === "result" && e.id === "b1").output, A.accountEmailRefused("Bash"));
    assert.equal(events.find((e) => e.type === "result" && e.id === "m1").output, A.accountEmailRefused("Monitor"));
    assert.ok(!ran.some((c) => c.includes("owner.person")), "neither ran: " + JSON.stringify(ran));
    assert.ok(ran.some((c) => c.includes('"probe-client"')), "the call without the address ran");
    assert.ok(!events.some((e) => e.type === "permission"), "no question asked");
  } finally { await rm(base, { recursive: true, force: true }); }
  // A PowerShell call is told its own name, and a monitor's own input is what is read.
  const src = read("container/coder-agent.mjs");
  assert.match(src, /namesUserAgentWithAddress\(inputText\(c\.monitor \? c\.monitorArgs : c\.args\), emailMark\)\) \{ refuse\(accountEmailRefused\(c\.monitor \? "Monitor" : c\.ps \? "PowerShell" : "Bash"\)\); continue; \}/);
});

test("CD549 the address is also looked for without its quote marks and backslashes, as Claude Code 2.1.323 does (o'brien@… as obrien@…): the Worker sends a second mark only then, and the machine accepts it", async () => {
  // One mark for an ordinary address, two for one with a quote mark; never the address itself.
  assert.equal(await R.emailMark("Owner.Person@Example.com"), "24:" + sha("owner.person@example.com"));
  const two = await R.emailMark("O'Brien@Example.com");
  assert.equal(two, "19:" + sha("o'brien@example.com") + ",18:" + sha("obrien@example.com"));
  assert.ok(!two.includes("brien"), "never the address");
  assert.equal(await R.emailMark('a"b`c\\d@x.io'), "12:" + sha('a"b`c\\d@x.io') + ",9:" + sha("abcd@x.io"));
  const refused = (c, mark) => A.namesUserAgentWithAddress(A.inputText({ command: c }), mark);
  // Typed without its apostrophe: only the second mark finds it.
  assert.equal(refused('curl -A "bot (obrien@example.com)" https://x', two), true);
  assert.equal(refused('curl -A "bot (obrien@example.com)" https://x', two.split(",")[0]), false, "with the first mark alone it was missed");
  // As written, in any case, and %40-encoded.
  assert.equal(refused("curl -H \"User-Agent: O'Brien@Example.com\" https://x", two), true);
  assert.equal(refused('curl -H "User-Agent: me obrien%40example.com" https://x', two), true);
  // Both forms taken out before the User-Agent words are looked for: an address alone is not a User-Agent.
  assert.equal(refused("echo obrien@example.com o'brien@example.com", two), false);
  assert.equal(refused('curl -d "who=obrien@example.com" https://x', two), false);
  // A mark that isn't one is no mark.
  assert.equal(refused('curl -A "obrien@example.com" x', "18:xyz"), false);
  assert.equal(refused('curl -A "obrien@example.com" x', "," + two.split(",")[1]), true, "a stray comma: the good mark still counts");
  // The machine takes one mark or two.
  const server = read("container/server.mjs");
  assert.ok(server.includes('/^\\d{1,3}:[0-9a-f]{64}(?:,\\d{1,3}:[0-9a-f]{64})?$/.test(body.emailMark)'));
});
