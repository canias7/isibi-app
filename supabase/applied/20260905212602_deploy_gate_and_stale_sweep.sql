-- Applied 2026-09-05 as remote version 20260905212602 (stage 3a of the
-- architecture plan, owner: "ok go"), through the Supabase connector; the seven
-- functions read back with pg_get_functiondef into the live snapshot beside
-- this file the same minute, and test/deploy-gate.test.mjs holds each equal
-- byte for byte.
--
-- THE DEPLOY GATE, AND A QUEUED ROW NOBODY PICKED UP.
--
-- A deploy rolls the Worker and the platform evicts the old isolates minutes
-- later: run 17 (2026-09-02) had a customer's edit cancelled nine minutes after
-- a deploy, its lease lapsing under the sweep and the change lost. The isolate
-- cannot drain itself and the deploy workflow had no gate. Now the deploy sets
-- ONE ROW (private.platform_flags, name deploy) naming itself with an expiry,
-- through deploy_gate_set, before anything rolls, and passes the same id into
-- the Worker as DEPLOY_ID; a consumer names its id on every claim (edit_claim
-- gains p_deploy), and while a gate under ANOTHER id stands the claim is
-- refused deploy-gated -- that consumer is the isolate about to be evicted.
-- The new code's id is the gate's, so it claims through; a claim naming no
-- deploy (a hand deploy, the container's runtime) is never gated. The refusal
-- is counted and bounded exactly as a busy site's (stage 6) -- the same
-- column, the same cap, the same give-up through the refund -- in ONE helper,
-- private.claim_deferred, called for both reasons, and private.gate_blocks is
-- the one comparison. deploy_gate_clear clears only its own id (an overlapping
-- newer deploy's gate stands); deploy_gate_read answers the gate and the live
-- leases for the deploy's drain. edit_claim is DROPPED and re-created under its
-- new signature -- CREATE OR REPLACE with a new parameter would have left the
-- old overload beside it -- and its grants re-issued.
--
-- And edit_sweep_stale: a queued row with no lease that nothing has touched
-- for the window (its message never delivered, its consumer evicted before the
-- claim landed, a re-send that failed) is marked stale, counted, and handed
-- back to be SENT AGAIN once; still untouched a window later it is failed
-- through the refund with the reason on it, a build's deposit the Worker's to
-- give back. Before this such a row sat queued for ever.
--
-- No RED baseline exists for a mechanism that is new: against the old
-- functions the check's section 21 stops on a function that does not exist,
-- which proves nothing about behaviour. The driven proof is the green run.

create table if not exists private.platform_flags (
  name text primary key,
  deploy_id text,
  started_at timestamp with time zone,
  expires_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);
comment on table private.platform_flags is 'one row per platform-wide flag. The deploy gate is the row named deploy (stage 3a): while it names a deploy and has not expired, a consumer naming a DIFFERENT deploy on its claim is refused deploy-gated -- it is the isolate the deploy is about to evict. Written by deploy_gate_set and deploy_gate_clear, read by edit_claim and deploy_gate_read.';
revoke all on table private.platform_flags from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.gate_blocks(p_deploy text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare g text;
begin
  -- THE ONE COMPARISON (stage 3a): a gate that names a deploy, has not
  -- expired, and names a DIFFERENT deploy than the caller's, blocks. A caller
  -- naming no deploy is never blocked -- a hand deploy, the container's
  -- runtime -- and neither is the gate's own deploy, which is the new code.
  if p_deploy is null or p_deploy = '' then return null; end if;
  select f.deploy_id into g from private.platform_flags f
   where f.name = 'deploy' and f.deploy_id is not null and f.expires_at > now();
  if g is null or g = p_deploy then return null; end if;
  return g;
end; $function$;
revoke all on function private.gate_blocks(text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.claim_deferred(p_id text, p_kind text, p_other text, p_state text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare deferred integer; res jsonb; note text;
begin
  -- A CLAIM REFUSED FOR A REASON THE CONSUMER WAITS OUT -- the site held by
  -- another job (stage 6), a newer deploy rolling (stage 3a) -- COUNTED on the
  -- row, once per refusal: the consumer re-sends its message with a delay.
  -- Past the cap the row is FAILED through the refund (nothing was reserved
  -- at a claim, so nothing moves) with the reason on it, so a job cannot wait
  -- for ever behind a site that never frees or a gate nobody clears. ONE BODY
  -- for both reasons, so the count and the cap cannot drift apart.
  update public.edit_jobs set deferrals = deferrals + 1, phase = 'waiting', updated_at = now()
   where id = p_id returning deferrals into deferred;
  if deferred > 45 then
    note := case p_kind when 'site-busy' then 'the site was busy for the whole wait' else 'the platform was updating for the whole wait' end;
    res := public.edit_refund(p_id, 'failed', note, p_mint);
    update public.edit_jobs
       set error = jsonb_build_object('kind', p_kind, 'phase', 'queued', 'other', p_other, 'deferrals', deferred),
           updated_at = now()
     where id = p_id;
    return jsonb_build_object('ok', true, 'claimed', false, 'error', p_kind, 'gave_up', true,
      'other', p_other, 'deferrals', deferred, 'state', 'failed', 'refund', res);
  end if;
  return jsonb_build_object('ok', true, 'claimed', false, 'error', p_kind, 'gave_up', false,
    'other', p_other, 'deferrals', deferred, 'state', p_state);
end; $function$;
revoke all on function private.claim_deferred(text, text, text, text, text) from public, anon, authenticated;

drop function if exists public.edit_claim(text, text, integer, text);
CREATE OR REPLACE FUNCTION public.edit_claim(p_id text, p_owner text, p_ttl integer, p_mint text, p_deploy text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare j public.edit_jobs%rowtype; other text;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  if p_ttl is null or p_ttl < 10 or p_ttl > 600 then raise exception 'bad ttl'; end if;
  -- THE ROW'S OWN ANSWERS FIRST. A row that cannot be claimed for its own
  -- reasons -- under review, over, settled, held by a live lease -- is told
  -- so before the gate or the site is asked, and is never counted as a deferral.
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
  -- THE DEPLOY GATE (stage 3a), BEFORE THE SITE'S LOCK IS TAKEN: a consumer
  -- naming its deploy is refused while a gate under ANOTHER id stands -- it is
  -- the isolate that deploy is about to evict, and a job it started would die
  -- with it. The new code's id IS the gate's, so it claims straight through;
  -- a claim naming no deploy is never gated. Counted and bounded exactly as a
  -- busy site is, with its own reason on the row.
  other := private.gate_blocks(p_deploy);
  if other is not null then return private.claim_deferred(p_id, 'deploy-gated', other, j.state, p_mint); end if;
  -- ONE JOB PER SITE AT A TIME (stage 6). Under the site's own lock, another
  -- job holding a live lease -- or publishing, or the platform rebuilding --
  -- refuses this claim as site-busy, counted the same way.
  other := private.site_busy(j.slug, p_id);
  if other is not null then return private.claim_deferred(p_id, 'site-busy', other, j.state, p_mint); end if;
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
revoke all on function public.edit_claim(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.edit_claim(text, text, integer, text, text) to service_role;

CREATE OR REPLACE FUNCTION public.deploy_gate_set(p_deploy_id text, p_ttl integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare prev text; prev_until timestamp with time zone; until timestamp with time zone;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_deploy_id is null or p_deploy_id !~ '^[A-Za-z0-9._-]{4,64}$' then raise exception 'bad deploy id'; end if;
  if p_ttl is null or p_ttl < 60 or p_ttl > 7200 then raise exception 'bad ttl'; end if;
  -- THE NEWEST DEPLOY OWNS THE GATE. Two deploys minutes apart overwrite in
  -- order, and each clear clears only its own id, so the earlier one's clear
  -- cannot release the later one's gate. What stood before is answered, so
  -- the deploy's log says whether it took the gate over from a live one.
  select deploy_id, expires_at into prev, prev_until from private.platform_flags where name = 'deploy';
  until := now() + make_interval(secs => p_ttl);
  insert into private.platform_flags (name, deploy_id, started_at, expires_at, updated_at)
    values ('deploy', p_deploy_id, now(), until, now())
    on conflict (name) do update
      set deploy_id = excluded.deploy_id, started_at = excluded.started_at, expires_at = excluded.expires_at, updated_at = now();
  return jsonb_build_object('ok', true, 'deploy_id', p_deploy_id, 'expires_at', until,
    'previous', prev, 'previous_active', prev is not null and prev_until > now());
end; $function$;
revoke all on function public.deploy_gate_set(text, integer, text) from public, anon, authenticated;
grant execute on function public.deploy_gate_set(text, integer, text) to service_role;

CREATE OR REPLACE FUNCTION public.deploy_gate_clear(p_deploy_id text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare holder text;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_deploy_id is null or p_deploy_id = '' then raise exception 'bad deploy id'; end if;
  -- ONLY ITS OWN ID. A newer deploy's gate is left standing, and the answer
  -- names whose it is.
  update private.platform_flags set deploy_id = null, expires_at = null, updated_at = now()
   where name = 'deploy' and deploy_id = p_deploy_id;
  if found then return jsonb_build_object('ok', true, 'cleared', true); end if;
  select deploy_id into holder from private.platform_flags where name = 'deploy';
  return jsonb_build_object('ok', true, 'cleared', false, 'holder', holder);
end; $function$;
revoke all on function public.deploy_gate_clear(text, text) from public, anon, authenticated;
grant execute on function public.deploy_gate_clear(text, text) to service_role;

CREATE OR REPLACE FUNCTION public.deploy_gate_read(p_deploy text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare gid text; gstart timestamp with time zone; guntil timestamp with time zone; live_n integer; rows_j jsonb;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  select deploy_id, started_at, expires_at into gid, gstart, guntil from private.platform_flags where name = 'deploy';
  -- THE LIVE LEASES, for the drain: every row a holder is still renewing, the
  -- newest first, twenty named so the deploy's log says what it waited for.
  select count(*) into live_n from public.edit_jobs
   where state not in ('done','failed','cancelled','lost') and lease_expires_at > now();
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'slug', x.slug, 'state', x.state, 'holder', x.lease_owner,
                                               'left_s', extract(epoch from (x.lease_expires_at - now()))::integer)), '[]'::jsonb)
    into rows_j
    from (select id, slug, state, lease_owner, lease_expires_at from public.edit_jobs
           where state not in ('done','failed','cancelled','lost') and lease_expires_at > now()
           order by lease_expires_at desc limit 20) x;
  return jsonb_build_object('ok', true,
    'active', gid is not null and guntil > now(),
    'deploy_id', gid, 'started_at', gstart, 'expires_at', guntil,
    'blocks', private.gate_blocks(p_deploy) is not null,
    'live', live_n, 'rows', rows_j);
end; $function$;
revoke all on function public.deploy_gate_read(text, text) from public, anon, authenticated;
grant execute on function public.deploy_gate_read(text, text) to service_role;

CREATE OR REPLACE FUNCTION public.edit_sweep_stale(p_after integer, p_limit integer, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare r record; resend jsonb := '[]'::jsonb; failed jsonb := '[]'::jsonb; res jsonb;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_after is null or p_after < 60 or p_after > 3600 then raise exception 'bad window'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'bad limit'; end if;
  -- A QUEUED ROW NOBODY HAS PICKED UP (stage 3a): no lease, and nothing has
  -- touched it for the window -- its message never delivered, its consumer
  -- evicted before the claim landed, a re-send that failed. Every deferral
  -- touches the row, so a job waiting behind a site or a deploy is never here.
  for r in
    select id, op, uid, slug, phase, deferrals from public.edit_jobs
     where state = 'queued' and lease_owner is null and needs_review = false
       and billing not in ('finalized','refunded')
       and updated_at < now() - make_interval(secs => p_after)
     order by updated_at
     limit p_limit
  loop
    if r.phase = 'stale' then
      -- SENT AGAIN ONCE AND STILL UNTOUCHED: failed through the refund
      -- (nothing was reserved on a queued row; a build's deposit is the
      -- Worker's to give back, and the answer names whose it is), the
      -- reason on the row for the poll route's sentence.
      res := public.edit_refund(r.id, 'failed', 'never picked up', p_mint);
      if (res->>'ok') = 'true' then
        update public.edit_jobs
           set error = jsonb_build_object('kind', 'stale', 'phase', 'queued', 'deferrals', r.deferrals), updated_at = now()
         where id = r.id and state = 'failed';
        failed := failed || jsonb_build_object('id', r.id, 'op', r.op, 'uid', r.uid, 'slug', r.slug);
      end if;
    else
      -- MARKED AND COUNTED, and handed back to be sent again -- once: the
      -- mark is what the next look reads, and the touch is what keeps a row
      -- sent minutes ago out of this look.
      update public.edit_jobs set phase = 'stale', deferrals = deferrals + 1, updated_at = now()
       where id = r.id and state = 'queued' and lease_owner is null;
      if found then resend := resend || jsonb_build_object('id', r.id, 'op', r.op); end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'resend', resend, 'failed', failed);
end; $function$;
revoke all on function public.edit_sweep_stale(integer, integer, text) from public, anon, authenticated;
grant execute on function public.edit_sweep_stale(integer, integer, text) to service_role;
