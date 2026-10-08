// THE PLAN'S PURE RULES AND THE PREPARED-CALL STORE (2026-10-08, the
// parallel-tasks batch): what a target reads as, what a step is known to
// write, when two parts conflict, the only waiting code adds (creation), the
// apply order, when a part may be prepared, and the exact-request replay.

import test from "node:test";
import assert from "node:assert/strict";
import { readTarget, readTargets, impliedWrites, effectiveTargets, conflicts, inferNeeds, applyOrder, clearToPrepare, stepInputs, pagePath } from "../builder/request-plan.mjs";
import { requestHash, recorder, replayer, readPrepared, prepKey, jobPrepKey } from "../builder/prepared.mjs";

const part = (n, o = {}) => ({ n, at: o.at ?? n, needs: o.needs || [], status: o.status || "ready", phase: o.phase || "run", route: o.route || null, targets: o.targets || null });

test("targets read back only as named; nothing coerced", () => {
  assert.equal(readTarget("page:/Visit/"), "page:/visit");
  assert.equal(readTarget("new-page:gallery.tsx"), "new-page:/gallery");
  assert.equal(readTarget("page:index"), "page:/");
  assert.equal(readTarget("menu"), "menu");
  assert.equal(readTarget("data:Loaves"), "data:loaves");
  assert.equal(readTarget("menu:main"), null, "an unnamed kind takes no name");
  assert.equal(readTarget("page:"), null);
  assert.equal(readTarget("component:9bad"), null);
  assert.equal(readTarget("everything"), null);
  assert.equal(readTarget(["menu"]), null, "an array is not a target");
  assert.equal(pagePath("/a b"), null);
  const t = readTargets([{ change: 0, writes: ["menu", "menu", "nope"], reads: ["new-page:/gallery"] }, { change: 0, writes: ["footer"] }, { change: -1, writes: ["menu"] }, { change: "1", writes: ["menu"] }, null]);
  assert.deepEqual(t, { 0: { writes: ["menu", "footer"], reads: ["new-page:/gallery"] } });
  assert.deepEqual(readTargets("menu"), {});
});

test("implied writes come from the step's wiring, never the words", () => {
  assert.deepEqual(impliedWrites({ layer: "nav" }), ["menu"]);
  assert.deepEqual(impliedWrites({ layer: "logo" }), ["identity"]);
  assert.deepEqual(impliedWrites({ layer: "page", page: "/gallery", remove: true }), ["page:/gallery", "menu", "pagelist"]);
  assert.deepEqual(impliedWrites({ layer: "picture", page: "/visit" }), ["images", "page:/visit"]);
  assert.deepEqual(impliedWrites({ layer: "text", page: "/" }), ["page:/"]);
  assert.deepEqual(impliedWrites({ layer: "data" }), ["data"]);
  assert.deepEqual(impliedWrites({ layer: "look" }), [], "a look is known only by what was named");
  assert.deepEqual(impliedWrites({ op: "addon", layer: "nav" }), []);
  assert.deepEqual(effectiveTargets(part(0, { route: { layer: "look" } })).writes, ["site"], "nothing known: the whole site");
});

test("conflicts: same component from unrelated words; a page and its creation; disjoint parts free", () => {
  const a = part(0, { route: { layer: "look" }, targets: { writes: ["component:hero"], reads: [] } });
  const b = part(1, { route: { layer: "text" }, targets: { writes: ["component:hero"], reads: [] } });
  const c = part(2, { route: { layer: "text" }, targets: { writes: ["footer"], reads: [] } });
  assert.equal(conflicts(a, b), true);
  assert.equal(conflicts(a, c), false, "CONTROL: different things");
  const mk = part(3, { route: { op: "addon" }, targets: { writes: ["new-page:/gallery"], reads: [] } });
  const link = part(4, { route: { layer: "nav" }, targets: { writes: ["menu"], reads: ["page:/gallery"] } });
  assert.equal(conflicts(mk, link), true);
  const site = part(5, { route: { layer: "look" } });
  assert.equal(conflicts(site, c), true, "the whole site reaches everything");
  const d1 = part(6, { route: { layer: "data" }, targets: { writes: ["data:loaves"], reads: [] } });
  assert.equal(conflicts(d1, part(7, { route: { layer: "rules" } })), true, "a table and `data` overlap");
});

test("inferNeeds: a reader of something created waits for it, in either order; never a cycle; existing things need nothing", () => {
  const link = part(0, { route: { layer: "nav" }, targets: { writes: ["menu"], reads: ["page:/gallery"] } });
  const mk = part(1, { route: { op: "addon" }, targets: { writes: ["new-page:/gallery"], reads: [] } });
  const tik = part(2, { route: { layer: "text" }, targets: { writes: ["footer"], reads: [] } });
  const parts = [link, mk, tik];
  assert.deepEqual(inferNeeds(parts), [[0, 1]]);
  assert.deepEqual(link.needs, [1]);
  assert.deepEqual(tik.needs, []);
  assert.deepEqual(applyOrder(parts), [1, 0, 2]);
  const cyc = [part(0, { needs: [1], route: { op: "addon" }, targets: { writes: ["new-page:/a"], reads: [] } }), part(1, { route: { layer: "nav" }, targets: { writes: ["menu"], reads: ["page:/a"] } })];
  assert.deepEqual(inferNeeds(cyc), [], "would make a cycle with what the model said");
  const old = [part(0, { route: { layer: "nav" }, targets: { writes: ["menu"], reads: ["page:/visit"] } }), part(1, { route: { layer: "text", page: "/visit" } })];
  assert.deepEqual(inferNeeds(old), [], "referring to an existing page needs nothing first");
});

