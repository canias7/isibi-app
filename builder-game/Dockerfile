# isibi GAME build-service. Forks ../builder/Dockerfile with kaplay swapped in for
# React + a headless Chromium baked in for the Phase-4 runtime smoke test.
# Deps are baked at image-build time so each per-game build is just `vite build`.
FROM node:22-slim

# Chromium runtime libs for the smoke test (playwright-core drives the system browser).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bake the fixed toolchain (kaplay + vite + playwright-core) into the image layer.
COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# The smoke harness drives the distro Chromium instead of downloading one.
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# A default template so `vite build` always has a valid project; generated source
# overwrites index.html + src/** per request.
COPY template/ ./
# Curated CC0 3D model pack (Phase 7 increment 3). Baked OUTSIDE public/ so 2D and
# primitive-3D games aren't bloated — the build-service copies only the models a
# given game references into public/models/ before `vite build`.
COPY models/ ./modelpack/
COPY build-server.mjs smoke.mjs ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
