-- THE MISSED-NOTIFICATION COUNTER (2026-10-23, audit A12-9, owner's choice (a)).
-- PROPOSED, NOT APPLIED. A submission that arrives inside the five-minute
-- cooldown, or whose owner email could not go (no key, lookup or provider
-- failure), is counted here; the next email sent says "You missed N
-- notifications since the last email." and the count goes back to 0.
-- Until this is applied the Worker's two RPC calls answer 404 and are ignored:
-- notifications go out exactly as before, with no missed line.
alter table public.site_backends add column if not exists notify_missed integer not null default 0;

-- Count n more for a site whose notifications are on (an off site counts nothing).
create or replace function public.site_notify_missed_add(p_slug text, p_n integer)
returns void language sql security definer set search_path = public as $$
  update public.site_backends
     set notify_missed = least(coalesce(notify_missed, 0) + greatest(p_n, 0), 1000000)
   where slug = p_slug and notify is true;
$$;

-- Read and zero it in one statement (the claim's winner, before it sends).
create or replace function public.site_notify_missed_take(p_slug text)
returns integer language sql security definer set search_path = public as $$
  with old as (select slug, notify_missed from public.site_backends where slug = p_slug for update)
  update public.site_backends b set notify_missed = 0
    from old where b.slug = old.slug
  returning coalesce(old.notify_missed, 0);
$$;

revoke all on function public.site_notify_missed_add(text, integer) from public, anon, authenticated;
revoke all on function public.site_notify_missed_take(text) from public, anon, authenticated;
grant execute on function public.site_notify_missed_add(text, integer) to service_role;
grant execute on function public.site_notify_missed_take(text) to service_role;
