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

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The build route's body, to the response literal. Anchored on landmarks, never
 *  on a byte count — a well-commented insertion is what has repeatedly walked a
 *  fixed-size window off the thing it was written to guard. */
function buildRoute() {
  const at = WORKER.indexOf('url.pathname === "/api/site/react-build"');
  assert.ok(at > 0, "the build route moved — rescope this");
  const end = WORKER.indexOf("GET /api/site/<slug>/rows", at);
  assert.ok(end > at, "the end landmark moved — rescope this");
  const seg = WORKER.slice(at, end);
  assert.ok(seg.length > 20_000, "the build-route window is suspiciously small — rescope this");
  return seg;
}

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
    assert.match(r.json.error, /JSON object|valid JSON/i, raw + " -> " + r.text.slice(0, 120));
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

test("the shared cleaner refuses a non-string rather than coercing one", () => {
  // `String(["a","b"])` is `"a,b"`, which strips to a real slug nobody asked for
  // — the coercion bug already recorded for `normalizeRole` and for a table's
  // `access`. Driven through the route's own expression rather than a retyped
  // copy of it, since a second copy is the very thing this fix removed.
  const seg = buildRoute();
  const src = seg.match(/const cleanSlug = \(v\) => [^;]+;/)[0];
  // eslint-disable-next-line no-new-func
  const cleanSlug = new Function("return " + src.replace(/^const cleanSlug = /, "").replace(/;$/, ""))();
  assert.equal(cleanSlug("Sharp Fade!"), "sharpfade");
  assert.equal(cleanSlug("x".repeat(80)).length, 60);
  assert.equal(cleanSlug(["a", "b"]), "", "an array was coerced into a slug");
  assert.equal(cleanSlug(7), "");
  assert.equal(cleanSlug(null), "");
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
