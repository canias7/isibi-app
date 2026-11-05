# CODER'S CONTAINER (2026-11-05, owner: "same style as the sites agent, but with
# a different container"). Its own image and class (`CoderContainer`), apart
# from the website builder's: a general developer machine where Coder runs
# commands on any code project.
#
# The context is this directory (wrangler.jsonc names `./coder/Dockerfile`).
FROM node:22-bookworm

# What a developer usually reaches for: git, a compiler toolchain, Python, and
# the everyday command-line tools Coder uses to look around.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential python3 python3-pip python3-venv curl ca-certificates \
    ripgrep jq unzip zip less procps \
  && rm -rf /var/lib/apt/lists/*

# Projects live here, one folder each.
RUN mkdir -p /work
WORKDIR /app

# OUR OWN CODE LAST: small and changes often.
COPY package.json server.mjs coder-agent.mjs coder-model.mjs coder-checks.mjs ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
