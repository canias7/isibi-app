// NINE CLAIMS THAT WERE NOT WHAT THEY SAID — the build route's half.
//
// Every one of these is the same defect wearing a different hat: a message, a
// comment, or a computed field that says something other than what happened.
// None of them is a wrong ANSWER — the builds all worked — which is exactly why
// they survived an audit's worth of reading and needed guards rather than fixes
// alone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit } from "./fixtures/worker-harness.mjs";
import { siteHostFor } from "../site-domains.mjs";
import { buildSource } from "./fixtures/build-source.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The build's body. Anchored on the FUNCTION, never on a byte count and no
 *  longer on the route match either: the build moved out of `handleRequest` on
 *  2026-08-23 so a queue consumer could call it, and every guard here went red
 *  at once on a change where the body was proved byte-identical. One anchor,
 *  shared, with its own floor — see test/fixtures/build-source.mjs. */
const buildRoute = buildSource;

// The route refuses with 501 before it reads the body unless these look present.
// Values are irrelevant — every check is a truthiness test — and nothing that
// would use them runs, because the refusals under test come first.
const ENV = { NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "k", ANTHROPIC_API_KEY: "k" };
const AUTHED = { Authorization: "Bearer t", "content-type": "application/json" };

async function postBody(raw) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "u1", email: "a@b.c" }), { status: 200 });
    }
    throw new Error("the route reached the network: " + url);
  };
  try {
    return await hit("/api/site/react-build", { method: "POST", headers: AUTHED, body: raw, env: ENV });
  } finally { globalThis.fetch = real; }
}

test("a broken body says so, instead of 'no brief'", async () => {
  // `request.json().catch(() => ({}))` turned invalid JSON into an empty object,
  // which then failed a thousand lines later as `no brief` — a failure wearing
  // another failure's message. An integrator with a trailing comma was told the
  // one field they had definitely sent was missing.
  const broken = await postBody('{"brief": "a barber shop",}');
  assert.equal(broken.status, 400);
  assert.match(broken.json.error, /valid JSON/i, "a broken body still reports as a missing brief");

  // …and the empty-brief refusal is UNCHANGED, or this trades one wrong message
  // for another: a well-formed body with nothing in it really is a missing brief.
  const empty = await postBody("{}");
  assert.equal(empty.status, 400);
  assert.match(empty.json.error, /no brief/, "the genuine missing-brief case stopped saying so");
});

test("JSON that is not an object is refused rather than read through", async () => {
  // `null` and `[]` are both valid JSON and neither has a `.brief`; reading
  // through one is a TypeError rather than a 400.
  for (const raw of ["null", "[]", '"a brief"', "42"]) {
    const r = await postBody(raw);
    assert.equal(r.status, 400, raw);
    // The wording is `readJsonBody`'s now — that shared reader does the parse
    // and the shape check in one place, replacing this route's hand-rolled
    // pair. What matters is that the refusal SAYS the shape was wrong rather
    // than blaming a missing brief, not which of two synonyms it picks.
    assert.match(r.json.error, /JSON object|valid JSON|expected an object/i, raw + " -> " + r.text.slice(0, 120));
  }
});

