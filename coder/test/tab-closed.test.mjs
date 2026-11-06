// A JOB KEEPS GOING WHEN THE TAB CLOSES, like Claude Code (the owner's
// screenshots, 2026-11-06: "Finish all this", item 1 "Closing the tab").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

/** Coder's machine, as far as these tests need it: a job that runs until told it has ended. */
function fakeMachine() {
  const seen = [];
  const m = { seen, running: false, result: null, claimed: false, events: [] };
  m.box = () => ({ fetch: async (req) => {
    const u = new URL(req.url);
    seen.push(u.pathname);
    const J = (o) => Response.json(o);
    if (u.pathname === "/turn") { m.running = true; m.result = null; m.claimed = false; m.events = [{ at: 1, type: "user", text: "make it" }]; return J({ ok: true }); }
    if (u.pathname === "/state") { const since = Number(u.searchParams.get("since")) || 0; return J({ running: m.running, events: m.events.slice(since), next: m.events.length, ...(m.result ? { result: m.result } : {}) }); }
    if (u.pathname === "/claim") { if (!m.result || m.claimed) return J({ ok: false }); m.claimed = true; return J({ ok: true }); }
    if (u.pathname === "/push") return J({ ok: true, pushed: true, changed: true, sha: "abc1234" });
    return J({ ok: true });
  } });
  m.finish = () => { m.running = false; m.events.push({ at: 2, type: "done", text: "Made it." }); m.result = { status: "done", summary: "Made it", messages: [{ role: "user", content: "make it" }, { role: "assistant", content: "Made it." }] }; };
  return m;
}

async function setup() {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-t1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  await bucket.put("coder/" + uid + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 0, saved: 0, status: "idle", at: Date.now() }));
  const machine = fakeMachine();
  const fetchFn = async () => new Response("{}", { status: 404 });
  // The page's calls (signed in), and the every-minute run's (as the job's owner).
  const tab = { fetchFn, authUser: async () => ({ id: uid, email: "me@x.y" }), container: machine.box };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, tab);
  const coder = (req, who) => handleCoder(req, env, {}, { fetchFn, authUser: async () => who, container: machine.box });
  return { uid, id, bucket, env, machine, go, coder };
}

test("CD112 a job keeps going with no tab open, like Claude Code: it goes on the watch list when it starts; every minute its machine is asked about it (which keeps it awake); when it ends it is saved to its branch and leaves the list", async () => {
  const W = await import("../src/coder-watch.mjs");
  const { uid, id, bucket, env, machine, go, coder } = await setup();
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "make it" }) })).status, 200);
  const key = W.watchKey(uid, id, 1);
  const rec = JSON.parse(bucket.m.get(key));
  assert.deepEqual({ ...rec, at: 0 }, { uid, email: "me@x.y", id, turn: 1, at: 0 }, "the job's owner, chat and message");
  // THE TAB IS CLOSED. Each minute the machine is asked (so it does not fall asleep after 10 quiet minutes).
  machine.seen.length = 0;
  assert.deepEqual(await W.runWatchedJobs(env, { coder }), { checked: 1, ended: 0 });
  assert.deepEqual(machine.seen, ["/state"]);
  assert.ok(bucket.m.has(key), "still working: still watched");
  // THE JOB ENDS with nobody watching the page: the next minute saves it, as an open tab would.
  machine.finish();
  machine.seen.length = 0;
  assert.deepEqual(await W.runWatchedJobs(env, { coder }), { checked: 1, ended: 1 });
  assert.deepEqual(machine.seen, ["/state", "/claim", "/state", "/push"], "claimed once, then pushed");
  assert.equal(bucket.m.has(key), false, "off the list");
  const meta = JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/meta.json"));
  assert.equal(meta.status, "idle");
  assert.equal(meta.saved, 1);
  assert.deepEqual(meta.commits.map((c) => c.sha), ["abc1234"]);
  const events = JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/events.json"));
  assert.deepEqual(events.map((e) => e.type), ["user", "done", "github"], "the whole job is kept in the chat");
  assert.equal(events[2].text, "Saved to the branch coder/" + id);
  assert.equal(JSON.parse(bucket.m.get("coder/" + uid + "/" + id + "/messages.json")).length, 2, "Coder remembers it next time");
  // COMING BACK: the chat opens as saved. A tab still open from before loads the saved chat once.
  const back = await (await go("projects/" + id)).json();
  assert.equal(back.project.status, "idle");
  assert.equal(back.events.at(-1).text, "Saved to the branch coder/" + id);
  const late = await (await go("projects/" + id + "/state?since=1")).json();
  assert.equal(late.running, false);
  assert.equal(late.reload, true, "saved elsewhere: the page loads the saved chat");
  // WITH THE TAB OPEN: the page saves the job itself, and the job leaves the list at once.
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "again" }) })).status, 200);
  assert.ok(bucket.m.has(W.watchKey(uid, id, 2)));
  machine.finish();
  const saved = await (await go("projects/" + id + "/state?since=0")).json();
  assert.equal(saved.running, false);
  assert.equal(saved.reload, undefined, "the page saved it itself: no reload");
  assert.equal(bucket.m.has(W.watchKey(uid, id, 2)), false, "off the list without waiting for the minute");
  machine.seen.length = 0;
  assert.deepEqual(await W.runWatchedJobs(env, { coder }), { checked: 0, ended: 0 }, "nothing left to watch");
  assert.deepEqual(machine.seen, []);
});

