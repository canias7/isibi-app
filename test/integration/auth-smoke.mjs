// A complete audit of the visitor-auth layer, against the DEPLOYED Worker.
//
// The unit suite proves each decision in isolation against fakes. This proves
// the layer end to end on production: a real site, a real Neon database, real
// HTTP, and a real browser. Every bug this layer has ever had was invisible to
// review and to the unit tests — a column nothing created, a token kind nothing
// checked, a hook nobody could call — and showed up only when something real
// ran against the deployed thing.
//
// THE SCHEMA IS SENT EXPLICITLY, not designed. `POST /api/site/react-build`
// skips the designer when the body carries a `schema`, which makes this test
// deterministic: the auth layer is what is under test, not the model's judgement
// about which tables a yoga studio needs. It also halves the model spend.
//
// Needs SUPABASE_SERVICE_KEY (to mint and remove a throwaway isibi account) and
// NEON_API_KEY (to remove its project). Run from CI, where those live.
//
// Everything it creates is removed in `finally`: the published site, the Neon
// project, the account. A Neon project is a capped, billed resource whose only
// record is a Supabase row — leaking one is the failure mode this repo has
// already had twice.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dropUserProject } from "../../site-db.mjs";

const BASE = process.env.SMOKE_BASE_URL || "https://isibi.ai";
const SUPABASE_URL = "https://ujrqdmmtcptvimazlhom.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const SVC = process.env.SUPABASE_SERVICE_KEY || "";
if (!SVC) { console.error("SUPABASE_SERVICE_KEY is required"); process.exit(1); }

const SHOTS = path.join(process.cwd(), "docs", "auth-audit");

