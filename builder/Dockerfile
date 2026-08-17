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
# site-fonts.mjs — and then `themeCss` and `resolveTheme` were imported without
# anything being added here. `test/dockerfile.test.mjs` walks the imports from
# build-server.mjs and fails if one is not copied, so the warning is enforced
# rather than written down.
# `prerender-child.mjs` IS SPAWNED, NOT IMPORTED, so the import walk in
# test/dockerfile.test.mjs cannot see it — a missing COPY here would not fail
# that guard, it would fail every build's prerender at runtime with MODULE_NOT_FOUND
# and publish every site with the home page's snapshot at every address. It has
# its own assertion in that file for exactly that reason.
COPY build-server.mjs prerender-child.mjs exit-reason.mjs site-addon.mjs site-fonts.mjs font-index.json site-theme.mjs site-theme-registry.mjs site-tokens.mjs site-style.mjs site-identity.mjs render-check.mjs site-render.mjs site-worker.mjs ./
COPY theme-candidates/ ./theme-candidates/
# `site-worker/entry.js` IS COPIED INTO THE TEMPLATE, NOT IMPORTED — the same
# blind spot as `prerender-child.mjs` one line up, and with the same shape of
# failure. `packageWorker` reads it off disk and writes it into `src/` for vite
# to bundle, so the import walk cannot see it; a missing COPY would leave the
# packaging step returning "could not stage the worker entry" on every build
# that asked for one, which is a feature that silently never works rather than
# a service that fails to start. It has its own assertion for that reason.
COPY site-worker/ ./site-worker/

# WHO THE PRERENDER RUNS AS. `node:22-slim` ships an unprivileged `node` user
# (uid 1000) and everything in /app is copied as root, so a render dropped to it
# can READ the bundle and node_modules and WRITE NOTHING — which is the whole
# protection, since the child is handed model-written code and this container is
# long-lived and shared by every customer on the platform.
#
# The image is NOT switched to that user with `USER`: the build service itself
# writes src/routes, dist and the generated tree on every build, and dropping the
# whole process would break all of it. Root is what makes the per-render drop
# possible at all — only root can hand a subprocess a different uid.
#
# Asserted rather than assumed: test/dockerfile.test.mjs requires this file to
# name a user, and build-server.mjs reports `prerenderUnprivileged` on every
# build, because "we thought this was sandboxed" is worse than knowing it is not.
ENV PRERENDER_USER=node

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
