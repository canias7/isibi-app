// THE TWO REPAIR COMMANDS, RUN AS PROCESSES, WITH THEIR EXIT CODES READ.
//
// Owner, 2026-09-15: *"Both verification commands can exit successfully on
// failure. backend-repair --verify printed '0 verified, 1 not verified' and
// exited 0. repairbench-count-fix --verify observed bookings=3, direct=0,
// route=0, then fell through to preview and exited 0 because the function still
// needed rewriting. Make verification an explicit mode that always checks its
// postconditions and exits nonzero when they fail. Test both commands as
// processes, including exit codes."*
//
// AN EXIT CODE IS NOT OBSERVABLE FROM INSIDE THE MODULE. `main()` is not
// exported, `process.exitCode` is set on the way out, and a guard that imports
// a helper and calls it is asserting about a different thing entirely — which
// is exactly how a verification that printed its own failure came to exit 0.
//
// So every case here SPAWNS the real script. `test/fixtures/repair-process.mjs`
// is a `--import` preload that installs ONE `fetch` before the script's module
// graph loads, which covers both halves — Supabase is plain `fetch`, and Neon
// is `@neondatabase/serverless`, which is `fetch` over HTTP. Nothing is mocked,
// re-implemented or monkey-patched inside the scripts: the real argument
// parsing, the real `main()`, the real exit.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbNameForSite } from "../site-db.mjs";
import { REPAIR_SITES } from "../scripts/backend-repair.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRELOAD = path.join(ROOT, "test/fixtures/repair-process.mjs");
const DIR = mkdtempSync(path.join(tmpdir(), "repaircmd-"));
process.on("exit", () => { try { rmSync(DIR, { recursive: true, force: true }); } catch { /* best effort */ } });

let n = 0;
/**
 * One real run. The scenario is written to disk and MUTATED BY THE SCRIPT's own
 * writes, so `apply` then `verify` then `apply` reads one evolving database
 * rather than three independent fixtures — which is the only way "repeat
 * succeeds" means anything.
 */
