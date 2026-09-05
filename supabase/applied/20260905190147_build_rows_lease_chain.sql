-- Applied 2026-09-05 as remote version 20260905190147 (stage 2c of the
-- architecture plan, owner: "go"), through the Supabase connector; the two
-- functions read back with pg_get_functiondef into the live snapshot beside
-- this file the same minute, and test/build-jobs.test.mjs holds each equal
-- byte for byte.
--
-- BUILDS GET A ROW, AND ONE LEASE MOVES ALONG THE CHAIN.
--
-- A build had an R2 record with an etag claim and charge marks and nothing
-- else: no row, no lease, no heartbeat, no sweep. A consumer evicted
-- mid-design or a resume chain the queue stopped delivering left the customer
-- with the stand-in page and a browser polling `pending` to its own bound;
-- nothing could say the build was gone, because nothing held it. Now the
-- build route files a row through edit_create under op `build`, the consumer
-- claims and beats, and the lease is HANDED at fire time to the container that
-- generates, RELEASED by its report, claimed or taken over by name by the
-- collector, and swept as lost when nobody renews it - the sweep's own
-- `lost` branch, unchanged, with nothing moved.
--
-- Four changes, two of them one line:
--   * the state CHECK admits `generating`, the state while the container holds
--     the lease;
--   * the billing CHECK admits `external`: money that moved through the
--     build's own ledger (credit_debit under build:<jobId> refs, stage 1c) and
--     never through a reserve on this row, so edit_refund and edit_reconcile
--     never move it. `none` behaves identically inside every RPC; the word
--     says why a forty-credit build's row reads cost 0;
--   * edit_create bills a row `external` when its op is `build` - decided from
--     the op, so no caller can file a build under a reserve by mistake;
--   * edit_handoff (new): the current holder moves the lease to a named next
--     holder (or keeps it, on a release), for a TTL up to an hour, naming the
--     state and the slug when it knows them. A stranger is refused by name
--     (`not-holder`); a terminal or reviewed row is refused as edit_claim
--     refuses it.
-- Driven RED before this was written: scripts/edit-rpc-check.sql FAIL 70
-- ("a build row is not billed external") against the live edit_create.

alter table public.edit_jobs drop constraint edit_jobs_state_ck;
alter table public.edit_jobs add constraint edit_jobs_state_ck check (state in (
    'queued','claimed','routing','editing','building','verifying',
    'correcting','rebuilding','publishing','generating','done','failed','cancelled','lost'));
alter table public.edit_jobs drop constraint edit_jobs_billing_ck;
alter table public.edit_jobs add constraint edit_jobs_billing_ck check (billing in (
    'none','reserved','finalized','refunded','exempt','external'));
comment on column public.edit_jobs.billing is 'none | reserved | finalized | refunded | exempt | external (a build: its money moved through credit_debit under build:<id> refs, never a reserve here)';

CREATE OR REPLACE FUNCTION public.edit_create(p_id text, p_uid uuid, p_slug text, p_op text, p_idem text, p_mint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare r public.edit_jobs%rowtype; blocked text;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_id is null or length(p_id) < 8 then raise exception 'bad id'; end if;
  if p_uid is null or p_slug is null or p_op is null then raise exception 'bad args'; end if;
  -- A SITE UNDER REVIEW TAKES NO NEW EDITS. A job that died mid-publish may or
  -- may not have shipped, so the stored source and the live site cannot be
  -- assumed equal -- and an edit built on the wrong one overwrites a published
  -- version nobody knew was live.
  select id into blocked from public.edit_jobs where slug = p_slug and needs_review limit 1;
  if blocked is not null then
    return jsonb_build_object('ok', false, 'error', 'needs-review', 'job', blocked);
  end if;
  -- REFUSED, NEVER GENERATED. A server-minted key makes every retry a distinct
  -- job, which is exactly the double charge this exists to prevent.
  if p_idem is null or p_idem !~ '^[A-Za-z0-9_-]{16,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad-idem');
  end if;
  -- THE OP DECIDES THE BILLING (stage 2c). A build's money moves through its
  -- own ledger and never through a reserve on this row, so it is filed
  -- `external` -- here, from the op, so no caller can file one under a reserve.
  insert into public.edit_jobs (id, uid, slug, op, idem_key, billing)
    values (p_id, p_uid, p_slug, p_op, p_idem, case when p_op = 'build' then 'external' else 'none' end)
    on conflict do nothing;
  select * into r from public.edit_jobs
   where uid = p_uid and slug = p_slug and op = p_op and idem_key = p_idem;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', true, 'job', r.id, 'state', r.state,
                            'duplicate', r.id is distinct from p_id);
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
    return jsonb_build_object('ok', true, 'state', j.state, 'owner', j.lease_owner, 'slug', j.slug,
                              'expires', j.lease_expires_at);
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

revoke all on function public.edit_handoff(text, text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.edit_handoff(text, text, text, integer, text, text, text) to service_role;
