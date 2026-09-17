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
 * **A JOURNAL NEEDS BOTH THE OWNERSHIP CHECK AND THE CLAIM (2026-09-15).** It used
 * to need only the first: `open` authorised the tenant and handed back something
 * that could POST rows into `agent.run_entries` directly. That was enough to keep
 * one tenant out of another's log and not enough to keep one WORKER out of a run
 * another worker now holds — and the difference was measured live, where a consumer
 * whose lease had been revoked kept writing for a further 30 seconds because it only
 * learns at its next beat.
 *
 * So there is no direct insert here any more, and that is not a convention: the
 * service role has no INSERT privilege on the log at all. Every append goes through
 * `agent.append_entry`, which locks the work row and checks the holder, the token,
 * that the work is unfinished and that the lease is live IN THE SAME TRANSACTION as
 * the insert. `appendEntry` is injected for the same reason `fetch` is — this module
 * owns reading the log and the ownership boundary, and `work.mjs` owns speaking to
 * the queue's RPCs. Two modules speaking one RPC family would be two copies of it.
 *
 * NOTHING IN HERE DECIDES ANYTHING ABOUT A RUN. It reads entries and hands writes
 * to the fence. The schema is in `supabase/migrations/` and IT is where the
 * guarantees live — one `started` per run, one model answer per step, one result per
 * tool slot, no entry editable once written, and no write without a live claim.
 * This module's job is to speak to that correctly and to read its refusals the
 * right way round.
 *
 * WHY A REFUSED DUPLICATE IS A SUCCESS HERE, which is the one thing worth
 * understanding before changing this file. A journal append can be retried: the
 * network drops after Postgres committed but before the answer came back, and the
 * caller has no way to know which side of the commit it died on. If the store
 * treated that as an error, the retry would kill a run that is perfectly fine — and
 * the run had already paid for the model call whose answer is in that entry. So
 * `already` — the SAME entry, byte for byte, found in its logical slot — is a
 * success and the run carries on.
 *
 * **AND `conflict` IS THE OPPOSITE ANSWER AND MUST NEVER BE READ AS `already`.** A
 * DIFFERENT entry in the same logical slot is not a retry; it is two writers, and
 * no re-send can explain it. Reading the second as the first is how a double
 * execution disappears from the record, so the two are kept apart all the way up:
 * the database compares the bodies, and this module raises one and absorbs the
 * other.
 */

import { replay, limitsFromJson } from "./journal.mjs";
import { profileFor } from "./rest-profile.mjs";

const RUNS = "runs";
const ENTRIES = "run_entries";

/** Postgres's duplicate-key SQLSTATE. What a repeated `create` comes back as. */
export const DUPLICATE = "23505";

/**
 * How many times an append may move up after being told its position is taken.
 *
 * ONE, and that is arithmetic rather than taste: the fence looks for the entry's
 * LOGICAL slot before it looks at the position, so a `position` answer already
 * means "this exact entry is not in the log". Moving up once therefore lands on a
 * free slot unless something else took that one too in between — and a second
 * `position` in a row is a counter so far behind that guessing again is worse than
 * saying so.
 */
export const POSITION_RETRIES = 1;

/**
 * The refusals that mean THIS WORKER MAY NOT WRITE. Mirrors `LOST_CLAIM` in
 * `work.mjs`; a test compares the two lists, because the same fact in two modules
 * is the shape that drifts.
 *
 * **NOTHING IN THIS FILE READS IT, and that is deliberate rather than an oversight.**
 * The journal raises every refusal the same way (see `append` below), so the list has
 * no work to do here; where it DECIDES something is `runner.mjs`, which uses it to
 * tell "the claim is gone, stop" from "the journal is broken, retry". It is exported
 * from here because this is the module that speaks to the fence.
 */
export const CLAIM_GONE = Object.freeze(["no-work", "finished", "not-holder", "bad-token", "lease-expired"]);

/**
 * `makeRunStore({ fetch, url, key, schema, appendEntry })`
 *
 * `key` is the service key: this is the READER, and it runs server-side. A
 * tenant's own reads go through the client with its own JWT, where the row-level
 * policies in the migration decide what it can see.
 *
 * **`appendEntry` IS REQUIRED, and a store without one is refused rather than
 * built.** It is the fence — `work.append` — and it is the only way an entry can be
 * written, so a store missing it could authorise, read and replay a run and then
 * silently be unable to record a single thing about it. That failure would surface
 * several steps later wearing a journal error's clothes, which is precisely the
 * shape this product keeps finding in other people's code.
 */
