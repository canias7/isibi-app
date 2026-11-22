// "GO CLAUDE CODE WAY", BATCH 4 (2026-11-22): a repository set up for Claude Code gives Coder its instructions (CLAUDE.md,
// .claude/CLAUDE.md, CLAUDE.local.md, .claude/rules) when it has no CODER.md (M-f-06); rules at any depth and a subfolder's
// own instructions looked up when a file there is touched, with no fixed caps (M-f-12); Ctrl+Enter really queues for later,
// and Send now on a waiting message (M-d-12); the plan card's Accept edits choice in Claude Code's words (M-b-38).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const S = await import("../container/server.mjs");
const put = async (dir, rel, text) => { await mkdir(dirname(join(dir, rel)), { recursive: true }); await writeFile(join(dir, rel), text); };
const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");

test("M-f-06 a repository with Claude Code's files and no CODER.md: CLAUDE.md, .claude/CLAUDE.md and CLAUDE.local.md load (not AGENTS.md); .claude/rules too; a subfolder's CLAUDE.md later; CODER.md still comes first", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-b4-claude-"));
  await put(dir, "CLAUDE.md", "Claude's rules.");
  await put(dir, ".claude/CLAUDE.md", "More of Claude's rules.");
  await put(dir, "CLAUDE.local.md", "My own notes.");
  await put(dir, "AGENTS.md", "Agents' file.");
  await put(dir, ".claude/rules/testing.md", "Run npm test.");
  await put(dir, ".claude/rules/api.md", "---\npaths: [\"src/api/**\"]\n---\nValidate input.\n");
  await put(dir, "src/CLAUDE.md", "src: use semicolons.");
  let r = await S.repoInstructions(dir);
  assert.deepEqual(r.notes.map((n) => n.name), ["CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md", ".claude/rules/testing.md"], "Claude Code's files, in its order; AGENTS.md not read with a CLAUDE.md, as Claude Code");
  assert.equal(r.found, true);
  assert.deepEqual(r.later.map((x) => x.name), [".claude/rules/api.md", "src/CLAUDE.md"]);
  assert.match(S.laterNotes(r.later, dir, "src/a.js", new Set()), /— src\/CLAUDE\.md:\nsrc: use semicolons\./);
  // Coder's own files come first, as before (the owner's CODER.md), and its own rules folder.
  await put(dir, "CODER.md", "Coder's rules.");
  await put(dir, ".coder/rules/style.md", "Two spaces.");
  r = await S.repoInstructions(dir);
  assert.deepEqual(r.notes.map((n) => n.name), ["CODER.md", ".coder/rules/style.md"], "CODER.md and .coder/rules win; Claude Code's are not read then");
  // Without either: AGENTS.md, also Claude Code's .claude/AGENTS.md.
  const d2 = await mkdtemp(join(tmpdir(), "coder-b4-agents-"));
  await put(d2, "AGENTS.md", "Agents' file.");
  await put(d2, ".claude/AGENTS.md", "Agents' second file.");
  assert.deepEqual((await S.repoInstructions(d2)).notes.map((n) => n.name), ["AGENTS.md", ".claude/AGENTS.md"]);
  // After a summary, the top CLAUDE.md is read again from disk, as CODER.md is.
  const d3 = await mkdtemp(join(tmpdir(), "coder-b4-top-"));
  await put(d3, "CLAUDE.md", "old");
  const n3 = (await S.repoInstructions(d3)).notes;
  await put(d3, "CLAUDE.md", "new");
  assert.deepEqual(await S.topNotes(d3, n3), [{ name: "CLAUDE.md", text: "new" }]);
  // /init writes the file Coder now reads.
  const R = await import("../src/coder-routes.mjs");
  assert.match(R.INIT_TEXT, /create a CLAUDE\.md file in the repository's root/);
});

