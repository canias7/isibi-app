# CODER'S CONTAINER (2026-11-05, owner: "same style as the sites agent, but with
# a different container"). Its own image and class (`CoderContainer`), apart
# from the website builder's: a general developer machine where Coder runs
# commands on any code project.
#
# THE SAME SYSTEM AND TOOLS AS CLAUDE CODE'S MACHINE (owner, 2026-11-07: "can we
# install all the tools we need?"): Ubuntu 24.04 on x86_64. Two images come
# from this file:
#   core  (the default) what Coder itself needs: git, a compiler, Python,
#         Node 22 and the language servers. Cloudflare's backup machines use it
#         (their limits: 8 GB an image, 50 GB for all the images kept).
#   full  (`--build-arg CODER_IMAGE=full`) core plus the tools Claude Code's
#         machine comes with (its docs' "Installed tools", and its machine
#         itself, read 2026-11-07). Coder's machines on Fly.io use it.
# Every tool belongs to root. Coder's commands run as `dev` and install their
# own things in dev's home (cleanEnv in coder-checks.mjs), and no folder `dev`
# can write to is ever on root's PATH.
#
# The context is this directory (wrangler.jsonc names `./container/Dockerfile`).
ARG CODER_IMAGE=core

FROM ubuntu:24.04 AS core
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8

# What a developer usually reaches for: git, a compiler toolchain, Python, and
# the everyday command-line tools Coder uses to look around.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential python3 python3-pip python3-venv curl ca-certificates openssl iptables \
    ripgrep jq unzip zip less procps xz-utils gnupg
# The package lists stay (owner, 2026-11-06, "1"): Coder checks a package's name
# with apt-cache before it proposes it for the setup script, whose plain
# `apt-get install` lines Coder's service runs as root (it updates them first).

# NODE 22 where Claude Code's machine keeps it (/opt/node22, on the PATH), from
# nodejs.org, checked against its published sums. Coder's own service runs on
# it, so it belongs to root.
RUN set -eu; cd /tmp; base=https://nodejs.org/dist/latest-v22.x; \
    curl -fsSL --retry 5 --retry-delay 3 "$base/SHASUMS256.txt" -o SHASUMS256.txt; \
    f=$(awk '$2 ~ /^node-v[0-9.]+-linux-x64\.tar\.xz$/ {print $2}' SHASUMS256.txt); \
    curl -fsSLO --retry 5 --retry-delay 3 "$base/$f"; grep " $f\$" SHASUMS256.txt | sha256sum -c -; \
    mkdir -p /opt/node22; tar -xJf "$f" -C /opt/node22 --strip-components=1; rm -f "$f" SHASUMS256.txt
ENV PATH=/opt/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

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

# ── RUBY 3.1, 3.2 AND 3.3, the versions Claude Code's machine has, each built
# from ruby-lang.org's source (checked against its sum) in its own step, side by side.
FROM core AS ruby-build
RUN apt-get install -y --no-install-recommends autoconf libssl-dev libyaml-dev libreadline-dev zlib1g-dev libgmp-dev libncurses-dev libffi-dev libgdbm-dev
COPY --chmod=0755 tools/build-ruby /usr/local/bin/build-ruby
FROM ruby-build AS ruby31
RUN build-ruby 3.1.6 0d0dafb859e76763432571a3109d1537d976266be3083445651dc68deed25c22
FROM ruby-build AS ruby32
RUN build-ruby 3.2.6 d9cb65ecdf3f18669639f2638b63379ed6fbb17d93ae4e726d4eb2bf68a48370
FROM ruby-build AS ruby33
RUN build-ruby 3.3.6 8dc48fffaf270f86f1019053f28e51e4da4cce32a36760a0603a9aee67d7fd8d

# ── FULL: Claude Code's tools ────────────────────────────────────────────────
FROM core AS full
ENV CODER_IMAGE=full

