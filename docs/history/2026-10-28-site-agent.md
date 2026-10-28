# 2026-10-28 — The site agent (one big agent), behind a switch

## What the owner asked

After the server-code work: test "the Lovable / Claude Code style, a big agent
instead of a bunch of routes" (noted 2026-10-25 as *"Router for small edits, an
agent with tools for big ones"*). After the cost discussion the owner chose
**one big full agent for everything**, with these cost rules:

1. **A head start**: the first message carries the site map and the files the
   change most likely needs.
2. (Plan first, one write: *"optional, we can talk about it later"*. Not
   enforced; the agent is told to plan first, nothing more.)
3. **Clear the desk**: a file the agent has finished with is swapped for a
   one-line note once the conversation is big. The owner asked whether the work
   is lost. It is not: the writes live in the job's workspace, and `read_files`
   hands back the current version.
4. **The same opening every round**, so the rules and tools are read from the
   provider's cache at a quarter of the price.

## What was built

- **`builder/site-agent.mjs`**: the loop and its tools. The tools are
  `read_files`, `write_file` (a page, a component or server code; server code is
  checked at once by `checkServerPart`), `read_table` (20 rows, read only),
  `build` and `finish`.
  - `finish` is refused until a build has passed with nothing written since.
  - The hard limits are 14 rounds, a credit cap (`SITE_AGENT_CAP`, default 60)
    and 25 minutes. Reaching one stops the loop, and nothing is saved.
  - Rule 1 is `headStart`: every file on a small site; on a big one, the
    required files and the picker's.
  - Rule 3 is `compact`: above 60,000 characters of conversation, the older
    rounds' file bodies become notes. The first message and the latest two
    rounds are never touched, and it happens all at once (one cache rebuild).
  - Rule 4: `AGENT_SYSTEM` is the page writer's own rules (`pageRulesFor`) plus
    the agent's, and the server-code instructions are taken from the page
    writer's own `server` field. `AGENT_TOOLS` is frozen, and the call is keyed
    `site-agent`.
- **`worker.js`**:
  - **`runAgentChange`**: map, spec and parts are read; then the loop; then one
    save through `recompileAndPublish` (draft-first, the server check, compile
    repair and visual review as for any edit).
  - **The model's calls are charged only when there is something to save**,
    before the save's gate. A stop or a finish with nothing changed costs the
    customer nothing.
  - **The build tool is `recompileAndPublish(..., compileOnly: true)`**: the
    same container compile and server test run, answered straight after the
    compile (no repair round, nothing staged, nothing published, never the
    beside/turn path).
  - Both the **edit** and the **add-on** routes hand the whole message to it
    when `SITE_AGENT` names the site, before any lane runs. The router does not
    split such a site's message into a request of parts (`rKey`). The answer
    says `deferred: []` (nothing put off).
- **The reply** is model-written from facts. The add-on route's answer is told
  as an edit's (`addonReplyFacts` defers to `editReplyFacts` for
  `layer: "agent"`). The agent's `finish` summary is "what the builder reports
  it did"; a stop is told as a fact (`stoppedFacts`).
- **The switch**: `SITE_AGENT` (off by default; `on`, or a comma list of slugs)
  and `SITE_AGENT_CAP`.
  - Both are in `deploy.yml` (fallbacks `off`, `60`) and in `JOB_ENV_NAMES`, so
    a job in the container reads them as the Worker does.
  - `builder/site-agent.mjs` is in the Dockerfile's worker copy.

## Tests

`test/site-agent.test.mjs`, SA1–SA15:

- the loop, `finish` refused before a passing build, a failing build's errors;
- the three hard limits, rule 4's identical opening, rule 1's head start;
- rule 3 (no write lost, and a cleared file read back);
- the key and server checks on write, a send that throws, `read_table` pairing;
- the switch;
- the wiring: both routes, the router, compile-only before the repair and the
  gate, the charge after the stop check and before the save, the job's env,
  deploy.yml and the Dockerfile.

**Sweep**:

- 13 mutants of the loop, the limits, the head start, the clearing, the
  switch, compile-only, the turn path, the router's split and the job's env.
  All 13 were killed; the comment-only control survived.
- The first pass let two survive: a failed build marked as passed, and
  clearing every round. SA16 and SA17 were added for them.

**Full suite**:

- 13,007 tests, 5 failing, then the 2 that were this change's were fixed:
  - the map exemption for `runAgentChange`;
  - the deploy list's `REQUEST_FLOW`/`VISUAL_REVIEW` adjacency.
- The other 3:
  - the image-input check, which needs the new file committed;
  - the worktree-leftover secrets check and the site sign-in test, both
    environment failures known before this change.

## Not done yet (backlog)

- **The stylesheet** (`look.css`, stored in the site's config, not a file) is
  not in the agent's workspace, so it cannot change the CSS yet.
- **Rows**: `read_table` reads only. Adding, changing or deleting entries is
  still the data rung's work.
- **Removing or renaming a page** (with its redirect) is not an agent tool.
- **Looking at a page** (a screenshot tool) is not a tool. The save's visual
  review still runs once.
- **The router still runs first** (1–2 credits): the client asks
  `/api/site/route` before posting. A conversation question still goes through
  the router.
- **No live run yet.** A paid side-by-side test is proposed with its exact
  message and estimate first.
