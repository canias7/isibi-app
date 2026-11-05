// WHO IS ASKING (2026-11-05): the same Supabase sign-in as the website builder,
// checked by Coder's own Worker. `{ id }` for a signed-in user, `null` otherwise.
export async function authUser(request, env, { fetchFn = fetch } = {}) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetchFn(env.SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: env.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && typeof u.id === "string" ? { id: u.id, email: typeof u.email === "string" ? u.email : "" } : null;
  } catch { return null; }
}