# Ubuntu's own packages, the versions Claude Code's machine has: C and C++
# (clang 18, cmake, ninja), PHP 8.3, Java 21, PostgreSQL 16, Redis 7, rbenv, the
# libraries native extensions build against, Chrome's libraries, everyday tools,
# and what Docker needs to run without admin rights (uidmap, slirp4netns).
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang cmake ninja-build pkg-config gdb python3-dev \
    libssl-dev zlib1g-dev libffi-dev libyaml-dev libreadline-dev libgdbm-dev libncurses-dev libgmp-dev \
    libsqlite3-dev libpq-dev libxml2-dev libxslt1-dev libbz2-dev liblzma-dev \
    php-cli php-curl php-mbstring php-xml php-zip php-intl php-sqlite3 php-pgsql php-mysql php-bcmath php-gd \
    openjdk-21-jdk-headless \
    postgresql postgresql-contrib redis-server \
    rbenv git-lfs tmux vim nano file tree wget rsync sqlite3 sudo \
    uidmap slirp4netns fuse-overlayfs iproute2 e2fsprogs \
    fonts-liberation libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libcairo2 libcups2t64 libdbus-1-3 \
    libdrm2 libgbm1 libglib2.0-0t64 libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 libvulkan1 \
    libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils

# Docker (with Compose, Buildx and the engine that runs without admin rights)
# and GitHub's gh, from their makers' own package lists. Those lists are taken
# out again afterwards, so the setup script's `apt-get update` only asks Ubuntu.
RUN set -eu; install -m 0755 -d /etc/apt/keyrings; \
    curl -fsSL --retry 5 --retry-delay 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc; \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list; \
    curl -fsSL --retry 5 --retry-delay 3 https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli.gpg; \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/githubcli.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras gh; \
    rm -f /etc/apt/sources.list.d/docker.list /etc/apt/sources.list.d/github-cli.list; apt-get update

# Node 24 beside 22 (Claude Code's machine has both), nvm for any other version
# (`. /opt/nvm/nvm.sh && nvm install 20`), and the JavaScript tools.
RUN set -eu; cd /tmp; base=https://nodejs.org/dist/latest-v24.x; \
    curl -fsSL --retry 5 --retry-delay 3 "$base/SHASUMS256.txt" -o SHASUMS256.txt; \
    f=$(awk '$2 ~ /^node-v[0-9.]+-linux-x64\.tar\.xz$/ {print $2}' SHASUMS256.txt); \
    curl -fsSLO --retry 5 --retry-delay 3 "$base/$f"; grep " $f\$" SHASUMS256.txt | sha256sum -c -; \
    mkdir -p /opt/node24; tar -xJf "$f" -C /opt/node24 --strip-components=1; rm -f "$f" SHASUMS256.txt; \
    mkdir -p /opt/nvm; curl -fsSL --retry 5 --retry-delay 3 https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/nvm.sh -o /opt/nvm/nvm.sh; \
    npm install -g --no-fund --no-audit yarn pnpm bun eslint prettier && npm cache clean --force

# Python's tools: uv, and pytest and mypy in the system Python (where they see
# the project's own packages); poetry, black, ruff and conan each in its own place.
RUN set -eu; python3 -m pip install --no-cache-dir --break-system-packages uv pytest mypy; \
    for t in poetry black ruff conan; do \
      UV_TOOL_DIR=/opt/uv/tools UV_TOOL_BIN_DIR=/usr/local/bin UV_PYTHON_PREFERENCE=only-system UV_NO_CACHE=1 uv tool install "$t"; \
    done

# Go (the newest, checked against go.dev's sum), and yq built with it.
RUN set -eu; cd /tmp; j=$(curl -fsSL --retry 5 --retry-delay 3 "https://go.dev/dl/?mode=json"); \
    f=$(echo "$j" | jq -r '[.[] | select(.stable)][0].files[] | select(.os=="linux" and .arch=="amd64" and .kind=="archive") | .filename'); \
    s=$(echo "$j" | jq -r --arg f "$f" '[.[] | select(.stable)][0].files[] | select(.filename==$f) | .sha256'); \
    curl -fsSLO --retry 5 --retry-delay 3 "https://go.dev/dl/$f"; echo "$s  $f" | sha256sum -c -; tar -xzf "$f" -C /usr/local; rm -f "$f"; \
    GOBIN=/usr/local/bin GOPATH=/tmp/gopath GOCACHE=/tmp/gocache /usr/local/go/bin/go install github.com/mikefarah/yq/v4@latest; \
    rm -rf /tmp/gopath /tmp/gocache

