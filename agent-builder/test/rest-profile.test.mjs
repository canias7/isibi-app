/**
 * WHICH SCHEMA A PostgREST REQUEST NAMES — the rule, and the fixture that enforces it.
 *
 * ⚠ **THE DEFECT THIS FILE EXISTS FOR WAS INVISIBLE FROM BOTH SIDES AT ONCE.** Ten of the
 * fourteen capability operations sent `Accept-Profile` on a POST — which PostgREST ignores,
 * so those requests named no schema at all and resolved against the default one, where
 * none of `agent`'s functions exist. Among them was the `read_automation` pre-check that
 * `pause_automation` and `run_automation` each make first, so on a real PostgREST those two
 * would have failed at their own first step. And `npm run verify:tools` passed 78 checks
 * over it, because `scripts/local-rest.mjs` **read the path and ignored the headers
 * entirely.** *A shim more permissive than the thing it stands in for hides a defect
 * exactly as well as one that is less capable.*
 *
 * So there are two subjects here and they are different: the RULE (`src/rest-profile.mjs`,
 * which the five stores ask) and the FIXTURE'S OWN WALL (the shim's gate, which is what
 * makes a green demonstration evidence about the headers rather than silence about them).
 * **A wall nobody can drive is a wall nobody is guarding**, and this one is a fixture's,
 * which no other test in this directory reaches.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { profileHeader, profileFor, READ_VERBS } from "../src/rest-profile.mjs";
import { startLocalRest } from "../scripts/local-rest.mjs";

const SRC = path.join(import.meta.dirname, "..", "src");

test("`Accept-Profile` is for GET and HEAD, and every other verb takes `Content-Profile`", () => {
  assert.deepEqual([...READ_VERBS], ["GET", "HEAD"]);
  for (const v of ["GET", "HEAD", "get", "head", "Get"]) {
    assert.equal(profileHeader(v), "accept-profile", `${v} is a read`);
  }
  // ⚠ POST IS THE ONE THAT MATTERS, because EVERY PostgREST RPC is a POST however purely
  // the function behind it reads — which is the whole of the defect.
  for (const v of ["POST", "post", "PATCH", "PUT", "DELETE", "OPTIONS"]) {
    assert.equal(profileHeader(v), "content-profile", `${v} is a write to PostgREST`);
  }
});

test("⚠ a method that is not a string is REFUSED rather than coerced, and fails toward the write header", () => {
  // `String(["GET"])` is `"GET"` — this repository's most-repeated value trap, and this
  // module's own first draft had it, in the four lines written to close another instance
  // of the same class.
  for (const v of [["GET"], ["HEAD"], null, undefined, 7, {}, true, Symbol("GET")]) {
    assert.equal(profileHeader(v), "content-profile", `${String(v?.toString?.() ?? v)} is not a method`);
  }
  // AND THE DIRECTION IS THE CHEAP ONE TO BE WRONG IN: `Content-Profile` on a GET is
  // ignored and costs nothing, while `Accept-Profile` on a POST silently loses the schema.
});

test("`profileFor` puts the schema under exactly one name, and it is the method's", () => {
  assert.deepEqual(profileFor("GET", "agent"), { "accept-profile": "agent" });
  assert.deepEqual(profileFor("POST", "agent"), { "content-profile": "agent" });
  for (const m of ["GET", "POST"]) {
    const h = profileFor(m, "agent");
    assert.equal(Object.keys(h).length, 1, "both headers were sent, so the rule decided nothing");
  }
});

test("⚠ NO STORE DECIDES THE PROFILE FOR ITSELF — a census over every one that speaks PostgREST", () => {
  // The defect kept happening because each store decided on its own, behind a flag named
  // for what the FUNCTION does (`write`) rather than for what the REQUEST is. Comments are
  // blanked first: several of these files explain this very rule, which is this
  // repository's own most-repeated scanning trap.
  // ⚠ **THE LIST IS DERIVED, AND IT WAS HAND-KEPT UNTIL IT MISSED ONE.** It named five
  // stores; `connections.mjs` has spoken PostgREST since the connection round and was in
  // neither the list nor the count, so the one file holding a customer's credential was
  // outside the census that exists because each store deciding for itself is how the
  // defect happened. A hand-typed list in a census is one of two copies of it, and this is
  // the half that goes stale in silence — **a census that does not read a file reports
  // nothing about it, and reports it as a pass.** So the subject is now "every file under
  // `src/` that speaks PostgREST", which a store added next month joins by existing.
  const speaks = (code) => /\/rest\/v1\//.test(code);
  const blank = (src) => src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
  const STORES = fs.readdirSync(SRC)
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => speaks(blank(fs.readFileSync(path.join(SRC, f), "utf8"))))
    .sort();
  let read = 0;
  for (const f of STORES) {
    const code = blank(fs.readFileSync(path.join(SRC, f), "utf8"));
    assert.match(code, /profileFor\(/, `${f} does not ask the one rule`);
    // AND IT IMPORTS IT. Two of the five used it WITHOUT importing it and the modules
    // still LOADED — the reference is inside a function, so `node --check` passes and the
    // throw waits for the first request. 89 tests went red on it, which is the suite
    // being the thing that caught it.
    assert.match(code, /from "\.\/rest-profile\.mjs"/, `${f} uses the rule without importing it`);
    for (const literal of ['"accept-profile"', '"content-profile"', "'accept-profile'", "'content-profile'"]) {
      assert.ok(!code.includes(literal), `${f} names ${literal} itself instead of asking the rule`);
    }
    read++;
  }
  // A NEGATIVE ASSERTION MUST PROVE ITS OBSERVER IS ALIVE: a census that read no file
  // passes every "does not contain" above. A FLOOR rather than an equality now, because an
  // equality is the hand-kept count wearing a derivation's clothes — it would go red on an
  // honest seventh store and tell somebody a working one is broken. What it must not do is
  // go quiet, so the floor is what the directory really had when this was derived, and the
  // stores it names by hand are the ones whose absence would mean the needle stopped
  // matching rather than the store having gone.
  assert.ok(read >= 6, `the census read ${read} files, which is fewer than the directory had`);
  // ⚠ **AND THE NEEDLE'S OWN BLIND SPOT IS CLOSED BY A WIDER ONE RATHER THAN STATED.** A
  // store that built its path in pieces would not contain `/rest/v1/` and would drop out of
  // the list in silence — which is the hand-kept list's fault arriving through a regex. So
  // the WIDER question is asked too: every file that takes a project URL at all
  // (`opts.url`) either speaks PostgREST or is named here as one that does not. There is
  // exactly one, `auth.mjs`, which talks to GoTrue's `/auth/v1/user` and therefore has no
  // schema to name — so a new store is caught by the wide needle and has to be explained,
  // rather than being missed by the narrow one.
  const NOT_POSTGREST = ["auth.mjs"];
  const takesUrl = fs.readdirSync(SRC)
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => /opts\.url/.test(blank(fs.readFileSync(path.join(SRC, f), "utf8"))))
    .sort();
  assert.ok(takesUrl.length > STORES.length, "the wide needle found no more than the narrow one, so it is not wider");
  assert.deepEqual(
    takesUrl.filter((f) => !STORES.includes(f)),
    NOT_POSTGREST,
    "a file takes a project URL and neither speaks PostgREST nor is declared as not speaking it",
  );
  for (const f of ["store.mjs", "work.mjs", "approvals.mjs", "capabilities.mjs", "automation-store.mjs", "connections.mjs"]) {
    assert.ok(STORES.includes(f), `${f} speaks PostgREST and the census did not find it`);
  }
});

/**
 * THE FIXTURE'S OWN WALL, driven end to end over real HTTP.
 *
 * It needs no database: the gate sits above every route, so a refusal is answered before
 * anything reaches psql. The PASS-THROUGH cases are the controls and they are asserted as
 * *the answer is not a PostgREST schema-cache code* — which is true whatever happens below
 * the gate, and is honest about what it proves: that the gate let the request through.
 */
