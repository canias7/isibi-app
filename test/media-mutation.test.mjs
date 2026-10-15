// A DELETE AND A REPLACEMENT'S CLOSE, ONE SEQUENCE PER FILE (2026-10-15,
// Codex's review of `aef027fd`).
//
// Codex reproduced the gap the previous round documented: a replacement read
// the old object, a delete landed just after, and R2's multipart close then
// answered 200 and wrote the deleted file back. Now both go through the file's
// own record (`media-assets/<scope>/<name>.json`, conditional writes): a
// replacement claims it before closing, a delete marks it deleted before
// removing the object, and whichever reaches the record first wins.
//
// Every case runs the REAL routes over the R2 double (`test/fixtures/r2-media.mjs`,
// R2's own etag rules), with BARRIERS on the double — before a multipart
// close lands, before a delete lands, before a record's conditional write —
// so the requests meet exactly in the gap between checking and committing.
// Both orders, overlapping writes, retries, lost answers and a holder
// interrupted mid-commit, each with its explicit outcome and its reservation
// given back; and the ordinary replacement and delete as controls.
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { withWire, envFor } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { call, fixture, mediaIn, ledgerOf } from "./fixtures/media-wire.mjs";
import { MEDIA_CLAIM_MS } from "../site-media.mjs";

/** A gate a case opens once, saying when it was reached. */
function barrier() { let open; const p = new Promise((r) => { open = r; }); return { p, open, hit: false }; }
async function until(cond, what) {
  for (let i = 0; i < 2000; i++) { if (cond()) return; await new Promise((r) => setTimeout(r, 2)); }
  assert.fail("never came: " + what);
}
const json = (bytes) => { try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; } };

/**
 * A site with one finished audio file, and the barriers. `hold.complete`,
 * `hold.delete` and `hold.asset` are set by a case to the barrier the next
 * matching call waits at (each used once).
 */
async function site(slug, { env: extra = {} } = {}) {
  const worker = await loadWorker();
  const hold = { complete: null, delete: null, asset: null };
  const bucket = mediaBucket({
    hooks: {
      beforeComplete: async () => { const b = hold.complete; if (b) { hold.complete = null; b.hit = true; await b.p; } },
      beforeDelete: async (key) => { const b = hold.delete; if (b && String(key).startsWith("uploads/")) { hold.delete = null; b.hit = true; await b.p; } },
      beforePut: async (key, bytes, opts) => {
        const b = hold.asset;
        if (b && key.startsWith("media-assets/") && opts.onlyIf && (!b.when || b.when(json(bytes)))) { hold.asset = null; b.hit = true; await b.p; }
      },
    },
  });
  const env = { ...envFor(bucket), ...extra };
  const base = "/api/site/" + slug + "/media";
  const original = fixture("tone.mp3");
  let name = "";
  let firstSid = "";
  await withWire({}, async () => {
    const st = await call(worker, env, "POST", base, { json: { name: "intro.mp3", size: original.length } });
    firstSid = st.body.session;
    await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: original });
    name = (await call(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts: [] } })).body.name;
  });
  const key = "uploads/" + slug + "/" + name;
  const newer = new Uint8Array(original.length + 32);
  newer.set(original);
  newer.fill(9, original.length);
  /** A replacement started and sent, not yet closed. */
  const replacement = async () => {
    const st = await call(worker, env, "POST", base, { json: { name: "intro v2.mp3", size: newer.length, replace: name } });
    assert.equal(st.status, 201, JSON.stringify(st.body));
    await call(worker, env, "PUT", base + "/" + st.body.session + "/1", { body: newer });
    return st.body.session;
  };
  const record = () => json(bucket.raw("media-assets/site-" + slug + "/" + name + ".json"));
  return {
    worker, bucket, env, base, name, key, original, newer, hold, replacement, record, firstSid,
    complete: (sid) => call(worker, env, "POST", base + "/" + sid + "/complete", { json: { parts: [] } }),
    del: (q = "") => call(worker, env, "DELETE", "/api/site/" + slug + "/uploads/" + name + q),
    status: (sid) => call(worker, env, "GET", base + "/" + sid),
    held: () => ledgerOf(bucket, "site-" + slug).held,
  };
}

