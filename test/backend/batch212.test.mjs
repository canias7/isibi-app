// Batch 212 — QUOTE / ESTIMATE BUILDER. An admin builds a quote of line items (qty × unit), the server
// totals it, and the customer views/accepts it via a share token. Covers create+total, get+lines, public
// token view, accept/decline (once, expiry), re-total on edit, status filter, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 212");
const slug = "b212";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const create = (tok, body) => c.post(`/api/db/${slug}/quotes`, body, tok === null ? {} : { token: tok });
const getQ = (tok, id) => c.get(`/api/db/${slug}/quotes/${id}`, { token: tok }).then((r) => r.json);
const listQ = (tok, q) => c.get(`/api/db/${slug}/quotes${q || ""}`, { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/quotes/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/quotes/${id}`, { token: tok });
const view = (token) => c.get(`/api/db/${slug}/quotes/view/${token}`).then((r) => r.json);
const respond = (token, accept) => c.post(`/api/db/${slug}/quotes/view/${token}/respond`, { accept });

// --- Create with lines (server totals) ---
let r = (await create(A, { customer: "Acme", currency: "USD", lines: [{ description: "Design", qty: 2, unit: 100 }, { description: "Hosting", qty: 1, unit: 50.5 }] })).json;
t.eq(r.total, 250.5, "total = 2*100 + 1*50.50 = 250.50");
t.ok(r.token && r.token.length >= 12, "a share token is issued");
const id = r.id, token = r.token;

// --- Get + lines (admin) ---
let g = await getQ(A, id);
t.eq(g.quote.status, "draft", "new quote is a draft");
t.eq(g.lines.length, 2, "two line items");
t.eq(g.lines[0].line_c, 20000, "…line total in cents (2*100.00 = 20000c)");

// --- Public token view ---
let pv = await view(token);
t.eq(pv.quote.customer, "Acme", "public view by token shows the quote");
t.eq(pv.lines.length, 2, "…with its lines");
t.eq(pv.quote.author_id, undefined, "…but not internal fields like author_id");

// --- Customer accepts (once) ---
t.eq((await respond(token, true)).json.status, "accepted", "customer accepts via token");
t.eq((await respond(token, false)).status, 409, "…responding again → 409 (already accepted)");
t.eq((await view(token)).quote.status, "accepted", "…status reflects the acceptance");

// --- Re-total on edit ---
r = (await create(A, { customer: "Beta", lines: [{ description: "Item", qty: 3, unit: 10 }] })).json;
t.eq(r.total, 30, "second quote total 30");
t.eq((await patch(A, r.id, { lines: [{ description: "Item", qty: 5, unit: 10 }, { description: "Extra", qty: 1, unit: 5 }] })).json.total, 55, "editing lines re-totals to 55");
t.eq((await getQ(A, r.id)).lines.length, 2, "…lines replaced (now 2)");

// --- Status set + filter ---
await patch(A, r.id, { status: "sent" });
t.eq((await listQ(A, "?status=sent")).quotes.length, 1, "filter by status=sent");
t.eq((await listQ(A, "?status=accepted")).quotes.length, 1, "filter by status=accepted");

// --- Decline path on a fresh quote ---
const r3 = (await create(A, { lines: [{ description: "X", qty: 1, unit: 9 }] })).json;
t.eq((await respond(r3.token, false)).json.status, "declined", "customer can decline");

// --- Expired quote can't be responded to ---
const past = new Date(Date.now() - 3600 * 1000).toISOString();
const r4 = (await create(A, { expires: past, lines: [{ description: "Y", qty: 1, unit: 1 }] })).json;
t.eq((await respond(r4.token, true)).status, 409, "an expired quote → 409 on respond");

// --- Delete ---
t.eq((await del(A, id)).json.deleted, true, "admin deletes a quote");
t.eq((await view(token)).ok ?? false, false, "…its token no longer resolves");

// --- Validation + authz ---
t.eq((await create(A, { lines: [] })).status, 400, "empty lines → 400");
t.eq((await create(A, { lines: [{ qty: 1, unit: 5 }] })).status, 400, "a line with no description → 400");
t.eq((await create(A, { lines: [{ description: "x", unit: "abc" }] })).status, 400, "a non-numeric unit → 400");
t.eq((await create(B, { lines: [{ description: "x", unit: 5 }] })).status, 403, "a member can't create → 403");
t.eq((await c.get(`/api/db/${slug}/quotes`, { token: B })).status, 403, "a member can't list → 403");
t.eq((await respond("badtoken00", true)).status, 404, "an unknown token → 404");
t.eq((await create(null, { lines: [{ description: "x", unit: 5 }] })).status, 401, "signed-out create → 401");

t.done(); h.restore();