function run(script, args, scenarioFile) {
  const sent = path.join(DIR, `sent-${++n}.json`);
  const env = {
    ...process.env,
    REPAIR_SCENARIO: scenarioFile, REPAIR_SENT: sent,
    SUPABASE_SERVICE_KEY: "service-key", SUPABASE_URL: "https://sb.test", OWNER_BASE_URL: "https://site.test",
  };
  let code = 0, out = "";
  try {
    out = execFileSync("node", ["--import", PRELOAD, path.join(ROOT, "scripts", script), ...args],
      { encoding: "utf8", cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    code = e.status === undefined ? -1 : e.status;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  let statements = [];
  try { statements = JSON.parse(readFileSync(sent, "utf8")); } catch { /* the run may not have reached Neon */ }
  return { code, out, statements };
}

/** A scenario file whose contents the spawned process rewrites as it works. */
function scenario(obj) {
  const f = path.join(DIR, `scen-${++n}.json`);
  writeFileSync(f, JSON.stringify(obj, null, 1));
  return f;
}

const PROJ = "postgres://u:p@ep-x.neon.tech/neondb?sslmode=require";
/** A `collect` table as the catalog reports one. Shapes come from the real emitters elsewhere; here only reachability matters. */
const BOOKINGS = {
  columns: ["id", "created_at", "who"],
  grants: [{ g: "anonymous", p: "INSERT", lvl: "column", col: "who" }, { g: "authenticated", p: "INSERT", lvl: "column", col: "who" }],
  policies: [{ c: "INSERT", q: "", w: "true" }],
};

// ── backend-repair ──────────────────────────────────────────────────────────

test("backend-repair --verify exits NONZERO when a postcondition fails", () => {
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    meta: JSON.stringify({ tables: [] }),
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--verify", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 1, "a failing verification exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /not verified/);
  assert.match(r.out, /FAIL .*reference recorded/);
  assert.match(r.out, /FAIL .*every live table declared/, "the run-47 postcondition is not being asked");
  // AND IT REALLY CONNECTED. A mode that reports on a run it never made is the
  // defect; the statements the process sent are the proof it made one.
  assert.ok(r.statements.some((s) => /current_database/i.test(s.q || "")), "--verify never reached the database");

  // ── THE COLUMN INVENTORY IS PRINTED ON A FAILING RUN (2026-09-16) ─────────
  //
  // It is the before/after instrument for a "no new columns" claim, and the
  // run somebody most wants it from is the one that FAILED. Gating the print
  // on `v.ok` survived every module guard, because the print lives in `main`
  // and only a spawned PROCESS can see it — this repository's recorded "a wall
  // nobody can drive is a wall nobody is guarding", met in the reader written
  // to make a claim authoritative.
  assert.match(r.out, /live columns \(\d+ table\(s\), from information_schema\)/,
    "a failing --verify printed no column inventory:\n" + r.out);
  assert.match(r.out, /bookings: \[/, "the inventory names no table");
  assert.ok(/bookings: \[[^\]]*"who/.test(r.out), "the inventory carries no column for bookings:\n" + r.out);
});

test("backend-repair --verify reaches the SITE's database, not the project's", () => {
  // The first defect this round: identity was asked about `/neondb` while the
  // queries went to `/site_<slug>`. Read off the statements the process really
  // sent, which is the only place the two could still disagree.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: dbNameForSite("repairbench-1") }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    meta: JSON.stringify({ tables: [{ name: "bookings", read: "none", write: "anyone", columns: [{ name: "who", type: "text" }] }] }),
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--verify", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 0, "a passing verification exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /VERIFIED/);
  const dbs = [...new Set(r.statements.map((s) => s.db).filter(Boolean))];
  assert.deepEqual(dbs, [dbNameForSite("repairbench-1")], "statements went to: " + JSON.stringify(dbs));
});

test("backend-repair --verify fails when the named site has no reachable database", () => {
  // "nothing to do" is not a pass in verify mode: the site was supposed to have
  // a database by now. RE-ANCHORED 2026-09-15 onto an IN-SCOPE slug, because
  // the scope wall now refuses an unknown name before anything is read — which
  // is its own case, below.
  const f = scenario({ sites: [{ slug: "washhouse-1", uid: "u1", neon_db: "" }], projects: [] });
  const r = run("backend-repair.mjs", ["--verify", "--slug", "washhouse-1"], f);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /VERIFY FAILED/);

  // THE SENTENCE NAMES THE MODE THAT ASKED (2026-09-16), so the same gate can
  // serve `counts` without a verification's word being put on a run that asked
  // for a number. Both halves are asserted here rather than only the one this
  // case is named for, because they are one line.
  const c = run("backend-repair.mjs", ["--counts", "--slug", "washhouse-1", "--table", "bookings", "--column", "drop_off_day"], f);
  assert.equal(c.code, 1, "a counts run that reached no database exited " + c.code + ":\n" + c.out);
  assert.match(c.out, /COUNTS FAILED/, "the aggregate left the gate, or wears the verification's word:\n" + c.out);
  assert.doesNotMatch(c.out, /VERIFY FAILED/, "a counts run reported itself as a failed verification");
  // AND THE TALLY IS THE OTHER HALF OF THE EXIT RULE: nothing failed and
  // nothing was read, so it is `!verified` that has to make this nonzero.
  assert.match(c.out, /0 read, 0 not read/, c.out);
});

test("an argv the parser cannot read exits NONZERO and reads nothing", () => {
  // THE EXIT CODE IS THE OBSERVABLE HALF and `main` is not exported, so only a
  // spawned process can say this. The refusal sits ABOVE the credential check,
  // which is why this case supplies no key and still gets the argument's own
  // sentence rather than "SUPABASE_SERVICE_KEY is not set".
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "site_repairbench_1" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    tables: { bookings: { ...BOOKINGS, columns: ["id", "created_at", "who", "drop_off_day date"] } },
  });

  // The owner's reproduction as the pre-fix shell really produced it.
  const split = run("backend-repair.mjs",
    ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "drop_off_day", "--apply"], f);
  assert.equal(split.code, 2, "a split argv did not exit 2:\n" + split.out);
  assert.match(split.out, /cannot read the arguments: two modes were named/, split.out);
  assert.match(split.out, /nothing was read or written/, split.out);
  assert.equal(split.statements.length, 0, "a refused argv still read something: " + JSON.stringify(split.statements));
  // AND IT NEVER ANNOUNCES A MODE — naming one for a parse it refused is the
  // confusion the refusal exists to stop.
  assert.doesNotMatch(split.out, /^mode:/m, "a refused run still printed a mode:\n" + split.out);

  for (const [argv, why] of [
    [["--counts", "--wat"], /unrecognised argument/],
    [["--counts", "--column"], /no value/],
    [["--apply", "--apply"], /was given twice/],
  ]) {
    const r = run("backend-repair.mjs", argv, f);
    assert.equal(r.code, 2, `${JSON.stringify(argv)} exited ${r.code}:\n${r.out}`);
    assert.match(r.out, why, r.out);
    assert.equal(r.statements.length, 0, `${JSON.stringify(argv)} read something`);
  }

  // THE CONTROL: the same scenario, a well-formed argv — it runs and reads.
  const ok = run("backend-repair.mjs",
    ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "drop_off_day"], f);
  assert.notEqual(ok.code, 2, "a good argv was refused as malformed:\n" + ok.out);
  assert.match(ok.out, /^mode: counts/m, ok.out);
  assert.ok(ok.statements.length > 0, "the control read nothing, so the refusals above prove nothing");
});

