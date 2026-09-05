-- Applied 2026-09-05 as remote version 20260905175752 (stage 2a of the
-- architecture plan, owner: "go"), through the Supabase connector; the
-- function read back with pg_get_functiondef into the live snapshot beside
-- this file the same minute, and test/sweep-recovery.test.mjs holds the two
-- equal byte for byte.
--
-- THE SWEEP FINALIZES A COMMITTED JOB, COUNTS ITS TRIES, AND PARKS ONE IT
-- CANNOT SETTLE.
--
-- A job that died after edit_committed and before edit_finalize sat
-- `publishing` with published_at set: edit_sweep_lost called the refund, which
-- refused it as `published` (rightly - the change is live), the sweep counted
-- that as lost, changed nothing, and selected the row again every two-minute
-- tick - one of the batch's twenty slots held for ever, and the browser
-- polling a 202 with no bound. Read out of the live bodies with
-- pg_get_functiondef and driven RED before this was written:
-- scripts/edit-rpc-check.sql FAIL 65 ("the sweep re-picked a committed job
-- instead of finalizing it"), the live sweep answering {lost: 1, refunded: 0}.
--
-- Three changes, one function and one column:
--   * a `published` refusal finalizes the row with a reply the poll route can
--     serve - the consumer's own stored shape {status, type, body}, the body
--     as text, saying the change went live and the details of what it did
--     were lost (`recovered`); the reserve stands, as for any shipped edit;
--   * every attempt is counted in edit_jobs.sweep_tries, first, so a refusal
--     with no branch still moves the row toward the ceiling;
--   * a row five ticks could not settle is parked in review - out of the
--     batch, its site closed to new edits as every review row's is, the money
--     untouched - with review_note 'sweep exhausted', for a person to settle
--     through edit_reconcile. No answer the RPCs give today leaves a row in
--     the batch after one tick; the ceiling is the belt for the shape nobody
--     has named yet.
alter table public.edit_jobs add column if not exists sweep_tries integer not null default 0;
comment on column public.edit_jobs.sweep_tries is 'ticks the lost-job sweep has spent on this row; at five it is parked in review (sweep exhausted)';

CREATE OR REPLACE FUNCTION public.edit_sweep_lost(p_limit integer, p_grace integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare r record; n_lost int := 0; n_review int := 0; n_recovered int := 0; n_exhausted int := 0; n_stuck int := 0; refunded numeric := 0; res jsonb;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'bad limit'; end if;
  if p_grace is null or p_grace < 30 or p_grace > 3600 then raise exception 'bad grace'; end if;
  for r in
    select id, cost, artifact_build, sweep_tries from public.edit_jobs
     where state not in ('done','failed','cancelled','lost')
       and needs_review = false
       and lease_expires_at is not null
       and lease_expires_at < now() - make_interval(secs => p_grace)
     order by lease_expires_at
     limit p_limit
  loop
    -- A ROW FIVE TICKS COULD NOT SETTLE IS PARKED, before a sixth try: out of
    -- the batch (needs_review is excluded above, and closes its site to new
    -- edits as every review row does), the money where it is, and a person
    -- settles it through edit_reconcile. Held, it would keep one of the
    -- batch's slots and a browser polling a 202 for ever. The sweep's own
    -- conditions are asked again at the write, so a row another caller moved
    -- since the select is left alone.
    if r.sweep_tries >= 5 then
      update public.edit_jobs
         set needs_review = true, review_note = 'sweep exhausted', updated_at = now()
       where id = r.id and needs_review = false
         and state not in ('done','failed','cancelled','lost')
         and lease_expires_at < now() - make_interval(secs => p_grace);
      if found then n_exhausted := n_exhausted + 1; end if;
      continue;
    end if;
    -- EVERY ATTEMPT IS COUNTED, and counted first, so a refusal below that
    -- names no branch still moves the row toward the ceiling.
    update public.edit_jobs set sweep_tries = sweep_tries + 1, updated_at = now() where id = r.id;
    res := public.edit_refund(r.id, 'lost', 'lease expired', p_mint);
    if (res->>'error') = 'published' then
      -- THE JOB SHIPPED AND DIED BEFORE ITS FINALIZE: edit_committed set
      -- published_at, the refund refuses it (rightly), and until stage 2a
      -- this branch counted that as lost, changed nothing, and picked the
      -- row again every tick. Finalized here with a reply the poll route
      -- can serve - the consumer's own {status, type, body}, the body as
      -- text - saying the change went live and the details of what it did
      -- were lost. The reserve stands: nothing is refunded for work that is
      -- live. A finalize that still refuses leaves the row for the ceiling.
      res := public.edit_finalize(r.id, jsonb_build_object(
               'status', 200, 'type', 'application/json',
               'body', jsonb_build_object('ok', true, 'recovered', true, 'job', r.id,
                                          'cost', r.cost, 'build', r.artifact_build)::text),
             true, p_mint);
      if (res->>'ok') = 'true' then n_recovered := n_recovered + 1;
      else n_stuck := n_stuck + 1;
      end if;
    elsif (res->>'error') = 'needs-review' then n_review := n_review + 1;
    elsif (res->>'ok') = 'true' then
      n_lost := n_lost + 1; refunded := refunded + coalesce((res->>'refunded')::numeric, 0);
    else
      -- A REFUSAL WITH NO BRANCH (no-job, terminal: a race this tick lost).
      -- The row stays, counted, and the ceiling above ends it.
      n_stuck := n_stuck + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'lost', n_lost, 'review', n_review, 'recovered', n_recovered,
    'exhausted', n_exhausted, 'stuck', n_stuck, 'refunded', refunded);
end; $function$;

revoke all on function public.edit_sweep_lost(integer, integer, text) from public, anon, authenticated;
grant execute on function public.edit_sweep_lost(integer, integer, text) to service_role;
