# isibi React build-service. Deps are baked in at image-build time so each
# per-site build is just `vite build` (~1-2s), not an npm install (~15s).
FROM node:22-slim

WORKDIR /app

# Bake the fixed toolchain + component deps into the image layer.
COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# Chromium for the vision-critique render (/critique). --with-deps pulls the system libs. BEST-EFFORT: the `|| true`
# means a Chromium install hiccup (apt/network) can NEVER fail the image build — the build service still starts and
# serves /build; only /critique (vision, opt-in) degrades to a no-op. So this layer can't cause a build outage.
RUN npx playwright install --with-deps chromium || echo "WARN: chromium install failed; /critique will no-op"

# A default template so `vite build` always has a valid project shape; the
# generated source overwrites index.html + src/** + configs per request.
COPY template/ ./
COPY build-server.mjs ./
COPY vision-render.mjs ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
