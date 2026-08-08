// Changing the words without paying for a rebuild.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractText, applyEdit, applyEdits } from "../builder/site-text.mjs";

const PAGE = `import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useRows } from "@/lib/rows";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const drinks = useRows("drinks", { order: "name", dir: "asc" });
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Fold Coffee</h1>
      <p className="mt-3 text-muted-foreground">Filter, espresso and pastries, seven days a week.</p>
      <Link to="/menu" className="underline">See the menu</Link>
      <Button aria-label="Book">Book a table</Button>
      <img src="/logo.png" alt="Our shopfront" />
    </main>
  );
}
`;

// ── what counts as words ──────────────────────────────────────────────────────

test("the prose is offered", () => {
  const got = extractText(PAGE).map((t) => t.text);
  for (const want of ["Fold Coffee", "Filter, espresso and pastries, seven days a week.",
                      "See the menu", "Book a table", "Our shopfront"]) {
    assert.ok(got.includes(want), want + " was not offered — got " + JSON.stringify(got));
  }
});

test("code that LOOKS like prose is not offered", () => {
  // THE WHOLE DIFFICULTY. A page is TSX, and `className` is by far the biggest
  // source of English-looking text in it — replacing one silently restyles the
  // page rather than changing a word.
  const got = extractText(PAGE).map((t) => t.text);
  for (const never of ["mx-auto max-w-3xl px-6 py-16", "text-4xl font-semibold tracking-tight",
                       "@tanstack/react-router", "@/components/ui/button", "@/lib/rows",
                       "/menu", "/logo.png", "drinks", "name", "asc", "underline", "/"]) {
    assert.ok(!got.includes(never), never + " must never be offered as editable text");
  }
});

test("a column name and a route id are not words", () => {
  // Replacing one produces a page that compiles and reads a column that does
  // not exist — worse than a page that fails to build, because it ships.
  const got = extractText(`useRows("bookings", { order: "created_at", dir: "desc" })`).map((t) => t.text);
  assert.deepEqual(got, [], JSON.stringify(got));
});

test("the offer carries the exact place, not just the text", () => {
  // The same sentence can appear twice on a page. Without an offset, "replace
  // the first match" changes whichever the scan happened to reach first.
  const twice = `<p>Open today</p>\n<span>Open today</span>`;
  const got = extractText(twice).filter((t) => t.text === "Open today");
  assert.equal(got.length, 2);
  assert.notEqual(got[0].at, got[1].at);
  for (const g of got) assert.equal(twice.slice(g.at, g.at + g.text.length), "Open today");
});

test("every offset really points at the text it claims", () => {
  for (const t of extractText(PAGE)) {
    assert.equal(PAGE.slice(t.at, t.at + t.text.length), t.text,
      t.text + " is offered at an offset that does not hold it");
  }
});

test("nothing is offered for a page with no words", () => {
  assert.deepEqual(extractText(""), []);
  assert.deepEqual(extractText(null), []);
  assert.deepEqual(extractText("const x = 1;"), []);
});

// ── applying one ──────────────────────────────────────────────────────────────

test("an edit replaces exactly what was offered", () => {
  const t = extractText(PAGE).find((x) => x.text.startsWith("Filter,"));
  const r = applyEdit(PAGE, { at: t.at, from: t.text, to: "Filter and cake, six days a week." });
  assert.equal(r.ok, true, r.error);
  assert.match(r.source, /Filter and cake, six days a week\./);
  assert.ok(!r.source.includes("seven days a week"));
  // Everything else is byte-identical.
  assert.equal(r.source.length, PAGE.length - t.text.length + "Filter and cake, six days a week.".length);
});

test("a stale offset is REFUSED, not applied anyway", () => {
  // A revise in another tab, or the same edit applied twice, and the offset no
  // longer holds that string. Applying it regardless overwrites whatever is
  // there now, which on a page of TSX is how a site stops compiling.
  const t = extractText(PAGE).find((x) => x.text === "Fold Coffee");
  assert.equal(applyEdit(PAGE, { at: t.at, from: "Something Else", to: "x" }).ok, false);
  assert.equal(applyEdit(PAGE, { at: t.at + 5, from: t.text, to: "x" }).ok, false);
  assert.equal(applyEdit(PAGE, { at: -1, from: t.text, to: "x" }).ok, false);
  assert.equal(applyEdit(PAGE, { at: 999999, from: t.text, to: "x" }).ok, false);
});