test("M-f-12 rules at any depth with no 50-file cap; a guard past 1,000 says so", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-b4-rules-"));
  await put(dir, "CODER.md", "top");
  for (let i = 0; i < 60; i++) await put(dir, ".coder/rules/a/b/c/d/e/f/g/r" + String(i).padStart(2, "0") + ".md", "rule " + i);
  const r = await S.repoInstructions(dir);
  assert.equal(r.notes.filter((n) => n.name.startsWith(".coder/rules/")).length, 60, "60 rule files, 7 folders deep, all load");
  assert.equal(r.rulesCut, undefined);
  const big = await mkdtemp(join(tmpdir(), "coder-b4-guard-"));
  for (let i = 0; i <= S.RULES_GUARD; i++) await put(big, ".coder/rules/r" + String(i).padStart(4, "0") + ".md", "x");
  const rb = await S.repoInstructions(big);
  assert.equal(rb.rulesCut, true);
  assert.equal(rb.notes.length, S.RULES_GUARD, "the guard stops the look");
  assert.match(S.RULES_CUT_NOTE, /^Some of this repository's rule files were not loaded: its rules folder holds more than 1,000 files and folders\.$/);
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(ins\.rulesCut\) t\.events\.push\(\{ at: Date\.now\(\), type: "note", text: RULES_CUT_NOTE \}\);/, "the chat is told");
});

test("M-f-12 a subfolder's own instructions are looked up when a file there is touched: in a build folder, past the start's 30, made in the middle of the job, Claude Code's names too; once; never through a link", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-b4-sub-"));
  await put(dir, "CODER.md", "top");
  await put(dir, "build/gen/CODER.md", "Generated: do not edit by hand.");
  for (let i = 0; i < 31; i++) await put(dir, "p" + String(i).padStart(2, "0") + "/CODER.md", "folder " + i);
  const ins = await S.repoInstructions(dir);
  const known = new Set(ins.later.map((x) => x.name));
  assert.ok(!known.has("build/gen/CODER.md"), "the start's search passes build folders by");
  assert.ok(!known.has("p30/CODER.md"), "and stops at 30");
  const shown = new Set();
  const opts = { found: !!ins.found, known };
  assert.deepEqual(await S.folderNotes(dir, "build/gen/out.js", shown, opts), ["— build/gen/CODER.md:\nGenerated: do not edit by hand."]);
  assert.deepEqual(await S.folderNotes(dir, "build/gen/out2.js", shown, opts), [], "once");
  assert.deepEqual(await S.folderNotes(dir, join(dir, "p30", "x.js"), shown, opts), ["— p30/CODER.md:\nfolder 30"], "a full path inside the project works too");
  assert.deepEqual(await S.folderNotes(dir, "p00/x.js", shown, opts), [], "one the start already has is laterNotes'");
  // Made in the middle of the job: the next touch loads it.
  assert.deepEqual(await S.folderNotes(dir, "lib/new/a.js", shown, opts), []);
  await put(dir, "lib/new/CLAUDE.md", "lib/new: Claude Code's file.");
  await put(dir, "lib/new/.claude/rules/only-ts.md", "---\npaths: [\"**/*.ts\"]\n---\nTypes first.\n");
  await put(dir, "lib/new/.claude/rules/all.md", "Small functions.");
  assert.deepEqual(await S.folderNotes(dir, "lib/new/a.js", shown, opts), ["— lib/new/CLAUDE.md:\nlib/new: Claude Code's file.", "— lib/new/.claude/rules/all.md:\nSmall functions."]);
  assert.deepEqual(await S.folderNotes(dir, "lib/new/b.ts", shown, opts), ["— lib/new/.claude/rules/only-ts.md:\nTypes first."], "a rule with paths only for the files it names");
  // An AGENTS.md only on a read, and only with no instructions at the top.
  const d2 = await mkdtemp(join(tmpdir(), "coder-b4-ag-"));
  await put(d2, "x/AGENTS.md", "agents in x");
  assert.deepEqual(await S.folderNotes(d2, "x/a.js", new Set(), { tool: "edit" }), []);
  assert.deepEqual(await S.folderNotes(d2, "x/a.js", new Set(), { tool: "read" }), ["— x/AGENTS.md:\nagents in x"]);
  assert.deepEqual(await S.folderNotes(d2, "x/a.js", new Set(), { tool: "read", found: true }), []);
  // Never through a link: a folder swapped for one leads nowhere.
  const evil = await mkdtemp(join(tmpdir(), "coder-b4-evil-"));
  await put(evil, "CODER.md", "ROOT-ONLY");
  await symlink(evil, join(dir, "linked"));
  assert.deepEqual(await S.folderNotes(dir, "linked/a.js", new Set(), opts), []);
  await put(dir, "real/placeholder.txt", "x");
  await symlink(join(evil, "CODER.md"), join(dir, "real", "CODER.md"));
  assert.deepEqual(await S.folderNotes(dir, "real/a.js", new Set(), opts), [], "nor a file that is a link");
  // Coder's own, Claude Code's own and git's folders are not looked in; nor the project's top (the start has it).
  await put(dir, ".claude/x/CODER.md", "no");
  assert.deepEqual(await S.folderNotes(dir, ".claude/x/settings.json", new Set(), opts), []);
  assert.deepEqual(await S.folderNotes(dir, "top.js", new Set(), opts), []);
  // laterNotes puts them in its block, after its own.
  assert.match(S.laterNotes([], dir, "lib/new/a.js", new Set(), "read", ["— lib/new/CLAUDE.md:\nhi"]), /^THE REPO'S INSTRUCTIONS FOR THIS FILE, from the repository's files[^\n]*:\n— lib\/new\/CLAUDE\.md:\nhi$/);
  await rm(evil, { recursive: true, force: true });
});

