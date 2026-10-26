-- THE SITE ERROR LOG (2026-10-26, branch `site-signals`).
-- PROPOSED, NOT APPLIED. One row per (site, fingerprint): the same fault seen
-- again raises `count` and `last_seen`. Messages arrive scrubbed by the Worker
-- (`builder/site-signals.mjs`: emails, phone numbers, tokens and keys removed).
-- Until this is applied the Worker's RPC calls answer 404 and are ignored: no
-- visitor request waits on them, and the explore tool `site_errors` answers
-- "could not be read".
create table if not exists public.site_errors (
  slug        text        not null,
  fingerprint text        not null check (fingerprint ~ '^[0-9a-f]{32}$'),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  count       integer     not null default 1 check (count >= 1),
  source      text        not null check (source in ('browser', 'server')),
  route       text        not null default '/' check (char_length(route) <= 210),
  kind        text        not null default 'error' check (char_length(kind) <= 40),
  message     text        not null check (char_length(message) <= 310),
  primary key (slug, fingerprint)
);
create index if not exists site_errors_slug_last_seen on public.site_errors (slug, last_seen desc);
create index if not exists site_errors_last_seen on public.site_errors (last_seen);

alter table public.site_errors enable row level security;
-- No policy: only the service role (the Worker) reads or writes it.
revoke all on table public.site_errors from public, anon, authenticated;

-- One sighting: insert, or count it again. A site at its cap of 500
-- fingerprints loses its stalest one to make room, so the log stays recent.
create or replace function public.site_error_hit(
  p_slug text, p_fingerprint text, p_source text, p_kind text, p_route text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.site_errors
     set count = least(count + 1, 2000000000), last_seen = now()
   where slug = p_slug and fingerprint = p_fingerprint;
  if found then return; end if;
  if (select count(*) from public.site_errors where slug = p_slug) >= 500 then
    delete from public.site_errors
     where (slug, fingerprint) in (
       select slug, fingerprint from public.site_errors
        where slug = p_slug order by last_seen asc
        limit (select count(*) - 499 from public.site_errors where slug = p_slug));
  end if;
  insert into public.site_errors (slug, fingerprint, source, kind, route, message)
  values (p_slug, p_fingerprint, p_source, p_kind, left(coalesce(p_route, '/'), 210), left(p_message, 310))
  on conflict (slug, fingerprint) do update
    set count = least(public.site_errors.count + 1, 2000000000), last_seen = now();
end;
$$;

-- Retention: anything not seen for 30 days goes. Called by the Worker's cron.
create or replace function public.site_errors_prune()
returns integer language sql security definer set search_path = public as $$
  with gone as (delete from public.site_errors where last_seen < now() - interval '30 days' returning 1)
  select count(*)::int from gone;
$$;

revoke all on function public.site_error_hit(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.site_errors_prune() from public, anon, authenticated;
grant execute on function public.site_error_hit(text, text, text, text, text, text) to service_role;
grant execute on function public.site_errors_prune() to service_role;
grant select on table public.site_errors to service_role;
