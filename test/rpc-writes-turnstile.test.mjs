// DECISION 2a (owner, 2026-10-22): the spam check covers a public database
// function call (`data/rpc/<fn>`) when the function is declared `writes: true`.
//
// Before this, `turnstileGate` read the table off the path (`rpc`), found no
// such table and passed every function call unchecked (audit G6). Reads and
// writes are both POSTs, so the declaration is what tells them apart. This
// file drives:
//   1. the gate's decision (`rpcGate`) with a stubbed config, spec and verifier;
//   2. the field end to end: tool -> cleaner -> fold -> merge -> engine ->
//      the `_meta` record the gate reads (through the real `applySiteSchema`);
//   3. the wiring in worker.js and the kit's write hooks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as tt from "../site-turnstile.mjs";
import { FUNCTION_ITEM } from "../builder/site-table.mjs";
import { cleanAdd, foldAdds } from "../builder/site-add.mjs";
import { mergeAddonSchema } from "../builder/site-addon.mjs";
import { normalizeSchema, applySiteSchema, TOOL_FIELDS } from "../site-schema.mjs";

const JSON_T = "application/json";
const SPEC = {
  tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }] }],
  functions: [
    { name: "book_slot", args: [], returns: "void", internal: false, writes: true },
    { name: "slots_left", args: [], returns: "int", internal: false },
  ],
};

/** A verifier that records whether Cloudflare was asked, and answers `ok`. */
function deps({ secret = "s3cret", spec = SPEC, cfOk = true } = {}) {
  const calls = [];
  return {
    calls,
    d: {
      config: async () => ({ secret }),
      spec: async () => spec,
      post: async (url, form) => {
        calls.push({ url, token: form.get("response") });
        return new Response(JSON.stringify({ success: cfOk }), { status: 200 });
      },
    },
  };
}
const gate = (d, path, body, ct = JSON_T) => {
  assert.equal(typeof tt.rpcGate, "function", "site-turnstile.mjs exports rpcGate");
  return tt.rpcGate(d, { path, sent: body === undefined ? "" : JSON.stringify(body), contentType: ct, ip: "" });
};

test("a writes=true function without a token is refused when Turnstile is on", async () => {
  const { d, calls } = deps();
  const r = await gate(d, "rpc/book_slot", { who: "x" });
  assert.ok(r && r.refused, "a declared write passed with no token: " + JSON.stringify(r));
  // An empty body (a function with no arguments) carries no token either.
  const r2 = await gate(d, "rpc/book_slot", undefined);
  assert.ok(r2 && r2.refused, "an empty-body write passed: " + JSON.stringify(r2));
  // A trailing slash or a different case does not slip past.
  assert.ok((await gate(d, "rpc/Book_Slot/", { who: "x" })).refused, "case/trailing slash bypassed the gate");
  assert.equal(calls.length, 0, "no token means no call to Cloudflare");
});

test("…and with a valid token it passes, the token stripped from the arguments", async () => {
  const { d, calls } = deps();
  const r = await gate(d, "rpc/book_slot", { who: "x", [tt.TOKEN_FIELD]: "tok-1" });
  assert.ok(r && !r.refused, "a verified write was refused: " + JSON.stringify(r));
  assert.deepEqual(JSON.parse(r.sent), { who: "x" }, "the token field reached the function's arguments");
  assert.equal(calls.length, 1, "the token was not verified");
  assert.equal(calls[0].token, "tok-1");
  // A token Cloudflare rejects is refused.
  const bad = deps({ cfOk: false });
  assert.ok((await gate(bad.d, "rpc/book_slot", { [tt.TOKEN_FIELD]: "forged" })).refused, "a rejected token passed");
});

