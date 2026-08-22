// Uploading and removing a site's Worker.
//
// Every side effect is injected, so these run with no Cloudflare account and
// no network. What they cannot prove is that the endpoint accepts the shape —
// that needs a real namespace and is a live check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadSiteWorker, deleteSiteWorker, COMPAT_DATE, DISPATCH_CALL_MS } from "../builder/site-dispatch.mjs";
import fs from "node:fs";

const ARGS = { accountId: "acc", namespace: "sites", name: "site-forno", code: "export default {}", bucket: "site-assets", apiToken: "tok" };
const res = (status, body) => ({ status, json: async () => body, text: async () => JSON.stringify(body) });

function recorder(status = 200, body = { success: true }) {
  const calls = [];
  return { calls, fetch: async (url, init) => { calls.push({ url, init }); return res(status, body); } };
}

/* ------------------------------------------------------------- the upload */

test("the script is PUT into the namespace, under its own name", async () => {
  const rec = recorder();
  const out = await uploadSiteWorker(ARGS, rec);
  assert.equal(out.ok, true);
  assert.equal(rec.calls.length, 1);
  assert.equal(rec.calls[0].init.method, "PUT");
  assert.match(rec.calls[0].url, /\/accounts\/acc\/workers\/dispatch\/namespaces\/sites\/scripts\/site-forno$/);
  assert.equal(rec.calls[0].init.headers.authorization, "Bearer tok");
});

test("the module part is named the same as main_module", async () => {
  // A mismatch uploads SUCCESSFULLY and produces a script with no entrypoint —
  // 200 here, then every request to the site failing. The two names are one
  // fact and have to be asserted as one.
  const rec = recorder();
  await uploadSiteWorker(ARGS, rec);
  const form = rec.calls[0].init.body;
  const meta = JSON.parse(await form.get("metadata").text());
  assert.ok(form.get(meta.main_module), "no part named " + meta.main_module);
});

test("THE BUCKET IS THE ONLY BINDING — a site's script is handed nothing else", async () => {
  // The security property of the whole design. A dispatch script does not
  // inherit the platform Worker's bindings; it gets what it was uploaded with.
  // So a customer's site can reach the assets bucket and cannot reach the
  // credit ledger, the secrets key or another customer's anything, because it
  // was never given them. Asserted as a CENSUS, not as "the bucket is there" —
  // the second passes with a second binding sitting beside it.
  const rec = recorder();
  await uploadSiteWorker(ARGS, rec);
  const meta = JSON.parse(await rec.calls[0].init.body.get("metadata").text());
  assert.equal(meta.bindings.length, 1, JSON.stringify(meta.bindings));
  assert.deepEqual(meta.bindings[0], { type: "r2_bucket", name: "SITES", bucket_name: "site-assets" });
});

test("no bucket means no bindings at all, not a broken one", async () => {
  const rec = recorder();
  await uploadSiteWorker({ ...ARGS, bucket: "" }, rec);
  const meta = JSON.parse(await rec.calls[0].init.body.get("metadata").text());
  assert.deepEqual(meta.bindings, []);
});

test("the compatibility date is PINNED, not the day of the upload", async () => {
  // A floating date means two uploads months apart produce scripts that behave
  // differently from identical source — i.e. a customer's live site changing
  // for a reason nobody can point at.
  const rec = recorder();
  await uploadSiteWorker(ARGS, rec);
  const meta = JSON.parse(await rec.calls[0].init.body.get("metadata").text());
  assert.equal(meta.compatibility_date, COMPAT_DATE);
  assert.match(COMPAT_DATE, /^\d{4}-\d{2}-\d{2}$/);
});

test("201 is a success too", async () => {
  assert.equal((await uploadSiteWorker(ARGS, recorder(201))).ok, true);
});

test("nothing is sent when a required piece is missing", async () => {
  // Not merely refused — NOT SENT. A request with no code is a request that
  // could overwrite a working site with an empty script.
  for (const k of ["accountId", "namespace", "name", "code", "apiToken"]) {
    const rec = recorder();
    const out = await uploadSiteWorker({ ...ARGS, [k]: "" }, rec);
    assert.equal(out.ok, false, k);
    assert.equal(rec.calls.length, 0, k + " was still sent");
  }
});

/* ------------------------------------------------ what a failure says */

test("Cloudflare's own error code survives, because the codes need different actions", async () => {
  // 10000 is a token missing a scope and 1404 is a product not enabled on the
  // account — completely different things to do about it. A generic "upload
  // failed" sends the reader to the wrong one, which this repo has already
  // paid for by telling somebody to add an SSL permission that could not help.
  const out = await uploadSiteWorker(ARGS, recorder(403, { errors: [{ code: 10000, message: "Authentication error" }] }));
  assert.equal(out.ok, false);
  assert.equal(out.status, 403);
  assert.match(out.error, /10000/);
  assert.match(out.error, /Authentication error/);
});

