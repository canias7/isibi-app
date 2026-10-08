# The first Build, audited (2026-10-08)

**Read-only.** This audit used the source, the existing evidence and free
offline reproductions:
- modules imported with supplied inputs;
- the real `POST /api/site/react-build` driven with every model answer
  supplied and every network call stubbed;
- the existing tests.

No model call, paid call, network write or secret read. **Nothing is fixed
here.** The gaps are presented together, as asked, before any batch is
chosen.

The trace followed the model's actual inputs and outputs through the readers,
validation, execution, assets, publishing, recovery and billing. Four
investigators worked in parallel, one per stage group. Their scratch
reproductions are kept outside the repo, in the session scratchpad
(`audit-a`–`audit-d`). The session re-checked the headline claims against the
source:
- salvage keyed on a stage the container no longer sends;
- `mergeLook` falling back to the request body's `images`;
- the head marker written whatever the source save returned;
- build rows billed `external` with no reversal on the lost sweep;
- the job carrying the caller's access token.

**One context point.** A first build designs with `FRONTEND_SCHEMA_TOOL`,
which has no `backend` field. So the database, schema and seed gaps (M9,
M10, L7, L8) reach a first build only when the caller sends `body.schema`;
every revise reaches them.

## High

| # | Gap | Evidence | What happens | Test |
|---|---|---|---|---|
| H1 | **A build swept `lost` keeps its design charge, and its message can be false** | Deposit and settle are debited under `build:<job>:deposit` / `:settle` (`worker.js:17938`, `18256`). Build rows are billed `external`, so `edit_sweep_lost` → `edit_refund` moves nothing for them. `runLostEditJobs` (`worker.js:14944`) only counts. `refundBuildByRef` (`worker.js:624`) is called only from the collector's own exits | A container recycled or killed mid-build leaves the customer charged for the design, with no site. `LOST_SITE_MSG` (`builder/build-lease.mjs:173`) can promise a stand-in that was never published, or call a published site a stand-in, and says "you weren't charged" while the design was | none; `scripts/edit-rpc-check.sql` asserts that a lost build moves no money |
| H2 | **The customer's access token is used for ledger calls long after the request** | `packJob` keeps `auth` (`builder/build-job.mjs:140`); `buildArgs.auth` (`worker.js:19305`) feeds `readCredits` (`13875`), the pages debit (`13881`) and the settle debit (`18256`). Tokens can arrive with about 60 s left (`public/auth.js:124`, `157`) | With an expired token: the settle debit fails silently (`catch { /* keep the build */ }`); `readCredits` throws and reads as balance 0, so the build ends `stage: "credits"` with a false "not enough credits" message, after a paid generation on the collector path; the pages debit fails and the site publishes free | none for expiry (`test/publish-pages.test.mjs:677` covers a ledger outage only) |
| H3 | **The customer's attachments become the design's photo list** | The browser sends `images: imgs` (the attached files, `public/chat.js:13467`). `mergeLook` falls back to the body (`builder/site-edit.mjs:687`), and any array counts as a value (`:901`) | When the designer leaves `images` out (its tool allows that), no attachment gives `look.images = []`, which reads as "no photographs"; one attachment stores the file's data URL in `config/<slug>.json` and keeps it | none (the `mergeLook` tests pass an empty body) |
| H4 | **A design with no usable answer still builds and charges, on a first build** | `designSiteSchema` returns `input: null` with no tool call (`worker.js:4317`, `4331`; Grok's invalid JSON becomes no tool call, `builder/model-xai.mjs:226`; the waves return null on missing fields). The only empty-design refusal is off for first builds: `!(firstBuild && !body.schema)` (`worker.js:18627`) | The build goes on with an all-null look: a random `site-xxxxxx` name used as the brand, no theme, no plan, no layout or component list for the writer. It is charged, and nothing says the design failed | none; `test/design-waves.test.mjs:576` says "the route already refuses", which is false for first builds |
| H5 | **A failed source save is masked, so the next edit works on the wrong pages** | `saveSiteSource` (and the parts and kit saves) swallow a failed write and answer `false` (`worker.js:10156-10168`); the head marker is written anyway (`13855-13861`; edit publish `12844`, `12864`); `repairNeeded` then answers `same` (`builder/site-builds.mjs:533-538`) | After a revise whose source write failed, the next edit works on the previous version and republishes it, silently undoing the revise. A first build has no stored source at all. `sourceStored: false` reaches the reply, and the browser never reads it | none |
| H6 | **A customer-attached photo is shown to the model but never stored or placed** | `attachments(body.images)` (`worker.js:17739`) goes only to the designer and the page writer. Nothing in the build route writes `uploads/<slug>/`, the only source a page `src` may use. `contextSentence` says nothing about an image only seen | "Use the attached photo of our shop front as the hero" never shows it. At best the writer asks for a generated photo, which is bought and charged instead, and the reply says nothing | none |

## Medium

| # | Gap | Evidence | What happens | Test |
|---|---|---|---|---|
| M1 | **Salvage can never fire** | Salvage runs only on `stage === "typecheck"` (`builder/publish-pages.mjs:1346`). The container records `tsc` errors as `typeErrors` and refuses only with `stage: "build"` (`builder/build-server.mjs:2431`, `2596`, `2683`). No producer of `"typecheck"` exists (session grep) | A page vite cannot bundle sends the whole build to the placeholder (design refunded) after one wasted identical retry. Stubbing the bad page, which `docs/build-path.md` step 7 promises, never happens. The backlog's explanation (MAX_PAGES 1) names the wrong cause | the 24 salvage tests fake a `typecheck` result the container no longer sends |
| M2 | **A band that fails the band check is silently stubbed; the trace says it was written** | `assembleBands` replaces it with `bandStub` (`return null`) and returns `refused` (`builder/page-bands.mjs:1205-1215`). `wrote` counts bands with source, not bands kept; `publishPages` drops `refused`. `keep` stores the assembled input, losing the model's band | A whole section, such as the menu, never ships, and nothing says so (band split: building account only) | none |
| M3 | **Languages on a first build** | `collectStrings` and `translatePages` run over pages only (`worker.js:13560`, `13575`); band parts are not translated (`builder/site-langs.mjs:278`). `resolveLangs`' `refused` is dropped (`worker.js:13499`/`13550`). A failed or truncated translation is only logged (`13568`, `13574`, `13578`) | On a split site the second-language page imports the English parts. On every first build, a refused language (more than 3, or a prefix collision) or a failed translation ships untranslated with nothing told. The edit path reports both | edit path only (`test/wiring.test.mjs:1641-1700`) |
| M4 | **A design page path other than "/" loses the arrangement and the photographs** | `pageList` rewrites the single page to "/" (`builder/site-plan.mjs:408`); `pageShapes` (`:439`) and `pageImages` (`:487`) then miss entries naming the model's path | The arrangement vanishes and the photo list reads as "none", with no log line | none |
| M5 | **The first build's page writer is never told the theme or the stylesheet** | Both build calls pass `briefWithLayout({ brief, plan, tsx, gif, qr, three, images })` without `theme`/`css` (`worker.js:13380`, `13456`); the edit and add-on paths pass them (`28565`, `32669`) for `styleDirective` (`builder/page-gen.mjs:2582`) | The writer restates style rules inline, the problem `styleDirective` exists to prevent | unit only |
| M6 | **A design shape line is cut at 120 characters** | `MAX_SECTION = 120` (`builder/site-plan.mjs:299`); the tool states no limit | A realistic line is cut mid-word, stored, shown to the writer and used to split the page into bands | none |
| M7 | **A refired generation runs without the attachments** | The resume record stores `attachments: []` (`worker.js:19406`, `19422`); a refire (`17104-17165`) starts a new generation with no blocks | A build whose container lost the work regenerates without the customer's PDF or photos, while the context note still implies they were used | the drop itself is asserted (`test/build-jobs.test.mjs:453`) |
| M8 | **"Ran out of time" for photographs is reported as "not enough credits"** | `buySitePhotos` sets `slow` (`worker.js:2722`); `publishPages` rebuilds `out.images` without it (`builder/publish-pages.mjs:1274-1308`) | The customer is told to buy credits when asking again is free | none |
| M9 | **A row-level-security failure does not stop the grants after it** | `applySiteSchema` runs policies then grants, statement by statement, logging each failure (`site-schema.mjs:1626-1629`); `ENABLE ROW LEVEL SECURITY` is first (`site-rls.mjs:265`) | If that one statement fails transiently, the policies and the grants still run, and any signed-in member can read every row of an owner-only table; nothing is refused | SQL text only |
| M10 | **Database features that failed to install are left off the build reply** | `made.refusedRules` (`site-schema.mjs:1947-1950`) is a property on an array that JSON drops (`worker.js:19650`); the add-on route copies it out | A `noOverlap` guard or a unique index the database refused is silently missing | none on the build route |
| M11 | **A failed sidecar write still reports a successful publish** | `reversible` in `activateBuild` logs and returns (`builder/site-builds.mjs:270-276`) | New script, old head: old title and redirects, and a new route may answer 404 | none |
| M12 | **An unreadable sidecar erases the site's redirects** | `manifest = prevUnreadable ? null : …` (`worker.js:11234`), then the sidecar is rewritten with `redirectsCsv: ""` | Every old 301 becomes a 404 after the next publish (revise and edit scope, same code) | spelling only |

## Low

| # | Gap | Evidence | What happens |
|---|---|---|---|
| L1 | The browser-repair pass on a split build rewrites the shell, never the band that crashed | `repairPages` gets `pages` only (`builder/publish-pages.mjs:1416`) | A paid repair call on a file that cannot hold the fault, and a possible false `renderRepaired`. The inline route forwards none of the repair fields; `repairNote` has no callers |
| L2 | Two pages that map to one route pass validation | `validatePages` de-duplicates by path only (`builder/page-gen.mjs:3227`) | `about.team.tsx` + `about/team.tsx` fails route generation and sends the whole site to the placeholder; `menu.tsx` + `menu/index.tsx` hides one page while the render check passes; `menu/./prices.tsx` overwrites `menu/prices.tsx` while `pages.json` keeps both |
| L3 | A render check cut off by its time budget, finding nothing, is never told | `partial: true` (`site-render.mjs:749`) is dropped by the inline gate (`worker.js:19786`) and ignored by `renderNote` | Pages nobody opened read as checked |
| L4 | The first message and typed clarification answers are cut without notice | `raw.slice(0, 2000)` (`public/chat.js:14234`), `slice(0, 200)` (`:13819`) | A longer brief or answer loses its end, against the 2026-10-03 rule |
| L5 | A partly failed photo purchase reads as plain success | `imageNote` ignores `error` when `made > 0` (`builder/site-images.mjs:1596-1600`) | "Made 1 photograph" when 2 were planned and 1 failed |
| L6 | A web font whose download fails is dropped silently | `fetchSiteFonts` logs and skips (`worker.js:11348-11391`); `writeFonts` still answers `applied: true` | A system fallback with nothing said; the edit path refetches on every edit, so a blip can drop a live site's typeface |
| L7 | Starter rows skipped or refused are never shown | `seeded`/`seedSkipped` reach the reply (`worker.js:19663-19672`); no browser note reads them | An empty menu reads as a working build |
| L8 | Tables past the 24th are not created, but the writer is told they exist | `spec.tables.slice(0, 24)` (`site-schema.mjs:966`); `withStoredSpec` merges the full spec back (`worker.js:7750-7763`) | The pages for table 25 fail at runtime (integrator path) |
| L9 | A corrupt live pointer blocks every later build | `expectEtag: null` becomes `etagDoesNotMatch: "*"` (`builder/site-builds.mjs:243-246`) against an unparsable pointer, which fails as `superseded` | Every build and edit fails until it is fixed by hand |
| L10 | The inline route reverses only debits it heard back about | A committed deposit whose answer was lost returns 503 with no reversal (`worker.js:17940`); a swallowed settle is never entered in `bill` (`17909-17912`) | Money kept with no record of it; the collector's by-ref reversal does not have this gap |
| L11 | On the fired path, the collector's deadline is shorter than a split generation can take | `RESUME_DEADLINE_MS` 690 s (`builder/build-resume.mjs:152`) against up to 11 calls in rounds of 8 at 600 s each | A legitimate fan-out past 690 s is stopped: placeholder published, the platform pays for a generation it drops (split is canary-only) |
| L12 | A first build never stores its landmark map | `buildAndPublishPages` saves landmarks only when `out.ok && out.render` (`worker.js:13955`); `publishPages` never sets `out.ok` | Later edits that read landmarks find none from the first build |

## Suspected, not confirmed

- **A placeholder build may be finalized `done` on the collector path.**
  The reply is `{ ok: true, ...pages }` (`worker.js:17240`). The inline path
  closes the same outcome as failed.
- **A Neon project from a provisioning failure may stay** if the customer
  never retries. The teardown was not traced.
- **A designer slug may collide with another of the customer's sites** when
  the per-chat lookup fails. This is documented as an intended trade-off.
- **A `-`-prefixed page segment** may be listed but answer 404.
- **Dynamic `$` routes** are never render-checked, and the report does not
  say so.
- **Photos may be orphaned** after a race-mode cutoff, or on a stubbed page.
- **`tsx` component names** are not checked against the kit.
- **Non-string `description` or `tsx[].name`** values are passed through
  `String()`.

## Checked and fine

- **Router on a first build**: only build, clarify or ask, and a throw
  becomes build at no charge; the clarify budget is enforced.
- **Attachments**: the count cap; skipped files and dropped PDFs are reported.
- **Linked pages**: capped, and failures are reported.
- **Truncation**: a truncated design is refused.
- **Design fields**: the theme enum is checked against the registry;
  favicon, wordmark and QR are validated.
- **`write_pages` shape**: no call, an empty list, no `index.tsx`, a page too
  long or more than 6 pages are each named.
- **The raw answer**: kept before validation.
- **Path traversal and kit overwrites**: refused; parts are confined by
  name.
- **Render check failure**: fails open as `ok: false` when the browser is
  down.
- **Billing order**: settle and pages are charged only after publish; a
  publish throw is free.
- **Debits and reversals**: debits are idempotent on (ref, reason);
  reversals are by ref, never more than debited, and founders get 0.
- **Resume**: never repeats a paid design or generation; a refire is bounded
  at 1 and platform-paid.
- **Publish order**: stage then activate, the manifest last; the pointer
  revert is conditional; the first activation is create-if-absent.
- **Stored source**: matches what was compiled, through image sweeps,
  salvage stubs and render repair.
- **Access presets**: always through `resolveAccess`.
- **Provisioning recovery**: the attempt is noted first.

## Stale documentation found (not changed here)

- **CLAUDE.md** says a cold account is one credit short (`buildFloor` 20
  against a grant of 20). For the default Grok picker, `buildFloor` computes
  16.
- **The backlog and traps entry "salvage cannot fire on a new build"**
  blames `MAX_PAGES` 1. The cause is M1, and it applies to every build.
- **The header contract of `builder/build-server.mjs`** still lists
  `stage: "typecheck"`.

## Next

The owner chooses which gaps form the first implementation batch. They are
then implemented with focused tests through the real paths, red checks,
sweeps and the regression gate.

Dependency-based parallel-execution planning comes after that decision.