// ── CONTROLS ────────────────────────────────────────────────────────────────

test("CONTROL — an ordinary replacement closes over its generation, and an ordinary delete removes the file; neither leaves a reservation", async () => {
  await withWire({}, async () => {
    const S = await site("mut-control");
    const sid = await S.replacement();
    const r = await S.complete(sid);
    assert.deepEqual([r.status, r.body.name, r.body.replaced], [200, S.name, true], JSON.stringify(r.body));
    assert.deepEqual(S.bucket.raw(S.key), S.newer);
    assert.deepEqual([S.record().state, S.record().gen, S.record().up], ["live", 1, sid]);
    const d = await S.del();
    assert.deepEqual([d.status, d.body.ok], [200, true]);
    assert.deepEqual(mediaIn(S.bucket, "mut-control"), []);
    assert.deepEqual([S.record().state, S.record().gen], ["deleted", 2]);
    assert.deepEqual(S.held(), {});
    // A FILE A PAGE PLAYS IS STILL HELD FOR CONFIRMATION FIRST (unchanged).
    const S2 = await site("mut-control-2");
    S2.bucket.store.set("source/mut-control-2/pages.json", { bytes: new TextEncoder().encode(JSON.stringify([{ path: "index.tsx", source: "<audio src=\"/u/mut-control-2/" + S2.name + "\" />" }])), etag: "x", version: "v", at: 1, httpMetadata: {}, customMetadata: {} });
    const asked = await S2.del();
    assert.deepEqual([asked.status, asked.body.code], [409, "in_use"]);
    assert.ok(S2.bucket.raw(S2.key));
    assert.equal((await S2.del("?force=1")).status, 200);
    assert.equal(S2.bucket.raw(S2.key), null);
  });
});

// ── CODEX'S ORDER: THE REPLACEMENT CHECKED, THEN THE DELETE ────────────────

test("REPLACEMENT CHECKED, DELETE IN THE GAP (Codex's reproduction): the delete is refused while the close is committing; the close lands; the delete sent again removes it; a repeated close does not bring it back", async () => {
  await withWire({}, async () => {
    const S = await site("mut-codex");
    const sid = await S.replacement();
    // THE REPLACEMENT IS HELD between its claim and R2's close.
    const gap = barrier();
    S.hold.complete = gap;
    const closing = S.complete(sid);
    await until(() => gap.hit, "the replacement reaching R2's close");
    assert.equal(S.record().state, "committing", "the replacement reached R2's close without claiming the file");
    const d1 = await S.del();
    assert.deepEqual([d1.status, d1.body.code, d1.body.retry], [409, "replacing", true], "a delete landed in the gap between the check and the commit (Codex: it did, and the close wrote the file back): " + JSON.stringify(d1.body));
    assert.deepEqual(S.bucket.raw(S.key), S.original, "the delete touched the file while it was being replaced");
    gap.open();
    const r = await closing;
    assert.deepEqual([r.status, r.body.replaced], [200, true]);
    assert.deepEqual(S.bucket.raw(S.key), S.newer);
    // THE OWNER'S DELETE, SENT AGAIN: now it lands.
    const d2 = await S.del();
    assert.equal(d2.status, 200);
    assert.equal(S.bucket.raw(S.key), null);
    // A REPEATED CLOSE (its first answer lost) — the receipt, not a resurrection.
    const again = await S.complete(sid);
    assert.deepEqual([again.status, again.body.code], [410, "removed"]);
    assert.equal(S.bucket.raw(S.key), null, "a repeated close brought the deleted file back");
    assert.deepEqual(S.held(), {});
  });
});

// ── THE OTHER ORDER: THE DELETE, THEN THE REPLACEMENT'S CLOSE ──────────────

