# 2026-10-24 — The first build makes the database its pages need; the last build caps go

Branch `first-build-db-limits`, from `origin/first-build-uncapped` (`c3cd3501c`,
itself on `main` `692087cde`). On the owner's word (2026-10-24). **Not merged,
not deployed. Nothing spent: every model and network answer in the tests is
supplied.**

## A. The first build creates the site's database when the site needs one

### Why the first build stopped making databases (2026-08-24)

From the comments at `FRONTEND_SCHEMA_TOOL` and `needsDb` in `worker.js`, and
`docs/build-path.md` step 3:

1. **The owner's call**: *"at build time model only does frontend, the backend
   comes at later"* and *"every site doesnt get a neon db on 1stbuild"*.
2. **A Neon project is a capped, billed resource**: a platform cap of 100
   projects, and brochure sites were getting one, scaling it to zero and never
   reading a row (the 2026-09 inventory: 70 sites, 31 with a project).
3. **A designer handed backend fields answers them**: tables invented for a
   brochure site, each a project, an access decision and a page wired to rows
   nobody writes.
4. **Prompt size**: `backend` is ~41% of the design tool on the wire
   (29,189 of 70,594 characters, ~7,250 tokens).

**Which still hold.** 2 and 3 are real safety reasons and are kept: a site
whose design names nothing that needs storing makes no backend call and no
database, exactly as before. 4 is kept too: the frontend tool is unchanged;
`backend` is sent only on the builds that need it, in a call of its own. 1 is
superseded by the owner's word of 2026-10-24.

### What changed

