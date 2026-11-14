// LONG CHATS ARE SUMMARIZED, NOT CUT; REWIND CAN SUMMARIZE (owner, 2026-11-07, items 3 and 9; like
// Claude Code's auto-compact, /compact with a focus, and Rewind's "Summarize from here" / "Summarize up
// to here", where the chat keeps the original messages).
import { test } from "node:test";
import assert from "node:assert/strict";

const K = await import("../container/coder-compact.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const round = (i, out = "ok") => [{ role: "assistant", content: "", tool_calls: [call("bash", { command: "step " + i }, "c" + i)] }, { role: "tool", tool_call_id: "c" + i, content: out }];

test("CD165 the summary's pieces: a plain-text copy (tools cut short), Coder's model asked with no tools and an optional focus; a job is cut only between rounds (never a tool's answer from its call), keeping its newest rounds; older jobs are cut at an owner's message, keeping the newest three; Rewind's marks move with it", async () => {
  const msgs = [{ role: "user", content: "Fix the total" }, ...round(1, "x".repeat(5000)), { role: "assistant", content: "Fixed it in src/cart.js." }];
  const t = K.transcriptText(msgs);
  assert.match(t, /^OWNER: Fix the total\n\nCODER USED bash: \{"command":"step 1"\}\n\nRESULT: x+\n\[…\]\nx+\n\nCODER: Fixed it in src\/cart\.js\.$/);
  assert.ok(t.length < 2000, "a tool's answer is cut short");
  const big = Array.from({ length: 400 }, (_, i) => ({ role: "user", content: "message " + i + " " + "y".repeat(1000) }));
  assert.ok(K.transcriptText(big).length <= K.TRANSCRIPT_MAX + 60 && K.transcriptText(big).startsWith("[… the oldest part is left out …]"), "the newest part when it is too long");
  const req = K.summaryRequest(msgs, " keep the test output ");
  assert.deepEqual(req.tools, []);
  assert.equal(req.messages[0].content, K.SUMMARY_SYSTEM);
  assert.match(req.messages[1].content, /^THE PART OF THE CONVERSATION TO SUMMARIZE:\n\nOWNER: Fix the total[\s\S]*Write the summary now\. The owner asks it to focus on: keep the test output$/);
  assert.match(K.SUMMARY_SYSTEM, /Never include passwords, tokens or keys/);
  const s = K.summaryMessage("The total now subtracts the discount first.", "the earlier jobs");
  assert.equal(s.role, "user");
  assert.equal(s.content, "(Coder's app: a summary of an earlier part of this conversation: the earlier jobs. The chat on the owner's page still shows all of it.)\nThe total now subtracts the discount first.");
  assert.equal(K.isSummary(s), true);
  assert.equal(K.isSummary({ role: "user", content: "hi" }), false);
  // A JOB: cut before an assistant message, the newest 8 rounds kept; nothing to cut: -1.
  const job = [{ role: "user", content: "old" }, { role: "user", content: "go" }, ...Array.from({ length: 12 }, (_, i) => round(i)).flat()];
  const at = K.cutPoint(job, 2, 8);
  assert.equal(job[at].role, "assistant");
  assert.equal(job.slice(at).filter((m) => m.role === "assistant").length, 8);
  assert.equal(K.cutPoint(job.slice(0, 2 + 2 * 9), 2, 8), -1);
  // OLDER JOBS: cut at an owner's message; the newest 3 kept; a summary is not counted as one.
  const hist = [K.summaryMessage("old", "x"), ...Array.from({ length: 5 }, (_, i) => [{ role: "user", content: "ask " + i }, { role: "assistant", content: "done " + i }]).flat()];
  const c = K.turnCut(hist, 3);
  assert.equal(hist[c].content, "ask 2");
  assert.equal(K.turnCut(hist.slice(0, 7), 3), -1);
  // REWIND'S MARKS: inside the summarized part, gone; after it, moved up; the note pushes later ones down.
  const { marksAfter } = await import("../src/coder-summary.mjs");
  const marks = [{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 5, msg: 4 }, { turn: 3, ev: 9, msg: 8 }];
  assert.deepEqual(marksAfter(marks, { from: 0, to: 8 }), [{ turn: 3, ev: 9, msg: 1 }]);
  assert.deepEqual(marksAfter(marks, { from: 4, to: 10, evAt: 5 }), [{ turn: 1, ev: 0, msg: 0 }]);
  assert.deepEqual(marksAfter(marks, { from: 0, to: 4, evAt: 5 }), [{ turn: 2, ev: 6, msg: 1 }, { turn: 3, ev: 10, msg: 5 }]);
});

test("CD166 a long job summarizes its own older steps (like Claude Code's auto-compact), never the chat's saved history before it: Coder's model writes it with no tools, the newest rounds stay whole, the chat is told; at most three times a job", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const history = [{ role: "user", content: "an older job" }, { role: "assistant", content: "done before" }];
  let n = 0; const asked = [];
  const r = await runCoder({
    compactAt: 6000,
    send: async (q) => {
      if (!q.tools || !q.tools.length) { asked.push(q); return { message: { role: "assistant", content: "SUMMARY " + asked.length }, usage: { in: 1, out: 1 } }; }
      n++;
      return n <= 14 ? { message: { role: "assistant", content: "", tool_calls: [call("bash", { command: "echo " + n }, "b" + n)] } } : { message: { role: "assistant", content: "All done." } };
    },
    exec: async () => ({ code: 0, output: "z".repeat(900) }),
  }, { messages: history, text: "Do the big job" });
  assert.equal(r.status, "done");
  assert.ok(asked.length >= 1 && asked.length <= 3, "summarized, at most three times: " + asked.length);
  assert.deepEqual(asked[0].tools, []);
  assert.doesNotMatch(asked[0].messages[1].content, /an older job|done before/, "only this job's own steps");
  assert.deepEqual(r.messages.slice(0, 3), [...history, { role: "user", content: "Do the big job" }], "the saved history and the owner's message stay as they were");
  assert.ok(K.isSummary(r.messages[3]), "then the summary");
  assert.match(r.messages[3].content, /the earlier steps of this job, summarized to make room\. The chat on the owner's page still shows all of it\.\)\nSUMMARY \d$/);
  // No tool answer left without its call.
  const calls = new Set(r.messages.flatMap((m) => (m.tool_calls || []).map((c) => c.id)));
  for (const m of r.messages.filter((x) => x.role === "tool")) assert.ok(calls.has(m.tool_call_id), m.tool_call_id);
  // compactAt 0: never.
  n = 0; asked.length = 0;
  await runCoder({ compactAt: 0, send: async (q) => { if (!q.tools || !q.tools.length) asked.push(q); n++; return n <= 14 ? { message: { role: "assistant", content: "", tool_calls: [call("bash", { command: "e" }, "x" + n)] } } : { message: { role: "assistant", content: "Done." } }; }, exec: async () => ({ code: 0, output: "z".repeat(900) }) }, { text: "go" });
  assert.equal(asked.length, 0);
});

// ── THE WORKER ──
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef", ID = "shop-cmp1";
async function chat() {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const machine = { calls: [] };
  const sums = [];
  let answer = "THE SUMMARY";
  const deps = {
    fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }),
    container: () => ({ fetch: async (req) => { const u = new URL(req.url); machine.calls.push({ path: u.pathname, body: req.method === "POST" ? await req.json() : null }); return Response.json({ ok: true }); } }),
    summarize: async (m, f) => { sums.push({ m, f }); return answer; },
  };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const k = (f) => "coder/" + UID + "/" + ID + "/" + f;
  const read = (f) => JSON.parse(bucket.m.get(k(f)));
  const set = async (meta, messages, events) => { await bucket.put(k("meta.json"), JSON.stringify({ id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 3, saved: 3, status: "idle", at: Date.now(), ...meta })); await bucket.put(k("messages.json"), JSON.stringify(messages)); await bucket.put(k("events.json"), JSON.stringify(events)); };
  return { go, machine, sums, read, set, setAnswer: (a) => { answer = a; } };
}
const three = () => {
  const msgs = [], evs = [], marks = [];
  for (let t = 1; t <= 3; t++) {
    marks.push({ turn: t, ev: evs.length, msg: msgs.length });
    msgs.push({ role: "user", content: "ask " + t }, { role: "assistant", content: "answer " + t });
    evs.push({ type: "user", text: "ask " + t }, { type: "done", text: "answer " + t });
  }
  return { msgs, evs, marks };
};

