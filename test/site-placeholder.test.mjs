// THE STAND-IN AND ITS REMOVAL, DRIVEN — one writes the page, the other takes
// it back down, and both are run against a fake bucket rather than read.
//
// THE FAILURE THIS IS WRITTEN AFTER. `publishPlaceholder` writes
// `sites/<slug>/index.html`, and under Start a dist contains no top-level
// document — so a real publish never overwrites that key and the stand-in
// survived its own success. What that cost is a SOFT 404: the platform's
// extensionless fall-through reads exactly that key for any address the site does
// not have, finds the stand-in, and answers 200 with it. Measured on run 36 —
// `/deals` and `/sign-in` both 200 with the 856-byte stand-in on a site that
// published four real routes — against `oak-and-ash`, built before the early
// write existed, correctly answering 404.
//
// DRIVEN RATHER THAN SOURCE-READ, and that is not a preference here: the removal
// is a DELETE of a document at a customer's own public address, and the one
// mistake that matters — deleting a real page — is a fact about what the guard
// does with bytes, which no regex over the file can see. The fixture is produced
// by the REAL writer, so the two halves cannot agree with each other and with
// neither end (the `routeOf` lesson).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { loadWorkerModule } from "./fixtures/worker-harness.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const KEY = (slug) => "sites/" + slug + "/index.html";
const SPEC = { tables: [] };

/**
 * The mark, taken from `worker.js` rather than restated.
 *
 * A test carrying its own copy of the tag would go on passing while the two
 * halves in the Worker drifted apart, which is the exact failure the shared
 * constant exists to make impossible.
 */
function markFromSource() {
  const m = WORKER.match(/const PLACEHOLDER_MARK = "([^"]+)"/);
  assert.ok(m, "worker.js no longer declares PLACEHOLDER_MARK");
  return 'name="' + m[1] + '" content="placeholder"';
}

/** A bucket that records, and can be told to fail on any one verb. */
function bucket(seed = {}, fail = null) {
  const store = new Map(Object.entries(seed));
  const seen = { get: 0, put: 0, del: [], head: 0 };
  return {
    store, seen,
    async head(k) { seen.head++; if (fail === "head") throw new Error("R2 down"); return store.has(k) ? {} : null; },
    async get(k) {
      seen.get++;
      if (fail === "get") throw new Error("R2 down");
      const v = store.get(k);
      return v === undefined ? null : { text: async () => v };
    },
    async put(k, v) { seen.put++; if (fail === "put") throw new Error("R2 down"); store.set(k, v); },
    async delete(k) { seen.del.push(k); if (fail === "delete") throw new Error("R2 down"); store.delete(k); },
  };
}

async function pair() {
  const m = await loadWorkerModule();
  assert.equal(typeof m.publishPlaceholder, "function", "publishPlaceholder is not exported — nothing can drive it");
  assert.equal(typeof m.clearPlaceholder, "function", "clearPlaceholder is not exported — nothing can drive it");
  return m;
}

test("THE PAIR ROUND-TRIPS — what the writer wrote, the clearer removes", async () => {
  const { publishPlaceholder, clearPlaceholder } = await pair();
  const SITES_BUCKET = bucket();

  assert.equal(await publishPlaceholder({ SITES_BUCKET }, "shop", "Fold Coffee", SPEC, { building: true }), true);
  const html = SITES_BUCKET.store.get(KEY("shop"));
  assert.ok(html, "the stand-in was not written where the fall-through reads it");
  // THE MARK IS REALLY IN THE BYTES. Asserting the source emits it says nothing
  // about what a browser — or `build as owner`'s watch — is handed.
  assert.ok(html.includes(markFromSource()), "the published stand-in carries no mark");

  assert.equal(await clearPlaceholder({ SITES_BUCKET }, "shop"), true);
  assert.equal(SITES_BUCKET.store.has(KEY("shop")), false, "the stand-in survived its own publish");
  assert.deepEqual(SITES_BUCKET.seen.del, [KEY("shop")], "it deleted something other than the stand-in");
});

test("A REAL DOCUMENT AT THAT KEY IS LEFT ALONE — the guard is the MARK, not the key", async () => {
  // A site published before Start has a REAL `index.html` under that name; the
  // version archive still holds them and `rollbackVersion` restores them through
  // the same writer. Deleting by key would take a working home page down.
  const { clearPlaceholder } = await pair();
  const real = "<!doctype html><title>Fold Coffee</title><div id=\"root\">the site</div>";
  const SITES_BUCKET = bucket({ [KEY("shop")]: real });

  assert.equal(await clearPlaceholder({ SITES_BUCKET }, "shop"), false);
  assert.equal(SITES_BUCKET.store.get(KEY("shop")), real, "a real home page was deleted");
  assert.deepEqual(SITES_BUCKET.seen.del, [], "it deleted a document it had no business touching");
});

