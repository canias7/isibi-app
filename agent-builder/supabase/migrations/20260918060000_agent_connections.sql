-- ══════════════════════════════════════════════════════════════════════════════
-- CONNECTIONS TO THINGS OUTSIDE — ownership, scopes, and a credential with one door
--
-- Milestone 8: *provider-independent connection ownership, scopes, credential
-- protection, refresh, disconnect, revocation … demonstrate a read action and an
-- approved write action, including expired credentials, revoked access, timeout and
-- uncertain outcome. Design explicitly for providers without idempotency support:
-- uncertain writes need reconciliation, not blind retries. Keep credentials out of
-- model context, tool results, and logs.*
--
-- ⚠ **PROVIDER-INDEPENDENT MEANS THE SCHEMA KNOWS NO PROVIDER.** `provider` is a text
-- name and nothing here branches on it: the scopes are strings, the credential is an
-- opaque string, the expiry is a timestamp. What a provider IS lives in the engine's own
-- adapter registry, which is code — the same division `agent.agents` already makes
-- between a customer's instructions (data) and its tools (code). So adding a real
-- provider is adding an adapter, not a migration.
--
-- ⚠ **THE CREDENTIAL HAS EXACTLY ONE DOOR, AND IT IS NOT A READ.** `secret` and
-- `refresh_secret` are selected by `agent.lease_connection` and by nothing else — not by
-- `agent.list_connections`, not by any view, not by any other function in this schema.
-- `authenticated` is granted SELECT on the table's other columns through a VIEW rather
-- than on the table, because a column grant on a table is one somebody widens with
-- `select *` and never notices.
--
-- ⚠ **AN UNCERTAIN WRITE IS RECONCILED THROUGH `agent.operations`, WHICH IS NOT IN THIS
-- FILE.** `operation_begin` / `operation_settle` live beside that table in
-- `20260918020000`, because the operations table's doors belong in one place: a reader
-- asking "how is an outbound action recorded" must not find two of the four here. What
-- belongs here is only the reason they exist — a provider with no idempotency needs a
-- record that can say *sent, outcome unknown*, and this is the first caller that can
-- reach that state.
--
-- ⚠ **A CONNECTION IS `(account, agent)`'s, LIKE A MEMORY AND UNLIKE A RUN.** An account
-- may connect the same provider twice and give each agent its own; agent A must not use
-- agent B's mailbox because they share an owner, and that is the wall no tenant filter
-- can see. Every function here puts BOTH in its lookup.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists agent.connections (
  id              uuid        primary key,
  tenant_id       text        not null check (length(tenant_id) between 1 and 200),
  -- COMPELLED, not nullable. A connection with no agent would be the account's, and then
  -- "which agent may use it" would be a second question with a second answer — see the
  -- header. One scope, one row.
  agent_id        uuid        not null,
  -- The provider's NAME. Bounded as an identifier so it can be a key in code, and
  -- deliberately not a foreign key to anything: the catalog is the engine's.
  provider        text        not null check (provider ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- What a PERSON calls it, and what the provider calls the account. Neither is secret:
  -- the label is for a screen and the account is what a person checks they connected the
  -- right thing.
  label           text        not null check (length(btrim(label)) between 1 and 120),
  account         text        not null check (length(btrim(account)) between 1 and 200),
  -- WHAT WAS GRANTED. A positive list, bounded, each entry an identifier — so a scope is
  -- something code can ask for by name and a model cannot invent one with a space in it.
  scopes          text[]      not null default '{}'::text[],
  -- ⚠ FOUR STATES, AND THEY ARE FOUR BECAUSE EACH NEEDS A DIFFERENT SENTENCE.
  --   active       — usable
  --   expired      — the credential's time is up; a REFRESH fixes it
  --   revoked      — the provider or an operator withdrew it; only reconnecting fixes it
  --   disconnected — the PERSON took it away; only they may put it back
  -- Collapsing any two would tell somebody to do the wrong thing about it. `expired` is
  -- also DERIVED from `expires_at` by every reader, so a clock passing needs no writer.
  status          text        not null default 'active',
  -- THE CREDENTIAL. One door: `agent.lease_connection`.
  secret          text        not null check (length(secret) between 1 and 8000),
  -- The refresh credential, if the provider has one. Null is a real answer — a provider
  -- with no refresh cannot be refreshed, which `refresh_connection` says by name.
  refresh_secret  text        check (refresh_secret is null or length(refresh_secret) between 1 and 8000),
  -- NULL MEANS NO EXPIRY, which is a real answer for a long-lived key. A reader must not
  -- read it as "expired now" — the fail-closed direction here would refuse every
  -- connection that has no clock.
  expires_at      timestamptz,
  -- ⚠ **WHETHER THERE IS A WAY TO REFRESH, AS A GENERATED COLUMN — and that is what makes
  -- the credential unreadable rather than merely unselected.** A screen needs this fact and
  -- the view is `security_invoker`, so the view reads every column AS THE CALLER: computing
  -- it as `refresh_secret is not null` inside the view would mean granting `authenticated`
  -- SELECT on `refresh_secret` for the view to work at all, which is the protection gone.
  -- Generated here, the fact is a column of its own, the grant below is a positive list that
  -- names neither secret, and the two cannot disagree — the same device `run_entries` uses
  -- for `kind`, `step` and `idx`.
  refreshable     boolean     not null generated always as (refresh_secret is not null) stored,
  -- Why it stopped being usable, in the words of whoever stopped it. Null while active.
  stopped_why     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint connections_status_known check (status in ('active', 'expired', 'revoked', 'disconnected')),
  -- ⚠ THE SCOPES' SHAPE IS CHECKED OVER THE JOINED LIST, exactly as `agents_tools_shape`
  -- does, and the one stated limit is the same: an element containing a comma reads as two
  -- and passes. That is not a hole, because such a scope matches no adapter's own list.
  constraint connections_scopes_shaped check (
    coalesce(array_length(scopes, 1), 0) <= 32
    and array_position(scopes, null) is null
    and array_to_string(scopes, ',') ~ '^[a-z0-9_.:,-]*$'),
  -- ONE LIVE CONNECTION PER (agent, provider, account), so reconnecting the same mailbox
  -- twice cannot leave two rows a reader has to choose between. Partial, so a
  -- disconnected or revoked row stays as the record of what happened.
  constraint connections_label_shaped check (btrim(label) = label)
);

create unique index if not exists connections_one_live_per_account
  on agent.connections (tenant_id, agent_id, provider, account)
  where status = 'active';

create index if not exists connections_by_agent
  on agent.connections (tenant_id, agent_id, provider);

alter table agent.connections enable row level security;
alter table agent.connections force row level security;

/**
 * ⚠ **THE POLICY IS ON THE TABLE AND THE GRANT IS ON A VIEW, and the pair is the whole
 * credential argument.** A tenant needs to SEE its connections — a screen lists them — and
 * a table grant is what somebody widens with `select *`. So `authenticated` gets nothing
 * on the table at all and reads `agent.connection_list` instead, which cannot name the
 * secret because the view does not select it.
 */
drop policy if exists connections_own on agent.connections;
create policy connections_own on agent.connections
  for select to authenticated
  using (tenant_id = agent.tenant_id());

create or replace view agent.connection_list
  with (security_invoker = true) as
  select c.id, c.tenant_id, c.agent_id, c.provider, c.label, c.account, c.scopes,
         -- THE STATUS A READER SHOULD ACT ON, with the clock folded in: a row still marked
         -- `active` whose time is up reads `expired` here, so nothing has to go round
         -- stamping rows and no reader has to remember to compare.
         case when c.status <> 'active' then c.status
              when c.expires_at is not null and c.expires_at <= now() then 'expired'
              else 'active' end as status,
         c.expires_at, c.stopped_why, c.created_at, c.updated_at,
         -- READ FROM THE GENERATED COLUMN, never computed here — see its own note: under
         -- `security_invoker` a view that touched `refresh_secret` would need the CALLER to
         -- hold SELECT on it.
         c.refreshable
    from agent.connections c;

comment on view agent.connection_list is
  'Every connection but its credentials. `security_invoker = true` is the whole safety argument: without it the view runs as its OWNER and is a hole through the policy on the table. It selects neither secret, so there is nothing for a reader to widen.';

-- ══════════════════════════════════════════════════════════════════════════════
-- CONNECTING, AND TAKING IT AWAY
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function agent.connect_provider(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_provider text,
  p_label    text,
  p_account  text,
  p_scopes   text[],
  p_secret   text,
  p_refresh  text default null,
  p_expires  timestamptz default null,
  p_max      integer default 20
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_agent agent.agents;
  v_held  integer;
  v_row   agent.connections;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'connect_provider: tenant must be a non-empty string';
  end if;
  if p_secret is null or btrim(p_secret) = '' then
    raise exception 'connect_provider: a credential is required' using errcode = 'check_violation';
  end if;

  -- WHOSE AGENT IS THIS. Answered as a VALUE: another account's agent and one that is not
  -- there are the same answer, because the difference between them is information.
  select * into v_agent from agent.agents where id = p_agent_id and tenant_id = p_tenant;
  if v_agent.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-agent');
  end if;

  select count(*) into v_held from agent.connections
   where tenant_id = p_tenant and agent_id = p_agent_id and status = 'active';
  if v_held >= greatest(1, coalesce(p_max, 20)) then
    return jsonb_build_object('ok', false, 'error', 'too-many', 'held', v_held);
  end if;

  -- ⚠ RECONNECTING THE SAME ACCOUNT REPLACES IT RATHER THAN ADDING A SECOND, and the old
  -- row is kept as the RECORD: `disconnected`, with its own reason. Deleting it would lose
  -- the only evidence that a credential was ever in use, which is what somebody auditing an
  -- outbound action needs. The partial unique index is what makes this necessary rather
  -- than optional.
  --
  -- ⚠ **AND IT MUST NOT REPLACE THE ROW THIS PRESS IS ABOUT — `id <> p_id`, which was
  -- MEASURED MISSING.** Without it a RETRY of one press disconnects its own connection: the
  -- UPDATE runs before the insert, the insert is absorbed by `on conflict (id) do nothing`,
  -- and the answer is `{ok: true, repeat: true}` about a row that is now `disconnected` and
  -- cannot be leased. Reproduced on a real PostgreSQL — press, press again, lease refused
  -- `disconnected / replaced by a new connection` — so the caller is told "already
  -- connected" about a credential it has just destroyed. A replace is about the OTHER row.
  update agent.connections
     set status = 'disconnected', stopped_why = 'replaced by a new connection', updated_at = now()
   where tenant_id = p_tenant and agent_id = p_agent_id
     and provider = p_provider and account = p_account and status = 'active'
     and id <> p_id;

  insert into agent.connections
    (id, tenant_id, agent_id, provider, label, account, scopes, secret, refresh_secret, expires_at)
  values (p_id, p_tenant, p_agent_id, p_provider, btrim(p_label), p_account,
          coalesce(p_scopes, '{}'::text[]), p_secret, p_refresh, p_expires)
  on conflict (id) do nothing
  returning * into v_row;

  -- A REPEATED PRESS IS ABSORBED, and the answer is the row that is really there. The id is
  -- the browser's or the engine's own, so a retry carries the same one.
  if v_row.id is null then
    select * into v_row from agent.connections where id = p_id and tenant_id = p_tenant;
    if v_row.id is null then
      return jsonb_build_object('ok', false, 'error', 'not-yours');
    end if;
    return jsonb_build_object('ok', true, 'repeat', true, 'connection', v_row.id);
  end if;
  return jsonb_build_object('ok', true, 'connection', v_row.id, 'scopes', to_jsonb(v_row.scopes));
end $$;

comment on function agent.connect_provider(text, uuid, uuid, text, text, text, text[], text, text, timestamptz, integer) is
  'Store a credential for one (account, agent, provider, provider-account). Answers the connection id and NEVER the credential. Reconnecting the same provider account replaces the live row and keeps the old one as `disconnected`, because the old row is the only record that a credential was ever in use.';

create or replace function agent.disconnect_connection(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_why      text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_row agent.connections;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'disconnect_connection: tenant must be a non-empty string';
  end if;
  -- ⚠ **THE CREDENTIAL IS DESTROYED, NOT MERELY FLAGGED.** A disconnect is a person saying
  -- "stop using this", and a row that still holds the secret is one a bug can still lease.
  -- The ROW stays as the record — who, when, why — and what goes is the only part that can
  -- do anything. There is no undo, which is the point: reconnecting means granting again.
  update agent.connections
     set status = 'disconnected', secret = '-', refresh_secret = null,
         stopped_why = coalesce(nullif(btrim(p_why), ''), 'disconnected'), updated_at = now()
   where tenant_id = p_tenant and agent_id = p_agent_id and id = p_id
     and status <> 'disconnected'
  returning * into v_row;
  if v_row.id is null then
    -- ALREADY DISCONNECTED IS A SUCCESS, and it says so: a second press must not read as a
    -- connection that is not theirs. Not-theirs and not-there stay one answer.
    if exists (select 1 from agent.connections
                where tenant_id = p_tenant and agent_id = p_agent_id and id = p_id) then
      return jsonb_build_object('ok', true, 'repeat', true, 'status', 'disconnected');
    end if;
    return jsonb_build_object('ok', false, 'error', 'no-connection');
  end if;
  return jsonb_build_object('ok', true, 'status', 'disconnected');
end $$;

comment on function agent.disconnect_connection(text, uuid, uuid, text) is
  'A PERSON takes a connection away. The credential is destroyed rather than flagged — a row that still holds it is one a bug can still lease — and the row stays as the record of what was in use.';

create or replace function agent.revoke_connection(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_why      text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_row agent.connections;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'revoke_connection: tenant must be a non-empty string';
  end if;
  -- ⚠ **REVOKED IS NOT DISCONNECTED, AND THE DIFFERENCE IS WHO DID IT.** A person
  -- disconnecting means "I do not want this any more"; a revocation means the PROVIDER or an
  -- operator withdrew the grant, so reconnecting is a conversation with them rather than a
  -- button here. Two states, two sentences — and the credential goes either way, because a
  -- withdrawn grant is not something to keep trying.
  update agent.connections
     set status = 'revoked', secret = '-', refresh_secret = null,
         stopped_why = coalesce(nullif(btrim(p_why), ''), 'revoked by the provider'), updated_at = now()
   where tenant_id = p_tenant and agent_id = p_agent_id and id = p_id and status <> 'revoked'
  returning * into v_row;
  if v_row.id is null then
    if exists (select 1 from agent.connections
                where tenant_id = p_tenant and agent_id = p_agent_id and id = p_id) then
      return jsonb_build_object('ok', true, 'repeat', true, 'status', 'revoked');
    end if;
    return jsonb_build_object('ok', false, 'error', 'no-connection');
  end if;
  return jsonb_build_object('ok', true, 'status', 'revoked');
end $$;

comment on function agent.revoke_connection(text, uuid, uuid, text) is
  'The PROVIDER or an operator withdrew the grant. Distinct from a disconnect because reconnecting is a conversation with them rather than a button here, and a reader that collapsed the two would tell somebody to do the wrong thing about it.';

-- ══════════════════════════════════════════════════════════════════════════════
-- THE ONE DOOR TO THE CREDENTIAL
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function agent.lease_connection(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_scopes   text[] default '{}'::text[]
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row     agent.connections;
  v_missing text[];
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'lease_connection: tenant must be a non-empty string';
  end if;
  -- BOTH IN THE LOOKUP. The tenant stops another account and the agent stops another agent
  -- of the SAME account, which no tenant filter can see.
  select * into v_row from agent.connections
   where tenant_id = p_tenant and agent_id = p_agent_id and id = p_id;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-connection');
  end if;

  -- ⚠ THE REFUSALS ARE FOUR AND EACH IS ITS OWN, in the order a person would want them:
  -- what somebody did to it first, then what the clock did. A `revoked` row whose time has
  -- also passed is REVOKED, because that is the fact somebody has to act on.
  if v_row.status = 'disconnected' then
    return jsonb_build_object('ok', false, 'error', 'disconnected', 'why', v_row.stopped_why);
  end if;
  if v_row.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked', 'why', v_row.stopped_why);
  end if;
  if v_row.expires_at is not null and v_row.expires_at <= now() then
    -- ⚠ EXPIRED IS DERIVED AND IS **NOT** WRITTEN BACK. Writing it would be a second copy of
    -- a fact the clock already states, and it would need a writer with a lease. The reader
    -- says so and `refresh_connection` is what changes it.
    return jsonb_build_object('ok', false, 'error', 'expired', 'expiredAt', v_row.expires_at,
                              'refreshable', v_row.refreshable);
  end if;
  if v_row.status <> 'active' then
    -- A status this function does not know: refused rather than leased. Cannot-tell must
    -- never read as usable, and this is the one branch where being wrong hands out a
    -- credential.
    return jsonb_build_object('ok', false, 'error', 'not-usable', 'status', v_row.status);
  end if;

  -- ⚠ **THE SCOPES ARE A POSITIVE CHECK AND THE MISSING ONES ARE NAMED.** A filter would be
  -- a silent drop — the action would go out with less permission than it needs and fail at
  -- the provider, which is a sentence about them rather than about us.
  select coalesce(array_agg(s), '{}'::text[]) into v_missing
    from unnest(coalesce(p_scopes, '{}'::text[])) s
   where not (s = any (v_row.scopes));
  if coalesce(array_length(v_missing, 1), 0) > 0 then
    return jsonb_build_object('ok', false, 'error', 'scope-missing',
                              'missing', to_jsonb(v_missing), 'granted', to_jsonb(v_row.scopes));
  end if;

  return jsonb_build_object(
    'ok', true, 'connection', v_row.id, 'provider', v_row.provider, 'account', v_row.account,
    'scopes', to_jsonb(v_row.scopes), 'expiresAt', v_row.expires_at,
    -- THE CREDENTIAL, and this is the only place in the schema it is selected.
    'secret', v_row.secret);
end $$;

comment on function agent.lease_connection(text, uuid, uuid, text[]) is
  'THE ONE DOOR TO A CREDENTIAL. Refuses by name for each of the four ways a connection is unusable — disconnected, revoked, expired, and a status it does not recognise — and refuses a scope it was not granted rather than sending the action with less permission than it needs. service_role only.';

create or replace function agent.refresh_connection(
  p_tenant   text,
  p_agent_id uuid,
  p_id       uuid,
  p_secret   text,
  p_refresh  text default null,
  p_expires  timestamptz default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare v_row agent.connections;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'refresh_connection: tenant must be a non-empty string';
  end if;
  if p_secret is null or btrim(p_secret) = '' then
    raise exception 'refresh_connection: a credential is required' using errcode = 'check_violation';
  end if;
  select * into v_row from agent.connections
   where tenant_id = p_tenant and agent_id = p_agent_id and id = p_id;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-connection');
  end if;
  -- ⚠ **A REFRESH CANNOT REVIVE WHAT SOMEBODY STOPPED.** Expiry is the clock and a refresh is
  -- its answer; a disconnect and a revocation are decisions, and letting a refresh undo one
  -- would make the engine able to put back what a person took away. Only reconnecting does
  -- that, and only a person can reconnect.
  if v_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', v_row.status, 'why', v_row.stopped_why);
  end if;
  -- AND IT NEEDS SOMETHING TO REFRESH WITH, said by name: a provider with no refresh
  -- credential cannot be refreshed, and answering `ok` would be a control that does nothing.
  if v_row.refresh_secret is null then
    return jsonb_build_object('ok', false, 'error', 'not-refreshable');
  end if;
  update agent.connections
     set secret = p_secret,
         -- A PROVIDER THAT DOES NOT ROTATE ITS REFRESH CREDENTIAL KEEPS THE ONE IT HAS.
         -- `coalesce` rather than an assignment, because a null here means "unchanged" and
         -- writing it would throw away the only way to refresh again.
         refresh_secret = coalesce(p_refresh, v_row.refresh_secret),
         expires_at = p_expires, updated_at = now()
   where id = p_id and tenant_id = p_tenant
  returning * into v_row;
  return jsonb_build_object('ok', true, 'connection', v_row.id, 'expiresAt', v_row.expires_at);
end $$;

comment on function agent.refresh_connection(text, uuid, uuid, text, text, timestamptz) is
  'Rotate a credential and its expiry. It cannot revive a disconnected or revoked connection: expiry is the clock and a refresh is its answer, while those two are decisions only a person can reverse by granting again.';

-- ══════════════════════════════════════════════════════════════════════════════
-- PRIVILEGES — `service_role` alone, because every function takes the tenant as an
-- ARGUMENT and a customer who could call one could name somebody else's account.
-- ══════════════════════════════════════════════════════════════════════════════

revoke all on table agent.connections from public;
revoke all on table agent.connections from anon;
revoke all on table agent.connections from authenticated;
-- ⚠ **A COLUMN-LEVEL GRANT, AND IT IS WHAT `security_invoker` REQUIRES — measured, after a
-- version of this file granted nothing here at all.** A `security_invoker` view runs its
-- own query AS THE CALLER, so with no grant on the base table `authenticated` reading
-- `agent.connection_list` is refused `permission denied for table connections`: the screen
-- shows nothing and the wall is not protecting anything, it is just broken. My own check
-- passed over it by asserting `count <> '0'`, which an empty answer satisfies — *a negative
-- assertion needs its observer alive*, and this is the second time in this product that a
-- `security_invoker` view has needed the caller's own SELECT.
--
-- **IT IS A POSITIVE LIST AND NEITHER SECRET IS ON IT.** So `select *` from the table is
-- refused for this role rather than widened — Postgres checks the columns a query really
-- names — and `refreshable` is a generated column precisely so that the one fact a screen
-- needs about the refresh credential does not require reading it.
grant select (id, tenant_id, agent_id, provider, label, account, scopes, status,
              refreshable, expires_at, stopped_why, created_at, updated_at)
  on table agent.connections to authenticated;
-- ⚠ **AND THE SAME POSITIVE LIST FOR `service_role`, WHICH IS THE ROLE THIS ENGINE RUNS AS —
-- MEASURED, after a version of this file granted it the whole table.** The header above says
-- the credential has ONE DOOR and it is not a read; that was true of the SCHEMA and false of
-- the PRIVILEGES, because `grant select on table` includes `secret`. Measured before the fix:
-- `has_column_privilege('service_role','agent.connections','secret','select')` answered TRUE
-- and the ACL read `service_role=arw/postgres` — so the Worker could have asked PostgREST for
-- every customer's credential with one query. This is the treatment `agent.run_entries`
-- already has (`revoke insert … from service_role`, so a direct write is refused by a
-- privilege rather than by our own good intentions), applied to a READ.
--
-- **INSERT AND UPDATE GO ENTIRELY**, because all five functions are `security definer` and
-- therefore run as the OWNER: the role calling them needs no table grant at all. What it does
-- need is SELECT on the columns `agent.connection_list` names, because that view is
-- `security_invoker` and its query runs as whoever reads it — including this role.
grant select (id, tenant_id, agent_id, provider, label, account, scopes, status,
              refreshable, expires_at, stopped_why, created_at, updated_at)
  on table agent.connections to service_role;

revoke all on agent.connection_list from public;
revoke all on agent.connection_list from anon;
grant select on agent.connection_list to authenticated;
grant select on agent.connection_list to service_role;

revoke all on function agent.connect_provider(text, uuid, uuid, text, text, text, text[], text, text, timestamptz, integer) from public;
revoke all on function agent.disconnect_connection(text, uuid, uuid, text) from public;
revoke all on function agent.revoke_connection(text, uuid, uuid, text) from public;
revoke all on function agent.lease_connection(text, uuid, uuid, text[]) from public;
revoke all on function agent.refresh_connection(text, uuid, uuid, text, text, timestamptz) from public;

grant execute on function agent.connect_provider(text, uuid, uuid, text, text, text, text[], text, text, timestamptz, integer) to service_role;
grant execute on function agent.disconnect_connection(text, uuid, uuid, text) to service_role;
grant execute on function agent.revoke_connection(text, uuid, uuid, text) to service_role;
grant execute on function agent.lease_connection(text, uuid, uuid, text[]) to service_role;
grant execute on function agent.refresh_connection(text, uuid, uuid, text, text, timestamptz) to service_role;
