// What each model will accept, and the census that keeps the table honest.
//
// The table itself has no product consumer yet — that is the owner's call, know
// the number before spending it — so the whole value of this file is that it
// makes the table LOAD-BEARING on day one. Two properties do that:
//
//   1. a CENSUS derived from BUILD_MODELS in both directions, so a picker added
//      next month naming a fourth model fails by existing, and a model that
//      leaves the platform cannot leave a stale row behind;
//   2. the one assertion with teeth today — every ceiling this platform really
//      sends must fit inside the SMALLEST output limit any picker can reach.
//
// Without (1) the table is a note in a comment. Without (2) it is a fact nobody
// has ever compared against anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILD_MODELS,
  DEFAULT_PICKER,
  MODEL_LIMITS,
  contextWindow,
  maxOutputTokens,
  modelsFor,
} from "../builder/build-models.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// LINE COMMENTS FIRST, THEN BLOCK OPENERS AT THE START OF A LINE — the recorded
// order. Blanking blocks first turns any `//` containing `/*` into a false block
// that runs to the next real `*/`, which swallowed 71,729 characters of chat.js
// the last time it was done the naive way. Length-preserving, so every offset
// still means what it meant.
function blankComments(src) {
  let s = src.replace(/^([ \t]*)\/\/.*$/gm, (m, indent) => indent + " ".repeat(m.length - indent.length));
  s = s.replace(/^([ \t]*)\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "));
  return s;
}

// The files that could send a model request: the builder's modules, the Worker,
// and the root modules beside it. Derived from the tree rather than named, so a
// module added next month is scanned without anybody remembering to list it.
function shipSet() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "builder"))) {
    if (f.endsWith(".mjs")) out.push("builder/" + f);
  }
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith(".mjs")) out.push(f);
  }
  out.push("worker.js");
  return out.filter((p) => fs.existsSync(path.join(ROOT, p)));
}

// ── THE CENSUS ──────────────────────────────────────────────────────────────

// Every model id any picker can reach, derived from the real table. Never typed:
// a hand-written list here would be a second copy of BUILD_MODELS with nothing
// between the two, which is this repository's most repeated drift.
function modelsInUse() {
  const ids = new Set();
  for (const picker of Object.keys(BUILD_MODELS)) {
    for (const slot of Object.keys(BUILD_MODELS[picker])) {
      ids.add(BUILD_MODELS[picker][slot]);
    }
  }
  return ids;
}

test("every model a picker can reach has a limits entry", () => {
  const ids = [...modelsInUse()];

  // THE OBSERVER, PROVED ALIVE FIRST. A loop over an empty set passes every
  // assertion inside it, so the census must say what it scanned before it is
  // allowed to say nothing was missing.
  assert.ok(ids.length >= 2, "derived " + ids.length + " model ids from BUILD_MODELS — the reader is not walking the table");

  for (const id of ids) {
    assert.ok(
      Object.hasOwn(MODEL_LIMITS, id),
      "BUILD_MODELS can send " + id + " and MODEL_LIMITS has no entry for it — add its context window and output limit, read from the provider's own docs",
    );
  }
});

test("no limits entry names a model the platform cannot send", () => {
  const ids = modelsInUse();
  const rows = Object.keys(MODEL_LIMITS);
  assert.ok(rows.length >= 2, "MODEL_LIMITS holds " + rows.length + " rows");

  for (const id of rows) {
    assert.ok(
      ids.has(id),
      "MODEL_LIMITS carries " + id + " and no picker can reach it — a stale row is a number somebody will read as current",
    );
  }
});

test("every entry is a usable shape: a real context, and an output limit that is a number or Infinity", () => {
  for (const [id, row] of Object.entries(MODEL_LIMITS)) {
    assert.equal(typeof row.context, "number", id + ": context must be a number");
    assert.ok(Number.isFinite(row.context) && row.context > 0, id + ": context must be finite and positive, got " + row.context);

    assert.equal(typeof row.maxOutput, "number", id + ": maxOutput must be a number (Infinity counts)");
    assert.ok(row.maxOutput > 0, id + ": maxOutput must be positive, got " + row.maxOutput);
    // Never null: a row that exists has been looked up, so "we do not know" is
    // not one of the answers it may give. Not-knowing is the ABSENCE of a row.
    assert.notEqual(row.maxOutput, null, id + ": a present row may not say null — delete the row instead");
  }
});

// ── THE RESOLVERS ───────────────────────────────────────────────────────────

