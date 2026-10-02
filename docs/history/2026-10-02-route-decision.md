# 2026-10-02 — Where a routing answer came from, and a batch that only routes

On the branch for the owner's review. **Not merged, not deployed, nothing
spent.** The audit this serves is
[`investigations/router-audit.md`](../investigations/router-audit.md); its §5
holds the probe matrix and the press.

## 1. The owner's word

> *"Proceed with preparing the router audit's decision-source reporting and
> routing-only batch mode for review; do not merge, deploy or spend yet.
> First correct the audit's expected outcomes to match my standing policy:
> all new additions belong to the add-on path, including new menu links,
> footer links and header buttons. If add-on cannot perform them, document
> the missing capability instead of treating edit as the correct answer.
> Separate intended behavior, current implementation and observed model
> behavior in the test matrix. Mark predicted downstream consequences as
> unverified until measured. Keep Test 11's successful saved-row outcome, but
> distinguish it from proof of the raw model's choice. Make decision-source
> reporting cover every fallback and normalization branch, with fixed reason
> codes. Ensure routing-only mode cannot submit edits, add-ons, builds or
> publishes, and prepare all probes for one batch with an updated estimate.
> Use the batch's own runtime checks before spending instead of requiring a
> duplicate free press. Keep broader testing paused, update the handoff, and
> commit/push."*

The audit's correction (the policy, the three columns, the *unverified*
marks, Test 11's outcome kept apart from the model's choice) is `b7b0e998`.
This record is the code.

## 2. Why the route needed to say where its answer came from

