# Build service for the Lovable-clone stack. Deps are baked in at image-build time so each per-site
# build is `tsr generate && vite build` (a couple of seconds), not an npm install.
#
# Deliberately SEPARATE from builder/Dockerfile. The two stacks cannot share an image: this one is
# React 19 + Tailwind v4 + TanStack Router, the original is React 18 + Tailwind v3 + react-router.
FROM node:22-slim

WORKDIR /app

# npm resolves an optional peer of @hookform/resolvers differently than the bun lockfile Lovable
# ships, hence --legacy-peer-deps. Same package set either way.
COPY template/package.json ./package.json
RUN npm install --no-audit --no-fund --legacy-peer-deps --loglevel=error

# Chromium for the runtime smoke check. Best-effort: the `||` means a download hiccup can never
# fail the image build — the service still serves /build, and the check reports itself skipped.
RUN npx playwright install --with-deps chromium || echo "WARN chromium unavailable, smoke check will report skipped"

# The template: 46 shadcn components, the theme, the data client, the router entry.
COPY template/ ./

# A pristine copy of src/ and public/. Every build wipes both so one site's files cannot leak into
# the next — which would otherwise delete the component library along with them, and would publish
# one customer's sitemap.xml under another customer's domain. The service restores from here before
# writing the generated files.
RUN cp -a /app/src /app/.template-src && cp -a /app/public /app/.template-public

# routeTree.gen.ts is derived and gitignored, so it is absent here. The service runs `tsr generate`
# before every build; this warms the first one and proves at image-build time that the toolchain
# works, rather than discovering it on a customer's build.
RUN npx tsr generate && npx vite build && rm -rf /app/dist

COPY build-server.mjs ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
