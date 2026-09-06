// STAGE 9 (2026-09-06): THE LITTER UNDER `jobs/`.
//
// Three comments in worker.js say "a stranded record is a few kilobytes;
// NOTHING sweeps `jobs/`" — and a build's stranded REQUEST is not a few
// kilobytes, it is the customer's whole POST body. This drives the decision
// (what is old enough, what is never touched, what cannot be judged) and reads
// the one hop that carries it to R2.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JOB_RETENTION_MS, RETENTION_TICK_MS, RETENTION_NIBBLES, RETENTION_LIST_LIMIT, MAX_RETENTION_DELETES,
  retentionPrefixes, expiredJobKeys, sweepJobObjects,
} from "../builder/job-retention.mjs";
import { EDIT_JOB_MS, CONSUMER_CEILING_MS, SITE_BUSY_DEFER_S, MAX_SITE_BUSY_DEFERRALS } from "../builder/edit-job.mjs";
import { BUILD_JOB_MS } from "../builder/build-job.mjs";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, (what || needle) + " not found"); return i; };

const NOW = 1_800_000_000_000;
const old = (ms) => new Date(NOW - ms);

test("a week is far above the longest a job can legitimately hold one of these", () => {
  // The four bounds the module's argument rests on, read from where they live
  // rather than retyped: nothing that is still running can have an object this
  // old, which is what lets the sweep read no row and take no lease.
  const longest = Math.max(EDIT_JOB_MS, CONSUMER_CEILING_MS, BUILD_JOB_MS, SITE_BUSY_DEFER_S * 1000 * MAX_SITE_BUSY_DEFERRALS);
  assert.ok(JOB_RETENTION_MS > longest * 50, "the retention window is not far above the longest job: " + JOB_RETENTION_MS + " vs " + longest);
  // And the rotation comes round often enough to be a sweep rather than a
  // gesture: every bucket within an hour at the cron's own tick.
  assert.ok(RETENTION_NIBBLES.length * RETENTION_TICK_MS <= 60 * 60 * 1000, "a bucket waits more than an hour for its turn");
  assert.ok(MAX_RETENTION_DELETES <= RETENTION_LIST_LIMIT, "a tick may delete more than it lists");
});

test("the rotation covers every bucket, in both prefixes, from the clock alone", () => {
  const seen = new Set();
  for (let i = 0; i < RETENTION_NIBBLES.length; i++) {
    const [own, edit] = retentionPrefixes(NOW + i * RETENTION_TICK_MS);
    assert.equal(edit, "jobs/edit/" + own.slice("jobs/".length), "the two prefixes name different buckets");
    assert.ok(own.startsWith("jobs/") && own.length === "jobs/".length + 1);
    seen.add(own);
  }
  assert.equal(seen.size, RETENTION_NIBBLES.length, "the rotation does not reach every bucket in one round");
  // The same tick answers the same bucket — two isolates on one tick must not
  // sweep different halves and call it coverage.
  assert.deepEqual(retentionPrefixes(NOW), retentionPrefixes(NOW + 1));
  // A clock that is not one still answers a real pair rather than "jobs/undefined".
  for (const junk of [undefined, NaN, "x", null]) {
    const [p] = retentionPrefixes(junk);
    assert.ok(RETENTION_NIBBLES.includes(p.slice(-1)), "a junk clock named " + p);
  }
});

test("old enough, and nothing else: the prefix is the wall and an unreadable age is kept", () => {
  const objs = [
    { key: "jobs/7abc.json", uploaded: old(JOB_RETENTION_MS + 1000) },
    { key: "jobs/7abc.result.json", uploaded: old(JOB_RETENTION_MS) },
    { key: "jobs/7dead.resume.json", uploaded: old(JOB_RETENTION_MS - 1000) },   // a minute short
    { key: "jobs/edit/7feed", uploaded: old(JOB_RETENTION_MS * 3) },
    { key: "sites/fretwork-1/index.html", uploaded: old(JOB_RETENTION_MS * 9) }, // never ours
    { key: "jobs/7nodate.json" },                                                 // cannot tell
    { key: "jobs/7junk.json", uploaded: "last tuesday" },                         // cannot tell
    { key: "jobs/7num.json", uploaded: NOW - JOB_RETENTION_MS * 2 },              // a number is a time
    { uploaded: old(JOB_RETENTION_MS * 2) },                                      // no key at all
  ];
  assert.deepEqual(expiredJobKeys(objs, { now: NOW }), [
    "jobs/7abc.json", "jobs/7abc.result.json", "jobs/edit/7feed", "jobs/7num.json",
  ]);
  // The cap is a cap.
  assert.equal(expiredJobKeys(objs, { now: NOW, max: 2 }).length, 2);
  assert.equal(expiredJobKeys(objs, { now: NOW, max: 0 }).length, MAX_RETENTION_DELETES > 0 ? 4 : 0, "a nonsense cap keeps the default");
  // A window is a window: nothing is old when the window is long.
  assert.deepEqual(expiredJobKeys(objs, { now: NOW, retainMs: JOB_RETENTION_MS * 100 }), []);
  // And a junk list is an empty one rather than a throw.
  for (const junk of [null, undefined, "objects", 7, {}]) assert.deepEqual(expiredJobKeys(junk, { now: NOW }), []);
});

