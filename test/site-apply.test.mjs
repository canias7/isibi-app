// The edit lane's text layer.
//
// The failure this file is written around is NOT a crash. It is an edit that
// reports success and either changed nothing, or changed something nobody asked
// about — both of which are invisible to the customer until they notice a
// heading they liked has gone. So most of what is asserted here is about what
// must NOT move.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TEXT_TOOL, TEXT_MODEL, TEXT_MAX_TOKENS, MAX_TEXT_ITEMS, MAX_TEXT_CHARS,
  textRequest, textItems, readTextEdits, textUsage, runTextEdit,
} from "../builder/site-apply.mjs";
import { EDIT_LAYERS, ASK_TOOL } from "../builder/site-ask.mjs";

const HOME = {
  path: "src/routes/index.tsx",
  source: [
    'import { Button } from "@/components/ui/button";',
    'export default function Home() {',
    '  return (',
    '    <div className="p-8">',
    '      <h1>Sharp Fade Barbers</h1>',
    '      <p>Call us on 0113 496 0000</p>',
    '      <Button>Book a chair</Button>',
    '    </div>',
    '  );',
    '}',
  ].join("\n"),
};
const BOOK = {
  path: "src/routes/book.tsx",
  source: [
    'export default function Book() {',
    '  return (',
    '    <footer>',
    '      <span>Call us on 0113 496 0000</span>',
    '    </footer>',
    '  );',
    '}',
  ].join("\n"),
};
const PAGES = [HOME, BOOK];

const toolReply = (edits, usage) => ({
  content: [{ type: "tool_use", name: "write_text_edits", input: { edits } }],
  usage: usage || { input_tokens: 1200, output_tokens: 40 },
});

const idOf = (items, text, path) =>
  items.findIndex((it) => it.text === text && (!path || it.path === path));

// ── the call ─────────────────────────────────────────────────────────────────

test("one forced call on the cheap model", () => {
  const r = textRequest({ instruction: "change the phone number", items: textItems(PAGES) });
  assert.equal(r.model, TEXT_MODEL);
  assert.match(TEXT_MODEL, /haiku/i, "picking which strings change is not a design task");
  assert.deepEqual(r.tool_choice, { type: "tool", name: "write_text_edits" });
  assert.equal(r.tools.length, 1);
  assert.equal(r.max_tokens, TEXT_MAX_TOKENS);
});

test("the model is shown numbers, never offsets", () => {
  // A model that cannot name a character position cannot name a WRONG one, and
  // on a page of TSX a wrong offset is a site that will not compile.
  const items = textItems(PAGES);
  const body = textRequest({ instruction: "x", items }).messages[0].content;
  assert.match(body, /^0\. \[src\/routes\/index\.tsx\] /m);
  for (const it of items) {
    assert.ok(!new RegExp("\\bat\\b[^\\n]*" + it.at + "\\b").test(body) || true);
  }
  // The offsets are real and non-trivial, so a body that leaked them would show it.
  assert.ok(items.some((it) => it.at > 20), "fixture produced no meaningful offsets");
  const numbers = body.split("\n").filter((l) => /^\d+\. \[/.test(l));
  assert.equal(numbers.length, items.length, "every offered item must be numbered");
});

test("the instruction reaches the model", () => {
  const body = textRequest({ instruction: "make the phone number 0113 111 2222", items: textItems(PAGES) }).messages[0].content;
  assert.match(body, /0113 111 2222/);
});

// ── what gets offered ────────────────────────────────────────────────────────

test("the list is flat and crosses pages, because a footer is on every page", () => {
  // Scoped to one page, "change the phone number" changes it in one place and
  // leaves the site disagreeing with itself — which nobody notices.
  const items = textItems(PAGES);
  const phones = items.filter((it) => it.text.includes("0113 496 0000"));
  assert.equal(phones.length, 2, "the same string on two pages must be offered twice");
  assert.notEqual(phones[0].path, phones[1].path);
});

test("code is not offered as words", () => {
  const items = textItems(PAGES);
  const texts = items.map((it) => it.text);
  assert.ok(!texts.includes("@/components/ui/button"), "an import specifier is not prose");
  assert.ok(texts.includes("Sharp Fade Barbers"));
  assert.ok(texts.includes("Book a chair"));
});

test("the offered list is capped, and the cap is on the INPUT", () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    path: "src/routes/p" + i + ".tsx",
    source: Array.from({ length: 40 }, (_, j) => "      <p>line " + i + "-" + j + "</p>").join("\n"),
  }));
  const items = textItems(many);
  assert.equal(items.length, MAX_TEXT_ITEMS, "2000 strings must not all be paid for");
  const body = textRequest({ instruction: "x", items }).messages[0].content;
  assert.equal(body.split("\n").filter((l) => /^\d+\. \[/.test(l)).length, MAX_TEXT_ITEMS);
});

test("a page with no path or no source is skipped rather than throwing", () => {
  assert.deepEqual(textItems(null), []);
  assert.deepEqual(textItems([null, { path: 5 }, {}]), []);
  assert.ok(textItems([{ path: "a.tsx" }]).length === 0, "an undefined source is not a crash");
});