test("a read function (writes absent) passes without a token", async () => {
  const { d, calls } = deps();
  const r = await gate(d, "rpc/slots_left", {});
  assert.ok(r && !r.refused, "a read was refused: " + JSON.stringify(r));
  assert.equal(calls.length, 0);
  // An undeclared name and a non-boolean `writes` are not gated either.
  const odd = deps({ spec: { functions: [{ name: "f", writes: "yes" }] } });
  assert.ok(!(await gate(odd.d, "rpc/f", {})).refused, "a non-boolean writes was read as true");
  assert.ok(!(await gate(d, "rpc/nope", {})).refused);
});

test("Turnstile off: every function call passes, a write included", async () => {
  const { d, calls } = deps({ secret: "" });
  // THE TOGGLE IS ASKED FIRST, as on the insert path: an unprotected site
  // (almost every site) pays no schema read for a function call.
  let specReads = 0;
  const real = d.spec;
  d.spec = async () => { specReads++; return real(); };
  const r = await gate(d, "rpc/book_slot", { who: "x" });
  assert.ok(r && !r.refused, "an unprotected site refused a write: " + JSON.stringify(r));
  assert.equal(calls.length, 0);
  assert.equal(specReads, 0, "an unprotected site read the schema for a function call");
  assert.ok(!("verdict" in r), "an unprotected site was judged at all");
  // A stale widget's field is still stripped, so PostgREST sees no unknown arg.
  const s = await gate(d, "rpc/book_slot", { who: "x", [tt.TOKEN_FIELD]: "t" });
  assert.deepEqual(JSON.parse(s.sent), { who: "x" });
});

test("a path that is not rpc/<fn> is left to the insert gate (null)", async () => {
  const { d } = deps();
  assert.equal(await gate(d, "bookings", { who: "x" }), null);
  assert.equal(tt.rpcName("rpc/"), null);
  assert.equal(tt.rpcName("rpc/book_slot"), "book_slot");
});

// ── the field, end to end ────────────────────────────────────────────────────

test("the tool offers `writes` and tells the designer when to set it", () => {
  const p = FUNCTION_ITEM.properties.writes;
  assert.ok(p && p.type === "boolean", "FUNCTION_ITEM has no boolean writes");
  assert.match(p.description, /INSERTS, UPDATES or DELETES/);
  assert.ok(TOOL_FIELDS.function.has("writes"), "the census does not know the field");
});

test("the cleaner keeps writes:true, keeps absent absent, refuses a non-boolean", () => {
  const site = { functions: [], jobFns: [] };
  const base = { name: "book_slot", returns: "void", body: "INSERT INTO bookings(who) VALUES ('x')" };
  const yes = cleanAdd("function", [{ ...base, writes: true }], site);
  assert.equal(yes.ok, true);
  assert.equal(yes.value[0].writes, true, "the cleaner dropped writes");
  const none = cleanAdd("function", [base], { functions: [], jobFns: [] });
  assert.ok(!("writes" in none.value[0]), "an absent writes became a key");
  const bad = cleanAdd("function", [{ ...base, writes: "yes" }], { functions: [], jobFns: [] });
  assert.equal(bad.ok, false);
  assert.equal(bad.why, "bad-writes");
});

test("writes survives fold, merge and the engine", () => {
  const cleaned = cleanAdd("function", [{ name: "book_slot", returns: "void", body: "INSERT INTO bookings(who) VALUES ('x')", writes: true }],
    { functions: [], jobFns: [] });
  const fold = foldAdds([{ kind: "function", value: cleaned.value }], {}, {});
  const f1 = (fold.designed.functions || []).find((f) => f.name === "book_slot");
  assert.ok(f1 && f1.writes === true, "foldAdds dropped writes: " + JSON.stringify(fold.designed.functions));
  const merged = mergeAddonSchema({ tables: SPEC.tables }, fold.designed).spec;
  const f2 = merged.functions.find((f) => f.name === "book_slot");
  assert.ok(f2 && f2.writes === true, "mergeAddonSchema dropped writes");
  const norm = normalizeSchema(merged);
  const f3 = norm.functions.find((f) => f.name === "book_slot");
  assert.ok(f3 && f3.writes === true, "normalizeSchema dropped writes");
  // Absent stays absent through the engine, so older functions are unchanged.
  const old = normalizeSchema({ tables: SPEC.tables, functions: [{ name: "slots_left", returns: "int", body: "SELECT 1" }] });
  assert.ok(old.functions.length === 1 && !("writes" in old.functions[0]), "an old function grew a writes key");
});

