# The front door and the same limits for every site (2026-10-27)

The site Worker split, Parts 2 and 6 of Cloudflare's "How Workers for Platforms
works", on the owner's word ("do that", then "no checkpoint": Q3 stays A, no
outbound Worker). Branch `claude/nice-ramanujan-9ry8wy`. Not merged, not
deployed.

## The same limits for every site (Q2: A)

`siteLimits(env)` in `worker.js`: each visitor call into a site's script
carries Workers for Platforms' custom limits, 300 ms of CPU and 50 outside
calls by default, tunable without a release (`SITE_CPU_MS`, `SITE_SUBREQUESTS`;
only positive whole numbers count). On the live dispatch and the draft
preview's dispatch only. The platform's probes and the publish confirmation run
unlimited, so a slow site is never read as a broken upload. This goes live with
the next deploy; 300 ms has not been measured against a real site's render yet
(backlog).

## The front door, `gofarther-front` (`front/`)

A separate Worker with one binding, a service binding `PLATFORM` to
`isibi-app` (Part 6: a fixed, private link to our own code). It strips
headers only the platform may set (`x-gf-*`, `x-site-preview`), hands the
request to the platform, and marks every answer `x-served-by: gofarther-front`.
It holds no secret, no bucket and no database. No workflow deploys it and it
has no routes.

The platform keeps every per-site job it does today (host → site, the
dispatch with the limits, uploads, data, redirects, the placeholder). Those
move into the front door or the site Workers in the plan's later steps; the
front door exists now so the route swap is a routes change only.

## Owed

