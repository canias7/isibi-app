// FIXES FROM THE LIVE TEST OF 2026-11-21 (docs/live-tests/2026-11-21-audit-fixes.md; the owner: "fix the bugs"):
//   A  /rewind listed nothing: the marks pointed at the `startup`/`skills` step put just before the owner's message.
//   B  No Co-authored-by line on a commit pushed mid-job (push_branch): the job's /turn carried no co-author.
//   C  A mode picked before a new chat's first message went back to Auto: the message now carries the mode.
//   D  The box kept an unknown /command after it was sent, so Enter sent it again.
//   E  The memory folder was named after the chat; it is now named after the repository, as its storage is.
//   F  The plan file stays outside the repository (checked: root's own folder beside the memory).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const UID = "user-1234567890abcdef", ID = "shop-lf21a";
async function chat({ machine = async () => Response.json({ ok: true }), fetchFn = async () => new Response("{}", { status: 404 }) } = {}) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const calls = [];
  const deps = { fetchFn, authUser: async () => ({ id: UID, email: "me@x.y" }), summarize: async () => "S",
    container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; const body = req.method === "POST" ? await req.json() : null; calls.push({ p, body }); return machine(p, body); } }) };
  const go = (p, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + p, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const send = async (p, b) => { const r = await go("projects/" + ID + "/" + p, { method: "POST", body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };
  const k = (f) => "coder/" + UID + "/" + ID + "/" + f;
  const read = (f) => JSON.parse(bucket.m.get(k(f)));
  const put = (f, v) => bucket.put(k(f), JSON.stringify(v));
  const meta = (x = {}) => put("meta.json", { id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 0, saved: 0, status: "idle", at: Date.now(), title: "x", ...x });
  return { R, bucket, env, go, send, read, put, meta, calls };
}
const page = () => readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");

// ── A ─────────────────────────────────────────────────────────────────────────
test("LF-A1 a mark taken where the machine then put a startup or skills step moves onto the owner's message", async () => {
  const R = await import("../src/coder-routes.mjs");
  const evs = [{ type: "startup" }, { type: "user", text: "one" }, { type: "done" }, { type: "skills", list: [] }, { type: "startup" }, { type: "user", text: "two" }, { type: "done" }];
  assert.deepEqual(R.marksOnUser([{ turn: 1, ev: 0, msg: 0 }, { turn: 2, ev: 3, msg: 2 }], evs), [{ turn: 1, ev: 1, msg: 0 }, { turn: 2, ev: 5, msg: 2 }]);
  assert.deepEqual(R.marksOnUser([{ turn: 1, ev: 1, msg: 0 }], evs), [{ turn: 1, ev: 1, msg: 0 }], "one on its message stays");
  assert.deepEqual(R.marksOnUser([{ turn: 1, ev: 2, msg: 0 }], evs), [{ turn: 1, ev: 2, msg: 0 }], "never past another kind of step");
});

test("LF-A2 the end of a job saves the mark on the owner's message, not on the startup and skills steps before it", async () => {
  let claimed = false;
  const msgs = [{ role: "user", content: "ask 1" }, { role: "assistant", content: "answer 1" }];
  const end = { running: false, events: [{ type: "startup", got: 1, ms: 5, steps: [] }, { type: "skills", list: [{ name: "hello", description: "x" }] }, { type: "user", text: "ask 1" }, { type: "done", text: "answer 1" }], next: 4, result: { status: "done", summary: "answer 1", messages: msgs, readQueued: [] } };
  const c = await chat({ machine: async (p) => {
    if (p === "/state") return Response.json(claimed ? { running: false, events: [] } : end);
    if (p === "/claim") { claimed = true; return Response.json({ ok: true, ...end }); }
    return Response.json({ ok: true, pushed: false });
  } });
  await c.meta({ status: "running", turn: 1, saved: 0, marks: [{ turn: 1, ev: 0, msg: 0 }] });
  await c.put("messages.json", []);
  await c.put("events.json", []);
  await (await c.go("projects/" + ID + "/state?since=0")).json();
  const evs = c.read("events.json"), marks = c.read("meta.json").marks;
  assert.equal(marks.length, 1);
  assert.equal(evs[marks[0].ev].type, "user");
  assert.equal(evs[marks[0].ev].text, "ask 1");
});

test("LF-A3 the page's Rewind list takes a chat saved before the fix: a mark on a startup or skills step finds the message after it", () => {
  const src = page();
  const body = src.slice(src.indexOf("function marksOff() {"), src.indexOf("function codeToRestore("));
  const fns = new Function("S", body + "; return { marksOff, markEv };");
  const S = { events: [{ type: "startup" }, { type: "user", text: "a" }, { type: "done" }, { type: "skills" }, { type: "user", text: "b" }, { type: "done" }, { type: "github" }], project: { marks: [{ turn: 1, ev: 0 }, { turn: 2, ev: 3 }] } };
  const f = fns(S);
  assert.equal(f.markEv(S.project.marks[0]), 1);
  assert.equal(f.markEv(S.project.marks[1]), 4);
  assert.equal(f.markEv({ ev: 6 }), -1, "a github step is not passed over");
  assert.equal(f.marksOff(), false);
  // rewindPicker lists by markEv, and the message's own Rewind button and the Undo look marks up by it too.
  const picker = src.slice(src.indexOf("async function rewindPicker() {"), src.indexOf("async function rewind(turn"));
  assert.match(picker, /filter\(\(m\) => markEv\(m\) >= 0\)\.map\(\(m\) => \(\{ \.\.\.m, ev: markEv\(m\) \}\)\)/);
  assert.match(src, /S\.project\.marks\.find\(\(m\) => markEv\(m\) === i\)/);
  assert.match(src, /S\.project\.marks\.find\(\(m\) => markEv\(m\) === u && !m\.noCode\)/);
});

// ── B ─────────────────────────────────────────────────────────────────────────
test("LF-B1 the job itself gets the owner as co-author, so a push in the middle of the job (push_branch) carries the line too", async () => {
  const turns = [];
  const c = await chat({
    fetchFn: async (u) => (String(u).endsWith("/user") ? Response.json({ id: 583231, login: "ana", name: "Ana Diaz" }) : new Response("{}", { status: 404 })),
    machine: async (p, b) => { if (p === "/turn") { turns.push(b); return Response.json({ ok: true }); } return Response.json({ ok: true }); },
  });
  await c.meta();
  await c.put("messages.json", []);
  await c.put("events.json", []);
  const r = await c.send("message", { text: "add a footer", mid: "m1lf21b" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(turns.length, 1);
  assert.equal(turns[0].coAuthor, "Ana Diaz <583231+ana@users.noreply.github.com>");
  // The machine's mid-job push hands the job's body to commitMarks, which writes the line.
  const S = await import("../container/server.mjs");
  assert.deepEqual(S.commitMarks("https://gofarther.dev/?chat=x", null, turns[0].coAuthor).trailer, ["Coder-Chat: https://gofarther.dev/?chat=x", "Co-authored-by: Ana Diaz <583231+ana@users.noreply.github.com>"]);
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server.slice(server.indexOf("export async function pushMidTurn("), server.indexOf("export async function pushMidTurn(") + 1500), /commitMarks\(body\.chatUrl, attribution, body\.coAuthor\)/);
});

// ── C ─────────────────────────────────────────────────────────────────────────
test("LF-C1 the page's message carries the mode it shows; the Worker starts the job in it and keeps it", async () => {
  const src = page();
  const sendBody = src.slice(src.indexOf("const r = await call('/projects/' + encodeURIComponent(S.project.id) + '/message'"));
  assert.match(sendBody.slice(0, 600), /\.\.\.\(GLOOPY \? \{\} : \{ mode: chatMode\(\) \}\)/);
  const turns = [];
  const c = await chat({ machine: async (p, b) => { if (p === "/turn") { turns.push(b); return Response.json({ ok: true }); } return Response.json({ ok: true }); } });
  await c.meta({ mode: "auto" });
  await c.put("messages.json", []);
  await c.put("events.json", []);
  const r = await c.send("message", { text: "run ls", mode: "acceptEdits", mid: "m1lf21c" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(turns[0].mode, "acceptEdits");
  assert.equal(c.read("meta.json").mode, "acceptEdits");
  assert.equal(r.data.project.mode, "acceptEdits", "the chip stays");
});

// ── D ─────────────────────────────────────────────────────────────────────────
test("LF-D1 sending empties the box on the page as well as the draft, before the message goes out", () => {
  const src = page();
  const fn = src.slice(src.indexOf("function boxEmpty() {"), src.indexOf("\n", src.indexOf("function boxEmpty() {")));
  const box = { value: "/nosuchcommand" };
  const S = { draft: "/nosuchcommand" };
  new Function("S", "document", fn + "; boxEmpty();")(S, { getElementById: (id) => (id === "cdIn" ? box : null) });
  assert.equal(S.draft, "");
  assert.equal(box.value, "");
  const send = src.slice(src.indexOf("async function send(text, opts) {"), src.indexOf("function startPoll()"));
  const a = send.indexOf("S.sending = true; S.error = ''; boxEmpty();"), b = send.indexOf("const r = await call('/projects/'");
  assert.ok(a > 0 && b > a, "emptied before the call");
  assert.match(send, /q\.data\.queued\) \{ S\.queue = q\.data\.queue \|\| \[\]; boxEmpty\(\);/);
});

// ── E ─────────────────────────────────────────────────────────────────────────
test("LF-E1 one memory folder per repository, named as the Worker's storage key is; memory saved before still loads", async () => {
  const M = await import("../container/memory-files.mjs");
  const R = await import("../src/coder-routes.mjs");
  assert.equal(M.memorySlug("canias7/testingforclaude"), "canias7__testingforclaude");
  assert.equal(M.memoryFolderName("canias7/testingforclaude"), "canias7__testingforclaude.memory");
  assert.equal(M.memoryFolderName(""), "");
  assert.equal(M.memoryFolderName(".."), "", "never a folder of dots");
  assert.equal(R.memoryKey("u1", "canias7/testingforclaude"), "coder/u1/memory/canias7__testingforclaude.md", "the key saved memory was kept under");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const memDir = join\(memRoot, \(!gloopy && memoryFolderName\(body\.repo\)\) \|\| project\);/);
});

// ── F ─────────────────────────────────────────────────────────────────────────
test("LF-F1 the chat's plan file is kept outside the repository's folder (root's own folder beside the memory), so it is never committed, and is found again after a restart", async () => {
  const S = await import("../container/server.mjs");
  const PF = await import("../container/coder-plan-file.mjs");
  const data = await mkdtemp(join(tmpdir(), "coder-data-"));
  const d = S.dataDirs(data, { setupRoot: join(data, "setup"), owner: null });
  assert.ok(!d.memRoot.startsWith(d.root + "/"), "the plans folder's root is not under the work folder");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const planDir = join\(memRoot, project \+ "\.plans"\);/);
  const planDir = join(d.memRoot, ID + ".plans"), state = join(d.memRoot, ID + ".plan.json");
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(planDir, { recursive: true });
  const a = PF.planStore({ dir: planDir, stateFile: state, rand: () => 0 });
  const f = await a.name("Add a footer");
  assert.ok(f.startsWith(planDir + "/") && !f.startsWith(join(d.root, ID)));
  await writeFile(f, "# Plan\n");
  const b = PF.planStore({ dir: planDir, stateFile: state, rand: () => 0.5 });
  assert.equal(b.current(), f, "the same file after the machine starts again");
  assert.equal(await b.read(), "# Plan\n");
});
