-- The rest of the TRUNCATE sweep: the five that were missed the first time.
--
-- SAME DEFECT, SAME SHAPE, FOUND BY ASKING THE DATABASE RATHER THAN BY MEMORY.
-- The first pass covered the six tables that had come up in conversation; a
-- census of `public` for TRUNCATE held by `anon`/`authenticated` returned
-- sixteen more, five of which are structurally identical to the ones already
-- fixed: RLS enabled and ZERO policies, so not one row is readable or writable
-- by either role — and TRUNCATE, which is a table-level privilege evaluated
-- before any policy is consulted, empties the table anyway.
--
-- ZERO POLICIES IS WHAT MAKES THESE PROVABLY SAFE, and it is why they are here
-- while eleven others are not. With no policy, no grant on the table can be
-- serving any client feature: RLS refuses every row regardless. So there is
-- nothing to weigh — the only thing the privilege can be used for is the
-- destructive one.
--
--   autoreply_log          the dedup record that stops one Instagram comment
--                          being auto-replied to over and over
--   gen_charges            what each generation cost, per user
--   site_domains           custom domains, and which slug each answers for
--   site_hits              every published site's traffic, since the D1 era
--   storage_reservations   the ledger that keeps a gallery inside its cap
--
-- STILL HOLDING IT, DELIBERATELY LEFT: the eleven tables that DO have policies
-- (user_plan, user_memory, site_secrets, published_sites, site_users,
-- site_form_submissions, site_collections, user_assets, user_autoreply,
-- orchestrator_plan, video_editor_plan). A grant there may be load-bearing for
-- a policy, so each is a judgement rather than a sweep — see the reasoning in
-- the previous migration, where a REVOKE ALL would have left two policies
-- enforcing nothing.
--
-- Only TRUNCATE. Idempotent.
revoke truncate on public.autoreply_log        from anon, authenticated;
revoke truncate on public.gen_charges          from anon, authenticated;
revoke truncate on public.site_domains         from anon, authenticated;
revoke truncate on public.site_hits            from anon, authenticated;
revoke truncate on public.storage_reservations from anon, authenticated;
