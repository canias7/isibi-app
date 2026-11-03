// The router that lets the builder be asked a question.
//
// Before this, `siteSend` had one decision in it and every message on an
// existing site ran a full rebuild — so a question cost ~21 credits and
// rewrote the customer's site. The failure mode this file guards is the
// opposite one: a router that swallows a real build request is worse than no
// router at all, because the customer cannot tell it from the builder being
// broken.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { modelsFor } from "../builder/build-models.mjs";
import { ASK_TOOL, MIN_OPTIONS, MAX_OPTIONS, EDIT_LAYERS, REMOVABLE_LAYERS } from "../builder/route-shared.mjs";
import { MAX_INPUT_CHARS } from "../builder/input-budget.mjs";
import { CONVERSE_SYSTEM } from "../builder/site-converse.mjs";
// ⚠ `editBrowserReply`, the browser's own edit composer executed — the add
// composer answers a plausible "✅ Done." for an edit body.
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };

const toolReply = (input, usage) => ({
  content: [{ type: "tool_use", name: "route_message", input }],
  usage: usage || { input_tokens: 900, output_tokens: 60 },
});

test("intent is required and answer is not", () => {
  // Reversed, every build request would have to carry a reply nobody shows.
  const req = ASK_TOOL.input_schema.required;
  assert.deepEqual(req, ["intent"]);
});

// ── wiring: the layers this feature has to be alive at ───────────────────────

const worker = () => fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = () => fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("the router is BILLED, and only when the model answered", () => {
  const src = worker();
  const i = src.indexOf('url.pathname === "/api/site/route"');
  // TO THE END OF THE HANDLER, not a fixed number of characters. A window sized
  // in bytes silently stops covering the thing it was written for the moment
  // somebody adds a comment above it — which is exactly what happened here.
  const end = src.indexOf("usage: routed.usage || undefined", i);
  assert.ok(i > 0 && end > i, "the routing handler moved; this guard checks nothing");
  const block = src.slice(i, end);
  // Charged on measured usage from the same price table as every other call —
  // this is the whole "every time a model is used, charge for it" rule, and a
  // routing call is not exempt for being cheap.
  assert.match(block, /pageCredits\(routed\.usage\)/, "the routing call is not metered");
  // COLLECTED, not merely asked for. `use_credits` refuses a bill larger than
  // the balance and debits zero, so a bare `useCredits` here would meter the
  // call and take nothing from anyone who is short.
  assert.match(block, /collectCredits\(auth, rCost\)/, "metered and never debited");
  // GUARDED on usage being present. `routeMessage` returns null usage when the
  // call failed, so this is where our-fault-is-our-cost lands on this path.
  assert.match(block, /if \(routed\.usage\)/, "a failed routing call would be billed");
});

// A named declaration's body, closed on the NEXT top-level declaration whatever
// it is called (2026-09-13). Lifted out of `routeBlock` below, which had already
// been re-anchored this way once, because two windows in this file closed on
// `"function buildActiveText("` — a literal that names a NEIGHBOUR — and that
// neighbour was deleted with the pre-React activity log. A missing END landmark
// is a window that swallows the file; here the guards had an alive check and
// failed loudly rather than quietly, which is the only reason this was a red run
// and not a silent one. Deriving the end is what stops the next neighbour's
// departure being either.
const declBlock = (src, from) => {
  const i = src.indexOf(from);
  const re = /\n(?:async )?function |\nconst |\nlet /g;
  re.lastIndex = i + 1;
  const m = re.exec(src);
  const end = m ? m.index : -1;
  assert.ok(i > 0 && end > i, from + " moved — this guard now checks nothing");
  return src.slice(i, end);
};

// The router's own body, to its closing brace rather than to a byte count.
const routeBlock = () => {
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  // THE CLOSING LANDMARK IS THE NEXT TOP-LEVEL DECLARATION, not a named
  // comment hundreds of lines on. It was `// What to say when a build could
  // not run.`, which sits past siteEdit, the watcher and the resume — so the
  // window swallowed every function between them, and stage 2b's resumed
  // tail (one more `s.msgs.push`, in `resumeOpenSite`) read as siteRoute
  // pushing a third message. The recorded overlapping-window trap; the end
  // is derived from the real neighbour now, whatever its name.
  const re = /\n(?:async )?function |\nconst |\nlet /g;
  re.lastIndex = i + 1;
  const m = re.exec(src);
  const end = m ? m.index : -1;
  assert.ok(i > 0 && end > i, "siteRoute moved; this guard checks nothing");
  return src.slice(i, end);
};

test("the composer asks before it builds: an empty project falls through to the build, a live site stops", () => {
  const src = chat();
  assert.match(src, /function siteRoute\(/, "the composer-side router is gone");
  // AND THE MESSAGE'S KEY SINCE 2026-10-03 (`siteMessageKey`), its last argument.
  assert.match(src, /siteRoute\(site, t, origin, isBuild, imgs, finish, undefined, undefined, key\)/, "siteSend no longer calls it");
  const block = routeBlock();
  // TWO RULES SINCE 2026-09-24, and the behaviour of both is DRIVEN through the
  // real send handler in test/site-route-failure.test.mjs. What is asserted
  // here is the shape that behaviour rests on.
  //
  // ON AN EMPTY PROJECT every failure mode still reaches the build: there a
  // router that swallows a build request is worse than no router, because the
  // customer cannot tell it from broken. Two fall-throughs, because the clarify
  // branch sits between them.
  assert.match(block, /if \(!r\.ok \|\| !d\) return go\(\)/, "a bad response on an empty project no longer builds");
  // RE-ANCHORED 2026-10-02: the fall-through hands on what an answered
  // question put off earlier (a live site's); an empty project's has none.
  assert.match(block, /if \(d\.intent !== 'ask' \|\| !d\.answer\) return go\(d\.putOff \? \{ putOff: d\.putOff \} : undefined\)/,
    "the empty project's fall-through has been narrowed — some failure now stops its first build");
  // ON A LIVE SITE that same fall-through was the rewrite of every page, bought
  // by a dropped request or an unreadable answer. The check has to come BEFORE
  // anything that sends: before the fall-through, the edit and the add-on.
  const check = block.indexOf("if (!isBuild && !(r.ok && routeActionable(d, site))) {");
  // (2026-11-01) inside it, only a request the server took on is followed; every other answer still stops.
  assert.ok(block.indexOf("      return lost(r);\n    }", check) > check, "the stop inside the check is gone");
  const sends = ["return go()", "siteEdit(", "siteAddon("].map((s) => block.indexOf(s));
  assert.ok(check > 0, "the live site's check on the routing answer is gone");
  for (const at of sends) assert.ok(at > check, "something that sends work now runs before the live site's check");
  // A THROWN FETCH TAKES THE SAME TWO RULES.
  assert.match(block, /\.catch\(\(\) => \(isBuild \? go\(\) : lost\(\)\)\)/,
    "a network failure no longer builds an empty project, or no longer stops on a live site");
  // AND THE CLARIFY BRANCH DRAWS WHAT THE ONE READER RETURNS. The check and the
  // branch both ask `routeQuestion`, and nothing in siteRoute reads the raw
  // question: a field the reader never looked at cannot reach the screen, which
  // is how a question with no words drew as "undefined" (owner, 2026-09-24).
  // What the reader refuses is DRIVEN, shape by shape, through the real send
  // handler in test/site-route-failure.test.mjs; this pins where it is asked.
  // Whole-line comments go first, so prose explaining the rule cannot read as
  // code breaking it — and the code this scan reads is proved still there.
  const code = block.replace(/^[ \t]*\/\/.*$/gm, "");
  assert.ok(code.includes("routeQuestion(d)") && code.includes("s0.msgs.push("), "the blanked block lost the code this scan reads");
  assert.ok(!/\.question\b/.test(code), "siteRoute reads the raw question: a field the reader never checked can reach the screen");
  // The raw question is read in exactly one place, and it is the reader.
  const reader = declBlock(src, "function routeQuestion(");
  assert.match(reader, /\.question\b/, "the reader no longer reads the question it answers for");
  // RE-ANCHORED 2026-10-02: A LIVE SITE'S QUESTION HAS ITS OWN READER, and the
  // same rule. The check and the live branch both ask `liveQuestion` — which
  // alone reads the raw question, holding it to the id it was kept under — and
  // `routeQuestion` stays the first build's, which the check never reaches.
  assert.ok(code.includes("liveQuestion(d)"), "the live branch no longer draws from the live reader");
  const live = declBlock(src, "function liveQuestion(");
  assert.match(live, /\.question\b/, "the live reader no longer reads the question it answers for");
  const actionable = declBlock(src, "function routeActionable(");
  assert.match(actionable, /liveQuestion\(d\)/, "the live site's check no longer asks the reader the branch draws from");
});

test("an answer renders as an ordinary message, with no build attached", () => {
  // A steps block over an answer claims a build that did not happen, and a
  // `build` field is what makes the thread render one.
  const block = routeBlock();
  // THE COMPACTION NOTE (2026-10-20) is a third push, said above a reply when the
  // chat was summarized for it: a plain line marked `compact`, never a build.
  const all = block.match(/s0?\.msgs\.push\(\{[^}]*\}\)/g) || [];
  const notes = all.filter((p) => /compact: true/.test(p));
  assert.equal(notes.length, 1, "the compaction note is gone from the route's reply");
  assert.ok(!/build:/.test(notes[0]), "the compaction note carries build steps");
  const pushes = all.filter((p) => !notes.includes(p));
  assert.equal(pushes.length, 2, "expected exactly the question push and the answer push: " + pushes.length);
  for (const p of pushes) {
    assert.ok(!/build:/.test(p), "neither a question nor an answer may carry build steps: " + p);
  }
  // The question push carries what makes it a question; the answer push does not,
  // or an ordinary reply would render buttons under it.
  const [question, answer] = pushes;
  assert.match(question, /q: /);
  assert.match(question, /opts: /);
  assert.ok(!/\bq: |\bopts: /.test(answer), "a plain answer is being rendered as a question: " + answer);
});