1. Deploy `gofarther-front` (wrangler, with the owner's word): a new deploy step
   or a one-off.
2. Rehearse: give it one test hostname, check pages, a form, the preview and
   `curl -I` showing `x-served-by`.
3. Then move `*/*` on `gofarther.app` and the custom-domain fallback to it, in
   the order `wrangler.jsonc`'s routes comment describes.

## Tests

`test/front-door.test.mjs`, 6 cases.

## Going live (owner: "Yea do all 4", 2026-10-27)

- `deploy.yml` deploys `gofarther-front` after the platform and its gate.
- The front door's first route is a rehearsal: `fold-lane-bakery.gofarther.app/*`
  only (the test bakery). A more specific route wins over the platform's
  `*/*`; every other site is untouched.
- `SITE_OWN_BUCKETS`, `SITE_CPU_MS`, `SITE_SUBREQUESTS` are optional GitHub
  secrets with defaults `0`, `300`, `50`.

## Deploy 2278 and the rehearsal (17:22–17:40 UTC)

`main` `8f29c37d3` → `91b7f1f00` on the owner's "merge and deploy"; run
40549986932 green, front-door step included. Read free with curl: the test
bakery answers through the front door (`x-served-by: gofarther-front`) on `/`,
`/visit`, `/gallery`, `/robots.txt`, `/sitemap.xml`, both hashed assets (200,
immutable) and 404s; `fretwork-1` has no such header (untouched). A headless
screenshot of the bakery's home page matches the site. Not runtime-confirmed
(no canary press yet).

## Step 3: every gofarther.app address (prepared)

The front door's route becomes `*.gofarther.app/*`; the platform keeps its
`*/*` on the zone as the fallback, so nothing is unrouted at any moment.

## Customer domains through the front door (prepared, 2026-10-27)

`test.isibi.ai` (owner's domain; the root and its mail untouched) was added to
`ember-cart` through the app's own domains route, its three records written
with a token the owner created for isibi.ai's DNS only (not stored). Live at
21:34 UTC on the old path: 200, title "Ember Cart", certificate issued, no
`x-served-by`.

The `*/*` route on gofarther.dev's zone moves from `wrangler.jsonc` to
`front/wrangler.jsonc`; `gofarther.dev` and `www` keep their exact
`custom_domain` routes on the platform. The deploy removes the platform's
route before the front door adds its own (about a minute with no Worker on
customer hostnames; `site_domains` held no customer domain, only the test
one). `saas-setup.mjs` now names the front door's config; `site-zone`'s
control and `saas-setup`'s wildcard test read it there.

## Deploy 2281 and the app-host finding (21:52 UTC)

`main` `61dd33db4` → `f4997595e` on the owner's "merge and deploy". Read free:
`test.isibi.ai`, `ember-cart.gofarther.app` — 200 through the front door. BUT
`gofarther.dev` and `www.gofarther.dev` also answered through the front door:
the `*/*` route on the zone caught them despite their `custom_domain` routes.
Build jobs call `https://gofarther.dev/api/job/<id>` with `x-gf-*` headers
(conditional writes `x-gf-if-match` …, replay marker `x-gf-job`), which the
front door stripped. No edit or build job ran between the deploy and the fix
(`edit_jobs`: none in the 30 minutes). Fix: the front door passes the app's
own hosts through untouched (`APP_HOSTS`, `isAppHost`); customer hosts are
still cleaned. 2 new cases.

## A site answers its own visitors' reads (2026-10-27)

Point 2's first piece, on the owner's "start fixing". With `SITE_OWN_DATA`
(default on), a site's script is uploaded with its database's two public
addresses (`DATA_API_BASE`, `AUTH_BASE`; `SITE_VARS` in site-dispatch.mjs,
https only, nothing else passes) and answers GET/HEAD on
`/api/db/<slug>/data/…` itself (`ownDataRead` in the template's server.ts:
the visitor's own token or an anonymous one minted by the auth server, no
secret). The platform keeps its rate limit, then asks the script; an answer
without `x-site-data: own` falls back to `proxySiteService`. Writes stay on
the platform (spam gate, double-submit guard, row effects).
`test/site-own-data.test.mjs`, 6 cases, the template handler run for real.
Not yet proven live: needs a new site with a table.

## Phase A: a site saves its own visitors' rows (2026-10-27)

Owner: "if its their site, their platform then it should be their worker".
With `SITE_OWN_DATA` on and the site on its own bucket, the script also
handles POST/PATCH/PUT/DELETE on its data path (`ownDataWrite`): the spam
token field is dropped (Turnstile off, backlog), a press with an
idempotency key is answered once (kept 10 minutes in the site's own bucket),
the row is saved through the site's Data API, and a note signed with the
site's own key (`builder/site-effect.mjs`: HMAC(platform root,
"site-effect:v1:"+slug), uploaded as a secret) goes to the platform's
`/api/site-effect` over a service binding. The platform proves the site from
the signature and runs the same follow-ups (`applyRowEffects`, now shared with
the proxy): owner email, confirmation, text, webhook. Phase B (the owner's own
mail/SMS/webhook keys bound to the site) and C (our notification email and
webhook retries) follow. Tests: `test/site-own-data.test.mjs`, 12 cases.

## The site runs its own follow-ups (2026-10-27, replaces the signed note)

Owner: "have the site worker do that bro, dont worry about old sites". The
platform note route and `builder/site-effect.mjs` are gone. At publish
(`siteReadVars`), the platform unlocks the site's own provider keys (mail,
SMS, `WEBHOOK…`), reads its limited login, its owner's email, whether the
owner asked to be told (`site_backends.notify`) and its form settings, and
uploads them to THAT site's script: plain values `SITE_TABLES`,
`OWNER_EMAIL`, `NOTIFY`; secrets `APP_CONN` and the owner's keys
(`SITE_PLAIN`, `siteSecretAllowed` in site-dispatch.mjs; platform keys never
pass). The template's `lib/site-effects.ts` runs the platform's own modules,
copied byte for byte into `src/lib/effects/` (`builder/gen-site-effects.mjs`,
`test/site-effects-copy.test.mjs`): owner email (cooldown in the site's own
bucket), confirmation, text, webhook, with the site's own SQL over Neon's HTTP
endpoint as its limited login. `postProviderEmail`/`postProviderSms` moved to
`site-providers.mjs`, shared by both. Old sites: nothing changes.

## Logins in the site's own Worker (2026-10-27)

Owner: "Everything that's related to their website needs to go to their own
thing ... Nothing should be ours." `ownAuth` in the template's server.ts
answers `/api/db/<slug>/auth/…` from the site's own auth server (the
`AUTH_BASE` it already holds), with the platform's cookie rule
(`site-cookie.mjs`, now copied by gen-site-effects.mjs) and the two session
headers passed on. The platform's auth route asks the site first (rate limit
kept). 2 cases.

## Files in the site's own Worker and bucket (2026-10-27)

The owner's uploads and hosted media (`uploads/<slug>/…`) are copied into the
site's own bucket by the sync (copied when missing or changed, removed when
gone). The template's `lib/site-files.ts` serves `/u/<slug>/<file>` from it
with the platform's own range / revalidation / download-name rules
(`site-media.mjs`, `site-uploads.mjs` copied), and takes a visitor's image on
`POST /api/db/<slug>/uploads` with the platform's own `handleVisitorUpload`,
stored under `vuploads/` in the site's bucket (the sync never touches it). The
platform asks the site first, after its host tie. Not carried: the owner's
Uploads panel lists the platform's copy, so visitors' files written by the site
do not show there yet (backlog).