test("the repair is scoped to five sites by name, and a sixth is refused before anything is read", () => {
  // THE SCOPE IS A WALL IN THE SCRIPT, NOT A PROMISE IN THE WORKFLOW FORM.
  // Driven as a process, because that is the only place the exit code and the
  // "nothing was read" half are both observable.
  assert.deepEqual(REPAIR_SITES, ["ashgrove-1", "fretwork-1", "northgroup-5", "repairbench-1", "washhouse-1"]);

  // A NAME OFF THE LIST IS REFUSED BY NAME. A silent filter would print
  // "nothing to do", which reads as "that site was already fine".
  const f = scenario({
    sites: [{ slug: "northgroup-9", uid: "u1", neon_db: "" }, { slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "northgroup-9", neon_conn: PROJ }, { slug: "repairbench-1", neon_conn: PROJ }],
    tables: { bookings: BOOKINGS },
  });
  const off = run("backend-repair.mjs", ["--apply", "--slug", "northgroup-9"], f);
  assert.equal(off.code, 2, "an out-of-scope slug exited " + off.code + ":\n" + off.out);
  assert.match(off.out, /not one of the five sites/);
  assert.equal(off.statements.length, 0, "it read something: " + JSON.stringify(off.statements));
  assert.ok(!/nothing to do/.test(off.out), "a refusal must not read as `nothing to do`");

  // AND WITH NO SLUG THE LOOP STILL VISITS ONLY THE FIVE — the control, without
  // which a wall that refused EVERY site would pass the assertion above.
  const all = run("backend-repair.mjs", ["--preview"], f);
  assert.equal(all.code, 0, all.out);
  assert.match(all.out, /repairbench-1/);
  assert.ok(!/northgroup-9 \[/.test(all.out), "an out-of-scope site was visited:\n" + all.out);
});

test("apply -> verify -> repeat, on a database with no `_meta` at all", () => {
  // THE FOURTH DEFECT, END TO END AND AS PROCESSES. The site's reference is
  // blank, its database holds `bookings`, and it has no `_meta` — so the
  // recovery has to create the metadata table before it can write the
  // declaration it just rebuilt. Then the verify must pass, and a second apply
  // must find nothing to do.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    metaTable: false, meta: null,
    tables: { bookings: BOOKINGS },
  });

  const first = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], f);
  assert.equal(first.code, 0, "the apply exited " + first.code + ":\n" + first.out);
  assert.match(first.out, /reference: written/);
  assert.match(first.out, /schema: recovered .*bookings/);
  assert.ok(first.statements.some((s) => /CREATE TABLE IF NOT EXISTS _meta/i.test(s.q || "")), "`_meta` was never created");
  assert.ok(first.statements.some((s) => /INSERT INTO _meta/i.test(s.q || "")), "the declaration was never written");

  const verify = run("backend-repair.mjs", ["--verify", "--slug", "repairbench-1"], f);
  assert.equal(verify.code, 0, "the verify after a good apply exited " + verify.code + ":\n" + verify.out);
  assert.match(verify.out, /1 verified, 0 not verified/);

  const again = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], f);
  assert.equal(again.code, 0, "the repeat exited " + again.code + ":\n" + again.out);
  assert.match(again.out, /reference: (skip|already-set)/, "the repeat wrote the reference again");
  assert.match(again.out, /schema: nothing missing/, "the repeat rewrote the declaration");

  // AND NOT ONE APPLICATION TABLE WAS TOUCHED, across all three runs.
  for (const r of [first, verify, again]) {
    for (const s of r.statements) {
      const q = String(s.q || "");
      if (!q) continue;
      assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE FROM)\b/i.test(q), "a repair run issued: " + q);
      assert.ok(!/CREATE TABLE(?! IF NOT EXISTS _meta)/i.test(q), "a repair run created an application table: " + q);
      assert.ok(!/INSERT INTO (?!_meta)/i.test(q), "a repair run wrote an application row: " + q);
    }
  }
});