test("clearToPrepare: a picture beside a footer text change; not beside an earlier writer of its inputs", () => {
  const ended = (p) => p.status === "done";
  const text = part(0, { route: { layer: "text" }, targets: { writes: ["footer"], reads: [] } });
  const pic = part(1, { route: { layer: "picture", page: "/gallery" } });
  assert.equal(clearToPrepare([text, pic], 1, ended), true);
  const text2 = part(1, { route: { layer: "text" }, targets: { writes: ["page:/"], reads: [] } });
  assert.equal(clearToPrepare([text, text2], 1, ended), false, "the text step lists every page: the footer feeds it");
  text.status = "done";
  assert.equal(clearToPrepare([text, text2], 1, ended), true, "once the earlier part has ended");
  assert.deepEqual(stepInputs(part(0, { phase: "route" })), ["pagelist"]);
});

test("requestHash: key order does not matter, deciding fields do, transport fields do not", async () => {
  const a = await requestHash({ model: "m", messages: [{ role: "user", content: "x" }], max_tokens: 9, stream: false });
  const b = await requestHash({ max_tokens: 9, messages: [{ content: "x", role: "user" }], model: "m", metadata: { u: 1 } });
  const c = await requestHash({ model: "m", messages: [{ role: "user", content: "y" }], max_tokens: 9 });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("record then replay: each answer once, a different request goes live, pictures by description, hides", async () => {
  let live = 0;
  const send = async (req) => ({ n: ++live, said: req.messages[0].content });
  const rec = recorder();
  const s = rec.wrap(send);
  await s({ model: "m", messages: [{ role: "user", content: "A" }] });
  await s({ model: "m", messages: [{ role: "user", content: "A" }] });
  const img = rec.image(async (d) => "/u/s/" + d + ".jpg");
  await img("bread");
  assert.equal(rec.calls.length, 2);
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls, images: rec.images }));
  const rp = replayer(stored);
  const r = rp.wrap(send);
  assert.equal((await r({ model: "m", messages: [{ role: "user", content: "A" }] })).n, 1);
  assert.equal((await r({ messages: [{ content: "A", role: "user" }], model: "m" })).n, 2);
  assert.equal((await r({ model: "m", messages: [{ role: "user", content: "A" }] })).n, 3, "each answer once: the third is live");
  assert.equal((await r({ model: "m", messages: [{ role: "user", content: "B" }] })).n, 4, "a changed request is made against the site as it now is");
  const gi = rp.image(async () => "LIVE");
  assert.equal(await gi("bread"), "/u/s/bread.jpg");
  assert.equal(await gi("bread"), "LIVE");
  assert.equal(rp.hides("/u/s/bread.jpg"), true);
  assert.equal(rp.hides("/u/s/other.jpg"), false);
  assert.deepEqual(rp.used(), { calls: 2, images: 1, missed: 2 });
});

test("readPrepared keeps only what reads; keys", () => {
  assert.deepEqual(readPrepared("{bad"), { calls: [], images: [] });
  assert.deepEqual(readPrepared({ calls: [{ h: "x", reply: {} }, { h: "a".repeat(64), reply: null }], images: [{ d: 1, url: "u" }] }), { calls: [], images: [] });
  const empty = replayer(null);
  const f = async () => 1;
  assert.equal(empty.wrap(f), f, "nothing prepared: the live send unchanged");
  assert.equal(prepKey("s", "k", 2, 3), "requests/s/k/prep/p2-3.json");
  assert.equal(jobPrepKey("j1"), "jobs/prepared/j1.json");
});

test("the progress writer reads a preparation from the raw record: in progress while fresh or prepared, never finished", async () => {
  const { otherParts } = await import("../builder/site-progress.mjs");
  const now = Date.now();
  const rec = { uid: "u", request: { part: 0 } };
  const base = { uid: "u", parts: [{ n: 0, words: "me", status: "running", seq: 1, phase: "run" }] };
  const other = (prep, status = "ready") => ({ ...base, parts: [...base.parts, { n: 1, words: "the gallery picture", status, seq: 1, phase: "run", prep }] });
  const st = (r) => otherParts(rec, r)[0].state;
  const control = st(other(null));
  assert.notEqual(control, "doing", "CONTROL: a ready part with no preparation is not in progress");
  assert.equal(st(other({ seq: 1, for: 1, phase: "run", state: "attempting", at: now })), "doing");
  assert.equal(st(other({ seq: 1, for: 1, phase: "run", state: "done", outcome: "ready", at: now })), "doing");
  assert.equal(st(other({ seq: 1, for: 1, phase: "run", state: "attempting", at: now - 3600e3 })), control, "a stale attempt is no longer in progress");
  assert.equal(st(other({ seq: 1, for: 1, phase: "run", state: "done", outcome: "error", at: now })), control);
  assert.equal(st(other({ seq: 1, for: 2, phase: "run", state: "attempting", at: now })), control, "a preparation for an earlier step is not this one's");
  assert.equal(st(other("preparing")), control, "the view's word is not the record's");
});
