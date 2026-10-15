// WHERE TALK ENDS AND WORK BEGINS (2026-10-15, the conversation batch): the
// real route (`POST /api/site/route`), its storage, and the model wire
// supplied (`test/fixtures/live-ask.mjs`).
//
// What a real model decides, and what it writes, is a live reading (the
// `converse` mode of `scripts/media-verify.mjs`). These cases pin what the
// route does with each decision, and what each model is shown so that it can
// decide well:
//   - discussing and refining a plan is answered by the reply's own call, and
//     starts nothing;
//   - a clear follow-up ("use the second idea") runs the request written out
//     from the conversation, with no conversational reply and no question
//     back — and the idea it leans on, past 800 characters of a long reply, is
//     shown to the router whole;
//   - "do that on every page" is answered from the site's own page list;
//   - an ambiguous or unavailable reference is "ask", and the reply is told
//     exactly what to ask about;
//   - a cut history is said to both models;
//   - returning from a side question: the question waited through it, and the
//     answer that follows is the answer to it.
// No sentence a model writes is asserted: only what was shown, what ran, and
// what stayed open.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { freshSlug, bucket, question, seedQuestion, withWire, envFor, routeCall, ROUTES } from "./fixtures/live-ask.mjs";
import { ROUTER_TURN_CHARS, ROUTER_LAST_REPLY_CHARS, routerHistory, CONVERSE_SYSTEM } from "../builder/site-converse.mjs";

const workStarted = (seen) => seen.rpc.filter((r) => /edit_(claim|reserve|publish|create)/.test(r.fn)).length + seen.lanes.length + seen.writers.length + seen.pageWriters.length + seen.designers.length + seen.picks.length;

// A REPLY WITH FIVE NUMBERED IDEAS, the second of which starts well past the
// router's ordinary 800 characters for a turn.
const pad = " It suits a bakery whose loaves sell out early, and it reads well on a phone, where most of your visitors arrive.";
const IDEAS = "Here are five headline ideas for your home page, each with why it might work.\n\n" +
  "1. **Bread at dawn.**" + pad.repeat(8) + "\n\n" +
  "2. **Baked while the harbour sleeps.**" + pad.repeat(3) + "\n\n" +
  "3. **Sourdough from the side street.**" + pad + "\n\n" +
  "4. **Collect it warm.**" + pad + "\n\n" +
  "5. **Your loaf, held for you.**" + pad;
const IDEAS_THREAD = [
  { role: "user", text: "Give me some headline ideas for my home page." },
  { role: "assistant", text: IDEAS },
];

test("THE ROUTER SEES THE LATEST REPLY WHOLE: an idea past 800 characters is in its window, and older turns keep their 800", () => {
  assert.ok(IDEAS.indexOf("2. **Baked") > ROUTER_TURN_CHARS, "the fixture does not put the second idea past the ordinary cut");
  assert.ok(IDEAS.length < ROUTER_LAST_REPLY_CHARS, "the fixture is longer than the latest reply's room");
  const shown = routerHistory([{ role: "assistant", text: "x".repeat(2000) }, ...IDEAS_THREAD]);
  const last = shown.turns.at(-1);
  assert.equal(last.text, IDEAS, "the latest reply was cut for the router");
  assert.equal(last.cut, undefined);
  // AN OLDER ASSISTANT TURN KEEPS ITS ORDINARY CUT.
  assert.equal(shown.turns[0].text.length, ROUTER_TURN_CHARS);
  assert.equal(shown.turns[0].cut, true);
});

test("DISCUSSION WITHOUT EXECUTION: asking what to improve, and refining the plan, are answered by the reply's own call — told to keep facts, suggestions and unknowns apart — and start nothing", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("discuss");
  const store = bucket(slug);
  await withWire({ route: { intent: "ask", answer: "A clearer headline first." }, converse: "Start with the headline: your home page says only the name." }, async (seen) => {
    const first = await routeCall(worker, envFor(store), { slug, message: "What would you improve first on my home page, and why?" });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.intent, "ask");
    assert.equal(first.body.replyFrom, "conversation");
    // THE ROUTER IS TOLD THAT THINKING IT THROUGH IS CONVERSATION.
    assert.match(seen.routerAsked[0].system[0].text, /THINKING IT THROUGH, THEN DOING IT/);
    // THE REPLY IS GIVEN THE SITE, AND TOLD TO KEEP WHAT IT SEES, SUGGESTS AND DOES NOT KNOW APART.
    const asked = seen.converse[0];
    assert.match(asked.messages[0].content, /Page \/: Harbour Loaf/);
    assert.match(asked.system[0].text, /Keep three things apart/);
    assert.match(asked.system[0].text, /most important first, each with why/);
    // A REFINEMENT OF THE PLAN IS STILL TALK.
    const refine = await routeCall(worker, envFor(store), { slug, message: "Drop the third one — what would the plan be then?", extra: { history: IDEAS_THREAD } });
    assert.equal(refine.body.intent, "ask");
    assert.equal(refine.body.resolved, undefined, "talk was written out as work");
    assert.equal(seen.converse.length, 2);
    assert.equal(workStarted(seen), 0, "discussion started work");
  });
});

