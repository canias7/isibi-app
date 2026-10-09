// A WAITING PHOTOGRAPH'S FRAME, FOUND AND FILLED THROUGH THE SYNTAX TREE
// (2026-10-09, parallel round 6). `markPending` and `fillPending` are driven
// with the real parser the add-on and the placement step use (`tweakParser`),
// over every valid TSX form that holds a token, and every form that must NOT
// be marked or filled because the place cannot be safely established.

import test from "node:test";
import assert from "node:assert/strict";
import { markPending, fillPending, hasPendingMark, pendingMark } from "../builder/site-images.mjs";
import { tweakParser } from "../builder/site-tweak.mjs";

const T = "@@IMG:a bench under the window@@";
const ID = "0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba98";
const URL = "/u/harbour-loaf/a1b2c3.jpg";
const page = (body, pre = "") => pre + "export default function P(){ return " + body + " }\n";
const mark = (src, parse, map = new Map([[T, ID]])) => markPending([{ path: "src/routes/gallery.tsx", source: src }], map, parse);

test("PF 1 — every equivalent form of a frame is marked and filled with that photograph: double, single, braced and template quoting, a site component's prop, a shared component's list value, a variable, a default", async () => {
  const parse = await tweakParser();
  assert.equal(typeof parse, "function", "the parser is not available to the suite");
  const forms = {
    double: page('<SafeImage src="' + T + '" alt="b" />'),
    single: page("<SafeImage src='" + T + "' alt=\"b\" />"),
    braced: page('<SafeImage src={"' + T + '"} alt="b" />'),
    template: page("<SafeImage src={`" + T + "`} alt=\"b\" />"),
    component: page('<Card image="' + T + '" title="x" />'),
    list: page("<>{TILES.map((t) => <SafeImage key={t.title} src={t.image} />)}</>", "const TILES = [{ image: '" + T + "', title: 'x' }];\n"),
    variable: page("<SafeImage src={HERO} />", 'const HERO = "' + T + '";\n'),
    fallback: page("<SafeImage src={props.src ?? \"" + T + "\"} />"),
  };
  for (const [name, src] of Object.entries(forms)) {
    const r = mark(src, parse);
    assert.deepEqual(r.unlocated, [], name + ": " + JSON.stringify(r.unlocated));
    assert.deepEqual(r.marked, [{ token: T, id: ID, file: "src/routes/gallery.tsx" }], name);
    const marked = r.pages[0].source;
    assert.ok(!marked.includes("@@IMG"), name + ": the token survived");
    assert.ok(hasPendingMark(marked, ID), name);
    assert.equal(parse(marked).file.parseDiagnostics.length, 0, name + ": the marked source does not parse: " + marked);
    const f = fillPending(marked, ID, URL, parse);
    assert.equal(f.filled, 1, name + ": " + marked);
    assert.equal(f.changed, 0, name);
    assert.ok(f.source.includes(JSON.stringify(URL)) && !hasPendingMark(f.source, ID), name + ": " + f.source);
    assert.equal(parse(f.source).file.parseDiagnostics.length, 0, name + ": the filled source does not parse");
    // EVERYTHING ELSE IN THE FILE IS AS IT WAS.
    // (a bare attribute value comes back braced; a value elsewhere stays where it was)
    const expected = src.replace(/=(["'])@@IMG:a bench under the window@@\1/, "={§}").replace(/(["'`])@@IMG:a bench under the window@@\1/, "§");
    assert.equal(f.source.replace(JSON.stringify(URL), "§"), expected, name);
  }
});

test("PF 2 — a token repeated in one file is marked in every copy and every copy is filled; a token in two files is marked in both", async () => {
  const parse = await tweakParser();
  const twice = page('<><SafeImage src="' + T + '" /><SafeImage src={\'' + T + "'} /></>");
  const r = mark(twice, parse);
  assert.equal(r.marked.length, 1);
  assert.equal(r.pages[0].source.split(pendingMark(ID)).length - 1, 2);
  assert.equal(fillPending(r.pages[0].source, ID, URL, parse).filled, 2);
  const two = markPending([{ path: "a.tsx", source: page('<SafeImage src="' + T + '" />') }, { name: "tiles", source: page('<SafeImage src="' + T + '" />') }], new Map([[T, ID]]), parse);
  assert.deepEqual(two.marked.map((m) => m.file), ["a.tsx", "src/routes/-parts/tiles.tsx"], "a shared component was not named by its real path");
});

test("PF 3 — WHERE THE PLACE CANNOT BE SAFELY ESTABLISHED, NOTHING IS MARKED AND WHY IS SAID: inside a longer string, in text, as a key, beside an occurrence the tree cannot read, in a file that does not parse, and with no parser at all", async () => {
  const parse = await tweakParser();
  const cases = {
    embedded: [page("<div style={{ backgroundImage: `url(" + T + ")` }} />"), "embedded"],
    prefixed: [page('<SafeImage src={"/x/" + "' + T + '"} />'), "not-a-value"],
    text: [page("<p>" + T + "</p>"), "embedded"],
    child: [page('<p>{"' + T + '"}</p>'), "text"],
    key: [page("<SafeImage src={M['" + T + "']} />", "const M = { '" + T + "': 1 };\n"), "not-a-value"],
    index: [page("<SafeImage src={M['" + T + "']} />", "const M = {};\n"), "not-a-value"],
    type: [page("<SafeImage src={HERO} />", "type K = '" + T + "';\nconst HERO = '/u/x.jpg' as string;\n"), "not-a-value"],
    comment: [page('<SafeImage src="' + T + '" />', "// " + T + "\n"), "embedded"],
    unparsed: [page('<SafeImage src="' + T + '" '), "unparsed"],
  };
  for (const [name, [src, why]] of Object.entries(cases)) {
    const r = mark(src, parse);
    assert.deepEqual(r.marked, [], name + ": a place was claimed");
    assert.equal(r.unlocated.length, 1, name);
    assert.equal(r.unlocated[0].why, why, name + ": " + JSON.stringify(r.unlocated));
    assert.equal(r.pages[0].source, src, name + ": the file was changed");
  }
  const none = mark(page('<SafeImage src="' + T + '" />'), null);
  assert.deepEqual(none.marked, []);
  assert.equal(none.unlocated[0].why, "no-parser");
});

test("PF 4 — only a purchase's own frames, and only frames still as the addition left them: another purchase's mark is untouched; a frame holding anything else is changed and kept; a mark inside a string is text; no mark is no frame; no parser fills nothing", async () => {
  const parse = await tweakParser();
  const both = markPending([{ path: "g.tsx", source: page('<><SafeImage src="' + T + '" /><SafeImage src="@@IMG:other@@" /></>') }], new Map([[T, ID], ["@@IMG:other@@", OTHER]]), parse).pages[0].source;
  const f = fillPending(both, ID, URL, parse);
  assert.equal(f.filled, 1);
  assert.ok(hasPendingMark(f.source, OTHER), "another purchase's frame was filled");
  const marked = mark(page('<SafeImage src="' + T + '" />'), parse).pages[0].source;
  const own = marked.replace('""', '"/u/harbour-loaf/mine.jpg"');
  const c = fillPending(own, ID, URL, parse);
  assert.deepEqual([c.filled, c.changed, c.source], [0, 1, own], "a changed frame was overwritten");
  const inString = page('<p title="' + pendingMark(ID) + '">x</p>');
  assert.deepEqual([fillPending(inString, ID, URL, parse).filled, fillPending(inString, ID, URL, parse).changed], [0, 1]);
  const gone = marked.replace(pendingMark(ID), "");
  assert.deepEqual([fillPending(gone, ID, URL, parse).filled, fillPending(gone, ID, URL, parse).changed], [0, 0]);
  const blind = fillPending(marked, ID, URL, null);
  assert.deepEqual([blind.filled, blind.unverified, blind.source], [0, true, marked]);
  assert.equal(fillPending(marked, "not-an-id", URL, parse).filled, 0);
  assert.equal(fillPending(marked, ID, "", parse).filled, 0);
});