## Payments in the site's own Worker (2026-10-27)

`lib/site-pay.ts`: `POST /api/db/<slug>/checkout` prices the cart from the
site's own rows (`site-payments.mjs` copied), writes the pending order as the
site's limited login, opens a Stripe Checkout Session with the OWNER'S
`STRIPE_SECRET_KEY` (6 a minute per visitor, the platform's own guard), and
records the session id. `POST /api/stripe/site/<slug>` (still the address in
the owner's Stripe dashboard; the platform passes it to the site) checks the
OWNER'S `STRIPE_WEBHOOK_SECRET` (`stripe-webhook.mjs` copied), flips the order
paid or lapsed, and runs the follow-ups (`runEffectsFor`). Both keys are
unlocked at publish and given to that site only. 3 cases.

## The site's own connections and inbound hooks move into its Worker (2026-10-27)

- `GET /api/db/<slug>/api/<name>` and `POST /api/db/<slug>/hook/<name>` are
  now answered by the site Worker (`lib/site-connect.ts`), using the
  platform's own `site-apis`, `site-api-shape`, `site-inbound` and
  `site-ssrf` modules copied byte for byte. The platform asks the site
  first (`ownDataRead`) and falls back only when the site does not mark
  its answer `x-site-data: own`.
- At publish the site is given `SITE_SPEC` (its declared `apis` and
  `functions`) and **every secret it holds** (its own `_secrets`, decrypted,
  except the Turnstile marker), named however the owner named them;
  `siteSecretAllowed` refuses the platform's own names (`RESERVED_NAMES`).
- Hooks run the site's `hook_<name>` function as its limited login
  (`APP_CONN`). Limits (60 API calls a minute, 30 hook posts) are per isolate.
- Not yet shown live. Cache is per isolate (the platform's KV layer is not
  the site's).

## Addresses, error reports and visits move into the site Worker (2026-10-27)

- **robots.txt and sitemap.xml** on the site's own hosts are served by the
  site with its own origin filled in (`lib/site-addresses.ts`); the workspace
  address `/s/<slug>/` keeps the platform's. A script without the own mark is
  not believed for these two files (an older one would leave the placeholder
  origin in).
- **A moved or deleted page's 301** is read by the site from its own
  `sitemeta/<slug>.json`; the document's `./` links are made absolute by the
  site. A response marked `x-site-data: own` is passed through untouched.
- **Error reports** (`POST /api/db/<slug>/error`) go into the site's own
  `_errors` from its Worker (`lib/site-telemetry.ts`), always 204.
- **Visits** are counted by the site into a new `_hits` table in its own
  database (made at build and, for older sites, at publish by the owner's
  login). Before this, sites served by their own script were **not counted
  at all**: the platform counted only on the old static path. The owner's
  panel adds the site's `_hits` to the older Supabase counts (a visitor seen
  by both can count twice).
- **The "coming soon" stand-in stays with the platform**: it is shown before a
  site has a Worker, so it is part of building.

## Scheduled jobs, webhook retries and secret changes (2026-10-27)

- **Scheduled jobs**: the platform keeps the clock and the claim
  (`site_functions`, the owner's on/off and last result). When a job is due
  it claims the run, then asks the site's Worker (`POST /__gf/job`, header
  `x-gf-site-job`, 250 outside calls); the site runs its own database
  function and sends with its owner's own mail/SMS keys
  (`lib/site-jobs-run.ts`, the platform's `site-jobs.mjs` copied). A script
  without the own mark is run the old way. The header is set only by the
  platform and deleted from every request it forwards to a site (three
  places); the front door strips `x-gf-*` from visitors.
- **Webhook retries**: a delivery worth retrying is kept in the site's own
  bucket (`webhooks/q/<event>.json`, dead ones under `webhooks/dead/` for 30
  days) with the platform's own backoff rules (`site-webhook-queue.mjs`
  copied). The platform's tick wakes up to 40 own-data sites a minute
  (`POST /__gf/tick`); the site drains its own queue. Cron triggers on user
  Workers are not confirmed in Cloudflare's docs, so the clock stays ours.
- **Secret changes** are sent to the site's live and preview scripts at once
  (`setSiteSecret`: PUT/DELETE on the script's secrets); a platform name is
  refused.
- Not shown live. A job whose site call fails after it sent messages is run
  again by the platform (the claim is held, so not by the next tick).