test("DELETE FIRST: the replacement's close is refused as removed, R2 is never asked to close, its upload is aborted and its room given back", async () => {
  await withWire({}, async () => {
    const S = await site("mut-delete-first");
    const sid = await S.replacement();
    assert.equal((await S.del()).status, 200);
    const closes = S.bucket.calls.filter((c) => c === "complete").length;
    const r = await S.complete(sid);
    assert.deepEqual([r.status, r.body.code], [410, "removed"]);
    assert.equal(S.bucket.calls.filter((c) => c === "complete").length, closes, "R2 was asked to close over a deleted file");
    assert.equal(S.bucket.raw(S.key), null, "the replacement brought the deleted file back");
    assert.ok(S.bucket.calls.includes("abort"), "the replacement's upload was left open");
    assert.deepEqual(S.held(), {}, "the given-up replacement still holds room");
    assert.equal((await S.status(sid)).status, 404);
  });
});

test("DELETE IN ITS OWN GAP (marked deleted, object not yet removed): the replacement's close is refused, and the delete then finishes", async () => {
  await withWire({}, async () => {
    const S = await site("mut-delete-gap");
    const sid = await S.replacement();
    const gap = barrier();
    S.hold.delete = gap;
    const deleting = S.del();
    await until(() => gap.hit, "the delete reaching the object");
    assert.equal(S.record().state, "deleted");
    // THE ORIGINAL UPLOAD'S RECEIPT, WITH THE OBJECT STILL THERE: removed, by the record.
    assert.ok(S.bucket.raw(S.key), "the object was already gone — this case cannot see the half-done delete");
    const rcpt = await S.status(S.firstSid);
    assert.deepEqual([rcpt.status, rcpt.body.state, rcpt.body.file], [200, "removed", undefined], "a receipt answered a file its record says is deleted: " + JSON.stringify(rcpt.body));
    const r = await S.complete(sid);
    assert.deepEqual([r.status, r.body.code], [410, "removed"]);
    gap.open();
    assert.equal((await deleting).status, 200);
    assert.equal(S.bucket.raw(S.key), null);
    assert.deepEqual(S.held(), {});
  });
});

// ── OVERLAPPING: BOTH READ THE SAME RECORD, BOTH WRITE ─────────────────────

for (const first of ["replacement", "delete"]) {
  test("OVERLAPPING, " + first.toUpperCase() + " WRITES FIRST: both read the record at the same etag; the second's conditional write fails, it reads again, and is told what the first did", async () => {
    await withWire({}, async () => {
      const S = await site("mut-overlap-" + first);
      const sid = await S.replacement();
      // BOTH HELD AT THEIR RECORD WRITE, having read the same record.
      const a = barrier(), b = barrier();
      const isClaim = (j) => j && j.state === "committing";
      const isDelete = (j) => j && j.state === "deleted";
      // THE CLOSE IS ALSO HELD AT R2, so the delete's second read meets the claim.
      const closeGate = barrier();
      if (first === "replacement") S.hold.complete = closeGate;
      const g1 = first === "replacement" ? a : b;
      g1.when = first === "replacement" ? isClaim : isDelete;
      S.hold.asset = g1;
      const p1 = first === "replacement" ? S.complete(sid) : S.del();
      await until(() => g1.hit, "the first write");
      const g2 = first === "replacement" ? b : a;
      g2.when = first === "replacement" ? isDelete : isClaim;
      S.hold.asset = g2;
      const p2 = first === "replacement" ? S.del() : S.complete(sid);
      await until(() => g2.hit, "the second write, at the same etag");
      g1.open(); await new Promise((r) => setTimeout(r, 5));
      g2.open();
      if (first === "replacement") {
        const early = await p2;
        assert.deepEqual([early.status, early.body.code], [409, "replacing"], "the delete's second read did not meet the claim: " + JSON.stringify(early.body));
        closeGate.open();
      }
      const [r1, r2] = await Promise.all([p1, p2]);
      const close = first === "replacement" ? r1 : r2;
      const del = first === "replacement" ? r2 : r1;
      if (first === "replacement") {
        assert.deepEqual([close.status, del.status, del.body.code], [200, 409, "replacing"], JSON.stringify([close.body, del.body]));
        assert.deepEqual(S.bucket.raw(S.key), S.newer);
        assert.deepEqual([S.record().state, S.record().gen], ["live", 1]);
      } else {
        assert.deepEqual([del.status, close.status, close.body.code], [200, 410, "removed"], JSON.stringify([del.body, close.body]));
        assert.equal(S.bucket.raw(S.key), null, "the overlapping close brought the deleted file back");
        assert.deepEqual([S.record().state, S.record().gen], ["deleted", 1]);
      }
      assert.deepEqual(S.held(), {});
    });
  });
}

