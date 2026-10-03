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
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { ASK_TOOL, LIVE_ASK_TOOL } from "../builder/site-ask.mjs";
import { QUESTION_KEY, packAsk, newAskId, ASK_TTL_MS, contextBlock, MAX_ANSWER_CHARS } from "../builder/clarify.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";
import {
  T, USER, OTHER, HOME, VISIT, NEW_DESC, Q, freshSlug, bucket, question, seedQuestion, withWire, envFor,
  routeCall, questionCall, browserPost, postRoute, SITE, storedLook, storedPage,
} from "./fixtures/live-ask.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE ROUTER ASKS — and a clear request goes straight through
// ─────────────────────────────────────────────────────────────────────────────

test("AN AMBIGUOUS REQUEST: the router asks; the question is kept for this owner and named by its id; the routing call is charged as any; nothing else runs", async () => {
  const slug = freshSlug("asks");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ route: { intent: "clarify", question: Q } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Move the order band up" });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.intent, "clarify");
    assert.match(r.body.question.id, /^[0-9a-f]{32}$/);
    assert.equal(r.body.question.text, Q.text);
    assert.deepEqual(r.body.question.options, Q.options);
    assert.equal(r.body.instruction, undefined, "an instruction rode a question");
    assert.equal(r.body.failed, undefined);
    assert.ok(r.body.cost > 0 && seen.debits.length === 1, "the routing call that asked was not charged as any other: " + JSON.stringify(seen.debits));
    assert.deepEqual(seen.calls, [T.route], "anything but the routing call ran");
    // WHAT THE ROUTER WAS TOLD: the live tool, and that it may ask.
    assert.equal(seen.routerAsked[0].tools[0].name, LIVE_ASK_TOOL.name);
    assert.ok(seen.routerAsked[0].tools[0].input_schema.properties.answered, "the live tool was not sent");
    assert.match(String(seen.routerAsked[0].messages[0].content), /A QUESTION MAY BE ASKED/);
    // WHAT WAS KEPT.
    const q = question(store, slug);
    assert.equal(q.id, r.body.question.id);
    assert.equal(q.status, "pending");
    assert.equal(q.stage, "route");
    assert.equal(q.round, 1);
    assert.equal(q.uid, USER.id);
    assert.equal(q.request, "Move the order band up", "the request the answer resumes is not the message that was asked about");
    assert.deepEqual(q.held, []);
    assert.equal(q.attached, false);
  });
});

test("A CLEAR REQUEST GOES STRAIGHT THROUGH: no question is kept, and the answer carries nothing about one", async () => {
  const slug = freshSlug("clear");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ route: { intent: "edit", layer: "look" } }, async () => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Make the buttons rounder" });
    assert.equal(r.body.intent, "edit");
    assert.equal(r.body.layer, "look");
    assert.equal(r.body.question, undefined);
    assert.equal(r.body.ask, undefined, "a message answering nothing was told about a question");
    assert.deepEqual(store.questionWrites, [], "a question was written for a clear request");
  });
});