test("M-f-12 the machine looks them up after each file tool (afterFile awaits folderNotes, with the job's excludes and deny rules)", () => {
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /afterFile: async \(\{ tool, args \}\) => \{/);
  assert.match(src, /await folderNotes\(dir, args && args\.path, shownNotes, \{ tool, found: !!ins\.found, excludes: mdExcludes, withhold: insWithhold, known: new Set\(later\.map\(\(x\) => x && x\.name\)\) \}\)/);
  assert.match(src, /return \[laterNotes\(later, dir, args && args\.path, shownNotes, tool, found\),/);
});

test("M-b-38 the plan card's Accept edits choice reads 'Yes, auto-accept edits', Claude Code's words", () => {
  assert.match(ui, /\['acceptEdits', 'Yes, auto-accept edits'\]/);
  assert.doesNotMatch(ui, /Yes, and accept edits/);
});

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function queueWorld() {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-qlater1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json", qk = "coder/" + uid + "/" + id + "/queue.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), title: "x" }));
  const w = { R, bucket, mk, qk, id, toMachine: [], unqueued: [], stops: 0, movable: false, readOnMachine: new Set() };
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (p === "/queue") { w.toMachine.push(await req.json()); return Response.json({ ok: true }); }
    if (p === "/unqueue") { const b = await req.json(); w.unqueued.push(b.qid); return Response.json(w.readOnMachine.has(b.qid) ? { ok: true, removed: false, read: true } : { ok: true, removed: true }); }
    if (p === "/bgmove") return Response.json(w.movable ? { ok: true } : { ok: false, why: "no command of Coder's is running now" });
    if (p === "/stop") { w.stops++; return Response.json({ ok: true, running: true }); }
    if (p === "/state") return Response.json({ running: true, events: [] });
    return Response.json({ ok: true });
  } });
  w.go = (path, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box });
  w.send = async (b) => { const r = await w.go("projects/" + id + "/message", { method: "POST", body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };
  w.queue = async (b) => { const r = await w.go("projects/" + id + "/queue", { method: "POST", body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };
  w.saved = () => JSON.parse(w.bucket.m.get(qk) || "[]");
  return w;
}

test("M-d-12 Ctrl+Enter while Coder works really queues for later: the message waits for the job's end and is never handed to the running job; Enter still is; ✕ takes it back without asking the machine; it goes out after the job with the rest", async () => {
  const w = await queueWorld();
  const later = await w.send({ text: "and then write the docs", later: true });
  assert.equal(later.status, 200);
  assert.equal(later.data.queued, true);
  const plain = await w.send({ text: "use port 3001" });
  assert.deepEqual(w.toMachine.map((x) => x.text), ["use port 3001"], "only the plain one reaches the running job");
  assert.deepEqual(w.saved().map((q) => [q.text, !!q.later]), [["and then write the docs", true], ["use port 3001", false]]);
  // A ! command or a /compact with later: as before (they wait for the end anyway, unmarked).
  await w.send({ text: "! npm test", later: true });
  assert.equal(w.saved().at(-1).later, undefined);
  assert.equal(w.R.laterOf({ later: true }, null, "/compact keep the plan"), false);
  assert.equal(w.R.laterOf({ later: true }, null, "hi"), true);
  assert.equal(w.R.laterOf({}, null, "hi"), false);
  // ✕ on the one queued for later: back to the box, the machine is not asked (it never had it).
  const back = await w.queue({ remove: later.data.qid });
  assert.deepEqual([back.status, back.data.text], [200, "and then write the docs"]);
  assert.deepEqual(w.unqueued, []);
  // At the job's end, what waits goes out together in the order typed (nextQueued): a later one is a message like the rest.
  assert.deepEqual(w.R.nextQueued([{ qid: "a", text: "x", later: true }, { qid: "b", text: "y" }]).map((q) => q.qid), ["a", "b"]);
  // A card's answer takes the turn up again: the ones queued for later are not handed to it.
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /queued: \(await queuedP\)\.filter\(\(q\) => q && !q\.shell && !q\.later && typeof q\.text === "string"\)/);
  void plain;
});

test("M-d-12 Send now on a waiting message, as Claude Code's cloud sessions: what waits goes to the running job at once and its command moves to the background; with nothing to move, the job stops and what waits goes out next; a ! command first stops it", async () => {
  // Coder runs a command that can move: the later ones are handed over and it moves.
  let w = await queueWorld();
  const a = await w.send({ text: "first, plain" });
  const b = await w.send({ text: "second, for later", later: true });
  w.movable = true;
  let r = await w.queue({ now: b.data.qid });
  assert.deepEqual([r.status, r.data.ok, r.data.moved], [200, true, true]);
  assert.deepEqual(w.toMachine.map((x) => x.text), ["first, plain", "second, for later"], "the later one is handed over now");
  assert.equal(w.saved().find((q) => q.qid === b.data.qid).later, undefined, "no longer waiting for the end");
  assert.equal(w.stops, 0);
  // Nothing can move: the ones just handed over are taken back, and the job stops (what waits goes out next).
  w = await queueWorld();
  const c = await w.send({ text: "for later", later: true });
  r = await w.queue({ now: c.data.qid });
  assert.deepEqual([r.status, r.data.ok, r.data.stopped], [200, true, true]);
  assert.deepEqual(w.unqueued, [c.data.qid]);
  assert.equal(w.stops, 1);
  assert.ok(w.saved().some((q) => q.qid === c.data.qid), "still waiting, to go out next");
  // Read by Coder in between: it reached the job, so nothing stops.
  w = await queueWorld();
  const d = await w.send({ text: "for later too", later: true });
  w.readOnMachine.add(d.data.qid);
  r = await w.queue({ now: d.data.qid });
  assert.deepEqual([r.status, r.data.read, w.stops], [200, true, 0]);
  // A ! command ahead of the messages: the turn is stopped, as Claude Code's key does then.
  w = await queueWorld();
  const e = await w.send({ text: "! ls" });
  await w.send({ text: "then this" });
  w.movable = true;
  r = await w.queue({ now: e.data.qid });
  assert.deepEqual([r.data.stopped, r.data.why, w.stops], [true, "command", 1]);
  // Not waiting any more, or Coder not working: said.
  r = await w.queue({ now: "qnope123" });
  assert.equal(r.status, 409);
  assert.match(r.data.error, /no longer waiting/);
  await w.bucket.put(w.mk, JSON.stringify({ ...JSON.parse(w.bucket.m.get(w.mk)), status: "idle" }));
  r = await w.queue({ now: e.data.qid });
  assert.equal(r.status, 409);
  assert.match(r.data.error, /not working now/);
  void a;
});

test("M-d-12 the page: Ctrl+Enter (or ⌘+Enter) sends `later` while Coder works; the grey line says 'Queued for later'; each waiting message has Send now while Coder works", () => {
  assert.match(ui, /send\(input\.value, \(e\.ctrlKey \|\| e\.metaKey\) && !GLOOPY \? \{ later: true \} : undefined\)/);
  assert.match(ui, /body: opts && opts\.later \? JSON\.stringify\(\{ text, mid: qmid, later: true \}\) : JSON\.stringify\(\{ text, mid: qmid \}\)/);
  assert.match(ui, /q\.later \? 'Queued for later' : 'Waiting for Coder'/);
  assert.match(ui, /data-sendnow="' \+ esc\(q\.qid\) \+ '" title="Send what waits right away">Send now<\/button>/);
  assert.match(ui, /JSON\.stringify\(\{ now: qid \}\)/);
  assert.match(ui, /'Enter to send, Ctrl\+Enter to queue for later'/, "the hint is now true");
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(css, /#gfApp \.cd-queued-now \{/);
});

// ── M-d-14: files of any kind attached in Coder's chat ───────────────────────
function binBucket() {
  const m = new Map();
  const val = (v) => (typeof v === "string" ? v : v instanceof Uint8Array ? v : String(v));
  return { m, async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { text: async () => (typeof v === "string" ? v : Buffer.from(v).toString("utf8")), arrayBuffer: async () => (typeof v === "string" ? new TextEncoder().encode(v).buffer : v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) }; },
    async put(k, v) { m.set(k, val(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("M-d-14 the chat keeps a file of any kind for the next message (25 MB each, 20 a message, past the chat's limits a new one is refused and none is dropped); its name is cleaned", async () => {
  const A = await import("../src/coder-attach.mjs");
  const bucket = binBucket();
  const uid = "user-1234567890abcdef", id = "shop-att1";
  const pdf = await A.keepAttach(bucket, uid, id, { name: "../Q3 report.pdf", bytes: new TextEncoder().encode("%PDF-1.4 …") });
  assert.match(pdf.id, A.ATTACH_ID);
  assert.equal(pdf.name, "Q3 report.pdf", "no folders");
  const bin = await A.keepAttach(bucket, uid, id, { name: "firmware.bin", bytes: new Uint8Array([0, 1, 2, 255]) });
  assert.equal(bin.name, "firmware.bin", "any kind of file, unlike Gloopy's list");
  assert.equal((await A.keepAttach(bucket, uid, id, { name: ".env", bytes: new Uint8Array([1]) })).name, "env", "no dot first");
  assert.match((await A.keepAttach(bucket, uid, id, { name: "x.txt", bytes: new Uint8Array(0) })).error, /empty/);
  assert.match((await A.keepAttach(bucket, uid, id, { name: "big.iso", bytes: { byteLength: A.ATTACH_FILE_MAX + 1 } })).error, /over 25 MB/);
  const got = await A.attachOf(bucket, uid, id, bin.id);
  assert.deepEqual([...new Uint8Array(got.body)], [0, 1, 2, 255]);
  assert.equal(await A.attachOf(bucket, uid, "other-chat", bin.id), null, "only that chat's");
  // The first 20 of a message go; the rest are counted as left out.
  const many = [];
  for (let i = 0; i < 22; i++) many.push((await A.keepAttach(bucket, uid, id, { name: "f" + i + ".txt", bytes: new Uint8Array([i + 1]) })).id);
  const pick = await A.attachedFor(bucket, uid, id, many);
  assert.deepEqual([pick.files.length, pick.left], [20, 2]);
  assert.match((await A.attachedFor(bucket, uid, id, ["a000000000000"])).error, /gone: attach it again/);
  assert.equal(A.attachLeftNote(2), "2 more files were attached to this message and left out: a message takes the first 20.");
  // Full: refused, nothing dropped.
  const before = (await A.readAttach(bucket, uid, id)).length;
  const full = binBucket();
  await full.put("coder/" + uid + "/" + id + "/attach.json", JSON.stringify(Array.from({ length: A.ATTACH_KEPT_MAX }, (_, i) => ({ id: "a" + String(i).padStart(12, "0"), name: "k" + i + ".txt", size: 1, at: i }))));
  assert.match((await A.keepAttach(full, uid, id, { name: "one-more.txt", bytes: new Uint8Array([1]) })).error, /already keeps as many attached files as it can/);
  assert.equal((await A.readAttach(full, uid, id)).length, A.ATTACH_KEPT_MAX, "none dropped");
  assert.equal((await A.readAttach(bucket, uid, id)).length, before);
});

test("M-d-14 Coder's Worker: the page's PUT keeps a file with a Coder chat; the message takes it to the machine (attached, and how many were left out); the machine fetches it with its job's pass only; the owner can download it; while Coder works, files wait", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = binBucket();
  const UID = "user-1234567890abcdef", ID = "shop-att2";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const turns = [];
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }),
    container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; const body = req.method === "POST" ? await req.json().catch(() => null) : null; if (p === "/turn") turns.push(body); return Response.json({ ok: true, pushed: false }); } }) };
  const go = (p, init = {}) => R.handleCoder(new Request("https://gofarther.dev/api/coder/" + p, init), env, {}, deps);
  const k = (f) => "coder/" + UID + "/" + ID + "/" + f;
  await bucket.put(k("meta.json"), JSON.stringify({ id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 2, saved: 2, status: "idle", at: Date.now(), title: "x" }));
  const up = await go("projects/" + ID + "/files", { method: "PUT", headers: { "content-type": "application/pdf", "x-file-name": encodeURIComponent("spec.pdf") }, body: new TextEncoder().encode("%PDF-1.4 spec") });
  assert.equal(up.status, 200);
  const file = (await up.json()).file;
  assert.equal(file.name, "spec.pdf");
  // The owner's Download of it.
  const dl = await go("projects/" + ID + "/files/" + file.id);
  assert.equal(dl.status, 200);
  assert.equal(await dl.text(), "%PDF-1.4 spec");
  assert.match(dl.headers.get("content-disposition"), /filename="spec\.pdf"/);
  // The message with it: the job gets it (no text: "(see the attached file)").
  const r = await go("projects/" + ID + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "", files: [file.id] }) });
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.equal(turns.length, 1);
  assert.deepEqual(turns[0].attached, [{ id: file.id, name: "spec.pdf", size: 13 }]);
  assert.equal(turns[0].text, "(see the attached file)");
  assert.equal(turns[0].attachedLeft, undefined);
  // The machine fetches it with the job's own pass; any other pass, or another chat's, is refused.
  const { egressPass } = await import("../src/coder-egress.mjs").catch(() => ({}));
  const meta = JSON.parse(bucket.m.get(k("meta.json")));
  assert.equal(meta.status, "running");
  const pass = egressPass ? await egressPass(env, UID + "/" + ID, String(meta.turn)) : (turns[0].egress && turns[0].egress.pass);
  const ask = (h, id = file.id) => R.coderJobFile(new Request("https://gofarther.dev/api/coder/coder-file-get", { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify({ id }) }), env, bucket);
  const ok = await ask({ "x-coder-chat": UID + "/" + ID, "x-coder-turn": String(meta.turn), "x-coder-egress": pass });
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "%PDF-1.4 spec");
  assert.equal(decodeURIComponent(ok.headers.get("x-file-name")), "spec.pdf");
  assert.equal((await ask({ "x-coder-chat": UID + "/" + ID, "x-coder-turn": String(meta.turn), "x-coder-egress": "nope" })).status, 403);
  assert.equal((await ask({ "x-coder-chat": UID + "/gloopy-main", "x-coder-turn": String(meta.turn), "x-coder-egress": pass })).status, 403);
  assert.equal((await ask({ "x-coder-chat": UID + "/" + ID, "x-coder-turn": String(meta.turn), "x-coder-egress": pass }, "a000000000000")).status, 404);
  // While Coder works: a message with files waits, in words.
  const busy = await go("projects/" + ID + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "and this", files: [file.id] }) });
  assert.equal(busy.status, 409);
  assert.match((await busy.json()).error, /send files once it is done/);
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /const attachedOn = att\.files\.length \? \{ attached: att\.files\.map\(\(f\) => \(\{ id: f\.id, name: f\.name, size: f\.size \}\)\), \.\.\.\(att\.left \? \{ attachedLeft: att\.left \} : \{\}\) \} : \{\};/);
  assert.match(src, /images: pics\.images, \.\.\.attachedOn, messages, repo: meta\.repo,/);
});

