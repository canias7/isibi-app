// THE BUILD LANES — the decision, and the wiring it is worthless without.
//
// This feature is the wiring layer where this repo has recorded TWELVE features
// shipping dead. `buildLane` can be perfectly correct and reached by nothing, and
// the symptom would be exactly the state it exists to end: every build on the
// platform behind one container, with every test green. So half of this file
// asserts the module and half asserts that `worker.js` really hands the name over.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILD_LANES, buildLane, laneName } from "../builder/build-lane.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// Comments in this repo explain the thing they sit above, so they necessarily
// spell it — prose containing the thing it asserts is this file's most-recorded
// own-goal. Blanked LENGTH-PRESERVINGLY and by WHOLE LINE, so offsets stay valid
// and a line holding a URL is not eaten from its `//` onward.
function blankComments(src) {
  return src
    .split("\n")
    .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l))
    .join("\n");
}
const code = blankComments(worker);
assert.equal(code.length, worker.length, "the blanker must preserve length");

test("a lane is always in range, for every key shape", () => {
  const keys = ["", "a", "fold-lane-bakery", "x".repeat(400), "🙂", "../../etc", "0"];
  for (const k of keys) {
    const l = buildLane(k);
    assert.ok(Number.isInteger(l) && l >= 0 && l < BUILD_LANES, `${JSON.stringify(k)} -> ${l}`);
  }
});

test("the same key is always the same lane", () => {
  // This is what makes `oneAtATime` correct: two builds of one site must land on
  // one instance so the build server's own queue can serialise them. A lane that
  // wandered would put two edits of one site into two working directories.
  for (const k of ["fold-lane-bakery", "oak-and-ash", "helm"]) {
    assert.equal(buildLane(k), buildLane(k));
    assert.equal(laneName(k), laneName(k));
  }
});

test("ANAGRAMS SEPARATE — the reason this is FNV-1a and not a sum of char codes", () => {
  // A sum hashes "ab" and "ba" identically, so two slugs that are anagrams would
  // share a lane forever. This repo already paid for that lesson on the favicon
  // hue; the assertion is here so a "simpler" hash cannot come back.
  // ASKED OF THE HASH, NOT OF THE BUCKET. Over 5 lanes any two distinct hashes
  // collide about one time in five by arithmetic, so asserting on `buildLane`
  // at the real lane count measures luck rather than the hash — my own first
  // draft did exactly that and went red against correct code. A wide lane count
  // isolates the property being claimed.
  const WIDE = 1 << 16;
  const pairs = [["fold-lane", "lane-fold"], ["ab", "ba"], ["oak-ash", "ash-oak"]];
  for (const [a, b] of pairs) {
    // Prove the sum really cannot tell them apart, or the case is not the case.
    const sum = (s) => [...s].reduce((n, c) => n + c.charCodeAt(0), 0);
    assert.equal(sum(a), sum(b), `${a}/${b} are not anagrams`);
    assert.notEqual(buildLane(a, WIDE), buildLane(b, WIDE), `${a}/${b} hash alike`);
  }
});

test("KEYS SPREAD ACROSS EVERY LANE — a hash that answered one lane would be inert", () => {
  // Without this the whole feature can be satisfied by `return 0`, which reads as
  // lanes and behaves exactly like the singleton it replaces.
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(buildLane("site-" + i));
  assert.equal(seen.size, BUILD_LANES, `used ${seen.size} of ${BUILD_LANES} lanes`);
});

test("NOTHING UNUSABLE ANSWERS undefined — the one return value that restores the bug", () => {
  // `getContainer(binding, undefined)` takes the DEFAULT parameter and lands back
  // on `cf-singleton-container`. So an unusable key must answer a real lane, not
  // nothing — being wrong that way is silent and puts the whole platform back on
  // one instance with every test still green.
  for (const junk of [undefined, null, 0, false, [], {}, ["a", "b"], NaN]) {
    const n = laneName(junk);
    assert.equal(typeof n, "string");
    assert.ok(/^build-\d+$/.test(n), `${String(junk)} -> ${n}`);
  }
  // AND NOT COERCED: `String(["a","b"])` is `"a,b"`, the coercion this repo has
  // shipped as a real bug three times. An array is not a key and must not read as
  // whatever it stringifies to.
  //
  // AT A WIDE LANE COUNT, and that is what makes the check real rather than
  // lucky. Over 5 lanes a coerced `"a,b"` lands on lane 0 — the same lane the
  // empty key answers — about one time in five, and it did: the mutation that
  // replaces this line with `String(key)` SURVIVED the first sweep against the
  // narrow form. Asked at a width where a collision is negligible, the claim is
  // about the coercion rather than about the modulo.
  const WIDE = 1 << 16;
  const empty = buildLane("", WIDE);
  for (const junk of [["a", "b"], ["fold"], { toString: () => "fold" }, 12345, true]) {
    assert.equal(buildLane(junk, WIDE), empty, `${String(junk)} was coerced into a key`);
  }
});