let passed = 0, failed = 0;
const results = [];
const ok = (name, cond, extra) => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + String(extra).slice(0, 1200) : ""}`); }
  results.push({ name, pass: !!cond, extra: cond ? "" : String(extra ?? "").slice(0, 1200) });
};
const section = (t) => { console.log(`\n── ${t}`); results.push({ section: t }); };

const svc = (extra) => ({ apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json", ...(extra || {}) });
const J = async (r) => { try { return await r.json(); } catch { return {}; } };

const stamp = Date.now().toString(36);
const rnd = () => Math.random().toString(36).slice(2, 10);
const ownerEmail = `authsmoke-${stamp}@isibi.ai`;
const ownerPass = `Au7h-${stamp}-${rnd()}`;

let userId = null, slug = null, jwt = null;

// The site's own members. `auth` drives /api/db/<slug>/auth/* — public by
// design, because a customer booking a class has no isibi account.
const authUrl = (a) => `${BASE}/api/db/${slug}/auth/${a}`;
// Retries once on 429. The auth surface is rate limited per IP (30/min) and an
// audit this dense outruns it — which is the limiter working, not a defect. The
// alternative is a suite whose last section fails for a reason that has nothing
// to do with what it is testing, which is exactly what the first run did.
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
// Three attempts, not one. Signup is throttled per SITE (10/min) rather than per
// address, and an audit this dense makes more than ten of them in a minute — so
// a single retry ran out partway through and the run failed on the limiter
// working correctly, which is the least useful failure a test can produce.
const AUTH_RETRIES = 3;
const auth = async (action, body, token, attempt = 0) => {
  const r = await fetch(authUrl(action), {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  const out = { status: r.status, body: await J(r) };
  if (out.status === 429 && attempt < AUTH_RETRIES) {
    const wait = Math.min(Number(out.body.retryAfter) || 30, 70);
    console.log(`   (rate limited — waiting ${wait}s, the limiter is doing its job)`);
    await sleep((wait + 2) * 1000);
    return auth(action, body, token, attempt + 1);
  }
  return out;
};
const me = async (token) => {
  const r = await fetch(authUrl("me"), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: r.status, body: await J(r) };
};
const owner = (p, init) => fetch(`${BASE}/api/site/${slug}${p}`, {
  ...init, headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json", ...((init || {}).headers || {}) },
});

// A member with a real, long, unbreached password.
const newMemberPass = () => `Clover-Tandem-${rnd()}-${rnd()}`;

// --------------------------------------------------------------- authenticator
//
// RFC 6238, written out here rather than imported from site-otp.mjs — on
// purpose. Importing the implementation under test would prove only that it
// agrees with itself; this stands in for a real authenticator app, so a code it
// produces being accepted by production is the same evidence a phone would give.
// The unit suite pins the module against the RFC's own vectors separately.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32bytes = (secret) => {
  const clean = String(secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  const out = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};
const totpAt = (secret, counter) => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", b32bytes(secret)).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const n = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 1e6).padStart(6, "0");
};
/**
 * A code with most of its 30-second step still ahead of it.
 *
 * The replay check needs the SAME code presented twice inside one window. Taken
 * at an arbitrary moment the step can roll between the two calls, and a rolled
 * code is refused for being stale rather than for being a replay — the
 * assertion still passes, for the wrong reason, which is worse than failing.
 */
const freshTotp = async (secret) => {
  const into = Date.now() % 30000;
  if (into > 12000) await sleep(30000 - into + 400);
  return totpAt(secret, Math.floor(Date.now() / 30000));
};

try {
  // ---------------------------------------------------------------- account
  const mk = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: svc(),
    body: JSON.stringify({ email: ownerEmail, password: ownerPass, email_confirm: true }),
  });
  const made = await J(mk);
  userId = made && made.id;
  if (!userId) { console.error("cannot continue without a user:", JSON.stringify(made)); process.exit(1); }
  const si = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: ownerEmail, password: ownerPass }),
  });
  jwt = (await J(si)).access_token;
  if (!jwt) { console.error("cannot continue without a token"); process.exit(1); }
  console.log("throwaway owner:", ownerEmail);

  // ------------------------------------------------------------------ build
  //
  // One site carrying every access level the auth layer distinguishes, so a
  // single build exercises the lot. Sent explicitly so the shapes are certain.
  slug = `authsmoke-${stamp}-${rnd().slice(0, 5)}`;
  const schema = {
    brand: "Aurora Yoga",
    description: "Class timetable, bookings, and a members area.",
    tables: [
      {
        name: "teachers", access: "display",
        columns: ["name", "bio", "phone"],
        // Redaction, enforced on the read path since 2026-07-29 and dead before it.
        mask: [{ column: "phone", roles: ["staff"], keep: 4 }],
      },
      {
        name: "bookings", access: "collect",
        columns: ["class_name", "customer_name", "customer_email", "slot_date", "slot_time"],
        unique: [{ columns: ["slot_date", "slot_time"] }],
        // Lets a page show which slots are taken without publishing who took them.
        publicView: { columns: ["slot_date", "slot_time"] },
      },
      { name: "my_notes", access: "user", columns: ["title", "body"] },
      { name: "announcements", access: "admin", columns: ["title", "body"], writeRoles: ["admin"] },
      // The fourth read model: not private-to-me and not everyone-sees-
      // everything, but "ours". Dead at four layers until 2026-07-29 — parsed,
      // stamping a column, referenced by nothing, undeclarable.
      { name: "deals", access: "user", teamScope: true, columns: ["title", "value"] },
    ],
  };
  // TOP LEVEL, not inside `schema`: the route reads
  // `(designed && designed.seed) || body.seed`, and `designed` is null whenever a
  // schema is sent explicitly. Nested, this is silently ignored.
  const seed = {
    teachers: [
      { name: "Maya Iyer", bio: "Vinyasa and breathwork.", phone: "07700900123" },
      { name: "Tom Beckett", bio: "Restorative and yin.", phone: "07700900456" },
      { name: "Ana Ruiz", bio: "Ashtanga, mornings.", phone: "07700900789" },
    ],
  };

  console.log("building…", slug);
  const br = await fetch(`${BASE}/api/site/react-build`, {
    method: "POST", headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({ slug, schema, seed, brief: "A yoga studio: timetable, class booking, and a members area." }),
  });
  const bd = await J(br);
  section("the site");
  ok("build returns 200", br.status === 200, br.status + " " + JSON.stringify(bd).slice(0, 300));
  if (br.status !== 200) throw new Error("cannot audit auth without a site");
  ok("every declared table was created", (bd.tables || []).length === 5, JSON.stringify(bd.tables));
  ok("the display table was seeded", (bd.seeded || {}).teachers > 0, JSON.stringify(bd.seeded));
  // `notes` is the field that says WHY when there is no stage and no error —
  // truncation, the credit floor, or a response with nothing usable in it. The
  // route has always returned it and this printed everything except it, so a
  // build that produced no files at all was indistinguishable from one that
  // failed to compile. The same gap the designer's 503 had.
  ok("a real app was published, not the placeholder", bd.page === "app",
    `page=${bd.page} stage=${bd.stage || "-"} error=${bd.error || "-"} notes=${bd.notes || "-"} ` +
    `cost=${bd.cost ?? "-"} files=${JSON.stringify(bd.files || [])} problems=${JSON.stringify(bd.problems || [])}`);
  console.log("   url:", bd.url, "| page:", bd.page, "| cost:", bd.cost, "| files:", JSON.stringify(bd.files || []));
  if (bd.notes) console.log("   notes:", bd.notes);

  // =================================================================== SIGNUP
  section("signup");
  const m1 = `ada-${rnd()}@example.com`;
  const m1pass = newMemberPass();

  let r = await auth("signup", { email: m1, password: m1pass });
  ok("signup creates an account and returns a session", r.status === 200 && !!r.body.token, r.status + " " + JSON.stringify(r.body).slice(0, 160));
  const m1token = r.body.token;

  r = await auth("signup", { email: `x-${rnd()}@example.com`, password: "short" });
  ok("a short password is refused", r.status === 400, r.status);

  r = await auth("signup", { email: "not-an-email", password: newMemberPass() });
  ok("an invalid address is refused", r.status === 400, r.status);

  r = await auth("signup", { email: m1, password: newMemberPass() });
  ok("a duplicate address is 409 `exists`", r.status === 409 && r.body.code === "exists", r.status + " " + JSON.stringify(r.body));

  // The breached-password check, shipped 2026-07-29. "password" has ~24M hits.
  r = await auth("signup", { email: `pw-${rnd()}@example.com`, password: "password" });
  ok("a BREACHED password is refused", r.status === 400 && r.body.code === "pwned", r.status + " " + JSON.stringify(r.body));

  // ==================================================================== LOGIN
  section("login");
  r = await auth("login", { email: m1, password: m1pass });
  ok("login returns a session for the right password", r.status === 200 && !!r.body.token, r.status);

  const wrong = await auth("login", { email: m1, password: "not-the-password-at-all" });
  const absent = await auth("login", { email: `nobody-${rnd()}@example.com`, password: "not-the-password-at-all" });
  ok("a wrong password is 401", wrong.status === 401, wrong.status);
  ok("an unknown address answers BYTE-IDENTICALLY to a wrong password",
    wrong.status === absent.status && JSON.stringify(wrong.body) === JSON.stringify(absent.body),
    JSON.stringify(wrong.body) + " vs " + JSON.stringify(absent.body));

  // ===================================================== sessions and tokens
  section("sessions and token kinds");
  r = await me(m1token);
  ok("`me` resolves a session to the account", r.status === 200 && r.body.user?.email === m1, r.status + " " + JSON.stringify(r.body));
  ok("`me` with no token is 401", (await me()).status === 401);
  ok("`me` with a garbage token is 401", (await me("not.a.token")).status === 401);
  ok("`me` with a truncated token is 401", (await me(String(m1token).slice(0, -4))).status === 401);

  // The per-site signing key: a session minted on ANOTHER site must be useless
  // here. Without the slug in the derivation, one account would work everywhere.
  const otherSite = await fetch(`${BASE}/api/db/definitely-not-a-real-site-${rnd()}/auth/me`, {
    headers: { Authorization: `Bearer ${m1token}` },
  });
  ok("a token is useless against a different site", otherSite.status !== 200, String(otherSite.status));

  // Per-device sessions, shipped 2026-07-29.
  const second = await auth("login", { email: m1, password: m1pass });
  const m1second = second.body.token;
  const list = await fetch(authUrl("sessions"), { headers: { Authorization: `Bearer ${m1second}` } });
  const listed = await J(list);
  ok("`sessions` lists this account's devices", list.status === 200 && Array.isArray(listed.sessions) && listed.sessions.length >= 2,
    list.status + " " + JSON.stringify(listed).slice(0, 200));
  const current = (listed.sessions || []).filter((s) => s.current);
  ok("exactly one device is marked `current`", current.length === 1, JSON.stringify(listed.sessions));
  // The sid to revoke is read out of m1token ITSELF, not picked as "the first
  // one that is not current". Signup and each login mint a session, so several
  // are not current, and the first draft revoked whichever sorted first and then
  // asserted a DIFFERENT token had died — a flaky test that reads as a product
  // bug. The payload is the unsigned half of the token, so this needs no secret.
  const sidOf = (t) => { try { return JSON.parse(Buffer.from(String(t).split(".")[0], "base64url").toString()).sid; } catch { return null; } };
  const other = (listed.sessions || []).find((s) => s.sid === sidOf(m1token));
  ok("the token's own device appears in the list", !!other, `sid=${sidOf(m1token)} listed=${JSON.stringify((listed.sessions || []).map((x) => x.sid))}`);
  ok("a device is named, not dumped as a UA string", !!other && typeof other.device === "string" && other.device.length < 40, JSON.stringify(other));

  if (other) {
    const rv = await auth("sessions/revoke", { sid: other.sid }, m1second);
    ok("revoking ONE device succeeds", rv.status === 200 && rv.body.self === false, rv.status + " " + JSON.stringify(rv.body));
    ok("the revoked device's token stops working", (await me(m1token)).status === 401);
    ok("the device you are reading from still works", (await me(m1second)).status === 200);
    const again = await auth("sessions/revoke", { sid: other.sid }, m1second);
    ok("revoking it twice is a 404, not a silent success", again.status === 404, again.status);
    const bogus = await auth("sessions/revoke", { sid: "AAAAAAAAAAAAAAAAAAAA" }, m1second);
    ok("an unknown sid answers identically to somebody else's", bogus.status === 404, bogus.status);
  }

  // ========================================================= account controls
  section("account controls");
  const m1pass2 = newMemberPass();
  r = await auth("password", { current: "wrong-current-password", next: m1pass2 }, m1second);
  ok("changing a password needs the CURRENT one", r.status === 401 && r.body.code === "current", r.status + " " + JSON.stringify(r.body));

  r = await auth("password", { current: m1pass, next: "password" }, m1second);
  ok("a BREACHED new password is refused", r.status === 400 && r.body.code === "pwned", r.status + " " + JSON.stringify(r.body));

  r = await auth("password", { current: m1pass, next: m1pass2 }, m1second);
  ok("a signed-in member can change their password", r.status === 200 && !!r.body.token, r.status + " " + JSON.stringify(r.body).slice(0, 160));
  const m1after = r.body.token;
  ok("the password change signs OTHER sessions out", (await me(m1second)).status === 401);
  ok("...and keeps the one that made the change", (await me(m1after)).status === 200);
  ok("the old password no longer works", (await auth("login", { email: m1, password: m1pass })).status === 401);
  ok("the new password does", (await auth("login", { email: m1, password: m1pass2 })).status === 200);

  // Changing the address must un-prove it. Fixed 2026-07-29 — before that a
  // member stayed `verified` on an address they never proved.
  const m1b = `ada-moved-${rnd()}@example.com`;
  r = await auth("email", { current: "nope", next: m1b }, m1after);
  ok("changing an address needs the current password", r.status === 401, r.status);
  r = await auth("email", { current: m1pass2, next: m1b }, m1after);
  ok("a member can change their address", r.status === 200 && r.body.user?.email === m1b, r.status + " " + JSON.stringify(r.body).slice(0, 160));
  const m1moved = r.body.token || m1after;
  ok("the new address logs in", (await auth("login", { email: m1b, password: m1pass2 })).status === 200);
  ok("the old address does not", (await auth("login", { email: m1, password: m1pass2 })).status === 401);

  // ============================================================ data scoping
  section("data scoping");
  const teachers = await fetch(`${BASE}/api/db/${slug}/rows/teachers`);
  const tRows = (await J(teachers)).rows || [];
  ok("a `display` table is readable by anyone", teachers.status === 200 && tRows.length === 3, teachers.status + " n=" + tRows.length);
  // `mask`, enforced on the read path since 2026-07-29 and dead before it.
  const phone = tRows[0] && String(tRows[0].phone || "");
  ok("a MASKED column is redacted for the public", /^[^0-9]*\d{4}$/.test(phone) && phone !== "07700900123", JSON.stringify(phone));
  const unmask = await fetch(`${BASE}/api/db/${slug}/rows/teachers?role=admin`);
  const uRows = (await J(unmask)).rows || [];
  ok("no query string can unmask it", String(uRows[0] && uRows[0].phone) === phone, JSON.stringify(uRows[0] && uRows[0].phone));

  const wDisplay = await fetch(`${BASE}/api/db/${slug}/rows/teachers`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  ok("a `display` table refuses a public write", wDisplay.status === 403, wDisplay.status);

  const readCollect = await fetch(`${BASE}/api/db/${slug}/rows/bookings`);
  ok("a `collect` table refuses a public READ", readCollect.status === 403, readCollect.status);

  const anonUser = await fetch(`${BASE}/api/db/${slug}/rows/my_notes`);
  ok("a `user` table answers 401 to a signed-OUT visitor", anonUser.status === 401, anonUser.status);

  // Own-rows scoping: two members must not see each other's notes.
  const m2 = `bob-${rnd()}@example.com`, m2pass = newMemberPass();
  const m2r = await auth("signup", { email: m2, password: m2pass });
  const m2token = m2r.body.token;
  const mkNote = (tok, title) => fetch(`${BASE}/api/db/${slug}/rows/my_notes`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ title, body: "x" }),
  });
  const n1 = await mkNote(m1moved, "ada-note"), n2 = await mkNote(m2token, "bob-note");
  ok("a member can write to a `user` table", n1.status === 201 && n2.status === 201, `${n1.status}/${n2.status}`);
  const adaId = (await J(n1)).row?.id;
  const mine = await fetch(`${BASE}/api/db/${slug}/rows/my_notes`, { headers: { Authorization: `Bearer ${m2token}` } });
  const mineRows = (await J(mine)).rows || [];
  ok("a `user` read returns ONLY the caller's own rows",
    mineRows.length === 1 && mineRows[0].title === "bob-note", JSON.stringify(mineRows).slice(0, 200));
  if (adaId != null) {
    const steal = await fetch(`${BASE}/api/db/${slug}/rows/my_notes/${adaId}`, {
      method: "PATCH", headers: { "content-type": "application/json", Authorization: `Bearer ${m2token}` },
      body: JSON.stringify({ title: "stolen" }),
    });
    ok("another member's row answers 404, NOT 403", steal.status === 404, steal.status);
  }

  // publicView: the projection anyone may read.
  const pub = await fetch(`${BASE}/api/db/${slug}/rows/bookings/public`);
  const pubBody = await J(pub);
  ok("a `publicView` projection is readable by anyone", pub.status === 200 && Array.isArray(pubBody.rows), pub.status + " " + JSON.stringify(pubBody).slice(0, 160));
  ok("the projection carries NO id", !(pubBody.rows || []).some((x) => "id" in x), JSON.stringify((pubBody.rows || [])[0]));

  // =================================================================== claims
  section("submissions and claim links");
  const slotDate = "2027-03-01", slotTime = "10:00";
  const submit = (extra) => fetch(`${BASE}/api/db/${slug}/rows/bookings`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ class_name: "Vinyasa", customer_name: "Ada", customer_email: "ada@example.com", slot_date: slotDate, slot_time: slotTime, ...extra }),
  });
  const s1 = await submit();
  const s1b = await J(s1);
  ok("anyone can submit to a `collect` table", s1.status === 201, s1.status + " " + JSON.stringify(s1b).slice(0, 160));
  ok("the submission comes back with a CLAIM token", !!s1b.claim, JSON.stringify(Object.keys(s1b)));

  const s2 = await submit();
  ok("a `unique` constraint refuses the same slot twice (409)", s2.status === 409, s2.status + " " + JSON.stringify(await J(s2)).slice(0, 160));
  const s3 = await submit({ slot_time: "11:30" });
  ok("...but a different slot is accepted", s3.status === 201, s3.status);

  if (s1b.claim && s1b.row?.id) {
    const rid = s1b.row.id;
    const cr = await fetch(`${BASE}/api/db/${slug}/rows/bookings/${rid}?claim=${encodeURIComponent(s1b.claim)}`);
    ok("a claim token reads back that one row", cr.status === 200, cr.status);
    const bad = await fetch(`${BASE}/api/db/${slug}/rows/bookings/${rid}?claim=nonsense`);
    ok("a bad claim is 404", bad.status === 404, bad.status);
    const nb = await fetch(`${BASE}/api/db/${slug}/rows/bookings/${rid + 1}?claim=${encodeURIComponent(s1b.claim)}`);
    ok("a claim does NOT open the neighbouring row", nb.status === 404, nb.status);
    // A claim token must not be usable as a login — the deny-list→allow-list fix.
    ok("a claim token is NOT a session", (await me(s1b.claim)).status === 401);
    const del = await fetch(`${BASE}/api/db/${slug}/rows/bookings/${rid}?claim=${encodeURIComponent(s1b.claim)}`, { method: "DELETE" });
    ok("a claim can cancel its own row", del.status === 200, del.status);
    const del2 = await fetch(`${BASE}/api/db/${slug}/rows/bookings/${rid}?claim=${encodeURIComponent(s1b.claim)}`, { method: "DELETE" });
    ok("cancelling twice is idempotent, not an error", del2.status === 200 || del2.status === 404, del2.status);
  }

  // ==================================================== roles and the owner
  section("roles, and the owner's door");
  const annAsUser = await fetch(`${BASE}/api/db/${slug}/rows/announcements`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${m2token}` },
    body: JSON.stringify({ title: "hello", body: "x" }),
  });
  ok("an `admin` table refuses a plain member's write", annAsUser.status === 403, annAsUser.status);

  const mem = await owner("/members");
  const memBody = await J(mem);
  ok("the owner can list the site's members", mem.status === 200 && (memBody.members || []).length >= 2, mem.status + " " + JSON.stringify(memBody).slice(0, 160));
  ok("the member list does NOT carry password hashes",
    !JSON.stringify(memBody).match(/pass_hash|pbkdf2\$/), JSON.stringify(memBody).slice(0, 200));

  const bobRow = (memBody.members || []).find((x) => String(x.email) === m2);
  if (bobRow) {
    const grant = await owner(`/members/${bobRow.id}`, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
    ok("the owner can grant a role", grant.status === 200, grant.status + " " + JSON.stringify(await J(grant)).slice(0, 160));
    const annAsAdmin = await fetch(`${BASE}/api/db/${slug}/rows/announcements`, {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${m2token}` },
      body: JSON.stringify({ title: "hello", body: "x" }),
    });
    ok("...and the granted role can now write", annAsAdmin.status === 201, annAsAdmin.status + " " + JSON.stringify(await J(annAsAdmin)).slice(0, 160));

    const block = await owner(`/members/${bobRow.id}`, { method: "PATCH", body: JSON.stringify({ blocked: true }) });
    ok("the owner can suspend a member", block.status === 200, block.status);
    ok("a suspended member's token stops working at once", (await me(m2token)).status === 401);
    const blockedLogin = await auth("login", { email: m2, password: m2pass });
    ok("a suspended member's login is byte-identical to a wrong password",
      blockedLogin.status === wrong.status && JSON.stringify(blockedLogin.body) === JSON.stringify(wrong.body),
      blockedLogin.status + " " + JSON.stringify(blockedLogin.body));
    await owner(`/members/${bobRow.id}`, { method: "PATCH", body: JSON.stringify({ blocked: false }) });
    ok("...and can reinstate them", (await auth("login", { email: m2, password: m2pass })).status === 200);
  }

  // ============================================== who may become a member
  section("who may become a member");
  let acc = await owner("/access", { method: "POST", body: JSON.stringify({ mode: "closed" }) });
  ok("the owner can close signups", acc.status === 200, acc.status + " " + JSON.stringify(await J(acc)).slice(0, 120));
  r = await auth("signup", { email: `late-${rnd()}@example.com`, password: newMemberPass() });
  ok("a CLOSED site refuses a new account", r.status === 403 && r.body.code === "closed", r.status + " " + JSON.stringify(r.body));

  acc = await owner("/access", { method: "POST", body: JSON.stringify({ mode: "invite" }) });
  ok("the owner can require an invite", acc.status === 200, acc.status);
  r = await auth("signup", { email: `nc-${rnd()}@example.com`, password: newMemberPass() });
  ok("invite-only refuses a signup with no code", r.status === 403 && r.body.code === "invite", r.status + " " + JSON.stringify(r.body));
  const wrongCode = await auth("signup", { email: `wc-${rnd()}@example.com`, password: newMemberPass(), invite: "ABCD-EFGH-JKLM" });
  ok("a wrong code answers identically to no code", wrongCode.status === 403 && wrongCode.body.code === "invite", wrongCode.status);

  const mint = await owner("/access/invite", { method: "POST", body: JSON.stringify({ uses: 1, note: "audit" }) });
  const mintBody = await J(mint);
  const code = mintBody.code || mintBody.invite?.code;
  ok("the owner can mint an invite code", mint.status === 201 && !!code, mint.status + " " + JSON.stringify(mintBody).slice(0, 160));
  if (code) {
    r = await auth("signup", { email: `inv-${rnd()}@example.com`, password: newMemberPass(), invite: code });
    ok("a valid code lets somebody in", r.status === 200 && !!r.body.token, r.status + " " + JSON.stringify(r.body).slice(0, 160));
    const reuse = await auth("signup", { email: `inv2-${rnd()}@example.com`, password: newMemberPass(), invite: code });
    ok("a one-use code cannot be used twice", reuse.status === 403, reuse.status);
  }

  // The domain allow-list, shipped 2026-07-29.
  await owner("/access", { method: "POST", body: JSON.stringify({ mode: "open", domains: ["acme.test"] }) });
  r = await auth("signup", { email: `out-${rnd()}@gmail.com`, password: newMemberPass() });
  ok("a domain allow-list refuses an address outside it", r.status === 403 && r.body.code === "domain", r.status + " " + JSON.stringify(r.body));
  r = await auth("signup", { email: `in-${rnd()}@acme.test`, password: newMemberPass() });
  ok("...and admits one inside it", r.status === 200, r.status + " " + JSON.stringify(r.body).slice(0, 160));
  const sub = await auth("signup", { email: `sub-${rnd()}@mail.acme.test`, password: newMemberPass() });
  ok("a SUBDOMAIN does not match", sub.status === 403, sub.status);
  const looka = await auth("signup", { email: `evil-${rnd()}@evil-acme.test`, password: newMemberPass() });
  ok("a lookalike domain does not match", looka.status === 403, looka.status);
  await owner("/access", { method: "POST", body: JSON.stringify({ mode: "open", domains: [] }) });

  // ================================================ second factor: TOTP
  //
  // Everything below this line had unit tests and had never been run against
  // the deployed thing. That is the gap this section and the four after it
  // close: a second factor, the brute-force delay, single sign-on, teams, and
  // passkeys in a real browser.
  section("second factor — authenticator app");
  const tfEmail = `otp-${rnd()}@example.com`, tfPass = newMemberPass();
  const tfSignup = await auth("signup", { email: tfEmail, password: tfPass });
  let tfTok = tfSignup.body.token;
  ok("a member to enrol exists", tfSignup.status === 200 && !!tfTok, tfSignup.status + " " + JSON.stringify(tfSignup.body).slice(0, 160));

  ok("enrolling needs a session", (await auth("totp/start", {})).status === 401);

  const tStart = await auth("totp/start", {}, tfTok);
  const secret = tStart.body.secret;
  ok("an authenticator secret is issued", tStart.status === 200 && /^[A-Z2-7]{20,64}$/.test(String(secret || "")),
    tStart.status + " " + JSON.stringify(tStart.body).slice(0, 200));
  ok("...with an otpauth:// URI a real app can scan",
    String(tStart.body.uri || "").startsWith("otpauth://totp/") && String(tStart.body.uri).includes(`secret=${secret}`),
    String(tStart.body.uri || "").slice(0, 120));

  // Started is NOT enabled. An account must never be gated by a factor its
  // owner has not yet proved they can produce, or enrolling locks them out.
  ok("a wrong code does not turn it on", (await auth("totp/enable", { code: "000000" }, tfTok)).status === 401);
  const preEnable = await auth("login", { email: tfEmail, password: tfPass });
  ok("a started-but-unconfirmed factor does not gate sign-in", preEnable.status === 200 && !!preEnable.body.token,
    preEnable.status + " " + JSON.stringify(preEnable.body).slice(0, 160));
  tfTok = preEnable.body.token || tfTok;

  const enable = await auth("totp/enable", { code: totpAt(secret, Math.floor(Date.now() / 30000)) }, tfTok);
  const recovery = enable.body.recovery || [];
  ok("a code from a real authenticator turns it on", enable.status === 200 && enable.body.ok === true,
    enable.status + " " + JSON.stringify(enable.body).slice(0, 200));
  ok("...and hands over recovery codes, once", recovery.length > 0 && recovery.every((c) => /^[a-z0-9]{5}-[a-z0-9]{5}$/.test(String(c))),
    JSON.stringify(recovery).slice(0, 160));

  // THE assertion of this section. A primary method that succeeds on a 2FA
  // account must return a PENDING token and never a session — a second factor
  // that can be skipped is not a second factor.
  const pend = await auth("login", { email: tfEmail, password: tfPass });
  ok("with 2FA on, the password alone returns a PENDING token, never a session",
    pend.status === 200 && !!pend.body.pending && !pend.body.token && pend.body.need === "totp",
    pend.status + " " + JSON.stringify(pend.body).slice(0, 200));
  ok("the pending token does NOT open the account", (await me(pend.body.pending)).status === 401);

  const live = await freshTotp(secret);
  const verified = await auth("totp/verify", { code: live }, pend.body.pending);
  ok("presenting the code completes the sign-in", verified.status === 200 && !!verified.body.token,
    verified.status + " " + JSON.stringify(verified.body).slice(0, 200));
  let tfSession = verified.body.token;
  ok("...and THAT token is a working session", (await me(tfSession)).status === 200);

  // `verifyTotp` returns the matched step so the caller can store it and refuse
  // a second use. Without that a code stays live for up to 90 seconds.
  const pendAgain = await auth("login", { email: tfEmail, password: tfPass });
  const replay = await auth("totp/verify", { code: live }, pendAgain.body.pending);
  ok("the SAME code cannot be used twice inside its window", replay.status === 401,
    replay.status + " " + JSON.stringify(replay.body).slice(0, 160));

  ok("a session cannot be presented in place of a pending token",
    (await auth("totp/verify", { code: totpAt(secret, Math.floor(Date.now() / 30000)) }, tfSession)).status === 401);

  // ======================================================== recovery codes
  section("recovery codes");
  const rec1 = await auth("login", { email: tfEmail, password: tfPass });
  const usedRec = await auth("totp/verify", { code: recovery[0] }, rec1.body.pending);
  ok("a recovery code stands in for the app", usedRec.status === 200 && !!usedRec.body.token && usedRec.body.recoveryUsed === true,
    usedRec.status + " " + JSON.stringify(usedRec.body).slice(0, 200));
  ok("...and says how many are left", usedRec.body.recoveryLeft === recovery.length - 1,
    `${usedRec.body.recoveryLeft} of ${recovery.length}`);
  tfSession = usedRec.body.token || tfSession;

  const rec2 = await auth("login", { email: tfEmail, password: tfPass });
  const spent = await auth("totp/verify", { code: recovery[0] }, rec2.body.pending);
  ok("a spent recovery code is refused", spent.status === 401, spent.status + " " + JSON.stringify(spent.body).slice(0, 160));

  const regen = await auth("recovery/new", {}, tfSession);
  ok("recovery codes can be regenerated", regen.status === 200 && (regen.body.recovery || []).length > 0,
    regen.status + " " + JSON.stringify(regen.body).slice(0, 160));
  const rec3 = await auth("login", { email: tfEmail, password: tfPass });
  const stale = await auth("totp/verify", { code: recovery[1] }, rec3.body.pending);
  ok("regenerating invalidates the codes somebody may still have on paper", stale.status === 401,
    stale.status + " " + JSON.stringify(stale.body).slice(0, 160));

  // Turning a factor OFF is the first thing somebody with a stolen session
  // would want to do, so it costs the password even though a session is held.
  ok("turning the factor off needs the password", (await auth("totp/disable", { current: "not-it" }, tfSession)).status === 401);
  const off = await auth("totp/disable", { current: tfPass }, tfSession);
  ok("...and with the password, it comes off", off.status === 200, off.status + " " + JSON.stringify(off.body).slice(0, 160));
  const plain = await auth("login", { email: tfEmail, password: tfPass });
  ok("sign-in returns a plain session again", plain.status === 200 && !!plain.body.token && !plain.body.pending,
    plain.status + " " + JSON.stringify(plain.body).slice(0, 160));

  // ==================================================== the brute-force delay
  //
  // The observable is indirect BY DESIGN: a delayed account answers
  // byte-identically to a wrong password, because "try again in 10 minutes"
  // confirms the address is a member here. So what is asserted is that the
  // CORRECT password stops working after enough failures and starts working
  // again on its own — which is the whole behaviour, seen from outside.
  section("brute force — the escalating delay");
  const bfEmail = `bf-${rnd()}@example.com`, bfPass = newMemberPass();
  const bfSignup = await auth("signup", { email: bfEmail, password: bfPass });
  ok("an account to attack exists", bfSignup.status === 200 && !!bfSignup.body.token, bfSignup.status);

  ok("the right password works before any of this", (await auth("login", { email: bfEmail, password: bfPass })).status === 200);

  // Five failures cost nothing; the sixth earns 30 seconds.
  const failures = [];
  for (let i = 0; i < 6; i++) failures.push((await auth("login", { email: bfEmail, password: `wrong-${i}` })).status);
  ok("six wrong passwords are all refused the same way", failures.every((s) => s === 401), JSON.stringify(failures));

  const during = await auth("login", { email: bfEmail, password: bfPass });
  ok("the CORRECT password is now refused too — the delay is in force", during.status === 401,
    during.status + " " + JSON.stringify(during.body).slice(0, 160));
  ok("...and the refusal is byte-identical to a wrong password, not an oracle",
    during.status === wrong.status && JSON.stringify(during.body) === JSON.stringify(wrong.body),
    JSON.stringify(during.body) + " vs " + JSON.stringify(wrong.body));

  // A delay that a human has to clear is a denial of service anyone can aim at
  // anyone. This one ends on its own — which is the half that makes it shippable.
  console.log("   (waiting out the 30s delay — this is the feature, not the test being slow)");
  await sleep(34000);
  const after = await auth("login", { email: bfEmail, password: bfPass });
  ok("the delay ends by itself and the real person gets back in", after.status === 200 && !!after.body.token,
    after.status + " " + JSON.stringify(after.body).slice(0, 160));

  // ================================================== single sign-on (OAuth)
  //
  // The token exchange itself needs a real provider account, which no site has;
  // what CAN be proved on production is the half that is ours, and it is the
  // half where a mistake is a vulnerability rather than an outage — the state
  // token, its provider pin, its kind, PKCE, and the open-redirect guard.
  section("single sign-on — the parts that are ours");
  const idp = "https://idp.invalid.test";
  const cfg = await owner("/access", {
    method: "POST",
    body: JSON.stringify({
      oauth: {
        oidc: {
          client_id: "audit-client-id", client_secret: "audit-client-secret", label: "Acme SSO",
          authorize: `${idp}/authorize`, token: `${idp}/token`, userinfo: `${idp}/userinfo`,
        },
      },
    }),
  });
  ok("an owner can configure a provider", cfg.status === 200, cfg.status + " " + JSON.stringify(await J(cfg)).slice(0, 200));

  const methods = await fetch(authUrl("methods"), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const mList = (await J(methods)).methods || [];
  ok("the sign-in page is offered the configured provider", mList.some((m) => m.name === "oidc"), JSON.stringify(mList));
  ok("...and second factors are NOT offered as a way in", !mList.some((m) => m.name === "totp" || m.name === "recovery"), JSON.stringify(mList));

  const acc2 = await J(await owner("/access"));
  ok("reading the config back never returns the secret",
    !JSON.stringify(acc2).includes("audit-client-secret") && JSON.stringify(acc2).includes("audit-client-id"),
    JSON.stringify(acc2.oauth || {}).slice(0, 200));
  ok("...and it tells the owner the exact redirect URI to register",
    String((acc2.redirectUris || {}).oidc || "").endsWith(`/api/db/${slug}/auth/oauth/oidc/callback`),
    JSON.stringify(acc2.redirectUris || {}));

  // `start` is a real 302 for a browser, not JSON — followed manually so the
  // Location can be read. No network is involved: the provider host does not
  // resolve and does not need to, because everything asserted here is minted
  // by us before anyone is redirected anywhere.
  const startAt = async (next) => {
    const r = await fetch(`${authUrl("oauth/oidc/start")}${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}", redirect: "manual" });
    return { status: r.status, location: r.headers.get("location") || "" };
  };
  const started = await startAt("/account");
  ok("starting a sign-in is a 302 to the provider",
    started.status === 302 && started.location.startsWith(`${idp}/authorize?`),
    started.status + " " + started.location.slice(0, 160));
  const qp = new URLSearchParams(started.location.split("?")[1] || "");
  ok("it carries the OWNER's client_id, so one revocation cannot take down every site",
    qp.get("client_id") === "audit-client-id", qp.get("client_id"));
  ok("PKCE is on, and it is S256",
    qp.get("code_challenge_method") === "S256" && (qp.get("code_challenge") || "").length > 20,
    `${qp.get("code_challenge_method")} ${String(qp.get("code_challenge")).slice(0, 12)}`);
  ok("the redirect_uri is this site's callback, not something a caller chose",
    String(qp.get("redirect_uri") || "").endsWith(`/api/db/${slug}/auth/oauth/oidc/callback`), qp.get("redirect_uri"));
  const state = qp.get("state") || "";
  ok("the state is a signed token, not a random string", state.split(".").length === 2, state.slice(0, 40));

  // POSTed rather than GET: a GET callback lands on an HTML page (a browser
  // arriving from a provider cannot read a JSON body), which collapses every
  // failure to 400. POST answers with the real status and reason.
  const callback = async (provider, params) => {
    const r = await fetch(authUrl(`oauth/${provider}/callback`), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params),
    });
    return { status: r.status, body: await J(r) };
  };
  const noState = await callback("oidc", { code: "abc" });
  ok("a callback with no state is refused", noState.status === 400 && noState.body.code === "state", noState.status + " " + JSON.stringify(noState.body));
  const junkState = await callback("oidc", { code: "abc", state: "not-a-token" });
  ok("a callback with a forged state is refused", junkState.status === 400 && junkState.body.code === "state", junkState.status + " " + JSON.stringify(junkState.body));
  // Without the `use` check a session token would be accepted as state. This is
  // the allow-list that the claim-token work turned `verifySession` into.
  const sessionAsState = await callback("oidc", { code: "abc", state: String(plain.body.token) });
  ok("a SESSION token presented as state is refused",
    sessionAsState.status === 400 && sessionAsState.body.code === "state", sessionAsState.status + " " + JSON.stringify(sessionAsState.body));
  // The pin. Without it, a state minted for a provider the attacker controls
  // replays against one they do not.
  const wrongProvider = await callback("google", { code: "abc", state });
  ok("a state minted for one provider is refused by another", wrongProvider.status >= 400,
    wrongProvider.status + " " + JSON.stringify(wrongProvider.body));

  // The real state with a real-looking code, against a host that does not
  // exist: it must get PAST our checks and fail at the exchange. Without this
  // the refusals above would also pass on a callback that refuses everything.
  const exch = await callback("oidc", { code: "abc", state });
  ok("a VALID state gets past our checks and fails at the provider instead",
    exch.status === 502 && exch.body.code === "exchange", exch.status + " " + JSON.stringify(exch.body).slice(0, 200));

  // The browser-facing shape: HTML, and no token anywhere in the URL — where it
  // would sit in history and in the next page's referrer.
  const landing = await fetch(`${authUrl("oauth/oidc/callback")}?code=abc&state=nope`, { redirect: "manual" });
  const landingHtml = await landing.text();
  ok("a browser arriving at the callback gets a page, not JSON",
    landing.status === 400 && (landing.headers.get("content-type") || "").includes("text/html"),
    landing.status + " " + landing.headers.get("content-type"));
  ok("...which reports the failure instead of signing anyone in",
    landingHtml.includes("expired") && !landingHtml.includes('"token":"ey'), landingHtml.slice(0, 200));

  // The open-redirect guard. `//evil.example` is protocol-relative, which
  // browsers treat as absolute — the one people miss.
  const evil = await startAt("//evil.example/phish");
  const evilState = new URLSearchParams(evil.location.split("?")[1] || "").get("state") || "";
  const landed = (() => { try { return JSON.parse(Buffer.from(evilState.split(".")[0], "base64url").toString()).n; } catch { return null; } })();
  ok("an off-site `next` is reduced to a path on this site", landed === "/", JSON.stringify(landed));

  // ================================================================== teams
  section("teams — the shared read model");
  const tCreate = await owner("/teams", { method: "POST", body: JSON.stringify({ name: "Sales" }) });
  const tCreated = await J(tCreate);
  const teamId = tCreated.team?.id;
  ok("an owner can create a team", tCreate.status === 201 && !!teamId, tCreate.status + " " + JSON.stringify(tCreated).slice(0, 160));
  ok("a team needs a name", (await owner("/teams", { method: "POST", body: JSON.stringify({ name: "  " }) })).status === 400);

  // Two members in the team, one outside it. `deals` is `teamScope`.
  const mem2 = await J(await owner("/members"));
  const idFor = (email) => (mem2.members || []).find((x) => String(x.email) === email)?.id;
  const adaId2 = idFor(m1b), bobId = idFor(m2);
  const outEmail = `solo-${rnd()}@example.com`, outPass = newMemberPass();
  const outSignup = await auth("signup", { email: outEmail, password: outPass });
  const outTok = outSignup.body.token;

  const assignA = await owner(`/members/${adaId2}`, { method: "PATCH", body: JSON.stringify({ team_id: teamId }) });
  const assignB = await owner(`/members/${bobId}`, { method: "PATCH", body: JSON.stringify({ team_id: teamId }) });
  ok("an owner can put members in a team", assignA.status === 200 && assignB.status === 200, `${assignA.status}/${assignB.status}`);

  // Fresh tokens: both accounts have had their sessions churned above.
  const adaTok = (await auth("login", { email: m1b, password: m1pass2 })).body.token;
  const bobTok = (await auth("login", { email: m2, password: m2pass })).body.token;
  const deal = (tok, title) => fetch(`${BASE}/api/db/${slug}/rows/deals`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ title, value: "100" }),
  });
  const readDeals = async (tok) => {
    const r = await fetch(`${BASE}/api/db/${slug}/rows/deals`, { headers: { Authorization: `Bearer ${tok}` } });
    return { status: r.status, rows: (await J(r)).rows || [] };
  };
  const dA = await deal(adaTok, "ada-deal");
  const dOut = await deal(outTok, "solo-deal");
  ok("a team member can write a team-scoped row", dA.status === 201, dA.status + " " + JSON.stringify(await J(dA)).slice(0, 160));
  ok("so can somebody with no team", dOut.status === 201, dOut.status);

  const bobSees = await readDeals(bobTok);
  ok("a team-mate sees the team's rows, not just their own",
    bobSees.status === 200 && bobSees.rows.some((x) => x.title === "ada-deal"),
    bobSees.status + " " + JSON.stringify(bobSees.rows.map((x) => x.title)));

  // The one assertion that matters. Every naive "same team" implementation gets
  // this wrong in the same outward direction — null matching null — and before
  // an owner sets any team up EVERY member is teamless, so the bug shows the
  // whole site each other's records.
  const soloSees = await readDeals(outTok);
  ok("a member with NO team sees ONLY their own rows",
    soloSees.status === 200 && soloSees.rows.length === 1 && soloSees.rows[0].title === "solo-deal",
    soloSees.status + " " + JSON.stringify(soloSees.rows.map((x) => x.title)));
  ok("...and the team cannot see the teamless member's row",
    !bobSees.rows.some((x) => x.title === "solo-deal"), JSON.stringify(bobSees.rows.map((x) => x.title)));

  // A flat team EDITS jointly — this is what separates `teamScope` from
  // `teamRead`, which widens reads only. A tool where a colleague cannot
  // correct a record is not the tool anybody asked for.
  const adaDealId = bobSees.rows.find((x) => x.title === "ada-deal")?.id;
  if (adaDealId != null) {
    const edit = await fetch(`${BASE}/api/db/${slug}/rows/deals/${adaDealId}`, {
      method: "PATCH", headers: { "content-type": "application/json", Authorization: `Bearer ${bobTok}` },
      body: JSON.stringify({ value: "250" }),
    });
    ok("a team-mate can EDIT the team's row, not only read it", edit.status === 200, edit.status + " " + JSON.stringify(await J(edit)).slice(0, 160));
    const outsider = await fetch(`${BASE}/api/db/${slug}/rows/deals/${adaDealId}`, {
      method: "PATCH", headers: { "content-type": "application/json", Authorization: `Bearer ${outTok}` },
      body: JSON.stringify({ value: "0" }),
    });
    ok("somebody outside the team gets 404, not 403", outsider.status === 404, outsider.status);
  }

  const teamList = await J(await owner("/teams"));
  ok("the owner's team list counts its members", (teamList.teams || []).find((t) => t.id === teamId)?.members === 2,
    JSON.stringify(teamList.teams));

  // Deleting a team must release its members FIRST: Postgres reuses identity
  // values, so a dangling team_id would be inherited wholesale by whichever
  // team next takes that id.
  const delTeam = await owner(`/teams/${teamId}`, { method: "DELETE" });
  ok("an owner can delete a team", delTeam.status === 200, delTeam.status);
  const afterDelete = await readDeals(bobTok);
  ok("its members are released, so each sees only their own again",
    afterDelete.rows.length === 1 && !afterDelete.rows.some((x) => x.title === "ada-deal"),
    JSON.stringify(afterDelete.rows.map((x) => x.title)));
  ok("deleting a team that is gone is 404", (await owner(`/teams/${teamId}`, { method: "DELETE" })).status === 404);

  // ================================================== what the visitor sees
  section("the published site, in a real browser");
  // The build returns a RELATIVE url ("/s/<slug>/"), which page.goto refuses as
  // an invalid URL. Absolutised against the base being audited.
  await shoot(new URL(bd.url || `/s/${slug}/`, BASE).toString(), {
    built: bd.page === "app",
    files: bd.files || [],
    member: { email: `shot-${rnd()}@example.com`, password: newMemberPass() },
  });

} catch (e) {
  failed++;
  console.error("\nauth audit threw:", (e && (e.stack || e.message)) || e);
} finally {
  console.log("\ncleaning up…");
  try {
    if (slug && jwt) {
      const d = await fetch(`${BASE}/api/site/${slug}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } });
      console.log("  site deleted:", d.status);
    }
  } catch (e) { console.error("  site delete failed:", e && e.message); }
  // The Neon PROJECT is a capped, billed resource whose only record is a
  // Supabase row — leaking one is a failure this repo has already had twice.
  try {
    if (userId && process.env.NEON_API_KEY) {
      const p = await fetch(`${SUPABASE_URL}/rest/v1/user_site_project?uid=eq.${userId}&select=neon_project`, { headers: svc() });
      const projectId = ((await J(p)) || [])[0]?.neon_project;
      if (projectId) {
        try { await dropUserProject({ NEON_API_KEY: process.env.NEON_API_KEY }, projectId); console.log("  removed the Neon project"); }
        catch { console.log("  WARNING: could not remove Neon project " + projectId); }
      }
    }
  } catch (e) { console.error("  neon cleanup failed:", e && e.message); }
  // Belt and braces: the site delete above already removes this row, but it must
  // go even when that call failed, or the slug stays claimed forever.
  try { if (slug) await fetch(`${SUPABASE_URL}/rest/v1/site_backends?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: svc() }); } catch {}
  try {
    if (userId) {
      await fetch(`${SUPABASE_URL}/rest/v1/user_site_project?uid=eq.${userId}`, { method: "DELETE", headers: svc() });
      const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svc() });
      console.log("  throwaway user removed:", del.status);
    }
  } catch (e) { console.error("  user cleanup failed:", e && e.message); }

  writeReport();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// --------------------------------------------------------------- screenshots

