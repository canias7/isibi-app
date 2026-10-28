// THIS SITE'S SCHEDULED JOBS, KEPT AND RUN BY ITS OWN WORKER (2026-10-27).
//
// The list lives in the site's own database (`_jobs`: what runs when, whether
// the owner paused it, how its last run went). When the platform's clock wakes
// the site, it picks what is due with the platform's own rules
// (`./effects/site-jobs.mjs`, copied byte for byte), claims each run in its own
// table so two wakes never send twice, runs the site's own function, sends with
// its owner's own mail and SMS keys, and writes the result for the owner's
// panel. `POST /__gf/job` is the owner's "run now", passed on by the platform.
import { runJob, dueJobs, jobOutcome, claimFilter, MAX_JOBS_PER_TICK } from "./effects/site-jobs.mjs";
import { recipient, pickProvider } from "./effects/site-mail.mjs";
import { pickSmsProvider, toE164 } from "./effects/site-sms.mjs";
import { postProviderEmail, postProviderSms } from "./effects/site-providers.mjs";
import { siteSql } from "./site-sql";

export type JobEnv = { APP_CONN?: string; SITE_SPEC?: string; [name: string]: unknown };
/** Set only by the platform's own clock and panel; stripped from every request it forwards. */
export const JOB_HEADER = "x-gf-site-job";
const own = { "x-site-data": "own" };
type Row = { name: string; spec: { fn?: string; on?: string } | string; schedule_minutes?: number | null; enabled?: boolean; last_run?: string | null; last_result?: string | null; updated_at?: string | null };

function secrets(env: JobEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k) && typeof v === "string" && v) out[k] = v;
  return out;
}
const specOf = (r: Row) => (typeof r.spec === "string" ? (() => { try { return JSON.parse(r.spec as string); } catch { return {}; } })() : r.spec || {});

/** The jobs the site holds, as the scheduler reads them. */
export async function readJobs(conn: string): Promise<Row[]> {
  const rows = (await siteSql(conn, "SELECT name, spec, schedule_minutes, enabled, last_run, last_result, updated_at FROM _jobs ORDER BY name", [])) as unknown as Row[];
  return (rows || []).map((r) => ({ ...r, spec: specOf(r) }));
}

/** One run: claimed in the site's own table (nothing ran in between), then done, then written down. */
export async function runOneJob(env: JobEnv, conn: string, row: Row) {
  const out = await runJob({
    // THE CLAIM: the stamp moves only if nobody moved it since this row was read.
    // A one-time job is claimed only while it has never run.
    stamp: async (r: Row) => {
      // `claimFilter` is the platform's one statement of the condition (the
      // selector and the claim must agree on it): `last_run=is.null` or
      // `last_run=eq.<the stamp this row was read with>`.
      const cond = new URLSearchParams(String(claimFilter(r)).replace(/^&/, "")).get("last_run") || "";
      const now = new Date().toISOString();
      const got = cond === "is.null"
        ? await siteSql(conn, "UPDATE _jobs SET last_run=? WHERE name=? AND last_run IS NULL RETURNING name", [now, r.name])
        : cond.startsWith("eq.")
          ? await siteSql(conn, "UPDATE _jobs SET last_run=? WHERE name=? AND last_run=? RETURNING name", [now, r.name, cond.slice(3)])
          : [];
      return { won: !!(got && got.length) };
    },
    callFn: async (fn: string) => {
      // A job the site no longer declares stays in the table (the owner's
      // history) but never runs.
      let spec: { jobs?: { name?: string; fn?: string }[] } | null = null;
      try { spec = JSON.parse(String(env.SITE_SPEC || "null")); } catch { spec = null; }
      if (spec && !(Array.isArray(spec.jobs) ? spec.jobs : []).some((j) => j && j.name === row.name && j.fn === fn)) return { jobsSkip: "this job is no longer part of the site" };
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(String(fn))) return { jobsSkip: "the function has an unusable name" };
      const got = await siteSql(conn, `SELECT "${fn}"() AS out`, []);
      const v = got && got[0] && got[0].out;
      if (typeof v !== "string") return v;
      try { return JSON.parse(v); } catch { return { jobsSkip: "the function returned text that is not valid JSON" }; }
    },
    credentials: async () => {
      const s = secrets(env);
      const picked = pickProvider(s);
      if (!picked) return null;
      if (!String(s.EMAIL_FROM || "").trim()) return { missing: "EMAIL_FROM" };
      return { provider: picked.provider, key: picked.key, from: s.EMAIL_FROM };
    },
    send: ({ provider, key, from, to, subject, html }: Record<string, string>) => postProviderEmail(provider, key, from, to, subject, html),
    smsCredentials: async () => {
      const s = secrets(env);
      const picked = pickSmsProvider(s);
      const from = String(s.SMS_FROM || "").trim();
      if (!picked || !from) return null;
      const sender = toE164(from) || (/^[A-Za-z0-9 ]{1,11}$/.test(from) ? from : null);
      if (!sender) return null;
      return { provider: picked.provider, key: picked.key, secret: picked.secret, from: sender };
    },
    sendSms: ({ provider, key, secret, from, to, body }: Record<string, string>) => postProviderSms(provider, key, secret, from, to, body),
    phone: (v: unknown) => toE164(v),
    recipient,
  }, row);
  if (!out.skipped) await siteSql(conn, "UPDATE _jobs SET last_result=? WHERE name=?", [String(jobOutcome(out)).slice(0, 400), row.name]).catch(() => {});
  return out;
}

/** Everything due now, at most the platform's per-tick number. */
export async function runDueJobs(env: JobEnv): Promise<{ ran: number }> {
  if (!env.APP_CONN) return { ran: 0 };
  const conn = env.APP_CONN as string;
  let rows: Row[] = [];
  try { rows = await readJobs(conn); } catch { return { ran: 0 }; }
  let ran = 0;
  for (const row of dueJobs(rows.filter((r) => r.schedule_minutes != null), Date.now()).slice(0, MAX_JOBS_PER_TICK)) {
    await runOneJob(env, conn, row);
    ran++;
  }
  return { ran };
}

/** `POST /__gf/job {name}`: the owner's "run now", passed on by the platform. */
export async function siteJob(request: Request, env: JobEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== "/__gf/job" || request.method !== "POST" || request.headers.get(JOB_HEADER) !== "1") return null;
  if (!env.APP_CONN) return null;
  const conn = env.APP_CONN as string;
  let name = "";
  try { name = String(((await request.json()) as { name?: string }).name || ""); } catch { name = ""; }
  const row = (await readJobs(conn).catch(() => [] as Row[])).find((r) => r.name === name && r.schedule_minutes != null);
  if (!row) return Response.json({ ok: false, reason: "no such job" }, { status: 404, headers: own });
  return Response.json(await runOneJob(env, conn, row), { headers: own });
}
