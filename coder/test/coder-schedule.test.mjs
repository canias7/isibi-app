// Claude Code's CronCreate, CronDelete, CronList, ScheduleWakeup and RemoteTrigger in Coder (2026-11-23):
// container/coder-schedule.mjs (the tools) and src/coder-schedules.mjs (the Worker keeps them and starts the runs).
// No model calls: the runs go to a fake deps.coder.
import test from "node:test";
import assert from "node:assert/strict";
import { parseCron, nextCron, cronWords, cronLimits, CRON_DEFAULTS, cronState, cronResult, cronTool, CRON_TOOLS, CRON_TOOL_NAMES, checkWakeup, cronRunText } from "../container/coder-schedule.mjs";
import { DEFERRED_TOOLS, SEARCH_HINTS } from "../container/coder-toolsearch.mjs";
import { CODER_TOOLS, NOT_FROM_GITHUB, GITHUB_TOOLS } from "../container/coder-agent.mjs";
import { ccTool } from "../container/coder-hooks.mjs";
import { applyCronTurn, runCoderCrons, readCrons, readTriggers, cronTurnOn, CRON_DUE } from "../src/coder-schedules.mjs";

const T0 = Date.UTC(2026, 10, 23, 10, 0, 0);
const MIN = 60_000;

function fakeBucket() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
  };
}

test("cron parsing and next times", () => {
  assert.equal(nextCron("*/5 * * * *", T0), T0 + 5 * MIN);
  assert.equal(nextCron("0 9 * * 1-5", T0), Date.UTC(2026, 10, 24, 9, 0));
  assert.throws(() => parseCron("* * *"), /5 fields/);
  assert.throws(() => parseCron("61 * * * *"), /minute/);
  assert.equal(cronWords("*/5 * * * *"), "every 5 minutes");
});

test("the tools: names, Claude Code names, upfront and held back, not from GitHub", () => {
  assert.deepEqual(CRON_TOOL_NAMES, ["schedule_wakeup", "cron_create", "cron_delete", "cron_list", "remote_trigger"]);
  for (const n of CRON_TOOL_NAMES) assert.ok(CODER_TOOLS.some((t) => t.function.name === n), n);
  assert.ok(!DEFERRED_TOOLS.includes("schedule_wakeup"));
  for (const n of ["cron_create", "cron_delete", "cron_list", "remote_trigger"]) { assert.ok(DEFERRED_TOOLS.includes(n), n); assert.ok(SEARCH_HINTS[n], n); }
  assert.equal(ccTool("cron_create"), "CronCreate");
  assert.equal(ccTool("schedule_wakeup"), "ScheduleWakeup");
  assert.equal(ccTool("remote_trigger"), "RemoteTrigger");
  for (const n of CRON_TOOL_NAMES) { assert.ok(NOT_FROM_GITHUB.includes(n)); assert.ok(!GITHUB_TOOLS.some((t) => t.function.name === n)); }
  // The caps are stated in the descriptions.
  const d = (n) => CRON_TOOLS.find((t) => t.function.name === n).function.description;
  assert.match(d("cron_create"), /at most 10 active crons/);
  assert.match(d("cron_create"), /at most 24 scheduled runs a day/);
  assert.match(d("cron_create"), /effort low/);
  assert.match(d("remote_trigger"), /at most once an hour/);
  assert.match(d("schedule_wakeup"), /\[60, 3600\]/);
});

test("caps: defaults and the owner's variables", () => {
  assert.deepEqual(cronLimits({}), { max: 10, minMinutes: 1, runsPerDay: 24, triggerMinHours: 1, triggerMax: 10, effort: "low" });
  assert.equal(CRON_DEFAULTS.max, 10);
  const l = cronLimits({ CODER_CRON_MAX: "3", CODER_CRON_RUNS_PER_DAY: "5", CODER_CRON_MIN_MINUTES: "10", CODER_TRIGGER_MIN_HOURS: "2", CODER_CRON_EFFORT: "medium" });
  assert.deepEqual([l.max, l.runsPerDay, l.minMinutes, l.triggerMinHours, l.effort], [3, 5, 10, 2, "medium"]);
  assert.equal(cronLimits({ CODER_CRON_MAX: "-1", CODER_CRON_EFFORT: "max" }).max, 10);
  assert.equal(cronLimits({ CODER_CRON_EFFORT: "max" }).effort, "low");
});

