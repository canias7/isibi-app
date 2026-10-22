// A REMOVAL DOOR THAT ALSO WRITES THE SITE'S CONFIG, UNDER PARALLEL_WRITES
// (2026-10-22, audit A03-4). The router answered `nav` with `remove` (run 63's
// shape) and the door's picker listed a look lane (the site description) as
// work asked beside the removal. That lane writes the site's config, which a
// job running under `PARALLEL_WRITES` may do only while it holds the site's
// turn — and `holdsConfig` read only the route's layer (`nav`) and its
// targets, so the part never took the turn and its own config write was
// refused, told to the customer as "That change couldn't be saved — try
// again." Driven through the real Worker: the request, the queue, the job
// runner, the route, the publish spine, with the model's answers supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { holdsConfig } from "../builder/request-plan.mjs";
import { DOOR_LAYERS } from "../builder/site-ask.mjs";

blockNetwork();

const PAGES = ["index.tsx", "order.tsx", "starter.tsx", "visit.tsx", "gallery.tsx"].map((path) => ({
  path,
  source: readFileSync(new URL("./fixtures/run47/" + path.replace(/\.tsx$/, ".before.tsx"), import.meta.url), "utf8"),
}));
const NAV_ANSWER = { links: [
  { label: "Today's bake", href: "/" },
  { label: "The starter", href: "/starter" },
  { label: "Visit", href: "/visit" },
] };
const ASK = "Take Gallery out of the menu and change the site description to say we bake overnight sourdough.";
const DESC_TO = "Overnight sourdough from a harbour side street.";
const slugOf = (k) => "dt-" + k + "-" + Math.random().toString(16).slice(2, 8);

async function run({ beside, route }) {
  const compiler = installCompiler();
  const P = platform({
    slug: slugOf(beside ? "on" : "off"), pages: PAGES, beside,
    answers: {
      route: [route],
      [T.pick]: { routed: ["behavior"], additional: ["description"] },
      "lane:description": DESC_TO,
      write_nav: NAV_ANSWER,
    },
  });
  try {
    const r = await sendMessage(P, { message: ASK });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { rec } = await settle(P, r.key);
    const jobs = P.jobsOf(r.key);
    const answers = jobs.map((j) => P.answerOf(j));
    await P.settle();
    return { P, rec, jobs, answers };
  } finally { P.close(); compiler.uninstall(); }
}