test("⚠ THE LOCAL SHIM ENFORCES PostgREST'S PROFILE RULE, in both directions, with its controls", async (t) => {
  const rest = await startLocalRest({ db: "postgres_no_such_db_for_this_test", quiet: true });
  t.after(() => rest.close?.() ?? rest.server?.close?.());
  const ask = async (method, p, extra) => {
    const r = await fetch(`${rest.url}/rest/v1/${p}`, {
      method,
      headers: { apikey: "k", authorization: "Bearer k", "content-type": "application/json", ...extra },
      body: method === "GET" ? undefined : "{}",
      // ⚠ BOUNDED, because an unbounded `fetch` here cost a whole day of CI. Undici's own
      // wall is 300 SECONDS of waiting for headers, and what arrives after it is the word
      // `fetch failed` — which names neither the request nor the reason. This is well past
      // any real answer from a shim on the loopback, so it only ever fires on a hang, and
      // when it does the failure says which call it was.
      signal: AbortSignal.timeout(20_000),
    });
    let body = null;
    try { body = JSON.parse(await r.text()); } catch { /* not json */ }
    return { status: r.status, code: body?.code ?? null, message: String(body?.message ?? "") };
  };
  const PGRST = /^PGRST\d\d\d$/;

  // ── THE DEFECT ITSELF: a read RPC sent as a POST with the read header. ──────────
  const defect = await ask("POST", "rpc/read_automation", { "accept-profile": "agent" });
  assert.equal(defect.status, 404);
  assert.equal(defect.code, "PGRST202", "a function is PGRST202; a relation would be PGRST205");
  assert.match(defect.message, /accept-profile/, "the refusal does not say which header was sent instead");

  // ── and its mirror, so the rule is not simply 'always want content-profile'. ────
  const mirror = await ask("GET", "runs?select=id", { "content-profile": "agent" });
  assert.equal(mirror.status, 404);
  assert.equal(mirror.code, "PGRST205", "a relation is PGRST205");

  // ── no profile at all is the same answer, which is what 'absent means the default
  //    schema' amounts to. ───────────────────────────────────────────────────────
  assert.equal((await ask("POST", "runs", {})).code, "PGRST205");
  assert.equal((await ask("GET", "runs?select=id", {})).code, "PGRST205");

  // ── a schema nobody exposes is a DIFFERENT refusal, because it needs a different
  //    thing done about it. ──────────────────────────────────────────────────────
  const unexposed = await ask("POST", "rpc/read_automation", { "content-profile": "public" });
  assert.equal(unexposed.status, 406);
  assert.equal(unexposed.code, "PGRST106");
  assert.match(unexposed.message, /agent/, "the refusal does not say what would be accepted");

  // ── THE CONTROLS. Without these, a gate that refused EVERYTHING would pass every
  //    assertion above. ─────────────────────────────────────────────────────────
  for (const [method, p, extra, what] of [
    ["POST", "rpc/read_automation", { "content-profile": "agent" }, "a POST naming its schema"],
    ["GET", "runs?select=id", { "accept-profile": "agent" }, "a GET naming its schema"],
  ]) {
    const ok = await ask(method, p, extra);
    assert.ok(!PGRST.test(ok.code ?? ""), `${what} was refused by the profile gate: ${ok.code} ${ok.message}`);
  }
});

