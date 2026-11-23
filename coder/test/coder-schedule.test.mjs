// Claude Code's CronCreate, CronDelete, CronList, ScheduleWakeup and RemoteTrigger in Coder (2026-11-23):
// container/coder-schedule.mjs (the tools) and src/coder-schedules.mjs (the Worker keeps them and starts the runs).
// No model calls: the runs go to a fake deps.coder.
import test from "node:test";
import assert from "node:assert/strict";
import { parseCron, nextCron, cronWords, cronLimits, CRON_DEFAULTS, cronState, cronResult, cronTool, CRON_TOOLS, CRON_TOOL_NAMES, checkWakeup, cronRunText, jitterMs, zoneOf } from "../container/coder-schedule.mjs";
import { DEFERRED_TOOLS, SEARCH_HINTS } from "../container/coder-toolsearch.mjs";
import { CODER_TOOLS, NOT_FROM_GITHUB, GITHUB_TOOLS } from "../container/coder-agent.mjs";
import { ccTool } from "../container/coder-hooks.mjs";
import { applyCronTurn, runCoderCrons, readCrons, readTriggers, cronTurnOn, runTriggersNow, triggerHookCall, schedulesRoute, CRON_DUE } from "../src/coder-schedules.mjs";

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

const S = 1000;
const out = (s) => JSON.parse(s.slice(s.lastIndexOf("\n") + 1));
const rtOut = (s) => { const o = JSON.parse(s); return { ...o, body: JSON.parse(o.json) }; };

test("cron_create, cron_list, cron_delete in a turn, within the cap of crons; Claude Code's output objects", () => {
  const st = cronState({ limits: { max: 2 } });
  const a = cronTool(st, "cron_create", { cron: "*/5 * * * *", prompt: "check the build" }, T0);
  assert.match(a, /^Scheduled [0-9a-f]{8} \(every 5 minutes, session-only\)/);
  const o = out(a);
  assert.deepEqual(Object.keys(o), ["id", "humanSchedule", "recurring", "durable", "nextFireAt", "maxAgeMs"]);
  assert.equal(o.durable, false);
  assert.equal(o.maxAgeMs, 7 * 86400000);
  // "*/5 * * * *" starts 15 seconds early (4 min 45 s after the last run).
  assert.equal(o.nextFireAt, T0 + 5 * MIN - 15 * S);
  const id = o.id;
  const once = out(cronTool(st, "cron_create", { cron: "30 14 28 2 *", prompt: "remind me", recurring: false, durable: true }, T0));
  assert.equal(once.recurring, false);
  assert.equal(once.durable, true);
  assert.equal(once.maxAgeMs, undefined);
  assert.match(cronTool(st, "cron_create", { cron: "* * * * *", prompt: "x" }, T0), /^Error: this chat already has 2/);
  const list = cronTool(st, "cron_list", {}, T0);
  assert.match(list, new RegExp(id));
  const jobs = out(list).jobs;
  assert.deepEqual(Object.keys(jobs[0]), ["id", "cron", "humanSchedule", "prompt", "recurring", "durable", "nextFireAt"]);
  // nextFireAt is never earlier than the call.
  assert.equal(out(cronTool(st, "cron_list", {}, T0 + 6 * MIN)).jobs[0].nextFireAt, T0 + 6 * MIN);
  assert.equal(cronTool(st, "cron_delete", { id }, T0).split("\n")[0], "Cancelled job " + id + ".");
  assert.deepEqual(out(cronTool(st, "cron_delete", { id: once.id }, T0)), { id: once.id });
  assert.match(cronTool(st, "cron_delete", { id: "nope" }, T0), /^Error: no scheduled job/);
  assert.equal(cronResult(st).cronAdds, undefined);
  assert.match(cronTool(st, "cron_create", { cron: "bad", prompt: "x" }, T0), /^Error: cron/);
  assert.match(cronTool(st, "cron_create", { cron: "* * * * *" }, T0), /^Error: prompt/);
  const st2 = cronState({ limits: { minMinutes: 10 } });
  assert.match(cronTool(st2, "cron_create", { cron: "*/5 * * * *", prompt: "x" }, T0), /at most once every 10 minutes/);
});

