// THE CONVERSATION THROUGH THE REAL ROUTE (2026-10-14, the owner's two-area
// batch): `POST /api/site/route` on the real Worker, its storage and the
// model wire supplied (`test/fixtures/live-ask.mjs`).
//
// Representative conversations, each judged by what the route did — the calls
// it made, what each was shown, the question's record, what was charged and
// whether any work was started — never by counting replies:
//   - a multi-turn conversation reaches the reply with its roles and its cut
//     said, and the reply is shown the owner's own pages, tables and files;
//   - a detailed answer comes back whole, from the reply's own call;
//   - a grounded question about the site: the reply is told the pages' words;
//   - missing information: what could not be read is said as not known;
//   - talk about an attached file stays talk, and the file is named as unseen;
//   - a side question beside a waiting question leaves it waiting, whether
//     sent as a reply to it or as a new message;
//   - talk becoming an explicit action runs the request written out from it;
//   - a reply that cannot be written falls back to the router's gist, and
//     only the routing is charged.
// None of it can show what a real model writes: that is a live reading.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { freshSlug, bucket, question, seedQuestion, withWire, envFor, routeCall } from "./fixtures/live-ask.mjs";
// THE REPLY'S MESSAGE IS BLOCKS WHEN IT CARRIES A CONVERSATION (2026-10-20, so
// each reply reuses the last one's cache); its words are the blocks' words, in order.
const textOf = (req) => { const c = req.messages[0].content; return typeof c === "string" ? c : c.map((b) => b.text).join("\n"); };

const HISTORY = [
  { role: "user", text: "Could my site take bookings for bread-making classes?" },
  { role: "assistant", text: "Yes — a booking page with class times and a short form would do it." },
  { role: "user", text: "And what would it need from me?" },
  { role: "assistant", text: "The class times, how many people fit, and the price." },
];
const DETAILED = "## A booking page\n\nYou would need:\n\n1. **Class times** — the days and hours.\n2. **Places** — how many fit.\n3. **Price**.\n\n## An enquiry form instead\n\n- Simpler: people write in and you reply.";
const workStarted = (seen) => seen.rpc.filter((r) => /edit_(claim|reserve|publish|create)/.test(r.fn)).length + seen.lanes.length + seen.writers.length + seen.pageWriters.length + seen.designers.length + seen.picks.length;

test("A MULTI-TURN CONVERSATION: the reply is shown the history, its roles and cut, and the owner's own site — and the detailed answer comes back whole", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("talk");
  const store = bucket(slug);
  const history = [{ role: "user", text: "earliest" }, ...Array.from({ length: 30 }, (_, i) => HISTORY[i % 4])];
  await withWire({ route: { intent: "ask", answer: "Both work; a booking page suits classes." }, converse: DETAILED }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Compare a booking page with an enquiry form for my classes", extra: { history } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "ask");
    assert.equal(r.body.answer, DETAILED, "the detailed answer did not come back whole");
    assert.equal(r.body.replyFrom, "conversation");
    assert.equal(seen.converse.length, 1, "the reply's own call was not made once");
    const asked = seen.converse[0];
    assert.ok(asked.max_tokens > seen.routerAsked[0].max_tokens * 2, "the reply has no more room than the router");
    const text = textOf(asked);
    assert.match(text, /Owner: Could my site take bookings for bread-making classes\?/);
    assert.match(text, /Assistant \(you\): Yes — a booking page/);
    assert.match(text, /1 earlier message is not shown here/, "the window's cut was not said");
    assert.doesNotMatch(text, /Owner: earliest/, "a turn past the window was shown");
    // THE OWNER'S OWN SITE, AS STORED: the pages' words, no row, and the tables as read.
    assert.match(text, /Page \/: Harbour Loaf · Bread from the harbour, every morning\./);
    assert.match(text, /Page \/visit: Come to the bakery/);
    assert.match(text, /It has no database tables\./);
    assert.match(text, /Its file library is empty\./);
    // THE ROUTER WAS SHOWN ITS SMALL WINDOW ONLY.
    const routed = seen.routerAsked[0].messages[0].content;
    assert.match(routed, /THE CONVERSATION SO FAR/);
    assert.ok((routed.match(/^Owner: /gm) || []).length <= 4, "the router was shown more than its window");
    assert.ok(r.body.decision.reasons.includes("history-shown") && r.body.decision.reasons.includes("history-cut"));
    // CHARGED ONCE FOR BOTH CALLS, AND NOTHING ELSE STARTED.
    assert.equal(seen.debits.length, 1, "the two calls were charged separately");
    assert.equal(r.body.cost, seen.debits[0]);
    assert.equal(workStarted(seen), 0, "a conversation started work");
  });
});

