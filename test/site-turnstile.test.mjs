import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { takeToken, verify, TOKEN_FIELD, VERIFY_URL, MAX_TOKEN } from "../site-turnstile.mjs";

/** Everything injected: no decision here needs the network. */
function deps(over = {}) {
  const calls = [];
  // `raw` is passed as a THUNK, not a value: written as a plain override, a
  // deliberate `null` is falsy and falls through to the healthy response — so
  // the "nothing came back" case silently tested the happy path instead.
  const { body, status, throws, raw, ...rest } = over;
  const d = {
    post: async (url, form) => {
      calls.push({ url, form });
      if (throws) throw new Error(throws);
      if (raw) return raw();
      return {
        ok: status ? status >= 200 && status < 300 : true,
        status: status || 200,
        json: async () => (body === undefined ? { success: true } : body),
      };
    },
    ...rest,
  };
  d.calls = calls;
  return d;
}
const run = (d, over = {}) => verify(d, { secret: "sk", token: "tok", ip: "1.2.3.4", ...over });

// ---------------------------------------------------------------- takeToken

test("takeToken lifts the token OUT of the row", () => {
  const { token, row } = takeToken({ [TOKEN_FIELD]: "abc", name: "Ada" });
  assert.equal(token, "abc");
  assert.deepEqual(row, { name: "Ada" });
  // The whole reason it is removed rather than read: PostgREST refuses an
  // insert naming a column the table does not have.
  assert.ok(!(TOKEN_FIELD in row));
});

test("takeToken leaves an ordinary submission alone", () => {
  const body = { name: "Ada", when: "14:00" };
  const { token, row } = takeToken(body);
  assert.equal(token, null);
  assert.deepEqual(row, body);
});

test("takeToken refuses a token that is not a usable string", () => {
  for (const bad of [null, 4, true, {}, [], ""]) {
    const { token, row } = takeToken({ [TOKEN_FIELD]: bad, name: "Ada" });
    assert.equal(token, null, JSON.stringify(bad));
    // Still stripped, whatever it was — the column does not exist either way.
    assert.ok(!(TOKEN_FIELD in row), JSON.stringify(bad));
  }
});

test("takeToken refuses an oversized token without a round trip", () => {
  const { token } = takeToken({ [TOKEN_FIELD]: "x".repeat(MAX_TOKEN + 1) });
  assert.equal(token, null);
  // The boundary itself is fine — an off-by-one here refuses real tokens.
  assert.equal(takeToken({ [TOKEN_FIELD]: "x".repeat(MAX_TOKEN) }).token.length, MAX_TOKEN);
});

test("takeToken passes non-objects through untouched", () => {
  for (const bad of [null, undefined, "str", 4, [1, 2]]) {
    const { token, row } = takeToken(bad);
    assert.equal(token, null);
    assert.deepEqual(row, bad);
  }
});

// ------------------------------------------------------------------- verify

test("no secret is OFF, and does not call Cloudflare", async () => {
  const d = deps();
  const r = await run(d, { secret: "" });
  assert.deepEqual(r, { ok: true, state: "off" });
  assert.equal(d.calls.length, 0);
});

test("configured and no token is a REFUSAL, not an outage", async () => {
  const d = deps();
  const r = await run(d, { token: null });
  assert.equal(r.ok, false);
  assert.equal(r.state, "fail");
  // Nothing to verify, so nothing is sent.
  assert.equal(d.calls.length, 0);
});

test("a verified token passes, and the secret goes with it", async () => {
  const d = deps();
  const r = await run(d);
  assert.deepEqual(r, { ok: true, state: "pass" });
  assert.equal(d.calls.length, 1);
  assert.equal(d.calls[0].url, VERIFY_URL);
  const f = d.calls[0].form;
  assert.equal(f.get("secret"), "sk");
  assert.equal(f.get("response"), "tok");
  assert.equal(f.get("remoteip"), "1.2.3.4");
});

