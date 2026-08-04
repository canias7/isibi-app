// Does anything actually CALL the thing that emails the owner?
//
// WHY THIS EXISTS. `site-notify.mjs` is 18 tests of correct logic — the cooldown
// claimed atomically in the database so many isolates send one email, the escaped
// HTML, the `collect`-only rule — and after `site-data.mjs` was deleted on
// 2026-07-30 it had **zero callers**. Every test passed. A barber shop took a
// booking and nobody was told.
//
// That is this repo's signature failure, and its own note about the fix was
// wrong in an instructive way: it said re-wiring needed "a Postgres trigger
// writing to a queue table plus the existing 2-minute cron, because there is no
// `http` extension to call out from Neon". That assumed the Worker had left the
// write path. It had not — `proxySiteService` forwards every insert a published
// site makes, so the hook is one branch.
//
// So the assertion is REACHABILITY, not behaviour: the behaviour was never the
// problem.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { shouldNotify } from "../site-notify.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The body of a named function, by brace matching. Comments are NOT stripped here. */
function fnBody(src, decl) {
  const at = src.indexOf(decl);
  assert.ok(at > 0, decl + " is gone — retarget this test");
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (!depth) return src.slice(at, i + 1); }
  }
  assert.fail("unbalanced");
}

test("something calls notifyOwnerOfSubmission", () => {
  // The whole bug, in one line. It is defined and exported-in-spirit and was
  // called by nothing at all.
  const calls = worker.split("notifyOwnerOfSubmission(").length - 1;
  assert.ok(calls >= 2,
    `notifyOwnerOfSubmission appears ${calls} time(s) — its definition and no caller, ` +
    "so a booking arrives and the owner is never told");
});

test("the caller is the data proxy, on a write", () => {
  const body = fnBody(worker, "async function proxySiteService(");
  assert.match(body, /notifyOwnerOfSubmission\(/,
    "the hook is not in the proxy, which is the only place a published site's insert passes through");
  // Gated on a WRITE that SUCCEEDED. Without the status check a refused booking —
  // a duplicate slot, a failed constraint — mails the owner about a row that does
  // not exist.
  assert.match(body, /request\.method === "POST"/, "the hook must be write-only");
  assert.match(body, /r\.status >= 200 && r\.status < 300/,
    "a refused insert must not email the owner about a booking that did not happen");
});

test("the request body is read ONCE, or the proxy forwards nothing", () => {
  // The hook needs the submitted row, and a Request body can only be consumed
  // once. Calling `request.text()` again inside the hook returns empty — or
  // worse, reading it there first sends an empty body upstream and every
  // submission on the platform silently writes a blank row.
  const body = fnBody(worker, "async function proxySiteService(");
  const reads = body.split("request.text()").length - 1;
  assert.equal(reads, 1, `request.text() is called ${reads} times; it may only be called once`);
  assert.match(body, /body: sent,/, "the forwarded body must be the text that was read");
});

test("it runs detached and cannot fail the submission", () => {
  const body = fnBody(worker, "function notifyOwnerOfSubmission(");
  assert.match(body, /ctx\.waitUntil/,
    "a Worker tears the request context down once the response is returned, so an " +
    "un-held promise is cancelled mid-flight — the audit log lost most of its rows to exactly this");
  // And the proxy's own call must be inside a try, since it does a schema read.
  const proxy = fnBody(worker, "async function proxySiteService(");
  const at = proxy.indexOf("notifyOwnerOfSubmission(");
  assert.match(proxy.slice(Math.max(0, at - 800), at), /try \{/,
    "an exception in the hook would turn a successful booking into a 503");
});

test("ctx reaches the proxy, or waitUntil is silently a no-op", () => {
  // `notifyOwnerOfSubmission` falls back to `p.catch(() => {})` when ctx is
  // missing — which does not throw and does not send. The dispatch has to hand
  // it over, and only the DATA proxy needs it.
  assert.match(worker, /proxySiteService\(env, request, url, slug, dpath, "data", ctx\)/,
    "the data dispatch does not pass ctx, so every notify is cancelled when the response returns");
});

test("only a collect POST notifies — the rule the module already owned", () => {
  assert.equal(shouldNotify({ access: "collect", method: "POST" }), true);
  assert.equal(shouldNotify({ access: "collect", method: "GET" }), false);
  // A member writing their own post, and the owner editing their own menu.
  assert.equal(shouldNotify({ access: "user", method: "POST" }), false);
  assert.equal(shouldNotify({ access: "display", method: "POST" }), false);
});

test("the access level comes from the SCHEMA, never from the request", () => {
  // If the table's access were taken from anything the caller controls, a
  // stranger could make any write look like a submission and mail the owner on
  // demand — the mail bomb the cooldown exists to prevent, aimed by hand.
  const body = fnBody(worker, "async function proxySiteService(");
  assert.match(body, /loadSiteSchema\(db\)/, "the hook must read the site's own schema");
  assert.match(body, /access: def\.access/, "the access level must come from the schema entry");
});
