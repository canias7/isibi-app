// Scheduled work for a published site.
//
// The capability, not a feature: the model can already express "who needs
// reminding tomorrow" as a SELECT. What it cannot do is arrange for that query
// to run tomorrow at nine, or put the result on a wire. Every missing
// integration is that same pair, which is why this is a clock and a wire rather
// than another named verb.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeJob, dueJobs, shapeMessages, runJob,
         MIN_EVERY_MINUTES, MAX_MESSAGES_PER_RUN, MAX_JOBS_PER_TICK } from "../site-jobs.mjs";
import { recipient } from "../site-mail.mjs";
import { normalizeSchema } from "../site-schema.mjs";

const noComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

const JOB = { name: "remind", spec: { fn: "due_tomorrow" }, schedule_minutes: 1440, slug: "barber", last_run: null };
const MSG = { to: "ada@example.com", subject: "Tomorrow at 2pm", body: "<p>See you then.</p>" };

const deps = (over = {}) => {
  const sent = [], stamps = [];
  return {
    sent, stamps,
    d: {
      stamp: async (r) => { stamps.push(r.name); },
      callFn: async () => [MSG],
      credentials: async () => ({ provider: "resend", key: "re_x", from: "hi@barber.example" }),
      send: async (m) => { sent.push(m); return { ok: true, status: 200 }; },
      recipient,
      ...over,
    },
  };
};

// ── what may be declared ─────────────────────────────────────────────────────

test("a job needs a name, a function and an interval", () => {
  assert.deepEqual(normalizeJob({ name: "remind", fn: "due_tomorrow", everyMinutes: 1440 }),
    { name: "remind", fn: "due_tomorrow", everyMinutes: 1440 });
  for (const bad of [{ fn: "f", everyMinutes: 60 }, { name: "r", everyMinutes: 60 },
                     { name: "r", fn: "f" }, { name: "r", fn: "f", everyMinutes: 0 },
                     { name: "r", fn: "_secrets", everyMinutes: 60 }, null, [], "job"]) {
    assert.equal(normalizeJob(bad), null, JSON.stringify(bad));
  }
});

test("too-frequent is CLAMPED to the floor, not refused", () => {
  // Refusing loses the reminder entirely over a number. But the stored value is
  // the real one, so nothing is told it got what it asked for.
  assert.equal(normalizeJob({ name: "r", fn: "f", everyMinutes: 1 }).everyMinutes, MIN_EVERY_MINUTES);
  assert.equal(normalizeJob({ name: "r", fn: "f", everyMinutes: 99999999 }).everyMinutes <= 60 * 24 * 31, true);
});

// ── when it runs ─────────────────────────────────────────────────────────────

const T = Date.parse("2026-08-07T12:00:00Z");

test("a job that has never run is due immediately", () => {
  assert.equal(dueJobs([JOB], T).length, 1);
});

test("a job is not due before its interval, and is due after", () => {
  const at = (mins) => [{ ...JOB, last_run: new Date(T - mins * 60000).toISOString() }];
  assert.equal(dueJobs(at(60), T).length, 0, "an hour into a daily job");
  assert.equal(dueJobs(at(1440), T).length, 1, "exactly a day later");
  // The 30s grace: a 2-minute tick must not skip a slot when ticks land badly.
  assert.equal(dueJobs(at(1439.6), T).length, 1, "29 seconds early still counts");
  assert.equal(dueJobs(at(1439), T).length, 0, "a minute early does not");
});

test("a disabled job never runs", () => {
  assert.equal(dueJobs([{ ...JOB, enabled: false }], T).length, 0);
});

test("an unreadable or FUTURE last_run runs rather than stranding the job", () => {
  // A clock skew that parks a monthly job would park it for weeks, and nothing
  // would say why.
  assert.equal(dueJobs([{ ...JOB, last_run: "not a date" }], T).length, 1);
  assert.equal(dueJobs([{ ...JOB, last_run: new Date(T + 86400000).toISOString() }], T).length, 1);
});