test("THE FIRST BUILD IS NEVER ASKED A LIVE SITE'S QUESTION, AND NO QUESTION IS READ OR WRITTEN FOR IT", async () => {
  const slug = freshSlug("first");
  const store = bucket(slug);
  const worker = await loadWorker();
  const gets = [];
  const realGet = store.get.bind(store);
  store.get = async (k) => { gets.push(k); return realGet(k); };
  await withWire({ route: { intent: "build" } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "A bakery in Leeds", firstBuild: true, hasSite: false });
    assert.equal(r.body.intent, "build");
    assert.equal(JSON.stringify(seen.routerAsked[0].tools[0]), JSON.stringify(ASK_TOOL), "a first build was sent the live tool");
    assert.ok(!gets.includes(QUESTION_KEY(slug)), "a first build read a site's question");
    assert.deepEqual(store.questionWrites, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TECHNICAL FAILURES STAY TECHNICAL
// ─────────────────────────────────────────────────────────────────────────────

test("A QUESTION THAT CANNOT BE USED OR KEPT IS A TECHNICAL FAILURE: said as one, charged nothing, nothing kept", async () => {
  const worker = await loadWorker();
  // (a) The router's question cannot be read.
  {
    const slug = freshSlug("unreadable");
    const store = bucket(slug);
    await withWire({ route: { intent: "clarify", question: { text: "" } } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Move the band" });
      assert.equal(r.body.failed, true, "an unusable question was acted on");
      assert.equal(r.body.failure.kind, "answer");
      assert.equal(r.body.cost, 0);
      assert.deepEqual(seen.debits, [], "an unusable answer was charged");
      assert.deepEqual(store.questionWrites, []);
    });
  }
  // (b) The question cannot be written.
  {
    const slug = freshSlug("storefail");
    const store = bucket(slug, { failQuestion: true });
    await withWire({ route: { intent: "clarify", question: Q } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Move the band" });
      assert.equal(r.body.failed, true, "a question that could not be kept was shown");
      assert.equal(r.body.failure.kind, "store");
      assert.equal(r.body.cost, 0);
      assert.deepEqual(seen.debits, [], "a question we could not keep was charged");
    });
  }
  // (c) The waiting question cannot be read when an answer arrives: our failure,
  // said as one, before any model call — never read as a stale answer.
  {
    const slug = freshSlug("readfail");
    const store = bucket(slug, { failQuestionRead: true });
    await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: newAskId() } });
      assert.equal(r.status, 200);
      assert.equal(r.body.failed, true, "an unreadable store was read as an answer or a stale one: " + JSON.stringify(r.body));
      assert.equal(r.body.failure.kind, "store");
      assert.equal(r.body.cost, 0);
      assert.deepEqual(seen.calls, [], "the router was asked although the question could not be read");
      assert.deepEqual(seen.debits, []);
    });
  }
  // (d) The answer cannot be recorded (the close's write fails): our failure,
  // charged nothing, and the question is still there to answer.
  {
    const slug = freshSlug("closefail");
    const store = bucket(slug, { failQuestion: true });
    const q = seedQuestion(store, slug);
    await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
      assert.equal(r.body.failed, true, "an answer that could not be recorded was acted on: " + JSON.stringify(r.body));
      assert.equal(r.body.failure.kind, "store");
      assert.equal(r.body.cost, 0);
      assert.equal(r.body.instruction, undefined);
      assert.deepEqual(seen.debits, [], "an answer we could not record was charged");
      assert.equal(question(store, slug).status, "pending");
    });
  }
  // (e) No question can be kept here (no address to keep it under): the router
  // is told questions are closed, and one it asks anyway is a failure of the
  // answer, charged nothing — never shown as words nobody's answer can resume
  // (2026-10-02, the owner's review).
  {
    const store = bucket("unused");
    await withWire({ route: { intent: "clarify", question: Q } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug: "", message: "Move the band" });
      assert.match(String(seen.routerAsked[0].messages[0].content), /Questions are closed for this message/, "a router that cannot keep a question was told it may ask");
      assert.equal(r.body.failed, true, "a question nothing can keep was used: " + JSON.stringify(r.body));
      assert.equal(r.body.failure.kind, "answer");
      assert.equal(r.body.cost, 0);
      assert.equal(r.body.answer, undefined, "the question was said as words with nothing waiting");
      assert.equal(r.body.question, undefined, "a question nothing can answer was offered with a card");
      assert.ok(r.body.decision.reasons.includes("clarify-unkeepable"), JSON.stringify(r.body.decision));
      assert.deepEqual(seen.debits, [], "an unusable answer was charged");
      assert.deepEqual(store.questionWrites, []);
    });
  }
  // (f) The site is not the caller's: nothing is kept for it.
  {
    const slug = freshSlug("stranger");
    const store = bucket(slug);
    await withWire({ route: { intent: "clarify", question: Q } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Move the band" });
      assert.equal(r.body.failed, true);
      assert.deepEqual(store.questionWrites, [], "a question was kept on a site the caller does not own");
      assert.deepEqual(seen.debits, []);
    }, { owner: OTHER });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE ANSWER: resumed, a changed request, and the stale ones
// ─────────────────────────────────────────────────────────────────────────────

test("A TYPED ANSWER RESUMES THE WAITING REQUEST WORD FOR WORD, with the answer beside it; the question closes once; the routing call is charged as any", async () => {
  const slug = freshSlug("answer");
  const store = bucket(slug);
  const q = seedQuestion(store, slug, { held: ["add a gallery page"] });
  const worker = await loadWorker();
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(r.status, 200);
    assert.equal(r.body.intent, "edit");
    assert.equal(r.body.instruction, q.request, "the request the answer resumes is not the waiting one, word for word");
    assert.deepEqual(r.body.ask, { answered: true, round: 1, putOff: ["add a gallery page"], context: [{ q: Q.text, a: "Visit" }] },
      "the answer does not ride beside the request");
    assert.ok(r.body.cost > 0, "the answer's routing call was not charged");
    const told = String(seen.routerAsked[0].messages[0].content);
    assert.match(told, /THEIR LAST REQUEST IS WAITING ON AN ANSWER/);
    assert.ok(told.includes(q.request) && told.includes(Q.text), "the router was not shown what is waiting");
    assert.equal(question(store, slug).status, "answered");
  });
});