test("a tick lists both prefixes, deletes in ONE call, and cannot throw", async () => {
  const calls = { list: [], remove: [] };
  const objs = {
    "jobs/7": [{ key: "jobs/7one.json", uploaded: old(JOB_RETENTION_MS * 2) }, { key: "jobs/7new.json", uploaded: old(1000) }],
    "jobs/edit/7": [{ key: "jobs/edit/7two", uploaded: old(JOB_RETENTION_MS * 2) }],
  };
  const deps = {
    list: async (prefix, limit) => { calls.list.push([prefix, limit]); return objs[prefix] || []; },
    remove: async (keys) => { calls.remove.push(keys); },
  };
  const out = await sweepJobObjects(deps, { now: NOW + 7 * RETENTION_TICK_MS });
  assert.deepEqual(calls.list.map((c) => c[0]), ["jobs/7", "jobs/edit/7"]);
  assert.equal(calls.list[0][1], RETENTION_LIST_LIMIT, "the listing is not bounded");
  assert.equal(calls.remove.length, 1, "the batch was deleted key by key");
  assert.deepEqual(calls.remove[0], ["jobs/7one.json", "jobs/edit/7two"]);
  assert.equal(out.deleted, 2);
  assert.equal(out.listed, 3);
  assert.deepEqual(out.errors, []);

  // NOTHING TO TAKE OUT is no delete at all — the ordinary tick.
  const quiet = await sweepJobObjects({ list: async () => [{ key: "jobs/7new.json", uploaded: old(1000) }], remove: async () => { throw new Error("deleted on a quiet tick"); } }, { now: NOW });
  assert.equal(quiet.deleted, 0);
  assert.deepEqual(quiet.errors, []);

  // A LISTING THAT FAILED is reported, and the other prefix is still swept.
  const half = await sweepJobObjects({
    list: async (p) => { if (p.startsWith("jobs/edit/")) throw new Error("r2 down"); return [{ key: "jobs/7one.json", uploaded: old(JOB_RETENTION_MS * 2) }]; },
    remove: async () => {},
  }, { now: NOW + 7 * RETENTION_TICK_MS });
  assert.equal(half.deleted, 1);
  assert.match(half.errors.join(" "), /list jobs\/edit\/7: r2 down/);

  // A DELETE THAT FAILED is reported and counted as nothing deleted.
  const bad = await sweepJobObjects({
    list: async () => [{ key: "jobs/7one.json", uploaded: old(JOB_RETENTION_MS * 2) }],
    remove: async () => { throw new Error("refused"); },
  }, { now: NOW });
  assert.equal(bad.deleted, 0);
  assert.match(bad.errors.join(" "), /remove: refused/);

  // And deps that are not deps at all do not take the cron down.
  const none = await sweepJobObjects({}, { now: NOW });
  assert.equal(none.deleted, 0);
  assert.equal(none.errors.length, 2);
});

test("the cron runs it, with the real bucket and one delete for the batch", () => {
  const src = noComments(WORKER);
  const sched = src.slice(at(src, "async scheduled(event, env, ctx) {", "the cron"), at(src, "async queue(batch, env, ctx) {", "the queue handler"));
  assert.match(sched, /ctx\.waitUntil\(runJobRetention\(env\)\);/, "the cron does not sweep the job prefix");
  const fn = src.slice(at(src, "async function runJobRetention(env) {", "the retention wiring"), at(src, "\n/**\n * REPUBLISH A FEW QUEUED SITES", "its end"));
  assert.match(fn, /if \(!env\.SITES_BUCKET\) return;/, "a Worker with no bucket reaches for one");
  assert.match(fn, /SITES_BUCKET\.list\(\{ prefix, limit \}\)/, "the listing is not the caller's prefix and bound");
  assert.match(fn, /remove: \(keys\) => env\.SITES_BUCKET\.delete\(keys\)/, "the deletes are not one call for the batch");
  assert.match(fn, /if \(out\.deleted \|\| out\.errors\.length\) console\.log\("job retention:"/, "an empty tick writes a line every two minutes");
  assert.match(fn, /catch \(e\) \{ console\.error\("job retention failed:"/, "a sweep that threw would take the cron's other five jobs with it");
  // It reads the module rather than a second copy of the rule.
  assert.match(src, /import \{ sweepJobObjects \} from "\.\/builder\/job-retention\.mjs";/);
  assert.ok(!/JOB_RETENTION_MS\s*=/.test(src), "the Worker keeps its own copy of the window");
});