test("a network throw and a refusal are told apart by the status", async () => {
  // One is worth retrying and the other is not, so they cannot share an answer.
  const thrown = await uploadSiteWorker(ARGS, { fetch: async () => { throw new Error("ECONNRESET"); } });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.status, 0, "a throw has no status");
  assert.match(thrown.error, /ECONNRESET/);

  const refused = await uploadSiteWorker(ARGS, recorder(400, { errors: [{ code: 10021, message: "nope" }] }));
  assert.equal(refused.status, 400);
});

test("an unreadable error body still says something", async () => {
  const out = await uploadSiteWorker(ARGS, {
    fetch: async () => ({ status: 500, json: async () => { throw new Error("not json"); }, text: async () => "<html>502</html>" }),
  });
  assert.equal(out.ok, false);
  assert.ok(out.error.length > 0, "an empty reason is the failure this is written to avoid");
});

/* ------------------------------------------------------------- the delete */

test("404 IS DONE — an already-gone script is the goal, not a failure", async () => {
  // Deleting a site drops its Neon project, its R2 objects and its row; this
  // is one more thing in that sequence. Treating already-gone as an error
  // means the cleanup never reports success and somebody hunts a leak that is
  // not there. Same rule site-teardown.mjs settled for Neon projects.
  for (const s of [200, 204, 404]) {
    const out = await deleteSiteWorker(ARGS, recorder(s));
    assert.equal(out.ok, true, "status " + s);
  }
});

test("401 and 403 are NEVER done", async () => {
  // During a token rotation every call answers 403. A sweeper that read that
  // as success would drop the only record of every script at the exact moment
  // it cannot see Cloudflare — the most expensive mutation in site-teardown.
  for (const s of [401, 403]) {
    const out = await deleteSiteWorker(ARGS, recorder(s, { errors: [{ code: 10000, message: "auth" }] }));
    assert.equal(out.ok, false, "status " + s);
  }
});

test("a delete with nothing to address is not sent", async () => {
  for (const k of ["accountId", "namespace", "name", "apiToken"]) {
    const rec = recorder();
    const out = await deleteSiteWorker({ ...ARGS, [k]: "" }, rec);
    assert.equal(out.ok, false, k);
    assert.equal(rec.calls.length, 0, k + " was still sent");
  }
});

test("the name is encoded into the path", async () => {
  // It addresses which script gets overwritten or removed. `scriptNameFor`
  // already filters it to [a-z0-9-], so this changes nothing today — it is
  // here because a guarantee held only by a filter in another file is one edit
  // from being held by nothing.
  const rec = recorder();
  await deleteSiteWorker({ ...ARGS, name: "a b/c" }, rec);
  assert.doesNotMatch(new URL(rec.calls[0].url).pathname, /\/a b\/c/);
  assert.match(rec.calls[0].url, /a%20b%2Fc$/);
});

/* ------------------------------------ 200 IS NOT THE ANSWER ON THIS API */

test("A 200 CARRYING `success: false` IS A REFUSAL, NOT A DELETE", async () => {
  // THE BUG THAT SHIPPED, measured on a real run: a site was deleted — 21 R2
  // objects gone, the Neon project dropped, the ownership row removed — and
  // the address kept answering 200 for a quarter of an hour, because its
  // script was never removed and the status-only check called that success.
  //
  // Cloudflare's v4 endpoints answer 200 with `{"success": false, "errors":
  // […]}` for a class of refusals. Reading the status alone turns "we refused"
  // into "done", silently — the same shape as a GRANT that reports success and
  // changes nothing.
  const body = { success: false, errors: [{ code: 10007, message: "workers.api.error.script_not_found" }] };
  const res = () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const r = await deleteSiteWorker({ accountId: "a", namespace: "n", name: "site-x", apiToken: "t" },
    { fetch: async () => res() });
  assert.equal(r.ok, false, "a refusal wearing a 200 must not read as a delete");
  assert.match(r.error, /10007/, "and it must carry Cloudflare's own code, which says what to do");
});

test("…and the upload is judged the same way", async () => {
  const body = { success: false, errors: [{ code: 10000, message: "Authentication error" }] };
  const r = await uploadSiteWorker({ accountId: "a", namespace: "n", name: "site-x", code: "export default {}", apiToken: "t" },
    { fetch: async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }) });
  assert.equal(r.ok, false);
  assert.match(r.error, /10000/);
});

test("a 204 with no body is still a delete", async () => {
  // The commonest success shape carries nothing to parse, and an unparseable
  // body is not evidence of refusal — reading it as one turns every working
  // delete into a failure and a retry loop.
  const r = await deleteSiteWorker({ accountId: "a", namespace: "n", name: "site-x", apiToken: "t" },
    { fetch: async () => new Response(null, { status: 204 }) });
  assert.equal(r.ok, true);
});

test("…and so is a 200 whose body is not JSON at all", async () => {
  const r = await deleteSiteWorker({ accountId: "a", namespace: "n", name: "site-x", apiToken: "t" },
    { fetch: async () => new Response("OK", { status: 200 }) });
  assert.equal(r.ok, true, "no opinion is not a refusal");
});

