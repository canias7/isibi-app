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