test("nothing that could break out of the source is accepted", () => {
  // This lands in TSX, where a quote ends the string it sits in and a brace
  // opens an expression. There is no escape that survives both a string and a
  // JSX context, so the characters are refused outright.
  const t = extractText(PAGE).find((x) => x.text === "Fold Coffee");
  for (const evil of ['a" onClick={x} y="b', "a' + evil + '", "a{evil}b", "a</h1><script>x</script>",
                      "a`b", "a\\\\b", "a<b>c"]) {
    const r = applyEdit(PAGE, { at: t.at, from: t.text, to: evil });
    assert.equal(r.ok, false, JSON.stringify(evil) + " must be refused");
  }
});

test("an empty or absurd replacement is refused", () => {
  const t = extractText(PAGE).find((x) => x.text === "Fold Coffee");
  assert.equal(applyEdit(PAGE, { at: t.at, from: t.text, to: "" }).ok, false);
  assert.equal(applyEdit(PAGE, { at: t.at, from: t.text, to: "   " }).ok, false);
  assert.equal(applyEdit(PAGE, { at: t.at, from: t.text, to: "x".repeat(500) }).ok, false);
});

test("ordinary punctuation still works", () => {
  // The refusal list must not make the feature unusable: an apostrophe is in
  // half the sentences a shop would write.
  const t = extractText(PAGE).find((x) => x.text === "Fold Coffee");
  const r = applyEdit(PAGE, { at: t.at, from: t.text, to: "Fold Coffee — Dan’s place, est. 2019 (open!)" });
  assert.equal(r.ok, true, r.error);
});

// ── applying a batch ──────────────────────────────────────────────────────────

test("a batch is applied BACK TO FRONT, so later offsets stay valid", () => {
  // THE ENTIRE REASON THIS IS NOT A LOOP THE CALLER WRITES. Each edit changes
  // the length of the source, so applying them in order invalidates every
  // offset after the first — and the second edit then lands in the wrong place,
  // silently, in the middle of whatever moved into it.
  const items = extractText(PAGE);
  const a = items.find((x) => x.text === "Fold Coffee");
  const b = items.find((x) => x.text === "Book a table");
  const r = applyEdits([{ path: "index.tsx", source: PAGE }], [
    { path: "index.tsx", at: a.at, from: a.text, to: "Fold Coffee Roasters of Leeds" },
    { path: "index.tsx", at: b.at, from: b.text, to: "Reserve" },
  ]);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.applied, 2);
  assert.match(r.pages[0].source, /Fold Coffee Roasters of Leeds/);
  assert.match(r.pages[0].source, />Reserve</);
  assert.ok(!r.pages[0].source.includes("Book a table"));
});

test("in-order application is what the back-to-front rule prevents", () => {
  // The property stated as a fact rather than as a comment: apply the same two
  // edits smallest-offset-first by hand and the second lands wrong.
  const items = extractText(PAGE);
  const a = items.find((x) => x.text === "Fold Coffee");
  const b = items.find((x) => x.text === "Book a table");
  const first = applyEdit(PAGE, { at: a.at, from: a.text, to: "Fold Coffee Roasters of Leeds" });
  assert.equal(first.ok, true);
  assert.equal(applyEdit(first.source, { at: b.at, from: b.text, to: "Reserve" }).ok, false,
    "the second edit would have landed at a stale offset — which is what ordering avoids");
});

