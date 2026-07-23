// Batch 223 — TERMS ACCEPTANCE. An admin publishes a versioned document; a member accepts the current
// version and the app checks whether they're up to date. Covers set/get, accept, status (up_to_date across
// a version bump), acceptances log, list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 223");
const slug = "b223";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const setDoc = (tok, doc, body) => c.post(`/api/db/${slug}/terms/${doc}`, body, tok === null ? {} : { token: tok });
const getDoc = (doc) => c.get(`/api/db/${slug}/terms/${doc}`).then((r) => r.json);
const accept = (tok, doc) => c.post(`/api/db/${slug}/terms/${doc}/accept`, {}, { token: tok }).then((r) => r.json);
const statusOf = (tok, doc) => c.get(`/api/db/${slug}/terms/${doc}/status`, { token: tok }).then((r) => r.json);
const acceptances = (tok, doc) => c.get(`/api/db/${slug}/terms/${doc}/acceptances`, { token: tok }).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/terms`).then((r) => r.json);
const del = (tok, doc) => c.del(`/api/db/${slug}/terms/${doc}`, { token: tok });

// --- Publish + read ---
t.eq((await setDoc(A, "tos", { version: "1.0", title: "Terms", url: "https://x/tos" })).json.version, "1.0", "admin publishes v1.0");
t.eq((await getDoc("tos")).terms.version, "1.0", "public reads the current version");

// --- Accept + status ---
t.eq((await statusOf(B, "tos")).up_to_date, false, "before accepting → not up to date");
t.eq((await accept(B, "tos")).accepted, true, "member accepts");
let st = await statusOf(B, "tos");
t.eq(st.up_to_date, true, "…now up to date");
t.eq(st.accepted_version, "1.0", "…accepted version recorded");

// --- Version bump invalidates the old acceptance ---
await setDoc(A, "tos", { version: "2.0" });
st = await statusOf(B, "tos");
t.eq(st.current_version, "2.0", "current version bumped to 2.0");
t.eq(st.accepted_version, "1.0", "…member still on 1.0");
t.eq(st.up_to_date, false, "…so no longer up to date");
await accept(B, "tos");
t.eq((await statusOf(B, "tos")).up_to_date, true, "re-accepting 2.0 makes them current again");

// --- Acceptances log (admin) ---
t.eq((await acceptances(A, "tos")).acceptances.length, 1, "one acceptance row (latest per member)");
t.eq((await acceptances(A, "tos")).acceptances[0].version, "2.0", "…at the current version");

// --- List + delete ---
await setDoc(A, "privacy", { version: "1.0" });
t.eq((await list()).docs.length, 2, "list has both docs");
t.eq((await del(A, "privacy")).json.deleted, true, "admin deletes a doc");

// --- Validation + authz ---
t.eq((await setDoc(A, "x", {})).status, 400, "missing version → 400");
t.eq((await getDoc("nope")).ok ?? false, false, "unknown doc → not ok");
t.eq((await c.post(`/api/db/${slug}/terms/tos/accept`, {})).status, 401, "signed-out accept → 401");
t.eq((await c.post(`/api/db/${slug}/terms/ghost/accept`, {}, { token: B })).status, 404, "accepting a missing doc → 404");
t.eq((await setDoc(B, "hax", { version: "1" })).status, 403, "a member can't publish → 403");
t.eq((await acceptances(B, "tos")).status ?? 403, 403, "a member can't read acceptances → 403");
t.eq((await c.get(`/api/db/${slug}/terms/tos/acceptances`, { token: B })).status, 403, "…confirmed 403");

t.done(); h.restore();