test("backend-repair --preview writes nothing and still exits 0", () => {
  // A preview is a REPORT. It exits 0 whatever it found, which is what keeps
  // the nonzero exits above meaningful.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    metaTable: false, meta: null,
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--preview", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /preview — nothing written/);
  assert.ok(!r.statements.some((s) => /INSERT INTO _meta|CREATE TABLE/i.test(s.q || "")), "the preview wrote something");
  assert.ok(!r.statements.some((s) => s.supabase), "the preview wrote to Supabase");
});

test("backend-repair --apply exits NONZERO when identity refuses", () => {
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    serverDb: "site_someone_else",
    meta: JSON.stringify({ tables: [] }),
    tables: { bookings: BOOKINGS },
  });
  const r = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], f);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /NOT PROVEN/);
  assert.ok(!r.statements.some((s) => s.supabase), "a refused identity still wrote the reference");
});

// ── the reference-only bound ────────────────────────────────────────────────
//
// Owner, 2026-09-15: *"Keep the approval limited to the one reference write.
// Another preview does not enforce that boundary, and retrospective checking
// cannot undo an unauthorized schema change… Demonstrate this through the
// actual command: make schema recovery necessary, select reference-only, and
// prove that the reference is repaired while no metadata write occurs."*
//
// So the scenario below is the one where a full `--apply` DOES write `_meta` —
// same shape as the apply→verify→repeat case above, which asserts that it
// creates the table and inserts the declaration. Running the same database
// under `--apply-reference` must repair the reference and leave `_meta` alone.
// Anything weaker (a database with nothing to recover) would pass with the gate
// deleted, which is this repository's own "a negative assertion must prove its
// observer is alive".

/** A site whose reference is blank AND whose database has a table no spec declares. */
const NEEDS_BOTH = () => ({
  sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "" }],
  projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
  metaTable: false, meta: null,
  tables: { bookings: BOOKINGS },
});

/** Every way this script can touch `_meta`, as the fixture records them. */
const metaWrites = (r) => r.statements.filter((s) =>
  /INSERT INTO _meta|CREATE TABLE IF NOT EXISTS _meta/i.test(String(s.q || "")));