test("CD167 on the Worker: a long chat's older jobs are summarized before the next job (not cut); /compact (with a focus) starts a job on the chat's machine that makes the whole conversation a summary there, with its hooks (round 5), and moves Rewind's marks when it ends; Rewind's Summarize up to here / from here; the chat keeps every message, with a note where the summary stands; nothing changes when the summary could not be made", async () => {
  const c = await chat();
  // BEFORE A JOB: past 300 KB, the older jobs (all but the newest three of the owner's messages) become one summary.
  const big = [];
  for (let t = 1; t <= 8; t++) big.push({ role: "user", content: "ask " + t }, { role: "assistant", content: "answer " + t + " " + "w".repeat(50_000) });
  await c.set({ turn: 8, marks: Array.from({ length: 8 }, (_, i) => ({ turn: i + 1, ev: i * 2, msg: i * 2 })) }, big, big.map((m) => ({ type: m.role === "user" ? "user" : "done", text: m.content.slice(0, 20) })));
  assert.equal((await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "ask 9" }) })).status, 200);
  assert.equal(c.sums.length, 1);
  assert.deepEqual(c.sums[0].m.map((m) => m.content.slice(0, 6)), ["ask 1", "answer", "ask 2", "answer", "ask 3", "answer", "ask 4", "answer", "ask 5", "answer"], "the older jobs");
  const sent = c.machine.calls.find((x) => x.path === "/turn").body.messages;
  assert.ok(K.isSummary(sent[0]) && sent[0].content.endsWith("THE SUMMARY"));
  assert.deepEqual(sent.slice(1).map((m) => m.content.slice(0, 6)), ["ask 6", "answer", "ask 7", "answer", "ask 8", "answer"]);
  assert.match(c.read("events.json").slice(-1)[0].text, /^Compacted: the earlier part of this chat is now a summary for Coder, to make room \(like Claude Code's auto-compact\)\. The chat still shows it all\.$/);
  assert.equal(c.read("events.json").length, 17, "every message still in the chat, and the note");
  assert.deepEqual(c.read("meta.json").marks.map((m) => [m.turn, m.msg]), [[6, 1], [7, 3], [8, 5], [9, 7]], "Rewind's points moved with it; the summarized ones are gone");

  // /compact keep the API notes: a job on the chat's machine, which makes the summary there with the owner's hooks (round 5);
  // nothing summarized here, no Rewind mark for it, the owner's words as the job's `compact`, no message of the owner's.
  const { msgs, evs, marks } = three();
  await c.set({ marks }, msgs, evs);
  c.machine.calls.length = 0; c.sums.length = 0;
  const r = await (await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "/compact keep the API notes" }) })).json();
  assert.equal(r.ok, true);
  assert.equal(r.compacted, undefined);
  assert.equal(c.sums.length, 0, "not made here");
  const job = c.machine.calls.find((x) => x.path === "/turn").body;
  assert.deepEqual(job.compact, { focus: "keep the API notes" });
  assert.deepEqual([job.text, job.shown], ["", ""]);
  assert.deepEqual(job.messages, msgs, "the whole conversation, not summarized before");
  assert.equal(c.read("meta.json").status, "running");
  assert.deepEqual(c.read("meta.json").marks, marks, "no mark of its own");
  // Nothing to summarize: refused, no job.
  await c.set({ marks: [] }, [], []);
  c.machine.calls.length = 0;
  const none = await c.go("projects/" + ID + "/message", { method: "POST", body: JSON.stringify({ text: "/compact" }) });
  assert.equal(none.status, 400);
  assert.equal((await none.json()).error, "There is nothing to summarize yet.");
  assert.deepEqual(c.machine.calls, []);

  // REWIND, SUMMARIZE UP TO HERE (message 3): before it, one summary; message 3 on, as it was; files untouched.
  await c.set({ marks }, msgs, evs);
  c.machine.calls.length = 0; c.sums.length = 0;
  let w = await (await c.go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 3, summarize: "upto", focus: "the totals" }) })).json();
  assert.equal(w.summarized, "upto");
  assert.deepEqual(c.sums[0].m.map((m) => m.content), ["ask 1", "answer 1", "ask 2", "answer 2"]);
  assert.equal(c.sums[0].f, "the totals");
  assert.deepEqual(c.read("messages.json").map((m) => K.isSummary(m) ? "SUMMARY" : m.content), ["SUMMARY", "ask 3", "answer 3"]);
  assert.deepEqual(w.events.map((e) => e.type), ["user", "done", "user", "done", "note", "user", "done"], "the note where the summary stands; every message still shown");
  assert.match(w.events[4].text, /^Summarized conversation: everything above this point is now a summary for Coder \(kept in focus: the totals\)\. The chat still shows it all\.$/);
  assert.deepEqual(w.project.marks, [{ turn: 3, ev: 5, msg: 1 }]);
  assert.deepEqual(c.machine.calls, [], "files are never touched");

  // REWIND, SUMMARIZE FROM HERE (message 2): message 2 on becomes a summary; Rewind's later points go.
  await c.set({ marks }, msgs, evs);
  w = await (await c.go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 2, summarize: "from" }) })).json();
  assert.deepEqual(c.read("messages.json").map((m) => K.isSummary(m) ? "SUMMARY" : m.content), ["ask 1", "answer 1", "SUMMARY"]);
  assert.match(c.read("messages.json")[2].content, /one of the owner's messages and everything after it \(Rewind: Summarize from here\)/);
  assert.deepEqual(w.events.map((e) => e.type), ["user", "done", "note", "user", "done", "user", "done"]);
  assert.deepEqual(w.project.marks, [{ turn: 1, ev: 0, msg: 0 }]);
  // Nothing before message 1 to summarize up to.
  assert.equal((await c.go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 1, summarize: "upto" }) })).status, 400);

  // THE SUMMARY COULD NOT BE MADE: an error, and nothing changed.
  await c.set({ marks }, msgs, evs);
  c.setAnswer("");
  assert.equal((await c.go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 2, summarize: "from" }) })).status, 502);
  assert.deepEqual(c.read("messages.json"), msgs);
  assert.deepEqual(c.read("events.json"), evs);
});

