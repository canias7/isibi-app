// ONE CONTAINER PER UNIT OF WORK — the decision, and the wiring it is worthless
// without.
//
// This feature is the wiring layer where this repo has recorded TWELVE features
// shipping dead. `laneName` can be perfectly correct and reached by nothing, and
// the symptom would be exactly the state it exists to end: every build on the
// platform behind one container, with every test green. So half of this file
// asserts the module and half asserts that `worker.js` really hands the name over.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { keyHash, laneName } from "../builder/build-lane.mjs";

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

test("TWO DIFFERENT KEYS GET TWO DIFFERENT CONTAINERS — the whole point", () => {
  // This is the property the five-lane bucketing did NOT have: over 5 lanes two
  // simultaneous builds collided about one time in five, and a collision meant
  // waiting out the ten-minute build in front. Asserted over a wide sample
  // rather than a pair, because "these two differ" is satisfied by a hash that
  // is right almost never.
  const names = new Set();
  for (let i = 0; i < 500; i++) names.add(laneName("site-" + i));
  assert.equal(names.size, 500, `500 distinct sites produced ${names.size} distinct containers`);
  // …including keys that are NOT plain identifiers and therefore take the hashed
  // branch, where a collision would be silent rather than obvious.
  const hashed = new Set();
  for (let i = 0; i < 500; i++) hashed.add(laneName("Site With Spaces " + i));
  assert.equal(hashed.size, 500, `500 hashed keys produced ${hashed.size} distinct containers`);
});

test("THE TWO BRANCHES CANNOT COLLIDE WITH EACH OTHER", () => {
  // Without the `k-`/`h-` marker a plain key beginning `h` could land on a
  // hashed name, and two different sites would silently share one container and
  // one working directory — the 2026-07-29 failure, restored invisibly.
  const plain = new Set();
  const hashed = new Set();
  for (let i = 0; i < 300; i++) {
    plain.add(laneName("h" + i));            // legal plain key, starts with h
    hashed.add(laneName("H" + i + " x"));    // forced down the hash branch
  }
  for (const p of plain) assert.ok(!hashed.has(p), `a plain key collided with a hashed one: ${p}`);
});

test("the same key is always the same container", () => {
  // This is what makes `oneAtATime` correct for two builds of one site: they
  // must land on ONE instance so the build server's own queue can serialise
  // them. A name that wandered would put two edits of one site into two working
  // directories.
  for (const k of ["fold-lane-bakery", "oak-and-ash", "helm", "Some Odd Key!"]) {
    assert.equal(laneName(k), laneName(k));
  }
});

test("ANAGRAMS SEPARATE — the reason this is FNV-1a and not a sum of char codes", () => {
  // A sum hashes "ab" and "ba" identically, so two slugs that are anagrams would
  // share a container forever. This repo already paid for that lesson on the
  // favicon hue; the assertion is here so a "simpler" hash cannot come back.
  //
  // ASKED OF THE HASH, NOT OF THE NAME. Anagram slugs are plain keys, so they
  // take the `k-` branch and differ trivially — asserting on `laneName` would
  // pass whatever the hash did, which is the vacuous version of this check.
  const pairs = [["fold-lane", "lane-fold"], ["ab", "ba"], ["oak-ash", "ash-oak"]];
  for (const [a, b] of pairs) {
    const sum = (s) => [...s].reduce((n, c) => n + c.charCodeAt(0), 0);
    assert.equal(sum(a), sum(b), `${a}/${b} are not anagrams`);
    assert.notEqual(keyHash(a), keyHash(b), `${a}/${b} hash alike`);
  }
  // AND THE HASH REFUSES A NON-STRING ON ITS OWN, not by leaning on `laneName`'s
  // check one call up. `keyHash` is exported so a caller can ask it directly, and
  // a mutant coercing here survived the whole suite: every coercion case reached
  // it through `laneName`, which had already turned the junk into "". So the
  // guard inside `keyHash` was held by nothing.
  const zero = keyHash("");
  for (const junk of [["a", "b"], ["fold"], { toString: () => "fold" }, 12345, true, null, undefined]) {
    assert.equal(keyHash(junk), zero, `keyHash coerced ${String(junk)} into a key`);
  }
  assert.notEqual(keyHash("fold"), zero, "the empty hash is not distinguishable from a real one");
});

