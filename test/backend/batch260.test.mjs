// Batch 260 — GLOSSARY. An admin curates terms + definitions (with aliases); the app looks a term up (by
// term or alias) and lists/searches them. Covers upsert, lookup by term + alias, list, search (q), letter
// filter, category filter, aliases round-trip, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 260");
const slug = "b260";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const set = (tok, body) => c.post(`/api/db/${slug}/glossary`, body, tok === null ? {} : { token: tok });
const get = (term) => c.get(`/api/db/${slug}/glossary?term=${encodeURIComponent(term)}`).then((r) => r.json);
const list = (q) => c.get(`/api/db/${slug}/glossary${q || ""}`).then((r) => r.json);
const del = (tok, term) => c.del(`/api/db/${slug}/glossary?term=${encodeURIComponent(term)}`, { token: tok });

// --- Upsert ---
t.eq((await set(A, { term: "API", definition: "Application Programming Interface", aliases: ["endpoint"], category: "tech" })).json.term, "API", "admin adds a term");
await set(A, { term: "Webhook", definition: "An HTTP callback", category: "tech" });
await set(A, { term: "Latency", definition: "Delay before a response" });

// --- Lookup by term (case-insensitive) ---
let g = (await get("api")).entry;
t.eq(g.term, "API", "lookup by lowercased term works");
t.eq(g.definition, "Application Programming Interface", "…returns the definition");
t.ok(g.aliases.includes("endpoint"), "…aliases round-trip");

// --- Lookup by alias ---
t.eq((await get("endpoint")).entry.term, "API", "lookup by an alias resolves to the term");

// --- List + search ---
t.eq((await list()).terms.length, 3, "list has all 3 terms");
t.eq((await list("?q=callback")).terms.length, 1, "search by definition text → 1 (Webhook)");
t.eq((await list("?q=API")).terms.length, 1, "search by term → 1");

// --- Letter filter ---
t.eq((await list("?letter=a")).terms.length, 1, "letter=a → API");
t.eq((await list("?letter=w")).terms.length, 1, "letter=w → Webhook");

// --- Category filter ---
t.eq((await list("?category=tech")).terms.length, 2, "category=tech → 2");

// --- Update in place ---
await set(A, { term: "API", definition: "Application Programming Interface (updated)" });
t.eq((await get("api")).entry.definition, "Application Programming Interface (updated)", "re-posting updates the definition");

// --- Delete ---
t.eq((await del(A, "Latency")).json.deleted, true, "admin deletes a term");
t.eq((await c.get(`/api/db/${slug}/glossary?term=latency`)).status, 404, "…it's gone (404)");

// --- Validation + authz ---
t.eq((await set(A, { definition: "x" })).status, 400, "missing term → 400");
t.eq((await c.get(`/api/db/${slug}/glossary?term=nope`)).status, 404, "unknown term → 404");
t.eq((await c.del(`/api/db/${slug}/glossary`, { token: A })).status, 400, "delete with no ?term → 400");
t.eq((await set(B, { term: "x", definition: "y" })).status, 403, "a member can't add → 403");
t.eq((await del(B, "API")).status, 403, "a member can't delete → 403");
t.eq((await set(null, { term: "x", definition: "y" })).status, 401, "signed-out add → 401");

t.done(); h.restore();
