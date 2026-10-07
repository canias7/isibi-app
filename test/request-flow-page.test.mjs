// ONE MESSAGE, SEVERAL PARTS — WHAT THE PAGE SHOWS (2026-10-03).
//
// The page's own functions, cut out of public/chat.js and run in a VM
// (`test/fixtures/browser-page.mjs`), with every request they make answered by
// the REAL Worker on the stateful platform (`test/fixtures/request-flow.mjs`):
// the routing call, the request's own route, the job poll that hands back each
// part's stored answer, the question and cancel routes. So what is asserted is
// what a customer's page would really draw from what the server really did —
// each part's reply read by the page's own readers, the request's card, the
// question card, Stop — and that the page itself never starts a step.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY, as everywhere in this flow's tests: every model
// answer is supplied. The pixels are checked separately, in a real Chromium,
// and shown as screenshots.
import test from "node:test";
import assert from "node:assert/strict";
import { page, settle as drain, copy } from "./fixtures/browser-page.mjs";
import { platform, pump, pumpBeside, tick, T, USER } from "./fixtures/request-flow.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { VISIT } from "./fixtures/live-ask.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

const DESC = "Change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const ADD = "add a gallery page";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };
const DESCRIBE = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC };
const Q = { text: "Which photos should the gallery show?", options: ["Loaves", "The bakery"] };
const slugOf = (k) => "rqp-" + k + "-" + Math.random().toString(16).slice(2, 8);
const siteFor = (slug) => ({ id: "origin-1", slug, react: true, name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app/", pages: [{ path: "/" }, { path: "/visit" }], msgs: [] });

/** The page's network, answered by the real Worker: `{ status, body, headers }`. */
function wire(P, seen = []) {
  return (url, method, body) => (async () => {
    seen.push({ url, method, body });
    // THE PAGE NEVER RUNS THE REWRITE ITSELF: a post here would be the evidence.
    if (url === "/api/site/react-revise") return new Promise(() => {});
    const worker = await loadWorker();
    return P.run(async () => {
      const ctx = makeCtx();
      const res = await worker.fetch(new Request("https://gofarther.dev" + url, {
        method, headers: { "content-type": "application/json", Authorization: "Bearer token" }, body: body === undefined ? undefined : JSON.stringify(body),
      }), P.env, ctx);
      await Promise.allSettled(ctx.pending);
      const headers = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { status: res.status, body: await res.text(), headers };
    });
  })();
}
/** One page load on the site, its model the one the platform stands in for. */
// THE KEYS THE PAGE MINTS, one per message, valid as the server reads one:
// the first message's is `KEY`.
const KEY = "pagekey0000000000001";
function openPage(P, answer) {
  const p = page({ site: siteFor(P.slug), answer, timers: true });
  p.ctx.buildPicker = "sonnet";
  let n = 0;
  p.ctx.EditPoll.newIdemKey = () => "pagekey" + String(++n).padStart(13, "0");
  return p;
}
async function withPage(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
/** Let the page and the server finish what they are doing. */
const idle = async () => { await drain(); await drain(); };
const texts = (p) => p.said().filter((m) => m.r === "a" && typeof m.t === "string" && m.t).map((m) => m.t);
const card = (p, key) => p.s.msgs.find((m) => m && m.request === key);
const posts = (seen, re) => seen.filter((c) => c.method === "POST" && re.test(c.url));

test("PAGE 1 — the server takes the message on and the page only follows: each part's own reply appears when its job ends, the card says Done for each, and the page never posts a step itself", async () => {
  await withPage({ slug: slugOf("p1"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const seen = [];
    const p = openPage(P, wire(P, seen));
    p.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    // THE ROUTING CALL CARRIED THE MESSAGE'S KEY, AND WAS ACCEPTED.
    const routed = seen.find((c) => c.url === "/api/site/route");
    assert.equal(routed.body.idem, KEY);
    assert.equal(typeof routed.body.tz, "string");
    const key = P.record(KEY) ? KEY : null;
    assert.equal(key, KEY, "the server did not take the message on under its key");
    assert.equal(p.busy(), false, "the page stayed busy while the server works");
    assert.ok(card(p, key), "no card for the request");
    assert.match(p.ctx.siteRequestHTML(card(p, key), p.s), /Stop the rest/);
    // THE TAB COULD CLOSE NOW: the jobs run without it.
    await pump(P);
    assert.equal(P.record(key).state, "done");
    // THE PAGE LOOKS AGAIN, and shows each part's reply from its job.
    p.flush();
    await idle();
    const said = texts(p);
    assert.ok(said.some((t) => /description|look/i.test(t)), "part 0's reply is not on the thread: " + JSON.stringify(said));
    assert.ok(said.some((t) => /gallery/i.test(t)), "part 1's reply is not on the thread: " + JSON.stringify(said));
    // AND NOBODY IS TOLD TO SEND AGAIN WHAT THE SERVER IS ABOUT TO DO: part 0's
    // reply does not ask for the gallery to be sent next.
    assert.ok(!said.some((t) => /do that next|send it next|Say “add a gallery page”/i.test(t)), "a part's reply asked for another part to be sent again: " + JSON.stringify(said));
    const html = p.ctx.siteRequestHTML(card(p, key), p.s);
    assert.equal((html.match(/>Done</g) || []).length, 2, html);
    assert.doesNotMatch(html, /Stop the rest/, "Stop is offered on a request that has ended");
    // THE PAGE STARTED NOTHING: no edit or addition was posted from it.
    assert.deepEqual(posts(seen, /\/(edit|addon)$/), []);
    // AND IT SHOWS EACH REPLY ONCE, however often it looks.
    const n = p.said().length;
    p.ctx.siteRequestFollow("origin-1", key);
    await idle();
    assert.equal(p.said().length, n, "a reply was shown twice");
  });
});

test("PAGE 2 — a page opened later on another device picks the request up from the server and shows what happened, once", async () => {
  await withPage({ slug: slugOf("p2"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const a = openPage(P, wire(P));
    a.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    // THIS TAB IS GONE. The server finishes.
    await pump(P);
    // ANOTHER DEVICE: a record of the site with nothing of this request on it.
    const seen = [];
    const b = openPage(P, wire(P, seen));
    b.ctx.siteRequestsCheck(b.s);
    await idle();
    assert.ok(seen.some((c) => c.url === "/api/site/requests/" + P.slug), "the opened page did not ask for its requests");
    const key = KEY;
    assert.ok(card(b, key), "the other device has no card for the request");
    const said = texts(b);
    assert.ok(said.some((t) => /gallery/i.test(t)), "the other device was not shown what happened: " + JSON.stringify(said));
    // ONCE: looking again on the same page shows nothing new.
    const n = b.said().length;
    b.ctx.siteRequestFollow(b.s.id, key);
    await idle();
    assert.equal(b.said().length, n);
  });
});

test("PAGE 3 — a part's question comes up on the page's question card and is answered there; the answer resumes the part on the server and its reply follows", async () => {
  await withPage({
    slug: slugOf("p3"),
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "clarify", question: Q }, { intent: "addon", answered: true }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const seen = [];
    const p = openPage(P, wire(P, seen));
    p.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    await pump(P);
    p.flush();
    await idle();
    // THE CARD: the question, its answers, Cancel — and it knows whose part it is.
    const asked = p.ask();
    assert.ok(asked, "no question card");
    assert.equal(asked.text, Q.text);
    assert.deepEqual(asked.request, { key: KEY, part: 1 });
    assert.match(p.ctx.siteRequestHTML(card(p, KEY), p.s), /Waiting for your answer/);
    // ANSWERED BY ITS BUTTON.
    p.click("data-ask-ans", "Loaves");
    await idle();
    const answer = seen.filter((c) => c.url === "/api/site/route")[1];
    assert.deepEqual(answer.body.ask, { id: asked.id, chosen: true });
    assert.equal(p.ask(), null, "the card stayed after its answer");
    await pump(P);
    p.flush();
    await idle();
    assert.equal(P.record(KEY).state, "done");
    assert.ok(texts(p).some((t) => /gallery/i.test(t)), JSON.stringify(texts(p)));
    assert.deepEqual(posts(seen, /\/(edit|addon)$/), []);
  });
});

test("PAGE 4 — Stop the rest: the server stops what has not run, the card says so and offers Stop no more, nothing more starts, and the request's own reply is shown once", async () => {
  await withPage({ slug: slugOf("p4"), replies: true, answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const seen = [];
    const p = openPage(P, wire(P, seen));
    p.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    p.click("data-req-stop", KEY);
    await idle();
    assert.ok(seen.some((c) => c.method === "DELETE" && c.url === "/api/site/request/" + P.slug + "/" + KEY), "Stop did not reach the server");
    await pump(P);
    await tick(P);
    p.flush();
    await idle();
    const rec = P.record(KEY);
    assert.deepEqual(rec.parts.map((x) => x.status), ["cancelled", "cancelled"]);
    const html = p.ctx.siteRequestHTML(card(p, KEY), p.s);
    assert.equal((html.match(/>Stopped</g) || []).length, 2, html);
    assert.doesNotMatch(html, /Stop the rest/);
    // THE REQUEST'S OWN REPLY (the server's, model-written from its facts), on
    // the thread once — however many times the page reads the request again.
    p.flush();
    await idle();
    const own = texts(p).filter((t) => /Stopped at their request before it changed anything: “add a gallery page”/.test(t));
    assert.equal(own.length, 1, JSON.stringify(texts(p)));
  });
});

test("PAGE 5 — a part only the full rewrite can make shows its go-ahead; nothing starts until it is pressed; the press is recorded on the server, which runs the rewrite and finishes the request — a reload or another device sees the go-ahead given, and a second press starts nothing more", async () => {
  const many = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
  const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + many + "</section>") }, { path: "visit.tsx", source: VISIT }];
  const slug = slugOf("p5");
  const WARM = pageSrc("/", "<section><p>A warmer story, line by line.</p></section>");
  await withPage({
    slug, pages: BIG, replies: true,
    answers: {
      route: [{ intent: "edit", layer: "text", alsoAsked: [ADD] }, { intent: "addon" }], ...GALLERY,
      // THE EXISTING REWRITE'S OWN TWO CALLS: its designer, then its page writer.
      design_schema: { brand: "Harbour Loaf", slug, description: "a bakery", kind: "shopfront", purpose: "visit", pages: [{ path: "/", name: "Home" }, { path: "/visit", name: "Visit" }], components: [], css: "" },
      [T.pages]: (args, n) => (n === 0 ? { pages: [writtenPage("/gallery")] } : { pages: [{ path: "src/routes/index.tsx", source: WARM }], notes: "Rewrote the home page." }),
    },
  }, async (P) => {
    // THE QUEUED BUILD'S OWN BINDINGS (its database check and its compile container).
    P.env.NEON_API_KEY = "neon-test";
    P.env.SITE_BUILD_CONTAINER = {};
    const builds = () => [...P.jobs.values()].filter((j) => j.op === "build");
    const press = (pg) => pg.thread.onclick({ target: { closest: (sel) => (sel === "[data-req-approve]" ? { getAttribute: (a) => (a === "data-req-approve" ? KEY : "0") } : null) } });
    const seen = [];
    const p = openPage(P, wire(P, seen));
    p.ctx.siteSend("Reword every line to sound warmer, and " + ADD + ".");
    await idle();
    await pump(P);
    p.flush();
    await idle();
    let html = p.ctx.siteRequestHTML(card(p, KEY), p.s);
    assert.match(html, /Needs your go-ahead/);
    assert.ok(html.includes('data-req-approve="' + KEY + '" data-req-part="0"'), html);
    assert.deepEqual(posts(seen, /\/approve$|react-revise/), [], "something was asked for before the button was pressed");
    assert.deepEqual(builds(), [], "the rewrite started without its go-ahead");
    // ITS OWN REPLY WHILE IT WAITS, ONCE — and once still after another look.
    const waitingSaid = texts(p).filter((t) => /Waiting for their go-ahead/.test(t));
    assert.equal(waitingSaid.length, 1, JSON.stringify(texts(p)));
    p.flush();
    await idle();
    assert.equal(texts(p).filter((t) => /Waiting for their go-ahead/.test(t)).length, 1, "the go-ahead's reply was shown again on the next look");
    // ANOTHER DEVICE, BEFORE THE GO-AHEAD: the same button, from the server.
    const b = openPage(P, wire(P));
    b.ctx.siteRequestsCheck(b.s);
    await idle();
    assert.ok(b.ctx.siteRequestHTML(card(b, KEY), b.s).includes('data-req-approve="' + KEY + '"'));
    // THE PRESS: one POST to the request's go-ahead, with the part; never the rewrite route.
    press(p);
    await idle();
    const pressed = posts(seen, /\/approve$/);
    assert.equal(pressed.length, 1);
    assert.equal(pressed[0].url, "/api/site/request/" + P.slug + "/" + KEY + "/approve");
    assert.deepEqual(pressed[0].body, { part: 0 });
    assert.deepEqual(posts(seen, /react-revise/), [], "the page ran the rewrite itself");
    assert.equal(builds().length, 1);
    html = p.ctx.siteRequestHTML(card(p, KEY), p.s);
    assert.match(html, /Full rewrite queued/);
    assert.doesNotMatch(html, /data-req-approve/);
    // THE OTHER DEVICE PRESSES ITS OLD BUTTON: the same rewrite, nothing more.
    press(b);
    await idle();
    assert.equal(builds().length, 1, "a second press filed a second rewrite");
    assert.match(b.ctx.siteRequestHTML(card(b, KEY), b.s), /Full rewrite queued/);
    // A RELOAD OF THE FIRST PAGE: its stored record, opened again, reads it given.
    const c = page({ site: p.s, answer: wire(P), timers: true });
    c.ctx.siteRequestsCheck(c.s);
    await idle();
    html = c.ctx.siteRequestHTML(card(c, KEY), c.s);
    assert.match(html, /Full rewrite queued/);
    assert.doesNotMatch(html, /data-req-approve/);
    // THE SERVER RUNS IT WITH EVERY PAGE CLOSED, through the existing queued build.
    await pump(P);
    const rec = P.record(KEY);
    assert.deepEqual(rec.parts.map((x) => x.status), ["done", "done"], JSON.stringify(rec.parts.map((x) => [x.status, x.why])));
    assert.equal(rec.ended, true);
    assert.equal(P.page("index.tsx"), WARM, "the rewrite did not publish the rewritten page");
    // THE PAGE FOLLOWS: Done for both, the request's end reply once, the go-ahead's not again.
    p.flush();
    await idle();
    html = p.ctx.siteRequestHTML(card(p, KEY), p.s);
    assert.equal((html.match(/>Done</g) || []).length, 2, html);
    assert.equal(texts(p).filter((t) => /Waiting for their go-ahead/.test(t)).length, 1, "the go-ahead's reply was shown twice");
    assert.equal(texts(p).filter((t) => /by the full rewrite of every page, on their go-ahead/.test(t)).length, 1, JSON.stringify(texts(p)));
  });
});

test("PAGE 6 — a routing answer lost on the way back: the message comes back to the box with its key, and sending it again follows the same request instead of making a second", async () => {
  await withPage({ slug: slugOf("p6"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
    const seen = [];
    let lose = true;
    const real = wire(P, seen);
    const answer = (url, method, body) => {
      if (url === "/api/site/route" && lose) { lose = false; return real(url, method, body).then(() => ({ reject: new Error("connection reset") })); }
      return real(url, method, body);
    };
    const p = openPage(P, answer);
    const MSG = DESC + ", and " + ADD + ".";
    p.ctx.siteSend(MSG);
    await idle();
    // THE SERVER TOOK IT ON; THE PAGE NEVER HEARD.
    assert.ok(P.record(KEY), "the server did not take the message on");
    assert.deepEqual(JSON.parse(JSON.stringify(p.s.unsent)), [{ t: MSG, imgs: [] }]);
    // BACK IN THE BOX WITH ITS KEY, AND SENT AGAIN — the page mints no new key for the same words.
    p.ctx.EditPoll.newIdemKey = () => "pagekey0000000000002";
    p.ctx.siteUnsentBack(p.s);
    p.ctx.siteSend(MSG);
    await idle();
    const routes = seen.filter((c) => c.url === "/api/site/route");
    assert.equal(routes.length, 2);
    assert.equal(routes[1].body.idem, KEY, "the same message went out under a new key");
    assert.equal(P.record("pagekey0000000000002"), null, "a second request was made");
    assert.ok(card(p, KEY));
    assert.deepEqual(P.ledger.filter((e) => e.reason === "route").map((e) => e.delta), [-1]);
  });
});

test("PAGE 7 — a part's reply still being written in the background: the part's outcome is applied at once (the preview moves) and its place held by “Done — writing up what changed…”, the part after it is shown under it straight away, and no look calls the model; once the queue has written it, the held line becomes the reply where it stands — once, in order — and a page opened afterwards on another device shows the same", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  const part0 = (facts) => facts.some((f) => f.text.startsWith("Changed the description"));
  await withPage({
    slug: slugOf("p7"), replies: true, replyWith: async ({ facts }) => { if (part0(facts)) await gate; },
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const p = openPage(P, wire(P));
    p.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    const job0 = P.jobsOf(KEY)[0].id;
    // THE SERVER RUNS BOTH PARTS; PART 0'S REPLY IS STILL BEING WRITTEN BESIDE THEM.
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && m.body.id === job0);
    assert.equal(running.length, 1, "part 0's reply was not asked for");
    assert.equal(P.record(KEY).state, "done");
    const writes = () => P.modelLog.filter((m) => m.tool === "write_reply").length;
    const calls = writes();
    // THE PAGE LOOKS, TWICE: part 0 applied and its place held; part 1's reply under it.
    for (let i = 0; i < 2; i++) { p.flush(); await idle(); }
    const during = texts(p);
    const at0 = during.indexOf("Done — writing up what changed…");
    const at1 = during.findIndex((t) => /Added \/gallery/.test(t));
    assert.ok(at0 >= 0 && at1 > at0, "part 0's place is not held above part 1's reply: " + JSON.stringify(during));
    assert.ok(!during.some((t) => /Changed the description/.test(t)), "part 0's reply was shown before it was written");
    // ONE MOVE FOR BOTH PARTS (2026-10-07, `sitePreviewHold`): both were found
    // done by one reading, so the preview moved once for them — and not after
    // part 0's reply, which is still being written.
    assert.equal(p.s.previewV, 1, "a part's outcome waited for its reply, or the parts moved the preview once each");
    assert.equal(p.s.msgs.find((m) => m && m.held).held.job, job0);
    assert.equal(writes(), calls, "a look of the page called the model");
    // WRITTEN: the next look settles the held line where it stands.
    release();
    await Promise.all(running);
    const n0 = p.said().length;
    p.flush(); await idle();
    const said = texts(p);
    const w0 = said.findIndex((t) => /Changed the description/.test(t));
    const w1 = said.findIndex((t) => /Added \/gallery/.test(t));
    assert.ok(w0 >= 0 && w1 > w0, "the replies are not both shown, in order: " + JSON.stringify(said));
    assert.equal(w0, at0, "the reply did not land in its part's place");
    assert.ok(!said.includes("Done — writing up what changed…"), "the held line is still there");
    assert.equal(p.said().length, n0, "a message was added instead of the held one settled");
    assert.equal(p.s.previewV, 1, "a part's outcome was applied again");
    // ONCE: looking again — the request, the held replies — shows nothing new.
    const n = p.said().length;
    p.ctx.siteRequestFollow("origin-1", KEY);
    p.ctx.siteHeldRepliesCheck(p.s);
    for (let i = 0; i < 2; i++) { p.flush(); await idle(); }
    assert.equal(p.said().length, n, "a reply was shown twice");
    assert.equal(p.s.previewV, 1);
    // ANOTHER DEVICE, OPENED AFTERWARDS: the same replies, from the server's record — and no model call.
    const b = openPage(P, wire(P));
    b.ctx.siteRequestsCheck(b.s);
    await idle();
    const there = texts(b);
    assert.deepEqual([there.some((t) => /Changed the description/.test(t)), there.some((t) => /Added \/gallery/.test(t))], [true, true], JSON.stringify(there));
    assert.equal(writes(), calls, "a page's look called the model");
  });
});

