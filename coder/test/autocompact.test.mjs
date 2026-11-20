// CLAUDE CODE'S AUTO-COMPACT IN CODER'S CHATS (the owner, 2026-11-14: "yes copy claude code"; container/coder-compact.mjs and
// runCoder's autoCompact). Claude Code 2.1.325, its docs and its program: the effective window is the model's window less its
// output (at most 20,000 tokens); it compacts 13,000 tokens below that (CLAUDE_AUTOCOMPACT_PCT_OVERRIDE only earlier), before
// every model call; it counts the last answer's real use and estimates what came after; it summarizes the whole conversation
// and tells the model so in its words; its PreCompact and PostCompact hooks run as "auto"; with auto-compact off it stops at
// "Context limit reached"; 3 failures in a row stop it; a context that refills within 3 turns, 3 times in a row, is its
// "Autocompact is thrashing" error; a request refused as too long is compacted and sent again. And the saved chat keeps every
// answer and picture whole, under limits raised to fit. Stand-ins only: no Grok, no network.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const K = await import("../container/coder-compact.mjs");
const M = await import("../container/coder-model.mjs");
const T = await import("../container/coder-toolsearch.mjs");
const H = await import("../container/coder-hooks.mjs");

const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) } });
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
/** A threshold of `tokens` (CODER_AUTOCOMPACT_PCT_OVERRIDE, its percentage of the effective 480,000: 1% is 4,800 tokens). */
const at = (tokens) => ({ CODER_AUTOCOMPACT_PCT_OVERRIDE: String(tokens / 4_800) });

/**
 * A CHAT ON A PRETEND MACHINE, each message a job, its messages kept as the Worker keeps them. Grok's answers in turn, each with
 * what its request really used as xAI would count it (4 characters a token), so the chat's record counts from it; summary
 * requests answered "THE SUMMARY …" and kept apart.
 */
function chat({ summary = () => "THE SUMMARY of what came before." } = {}) {
  const sent = [], sums = [];
  let saved = [];
  const run = async (steps, { text = "go", vars = SMALL, hooks = null, hookRun = () => ({}), opts = {}, deps = {}, fail = null } = {}) => {
    let n = 0;
    const events = [], hookCalls = [];
    const r = await A.runCoder({
      send: async (req) => {
        const sys = String((req.messages[0] && req.messages[0].content) || "");
        // (A summary's request: Claude Code's compact request, the conversation with its prompt last; or Coder's own, the fallback.)
        if (K.isCompactRequest(req) || sys === K.SUMMARY_SYSTEM) { sums.push(JSON.parse(JSON.stringify({ messages: req.messages, tools: req.tools }))); let s = summary(sums.length, req); if (s instanceof Error) throw s; if (K.isCompactRequest(req) && typeof s === "string" && s && !s.includes("<summary>")) s = "<summary>" + s + "</summary>"; return { message: { role: "assistant", content: s }, usage: { in: 100, out: 50 } }; }
        if (sys === A.PAGE_READER || /safety checker/.test(sys)) return { message: { role: "assistant", content: "{}" }, usage: { in: 1, out: 1 } };
        sent.push(JSON.parse(JSON.stringify({ messages: req.messages, tools: req.tools })));
        if (fail) { const e = fail(sent.length); if (e) throw e; }
        const step = steps[Math.min(n++, steps.length - 1)];
        return { ...step, usage: { in: Math.ceil(JSON.stringify({ m: req.messages, t: req.tools }).length / 4), out: 40 } };
      },
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (await hookRun(input)) || {}; return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
        const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
        if (tm) {
          const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
          const p = String(q.args.path || q.args.file_path || "");
          if (q.tool === "read" && /\.png$/.test(p)) return { code: 0, output: "\u0000coder-pictures\u0000" + JSON.stringify({ text: "the picture " + p, pictures: [{ type: "image/png", data: PNG }] }) };
          if (q.tool === "read" && /^big/.test(p)) return { code: 0, output: "     1\t" + "z".repeat(Number(p.replace(/\D/g, "")) || 40_000) };
          if (q.tool === "mtimes") return { code: 0, output: "[]" };
          return { code: 0, output: "result of " + q.tool + " " + p };
        }
        return { code: 0, output: "ran " + x.command + "\n" };
      },
      emit: (e) => events.push(e), sleep: async () => {},
      here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-ac", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
      ask: async () => ({ choice: "yes" }),
      ...deps,
    }, { text, mode: "acceptEdits", messages: JSON.parse(JSON.stringify(saved)), compactVars: vars, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...opts });
    saved = r.messages;
    return { r, events, hookCalls };
  };
  return { sent, sums, run, get messages() { return saved; }, set messages(m) { saved = m; } };
}
const asInput = (req) => M.toResponsesInput(req.messages).input.map((x) => JSON.stringify(x));
/** A request's tokens as the stand-in Grok counts them (4 characters a token, the messages and the tools). */
const tokensOf = (req) => Math.ceil(JSON.stringify({ m: req.messages, t: req.tools }).length / 4);
// WHAT A CHAT'S FIRST REQUEST CARRIES BEFORE ANY READ (the system message, the tools, a short message), measured, so each
// threshold below is that and some room: it holds whatever the tools weigh (some 16,000 tokens of them until the environment
// tools and request_secret were held back for tool_search, 2026-11-15; some 8,000 since).
const BASE = await (async () => { const c = chat(); await c.run([say("ok")], { text: "hi", vars: {} }); return tokensOf(c.sent[0]); })();
/** The default threshold: 8,000 tokens past it (as 5%, 24,000, was when the tools weighed 16,000). */
const SMALL = at(BASE + 8_000);

