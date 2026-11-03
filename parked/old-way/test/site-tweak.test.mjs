// PARKED (2026-11-03, park-old-way): the old-way half of test/site-tweak.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The cheap rung of the `page` layer.
//
// WHAT IS ACTUALLY BEING ASSERTED is one promise: a tweak changes how a page
// LOOKS and cannot change what it SAYS. Everything else here exists to make
// that promise safe to rely on — the guard has to fire on a rewording and must
// NOT fire on the changes the rung exists for, and this repo has recorded
// several times that a check crying wolf on correct output is worse than the
// miss it prevents.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  readTweak as readTweakRaw, runTweak, tweakable, sameProse, proseOf, routeIdOf, tweakUsage,
  tweakRequest, tweakReply, tweakLint, lintOne, TWEAK_MODEL, TWEAK_TOOL, TWEAK_RULES, MAX_TWEAK_CHARS,
} from "../../../builder/site-tweak.mjs";
// The extractor the guarantee is built on — used here to splice at its OWN
// offsets, so the negative case covers every page rather than the fifth that
// happen to carry a long quoted string.
import { extractText } from "../../../builder/site-text.mjs";
import { CORPUS_DIR } from "../../../test/fixtures/corpus.mjs";
import { modelsFor } from "../../../builder/build-models.mjs";
import { asEditsReply } from "../../../test/fixtures/tweak-edits.mjs";
// The tool answers with exact edits (idea #18): a whole-file answer here is turned into them.
const readTweak = (r, o) => readTweakRaw(asEditsReply(r, o && o.source), o);

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const PAGE = read("../../../builder/lovable/template/src/routes/index.tsx");
const worker = read("../../../worker.js");

/** The raw API reply shape, because that is what the lane really receives. */
const reply = (input, usage) => ({
  content: [{ type: "tool_use", name: TWEAK_TOOL.name, input }],
  usage: usage || { input_tokens: 3400, output_tokens: 3300 },
});

/* ── the wiring ──────────────────────────────────────────────────────────── */

test("IT IS REACHED, AND IT IS TRIED BEFORE THE REWRITE", () => {
  // The layer this repo has shipped dead twelve times. A module that decides
  // correctly and is called by nothing is the whole failure mode.
  assert.match(worker, /import \{[^}]*\brunTweak\b[^}]*\} from "\.\/builder\/site-tweak\.mjs"/,
    "runTweak is used without being imported — a ReferenceError on the edit path");
  const at = worker.indexOf("const tw = await runTweak(");
  assert.ok(at > 0, "nothing in the page layer calls the cheap rung");
  // BEFORE the expensive one, or it is a second bill rather than a saving.
  // THE WRITER IS A FUNCTION SINCE 2026-10-24 (round 2 of the retry rule:
  // `pWrite`, so its answer can be asked again with a reason); its first call
  // is the line below, and it must still come after the cheap rung.
  const gen = worker.indexOf("eGen = await pWrite(pRec.call);");
  assert.ok(gen > at, "the cheap rung runs after the rewrite it exists to avoid");
});

