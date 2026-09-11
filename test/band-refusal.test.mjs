// A BAND SPLIT THAT DOES NOT HAPPEN SAYS WHY
// (2026-09-10, owner: "OK GO", after the first live build with both splits on.)
//
// WHAT THE LIVE RUN COULD NOT ANSWER. `ridgeway-cycle-works` published clean
// with `waves: 3, agents: 4` on its design event and NO `bands` step at all — so
// the stored row said the page had been written in one call and could not say
// which of five walls stopped the fan-out. Four of them live in `splitPlan`,
// which collapsed every one into `[]`; the fifth is the canary door, which was
// the last term of a `&&` chain and therefore never even asked on a build whose
// plan had already refused. Five causes needing five different moves, wearing
// one silence: the recorded "a failure that cannot name itself", inside the
// instrument written that same morning to make the split readable.
//
// WHAT THIS FILE IS FOR, and every case is a way the fix ships looking right:
//
//   * the reason recorded as a FIELD rather than in the step's NAME — `tr.at`
//     keeps finite numbers only and drops everything else silently, so a
//     `why: "tsx"` records exactly nothing and reads, from the stored row,
//     precisely like the silence this exists to end;
//   * `splitPlan` and `planRefusal` drifting apart — two lists of the same
//     conditions, whose failure is a build that reports a reason it did not act
//     on;
//   * a reason `bandRefusal` can answer that nothing knows the name of, so
//     `budgetStage` falls to its default and tells a customer with a live
//     database that nothing was set up;
//   * the door going back to a term of the `&&`, which makes "the plan refused"
//     and "the flag is off for this account" the same nothing again;
//   * and the ORDER, which is the code's order rather than a ranking — the
//     reason names the first wall met, and a case pins that so nobody "fixes"
//     it into a ranking later.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  planRefusal, splitPlan, bandRefusal, BAND_REFUSALS, BAND_MARK,
} from "../builder/page-bands.mjs";
import { makeTrace } from "../builder/trace.mjs";
import { budgetStage } from "../builder/build-budget.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
// Whole-line comments blanked, length preserved. This file needs it: the
// comments beside the fix SPELL every reason word and the `&&` chain the fix
// removed, so an unblanked scan reports the fix as the defect.
const blank = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const WORKER = read("worker.js");
const WCODE = blank(WORKER);
const BANDS = read("builder/page-bands.mjs");
const BUDGET = read("builder/build-budget.mjs");

/** A plan that really splits — two bands on the home route. */
const OK = {
  pages: 1, canFire: true, door: true,
  shape: [{ path: "/", sections: ["a hero with the workshop name", "the price list"] }],
  route: "/", tsx: undefined, priorPages: undefined, mode: "build",
};

test("planRefusal names each of its walls, and answers nothing when the plan splits", () => {
  assert.equal(planRefusal(OK), "", "a two-band plan on `/` must not refuse");
  // RE-ANCHORED 2026-09-11, NOT APPEASED. `tsx` used to refuse here, because a
  // band could not write a part and a split build of such a site produced a page
  // importing a file nothing generated. A part is its own agent now, so the
  // refusal is GONE — and that is asserted rather than merely deleted, because
  // the whole point of the change is that these builds split.
  assert.equal(planRefusal({ ...OK, tsx: [{ name: "ChordDiagram", does: "draws a chord" }] }), "",
    "a declared component still refuses the split — the part agents are not reachable");
  assert.equal(planRefusal({ ...OK, mode: "revise" }), "revise");
  assert.equal(planRefusal({ ...OK, priorPages: { "index.tsx": "…" } }), "revise");
  assert.equal(planRefusal({ ...OK, route: "index.tsx" }), "route", "a file is not a route");
  assert.equal(
    planRefusal({ ...OK, shape: [{ path: "/", sections: ["only one band"] }] }), "thin",
    "one band is the whole page with extra steps",
  );
  // A page the shape has no entry for is `thin` rather than a throw: "no plan
  // for this page" is a real answer that means "do not split it".
  assert.equal(planRefusal({ ...OK, shape: [{ path: "/prices", sections: ["a", "b"] }] }), "thin");
  // RE-ANCHORED 2026-09-11, NOT APPEASED, AND INVERTED (owner: "whatever the
  // designer does then it should go to the generate, if the designer does 9 the
  // generate needs 9 if 8, 8"). `wide` stood for one day between these two
  // sessions: bands and parts went out as ONE list and `runFanout` ran the whole
  // list at once, so a plan of more pieces than the container had sockets was
  // refused the split entirely. `runFanout` QUEUES past its socket bound now,
  // and `planRefusal` has no width test left — so these two cases assert the
  // opposite of what they asserted this morning, on purpose, because the whole
  // change is that these plans split.
  const eight = { ...OK, shape: [{ path: "/", sections: ["one", "two", "tri", "four", "five", "six", "sevn", "ate"] }] };
  const three = [{ name: "A", does: "a" }, { name: "B", does: "b" }, { name: "C", does: "c" }];
  assert.equal(planRefusal(eight), "", "a full page of bands must split");
  assert.equal(planRefusal({ ...eight, tsx: three }),
    "", "eleven pieces were refused the split — the ninth queues, it is not a reason to write the page in one call");
  assert.equal(planRefusal({ ...OK, tsx: three }), "", "two bands and three parts is five calls and must split");
  const six = { ...OK, shape: [{ path: "/", sections: ["one", "two", "tri", "four", "five", "six"] }] };
  assert.equal(planRefusal({ ...six, tsx: three.slice(0, 2) }), "", "eight exactly must split");
  assert.equal(planRefusal({ ...six, tsx: three }), "", "nine must split too — that is the case this change exists for");
});

