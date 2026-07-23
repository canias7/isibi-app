// Batch 186 — NOTIFICATION PREFERENCES + QUIET HOURS. A member controls channels/types + a do-not-
// disturb window; /should-send is the gate the app checks before notifying. Covers type/channel opt-out,
// quiet hours (wrap-past-midnight, business-hours, tz-offset), partial updates, admin-checks-any, guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 186");
const slug = "b186";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const bId = h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all("b@x.dev")[0].id;
const get = (tok) => c.get(`/api/db/${slug}/notify-prefs`, { token: tok }).then((r) => r.json);
const set = (tok, body) => c.post(`/api/db/${slug}/notify-prefs`, body, { token: tok });
const should = (tok, qs) => c.get(`/api/db/${slug}/notify-prefs/should-send?${qs}`, tok === null ? {} : { token: tok }).then((r) => r.json);

// --- Defaults: nothing set → everything sends ---
t.eq(await get(B).then((p) => [p.quiet_start, p.tz_offset]), [null, 0], "unset prefs → no quiet hours, tz 0");
t.eq((await should(B, "type=mentions&channel=email")).send, true, "default → send true");

// --- Set prefs ---
await set(B, { channels: { email: true, sms: false }, types: { marketing: false, mentions: true }, quiet_start: 22, quiet_end: 7, tz_offset: 0 });
let p = await get(B);
t.eq([p.channels.sms, p.types.marketing, p.quiet_start, p.quiet_end], [false, false, 22, 7], "prefs saved");

// --- Type / channel opt-out ---
t.eq((await should(B, "type=marketing&channel=email")).send, false, "marketing is off → no send");
t.eq((await should(B, "type=marketing&channel=email")).reasons.type, false, "…reason: type");
t.eq((await should(B, "type=mentions&channel=sms")).reasons.channel, false, "sms channel off → reason: channel");

// --- Quiet hours that WRAP past midnight (22→7) ---
t.eq((await should(B, "type=mentions&channel=email&at=2026-07-23T12:00:00Z")).send, true, "noon is outside 22–7 → send");
let night = await should(B, "type=mentions&channel=email&at=2026-07-23T23:00:00Z");
t.eq([night.send, night.reasons.quiet], [false, true], "11pm is inside the wrap window → quiet, no send");

// --- Business-hours quiet (9→17, non-wrapping); channels/types preserved by the partial update ---
await set(B, { quiet_start: 9, quiet_end: 17 });
t.eq((await should(B, "type=mentions&channel=email&at=2026-07-23T12:00:00Z")).send, false, "noon is inside 9–17 → quiet");
t.eq((await should(B, "type=mentions&channel=email&at=2026-07-23T20:00:00Z")).send, true, "8pm is outside 9–17 → send");
t.eq((await get(B)).channels.sms, false, "the channels/types survived the quiet-only update (partial merge)");

// --- Timezone offset shifts the local hour ---
await set(B, { tz_offset: -300 }); // 5h behind UTC (quiet still 9–17 local)
t.eq((await should(B, "type=mentions&channel=email&at=2026-07-23T14:00:00Z")).send, false, "14:00Z = 09:00 local → inside 9–17");
t.eq((await should(B, "type=mentions&channel=email&at=2026-07-23T23:00:00Z")).send, true, "23:00Z = 18:00 local → outside 9–17");

// --- Clear quiet hours ---
await set(B, { quiet_start: null, quiet_end: null });
t.eq((await should(B, "type=mentions&channel=email&at=2026-07-23T12:00:00Z")).send, true, "quiet cleared → noon sends again");

// --- Admin may check any member; a peer may not ---
t.eq((await should(A, `type=marketing&channel=email&user=${bId}`)).send, false, "admin checks B's eligibility (marketing off → no send)");
t.eq((await c.get(`/api/db/${slug}/notify-prefs/should-send?user=${bId}`, { token: C })).status, 403, "a non-admin can't check another member → 403");

// --- Validation + guards ---
t.eq((await set(B, { quiet_start: 25 })).status, 400, "quiet_start out of 0–23 → 400");
t.eq((await set(B, { tz_offset: 9999 })).status, 400, "tz_offset out of range → 400");
t.eq((await c.get(`/api/db/${slug}/notify-prefs`)).status, 401, "signed-out GET → 401");
t.eq((await c.get(`/api/db/${slug}/notify-prefs/should-send?type=mentions`)).status, 401, "signed-out should-send → 401");

t.done(); h.restore();