test("`success: true` is left alone, and 404 still means already gone", async () => {
  const ok = async (s, b) => deleteSiteWorker({ accountId: "a", namespace: "n", name: "site-x", apiToken: "t" },
    { fetch: async () => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } }) });
  assert.equal((await ok(200, { success: true, result: null })).ok, true);
  // 404 is DONE — most deletes are of sites that never had a script, and
  // treating already-gone as a failure means the cleanup never reports success.
  assert.equal((await ok(404, { success: false, errors: [{ code: 10007, message: "not found" }] })).ok, true,
    "an already-absent script is the goal, not a refusal");
});

// ── EVERY CALL TO A THIRD PARTY IS BOUNDED ─────────────────────────────────
//
// FOUND WHILE NARROWING RUN 13'S HANG, and eliminated as its cause in the same
// breath: `putSiteWorker` runs after the `og` mark and that build stopped at
// `fonts`, so this is not what wedged it. It is fixed anyway, because an
// unbounded PUT of a near-megabyte script to a third-party API — on the build
// path, one step after everything around it was bounded — is a bug on its own
// merits and is precisely the class run 13 proved cannot be reasoned away.
//
// DERIVED over every fetch in the module rather than the two that exist today.
// A third endpoint added later is one forgotten `signal:` from being the next
// twenty-six minutes of silence, and nobody will remember this file.

test("every Cloudflare API call this module makes carries a timeout", async () => {
  const src = fs.readFileSync(new URL("../builder/site-dispatch.mjs", import.meta.url), "utf8");
  // Comments blanked, whole-line and length-preserving: the header above spells
  // both `signal:` and the constant while explaining them, and prose containing
  // the thing it asserts is this repo's most repeated own-goal.
  const code = src.replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length));
  const calls = [...code.matchAll(/await fetchImpl\(\s*`[^`]*`,\s*(\{[\s\S]*?\}),\s*\)/g)];
  assert.ok(calls.length >= 2, `expected the module's fetches to be found; got ${calls.length}`);
  for (const c of calls) {
    assert.match(c[1], /signal:\s*AbortSignal\.timeout\(/,
      "a Cloudflare API call in site-dispatch.mjs has no timeout — it can hang for ever on the build path");
    assert.match(c[1], /\bDISPATCH_CALL_MS\b/,
      "the bound no longer derives from the one ceiling, so the calls can drift apart");
  }
  assert.equal(typeof DISPATCH_CALL_MS, "number");
  // ZERO IS THE ONE VALUE THAT MUST STILL BE REFUSED, and it is not a
  // hypothetical: `AbortSignal.timeout(0)` aborts on the next tick, which is
  // indistinguishable from the provider hanging up — the exact confusion
  // `isCallTimeout` exists to end. Every dispatch call on the platform would
  // fail instantly and report as an upstream fault.
  //
  // THE UPPER BOUND WENT WITH THE POLICY (owner's call 2026-08-22: "delete any
  // timeout there is anywhere"). It read `<= 300000` under a message about a
  // ceiling being "long enough not to be one", which was a judgement about how
  // long a ~950KB PUT to Cloudflare should be allowed to take. That judgement is
  // the one being reversed; the mechanism is untouched, and the derived guard
  // above still requires every call to carry the signal.
  assert.ok(DISPATCH_CALL_MS > 0,
    "a dispatch call's ceiling is zero, so AbortSignal.timeout(0) refuses every upload on the next tick");
});

test("the injected fetch really receives the signal, not just the source", async () => {
  // The source-read above proves the spelling; this proves it ARRIVES. An init
  // built correctly and handed to the wrong call reads identically in a grep.
  let seen = null;
  await uploadSiteWorker(
    { accountId: "a", namespace: "n", name: "s", code: "export default {}", bucket: "b", apiToken: "t" },
    { fetch: async (_u, init) => { seen = init; return new Response('{"success":true}', { status: 200 }); } },
  );
  assert.ok(seen, "the upload never called the injected fetch");
  assert.ok(seen.signal, "the upload's init carries no signal");
  assert.equal(typeof seen.signal.aborted, "boolean", "what was passed is not an AbortSignal");

  seen = null;
  await deleteSiteWorker(
    { accountId: "a", namespace: "n", name: "s", apiToken: "t" },
    { fetch: async (_u, init) => { seen = init; return new Response('{"success":true}', { status: 200 }); } },
  );
  assert.ok(seen && seen.signal, "the delete's init carries no signal");
});

test("an aborted upload is an upload that did not happen, with a reason", async () => {
  // The catch already turns a throw into `status: 0`, which is what an upload
  // that never landed has — and `putSiteWorker` shapes both existing failure
  // branches on that, so an abort needs no new wiring. Asserted rather than
  // assumed, because a timeout arriving as `ok: true` would report a site as
  // served by a script that was never uploaded.
  const r = await uploadSiteWorker(
    { accountId: "a", namespace: "n", name: "s", code: "export default {}", bucket: "b", apiToken: "t" },
    { fetch: async () => { const e = new Error("The operation was aborted"); e.name = "TimeoutError"; throw e; } },
  );
  assert.equal(r.ok, false);
  assert.equal(r.status, 0, "an aborted upload must read as one that never happened");
  assert.match(String(r.error), /abort/i, "the reason is lost, so an operator cannot tell a timeout from a refusal");
});