test("writes reaches the `_meta` record the gate reads (real applySiteSchema)", async () => {
  let written = null;
  let statements = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "", params = [];
    try { const b = JSON.parse(String((init && init.body) || "{}")); q = b.query || ""; params = b.params || []; } catch { /* not ours */ }
    if (q) statements++;
    if (/INSERT INTO _meta/i.test(q)) { try { written = JSON.parse(params[0]); } catch { written = null; } }
    return new Response(JSON.stringify({ command: "SELECT", rowCount: 0, rows: [], fields: [] }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await applySiteSchema("postgresql://u:p@ep-probe.eu-central-1.aws.neon.tech/db?sslmode=require", {
      tables: SPEC.tables,
      functions: [
        { name: "book_slot", returns: "void", body: "INSERT INTO bookings(who) VALUES ('x')", writes: true },
        { name: "slots_left", returns: "int", body: "SELECT count(*)::int FROM bookings" },
      ],
    });
  } finally { globalThis.fetch = real; }
  assert.ok(statements > 5, "the engine sent almost nothing — the seam moved");
  assert.ok(written && Array.isArray(written.functions), "no functions written to _meta: " + JSON.stringify(written));
  const w = written.functions.find((f) => f.name === "book_slot");
  const r = written.functions.find((f) => f.name === "slots_left");
  assert.ok(w && w.writes === true, "_meta lost writes: " + JSON.stringify(written.functions));
  assert.ok(r && !("writes" in r), "a read function was stored with writes");
  // And the gate's reader agrees with what was stored.
  assert.equal(tt.rpcWrites(written, "book_slot"), true);
  assert.equal(tt.rpcWrites(written, "slots_left"), false);
});

// ── wiring ───────────────────────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
test("turnstileGate asks the rpc gate first, with the site's config and stored schema", () => {
  const at = worker.indexOf("async function turnstileGate(");
  const end = worker.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at, "the gate exists");
  const fn = worker.slice(at, end);
  const rpc = fn.indexOf("await turnstileRpcGate(");
  const shape = fn.indexOf("turnstileOneRow(sent,");
  assert.ok(rpc > 0 && shape > 0, "both landmarks exist");
  assert.ok(rpc < shape, "the rpc gate runs before the table gate");
  assert.match(fn, /config: \(\) => turnstileConfig\(slug, env, db\)/);
  assert.match(fn, /spec: \(\) => loadSiteSchema\(db\)/);
  assert.match(fn, /if \(rpc\) \{/);
  assert.match(worker, /rpcGate as turnstileRpcGate \} from "\.\/site-turnstile\.mjs"/);
});

const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
function hook(name) {
  const at = rows.indexOf("export function " + name + "<");
  const at2 = at > 0 ? at : rows.indexOf("export function " + name + "(");
  assert.ok(at2 > 0, name + " exists");
  const end = rows.indexOf("\n}\n", at2);
  return rows.slice(at2, end);
}
test("the kit's write hooks carry the token; the read hooks do not", () => {
  for (const h of ["useRpcAction", "useCancelClaim", "useAmendClaim"]) {
    const src = hook(h);
    assert.match(src, /JSON\.stringify\(challenged\(/, h + " does not attach the token");
    assert.match(src, /resetChallenge\(\)/, h + " does not reset the spent token");
  }
  for (const h of ["useRpc", "useClaimedRow"]) assert.ok(!/challenged\(/.test(hook(h)), h + " spends a token on a read");
  // The claim token is still written last in the amend body.
  assert.match(hook("useAmendClaim"), /challenged\(\{ \.\.\.values, tok: claim \}\)/);
});
