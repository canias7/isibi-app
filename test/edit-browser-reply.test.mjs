// THE EDIT ROUTE'S SCREEN READER, AND WHY IT IS NOT THE ADDON'S.
//
// `browserReply` runs `addonAnswer`; `editBrowserReply` runs `editAnswer`.
// They are different composers over different bodies, and the failure mode is
// the quiet one: the ADD composer answers a PLAUSIBLE sentence for an edit
// reply rather than throwing, so a guard asserting it passes whatever the edit
// screen really says.
//
// MEASURED, and it is why this file exists: an edit reply naming a page, a
// lost photograph and two picture spaces came back through `addonAnswer` as
// three words. The assertions below pin the discrimination itself.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { browserReply, editBrowserReply, EDIT_BROWSER_FNS, BROWSER_FNS } from "../scripts/addon-sweep.mjs";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

// A REAL PAGE-EDIT REPLY, in the shape `worker.js`'s page rung really returns.
const PAGE_REPLY = { ok: true, layer: "page", page: "/rates", photos: 2, lostPhotos: 2, files: 3, cost: 3 };

test("the two readers are different composers, and the addon one is wrong about an edit reply", () => {
  const edit = editBrowserReply(PAGE_REPLY, true);
  const addon = browserReply(PAGE_REPLY, true);
  assert.equal(edit.ok, true, "the edit reader could not compose: " + edit.why);
  assert.equal(addon.ok, true, "the addon reader could not compose: " + addon.why);
  // THE ADD COMPOSER DOES NOT THROW — which is the whole danger. It answers
  // something, and something is what a guard then pins.
  assert.notEqual(edit.text, addon.text,
    "the two readers agree on an edit reply, so this file's subject has gone: " + JSON.stringify(edit.text));
  // AND THE EDIT ONE IS THE ONE THAT SAYS WHAT HAPPENED.
  assert.ok(edit.text.includes("/rates"), "the edit screen does not name the page: " + JSON.stringify(edit.text));
  assert.ok(!addon.text.includes("/rates"), "the addon screen names the page too, so the discriminator is gone");
});

test("the function list is the whole scope, and a sentence outside it throws rather than going quiet", () => {
  // ⚠ `browserSource`'s OWN RECORDED TRAP, one reader over: the cut source has
  // exactly the named functions in scope, so a clause added to `editReply`
  // whose composer is not listed is a `ReferenceError` at the first reply that
  // reaches it — and the harness then reports NO customer screen rather than a
  // wrong one. Derived from `editReply`'s own body so the next one fails here.
  // EVERY `name(` that is a function declared in chat.js must be cut.
  // Built from the FILE's own declarations rather than a list typed here, so a
  // helper renamed next month is caught by its absence and not by a stale name.
  const declared = new Set([...CHAT.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]));
  assert.ok(declared.size > 20, "the declaration scan found almost nothing: " + declared.size);
  // ONE FUNCTION'S BODY, closed the way `browserSource` CUTS IT — `\n}` — so
  // the census reads exactly the text the reader will run. A different closing
  // landmark would be a second opinion about where a function ends, and the
  // two can disagree the moment a nested block is indented differently.
  const bodyOf = (name) => {
    const at = CHAT.indexOf("function " + name + "(");
    assert.ok(at > 0, name + " is gone from chat.js");
    const end = CHAT.indexOf("\n}", at);
    assert.ok(end > at, name + "'s end is not where this scan expects it — re-derive the landmark");
    return CHAT.slice(at, end + 2);
  };
  // ⚠ TRANSITIVE, AND THAT IS NEW (2026-09-20). It walked `editReply` alone,
  // so the hour a clause moved into a helper of its own — `editOutcomes`, so
  // the look branch could say the same things — every function THAT reaches
  // for became invisible to this census. A second-level `ReferenceError` is
  // the same failure as a first-level one: the harness reports NO customer
  // screen rather than a wrong one.
  const seen = new Set();
  const need = new Set();
  const walk = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const body = bodyOf(name);
    // A SANITY BOUND ON THE CUT, not a size claim. The floor catches a `\n}`
    // that closed at a NESTED brace and left a fragment; the ceiling catches
    // one that never closed. ⚠ LOWERED 2026-09-20: `editReply` is a 194-byte
    // WRAPPER now — it appends the outcomes once and hands the switch to
    // `editReplyBody` — and a floor of 200 reported that correct refactor as
    // a broken landmark. A real member of this closure can be one line.
    assert.ok(body.length > 100 && body.length < 40000, "re-derive " + name + "'s window: " + body.length + " bytes");
    for (const m of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!declared.has(m[1]) || m[1] === name) continue;
      need.add(m[1]);
      walk(m[1]);
    }
  };
  walk("editReply");
  assert.ok(need.size, "editReply reaches no chat.js helper at all, so this census proves nothing");
  assert.ok(seen.size > 1, "the walk never left editReply, so the transitive half proves nothing");
  for (const n of need) {
    assert.ok(EDIT_BROWSER_FNS.includes(n),
      "`" + n + "` is reachable from editReply and is not in EDIT_BROWSER_FNS — the reader will throw on the first reply that gets there");
  }

  // ── AND THE ENTRY POINT'S OWN CALLS, WHICH THE WALK ABOVE CANNOT SEE ──────
  //
  // ⚠ `editReply` IS THE **SUCCESS** COMPOSER. A helper reached from the
  // REFUSAL branch is not under it at all — `wholeRequestNote` is exactly
  // that, called by `editAnswer` above the `applyEditResult` hop — so the
  // census was blind to the half of the reader that draws refusals.
  //
  // ⚠ AND IT IS DELIBERATELY **NOT** TRANSITIVE, which is the part worth
  // writing down. Walking `editAnswer` the way `editReply` is walked demands
  // 36 further functions — `siteEdit`, `watchEditJob`, `siteAddon`,
  // `sitesSave`, the whole build-panel closure — and the harness does not cut
  // those ON PURPOSE: they are INJECTED as recorders and stubs, which is what
  // makes `actions` a record of what the screen would do rather than the
  // screen doing it. A census demanding they be cut would be asserting the
  // opposite of the design. MEASURED before this was written, rather than
  // guessed: rooting the transitive walk here turned one green file into
  // thirty-six demands.
  //
  // So the property is the entry point's OWN calls: three today, all cut. What
  // it catches is precisely what happened — a new composer added to the
  // refusal branch and forgotten in the list, which the reader would otherwise
  // meet as a `ReferenceError` and report as NO screen at all.
  const entry = new Set([...bodyOf("editAnswer").matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((m) => m[1]).filter((n) => declared.has(n) && n !== "editAnswer"));
  assert.ok(entry.size >= 3,
    "editAnswer reaches " + entry.size + " chat.js helpers — re-derive its window before believing this census");
  assert.ok(entry.has("wholeRequestNote"),
    "the refusal branch no longer composes through a named helper, so this census proves nothing about it");
  for (const n of entry) {
    assert.ok(EDIT_BROWSER_FNS.includes(n),
      "`" + n + "` is called by editAnswer itself and is not in EDIT_BROWSER_FNS — the reader will throw on the first reply that gets there");
  }
});