test("NOTHING UNUSABLE ANSWERS undefined — the one return value that restores the bug", () => {
  // `getContainer(binding, undefined)` takes the DEFAULT parameter and lands back
  // on `cf-singleton-container`. So an unusable key must answer a real name, not
  // nothing — being wrong that way is silent and puts the whole platform back on
  // one instance with every test still green.
  for (const junk of [undefined, null, 0, false, [], {}, ["a", "b"], NaN, ""]) {
    const n = laneName(junk);
    assert.equal(typeof n, "string");
    assert.ok(n.length > 0 && n.startsWith("build-"), `${String(junk)} -> ${JSON.stringify(n)}`);
  }
  // AND NO REAL KEY MAY EVER LAND ON IT. FNV-1a can answer 0, so a name of
  // `build-h-0` would be produced by both the keyless path and by whichever real
  // slug hashes to zero — one chance in 4.29 billion of a customer's build
  // sharing a working directory with every keyless caller. The keyless name
  // therefore carries NEITHER branch's marker, which makes that structural
  // rather than unlikely.
  const none = laneName("");
  assert.ok(!/^build-[kh]-/.test(none),
    `the keyless name ${JSON.stringify(none)} is producible by a real key`);
  // AND NOT COERCED: `String(["a","b"])` is `"a,b"`, the coercion this repo has
  // shipped as a real bug three times. An array is not a key and must not read as
  // whatever it stringifies to — it must land on the SAME answer as no key at all.
  const empty = laneName("");
  for (const junk of [["a", "b"], ["fold"], { toString: () => "fold" }, 12345, true]) {
    assert.equal(laneName(junk), empty, `${String(junk)} was coerced into a key`);
  }
  // …and specifically NOT onto the container a real key of that spelling gets.
  assert.notEqual(laneName(["fold"]), laneName("fold"), '["fold"] was coerced to "fold"');
});

test("A REAL SLUG IS LEGIBLE AS ITSELF, so a container can be found in a dashboard", () => {
  assert.equal(laneName("fold-lane-bakery"), "build-k-fold-lane-bakery");
  assert.equal(laneName("hold-probe"), "build-k-hold-probe");

  // …AND SO IS THE LONGEST SLUG THE PLATFORM CAN MINT. Derived from `cleanSlug`'s
  // own `.slice(0, N)` rather than restated, because the two drifting apart is
  // exactly the bug this caught: the plain bound was 48 against a slug cap of 60,
  // so any slug of 49-60 characters was hashed and the dashboard showed a base36
  // number where the customer's site name should be. Nothing asserted it, so the
  // number could have been anything.
  const capM = code.match(/cleanSlug\s*=\s*\([^)]*\)\s*=>[^;]*?\.slice\(0,\s*(\d+)\)/);
  assert.ok(capM, "could not find cleanSlug's own length cap in worker.js");
  const slugCap = Number(capM[1]);
  assert.ok(slugCap >= 20 && slugCap <= 200, `cleanSlug's cap read as ${slugCap}`);
  const longest = "a".repeat(slugCap);
  assert.equal(laneName(longest), "build-k-" + longest,
    `a ${slugCap}-character slug — the longest cleanSlug can produce — is not legible as itself`);

  // Anything past the plain bound is hashed rather than TRUNCATED, because two
  // truncations of different long keys would be the SAME name — a silent shared
  // working directory, which is the 2026-07-29 failure.
  const a = "x".repeat(slugCap + 40) + "a";
  const b = "x".repeat(slugCap + 40) + "b";
  assert.notEqual(laneName(a), laneName(b), "two long keys truncated onto one container");
});