test("A CLEAR FOLLOW-UP RUNS: 'use the second idea' is written out as the work itself — no reply, no question back — from an idea the router was shown whole", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("second-idea");
  const store = bucket(slug);
  const written = "Change the home page headline to \"Baked while the harbour sleeps.\"";
  await withWire({ route: { intent: "edit", layer: "text", resolved: written } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "use the second idea", extra: { history: IDEAS_THREAD } });
    assert.equal(r.body.intent, "edit");
    assert.equal(r.body.resolved, written, "the written-out request does not reach the page");
    assert.equal(r.body.unclear, undefined);
    assert.equal(seen.converse.length, 0, "a clear instruction got a conversational reply");
    assert.equal(r.body.question, undefined, "a clear instruction was asked to confirm");
    // WHAT IT LEANED ON WAS THERE TO SEE.
    const routed = seen.routerAsked[0].messages[0].content;
    assert.match(routed, /2\. \*\*Baked while the harbour sleeps\.\*\*/, "the second idea was not shown to the router");
    assert.doesNotMatch(routed, /PARTS OF THIS CONVERSATION ARE NOT SHOWN/, "the window was cut where it need not be");
    assert.match(seen.routerAsked[0].tools[0].input_schema.properties.resolved.description, /the second item of the most recent numbered or bulleted list/);
  });
});

test("'DO THAT ON EVERY PAGE' is written out from the site's own page list, which the router is shown", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("every-page");
  const store = bucket(slug);
  const thread = [
    { role: "user", text: "What could go in the footer?" },
    { role: "assistant", text: "A short line with your opening days and a link to the Visit page would help." },
    { role: "user", text: "I like that. Add it to the home page footer." },
    { role: "assistant", text: "Sure — just ask and it will be done." },
  ];
  const written = "Add a footer line with the opening days and a link to the Visit page on every page: /, /visit";
  await withWire({ route: { intent: "edit", layer: "look", resolved: written } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "do that on every page", extra: { history: thread } });
    assert.equal(r.body.intent, "edit");
    assert.equal(r.body.resolved, written);
    const routed = seen.routerAsked[0].messages[0].content;
    for (const p of ROUTES) assert.ok(routed.includes(p), "the router was not shown the page " + p);
    assert.match(seen.routerAsked[0].tools[0].input_schema.properties.resolved.description, /every page by its address from the site's page list/);
    assert.equal(seen.converse.length, 0);
  });
});

test("AN AMBIGUOUS REFERENCE IS ASKED ABOUT: nothing runs, nothing is written out, and the reply is told exactly what is unclear — the question is the model's own", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("which-one");
  const store = bucket(slug);
  const thread = [
    { role: "user", text: "Ideas for a headline, and for colours?" },
    { role: "assistant", text: "Headlines:\n1. Bread at dawn\n2. Baked while the harbour sleeps\n\nColours:\n1. Harbour blue\n2. Flour white" },
  ];
  const unclear = "which list: the headline ideas or the colour ideas";
  await withWire({ route: { intent: "ask", answer: "Which list do you mean?", unclear }, converse: "Do you mean the second headline or the second colour?" }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "use the second one", extra: { history: thread } });
    assert.equal(r.body.intent, "ask");
    assert.equal(r.body.resolved, undefined, "an ambiguous reference was written out as work");
    assert.ok(r.body.decision.reasons.includes("unclear"), JSON.stringify(r.body.decision));
    const text = seen.converse[0].messages[0].content;
    assert.match(text, /THEIR MESSAGE LEANS ON SOMETHING THAT COULD NOT BE PINNED DOWN: which list: the headline ideas or the colour ideas/);
    assert.match(text, /Ask them one short, specific question/);
    assert.equal(r.body.answer, "Do you mean the second headline or the second colour?", "the reply is not the model's own");
    assert.equal(workStarted(seen), 0);
  });
  // WITHOUT AN UNCLEAR NOTE, THE REPLY IS NOT TOLD TO ASK.
  await withWire({ route: { intent: "ask", answer: "Sure." }, converse: "Sure." }, async (seen) => {
    await routeCall(worker, envFor(store), { slug, message: "what do you think of the second one?", extra: { history: thread } });
    assert.doesNotMatch(seen.converse[0].messages[0].content, /COULD NOT BE PINNED DOWN/, "the unclear note is sent when nothing was unclear");
  });
  // ON WORK, A NOTE OF WHAT IS UNCLEAR IS LEFT OUT.
  await withWire({ route: { intent: "edit", layer: "text", unclear: "which list", resolved: "Change the headline to Baked while the harbour sleeps" } }, async () => {
    const r = await routeCall(worker, envFor(store), { slug, message: "use the second headline", extra: { history: thread } });
    assert.equal(r.body.intent, "edit");
    assert.equal(r.body.unclear, undefined);
    assert.ok(r.body.decision.reasons.includes("unclear-ignored"));
  });
});

