# isibi SITE build-service. Clone of ../builder-game/Dockerfile with the React
# template swapped in for kaplay and no headless browser — a site is checked by
# `tsc --noEmit`, not by a runtime smoke test.
#
# Deps are baked at image-build time so each per-site build is just
# `tsr generate` → `tsc --noEmit` → `vite build`, which is ~20s rather than ~90s.
FROM node:22-slim

WORKDIR /app

# The fixed toolchain: React 19, Tailwind v4, TanStack Router/Query, react-hook-form,
# zod, and the 46 shadcn components' dependencies. npm ci runs BEFORE NODE_ENV is set
# to production below, so the devDependencies the build needs (typescript, vite,
# @vitejs/plugin-react) are actually installed.
COPY lovable/template/package.json lovable/template/package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

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
RUN mkdir -p /app/.routes-base \
    && cp src/routes/__root.tsx /app/.routes-base/ \
    && cp index.html /app/.index-base.html \
    && cp src/styles.css /app/.styles-base.css \
    && find src/routes -maxdepth 1 -name '*.tsx' ! -name '__root.tsx' -delete

# site-fonts.mjs and its index are imported BY build-server.mjs, so a missing one
# is not a degraded build — the service fails to start at all.
COPY build-server.mjs site-fonts.mjs font-index.json ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
