#!/bin/bash
# EVERY TOOL ON CODER'S MACHINE, TRIED THE WAY CODER USES IT (owner, 2026-11-07:
# "can we install all the tools we need?"). Run inside the full image as root by
# .github/workflows/check-coder-image.yml: each command below runs as `dev`, with
# exactly the environment Coder's service gives the AI's commands (cleanEnv).
set -euo pipefail

# Root's own PATH holds only root's folders.
[ "$PATH" = "/opt/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" ] || { echo "root's PATH changed: $PATH"; exit 1; }

home=/home/dev
envfile=$(mktemp)
node --input-type=module -e "
  const { cleanEnv } = await import('/app/coder-checks.mjs');
  for (const [k, v] of Object.entries(cleanEnv('$home'))) console.log(k + '=' + v);
" > "$envfile"
chmod 644 "$envfile"
as_dev() { setpriv --reuid=1001 --regid=1001 --clear-groups env -i $(cat "$envfile") bash -c "set -euo pipefail; cd \$(mktemp -d); $1"; }
step() { printf '\n== %s\n' "$1"; as_dev "$2"; }

step "check-tools" 'check-tools'
step "Python, and pip installing for dev" 'python3 -c "print(\"python ok\")"; pip install --quiet pyjokes && python3 -c "import pyjokes; print(\"pip ok\")"; uv --version; poetry --version; pytest --version; mypy --version; ruff --version; black --version; conan --version'
step "Node 22 and 24, npm -g for dev, the JavaScript tools, nvm" 'node -e "console.log(\"node\", process.version)"; /opt/node24/bin/node --version; npm install -g --silent cowsay && cowsay ok | head -n 2; yarn --version; pnpm --version; bun --version; eslint --version; prettier --version; tsc --version; . /opt/nvm/nvm.sh && nvm --version'
step "Ruby 3.1, 3.2, 3.3, gems for dev" 'ruby -v; RBENV_VERSION=3.1.6 ruby -v; RBENV_VERSION=3.2.6 ruby -v; gem install --no-document rake >/dev/null && rbenv rehash && rake --version; bundle --version'
step "PHP and Composer" 'php -r "echo \"php ok\n\";"; composer --version'
step "Java, Maven, Gradle" 'printf "class H { public static void main(String[] a) { System.out.println(\"java ok\"); } }" > H.java && java H.java; mvn -v | head -n 1; gradle --version | grep "^Gradle"'
step "Go" 'go mod init t >/dev/null 2>&1; printf "package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"go ok\") }\n" > main.go; go run .'
step "Rust" 'cargo new --quiet r && cd r && cargo run --quiet; rustfmt --version; cargo clippy --version'
step "C and C++" 'printf "int main(void){return 0;}" > a.c; clang a.c -o a && ./a; gcc a.c -o b && ./b; echo "c ok"; cmake --version | head -n 1; ninja --version'
step "PostgreSQL and Redis, started as on Claude Code's machine" 'service postgresql start; psql -d postgres -tAc "select 1"; createdb myapp; psql -d myapp -tAc "select current_user"; service postgresql stop; service redis-server start; redis-cli ping; service redis-server stop'
step "sudo allows the databases and nothing else" 'if sudo -n true 2>/dev/null; then echo "sudo allowed more"; exit 1; fi; if sudo -n /usr/sbin/service postgresql reload 2>/dev/null; then echo "sudo allowed reload"; exit 1; fi; echo "sudo: only the databases"'
step "Chrome and chromedriver" 'google-chrome --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --dump-dom "data:text/html,<p>chrome ok</p>" 2>/dev/null | grep -o "chrome ok"; chromedriver --version'
step "Media and documents" 'ffmpeg -version | head -n 1; convert -version | head -n 1; printf "hello" > t.txt && pandoc t.txt -o t.html && grep -q hello t.html && echo "pandoc ok"; pdftotext -v 2>&1 | head -n 1; python3 -c "import numpy, pandas, openpyxl, docx, pptx, pypdf, pdfplumber, reportlab, markitdown, requests, PIL; print(\"python libraries ok\")"'
step "Playwright with its Chromium, from any folder" 'node -e "require(\"playwright\").chromium.launch().then(async (b) => { const p = await b.newPage(); await p.setContent(\"<p>playwright ok</p>\"); console.log(await p.textContent(\"p\")); await b.close(); })"; xvfb-run --help >/dev/null 2>&1 && echo "xvfb-run ok"'
step "Debugging tools" 'strace -V | head -n 1; lsof -v 2>&1 | grep -m 1 revision; valgrind --version; command -v nc'
step "Docker without admin rights" 'docker run --rm hello-world | grep -m 1 "Hello from Docker"; docker compose version'
step "The rest" 'git --version; git lfs version; gh --version | head -n 1; yq --version; jq --version; rg --version | head -n 1; sqlite3 --version; tmux -V; vim --version | head -n 1; nano --version | head -n 1'
step "What dev installed for itself is in its home, never a project" 'test -x "$HOME/.npm-global/bin/cowsay"; ls -d "$HOME"/.local/lib/python3*/site-packages/pyjokes; test -d "$HOME/.cache/go-build"; echo "dev'"'"'s installs and caches are in its home"'
# THE SEALED ROOM (step 3): the way Coder runs the AI's commands, with the real gate and real websites.
printf '\n== The sealed room, with the real gate\n'
node /coder-test/room-check.mjs
echo
echo "ALL TOOLS OK"
