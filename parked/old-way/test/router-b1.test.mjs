// PARKED (2026-11-03, park-old-way): the old-way half of test/router-b1.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { ASK_TOOL, LIVE_ASK_TOOL, LIVE_SYSTEM, askRequest, routeMessage, inventoryBlock, layerLine } from "../builder/site-ask.mjs";
import { routeInventory, pageFacts, INVENTORY_CHARS } from "../../../builder/route-inventory.mjs";
import { toXaiRequest } from "../../../builder/model-xai.mjs";
import { xaiHeaders, anthropicWire } from "../../../builder/build-call.mjs";

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
  assert.equal(count(RULES, /WHEN THE INVENTORY STILL CANNOT SETTLE IT/), 1, "the tie-break is not said exactly once");
  assert.equal(count(RULES, /ONE ANSWER FOR THE WHOLE MESSAGE/), 1, "the several-changes rule is not said exactly once");
  // THE OLD COPIES ARE GONE from the live tool and the live system.
  const wire = JSON.stringify(LIVE_ASK_TOOL) + LIVE_SYSTEM;
  for (const old of [/THE QUESTION THAT SEPARATES EDIT FROM ADDON/, /WHEN YOU CANNOT TELL, ANSWER "addon"/, /ASK THEM \("clarify"\) where a question may be asked \(said below\); only where/,
    /cheapest one that can honestly do the job/, /COST NEVER MAKES A NEW ENTRY AN EDIT/, /SEVERAL CHANGES IN ONE MESSAGE ARE STILL ONE "look" ANSWER/, /SEVERAL CHANGES ARE ONE TURN WHEN YOUR ANSWER/]) {
    assert.doesNotMatch(wire, old, "a duplicate or contradictory rule still reaches a live site: " + old);
  }
  // THE TIE-BREAK USES THE INVENTORY, then a question, then addon where closed; cost never decides.
  assert.match(INTENT, /ANSWERED FROM THE SITE INVENTORY ABOVE: is it there now\? Yes — "edit"\. No — "addon"\./);
  assert.match(INTENT, /ask them \("clarify"\) where a question may be asked \(said below\); where questions are closed, answer "addon"\. Cost never decides between edit and addon\./);
  // A FEATURE ON A PAGE THAT EXISTS: an addon with that page, never a new row.
  assert.match(INTENT, /it is "addon" with that page as its target and the form as a new-component — never a new entry in a list/);
  assert.match(ALSO, /the closing rule of `layer` says which answer/);
  assert.match(LAYER.split("\n").pop(), /^ONE ANSWER FOR THE WHOLE MESSAGE/);
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
  assert.match(LIVE_SYSTEM, /decided by the one test in the tool's `intent` field against the site inventory/);
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
  const w = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const rRoute = async (rDigest) => await routeMessage(");
  const end = w.indexOf("let routed = agentTakes() ? agentRouted({ waiting: rWaiting }) : await rRoute(rDigest);", at);
  assert.ok(at > 0 && end > at, "the route's landmarks moved");
  const call = w.slice(at, end);
  assert.match(call, /\n\s*canAsk: rLive,\n/);
  assert.doesNotMatch(call, /offerAsk/);
  assert.match(call, /inventory: typeof rDigest\.inventory === "string" \? rDigest\.inventory : ""/);
  assert.match(call, /cacheKey: [^\n]*"route-" \+ rb\.slug/);
});

const LESSONS = `import { usePublicRows } from "@/lib/rows";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
function Lessons() {
  const rows = usePublicRows<{ title: string }>(
    "lessons", {});
  return (<SiteChrome links={[{ label: "Home", href: "/" }, { label: "Lessons", href: "/lessons" }]} action={{ label: "Call us", href: "tel:0123" }}>
    <SectionHeader title="x" /><h1 className="t">Surf lessons</h1><Button>Go</Button></SiteChrome>);
}`;
const SPEC = { tables: [
  { name: "lessons", access: "display", columns: [{ name: "id", pk: true }, { name: "title", notnull: true }, { name: "price", notnull: true }, { name: "spots", notnull: true, default: 8 }] },
  { name: "lesson_bookings", access: "collect", columns: [{ name: "email", notnull: true }] },
] };

test("the inventory reaches the request after the stable prefix and the digest, and the per-site pin reaches xAI's header", async () => {
  const inv = routeInventory({ pages: [{ path: "src/routes/lessons.tsx", route: "/lessons", source: LESSONS }], spec: SPEC });
  const req = await sent({ inventory: inv, cacheKey: "route-driftwood" });
  // NOTHING PER-SITE IN THE PREFIX: the tools and the system are the same for every site.
  assert.equal(req.tools[0], LIVE_ASK_TOOL);
  assert.equal(sysOf(req), LIVE_SYSTEM);
  const c = req.messages[0].content;
  const digest = c.indexOf("Its database tables are:"), block = c.indexOf(inventoryBlock(inv)), state = c.indexOf("WHICH CASE YOU ARE IN"), msg = c.indexOf("THEIR MESSAGE");
  assert.ok(digest > 0 && block > digest && state > block && msg > state, "the inventory is not between the digest and the rest");
  // THE PIN: ours on the request, `x-grok-conv-id` on the wire, never sent to Anthropic.
  assert.equal(req.cacheKey, "route-driftwood");
  const { body } = toXaiRequest({ ...req, model: "grok-4" });
  assert.equal(xaiHeaders("k", body)["x-grok-conv-id"], "gofarther-route-driftwood");
  assert.ok(!Object.hasOwn(anthropicWire(req), "cacheKey"));
  // A first build, or a key that is not a slug, is not pinned.
  assert.equal((await sent({ cacheKey: "route-a b" })).cacheKey, undefined);
});
