// A GITHUB JOB IS STARTED BY THE EVERY-MINUTE CHECK (live test, 2026-11-07: the
// "On it" comment on testingforclaude #2 never changed). Cloudflare cancels what
// still runs 30 seconds after GitHub's call is answered, and the job's start took
// minutes (its machine first fetched Coder's 6.9 GB image), so the job's record was
// never made. Now the record is made first; the every-minute check starts the job.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

const M = await import("../src/coder-mentions.mjs");
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), truncated: false }; } };
}
const JOBS = "coder/github-jobs/";
const queued = (o = {}) => ({ uid: "u1", email: "me@x.y", id: "shop-1", repo: "ana/shop", number: 5, login: "ana", installation: 7, ackId: 900, at: 1000, start: { text: "From GitHub: do it", fromGithub: true, shown: "@ana on GitHub: do it" }, ...o });
function github() {
  const said = [];
  const fetchFn = async (url, init = {}) => {
    if (/access_tokens$/.test(url)) return new Response(JSON.stringify({ token: "ghs_app" }), { status: 201 });
    said.push([init.method || "GET", String(url).replace("https://api.github.com", ""), init.body ? JSON.parse(init.body).body : null]);
    return new Response(JSON.stringify({ id: 1 }), { status: 200 });
  };
  return { said, fetchFn };
}
const env = (bucket) => ({ CODER_USERS: "me@x.y", CODER_BUCKET: bucket, CODER_GITHUB_APP_ID: "1", CODER_GITHUB_APP_PRIVATE_KEY: privateKey });

