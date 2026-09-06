// The rebuild queue is only worth having if it is REACHED.
//
// This repo has recorded twelve features that were correct, tested, and wired to
// nothing — `xaiSkipped`, `langUsage`, `siteRedirectFor`, `notifyOwnerOfSubmission`
// and the rest. Every one of them looked fine from both ends. So the module's own
// 22 tests are half the job; these are the other half, and they read `worker.js`
// because that file is the layer a module test cannot see.
//
// Everything here is asserted as a PROPERTY rather than a spelling. Twelve guards
// went red on correct changes during the last audit round because they pinned an
// argument list or an exact expression.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BATCH } from "../site-rebuild.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The body of a named function, by brace depth — a request init is full of
 *  braces and a flat scan has been written wrong here four times. */
function bodyOf(name) {
  const at = worker.indexOf("async function " + name + "(");
  assert.notEqual(at, -1, name + " is not in worker.js");
  const open = worker.indexOf("{", at);
  let d = 0;
  for (let i = open; i < worker.length; i++) {
    const c = worker[i];
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return worker.slice(open, i + 1); }
  }
  assert.fail(name + " has no closing brace");
}

/** The internal route the rebuild JOB replays (stage 9) — landmark to
 *  landmark, both asserted, since a missing one yields the empty string and
 *  every assertion inside it then passes. */
function rebuildRoute() {
  const a = worker.indexOf("          if (rb) {");
  assert.notEqual(a, -1, "the rebuild route is not in worker.js");
  const b = worker.indexOf("          if (ed) {", a);
  assert.ok(b > a, "the rebuild route has no end (the edit lane follows it)");
  return worker.slice(a, b);
}

