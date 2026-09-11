// TYPING IN THE START BOX IS A FRESH BUILD, NEVER A REVISE (2026-09-11, owner:
// "if i type in this chatbox its gotta be a fresh build no matter what, unless i
// select a site").
//
// MEASURED: `saltmarsh-kayak-co`'s second attempt, typed fresh into that box,
// recorded `bands:revise` and went out as ONE page call against the placeholder
// its own first attempt had left behind. The chain:
//
//   1. a build CLAIMS ITS SLUG BEFORE IT GENERATES, so a failed build leaves the
//      name held;
//   2. the designer picked the same name from the same brief;
//   3. the ownership check read a row owned by this account and set
//      `existing = true`, which is `revise: true` and `priorPages: <the
//      placeholder's source>`;
//   4. `planRefusal`'s first line refuses to split a revise.
//
// So the build that most wants splitting — a brand new site — could never get
// it, purely because its own earlier attempt had failed.
//
// WHAT IS DRIVEN AND WHAT IS READ. `freeSlugFor` is cut out of worker.js and RUN
// against a stubbed lookup. The three-way decision at the slug is READ, because
// `test/credit-debit.test.mjs`'s route harness makes the DESIGN CALL THROW in
// order to reach the design catch — so nothing in this repo can drive a route
// past the point where the designer names the site. That limit is stated rather
// than papered over.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const blankJs = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));

/** Cut one `[async ]function name(...) { … }` out of a source by brace depth. */
function fnSource(src, name) {
  let at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is not declared — rescope this guard");
  if (src.slice(Math.max(0, at - 6), at) === "async ") at -= 6;
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  assert.fail(name + " never closes");
}

/**
 * The real `freeSlugFor`, with the lookup stubbed.
 *
 * `held` maps a slug to the uid holding it; anything absent is free. A slug
 * whose value is the string "throw" makes the lookup throw, which is how the
 * cannot-tell case is reached.
 */
function loadFree(held) {
  const tries = /const MAX_SLUG_TRIES = (\d+);/.exec(WORKER);
  assert.ok(tries, "MAX_SLUG_TRIES moved — rescope this guard");
  const reads = [];
  const fn = new Function("siteBackendRowFresh", "console", "reads", [
    "const MAX_SLUG_TRIES = " + tries[1] + ";",
    fnSource(WORKER, "freeSlugFor"),
    "return freeSlugFor;",
  ].join("\n"))(async (env, slug) => {
    reads.push(slug);
    const uid = held[slug];
    if (uid === "throw") throw new Error("lookup failed");
    return uid ? { conn: null, uid, brief: "" } : null;
  }, { error: () => {} }, reads);
  return { freeSlugFor: fn, reads, max: Number(tries[1]) };
}

const ME = "u1";

test("a name nobody holds comes back exactly as the designer chose it", async () => {
  const { freeSlugFor, reads } = loadFree({});
  assert.equal(await freeSlugFor({}, "saltmarsh-kayak-co", ME), "saltmarsh-kayak-co");
  // ONE READ. A fresh name is every ordinary build, so this must not become a
  // walk up the numbers on the overwhelmingly common case.
  assert.deepEqual(reads, ["saltmarsh-kayak-co"]);
});

test("a name a STRANGER holds is not moved off — that refusal is the customer's answer", async () => {
  // Silently building under a different name would answer a name the customer
  // can see with one they did not choose, and the ownership check's 409 says so
  // properly ("that name is taken by another account… say a different name").
  const { freeSlugFor } = loadFree({ "kestrel-bindery": "someone-else" });
  assert.equal(await freeSlugFor({}, "kestrel-bindery", ME), "kestrel-bindery");
});

test("a name THIS ACCOUNT holds moves to the next free one — the whole fix", async () => {
  const { freeSlugFor, reads } = loadFree({ "saltmarsh-kayak-co": ME });
  assert.equal(await freeSlugFor({}, "saltmarsh-kayak-co", ME), "saltmarsh-kayak-co-2");
  assert.deepEqual(reads, ["saltmarsh-kayak-co", "saltmarsh-kayak-co-2"]);

  // …and keeps walking past the ones that are also taken, whoever holds them: a
  // name a stranger has is not free for us either.
  const two = loadFree({ "a-shop": ME, "a-shop-2": ME, "a-shop-3": "someone-else" });
  assert.equal(await two.freeSlugFor({}, "a-shop", ME), "a-shop-4");
});

