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
  else { failed++; console.log(`  FAIL ${name}${extra ? "  -> " + String(extra).slice(0, 300) : ""}`); }
  results.push({ name, pass: !!cond, extra: cond ? "" : String(extra ?? "").slice(0, 300) });
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
const auth = async (action, body, token) => {
  const r = await fetch(authUrl(action), {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  return { status: r.status, body: await J(r) };
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
  ok("every declared table was created", (bd.tables || []).length === 4, JSON.stringify(bd.tables));
  ok("the display table was seeded", (bd.seeded || {}).teachers > 0, JSON.stringify(bd.seeded));
  ok("a real app was published, not the placeholder", bd.page === "app",
    `page=${bd.page} stage=${bd.stage || "-"} error=${bd.error || "-"} problems=${JSON.stringify(bd.problems || [])}`);
  console.log("   url:", bd.url, "| page:", bd.page, "| files:", JSON.stringify(bd.files || []));

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
  const other = (listed.sessions || []).find((s) => !s.current);
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

  // ================================================== what the visitor sees
  section("the published site, in a real browser");
  await shoot(bd.url || `${BASE}/s/${slug}/`);

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

async function shoot(url) {
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
    // display table was populated at build time.
    const body = await page.evaluate(() => document.body.innerText);
    ok("seeded content is on the page", /Maya Iyer|Tom Beckett|Ana Ruiz/.test(body), body.slice(0, 200));
    // ...and the masked column must not be readable in the rendered page either.
    ok("the masked phone is NOT rendered in full", !body.includes("07700900123"), "the raw number reached the page");
    await page.screenshot({ path: path.join(SHOTS, "02-seeded-content.png"), fullPage: true });
    console.log("   screenshots ->", SHOTS);
  } catch (e) {
    ok("the browser pass completed", false, (e && e.message) || String(e));
  } finally { await browser.close().catch(() => {}); }
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
