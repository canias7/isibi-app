// A WORKING FOLDER ADDED WHILE CODER WORKS (audit M-r2-40, 2026-11-20). Claude Code: "If you run `/add-dir` while Claude is
// responding, Claude's next tool call can access the directory once you confirm the add". Coder's Worker now tells the
// running job (its machine's /rules, with the folders), the machine adds them to the job's live working folders, and Coder's
// loop counts them from its next tool call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const A = await import("../container/coder-agent.mjs");
const S = await import("../container/server.mjs");
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("DM1 the Worker: a working folder added while a chat of that repository runs is sent to its machine's /rules at once, with the folders", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { WATCH_PREFIX } = await import("../src/coder-watch.mjs");
  const uid = "user-1234567890abcdef", id = "shop-d1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  bucket.m.set("coder/" + uid + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, status: "running", at: Date.now() }));
  bucket.m.set(WATCH_PREFIX + uid + "__" + id + "__1", "{}");
  const posted = [];
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }),
    container: () => ({ fetch: async (req) => { posted.push({ path: new URL(req.url).pathname, body: await req.json().catch(() => ({})) }); return Response.json({ ok: true }); } }) };
  const r = await handleCoder(new Request("https://gofarther.dev/api/coder/permissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: "ana/shop", kind: "dirs", add: "/home/dev/shared" }) }), env, { waitUntil() {} }, deps);
  assert.equal(r.status, 200, await r.clone().text());
  const told = posted.filter((p) => p.path === "/rules");
  assert.equal(told.length, 1, "the running job is told");
  assert.deepEqual(told[0].body.rules.dirs, ["/home/dev/shared"]);
  assert.equal(told[0].body.project, id);
});

test("DM2 the machine: the folders from /rules are added to the job's live working folders (once, with the 'not there' note once), as at the job's start", async () => {
  const root = mkdtempSync(join(tmpdir(), "dm2-"));
  const extra = join(root, "shared");
  mkdirSync(extra);
  try {
    // (The job's own lists and addWorkdirs, as server.mjs builds them for the loop.)
    const workRoots = [join(root, "work")], addDirs = [], otherRoots = [];
    const t = { events: [], seen: null, turnDeps: { addWorkdirs: async (paths) => { const got = await S.extraDirsOf(paths, root, {}); const dirs = got.filter((d) => !workRoots.includes(d)); for (const d of dirs) { workRoots.push(d); addDirs.push(d); otherRoots.push(d); } return { dirs, missing: got.missing }; } } };
    const one = await S.addRuleDirsNow(t, [extra, join(root, "nope")]);
    assert.equal(one.dirs.length, 1);
    assert.ok(otherRoots[0].endsWith("/shared"));
    assert.equal(t.events.filter((e) => /not used in this message/.test(e.text)).length, 1);
    const two = await S.addRuleDirsNow(t, [extra, join(root, "nope")]);
    assert.deepEqual(two.dirs, [], "already a working folder");
    assert.equal(otherRoots.length, 1);
    assert.equal(t.events.length, 1, "the note is said once");
    // No job's loop yet: nothing.
    assert.deepEqual(await S.addRuleDirsNow({}, [extra]), { dirs: [] });
  } finally { rmSync(root, { recursive: true, force: true }); }
  // And the /rules route calls it.
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const added = await addRuleDirsNow\(t, r\.dirs\)/);
});

test("DM3 Coder's loop: a folder added to the job's working folders mid-job counts from the next tool call (Accept edits writes there without asking), and not before", async () => {
  const otherRoots = [];
  const cards = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "mkdir /srv/shared/a", description: "Make a" }, "b1")]), say("", [call("bash", { command: "mkdir /srv/shared/b", description: "Make b" }, "b2")]), say("done")];
  await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async () => ({ code: 0, output: "" }),
    emit: () => {},
    ask: async (pid) => { cards.push(pid); otherRoots.push("/srv/shared"); return { choice: "yes" }; },
    rulesNow: () => null,
    otherRoots,
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-dirs",
  }, { text: "go", mode: "acceptEdits", rules: { allow: [], ask: [], deny: [] } });
  assert.equal(cards.length, 1, "asked for the first, outside the working folders; the folder added meanwhile covers the second");
});
