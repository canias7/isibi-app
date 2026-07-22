// Batch 114 — fiscal periods / period close: a lock date freezes the ledger against backdated posts
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 114");
const slug = "b114";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const entry = (date) => c.post(`/api/db/${slug}/ledger/entries`, { date, lines: [{ account: "cash", debit: 10 }, { account: "rev", credit: 10 }] }, { token: ADMIN });
const close = (through) => c.post(`/api/db/${slug}/periods/close`, { through }, { token: ADMIN });
const periods = () => c.get(`/api/db/${slug}/periods`, { token: ADMIN });

// No lock initially — a Jan entry posts fine.
t.eq((await entry("2026-01-15")).status, 200, "entry posts with no lock");
t.eq((await periods()).json.lock_through, null, "no lock initially");

// Close the books through end of Jan.
let cl = await close("2026-01-31");
t.eq(cl.status, 200, "close → 200");
t.eq(cl.json.lock_through, "2026-01-31", "lock date set");
t.eq((await periods()).json.lock_through, "2026-01-31", "lock persists");

// Backdated posts into (or on) the closed period are refused; open periods still post.
let locked = await entry("2026-01-20");
t.eq(locked.status, 409, "post into a closed period → 409");
t.eq(locked.json.code, "period_locked", "409 carries period_locked code");
t.eq((await entry("2026-01-31")).status, 409, "post ON the lock date → 409 (inclusive)");
t.eq((await entry("2026-02-01")).status, 200, "post after the lock date → 200");

// A reversal that would land in a closed period is also refused (must reverse into an open one).
let e2 = await entry("2026-03-10");
const E2 = e2.json.entry.id;
t.eq((await c.post(`/api/db/${slug}/ledger/entries/${E2}/reverse`, { date: "2026-01-05" }, { token: ADMIN })).status, 409, "reversal dated into a closed period → 409");
t.eq((await c.post(`/api/db/${slug}/ledger/entries/${E2}/reverse`, { date: "2026-03-11" }, { token: ADMIN })).status, 200, "reversal into an open period → 200");

// Reopen (clear) lets the backdated entry through again.
t.eq((await c.post(`/api/db/${slug}/periods/reopen`, {}, { token: ADMIN })).json.lock_through, null, "reopen clears the lock");
t.eq((await entry("2026-01-20")).status, 200, "after reopen, backdated post succeeds");

// Reopen to an earlier date (partial): lock only through mid-Jan.
await close("2026-06-30");
t.eq((await c.post(`/api/db/${slug}/periods/reopen`, { through: "2026-01-10" }, { token: ADMIN })).json.lock_through, "2026-01-10", "reopen can move the lock earlier");
t.eq((await entry("2026-01-05")).status, 409, "still locked on/before the new earlier date");
t.eq((await entry("2026-02-15")).status, 200, "open after the new earlier date");

// Define a named period (reporting) + validation + authz.
let def = await c.post(`/api/db/${slug}/periods`, { name: "FY26 Q1", start: "2026-01-01", end: "2026-03-31" }, { token: ADMIN });
t.ok(def.json.ok && def.json.id, "define a named period");
t.ok((await periods()).json.periods.some((p) => p.name === "FY26 Q1"), "named period listed");
t.eq((await c.post(`/api/db/${slug}/periods`, { name: "bad" }, { token: ADMIN })).status, 400, "period without dates → 400");
t.eq((await close("not-a-date")).status, 400, "close with a bad date → 400");
t.eq((await c.post(`/api/db/${slug}/periods/close`, { through: "2026-01-31" }, { token: USER })).status, 403, "non-admin close → 403");
t.eq((await c.get(`/api/db/${slug}/periods`)).status, 401, "signed-out → 401");

t.done(); h.restore();
