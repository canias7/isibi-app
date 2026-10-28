# 2026-10-28 — the site owns its work; the platform keeps building and routing

The owner's rule (2026-10-27/28): the platform Worker holds what the owner uses
to BUILD (the app, the router, the AI, publishing, credits, address routing);
everything the LIVE SITE does runs in that site's own Worker, bucket and
database. Branch `claude/nice-ramanujan-9ry8wy`, not merged or deployed.

## What moved

1. **Owner keys live only on the site's Worker.** Saving a key sets it on the
   site's live and preview scripts (`setSiteSecret`); the platform stores the
   name and a hint only (`WORKER_HELD`), never the value. Uploads keep the
   script's secrets (`keep_bindings: ["secret_text"]`). An old encrypted key is
   given to the script once at the next publish and then forgotten.
2. **The job list is the site's own `_jobs` table.** The site's Worker picks
   what is due (`dueJobs`), claims it with the platform's `claimFilter` rule as a
   conditional UPDATE, runs its own function, sends with its owner's keys and
   records the result. The platform's clock only wakes sites (`/__gf/tick`); the
   Jobs panel reads/toggles `_jobs` and passes "run now" to the site.
3. **No platform fallbacks.** Every visitor call (`/api/db/<slug>/data|api|hook|
   auth|error|checkout|uploads|turnstile`, `/api/stripe/site/<slug>`, `/u/` on
   the site's own host) goes to the site's Worker (`siteAnswers`); a site that
   cannot answer is told to republish (Stripe gets 200, never a retried 5xx).
   ~1,800 lines of platform customer-work code deleted: checkout, Stripe site
   handling, write proxy (now read-only, preview only), idempotency, row
   follow-ups (owner email, confirmation, SMS, webhooks), the Supabase webhook
   queue, site API connections, inbound hooks, error inserts, the old static
   redirect/link rescue for unmarked scripts.
4. **Cleanup.** Spam check off (owner: a future addition): platform Turnstile
   config deleted, `spamCheckOn()` false, the site answers `/turnstile` with
   `{}`. Old visit counting (`site_hits`, `logSiteHit`) removed; stats read the
   site's own `_hits`.
5. **Backups** are written to and read from the site's own bucket
   (`backups/<slug>/…` in `gfs-<slug>`).

## Fixes found by the test retargeting

- Checkout started on `gofarther.dev/s/<slug>/` returned to the app's front
  page; it now returns to the site.
- Site checkout: one order per press (the kit's Idempotency-Key, kept 10 min in
  the site's own bucket), Stripe call bounded (15 s) and its failures logged.
- Site rate limits: writes 60/min, sign-in tries 20/min per visitor (`lib/site-limit.ts`); `..` refused in auth paths.
- **A site connection could send the site's database login out**
  (`?c={{APP_CONN}}`): connections, hooks and jobs now see only the owner's
  keys (`lib/owner-keys.ts`, `PLATFORM_GIVEN`).
- Owner-email cooldown claimed atomically (conditional R2 write); release removes
  only its own stamp; the missed-notification count (A12-9) restored in the
  site's own bucket.

## Kept on the platform, by the rule

Building and publishing material: the page source and AI answers, owner uploads
made in the builder (copied into the site's bucket at publish), the published
versions (the history the owner can restore), draft previews, security-scan
reports, edit jobs, credits, routing (names, custom domains, ownership), the
coming-soon page, and the app's own access to the site's database for the
owner's panels.

## The front door routes sites itself (2026-10-28)

`gofarther-front` now calls each site's own Worker directly (it binds the
`gofarther-sites` dispatch namespace, with each site's limits) and applies the
site page headers (`site-headers.mjs`, shared with the platform). It asks the
platform only what an address is (`GET /__gf/route?host=` → a slug, a
redirect, gone, or "the platform's") and keeps that answer in the edge cache
for a minute, so a renamed site or a new custom domain takes up to a minute
to switch. The app, draft previews, and a site with no Worker yet (the
coming-soon page) go to the platform. A visitor to a published site no longer
passes through the platform Worker at all.
