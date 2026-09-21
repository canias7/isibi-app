// THE AGENT BUILDER VIEW — the door under the profile menu, and the one property
// that has a consequence beyond a wrong-looking screen.
//
// This is the site builder's own UI (`public/`), not the agent runtime in
// `agent-builder/`: a menu row, a view, and — since 2026-09-15 — a list that
// lives on the ACCOUNT rather than in this browser. It is deliberately small,
// because the screen itself is unapproved and the owner directs its design —
// what is pinned here is the WIRING and the account wall, which are the parts a
// redesign must not quietly drop.
//
// **FIVE CASES WERE RE-ANCHORED WHEN THE STORE MOVED, and every one names the
// property that moved rather than the spelling.** `agentSave` no longer pushes
// onto an array, so "the refusal comes before the write" became "the refusal
// returns before any request goes out"; `agentSend` no longer stamps a role,
// because nothing on the wire carries one at all and the column's own check is
// the wall; and `AGENT_THREAD_MAX` stopped being a storage bound and became the
// number the IMPORT may carry, because the server bounds the read now.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AGENT_ROUTES } from "../agent-store.mjs";

const html = fs.readFileSync("public/index.html", "utf8");
const js = fs.readFileSync("public/chat.js", "utf8");
// THE SHEET, because one of the properties below is a LAYOUT one and lives there:
// a row whose column count is pinned cannot take the badge the markup now draws.
const css = fs.readFileSync("public/styles.css", "utf8");

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
  // OPENING THE VIEW MUST RENDER *AND* ASK. `renderAgents()` alone would paint
  // whatever the last read left — "Loading…" for ever on a first open, and a row
  // for an agent deleted on another machine after that. Re-anchored when the
  // store moved; the render half is unchanged and the ask is the new half.
  const hook = /if \(name === 'agents'\) \{([^}]*)\}/.exec(js);
  assert.ok(hook, "showView no longer has an agents branch");
  assert.match(hook[1], /renderAgents\(\)/, "opening the view renders nothing");
  assert.match(hook[1], /agentsLoad\(/, "opening the view never asks the server, so it paints a stale list");
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

test("⚠ ONE CUSTOMER NEVER SEES ANOTHER'S AGENTS — and they are no longer destroyed to achieve it", () => {
  // **THIS CASE ASSERTED A DEFECT AS CORRECT, and it is the sharpest example in
  // this file of a guard cementing one requirement by breaking another.** It
  // demanded `AGENTS_KEY` be in the account-switch wipe list, which does keep
  // the next person from seeing the last one's written instructions — by
  // DELETING them. Those records are the only copy of agents written before
  // this screen had an account behind it, and one whose import has not been
  // pressed yet has nowhere else to exist.
  //
  // The property was never "delete them". It was "show them only to the account
  // they belong to", and that is a filter: `enterApp` stamps the outgoing uid on
  // to every unstamped record at the one moment that identity is known, and
  // `agentsLocal` answers only what the CURRENT account owns. Both halves hold
  // and nothing is lost. `test/agent-binding.test.mjs` drives it; what is
  // asserted here is the structure that makes it possible.
  const key = /const AGENTS_KEY = '([^']+)'/.exec(js);
  assert.ok(key, "AGENTS_KEY is gone");

  // The wipe list, read as a list rather than as a substring of the file: a
  // match anywhere would pass on the key merely being MENTIONED near it.
  const wipe = /\[SITES_KEY,([\s\S]{0,400}?)\]\s*\n\s*\.forEach\(\(k\) => localStorage\.removeItem\(k\)\)/.exec(js);
  assert.ok(wipe, "the account-switch wipe list is gone or has been reshaped — re-read it");
  assert.ok(!/\bAGENTS_KEY\b/.test(wipe[1]),
    "the account switch deletes what somebody typed instead of assigning it to them");
  // THE OBSERVER IS ALIVE: the list still wipes the per-account CACHES, so the
  // absence above is about this key rather than about the list being gone.
  assert.match(wipe[1], /\bVIEW_KEY\b/, "the wipe list stopped naming anything, so this proves nothing");

  // The replacement, asserted where it runs: the boot assigns, and the reader
  // filters. Either half alone is the defect back — assigning without filtering
  // shows them to everyone, filtering without assigning shows an unstamped
  // record to whoever arrives next.
  //
  // **RE-ANCHORED TWICE OVER, AND BOTH OLD ANCHORS WERE WRONG IN THE SAME WAY —
  // they read a SPELLING.** The assign was read as the 1,800 bytes after
  // `if (prevOwner && prevOwner !== uid)`, and a paragraph written inside that
  // branch pushed the call past the bound (the byte-window trap, again). And the
  // reader was pinned to `!a.uid || a.uid === uid`, which was the DEFECT itself:
  // letting an unstamped record pass for the current account is exactly how A's
  // agents reached B, once a sign-out had erased the marker that said they were
  // A's. `test/agent-binding.test.mjs` drives all of it; what is read here is the
  // structure, and the structure now has ONE ownership predicate.
  const at = js.indexOf("const prevOwner = localStorage.getItem('zephyr_owner_v1')");
  const end = js.indexOf("if (pendingSiteBrief)", at);
  assert.ok(at > 0 && end > at, "the boot's ownership block moved — re-read enterApp");
  const boot = js.slice(at, end);
  assert.match(boot, /agentsClaimFor\(prevOwner\)/,
    "the boot never assigns the records to the account the marker names");
  assert.match(boot, /agentsSealUnknown\(\)/,
    "a browser with no marker is not sealed, so its records go to whoever signs in");

  // THE ONE PREDICATE, and the two ways it must fail closed.
  const owns = /const agentOwns = ([^;]+);/.exec(js);
  assert.ok(owns, "the one ownership test is gone");
  assert.match(owns[1], /a\.uid === uid/, "ownership is no longer an exact match");
  assert.ok(!/!a\.uid/.test(owns[1]),
    "an unstamped record passes as the current account's again — that is the whole defect");
  assert.match(owns[1], /!!uid/, "a page with nobody signed in is shown records");
  assert.match(js.slice(js.indexOf("function agentsLocal()"), js.indexOf("function agentsLocal()") + 300),
    /agentOwns\(a, agentUid\(\)\)/,
    "the reader does not ask the ownership test, so one customer sees another's");
  // AND THE IMPORT ASKS IT TOO, in the action rather than only through the list.
  const act = js.slice(js.indexOf("async function agentImport()"));
  assert.match(act.slice(0, act.indexOf("apiFetch(")), /if \(!agentOwns\(a, agentUid\(\)\)\) continue;/,
    "the import can send a record the account does not own");

  // And the store is read defensively: a corrupt value is an empty list, never
  // a throw that takes the whole view down. RE-ANCHORED TWICE: the reader was
  // `agentsAll`, then `agentsLocal`, and is `agentsStored` now — `agentsLocal`
  // became the ACCOUNT'S view of it, so the defensive read moved under the raw
  // one. The property never changed.
  assert.match(js, /function agentsStored\(\)[\s\S]{0,320}catch \{ return \[\]; \}/,
    "a corrupt agent store is not read as an empty list");
});

