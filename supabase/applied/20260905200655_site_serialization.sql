-- Applied 2026-09-05 as remote version 20260905200655 (stage 6 of the
-- architecture plan, owner: "go"), through the Supabase connector; the six
-- functions read back with pg_get_functiondef into the live snapshot beside
-- this file the same minute, and test/site-busy.test.mjs holds each equal
-- byte for byte.
--
-- ONE JOB PER SITE AT A TIME.
--
-- edit_create checked only review and the idempotency key, so two edits with
-- different keys, an edit and an addon, an edit and a revise, or an edit and
-- the platform rebuild ran at once on one site; only the browser's own
-- in-flight set blocked a second submit, per tab. Compiles serialised per
-- lane; the writes did not, and the pointer's conditional write (stage 7)
-- stops only a holder whose pointer moved under it -- never a publish built
-- from a source another job changed after it was read.
--
-- Now the claim is the wall. Under the site's own advisory lock, taken for
-- the transaction (private.site_busy), another job holding a live lease on
-- the slug -- or publishing, or the platform rebuilding it -- refuses the
-- claim as site-busy, counted on the row (edit_jobs.deferrals): the consumer
-- re-sends its message with a delay, once per refusal, and the refusal past
-- the cap fails the row through the refund with the reason on it, so nothing
-- waits for ever. The platform rebuild's claim (rebuild_claim, replacing the
-- drain's PATCH) asks the same question under the same lock and leaves a
-- mark (site_rebuild.running_until) the next edit's claim reads; the drain's
-- forget and defer clear it. edit_committed requires the lease to be LIVE
-- beside its owner check -- the third wall on a stale holder, after the
-- prefix-confined writes and the conditional pointer -- and says why it
-- refused. edit_get carries the deferral count; edit_handoff names the row's
-- uid, for the job runner's takeover by name.
--
-- Driven RED before this was written: scripts/edit-rpc-check.sql FAIL 81
-- ("a second job claimed a site another job holds") against the live
-- edit_claim.

alter table public.edit_jobs add column if not exists deferrals integer not null default 0;
comment on column public.edit_jobs.deferrals is 'how many claims the site''s own lock refused as site-busy (stage 6): the consumer re-sends its message once per refusal, and the refusal past the cap fails the row';
alter table public.site_rebuild add column if not exists running_until timestamp with time zone;
comment on column public.site_rebuild.running_until is 'while in the future, a platform rebuild of this site is running (rebuild_claim sets it, the drain''s forget and defer clear it) and edit_claim reads the site as busy';