export function makeRunStore(opts = {}) {
  const doFetch = opts.fetch;
  if (typeof doFetch !== "function") throw new TypeError("makeRunStore: fetch must be a function");
  if (typeof opts.url !== "string" || opts.url.trim() === "") throw new TypeError("makeRunStore: url must be a non-empty string");
  if (typeof opts.key !== "string" || opts.key.trim() === "") throw new TypeError("makeRunStore: key must be a non-empty string");
  if (typeof opts.appendEntry !== "function") throw new TypeError("makeRunStore: appendEntry must be a function — the fenced writer");
  const appendEntry = opts.appendEntry;
  const base = opts.url.replace(/\/+$/, "");
  const schema = typeof opts.schema === "string" && opts.schema.trim() !== "" ? opts.schema : "agent";

  // The schema is not `public`, so PostgREST is told which one per request. This
  // is the one deployment detail the store carries: the schema must be in
  // Supabase's exposed-schemas setting for these headers to be honoured.
  // ⚠ THE PROFILE COMES FROM THE METHOD, THROUGH `rest-profile.mjs` — one rule for all
  // five stores. This one was already right (its GETs read and its one POST writes), and
  // it is here so that no store decides for itself; a census asserts that.
  const headers = (method) => ({
    "apikey": opts.key,
    "authorization": `Bearer ${opts.key}`,
    "content-type": "application/json",
    ...profileFor(method, schema),
  });

  async function req(method, path, { body, prefer } = {}) {
    const res = await doFetch(`${base}/rest/v1/${path}`, {
      method,
      headers: prefer ? { ...headers(method), prefer } : headers(method),
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

  /**
   * A write the fence refused, RAISED with its reason attached.
   *
   * TWO CODES, NEVER ONE. `code: "fenced"` means the claim is gone and the caller
   * must stop; `code: "conflict"` means somebody else's entry is in this slot, which
   * needs a fresh read of the log rather than a stop. A single "append failed" would
   * collapse the two things a caller does differently.
   */
  function refused(what, runId, why, seq) {
    const e = new Error(`append to run ${runId} refused: ${why}`);
    e.code = what;
    e.why = why;
    if (Number.isInteger(seq)) e.seq = seq;
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
       * A journal for one run, writing under ONE CLAIM.
       *
       * PRIVATE: reachable only through `open`, which has already established that
       * this tenant owns the run — a public `journalFor(runId)` would be a way to
       * append to another tenant's log, so it does not exist.
       *
       * **AND IT CANNOT BE BUILT WITHOUT A HOLD**, which is the half added on
       * 2026-09-15. The hold is the worker name and the claim token the database
       * minted for this claim, and every write presents them. So the question
       * "may this process write to this run" is answered by the database at the
       * moment of writing rather than by a flag this process is keeping — and a
       * flag is exactly what a stale worker has, correct up to 30 seconds ago.
       *
       * `seq` is this journal's own ordering, starting where the stored log left
       * off — an ordering and not an identity, which is why a collision on it can
       * simply move up.
       */
      function journalFor(runId, seq, hold) {
        if (typeof hold?.worker !== "string" || hold.worker.trim() === "") {
          throw new TypeError("journal: hold.worker must be a non-empty string, from a claim");
        }
        if (typeof hold?.token !== "string" || hold.token.trim() === "") {
          throw new TypeError("journal: hold.token must be a non-empty string, from a claim");
        }
        let next = Number.isInteger(seq) && seq >= 0 ? seq : 0;
        return {
          get seq() { return next; },
          get hold() { return { worker: hold.worker, token: hold.token }; },
          async append(entry) {
            for (let attempt = 0; attempt <= POSITION_RETRIES; attempt++) {
              const at = next;
              const { answer, seq: where } = await appendEntry({
                runId, seq: at, body: entry, worker: hold.worker, token: hold.token,
              });

              if (answer === "stored") { next = at + 1; return { seq: at, stored: true }; }

              if (answer === "already") {
                // Already recorded, and byte for byte the same entry — so the retry
                // that produced this was safe, and saying so is what keeps a network
                // blip from ending a paid run.
                //
                // **THE POSITION COMES FROM THE DATABASE, NOT FROM US.** The entry
                // can be sitting at a seq this journal never proposed (a previous
                // attempt that landed after its answer was lost), and the counter has
                // to clear it or the next write walks into it.
                const landed = Number.isInteger(where) ? where : at;
                next = Math.max(next, landed + 1);
                return { seq: landed, stored: false, already: true };
              }

              if (answer === "position" && attempt < POSITION_RETRIES) {
                // That slot holds something that is NOT this entry — the logical
                // check ran first and found nothing — so this journal's counter is
                // behind. Move up and try again. It cannot write the same entry
                // twice: the logical check runs again on the retry.
                next = Math.max(next, (Number.isInteger(where) ? where : at) + 1);
                continue;
              }

              if (answer === "conflict") {
                // A DIFFERENT entry in this entry's own logical slot. Somebody else
                // wrote it, so this run's log is not this process's to continue: a
                // fresh delivery must re-read it. Raised, never absorbed.
                //
                // **AND IT IS NEARLY UNREACHABLE, SAID SO THAT NOBODY MISTAKES IT FOR
                // THE COMMON CASE.** Two fenced writers cannot interleave: a holder is
                // refused from the instant its lease LAPSES, not from the instant
                // somebody else claims, so a replacement's snapshot is always taken
                // after the previous holder was already walled off. What is left
                // reachable is an entry written before the fence existed, and a caller
                // re-sending a MODIFIED body. Kept because "already recorded" is the one
                // reading that must never cover either of those.
                throw refused("conflict", runId, "conflict", where);
              }

              // **EVERY REMAINING ANSWER IS RAISED HERE, under one code and its own
              // reason.** There was a branch above this for the five `CLAIM_GONE`
              // refusals and A SWEEP PROVED IT DEAD: it threw
              // `refused("fenced", runId, answer, where)`, which is character for
              // character what this line produces for any answer that is not
              // `position`. Deleted rather than declared redundant, because it was
              // not a second wall — it was the same wall written twice.
              //
              // The distinction those five carry is not lost: it rides in `why`, and
              // the RUNNER is where it decides something (`CLAIM_GONE.includes(e.why)`
              // flips its own flag; `position-twice` does not, because that is a
              // journal fault and is retryable).
              throw refused("fenced", runId, answer === "position" ? "position-twice" : answer, where);
            }
            // Unreachable: the loop above returns or throws on every answer. Kept as
            // a named failure rather than an implicit `undefined`, which is what a
            // future edit to the loop bounds would otherwise produce.
            throw refused("fenced", runId, "position-twice", null);
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

      /**
       * The authorised read both doors share. ONE reader, so `load` and `open`
       * cannot come to disagree about what a run is — the previous shape had `load`
       * call `open` and drop a key, which only worked while `open` needed nothing
       * `load` could not supply.
       */
      async function readRun(runId) {
        const run = await owns(runId);
        if (!run) throw notFound(runId);
        const q = `${ENTRIES}?run_id=eq.${encodeURIComponent(runId)}&select=seq,body&order=seq.asc`;
        const r = await req("GET", q);
        if (!r.ok) throw fail("open", r);
        const rows = Array.isArray(r.body) ? r.body : [];
        const entries = rows.map((row) => row.body);
        // `nextSeq` comes from the HIGHEST seq stored, not from the row count: a gap
        // would make a count-based answer collide with an entry still there.
        const nextSeq = rows.length ? Math.max(...rows.map((row) => row.seq)) + 1 : 0;
        const state = replay(entries);
        return { runId, tenant, run, entries, nextSeq, state, limits: limitsFromJson(state.limits) };
      }

      return {
        tenant,

        /**
         * Start a run: the row, and nothing else.
         *
         * ONLY `id` and `tenant_id` are written — everything else about a run is
         * derived from its log by the database, so there is nothing here that could
         * disagree with the entries. The tenant comes from the scope and cannot be
         * passed.
         *
         * **IT HANDS BACK NO JOURNAL, and that is the fence's doing rather than an
         * omission.** Writing the log needs a live claim on the run's work row, and
         * creating a run does not give anybody one; a journal from here would be an
         * object whose every call answers `no-work`. The queue's own door is
         * `agent.accept_run`, which writes the run, its first entry and the work row
         * in one transaction — this is the plain row-maker beneath it.
         */
        async create(runId) {
          if (typeof runId !== "string" || runId.trim() === "") throw new TypeError("create: runId must be a non-empty string");
          const r = await req("POST", RUNS, { body: { id: runId, tenant_id: tenant }, prefer: "return=minimal" });
          // A REPEATED CREATE IS NOT AN ERROR, for the same reason a repeated
          // append is not: the caller cannot know which side of the commit its
          // connection died on. The primary key makes the second one a no-op.
          if (!r.ok && r.body?.code !== DUPLICATE) throw fail("create", r);
          // ...BUT A REPEAT MUST NOT TELL THIS TENANT THE RUN IS THEIRS. The primary
          // key is on the id ALONE, so a duplicate could be another tenant's run
          // with the same id, and answering as though it were this one's would be
          // the leak this whole file is built to prevent.
          if (!r.ok && !(await owns(runId))) throw notFound(runId);
          return { runId, tenant };
        },

        /**
         * Authorise, load, and hand back everything needed to resume: the entries,
         * the replayed state, the decoded limits, and a journal positioned after
         * the last stored entry and bound to the claim this worker holds.
         *
         * The replay happens HERE rather than being left to the caller so that
         * `problems` cannot be skipped by accident — a log with problems must not
         * be resumed, and a bare array invites passing it straight to `runAgent`.
         *
         * **`hold` IS REQUIRED, and `load` is the door for a reader.** Making it
         * optional would put the writing door and the reading door in one function
         * whose safety depends on an argument being remembered. Two doors, and only
         * one of them can write.
         */
        async open(runId, opts = {}) {
          const hold = opts.hold;
          if (!hold) throw new TypeError("open: hold must be the claim ({ worker, token }) — use load to read");
          const read = await readRun(runId);
          return { ...read, journal: journalFor(runId, read.nextSeq, hold) };
        },

        /** The same authorised read, and NO WAY TO WRITE. For showing a run. */
        async load(runId) {
          return readRun(runId);
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