test("A PRESSED ANSWER IS AN ANSWER, whatever the router says; A CHANGED REQUEST CLOSES THE QUESTION AND IS ROUTED ON ITS OWN", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("chosen");
    const store = bucket(slug);
    const q = seedQuestion(store, slug);
    await withWire({ route: { intent: "edit", layer: "look", answered: false } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id, chosen: true } });
      assert.equal(r.body.ask.answered, true, "a pressed answer was read as a new request");
      assert.match(String(seen.routerAsked[0].messages[0].content), /They picked one of those answers/);
      assert.equal(question(store, slug).status, "answered");
    });
  }
  {
    const slug = freshSlug("changed");
    const store = bucket(slug);
    const q = seedQuestion(store, slug);
    await withWire({ route: { intent: "addon", answered: false } }, async () => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Actually, add a gallery page", ask: { id: q.id } });
      assert.deepEqual(r.body.ask, { answered: false });
      assert.equal(r.body.intent, "addon", "the new request was not routed on its own");
      assert.equal(r.body.instruction, undefined, "the old request was resumed for a changed one");
      assert.equal(question(store, slug).status, "superseded");
    });
  }
});

test("A MESSAGE THAT NAMES NO QUESTION REPLACES THE WAITING ONE, so an older tab can never answer it afterwards", async () => {
  const slug = freshSlug("replaced");
  const store = bucket(slug);
  const q = seedQuestion(store, slug);
  const worker = await loadWorker();
  await withWire({ route: [{ intent: "edit", layer: "look" }] }, async (seen) => {
    await routeCall(worker, envFor(store), { slug, message: "Make the buttons rounder" });
    assert.equal(question(store, slug).status, "superseded");
    const late = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(late.status, 409);
    assert.equal(late.body.error, "stale-question");
    assert.equal(seen.calls.length, 1, "the late answer reached the router");
  });
});

