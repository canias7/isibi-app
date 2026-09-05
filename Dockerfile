# isibi SITE build-service. Clone of builder-game/Dockerfile with the React
# template swapped in for kaplay.
#
# AT THE REPOSITORY ROOT SINCE 2026-09-04, so the build context is the whole
# repository: this image carries the Worker's own module graph as the job
# runtime (the `worker/` tree at the bottom), and that graph spans builder/,
# builder-game/ and the root modules — a context rooted at builder/ cannot
# reach above itself. Every COPY source below is therefore root-relative
# (`builder/…`), and wrangler.jsonc names this file as `./Dockerfile`, whose
# directory is the context for a hand `wrangler deploy` and for the CI image
# step alike. The game image is untouched next door.
#
# Deps are baked at image-build time so each per-site build is just
# `tsr generate` → `tsc --noEmit` → `vite build`, which is ~20s rather than ~90s.
FROM node:22-slim

# Chromium, for the render check (1.t). This header used to say "no headless
# browser — a site is checked by `tsc --noEmit`, not by a runtime smoke test",
# and that was the largest gap in the whole build path: EVERY visual failure this
# platform has recorded — grey charts, 404'd images, invisible body copy, a
# see-through modal — compiled, bundled, published and was found by a human
# looking at a screen. A compile pass proves the code is valid, not that anybody
# can read the page.
#
# The DISTRO browser driven by playwright-core, exactly as ../builder-game does,
# rather than Playwright's own download: smaller image, and the pattern is
# already proven next door.
# `fonts-liberation` + `fonts-noto-core` ARE LOAD-BEARING, not polish: the
# share card (site-card.mjs) is a SCREENSHOT of text, and `--no-install-
# recommends` above means chromium arrives with NO font files at all — every
# glyph renders as tofu, in a failure the harness cannot see because it runs
# build-server outside this image. The render check never needed a font FILE
# (it reads text content and geometry, not glyph pixels), which is why this
# was absent for as long as nothing here drew type. Noto core is the
# non-Latin floor (a Greek or Arabic business name must not tofu — the
# initials-mark rule, one artwork over); CJK is a known, stated gap.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation fonts-noto-core \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# The fixed toolchain: React 19, Tailwind v4, TanStack Router/Query, react-hook-form,
# zod, and the 46 shadcn components' dependencies. npm ci runs BEFORE NODE_ENV is set
# to production below, so the devDependencies the build needs (typescript, vite,
# @vitejs/plugin-react) are actually installed.
COPY builder/lovable/template/package.json builder/lovable/template/package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

# THE BUILD SERVICE'S OWN DEPENDENCY, NOT THE TEMPLATE'S. `--no-save` keeps it
# out of package.json and the lock file, which matters twice: `npm ci` above
# refuses to run against a lock that disagrees with package.json, and a published
# customer site must never carry a browser driver in its dependency tree.
# AFTER `npm ci`, never before — ci wipes node_modules.
RUN npm install --no-save --no-audit --no-fund --loglevel=error playwright-core@^1.47.0

# The template itself — the shadcn UI, the app shell, the design system, and
# src/lib/rows.ts (the only way a generated page is allowed to reach the API).
COPY builder/lovable/template/ ./

# A pristine src/routes, restored before every build. Only the root layout: the
# template's own routes are the REFERENCE pages, written against a barber shop's
# schema, and leaving them in place would publish them to any site whose
# generator failed to produce that page.
#
# ALL of them are stripped, not just index.tsx. There were four as of
# 2026-08-01 — index, book, manage, account — and removing one by name would
# have shipped a stranger's booking page to every site that did not build one.
# `find` rather than a list, so adding a fifth needs no change here.
#
# NO `.index-base.html` ANY MORE. It was the pristine shell `writeIndexHtml`
# patched per build — and under TanStack Start there is no shell: the document
# is `src/routes/__root.tsx`, rendered per request, and a clean build emits no
# top-level `index.html` at all. The title, language and mark it used to inject
# with a regex are `src/site-brand.ts` now, which `writeSiteBrand` rewrites every
# build like any other generated module.
#
# THE `&&` CHAIN IS WHY THIS HAD TO MOVE IN THE SAME COMMIT as the template: a
# `cp` of a file that no longer exists fails the whole RUN, so the image would
# simply stop building.
RUN mkdir -p /app/.routes-base \
    && cp src/routes/__root.tsx /app/.routes-base/ \
    && cp src/styles.css /app/.styles-base.css \
    && find src/routes -maxdepth 1 -name '*.tsx' ! -name '__root.tsx' -delete

