// Audit A15-1: under DRAFT_FIRST a replacement on a live site is paired and
// held in the draft only inside the Worker's handling of a successful
// `complete` (worker.js, the REPLACING marker; the start answers
// `replacesInDraft`). A lost `complete` answer, or a 503 `code: "draft"` (the
// seal failed), went to a status read, which answers the stand-in as `done`
// with no `held`: the panel said "Replaced", a `done` record was kept, and
// pressing Replace again with the same file reused it without ever holding.
// The real uploader (`public/site-media.js`) over a stub of the routes.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const SiteMedia = createRequire(import.meta.url)("../public/site-media.js");
const noWait = () => Promise.resolve();
function memoryStore() {
  const m = new Map();
  return { m, get: (k) => m.get(k) || null, put: (k, v) => m.set(k, JSON.parse(JSON.stringify(v))), drop: (k) => m.delete(k) };
}
const file = () => new File([new Uint8Array(100)], "take2.mp3", { lastModified: 1760000000000 });

/** The routes as the Worker answers them; `completeAs(nth)` says what the nth `complete` answers. */
function routes({ holding = true, completeAs }) {
  const calls = [];
  let completes = 0;
  return {
    calls,
    start: async () => { calls.push("start"); return { status: 201, body: { session: "s1", partBytes: 100, parts: 1, name: "take2.mp3", ...(holding ? { replacesInDraft: "welcome.mp3" } : {}) } }; },
    part: async () => { calls.push("part"); return { status: 200, body: { etag: "e1" } }; },
    complete: async () => { calls.push("complete"); return completeAs(++completes); },
    // A STATUS READ ANSWERS THE STAND-IN AS DONE, WITH NO HOLD (site-media.mjs).
    status: async () => { calls.push("status"); return { status: 200, body: { state: "done", file: { name: "take2.mp3", url: "/u/x/take2.mp3" } } }; },
    abort: async () => { calls.push("abort"); },
  };
}
const send = (api, store) => SiteMedia.upload(file(), { api, store, wait: noWait, base: "x", replace: "welcome.mp3" });
const HELD = { status: 201, body: { ok: true, name: "take2.mp3", replaces: "welcome.mp3", url: "/u/x/welcome.mp3", held: true, draft: { published: false, held: true, revision: 3 } } };

test("the seal failed (503 code draft): not saved to the draft, never 'Replaced'; no record kept, and pressing again holds it", async () => {
  const store = memoryStore();
  const api = routes({ completeAs: (n) => (n === 1 ? { status: 503, body: { error: "the new file is uploaded, but it couldn't be saved to your draft — replace the file again", code: "draft", retry: true } } : HELD) });
  const r = await send(api, store);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, "draft");
  assert.equal(store.m.size, 0, "a record of the unheld replacement was kept");
  const again = await send(api, store);
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.file.held, true, "the second press did not hold the replacement");
  assert.equal(api.calls.filter((c) => c === "complete").length, 2, "the second press never asked the server to finish (and hold) it");
});

test("the complete answer lost: not told as replaced from a status read", async () => {
  const store = memoryStore();
  const api = routes({ completeAs: () => { throw new TypeError("Failed to fetch"); } });
  const r = await send(api, store);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, "draft");
  assert.ok(!r.recovered);
});

test("a held replacement never asks status (it cannot hold), and a finish that does not say held is not a replacement", async () => {
  const lost = routes({ completeAs: () => ({ status: 503, body: { code: "draft" } }) });
  await send(lost, memoryStore());
  assert.ok(!lost.calls.includes("status"), "a status read stood in for the hold: " + lost.calls.join(","));
  const unheld = routes({ completeAs: () => ({ status: 201, body: { ok: true, name: "take2.mp3" } }) });
  const store = memoryStore();
  const r = await send(unheld, store);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, "draft");
  assert.equal(store.m.size, 0);
});

test("a done record of a replacement is never reused: the file is sent and finished again", async () => {
  const store = memoryStore();
  const api = routes({ completeAs: () => HELD });
  assert.equal((await send(api, store)).file.held, true);
  const second = await send(api, store);
  assert.equal(second.ok, true);
  assert.ok(!second.reused, "a held replacement was reused from a record");
  assert.equal(api.calls.filter((c) => c === "complete").length, 2);
});

test("CONTROL: a replacement with draft-first off, its answer lost, is still read from status as finished", async () => {
  const store = memoryStore();
  const api = routes({ holding: false, completeAs: () => { throw new TypeError("Failed to fetch"); } });
  const r = await send(api, store);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.recovered, true);
});