test("the selection is the real `editAnswer`, so a refusal is drawn as one", () => {
  // A REFUSAL IS PART OF WHAT IS UNDER TEST — the text rung's 503
  // `parts-unreadable` is one — and running only the success composer would
  // report "Updated /" over it. `editAnswer` is the entry point for the same
  // reason `browserReply` runs `addonAnswer` rather than `addonReplyText`.
  const r = editBrowserReply({ ok: false, error: "parts-unreadable", cost: 0, msg: "I couldn't read this site's sections just now." }, false);
  assert.equal(r.ok, true, "the reader could not compose a refusal: " + r.why);
  assert.ok(r.text.startsWith("⚠️"), "a refusal was not drawn as one: " + JSON.stringify(r.text));
  assert.ok(r.text.includes("sections"), "the server's own sentence did not reach the screen: " + JSON.stringify(r.text));
  // AND NOTHING WAS SET IN MOTION. A refusal carrying a `msg` is answered
  // where it stands; falling through to the ~25-credit rewrite would charge
  // for a message nobody re-typed.
  assert.deepEqual(r.actions, [], "a refusal started something: " + JSON.stringify(r.actions));
});

test("a status nobody recorded REFUSES, rather than guessing a branch", () => {
  // `browserReply`'s own rule, and it must hold here too: the browser's first
  // question about a reply is its HTTP status, so a harness that does not know
  // it cannot say what the screen said. `false` would report a refusal over a
  // successful change and `true` the opposite.
  for (const bad of [undefined, null, 200, "true"]) {
    const r = editBrowserReply(PAGE_REPLY, bad);
    assert.equal(r.ok, false, "a cannot-tell status composed a screen: " + JSON.stringify(bad) + " -> " + JSON.stringify(r.text));
    assert.ok(r.why.includes("status"), "the refusal does not name its reason: " + r.why);
  }
});

test("the two lists are separate, and each names its own entry point", () => {
  // TWO LISTS BECAUSE THERE ARE TWO COMPOSERS, not because one was copied.
  // The overlap is the shared note helpers; what must NOT leak is the entry
  // point, because a list naming both would let the wrong `return` be cut.
  assert.ok(EDIT_BROWSER_FNS.includes("editAnswer"), "the edit list does not name its own entry point");
  assert.ok(BROWSER_FNS.includes("addonAnswer"), "the addon list does not name its own entry point");
  assert.ok(!EDIT_BROWSER_FNS.includes("addonAnswer"), "the edit list carries the addon's entry point");
  assert.ok(!BROWSER_FNS.includes("editAnswer"), "the addon list carries the edit entry point");
  // AND BOTH NAME `photoNote`, which is the shared half — asserted so a future
  // split of that helper cannot silently leave one reader without it.
  for (const list of [EDIT_BROWSER_FNS, BROWSER_FNS]) {
    assert.ok(list.includes("photoNote"), "a reader lost the picture-space sentence: " + JSON.stringify(list));
  }
});

