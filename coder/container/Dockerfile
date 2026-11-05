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

# Projects live here, one folder each, owned by `dev`: the unprivileged user the
# AI's commands run as, so they can never read the GitHub token git uses (it is
# only in the environment of git processes this service runs as root).
RUN useradd -m -u 1001 dev && mkdir -p /work && chown dev:dev /work \
 && mkdir -p /srv/coder-git /srv/coder-memory /srv/coder-bg && chmod 755 /srv/coder-git /srv/coder-memory /srv/coder-bg \
 && git config --system --add safe.directory '*'
# The git folders, the memory files and the background logs live under /srv,
# which belongs to root: the AI's commands (as `dev`) may read them but cannot
# swap them, so root's git and file reads cannot be tricked (the audit, 2026-11-05).
# `dev`'s own git may read the root-owned history (safe.directory); our git, as
# root, ignores that system setting (GIT_CONFIG_NOSYSTEM) and checks ownership.
# LANGUAGE SERVERS for the lsp tool (owner, 2026-11-05): TypeScript/JavaScript and Python.
# TypeScript 5: version 7 no longer has the tsserver the language server needs.
RUN npm install -g --no-fund --no-audit typescript@5 typescript-language-server pyright \
 && npm cache clean --force
ENV CODER_RUN_UID=1001 CODER_RUN_GID=1001
WORKDIR /app

# OUR OWN CODE LAST: small and changes often.
COPY package.json server.mjs coder-agent.mjs coder-model.mjs coder-checks.mjs coder-tools.mjs coder-lsp.mjs ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