# EVERYTHING build-server.mjs IMPORTS, TRANSITIVELY. A missing one is not a
# degraded build — node throws ERR_MODULE_NOT_FOUND on startup, the process
# exits, nothing ever listens on 8080, and Cloudflare reports it as "Failed to
# start container: There has been an internal error connecting to the port" or
# "The container is not running". Two messages, one cause, which is why it read
# as flaky infrastructure for a day.
#
# That is exactly what the previous version of this comment warned about for
# site-fonts.mjs — and then `themeCss` was imported without anything being added
# here. `test/dockerfile.test.mjs` walks the imports from build-server.mjs and
# fails if one is not copied, so the warning is enforced rather than written
# down.
#
# THE OTHER DIRECTION BIT TOO, AND IT IS WORSE. `COPY theme-candidates/` outlived
# the directory by one commit: the 500 hand-written themes moved to
# `test/fixtures/themes/` when the registry stopped being a product feature, and
# a COPY naming a path that is not in the build context does not degrade — buildx
# fails to compute a checksum, the image never builds, and THE WHOLE DEPLOY
# FAILS. Measured 2026-08-20: the Worker did not ship. The import walk cannot see
# it (nothing imports a directory that is gone), so the guard that catches it is
# the one below it — every path a COPY names must exist on disk.
# NO `site-worker/` ANY MORE — it was read off disk rather than imported, so the
# import walk could not see it and it carried its own hand-written assertion.
# TanStack Start removed the need for it: the document is rendered per REQUEST by
# the site's own script, which Start's build produces, so there is no entry to
# stage into the template.
#
# `render-server-child.mjs` IS SPAWNED, NOT IMPORTED, so the import walk cannot
# see it either — and a missing COPY here would not fail that walk. It would fail
# every build's render check at runtime with MODULE_NOT_FOUND, and since the
# check is best-effort by design the build would SUCCEED with the boundary
# silently gone. `test/dockerfile.test.mjs` names it explicitly for that reason.
# `site-qr-list.mjs` (2026-09-03) is the dependency-free half of the QR module —
# the names, the files, the list — imported by the build server to name each
# code's file. The unit suite's import walk caught it missing from this line the
# same hour it was written: a module the container imports and the image does
# not carry is a service that never starts, and nothing else would have said so
# before the first build after the deploy.
# `container-job.mjs`, `container-env.mjs` and `job-gateway.mjs` (2026-09-04)
# are the job runner's launch reader and its dependencies, imported by the
# build server to check a launch before it spawns the runner.
COPY builder/build-server.mjs builder/build-keys.mjs builder/build-call.mjs builder/model-xai.mjs builder/exit-reason.mjs builder/run-step.mjs builder/site-ssr.mjs builder/render-server-child.mjs builder/site-addon.mjs builder/site-fonts.mjs builder/font-index.json builder/site-theme.mjs builder/site-theme-registry.mjs builder/site-seeds.mjs builder/site-tokens.mjs builder/site-css.mjs builder/site-freecss.mjs builder/site-authored.mjs builder/site-style.mjs builder/site-identity.mjs builder/site-favicon.mjs builder/site-qr-list.mjs builder/site-card.mjs builder/site-langs.mjs builder/render-check.mjs builder/site-render.mjs builder/site-worker.mjs builder/container-job.mjs builder/container-env.mjs builder/job-gateway.mjs ./
# THE 500 THEMES ARE BACK IN THE PRODUCT (2026-08-27, owner's call) and the
# registry imports them as a DIRECTORY, which the single-file COPY above cannot
# carry. This is the exact line whose ghost the comment above records outliving
# the directory in the other direction; the import walk in
# test/dockerfile.test.mjs sees `./theme-candidates/batch-1.mjs` et al through
# site-theme-registry.mjs, so a deleted directory fails a test before it fails
# the deploy this time.
COPY builder/theme-candidates/ ./theme-candidates/