The route's answer and the model's answer are not the same thing (the
audit's R3). On a live site several unusable answers become `addon`, fields
are dropped or rewritten before anything reads them, and two rules decide
with no model asked. Before this change the route's reply looked the same
whichever had happened. So Test 11's run 88 proves its saved row, and cannot
prove the model chose `addon`: an unusable answer would have produced the
same reply.

## 3. The decision report (`builder/site-ask.mjs`, `worker.js`)

- **`ROUTE_REASONS`** (`site-ask.mjs` 941): 42 codes, frozen, each with its
  kind and a sentence saying what it means. Four kinds:
  - `rule` (2): `no-message`, and `no-credits` (decided in the Worker);
  - `fallback` (14): the model's answer was not used;
  - `changed` (21): the model's answer was used with a part dropped or
    rewritten;
  - `context` (5): what the model was shown was cut or filled in.
- **`routeDecision(reasons, input)`** (1007) gives
  `{ source, reasons, raw? }`:
  - it keeps each code once, in order, and drops anything not on the list,
    so a caller cannot widen it;
  - `source` is `rule` if any rule code applied, else `fallback` if any
    fallback code did, else `model`;
  - `raw` is the model's own intent and layer, read only from the router's
    own two lists (`other` for anything else, `none` for nothing). It is
    present when a model reply was read, and absent when a rule decided or
    the call failed.
- **The readers take an optional trace**: `readRouting` (1078), `readAlso`
  (1268) and `readEdit` (1404) mark the branch they take. With no trace they
  record nothing, and with or without one they return exactly what they
  returned before. A test checks both ways for every case.
- **`routeMessage`** (1762) reports:
  - an empty message as `no-message` (1767);
  - a failed request or call as `request-failed` or `send-failed`, with any
    context codes (1800);
  - otherwise the trace's codes, with the model's answer (1825).

  The context codes are worked out inside the request's own `try`, so a
  malformed site description cannot throw past it (one case gives the
  site's name as an object whose `toString` is broken).
- **`worker.js`**:
  - the zero-balance rule answers with `decision: routeDecision(["no-credits"])`
    (19987);
  - the route tells `routeMessage` when Lane 1d filled the table names
    (20050);
  - the reply carries `decision: routed.decision` (20164).
- **Reporting only.** No reader's result and no route answer changed. The
  browser reads none of it, and nothing under `public/` moved. A decision
  holds no message text and no model text, only codes and the two names.

## 4. The routing-only batch (`scripts/canary-probes.mjs`, `scripts/edit-canary.mjs`, `edit-canary.yml`)

- **One form box** (`route_probes`, *"ROUTING-ONLY BATCH: the name of a
  committed probe list…"*) names a committed file in
  `scripts/router-probes/`. The box takes lowercase letters, digits and
  dashes only (at most 41), so it cannot name another path. The file must read exactly
  (`readProbeBatch`): at most 20 probes, each id once, known keys only,
  every intended outcome from the router's own lists. The press prints the
  file's sha256.
- **Read before the sign-in** (`edit-canary.mjs` 198–228). Any of these exits
  2 with no request made:
  - a malformed box;
  - a missing or malformed file;
  - another mode's box filled beside it (job, version, scenario, approvals,
    expected route, fixture), or a filled "What to change";
  - a paid press without both the deploy-sha and image boxes.
- **The batch's own runtime check comes before spending.** The canary's
  preflight compares the Worker's commit and the container's image with the
  two boxes, and checks that its two readers agree. Any failure stops the
  batch before its first routing call, at no cost. No separate free press is
  needed (the owner's word).
- **It cannot edit, add, build, publish or restore:**
  - the canary's one request helper `call` asks `assertProbeCall` first
    (255). It allows the build-health read, the runtime read, a site's page
    list and the routing call, and throws before any other request is made;
  - `fetch` is wrapped as soon as the session exists (290). It allows the
    balance read alone, and throws before any other fetch;
  - the mode's branch (422) sits above the four free edit checks, the
    inventory and the paid edit, and always exits, so none of that code runs.
- **In order**: the balance is read, then each site's page list once. A list
  that cannot be read stops the batch. With spend not `yes` it stops there
  (a rehearsal: everything checked, nothing routed, nothing charged). A paid
  press needs a balance of at least 3 credits a probe (54 for 18) before its
  first call: a floor so the batch is never cut short, not a cap. Each probe
  is then posted once, exactly as the browser posts it, with the site's real
  page list.
- **Each answer is saved whole with its decision** (`routing-probes.json`
  and `.txt` in the run's evidence) and set beside its intended outcome:
  - *matches* (the model's own answer);
  - *matches only through a fallback or a rule* (never counted as a match);
  - *differs*;
  - *recorded* (no intended outcome set);
  - *failed* (the routing call itself failed).
- **It stops early** only on a 401, a non-200, or a reply with no readable
  decision (a Worker that doesn't report one, whose answers could not be
  attributed). That costs at most one routing call.
- **The batch**: `scripts/router-probes/router-audit-1.json`, the audit's 18
  probes, sha256 `2113af003d5423a30d6b3a650061bb40e2ce0b0feae6eb7d81332485e4eec8bd`.
  Every addition's intended answer is the add-on path, or holds the addition
  back (a test enforces this). Four are left unset for the owner.
- The mode itself needs no deploy. The decision it reads does: `worker.js`
  and `site-ask.mjs` are image inputs.

## 5. Verification

- **36 new tests.**
  - `test/route-decision.test.mjs` (14):
    - one case for every code, through the real readers and the real
      `routeMessage` (two codes also have a second case, from §5's sweep);
    - a coverage test: every declared code has a case, and no case names an
      undeclared one. `no-credits` is the Worker's, so its case is the real
      route's;
    - clean answers report `model` with no reasons;
    - fallbacks keep `raw` from the fixed lists only, never free text;
    - the readers return the same with and without a trace;
    - through the real `POST /api/site/route`: `model`, `fallback`,
      `no-credits` and `no-message`, with no customer text in the decision.
  - `test/canary-probes.test.mjs` (22):
    - the box, the committed batch, and its policy guard (an addition's
      intended answer is the add-on path, or holds the addition back);
    - a malformed batch refused whole;
    - both walls, and the mode's place in the script;
    - the workflow box;
    - the verdicts and the report;
    - six runs of the real `scripts/edit-canary.mjs` end to end under the
      in-process stub (`test/fixtures/canary-stub.mjs`, which now takes a
      list of routing answers, a page list that fails, and a balance). A
      paid press routes all 18 probes and makes no request outside the
      allow-list. A rehearsal routes nothing. Every refusal exits 2 with
      nothing on the wire. A failed runtime check, an unreadable page list,
      or a low balance stops before the first routing call. A Worker that
      reports no decision stops the batch after one routing call. Different
      answers are recorded, and the batch goes on.
  - `test/route-table-names.test.mjs` gained three assertions in two cases:
    `tables-filled` and `model` when the route filled the names, and no
    `tables-filled` when it did not.
- **The red check.**
  - On the old code, the two new files cannot load, and the two
    `route-table-names` cases with the new assertions fail.
  - With the new `site-ask.mjs` and `canary-probes.mjs` but the old
    `worker.js` and `edit-canary.mjs`, exactly the 15 integration tests fail
    (the route carrying the decision, the mode wired into the canary), and
    the 35 module tests pass.
- **The mutation sweep**: 84 mutants, each run against its file's tests.
  - `site-ask.mjs`: 45 mutants, run against `route-decision`, `site-ask` and
    `route-table-names`.
  - `canary-probes.mjs`: 27; `edit-canary.mjs`: 9; both against
    `canary-probes`.
  - `worker.js`: 3, against `route-decision` and `route-table-names`.
  - 82 were killed. Two survived, both test gaps, not code faults:
    - the `page-normalized` mark on the look layer's own branch (no case
      reached it; the existing case is the page layer's);
    - the `options-changed` comparison reduced to a count (no case cut an
      option without changing the count).
  - Two cases were added. Re-run alone, both mutants are killed and the
    control survives.
  - Both comment-only controls survived, and the four files' hashes matched
    their pre-sweep readings afterwards.
- **The full suite**: `8579 / 8579 / 0 / 0` locally (tests, pass, fail,
  skipped), 36 more than `25faac78`'s 8,543, in 132 s.

## 6. What this does not show

- Nothing about what a real model answers. Every case here supplies the
  model's answer; the batch is what measures it.
- Nothing about what any step does after routing. Every downstream
  consequence in the audit stays *unverified*.
- The batch reads one answer per message, from one model (the default
  picker), on two sites.