test("max_instances IS FAR ABOVE ANY REAL CONCURRENCY, and the classes SUM under the account ceiling", () => {
  // Cloudflare's own figures: an account may run 6 TiB of concurrent memory,
  // 1,500 concurrent vCPU and 30 TB of concurrent disk, and `standard-1` is
  // 1/2 vCPU, 4 GiB, 8 GB. MEMORY BINDS FIRST at 6 TiB / 4 GiB = 1,536, which is
  // what their changelog means by "over 1,500 instances of standard-1
  // concurrently". Five was never a platform limit — it was a guess made while
  // the docs were unclear, and it made two simultaneous builds collide one time
  // in five.
  //
  // THE SUM MATTERS, not each number alone: both classes draw on ONE account
  // pool, so if they can add up past it our own cap stops being the thing that
  // binds and the failure becomes Cloudflare's 503 instead of something we chose.
  const ACCOUNT_MEMORY_GIB = 6 * 1024;
  const STANDARD_1_GIB = 4;
  const CEILING = Math.floor(ACCOUNT_MEMORY_GIB / STANDARD_1_GIB); // 1536

  const raw = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
  assert.ok(Array.isArray(cfg.containers) && cfg.containers.length >= 2, "no containers declared");

  let sum = 0;
  for (const c of cfg.containers) {
    assert.equal(c.instance_type, "standard-1",
      `${c.class_name} is ${c.instance_type} — the ceiling arithmetic above is standard-1's`);
    // A FLOOR, so nobody quietly puts the platform back behind a handful of
    // containers. 5 is what this replaced and is the number to stay away from.
    assert.ok(c.max_instances >= 100,
      `${c.class_name} declares max_instances ${c.max_instances} — builds would queue behind each other again`);
    sum += c.max_instances;
  }
  assert.ok(sum <= CEILING,
    `the classes sum to ${sum} concurrent instances against an account ceiling of ${CEILING}`);
  // AND THE SITE IS THE ONE THAT GETS THE BULK. It is the platform's primary
  // feature; a game build waiting is not a customer's site failing to publish.
  const site = cfg.containers.find((c) => c.class_name === "SiteBuildContainer");
  const game = cfg.containers.find((c) => c.class_name === "GameBuildContainer");
  assert.ok(site && game, "one of the two container classes is gone");
  assert.ok(site.max_instances > game.max_instances,
    `sites get ${site.max_instances} against games' ${game.max_instances}`);

  // AND THE QUEUE IS WHAT ACTUALLY BINDS. A queued build starts only when a
  // consumer invocation is free, so raising the container alone leaves the
  // platform at whatever this says — the whole change inert, with every other
  // assertion in this file passing. That is how it nearly shipped.
  const consumer = ((cfg.queues || {}).consumers || []).find((c) => c.queue === "site-builds");
  assert.ok(consumer, "the site-builds consumer is gone");
  assert.ok(consumer.max_concurrency >= 100,
    `max_concurrency is ${consumer.max_concurrency} — only that many builds can run at once, whatever the containers allow`);
  // 250 IS CLOUDFLARE'S DOCUMENTED CEILING for a push consumer. Above it the
  // deploy is REFUSED, which ships nothing rather than shipping something slow.
  assert.ok(consumer.max_concurrency <= 250,
    `max_concurrency ${consumer.max_concurrency} is above Cloudflare's documented 250 — the deploy would be refused`);
  // MORE CONSUMERS THAN CONTAINERS IS A QUEUE OF WORKERS WAITING ON A QUEUE OF
  // CONTAINERS, and with `max_retries: 0` a container-pool refusal ends a
  // customer's build rather than delaying it.
  assert.ok(consumer.max_concurrency <= site.max_instances,
    `${consumer.max_concurrency} consumers against ${site.max_instances} containers`);
});