// ── AN ESCALATE PRINTS NOTHING AND SPENDS ~25 CREDITS ───────────────────────
//
// Run 12 (2026-09-21, `fretwork-1`) came back `{ok:false, escalate:true,
// reason:"no-backend", cost:0}` at HTTP 200, and the canary's capture was
// EMPTY — which read as "the customer was told nothing", full stop. It is
// worse than that: the branch that prints nothing is the branch that ACTS,
// and what it starts is the ~25-credit full rewrite.
//
// TWO PROPERTIES, AND ONLY THE PAIR IS THE FINDING: the text is empty, and
// `actions` is not. A harness reading one of them reports half an outcome.
const RUN12 = { ok: false, escalate: true, reason: "no-backend", cost: 0 };

test("an escalate with no layer starts the FULL rewrite, and says so in `actions`", () => {
  // HTTP 200 — the real status run 12 recorded. An escalate is a product
  // answer rather than a transport failure, so it arrives on a 2xx and the
  // status is NOT what separates it from a published edit.
  const r = editBrowserReply(RUN12, true);
  assert.equal(r.ok, true, "the edit reader could not compose: " + r.why);
  assert.equal(r.text, "", "this branch printed something: " + JSON.stringify(r.text));
  // ⚠ `shown` IS WHAT SEPARATES "ACTED" FROM "ANSWERED EMPTY". `finish` is
  // never called here, so an empty string with `shown: true` would be a
  // DIFFERENT outcome — a composer that answered nothing — and collapsing the
  // two is the one way this reader can mislead rather than go quiet.
  assert.equal(r.shown, false, "`finish` was called, so this is no longer the acting branch");
  // THE EXPENSIVE HALF, AND IT IS A FULL REWRITE RATHER THAN A SIDEWAYS HOP.
  // `escalateAction` reads `e.layer` for a hop and this reply carries NO
  // layer at all, so `named` is "" and the decision is `up` by construction —
  // `handedOff` never enters it. A sideways hop would be recorded as a second
  // PAID post naming a layer, which is a different sentence and a different
  // price.
  assert.deepEqual(r.actions, ["start the FULL ~25-credit rewrite (the browser's `fallback`)"],
    "the escalate no longer records the rewrite it starts: " + JSON.stringify(r.actions));
});

test("a sideways hop and a fall are two different recorded actions", () => {
  // THE DISCRIMINATOR, or the case above is satisfied by a reader that records
  // "full rewrite" for every escalate there is. A NAMED layer different from
  // ours is one rung sideways at that rung's price.
  const hop = editBrowserReply({ ok: false, escalate: true, layer: "page", page: "/", cost: 0 }, true);
  assert.equal(hop.ok, true, "the hop reply could not compose: " + hop.why);
  assert.equal(hop.actions.length, 1, "the hop recorded something else too: " + JSON.stringify(hop.actions));
  assert.match(hop.actions[0], /SECOND, PAID request to the edit route \(layer "page"\)/,
    "a named layer no longer hops sideways: " + JSON.stringify(hop.actions));
  // AND THE ADDON RUNG IS ITS OWN THIRD ANSWER, by name.
  const add = editBrowserReply({ ok: false, escalate: true, layer: "addon", cost: 0 }, true);
  assert.deepEqual(add.actions, ["post a PAID request to the addon route"],
    "the addon escalate no longer reaches the middle rung: " + JSON.stringify(add.actions));
  // THE THREE ARE REALLY THREE. A guard that only ever saw one of them would
  // pass on a reader that collapsed them.
  const seen = new Set([RUN12, { ok: false, escalate: true, layer: "page", page: "/", cost: 0 }, { ok: false, escalate: true, layer: "addon", cost: 0 }]
    .map((b) => JSON.stringify(editBrowserReply(b, true).actions)));
  assert.equal(seen.size, 3, "two escalate shapes record the same action: " + [...seen].join(" | "));
});

test("an ordinary published edit prints and does NOT start a rewrite", () => {
  // THE OBSERVER PROVED ALIVE, in both directions: the recorder really does
  // stay quiet when nothing expensive happens, so the array above is a
  // reading of that reply rather than a reader that always pushes.
  const r = editBrowserReply({ ok: true, layer: "page", page: "/", files: 24, cost: 2 }, true);
  assert.equal(r.ok, true, "the success reply could not compose: " + r.why);
  assert.equal(r.shown, true, "a published edit stopped calling `finish`");
  assert.ok(r.text.includes("/"), "the success screen does not name the page: " + JSON.stringify(r.text));
  assert.ok(!r.actions.some((a) => /rewrite|PAID/.test(a)),
    "a published edit records a paid action: " + JSON.stringify(r.actions));
});
