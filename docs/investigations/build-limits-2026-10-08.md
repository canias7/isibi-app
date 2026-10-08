# Build limits — inventory and proposals (2026-10-08)

The owner's instruction for this review (2026-10-08): *"preserve Build's
existing maximum page count and maximum selected-component count, currently 1
and 15. Review the other limits individually; this is not permission to remove
every timeout, provider constraint, security control or spending safeguard."*

So `MAX_PAGES = 1` (`builder/site-plan.mjs:262`) and `MAX_COMPONENTS = 15`
(`builder/site-plan.mjs:281`) **stay as they are**. Every other limit on the
first-build and revise path is listed below with where it lives, its value,
the reason given for it, and what the customer sees when a request goes past
it. **Nothing here is changed yet**: the proposals at the end are for the
owner's review.

Line numbers are as of the commit that adds this file. **Class**:
**O** = an operational constraint (a provider or model limit, time, money,
security). **C** = a content restriction chosen by us.
**Silent** = the customer is never told.

## 1. The brief, the questions, and what the designer and writer read

| Where | Value | Applies to | Reason given | Past it | Class |
|---|---|---|---|---|---|
| `public/chat.js` (first-build send, `raw.slice(0, 2000)`) | 2,000 chars | The first message of a first build | "a first build keeps its own 2,000, as it always has" | **Silent cut**; the thread shows the cut copy | C |
| `public/chat.js` (`siteAnswer`, `slice(0, 200)`) | 200 chars | Each clarify answer, typed or clicked | none | **Silent cut** | C |
| `builder/site-ask.mjs:75` `MAX_MESSAGE` | 2,000 | Message and brief shown to the clarify model | the first build's own bound | Cut; recorded as `message-cut`/`brief-cut` flags | C |
| `builder/site-ask.mjs:91` `MAX_CLARIFY` | 3 pairs | Q&A folded into the brief | "a round of questions somebody will sit through" | Extra pairs dropped (the UI asks at most 3) | C |
| `builder/input-budget.mjs:75` `MAX_INPUT_CHARS` / `public/edit-poll.js` `ASK_MAX` | 16,000 | A revise message | carry size beside the site in one request | **Refused and told**; the words go back in the box | O |
| `builder/input-budget.mjs:87` `REWRITE_MAX_CHARS` | 4,000 | Instruction read by a full rewrite | the build pipeline's brief size | Browser refuses and tells; a direct API call is cut silently | C |
| `worker.js` `clarifiedBrief(...).slice(0, 5000)` | 5,000 | Brief + Q&A for designer and writer | none | **Silent cut** (reachable via the API or a long Q&A tail) | C |
| `worker.js` research brief `slice(0, 2000)`; `builder/site-seed.mjs:157` `slice(0, 4000)` | 2,000 / 4,000 | Brief sent to research and seed top-up | none | Silent (context for a side call only) | C |
| `worker.js` `readJsonBody` max | 24,000,000 bytes | The whole request body | abuse bound | Refused | O |

## 2. Linked pages and research (`builder/site-context.mjs`, `worker.js`)

| Where | Value | Applies to | Reason | Past it | Class |
|---|---|---|---|---|---|
| `site-context.mjs:36` `MAX_URLS` | 2 links | Links read from the brief | at most two outbound requests | **Third and later links silently ignored** (`contextSentence` names only attempted links) | O (fetch) — but silent |
| `site-context.mjs:38` `MAX_PAGE_CHARS` | 4,000/page | Linked page text; title 200, description 400 | "~1,000 tokens — enough to describe a site" | **Silent cut** | C |
| `worker.js` `SITE_LINK_BYTES`, 12 s timeout | 1.5 MB, 12 s | One link fetch | SSRF / metering | Told: "Couldn't read X" | O |
| `worker.js` `useQuota("sitelinks", 60)` | 60 per window | Link reads per account | unmetered outbound relay | **Log only**; the links are not read and the customer is not told | O — but silent |
| `site-context.mjs:40` `MAX_QUERIES` | 3 | Research searches | each is billed | Extra queries dropped | O (money) |
| `worker.js` research call | 4 rounds, 1,200 tokens, 120 s | Research | billing/time | Told: "Couldn't look up current details" | O |
| `worker.js` `facts.slice(0, 2500)` | 2,500 | Researched facts handed to the writer | none | **Silent cut** | C |

## 3. Attachments

