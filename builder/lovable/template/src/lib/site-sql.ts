// ONE QUERY ON THIS SITE'S OWN DATABASE, as its limited login, over Neon's
// HTTP endpoint (2026-10-27). Its own file so every handler can use it without
// importing another handler.
/** `?` placeholders to `$1…`, outside quotes — the platform's rule. */
export function toPg(sql: string): string {
  let n = 0, q: string | null = null, out = "";
  for (const ch of sql) {
    if (q) { if (ch === q) q = null; out += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; out += ch; continue; }
    out += ch === "?" ? "$" + ++n : ch;
  }
  return out;
}

/** One query on this site's own database, as its limited login, over Neon's HTTP endpoint. */
export async function siteSql(conn: string, sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const host = new URL(conn.replace(/^postgres(ql)?:/, "https:")).hostname;
  const r = await fetch("https://" + host + "/sql", {
    method: "POST",
    headers: { "content-type": "application/json", "Neon-Connection-String": conn },
    body: JSON.stringify({ query: toPg(sql), params }),
  });
  if (!r.ok) throw new Error("sql " + r.status);
  const j = (await r.json()) as { rows?: Record<string, unknown>[] };
  return j.rows || [];
}

