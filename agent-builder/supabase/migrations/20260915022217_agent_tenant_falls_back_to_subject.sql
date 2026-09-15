-- ============================================================================
-- THE TENANT FALLS BACK TO THE SIGNED-IN SUBJECT.
--
-- APPLIED LIVE 2026-09-15 to `ujrqdmmtcptvimazlhom` as remote version
-- 20260915022217, and named for that version. This file is not the record of what
-- is live; the database is.
--
-- WHY IT WAS NEEDED, stated plainly: the first migration keyed only on a
-- `tenant_id` claim, and SUPABASE DOES NOT PUT ONE IN A JWT. Every policy was
-- therefore correct and unsatisfiable — a real signed-in customer matched no rows,
-- for ever. **Verifying it over the real HTTP API is what exposed it**; the
-- SQL-level checks passed because they SET the claim by hand, which is a fixture
-- being more capable than reality.
--
-- SO: an explicit `tenant_id` claim still wins, and in its absence the tenant is
-- the subject (`sub`) — each signed-in user is their own tenant. That is the
-- conventional Supabase shape and needs no custom token hook. An explicit claim
-- remains available for the day one account holds many tenants.
--
-- `src/auth.mjs` MAKES THE SAME DECISION AND MUST STAY IN STEP: its
-- `TENANT_CLAIMS` is this same list in this same order, and a test reads this file
-- to check both the names and the ORDER. The first version of that test checked
-- only that `tenant_id` appeared, and it stayed green while the two sides
-- disagreed about exactly this fallback.
--
-- IT STILL FAILS CLOSED: no claims, unparseable claims, and claims with neither
-- `tenant_id` nor `sub` all answer NULL, and `tenant_id = NULL` is NULL rather
-- than true.
--
-- NOTE THE WIDENING, because it is real: before this, nothing a customer could
-- present matched any row. After it, a signed-in customer matches rows whose
-- tenant is their own uid. That is the intent — it is what makes the product
-- usable — but it is a widening and not a no-op.
-- ============================================================================

create or replace function agent.tenant_id() returns text
  language plpgsql stable
  set search_path = ''
as $$
declare
  claims jsonb;
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  return coalesce(
    nullif(claims ->> 'tenant_id', ''),   -- explicit, and it wins
    nullif(claims ->> 'sub', '')          -- otherwise the signed-in subject
  );
exception when others then
  -- Claims that will not parse are not a tenant. Anything we cannot read as an
  -- identity is not an identity.
  return null;
end;
$$;

comment on function agent.tenant_id() is
  'The calling tenant: the explicit tenant_id claim, else the signed-in subject. NULL when neither can be read, which matches no rows.';
