-- Take TRUNCATE off the platform's service-only tables.
--
-- WHY THIS IS NOT COVERED BY RLS, which is the whole finding. Every table below
-- has RLS enabled, so a row is readable or writable only where a policy says so
-- — and five of the six have either no policies at all or a single own-row read.
-- TRUNCATE IS NOT SUBJECT TO RLS. It is a table-level privilege that empties the
-- table without evaluating a single policy, so the grant alone was a way to
-- destroy the platform's Neon connection records, its site registry, its
-- scheduled jobs, its teardown queue and every pending webhook delivery, without
-- ever matching a rule that was supposed to stop it.
--
-- IT CAME FROM A DEFAULT, NOT A DECISION. Supabase grants ALL on every table in
-- `public` to `anon` and `authenticated` as a project default, so each of these
-- tables picked it up at creation and nobody chose it. Consistency across the
-- six was what made it easy to miss: they all looked the same, and they were all
-- wrong in the same way.
--
-- NOT REACHABLE THROUGH POSTGREST, which exposes no TRUNCATE — so this is a
-- privilege whose safety rested entirely on the surface area of one API in front
-- of it. That is not a reason to keep it.
--
-- ONLY TRUNCATE IS REVOKED, and that restraint is load-bearing rather than
-- timid. Two of these tables have policies the product depends on:
--
--   site_backends   "own read" (SELECT)  — a signed-in user reading their sites
--   site_functions  "owner reads functions" (SELECT),
--                   "owner deletes functions" (DELETE)
--
-- A `REVOKE ALL` here reads tidier and would silently break both: RLS decides
-- WHICH rows, the grant decides whether the role may ask at all, so removing the
-- grant makes a policy that permits the row moot. The Worker is unaffected
-- either way — it uses `service_role`, which bypasses both.
--
-- Idempotent: revoking a privilege that is not held is a no-op.
revoke truncate on public.site_project       from anon, authenticated;
revoke truncate on public.user_site_project  from anon, authenticated;
revoke truncate on public.site_backends      from anon, authenticated;
revoke truncate on public.site_functions     from anon, authenticated;
revoke truncate on public.neon_teardown      from anon, authenticated;

-- Already service-only by an earlier migration (`webhook_queue_service_only`
-- revoked everything). Named here anyway so this file is the whole answer to
-- "which tables had TRUNCATE taken off them", and because a re-run must not
-- leave the newest table out of the set it belongs to.
revoke truncate on public.webhook_queue      from anon, authenticated;
