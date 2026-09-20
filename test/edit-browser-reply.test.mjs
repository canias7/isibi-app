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
    assert.ok(body.length > 200 && body.length < 40000, "re-derive " + name + "'s window: " + body.length + " bytes");
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
