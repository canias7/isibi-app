# Site Worker split: the plan (2026-10-26)

**Owner decision (2026-10-26):** separate the platform from customer sites, the
way Lovable does. `gofarther.dev` is the platform Worker only. `*.gofarther.app`
and custom domains go to a new, small front-door Worker, which hands each visit
to that site's own Worker in the `gofarther-sites` dispatch namespace. Each site
Worker does everything for its site and is sealed: it gets its own Neon
database (the limited `<db>_app` login), its own files and its own secrets, and
nothing of the platform's. Old and demo sites are ignored: they are rebuilt or
dropped, with no compatibility path.

**Status: plan only.** No code has changed, nothing has been spent and no
secret has been read. Line numbers refer to `worker.js` at `8f29c37d3`, the
base of `limited-login`. Line numbers drift, so search for the landmark named
beside each one.

---

## 1. What the platform Worker does for a customer site today

Today one script, `isibi-app`, answers every hostname: `wrangler.jsonc` routes
`*/*` on both `gofarther.dev` and `gofarther.app` to it. A site request is
rewritten to `/s/<slug>/…`. The platform then either forwards it to the site's
script or serves it itself.

| # | What | Where (worker.js) | Moves to | Why |
|---|---|---|---|---|
| 1 | Host → slug rewrite: `<slug>.gofarther.app` → `/s/<slug>/` (`siteHostSlug`) | 31350, 31401 | **Front door** | This is routing only, and the front door owns hostnames. |
| 2 | Custom domain → slug (`mapped`) | ~31405–31429 | **Front door**, reading a KV map the platform writes | The same reason. The platform writes the map when a domain is claimed. |
| 3 | `/s/<slug>` on the app host → 301 to the pretty host (`publicNameFor`) | 31329–31340 | Dropped (only old sites use it) | Old addresses only. |
| 4 | Renamed site's old address → redirect to the current name | `publicNameFor`, 31329 | **Front door** (an alias map in KV) | This needs the map across sites, and a site Worker must not know other sites' slugs. |
| 5 | Draft preview host `<slug>--draft-<token>` (`previewOf`, `previewScriptName`, the preview data proxy) | 31347, 16021–16148 | **Front door** routes to the preview script. The token check moves into the preview script, with the token bound at upload | Previews stay off the platform, and the platform no longer proxies preview data (16048, 16113). |
| 6 | The dispatch itself: `env.SITE_WORKERS.get(scriptNameFor(slug)).fetch(...)`, which strips `PREVIEW_HEADER` | 31507–31760 | **Front door** | This is the front door's one job. |
| 7 | HTML post-processing (mount rewrite to `/s/<slug>`, `absolutizeAssets`, `harden()` headers) | 31573, 31694 | **Site Worker** (the headers go in the template's server). The mount rewrite goes, because sites are served only at the root | There is no `/s/` mount once old sites are dropped. |
| 8 | Fallback and redirects for renamed pages (`decideFallback`, `parseSiteManifest`, `mergeRedirects`) | 31692, 19846, 14233, 17461–17471 | **Site Worker** (the manifest is bundled at upload) | This is per-site data, and publishing already computes it. |
| 9 | `robots.txt` and `sitemap.xml`, with `SITE_ORIGIN_TOKEN` replaced by the real origin (`substituteOrigin`) | 31501–31507, 31759–31770, 17480 | **Site Worker**, which sees its own `Host` | It lived on the platform only because of the `/s/` mount. |
| 10 | The coming-soon and building placeholder (`PLACEHOLDER_META`, `schemaPlaceholderPage`) | 6931–7116 | **Site Worker** (a placeholder script uploaded when the site is first claimed), plus a generic page on the **front door** when no script exists | A site with no script yet still needs an answer. |
| 11 | Uploads at `/u/<slug>/<file>` (host check, media ranges, `If-Range`) | ~31860–31960 (the key at 31879) | **Site Worker**, reading only its own files (§2) | These are per-site files. |
| 12 | Visitor data at `/api/db/<slug>/data/…` (`proxySiteService` "data") | 34293–34306, 11720 | **Site Worker**, through its limited `<db>_app` connection | This is row work for visitors, which is what the limited login is for. |
| 13 | The site's own API at `/api/db/<slug>/api/…` | 34319 | **Site Worker** | It is the site's business logic. |
| 14 | Inbound hooks at `/api/db/<slug>/hook/…` (guarded by a secret the owner shares) | 34390 | **Site Worker**, with the secret bound to its script | The secret belongs to the site. |
| 15 | Browser error reports at `/api/db/<slug>/error` | 34435 | **Site Worker** writes a log line, and the **tail Worker** files it into `site_errors` | The site must never hold the Supabase service key. |
| 16 | The Turnstile key at `/api/db/<slug>/turnstile`, and the gate (`turnstileGate`, `turnstileConfig`) | 34521, 13230–13410, 11830 | **Site Worker**. The site key and secret are bound to its script, and the platform's pair is bound only as the default | The secret belongs to the site. |
| 17 | Visitor auth proxy at `/api/db/<slug>/auth/…` (the cookie rescoped at 11971) | 34552–34568 | **Site Worker**. The cookie belongs to its own host, so it needs no rescoping | Visitor logins belong to the site. |
| 18 | Site checkout at `/api/db/<slug>/checkout`, using the owner's own Stripe key | 34578 | **Site Worker** | The secret is the owner's. |
| 19 | Site Stripe webhook at `/api/stripe/site/<slug>` | 32107–32195 | **Site Worker**, at `<host>/api/stripe/webhook`. The panel shows the owner the new URL | The webhook secret is the owner's. The platform's own `/api/stripe/webhook` (32196) **stays**. |
| 20 | Visitor uploads at `/api/db/<slug>/uploads` | 34639 | **Site Worker** (writes its own files) | These are per-site files. |
| 21 | The site hit counter (`recordSiteHit`) | 2206 | **Tail Worker** (counts from the logs) | No platform key can be in a site. |
| 22 | Mail and SMS for a site (`siteMailSecrets` 13760, Resend 2876, Twilio 2895) | 2860–2910, 13760 | **Site Worker**, with the owner's keys bound as secrets | The keys are the owner's. Our own `env.EMAIL` is never bound to a site. |
| 23 | Scheduled site jobs (`runScheduledSiteJobs`, which reads Supabase with the service key) | 2223, 3246 | **Site Worker** `scheduled()`. Either each script gets its own cron triggers, or a **platform tick only pings** each due site's `/__cron` with a token signed for that site | The job runs with the site's credentials, and the platform keeps only the schedule. |
| 24 | The outbound webhook queue (`runWebhookQueue`) | 3097 | **Site Worker** sends, with retries kept in the site | The event data is the site's. |
| 25 | Nightly backups (`runNightlyBackups`) | 2228 | **Stays on the platform** | It is the platform's duty and not on the visitor's path. |
| 26 | Neon teardown, domain watch, site rebuild, lost jobs and the sweeps | 2233–2260, 2502, 2588, 2684 | **Stays on the platform** | This is account-level work. |
| 27 | Publishing: `uploadSiteWorker`, `confirmSiteWorker`, `probeSiteWorker` | 17267, 16315, 16828, 16938, 23777 | **Stays on the platform**. It is the channel from the platform to a site | §4. |
| 28 | The owner's Data panel, the data rung and the owner source route (`/api/site/*` on gofarther.dev) | | **Stays on the platform**, which reaches the database directly (§4) | This is the owner's side. |
| 29 | Platform checkout and credits (`/api/checkout`, `/api/stripe/webhook`, `/api/credits`) | 31962, 32196, 32714 | **Stays on the platform** | These are ours. |

Everything else on the app host stays on the platform: `/`, `/api/site/*`,
`/api/agent/*` and the assets. After the split, the platform's `*/*` route on
`gofarther.app` is removed.

## 2. How a site Worker gets only its own things

Bindings are set at upload, in the `metadata.bindings` of `uploadSiteWorker`
(`builder/site-dispatch.mjs:74`). A script in a dispatch namespace inherits
nothing, so that list is the seal.

- **Secrets.** These are per-script `secret_text` bindings in the upload
  metadata: the Stripe key, the Stripe webhook secret, the mail key, the SMS
  key, the Turnstile secret, the hook secret and `DATABASE_URL`. At publish
  time the platform decrypts the owner's stored secrets with
  `SITE_SECRETS_KEY` and sends the plaintext only to Cloudflare's API.
  `SITE_SECRETS_KEY` itself is never bound. A secret change goes through
  Cloudflare's secrets endpoint for namespace scripts, with no rebuild.
- **Database.** `DATABASE_URL` is the limited `<db>_app` connection string
  (branch `limited-login`, `a5b3dd465`). It does nothing until the owner
  applies `supabase/proposed/site_app_conn.sql`. The site reaches Neon with
  the serverless driver over HTTPS. It has no Neon API key and no owner role,
  and RLS stays as it is today (`resolveAccess`).
- **Files: the three options.**
  1. *One bucket per site.* This is true isolation. But R2 caps the buckets in
     an account (1,000 by default; to confirm), every site adds bucket
     management, and the publish and backup code assume one bucket. Not
     chosen for now.
  2. *Access limited to the site's prefix, through a platform service
     binding* (a small "files" Worker; the binding fixes which site is
     calling). This works, but a service binding to a platform Worker is a
     door back into the platform, and every file read costs two invocations.
  3. *Static assets bundled with the script* (Workers static assets for
     namespace scripts: an asset upload session, then a script upload that
     references its completion token). Built pages, JS, CSS and the site's
     published images ship with each version. There is nothing to bind and
     nothing to reach. The limits: 25 MiB per file, a cap on files per
     version, and every change is a new upload.

  **The pick: option 3 for built output, and for changeable files a bucket of
  the site's own, made on demand.** Built assets are bundled. Changeable
  files (visitor uploads, row 20, and owner media, row 11) go to an R2 bucket
  **created for the site only when it first needs one**: forms with uploads,
  or hosted video and audio. Most sites never get a bucket, which keeps us far
  below the cap, and a site that has one is bound to that bucket alone. If the
  cap is ever reached, those sites fall back to option 2. Either way, the
  whole-bucket `SITES` binding at `site-dispatch.mjs:74` is removed, which
  closes the cross-site hole.
- **Never bound:** `SUPABASE_SERVICE_KEY`, `NEON_API_KEY`,
  `CLOUDFLARE_API_TOKEN`, `SITE_SECRETS_KEY`, `GATEWAY_SIGNING_KEY`,
  `SITES_BUCKET`, `SITE_ROUTES` and `EMAIL`. A guard test checks that the
  upload metadata holds only allow-listed binding names and types.

## 3. The front-door Worker

A new script, `gofarther-front`, with its own `wrangler` config. It takes the
`*/*` routes on `gofarther.app` and the custom hostnames. On `gofarther.dev`'s
zone the platform keeps only exact `custom_domain` routes for `gofarther.dev`
and `www`, and the `*/*` route there moves to the front door.

- **Bindings:** `SITE_WORKERS` (the dispatch namespace) and `HOSTS`, a KV map
  from hostname to script name. It also holds aliases and old names, each
  with a 301 target. The platform writes it on publish, rename, domain claim
  and delete. The front door has nothing else.
- **Flow:** normalise the host. Find the script: the label under
  `*.gofarther.app`, or the KV map. An alias answers 301. Otherwise call
  `SITE_WORKERS.get(name, {}, { limits: { cpuMs, subRequests } })` and return
  its answer as it is. Inbound `x-gf-*` headers are stripped first.
- **No script, unpublished or unknown host:** a static "This site isn't
  published yet" page. An unknown host gets 404; a known host whose script is
  missing gets 503 with `retry-after`. A preview host goes to the preview
  script, which checks the token itself.
- **Limits per site:** CPU and subrequest limits on each dispatch call (for
  example 50 ms of CPU and 50 subrequests; the owner sets the numbers), so one
  site cannot spend another's budget. Cloudflare rate-limiting rules per host
  handle abuse.
- **Outbound Worker** (a namespace setting): every `fetch` a site makes passes
  through it. It allows Neon (`*.neon.tech`), Stripe, Resend, Twilio,
  Turnstile verification and the integrations a site declares. It refuses our
  own hosts (`gofarther.dev` and the Supabase project) and metadata IPs, and it
  labels each call with the script's name for the logs.
- **Tail Worker** (attached to each namespace script at upload, through
  `tail_consumers`): it receives each site's logs and exceptions and writes
  `site_errors` and the hit counts to Supabase. It holds the platform key
  itself; the site never holds it. This replaces rows 15 and 21.

## 4. What the platform still reaches on a site, and how

When the platform acts on a site, it never goes through the site's Worker.

- **Publish and upload.** The platform, or a narrow publish endpoint (§5 step
  7), uses its own token to call the Cloudflare API: the asset upload
  session, the script PUT with its bindings, the secrets and the tail
  consumer. Then it writes the `HOSTS` map. The platform keeps its
  `SITE_WORKERS` binding only to probe health.
- **The owner's Data panel, the data rung and builder edits.** The platform
  opens the site's database directly: the limited login for rows, and the
  owner login for schema changes. `limited-login` already works this way. For
  owner media, the platform writes the site's own bucket with the account's
  credentials.
- **Container jobs.** `NEON_API_KEY`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `SITE_WORKERS_*` and `SITES_BUCKET_NAME` come out
  of `JOB_ENV_NAMES` (`builder/edit-job.mjs:1034–1035`). Instead, the job
  calls the platform's existing gateway with its job token, which is already
  limited to one slug and one lane. It gets exactly four calls:
  - `publish(slug, bundle)`;
  - `dbConn(slug, role)`, which returns a short-lived connection for that
    site only (or the platform runs the SQL itself);
  - `provisionDb(slug)`;
  - `putFile(slug, key)`.

  Each call checks the token's slug. A guard test checks that
  `JOB_ENV_NAMES` holds none of the platform's keys.

## 5. Migration in order: each step ships on its own

Every step ships with guard tests, a sweep, the full suite, the records and a
push. Merges and deploys wait for the owner's word, and paid checks need the
owner's approval.

1. **Apply the limited login.** The owner applies `site_app_conn.sql`, and
   `limited-login` is merged. *Verify:* a free canary read of a test site's
   rows through the existing route, with `<db>_app` in the logs.
2. **Seal the upload.**
   - `uploadSiteWorker` takes an allow-listed list of bindings, and the
     whole-bucket `SITES` binding is dropped.
   - The built assets are bundled as static assets.
   - The upload adds `DATABASE_URL` and the per-site secret bindings, and
     the template's server reads them.
   - Visitors still reach sites through the platform's dispatch (row 6).

   *Verify:* rebuild one throwaway site and check that its pages, a data
   read and a form post work. Its script settings, read without secret
   values, list only allowed names.
3. **Move the visitor routes into the template** (rows 8–20 and 22). The
   template's server answers the `/api/db/...` equivalents at `/_gf/*` on its
   own host, plus robots.txt, the sitemap, the redirects and the placeholder.
   The platform's dispatch forwards those paths to the script instead of
   handling them. *Verify:* on a throwaway site, a form, a login, a checkout
   in Stripe test mode, an upload and the sitemap.
4. **The tail and outbound Workers.** Deploy both and attach them at upload.
   *Verify:* a forced browser error appears in `site_errors`, and a fetch to
   `gofarther.dev` from a site is refused.
5. **The front door.** Deploy `gofarther-front` with the `HOSTS` map, filled
   by a platform script. Then move the `gofarther.app` `*/*` route from the
   platform to the front door, one deploy on each side, in the route order the
   routes comment in `wrangler.jsonc` describes. *Verify:* a throwaway site
   answers on its label, an unknown host gets the not-published page, and
   `curl -I` shows the front door's header.
6. **Custom domains.** Point the Cloudflare for SaaS fallback at the front
   door, and give the platform exact routes for `gofarther.dev` and `www`.
   *Verify:* one test domain, with the owner's approval.
7. **Container jobs on gateway calls.** Add the four gateway calls, switch the
   job code to them and take the keys out of `JOB_ENV_NAMES`. *Verify:* one
   paid edit and one build on a throwaway site, with the owner's approval.
8. **Scheduled jobs and webhooks move into the site Workers** (rows 23–24).
9. **Delete** the platform's site-serving code (rows 1–22), and the old
   sites the owner chooses to drop.

**Risks:**
- Large sites may hit the static-asset limits.
- A script may hit the cap on secrets per script.
- The front-door route swap is the riskiest moment. A bad routes PUT fails
  the whole deploy (measured on 2026-08-07).
- The bucket cap, if many sites need uploads.
- Visitors are signed out when their cookies move from `/api/db/<slug>/` to
  the site's host. This is acceptable, since old sites are ignored.

**Rollback:** each step is a revert.
- Steps 5 and 6: put the `*/*` route back on the platform, which keeps its
  serving code until step 9.
- Step 2: re-upload with the previous metadata.
- Step 7: restore `JOB_ENV_NAMES`.

**Cost** (Cloudflare's current prices still to be confirmed with the owner):
- **The plan.** Workers for Platforms is a paid plan: a base fee that includes
  some scripts and requests, then a price per extra million requests and per
  extra script.
- **Invocations.** Each visit becomes the front door plus the site's Worker,
  plus the outbound Worker for each subrequest. That is about 2–3
  invocations, against about 1 today plus one for each asset. Today
  `run_worker_first` already runs the platform on every asset, so bundling
  assets with the site may *reduce* the count.
- **Custom hostnames:** unchanged (Cloudflare for SaaS, 100 included).
- **The tail Worker:** its invocations grow with the volume of logs.

## 6. Open questions for the owner

1. Files: do you agree to bundled assets plus a bucket of a site's own, made
   only when the site needs uploads? Or do you prefer one shared bucket behind
   a files service binding?
2. Per-site CPU and subrequest limits: what numbers, and do they differ by
   plan?
3. The outbound allow-list: known providers only, or may an owner's declared
   integrations add hosts?
4. Scheduled jobs: cron triggers on each script (if the namespace allows
   them), or the platform tick pinging each site?
5. Old sites: which do we drop and which do we rebuild? May the `/s/<slug>`
   addresses and `/api/stripe/site/<slug>` simply stop?
6. Backups: keep them on the platform with the owner login, or use the
   limited login (it reads rows but not the schema)?
7. Confirm the Workers for Platforms plan and its current price before step 2.
8. Previews: keep the draft-token host, or show previews only inside the
   editor on `gofarther.dev`?
