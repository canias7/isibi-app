/**
 * THE SUPABASE STORE — where a run's log is kept, so a run can be resumed.
 *
 * `fetch` IS INJECTED, so every branch below is drivable without a network and
 * without a database. The real thing talks to PostgREST; the tests hand in a
 * function.
 *
 * THE TENANT IS A CLOSURE, NOT AN ARGUMENT, and that is the whole shape of this
 * module's security. `makeRunStore(...)` gives back ONE method, `forTenant`, and
 * every operation comes from the object that returns. There is no unscoped door to
 * reach for by mistake: no call takes a tenant, so **a tenant id in a request body
 * cannot become authority even by accident** — there is nowhere to put it. The
 * tenant handed to `forTenant` must come from a VERIFIED token, and that is the
 * one obligation this module cannot check for its caller.
 *
 * AND A JOURNAL CANNOT BE OBTAINED WITHOUT PASSING THE OWNERSHIP CHECK. `create`
 * and `open` are the only sources of one, and both authorise first. A
 * `journalFor(runId)` that anybody could call would be a way to append to another
 * tenant's log, so it does not exist.
 *
 * NOTHING IN HERE DECIDES ANYTHING ABOUT A RUN. It writes entries and reads them
 * back. The schema is in `supabase/migrations/` and IT is where the guarantees
 * live — one `started` per run, one model answer per step, one result per tool
 * slot, and no entry editable once written. This module's job is to speak to that
 * correctly and to read its refusals the right way round.
 *
 * WHY A REFUSED DUPLICATE IS A SUCCESS HERE, which is the one thing worth
 * understanding before changing this file. A journal append can be retried: the
 * network drops after Postgres committed but before the answer came back, and the
 * caller has no way to know which side of the commit it died on. If the store
 * treated the resulting duplicate-key refusal as an error, that retry would kill a
 * run that is perfectly fine — and the run had already paid for the model call
 * whose answer is in that entry. So the four LOGICAL uniqueness rules in the
 * schema are read as "this is already recorded", which turns them from an
 * obstacle into the thing that makes retrying safe at all.
 *
 * AND THAT ONLY WORKS BECAUSE EVERY KIND HAS A LOGICAL RULE. `started` and
 * `stopped` are unique per run, a model answer is unique per step, a tool result
 * is unique per slot — so a duplicate can never slip in at a different `seq`.
 * That is what lets a `seq` collision be retried at the next `seq` without any
 * risk of writing the same entry twice: if it really is the same entry, the
 * logical rule catches it; if it is not, the new position is correct.
 */

import { replay, limitsFromJson } from "./journal.mjs";

const RUNS = "runs";
const ENTRIES = "run_entries";

/** The uniqueness rules that mean "this exact entry is already recorded". */
export const LOGICAL_UNIQUE = Object.freeze([
  "entries_one_started",
  "entries_one_stopped",
  "entries_one_model_per_step",
  "entries_one_tool_per_slot",
]);

/** The positional key. A collision here says "that slot is taken", not "this entry exists". */
export const POSITION_UNIQUE = "run_entries_pkey";

/** Postgres's duplicate-key SQLSTATE. */
export const DUPLICATE = "23505";

/**
 * Which kind of duplicate an error body describes: `"logical"`, `"position"`, or
 * `null` for "not a duplicate at all".
 *
 * REFUSES TO GUESS. A duplicate whose constraint we do not recognise answers
 * `null` and is therefore raised rather than swallowed — reading an unknown
 * refusal as "already recorded" would silently drop a real entry, which is the
 * one outcome this whole module exists to prevent.
 */
export function duplicateKind(body) {
  if (body === null || typeof body !== "object") return null;
  if (body.code !== DUPLICATE) return null;
  const text = `${body.message ?? ""} ${body.details ?? ""}`;
  if (LOGICAL_UNIQUE.some((c) => text.includes(c))) return "logical";
  if (text.includes(POSITION_UNIQUE)) return "position";
  return null;
}

