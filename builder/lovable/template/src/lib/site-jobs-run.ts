// THIS SITE'S SCHEDULED JOBS, RUN BY ITS OWN WORKER (2026-10-27). The platform
// keeps only the clock: when a job is due it claims the run and asks this
// Worker to do it. The site's own database function decides who to tell; the
// owner's own mail and SMS keys send it. `runJob` is the platform's own
// (`./effects/site-jobs.mjs`, copied byte for byte); the claim already
// happened, so its stamp here always wins.
import { runJob } from "./effects/site-jobs.mjs";
import { recipient, pickProvider } from "./effects/site-mail.mjs";
import { pickSmsProvider, toE164 } from "./effects/site-sms.mjs";
import { postProviderEmail, postProviderSms } from "./effects/site-providers.mjs";
import { siteSql } from "./site-effects";

export type JobEnv = { APP_CONN?: string; SITE_SPEC?: string; [name: string]: unknown };
/** Set only by the platform's own tick; stripped from every request it forwards. */
export const JOB_HEADER = "x-gf-site-job";
const own = { "x-site-data": "own" };

function secrets(env: JobEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k) && typeof v === "string" && v) out[k] = v;
  return out;
}

export async function siteJob(request: Request, env: JobEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== "/__gf/job" || request.method !== "POST" || request.headers.get(JOB_HEADER) !== "1") return null;
  if (!env.APP_CONN) return null;
  const conn = env.APP_CONN as string;
  let row: { name?: string; spec?: { fn?: string } };
  try { row = (await request.json()) as typeof row; } catch { return Response.json({ ok: false, reason: "bad request" }, { status: 400, headers: own }); }
  const out = await runJob({
    stamp: async () => ({ won: true }),
    callFn: async (fn: string) => {
      let spec: { jobs?: { name?: string; fn?: string }[] } | null = null;
      try { spec = JSON.parse(String(env.SITE_SPEC || "null")); } catch { spec = null; }
      const declared = (spec && Array.isArray(spec.jobs) ? spec.jobs : []).some((j) => j && j.name === row.name && j.fn === fn);
      if (!declared) return { jobsSkip: "this job is no longer part of the site" };
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
  return Response.json(out, { headers: own });
}