test("PAGE 9 — a reload while a part's reply is still being written: the reopened page applies no part again and shows nothing twice, follows the held reply from its message, and settles it once", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  const part0 = (facts) => facts.some((f) => f.text.startsWith("Changed the description"));
  await withPage({
    slug: slugOf("p9"), replies: true, replyWith: async ({ facts }) => { if (part0(facts)) await gate; },
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY },
  }, async (P) => {
    const p = openPage(P, wire(P));
    p.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    const job0 = P.jobsOf(KEY)[0].id;
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && m.body.id === job0);
    for (let i = 0; i < 2; i++) { p.flush(); await idle(); }
    // ONE MOVE FOR THE PARTS ONE READING FOUND DONE (2026-10-07).
    assert.equal(p.s.previewV, 1);
    const before = texts(p);
    assert.ok(before.includes("Done — writing up what changed…"), JSON.stringify(before));
    // RELOADED: the site as `sitesSave` kept it, and what a render resumes.
    const seen = [];
    const b = page({ site: copy(p.s), answer: wire(P, seen), timers: true });
    b.ctx.buildPicker = "sonnet";
    b.ctx.siteRequestsCheck(b.s);
    b.ctx.siteHeldRepliesCheck(b.s);
    for (let i = 0; i < 2; i++) { b.flush(); await idle(); }
    assert.deepEqual(texts(b), before, "the reopened page showed something again, or lost the held line");
    assert.equal(b.s.previewV, 1, "the reopened page applied a part again");
    assert.ok(seen.some((c) => c.url === "/api/site/edit/" + job0), "the reopened page does not follow the held reply");
    // WRITTEN: settled where it stands, once.
    release();
    await Promise.all(running);
    b.flush(); await idle();
    const after = texts(b);
    assert.equal(after.length, before.length, "a message was added instead of the held one settled");
    assert.match(after[before.indexOf("Done — writing up what changed…")], /Changed the description/);
    assert.equal(b.s.previewV, 1);
    b.ctx.siteHeldRepliesCheck(b.s);
    b.ctx.siteRequestsCheck(b.s);
    for (let i = 0; i < 2; i++) { b.flush(); await idle(); }
    assert.deepEqual(texts(b), after, "a reply was shown twice");
  });
});