test("apply-reference repairs the reference and writes NO metadata, with recovery outstanding", () => {
  const f = NEEDS_BOTH();
  const file = scenario(f);

  // THE OBSERVER, ALIVE: the same database under a full apply writes `_meta`.
  // Without this the case below could pass because nothing needed recovering.
  const control = run("backend-repair.mjs", ["--apply", "--slug", "repairbench-1"], scenario(NEEDS_BOTH()));
  assert.equal(control.code, 0, control.out);
  assert.ok(metaWrites(control).length >= 2, "the control did not write _meta, so the case below proves nothing:\n" + control.out);

  const r = run("backend-repair.mjs", ["--apply-reference", "--slug", "repairbench-1"], file);
  assert.equal(r.code, 0, "apply-reference exited " + r.code + ":\n" + r.out);

  // 1. THE REFERENCE IS REPAIRED — in the output and in the store.
  assert.match(r.out, /reference: written site_repairbench_1/, r.out);
  assert.ok(r.statements.some((s) => s.supabase === "PATCH site_backends"), "the reference was never written");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).sites[0].neon_db, dbNameForSite("repairbench-1"));

  // 2. NOT ONE METADATA WRITE, of either kind.
  //
  // TWO WINDOWS ON ONE EVENT, AND THE REDUNDANCY IS DELIBERATE: `metaWrites`
  // reads the statements the script SENT, the two below read what the database
  // ENDED UP holding. Measured redundant — a statement never sent cannot change
  // the store — and kept because they fail differently: the first names the
  // statement, the second is what a person checking the database would look at.
  // A sweep cannot say a redundancy is deliberate, so it is said here.
  assert.deepEqual(metaWrites(r), [], "apply-reference touched _meta");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).metaTable, false, "apply-reference created the _meta table");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).meta, null, "apply-reference wrote a declaration");

  // 3. THE SCHEMA WORK IS REPORTED, SEPARATELY AND BY NAME — not silently
  //    dropped, which would read as "there was nothing to do".
  assert.match(r.out, /schema: would-recover .*bookings/, r.out);
  assert.match(r.out, /schema: NOT APPLIED — this run is reference-only/, r.out);
  assert.match(r.out, /1 schema\(s\) REPORTED AND NOT APPLIED/, r.out);
  assert.match(r.out, /0 schema\(s\) recovered/, r.out);

  // 4. AND NO APPLICATION TABLE ANYWHERE NEAR IT.
  for (const s of r.statements) {
    const q = String(s.q || "");
    if (!q) continue;
    assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE FROM|INSERT INTO)\b/i.test(q), "apply-reference issued: " + q);
    assert.ok(!/CREATE /i.test(q), "apply-reference created something: " + q);
  }
});

test("apply-reference keeps the wrong-identity refusal", () => {
  const r = run("backend-repair.mjs", ["--apply-reference", "--slug", "repairbench-1"], scenario({
    ...NEEDS_BOTH(), serverDb: "site_someone_else",
  }));
  assert.equal(r.code, 1, "a refused identity exited 0:\n" + r.out);
  assert.match(r.out, /NOT PROVEN/);
  assert.ok(!r.statements.some((s) => s.supabase), "a refused identity still wrote the reference");
  assert.deepEqual(metaWrites(r), [], "a refused identity still wrote _meta");
});

test("apply-reference run twice writes the reference once, and never _meta", () => {
  const file = scenario(NEEDS_BOTH());

  const first = run("backend-repair.mjs", ["--apply-reference", "--slug", "repairbench-1"], file);
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /reference: written/);

  const again = run("backend-repair.mjs", ["--apply-reference", "--slug", "repairbench-1"], file);
  assert.equal(again.code, 0, "the repeat exited " + again.code + ":\n" + again.out);
  assert.match(again.out, /reference: (skip|already-set)/, "the repeat wrote the reference again");
  // The recovery is STILL outstanding and still reported — a repeat does not
  // quietly stop mentioning the work it is not doing.
  assert.match(again.out, /schema: NOT APPLIED — this run is reference-only/, again.out);
  for (const r of [first, again]) assert.deepEqual(metaWrites(r), [], "a reference-only run wrote _meta");
});

// ── repairbench-count-fix ───────────────────────────────────────────────────