# Rust (stable, with rustfmt and clippy), from rustup's installer checked
# against its sum. `dev` may add targets and components (/opt/rustup is dev's).
RUN set -eu; cd /tmp; u=https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init; \
    curl -fsSLO --retry 5 --retry-delay 3 "$u"; echo "$(curl -fsSL --retry 5 --retry-delay 3 "$u.sha256" | awk '{print $1}')  rustup-init" | sha256sum -c -; chmod +x rustup-init; \
    RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo ./rustup-init -y --no-modify-path --profile minimal --component rustfmt,clippy --default-toolchain stable; \
    rm -f rustup-init; chown -R dev:dev /opt/rustup

# Java's build tools: Maven 3.9.16 from Maven Central (checked against the sum
# it publishes beside it, written here) and Gradle (the newest, checked against Gradle's sum).
RUN set -eu; cd /tmp; mv=3.9.16; a="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$mv/apache-maven-$mv-bin.tar.gz"; \
    curl -fsSL --retry 5 --retry-delay 3 "$a" -o maven.tar.gz; \
    echo "831a8591fe20c8243b1dbe7d71e3244f31d1665b0804b2e825e38cbbe5ce0cafb8338851f90780735568773e0a6cd07bbec107cda0b896b008b861075358b6f6  maven.tar.gz" | sha512sum -c -; \
    tar -xzf maven.tar.gz -C /opt; ln -s "/opt/apache-maven-$mv" /opt/maven; ln -s /opt/maven/bin/mvn /usr/local/bin/mvn; rm -f maven.tar.gz; \
    g=$(curl -fsSL --retry 5 --retry-delay 3 https://services.gradle.org/versions/current); gv=$(echo "$g" | jq -r .version); \
    curl -fsSL --retry 5 --retry-delay 3 "$(echo "$g" | jq -r .downloadUrl)" -o gradle.zip; echo "$(curl -fsSL --retry 5 --retry-delay 3 "$(echo "$g" | jq -r .checksumUrl)")  gradle.zip" | sha256sum -c -; \
    unzip -q gradle.zip -d /opt; ln -s "/opt/gradle-$gv" /opt/gradle; ln -s /opt/gradle/bin/gradle /usr/local/bin/gradle; rm -f gradle.zip

# PHP's Composer, checked against its sum.
RUN set -eu; cd /tmp; c=https://getcomposer.org/download/latest-stable/composer.phar; \
    curl -fsSL --retry 5 --retry-delay 3 "$c" -o composer.phar; curl -fsSL --retry 5 --retry-delay 3 "$c.sha256sum" | sha256sum -c -; \
    install -m 0755 composer.phar /usr/local/bin/composer; rm -f composer.phar

# Chrome for Testing and its chromedriver, where Claude Code's machine has
# Chrome (/usr/bin/google-chrome, also in $CHROME_PATH).
RUN set -eu; cd /tmp; j=$(curl -fsSL --retry 5 --retry-delay 3 https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json); \
    for p in chrome chromedriver; do \
      curl -fsSL --retry 5 --retry-delay 3 "$(echo "$j" | jq -r --arg p "$p" '.channels.Stable.downloads[$p][] | select(.platform=="linux64") | .url')" -o "$p.zip"; \
      unzip -q "$p.zip" -d /opt/chrome-for-testing; rm -f "$p.zip"; \
    done; \
    ln -s /opt/chrome-for-testing/chrome-linux64/chrome /usr/bin/google-chrome; \
    ln -s /opt/chrome-for-testing/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver
ENV CHROME_PATH=/usr/bin/google-chrome

# WHAT CLAUDE CODE'S MACHINE ALSO HAS beyond its docs' list (its machine itself,
# read 2026-11-07; owner: "anymore tools missing?", then "ok"): media and
# documents (ffmpeg, ImageMagick, pdftotext, pandoc), debugging (strace, lsof,
# valgrind, netcat), a virtual screen for browsers (xvfb-run), Python's document
# and data libraries, and Playwright with its own Chromium, which any script can
# require (NODE_PATH and PLAYWRIGHT_BROWSERS_PATH, in cleanEnv).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg imagemagick poppler-utils pandoc strace lsof valgrind netcat-openbsd xvfb
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    numpy pandas openpyxl python-docx python-pptx pypdf pdfplumber reportlab markitdown requests pillow
RUN set -eu; npm install -g --no-fund --no-audit playwright && npm cache clean --force; \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers playwright install --with-deps chromium

# The Rubies built above, chosen with rbenv like on Claude Code's machine (3.3
# unless a project says otherwise). They are dev's, so `gem install` works.
COPY --from=ruby31 /opt/ruby-3.1.6 /opt/ruby-3.1.6
COPY --from=ruby32 /opt/ruby-3.2.6 /opt/ruby-3.2.6
COPY --from=ruby33 /opt/ruby-3.3.6 /opt/ruby-3.3.6
RUN set -eu; mkdir -p /opt/rbenv/versions; for v in 3.1.6 3.2.6 3.3.6; do ln -s "/opt/ruby-$v" "/opt/rbenv/versions/$v"; done; \
    echo 3.3.6 > /opt/rbenv/version; RBENV_ROOT=/opt/rbenv rbenv rehash; \
    chown -R dev:dev /opt/rbenv /opt/ruby-3.1.6 /opt/ruby-3.2.6 /opt/ruby-3.3.6

# THE MASTER KEY'S JOBS (owner, 2026-11-07, step 4): Coder's commands install
# Ubuntu packages mid-job (`apt-get install`, `apt install`, `sudo apt-get
# install`) and run any installed service (`service NAME start`), as on Claude
# Code's machine. sudo lets `dev` run one program as root, tools/coder-admin,
# which checks each request and does nothing else (tools/coder-admin.sudoers);
# tools/apt-get (also `apt`), tools/service and tools/sudo pass those jobs to it.
# The databases are installed and not running, as on Claude Code's machine;
# PostgreSQL lets this machine's own users in without a password, and `dev` may
# make databases.
COPY --chmod=0755 tools/service tools/coder-admin tools/apt-get /usr/local/sbin/
COPY --chmod=0440 tools/coder-admin.sudoers /etc/sudoers.d/coder-admin
RUN set -eu; visudo -cf /etc/sudoers.d/coder-admin; cp -p /usr/local/sbin/apt-get /usr/local/sbin/apt; \
    printf 'local all all trust\nhost all all 127.0.0.1/32 trust\nhost all all ::1/128 trust\n' > /etc/postgresql/16/main/pg_hba.conf; \
    /usr/sbin/service postgresql start; su postgres -c "createuser --superuser dev"; /usr/sbin/service postgresql stop

# Docker without admin rights: dev's own range of user ids for the engine's
# containers, and the `docker` command that starts dev's engine when needed.
COPY --chmod=0755 tools/docker tools/check-tools tools/sudo /usr/local/bin/
RUN set -eu; \
    grep -q '^dev:' /etc/subuid || echo 'dev:100000:65536' >> /etc/subuid; \
    grep -q '^dev:' /etc/subgid || echo 'dev:100000:65536' >> /etc/subgid; \
    # THE ADMIN SANDBOX'S IDS (coder-sandbox.mjs): outside, 1000000 and up, a user nobody is.
    grep -q '^root:1000000:' /etc/subuid || echo 'root:1000000:262144' >> /etc/subuid; \
    grep -q '^root:1000000:' /etc/subgid || echo 'root:1000000:262144' >> /etc/subgid

# ── CODER ITSELF, on core or full ────────────────────────────────────────────
FROM ${CODER_IMAGE} AS app
WORKDIR /app

# OUR OWN CODE LAST: small and changes often.
COPY package.json server.mjs coder-agent.mjs gloopy-agent.mjs gloopy-browser.mjs coder-model.mjs coder-checks.mjs coder-tools.mjs coder-lsp.mjs coder-proxy.mjs coder-secrets.mjs coder-auth.mjs coder-room.mjs coder-room-forward.mjs coder-sandbox.mjs coder-sandbox-init.sh coder-globs.mjs coder-security.mjs coder-compact.mjs ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