test("crons are in the owner's own time zone", () => {
  const st = cronState({ zone: "America/New_York" });
  const o = out(cronTool(st, "cron_create", { cron: "3 9 * * *", prompt: "standup notes" }, T0));
  // 09:03 in New York on 2026-11-23 is 14:03 UTC (EST), late by up to 30 minutes.
  const at = Date.UTC(2026, 10, 23, 14, 3);
  assert.ok(o.nextFireAt >= at && o.nextFireAt <= at + 30 * MIN, String(o.nextFireAt - at));
  assert.equal(o.humanSchedule, "every day at 09:03 America/New_York");
  assert.equal(st.adds[0].tz, "America/New_York");
  assert.equal(nextCron("3 9 * * *", T0, "America/New_York"), at);
  // No zone, or a made-up one: UTC.
  assert.equal(zoneOf(""), "UTC");
  assert.equal(zoneOf("Mars/Base"), "UTC");
  assert.equal(cronState({ zone: "Nope/Nope" }).zone, "UTC");
});

test("jitter as Claude Code's: half the gap, at most 30 minutes; one-shots on :00/:30 up to 90 s early; fixed per job", () => {
  for (let i = 0; i < 40; i++) {
    const id = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    const h = jitterMs(id, "7 * * * *", Date.UTC(2026, 10, 23, 11, 7), true);
    assert.ok(h >= 0 && h <= 30 * MIN);
    const t10 = jitterMs(id, "*/10 * * * *", Date.UTC(2026, 10, 23, 11, 10), true);
    assert.ok(t10 >= 0 && t10 <= 5 * MIN);
    const uneven = jitterMs(id, "0,15 * * * *", Date.UTC(2026, 10, 23, 11, 0), true);
    assert.ok(uneven >= 0 && uneven <= 7.5 * MIN);
    const o = jitterMs(id, "0 9 24 11 *", Date.UTC(2026, 10, 24, 9, 0), false);
    assert.ok(o <= 0 && o >= -90 * S);
    assert.equal(jitterMs(id, "3 9 24 11 *", Date.UTC(2026, 10, 24, 9, 3), false), 0);
    // Evenly spaced: the same delay every time.
    assert.equal(jitterMs(id, "7 * * * *", Date.UTC(2026, 10, 23, 12, 7), true), h);
  }
  assert.equal(jitterMs("abcdef12", "*/5 * * * *", T0, true), -15 * S);
});

test("durable: session-only jobs end with a /clear; durable ones stay", () => {
  const kept = [{ id: "aaaaaaaa", cron: "7 * * * *", prompt: "a", recurring: true, durable: false, next: T0 + 7 * MIN, at: T0 }, { id: "bbbbbbbb", cron: "8 * * * *", prompt: "b", recurring: true, durable: true, next: T0 + 8 * MIN, at: T0 }];
  const st = cronState({ crons: kept, wake: { at: T0 + MIN, prompt: "p", reason: "r" }, cleared: true });
  assert.deepEqual(cronResult(st).cronRemovals, ["aaaaaaaa"]);
  assert.deepEqual(cronResult(st).wakeup, { stop: true });
  assert.deepEqual(out(cronTool(st, "cron_list", {}, T0)).jobs.map((j) => j.id), ["bbbbbbbb"]);
  assert.equal(cronResult(cronState({ crons: kept })).cronRemovals, undefined);
});