test("A STALE ANSWER TRIGGERS NOTHING: answered twice, cancelled, expired, another owner's, malformed — refused before any model call, at no cost", async () => {
  const worker = await loadWorker();
  const cases = [
    ["answered twice", (store, slug) => { const q = seedQuestion(store, slug); q.status = "answered"; store.store.set(QUESTION_KEY(slug), { body: JSON.stringify(q), etag: "x1" }); return { id: q.id }; }, "closed"],
    ["cancelled", (store, slug) => { const q = seedQuestion(store, slug, { status: "cancelled" }); return { id: q.id }; }, "closed"],
    ["expired", (store, slug) => { const q = seedQuestion(store, slug, { at: Date.now() - ASK_TTL_MS - 1 }); return { id: q.id }; }, "expired"],
    ["another owner's", (store, slug) => { const q = seedQuestion(store, slug, { uid: OTHER }); return { id: q.id }; }, "other"],
    ["another question", (store, slug) => { seedQuestion(store, slug); return { id: newAskId() }; }, "other"],
    ["no question at all", () => ({ id: newAskId() }), "missing"],
    ["a malformed claim", (store, slug) => { seedQuestion(store, slug); return { id: "not-an-id" }; }, "other"],
    ["a first build", (store, slug) => { const q = seedQuestion(store, slug); return { id: q.id, firstBuild: true }; }, "other"],
  ];
  for (const [name, setup, why] of cases) {
    const slug = freshSlug("stale");
    const store = bucket(slug);
    const { firstBuild = false, ...ask } = setup(store, slug);
    const before = question(store, slug);
    await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask, firstBuild, hasSite: !firstBuild });
      assert.equal(r.status, 409, name);
      assert.equal(r.body.error, "stale-question", name);
      assert.equal(r.body.why, why, name);
      assert.equal(r.body.cost, 0, name);
      assert.match(r.body.msg, why === "expired" ? /expired/ : /already answered or set aside/, name);
      assert.deepEqual(seen.calls, [], name + ": a stale answer reached a model");
      assert.deepEqual(seen.debits, [], name + ": a stale answer was charged");
      // NOR DOES IT CLOSE A QUESTION THAT IS STILL LIVE.
      if (before && before.status === "pending") assert.equal(question(store, slug).status, "pending", name + ": a stale answer closed the live question");
    });
  }
  // AND TWO ANSWERS AT ONCE: one resumes, the other is refused.
  const slug = freshSlug("race");
  const store = bucket(slug);
  const q = seedQuestion(store, slug);
  await withWire({ route: [{ intent: "edit", layer: "look", answered: true }, { intent: "edit", layer: "look", answered: true }] }, async () => {
    const [a, b] = await Promise.all([
      routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } }),
      routeCall(worker, envFor(store), { slug, message: "Home", ask: { id: q.id } }),
    ]);
    const won = [a, b].filter((r) => r.status === 200 && r.body.ask && r.body.ask.answered === true);
    const lost = [a, b].filter((r) => r.status === 409);
    assert.equal(won.length, 1, "both answers resumed the request: " + JSON.stringify([a.body, b.body]));
    assert.equal(lost.length, 1);
  });
});

test("HOWEVER LONG THE REQUEST, AN ANSWER BESIDE IT FITS — the request never grows; ONLY AN ANSWER LONGER THAN A REPLY TO ONE QUESTION IS REFUSED, at no cost, with the question still waiting", async () => {
  const slug = freshSlug("toolong");
  const store = bucket(slug);
  const q = seedQuestion(store, slug, { request: "x".repeat(1900) });
  const worker = await loadWorker();
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "y".repeat(MAX_ANSWER_CHARS + 1), ask: { id: q.id } });
    assert.equal(r.status, 422);
    assert.equal(r.body.error, "answer-too-long");
    assert.match(r.body.msg, /Your request is still waiting/, "the refusal does not say the request is kept");
    assert.equal(r.body.cost, 0);
    assert.deepEqual(seen.debits, []);
    assert.equal(question(store, slug).status, "pending", "a refused answer closed the question");
  });
  // THE SAME LONG REQUEST, ANSWERED IN 300 CHARACTERS: an answer that the old rule refused for want of room is kept.
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async () => {
    const r = await routeCall(worker, envFor(store), { slug, message: "y".repeat(300), ask: { id: q.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.instruction, "x".repeat(1900), "the request grew, or was cut");
    assert.deepEqual(r.body.ask.context, [{ q: Q.text, a: "y".repeat(300) }]);
    assert.equal(question(store, slug).status, "answered");
  });
});

