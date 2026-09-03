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
import { buildSource } from "./fixtures/build-source.mjs";
import path from "node:path";
import { normalizeJob, dueJobs, shapeMessages, runJob, jobOutcome, lastDueAt, validTimeZone, workDone,
         MIN_EVERY_MINUTES, MAX_MESSAGES_PER_RUN, MAX_JOBS_PER_TICK } from "../site-jobs.mjs";
import { recipient } from "../site-mail.mjs";
import { normalizeSchema } from "../site-schema.mjs";
import { FUNCTION_ITEM, JOB_ITEM } from "../builder/site-table.mjs";

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

// ── the stamp is a CLAIM (2026-08-13 audit) ──────────────────────────────────

test("A LOST CLAIM SENDS NOTHING — not even the function is called", async () => {
  // Cloudflare cron ticks OVERLAP when one outlasts its 2-minute interval, and
  // 25 jobs of up to 100 sequential provider sends can take many minutes — so
  // two ticks both read a job as due. The database decides which one runs;
  // the loser must not touch the site's database, the vault or the wire.
  let called = 0;
  const { sent, d } = deps({
    stamp: async () => ({ won: false }),
    callFn: async () => { called++; return [MSG]; },
  });
  const out = await runJob(d, JOB);
  assert.equal(out.ok, true, "losing a race is the system working, not a failure");
  assert.equal(out.skipped, true);
  assert.equal(called, 0, "the loser still ran the model's SQL");
  assert.equal(sent.length, 0, "the loser still sent — the double-mail this claim exists to stop");
});

test("a won claim proceeds, and a dep that cannot say behaves as before", async () => {
  // Strictly `=== false`: the worker's stamp answers {won}, but older fakes and
  // any future dep that returns nothing must keep the pre-claim behaviour —
  // treating "cannot tell" as "lost" would silently stop every send the day a
  // dep forgot the field.
  for (const stamp of [async () => ({ won: true }), async () => undefined, async () => ({})]) {
    const { sent, d } = deps({ stamp });
    const out = await runJob(d, JOB);
    assert.equal(out.sent, 1, "a claim answering " + JSON.stringify(await stamp()) + " blocked the send");
    assert.equal(sent.length, 1);
  }
});

test("a named skip from callFn wears its OWN sentence, never the broken-SQL one", async () => {
  // Three different situations used to shape to null and all three wore "the
  // function didn't return a list" in the owner's panel — said of a database
  // that was unreachable, of a job a revise had dropped, and of a bad name.
  const causes = [
    "the site's database is unreachable",
    "this job is no longer part of the site",
    "the function has an unusable name",
    "the function returned text that is not valid JSON",
  ];
  const brokenSql = jobOutcome({ ok: true, sent: 0, reason: "returned nothing" });
  for (const cause of causes) {
    const { sent, d } = deps({ callFn: async () => ({ jobsSkip: cause }) });
    const out = await runJob(d, JOB);
    assert.equal(out.ok, true);
    assert.equal(out.sent, 0);
    assert.equal(sent.length, 0, "a skip still sent mail");
    const said = jobOutcome(out);
    assert.ok(said.includes(cause), "the cause was dropped from the sentence: " + said);
    assert.notEqual(said, brokenSql, "a named cause reads as broken SQL: " + said);
  }
});

