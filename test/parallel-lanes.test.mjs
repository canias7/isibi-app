// THE LOOK DOOR'S LANES DO THEIR MODEL WORK TOGETHER (2026-10-11, the
// parallel-work goal): each lane is shown only its own field's stored value
// and its own words, and none reads another's answer — so the lanes picked for
// one look change are asked at once, and their answers applied in the picked
// order, in one publish, exactly as before. A failure or a question from any
// lane still sets the whole step aside.
//
// Through the real request driver, queue consumer and edit route, every model
// answer supplied, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";

blockNetwork();

const slugOf = (k) => "pl-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
/** Calls that may finish only once all have started; `false` for one that waited out the limit alone. */
function rendezvous(names, ms = 2500) {
  const at = {}, met = {};
  let open;
  const all = new Promise((r) => { open = r; });
  return {
    met,
    async arrive(name) {
      if (Object.hasOwn(at, name)) return true;
      at[name] = Date.now();
      if (names.every((n) => Object.hasOwn(at, n))) open();
      met[name] = await Promise.race([all.then(() => true), new Promise((r) => setTimeout(() => r(false), ms))]);
      return met[name];
    },
  };
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const DESC = "Make the site description say Sourdough baked at dawn by the harbour";
const BRAND = "rename the business to Harbour Loaf & Co";
const NEW_DESC = "Sourdough baked at dawn by the harbour.";
const NEW_BRAND = "Harbour Loaf & Co";
const PICK = { fields: ["description", "brand"], scopes: [{ part: "description", words: DESC }, { part: "brand", words: BRAND }] };

test("PL 1 — TWO LOOK LANES IN ONE CHANGE (a description and the business name): both lanes are asked at the same time; both answers land in one publish, each lane asked once, one charge", { timeout: 30000 }, async () => {
  const met = rendezvous(["description", "brand"]);
  await withPlatform({
    slug: slugOf("1"),
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: PICK,
      "lane:description": async () => { await met.arrive("description"); return NEW_DESC; },
      "lane:brand": async () => { await met.arrive("brand"); return NEW_BRAND; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: DESC + ", and " + BRAND + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(met.met, { description: true, brand: true }, "the lanes ran one after the other: " + JSON.stringify(met.met));
    assert.equal(P.look().description, NEW_DESC);
    assert.equal(P.look().brand, NEW_BRAND);
    const laneCalls = (f) => P.modelLog.filter((m) => m.tool === T.lane && m.props[0] === f).length;
    assert.equal(laneCalls("description"), 1);
    assert.equal(laneCalls("brand"), 1);
    const refs = P.ledger.map((e) => e.ref);
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  });
});

test("PL 2 — ONE LANE ASKS A QUESTION WHILE THE OTHER ANSWERS: the whole look step asks and changes nothing (the other lane's answer is set aside, never applied or charged as done)", { timeout: 30000 }, async () => {
  await withPlatform({
    slug: slugOf("2"),
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: PICK,
      "lane:description": NEW_DESC,
      "lane:brand": { question: { text: "Should the ampersand be written out as 'and'?", options: ["Keep &", "Write and"] } },
    },
  }, async (P) => {
    const before = { ...P.look() };
    const r = await sendMessage(P, { message: DESC + ", and " + BRAND + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "waiting", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, before.description, "the other lane's answer was applied beside a question");
    assert.equal(P.look().brand, before.brand);
  });
});
