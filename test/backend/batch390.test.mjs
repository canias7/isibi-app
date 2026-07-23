// Batch 390 — PLURALIZE. Stateless English inflector: singular + plural of a word, count-aware inflection and a
// "N words" phrase. Covers suffix rules, irregulars, uncountables, singularize, count formatting, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 390");
const slug = "b390";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const pl = (word, count) => c.post(`/api/db/${slug}/pluralize`, count === undefined ? { word } : { word, count }).then((r) => r.json);

// --- Suffix rules ---
t.eq((await pl("cat")).plural, "cats", "regular +s");
t.eq((await pl("box")).plural, "boxes", "x → es");
t.eq((await pl("baby")).plural, "babies", "consonant+y → ies");
t.eq((await pl("day")).plural, "days", "vowel+y → +s");
t.eq((await pl("knife")).plural, "knives", "fe → ves");
t.eq((await pl("church")).plural, "churches", "ch → es");

// --- Irregulars ---
t.eq((await pl("person")).plural, "people", "person → people");
t.eq((await pl("child")).plural, "children", "child → children");
t.eq((await pl("mouse")).plural, "mice", "mouse → mice");

// --- Uncountable ---
t.eq((await pl("sheep")).plural, "sheep", "sheep is unchanged");

// --- Singularize (given a plural) ---
let r = await pl("boxes");
t.eq(r.singular, "box", "boxes → box");
t.eq(r.plural, "boxes", "…and normalizes plural back");
t.eq((await pl("people")).singular, "person", "people → person");

// --- Count-aware ---
r = await pl("item", 1);
t.eq(r.inflected, "item", "count 1 → singular");
t.eq(r.formatted, "1 item", "…formatted");
r = await pl("item", 5);
t.eq(r.inflected, "items", "count 5 → plural");
t.eq(r.formatted, "5 items", "…formatted");
t.eq((await pl("item", 0)).inflected, "items", "count 0 → plural");

// --- Case preserved ---
t.eq((await pl("Person")).plural, "People", "capitalization preserved");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/pluralize`, {})).status, 400, "no word → 400");
t.eq((await c.post(`/api/db/${slug}/pluralize`, { word: "x", count: "abc" })).status, 400, "non-numeric count → 400");

t.done(); h.restore();
