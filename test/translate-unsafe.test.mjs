// AUDIT A32-1 (2026-10-22): one apostrophe, quote, backslash or over-long
// translation lost the whole language. `translatePages` wrote every string
// through `applyEdits`, which refuses a whole batch for one edit carrying
// " ' ` { } < > \ or over 400 characters, and handed back the primary pages,
// while `nextCache` stored the refused translation so it was never asked again.
//
// These cases drive the real module. Each fails on the code before the fix.
import test from "node:test";
import assert from "node:assert/strict";
import { collectStrings, translatePages, nextCache, missingFrom, usableTranslation, langNote } from "../builder/site-translate.mjs";

const PAGES = [
  { path: "index.tsx", source: `export const Route = createFileRoute("/")({ component: P });\nconst C = { action: { label: "Book now", href: "/book" } };\nfunction P(){ return <main><h1>Meet the team</h1><p>Fresh bread every morning</p></main>; }` },
  { path: "book.tsx", source: `export const Route = createFileRoute("/book")({ component: P });\nfunction P(){ return <main><h1>Book a table</h1><p>Open from nine</p></main>; }` },
];
const ROUTES = ["/", "/book"];
const { strings } = collectStrings(PAGES);
const BASE = { "Book now": "Réserver", "Meet the team": "Notre équipe", "Fresh bread every morning": "Du pain frais chaque matin", "Book a table": "Réserver une table", "Open from nine": "Ouvert dès neuf heures" };
const run = (over) => translatePages(PAGES, "fr", strings, strings.map((s) => (s in over ? over[s] : BASE[s])), { routes: ROUTES });
const all = (out) => out.pages.map((p) => p.source).join("\n");

test("the fixture offers every string these cases translate", () => {
  for (const s of Object.keys(BASE)) assert.ok(strings.includes(s), s + " is not offered");
});

test("an apostrophe in one translation no longer loses the language: it is written typographically", () => {
  const out = run({ "Meet the team": "L'équipe" });
  assert.equal(out.failed, false, "the apostrophe refused something: " + out.error);
  const src = all(out);
  assert.match(src, /<h1>L’équipe<\/h1>/);
  for (const s of ["Du pain frais chaque matin", "Réserver une table", "Ouvert dès neuf heures", 'label: "Réserver"']) assert.ok(src.includes(s), s + " was not written");
  assert.ok(!src.includes("Meet the team") && !src.includes("Open from nine"), "English left on the French pages");
});

test("a double quote inside a quoted string never breaks the page", () => {
  const out = run({ "Book now": 'Réservez "maintenant"' });
  assert.equal(out.failed, false);
  assert.match(all(out), /label: "Réservez “maintenant”"/);
});

test("a backslash refuses only its own string, which keeps the original wording", () => {
  const out = run({ "Open from nine": "Ouvert \\ dès neuf" });
  assert.deepEqual(out.refused, ["Open from nine"]);
  const src = all(out);
  assert.ok(src.includes("<p>Open from nine</p>"), "the refused string did not keep its original wording");
  assert.ok(src.includes("Notre équipe") && src.includes("Réserver une table"), "the rest of the language was lost");
  assert.ok(!src.includes("\\ dès"));
});

test("an over-long translation refuses only its own string", () => {
  const long = "Du pain ".repeat(60);
  assert.ok(long.length > 400);
  const out = run({ "Fresh bread every morning": long });
  assert.deepEqual(out.refused, ["Fresh bread every morning"]);
  const src = all(out);
  assert.ok(src.includes("<p>Fresh bread every morning</p>") && src.includes("Notre équipe"));
});

test("a translation that failed validation is never cached, so the next publish asks again", () => {
  const fresh = { ...BASE, "Open from nine": "a \\ b", "Fresh bread every morning": "x ".repeat(250), "Meet the team": "L'équipe", "Book a table": "{oops}" };
  const cache = nextCache({}, strings, fresh);
  assert.deepEqual(missingFrom(cache, strings).sort(), ["Book a table", "Fresh bread every morning", "Open from nine"]);
  assert.equal(cache["Meet the team"], "L’équipe", "the usable form is the one stored");
  assert.equal(cache["Book now"], "Réserver");
});

test("a cache poisoned before the fix heals: a refused entry is dropped and an apostrophe is rewritten", () => {
  const poisoned = { ...BASE, "Meet the team": "L'équipe", "Book a table": "a <b> c" };
  const healed = nextCache(poisoned, strings, null);
  assert.equal(healed["Meet the team"], "L’équipe");
  assert.deepEqual(missingFrom(healed, strings), ["Book a table"]);
  const out = run({ "Meet the team": poisoned["Meet the team"] });
  assert.equal(out.failed, false);
});

test("usableTranslation keeps an unchanged answer and refuses what cannot be placed", () => {
  assert.equal(usableTranslation("Maria's Kitchen", "Maria's Kitchen"), "Maria's Kitchen");
  assert.equal(usableTranslation("a", "x\ny"), "x y");
  for (const bad of ["a`b", "a{b", "a}b", "a<b", "a>b", "a\\b", "   ", 7, null]) assert.equal(usableTranslation("a", bad), null, JSON.stringify(bad));
});

test("the customer is told when a language could not be made, from its outcome", () => {
  assert.equal(langNote([{ tag: "fr", ok: true, missing: 3 }, { tag: "es", ok: true, cached: true, missing: 0 }]), "");
  assert.match(langNote([{ tag: "fr", ok: false, why: "unusable" }]), /fr pages could not be translated this time/);
  assert.match(langNote([{ tag: "es", ok: true, kept: 2 }]), /^2 phrases on the es pages/);
});