/**
 * `makeRunStore({ fetch, url, key, schema })`
 *
 * `key` is the service key: this is the writer, and it runs server-side. A
 * tenant's own reads go through the client with its own JWT, where the row-level
 * policies in the migration decide what it can see.
 */
export function makeRunStore(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeRunStore: fetch must be a function");
  if (typeof opts.url !== "string" || opts.url.trim() === "") throw new TypeError("makeRunStore: url must be a non-empty string");
  if (typeof opts.key !== "string" || opts.key.trim() === "") throw new TypeError("makeRunStore: key must be a non-empty string");
  const base = opts.url.replace(/\/+$/, "");
  const schema = typeof opts.schema === "string" && opts.schema.trim() !== "" ? opts.schema : "agent";

  // The schema is not `public`, so PostgREST is told which one per request. This
  // is the one deployment detail the store carries: the schema must be in
  // Supabase's exposed-schemas setting for these headers to be honoured.
  const headers = (write) => ({
    "apikey": opts.key,
    "authorization": `Bearer ${opts.key}`,
    "content-type": "application/json",
    [write ? "content-profile" : "accept-profile"]: schema,
  });

  async function req(method, path, { body, write = false, prefer } = {}) {
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      method,
      headers: prefer ? { ...headers(write), prefer } : headers(write),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = typeof res.text === "function" ? await res.text() : "";
    let parsed = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
    return { ok: !!res.ok, status: res.status, body: parsed, text };
  }

  // A FAILURE THAT NAMES ITSELF. A thrown store error carries the status and the
  // server's own words, because "could not save" with nothing after it is the
  // shape that costs an afternoon.
  function fail(what, r) {
    const why = r.body?.message ?? r.text ?? "";
    const e = new Error(`${what}: HTTP ${r.status}${why ? ` — ${why}` : ""}`);
    e.status = r.status;
    e.body = r.body;
    return e;
  }

  /**
   * NOT FOUND, NEVER FORBIDDEN. A run belonging to somebody else and a run that
   * does not exist answer the SAME error, because the difference between them is
   * information: "forbidden" tells a stranger that the id they guessed is real.
   */
  function notFound(runId) {
    const e = new Error(`run ${runId} not found`);
    e.code = "not-found";
    e.status = 404;
    return e;
  }

  return {
    /**
     * Scope every operation to one tenant.
     *
     * **`tenant` MUST COME FROM A VERIFIED TOKEN.** It is the authority for
     * everything below, and this module cannot check where its caller got it —
     * which is exactly why nothing below takes a tenant of its own.
     */
    forTenant(tenant) {
      if (typeof tenant !== "string" || tenant.trim() === "") {
        throw new TypeError("forTenant: tenant must be a non-empty string, from a verified token");
      }

      /**
       * A journal for one run. PRIVATE: reachable only through `create` or
       * `open`, both of which have already established that this tenant owns the
       * run. `seq` is this journal's own ordering, starting where the stored log
       * left off — an ordering and not an identity, which is why a collision on it
       * can simply move up.
       */
      function journalFor(runId, seq) {
        let next = Number.isInteger(seq) && seq >= 0 ? seq : 0;
        return {
          get seq() { return next; },
          async append(entry) {
            for (let attempt = 0; attempt < 2; attempt++) {
              const at = next;
              const r = await req("POST", ENTRIES, {
                body: { run_id: runId, seq: at, body: entry }, write: true, prefer: "return=minimal",
              });
              if (r.ok) { next = at + 1; return { seq: at, stored: true }; }

              const dup = duplicateKind(r.body);
              if (dup === "logical") {
                // Already recorded. The retry that produced this was safe, and
                // saying so is what keeps a network blip from ending a paid run.
                next = at + 1;
                return { seq: at, stored: false, already: true };
              }
              if (dup === "position" && attempt === 0) {
                // That slot is taken by something else — most likely this journal's
                // counter is behind. Move up and try once. If the entry really is a
                // duplicate, the logical rule above catches it on the second
                // attempt, so this cannot write the same entry twice.
                next = at + 1;
                continue;
              }
              throw fail("append", r);
            }
            throw new Error("append: the position was taken twice running");
          },
        };
      }

      /** Does this tenant own this run? The ownership check, and the only one. */
      async function owns(runId) {
        if (typeof runId !== "string" || runId.trim() === "") throw new TypeError("runId must be a non-empty string");
        // BOTH filters in ONE request. Reading the run and then comparing its
        // tenant in JavaScript would be the same question asked in a place where
        // forgetting the comparison still compiles.
        const q = `${RUNS}?id=eq.${encodeURIComponent(runId)}&tenant_id=eq.${encodeURIComponent(tenant)}`
          + `&select=id,status,agent_name,model,limits,stop,created_at`;
        const r = await req("GET", q);
        if (!r.ok) throw fail("owns", r);
        const rows = Array.isArray(r.body) ? r.body : [];
        return rows.length ? rows[0] : null;
      }

      return {
        tenant,

        /**
         * Start a run. ONLY `id` and `tenant_id` are written — everything else
         * about a run is derived from its log by the database, so there is nothing
         * here that could disagree with the entries. The tenant comes from the
         * scope and cannot be passed.
         */
        async create(runId) {
          if (typeof runId !== "string" || runId.trim() === "") throw new TypeError("create: runId must be a non-empty string");
          const r = await req("POST", RUNS, { body: { id: runId, tenant_id: tenant }, write: true, prefer: "return=minimal" });
          // A REPEATED CREATE IS NOT AN ERROR, for the same reason a repeated
          // append is not: the caller cannot know which side of the commit its
          // connection died on. The primary key makes the second one a no-op.
          if (!r.ok && r.body?.code !== DUPLICATE) throw fail("create", r);
          // ...BUT A REPEAT MUST NOT HAND THIS TENANT SOMEBODY ELSE'S RUN. The
          // primary key is on the id ALONE, so a duplicate could be another
          // tenant's run with the same id, and answering with a journal for it
          // would be the leak this whole file is built to prevent.
          if (!r.ok && !(await owns(runId))) throw notFound(runId);
          return { runId, tenant, journal: journalFor(runId, 0) };
        },

        /**
         * Authorise, load, and hand back everything needed to resume: the entries,
         * the replayed state, the decoded limits, and a journal positioned after
         * the last stored entry.
         *
         * The replay happens HERE rather than being left to the caller so that
         * `problems` cannot be skipped by accident — a log with problems must not
         * be resumed, and a bare array invites passing it straight to `runAgent`.
         */
        async open(runId) {
          const run = await owns(runId);
          if (!run) throw notFound(runId);
          const q = `${ENTRIES}?run_id=eq.${encodeURIComponent(runId)}&select=seq,body&order=seq.asc`;
          const r = await req("GET", q);
          if (!r.ok) throw fail("open", r);
          const rows = Array.isArray(r.body) ? r.body : [];
          const entries = rows.map((row) => row.body);
          // `nextSeq` comes from the HIGHEST seq stored, not from the row count: a
          // gap would make a count-based answer collide with an entry still there.
          const nextSeq = rows.length ? Math.max(...rows.map((row) => row.seq)) + 1 : 0;
          const state = replay(entries);
          return {
            runId, tenant, run, entries, nextSeq, state,
            limits: limitsFromJson(state.limits),
            journal: journalFor(runId, nextSeq),
          };
        },

        /** The same authorised read, without a journal — for showing a run. */
        async load(runId) {
          const { journal, ...rest } = await this.open(runId);
          return rest;
        },

        /** This tenant's runs that could be resumed: started and not stopped. */
        async resumable({ limit = 50 } = {}) {
          const q = `${RUNS}?tenant_id=eq.${encodeURIComponent(tenant)}&status=eq.running`
            + `&select=id,agent_name,model,limits,created_at&order=created_at.asc&limit=${Number(limit) || 50}`;
          const r = await req("GET", q);
          if (!r.ok) throw fail("resumable", r);
          return (Array.isArray(r.body) ? r.body : []).map((row) => ({ ...row, limits: limitsFromJson(row.limits) }));
        },
      };
    },
  };
}
