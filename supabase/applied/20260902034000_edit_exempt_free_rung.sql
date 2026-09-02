-- A FREE RUNG IS EXEMPTED BEFORE THE PUBLISH GATE.
--
-- Found live 2026-09-02 (gap sweep run 10, the logo lane on fretwork-1). The
-- consumer reserves credits when a rung first reports model usage; a rung that
-- makes no model call never does, so its job's billing stayed `none`.
-- `edit_may_publish` grants only `reserved` or `exempt`, answered `unbilled`,
-- the spine returned `not-granted`, and the customer was told the compile had
-- failed while the container had just compiled the site (23 files, 200).
--
-- The fix is a state, not a looser gate: a job whose rung spent nothing is
-- marked `exempt` by the consumer that holds its lease, immediately before the
-- gate. A job that has already reserved is refused (`billed`) — money that
-- moved is not free, and the caller's own count of reserves is not the record.
-- Everything downstream already understands `exempt`: the gate grants it,
-- finalize keeps it, refund moves no money for it.
create or replace function public.edit_exempt(p_id text, p_owner text, p_mint text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'extensions'
as $function$
declare j public.edit_jobs%rowtype;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_owner is null or length(p_owner) < 4 then raise exception 'bad owner'; end if;
  update public.edit_jobs
     set billing = 'exempt', cost = 0, updated_at = now()
   where id = p_id
     and lease_owner = p_owner
     and lease_expires_at > now()
     and cancel_requested_at is null
     and needs_review = false
     and state not in ('done','failed','cancelled','lost')
     and billing = 'none'
   returning * into j;
  if found then return jsonb_build_object('ok', true, 'billing', 'exempt', 'state', j.state); end if;
  select * into j from public.edit_jobs where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  return jsonb_build_object('ok', false, 'state', j.state, 'billing', j.billing,
    'error', case when j.state in ('done','failed','cancelled','lost') then 'terminal'
                  when j.cancel_requested_at is not null then 'cancelled'
                  when j.needs_review then 'needs-review'
                  when j.lease_owner is distinct from p_owner then 'lease-lost'
                  when j.lease_expires_at <= now() then 'lease-expired'
                  when j.billing <> 'none' then 'billed'
                  else 'refused' end);
end; $function$;

revoke all on function public.edit_exempt(text, text, text) from public, anon, authenticated;
grant execute on function public.edit_exempt(text, text, text) to service_role;