test("no address means the field is omitted, never sent empty", async () => {
  const d = deps();
  await run(d, { ip: "" });
  assert.equal(d.calls[0].form.has("remoteip"), false);
});

test("a rejected token is refused and says why", async () => {
  const d = deps({ body: { success: false, "error-codes": ["timeout-or-duplicate"] } });
  const r = await run(d);
  assert.equal(r.ok, false);
  assert.equal(r.state, "fail");
  assert.match(r.reason, /timeout-or-duplicate/);
});

test("`success` must be exactly true", async () => {
  // A changed response format must not silently disable the whole thing, so
  // anything that is not the literal `true` is refused rather than passed.
  for (const v of ["true", 1, {}, [], "yes"]) {
    const r = await run(deps({ body: { success: v } }));
    assert.notEqual(r.state, "pass", JSON.stringify(v));
  }
});

test("FAILS OPEN on an outage — three states, not two", async () => {
  for (const over of [
    { throws: "connect ETIMEDOUT" },   // network
    { status: 502 },                   // Cloudflare unwell
    { raw: () => null },               // nothing came back at all
    { raw: () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }) },
  ]) {
    const r = await run(deps(over));
    assert.equal(r.ok, true, JSON.stringify(Object.keys(over)));
    assert.equal(r.state, "unknown", JSON.stringify(Object.keys(over)));
    // Never "pass": an outage is not a verification.
    assert.notEqual(r.state, "pass");
  }
});

test("a BROKEN SECRET is ours, and must not close the owner's form", async () => {
  for (const code of ["invalid-input-secret", "missing-input-secret"]) {
    const r = await run(deps({ body: { success: false, "error-codes": [code] } }));
    assert.equal(r.ok, true, code);
    assert.equal(r.state, "unknown", code);
    assert.match(r.reason, /secret/i);
  }
});

test("a bad token alongside a bad secret still refuses on the secret", async () => {
  // The owner's mistake outranks the visitor's: the form stays open.
  const r = await run(deps({ body: { success: false, "error-codes": ["invalid-input-response", "invalid-input-secret"] } }));
  assert.equal(r.ok, true);
  assert.equal(r.state, "unknown");
});

test("the reason never carries the token or the secret", async () => {
  const secret = "sk_live_do_not_leak";
  const token = "tok_do_not_leak";
  const seen = [];
  for (const over of [{ throws: secret + " " + token }, { status: 500 }, { body: { success: false, "error-codes": ["bad"] } }]) {
    const r = await verify(deps(over), { secret, token, ip: "" });
    seen.push(r.reason || "");
  }
  // The throw case is the one that matters: an error message can quote the
  // request, and this reason is written to `_meta` where the owner reads it.
  assert.ok(seen.length === 3);
  for (const s of seen) {
    assert.ok(!s.includes(secret), s);
    assert.ok(!s.includes(token), s);
  }
});

test("a missing error-codes array is a plain refusal, not a crash", async () => {
  for (const body of [{ success: false }, { success: false, "error-codes": "nope" }, {}]) {
    const r = await run(deps({ body }));
    assert.equal(r.ok, false, JSON.stringify(body));
    assert.ok(r.reason);
  }
});

// ------------------------------------------------------------------- wiring
//
// worker.js is searched RAW. Blanking its comments eats from any `/*` inside a
// string literal to the next `*/` and reports present code as missing, which
// has bitten this repo twice; the patterns below carry a `(` so they cannot
// match prose.

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
// `assert.match` prints the whole subject on failure, which for a 7,000-line
// file buries the assertion that failed in the file itself.
const has = (re, why) => assert.ok(re.test(worker), why);

