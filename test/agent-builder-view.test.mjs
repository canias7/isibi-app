// THE AGENT BUILDER VIEW — the door under the profile menu, and the one property
// that has a consequence beyond a wrong-looking screen.
//
// This is the site builder's own UI (`public/`), not the agent runtime in
// `agent-builder/`: a menu row, a view, and a list stored in the browser. It is
// deliberately small, because the screen itself is unapproved and the owner
// directs its design — what is pinned here is the WIRING and the account wall,
// which are the parts a redesign must not quietly drop.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/chat.js", "utf8");

test("the profile menu opens the agent builder, and the view it names exists", () => {
  // The row, with the SAME act the other rows use — a view button that names a
  // view nothing renders is the recorded dead-control shape.
  const row = /<button class="pp-row" data-view="agents" data-act="view">/.exec(html);
  assert.ok(row, "the profile menu has no Agent builder row");
  assert.match(html, /<span class="pp-txt">Agent builder<\/span>/, "the row has no label");

  // `showView` builds the element id from the name, so the container must be
  // spelled to match or the view opens onto nothing.
  assert.match(html, /<div id="viewAgents" class="view view-agents"><\/div>/,
    "there is no #viewAgents for showView to activate");

  // And the name must be KNOWN, or showView's fallback sends it to the builder —
  // a menu row that silently lands somewhere else.
  const known = /const KNOWN_VIEWS = \[([^\]]*)\]/.exec(js);
  assert.ok(known, "KNOWN_VIEWS is gone");
  assert.match(known[1], /'agents'/, "'agents' is not a known view, so the row falls back to the builder");
  assert.match(js, /if \(name === 'agents'\) renderAgents\(\);/, "opening the view renders nothing");
});

test("EVERY ROW THE MENU OFFERS NAMES A VIEW THAT EXISTS — a census, not a spot check", () => {
  // Derived: whatever rows the menu grows, each one's target must be known and
  // have a container. Written this way so a row added later fails by existing.
  const named = [...html.matchAll(/data-view="([a-z]+)" data-act="view"/g)].map((m) => m[1]);
  assert.ok(named.length >= 2, `the reader found ${named.length} view rows, so this census proves nothing`);
  const known = /const KNOWN_VIEWS = \[([^\]]*)\]/.exec(js)[1];
  for (const v of new Set(named)) {
    if (v === "home") continue;                       // an alias for the builder, by design
    assert.match(known, new RegExp(`'${v}'`), `the menu offers "${v}", which is not a known view`);
    const id = "view" + v.charAt(0).toUpperCase() + v.slice(1);
    assert.ok(html.includes(`id="${id}"`), `the menu offers "${v}", but there is no #${id} to show`);
  }
});

test("⚠ THE AGENT STORE IS WIPED ON AN ACCOUNT SWITCH, or one customer sees another's agents", () => {
  // This is the whole reason this file exists. The agents are held in
  // localStorage, which belongs to the BROWSER and not to the account — so a
  // second person signing in on the same machine inherits the first one's list
  // unless the key is dropped with the rest of the per-account cache. The other
  // keys in that list are sites and preferences; this one is somebody's written
  // instructions, which is worse to leak and just as easy to forget.
  const key = /const AGENTS_KEY = '([^']+)'/.exec(js);
  assert.ok(key, "AGENTS_KEY is gone");

  // The wipe list, read as a list rather than as a substring of the file: a
  // match anywhere would pass on the key merely being MENTIONED near it.
  const wipe = /\[SITES_KEY,([\s\S]{0,400}?)\]\s*\n\s*\.forEach\(\(k\) => localStorage\.removeItem\(k\)\)/.exec(js);
  assert.ok(wipe, "the account-switch wipe list is gone or has been reshaped — re-read it");
  assert.match(wipe[1], /\bAGENTS_KEY\b/,
    "AGENTS_KEY is not dropped when a different account signs in on this browser");

  // And the store is read defensively: a corrupt value is an empty list, never
  // a throw that takes the whole view down.
  assert.match(js, /function agentsAll\(\)[\s\S]{0,320}catch \{ return \[\]; \}/,
    "a corrupt agent store is not read as an empty list");
});

test("a nameless agent is refused rather than given a name of ours", () => {
  // The list is read by the name, so an invented one is a row nobody can find
  // again — and silently inventing data is worse than a refusal a person can act
  // on. Both fields are checked, and each refusal says which one.
  const save = js.slice(js.indexOf("function agentSave()"));
  assert.ok(save.startsWith("function agentSave()"), "agentSave is gone");
  const body = save.slice(0, save.indexOf("\n}\n"));

  // **EACH REFUSAL MUST RETURN, and that is the property rather than its
  // position.** The first version of this case asserted only that `if (!name)`
  // appeared before `list.push`, and a mutant that deleted the `return;` SURVIVED
  // it: the condition stayed exactly where the guard looked, the message was
  // still shown, and the nameless agent was written anyway. A position is not a
  // behaviour — this repository's own recorded trap, caught here by a sweep of
  // four breakages against a guard written minutes earlier.
  for (const field of ["name", "instructions"]) {
    const branch = new RegExp(`if \\(!${field}\\) \\{[^}]*\\breturn;[^}]*\\}`);
    assert.match(body, branch,
      `an agent with no ${field} is not refused with a return, so it is stored anyway`);
  }
  assert.ok(body.indexOf("if (!name)") < body.indexOf("list.push"),
    "the refusal comes after the write, so a nameless agent is stored anyway");
});
