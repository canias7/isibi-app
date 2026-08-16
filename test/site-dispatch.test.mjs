// Uploading and removing a site's Worker.
//
// Every side effect is injected, so these run with no Cloudflare account and
// no network. What they cannot prove is that the endpoint accepts the shape —
// that needs a real namespace and is a live check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadSiteWorker, deleteSiteWorker, COMPAT_DATE } from "../builder/site-dispatch.mjs";

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