test("CD168 the page: Rewind's choices like Claude Code's (the code ones only when a later job changed files; Summarize from here and up to here, with an optional focus); the message comes back to the box; /compact goes as a job, like a message (round 5)", async () => {
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(ui, /const choices = \[\.\.\.\(changed \? \[\['both', 'Restore code and chat'\]\] : \[\]\), \['chat', changed \? 'Restore chat only' : 'Restore chat'\], \.\.\.\(changed \? \[\['code', 'Restore code only'\]\] : \[\]\),\n\s+\['sumfrom', 'Summarize from here'\], \.\.\.\(first \? \[\] : \[\['sumupto', 'Summarize up to here'\]\]\)\];/);
  // (Since 2026-11-13 only a later job that changed a file Coder's file tools changed counts: codeToRestore, rewind-restore.test.mjs.)
  assert.match(ui, /const commits = S\.project\.commits \|\| \[\];\n\s+const changed = codeToRestore\(commits, turn\);/);
  assert.match(ui, /body = \{ turn, summarize: pick === 'sumfrom' \? 'from' : 'upto', focus \};/);
  assert.match(ui, /if \(\(pick === 'both' \|\| pick === 'chat' \|\| pick === 'sumfrom'\) && said && !S\.draft\) S\.draft = said;/);
  // Coder's /compact goes as a job, like a message: Coder's Worker never answers it itself. Only Gloopy's chat does
  // (startGloopy makes the summary in the Worker), and its /pause, /resume and /schedules (2026-11-10) are shown the same way.
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  const gl = routes.slice(routes.indexOf("async function startGloopy("));
  assert.equal((routes.match(/compacted: true/g) || []).length, 1);
  assert.ok(routes.indexOf("async function startGloopy(") > 0 && gl.slice(0, gl.search(/\n(?:async )?function /)).includes("compacted: true"), "only in Gloopy's own message route");
  assert.match(ui, /if \(r\.data\.compacted \|\| r\.data\.handled\) \{ S\.project = r\.data\.project; S\.events = S\.events\.slice\(0, base\)\.concat\(r\.data\.events \|\| \[\]\); if \(r\.data\.handled\) \{ S\.sched = null; S\.schedMsg = ''; S\.signins = null; S\.signinsMsg = ''; \} syncEntry\(\); return draw\(true\); \}/);
});

