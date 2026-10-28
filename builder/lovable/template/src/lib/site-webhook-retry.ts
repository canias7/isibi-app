// THIS SITE'S OWN WEBHOOK RETRIES (2026-10-27). A delivery that failed in a way
// worth retrying is kept in the site's own bucket (`webhooks/q/<event>.json`)
// and tried again with the platform's own backoff and dead-lettering rules
// (`./effects/site-webhook-queue.mjs`, copied byte for byte), the exact bytes
// first sent. The platform's clock wakes the site (`/__gf/tick`); the site does
// the rest with its owner's own secret.
import { fireHooks, fireSchedules, type FnEnv } from "./site-functions";
import { enqueueRow, drainQueue, queueFull, claimable, MAX_PENDING_PER_SITE, LEASE_MS } from "./effects/site-webhook-queue.mjs";
import { deliverWebhook, signPayload, retryable } from "./effects/site-webhooks.mjs";
import { blockedReason } from "./effects/site-ssrf.mjs";
import { runDueJobs, type JobEnv } from "./site-jobs-run";

type Obj = { text(): Promise<string>; etag?: string };
type Listed = { objects: { key: string; uploaded?: Date }[]; truncated: boolean; cursor?: string };
export type QueueBucket = {
  get(k: string): Promise<Obj | null>;
  put(k: string, v: string, o?: unknown): Promise<unknown>;
  delete(k: string): Promise<unknown>;
  list(o: { prefix: string; cursor?: string; limit?: number }): Promise<Listed>;
};
export type RetryEnv = { SITES?: QueueBucket; OWN_BUCKET?: string; [name: string]: unknown };
type Row = Record<string, unknown> & { event_id: string; status: string; attempts: number; body: string; table_name: string; action: string };
const PREFIX = "webhooks/q/";
const DEAD_PREFIX = "webhooks/dead/";
const own = { "x-site-data": "own" };
const keyOf = (id: string) => PREFIX + String(id).replace(/[^A-Za-z0-9_-]/g, "") + ".json";

function webhookSecrets(env: RetryEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (/^WEBHOOK[A-Z0-9_]*$/.test(k) && typeof v === "string" && v) out[k] = v;
  return out;
}

async function listRows(B: QueueBucket, max: number): Promise<{ row: Row; etag?: string }[]> {
  const out: { row: Row; etag?: string }[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10 && out.length < max; i++) {
    const page = await B.list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const o of page.objects) {
      if (out.length >= max) break;
      const got = await B.get(o.key);
      if (!got) continue;
      try { out.push({ row: JSON.parse(await got.text()) as Row, etag: got.etag }); } catch { /* unreadable: skipped */ }
    }
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  return out;
}

/** Keep a failed delivery for later, if it is worth retrying and the queue has room. */
export async function queueFailed(env: RetryEnv, { slug, table, action, out }:
  { slug: string; table: string; action: string; out: { sent?: boolean; body?: string; status?: number | null; error?: string; reason?: string; attempts?: number; eventId?: string } }): Promise<string | null> {
  // THE SITE'S OWN BUCKET ONLY: on the shared one another site would drain
  // this queue and send it to its own endpoint with its own secret.
  const B = env.OWN_BUCKET === "1" ? env.SITES : undefined;
  if (!B || !out || out.sent || !out.body || !out.eventId || !retryable(out.status ?? null)) return null;
  let pending = 0;
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await B.list({ prefix: PREFIX, cursor, limit: 1000 });
    pending += page.objects.length;
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  if (queueFull(pending)) return "not queued: this site already has " + MAX_PENDING_PER_SITE + " deliveries waiting";
  const row = enqueueRow({ ownerId: "owner", eventId: out.eventId, slug, table, action, body: out.body,
    status: out.status, error: out.error || out.reason, attempts: out.attempts || 1, now: Date.now() });
  await B.put(keyOf(out.eventId), JSON.stringify(row), { onlyIf: { etagDoesNotMatch: "*" } });
  return "queued for retry";
}

/** Try every due delivery once; a delivered one is removed, a dead one kept 30 days for the owner. */
export async function drainOwnQueue(env: RetryEnv, slug: string): Promise<Record<string, unknown>> {
  const B = env.OWN_BUCKET === "1" ? env.SITES : undefined;
  if (!B) return { skipped: "no bucket" };
  const etags = new Map<string, string | undefined>();
  return drainQueue({
    due: async (now: number, max: number) => {
      const all = await listRows(B, max);
      for (const { row, etag } of all) etags.set(row.event_id, etag);
      return all.map((x) => x.row).filter((r) => claimable(r, now, LEASE_MS));
    },
    claim: async (row: Row, now: number) => {
      const etag = etags.get(row.event_id);
      if (!etag) return false;
      const got = await B.put(keyOf(row.event_id), JSON.stringify({ ...row, status: "delivering", claimed_at: new Date(now).toISOString() }), { onlyIf: { etagMatches: etag } });
      return !!got;
    },
    deliver: (row: Row) => deliverWebhook({
      firesFor: () => true,
      loadSecrets: async () => webhookSecrets(env),
      blockedReason: (u: string) => blockedReason(u),
      sign: (secret: string, body: string, ts: number) => signPayload(secret, body, ts),
      tooMany: async () => false,
      post: (url: string, init: RequestInit) => fetch(url, { ...init, redirect: "manual" }),
    }, { slug, table: row.table_name, action: row.action, row: null, now: Date.now(), eventId: row.event_id, body: row.body }),
    finish: async (row: Row, patch: Record<string, unknown>) => {
      if (patch.status === "done") { await B.delete(keyOf(row.event_id)); return; }
      // A dead delivery leaves the queue (so it no longer counts against the
      // cap) and is kept apart for the owner, for 30 days.
      if (patch.status === "dead") {
        await B.put(DEAD_PREFIX + keyOf(row.event_id).slice(PREFIX.length), JSON.stringify({ ...row, ...patch, claimed_at: null }));
        await B.delete(keyOf(row.event_id));
        return;
      }
      await B.put(keyOf(row.event_id), JSON.stringify({ ...row, ...patch, claimed_at: null }));
    },
    retryable: (s: number | null) => retryable(s),
  }, { now: Date.now() });
}

/** `POST /__gf/tick`, sent only by the platform's clock. */
export async function siteTick(request: Request, env: RetryEnv, url: URL, slug: string, header: string): Promise<Response | null> {
  if (url.pathname !== "/__gf/tick" || request.method !== "POST" || request.headers.get(header) !== "1") return null;
  // The site's own scheduled jobs first: what is due, claimed in its own table.
  const jobs = await runDueJobs(env as unknown as JobEnv).catch(() => ({ ran: 0 }));
  const webhooks = await drainOwnQueue(env, slug).catch((e) => ({ error: String((e && e.message) || e).slice(0, 200) }));
  // The site's own server code hooked to the clock (2026-10-28).
  const hooks = await fireHooks(env as unknown as FnEnv, slug, "tick").catch(() => 0);
  const schedules = await fireSchedules(env as unknown as FnEnv, slug).catch(() => 0);
  // Dead deliveries older than 30 days go — from the site's own bucket only.
  if (env.OWN_BUCKET === "1") try {
    const cut = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const page = await env.SITES!.list({ prefix: DEAD_PREFIX, limit: 1000 });
    for (const o of page.objects) if (o.uploaded && o.uploaded.getTime() < cut) await env.SITES!.delete(o.key);
  } catch { /* next tick */ }
  return Response.json({ ok: true, jobs, webhooks, hooks, schedules }, { headers: own });
}