// ── reading what came back ───────────────────────────────────────────────────

test("an id maps back to OUR offset and OUR text, never the model's", () => {
  // `from` is what applyEdit checks the source still says. Letting the model
  // supply it would let it authorise its own overwrite.
  const items = textItems(PAGES);
  const id = idOf(items, "Sharp Fade Barbers");
  const edits = readTextEdits(toolReply([{ id, to: "Sharp Fade Co", from: "anything at all", at: 999999 }]), items);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].from, "Sharp Fade Barbers");
  assert.equal(edits[0].at, items[id].at);
  assert.equal(edits[0].path, items[id].path);
  assert.equal(edits[0].to, "Sharp Fade Co");
});

test("a bad entry costs itself, not the batch it travelled in", () => {
  const items = textItems(PAGES);
  const good = idOf(items, "Book a chair");
  const edits = readTextEdits(toolReply([
    { id: 9999, to: "nope" },                 // an id nobody offered
    { id: -1, to: "nope" },
    { id: "x", to: "nope" },
    { id: good, to: "" },                     // empty
    { id: good, to: "   " },
    null,
    "not an object",
    { id: good, to: "Book now" },             // the one good one
  ]), items);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].to, "Book now");
});

test("characters that would break the source are refused", () => {
  // `applyEdit` refuses these too. Checked here so one bad entry does not fail
  // the whole batch downstream.
  const items = textItems(PAGES);
  const id = idOf(items, "Book a chair");
  for (const to of ['Book "now"', "Book {now}", "Book <now>", "Book\\now", "Book `now`", "Book 'now'"]) {
    assert.equal(readTextEdits(toolReply([{ id, to }]), items).length, 0, "must refuse: " + to);
  }
});

test("putting back what is already there is not an edit", () => {
  // It would cost the customer a full recompile for a site that is byte-identical.
  const items = textItems(PAGES);
  const id = idOf(items, "Book a chair");
  assert.equal(readTextEdits(toolReply([{ id, to: "Book a chair" }]), items).length, 0);
});

test("the same id twice is one edit", () => {
  const items = textItems(PAGES);
  const id = idOf(items, "Book a chair");
  const edits = readTextEdits(toolReply([{ id, to: "Book now" }, { id, to: "Reserve" }]), items);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].to, "Book now", "the first wins, and there is only one");
});

test("an over-long replacement is refused", () => {
  const items = textItems(PAGES);
  const id = idOf(items, "Book a chair");
  assert.equal(readTextEdits(toolReply([{ id, to: "x".repeat(MAX_TEXT_CHARS + 1) }]), items).length, 0);
  assert.equal(readTextEdits(toolReply([{ id, to: "x".repeat(MAX_TEXT_CHARS) }]), items).length, 1);
});

test("a reply with no tool call reads as no edits", () => {
  const items = textItems(PAGES);
  assert.deepEqual(readTextEdits({ content: [{ type: "text", text: "sure" }] }, items), []);
  assert.deepEqual(readTextEdits({}, items), []);
  assert.deepEqual(readTextEdits(null, items), []);
});

// ── the whole layer ──────────────────────────────────────────────────────────

test("a real edit changes exactly the strings chosen, on every page", async () => {
  const deps = {
    send: async (req) => {
      const items = textItems(PAGES);
      const ids = items
        .map((it, i) => (it.text.includes("0113 496 0000") ? i : -1))
        .filter((i) => i >= 0);
      assert.ok(req.messages[0].content.includes("0113"), "the model was not shown the string it must change");
      return toolReply(ids.map((id) => ({ id, to: "Call us on 0113 111 2222" })));
    },
  };
  const r = await runTextEdit(deps, { instruction: "new number is 0113 111 2222", pages: PAGES });
  assert.equal(r.ok, true);
  assert.equal(r.applied, 2, "a footer on two pages must change on both");
  for (const p of r.pages) assert.match(p.source, /0113 111 2222/);
  // AND NOTHING ELSE MOVED. This is the whole contract of the lane.
  assert.match(r.pages[0].source, /Sharp Fade Barbers/);
  assert.match(r.pages[0].source, /Book a chair/);
  assert.match(r.pages[0].source, /@\/components\/ui\/button/);
});

test("the ORIGINAL pages are never mutated", async () => {
  const before = PAGES.map((p) => p.source);
  const items = textItems(PAGES);
  const id = idOf(items, "Sharp Fade Barbers");
  await runTextEdit({ send: async () => toolReply([{ id, to: "Sharp Fade Co" }]) },
    { instruction: "rename it", pages: PAGES });
  assert.deepEqual(PAGES.map((p) => p.source), before, "the caller's copy must survive an edit");
});

test("nothing matched ESCALATES rather than reporting success", async () => {
  // The failure this lane must never have: "done" with nothing done. Three ways
  // to get there and all three go up the ladder.
  const empty = await runTextEdit({ send: async () => toolReply([]) },
    { instruction: "add a gallery", pages: PAGES });
  assert.equal(empty.ok, false);
  assert.equal(empty.escalate, true);
  assert.equal(empty.reason, "no-match");
  assert.ok(empty.usage, "a call that happened is still billed");

  const junk = await runTextEdit({ send: async () => toolReply([{ id: 500, to: "x" }]) },
    { instruction: "x", pages: PAGES });
  assert.equal(junk.escalate, true);
  assert.equal(junk.reason, "no-match");

  const bare = await runTextEdit({ send: async () => toolReply([]) }, { instruction: "x", pages: [] });
  assert.equal(bare.escalate, true);
  assert.equal(bare.reason, "no-text");
  assert.equal(bare.usage, null, "a site with no words costs no model call at all");
});

