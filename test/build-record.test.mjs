// What a build did, written down while it is still happening.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeRecorder, BUILD_RECORD_TABLE, MAX_PRIOR_STEPS } from "../builder/build-record.mjs";
import { makeTrace } from "../builder/trace.mjs";

/** A write that records what it was given and resolves when told to. */
function fakeWrite() {
  const rows = [];
  const gates = [];
  const fn = (row) => {
    rows.push(row);
    return new Promise((res, rej) => gates.push({ res, rej }));
  };
  fn.rows = rows;
  fn.settle = (i = 0, err) => { const g = gates[i]; if (g) (err ? g.rej(err) : g.res()); };
  fn.pending = () => gates.length;
  return fn;
}

/** A write that resolves immediately. */
const okWrite = () => {
  const rows = [];
  const fn = async (row) => { rows.push(row); };
  fn.rows = rows;
  return fn;
};

test("nothing is written before the slug is known — and nothing is LOST either", async () => {
  // The route decides the slug partway through: auth, the body, the credit gate
  // and the whole design call happen first. Dropping those steps would leave a
  // build that dies in page generation with no prologue at all, which is most of
  // what "where did it get to" means.
  const write = okWrite();
  const rec = makeRecorder({ write });
  rec.step({ steps: [{ s: "auth", ms: 40 }], totalMs: 40 });
  rec.step({ steps: [{ s: "auth", ms: 40 }, { s: "design", ms: 9000 }], totalMs: 9040 });
  assert.equal(write.rows.length, 0, "a row was written with no slug to key it on");
  assert.equal(rec.state().buffered, true, "the snapshot was dropped rather than held");

  rec.identify("fold-lane-bakery", "uid-1");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(write.rows.length, 1, "identify did not flush what was buffered");
  assert.equal(write.rows[0].slug, "fold-lane-bakery");
  assert.equal(write.rows[0].uid, "uid-1");
  // The LATEST snapshot, not the first: what is wanted is how far it got.
  assert.equal(write.rows[0].steps.length, 2);
  assert.equal(write.rows[0].at, "design", "`at` must name the last step, which is where the build got to");
});

test("a build that never gets a slug leaves NO row", async () => {
  // Honest rather than tidy: it never got as far as being a site, and a row
  // keyed on a placeholder would be a build nobody could find again.
  const write = okWrite();
  const rec = makeRecorder({ write });
  for (let i = 0; i < 20; i++) rec.step({ steps: [{ s: "x", ms: 1 }], totalMs: i });
  rec.finish({ steps: [], totalMs: 100 }, { ok: false });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(write.rows.length, 0);
});

test("writes COALESCE — only the latest snapshot is ever in flight", async () => {
  // A build makes ~15 marks. Naively that is 15 sequential round trips of a
  // Worker's subrequest budget spent on diagnostics, on the request a customer
  // is waiting on. Bounded by how fast the store answers instead.
  const write = fakeWrite();
  const rec = makeRecorder({ write });
  rec.identify("s", "u");
  rec.step({ steps: [{ s: "a", ms: 1 }], totalMs: 1 });
  assert.equal(write.pending(), 1, "the first step should start a write");
  for (const n of ["b", "c", "d", "e"]) rec.step({ steps: [{ s: n, ms: 1 }], totalMs: 1 });
  assert.equal(write.pending(), 1, "four more steps started four more writes instead of coalescing");

  write.settle(0);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(write.pending(), 2, "the held snapshot was not written once the first landed");
  assert.equal(write.rows[1].at, "e", "the coalesced write sent a stale snapshot, not the newest");
});