test("the cron actually calls it", () => {
  // Without this the queue fills and nothing ever drains it — the shape twelve
  // dead features here had in common.
  const at = worker.indexOf("async scheduled(");
  assert.notEqual(at, -1);
  const sched = worker.slice(at, at + 2000);
  assert.match(sched, /waitUntil\(\s*runSiteRebuild\(/, "the scheduled handler must drive the drain");
});

test("it drains at the module's OWN batch, not a number typed here", () => {
  // The batch is the module's decision (a few per tick since 2026-09-04, each
  // site in its own container lane; it was 1 while the build service was
  // one-at-a-time for the whole platform). A copy of that number in worker.js
  // is a second opinion, and the day the two disagree a bulk rebuild either
  // starves the cron invocation or crawls.
  const body = bodyOf("runSiteRebuild");
  assert.match(body, /limit:\s*REBUILD_BATCH/, "the limit must come from the module");
  assert.doesNotMatch(body, /limit:\s*\d/, "the batch must not be restated as a literal");
  // RE-ANCHORED 2026-09-04: this pinned 1 and its reason; the property is
  // that the number is the module's and is a real, small batch.
  assert.ok(Number.isInteger(BATCH) && BATCH >= 1 && BATCH <= 20, "the module's answer is a small batch — see its own comment for why: " + BATCH);
});

test("every dep drainRebuild uses is supplied", () => {
  // DERIVED FROM THE MODULE, so a sixth dep added there fails here rather than
  // being silently undefined — which in a Worker is a TypeError inside a cron
  // tick that nobody is watching.
  const mod = fs.readFileSync(new URL("../site-rebuild.mjs", import.meta.url), "utf8");
  const needed = [...new Set([...mod.matchAll(/\bdeps\.(\w+)\s*\(/g)].map((m) => m[1]))];
  assert.ok(needed.length >= 5, "the scan found " + needed.length + " deps — it has stopped matching");
  const body = bodyOf("runSiteRebuild");
  for (const dep of needed) {
    assert.match(body, new RegExp("\\b" + dep + ":\\s*async"), "worker.js does not supply deps." + dep);
  }
});

test("`exists` THROWS on an unreadable answer — it never answers false", () => {
  // The dangerous direction, and the whole reason the drain asks instead of
  // reading a message. "Supabase would not answer" read as "the site was
  // deleted" drops a LIVE site from the queue permanently, and nothing anywhere
  // records that it never got the upgrade.
  const body = bodyOf("runSiteRebuild");
  const at = body.indexOf("exists: async");
  assert.notEqual(at, -1);
  const seg = body.slice(at, body.indexOf("rebuild: async"));
  assert.match(seg, /if\s*\(!\s*\w+\.ok\)\s*throw/, "a failed read must throw, not fall through to a boolean");
});

// ── the claim, whose three load-bearing properties live only in worker.js ────
//
// The module's own tests cover the DECISION (a lost claim spends nothing, only
// a literal true wins). None of them can see whether the claim that produces
// that answer is actually atomic — and a claim that always answers true, or
// always false, is worse than no claim at all. All three below were found by
// mutation, not by reading.
//
// RE-ANCHORED 2026-09-05 (stage 6): the claim was a PATCH on site_rebuild
// with three properties in worker.js — the WHERE re-stating dueness, the
// write's status checked, the row asked back. It is the `rebuild_claim` RPC
// now, which takes the same lock an edit's claim takes and asks the site's
// question first; the three properties moved with it, so each guard reads
// the property where it lives: the RPC's body in the applied migration (the
// live snapshot is held equal to it elsewhere), and the dep that reads its
// answer.

const claimBody = () => {
  const body = bodyOf("runSiteRebuild");
  const at = body.indexOf("claim: async");
  assert.notEqual(at, -1, "worker.js supplies no claim");
  const end = body.indexOf("rebuild: async", at);
  assert.ok(end > at, "the claim block could not be bounded");
  return body.slice(at, end);
};

const rebuildClaimSql = () => {
  const dir = new URL("../supabase/applied/", import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f) && !/live_snapshot/.test(f) && fs.readFileSync(new URL(f, dir), "utf8").includes("CREATE OR REPLACE FUNCTION public.rebuild_claim(")).sort();
  assert.ok(files.length >= 1, "no applied migration defines rebuild_claim");
  const src = fs.readFileSync(new URL(files[files.length - 1], dir), "utf8");
  const at = src.indexOf("CREATE OR REPLACE FUNCTION public.rebuild_claim(");
  const end = src.indexOf("$function$;", src.indexOf("AS $function$", at) + 1);
  assert.ok(end > at, "rebuild_claim has no dollar-quoted body");
  return src.slice(at, end).replace(/^\s*--.*$/gm, "");
};

test("the claim's WHERE re-states DUENESS — without it both ticks win", () => {
  // This is the entire atomicity. An update filtered on the slug alone matches
  // for every concurrent tick, so both claim it, both spend a container run,
  // and the guard reads as present while protecting nothing.
  assert.match(rebuildClaimSql(), /update public\.site_rebuild set next_try_at = \w+, running_until = \w+\s+where slug = p_slug and next_try_at <= now\(\)/,
    "the claim must be conditional on the row still being due, and leave the running mark");
  assert.match(claimBody(), /editRpc\(env, "rebuild_claim", \{ p_slug: slug, p_sec:/, "the dep does not go through rebuild_claim");
});

test("the claim CHECKS the write succeeded", () => {
  // A refusal, a transport failure and an answer that is not the RPC's own
  // shape must all be a LOST claim, not a won one — `runScheduledSiteJobs` had
  // this exact bug and its comment is the rule: a claim that cannot be
  // recorded is a claim lost.
  assert.match(claimBody(), /if \(!r \|\| r\.ok !== true\) return false;/,
    "a failed call must be a LOST claim, not a won one");
  assert.match(claimBody(), /return r\.won === true;/, "the claim is won by anything but the RPC's own true");
});

test("the claim asks for the ROW BACK, or it can never win", () => {
  // The subtlest of the three and the most total: a claim that never learns
  // whether its update matched always loses, and THE DRAIN NEVER REBUILDS
  // ANYTHING — a queue that fills and is worked through by nobody, silently.
  // The RPC's update RETURNS the slug it matched and answers `won` off it.
  const sql = rebuildClaimSql();
  assert.match(sql, /returning slug into won;/, "the claim's update does not return the row it matched");
  assert.match(sql, /if won is null then return jsonb_build_object\('ok', true, 'won', false/, "a claim that matched nothing is not answered as lost");
  assert.match(sql, /return jsonb_build_object\('ok', true, 'won', true/, "a claim that matched is not answered as won");
});

test("the claim asks the site's question first, under its lock, and the busy answer is the drain's to defer (stage 6)", () => {
  const sql = rebuildClaimSql();
  const busy = sql.indexOf("other := private.site_busy(p_slug, null);");
  const update = sql.indexOf("update public.site_rebuild set next_try_at");
  assert.ok(busy > 0 && update > busy, "the site is not asked before the row is claimed");
  assert.match(sql, /if other = 'rebuild' then return jsonb_build_object\('ok', true, 'won', false, 'busy', false, 'running', true\); end if;/, "this site's own running rebuild is not answered as running");
  assert.match(sql, /if other is not null then return jsonb_build_object\('ok', true, 'won', false, 'busy', true, 'other', other\); end if;/, "a site a job holds is not answered as busy");
  assert.match(claimBody(), /if \(r\.busy === true\) return "busy";/, "the dep does not hand `busy` to the drain");
  // AND THE MARK GOES WITH THE RUN: a deferred row is not being rebuilt.
  const body = bodyOf("runSiteRebuild");
  const defer = body.slice(body.indexOf("defer: async"), body.indexOf("}, { limit:"));
  assert.match(defer, /running_until: null/, "a deferred row keeps its running mark, and edits read the site as busy for nothing");
});

test("`rebuild` REFUSES without stored source rather than publishing an empty site", () => {
  // Publishing with no pages replaces a working site with one that has no
  // routes — strictly worse than not rebuilding it at all.
  // RE-ANCHORED 2026-09-06 (stage 9): the rebuild is a JOB now, so the source
  // read, the refusal and the publish moved out of the drain's dep and into the
  // route the job replays. The property is unchanged and is read where it
  // lives; what the dep must still do is hand the site to that job, which the
  // stage's own guard drives.
  const seg = rebuildRoute();
  // RE-ANCHORED 2026-09-05 (stage 6): the reader that goes on to publish
  // reads through the repairing wrapper, so a copy behind the pointer is put
  // back before a rebuild republishes it.
  assert.match(seg, /loadSiteSourceForEdit\(/, "it must read the site's own stored source, through the repairing reader");
  const guard = seg.indexOf("if (!rbPages)");
  const publish = seg.indexOf("recompileAndPublish(");
  assert.ok(guard !== -1 && guard < publish, "the refusal must come BEFORE the publish");
  assert.match(seg.slice(guard, publish), /ours:\s*true/,
    "a missing source is ours — an R2 blip and a sourceless site are one null here, " +
    "so it must retry rather than park a site whose pages may be fine");
});

test("a rebuild costs no credits — no model call on this path", () => {
  // The property that makes a platform-wide bump affordable at all. A model call
  // here would turn a 14-site sweep into a real bill and a 500-site one into an
  // outage of the ledger.
  const body = bodyOf("runSiteRebuild");
  for (const banned of ["callBuilderModel", "generateSitePages", "anthropicMessages", "designSiteSchema"]) {
    assert.ok(!body.includes(banned), "the rebuild path must not call " + banned);
  }
});

test("the publish is the SHARED spine, not a second copy of it", () => {
  // `recompileAndPublish` was extracted precisely because a second copy of the
  // publish dropped three fields of the published meta. A bulk path with its own
  // copy would do it again, on every site at once.
  // RE-ANCHORED 2026-09-06 (stage 9): read on the route the job replays.
  assert.match(rebuildRoute(), /recompileAndPublish\(env, \{/);
});

test("the version it archives is LABELLED as ours", () => {
  // Every publish archives a version. An unlabelled row in an owner's history
  // reads as a change they made and cannot remember.
  // RE-ANCHORED 2026-09-06 (stage 9): the same move.
  assert.match(rebuildRoute(), /label:\s*["'`]platform rebuild/);
});

test("nothing in the Worker enqueues — the queue is operator-written", () => {
  // If the platform could queue itself, one bug becomes a self-sustaining
  // republish of every site. Rows come from the operator sweep and nowhere else.
  assert.ok(!/site_rebuild[^\n]*method:\s*["']POST/.test(worker),
    "worker.js must not insert into site_rebuild");
});

test("the operator sweep exists, is dry by default, and does not reset a parked row", () => {
  const script = fs.readFileSync(new URL("../.github/scripts/enqueue-rebuild.mjs", import.meta.url), "utf8");
  const flow = fs.readFileSync(new URL("../.github/workflows/rebuild-all-sites.yml", import.meta.url), "utf8");
  assert.match(flow, /workflow_dispatch/, "manual only — this is an operator action");
  assert.match(flow, /default:\s*false/, "apply must default to false");
  // Re-queuing a stuck site would throw away its attempts and its last_error,
  // which is the only record of WHY it is stuck.
  assert.match(script, /resolution=ignore-duplicates/, "a second sweep must not reset in-flight rows");
});