test("A SIDE QUESTION SENT AS A REPLY TO A WAITING QUESTION leaves it waiting, and the reply knows it is still open", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("side-claim");
  const store = bucket(slug);
  const q = seedQuestion(store, slug);
  await withWire({ route: { intent: "ask", answered: false, answer: "Yes, bookings can be added." }, converse: "Yes — I can add bookings whenever you like. Your question about the band is still waiting." }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Wait — can the site take bookings too?", ask: { id: q.id, chosen: false } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "ask");
    assert.deepEqual(r.body.ask, { answered: false, waiting: true }, "the page is not told the question still waits");
    assert.equal(question(store, slug).status, "pending", "a side question closed the waiting question");
    assert.equal(question(store, slug).id, q.id);
    assert.match(textOf(seen.converse[0]), /A QUESTION OF OURS IS WAITING FOR THEIR ANSWER, and stays open: Which page should the band move on/);
    assert.equal(workStarted(seen), 0);
  });
});

test("A SIDE QUESTION SENT AS A NEW MESSAGE leaves the waiting question waiting; work sent the same way still replaces it", async () => {
  const worker = await loadWorker();
  {
    const slug = freshSlug("side-new");
    const store = bucket(slug);
    const q = seedQuestion(store, slug);
    await withWire({ route: { intent: "ask", answer: "About a minute." }, converse: "Usually about a minute." }, async () => {
      const r = await routeCall(worker, envFor(store), { slug, message: "How long does a change usually take?" });
      assert.equal(r.body.intent, "ask");
      assert.equal(question(store, slug).status, "pending", "a question was closed by talk");
      assert.equal(question(store, slug).id, q.id);
    });
  }
  {
    const slug = freshSlug("work-new");
    const store = bucket(slug);
    seedQuestion(store, slug);
    await withWire({ route: { intent: "edit", layer: "look" } }, async () => {
      const r = await routeCall(worker, envFor(store), { slug, message: "Make the footer blue" });
      assert.equal(r.body.intent, "edit");
      assert.equal(question(store, slug).status, "superseded", "work no longer replaces the waiting question");
    });
  }
});

test("TALK BECOMES AN EXPLICIT ACTION: the request written out from the conversation is what runs", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("do-that");
  const store = bucket(slug);
  const written = "Add a page for booking bread-making classes, with the class times, how many fit and the price";
  await withWire({ route: { intent: "addon", resolved: written } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "ok, do that", extra: { history: HISTORY } });
    assert.equal(r.body.intent, "addon");
    assert.equal(r.body.resolved, written, "the written-out request does not reach the page");
    assert.ok(r.body.decision.reasons.includes("resolved"));
    assert.equal(seen.converse.length, 0, "work was given a conversational reply");
  });
  // WITHOUT A CONVERSATION SHOWN, A WRITTEN-OUT REQUEST IS NOT TAKEN.
  await withWire({ route: { intent: "addon", resolved: written } }, async () => {
    const r = await routeCall(worker, envFor(store), { slug, message: "ok, do that" });
    assert.equal(r.body.resolved, undefined, "a request was written out of a conversation nobody showed");
    assert.ok(r.body.decision.reasons.includes("resolved-ignored"));
  });
});

test("TALK ABOUT AN ATTACHED FILE stays talk, and the file is named as unseen", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("attach-talk");
  const store = bucket(slug);
  await withWire({ route: { intent: "ask", answer: "It could go in the header." }, converse: "A logo like that usually sits top left in the header. Want me to put it there?" }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "What do you think — where would this logo go?", attached: true, extra: { files: [{ name: "logo.png", kind: "image" }] } });
    assert.equal(r.body.intent, "ask", "a file made talk into work");
    const text = textOf(seen.converse[0]);
    assert.match(text, /FILES THEY ATTACHED TO THIS MESSAGE — you were not shown their contents/);
    assert.match(text, /"logo\.png" \(image\)/);
    assert.equal(workStarted(seen), 0);
  });
});

