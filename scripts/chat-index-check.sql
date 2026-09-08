-- ONE CHAT, ONE SITE — DRIVEN AGAINST THE REAL DATABASE.
--
-- ── HOW TO RUN IT ──────────────────────────────────────────────────────────
--
-- Paste the whole file into a SQL console on the live project (or hand it to
-- the Supabase MCP `execute_sql`). It ends with `raise exception`, so the WHOLE
-- THING ROLLS BACK: no site row survives it, and the log of every check comes
-- back as the exception's message. `scripts/edit-rpc-check.sql` is the pattern.
--
-- ── WHY IT EXISTS ──────────────────────────────────────────────────────────
--
-- `site_backends_uid_chat_uniq` is the only thing stopping two builds a second
-- apart from both landing in one chat: both read "no site here", both insert.
-- NOT ONE of its properties can be proved by reading the DDL — a partial index,
-- a two-column key and `on conflict do nothing` all look right at rest and only
-- differ under a second writer. So it is DRIVEN, and reading `pg_indexes` is
-- explicitly not the proof (the `site_aliases` one-current-name index is the
-- precedent for that distinction).
--
-- Check 2c is the one the application leans on hardest: `claimSiteSlug` sends
-- PostgREST's `resolution=ignore-duplicates`, which is `on conflict do nothing`
-- with NO target, so it covers this index as well as the primary key. The claim
-- path reads the resulting empty representation and asks `siteForChat` which of
-- the two collisions it was. If that insert RAISED instead of answering
-- nothing, the claim would 500 rather than explain itself.
--
-- ── LAST RUN ───────────────────────────────────────────────────────────────
--
-- 2026-09-08, on the live project, immediately after the migration:
-- ALL 7 CHAT-INDEX CHECKS PASSED (transaction rolled back), 57 sites older
-- than the migration still unbound.
--
-- Check 4 is the owner's decision made into an assertion: the sites that
-- existed before 2026-09-08 stay unbound for ever, so an unlimited number of
-- null rows per owner is a permanent requirement, not a migration state.

DO $chk$
declare
  u uuid;
  u2 uuid;
  n int;
  refused text := '';
  log text := '';
  ok_count int := 0;
begin
  -- Two REAL owners: `site_backends.uid` carries a foreign key to `auth.users`,
  -- so a made-up uuid is refused by the wrong constraint and proves nothing.
  select uid into u from public.site_backends limit 1;
  select id into u2 from auth.users where id <> u limit 1;
  if u is null or u2 is null then raise exception 'need two real owners to test with'; end if;

  -- 1. A BOUND ROW GOES IN.
  insert into public.site_backends (slug, uid, neon_db, brief, chat_id)
    values ('zz-chk-a', u, '', 'check', 'site_1757000000000_abcde');
  ok_count := ok_count + 1;
  log := log || '1  a first bound row inserts' || chr(10);

  -- 2. A SECOND SITE IN THE SAME CHAT IS REFUSED BY POSTGRES — the property.
  begin
    insert into public.site_backends (slug, uid, neon_db, brief, chat_id)
      values ('zz-chk-b', u, '', 'check', 'site_1757000000000_abcde');
    raise exception 'FAIL 2 (a second site in one chat was ACCEPTED)';
  exception when unique_violation then
    refused := SQLERRM;
  end;
  -- BY THIS INDEX AND NOT ANOTHER. The slugs differ, so a refusal naming the
  -- primary key would mean the fixture, not the constraint under test.
  if refused not like '%site_backends_uid_chat_uniq%' then
    raise exception 'FAIL 2b (refused by something other than the chat index): %', refused;
  end if;
  ok_count := ok_count + 1;
  log := log || '2  a second site in the same chat is refused: ' || refused || chr(10);

  -- 2c. AND `on conflict do nothing` ANSWERS NOTHING RATHER THAN RAISING,
  --     which is what the claim path reads as "somebody else has this".
  insert into public.site_backends (slug, uid, neon_db, brief, chat_id)
    values ('zz-chk-b', u, '', 'check', 'site_1757000000000_abcde')
    on conflict do nothing;
  select count(*) into n from public.site_backends where slug = 'zz-chk-b';
  if n <> 0 then raise exception 'FAIL 2c (ignore-duplicates wrote the second site anyway): %', n; end if;
  ok_count := ok_count + 1;
  log := log || '2c on conflict do nothing writes nothing and does not raise' || chr(10);

  -- 3. THE SAME CHAT ID UNDER A DIFFERENT OWNER IS FINE. A chat id is minted in
  --    the browser, so two accounts could carry one; scoping by uid makes that
  --    harmless instead of a stranger's build being refused.
  insert into public.site_backends (slug, uid, neon_db, brief, chat_id)
    values ('zz-chk-c', u2, '', 'check', 'site_1757000000000_abcde');
  ok_count := ok_count + 1;
  log := log || '3  the same chat id under another owner inserts' || chr(10);

  -- 4. UNBOUND ROWS ARE UNLIMITED — every site built before this, and every
  --    build that sends no chat id (an older browser, a harness, a curl).
  insert into public.site_backends (slug, uid, neon_db, brief, chat_id)
    values ('zz-chk-d', u, '', 'check', null), ('zz-chk-e', u, '', 'check', null);
  select count(*) into n from public.site_backends where uid = u and chat_id is null;
  if n < 2 then raise exception 'FAIL 4 (two unbound rows did not both land): %', n; end if;
  ok_count := ok_count + 1;
  log := log || format('4  two more unbound rows insert (%s unbound for this owner)%s', n, chr(10));

  -- 5. A SECOND CHAT FOR THE SAME OWNER IS FINE — the constraint is one site
  --    per chat, never one site per customer.
  insert into public.site_backends (slug, uid, neon_db, brief, chat_id)
    values ('zz-chk-f', u, '', 'check', 'site_1757000000001_fghij');
  ok_count := ok_count + 1;
  log := log || '5  a second chat for the same owner inserts' || chr(10);

  -- 6. AND NOTHING THAT EXISTED BEFORE THE MIGRATION IS BOUND, FOR EVER.
  --    Nothing anywhere recorded which chat asked for those 57 sites, so a
  --    backfill could only ever guess; the owner's decision is that they stay
  --    loose. Dated rather than counted, deliberately: a count would go red the
  --    day the first real build binds itself, which is the check working
  --    correctly reported as a failure -- and a check that flags correct
  --    behaviour teaches the next session away from something that works.
  select count(*) into n from public.site_backends
    where chat_id is not null and created_at < timestamptz '2026-09-08 02:01:58+00';
  if n <> 0 then raise exception 'FAIL 6 (a site that predates the migration has been bound to a chat): %', n; end if;
  select count(*) into n from public.site_backends
    where created_at < timestamptz '2026-09-08 02:01:58+00';
  if n < 57 then raise exception 'FAIL 6b (the rows this check reads are gone, so check 6 proved nothing): %', n; end if;
  ok_count := ok_count + 1;
  log := log || format('6  all %s sites older than the migration are still unbound%s', n, chr(10));

  raise exception E'ALL % CHAT-INDEX CHECKS PASSED (transaction rolled back)\n%', ok_count, log;
end
$chk$;