test("ONE bad edit fails the whole batch, changing nothing", () => {
  // A partial apply leaves the owner looking at a site where some of what they
  // typed took and some did not, with no way to tell which.
  const items = extractText(PAGE);
  const a = items.find((x) => x.text === "Fold Coffee");
  const r = applyEdits([{ path: "index.tsx", source: PAGE }], [
    { path: "index.tsx", at: a.at, from: a.text, to: "Fine" },
    { path: "index.tsx", at: a.at, from: "NOT THERE", to: "Bad" },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.applied, 0);
  assert.equal(r.pages[0].source, PAGE, "the source must be untouched");
});

test("an edit naming a page that does not exist is ignored, not applied elsewhere", () => {
  const r = applyEdits([{ path: "index.tsx", source: PAGE }], [{ path: "ghost.tsx", at: 0, from: "x", to: "y" }]);
  assert.equal(r.ok, false);
  assert.equal(r.pages[0].source, PAGE);
});

test("an empty batch is refused rather than republishing nothing", () => {
  for (const e of [[], null, undefined, "nonsense"]) {
    assert.equal(applyEdits([{ path: "index.tsx", source: PAGE }], e).ok, false, JSON.stringify(e));
  }
});

// ── the seam ──────────────────────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("editing the words asks no model anything", () => {
  // THE WHOLE POINT: a typo cost ~21 credits and a model call. The route must
  // reach the container and nothing else.
  const i = worker.indexOf("if (tx) {");
  assert.ok(i > 0, "the text route is gone");
  const block = worker.slice(i, worker.indexOf("\n          if (vr) {", i));
  assert.ok(!/anthropic|pagesRequest|generateSitePages|useCredits|collectCredits/i.test(block),
    "the text route must not call a model or spend credits");
  assert.match(block, /getContainer\(env\.SITE_BUILD_CONTAINER\)/, "it must still compile");
  assert.match(block, /cost: 0/, "and it must say what it cost");
});

test("a failed compile leaves the live site alone", () => {
  const i = worker.indexOf("if (tx) {");
  const block = worker.slice(i, worker.indexOf("\n          if (vr) {", i));
  const refuse = block.indexOf('error: "compile"');
  const publish = block.indexOf("writeSiteDistToR2");
  assert.ok(refuse > 0 && publish > refuse,
    "the compile refusal must come BEFORE anything is published");
});

test("the edited source is stored back, or the next edit starts from the old words", () => {
  const i = worker.indexOf("if (tx) {");
  const block = worker.slice(i, worker.indexOf("\n          if (vr) {", i));
  assert.match(block, /saveSiteSource\(env, ownerSlug, ed\.pages\)/);
  assert.match(block, /archiveVersion\(/, "and it must be a version, so it can be rolled back like any build");
});

test("the site's own look is carried through the recompile", () => {
  // A recompile that forgot the theme would silently re-style the whole site to
  // fix a typo — the exact failure the look anchor exists to prevent.
  const i = worker.indexOf("if (tx) {");
  const block = worker.slice(i, worker.indexOf("\n          if (vr) {", i));
  assert.match(block, /site_look','site_tokens'/, "it must read the stored look");
  assert.match(block, /theme: \(look && look\.theme\) \|\| null/);
  assert.match(block, /withContrast\(tokens\)/);
  assert.match(block, /resolvePair\(\(look && look\.fonts\) \|\| \{\}\)/);
});

test("a label on a code-ish attribute is not offered, but a real one is", () => {
  // The ONLY thing the attribute filter catches that the lowercase rule does
  // not: `aria-label="Book"` is capitalised and one word, so it reads as prose
  // — and editing it changes what a screen reader announces, not what anybody
  // can see. `alt` is the mirror case and must stay editable.
  // `title` is deliberately NOT filtered: a tooltip is text a visitor reads, so
  // an owner may well want to change it. The fixture used to carry one and the
  // assertion blamed the code for offering it.
  const src = `<button aria-label="Booking form">Go</button><img alt="Our shopfront" />`;
  const got = extractText(src).map((t) => t.text);
  assert.ok(!got.includes("Booking form"), "an aria-label must not be offered — got " + JSON.stringify(got));
  assert.ok(got.includes("Our shopfront"), "alt text must stay editable — got " + JSON.stringify(got));
  assert.ok(extractText(`<a title="Opening hours">x</a>`).some((t) => t.text === "Opening hours"),
    "a tooltip IS text a visitor reads");
});

test("a failed compile leaves the live site alone — the ordering IS the guarantee", () => {
  // Asserted on the CONDITION, not on the presence of the words anywhere: a
  // mutant replacing the refusal with `if (false)` left the message string in
  // place and survived, publishing a bundle that did not build.
  const i = worker.indexOf("if (tx) {");
  const block = worker.slice(i, worker.indexOf("\n          if (vr) {", i));
  assert.match(block, /if \(!built \|\| built\.ok !== true \|\| !built\.files\) \{/,
    "the compile result must be the condition, not merely mentioned");
  const refuse = block.indexOf("if (!built || built.ok !== true");
  const publish = block.indexOf("writeSiteDistToR2");
  assert.ok(refuse > 0 && publish > refuse, "nothing may publish before that check");
});