for (const [label, route] of [
  ["nav + remove", { intent: "edit", layer: "nav", remove: true }],
  ["nav + remove, targets naming the menu and the header", { intent: "edit", layer: "nav", remove: true, targets: [{ change: 0, writes: ["menu", "page:/"] }] }],
]) {
  test(`DT1 (${label}) UNDER PARALLEL_WRITES — the removal door's own description lane is written and published with the menu removal, never refused as "couldn't be saved"`, async () => {
    const { P, rec, answers } = await run({ beside: true, route });
    assert.deepEqual(rec.parts.map((p) => p.status), ["done"], JSON.stringify({ parts: rec.parts.map((p) => [p.status, p.why]), answers }));
    for (const a of answers) assert.doesNotMatch(String(a && a.msg), /couldn't be saved/, JSON.stringify(a));
    assert.equal(P.look().description, DESC_TO, "the description beside the removal was not written");
    // THE OBSERVER IS ALIVE: the menu's other links are read where they live.
    assert.ok(P.page("index.tsx").includes('{ label: "Visit", href: "/visit" }'), "the menu was not found");
    assert.ok(!P.page("index.tsx").includes('{ label: "Gallery", href: "/gallery" }'), "Gallery is still in the menu");
  });
}

test("DT2 CONTROL, SWITCH OFF — the same message with jobs side by side off makes both changes, as it always did", async () => {
  const { P, rec } = await run({ beside: false, route: { intent: "edit", layer: "nav", remove: true } });
  assert.deepEqual(rec.parts.map((p) => p.status), ["done"], JSON.stringify(rec.parts));
  assert.equal(P.look().description, DESC_TO);
});

for (const [label, route0, pick] of [
  ["the removal door", { intent: "edit", layer: "nav", remove: true }, { routed: ["behavior"], additional: ["description"] }],
  ["a look step alone", { intent: "edit", layer: "look" }, { fields: ["description"] }],
]) test(`DT4 (${label}) A TURN LOST BEFORE THE CONFIG WRITE — the turn lapses inside the description lane's model call and another job takes it: the job writes no config, publishes nothing, and says another change of the request had the turn (\`turn-lost\`) — never "couldn't be saved — try again"`, async () => {
  const compiler = installCompiler();
  const key = (P) => "publish-turn/" + P.slug + ".json";
  const at = { P: null };
  const P = platform({
    slug: slugOf("lost"), pages: PAGES, beside: true,
    answers: {
      route: [route0],
      [T.pick]: pick,
      // THE TURN LAPSES AND ANOTHER JOB TAKES IT, inside the lane's call.
      "lane:description": async () => {
        const mine = JSON.parse(at.P.readObj(key(at.P)));
        assert.match(mine.owner, /^job:/, "the door did not take the turn at its start");
        at.P.writeObj(key(at.P), JSON.stringify({ v: 1, owner: "job:newer:o2", job: "newer", at: Date.now(), until: Date.now() + 10 * 60 * 1000 }));
        return DESC_TO;
      },
      write_nav: NAV_ANSWER,
    },
  });
  at.P = P;
  try {
    const r = await sendMessage(P, { message: ASK });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const m = P.queue.find((x) => x.body.kind !== "request-prep");
    P.queue.splice(P.queue.indexOf(m), 1);
    const { deliver } = await import("./fixtures/request-flow.mjs");
    await deliver(P, m);
    const job = P.jobsOf(r.key).filter((j) => j.op === "edit")[0];
    const said = JSON.parse(job.result.body);
    assert.doesNotMatch(JSON.stringify(said), /couldn't be saved/, JSON.stringify(said));
    assert.match(JSON.stringify(said), /another change in the same request/i, JSON.stringify(said));
    assert.equal(said.error, "turn-lost", JSON.stringify(said));
    assert.notEqual(P.look().description, DESC_TO, "the stale job wrote the config");
    assert.ok(P.page("index.tsx").includes("/gallery"), "the stale job published");
    assert.equal(JSON.parse(P.readObj(key(P))).owner, "job:newer:o2", "the stale job took the turn back");
    P.writeObj(key(P), JSON.stringify({ v: 1, owner: "job:newer:o2", job: "newer", at: Date.now(), until: 0 }));
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});

test("DT3 THE PLAN — a removal door (each layer of `DOOR_LAYERS` with `remove`) holds the site's turn from its start; the same layers without `remove`, and a text change, still do not", () => {
  assert.ok(DOOR_LAYERS.length > 0);
  // BOTH WAYS: a layer outside `DOOR_LAYERS` (look and logo hold by themselves)
  // is held or not exactly as without `remove`, so the local list cannot grow
  // past the router's.
  for (const layer of ["page", "text", "data", "rules", "addon"]) {
    assert.ok(!DOOR_LAYERS.includes(layer));
    for (const targets of [undefined, { writes: ["page:/gallery"], reads: [] }]) {
      assert.equal(holdsConfig({ phase: "edit", route: { layer, page: "/gallery", remove: true }, targets }),
        holdsConfig({ phase: "edit", route: { layer, page: "/gallery" }, targets }), layer + ": remove alone moves nothing");
    }
  }
  for (const layer of DOOR_LAYERS) {
    assert.equal(holdsConfig({ phase: "edit", route: { layer, remove: true } }), true, layer + " + remove");
    assert.equal(holdsConfig({ phase: "edit", route: { layer, remove: true }, targets: { writes: ["menu"], reads: [] } }), true, layer + " + remove, targets named");
    assert.equal(holdsConfig({ phase: "edit", route: { layer } }), false, layer + " without remove");
  }
  for (const layer of ["page", "logo", "text", "data"]) {
    if (layer === "logo") continue; // a config layer by itself
    assert.equal(holdsConfig({ phase: "edit", route: { layer, page: "/gallery", remove: true } }), false, layer + " + remove is not a door");
  }
  assert.equal(holdsConfig({ phase: "route", route: { layer: "nav", remove: true } }), false, "a routing writes nothing");
});