test("schedule_wakeup: required fields, clamps to 60-3600 seconds, output object, stop", () => {
  assert.equal(checkWakeup({ delaySeconds: 5, prompt: "p", reason: "r", noop: false }, T0).seconds, 60);
  assert.equal(checkWakeup({ delaySeconds: 99999, prompt: "p", reason: "r", noop: false }, T0).seconds, 3600);
  const st = cronState({});
  assert.match(cronTool(st, "schedule_wakeup", { delaySeconds: 1200, prompt: "/loop check", reason: "build is long" }, T0), /^Error: noop/);
  const r = cronTool(st, "schedule_wakeup", { delaySeconds: 1200, prompt: "/loop check", reason: "build is long", noop: false }, T0);
  assert.match(r, /^Next wake-up in 1200s/);
  assert.deepEqual(out(r), { scheduledFor: T0 + 1200_000, clampedDelaySeconds: 1200, wasClamped: false });
  assert.equal(out(cronTool(st, "schedule_wakeup", { delaySeconds: 10, prompt: "/loop check", reason: "soon", noop: true }, T0)).wasClamped, true);
  assert.equal(cronResult(st).wakeup.at, T0 + 60_000);
  const s = cronTool(st, "schedule_wakeup", { stop: true }, T0);
  assert.match(s, /cancelled/);
  assert.equal(out(s).stopped, true);
  assert.equal(out(s).cancelledWakeups, 1);
  assert.equal(out(cronTool(st, "schedule_wakeup", { stop: true }, T0)).cancelledWakeups, 0);
  assert.deepEqual(cronResult(st).wakeup, { stop: true });
  assert.match(cronTool(st, "schedule_wakeup", { delaySeconds: 100 }, T0), /^Error: prompt/);
});

test("remote_trigger: { status, json, summary }; hourly at most; zones; list, update, run, webhook, runs and logs with cursor", () => {
  const st = cronState({ repo: "o/r", zone: "Europe/Paris", base: "https://gofarther.dev" });
  const tooOften = rtOut(cronTool(st, "remote_trigger", { action: "create", body: { name: "x", cron_expression: "*/30 * * * *", prompt: "p" } }, T0));
  assert.equal(tooOften.status, 400);
  assert.match(tooOften.summary, /at most once every hour/);
  const made = rtOut(cronTool(st, "remote_trigger", { action: "create", body: { name: "PR review", cron_expression: "0 9 * * 1-5", prompt: "review PRs" } }, T0));
  assert.equal(made.status, 200);
  assert.match(made.summary, /^Created trig_[0-9a-z]{12}: “PR review”, every weekday at 09:00 Europe\/Paris, in o\/r/);
  assert.equal(made.body.timezone, "Europe/Paris");
  const id = made.body.id;
  // A CRON_TZ= prefix keeps its own zone.
  assert.equal(rtOut(cronTool(st, "remote_trigger", { action: "create", body: { name: "NY", cron_expression: "CRON_TZ=America/New_York 0 9 * * *", prompt: "p" } }, T0)).body.timezone, "America/New_York");
  assert.equal(rtOut(cronTool(st, "remote_trigger", { action: "list" }, T0)).body.data[0].id, id);
  assert.match(rtOut(cronTool(st, "remote_trigger", { action: "update", trigger_id: id, body: { enabled: false } }, T0)).summary, /disabled/);
  assert.equal(rtOut(cronTool(st, "remote_trigger", { action: "update", trigger_id: id }, T0)).status, 400);
  assert.match(rtOut(cronTool(st, "remote_trigger", { action: "run", trigger_id: id, body: { text: "only the auth PRs" } }, T0)).summary, /starts in a new chat/);
  assert.equal(st.triggerOps.at(-1).text, "only the auth PRs");
  // create_webhook_trigger: an inbound address; never a token for the model.
  const hook = rtOut(cronTool(st, "remote_trigger", { action: "create_webhook_trigger", trigger_id: id, body: { source: "api" } }, T0));
  assert.equal(hook.status, 200);
  assert.match(hook.body.url, /^https:\/\/gofarther\.dev\/api\/coder\/trigger-hook\/hook_[0-9a-z]{16}$/);
  assert.doesNotMatch(hook.json, /gfh_/);
  assert.equal(rtOut(cronTool(st, "remote_trigger", { action: "create_webhook_trigger", body: { trigger_id: id, source: "github" } }, T0)).status, 400);
  assert.equal(rtOut(cronTool(st, "remote_trigger", { action: "get", trigger_id: id }, T0)).body.webhook_triggers.length, 1);
  assert.equal(rtOut(cronTool(st, "remote_trigger", { action: "get", trigger_id: "trig_zzzzzzzzzzzz" }, T0)).status, 404);
  // Runs and a run's log, paged with cursor.
  const runs = Array.from({ length: 13 }, (_, i) => ({ at: T0 - (13 - i) * 3600_000, result: "started", via: "schedule", chat: "chat" + i }));
  const st2 = cronState({ triggers: [{ id: "trig_aaaaaaaaaaaa", name: "N", cron: "0 2 * * *", prompt: "p", repo: "o/r", at: T0, runs }], logs: { chat12: Array.from({ length: 50 }, (_, i) => "line " + i) } });
  const p1 = rtOut(cronTool(st2, "remote_trigger", { action: "list_runs", trigger_id: "trig_aaaaaaaaaaaa" }, T0));
  assert.equal(p1.body.data.length, 10);
  assert.equal(p1.body.data[0].session_id, "chat12");
  assert.equal(p1.body.next_cursor, "10");
  assert.equal(rtOut(cronTool(st2, "remote_trigger", { action: "list_runs", trigger_id: "trig_aaaaaaaaaaaa", cursor: "10" }, T0)).body.data.length, 3);
  const log = rtOut(cronTool(st2, "remote_trigger", { action: "get_run_log", session_id: "chat12" }, T0));
  assert.equal(log.body.lines.length, 40);
  assert.equal(rtOut(cronTool(st2, "remote_trigger", { action: "get_run_log", session_id: "chat12", cursor: log.body.next_cursor }, T0)).body.lines[0], "line 40");
  assert.equal(rtOut(cronTool(st2, "remote_trigger", { action: "get_run_log", session_id: "chat3" }, T0)).status, 404);
  assert.equal(rtOut(cronTool(st2, "remote_trigger", { action: "get_run_log" }, T0)).status, 400);
});