test("ONE reading of which site this is", () => {
  // `editSlug` was trimmed and lowercased; the claim was ALSO stripped to
  // [a-z0-9-] and capped at 60 — so a body slug carrying a strippable character
  // read the edit state under one name and built under another. Silent: the
  // `_meta` read simply misses, `editState` stays null, and the designer is never
  // told to edit only what was asked.
  const seg = buildRoute();
  assert.match(seg, /const cleanSlug = \(v\) =>/, "the shared cleaner is gone");
  assert.match(seg, /const editSlug = cleanSlug\(/, "the edit-state read has its own cleaning again");
  assert.match(seg, /const slug = cleanSlug\(/, "the claim has its own cleaning again");
  // The property, not the spelling: nothing in this route strips slug characters
  // except that one expression.
  const strippers = seg.match(/\[\^a-z0-9-\]/g) || [];
  assert.equal(strippers.length, 1, `${strippers.length} slug-cleaning expressions in one route`);
});

/** The route's OWN `cleanSlug`, lifted and made callable.
 *
 *  Lifted rather than retyped because a second copy of this expression is the
 *  very thing the one-reading fix removed, and a test carrying its own would
 *  agree with itself while the route drifted. */
function liftCleanSlug() {
  const src = buildRoute().match(/const cleanSlug = \(v\) => [^;]+;/)[0];
  // eslint-disable-next-line no-new-func
  return new Function("return " + src.replace(/^const cleanSlug = /, "").replace(/;$/, ""))();
}

test("the shared cleaner refuses a non-string rather than coercing one", () => {
  // `String(["a","b"])` is `"a,b"`, which strips to a real slug nobody asked for
  // — the coercion bug already recorded for `normalizeRole` and for a table's
  // `access`. Driven through the route's own expression rather than a retyped
  // copy of it, since a second copy is the very thing this fix removed.
  const cleanSlug = liftCleanSlug();
  assert.equal(cleanSlug("Sharp Fade!"), "sharpfade");
  assert.equal(cleanSlug("x".repeat(80)).length, 60);
  assert.equal(cleanSlug(["a", "b"]), "", "an array was coerced into a slug");
  assert.equal(cleanSlug(7), "");
  assert.equal(cleanSlug(null), "");
});

test("every slug the route can claim is a legal DNS label", () => {
  // ONE RENDER MOUNT. `labelOk` refuses an edge hyphen, so `-shop` and `shop-`
  // — both of which `[a-z0-9-]` happily permits — got no pretty host and could
  // only ever be served at `/s/<slug>/`. Two mounts is what forces the bundle
  // to derive its basepath at runtime, and anything that bakes one in can serve
  // exactly one of them.
  //
  // DERIVED FROM BOTH ENDS: the route's own cleaner against the real
  // `siteHostFor`, so neither side can be corrected without the other. Asserting
  // the regex in `worker.js` instead would restate the fix and say nothing about
  // whether the two files agree — which is the whole property.
  const cleanSlug = liftCleanSlug();
  const raws = [
    "-shop", "shop-", "-shop-", "--shop--", "  -Sharp Fade- ", "-",
    // Truncation is what makes the ORDER load-bearing: 62 characters slice to
    // 60 and land on a hyphen, so a trim applied before the slice leaves
    // exactly the label being refused.
    "a".repeat(59) + "-bc",
    "-" + "a".repeat(70),
    "forno-and-co", "wassup", "sharp-fade-2",
  ];
  for (const raw of raws) {
    const slug = cleanSlug(raw);
    if (!slug) continue; // an empty slug claims nothing; the route refuses it
    assert.ok(
      siteHostFor(slug),
      `cleanSlug(${JSON.stringify(raw)}) = ${JSON.stringify(slug)}, which has no pretty host`,
    );
  }
  // The corpus has to be able to fail, or every case above passing proves only
  // that the loop ran. `siteHostFor` really does refuse the shape being trimmed.
  assert.equal(siteHostFor("-shop"), null, "siteHostFor stopped refusing an edge hyphen");
});

test("what the pages call BILLED is on the response, not only what we took", () => {
  // `publishPages` computes `billed` precisely so "the shortfall stays visible
  // instead of vanishing" — and the route dropped it, so a build that billed 21
  // and collected 4 reported `cost: 4, charged: true` with the gap readable by
  // nobody. `use_credits` is a gate rather than a till, so that shortfall is the
  // ORDINARY outcome on a low-balance account.
  const seg = buildRoute();
  assert.match(seg, /pagesBilled:/, "the shortfall is invisible on the response again");
  // Omitted when it agrees, so an ordinary build's response is byte-identical
  // and the field's PRESENCE is the signal.
  assert.match(seg, /pages\.billed !== pages\.cost/, "pagesBilled is reported unconditionally");
});

test("a refund that did not land is reported", () => {
  // `creditBack` swallowed both a throw and a refusal, so a failed reversal was
  // indistinguishable from a successful one — the customer stays charged up to
  // the whole fee more than `schemaCost` says, invisibly.
  const seg = buildRoute();
  assert.match(seg, /refundShort/, "a failed reversal is silent again");
  assert.match(seg, /if \(!await creditBack\(/, "the reversal's answer is discarded again");
});

test("refundFields READS the answer — the reporting line is reachable", () => {
  // THE ASSERTION ABOVE IS A PRESENCE, AND A PRESENCE IS NOT ENOUGH HERE.
  // Found by mutation: rewriting `refundFields`' decision from
  //   if (await refundCredits(...)) return { cost: 0 };
  // to a bare `await refundCredits(...); return { cost: 0 };` survived all
  // 3,790 tests — `refundShort` is still in the file, just unreachable, so a
  // regex looking for the word passes while every refusal answers `cost: 0`
  // whether or not the customer's credits came back. That is the exact audit
  // finding restored, on the money path, invisibly.
  const at = WORKER.indexOf("const refundFields = async (amount)");
  assert.ok(at > 0, "refundFields moved — rescope this");
  const body = WORKER.slice(at, WORKER.indexOf("\n      };", at));
  assert.ok(body.length > 100, "the refundFields window is empty — rescope this");

  // THE PROPERTY: the ledger call's answer is read, never discarded. Asserted
  // over EVERY call in the body rather than pinning one spelling, so a second
  // reversal added here has to read its answer too.
  const calls = [...body.matchAll(/await refundCredits\(/g)];
  assert.ok(calls.length >= 1, "refundFields no longer reverses anything");
  for (const m of calls) {
    const before = body.slice(Math.max(0, m.index - 12), m.index);
    assert.match(before, /if \(!?$/,
      "refundFields discards the ledger's answer — a failed reversal reports as a successful one");
  }

  // AND THE FAILURE ARM STILL COSTS SOMETHING. `cost` is what LEFT the ledger,
  // so a reversal that did not land must not report 0 — that is the number the
  // customer reads and the one the shortfall hides behind.
  assert.match(body, /return \{ cost: n, refundShort: true \}/,
    "a failed reversal no longer reports what the customer is still charged");
});

test("creditBack reports rather than swallowing, and logs either way", () => {
  const at = WORKER.indexOf("async function creditBack(");
  assert.ok(at > 0, "creditBack moved — rescope this");
  const body = WORKER.slice(at, WORKER.indexOf("\n}", at));
  assert.ok(body.length > 200, "the creditBack window is empty — rescope this");
  // Both failure shapes: a non-ok response and a throw. Before this, neither was
  // distinguishable from success at any of the thirteen call sites.
  assert.match(body, /if \(!r\.ok\)/, "a refused reversal reads as a successful one");
  assert.equal((body.match(/console\.error/g) || []).length, 2,
    "a failed reversal leaves no trace anywhere");
  // EVERY exit answers, and a bare `return` is the shape that reintroduces the
  // bug: `undefined` is falsy, so a caller reading the answer would report a
  // successful refund as a failed one — the same collapse pointed the other way.
  const returns = [...body.matchAll(/return\s*([^;]*);/g)].map((m) => m[1].trim());
  assert.ok(returns.length >= 4, `only ${returns.length} returns found — the scan stopped matching`);
  for (const r of returns) {
    assert.ok(r === "true" || r === "false", "creditBack has an exit that answers `" + r + "`");
  }
  assert.ok(returns.includes("true") && returns.includes("false"), "creditBack can only ever answer one way");
});

test("the schema-cost comment no longer claims the three fields agree", () => {
  // They do not, on a COMMON path: `schemaCredits` prices `schemaUsage` alone
  // while `schemaCost` settles against `pageCredits(schemaUsage, seedUsage)`, so
  // every build where the seed top-up fired shows a divergence with everything
  // working. A diagnostic claim that is false on a common path is the class this
  // repo documents as dangerous — the direction still discriminates and the
  // comment now says which is which.
  const seg = buildRoute();
  const at = seg.indexOf("schemaUsage: schemaUsage || undefined");
  assert.ok(at > 0, "the schema fields moved — rescope this");
  const note = seg.slice(seg.lastIndexOf("// THE SCHEMA CALL'S REAL COST", at), at);
  assert.ok(note.length > 400, "the schema-cost note is gone — rescope this");
  assert.match(note, /seedUsage/, "the note does not mention the seed call, which is what makes them differ");
  assert.doesNotMatch(note, /They agree today/, "the stale claim is back");

  // …AND THE DIFFERENCE IS ACCOUNTABLE. Explaining the divergence in a comment
  // is only half of it: the response states a difference between two numbers and
  // has to carry the third that accounts for it, or an operator reconstructs the
  // seed call's cost from the trace's token counts by hand.
  assert.match(seg, /seedUsage: seedUsage \|\| undefined/,
    "the top-up's cost is not itemised, so the schemaCost/schemaCredits gap cannot be accounted for");
});

test("the photograph clamps are told apart at the point they are applied", () => {
  // The module can only say the right sentence if the caller tells it which
  // clamp bound. `full` and `empty` were both computable and neither was carried
  // — `planImages` has returned `empty` since it was written and no caller had
  // ever read it.
  const at = WORKER.indexOf("async function buySitePhotos(");
  assert.ok(at > 0, "buySitePhotos moved — rescope this");
  const body = WORKER.slice(at, WORKER.indexOf("\n}\n", at));
  assert.ok(body.length > 1500, "the buySitePhotos window is small — rescope this");
  assert.match(body, /libraryFull = affordable === 0 && libraryRoom === 0 && afterCredits > 0/,
    "the library clamp is indistinguishable from the credit clamp again");
  assert.match(body, /plan\.empty \? \{ empty: plan\.empty \}/, "the empty-token count is dropped again");
  assert.match(body, /libraryFull \? \{ full: true \}/, "the library clamp is dropped again");
  // An unreadable listing must leave it null, or "your library is full" is said
  // on a build where we could not look.
  assert.match(body, /let libraryRoom = null;/, "an unreadable listing now reads as a full library");
});