test("splitPlan is DERIVED from planRefusal and cannot disagree with it", () => {
  // The property, over every shape the two are asked about together: the lines
  // are empty EXACTLY when a reason is given. A second copy of the conditions
  // is the drift this derivation exists to prevent, and its failure mode is a
  // build that records "tsx" while splitting anyway.
  const cases = [
    OK,
    { ...OK, tsx: [{ name: "X", does: "x" }] },
    { ...OK, shape: [{ path: "/", sections: ["one", "two", "tri", "four", "five", "six", "sevn", "ate"] }],
      tsx: [{ name: "A", does: "a" }, { name: "B", does: "b" }, { name: "C", does: "c" }] },
    { ...OK, mode: "revise" },
    { ...OK, priorPages: {} },
    { ...OK, route: "index.tsx" },
    { ...OK, route: "" },
    { ...OK, shape: [{ path: "/", sections: ["one"] }] },
    { ...OK, shape: [] },
    { ...OK, shape: null },
    {},
  ];
  let split = 0;
  for (const c of cases) {
    const why = planRefusal(c);
    const lines = splitPlan(c);
    assert.equal(
      lines.length === 0, why !== "",
      `splitPlan and planRefusal disagree on ${JSON.stringify(c).slice(0, 80)} — why=${JSON.stringify(why)}, lines=${lines.length}`,
    );
    if (!why) split++;
  }
  // A NEGATIVE ASSERTION MUST PROVE ITS OBSERVER IS ALIVE: a derivation that
  // refused everything would satisfy the loop above and scan nothing.
  assert.ok(split >= 1, "no case in this list actually splits — the loop proved nothing");
});

test("bandRefusal answers the whole ladder, and the ORDER is the code's order", () => {
  assert.equal(bandRefusal(OK), "", "everything open must split");
  assert.equal(bandRefusal({ ...OK, canFire: false }), "sync");
  assert.equal(bandRefusal({ ...OK, pages: 2 }), "pages");
  assert.equal(bandRefusal({ ...OK, pages: 0 }), "pages");
  assert.equal(bandRefusal({ ...OK, door: false }), "door");
  assert.equal(bandRefusal({}), "sync", "an argument-less call must refuse, never split");
  // THE ORDER, pinned. A synchronous build whose plan ALSO refuses answers
  // `sync`, because that is the wall it actually met. This is deliberately not
  // a ranking of which reason is most useful — a ranking would report a wall
  // the build never reached.
  //
  // RE-ANCHORED 2026-09-11, NOT APPEASED. The plan-level refusal used here was
  // `wide` — eleven pieces against eight sockets — and that refusal is gone,
  // because the fan-out queues instead. WHICH plan wall this drives was never
  // the property; that a plan wall is met BEFORE the door is. `thin` is the
  // substitute and it is the same shape: a refusal `planRefusal` owns.
  const bad = { shape: [{ path: "/", sections: ["only one band"] }] };
  assert.equal(bandRefusal({ ...OK, ...bad, canFire: false, pages: 3, door: false }), "sync");
  assert.equal(bandRefusal({ ...OK, ...bad, pages: 3, door: false }), "pages");
  assert.equal(bandRefusal({ ...OK, ...bad, door: false }), "thin",
    "the plan's own wall is met before the door, which is where `planRefusal` sits in the chain");
  assert.equal(bandRefusal({ ...OK, door: false }), "door", "…and the door is the last wall standing");
  // AND THE PLAN THAT USED TO MEET A WALL HERE NOW WALKS THROUGH IT — the whole
  // ladder, on the widest plan the two producers can compose.
  const widest = { shape: [{ path: "/", sections: ["one", "two", "tri", "four", "five", "six", "sevn", "ate"] }],
    tsx: [{ name: "A", does: "a" }, { name: "B", does: "b" }, { name: "C", does: "c" }] };
  assert.equal(bandRefusal({ ...OK, ...widest }), "", "eleven pieces were refused somewhere on the ladder");
});