test("CUT HISTORY: a reference into a part the page cut is said to both models — the router asks rather than writing it out, and the reply asks about exactly that part", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("cut-ref");
  const store = bucket(slug);
  // THE PAGE CUT THE LONG REPLY: `full` says how long it was.
  const long = "Three versions of your headline. Version one: Bread at dawn. Version two: Baked while the harbour sleeps.";
  const thread = [{ role: "user", text: "Three headline versions please." }, { role: "assistant", text: long, full: 9000 }];
  const unclear = "the third version is in a part of the conversation not shown";
  await withWire({ route: { intent: "ask", answer: "Could you paste the third version?", unclear }, converse: "I can only see the first two versions — could you paste the third?" }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "use the third version", extra: { history: thread } });
    assert.equal(r.body.intent, "ask");
    assert.equal(r.body.resolved, undefined);
    assert.match(seen.routerAsked[0].messages[0].content, /PARTS OF THIS CONVERSATION ARE NOT SHOWN/);
    const text = seen.converse[0].messages[0].content;
    assert.match(text, /PARTS OF THIS CONVERSATION ARE NOT SHOWN/);
    assert.match(text, /COULD NOT BE PINNED DOWN: the third version is in a part of the conversation not shown/);
    assert.ok(r.body.decision.reasons.includes("history-cut"));
    assert.equal(workStarted(seen), 0);
  });
});

test("RETURNING FROM A SIDE QUESTION: the waiting question survives the side talk, and the reply that follows answers it — with its request in front of the router", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("side-return");
  const store = bucket(slug);
  const q = seedQuestion(store, slug);
  // 1. THE SIDE QUESTION, sent as a reply under the waiting question.
  await withWire({ route: { intent: "ask", answered: false, answer: "Yes." }, converse: "Yes, bookings can be added later. The band question is still open." }, async (seen) => {
    const side = await routeCall(worker, envFor(store), { slug, message: "Before that — can the site take bookings too?", ask: { id: q.id, chosen: false } });
    assert.equal(side.body.intent, "ask");
    assert.deepEqual(side.body.ask, { answered: false, waiting: true });
    assert.equal(question(store, slug).status, "pending", "the side question closed the waiting question");
    assert.match(seen.converse[0].messages[0].content, /A QUESTION OF OURS IS WAITING FOR THEIR ANSWER, and stays open/);
    assert.equal(workStarted(seen), 0);
  });
  // 2. BACK TO IT: the answer, typed under the same question.
  await withWire({ route: { intent: "edit", layer: "look", answered: true } }, async (seen) => {
    const back = await routeCall(worker, envFor(store), { slug, message: "Visit, please", ask: { id: q.id, chosen: false } });
    assert.equal(back.body.intent, "edit", JSON.stringify(back.body).slice(0, 300));
    assert.notEqual(question(store, slug).status, "pending", "the answered question is still waiting");
    const routed = seen.routerAsked[0].messages[0].content;
    assert.match(routed, /Which page should the band move on/, "the router was not told which question this answers");
    assert.match(routed, /Order a collection so we hold a loaf/, "the router was not given the waiting request");
    assert.equal(seen.converse.length, 0, "the answer was given a conversational reply");
  });
});

test("THE REPLY'S INSTRUCTIONS: natural length, no stock enthusiasm, numbered options, no redundant confirmation — and no fixed reply anywhere in them", () => {
  assert.match(CONVERSE_SYSTEM, /Match the length to the need/);
  assert.match(CONVERSE_SYSTEM, /no stock openings/);
  assert.match(CONVERSE_SYSTEM, /number them, so they can answer/);
  assert.match(CONVERSE_SYSTEM, /Do not\s+end every reply with a question or an offer/);
  // THE REPLY IS THE MODEL'S: nothing in the instructions is a sentence to send as is.
  assert.doesNotMatch(CONVERSE_SYSTEM, /reply with exactly|always say|respond with "/i);
});