| Where | Value | Reason | Past it | Class |
|---|---|---|---|---|
| `public/chat.js` `SITE_MAX_FILES`; `site-context.mjs` `MAX_ATTACHMENTS` | 3 files | token cost; mirrors the composer | Toast naming the files not attached; server's skipped list | O/C, **told** |
| image 5 MiB, PDF 3.5 MiB, text 400 KiB (browser); `IMAGE_FILE_BYTES`, `DOC_FILE_BYTES` (server) | per file | provider request size | Toast / "that image is too large" | O, told |
| `site-context.mjs` `BLOCK_TOTAL` | ≈14 MB base64 | one at the cap fits, three never do | Told: "there wasn't room for it" | O, told |
| `site-context.mjs` `TEXT_CHARS` / `TEXT_TOTAL` | 120k / 240k chars | ~30k tokens uncached on two calls | Told: "Used the first N characters from X" | O, told |
| `site-context.mjs` `MAX_SCAN` | 20 entries | amplification bound | Entries 21+ get no message (unreachable from the UI) | O |
| `site-context.mjs` `MAX_SKIPPED` | 6 named | readability | the rest told as "N more files" | told |
| file names | 300 chars (kept in full for identity since this batch; shown beside the id) | display/abuse | — | O |

Attachments are the one area where every limit is reported. **Identity** is
fixed in this batch: each file is `attachment-<n>`, so length and duplicate
names no longer matter.

## 4. The designer's answer (`builder/site-plan.mjs`)

| Where | Value | Applies to | Reason | Past it | Class |
|---|---|---|---|---|---|
| `SITE_SCHEMA_MAX_TOKENS` | 16,000 | Designer `max_tokens` | a ceiling, not a purchase | Build refused, deposit back, customer told | O |
| **`MAX_PAGES` (262)** | **1 — kept** | `pages` | owner's call | Silently dropped (the designer is told "ONE page") | **kept by the owner** |
| **`MAX_COMPONENTS` (281)** | **15 — kept** | `components` | fresh uncachable input | Dropped past 15 (the designer is told) | **kept by the owner** |
| `MAX_PAGE_NAME` 40, `MAX_ROLE` 200, path 80 | | page name, role, path | nav label | Silent cut; a bad path drops the page | C |
| `MAX_PURPOSE` (299) | 400 | `purpose` | none | **Silent cut** | C |
| `MAX_SECTIONS` (298) | 8 | sections per page | 324 exemplars: p95 6, max 9; output bill | **Silently dropped** (the tool says "at most 8") | C (cost cited) |
| `MAX_SECTION` (300) | 120 chars | each section line | output bill | **Silent cut** | C |
| `MAX_ACTION` (263), 80 chars | 3 | `action` | none | **Silently dropped/cut; the tool does not tell the model the cap** | C |
| `pageImages` (506) `MAX_PAGES * 2` | **2 entries** | `images` the designer asks for — **including the customer's own attached photos** | "what the site asked for", overflow counted downstream | **Silently dropped before `overflow` is counted**, so a third photo — or a third attached photo — vanishes with no note, while the tool text invites more for galleries | C — **silent drop of a requirement** |
| `MAX_TSX` (1147) | 3 | custom components | real code | Told in the tool; sliced silently only on the band path (`page-bands.mjs:433`) | C |
| `MAX_BEHAVIOR` (1228) | 12 | `behavior` | "a ceiling, never a number to reach" | Prompt text only; **nothing at build time reads `behavior`** (stored for edits) | C |
| `site-schema.mjs` tables 24, columns 48 (revise) | | schema | none | Silent | C |
| `site-schema.mjs` `MAX_SEED_ROWS` | 12/table | seed rows | — | Told in `seedSkipped` | C, told |
| `worker.js` brand 60, description 300 | | brand, site description | none | Silent cut | C |

## 5. The page writer

| Where | Value | Reason | Past it | Class |
|---|---|---|---|---|
| `page-gen.mjs` `SITE_PAGES_MAX_TOKENS` | 30,000 per call/band/part | a truncated tool call ends mid-expression | One-call path: refused and told. **Band path: a failed or truncated band is published as a `return null` stub, counted only in the trace — the customer is not told a section is missing** | O, **silent effect** |
| `page-gen.mjs` `MAX_PAGES` | 6 | legacy multi-page revise | recorded in `problems` | O/C |
| `page-gen.mjs` `MAX_PAGE_CHARS` | 48,000 | run 52 | page refused → validate/salvage | O |
| `page-gen.mjs` `MAX_PART_CHARS` 12k / `MAX_PARTS_CHARS` 36k / `MAX_STYLE_CHARS` 16k / `MAX_PRIOR_CHARS` 90k | | request size | withheld parts named to the model | O |
| `page-gen.mjs` notes `slice(0, 600)` | 600 | the writer's notes | none | Silent cut | C |
| `build-call.mjs` `BUILDER_CALL_MS` | 10 min | hung call | told | O |

## 6. Photographs

