# What the addon path can do — the nine kinds, measured

**Every list and number here is DERIVED by driving the modules, not read off a
description.** Re-derive before trusting it: the lists below have gone stale
twice in this repository's history, and a capability review that quotes a
document is a second copy of the thing it describes.

    node -e 'import("./builder/site-add.mjs").then(m => console.log(m.ADD_KINDS))'

**Two evidence sets, kept apart, because they answer different questions:**

- **Local pipeline evidence** — the route driven with stubbed seams, a fixture
  supplying the model's answer. It proves the WIRING: that a declared thing
  survives cleaning, reaches storage, reaches the later designers, produces an
  artifact, and is reported honestly. It never proves a real model would
  produce that answer.
- **Live evidence** — runs 47–51 on `repairbench-1` and `fold-lane-bakery`,
  each a real paid request with a real model.

**And the frontend corpus validates nothing about the backend.** Measured: the
100-site corpus (324 `.tsx` files) contains **zero** `useRows`, `useCreateRow`,
`useApi`, `useRpc` and `useUploadFile` — it is a frontend corpus, because a
first build is frontend-only by default and most sites never get a database.
So every false-alarm rate this repository leans on (the kit closure's 9–53
files, the 322-against-222 lint reading, the 320 picture frames) is a statement
about the FRONTEND, and nothing equivalent exists for the four backend kinds.

---

## The partition

`ADD_KINDS` is **nine** and every one of them acts here — `DISPATCHED_ADDS` is
**empty**, so nothing is handed to another rung any more:

| group | members |
|---|---|
| `OWN_ADDS` | `table` · `function` · `api` · `job` · `page` · `component` · `qr` · `three` |
| `PLACING_ADDS` | `photo` — carries a tool AND names a layer, so it designs a shot list beside a page and hops to the `picture` rung when it is the only thing asked for |
| `DISPATCHED_ADDS` | *(empty)* |

`BACKEND_ADDS` is `table · function · api · job` — the four that touch the
database, and **the first of any of them PROVISIONS it** on a site that has
none. `LIST_ADDS` (the seven that answer a list) is `table · function · api ·
job · page · component · photo`; `qr` and `three` answer one thing each.

`MAX_ADDS` is **9**, so one message may name every kind it asks for, and
`ADD_KINDS` order IS run order — a table before the function that reads it,
both before the job that runs it, all before the page that shows them.

---

## The nine kinds

| kind | cap | the tool's item | required | what it really makes |
|---|---|---|---|---|
| `table` | 6 | `table · seed · shows · because` | `table` | DDL through the schema engine, RLS, grants, seed rows |
| `function` | 6 | `name · args · returns · body · language · internal` | `name · returns · body` | a Postgres function, `SECURITY DEFINER`, pinned `search_path` |
| `api` | 4 | `name · url · method · headers · body · params · returns · credential · cacheSeconds` | `name · url` | a stored outbound connection served at `/api/db/<slug>/api/<name>` |
| `job` | 4 | `name · fn · everyMinutes · at · on` | `name · fn · everyMinutes` | a row in `site_functions` the cron tick selects |
| `page` | 6 | `path · name · purpose · sections · components · tsx · link` | `path · name · purpose · sections · components` | a route, in `sitemap.xml`, linked from the nav |
| `component` | 12 | `page · where · does · components · tsx` | `page · does` | a band on a page — a kit part by name, or a part written for this site |
| `qr` | 6 per site | `name · points · label · page · where` | `name · points · label` | `/qr-<name>.svg`, drawn by us from the stored string |
| `three` | 1 per site | `scene · page` | `scene` | a WebGL element |
| `photo` | 6 | `page · describe` | `page · describe` | a photograph bought from the provider and placed in the same request |