/**
 * ⚠ **THE FIXTURE THAT HOLDS THE WHOLE ENGINE SUITE OPEN, AND WHAT IT COST.**
 *
 * The two cases below are about this file's own fixture rather than about the product, and
 * they exist because that fixture stopped the engine's CI check passing for a whole day
 * without anything going red. The chain, measured end to end:
 *
 *   `sql()` reaches Postgres through `su postgres -c psql`. **For ROOT that needs no
 *   password** — which is what this session and every local sweep run as, so the child
 *   answers in milliseconds and the suite takes under six seconds. For any OTHER user `su`
 *   prints `Password: ` and BLOCKS ON STDIN, and `execFile` hands it a pipe nobody closes.
 *   A GitHub runner is the user `runner` and has no PostgreSQL at all, so the first request
 *   that PASSES the profile gate — one of the two controls above, which pass it on purpose —
 *   reached `sql()` and never came back. `fetch` gave up after undici's 300-second headers
 *   wall with the words `fetch failed`, and the hung child plus the open socket then kept
 *   `node --test` alive until the job's `timeout-minutes: 45`.
 *
 * **AND A TIMED-OUT JOB IS REPORTED AS `cancelled`, which is the reason nobody noticed.**
 * That is indistinguishable at a glance from a run superseded by a later push, and a branch
 * being pushed to all day produces plenty of those: twelve consecutive `agent deploy` runs
 * read `cancelled` and not one of them was about a push.
 *
 * MEASURED, as a non-root caller, before and after: before, the file does not exit at all
 * (killed at 122 seconds, and the bounded `fetch` above is not enough on its own — the child
 * and the socket outlive the failure); after, **568 tests, 0 failed, 5.6 seconds, exit 0.**
 */