function deps(calls, status = 200) {
  return { coder: async (req, who) => { const body = await req.json(); calls.push({ url: req.url, body, who }); const proj = req.url.endsWith("/projects"); return new Response(JSON.stringify(proj ? { project: { id: "newchat1" } } : { ok: true }), { status }); } };
}

test("Worker: a turn's crons kept; due runs start when idle (jitter included), at effort low; busy waits; daily cap", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket, CODER_CRON_RUNS_PER_DAY: "2" };
  await bucket.put("coder/u1/chat1/meta.json", JSON.stringify({ status: "idle" }));
  const st = cronState({});
  cronTool(st, "cron_create", { cron: "* * * * *", prompt: "tick" }, T0);
  const r = await applyCronTurn(env, bucket, "u1", "a@b.c", "chat1", cronResult(st), "o/r", T0);
  assert.equal(r.crons, 1);
  assert.ok(bucket.m.has(CRON_DUE + "u1/chat1.json"));
  const on = await cronTurnOn(env, bucket, "u1", "chat1", "Asia/Tokyo");
  assert.equal(on.crons.length, 1);
  assert.equal(on.limits.runsPerDay, 2);
  assert.equal(on.zone, "Asia/Tokyo");

  const calls = [];
  await bucket.put("coder/u1/chat1/meta.json", JSON.stringify({ status: "running" }));
  assert.equal((await runCoderCrons(env, deps(calls), T0 + MIN + 40 * S)).waiting, 1);
  assert.equal(calls.length, 0);
  await bucket.put("coder/u1/chat1/meta.json", JSON.stringify({ status: "idle" }));
  assert.equal((await runCoderCrons(env, deps(calls), T0 + MIN + 40 * S)).started, 1);
  assert.equal(calls[0].body.effort, "low");
  assert.match(calls[0].body.text, /tick$/);
  assert.equal(calls[0].who.id, "u1");
  // No catch-up: one run, then the next from now.
  assert.equal((await readCrons(bucket, "u1", "chat1")).items[0].next, T0 + 2 * MIN);
  await runCoderCrons(env, deps(calls), T0 + 2 * MIN + 40 * S);
  assert.equal(calls.length, 2);
  assert.equal((await runCoderCrons(env, deps(calls), T0 + 3 * MIN + 40 * S)).skipped, 1);
  assert.equal(calls.length, 2);
  assert.match(bucket.m.get("coder/u1/chat1/events.json"), /scheduled runs today/);

  const st2 = cronState({ limits: { max: 50 } });
  for (let i = 0; i < 12; i++) cronTool(st2, "cron_create", { cron: "0 * * * *", prompt: "p" + i }, T0);
  await applyCronTurn(env, bucket, "u1", "a@b.c", "chat1", cronResult(st2), "o/r", T0);
  assert.equal((await readCrons(bucket, "u1", "chat1")).items.length, 10);
});

