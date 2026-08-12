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
  // ONE PAST THE CAP, deliberately: stopping AT it makes "exactly full" and
  // "there was more" indistinguishable, and the only safe reading of that is the
  // pessimistic one — which sends a site sitting exactly on the boundary up to
  // the expensive lane for nothing.
  assert.equal(items.length, MAX_TEXT_ITEMS + 1, "2000 strings must not all be paid for");
  const body = textRequest({ instruction: "x", items }).messages[0].content;
  assert.equal(body.split("\n").filter((l) => /^\d+\. \[/.test(l)).length, MAX_TEXT_ITEMS);
});

test("a site too wordy to see whole is escalated, never half-edited", async () => {
  // THE CAP REINTRODUCED THE BUG THIS LAYER'S DESIGN AVOIDS. `textItems` is flat
  // and cross-page because a phone number lives in a footer on every page, and
  // changing it in one place "leaves the site disagreeing with itself — which is
  // worse than not changing it, because nobody notices". A truncated list does
  // exactly that: the model gets the first N strings under the heading "THE TEXT
  // ON THEIR SITE", changes what it can see, and the last page keeps the old
  // number. Measured before the cap moved: 2 of the 100 exemplars truncated.
  const { runTextEdit } = await import("../builder/site-apply.mjs");
  const big = Array.from({ length: 40 }, (_, i) => ({
    path: "src/routes/p" + i + ".tsx",
    source: Array.from({ length: 30 }, (_, j) => "      <p>line " + i + "-" + j + "</p>").join("\n"),
  }));
  let called = false;
  const out = await runTextEdit({ send: () => { called = true; return {}; } }, { instruction: "x", pages: big });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "too-much-text");
  assert.equal(out.escalate, true, "the rung above must still do the work");
  assert.equal(called, false, "a model call was paid for on a view that could never be complete");
});

