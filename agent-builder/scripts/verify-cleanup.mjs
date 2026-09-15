#!/usr/bin/env node
/**
 * REMOVE ANY THROWAWAY CUSTOMER A VERIFICATION LEFT BEHIND.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/verify-cleanup.mjs
 *
 * `verify-live.mjs` deletes its own, but a run that dies half way through is
 * exactly when cleanup matters and exactly when it does not happen — so this runs
 * unconditionally after it, and sweeps up anything from an earlier failure too.
 *
 * **IT MATCHES ON THE PREFIX AND NOTHING ELSE.** A cleanup that deleted by any
 * broader rule would be a script with the service key that can remove a real
 * customer, which is not a thing worth having for tidiness.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SVC = process.env.SUPABASE_SERVICE_KEY ?? "";
const PREFIX = "agent-verify-";
const DOMAIN = "@example.com";

if (!SUPABASE_URL || !SVC) { console.error("need SUPABASE_URL and SUPABASE_SERVICE_KEY"); process.exit(2); }

const admin = (path, init = {}) => fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
  ...init, headers: { apikey: SVC, authorization: `Bearer ${SVC}`, ...(init.headers ?? {}) },
});

const res = await admin("users?per_page=200");
if (!res.ok) { console.error(`listing users: HTTP ${res.status}`); process.exit(1); }
const body = await res.json();
const users = Array.isArray(body?.users) ? body.users : [];

// BOTH HALVES OF THE NAME, so a real customer who happens to start with the prefix
// on their own domain is never in scope.
const mine = users.filter((u) => typeof u.email === "string"
  && u.email.startsWith(PREFIX) && u.email.endsWith(DOMAIN));

console.log(`${users.length} users listed, ${mine.length} left by a verification`);
let failed = 0;
for (const u of mine) {
  const r = await admin(`users/${u.id}`, { method: "DELETE" });
  console.log(`  ${r.ok ? "removed" : `FAILED (HTTP ${r.status})`}  ${u.email}`);
  if (!r.ok) failed++;
}
// NOTHING TO DO IS A SUCCESS. The ordinary case is that `verify-live.mjs` already
// removed its own, and a cleanup that failed for having nothing to clean would make
// every green run red.
process.exit(failed === 0 ? 0 : 1);
