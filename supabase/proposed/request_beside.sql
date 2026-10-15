-- JOBS OF ONE REQUEST SIDE BY SIDE (2026-10-15, the concurrent-execution round)
-- PROPOSED — NOT APPLIED. Applying it needs the owner's word, as every file in
-- ../applied/ did.
--
-- `private.site_busy` refuses a claim while any other job on the site holds a
-- live lease or is publishing (stage 6, 20260905200655_site_serialization.sql).
-- With `PARALLEL_WRITES=on` the request driver files several jobs of ONE
-- request at once, only when their targets do not conflict
-- (builder/request-plan.mjs `clearToWrite`), and each publishes under the
-- site's publish turn, applying only its own changes onto the site as it is
-- then (builder/publish-turn.mjs, worker.js `recompileAndPublish`).
--
-- This version answers exactly as before, except that a job whose idem key is
-- a request job's (`<request key>-p<n>-<seq>`, builder/request.mjs `jobKey`)
-- is not held back by another live job of the SAME request and account. A job
-- of another request, a page's own edit, a build and the platform rebuild
-- still refuse it, and it still refuses them. A row asking with no id (the
-- rebuild drain) is answered as before.
--
-- Safe either way round: with the switch off the driver never files two jobs
-- of one request at once, so the exemption is never reached; with the switch
-- on and this not applied, the second job waits on the site's lock as any
-- other job does (`site-busy`, deferred, counted) — slower, never unsafe.

CREATE OR REPLACE FUNCTION private.site_busy(p_slug text, p_self text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare other text; me public.edit_jobs%rowtype; grp text;
begin
  if p_slug is null or p_slug = '' then return null; end if;
  perform pg_advisory_xact_lock(hashtext('site:' || p_slug));
  -- THE ASKING JOB'S REQUEST, from its own idem key: null for anything that is
  -- not a request job, which is then held back by every other job, as before.
  if p_self is not null then
    select * into me from public.edit_jobs where id = p_self;
    if found and me.idem_key ~ '^[A-Za-z0-9_-]{16,64}-p[0-9]+-[0-9]+$' then
      grp := substring(me.idem_key from '^([A-Za-z0-9_-]{16,64})-p[0-9]+-[0-9]+$');
    end if;
  end if;
  select o.id into other from public.edit_jobs o
   where o.slug = p_slug and o.id is distinct from p_self
     and o.state not in ('done','failed','cancelled','lost')
     and o.needs_review = false
     and ((o.lease_owner is not null and o.lease_expires_at > now()) or o.state = 'publishing')
     -- ANOTHER JOB OF THE SAME REQUEST AND ACCOUNT is not a blocker.
     and not (grp is not null and o.uid = me.uid
              and coalesce(substring(o.idem_key from '^([A-Za-z0-9_-]{16,64})-p[0-9]+-[0-9]+$'), '') = grp)
   order by o.lease_expires_at desc nulls last
   limit 1;
  if other is not null then return other; end if;
  if exists (select 1 from public.site_rebuild r where r.slug = p_slug and r.running_until > now()) then return 'rebuild'; end if;
  return null;
end; $function$;

revoke all on function private.site_busy(text, text) from public, anon, authenticated;
