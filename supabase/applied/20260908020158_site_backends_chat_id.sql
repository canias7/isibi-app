-- A SITE BELONGS TO THE CHAT THAT BUILT IT.
--
-- Owner, 2026-09-08: "the problem is that is the build gotta stay in that chat,
-- not make a new one" -- and, on the sites that were already loose, "idc abut
-- past stuff, but lets fix anything fro future stuff".
--
-- THE COLUMN IS NULLABLE AND STAYS THAT WAY. 57 rows exist and not one of them
-- can be attached to a chat: nothing anywhere recorded which workspace asked for
-- them, and the owner's decision is that they stay unbound. So null is a real
-- and permanent value here, not a migration state waiting to be backfilled --
-- every reader must work with it absent, and the index below is partial for
-- exactly that reason.
--
-- IT IS `chat_id`, NOT `project_id`. The plan said project; `project` already
-- means a NEON project in this schema (`site_project`), and this column sits
-- directly beside `neon_db`, so a reader would take it for the Neon project's
-- id. `chat_id` is the owner's own word and collides with nothing.
--
-- WHAT POSTGRES ENFORCES AND WHAT THE APPLICATION ENFORCES, split deliberately.
-- The SHAPE of a chat id (`CHAT_ID_RE` in `builder/site-chat.mjs`) is the
-- application's, because a CHECK here would be a second copy of that rule in a
-- second language and the two would drift silently -- the recorded "two lists of
-- the same thing". UNIQUENESS is Postgres's, because it is the one thing no
-- application check survives concurrency: two builds submitted a second apart
-- both read "no site in this chat" and both insert. The `site_aliases`
-- one-current-name index is the precedent for exactly this division.
--
-- SCOPED BY OWNER. A chat id is minted in the browser, so two accounts could in
-- principle carry the same one (a copied link, a restored profile). Scoping the
-- constraint to `uid` makes that harmless instead of a stranger's build being
-- refused.

alter table public.site_backends
  add column if not exists chat_id text;

comment on column public.site_backends.chat_id is
  'The workspace/chat that built this site (public/chat.js mints it as origin). Null for every site built before 2026-09-08 and for any build that sent none; those stay unbound by the owner''s decision.';

create unique index if not exists site_backends_uid_chat_uniq
  on public.site_backends (uid, chat_id)
  where chat_id is not null;
