-- IS THIS SITE OFF THE WEB, RECORDED WHERE EVERY BROWSER CAN SEE IT.
--
-- Owner, 2026-09-08: "fix the offline flag on the server too". Until now the
-- only record of the switch was `site.offline` in the browser that pressed it,
-- so a site taken off the web on one machine read as live on another.
--
-- A TIMESTAMP, NOT A BOOLEAN, and the reason is the container. `takeOffline`
-- records nothing: it drops the site's Worker script and wipes `sites/<slug>/`,
-- leaving `source/`, `builds/` and the pointer untouched -- so an ordinary edit
-- afterwards recompiles, activates and uploads a script, and the site is live
-- again without `putBackOnline` ever running. A boolean would have to be cleared
-- by every path that republishes, and most of those now run inside the site's
-- container, where Supabase is reached through the job gateway whose table
-- allowlist admits no PATCH at all. The clear would be refused on exactly the
-- common path, and closing that would mean widening a security wall to keep a
-- convenience field honest.
--
-- A timestamp needs no such write. It records the moment of the switch, and
-- `builder/site-offline.mjs` decides the state by comparing it with the site's
-- own latest build -- a fact `/api/site/list` already reads. The flag ages out
-- of the way on its own.
--
-- NULLABLE AND PERMANENTLY SO. Null means "never taken off the web", which is
-- every one of the rows that exist today and the ordinary state for ever after;
-- it is not a migration state waiting to be backfilled. Deriving a value for the
-- existing rows would mean probing each site to see whether it serves, which is
-- one network call per site and is not what a page load may cost.
--
-- NO CHECK, NO INDEX, DELIBERATELY. There is nothing to enforce -- unlike
-- `chat_id`, no two rows can contradict each other here -- and the column is
-- read only alongside a row the caller already has by primary key.

alter table public.site_backends
  add column if not exists offline_at timestamptz;

comment on column public.site_backends.offline_at is
  'When this site was last taken off the web (POST /api/site/<slug>/offline). Null means it never was, which is the ordinary state. It is a RECORD of the switch, not the authority: a publish after this moment puts the site back up without clearing it, so readers compare it against the latest build (builder/site-offline.mjs siteOffline).';
