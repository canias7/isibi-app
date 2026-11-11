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
  assert.match(worker, /import \{ runWatchedJobs[ ,][^}]*\} from "\.\/src\/coder-watch\.mjs";/);
  assert.match(worker, /const coder = \(req, who\) => handleCoder\(req, env, ctx, \{ authUser: async \(\) => who, container: m\.container, dropMachine: m\.drop, snapshot: m\.snapshot, cacheUsable: m\.cacheUsable, copyState: m\.copyState \}\);\n\s+const work = \[\];\n\s+const job = \(p\) => \{ work\.push\(p\); ctx\.waitUntil\(p\); \};\n\s+job\(runMentionJobs\(env, \{ coder \}\)[^\n]*\n\s+job\(runWatchedJobs\(env, \{ coder \}\)/);
  // ALL OF IT AWAITED: Cloudflare waits for what scheduled() returns (up to 15 minutes), and a GitHub job's start can take minutes.
  assert.match(worker, /if \(m\.kind === "fly"\) job\(runFlyMachines\(env\)[^\n]*\n(\s+\/\/[^\n]*\n)*\s+await Promise\.all\(work\);\n\s+\},/);
  assert.match(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"), /"crons": \["\* \* \* \* \*"\]/, "every minute");
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  // Marked running and watched BEFORE the machine is asked (it sets up first, and the tab may close meanwhile).
  assert.match(routes, /await saveMeta\(bucket, uid, next\);[\s\S]{0,600}await watchJob\(bucket, \{ uid, email: user\.email, id, turn: next\.turn \}\)\.catch\(\(\) => \{\}\);[\s\S]{0,600}let r;\n\s+try \{\n\s+r = await post\("\/turn", \{/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /'Coder is working… you can close this tab'/);
  assert.match(page, /if \(r\.data\.reload\) \{ if \(r\.data\.project\) S\.project = r\.data\.project; S\.running = false; syncEntry\(\); draw\(\); return reloadChat\(id\); \}/, "shown as done at once, then the saved chat");
  assert.match(page, /async function reloadChat\(id\) \{\n\s+const r = await call\('\/projects\/' \+ encodeURIComponent\(id\)\);/);
});

test("CD115 never asleep with work on it, the old builder's way (owner: \"we had something like that on the previous builder\"): the machine says whether a job is working or waiting to be saved, and only that keeps it awake, for a limited time", async () => {
  const { busyState } = await import("../container/server.mjs");
  const W = await import("../src/coder-watch.mjs");
  const now = 10_000_000;
  // What the machine says.
  const none = new Map();
  // (bgMaxMs: the longest a background command may run, as the owner set it in Settings, 2026-11-10; 2 hours unless raised.)
  const zero = { background: 0, untold: 0, backgroundMs: 0, untoldMs: 0, bgMaxMs: 7_200_000 };
  assert.deepEqual(busyState(new Map(), now, none), { busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, ...zero });
  const map = new Map([["a-1", { running: true, started: now - 60_000, events: [] }]]);
  assert.deepEqual(busyState(map, now, none), { busy: true, working: 1, unsaved: 0, workingMs: 60_000, unsavedMs: 0, ...zero });
  map.set("a-1", { running: false, result: { status: "done" }, started: now - 600_000, ended: now - 90_000, events: [] });
  assert.deepEqual(busyState(map, now, none), { busy: true, working: 0, unsaved: 1, workingMs: 0, unsavedMs: 90_000, ...zero }, "ended, not saved yet");
  map.get("a-1").claimed = true;
  assert.equal(busyState(map, now, none).busy, false, "saved: nothing keeps it awake");
  map.set("b-2", { running: false, result: null, events: [] });
  assert.equal(busyState(map, now, none).busy, false, "a job that never started");
  // A BACKGROUND COMMAND still running after the answer (tool 4, part 2), and one that ended that Coder is not told of yet.
  const jobs = new Map([[11, { at: now - 600_000, end: null }], [12, { at: now - 900_000, end: { at: now - 30_000 }, told: false }], [13, { at: now - 900_000, end: { at: now - 30_000 }, told: true }]]);
  assert.deepEqual(busyState(map, now, jobs), { busy: true, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, background: 1, untold: 1, backgroundMs: 600_000, untoldMs: 30_000, bgMaxMs: 7_200_000 });
  assert.deepEqual(W.holdDecision({ background: 1, backgroundMs: 90 * 60_000 }), { hold: true, why: "background" });
  assert.deepEqual(W.holdDecision({ background: 1, backgroundMs: W.BG_HOLD_MS + 1 }), { hold: false, why: "stuck" }, "past its longest time limit");
  assert.deepEqual(W.holdDecision({ untold: 1, untoldMs: 60_000 }), { hold: true, why: "untold" });
  assert.deepEqual(W.holdDecision({ untold: 1, untoldMs: W.TELL_WAIT_MS + 1 }), { hold: false, why: "stuck" });
  assert.deepEqual(W.holdDecision({ background: 1 }), { hold: false, why: "unreadable" });
  // What Coder's Worker decides from it.
  assert.deepEqual(W.holdDecision(null), { hold: false, why: "no-answer" }, "a machine that does not answer sleeps");
  assert.deepEqual(W.holdDecision({ busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0 }), { hold: false, why: "idle" });
  assert.deepEqual(W.holdDecision({ working: 1, workingMs: 44 * 60_000 }), { hold: true, why: "working" });
  assert.deepEqual(W.holdDecision({ working: 1, workingMs: W.HOLD_MAX_MS + 1 }), { hold: false, why: "stuck" }, "past 2 hours");
  assert.deepEqual(W.holdDecision({ working: 0, unsaved: 1, unsavedMs: 60_000 }), { hold: true, why: "unsaved" });
  assert.deepEqual(W.holdDecision({ unsaved: 1, unsavedMs: W.SAVE_WAIT_MS + 1 }), { hold: false, why: "stuck" }, "nobody saved it in 30 minutes");
  assert.deepEqual(W.holdDecision({ working: 1, workingMs: W.HOLD_MAX_MS + 1, unsaved: 1, unsavedMs: 1000 }), { hold: true, why: "unsaved" });
  // Strict, like the old builder's: nothing merely "truthy" keeps a machine (and its bill) going.
  assert.deepEqual(W.holdDecision({ busy: "true", working: "1", workingMs: 5 }), { hold: false, why: "idle" });
  assert.deepEqual(W.holdDecision({ working: 1, workingMs: "5" }), { hold: false, why: "unreadable" });
  assert.deepEqual(W.holdDecision({ working: 1 }), { hold: false, why: "unreadable" });
  assert.equal(W.HOLD_MAX_MS, 2 * 60 * 60 * 1000);
  assert.equal(W.SAVE_WAIT_MS, 30 * 60 * 1000);
});

test("CD116 the machine's /busy is behind its control key like the rest of its panel, and answers while a job works", async () => {
  const http = await import("node:http");
  const { createApp } = await import("../container/server.mjs");
  const srv = http.createServer(createApp({ env: { CODER_CONTROL_KEY: "k".repeat(32) } }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    assert.equal((await fetch(base + "/busy")).status, 403, "not without the key");
    const r = await fetch(base + "/busy", { headers: { "x-coder-key": "k".repeat(32) } });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(typeof b.busy, "boolean");
    assert.deepEqual(Object.keys(b).sort(), ["background", "backgroundMs", "bgMaxMs", "busy", "idleMs", "unsaved", "unsavedMs", "untold", "untoldMs", "working", "workingMs"]);
  } finally { await new Promise((r) => srv.close(r)); }
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const t = \{ running: true, stop: false, events: \[\], result: null, fg: new Set\(\), started: Date\.now\(\), resume: null, queue: \[\], mode: normMode\(body\.mode\), answers: new Map\(\), asking: "" \};/);
  assert.match(server, /t\.ended = Date\.now\(\);\n\s+t\.running = false;/);
  assert.match(server, /if \(want && req\.headers\["x-coder-key"\] !== want\) return send\(403, \{ error: "not allowed" \}\);[\s\S]{0,300}if \(url\.pathname === "\/busy" && req\.method === "GET"\) return send\(200, \{ \.\.\.busyState\(turns\), idleMs: Math\.max\(0, Date\.now\(\) - lastAsked\) \}\);/, "after the key check");
});

test("CD117 wiring: before the machine sleeps, Coder's container asks it (with its key, for 5 seconds at most) and stops it only when the decision says so", () => {
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /import \{ runWatchedJobs, runBackgroundJobs, holdDecision, BUSY_PROBE_MS, handleWake, WAKE_PATH \} from "\.\/src\/coder-watch\.mjs";/);
  // Every minute too: background commands that ended get Coder told, in a turn of its own (tool 4, part 2).
  assert.match(worker, /job\(runBackgroundJobs\(env, \{ coder \}\)\.catch\(/);
  assert.match(worker, /async onActivityExpired\(\) \{\n\s+if \(!this\.container\.running\) return;/);
  assert.match(worker, /this\.containerFetch\(new Request\("http:\/\/coder\/busy", \{ headers: this\.controlKey \? \{ "x-coder-key": this\.controlKey \} : \{\} \}\), this\.defaultPort\)/);
  assert.match(worker, /Promise\.race\(\[ask, new Promise\(\(ok\) => setTimeout\(\(\) => ok\(null\), BUSY_PROBE_MS\)\)\]\)/);
  assert.match(worker, /const d = holdDecision\(state\);[\s\S]{0,200}if \(d\.hold\) return;\n\s+await this\.stop\(\);/);
  assert.match(worker, /this\.controlKey = env\.CODER_TOKEN_KEY \? controlKeySync\(env\.CODER_TOKEN_KEY\) : "";/);
  assert.match(worker, /sleepAfter = "10m";/, "an idle machine still sleeps after 10 minutes");
});

test("CD123 closing the tab while the machine sets up (clone, setup script) loses nothing: the chat says \"running\" and the job is watched before the machine is asked; a start that fails leaves the chat as it was; a machine still waking up is not taken for lost; Stop pressed meanwhile stops the machine too", async () => {
  const W = await import("../src/coder-watch.mjs");
  const R = await import("../src/coder-routes.mjs");
  const { handleCoder } = R;
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-s1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  const before = { id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 0, saved: 0, status: "idle", at: 1000 };
  await bucket.put(mk, JSON.stringify(before));
  let during = null, answer = () => Response.json({ ok: true }); const seen = [];
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname; seen.push(p);
    // What the chat says while the machine is still setting up.
    if (p === "/turn") { const body = await req.json(); during = { meta: JSON.parse(bucket.m.get(mk)), watched: bucket.m.has(W.watchKey(uid, id, 1)) }; return answer(body); }
    if (p === "/state") return Response.json({ status: "idle", events: [], running: false });
    return Response.json({ ok: true, running: false });
  } });
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box });
  // A START THAT FAILS (the clone failed, after a first step was already sent as it went): the chat is as it was.
  const { handleLive } = await import("../src/coder-live.mjs");
  answer = async (body) => {
    const l = body.live;
    const sentAsItWent = await handleLive(new Request(l.url, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": l.chat, "x-coder-turn": String(l.turn), "x-coder-live": l.pass }, body: JSON.stringify({ from: 0, events: [{ type: "bash", tool: "setup" }] }) }), env);
    assert.equal(sentAsItWent.status, 200, "the job counts as running during the setup, so its steps are taken");
    return Response.json({ error: "clone failed" }, { status: 502 });
  };
  const bad = await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "go" }) });
  assert.equal(bad.status, 502);
  assert.equal(during.meta.status, "running", "running while the machine set up");
  assert.equal(during.watched, true, "watched while the machine set up");
  assert.deepEqual(JSON.parse(bucket.m.get(mk)), before, "as it was");
  assert.equal(bucket.m.has(W.watchKey(uid, id, 1)), false);
  assert.equal([...bucket.m.keys()].some((k) => k.includes("/live/")), false, "nothing it sent is left");
  // A START THAT WORKS: running and watched before the machine was asked (so a closed tab loses nothing).
  answer = () => Response.json({ ok: true });
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "go" }) })).status, 200);
  assert.deepEqual([during.meta.status, during.meta.turn, during.watched], ["running", 1, true]);
  // A MACHINE STILL WAKING UP (it does not have the job yet) is not taken for lost in the first minutes.
  const st = await (await go("projects/" + id + "/state?since=0")).json();
  assert.equal(st.running, true);
  assert.equal(JSON.parse(bucket.m.get(mk)).status, "running");
  await bucket.put(mk, JSON.stringify({ ...JSON.parse(bucket.m.get(mk)), at: Date.now() - R.START_GRACE_MS - 1000 }));
  assert.equal((await (await go("projects/" + id + "/state?since=0")).json()).running, false, "after 3 minutes it is");
  assert.equal(R.START_GRACE_MS, 8 * 60 * 1000, "8 minutes: a new or updated machine first fetches Coder's image (up to 5 minutes, FLY_PULL_MS)");
  // STOP PRESSED WHILE THE MACHINE SET UP: the chat is freed, and the machine is told to stop the job it then started.
  answer = async () => { await go("projects/" + id + "/stop", { method: "POST", body: "{}" }); return Response.json({ ok: true }); };
  seen.length = 0;
  const r = await (await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "again" }) })).json();
  assert.equal(r.project.status, "idle");
  assert.deepEqual(seen.filter((p) => p === "/stop").length, 2, "Stop's own, then once the machine had the job");
  assert.equal(JSON.parse(bucket.m.get(mk)).status, "idle");
});