**Three of those rows are corrections to what this repository used to say.**
`function` carries `language` (it was dropped by the cleaner and reported as
`unexpressed`; it is carried now), `api` carries `returns`, `credential`
and typed `params` (a page could not be written against a connection at all
before, because nothing described the answer's shape), and **`job` carries
`on`** — the single date a job runs and then never again.

### A job that runs once

Until 2026-09-19 `JOB_ITEM` had no run-once field, so *"remind me on the 3rd"*
became a reminder that fires for ever. A missing FIELD rather than a missing
capability, and its failure mode was silent AND repeating — the worst pair
available, because nobody notices the first wrong send and every send after it
is another one.

**`spec.on` is the whole representation and its PRESENCE is the marker**, so
there is one place to ask and no second flag to disagree with. Four properties
hold it together, each because of a way it could otherwise go wrong:

- **`on` requires `at`, and the pair is refused whole without it.** A one-time
  reminder has no second occurrence to be right at, so "midnight, presumably"
  is a guess made once and then made for ever.
- **An unreadable `on` refuses the job rather than falling back to the
  interval.** This is the one place the engine departs from its tolerant habit,
  and the departure is the point: dropping `on` leaves a perfectly valid
  RECURRING job, so the tolerant reading is not the feature degrading, it is
  the feature inverted.
- **`everyMinutes` is forced to the monthly ceiling** — never read for
  selection, so it only matters if `spec.on` is ever lost, and at the ceiling
  such a job degrades to *at most monthly* rather than to whatever the model
  happened to ask for.
- **The claim condition survives "Run now".** The owner pressing the button
  decides a job is due NOW; it cannot decide a one-time job is due TWICE, so
  the press consumes the occurrence and the scheduled tick afterwards skips.

**`last_run` is the consumption record**, and it is the only one available:
`persistSiteJobs` rewrites `spec` on every publish, so a `done` flag written
there by the runner would be destroyed by the next unrelated change to the site
and the job would run again weeks later.

**An attempt consumes the occurrence**, because `runJob` stamps before it sends
— so a one-time job whose send fails is not retried. Deliberate: a retry after
a provider timeout is how one reminder becomes two, and nobody can tell a
timeout from a slow success.

**`MISSED_GRACE_MS` is 24 hours**, and past it the occurrence is gone rather
than late. The owner's panel reads `onState` — `scheduled · done · missed ·
unreadable`, and null for a recurring job — because "never run" is three facts
and only two of them need anything doing, in opposite directions.

---

## Who can report on what

Three lists decide what a customer is told about a requirement, and all three
are now **nine-kind complete** where they can be:

| list | members | what it decides |
|---|---|---|
| `REQUIREMENT_ADDS` | all nine | which steps may RAISE a requirement or ECHO one handed to them |
| `APPLIED_KINDS` | eight — everything but `component` | which kinds `appliedFacts` can speak for, so *this change made it* is answerable |
| `SITE_KINDS` | eight — everything but `component` | which kinds the site's own inventory enumerates, so *absent* is answerable |
| `OPAQUE_KINDS` | `component` alone | a band folded into an existing page leaves no item in any list, so a working section and an absent one look identical — absence is NEVER claimed |

`component` is the one kind off both `APPLIED_KINDS` and `SITE_KINDS`, and it
is off them for the same measured reason rather than by omission.

**`checked` is empty for every kind**, deliberately: nothing on this path
exercises a behaviour, so `configured` is as far as a claim about a real
setting can get. The guard drives every applied kind and asserts it.

---

## Known unsupported, each with its honest reason

- **A visitor cannot attach a document.** `isImageColumn` answers NO to
  `attachment`, `file`, `upload`, `receipt`, `document`, `screenshot` and
  `artwork`, so a designer that ignores the naming guidance produces a form
  with no attach control. Widening the list widens an endpoint that is
  unauthenticated by design — **the owner's call, recorded in the code.**
- **Video and audio EMBED; they do not HOST.** `video-embed`, `video-player`,
  `video-hero`, `audio-player` and `audio-recorder` are all in the kit and all
  make zero network calls, so a `component` ask places one around a URL the
  owner supplies. There is nothing to supply it FROM: neither sniffer admits a
  video or audio container (`UPLOAD_EXTS` is png · jpg · webp · gif · pdf ·
  the zip members).
- **Nothing on this path deletes.** `NOT_REMOVABLE` names `backend` · `lang` ·
  `slug` · `kind` · `purpose`, so a table, a saved function, a connection or a
  scheduled job cannot be taken away in chat at all.
- **A job cannot repeat on a weekday pattern.** `everyMinutes` plus an optional
  `at` plus the new `on` covers *every N minutes*, *daily or slower at a clock
  time*, and *once* — and nothing expresses "every weekday" or "the first of
  the month". A missing field again rather than a missing capability, and this
  time a bigger one: it needs a recurrence rule and the arithmetic to go with
  it, where `on` needed a date.
- **An api's `params` still carries no page-side requirement check beyond the
  declaration** — a required blank is refused before the upstream call, which
  is the wall that matters, but nothing tells the PAGE which parameter it must
  supply beyond the printed signature.

---

## Cost, from the runs that were really bought

| shape | credits | run |
|---|---|---|
| pageless (job + internal function) | **3** | 50 |
| `function` + `page` | **12** | 49 |
| `table` + `function` + `page` | **13** | 47 |
| `page` + `qr` + a refused photograph | **13** | 51 |

A photograph is `IMAGE_USD / CREDIT_USD` ≈ **18.75 credits**, which is most of
any bill that includes one — and run 51 is the proof that a refused one costs
nothing, because the billing is on `made` and never on `planned`.

---

## Four complete requests, driven end to end

`test/addon-route.test.mjs` carries four whole customer sentences through
`POST /api/site/<slug>/addon`. Every other case in that file isolates ONE hop;
these four exist because their value crosses a boundary no single-kind case can
see, and each asserts the designer's real request, the compiler payload, the
stored source and the customer's own reply.

| # | the sentence | the crossing it proves |
|---|---|---|
| 1 | *"add a page at /how-busy showing how many bookings we have, and a function the page calls to count them"* | an EXISTING table's name **and columns** reach the function designer; that function then reaches the page designer running after it |
| 2 | *"every night at 11 run the hold sweep"* | an EXISTING internal function reaches the job designer, and the job survives `normalizeSchema`, which drops a job whose function is not declared in the same spec |
| 3 | *"show the live tide times on the home page, from tides.example"* | a connection's DECLARED RESPONSE SHAPE and its required parameter reach the page WRITER — the whole of what made that tier unwritable |
| 4 | *"add a /tour page with the workshop video on it, and a QR code that opens it"* | a page, a component ON it and a QR code AT it in one message, all resolving against `site.planned` |

**What they prove and what they do not.** Every seam is its real producer's
shape, so these prove the WIRING. They never prove a real model would answer
this way; that is what the live runs are for.

**Three things the first draft got wrong, each worth keeping:**

- **Case 3 asked for a `page` kind aimed at `/`.** A connection is never
  pageless — it exists to be READ by a page, so the route writes one whether or
  not the customer asked for a route — and adding a `page` kind for a route the
  site already has is refused `no-path`, correctly. The first draft read that
  refusal as the tier being broken.
- **Case 3's writer returned a different home page.** `keptProse` refuses a
  change that loses a word the page already said, which is the wall that makes
  *an addition only ADDS* real. Taking the fixture's default answer is a
  `rewrote` refusal before anything about connections is reached.
- **Case 1 read `c.name` off every stored column** and got
  `[undefined, undefined, undefined]` — which is how the column-union defect
  below was found.

---

## …and one defect they found, in the schema engine

Driving request 1 for the first time showed the stored spec coming back with
**six columns for a three-column table** —
`["who","slot","phone",{name:"who"},{name:"slot"},{name:"phone"}]`, each once as
a bare name and once as an object. Nothing failed and nothing was logged; the
stored spec is what every later designer reads.

**Pre-existing, and confirmed so** by running the same request against the
branch's merge base. The cause is one expression in `applySiteSchema`'s late
merge: it deduped on `String(c)`, which is `"[object object]"` for every object
column.

**Which shape sits on which side decides which failures are reachable:**

- **This run's** column list is ALWAYS bare names — `norm.push({…, columns:
  colNames, …})` flattens, whatever the tool declared.
- **The stored** list is whatever last wrote `_meta.schema` — names when the
  engine wrote it, OBJECTS when `mergeAddonSchema`, the schema recovery or an
  older apply did. Both shapes are permanent here by design.

Measured on the pre-fix expression, one re-declared column against three
stored, where the right answer is 3:

| this run ∪ stored | got |
|---|---|
| names ∪ names | **3** — correct, and why it went unnoticed |
| names ∪ objects | **4** — the live defect, every stored column re-added |
| objects ∪ objects | **1** — the union DEAD; unreachable through this function |
| objects ∪ names | **4** |

The name is read the way every other reader in the codebase reads it, and the
`have` set grows as it goes so a stored list already carrying a duplicate — and
those exist, because the old code is what wrote them — is not doubled again on
every apply. `test/schema-column-union.test.mjs` drives all of it against the
real engine with a stub that ANSWERS the `_meta` read, which no existing
`applySiteSchema` driver did.
