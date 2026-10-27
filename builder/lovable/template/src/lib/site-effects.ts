// WHAT FOLLOWS A VISITOR'S SUBMISSION, RUN BY THIS SITE'S OWN WORKER
// (2026-10-27, the site Worker split; owner: "have the site worker do that").
//
// The owner's "new submission" email, the confirmation to the visitor, the
// text message and the webhook: the same code the platform ran (copied into
// `./effects/` by builder/gen-site-effects.mjs, byte for byte), with what it
// needs given to this site at publish and to no other site:
//
//   - the owner's OWN provider keys (mail, SMS, webhook), as secrets;
//   - the owner's email address and whether they asked to be told;
//   - the site's form settings (which table confirms, texts, notifies);
//   - the site's LIMITED database login, to read the saved row and run the
//     site's own wording functions.
//
// Nothing here holds a key of the platform's. Every sender's failure is its
// own: the visitor's submission has already been saved either way.
import { runRowEffects, resolveCreatedRow } from "./effects/site-row-effects.mjs";
import { notifyOwner, COOLDOWN_MS } from "./effects/site-notify.mjs";
import { sendConfirmation, pickProvider } from "./effects/site-mail.mjs";
import { sendSms, SMS_SECRET_NAMES } from "./effects/site-sms.mjs";
import { deliverWebhook, firesFor, signPayload } from "./effects/site-webhooks.mjs";
import { blockedReason } from "./effects/site-ssrf.mjs";
import { postProviderEmail, postProviderSms } from "./effects/site-providers.mjs";

type Obj = { text(): Promise<string> };
export type EffectEnv = {
  APP_CONN?: string;
  OWNER_EMAIL?: string;
  NOTIFY?: string;
  SITE_TABLES?: string;
  SITES?: { get(k: string): Promise<Obj | null>; put(k: string, v: string): Promise<unknown>; delete?(k: string): Promise<unknown> };
  [name: string]: unknown;
};
type Ctx = { waitUntil(p: Promise<unknown>): void };

const MAIL_NAMES = ["RESEND_KEY", "SENDGRID_KEY", "POSTMARK_KEY", "EMAIL_FROM"];

/** The named secrets this site was given, as a plain map. */
export function secretsOf(env: EffectEnv, names: string[] | ((n: string) => boolean)): Record<string, string> {
  const ok = typeof names === "function" ? names : (n: string) => (names as string[]).includes(n);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (ok(k) && typeof v === "string" && v) out[k] = v;
  return out;
}

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

/** The table's own settings, from what this site was given at publish. */
export function tableDef(env: EffectEnv, table: string): Record<string, unknown> | null {
  try {
    const all = JSON.parse(String(env.SITE_TABLES || "[]")) as Record<string, unknown>[];
    return all.find((t) => String(t.name).toLowerCase() === table) || null;
  } catch { return null; }
}

const ACTIONS: Record<string, string> = { POST: "created", PATCH: "updated", PUT: "updated", DELETE: "deleted" };