const COUNT_SCENARIO = (fnTable, counts) => ({
  sites: [{ slug: "repairbench-1", uid: "u1", neon_db: dbNameForSite("repairbench-1") }],
  projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
  meta: JSON.stringify({ tables: [] }),
  tables: { bookings: BOOKINGS },
  fnDef: "CREATE OR REPLACE FUNCTION public.count_booked_repairs()\n RETURNS bigint\n LANGUAGE sql\n SECURITY DEFINER\nAS $function$ SELECT count(*) FROM " + fnTable + " $function$\n",
  counts,
});

test("count-fix --verify exits NONZERO while the function still counts the wrong table", () => {
  // THE EXACT OBSERVATION: bookings=3, direct=0, route=0 — and it exited 0,
  // because `--verify` was a branch inside the "nothing to rewrite" arm and
  // fell through to the preview.
  const f = scenario(COUNT_SCENARIO("repairs", { bookings: 3, repairs: 0 }));
  const r = run("repairbench-count-fix.mjs", ["--verify"], f);
  assert.equal(r.code, 1, "a failing verification exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /VERIFY FAILED/);
  assert.match(r.out, /the three counts disagree/);
  assert.match(r.out, /still counts "repairs"/);
  assert.ok(!/preview — nothing written/.test(r.out), "verify fell through to the preview again");
  // AND IT WROTE NOTHING.
  assert.ok(!r.statements.some((s) => /CREATE OR REPLACE FUNCTION/i.test(s.q || "")), "--verify rewrote the function");
});

test("count-fix apply -> verify: the three numbers agree and the verify passes", () => {
  const f = scenario(COUNT_SCENARIO("repairs", { bookings: 3, repairs: 0 }));
  const apply = run("repairbench-count-fix.mjs", ["--apply"], f);
  assert.equal(apply.code, 0, "the apply exited " + apply.code + ":\n" + apply.out);
  assert.match(apply.out, /PASS — all three agree/);
  // THE REWRITE KEPT EVERY OTHER ATTRIBUTE, because it is Postgres's own
  // `pg_get_functiondef` output with one identifier changed.
  const ddl = (apply.statements.find((s) => /CREATE OR REPLACE FUNCTION/i.test(s.q || "")) || {}).q || "";
  assert.match(ddl, /count_booked_repairs/, "the function was renamed");
  assert.match(ddl, /SECURITY DEFINER/, "the rewrite dropped SECURITY DEFINER");
  assert.match(ddl, /FROM bookings/);

  const verify = run("repairbench-count-fix.mjs", ["--verify"], f);
  assert.equal(verify.code, 0, "the verify after a good apply exited " + verify.code + ":\n" + verify.out);
  assert.match(verify.out, /VERIFY PASSED/);

  // AND A SECOND APPLY REFUSES rather than clobbering a function already fixed.
  const again = run("repairbench-count-fix.mjs", ["--apply"], f);
  assert.equal(again.code, 1, again.out);
  assert.match(again.out, /REFUSED: already-names-bookings/);
});

test("count-fix --verify fails when the site's own route disagrees with the database", () => {
  // The route is the call `/status` really makes, and it is the reader the
  // other two cannot stand in for. A 200 from the page is deliberately not one
  // of the three numbers.
  const f = scenario(COUNT_SCENARIO("bookings", { bookings: 3 }));
  const ok = run("repairbench-count-fix.mjs", ["--verify"], f);
  assert.equal(ok.code, 0, ok.out);
  assert.ok(ok.statements.some((s) => s.route === "count_booked_repairs"), "the verify never called the site's own route");

  const broken = scenario(COUNT_SCENARIO("bookings", { bookings: 3, ...{} }));
  // The function reads `bookings` but the table is empty: direct and route both
  // answer 0 while the row count says 3 — a real disagreement, and a failure.
  const r = run("repairbench-count-fix.mjs", ["--verify"], scenario({ ...JSON.parse(readFileSync(broken, "utf8")), counts: { bookings: 3 }, fnDef: "CREATE OR REPLACE FUNCTION public.count_booked_repairs()\n RETURNS bigint\nAS $function$ SELECT count(*) FROM archive $function$\n" }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /VERIFY FAILED/);
});

test("the count correction never leaves repairbench-1, and never touches an application table", () => {
  const f = scenario(COUNT_SCENARIO("repairs", { bookings: 3, repairs: 0 }));
  const r = run("repairbench-count-fix.mjs", ["--apply"], f);
  assert.equal(r.code, 0, r.out);
  for (const s of r.statements) {
    if (s.slug !== undefined) assert.equal(s.slug, "repairbench-1", "a call left the one site: " + JSON.stringify(s));
    if (s.db) assert.equal(s.db, dbNameForSite("repairbench-1"), "a statement went to " + s.db);
    const q = String(s.q || "");
    if (!q) continue;
    assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE FROM)\b/i.test(q), "the correction issued: " + q);
    assert.ok(!/INSERT INTO |CREATE TABLE/i.test(q), "the correction wrote a row or a table: " + q);
  }
});

