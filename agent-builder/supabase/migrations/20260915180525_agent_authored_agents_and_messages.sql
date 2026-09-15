-- ============================================================================
-- CUSTOMER-AUTHORED AGENTS, AND THE CONVERSATIONS WITH THEM.
--
-- SEPARATE FROM EXECUTION, ON PURPOSE AND BY CONSTRUCTION. `agent.runs` and
-- `agent.run_entries` are the record of work that RAN: append-only, fenced,
-- claimed, replayed. Nothing here is any of those things. These two tables are
-- what a person WROTE — a name, an instruction, and the messages they typed —
-- and they are edited and deleted freely, which is the opposite of a journal.
-- Mixing them would put mutable rows in a store whose whole value is that its
-- rows cannot change, and there is no foreign key between the two halves.
--
-- WHOSE THEY ARE IS NEVER THE BROWSER'S TO SAY. `tenant_id` is written by the
-- server from a verified token; row level security below matches it against
-- `agent.tenant_id()`, which reads the request's own JWT and fails closed.
-- ============================================================================

-- ── what a person wrote ─────────────────────────────────────────────────────
create table if not exists agent.agents (
  id           uuid primary key,
  tenant_id    text not null check (length(tenant_id) between 1 and 200),
  name         text not null check (length(btrim(name)) between 1 and 200),
  instructions text not null check (length(btrim(instructions)) between 1 and 8000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The list is read newest-first for one tenant, and that is the only way it is
-- ever read.
create index if not exists agents_by_tenant on agent.agents (tenant_id, updated_at desc);

-- ── what was said to it ─────────────────────────────────────────────────────
--
-- `seq` IS AN IDENTITY, NOT A TIMESTAMP. Two messages can share a millisecond,
-- and an order that ties is not an order; this one is assigned by the database
-- and is total.
--
-- **NO `tenant_id` COLUMN, DELIBERATELY** — the same rule `run_entries` follows:
-- a message's tenant is its agent's tenant, and a copy here could disagree with
-- the row it points at. The disagreeing case is the one where somebody reads
-- another account's conversation.
--
-- ⚠ `role` ADMITS ONE VALUE. Nothing may be stored as having come from the
-- agent, because nothing has: no model is wired to this feature. A fake reply
-- is not a UI mistake to be fixed in the client, it is a row that must not
-- exist — so the refusal lives here, where no client bug can get past it.
-- Widening this is a deliberate migration on the day something really answers.
create table if not exists agent.agent_messages (
  id         uuid primary key,
  agent_id   uuid not null references agent.agents(id) on delete cascade,
  seq        bigint generated always as identity,
  role       text not null default 'user' check (role = 'user'),
  body       text not null check (length(btrim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index if not exists messages_in_order on agent.agent_messages (agent_id, seq);

-- ── the two derived facts the engine owns, not the application ──────────────
--
-- `updated_at` IS BUMPED BY A TRIGGER rather than by whoever remembers to send
-- it. This repository already carries an open defect of exactly the other shape
-- — a column created with a DEFAULT whose comment promises it is "bumped on
-- every UPDATE", which nothing anywhere bumps — so it is done properly here the
-- first time.
create or replace function agent.agents_touch() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agents_touch on agent.agents;
create trigger agents_touch before update on agent.agents
  for each row execute function agent.agents_touch();

-- A NEW MESSAGE MAKES ITS AGENT RECENT. The list is ordered by `updated_at`, so
-- without this a conversation would sink while it was being had. Deriving it
-- from the child is what keeps the order honest without the client sending a
-- second write that could disagree.
create or replace function agent.agents_touch_from_message() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  update agent.agents set updated_at = now() where id = new.agent_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_agent on agent.agent_messages;
create trigger messages_touch_agent after insert on agent.agent_messages
  for each row execute function agent.agents_touch_from_message();

-- ── whose they are ──────────────────────────────────────────────────────────
alter table agent.agents enable row level security;
alter table agent.agent_messages enable row level security;
alter table agent.agents force row level security;
alter table agent.agent_messages force row level security;

create policy agents_own_tenant on agent.agents
  for all
  using (tenant_id = agent.tenant_id())
  with check (tenant_id = agent.tenant_id());

-- A MESSAGE'S TENANT IS ITS AGENT'S TENANT. Read through the parent, so there is
-- one answer to "whose is this" and not two that can drift.
create policy messages_own_tenant on agent.agent_messages
  for all
  using (exists (
    select 1 from agent.agents a
     where a.id = agent_messages.agent_id and a.tenant_id = agent.tenant_id()))
  with check (exists (
    select 1 from agent.agents a
     where a.id = agent_messages.agent_id and a.tenant_id = agent.tenant_id()));

-- ── grants ──────────────────────────────────────────────────────────────────
--
-- THE WRITER IS THE SERVER. The browser never holds a service credential and
-- never names its own tenant, so no client role has INSERT, UPDATE or DELETE
-- here — the API derives ownership from a verified token and writes as the
-- service role.
--
-- SELECT to `authenticated` is deliberate and is scoped by the policies above:
-- it lets an account read its OWN rows directly, which is also how tenant
-- isolation is verified with real customer tokens rather than argued for.
grant usage on schema agent to authenticated, service_role;
grant select on agent.agents, agent.agent_messages to authenticated;
grant select, insert, update, delete on agent.agents to service_role;
grant select, insert on agent.agent_messages to service_role;
-- Deleting an agent removes its messages by cascade, which runs as the table
-- owner — so the service role needs no DELETE here to take a conversation with
-- its agent, and is not given one.

revoke all on agent.agents from anon;
revoke all on agent.agent_messages from anon;

comment on table agent.agents is
  'Customer-authored agents: a name and instructions. Not an execution record.';
comment on table agent.agent_messages is
  'Messages a person typed to an agent. role is user-only until something really answers.';