test("MISSING INFORMATION: a site whose pages cannot be read is described as not known, never as empty", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("blind");
  const store = bucket(slug);
  store.store.delete("source/" + slug + "/pages.json");
  await withWire({ route: { intent: "ask", answer: "I can't see that." }, converse: "I can't see your pages' words right now." }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "What does my home page say?" });
    assert.equal(r.body.intent, "ask");
    const text = textOf(seen.converse[0]);
    assert.match(text, /Their words could not be read for this answer/);
    assert.doesNotMatch(text, /Page \/:/);
  });
});

test("A FIRST BUILD'S CONVERSATION is told there is no site yet, and what was described", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("first");
  const store = bucket(slug);
  await withWire({ route: { intent: "ask", answer: "Yes." }, converse: "Yes — once it's built, people can book classes on it." }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Could it take bookings?", firstBuild: true, hasSite: false, extra: { brief: "A bakery in Bristol that runs bread classes" } });
    assert.equal(r.body.intent, "ask");
    assert.match(textOf(seen.converse[0]), /No site has been built for this project yet\.\n\nWhat they first described: A bakery in Bristol that runs bread classes/);
  });
});

test("A REPLY THAT CANNOT BE WRITTEN falls back to the router's gist, said, and only the routing is charged", async () => {
  const worker = await loadWorker();
  const slug = freshSlug("no-reply");
  const store = bucket(slug);
  await withWire({ route: { intent: "ask", answer: "A booking page suits classes." } }, async (seen) => {
    const r = await routeCall(worker, envFor(store), { slug, message: "Which would suit me better?" });
    assert.equal(r.body.answer, "A booking page suits classes.");
    assert.equal(r.body.replyFrom, "router");
    assert.equal(seen.converse.length, 1, "the reply was not attempted");
    assert.equal(seen.debits.length, 1);
  });
  // THE SAME MESSAGE WITH A REPLY COSTS MORE THAN WITHOUT: the reply's call is billed, once.
  let withReply = 0;
  let without = 0;
  await withWire({ route: { intent: "ask", answer: "A booking page." }, converse: DETAILED }, async (seen) => {
    await routeCall(worker, envFor(store), { slug, message: "Which would suit me better?" });
    withReply = seen.debits[0];
  });
  await withWire({ route: { intent: "ask", answer: "A booking page." } }, async (seen) => {
    await routeCall(worker, envFor(store), { slug, message: "Which would suit me better?" });
    without = seen.debits[0];
  });
  assert.ok(withReply > without, "the reply's call was not charged: " + withReply + " vs " + without);
});

test("THE SITE'S CONTEXT IS READ FOR ITS OWNER ONLY, AND NEVER READS A ROW", async () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = W.indexOf("async function readConverseContext(");
  const end = W.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at, "the conversation's site reader is gone");
  const body = W.slice(at, end).replace(/^\s*\/\/.*$/gm, "");
  assert.match(body, /siteOwnerBySlug\(slug, env\)\.then\(\(o\) => o === uid\)/, "the reader does not verify the owner first");
  assert.match(body, /if \(owned !== true\) return \{ \.\.\.base, pages: null, tables: null, files: null \}/, "a caller who is not the owner is still read for");
  assert.doesNotMatch(body, /readEditRows|sqlQuery|SELECT|select \*/i, "the reader reads rows");
  assert.match(body, /!f\.visitor/, "a visitor's upload is described to the model");
  // AND A CALLER WHO IS NOT THE OWNER IS SHOWN NOTHING OF THE SITE.
  const worker = await loadWorker();
  const slug = freshSlug("not-mine");
  const store = bucket(slug);
  await withWire({ route: { intent: "ask", answer: "Hm." }, converse: "I can't see that site." }, async (seen) => {
    await routeCall(worker, envFor(store), { slug, message: "What does my home page say?" });
    const text = textOf(seen.converse[0]);
    assert.doesNotMatch(text, /Bread from the harbour/, "another owner's pages were shown");
    assert.match(text, /could not be read for this answer/);
  }, { owner: "someone-else" });
});