test("BAND_REFUSALS is a CENSUS of the words bandRefusal can answer, both directions", () => {
  // DERIVED FROM THE PRODUCERS, never a second list beside them — and there are
  // TWO, which the first draft of this case got wrong and its own floor caught:
  // `bandRefusal` spells only the three walls IT owns (`sync`, `pages`,
  // `door`) and returns `planRefusal`'s answer through a variable for the other
  // four. Scanning one function read three words and reported a live scan.
  const bodyOf = (name) => {
    const at = BANDS.indexOf("export function " + name + "(");
    assert.ok(at > 0, name + " is gone");
    const end = BANDS.indexOf("\n}", at);
    assert.ok(end > at, name + " has no end — the window would swallow the file");
    return blank(BANDS.slice(at, end));
  };
  const words = [];
  for (const fn of ["bandRefusal", "planRefusal"]) {
    for (const m of bodyOf(fn).matchAll(/return\s+"([a-z]+)"/g)) words.push(m[1]);
  }
  // THE FLOOR MOVED 7 → 6 WITH `wide`'s REMOVAL (2026-09-11), and that is the
  // one number in this case that has to be re-read rather than derived. Derived
  // from `BAND_REFUSALS` it would be circular: a word deleted from the producer
  // AND the list moves both sides together and the floor would never notice.
  // Six is `sync` · `pages` · `door` out of `bandRefusal` and `revise` · `route`
  // · `thin` out of `planRefusal`; the floor's whole job is to prove the regex
  // and the window still find them.
  assert.ok(words.length >= 6, `read only ${words.length} reason words out of the two producers — the scan is not alive`);
  for (const w of words) {
    assert.ok(BAND_REFUSALS.includes(w), `bandRefusal can answer ${JSON.stringify(w)} and BAND_REFUSALS does not list it`);
  }
  // The other direction, so a name that stops being reachable is noticed rather
  // than left as a word nothing produces. `nofanout` is the one reason the
  // FUNCTION cannot answer — the container refuses the fan-out after the
  // decision — so it is required to exist in worker.js instead.
  for (const w of BAND_REFUSALS) {
    if (w === "nofanout") {
      assert.match(WCODE, /BAND_MARK \+ "nofanout"/, "`nofanout` is listed and worker.js never marks it");
      continue;
    }
    assert.ok(words.includes(w), `BAND_REFUSALS lists ${JSON.stringify(w)} and bandRefusal can never answer it`);
  }
});

test("every reason fits the step name tr.at will actually store", () => {
  // `tr.at` does `String(name).slice(0, 40)`. A truncated reason is a reason
  // nobody can match on, and it truncates silently.
  for (const w of BAND_REFUSALS) {
    const name = BAND_MARK + w;
    assert.ok(name.length <= 40, `${name} is ${name.length} chars and tr.at truncates at 40`);
  }
  // And the trace really keeps the name — driven, because the whole design rests
  // on the NAME surviving where a string field would not.
  const tr = makeTrace(() => 0);
  tr.at(BAND_MARK + "tsx", { why: "tsx" });
  const row = tr.done().steps.at(-1);
  assert.equal(row.s, "bands:tsx", "the trace dropped or renamed the step");
  assert.ok(!("why" in row), "a string field reached the trace — tr.at's number-only wall is gone");
});