test("CD214 every summary made between messages names the files its part worked on (read, edited, written, viewed with a command, @-mentioned, or named by an earlier summary), so Coder's next job reads the most recently changed of them again, like Claude Code (\"Right after compaction, Claude Code re-reads up to five of the files Claude has read or edited\"): /compact, a long chat summarized before a job, and Rewind's summaries", async () => {
  const { filesTouched, summaryMessage, REREAD_LIST_MAX } = await import("../container/coder-compact.mjs");
  const { compactHistory } = await import("../src/coder-summary.mjs");
  const tc = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const worked = [
    { role: "user", content: "ask 1" },
    { role: "user", appNote: true, files: ["docs/a.md"], content: "(Note from Coder's app, not the owner: the files the owner @-mentioned…)" },
    { role: "assistant", content: "", tool_calls: [tc("read", { path: "./src/a.js" }, "1"), tc("bash", { command: "cat src/b.js" }, "2"), tc("bash", { command: "cat src/b.js | wc -l" }, "3")] },
    { role: "tool", tool_call_id: "1", content: "…" }, { role: "tool", tool_call_id: "2", content: "…" }, { role: "tool", tool_call_id: "3", content: "…" },
    { role: "assistant", content: "", tool_calls: [tc("edit", { path: "src/c.js", old_string: "a", new_string: "b" }, "4"), tc("write", { path: "src/a.js", content: "x" }, "5"), tc("grep", { pattern: "x" }, "6")] },
    { role: "tool", tool_call_id: "4", content: "…" }, { role: "tool", tool_call_id: "5", content: "…" }, { role: "tool", tool_call_id: "6", content: "…" },
    { role: "assistant", content: "Done." },
  ];
  // The most recent last; a file named again moves to the end; a search or a piped command is not a file it worked on.
  assert.deepEqual(filesTouched(worked), ["docs/a.md", "src/b.js", "src/c.js", "src/a.js"]);
  assert.deepEqual(filesTouched([summaryMessage("S", "x", ["old.js", "src/c.js"]), ...worked.slice(2)]), ["old.js", "src/b.js", "src/c.js", "src/a.js"], "an earlier summary's files carry on");
  assert.equal(REREAD_LIST_MAX, 50);
  assert.equal(filesTouched(Array.from({ length: 60 }, (_, i) => ({ role: "assistant", content: "", tool_calls: [tc("read", { path: "f" + i }, "r" + i)] }))).length, 50);
  // (Every summary owes the chat's plan file to the job that next reads it, Claude Code's plan_file_reference: `planRef`.)
  assert.deepEqual(summaryMessage("S", "x"), { role: "user", content: summaryMessage("S", "x").content, planRef: true }, "no files: no reread");
  assert.deepEqual(summaryMessage("S", "x", ["a.js"]).reread, ["a.js"]);
  // A long chat summarized before a job.
  const big = [];
  for (let t = 1; t <= 5; t++) big.push({ role: "user", content: "ask " + t }, { role: "assistant", content: "", tool_calls: [tc("read", { path: "file" + t + ".js" }, "c" + t)] }, { role: "tool", tool_call_id: "c" + t, content: "w".repeat(80_000) }, { role: "assistant", content: "ok" });
  const sq = await compactHistory(big, async () => "THE SUMMARY");
  assert.ok(sq.to > 0);
  assert.deepEqual(sq.messages[0].reread, ["file1.js", "file2.js"], "the files of the summarized jobs, not of the three kept");
  // Rewind's summaries, on the Worker (the owner's /compact is made on the chat's machine: CD532).
  const c = await chat();
  const msgs = [];
  for (let t = 1; t <= 3; t++) msgs.push({ role: "user", content: "ask " + t }, { role: "assistant", content: "", tool_calls: [tc("read", { path: "f" + t + ".js" }, "c" + t)] }, { role: "tool", tool_call_id: "c" + t, content: "…" }, { role: "assistant", content: "answer " + t });
  const evs = [], marks = [];
  for (let t = 1; t <= 3; t++) { marks.push({ turn: t, ev: evs.length, msg: (t - 1) * 4 }); evs.push({ type: "user", text: "ask " + t }, { type: "done", text: "answer " + t }); }
  await c.set({ marks }, msgs, evs);
  await c.go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 3, summarize: "upto" }) });
  assert.deepEqual(c.read("messages.json")[0].reread, ["f1.js", "f2.js"], "Summarize up to here: the files before message 3");
  await c.set({ marks }, msgs, evs);
  await c.go("projects/" + ID + "/rewind", { method: "POST", body: JSON.stringify({ turn: 2, summarize: "from" }) });
  assert.deepEqual(c.read("messages.json").at(-1).reread, ["f2.js", "f3.js"], "Summarize from here: the files from message 2 on");
});
