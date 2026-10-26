// ── ROUTER B1 (2026-10-25): NO QUESTIONS ON A PART, A SITE INVENTORY, ONE
//    RULE OF EACH, A PER-SITE CACHE PIN ─────────────────────────────────────
//
// The router audit's plan steps 2–4 and its cache step
// (`docs/audits/2026-10-25-router-audit.md`, `docs/history/2026-10-25-router-b1.md`).
// These guard the properties, not the spelling: each rule is said once on a
// site that exists, the tie-break is one, a removal has one owner by what
// holds it, a new frame item is the frame step's, the first build is sent
// what it always was, a part is told questions are closed, the inventory
// reaches the request after the stable prefix, and the pin reaches the wire.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASK_TOOL, LIVE_ASK_TOOL, LIVE_SYSTEM, askRequest, routeMessage, layerLine } from "../builder/site-ask.mjs";
import { toXaiRequest } from "../builder/model-xai.mjs";
import { xaiHeaders, anthropicWire } from "../builder/build-call.mjs";

const LIVE = LIVE_ASK_TOOL.input_schema.properties;
const INTENT = LIVE.intent.description;
const LAYER = LIVE.layer.description;
const ALSO = LIVE.alsoAsked.description;
const REMOVE = LIVE.remove.description;
const RULES = [INTENT, LAYER, ALSO, LIVE.page.description, REMOVE].join("\n");
const count = (s, re) => (s.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;
const SITE = { name: "Driftwood", url: "https://driftwood.gofarther.app", pages: ["/", "/lessons", "/visit"], tables: ["lessons", "lesson_bookings"] };
const sysOf = (req) => req.system.map((b) => b.text).join("");

test("one edit/addon test, one tie-break, one several-changes rule — each said once in everything a live site is sent", () => {
  // THE OBSERVERS ARE ALIVE: each rule is found exactly once.
  assert.equal(count(RULES, /ASKED OF THE THING ITSELF AND NEVER OF WHAT IT GOES INTO/), 1, "the edit/addon test is not said exactly once");
  assert.equal(count(RULES, /WHEN LOOKING STILL CANNOT SETTLE IT/), 1, "the tie-break is not said exactly once");
  assert.equal(count(RULES, /ONE ANSWER FOR THE WHOLE MESSAGE/), 1, "the several-changes rule is not said exactly once");
  // THE OLD COPIES ARE GONE from the live tool and the live system.
  const wire = JSON.stringify(LIVE_ASK_TOOL) + LIVE_SYSTEM;
  for (const old of [/THE QUESTION THAT SEPARATES EDIT FROM ADDON/, /WHEN YOU CANNOT TELL, ANSWER "addon"/, /ASK THEM \("clarify"\) where a question may be asked \(said below\); only where/,
    /cheapest one that can honestly do the job/, /COST NEVER MAKES A NEW ENTRY AN EDIT/, /SEVERAL CHANGES IN ONE MESSAGE ARE STILL ONE "look" ANSWER/, /SEVERAL CHANGES ARE ONE TURN WHEN YOUR ANSWER/]) {
    assert.doesNotMatch(wire, old, "a duplicate or contradictory rule still reaches a live site: " + old);
  }
  // THE TIE-BREAK LOOKS FIRST (2026-10-26: the site as the router finds it), then a question, then addon where closed; cost never decides.
  assert.match(INTENT, /ANSWERED FROM THE SITE AS IT IS \(its files and tables; look with the read-only tools when you need to\): is it there now\? Yes — "edit"\. No — "addon"\./);
  assert.match(INTENT, /ask them \("clarify"\) where a question may be asked \(said below\); where questions are closed, answer "addon"\. Cost never decides between edit and addon\./);
  // A FEATURE ON A PAGE THAT EXISTS: an addon with that page, never a new row.
  assert.match(INTENT, /it is "addon" with that page as its target and the form as a new-component — never a new entry in a list/);
  assert.match(ALSO, /the closing rule of `layer` says which answer/);
  assert.match(LAYER.split("\n").pop(), /^ONE ANSWER FOR THE WHOLE MESSAGE/);
});

test("a removal has one owner by what holds it, and an addon never removes", () => {
  assert.match(LAYER, /IT IS ALSO WHERE A REMOVAL IS WORKED OUT for anything taken off a page that stays/);
  assert.match(LAYER, /Three removals have their own owner instead: a whole page \("page" with `remove`\), a row the site stores \("data"\), and an item of the frame or the logo \("nav" or "logo" with `remove`\)\./);
  // PICTURE NO LONGER CLAIMS ONE: its clause sends a removal to look, and the flag names no picture.
  const picture = LAYER.split("\n").find((l) => l.startsWith("\"picture\" — "));
  assert.ok(picture, "the picture clause's landmark moved");
  assert.match(picture, /taking one off is "look"\./);
  assert.doesNotMatch(REMOVE, /layer "picture"/, "the remove flag still gives picture a removal");
  for (const l of ["page", "logo", "nav"]) assert.match(REMOVE, new RegExp("For layer \"" + l + "\": true"), l + " lost its removal");
  assert.match(INTENT, /A REMOVAL IS NEVER AN ADDON/);
  assert.match(INTENT, /NEVER ANSWER "ask" TO CHECK THAT THEY MEANT IT/);
});

test("a new menu link, footer link, contact detail or header button is the frame step's (edit + nav), never addon; new words and photographs stay addon", () => {
  assert.match(INTENT, /"edit" — [^\n]*a new item in the frame every page shares \(a menu link, a footer link, a contact detail, the header button\), which layer "nav" adds on every page/);
  const nav = LAYER.split("\n").find((l) => l.startsWith("\"nav\" — "));
  assert.match(nav, /IT ADDS TO THE FRAME AS WELL AS CHANGING IT: a new menu link, footer link, contact detail or header button is this layer\./);
  assert.match(nav, /a link to a page it lacks is "addon", the page first/);
  assert.doesNotMatch(RULES, /NEW menu link[^.]*intent "addon"|ADDING TO THE FRAME IS NOT AN EDIT|A NEW ITEM IN THE FRAME EVERY PAGE SHARES IS AN ADDITION/, "a frame addition is still sent to addon");
  assert.match(INTENT, /a new line of words or a new photograph on a page, even one that has some/);
  // The lane picker is told the live router's own line for a layer.
  assert.match(layerLine("nav"), /^THE FRAME EVERY PAGE SHARES/);
});

test("the guarded behaviours keep a sentence: the enforcement line, the sort scope, the crop, the header button, the address", () => {
  assert.match(LAYER, /THE LINE IS ENFORCEMENT AGAINST DISPLAY, AND WORDS LIKE BOOKINGS, CAPACITY, PLACES OR LIMIT DO NOT DECIDE IT/);
  assert.match(LAYER, /ACROSS THE WHOLE SITE, when they say so or name no page\. It cannot leave a page out/);
  assert.match(LAYER, /It reaches every word inside a page's sections, a button in a hero included, which "nav" cannot\./);
  assert.match(LAYER, /free, it moves the crop/);
  assert.match(LAYER, /"rename" — THE SITE'S WEB ADDRESS only/);
  assert.match(LAYER, /IT IS ALSO WHERE A PAGE IS DELETED: that page in `page`, `remove` true\./);
});

test("about half the rule text: the live tool's rules are at most 13,000 characters (25,272 before)", () => {
  assert.ok(RULES.length <= 13000, "the live rules grew back: " + RULES.length);
  assert.ok(RULES.length >= 6000, "the live rules lost their substance: " + RULES.length);
});

test("a first build is sent exactly what it was: its own tool and system", () => {
  const req = askRequest({ message: "A bakery in Bristol", site: {}, canClarify: true, brief: "A bakery", hasSite: false });
  assert.equal(req.tools[0], ASK_TOOL);
  assert.match(sysOf(req), /Pick the cheapest one that can honestly do the job/, "the first build's system changed");
  assert.match(ASK_TOOL.input_schema.properties.intent.description, /WHEN YOU CANNOT TELL, ANSWER "addon"/);
  assert.equal(req.cacheKey, undefined, "a first build was pinned");
  // A SITE THAT EXISTS IS SENT THE LIVE SYSTEM, which differs only in its site step.
  const live = askRequest({ message: "x", site: SITE, hasSite: true, live: true });
  assert.equal(sysOf(live), LIVE_SYSTEM);
  assert.match(LIVE_SYSTEM, /decided by the one test in the tool's `intent` field against the site as it is/);
});

const said = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: LIVE_ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
async function sent(opts) {
  let req = null;
  await routeMessage({ send: async (r) => { req = r; return said({ intent: "addon" }); } }, { message: "make it bookable", site: SITE, hasSite: true, ...opts });
  return req;
}

test("a caller with nobody to ask closes questions; a part of a request is offered one (owner, 2026-10-26)", async () => {
  const part = { original: "Change the description, and make Lessons bookable.", done: [], others: [] };
  const p = await sent({ canAsk: true, offerAsk: false, part });
  const content = p.messages[0].content;
  assert.match(content, /QUESTIONS\nQuestions are closed for this message — never answer "clarify"\./);
  assert.doesNotMatch(content, /A QUESTION MAY BE ASKED/);
  const fresh = await sent({ canAsk: true });
  assert.match(fresh.messages[0].content, /A QUESTION MAY BE ASKED/, "the observer is not alive: a new message was not offered a question");
  // ANY STEP MAY ASK (owner, 2026-10-26): a part is offered its question as a new message is.
  const asPart = await sent({ canAsk: true, part });
  assert.match(asPart.messages[0].content, /A QUESTION MAY BE ASKED/);
  // THE ROUTE NO LONGER CLOSES IT for a part's routing job (`rPart`).
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const rRoute = async (rDigest) => await routeMessage(");
  const end = w.indexOf("let routed = await rRoute(rDigest);", at);
  assert.ok(at > 0 && end > at, "the route's landmarks moved");
  const call = w.slice(at, end);
  assert.match(call, /\n\s*canAsk: rLive,\n/);
  assert.doesNotMatch(call, /offerAsk/);
  // THE ROUTER EXPLORES (2026-10-26): at most two looks, on the verified owner's site; a part does not look.
  assert.match(call, /send: exploredSend\(env, rDigest\.owned === true && !rPart \? rDigest\.slug : "", jobSend\(rJob, quickSend\(env\)\), \{ cap: ROUTER_MAX_LOOKS, names: /);
  assert.doesNotMatch(call, /inventory:/);
  assert.match(call, /cacheKey: [^\n]*"route-" \+ rb\.slug/);
});


test("no inventory is handed (the router explores, 2026-10-26), and the per-site pin reaches xAI's header", async () => {
  const req = await sent({ cacheKey: "route-driftwood" });
  // NOTHING PER-SITE IN THE PREFIX: the tools and the system are the same for every site.
  assert.equal(req.tools[0], LIVE_ASK_TOOL);
  assert.equal(sysOf(req), LIVE_SYSTEM);
  assert.ok(!req.messages[0].content.includes("SITE INVENTORY"), "an inventory was handed");
  // THE PIN: ours on the request, `x-grok-conv-id` on the wire, never sent to Anthropic.
  assert.equal(req.cacheKey, "route-driftwood");
  const { body } = toXaiRequest({ ...req, model: "grok-4" });
  assert.equal(xaiHeaders("k", body)["x-grok-conv-id"], "gofarther-route-driftwood");
  assert.ok(!Object.hasOwn(anthropicWire(req), "cacheKey"));
  // A first build, or a key that is not a slug, is not pinned.
  assert.equal((await sent({ cacheKey: "route-a b" })).cacheKey, undefined);
});