test("A DOCUMENT CLAIMING THE MARK'S NAME WITH ANOTHER VALUE IS NOT A STAND-IN", async () => {
  // The whole tag is the guard, not the name half of it. A page that named
  // itself with the same meta and a different content value is something else,
  // and this is the read that would delete it if only the name were matched.
  const { clearPlaceholder } = await pair();
  const m = WORKER.match(/const PLACEHOLDER_MARK = "([^"]+)"/);
  const impostor = "<!doctype html><meta name=\"" + m[1] + "\" content=\"app\"><h1>the real site</h1>";
  const SITES_BUCKET = bucket({ [KEY("shop")]: impostor });

  assert.equal(await clearPlaceholder({ SITES_BUCKET }, "shop"), false);
  assert.equal(SITES_BUCKET.store.get(KEY("shop")), impostor);
});

test("NOTHING THERE IS NOT A FAILURE, and it deletes nothing", async () => {
  // The ordinary case on every site published before the early write existed,
  // and on every second and later publish of every site since.
  const { clearPlaceholder } = await pair();
  const SITES_BUCKET = bucket();
  assert.equal(await clearPlaceholder({ SITES_BUCKET }, "shop"), false);
  assert.deepEqual(SITES_BUCKET.seen.del, []);
});

test("IT NEVER THROWS — a publish that already succeeded must not be lost to a stale stand-in", async () => {
  // `publishPlaceholder`'s rule inverted. This runs AFTER the site is published,
  // so every failure here costs a stand-in that the next publish sweeps and must
  // never cost the response. Both verbs are driven, because a read that throws
  // and a delete that throws are different lines.
  const { clearPlaceholder } = await pair();
  for (const verb of ["get", "delete"]) {
    const SITES_BUCKET = bucket({ [KEY("shop")]: "<meta " + markFromSource() + ">" }, verb);
    assert.equal(await clearPlaceholder({ SITES_BUCKET }, "shop"), false, verb + " threw past the catch");
  }
  // And with no bucket bound at all — the shape a deployment without R2 has.
  assert.equal(await clearPlaceholder({}, "shop"), false);
  assert.equal(await clearPlaceholder({ SITES_BUCKET: bucket() }, ""), false);
});

test("IT IS CALLED, AND ONLY WHERE THE SCRIPT REALLY LANDED", () => {
  // THE WIRING LAYER, which is where twelve features in this repo have shipped
  // dead. `clearPlaceholder` can be perfectly correct and reached by nothing, and
  // the only symptom is a soft 404 nobody connects to a publish.
  //
  // Comments blanked first: the prose above the call argues for it at length and
  // therefore spells it, which is this repo's most-recorded own-goal.
  const bare = WORKER.split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
  assert.equal(bare.length, WORKER.length, "the blanker must preserve length");

  const calls = [...bare.matchAll(/await clearPlaceholder\(env, slug\)/g)];
  assert.equal(calls.length, 1, "the stand-in is cleared from somewhere other than its one call site");

  // IN `putSiteWorker`, AND AFTER THE UPLOAD'S OWN REFUSALS. Under Start the
  // script is the ONLY thing that renders a document, so a publish whose script
  // did not land leaves a site with no page at any address — and that build still
  // answers `ok:true, page:"app"`. Clearing there would take the customer's one
  // remaining page away on exactly the build that needed it.
  const fn = bare.slice(bare.indexOf("async function putSiteWorker("));
  const end = fn.slice(1).search(/\n(?:\/\*\*|(?:export )?(?:async )?function )/);
  const body = fn.slice(0, end > 0 ? end + 1 : fn.length);
  assert.ok(body.includes("await clearPlaceholder(env, slug)"),
    "the clear is no longer inside putSiteWorker, so it cannot know the script landed");

  const bail = body.indexOf("if (!r.ok) {");
  const clear = body.indexOf("await clearPlaceholder(env, slug)");
  assert.ok(bail > 0, "putSiteWorker's upload refusal is gone — re-anchor this");
  assert.ok(clear > bail, "the stand-in is cleared before the upload is known to have succeeded");

  // AND THE EARLY RETURNS ARE STILL EARLY. Both refusals above it return, so a
  // failed upload cannot reach this line — asserted rather than assumed, because
  // turning either into a fall-through is the edit that silently breaks it.
  assert.ok(/return \{ ok: false, stage: "pack"/.test(body.slice(0, clear)),
    "the packaging refusal no longer returns before the clear");
  assert.ok(/return r;/.test(body.slice(bail, clear)), "the upload refusal no longer returns before the clear");
});

test("THE TAG IS ONE CONSTANT — the writer and the reader cannot disagree", () => {
  // Two spellings drifting apart here does not read as "the mark stopped being
  // recognised". It reads as a publish that stops taking its own stand-in down,
  // on every site, with nothing anywhere saying so.
  const bare = WORKER.split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
  assert.equal([...bare.matchAll(/content=\\"placeholder/g)].length, 1,
    "the placeholder tag is spelled in more than one place");
  assert.equal([...bare.matchAll(/\bPLACEHOLDER_META\b/g)].length, 3,
    "PLACEHOLDER_META is declared, emitted and read — one of the three has gone");
});