test("one tick is bounded, so a slow site cannot starve the rest", () => {
  const many = Array.from({ length: MAX_JOBS_PER_TICK + 20 }, (_, i) => ({ ...JOB, name: "j" + i }));
  assert.equal(dueJobs(many, T).length, MAX_JOBS_PER_TICK);
});

// ── what the function returned ───────────────────────────────────────────────

test("messages are validated exactly as a form field would be", () => {
  // Computed is not trusted: a function returning two recipients is header
  // injection whoever produced it.
  const got = shapeMessages([MSG, { ...MSG, to: "a@b.com, evil@x.com" }, { ...MSG, subject: "" },
                             { ...MSG, body: "" }, null, "text"], recipient);
  assert.equal(got.messages.length, 1);
  assert.equal(got.dropped, 5);
});

test("a json STRING is parsed — Postgres hands json back either way", () => {
  assert.equal(shapeMessages(JSON.stringify([MSG]), recipient).messages.length, 1);
});

test("nothing to do is the normal case, not a failure", () => {
  assert.deepEqual(shapeMessages([], recipient), { messages: [], dropped: 0, overflow: 0, bad: null });
});

test("a function returning the wrong shape says so rather than sending", () => {
  for (const bad of [null, undefined, 42, "nonsense", { rows: [] }]) {
    const got = shapeMessages(bad, recipient);
    assert.equal(got.messages.length, 0);
    assert.ok(got.bad, JSON.stringify(bad));
  }
});

test("overflow is REPORTED, never silently capped", () => {
  // A job quietly cut to 100 looks like one that worked, and customer 101 turns
  // up without a reminder.
  const many = Array.from({ length: MAX_MESSAGES_PER_RUN + 5 }, () => MSG);
  const got = shapeMessages(many, recipient);
  assert.equal(got.messages.length, MAX_MESSAGES_PER_RUN);
  assert.equal(got.overflow, 5);
});

// ── running one ──────────────────────────────────────────────────────────────

test("it sends what the function returned", async () => {
  const { sent, d } = deps();
  const out = await runJob(d, JOB);
  assert.equal(out.ok, true);
  assert.equal(out.sent, 1);
  assert.equal(sent[0].to, "ada@example.com");
  assert.equal(sent[0].from, "hi@barber.example");
});

test("STAMPED BEFORE SENDING — a job that dies mid-batch must not mail everyone twice", async () => {
  // The ordering that matters most here. Losing a run is recoverable; sending a
  // reminder four times is not.
  const order = [];
  const { d } = deps({
    stamp: async () => { order.push("stamp"); },
    callFn: async () => { order.push("call"); return [MSG]; },
    send: async () => { order.push("send"); return { ok: true }; },
  });
  await runJob(d, JOB);
  assert.deepEqual(order, ["stamp", "call", "send"]);
});

test("a job whose send throws is still stamped", async () => {
  const { stamps, d } = deps({ send: async () => { throw new Error("provider down"); } });
  const out = await runJob(d, JOB);
  assert.equal(stamps.length, 1, "stamped before the throw");
  assert.equal(out.ok, false);
});

test("it NEVER throws — one bad job must not stop the tick", async () => {
  for (const over of [{ callFn: async () => { throw new Error("sql"); } },
                      { credentials: async () => { throw new Error("vault"); } },
                      { stamp: async () => { throw new Error("supabase"); } }]) {
    const { d } = deps(over);
    const out = await runJob(d, JOB);
    assert.equal(out.ok, false);
    assert.equal(out.reason, "threw");
  }
});

test("no key means the job runs and sends nothing, quietly", async () => {
  const { sent, d } = deps({ credentials: async () => null });
  const out = await runJob(d, JOB);
  assert.equal(out.ok, true);
  assert.equal(out.sent, 0);
  assert.equal(sent.length, 0);
});

test("the key is resolved ONCE for the batch, not per message", async () => {
  let loads = 0;
  const { d } = deps({
    callFn: async () => Array.from({ length: 20 }, () => MSG),
    credentials: async () => { loads++; return { provider: "resend", key: "k", from: "a@b.com" }; },
  });
  await runJob(d, JOB);
  assert.equal(loads, 1, "a hundred reminders must not be a hundred decryptions");
});

