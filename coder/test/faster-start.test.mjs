// FASTER STILL (owner, 2026-11-16, after deploy 204: "asked" was 1.5-2 s, a new chat's clone ~3.7 s and ~2.1 s more until
// ready). FT1: the Worker's own sub-step times (timing.w.*), and no read of every chat when no limit is set; FT2: the
// machine's new step times; FT3: a new chat's clone is one commit deep, asks GitHub once, and gets its history in the
// background; the diff against the main branch waits for it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fakeBucket() {
  const m = new Map(); const lists = [];
  return { m, lists, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { lists.push(prefix); return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef";
const R = await import("../src/coder-routes.mjs");
const { saveConnection } = await import("../src/coder-github.mjs");

async function world(extraEnv = {}) {
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket, ...extraEnv };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const calls = [];
  const box = () => ({ fetch: async (req) => { calls.push(new URL(req.url).pathname); return Response.json({ ok: true }); } });
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box };
  const go = (id, path, init) => R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + path, init), env, {}, deps);
  const put = (id, meta) => bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, ...meta }));
  const read = (id, f) => JSON.parse(bucket.m.get("coder/" + UID + "/" + id + "/" + f) || "null");
  const send = (id, text) => go(id, "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, mode: "auto" }) });
  return { bucket, calls, put, read, send };
}

test("FT1 the Worker's start: its sub-step times are kept (timing.w.*, in order, ms since it got the message); every chat is read to count those working only when CODER_MAX_RUNNING sets a limit, which still holds", async () => {
  const w = await world();
  await w.put("shop-a1", { turn: 0, saved: 0, status: "idle", at: Date.now() });
  await w.put("shop-a2", { turn: 3, saved: 3, status: "running", at: Date.now() });
  const r = await w.send("shop-a1", "Make the logo blue");
  assert.equal(r.status, 200, await r.clone().text());
  assert.deepEqual(w.calls, ["/turn"]);
  const t = w.read("shop-a1", "meta.json").timing;
  const keys = ["body", "checked", "claim", "token", "reads", "copy", "job", "held", "saved"];
  for (const k of keys) assert.ok(Number.isFinite(t.w[k]) && t.w[k] >= 0, k + " " + JSON.stringify(t.w));
  for (let i = 1; i < keys.length; i++) assert.ok(t.w[keys[i]] >= t.w[keys[i - 1]], keys[i] + " after " + keys[i - 1]);
  assert.ok(t.asked - t.got >= t.w.saved);
  assert.ok(!w.bucket.lists.includes("coder/" + UID + "/"), "no list of every chat with no limit");

  // WITH A LIMIT: counted, and kept.
  const l = await world({ CODER_MAX_RUNNING: "1" });
  await l.put("shop-b1", { turn: 0, saved: 0, status: "idle", at: Date.now() });
  await l.put("shop-b2", { turn: 3, saved: 3, status: "running", at: Date.now() });
  const r2 = await l.send("shop-b1", "hi");
  assert.equal(r2.status, 429);
  assert.match((await r2.json()).error, /1 chats are already working/);
  assert.equal(l.read("shop-b1", "meta.json").status, "idle", "put back as it was");
  assert.deepEqual(l.calls, []);
});

test("FT2 the step times carry the Worker's sub-steps and the machine's new ones (repos, gate, room, box, setupEnd); junk is dropped", () => {
  const out = R.turnTiming({ got: 1000, asked: 1300, w: { body: 5, claim: 40, saved: 290, "bad key": 3, neg: -1, x: "y" } }, { got: 1400, cloneEnd: 1500, repos: 1510, gate: 1520, room: 1530, box: 1540, setupEnd: 1550, ready: 1560 }, 2000);
  assert.deepEqual(out, { at: 1000, asked: 300, "w.body": 5, "w.claim": 40, "w.saved": 290, "m.got": 400, "m.cloneEnd": 500, "m.repos": 510, "m.gate": 520, "m.room": 530, "m.box": 540, "m.setupEnd": 550, "m.ready": 560, saved: 1000 });
});

const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
const commit = async (work, name) => { await writeFile(join(work, name), name + "\n"); git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A"); git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", name); };

test("FT3 a new chat's clone: one commit deep and no tags at first, its history (50 commits) after in the background; a chat branch GitHub has comes in the same fetch; See changes against the main branch waits for the history and is right", async () => {
  const { prepareRepo, gitDirFor, historyReady, localChanges } = await import("../container/server.mjs");
  const gh = await mkdtemp(join(tmpdir(), "coder-gh-")), work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  for (const f of ["a", "b", "c"]) await commit(work, f + ".txt");
  git(work, "tag", "v1");
  git(work, "checkout", "-q", "-b", "coder/shop-f1");
  await commit(work, "mine.txt");
  git(work, "checkout", "-q", "main");
  await commit(work, "later.txt");
  await mkdir(join(gh, "ana"), { recursive: true });
  execFileSync("git", ["clone", "-q", "--bare", work, join(gh, "ana", "shop.git")]);
  const remote = "file://" + gh + "/";
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), gitRoot = await mkdtemp(join(tmpdir(), "coder-git-"));

  // A NEW CHAT (its branch not on GitHub yet).
  const dir = join(root, "shop-n1"), o = ["--git-dir", gitDirFor(dir, gitRoot)];
  const p = await prepareRepo({ dir, repo: "ana/shop", base: "main", branch: "coder/shop-n1", token: "", remote, gitRoot, root });
  assert.equal(p.ok, true, p.why);
  assert.equal(git(dir, ...o, "rev-parse", "--abbrev-ref", "HEAD").trim(), "coder/shop-n1");
  assert.equal(git(dir, ...o, "tag").trim(), "", "no tags");
  await historyReady(dir);
  assert.equal(git(dir, ...o, "rev-list", "--count", "refs/remotes/origin/main").trim(), "4", "the history came after");

  // A CHAT WHOSE BRANCH GITHUB HAS, ON A NEW MACHINE: both in one fetch, then the branch's history; its changes against main
  // are only its own commit (the two branches' common commit found once the history is in).
  const dir2 = join(root, "shop-f1"), o2 = ["--git-dir", gitDirFor(dir2, gitRoot)];
  const p2 = await prepareRepo({ dir: dir2, repo: "ana/shop", base: "main", branch: "coder/shop-f1", token: "", remote, gitRoot, root });
  assert.equal(p2.ok, true, p2.why);
  assert.equal(git(dir2, ...o2, "rev-parse", "--abbrev-ref", "HEAD").trim(), "coder/shop-f1");
  const ch = await localChanges({ dir: dir2, repo: "ana/shop", against: "main", token: "", remote, gitRoot, root });
  assert.equal(ch.ok, true, ch.why);
  assert.deepEqual(ch.files.map((f) => f.path || f.file || f.name), ["mine.txt"]);
  assert.equal(git(dir2, ...o2, "rev-list", "--count", "HEAD").trim(), "4");
});
