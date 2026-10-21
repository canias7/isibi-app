-- THE SITE'S OWN NAME, FOR EVERY DEVICE'S LIST (2026-10-21).
-- "The Table" was kept only in the browser that built the site, so another
-- device listed the address name ("the-table"). Written by each build
-- (`rememberSiteTitle`), read by `GET /api/site/list` as `title`. Until this is
-- applied the list asks again without the column and nothing changes.
alter table public.site_backends add column if not exists display_name text;