test("⚠ NOTHING DELETES WHAT SOMEBODY TYPED INTO THIS BROWSER", () => {
  // The agents written before the store moved belong to whoever wrote them, and
  // the import is offered rather than performed. So the ONE thing this code may
  // do to that store is MARK a record as brought over — everything else about it
  // stays, including its messages, so a person can still go and look at what did
  // not come across.
  //
  // The account-switch wipe above is the single exception and is deliberate:
  // localStorage belongs to the browser, not the account.
  const writes = [...js.matchAll(/localStorage\.(removeItem|setItem)\(([A-Za-z_]+)/g)]
    .filter((m) => m[2] === "AGENTS_KEY");
  assert.ok(writes.length >= 1, "the scanner found no writes at all, so this proves nothing");
  const kinds = writes.map((m) => m[1]);
  assert.ok(!kinds.includes("removeItem"),
    "something removes the agents in this browser by key — only the account-switch wipe may, and it does it by list");

  // The one write, read in full: it MAPS the list and adds two fields. A write
  // that filtered, or that rebuilt a record from parts, would lose the messages.
  const mark = js.slice(js.indexOf("function agentMarkImported"));
  const body = mark.slice(0, mark.indexOf("\n}\n"));
  assert.ok(body.startsWith("function agentMarkImported"), "the mark is gone");
  assert.match(body, /\.map\(/, "the mark rewrites the store some other way than one-for-one");
  assert.match(body, /\{ \.\.\.a, imported:/, "the marked record does not keep the fields it had");
  assert.ok(!/\.filter\(/.test(body), "the mark drops records instead of marking them");
});

test("the import is offered ONLY once there is an account to put them in", () => {
  // **UPLOADING SOMEBODY'S WRITTEN INSTRUCTIONS INTO AN ACCOUNT WE CANNOT
  // ESTABLISH IS THE ONE MISTAKE HERE THAT CANNOT BE TAKEN BACK.** `ready` means
  // the server answered a list for a token it verified, so the offer is gated on
  // that and not on "we have a local list and a button".
  const offer = /const offerImport = ([^;]+);/.exec(js);
  assert.ok(offer, "the import offer is no longer decided in one place");
  assert.match(offer[1], /agentState === 'ready'/,
    "the import is offered before the server has confirmed whose account this is");
  assert.match(offer[1], /pending\.length > 0/, "the import is offered with nothing to import");
  // And what it counts is the UNIMPORTED ones, so a second press offers nothing.
  assert.match(js, /const agentsToImport = \(\) => agentsLocal\(\)\.filter\(\(a\) => !a\.imported\)/,
    "the offer counts records that have already been brought over");
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
  // RE-ANCHORED: there is no `list.push` any more — the write is a request. The
  // property is the same and is now about the REQUEST: both refusals sit above
  // `apiFetch`, so a nameless agent never reaches the server.
  assert.ok(body.includes("apiFetch("), "agentSave no longer writes anything");
  assert.ok(body.indexOf("if (!name)") < body.indexOf("apiFetch("),
    "the refusal comes after the request, so a nameless agent is sent anyway");
  assert.ok(body.indexOf("if (!instructions)") < body.indexOf("apiFetch("),
    "an agent with no instructions is sent anyway");
});

test("⚠ A LIST ROW CAN GAIN A BADGE WITHOUT WRAPPING", () => {
  // **CAUGHT BY RENDERING IT, WHICH IS THE ONLY INSTRUMENT THAT COULD.** `.ag-row`
  // pinned `grid-template-columns` to exactly four — avatar, meta, time, chevron —
  // so the day the markup gained a fifth child (the Paused chip) that child wrapped
  // onto a second grid row and took the chevron with it: one row in the list a head
  // taller than its neighbours, with every assertion about the markup still green.
  //
  // THE VALUE IS READ, NOT THE PROPERTY'S PRESENCE. A rule that names
  // `grid-template-columns` and nothing else is the defect; what makes the row
  // tolerant is the trailing columns being IMPLICIT.
  const rule = /\.ag-row \{([^}]*)\}/.exec(css);
  assert.ok(rule, ".ag-row is gone — re-read the sheet");
  assert.match(rule[1], /grid-auto-flow:\s*column/,
    "the row pins its columns, so a fifth child wraps onto a second line");
  // AND THE RELATIONSHIP IS REAL: the chip really is a direct child of the row, so
  // the rule above is about the markup rather than about nothing.
  const row = /'<button class="ag-row"[\s\S]*?'<\/button>'/.exec(js);
  assert.ok(row, "the list row's markup is gone — re-read it");
  assert.match(row[0], /class="ag-chip"/, "the chip is not drawn on the row it is about");
});

test("⚠ A FAILED SAVE KEEPS WHAT WAS TYPED", () => {
  // The panel is rebuilt from `innerHTML` on every state change, so a draft that
  // lived only in the DOM would be wiped by the very re-render that shows the
  // error — somebody's paragraph of instructions, gone, with a sentence in its
  // place. `agentDraft` is written BEFORE anything can fail, including the two
  // local refusals, and the composer reads it back.
  const save = js.slice(js.indexOf("function agentSave()"));
  const body = save.slice(0, save.indexOf("\n}\n"));
  // ⚠ RE-ANCHORED OFF THE SPELLING AND ONTO THE PROPERTY — this was pinned to the
  // literal `agentDraft = { name, instructions }` and went red the day the draft
  // honestly gained two more fields. What matters is that the draft is written, that
  // it carries EVERY field the form can lose, and that it is written above the first
  // thing that can fail.
  const kept = /agentDraft = \{([^}]*)\}/.exec(body);
  assert.ok(kept, "nothing keeps the draft");
  const fields = kept[1].split(",").map((f) => f.trim().split(":")[0].trim()).filter(Boolean);
  /**
   * ⚠ **RE-ANCHORED A SECOND TIME, AND NOW IT IS DERIVED.** The first re-anchor moved off the
   * literal `agentDraft = { name, instructions }` and onto a hand-typed list of four — which
   * is the same trap one step along: it went red the day the form honestly gained a
   * time-zone field, about a draft that had correctly grown to carry it.
   *
   * The property is *the draft carries every field the form can lose*, and the one thing that
   * knows what the form can lose is `agentFormValues`, which READS them all off the DOM. So
   * the expectation comes from that function's own returned keys, and a field added to the
   * form is covered by existing rather than by somebody remembering this line.
   */
  const reader = js.slice(js.indexOf("function agentFormValues()"));
  const returned = /return \{([\s\S]*?)\n  \};/.exec(reader);
  assert.ok(returned, "agentFormValues does not return an object literal any more — re-read it");
  const canLose = [...returned[1].matchAll(/^\s{4}([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]);
  assert.ok(canLose.length >= 4, `the reader's own field list reads as ${JSON.stringify(canLose)}`);
  assert.deepEqual([...fields].sort(), [...canLose].sort(),
    "the draft does not carry every setting the form can lose");
  assert.ok(body.indexOf(kept[0]) < body.indexOf("if (!name)"),
    "the draft is kept after the first thing that can fail, so a refusal loses it");
  // RE-ANCHORED: `agentSave` no longer decides inside the response branch. It
  // records the failure, asks whether the composer is still the one it left, and
  // only then speaks — so the property is read off the block that RUNS on a
  // failure rather than off the `if` that detects one.
  const fail = /if \(failed\) \{([\s\S]{0,500}?)\n  \}/.exec(body);
  assert.ok(fail, "agentSave's failure branch is gone or reshaped — re-read it");
  assert.ok(!/agentDraft = null/.test(fail[1]), "a failed save throws the typed words away");
  assert.ok(!/agentEditing = null/.test(fail[1]), "a failed save closes the composer, so the words are unreachable");
  assert.match(fail[1], /say\(/, "a failed save says nothing");
  // AND IT IS BOUND: the composer it speaks into must be the one it left.
  assert.match(body, /if \(!agentSameEdit\(bound\)\)/,
    "a save that lands after the composer moved still writes into whatever is open");
  assert.ok(body.indexOf("if (!agentSameEdit(bound))") < body.indexOf("if (failed)"),
    "the binding is checked after the screen has already been written to");
  // And the composer really reads it back, for the agent it was typed against.
  assert.match(js, /const draft = \(agentDraft && agentDraftFor === agentEditing\) \? agentDraft : null;/,
    "the composer does not read the draft back, or reads one typed against another agent");
});

test("a failed send keeps the message in the box — and in the RIGHT box", () => {
  // RE-ANCHORED: one global draft became one PER CONVERSATION, which is the fix
  // for a second defect entirely — a global one is cleared or restored by an
  // answer for whichever conversation happens to return. The original property
  // (a failed send keeps what was typed) is asserted below it, unchanged.
  const send = js.slice(js.indexOf("async function agentSend()"));
  const body = send.slice(0, send.indexOf("\n}\n"));
  // RE-ANCHORED A SECOND TIME, ONTO THE PROPERTY. The write became a SETTER
  // (`agentDraftSet`) when a draft gained its account, so the old spelling reported a
  // working screen as broken. What matters is unchanged: the words are stored, under
  // this conversation and this account, BEFORE the request can fail.
  const kept = body.split("\n").find((l) => /agentDraftSet\(target, text/.test(l));
  assert.ok(kept, "the typed message is not kept");
  assert.match(kept, /bound\.uid/,
    "the draft is stored for whoever is signed in when it is written, not for the account that typed it");
  assert.ok(body.indexOf(kept) < body.indexOf("apiFetch("),
    "the message is kept only after the request, so a network failure loses it");
  // Cleared ONLY on success, and keyed on the conversation it was typed in —
  // never on "the box", which may be showing another agent by then.
  // RE-ANCHORED ONTO THE PROPERTY, not the statement. The line gained a second
  // delete — the SEND KEY goes with the draft — and pinning the old spelling
  // reported a working screen as broken. What matters is that the clear is inside a
  // `!failed` test and names the conversation.
  const clear = body.split("\n").find((l) => /if \(!failed/.test(l) && /agentDraftDrop\(target/.test(l));
  assert.ok(clear, "the draft is cleared without asking whether the send succeeded");
  // ⚠ AND THE KEY IS CLEARED IN THE SAME BREATH. Clearing it after a FAILURE makes
  // the next press a different press, so a message the server already holds gains a
  // second copy and a second run — the lost-response case turned into the duplicate
  // the key exists to prevent. It has to be the SAME condition, not a second one.
  assert.match(clear, /agentKeyDrop\(target/,
    "the send key outlives a failed send, so a retry becomes a new message");
  assert.ok(body.indexOf(clear) > body.indexOf("await apiFetch("),
    "the box is cleared before the server has the message");
  // ⚠ AND A MISMATCH IS NOT A SUCCESS FOR THE BOX. An absorbed press whose words
  // differ answers `ok`, so clearing on `!failed` alone throws away an edit the server
  // never stored — the words have to survive that answer too.
  assert.match(clear, /!mismatched/,
    "an absorbed press with different words clears the box, losing the edit");
  assert.match(js, /placeholder="Message ' \+ esc\(a\.name\) \+ '">' \+ esc\(agentDraftOf\(a\.id\)\)/,
    "the box is not drawn from that conversation's own draft");
  // AND THE ANSWER IS BOUND: it may only write where it was sent from.
  assert.match(body, /if \(!agentSame\(bound\)\)/,
    "an answer lands in whatever conversation is open when it arrives");
});

test("a row opens the CONVERSATION, and the instructions move behind the pencil", () => {
  // The row used to open the editor. That was the wrong door once threads
  // existed: the list reads as a messages list, so the obvious click has to be
  // the conversation, and editing becomes a deliberate second act.
  // RE-ANCHORED onto the property: opening a row sets the thread and FETCHES it.
  // The old anchor was the function's whole body on one line, which an honest
  // extra statement — the fetch — breaks while changing nothing about the door.
  const open = js.slice(js.indexOf("function agentOpen(id) {"));
  const body = open.slice(0, open.indexOf("\n}\n"));
  assert.ok(body.startsWith("function agentOpen(id) {"), "agentOpen is gone");
  assert.match(body, /agentEditing = null/, "a row opens the editor rather than the conversation");
  assert.match(body, /agentThread = String\(id \|\| ''\)/, "a row does not open a thread");
  assert.match(body, /agentThreadLoad\(/, "the thread is opened but never read, so it is always empty");
  assert.match(js, /'agent-edit': \(e, el\) => agentEdit\(el\.dataset\.id\)/,
    "there is no way to reach the instructions from a thread");
  assert.match(js, /data-act="agent-edit"/, "the thread header has no edit control");
});

test("⚠ NOTHING PRETENDS TO ANSWER, and the thread says so before you send", () => {
  // The whole screen is honest only if this holds: no model is wired to it, so
  // a reply bubble from the agent — even one saying "not wired up" — would be
  // this repository's recorded dead control one step worse, a control that
  // ANSWERS, wrongly. Every message written is the person's own.
  // **RE-ANCHORED, AND THE NEW PROPERTY IS STRONGER.** The old case asserted
  // `role: 'you'` on the stored record. Nothing on the wire carries a role at
  // all now — `agent-store.mjs` sends none, so the column's own
  // `check (role = 'user')` decides and a reply is impossible rather than merely
  // absent. What this asserts is therefore the ABSENCE, across the whole client:
  // no speaker is ever named, so there is no field for one to be got wrong in.
  const speaker = /role:\s*['"](?:agent|assistant|system|bot)['"]/;
  assert.ok(!speaker.test(js), "the client names a speaker other than the person");
  const send = js.slice(js.indexOf("async function agentSend()"));
  const body = send.slice(0, send.indexOf("\n}\n"));
  assert.ok(!/role:/.test(body), "a sent message carries a speaker, which the server decides");
  // **RE-ANCHORED, AND THE SUBJECT CHANGED RATHER THAN MOVED.** Something DOES
  // answer now: a real run, really queued, really executed, really recorded — whose
  // words come from a stand-in. So the property is no longer "nothing answers"; it
  // is that a stand-in is never presented as an AI, said in the chrome AND in every
  // answer's own text. Both are asserted, and the redundancy is deliberate: the
  // chrome's label is gone the moment somebody copies an answer into an email.
  assert.match(js, /No model is connected yet, so replies are stand-in test results rather than/,
    "the thread does not say its replies are stand-ins");
  assert.match(js, /class="ag-sim"/, "there is no label on the answer itself");
  assert.match(js, /run\.simulated/,
    "the label is not read from the run, so it cannot stop when a real provider answers");
  // AND IT IS NOT A CONSTANT OR A STRING SNIFF. A label hardcoded `true` would keep
  // saying "simulated" over a real answer; one read out of the answer's text would
  // stop the day the text is reworded.
  assert.ok(!/simulated:\s*true/.test(js), "the label is a constant rather than a fact about the run");
  assert.ok(!/startsWith\(\s*['"]\[simulated/.test(js), "the label is sniffed out of the answer's words");
  // The thread draws the person's own message, and the agent's side is the RUN —
  // never a message row, because nothing may write one.
  assert.match(js, /'<div class="ag-msg ag-msg-you">'/, "the thread no longer draws the person's own message");
  assert.match(js, /'<div class="ag-msg ag-msg-bot">'/, "the thread draws nothing for the work it started");
  assert.ok(!/ag-msg-agent|ag-msg-them/.test(js), "there is markup for a speaker the database refuses");
});

test("the bound moved to the import, and an empty message is still not sent", () => {
  // **RE-ANCHORED, AND THE CAP CHANGED MEANING.** It existed because an
  // unbounded thread in `localStorage` does not merely grow — it throws on write
  // and takes the sites list with it. The server bounds the READ now
  // (`MAX_THREAD`), so the one place the browser still decides how many messages
  // it hands over is the IMPORT, and that is where the cap has to be applied.
  const cap = /const AGENT_THREAD_MAX = (\d+);/.exec(js);
  assert.ok(cap, "the import has no cap");
  assert.ok(Number(cap[1]) > 0 && Number(cap[1]) <= 1000, `the cap is ${cap[1]}, which is not a bound`);
  const imp = js.slice(js.indexOf("async function agentImport()"));
  const impBody = imp.slice(0, imp.indexOf("\n}\n"));
  assert.ok(impBody.startsWith("async function agentImport()"), "the import is gone");
  assert.match(impBody, /\.slice\(-AGENT_THREAD_MAX\)/, "the cap is declared but never applied");

  const send = js.slice(js.indexOf("async function agentSend()"));
  const body = send.slice(0, send.indexOf("\n}\n"));
  assert.match(body, /if \(!text\) \{[^}]*return; \}/, "an empty message is sent rather than refused");
  assert.ok(body.indexOf("if (!text)") < body.indexOf("apiFetch("),
    "the empty check comes after the request");
});

test("loading, empty and failed are three different screens", () => {
  // A read that FAILED must never draw "No agents yet": that reads as the
  // account having been emptied, which is the one wrong thing this screen can
  // say. `null` for "not asked" against `[]` for "this account has none" is what
  // keeps the three apart — an empty Set and an uninitialised one, again.
  const load = js.slice(js.indexOf("async function agentsLoad("));
  const body = load.slice(0, load.indexOf("\n}\n"));
  assert.ok(body.startsWith("async function agentsLoad("), "the list read is gone");
  // ON FAILURE THE ROWS ARE LEFT ALONE. A read that fails after a good one keeps
  // showing the list it had; a first one that fails shows the error.
  const fail = body.slice(body.indexOf("if (!res.ok || !j.ok)"), body.indexOf("} else {"));
  assert.ok(fail.length > 20, "the failure branch is gone or reshaped — re-read it");
  assert.ok(!/agentRows = /.test(fail), "a failed read overwrites the list it already had");
  assert.match(fail, /agentState = 'error'/, "a failed read does not record that it failed");

  assert.match(js, /const waiting = rows === null && agentState === 'loading';/, "there is no loading state");
  assert.match(js, /const failed = agentState === 'error' && rows === null;/, "there is no error state");
  for (const words of ["Loading your agents", "Couldn’t load your agents", "No agents yet"]) {
    assert.ok(js.includes(words), `the list never says "${words}"`);
  }
  // The way out of the error, on both screens, from one rule.
  assert.match(js, /data-act="agent-reload"/, "a failed list read has no way to try again");
  assert.match(js, /data-act="agent-thread-retry"/, "a failed thread read has no way to try again");
});

test("every write goes through apiFetch, so the token rides and a 401 opens the gate", () => {
  // `apiFetch` attaches the bearer token and shows the sign-in gate on a 401. A
  // bare `fetch` to one of these routes would be an unauthenticated call that
  // fails silently — and the route would answer 401 to a signed-in person.
  //
  // CHUNKED BY THE NEXT `apiFetch(`, not by what sits in front of a path. The
  // first version read the 60 characters before each path and demanded they end
  // in `apiFetch('`, which reported two correct calls as bare: one carries its
  // path inside a ternary (`editing ? '/api/agent/update' : '/api/agent/create'`)
  // and one has the query string appended. A path's neighbours are not the
  // property — being inside an `apiFetch` call is.
  const code = js.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  const chunks = code.split("apiFetch(").slice(1).map((c) => c.slice(0, 300));
  const viaApiFetch = new Set();
  for (const c of chunks) {
    // `[a-z-]+`, NOT `[a-z]+`: the automation routes carry a hyphen, and a charset
    // that stops at one matched the shorter prefix and reported every one of them as
    // never called from the screen.
    for (const m of c.matchAll(/'(\/api\/agent\/[a-z-]+)/g)) viaApiFetch.add(m[1]);
  }
  // **DERIVED FROM `AGENT_ROUTES`, NOT LISTED.** It was a hand-typed list of seven
  // and went red the day an eighth route arrived — the recorded "a check that
  // hardcodes what the product exports is a second copy of it". A route added to the
  // server and never called from the screen now fails by existing, which is the
  // property that was wanted all along.
  //
  // `/api/agent/message` IS DECLARED SERVER-ONLY, deliberately. It saves a message
  // WITHOUT starting a run — which is what the import's rows are and what an offline
  // path would need — and the screen does not use it, because every message somebody
  // types is meant to be answered. It is kept rather than deleted: it is reachable
  // from outside and is the only operation that can add to a conversation without
  // spending work on it.
  /**
   * ⚠ **`/api/agent/connection-revoke` IS SERVER-ONLY, AND WHICH LIST IT GOES ON IS THE
   * INTERESTING PART.** A person does not withdraw their own access — they DISCONNECT, which
   * this screen does — so a revocation records something the FAR END did, and the screen is
   * never meant to be the thing that says so. Putting it on `NO_SCREEN_YET` would claim a
   * control is coming that nobody has any reason to build.
   *
   * It is kept rather than deleted for the same reason `/api/agent/message` is: it is the only
   * way to record that state at all, which a provider's own callback would use and which the
   * demonstration uses to produce a revoked connection and check what a workflow says about
   * one. **And the two acts stay two routes**: a disconnect destroys the credential at the
   * owner's request and a revocation records the provider refusing, and they need different
   * remedies, so one door with a flag would be two facts wearing one word.
   */
  const SERVER_ONLY = ["/api/agent/message", "/api/agent/connection-revoke"];
  /**
   * ⚠ ROUTES THAT EXIST AND HAVE NO SCREEN YET — a SEPARATE list from `SERVER_ONLY`, because
   * they are separate facts and collapsing them would state something untrue.
   *
   * ⚠ **IT IS EMPTY, AND THAT IS THE MILESTONE RATHER THAN A TIDY-UP: every `/api/agent/*`
   * route a person is meant to touch is now reached from a screen.** It went 9 → 4 when the
   * execution history and the arrivals panel arrived, and 4 → 0 with the pending-approval and
   * revoked-access controls — the last four being `tool-withdraw`, `tool-revoke`,
   * `tool-restore` and `revoked-tools`.
   *
   * **THE MECHANISM STAYS, because a route may again land before its screen** — that ordering
   * is deliberate here, not an accident — and an empty list is what says none is waiting.
   *
   * `SERVER_ONLY` means *the screen is never meant to call this*, which is the opposite fact:
   * a person is exactly who takes a tool away or stops a run, so putting one of those on it
   * would record a design decision nobody made, and leaving a deferred route out of both
   * lists would force a screen to be invented to keep a test green.
   *
   * **AND THE LIST IS AUDITABLE, WHICH IS THE WHOLE POINT**: every name has to be a real
   * route, so a typo cannot quietly exempt one that does exist, and the list SHRINKS as the
   * screen arrives rather than being forgotten.
   *
   * ⚠ **NO MUTANT GUARDS THIS LIST, and that is declared rather than left to be discovered.**
   * A mutation of it is a mutation of a TEST FILE, and nothing outside `scripts/mutants/`
   * reads this file — so no shape of it changes any OTHER test's result: emptying the loop, or
   * exempting these routes by a regex instead of by the list, is invisible from outside.
   * The recorded answer is to give a property an observable half and mutate THAT, and there
   * is none here: the property is about which names a guard exempts. What stands in its place
   * is the two assertions below being present and this paragraph saying so.
   *
   * ⚠ **ONE SHAPE IS CAUGHT, THOUGH — inside this file, and it is the one that matters.** A
   * route left on the list AFTER its screen arrives fails the census below on its own, because
   * a name here must not already be called: driven, putting `/api/agent/run-cancel` back turns
   * this file red. So the list SHRINKING is enforced, and what is unguarded is only the
   * opposite direction — a route dropped from the list while it still has no screen, which is
   * a claim about design intent rather than about code. This paragraph said "every shape is
   * inert by construction" until that breakage was driven; it was overstated.
   */
  const NO_SCREEN_YET = [];
  // ⚠ **`/api/agent/run-cancel`, THE FOUR ENDPOINT ROUTES AND THEN THESE FOUR CAME OFF THIS
  // LIST**, which is the list doing what it was built to do: *it SHRINKS as the screen
  // arrives rather than being forgotten*. The assertion below — that a deferred name must not
  // already be called — is what turned each of the nine into a red run until it was removed.
  //
  // ⚠ **AN EMPTY LIST MEANS THE LOOP OVER IT ASSERTS NOTHING, so the claim is made the other
  // way round and POSITIVELY.** `for (const p of [])` is the recorded dead observer, and with
  // the list empty every rule below about it is vacuous — so the four this round removed are
  // named here and each must really be CALLED. That is the live half: it fails if a control
  // is deleted, where the loop above it could only fail if a name were put back.
  const GAINED_A_SCREEN = ["/api/agent/tool-withdraw", "/api/agent/tool-revoke",
                           "/api/agent/tool-restore", "/api/agent/revoked-tools"];
  const paths = Object.keys(AGENT_ROUTES)
    .filter((p) => !SERVER_ONLY.includes(p) && !NO_SCREEN_YET.includes(p));
  assert.ok(paths.length >= 6, `the census is looking at only ${paths.length} routes`);
  // ⚠ MATCHED AT A PATH BOUNDARY, because `/api/agent/messages` CONTAINS
  // `/api/agent/message` — the recorded "a needle that can match a longer name
  // cannot prove a class", met here on the first try: a bare `includes` reported the
  // thread read as a call to the route it is declared not to call.
  const called = (path) => new RegExp(`['"\`]${path.replace(/\//g, "\\/")}(?=['"\`?])`).test(code);
  for (const p of SERVER_ONLY) {
    assert.ok(Object.hasOwn(AGENT_ROUTES, p), `${p} is declared server-only and does not exist`);
    assert.ok(!called(p), `${p} is declared server-only and the screen calls it`);
  }
  // ⚠ EVERY DEFERRED NAME MUST BE A REAL ROUTE, or a typo exempts a route that exists while
  // the list claims to account for it. And when the screen does arrive, the name comes OFF
  // this list rather than the route quietly staying exempt — which is what the second
  // assertion is for: a route on this list that the screen already calls is a stale entry.
  for (const p of NO_SCREEN_YET) {
    assert.ok(Object.hasOwn(AGENT_ROUTES, p), `${p} is deferred and does not exist`);
    assert.ok(!called(p), `${p} is on the no-screen-yet list and the screen calls it — take it off`);
  }
  // THE FOUR THIS ROUND GAVE A SCREEN, each asserted to be reached — see the paragraph above
  // `GAINED_A_SCREEN` for why this is the assertion that carries the weight now.
  for (const p of GAINED_A_SCREEN) {
    assert.ok(Object.hasOwn(AGENT_ROUTES, p), `${p} gained a screen and does not exist`);
    assert.ok(!NO_SCREEN_YET.includes(p), `${p} has a screen and is still deferred`);
    assert.ok(called(p), `${p} has a screen and nothing in chat.js calls it`);
  }
  // THE OBSERVER, PROVED ALIVE IN BOTH DIRECTIONS: the matcher finds a route the
  // screen really does call, and refuses one that only shares a prefix with it.
  assert.ok(called("/api/agent/messages"), "the path matcher cannot see a call the screen makes");
  // ⚠ **THE TOKEN PROPERTY IS ASKED OF THE FILE'S TRANSPORT, NOT OF EACH PATH'S
  // NEIGHBOURS — RE-ANCHORED, NOT APPEASED (2026-09-21).** It used to demand each path
  // literal sit inside an `apiFetch(` chunk, and a browser journey's own fix broke that
  // premise honestly: `agentAutoDoor` picks between two approval doors and hands
  // `door.path` to `apiFetch`, so neither literal is at the call site and two working,
  // token-carrying calls came back as bare. The recorded *a route reached through a helper
  // has no literal there*, met for the third time in this repository.
  //
  // What replaces it is STRICTLY STRONGER and needs no dataflow: **`public/chat.js`
  // contains exactly ONE `fetch(` call and it is the one inside `apiFetch`.** If that
  // holds, every request the screen makes carries the bearer and opens the gate on a 401
  // — however the path got there, through a literal, a ternary, a chooser or a variable.
  // No other transport may exist either, or the claim would be about one door of several.
  const fetches = [...code.matchAll(/\bfetch\s*\(/g)]
    .filter((m) => !/apiFetch\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index)))
    .filter((m) => !/\.\s*$/.test(code.slice(Math.max(0, m.index - 2), m.index)));
  assert.equal(fetches.length, 1,
    `chat.js should have exactly one fetch() — the one inside apiFetch — and has ${fetches.length}`
    + ` at line(s) ${fetches.map((m) => code.slice(0, m.index).split("\n").length).join(", ")}`);
  // ⚠ **LANDMARK TO LANDMARK, NEVER A BYTE COUNT.** The first version sliced 700 characters
  // from the header, which is the window this repository forbids in as many words — and
  // `apiFetch` carries a fifteen-line comment inside it, so the next sentence added there
  // would have pushed the 401 gate out of view and reported a correct transport as broken.
  // It closes on the next top-level function, and BOTH ends are asserted found.
  const atFetch = code.indexOf("async function apiFetch(");
  assert.ok(atFetch >= 0, "apiFetch is not declared where this test looks for it");
  const afterFetch = code.indexOf("\nfunction ", atFetch);
  assert.ok(afterFetch > atFetch, "apiFetch has no following top-level function to close on");
  const inside = code.slice(atFetch, afterFetch);
  assert.ok(inside.length < code.length / 20,
    `the apiFetch window is ${inside.length} of ${code.length} characters — it swallowed the file`);
  assert.ok(inside.includes("await fetch("), "the one fetch() is not the one inside apiFetch");
  // ⚠ ASKED OF THE CALL, NOT OF THE FILE — a red proof caught this as a spelling. Dropping
  // the headers from the `fetch(...)` while leaving `headers['Authorization'] = 'Bearer '`
  // three lines above it left the old assertion GREEN over a transport that sends no token.
  // The property is that the bearer is BUILT and that what was built REACHES the call.
  assert.ok(/headers\['Authorization'\]\s*=\s*'Bearer '/.test(inside),
    "apiFetch stopped building the bearer header");
  const call = inside.slice(inside.indexOf("await fetch("));
  assert.ok(/await fetch\([^;]*\bheaders\b[^;]*\)/.test(call.slice(0, call.indexOf(";") + 1)),
    "apiFetch builds the bearer header and does not hand it to fetch");
  assert.ok(inside.includes("401") && inside.includes("showAuthGate"),
    "apiFetch stopped opening the gate on a 401");
  // AND NO SECOND TRANSPORT, because "the only fetch" says nothing about the others.
  for (const other of ["XMLHttpRequest", "sendBeacon", "EventSource", "new Request("]) {
    assert.ok(!code.includes(other), `chat.js reaches the network another way: ${other}`);
  }
  // THE OBSERVER, so the two assertions above are not satisfied by a scan that matched
  // nothing: the chunker really found `apiFetch` calls, and enough of them to be reading
  // this file rather than an empty string.
  assert.ok(chunks.length >= 20, `the apiFetch chunker found only ${chunks.length} calls`);
  assert.ok(viaApiFetch.size >= 6, `the path reader found only ${viaApiFetch.size} paths`);

  for (const path of paths) assert.ok(called(path), `the client never calls ${path}`);
  // A path NOT found as a literal at an `apiFetch` call site is REPORTED rather than
  // refused: the one-fetch property above already covers it, and the ordinary shape is
  // still worth knowing about, because it is where a new bare `fetch` would appear first.
  const chosen = paths.filter((p) => !viaApiFetch.has(p));
  assert.ok(chosen.length <= 4,
    `${chosen.length} paths reach apiFetch through an indirection (${chosen.join(", ")})`
    + " — that is more than this screen is known to have, so check them by hand");
  // Every path the client names is one this module really handles — a typo would be a
  // 404 the customer reads as "couldn't save".
  //
  // ⚠ `[a-z-]+`, NOT `[a-z]+`, AND THIS IS THE SECOND COPY OF THAT NEEDLE IN ONE TEST.
  // The charset stops at a hyphen, so every `automation-*` path matched as the shorter
  // prefix `/api/agent/automation` and the census reported seven routes the screen
  // really does call as ones it names and does not handle. Fixing the first occurrence
  // left this one wrong and the test still red — *a needle written twice is wrong twice*,
  // which is why the message below no longer counts them either.
  const named = new Set([...code.matchAll(/'(\/api\/agent\/[a-z-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...named].sort(), [...paths].sort(), "the client calls an agent route this module does not handle");

  // And nothing in the agent screen reaches for a bare fetch at all.
  const block = code.slice(code.indexOf("const AGENTS_KEY"), code.indexOf("function renderSettings"));
  assert.ok(block.length > 5000, "the agent block was not found");
  assert.ok(!/\bfetch\(/.test(block.replace(/apiFetch\(/g, "apiFetch_")),
    "the agent screen calls fetch directly somewhere");
});
