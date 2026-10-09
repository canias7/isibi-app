# The multi-agent readiness review, and the release proposal (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no model call, no SQL.

The owner closed the attachment correction, after Codex confirmed it on
`604d2415` (59 focused tests, CI green). They then asked for the overall
multi-agent readiness review from existing evidence, with a test only for a
concrete uncovered requirement, and one release-and-validation proposal.

- **The review and the proposal**:
  `docs/investigations/multi-agent-readiness.md`. It covers:
  - what runs concurrently, what waits and what is sequential or
    unsupported, for Edit, Add-on and Build;
  - each requirement's offline, live and unshown evidence;
  - mocked versus live;
  - the release, its runtime checks, press A and the optional presses B and
    C.
- **The one uncovered requirement**: two messages, accepted as two requests,
  touching one page.
  - **XR** (`8109aab4`) shows the site's lock deferring the second request's
    job, the stale preparation never applied, both changes kept and each job
    charged once.
  - It passes on the existing code, so no blocker was found and no product
    code changed.
  - Its sweep killed 2 of 2 product mutants, and the control survived.
- **Results**:
  - focused run `232 / 232 / 0 / 0`;
  - full suite `10272 / 10272 / 0 / 0`, after one intermittent real-browser
    failure on the first run (REOPEN 1, passing 3 of 3 alone);
  - unit CI `10272 / 10231 / 0 / 41` (run 37930813501).
- **Build's limits**: `MAX_PAGES = 1` and `MAX_COMPONENTS = 15` are
  unchanged since production.
- **Press A, proposed**: `lv-parallel` on `fold-lane-bakery`, two messages,
  about 11–17 credits, budget 20. The balance (11) must be raised first, and
  its canary preparation is still to do.
