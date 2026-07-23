// Batch 331 — EXCERPT. Stateless smart truncate: strip HTML, collapse whitespace, cut to N words or N chars on
// a word boundary with an ellipsis. Covers short passthrough, char/word truncation, HTML strip, suffix, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 331");
const slug = "b331";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const ex = (body) => c.post(`/api/db/${slug}/excerpt`, body).then((r) => r.json);

// --- Short text is returned untouched ---
let r = await ex({ text: "Hello world", chars: 100 });
t.eq(r.excerpt, "Hello world", "short text passes through");
t.eq(r.truncated, false, "…not truncated");

// --- Char truncation on a word boundary + ellipsis ---
r = await ex({ text: "The quick brown fox jumps over the lazy dog", chars: 20 });
t.eq(r.truncated, true, "long text is truncated");
t.ok(r.excerpt.endsWith("…"), "…ends with an ellipsis");
t.ok(!/ $/.test(r.excerpt.replace(/…$/, "")), "…no trailing space before the ellipsis");
t.ok(r.excerpt.length <= 22, "…roughly within the char budget");

// --- Word truncation ---
r = await ex({ text: "one two three four five six", words: 3 });
t.eq(r.excerpt, "one two three…", "cuts to N words");
t.eq((await ex({ text: "one two", words: 5 })).truncated, false, "fewer words than the limit → untruncated");

// --- HTML strip ---
r = await ex({ text: "<p>Hello <b>bold</b> world</p>", chars: 100, strip_html: true });
t.eq(r.excerpt, "Hello bold world", "strips HTML tags and collapses spaces");

// --- Custom suffix ---
r = await ex({ text: "aaaa bbbb cccc dddd eeee", chars: 9, suffix: " [more]" });
t.ok(r.excerpt.endsWith(" [more]"), "honors a custom suffix");

// --- Whitespace collapse ---
t.eq((await ex({ text: "  lots   of\n\n  space  ", chars: 100 })).excerpt, "lots of space", "collapses whitespace");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/excerpt`, { text: "   " })).status, 400, "blank text → 400");

t.done(); h.restore();
