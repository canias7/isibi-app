// Batch 91 — schema introspection: GET /api/db/<slug>/schema describes tables, columns, rules,
// relations, and enabled features (API discovery), structure only.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 91");
const slug = "b91";
await c.ensure(slug);
await c.schema(slug, { tables: {
  accounts: { access: "admin", history: true, columns: [
    { name: "name", type: "text", required: true, max: 120 },
    { name: "industry", type: "text", enum: ["software", "retail"] },
    { name: "revenue", type: "integer", min: 0 },
  ] },
  contacts: { access: "user", teamRead: true, columns: [
    { name: "email", type: "text", format: "email", required: true },
    { name: "account_id", type: "integer", ref: "accounts" },
    { name: "meta", type: "json" },
  ] },
  signups: { access: "collect", columns: [{ name: "email", type: "text", format: "email" }] },
} });

const s = (await c.get(`/api/db/${slug}/schema`)).json;
t.ok(s.ok && Array.isArray(s.tables), "schema returns tables");
const byName = {}; for (const tb of s.tables) byName[tb.name] = tb;
t.ok(byName.accounts && byName.contacts && byName.signups, "all tables listed");

// access modes
t.eq(byName.accounts.access, "admin", "access mode reported");
t.eq(byName.signups.access, "collect", "collect table reported");

// columns + rules
const nameCol = byName.accounts.columns.find((c) => c.name === "name");
t.ok(nameCol.required === true && nameCol.maxLength === 120, "required + maxLength surfaced");
const indCol = byName.accounts.columns.find((c) => c.name === "industry");
t.eq(indCol.enum, ["software", "retail"], "enum surfaced");
const revCol = byName.accounts.columns.find((c) => c.name === "revenue");
t.ok(revCol.type === "number" && revCol.min === 0, "numeric type + min bound");
const emailCol = byName.contacts.columns.find((c) => c.name === "email");
t.eq(emailCol.format, "email", "format surfaced");
const metaCol = byName.contacts.columns.find((c) => c.name === "meta");
t.eq(metaCol.type, "json", "json type surfaced");

// relations
t.eq(byName.contacts.relations.account_id, "accounts", "relation (ref) surfaced");
const fkCol = byName.contacts.columns.find((c) => c.name === "account_id");
t.eq(fkCol.ref, "accounts", "ref also on the column");

// features
t.ok(byName.accounts.features.includes("history"), "history feature listed");
t.ok(byName.contacts.features.includes("teamRead"), "teamRead feature listed");

// managed platform columns are not exposed as app columns
t.ok(!byName.accounts.columns.some((c) => c.name === "id" || c.name === "created_at"), "id/created_at not listed as app columns");

// no row data leaks — structure only (no 'rows' key)
t.ok(s.rows === undefined, "no row data in the schema response");

// read-only
t.eq((await c.post(`/api/db/${slug}/schema`, {})).status, 405, "schema is read-only");
// unknown site
t.eq((await c.get(`/api/db/nope-nope/schema`)).status, 404, "unknown site → 404");

t.done(); h.restore();