test("M-d-14 Coder's machine saves them in .coder-files (never saved to the branch) and tells Coder where, why one could not be, and how many were left out", async () => {
  const { runCoder, coderAttachNote } = await import("../container/coder-agent.mjs");
  assert.ok(S.NEVER_COMMIT.includes(".coder-files/"));
  assert.ok(S.WORK_SKIP.includes(".coder-files"));
  assert.equal(coderAttachNote([".coder-files/spec.pdf (1 KB)"], [], 0), "\n\n(Note from Coder's app: the owner attached a file, saved in the project, where it is never saved to the branch: .coder-files/spec.pdf (1 KB). Read it with the read tool when you need to, or copy it where the work needs it.)");
  assert.equal(coderAttachNote([], [], 0), "");
  const seen = [], ran = [];
  const say = (content) => ({ message: { role: "assistant", content }, usage: { in: 1, out: 1 } });
  await runCoder({
    send: async (q) => { seen.push(q); return say("Done."); },
    emit: () => {},
    exec: async ({ command, payload }) => {
      const req = payload ? JSON.parse(payload) : JSON.parse(Buffer.from(command.split(" ").pop(), "base64").toString("utf8"));
      ran.push(req.tool);
      if (req.tool === "save_upload" && req.args.name === "full.zip") return { code: 1, output: "error: ENOSPC: no space left on device, write" };
      if (req.tool === "save_upload") return { code: 0, output: ".coder-files/" + req.args.name + "\n" };
      return { code: 0, output: "" };
    },
    files: { get: async (id) => (id === "agone0000000" ? null : { name: id, data: Buffer.from("x").toString("base64") }) },
  }, { text: "look at these", attached: [{ id: "a1", name: "spec.pdf", size: 1024 }, { id: "a2", name: "full.zip", size: 2048 }, { id: "agone0000000", name: "gone.txt", size: 3 }], attachedLeft: 2 });
  assert.ok(ran.includes("save_upload") && !ran.includes("save_file"), "Coder's own tool, not Gloopy's");
  const first = seen[0].messages.find((m) => m.role === "user" && /look at these/.test(m.content));
  assert.match(first.content, /\(Note from Coder's app: the owner attached a file, saved in the project, where it is never saved to the branch: \.coder-files\/spec\.pdf \(1 KB\)\./);
  assert.match(first.content, /These files the owner attached could not be saved: full\.zip \(the disk is full\), gone\.txt \(it could not be fetched\); tell the owner\./);
  assert.match(first.content, /2 more files were attached to this message and left out: a message takes the first 20\.\)$/);
});

test("M-d-14 save_upload writes in the project's .coder-files, never over another file", async () => {
  const { mkdtemp: mk } = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");
  const dir = await mk(join(tmpdir(), "coder-b4-up-"));
  const script = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
  const run = (args) => execFileSync("node", ["--no-warnings", script, Buffer.from(JSON.stringify({ tool: "save_upload", args })).toString("base64")], { cwd: dir }).toString().trim();
  assert.equal(run({ name: "notes.txt", data: Buffer.from("one").toString("base64") }), ".coder-files/notes.txt");
  assert.equal(run({ name: "notes.txt", data: Buffer.from("two").toString("base64") }), ".coder-files/notes (2).txt");
  assert.equal(readFileSync(join(dir, ".coder-files", "notes.txt"), "utf8"), "one");
  let bad = "";
  try { run({ name: "../escape.txt", data: "" }); } catch (e) { bad = String(e.stdout || ""); }
  assert.match(bad, /give a file: its name and data/);
});

test("M-d-14 the page: any file can be attached in Coder's chat (no picture-only filter; uncommon pictures as regular files; pasted files too), 'Attach files'", () => {
  assert.match(ui, /if \(S\.project\) \{ const docs = \[\.\.\.files\]\.filter\(\(f\) => !\/\^image\\\/\(png\|jpeg\|webp\|gif\)\$\/\.test\(f\.type\)\); if \(docs\.length\) addFiles\(docs\); \}/);
  assert.match(ui, /\(GLOOPY \? \/\^image\\\/\/\.test\(f\.type\) : \/\^image\\\/\(png\|jpeg\|webp\|gif\)\$\/\.test\(f\.type\)\)/);
  assert.match(ui, /<input type="file" id="cdFile" accept="' \+ \(GLOOPY \? 'image\/png,[^']*' : ''\) \+ '" multiple hidden>'/, "no filter in Coder's chat (an empty accept takes any file)");
  assert.match(ui, /aria-label="' \+ \(GLOOPY \? 'Attach a file' : 'Attach files'\) \+ '"/);
  assert.match(ui, /if \(files\.length\) \{ e\.preventDefault\(\); addPics\(files\); \}/);
});
