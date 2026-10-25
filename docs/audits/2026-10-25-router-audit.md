# Router audit (2026-10-25)

This audit was read-only, at `origin/main` `a63451c3a`. No product code was changed, no model was called and nothing live was written. The evidence comes from Supabase `edit_jobs`, non-secret columns only: `op='route'` rows for `driftwood-and-daughters-3/-4/-5` between 2026-10-24 19:20 and 2026-10-25 04:45 UTC. Line numbers refer to `a63451c3a`.

## 1. What the router is

### What it is given

- **Page paths.** These are read from the site's own source when the owner is verified (`worker.js:10465`, `routeDigest`). Otherwise the browser's list is used.
- **Table names only.** They are read for the owner (`worker.js:10461`) and cut at 24 (`builder/site-ask.mjs:1358`). They are shown as one sentence: "Its database tables are: …" (`site-ask.mjs:1330`).
- **What it is not given:**
  - the columns of any table;
  - which table a page reads;
  - the components or sections on a page;
  - the frame's contents (menu items, footer details);
  - which features already exist (for example, that `lesson_bookings` already backs bookings on `/lessons`).

  The richer read exists already, but it is used only for conversation replies (`readConverseContext`, `worker.js:10493-10530`: each table's columns and access, and the words on each page).
- **Other inputs:** the site's name, its URL and the draft-first fact (`site-ask.mjs:1315-1338`); the "which case" block (`:1480`); the question block (`liveBlock`, `:1434-1466`); a kept chat window; and, for a part, the whole original message and the parts already done (`partBlock`, `:3060`; `worker.js:34800`).

### How big the prompt is

I measured it with `askRequest` (`site-ask.mjs:1467`) for a five-page, two-table site:

| Piece | Characters | Notes |
|---|---|---|
| System text | 7,121 | `SYSTEM`, `:1362-1417` |
| Tool schema | 38,332 | `LIVE_ASK_TOOL`, `:1221` |
| Message | about 800 | |
| **Total** | **about 46,000** | **about 11,600 tokens** |

The live rows agree: each part's uncached input is 11,959–12,013 tokens.

The single largest field description is `layer`, at 15,222 characters (`:395-716`). Next come `intent` at 6,661 (`:243-350`), `alsoAsked` at 2,130, `targets` at 1,757 and `resolved` at 1,540. About 90% of every call is rules, not facts.

### Rules that contradict or overlap

The rules grew one at a time, and many say the same thing in several places:

1. **The edit/addon line is stated five times:**
   - `intent`'s addon clause (`:280-284`);
   - the frame/words/photo clause (`:291-297`);
   - the new-list-entry clause (`:313-316`);
   - "THE QUESTION THAT SEPARATES" (`:329-341`);
   - the system's cost rule (`:1408-1413`).

   It is said again inside `layer`, under `data` (`:409`), `text` (`:470`), `picture` (`:550`), `nav` (`:610`), `page` (`:640`) and `rules` (`:534`). The comments say this is deliberate ("said four times … a model reading downwards meets whichever one", `:300-312`).
2. **There are two tie-breaks.** "When you cannot tell, answer addon" (`:347`) is rewritten into "ask them" when questions are allowed (`:925`). The system text still says "pick the cheapest one that can honestly do the job" (`:1406`), which pulls the other way.
3. **Three layers claim removals.** `look` claims every removal (`:512`), with two exceptions (`:520-523`). Meanwhile `picture` (`:546`), `nav` (`:560`, "take Pricing out") and `remove` (`:770-790`) each claim their own removals. A photo removal therefore has two valid answers: `look`, or `picture` with `remove`.
4. **The multi-change rule appears three times, with different wording.** Under `alsoAsked` (`:374-395`), under `look` (`:527-529`) and as the closing paragraph of `layer` (`:711-716`). `page` (`:658`) points back to "the last paragraph".
5. **Footer and menu are split three ways:**
   - `nav` owns the frame (`:560-618`);
   - "a new … footer link … is addon" (`:291`, `:610`);
   - `look` owns "the menu and the button" for mixed messages (`:381`).

   A footer change that also adds something new has three valid answers.
6. **The `targets` vocabulary has no word for "a row in a table" versus "a working feature on a table".** `data:table` means "a table's rows or columns" (`:1119`). This matters in section 2b.
7. **Questions are offered on parts.** `canAsk: rLive` (`worker.js:34795`) is true for a part's routing job too. The only thing telling the model not to ask is a later patch (section 4).

## 2. What caused each live misbehaviour

### a) `addon` for pages and tables that already exist

Rows: last run on `-5`, request `d16e21e6…`, parts p1–p4 and p10. Each one has `intent: addon` and writes existing `page:/board-shop`, `page:/cafe`, `page:/hire`, `page:/events` or `data:events`.

The causes:

- The rules say "does the thing they name exist?" (`:329`), but the router only sees names. It cannot tell whether "a shop with reservations" already exists on `/board-shop`, because it knows neither the page's components nor that `shop_items` is already displayed.
- When it cannot tell, the tie-break sends it to `addon` (`:347`, or `:925` when questions are closed, which they effectively are for parts).
- The `targets` rule itself asks the model to name `new-component:` beside an existing page for "a working feature" (`:1123-1126`). Every p1–p4 answer did exactly that (`new-component:boardshop`, `cafemenu`, `hireform`, `eventsignupform`). In other words, the schema invites the model to call existing things new.

`routeOnExisting` then re-reads the answer after the fact (`builder/addon-existing.mjs:120-136`) and turns it into `feature-on-page`. This is not a correction; the same add-on runs either way.

### b) "Make Lessons bookable online…" became a single `row` insert

Route job `e2486dd6` (part p9) answered `intent: addon` with `targets: [{writes: ["data:lessons"], reads: ["page:/lessons"]}]`. It wrote no `new-component`, no `new-data` and no rules. Add-on job `dc143ad0` (p9-2, 04:31) then wrote rows 9 and 10 into `lessons` (`kinds: ["row"]`).

The causes:

- **The prompt's strongest list rule matched this message.** "A new product, service, dish, **class**, event … is a new row … addon" (`:313-316`), and the row path is the add-on step's cheapest pick.
- **Nothing in the inputs says what "bookable" needs.** The router sees `lessons` and `lesson_bookings` only as names, with no columns and no link between them. It cannot see whether a booking form exists, so it could not name `new-component:` or `function:`.
- **The vocabulary cannot say "this table must start accepting bookings".** `rules` is a layer, not a target (`:1111-1138`).
- **The rewrite missed it.** `addonOnExisting` returns `null` when nothing written is a page (`addon-existing.mjs:104-107`), so the lone `data:lessons` answer went to the add-on step untouched. `rowUnmet` (`addon-existing.mjs:163-182`, `worker.js:44103`) only tells the customer afterwards.

### c) Clarify questions on parts of a request already charged

Route job `36840e7c` (p5) shows `decision.raw.intent = "clarify"`, rewritten to `addon` with `clarify-part`.

The causes:

- **The router is told a question may be asked.** `canAsk: rLive` (`worker.js:34795`) does not look at `rPart`, so the "A QUESTION MAY BE ASKED" block is sent (`site-ask.mjs:1458`), along with the live tie-break "ASK THEM" (`:925`).
- **The part's own words are a fragment.** The model is shown the whole original only as context (`partBlock`), so a fragment reads as underspecified.

The fix is an input (`canAsk: false` for a part), not a patch.

### d) A footer or menu change sent to `addon`

Route job `855b8da7` (p6) wrote `footer, menu, new-component…` and read all 11 pages, with `intent: addon`.

The causes:

- Rules 1 and 5 above: any "new" link or detail in the frame is defined as `addon` (`:291-297`, `:610-613`).
- The router is not shown the menu's or footer's current items, so it cannot tell a change from an addition.
- Once the model writes `new-component`, even a frame tweak becomes an add-on.

I could not see the part's own words in the job rows (they are stored in the request record in R2), so I cannot say whether the footer change was purely an edit. The structural cause stands either way.

### e) Cost

The last run (`d16e21e6`) has ten part routing jobs: p1 4, p2 3, p3 5, p4 2, p5 2, p6 5, p7 4, p8 0, p9 0, p10 0, for **25 credits**. The 0-cost jobs are carved or split parts (`worker.js:35130`). The routing call of the first message is billed separately.

The usage per row shows two problems:

- **The cache is hit by luck.** Calls alternate between 11,959–12,013 uncached tokens (cacheRead 1,152) and about 700 uncached (cacheRead 12,416). The router's request carries no cache key: `askRequest` returns no `prompt_cache_key` (`site-ask.mjs:1524-1553`), while `build-call.mjs:769-779` shows how xAI's `x-grok-conv-id` is sent for other calls.
- **Output is large.** It runs 700–2,185 tokens per call, mostly long `targets` lists (p6 lists all 11 pages as reads) and the `decision` text.

The cost by cache:

| Calls | Credits each |
|---|---|
| Uncached (p1, p3, p6, p7) | 4–5 |
| Cached (p2, p4, p5) | 2–3 |

## 3. Re-routing

### Why every part is routed again

`planParts` gives only part 0 a route (`builder/request.mjs:436`). Every held part is created with `route: null`, `phase: "route"` (`:365-369`, `:455`). The scheduler then files a `ROUTE_OP` job for it (`:1880-1882`).

The design reason is in the file header: "routed when its turn comes, against the site as it is then" (`request.mjs:29-31`). That matters only when a part depends on something an earlier part creates.

### Could the first call describe every part?

Mostly yes. It already numbers every part and gives each one `targets` and `dependsOn` (`site-ask.mjs:1079-1138`; read at `request.mjs:463-477`). What it does not give per part is the intent, layer, page or remove. Adding a small per-part array (`{change, intent, layer, page, remove}`) to the schema would let `planParts` set `route` for every part that has no `dependsOn` on a creating part. Only the dependent parts would still need a later route.

### Estimated saving

| | Credits |
|---|---|
| The 10 part routes in the last run, now | 25 |
| One larger first call (about 1,000–1,500 more output tokens) | +1–2 |
| Re-routes still needed for parts that depend on a created part (none had `dependsOn` in these rows; allow 1–2) | +2–5 |
| **Net saving in that run** | **about 18–22 of 25** |
| A per-site cache key on every routing call, on its own (the uncached half drops from 4–5 to 2–3) | about 1–2 per uncached call, roughly 6–8 in that run |

The cache-key saving applies even if nothing else changes.

## 4. The patches applied after the router answers

| Patch | Where | Exists because | Removable if the router is fixed? |
|---|---|---|---|
| `routeOnExisting` → `edit` (`existing`) | `addon-existing.mjs:120-131`, `worker.js:34841` | The router answers `addon` for things it cannot see exist (inputs), plus the addon tie-break (rules) | Yes, once pages' sections, tables' columns and frame items are shown and the tie-break is reconciled. Keep it as a logged guard for a while. |
| `routeOnExisting` → `feature-on-page` hand-over | `:133`; consumed at `worker.js:44046` | `targets` gives no structured "feature on page X" | Yes, if the schema says the page and the feature directly (plan step 5). |
| `page-asked` hand-over | `:134`; `worker.js:44057` | The same | Yes, the same way. |
| `partClarifyChoice` | `addon-existing.mjs:146-159`, `worker.js:34838` | Bad input: `canAsk` is true for parts | Yes, with `canAsk: !rPart && …`. Keep the resume case (`rWaiting.requestKey`) or fold it into the same input. |
| `rowUnmet` (told and carried) | `addon-existing.mjs:163-182`, `worker.js:44103` | The router names a lone `data:` target for a feature (vocabulary and inputs) | Partly. Keep it as a safety net (the add-on's own requirements check is good design), but it should stop firing. |
| `routeInScope` re-ask | `worker.js:34805-34818` | Scoped digests | No, it is unrelated to router quality. |
| `held-unread` / `heldItems` by number | `site-ask.mjs:992-1010` | The model rewords copied text | No, it is a sound design. |
| Decision codes such as `resolved-ignored` and `also-several` | `site-ask.mjs:1584` | Reporting only | No, keep them. |

## 5. A plan, smallest change first

None of these steps reads keywords. Each one changes the facts the router sees, merges rules, or adds structure.

| # | Change | Expected effect | Risk |
|---|---|---|---|
| 1 | **Add a per-site cache key** (`prompt_cache_key: "route-" + slug` in `askRequest`, sent as `x-grok-conv-id`, as `build-call.mjs:769` does) | Every part route hits the 12k cached prefix: about 30–45% less routing spend | Nil; behaviour unchanged |
| 2 | **No questions on parts**: `canAsk: rLive && !rPart` (`worker.js:34795`) | Removes the source of the clarify-part cases (c); `partClarifyChoice` becomes dead for parts | Low |
| 3 | **Give it facts.** Reuse `readConverseContext`'s reads (`worker.js:10493`) for a compact inventory: each table with its columns; each page with its section or component names and the tables it reads; the menu and footer items. Bound it to about 1–2k tokens. | Fixes (a), (b) and (d) at the cause: the router can see `/lessons` already shows `lessons`, that `lesson_bookings` exists, and what the footer holds | Medium: more input tokens (cached after step 1); a slow read must fail open |
| 4 | **Trim and merge rules.** One edit/addon paragraph instead of 5–11 copies; one removal rule (layer by holder, `look` only for unknown holders); one multi-change rule; delete the addon tie-break in favour of "use the inventory". Aim to roughly halve the `layer` and `intent` text (21.9k → about 10k characters). | Fewer contradictory pulls; about 3–4k fewer input tokens per call | Medium: each rule exists because of a past run. Replay those runs' supplied answers (the existing router tests: `test/router-*.test.mjs`, `edit-op-scope`, `edit-removal-door`). |
| 5 | **Route every part in one call, with structured targets.** Add per-change `{change, intent, layer, page, remove, feature?: {page, kind: form/booking/section, table?}}`. `planParts` sets `route` for every part without a creating dependency; only dependent parts are re-routed. | About 18–22 of 25 credits saved in a run like the last one; `feature-on-page` and `page-asked` hand-overs come straight from the model, so `routeOnExisting` can go | Higher: a schema change touching `planParts`, `prepare` and the scheduler |
| 6 | **Remove the patches** after 3–5 are live and their decision codes stop appearing in route rows for a week | Simpler code | Low once the codes have stayed absent |

### How to test each step

| # | Offline, with supplied answers | One cheap live check |
|---|---|---|
| 1 | A unit test that `askRequest` carries the key and the transport turns it into the header | One free-balance canary press; read `cacheRead` on two consecutive part routes |
| 2 | A red test that a part's request has no "A QUESTION MAY BE ASKED" block, plus a supplied `clarify` answer through the part route | — |
| 3 | Snapshot the inventory text from fixture sites; supplied router answers for "make X bookable" on a site with and without a bookings table | One routing-only press of the Lessons message on `driftwood-and-daughters-5` (about 2–4 credits, with `expect_route` set to an addon whose targets include a non-row creation) |
| 4 | Run the full router suite; red-check that every guarded behaviour still has a sentence that carries it (assert properties, not spelling) | — |
| 5 | Supplied multi-part answers through `planParts`: parts with routes skip `ROUTE_OP`; a dependent part is still routed; the scheduler's ordering is unchanged | One multi-part message, comparing the number of `op='route'` rows and their credits with the last run (10 rows, 25 credits) |

## Limits of this audit

- The part words and the first message live in R2 request records, which I did not read. I inferred (d)'s exact wording from the targets only.
- Credit-per-token figures are inferred from the job rows, not from the price table.