| Where | Value | Reason | Past it | Class |
|---|---|---|---|---|
| `site-images.mjs:159` `IMAGE_CAP` | 6 | owner's call | placeholders, told — but unreachable on a first build because §4's cap of 2 cuts first | C/money |
| `site-images.mjs` `budgetFor` | 0 on revise of a site that bought, 0 for tools | don't re-buy | told via `imageNote` | O/C |
| `imagesAffordable`, `IMAGE_USD` 0.15 | balance-bound | money | told | O |
| `MAX_PROMPT_CHARS` | 240 | "past this it is a page, not a prompt" | Silent cut of the description | C |
| `MAX_KEEP_URLS` | 12 | measured | silent | C |
| `PHOTO_FLOOR_MS` | 35 s | slowest shot | told | O |
| `site-uploads.mjs` `MAX_FILES_PER_SITE` | 200 / 100 MB | owner's allowance | told | O |

## 7. Time, money and retries

All operational, all told or recorded: `CONSUMER_MS` 15 min, `BUILD_BUDGET_MS`
13 min, `PUBLISH_RESERVE_MS` 4 min, `CONTAINER_CALL_MS` 10 min,
`STEP_TIMEOUT` 30 min, render check 25 s, one compile retry, one salvage
recompile, `RETRIES = 1`, `SITE_BUILD_FEE` 2, `MIN_CREDITS` 8. One exception:
**`site-repair.mjs:63` `MAX_REPAIRS = 3`** sets `renderRepairDropped`
(`publish-pages.mjs:1541`), and **no reader shows it**, despite its comment
saying what is dropped is reported.

## What is dropped without telling the customer

1. **A customer's third attached photo, and any third photograph** (`pageImages`, cap 2) — a requirement lost before it is counted.
2. **Band sections that failed or hit the token ceiling** — published as empty stubs.
3. **Sections past 8 and lines past 120 characters; actions past 3 and past 80 characters** (the model is not told the action cap).
4. **Purpose past 400; image descriptions past 240.**
5. **The brief past 5,000** (server), **past 2,000** (browser, first build), **clarify answers past 200**; **facts past 2,500**; **linked-page text past 4,000**; **links past 2**; **link quota exhausted** (log only).
6. **`behavior`** is asked for and never read at build time.
7. **Custom components past 3** on the band path.
8. **Render repairs past 3** (`renderRepairDropped`, unread).
9. **Tables past 24, columns past 48** on a revise; writer notes past 600; brand past 60, description past 300.
10. **Pages past 1 and components past 15** — kept by the owner. The designer is told; the customer is not. Proposal P10 says so in the reply. The caps stay.

## Proposals for review (nothing implemented)

Each proposal keeps the limit's operational purpose. The rule is that a
requirement past a limit is **either carried or said**, never lost quietly.
The wording stays model-written from the facts.

| # | Limit | Proposal | Kind |
|---|---|---|---|
| P1 | `pageImages` cap 2 | Never cap entries that carry `attached` (the customer's own files, at most 3 by the attachment cap); count the rest past the cap into `overflow`, so `imageNote` reports "wanted N". The purchase bound stays `IMAGE_CAP` and the balance | stop a silent drop |
| P2 | band stubs | Carry `bandsStubbed: [{page, section}]` on the build's outcome facts, so the reply model can say which section did not get written | say it |
| P3 | `MAX_SECTIONS`, `MAX_SECTION`, `MAX_ACTION`, `MAX_PURPOSE`, `MAX_IMAGE_PROMPT` | Keep the numbers (output cost). Record what was cut (`designCuts: {field, kept, asked}`) in the outcome facts, and tell the model the action cap in `ACTION_FIELD` | say it |
| P4 | browser 2,000 first-build cut, 200 clarify cut | Refuse-and-tell, as a revise does at 16,000 (words back in the box), instead of cutting; or raise to the server's 5,000. The server keeps one bound | stop a silent cut |
| P5 | server brief 5,000; facts 2,500; linked page 4,000 | Keep (token cost); add `contextCuts` to the facts so the reply can say what was not read | say it |
| P6 | links past 2; link quota | Name the links not read, and a quota refusal, in `contextSentence` | say it |
| P7 | `behavior` never read | Either hand it to the writer or stop asking for it at build time — the owner's choice | decide |
| P8 | `MAX_TSX` on the band path | Apply it at design time with the others, and record a cut like P3 | consistency |
| P9 | `renderRepairDropped` | Carry it into the outcome facts | say it |
| P10 | `MAX_PAGES` 1, `MAX_COMPONENTS` 15 | **Kept.** Only record the cut in the facts, like P3, so a customer who asked for five pages hears that one was built | say it (cap unchanged) |
| P11 | tables 24 / columns 48 on a revise | Record the cut like P3 | say it |

Not proposed for change: every timeout, deadline, retry count, provider size
bound, the request-body cap, the SSRF and fetch bounds, the link quota's
number, the spending floors and fees, the upload library's allowance, and the
attachment bounds (all already told).
