// QUESTIONS BACK ON A SITE THAT EXISTS — THROUGH THE REAL ROUTES (2026-10-02).
//
// Owner: *"Let the router ask a targeted question when missing information
// materially affects which path, target, or operation to choose, instead of
// converting clarification into add-on work. Let edit and add-on steps request
// clarification too when they discover missing details after routing. … Resume
// with the answer incorporated without repeating completed changes or charges;
// support cancellation and a changed request, and prevent stale answers from
// triggering work. Clear requests should proceed directly, technical failures
// should remain technical failures."*
//
// EVERY HOP BELOW IS DRIVEN: the real `POST /api/site/route`, the real owner
// route for the question (`/api/site/<slug>/question`), the real edit and
// add-on routes — synchronously and through the queue — with the body the
// browser's own `siteEdit` composes, cut out of `public/chat.js`. The store is
// an R2 bucket with etags and conditional puts, as the binding behaves.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer here is supplied: whether a
// real router asks a good question, and whether a real step asks when it should
// and acts when it can, is a live measurement this file cannot make.
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL } from "../builder/route-shared.mjs";
import { QUESTION_KEY, packAsk, newAskId, ASK_TTL_MS, contextBlock, MAX_ANSWER_CHARS } from "../builder/clarify.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";
import {
  T, USER, OTHER, HOME, VISIT, NEW_DESC, Q, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedLook, storedPage,
} from "./fixtures/live-ask.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// 4. RELOAD AND CANCEL: the owner route for the site's question
// ─────────────────────────────────────────────────────────────────────────────

test("A RELOAD READS THE LIVE QUESTION, AND ONLY THE OWNER'S; CANCEL CLOSES IT ONCE AND NAMES WHAT IT HAD PUT OFF", async () => {
  const slug = freshSlug("owner-route");
  const store = bucket(slug);
  const worker = await loadWorker();
  const q = seedQuestion(store, slug, { held: ["add a gallery page"], attached: true });
  await withWire({}, async (seen) => {
    const g = await questionCall(worker, envFor(store), slug, "GET");
    assert.equal(g.status, 200);
    assert.deepEqual(g.body, { ok: true, question: { id: q.id, text: Q.text, options: Q.options, attached: true } });
    const bad = await questionCall(worker, envFor(store), slug, "POST", { id: "nope", cancel: true });
    assert.equal(bad.status, 400);
    const c = await questionCall(worker, envFor(store), slug, "POST", { id: q.id, cancel: true });
    assert.deepEqual(c.body, { ok: true, cancelled: true, putOff: ["add a gallery page"] });
    assert.equal(question(store, slug).status, "cancelled");
    const again = await questionCall(worker, envFor(store), slug, "POST", { id: q.id, cancel: true });
    assert.deepEqual(again.body, { ok: true, cancelled: false, why: "closed" }, "a second cancel claimed to close it");
    const after = await questionCall(worker, envFor(store), slug, "GET");
    assert.deepEqual(after.body, { ok: true, question: null }, "a cancelled question came back on a reload");
    assert.deepEqual(seen.calls, [], "a model was asked anything");
    assert.deepEqual(seen.debits, []);
  });
  const expired = freshSlug("owner-expired");
  const store2 = bucket(expired);
  seedQuestion(store2, expired, { at: Date.now() - ASK_TTL_MS - 5 });
  await withWire({}, async () => {
    const g = await questionCall(worker, envFor(store2), expired, "GET");
    assert.deepEqual(g.body, { ok: true, question: null }, "an expired question came back on a reload");
  });
  const theirs = freshSlug("owner-theirs");
  const store3 = bucket(theirs);
  const q3 = seedQuestion(store3, theirs);
  await withWire({}, async () => {
    const g = await questionCall(worker, envFor(store3), theirs, "GET");
    assert.equal(g.status, 404, "another owner's question was read");
    const c = await questionCall(worker, envFor(store3), theirs, "POST", { id: q3.id, cancel: true });
    assert.equal(c.status, 404);
    assert.equal(question(store3, theirs).status, "pending", "another owner cancelled it");
  }, { owner: OTHER });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. A STEP ASKS AFTER ROUTING — synchronously and through the queue
// ─────────────────────────────────────────────────────────────────────────────

for (const mode of ["sync", "job"]) {
  test("THE LOOK PICKER ASKS (" + mode + "): nothing runs, nothing is published or charged for the edit, and the question is kept with the whole request", async () => {
    const slug = freshSlug("pick-" + mode);
    const store = bucket(slug);
    const worker = await loadWorker();
    const compiler = installCompiler();
    try {
      await withWire({ [T.pick]: { fields: ["shape"], question: Q } }, async (seen) => {
        const message = "Move the order band up";
        const post = browserPost(SITE(slug), { intent: "edit", layer: "look" }, message);
        const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
        assert.equal(r.body.ok, false);
        assert.equal(r.body.error, "clarify");
        assert.equal(r.body.cost, 0);
        assert.equal(r.body.unchanged, true);
        assert.match(r.body.clarify.id, /^[0-9a-f]{32}$/);
        assert.equal(r.body.clarify.text, Q.text);
        assert.deepEqual(seen.writers, [], "a step ran after the picker asked");
        assert.equal(compiler.calls.length, 0, "something was compiled for a question");
        if (mode === "job") assert.equal(r.finalized.p_ok, false, "a question's job was finalized as a published edit");
        const q = question(store, slug);
        assert.equal(q.id, r.body.clarify.id);
        assert.equal(q.stage, "look");
        assert.equal(q.round, 1);
        assert.equal(q.request, message);
        assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "a page changed");
        // THE SCREEN: the question with its card, and nothing that reads as a failure.
        const said = editBrowserReply(r.body, r.status >= 200 && r.status < 300, {});
        assert.ok(said.ok, said.why);
        assert.equal(said.text, Q.text);
        assert.deepEqual(said.asked, { id: q.id, text: Q.text, options: Q.options });
      }, { slug });
    } finally { compiler.uninstall(); }
  });
}