test("⚠ THE SHIM LETS GO OF A CONNECTION NOBODY FINISHED, so a failed case can still exit", async () => {
  const net = await import("node:net");
  const rest = await startLocalRest({ db: "postgres_no_such_db_for_this_test", quiet: true });

  // A SOCKET THAT ASKS FOR NOTHING is what a failed case leaves behind: the request is in
  // flight, no response has been written, and the case is already over.
  const held = net.connect(rest.port, "127.0.0.1");
  await new Promise((r, x) => { held.once("connect", r); held.once("error", x); });
  held.write("GET /rest/v1/runs?select=id HTTP/1.1\r\nhost: x\r\napikey: k\r\n\r\n");

  /**
   * ⚠ **`server.close()` ALONE WAITS FOR OPEN CONNECTIONS, and that is the whole defect.**
   * The cleanup is in an `after` hook — correctly, since a failing case never reaches the end
   * of its own body — and it blocks anyway. So the property is not "close was called", it is
   * that closing FINISHES, and the bound is what makes that an assertion rather than a hang.
   */
  const closed = await Promise.race([
    rest.close().then(() => "closed"),
    new Promise((r) => setTimeout(() => r("still waiting"), 5000)),
  ]);
  held.destroy();
  assert.equal(closed, "closed",
    "the shim would not let go of an unfinished connection, so a failed case holds the run open");
});

test("⚠ THIS FILE EXITS FOR A USER WHO IS NOT ROOT — the condition CI actually runs under", async (t) => {
  /**
   * ⚠ **THE ONE CHECK THAT WOULD HAVE CAUGHT THIS, and it can only run where the defect is
   * invisible.** Locally everything is root, which is exactly why the hang never showed; so
   * the check drops to an unprivileged user and asks whether this file still terminates.
   *
   * ON A RUNNER IT SKIPS, VISIBLY, and that is not a gap: there the whole suite already runs
   * as an unprivileged user, so a regression fails the job itself rather than hiding. What
   * this covers is the machine where the suite is green for the wrong reason.
   */
  if (process.getuid?.() !== 0) { t.skip("already running unprivileged, which is the condition itself"); return; }
  const { spawnSync } = await import("node:child_process");
  const dir = path.join(import.meta.dirname, "..");
  const here = path.relative(dir, import.meta.filename);
  // CAN THE UNPRIVILEGED USER EVEN READ THE TREE? If not, a failure here would be about
  // permissions and not about the hang, so it says so rather than reporting a defect.
  const reachable = spawnSync("su", ["nobody", "-s", "/bin/sh", "-c", `cd ${dir} && test -r ${here}`],
    { encoding: "utf8", timeout: 20_000 });
  if (reachable.status !== 0) { t.skip("the unprivileged user cannot read this tree"); return; }

  /**
   * ⚠ **A CLEAN CHILD ENVIRONMENT, and this directory's mutation runner already records
   * why.** `node --test` stamps `NODE_TEST_CONTEXT` on everything it spawns, and a nested
   * `node --test` that sees it reports through the PARENT's channel instead of writing TAP to
   * its own stdout. MEASURED: the same command run by hand gives 1,906 bytes and run from
   * inside a test gives an empty string — so the observer assertions below were reading a
   * silence that had nothing to do with the child.
   */
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const out = spawnSync("su", ["nobody", "-s", "/bin/sh", "-c",
    `cd ${dir} && exec /usr/bin/env node --test ${here}`], { encoding: "utf8", timeout: 120_000, env });
  // ⚠ THE PROPERTY IS TERMINATION, ASKED FIRST. `killed` is what a hang looks like from here,
  // and reading a hang as a test failure is how this was missed for a day.
  assert.equal(out.killed !== true, true,
    `this file did not terminate for an unprivileged user — the shape that reads as CANCELLED in CI`);
  assert.equal(out.status, 0, `unprivileged run failed:\n${String(out.stdout).slice(-1200)}`);
  // AND THE OBSERVER IS ALIVE: a run that executed nothing would also exit 0 quietly.
  assert.match(String(out.stdout), /^# pass \d+$/m, "the unprivileged run reported no results");
  assert.doesNotMatch(String(out.stdout), /^# pass 0$/m, "the unprivileged run passed nothing");
});