export async function runSiteEffects(env: EffectEnv, ctx: Ctx | undefined, { slug, method, path, search, sent, body }:
  { slug: string; method: string; path: string; search: string; sent: string; body: string }): Promise<string[]> {
  const action = ACTIONS[method];
  const table = path.split("/")[0].toLowerCase();
  const def = action ? tableDef(env, table) : null;
  if (!def) return [];
  const conn = typeof env.APP_CONN === "string" ? env.APP_CONN : "";
  const lookup = (q: string, p: unknown[]) => (conn ? siteSql(conn, q, p) : Promise.resolve([]));
  let row: unknown = null;
  if (action === "deleted") row = { filter: String(search || "").replace(/^\?/, "").slice(0, 500) };
  else if (action === "created") row = await resolveCreatedRow({ def, body, sent, lookup }).catch(() => null);
  else {
    try { const j = JSON.parse(body); row = Array.isArray(j) ? j[0] : j; } catch { /* not json */ }
    if (!row) { try { row = JSON.parse(sent || "null"); } catch { row = null; } }
  }
  const later = (p: Promise<unknown>) => { const q = p.catch(() => {}); if (ctx) ctx.waitUntil(q); };
  const callFn = async (name: string, rowId: unknown) => {
    if (rowId == null || !conn || !/^[a-z][a-z0-9_]{0,40}$/.test(String(name))) return null;
    const rows = await siteSql(conn, `SELECT "${name}"(?) AS out`, [rowId]);
    const out = rows && rows[0] && rows[0].out;
    return typeof out === "string" ? JSON.parse(out) : out;
  };
  // Ten-minute "already told this address" memory, in the site's own bucket.
  const seen = (kind: string) => ({
    recentlySent: async (s: string, to: string) => {
      try { const o = await env.SITES?.get("effects/" + kind + "/" + s + "/" + to); return !!o && Date.now() - Number(await o.text()) < 600_000; } catch { return false; }
    },
    markSent: async (s: string, to: string) => { try { await env.SITES?.put("effects/" + kind + "/" + s + "/" + to, String(Date.now())); } catch { /* best effort */ } },
  });

  return runRowEffects({
    notify: (r: unknown) => later(notifyOwner({
      // The cooldown: one email per five minutes, remembered in the site's own bucket.
      claim: async (s: string) => {
        if (env.NOTIFY !== "1") return { ok: false };
        const key = "effects/notify/" + s;
        const prior = await env.SITES?.get(key).catch(() => null);
        if (prior && Date.now() - Number(await prior.text()) < COOLDOWN_MS) return { ok: false };
        const at = String(Date.now());
        await env.SITES?.put(key, at);
        return { ok: true, owner_uid: "owner", at };
      },
      unclaim: async (s: string) => { try { await env.SITES?.delete?.("effects/notify/" + s); } catch { /* lapses */ } },
      emailOf: async () => (typeof env.OWNER_EMAIL === "string" && env.OWNER_EMAIL) || null,
      ready: async () => {
        const secrets = secretsOf(env, MAIL_NAMES);
        const picked = pickProvider(secrets);
        const from = String(secrets.EMAIL_FROM || "").trim();
        if (!picked) throw new Error("no mail provider key in this site's Secrets");
        if (!from) throw new Error("no EMAIL_FROM in this site's Secrets");
        return { picked, from };
      },
      send: async ({ to, subject, html }: { to: string; subject: string; html: string }, m: { picked: { provider: string; key: string }; from: string }) =>
        postProviderEmail(m.picked.provider, m.picked.key, m.from, to, subject, html),
    }, { slug, table, access: def, method: "POST", row: r })),
    confirm: (r: unknown) => later(sendConfirmation({
      loadSecrets: async () => secretsOf(env, MAIL_NAMES),
      send: ({ provider, key, from, to, subject, html }: Record<string, string>) => postProviderEmail(provider, key, from, to, subject, html),
      ...seen("confirm"),
      callFn,
    }, { def, row: r, slug })),
    sms: (r: unknown) => later(sendSms({
      loadSecrets: async () => secretsOf(env, SMS_SECRET_NAMES as string[]),
      send: ({ provider, key, secret, from, to, body: b }: Record<string, string>) => postProviderSms(provider, key, secret, from, to, b),
      ...seen("sms"),
      callFn,
    }, { def, row: r, slug })),
    webhook: (a: string, r: unknown) => later(deliverWebhook({
      firesFor: (x: string) => firesFor(def, x),
      loadSecrets: async () => secretsOf(env, (n) => /^WEBHOOK[A-Z0-9_]*$/.test(n)),
      blockedReason: (u: string) => blockedReason(u),
      sign: (secret: string, b: string, ts: number) => signPayload(secret, b, ts),
      tooMany: async () => false,
      post: (url: string, init: RequestInit) => fetch(url, { ...init, redirect: "manual" }),
    }, { slug, table, action: a, row: r, now: Date.now(), eventId: crypto.randomUUID() })),
  }, { def, action, row: row || {}, submission: method === "POST" });
}
