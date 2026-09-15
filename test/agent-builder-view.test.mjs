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
  // a throw that takes the whole view down. RE-ANCHORED: the reader is
  // `agentsLocal` now, because what it reads is the LEGACY store rather than the
  // list the screen draws — the name moved with the meaning.
  assert.match(js, /function agentsLocal\(\)[\s\S]{0,320}catch \{ return \[\]; \}/,
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

test("⚠ A FAILED SAVE KEEPS WHAT WAS TYPED", () => {
  // The panel is rebuilt from `innerHTML` on every state change, so a draft that
  // lived only in the DOM would be wiped by the very re-render that shows the
  // error — somebody's paragraph of instructions, gone, with a sentence in its
  // place. `agentDraft` is written BEFORE anything can fail, including the two
  // local refusals, and the composer reads it back.
  const save = js.slice(js.indexOf("function agentSave()"));
  const body = save.slice(0, save.indexOf("\n}\n"));
  assert.ok(body.indexOf("agentDraft = { name, instructions }") > 0, "nothing keeps the draft");
  assert.ok(body.indexOf("agentDraft = { name, instructions }") < body.indexOf("if (!name)"),
    "the draft is kept after the first thing that can fail, so a refusal loses it");
  // On a failed request the draft must be LEFT, and the composer must stay open.
  const fail = /if \(!res\.ok \|\| !j\.ok\) \{([\s\S]{0,400}?)\n    \}/.exec(body);
  assert.ok(fail, "agentSave's failure branch is gone or reshaped — re-read it");
  assert.ok(!/agentDraft = null/.test(fail[1]), "a failed save throws the typed words away");
  assert.ok(!/agentEditing = null/.test(fail[1]), "a failed save closes the composer, so the words are unreachable");
  assert.match(fail[1], /say\(/, "a failed save says nothing");
  // And the composer really reads it back, for the agent it was typed against.
  assert.match(js, /const draft = \(agentDraft && agentDraftFor === agentEditing\) \? agentDraft : null;/,
    "the composer does not read the draft back, or reads one typed against another agent");
});

test("a failed send keeps the message in the box", () => {
  const send = js.slice(js.indexOf("async function agentSend()"));
  const body = send.slice(0, send.indexOf("\n}\n"));
  assert.ok(body.indexOf("agentMsgDraft = text") > 0, "the typed message is not kept");
  assert.ok(body.indexOf("agentMsgDraft = text") < body.indexOf("apiFetch("),
    "the message is kept only after the request, so a network failure loses it");
  // Cleared ONLY on success — and the box is drawn from it.
  const cleared = body.indexOf("agentMsgDraft = ''");
  assert.ok(cleared > body.indexOf("if (!res.ok || !j.ok)"),
    "the box is cleared before the server has the message");
  assert.match(js, /placeholder="Message ' \+ esc\(a\.name\) \+ '">' \+ esc\(agentMsgDraft\)/,
    "the box is not drawn from the draft, so a re-render wipes it");
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
  assert.match(js, /Nothing answers yet — no model is wired to this chat\./,
    "the thread does not say that nothing answers");
  // And the thread draws every bubble as the person's, with no branch on a role.
  assert.match(js, /'<div class="ag-msg ag-msg-you">'/, "the thread no longer draws the person's own message");
  assert.ok(!/ag-msg-agent|ag-msg-them|ag-msg-bot/.test(js), "there is markup for a reply nothing may write");
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
    for (const m of c.matchAll(/'(\/api\/agent\/[a-z]+)/g)) viaApiFetch.add(m[1]);
  }
  const paths = ["/api/agent/list", "/api/agent/create", "/api/agent/update",
    "/api/agent/delete", "/api/agent/messages", "/api/agent/message", "/api/agent/import"];
  for (const path of paths) {
    assert.ok(code.includes(path), `the client never calls ${path}`);
    assert.ok(viaApiFetch.has(path), `${path} is not inside an apiFetch call, so it carries no token`);
  }
  // Every path the client names is one of the seven — a typo would be a 404 the
  // customer reads as "couldn't save".
  const named = new Set([...code.matchAll(/'(\/api\/agent\/[a-z]+)/g)].map((m) => m[1]));
  assert.deepEqual([...named].sort(), [...paths].sort(), "the client calls an agent route that is not one of the seven");

  // And nothing in the agent screen reaches for a bare fetch at all.
  const block = code.slice(code.indexOf("const AGENTS_KEY"), code.indexOf("function renderSettings"));
  assert.ok(block.length > 5000, "the agent block was not found");
  assert.ok(!/\bfetch\(/.test(block.replace(/apiFetch\(/g, "apiFetch_")),
    "the agent screen calls fetch directly somewhere");
});