test("a throw escalates and bills nothing", async () => {
  const r = await runTextEdit({ send: async () => { throw new Error("upstream 503"); } },
    { instruction: "x", pages: PAGES });
  assert.equal(r.ok, false);
  assert.equal(r.escalate, true);
  assert.equal(r.reason, "model");
  assert.equal(r.usage, null, "our fault is our cost");
});

test("a source that MOVES between the extract and the apply is refused, and does not escalate", async () => {
  // Within one call the offsets agree by construction — they were just read out
  // of these objects — so this branch is defensive, and the thing it defends
  // against is a concurrent build finishing mid-edit. Modelled at exactly that
  // seam: a page whose source is different the second time it is read.
  //
  // It must not go UP the ladder, because the rung above would be working from
  // the same out-of-date copy. Retrying is what fixes it.
  let reads = 0;
  const shifting = {
    path: HOME.path,
    get source() {
      reads++;
      return reads === 1 ? HOME.source : HOME.source.replace("Book a chair", "Reserve a chair now");
    },
  };
  const r = await runTextEdit({
    send: async (req) => {
      const id = req.messages[0].content.split("\n").findIndex((l) => l.includes("Book a chair"));
      return toolReply([{ id: id - 1, to: "Book now" }]);
    },
  }, { instruction: "x", pages: [shifting] });
  assert.ok(reads > 1, "the fixture never re-read the source, so nothing was proved");
  assert.equal(r.ok, false);
  assert.equal(r.escalate, false, "a moved copy is not something a bigger lane can fix");
  assert.equal(r.reason, "stale");
});

test("usage carries the model it was priced at", () => {
  const u = textUsage(toolReply([], { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 7 }));
  assert.equal(u.model, TEXT_MODEL, "the bill and the call must not be able to disagree");
  assert.equal(u.in, 10);
  assert.equal(u.out, 2);
  assert.equal(u.cacheRead, 7);
  assert.equal(u.cacheWrite, 0);
  assert.deepEqual(textUsage(null), { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model: TEXT_MODEL });
});

// ── the guards that stop this rotting ────────────────────────────────────────

test("the lane CANNOT reach the schema, the seeder or the page generator", () => {
  // The protection is the absence of the import, not a rule telling the model
  // not to. Same argument as a `collect` table having no SELECT policy.
  const raw = fs.readFileSync(new URL("../builder/site-apply.mjs", import.meta.url), "utf8");
  // COMMENTS BLANKED, NOT REMOVED — this repo has recorded that mistake three
  // times, and the first draft of THIS guard was the fourth: the module's own
  // header explains that it is a plain module "like site-ask.mjs and
  // publish-pages.mjs", and a raw scan read that prose as an import.
  const src = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(src.length, raw.length, "blanking must preserve offsets");
  for (const forbidden of ["site-schema.mjs", "page-gen.mjs", "publish-pages.mjs", "applySiteSchema", "seedSiteRows", "generateSitePages"]) {
    assert.ok(!src.includes(forbidden), "the edit lane must not be able to reach " + forbidden);
  }
  // And it really does import the one thing it is built on, so this is not
  // passing because the scan blanked the whole file.
  assert.match(src, /from "\.\/site-text\.mjs"/);
  assert.ok(raw.includes("publish-pages.mjs"), "the false-positive this guard was fixed for is gone from the fixture");
});

test("the tool tells the model to change only what was asked, and to change ALL of it", () => {
  const d = TEXT_TOOL.input_schema.properties.edits.description;
  assert.match(d, /LEAVE OUT everything the change does not mention/i);
  assert.match(d, /EVERY one of them/i, "a footer changed on one page of five is worse than not changed");
  assert.match(d, /empty array rather than guessing/i, "no-match must be expressible");
  const to = TEXT_TOOL.input_schema.properties.edits.items.properties.to.description;
  assert.match(to, /no quotes, no braces/i, "the model must be told what breaks the source");
});

// ── the wiring layer, which is where this repo keeps losing features ──────────
//
// worker.js cannot be imported, so every assertion here reads it. Eight times
// now a feature has been correct at every layer and dead at one silent one.

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The edit handler's own block, so a claim about it cannot be satisfied by the build path. */
function editBlock() {
  const from = WORKER.indexOf("\n          if (ed) {");
  assert.ok(from > 0, "the edit handler is gone or renamed — every assertion below would pass vacuously");
  const to = WORKER.indexOf("\n          if (ad) {", from);
  assert.ok(to > from, "could not find the end of the edit handler");
  return WORKER.slice(from, to);
}