test("Worker: an every-5-minutes cron starts 15 s early and isn't run twice", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket };
  await bucket.put("coder/u1/c5/meta.json", JSON.stringify({ status: "idle" }));
  const st = cronState({});
  cronTool(st, "cron_create", { cron: "*/5 * * * *", prompt: "five" }, T0);
  await applyCronTurn(env, bucket, "u1", "e", "c5", cronResult(st), "", T0);
  const calls = [];
  assert.equal((await runCoderCrons(env, deps(calls), T0 + 5 * MIN - 20 * S)).started, 0);
  assert.equal((await runCoderCrons(env, deps(calls), T0 + 5 * MIN - 15 * S)).started, 1);
  assert.equal((await runCoderCrons(env, deps(calls), T0 + 5 * MIN)).started, 0);
  assert.equal((await readCrons(bucket, "u1", "c5")).items[0].fire, T0 + 10 * MIN - 15 * S);
});

test("Worker: a one-shot cron and a wake-up run once, then are gone", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket };
  await bucket.put("coder/u1/c2/meta.json", JSON.stringify({ status: "idle" }));
  const st = cronState({});
  cronTool(st, "cron_create", { cron: "5 10 23 11 *", prompt: "once", recurring: false }, T0);
  cronTool(st, "schedule_wakeup", { delaySeconds: 60, prompt: "/loop go", reason: "soon", noop: false }, T0);
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

test("Worker: a cloud scheduled task opens a new chat on its repository, in its zone; run with text", async () => {
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
  assert.equal(t.items[0].runs[0].via, "schedule");
  assert.equal(t.items[0].next, Date.UTC(2026, 10, 25, 2, 0));
  assert.match(cronRunText("trigger", t.items[0]), /Cloud scheduled task “Nightly”/);
  // get_run_log's lines come with the next turn.
  await bucket.put("coder/u1/newchat1/events.json", JSON.stringify([{ type: "user", text: "run the tests", at: T0 }, { type: "text", text: "All green.", at: T0 }]));
  const on = await cronTurnOn(env, bucket, "u1", "c3");
  assert.deepEqual(on.logs.newchat1.map((l) => l.replace(/^\S+ /, "")), ["user: run the tests", "assistant: All green."]);
  // "run" with text.
  const st3 = cronState({ triggers: on.triggers });
  cronTool(st3, "remote_trigger", { action: "run", trigger_id: t.items[0].id, body: { text: "just the unit tests" } }, T0);
  const r3 = await applyCronTurn(env, bucket, "u1", "e", "c3", cronResult(st3), "o/r", T0);
  await runTriggersNow(env, bucket, deps(calls), "u1", "e", r3.runs, T0);
  assert.match(calls.at(-1).body.text, /TEXT GIVEN WITH THE RUN\njust the unit tests/);
});

