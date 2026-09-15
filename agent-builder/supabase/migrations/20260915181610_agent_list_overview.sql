-- ============================================================================
-- THE LIST SCREEN'S ONE READ.
--
-- The agents screen draws a row per agent with a preview line under the name:
-- the LAST THING SAID to that agent, and the instructions until something has
-- been. That is two relations joined and one row per agent taken off the child,
-- which is a `distinct on`/lateral job — not something a URL should be asked to
-- express.
--
-- WHY A VIEW AND NOT A COLUMN. A `last_message` column on `agent.agents` would
-- be a second copy of a row that already exists in `agent.agent_messages`, kept
-- in step by a trigger, and able to disagree with it. This repository has paid
-- for that shape more than once. The view DERIVES it on every read, so there is
-- exactly one place a message is stored and exactly one answer to what the last
-- one was.
--
-- WHY A VIEW AND NOT AN EMBEDDED SELECT. PostgREST can embed a child relation
-- and order and limit it per parent, which would do this in one request with no
-- migration. It is not used, for a reason that is about evidence rather than
-- taste: nothing in this repository can run PostgREST, so that query's behaviour
-- could only be asserted by reading its documentation and hoping. A view is
-- plain SQL over plain SQL, so `test/integration/pg-schema.mjs` drives it on a
-- real PostgreSQL and the answer is measured rather than believed. What reaches
-- the wire is then the plainest request PostgREST has: select from a relation,
-- filter, order, limit.
--
-- `security_invoker = true` IS THE WHOLE SAFETY ARGUMENT. Without it a view runs
-- as its OWNER, which would make it a hole straight through the row level
-- security on both base tables — every tenant's agents, readable by anyone who
-- can select from the view. With it the invoker's own policies apply, so the
-- view is exactly as tight as the tables under it and the `authenticated` role
-- reading it sees one tenant's rows: its own.
--
-- Postgres 15+ only. The project is 17.
-- ============================================================================

create or replace view agent.agent_overview
  with (security_invoker = true) as
select
  a.id,
  a.tenant_id,
  a.name,
  a.instructions,
  a.created_at,
  a.updated_at,
  -- NULL when nothing has been said, which is a different answer from the empty
  -- string: a message cannot be blank (the body check refuses it), so NULL here
  -- can only mean "no messages" and the caller never has to guess which it is.
  last.body as last_message
from agent.agents a
left join lateral (
  select m.body
    from agent.agent_messages m
   where m.agent_id = a.id
   -- `seq` RATHER THAN `created_at`: two messages can share a millisecond and a
   -- tie is not an order. The identity is assigned by the database and total.
   order by m.seq desc
   limit 1
) last on true;

comment on view agent.agent_overview is
  'One row per agent with its last message. security_invoker, so RLS on agent.agents and agent.agent_messages applies to whoever reads it.';

-- The same grants the tables carry, and for the same reason: `authenticated` may
-- READ its own rows (RLS decides which), the server writes through
-- `service_role`, and `anon` is refused the schema outright.
grant select on agent.agent_overview to authenticated, service_role;
revoke all on agent.agent_overview from anon;
