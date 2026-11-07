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
    git build-essential python3 python3-pip python3-venv curl ca-certificates openssl iptables \
    ripgrep jq unzip zip less procps
# The package lists stay (owner, 2026-11-06, "1"): Coder checks a package's name
# with apt-cache before it proposes it for the setup script, whose plain
# `apt-get install` lines Coder's service runs as root (it updates them first).

# Projects live in /work, one folder each. Each project's folder belongs to `dev`:
# the unprivileged user the AI's commands run as, so they can never read the
# GitHub token git uses (it is only in the environment of git processes this
# service runs as root). /work itself belongs to root (755), and the service
# makes each project's folder and hands only that folder to `dev`, so the AI's
# commands can never rename a project's folder or put a link in its place,
# which root's git would follow (the audit, 2026-11-06).
RUN useradd -m -u 1001 dev && mkdir -p /work && chown root:root /work && chmod 755 /work \
 && mkdir -p /srv/coder-git /srv/coder-memory /srv/coder-bg /srv/coder-setup && chmod 755 /srv/coder-git /srv/coder-memory /srv/coder-bg /srv/coder-setup \
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
COPY package.json server.mjs coder-agent.mjs coder-model.mjs coder-checks.mjs coder-tools.mjs coder-lsp.mjs coder-proxy.mjs coder-secrets.mjs coder-auth.mjs ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