// ── RETRIES AND LOST ANSWERS ───────────────────────────────────────────────

test("RETRIES AND LOST ANSWERS: a close whose answer was lost is answered again the same; a delete whose answer was lost is answered done; a refused delete sent again after the close lands", async () => {
  await withWire({}, async () => {
    const S = await site("mut-retry");
    const sid = await S.replacement();
    await S.complete(sid); // its answer "lost": the page never read it
    const again = await S.complete(sid);
    assert.deepEqual([again.status, again.body.again, again.body.name], [200, true, S.name]);
    assert.equal(S.bucket.calls.filter((c) => c === "complete").length, 2, "the replacement was closed twice"); // the original upload's close and this one's
    await S.del(); // its answer "lost"
    const d = await S.del();
    assert.deepEqual([d.status, d.body.already], [200, true]);
    assert.equal(S.bucket.raw(S.key), null);
    assert.deepEqual([S.record().state, S.record().gen], ["deleted", 2], "a delete sent again moved the generation again");
  });
});

// ── A HOLDER INTERRUPTED MID-COMMIT ────────────────────────────────────────

test("INTERRUPTED BEFORE R2 CLOSED: a delete is refused until the claim is stale, then recovers it — the upload aborted first, the file kept as it was and then deleted — and the late close, released, cannot write it back", async () => {
  const realNow = Date.now;
  try {
    await withWire({}, async () => {
      const S = await site("mut-crash-before");
      const sid = await S.replacement();
      const gap = barrier();
      S.hold.complete = gap;
      const zombie = S.complete(sid);
      await until(() => gap.hit, "the replacement reaching R2's close");
      assert.deepEqual([(await S.del()).body.code], ["replacing"], "a fresh claim was not respected");
      // THE HOLDER IS GONE; TIME PASSES BEYOND THE CLAIM'S LEASE.
      const t0 = realNow();
      Date.now = () => t0 + MEDIA_CLAIM_MS + 1000;
      const d = await S.del();
      assert.equal(d.status, 200, JSON.stringify(d.body));
      assert.equal(S.bucket.raw(S.key), null);
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 1], "the recovery did not keep the file's generation before deleting it");
      assert.equal((await S.status(sid)).status, 404, "the interrupted replacement was not given up");
      // THE INTERRUPTED CLOSE COMES BACK TO LIFE: its upload was aborted, so it cannot land.
      gap.open();
      const late = await zombie;
      assert.ok([404, 409, 410].includes(late.status), "a stale close was not told it was given up: " + JSON.stringify(late.body));
      assert.equal(S.bucket.raw(S.key), null, "a stale close brought the deleted file back");
      assert.deepEqual(S.held(), {}, "the interrupted replacement still holds room");
    });
  } finally { Date.now = realNow; }
});