test("A RESUMED REQUEST MAY ASK ANOTHER QUESTION, keeping what it put off and the same request — and the router is shown every answer so far, never that questions are closed", async () => {
  const slug = freshSlug("round2");
  const store = bucket(slug);
  const q = seedQuestion(store, slug, { held: ["add a gallery page"], attached: true });
  const worker = await loadWorker();
  const Q2 = { text: "Above which heading exactly?" };
  await withWire({ route: { intent: "clarify", question: Q2, answered: true } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Visit", ask: { id: q.id } });
    assert.equal(r.body.intent, "clarify");
    // THE ANSWER WAS TAKEN, AND THE REQUEST WAITS ON THE NEW QUESTION: no
    // request to run yet, so none is sent — the browser's reader must accept that.
    assert.deepEqual(r.body.ask, { answered: true, round: 1, putOff: ["add a gallery page"], context: [{ q: Q.text, a: "Visit" }] });
    assert.equal(r.body.instruction, undefined, "a request to run rode the second question");
    const told = String(seen.routerAsked[0].messages[0].content);
    assert.match(told, /A QUESTION MAY BE ASKED/);
    assert.ok(told.includes("They were asked: " + Q.text), "the router was not shown the question it asked");
    assert.doesNotMatch(told, /more questions? about this request/, "the router was told a count of questions");
    const q2 = question(store, slug);
    assert.equal(q2.id, r.body.question.id);
    assert.equal(q2.round, 2);
    assert.deepEqual(q2.context, [{ q: Q.text, a: "Visit" }], "the second question does not carry the first answer");
    assert.equal(q2.request, q.request, "the request grew, or changed, at the second question");
    assert.deepEqual(q2.held, ["add a gallery page"], "what the request put off was lost at the second question");
    assert.equal(q2.attached, true, "the request's files were forgotten at the second question, though the answer carried none");
  });
  const q2 = question(store, slug);
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Above Come to the bakery", ask: { id: q2.id } });
    assert.equal(r.body.ask.round, 2);
    assert.deepEqual(r.body.ask.context, [{ q: Q.text, a: "Visit" }, { q: Q2.text, a: "Above Come to the bakery" }], "the step would not be shown both answers");
    assert.equal(r.body.instruction, q.request, "the request the second answer resumes is not the first, word for word");
    const told = String(seen.routerAsked[0].messages[0].content);
    assert.ok(told.includes(contextBlock([{ q: Q.text, a: "Visit" }])), "the router was not shown the first answer under the waiting request");
    assert.ok(told.includes("They were asked: " + Q2.text));
    assert.doesNotMatch(told, /Questions are closed for this message/, "a second answer closed questions: the next one would be words nobody can answer");
    assert.match(told, /A QUESTION MAY BE ASKED/);
  });
});

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

test("THE TEXT STEP ASKS: the question is the step's, kept as the text step's, and no words change", async () => {
  const slug = freshSlug("text");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ [T.text]: { edits: [], question: { text: "Which heading — Harbour Loaf or Come to the bakery?" } } }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "text" }, "Change the heading to Fresh Bread", ["data:image/png;base64,iVBORw0KGgo="]);
    assert.equal(post.body.attached, true, "the browser did not say the message carried files");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.body.error, "clarify");
    assert.equal(seen.texts.length, 1, "the text step was not asked");
    const q = question(store, slug);
    assert.equal(q.stage, "text");
    assert.equal(q.attached, true, "a step's question forgot the message carried files, so a browser without them would answer without them");
    assert.equal(q.request, "Change the heading to Fresh Bread");
    assert.equal(storedPage(store, slug, "index.tsx"), HOME);
  }, { slug });
});

test("A MIXED REQUEST: the part that can run runs and is published; the step that asked keeps ONLY its own part for the answer; the reply names both", async () => {
  const slug = freshSlug("mixed");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  const DESC_WORDS = "Change the site's search description to \"" + NEW_DESC + "\"";
  const MOVE_WORDS = "put the order band above the other one";
  try {
    await withWire({
      [T.pick]: { fields: ["description", "shape"], scopes: [{ part: "description", words: DESC_WORDS }, { part: "shape", page: "/visit", words: MOVE_WORDS }] },
      "lane:description": NEW_DESC,
      [T.tweak]: { source: "", question: { text: "Which band is the order band — the one on Visit?", options: ["Yes", "No"] } },
    }, async (seen) => {
      const message = DESC_WORDS + ". Then " + MOVE_WORDS + ".";
      const post = browserPost(SITE(slug), { intent: "edit", layer: "look" }, message);
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
      assert.equal(r.body.ok, true, "the part that could run did not: " + JSON.stringify(r.body).slice(0, 400));
      assert.equal(storedLook(store, slug).description, NEW_DESC, "the description that could run was not stored");
      assert.equal(storedPage(store, slug, "visit.tsx"), VISIT, "the page whose step asked was changed");
      assert.match(r.body.clarify.id, /^[0-9a-f]{32}$/);
      const q = question(store, slug);
      assert.equal(q.stage, "page");
      assert.equal(q.request, MOVE_WORDS, "the answer would resume the whole message and redo the description: " + q.request);
      assert.equal((r.body.partial || []).some((p) => p && Object.hasOwn(p, "ask")), false, "the question's internals reached the browser");
      const said = editBrowserReply(r.body, true, {});
      assert.ok(said.ok, said.why);
      assert.match(said.text, /^✅/, "what ran is not said first");
      assert.ok(said.text.endsWith("Which band is the order band — the one on Visit?"), "the question is not last, above its answers: " + said.text);
      assert.ok(!/didn’t go through/.test(said.text), "the step that asked was reported as a failure: " + said.text);
      assert.equal(said.asked.id, q.id);
    }, { slug });
  } finally { compiler.uninstall(); }
});

