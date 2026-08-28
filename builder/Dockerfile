# isibi SITE build-service. Clone of ../builder-game/Dockerfile with the React
# template swapped in for kaplay.
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
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
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
COPY lovable/template/package.json lovable/template/package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

# THE BUILD SERVICE'S OWN DEPENDENCY, NOT THE TEMPLATE'S. `--no-save` keeps it
# out of package.json and the lock file, which matters twice: `npm ci` above
# refuses to run against a lock that disagrees with package.json, and a published
# customer site must never carry a browser driver in its dependency tree.
# AFTER `npm ci`, never before — ci wipes node_modules.
RUN npm install --no-save --no-audit --no-fund --loglevel=error playwright-core@^1.47.0

# The template itself — the shadcn UI, the app shell, the design system, and
# src/lib/rows.ts (the only way a generated page is allowed to reach the API).
COPY lovable/template/ ./

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
COPY build-server.mjs build-keys.mjs build-call.mjs model-xai.mjs exit-reason.mjs run-step.mjs site-ssr.mjs render-server-child.mjs site-addon.mjs site-fonts.mjs font-index.json site-theme.mjs site-theme-registry.mjs site-seeds.mjs site-tokens.mjs site-css.mjs site-freecss.mjs site-authored.mjs site-style.mjs site-identity.mjs site-favicon.mjs site-langs.mjs render-check.mjs site-render.mjs site-worker.mjs ./
# THE 500 THEMES ARE BACK IN THE PRODUCT (2026-08-27, owner's call) and the
# registry imports them as a DIRECTORY, which the single-file COPY above cannot
# carry. This is the exact line whose ghost the comment above records outliving
# the directory in the other direction; the import walk in
# test/dockerfile.test.mjs sees `./theme-candidates/batch-1.mjs` et al through
# site-theme-registry.mjs, so a deleted directory fails a test before it fails
# the deploy this time.
COPY theme-candidates/ ./theme-candidates/

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
