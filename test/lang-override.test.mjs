// #196 (audit A32-3), the owner's choice 2026-10-23: the module behind
// translated-page edits. Driven end to end in test/edit-path.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { langTargetOf, readOverrides, applyOverrides, flagStale, overridesFromEdits, addOverrides, staleNote, overrideNote, MAX_OVERRIDES_PER_LANG } from "../builder/lang-override.mjs";
import { resolveLangs } from "../builder/site-langs.mjs";

const LANGS = resolveLangs("en", ["es", "fr"]).langs;

test("a page under a language's prefix names that language and its primary page", () => {
  assert.deepEqual(langTargetOf("/es/book", LANGS), { tag: "es", prefix: "es", route: "/book" });
  assert.deepEqual(langTargetOf("/es", LANGS), { tag: "es", prefix: "es", route: "/" });
  assert.equal(langTargetOf("/book", LANGS), null);
  assert.equal(langTargetOf("/eshop", LANGS), null, "a two-letter start is not a language");
  assert.equal(langTargetOf("/de/book", LANGS), null, "a language the site does not have");
  assert.equal(langTargetOf("es/book", LANGS), null);
});

test("an override is laid over the cache when its English is on the site, and kept as stale when it is not", () => {
  const out = applyOverrides({ Book: "Reservar", Call: "Llamar" }, { Book: { said: "Reserva ya" }, Gone: { said: "Ya no" } }, ["Book", "Call"]);
  assert.deepEqual(out.merged, { Book: "Reserva ya", Call: "Llamar" });
  assert.deepEqual(out.stale, ["Gone"]);
});

test("the stale flag follows the source: set when it goes, cleared when it comes back", () => {
  const store = { es: { Book: { said: "Reserva ya", was: "Reservar", at: 1 } } };
  const a = flagStale(store, { es: ["Book"] });
  assert.equal(a.changed, true);
  assert.equal(a.next.es.Book.stale, true);
  const b = flagStale(a.next, {});
  assert.equal(b.changed, true);
  assert.equal(b.next.es.Book.stale, undefined);
  assert.equal(flagStale(b.next, {}).changed, false, "an unchanged flag is written again");
});

test("an edit on a translated page is read back to the English it came from", () => {
  const current = { "Book a chair": "Reserva una silla", Call: "Llamar" };
  const got = overridesFromEdits([{ from: "Reserva una silla", to: "Reserva tu cita" }, { from: "Nada", to: "x" }], current);
  assert.deepEqual(got.found, [{ from: "Book a chair", was: "Reserva una silla", said: "Reserva tu cita" }]);
  assert.deepEqual(got.missed, ["Nada"]);
});

test("the store keeps the newest overrides, bounded, and reads malformed entries as absent", () => {
  let s = {};
  for (let i = 0; i < MAX_OVERRIDES_PER_LANG + 5; i++) s = addOverrides(s, "es", [{ from: "s" + i, was: "w", said: "x" + i }], i);
  assert.equal(Object.keys(s.es).length, MAX_OVERRIDES_PER_LANG);
  assert.ok(!s.es.s0 && s.es["s" + (MAX_OVERRIDES_PER_LANG + 4)]);
  assert.deepEqual(readOverrides({ es: { a: { said: "" }, b: "x", c: { said: "ok", at: 3 } }, fr: [] }), { es: { c: { said: "ok", was: "", at: 3 } } });
});

test("the owner's notes say what happened, and nothing when nothing did", () => {
  assert.match(overrideNote("es", [{ said: "Reserva tu cita" }]), /Changed the es wording to “Reserva tu cita”\. It is kept as your own es wording/);
  assert.match(staleNote({ es: ["Book a chair"] }), /Your own es wording for “Book a chair” was kept, but the original wording it was made from has changed — check the es pages\./);
  assert.match(staleNote({ fr: ["a", "b"] }), /2 of your own fr wordings were kept/);
  assert.equal(staleNote({}), "");
  assert.equal(overrideNote("es", []), "");
});
