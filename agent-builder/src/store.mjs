/**
 * THE SUPABASE STORE — where a run's log is kept, so a run can be resumed.
 *
 * `fetch` IS INJECTED, so every branch below is drivable without a network and
 * without a database. The real thing talks to PostgREST; the tests hand in a
 * function.
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

  return {
    /**
     * Start a run's row. ONLY `id` and `tenant_id` are written: everything else
     * about a run is derived from its log by the database, so there is nothing
     * here that could disagree with the entries.
     */
    async createRun({ id, tenant }) {
      if (typeof id !== "string" || id.trim() === "") throw new TypeError("createRun: id must be a non-empty string");
      if (typeof tenant !== "string" || tenant.trim() === "") throw new TypeError("createRun: tenant must be a non-empty string");
      const r = await req("POST", RUNS, { body: { id, tenant_id: tenant }, write: true, prefer: "return=minimal" });
      // A REPEATED CREATE IS NOT AN ERROR, for the same reason a repeated append
      // is not: the caller cannot know which side of the commit its connection
      // died on. The primary key makes the second one a no-op.
      if (!r.ok && duplicateKind(r.body) === null && r.body?.code !== DUPLICATE) throw fail("createRun", r);
      return { id, tenant };
    },

    /**
     * A journal for one run — `append` is exactly what `runAgent` takes.
     *
     * `seq` is this journal's own counter, starting where `load` left off. It is
     * an ordering, not an identity: the logical rules in the schema are the
     * identity, which is why a collision on `seq` can simply move up.
     */
    journalFor({ runId, seq = 0 }) {
      if (typeof runId !== "string" || runId.trim() === "") throw new TypeError("journalFor: runId must be a non-empty string");
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
              // counter is behind after a resume. Move up and try once. If the
              // entry really is a duplicate, the logical rule above catches it on
              // this second attempt, so this cannot write the same entry twice.
              next = at + 1;
              continue;
            }
            throw fail("append", r);
          }
          throw new Error("append: the position was taken twice running");
        },
      };
    },

    /**
     * Read a run back: its entries in order, the replayed state, and where the
     * next entry goes.
     *
     * The replay is done HERE rather than left to the caller so that `problems`
     * cannot be skipped by accident — a log with problems is one that must not be
     * resumed, and handing back a bare array invites somebody to pass it straight
     * to `runAgent` without looking.
     */
    async load(runId) {
      if (typeof runId !== "string" || runId.trim() === "") throw new TypeError("load: runId must be a non-empty string");
      const q = `${ENTRIES}?run_id=eq.${encodeURIComponent(runId)}&select=seq,body&order=seq.asc`;
      const r = await req("GET", q);
      if (!r.ok) throw fail("load", r);
      const rows = Array.isArray(r.body) ? r.body : [];
      const entries = rows.map((row) => row.body);
      // `nextSeq` comes from the HIGHEST seq stored, not from the row count: a
      // retention delete or a gap would make a count-based answer collide with an
      // entry that is still there.
      const nextSeq = rows.length ? Math.max(...rows.map((row) => row.seq)) + 1 : 0;
      const state = replay(entries);
      return { runId, entries, nextSeq, state, limits: limitsFromJson(state.limits) };
    },

    /** The runs a tenant could resume: started and not stopped. */
    async resumable(tenant, { limit = 50 } = {}) {
      if (typeof tenant !== "string" || tenant.trim() === "") throw new TypeError("resumable: tenant must be a non-empty string");
      const q = `${RUNS}?tenant_id=eq.${encodeURIComponent(tenant)}&status=eq.running`
        + `&select=id,tenant_id,agent_name,model,limits,created_at&order=created_at.asc&limit=${Number(limit) || 50}`;
      const r = await req("GET", q);
      if (!r.ok) throw fail("resumable", r);
      return (Array.isArray(r.body) ? r.body : []).map((row) => ({ ...row, limits: limitsFromJson(row.limits) }));
    },
  };
}