test("the cap clears every real site, with headroom", async () => {
  // MEASURED, NOT PICKED. Across the 100 family exemplars — the closest thing in
  // the repo to a generated site — the counts are median 201, p90 260, max 424
  // (repair-shop at 3 pages, salon at 6). At 400 the largest two truncated and
  // silently half-edited; 600 clears them all and costs nothing on the other 98,
  // because a cap only bills when it binds.
  const { extractText } = await import("../builder/site-text.mjs");
  const root = new URL("../builder/lovable/template/src/family-pages/", import.meta.url);
  let worst = 0, worstFam = "", counted = 0;
  for (const fam of fs.readdirSync(root)) {
    let n = 0, saw = false;
    for (const f of fs.readdirSync(new URL(fam + "/", root))) {
      if (!f.endsWith(".tsx")) continue;
      saw = true;
      n += extractText(fs.readFileSync(new URL(fam + "/" + f, root), "utf8")).length;
    }
    if (!saw) continue;
    counted++;
    if (n > worst) { worst = n; worstFam = fam; }
  }
  assert.ok(counted > 80, "only " + counted + " families scanned — the walk broke");
  assert.ok(worst < MAX_TEXT_ITEMS,
    "the wordiest site (" + worstFam + ", " + worst + " strings) does not fit under the cap of " + MAX_TEXT_ITEMS +
    " — every edit on it escalates to a full revise");
  // And the cap is not so far above the corpus that it has stopped meaning
  // anything: a guard with no relation to the thing it bounds is not a guard.
  assert.ok(MAX_TEXT_ITEMS < worst * 3, "the cap is " + MAX_TEXT_ITEMS + " against a worst case of " + worst);
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

/**
 * One layer's branch, from its own `if` to whichever branch comes NEXT.
 *
 * DERIVED, because sliced to a named neighbour it swallows anything inserted
 * between them — measured: adding the `picture` branch between `rules` and
 * `text` put a recompiling layer inside the window that asserts the rules layer
 * never recompiles, and inside the one that asserts the data layer never does.
 * Both went red on a correct change, which is the overlapping-window bug this
 * repo already records twice.
 */
function layerBranch(b, layer) {
  const from = b.indexOf('if (eLayer === "' + layer + '") {');
  assert.ok(from >= 0, "the " + layer + " layer is gone or moved");
  const rest = [...b.matchAll(/if \(eLayer === "[a-z]+"\) \{/g)]
    .map((m) => m.index).filter((i) => i > from);
  const to = rest.length ? rest[0] : b.length;
  assert.ok(to > from, "the " + layer + " branch is empty");
  return b.slice(from, to);
}

test("the edit handler CANNOT reach the schema, the seeder or the page generator", () => {
  // The guarantee is a property of the code path, not a rule inside a 700-line
  // handler. Comments blanked, since the block explains what it may not do.
  const raw = editBlock();
  const b = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(b.length, raw.length, "blanking must preserve offsets");
  // THE BAN BECOMES A SCOPE, FOR THE SECOND TIME. This listed
  // `generateSitePages`, which was true while the lane had only `text` and
  // `look` and became a FALSE CLAIM the day the `page` layer landed. It then
  // listed `applySiteSchema`, which was true until the `rules` layer landed —
  // that layer's whole purpose is to change what a table DOES, which is a schema
  // apply and nothing else. A guard that forbids the feature is not protecting
  // anything; what it must hold now is that the reach is BOUNDED to one branch.
  //
  // These three stay absolutely forbidden and are the ones that matter:
  // `seedSiteRows` FABRICATES ROWS — a rule change that invents a customer's
  // booking is the worst thing this lane could do — and the other two are how a
  // build provisions and republishes a whole site.
  for (const forbidden of ["seedSiteRows", "ensureSiteBackend", "buildAndPublishPages"]) {
    assert.ok(!b.includes(forbidden), "the edit lane must not be able to reach " + forbidden);
  }
  assert.equal((b.match(/applySiteSchema\(/g) || []).length, 1,
    "the schema may be applied from exactly one place in the edit lane");
  const rBlock = layerBranch(b, "rules");
  assert.ok(rBlock.includes("applySiteSchema("),
    "…and that place is the rules branch, not some other layer");
  // AND IT PUBLISHES NOTHING, which is what makes it a rung below `look` rather
  // than a variant of `addon`. Asserted as an absence between its own
  // boundaries, exactly as the data layer's is.
  assert.ok(!rBlock.includes("recompileAndPublish("),
    "a rule is enforced in Postgres and on the request path — no page changes, so nothing is republished");
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
  const dBlock = layerBranch(b, "data");
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
  // THE PROMISE, NOT THE PHRASE. This counted the literal "site is untouched"
  // and went red on a fifth branch that keeps the promise in different words
  // ("so nothing changed") — a test about wording, on a file whose whole subject
  // is that a customer must be told their site survived. The alternation is
  // small and deliberate: these are the ways this codebase says it, and a new
  // branch that says it a sixth way should have to add itself here rather than
  // pass by accident.
  const survived = (b.match(/site is untouched|nothing changed|your site is exactly as it was/g) || []).length;
  assert.equal(survived, compiles,
    "a compile failure does not tell the customer their site survived it: " + survived + " of " + compiles);
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
  //
  // THIS GUARD PINNED THE BROKEN SPELLING and was green for the whole time the
  // layer was dead: it required `pair.read === "anyone"`, which is the bug —
  // "anyone" is a WRITE level, so the condition was false for every table on
  // every site and every data edit answered `no-data`. It asserts the PROPERTY
  // now, through the preset, which is the only form that cannot restate a
  // mistake as a requirement.
  const b = editBlock();
  assert.match(b, /pair\.read !== DISPLAY_PAIR\.read \|\| pair\.write !== DISPLAY_PAIR\.write/,
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

test("EVERY LAYER THE WORKER IMPLEMENTS IS ONE THE ROUTER CAN ASK FOR", () => {
  // THE OTHER DIRECTION, and it is the one that was missing. Every guard about
  // layers loops over `EDIT_LAYERS`, so DELETING a name from that list shrinks
  // what they check and the whole layer goes unreachable with the suite green —
  // measured: removing "rules" survived all 2153 tests. A derived check cannot
  // be derived from the thing being mutated.
  //
  // So this reads the branches the Worker really has and requires the router to
  // offer each one. A layer with a handler nobody can route to is dead code that
  // looks live from every angle, which this repo has now recorded ten times.
  const b = editBlock();
  const implemented = [...b.matchAll(/eLayer === "([a-z]+)"/g)].map((m) => m[1]);
  const uniq = [...new Set(implemented)];
  assert.ok(uniq.length >= 4, "the branch scan found almost nothing, so it is not scanning: " + JSON.stringify(uniq));
  for (const layer of uniq) {
    assert.ok(EDIT_LAYERS.includes(layer),
      "the worker implements the " + layer + " layer and the router cannot ask for it — it is unreachable");
  }
  // AND NO LAYER IS OFFERED WITH NOTHING BEHIND IT. `look` is the one handled by
  // falling through rather than by a named branch, so it is excused explicitly
  // rather than by loosening the rule for everything.
  for (const layer of EDIT_LAYERS) {
    if (layer === "look") continue;
    assert.ok(uniq.includes(layer),
      "the router can ask for the " + layer + " layer and the worker has no branch for it");
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

// ── taking a row away ────────────────────────────────────────────────────────
//
// The awkward half of a pair. The lane could change a row and add one and not
// remove one, so "take the beard trim off the menu" answered with a refusal
// pointing at the Data panel — the cheapest possible request routed to the one
// place the customer came here to avoid.
//
// THE UNDO IS THE WHOLE DESIGN CONSTRAINT. A page deleted by mistake is one
// restore away (every publish is archived); a row is gone. So the removal
// carries the row's contents back, out of OUR list rather than the model's, and
// the reply prints them — the thread IS the undo.

test("a removal names a row we offered, and carries what it was", () => {
  const out = readDataChanges(dataReply([{ table: "services", id: 2, remove: true }]), MENU);
  assert.equal(out.length, 1);
  assert.equal(out[0].remove, true);
  assert.equal(out[0].id, 2);
  assert.deepEqual(out[0].was, { id: 2, name: "Beard trim", price: "£12", minutes: 15 },
    "the deleted row's contents are the only undo it has");
});

test("`was` comes from our own list, never from the model", () => {
  // The reply echoes it back as the undo, so a model that invented the contents
  // would have the customer restore a row that never existed. It is looked up by
  // id in the rows WE printed; anything the model sent alongside is ignored.
  const out = readDataChanges(dataReply([{
    table: "services", id: 2, remove: true,
    was: { name: "Something else" }, values: { name: "Something else" },
  }]), MENU);
  assert.equal(out[0].was.name, "Beard trim", "the model's version of the row was believed");
});

test("a removal cannot name a row nobody offered", () => {
  // The same gate the value path has, and it matters more here: an id the model
  // invented would be a DELETE against a real table on a number nobody checked.
  assert.equal(readDataChanges(dataReply([{ table: "services", id: 999, remove: true }]), MENU).length, 0);
  assert.equal(readDataChanges(dataReply([{ table: "bookings", id: 1, remove: true }]), MENU).length, 0);
  assert.equal(readDataChanges(dataReply([{ table: "services", remove: true }]), MENU).length, 0,
    "a removal with no id at all was accepted");
  assert.equal(readDataChanges(dataReply([{ table: "services", id: "2", remove: true }]), MENU).length, 1,
    "a numeric string is the shape a model returns and is checkable");
});

test("only a real true removes — nothing merely truthy", () => {
  // `remove: "no"` is truthy, and a loose check would delete a row on a model
  // that was answering "no". The value path is what an unrecognised flag falls
  // through to, which is the recoverable direction.
  const soft = readDataChanges(dataReply([{ table: "services", id: 2, remove: "no", values: { price: "£14" } }]), MENU);
  assert.equal(soft.length, 1);
  assert.equal(soft[0].remove, undefined, "a truthy non-true flag deleted the row");
  assert.deepEqual(soft[0].values, { price: "£14" });
  assert.equal(readDataChanges(dataReply([{ table: "services", id: 2, remove: 1 }]), MENU).length, 0,
    "a removal with no values and no real flag is not an edit either");
});

test("removals are bounded with everything else", () => {
  const many = Array.from({ length: MAX_DATA_OPS + 5 }, () => ({ table: "services", id: 1, remove: true }));
  assert.equal(readDataChanges(dataReply(many), MENU).length, MAX_DATA_OPS);
});

test("the tool can express a removal, and does not demand values for one", () => {
  const props = DATA_TOOL.input_schema.properties.changes.items.properties;
  assert.ok(props.remove, "the tool has no way to say a row should go");
  assert.equal(DATA_TOOL.input_schema.properties.changes.items.required.includes("values"), false,
    "a removal cannot be expressed while values is required");
  assert.deepEqual(DATA_TOOL.input_schema.properties.changes.items.required, ["table"]);
  // Said in the description, because the model reading it is the only thing
  // stopping a replacement being expressed as a delete-then-add.
  assert.match(props.remove.description, /Never as a way of replacing a row/);
  assert.match(props.remove.description, /no undo/i);
});

test("the route deletes by bound parameter, and hands `was` back", () => {
  // The wiring layer. worker.js cannot be imported, so the SQL and the response
  // shape are read. The id is already checked against the offered rows, and the
  // statement still binds it — the table name is the only thing interpolated,
  // and it is scrubbed, exactly as the update and insert beside it.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /if \(c\.remove\) \{[\s\S]{0,200}?DELETE FROM \\"" \+ name \+ "\\" WHERE id = \?/,
    "the delete branch is missing or does not bind the id");
  assert.match(w, /removed: true, was: c\.was \|\| null/, "the deleted row's contents never reach the client");
});

test("the refusal no longer sends them somewhere else to delete", () => {
  // It used to read "I can change and add, but not delete", which stopped being
  // true. A message that describes a limit the code no longer has teaches the
  // customer not to ask again.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.equal(/I can change and add, but not delete/.test(w), false,
    "the refusal still claims the lane cannot delete");
  assert.match(w, /say which list it's in and I'll have another go/);
});

test("the replies are DRIVEN, not grepped", async () => {
  // THREE MUTANTS SURVIVED A SOURCE-READ VERSION OF THIS, and all three for the
  // same reason: the mutated line's words survive elsewhere in the file. Deleting
  // `problemNote(e.problems)` from the page branch passed, because the text
  // branch now has one too; blanking the removed-row list passed, because
  // `r.removed` still appears in the line that keeps the others.
  //
  // So the functions are EXTRACTED AND RUN. chat.js cannot be imported — it is a
  // plain browser script — but a function can be sliced out and evaluated, which
  // is what `sitePathOf` already does one file over. This turns a claim about
  // the text of the file into a claim about what the customer is shown.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const cut = (name) => {
    const at = chat.indexOf("function " + name + "(");
    assert.ok(at > 0, name + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    assert.ok(end > at, name + " has no end");
    return chat.slice(at, end + 2);
  };
  const editReply = new Function([cut("problemNote"), cut("photoNote"), cut("sitePathOf"), cut("editReply")].join("\n") +
    "\nreturn editReply;")();

  // A REMOVAL READS AS A REMOVAL, and says what it was. The row is gone from
  // the Data panel too, so the contents in the thread are the whole undo.
  const gone = editReply({ layer: "data", applied: [{ table: "services", id: 2, removed: true, was: { id: 2, name: "Beard trim", price: "£12" } }] });
  assert.match(gone, /removed one entry/i, gone);
  assert.match(gone, /Beard trim/, "the deleted row's contents are not shown: " + gone);
  // NAMES THE WORDS TO SAY, not "say the word" — bare "undo that" is ambiguous
  // to the router and would be classified as something that cannot restore a
  // row at all. Asserted as the property: the offer quotes the row.
  assert.match(gone, /put .*Beard trim.* back/, gone);
  assert.equal(/updated one entry/i.test(gone), false, "a deletion is reported as an update: " + gone);

  // An ordinary edit is unchanged by any of this.
  const upd = editReply({ layer: "data", applied: [{ table: "services", id: 1, columns: ["price"] }] });
  assert.match(upd, /Updated one entry in services/);
  assert.equal(/removed/.test(upd), false, upd);

  // BOTH IN ONE ANSWER, which is the shape "swap the beard trim for a hot
  // towel" produces.
  const both = editReply({ layer: "data", applied: [
    { table: "services", id: 1, columns: ["price"] },
    { table: "services", id: 2, removed: true, was: { name: "Beard trim" } },
  ] });
  assert.match(both, /Updated one entry/i, both);
  assert.match(both, /removed one entry/i, both);

  // THE TEXT REPLY QUOTES WHAT IT NOW SAYS. A count is a number nobody can
  // check against their own site.
  const txt = editReply({ layer: "text", applied: 2, changed: ["Book a chair today", "Open until 7"] });
  assert.match(txt, /Book a chair today/, txt);

  // AND EVERY BRANCH SHOWS WHAT THE LINT FOUND, asserted per branch, because
  // one shared grep passes while any single branch is silent.
  for (const e of [
    { layer: "text", applied: 1, changed: ["x"], problems: ["prices.tsx: names a colour"] },
    { layer: "page", page: "src/routes/prices.tsx", problems: ["prices.tsx: names a colour"] },
  ]) {
    assert.match(editReply(e), /names a colour/, "the " + e.layer + " reply hides what the lint found");
  }
});

test("the text reply names what it now says", () => {
  // "Updated the wording in 3 places" is a number the customer cannot check —
  // the same silent-partial class as the two this lane already fixed, one notch
  // milder. The server has always returned the new strings; nothing read them.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /changed: out\.edits\.map\(\(e\) => e\.to\)/, "the server stopped returning the new wording");
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const branch = chat.slice(chat.indexOf("function editReply("), chat.indexOf("if (e.layer === 'data')"));
  assert.ok(branch.length > 200, "the text branch of editReply moved");
  assert.match(branch, /e\.changed/, "the text reply never reads what the wording now says");
  assert.match(branch, /problemNote\(e\.problems\)/, "a lint problem on a text edit is shown to nobody");
});

// ── the undo ─────────────────────────────────────────────────────────────────
//
// The removal reply offers to put the row back. Nothing made that true: the row
// is gone from the table, so `dataDigest` — which lists what the site has NOW —
// cannot mention it, and the model was handed an instruction with no referent.
// It matched nothing and refused, on a promise made one message earlier.

test("what was just deleted is carried forward, so an undo has a referent", async () => {
  const { recentBlock, MAX_RECENT } = await import("../builder/site-apply.mjs");
  const block = recentBlock([{ table: "services", was: { id: 2, name: "Beard trim", price: "£12" } }]);
  assert.match(block, /Beard trim/, "the deleted row is not shown to the model");
  assert.match(block, /services/);
  // WORDED SO IT IS NOT AN ORDER. It rides on every data edit while it is the
  // latest removal, so a block reading "restore these" would put a row back on
  // an unrelated change.
  assert.match(block, /ONLY USE THIS IF THEY ARE ASKING FOR SOMETHING TO BE PUT BACK/);
  assert.match(block, /ignore this/i);
  // Nothing to say is said in no words at all — an empty heading in the prompt
  // is tokens spent on nothing, on the cheapest call the platform makes.
  assert.equal(recentBlock(null), "");
  assert.equal(recentBlock([]), "");
  assert.equal(recentBlock([{ table: "x" }]), "", "a row with no contents is not a record of anything");
  assert.equal(recentBlock([{ was: { a: 1 } }]), "");
  assert.equal(recentBlock([{ table: "s", was: { id: 4 } }]), "", "an id alone tells the model nothing");
  // Bounded, like every other list that reaches a prompt.
  const many = Array.from({ length: MAX_RECENT + 4 }, (_, i) => ({ table: "t", was: { name: "row" + i } }));
  assert.equal(recentBlock(many).split("\n").filter((l) => l.startsWith("  t:")).length, MAX_RECENT);
  // A shape in a column is not a value, and neither is a whole nested object
  // pasted into the prompt.
  assert.equal(/nested/.test(recentBlock([{ table: "t", was: { a: { nested: 1 } } }])), false);
});

test("the block reaches the request, and only through it", async () => {
  const { dataRequest } = await import("../builder/site-apply.mjs");
  // A VALUE THE DIGEST CANNOT CONTAIN. The first draft used "Beard trim", which
  // is a row in MENU — so the assertion was satisfied by `dataDigest` and passed
  // with the whole undo block deleted. Found by a mutant; the vacuous-assertion
  // shape this repo keeps recording, in my own test.
  const recent = [{ table: "services", was: { name: "Hot stone massage" } }];
  const content = dataRequest({ instruction: "put it back", tables: MENU, recent }).messages[0].content;
  assert.equal(/Hot stone massage/.test(dataDigest(MENU)), false, "the fixture already contains it — the check is vacuous");
  assert.match(content, /Hot stone massage/);
  assert.match(content, /JUST REMOVED FROM THIS SITE/, "the block has no heading, so the rows read as part of the tables");
  // AND A REQUEST WITHOUT ONE IS BYTE-IDENTICAL TO BEFORE. Every caller that
  // does not use this feature must send exactly the request it sent yesterday.
  assert.equal(
    dataRequest({ instruction: "x", tables: MENU }).messages[0].content,
    dataRequest({ instruction: "x", tables: MENU, recent: [] }).messages[0].content);
});

test("the undo is wired end to end, not just built", () => {
  // Three layers, none importable, and this repo has recorded a feature dead at
  // exactly one of these seams nine times over.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /recent: \(eb && eb\.recent\) \|\| null/, "the route never reads it off the body");
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = chat.indexOf("function siteEdit(");
  const body = chat.slice(at, chat.indexOf("\n}", at));
  assert.match(body, /recent:/, "the client never sends it");
  assert.match(body, /d\.layer === 'data'/, "it is sent on layers that could not act on it");
  // REMEMBERED ON A REMOVAL AND FORGOTTEN ON AN ADD. Carried forever, it is a
  // standing offer to re-add a row on an unrelated change.
  assert.match(body, /s\.undoRows = gone/, "nothing remembers what went");
  assert.match(body, /s\.undoRows = null/, "the undo is never cleared, so it can fire twice");
  // That the offer NAMES the row is asserted on the rendered output in "the
  // replies are DRIVEN, not grepped" — a source-read of the same fact would be a
  // second, weaker copy of it.
});

// ── renaming ─────────────────────────────────────────────────────────────────

test("a rename reaches the pages, not just the stored brand", async () => {
  const { renamePages } = await import("../builder/site-apply.mjs");
  // THE NAME LIVES IN TWO PLACES AND ONLY ONE WAS MOVING. `_meta.site_look`
  // drives the <title> and the link preview; every page carries it as a literal,
  // which is the half a visitor reads. So a rename changed the browser tab and
  // left every heading saying the old name — and reported success.
  const pages = [{
    path: "src/routes/index.tsx",
    source: 'import { createFileRoute } from "@tanstack/react-router";\n' +
      'export const Route = createFileRoute("/")({});\n' +
      'export default function Home(){ return <SiteChrome name="Tenfold Nails" tagline="Ten chairs at Tenfold Nails.">' +
      '<h1>Tenfold Nails</h1></SiteChrome>; }',
  }];
  const r = renamePages(pages, "Tenfold Nails", "Sharp Fade");
  assert.ok(r.applied >= 2, "only " + r.applied + " of the visible names changed");
  const src = r.pages[0].source;
  assert.equal(/Tenfold Nails/.test(src), false, "the old name survives: " + src);
  assert.match(src, /name="Sharp Fade"/);
  assert.match(src, /<h1>Sharp Fade<\/h1>/);
  // AND NEVER THE CODE. An import path, a route id or a URL carrying the old
  // name would be a site that does not compile or whose links 404 — which is
  // exactly why this reuses the text editor's own extractor rather than a
  // second, looser rule.
  assert.match(src, /@tanstack\/react-router/);
  assert.match(src, /createFileRoute\("\/"\)/);
});

test("a rename refuses rather than guesses", async () => {
  const { renamePages } = await import("../builder/site-apply.mjs");
  const pages = [{ path: "a.tsx", source: 'export default function A(){ return <h1>A Salon</h1>; }' }];
  for (const [from, to] of [["", "X"], ["A Salon", ""], ["A Salon", "A Salon"], ["A", "B"]]) {
    const r = renamePages(pages, from, to);
    assert.equal(r.applied, 0, "renamed on " + JSON.stringify([from, to]));
    assert.equal(r.pages[0].source, pages[0].source, "the source moved on " + JSON.stringify([from, to]));
  }
  // A one-character old name is the dangerous one and is refused by length:
  // replacing every "A" on a site is not a rename, it is damage.
  assert.equal(renamePages(pages, "A", "Zed").applied, 0);
  // Nothing to find is not a failure — the brand is still worth storing.
  assert.equal(renamePages(pages, "Nowhere Ltd", "X").applied, 0);
});

test("the look layer applies the rename and says how far it got", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*renamePages[^}]*\} from "\.\/builder\/site-apply\.mjs"/,
    "renamePages is called and never imported — a ReferenceError on the live path");
  assert.match(w, /renamePages\(eSrc, priorLook\.brand, merged\.brand\)/, "the look layer never renames the pages");
  assert.match(w, /moved\.includes\("brand"\)/, "every look change would rewrite the pages");
  assert.match(w, /pages: eSrcOut/, "the renamed pages are computed and then not published");
  assert.match(w, /renamed, files: pub\.files/, "the client cannot tell a rename that landed from one that did not");
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /couldn’t find the old name written on any page/,
    "a rename that reached nothing reads as complete success");
});

// ── the picture slot ─────────────────────────────────────────────────────────

test("a photo slot nobody can fill is said out loud", async () => {
  const { countImageSlots } = await import("../builder/site-images.mjs");
  assert.equal(countImageSlots([{ path: "a", source: '<SafeImage src="@@IMG:a chair@@" />' }]), 1);
  assert.equal(countImageSlots([
    { path: "a", source: "@@IMG:one@@ @@IMG:two@@" },
    { path: "b", source: "no pictures here" },
  ]), 2);
  assert.equal(countImageSlots([]), 0);
  assert.equal(countImageSlots(null), 0);

  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // COUNTED BEFORE THE SWEEP, or there is nothing left to count — `applyImages`
  // removes every token, which is the whole point of it.
  for (const [c, a] of [["const aSlots = countImageSlots(aValid.pages);", "aValid.pages = applyImages"],
                        ["const pSlots = countImageSlots(pValid.pages);", "pValid.pages = applyImages"]]) {
    assert.ok(w.indexOf(c) > 0, "no slot count before " + a);
    assert.ok(w.indexOf(c) < w.indexOf(a), "the count runs after the sweep, so it is always zero");
  }
  assert.match(w, /photos: aSlots/, "the addon answer never carries it");
  assert.match(w, /photos: pSlots/, "the page edit never carries it");
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /function photoNote\(/);
  assert.equal((chat.match(/function photoNote\(/g) || []).length, 1, "two copies drift into one lane saying it");
  assert.match(chat, /photoNote\(a\.photos\)/, "the addon reply is silent about an empty frame");
  assert.match(chat, /photoNote\(e\.photos\)/, "the page edit is silent about an empty frame");
});

test("`name=` is code on a DOM element and prose on a component", async () => {
  // THE BUSINESS NAME LIVES BEHIND THIS ONE ATTRIBUTE. Every generated page
  // carries `<SiteChrome name="Tenfold Nails">` — the heading a visitor reads —
  // and `name` was listed unconditionally as code, so the free text editor could
  // not change a business's own name in its own header, and a rename moved the
  // <h1> and the tagline and left the chrome saying the old one. Measured: 2 of 3.
  //
  // The distinction is React's, not one we invented: a lowercase tag is a DOM
  // element, where `name` is the submitted field key and rewriting it changes
  // which column a booking lands in.
  const { extractText } = await import("../builder/site-text.mjs");
  const texts = (s) => extractText(s).map((i) => i.text);
  assert.deepEqual(texts('<SiteChrome name="Tenfold Nails">'), ["Tenfold Nails"]);
  assert.deepEqual(texts('<SiteHeader brand="x" tagline="Ten chairs" name="Tenfold Nails" />'),
    ["Ten chairs", "Tenfold Nails"], "the tag is out of the window a component prop can be seen through");
  for (const dom of ['<input name="email" />', '<input name="Email" />', '<select name="service_id">',
                     '<textarea name="notes" />', '<form><input name="full name" /></form>']) {
    assert.deepEqual(texts(dom), [], "a submitted field key was offered as prose: " + dom);
  }
  // Everything else in the list stays unconditional — the window widened to see
  // the tag, and those patterns are end-anchored, so nothing else may move.
  // A `name=` WITH NO TAG IN VIEW answers "code" — the direction that leaves the
  // string alone. Reachable: a fragment whose opening tag is off the front of
  // the 120-character window, or simply absent.
  assert.deepEqual(texts('name="Zed Motors"'), [], "a name= with no tag was guessed at rather than left alone");
  assert.deepEqual(texts('<div className="flex items-center justify-between">'), []);
  assert.deepEqual(texts('<Link to="/book">'), []);
  assert.deepEqual(texts('useRows("bookings", { order: "created_at" })'), []);
});

test("the rename holds across all 100 family exemplars", async () => {
  // THE FIXTURE ABOVE IS MINE AND THE CORPUS IS NOT. A rename tuned on a page I
  // wrote is tuned to how I write pages; these are the exemplars the model
  // learns the kit from, and they are the closest thing in the repo to what a
  // real generated site looks like.
  //
  // MEASURED: 93 pages carry a chrome name, 93 rename, 0 structural breaks, 1
  // occurrence survives — a business name inside an ARRAY LITERAL ("Licensee:
  // The Dram Room Ltd."), which `extractText` skips because a string preceded by
  // `{` or `,` is usually an object key. That limitation is shared with the free
  // text editor and is not worth widening a rule for one legal-notice line;
  // recorded here so it is a known number rather than a surprise.
  const { renamePages } = await import("../builder/site-apply.mjs");
  const root = new URL("../builder/lovable/template/src/family-pages/", import.meta.url);
  let carried = 0, moved = 0, broke = 0, leftovers = 0;
  for (const fam of fs.readdirSync(root)) {
    let src;
    try { src = fs.readFileSync(new URL(fam + "/index.tsx", root), "utf8"); } catch { continue; }
    const m = src.match(/<SiteChrome\s+name="([^"]+)"/);
    if (!m) continue;
    carried++;
    const out = renamePages([{ path: fam + "/index.tsx", source: src }], m[1], "Zeta Works").pages[0].source;
    if (/<SiteChrome\s+name="Zeta Works"/.test(out)) moved++;
    if (out.includes(m[1])) leftovers++;
    // NOTHING STRUCTURAL MAY MOVE. This is the whole reason it goes through
    // `extractText` rather than a blind replace: an import path or a route id
    // carrying the old name would be a site that does not compile.
    if (!/@tanstack\/react-router/.test(out) || !/createFileRoute\("[^"]*"\)/.test(out)) broke++;
  }
  assert.ok(carried > 80, "only " + carried + " exemplars carry a chrome name — the scan broke");
  assert.equal(moved, carried, "the chrome name did not change on " + (carried - moved) + " of " + carried);
  assert.equal(broke, 0, "the rename moved something structural on " + broke + " pages");
  assert.ok(leftovers <= 2, leftovers + " pages still carry the old name somewhere");
});

test("runDataEdit hands the undo to the request it sends", async () => {
  // THE MODULE'S OWN SEAM, and a mutant walked straight through it: `runDataEdit`
  // took `recent` and called `dataRequest` without it. Both halves were correct
  // and the wire between them was cut — the shape this repo has recorded nine
  // times, here inside one file.
  const { runDataEdit } = await import("../builder/site-apply.mjs");
  let sent = null;
  await runDataEdit({
    send: (req) => { sent = req; return dataReply([]); },
    apply: async () => true,
  }, { instruction: "put it back", tables: MENU, recent: [{ table: "services", was: { name: "Hot stone massage" } }] });
  assert.ok(sent, "nothing was sent");
  assert.match(sent.messages[0].content, /Hot stone massage/, "the undo was accepted and dropped");
});

test("the look reply shows a lint problem and reports how far a rename got", () => {
  // TWO VACUOUS ASSERTIONS FIXED AT ONCE. The lint one was a grep for
  // `problemNote(e.problems)`, which the page branch also contains — so deleting
  // it from the look branch passed. The rename one was a grep for a sentence
  // that survives inside a branch mutated to `if (false)`. Both are driven now.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const cut = (name) => {
    const at = chat.indexOf("function " + name + "(");
    assert.ok(at > 0, name + " is gone from chat.js");
    return chat.slice(at, chat.indexOf("\n}", at) + 2);
  };
  const editReply = new Function(
    [cut("problemNote"), cut("photoNote"), cut("sitePathOf"), cut("editReply")].join("\n") + "\nreturn editReply;")();
  assert.match(editReply({ layer: "look", moved: ["theme"], problems: ["index.tsx: names a colour"] }),
    /names a colour/, "the look reply hides what the lint found");
  // A rename that reached the pages says how far, and one that reached nothing
  // says THAT — which is the only thing the customer needs to act on.
  assert.match(editReply({ layer: "look", moved: ["brand"], renamed: 3 }), /3 places/);
  assert.match(editReply({ layer: "look", moved: ["brand"], renamed: 0 }), /couldn’t find the old name/);
  // And a look change that is not a rename says nothing about one.
  assert.equal(/old name/.test(editReply({ layer: "look", moved: ["theme"], renamed: 0 })), false);
});

// ── the two the live run found ───────────────────────────────────────────────
//
// Both were mine, both shipped, and both were invisible to every one of the
// 2091 unit tests here — because every one drives the decision modules directly
// and neither `worker.js` nor `public/chat.js` can be imported. `edit smoke`
// found them in one pass, which is the entire argument for it existing.

test("the router RETURNS the layer it picked", () => {
  // MEASURED LIVE: `intent=edit layer=undefined`. `readEdit` decides the layer,
  // the route dropped it on the floor, the client posted `layer: ''`, and the
  // edit route could dispatch to none of its four branches. Four working layers,
  // a router that picks between them correctly, and one missing field between
  // them — the whole lane unreachable from the composer.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (url.pathname === "/api/site/route"');
  assert.ok(at > 0, "the routing route moved");
  const body = w.slice(at, w.indexOf("// Website builder", at));
  assert.ok(body.length > 500, "the window no longer covers the route");
  // THE RESPONSE OBJECT ITSELF, not the region around it. Written against the
  // whole window this guard was VACUOUS and a mutation proved it: the comment
  // above the fix says "`siteEdit` posted `layer: ''`", which satisfies a search
  // for `layer:` perfectly well once the code line is deleted. My own comment
  // defeated my own assertion — the same family as every anchor lesson in this
  // repo, arriving through prose instead of through word order.
  // THE LAST ONE IN THE BLOCK, not the first: the first is the 401 for an
  // unauthenticated caller, and anchoring there gave a 6,860-byte "response
  // literal" that was really the whole route — a window that would have passed
  // for any reason at all.
  const ret = body.lastIndexOf("return Response.json({");
  assert.ok(ret > 0, "the routing answer is no longer a Response.json literal");
  const obj = body.slice(ret, body.indexOf("\n      });", ret));
  // MEASURED ON THE CODE, NOT THE TEXT. The bound exists to catch a window that
  // has silently swallowed the whole route; comments are what this repo puts its
  // reasoning in, so counting them made a correct, well-documented field
  // addition fail a size check. Blanked rather than removed, per the house rule.
  const code = obj.replace(/^\s*\/\/.*$/gm, "");
  assert.ok(code.length > 60 && code.length < 1500,
    "the response literal window looks wrong: " + code.length + " of code in " + obj.length + " bytes");
  // The PROPERTY: every field the client reads off this answer is on it, as a
  // real property with a value rather than as a word in a sentence.
  for (const f of ["intent", "answer", "question", "layer", "page"]) {
    assert.match(obj.replace(/\/\/[^\n]*/g, ""), new RegExp("^\\s*" + f + ":", "m"),
      "the routing answer never carries `" + f + "`");
  }
  // And the client really does read them, or the other half is the dead one.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /d\.layer/, "the client never reads the layer");
  assert.match(chat, /siteEdit\(site, d,/, "the routing answer is not what drives the edit");
});

test("the data layer's gate is the display PRESET, not a spelling of it", async () => {
  // MEASURED LIVE: every data edit answered `no-data`. The gate read
  // `pair.read === "anyone"` — and "anyone" is a WRITE level; the read levels are
  // ["none","own","members","public"]. So it was false for every table on every
  // site, and the cheapest lane on the platform could never find a row.
  const { resolveAccess, ACCESS_PRESETS, READ_LEVELS, WRITE_LEVELS } = await import("../site-access.mjs");
  // The fact that broke it, pinned: the two vocabularies are DIFFERENT, and a
  // word from one is not a word from the other.
  assert.equal(READ_LEVELS.includes("anyone"), false, "`anyone` is not a read level");
  assert.equal(WRITE_LEVELS.includes("anyone"), true);
  assert.deepEqual(resolveAccess({ name: "s", access: "display" }), ACCESS_PRESETS.display,
    "a display table no longer resolves to the display preset");

  // The gate itself is asserted where it lives, one test above. What is added
  // here is the fact that made it wrong: the two vocabularies are different, and
  // the comparison must name the preset rather than spell a level.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const DISPLAY_PAIR = ACCESS_PRESETS\.display;/,
    "the gate is not derived from the preset, so it can drift from the vocabulary again");
  assert.equal(/pair\.read === "(?:anyone|public)"/.test(w), false,
    "the gate spells a level out again instead of naming the preset");
});

// ── a drained container is not the customer's broken code ────────────────────

test("a killed compile is retried once, and only a kill is", async () => {
  // MEASURED LIVE 2026-08-11, mid-deploy: a colour change answered `tsc was
  // killed by SIGTERM (no output)` eight seconds in, and the owner was told
  // "That look didn't compile, so your site is untouched" — their change blamed
  // for our rollout, with no retry. The build path has had `wasKilled` and one
  // more attempt since 2026-08-09; the SHARED SPINE that every edit layer and
  // the addon publish through had neither, so every deploy is a window in which
  // the cheapest change on the platform fails and reads as the customer's fault.
  const { wasKilled } = await import("../builder/publish-pages.mjs");
  assert.equal(wasKilled("tsc was killed by SIGTERM (no output)"), true);
  assert.equal(wasKilled("src/routes/index.tsx(56,6): error TS2304: Cannot find name 'SiteChrome'."), false,
    "a real type error must NOT be retried — it is deterministic and buys 40s of container time to fail identically");

  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("async function recompileAndPublish(");
  assert.ok(at > 0, "the shared spine was renamed");
  const body = w.slice(at, w.indexOf("async function siteOgImage(", at));
  assert.ok(body.length > 500, "the window no longer covers the spine");
  // THE REGION BETWEEN THE FIRST ATTEMPT AND THE VERDICT, because a mutation
  // proved the looser form vacuous: `if (false)` leaves BOTH `await compile()`
  // calls in the file, so "there are two of them" passes against a retry that
  // can never happen. What has to be true is that the second one is REACHED
  // ONLY through the kill test.
  const first = body.indexOf("let built = await compile();");
  const verdict = body.indexOf("if (!built || built.ok !== true || !built.files)");
  assert.ok(first > 0 && verdict > first, "the spine's compile/verdict shape moved");
  const retry = body.slice(first, verdict);
  assert.match(retry, /wasKilled\(/, "the retry is not gated on the failure being a kill");
  assert.match(retry, /await compile\(\)/, "there is no second attempt");
  // AND IT SAYS WHOSE FAULT IT WAS, or the retry is invisible and the message
  // still accuses the customer.
  assert.match(body, /ours: killed/, "the caller cannot tell our failure from theirs");
  assert.match(w, /function compileMsg\(/, "there is no single sentence for a failed compile");
  assert.equal((w.match(/function compileMsg\(/g) || []).length, 1);
  // AND THE HONEST SENTENCE IS IN IT. Asserting only that the function exists
  // passed against a version whose `pub.ours` branch returned the accusing text
  // — the function present, the apology gone.
  const cm = w.slice(w.indexOf("function compileMsg("), w.indexOf("async function recompileAndPublish("));
  assert.match(cm, /our build service was restarting/, "our own failure no longer says it was ours");
  assert.match(cm, /nothing was charged/, "…and does not say the customer keeps their credits");
  // Every lane that publishes through the spine must use it — five wordings that
  // can disagree is how four of them went on blaming the customer.
  const blaming = [...w.matchAll(/msg: "That [^"]*didn't compile[^"]*"/g)];
  assert.deepEqual(blaming.map((m) => m[0].slice(0, 50)), [],
    "a lane still reports a failed compile without asking whose fault it was");
});