test("A STEP'S THIRD QUESTION IS KEPT AND ANSWERABLE, WITH BOTH EARLIER ANSWERS BESIDE THE SAME REQUEST: no count turns it into words nobody can answer", async () => {
  const slug = freshSlug("third-step");
  const store = bucket(slug);
  const worker = await loadWorker();
  const earlier = [{ q: "Which band?", a: "The order band" }, { q: "Above which heading?", a: "The first one" }];
  await withWire({ [T.pick]: { fields: ["shape"], question: Q } }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "look", askRound: 2, context: earlier }, "Move the band");
    assert.equal(post.body.askRound, 2, "the browser did not post the question count");
    assert.deepEqual(post.body.context, earlier, "the browser did not post what they already told us");
    assert.equal(post.body.instruction, "Move the band", "the browser folded an answer into the request");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.match(r.body.clarify.id, /^[0-9a-f]{32}$/, "a third question was shown with nothing waiting: " + JSON.stringify(r.body.clarify));
    assert.ok(seen.inputs[T.pick][0].endsWith(contextBlock(earlier)), "the picker was not shown what they already told us");
    const q = question(store, slug);
    assert.equal(q.id, r.body.clarify.id);
    assert.equal(q.round, 3);
    assert.deepEqual(q.context, earlier, "the third question does not carry both earlier answers");
    assert.equal(q.request, "Move the band", "the request grew at the third question");
    const said = editBrowserReply(r.body, true, {});
    assert.equal(said.text, Q.text);
    assert.equal(said.asked.id, q.id, "the third question was drawn without its card");
  }, { slug });
});

test("A STEP'S QUESTION ON A RESUMED REQUEST KEEPS WHAT WAS PUT OFF — before the first question and by this message — and counts its question", async () => {
  const slug = freshSlug("step-held");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ [T.pick]: { fields: ["shape"], question: Q } }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "look", putOff: ["add a gallery page"], alsoAsked: "add a contact form", askRound: 1 },
      "Move the band\n\nThey were asked: Which band?\nThey answered: The order band. Also add a contact form");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
    const q = question(store, slug);
    assert.equal(q.round, 2, "a step's question on a resumed request was not counted as its second");
    assert.deepEqual([...q.held].sort(), ["add a contact form", "add a gallery page"], "what the request put off is lost when the step's question is answered: " + JSON.stringify(q.held));
    assert.ok(!/add a contact form/.test(q.request), "the part this message put off is in the request the answer resumes: " + q.request);
  }, { slug });
});

test("WHAT A RESUMED REQUEST PUT OFF BEFORE ITS QUESTION IS NAMED ON EVERY ENDING, AND NEVER RUN", async () => {
  const slug = freshSlug("putoff");
  const store = bucket(slug);
  const worker = await loadWorker();
  const compiler = installCompiler();
  try {
  await withWire({ [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "look", putOff: ["add a gallery page"], askRound: 1 }, "Change the description to \"" + NEW_DESC + "\"");
    assert.equal(post.body.putOff, "add a gallery page", "the browser did not post what was put off");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.body.ok, true);
    assert.equal(r.body.putOff, "add a gallery page");
    assert.equal(r.body.deferred, undefined, "an earlier part was named as one this message took out");
    assert.ok(!seen.picks.some((p) => /gallery/i.test(String(p))), "the earlier part reached the picker");
    const said = editBrowserReply(r.body, true, {});
    assert.match(said.text, /Say “add a gallery page” and I’ll do that next/);
  }, { slug });
  } finally { compiler.uninstall(); }
});

