# Each site's own bucket (2026-10-27)

The site Worker split, first build step ("seal each site"), on the owner's word
"ok go" and their Q1 answer (B: one R2 bucket per site). Branch
`claude/nice-ramanujan-9ry8wy`, from `main` `8f29c37d3`. Not merged, not
deployed. Behind a switch that is off.

## The hole

Every site Worker was uploaded bound to the whole shared bucket `isibi-sites`
(`builder/site-dispatch.mjs`, the `SITES` binding). A site's code could read any
other site's files, every owner's source and every job record.

## What changed

- `builder/site-bucket.mjs` (new): the bucket name (`gfs-<slug>`, a hash when
  too long), which keys a site may read (its builds' `client/**` and
  `state/sidecar.json`, `sitemeta/<slug>.json`, `sites/<slug>/site.live`), the
  sync from the shared bucket (missing build files copied, trimmed builds
  removed, head files copied when their etags differ and removed when the
  shared bucket has none, the live marker always last, a budget), and the
  Cloudflare REST calls (create bucket, list, put, delete object).
- `worker.js`:
  - `sealedBucketFor`: with `SITE_OWN_BUCKETS=1`, create the bucket, sync, and
    upload the script bound to it. Off, or any failure or unfinished copy, binds
    the shared bucket as before, so a site is never left without its files.
  - `ownBucketMarker`: Take offline removes the own bucket's marker FIRST and
    refuses (503, nothing changed) if it cannot; Back online syncs after the
    shared marker; the five panel writes of the site's details sync after.
  - The four activations pass `afterLive`, so a first publish's marker reaches
    the own bucket.
- `site-builds.mjs`: `activateBuild` takes `afterLive`, called after the shared
  marker stands, never fatal.
- The site template is unchanged: same keys, same `SITES` binding name.

## Tests

`test/site-bucket.test.mjs`, 11 cases (names, key filter, sync, offline,
budget and failure, REST, the wiring guards). Full suite: see the commit.

## Owed before it can be switched on

1. The Cloudflare API token needs **R2 edit** (create buckets, write objects).
2. Set `SITE_OWN_BUCKETS=1` only on a rehearsal first (the staging namespace in
   the backlog), publish a throwaway site, and check its script's bindings list
   only `gfs-<slug>`, its pages and assets load, and Take offline / Back online
   work.
3. Not done yet (backlog): deleting a site does not delete its bucket; no tick
   re-syncs a site whose copy failed (the next publish, panel save or Back
   online does); previews (`--draft-`) still sync through the same path.
