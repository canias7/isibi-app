-- edit_refund: a finalized job is terminal, published or not.
--
-- Until 2026-09-01 `done` implied `published_at is not null`, so refund's
-- published guard covered it. edit_finalize now finalizes an ok answer that
-- never began publishing, so `done` can be unpublished - and refund's next
-- branches would then move a done job to `failed` with the money untouched:
-- a state that says the edit failed on a row whose stored reply says it
-- answered. Nothing calls refund on a done job today (the consumer refunds
-- only on `not-published`, the sweeper only on non-terminal rows); this closes
-- the hole rather than relying on that.
create or replace function public.edit_refund(p_id text, p_state text, p_note text, p_mint text)
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'extensions' as $$
declare j public.edit_jobs%rowtype; bal numeric;
begin
  if not private.mint_ok(p_mint) then raise exception 'bad key'; end if;
  if p_state not in ('failed','cancelled','lost') then raise exception 'bad state'; end if;
  select * into j from public.edit_jobs where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no-job'); end if;
  if j.published_at is not null then
    return jsonb_build_object('ok', false, 'error', 'published', 'state', j.state);
  end if;
  if j.state = 'done' then
    return jsonb_build_object('ok', false, 'error', 'terminal', 'state', j.state);
  end if;
  if j.publish_started_at is not null then
    update public.edit_jobs
       set state = p_state, needs_review = true,
           review_note = coalesce(p_note, 'died during publish'), updated_at = now()
     where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'needs-review', 'refunded', 0);
  end if;
  if j.billing = 'reserved' then
    update public.credits set balance = balance + j.cost, updated_at = now()
      where user_id = j.uid returning balance into bal;
    -- unique (ref, reason) IS THE SECOND GUARD. The conditional billing update
    -- below is the first; either alone would do, and a refund is the one
    -- operation worth being unable to repeat by two independent means.
    insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)
      values (j.uid, 'edit', p_id, 'refund', j.cost, coalesce(bal, 0))
      on conflict on constraint credit_events_once do nothing;
    update public.edit_jobs set billing = 'refunded', state = p_state, updated_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'refunded', j.cost, 'balance', bal);
  end if;
  -- exempt, none, finalized or already refunded: the state moves, the money
  -- does not. A founder refunded here would be credits created from nothing.
  update public.edit_jobs set state = p_state, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'refunded', 0, 'billing', j.billing);
end; $$;