test("a nonsense lane count degrades to one lane rather than throwing", () => {
  // Reached on the build path of every site, so refusing here turns a bad constant
  // into every build failing where falling back costs today's behaviour.
  for (const bad of [0, -1, 1.5, NaN, undefined, "5", null]) {
    const l = buildLane("anything", bad);
    assert.ok(Number.isInteger(l) && l >= 0, `${String(bad)} -> ${l}`);
  }
  assert.equal(buildLane("anything", 0), 0);
});

test("BUILD_LANES EQUALS max_instances IN wrangler.jsonc, for every container", () => {
  // The whole reason lanes are BUCKETED rather than keyed by slug is that what
  // Cloudflare does past `max_instances` is undocumented. Set BUILD_LANES higher
  // and that boundary is reachable again — the one thing the bucketing exists to
  // prevent. Set it lower and we pay for instances nothing can ever use.
  const raw = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
  assert.ok(Array.isArray(cfg.containers) && cfg.containers.length >= 2, "no containers declared");
  for (const c of cfg.containers) {
    assert.equal(c.max_instances, BUILD_LANES, `${c.class_name} declares ${c.max_instances}`);
  }
});

test("NO getContainer CALL MAY OMIT ITS NAME — the bug, restored, is one argument", () => {
  // Derived over every call rather than over the five that exist today. The
  // library's default is the literal `cf-singleton-container`, so a call site
  // written without a name is the whole platform on one instance again, silently.
  const calls = [...code.matchAll(/getContainer\(([^;]*?)\)\s*;/g)].map((m) => m[1]);
  assert.ok(calls.length >= 5, `found only ${calls.length} getContainer calls`);
  for (const args of calls) {
    assert.ok(args.includes(","), `getContainer(${args}) has no lane name`);
    assert.ok(/laneName\(/.test(args), `getContainer(${args}) does not go through laneName`);
  }
});

test("BOTH SITE CONTAINER CALLS ARE KEYED BY THE SLUG", () => {
  // The site is the unit of work: two sites compile at once, two edits of one site
  // share a lane so the build server's queue can serialise them.
  const site = [...code.matchAll(/getContainer\(env\.SITE_BUILD_CONTAINER,\s*([^)]*\))\s*\)/g)].map((m) => m[1]);
  assert.equal(site.length, 2, `expected 2 site container calls, found ${site.length}`);
  for (const a of site) assert.equal(a.trim(), "laneName(slug)");
});

test("THE GAME BUILD SERVER STILL SERIALISES — lanes make a collision rarer, not impossible", () => {
  // Found 2026-08-25: it wipes four SHARED directories per build and had no queue
  // at all, surviving only because every request resolved to one instance. Two
  // builds by ONE user still share a lane BY DESIGN, so the protection has to be
  // in the server rather than inferred from how requests arrive.
  const game = fs.readFileSync(new URL("../builder-game/build-server.mjs", import.meta.url), "utf8");
  const g = blankComments(game);
  assert.match(g, /function oneAtATime\(/, "the game build server has no oneAtATime");
  // It must WRAP the wipes, not merely exist beside them — a queue nothing enters
  // is the twelve-dead-features shape one file over.
  const wrap = g.indexOf("return oneAtATime(");
  const wipe = g.indexOf("wipeSrc();");
  assert.ok(wrap > 0 && wipe > wrap, `oneAtATime at ${wrap} does not enclose the wipe at ${wipe}`);
});

test("BOTH BUILD SERVERS KEEP THEIR QUEUE — removing it reopens the 2026-07-29 failure", () => {
  // A lane is one instance with one working directory. "Finishing the job" by
  // deleting the chain would put two builds into one `src/routes` on a path that
  // now LOOKS concurrent and is not.
  for (const f of ["../builder/build-server.mjs", "../builder-game/build-server.mjs"]) {
    const src = blankComments(fs.readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.match(src, /_chain\s*=\s*done\.then\(/, `${f} lost its queue`);
  }
});
