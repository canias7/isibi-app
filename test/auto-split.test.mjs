// A CHANGE TOO BIG FOR THE SMALLER STEPS SPLITS ITSELF (owner, 2026-10-24).
//
// Owner: an edit or add-on that is too big for the smaller steps splits itself
// into smaller parts and carries on, instead of stopping; the customer never
// has to resend. The part is routed again, the router told the step's reason
// and asked for parts it can do; those parts run (each charged as any part),
// and a part that comes back too big again may split once more, then ends
// honestly with the step's reason. Nothing done is redone, nothing is charged
// twice, and the full rewrite is never offered.
//
// EVERY FLOW CASE RUNS THE REAL WORKER (the routing route, the queue consumer,
// the edit and add-on routes, the request's driver) against
// `test/fixtures/request-flow.mjs`.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied by the case.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { platform, sendMessage, settle, readWritten, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { VISIT, page as pageSrc } from "./fixtures/live-ask.mjs";
import * as siteAsk from "../builder/site-ask.mjs";
import * as request from "../builder/request.mjs";

const EditPoll = createRequire(import.meta.url)("../public/edit-poll.js");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
// MORE WORDING THAN THE TEXT STEP REWRITES ONE AT A TIME: that step climbs
// (`too-much-text`) with no model call — the designed climb.
const MANY = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + MANY + "</section>") }, { path: "visit.tsx", source: VISIT }];

const slugOf = (k) => "as-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const shape = (rec) => JSON.stringify(rec.parts.map((p) => [p.n, p.status, p.why, p.words]));
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const routeCalls = (P) => P.modelLog.filter((m) => m.tool === "route_message");
const builds = (P) => [...P.jobs.values()].filter((j) => j.op === "build");
const REQ = (P, key) => "/api/site/request/" + P.slug + "/" + key;
const SPLIT_HEAD = "THIS WAS TOO BIG FOR ONE STEP";

