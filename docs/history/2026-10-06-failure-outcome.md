# A failed addition says what it left behind (2026-10-06, on the branch)

The owner, after the warning-list preservation passed review
(`2026-10-06-refusal-warnings.md`):
*"The warning-list preservation passes review, but finish the
failure-reporting work before calling this batch complete. Codex reproduced
two gaps on 08b9a657: addonAnswer now prints an older stored refusal's unsafe
coverNote verbatim, producing "I couldn't add that" followed by "I've set that
up," although addonReplyFacts correctly treats that older requirement as
already present; and addonReplyFacts prefixes a compile failure with "Nothing
was added" even when migration.status is applied_without_page and
migrationNote confirms database changes succeeded. Extend the shared outcome
reporting across the later Add-on failure exits using existing applied,
migration and publish evidence. Distinguish no changes, partial application,
unpublished work and unknown outcomes; ok:false alone must never establish that
nothing changed or that something already existed. Preserve all supported
requirement and warning outcomes through stored-answer replay, model facts and
browser display, including when no model-written reply is available. Handle
older saved answers consistently without trusting their obsolete success
wording. Also correct the documented seed fallback wording: a seeding
restriction does not prove visitors cannot read the table. Add focused route
and replay tests covering these cases, incomplete judgments and failures before
versus after application. Keep execution, charging and retry behavior
unchanged, and leave the intake limit and unrelated backlog parked. Push the
fix, required CI and exact evidence to owner-notes. Keep everything unmerged;
no deployment, container image build or paid retest yet."*

**The fix is on the branch only**: not merged, not deployed, no image built,
nothing pressed or spent. It is shown with supplied model answers through the
real routes, not live. The commit, the sweep, the suite and CI are in §4.

## 1. The reproduction

Both gaps reproduced on `08b9a657` before anything changed (free, local):

- **The browser** (`addonAnswer`, run through `browserReply`): an older stored
  refusal — `requirementsTold` with `told: "set-up"` and a note saying "I've
  set that up" — printed
  *"⚠️ I couldn't add that. I've set that up, but I can't confirm from here
  that The owner is emailed about each new enquiry — have a look and tell me
  if it isn't right."*, while `addonReplyFacts` read the same requirement as
  already there.
- **The facts**: a table and a page, the publish failing after the seam (the
  build packaged no script, so the activation put the pointer back:
  `not-served`). The schema was applied (5 `CREATE TABLE` statements), the
  record went `applied_without_page`, and the reply's first and only fact was
  *"Nothing was added. The builder's own reason: “The database changes for
  this were made — now storing bookings, signups — …”"*. The quoted sentence
  also credited the change with `bookings`, a table the site already had: the
  migration record's `applied` list is every table the engine re-ran.

Mapping every later exit found the same shape throughout. Each `ok: false` was
told by the facts as "Nothing was added", whatever it had already done, and
none of them carried a requirement or warning outcome:

| Exit | Where it stands | What it may already have done |
|---|---|---|
| `send` (a model call that failed: the picker, the row step's designer, the designers, both judgments) | before the backend block | nothing |
| `add`, `declined` | inside the design | nothing |
| `provision` | the site's database could not be made, before the merge and the apply | nothing on the site (see §5 for a project a late stage leaves) |
| `unbilled` (#1), the pageless `schema` | before or at the pageless apply | a database made (`provisioned`); the apply part-way |
| `no-photo`, `generate`, `unseen-rewrite`, merge refusals, `nothing-returned`, the generic stop, `rewrote`, `qr-dependency`, `not-landed`, `unbilled` (#4), `lost-photos`, `config` | after the page call, before the look store and the apply | a database made |
| `compile` (no seam) | the compile failed before the seam | a database made; photographs bought; the design stored and, if its put-back failed, kept |
| `schema` (seam refused) | the apply threw part-way | the statements before the error; the rest as above |
| `compile` (after the seam: gate, staging, activation) | after the apply | the database's changes, live; the rest as above |

The `send` and `provision` rows were found while closing this batch, after
the first sweep: neither answered through the door below. The provision's
refusal carried no requirement outcome, and the model-down stop no outcome.

Three more things came out of the mapping:

- **The publish exit said "nothing was changed" over changes that went in.**
  A post-seam failure is reported as `compile` with `compileMsg`'s "ours"
  arms, which were told `landed: false`, so the gate's refusal read
  "…couldn't be published (rpc), so nothing was changed" beside the migration
  sentence saying the tables were made.
- **The schema sentence called the site untouched.** `applySiteSchema` runs
  one statement at a time, outside a transaction, and a refusal is a throw
  from whichever one failed. The tables before it may already stand.
- **Found by the new tests**: before the apply, the route's "what the site
  already has" (`aExisting`) read `aSpec`, which by then is the stored schema
  with this change's design folded in (`unionSpec`, for the page call). A
  compile that failed before the seam therefore told a sign-up table nobody
  created as the site's own ("already there").

And the seed note's display-only sentence, *"that table isn't one visitors
can read, so it starts empty"*, was false of a table visitors read and members
write. The engine seeds only `display` tables: anyone reads, nobody writes.

## 2. What it does now

### One outcome, from the exit's own evidence

`failureOutcome` (`builder/site-add.mjs`) is the one producer, and
`outcomeOf`/`outcomeReads` (`builder/site-reply.mjs`) are the one reader.

`outcome` is
`{ state, published: false, database, tables?, altered?, functions?, apis?, jobs?, provisioned?, saved?, photos? }`:

- `database`: `none` (the apply never ran), `applied` (it landed; what it made
  is live whatever the page did) or `unknown` (it threw part-way);
- the names: what the apply landed, read only when `applied`. They are this
  change's tables, alterations, functions, connections and jobs, not every
  table the engine re-ran;
- `provisioned`: a database was made for the site before the exit;
- `saved`: the stored design could not be put back after the publish failed
  (`KEPT_CHANGE_NOTE`'s state);
- `photos`: photographs made and kept in the site's uploads, not shown;
- `state`, first match wins: `unknown`, then `partial` (something of this
  change is live), then `unpublished` (something is saved and not live), then
  `none`. The fields keep every part.

The reader trusts an outcome only when every field is its own type and the
summary is the one its fields give. A contradiction reads as no outcome.

### Every failure after the design, through one door

`aFail` in the route composes the coverage against the outcome
(`aCoverage({ failed, said })`), attaches the outcome, and lets the exit's own
fields win. It is used by all of these: the designer's refusal, every designer
declining, both `unbilled` stops, the pageless `schema`, `no-photo` (both),
`generate`, `unseen-rewrite`, the merge refusals, `nothing-returned`, the
generic merge stop, `rewrote`, `qr-dependency`, `not-landed`, `lost-photos`,
`config`, the site's database that could not be made (`provision`), and the
publish exit. Execution, charging and retries are each exit's own and
unchanged. The door only says what happened.

- **The publish exit** reads the apply's own flag, never the record alone. A
  settle that could not be written leaves the record `pending` with its tables
  live. The rule is `aApplied` → `applied`; a record with no landed apply →
  `unknown`; no record → `none`. When anything outside the publish changed
  (the database's changes, or a database made for the site), `compileMsg` is
  told so (`landed`). Its sentences then say what did not happen ("so the rest
  of it wasn't published"), and the compile's own sentence says "so it wasn't
  published" instead of "untouched". It also passes the kept design (`saved`)
  and the photographs bought (`photos`).
- **The schema sentence** no longer calls the site untouched: *"Your live
  pages weren't changed, but some of the database change may already have
  gone in before it stopped; asking again won't make anything twice."* (Every
  statement the engine emits is additive or `IF NOT EXISTS`.)
- **The migration sentence** names the tables this change added or altered
  that the engine reports applying, no longer every table it re-ran.
- **A stop before the design** (`aFailure`: empty, unconfigured, no source,
  no picker kind, and the rest) and a refusal before any write (`aNone`: the
  row step's refusals, a list that will not take a second entry, an addition
  already true) carry `outcome: none` by their own position. The reply no
  longer reads that off `ok: false`.
- **A model call that failed** (`aDown`, `send`: the picker, the row step's
  designer, the designers, and both judgments, the incomplete one included)
  carries `outcome: none` too. Every caller stands above the backend block,
  which a test holds. It tells no requirement, since none was settled, and it
  is ours, so no model reply.
- **The site's database that could not be made** (`provision`) answers
  through the door with `outcome: none`. The provision threw before
  `aProvisioned` and nothing below it ran. Its sentence is unchanged ("this is
  on us, and nothing was changed"), and the requirements the judgment settled
  are now told beside it, all still to do.
- **An addition that did not land, and a design that could not be saved**,
  say "so it wasn't published" instead of "nothing changed" / "untouched" when
  a database was made first.

### What a requirement and a warning are, on a failure

- **What the publish would have made is known to be nothing** on a failure:
  no page went out, a code or a scene is not live (a design that could not be
  put back is saved, not shown), and no photograph is on the site. So a
  requirement the page or a code was to carry is not done: "Still to do",
  where before the publish's results counted as not yet known. The developer
  record composed before the publish keeps its cannot-tell reading.
- **The database's kinds** count what the apply landed, nothing when it never
  ran, and stay unanswerable when it stopped part-way ("Nothing here can see
  whether this is in place").
- **What the site already had** is read off the stored schema until the apply
  lands (`aSpecHad`), never the proposed union.
- **The counted sentences** ("so those aren't in place", "Part of that didn't
  get built") are told only beside database changes that went in.
- **The warnings** are the ones established before the exit: a code and the
  pages withheld with it, and the seed skips and empty tables of an apply that
  landed. A sentence the exit's own message already says is left out of the
  note (the QR refusal says its code and pages itself). The reply model gets
  each one as its own fact.
- **What no exit's own sentence says** is said once by the outcome's note
  (`failureNote`): a database made along the way, and photographs kept in the
  uploads. The database is said empty of this change only where its apply
  never ran; beside one that stopped part-way, the note says some of the
  change may already be in it (§6).

### The reply's facts

The failure branch of `addonReplyFacts` leads from the outcome, never from
`ok: false`:

- `none`: *"Nothing was added."* with the builder's own reason, as before;
- what went in: *"Part of this addition went in and is live: the site now
  stores signups."* (done), and a database made: *"The site has its own
  database now, made for this addition; nothing from it is stored in it
  yet."* where the apply never ran, and *"…made for this addition."* beside
  one that stopped part-way, whose unknown note follows (§6);
- what did not: *"The rest of it did not go through: nothing was published,
  so the site's pages are as they were."* with the builder's own reason (not
  done);
- what is unknown: *"Some of its database change may have gone in before it
  stopped; which parts did could not be established."*, or for an older
  answer with no evidence, *"This answer does not record whether any part of
  the addition went in before it stopped, so that cannot be said either
  way."*;
- what is saved and not live: the design (*"The change itself is still saved,
  so it could go out with their next edit."*) and the photographs (*"…saved in
  their uploads; it is not on the site."*), as worth knowing.

A requirement is said as `toldAs` says it under the outcome. On a success, and
beside changes that went in, it is said as told. Where nothing of this change
was applied, an older answer's "set up" or "scheduled" is "already there".
Where the apply cannot be read, it is unseen. A failure's old note is never
the fallback.

### Older saved answers

- **The facts** read an answer with no outcome off what it carries. Its
  database record (`applied_without_page` → changes that went in; `pending` or
  `failed` → unknown) comes first. Then a designer's refusal or every designer
  declining, which answer before anything is written in every version that
  wrote them → nothing changed. Anything else → not recorded.
- **The poll route** (`servedEditReply`, the one route every stored job reply
  reaches the page through, request parts included) hands a failed addition's
  answer that has a note but no outcome back with its outcome read the same
  way. Its note is composed from its lists by the reply's own rule
  (`replayedCoverNote`): the already-there sentence where the old one said
  "set up", and every warning it carries. The old note is dropped when no list
  can stand in for it. The stored reply itself is untouched.
- **The browser** prints a failure's note only beside an outcome
  (`failureOutcomeOf`), so a raw older body shows its own sentence and nothing
  it cannot vouch for.

### The seed sentence

*"I had starter rows ready for posts and didn't put them in — I only add
starter rows to a table anyone can read and no visitor can change."* It is the
rule the engine applied, the same rule the reply model's fact states. It
claims neither that visitors cannot read the table nor that it starts empty.

## 3. What changed

- `builder/site-add.mjs`: `failureOutcome`, `failureNote`,
  `replayedCoverNote`; the seed sentence (and `seedSkipSentence`, shared by
  the note and a stored answer); `notLandedMsg`'s `changed`.
- `builder/site-reply.mjs`: `FAILURE_STATES`, `outcomeReads`, `outcomeOf`,
  `toldAs`, `toldEntries`, `warnedEntries`; the failure branch's facts
  (`failureFacts`, `liveOf`); `coverFacts` by outcome.
- `builder/site-migrations.mjs`: `migrationNote` names this change's tables.
- `worker.js`:
  - `aFail`, `aNone`, `aFailure` and `aDown`'s outcome, and the provision's
    refusal through `aFail`;
  - `aCoverage({ failed, said })`, `aMade(failed)` and `aReportable(failed)`;
  - `aProvisioned` hoisted above the kinds loop, and `aSpecHad`;
  - the publish exit (`aDb`, `aLanded`), `ADDON_SCHEMA_FAIL_MSG`, the config
    sentence, and `unbilledBody`;
  - `servedEditReply` for older answers.
- `public/chat.js`: `failureOutcomeOf`; a failure's note only beside it.
- `scripts/addon-sweep.mjs`: `failureOutcomeOf` in the browser's cut list (and
  in the seven test harnesses that cut their own).
- `test/fixtures/addon-route.mjs`: `notServed` (a publish that fails after the
  seam), `tableFail` (a table the database will not create), and `configFail`
  as a count (the design stored, its put-back refused).

## 4. Verification

- **The commit**: the fix is `c4748136`, on `08b9a657`; its records are the commit after it.
- **The red check** (free, in a throwaway `08b9a657` worktree). The new test
  file and the harness's three new options were copied in, and the new names
  stubbed to throw. **All 18 cases fail there.** A second pass, with the new
  field's own equality checks taken out, shows what each one trips on in the
  old behaviour:
  - ROUTE 1: the publish failure's sentence names *"now storing bookings,
    signups"*;
  - ROUTE 2, 2b and 7: the failure carries no requirement outcome at all;
  - ROUTE 3: the database's failure says *"this is on us, and your site is
    untouched"*;
  - ROUTE 4 and 5: the facts lead *"Nothing was added"* over a saved design
    and over a database made for the site;
  - REPLAY 1: the screen prints *"I couldn't add that. I've set that up, but
    I can't confirm from here that The owner is emailed…"*;
  - REPLAY 2: the facts lead *"Nothing was added"* over an older answer whose
    database record says the changes went in;
  - QUEUE 1: the gate's refusal reads *"…couldn't be published (rpc), so
    nothing was changed."* right after *"The database changes for this were
    made — now storing signups —"*;
  - SEED 1: the old sentence;
  - OUTCOME 1 and 2, NOTES 1, REPLAY 3, WIRE 1 and 2 reach names or a door
    the old code does not have. The same harness on `08b9a657` also showed
    the poll route serving the older refusal's note verbatim;
  - **ROUTE 6 (an incomplete judgment) passes there once its outcome check
    is taken out**: that behaviour was already right (no apply, no charge,
    nothing told, ours). The case guards it and adds the outcome.
- **The sweep** (`scripts/mutants/failure-outcome.json`, over the five
  changed source files, with the six test files that kill them):
  - **the first run**, 58 planted defects and 4 controls, caught 57, and
    the controls survived. The survivor, R3 (names trusted beside an
    apply that never landed), was a question about the case first: OUTCOME
    1's named-but-not-applied outcome also contradicted its own summary, so
    the consistency rule caught it before the names' rule. OUTCOME 1 now has
    three outcomes whose summary their other fields do give, so only the
    names' rule refuses them, and R3 dies on that case alone (measured);
  - two more were added with the provision and model-down exits (W26, W27,
    the latter restoring `08b9a657`'s exit exactly);
  - **the final run**: 60 planted defects and 4 comment-only controls, from a green baseline: **all 60 caught, none that failed to apply, and the 4 controls survived**. The five source files matched their pre-sweep hashes afterwards.
- **Re-anchored, the property kept** (each pinned a spelling this batch
  moved):
  - `site-migrations`: the reserve and pageless guards, the compile exit's
    message, `aDb`/`aLanded`, the door's evidence, the schema sentence;
  - `edit-reserve-refused` (two guards), `backend-repair` (the seed effect),
    `addon-refusal-warnings` (REFUSE 1, WARN 1, 4 and 5, WIRE 1),
    `addon-failure` (the note beside the outcome);
  - `site-add` (the allow-list gains `./site-reply.mjs`; the provision's
    502 through the door), `site-addon` and `add-second-one` (the merge
    stops through the door), `requirement-coverage` (landmarks, the door
    count, `aMade(failed)`), `addon-route` 56 and 161 (outcome none,
    requirement still to do), `add-goes-to-addon` (the merge's last
    refusal through the door);
  - `failureOutcomeOf` added to the browser cut lists of `addon-sweep` and
    seven harnesses.
- **The suite**: `9571 / 9571 / 0 / 0` here (the 9,553 before, plus the 18
  new cases). The first run on the final code found one guard still pinned
  to the old spelling of the merge's last refusal (`add-goes-to-addon`).
  It was re-anchored, and the second run was clean.
- **CI on `13bfcd17`** (the fix with its records on top) is complete and
  green:
  - unit tests (run 37451667975): `9571 / 9559 / 0 / 12`, the same total as
    here. CI skips its usual 6 and the 6 real-browser cases;
  - the site build (run 37451668063): all seven jobs and the gate passed,
    *"404 checks in 27 sections across 4 shards, every job green"*.
- **The image** (predicted, not built): `3f3862946e322404` at `08b9a657`
  becomes `01abfc1e158153f9`. There are 194 inputs, none under `public/`.
  The live image is deploy 2184's `589e3e4e85a20066`.
- **Screenshots** (sent in the chat): rendered headless from the repo's
  `public/` with the answers the real routes gave in the harness, before
  (`08b9a657`) and after:
  - the older refusal as the poll route serves it;
  - the sign-up page whose publish failed after its table went in.

## 5. Remaining limitations, kept separate

- **A dead add-on job's reconciled reply** (`reconcileReply`) carries no
  database record, although the reconcile settles its migration
  `applied_without_page`. Its facts now say the answer does not record what
  went in ("not recorded"), not "Nothing was added". The tables are not named.
- **A publish that began and then failed under a job** is held for review, its
  reply with it (unchanged). Only a failure before the publish begins, such as
  the gate refusing, is replied to at once.
- **A request records an add-on part with database changes live as failed**,
  and its own reply says "Not done … its own reply above says why". The part's
  reply says what went in. The request driver's statuses are unchanged
  (execution and retry, as asked).
- **A provision that fails after its Neon project was recorded** (a late
  stage: the database, auth, the Data API, or the link itself) leaves that
  project behind, not linked to the site. The next ask reuses it
  (`lookupProject`) rather than making a second. The outcome says the site is
  unchanged, which it is, and does not name the project.
- **The developer record** (`addon-answer`) is not re-written at a failure.
  It keeps the reading composed before the publish.
- **A cancel or budget stop after a database was made** (`editStopped`, shared
  with the edit route, and ours) says nothing was published and nothing about
  the database.
- **Judgment is by item, not column**: a requirement carried by an existing
  table that this change would have altered is not called set up on a failure
  (now guarded), but it can read "already there" for a column the site never
  had.
- **Two more name lists are cut at three, found here**: the pages an unseen
  rewrite left (`unseenPagesNote`) and the pages a merge kept
  (`keptReply`).
- **Parked, as the owner said**: a designer's requirements past its twelfth;
  the rest of the backlog.

## 6. The correction after review: a database made, then an apply that stopped part-way

The owner, after Codex passed the replay and partial-failure fixes on
`13bfcd17` with CI green: *"Close one remaining combination within this same
fix: failureOutcome({provisioned:true,database:"unknown"}) produces a valid
unknown outcome, but failureNote still says "nothing from this is stored in it
yet," and failureFacts uses the same unsupported assertion. Codex reproduced
the contradiction through the actual browser composer alongside
ADDON_SCHEMA_FAIL_MSG. State that the database was created while preserving
uncertainty about what applied; only claim that nothing from the addition was
applied when the evidence establishes database:"none". Correct the shared
fallback and model-fact paths consistently."*

**Reproduced first** (free, through the real route and the browser's
composer). Both schema exits produce it when this run made the site's
database first: the pageless apply, and the apply at the publish's seam. The
outcome was right (`{ state: "unknown", published: false, database:
"unknown", provisioned: true }`), but the words were not:
- **the screen** (no model reply, since a schema stop is ours) printed the
  schema sentence's *"…some of the database change may already have gone in
  before it stopped…"* and then the note's *"I did set up a database for your
  site along the way — nothing from this is stored in it yet."*. On the
  publish path the note also had *"I can't see from here whether Each signup
  is kept…"* before it;
- **the reply model's facts**, for a stored answer they read, said *"The site
  has its own database now, made for this addition; nothing from it is stored
  in it yet."* above *"Some of its database change may have gone in before it
  stopped…"*.

**Now** only an apply that never ran (`database: "none"`) earns "nothing
stored", on both paths that say it:
- **the note** (`failureNote`, the screen's own words when no model reply is
  written): *"I did set up a database for your site along the way, and some
  of this change may already have gone into it."* beside an apply that did
  not land and may have partly run. It is unchanged beside one that never ran,
  and it is still silent beside one that landed (the migration sentence says
  what is live). Any value other than `none` gets the uncertain sentence;
- **the facts** (`failureFacts`): *"The site has its own database now, made
  for this addition."*, with the unknown note after it. Beside an apply that
  never ran, or one that landed, they are unchanged;
- **no route change**: execution, charging and retries are as they were;
- **stored answers**: none carries the old sentence beside an unknown outcome.
  The code that wrote it (`c4748136`) was never deployed. The poll route
  serves a stored answer as stored, and the facts are recomputed from its
  outcome;
- **the harness** gained `sqlFail`, a statement pattern refused in
  Postgres's own shape. The pageless path declares no table, and the engine's
  own tables are created unquoted, so `tableFail` cannot reach them.

**Verification** (the correction is `9c2ca743`):
- **5 new cases** (PROV 1–5), each also through the browser's composer with
  no model reply:
  - the note and the facts at the modules;
  - the pageless path: a database this run made, the engine's `_secrets` in,
    then `_errors` refused;
  - the publish path: the seam's apply refused at `signups`;
  - the controls: an apply that landed before the publish failed, and a stop
    before any apply;
  - the route's answer stored on a job and served by the real poll route,
    and a stored answer the facts read;
- **the red check** on `9d309401` (a throwaway worktree, the updated test file
  and harness copied in, nothing stubbed: every name they use is there).
  Exactly PROV 1, 2, 3 and 5 fail, each on the sentence. The 18 earlier cases
  and PROV 4 (the controls) pass;
- **the sweep**: 66 of 66 planted defects caught (six new for this correction, two re-anchored), none that failed to apply, and the 4 controls survived;
- **the suite**: `9576 / 9576 / 0 / 0` here (9,571 plus the 5 new cases);
- **CI**: green on `49a67763` (the correction with its records): unit tests (run 37454790799) `9576 / 9564 / 0 / 12`, the same total as here; the site build (run 37454790999) all seven jobs and the gate passed, *"404 checks in 27 sections across 4 shards, every job green"*.;
- **the image** (predicted, not built): `c7fe818d446dd957`;
- **screenshots** (sent in the chat): both failures before (`9d309401`) and
  after, on the page's own screen with the answers the real route gave in
  the harness. `public/chat.js` is not changed by this correction.