test("A RESUMED REQUEST RUNS WITH ITS ANSWER BESIDE IT — the step that acts is shown the question and the answer in their own section after its words, end to end from the routing route (sync and queued)", async () => {
  const compiler = installCompiler();
  try {
  for (const mode of ["sync", "job"]) {
    const slug = freshSlug("resume-" + mode);
    const store = bucket(slug);
    const q = seedQuestion(store, slug, { request: "Change the site's search description", question: { text: "What should it say?" } });
    const worker = await loadWorker();
    await withWire({ route: { intent: "edit", layer: "look", answered: true }, [T.pick]: { fields: ["description"] }, "lane:description": NEW_DESC }, async (seen) => {
      const d = (await routeCall(worker, envFor(store), { slug, message: NEW_DESC, ask: { id: q.id } })).body;
      assert.equal(d.ask.answered, true);
      // What the browser does with an answered question (`siteRoute`): the request it resumes, its count, its answers.
      const post = browserPost(SITE(slug), { ...d, askRound: d.ask.round, putOff: d.ask.putOff, context: d.ask.context }, d.instruction);
      assert.equal(post.body.instruction, "Change the site's search description", mode + ": the request posted is not the waiting one, word for word");
      const r = await postRoute(worker, envFor(store), store, seen, slug, post, mode);
      assert.equal(r.body.ok, true, mode + ": " + JSON.stringify(r.body).slice(0, 300));
      assert.equal(storedLook(store, slug).description, NEW_DESC, mode);
      const handed = seen.lanes.find((l) => l.field === "description").asked;
      assert.equal(handed, "Change the site's search description\n\n" + contextBlock([{ q: "What should it say?", a: NEW_DESC }]),
        mode + ": the lane was not shown its request, then the answer in its own section: " + handed);
      assert.equal(question(store, slug).status, "answered", mode);
    }, { slug });
  }
  } finally { compiler.uninstall(); }
});

test("THE ADD-ON PICKER ASKS: nothing is designed, added or charged, and the question is kept as the add-on's", async () => {
  const slug = freshSlug("addon");
  const store = bucket(slug);
  const worker = await loadWorker();
  await withWire({ [T.adds]: { question: { text: "Should the new page list every loaf, or only today's bake?", options: ["Every loaf", "Today's bake"] } } }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "addon" }, "Add a page for our breads");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.body.error, "clarify", JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.cost, 0);
    assert.deepEqual(seen.calls, [T.adds], "the add-on designed something after its picker asked");
    const q = question(store, slug);
    assert.equal(q.stage, "addon");
    assert.equal(q.request, "Add a page for our breads");
  }, { slug });
});

test("A QUESTION A STEP CANNOT KEEP IS SAID AS OURS, never as a question nobody can answer", async () => {
  const slug = freshSlug("unkept");
  const store = bucket(slug, { failQuestion: true });
  const worker = await loadWorker();
  await withWire({ [T.pick]: { fields: ["shape"], question: Q } }, async (seen) => {
    const post = browserPost(SITE(slug), { intent: "edit", layer: "look" }, "Move the band");
    const r = await postRoute(worker, envFor(store), store, seen, slug, post, "sync");
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "clarify-unkept");
    assert.equal(r.body.ours, true);
    assert.equal(r.body.clarify, undefined, "a question that was not kept was offered to be answered");
    // WHAT IT LEFT TO DO GOES BACK TO THE MESSAGE BOX (2026-10-02), so the
    // request can be sent again with the detail — nothing done is in it.
    assert.equal(r.body.resume, "Move the band");
    assert.ok(r.body.msg.includes(Q.text), "the detail it needed was not named: " + r.body.msg);
  }, { slug });
});
