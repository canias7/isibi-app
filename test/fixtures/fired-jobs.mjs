// A JOB FIRED INTO THE SITE'S CONTAINER, RUN WITH THE ENV A CONTAINER JOB HAS
// (2026-10-16).
//
// The fired-job cases before this ran the container's side
// (`runContainerJob`) with the Worker's own `env`, so a switch the Worker
// read but never handed to a job looked present in every case. That is how
// `DRAFT_FIRST` reached no container job without one test noticing.
//
// Here the launch the Worker really sent (`/job/run`'s body) goes through the
// container's own reader (`readLaunch`), and the job's env keeps NO string
// from the Worker's env: every string comes from the launch's secrets, as in
// `makeContainerEnv`. Bindings (the bucket, the queue, the dispatch stub) are
// the platform's stand-ins, where a real container has its gateway shims; the
// Supabase pair stays because a container's env carries a marker for each.
import { readLaunch } from "../../builder/container-job.mjs";
import { jobSecrets } from "../../builder/edit-job.mjs";

/** The names a container env sets itself (`makeContainerEnv`), not from the launch. */
const CONTAINER_OWN = ["SUPABASE_SERVICE_KEY", "CREDITS_MINT_SECRET"];

/** The env a job child builds from `launchBody` (a `/job/run` body), over the platform's bindings. */
export function containerEnvOf(workerEnv, launchBody) {
  const launch = readLaunch(typeof launchBody === "string" ? launchBody : JSON.stringify(launchBody));
  const env = {};
  for (const [k, v] of Object.entries(workerEnv)) if (typeof v !== "string" || CONTAINER_OWN.includes(k)) env[k] = v;
  for (const [k, v] of Object.entries(launch.secrets)) env[k] = v;
  return env;
}

/** A launch the way `fireContainerJob` shapes it, for an env with no fire to capture. */
export function launchFor(workerEnv, { kind = "edit", id = "job-handoff-0001" } = {}) {
  return JSON.stringify({
    v: 2, kind, id,
    gateway: { url: "https://gofarther.dev/api/job/" + id, token: "t" },
    sb: { url: "https://sb.example.co" },
    secrets: jobSecrets(workerEnv),
    buildPort: 8080,
    deadlineAt: Date.now() + 60_000,
  });
}

/** A container namespace that takes every `/job/run` and keeps its body; other paths go to `fallback`. */
export function firingNamespace(fallback = null) {
  const launches = [];
  return {
    launches,
    idFromName: (n) => n,
    get: (lane) => ({
      fetch: async (req) => {
        const url = new URL(String(req.url || req));
        if (url.pathname === "/job/run") { launches.push({ lane, body: await req.text() }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
        if (fallback) return fallback(lane).fetch(req);
        return new Response("not set up", { status: 503 });
      },
    }),
  };
}
