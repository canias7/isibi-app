// AUDIT BATCH 1 (2026-10-18): the cases its sweep's survivors asked for.
//   T1 — a turn the store refuses is never waited out (takeTurn itself);
//   B2/B3 — each of unpublishedVersions' two holds, on its own;
//   M4 — a pre-scoped job never reaches a ledger, even under a real name;
//   R1/R4 — a name lookup that FAILS refuses the rename and Publish's move.
import test from "node:test";
import assert from "node:assert/strict";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { GatewayError } from "../builder/container-env.mjs";
import { ownAccountKey } from "../builder/job-gateway.mjs";
import { unpublishedVersions } from "../site-draft.mjs";

blockNetwork();

test("T1 A TURN THE STORE REFUSES IS NEVER WAITED OUT — takeTurn answers at once and marks the job refused; a transient error is still asked again", async () => {
  const { siteTurn } = await loadWorkerModule();
  let gets = 0;
  const env = { PUBLISH_TURN_POLL_MS: "1", SITES_BUCKET: { get: async () => { gets++; throw new GatewayError("get", 403, "publish-turn/fold-lane.json"); } } };
  let asked = 0;
  const job = { id: "j1", owner: "o", beside: {}, budget: { expired: () => ++asked > 40 } };
  assert.equal(await siteTurn.takeTurn(env, "fold-lane", job), null);
  assert.equal(job.beside.refused, true, "a refused turn was not marked");
  assert.equal(gets, 1, "a refused turn was asked " + gets + " times");
  // A TRANSIENT ERROR IS NOT A REFUSAL: asked again until the budget.
  let tgets = 0;
  const env2 = { PUBLISH_TURN_POLL_MS: "1", SITES_BUCKET: { get: async () => { tgets++; throw new GatewayError("get", 502, "publish-turn/fold-lane.json"); } } };
  let asked2 = 0;
  const job2 = { id: "j2", owner: "o", beside: {}, budget: { expired: () => ++asked2 > 3 } };
  assert.equal(await siteTurn.takeTurn(env2, "fold-lane", job2), null);
  assert.notEqual(job2.beside.refused, true);
  assert.ok(tgets > 1, "a transient error was not asked again");
});