test("budgetStage knows every bands: reason, and its prefix is the one the marker writes", () => {
  // The two spellings are held in step HERE rather than by an import:
  // build-budget.mjs has no imports at all, deliberately, and taking BAND_MARK
  // from page-bands.mjs would pull five modules into it.
  assert.ok(
    BUDGET.includes('name.startsWith("' + BAND_MARK + '")'),
    `build-budget.mjs does not read the ${JSON.stringify(BAND_MARK)} prefix the marker writes`,
  );
  // DERIVED from the census, so a new reason is covered by existing.
  for (const w of BAND_REFUSALS) {
    assert.equal(
      budgetStage([{ s: "gen", ms: 1 }, { s: BAND_MARK + w, ms: 1 }]), "generate",
      `a ${BAND_MARK + w} step must read as "generate" — a refusal is a fallback to the one call, never a later stage`,
    );
  }
  // The control: the bare `bands` step (the split really ran) is unchanged.
  assert.equal(budgetStage([{ s: "bands", ms: 1 }]), "generate");
});

test("the refusal mark is wired: the reason rides in the name, and useBands is derived from it", () => {
  // The mark's own block, CUT OUT AND RUN over every reason — a text match
  // cannot tell `mark(BAND_MARK + bandWhy)` from `mark(BAND_MARK)`, and the
  // second records seven different refusals under one name.
  const at = WORKER.indexOf("      if (bandWhy) {");
  assert.ok(at > 0, "the refusal mark is gone");
  const end = WORKER.indexOf("\n      }", at);
  assert.ok(end > at, "the refusal mark has no end");
  const block = WORKER.slice(at, end + "\n      }".length);
  const seen = [];
  const run = new Function("bandWhy", "mark", "BAND_MARK", block);
  for (const w of BAND_REFUSALS) run(w, (n) => seen.push(n), BAND_MARK);
  assert.deepEqual(seen, BAND_REFUSALS.map((w) => BAND_MARK + w), "the mark does not carry the reason");
  // …and says NOTHING when the split really happened, so the step's absence
  // keeps meaning "it split".
  seen.length = 0;
  run("", (n) => seen.push(n), BAND_MARK);
  assert.deepEqual(seen, [], "a build that split still wrote a refusal mark");

  // `useBands` is DERIVED from the reason rather than computed beside it.
  assert.match(
    WCODE, /const useBands = resumeCall \? resumeFanout : !bandWhy;/,
    "useBands no longer reads the reason — a separate condition here is two lists of the same thing",
  );
  // THE DOOR IS ASKED WHATEVER THE PLAN SAID. Back inside the `&&` chain it is
  // never asked on a build whose plan refused, which is the exact blindness
  // this change exists to end.
  const door = WCODE.slice(WCODE.indexOf("const bandDoor ="), WCODE.indexOf("const bandWhy ="));
  assert.ok(door.length > 20, "the bandDoor line is gone");
  assert.doesNotMatch(door, /bandLines/, "the door is gated on the plan again — a refused plan never asks it");
  // RE-ANCHORED 2026-09-10, and this one was not a spelling that moved — it was
  // THE DEFECT WRITTEN DOWN AS A REQUIREMENT. The line read
  // `uid: (auth && auth.id) || ""`, and `auth` in that scope is the raw
  // Authorization HEADER STRING: a string is truthy, a string has no `.id`, so
  // the door was asked `uid: ""` on every build ever made and the band split was
  // unreachable for every account from the day it shipped. Pinning the literal
  // meant the one guard looking straight at the line certified it.
  //
  // Being that spelling was never the property. The property is that the door is
  // asked with the CALLER'S IDENTITY, and that is proved by RUNNING the chain —
  // `test/band-build.test.mjs`, "the door is asked with the account…" — not by
  // matching text here. What is left here is the shape this case owns: it is
  // asked, and it is asked with something that is not the bearer token.
  assert.match(door, /bandSplitFor\(env, \{ uid, slug \}\)/, "the door no longer asks with the caller's uid");
  assert.doesNotMatch(door, /\bauth\b/, "the door reads the bearer header for an identity again");
});

test("the reason never reaches the trace as a field, only as the name", () => {
  // The whole design rests on this. A field would be dropped by tr.at and the
  // row would read exactly like the silence the change removes — so a mark
  // carrying `why` as a value is the defect wearing the fix's clothes.
  const at = WORKER.indexOf("      if (bandWhy) {");
  const end = WORKER.indexOf("\n      }", at);
  const block = blank(WORKER.slice(at, end));
  assert.doesNotMatch(block, /\bwhy\s*:/, "the reason is being passed as a trace field, which tr.at drops");
  assert.match(block, /mark\?\.\(BAND_MARK \+ bandWhy\)/);
});
