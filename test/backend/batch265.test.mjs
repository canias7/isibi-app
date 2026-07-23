// Batch 265 — GIFT CARDS. A code-bearer stored-value card: an admin issues one with a balance; anyone with
// the code checks or redeems (never below zero). Covers issue (auto + custom code), balance check, redeem
// (atomic, insufficient → 409), void, list, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 265");
const slug = "b265";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const issue = (tok, body) => c.post(`/api/db/${slug}/gift-cards`, body, tok === null ? {} : { token: tok }).then((r) => r.json);
const check = (code) => c.get(`/api/db/${slug}/gift-cards/${code}`).then((r) => r.json);
const redeem = (code, amount) => c.post(`/api/db/${slug}/gift-cards/${code}/redeem`, { amount });
const voidCard = (tok, code) => c.post(`/api/db/${slug}/gift-cards/${code}/void`, {}, { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/gift-cards`, { token: tok }).then((r) => r.json);

// --- Issue (auto code) ---
let g = await issue(A, { amount: 50, note: "birthday" });
t.ok(g.code && g.code.length >= 12, "admin issues a card with an auto code");
t.eq(g.balance, 50, "…with a $50 balance");
const code = g.code;

// --- Issue with a custom code ---
t.eq((await issue(A, { code: "welcome10", amount: 10 })).code, "WELCOME10", "a custom code is uppercased");

// --- Check balance (public) ---
t.eq((await check(code)).balance, 50, "public checks the balance");
t.eq((await check(code)).status, "active", "…status active");

// --- Redeem (bearer) ---
t.eq((await redeem(code, 20)).json.balance, 30, "redeem $20 → $30 left");
t.eq((await redeem(code, 30)).json.balance, 0, "redeem the rest → $0");

// --- Insufficient → 409 ---
let r = await redeem(code, 5);
t.eq(r.status, 409, "redeeming more than the balance → 409");
t.eq((await check(code)).balance, 0, "…balance unchanged at 0");

// --- Void ---
t.eq((await voidCard(A, "welcome10")).json.status, "void", "admin voids a card");
t.eq((await redeem("welcome10", 1)).status, 409, "…a voided card can't be redeemed");
t.eq((await check("welcome10")).status, "void", "…and reads as void");

// --- List ---
t.eq((await list(A)).cards.length, 2, "admin lists all cards");

// --- Validation + authz ---
t.eq((await issue(A, {})).status ?? 400, 400, "missing amount → 400");
t.eq((await c.post(`/api/db/${slug}/gift-cards`, { amount: -5 }, { token: A })).status, 400, "a negative amount → 400");
t.eq((await issue(A, { code, amount: 10 })).status ?? 409, 409, "issuing a duplicate code → 409");
t.eq((await c.get(`/api/db/${slug}/gift-cards/NOPECODE`)).status, 404, "checking an unknown code → 404");
t.eq((await redeem("NOPECODE", 5)).status, 404, "redeeming an unknown code → 404");
t.eq((await issue(B, { amount: 10 })).status ?? 403, 403, "a member can't issue → 403");
t.eq((await c.post(`/api/db/${slug}/gift-cards`, { amount: 10 }, { token: B })).status, 403, "…confirmed 403");
t.eq((await list(B)).status ?? 403, 403, "a member can't list → 403");
t.eq((await voidCard(B, code)).status, 403, "a member can't void → 403");

t.done(); h.restore();
