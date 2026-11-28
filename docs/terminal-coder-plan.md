# Terminal Coder: build plan

Written 2026-11-28. This is a plan only. Nothing has been built yet.

## The idea in one paragraph

You open the terminal on your own computer, `cd` into a project and type
`coder`. Coder starts right there, in text only, the way Claude Code does. It
reads and edits the files in that folder and runs commands on your computer,
asking you first before anything risky. Its thinking (Grok) still happens on
Coder's server at gofarther.dev: you sign in with an emailed code, only
accounts in `CODER_USERS` can use it, and no Grok key ever lands on your
computer.

Mac comes first, then Linux, then Windows.

## What it will look like

```
$ cd ~/code/my-shop
$ coder

 ╭──────────────────────────────────────────────────────────╮
 │ ✻ Welcome to Coder                                       │
 │                                                          │
 │   /help for help, /status for your setup                 │
 │                                                          │
 │   cwd: ~/code/my-shop                                    │
 │   Signed in as owner@example.com · Grok 4.7 · low        │
 ╰──────────────────────────────────────────────────────────╯

 > fix the failing price test

 ● Read(src/price.js)
   ⎿ Read 84 lines
 ● Bash(npm test -- price)
   ⎿ 1 failing: rounds 19.999 to 19.99 (expected 20.00)

 ╭──────────────────────────────────────────────────────────╮
 │ Edit file  src/price.js                                  │
 │  41 -  return Math.floor(n * 100) / 100;                 │
 │  41 +  return Math.round(n * 100) / 100;                 │
 │                                                          │
 │ Do you want to make this edit to price.js?               │
 │ ❯ 1. Yes                                                 │
 │   2. Yes, allow all edits during this session (shift+tab)│
 │   3. No, and tell Coder what to do differently (esc)     │
 ╰──────────────────────────────────────────────────────────╯

 ╭──────────────────────────────────────────────────────────╮
 │ >                                                        │
 ╰──────────────────────────────────────────────────────────╯
   ? for shortcuts                         ⏵⏵ accept edits off
```

## How it matches Claude Code

The target is Claude Code's own docs (code.claude.com/docs/en: overview, CLI
reference, interactive mode, settings).

- **Startup screen and input box**: the welcome box, then a bordered input box
  at the bottom, with a hint line under it showing the mode.
- **Approval prompts**: numbered choices, picked with the arrow keys and Enter
  (or the number). Same choices as Claude Code: Yes / Yes, and don't ask again
  for this / No, and tell Coder what to do differently.
- **Keys**: Esc stops Coder mid-answer (Esc twice goes back to an earlier
  message), the up arrow walks your past messages, Shift+Tab cycles the mode
  (normal, accept edits, plan), Ctrl+C twice quits, `\` + Enter for a new line,
  `!` runs a shell command yourself, `@` picks a file, `#` adds a memory.
- **Slash commands**: `/help`, `/clear`, `/compact`, `/model`, `/status`,
  `/cost`, `/permissions`, `/hooks`, `/memory`, `/init`, `/resume`, `/review`,
  `/login`, `/logout`, `/config`, `/exit`, plus the repository's own
  `.claude/commands/*.md`.
- **Print mode**: `coder -p "explain this folder"` answers once and exits.
  `--output-format text|json|stream-json`, and piping works
  (`cat log.txt | coder -p "why did this fail"`).
- **Carrying on**: `coder --continue` (`-c`) picks up the last chat in this
  folder; `coder --resume` (`-r`) shows a list to choose from, or takes an id.
- **Other flags**: `--model`, `--permission-mode`, `--allowedTools`,
  `--disallowedTools`, `--add-dir`, `--settings`, `--verbose`, `--version`.
- **Project files**: `CLAUDE.md` (and `CODER.md`), `.claude/settings.json`,
  `.claude/settings.local.json`, `~/.claude/settings.json`, and their hooks,
  all read from your own computer.

## Where the code lives

A new folder, `coder/cli/`. It does not copy the agent loop: it imports the
same files from `coder/container/` (`coder-agent.mjs`, `coder-tools.mjs`,
`coder-perms.mjs`, `coder-hooks.mjs`, `coder-bashcheck.mjs` and the rest), so
a fix in one place fixes both the website's Coder and the terminal's.