test("a spec with no function sends nothing and is not stamped", async () => {
  const { stamps, sent, d } = deps();
  const out = await runJob(d, { ...JOB, spec: {} });
  assert.equal(out.ok, false);
  assert.equal(stamps.length, 0, "an unrunnable job must stay due, not be marked done");
  assert.equal(sent.length, 0);
});

// ── reachable, end to end ────────────────────────────────────────────────────

test("THE CHAIN: a job is declarable and reaches the runner", () => {
  // RAW, not comment-blanked. Blanking /* */ across worker.js eats from any /*
  // inside a string or regex to the next */ — it swallowed this very call site
  // and reported it missing. Every pattern below carries a "(" so it cannot
  // match prose.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const tool = worker.slice(worker.indexOf('name: "design_schema"'), worker.indexOf('tool_choice: { type: "tool", name: "design_schema" }'));

  // 1. declarable — and the internal flag too, or the cross-reference below
  //    drops every job the model writes.
  assert.match(tool, /jobs: \{/, "the designer must offer jobs");
  assert.match(tool, /internal: \{ type: "boolean"/, "and the internal flag its function needs");

  // 2. survives the normaliser, only when the function exists AND is internal
  const F = { name: "due_tomorrow", returns: "json", language: "sql", body: "SELECT 1", internal: true, args: [] };
  const J = { name: "remind", fn: "due_tomorrow", everyMinutes: 1440 };
  const T2 = [{ name: "b", access: "collect", columns: ["e"] }];
  assert.deepEqual(normalizeSchema({ tables: T2, functions: [F], jobs: [J] }).jobs, [J]);
  assert.equal(normalizeSchema({ tables: T2, jobs: [J] }).jobs, undefined, "no such function");
  assert.equal(normalizeSchema({ tables: T2, functions: [{ ...F, internal: false }], jobs: [J] }).jobs, undefined,
    "a function a visitor can call must not be a job");

  // 3. persisted at build time
  assert.match(worker, /persistSiteJobs\(env, uid, slug, jobs\)/, "the apply path must register them");
  // 4. drained by the cron
  assert.match(worker, /ctx\.waitUntil\(runScheduledSiteJobs\(env, ctx\)\)/, "the cron must drive it");
  assert.match(worker, /runJob\(\{/, "and it must call the runner");
});

test("the runner re-reads the SCHEMA, not just the registry row", () => {
  // Nothing auto-deletes a job row, so a revise that drops a job leaves it
  // registered. Trusting the row would keep mailing customers from a job the
  // site no longer declares.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const fn = worker.slice(worker.indexOf("async function runScheduledSiteJobs"), worker.indexOf("// ── Website Builder"));
  assert.match(fn, /loadSiteSchema\(conn\)/, "it must read the site's own schema");
  assert.match(fn, /declared/, "and skip a job the schema no longer declares");
});

test("THE EIGHT-VERB RUNNER IS GONE, and stays gone", () => {
  // `read save fetch ai email notify checkout respond` — a fixed menu, so the
  // model could only ever do what somebody imagined in advance. Its replacement
  // names ONE model-written function; a different kind of scheduled work is
  // different SQL, not a ninth verb.
  // RAW again, for the same reason. A name followed by "(" is a call or a
  // definition and cannot be prose — which also means this keeps working when
  // somebody mentions the old runner in a comment explaining why it went.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  assert.equal(/runSiteFunction\s*\(/.test(worker), false, "the verb runner must not come back");
  for (const dead of ["resolveTempl", "resolveStr", "createNotification", "ensureNotifications", "loadSiteSecrets"]) {
    assert.equal(new RegExp("\\b" + dead + "\\s*\\(").test(worker), false, dead + " was only reachable from the verb runner");
  }
  // And the replacement must not have grown one: a step list is the tell.
  const jobs = noComments(fs.readFileSync(path.join(import.meta.dirname, "..", "site-jobs.mjs"), "utf8"));
  for (const v of ["st.do", "steps", "checkout", "respond"]) {
    assert.equal(jobs.includes(v), false, "site-jobs must not grow a step menu: " + v);
  }
});
