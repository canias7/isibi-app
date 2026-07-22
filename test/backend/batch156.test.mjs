// Batch 156 — per-team settings / config: each team/workspace has its own JSON KV store. Members
// read; owner/admin write. Isolated per team; cleared when the team is deleted.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 156");
const slug = "b156";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const OUT = (await c.signup(slug, "o@x.dev", "Str0ng-pass-9")).json.token; // id3, non-member
const setCfg = (tok, tid, key, value) => c.post(`/api/db/${slug}/teams/${tid}/config/${key}`, { value }, { token: tok });
const getCfg = (tok, tid, key) => c.get(`/api/db/${slug}/teams/${tid}/config${key ? "/" + key : ""}`, { token: tok });

// A owns a team; add B as a plain member.
const tid = (await c.post(`/api/db/${slug}/teams`, { name: "Acme" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: 2 }, { token: A });

// Owner writes settings — JSON values round-trip (string, bool, number, object).
t.eq((await setCfg(A, tid, "theme", "dark")).status, 200, "owner sets a string setting");
await setCfg(A, tid, "notify", true);
await setCfg(A, tid, "seats", 25);
await setCfg(A, tid, "branding", { logo: "x.png", color: "#ff0" });
t.eq((await getCfg(A, tid, "theme")).json.value, "dark", "string round-trips");
t.eq((await getCfg(A, tid, "notify")).json.value, true, "boolean round-trips");
t.eq((await getCfg(A, tid, "seats")).json.value, 25, "number round-trips");
t.eq((await getCfg(A, tid, "branding")).json.value.color, "#ff0", "object round-trips");

// Whole-config read.
let all = (await getCfg(A, tid)).json.config;
t.eq(Object.keys(all).length, 4, "4 settings stored");
t.eq(all.theme, "dark", "whole-config includes theme");

// A member can READ but not WRITE.
t.eq((await getCfg(B, tid, "theme")).json.value, "dark", "a member can read settings");
t.eq((await setCfg(B, tid, "theme", "light")).status, 403, "a member can't change settings");

// A non-member is denied entirely.
t.eq((await getCfg(OUT, tid)).status, 403, "a non-member can't read team settings");
t.eq((await setCfg(OUT, tid, "x", 1)).status, 403, "a non-member can't write");

// Upsert overwrites; delete removes.
await setCfg(A, tid, "theme", "solarized");
t.eq((await getCfg(A, tid, "theme")).json.value, "solarized", "upsert overwrites in place");
t.eq((await c.del(`/api/db/${slug}/teams/${tid}/config/theme`, { token: A })).json.removed, true, "owner deletes a setting");
t.eq((await getCfg(A, tid, "theme")).json.value, null, "deleted key reads null");
t.eq(Object.keys((await getCfg(A, tid)).json.config).length, 3, "down to 3 settings");

// Config is ISOLATED per team.
const tid2 = (await c.post(`/api/db/${slug}/teams`, { name: "Beta" }, { token: A })).json.id;
await setCfg(A, tid2, "theme", "beta-theme");
t.eq((await getCfg(A, tid2, "theme")).json.value, "beta-theme", "team 2 has its own value");
t.eq((await getCfg(A, tid, "theme")).json.value, null, "team 1 is unaffected");

// Deleting a team clears its config.
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
t.ok(h.getDb(uuid).prepare("SELECT COUNT(*) n FROM _team_config WHERE team_id=?").all(tid2)[0].n > 0, "team 2 has config before delete");
await c.del(`/api/db/${slug}/teams/${tid2}`, { token: A });
t.eq(h.getDb(uuid).prepare("SELECT COUNT(*) n FROM _team_config WHERE team_id=?").all(tid2)[0].n, 0, "deleting the team cleared its config");

// Guards.
t.eq((await c.post(`/api/db/${slug}/teams/${tid}/config/x`, { value: 1 })).status, 401, "signed-out → 401");
t.eq((await c.post(`/api/db/${slug}/teams/${tid}/config/x`, {}, { token: A })).status, 400, "missing value → 400");
t.eq((await getCfg(A, 99999)).status, 403, "config on a team you're not in → 403");

t.done(); h.restore();
