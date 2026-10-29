# 2026-10-28 — The site agent (one big agent), always on

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

## Later the same day: always on, and the gaps closed

**The owner: no switch.** *"Just have it on, there doesn't need to be a
switch, is the way we gonna do things now"*, then *"there's no real customers
… just make it work"*.

- **Always on.** `SITE_AGENT` is gone (deploy.yml, the job's env). Every
  site's edit and addition goes to the agent, and the router never starts the
  request-of-parts flow (`rKey`). `SITE_AGENT_CAP` stays (default 60).
- **The older steps stand aside.** The router's lanes, the rungs and the
  add-on's writers no longer run for a site's message. Their code and their
  ~2,000 tests are kept for now: the unit run sets `GF_OLD_LANES=1`
  (package.json's `test` script only; a Worker has no such variable), so
  those tests still exercise the save, draft, turn and publish code they share
  with the agent. Deleting them is a later cleanup.
- **The gaps that made "always on" worse are closed.** New tools:
  - **`styles.css`**: the stylesheet is a file in the workspace. The build tool
    compiles it unstored (`cssOverride`, compile-only). The save stores it
    before the publish, as the look step does, and puts it back if the publish
    fails.
  - **`delete_file`**: a page or component. Never the home page or the sheet.
    A build is needed after it, and a removed address answers 301 home through
    the publish's own redirect merge.
  - **`change_rows`**: add, update by id, remove by id, checked against the
    site's real tables and columns. The rows are queued and written to the live
    database after the save, as the data step does; each outcome is a fact for
    the reply. Finishing with only rows needs no build.
- **The live progress lines.** Each round's facts come from its tools'
  outcomes (`roundFacts`: read, looked at, wrote, removed, lined up,
  built cleanly or failed and fixing), and are marked on the job's progress
  record (`agent`). The model-written progress lines tell them.
- **Tests.**
  - `test/site-agent.test.mjs`: 22 cases.
  - `test/site-agent-route.test.mjs`: 5 cases through the real `/edit` and
    `/addon` routes, synchronous and queued, with supplied agent answers:
    - the whole message reaches the agent and no other model call is made;
    - two compiles, the build's and the save's;
    - the page and the stylesheet are stored and the other page is untouched;
    - one charge equal to the four rounds;
    - a stop stores nothing, compiles nothing and charges nothing.
- **Sweep** (from green):
  - 12 mutants: the home-page and stylesheet delete guards, the column and
    table checks, the sheet kept out of the pages, the progress facts, the
    test-only stand-aside, compile-only's sheet, the sheet stored before the
    save, the stop check, and the router's split.
  - 11 were killed. The survivor was a redundant clause in `finish`'s check (a
    write always leaves the workspace unbuilt until a build passes), so the
    clause was removed. The comment-only control survived.
- **Full suite** (`npm test`, as CI runs it): 13,019 tests, 3 failing.
  - The two known environment failures: the worktree-leftover secrets check
    and the site sign-in test.
  - `build-reply-bubble`, a browser case that timed out under the full run's
    load and passes alone (5/5).

## Then: the two still missing (owner: "fix the still missing thing")

- **`look`**: the agent can see a page.
  - It builds its workspace (compile-only, with `shotRoutes: [route]`, the same
    screenshots the visual review uses) and hands back that page's phone and
    desktop screenshots.
  - The screenshots go as images after the tool results, in the same user
    message, so Grok receives them too: the xAI translation carries a tool
    result's text only, and images beside it.
  - Clearing the desk replaces old screenshots with a note.
  - The rules tell it to look at a page whose appearance changed before it
    finishes.
- **No router for a site's message.** `/api/site/route` answers `{ ok,
  intent: "edit", layer: "page", page: "/", cost: 0, agent: true }` straight
  away: no routing call and no charge, so the page posts the message to the
  edit route and the agent.
  - A first build still goes through the router, and so does an answer to a
    question the router asked.
- **A question** (nothing to change) is answered by the agent: its rounds are
  charged, nothing is saved, and the reply is told from its answer.
- **Tests**:
  - SA23 (look: the workspace's own write, the asked page only, images after
    the results, cleared later), SA24 (the fact), SA25 (wiring);
  - SAR4 (a question through the real route);
  - SAR5 (the real routing route answers with no model call and no charge).
- **Sweep**: 7 of 7 killed (the page filter, the address check, clearing old
  screenshots, images after the results, the router skip, compile-only's
  screenshots, the question path). The comment-only control survived.
- **Full suite** (`npm test`): 13,024 tests, 3 failing, all known: REOPEN 1
  (browser), the site sign-in test and the worktree-leftover check
  (environment).

## Then: first builds, earlier questions, and no cap (owner, 2026-10-29)

*"No cap at all please and yea do the first build and also the answer to a
question it asked earlier."*

- **No cap.**
  - `AGENT_CREDIT_CAP` is `Infinity`, and `SITE_AGENT_CAP` is gone from
    deploy.yml and the job's env.
  - What stays is a guard against a loop: 40 rounds (a first build writes many
    files) and 40 minutes, inside the job's own 50-minute deadline.
- **First builds.**
  - `/api/site/route` answers a first build `{ ok, intent: "build", cost: 0,
    agent: true }` with no routing call.
  - In the build, the agent takes the page writer's place (`generate`). It
    starts from the empty template (or the stored pages on a rebuild), with
    the brief and plan the writer would have had (`briefWithLayout`), and
    builds with the build's own compile (`pDeps.compile`).
  - Its finished workspace is handed back as the writer's `write_pages`
    answer (`asWriterAnswer`: pages under `src/routes/`, parts, server code,
    notes, one usage object). So validation, the photographs, the final
    compile, salvage, the publish and the single bill run as before. A stop is
    no answer: the build's own no-pages path, uncharged.
  - The design call (brand, theme, tables) still runs before it, and a phone
    app and a resumed build keep the writer.
- **An answer to a question the router asked earlier** is settled at the
  route (the card comes off) and sent on as the message it is.
- **The agent reads the conversation**: the chat's last 12 messages
  (`historyText`, from the stored chat) are in its first message. That is how
  an answer like "the home page" means what it meant.
- **Tests**:
  - SA26 (history, one bill, the writer's answer, a stop gives no answer);
  - SA27 (the build's wiring);
  - SAR5 extended (a first build and an earlier question answered by the
    route, no model call);
  - SAR6 (the conversation reaches the agent);
  - `test/site-agent-build.test.mjs` SAB1: a real first build through
    `/api/site/react-build` with a supplied design. Three agent rounds, no
    page-writer call, and the agent's home page stored and published (`page:
    "app"`).
- **The build's wiring**: `publishPages` asks `deps.agentWrite({ compile })` in
  `generate`'s place when the caller offers it, so the build hands the agent
  its own compile and the call site's shape is unchanged. Four guards learned
  the agent:
  - the `agent` mark is the `generate` stage;
  - a third `briefWithLayout` reader;
  - a seventh `cleanChatId` reader;
  - the build's agent send, named in the map exemptions.
- **Sweep**:
  - 8 of 8 killed: the writer's place, the build's door, the earlier answer,
    the history read, the history in the first message, the stop check, the
    `src/routes/` paths, and no cap. The control survived.
  - The stop check first survived: a half-written stopped agent was untested.
    SA26 now proves its pages are never published.
- **Full suite** (`npm test`): 13,028 tests, 3 failing, the known three (REOPEN
  1, site sign-in, worktree leftovers).

## Then: commands (owner, 2026-10-29: "can we try it with commands?")

The Claude Code way: the agent types shell commands, not only our tools.

- **`run`** (agent tool): one shell command in a copy of the site's project.
  The workspace's files are sent with it. What the command printed comes back
  (exit code, output cut at 30,000 characters), and every page, component or
  stylesheet change it made is folded back into the workspace (`syncFromRun`).
  The workspace is then unbuilt, so a build is needed before finishing.
- **In the container** (`builder/agent-shell.mjs`, the build service's
  `POST /agent-run`):
  - **The folder.** Each agent run gets its own work folder under
    `/tmp/agent-runs/<session>`, never the build's `/app`. It holds a copy of
    the template with the site's files written in and the packages linked
    (read only).
  - **The user.** Commands run as the unprivileged user the render check uses
    (`renderAs`).
  - **The environment** is clean (PATH, HOME, LANG, CI): no key of ours.
  - **The limits.** 90 seconds per command, the whole process group stopped at
    the limit. Folders older than two hours are swept.
- **Known limits**:
  - installing packages is not possible: `node_modules` is the image's, read
    only;
  - outside addresses are not blocked (nothing secret is in reach);
  - two runs on one lane use the same unprivileged user, so one could read the
    other's work folder (site source, which is published anyway).
- **Tests**:
  - `test/agent-shell.test.mjs` AS1–AS5, real commands in a real folder: the
    copy and the reset, grep, an edit by `sed` read back, the exit code, no
    secret in `env`, the time limit, the output cut, the sweep.
  - AS5 (needs root and a `node` user, as the container has): commands run as
    that user and cannot change the template. It was run here with a
    temporary `node` user, then the user was removed; without one it is
    skipped.
  - SA28 (the tool, the files back, a build before finishing) and SA29 (the
    wiring: the site's lane, a folder per run, both agents, the container
    route).
- **Sweep** (from green):
  - 10 of 10 killed: the clean environment, the user drop, the base files
    kept out, the page-name check, the output cut, the group kill at the
    limit, the sweep's age, a removed page synced back, the workspace marked
    unbuilt, and the sync itself. The comment-only control survived.
  - The first pass let three survive, and each was closed:
    - the user drop is only testable with a `node` user (re-run with a
      temporary one, then removed);
    - the time-limit test did not time the stop (AS3 now asserts under 3
      seconds);
    - no test removed a page by command (SA30).
  - A field named `unprivileged` on the new route collided with a guard over
    the build's own `*Unprivileged` fields, so it was renamed `asUser`.
- **Full suite** (`npm test`): 13,035 tests, 5 failing before the rename and
  the commit. Two were this change's: the image-input check, which needs the
  new file committed, and the field name. The other three are the known ones.

## Then: no internet for commands (owner, 2026-10-29: "fix this")

- **Each command runs in a network of its own with nothing in it**:
  `unshare --net --map-root-user` (a user namespace, so no privilege is
  needed), started as the unprivileged user.
  - It blocks other machines, this machine's own services and name lookups.
  - Inside, the command sees itself as user 0. On the machine it is the
    unprivileged user, which is what owns the files it makes and is refused
    on the image's files.
- **It fails closed** (`netCut`): the wrapper is tried once per container,
  as that user. If it cannot work, no command runs at all: the agent is
  answered "commands are switched off here …" (code 126), never a command
  with the internet.
- **Measured here** (root, then a temporary `node` user, removed afterwards):
  - outside, a server on this machine answers;
  - inside: `BLOCKED ENETUNREACH`, no DNS (`NO-DNS`), and
    `/etc/agent-test: Permission denied`.
- **Tests** (all 7 pass with the `node` user; without one AS5 is skipped):
  - AS6: a server on this machine reached from outside and not from a
    command, no DNS, and ordinary commands still run;
  - AS7: a container that cannot cut it runs nothing;
  - AS5 now checks the owner of a file the command made.
- **Sweep**: 5 of 5 killed (the wrapper, `--net`, the refusal, the check's
  answer, its failure read as no). The comment-only control survived.
- **Still to see live**: whether Cloudflare's containers allow a user
  namespace. If they do not, commands are refused (closed), and another way
  is needed. That is the first thing the live run reads.