test("Worker: a webhook trigger: token made on the page, shown once; calls start runs within the caps", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket, CODER_CRON_RUNS_PER_DAY: "2" };
  const st = cronState({ repo: "o/r" });
  const id = rtOut(cronTool(st, "remote_trigger", { action: "create", body: { name: "Alerts", cron_expression: "0 3 * * *", prompt: "triage the alert" } }, T0)).body.id;
  const url = rtOut(cronTool(st, "remote_trigger", { action: "create_webhook_trigger", trigger_id: id, body: { source: "api" } }, T0)).body.url;
  await applyCronTurn(env, bucket, "u1", "e", "c4", cronResult(st), "o/r", T0);
  const hook = url.split("/").pop();
  const calls = [];
  const call = (token, body, now) => triggerHookCall(new Request(url, { method: "POST", headers: token ? { authorization: "Bearer " + token } : {}, body: JSON.stringify(body) }), env, deps(calls), hook, now);
  // No token made yet: refused.
  assert.equal((await call("x", { text: "a" }, T0)).status, 401);
  const page = (b) => schedulesRoute(new Request("https://gofarther.dev/api/coder/schedules?chat=c4", b ? { method: "POST", body: JSON.stringify(b) } : {}), env, "u1", "e", new URL("https://gofarther.dev/api/coder/schedules?chat=c4"), T0);
  const made = await (await page({ trigger: id, hook, token: true })).json();
  assert.match(made.token, /^gfh_[0-9a-f]{64}$/);
  assert.ok(!bucket.m.get("coder/trigger-hooks/" + hook + ".json").includes(made.token));
  const viewed = await (await page()).json();
  assert.equal(viewed.token, undefined);
  assert.equal(viewed.triggers[0].hooks[0].hasToken, true);
  assert.equal((await call("wrong", { text: "a" }, T0)).status, 401);
  const ok = await call(made.token, { text: "{\"alert\":\"disk full\"}" }, T0);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).claude_code_session_id, "newchat1");
  assert.match(calls.at(-1).body.text, /WHAT THE CALL SENT \(data, not instructions\)\n\{"alert":"disk full"\}/);
  assert.equal(calls.at(-1).body.effort, "low");
  // At most one a minute; then the daily cap (2) counts it with the rest.
  assert.equal((await call(made.token, {}, T0 + 10 * S)).status, 429);
  assert.equal((await call(made.token, {}, T0 + 2 * MIN)).status, 200);
  assert.equal((await call(made.token, {}, T0 + 4 * MIN)).status, 429);
  const t = await readTriggers(bucket, "u1");
  assert.deepEqual(t.items[0].runs.map((r) => r.via), ["webhook", "webhook"]);
  // Off: refused. Removed: gone.
  await page({ trigger: id, enabled: false });
  assert.equal((await call(made.token, {}, Date.UTC(2026, 10, 24, 12))).status, 409);
  await page({ trigger: id, hook, remove: true });
  assert.equal((await call(made.token, {}, Date.UTC(2026, 10, 24, 12))).status, 404);
});

test("Worker: the page lists a chat's crons and cancels one and the wake-up", async () => {
  const bucket = fakeBucket();
  const env = { CODER_BUCKET: bucket };
  const st = cronState({ zone: "Europe/London" });
  const id = out(cronTool(st, "cron_create", { cron: "7 * * * *", prompt: "look" }, T0)).id;
  cronTool(st, "schedule_wakeup", { delaySeconds: 600, prompt: "/loop", reason: "waiting on CI", noop: false }, T0);
  await applyCronTurn(env, bucket, "u1", "e", "c6", cronResult(st), "", T0);
  const u = new URL("https://gofarther.dev/api/coder/schedules?chat=c6");
  const v = await (await schedulesRoute(new Request(u), env, "u1", "e", u, T0)).json();
  assert.equal(v.crons[0].id, id);
  assert.equal(v.crons[0].tz, "Europe/London");
  assert.equal(v.wake.reason, "waiting on CI");
  const after = await (await schedulesRoute(new Request(u, { method: "POST", body: JSON.stringify({ cancel: id, stopWake: true }) }), env, "u1", "e", u, T0)).json();
  assert.equal(after.crons.length, 0);
  assert.equal(after.wake, null);
  assert.ok(!bucket.m.has(CRON_DUE + "u1/c6.json"));
});