test("INTERRUPTED AFTER R2 CLOSED, BEFORE THE RECORD MOVED: the recovery reads the object, finds the replacement landed, records it as the next generation and its receipt as done — and the delete then removes it", async () => {
  const realNow = Date.now;
  try {
    await withWire({}, async () => {
      const S = await site("mut-crash-after");
      const sid = await S.replacement();
      // HELD AT ITS FINAL RECORD WRITE (live, its own upload id), after R2 closed.
      const gap = barrier();
      gap.when = (j) => j && j.state === "live" && j.up === sid;
      S.hold.asset = gap;
      const zombie = S.complete(sid);
      await until(() => gap.hit, "the replacement's final record write");
      assert.deepEqual(S.bucket.raw(S.key), S.newer, "R2 had not closed — this case cannot see the second crash point");
      assert.equal((await S.del()).body.code, "replacing");
      const t0 = realNow();
      Date.now = () => t0 + MEDIA_CLAIM_MS + 1000;
      const d = await S.del();
      assert.equal(d.status, 200, JSON.stringify(d.body));
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 2], "the landed replacement was not recorded as its generation before the delete");
      assert.equal(S.bucket.raw(S.key), null);
      const st = await S.status(sid);
      assert.deepEqual([st.status, st.body.state], [200, "removed"], "the landed replacement's receipt was not recorded");
      gap.open();
      await zombie;
      assert.equal(S.bucket.raw(S.key), null, "the stale holder wrote the file back");
      assert.deepEqual([S.record().state], ["deleted"], "the stale holder's record write landed over the delete");
      assert.deepEqual(S.held(), {});
    });
  } finally { Date.now = realNow; }
});

// ── STOPPING THE OLD UPLOAD MUST BE PROVEN (2026-10-15, Codex's review of `69462730`) ──
//
// Codex's reproduction: the replacement paused inside R2's close; the clock
// past MEDIA_CLAIM_MS; every abort throwing without stopping the upload; then
// a delete. The recovery swallowed both aborts, released the claim and the
// delete answered 200 — and the paused close, resumed, answered 200,
// recreated the object and recorded its receipt done while the record said
// deleted. Each case ends by checking that the object, the record's
// generation, both receipts, the reservation and what each request answered
// agree.

/** The replacement held inside R2's close, its claim stale: the state every case below starts from. */
async function staleClaim(S, realNow) {
  const sid = await S.replacement();
  const gap = barrier();
  S.hold.complete = gap;
  const zombie = S.complete(sid);
  await until(() => gap.hit, "the replacement paused inside R2's close");
  const t0 = realNow();
  Date.now = () => t0 + MEDIA_CLAIM_MS + 1000;
  return { sid, gap, zombie };
}

test("ABORT FAILS, UPLOAD NOT STOPPED (Codex's reproduction): the delete is refused as unconfirmed with the claim kept; the paused close lands; everything agrees it is the next generation; the delete then removes it", async () => {
  const realNow = Date.now;
  try {
    await withWire({}, async () => {
      const S = await site("mut-abort-fails");
      const { sid, gap, zombie } = await staleClaim(S, realNow);
      S.bucket.failNext("abort", 1000); // storage fails every abort; the upload goes on
      const d = await S.del();
      assert.deepEqual([d.status, d.body.code, d.body.retry], [503, "unconfirmed", true], "a delete was authorised while the old close could still land (Codex: it answered 200): " + JSON.stringify(d.body));
      assert.deepEqual([S.record().state, S.record().gen, S.record().claim.sid], ["committing", 0, sid], "the claim was released though the old upload was not shown to have stopped");
      assert.deepEqual(S.bucket.raw(S.key), S.original, "the file was touched");
      assert.ok(Object.keys(S.held()).length === 1, "the replacement's reservation was released while it could still land");
      assert.equal((await S.status(sid)).body.state, "open");
      // THE PAUSED CLOSE RESUMES AND LANDS.
      gap.open();
      const r = await zombie;
      assert.deepEqual([r.status, r.body.replaced], [200, true], JSON.stringify(r.body));
      // EVERYTHING AGREES: the next generation, the replacement's bytes, its receipt done, the original's replaced, no reservation.
      assert.deepEqual(S.bucket.raw(S.key), S.newer);
      assert.deepEqual([S.record().state, S.record().gen, S.record().up], ["live", 1, sid]);
      assert.equal((await S.status(sid)).body.state, "done");
      assert.equal((await S.status(S.firstSid)).body.state, "replaced");
      assert.deepEqual(S.held(), {});
      // THE OWNER'S DELETE, SENT AGAIN (storage still failing aborts — none is needed now).
      const d2 = await S.del();
      assert.equal(d2.status, 200, JSON.stringify(d2.body));
      assert.equal(S.bucket.raw(S.key), null);
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 2]);
      assert.equal((await S.status(sid)).body.state, "removed");
    });
  } finally { Date.now = realNow; }
});

