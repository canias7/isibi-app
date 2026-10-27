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
