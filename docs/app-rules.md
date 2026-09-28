# The builder app and the agent builder: rules from shipped fixes

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). The agent builder's
> half that lives in this app, and the browser app's rules (the start box, the
> preview panel, the SEO tab, model context and limits, the page list, Publish
> and Refresh, the toolbar, the customer's screen as the browser composes it).
> `agent-builder/CLAUDE.md` is the agent product's own record. The short
> summary CLAUDE.md kept moved here in the second pass (`git show
> 28bdc97f:CLAUDE.md`) and is the first section below.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## The builder app and the agent builder, in brief

The full rules are `docs/app-rules.md`, with the model table (each model's
context window, output limit and price); `agent-builder/CLAUDE.md` is the agent
product's own record.

- **The agent builder is a third view (`agents`) in this app.** Its tenant is
  `authUser(request).id` and nothing else; row-level security is the belt and
  the URL's `tenant_id` filter is the wall (`service_role` bypasses RLS); a
  forged agent reply is a row the database refuses (`role = 'user'`); the import
  is one transaction keyed by the browser's own record id; old browser records
  are claimed or sealed by one marker (`zephyr_owner_v1`), never shown to
  another account.
- **In the builder app**: typing in the start box is a fresh build, never a
  revise; a failed build reverses its design charge (by ref, never an amount);
  the preview panel runs the site's own JavaScript, sandboxed per URL
  (`frameSandbox`); a project has an address (`/projects/<id>`); a published
  site's runtime errors reach the panel over `isibi:runtime-error`, a wire
  string on the do-not-rename table; the SEO tab shows and saves the real head
  (the description is patched in the sidecar, which is the deployment; the
  title is read-only); every small call follows the builder picker
  (`BUILD_MODELS.quick`); the page list is read from the server
  (`GET /api/site/routes`). Context is not a limit anywhere today (the biggest
  call is ~20,000 tokens); the wall a build meets is the wire.

---

## Rules from recent fixes

Each of these is shipped and live. What is kept is the RULE and the NUMBERS.

### The agent builder