test("NO getContainer CALL MAY OMIT ITS NAME — the bug, restored, is one argument", () => {
  // Derived over every call rather than over the ones that exist today. The
  // library's default is the literal `cf-singleton-container`, so a call site
  // written without a name is the whole platform on one instance again, silently.
  const calls = [...code.matchAll(/getContainer\(([^;]*?)\)\s*;/g)].map((m) => m[1]);
  assert.ok(calls.length >= 5, `found only ${calls.length} getContainer calls`);
  for (const args of calls) {
    assert.ok(args.includes(","), `getContainer(${args}) has no container name`);
    assert.ok(/laneName\(/.test(args), `getContainer(${args}) does not go through laneName`);
  }
});

test("EVERY SITE BUILD IS KEYED BY THE SLUG, and only a probe may key by a literal", () => {
  // The site is the unit of work: two sites compile at once, two edits of one
  // site share a container so the build server's queue can serialise them.
  //
  // ANCHORED ON THE PROPERTY, NOT ON A COUNT. This asserted `length === 2` and
  // went red the moment an honest third call joined — the probe that proves a
  // container survives its idle timeout, pinned to ONE fixed name precisely so
  // it can never compete with a build.
  const site = [...code.matchAll(/getContainer\(env\.SITE_BUILD_CONTAINER,\s*([^)]*\))\s*\)/g)].map((m) => m[1].trim());
  assert.ok(site.length >= 2, `expected at least 2 site container calls, found ${site.length}`);
  // EVERY CALL MUST BE ONE THIS SCAN COULD READ, or it goes BLIND rather than
  // red. `[^)]*\)` cannot cross a nested paren, so a call keyed by something
  // like `laneName(url.searchParams.get("lane"))` yields ZERO matches — measured
  // — and a loop over the survivors then reports a clean sweep while the one
  // dangerous call site is the one that vanished. Found by mutation: this guard
  // survived exactly that change. The fifth time this repo has written a flat
  // scan where the shape has nested parens.
  const total = code.split("getContainer(env.SITE_BUILD_CONTAINER").length - 1;
  assert.equal(site.length, total,
    `the scan read ${site.length} of ${total} site container calls — one is a shape it cannot parse, ` +
    "which makes this check blind rather than failing");
  const builds = site.filter((a) => a === "laneName(slug)");
  // A FLOOR ON THE BUILDS, or a change that stopped keying them by slug would
  // leave this passing over nothing but probes.
  assert.ok(builds.length >= 2, `expected both build call sites to be laneName(slug), found ${builds.length}: ${site.join(" | ")}`);
  for (const a of site) {
    // Anything that is not a build must be a FIXED literal. A probe keyed by
    // something caller-supplied could pick a container and starve a real build.
    assert.ok(a === "laneName(slug)" || /^laneName\("[a-z0-9-]+"\)$/.test(a),
      `getContainer(env.SITE_BUILD_CONTAINER, ${a}) is neither the slug nor a fixed probe name`);
  }
});

test("THE GAME BUILD SERVER STILL SERIALISES — one container per key, not per request", () => {
  // Found 2026-08-25: it wipes four SHARED directories per build and had no queue
  // at all, surviving only because every request resolved to one instance. Two
  // game builds by ONE user still share a container BY DESIGN — the key is the
  // account, because a game names itself only after it compiles — so the
  // protection has to be in the server rather than inferred from how requests
  // arrive.
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
  // A container is one instance with one working directory, and per-key naming
  // makes that MORE precise rather than redundant: two builds of one site still
  // share one. "Finishing the job" by deleting the chain puts them back into one
  // `src/routes` on a path that now looks concurrent and is not.
  for (const f of ["../builder/build-server.mjs", "../builder-game/build-server.mjs"]) {
    const src = blankComments(fs.readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.match(src, /_chain\s*=\s*done\.then\(/, `${f} lost its queue`);
  }
});
