-- ============================================================================
-- AN IMPORT THAT CAN BE RETRIED WITHOUT MAKING A SECOND AGENT.
--
-- `agent.import_agent` was ATOMIC and that is not the same as IDEMPOTENT. It
-- closed one failure — a half-imported agent — and left the one next to it wide
-- open: the browser sends the import, the AGENT IS CREATED, and the response is
-- lost on the way back. From the browser that is indistinguishable from a
-- request that never arrived, the local record is still unmarked, and the
-- obvious thing to do is press the button again. That made a second agent with
-- a second copy of the whole conversation, and nothing anywhere could tell the
-- two apart afterwards.
--
-- **THE IDENTITY IS THE BROWSER'S OWN RECORD ID, AND THE TENANT'S.** Every
-- legacy record in `localStorage` already carries a `crypto.randomUUID()`
-- primary key that is stable across retries — it is what the screen has always
-- keyed that list on — so the import has a natural key without inventing one.
-- It is SCOPED BY TENANT, which is the half that has to be in the database:
-- `(tenant_id, import_key)`, so two accounts that somehow hold the same local id
-- (a copied profile, a restored backup) each import their own and neither can
-- collide with, overwrite or observe the other's.
--
-- **ENFORCED BY THE INDEX, NOT BY A CHECK IN THE FUNCTION.** A read-then-insert
-- is a race: two presses in flight at once both find nothing and both insert.
-- The unique index decides, `on conflict do nothing` loses the race safely, and
-- the loser then READS the winner's row — so concurrent retries answer the same
-- id as surely as sequential ones.
--
-- PARTIAL, on `import_key is not null`, because an agent created the ordinary
-- way has no import identity and any number of those may exist.
-- ============================================================================

alter table agent.agents add column if not exists import_key text;

comment on column agent.agents.import_key is
  'The browser-side record id this agent was imported from. Unique per tenant; null for an agent created here.';

create unique index if not exists agents_one_import_per_tenant
  on agent.agents (tenant_id, import_key)
  where import_key is not null;

create or replace function agent.import_agent(
  p_tenant       text,
  p_name         text,
  p_instructions text,
  p_messages     jsonb default '[]'::jsonb,
  p_import_key   text  default null
) returns uuid
language plpgsql
as $$
declare
  v_id    uuid := gen_random_uuid();
  v_new   uuid;
  v_msg   jsonb;
  v_at    timestamptz;
begin
  -- A NON-ARRAY IS REFUSED RATHER THAN READ AS EMPTY: read as empty, a mangled
  -- payload would report a successful import of an agent whose conversation had
  -- silently been dropped.
  if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
    raise exception 'import_agent: messages must be a JSON array, got %',
      coalesce(jsonb_typeof(p_messages), 'null');
  end if;
  if jsonb_array_length(p_messages) > 500 then
    raise exception 'import_agent: % messages is more than one import may carry (500)',
      jsonb_array_length(p_messages);
  end if;

  -- THE INSERT IS THE CHECK. Nothing is read first, so there is no window
  -- between looking and writing for a second press to slip through.
  insert into agent.agents (id, tenant_id, name, instructions, import_key)
  values (v_id, p_tenant, p_name, p_instructions, nullif(btrim(coalesce(p_import_key, '')), ''))
  on conflict (tenant_id, import_key) where import_key is not null
  do nothing
  returning id into v_new;

  if v_new is null then
    -- SOMEBODY ALREADY IMPORTED THIS ONE — an earlier press whose answer was
    -- lost, or a second press racing this one. Answer the agent that exists and
    -- **insert no messages**: re-running the loop here would double a
    -- conversation on every retry, which is the defect wearing a different hat.
    select a.id into v_id
      from agent.agents a
     where a.tenant_id = p_tenant
       and a.import_key = nullif(btrim(coalesce(p_import_key, '')), '');
    -- A conflict with no row behind it cannot happen — the index is what
    -- produced the conflict — so this is a refusal rather than a silent null.
    if v_id is null then
      raise exception 'import_agent: the import conflicted with a row that is not there';
    end if;
    return v_id;
  end if;

  -- ARRAY ORDER IS THE CONVERSATION'S ORDER; seq is assigned as each row goes in.
  for v_msg in select value from jsonb_array_elements(p_messages) loop
    v_at := null;
    -- The time is display metadata; seq orders the thread. An unparseable or
    -- absent one becomes now() rather than failing the import.
    if jsonb_typeof(v_msg->'at') = 'string' then
      begin
        v_at := (v_msg->>'at')::timestamptz;
      exception when others then
        v_at := null;
      end;
    end if;
    insert into agent.agent_messages (id, agent_id, body, created_at)
    values (gen_random_uuid(), v_id, v_msg->>'body', coalesce(v_at, now()));
  end loop;

  return v_id;
end
$$;

comment on function agent.import_agent(text, text, text, jsonb, text) is
  'Create one agent and its whole conversation in a single transaction, once per (tenant, import_key). service_role only; the tenant is the caller''s to supply from a verified token.';

-- THE FOUR-ARGUMENT VERSION IS DROPPED, not left beside this one. Postgres
-- would keep both as an overload set, and a caller that forgot the new argument
-- would silently get the one with no identity at all — the defect back, behind a
-- signature nobody meant to call.
drop function if exists agent.import_agent(text, text, text, jsonb);

revoke all on function agent.import_agent(text, text, text, jsonb, text) from public;
grant execute on function agent.import_agent(text, text, text, jsonb, text) to service_role;
