// THE PARALLEL PLAN'S PURE RULES AND THE PREPARED-CALL STORE (2026-10-08, the
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

// ── THE DRIVER'S CHOICES, ONE BY ONE (answering the first sweep's survivors) ──
import { planParts, newRequest, nextStep, noteJobId, notePrepared, takePrep, ownsPrep, routedForPrep, PREP_MAX_LIVE, PREP_FRESH_MS } from "../builder/request.mjs";
/** A consumer takes the claim, then keeps its outcome — the only way an outcome is kept (2026-10-09). */
const answered = (rec, n, outcome, now = Date.now(), owner = "c1") => {
  const seq = rec.parts[n].prep.seq;
  const t = takePrep(rec, n, seq, owner, now);
  assert.equal(t.ok, true, "the claim could not be taken");
  return notePrepared(t.record, n, seq, { ok: true, outcome, owner, now }).record;
};

const PKEY = "rqpar0000000000001";
const KEYOF = (rec) => rec.parts[0].jobs[0].key;
const HELD = ["make a photo of bread for the home page", "make a photo of cakes for the gallery", "make a photo of the shop for the visit page", "make a photo of flour for the about page", "make a photo of ovens for the story page"];
const MSG5 = "Change our TikTok link on the Visit page, and " + HELD.join(", and ") + ".";
const doneRow = { ok: true, state: "done", billing: "finalized", needs_review: false, result: { status: 200, body: JSON.stringify({ ok: true, layer: "text" }) } };
function fiveHeld() {
  // EACH CHANGE'S TARGETS NAMED, as the router is asked to: a part not yet
  // routed with nothing named is the whole site, and holds back the rest.
  const routed = { intent: "edit", layer: "text", page: "/visit", alsoAsked: HELD.slice(), targets: [{ change: 0, writes: ["page:/visit"] }, ...HELD.map((_, i) => ({ change: i + 1, writes: ["images", "page:/p" + i] }))] };
  const planned = planParts(MSG5, routed);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  return newRequest({ key: PKEY, uid: "u1", slug: "fold-lane", message: MSG5, accepted: routed, parts: planned.parts });
}

test("nextStep: at most PREP_MAX_LIVE preparations at once, claimed in the same write as the job it files", () => {
  const now = Date.now();
  const r = nextStep(fiveHeld(), {}, now);
  assert.equal(r.file && r.file.n, 0, "the first part's job is filed");
  assert.equal(PREP_MAX_LIVE, 3);
  assert.deepEqual(r.prepare.map((t) => t.n), [1, 2, 3], "more preparations than the cap, or not in order");
  for (const t of r.prepare) assert.equal(r.record.parts[t.n].prep.state, "attempting");
  assert.equal(r.record.parts[4].prep, null, "a part past the cap was claimed");
});

test("nextStep: a part whose preparation is still running is passed over for a ready part with none; with only such parts, nothing is filed", () => {
  const now = Date.now();
  const r1 = nextStep(fiveHeld(), {}, now);
  const rec = noteJobId(r1.record, r1.file.key, "j0");
  const r2 = nextStep(rec, { j0: doneRow }, now + 1000);
  assert.equal(r2.file && r2.file.n, 4, "a part still being prepared was filed ahead of a free one: " + JSON.stringify(r2.file));
  const only = JSON.parse(JSON.stringify(rec));
  for (const p of only.parts.slice(4)) p.status = "cancelled";
  const r3 = nextStep(only, { j0: doneRow }, now + 1000);
  assert.equal(r3.file, null, "a part was filed while its preparation runs and nothing else was ready");
});

test("nextStep: a part whose preparation found a question goes first, ahead of an earlier ready part", () => {
  const now = Date.now();
  const r1 = nextStep(fiveHeld(), {}, now);
  let rec = noteJobId(r1.record, r1.file.key, "j0");
  // Part 1's preparation answered (routed) and part 3's found a question:
  // part 1 is free and earlier, but the question goes first.
  rec = answered(rec, 1, "routed", now);
  rec = answered(rec, 3, "ask", now);
  const r2 = nextStep(rec, { j0: doneRow }, now + 1000);
  assert.equal(r2.file && r2.file.n, 3, "the part with a question waiting was not asked first: " + JSON.stringify(r2.file));
});

