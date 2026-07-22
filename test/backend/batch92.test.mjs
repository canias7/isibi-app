// Batch 92 — field masking: partial-reveal a sensitive column to non-privileged readers
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 92");
const slug = "b92";
await c.ensure(slug);
await c.schema(slug, { tables: {
  cards: { access: "admin", writeRoles: ["clerk"],
    mask: { number: { roles: ["admin"], keep: 4 }, cvv: { roles: ["admin"], keep: 0 } },
    columns: [{ name: "holder", type: "text" }, { name: "number", type: "text" }, { name: "cvv", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const CLERK = (await c.signup(slug, "clerk@x.dev", "Str0ng-pass-9")).json.token; // id2
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 2, action: "set_role", role: "clerk" } });
await c.post(`/api/db/${slug}/rows/cards`, { holder: "Jane", number: "4242424242424242", cvv: "123" }, { token: ADMIN });

// admin sees full values
let asAdmin = (await c.get(`/api/db/${slug}/rows/cards/1`, { token: ADMIN })).json.row;
t.eq(asAdmin.number, "4242424242424242", "admin sees full card number");
t.eq(asAdmin.cvv, "123", "admin sees full cvv");

// a clerk (role not in mask.roles) sees masked — last 4 kept
let asClerk = (await c.get(`/api/db/${slug}/rows/cards/1`, { token: CLERK })).json.row;
t.eq(asClerk.number, "•".repeat(12) + "4242", "clerk sees masked number (last 4)");
t.eq(asClerk.cvv, "•".repeat(3), "clerk sees fully-masked cvv (keep 0)");
t.eq(asClerk.holder, "Jane", "unmasked field unaffected");

// list reads mask too
let list = (await c.get(`/api/db/${slug}/rows/cards`, { token: CLERK })).json.rows;
t.eq(list[0].number, "•".repeat(12) + "4242", "list read also masks");

// anonymous (public) is masked as well
let anon = (await c.get(`/api/db/${slug}/rows/cards/1`)).json.row;
t.eq(anon.number, "•".repeat(12) + "4242", "public reader masked");

// null/empty values aren't masked into dots
await c.post(`/api/db/${slug}/rows/cards`, { holder: "Empty" }, { token: ADMIN });
let empt = (await c.get(`/api/db/${slug}/rows/cards/2`, { token: CLERK })).json.row;
t.ok(empt.number == null || empt.number === "", "null number stays null (not masked dots)");

t.done(); h.restore();
