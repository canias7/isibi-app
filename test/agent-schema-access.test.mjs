// The agent's access words mean what they say in the database (2026-11-04).
// "public" and "owner" were stored as-is; the database's one reader of access
// (resolveAccess) knows neither and turns them into collect: visitors send,
// nobody reads — a "public" products table showed nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { mergeSchemaOps, schemaChange } from "../builder/agent-server-tools.mjs";
import { resolveAccess } from "../site-access.mjs";
import { normalizeSchema } from "../site-schema.mjs";

const make = (access) => {
  const c = schemaChange({ table: "items", create: { columns: [{ name: "name", type: "text" }], access } }, []);
  assert.ok(c.ok, JSON.stringify(c));
  const merged = mergeSchemaOps({ tables: [] }, [c.op]);
  // Through the store's own normaliser, as applySiteSchema stores it.
  const t = normalizeSchema(merged.spec).tables.find((x) => x.name === "items");
  assert.ok(t, "the observer is alive: the table survived the normaliser");
  return resolveAccess(t);
};

test("public: everyone reads, only the owner changes", () => assert.deepEqual(make("public"), { read: "public", write: "none" }));
test("owner: nobody on the site reads or writes", () => assert.deepEqual(make("owner"), { read: "none", write: "none" }));
test("collect, user, admin keep their meaning (control)", () => {
  assert.deepEqual(make("collect"), { read: "none", write: "anyone" });
  assert.deepEqual(make("user"), { read: "own", write: "own" });
  assert.deepEqual(make("admin"), { read: "members", write: "none" });
  assert.deepEqual(make(undefined), { read: "none", write: "none" }, "the default is the owner's own");
});