test("T1b AN EXPIRED OR ROTATED TOKEN (401) IS NOT A REFUSAL — the turn is asked again until the budget ends, and the part is never told the store refused it", async () => {
  const { siteTurn } = await loadWorkerModule();
  let gets = 0;
  const env = { PUBLISH_TURN_POLL_MS: "1", SITES_BUCKET: { get: async () => { gets++; throw new GatewayError("get", 401, "publish-turn/fold-lane.json"); } } };
  let asked = 0;
  const job = { id: "j3", owner: "o", beside: {}, budget: { expired: () => ++asked > 3 } };
  assert.equal(await siteTurn.takeTurn(env, "fold-lane", job), null);
  assert.notEqual(job.beside.refused, true, "a 401 was read as the store's refusal");
  assert.ok(gets > 1, "a 401 was asked only " + gets + " time(s)");
  // THE OBSERVER IS ALIVE: the same harness with a 403 stops at one ask.
  let g403 = 0;
  const env403 = { PUBLISH_TURN_POLL_MS: "1", SITES_BUCKET: { get: async () => { g403++; throw new GatewayError("get", 403, "publish-turn/fold-lane.json"); } } };
  const job403 = { id: "j4", owner: "o", beside: {}, budget: { expired: () => false } };
  assert.equal(await siteTurn.takeTurn(env403, "fold-lane", job403), null);
  assert.equal(job403.beside.refused, true);
  assert.equal(g403, 1);
});
test("T1c THE WAIT FOR A HELD TURN HAS ITS OWN LIMIT (2026-10-18, audit A03-3) — another job holds the turn and the budget never ends: takeTurn gives up after PUBLISH_TURN_WAIT_MS, marked waitedOut, never refused", async () => {
  const { siteTurn } = await loadWorkerModule();
  const held = JSON.stringify({ v: 1, owner: "job:other:o", job: "other", at: Date.now(), until: Date.now() + 10 * 60 * 1000, gen: 1 });
  const env = { PUBLISH_TURN_POLL_MS: "2", PUBLISH_TURN_WAIT_MS: "40", SITES_BUCKET: { get: async () => ({ text: async () => held, etag: "e1", uploaded: new Date() }), put: async () => null } };
  const job = { id: "j5", owner: "o", beside: {}, budget: { expired: () => false }, cancelled: () => false };
  let stop = false;
  job.cancelled = () => stop;
  const out = await Promise.race([siteTurn.takeTurn(env, "fold-lane", job), new Promise((r) => setTimeout(() => r("still waiting"), 2000))]);
  stop = true; // A LOOP THAT NEVER ENDED ON ITS OWN IS STOPPED, so the run itself ends.
  assert.equal(out, null, "the wait never ended");
  assert.equal(job.beside.waitedOut, true);
  assert.notEqual(job.beside.refused, true);
});
test("T1d A STORE THAT KEEPS FAILING IS NOT WAITED OUT (2026-10-18, audit A03-3) — five failed reads in a row end the wait as unreadable; a good read between failures starts the count again", async () => {
  const { siteTurn } = await loadWorkerModule();
  let gets = 0;
  const env = { PUBLISH_TURN_POLL_MS: "1", PUBLISH_TURN_WAIT_MS: "60000", SITES_BUCKET: { get: async () => { gets++; throw new GatewayError("get", 502, "publish-turn/fold-lane.json"); } } };
  const job = { id: "j6", owner: "o", beside: {}, budget: { expired: () => false }, cancelled: () => false };
  let stop = false;
  job.cancelled = () => stop;
  const out = await Promise.race([siteTurn.takeTurn(env, "fold-lane", job), new Promise((r) => setTimeout(() => r("still waiting"), 2000))]);
  stop = true;
  assert.equal(out, null, "a failing store was waited on forever");
  assert.deepEqual([job.beside.unreadable, gets], [true, 5]);
  // A GOOD READ BETWEEN FAILURES RESETS THE COUNT: fail, fail, held, fail ×5.
  const held = JSON.stringify({ v: 1, owner: "job:other:o", job: "other", at: Date.now(), until: Date.now() + 600000, gen: 1 });
  let n = 0;
  const env2 = { PUBLISH_TURN_POLL_MS: "1", PUBLISH_TURN_WAIT_MS: "60000", SITES_BUCKET: { get: async () => { n++; if (n === 3) return { text: async () => held, etag: "e", uploaded: new Date() }; throw new GatewayError("get", 502, "k"); }, put: async () => null } };
  let stop2 = false;
  const job2 = { id: "j7", owner: "o", beside: {}, budget: { expired: () => false }, cancelled: () => stop2 };
  await Promise.race([siteTurn.takeTurn(env2, "fold-lane", job2), new Promise((r) => setTimeout(r, 2000))]);
  stop2 = true;
  assert.deepEqual([job2.beside.unreadable, n], [true, 8], "the count did not start again after a good read");
});
test("T1e A TURN THAT TIMED OUT OR COULD NOT BE READ IS NOT AN OVERLAP — its answer has its own code, never re-run as an overlap loss, and says nothing of 'another change'", async () => {
  const { siteTurn } = await loadWorkerModule();
  const { OVERLAP_LOSSES } = await import("../builder/request.mjs");
  for (const [flag, code] of [["unreadable", "turn-unreadable"], ["waitedOut", "turn-timeout"]]) {
    const r = siteTurn.turnStop({ [flag]: true });
    assert.equal(r.error, code);
    assert.equal(OVERLAP_LOSSES.includes(code), false, code + " is re-run as an overlap");
    assert.match(r.detail, /nothing was changed/);
  }
  assert.equal(siteTurn.turnStop({}), null);
});
test("B2/B3 unpublishedVersions HOLDS BACK EACH KIND ON ITS OWN — an older unpublished revision's version (not the draft's), and the draft's own version with no revision naming it; never a published one", () => {
  const V = (n) => "0179000000000" + n + "-aaaaaa";
  // B3: revision 3 is unpublished and is not the draft's own version.
  const d1 = { version: V(4), history: [], applied: 2, revs: [{ n: 1, version: V(1) }, { n: 2, version: V(2) }, { n: 3, version: V(3) }, { n: 4, version: V(4) }] };
  assert.deepEqual([...unpublishedVersions(d1)].sort(), [V(3), V(4)]);
  // B2: the draft's own version, which no revision names.
  const d2 = { version: V(5), history: [], applied: 1, revs: [{ n: 1, version: V(1) }] };
  assert.deepEqual([...unpublishedVersions(d2)], [V(5)]);
  // PUBLISHED ONES NEVER: everything applied.
  const d3 = { version: V(2), history: [V(1)], applied: 2, revs: [{ n: 1, version: V(1) }, { n: 2, version: V(2) }] };
  assert.deepEqual([...unpublishedVersions(d3)], []);
  assert.deepEqual([...unpublishedVersions(null)], []);
});

