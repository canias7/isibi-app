// Batch 97 — signed/expiring attachment links: fetch a private file without the Bearer token
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 97");
const slug = "b97";
await c.ensure(slug);
await c.schema(slug, { tables: { leads: { access: "user", columns: [{ name: "name", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const b64 = (s) => Buffer.from(s).toString("base64");

await c.post(`/api/db/${slug}/rows/leads`, { name: "A lead" }, { token: A }); // private to A
const att = (await c.post(`/api/db/${slug}/rows/leads/1/attach`, { filename: "contract.txt", data: b64("PRIVATE") }, { token: A })).json.attachment;

// without a token the private file is a 404
t.eq((await c.get(att.url)).status, 404, "no token → private file 404s");
t.eq((await c.get(att.url, { token: B })).status, 404, "another user → 404");

// owner requests signed links
let signed = (await c.get(`/api/db/${slug}/rows/leads/1/attach?sign=1&ttl=600`, { token: A })).json;
const su = signed.attachments[0].signed_url;
t.ok(/\/attach\/\d+\?t=/.test(su), "signed_url returned with a token");

// the signed link fetches the bytes WITHOUT any Bearer token
let got = await c.get(su);
t.eq(got.status, 200, "signed link serves the file anonymously");
t.eq(got.text, "PRIVATE", "bytes intact via signed link");

// a signed link is scoped to its own attachment id — swapping the id invalidates it
await c.post(`/api/db/${slug}/rows/leads/1/attach`, { filename: "other.txt", data: b64("OTHER") }, { token: A }); // att id 2
const tokenPart = su.split("?t=")[1];
t.eq((await c.get(`/api/db/${slug}/attach/2?t=${tokenPart}`)).status, 404, "token for att 1 doesn't open att 2");

// a garbage token doesn't authorize
t.eq((await c.get(`${att.url}?t=not-a-real-token`)).status, 404, "invalid token → 404");

// owner can still fetch normally with Bearer
t.eq((await c.get(att.url, { token: A })).text, "PRIVATE", "owner still fetches with Bearer");

t.done(); h.restore();
