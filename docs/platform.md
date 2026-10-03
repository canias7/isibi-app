# The platform: its two halves, where the code lives, data and payments, credits

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in the second pass
> of its cleanup (the file as it stood: `git show 28bdc97f:CLAUDE.md`).
> CLAUDE.md keeps a short "Where the code lives" and a line each on data,
> payments and credits.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## Two halves, one Worker

Both are **Go Farther** now — one brand, renamed 2026-08-30.

- **The media side** — an AI image/video/voice generator at **gofarther.dev**.
  **DELETED 2026-09-12** in five stages, ~23,000 lines: the composer, the
  gallery, the director, `/api/video|image|audio`, the Media Agent, the avatar,
  the universal memory, the game builder, and the customers' 53 stored
  generations.
- **The site builder** — a customer describes a business in chat and gets a
  published website at **`<slug>.gofarther.app`**. `gofarther.dev` is the tool
  they use; `.app` is theirs. It is the only work now.

**WHAT THE DELETION KEPT, each checked rather than assumed**: the membership
tiers; the credit ledger and every RPC under it (`gen_charges` is a live
Postgres table with `refund_charge` over it — money history); `usage_log` (it
reads as media-era and is the BUILDER's quota); `safeFetch`/`hostIsBlocked`
(the outbound webhook takes a customer's URL); and **fal for the builder's own
photographs** — `genSitePhoto` calls `fal.run` DIRECTLY where the media side
called `queue.fal.run`, so deleting `/api/image` could never take a site's
pictures with it. The 108 site-builder uploads under `<uid>/site/` (162 MB)
stay. **`home` IS AN ALIAS FOR `sites`, NOT A VIEW** — `KNOWN_VIEWS` is
`['sites','settings','agents']` and anything else falls back to the builder.
**The landing page still carries the media side's CRT channel selector and its
model pipeline**, deliberately: rewriting it is a design job the owner directs.
Both landing doors open the builder and the non-website channels are inert.

**THE DEAD-CODE DELETION (2026-09-13)** took ~1,400 lines of `worker.js` and
`public/chat.js`, four modules, a 1.5 MB wasm dependency, and **2,280 lines of
unreachable CSS**. The law that survives:

- **THE LINE IS "DEAD BY CONSTRUCTION" versus "DEAD ONLY GIVEN STORED DATA".**
  A declaration nothing references, or a branch whose condition cannot be true
  from the code alone, is measurable here and goes. A branch reachable only
  from a record in a customer's localStorage is not and STAYS — `chat.js` keeps
  every legacy-`html` arm.
- **`public/styles.css` is held at ZERO unreachable rules** by
  `test/css-reachable.test.mjs` with an EMPTY `KEEP` list. It went 7,210 lines /
  484,036 bytes → **4,930 / 327,903**; the served sheet is 156,133 bytes lighter
  per page load. **A prefix is the TAIL of a literal before a `+`, not the
  literal.** False-alarm rate measured four ways and is zero, including a real
  Chromium comparing all 1,744 elements across five pages at two widths.
- **A comment goes only when EVERY rule it introduces goes** — section
  boundaries are not subject boundaries.
- **A CSS SYNTAX ERROR SHIPPED FOR A DAY** because a deletion cut a two-line
  rule in half; a browser recovers by discarding text until the next `}`,
  silently. The guard asserts the braces balance and `braceReport` is DRIVEN.
- **OPEN**: `GET /preview/<uid>/<nonce>` is served and **nothing anywhere writes
  that object**, so it has answered "Preview not ready" to every request it has
  ever had. Recorded in `client-routes.test.mjs`'s `KNOWN_DEAD` prose.

## Structure

- **`public/`** — the frontend, plain HTML/CSS/JS, no build step: `index.html`
  (the chatbox, the only app page), `styles.css`, `chat.js` (the builder's
  client and the agent builder's), `auth.js` (Supabase email/password +
  email-code via GoTrue fetch), `edit-poll.js`, `site-list.js`, `site-zip.js`,
  the marketing pages (`privacy`, `terms`, `confirm`, `data-deletion`) and the
  icon set.
- **`worker.js`** — the Cloudflare Worker. Serves assets, and the builder's
  whole `/api/site/*`, `/api/db/*` and `/api/agent/*` surface. **The media
  side's routes are GONE** — `/api/video|image|audio`, `/api/direct`,
  `/api/import/fetch` and `/api/save` occur nowhere in it but prose (checked,
  not assumed). **It CAN be imported by tests** — the belief that it could not
  is why twelve features shipped dead; see the traps below.
- **`builder/`** — the site builder. `lovable/template/` is the kit and the app
  scaffold (React 19 + Tailwind v4 + TanStack Start; 2,112 components in
  `src/components/ui/`, plus ~880 chart primitives under `charts/lib/`);
  `build-server.mjs` is the container's HTTP service;
  `page-gen.mjs`, `publish-pages.mjs`, `site-*.mjs` are plain modules, importable
  and tested outside the Worker.
- **Supabase** (`ujrqdmmtcptvimazlhom`) — platform auth, the credit ledger, the
  `media` bucket, `site_backends` / `site_project` / `site_builds`.
- **Neon** — one project per SITE, holding that site's own database.
- **R2** — everything that is not rows: `builds/<slug>/<version>/` (every
  publish since stage 7, immutable: the dist under `client/`, the script as
  `server.js`, the state under `state/`, the manifest last), `current/<slug>.json`
  (the ONE mutable pointer: which build is live), `sites/` (the legacy served
  prefix — frozen for a site until its next publish, and still where
  `site.live` and the early placeholder live), `source/` (page source),
  `uploads/`, `versions/` (the legacy copy archive), `backups/`, `sitemeta/`,
  `config/`, `orphans/`, `jobs/`, and, on the branch (2026-10-03, off by
  default), `requests/` (a request of several parts: its record, files, reply
  and answer pointers) and `requests-live/` (the markers the two-minute
  sweep lists; `docs/request-flow.md`).
- **The Media Agent and the universal memory are GONE** (stages 2b–4). The agent
  was an Instagram/YouTube manager over Composio — read and comment auto-reply
  live, DM auto-reply blocked on Meta App Review — and the memory was
  auto-learned creative taste applied to every media generation, backend only and
  deliberately with no UI. Both went with the media side, along with
  `docs/media-agent.md` and the Composio credential. `git show
  6393b134:CLAUDE.md` and the deleted document in history are where they are
  described, if either is ever wanted back.

## Data, auth, payments, mail

- **Neon per site.** `site-schema.mjs` is the engine: `isibi.schema.json` in,
  DDL out. Access is **two axes** (`read` × `write`), with five preset names as
  shorthands — `normalizeSchema` stamps `access: "collect"` on a pair-declared
  table, so **always ask `resolveAccess(t)`, never the preset name** (that misread
  has cost five separate bugs).
- **RLS on every table**, keyed on `app_user_id()`. `read: "none"` emits NO SELECT
  policy — the write-only guarantee is the ABSENCE of the statement.
- **Neon Auth** is identity (`neon_auth."user"`, UUID). Always schema-qualified
  and quoted: bare `FROM user` resolves to the `USER` value function and returns
  a wrong answer rather than erroring.
- **Neon's Data API** is the data path; ours was deleted. `/api/db/<slug>/*` is
  transport only.
- **Payments = the owner's OWN Stripe key**, in the site's own `_secrets`. Not
  Connect; we are never in the money flow. **The price comes from the site's own
  rows, never the browser** — a payable table gets no public INSERT grant at all.
- **Mail from a site to its customers = the owner's own key.** `env.EMAIL` is
  OURS (login codes, 200/day) and the builder may not touch it.
- **The line**: we provide hosting, the database, the data API and member sign-in.
  Anything that spends the owner's money or sends mail as their business is
  bring-your-own. The test for anything new: does it need a credential AND a
  network call? Then it is platform code, because a published site is static
  files and Postgres on Neon has no HTTP client.

---

## Credits & monetization

1 credit = $0.008 of fal cost. Postgres RPCs: `get_credits`/`use_credits` (20
granted on first touch), `add_credits` (service-role, mint-key gated, idempotent
on `purchases.ref`), `credit_back` (≤10/call), `is_paid`. Stripe live since
2026-07-08 — memberships Plus/Pro/Max ($24.99/$49.99/$99.99) plus top-ups; the
webhook verifies its HMAC and mints. Free accounts get watermarks; gallery
storage is a membership benefit (10/50/100 GB).

**`use_credits` is a GATE, not a till**: a bill larger than the balance debits
ZERO and returns -1. `collectCredits` takes what is there and `billed` records
what the work cost.

**A FOUNDER IS NEVER CREDITED BACK.** `use_credits`, `use_credits_for` and
`get_credits` answer the founder sentinel (1000000) before any debit, and until
2026-09-05 `credit_back` and `refund_charge` credited a founder like anyone else
— a build refund after a failure would have paid back money never taken.
Unreachable only while the one founder had no `credits` row; a purchase or a
grant would have armed it. Both are decided by `private.founders` — the mirror
of the check `use_credits` makes, **NEVER a balance threshold** — and answer
without writing: `credit_back`'s one UPDATE is gated in its WHERE,
`refund_charge` refuses before the row lock. **Driven on the live database and
rolled back** (`scripts/edit-rpc-check.sql`), **run RED against the old bodies
first** (`credit_back` paid a founder, 494 → 496) and green after.

**EXEMPTION AND DEBIT ARE EXPLICIT RESULTS ON THE BUILD PATH.** `use_credits`'s
answer is a balance or -1: a founder's call answered the sentinel and the route
read it as a debit; a short balance answered -1 and took what it could; and
every refund was a NUMBER the route remembered, handed to `credit_back`, which
credited it **whether or not it had ever been taken**. Two RPCs now say what
they did:

- **`credit_debit(amount, ref, reason, partial)`** — caller-scoped, answers
  `{ok, exempt, taken, repeat, prior, balance, short}`. A founder answers
  `exempt` with NO row; **the account row is locked BEFORE the repeat check**,
  so a duplicate delivery waits and then meets the first one's row; a bill above
  the balance is refused whole unless `partial`.
- **`credit_reverse(target, ref, reason, amount)`** — service-role only; finds
  the debit row **by ref AND account** (one account's ref can never be reversed
  onto another), refunds `least(amount, debited − already)`, and **reads the row
  and never the founders table**: a founder at debit time wrote no row and gets
  0; a customer who became a founder after a real debit still has the row and is
  paid back — the case the founder guard could not cover.

**The route is a ledger of refs.** `billRef = "build:" + (jobId || randomUUID())`
— the JOB'S id under the queue, so a duplicate delivery meets its own rows — and
`debitRef(step)` names each debit (`:deposit`, `:settle`, `:pages`).
`refundFields()` carries **NO amount**: it reverses every ref for what stays and
recomputes `refundShort` from `owed()`. **`billRef` is in `buildArgs`** so a
resume debits under the SAME ref.

**A SWEEP SURVIVOR FOUND THE RUNNER'S OWN BUG**: `String.prototype.replace` reads
the `$'` at the end of a mutant's regex literal as "the text after the match", so
the file changed, the checksum said applied, and **the mutant that landed was not
the one written**. The runner replaces through a function now and verifies the
landed text IS the written text.