test("CD113 the watch list never keeps a machine awake for nothing: an ended, removed, replaced or 2-hour-old job leaves it; a machine that does not answer is asked again next minute", async () => {
  const W = await import("../src/coder-watch.mjs");
  const { uid, id, bucket, env, machine, go, coder } = await setup();
  await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "make it" }) });
  // Over 2 hours (a job works 45 minutes at most): dropped without asking.
  const now = Date.now();
  machine.seen.length = 0;
  assert.deepEqual(await W.runWatchedJobs(env, { coder }, now + W.WATCH_MAX_MS + 1000), { checked: 0, ended: 1 });
  assert.deepEqual(machine.seen, []);
  assert.equal([...bucket.m.keys()].filter((k) => k.startsWith(W.WATCH_PREFIX)).length, 0);
  // A record of an earlier message of a chat that has moved on: dropped (the new message has its own).
  await W.watchJob(bucket, { uid, email: "me@x.y", id, turn: 0 });
  assert.deepEqual(await W.runWatchedJobs(env, { coder }), { checked: 1, ended: 1 });
  // A removed chat, or an account no longer allowed: dropped.
  await W.watchJob(bucket, { uid, email: "me@x.y", id: "gone-1", turn: 1 });
  await W.watchJob(bucket, { uid, email: "other@x.y", id, turn: 1 });
  assert.deepEqual(await W.runWatchedJobs(env, { coder }), { checked: 2, ended: 2 });
  // A broken record: dropped.
  bucket.m.set(W.WATCH_PREFIX + "junk.json", "{");
  assert.deepEqual(await W.runWatchedJobs(env, { coder }), { checked: 0, ended: 1 });
  // The machine does not answer this minute: kept, and asked again.
  await W.watchJob(bucket, { uid, email: "me@x.y", id, turn: 1 });
  const silent = (req, who) => coder(req, who).then(() => { throw new Error("no answer"); });
  assert.deepEqual(await W.runWatchedJobs(env, { coder: silent }), { checked: 1, ended: 0 });
  const unreachable = async () => Response.json({ ok: false, error: "Coder's machine could not be reached", project: { id, turn: 1, status: "running" } }, { status: 502 });
  assert.deepEqual(await W.runWatchedJobs(env, { coder: unreachable }), { checked: 1, ended: 0 });
  assert.equal([...bucket.m.keys()].filter((k) => k.startsWith(W.WATCH_PREFIX)).length, 1);
});

test("CD114 wiring: every minute the Worker runs the watch list beside @coder's jobs; the page says the tab can be closed, and loads the saved chat when it was saved elsewhere", () => {
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /import \{ runWatchedJobs \} from "\.\/src\/coder-watch\.mjs";/);
  assert.match(worker, /const coder = \(req, who\) => handleCoder\(req, env, ctx, \{ authUser: async \(\) => who, container \}\);\n\s+ctx\.waitUntil\(runMentionJobs\(env, \{ coder \}\)[^\n]*\n\s+ctx\.waitUntil\(runWatchedJobs\(env, \{ coder \}\)/);
  assert.match(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"), /"crons": \["\* \* \* \* \*"\]/, "every minute");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /await saveMeta\(bucket, uid, next\);[\s\S]{0,600}await watchJob\(bucket, \{ uid, email: user\.email, id, turn: next\.turn \}\)\.catch\(\(\) => \{\}\);\n\s+return json\(\{ ok: true, project: next \}\);/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /'Coder is working… you can close this tab'/);
  assert.match(page, /if \(r\.data\.reload\) \{ if \(r\.data\.project\) S\.project = r\.data\.project; S\.running = false; syncEntry\(\); draw\(\); return reloadChat\(id\); \}/, "shown as done at once, then the saved chat");
  assert.match(page, /async function reloadChat\(id\) \{\n\s+const r = await call\('\/projects\/' \+ encodeURIComponent\(id\)\);/);
});