test("a write that REJECTS does not wedge the pump", async () => {
  // The failure this prevents is silent and total: one bad round trip and every
  // later step of the build goes unrecorded, on exactly the builds where the
  // record matters most.
  const write = fakeWrite();
  const rec = makeRecorder({ write });
  rec.identify("s", "u");
  rec.step({ steps: [{ s: "a", ms: 1 }], totalMs: 1 });
  rec.step({ steps: [{ s: "b", ms: 1 }], totalMs: 2 });
  write.settle(0, new Error("supabase is having a day"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(write.pending(), 2, "a rejected write stopped the recorder for good");
});

test("a write that THROWS synchronously does not wedge it either", () => {
  const rec = makeRecorder({ write: () => { throw new Error("nope"); } });
  rec.identify("s", "u");
  assert.doesNotThrow(() => rec.step({ steps: [{ s: "a", ms: 1 }], totalMs: 1 }));
  assert.equal(rec.state().inflight, false, "a synchronous throw left the pump believing a write was in flight");
});

test("a write that returns a non-promise is not awaited forever", () => {
  const rows = [];
  const rec = makeRecorder({ write: (r) => { rows.push(r); return undefined; } });
  rec.identify("s", "u");
  rec.step({ steps: [{ s: "a", ms: 1 }], totalMs: 1 });
  rec.step({ steps: [{ s: "b", ms: 1 }], totalMs: 2 });
  assert.equal(rows.length, 2, "a synchronous write left the pump wedged after the first call");
});

test("finish CLOSES it, so a straggler cannot reopen a finished build", async () => {
  // A build's promises do not all settle at the same moment. A late step landing
  // after the outcome would overwrite `done: true` with a row saying the build is
  // still running — which reads, forever, as a build that died.
  const write = okWrite();
  const rec = makeRecorder({ write });
  rec.identify("s", "u");
  rec.finish({ steps: [{ s: "publish", ms: 10 }], totalMs: 500 }, { ok: true, page: "app" });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(write.rows.length, 1);
  assert.equal(write.rows[0].done, true);
  assert.equal(write.rows[0].ok, true);
  assert.equal(write.rows[0].page, "app");

  rec.step({ steps: [{ s: "late", ms: 1 }], totalMs: 900 });
  rec.finish({ steps: [], totalMs: 1 }, { ok: false });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(write.rows.length, 1, "a straggling step reopened a finished build");
});

test("the final write goes out even with one in flight, and is HELD", async () => {
  // THE ONE THAT MATTERS. A fire-and-forget promise started as the isolate
  // finishes is cancelled with it — so without `hold` the row would stop one
  // step short of whatever went wrong, which is the whole thing being recorded.
  const write = fakeWrite();
  const held = [];
  const rec = makeRecorder({ write, hold: (p) => held.push(p) });
  rec.identify("s", "u");
  rec.step({ steps: [{ s: "generate", ms: 1 }], totalMs: 1 });
  assert.equal(write.pending(), 1);
  // MEASURED ACROSS `finish`, not counted afterwards. A step write is held too,
  // so `held.length >= 1` is satisfied by the STEP and says nothing at all about
  // the final row — that mutant (`keep(p)` → `void p` in `finish`) survived the
  // first sweep, with the one write that matters unprotected.
  const before = held.length;
  rec.finish({ steps: [{ s: "publish", ms: 2 }], totalMs: 3 }, { ok: true });
  assert.equal(write.rows.length, 2, "the final row waited behind an in-flight write");
  assert.ok(held.length > before,
    "the FINAL write is not registered on hold — the one row that matters dies with the isolate");
  assert.ok(held.every((p) => p && typeof p.then === "function"), "something other than a promise was held");
});

test("a hold that throws is not a failed build", () => {
  const rec = makeRecorder({ write: okWrite(), hold: () => { throw new Error("no ctx"); } });
  rec.identify("s", "u");
  assert.doesNotThrow(() => {
    rec.step({ steps: [{ s: "a", ms: 1 }], totalMs: 1 });
    rec.finish({ steps: [], totalMs: 1 }, {});
  });
});

test("the slug is set ONCE — a second one cannot move a build onto another site's row", () => {
  const write = okWrite();
  const rec = makeRecorder({ write });
  rec.identify("first", "u1");
  rec.identify("second", "u2");
  assert.equal(rec.state().slug, "first");
  assert.equal(rec.state().uid, "u1");
});

test("nothing it does can throw, on any input", () => {
  // A build must never be lost to the thing measuring it — the rule `makeTrace`
  // next door lives under, extended to the one component here that does I/O.
  for (const deps of [undefined, {}, { write: null }, { write: 5 }, { write: okWrite(), now: () => { throw new Error("x"); } }]) {
    const rec = makeRecorder(deps);
    assert.doesNotThrow(() => {
      rec.identify(null, undefined);
      rec.identify(7, {});
      rec.step(null);
      rec.step({ steps: "not an array", totalMs: "nope" });
      rec.step(undefined, { stage: "design" });
      rec.finish(null, null);
      rec.state();
    }, `makeRecorder(${JSON.stringify(deps)}) threw`);
  }
});

test("a snapshot with no numbers still produces a usable row", () => {
  const write = okWrite();
  const rec = makeRecorder({ write });
  rec.identify("s", "u");
  rec.step({ steps: "junk", totalMs: NaN });
  assert.equal(write.rows.length, 1);
  assert.deepEqual(write.rows[0].steps, []);
  assert.equal(typeof write.rows[0].total_ms, "number");
  assert.ok(Number.isFinite(write.rows[0].total_ms));
  assert.equal(write.rows[0].at, null);
});

/* ------------------------------------------------ the trace's own observer */

test("makeTrace's observer sees every step, in order, with the running total", () => {
  const seen = [];
  let t = 1000;
  const tr = makeTrace(() => t, (snap) => seen.push(snap));
  t = 1100; tr.at("design");
  t = 1600; tr.at("provision");
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0].steps.map((s) => s.s), ["design"]);
  assert.deepEqual(seen[1].steps.map((s) => s.s), ["design", "provision"]);
  assert.equal(seen[1].totalMs, 600);
});

