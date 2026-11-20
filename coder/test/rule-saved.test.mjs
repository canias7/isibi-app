// A RULE TAKEN ON A CARD IS STORED WHEN IT IS TAKEN (audit M-g-12; Claude Code's changelog: "Fixed rules added ... at a
// main-conversation tool prompt ... looking saved when the settings file couldn't be written; the terminal now warns"):
// "Yes, and don't ask again" sends a rule step; Coder's Worker stores it from the live save at once, says so in the chat when
// it cannot, stores it again at the job's end, and stores it from a lost job's kept steps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
function fakeBucket({ failRules = false } = {}) {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { if (failRules && k.includes("/rules/")) throw new Error("storage down"); m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef", ID = "shop-r1";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("RS1 \"Yes, and don't ask again\" sends the rule as a step at once", async () => {
  const A = await import("../container/coder-agent.mjs");
  const events = []; let n = 0;
  const steps = [say("", [call("bash", { command: "curl -sS https://example.com/x" }, "b1")]), say("ok")];
  const r = await A.runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "ok" }), emit: (e) => events.push(e), here: () => "/work/shop", root: "/work/shop", where: (p) => p, ask: async (pid) => { const card = events.find((e) => e.type === "permission" && e.pid === pid); return { choice: "always", rules: card.rules }; } }, { text: "go", mode: "acceptEdits", messages: [] });
  const rules = events.filter((e) => e.type === "rule").map((e) => e.rule);
  assert.equal(rules.length, 1);
  assert.deepEqual(r.rulesAdded, rules);
});

async function liveSend(bucket, events) {
  const L = await import("../src/coder-live.mjs");
  const env = { CODER_TOKEN_KEY: KEY, CODER_BUCKET: bucket };
  await bucket.m.set("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, turn: 2, status: "running", repo: "ana/shop" }));
  const chat = UID + "/" + ID, pass = await L.livePass(env, chat, 2);
  const r = await L.handleLive(new Request("https://coder.gofarther.dev" + L.LIVE_PATH, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": chat, "x-coder-turn": "2", "x-coder-live": pass }, body: JSON.stringify({ from: 0, events }) }), env);
  return r.json();
}

test("RS2 the live save stores a rule step in the repository's rules at once; one it cannot store is told back, and the machine says so in the chat", async () => {
  const ok = fakeBucket();
  const j = await liveSend(ok, [{ at: 1, type: "rule", rule: "Bash(curl *)" }]);
  assert.equal(j.ruleFailed, undefined);
  const saved = JSON.parse(ok.m.get("coder/" + UID + "/rules/ana__shop.json"));
  assert.deepEqual(saved.allow, ["Bash(curl *)"]);
  const bad = fakeBucket({ failRules: true });
  const j2 = await liveSend(bad, [{ at: 1, type: "rule", rule: "Bash(curl *)" }]);
  assert.deepEqual(j2.ruleFailed, ["Bash(curl *)"]);
  // The machine's sender turns that into a note in the chat.
  const S = await import("../container/server.mjs");
  const t = { events: [{ at: 1, type: "rule", rule: "Bash(curl *)" }] };
  const sender = S.liveSender(t, { url: "https://x/live", chat: "c", turn: 2, pass: "p" }, async () => new Response(JSON.stringify({ ok: true, have: 1, ruleFailed: ["Bash(curl *)"] }), { status: 200 }), { every: 60_000 });
  await sender.flush();
  assert.ok(t.events.some((e) => e.type === "note" && e.warn === true && e.text === "That rule could not be saved, so Coder will ask again next time."));
});

test("RS3 the job's end says a rule it could not store, instead of swallowing it; a lost job's rule steps are stored", async () => {
  const R = await import("../src/coder-routes.mjs");
  assert.equal(R.RULE_NOT_SAVED, "That rule could not be saved, so Coder will ask again next time.");
  assert.deepEqual(R.ruleStepsOf([{ type: "rule", rule: "Bash(a *)" }, { type: "note" }, { type: "rule", rule: "Bash(a *)" }, { type: "rule", rule: 5 }]), ["Bash(a *)"]);
  const src = read("src/coder-routes.mjs");
  assert.doesNotMatch(src, /changeRules\(bucket, uid, meta\.repo, "allow", s\.result\.rulesAdded\.slice\(0, 20\), \{ add: true \}\)\.catch\(\(\) => \{\}\)/);
  assert.match(src, /if \(!stored\) fresh\.push\(\{ at: Date\.now\(\), type: "note", warn: true, text: RULE_NOT_SAVED \}\);\n\s+\}\n\s+\/\/ THE OWNER'S VARIABLE VALUES/);
  assert.match(src, /const lostRules = ruleStepsOf\(kept\.events\);\n\s+if \(lostRules\.length\) await changeRules\(bucket, uid, meta\.repo, "allow", lostRules, \{ add: true \}\)/);
});
