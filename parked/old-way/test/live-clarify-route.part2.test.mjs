// PARKED (2026-11-03, park-old-way): the old-way half of test/live-clarify-route.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL } from "../../../builder/route-shared.mjs";
import { QUESTION_KEY, packAsk, newAskId, ASK_TTL_MS, contextBlock, MAX_ANSWER_CHARS } from "../../../builder/clarify.mjs";
import { editBrowserReply } from "../../../scripts/addon-sweep.mjs";
import {
  T, USER, OTHER, HOME, VISIT, NEW_DESC, Q, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedLook, storedPage,
} from "../../../test/fixtures/live-ask.mjs";

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