test("the balance refreshes after a routing charge", () => {
  // It debits before it answers, exactly like /api/direct — so it belongs on the
  // same list, or the ✦ pill silently drifts from the ledger.
  assert.match(chat(), /p === '\/api\/site\/route'/,
    "the router debits credits and nothing re-reads the balance");
});

test("EVERY builder message is routed, attachment or not", () => {
  // THIS ASSERTION HAS NOW BEEN WRONG TWICE, BOTH TIMES FOR THE SAME REASON: it
  // pinned the exact spelling of the routing condition, so it went red on a
  // correct change and said nothing about what it was protecting.
  //
  // The bypass it first pinned (`!imgs.length`) was too wide — it also skipped
  // the first-build question. Narrowed to revises-only, it was still a claim
  // about the LAYERS THAT EXISTED: "on a revise both non-build outcomes are
  // closed, so the call could only answer build". The `logo` layer made that
  // false — an attached picture plus "this is my logo" has a real cheap answer —
  // and a skip would have made that rung unreachable for the one message shape
  // it exists to serve.
  //
  // So the durable property is the one asserted here: NOTHING bypasses the
  // router, because a bypass is how a rung silently stops existing. The
  // narrower rule that a file is never answered with prose is a separate thing,
  // held one assertion down, where it belongs — at the router, not at the door.
  const c = chat();
  const j = c.indexOf("function siteSend(");
  assert.ok(j > 0, "siteSend is gone");
  const send = c.slice(j, c.indexOf("\nfunction ", j + 10));
  assert.match(send, /if \(reactPath\) \{ siteRoute\(/,
    "something is bypassing the router again — whatever it skips is a rung nobody can reach");
  assert.ok(!/imgs\.length[^\n]*siteRoute|siteRoute[^\n]*imgs\.length/.test(send),
    "the routing decision reads the attachments again, which is the bypass this replaced");
});

test("…and a file is still never answered with a paragraph", () => {
  // The half of the old rule that survives, and it is enforced at the ROUTER
  // rather than by refusing to call it: `attached` closes off `ask`, so a
  // message carrying a file always gets work back. Answering it with prose
  // drops the file on the floor, which is the original failure.
  // RE-ANCHORED 2026-10-02: an answer also counts the files its question's
  // request carried (`keptImgs`, none on a first build).
  assert.match(chat(), /attached:\s*!!\(\(imgs && imgs\.length\) \|\| keptImgs\.length\)/,
    "siteRoute drops the attachment flag, so `ask` is no longer closed off for a message with a file");
});

test("the digest the client sends is names only", () => {
  // Derived from the client rather than restated: a `collect` table's ROWS are
  // customer names and phone numbers, and this call fires on every message.
  const src = chat();
  const i = src.indexOf("const digest = {");
  assert.ok(i > 0, "the digest has been renamed or inlined");
  const block = src.slice(i, src.indexOf("};", i));
  for (const leak of ["rows", "msgs", "html", "conn", "brief"]) {
    assert.ok(!new RegExp("\\b" + leak + "\\b").test(block), leak + " reached the routing call: " + block);
  }
});

test("THE DIGEST'S TABLE LIST IS FED — the client stores what the responses name", () => {
  // The routing tool conditions its edit-vs-addon tie-break and its cheapest
  // "data" layer on "the tables it has are named above" — and nothing in the
  // client ever WROTE site.tables, so the digest sent `tables: []` on every
  // message of every site and the router decided blind on the one fact that
  // separates a free data edit from a ~25-credit addon (2026-08-14 audit).
  // Invisible to edit-smoke, whose digest is built from the build response's
  // own tables field — a fixture more capable than reality.
  const src = chat();
  // The digest reads site.tables (the consumer)…
  const i = src.indexOf("const digest = {");
  const dig = src.slice(i, src.indexOf("};", i));
  assert.match(dig, /site\.tables/, "the digest no longer reads site.tables");
  // …and BOTH producers write it: the build finish handler and the addon
  // handler. A UNION, never a replace — a revise's response names the DELTA
  // the apply touched, and replacing would erase the rest of the site's list.
  const fin = src.indexOf("if (r.ok && d && d.error !== true && d.slug) {");
  assert.ok(fin > 0, "the build finish handler moved — rescope this");
  // COMMENTS BLANKED before judging. The comment explaining this very fix
  // names `d.schema`, so an unblanked match passed while the code read only
  // `d.tables` — a mutant proved it, and it is the recorded shape (the og
  // guard's comment match): prose explaining a fix contains the fix's
  // spelling. Line comments only; the window holds no block comments and a
  // whole-file blanker on chat.js has its own recorded hazards.
  // BOTH HAND THEIR NAMES TO THE ONE PLACE AN ADDITION'S TABLES JOIN THE LIST
  // (`siteTablesAdd`, 2026-10-05, which also marks when they joined), and the
  // union is asserted there, below.
  const finBlock = src.slice(fin, src.indexOf("siteSnap(s, t);", fin)).replace(/\/\/[^\n]*/g, "");
  assert.match(finBlock, /siteTablesAdd\(s, tnames\);/,
    "the build response's table names are not merged into the site record");
  assert.match(finBlock, /d\.schema/, "the merged spec (d.schema) is not consulted — d.tables alone is the revise delta");
  const add = src.indexOf("function siteAddon(");
  assert.ok(add > 0, "siteAddon moved — rescope this");
  const addBlock = src.slice(add, src.indexOf("function sitePathOf(", add)).replace(/\/\/[^\n]*/g, "");
  assert.match(addBlock, /siteTablesAdd\(s, a\.tables\);/,
    "the addon lane adds tables and never tells the digest about them");
  const join = src.indexOf("\nfunction siteTablesAdd(");
  assert.ok(join > 0, "siteTablesAdd moved — rescope this");
  const joinBlock = src.slice(join, src.indexOf("\n}\n", join)).replace(/\/\/[^\n]*/g, "");
  assert.match(joinBlock, /s\.tables = \[\.\.\.new Set\(\[\.\.\.\(Array\.isArray\(s\.tables\) \? s\.tables : \[\]\), \.\.\.fresh\]\)\]/,
    "an addition's table names replace the site's list instead of joining it");
});

// ── what a build cost goes to the meter, not into the sentence ───────────────

test("no builder reply states what it cost", () => {
  // Owner's call 2026-08-08. Scoped to the two builder send paths rather than
  // the whole file — `openCredits` and the not-enough-credits messages legitimately
  // talk about the ✦ balance, and a file-wide check would forbid those too.
  const src = chat();
  for (const [name, from] of [
    ["the React engine", "function reactSend("],
    ["the router", "function siteRoute("],
  ]) {
    const block = declBlock(src, from).replace(/\/\/[^\n]*/g, "");
    assert.ok(!/✦'?\s*\+/.test(block), name + " still prints the cost into the reply");
    assert.ok(!/used\)/.test(block), name + " still appends a used-credits suffix");
  }
});

test("...and the meter is refreshed instead, which is the half that matters", () => {
  // REMOVING THE TEXT WITHOUT THIS IS THE BUG, not the fix. That suffix was the
  // ONLY signal a build had spent anything: the build response carries `cost`
  // and no `balance`, and nothing on that path ever called setCredits. Deleting
  // one without adding the other makes the spend invisible rather than quiet.
  // ONLY the React engine now. The legacy path was checked here too, and it no
  // longer spends anything: its POST went to `/api/site`, deleted 2026-07-27, so
  // it has been answering 404 to every message on a pre-React project. It makes
  // no request at all now, so there is no balance for it to re-read.
  const src = chat();
  for (const [name, from] of [
    ["the React engine", "function reactSend("],
  ]) {
    assert.match(declBlock(src, from), /scheduleCreditRefresh\(\)/,
      name + " spends credits and nothing re-reads the balance");
  }
  // And the retired path really does spend nothing — asserted, or "we removed
  // the refresh" and "we removed the spend" look identical here.
  const a = src.indexOf("function siteSend(");
  const b = src.indexOf("function siteStop(", a);
  assert.ok(a > 0 && b > a, "siteSend was renamed");
  assert.ok(!/apiFetch\(['"]\/api\/site['"]/.test(src.slice(a, b)),
    "the legacy engine is posting to a deleted route again");
});

test("the build routes stay OUT of apiFetch's refresh list", () => {
  // Not an oversight — a correctness requirement. apiFetch fires on the response
  // HEADERS, which on an NDJSON build is when the build STARTS; the charge lands
  // after publish, minutes later. A refresh there reads the pre-charge balance
  // and paints a number that is wrong in the reassuring direction.
  const src = chat();
  const i = src.indexOf("const p = path.split('?')[0];");
  const block = src.slice(i, i + 400);
  for (const route of ["/api/site/react-build", "/api/site/react-revise", "/api/site/build"]) {
    assert.ok(!block.includes(route), route + " would refresh the balance before the build has been charged");
  }
  // The router IS in it, and belongs there: a plain JSON response whose charge
  // is settled before it answers.
  assert.ok(block.includes("/api/site/route"));
});

test("the tool offers every intent and describes the question", () => {
  const p = ASK_TOOL.input_schema.properties;
  assert.deepEqual(p.intent.enum, ["build", "ask", "clarify", "edit", "addon"]);
  assert.equal(p.question.properties.options.minItems, MIN_OPTIONS);
  assert.equal(p.question.properties.options.maxItems, MAX_OPTIONS);
  assert.deepEqual(p.question.required, ["text", "options"]);
  // The enum is the only place `clarify` can come from, so the description has
  // to say when NOT to use it — a model given a third option uses it.
  assert.match(p.intent.description, /first build/i);
  assert.match(p.intent.description, /[Nn]ever on a change|already exists/);
});

test("the composer keeps the ORIGINAL brief across the round", () => {
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  const block = src.slice(i, src.indexOf("function buildDownMsg", i));
  assert.ok(block.length > 400, "siteRoute moved; this guard checks nothing");
  // The brief comes off the ROUND when there is one, and the build is sent that
  // — never `t`, which after a round is whichever button was clicked.
  // `let` SINCE 2026-10-02: on a live site an answered question runs its request
  // instead of the typed words. A first build's brief is still the round's.
  assert.match(block, /let brief = round \? round\.brief : t;/);
  assert.match(block, /if \(!isBuild && d\.ask && d\.ask\.answered === true\) \{\s+if \(typeof d\.instruction === 'string'\) \{ run = d\.instruction; brief = run; \}/,
    "the brief is replaced outside a live site's answered question");
  assert.match(block, /reactSend\(site, brief,/, "the build is sent the clicked answer instead of the brief");
  // The round ends when a build starts, or the next thing typed is read as an
  // answer to a question that is no longer on screen.
  assert.match(block, /s\.clarify = null/);
});

test("only a build sends the answers, and only the live question keeps its buttons", () => {
  const src = chat();
  const i = src.indexOf("const body = mode === 'build'");
  const body = src.slice(i, i + 900);
  const halves = body.split("slug: site.slug");
  assert.equal(halves.length, 2, "the build/revise split is no longer recognisable");
  assert.match(halves[0], /qa: qa \|\| \[\]/, "a build does not send the answers");
  assert.ok(!/\bqa:/.test(halves[1]), "a revise sends answers it can never have");

  // The buttons are rendered only while that question is live. Left on an
  // answered one, they offer a second answer to something already built.
  const a = src.indexOf("function siteAskHTML(");
  const askBlock = src.slice(a, src.indexOf("function siteAnswer(", a));
  assert.match(askBlock, /if \(!site \|\| !site\.clarify\) return ''/);
  assert.match(askBlock, /data-skip/, "there is no way past the questions");
  // PICK, THEN CONTINUE (option E, 2026-10-14): the answers are rows to pick, sent by Continue.
  assert.match(askBlock, /sitePickHTML\('first', sitePickKeyFirst\(site\)/, "a first build's answers are not drawn to pick");
  assert.match(askBlock, /'data-ask-pick' : 'data-pick'/);
  assert.match(askBlock, /'data-ask-go' : 'data-pick-go'/);
  // THE LAST QUESTION ONLY, and this is the one a mutation found nothing
  // holding. A round asks one at a time, so an earlier question left clickable
  // records an answer against the wrong `q` — the pair goes into the brief
  // attached to a question that was already answered two messages ago.
  assert.match(askBlock, /reverse\(\)\.find\(/, "the live question is no longer identified");
  assert.match(askBlock, /if \(!live \|\| live !== m\) return ''/,
    "every past question in the thread keeps its buttons");
});

test("a number picks the answer the card shows, Enter sends only a pick, and Esc still skips", () => {
  // PICK, THEN CONTINUE (the owner's option E, 2026-10-14) replaced the
  // numbered buttons that answered at once: a click picks and Continue sends,
  // so a key must do the same — a number that sent on its own would answer
  // where a click no longer does. No key hint is printed, so none can lie.
  const src = chat();
  const a = src.indexOf("function siteAskHTML(");
  const render = src.slice(a, src.indexOf("document.addEventListener('keydown'", a));
  assert.ok(render.includes("function sitePickHTML("), "the pick card moved; this guard checks nothing");
  assert.doesNotMatch(render, /<kbd>/, "a key hint is printed beside the picks");
  const k = src.indexOf("document.addEventListener('keydown'", a);
  const keys = src.slice(k, src.indexOf("\n});", k));
  assert.ok(keys.length > 300, "the key handler moved; this guard checks nothing");
  // The digit picks 1-based, bounded, off the SAME live question the card draws.
  assert.match(keys, /sitePick\(fkey, String\(opts\[n - 1\]\)\)/, "a number does not pick, or picks off by one");
  assert.match(keys, /n >= 1 && n <= opts\.length/, "a digit past the end of the list is still handled");
  assert.doesNotMatch(keys, /siteAnswer\(opts\[/, "a number answers at once again");
  assert.match(keys, /reverse\(\)\.find\(/, "the keys read a different question from the card");
  assert.match(keys, /e\.key === 'Escape'.*siteAnswer\('', true\)/s, "esc does not skip");
  // ENTER SENDS ONLY A PICK, and only after the text-field guard: in the
  // composer it is still the composer's own send key.
  // …AS A PICK (2026-10-14: `picked`, never read as conversation).
  assert.match(keys, /if \(e\.key === 'Enter'\) \{ const v = sitePickTake\(fkey\); if \(v\) \{ e\.preventDefault\(\); siteAnswer\(v, false, true\); \} return; \}/, "Enter sends something other than the pick");
  assert.ok(keys.indexOf("tag === 'textarea'") > 0 && keys.indexOf("tag === 'textarea'") < keys.indexOf("'Enter'"), "Enter is handled before the text-field guard");
});

test("the keys never fire where somebody is typing", () => {
  // THE WHOLE DIFFICULTY OF THIS TREATMENT. The composer is a text field and the
  // customer has just typed a brief into it, so a bare "1" bound globally would
  // put a digit in the box on some paths and answer a question on others.
  const src = chat();
  const k = src.indexOf("document.addEventListener('keydown'", src.indexOf("function siteAskHTML("));
  const keys = src.slice(k, src.indexOf("\n});", k));
  for (const guard of ["input", "textarea", "select", "isContentEditable"]) {
    assert.ok(keys.includes(guard), "typing into a " + guard + " would be swallowed");
  }
  // Modifiers are the browser's: Cmd+1 and Alt+1 switch tabs.
  assert.match(keys, /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey/, "a browser shortcut would be hijacked");
  // And only while a question is actually live — otherwise every digit typed
  // anywhere on the page would look for one.
  assert.match(keys, /if \(!site \|\| !site\.clarify \|\| siteBusy\) return;/,
    "the keys fire with no question on screen, or during a build");
});

test("the answers are one per line, which is why this layout was chosen", () => {
  // These are short sentences the model writes, not chips we choose, so any
  // row-based layout wraps unevenly on exactly the wording that turns up in
  // practice. A column cannot degrade — that was the decision.
  const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const i = css.indexOf(".st-opts {");
  assert.ok(i > 0, "the option styling is gone");
  assert.match(css.slice(i, i + 200), /flex-direction: column/, "the answers wrap in a row again");
  // The key chips are a FIXED width, or "esc" is wider than "1" and the labels
  // sit on a ragged left edge. Measured before this was pinned: 28px out.
  const kbd = css.indexOf(".st-opt kbd {");
  assert.ok(kbd > 0);
  assert.match(css.slice(kbd, kbd + 260), /width: [\d.]+em/, "the key hints are not a fixed width");
});

test("a typed reply during a round is an ANSWER, not a new brief", () => {
  // Typing instead of clicking is normal — the options cover the likely answers,
  // not every answer. Routed down the ordinary path it would start a fresh build
  // from those few words and lose the brief the round was about.
  const src = chat();
  const i = src.indexOf("function siteSend(");
  // TO A LANDMARK (2026-10-14: the media block grew above it), not a byte count.
  const block = src.slice(i, src.indexOf("const isBuild = !sitePages(site).length;", i));
  assert.ok(block.length > 100, "siteSend's landmark moved — re-anchor this check");
  assert.match(block, /if \(site\.clarify\) \{ siteAnswer\(t\); return; \}/);
  // And on a NEW project skipping goes STRAIGHT to the build — paying a model to
  // reclassify "just build it" is the one question too many the button exists
  // to avoid. (A site that exists never reaches the skip block: `siteAnswer`
  // routes its original request above it, test/site-entry-inventory.test.mjs.)
  const a = src.indexOf("function siteAnswer(");
  const ans = src.slice(a, src.indexOf("function siteSend(", a));
  // THE SKIP BLOCK, LANDMARK TO LANDMARK. This read `slice(indexOf("if (skip)"),
  // indexOf("siteRoute("))`, which was vacuous twice over: the slice stopped
  // just before the only `siteRoute(` it could have matched, and once the
  // existing-site branch put a `siteRoute(` ABOVE the skip block the slice ran
  // backwards and was empty.
  const sk = ans.indexOf("  if (skip) {");
  const skEnd = ans.indexOf("\n  }\n", sk);
  assert.ok(sk > 0 && skEnd > sk, "the skip block is gone");
  const skipBlock = ans.slice(sk, skEnd);
  assert.match(skipBlock, /reactSend\(site, round\.brief, origin, 'build'/, "the skip block does not build");
  assert.doesNotMatch(skipBlock, /siteRoute\(/, "the skip path calls the router");
});

test("the options must be the CUSTOMER's answers, not the assistant's next line", () => {
  // The other half of the same live failure: the model filled the buttons with
  // its own dialogue ("I'll come back with more details in a moment"), which
  // renders as a control that means nothing when pressed. And the question it
  // was attached to — "what does your business do?" — is open-ended, so there
  // were no answers to name in the first place.
  const opts = ASK_TOOL.input_schema.properties.question.properties.options.description;
  assert.match(opts, /never your own next sentence/i, "nothing stops the assistant's own lines becoming buttons");
  assert.match(opts, /IF YOU CANNOT NAME TWO OR THREE CONCRETE ANSWERS/,
    "an open-ended question can still be dressed up as a multiple choice");
  assert.match(opts, /answer "ask"/, "no route out for a question that has no options");

  // And the reply is told to answer what was SAID, because a stock opening line
  // in the description came back verbatim for a greeting, a "wassup" AND a
  // "thanks!" — three different messages, one identical reply.
  const ans = ASK_TOOL.input_schema.properties.answer.description;
  assert.match(ans, /ANSWER WHAT THEY ACTUALLY SAID/);
  // The cases are spelled out where the reply is written (2026-10-14).
  assert.match(CONVERSE_SYSTEM, /thank-you gets/i, "a thank-you and a greeting are still one case");
  assert.ok(!/Hey\. What are we building\?/.test(ans),
    "the stock line is back in the description and will be parroted verbatim");
});

test("the composer says a button press is an answer", () => {
  // The other half. `siteAnswer` is the ONLY caller that may set it — a plain
  // message must still be routable as a question, which is the whole feature.
  const c = chat();
  const i = c.indexOf("function siteAnswer(");
  assert.ok(i > 0, "siteAnswer is gone");
  const body = c.slice(i, c.indexOf("\nfunction ", i + 10));
  assert.match(body, /siteRoute\(site, said, origin, true, imgs, finish, true, undefined, undefined, picked === true\)/,
    "the composer no longer tells the server this is an answer, and whether it was pressed");
  // …and both are actually put on the wire.
  assert.match(c, /answering:\s*!!answering/, "siteRoute drops the flag before sending it");
  assert.match(c, /picked:\s*!!picked/, "siteRoute drops the pressed flag before sending it");
  // A PRESS IS SAID TO BE ONE (2026-10-14): Continue on the card and Enter on a
  // pick; a typed reply in the composer is not one.
  assert.match(c, /if \(pickGo && thread\.contains\(pickGo\)\) \{ const v = sitePickTake\(sitePickKeyFirst\(siteById\(siteOpenId\)\)\); if \(v\) siteAnswer\(v, false, true\); return; \}/, "Continue on the card is not sent as a pick");
  assert.match(c, /if \(site\.clarify\) \{ siteAnswer\(t\); return; \}/, "a typed reply is sent as a pick");
  // A plain first message must NOT claim to be an answer, or the ask feature is
  // gone: `siteSend` routes with no such argument.
  const j = c.indexOf("function siteSend(");
  const send = c.slice(j, c.indexOf("\nfunction ", j + 10));
  assert.doesNotMatch(send, /siteRoute\([^)]*,\s*true\s*\)\s*;/,
    "an ordinary message is being sent as though it answered a question");
});

test("the trade is the first question when the brief does not name it", () => {
  // NOT ENFORCEABLE IN CODE — "does this brief say what the business is" is a
  // judgement, so the tool description is the only lever and this is a guard on
  // the description rather than on behaviour. Worth having anyway: the rule was
  // added because a live round spent BOTH its questions on logins and mood and
  // still did not know whether "Book classes" meant a gym or a pottery studio,
  // and a rule nobody asserts is one a later edit quietly drops.
  const d = ASK_TOOL.input_schema.properties.question.description;
  assert.match(d, /WHAT THE BUSINESS IS COMES FIRST/);
  assert.match(d, /trade/i, "the rule must name the thing it is about");
  // The example is what makes it concrete rather than a slogan.
  assert.match(d, /Book classes/, "the measured case is what stops this reading as generic advice");
});

test("the composer routes a first build even with a file attached", () => {
  // THE HALF THAT WAS THE BUG. `siteSend` skipped `siteRoute` whenever anything
  // was attached, so no first build with a logo was ever asked anything.
  const c = chat();
  const j = c.indexOf("function siteSend(");
  assert.ok(j > 0, "siteSend is gone");
  const send = c.slice(j, c.indexOf("\nfunction ", j + 10));
  assert.match(send, /if \(reactPath\) \{ siteRoute\(/,
    "an attachment skips the router again, so a first build with a file is never asked a question");
  // …and the flag is actually put on the wire, derived from the attachments
  // rather than taken as an argument nobody passes.
  assert.match(c, /attached:\s*!!\(\(imgs && imgs\.length\) \|\| keptImgs\.length\)/,
    "siteRoute drops the attachment flag before sending it");
  assert.match(c, /const keptImgs = !isBuild && answer && /, "a first build could be sent a question's files");
  // The round keeps the files, or answering the question builds without them.
  const a = c.indexOf("function siteAnswer(");
  assert.match(c.slice(a, c.indexOf("\nfunction ", a + 10)), /site\.clarify\.imgs \|\| \[\]/,
    "the attachments do not survive the clarify round");
});

test("an unreadable balance still gets routed; an empty one does not", () => {
  // TWO DIFFERENT ANSWERS THAT WERE READ AS ONE. `catch { rBal = 0 }` made an
  // unreachable Supabase look exactly like an empty account, so every ledger
  // blip turned every question into a build — and that build then failed on its
  // own gate against the same ledger.
  const w = worker();
  const i = w.indexOf('url.pathname === "/api/site/route"');
  assert.ok(i > 0, "the routing route is gone");
  const block = w.slice(i, w.indexOf("await routeMessage(", i));
  assert.match(block, /catch \{ rBal = null; \}/,
    "an unreadable ledger is being read as a zero balance again");
  assert.match(block, /if \(rBal !== null && !\(rBal > 0\)\)/,
    "the gate no longer separates 'no credits' from 'could not tell'");
  // A REAL zero must still short-circuit, or this turned the gate off entirely
  // and every empty account pays for routing.
  assert.match(block, /intent: "build", cost: 0/,
    "an account with no credits no longer skips the paid call");
});

test("the deploy check probes the question policy, as a PAIR", () => {
  // THE POLICY IS PROMPT TEXT, and no unit test can prove a prompt produces a
  // behaviour — this file's own clarify tests assert wording, which is all they
  // can do. `build smoke` is where it is actually measured, so what this holds
  // is that the measurement still exists and is still the shape that means
  // something.
  const smoke = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");
  const at = smoke.indexOf("const routeIntent =");
  assert.ok(at > 0, "the routing probes are gone, so the question policy is measured by nothing");
  const block = smoke.slice(at, smoke.indexOf("--- the actual build", at));
  assert.ok(block.length > 0, "the probe block no longer sits before the build");

  // BOTH DIRECTIONS, because either alone is passed by a broken router: one that
  // asks every time passes the floor, one that never asks passes the ceiling.
  assert.match(block, /a website for my business/,
    "the floor probe is gone — the brief that measured this dead last time");
  assert.match(block, /thin\.intent === "clarify"/,
    "nothing asserts a trade-less brief is still asked about");
  assert.match(block, /full\.intent === "build"/,
    "nothing asserts a complete brief is built rather than interrogated");

  // AND THE ONE ASSERTION A STUCK ROUTER CANNOT PASS. Two green lines read as
  // "it works" while being "it always asks" plus a coincidence; this is the one
  // that cannot be true of a router jammed either way.
  assert.match(block, /thin\.intent !== full\.intent/,
    "the pair is no longer compared, so a router stuck on one answer reads as healthy");

  // WITHOUT THIS THE WHOLE PAIR IS VACUOUS. `canClarify` is false on a revise, so
  // a probe that forgets `firstBuild` gets "build" for both briefs and passes the
  // floor check by accident — the exact shape of failure this test exists for.
  assert.match(block, /firstBuild: true/,
    "the probes do not open the question path, so both answer 'build' and prove nothing");

  // It must stay a ROUTING call. Reaching /api/site/react-build here would spend
  // a designer call, a Neon project and a compile per probe.
  assert.match(block, /\/api\/site\/route/, "the probe no longer hits the routing endpoint");
  assert.ok(!/react-build/.test(block), "a probe is calling the build route — that is a real site per probe");
});

test("the tool says what separates an edit from an addon, and where to fail", () => {
  const d = ASK_TOOL.input_schema.properties.intent.description;
  // ADDING IS THE ADDON STEP (owner, 2026-09-02: "add will always go in
  // addon"). This pinned the opposite — "add a testimonials section" as an
  // edit — while the line sat at the page; the owner's line is at the thing.
  // The one carve-out is theirs too: the page's code always exists, so
  // changing a component is an edit. The description must name both.
  assert.match(d, /testimonials/i, "the description does not name the case the boundary used to get wrong");
  assert.match(d, /testimonials[^\n]*\baddon\b/i, "a section the page does not have must be named as an addon");
  assert.match(d, /changing a component is an edit/i, "a change to the page's own code must be named as an edit");
  assert.match(d, /page the site does not have|table it does not have/i);
  assert.match(d, /cannot tell.*addon/is, "the description must say which way to fail");
  // And the layer field has to explain what each one costs to pick between them.
  const l = ASK_TOOL.input_schema.properties.layer.description;
  for (const layer of EDIT_LAYERS) assert.ok(l.includes('"' + layer + '"'), "layer " + layer + " is undescribed");
});

test("the router can express a removal at all, and says when not to", () => {
  const f = ASK_TOOL.input_schema.properties.remove;
  assert.ok(f, "the router has no way to say a page should go");
  assert.equal(f.type, "boolean");
  // The distinction that decides whether this is safe: a section coming off a
  // page is not the page coming off the site.
  assert.match(f.description, /ONLY WHEN THEY PLAINLY MEAN DELETE THE WHOLE PAGE/);
  assert.match(f.description, /takes\s+a page off their site/, "the consequence is not stated");
});

test("THE ROUTER IS TOLD A PAGE DELETION IS AN EDIT, and told not to ask about it", () => {
  // MEASURED LIVE 2026-08-12, and this is the failure the whole deletion path
  // was invisible behind: `edit smoke` asked the deployed router to
  // "Remove the gallery page" and it came back
  // `intent=ask layer=undefined remove=undefined page=undefined`.
  //
  // The CODE was fine — `readEdit` resolves the page and honours `remove === true`
  // — so nothing below the router could have caught it. What was missing was in
  // the tool description: the `edit` clause said only "something taken away",
  // the `page` layer said "take one out" about a SECTION, and nothing anywhere
  // told the model not to check first. Asking "are you sure?" is the natural
  // thing a helpful model does with a destructive instruction, and it is the one
  // answer this interface cannot accept — there is no yes button, so it reads as
  // the builder refusing to work.
  //
  // Asserted on the description because that is where the fix lives, and a
  // prompt fix with nothing holding it is one a later edit drops silently.
  const t = JSON.stringify(ASK_TOOL);
  assert.match(t, /NEVER ANSWER \\"ask\\" TO CHECK THAT THEY MEANT IT/,
    "nothing stops the router asking for confirmation before a destructive change");
  assert.match(t, /TAKING A WHOLE PAGE OFF THE SITE IS AN EDIT/,
    "the intent field never says a page deletion is an edit");
  assert.match(t, /THIS IS ALSO WHERE A PAGE IS DELETED/,
    "the page layer never says a deletion belongs to it");
  // THE TIE-BREAK IS THE LAST SENTENCE AND THEREFORE THE STRONGEST ONE. With
  // the three above in place and this one absent, the live router stopped
  // answering "ask" and started answering "addon" — measured on the very next
  // run — because it read "addon can do everything an edit can", which is
  // FALSE for a removal: no addon can take a page off a site, so the answer
  // spends a full page-generation call and comes back `no-change`. The
  // exception has to sit at the tie-break, not eight lines above it.
  assert.match(t, /A REMOVAL IS NEVER AN ADDON/,
    "the addon tie-break can swallow a deletion again, which costs a real call and changes nothing");
  const tie = t.slice(t.indexOf("WHEN YOU CANNOT TELL"));
  assert.ok(tie.length > 0 && /A REMOVAL IS NEVER AN ADDON/.test(tie),
    "the exception is stated somewhere ABOVE the tie-break, where the model has already stopped reading");
  // AND THE SAME LESSON ONE FIELD OVER. `remove`'s page clause used to CLOSE on
  // "getting it wrong the other way takes a page off their site" — a warning
  // against the action as its final word. Measured live with everything else
  // correct (`layer=page page=/gallery remove=undefined`) against this field's
  // own first example. It closes on the consequence of OMITTING it now.
  assert.match(t, /WITHOUT THIS FIELD THE PAGE STAYS/,
    "the remove field never says what happens when it is left out, which is the failure the customer sees");
  const rm = t.slice(t.indexOf("WITHOUT THIS FIELD THE PAGE STAYS"));
  assert.ok(!/takes a page off their site/.test(rm.slice(0, 400)),
    "the clause still ends on the warning, which is the position that lost it twice");
});

test("the tool description asks for `remove` on exactly the removable layers", () => {
  // The schema is what the model reads; if it offers the field for a layer the
  // reader drops, the model answers a question nobody listens to.
  const desc = ASK_TOOL.input_schema.properties.remove.description;
  for (const layer of REMOVABLE_LAYERS) {
    assert.ok(desc.includes('"' + layer + '"'), "the remove field never mentions layer " + layer);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// A FALLBACK MUST SAY IT IS ONE. `routeMessage` computes failed:true when the
// routing model itself threw, and the worker dropped it — so an Anthropic
// outage answered {ok:true, intent:"addon"} wearing the costume of a real
// routing decision, on the one route whose never-5xx design makes a response
// field the only possible signal (2026-08-13 audit; the 2026-08-12 billing
// outage cost a whole diagnosis for exactly this reason).
test("the route response carries `failed` when the routing model threw", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // Windowed to the NEXT feature's landmark, not a byte count — a byte window
  // here was 3k short on its first run because the handler is well-commented,
  // which is this repo's recorded overlapping-window trap.
  const at = w.indexOf('"/api/site/route"');
  const end = w.indexOf("Website builder — provision this site's database", at);
  assert.ok(at > 0 && end > at, "the route handler's anchors moved — retarget this guard");
  const win = w.slice(at, end);
  assert.match(win, /failed:\s*routed\.failed === true \|\| undefined/,
    "the routing fallback flag is dropped again — an outage reads as a decision");
});

test("the composer carries the new address to the edit route", () => {
  // The other end of the same wire. Either alone passes while it is cut, which
  // is the state `remove` was found in.
  const client = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(client, /rename:\s*typeof d\.rename === "string"/,
    "the composer no longer carries the new address to the edit route");
});

test("the tool tells the model to stay silent when unsure", () => {
  // The whole design constraint: what goes here is HELD BACK since 2026-09-29
  // (run 52), so over-reporting takes work they asked for out of the turn —
  // worse than the miss, which leaves the work in.
  const d = ASK_TOOL.input_schema.properties.alsoAsked.description;
  assert.match(d, /ALMOST ALWAYS LEAVE THIS OUT/);
  assert.match(d, /When in doubt, say nothing/);
  // AND IT NAMES THE DISTINCTION THAT DECIDES IT: two things said about one
  // change is still one change, and several changes one answer can make are
  // one turn.
  //
  // ⚠ RE-ANCHORED 2026-09-29, AND THE EXPECTATION CHANGED ON PURPOSE. This
  // asserted "a DIFFERENT part of the site" — the rule that put run 52's Visit
  // move off to a later turn although the look door could make it. The owner:
  // *"The router's alsoAsked instructions impose 'one change per turn,' but the
  // edit executor supports multiple steps."* The customer now gets MORE done in
  // a turn, never less; the deciding rule is what the chosen answer cannot do.
  assert.match(d, /still one change/);
  assert.match(d, /SEVERAL CHANGES ARE ONE TURN WHEN YOUR ANSWER CAN MAKE THEM ALL/);
  assert.match(d, /ONLY WHEN IT NEEDS SOMETHING YOUR ANSWER CANNOT DO THIS TURN/);
  assert.match(d, /held back/);
  assert.doesNotMatch(d, /One change happens per turn/, "the router is told one change per turn again");
  assert.match(d, /in their own words/);
  assert.equal(ASK_TOOL.input_schema.properties.alsoAsked.type, "string");
  // Never required — a leftover is the exception, not the shape of every turn.
  assert.ok(!(ASK_TOOL.input_schema.required || []).includes("alsoAsked"));
});

test("the answer is chosen over the whole message, and only what no one answer can make is held back", () => {
  // Run 63 (Test 8, 2026-09-29): a menu item taken out and a band moved on
  // another page came back `nav` + `remove` with the move in `alsoAsked`. The
  // first change was answered by its own clause and the second held back as
  // something THAT answer could not do, although `look` could make both. The
  // owner: *"Resolve conflicting instructions so the router considers the
  // whole request before choosing a path or deferring any operation."*
  const l = ASK_TOOL.input_schema.properties.layer.description;
  const d = ASK_TOOL.input_schema.properties.alsoAsked.description;
  // THE RULE IS THE LAYER FIELD'S LAST PARAGRAPH — the position this file has
  // measured as a field's strongest (see the `remove` field's closing line),
  // so every per-layer clause above it is read as scoped by it.
  const last = l.split("\n").pop();
  assert.ok(last.length > 200, "the layer description has no closing rule to read: " + JSON.stringify(last.slice(0, 80)));
  assert.match(last, /WHOLE MESSAGE/, "the closing rule is not about the whole message");
  assert.match(last, /EVERY CHANGE THEY ASK FOR AND WHERE EACH ONE IS/,
    "the router is not told to read every change, and where each one is, before choosing");
  assert.match(last, /NEVER FROM THE FIRST CHANGE ALONE/, "a leading change can still decide the answer on its own");
  // ⚠ BY TARGETS, NEVER BY KIND (the owner's review of the first wording, the
  // same day): two layout changes on two pages are one kind, and `page` edits
  // one page. A route is chosen by whether it can make every change on every
  // page it is on, so "one kind" alone must never be enough.
  assert.doesNotMatch(last, /is its kind/, "one kind of change is still enough to choose a layer");
  // A SPECIALIZED ROUTE IS KEPT WHEN IT CAN DO EVERYTHING — the cheap answers
  // for a single change stay where they were.
  assert.match(last, /A layer other than "look" is the answer when it can make all of them, on every page each one is on/,
    "a layer that can make the whole message, on all its pages, is no longer its answer");
  // OTHERWISE `look`, WHEN ITS SCOPED STEPS CAN — changes on different pages
  // included, even of one kind — AND NOTHING OF IT IS HELD BACK. Only then: a
  // message `look` cannot make is not sent there.
  assert.match(last, /When none can, answer "look" if it can make them all/,
    "`look` is not the answer only when no other layer can make the whole message");
  assert.match(last, /changes on different pages are one "look" answer even when they are all of one kind/,
    "same-kind changes on different pages are not sent to the answer that places each on its own page");
  assert.match(last, /hold nothing back/, "a message `look` can make is still split across turns");
  assert.match(last, /Hold a change back only when no one answer can make it with the rest/,
    "the closing rule does not limit what is held back");
  // A RULE, NOT A WORKED EXAMPLE (owner: "Delete worked examples; state only
  // the purpose"): everything it quotes is a layer's own name, so no customer
  // sentence, site or page can be copied out of it.
  const quoted = [...last.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(quoted.length >= 2, "the closing rule names no layer at all");
  for (const q of quoted) assert.ok(EDIT_LAYERS.includes(q), "the closing rule quotes something that is not a layer: " + q);
  // THE HOLD-BACK FIELD SAYS THE SAME, WHATEVER WAS ANSWERED FIRST. It used to
  // spare a part `look` could reach only "when you answered look", and must not
  // name `look` as the answer by default either: a layer that can make it all
  // comes first.
  assert.doesNotMatch(d, /when you answered "look"/, "the look exception still depends on the answer already chosen");
  assert.match(d, /never for a part one answer can make along with everything else they asked: give that answer/);
  assert.doesNotMatch(d, /then the answer is "look"/, "the hold-back field sends a part to `look` ahead of a layer that can make it all");
  assert.match(d, /whatever the first change was/);
  // AND THE LEGITIMATE HOLDS ARE KEPT: what the answer cannot do this turn —
  // an addition beside a change, a change beside an addition, a list's rows or
  // a page's exact words beside a change of another kind.
  assert.match(d, /ONLY WHEN IT NEEDS SOMETHING YOUR ANSWER CANNOT DO THIS TURN/);
  assert.match(d, /something to ADD/);
  assert.match(d, /answered "addon"/);
  assert.match(d, /\("data"\)/);
  assert.match(d, /\("text"\)/);
  // A menu change on its own still goes to its own cheap layer.
  // RE-ANCHORED 2026-10-02: a change to the menu the site HAS — a new item in
  // it is an addition now, which the add-on step hands back to `nav` held to
  // adding (run 90's A2), so the sentence no longer says "not addon".
  assert.match(l, /A CHANGE TO THE MENU IT HAS IS "nav"/);
  assert.doesNotMatch(l, /NOT THIS AND NOT "addon"/, "a new menu item is still kept from the add-on step");
});

test("the wire is not cut, at either end", () => {
  // THE THIRTEENTH FIELD OF THIS SHAPE. Twelve have been decided correctly and
  // dropped between `readRouting` and the client, and from outside "the model
  // did not set it" and "we did not forward it" are the same `undefined`.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("question: routed.intent === \"clarify\"");
  assert.ok(at > 0, "the routing response literal moved");
  const block = w.slice(w.lastIndexOf("intent: routed.intent", at), at);
  // ONE PART AS A STRING, SEVERAL AS A LIST, SINCE 2026-10-03 (the mixed-work
  // fixes): both shapes are forwarded, and a list only when every entry is text.
  assert.match(block, /alsoAsked: \(typeof routed\.alsoAsked === "string" && routed\.alsoAsked\) \|\|\s*\(Array\.isArray\(routed\.alsoAsked\) && routed\.alsoAsked\.length && routed\.alsoAsked\.every\(\(p\) => typeof p === "string" && p\) \? routed\.alsoAsked : undefined\)/);

  // And the CLIENT renders it — on both rungs, since either can drop half a
  // message. Asserted as the count, because one `finish` learning it and the
  // other not is exactly how half this feature would ship dead.
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  // AND IT SAYS SOMETHING. Asserting the function EXISTS and is CALLED passes
  // perfectly against one that returns "" — the works-but-cannot-say-so disease
  // one layer further out, and a mutant proved it. The sentence must carry the
  // customer's own words and tell them what to do with them.
  const tailAt = c.indexOf("function alsoTail(");
  assert.ok(tailAt > 0, "alsoTail is gone");
  const tail = c.slice(tailAt, c.indexOf("\n}", tailAt));
  // RE-ANCHORED 2026-10-02: the parts, each quoted (`q`), several since a step
  // may put some off as the router's net — and a sentence for an ending that
  // did not succeed. What it says is driven in `handover-batch2.test.mjs`.
  assert.match(tail, /return[^;]*\bq\[0\]/, "alsoTail never returns the leftover itself");
  assert.match(tail, /I left /, "an ending that did not succeed says nothing about the part put off");
  assert.match(tail, /I only did one thing this time/, "the sentence that explains one change per turn is gone");
  assert.match(tail, /I\\u2019ll do that next/, "the sentence does not say what happens if they send it back");
  // THE PROPERTY, NOT THE SPELLING — the sibling guard on `renderTail` was
  // pinned to an exact expression and went red the moment this tail was added
  // beside it. What must hold is that BOTH replies carry it, since one `finish`
  // learning it and the other not is exactly how half a feature ships dead.
  // `o.finish(...)` SINCE 2026-09-01: the edit reply is rendered by
  // `applyEditResult`, which both the synchronous and the queued path call —
  // the queued one having had its own copy that carried this correctly and got
  // the escalate and the undo wrong. Matched on the shape rather than the
  // receiver's name, so it reads the same either side of that move.
  //
  // ⚠ FROM THE ROUTE'S OWN ANSWER SINCE 2026-09-29 (run 52): each reply's tail
  // reads what that route HELD BACK (`e` / `a`, their `deferred`), never the
  // routing decision — which was said whatever the route then did.
  // RE-ANCHORED 2026-10-02: composed once (`doneText`), shown with or without a step's question.
  // RE-ANCHORED 2026-10-03: a reply the server had a model write comes first
  // (`EditPoll.modelReply`), and the composed one, tail and all, is what the
  // page says without it. The model's reply names the leftover because the
  // route's own `deferred` is one of its facts, and it is refused unless it
  // covers every fact (test/model-replies.test.mjs).
  assert.match(c, /const doneText = EditPoll\.modelReply\(e\) \|\| \(editReply\(e\)[^;]*alsoTail\(e\)\);\s*finish\(asked \? askReplyMsg\(doneText, [^;]*\) : doneText\);/, "the edit reply drops the leftover, or reads it off the routing decision");
  assert.match(c, /const doneText = EditPoll\.modelReply\(a\) \|\| \(addonReplyText\(a\)[^;]*alsoTail\(a\)\);\s*finish\(asked \? askReplyMsg\(doneText, [^;]*\) : doneText\);/, "the addon reply drops the leftover, or reads it off the routing decision");
  assert.match(tail, /\.deferred\b/, "alsoTail no longer reads what the route held back");
  // AND THE TWO NEW HOPS: the browser posts what was held back on BOTH routes,
  // and BOTH routes take it out of the message before anything runs.
  const editBody = c.slice(c.indexOf("\nfunction siteEdit("), c.indexOf("\n}\n", c.indexOf("\nfunction siteEdit(")));
  const addBody = c.slice(c.indexOf("\nfunction siteAddon("), c.indexOf("\n}\n", c.indexOf("\nfunction siteAddon(")));
  assert.ok(editBody.length > 100 && addBody.length > 100, "siteEdit's or siteAddon's landmarks are gone");
  // RE-ANCHORED 2026-10-02: one part or several (`EditPoll.heldWire`, and
  // `heldParts` on each route), and the rewrite as the third route.
  assert.match(editBody, /alsoAsked: EditPoll\.heldWire\(d\.alsoAsked\)/, "the edit POST does not carry what was held back");
  assert.match(addBody, /alsoAsked: EditPoll\.heldWire\(d && d\.alsoAsked\)/, "the add-on POST does not carry what was held back");
  assert.match(w, /const eHeld = heldParts\(eMessage, eb && eb\.alsoAsked\)/, "the edit route does not take out what was held back");
  assert.match(w, /const aLater = heldParts\(aAsked, ab && ab\.alsoAsked\)/, "the add-on route does not take out what was held back");
  // RE-ANCHORED 2026-10-02 (the review of batch 2): the rewrite reads its parts
  // through `buildHeld`, the one reading the queued route's own answer shares.
  assert.match(w, /const bLater = buildHeld\(body\)/, "the rewrite does not take out what was held back");
  const bh = w.indexOf("\nfunction buildHeld(");
  assert.ok(bh > 0, "buildHeld's landmark is gone");
  assert.match(w.slice(bh, w.indexOf("\n}\n", bh)), /return heldParts\(/, "buildHeld does not take the parts out of the message");
  // The addon lane had no routing decision in scope at all until this landed.
  // AND THE MESSAGE'S FILES SINCE 2026-10-02 (`imgs`), kept beside a question the add-on asks.
  assert.match(c, /function siteAddon\(site, instruction, origin, finish, fallback, d, imgs\)/);
  // RE-ANCHORED 2026-10-02: an answered question runs its request (`run`), with its files.
  // RE-ANCHORED 2026-10-24: its fallback is the said climb, never the rewrite (`go`).
  assert.match(c, /siteAddon\(site, run, origin, finish, climbed, d, sendImgs\)/);
});

// ── WHICH LANES THE LIVE CHECK ACTUALLY DRIVES ──────────────────────────────

test("every edit layer is driven by the live check, or is named as a known gap", () => {
  // `edit smoke` drove FOUR of the eight layers — data, look, page, rules — so
  // half the edit path had unit tests, mutation sweeps and no live proof at all.
  // That gap is invisible from either end: the lanes pass their own tests and
  // the check passes its own assertions, and nothing compares the two lists.
  //
  // DERIVED FROM BOTH SIDES rather than a count somebody remembers to bump, so
  // a NINTH layer added later is covered here without anybody thinking of it —
  // which is exactly how the first four came to be the only ones.
  const t = fs.readFileSync(new URL("../test/integration/edit-smoke.mjs", import.meta.url), "utf8");
  const driven = new Set([...t.matchAll(/layer: "([a-z]+)"/g)].map((m) => m[1]));

  // THE ONE STILL UNCOVERED, NAMED RATHER THAN LEFT AS A SILENT ABSENCE. The
  // picture lane swaps a `SafeImage` slot to a photograph, and both ways of
  // getting one are unavailable to a check: buying costs real fal money on an
  // empty balance, and reusing an owner upload means chaining this to whatever
  // an earlier step happened to store. A named gap is a decision; an unnamed one
  // is the state this test exists to end.
  // ── `rename` JOINED THE GAP LIST 2026-08-29, AND IT IS WRITTEN DOWN ───────
  //
  // ONE REASON NOW. The first — that `site_aliases` did not exist — was retired
  // on 2026-08-30 when the table was created by hand (there is no migration
  // runner here). Kept in the history rather than deleted because the DEGRADE it
  // describes is still live and still deliberate: `aliasRowFor` answers null on
  // any read failure and `resolveAlias` reads a null row as "no alias", so the
  // platform falls back to its pre-alias behaviour instead of erroring.
  //
  // The reason that remains: a live rename CLAIMS a real
  // address on the real platform and leaves a real site answering at a new name.
  // Every other layer's live check is undoable; this one would litter the
  // namespace with test names that can never be released, because releasing them
  // is precisely what the old-name-stays-claimed rule forbids.
  const KNOWN_GAPS = ["picture", "rename"];
  const missing = EDIT_LAYERS.filter((l) => !driven.has(l) && !KNOWN_GAPS.includes(l));
  assert.deepEqual(missing, [],
    "these lanes have no live proof at all: " + missing.join(", "));

  // AND THE GAP LIST MAY NOT GROW QUIETLY EITHER — a layer added to it is a
  // decision to ship something unproven, which should have to be written down.
  assert.ok(KNOWN_GAPS.length <= 2, "more lanes are being shipped without live proof");
  // The floor: a scan that stopped matching would report full coverage.
  assert.ok(driven.size >= EDIT_LAYERS.length - KNOWN_GAPS.length,
    "the scan found only " + driven.size + " layers in the live check");
  for (const l of driven) {
    assert.ok(EDIT_LAYERS.includes(l), "the live check drives a layer that does not exist: " + l);
  }
});

// ANSWERED IS GONE (2026-10-21, owner: "when selected and submit the answer,
// dont show it again"). The round stays open while the build reads it, so the
// card used to stay under the question until the build ended.
test("a first build's question card goes the moment its answer is in the thread", () => {
  const src = chat();
  const a = src.indexOf("function siteAskHTML(");
  const b = src.indexOf("\n}", a);
  assert.ok(a > 0 && b > a, "siteAskHTML is gone");
  const draw = new Function("sitePickHTML", "sitePickKeyFirst", "siteLiveAskHTML", src.slice(a, b + 2) + " return siteAskHTML;")(
    () => "CARD", () => "k", () => "LIVE");
  const q = { r: "a", q: "What should visitors do?", opts: ["Book a table", "Order online"] };
  const site = { clarify: { brief: "a cafe", qa: [] }, msgs: [{ r: "u", t: "a cafe" }, q] };
  assert.equal(draw(q, site), "CARD", "the live, unanswered question has no card — the check is dead");
  site.msgs.push({ r: "u", t: "Order online" });
  assert.equal(draw(q, site), "", "the card is still drawn after its answer was sent");
});

// OUR OWN "ARE YOU SURE?" (2026-10-21, owner: "lets make it ours and not browser").
test("deleting a site asks with our own dialog, not the browser's confirm()", () => {
  const src = chat();
  const at = src.indexOf("view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {");
  assert.ok(at > 0, "the site delete handler moved; this guard checks nothing");
  const block = src.slice(at, src.indexOf("apiFetch('/api/site/' + encodeURIComponent(s.slug), { method: 'DELETE' })", at));
  assert.ok(block.length > 100 && block.length < 3000, "the delete call moved");
  assert.doesNotMatch(block, /[^.\w]confirm\(/, "the browser's confirm() is back");
  assert.match(block, /if \(!\(await goConfirm\(/, "the delete is not asked with goConfirm");
  assert.match(block, /danger: true/);
  const g = src.slice(src.indexOf("function goConfirm("), src.indexOf("function siteCreate("));
  assert.match(g, /e\.key === 'Escape'[^]*done\(false\)/, "Esc does not cancel");
  assert.match(g, /e\.target === wrap\) done\(false\)/, "a click outside does not cancel");
  assert.match(g, /'\.go-confirm-no'\)\.focus\(\)/, "the safe answer is not the one focused");
});

// OFF THE SCREEN TOO (2026-10-21, owner: "after i click ok it stays there").
test("a deleted site leaves the screen: the server's list as fetched loses it too, by slug", () => {
  const src = chat();
  const at = src.indexOf("view.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {");
  const end = src.indexOf("\n  });", at);
  assert.ok(at > 0 && end > at, "the site delete handler moved; this guard checks nothing");
  const block = src.slice(at, end);
  assert.match(block, /sitesRemote = sitesRemote\.filter\(\(r\) => !\(r && \(r\.id === id \|\| \(goneSlug && r\.slug === goneSlug\)\)\)\)/, "the fetched server list keeps the deleted site, so its card stays");
  assert.match(block, /!\(goneSlug && x\.slug === goneSlug\)/, "the local record is only dropped by the card's id");
  assert.ok(block.indexOf("sitesRemote = sitesRemote.filter") < block.indexOf("renderSites()", block.indexOf("goneSlug")), "the list is redrawn before the site is taken out");
});