test("a known model answers its real number, through the resolver rather than the map", () => {
  for (const [id, row] of Object.entries(MODEL_LIMITS)) {
    assert.equal(contextWindow(id), row.context, id + ": contextWindow disagrees with the table");
    assert.equal(maxOutputTokens(id), row.maxOutput, id + ": maxOutputTokens disagrees with the table");
  }
});

test("an unknown model answers null, and null is never zero", () => {
  for (const asked of ["gpt-5", "claude-sonnet-4-5", "", "grok", "GROK-4.6"]) {
    assert.equal(contextWindow(asked), null, "contextWindow(" + JSON.stringify(asked) + ") must be null");
    assert.equal(maxOutputTokens(asked), null, "maxOutputTokens(" + JSON.stringify(asked) + ") must be null");
  }

  // THE POINT OF THE PREVIOUS ASSERTION, stated so it cannot be "fixed" by
  // returning 0. Zero means "no room", which would gate off a call to a healthy
  // model; not-knowing must fall through to sending the request.
  assert.notEqual(contextWindow("gpt-5"), 0, "an unknown model must not answer zero — zero reads as 'no room'");
  assert.notEqual(maxOutputTokens("gpt-5"), 0, "an unknown model must not answer zero");
});

test("a non-string and a prototype key are refused, never coerced", () => {
  // `String(["grok-4.6"])` is "grok-4.6", so coercion would let an array
  // resolve through a table that is meant to be an allow-list. Shipped as a real
  // bug three times in this codebase.
  for (const asked of [["grok-4.6"], 42, null, undefined, {}, true]) {
    assert.equal(contextWindow(asked), null, "contextWindow must refuse " + JSON.stringify(asked ?? String(asked)));
    assert.equal(maxOutputTokens(asked), null, "maxOutputTokens must refuse " + JSON.stringify(asked ?? String(asked)));
  }
  // `MODEL_LIMITS["constructor"]` is truthy on any plain object.
  for (const asked of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.equal(contextWindow(asked), null, asked + " must not resolve through the prototype");
    assert.equal(maxOutputTokens(asked), null, asked + " must not resolve through the prototype");
  }
});

test("THE THREE STATES STAY THREE: a cap, no stated cap, and not known", () => {
  // The whole reason `Infinity` is written rather than null. Two nulls meaning
  // opposite things is what put a wrong link on a live site once already.
  const stated = Object.entries(MODEL_LIMITS).filter(([, r]) => Number.isFinite(r.maxOutput));
  const uncapped = Object.entries(MODEL_LIMITS).filter(([, r]) => r.maxOutput === Infinity);

  assert.ok(stated.length >= 1, "no model states an output cap — the guard below has nothing to bound against");
  assert.ok(uncapped.length >= 1, "no model is recorded as uncapped; if that is now true, this case and the Infinity note in the module both need re-reading");

  for (const [id] of uncapped) {
    assert.notEqual(maxOutputTokens(id), null, id + " states no output cap and must answer Infinity, never null — null is reserved for a model we have no entry for");
    assert.equal(maxOutputTokens(id), Infinity, id + " must answer Infinity");
  }
  // And the two are genuinely distinguishable from outside, which is the
  // property a consumer depends on.
  assert.notEqual(Infinity, null);
});

test("the default picker's own models are all covered", () => {
  // Not redundant with the census: this is the path every customer takes by
  // default, and it is the one that must never be the uncovered one.
  const m = modelsFor(DEFAULT_PICKER);
  for (const slot of ["design", "pages", "quick"]) {
    assert.ok(m[slot], DEFAULT_PICKER + " has no " + slot + " model");
    assert.ok(
      Number.isFinite(contextWindow(m[slot])),
      "the default picker's " + slot + " model (" + m[slot] + ") has no known context window",
    );
  }
});

// ── THE ONE WITH TEETH: WHAT WE SEND MUST FIT ───────────────────────────────

// Every `max_tokens:` this platform really sends, derived from the source rather
// than from a list. Two shapes resolve statically — a bare number, and a named
// constant this repository exports — and anything computed is NAMED rather than
// dropped, because a ceiling that silently leaves the scan is exactly how this
// check would go quiet.
function sentCeilings() {
  const numeric = [];
  const named = new Map();
  const dynamic = new Set();
  const consts = new Map();
  let scanned = 0;

  for (const rel of shipSet()) {
    const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const src = blankComments(raw);
    scanned += 1;

    // `export const` AND a bare module-private `const`. The first draft required
    // the export and missed `SITE_SCHEMA_MAX_TOKENS`, which worker.js declares
    // privately and sends on the design call — a whole class of ceiling the
    // check would have claimed to cover and did not.
    for (const m of src.matchAll(/^(?:export )?const ([A-Z][A-Z0-9_]*) *= *(\d+)\s*;/gm)) {
      consts.set(m[1], Number(m[2]));
    }
    for (const m of src.matchAll(/max_tokens: *([^,\n}]+)/g)) {
      const expr = m[1].trim();
      if (/^\d+$/.test(expr)) numeric.push({ file: rel, value: Number(expr) });
      else if (/^[A-Z][A-Z0-9_]*$/.test(expr)) named.set(expr, rel);
      else dynamic.add(expr);
    }
  }
  return { numeric, named, dynamic, consts, scanned };
}

