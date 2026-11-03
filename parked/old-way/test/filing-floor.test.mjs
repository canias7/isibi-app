// PARKED (2026-11-03, park-old-way): the old-way half of test/filing-floor.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE CREDIT FLOOR AT FILING (audit A13-2, #126; decide-money-6, 2026-10-23).
//
// A queued edit or addition was filed with no balance read: its job then made
// model calls, the reserve was refused, the publish gate withheld the result,
// and the platform paid for the calls. The owner's choice: refuse at filing
// below 5 credits, for paid work only.
//
// Driven through the REAL Worker against `fixtures/request-flow.mjs` (its
// ledger, `edit_jobs` and queue keep state): the direct edit route, the direct
// add-on route, and the routing route's acceptance of a message as a request.
// Every model answer is supplied; nothing here is paid or live.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, call, newKey } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";

const slugOf = (k) => "ff-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const MSG = "Change the site description to say we bake overnight sourdough";
const editPost = (P, body) => call(P, "POST", "/api/site/" + P.slug + "/edit", { instruction: MSG, idem: newKey(), picker: "sonnet", ...body });
const addonPost = (P) => call(P, "POST", "/api/site/" + P.slug + "/addon", { instruction: "add a gallery page", idem: newKey(), picker: "sonnet" });
const filedJobs = (P) => [...P.jobs.values()].filter((j) => j.op === "edit" || j.op === "addon");
const creates = (P) => P.rpcLog.filter((r) => r.fn === "edit_create").length;

function refused(r, P) {
  assert.equal(r.status, 402, JSON.stringify(r.body));
  assert.equal(r.body.ok, false);
  assert.equal(r.body.error, "not enough credits");
  assert.equal(r.body.need, "credits");
  assert.equal(r.body.cost, 0);
  assert.equal(r.body.msg, "You're out of credits — top up to keep changing your site.");
  assert.equal(filedJobs(P).length, 0, "a job row was filed");
  assert.equal(creates(P), 0, "edit_create was called");
  assert.equal(P.queue.length, 0, "a message was queued");
}

// ── THE ROUTING ROUTE'S ACCEPTANCE (the request flow) ──────────────────────

test("request flow: balance 1 — the router answers, but nothing is accepted or filed, and no further model call", async () => {
  await withPlatform({ slug: slugOf("r1"), balance: 1, answers: { route: { intent: "edit", layer: "look" } } }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    assert.equal(r.status, 402, JSON.stringify(r.body));
    assert.equal(r.body.need, "credits");
    assert.equal(r.body.cost, 0);
    assert.equal(r.body.error, "not enough credits");
    assert.equal(filedJobs(P).length, 0);
    assert.equal(P.queue.length, 0);
    assert.equal([...P.objects.keys()].filter((k) => k.startsWith("requests/")).length, 0, "a request was accepted");
    assert.deepEqual(P.modelLog.map((m) => m.tool), ["route_message"], "a model other than the router was called");
  });
});

test("request flow: a page removal with balance 1 — accepted (free work)", async () => {
  await withPlatform({ slug: slugOf("rfree"), balance: 1, answers: { route: { intent: "edit", layer: "page", page: "/visit", remove: true } } }, async (P) => {
    const r = await sendMessage(P, { message: "Remove the visit page." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.request && r.body.request.key, JSON.stringify(r.body));
  });
});
