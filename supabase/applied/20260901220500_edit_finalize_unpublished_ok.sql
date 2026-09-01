-- edit_finalize: an ok answer that never began publishing is DONE, not lost.
--
-- Found 2026-09-01 by the lane sweep. The css lane answered "Your site already
-- looks like that - nothing to change." with ok:true and published nothing. The
-- consumer's `shipped` was true, finalize refused (published_at null), the
-- refund branch was skipped, and the job sat non-terminal until edit_sweep_lost
-- declared it lost and refunded it - about 150s after a 22s answer, with the
-- poll route unable to hand back the stored reply until the state was terminal.
--
-- THE INTERLOCK STAYS. A job that STARTED publishing and did not finish is
-- ambiguous and must not be finalized; that is what needs_review is for. A job
-- that never started publishing and answered ok is not ambiguous - there is
-- nothing to review - and it is done. Billing follows the synchronous path: the
-- model calls were real and the reserve stands. `p_ok` is the caller saying the
-- reply was an answer rather than a refusal; without it (or false) the old rule
-- applies unchanged, so a caller that forgets it cannot finalize by accident.
-- THE OLD SIGNATURE STAYS AS A WRAPPER, not dropped. The live Worker calls the
-- three-argument form until its next deploy lands; dropping it here would make
-- every finalize in that window fail and hand the job to the lost sweeper -
-- the exact defect this migration fixes, caused by fixing it. PostgREST picks
-- the overload by the argument names in the body, so old and new code both
-- resolve. The wrapper passes p_ok := false, which is the old rule unchanged.
create or replace function public.edit_finalize(p_id text, p_result jsonb, p_ok boolean, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  update public.edit_jobs
     set state = 'done',
         billing = case when billing = 'reserved' then 'finalized' else billing end,
         result = coalesce(p_result, result),
         updated_at = now()
   where id = p_id
     and (published_at is not null
          or (publish_started_at is null and coalesce(p_ok, false)))
     and state not in ('cancelled','lost','failed')
   returning * into j;
  if found then
    return jsonb_build_object('ok', true, 'billing', j.billing, 'cost', j.cost, 'published', j.published_at is not null);
  end if;
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state,
    'error', case when j.published_at is null then 'not-published' else 'terminal' end);
end; $$;
create or replace function public.edit_finalize(p_id text, p_result jsonb, p_mint text)
returns jsonb language sql security definer
set search_path to 'public', 'private', 'extensions' as $$
  select public.edit_finalize(p_id, p_result, false, p_mint);
$$;
revoke all on function public.edit_finalize(text, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.edit_finalize(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.edit_finalize(text, jsonb, boolean, text) to service_role;
grant execute on function public.edit_finalize(text, jsonb, text) to service_role;