// ── the read-only aggregate, as a real process ──────────────────────────────

test("counts groups by a date column, busiest first, and writes nothing", () => {
  // Owner, 2026-09-16: establish the expected result from the live data
  // WITHOUT changing it. The claim this case makes is that the mode is
  // read-only when actually RUN — which only a spawned process can say,
  // because the exit rule and every statement live in `main`.
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "site_repairbench_1" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    meta: JSON.stringify({ tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] }] }),
    // THE TYPES ARE THE FIXTURE'S SUBJECT HERE, not decoration: this mode is
    // decided by the catalog's own `data_type`, so a column list with no types
    // could only ever exercise the refusal.
    tables: { bookings: { ...BOOKINGS, columns: ["id", "created_at", "who", "drop_off_day date"] } },
    groups: { bookings: { "2026-10-03": 1, "2026-10-01": 2 } },
  });
  const r = run("backend-repair.mjs", ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "drop_off_day"], f);

  assert.equal(r.code, 0, "a good aggregate exited " + r.code + ":\n" + r.out);
  assert.match(r.out, /identity PROVEN/, "the aggregate ran without proving whose database it is:\n" + r.out);
  // BUSIEST FIRST, read off the printed order rather than from a set.
  const rows = r.out.split("\n").map((l) => /^\s+(\S+)\s+(\d+)\s*$/.exec(l.replace(/ /g, " "))).filter(Boolean);
  assert.deepEqual(rows.map((m) => [m[1], Number(m[2])]), [["2026-10-01", 2], ["2026-10-03", 1]],
    "the printed groups are not date-then-count, busiest first:\n" + r.out);
  assert.match(r.out, /2 group\(s\), 3 row\(s\) in total/, "the total is not printed:\n" + r.out);

  // ── READ-ONLY, ASSERTED OVER EVERY STATEMENT THE PROCESS REALLY SENT ──────
  // The negative is the half an "it worked" reading cannot establish.
  for (const s of r.statements) {
    assert.doesNotMatch(s.q, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i,
      "the aggregate issued a writing statement: " + s.q);
  }
  // …and it really reached the SITE's database, not the project's default.
  assert.ok(r.statements.some((s) => s.db === "site_repairbench_1"), "never reached the site's own database");
  assert.ok(r.statements.some((s) => /GROUP BY 1 ORDER BY 2 DESC/.test(s.q)), "the aggregate statement was never sent");
});