# ── THE WORKER'S OWN MODULE, AS THE JOB RUNTIME (2026-09-04) ─────────────────
#
# Owner: "that stuff gotta run on container". A queued edit or addon now runs
# INSIDE this container: build-server.mjs's `/job/run` spawns
# worker/builder/container-job.mjs, which imports worker/worker.js under the
# loader in worker/builder/worker-loader.mjs and executes the same consumer
# function the Worker's queue handler executes. So the image carries the
# Worker's whole module graph, laid out exactly as the repository is — every
# relative import in it has to resolve — and its runtime dependencies from
# the ROOT lockfile, installed once here.
#
# THE LIST IS DERIVED AND ENFORCED, never remembered: test/dockerfile.test.mjs
# walks the imports from container-job.mjs and fails on a module this tree
# does not carry, and names the loader's own four files by hand, since
# nothing imports them (the same reason render-server-child.mjs is named
# above). A module the job imports and the tree lacks is a job that dies at
# import — inside the container, with the consumer already gone: the Worker
# runs a job itself only when the container REFUSES the launch. So the build
# server also imports this tree once at startup and refuses every launch
# while it does not import, which turns that death into the inline path.
COPY package.json package-lock.json ./worker/
RUN cd worker && npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
COPY worker.js billing.mjs rate-limit.mjs request-limits.mjs site-access.mjs site-apis.mjs site-backup.mjs site-config.mjs site-cookie.mjs site-csv.mjs site-db.mjs site-dns.mjs site-domain-connect.mjs site-domains.mjs site-errors.mjs site-export.mjs site-idem.mjs site-inbound.mjs site-jobs.mjs site-live.mjs site-mail.mjs site-meta.mjs site-notify.mjs site-owner.mjs site-payments.mjs site-provision.mjs site-rebuild.mjs site-registrar.mjs site-rls.mjs site-routing.mjs site-schema.mjs site-secrets.mjs site-seo.mjs site-sms.mjs site-ssrf.mjs site-sweep.mjs site-teardown.mjs site-turnstile.mjs site-uploads.mjs site-versions.mjs site-builds.mjs site-webhook-queue.mjs site-webhooks.mjs stripe-webhook.mjs ttl-cache.mjs worker-finance.mjs ./worker/
COPY builder/build-budget.mjs builder/build-call.mjs builder/build-job.mjs builder/build-lane.mjs builder/build-lease.mjs builder/build-models.mjs builder/build-record.mjs builder/build-resume.mjs builder/chart-api.mjs builder/chart-usage.mjs builder/component-api.mjs builder/container-env.mjs builder/container-hold.mjs builder/container-job.mjs builder/container-room.mjs builder/edit-job.mjs builder/edit-trace.mjs builder/font-index.json builder/job-gateway.mjs builder/model-xai.mjs builder/page-gen.mjs builder/publish-pages.mjs builder/site-add.mjs builder/site-addon.mjs builder/site-alias.mjs builder/site-apply.mjs builder/site-ask.mjs builder/site-authored.mjs builder/site-context.mjs builder/site-css.mjs builder/site-dispatch.mjs builder/site-edit.mjs builder/site-favicon.mjs builder/site-fonts.mjs builder/site-freecss.mjs builder/site-identity.mjs builder/site-images.mjs builder/site-lanes.mjs builder/site-langs.mjs builder/site-logo.mjs builder/site-nav.mjs builder/site-order.mjs builder/site-picture.mjs builder/site-plan.mjs builder/site-qr-list.mjs builder/site-qr.mjs builder/site-render.mjs builder/site-repair.mjs builder/site-rules.mjs builder/site-seed.mjs builder/site-seeds.mjs builder/site-style.mjs builder/site-table.mjs builder/site-text.mjs builder/site-theme-registry.mjs builder/site-theme.mjs builder/site-tokens.mjs builder/site-translate.mjs builder/site-tweak.mjs builder/site-verify.mjs builder/site-worker.mjs builder/trace.mjs builder/ui-components.mjs builder/worker-loader.mjs builder/worker-register.mjs builder/cloudflare-shim.mjs builder/containers-shim.mjs ./worker/builder/
COPY builder/theme-candidates/ ./worker/builder/theme-candidates/
COPY builder-game/game-gen.mjs ./worker/builder-game/

# THIS IMAGE DOES EXECUTE MODEL-WRITTEN CODE, AND THIS COMMENT USED TO DENY IT.
#
# It read "NOTHING IN THIS IMAGE EXECUTES MODEL-WRITTEN CODE ANY MORE, which is
# why the `PRERENDER_USER=node` privilege drop went with the prerender" — and
# then said four paragraphs later that the render check still drives the server
# bundle. Both cannot be true. The second one was: `dist/server/server.js` IS the
# model's `src/routes/*.tsx`, and the check was `import()`ing it into the build
# service's own process and calling it per request, as root, with no timeout —
# `STEP_TIMEOUT` only ever applied to subprocesses. A `while (true)` in a
# component blocks the event loop that answers /health and drives `oneAtATime`,
# so one customer's brief could hang every build on the platform until Cloudflare
# recycled the instance.
#
# THE DROP IS BACK, against `render-server-child.mjs` — a spawned, SIGKILL-able,
# uid-dropped child that WRITES NOTHING. That last property is what makes the
# drop possible at all: the parent does every write there is, so the child needs
# no write access anywhere.
#
# `node` IS THE USER, uid 1000 in the node:22-slim base, and `RENDER_USER`
# overrides it. `site-ssr.mjs` resolves it out of /etc/passwd and answers null
# when it cannot — a developer's machine, a CI runner, an image that already runs
# unprivileged — and the build response then carries `ssrUnprivileged: false`, so
# a drop that silently did not happen is visible rather than assumed.
#
# WHAT IS STILL NOT CONFINED, stated rather than left to be discovered: the
# render check launches Chromium as root and that browser runs the model's CLIENT
# bundle. `render-check.mjs` reports it (`sandboxed: false`) rather than claiming
# otherwise. The real fix is running this whole service as a non-root user, which
# needs `/app` to be owned by that user — a change to this file, not to that one,
# and one that cannot be verified without building the image.

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