test("CD144 a GitHub job is started by the every-minute check: a slow start (a machine fetching Coder's image) is never sent twice; a failed start is told in the \"On it\" comment; one start per chat at a time; a check cut off mid-start is caught", async () => {
  // A SLOW START: the machine first fetches Coder's image. The next minute's check leaves it alone.
  const b = fakeBucket(), g = github();
  await b.put(JOBS + "u1__shop-1__900.json", JSON.stringify(queued()));
  const posts = [];
  let release;
  const slow = new Promise((ok) => { release = ok; });
  const coder = async (req, who) => {
    const u = new URL(req.url);
    if (req.method === "POST") { posts.push([u.pathname, await req.json(), who.id]); await slow; return Response.json({ ok: true }); }
    if (u.pathname.endsWith("/state")) return Response.json({ running: true });
    return Response.json({ ok: true, project: { id: "shop-1" } });
  };
  const first = M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }, 60_000);
  for (let i = 0; i < 50 && !posts.length; i++) await new Promise((ok) => setTimeout(ok, 5));
  assert.deepEqual(posts, [["/api/coder/projects/shop-1/message", { text: "From GitHub: do it", fromGithub: true, shown: "@ana on GitHub: do it" }, "u1"]], "the message, as the person who asked");
  assert.equal(JSON.parse(b.m.get(JOBS + "u1__shop-1__900.json")).starting, 60_000, "claimed before it is sent");
  assert.deepEqual(await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }, 120_000), { finished: 0, started: 0 }, "the next minute: still being started, left alone");
  assert.equal(posts.length, 1, "never sent twice");
  release();
  assert.deepEqual(await first, { finished: 0, started: 1 });
  const rec = JSON.parse(b.m.get(JOBS + "u1__shop-1__900.json"));
  assert.equal("start" in rec || "starting" in rec, false, "started: the record now follows the job");
  assert.equal(rec.at, 60_000, "its 2 hours count from its start");
  assert.deepEqual(g.said, [], "nothing said on GitHub yet");
  assert.deepEqual(await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }, 180_000), { finished: 0, started: 0 }, "running: nothing to say");

  // A START THAT FAILS: said in place of "On it", and the record goes.
  const b2 = fakeBucket(), g2 = github();
  await b2.put(JOBS + "u1__shop-1__901.json", JSON.stringify(queued({ ackId: 901 })));
  const refuse = async (req) => (req.method === "POST" ? Response.json({ error: "Coder could not open ana/shop (502: no machine)" }, { status: 502 }) : Response.json({ ok: true }));
  assert.deepEqual(await M.runMentionJobs(env(b2), { coder: refuse, fetchFn: g2.fetchFn }), { finished: 1, started: 0 });
  assert.deepEqual(g2.said, [["PATCH", "/repos/ana/shop/issues/comments/901", "@ana Coder could not start: Coder could not open ana/shop (502: no machine)"]]);
  assert.equal([...b2.m.keys()].filter((k) => k.startsWith(JOBS)).length, 0);

  // TWO @CODERS IN A ROW ON ONE CHAT: one start per check; the next finds Coder busy and says so.
  const b3 = fakeBucket(), g3 = github();
  await b3.put(JOBS + "u1__shop-1__902.json", JSON.stringify(queued({ ackId: 902 })));
  await b3.put(JOBS + "u1__shop-1__903.json", JSON.stringify(queued({ ackId: 903 })));
  let busy = false;
  const sent3 = [];
  const one = async (req) => {
    if (req.method === "POST") { sent3.push(new URL(req.url).pathname); if (busy) return Response.json({ error: "Coder is still working on the last message" }, { status: 409 }); busy = true; return Response.json({ ok: true }); }
    return Response.json({ running: true });
  };
  assert.deepEqual(await M.runMentionJobs(env(b3), { coder: one, fetchFn: g3.fetchFn }), { finished: 0, started: 1 });
  assert.equal(sent3.length, 1, "the older comment first, alone");
  assert.ok("start" in JSON.parse(b3.m.get(JOBS + "u1__shop-1__903.json")), "the other waits");
  assert.deepEqual(await M.runMentionJobs(env(b3), { coder: one, fetchFn: g3.fetchFn }), { finished: 1, started: 0 });
  assert.deepEqual(g3.said, [["PATCH", "/repos/ana/shop/issues/comments/903", "@ana Coder could not start: Coder is still working on the last message"]]);

  // THE CHECK THAT WAS STARTING IT WAS CUT OFF (Cloudflare's 15 minutes): the job goes on if its message went in...
  const b4 = fakeBucket(), g4 = github();
  const t0 = 10_000_000;
  await b4.put(JOBS + "u1__shop-1__904.json", JSON.stringify(queued({ ackId: 904, starting: t0 })));
  const went = async (req) => { if (req.method === "POST") throw new Error("never sent again"); return Response.json({ ok: true, project: { id: "shop-1", status: "running", at: t0 + 5000 } }); };
  assert.deepEqual(await M.runMentionJobs(env(b4), { coder: went, fetchFn: g4.fetchFn }, t0 + M.START_STALE_MS - 1), { finished: 0, started: 0 }, "not yet: it may still be starting");
  assert.deepEqual(await M.runMentionJobs(env(b4), { coder: went, fetchFn: g4.fetchFn }, t0 + M.START_STALE_MS + 1), { finished: 0, started: 0 });
  assert.equal("start" in JSON.parse(b4.m.get(JOBS + "u1__shop-1__904.json")), false, "it went in: the job goes on");
  assert.deepEqual(g4.said, []);
  // ... and if it did not, Coder says so on GitHub (never a second try that could run it twice).
  await b4.put(JOBS + "u1__shop-1__905.json", JSON.stringify(queued({ ackId: 905, starting: t0 })));
  await b4.delete(JOBS + "u1__shop-1__904.json");
  const lost = async (req) => { if (req.method === "POST") throw new Error("never sent again"); return Response.json({ ok: true, project: { id: "shop-1", status: "idle", at: t0 - 5000 } }); };
  assert.deepEqual(await M.runMentionJobs(env(b4), { coder: lost, fetchFn: g4.fetchFn }, t0 + M.START_STALE_MS + 1), { finished: 1, started: 0 });
  assert.deepEqual(g4.said, [["PATCH", "/repos/ana/shop/issues/comments/905", "@ana Coder could not start: starting took too long. Try again."]]);

  // AN AUTO-FIX WITHOUT A PULL REQUEST NUMBER: started the same way; nothing is posted when it ends.
  const b5 = fakeBucket(), g5 = github();
  await b5.put(JOBS + "u1__shop-1__1700000000000.json", JSON.stringify(queued({ number: null, ackId: null, start: { text: "AUTO-FIX", autofix: true, fromGithub: true } })));
  let done = false;
  const fix = async (req) => { if (req.method === "POST") return Response.json({ ok: true }); return Response.json(new URL(req.url).pathname.endsWith("/state") ? { running: !done } : { ok: true, project: { id: "shop-1" }, events: [] }); };
  assert.deepEqual(await M.runMentionJobs(env(b5), { coder: fix, fetchFn: g5.fetchFn }), { finished: 0, started: 1 });
  done = true;
  assert.deepEqual(await M.runMentionJobs(env(b5), { coder: fix, fetchFn: g5.fetchFn }), { finished: 1, started: 0 });
  assert.deepEqual(g5.said, [], "no pull request to answer on");
  assert.equal([...b5.m.keys()].filter((k) => k.startsWith(JOBS)).length, 0);
});

