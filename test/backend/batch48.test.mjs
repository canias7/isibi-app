import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 48");
const slug = "b48";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // 2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // 3
// A mentions B and C in comment:5
let r = await c.post(`/api/db/${slug}/mention`, { target: "comment:5", users: [2, 3], text: "A mentioned you in a comment" }, { token: A });
t.ok(r.json.notified === 2, "A mentions B,C -> notified 2");
// B and C each have a mention notification
let inbox = await c.get(`/api/db/${slug}/notifications`, { token: B });
t.ok(inbox.json.rows.some(n => n.type === "mention" && n.link === "comment:5"), "B got the mention notification");
t.ok((await c.get(`/api/db/${slug}/notifications`, { token: C })).json.rows.some(n => n.type === "mention"), "C got one too");
// self is excluded: A mentions self+B -> only B (self filtered)
r = await c.post(`/api/db/${slug}/mention`, { target: "comment:6", users: [1, 2] }, { token: A });
t.ok(r.json.notified === 1, "self excluded (only B notified)");
// dedup: mentioning B again for the SAME target within an hour -> skipped
r = await c.post(`/api/db/${slug}/mention`, { target: "comment:5", users: [2] }, { token: A });
t.ok(r.json.notified === 0, "re-mention same target/user within 1h -> deduped (0)");
// unknown user id ignored
r = await c.post(`/api/db/${slug}/mention`, { target: "x:1", users: [999] }, { token: A });
t.ok(r.json.notified === 0, "unknown user id -> not notified");
// empty users -> 400
t.ok((await c.post(`/api/db/${slug}/mention`, { target: "x:1", users: [] }, { token: A })).status === 400, "no users -> 400");
// needs auth
t.ok((await c.post(`/api/db/${slug}/mention`, { target: "x:1", users: [2] })).status === 401, "mention needs auth -> 401");
t.done(); h.restore();