test("an observer that throws cannot lose a step or break a build", () => {
  let t = 0;
  const tr = makeTrace(() => t, () => { throw new Error("observer is broken"); });
  assert.doesNotThrow(() => { tr.at("a"); tr.at("b"); });
  assert.deepEqual(tr.done().steps.map((s) => s.s), ["a", "b"],
    "a throwing observer cost the trace its steps");
});

test("no observer is the shape every existing caller uses", () => {
  const tr = makeTrace();
  assert.doesNotThrow(() => tr.at("a"));
  assert.equal(tr.done().steps.length, 1);
});

test("the observer gets a COPY — it cannot corrupt the trace it is watching", () => {
  const tr = makeTrace(() => 0, (snap) => { snap.steps.length = 0; snap.steps.push({ s: "hacked", ms: 0 }); });
  tr.at("real");
  assert.deepEqual(tr.done().steps.map((s) => s.s), ["real"]);
});

test("it is a leaf, so all of it is testable outside the Worker", () => {
  const src = fs.readFileSync(new URL("../builder/build-record.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /^import /m, "the recorder grew a dependency and stopped being drivable on its own");
  // AND IT NAMES NO SECRET, by construction rather than by filtering: the only
  // things it puts in a row come from a trace step, which `makeTrace` allows to
  // be a short NAME and finite NUMBERS and nothing else.
  assert.doesNotMatch(src, /SUPABASE|apikey|Authorization|SERVICE_KEY/,
    "the recorder knows about credentials — the write is supposed to be injected");
});

/* ------------------------------------------------------------- the wiring */

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CODE = WORKER.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

test("the build route makes a recorder, hands it to the trace, and closes it", () => {
  // THE LAYER TWELVE FEATURES HAVE DIED IN. Every assertion above is about a
  // module that can be perfect and reached by nothing.
  assert.match(CODE, /const rec = makeRecorder\(\{/, "the build route no longer makes a recorder");
  assert.match(CODE, /makeTrace\(undefined, \(snap\) => rec\.step\(snap\)\)/,
    "the trace no longer feeds the recorder, so nothing is written until the end");
  assert.match(CODE, /rec\.identify\(slug, bu\.id\)/,
    "the recorder is never given a slug, so every row is buffered and none is written");
  assert.match(CODE, /rec\.finish\(traced,/,
    "the build never closes its record, so every finished build reads as one that died");

  // THE RECORDER IS DECLARED BEFORE THE TRACE. The observer names `rec`, so the
  // other order is a temporal-dead-zone read that `node --check` passes, esbuild
  // bundles, and EVERY build throws on its first mark — the `vidRefN` class,
  // written seven times here and once all the way to production.
  const r = CODE.indexOf("const rec = makeRecorder({");
  const t = CODE.indexOf("const tr = makeTrace(undefined");
  assert.ok(r > 0 && t > r, "makeTrace is declared above the recorder its observer reads — a TDZ throw on every build");
});

test("the record is written with the SERVICE key and merges duplicates", () => {
  const at = CODE.indexOf("async function writeBuildRecord(");
  assert.ok(at > 0, "the writer is gone");
  const body = CODE.slice(at, CODE.indexOf("\n}", CODE.indexOf("await fetch", at)));
  assert.ok(body.length > 200, "the writer body did not slice — this check would be vacuous");
  assert.match(body, /svcHeaders\(env/, "the record is not written with the service key");
  // ONE `Prefer` HEADER CARRYING BOTH. Two headers of that name do not merge —
  // a second silently replaces the first, which is how a `return=minimal` once
  // made a claim impossible to win.
  const prefer = body.match(/Prefer:\s*"([^"]*)"/g) || [];
  assert.equal(prefer.length, 1, `expected exactly one Prefer header; found ${prefer.length}`);
  assert.match(prefer[0], /resolution=merge-duplicates/,
    "without merge-duplicates every step of every build inserts a new row and the upsert 409s");
  assert.match(body, /AbortSignal\.timeout\(/,
    "the diagnostic write is unbounded — a slow Supabase would hold the build open");
  // THE CONSTANT, not the string it holds. The URL is a template literal, so
  // `site_builds` never appears in the source at all — my first draft searched
  // for the value and reported a writer that names no table while it names it
  // perfectly. And the constant is the thing that must not drift: the module
  // and the Worker agreeing on one table is the whole point of exporting it.
  assert.match(body, /\$\{BUILD_RECORD_TABLE\}/, "the writer no longer names the shared table constant");
  assert.equal(BUILD_RECORD_TABLE, "site_builds", "the table was renamed — the migration must move with it");
});

test("deleting a site deletes its build record", () => {
  // Keyed by slug, so a leftover is INHERITED by whoever claims that slug next —
  // their first build would show a stranger's trace. The same class as the
  // orphan marker, the meta sidecar and the backups, each of which has its own
  // line in that function for the same reason.
  const at = CODE.indexOf("async function deleteSiteFor(");
  assert.ok(at > 0, "deleteSiteFor is gone");
  const body = CODE.slice(at, CODE.indexOf("\n}\n", at));
  assert.ok(body.length > 1000, "deleteSiteFor did not slice — this check would be vacuous");
  const del = body.match(new RegExp("rest/v1/\\$\\{BUILD_RECORD_TABLE\\}\\?slug=eq[^\\n]*"));
  assert.ok(del, "a deleted site keeps its build record, which the next owner of that slug inherits");
  const idx = body.indexOf(del[0]);
  assert.match(body.slice(idx, idx + 400), /method: "DELETE"/, "the cleanup is not a DELETE");
});

// ── A LATER INVOCATION MUST NOT ERASE AN EARLIER ONE ────────────────────────
//
// The row is keyed on the SLUG and upserted, so every recorder writes over the
// last one. That was the whole truth while a build was ONE invocation; a fired
// build is several, and each terminal look was replacing the design call, the
// provisioning and the fire with its own two marks. Measured on `northgroup-5`.

test("A RECORDER CARRIES AN EARLIER INVOCATION'S MARKS", () => {
  const rows = [];
  const rec = makeRecorder({
    write: (row) => { rows.push(row); return Promise.resolve(); },
    prior: [{ s: "design", ms: 170000 }, { s: "provision", ms: 200 }, { s: "fired", ms: 1 }],
  });
  rec.identify("northgroup-5", "u1");
  rec.step({ steps: [{ s: "resume:refire", ms: 0 }], totalMs: 40 });
  const row = rows[rows.length - 1];
  assert.deepEqual(row.steps.map((s) => s.s), ["design", "provision", "fired", "resume:refire"],
    "the resume's marks replaced the build's history instead of continuing it");
  // `at` IS READ OFF THE STEPS, so it must name THIS invocation's last mark and
  // not a carried one — "where did it get to" is a question about now.
  assert.equal(row.at, "resume:refire", "`at` names a carried mark rather than where the build actually is");
  // TIME SPENT, NOT ELAPSED. The carried total is added, because a fired build
  // spends most of its life waiting in a queue and none of that is work.
  assert.equal(row.total_ms, 170241, `total_ms is ${row.total_ms} — the earlier invocations' time was dropped`);
});

test("A CARRIED MARK CLEARS THE SAME BAR A LIVE ONE DOES", () => {
  // These come off a stored record, so they have to be narrowed on the way IN
  // as well as on the way out. `makeTrace` accepts a name and finite numbers and
  // nothing else, deliberately, so a connection string cannot reach this table
  // by any route — a mark read back is not exempt for having been ours once.
  const rows = [];
  const rec = makeRecorder({
    write: (row) => { rows.push(row); return Promise.resolve(); },
    prior: [
      { s: "design", ms: 10, conn: "postgres://u:p@host/db" },
      { s: "ok", ms: NaN, n: Infinity, good: 5 },
      { s: "", ms: 1 },
      { ms: 1 },
      null,
      "design",
      { s: "x".repeat(90), ms: 1 },
    ],
  });
  rec.identify("s", "u");
  rec.step({ steps: [], totalMs: 0 });
  const steps = rows[rows.length - 1].steps;
  assert.deepEqual(steps.map((s) => s.s), ["design", "ok", "x".repeat(40)],
    "a nameless or non-object mark was kept");
  assert.deepEqual(steps[0], { s: "design", ms: 10 }, "a carried mark kept free text — a connection string can reach the trace");
  assert.deepEqual(steps[1], { s: "ok", good: 5 }, "a carried mark kept a value that is not a finite number");
});

test("THE CARRIED LIST IS BOUNDED, oldest first", () => {
  // This record is read and re-written on every look, so an unbounded list is a
  // record that grows for as long as a build keeps being looked at. The OLDEST
  // go, because the marks nearest the failure are what anybody is reading for.
  const rows = [];
  const many = Array.from({ length: MAX_PRIOR_STEPS + 10 }, (_, i) => ({ s: "m" + i, ms: 1 }));
  const rec = makeRecorder({ write: (row) => { rows.push(row); return Promise.resolve(); }, prior: many });
  rec.identify("s", "u");
  rec.step({ steps: [], totalMs: 0 });
  const steps = rows[rows.length - 1].steps;
  assert.equal(steps.length, MAX_PRIOR_STEPS, `kept ${steps.length} carried marks against a cap of ${MAX_PRIOR_STEPS}`);
  assert.equal(steps[steps.length - 1].s, "m" + (MAX_PRIOR_STEPS + 9), "the NEWEST marks were dropped — the tail is what a reader wants");
});

test("NO PRIOR IS THE ORDINARY BUILD, byte for byte", () => {
  // Every recorder that is not a resume passes none, so a build that does not
  // use this must be unchanged — including the shapes a caller could pass by
  // accident, none of which may become a mark.
  for (const prior of [undefined, null, [], "design", 7, {}]) {
    const rows = [];
    const rec = makeRecorder({ write: (row) => { rows.push(row); return Promise.resolve(); }, prior });
    rec.identify("s", "u");
    rec.step({ steps: [{ s: "gate", ms: 3 }], totalMs: 9 });
    const row = rows[rows.length - 1];
    assert.deepEqual(row.steps, [{ s: "gate", ms: 3 }], `prior=${JSON.stringify(prior)} changed an ordinary build's marks`);
    assert.equal(row.total_ms, 9, `prior=${JSON.stringify(prior)} changed an ordinary build's total`);
  }
});
