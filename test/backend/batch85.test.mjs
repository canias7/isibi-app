// Batch 85 — file attachments on records: upload (base64 → R2), list, fetch-through-worker,
// delete, and record-visibility-gated access.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 85");
const slug = "b85";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: { access: "admin", columns: [{ name: "title", type: "text" }] },
  leads: { access: "user", columns: [{ name: "name", type: "text" }] },
  intake: { access: "collect", columns: [{ name: "x", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const b64 = (s) => Buffer.from(s).toString("base64");

await c.post(`/api/db/${slug}/rows/deals`, { title: "Enterprise" }, { token: ADMIN }); // deal 1
await c.post(`/api/db/${slug}/rows/deals`, { title: "SMB" }, { token: ADMIN }); // deal 2

// upload a file to deal 1
let up = await c.post(`/api/db/${slug}/rows/deals/1/attach`, { filename: "contract.txt", content_type: "text/plain", data: b64("contract v1") }, { token: ADMIN });
t.ok(up.json.ok && up.json.attachment.id > 0, "upload returns an attachment id");
t.eq(up.json.attachment.size, 11, "decoded size recorded (11 bytes)");
t.eq(up.json.attachment.filename, "contract.txt", "filename recorded");
const attUrl = up.json.attachment.url;
t.ok(/\/api\/db\/b85\/attach\/\d+$/.test(attUrl), "fetch url shape");

// list attachments on the record
let list = (await c.get(`/api/db/${slug}/rows/deals/1/attach`, { token: ADMIN })).json;
t.eq(list.attachments.length, 1, "one attachment listed");
t.ok(list.attachments[0].url === attUrl, "list carries the fetch url");

// fetch the bytes back THROUGH the worker (base64 → decoded body)
let fetched = await c.get(attUrl, { token: ADMIN });
t.eq(fetched.status, 200, "attachment fetch 200");
t.eq(fetched.text, "contract v1", "fetched body matches the uploaded content");

// deals is public-read (admin) → any member, even anon, can fetch its attachment
t.eq((await c.get(attUrl)).text, "contract v1", "public-read record → attachment fetchable by anyone");

// a data: URL prefix is accepted and stripped
let up2 = await c.post(`/api/db/${slug}/rows/deals/1/attach`, { filename: "note.txt", data: "data:text/plain;base64," + b64("hi") }, { token: A });
t.ok(up2.json.ok, "data: URL prefix accepted");
t.eq((await c.get(up2.json.attachment.url)).text, "hi", "data-URL upload round-trips");
t.eq((await c.get(`/api/db/${slug}/rows/deals/1/attach`, { token: ADMIN })).json.attachments.length, 2, "two attachments now");

// delete: a non-uploader non-admin can SEE the public record but can't delete the file
t.eq((await c.del(`/api/db/${slug}/rows/deals/1/attach/${up2.json.attachment.id}`, { token: B })).status, 403, "non-uploader can't delete");
// the uploader can
t.ok((await c.del(`/api/db/${slug}/rows/deals/1/attach/${up2.json.attachment.id}`, { token: A })).json.deleted === 1, "uploader deletes own");
// admin can delete anyone's
t.ok((await c.del(`/api/db/${slug}/rows/deals/1/attach/${up.json.attachment.id}`, { token: ADMIN })).json.deleted === 1, "admin deletes any");
t.eq((await c.get(`/api/db/${slug}/rows/deals/1/attach`, { token: ADMIN })).json.attachments.length, 0, "all gone");

// PRIVATE record: attachment access follows the row's visibility
await c.post(`/api/db/${slug}/rows/leads`, { name: "A's lead" }, { token: A }); // owned by A, id1
let pl = await c.post(`/api/db/${slug}/rows/leads/1/attach`, { filename: "secret.txt", data: b64("top secret") }, { token: A });
t.ok(pl.json.ok, "owner can attach to their private lead");
t.eq((await c.get(pl.json.attachment.url, { token: A })).text, "top secret", "owner fetches their attachment");
t.eq((await c.get(pl.json.attachment.url, { token: B })).status, 404, "another user can't fetch a private record's attachment");
t.eq((await c.get(pl.json.attachment.url)).status, 404, "anon can't fetch a private record's attachment");
// B can't even attach to A's lead
t.eq((await c.post(`/api/db/${slug}/rows/leads/1/attach`, { filename: "x", data: b64("x") }, { token: B })).status, 404, "non-owner can't attach to a private record");

// guards
t.eq((await c.post(`/api/db/${slug}/rows/intake/1/attach`, { filename: "x", data: b64("x") }, { token: ADMIN })).status, 400, "no attachments on a collect table");
t.eq((await c.post(`/api/db/${slug}/rows/deals/1/attach`, { filename: "x", data: "!!!not base64!!!" }, { token: ADMIN })).status, 400, "invalid base64 → 400");
t.eq((await c.post(`/api/db/${slug}/rows/deals/1/attach`, { filename: "x" }, { token: ADMIN })).status, 400, "missing data → 400");
t.eq((await c.get(`/api/db/${slug}/attach/99999`, { token: ADMIN })).status, 404, "unknown attachment id → 404");

t.done(); h.restore();
