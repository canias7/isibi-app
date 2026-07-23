# isibi React build-service. Deps are baked in at image-build time so each
# per-site build is just `vite build` (~1-2s), not an npm install (~15s).
FROM node:22-slim

WORKDIR /app

# Bake the fixed toolchain + component deps into the image layer.
COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# Chromium for the vision-critique render (/critique). --with-deps pulls the system libs. Baked into the image so
# no per-build download. If this layer is ever removed, /critique degrades to a no-op (the build service still runs).
RUN npx playwright install --with-deps chromium

# A default template so `vite build` always has a valid project shape; the
# generated source overwrites index.html + src/** + configs per request.
COPY template/ ./
COPY build-server.mjs ./
COPY vision-render.mjs ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "build-server.mjs"]