The new parts are small and only about the computer it runs on:

- the screen (input box, prompts, key handling),
- "run this command here" and "read this file here" for a personal computer,
- sign-in and talking to gofarther.dev,
- saving chats on disk.

## How it is installed

Two ways, the same code:

1. **npm package** (first): `npm install -g @gofarther/coder`, then `coder`.
   Needs Node 22 or newer. Easiest to build and update.
2. **Single file to download** (later): one program per system (Mac Apple
   chip, Mac Intel, Linux, Windows) built with Node's single-executable
   feature, offered with a one-line installer
   (`curl -fsSL https://gofarther.dev/install.sh | sh`). The Mac file is
   signed and notarised so macOS does not block it; this needs the owner's
   Apple certificate, as the phone app does.

`coder update` (and a quiet check at start) keeps it current. A GitHub button,
`build-cli.yml`, builds and publishes it, like the desktop build button.

## How sign-in works

The first time you run `coder` (or `/login`):

1. Coder asks for your email.
2. gofarther.dev emails a code, the same code sign-in the website uses.
3. You type the code into the terminal.
4. The server checks the email is in `CODER_USERS`, then gives the terminal a
   long-lived "terminal key" for that computer.

The terminal key is kept in the Mac Keychain (Linux: the system key store,
or a file only you can read; Windows: Credential Manager). It can only ask
for model calls and save chats for you; it cannot read your GitHub login or
any server secret. You can see and remove your terminal keys from the website
(Settings, Computers), and `/logout` removes it from this computer.

A browser-based "device code" sign-in (as `gh auth login` does) can come
later; the email code is enough and needs no new pages.

## What the server needs

Today the model call already goes through the server (`/api/coder/model`,
`coder/src/coder-model-gate.mjs`), but it trusts a pass made for a cloud
machine's running job. The terminal has no cloud machine, so it needs its own
doors:

