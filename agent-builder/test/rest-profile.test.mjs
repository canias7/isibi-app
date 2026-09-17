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
  const STORES = ["store.mjs", "work.mjs", "approvals.mjs", "capabilities.mjs", "automation-store.mjs"];
  let read = 0;
  for (const f of STORES) {
    const src = fs.readFileSync(path.join(SRC, f), "utf8");
    const code = src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
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
  // passes every "does not contain" above.
  assert.equal(read, 5, "the census read no file");
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
