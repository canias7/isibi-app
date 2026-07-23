// Batch 302 — TEXT DIFF. Stateless line-level LCS diff of two texts → {changes:[{type,line}], added, removed}.
// Covers identical, pure add, pure delete, a mixed edit, and validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 302");
const slug = "b302";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const diff = (a, b) => c.post(`/api/db/${slug}/diff`, { a, b }).then((r) => r.json);

// --- Identical ---
let r = await diff("one\ntwo\nthree", "one\ntwo\nthree");
t.eq(r.added, 0, "identical → 0 added");
t.eq(r.removed, 0, "…0 removed");
t.ok(r.changes.every((c) => c.type === "eq"), "…all lines equal");

// --- Pure addition ---
r = await diff("a\nb", "a\nb\nc");
t.eq(r.added, 1, "one line added");
t.eq(r.removed, 0, "nothing removed");
t.ok(r.changes.find((c) => c.type === "add" && c.line === "c"), "…the new line is flagged add");

// --- Pure deletion ---
r = await diff("a\nb\nc", "a\nc");
t.eq(r.removed, 1, "one line removed");
t.eq(r.added, 0, "nothing added");
t.ok(r.changes.find((c) => c.type === "del" && c.line === "b"), "…the removed line is flagged del");

// --- Mixed edit ---
r = await diff("hello\nworld\nfoo", "hello\nthere\nfoo");
t.eq(r.added, 1, "a changed line counts as one add");
t.eq(r.removed, 1, "…and one del");
t.ok(r.changes.find((c) => c.type === "eq" && c.line === "hello"), "unchanged context preserved");
t.ok(r.changes.find((c) => c.type === "eq" && c.line === "foo"), "…on both sides");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/diff`, { a: "x" })).status, 400, "a missing b → 400");
t.eq((await c.post(`/api/db/${slug}/diff`, { a: 1, b: 2 })).status, 400, "non-string inputs → 400");

t.done(); h.restore();