test("M4 A PRE-SCOPED JOB NEVER REACHES A LEDGER — even when its token's name is a real site's", () => {
  const who = { id: "j1", slug: "fold-lane", uid: "u1" };
  assert.equal(ownAccountKey(who, "media-ledger/site-fold-lane.json", "read"), true);
  assert.equal(ownAccountKey({ ...who, pre: true }, "media-ledger/site-fold-lane.json", "read"), false);
  assert.equal(ownAccountKey({ ...who, pre: true }, "media-ledger/site-fold-lane.json", "write"), false);
});

// A01-2's last part (2026-10-18): the page forgot every pre-site file after a
// build, even one the build said it could not move "just now".
import { readFileSync } from "node:fs";
test("M5 A PRE-SITE FILE THE BUILD COULD NOT MOVE FOR NOW STAYS WAITING; ONE GONE OR WITH NO ROOM IS LET GO — the page's own block, run", () => {
  const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = chat.indexOf("if (Array.isArray(s.pendingMedia)) {");
  assert.ok(at > 0, "the block moved — rescope this guard");
  let depth = 0, end = -1;
  for (let i = chat.indexOf("{", at); i < chat.length; i++) { if (chat[i] === "{") depth++; else if (chat[i] === "}" && --depth === 0) { end = i + 1; break; } }
  const run = new Function("s", "d", chat.slice(at, end));
  const A = "a".repeat(32) + ".mp4", B = "b".repeat(32) + ".mp3", C = "c".repeat(32) + ".m4a";
  const s1 = { pendingMedia: [A, B, C] };
  run(s1, { media: { missing: [
    { name: "clip.mp4", file: A, why: "it could not be moved just now" },
    { name: "tone.mp3", file: B, why: "it was no longer kept" },
    { name: "x.m4a", file: C, why: "the site's video and audio storage is full" },
  ] } });
  assert.deepEqual(s1.pendingMedia, [A], "only the file that could not be moved for now should wait");
  const s2 = { pendingMedia: [A] };
  run(s2, { media: { missing: [] } });
  assert.equal(s2.pendingMedia, undefined, "a moved file was kept waiting");
  const s3 = { pendingMedia: [A] };
  run(s3, {});
  assert.equal(s3.pendingMedia, undefined, "an answer without media kept the list");
  const s4 = { pendingMedia: [A] };
  run(s4, { media: { missing: [{ file: "zzz.mp4", why: "it could not be read just now" }] } });
  assert.equal(s4.pendingMedia, undefined, "a file the page never sent was added");
});
