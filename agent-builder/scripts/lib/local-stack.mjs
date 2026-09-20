/**
 * THE LOCAL STACK — a throwaway PostgreSQL with this repository's migrations applied, the
 * PostgREST-shaped shim over it, and the Worker's own handlers wired to both.
 *
 * **EXTRACTED BECAUSE THERE ARE TWO VERIFICATIONS NOW, and two copies of this would
 * drift.** The drift would be in the direction that matters most: one script standing up a
 * database with one set of roles and the other with another, both reporting green about
 * different things. It is a fixture, so the rule from `CLAUDE.md` applies — derive it from
 * the real producer, and where it is deliberately LESS capable than production, say so.
 *
 * **WHAT IS SIMULATED, IN ONE PLACE: the HTTP translation and the queue's TRANSPORT.**
 * PostgREST is `scripts/local-rest.mjs`, because writing to the hosted project needs a
 * service credential; and Cloudflare Queues is not reachable from a laptop, so the binding
 * hands a run id straight to `worker.queue`. **Durability is unchanged, because the work is
 * a ROW** — every claim, lease, fence and sweep is the database's.
 *
 * ⚠ NOTHING HERE IS A STATEMENT ABOUT THE DEPLOYMENT. It never touches the hosted project.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** Is there a cluster `su postgres` can reach? A missing one is not a failing product. */
export function haveCluster() {
  try {
    execFileSync("su", ["postgres", "-c", "psql -X -tAc 'select 1'"], { stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch { return false; }
}

/**
 * THE MIGRATIONS, IN THE ORDER POSTGRES WILL SEE THEM — sorted filenames, read once here so
 * nothing else in the tree has a second copy of "read the folder and sort it".
 */
export const MIGRATIONS = Object.freeze(
  fs.readdirSync(path.join(DIR, "supabase", "migrations")).filter((x) => x.endsWith(".sql")).sort(),
);

/**
 * Apply ONE migration file.
 *
 * ⚠ **IT IS COPIED TO A READABLE PLACE FIRST.** `su postgres` cannot read this session's
 * directory, and `psql -f` on an unreadable file fails in a way that reads like a broken
 * migration rather than like a permission.
 */
export function applyMigration(su, db, file) {
  const tmp = path.join("/tmp", `local-stack-${process.pid}-${file}`);
  fs.copyFileSync(path.join(DIR, "supabase", "migrations", file), tmp);
  fs.chmodSync(tmp, 0o644);
  try { su(`psql -X -q -v ON_ERROR_STOP=1 -d ${db} -f ${tmp}`); }
  finally { fs.rmSync(tmp, { force: true }); }
}

/**
 * Stand the whole thing up.
 *
 * `roles` are created the way the PLATFORM has them, not the way a fresh cluster does —
 * **`service_role` carries `BYPASSRLS` on Supabase**, and the first version of a harness in
 * this repository created it without, so the writer was refused by the very policies it is
 * exempt from and forty checks failed for a reason that does not exist in production.
 */
export async function standUp({ db, quiet = false, upTo = null } = {}) {
  if (!db) throw new TypeError("standUp: db is required");
  const su = (cmd) => execFileSync("su", ["postgres", "-c", cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const q = (sql) => su(`psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -c ${shq(sql)}`).trim();
  const say = (...a) => { if (!quiet) console.log(...a); };

  say(`\nsetting up ${db} from the real migrations`);
  su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${db};`)} -c ${shq(`create database ${db};`)}`);
  su(`psql -X -q -d ${db} -c ${shq(`do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
alter role authenticated nologin nobypassrls;
alter role service_role  nologin bypassrls;
alter role anon          nologin nobypassrls;`)}`);

  // ⚠ `upTo` STOPS AFTER THE NAMED MIGRATION, and it is REFUSED rather than ignored when
  // it names none. A caller asking for a schema this tree has not got wants that state
  // exactly; applying every file instead would report the check it is about as green
  // having stood up the wrong database. Default `null` is every file, so every other
  // caller is byte for byte what it was.
  if (upTo !== null && !MIGRATIONS.some((f) => f.startsWith(upTo))) {
    throw new Error(`standUp: upTo ${JSON.stringify(upTo)} names no migration in this tree`);
  }
  const applied = [];
  for (const f of MIGRATIONS) {
    applyMigration(su, db, f);
    applied.push(f);
    if (upTo !== null && f.startsWith(upTo)) break;
  }
  say(`  ${applied.length} migration(s) applied`);

  const { startLocalRest } = await import("../local-rest.mjs");
  const rest = await startLocalRest({ db });
  say(`  local rest on ${rest.url}`);

  return {
    su, q, rest, applied,
    /** Apply one more migration onto this database, the way a rollout does. */
    apply: (file) => applyMigration(su, db, file),
    /** Drop the database and stop the shim. Always in a `finally`. */
    async tearDown() {
      await rest.close?.();
      su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${db};`)}`);
    },
  };
}

/**
 * The dispatcher: the Worker's own handlers, with the queue as an in-process doorbell.
 *
 * ⚠ **THE BINDING RECORDS WHAT IT WAS RUNG WITH AND DELIVERS IT SEPARATELY**, which is the
 * one thing a laptop cannot have for real — and separating the two is what lets a check
 * assert that everything was committed BEFORE anything ran.
 */
export function dispatcher({ worker, rest, model = "stand-in" }) {
  const rung = [];
  const delivered = [];
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
  const env = {
    SUPABASE_URL: rest.url,
    SUPABASE_SERVICE_KEY: "local-service-role",
    SUPABASE_PUBLISHABLE_KEY: "local-publishable",
    MODEL: model,
    RUN_QUEUE: { send: async ({ runId }) => { rung.push(runId); } },
  };
  /** Hand one run id to the REAL consumer handler, the way a delivery does. */
  const deliver = async (runId) => {
    let acked = 0;
    await worker.queue({ messages: [{ body: { runId }, ack: () => { acked++; }, retry: () => {} }] }, env, ctx);
    delivered.push(runId);
    return acked;
  };
  /** Drain everything the doorbell has collected, exactly as the queue would. */
  const drain = async () => { const ids = rung.splice(0); for (const id of ids) await deliver(id); return ids; };
  /** What a route is handed as its `ring`. */
  const ring = async (runId) => { await env.RUN_QUEUE.send({ runId }); };
  /** One cron tick: the sweeper, the schedule and the due-resume statement. */
  const tick = async () => { await worker.scheduled({}, env, ctx); };
  return { env, ctx, rung, delivered, deliver, drain, ring, tick };
}