test("jobsSkip is not a magic value a model's rows can fake into silence", async () => {
  // The sentinel is an OBJECT property, and shapeMessages only reads arrays —
  // a LIST whose first row carries jobsSkip is just a list of bad messages,
  // dropped one by one, never a skip. Only callFn (our code) can produce the
  // bare-object shape.
  const { d } = deps({ callFn: async () => [{ jobsSkip: "x" }, MSG] });
  const out = await runJob(d, JOB);
  assert.equal(out.sent, 1, "a row wearing the sentinel name silenced the whole run");
  assert.equal(out.dropped, 1);
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
  // RE-ANCHORED 2026-09-03: the job and function items live in
  // builder/site-table.mjs now (lifted beside the table item for the addon
  // step), so the OBJECTS are asked and the tool is asked to bind them.
  assert.match(tool, /jobs: \{/, "the designer must offer jobs");
  assert.match(tool, /items: JOB_ITEM,/, "the tool does not bind the shared job item");
  assert.deepEqual(JOB_ITEM.required, ["name", "fn", "everyMinutes"]);
  assert.equal(FUNCTION_ITEM.properties.internal.type, "boolean", "and the internal flag its function needs");
  assert.match(tool, /items: FUNCTION_ITEM,/, "the tool does not bind the shared function item");

  // 2. survives the normaliser, only when the function exists AND is internal
  const F = { name: "due_tomorrow", returns: "json", language: "sql", body: "SELECT 1", internal: true, args: [] };
  const J = { name: "remind", fn: "due_tomorrow", everyMinutes: 1440 };
  const T2 = [{ name: "b", access: "collect", columns: ["e"] }];
  assert.deepEqual(normalizeSchema({ tables: T2, functions: [F], jobs: [J] }).jobs, [J]);
  assert.equal(normalizeSchema({ tables: T2, jobs: [J] }).jobs, undefined, "no such function");
  assert.equal(normalizeSchema({ tables: T2, functions: [{ ...F, internal: false }], jobs: [J] }).jobs, undefined,
    "a function a visitor can call must not be a job");

  // 3. persisted at build time.
  //
  // THIS LINE PINNED THE BUG IN PLACE. It asserted the literal text
  // `persistSiteJobs(env, uid, slug, jobs)` — and `uid` is bound nowhere in that
  // route, so the call threw a ReferenceError into a best-effort catch and no
  // job ever registered. The chain test written to prove the feature reaches the
  // runner was matching a call that could not run, because a source-text match
  // cannot tell a bound identifier from an unbound one. The argument is checked
  // properly in its own test below; here it is enough that the call is there.
  assert.match(worker, /await persistSiteJobs\(env, bu\.id, slug, jobs\)/, "the apply path must register them");
  // 4. drained by the cron
  assert.match(worker, /ctx\.waitUntil\(runScheduledSiteJobs\(env, ctx\)\)/, "the cron must drive it");
  // RE-ANCHORED 2026-09-03: the deps are built by `jobDeps` now, shared with
  // the owner's run-now, so the call is `runJob(jobDeps(env, row), row)`
  // rather than an inline literal. The property is the call.
  assert.match(worker, /runJob\(jobDeps\(env, row\), row\)/, "and it must call the runner");
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

test("THE RUNNER'S STAMP IS A CONDITIONAL CLAIM, and a failed write is a lost claim", () => {
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const fn = worker.slice(worker.indexOf("async function runScheduledSiteJobs"), worker.indexOf("// ── Website Builder"));
  // Landmark-bounded: the stamp dep runs to the next dep key, never a byte
  // count (this repo's recurring own-goal).
  const stAt = fn.indexOf("stamp:"), cfAt = fn.indexOf("callFn:");
  assert.ok(stAt > 0 && cfAt > stAt, "the runner's deps moved — rescope this");
  const st = fn.slice(stAt, cfAt);
  // The WHERE re-states dueness, so an overlapping tick that read the same row
  // as due loses HERE — decided by the database, not by two ticks agreeing not
  // to overlap. Owner-scoped like every other filter on this table now.
  // RE-ANCHORED 2026-09-03: the clause is composed one line up as `dueness`,
  // because the owner's run-now uses the same deps with the clause OFF
  // (the press is the decision that it is due). The property is unchanged:
  // three scopes, and for the cron the WHERE re-states dueness.
  assert.match(st, /site_functions\?owner_id=eq\.[^`]*&slug=eq\.[^`]*&name=eq\.[^`]*\$\{dueness\}`/,
    "the stamp lost a scope or its claim condition");
  assert.match(st, /const dueness = force \? "" : `&or=\(last_run\.is\.null,last_run\.lt\./,
    "the claim condition is not the dueness clause, or is not off only under force");
  // Judged by REPRESENTATION — a row back means we won; empty means we lost.
  assert.match(st, /Prefer: "return=representation"/, "the stamp cannot see whether it matched anything");
  // r.ok CHECKED. The old write was fire-and-forget, so Supabase in read-only
  // mode (reads fine, writes 5xx) let the send proceed unstamped and re-mail
  // the whole batch every tick until writes recovered.
  assert.match(st, /if \(!r\.ok\) return \{ won: false \}/, "an HTTP-level stamp failure reads as a won claim");
  // The claim's window mirrors dueJobs' 30s slack, or the claim refuses runs
  // dueJobs correctly offered whenever the ticks land badly.
  assert.match(st, /mins \* 60000 - 30000/, "the claim window and dueJobs disagree about the slack");

  // A lost claim writes no last_result — the winning tick's outcome is the
  // record, and overwriting it with "skipped" every overlap buries the one
  // line the owner reads.
  // RE-ANCHORED 2026-09-03: the result note lives in `recordJobOutcome` now,
  // shared with run-now, so a lost claim RETURNS out of it before the write
  // rather than continuing the cron's loop. The property is the same: no
  // write on a lost claim.
  const rec = fn.indexOf("async function recordJobOutcome(env, row, out) {");
  assert.ok(rec > 0, "recordJobOutcome is gone");
  const note = fn.slice(rec);
  const skip = note.indexOf("if (out.skipped) return;");
  const write = note.indexOf("last_result: jobOutcome(out)");
  assert.ok(skip > 0 && write > skip, "a lost claim overwrites the winning run's outcome");
  // And every WRITE to the registry is owner-scoped: the stamp and the result
  // note. (The tick's scan is the one legitimately unscoped read.)
  assert.equal([...fn.matchAll(/site_functions\?owner_id=eq\./g)].length, 2,
    "one of the runner's two registry writes lost its owner scope");
  assert.match(fn, /last_run: new Date/, "the stamp no longer writes last_run");
  assert.match(fn, /last_result: jobOutcome\(out\)/, "the result note no longer writes the outcome");
});

test("callFn names its causes and NEVER quotes the parse error", () => {
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const fn = worker.slice(worker.indexOf("async function runScheduledSiteJobs"), worker.indexOf("// ── Website Builder"));
  const cfAt = fn.indexOf("callFn:"), crAt = fn.indexOf("credentials:");
  assert.ok(cfAt > 0 && crAt > cfAt, "the runner's deps moved — rescope this");
  const cf = fn.slice(cfAt, crAt);
  // Three situations that used to shape to bare null, all three wearing the
  // broken-SQL sentence in the owner's panel.
  for (const cause of ["the site's database is unreachable", "this job is no longer part of the site", "the function has an unusable name"])
    assert.ok(cf.includes('"' + cause + '"'), "a bare null came back: " + cause);
  // V8's SyntaxError quotes ~26 characters of the INPUT, and a malformed result
  // can begin with a customer's address — so the parse failure is a FIXED
  // sentence and the catch binds no error at all.
  assert.match(cf, /catch \{ return \{ jobsSkip: "the function returned text that is not valid JSON" \}/,
    "the JSON parse can leak its input into last_result");
  assert.equal(/JSON\.parse[\s\S]{0,160}?catch \(/.test(cf), false,
    "the parse catch binds the error — one step from quoting a recipient");
});

test("deleting a site deletes its jobs — before the row a retry needs", () => {
  // Left behind, each job row is a ZOMBIE the cron picks up forever: a stamp
  // write, a project lookup and a last_result write per period, for a site
  // that no longer exists (2026-08-13 audit). They are keyed by slug, not by
  // uid, so they do not cascade with the account either — this is the only
  // path that removes them.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const del = worker.indexOf("async function deleteSiteFor");
  assert.ok(del > 0, "deleteSiteFor moved — rescope this");
  const body = worker.slice(del, worker.indexOf("\n}", worker.indexOf("domainsReleased", del)));
  const jobs = body.search(/site_functions\?slug=eq\.\$\{encodeURIComponent\(dslug\)\}`, \{\s*method: "DELETE"/);
  assert.ok(jobs > 0, "the zombie-jobs cleanup is gone from deleteSiteFor");
  // BEFORE the registration delete, and both anchors proven to exist first —
  // `indexOf(a) < indexOf(b)` passes vacuously when either is missing. If the
  // jobs delete fails the site still exists and the owner's retry runs it
  // again; after the row is gone a failed cleanup is permanent, because
  // `DELETE /api/site/<slug>` answers 404 with no row to authorise against.
  const row = body.indexOf('site_backends?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE"');
  assert.ok(row > 0, "the registration delete moved — rescope this");
  assert.ok(jobs < row, "the jobs cleanup runs after the row delete — a failure there is unretryable");
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

test("the build hands persistSiteJobs an owner id that the route actually binds", () => {
  // THE BUG THIS EXISTS FOR, found by `confirm smoke` on its first run: the call
  // passed `uid`, which is bound NOWHERE in that scope — every other line of the
  // route uses `bu.id`, and `uid` is only ever a parameter name in other
  // functions. So it threw `ReferenceError: uid is not defined` straight into the
  // enclosing catch, and NOT ONE JOB HAD EVER REGISTERED on any site.
  //
  // Three things made it invisible, and all three are the point of this guard.
  // The block is best-effort by design, so the throw is swallowed and the build
  // reports success. `node --check` cannot see it, because an unbound identifier
  // is a runtime error and not a syntax one. And there is no linter in this
  // repo, so `no-undef` — which catches this whole class in one rule — is not
  // running anywhere.
  //
  // Asserted on the ARGUMENT rather than on the call existing, because the call
  // existed the entire time it was broken.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  // `await persistSiteJobs(` — the CALL. Matching the bare name finds the
  // `async function persistSiteJobs(env, ownerId, …)` DEFINITION first, since it
  // is earlier in the file, and then happily reports the parameter name as the
  // argument. The first draft of this test did exactly that and passed against
  // the broken call.
  const m = worker.match(/await persistSiteJobs\s*\(\s*env\s*,\s*([A-Za-z_$][\w$.]*)\s*,/);
  assert.ok(m, "the build must still register declared jobs");
  assert.equal(m[1], "bu.id",
    `persistSiteJobs is passed \`${m && m[1]}\`, which the build route does not bind — ` +
    "it authenticates as `bu` and the owner is `bu.id`");

  // And the identifier really is bound by the route, derived rather than
  // trusted: if the route is ever rewritten to name the user something else,
  // this fails and says so instead of pinning a stale spelling forever.
  //
  // Sliced to the CALL, not to the bare name — `persistSiteJobs` first occurs at
  // its own definition thousands of lines EARLIER than this route, so slicing to
  // that index runs backwards and yields an empty string, which then fails to
  // match for a reason that has nothing to do with the property under test. That
  // is the third time in this one change that a definition was mistaken for a
  // call site; when a helper and its caller share a name, anchor on the call.
  // SCOPED TO THE BUILD, not sliced between two positions in the file. Those
  // two landmarks used to sit in order; the build moved into `runSiteBuild` on
  // 2026-08-23, so the call now comes BEFORE the route match and the slice ran
  // backwards — which is the exact failure the comment above warns about, from
  // a different direction.
  const seg = buildSource();
  const end = seg.indexOf("await persistSiteJobs");
  assert.ok(end > 0, "the build no longer calls persistSiteJobs");
  assert.match(seg.slice(0, end), /\bconst bu\b\s*=/, "the build must bind `bu` before using bu.id");
});

// ── the second channel ─────────────────────────────────────────────────────
//
// The tool's headline case is "reminding tomorrow's customers today, so they
// turn up" — which for a barber, a garage or a restaurant is a TEXT, because a
// text is read and an email is not. The whole tier could only email until now:
// `send` was hardcoded to the mail sender, so `sendSms` sat one file over and no
// scheduled job could reach it.

const email = (m, k) => (m && typeof m[k] === "string" && m[k].includes("@") ? m[k] : null);
const phone = (v) => (/^\+[0-9]{8,15}$/.test(String(v || "")) ? String(v) : null);

test("a message says which channel it is, and email is the default", () => {
  const out = shapeMessages([
    { to: "a@b.com", subject: "Tomorrow", body: "See you at 9." },
    { channel: "sms", to: "+447700900000", body: "See you at 9." },
    { channel: "SMS", to: "+447700900001", body: "And you at 10." },
  ], email, phone);
  assert.equal(out.messages.length, 3);
  assert.equal(out.messages[0].channel, "email", "no channel means email");
  assert.equal(out.messages[0].html, "See you at 9.", "email still carries html + subject");
  assert.equal(out.messages[1].channel, "sms");
  assert.equal(out.messages[1].body, "See you at 9.");
  assert.equal(out.messages[1].subject, undefined, "a text has no subject to put on the wire");
  assert.equal(out.messages[2].channel, "sms", "the channel is case-insensitive");
});

test("a missing subject is a DROPPED email, never a silent text", () => {
  // The tempting shortcut is "no subject means text it" — which turns a function
  // that forgot a subject into a message to somebody's phone at the owner's
  // expense, instead of a drop they can see in the panel.
  const out = shapeMessages([{ to: "a@b.com", body: "no subject here" }], email, phone);
  assert.deepEqual(out.messages, []);
  assert.equal(out.dropped, 1, "it must be dropped, not re-routed");

  // THE CASE THAT ACTUALLY DISCRIMINATES, and the one above does not: with an
  // EMAIL in `to`, an infer-from-subject rule drops it anyway because the phone
  // parser refuses the address — so the assertion held while the rule was
  // wrong. A PHONE NUMBER and no subject is the shape that separates them, and
  // it is also the real-world shape: a function that has the customer's mobile
  // and forgot the subject line. Inferred, that is a text somebody pays for.
  const sneaky = shapeMessages([{ to: "+447700900000", body: "no subject, real number" }], email, phone);
  assert.deepEqual(sneaky.messages, [], "an unlabelled message must never become a text");
  assert.equal(sneaky.dropped, 1, "it is a malformed email, not a valid sms");
});

test("a text's number goes through the same parser the write path uses", () => {
  const out = shapeMessages([
    { channel: "sms", to: "07700 900000", body: "local format" },
    { channel: "sms", to: "+447700900000", body: "international" },
    { channel: "sms", to: "+447700900000", body: "" },
    { channel: "sms", body: "no number at all" },
  ], email, phone);
  assert.equal(out.messages.length, 1, "only the sendable one survives");
  assert.equal(out.messages[0].body, "international");
  assert.equal(out.dropped, 3);
});

test("with no phone parser wired, an sms message is dropped rather than emailed", () => {
  // Belt and braces against the worst possible fallback: a phone number in the
  // `to` of an email.
  const out = shapeMessages([{ channel: "sms", to: "+447700900000", body: "hi" }], email, null);
  assert.deepEqual(out.messages, []);
  assert.equal(out.dropped, 1);
});

test("runJob sends each message on its own channel, and reads only the vaults it needs", async () => {
  const sentMail = [], sentSms = [];
  let mailReads = 0, smsReads = 0;
  const deps = (over = {}) => ({
    stamp: async () => ({ won: true }),
    callFn: async () => ([
      { to: "a@b.com", subject: "Digest", body: "<p>hi</p>" },
      { channel: "sms", to: "+447700900000", body: "Tomorrow at 9." },
    ]),
    recipient: email,
    phone,
    credentials: async () => { mailReads++; return { provider: "resend", key: "k", from: "s@b.com" }; },
    smsCredentials: async () => { smsReads++; return { provider: "twilio", key: "sid", secret: "tok", from: "+15550000000" }; },
    send: async (m) => { sentMail.push(m); return { ok: true }; },
    sendSms: async (m) => { sentSms.push(m); return { ok: true }; },
    ...over,
  });

  const out = await runJob(deps(), { name: "remind", spec: { fn: "due_tomorrow" } });
  assert.equal(out.sent, 2, "both channels sent");
  assert.equal(sentMail.length, 1);
  assert.equal(sentSms.length, 1);
  assert.equal(sentSms[0].to, "+447700900000");
  assert.equal(sentSms[0].body, "Tomorrow at 9.");
  assert.equal(sentSms[0].from, "+15550000000", "the owner's own sender");

  // ONE DECRYPT PER CHANNEL PER RUN, not per message.
  assert.equal(mailReads, 1);
  assert.equal(smsReads, 1);

  // AN EMAIL-ONLY JOB MUST NOT TOUCH THE SMS VAULT — every email-only site on
  // the platform would otherwise pay a decrypt per tick for a feature it never
  // declared.
  smsReads = 0;
  await runJob(deps({ callFn: async () => ([{ to: "a@b.com", subject: "s", body: "b" }]) }), { name: "j", spec: { fn: "f" } });
  assert.equal(smsReads, 0, "no texts means no SMS vault read at all");
});

test("a half-configured site sends what it can and does not report the rest as failed", async () => {
  const sentMail = [];
  const out = await runJob({
    stamp: async () => ({ won: true }),
    callFn: async () => ([
      { to: "a@b.com", subject: "Digest", body: "<p>hi</p>" },
      { channel: "sms", to: "+447700900000", body: "Tomorrow at 9." },
    ]),
    recipient: email,
    phone,
    credentials: async () => ({ provider: "resend", key: "k", from: "s@b.com" }),
    smsCredentials: async () => null,          // no Twilio key pasted yet
    send: async (m) => { sentMail.push(m); return { ok: true }; },
    sendSms: async () => { throw new Error("must not be called"); },
  }, { name: "remind", spec: { fn: "f" } });

  assert.equal(out.sent, 1, "the email went");
  assert.equal(out.failed, 0, "and the text is NOT a failure — nothing broke");
  assert.equal(out.unsent, 1, "it is waiting on a credential, which is a different thing");
  assert.equal(out.skipped, undefined, "and it is NOT `skipped`, which means the claim was lost");

  // THE COLLISION THIS NAME EXISTS TO AVOID, asserted directly. `skipped: true`
  // is a boolean meaning "another tick claimed this run" and `jobOutcome`
  // branches on it FIRST, so a count in the same field made a run that sent an
  // email report "Skipped — another run had already picked this up" — and
  // `runScheduledSiteJobs` skips the last_result write on the same flag, so the
  // owner's panel kept the previous run's line for ever.
  const half = jobOutcome({ ok: true, sent: 1, unsent: 1 });
  assert.match(half, /Sent 1 message/, "a run that sent must say so");
  assert.match(half, /waiting on a provider key/, "and must name what did not go");
  assert.doesNotMatch(half, /another run had already/, "a half-configured run is NOT a lost claim");
  assert.match(jobOutcome({ ok: true, skipped: true }), /another run had already/,
    "while a genuinely lost claim still says exactly that");
});

test("a paused job is not un-paused by the next publish", () => {
  // THE OFF SWITCH WAS TAKEN BACK BY THE THING THAT REGISTERS JOBS. Every row
  // `persistSiteJobs` built hardcoded `enabled: true`, and it upserts with
  // merge-duplicates — PostgREST overwrites the columns it is given — so the
  // owner's pause was reset on the next publish of the site and the runner,
  // which filters `enabled=is.true`, resumed it on the next two-minute tick.
  //
  // These send on the owner's OWN Twilio or Resend key, so it spends their
  // money and messages their customers after they asked it to stop, with
  // nothing on the site saying it started again.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("async function persistSiteJobs(");
  assert.ok(at > 0, "persistSiteJobs moved");
  // Bounded by the function's own close, never a byte budget — this file's
  // sibling guards have been outrun by their own comments six times.
  const fn = worker.slice(at, worker.indexOf("\n}", at));

  // 1. IT READS THE STORED FLAG. Without this there is nothing to preserve.
  assert.match(fn, /select: "name,enabled"/, "persistSiteJobs never asks which jobs are paused");
  assert.match(fn, /row\.enabled === false/, "a stored pause is not recognised — strictly false, so nothing merely falsy pauses a job");

  // 2. AND `enabled` IS OMITTED RATHER THAN SENT FALSE. Sending `false` would
  //    be a second opinion about the owner's own setting; omitting the column
  //    leaves whatever is stored, and the table's NOT NULL DEFAULT true gives a
  //    genuinely new row the right answer. (Measured against the live schema —
  //    if that default ever moves, this has to send the column again.)
  assert.match(fn, /\?\s*\{\}\s*:\s*\{ enabled: true \}/,
    "the row hardcodes `enabled` again, so a publish resets the owner's pause");

  // 3. AN UNREADABLE ANSWER PAUSES NOTHING AND ENABLES NOTHING. Being wrong
  //    toward paused costs a job that waits for the next publish; being wrong
  //    toward enabled sends messages somebody switched off.
  assert.match(fn, /paused\.add\(null\)/, "a failed read does not fall back to leaving every flag alone");
  assert.match(fn, /const unknown = paused\.has\(null\)/, "the unknown sentinel is set and never read");
});

// ── A CLOCK TIME (owner, 2026-09-03) ────────────────────────────────────────
//
// "Every day at nine" was "every 1440 minutes from whenever it was added".
// `at` is a time of day in the site's own zone, `tz` the zone the owner's
// browser sent; a never-run clock-time job waits for its time to pass since
// it was REGISTERED, so a 09:00 added at three in the afternoon fires the
// next morning and not on the next tick.
test("a clock time rides a daily-or-slower job with the owner's zone, and is left off a faster one", () => {
  assert.deepEqual(normalizeJob({ name: "r", fn: "f", everyMinutes: 1440, at: "09:00", tz: "Europe/London" }),
    { name: "r", fn: "f", everyMinutes: 1440, at: "09:00", tz: "Europe/London" });
  assert.deepEqual(normalizeJob({ name: "r", fn: "f", everyMinutes: 60, at: "09:00", tz: "Europe/London" }),
    { name: "r", fn: "f", everyMinutes: 60 }, "an hourly job kept a time of day");
  assert.deepEqual(normalizeJob({ name: "r", fn: "f", everyMinutes: 1440, at: "09:00", tz: "Mars/Olympus" }),
    { name: "r", fn: "f", everyMinutes: 1440, at: "09:00" }, "an unknown zone was stored");
  assert.deepEqual(normalizeJob({ name: "r", fn: "f", everyMinutes: 1440, at: "9am" }), { name: "r", fn: "f", everyMinutes: 1440 }, "an unreadable time was stored");
  assert.equal(validTimeZone("Europe/London"), "Europe/London");
  assert.equal(validTimeZone("America/Argentina/Buenos_Aires"), "America/Argentina/Buenos_Aires");
  assert.equal(validTimeZone("UTC"), "UTC");
  for (const bad of ["nope", "", null, ["Europe/London"], "Europe/London; DROP", "x".repeat(70)]) assert.equal(validTimeZone(bad), null, JSON.stringify(bad));
});

test("lastDueAt is the latest occurrence of the clock time in the zone, at or before now", () => {
  const iso = (ms) => new Date(ms).toISOString();
  const noon = Date.UTC(2026, 8, 3, 12, 0);
  // British Summer Time: 09:00 London is 08:00Z.
  assert.equal(iso(lastDueAt("09:00", "Europe/London", noon)), "2026-09-03T08:00:00.000Z");
  assert.equal(iso(lastDueAt("09:00", "Europe/London", Date.UTC(2026, 8, 3, 7, 30))), "2026-09-02T08:00:00.000Z", "today's time still ahead is not yesterday's");
  // Winter: 09:00 London is 09:00Z — the zone's own business.
  assert.equal(iso(lastDueAt("09:00", "Europe/London", Date.UTC(2026, 0, 15, 12, 0))), "2026-01-15T09:00:00.000Z");
  // West of Greenwich, and a zone east where the local day has already turned.
  assert.equal(iso(lastDueAt("09:00", "America/New_York", noon)), "2026-09-02T13:00:00.000Z");
  assert.equal(iso(lastDueAt("09:00", "America/New_York", Date.UTC(2026, 8, 3, 13, 0))), "2026-09-03T13:00:00.000Z", "exactly on the minute counts");
  assert.equal(iso(lastDueAt("00:30", "Asia/Tokyo", Date.UTC(2026, 8, 3, 15, 0))), "2026-09-02T15:30:00.000Z");
  // No zone reads as UTC; an unreadable time or instant is null, never a throw.
  assert.equal(iso(lastDueAt("09:00", undefined, noon)), "2026-09-03T09:00:00.000Z");
  assert.equal(iso(lastDueAt("09:00", "Mars/Olympus", noon)), "2026-09-03T09:00:00.000Z");
  assert.equal(lastDueAt("9am", "UTC", noon), null);
  assert.equal(lastDueAt("09:00", "UTC", NaN), null);
});

test("a clock-time job waits for its time since it was added, runs once per occurrence, and keeps its interval", () => {
  const iso = (ms) => new Date(ms).toISOString();
  const T = (h, m = 0, d = 3) => Date.UTC(2026, 8, d, h, m);   // BST: 09:00 London = 08:00Z
  const row = (o) => ({ ...JOB, spec: { fn: "due_tomorrow", at: "09:00", tz: "Europe/London" }, updated_at: null, ...o });
  const due = (r, t) => dueJobs([r], t).length === 1;
  // Added at 15:00 local: not on the next tick, but the next morning.
  assert.equal(due(row({ updated_at: iso(T(14)) }), T(14, 30)), false, "a daily 09:00 added at three fired on the next tick");
  assert.equal(due(row({ updated_at: iso(T(14)) }), T(7, 59, 4)), false, "fired before its time");
  assert.equal(due(row({ updated_at: iso(T(14)) }), T(8, 1, 4)), true, "did not fire the morning after it was added");
  // No registration stamp at all: run rather than strand.
  assert.equal(due(row({}), T(14, 30)), true);
  // Once per occurrence, and the interval on top.
  assert.equal(due(row({ last_run: iso(T(8, 2)) }), T(10)), false, "ran twice in one day");
  assert.equal(due(row({ last_run: iso(T(8, 2, 2)) }), T(8, 1)), false, "ran a minute early — the interval is not kept");
  assert.equal(due(row({ last_run: iso(T(8, 2, 2)) }), T(8, 2)), true, "did not run the next morning");
  assert.equal(due(row({ schedule_minutes: 10080, last_run: iso(Date.UTC(2026, 7, 28, 8, 2)) }), T(8, 5)), false, "a weekly 09:00 ran after six days");
  assert.equal(due(row({ schedule_minutes: 10080, last_run: iso(Date.UTC(2026, 7, 27, 8, 2)) }), T(8, 5)), true, "a weekly 09:00 did not run after seven");
  // A paused clock-time job never runs; a plain-interval job is exactly as before.
  assert.equal(due(row({ enabled: false, updated_at: iso(T(14)) }), T(8, 1, 4)), false);
  assert.equal(due({ ...JOB }, T(14)), true);
});

test("THE RUNNER READS THE SITE'S CONNECTION, not its project row — and one set of deps serves the cron and the owner's run-now", () => {
  // Three deps read `siteNeonProject(env, row.slug)` — the Neon PROJECT ROW —
  // where the DATABASE CONNECTION is wanted, so the schema read as empty and
  // every job ever registered wrote "this job is no longer part of the site":
  // twenty-six registered, zero sends, and this file's own chain test green
  // the whole time because it read the module and never ran the deps.
  const worker = noComments(fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8"));
  const open = worker.indexOf("function jobDeps(env, row, { force = false } = {}) {");
  const shut = worker.indexOf("async function recordJobOutcome(env, row, out) {", open);
  assert.ok(open > 0 && shut > open, "jobDeps or recordJobOutcome is gone");
  const deps = worker.slice(open, shut);
  const reads = deps.match(/const conn = await siteBackendBySlug\(env, row\.slug\);/g) || [];
  assert.equal(reads.length, 3, "the three deps do not all read the connection through siteBackendBySlug: " + reads.length);
  assert.doesNotMatch(deps, /siteNeonProject\(/, "a dep still reads the project row where a connection is wanted");
  for (const dep of ["callFn:", "credentials:", "smsCredentials:", "stamp:", "send:", "sendSms:", "phone:", "recipient"]) assert.ok(deps.includes(dep), "jobDeps lost " + dep);
  // The stamp keeps its dueness clause for the cron and drops it under force.
  assert.match(deps, /const dueness = force \? "" : `&or=\(last_run\.is\.null,last_run\.lt\.\$\{encodeURIComponent\(cutoff\)\}\)`;/, "the stamp's dueness clause is not gated on force");
  assert.match(deps, /\$\{dueness\}`, \{/, "the stamp's WHERE does not carry the dueness clause");
  // The cron: due rows, one call each, the outcome recorded; and the select carries updated_at.
  const cron = worker.slice(worker.indexOf("async function runScheduledSiteJobs"), open);
  assert.match(cron, /for \(const row of dueJobs\(rows, Date\.now\(\)\)\) \{\s*const out = await runJob\(jobDeps\(env, row\), row\);\s*await recordJobOutcome\(env, row, out\);\s*\}/, "the cron does not run each due job through the shared deps and record it");
  assert.match(cron, /select=owner_id,slug,name,spec,schedule_minutes,last_run,updated_at&/, "the cron's read does not carry updated_at — a never-run clock-time job cannot know when it was added");
  // Run-now: owner-scoped, the same deps under force, recorded, answered as the sentence, before the switch's check that would 400 it.
  const run = worker.indexOf("if (jbody && jbody.run === true) {");
  assert.ok(run > 0, "the run-now branch is gone");
  const enabledCheck = worker.indexOf('if (typeof (jbody && jbody.enabled) !== "boolean")', run);
  assert.ok(enabledCheck > run, "run-now sits after the enabled check, which 400s it");
  const branch = worker.slice(run, enabledCheck);
  assert.match(branch, /owner_id=eq\.\$\{encodeURIComponent\(ou\.id\)\}&slug=eq\.\$\{encodeURIComponent\(jslug\)\}&name=eq\.\$\{encodeURIComponent\(jname\)\}&schedule_minutes=not\.is\.null/, "run-now is not owner-scoped to one scheduled job");
  assert.match(branch, /select=owner_id,slug,name,spec,schedule_minutes,last_run,updated_at,enabled/, "run-now's row lacks what the deps read");
  assert.match(branch, /const out = await runJob\(jobDeps\(env, jrow, \{ force: true \}\), jrow\);/, "run-now does not run the shared deps under force");
  assert.match(branch, /await recordJobOutcome\(env, jrow, out\);/, "run-now's outcome is not written where the panel reads");
  assert.match(branch, /result: jobOutcome\(out\)/, "run-now does not answer the sentence");
  assert.match(branch, /error: "no such job" \}, \{ status: 404 \}/, "run-now on a name that matches nothing says ok");
  // The registration carries the clock time, and the panel's read hands it back.
  assert.match(worker, /spec: \{ fn: j\.fn, \.\.\.\(j\.at \? \{ at: j\.at, \.\.\.\(j\.tz \? \{ tz: j\.tz \} : \{\}\) \} : \{\}\) \}/, "persistSiteJobs drops the clock time");
  assert.match(worker, /select=name,spec,schedule_minutes,enabled,last_run,last_result&order=name\.asc/, "the panel's read does not fetch the spec");
  assert.match(worker, /at: j\.spec && typeof j\.spec === "object" && typeof j\.spec\.at === "string" \? j\.spec\.at : null,/, "the panel is not told the clock time");
});

test("the owner's panel shows the clock time and has a Run now button wired to the route; the addon post carries the browser's zone", () => {
  const chat = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "chat.js"), "utf8");
  const panel = chat.slice(chat.indexOf("async function siteFunctions("), chat.indexOf("async function siteFiles("));
  assert.ok(panel.length > 1000, "the jobs panel is gone");
  assert.match(panel, /' at ' \+ j\.at/, "the schedule label does not show the clock time");
  assert.match(panel, /class="fn-tgl fn-run" data-run="' \+ esc\(j\.name\) \+ '"/, "no Run now button");
  assert.match(panel, /body: JSON\.stringify\(\{ name: b\.dataset\.run, run: true \}\)/, "Run now does not post run:true");
  assert.match(panel, /sbToast\(d\.result \|\| 'Ran\.'\)/, "the sentence that comes back is not shown");
  assert.match(chat, /body: JSON\.stringify\(\{ instruction: instruction, picker: buildPicker, idem: idem, tz: browserTimeZone\(\) \}\)/, "the addon post does not carry the owner's zone");
  assert.match(chat, /function browserTimeZone\(\) \{\s*try \{ return String\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone \|\| ''\); \} catch \(e\) \{ return ''; \}/, "browserTimeZone does not read Intl safely");
  const css = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "styles.css"), "utf8");
  assert.match(css, /\.fn-tgl\.fn-run \{ margin-left: \.4rem;/, "the Run now button has no style beside the switch");
});

// ── a job that DOES something (2026-09-03, the backend services round) ───────

test("a function answering {did} is work done, in its own words, and sends nothing", async () => {
  // Row expiry: the function ran its DELETE and says so. Before this the
  // answer read as "returned not a list" — broken SQL, said of SQL that had
  // just worked — and the owner's panel lied about a job that was fine.
  let credentialsRead = 0;
  const { sent, d } = deps({
    callFn: async () => ({ did: "cleared 12 expired holds" }),
    credentials: async () => { credentialsRead++; return null; },
  });
  const out = await runJob(d, JOB);
  assert.deepEqual(out, { ok: true, name: "remind", sent: 0, did: "cleared 12 expired holds" });
  assert.equal(sent.length, 0);
  assert.equal(credentialsRead, 0, "a housekeeping run must not read the mail vault");
  assert.equal(jobOutcome(out), "Done — cleared 12 expired holds.");
  assert.equal(jobOutcome({ ok: true, did: "Archived 3 orders." }), "Done — Archived 3 orders.", "a full stop is not doubled");
});

test("workDone reads only the explicit shape — a string `did` — and nothing that could be an accident", () => {
  assert.equal(workDone({ did: " cleared 12 " }), "cleared 12");
  assert.equal(workDone(JSON.stringify({ did: "x" })), "x", "Postgres hands json back as text either way");
  assert.equal(workDone("x".repeat(10)), null);
  for (const notWork of [null, undefined, 42, [], [{ did: "x" }], {}, { did: 12 }, { did: "" }, { done: "x" }, "not json"]) {
    assert.equal(workDone(notWork), null, JSON.stringify(notWork));
  }
  assert.equal(workDone({ did: "y".repeat(400) }).length, 160, "bounded, it is a panel line");
});

test("a list is still messages, even one whose rows carry `did`; and our own skip still wins", async () => {
  const { sent, d } = deps({ callFn: async () => [{ ...MSG, did: "nope" }] });
  const out = await runJob(d, JOB);
  assert.equal(out.sent, 1, "a list with a did-shaped row silenced the run");
  assert.equal(out.did, undefined);
  const { d: d2 } = deps({ callFn: async () => ({ jobsSkip: "the site's database is unreachable", did: "x" }) });
  const out2 = await runJob(d2, JOB);
  assert.equal(out2.did, undefined, "a named skip is ours and is read first");
  assert.match(jobOutcome(out2), /unreachable/);
});

test("the designers are told the housekeeping shape, and the router that clearing out is an addon", () => {
  const add = fs.readFileSync(new URL("../builder/site-add.mjs", import.meta.url), "utf8");
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  // The function kind teaches the shape; the job kind names it; both name
  // clearing out old rows so the picker reaches for them.
  const fnKind = add.slice(add.indexOf("  function: {"), add.indexOf("  api: {"));
  assert.match(fnKind, /\{\\"did\\": \\"what it did\\"\}/, "the function designer is not told how a housekeeping run reports");
  assert.match(fnKind, /clear out rows older than thirty days/);
  assert.match(fnKind, /the platform checks the sender's signature before it runs/, "the inbound-hook signature check is not stated");
  const jobKind = add.slice(add.indexOf("  job: {"), add.indexOf("  page: {"));
  assert.match(jobKind, /clearing out records older than thirty days/);
  assert.match(jobKind, /\{\\"did\\": \\"what it did\\"\}/);
  assert.match(ask, /a weekly digest, clearing out old records\./, "the router does not know clearing out is a timer job");
});