| New endpoint | What it does |
|---|---|
| `POST /api/coder/cli/login` | Email in, code sent (reuses the website's sign-in) |
| `POST /api/coder/cli/verify` | Code in, terminal key out (only `CODER_USERS`) |
| `POST /api/coder/cli/model` | One Grok call for a signed-in terminal |
| `GET /api/coder/cli/me` | Who you are, your models, your limits |
| `POST /api/coder/cli/logout` | Ends that terminal key |
| `GET /api/coder/cli/settings` | Optional: your account's rules, hooks and tool choices from the website |
| `POST /api/coder/cli/web` | Optional: web search and page reading, which also use Grok |

The model door does the same checks as the website's: only Coder's own models,
the same size limit, a per-person rate limit and a daily cap, and a log of each
call's use. While testing it stays free and only for `CODER_USERS`. **No call
is made while planning**; the first live call waits for the owner's word.

## Where chats are saved

On your computer, like Claude Code:

- `~/.coder/projects/<folder-name>/<chat-id>.jsonl`, one line per step, so
  `--continue` and `--resume` work offline and fast.
- `~/.coder/history.jsonl` for the up-arrow history.
- `~/.coder/settings.json` for your own settings (and Coder also reads
  `~/.claude/settings.json`).

Nothing is copied to gofarther.dev except what each model call needs. Saving
chats to your account (so they show on the website) can be an opt-in later.

## Safety on a personal computer

On the website, Coder works inside a throwaway cloud machine: a sealed room,
a network gate and an admin sandbox mean a bad command can only hurt that
machine. On your own computer there is no throwaway machine, so the rules
change:

- **Ask before acting.** The default mode is Claude Code's normal mode:
  reading and searching are free, every edit and every command that changes
  something asks first. The website's default is auto; the terminal's is not.
- **The same command checks.** `coder-perms.mjs` and `coder-bashcheck.mjs`
  still decide what is read-only and what must ask; your allow and deny rules
  from `.claude/settings.json` still apply.
- **Stay in the folder.** Reads and edits outside the folder you started in
  (plus `--add-dir` folders) ask first. Protected files (`.git`, `.zshrc`,
  `.ssh`, `.env` and the rest of `PROTECTED_DIRS` and `PROTECTED_FILES`) always
  ask.
- **Extra local guards.** Commands that wipe a disk, change system settings,
  use `sudo`, or touch the home folder broadly always ask and are flagged red.
  Secrets found in command output are hidden before they are sent to Grok
  (`coder-secretscan.mjs`).
- **Optional sandbox.** On Mac, commands can run under macOS's built-in
  sandbox (`sandbox-exec`) that only allows writing inside the project; on
  Linux, under `bubblewrap`. Off by default at first, as Claude Code's is.
- **What goes away.** The sealed room, the network gate, the admin sandbox,
  the machine's own git pass and the "machine was restarted" notes. Your own
  git and your own logins are used, as with Claude Code.

## The work, in phases

| Phase | What | Rough size |
|---|---|---|
| 0 | Server doors: terminal sign-in, terminal key, model door, limits, tests | 3-4 days |
| 1 | The loop running locally: `coder -p` print mode on Mac, local run/read, tools working, no screen yet | 1 week |
| 2 | The screen: welcome box, input box, approval prompts, Esc, history, modes, slash commands | 1.5-2 weeks |
| 3 | Chats on disk, `--continue`, `--resume`, `/compact`, CLAUDE.md, settings files and hooks on the local machine | 1 week |
| 4 | Packaging: npm package, single files, installer, `coder update`, build button | 4-5 days |
| 5 | Linux, then Windows (PowerShell, paths, Credential Manager) | 1-1.5 weeks |
| 6 | Extras: optional sandbox, web search and fetch, connectors (MCP), subagents | 1-2 weeks |

About 6-8 weeks in all. Phases 0-3 give the owner a working terminal Coder
on a Mac.

## Tests

- **Automated** (`npm test` from `coder/cli/`): the screen drawn into a fake
  terminal (keys in, text out) for the input box, prompts, Esc, history and
  each slash command; print mode's output formats; chat files saved and read
  back; settings and hooks loaded from a test folder; the safety checks on Mac
  and Linux paths; the server doors (sign-in, wrong code, account not in
  `CODER_USERS`, expired key, rate limits) in the Worker's own tests.
- **A fake Grok** that replies with set answers, so every test runs without a
  paid call.
- **Live**, by the owner's rule: each feature tried in a real terminal against
  gofarther.dev with Grok, once the owner says live calls may start, and shown
  as screenshots in the chat.
- **Every system**: GitHub's Mac, Linux and Windows runners run the tests on
  each push.

## Risks

- **The loop is cloud-shaped.** `coder-agent.mjs` is about 8,600 lines and
  assumes a Linux machine, `/tmp` paths, `nsenter` and the machine's server.
  Splitting "what the agent does" from "where it runs" is the biggest job and
  could slip.
- **Danger is real now.** A wrong command hurts the user's own files. Mitigated
  by asking by default, folder limits and the protected-file list, but it must
  be tested hard before anyone but the owner uses it.
- **Cost.** A terminal key could be used heavily or leak. Mitigated by
  per-person limits, a daily cap, keys you can revoke, and `CODER_USERS`.
- **Windows** differs most (shell, paths, no `sandbox-exec`); it is last for
  that reason.
- **Mac signing** needs the owner's Apple certificate; until then, the npm
  package is the way to install.
- **Two Coders drifting apart.** Sharing the same files from
  `coder/container/` keeps them together; the tests run for both.

---

## Appendix: technical detail

**Reuse map (from `coder/container/`).**

| File | Use in the terminal |
|---|---|
| `coder-agent.mjs` | `runCoder(deps, opts)` is the loop. It already takes its outside world as `deps` (`deps.exec`, `deps.send`, …). The terminal gives it local `deps`. Cloud-only options (`box`, `github`, `setupScript`, `connectors`, `schedule`, `pages`, `savedLogins`) stay off. |
| `coder-model.mjs` | `coderSend(env, { via })` already sends calls through the Worker with headers instead of a key. The terminal passes `via = { url: ".../api/coder/cli/model", headers: { authorization: "Bearer <terminal key>" } }`. |
| `coder-tools.mjs` | The tool runner (`node coder-tools.mjs <b64>`). Runs as is locally; reads `CODER_CWD` and `CODER_WORK_DIRS`. Image and PDF reading needs ImageMagick and poppler: say so when missing instead of failing. |
| `coder-perms.mjs` | `MODES`, `parseRule`, `commandReadOnly`, `insideWork`, `fileCommandTargets`, `discardsWork`: all reused. Default mode becomes `default` (Manual) instead of `auto`. |
| `coder-bashcheck.mjs`, `coder-psparse.mjs`, `coder-filerules.mjs`, `coder-secretscan.mjs`, `coder-scrub.mjs` | Reused unchanged. |
| `coder-hooks.mjs`, `coder-hookevents.mjs`, `coder-hookcheck.mjs` | Reused; hooks run as the user's own commands in the project folder, with the event JSON on stdin, exactly as Claude Code. HTTP hooks call out directly. |
| `coder-compact.mjs`, `coder-context.mjs`, `memory-files.mjs`, `coder-skills.mjs`, `coder-agents.mjs` | Reused for `/compact`, CLAUDE.md loading, skills and subagents. |
| `coder-shell.mjs` | Reused for the persistent shell, with the user's `$SHELL`. |
| `server.mjs` | Not used. Its jobs (clone, push, the room, the sandbox, live saving) are cloud-only. Small helpers it has that the loop needs are moved into shared files. |
| `coder-sandbox.mjs`, `coder-room.mjs`, `coder-proxy.mjs`, `coder-room-forward.mjs` | Not used (Linux namespaces, `nsenter`, `unshare`). Replaced by an optional `sandbox-exec` / `bubblewrap` wrapper in `coder/cli/sandbox.mjs`. |
| `gloopy-*.mjs` | Not used. |

**Needed refactors.** (1) Find every hard-coded cloud path in the loop
(`/tmp/coder-agents/`, `/tmp/coder-scratch`, `/srv/...`, `/root`) and route it
through one `paths` object in `deps`. (2) Pull the small helpers `runCoder`
reaches for out of `server.mjs`. (3) Make the "no approval surface" path
(`DENY_INSTEAD_TEXT`) the print-mode default, so `-p` never hangs on a prompt
(Claude Code: `-p` denies what needs approval unless allowed by flags or
rules).

**New files in `coder/cli/`.**

- `bin/coder.mjs`: flags (`-p`, `-c`, `-r`, `--model`, `--permission-mode`,
  `--allowedTools`, `--disallowedTools`, `--add-dir`, `--output-format`,
  `--settings`, `--verbose`, `-v`), then interactive or print mode.
- `local-deps.mjs`: `exec` with `child_process.spawn` in the project folder,
  process-group kill on Esc, output limits as today; `send` from
  `coderSend(..., { via })`.
- `ui/`: Ink (React for terminals) for the boxes, prompts and lists; or a
  small hand-written renderer if Ink's size matters for the single file.
- `auth.mjs`: login, verify, key store (`keytar`-style calls through the OS
  tool: `security` on Mac, `secret-tool` on Linux, `cmdkey`/DPAPI on Windows;
  fallback `~/.coder/credentials.json` with mode 600).
- `store.mjs`: JSONL chats under `~/.coder/projects/`, history, `--resume`
  picker data.
- `settings.mjs`: merges, in Claude Code's order, managed, `--settings`,
  `.claude/settings.local.json`, `.claude/settings.json`,
  `~/.claude/settings.json` / `~/.coder/settings.json`, then the account's
  website rules if fetched.

**Server side (`coder/src/`).** A new `coder-cli.mjs` with the routes above,
wired in `coder-routes.mjs`. The terminal key: random 32 bytes, shown once,
stored only as its SHA-256 under `coder/<uid>/cli-keys/<hash>.json` in the
bucket with the computer's name, created and last-used times. The model door
reuses `handleModel`'s checks (models list, `MODEL_BODY_MAX`, prompt cache
key per chat) with the terminal key in place of the job's pass, plus a counter
per uid per day. `isCoderUser` (the `CODER_USERS` check) is called on every
request, so removing an email locks that person out at once.

**Print mode details.** `--output-format json` gives one object with
`result`, `session_id`, `num_turns`, `usage`; `stream-json` gives one line per
event. Exit code 0 on success, 1 on an error. `--max-turns` caps rounds
(maps to `maxRounds`).

**Packaging details.** `package.json` `bin: { coder: "bin/coder.mjs" }`,
the shared `coder/container/` files bundled with esbuild into one file for
npm and for Node's single-executable build (`node --experimental-sea-config`,
then `postject`). The Mac file is signed with `codesign` and sent to Apple's
`notarytool`.
