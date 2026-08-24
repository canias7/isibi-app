// Changing the words without paying for a rebuild.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractText, applyEdit, applyEdits , staleContactLinks } from "../builder/site-text.mjs";

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

// THE SPINE the text route now calls. These properties moved out of the route
// when `recompileAndPublish` was extracted — not because they stopped mattering,
// but because they became true for EVERY caller of it rather than for this one
// route. Windowed to the function so the guards follow the behaviour.
function spine() {
  const i = worker.indexOf("async function recompileAndPublish(env, {");
  assert.ok(i > 0, "the shared spine is gone");
  const end = worker.indexOf("\nasync function siteOgImage(", i);
  assert.ok(end > i, "could not find the end of the spine");
  return worker.slice(i, end);
}
function textRoute() {
  const i = worker.indexOf("if (tx) {");
  assert.ok(i > 0, "the text route is gone");
  const end = worker.indexOf("\n          if (vr) {", i);
  assert.ok(end > i, "could not find the end of the text route");
  return worker.slice(i, end);
}


test("editing the words asks no model anything", () => {
  // THE WHOLE POINT: a typo cost ~21 credits and a model call. The route must
  // reach the container and nothing else.
  const block = textRoute();
  assert.ok(!/anthropic|pagesRequest|generateSitePages|useCredits|collectCredits/i.test(block),
    "the text route must not call a model or spend credits");
  // It compiles through the shared spine now, so the container call is asserted
  // where it lives — and that the route actually reaches it.
  assert.match(block, /recompileAndPublish\(env, \{/, "the text route no longer compiles at all");
  assert.match(spine(), /getContainer\(env\.SITE_BUILD_CONTAINER\)/, "it must still compile");
  assert.ok(!/anthropic|pagesRequest|generateSitePages|useCredits|collectCredits/i.test(spine()),
    "the spine must not call a model or spend credits either");
  assert.match(block, /cost: 0/, "and it must say what it cost");
});

test("a failed compile leaves the live site alone", () => {
  const block = spine();
  const refuse = block.indexOf('error: "compile"');
  const publish = block.indexOf("writeSiteDistToR2");
  assert.ok(refuse > 0 && publish > refuse,
    "the compile refusal must come BEFORE anything is published");
});

test("the edited source is stored back, or the next edit starts from the old words", () => {
  const block = spine();
  assert.match(block, /saveSiteSource\(env, slug, pages\)/);
  assert.match(block, /archiveVersion\(/, "and it must be a version, so it can be rolled back like any build");
  // AFTER the publish, never before: the stored source is what the NEXT edit
  // reads, so writing it before the compile is proved hands that edit a version
  // which does not build.
  assert.ok(block.indexOf("saveSiteSource") > block.indexOf("writeSiteDistToR2"),
    "the source is stored before the publish is proved");
  // …and the route must hand it the edited pages, or the spine stores nothing.
  assert.match(textRoute(), /pages: ed\.pages/, "the edited pages never reach the spine");
});

test("the site's own look is carried through the recompile", () => {
  // A recompile that forgot the theme would silently re-style the whole site to
  // fix a typo — the exact failure the look anchor exists to prevent.
  const block = spine();
  // KEYED ON THE PAIR THAT SURVIVES. It was `site_look','site_tokens'` until
  // 2026-08-24, when the look became the stylesheet alone — so the token key
  // left the query and the guard went red about a spine that reads the look
  // perfectly well. What has to hold is that the spine reads BOTH halves of what
  // a site now wears: the look object and the stylesheet.
  assert.match(block, /'site_look','site_css'/, "it must read the stored look and the stylesheet");
  // READ, NOT PASSED IN. A recompile handed a look can be handed the WRONG one,
  // and the failure is silent — the site comes back re-themed by a caller that
  // meant nothing by it.
  assert.ok(!/function recompileAndPublish\(env, \{[^}]*\blook\b/.test(worker),
    "the spine takes a look from its caller, so a caller can re-theme a site by accident");
  // AND IT CARRIES THE STYLESHEET, which is now the whole look. This asserted
  // the palette, the token patch and the font pair until 2026-08-24; all three
  // came off the tool on 2026-08-23 and stopped being sent on 2026-08-24, so
  // what a typo fix has to preserve is one thing rather than four.
  assert.match(block, /css: cssRead\.usable \? cssRead\.css : undefined/,
    "the spine no longer carries the site's own stylesheet, so a typo fix would strip its whole design");
  // …AND THE FAMILIES IT NAMES ARE STILL FETCHED, or the sheet asks for a
  // typeface with no file behind it and the site ships in the fallback while
  // every layer reports success — the failure `site-fonts.mjs` is written around.
  assert.match(block, /fetchSiteFonts\(cssRead\.fonts \|\| \[\]\)/,
    "the spine no longer fetches the families the stylesheet names");
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
  const block = spine();
  assert.match(block, /if \(!built \|\| built\.ok !== true \|\| !built\.files\) \{/,
    "the compile result must be the condition, not merely mentioned");
  const refuse = block.indexOf("if (!built || built.ok !== true");
  const publish = block.indexOf("writeSiteDistToR2");
  assert.ok(refuse > 0 && publish > refuse, "nothing may publish before that check");
});

// ── A NUMBER CHANGED IN THE WORDS AND NOT IN THE CALL LINK ──────────────────

const telPages = [{
  path: "index.tsx",
  source: `<a href="tel:+441132000000">0113 200 0000</a>\n<SiteChrome action={{ label: "Call now", href: "tel:+441132000000" }} />`,
}];

test("a changed phone number leaves the tel: link stale, and it is named", () => {
  const out = staleContactLinks(telPages, [{ path: "index.tsx", from: "0113 200 0000", to: "0113 999 9999" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].href, "tel:+441132000000");
  assert.equal(out[0].page, "index.tsx");
});

test("MATCHED ON THE LAST 9 DIGITS, because the two encodings never match exactly", () => {
  // `+441132000000` against `01132000000` — the national form drops the leading
  // zero and the international one prefixes a country code, so a whole-string
  // digit compare finds nothing and the whole check would be dead.
  assert.equal(staleContactLinks(telPages, [{ path: "index.tsx", from: "+44 113 200 0000", to: "0113 999 9999" }]).length, 1);
});

test("RESPACING A NUMBER IS NOT A CHANGE — every link is still correct", () => {
  assert.deepEqual(staleContactLinks(telPages, [{ path: "index.tsx", from: "0113 200 0000", to: "0113 2000000" }]), []);
});

test("an ordinary wording change says nothing about phones", () => {
  assert.deepEqual(staleContactLinks(telPages, [{ path: "index.tsx", from: "Our team", to: "The team" }]), []);
  // A short number is not a phone number — a price, a year, a house number.
  assert.deepEqual(staleContactLinks(telPages, [{ path: "index.tsx", from: "£24.99", to: "£29.99" }]), []);
  assert.deepEqual(staleContactLinks(telPages, [{ path: "index.tsx", from: "Since 1998", to: "Since 1999" }]), []);
});

test("a tel: link for a DIFFERENT number is left out of the report", () => {
  const two = [{ path: "index.tsx", source: `<a href="tel:+441132000000">a</a><a href="tel:+441619999999">b</a>` }];
  const out = staleContactLinks(two, [{ path: "index.tsx", from: "0113 200 0000", to: "0113 999 9999" }]);
  assert.deepEqual(out.map((o) => o.href), ["tel:+441132000000"]);
});

test("one link is reported once even when several edits match it", () => {
  const out = staleContactLinks(telPages, [
    { path: "index.tsx", from: "0113 200 0000", to: "0113 999 9999" },
    { path: "index.tsx", from: "+44 113 200 0000", to: "0113 999 9999" },
  ]);
  assert.equal(out.length, 1);
});

test("the text lane carries it and the client says it", () => {
  // Computed and rendered by nothing is this repo's most-recorded failure.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // DERIVED, not pinned to today's spelling: whatever else the Worker imports
  // from this module, it must import the name it calls, or the text path is a
  // ReferenceError. This test caught exactly that — my first edit targeted an
  // import line that does not exist and the name was never brought in.
  const imp = w.match(/import \{([^}]*)\} from "\.\/builder\/site-text\.mjs"/);
  assert.ok(imp, "the Worker imports the text module");
  assert.ok(imp[1].split(",").map((x) => x.trim()).includes("staleContactLinks"),
    "the Worker must import the name it calls: " + imp[1]);
  assert.match(w, /const staleTel = staleContactLinks\(out\.pages, out\.edits\);/);
  assert.match(w, /staleTel: staleTel\.length \? staleTel\.slice\(0, 4\) : undefined,/);
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /Array\.isArray\(e\.staleTel\)/);
  // BOTH SENTENCES, AND KEYED ON THE SCHEME. With one sentence for both, a
  // stale email link is reported as a Call link that "still dials"
  // hello@cutlerrow.com — which reads as the builder having lost track of what
  // it changed. Found by mutation; the branch was covered by nothing.
  assert.match(c, /the Call link still dials/);
  assert.match(c, /the email link still sends to/);
  assert.match(c, /\/\^mailto:\/\.test\(stale\[0\]\.href/);
});

test("A SHORT NUMBER IS NOT A PHONE NUMBER, and the minimum is what stops a false alarm", () => {
  // Found by mutation: my other cases (`£24.99`, `Since 1998`) could not
  // discriminate the guard, because no `tel:` in the fixture is short enough for
  // their digits to match. This one can — a page with a short service number in
  // a link and a price in the copy is an ordinary shape, and without the minimum
  // changing the price reports the emergency link as stale.
  const pages = [{ path: "index.tsx", source: `<p>From £999</p><a href="tel:999">In an emergency</a>` }];
  assert.deepEqual(staleContactLinks(pages, [{ path: "index.tsx", from: "£999", to: "£1,099" }]), []);
  // And a real number on the same page is still caught.
  const both = [{ path: "index.tsx", source: `<a href="tel:+441132000000">x</a><a href="tel:999">y</a>` }];
  assert.deepEqual(
    staleContactLinks(both, [{ path: "index.tsx", from: "0113 200 0000", to: "0113 999 9999" }]).map((o) => o.href),
    ["tel:+441132000000"]);
});

// ── A STANDALONE EMAIL ADDRESS IS PROSE, NOT AN IDENTIFIER ──────────────────

test("a bare email address is offered — it was refused as an identifier", () => {
  // `hello@cutlerrow.com` has no whitespace and no capital, so the rule that
  // stops this lane renaming a column refused it too. Measured over the
  // exemplars: 21 standalone addresses, including a school laying out three
  // contact addresses as a list where not one was editable.
  const got = extractText(`<p>hello@cutlerrow.com</p><p>office@bolsterstone.sheffield.sch.uk</p>`);
  assert.deepEqual(got.map((t) => t.text),
    ["hello@cutlerrow.com", "office@bolsterstone.sheffield.sch.uk"]);
});

test("...and NOTHING ELSE that merely contains an @ comes with it", () => {
  const got = extractText(
    `<div className="@md:grid-cols-2 flex"><span>menu</span></div>` +
    `<p>created_at</p><p>react@18.2.0</p><p>@/components/ui/card</p><p>bookings</p>`,
  ).map((t) => t.text);
  // A column name, a bare label, a package spec, an import path and a Tailwind
  // container query all stay refused.
  for (const s of ["menu", "created_at", "react@18.2.0", "@/components/ui/card", "bookings"]) {
    assert.ok(!got.includes(s), s + " must not be offered");
  }
});

test("an address inside a sentence was always fine, and still is", () => {
  const got = extractText(`<p>Email us at hello@cutlerrow.com</p>`).map((t) => t.text);
  assert.deepEqual(got, ["Email us at hello@cutlerrow.com"]);
});

// ── AND THE mailto: LINK THAT GOES STALE WITH IT ────────────────────────────

const mailPages = [{ path: "index.tsx", source: `<a href="mailto:hello@cutlerrow.com">Email us</a>` }];

test("a changed email leaves the mailto: link stale, and it is named", () => {
  const out = staleContactLinks(mailPages, [
    { path: "index.tsx", from: "hello@cutlerrow.com", to: "bookings@cutlerrow.com" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].href, "mailto:hello@cutlerrow.com");
});

test("THE EMAIL HALF NEEDS NO HEURISTIC — the address is carried verbatim", () => {
  // Which is why a different address on the same page is not swept up, where the
  // phone half has to match on a suffix.
  const two = [{ path: "i.tsx", source: `<a href="mailto:hello@x.com">a</a><a href="mailto:sales@x.com">b</a>` }];
  const out = staleContactLinks(two, [{ path: "i.tsx", from: "hello@x.com", to: "hi@x.com" }]);
  assert.deepEqual(out.map((o) => o.href), ["mailto:hello@x.com"]);
});

test("case is ignored, and a query string on the link does not defeat the match", () => {
  const p = [{ path: "i.tsx", source: `<a href="mailto:Hello@Cutlerrow.com?subject=Hi">x</a>` }];
  assert.equal(staleContactLinks(p, [{ path: "i.tsx", from: "hello@cutlerrow.com", to: "b@c.com" }]).length, 1);
});

test("an ordinary wording change still says nothing about contact links", () => {
  assert.deepEqual(staleContactLinks(mailPages, [{ path: "index.tsx", from: "Our team", to: "The team" }]), []);
});
