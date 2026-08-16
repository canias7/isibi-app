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
import { normalizeJob, dueJobs, shapeMessages, runJob, jobOutcome,
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
  assert.match(st, /site_functions\?owner_id=eq\.[^`]*&slug=eq\.[^`]*&name=eq\.[^`]*&or=\(last_run\.is\.null,last_run\.lt\./,
    "the stamp lost its claim condition or a scope");
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
  assert.match(fn, /if \(out\.skipped\) continue;/, "a lost claim overwrites the winning run's outcome");
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
  const start = worker.indexOf('"/api/site/react-build"');
  const end = worker.indexOf("await persistSiteJobs");
  assert.ok(start !== -1 && end > start, "the route must precede the call it makes");
  assert.match(worker.slice(start, end), /\bconst bu\b\s*=/, "the route must bind `bu` before using bu.id");
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
  assert.equal(out.skipped, 1, "it is waiting on a credential, which is a different thing");
});
