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
# NO `prerender-child.mjs` AND NO `site-worker/` ANY MORE. Both were spawned or
# read off disk rather than imported, so the import walk could not see either and
# each carried its own hand-written assertion. TanStack Start removed the need
# for both: the document is rendered per REQUEST by the site's own script, which
# Start's build produces, so there is no build-time snapshot to render in a
# subprocess and no entry to stage into the template.
COPY build-server.mjs exit-reason.mjs site-addon.mjs site-fonts.mjs font-index.json site-theme.mjs site-theme-registry.mjs site-tokens.mjs site-style.mjs site-identity.mjs site-langs.mjs render-check.mjs site-render.mjs site-worker.mjs ./
COPY theme-candidates/ ./theme-candidates/

# NOTHING IN THIS IMAGE EXECUTES MODEL-WRITTEN CODE ANY MORE, which is why the
# `PRERENDER_USER=node` privilege drop went with the prerender.
#
# It existed because the prerender `import()`ed the generated SSR bundle and
# CALLED it, so a hostile brief's code ran with the build service's privileges,
# in the loop that answers /health, in a container shared by every customer.
# Dropping the render to an unprivileged uid meant it could read the bundle and
# node_modules and write nothing.
#
# Under Start that code is COMPILED here and RUN in the customer's own Worker —
# a separate isolate on Cloudflare's side, which is a stronger boundary than a
# uid in a shared container ever was. The container still runs `vite` and `tsc`
# over that source, exactly as it did before the prerender existed.
#
# THE ONE THING THAT STILL DRIVES IT IS THE RENDER CHECK, and it is not the same
# exposure: it loads the server bundle to answer a browser, and the browser runs
# the CLIENT half. `render-check.mjs` reports whether that browser is sandboxed
# rather than assuming it, and running this service as non-root is the real fix
# there — which is a change to this file, not to that one.

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