**THERE IS A THIRD VIEW: `agents`** (owner: *"under the A for the profile thing,
put agent builder"*), a view in THIS app rather than a page on the agent
Worker's own domain — which would have meant a second sign-in to reach a menu
item. **`agent-builder/` IS A SEPARATE PRODUCT WITH ITS OWN CLAUDE.md**, and the
full account of the engine, the step registry, the workflow executor, the
scheduler and the DST arithmetic is there. What belongs here is the site's half:

- **THE AGENTS ARE ON THE ACCOUNT**, in the `agent` schema — `agent.agents` and
  `agent.agent_messages`, **separate from `agent.runs` and `agent.run_entries`
  by construction**, with no foreign key between the halves: one is mutable prose
  somebody wrote and edits, the other an append-only fenced journal of work that
  ran. `agent-store.mjs` (root, dependency-free, on the Dockerfile's COPY line)
  owns all of it.
- **RLS IS THE BELT AND THE URL FILTER IS THE WALL, and only saying so keeps
  them apart.** Policies key on `agent.tenant_id()`, which protects the
  `authenticated` role and protects nothing on this path: `service_role` carries
  BYPASSRLS, so the only thing between one customer and another's written
  instructions is `tenant_id=eq.` in the query. **A suite that only ever signs in
  as one account cannot see that**, so most guards read the REQUEST THAT WENT
  OUT. Its consequence is the shape of `update`, `remove` and `ownsAgent`: the
  tenant is in the FILTER, so "somebody else's id" and "an id that does not
  exist" are one answer and one 404.
- **THE TENANT IS `authUser(request).id` AND NOTHING ELSE.** No route reads an
  account off the body or the query string, asserted as a census. **The block is
  gated ONCE, above all the routes**, which is stricter than N gates — a new
  route cannot be added ungated because there is nowhere to add it that is not
  already behind it, and it is why adding seven automation routes needed no
  change to `worker.js` at all.
- **A REPLY IS IMPOSSIBLE RATHER THAN ABSENT.** `check (role = 'user')` on the
  column, and no `role` is ever sent — a forged agent reply is *a row the
  database refuses* rather than a bug for this code to prevent. The answer is
  read from the RUN and never copied into a message row.
- **`security_invoker = true` IS THE WHOLE SAFETY ARGUMENT** on
  `agent.agent_overview` — without it the view runs as its OWNER and is a hole
  through the RLS on both base tables. PostgREST could embed a child relation
  with its own order and limit; it is not used because **nothing here can run
  PostgREST**, so that query could only be asserted from documentation, while a
  view is plain SQL a real PostgreSQL can drive.
- **`agent.import_agent` IS ONE TRANSACTION BECAUSE THE IMPORT CAN BE PRESSED
  TWICE**, and **ATOMIC IS NOT IDEMPOTENT**: the first version closed the
  half-imported agent and left the one beside it open, so the obvious second
  press made a second agent. The identity is the browser's own record id,
  **scoped by tenant and enforced by a partial unique index**; the message loop
  is skipped on the conflict path, because answering the right id while
  re-running it doubles the conversation. **The four-argument signature is
  DROPPED, not left as an overload** — Postgres would keep both.
- **NOTHING DELETES WHAT SOMEBODY TYPED INTO A BROWSER**, and **whose the legacy
  records are is decided by ONE marker**. `zephyr_owner_v1` is the only thing in
  a browser that says which account was last in it, so both doors read it and
  neither reads who is present: `enterApp` claims for `prevOwner` or SEALS, ABOVE
  the `setItem` that moves the marker; `doSignOut` claims BEFORE the wipe and
  takes the MARKER rather than `Auth.userId()` (**the two can disagree and that
  case is driven**). **The marker never moves ahead of the ownership record** —
  `agentsStore` READS THE VALUE BACK rather than trusting `setItem`.
  **`agentOwns(a, uid)` is the one predicate** — `!!uid && !!a && a.uid === uid`,
  no pass for an unstamped record — and **`AGENT_OWNER_UNKNOWN` (`'?unknown'`)
  is a VALUE, not an absence**, so a sealed record can never be laundered one
  sign-in later. **The cost, stated: a browser whose last sign-out ran the old
  code has records preserved and PERMANENTLY HIDDEN, from everyone.** That is
  the requirement met rather than a regression.
- **THE IMPORT ASKS THE SAME PREDICATE AT THE POINT IT WOULD SEND**, reading the
  STORE rather than the offer — the list asks "what may I show", this asks "may
  I send THIS", and they are different questions with different consequences.
  **Silent, deliberately**: naming the skips would tell the person that another
  account has records in this browser.
- **A FAILED READ IS NOT AN EMPTY ACCOUNT AND A FAILED SAVE KEEPS THE WORDS.**
  `null` for "not asked yet" against `[]` for "this account has none" is what
  makes loading, empty and failed three screens.
- **A DELAYED ANSWER MUST LAND IN THE CONVERSATION THAT ASKED.** `agentBind()`
  is taken before the request and `agentSame`/`agentSameEdit` asked after it,
  comparing **both the conversation and the ACCOUNT**; nothing that fails may
  write. Drafts are keyed by agent, and **the key is bound with the request** —
  computing it from `agentUid()` when the answer arrives means a session that
  expired mid-send deletes a key belonging to nobody. `undefined` (never falsy)
  means "whoever is here now", because a signed-out `''` is a real answer.
- **THE POLL DESTROYED WHAT WAS BEING TYPED.** `renderAgents` writes `innerHTML`
  every `AGENT_POLL_MS` (2,500), so a sentence typed while waiting was destroyed
  **EIGHT TIMES A MINUTE** with the caret and focus. It is a WRAPPER now
  (`agentComposerRead` → `renderAgentsNow` → `agentComposerRestore`), so no
  caller has to remember, and **the box's own `data-agent` attribute decides
  whose words they are** — restoring into a conversation somebody has since
  opened would move their caret, a worse bug than the one being fixed. The input
  hook deliberately DRAWS NOTHING.
- **A RETRY KEY MUST BE BOUND TO ITS PAYLOAD.** Held per conversation, a send
  that committed with its response lost, then EDITED and pressed again, carried
  the first message's key: the server absorbed it, answered the original body,
  the browser read `ok` and cleared the box. `agentSendKeys` stores
  `{key, body}`. *Retry safety was never about the conversation; it was always
  about the payload.* **The key is minted per PRESS, not per request**, and
  cleared **only on success**.
- **A GENERATION NUMBER ON THE DRAWING.** A read-first door is correct until
  something writes a value the DOM has never seen: a structural change to the
  automation form wrote the new list and the read-back immediately overwrote it
  with the stale DOM. `data-gen`, and **`|| '0'` on `getAttribute` read "no
  attribute" as generation zero** — the one value a fresh draft always holds.
- **`undefined !== null` IS TRUE**, so three optional lines gated on `!== null`
  drew the literal word `undefined`, the last of them in the red error slot.
  **No unit case could see it, because every fixture was the real producer's
  output** — which is the right way to build a fixture and exactly why the new
  guard's is deliberately not. `autoSaid` is the one test all three go through.
- **THE ENGINE IS RUNG AFTER THE COMMIT, AND THE RING IS A DOORBELL AND NEVER
  THE WORK.** A failed ring is logged and said (`notified: false`) and never
  raised — the work is durable either way, and answering an error would tell a
  customer their message failed when it is committed and will run. **An absorbed
  press is rung too**, and a duplicate ring is harmless BY CONSTRUCTION (that is
  `claim_run`'s property). **PRODUCER ONLY**: a consumer here would be a second
  executor of other people's runs.
- **THE CATALOG IS THE SERVER'S AND THE BROWSER ONLY DRAWS IT.** `AGENT_TOOLS`
  rides on `/api/agent/list`'s answer, is a COPY of the engine's `OFFERED` names
  **censused both ways**, and what lives here and not there is the WORDS: the
  engine's `description` is for a MODEL deciding whether to call a thing,
  `label`/`does` for a person deciding whether to allow it.
- **A SELECTION IS A POSITIVE INTERSECTION AND A REFUSED NAME IS NAMED.**
  `cleanTools` intersects, collapses duplicates and takes the CATALOG'S order, so
  two saves of one selection are byte-identical; `readTools` refuses an unknown
  name rather than storing less than was asked for. **The catalog is a
  PARAMETER**, because with one tool on the platform the order rule is
  undrivable and a sweep mutant taking the caller's order survived everything.
- **ABSENT AND EMPTY ARE TWO DIFFERENT THINGS ON A SAVE.** `/api/agent/update`
  is a PATCH: a tab opened before today saves a name and says nothing about the
  settings, and filling them from a default would un-pause an agent from a
  screen that never showed a pause control. **A status it cannot READ is a 400,
  never a default.** `"active"` assigned in JavaScript would be a second copy of
  the COLUMN's default in a second language — the copy that drifts is the one a
  migration cannot move.
- **`agentRow` FAILS CLOSED ON BOTH SETTINGS**: an unreadable status is `paused`
  (being wrong costs a press of Resume; the other way is an agent taking work its
  owner stopped) and an unreadable selection is empty.
- **WHICHEVER SIDE DECIDES A THING MUST NOT GO OUT BEFORE THE SIDE THAT ACTS ON
  IT.** The order for these three-part changes is **migration → engine → site**,
  and the middle one is the one nearly got wrong: this product's note said the
  two Workers were "order-free", which was true about PERMISSIONS and silent
  about HONESTY — the live engine handed every authored run `tools: []`, so
  shipping the settings form first would have put a tick on screen that saves,
  draws, and can never be honoured. **Engine first is a MEASURED no-op.**
- **ADDING A VIEW MEANS SATISFYING A PROPERTY, NOT A COUNT.** `KNOWN_VIEWS` was
  pinned to an exact list, bought by a survivor that added a door to a deleted
  screen — which froze the count and failed identically for every later
  legitimate view. It forbids the deleted media views BY NAME, forbids
  `home`/`landing` (aliases `showView` resolves, never views), and requires
  **every** known view to have a `render…` call.

### The rest

- **TYPING IN THE START BOX IS A FRESH BUILD, NEVER A REVISE.** Three
  conditions, each a refusal to guess: the DESIGNER chose the name, the chat is
  POSITIVELY known to own no site (`mine === null`, never truthiness — a blip
  must not buy a second paid site), and the name is held BY US. The trailing
  number is REPLACED, not stacked. Settled at the SLUG, above `env.JOB_SCOPE`.
- **A FAILED BUILD REVERSES ITS DESIGN CHARGE.** Both conditions: our fault AND
  no live site, since a salvaged build was delivered. The collector has no
  ledger, so it reverses BY REF (`REVERSE_WHOLE` is a CEILING, never an amount).
  `ok` is the only field separating "nothing to reverse" from "could not".
- **RULE 7 NAMES `SafeImage`'s MODULE.** It orders `<SafeImage>` on every
  picture and never said where it comes from — the one component the rules make
  MANDATORY is the one whose path may never arrive, and a missing module is the
  one class `vite` cannot bundle around. `repairImports` also rewrites a
  `@/components/…` path naming no file to the one kit module exporting what is
  imported — **2,385 of 2,412 exported names belong to exactly one module** —
  and refuses to guess three ways. **Zero false alarms over 3,736 real files.**
- **THE PREVIEW PANEL RUNS THE SITE'S OWN JAVASCRIPT.** `frameSandbox(url)`
  decides per URL and FAILS CLOSED: our own origin keeps the tight flags,
  because `allow-scripts allow-same-origin` on a frame same-origin with the app
  can reach in and take its own sandbox off. The start screen's thumbnails stay
  tight deliberately — 51 sites is 51 React bundles to paint 51 postage stamps.
- **A PROJECT HAS AN ADDRESS** — `gofarther.dev/projects/<id>`. Not the slug: a
  slug is renameable and does not exist until the build finishes, which is the
  eight-minute window where a stable address is worth most. `openProject(id,
  mode)` is the ONE way either screen opens; an id naming nothing corrects the
  address rather than lying.
- **A PUBLISHED SITE'S RUNTIME ERRORS REACH THE PREVIEW PANEL.** Every generated
  site posts `isibi:runtime-error` to `window.parent`; the panel only ever read
  `__siteErr`. The half that DID work covers the blob DRAFT preview only, so a
  published site framed at its own URL had no reporter — **the ordinary case**.
  The general shape: *two halves built to meet and not wired, where the working
  half covers the case anybody testing would look at.* **THE WIRE STRING STAYS
  `isibi:runtime-error`** — every site published before today bakes that literal
  into its frozen bundle. It is on the do-not-rename table with
  `isibi-marquee`, and **the brand scan's exemption is DERIVED from that
  table**.
- **THE PHOTOGRAPH PIPELINE OPERATES ON THE FILES THE MODEL WROTE, NOT ON
  `pages`.** **Five steps did that work and every one read `pages`** — so a
  band-split build's PARTS were never planned, bought, counted or SWEPT, and the
  token shipped into the bundle as a literal the page drew as alt text.
  **MEASURED live: 11 `SafeImage`s, 9 correct and 2 raw `<img>` carrying the
  token.** Cost one 30-credit build. `imageSources(pages, parts)` is the ONE
  reader, so a sixth step asks it and cannot forget; **it is for READING only**,
  because `applyImages` writes each file back into the list it came from — never
  over the union sliced apart by length. **`lintPages` is deliberately NOT
  widened**: measured over the 100-site corpus (324 files) a page presented at a
  part path produces **322 findings against 222**, the 100 extra all one rule.
  **Open.**
- **THE SEO & SOCIAL TAB SHOWS THE SITE'S REAL HEAD.** It was eleven lines of
  hardcoded markup stating **three false facts about the customer's own
  business** — a suffix no site has ever served, grey prose where a real
  description was stored, and "Generate · soon" for a card the container has
  composed for weeks. **A step past the dead-control finding**: a dead control
  does nothing; this one ANSWERED, wrongly. **THE SPLIT IS `site-runtime.ts`'s
  OWN**: `description` and `image` are PUBLISH-TIME and live in the R2 sidecar,
  so **patching that one key IS the deployment** — no container, no compile, no
  credits; `title` is BUILD-TIME, baked as `SITE_NAME`. **THE TITLE IS
  DELIBERATELY READ-ONLY**, because `SITE_NAME` paints the header, the share
  card and `og:site_name`. `MAX_HEAD_DESCRIPTION` **300, DERIVED** from the
  publish path's own slice; `GOOD_DESCRIPTION` 50–160 is **advisory only**;
  `cleanHeadDescription` REFUSES a non-string instead of coercing;
  `pickableImages`' two filters are both load-bearing (a stranger's upload must
  never become the business's preview; an og:image at a PDF renders NOTHING,
  silently). The POST **READS AND MERGES the look** — `withConfig` replaces a
  named field WHOLE, so a bare `{look: {description}}` strips the theme, brand,
  mark and every language. **AND THE APP'S OWN `img-src` REFUSED THE CARD** —
  this panel is the first thing to put a SITE's origin in front of the app's
  browser, and **a CSP refusal on an `<img>` is silent**. `https://*.<SITE_ZONE>`
  joins `img-src`, derived the way `frame-src` already derives the same
  wildcard — **so the app already runs those origins' SCRIPTS in a frame, and an
  image is strictly less capable**. `connect-src` is deliberately NOT widened.
  **A FALSE BELIEF ABOUT CSP NEARLY WENT INTO THE GUARD**: a real `*.host`
  source matches ANY subdomain depth. The matcher is deliberately ONE label,
  which is the SAFE direction — it can report a refusal a browser would allow
  and can never report an admission a browser would refuse.
- **HOW FULL THE MODEL'S CONTEXT WINDOW GETS** — More → Model context. **It
  answers what the NEXT call carries, not only what the last one did**, which is
  why it has anything to draw. **MEASURED: first build 64,115 chars of tool +
  1,962 system ≈ 22,070 tokens; a revise 93,637 + 1,962 ≈ 32,718** — **2.2% of
  Claude's window and 4.4% of Grok's**. **The design tool is 96.8% of that call
  and the customer's brief is 0.2%.** **The total is EXACT and the parts are
  ESTIMATED, and the report says which** — characters at this repo's own 3:1,
  SCALED to the provider's real input total. **All three input kinds count**:
  billing prices a cached read at a tenth, the window does not care. **AN
  UNKNOWN MODEL HAS NO PERCENTAGE** — never of a guessed denominator and never
  0%. **The bar is a fill gauge against the window**, and drawn as composition
  alone every row read 100% full whatever the model — the picture and the figure
  said opposite things, and only a render could see it.
- **THE PLATFORM KNOWS WHAT EACH MODEL WILL ACCEPT** — read from the providers'
  own docs; **these move, so re-read rather than trusting this table**:

  | model | context | max output | $ / MTok in · out |
  |---|---|---|---|
  | `grok-4.6` (default) | **500K** | **no stated limit** | $2 · $6 |
  | `claude-sonnet-5` | **1M** | 128K | $2 · $10 |
  | `claude-opus-5` | **1M** | 128K | $5 · $25 |

  **CONTEXT IS NOT A CONSTRAINT ANYWHERE TODAY**: the biggest thing sent is
  ~20,000 tokens against a 500,000 floor — 25× headroom on the smallest. **The
  wall a build meets is the WIRE.** Every `*_MAX_TOKENS` is an OUTPUT ceiling;
  not one is an input bound. **KEYED BY MODEL ID, NEVER BY PICKER** — `design`
  and `pages` are separate entries. **THREE STATES FOR AN OUTPUT LIMIT**: a
  number, **`Infinity`** (a provider that states none), `null` (no row). Writing
  "no limit" as null too would be two nulls meaning opposite things. **The guard
  with teeth**: every ceiling the platform really sends must fit inside the
  SMALLEST `maxOutput` any picker can reach — the largest sent is 30,000 against
  a floor of 128,000 — and **the floor is asserted FINITE**, or taking the MAX
  by mistake makes it `Infinity` and the check says nothing while staying green.
- **THE PAGE LIST ONLY EVER EXISTED IN THE BROWSER THAT BUILT THE SITE.**
  `sitePages` reads `site.pages` out of localStorage; a site adopted off
  `/api/site/list` has none, so every page but the home page was unreachable in
  the preview on every other machine. **Nothing failed and nothing logged** — a
  label is a correct rendering of an empty list. **TWO READERS OF THAT EMPTY
  LIST, and the second is the tell**: the subtitle also said "Previewing last
  saved version" on a three-page site. `GET /api/site/routes?slug=` is its own
  route because `/api/site/source` hands back **489,100 bytes** to answer a
  dropdown. **PATHS ONLY** — the browser composes display names, so a second
  composer on the wire would be two lists of one thing. **Measured cost: the bar
  settles ~39px once** per adopted site. **OPEN**: the preview frame runs the
  site's own JS, so a click inside it really navigates and nothing tells the
  picker or the URL chip.
- **`/api/site/source` CARRIES `reads`, ONE BOOLEAN PER STORE.** Four loaders
  collapsed a failed read into an empty list, and **`loadConfig` had answered
  `{ok, why}` since it was written and the route dropped it on the floor** — so
  a bucket that threw answered byte-identically to a site with nothing on it,
  and a comparison taken across it said *"nothing was added and nothing was
  lost"*. **The 200 and `ok: true` stay** (the explorer is read-only and must
  get everything readable); what was missing was the ability to say so.
  **`complete` is three states and `null` is the one that matters** — an older
  Worker sends no `reads` and CANNOT SAY, and reading its silence as "complete"
  is how an instrument goes back to reporting an unread store as an empty site.
- **PUBLISH IS A DOOR ON THE WORKSPACE BAR, AND IT IS NOT THE BUTTON THAT WAS
  DELETED.** The old one was drawn `isReact ? '' : …` — it appeared ONLY on a
  project that had never built, the single state in which it had nothing to
  open. **It is not a dead control**: three working actions behind it and one
  true sentence. **The title carries the honesty, because the label cannot.**
  DIMMED rather than hidden before the first build.
- **THE REFRESH BUTTON DID NOTHING ON ANY REAL SITE, AND IT IS THE PUBLISH
  BUTTON'S DEFECT ONE CONTROL LEFT.** `if (f && curHtml)` is the STATIC path,
  and a React site's pages are written `html: ''`. **Two instances in one bar in
  one night says the class is worth its own sweep**: every handler still gated
  on `curHtml` or `site.html` against a render that asks `isReact`. **Not
  done.** **The bump is not cosmetic** — assigning `fr.src` a value it already
  holds does not reload an iframe. `sitePreviewSrc` is the ONE expression.
- **THE WHOLE RIGHT-HAND GROUP IS PREVIEW-ONLY.** Both side groups are
  `flex: 1 1 0` and split to min-content, so a block REMOVED on a view change
  moves the centred tabs at every width — the bug three earlier attempts had to
  learn. The four wear `st-tb-pv-off`: **`visibility: hidden`, never
  `display: none`**. ONE wrapper, not four classes, because four separately
  hidden children still collapse the gaps between them. **MEASURED across six
  widths (1024–1920): 0.00px tab shift**, the group 375.4px in both views. **The
  bar's wrapping below ~1180px is pre-existing** (48.97px at 1180+, 57.19 at
  1100, 71.19 at 1024, 85.19 at 960 — byte-identical before and after).