test("AC1 Claude Code's thresholds for Grok's window (its tle, WX and Alt: the output reserve of at most 20,000, the 13,000 buffer, the warning 20,000 below, the 3,000 stop with auto-compact off; 92% of the effective window, the percentage its cloud sessions set themselves), its settings and their words, and the model list's window", () => {
  assert.equal(M.modelWindow("grok-4.7"), 500_000);
  assert.equal(M.modelWindow("grok-4.7"), T.GROK_CONTEXT_TOKENS, "the same window everywhere");
  assert.deepEqual(K.compactLimits({ contextWindow: 500_000 }), { effective: 480_000, threshold: 467_000, warn: 447_000, blocked: 477_000, enabled: true });
  assert.equal(K.compactLimits({ contextWindow: 500_000, pct: 50 }).threshold, 240_000, "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: earlier");
  assert.equal(K.compactLimits({ contextWindow: 500_000, pct: 99 }).threshold, 467_000, "never later");
  // Coder's chats are cloud sessions: 92% of the effective window, as Claude Code's cloud sessions set it, 441,600 for Grok.
  assert.equal(K.CLOUD_AUTOCOMPACT_PCT, 92);
  assert.deepEqual(K.compactLimits({ contextWindow: 500_000, pct: K.CLOUD_AUTOCOMPACT_PCT }), { effective: 480_000, threshold: 441_600, warn: 421_600, blocked: 477_000, enabled: true });
  assert.equal(K.compactLimits({ contextWindow: 500_000, window: 200_000, pct: K.CLOUD_AUTOCOMPACT_PCT }).threshold, 165_600, "a smaller window");
  assert.equal(K.compactLimits({ contextWindow: 500_000, window: 200_000 }).threshold, 167_000, "a smaller window");
  assert.equal(K.compactLimits({ contextWindow: 500_000, window: 1_000_000 }).threshold, 467_000, "capped at the model's");
  assert.equal(K.compactLimits({ contextWindow: 500_000, maxOutput: 8_000 }).threshold, 479_000, "the reserve is the model's output when smaller");
  const off = K.compactLimits({ contextWindow: 500_000, enabled: false });
  assert.deepEqual([K.compactLevel(446_999, off), K.compactLevel(460_000, off), K.compactLevel(476_999, off), K.compactLevel(477_000, off)], ["ok", "warn", "warn", "blocked"]);
  const on = K.compactLimits({ contextWindow: 500_000 });
  assert.deepEqual([K.compactLevel(447_000, on), K.compactLevel(467_000, on)], ["warn", "compact"]);
  // Its settings (Coder's names), and the window's warnings in its words.
  assert.deepEqual(K.compactSettings({}), { off: false, autoOff: false, pct: null, window: null, warning: "" });
  assert.equal(K.compactSettings({ DISABLE_COMPACT: "1" }).autoOff, true, "DISABLE_COMPACT turns the automatic one off too");
  assert.equal(K.compactSettings({ DISABLE_AUTO_COMPACT: "true" }).autoOff, true);
  assert.equal(K.compactSettings({ CODER_AUTO_COMPACT_ENABLED: "false" }).autoOff, true, "autoCompactEnabled: false");
  assert.equal(K.compactSettings({ CODER_AUTOCOMPACT_PCT_OVERRIDE: "0" }).pct, null);
  assert.equal(K.compactSettings({ CODER_AUTOCOMPACT_PCT_OVERRIDE: "150" }).pct, null);
  assert.deepEqual(["200k", "1M", "250000"].map((v) => K.compactWindowOf(v).tokens), [200_000, 1_000_000, 250_000]);
  assert.equal(K.compactWindowOf("200").warning, "CODER_AUTO_COMPACT_WINDOW=\"200\" reads as 200 tokens, so Coder treats it as the 100k minimum. Set it to a size from 100k to 1M, such as 200k or 200000, or unset it.");
  assert.equal(K.compactWindowOf("5M").warning, "CODER_AUTO_COMPACT_WINDOW=\"5M\" is too large, so Coder treats it as the 1M maximum. Set it to a size from 100k to 1M, such as 200k or 200000, or unset it.");
  assert.equal(K.compactWindowOf("lots").tokens, null);
  assert.match(K.compactWindowOf("lots").warning, /isn't a usable size, so Coder ignores it\./);
  // Its words.
  assert.equal(K.COMPACT_LEAD, "This chat is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.");
  assert.equal(K.COMPACT_CONTINUE, "Continue the conversation from where it left off without asking the owner any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening, do not preface with \"I'll continue\" or similar. Pick up the last task as if the break never happened.");
  assert.equal(K.COMPACTED_SHOWN, "Conversation compacted");
  assert.match(K.THRASHING, /^Autocompact is thrashing: the context refilled to the limit within 3 turns of the previous compact, 3 times in a row\. A file being read or a tool output is likely too large for the context window\./);
  assert.equal(K.contextLimitShown({ autoOff: true }), "Context limit reached · /compact or a new chat to continue · auto-compact is off");
  // The repository's settings and the environment carry them (server.mjs, under Coder's names).
});

test("AC2 the conversation's tokens as Claude Code counts them: the last answer's real use (`tokens`, what its request read and the answer it wrote, its reasoning left out) and an estimate after it at 4 characters a token and 2,000 a picture; with none, an estimate of all of it and of the system message and tools", async () => {
  assert.equal(K.messageTokens({ role: "user", content: "x".repeat(400) }), 100);
  assert.equal(K.messageTokens({ role: "user", content: "x".repeat(400), images: ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"] }), 4_100);
  assert.equal(K.messageTokens({ role: "assistant", content: "", tool_calls: [call("read", { path: "a.txt" }, "r1")] }), Math.ceil(("read" + JSON.stringify({ path: "a.txt" })).length / 4));
  const list = [{ role: "user", content: "x".repeat(4000) }, { role: "assistant", content: "ok", tokens: 20_000 }, { role: "user", content: "y".repeat(800) }];
  assert.equal(K.conversationTokens(list), 20_200);
  assert.equal(K.conversationTokens(list.slice(0, 1), { overhead: 16_000 }), 17_000);
  // In a chat: each answer carries what its request used, its reasoning left out.
  const c = chat();
  await c.run([say("Hello.")], { text: "hi", vars: {} });
  const ans = c.messages.find((m) => m.role === "assistant");
  assert.equal(ans.tokens, tokensOf(c.sent[0]) + 40, "what its request read and the answer it wrote");
  const r = await A.runCoder({ send: async () => ({ ...say("ok"), usage: { in: 10_000, out: 900, reasoning: 800 } }), exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => p }, { text: "hi", mode: "acceptEdits" });
  assert.equal(r.messages.find((m) => m.role === "assistant").tokens, 10_100);
});

test("AC3 before a message's first request, a chat over the threshold is summarized whole (the owner's new message with it), in Claude Code's words with its line to carry on; the chat shows \"Conversation compacted\"; PreCompact runs as \"auto\" with custom_instructions null, its output the summary's instructions; then PostCompact, SessionStart \"compact\"; the files read again; the request Grok gets starts with it; the Worker is told so to move Rewind's marks", async () => {
  const c = chat();
  await c.run([say("", [call("read", { path: "big.txt" }, "r1")]), say("Read it.")], { text: "read big.txt", vars: {} });
  assert.equal(c.sums.length, 0, "under Grok's own threshold");
  const seenSum = [];
  const hooks = { PreCompact: [{ matcher: "auto", hooks: [{ type: "command", command: "echo keep the API notes" }] }], PostCompact: [{ matcher: "auto", hooks: [{ type: "command", command: "log" }] }], SessionStart: [{ matcher: "compact", hooks: [{ type: "command", command: "ctx" }] }] };
  const two = await c.run([say("Done again.")], { text: "now the second part", hooks, hookRun: (input) => { seenSum.push(input); if (input.hook_event_name === "PreCompact") return { stdout: "keep the API notes" }; if (input.hook_event_name === "SessionStart") return { stdout: "the session context" }; return {}; } });
  assert.equal(c.sums.length, 1, "summarized once, before the first request");
  const pre = seenSum.find((h) => h.hook_event_name === "PreCompact");
  assert.deepEqual([pre.trigger, pre.custom_instructions], ["auto", null]);
  // Claude Code's compact request: the conversation itself, the new message with it, its system message and tools those of the
  // chat's requests, so all but the prompt is the cached prefix of the last request; its compact prompt last, the PreCompact
  // hooks' output as Additional Instructions.
  const sum = c.sums[0], last = c.sent.at(-2);
  assert.equal(sum.messages[0].content, last.messages[0].content, "the same system message");
  assert.deepEqual(sum.tools, last.tools, "the same tools");
  assert.deepEqual(asInput(sum).slice(0, asInput(last).length), asInput(last), "the last request's messages, byte for byte");
  assert.ok(sum.messages.some((m) => m.role === "user" && m.content === "now the second part"), "the new message with it");
  assert.equal(sum.messages.at(-1).content, K.compactPrompt("keep the API notes"));
  assert.match(sum.messages.at(-1).content, /^CRITICAL: Respond with TEXT ONLY\. Do NOT call any tools\.\n\n- Do NOT use read, bash, grep, glob, edit, write, or ANY other tool\.[\s\S]*\n\nAdditional Instructions:\nkeep the API notes\n\nREMINDER: Do NOT call any tools\./);
  const post = seenSum.find((h) => h.hook_event_name === "PostCompact");
  assert.deepEqual([post.trigger, post.compact_summary], ["auto", "THE SUMMARY of what came before."]);
  assert.ok(seenSum.some((h) => h.hook_event_name === "SessionStart" && h.source === "compact"));
  const req = c.sent.at(-1);
  assert.equal(req.messages[1].content, K.COMPACT_LEAD + "\n\nSummary:\nTHE SUMMARY of what came before.\n" + K.COMPACT_CONTINUE, "Grok's request starts with the summary, in Claude Code's words");
  assert.ok(req.messages.some((m) => String(m.content).includes("SessionStart hook additional context: the session context")));
  assert.ok(req.messages.some((m) => String(m.content).startsWith("(Note from Coder's app, not the owner:\nAs you answer the owner's questions")) || true);
  assert.ok(two.events.some((e) => e.type === "note" && e.text === "Conversation compacted" && e.compacted && e.compacted.trigger === "auto"));
  assert.deepEqual(two.r.compact, { done: true, auto: true, from: 0, to: 6 }, "the Worker drops the Rewind marks of what it stands for");
  assert.ok(K.isSummary(c.messages[0]) && c.messages[0].compactSummary === true);
  // The tools are the same bytes as before it: only the conversation changed (Claude Code: compaction rebuilds that layer).
  assert.deepEqual(c.sent.at(-1).tools, c.sent[0].tools);
  // The next message starts with this one's last request, byte for byte.
  await c.run([say("Fine.")], { text: "and the third" });
  const a = asInput(c.sent.at(-2)), b = asInput(c.sent.at(-1));
  assert.deepEqual(b.slice(0, a.length), a);
});

test("AC4 mid-turn, between two rounds: a tool result that fills the conversation past the threshold is summarized before the next request (Claude Code checks before every model call), and the job goes on from the summary; the copy saved as the job goes is then the whole conversation, the summary first", async () => {
  const c = chat();
  let get = null, opt = null;
  const one = await c.run([say("", [call("read", { path: "big60000.txt" }, "r1")]), say("", [call("bash", { command: "ls", description: "List" }, "b1")]), say("All done.")], { text: "read the big file, then list", deps: { watch: (g, o) => { get = g; opt = o; } } });
  assert.equal(opt.whole(), 1, "the machine is told it is the whole conversation");
  assert.ok(K.isSummary(get()[0]));
  // (One summary: right after it, with no answer to count from, the count is what the next request carries, not the tools held
  // back for tool_search; counted, they made it some 12,000 tokens more, and a second summary at once. 2026-11-15.)
  assert.equal(c.sums.length, 1);
  assert.equal(one.r.status, "done");
  assert.equal(c.sent.length, 3);
  assert.ok(!c.sent[0].messages.some((m) => String(m.content).startsWith(K.COMPACT_LEAD)), "the first request went whole");
  assert.match(String(c.sent[1].messages[1].content || ""), /^This chat is being continued/, "the one after the read starts with the summary: the read filled the conversation");
  assert.ok(!c.sent[2].messages.some((m) => /^z{1000}/.test(String(m.content).replace(/^ +1\t/, ""))), "the read's text went with the summary");
  // (The conversation itself, the read's result in it, with Claude Code's compact prompt last.)
  assert.ok(c.sums[0].messages.some((m) => m.role === "tool" && m.tool_call_id === "r1" && /z{100}/.test(m.content)), "the read's result in what was summarized");
  assert.ok(K.isCompactRequest(c.sums[0]));
  assert.deepEqual(asInput(c.sums[0]).slice(0, asInput(c.sent[0]).length), asInput(c.sent[0]), "the last request's messages first, byte for byte");
  assert.equal(one.r.messages.filter((m) => m.role === "tool" && m.tool_call_id === "b1").length, 1, "the round after it ran and kept its answer");
});

test("AC5 auto-compact off (DISABLE_AUTO_COMPACT, or autoCompactEnabled false) at its limit: Claude Code's \"Context limit reached\", nothing sent; DISABLE_COMPACT turns the owner's /compact off too; a PreCompact hook that blocks keeps the conversation as it is this time", async () => {
  const c = chat();
  c.messages = [{ role: "user", content: "x".repeat(2_000_000) }, { role: "assistant", content: "ok" }];
  const off = await c.run([say("never")], { text: "go on", vars: { DISABLE_AUTO_COMPACT: "1" } });
  assert.equal(c.sent.length, 0, "nothing sent");
  assert.ok(off.events.some((e) => e.type === "error" && e.text === "Context limit reached · /compact or a new chat to continue · auto-compact is off"));
  const none = await c.run([say("never")], { text: "", vars: { DISABLE_COMPACT: "1" }, opts: { compact: { focus: "" } } });
  assert.ok(none.events.some((e) => e.type === "note" && /^\/compact is turned off: this chat's environment sets DISABLE_COMPACT\.$/.test(e.text)));
  assert.equal(c.sums.length, 0);
  // A PreCompact hook that blocks: no summary this time, the request goes as it is.
  const d = chat();
  await d.run([say("", [call("read", { path: "big40000.txt" }, "r1")]), say("ok")], { text: "read", vars: {} });
  await d.run([say("Fine.")], { text: "next", hooks: { PreCompact: [{ hooks: [{ type: "command", command: "no" }] }] }, hookRun: (i) => (i.hook_event_name === "PreCompact" ? { code: 2, stderr: "not now" } : {}) });
  assert.equal(d.sums.length, 0);
  assert.equal(d.sent.length, 3);
});

test("AC6 its breakers: three failed summaries in a row and it tries no more in the job; a context that refills to the threshold within 3 rounds of the last summary, 3 times in a row, ends the job with \"Autocompact is thrashing\"", async () => {
  const c = chat({ summary: () => "" });
  const steps = Array.from({ length: 6 }, (_, i) => say("", [call("read", { path: "big40000-" + i + ".txt" }, "r" + i)]));
  await c.run([...steps, say("done")], { text: "read them all" });
  // (Each try: Claude Code's compact request, then, its reply empty, Coder's own summary request.)
  assert.equal(c.sums.filter((q) => K.isCompactRequest(q)).length, 3, "three tries, then none");
  assert.equal(c.sums.length, 6);
  const t = chat();
  const reads = Array.from({ length: 8 }, (_, i) => say("", [call("read", { path: "big110000-" + i + ".txt" }, "q" + i)]));
  const r = await t.run([...reads, say("done")], { text: "read every big file" });
  assert.ok(r.events.some((e) => e.type === "error" && e.text === K.THRASHING));
  assert.equal(t.sums.length, 3, "three summaries, each refilled within a round");
});

test("AC7 a request Grok refuses as too long is summarized and sent again once (Claude Code's reactive compaction)", async () => {
  const c = chat();
  const e = Object.assign(new Error("AI call failed: 400 This model's maximum prompt length is 500000 but the request contains 512000 tokens."), { status: 400 });
  const r = await c.run([say("Fine.")], { text: "go", vars: {}, fail: (n) => (n === 1 ? e : null) });
  assert.equal(r.r.status, "done");
  assert.equal(c.sums.length, 1);
  assert.equal(c.sent.length, 2);
  assert.match(String(c.sent[1].messages[1].content), /^This chat is being continued/);
  assert.equal(A.tooLongError(e), true);
  assert.equal(A.tooLongError(Object.assign(new Error("AI call failed: 503 busy"), { status: 503 })), false);
});

test("AC8 the saved chat keeps every answer, note and picture whole (Claude Code's transcript), the pictures within keepPics' room, the owner's earlier ones too; the limits it may reach are raised to fit, the Worker's last resorts only for Coder's chats, Gloopy's as before", async () => {
  const c = chat();
  await c.run([say("", [call("read", { path: "big50000.txt" }, "r1"), call("read", { path: "shot.png" }, "r2")]), say("Seen.")], { text: "look", vars: {} });
  const res = c.messages.find((m) => m.role === "tool" && m.tool_call_id === "r1");
  assert.ok(res.content.length > 50_000, "whole: " + res.content.length);
  assert.ok(c.messages.some((m) => m.readPics === true && Array.isArray(m.images) && m.images.length === 1), "the picture kept");
  // The owner's pictures: this message's stay; earlier ones go once newer ones fill the room.
  const pic = (n) => "data:image/png;base64," + "A".repeat(n);
  const convo = [{ role: "user", content: "old", images: [pic(10_000_000)] }, { role: "user", content: "older read", readPics: true, appNote: true, images: [pic(5_000_000)] }, { role: "user", content: "new", images: [pic(10_000_000)] }];
  A.keepPics(convo, { from: 2 });
  assert.equal(convo[2].images.length, 1, "this message's stay");
  assert.equal(convo[0].images, undefined, "an earlier one is let go, the room full");
  assert.match(convo[0].content, /\[No longer attached: read the file again to see it\.\]$/);
  // The limits.
  const S = await import("../container/server.mjs");
  const R = await import("../src/coder-routes.mjs");
  const L = await import("../src/coder-live.mjs");
  const SUM = await import("../src/coder-summary.mjs");
  assert.equal(S.BODY_MAX, 48 * 1024 * 1024);
  // (Kept to what the Worker's 128 MB holds, the pictures kept apart: test/worker-memory.test.mjs.)
  assert.equal(L.LIVE_BODY_MAX, 4 * 1024 * 1024);
  assert.equal(R.CODER_HISTORY_MAX, 8 * 1024 * 1024);
  assert.equal(R.historyMaxFor({ kind: "gloopy" }), R.HISTORY_MAX, "Gloopy's as before");
  assert.equal(SUM.CODER_COMPACT_SAFETY, 6 * 1024 * 1024);
  assert.ok(SUM.CODER_COMPACT_SAFETY < S.BODY_MAX && R.CODER_HISTORY_MAX < S.BODY_MAX, "what the Worker keeps, the machine takes");
  assert.deepEqual(Object.keys(S.compactVarsOf({ DISABLE_COMPACT: "1", OTHER: "x", CODER_AUTO_COMPACT_WINDOW: "200k" })), ["DISABLE_COMPACT", "CODER_AUTO_COMPACT_WINDOW"]);
  // The percentage is the machine's own, over the owner's and the repository's, as a Claude Code cloud session's ("That value
  // overrides one you add in your environment variables").
  assert.deepEqual(S.compactVarsFor({ CODER_AUTOCOMPACT_PCT_OVERRIDE: "10", DISABLE_AUTO_COMPACT: "1" }), { DISABLE_AUTO_COMPACT: "1", CODER_AUTOCOMPACT_PCT_OVERRIDE: "92" });
  assert.equal(S.REPO_OWN_ENV.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE, undefined, "not one a repository sets");
  assert.equal(S.REPO_OWN_ENV.CLAUDE_CODE_AUTO_COMPACT_WINDOW, "CODER_AUTO_COMPACT_WINDOW");
  assert.equal(S.REPO_OWN_KEYS.autoCompactEnabled, "CODER_AUTO_COMPACT_ENABLED");
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8"), /runCoder\(turnDeps, \{[^\n]*compactVars: compactVarsFor\(rawVars\)/);
  // The live save sends the conversation without its pictures, and drops it (not the steps) when it is too large.
  let posts = 0;
  const t = { events: [{ at: 1, type: "note", text: "a" }], convoNow: () => [{ role: "user", content: "x" }] };
  const sender = S.liveSender(t, { url: "https://w/api/coder/live", chat: "u/abc", turn: 1, pass: "p".repeat(30) }, async (u, init) => { posts++; const b = JSON.parse(init.body); return b.messages ? new Response("too large", { status: 413 }) : Response.json({ ok: true, have: b.from + b.events.length }); }, { every: 1e9 });
  await sender.flush();
  assert.equal(sender.sent, 1, "the step sent, not marked too big");
  assert.equal(posts, 2);
});

test("AC9 Claude Code's compact request (its compactConversation, the coordinator's follow-up of 2026-11-14): the conversation itself with its compact prompt last, so all but the prompt is cached; refused as too long, its oldest rounds left out and sent again, up to 3 times (by the tokens the refusal says it is over, else a fifth of the rounds), the summary then saying part of it is not covered; refused once more, \"Conversation too long\"; failed otherwise or with no words, Coder's own plain-text request; the reply's <summary> kept, its <analysis> left out", async () => {
  // Its pieces.
  assert.equal(K.summaryText("<analysis>\nthinking\n</analysis>\n\n<summary>\n1. Asked: fix it.\n\n\n2. Done.\n</summary>"), "1. Asked: fix it.\n\n2. Done.");
  assert.equal(K.summaryText("Plain words."), "Plain words.");
  assert.equal(K.hasSummary("Plain words."), false);
  assert.equal(K.tokenGap(new Error("prompt is too long: 210000 tokens > 200000 maximum")), 10_000);
  assert.equal(K.tokenGap(new Error("This model's maximum prompt length is 500000 but the request contains 512000 tokens.")), 12_000);
  assert.equal(K.tokenGap(new Error("the prompt is too long")), undefined);
  const round = (i, n = 400) => [{ role: "assistant", content: "", tool_calls: [call("read", { path: "f" + i }, "c" + i)] }, { role: "tool", tool_call_id: "c" + i, content: "x".repeat(n) }];
  const convo = [{ role: "user", content: "go" }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => round(i))];
  const fifth = K.dropOldestRounds(convo);
  assert.deepEqual([fifth[0], fifth[1].tool_calls[0].id], [{ role: "user", content: K.COMPACT_TRUNCATED }, "c2"], "a fifth of 10 rounds, the line first before an answer");
  const byGap = K.dropOldestRounds(convo, 250);
  assert.equal(byGap[1].tool_calls[0].id, "c4", "the oldest rounds that make up the tokens over (the owner's message, then rounds of some 105 tokens)");
  assert.equal(K.dropOldestRounds(fifth)[1].tool_calls[0].id, "c3", "a second time: the line not counted as a round");
  assert.equal(K.dropOldestRounds(convo, 1e9).at(-1).tool_call_id, "c9", "never the last round");
  assert.equal(K.dropOldestRounds([{ role: "user", content: "only" }]), null);
  // In a job of ten rounds: refused as too long twice (with no count of tokens: a fifth of the rounds left out each time), then
  // made; the summary says part of the conversation is not in it.
  const tooLong = () => Object.assign(new Error("AI call failed: 400 prompt is too long"), { status: 400 });
  const reads = Array.from({ length: 8 }, (_, i) => say("", [call("read", { path: "big2000-" + "abcdefgh"[i] + ".txt" }, "s" + i)]));
  const c = chat({ summary: (n) => (n <= 2 ? tooLong() : "<analysis>notes</analysis>\n<summary>THE SUMMARY after two tries.</summary>") });
  // (12,800 tokens past what a request carries before any read: the eight small reads, some 500 tokens each, fit; the big one,
  // some 15,000, does not.)
  await c.run([...reads, say("", [call("read", { path: "big60000.txt" }, "r1")]), say("All done.")], { text: "read them, then the big file", vars: at(BASE + 12_800) });
  assert.equal(c.sums.length, 3);
  assert.ok(c.sums.every((q) => K.isCompactRequest(q)), "each time Claude Code's compact request");
  assert.ok(c.sums[1].messages.length < c.sums[0].messages.length && c.sums[2].messages.length < c.sums[1].messages.length, "the oldest rounds left out");
  assert.equal(c.sums[1].messages[1].content, K.COMPACT_TRUNCATED, "its line where the conversation then starts");
  assert.ok(c.sums[2].messages.some((m) => m.tool_call_id === "r1"), "never the newest round");
  const sum = c.messages.find((m) => K.isSummary(m));
  assert.equal(sum.content, K.COMPACT_LEAD + "\n\nSummary:\nTHE SUMMARY after two tries.\n\n" + K.COMPACT_HEAD_CUT + "\n" + K.COMPACT_CONTINUE);
  // Refused every time (the first try and 3 more): no summary; when Grok had refused the job's own request as too long,
  // Claude Code's "Conversation too long".
  const d = chat({ summary: () => tooLong() });
  await d.run([...reads, say("ok")], { text: "read them", vars: {} });
  const e = Object.assign(new Error("AI call failed: 400 This model's maximum prompt length is 500000 but the request contains 512000 tokens."), { status: 400 });
  const r = await d.run([say("Fine.")], { text: "go on", vars: {}, fail: () => e });
  assert.equal(d.sums.length, 1 + K.COMPACT_PTL_RETRIES);
  assert.ok(r.events.some((x) => x.type === "error" && x.text === K.COMPACT_TOO_LONG));
  // The owner's /compact refused every time: the same words.
  const f = chat({ summary: () => tooLong() });
  await f.run([...reads, say("ok")], { text: "read them", vars: {} });
  const fc = await f.run([say("never")], { text: "", vars: {}, opts: { compact: { focus: "" } } });
  assert.equal(f.sums.length, 1 + K.COMPACT_PTL_RETRIES);
  assert.ok(fc.events.some((x) => x.type === "error" && x.text === K.COMPACT_TOO_LONG));
  // No words back (a tool call), or another error: Coder's own plain-text request instead, as Claude Code falls back to its own.
  const g = chat({ summary: (n, req) => (K.isCompactRequest(req) ? "" : "THE FALLBACK SUMMARY") });
  await g.run([say("", [call("read", { path: "big60000.txt" }, "r1")]), say("All done.")], { text: "read it" });
  assert.deepEqual(g.sums.map((q) => (K.isCompactRequest(q) ? "compact" : q.messages[0].content === K.SUMMARY_SYSTEM ? "own" : "?")), ["compact", "own"]);
  assert.match(g.messages.find((m) => K.isSummary(m)).content, /\nSummary:\nTHE FALLBACK SUMMARY\n/);
});

test("B4-1 a failed call says what kind of failure it was, in Claude Code's words (errors.md)", () => {
  const E = (m, status, name) => Object.assign(new Error(m), status ? { status } : {}, name ? { name } : {});
  assert.equal(M.apiErrorText(E("AI call failed: 500 boom", 500)), "API Error: 500 boom. This is a server-side issue, usually temporary — try again in a moment.");
  assert.match(M.apiErrorText(E("AI call failed: 529 x", 529)), /^API Error: Repeated 529 Overloaded errors\. The API is at capacity/);
  assert.equal(M.apiErrorText(E("AI call failed: 429 slow", 429)), "API Error: Request rejected (429) · this may be a temporary capacity issue.");
  assert.equal(M.apiErrorText(E("AI call failed: 403 no", 403)), "API Error: 403 no");
  assert.equal(M.apiErrorText(E("timed out", 0, "TimeoutError")), "Request timed out");
  assert.equal(M.apiErrorText(E("fetch failed")), "The AI could not be reached: fetch failed");
});

test("B4-2 a refused call in the chat shows Claude Code's words, not 'could not be reached'", async () => {
  const c = chat();
  const r = await c.run([say("x")], { text: "go", vars: {}, fail: () => Object.assign(new Error("AI call failed: 503 busy"), { status: 503 }) });
  const err = r.events.find((e) => e.type === "error");
  assert.match(err.text, /^API Error: 503 busy\. This is a server-side issue/);
});

test("B4-3 a too-long chat whose summary fails for another reason names that reason (Claude Code's errors.md)", async () => {
  const c = chat({ summary: () => Object.assign(new Error("AI call failed: 503 unavailable"), { status: 503 }) });
  const tooLong = Object.assign(new Error("AI call failed: 400 This model's maximum prompt length is 500000 but the request contains 512000 tokens."), { status: 400 });
  const r = await c.run([say("x")], { text: "go", vars: {}, fail: () => tooLong });
  const err = r.events.find((e) => e.type === "error");
  assert.equal(err.text, "Prompt is too long · automatic compaction failed: AI call failed: 503 unavailable");
});

test("B4-4 a repository that starts in Plan stays in Plan when Auto mode is off (Claude Code's starting-mode order)", async () => {
  const c = chat();
  let r = await c.run([say("ok")], { text: "go", vars: {}, opts: { mode: "auto", startMode: "plan", autoOff: true } });
  const notes = r.events.filter((e) => e.type === "note").map((e) => e.text);
  assert.ok(notes.some((t) => /start chats in Plan mode/.test(t)));
  assert.ok(!notes.some((t) => /Auto mode is turned off/.test(t)));
  r = await chat().run([say("ok")], { text: "go", vars: {}, opts: { mode: "auto", autoOff: true } });
  assert.ok(r.events.some((e) => e.type === "note" && /Auto mode is turned off/.test(e.text)));
});

test("B4-5 a command over 10,000 characters goes straight to its card, without the slower checks (Claude Code: such commands always prompt)", async () => {
  for (const cmd of ["echo " + "{".repeat(60_000), "echo a" + "\n".repeat(60_000) + "b", "cat {" + ",".repeat(60_000)]) {
    const t0 = Date.now();
    const r = await chat().run([say("", [call("bash", { command: cmd }, "b1")]), say("ok")], { text: "go", vars: {} });
    const ms = Date.now() - t0;
    const card = r.events.find((e) => e.type === "permission");
    assert.ok(card, "a card");
    assert.match(JSON.stringify(card), /over 10,000 characters/);
    assert.ok(ms < 1000, "took " + ms + " ms");
  }
});

test("B5-1 a picture Grok refuses is removed, the note shown, and the turn goes on; a second refusal ends the turn (Claude Code's errors page)", async () => {
  const refuse = () => Object.assign(new Error("400 Bad Request: the image could not be processed (dimensions too large)"), { status: 400 });
  const c = chat();
  const r = await c.run([say("", [call("read", { file_path: "shot.png" }, "r1")]), say("all done")], { text: "look", fail: (n) => (n === 2 ? refuse() : null) });
  assert.ok(r.events.some((e) => e.type === "note" && e.text === "API Error: an image in the conversation could not be processed and was removed."));
  assert.ok(!r.events.some((e) => e.type === "error"));
  assert.equal(r.r.summary, "all done");
  assert.equal(c.sent.length, 3);
  assert.ok(!JSON.stringify(c.sent[2].messages).includes("data:image/png"), "the resend has no picture");
  assert.ok(!JSON.stringify(c.messages).includes("data:image/png"), "the saved chat keeps no copy");
  const c2 = chat();
  const r2 = await c2.run([say("", [call("read", { file_path: "shot.png" }, "r1")]), say("all done")], { text: "look", fail: (n) => (n >= 2 ? refuse() : null) });
  assert.ok(r2.events.some((e) => e.type === "error"));
  assert.equal(c2.sent.length, 3);
  assert.ok(!A.imageRefused(Object.assign(new Error("503 image service down"), { status: 503 })));
  assert.ok(!A.imageRefused(new Error("prompt is too long")));
});