test("the proxy actually calls it", () => {
  has(/turnstileGate\(env, request,/, "the gate is called");
  has(/takeToken\(body\)/, "the token is lifted out");
  has(/turnstileVerify\(\{/, "the verdict is asked for");
});

test("the check runs BEFORE the row reaches Postgres", () => {
  // Verified after the insert is a spam filter that files the spam first.
  // Anchored on the CALL, not on `takeToken` — the helper is declared further
  // down the file than the proxy that calls it, so a position check against the
  // declaration compares the wrong two things and fails on correct code.
  const call = worker.indexOf("const gate = await turnstileGate(");
  const proxyFetch = worker.indexOf("const r = await fetch(target");
  assert.ok(call > 0 && proxyFetch > 0, "both anchors must exist");
  assert.ok(call < proxyFetch, "the gate runs before the upstream write");
});

test("a refusal never reaches the upstream write", () => {
  const call = worker.indexOf("const gate = await turnstileGate(");
  const ret = worker.indexOf("code: \"turnstile\"", call);
  const proxyFetch = worker.indexOf("const r = await fetch(target");
  assert.ok(ret > call && ret < proxyFetch, "it returns, rather than flagging and carrying on");
});

test("the token is stripped from the body that is forwarded", () => {
  // Left in, PostgREST 400s on an unknown column and the protection breaks
  // every form it is switched on for.
  has(/body:\s*sent/, "the proxy forwards `sent`");
  has(/sent\s*=\s*gate\.sent/, "and `sent` is replaced by the stripped body");
  has(/sent:\s*JSON\.stringify\(row\)/, "which is the row without the token");
});

test("the secret is read from the SITE's own vault, never from env", () => {
  has(/FROM _secrets WHERE name LIKE 'TURNSTILE%'/, "read out of the site's own _secrets");
  has(/name === "TURNSTILE_SECRET" \? "secret"/, "and the secret is one of the two names");
  // env.TURNSTILE_SECRET would be one platform key covering every site on it.
  assert.ok(!/env\.TURNSTILE_SECRET/.test(worker), "never a platform-wide key");
});

test("the public route serves the SITE key and can never serve the secret", () => {
  const i = worker.indexOf('url.pathname.endsWith("/turnstile")');
  assert.ok(i > 0, "the route exists");
  const block = worker.slice(i, i + 1600);
  assert.ok(/siteKey:\s*key/.test(block), "it answers with the site key");
  // The secret shares a cache entry with it, so this is a real risk rather
  // than a theoretical one: `Response.json(cfg)` would publish it.
  assert.ok(!/\.secret/.test(block), "the secret is never read on this path");
  assert.ok(/method !== "GET"/.test(block), "GET only");
});

test("changing a secret forgets what this isolate cached", () => {
  // Both directions: a stale ON refuses real submissions after the owner
  // deletes the secret, which is the worse of the two.
  has(/function forgetSiteConfig\(slug\)/, "one place, so a third cache cannot be half-wired");
  has(/turnstileCfg\.delete\(slug\)/, "and it clears this one");
  const save = worker.indexOf("if (r && r.ok) forgetSiteConfig(sslug)");
  const del = worker.indexOf("if (d && d.ok) forgetSiteConfig(sslug)");
  assert.ok(save > 0, "cleared when a secret is saved");
  assert.ok(del > 0, "cleared when a secret is deleted");
});

test("the gate is scoped to `collect`, or it breaks every member write", () => {
  const i = worker.indexOf("async function turnstileGate(");
  assert.ok(i > 0);
  const fn = worker.slice(i, i + 3000);
  assert.ok(/access\s*\|\|\s*""\)\.toLowerCase\(\)\s*!==\s*"collect"/.test(fn), "non-collect tables pass through");
});

test("the visitor's address is the one header a caller cannot set", () => {
  const i = worker.indexOf("async function turnstileGate(");
  const fn = worker.slice(i, i + 3000);
  assert.ok(/headers\.get\("CF-Connecting-IP"\)/.test(fn), "CF-Connecting-IP");
  // Anchored on the READ, not on the header name: the name appears in the
  // comment explaining why it is not used, and a bare name check matches that
  // and fails on correct code. Same trap as blanking comments in worker.js.
  assert.ok(!/headers\.get\(["'][^"']*orwarded/i.test(fn), "never the client-settable fallback used elsewhere");
});