test("PAGE 10 — a part that did not go through, its explanation still being written: its place is held by a line that says so — never Done — while the rest is shown, and the written explanation then takes that place", async () => {
  let release;
  const gate = new Promise((ok) => { release = ok; });
  const ofFailedAdd = (facts) => facts.some((f) => /^Nothing was added|^The addition did not go through/.test(f.text));
  await withPage({
    slug: slugOf("p10"), replies: true, replyWith: async ({ facts }) => { if (ofFailedAdd(facts)) await gate; },
    // THE ADDITION FAILS: its designer makes nothing.
    answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, [T.adds]: { kinds: [] } },
  }, async (P) => {
    const p = openPage(P, wire(P));
    p.ctx.siteSend(DESC + ", and " + ADD + ".");
    await idle();
    const add = () => P.jobsOf(KEY).find((j) => j.op === "addon");
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && add() && m.body.id === add().id);
    assert.equal(running.length, 1, "the failed addition's reply was not asked for");
    for (let i = 0; i < 2; i++) { p.flush(); await idle(); }
    const during = texts(p);
    assert.ok(during.some((t) => /Changed the description/.test(t)), "the part that went through is not shown: " + JSON.stringify(during));
    assert.ok(during.includes("That didn’t go through — writing up why…"), "the failed part's place is not held as not done: " + JSON.stringify(during));
    assert.ok(!during.some((t) => /Done — writing up/.test(t)), "a part that did not go through said Done: " + JSON.stringify(during));
    assert.equal(p.s.previewV, 1, "the failed addition moved the preview");
    release();
    await Promise.all(running);
    p.flush(); await idle();
    const said = texts(p);
    assert.ok(!said.includes("That didn’t go through — writing up why…"), "the held line is still there");
    assert.equal(said.length, during.length, "a message was added instead of the held one settled");
  });
});