test("a trailing number is REPLACED, not stacked", async () => {
  // `fretwork-1-2` is the shape nothing on this platform has; `fretwork-2` is
  // the shape everything has.
  const { freeSlugFor } = loadFree({ "fretwork-1": ME });
  assert.equal(await freeSlugFor({}, "fretwork-1", ME), "fretwork-2");

  // AND THE NAME ITSELF IS NEVER OFFERED BACK as a candidate: stripping
  // `coalhole-2` gives the base `coalhole`, whose second candidate IS
  // `coalhole-2` — the name we already know is taken.
  const c = loadFree({ "coalhole-2": ME });
  assert.equal(await c.freeSlugFor({}, "coalhole-2", ME), "coalhole-3");
  assert.ok(!c.reads.slice(1).includes("coalhole-2"), "it read the taken name a second time");
});

test("a lookup that cannot answer keeps the name, rather than inventing one", async () => {
  // Cannot-tell must never read as "taken". Wrong that way makes a SECOND paid
  // site off a blip; wrong the other way is exactly today's behaviour.
  const first = loadFree({ "a-shop": "throw" });
  assert.equal(await first.freeSlugFor({}, "a-shop", ME), "a-shop");
  // And a blip PART WAY UP the walk answers the original too, rather than
  // stopping on a candidate it never confirmed was free.
  const mid = loadFree({ "a-shop": ME, "a-shop-2": ME, "a-shop-3": "throw" });
  assert.equal(await mid.freeSlugFor({}, "a-shop", ME), "a-shop");
});

test("the walk is bounded, and giving up is today's behaviour rather than a worse one", async () => {
  const held = { "a-shop": ME };
  const { max } = loadFree({});
  for (let n = 2; n <= max; n++) held["a-shop-" + n] = ME;
  const { freeSlugFor, reads } = loadFree(held);
  assert.equal(await freeSlugFor({}, "a-shop", ME), "a-shop",
    "an account holding every candidate should fall back to the designer's own name");
  assert.equal(reads.length, max, "the walk is not bounded by MAX_SLUG_TRIES");
});

/* ───────────────────────────── the wiring, read ──────────────────────────── */

test("the chat lookup's OTHER answer is kept, and only the certain one counts", () => {
  const w = blankJs(WORKER);
  // `=== null` and never truthiness: `undefined` is a lookup that could not
  // answer, and reading it as "no site" makes a second paid site off a blip.
  assert.match(w, /chatOwnsNoSite = mine === null;/,
    "the chat's no-site answer is inferred rather than read, or thrown away again");
  assert.match(w, /let chatOwnsNoSite = false;/, "it does not default to the safe side");
});

test("the free name is asked for only when the designer chose it and the chat owns no site", () => {
  const w = blankJs(WORKER);
  assert.match(w, /const slug = namedSlug \? wantedSlug\s*\n\s*: \(chatOwnsNoSite \? await freeSlugFor\(env, wantedSlug, bu\.id\) : wantedSlug\);/,
    "the three-way decision at the slug moved — a customer's own name must never be moved off");
});

test("the name is settled BEFORE the job's token is re-minted for it", () => {
  // `env.JOB_SCOPE(slug)` re-scopes a container job's credentials to this name.
  // A name chosen after it leaves the job scoped to a slug it is not building —
  // which is not a subtle failure, but it IS one nothing else would catch.
  const w = blankJs(WORKER);
  const at = w.indexOf("const slug = namedSlug ? wantedSlug");
  const scope = w.indexOf("await env.JOB_SCOPE(slug)", at);
  assert.ok(at > 0 && scope > at, "the slug is no longer settled before JOB_SCOPE re-mints for it");
  // AND NOTHING AFTER IT READS THE UN-MOVED NAME. `wantedSlug` exists only to
  // be chosen between; every reader below wants the name that was settled. The
  // LAST occurrence is the test, because the three inside the decision itself
  // are the decision.
  assert.ok(w.lastIndexOf("wantedSlug") < scope,
    "something after the name is settled still reads the designer's un-moved choice");
});

test("the ownership check still refuses a stranger's name, and still reads a revise", () => {
  // THE CONTROL. This change must not weaken either of the two things that
  // check already does — otherwise "always a fresh build" would quietly become
  // "builds over other people's sites".
  const w = blankJs(WORKER);
  assert.match(w, /if \(owner && owner\.uid && owner\.uid !== bu\.id\) \{/, "the stranger refusal is gone");
  assert.match(w, /existing = !!\(owner && owner\.uid\);/, "the revise reading is gone");
});
