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
# template's own index.tsx is the REFERENCE page, written against a barber shop's
# schema, and leaving it in place would publish it to any site whose generator
# failed to produce a home page.
RUN mkdir -p /app/.routes-base \
    && cp src/routes/__root.tsx /app/.routes-base/ \
    && cp index.html /app/.index-base.html \
    && rm -f src/routes/index.tsx

COPY build-server.mjs ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
