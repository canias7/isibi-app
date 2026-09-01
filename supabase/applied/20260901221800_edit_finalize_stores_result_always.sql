-- edit_finalize: the reply is stored whether or not the job finalizes.
--
-- REGRESSION CAUGHT BY scripts/edit-rpc-check.sql (FAIL 9b) on 2026-09-01,
-- minutes after 20260901220500 was applied. The live function before it stored
-- p_result unconditionally - "so a customer polling a failed edit is told what
-- happened instead of a bare status" - and the applied-folder copy did not:
-- that behaviour was applied live earlier in the day and never recorded here,
-- so rewriting the function from the folder's text silently dropped it. The
-- folder is not the record; pg_get_functiondef is. A snapshot of every live
-- edit_* function is being added beside this file for that reason.
create or replace function public.edit_finalize(p_id text, p_result jsonb, p_ok boolean, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  -- THE REPLY FIRST, UNCONDITIONALLY. A refused finalize still leaves the
  -- customer something to read when they poll.
  update public.edit_jobs
     set result = coalesce(p_result, result), updated_at = now()
   where id = p_id and p_result is not null;
  update public.edit_jobs
     set state = 'done',
         billing = case when billing = 'reserved' then 'finalized' else billing end,
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
