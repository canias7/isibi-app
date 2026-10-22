// TURNING A RULE OFF REACHES THE STORED SCHEMA (2026-10-22, audit A29-1).
//
// The rules step said "cleared sms" by writing `sms: null`, and the engine
// reads null as "not mentioned": both the fill before the DDL and the late
// `_meta` merge copied the stored text message, email and webhooks back, so
// the reply said "now off" and every booking kept sending. A removal is now
// said (`cleared: [...]`) and honoured by normalizeSchema, the fill, the
// merge and the held draft's merge; the marker itself is never stored.
// Everything runs against a stand-in database at the network.
import test from "node:test";
import assert from "node:assert/strict";
import { applySiteSchema, normalizeSchema, fillFromStored } from "../site-schema.mjs";
import { mergeRules } from "../builder/site-rules.mjs";
import { mergeSpec, combineHeld } from "../site-draft.mjs";

async function apply(spec, prior) {
  let stored = null, n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    let q = "", params = [];
    try { const b = JSON.parse(String((init && init.body) || "{}")); q = String(b.query || ""); params = Array.isArray(b.params) ? b.params : []; } catch { /* not ours */ }
    n++;
    const rows = (r, fields) => new Response(JSON.stringify({ command: "SELECT", rowCount: r.length, rows: r, fields: fields.map((name) => ({ name, dataTypeID: 25 })) }), { status: 200, headers: { "content-type": "application/json" } });
    if (/^SELECT v FROM _meta WHERE k\s*=\s*'schema'/i.test(q.trim())) return rows([[JSON.stringify(prior)]], ["v"]);
    if (/^INSERT INTO _meta \(k,v\) VALUES \('schema'/i.test(q.trim())) stored = JSON.parse(String(params[0]));
    return rows([], []);
  };
  try { await applySiteSchema("postgresql://u:p@ep-clr.eu-central-1.aws.neon.tech/db?sslmode=require", spec); }
  finally { globalThis.fetch = real; }
  assert.ok(n > 10, "the engine sent almost nothing — the fetch seam moved");
  assert.ok(stored, "the stored declaration was not written");
  return stored;
}
const CONFIRM = { to: "email", subject: "Booked", body: "See you" };
const SMS = { to: "phone", body: "Booked" };
const PRIOR = { tables: [{ name: "bookings", access: "collect", columns: ["who", "email", "phone", "slot"], confirm: CONFIRM, sms: SMS, webhooks: ["created"] }] };

test("CLR 1 — a cleared text message, email and webhooks stay off through the real engine, and the marker is not stored", async () => {
  const { spec, applied } = mergeRules({ tables: PRIOR.tables }, [{ table: "bookings", clear: ["sms", "confirm", "webhooks"] }]);
  assert.deepEqual(applied[0].fields.slice().sort(), ["cleared confirm", "cleared sms", "cleared webhooks"]);
  const t = (await apply(normalizeSchema(spec), PRIOR)).tables.find((x) => x.name === "bookings");
  assert.equal(t.sms ?? null, null, "the text message came back from the stored schema");
  assert.equal(t.confirm ?? null, null, "the confirmation came back from the stored schema");
  assert.equal(t.webhooks ?? null, null, "the webhooks came back from the stored schema");
  assert.ok(!Object.hasOwn(t, "cleared"), "the marker was stored");
});

test("CLR 2 — control: a re-declaration that says nothing still keeps the stored rules; clearing one keeps the others", async () => {
  const silent = (await apply(normalizeSchema({ tables: [{ name: "bookings", access: "collect", columns: ["who"] }] }), PRIOR)).tables[0];
  assert.deepEqual(silent.sms, SMS); assert.deepEqual(silent.confirm, CONFIRM); assert.deepEqual(silent.webhooks, ["created"]);
  const { spec } = mergeRules({ tables: PRIOR.tables }, [{ table: "bookings", clear: ["sms"] }]);
  const one = (await apply(normalizeSchema(spec), PRIOR)).tables[0];
  assert.equal(one.sms ?? null, null);
  assert.deepEqual(one.confirm, CONFIRM, "clearing the text message took the email too");
});

test("CLR 3 — the fill honours the marker; a field given a value again is not cleared", () => {
  const t = fillFromStored({ name: "bookings", sms: null, confirm: null, cleared: ["sms"] }, PRIOR.tables[0]);
  assert.equal(t.sms, null); assert.deepEqual(t.confirm, CONFIRM);
  const u = fillFromStored({ name: "bookings", sms: { to: "phone", body: "new" }, cleared: ["sms"] }, PRIOR.tables[0]);
  assert.deepEqual(u.sms, { to: "phone", body: "new" });
  const { spec } = mergeRules({ tables: [{ ...PRIOR.tables[0], sms: null, cleared: ["sms"] }] }, [{ table: "bookings", sms: SMS }]);
  assert.ok(!spec.tables[0].cleared.includes("sms"), "setting it again left it marked cleared");
});

test("CLR 4 — the held draft: a later held re-declaration of the table keeps the removal, so Publish applies it", async () => {
  const { spec: held1 } = mergeRules({ tables: PRIOR.tables }, [{ table: "bookings", clear: ["sms"] }]);
  const held2 = { tables: [{ name: "bookings", access: "collect", columns: ["who", "email", "phone", "slot", "note"] }] };
  const plan = combineHeld(PRIOR, [{ kind: "schema", spec: held1 }, { kind: "schema", spec: held2 }]).spec;
  const pt = plan.tables.find((x) => x.name === "bookings");
  assert.deepEqual(pt.cleared, ["sms"], "the later held op dropped the removal");
  const t = (await apply(normalizeSchema(plan), PRIOR)).tables[0];
  assert.equal(t.sms ?? null, null, "Publish brought the text message back");
  assert.deepEqual(t.confirm, CONFIRM);
  const again = mergeSpec(held1, { tables: [{ name: "bookings", sms: SMS }] }).tables[0];
  assert.deepEqual(again.sms, SMS); assert.ok(!(again.cleared || []).includes("sms"));
});