CREATE OR REPLACE FUNCTION private.site_busy(p_slug text, p_self text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare other text;
begin
  -- THE SITE'S OWN LOCK (stage 6), held for the rest of the transaction, so
  -- two claims on one site -- two edits, an edit and a build, an edit and the
  -- platform rebuild -- are answered one after the other and the second sees
  -- the first's lease. Nothing here reads without it.
  if p_slug is null or p_slug = '' then return null; end if;
  perform pg_advisory_xact_lock(hashtext('site:' || p_slug));
  -- ANOTHER JOB HOLDS A LIVE LEASE ON THE SITE, OR IS PUBLISHING: a publisher
  -- whose lease lapsed may still have shipped, and the sweep settles it within
  -- a tick, so a new job waits for that rather than racing it. A reviewed row
  -- is parked, never running; a terminal one is over; the row asking is never
  -- its own blocker.
  select o.id into other from public.edit_jobs o
   where o.slug = p_slug and o.id is distinct from p_self
     and o.state not in ('done','failed','cancelled','lost')
     and o.needs_review = false
     and ((o.lease_owner is not null and o.lease_expires_at > now()) or o.state = 'publishing')
   order by o.lease_expires_at desc nulls last
   limit 1;
  if other is not null then return other; end if;
  -- OR THE PLATFORM IS REBUILDING IT: rebuild_claim's mark, cleared when the
  -- drain forgets or defers the row, expiring on its own if the drain dies.
  if exists (select 1 from public.site_rebuild r where r.slug = p_slug and r.running_until > now()) then return 'rebuild'; end if;
  return null;
end; $function$;

CREATE OR REPLACE FUNCTION public.edit_claim(p_id text, p_owner text, p_ttl integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype; other text; deferred integer; res jsonb;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  if p_ttl is null or p_ttl < 10 or p_ttl > 600 then raise exception 'bad ttl'; end if;
  -- THE ROW'S OWN ANSWERS FIRST. A row that cannot be claimed for its own
  -- reasons -- under review, over, settled, held by a live lease -- is told
  -- so before the site is asked, and is never counted as a deferral.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'claimed', false, 'error', 'no-job'); end if;
  if j.needs_review or j.state in ('done','failed','cancelled','lost')
     or j.billing in ('finalized','refunded')
     or (j.lease_owner is not null and j.lease_expires_at >= now()) then
    return jsonb_build_object('ok', true, 'claimed', false, 'state', j.state,
      'error', case when j.needs_review then 'needs-review'
                    when j.state in ('done','failed','cancelled','lost') then 'terminal'
                    when j.billing in ('finalized','refunded') then 'settled'
                    else 'leased' end);
  end if;
  -- ONE JOB PER SITE AT A TIME (stage 6). Under the site's own lock, another
  -- job holding a live lease -- or publishing, or the platform rebuilding --
  -- refuses this claim as site-busy, counted on the row: the consumer
  -- re-sends its message with a delay, once per refusal, and the refusal past
  -- the cap FAILS the row through the refund (nothing was reserved at a
  -- claim, so nothing moves) with the reason on it, so a job cannot wait for
  -- ever behind a site that never frees.
  other := private.site_busy(j.slug, p_id);
  if other is not null then
    update public.edit_jobs set deferrals = deferrals + 1, phase = 'waiting', updated_at = now()
     where id = p_id returning deferrals into deferred;
    if deferred > 45 then
      res := public.edit_refund(p_id, 'failed', 'the site was busy for the whole wait', p_mint);
      update public.edit_jobs
         set error = jsonb_build_object('kind', 'site-busy', 'phase', 'queued', 'other', other, 'deferrals', deferred),
             updated_at = now()
       where id = p_id;
      return jsonb_build_object('ok', true, 'claimed', false, 'error', 'site-busy', 'gave_up', true,
        'other', other, 'deferrals', deferred, 'state', 'failed', 'refund', res);
    end if;
    return jsonb_build_object('ok', true, 'claimed', false, 'error', 'site-busy', 'gave_up', false,
      'other', other, 'deferrals', deferred, 'state', j.state);
  end if;
  update public.edit_jobs
     set lease_owner = p_owner,
         lease_expires_at = now() + make_interval(secs => p_ttl),
         heartbeat_at = now(),
         state = case when state = 'queued' then 'claimed' else state end,
         updated_at = now()
   where id = p_id
     and state not in ('done','failed','cancelled','lost')
     and needs_review = false
     -- NOT ALREADY PAID FOR OR PAID BACK. Belt as well as braces: both of those
     -- states also move `state`, but a claim is the door and a door should test
     -- what it is protecting rather than trusting a neighbour to have done it.
     and billing not in ('finalized','refunded')
     and (lease_owner is null or lease_expires_at < now())
   returning * into j;
  if found then
    return jsonb_build_object('ok', true, 'claimed', true, 'state', j.state,
      'billing', j.billing, 'uid', j.uid, 'slug', j.slug, 'needs_review', j.needs_review,
      'deferrals', j.deferrals);
  end if;
  -- RACED between the read above and this update -- a cancel, a refund, a
  -- second delivery -- and told WHY rather than being handed a bare false.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'claimed', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'claimed', false, 'state', j.state,
    'error', case when j.needs_review then 'needs-review'
                  when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  when j.billing in ('finalized','refunded') then 'settled'
                  else 'leased' end);
end; $function$;

CREATE OR REPLACE FUNCTION public.edit_committed(p_id text, p_owner text, p_build text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  -- THE HOLDER, WITH A LIVE LEASE (stage 6). A holder that lost its lease and
  -- stalled is already stopped at the pointer (one conditional write); this is
  -- the third wall: it cannot record a commit either, so the row it leaves
  -- reads as the ambiguity it is and never as a clean ship.
  update public.edit_jobs
     set published_at = coalesce(published_at, now()),
         artifact_build = coalesce(p_build, artifact_build),
         updated_at = now()
   where id = p_id and lease_owner = p_owner
     and lease_expires_at > now()
     and state not in ('done','failed','cancelled','lost')
   returning * into j;
  if found then return jsonb_build_object('ok', true, 'published', j.published_at); end if;
  -- TOLD WHY, so the spine's trace can name the wall that refused it.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state,
    'error', case when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  when j.lease_owner is distinct from p_owner then 'not-holder'
                  when j.lease_expires_at is null or j.lease_expires_at <= now() then 'lease-expired'
                  else 'refused' end);
end; $function$;

