-- ============================================================================
-- BRINGING ONE AGENT OVER FROM A BROWSER, ALL OF IT OR NONE OF IT.
--
-- The agents screen kept its agents in `localStorage` before this milestone, so
-- every account that used it has a conversation sitting in one browser. The
-- import is explicit — a person presses it — and the local copy is never deleted
-- by us, which means the import can be pressed again. THAT is what this function
-- is for: pressed twice after a failure, a loop of separate inserts leaves
-- either a half-imported agent or a second copy of a whole one, and neither is
-- something a person can be asked to sort out.
--
-- ONE STATEMENT, SO ONE TRANSACTION. A function body is atomic: the agent and
-- every message land together or nothing does. A refused message — a blank body,
-- a forged speaker — takes the agent with it, so a retry starts from the same
-- clean state it started from the first time.
--
-- WHAT IT DOES NOT DO. It does not decide whose the agent is: the tenant is an
-- argument, supplied by the Worker from a VERIFIED token and never by a browser.
-- `execute` is granted to `service_role` alone and revoked from `public`, so a
-- customer's own JWT cannot reach it at all — which is the only reason a tenant
-- argument is safe here.
--
-- `role` IS NOT AN ARGUMENT. Messages are inserted without one, so the column
-- default and its `check (role = 'user')` apply: an import cannot smuggle in a
-- reply that looks like it came from the agent, which is the one thing this
-- milestone must not be able to do.
-- ============================================================================

create or replace function agent.import_agent(
  p_tenant       text,
  p_name         text,
  p_instructions text,
  p_messages     jsonb default '[]'::jsonb
) returns uuid
language plpgsql
as $$
declare
  v_id  uuid := gen_random_uuid();
  v_msg jsonb;
  v_at  timestamptz;
begin
  -- A NON-ARRAY IS REFUSED RATHER THAN READ AS EMPTY. "Nothing to import" and
  -- "the caller sent something we did not understand" need different answers:
  -- read as empty, a mangled payload would report a successful import of an
  -- agent whose conversation had silently been dropped.
  if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
    raise exception 'import_agent: messages must be a JSON array, got %',
      coalesce(jsonb_typeof(p_messages), 'null');
  end if;
  if jsonb_array_length(p_messages) > 500 then
    raise exception 'import_agent: % messages is more than one import may carry (500)',
      jsonb_array_length(p_messages);
  end if;

  insert into agent.agents (id, tenant_id, name, instructions)
  values (v_id, p_tenant, p_name, p_instructions);

  -- ARRAY ORDER IS THE CONVERSATION'S ORDER. `jsonb_array_elements` preserves
  -- it, and `seq` is assigned as each row goes in, so the thread reads back in
  -- the order it was typed whatever the timestamps say.
  for v_msg in select value from jsonb_array_elements(p_messages) loop
    v_at := null;
    -- THE TIME IS THE ONLY THING THE BROWSER GETS TO SAY, and it is display
    -- metadata: `seq` orders the thread, not this. An unparseable or absent one
    -- becomes `now()` rather than failing the import — losing the original time
    -- of a message is worth much less than losing the message.
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

comment on function agent.import_agent(text, text, text, jsonb) is
  'Create one agent and its whole conversation in a single transaction. service_role only; the tenant is the caller''s to supply from a verified token.';

-- DEFAULT `execute` TO PUBLIC IS THE HOLE HERE, so it is revoked by name before
-- anything is granted: a function taking a tenant argument that any signed-in
-- customer could call would let one account write into another's.
revoke all on function agent.import_agent(text, text, text, jsonb) from public;
grant execute on function agent.import_agent(text, text, text, jsonb) to service_role;
