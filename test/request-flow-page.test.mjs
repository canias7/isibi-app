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
import { page, settle as drain } from "./fixtures/browser-page.mjs";
import { platform, pump, tick, T, USER } from "./fixtures/request-flow.mjs";
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
    // THE FULL REWRITE IS NOT RUN HERE: what the page asked for is the evidence.
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

test("PAGE 4 — Stop the rest: the server stops what has not run, the card says so and offers Stop no more, and nothing more starts", async () => {
  await withPage({ slug: slugOf("p4"), answers: { route: [{ intent: "edit", layer: "look", alsoAsked: [ADD] }, { intent: "addon" }], ...DESCRIBE, ...GALLERY } }, async (P) => {
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
  });
});

test("PAGE 5 — a part that only the full rewrite can make shows a button for it; nothing starts until it is pressed, and then the rewrite is asked for with that part's words", async () => {
  const many = Array.from({ length: 610 }, (_, i) => "<p>Line " + (i + 1) + " of our story.</p>").join("");
  const BIG = [{ path: "index.tsx", source: pageSrc("/", "<section>" + many + "</section>") }, { path: "visit.tsx", source: VISIT }];
  await withPage({ slug: slugOf("p5"), pages: BIG, answers: { route: [{ intent: "edit", layer: "text", alsoAsked: [ADD] }, { intent: "addon" }], ...GALLERY } }, async (P) => {
    const seen = [];
    const p = openPage(P, wire(P, seen));
    p.ctx.siteSend("Reword every line to sound warmer, and " + ADD + ".");
    await idle();
    await pump(P);
    p.flush();
    await idle();
    const html = p.ctx.siteRequestHTML(card(p, KEY), p.s);
    assert.match(html, /Needs a full rewrite/);
    assert.ok(html.includes('data-req-rewrite="' + KEY + '" data-req-part="0"'), html);
    assert.deepEqual(posts(seen, /react-revise/), [], "the rewrite started without its button");
    // ITS BUTTON: the click handler reads the request and the part off it.
    p.thread.onclick({ target: { closest: (sel) => (sel === "[data-req-rewrite]" ? { getAttribute: (a) => (a === "data-req-rewrite" ? KEY : "0") } : null) } });
    await idle();
    const asked = posts(seen, /react-revise/);
    assert.equal(asked.length, 1, "the rewrite was not asked for once");
    assert.equal(asked[0].body.instruction, P.record(KEY).parts[0].words);
    assert.equal(asked[0].body.slug, P.slug);
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