test("every ceiling this platform sends fits inside the smallest output limit a picker can reach", () => {
  const { numeric, named, consts, scanned } = sentCeilings();

  // The observer, alive, on both halves of the scan.
  assert.ok(scanned >= 20, "scanned only " + scanned + " files");
  assert.ok(numeric.length + named.size >= 8, "found only " + (numeric.length + named.size) + " resolvable max_tokens sites — the scan has stopped matching");

  // THE FLOOR IS DERIVED, NOT TYPED. The ceiling is chosen once and the picker
  // is chosen per request, so a ceiling has to fit the *smallest* limit any
  // customer can land on — not the limit of whichever model is default today.
  const limits = [...modelsInUse()].map((id) => maxOutputTokens(id));
  assert.ok(limits.every((v) => v !== null), "a model in use has no limits entry — the census above should have caught this first");
  const floor = Math.min(...limits);
  assert.ok(floor > 0, "the derived floor is " + floor);
  // AND IT MUST BE FINITE, which is what stops this whole check going vacuous.
  // One model is uncapped (Infinity); take the MAX of the set by mistake and the
  // floor becomes Infinity, every ceiling passes, and the assertion below says
  // nothing while still being green. It would also read this way for real if
  // every model in use became uncapped — in which case this check bounds nothing
  // and should be re-read rather than trusted.
  assert.ok(
    Number.isFinite(floor),
    "the derived floor is " + floor + " — no model in use states an output cap, so nothing below this line is being bounded",
  );

  for (const { file, value } of numeric) {
    assert.ok(value <= floor, file + " sends max_tokens: " + value + ", above the " + floor + " floor");
  }
  for (const [name, file] of named) {
    const value = consts.get(name);
    assert.ok(typeof value === "number", name + " is sent as max_tokens in " + file + " and its value could not be resolved");
    assert.ok(
      value <= floor,
      name + " is " + value + " and the smallest model a picker can reach accepts " + floor +
        " — a request above a model's own output limit is refused outright, and the picker is the customer's choice, not ours",
    );
  }
});

test("a computed ceiling is named, so a new one cannot slip past the check unseen", () => {
  const { dynamic } = sentCeilings();

  // These three cannot be resolved by reading, and each is bounded somewhere
  // the check above already reaches — verified rather than assumed:
  //   laneMaxTokens(field)  Math.min'd with LANE_EDIT_MAX_TOKENS by its own
  //                         module, so it can only ever REDUCE a checked number.
  //   maxTokens             the container's own parameter, fed from the Worker
  //                         by `maxTokens: SITE_SCHEMA_MAX_TOKENS`, which the
  //                         resolvable half checks.
  //   r.max_tokens          a caller's request echoed back on the xAI boundary.
  // Listed by name so a FOURTH computed ceiling fails here rather than quietly
  // reducing what the assertion above covers.
  const known = new Set(["laneMaxTokens(field)", "maxTokens", "r.max_tokens"]);
  for (const expr of dynamic) {
    assert.ok(
      known.has(expr),
      "a computed max_tokens appeared that this check cannot resolve: " + expr +
        " — either resolve it here or state where it is bounded",
    );
  }
  // Alive: if the scan stopped finding the computed sites, this case would pass
  // over anything.
  assert.ok(dynamic.size >= 2, "found " + dynamic.size + " computed max_tokens sites; the reader has stopped matching");
});

test("the blanker leaves the landmarks this file reads", () => {
  // A scan that REQUIRES a spelling must prove the blanking did not eat it —
  // the mirror of "prose contains the thing it forbids", and the reason a guard
  // once reported a section missing that was there all along.
  const src = blankComments(fs.readFileSync(path.join(ROOT, "builder/page-gen.mjs"), "utf8"));
  assert.match(src, /export const SITE_PAGES_MAX_TOKENS = \d+;/, "the blanker ate the page ceiling's declaration");
  assert.doesNotMatch(src, /THE PAGES CALL/, "the blanker is not blanking comments at all");
});
