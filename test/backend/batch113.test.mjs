// Batch 113 — document flow: line totals, auto numbering, status, convert (quote→order→invoice)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 113");
const slug = "b113";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const create = (body, tok) => c.post(`/api/db/${slug}/documents`, body, { token: tok || ADMIN });
const getDoc = (id) => c.get(`/api/db/${slug}/documents/${id}`, { token: ADMIN });

// Create a quote with two lines; totals + tax computed server-side.
let q = await create({ type: "quote", party: "Acme Ltd", date: "2026-03-01", currency: "USD", lines: [
  { item: "SKU1", description: "Widget", qty: 2, unit_price: 100, tax_rate: 20 },   // sub 200, tax 40, total 240
  { item: "SKU2", description: "Gadget", qty: 1, unit_price: 50 },                    // sub 50,  tax 0,  total 50
] });
t.eq(q.status, 200, "create quote → 200");
t.eq(q.json.doc.subtotal, 250, "doc subtotal = 200 + 50");
t.eq(q.json.doc.tax, 40, "doc tax = 40 (20% of 200)");
t.eq(q.json.doc.total, 290, "doc total = 290");
t.eq(q.json.doc.lines[0].total, 240, "line 1 total incl. tax");
t.eq(q.json.doc.status, "draft", "defaults to draft");
t.ok(/^QUOTE-0*1$/.test(q.json.doc.number), "auto number QUOTE-00001");
const Q1 = q.json.doc.id;

// Numbers increment per type.
let q2 = await create({ type: "quote", lines: [{ qty: 1, unit_price: 10 }] });
t.ok(/QUOTE-0*2$/.test(q2.json.doc.number), "second quote → QUOTE-00002");
let inv0 = await create({ type: "invoice", lines: [{ qty: 1, unit_price: 10 }] });
t.ok(/INVOICE-0*1$/.test(inv0.json.doc.number), "invoice numbering is independent → INVOICE-00001");

// Validation.
t.eq((await create({ type: "quote", lines: [] })).status, 400, "no lines → 400");
t.eq((await create({ lines: [{ qty: 1, unit_price: 1 }] })).status, 400, "missing type → 400");
t.eq((await create({ type: "quote", lines: [{ qty: 0, unit_price: 1 }] })).status, 400, "zero qty line → 400");
t.eq((await create({ type: "quote", lines: [{ qty: 1, unit_price: 1, tax_rate: 200 }] })).status, 400, "tax_rate > 100 → 400");

// Authz.
t.eq((await create({ type: "quote", lines: [{ qty: 1, unit_price: 1 }] }, USER)).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/documents`, { type: "quote", lines: [] })).status, 401, "signed-out → 401");

// Convert quote → sales_order: copies lines, links from_id, gets its own number.
let conv = await c.post(`/api/db/${slug}/documents/${Q1}/convert`, { type: "sales_order", source_status: "accepted" }, { token: ADMIN });
t.eq(conv.status, 200, "convert → 200");
t.eq(conv.json.doc.from_id, Q1, "new doc links back to the quote");
t.eq(conv.json.doc.type, "sales_order", "new doc is a sales_order");
t.eq(conv.json.doc.total, 290, "totals copied forward");
t.eq(conv.json.doc.lines.length, 2, "both lines copied");
t.ok(/SALES_ORDER-0*1$/.test(conv.json.doc.number), "converted doc gets its own number");
const SO1 = conv.json.doc.id;
// source quote's status was updated by source_status
t.eq((await getDoc(Q1)).json.doc.status, "accepted", "source quote marked accepted");

// Chain again: order → invoice.
let inv = await c.post(`/api/db/${slug}/documents/${SO1}/convert`, { type: "invoice" }, { token: ADMIN });
t.eq(inv.json.doc.from_id, SO1, "invoice links to the order");
t.eq(inv.json.doc.total, 290, "invoice total matches");

// Status change endpoint.
t.eq((await c.post(`/api/db/${slug}/documents/${inv.json.doc.id}/status`, { status: "paid" }, { token: ADMIN })).json.status, "paid", "status set to paid");

// Draft lines are editable; recompute totals. (Q1 is now 'accepted', so use a fresh draft.)
let draft = await create({ type: "quote", lines: [{ qty: 1, unit_price: 5 }] });
let ed = await c.patch(`/api/db/${slug}/documents/${draft.json.doc.id}`, { lines: [{ qty: 3, unit_price: 100 }] }, { token: ADMIN });
t.eq(ed.status, 200, "patch draft lines → 200");
t.eq(ed.json.doc.total, 300, "totals recomputed after line edit");
// but a non-draft doc rejects line edits
t.eq((await c.patch(`/api/db/${slug}/documents/${inv.json.doc.id}`, { lines: [{ qty: 1, unit_price: 1 }] }, { token: ADMIN })).status, 409, "line edit on a non-draft doc → 409");
// header-only patch is allowed on a non-draft doc
t.eq((await c.patch(`/api/db/${slug}/documents/${inv.json.doc.id}`, { memo: "paid in full" }, { token: ADMIN })).status, 200, "header edit allowed on non-draft");

// List + filters.
let listSO = (await c.get(`/api/db/${slug}/documents?type=sales_order`, { token: ADMIN })).json;
t.ok(listSO.documents.length === 1 && listSO.documents[0].id === SO1, "list filters by type");
let listFrom = (await c.get(`/api/db/${slug}/documents?from_id=${SO1}`, { token: ADMIN })).json;
t.ok(listFrom.documents.some((d) => d.id === inv.json.doc.id), "list filters by from_id (find children)");

// Delete only in draft.
let dq = await create({ type: "quote", lines: [{ qty: 1, unit_price: 5 }] });
t.eq((await c.del(`/api/db/${slug}/documents/${dq.json.doc.id}`, { token: ADMIN })).status, 200, "draft delete → 200");
t.eq((await c.del(`/api/db/${slug}/documents/${inv.json.doc.id}`, { token: ADMIN })).status, 409, "non-draft delete → 409");

t.done(); h.restore();