- **`builder/first-build-db.mjs`** (new, pure): `wantsFirstBuildBackend` (the
  design named features in `notBuilt` and declared no tables),
  `firstBuildBackendTool` (the site tool's **own** `backend` property, never a
  copy, plus a `notBuilt` for what even a database cannot make),
  `firstBuildBackendBrief` (the brief, the planned pages, the features) and
  `mergeFirstBuildBackend` (the answer lifted in through `liftBackend`, exactly
  as a revise's is; an answer with no table changes nothing).
- **`worker.js`**: `designFirstBuildBackend` makes the one call
  (`SITE_SCHEMA_SYSTEM` plus `FIRST_BUILD_BACKEND_RULES`). The build route calls
  it after the design and before the seed top-up, only on a first build with no
  caller-supplied schema. From there the existing chain runs unchanged:
  `topUpSeed` fills display tables the answer left unseeded; the settlement now
  sums the design, backend and seed calls (`schemaSettlement` prices each at its
  own model); `needsDb` (a fact, never the flag) provisions the Neon project;
  `applySiteSchema` creates every table with RLS, the access each table's level
  resolves to (`resolveAccess`), the pinned `search_path` and column-scoped
  write grants (public writes keep the platform's own visitor check);
  `seedSiteRows` writes the rows; the page writer is handed the schema
  (`bandPrompt`'s "THE SCHEMA THAT EXISTS"). A failed or empty backend call keeps
  today's frontend-only site and the design's own `notBuilt`: never a failed
  build. The answer carries `backendDesign: { ran, made, failed? }`.
- **The design prompt and `NOT_BUILT_FIELD`**: the designer still designs no
  database, but plans the form or list and names its feature in `notBuilt`; the
  step after it designs storage for exactly those.
- **The reply facts**: `buildFacts` carries `madeTables` (inline build and the
  collected/resumed build), and the reply says the database was made and names
  its tables; `noDatabase` is told only when none was made; `notBuilt` names
  only what the backend call said it still cannot make.
- **Dockerfile**: `builder/first-build-db.mjs` added to the worker's builder copy.

## B. The remaining caps

| Cap | Was | Now |
|---|---|---|
| `IMAGE_CAP` (site-images.mjs) | 6 photographs per build | `Infinity`; still bounded by `IMAGE_PURCHASES` (off buys nothing, unchanged), the balance (`imagesAffordable`), the clock (`photoWait`), the library (`MAX_FILES_PER_SITE` 200), and **at most 8 purchases at once** (new `permits(MAX_MODEL_FANOUT)` gate in `buySitePhotos`; a shot still queued when the wait ends is never started) |
| `MAX_REPAIRS` (site-repair.mjs) | 3 model-repaired pages | `Infinity`; render and compile repairs run 8 at a time |
| `MAX_STRINGS` (site-translate.mjs) | 900 strings | `Infinity`; every string goes through the existing batches (150 strings / 6,000 characters, 3 calls at a time) |
| `MAX_FILES` (compile-repair.mjs:20) | 3 files per round | `Infinity`; every page the error names (else every page written), 8 at a time |

Kept: `MAX_ERROR` 4,000, `MAX_TWEAK_CHARS`, `MAX_PROMPT_CHARS`, the batch sizes,
`MAX_MODEL_FANOUT` 8, `MAX_ROUNDS` 2. The reply's "one build makes at most 6
photographs" now reads "it was past what this build could buy" (reachable only
when the balance or the clock cut the list).

**Overlaps.** `IMAGE_CAP` is also the add-on's photo ceiling (`site-add.mjs`
`cleanAdd`), so the add-on now keeps every picture asked for — overlaps
`addon-uncapped`. `compile-repair.mjs` is also edited by `repair-everywhere`:
only the constant, its comment, the import and the gate in
`compileRepairRound` changed here. `worker.js` `buySitePhotos` is exported for
the test.

## Tests

- `test/first-build-db-limits.test.mjs`, 13 cases: the backend decision; the
  tool is the site tool's own property; the merge; **the real
  `applySiteSchema` on the merged spec** (both tables created, RLS on each, a
  `search_path` pin, the booking form's anonymous insert column-scoped); the
  band writer is handed the schema; the reply facts; **through the real build
  route** (a booking form plus an editable menu makes one backend call and
  reaches Neon provisioning; a brochure build makes neither; an empty backend
  answer makes no database); 20 photographs bought with a peak of at most 8,
  none with `IMAGE_PURCHASES` off; 1,500 strings collected and batched with
  none dropped; 5 pages repaired in one round.
- Re-pinned to the new behaviour: `site-images` (5), `addon-route` (1),
  `build-content-outcomes` (2), `build-repair`, `site-repair`,
  `addon-compile-repair`, `ai-writes-all` (the two answer regexes), `wiring`
  (the photo chain's end landmark, now `export async function`).
- Red check (the product files at `origin/first-build-uncapped`, the new module
  kept): 7 of 13 fail (reply, route ×2, photos ×2 — `buySitePhotos` was not
  exported there — strings, repair); the 6 that pass are the pure module, the
  engine and the brochure control, as they should.
- Sweep, suite and image: below.
- Also re-pinned after the full suite: `build-batch-7` (the evaluated
  `buySitePhotos` is handed `permits` and `MAX_MODEL_FANOUT`), `build-budget`
  (`backend-design` is a design-stage mark), `build-outcome-facts` (the
  not-offered sentence).
- **Sweep**: 17 of 17 mutants killed (the backend decision, merge, tool, brief,
  route call and merge, both reply facts, each cap restored, the photo gate
  unbounded, the 900 slice); the comment-only control survived. Restored from
  saved copies; the tree was checked for mutants before the commit.
- **Full suite** (before the last three test re-pins): 12,478 tests, 12,465
  pass, 10 fail, 3 skipped. 3 fixed afterwards (build-batch-7 ×3,
  build-budget, build-outcome-facts: 5 cases, now 52 of 52 in those files);
  the other 5 are environment-only: the image-inputs case (a new file not yet
  committed), media-verify's browser mode, the node_modules-symlink case, and
  two browser page cases under load (REOPEN 1, PAGE 1).

## Add-on photographs (the owner, 2026-10-24)

The add-on's photo ceiling **is** `IMAGE_CAP` (`cleanAdd` in `site-add.mjs`),
so removing it makes add-on photographs unlimited too, still bought only when
`IMAGE_PURCHASES` is on (`makeSitePhoto` refuses otherwise). Guard: the
re-pinned `addon-route` case (20 pictures asked for, 20 kept, none over-cap).
`MAX_OWN_PHOTOS` (12) is not a purchase bound: it is how many of the site's own
stored photographs the add-on designer is shown in its prompt (a prompt-size
bound), so it is kept. **Combining with `addon-uncapped` needs its remaining
photo over-cap removed** (it reported `IMAGE_CAP` 6 as the only one left).
