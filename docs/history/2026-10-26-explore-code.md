# 2026-10-26: the steps explore the site's code instead of reading the map

The owner chose this on 2026-10-26 ("option b"). An editing step is no longer
handed the pre-built site-map summary. It is given the file list up front,
plus the table names, and then it looks for itself with read-only tools, the
way Claude Code or Lovable would. Branch `explore-code`, from `main`
`8f29c37d3`. Not merged and not deployed.

## The shared layer

- **`builder/site-explore.mjs`.**
  - **The note**: the file list (each path, with the route a page file
    serves) and a revision digest of the files and tables. The note sits in
    the system turn, after the step's own rules.
  - **Code tools**: `list_files`, `search` (text or regex, with an optional
    prefix) and `read_file` (with an optional line range). Also
    `describe_table`.
  - **The loop** (`exploreSend` / `exploreCall`) is bounded. It allows 6 look
    rounds by default; the `EXPLORE_MAX_LOOKS` env setting changes that, and
    the router is capped at 2.
  - **How a call is shaped while looking**: the step's forced tool becomes
    "any tool", which xAI maps to `required`. After the last look the step's
    own `tool_choice` comes back, so the loop always ends with the step's own
    answer. Look blocks are removed from that answer.
  - **Billing**: the usage of every round is added onto the answer, and the
    step bills from `reply.usage` as before.
  - **Replay**: each round passes through the job's `send` (`jobSend`), so
    the recorder and replayer see every round as its own exact request, tool
    results included. The digest makes a changed site a different request,
    so an old answer is never replayed for it.
- **`builder/explore-site-tools.mjs`.** Everything about the site except
  secrets, read-only (the owner's rule of 2026-10-26):
  - **The tools**: `read_rows` (every column, 20 rows at a time, paginated),
    `table_links`, `column_rules`, `automatic_rules` (with their SQL),
    `schema_history`, `indexes`, `db_size`, `error_logs`, `site_settings`,
    `traffic`, `services`, `scheduled_tasks`, `logins`, `draft_status`,
    `recent_changes`, `uploads`, `read_upload` and `activity`.
  - **Secrets**: a value under a secret-named key or column is hidden, and
    key, token, password and connection-string patterns are redacted
    wherever they sit: rows, function bodies, settings and logs.
  - **Untrusted text**: every answer is fenced as untrusted data, and the
    fence cannot be closed from inside.
  - **Bounds**: each answer is bounded, and each read counts as one look.
- **Locked to the job's own site** (owner, 2026-10-26).
  - No tool takes a site, project, connection, owner or store argument; one
    that names any of them is refused before anything is read.
  - The site is bound when the job starts, from the verified owner's
    `ownerSlug`.
  - The worker's readers (`siteReaders`) open the database through
    `ownerSiteConn(env, s)` with read-only transactions only
    (`sqlReadOnly`).
  - Store reads stay under `uploads/<slug>/` and `current/<slug>.json`.
    Paths that escape (`..`, absolute, encoded, backslash) are refused.
  - Our own records are filtered with `slug=eq.<slug>`.
- **Readers not built**: `errors`, `traffic`, `tasks`, `services` and `logins`.
  No per-site store for them exists today, so these tools answer
  "unavailable". `history` gives the stored schema's table list. There is no
  migration log per site.

## Phase 1: the page rung and the look door

| Step | Before | Now |
|---|---|---|
| quick writer (`runTweak`, sent as `"tweak"`) | the map | file list, table names, all tools |
| look door's lane picker (`pick_lanes`) and lanes (`lane`, `lane-correction`) | the map | the same |
| page rung's file picker | the map (`page` slice) | the same |
| page rung's writer (`pagesCall`) | the map | the same |
| keep check (`keep_check`) | the map | nothing: it judges the before and after it is handed |
| take-off (`take_off`, renamed from `lane`) | the map | nothing: it picks names from the list it is handed |

Every other edit step keeps the map until its own phase.

**Test fixtures.** Fixtures that identified a call by `tool_choice.name` now
also read the step's own tool, which comes first, when the request asks for
"any tool". That is the request the real producer now sends. 43 test files
were changed mechanically.

**The move case** (`test/site-explore.test.mjs`). "Move the reviews section
above the lessons section" on a page built from Band parts. The supplied
first answer calls `search("reviews")`, which finds
`-parts/band-3-split.tsx:2`. The second answer moves `<Band3Split />` above
`<Band2Lessons />`. The step finishes without asking, and both rounds are
billed (1,900 input tokens).

**The free measure** (`node scripts/explore-measure.mjs [site.json]`) on that
page, with the database tools offered:

| Scenario | Characters | Approx. tokens |
|---|---|---|
| With the map, one call | 4,810 | about 1,203 |
| 0 looks | 9,180 | about 2,295 |
| 1 look | 18,709 | about 4,677 |
| 2 looks | 28,861 | about 7,215 |
| 6 looks | 70,966 | about 17,742 |

Each round resends the whole conversation, and the tool schemas add about
3,400 characters per round.

**Checks.**
- **Red check on `main`'s `worker.js`**: 3 of the guard's cases fail.
- **Sweep**: 27 of 27 mutants killed in three runs, and the comment-only
  controls survived.
- **Full suite**: `12909 / 12905 / 1 / 3`. The one failure is
  `no-generated-deps`, which is caused by this worktree's `node_modules`
  symlink. It passes once the link is removed.