test("CD124 (2026-11-06) two environments used with a repo in the same millisecond: the one made later is offered, every time", async () => {
  const { envForRepo } = await import("../src/coder-environments.mjs");
  const list = [{ id: "default", name: "Default", at: 1 }, { id: "shop-1", name: "shop", at: 5, used: 900, repos: ["ana/blog"] }, { id: "testing2-1", name: "testing2", at: 900, repos: ["ana/blog"] }];
  for (let i = 0; i < 5; i++) assert.equal(await envForRepo(fakeBucket(), "u", "ana/blog", list), "testing2-1");
  assert.equal(await envForRepo(fakeBucket(), "u", "ana/blog", [list[0], { ...list[1], used: 901 }, list[2]]), "shop-1", "a later use still wins");
});

test("CD279 (tool 4, part 2) background commands after the answer, on Coder's Worker: kept with the chat when its job ends (listed for the page) and the chat watched; the page's list from the machine, and its Stop; every minute, a chat whose command ended gets a turn only to tell Coder (none while a job runs; none when nothing ended); a chat with none left leaves the watch", async () => {
  const W = await import("../src/coder-watch.mjs");
  const R = await import("../src/coder-routes.mjs");
  const { handleCoder } = R;
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-b1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now() }));
  const job = { id: "job1", desc: "Start the dev server", command: "npm run dev", at: 1000, deadline: 1000 + 30 * 60_000 };
  let machine = { background: [job], untold: 0, running: false };
  const turns = [], stops = [];
  let claimed = false;
  const box = () => ({ fetch: async (req) => {
    const u = new URL(req.url), p = u.pathname;
    if (p === "/state") return Response.json(claimed ? { running: false, events: [], background: machine.background } : { running: false, events: [{ type: "user", text: "go" }], next: 1, result: { status: "done", summary: "Started it.", messages: [], background: [job, { id: "bad id" }] }, background: machine.background });
    if (p === "/claim") { claimed = true; return Response.json({ ok: true }); }
    if (p === "/push") return Response.json({ ok: true, pushed: false, sha: "" });
    if (p === "/bgstate") return Response.json({ ok: true, ...machine });
    if (p === "/bgstop") { const b = await req.json(); stops.push(b); machine = { ...machine, background: [], untold: 1 }; return Response.json({ ok: true }); }
    if (p === "/turn") { const b = await req.json(); turns.push(b); return Response.json({ ok: true }); }
    return Response.json({ ok: true });
  } });
  const coder = (req, user) => handleCoder(req, env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => user, container: box });
  const go = (path, init = {}) => coder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), { id: uid, email: "me@x.y" });
  // The job's end: its background commands kept with the chat (checked), and the chat on the every-minute run's list.
  const st = await (await go("projects/" + id + "/state?since=0")).json();
  assert.deepEqual(st.project.background, [job], "kept, a bad entry left out");
  assert.equal(bucket.m.has(W.bgKey(uid, id)), true, "watched");
  // The page's list: from the machine.
  let bg = await (await go("projects/" + id + "/background")).json();
  assert.deepEqual([bg.ok, bg.background, bg.untold, bg.running], [true, [job], 0, false]);
  // Nothing ended yet: the every-minute run starts nothing, and keeps watching.
  let run = await W.runBackgroundJobs(env, { coder });
  assert.deepEqual(run, { checked: 1, woken: 0, left: 0 });
  assert.equal(turns.length, 0);
  // The page's Stop: the machine stops it; the list is saved with the chat.
  assert.equal((await go("projects/" + id + "/background", { method: "POST", body: JSON.stringify({ id: "job9; rm" }) })).status, 400);
  bg = await (await go("projects/" + id + "/background", { method: "POST", body: JSON.stringify({ id: "job1" }) })).json();
  assert.deepEqual(stops, [{ project: id, id: "job1" }]);
  assert.deepEqual([bg.ok, bg.stopped, bg.background, bg.untold], [true, true, [], 1]);
  assert.deepEqual(JSON.parse(bucket.m.get(mk)).background, []);
  // A job running: no turn of its own yet.
  await bucket.put(mk, JSON.stringify({ ...JSON.parse(bucket.m.get(mk)), status: "running", at: Date.now() }));
  run = await W.runBackgroundJobs(env, { coder });
  assert.deepEqual([run.woken, turns.length], [0, 0]);
  // Idle, and one ended that Coder was not told of: a turn only to tell it, with no message of the owner's.
  await bucket.put(mk, JSON.stringify({ ...JSON.parse(bucket.m.get(mk)), status: "idle", saved: 1 }));
  run = await W.runBackgroundJobs(env, { coder });
  assert.equal(run.woken, 1);
  assert.equal(turns.length, 1);
  assert.deepEqual([turns[0].wake, turns[0].text, turns[0].shown], [true, "", ""]);
  assert.equal(JSON.parse(bucket.m.get(mk)).status, "running");
  // An empty message from the page is still refused (only the every-minute run's wake may be empty).
  await bucket.put(mk, JSON.stringify({ ...JSON.parse(bucket.m.get(mk)), status: "idle", saved: 2 }));
  assert.equal((await go("projects/" + id + "/message", { method: "POST", body: JSON.stringify({ text: "" }) })).status, 400);
  // Told, none left: the chat leaves the list.
  machine = { background: [], untold: 0, running: false };
  run = await W.runBackgroundJobs(env, { coder });
  assert.deepEqual([run.woken, run.left], [0, 1]);
  assert.equal(bucket.m.has(W.bgKey(uid, id)), false);
  // A record past the longest time limit is dropped unread.
  await W.watchBackground(bucket, { uid, email: "me@x.y", id }, Date.now() - W.BG_WATCH_MAX_MS - 1);
  run = await W.runBackgroundJobs(env, { coder });
  assert.deepEqual([run.checked, run.left], [0, 1]);
});