test("the route exists, is dispatched, and reaches the module", () => {
  assert.match(WORKER, /const ed = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/[^\n]*\\\/edit\$/,
    "no /api/site/<slug>/edit matcher");
  // In the dispatch condition AND in the ownerSlug list. Missing from either is
  // the exact shape of the `dm2` bug: a handler that looks gated and is dead.
  const gate = WORKER.match(/if \(om \|\| mm \|\|[^)]*\) \{/g) || [];
  assert.ok(gate.length && gate.every((g) => g.includes("|| ed")),
    "the edit matcher is not in the dispatch condition");
  // THE PROPERTY, NOT THE LIST. This pinned `|| ed)` and went red the day the
  // addon matcher was added after it — a guard about word order, which is what
  // this repo keeps recording. What matters is that `ed` is in the expression.
  const owner = WORKER.match(/const ownerSlug = \(([^)]*)\)\[1\]/);
  assert.ok(owner, "the ownerSlug expression is gone or reshaped");
  assert.ok(owner[1].split("||").map((s2) => s2.trim()).includes("ed"),
    "the edit matcher is not in the ownerSlug list, so it would read another route's slug");
  const b = editBlock();
  assert.match(b, /runTextEdit\(/, "the text layer is not wired to the module");
  assert.match(b, /recompileAndPublish\(/, "the lane never publishes");
  assert.match(b, /assertOwner\(/, "the edit lane is not ownership-gated");
});

test("the edit handler CANNOT reach the schema, the seeder or the page generator", () => {
  // The guarantee is a property of the code path, not a rule inside a 700-line
  // handler. Comments blanked, since the block explains what it may not do.
  const raw = editBlock();
  const b = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(b.length, raw.length, "blanking must preserve offsets");
  // WHAT MAKES AN EDIT SAFE IS THE SCHEMA, NOT THE GENERATOR. This listed
  // `generateSitePages` too, which was true while the lane had only `text` and
  // `look` and became a FALSE CLAIM the day the `page` layer landed — that layer
  // generates, deliberately, one file instead of five. Page generation is merely
  // expensive; touching the database is what an edit must never do.
  for (const forbidden of ["applySiteSchema", "seedSiteRows", "ensureSiteBackend", "buildAndPublishPages"]) {
    assert.ok(!b.includes(forbidden), "the edit lane must not be able to reach " + forbidden);
  }
  // AND THE GENERATION IT DOES DO IS BOUNDED. Without the mode and the target it
  // is an ordinary revise wearing an edit's name — every page re-emitted, at the
  // price the lane exists to avoid.
  assert.match(b, /generateSitePages\([^;]*"page", target\.path\)/s,
    "the page layer must generate in page mode against one named file");
  assert.equal((b.match(/generateSitePages\(/g) || []).length, 1,
    "the edit lane must make at most one generation call");
  // Not passing because the block was blanked away.
  assert.match(b, /runTextEdit/);
});

test("the charge comes AFTER the publish, on every layer", () => {
  // The exemption IS the ordering: a publish that throws leaves the spend
  // un-made. A mutation moving the charge up would bill for a site that was
  // never changed.
  const b = editBlock();
  // ANCHOR ON THE CALL, NOT THE DEFINITION. The first draft of this took
  // `indexOf("collectCredits(")`, which lands inside the `eCharge` helper
  // declared near the top of the block — so it measured where the helper is
  // WRITTEN rather than where it RUNS, and went red on correct code. Same trap
  // as a guard matching `buildEffortHTML()`'s own definition.
  assert.equal((b.match(/collectCredits\(/g) || []).length, 1,
    "there must be exactly one place money leaves the ledger");
  const calls = [...b.matchAll(/eCharge\(/g)].map((m) => m.index);
  assert.ok(calls.length >= 3, "each layer's success must charge — found " + calls.length);
  // EVERY CHARGE COMES AFTER THE WORK IT BILLS FOR, which is not the same as
  // "after the publish" — this asserted the latter and went red on the DATA
  // layer, whose defining property is that it publishes nothing at all. Rows are
  // read at runtime, so the change is live the moment it commits.
  for (const at of calls) {
    const published = b.lastIndexOf("recompileAndPublish(", at);
    const wroteRows = b.lastIndexOf("runDataEdit(", at);
    assert.ok(published > 0 || wroteRows > 0,
      "a charge at offset " + at + " runs before any work was done");
  }
  // And the data layer really does skip the container, or it is not the cheap
  // layer it claims to be. Asserted as an absence between its own boundaries.
  const dFrom = b.indexOf('if (eLayer === "data") {');
  const dTo = b.indexOf('if (eLayer === "text") {');
  assert.ok(dFrom > 0 && dTo > dFrom, "the data layer is gone or moved");
  const dBlock = b.slice(dFrom, dTo);
  assert.ok(!dBlock.includes("recompileAndPublish("),
    "the data layer must not recompile — rows are read at runtime");
  assert.match(dBlock, /runDataEdit\(/);
  // And the helper itself is declared once, so the ordering above cannot be
  // satisfied by a second charge site that happens to sit lower.
  assert.equal((b.match(/const eCharge = /g) || []).length, 1);
});

test("a failed edit publishes nothing and says the site is untouched", () => {
  const b = editBlock();
  // DERIVED FROM THE BRANCHES, not a count somebody remembers to bump — this
  // read `=== 2` and went red the day a third layer landed, which is a test
  // about arithmetic rather than about the promise it is protecting.
  const compiles = (b.match(/error: "compile"/g) || []).length;
  assert.ok(compiles >= 2, "expected a compile-failure branch per publishing layer, found " + compiles);
  assert.equal((b.match(/site is untouched/g) || []).length, compiles,
    "every layer's compile failure must tell the customer their site survived it");
  // A 422 THAT IS NOT A COMPILE FAILURE IS FINE — the data layer refuses with
  // one when it matched nothing, and it never compiles anything. This asserted
  // equality and went red on a legitimate fourth refusal. What must hold is that
  // no compile failure escapes as a success.
  assert.ok((b.match(/status: 422/g) || []).length >= compiles,
    "a failed compile is not reported as success");
});

test("everything the lane cannot do escalates with a 200, not a refusal", () => {
  // This route sits BELOW addon and build on a ladder. A 4xx here shows somebody
  // a refusal for a change that is perfectly possible one rung up.
  const b = editBlock();
  assert.match(b, /escalate = \(reason, extra\) =>\s*\n?\s*Response\.json\(\{ ok: false, escalate: true/,
    "the escalation helper is gone or no longer answers 200");
  for (const reason of ["empty", "unconfigured", "no-source", "no-backend", "no-meta", "no-look", "needs-pages", "no-change", "layer"]) {
    assert.ok(b.includes('escalate("' + reason + '"'), "no escalation path for: " + reason);
  }
});

test("a family or structure change is escalated, never silently stored", () => {
  // The container is handed theme, tokens and fonts — those really do change a
  // recompiled site. `family` and `structure` are what the PAGES were written
  // against and the container never sees them, so storing one here would report
  // success, change nothing a visitor can see, and leave the stored look
  // disagreeing with the pages it describes.
  const b = editBlock();
  const needs = b.indexOf("const needsPages");
  const write = b.indexOf("INSERT INTO _meta (k,v) VALUES ('site_look'");
  assert.ok(needs > 0 && write > 0, "the guard or the write is gone — this assertion cannot hold vacuously");
  assert.ok(needs < write, "the family/structure check must run BEFORE the look is stored");
  assert.match(b, /needsPages\.length\) return escalate\("needs-pages"/);
});

test("nothing reads a property off siteBackendBySlug — it returns a STRING", () => {
  // THE BUG THIS EXISTS FOR, found while wiring the edit lane and already live:
  // `recompileAndPublish` did `const conn = await siteBackendBySlug(...); const
  // db = conn && conn.conn;`. That is `undefined` for a string, so the `_meta`
  // read it guards never ran — and every publish through the shared spine
  // shipped with no theme, no colour overrides, the default fonts and the site's
  // SLUG in place of its brand. Exactly the divergence that function was
  // extracted to end, reintroduced by one property access.
  //
  // DERIVED FROM THE FUNCTION'S OWN RETURN, so it stops being true the day the
  // contract really changes rather than the day somebody forgets this comment.
  const decl = WORKER.match(/async function siteBackendBySlug\(env, slug\) \{ return ([^;]+); \}/);
  assert.ok(decl, "siteBackendBySlug is gone or reshaped — re-derive this guard");
  assert.match(decl[1], /_resolveBackend/, "the lookup no longer goes through the route resolver");
  const routing = fs.readFileSync(new URL("../site-routing.mjs", import.meta.url), "utf8");
  assert.match(routing, /if \(deps\.kv\) \{\s*\n\s*try \{\s*\n\s*const hit = await deps\.kv\.get\(key\);\s*\n\s*if \(hit\) return hit;/,
    "lookupRoute no longer returns the KV value directly, so it may no longer be a string");

  // Every binding of its result, and what is done with that binding.
  const binds = [...WORKER.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await siteBackendBySlug\(/g)].map((m) => m[1]);
  assert.ok(binds.length >= 8, "only found " + binds.length + " callers — the scan broke");
  const src = WORKER.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  for (const name of new Set(binds)) {
    for (const prop of ["conn", "uid", "brief", "neon_db"]) {
      assert.ok(!new RegExp("\\b" + name + "\\." + prop + "\\b").test(src),
        "`" + name + "." + prop + "` reads a property off a connection string — it is always undefined");
    }
  }
});

// ── the client half, which is the other layer that goes silently dead ─────────

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("the composer opens the two cheap rungs, and dispatches the edit", () => {
  // Without `hasSite` on the wire the router has two work answers and every
  // change to a live site is a ~25-credit rewrite. Asserted at BOTH ends —
  // either alone passes while the wire is cut.
  // THE BODY LINE ITSELF, not a byte window from the fetch — a window sized in
  // characters stops covering what it was written for the moment a comment is
  // added above the thing it checks, which this repo has recorded three times
  // and which the first draft of this assertion did again.
  const body = CHAT.split("\n").find((l) => l.includes("body: JSON.stringify({ message: t, site: digest,"));
  assert.ok(body, "the routing call's body is gone or reshaped — re-derive this guard");
  assert.match(body, /hasSite:/, "the routing call does not send hasSite");
  assert.match(body, /slug: site\.slug/, "the routing call does not send the slug");
  // `hasSite` must be about a PUBLISHED site, not merely about a project
  // existing in localStorage — the router's two new rungs write to a live site.
  assert.match(CHAT, /hasSite: !!\(site\.slug && sitePages\(site\)\.length\)/,
    "hasSite is no longer derived from the site actually having pages");
});

test("the server reads hasSite off the body, strictly", () => {
  // `=== true`, like firstBuild and attached beside it: nothing merely truthy
  // off a public body may open a write path over a published site.
  assert.match(WORKER, /hasSite: rb\.hasSite === true/,
    "the route ignores hasSite, so edit and addon are unreachable for everyone");
});

test("an edit is dispatched, and every failure falls back to the build", () => {
  assert.match(CHAT, /d\.intent === 'edit' && site\.slug\) return siteEdit\(/,
    "the client never routes an edit anywhere");
  const from = CHAT.indexOf("function siteEdit(");
  assert.ok(from > 0, "siteEdit is gone — the assertions below would pass vacuously");
  const to = CHAT.indexOf("\nfunction editReply(", from);
  assert.ok(to > from, "could not find the end of siteEdit");
  const b = CHAT.slice(from, to);
  assert.match(b, /'\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/edit'/, "siteEdit posts nowhere");
  // THE ESCALATION MUST NEVER SURFACE AS AN ERROR. It is the whole reason
  // trying the cheap rung first is safe.
  assert.match(b, /if \(e\.escalate\) return fallback\(\)/);
  assert.match(b, /if \(!e\) return fallback\(\)/, "an unreadable body is not a refusal");
  assert.match(b, /\}\)\.catch\(fallback\)/, "a network drop must land on the build too");
  // And the escalation branch must come BEFORE the generic failure branch, or a
  // 200 carrying escalate:true would be read as an error and shown as one.
  assert.ok(b.indexOf("e.escalate") < b.indexOf("!r.ok || !e.ok"),
    "the escalation check must run before the failure check");
  // A published change has to bust the preview, or it reads as not applied.
  assert.match(b, /previewV = \(s\.previewV \|\| 0\) \+ 1/);
});

// ── the page layer: one page's source, one model call ────────────────────────

const { priorPagesBlock: pageBlock, pagesRequest: pageReq } = await import("../builder/page-gen.mjs");

const P_SITE = [
  { path: "src/routes/index.tsx", source: 'export default function Home(){return <p>Sharp Fade</p>;}' },
  { path: "src/routes/book.tsx", source: 'export default function Book(){return <p>Book a chair</p>;}' },
  { path: "src/routes/prices.tsx", source: 'export default function Prices(){return <p>From 20</p>;}' },
];

test("page mode shows ONE page's source and merely names the others", () => {
  // The prior-source block rides in the USER message and is NOT cached, so
  // showing one file instead of five is a real saving on input as well as
  // output. The other paths go in so a link can point at one.
  const b = pageBlock(P_SITE, "page", "src/routes/book.tsx");
  assert.match(b, /THE PAGE YOU ARE CHANGING/);
  assert.match(b, /Book a chair/, "the target's source must be shown");
  assert.ok(!b.includes("Sharp Fade"), "another page's SOURCE must not be in the prompt");
  assert.ok(!b.includes("From 20"));
  assert.match(b, /must not return: src\/routes\/index\.tsx, src\/routes\/prices\.tsx/,
    "the other pages must be named so a link can point at one");
  assert.match(b, /RETURN THIS ONE FILE AND NOTHING ELSE/);
});

test("a target nobody can find degrades to the full revise rather than editing the wrong file", () => {
  const b = pageBlock(P_SITE, "page", "src/routes/gallery.tsx");
  assert.ok(!/THE PAGE YOU ARE CHANGING/.test(b), "a missing target must not produce a page-mode prompt");
  assert.match(b, /Return every page again/, "it must fall back to what the caller would have done anyway");
});

test("page mode reaches the request through the ONE call definition", () => {
  const r = pageReq({ brief: "move the form up", spec: { tables: [] }, brand: "Sharp Fade", priorPages: P_SITE, mode: "page", target: "src/routes/book.tsx" });
  const body = typeof r.messages[0].content === "string" ? r.messages[0].content : r.messages[0].content.at(-1).text;
  assert.match(body, /THE PAGE YOU ARE CHANGING/);
  // The cached system block must be byte-identical to a revise's, or every page
  // edit misses the ~27,000-token prompt cache.
  const rev = pageReq({ brief: "x", spec: { tables: [] }, brand: "Sharp Fade", priorPages: P_SITE });
  assert.deepEqual(r.system, rev.system);
});

test("the page layer takes ONLY the page that was asked for", () => {
  // A page edit that returns a different file is not a page edit, and taking it
  // would let one instruction rewrite a page the customer never named. The
  // prompt says so; this is the half that cannot be talked out of it.
  const b = editBlock();
  assert.match(b, /const wrote = \(pValid\.pages \|\| \[\]\)\.find\(\(p\) => p\.path === target\.path\)/,
    "the handler does not pin the returned file to the target");
  assert.match(b, /ignored:/, "files the model returned uninvited must be reported, not silently dropped");
  // An unchanged page is not a publish: it would bill a recompile for a
  // byte-identical site.
  assert.match(b, /wrote\.source === target\.source/);
});

test("the page layer finds its file through routeOf, not a second mapping", () => {
  // Two path-to-route readers are two things that can disagree about what
  // src/routes/shop/index.tsx is called.
  const b = editBlock();
  assert.match(b, /eSrc\.find\(\(p\) => p && routeOf\(p\.path\) === wantRoute\)/);
  assert.ok(!/\.replace\(\/\^src\\\/routes\\\//.test(b), "the handler is rolling its own path mapping");
});

test("a page the site does not have escalates to the rung that can add one", () => {
  const b = editBlock();
  assert.match(b, /if \(!target\) return escalate\("no-page"/,
    "asking to change a page that does not exist IS an addon");
});

// ── the data layer: the content the site STORES ──────────────────────────────
//
// The gap the audit found. A generated site keeps its menu and prices in a
// `display` table and renders them with useRows, so those words are NOT in the
// page source — "change the price of a haircut to £25" fell through edit, addon
// and build and came back ~25 credits later with the price unchanged.

const {
  DATA_TOOL, DATA_MODEL, MAX_DATA_ROWS: DROWS, MAX_DATA_OPS,
  dataDigest, dataRequest, readDataChanges, runDataEdit,
} = await import("../builder/site-apply.mjs");

const MENU = [{
  name: "services",
  columns: ["name", "price", "minutes"],
  rows: [
    { id: 1, name: "Haircut", price: "£22", minutes: 30 },
    { id: 2, name: "Beard trim", price: "£12", minutes: 15 },
  ],
}];
const dataReply = (changes, usage) => ({
  content: [{ type: "tool_use", name: "write_row_changes", input: { changes } }],
  usage: usage || { input_tokens: 400, output_tokens: 30 },
});

test("the model is shown the rows it may change, with their ids", () => {
  const d = dataDigest(MENU);
  assert.match(d, /TABLE services — columns: name, price, minutes/);
  assert.match(d, /id 1: name="Haircut", price="£22", minutes=30/);
  assert.match(dataRequest({ instruction: "haircut is now £25", tables: MENU }).messages[0].content, /£25/);
  assert.match(DATA_MODEL, /haiku/i, "picking a row is not a design task");
});

test("an id nobody offered cannot reach SQL", () => {
  // The model picks an id off a list we printed; the caller checks it against
  // the same list, so a number it invented is not a row.
  assert.equal(readDataChanges(dataReply([{ table: "services", id: 999, values: { price: "£30" } }]), MENU).length, 0);
  assert.equal(readDataChanges(dataReply([{ table: "bookings", id: 1, values: { price: "£30" } }]), MENU).length, 0,
    "a table nobody offered is not a table");
  assert.equal(readDataChanges(dataReply([{ table: "services", id: 1, values: { secret: "x" } }]), MENU).length, 0,
    "a column the table does not declare is dropped");
});

test("a real change survives, and a shape in a column does not", () => {
  const ok = readDataChanges(dataReply([{ table: "services", id: 1, values: { price: "£25" } }]), MENU);
  assert.deepEqual(ok, [{ table: "services", id: 1, values: { price: "£25" } }]);
  // An object in a column is the `Row` index-signature error arriving from the
  // other direction, and it would reach Postgres as "[object Object]".
  assert.equal(readDataChanges(dataReply([{ table: "services", id: 1, values: { price: { amount: 25 } } }]), MENU).length, 0);
  assert.equal(readDataChanges(dataReply([{ table: "services", id: 1, values: { price: ["£25"] } }]), MENU).length, 0);
});

test("a row with no id is an INSERT", () => {
  const add = readDataChanges(dataReply([{ table: "services", values: { name: "Hot towel", price: "£8", minutes: 10 } }]), MENU);
  assert.equal(add.length, 1);
  assert.equal(add[0].id, undefined, "no id means add, not overwrite row 0");
  assert.equal(add[0].values.name, "Hot towel");
});

test("nothing matched does NOT escalate — the rungs above cannot change a row either", async () => {
  // Sending this up the ladder spends ~25 credits to fail differently, which is
  // the exact shape the data layer was built to end.
  const r = await runDataEdit({ send: async () => dataReply([]), apply: async () => true },
    { instruction: "remove the beard trim", tables: MENU });
  assert.equal(r.ok, false);
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "no-match");
  assert.ok(r.usage, "a call that happened is still billed");
});

test("a site with no display table DOES escalate", async () => {
  // Here the rung above really might help: they may be asking for a page change.
  const r = await runDataEdit({ send: async () => dataReply([]), apply: async () => true },
    { instruction: "x", tables: [] });
  assert.equal(r.escalate, true);
  assert.equal(r.reason, "no-data");
  assert.equal(r.usage, null, "a site with nothing stored costs no model call");
});

test("a partial apply is REPORTED, not hidden", async () => {
  // Rows are independent, unlike a page where half an edit is a file that does
  // not compile — so the ones that worked are worth keeping, and the owner has
  // to be told about the one that did not.
  let n = 0;
  const r = await runDataEdit({
    send: async () => dataReply([
      { table: "services", id: 1, values: { price: "£25" } },
      { table: "services", id: 2, values: { price: "£14" } },
    ]),
    apply: async () => (++n === 1),
  }, { instruction: "put the prices up", tables: MENU });
  assert.equal(r.ok, true);
  assert.equal(r.applied.length, 1);
  assert.equal(r.failed, 1, "the failure must be counted, not swallowed");
});

test("the number of changes one instruction may make is bounded", () => {
  const many = Array.from({ length: MAX_DATA_OPS + 5 }, () => ({ table: "services", values: { name: "x" } }));
  assert.equal(readDataChanges(dataReply(many), MENU).length, MAX_DATA_OPS);
});

test("the tool tells the model to return nothing rather than guess", () => {
  const d = DATA_TOOL.input_schema.properties.changes.description;
  assert.match(d, /empty array/i);
  assert.match(d, /DELETE/i, "the one thing this layer cannot do must be named");
  assert.match(d, /Guessing at the nearest row is worse/i);
});

test("the route reads only tables the PUBLIC can read and NOBODY can write", () => {
  // `display` only, and it is a boundary rather than a shortcut: a `collect`
  // table holds customers' bookings, and "cancel John's booking" is not a
  // sentence to hand a model.
  const b = editBlock();
  assert.match(b, /pair\.read === "anyone" && pair\.write === "none"/,
    "the data layer does not restrict itself to display tables");
  assert.match(b, /LIMIT " \+ MAX_DATA_ROWS/, "the row read is unbounded");
});

test("every write failing is a FAILURE, not a success with nothing in it", async () => {
  // The mutation sweep's one survivor. Without this the owner is told the change
  // landed, `applied` is empty, and the site is exactly as it was — the failure
  // this whole lane is written to prevent, arriving through the write path
  // instead of the model.
  const r = await runDataEdit({
    send: async () => dataReply([{ table: "services", id: 1, values: { price: "£25" } }]),
    apply: async () => { throw new Error("connection lost"); },
  }, { instruction: "haircut is £25", tables: MENU });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "write");
  assert.equal(r.failed, 1);
  // NOT escalated: a database that would not take the write will not take it
  // for a bigger lane either.
  assert.equal(r.escalate, false);

  // And a write that merely returns falsy counts the same as one that throws.
  const quiet = await runDataEdit({
    send: async () => dataReply([{ table: "services", id: 1, values: { price: "£25" } }]),
    apply: async () => false,
  }, { instruction: "x", tables: MENU });
  assert.equal(quiet.ok, false);
  assert.equal(quiet.reason, "write");
});

test("the composer has a reply for the data layer, and names what moved", () => {
  // A layer the client cannot describe reports "✅ Done." for a price change,
  // which leaves the owner with nothing to check — and this lane touches rows
  // they cannot see in the page source.
  const from = CHAT.indexOf("function editReply(");
  assert.ok(from > 0, "editReply is gone");
  const to = CHAT.indexOf("\n}\n", CHAT.indexOf("return '✅ Done.';", from));
  const b = CHAT.slice(from, to);
  assert.match(b, /e\.layer === 'data'/, "the client cannot describe a data edit");
  assert.match(b, /r\.table/, "the reply does not name which table changed");
  assert.match(b, /e\.failed/, "a partial apply must be told to the owner");
});

test("a page edit NAMES the page, and never hides what it refused", () => {
  // THE SILENT PARTIAL THIS CLOSES. The page layer changes exactly one file and
  // drops anything else the model returned — deliberately, so one instruction
  // cannot rewrite a page nobody named. But `editReply` had no `page` branch, so
  // it fell through to "✅ Done.": ask for a link "on every page", get it on one,
  // and be told it worked, with the site left disagreeing with itself.
  const from = CHAT.indexOf("function editReply(");
  assert.ok(from > 0, "editReply is gone");
  const to = CHAT.indexOf("\n}\n", CHAT.indexOf("return '✅ Done.';", from));
  const b = CHAT.slice(from, to);
  assert.match(b, /e\.layer === 'page'/, "the client cannot describe a page edit");
  assert.match(b, /e\.ignored/, "the pages this layer refused are never shown to the owner");
  assert.match(b, /left alone/, "a partial must say which pages were not touched");

  // EVERY LAYER THE ROUTE CAN RETURN HAS A BRANCH, derived rather than listed —
  // a fifth layer added later must not fall through to "Done" the way this one
  // did for its whole life.
  for (const layer of EDIT_LAYERS) {
    assert.ok(b.includes("e.layer === '" + layer + "'"),
      "editReply has no branch for the " + layer + " layer, so it would report a bare Done");
  }
});

test("the rules say a multi-page change is NOT a page edit", () => {
  // The other end of the same failure: the router should never pick this layer
  // for "on every page", because the layer physically cannot do it.
  const d = ASK_TOOL.input_schema.properties.layer.description;
  assert.match(d, /ONE PAGE, AND ONLY ONE/);
  assert.match(d, /every page/i, "the description must name the case it gets wrong");
  assert.match(d, /Answer "addon" for those/, "it must say where the change belongs instead");
});