test("cron_create, cron_list, cron_delete in a turn, within the cap of crons", () => {
  const st = cronState({ limits: { max: 2 } });
  const a = cronTool(st, "cron_create", { cron: "*/5 * * * *", prompt: "check the build" }, T0);
  assert.match(a, /^Scheduled [0-9a-f]{8} \(every 5 minutes\)/);
  const id = st.adds[0].id;
  cronTool(st, "cron_create", { cron: "30 14 28 2 *", prompt: "remind me", recurring: false }, T0);
  assert.match(cronTool(st, "cron_create", { cron: "* * * * *", prompt: "x" }, T0), /^Error: this chat already has 2/);
  assert.match(cronTool(st, "cron_list", {}, T0), new RegExp(id));
  assert.equal(cronTool(st, "cron_delete", { id }, T0), "Cancelled job " + id + ".");
  assert.match(cronTool(st, "cron_delete", { id: "nope" }, T0), /^Error: no scheduled job/);
  assert.equal(cronResult(st).cronAdds.length, 1);
  assert.match(cronTool(st, "cron_create", { cron: "bad", prompt: "x" }, T0), /^Error: cron/);
  assert.match(cronTool(st, "cron_create", { cron: "* * * * *" }, T0), /^Error: prompt/);
  // A minimum gap the owner set.
  const st2 = cronState({ limits: { minMinutes: 10 } });
  assert.match(cronTool(st2, "cron_create", { cron: "*/5 * * * *", prompt: "x" }, T0), /at most once every 10 minutes/);
});

test("schedule_wakeup clamps to 60-3600 seconds and stops", () => {
  assert.equal(checkWakeup({ delaySeconds: 5, prompt: "p", reason: "r" }, T0).seconds, 60);
  assert.equal(checkWakeup({ delaySeconds: 99999, prompt: "p", reason: "r" }, T0).seconds, 3600);
  const st = cronState({});
  assert.match(cronTool(st, "schedule_wakeup", { delaySeconds: 1200, prompt: "/loop check", reason: "build is long" }, T0), /^Next wake-up in 1200s/);
  assert.equal(cronResult(st).wakeup.at, T0 + 1200_000);
  assert.match(cronTool(st, "schedule_wakeup", { stop: true }, T0), /cancelled/);
  assert.deepEqual(cronResult(st).wakeup, { stop: true });
  assert.match(cronTool(st, "schedule_wakeup", { delaySeconds: 100 }, T0), /^Error: prompt/);
});

test("remote_trigger: hourly at most, list, update, run; unsupported actions", () => {
  const st = cronState({ repo: "o/r" });
  assert.match(cronTool(st, "remote_trigger", { action: "create", body: { name: "x", cron_expression: "*/30 * * * *", prompt: "p" } }, T0), /at most once every hour/);
  const made = cronTool(st, "remote_trigger", { action: "create", body: { name: "PR review", cron_expression: "0 9 * * 1-5", prompt: "review PRs" } }, T0);
  assert.match(made, /^Created trig_[0-9a-z]{12}: “PR review”, every weekday at 09:00 UTC, in o\/r/);
  const id = st.triggerOps[0].id;
  assert.equal(JSON.parse(cronTool(st, "remote_trigger", { action: "list" }, T0)).data[0].id, id);
  assert.match(cronTool(st, "remote_trigger", { action: "update", trigger_id: id, body: { enabled: false } }, T0), /disabled/);
  assert.match(cronTool(st, "remote_trigger", { action: "run", trigger_id: id }, T0), /starts in a new chat/);
  assert.match(cronTool(st, "remote_trigger", { action: "get_run_log", trigger_id: id }, T0), /not available in Coder/);
  assert.match(cronTool(st, "remote_trigger", { action: "get", trigger_id: "trig_zzzzzzzzzzzz" }, T0), /^Error: trigger_id/);
});

function deps(calls, status = 200) {
  return { coder: async (req, who) => { const body = await req.json(); calls.push({ url: req.url, body, who }); const proj = req.url.endsWith("/projects"); return new Response(JSON.stringify(proj ? { project: { id: "newchat1" } } : { ok: true }), { status }); } };
}

