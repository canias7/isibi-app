-- ═══════════════════════════════════════════════════════════════════════════
-- THE VERSION COVERS THE WHOLE VALIDATED SURFACE — steps AND what it asks for
--
-- ⚠ **WHY THIS HAD TO MOVE, AND IT IS A CORRECTION RATHER THAN A WIDENING FOR ITS OWN
-- SAKE.** `agent.update_automation` has moved `version` on a change of STEPS and on nothing
-- else since it was written, and its own comment says so: *"a version says which WORKFLOW a
-- parent copied in, so renaming an automation, moving its time or adding a day must not move
-- it."* That reasoning is about a PARENT'S SNAPSHOT and it is still right about that.
--
-- It is not right about a FENCE. What a workflow's validity depends on is the steps **and the
-- declarations together**: `readWorkflow` (the engine) and `cleanWorkflow` (the site) both take
-- `(steps, inputs)` and a reference is refused unless something in that pair produces it. So an
-- edit whose verdict was computed against one stored half needs a counter that moves when
-- EITHER half moves, or the fence passes over exactly the change that invalidates the verdict.
--
-- **THE DEFECT THAT MADE IT MATTER, REPRODUCED before this was written**, on the site's own
-- edit door:
--
--     stored : inputs [{"name":"customer"}]   steps [{"type":"note","text":"Hello {{customer}}"}]
--     patch  : {"inputs": []}
--     answer : ok — written, nothing said
--     and the next execution failed at step 1 for a value nothing produced.
--
-- The site now validates the effective combination (`cleanPatch`), which closes the *validation*
-- half. This closes the *concurrency* half: two browsers, one removing the `customer` input and
-- one adding a step that uses it, each validating against a stored half the other is changing.
-- Either edit alone is fine and the pair is not, and only a counter over both can see that.
--
-- ⚠ **AND WIDENING IT IS SAFE FOR THE SNAPSHOT MEANING, checked rather than assumed.**
-- `expandWorkflow` REFUSES a child that declares inputs at all — *"X asks for its own inputs, so
-- it cannot be run as part of another automation"* — so no automation that can BE a child is ever
-- affected by the inputs half of this rule. And `agent.automation_runs.uses` records
-- `{id, version}` as PROVENANCE; nothing anywhere compares it to decide whether a snapshot is
-- fresh. Grepped both readers before changing this.
--
-- **WHAT STILL DOES NOT MOVE IT**: the name, the enabled flag, the schedule, the time, the zone,
-- the day list, the date and the event. That is what keeps the original reasoning true — a
-- concurrent RENAME cannot refuse a guarded edit, because a rename is not a configuration change
-- this fence is about.
--
-- ONE STATEMENT. `update_automation` is replaced whole because `create or replace function`
-- replaces a body whole and only these lines differ; the signature is untouched, so no grant,
-- revoke or `_once` wrapper follows it.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function agent.update_automation(
  p_tenant   text,
  p_id       uuid,
  p_name     text,
  p_enabled  boolean,
  p_schedule text,
  p_at_local time,
  p_zone     text,
  p_steps    jsonb,
  p_inputs   jsonb default '[]'::jsonb,
  p_days     text[] default null,
  p_on_date  date default null,
  p_on_event text default null
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_row   agent.automations;
  v_next  timestamptz := null;
  v_calls jsonb;
  v_ver   integer;
  v_moved boolean;
begin
  if p_tenant is null or btrim(p_tenant) = '' then
    raise exception 'update_automation: tenant must be a non-empty string';
  end if;

  -- LOCKED, so the scheduler cannot advance `next_run_at` between this read and the write
  -- below and have its advance thrown away.
  select * into v_row from agent.automations
   where id = p_id and tenant_id = p_tenant
     for update;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'no-automation');
  end if;

  -- ⚠ WHAT IT SAYS IT RUNS, asked against the agent this row really belongs to — never an
  -- agent id from the call, which this function is not given and must not be.
  v_calls := agent.automation_calls(p_tenant, v_row.agent_id, p_id, p_steps);
  if (v_calls ->> 'ok')::boolean is not true then return v_calls; end if;

  -- ⚠ **THE VERSION MOVES ON A CHANGE OF THE STEPS OR OF WHAT IT ASKS FOR — the whole surface
  -- a workflow's validity is decided over, and nothing else.** See this migration's header for
  -- why the steps alone were not enough and why the other nine fields still must not move it.
  v_moved := v_row.steps  is distinct from coalesce(p_steps,  '[]'::jsonb)
          or v_row.inputs is distinct from coalesce(p_inputs, '[]'::jsonb);
  v_ver := case when v_moved then v_row.version + 1 else v_row.version end;

  -- ⚠ **THE NEXT OCCURRENCE IS RECOMPUTED ONLY WHEN THE CHANGE REALLY MOVES IT.**
  --
  -- **THE DEFECT, REPRODUCED on a real PostgreSQL before this line existed.** This recomputed
  -- from `now()` on EVERY write to a scheduled automation, so an edit about something else
  -- rewrote the instant the scheduler was waiting for:
  --
  --   a daily 09:00 Europe/London automation, its occurrence DUE and not yet filed
  --   (`next_run_at` five minutes in the past — the ordinary state inside the cron's
  --   `AUTOMATION_CATCHUP_S` hour), then `patch_automation('{"name":"morning post"}')`:
  --
  --     next_run_at  2026-09-20 00:14+00  ->  2026-09-20 08:00+00   (moved 7h45m)
  --     still due    t                    ->  f
  --     executions filed for that occurrence: 0, and none ever will be
  --
  -- **The occurrence was neither filed nor recorded missed. A rename deleted it.** And the
  -- other direction is reachable too: on a row whose `next_run_at` the tick had already
  -- advanced to TOMORROW, the same rename pulled it back to TODAY — measured, and absorbed by
  -- `automation_runs_one_per_occurrence` so it costs a wasted tick and a wrong "next run" on
  -- screen rather than a second execution.
  --
  -- **THE RULE: a change to a field the arithmetic reads recomputes; anything else keeps the
  -- stored instant.** `agent.automation_next_run` reads the schedule, the local time, the zone,
  -- the day list and the date — so those five are the recompute's own inputs, and the test is
  -- exactly "did one of them move". That is not a list somebody has to keep in step with the
  -- arithmetic: it is the arithmetic's argument list.
  --
  -- ⚠ **AND A CHANGE THAT REALLY MOVES THE SCHEDULE STILL RECOMPUTES FROM `now()`, which is the
  -- behaviour the original comment was defending and which stays.** *"A person who changes the
  -- time means the new time"* — and the cost it stated stays stated: moving the time forward
  -- past today's occurrence skips today, because that is what changing a schedule means.
  -- `automation_next_run` answers an instant STRICTLY AFTER `now()`, so a schedule change can
  -- never leave an occurrence in the past; it is always the next real one.
  --
  -- **A MOVE TO `manual` CLEARS IT**, which is the `coalesce(p_schedule,'manual') <> 'manual'`
  -- test below doing what it always did: `v_next` stays null and the row stops being due.
  if coalesce(p_schedule, 'manual') <> 'manual' then
    if v_row.schedule is distinct from coalesce(p_schedule, 'manual')
       or v_row.at_local is distinct from p_at_local
       or v_row.zone     is distinct from p_zone
       or v_row.days     is distinct from coalesce(p_days, '{}'::text[])
       or v_row.on_date  is distinct from p_on_date
    then
      v_next := agent.automation_next_run(p_schedule, p_at_local, p_zone, p_days, p_on_date, now());
    else
      -- ⚠ **KEPT, INCLUDING A DUE ONE IN THE PAST — and that is the point rather than an
      -- oversight.** A due occurrence belongs to `tick_automations`, which files it or records
      -- it missed and then advances; an edit about a name has no business deciding which.
      -- Keeping it is what makes an unrelated edit invisible to the scheduler.
      --
      -- **AND A ROW THAT SOMEHOW HAS NONE STILL GETS ONE**, so an automation cannot be left
      -- scheduled-with-no-next-instant by an edit that changed nothing about its schedule.
      v_next := coalesce(v_row.next_run_at,
                         agent.automation_next_run(p_schedule, p_at_local, p_zone, p_days, p_on_date, now()));
    end if;
  end if;

  update agent.automations
     set name        = p_name,
         enabled     = coalesce(p_enabled, true),
         schedule    = coalesce(p_schedule, 'manual'),
         at_local    = p_at_local,
         zone        = p_zone,
         steps       = coalesce(p_steps, '[]'::jsonb),
         inputs      = coalesce(p_inputs, '[]'::jsonb),
         days        = coalesce(p_days, '{}'::text[]),
         on_date     = p_on_date,
         on_event    = p_on_event,
         version     = v_ver,
         next_run_at = v_next
   where id = p_id
  returning * into v_row;

  -- ⚠ **`spent` IS THE OTHER HALF OF THE RECOMPUTE RULE, and it is the half that had no
  -- words.** A change that really moves an occurrence can never leave one in the PAST — every
  -- schedule but `once` answers an instant strictly after `now()`, so this is always the next
  -- real one. `once` is the exception: past its day there is no next one, and this answered
  -- `{"ok": true, "next_run_at": null}` — which is byte for byte what a `manual` automation
  -- answers. So a caller was told the edit landed and could not tell that it had made the
  -- automation unrunnable. See `agent.schedule_spent`.
  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version,
                            'next_run_at', v_row.next_run_at,
                            'spent', agent.schedule_spent(v_row.schedule, v_row.next_run_at));
end; $$;

comment on function agent.update_automation(text, uuid, text, boolean, text, time, text, jsonb, jsonb, text[], date, text) is
  'Write an automation whole. The version moves on a change of the steps or of what it asks for — together the surface a workflow''s validity is decided over — and on nothing else, so a guarded edit fences on what it was validated against and a rename cannot refuse one. The next occurrence is recomputed only when a field the schedule arithmetic reads has moved; any other edit keeps the instant the scheduler is waiting for, including a due one, which belongs to the tick.';