test("PAGE 8 — the request's own reply still being written when the page finds the request ended: the page keeps looking instead of closing it, and shows that reply once the queue has written it — once", async () => {
  const LINK = "put a link to the new gallery on the Visit page";
  let release;
  const gate = new Promise((ok) => { release = ok; });
  // THE REQUEST'S OWN FACTS: the part that never started says so.
  const ofRequest = (facts) => facts.some((f) => /^Not started: /.test(f.text));
  await withPage({
    slug: slugOf("p8"), replies: true, replyWith: async ({ facts }) => { if (ofRequest(facts)) await gate; },
    answers: {
      route: [{ intent: "edit", layer: "look", alsoAsked: [LINK, ADD], dependsOn: [{ change: 1, after: [2] }] }, { intent: "addon" }],
      // THE ADDITION FAILS, so the part that needed it never starts, and the request's own reply says so.
      ...DESCRIBE, [T.adds]: { kinds: [] },
    },
  }, async (P) => {
    const p = openPage(P, wire(P));
    p.ctx.siteSend(DESC + ", " + LINK + ", and " + ADD + ".");
    await idle();
    const running = await pumpBeside(P, (m) => m.body && m.body.kind === "edit-reply" && !m.body.id);
    assert.equal(running.length, 1, "the request's own reply was not asked for");
    assert.equal(P.record(KEY).ended, true);
    // THE PAGE LOOKS, TWICE: the parts' own replies are there; the request's is still being written.
    for (let i = 0; i < 2; i++) { p.flush(); await idle(); }
    const during = texts(p);
    assert.ok(during.some((t) => /Changed the description/.test(t)), "a part's own reply is missing: " + JSON.stringify(during));
    assert.ok(!during.some((t) => /Not started: /.test(t)), "the request's reply was shown before it was written");
    // WRITTEN: the next look shows it, once.
    release();
    await Promise.all(running);
    p.flush(); await idle();
    const said = texts(p);
    assert.equal(said.filter((t) => /Not started: “put a link to the new gallery on the Visit page”/.test(t)).length, 1, JSON.stringify(said));
    const n = p.said().length;
    p.ctx.siteRequestFollow("origin-1", KEY);
    await idle();
    assert.equal(p.said().length, n, "the request's reply was shown twice");
  });
});
