// THE OWNER'S OWN KEYS, AND ONLY THEM (2026-10-28). The site's Worker also holds
// values the platform gave it to run: its database login, its own addresses,
// its settings. Those are never the owner's to send anywhere — a connection
// declared as `?c={{APP_CONN}}` must not mail the site's database login to a
// stranger. Everything here is the owner's: every uppercase secret except these.
export const PLATFORM_GIVEN = new Set([
  "APP_CONN", "DATA_API_BASE", "AUTH_BASE", "OWN_BUCKET", "NOTIFY", "OWNER_EMAIL",
  "SITE_TABLES", "SITE_SPEC", "SITES",
]);

export function ownerKeys(env: Record<string, unknown>, names?: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const want = names ? new Set(names) : null;
  for (const [k, v] of Object.entries(env)) {
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(k) || PLATFORM_GIVEN.has(k) || typeof v !== "string" || !v) continue;
    if (want && !want.has(k)) continue;
    out[k] = v;
  }
  return out;
}