test("ABORT FAILS, THEN STORAGE RETURNS BEFORE THE CLOSE: the delete sent again stops the old upload for certain, keeps the generation and deletes; the paused close cannot land and is told removed; everything agrees", async () => {
  const realNow = Date.now;
  try {
    await withWire({}, async () => {
      const S = await site("mut-abort-recovers");
      const { sid, gap, zombie } = await staleClaim(S, realNow);
      S.bucket.failNext("abort", 1000);
      assert.equal((await S.del()).body.code, "unconfirmed");
      // STORAGE ANSWERS AGAIN.
      S.bucket.failNext("abort", 0);
      const d = await S.del();
      assert.equal(d.status, 200, JSON.stringify(d.body));
      assert.equal(S.bucket.raw(S.key), null);
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 1], "the stopped replacement was given a generation");
      assert.equal((await S.status(sid)).status, 404, "the stopped replacement's session was kept");
      assert.deepEqual(S.held(), {}, "the stopped replacement still holds room");
      gap.open();
      const late = await zombie;
      assert.deepEqual([late.status, late.body.code], [410, "removed"], "the stopped close was not told what became of the file: " + JSON.stringify(late.body));
      assert.equal(S.bucket.raw(S.key), null, "the stopped close brought the file back");
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 1]);
      assert.equal((await S.status(S.firstSid)).body.state, "removed");
      assert.deepEqual(S.held(), {});
    });
  } finally { Date.now = realNow; }
});

test("CONTROL — R2 SAYS THE UPLOAD NO LONGER EXISTS (NoSuchUpload): that proves it stopped; the delete goes through and nothing can land", async () => {
  const realNow = Date.now;
  try {
    await withWire({}, async () => {
      const S = await site("mut-abort-gone");
      const { sid, gap, zombie } = await staleClaim(S, realNow);
      // THE UPLOAD IS REALLY GONE (expired at R2), AND R2 SAYS SO WHEN ABORTED.
      S.bucket.uploads.clear();
      S.bucket.failNext("abort", 1, () => Object.assign(new Error("NoSuchUpload: The specified multipart upload does not exist."), { code: 10024 }));
      const d = await S.del();
      assert.equal(d.status, 200, JSON.stringify(d.body));
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 1]);
      gap.open();
      const late = await zombie;
      assert.equal(late.status, 410);
      assert.equal(S.bucket.raw(S.key), null);
      assert.equal((await S.status(sid)).status, 404);
      assert.deepEqual(S.held(), {});
    });
  } finally { Date.now = realNow; }
});

test("CONTROL — THE CLOSE HAD LANDED, AND THE ABORT FAILS: the object proves it landed; the recovery records the next generation and its receipt, and the delete removes it", async () => {
  const realNow = Date.now;
  try {
    await withWire({}, async () => {
      const S = await site("mut-landed-abort-fails");
      const sid = await S.replacement();
      // LANDED AT R2, HELD BEFORE ITS RECORD MOVED.
      const gap = barrier();
      gap.when = (j) => j && j.state === "live" && j.up === sid;
      S.hold.asset = gap;
      const zombie = S.complete(sid);
      await until(() => gap.hit, "the replacement's final record write");
      const t0 = realNow();
      Date.now = () => t0 + MEDIA_CLAIM_MS + 1000;
      S.bucket.failNext("abort", 1000);
      const d = await S.del();
      assert.equal(d.status, 200, "a landed replacement was held as unconfirmed: " + JSON.stringify(d.body));
      assert.deepEqual([S.record().state, S.record().gen], ["deleted", 2]);
      assert.equal(S.bucket.raw(S.key), null);
      assert.equal((await S.status(sid)).body.state, "removed");
      gap.open();
      await zombie;
      assert.equal(S.bucket.raw(S.key), null);
      assert.deepEqual(S.held(), {});
    });
  } finally { Date.now = realNow; }
});