/**
 * The published site, in a real browser, signed out AND signed in.
 *
 * The session is established by calling the auth API from INSIDE the page and
 * writing the token to the key `rows.ts` reads — rather than by hunting for a
 * form and typing into it. Two reasons: the generated markup differs every
 * build, so selector-hunting is a flaky test of the model's layout choices
 * rather than of auth; and doing it this way asserts something real, that the
 * key the client reads is the one a token can actually be stored under. If that
 * convention ever drifts, every generated site silently signs nobody in.
 */
async function shoot(url, { built, files, member } = {}) {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { ok("playwright is available for screenshots", false, "not installed"); return; }
  fs.mkdirSync(SHOTS, { recursive: true });
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    ok("the published site serves 200", !!resp && resp.status() === 200, resp && resp.status());
    // An empty #root means the bundle threw — the page "loads" and shows nothing.
    const rendered = await page.evaluate(() => (document.getElementById("root")?.innerText || "").trim().length);
    ok("the app actually RENDERED (root is not empty)", rendered > 20, "root text length=" + rendered);
    ok("no uncaught error on load", errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: path.join(SHOTS, "01-published-site.png"), fullPage: true });

    // The seeded content is what a visitor came for, and it is also proof the
    // display table was populated at build time. Only meaningful on a real app:
    // the placeholder renders none of it, so asserting here when the build fell
    // back reports one root cause three times.
    const body = await page.evaluate(() => document.body.innerText);
    if (built) {
      ok("seeded content is on the page", /Maya Iyer|Tom Beckett|Ana Ruiz/.test(body), body.slice(0, 300));
      ok("the masked phone is NOT rendered in full", !body.includes("07700900123"), "the raw number reached the page");
    } else {
      console.log("   (build fell back to the placeholder — skipping the content checks rather than");
      console.log("    failing them, since they would report the same root cause a third time)");
    }
    await page.screenshot({ path: path.join(SHOTS, "02-seeded-content.png"), fullPage: true });

    // ---------------------------------------------------- signed in, for real
    // Deliberately NOT gated on `built`. The content checks above are about the
    // generator and cannot pass on a placeholder, so they are skipped when it
    // falls back. These are about AUTH: the placeholder is served from the same
    // origin, by the same Worker, with the same API behind it. Gating them too
    // meant a generator failure silently deleted the browser half of this audit
    // — which is how passkeys and the session-key convention would go untested
    // on exactly the runs where something is already wrong.
    if (member) {
      const created = await page.evaluate(async ({ slug, email, password }) => {
        const r = await fetch(`/api/db/${slug}/auth/signup`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json().catch(() => ({}));
        if (!d.token) return { ok: false, status: r.status, body: d };
        // The exact key `rows.ts` reads. If this convention ever drifts, every
        // generated site signs nobody in and nothing else would notice.
        localStorage.setItem(`site_session_${slug}`, d.token);
        return { ok: true };
      }, { slug, email: member.email, password: member.password });
      ok("a member can be signed in from inside the published page", created.ok, JSON.stringify(created));

      if (created.ok) {
        await page.reload({ waitUntil: "networkidle", timeout: 60000 });
        await page.screenshot({ path: path.join(SHOTS, "03-signed-in.png"), fullPage: true });

        // NOT "the page looks different signed in" — a timetable page can
        // legitimately render the same either way, and that assertion fails on a
        // correct site. What has to hold is that the token under this key is
        // usable: a `user` table answers 401 without one and the member's own
        // rows with it. Read straight out of localStorage, so it also proves the
        // key the client writes is the key a request can be built from.
        const scoped = await page.evaluate(async (slug) => {
          const t = localStorage.getItem(`site_session_${slug}`);
          const r = await fetch(`/api/db/${slug}/rows/my_notes`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
          return { status: r.status, hadToken: !!t };
        }, slug);
        ok("the stored session actually opens a member-scoped read", scoped.status === 200, JSON.stringify(scoped));

        // ...and that the app's own bundle reads that same key. If this
        // convention ever drifts, every generated site stores a session nothing
        // looks at and signs nobody in, silently.
        const reads = await page.evaluate(async () => {
          // Resolved against the document, not used raw: the site is served from
          // /s/<slug>/ and a root-relative src read the wrong way answers 404,
          // which is indistinguishable from "the key is missing" unless the two
          // are reported apart.
          const srcs = [...document.querySelectorAll("script[src]")]
            .map((x) => new URL(x.getAttribute("src"), document.baseURI).toString());
          let fetched = 0;
          for (const src of srcs) {
            try {
              const r = await fetch(src);
              if (!r.ok) continue;
              fetched++;
              if ((await r.text()).includes("site_session_")) return { found: true, scripts: srcs.length, fetched };
            } catch { /* next */ }
          }
          return { found: false, scripts: srcs.length, fetched };
        });
        // Only a real answer counts as a failure. Reading NO bundle at all is
        // this check not working, and reporting that as "the key is missing"
        // would be a false alarm on an otherwise-correct site — which is exactly
        // what the first version did.
        // This one IS about the generated app — the placeholder has no client
        // API in it and would fail the check for a reason that is not a defect.
        if (!built) {
          console.log("   (placeholder — skipping the bundle key check, which is a claim about the generated app)");
        } else if (reads.fetched > 0) {
          ok("the published bundle reads the session key the platform writes", reads.found,
            "no bundle references `site_session_` — a stored session would be ignored: " + JSON.stringify(reads));
        } else {
          console.log("   (could not read any bundle — skipping the key check rather than", JSON.stringify(reads) + ")");
        }

        await passkeyPass(page);

        // Whatever routes the generator actually wrote — an account page, a
        // members area, a timetable. Named from the build response rather than
        // guessed, so this follows the site instead of assuming its shape.
        let n = 4;
        for (const f of (files || []).slice(0, 4)) {
          const route = String(f).replace(/^src\/routes\//, "").replace(/\.tsx$/, "");
          if (route === "index" || route === "__root") continue;
          try {
            const r2 = await page.goto(new URL(route, url + "/").toString(), { waitUntil: "networkidle", timeout: 45000 });
            if (!r2 || r2.status() >= 400) continue;
            await page.screenshot({ path: path.join(SHOTS, `${String(n).padStart(2, "0")}-${route}.png`), fullPage: true });
            n++;
          } catch { /* a route that does not resolve is the generator's business, not this test's */ }
        }
      }
    }
    console.log("   screenshots ->", SHOTS);
  } catch (e) {
    ok("the browser pass completed", false, (e && e.message) || String(e));
  } finally { await browser.close().catch(() => {}); }
}

/**
 * Passkeys, in a real browser, with a real WebAuthn ceremony.
 *
 * The unit suite drives `site-webauthn.mjs` with an authenticator I wrote — a
 * generated P-256 key and hand-built attestation objects. That proves the
 * parser, and it cannot prove that Chrome and this server agree: the CBOR a
 * real authenticator emits, the DER a real signature is wrapped in, the exact
 * origin and rpId a browser puts in clientData. Chromium's virtual
 * authenticator is the real implementation with the hardware removed, so
 * everything above the key material is genuine.
 *
 * rpId is the Worker's own hostname and the site is served from a path on it,
 * so the published origin is the RP origin — no configuration needed and none
 * assumed here.
 */
async function passkeyPass(page) {
  let cdp;
  try {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2", transport: "internal",
        hasResidentKey: true, hasUserVerification: true,
        isUserVerified: true, automaticPresenceSimulation: true,
      },
    });
  } catch (e) {
    ok("a virtual authenticator is available", false, (e && e.message) || String(e));
    return;
  }

  const out = await page.evaluate(async (slug) => {
    const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const post = async (route, body, tok) => {
      const r = await fetch(`/api/db/${slug}/auth/${route}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify(body || {}),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const token = localStorage.getItem(`site_session_${slug}`);
    const res = { origin: location.origin };
    try {
      // ------------------------------------------------------------ enrol
      const st = await post("passkey/register/start", {}, token);
      res.startStatus = st.status;
      if (st.status !== 200) return res;
      const o = st.body;
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: unb64u(o.challenge),
          rp: o.rp,
          user: { id: unb64u(o.user.id), name: o.user.name, displayName: o.user.displayName },
          pubKeyCredParams: o.pubKeyCredParams,
          excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })),
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          timeout: 30000,
        },
      });
      const fin = await post("passkey/register/finish", {
        label: "Audit key",
        response: {
          clientDataJSON: b64u(cred.response.clientDataJSON),
          attestationObject: b64u(cred.response.attestationObject),
        },
      }, token);
      res.registerStatus = fin.status;
      res.registerBody = fin.body;

      // The same challenge a second time: spent before it is used, so a
      // ceremony that fails cannot be retried against forever.
      const replay = await post("passkey/register/finish", {
        response: {
          clientDataJSON: b64u(cred.response.clientDataJSON),
          attestationObject: b64u(cred.response.attestationObject),
        },
      }, token);
      res.registerReplayStatus = replay.status;

      // ----------------------------------------------------------- sign in
      // No account is named — a discoverable credential says who this is.
      const ls = await post("passkey/login/start", {});
      res.loginStartStatus = ls.status;
      const assertion = await navigator.credentials.get({
        publicKey: { challenge: unb64u(ls.body.challenge), rpId: ls.body.rpId, userVerification: "required", timeout: 30000 },
      });
      const lf = await post("passkey/login/finish", {
        challenge: ls.body.challenge,
        credentialId: b64u(assertion.rawId),
        response: {
          clientDataJSON: b64u(assertion.response.clientDataJSON),
          authenticatorData: b64u(assertion.response.authenticatorData),
          signature: b64u(assertion.response.signature),
        },
      });
      res.loginStatus = lf.status;
      res.gotSession = !!lf.body.token;
      if (lf.body.token) {
        const m = await fetch(`/api/db/${slug}/auth/me`, { headers: { Authorization: `Bearer ${lf.body.token}` } });
        res.meStatus = m.status;
      }

      // A captured assertion, replayed. The challenge is single-use.
      const lr = await post("passkey/login/finish", {
        challenge: ls.body.challenge,
        credentialId: b64u(assertion.rawId),
        response: {
          clientDataJSON: b64u(assertion.response.clientDataJSON),
          authenticatorData: b64u(assertion.response.authenticatorData),
          signature: b64u(assertion.response.signature),
        },
      });
      res.loginReplayStatus = lr.status;

      // ------------------------------------------------- listed, and removed
      const list = await post("identities", {}, token);
      res.listed = (list.body.passkeys || []).length;
      res.listedLabel = (list.body.passkeys || [])[0]?.label;
      const keyId = (list.body.passkeys || [])[0]?.id;
      // Removing the only passkey on an account that still has a password is
      // allowed; removing the last way in of any kind is not.
      const rm = await post("passkey/remove", { id: keyId }, token);
      res.removeStatus = rm.status;
      const rmAgain = await post("passkey/remove", { id: keyId }, token);
      res.removeAgainStatus = rmAgain.status;
    } catch (e) {
      res.threw = String((e && e.message) || e).slice(0, 300);
    }
    return res;
  }, slug);

  ok("a passkey can be enrolled from the published site", out.registerStatus === 200, JSON.stringify(out).slice(0, 400));
  ok("...and the browser's real attestation is accepted", !!out.registerBody?.credentialId, JSON.stringify(out.registerBody || {}).slice(0, 200));
  ok("a registration challenge cannot be used twice", out.registerReplayStatus === 400, out.registerReplayStatus);
  ok("a passkey signs in with no account named", out.loginStatus === 200 && out.gotSession === true, JSON.stringify(out).slice(0, 400));
  ok("...and the session it mints is a working one", out.meStatus === 200, out.meStatus);
  ok("a captured assertion cannot be replayed", out.loginReplayStatus === 400, out.loginReplayStatus);
  ok("the passkey is listed on the account", out.listed === 1 && out.listedLabel === "Audit key", JSON.stringify({ n: out.listed, label: out.listedLabel }));
  ok("a passkey can be removed", out.removeStatus === 200, out.removeStatus);
  ok("removing it twice is 404, not a silent success", out.removeAgainStatus === 404, out.removeAgainStatus);
  if (out.threw) ok("the passkey ceremony completed without throwing", false, out.threw);
}

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) for (const rel of rels) {
      const p = path.join(root, dir, rel);
      if (fs.existsSync(p)) found.push(p);
    }
  } catch { /* let playwright resolve its own */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}

// A readable record of the run, committed next to the screenshots so the result
// is reviewable without opening a CI log.
function writeReport() {
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    const lines = ["# Auth layer — production audit", "", `Run against \`${BASE}\` · ${passed} passed, ${failed} failed.`, ""];
    for (const x of results) {
      if (x.section) { lines.push("", `## ${x.section}`, ""); continue; }
      lines.push(`- ${x.pass ? "✅" : "❌"} ${x.name}${x.pass ? "" : ` — \`${x.extra}\``}`);
    }
    lines.push("", "## The published site", "", "![published](01-published-site.png)", "", "![content](02-seeded-content.png)", "");
    fs.writeFileSync(path.join(SHOTS, "README.md"), lines.join("\n"));
  } catch (e) { console.error("report write failed:", e && e.message); }
}
