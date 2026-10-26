-- THE SITE'S LIMITED LOGIN, RECORDED (2026-10-26, `site-app-login.mjs`).
-- Each site database gets a second Postgres login, `<db>_app`, that can read
-- and write rows and nothing else; its connection string (with its password)
-- is kept here, beside the owner's `neon_conn`, in the same table: RLS on with
-- NO policies, so only the service key can read it. Until this is applied the
-- Worker reads the column's absence as "no limited login yet": every path
-- stays on the owner's login and the backfill tick does nothing.
alter table public.site_project add column if not exists app_conn text;