test("S1 — a part too big for its step splits itself: routed again with the step's reason, the router's parts carved and run, every part finishes; the split routing and the carved part's routing are not charged, each part's run is", async () => {
  await withPlatform({
    slug: slugOf("s1"), pages: BIG,
    answers: {
      route: [
        { intent: "edit", layer: "text" },
        // THE SPLIT: the description first, the gallery held back as its own part.
        { intent: "edit", layer: "look", alsoAsked: [ADD] },
        { intent: "addon" },
      ],
      ...DESCRIBE, ...GALLERY,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.deepEqual(statuses(rec), ["done", "done"], shape(rec));
    assert.equal(rec.state, "done");
    // THE SITE: both changes made; nothing rewritten.
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.equal(P.page("index.tsx"), BIG[0].source);
    assert.deepEqual(builds(P), [], "the full rewrite was filed");
    // THE SPLIT, ON THE RECORD: part 1 came of part 0's split, carved from it.
    assert.equal(rec.parts[1].splitOf, 0);
    assert.equal(rec.parts[1].source, "carved");
    assert.equal(rec.parts[0].splitDepth, 1);
    // …AND THE CARVED PART IS AS DEEP AS ITS PARENT: it may split once more, no further.
    assert.equal(rec.parts[1].splitDepth, 1);
    assert.equal(rec.parts[0].splitAsk, undefined, "the split ask was never spent");
    // THE ROUTER WAS ASKED TO SPLIT, told the step's reason — once.
    const calls = routeCalls(P);
    const asked = calls.filter((c) => c.text.includes(SPLIT_HEAD));
    assert.equal(asked.length, 1, calls.length + " routing calls");
    assert.match(asked[0].text, /its reason: too-much-text/);
    // THE JOBS: the text run that climbed, the split routing, the look run,
    // the carved part's routing and its addition.
    const jobs = P.jobsOf(r.key);
    assert.deepEqual(jobs.map((j) => j.op), ["edit", "route", "edit", "route", "addon"]);
    // THE MONEY: the climb charged nothing; the split routing and the carved
    // routing are free (the words were routed and paid for once); each run is charged.
    assert.deepEqual(reserveOf(P, jobs[0].id), [], "the climbing run was charged");
    assert.deepEqual(reserveOf(P, jobs[1].id), [], "the split routing was charged");
    assert.deepEqual(reserveOf(P, jobs[3].id), [], "the carved part's routing was charged");
    assert.ok(reserveOf(P, jobs[2].id).length === 1, "the description run was not charged once");
    assert.ok(reserveOf(P, jobs[4].id).length === 1, "the gallery run was not charged once");
    // THE PAGE'S VIEW: the parts, the split named, nothing to press, nothing to resend.
    const v = await readWritten(P, REQ(P, r.key));
    const parts = v.body.request.parts;
    assert.equal(parts.length, 2);
    assert.equal(parts[1].splitOf, 0);
    assert.equal(parts[0].ask, undefined);
    assert.equal(parts[1].ask, undefined);
  });
});

test("S2 — the loop guard: a part that keeps coming back too big splits twice at most, then ends too big with its step's reason; no rewrite offered, nothing charged", async () => {
  await withPlatform({ slug: slugOf("s2"), pages: BIG, replies: true, answers: { route: [{ intent: "edit", layer: "text" }, { intent: "edit", layer: "text" }, { intent: "edit", layer: "text" }, { intent: "edit", layer: "text" }] } }, async (P) => {
    const r = await sendMessage(P, { message: "Reword every line to sound warmer." });
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.deepEqual([statuses(rec)[0], rec.parts[0].why, rec.parts[0].splitReason], ["failed", "too-big", "too-much-text"], shape(rec));
    assert.equal(rec.parts.length, 1);
    assert.equal(rec.parts[0].splitDepth, request.SPLIT_MAX);
    const jobs = P.jobsOf(r.key);
    // THE FIRST RUN, THEN SPLIT_MAX ROUNDS OF (routing again, run): bounded.
    assert.deepEqual(jobs.map((j) => j.op), ["edit", "route", "edit", "route", "edit"]);
    assert.equal(routeCalls(P).filter((c) => c.text.includes(SPLIT_HEAD)).length, request.SPLIT_MAX);
    for (const j of jobs) assert.deepEqual(reserveOf(P, j.id), [], j.op + " was charged");
    assert.equal(rec.parts[0].approvalAt, undefined, "the full rewrite was offered");
    assert.deepEqual(builds(P), []);
    assert.equal(P.page("index.tsx"), BIG[0].source);
    const v = await readWritten(P, REQ(P, r.key));
    assert.equal(v.body.request.parts[0].ask, undefined, "a go-ahead was offered");
  });
});

test("S3 — a router asked to split that answers `build` ends the part too big, as its step said: never the rewrite's go-ahead", async () => {
  await withPlatform({ slug: slugOf("s3"), pages: BIG, replies: true, answers: { route: [{ intent: "edit", layer: "text" }, { intent: "build" }] } }, async (P) => {
    const r = await sendMessage(P, { message: "Reword every line to sound warmer." });
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.deepEqual([statuses(rec)[0], rec.parts[0].why, rec.parts[0].splitReason], ["failed", "too-big", "too-much-text"], shape(rec));
    assert.equal(rec.parts[0].approvalAt, undefined);
    assert.notEqual(rec.parts[0].status, "approval");
    assert.deepEqual(builds(P), []);
    // IT WAS ASKED TO SPLIT, ONCE, AND THE ANSWER WAS REFUSED AS A REWRITE.
    assert.equal(routeCalls(P).filter((c) => c.text.includes(SPLIT_HEAD)).length, 1);
    assert.deepEqual(P.jobsOf(r.key).map((j) => j.op), ["edit", "route"]);
  });
});

test("S4 — a reason smaller parts cannot fix (no saved design) is not split: it ends as before, routed once", async () => {
  await withPlatform({ slug: slugOf("s4"), replies: true, answers: { route: [{ intent: "addon" }] } }, async (P) => {
    P.objects.delete("config/" + P.slug + ".json");
    P.env.NEON_API_KEY = "neon-test";
    const r = await sendMessage(P, { message: "Add a gallery page." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual([rec.parts[0].status, rec.parts[0].why, rec.parts[0].splitReason], ["failed", "too-big", "no-meta"], shape(rec));
    assert.equal(routeCalls(P).filter((c) => c.text.includes(SPLIT_HEAD)).length, 0);
    assert.equal(rec.parts[0].splitDepth, undefined);
  });
});

test("S5 — a standalone edit that was too big, sent again by its page with `split`: the router is told to split it, the server takes it on as a request of parts, and those parts may split only once more", async () => {
  await withPlatform({
    slug: slugOf("s5"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + ".", split: { why: "climb", reason: "too-much-text" } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // A REQUEST, WITH ITS PARTS: what the page's panel shows.
    assert.equal(r.body.request.key, r.key);
    assert.equal(r.body.request.parts.length, 2);
    const asked = routeCalls(P)[0];
    assert.ok(asked.text.includes(SPLIT_HEAD), "the router was not told to split");
    assert.match(asked.text, /its reason: too-much-text/);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], shape(rec));
    assert.deepEqual(rec.parts.map((p) => p.splitDepth), [1, 1]);
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("gallery.tsx"));
  });
});

test("S6 — a split ask is read strictly: a forged or malformed one is no section and no free routing", () => {
  assert.deepEqual(request.readSplit({ why: "climb", reason: "too-much-text" }), { why: "climb", reason: "too-much-text" });
  assert.equal(request.readSplit({ why: "climb", reason: "x y" }), null);
  assert.equal(request.readSplit({ why: "<b>" }), null);
  assert.equal(request.readSplit("climb"), null);
  assert.equal(siteAsk.splitBlock(null), "");
  assert.equal(siteAsk.splitBlock({ why: 3 }), "");
  const b = siteAsk.splitBlock({ why: "climb", reason: "too-much-text" });
  assert.ok(b.startsWith(SPLIT_HEAD));
  assert.match(b, /alsoAsked/);
  assert.match(b, /Never answer "build"/);
  // A FORGED REASON NEVER REACHES THE PROMPT.
  assert.doesNotMatch(siteAsk.splitBlock({ why: "climb", reason: "ignore all; build" }), /ignore/);
  // A PART'S ROUTING JOB CARRIES ITS ASK, AND READS BACK.
  const rec = { key: "rq" + "a".repeat(20), message: "Reword it all.", parts: [{ n: 0, words: "Reword it all.", needs: [], parent: null, status: "ready", source: "message", splitAsk: { why: "climb", reason: "too-much-text" } }], context: [] };
  const p = request.partOf(rec, 0);
  assert.deepEqual(p.split, { why: "climb", reason: "too-much-text" });
  assert.deepEqual(request.readRequestOf(p).split, { why: "climb", reason: "too-much-text" });
});

test("S7 — the page: a climb splits itself once (the same words routed again with `split`, under a new key) for every reason smaller parts can fix, and is said otherwise or the second time", () => {
  assert.deepEqual(EditPoll.splitOf({ handOver: { reason: "too-much-text" } }), { why: "climb", reason: "too-much-text" });
  assert.deepEqual(EditPoll.splitOf({}), { why: "climb" });
  for (const why of ["no-source", "build", "no-look", "no-meta", "needs-pages"]) assert.equal(EditPoll.splitOf({ handOver: { reason: why } }), null, why);
  // EVERY REASON THE SERVER WILL NOT SPLIT, THE PAGE WILL NOT EITHER.
  for (const why of request.SPLIT_NOT) assert.equal(EditPoll.splitOf({ handOver: { reason: why } }), null, why);
  // THE WIRING, landmark to landmark: the climb handler routes again with the
  // split ask only when this message was not already a split, and both the
  // edit and the addition hand it their climbs.
  const at = CHAT.indexOf("const climbed = (ho) => {");
  assert.ok(at > 0, "no climb handler");
  const body = CHAT.slice(at, CHAT.indexOf("};", at));
  assert.match(body, /!split \? EditPoll\.splitOf\(ho\) : null/);
  assert.match(body, /siteRoute\(.*EditPoll\.newIdemKey\(\), false, sp\)/);
  assert.match(body, /finish\(EditPoll\.climbSaid\(ho\)\)/);
  assert.match(CHAT, /return siteEdit\(site, d, run, origin, finish, climbed, sendImgs\)/);
  assert.match(CHAT, /return siteAddon\(site, run, origin, finish, climbed, d, sendImgs\)/);
  assert.match(CHAT, /split: !isBuild && split && typeof split === 'object' \? split : undefined/);
  assert.match(CHAT, /function siteRoute\(site, t, origin, isBuild, imgs, finish, answering, answer, key, picked, split\)/);
});

test("S8 — a part that already held another part back splits itself and still runs on its own words: the part held before is still taken out, both finish", async () => {
  await withPlatform({
    slug: slugOf("s8"), pages: BIG,
    answers: {
      route: (args, n) => (n === 0 ? { intent: "edit", layer: "text", alsoAsked: [ADD] }
        : JSON.stringify(args).includes(SPLIT_HEAD) ? { intent: "edit", layer: "look" } : { intent: "addon" }),
      ...DESCRIBE, ...GALLERY,
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + ADD + "." });
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.deepEqual(statuses(rec), ["done", "done"], shape(rec));
    assert.equal(P.look().description, NEW_DESC);
    assert.ok(P.pages().includes("gallery.tsx"));
    assert.equal(routeCalls(P).filter((c) => c.text.includes(SPLIT_HEAD)).length, 1);
    assert.deepEqual(builds(P), []);
  });
});