CREATE OR REPLACE FUNCTION public.edit_get(p_id text, p_uid uuid, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  select * into j from public.edit_jobs where id = p_id and uid = p_uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object(
    'ok', true, 'job', j.id, 'slug', j.slug, 'state', j.state, 'phase', j.phase,
    'cost', j.cost, 'billing', j.billing, 'needs_review', j.needs_review,
    'cancel', j.cancel_requested_at is not null,
    'ms', (extract(epoch from (coalesce(j.updated_at, now()) - j.created_at)) * 1000)::bigint,
    'result', j.result, 'error', j.error, 'deferrals', j.deferrals);
end; $function$;

CREATE OR REPLACE FUNCTION public.edit_handoff(p_id text, p_owner text, p_next text, p_ttl integer, p_state text, p_slug text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  if p_next is not null and length(p_next) < 4 then raise exception 'bad owner'; end if;
  -- UP TO AN HOUR, where edit_claim and edit_beat stop at ten minutes: the
  -- handoff to the container is for the generation bound (thirty minutes),
  -- which no heartbeat of the Worker's can renew. A release or a takeover
  -- asks for far less.
  if p_ttl is null or p_ttl < 10 or p_ttl > 3600 then raise exception 'bad ttl'; end if;
  -- THE HOLDER MOVES IT, NOBODY ELSE. A null next holder is a RELEASE: the
  -- owner stays and only the expiry moves, so the collector can still take it
  -- over by that name, and the sweep ends it if no collector comes. The state
  -- and the slug are set only when the caller knows them; the row's own CHECK
  -- refuses a state that is not one of its own.
  update public.edit_jobs
     set lease_owner = coalesce(p_next, lease_owner),
         lease_expires_at = now() + make_interval(secs => p_ttl),
         heartbeat_at = now(),
         state = coalesce(p_state, state),
         slug = coalesce(nullif(p_slug, ''), slug),
         updated_at = now()
   where id = p_id and lease_owner = p_owner
     and state not in ('done','failed','cancelled','lost')
     and needs_review = false
   returning * into j;
  if found then
    -- THE IDENTITY RIDES THE ANSWER (stage 6): the job runner takes a lease
    -- over from the consumer by name and needs the row's uid and slug for the
    -- same agreement check a fresh claim makes.
    return jsonb_build_object('ok', true, 'state', j.state, 'owner', j.lease_owner, 'slug', j.slug,
                              'uid', j.uid, 'expires', j.lease_expires_at);
  end if;
  -- TOLD WHY, as edit_claim tells a second delivery: a stranger, a terminal
  -- row and a row under review need different reactions from the caller.
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state,
    'error', case when j.needs_review then 'needs-review'
                  when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  else 'not-holder' end);
end; $function$;

CREATE OR REPLACE FUNCTION public.rebuild_claim(p_slug text, p_sec integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare other text; won text; upto timestamptz;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_slug is null or p_slug = '' then raise exception 'bad slug'; end if;
  if p_sec is null or p_sec < 10 or p_sec > 3600 then raise exception 'bad window'; end if;
  -- THE SAME LOCK AND THE SAME QUESTION AS edit_claim (stage 6): a site an
  -- edit or a build holds is not rebuilt under it. `rebuild` back is this
  -- site's own rebuild still running from an earlier tick -- the claim it
  -- would have lost on dueness anyway, said by name so the drain touches
  -- nothing of that run's.
  other := private.site_busy(p_slug, null);
  if other = 'rebuild' then return jsonb_build_object('ok', true, 'won', false, 'busy', false, 'running', true); end if;
  if other is not null then return jsonb_build_object('ok', true, 'won', false, 'busy', true, 'other', other); end if;
  -- THE CLAIM RE-STATES DUENESS, as the PATCH it replaces did: an overlapping
  -- tick that read the same row as due finds it pushed out and loses. The
  -- running mark is what edit_claim reads, for the same window.
  upto := now() + make_interval(secs => p_sec);
  update public.site_rebuild set next_try_at = upto, running_until = upto
   where slug = p_slug and next_try_at <= now()
   returning slug into won;
  if won is null then return jsonb_build_object('ok', true, 'won', false, 'busy', false, 'running', false); end if;
  return jsonb_build_object('ok', true, 'won', true, 'busy', false, 'running', false, 'until', upto);
end; $function$;

revoke all on function private.site_busy(text, text) from public, anon, authenticated;
revoke all on function public.rebuild_claim(text, integer, text) from public, anon, authenticated;
grant execute on function public.rebuild_claim(text, integer, text) to service_role;