test("Worker: a turn's crons kept; due runs start when idle, at effort low; busy waits; daily cap", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket, CODER_CRON_RUNS_PER_DAY: "2" };
  await bucket.put("coder/u1/chat1/meta.json", JSON.stringify({ status: "idle" }));
  const st = cronState({});
  cronTool(st, "cron_create", { cron: "* * * * *", prompt: "tick" }, T0);
  const r = await applyCronTurn(env, bucket, "u1", "a@b.c", "chat1", cronResult(st), "o/r", T0);
  assert.equal(r.crons, 1);
  assert.ok(bucket.m.has(CRON_DUE + "u1/chat1.json"));
  const on = await cronTurnOn(env, bucket, "u1", "chat1");
  assert.equal(on.crons.length, 1);
  assert.equal(on.limits.runsPerDay, 2);

  const calls = [];
  // Busy: waits.
  await bucket.put("coder/u1/chat1/meta.json", JSON.stringify({ status: "running" }));
  assert.equal((await runCoderCrons(env, deps(calls), T0 + MIN)).waiting, 1);
  assert.equal(calls.length, 0);
  await bucket.put("coder/u1/chat1/meta.json", JSON.stringify({ status: "idle" }));
  assert.equal((await runCoderCrons(env, deps(calls), T0 + MIN)).started, 1);
  assert.equal(calls[0].body.effort, "low");
  assert.match(calls[0].body.text, /tick$/);
  assert.equal(calls[0].who.id, "u1");
  await runCoderCrons(env, deps(calls), T0 + 2 * MIN);
  assert.equal(calls.length, 2);
  // The third run that day is skipped (cap 2), with a note in the chat.
  assert.equal((await runCoderCrons(env, deps(calls), T0 + 3 * MIN)).skipped, 1);
  assert.equal(calls.length, 2);
  assert.match(bucket.m.get("coder/u1/chat1/events.json"), /scheduled runs today/);

  // Over the cap of crons: the Worker keeps no more than max, whatever the machine says.
  const st2 = cronState({ limits: { max: 50 } });
  for (let i = 0; i < 12; i++) cronTool(st2, "cron_create", { cron: "0 * * * *", prompt: "p" + i }, T0);
  await applyCronTurn(env, bucket, "u1", "a@b.c", "chat1", cronResult(st2), "o/r", T0);
  assert.equal((await readCrons(bucket, "u1", "chat1")).items.length, 10);
});

test("Worker: a one-shot cron and a wake-up run once, then are gone", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket };
  await bucket.put("coder/u1/c2/meta.json", JSON.stringify({ status: "idle" }));
  const st = cronState({});
  cronTool(st, "cron_create", { cron: "5 10 23 11 *", prompt: "once", recurring: false }, T0);
  cronTool(st, "schedule_wakeup", { delaySeconds: 60, prompt: "/loop go", reason: "soon" }, T0);
  await applyCronTurn(env, bucket, "u1", "e", "c2", cronResult(st), "", T0);
  const calls = [];
  await runCoderCrons(env, deps(calls), T0 + 2 * MIN);
  assert.match(calls[0].body.text, /Self-paced \/loop wake-up/);
  await runCoderCrons(env, deps(calls), T0 + 6 * MIN);
  assert.match(calls[1].body.text, /once$/);
  const d = await readCrons(bucket, "u1", "c2");
  assert.equal(d.items.length + (d.wake ? 1 : 0), 0);
  assert.ok(!bucket.m.has(CRON_DUE + "u1/c2.json"));
});

test("Worker: a cloud scheduled task opens a new chat on its repository", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket };
  const st = cronState({ repo: "o/r" });
  cronTool(st, "remote_trigger", { action: "create", body: { name: "Nightly", cron_expression: "0 2 * * *", prompt: "run the tests" } }, T0);
  const r = await applyCronTurn(env, bucket, "u1", "e", "c3", cronResult(st), "o/r", T0);
  assert.equal(r.triggers, 1);
  const calls = [];
  await runCoderCrons(env, deps(calls), Date.UTC(2026, 10, 24, 2, 0, 30));
  assert.equal(calls[0].body.repo, "o/r");
  assert.match(calls[1].url, /projects\/newchat1\/message$/);
  assert.equal(calls[1].body.effort, "low");
  const t = await readTriggers(bucket, "u1");
  assert.equal(t.items[0].runs[0].result, "started");
  assert.equal(t.items[0].next, Date.UTC(2026, 10, 25, 2, 0));
  assert.match(cronRunText("trigger", t.items[0]), /Cloud scheduled task “Nightly”/);
});