test("takePrep and notePrepared: one owner per attempt; an outcome kept only by that owner, for that attempt, once", () => {
  const now = Date.now();
  const rec = nextStep(fiveHeld(), {}, now).record;
  const seq = rec.parts[1].prep.seq;
  assert.equal(notePrepared(rec, 1, seq, { ok: true, outcome: "ready", owner: "c1" }).kept, false, "an outcome was kept for a claim nobody took");
  const t = takePrep(rec, 1, seq, "c1", now);
  assert.equal(t.ok, true);
  assert.equal(t.record.parts[1].prep.state, "running");
  // THE SECOND DELIVERY, reading the record as it was, takes it too — and its
  // write is the one the etag refuses; reading again, it finds the claim taken.
  assert.equal(takePrep(t.record, 1, seq, "c2", now).ok, false, "a taken claim was taken again");
  assert.equal(takePrep(rec, 1, seq + 1, "c2", now).ok, false, "a claim for another attempt was taken");
  assert.equal(notePrepared(t.record, 1, seq, { ok: true, outcome: "ready", owner: "c2" }).kept, false, "a consumer that does not own the attempt kept an outcome");
  assert.equal(notePrepared(t.record, 1, seq + 1, { ok: true, outcome: "ready", owner: "c1" }).kept, false, "an answer for another attempt was kept");
  const once = notePrepared(t.record, 1, seq, { ok: true, outcome: "ready", owner: "c1" });
  assert.equal(once.kept, true);
  assert.equal(once.record.parts[1].prep.outcome, "ready");
  assert.equal(notePrepared(once.record, 1, seq, { ok: true, outcome: "error", owner: "c1" }).kept, false, "a second answer to the same attempt overwrote the first");
  assert.equal(ownsPrep(t.record, 1, seq, "c1", now + 1000), true);
  assert.equal(ownsPrep(t.record, 1, seq, "c1", now + PREP_FRESH_MS), false, "an owner past its time still owns the attempt");
  assert.equal(ownsPrep(t.record, 1, seq, "c2", now), false);
});

test("an attempt taken and never answered is taken again after its time, naming the one before; one only sent is retried without; a late answer from the first is refused", () => {
  const now = Date.now();
  let rec = nextStep(fiveHeld(), {}, now).record;
  const s1 = rec.parts[1].prep.seq;
  const taken = takePrep(rec, 1, s1, "c1", now).record;
  const j = noteJobId(taken, KEYOF(taken), "j0");
  // INSIDE ITS TIME: not taken again.
  let r = nextStep(j, {}, now + 60_000);
  assert.equal(r.record.parts[1].prep.seq, s1, "a running attempt was taken again inside its time");
  // PAST IT: a new attempt, naming the first.
  r = nextStep(j, {}, now + PREP_FRESH_MS + 1);
  const p1 = r.record.parts[1].prep;
  assert.equal(p1.seq, s1 + 1);
  assert.equal(p1.state, "attempting");
  assert.equal(p1.prev, s1, "the new attempt does not name the one before");
  // PART 2'S ATTEMPT WAS ONLY SENT, NEVER TAKEN: retried with nothing to reuse.
  assert.equal(r.record.parts[2].prep.prev, undefined);
  // THE FIRST CONSUMER ANSWERS LATE: refused, the new attempt untouched.
  const late = notePrepared(r.record, 1, s1, { ok: true, outcome: "ready", owner: "c1" });
  assert.equal(late.kept, false, "a late answer replaced a newer attempt");
  assert.equal(late.record.parts[1].prep.seq, s1 + 1);
});

test("routedForPrep: the step a prepared routing chose is held back when the part's OWN routing names a target an earlier part writes; without it, prepared (the control)", () => {
  const routed = { intent: "edit", layer: "nav", alsoAsked: [HELD[0]], targets: [{ change: 0, writes: ["menu", "component:SiteHeader"] }] };
  const planned = planParts("Tidy the menu, and " + HELD[0] + ".", routed);
  const rec = nextStep(newRequest({ key: PKEY, uid: "u1", slug: "fold-lane", message: "m", accepted: routed, parts: planned.parts }), {}, Date.now()).record;
  const own = { route: { op: "edit", layer: "picture", page: "/" }, targets: { 0: { writes: ["images", "component:siteheader"], reads: [] } } };
  assert.equal(routedForPrep(rec, 1, own).ok, false, "a step reaching the header an unapplied part changes was prepared");
  assert.equal(routedForPrep(rec, 1, { ...own, targets: { 0: { writes: ["images", "page:/"], reads: [] } } }).ok, true, "CONTROL: an independent step was not prepared");
  assert.equal(routedForPrep(rec, 1, { route: { op: "addon" } }).ok, false, "an addition's work was prepared");
  const w = routedForPrep(rec, 1, own).work.parts[1];
  assert.equal(w.phase, "run");
  assert.ok(w.targets.writes.includes("component:siteheader"));
  assert.equal(rec.parts[1].phase, "route", "the record itself was changed");
});