- **NO GUTTER BETWEEN THE CHAT AND THE PREVIEW.** `.st-body`'s `gap: .8rem` was
  **12.8px** of page background between two cards that are one workspace. **The
  visible gutter IS the flex gap**, because at `data-dev="desktop"` `.st-frame`
  is `width: 100%`. 12.8 → 0, and **the preview gains all of it** (825.2 →
  838px at 1320px). It only ever separated those two.
- **A LIVE WIRE IS GREEN** (`--wire-live: #00c853`). The app's wire is always
  false, written as a value rather than omitted so the day a mobile app owns a
  database it is a change somebody makes on purpose.
- **THE BUILDER PICKER REACHES THE ROUTING CALL** and sits on the START SCREEN,
  which is where the first build is asked for. `siteRoute` had been posting
  without it, so every routing call ran on the default whatever the customer
  chose. The effort dial is PARKED, with the three lines that restore it.
- **THE CUSTOMER'S SCREEN IS THE BROWSER'S OWN COMPOSER, EXECUTED.** A harness
  that re-composes the reply is a second copy of it. `browserReply` loads
  `public/chat.js` and runs `addonAnswer` — **the SELECTION, not only
  `addonReplyText`**, which is the SUCCESS composer: the browser has four
  answers and running only the composer labelled `"✅ Done."` on a refusal that
  published nothing. **`httpOk` is `Response.ok` and is not derivable from the
  body** — `{ok:false}` reaches the refusal branch at ANY status, so the pair
  that separates them is a body claiming success at a FAILING status.
  **`httpOkOf(status)` has three states and the third REFUSES.** No external
  action can occur, structurally: the two arms that reach outside are INJECTED
  recorders and `siteById` answers `null`, so the local-record mutation block is
  skipped and `sitesSave` is unreachable.

---