test("CD281 (tool 4, part 3) shell mode on the Worker and the page: a message starting with \"!\" is the owner's own command for the machine (not with pictures or line comments, never from GitHub); \"!\" alone is refused; the page's box says it is shell mode, and the command shows once, as the machine shows it", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-sh1";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  const idle = { id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 1, status: "idle", at: 1000, title: "x" };
  const turns = [];
  const box = () => ({ fetch: async (req) => { if (new URL(req.url).pathname === "/turn") turns.push(await req.json()); return Response.json({ ok: true }); } });
  const go = async (body) => { await bucket.put(mk, JSON.stringify(idle)); return R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box }); };
  assert.equal((await go({ text: "!npm test" })).status, 200);
  assert.deepEqual([turns[0].shell, turns[0].text, turns[0].shown], ["npm test", "", ""]);
  assert.equal((await go({ text: "!" })).status, 400);
  assert.equal((await go({ text: "!  " })).status, 400);
  assert.equal((await go({ text: "! ls", images: [{ type: "image/png", data: "iVBORw0KGgo=" }] })).status, 200);
  assert.equal(turns[1].shell, undefined, "with a picture: a message as before");
  assert.equal((await go({ text: "!ls", fromGithub: true })).status, 200);
  assert.equal(turns[2].shell, undefined, "from GitHub: never a command");
  assert.equal((await go({ text: "fix it! now" })).status, 200);
  assert.equal(turns[3].shell, undefined);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /'<form class="cd-compose' \+ \(\/\^!\/\.test\(S\.draft \|\| ''\) \? ' is-shell' : ''\) \+ '" id="cdForm">'/);
  assert.match(page, /if \(form\) form\.classList\.toggle\('is-shell', \/\^!\/\.test\(input\.value\)\);/);
  assert.match(page, /Shell mode: runs this command on Coder\\'s machine, then Coder answers what it printed/);
  assert.match(page, /const shellText = \/\^!\/\.test\(text\) && !pics\.length && !comments\.length && text\.replace\(\/\^!\\s\*\/, ''\) \? '! ' \+ text\.replace\(\/\^!\\s\*\/, ''\) : '';/);
  assert.match(page, /'<div class="cd-bubble' \+ \(e\.shell \? ' cd-bubble-shell' : ''\) \+ '">'/);
  // The background list above the box (part 2), each with its Stop; asked for every 20 seconds while the chat waits.
  assert.match(page, /const BG_POLL_MS = 20000;/);
  assert.match(page, /return '<div class="cd-composewrap">' \+ bgHTML\(\) \+ mentionHTML\(\)/);
  assert.match(page, /on\('\[data-bg-stop\]', 'click', \(e\) => \{ stopBg\(e\.currentTarget\.dataset\.bgStop, e\.currentTarget\); \}\);/);
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(css, /\.cd-compose\.is-shell \+ \.cd-shellhint \{ display: block; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.cd-bg-dot \{ animation: none; \} \}/);
});