test("CD-B20c a GitHub job's comment carries its own turn's answer, never a later turn's; a job whose turn ended is posted while the next turn runs", async () => {
  const b = fakeBucket(), g = github();
  await b.put(JOBS + "u1__shop-1__910.json", JSON.stringify(queued({ ackId: 910 })));
  let turn = 4, running = false;
  const events = [];
  const coder = async (req) => {
    const u = new URL(req.url);
    if (req.method === "POST") { turn = 5; running = true; events.push({ type: "user", at: Date.now(), text: "From GitHub" }); return Response.json({ ok: true, project: { id: "shop-1", turn } }); }
    if (u.pathname.endsWith("/state")) return Response.json({ running, project: { id: "shop-1", turn, status: running ? "running" : "idle" } });
    return Response.json({ ok: true, project: { id: "shop-1", turn }, events });
  };
  assert.deepEqual(await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }), { finished: 0, started: 1 });
  assert.equal(JSON.parse(b.m.get(JOBS + "u1__shop-1__910.json")).turn, 5);
  // The GitHub turn ends; a private message starts turn 6 before the check runs.
  events.push({ type: "done", at: Date.now(), text: "Public answer" });
  events.push({ type: "user", at: Date.now() + 1, text: "private" }, { type: "done", at: Date.now() + 2, text: "PRIVATE ANSWER" });
  turn = 6; running = true;
  assert.deepEqual(await M.runMentionJobs(env(b), { coder, fetchFn: g.fetchFn }), { finished: 1, started: 0 });
  assert.match(g.said[0][2], /Public answer/);
  assert.doesNotMatch(g.said[0][2], /PRIVATE/);
});

test("CD-B20d an @coder answer GitHub refused once is kept and posted the next minute", async () => {
  const b = fakeBucket();
  let fail = 1;
  const said = [];
  const fetchFn = async (url, init = {}) => {
    if (/access_tokens$/.test(url)) return new Response(JSON.stringify({ token: "ghs_app" }), { status: 201 });
    if (fail-- > 0) return new Response("{}", { status: 502 });
    said.push(JSON.parse(init.body).body);
    return new Response("{}", { status: 200 });
  };
  const now = Date.now();
  await b.put(JOBS + "u1__shop-1__920.json", JSON.stringify({ ...queued({ ackId: 920, at: now }), start: undefined }));
  const coder = async (req) => (new URL(req.url).pathname.endsWith("/state") ? Response.json({ running: false }) : Response.json({ ok: true, project: { id: "shop-1" }, events: [{ type: "user", at: 1 }, { type: "done", at: 2, text: "All set" }] }));
  assert.deepEqual(await M.runMentionJobs(env(b), { coder, fetchFn }, now + 1000), { finished: 0, started: 0 });
  assert.ok(b.m.has(JOBS + "u1__shop-1__920.json"), "kept");
  assert.deepEqual(await M.runMentionJobs(env(b), { coder, fetchFn }, now + 61_000), { finished: 1, started: 0 });
  assert.match(said[0], /All set/);
  assert.equal(b.m.has(JOBS + "u1__shop-1__920.json"), false);
});