test("a failed cheap attempt FALLS THROUGH rather than answering", () => {
  // The one place this rung differs from every other lane. The rewrite below is
  // a genuinely different attempt at the same request by a stronger model, so
  // answering "that didn't work" here would refuse the customer a path that
  // still works.
  const at = worker.indexOf("const tw = await runTweak(");
  // ⚠ RE-ANCHORED 2026-09-22 ON THIS RUNG'S OWN LAST STATEMENT. The window
  // closed on `const eDb = await siteBackendBySlug` — the NEXT section's first
  // line, not this one's — and when that line became `let eDb` (the page
  // rung's four-state backend read), `indexOf` answered -1, `slice(at, -1)`
  // swallowed the rest of the file, and this counted 145 answers. This repo's
  // own recorded trap: a missing END landmark widens a window instead of
  // failing. Both landmarks are proved present before the window is believed.
  const spentAt = worker.indexOf("const twSpent", at);
  assert.ok(at > 0 && spentAt > at, "the tweak window's landmarks are gone — re-derive it");
  const win = worker.slice(at, worker.indexOf("\n", spentAt));
  assert.ok(win.length > 400, "the tweak window is empty — the anchor moved");
  // ⚠ RE-ANCHORED 2026-09-21, AND THE PROPERTY IS SHARPER THAN THE COUNT WAS.
  // This asserted exactly ONE `return`, which stood for *"a failure falls
  // through"* only while the success branch had one answer. The protection
  // added a second — a SUCCESSFUL tweak whose photograph loss cannot be put
  // back is withheld — and that is a different thing from a failed attempt:
  // it deliberately must NOT fall through, because falling through buys the
  // ~25-credit rewrite to cover a picture our own cheap rung mangled.
  //
  // THE REAL PROPERTY IS WHERE THE RETURNS ARE, not how many. `twSpent` is the
  // first statement after the `if (tw.ok)` block, so every answer occurring
  // above it is an answer reachable only when the cheap attempt SUCCEEDED —
  // which is exactly "a failure falls through", stated so that an honest third
  // answer inside the success branch does not read as this rung breaking.
  const returns = [...win.matchAll(/return Response\.json\(/g)];
  assert.equal(returns.length, 2,
    "the cheap rung answers on " + returns.length + " paths — expected the publish and the withheld refusal");
  const spent = win.indexOf("const twSpent");
  assert.ok(spent > 0, "the fall-through's own landmark is gone — re-derive this window");
  for (const r of returns) {
    assert.ok(r.index < spent,
      "the cheap rung answers AFTER its success branch closes — a failed attempt must fall through to the rewrite");
  }
  // ⚠ AND THE REFUSAL COMES **FIRST**, WHICH IS THE SAFETY PROPERTY ITSELF —
  // owner, 2026-09-21: *"Apply the same preservation contract to successful
  // tweaks BEFORE publication."* The withheld answer is above the publishing
  // one in source order because the guard is asked before `publishStep`; the
  // defect this replaced published the loss and reported it afterwards, and a
  // version that put the check below the publish would satisfy every count
  // above while shipping exactly the old behaviour.
  assert.match(win.slice(returns[0].index, returns[1].index), /error: "withheld"/,
    "the photograph refusal is not the first answer — the guard has moved below the publish");
  assert.match(win.slice(returns[1].index, spent), /ok: true,[^}]*tweak: true/,
    "the second answer is not the publish — re-read what this rung now returns");
  // BOTH ANCHORS PROVED TO EXIST BEFORE THEY ARE ORDERED. `indexOf` answers -1
  // for a string that is not there and -1 is less than everything, so a mutant
  // deleting the gate entirely — `if (tw.ok)` → `if (false)`, which pays for
  // the cheap call and throws its answer away — SURVIVED this assertion. The
  // vacuous-ordering trap this repo has already recorded twice.
  const gate = win.indexOf("if (tw.ok) {");
  assert.ok(gate >= 0, "the success gate is gone — the cheap rung's answer is unreachable");
  assert.ok(gate < returns[0].index, "the only answer is not inside the success branch");
});

test("WHAT THE CHEAP ATTEMPT COST IS BILLED WITH THE REWRITE, once", () => {
  // `eCharge` is variadic precisely so two calls on one path round up ONCE —
  // the lesson `pageCredits` already carries, where summing separately-rounded
  // credits charged twice for the rounding.
  //
  // ⚠ THE PROPERTY IS THAT `twSpent` RIDES IN THE REWRITE'S OWN CALL, not that
  // it is the call's last argument. This was pinned to the closing parenthesis
  // and went red on 2026-09-24, when the preservation judge's tokens joined the
  // same call — an honest third argument read as the cheap attempt going
  // unbilled. The judge's half is asserted where it is observable, on the
  // debits `test/edit-page-keep.test.mjs` reads.
  assert.match(worker, /cost: await eCharge\(eGen && eGen\.usage, twSpent[,)]/,
    "the rewrite bills without the cheap attempt that preceded it");
  // …and a provider that was never reached bills nothing.
  assert.match(worker, /const twSpent = tw\.reason === "send" \? null : tw\.usage/);
});