test("counts refuses a text column, and refusing exits NONZERO", () => {
  const f = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "site_repairbench_1" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    meta: JSON.stringify({ tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] }] }),
    // A DATE COLUMN SITS BESIDE THE TEXT ONE DELIBERATELY. With every column
    // text, "the text column was refused" is satisfied by a mode that refuses
    // everything — the observer has to be alive in the other direction, and the
    // control below is what says so.
    tables: { bookings: { ...BOOKINGS, columns: ["id", "created_at", "who", "drop_off_day date"] } },
    groups: { bookings: { "2026-10-01": 2 } },
  });

  // THE PRIVACY WALL, DRIVEN. `who` is a text column; grouping by it would
  // return customer details, and the refusal is the tool's rather than the
  // caller's discipline.
  const text = run("backend-repair.mjs", ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "who"], f);
  assert.equal(text.code, 1, "grouping by a text column exited 0:\n" + text.out);
  assert.match(text.out, /REFUSED \(not-a-date-column\)/, text.out);
  assert.ok(!text.statements.some((s) => /GROUP BY/i.test(s.q)), "a refused aggregate still ran a query");
  // A REFUSAL IS COUNTED, and the tally is where that shows: the exit code
  // alone cannot say so, because a run that refused has also read nothing and
  // `!verified` would make it nonzero either way.
  assert.match(text.out, /0 read, 1 not read/, "a refused plan is not counted as a failure:\n" + text.out);
  // AND THE REFUSAL IS THE LAST WORD. Without the `continue` the run goes on to
  // announce a read it cannot make — "REFUSED" followed by "reading:" is a
  // report that contradicts itself one line later.
  assert.doesNotMatch(text.out, /reading:/, "a refused aggregate went on to announce a read:\n" + text.out);

  // THE CONTROL: the same table, the same run, the date column — accepted.
  const dated = run("backend-repair.mjs", ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "drop_off_day"], f);
  assert.equal(dated.code, 0, "the control run refused a date column too — the refusal above proves nothing:\n" + dated.out);

  // A column that is not there is refused too, and says which are.
  const gone = run("backend-repair.mjs", ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "nope"], f);
  assert.equal(gone.code, 1);
  assert.match(gone.out, /REFUSED \(no-such-column\)/);
  assert.match(gone.out, /drop_off_day/, "the refusal does not say which columns are there");

  // And a run that names no column at all cannot read as "no rows".
  const bare = run("backend-repair.mjs", ["--counts", "--slug", "repairbench-1"], f);
  assert.equal(bare.code, 1, "an aggregate with no table or column exited 0:\n" + bare.out);
  assert.match(bare.out, /REFUSED \(need-table-and-column\)/);

  // THE SCOPE WALL STILL APPLIES — the aggregate is not a way around it.
  const off = run("backend-repair.mjs", ["--counts", "--slug", "not-a-repair-site", "--table", "bookings", "--column", "drop_off_day"], f);
  assert.equal(off.code, 2, "an out-of-scope slug was not refused by the scope wall:\n" + off.out);
  assert.equal(off.statements.length, 0, "an out-of-scope aggregate still read something");

  // ── AND IDENTITY IS PROVEN BEFORE A SINGLE ROW IS COUNTED ─────────────────
  //
  // A number read out of a database nobody proved belongs to this site is a
  // number about somebody else's rows, which is worse than no number at all.
  // The server answers a different database here, so link 3 of the chain
  // refuses — and the assertion is that NOTHING WAS GROUPED after it, which is
  // the half an exit code cannot carry (a refusal exits 1 either way).
  const wrong = scenario({
    sites: [{ slug: "repairbench-1", uid: "u1", neon_db: "site_repairbench_1" }],
    projects: [{ slug: "repairbench-1", neon_conn: PROJ }],
    serverDb: "somebody_elses_db",
    tables: { bookings: { ...BOOKINGS, columns: ["id", "created_at", "who", "drop_off_day date"] } },
    groups: { bookings: { "2026-10-01": 2 } },
  });
  const unproven = run("backend-repair.mjs", ["--counts", "--slug", "repairbench-1", "--table", "bookings", "--column", "drop_off_day"], wrong);
  assert.equal(unproven.code, 1, "an unproven database still exited 0:\n" + unproven.out);
  assert.match(unproven.out, /identity NOT PROVEN/, unproven.out);
  assert.ok(!unproven.statements.some((s) => /GROUP BY/i.test(s.q || "")),
    "the aggregate ran against a database it had not proved:\n" + JSON.stringify(unproven.statements));
});
