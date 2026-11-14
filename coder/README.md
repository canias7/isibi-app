# Coder

gofarther.dev. A developer agent that works through a Linux terminal on the
code in **each user's own GitHub**.

| Path | What it is |
|---|---|
| `worker.js` | The Cloudflare Worker (`gofarther-coder`): the page and `/api/coder/*` |
| `wrangler.jsonc` | Its config: addresses, container, bucket, settings |
| `public/` | The page: sign-in (`auth.js`, `app.js`), the tabs (Coder, Gloopy agent), Coder's chat (`coder.js`, `coder.css`) |
| `src/coder-routes.mjs` | `/api/coder/...`: GitHub, projects, message, follow, stop |
| `src/coder-git.mjs` | Coder's git address: the machine's git goes through it with its chat's pass, and the Worker adds the GitHub login (the login never enters the machine) |
| `src/coder-fly.mjs` | Coder's machines on Fly.io: one VM per chat (4 full CPUs, 16 GB) with its own kept disk, made, woken, stopped and removed by the Worker |
| `src/coder-control.mjs` | The key that locks a machine's control panel (made from `CODER_TOKEN_KEY`) |
| `src/coder-live.mjs` | The chat saved as it goes: the machine sends each job's steps here every few seconds; kept sealed until the job is saved, put back in the chat if the machine is lost |
| `src/coder-watch.mjs` | The watch list: every minute, each running job is kept awake and saved when it ends, with or without an open tab |
| `src/coder-github.mjs` | Sign in with GitHub, the user's token (encrypted), repositories, pull requests |
| `src/coder-auth.mjs` | Go Farther sign-in (Supabase), the Worker's proof that both steps (password, then the emailed code) happened, the password it remembers and the count of code checks |
| `src/coder-signin.mjs` | `/api/auth/...`: the password step, the emailed code, sign-up, refresh, sign-out |
| `src/coder-page.mjs` | Serves the page with its safety headers |
| `src/coder-mcp.mjs` | Connectors (MCP): each person's list, sign-in to each app (OAuth, kept sealed), its tools, and the machine's connector calls, which go through the Worker (`/api/coder/mcp`) with the job's pass |
| `test-copy.mjs` | The two test copies' settings (test.gofarther.dev, where Gloopy was built, and jessica.gofarther.dev, where the connectors were: each its own Worker, storage and Fly.io machines), made from `wrangler.jsonc` for the deploy button's "test" and "jessica" choices |
| `src/gloopy-*.mjs` | Gloopy's side of the Worker: its schedules (started by the every-minute run) and webhooks, the Vault (saved logins, cards, keys, contact info: sealed), its files in and out, its pages, the backup of its computer, and a card read from a photo |
| `src/coder-cors.mjs` | Only gofarther.dev may call it from another address |
| `container/` | The machine's image (Ubuntu 24.04 with Claude Code's tools; its helpers in `container/tools/`): the agent loop, the AI call (Grok 4.7 with an effort level), the safety checks, and the service that clones, runs commands, commits and pushes |
| `container/gloopy-*.mjs` | Gloopy on its machine: its instructions and tools (`gloopy-agent.mjs`), its own browser (`gloopy-browser.mjs`, Playwright's Chromium), the check before a step that could change something (`gloopy-check.mjs`), what it may do on its own (`gloopy-permissions.mjs`), its browser through the owner's computer (`gloopy-route.mjs`) and its schedules' times (`gloopy-schedule.mjs`) |
| `test/` | `npm test` from this folder |

## How it works

1. The user signs in, then connects GitHub: Coder sends them to GitHub's own
   sign-in, and they choose which repositories Coder may use.
2. They pick a repository. That is a Coder project.
3. Each message: Coder's machine clones the repository (once), works on its
   own branch `coder/<project>` with its tools (read, edit, write, grep, glob,
   bash, web_search and the rest: `CODER_TOOLS` in `container/coder-agent.mjs`)
   and finishes by answering in words.

   **read opens pictures, PDFs and notebooks too** (owner item 1, 2026-11-08), like
   Claude Code's Read ("reads images (PNG, JPG, …) and presents them visually",
   PDFs "via the pages parameter (max 20 pages per request; required for PDFs over
   10 pages)", and "Jupyter notebooks (.ipynb) as cells with outputs"). Grok takes
   only JPG and PNG pictures, and a tool answers only in text (xAI's docs), so the
   read tool (`container/coder-tools.mjs`, as `dev`) makes any other picture a PNG,
   and a big one smaller (2000 on its longest side, like Claude Code's, with how to
   map a place on it back to the real picture; then smaller should it not fit
   in what the machine passes on), through ImageMagick fed on stdin with the kind
   named, never a file name; a PDF gives each page's text (poppler's `pdftotext`)
   and draws every page (`pdftoppm`, 1400 on its longest side) as a picture too,
   like Claude Code's Read, the pages sharing the read's room (`PICS_BUDGET`, 6 MB;
   one picture at most `PIC_ONE_MAX`), which Coder's machine passes on for a file
   tool (`TOOL_OUTPUT_MAX`, 8 MB; a command's output keeps 1 MB); a notebook gives its
   cells, printed text, results, errors and plots. The pictures follow a mark
   (`PICS_MARK`, which has a NUL in it, so no text file can hold it) that the
   agent takes only from read's answer: Grok gets the read's text as its answer,
   then, after the round's answers, a note from Coder's app with the pictures
   attached. A read shows at most 20 (`PICS_PER_READ`: a PDF read's pages) and a job
   keeps at most 24 attached (`PICS_KEEP`), and at most 18 MB of them (a request to
   Grok through Coder's server is at most 30 MB); the saved chat keeps a
   note in their place, and they never count toward a long job's summary.
   `test/read-check.mjs` tries it in Coder's own image (the machine check).

   **@-mentioned files go into the message** (owner, 2026-11-08: "add all of
   that"), like Claude Code's @, which "includes the content of the file in the
   conversation when it fits the Read tool's token limit": before Coder starts,
   Coder's app reads each `@path` of the owner's message (`mentionedPaths` and
   `mentionNote` in `container/coder-agent.mjs`; at most 10, about 100,000
   characters in all) and adds a note from the app right after the message: each
   file whole with its folder's instructions, a picture shown, a folder as its
   listing (the `listing` tool), and a file too big for one read named only. A
   path that is not a file of the project (a package name like `@types/node`) is
   left alone; a job from GitHub reads none. Each shows in the chat as a step,
   "Read src/app.js (@-mentioned)". The Worker still names the paths in the
   message (`fileMentions`). Notes from the app carry `appNote`, so a long chat's
   summary never counts one as the owner's message.

   **Right after a summary, Coder re-reads up to five files** it was working on
   (read, changed, viewed with a command, or @-mentioned), the most recently
   changed first, like Claude Code ("Right after compaction, Claude Code re-reads
   up to five of the files"; `rereadFiles`; the `mtimes` tool gives their times):
   each up to 20,000 characters (about 5,000 tokens), a bigger one only named as
   a "Referenced file". Files the kept steps read already, pictures and files
   that are gone are skipped, and so are pictures, PDFs, notebooks and binary
   kinds (`notTextKind`), before they are read; the files read again come to at
   most 10% of the room. After a job's own summary they go with the summary
   message. A summary made between messages (`/compact`, a long chat summarized
   before a job, Rewind's summaries) names the files its part worked on
   (`filesTouched` in `container/coder-compact.mjs`, kept as the summary's
   `reread`), and the next job reads them again, once, in a note from the app
   after the owner's message.

   **A PDF's own page count is not trusted** (Claude Code 2.1.317: "Fixed a PDF's
   own metadata being able to make Read and @-mentions under-count its pages"):
   poppler goes by the count the file states, so the read tool also counts the
   pages themselves with pypdf (on Coder's machine), and when the two differ it
   reads a mended copy (`PDF_PAGES_PY`): a PDF that says 3 pages but has 12 reads
   as 12; one whose count is too high (poppler gave up) reads from the copy.

   **After a job's summary, Coder's instructions and memory come fresh from disk**
   (Claude Code's docs: "Project-root CLAUDE.md and unscoped rules | Re-injected
   from disk", "Auto memory | Re-injected from disk"; its 2.1.311 fixed stale
   copies): the machine builds Coder's context with `contextFor`, and again after
   a summary (`freshContext`) with the memory file and the repository's top-level
   CODER.md or AGENTS.md (`topNotes`): only files with no folder on the way, as
   Coder's commands may still run then (a folder could be swapped for a link); the
   rest stays as read before any command ran. Block-level HTML comments in the
   instruction files are left out as they load (`withoutComments`; Claude Code's
   CLAUDE.md does the same), and a note to read the rest names the file's own line.

   **A big picture is shown smaller, and Coder is told so** (Claude Code's docs:
   "Claude may see a downscaled version of a large screenshot … crop the region
   you care about, such as with ImageMagick via Bash, and then read the crop"):
   read's answer gives the picture's real size, the size shown, and how to crop.

   **The picture a read opened shows in the chat** (the owner, 2026-11-08: "Fix
   those 3"; Claude Code shows it): read's answer carries a small copy (`thumbOf`
   in `container/coder-tools.mjs`, a JPEG at most 320 on its longest side and
   60,000 characters), which the agent puts on the step's result (`thumbs`) and the
   page shows under the step (`stepPics` in `public/coder.js`). The chat's record
   keeps it; Grok never gets it.

   **The owner's pictures are saved as files Coder can open again** (Claude Code
   2.1.275: pasted and attached images "are now saved where Claude can open them
   as files"): each picture of the owner's message goes to the project's
   `.coder-pictures` folder (`save_picture`, named by when it was sent, the newest
   50 kept), which is never saved to the branch (`NEVER_COMMIT` in
   `container/server.mjs`), and a note added to the owner's message says where.
   Not in a job from GitHub.

   **The @ list puts file-name matches first** (Claude Code 2.1.280): a file whose
   name starts with what was typed, then one whose name has it, then one where only
   a folder matches (`rankMentions` in `public/coder.js`).

   **Text read opens:** UTF-8, and UTF-16 with a byte-order mark (Claude Code
   2.1.299; edit changes them as UTF-16 too). Pictures are made sRGB (a CMYK JPEG too).
   `file_path`, Claude Code's own name, is taken for `path`. Besides the project,
   the file tools may use a scratch folder, `/tmp/coder-scratch` (`SCRATCH`), for
   crops and conversions, which is never saved to the branch. The programs a read
   runs (ImageMagick, poppler, Python for a PDF's pages) never start in the
   project's folder, and Python runs isolated (`-I`), so a read never runs the
   repository's code.

   **What read refuses, as Claude Code's Read does:** a folder ("list what is in
   it with glob, or a command such as ls"); a file whose kind is binary by its
   name (`.zip`, `.xlsx`, `.parquet`, `.heic` and others: `BINARY_KINDS`), with a
   command or script that reads that kind; any other file with a NUL byte in its
   start; a pipe or a device; a path or pattern with a null byte.

   **A command that changes a file Coder read says so** (owner, 2026-11-08: "Yes
   do that too"; Claude Code's docs, "Context Claude Code adds on its own": "A note
   when a file Claude read earlier changes on disk"). The docs say no more, so
   Coder does what Claude Code was seen doing: its own commands got "[This command
   modified 1 file you've previously read: … Call Read before editing.]", and in
   the owner's two tests in Claude Code, a file changed by a command in the
   background, then between messages, got no note at all. For each text file
   Coder reads, writes or edits (up to 256 KB; at most 100 a chat, the oldest let
   go first) the file tools keep its time, size and a fingerprint of its bytes (no
   copy) in the chat's own folder beside its memory (`/srv/coder-memory/<chat>.seen`,
   made by root and handed to `dev`, kept between messages: `CODER_SEEN_DIR`). After
   each command, the `changed` tool says which of them changed (`changedFiles` in
   `container/coder-agent.mjs`), and the command's result ends with "[This command
   changed 1 file you read before: a.js. Read it again before editing.]". What
   changed any other way (a command in the background; between messages, an undo
   or a rewind) gets no note, and is taken in first so it is never put down to
   Coder's next command. Coder's own writes and edits are no news, and a file only
   touched (the same bytes) is no change. A file a command showed (`cat`, `head`,
   `sed -n 'X,Yp'` … on one file) is followed too, as Claude Code counts it as read
   (tried side by side, 2026-11-08). Beside each file's fingerprint, each line's own
   short one (8 characters, never its text), so Grok also gets, after that round's
   results, the lines the change touched (8 either side, numbered as read numbers
   them; past 8,000 characters, "The changes are not shown here"), as Claude Code's
   second note gives them ("Note: … changed on disk since you last read it … Here are
   the relevant changes (shown with line numbers)"). The chat never shows that note.

   **Read gives whole lines, never cut**, as Claude Code's does (a 20,000-character
   line came back whole, tried side by side; Coder cut every line at 2,000
   characters before). A line too big for one read by itself is left for a read of
   its own, which says so, with allow_large and a command to see part of it.
   A file that is not valid UTF-8 (an old encoding such as Windows-1252) gets
   Claude Code's note after its lines: its undecodable bytes show as U+FFFD, and
   edit and write would save that over them, so change it with a command that keeps
   its encoding (iconv), or ask the owner about converting it (`NOT_UTF8_NOTE`).

   **Write has Claude Code's checks** (tried side by side with Claude Code's own
   Write): it won't replace a file Coder read only part of (a PARTIAL view) or a
   notebook it hasn't read ("… has not been read yet. Read it first before writing
   to it"); it won't replace a file that isn't valid UTF-8 (nothing is written; a
   command that keeps the encoding, or asking the owner, or deleting it first); it
   keeps a UTF-16 file UTF-16; and it refuses a path that is a link, naming its
   target. A new file, or a plain one not read, is written as before.
   Second pass (each tried for real with Claude Code's own Write): it won't replace
   a file that changed since Coder read or wrote it and hasn't been shown again
   ("… has been modified since read … Read it again before attempting to write it";
   only its time changing is no change, and the note after that round counts as
   showing it, so a write in the same answer as the command that changed the file
   is refused, as in Claude Code); a file read only in part stays so after `cat` or `head`; a UTF-8
   byte-order mark is kept; a folder is named as one; and it answers in Claude
   Code's words ("File created successfully at: …" / "The file … has been updated
   successfully.", then "(file state is current in your context — no need to Read
   it back)"). Docs pass: an instruction file Coder's app showed only in part (its
   note "[… goes on …: read the rest of it with the read tool, from line N]") is not
   written over until it is read all at once ("You were given only the start of this
   file …"; the agent marks it from that note, `SHOWN_START_RE`); a null byte names
   the tool ("write path cannot contain null bytes …"); and a link on the way in a
   loop or leading nowhere is refused before any folder is made ("where it leads on
   disk could not be determined …").
   What Claude Code's Write has that Coder's didn't: the chat shows under each write
   what it wrote (a new file's lines, a replaced file's diff, +N −M on the step; the
   tool's `show_change` and `WRITE_MARK`, read by the agent's `writeAnswer`, never sent
   to Grok); `file_text` and `file_content` are taken for `content`; a write to the
   memory file is measured against what Coder loads of it (`memoryNote`); and Claude
   Code's `.claude/security-patterns.*` files are read beside Coder's own.
   Last docs pass: write's other input names are read with Claude Code's note ("Note:
   write's parameters are named `path` and `content`. `file_path` was read as `path`.")
   and two different values for one input are refused (`writeInputs`); a file in the
   chat's other repository is named in full; the owner's values are hidden in a
   write's lines too when a chat is saved (`hideIn`). And Claude Code's protected
   paths (`.husky`, `.vscode`, `.envrc`, `.npmrc` …, `PROTECTED_DIRS`/`PROTECTED_FILES`):
   write asks the owner first on a card (event `writeask`; Allow sends "I allowed
   Coder to change <path>.", which lets that file through for the chat); from GitHub
   they are not written.
   After each write of a JavaScript, TypeScript or Python file, the language server
   reports the new errors and warnings (`newProblems` in `coder-lsp.mjs`): to Grok as
   Claude Code's "new diagnostics" note, to the chat as "Found N new diagnostic issues
   in 1 file". (Showing a write while Grok writes it can't be done: xAI sends a tool
   call whole, at the end.)

   **Edit is Claude Code's Edit** (tool 3, the owner, 2026-11-09: "Notebook for later,
   but yea do this"; tried side by side with Claude Code's own Edit, 33 ways). It swaps
   an exact piece of text (`old_string`) for the new (`new_string`), once or with
   `replace_all` everywhere, and answers in Claude Code's words ("The file … has been
   updated successfully.", "String to replace not found in file.", "Found 2 matches of
   the string to replace, but replace_all is false. …", "No changes to make: …").
   A Windows (CRLF) file is matched with plain line breaks and written back with the
   ending most of its lines have; curly quotes in the file are matched by straight ones
   and the new text gets curly ones of that kind; `\u00e9` written out finds "é". A
   file changed on disk since Coder read it is edited when the old text is still there
   once, with Claude Code's note that it holds other changes, and refused ("modified
   since read") otherwise; "(file state is current …)" only for a file read whole (a
   read of some lines is marked `part`). Not valid UTF-8 (an old encoding), a link, a
   notebook (its own tool is for later): refused, nothing written; UTF-16 stays UTF-16.
   No old text makes a new file, with its folders. `old_str` and `new_str` are taken,
   `replace_all` given as text too; files up to 256 MB (it was 5 MB). Coder's app gives
   edit what it gives write: the protected-file card (with the lines taken out and put
   in), the change under each step, and the language server's new problems.

   **A `cd` carries over to the next commands, the Claude Code way** (the owner,
   2026-11-08: "lets do it the claude code way"; Claude Code's tools reference: "the
   new working directory carries over to later Bash commands as long as it stays
   inside the project directory or an additional working directory … This includes
   commands Claude runs in response to your later messages"). Each of Grok's
   commands starts in the folder the last one left (`t.cwd` in `container/server.mjs`;
   its shell goes there itself, as `dev`, after starting in the project's folder,
   so root never enters a folder `dev` can change). A command not asked to run in the
   background prints, last, the folder it ended in (an EXIT trap that writes it in
   base64 behind `CWD_MARK` and a random part, only on exit code 0, as tried in
   Claude Code); `execIn` takes that line out of the output (found after a cut too)
   and the service keeps the folder while it is inside the project or one of the
   chat's other repositories (`cwdInside`), else goes back to the project's folder
   with Claude Code's "Shell cwd was reset to <dir>". A command in the background
   never moves it ("Session cwd remains <dir>; …" when it had a cd, `CWD_WORDS`), and
   a background command's output never shows its folder line (`noCwdMarks`). Grok's file tools get the
   folder (`CODER_CWD`): a short path counts from it, grep and glob search there and
   list from there (`searchIn`), and files are named by full path there; the chat's
   steps still name them from the project (`projectPath`), and the app's notes use
   full paths while the folder is elsewhere (`sayPath`). Grok is told the folder in
   its context (WHERE YOUR COMMANDS RUN) and in a result when it changes, and the
   file tools' `path` asks for a full path, as Claude Code's do. The job's end gives
   the folder (`result.cwd`), the Worker keeps it with the chat (`meta.cwd`) and
   sends it with the next message (`cwd`); a chat with no history starts in the
   project's folder. `CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` in the chat's
   environment variables (read before `safeVars`, which keeps `CODER_` names from
   the commands) makes every command start in the project's folder, like Claude
   Code's `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`. Folder names are told to Grok
   without control characters (`saidDir`). Tests: `test/cwd.test.mjs`.

   **Coder asks with a card of up to 4 questions** (`ask_user`; owner pick 4,
   2026-11-08; since 2026-11-14 Claude Code's AskUserQuestion word for word,
   `container/coder-askuser.mjs`): each question with a header shown as a chip, 2 to 4
   options with a one-line description, several choices when it allows, and Other
   with a box; one Skip and one Submit. The card waits inside the job, as Claude
   Code's question dialog does: the answers are the tool's result in the same turn,
   in Claude Code's words ("Your questions have been answered: …"), and Skip, Stop,
   no answer and the job's time limit end it as the other cards do. Its input is
   checked before any hook, in Claude Code's words. On GitHub (@coder), for Gloopy
   (its own `ask_user`), or with no way to ask while working, the card still ends the
   turn and the answers are the next message. A PreToolUse hook can answer the card
   instead (Claude Code's way; pass 6 below). Tests: `test/askuser.test.mjs`.

   **Claude Code's other tools, copied** (the owner, 2026-11-14: "start fixing and
   filling in gaps on those tools" and "Do all the talk to you tools execpt for the
   notify one"; each from Claude Code's docs and, where they say nothing, its own
   program, 2.1.323 to 2.1.325):
   - *Input checks before hooks* (`coder-inputs.mjs`): a tool's input is fixed or
     refused, in Claude Code's words, before any hook or card; a fix is told after
     the call's answer as Claude Code's "Note: …". A tool's result object reaches its
     PostToolUse hooks behind `FACTS_MARK` (`printedAnswer` in `coder-tools.mjs`,
     `factsAnswer` in `coder-agent.mjs`). Tests: `test/tool-plumbing.test.mjs`.
   - *grep and glob* (`coder-search.mjs`): Claude Code's Grep and Glob on one ripgrep
     runner: their inputs, outputs, pages and limits, notes and errors. Kept, the
     owner's choice: nothing outside the project, nothing in `.git`. Tests:
     `test/search.test.mjs`.
   - *lsp* (`coder-lsp.mjs`; its servers kept for the chat by `coder-lspd.mjs`):
     Claude Code's LSP tool as its TypeScript and Python plugins run it: its 9
     operations and answers, and a file's problems after a write or an edit as its
     `<new-diagnostics>` note. Tests: `test/lsp-tool.test.mjs`.
   - *web_fetch* (`coder-webfetch.mjs`; the pre-approved sites and domain rules in
     `coder-webfetch-sites.mjs`, which loads no Node module, for the Worker): Claude
     Code's WebFetch: its fetch and redirects, its Markdown, the 15-minute page cache,
     `offset`, and its reader prompt (the chat's own model at low effort). Kept, the
     owner's choice: private addresses refused, and the reader's line against a
     page's instructions. Tests: `test/webfetch.test.mjs`.
   - *web_search* (`coder-websearch.mjs`): a tool like Claude Code's WebSearch, each
     search its own Grok request with xAI's web search alone, Claude Code's result
     text, and the chat's budget (200, refilling about 100 an hour). No other request
     carries xAI's search. Gloopy has it too. Tests: `test/websearch.test.mjs`.
   - *task_create, task_get, task_list, task_update* (`coder-tasks.mjs`) in place of
     `todo`: Claude Code's four Task tools, as its cloud sessions have them; one list
     a chat, kept beside its memory; TaskCreated and TaskCompleted hooks. Gloopy
     keeps its `todo`. Tests: `test/task-tools.test.mjs`.
   - *Plan mode and exit_plan_mode* (`coder-plan.mjs`, its words, tool and checks;
     `coder-plan-file.mjs`, the plan file, for the machine only, so the Worker loads
     no Node module through `coder-perms.mjs`): each chat's plan file beside its
     memory, never in the project; plan mode's full reminder; the card shows the
     file's plan, which the owner can edit before approving. Tests:
     `test/plan-mode.test.mjs`.
   - *request_secret*: Claude Code's request_credential, its description and inputs
     word for word; the card waits in the turn ("saved", and Coder retries; a
     decline is "Denied by owner"). Tests: `test/request-secret.test.mjs`.
   - *get_environment, update_environment, create_environment, switch_environment*
     (`coder-envtools.mjs`; Coder's server side in `src/coder-envapi.mjs`) in place
     of `propose_env`: Claude Code's four cloud environment tools. Each call's form is
     checked before any hook, then against the environment as it is now; the card
     shows exactly what changes; the owner's approval is checked again. Tests:
     `test/env-tools.test.mjs`.
   - *Coder's logo* (`public/coder-logo.js`, `public/coder-logo.css`): a typewriter
     drawn in SVG, in Coder's tab, its chat's bar and its empty chat; it types while
     Coder's open chat runs, and one line on a hover or a click. Tests:
     `test/coder-logo.test.mjs`.

   **Permission modes** (owner, 2026-11-09: "lets build the permission things", with
   the Claude app's Mode menu), like Claude Code's cloud sessions: Auto, Accept edits
   and Plan, in a menu beside the model and effort (Ctrl/Cmd+Shift+M, then 1–3), kept
   per chat (`meta.mode`; new chats start in the last pick other than Plan) and
   changeable while Coder works (the machine's `/mode`, from Coder's next step on).
   `container/coder-perms.mjs` decides each step, with Claude Code 2.1.319's own
   read-only lists (each command's safe options) and its rules (`Bash(npm test *)`,
   `WebFetch(domain:…)`; deny, then ask, then allow; kept per repository on the
   owner's account, `rulesOf`). Auto runs everything with Coder's own checks; Accept
   edits runs reads, file edits and `mkdir`/`touch`/`rm`/`rmdir`/`mv`/`cp`/`sed -i`
   inside the project and asks for any other command, and for a web page that is not
   one of Claude Code's pre-approved documentation sites; Plan asks for anything that
   changes something and ends with `exit_plan_mode`. A question is a card the step
   waits on, inside the job (`deps.ask` on the machine, the owner's answer through
   `/answer`): Yes, "Yes, and don't ask again for …", "Yes, and switch to auto mode",
   No (a note can go with it; No alone ends the job, with Claude Code's words). A
   plan is approved with "Yes, and use auto mode" or "Yes, and accept edits", and
   Coder goes on in the same job. Protected files, very long commands and, outside
   Auto, dangerous removals use the same card. Tests: `test/permissions.test.mjs`.

   **Three more of Claude Code's Bash behaviors** (owner, 2026-11-09: "Yes do that"),
   each turned on by the environment's variables under Coder's names:
   - The **5 GB stop** holds in the background too: the machine counts each command's
     output as it passes and kills one past 5 GB (exit 137), with Claude Code's line
     "Command killed: output file exceeded 5GB" at the end of its output (`SIZE_KILLED`).
   - **`CODER_TOOL_MEMORY_LIMIT`** (Claude Code's `CLAUDE_CODE_TOOL_MEMORY_LIMIT`, e.g.
     `4G`; `0`/`off` turns it off): one memory cgroup per chat (`coder-bash-<project>`,
     made as Claude Code makes its own, `toolMemoryCgroup`), and every command of the
     AI's and the owner's `!` starts in it through Claude Code's `sh` wrapper
     (`CG_WRAP`). No cap when it cannot be set up; the machine's log says why.
   - **`CODER_BASH_EDIT_DIFF=1`** (Claude Code's `CLAUDE_CODE_BASH_EDIT_DIFF`): the files
     a foreground command changed, under its step ("Updated src/cart.js +1 −1" with its
     lines; up to 5 files, the others by name). Taken before and after the command by
     the tools script (`snap`, `snapdiff`), as the AI's user, with a private index and
     object folder, so root's git folder is only read. None for a read-only command,
     one in the background, or a git command that moves the work tree.
   Whatever root starts for the AI's commands is named in full (`NSENTER`, `SETPRIV`
   in `container/coder-room.mjs`): the AI's PATH starts with folders the AI can write.
   Tests: `test/bash-last3.test.mjs`.

   And the last of them (owner, 2026-11-09: "anything else from the batch docs ?"):
   background commands of a chat idle for 30 minutes are stopped under critical memory
   pressure (`checkPressure`: the kernel's memory stall over 7.5% of the time, and
   MemAvailable under 10% and under 4 GiB; `CODER_DISABLE_BG_SHELL_PRESSURE_REAP=1`
   turns it off); `CODER_SHELL_PREFIX` wraps each command (`shellPrefixOf`); the effort
   level is `GOFARTHER_CODER_EFFORT` in each command's environment; and the permission
   checks read a `"$PWD/…"` word as that path and judge each part of a command from the
   folder it runs in (`c.dir`, unknown after a `cd` in a subshell, function or `$(…)`).
   Tests: `test/bash-final.test.mjs`.

   A third pass through the docs (owner, 2026-11-10: "Ok yes do that"): a command's
   writes are checked where they really land, links followed (`realPath` and `leadsTo`
   in `container/coder-bashcheck.mjs`): one through a link to a protected file is asked
   about in every mode, one through a link out of the project too (card kind `link`;
   an allow rule approves a file command, never a redirection's file). Each of the
   chat's commands carries a mark (`GOFARTHER_CODER_TASK`, `TASK_MARK` in
   `container/coder-freeze.mjs`): a stop ends every process carrying it (`endMarked`),
   and the end-of-job sweep keeps a running command's marked processes even outside
   its process group (`keepMarks`). Deny and ask rules can name one of the call's
   settings, `Bash(run_in_background:true)`, `Bash(timeout:*)` (`settingSpec`);
   `Bash(command:…)` never matches (kept with Claude Code's warning since the side-by-side, below). In Accept edits and Plan these ask
   too: a loop over one of the shell's own variables (`shellVariable`), an operator
   with nothing after it (`dangling`), an exec wrapper or `find` action an exact rule
   doesn't name, Docker pointed at another daemon, and a redirection to a wildcard
   name or a `<` read after a `cd`. Tests: `test/bash-pass3.test.mjs`.

   A fourth pass (owner, 2026-11-10: "Ok do that too"): seven more commands Claude
   Code 2.1.321 runs without asking in Accept edits and Plan, each with its checks
   (`lsof`, `ss`, `tput`, `fd`, `fdfind`, `docker logs`, `docker inspect`;
   `otherDaemon` is Claude Code's full list of flags that point Docker at another
   machine). And Claude Code's optional read block
   (`permissions.blockReadsOutsideWorkingDirectories`), here the environment's
   `CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES`: with it on, a command that reads
   outside the project (links followed), or one whose reads can't be traced (a
   second `cd`, a subshell, a computed or wildcard path, inline or stdin code, a
   setting in front, an unsafe `sed` script), asks in every mode (card kind
   `readblock`, `readBlockWhy` in `container/coder-perms.mjs`, with each command's own
   rule for which words are paths, `READ_PATHS`); and `read`, `grep`, `glob` and
   `lsp` outside the project are refused (`READ_BLOCKED`). Coder's own folders (the
   background logs and saved long outputs, `ownDirs`) stay readable. Tests:
   `test/bash-pass4.test.mjs`.

   A fifth pass (owner, 2026-11-10: "go check again trhe docs", then "so?"), from
   what Claude Code 2.1.321 does before each command and its docs' error reference.
   Every command starts with `commandPrefix` (`container/server.mjs`): the shell
   snapshot, `shopt -u extglob` (`EXTGLOB_OFF`, so `!(…)` stays a syntax error, as
   Coder's checks read it), and `pkill`, `pgrep` and `pidwait` that add procps'
   `--ignore-ancestors` (`PROC_WRAPPERS` in `container/coder-checks.mjs`: before,
   `pgrep -f x` found the command's own `bash -c` shell, and `pkill -f` ended it).
   The old refusal of `pkill node` is gone (the sandbox can't see Coder's service).
   Commands get `GIT_EDITOR=true` (before the owner's variables, so theirs wins) and
   `AI_AGENT=gofarther-coder` (`AGENT_MARK`). Rules: Claude Code's errors for a
   malformed rule (`ruleProblem`), and its warnings for one it keeps
   (`ruleWarning`: an allow rule's `*` before the command's own word, `starBeforeCommand`;
   `*` mixed with a trailing `:*`; a `:*` not at the end), shown in the rules list; a
   trailing `…:*` is a literal prefix (`bashSpecMatches`). And Claude Code's privacy
   check: a command holding the account's email with a User-Agent setting is refused
   (`namesUserAgentWithAddress`, `ACCOUNT_EMAIL_REFUSED`); the Worker sends only the
   address's length and SHA-256 (`emailMark`). Tests: `test/bash-pass5.test.mjs`.

   The side-by-side with Claude Code 2.1.322 itself (owner, 2026-11-10: "test it with
   claude code and coder", then "ok do that": copy Claude Code exactly). Every reason a
   command asks is Claude Code's own sentence, seen from it running the same commands
   (`PARSE_ERROR`, `VAR_UNCHECKED`, `blockedWhy`, `needsWhy`, `sensitiveWhy`,
   `linkOutWhy`, `MULTI_PARTS` … in `container/coder-perms.mjs`, with "Coder" for
   "Claude Code" and Coder's setting names), in its order: a sensitive file first, then
   more than one `cd` (`MULTI_CD`, which now asks too), then one part's reason or the
   list of parts that need approval. The card shows that sentence alone. A read outside
   the project (`cat /etc/hostname`, `ls ../`, `cat ~/.bashrc`, `ls $HOME/..`) now asks
   in Accept edits and Plan, as in Claude Code (`pathArgs`, each command's own rule for
   its paths; `$HOME` read as the home folder); Coder's own folders stay readable. The
   read block says Claude Code's words (`RB_OUTSIDE`, `rbUnsure`, `RB_SED`; the file
   tools: `READ_BLOCKED(path, dirs)`); code on stdin counts only when something is fed
   to it (`afterPipe` in `container/coder-shell.mjs`). Rules Claude Code keeps are kept
   (`ruleKept`, `ruleSaved`): `Bash(command:…)` and a rule naming no known tool, a deny
   or ask one with Claude Code's warning and row ("never matches", "matches no tool");
   content that starts with a name and a colon (`git:* status`) is not checked; each
   row starts with its kind ("Allow rule …"). Tests: `test/bash-side.test.mjs`. And
   with the read block on, every program's words that name a file that is there are
   checked too, as Claude Code does (`namedWhy` in `readBlockWhy`; `pathExists` gives
   the machine's view): `less /etc/passwd` asks; `xargs` and words worked out when the
   command runs ask; Claude Code's twelve exempt programs and its safe list for
   settings in front (`RB_SAFE_ENV`) and its inline-code map (`RB_RUNNERS`).

   **The auto mode checker** (owner, 2026-11-10: "yea do the paid second model too"):
   Claude Code's auto mode classifier, `container/coder-checker.mjs`. In Auto (and a
   job from GitHub), a bash command that the owner's narrow allow rules do not approve
   in full, and a web fetch of a page no rule or documentation site covers, is
   judged first by one more call to the chat's model (low effort, no tools), which
   answers allow or block with a rule's name (Claude Code's rule names and the lists
   its docs give: `CHECKER_RULES`). In Plan it judges the commands Plan would ask
   about (`CODER_USE_AUTO_MODE_DURING_PLAN=false` asks as before). It sees the
   owner's messages, Coder's earlier actions and the project's instructions, never a
   command's output or Coder's own words (`checkerTranscript`). A block: the command
   never runs, the step says "Blocked by auto mode · [rule] reason", and Grok is told
   Claude Code's own sentence (`autoDenied`). No verdict blocks too
   (`checkUnavailable`). After 3 blocks in a row or 20 in all, auto mode pauses: the
   owner is asked on a card and their Yes resumes it (`checkerState`, per chat, kept by
   the machine's service). Broad allow rules are dropped in Auto (`droppedInAuto`).
   The machine's service turns it on (`checker: true`); each check's cost is counted
   with the job's. Tests: `test/auto-checker.test.mjs`.
   Since 2026-11-13 (the owner: "yea do those 2 things") read-only commands wait for the checker too, as in
   Claude Code's cloud sessions, whose review runs on its server ("read-only and sandboxed shell commands
   wait for that review and are blocked if it flags them"; its 2.1.323 holds a command when any part of it
   was allowed only for being read-only, for Bash, PowerShell and Monitor): only a command the owner's allow
   rules approve in full, or an exact rule for the whole command, skips it (`partsAllowedByRules`). A job
   from GitHub with Auto mode turned off still runs read-only commands unreviewed, as Claude Code's
   "default" mode does; one that changes things is refused, and Grok is told Claude Code's words for a session
   that can't ask ("Permission to use Bash has been denied. …", `noPromptDenied`; no checker ran), the chat
   "Not run: auto mode is off in your settings, …" (`AUTO_OFF_GITHUB`, CD568). Test CD370 and
   `test/rewind-restore.test.mjs`.
4. When a job ends, Coder commits and pushes its branch. A **pull request**
   opens only when the user presses Create PR or Create draft PR in the chat,
   or asks Coder for one, as on Claude Code. The user merges it on GitHub.
   Coder never pushes to the main branch.

**A job keeps going when the tab is closed** (like Claude Code, 2026-11-06).
Each job goes on a watch list (`coder/running-jobs/` in Coder's storage) when
it starts. Every minute the Worker asks Coder's machine about each one, as its
owner, through the same route the page uses. That keeps the machine awake (it
sleeps after 10 quiet minutes) and saves the job when it ends: pushed to its
branch, the whole chat kept. A tab and the minute's run never save a job twice
(the machine hands its end out once). A job leaves the list when it ends, or
after 2 hours (a job works for 45 minutes at most).

**And the machine never sleeps with work on it** (the old builder's way).
When it has had no request for 10 minutes, the container library is about to
stop it; first `CoderContainer.onActivityExpired` asks it (`/busy`, behind its
control key) whether a job is working or has ended without being saved, and
then it stays awake: 2 hours at most for a working job, 30 minutes for one
waiting to be saved. A machine that does not answer within 5 seconds, an idle
one, or one past those times sleeps as before (`holdDecision` in
`src/coder-watch.mjs`).

**The chat is saved as it goes** (like Claude Code, 2026-11-07). The machine
sends a job's new steps to the Worker every 3 seconds, and this job's part of
the conversation every 15 seconds, with the job's own pass
(`/api/coder/live`, `src/coder-live.mjs`). The Worker keeps them sealed
(encrypted with `CODER_TOKEN_KEY`, as the owner's values may be in them) in
parts of 200 steps until the job is saved, then deletes them. If the machine
is lost mid-job (it restarted, slept, stopped answering, or was gone when Stop
was pressed), they are put back in the chat with the owner's values hidden,
Coder is told the job was cut off and its unsaved changes are gone, and the
page loads the saved chat. Only the real service sends (`createApp`'s
`liveFetch`, given by its entry point); a machine made in a test never does.

**Coder's machines on Fly.io** (owner, 2026-11-07, like Claude Code's VMs).
With `CODER_MACHINES` "fly" (the deploy sets it when the `FLY_API_TOKEN` secret
is there), each chat's machine is a Fly Machine (`src/coder-fly.mjs`): a small
VM made from the same image (`container/Dockerfile`), with its own Fly volume
at `/data` (`CODER_DATA`), where the chat's projects, git folders and memory
live (`dataDirs` in `container/server.mjs`). The Worker reaches it through
`https://<app>.fly.dev`, pinned with `fly-force-instance-id`. Fly's front door
cuts a request quiet for 60 seconds, so the machine's answers carry a space
every 15 seconds and their real status last (`x-coder-keepalive`), unwrapped
by the Worker. Only a job's start or an Undo makes a machine. An asleep one is
started, and given the newest image only then, never under a job. Every
minute, awake machines with nothing to do for 10 minutes are stopped (a job
working, or waiting to be saved, keeps one on); machines unused for 30 days
are removed with their disks; machines or disks no chat knows are removed
after an hour. The setup script's marks stay on the machine's own disk, so a
restarted machine runs the setup again, unless its whole disk was kept: the
machines ask Fly for that, and for a disk of up to 20 GB, 30 with the chat's
kept one, like Claude Code's machine (`rootfs` { persist "restart", size_gb
20 }; if Fly refuses it, the older `persist_rootfs` "restart" at Fly's default
8 GB, then neither: `CONFIG_TRIES`; Fly bills a sleeping machine's disk by
what is used), so a sleeping machine wakes with what was installed and the setup
does not run again, like Claude Code. A new Coder version still starts the
machine's own disk fresh. `/health` says whether it was kept (`kept`). The deploy makes the Fly app once
(`gofarther-coder-machines`, org `personal`, region `iad`), its addresses, and
no secrets on Fly.io itself (it takes away the old shared `XAI_API_KEY` and
`CODER_CONTROL_KEY`: the Grok key stays on the Worker, and each machine's own
lock key, `controlKeyFor` its Fly name in `src/coder-control.mjs`, is in its
own settings; a machine from before keeps the shared one, `rec.lock`, until
its next update), builds
the image, sends it to `registry.fly.io`, and gives the Worker the image
(`CODER_FLY_IMAGE`) and the token. Picking "cloudflare" on the deploy button,
or removing the secret, goes back to Cloudflare's containers.

**The size** (owner, 2026-11-07: "4 CPUs, 16 GB", the size of Claude Code's
machine; "Grow to 50 GB"). Each chat's machine has 4 of Fly.io's
"performance" CPUs, which always run at full speed, and 16 GB (`flySettings`;
`CODER_FLY_CPU_KIND`, `CODER_FLY_CPUS` and `CODER_FLY_MEMORY_MB` change it,
within Fly's rules). Before, it had 2 "shared" CPUs, which Fly slows to 1/16
of a CPU each after a short burst, and 4 GB; a shared machine's disk is also
4 times slower. A chat's work disk starts at 10 GB and Fly.io adds 10 GB each
time it is 80% full, up to 50 GB (`diskMax`, `CODER_FLY_DISK_MAX_GB`; Fly's
auto-extend on the machine's mount). A new chat's disk is placed on a server
with room for that size (Fly's `compute` on the volume). If Fly.io cannot give
a chat's machine the size, it gets the size chats had before (`FLY_SMALL`,
`SIZE_TRIES`), so the chat still works, and keeps it until Coder's next
version, since each try would start its own disk fresh. A machine made before
gets the new size when it next wakes, never under a job (`flyShape`, recorded
as `rec.shape`). Fly.io bills a running machine by the second: about $0.25 an
hour at this size ($0.035 before), and a sleeping chat's work disk at $0.15 a
GB a month.

**All of Claude Code's tools** (owner, 2026-11-07: "can we install all the
tools we need?"). The machine is Ubuntu 24.04 on x86_64, like Claude Code's.
`container/Dockerfile` makes two images: `core`, the default, with what Coder
itself needs (Cloudflare's backup machines, whose limit is 8 GB an image and
50 GB in all), and `full` (`--build-arg CODER_IMAGE=full`, Fly.io's machines)
with the tools Claude Code's machine comes with: Python with uv, poetry,
pytest, mypy, black, ruff and conan; Node 22 and 24, nvm, npm, yarn, pnpm,
bun, eslint and prettier; Ruby 3.1, 3.2 and 3.3 with rbenv (built from
ruby-lang.org's source by `tools/build-ruby`); PHP 8.3 and Composer; Java 21,
Maven and Gradle; Go; Rust; C and C++ (gcc, clang, cmake, ninja); Docker
without admin rights (rootless: `tools/docker` starts dev's own engine with
the first docker command); PostgreSQL 16 and Redis 7, installed and not
running (`service postgresql start` works for dev: `tools/service` asks sudo,
which allows exactly those eight commands, `tools/coder-services.sudoers`);
Chrome for Testing with chromedriver; gh, yq, tmux, vim, nano; and
`check-tools`. And what Claude Code's machine itself has beyond its docs' list:
ffmpeg, ImageMagick, pdftotext, pandoc, strace, lsof, valgrind, netcat,
xvfb-run, Python's document and data libraries (numpy, pandas, openpyxl,
python-docx, python-pptx, pypdf, pdfplumber, reportlab, markitdown, requests,
pillow), and Playwright with its own Chromium (`require("playwright")` works
from any folder: `NODE_PATH`, `PLAYWRIGHT_BROWSERS_PATH`). Each download is checked against its maker's sum. Every tool
belongs to root, and root's PATH holds only root's folders (the setup
script's apt lines run with `cleanEnv(null, { root: true })`). The AI's
commands have a home of their own (`cleanEnv`: `/home/dev`, or on Fly.io
`/data/home` on the chat's kept disk), where what they install for themselves
and every download cache go, never in a project. On the full image Coder is
told its tools (`MACHINE_TOOLS`). The deploy builds the full image only when
that version is not on Fly.io yet, and then builds only Coder's own stage: the
Dockerfile up to that stage (every tool) is its own image on Fly.io,
`coder-tools-…`, named after that text, `container/tools` and the month, so it
is built again only when those change or once a month (`test/deploy-tools.test.mjs`).
Each upload to Fly.io is tried up to five times. `.github/workflows/check-coder-image.yml`
builds both images whenever the machine changes on a branch and tries every
tool as dev (`test/machine-tools.sh`).

**A job is "running" before the machine is handed it.** The machine sets up
first (the clone, the setup script), and Cloudflare stops a request whose tab
has closed, so the chat is marked running and put on the watch list first; a
start that fails puts the chat back as it was. A machine that does not have
the job yet is given 8 minutes before the job counts as lost (`START_GRACE_MS`;
a machine being made or given a new version first fetches the image). The
setup script never gets the owner's saved keys or variables, like Claude
Code's: the gate adds no key while it runs.
Coder is reminded once, before it finishes, to offer an install for a setup
script (the owner's "2", 2026-11-06) only as Claude Code's cloud does it (its
environment tools: save the set-up "without waiting to be asked" when the
environment has no setup script, with "commands you ran yourself in this session
and saw work"): installs this job ran that worked (`triedCommands`, this job's
calls only), and only when the chat's environment has no setup script. Since
2026-11-13 (CD73); it had counted installs that were refused and never ran, and
came when a setup script was there.

**Sign-in is both steps, every time** (the audit, 2026-11-06). The password
step gives the page a 15-minute ticket and ends Supabase's own session for it;
the emailed code is only taken with that ticket. The code step gives the
session and the Worker's proof, which the page sends with every call
(`x-coder-proof`). A Supabase session without the proof gets "Sign in again."
Tickets and proofs are signed with a key made from `CODER_TOKEN_KEY`; without
it nobody can sign in.

- **The password the Worker remembers.** Anyone with the inbox alone could ask
  Supabase for a code and then set a new password there. So the first time an
  account's password passes the password step here, the Worker keeps its own
  scrambled copy (`coder/<user id>/signin-pin.json` in the bucket), and after
  that the password step wants that same password too. Coder has no page to
  change a password. **If a password is ever changed at Supabase** (the
  dashboard, a reset email), Coder refuses it with "That email and password do
  not match." until that one file is deleted; the next sign-in then remembers
  the new password. Until an account's first password step here, nothing is
  remembered for it, and the same is true right after `CODER_TOKEN_KEY` changes.
- **Wrong codes are counted.** Each email gets 5 code checks per 15 minutes,
  before Supabase is asked. Then the card says to wait and start again. A right
  code starts the count again; a new password step does not.

**The code is never stored with us.** Coder's bucket keeps the chat, the project
list and the GitHub connection (encrypted with `CODER_TOKEN_KEY`), and for
sign-in the remembered passwords (scrambled) and the code counts.

**The GitHub login never enters Coder's machine** (2026-11-07, like Claude
Code: "GitHub credentials ... never enter the session VM"). The machine is given
only a short-lived pass for its chat (`gitAccess` in `src/coder-git.mjs`: one
chat, one turn, 3 hours). Its git, run by the service as root, talks to the
Worker's git address (`/api/coder/git/<owner>/<repo>.git/...`) with that pass;
the Worker checks it, adds the owner's GitHub login, and passes the request on
to GitHub. Git may read the chat's own repositories and push only to the chat's
own branch (made or moved, never deleted), plus an empty repository's very
first main; no tags (like Claude Code's proxy, which "rejects branch deletions
and pushes of anything other than a branch"). Every command the AI runs is
started as the unprivileged `dev` user, with no secrets in its environment.
A test's machine (no `gitVia`) still uses its own remote.

**A clone that did not finish is made again** (live test, 2026-11-07). A first
clone that fails removes its git folder, so the next job clones afresh. A git
folder with no commit (left by an older version, whose failed clone kept it)
is cleared and the repository cloned again, keeping what the setup made in the
project folder; a finished clone whose `.git` pointer was removed gets it back.
Before this, such a chat's commands found an empty folder with no git at all.

**`gh` uses your GitHub login, outside the machine too** (owner, 2026-11-07,
item 6; like Claude Code's GitHub proxy, whose docs say `gh`'s requests "under
the proxy-injected placeholder go out with your real credentials substituted").
In a chat on a GitHub repository, the machine's gate sends `api.github.com` to
the Worker with the job's pass (whatever the network setting), and the Worker
puts the owner's login in (`githubApi` in `src/coder-egress.mjs`): only for the
chat's own repositories, as `/repos/OWNER/REPO/...` (another repository:
"GitHub access to this repository is not enabled for this session. …"; a path
that is no repository's: "This GitHub API path is not available: …", both
Claude Code's cloud words, as GitHub's JSON so `gh` shows them); GitHub's GraphQL, which
`gh pr` and `gh issue` use, is refused with Claude Code's message naming
`gh api repos/{owner}/{repo}/...`; a job started from GitHub may only read. The
commands see `GH_TOKEN` and `GITHUB_TOKEN` as `proxy-injected`, as on Claude
Code's machine, unless the owner set their own in the environment's variables.

**Read-only repositories** (owner, 2026-11-07, item 5; like Claude Code, whose
docs say "a session can clone any public repository" and pushes back "only when
your GitHub connection has push access"). A chat opens on any repository GitHub
shows the owner (`repoAccess` in `src/coder-github.mjs`): the picker's list, or
any public repository typed as `owner/name` or its address. A public repository
GitHub keeps from the owner's login (Coder's app is not on it) is read with no
login at all, by the Worker and by its git address. One the owner cannot push to
is **read-only** (`meta.readOnly`; also a chat's other repositories, one by one):
- each job's work is committed on the chat's branch **on Coder's machine** and
  never pushed (`pushRepo` with `noPush`); the chat says "Kept on Coder's machine";
- **See changes** comes from the machine's own git (`localChanges`, the same
  compare as GitHub's, against the base or any branch, fetched when needed), and
  **Download patch** gives the commits as one file `git am` applies
  (`localPatch`, `GET projects/:id/patch`, saved through the page's one door);
- no pull request (no buttons; the Worker and Coder's `pull_request` tool
  refuse), no auto-fix, and no branch for GitHub's news; Undo and Rewind stay
  on the machine;
- Coder is told (`readOnlyNote`), and `gh` may only read there.
A job started by @coder on GitHub still needs push access (`needPush`), like
Claude Code's GitHub app ("the triggering user must have write access").

**Your Grok key never enters Coder's machine either** (owner, 2026-11-07,
step 1 of: the Grok key out, each machine its own lock key, a sealed network
room, the master key inside it). Each job is given a short pass for its AI calls
(`modelAccess` in `src/coder-model-gate.mjs`: one chat, one turn, 3 hours); the
machine's `coderSend` posts each call to the Worker's `/api/coder/model` with it
(`modelTarget` in `container/server.mjs`), and the Worker checks the pass and
the chat's current turn, allows only Coder's own models, adds `XAI_API_KEY` and
passes the call to xAI. Neither Fly.io's machines (the deploy takes the old
Fly secret away) nor Cloudflare's backup machines are given the key.

**Grok's prompt cache and the effort** (owner, 2026-11-10: "something kind of
cache [for] the model", and "can you do the effort level on low and make sure
it's actually on low"). The Worker puts the chat's own `prompt_cache_key` on
every call it passes to xAI (`cacheKeyFor`: a hash of the chat, the same for all
its calls, Coder's, its checker's and its summaries'), so xAI sends them to the
server that has the chat's start cached; cached input costs a quarter of the
input price. Coder's effort is Low unless the owner picks another (`CODER_MODELS`);
a "high" an account saved before then counts as not chosen (`savedEffort`, and
`pickV` 2 on picks the page saves from now on). Each call records what it really
used (`coderSend`: cached and reasoning tokens, the effort sent and the one xAI
says it used), and the chat's record keeps the last message's sum as `usage`
(`usageSummary`, the auto mode checker's calls apart). Tests CD378 and CD379.

**Settings** (owner, 2026-11-10: "the setting put it in setings"). Settings, in
the account menu, keeps three choices on the account (`prefsOf`, `prefsChange` in
`src/coder-routes.mjs`): the longest a background command may run (2 hours, as in
Claude Code, or 4, 8, 12 or 24 hours, as Claude Code's `BASH_MAX_TIMEOUT_MS` raises
it); whether Stop also ends what a command left running on its own, with `setsid`
or `timeout` (on unless turned off); and the low-disk warning (Claude Code's
`CLAUDE_CODE_WARN_DISK_FREE_GIB`: off, or 1, 2, 5, 10 or 20 GB; 2 GB unless
changed): Coder is told once, in Claude Code's words, when the work disk has less
free than that, and the chat shows it. Each message takes them to the machine
(`machinePrefs`, then `prefsIn` and `usePrefs` in `container/server.mjs`), and the
Worker keeps a chat's machine awake as long as its background limit allows
(`watchBackground`'s `maxMs`). Tests: `test/settings.test.mjs`.

**The monitor** (Claude Code's Monitor tool; owner, 2026-11-10: "yea do all 4").
`monitor` runs a command in the background the bash way (the same checks, rules
and questions), and each line it prints on stdout comes to Coder as an event:
before each of Coder's answers it is given the lines printed since the last one,
and how the monitor ended, once (`readMonitor` and `monitorNews` on the machine,
`monitorSaid` in the agent). Its stderr goes to a file of its own
(`~/.coder-monitors/<mark>.err`), so its output file holds only its events. Its
deadline is 5 minutes unless asked, 30 at most (`monitorMs`); one that prints more
than 400 lines at once is stopped; one whose command ends in its first second gives
its lines back at once. An idle chat is woken for its lines as for a background
command that ended (`untoldOf`), and the chat shows each event under an eye. Coder's
old `monitor` (a look at a background command's output) is gone, as Claude Code's
TaskOutput is: Coder reads the output file. Tests: `test/monitor.test.mjs`, CD39.

**Read(…) and Edit(…) rules** (Claude Code's file rules; owner, 2026-11-10: "yea do
all 4"). The rules list takes `Read(path)` and `Edit(path)` besides Bash and
WebFetch rules, written as in a .gitignore (`container/coder-filerules.mjs`):
`//path` from the machine's root, `~/path` from Coder's home, any other path from
the project (Coder keeps rules per repository, as Claude Code's local settings);
a bare name matches at any depth; `src/**` matches a `src` folder at any depth in a
deny or ask rule but only the top one in an allow rule; `!name` carves out of the
plain relative rules before it; a deny rule also matches where a link leads, an
allow rule must match both. They apply to Coder's file tools (`fileToolDecision`:
read, grep, glob and lsp by Read rules, write and edit by Edit rules and Read deny
rules, in Claude Code's words; a search's results leave out what a deny rule
covers), to @-mentions, and to the files commands name (`commandFiles`: cat, head,
sed, `< file` by Read rules; `> file`, tee, rm, mv, cp, mkdir, touch by Edit rules),
in every mode. An allow rule opens a path outside the project to commands (never a
protected file, and never a write in Plan), and "Yes, and don't ask again" on a cd
outside saves that folder's Read rule. Whole-tool `Write`, `Grep`, `Glob` and `LSP`
rules apply to Coder's tools; a path in one of them is kept and never matches, with
Claude Code's warning. Tests: `test/file-rules.test.mjs`.

**Hooks** (Claude Code's hooks; owner, 2026-11-10: "yea do all 4"). The owner's own
hooks (Settings, a box of Claude Code's settings JSON, checked by the Worker:
`hooksSetting`, `machineHooks`) and the repository's (`.claude/settings.json` and
`.claude/settings.local.json`, read inside the project and never through a link,
not in a job from GitHub: `hooksForTurn` in `container/server.mjs`) run on Coder's
machine as Coder's commands do, the event's JSON on stdin (a file the machine
writes, `@REQUEST`), their stderr kept apart from their stdout, with
`CLAUDE_PROJECT_DIR` and `CLAUDE_CODE_REMOTE=true`. Events: SessionStart (a chat's
first message, and after a summary), UserPromptSubmit, PreToolUse,
PermissionRequest, PostToolUse, PostToolUseFailure, Notification (a card that
waits), Stop (8 times in a row at most), PreCompact and PostCompact. Matchers,
`if`, deduplication, the exit-code table (0, 2, other), JSON decisions
(`permissionDecision`, `updatedInput`, `additionalContext`, `decision: "block"`,
`continue: false`, `systemMessage`, `updatedToolOutput`) and the words Coder is
given ("PreToolUse:Bash hook error: [cmd]: …") are Claude Code's
(`container/coder-hooks.mjs`). A hook's allow skips a mode's question and the auto
mode checker, never a deny or ask rule or Coder's own safety checks;
`disableAllHooks` turns them all off. Tests: `test/hooks.test.mjs`.
A PermissionRequest hook's no (since 2026-11-13, CD571): Coder is given what
Claude Code 2.1.323 gives its model, the hook's own message, or `HOOK_DENIED`
("Permission denied by hook") when it gave none, never the words for the owner's
own No; the step says "Not run: your PermissionRequest hook said no: …" and is
marked "✕ denied by hook" on the page; the turn goes on (its `interrupt: true`
stops Coder, as before).

**The rest of Claude Code's hooks** (owner, 2026-11-10: "yea do all of them").
Hook kinds: `command`; `http` (the event's JSON posted from Coder's machine through
the chat's network list, `coder-tools.mjs`'s `http_hook`; headers' `$VAR` only for
the variables both its `allowedEnvVars` and `httpHookAllowedEnvVars` name; only to
addresses `allowedHttpHookUrls` lets through); `prompt` and `agent` (Coder's own
model at low effort answers `{"ok": …}`; an agent hook may first read, grep and glob,
up to 50 turns, under the owner's Read rules), each on the events Claude Code takes
it on (`typesFor`). Fields: `async` and `asyncRewake` (run as background jobs on the
machine, marked `hook`, never listed as the chat's background commands; what they
say reaches Coder at its next step or message, `hookNews`; an asyncRewake one that
exits 2 wakes an idle chat), `onFailure: "block"`, `statusMessage`,
`continueOnBlock`, `sessionTitle` (the chat's name) and `watchPaths`. More events:
PostToolBatch (after a round, its calls and results), PermissionDenied (after the
checker refuses a call; `retry: true` is said to Coder), StopFailure (when the
model call fails, matched on the error's kind), CwdChanged (after a cd), FileChanged
(the files its matcher names, and watchPaths, looked at before each answer) and
SessionEnd (when the machine stops, within Claude Code's 1.5-second budget,
`CODER_SESSIONEND_HOOKS_TIMEOUT_MS`). SessionStart, CwdChanged and FileChanged
hooks get `CLAUDE_ENV_FILE`, whose exports every later command reads first. A hook
that leaves a program holding its output answers 10 seconds after it ends (the
machine's `quietMs`), and an allow, a rewrite or added context from it is not
believed, in Claude Code's words. `CODER_SHELL_PREFIX` wraps hook commands too; a
Bash PostToolUse hook gets `tool_response.bashEditDiff` when CODER_BASH_EDIT_DIFF
is on; `CODER_TOOL_MEMORY_CGROUP_EXCLUDE` names the kinds the memory cap covers
(`hooks`, `lsp`, `helper`; `none`, `all-new`), never a hook that can block.
Tests: `test/hooks-more.test.mjs`.

**A monitor on a WebSocket, and Monitor rules** (owner, 2026-11-10: "yea do all of
them"). `monitor` takes `ws: { url, protocols }` in place of a command (Claude
Code's WebSocket source): each text message is one event, a binary one comes as
"[binary frame, N bytes]", a message over 1 MiB ends the watch, and when the socket
closes Coder is told its close code (`coder-tools.mjs`'s `ws_watch`, run as the
monitor's command, through the chat's network list; never a private, link-local or
cloud-metadata address). Its input is checked in Claude Code's words (`wsProblem`).
It is refused under a rule denying every Bash command (and Coder has no monitor
tool then), asked about by the owner alone under one asking for every Bash command,
asked about without a `Monitor` allow rule (no "don't ask again"), and judged by
the checker in Auto (`wsDecision`). `Monitor` and `Monitor(…)` rules join Bash's
for a monitor's command (`monitorRules`); in Auto, every Monitor allow rule is set
aside (`droppedInAuto`). Tests: `test/monitor-ws.test.mjs`.

**CODER_SHELL** (Claude Code's `CLAUDE_CODE_SHELL`). The environment's
`CODER_SHELL` runs Coder's commands (and the owner's `!` commands) in bash or zsh,
by name or by its full path in /bin, /usr/bin or /usr/local/bin; anything else is
bash (`shellOf`). zsh is in Coder's image; in zsh, the startup file's snapshot is
zsh's (`SNAPSHOT_TAKE_ZSH`, from `~/.zshrc`), its extended patterns are off, and
the command runs through `eval`, as Claude Code runs it. Hooks always run in bash (or,
with a hook's `shell: "powershell"`, in PowerShell: pass 6 below).
Tests: CD385e.

**Auto mode rules, refusing instead of asking, and working folders** (owner,
2026-11-10: "yea do all of them"). Settings keeps the owner's auto mode rules as
Claude Code's `autoMode` block (`autoModeSetting`, `machineAutoMode`; Claude Code
reads it only from the user's own settings): `environment`, `allow`, `soft_deny`
and `hard_deny`, lists of sentences, with `"$defaults"` splicing in Coder's
built-in entries (a list without it replaces them, and saving says so); the checker
reads them in Claude Code's order (`checkerRules`, `checkerSystem`).
`classifyAllShell` sends every command an allow rule would approve to the checker
in Auto (`autoRulesCover`). "Refuse instead of asking" (Claude Code's
`permissions.denyInsteadOfPrompting`, `denyInstead`) refuses a step that would show
a card, in Claude Code's words (`DENY_INSTEAD_TEXT`), and Coder goes on; 20 in a row
end the turn. The rules list keeps a repository's working folders (Claude Code's
`permissions.additionalDirectories`, `dirs`, `dirProblem`): each one that is a
folder where the commands run (in the admin sandbox, round 5) joins the chat's
working directories (`extraDirsOf`), and Coder is told of them; one that is not
is said in the chat. Tests: `test/auto-rules.test.mjs`.

**Bash docs pass 6: the last differences** (owner, 2026-11-10: "yea do all of
them"). Tests: `test/pass6.test.mjs` (CD387 to CD398).
- *A hook answers the question card* (owner, 2026-11-11: "Want it added";
  Claude Code's AskUserQuestion with a PreToolUse hook: "echo back the original
  questions array and add an answers object"): a hook sees `ask_user` as
  AskUserQuestion (`questions`, each with `multiSelect`); its `allow` with
  `updatedInput` answers the card itself (`hookAnswers`, `answeredText`), which
  is not shown, and Coder goes on in the same turn, told in Claude Code's words
  ("Your questions have been answered: …"; "The user answered: …" when an answer
  is not one of the choices or has notes; "The user did not answer the
  questions." when none was given). Several choices are joined with ", " as
  Claude Code joins them (`joinLabels`, `splitLabels`). Its `allow` alone, or an
  ask rule on AskUserQuestion, still shows the card; answers of the wrong type
  are refused in Claude Code's words. The chat shows a note with the answers.
- *A hook's allow in Plan mode* (Claude Code's "Hook approvals in plan mode"):
  a PreToolUse hook's `allow` no longer runs a command or a WebSocket watch that
  isn't read-only in Plan mode (the card, or the checker, as with no hook); its
  `updatedInput` still applies; `allow` with `updatedInput` on `exit_plan_mode`
  approves the plan without the card, back to the owner's start mode
  (`planExit`, the Worker's `prePlanMode`).
- *Tool-name wildcards* (`toolGlob`, `toolGlobMatches`): deny and ask rules take
  `*`, `B*`, `mcp__*`; an allow one is skipped, with Claude Code's point said. A
  tool a deny rule names bare or by wildcard is no longer offered to Grok
  (`toolDenied`), Coder's other tools and `web_search` (`WebSearch`)
  included; an ask rule on Coder's other tools shows a card first.
- *The repository's own settings* (`repoSettings`, `withRepoRules`): its
  `.claude/settings.json` and `.claude/settings.local.json` give their deny and
  ask rules always; their allow rules and `additionalDirectories` only once the
  owner turns on "Trust this repository's settings" in the rules dialog (Claude
  Code's workspace trust; `setTrust`), with Claude Code's warning until then
  (`heldNote`); their `env` reaches the commands under the owner's own
  variables, minus what a repository shouldn't set (`REPO_ENV_OFF`); their read
  and write blocks and `disableAutoMode` turn on. Never in a job from GitHub.
- *`disableAllHooks`* by Claude Code's settings precedence: the repository's
  local file, then its shared one, then the owner's.
- *The working folders' instructions* (`extraInstructions`): with the
  environment's `CODER_ADDITIONAL_DIRECTORIES_CODER_MD` (Claude Code's
  `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`), each working folder's CODER.md,
  .coder/CODER.md and .coder/rules load as the project's do.
- *The write block* (outside Bash: the file tools; Claude Code's
  `permissions.blockWritesOutsideWorkingDirectories`, here
  `CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES`): write and edit refuse a path
  outside the working folders, and a repository's settings files anywhere, in
  Claude Code's words (`WRITE_BLOCKED`, `SETTINGS_WRITE_BLOCKED`); Coder's
  scratch folder and memory file stay writable.
- *Turn off Auto mode* (Settings; Claude Code's `disableAutoMode`): chats start
  in Accept edits, and Auto is offered nowhere (menu, cards, plan approval);
  the machine keeps every way into Auto out (`offAuto`).
- *Blocked sites* (an environment's network setting; Claude Code's
  `sandbox.network.deniedDomains`, `hostDenied`): refused by the gate in every
  setting, Full and a saved key's sites included, in Coder's words (`DENIED`);
  Full with blocked sites goes through the gate (`netWalled`).
- *The subprocess environment scrub and script caps* (`coder-scrub.mjs`; Claude
  Code's `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` and `CLAUDE_CODE_SCRIPT_CAPS`, here
  `CODER_SUBPROCESS_ENV_SCRUB` and `CODER_SCRIPT_CAPS`): credentials by Claude
  Code's own name and value rules leave the variables commands and hooks get
  (GitHub tokens, proxies and git's config stay; an index address loses its
  password); on by default in jobs from GitHub. With the scrub on, a capped
  script runs only so many times a chat (counts kept on the machine).
- *Per-command hosts in Auto mode* (Claude Code's `allowed_domains` on Bash and
  Monitor): a command may name hosts beyond the network list; the checker
  reviews them with the command (allow rules and hook allows approve the
  command, not the hosts); a card an ask rule shows lists them; once approved
  the command gets its own pass to the gate (`openFor`, `passOf`, in its proxy
  address), which opens them for it alone while it runs; an unlisted host is
  refused in Claude Code's words (`UNLISTED`). Refused with network None or
  without the gate; ignored in other modes and from GitHub.
- *PowerShell* (`coder-ps.mjs`; Claude Code's PowerShell tool, opt-in on Linux):
  `CODER_USE_POWERSHELL_TOOL` offers it where the machine has pwsh (the full
  image installs PowerShell 7 from Microsoft's own package list), with Claude
  Code's description, rules in the shape of Bash's (`PowerShell(...)`, aliases
  canonicalized, every part must be allowed; `psDecision`), read-only cmdlets,
  its Start-Sleep check; it runs with no profile, non-interactive, the execution
  policy bypassed unless `CODER_POWERSHELL_RESPECT_EXECUTION_POLICY`, and its
  folder kept between commands (`psCommand`). `CODER_DEFAULT_SHELL=powershell`
  runs the owner's `!` commands in it; hooks take `shell: "powershell"`.
  (What only reads, and the rest of its checks, moved to pass 7.)
  Since 2026-11-13 its script is Claude Code 2.1.323's (`psScript`): its own line before the command (`PS_PREAMBLE`,
  left out before one that must open a script, `psMustLead`), and it ends with `$host.SetShouldExit` (`exit` only in
  restricted language mode). Test CD566. pwsh starts as Claude Code starts it (`pwshRun`): `-Command` and the script,
  not `-EncodedCommand` (Claude Code's only inside its sandbox; with it, pwsh wrote errors as `#< CLIXML <Objs …>`),
  for the tool, the `!` commands and PowerShell hooks; for the tool, Claude Code's `NO_COLOR=1` and
  `PYTHONIOENCODING=utf-8:surrogateescape` unless set (`PS_TOOL_ENV`). The tables: the machine says `TERM=linux` (as
  Claude Code's own cloud machine does), which gives pwsh no width (-1), so `Get-ChildItem` printed only its
  "Directory:" line; pwsh gets `TERM=xterm-256color` (80 columns) when TERM is linux, dumb or not set (`PS_TERM`).
  Test CD569 (real bash, zsh and sh, with a stand-in pwsh).

**Bash docs pass 7: the rest, cloud only** (owner, 2026-11-11: "Yea we need to
build the rest of the batch tool, remember we are not doing local rn with only
doing cloud"). Tests: `test/pass7.test.mjs` (CD399 to CD406). Left out as
terminal-only: Ctrl+Enter's "send now" and the `/permissions` "Recently
blocked" tab (Claude Code's apps answer `/permissions` with "isn't available in
this environment").
- *PowerShell read by PowerShell itself* (`coder-psparse.mjs`): Claude Code's
  parse script, word for word, runs with pwsh on the machine as the AI's user,
  never in the project's folder (`coder-tools.mjs`'s `ps_parse`; two tries,
  `CODER_PWSH_PARSE_TIMEOUT_MS`, 5 s each; once a job per command); its answer
  is read Claude Code's way into the commands at every depth (`psTransform`,
  `psCommands`). Pass 6's check read the text, so a command hidden in brackets
  or a string (`Write-Output "$(Remove-Item x)"`) passed for read-only and got
  past deny rules: closed.
- *Claude Code's 24 safety checks* (`psSafetyWhy`), in its order and words
  (Invoke-Expression, a dynamic name, a nested pwsh, encoded parameters,
  download and run, Add-Type, New-Object outside ConstrainedLanguage's types,
  -FilePath scripts, Invoke-Item, scheduled tasks, ForEach-Object -MemberName,
  elevation, script blocks, sub-expressions, expandable strings, splatting,
  `--%`, .NET calls and types, environment writes, module loading, alias and
  variable writes, WMI), then `using`, `#Requires` and the background `&`;
  provider and network paths (`psProviderWhy`), file redirections, git beside
  a cd or an archive, writes into .git (`psCompoundWhy`). A command it cannot
  parse is asked about ("Command contains malformed syntax that cannot be
  parsed: …"), its pieces still meeting deny rules.
- *The decision* (`psDecision`): deny rules on the command or any command in
  it; then removals Claude Code never allows; ask rules; the safety checks;
  each command allowed by a rule (read ahead in full) or only reading, by Claude
  Code's table of cmdlets and their own settings (`PS_READ_TABLE`,
  `psCommandReadOnly`: no shortened setting, no variable-writing setting, no
  unusual error mode) with its paths inside the working folders; a chain or any
  statement that is not a plain pipeline asks; in Accept edits, Claude Code's
  file commands (Set-Content, Add-Content, Remove-Item, Clear-Content) inside the
  working folders run (`psEditsOnly`). In Auto, the checker judges what would ask
  (`readOnly` and `covered` say when it is not needed).
- *Remove-Item* (`psRemovals`, with rm, del, erase, rd, ri, rmdir): a system
  path (the root, a top-level folder, the home folder) or a wildcard target is
  refused in every mode, in Claude Code's words; a variable reads as empty
  (`$dir/*`); a recursive removal of the working folder or a folder above it
  asks (the checker in Auto).
- *PowerShell's own exit codes* (`psExitMeaning`): exit 1 is a normal result
  from grep, rg, egrep, fgrep, findstr, git grep and git diff, and from a search
  piped into a formatting cmdlet. *Its env files* (`psEnvLine`): the owner's
  `CODER_ENV_FILE` and the hooks' env file reach PowerShell only when every line
  is a plain assignment, then all of them (`t.psPrefix`, the exec's `ps`).
- *A risky `rm` under the owner's own Ask rule* asks in Auto instead of being
  refused; `CODER_DISABLE_DANGEROUS_RM_TIMEOUT` lets the checker decide (with
  the checker on), and `CODER_DISABLE_SUBSTITUTION_RM_PROMPT`,
  `CODER_DISABLE_INLINE_SHELL_RM_PROMPT` and
  `CODER_DISABLE_MOUNTED_DRIVE_RM_PROMPT` loosen `dangerousRm` (`off`). From the
  environment's own variables only (`rmChecksOff`).
- *Hook notes for the checker* (Claude Code's `classifierContext`): a
  PostToolUse hook's note about a result goes to the Auto mode checker, never to
  Grok (`checkerNotes`, `checkerTranscript`'s `notes`), at most 2,000
  characters a call, dropped with a refused or replaced rewrite of its own, and
  marked as unverified context from the application.
- *`duration_ms`* in PostToolUse input: the tool's own running time, without
  its card or its PreToolUse hooks (`ranAt`, `doneAt`).
- *The "don't ask again" rule on a PowerShell card* (live test 30, 2026-11-11;
  CD407): Claude Code's (its `Le`; `psExactRule`): the command itself for its
  safety checks, provider paths and file redirections; none for a command it
  cannot parse, the git, archive and .git checks or deleting the working
  folder, or with a `*` or a line break in it; on the last question, each
  command that needs approval, exactly; never one too long to be kept
  (`RULE_MAX`, as Bash's cards). Coder offered `PowerShell(Write-Output *)`, a
  rule for every Write-Output (`psSuggest`, gone). As in Claude Code, a rule
  offered on a safety check does not skip that check next time.
- *The note after a blocked site* (live test 32, 2026-11-11; `coder-proxy.mjs`'s
  `blockedNote`): a site on the environment's blocked sites list is no longer
  followed by "ask the owner to allow it with propose_env (allow_host)", which
  can never work for it (that list wins over anything allowed); Coder is told
  that only the owner can take it off the list.

**Bash docs pass 8** (owner, 2026-11-11: "go back to Claude Code docs and see if
we're missing anything", then "Yes pls" to building all of it, the safety holes
first). Tests: `test/pass8.test.mjs` (CD408 on).
- *The wrappers Claude Code looks past* (`coder-shell.mjs`'s `unwrapSteps` and
  `progName`, from its tables in 2.1.322): deny and ask rules, and the risky-rm
  check, try every form of a command: as written, without its assignments,
  without each wrapper (`time -p`, `nohup`, `timeout` and its options, `nice
  -n`, `stdbuf`, `watch`, `flock`, `setsid`, `exec -a`, `chrt`, `taskset`,
  `ionice`, `strace`, `ltrace`, `unshare`, `nsenter`, `env -S`, `sudo`, `doas`,
  `pkexec`, `command`, `builtin`, `noglob`, `nocorrect`, bare `xargs`), and the
  program without its path (`/usr/bin/git`). `command -v` is itself. (CD408)
- *Variables and brackets for deny and ask rules* (`readCommand`'s `vars`;
  Claude Code 2.1.290 and 2.1.309): a plain value set earlier at the top level
  (`NAME=value`, `export`, `declare`, `typeset`, `readonly`, `local`) is put in
  where a later part names it; a `cd` in brackets moves only its group, and git
  after one asks. `cp` and `mv` into a folder count the files they write there;
  a wildcard in grep's pattern place counts as a path. Only stricter: the allow
  path reads a command as before. (CD409)
- *Local addresses at the gate* (`coder-proxy.mjs`'s `localKind` and
  `LOCAL_REFUSED`): in every network setting, Full too, a name that resolves to
  a loopback, link-local or private address, or such an address written as
  numbers, gets a 403 in Claude Code's words ("Connection to … blocked: resolved
  to a loopback address"), recorded for the command's note. A command still
  reaches its own localhost directly. (CD410)
- *Accept edits is Claude Code's cloud "default" for commands* (`byCommand` in
  `bashDecision` and `psDecision`; its permission-modes docs: "Accept edits
  corresponds to `default` mode: cloud sessions pre-approve file edits
  regardless of mode"): file tools change files without asking; a command that
  changes files asks. A repository's `.claude/settings.json`
  `permissions.defaultMode` `"acceptEdits"` lets commands change files again
  (`fileEdits`); `"plan"` starts its new chats in Plan (`startMode`); `"auto"`
  is not taken from a project. (CD411)
- *Background commands keep the chat's keys* (`coder-egress.mjs`'s `bgAlive`):
  the chat's last job's pass works while its background commands run, so a dev
  server or a monitor keeps the environment's keys and `gh` (never for a job
  from GitHub); GitHub Actions logs follow their redirect (`LOG_PATH`,
  `LOG_HOSTS`) without the login; a network change reaches a chat whose
  background commands run. (CD412)
- *The wake* (`coder-watch.mjs`'s `WAKE_PATH`, `handleWake` and
  `backgroundCheck`; `server.mjs`'s `noteWake` and `wakeIdle`): when a chat with
  no job has a background command end or a monitor print, its machine asks the
  Worker to look now (within `JOB_CHECK_MS`, 5 s), with the chat's last job's
  pass: once for each new piece of news, and, while the Worker says the job is
  still being saved, again every `WAKE_GAP_MS` up to `WAKE_TRIES` times. The
  Worker runs the every-minute look's own check for that chat. (CD413)
- *A repository's own command settings* (`server.mjs`'s `REPO_OWN_ENV`,
  `REPO_OWN_KEYS` and `withRepoOwn`): Claude Code's names in its `env`
  (`BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`, `BASH_MAX_OUTPUT_LENGTH`,
  `CLAUDE_CODE_USE_POWERSHELL_TOOL`, `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`,
  `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`, `CLAUDE_CODE_TOOL_MEMORY_LIMIT`,
  `CLAUDE_ENV_FILE`, `CLAUDE_CODE_SHELL`) and its `bashOutputMaxChars`,
  `defaultShell` and `respondToBashCommands` keys set Coder's settings of the
  same meaning, under the owner's environment (Claude Code: the launch
  environment "takes precedence instead"). What Coder is told names the file.
  Never in a job from GitHub. (CD414)
- *SessionStart on "resume"* (`server.mjs`'s `SEEN_CHATS`; `coder-agent.mjs`'s
  `resumeCost`): the first message after the machine started again, in a chat
  with messages, runs its SessionStart hooks as `resume` (Claude Code's cloud
  runs them "on every session including resumed"), with Claude Code 2.1.251's
  four fields once Coder has answered: `seconds_since_last_response` (the
  Worker's `lastAt`), `context_tokens` (about 4 characters each),
  `prompt_cache_likely_expired` (after 5 minutes) and
  `estimated_cache_write_usd` (at Grok 4.7's $2.00 a million input tokens). The
  hook env file is kept. A summary's SessionStart sets no title. (CD415)
- *Auto mode's details* (CD416): a command whose every part is allowed by a
  kept rule or read-only needs no check (`partsAllowedOrReadOnly`; Claude Code:
  "All pipeline commands are individually allowed, some only by the read-only
  allowlist"). Plan's checker runs only while Auto mode is available
  (`planChecks`), and a dangerous removal there is handled as in Auto
  (`rmAuto`); a job from GitHub with Auto mode off refuses what would need the
  checker. A command's protected-path writes go to the checker in Auto and in
  Plan with the checker, the paths named (`protToChecker`); one reached only
  through a link still asks (`viaLink`). Before a command that can discard
  uncommitted work (`discardsWork`), the checker is shown `git status`
  (`gitStatusLine`, untracked files always). A mode switched while a check ran
  drops its verdict and asks the owner (`MODE_SWITCHED`). No verdict
  (`checkAction`'s `kind`): "hard" (the checker declined: "retrying won't
  help", not checked again in the job), "transient" (an unreadable answer) or
  "unavailable" (no answer), each waited out longer before the next check
  (`noVerdictWait`, 1 s doubling to 30 s), the turn stopping after
  `NO_VERDICT_STOP` (10) responses in a row, a PermissionDenied hook's retry not
  passed on, and the page's dim "Not run · auto mode's check had no usable
  answer" row. The block counts are kept in a file of root's beside the memory
  folders (`checksKeep`), so they outlive the machine's sleep. The checker has
  the default rules of Claude Code's `claude auto-mode defaults` (2.1.322) that
  Coder's machine can meet: 60 block rules and 12 allow rules (28 and 9 before),
  about 7,200 more characters per check.
- *Hooks meeting commands* (CD417, CD418). A PermissionRequest hook's allow
  with `updatedInput` sends the call through again with it, "re-evaluated
  against deny and ask rules" only: its PreToolUse hooks are not run again, an
  ask rule shows the owner the card (no hook again), and the page shows the step
  once, with the new command. Its `updatedPermissions` apply (`applyUpdates`):
  addRules, replaceRules and removeRules on the job's rules (an allow rule for a
  settings file kept as the owner's "don't ask again"), and setMode; working
  folders are left alone. Its `permission_suggestions` are Claude Code's
  `{toolName, ruleContent}` entries (`ruleEntry`, `entryRule`). An exec-form
  hook gets `${CLAUDE_PROJECT_DIR}` as the path in `command` and each of `args`,
  a PowerShell shell-form hook `${env:CLAUDE_PROJECT_DIR}` (`hookShell`). A
  PowerShell call is `PowerShell` for every hook (`callTool`), and `if:
  "PowerShell(Remove-Item *)"` matches each command it runs, nested ones too
  (`psAllParts`). A call that never ran fires neither PostToolUse nor
  PostToolUseFailure, and a command that fails its input checks (empty, too
  long, a control character, a long foreground sleep) fires no PreToolUse
  either. A Bash matcher on a Monitor's command gets a Bash call (`asBashInput`)
  whose allow and `updatedInput` count for nothing (`withoutGrant`), never for a
  WebSocket watch nor with an `if` naming Monitor. SessionStart's variables stay
  for the chat; CwdChanged's and FileChanged's go in a second file, emptied at
  each CwdChanged (`envKind`, `hookEnvLine`). A PreToolUse `"defer"` is
  ignored. Hook input has `prompt_id`, and PostToolUseFailure `duration_ms`.
- *PowerShell's details* (`test/pass8-ps.test.mjs`, CD419 to CD425), each from
  Claude Code 2.1.322's own program. Exit codes (`coder-psparse.mjs`'s
  `psExitOf`, `psLastSegment`, `psProgram`): read from the command's text and
  whether it printed anything, not from its parse; the last part's program,
  or, when nothing was printed, the search before its formatting cmdlets
  (`Select-Object`, `Sort-Object`, `Group-Object`, `Get-Unique`,
  `Format-Table/List/Wide`, `Out-String`, `Out-Host`; not `Out-Null`); a
  quoted `|` is no pipe; robocopy's 0 to 7 and `where.exe`/`fc.exe`'s 1 are not
  failures; after a `&&`, or when the output says a command was not found, it
  is one. A program by path or with a dot (`dotnet.exe`, `./build.ps1`) is
  allowed only by a rule whose first word names it as typed
  (`psProgramRule`): `PowerShell(dotnet.exe build *)` yes, `PowerShell(*)` or
  `PowerShell(dot*)` no. A rule that is exactly the whole command allows it
  (several commands too); a `&&` chain still asks the first time, as Claude
  Code's does, offering each part's rule, then the chain's own. Deny and ask
  rules on a call's settings (`PowerShell(run_in_background:true)`), and
  `PowerShell(command:…)` kept but never matching, with Claude Code's warning.
  In Auto, Claude Code's own lists of broad rules are dropped
  (`coder-checker.mjs`'s `droppedInAuto`, word for word, for Bash and
  PowerShell: `PowerShell(*)`, `PowerShell(pwsh *)`, `PowerShell(iex *)`,
  `Bash(python -c *)`…; `Bash(make *)` now stays, as in Claude Code), and
  `classifyAllShell` covers PowerShell. A PowerShell card has no "switch to
  auto mode". In Accept edits a path argument with a quote character asks,
  in Claude Code's words (`PS_QUOTED_WHY`): `Set-Content .\notes.txt "It's
  done"` asks, `-Value "It's done"` does not. `CODER_SHELL_PREFIX` never wraps
  a PowerShell command, an exec-form hook or a PowerShell hook (`noPrefix`).
- *The small ones* (`test/pass8-small.test.mjs`, CD426 to CD436). A low-memory
  warning in Settings (`memWarnGib`, Claude Code's
  `CLAUDE_CODE_WARN_MEMORY_FREE_GIB`: "Low memory: … is available to this
  session.", from MemAvailable or what is left under the commands' memory cap,
  `memAvailable`, which reads cgroup v2's `memory.max`/`memory.current` or
  v1's `memory.limit_in_bytes`/`memory.usage_in_bytes`: Coder's Fly.io
  machines have v1 for memory, CD523); it and the low-disk warning are off unless chosen, and said
  again only after the figure was back above 1.25 times the line
  (`WARN_REARM`). Every command and the setup script have
  `CLAUDE_CODE_REMOTE=true` (`REMOTE_MARK`); no `OTEL_*` variable reaches a
  command (`withoutOtel`). zsh: the snapshot lists options with
  `KSH_OPTION_PRINT` off (with it on, every option was set from the "name
  on/off" list, `noexec` too, and commands came back empty, as in Claude Code
  before 2.1.321), and every command turns zsh's bare glob qualifiers off
  (`*(e:…:)` runs code), Claude Code's own line. The bash tool's description
  says the real timeouts and the real shell's startup file. An output file cut
  at 64 MB says so ("Output exceeded the 64MB persist limit; only the first
  64MB were saved to: …"). A monitor at its deadline says how many events it
  delivered, and with none, "widen the filter if silence was unexpected". The
  settings a command may be given in front and still only read are Claude
  Code's list and check (`rbEnvSafe`). "Don't ask again" never offers a rule
  wider than the command (`PREFIX_REFUSED`, `exactRule`). A rule the owner
  changes while Coder works counts from its next tool call (the Worker's
  `tellRunning`, the machine's `/rules`, the loop's `freshRules`). A note goes
  with Yes and No only. A chat with several repositories reads none of their
  `.claude` settings (`several`). Left as they are: Claude Code's
  `CLAUDE_CODE_STRICT_INLINE_SHELL_RM_PROMPT` (Coder already always asks, the
  owner's choice), typed `/tasks` and `/add-dir` (buttons do both; typed slash
  commands were removed on 2026-11-05), and a stuck-prompt notice (not found in
  Claude Code 2.1.322).

**Bash docs pass 9, part A** (owner, 2026-11-11: "Yes pls" to building pass 9's
list in order, the two bugs pass 8 added and the safety gaps first). Each from
Claude Code's docs and its program, 2.1.322. Tests: `test/pass9-a.test.mjs`
(CD437 to CD454).
- *Pass 8's two bugs*: in Coder's cloud Accept edits (Claude Code's
  "default"), an allow rule for a command no longer approves its
  redirection's file: one outside the project, a `~` or a wildcard one asks,
  and one inside asks in Claude Code's words (its RZt: "… needs approval. The
  path is inside the working directories for this session …"); a tee's file is
  a part a rule may approve (CD437). Bare `nice`, `nice --` and `stdbuf -o L`
  are looked past again (`coder-shell.mjs`'s `processWrappers`) (CD438).
- *Too complex to check* (`parseShell`'s `complex`, `subsOf`, `arith`): a
  command hidden in `(( ))`, `$(( ))`, `$[ ]` or a `[[ ]]` test is read (a deny
  rule refuses it) and the command asks in Claude Code's words ("Arithmetic
  expansion references variable or non-literal: …", "[[ ]] test contains
  expansion / command / process substitution"); a no-break space or other
  Unicode blank asks ("Contains Unicode whitespace"); a lone surrogate too. A
  `&` asks in Claude Code's words whatever rule matches (`BG_OP_WHY`); in Auto
  it goes to the checker. A command that can't be parsed counts as a risky
  removal (`RM_UNCHECKED`), unless Claude Code's checks of the whole text
  (`textReasons`) catch it first: then, where the owner is asked, theirs is the
  reason (round 4) (CD439).
- *A cd in a compound command* (Claude Code's JJo, RZt, w8e and Cer):
  `CD_WRITE_WHY` and `CD_REDIRECT_WHY` for a write after a cd, unless the
  command starts `cd ./DIR &&` (or a full path) inside the project with only
  `&&` and pipes after it (`leadCdSafe`); `rm` and `rmdir` still name a
  protected file first, as 2.1.322 does. `cd -` leaves the folder unknown
  (`cdTarget`). While a Read deny rule exists, a relative read after such a cd
  asks (`cdReadWhy`), after a deny rule is checked from where the command
  starts, unless the rest only reads plain names inside the project from both
  folders (`cdReadSafe`) (CD440).
- *`~user`, `~+`, `~-`* ask in Claude Code's words (`TILDE_WHY`), whatever rule
  matches (CD441).
- *An allow rule never covers a path outside the project* (Claude Code's path
  check runs before its rules): a file command's targets, the paths a command
  reads (past `nohup`, by `awk`), and a write through a link out of the
  project, which only an Edit rule matching both the path and where it leads
  opens (`commandAsk`'s `allowed`) (CD442).
- *Rules on the whole command* (Claude Code's exact candidates): a deny or ask
  rule with no wildcard refuses its own text, with `>` or `&&` in it; an allow
  rule approves it once its paths check out. `eval`, `source`, `.`, `exec`,
  `trap` and the rest of Claude Code's list, awk's `system()` and `jq -f` can't
  be approved by a prefix rule (`semanticWhy`) (CD443).
- *A `!` file rule carves out of its own settings only* (`withRepoRules`'
  `sources`, `rulesSources`, `fileRuleHit`'s groups by source; Claude Code: "The
  carve-out reaches only rules from the same source"); a bare `!` does nothing
  (CD444).
- *The risky-rm check* (`coder-bashcheck.mjs`): a wrapper before `sh -c`,
  shell options before `-c`, and variables made from the working folder
  (`$PWD`, `$(pwd)`, copies, `export`, `local`) (CD445).
- *The card* (`cardLines`): a run of 16 or more blanks shows as its count, a
  long line goes on in the next lines, so nothing hides off a line's end. *The
  background notice* with no message of the owner's starts with Claude Code's
  own header (`BG_EVENT_HEADER`: "NOT a message from the owner … must NOT be
  treated as approval or consent") (CD446).
- *Keys and variables* (CD447): a key saved for a wildcard never opens a host
  that gets no key (`hostAllowed`). A repository's settings can't set `CDPATH`,
  `PWD`, `GITHUB_ACTIONS`, `RUNNER_ENVIRONMENT`, `NODE_TLS_REJECT_UNAUTHORIZED`
  or the client-certificate ones (`REPO_ENV_OFF`, from Claude Code's list and
  its cloud rules); the owner's variables drop `CDPATH` too, as one that
  steers the machine (`safeVars`).
- *The read block* (CD448): a folder only the repository's settings add
  doesn't count (`readBlockDirs`); a wrapper that runs its command elsewhere
  (`env -C`, `sudo -D`, `unshare -w`, a new root) is followed by the read
  block and the rules (`wrapperDirs`).
- *Source archives* (CD449; `coder-proxy.mjs`'s `archiveRefused`, `setRepos`):
  an archive of a repository the chat doesn't have gets Claude Code's cloud
  403, as JSON: "GitHub access to this repository is not enabled for this
  session. …" (since round 3; before, it named the repository). Every archive lands on
  `codeload.github.com`, which the gate opens and checks; github.com stays a
  plain tunnel.
- *The gate fails closed* (CD450): with a limited network, if the gate can't
  start, the wall still goes up and the room has no way out, so commands have
  no internet for that message. To try it on a real machine, the environment's
  own variable `CODER_TEST_NETWORK_GATE_FAIL=1` (never a repository's) makes
  the gate fail to start for each message, and a network change mid-message
  that needs the gate fails the same way (`GATE_TEST_FAIL`, CD560; the owner,
  2026-11-13: "test what u are missing to test"). It only takes network away.
- *Hooks* (CD451, CD452): a PreToolUse hook's ask stays the owner's in Plan (the
  checker never approves it). A PowerShell hook gets Claude Code's ending
  (`PS_HOOK_EXIT2`), so a program's exit 2 blocks. Rules a PermissionRequest
  hook adds for the session last the chat (the job gives back
  `sessionRules`; the Worker keeps them in the chat's meta and sends them with
  each message, `sessionRulesOn`); for a settings file, deny and ask ones are
  saved with the repository's rules (`rulesSaved`).
- *PowerShell* (CD453): a folder change beside any other command asks in
  Claude Code's words (`PS_CD_COMPOUND_WHY`); an allow rule never covers a path
  outside the project; a rule ending `:*` is a prefix (`ruleRegex`); U+FEFF and
  U+180E are refused (`PS_INVISIBLE_REFUSED`).
- *Auto mode* (CD454): a narrow allow rule skips the checker only when the
  path checks pass too (`partsAllowedOrReadOnly` with where the command runs).

**Bash docs pass 9, part B** (owner, 2026-11-11, the same "Yes pls"): how
Claude Code's cloud machine runs commands, from its docs, its program (2.1.322)
and what its cloud machine does (seen in a cloud session that day). Tests:
`test/pass9-b.test.mjs` (CD455 to CD466).
- *zsh* (CD455, CD456): with no `CODER_SHELL`, commands run in zsh where it is
  installed, then bash, as Claude Code's cloud sessions do (`shellOf`);
  `CODER_SHELL` takes a full path anywhere that names bash or zsh and is there.
  Claude Code's checks for where bash and zsh read a command differently ask,
  in its words, before any rule (`parseShell`'s `complex`): an escaped blank or
  a word joined across lines, `~[…]`, `=cmd`, `<N-M>`, a brace with a quote
  outside quotes (`quotedBracesBlanked`); zsh's own builtins (`ZSH_DANGEROUS`,
  its list of 44); zsh's `cd OLD NEW` (`CD_TWO_WHY`). When a command also can't
  be parsed, the zsh reason is given, not "Parse error".
- *The machine's presets* (CD457, `cleanEnv`): Claude Code's cloud machine's:
  `TERM=linux`, `DEBIAN_FRONTEND=noninteractive`, `PYTHONUNBUFFERED=1`,
  `IS_SANDBOX=1`; no `LANG`, `CI` or `NO_COLOR`. git never waits for a password
  (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `credential.interactive`
  off) and turns `git@github.com:` into https; the AWS and Google tools get
  Claude Code's `proxy-injected` placeholders. The clone has a normal `origin`
  (the repository's address, no login in it), so `gh` and other tools know
  which repository they are in (`prepareRepo`).
- *The owner's variables win* (CD458): the owner's and the repository's
  variables come after the machine's presets (`JAVA_HOME`, `TERM`, `GOPATH` …),
  never over its `PATH` and `HOME`; names that only start with PATH, HOME,
  SHELL or USER (`USER_POOL_ID`, `PATH_PREFIX`) now reach commands (`safeVars`).
  `GIT_EDITOR=true` comes after them all, as Claude Code sets it.
- *Each tool's proxy and certificates* (CD459, `toolProxyEnv`): Yarn, npm,
  global-agent, Electron, Docker, gcloud, fsspec and Java get the gate as their
  proxy, and the certificate settings of AWS, Cargo, Deno, gRPC, Hex, httplib2,
  Nix, pip and uv point at the gate's bundle. Java gets a trust store holding
  the gate's certificate (`javaTrustStore`), so Maven, Gradle and Java programs
  work behind the wall, saved keys included.
- *A scratchpad folder* (CD460): `/tmp/coder-scratch`, made private before
  each command (`SCRATCH_MAKE`). Coder is told to use it instead of `/tmp`, in
  Claude Code's words; a command's write there passes the path check (Claude
  Code: "Scratchpad files for current session are allowed for writing"), so a
  read-only command's output goes there without asking, and a file command is
  then as any other; hooks get it as `scratchpad_dir`.
- *Output in order* (CD461): a command's output and its errors come back as
  printed (`merge`: one stream, as Claude Code's one file); before, errors
  landed after everything else.
- *Commands that only read run at the same time* (CD462, `runsAhead`): several
  in one reply start together, in the order asked, while the job has time
  left; results come back in that order. One that changes something, a hook,
  the background or the script caps keep each in its turn.
- *Numbers* (CD463, `envNumber`): `300_000`, `300,000` and `3e5` as Claude Code
  reads them.
- *The gate* (CD464): its refusals carry `x-deny-reason: host_not_allowed`. A
  command that failed is told which connections to allowed sites failed while
  it ran, in Claude Code's words (`failedNote`: "[agent-proxy] While this
  command ran, 1 connection through the agent proxy failed: …"), up to three
  lines, newest first, and where to see them all: the gate's status page at
  Claude Code's address, `/__agentproxy/status` (no secret on it).
- *Four more settings from a repository* (CD465, `REPO_OWN_ENV`):
  `CLAUDE_CODE_SHELL_PREFIX`, `CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE`,
  `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` and
  `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`; the owner's own win.
- *Settings changed mid-job* (CD466): a repository's settings files are looked
  at before each step (`repoFilesStamp`) and read again when they change
  (`repoNow`): their rules, hooks and blocks count from the next step; a read
  block they drop stays on for the job, as Claude Code's does. Their env and
  folders wait for the next message.
- Left for the owner: when the same variable is in the environment and the
  repository's settings, which wins; and whether a variable edited in the
  environment reaches a chat already open before its machine sleeps.

**Bash docs pass 9, part C** (the same "Yes pls"): the rules and "don't ask
again", from Claude Code 2.1.322's own program. Tests: `test/pass9-c.test.mjs`
(CD467 to CD470).
- *The rule "don't ask again" saves* (CD467, CD468; `suggestFor`, `ruleShape`,
  Claude Code's uPn, mso and ter): the first two words and ` *` when the second
  looks like a subcommand and the first is no shell or wrapper, past the
  variables in front Claude Code counts as safe (`safeLeadVar`, its FD); a
  heredoc's command; a part over several lines, its first line; otherwise the
  command exactly as written. Over 38 commands, Coder's had differed in 16 (it
  saved `ls *` for `ls -la`); now all 38 are Claude Code's. Kept from Coder: no
  rule for a command whose program is worked out when it runs or that runs a
  command substitution, no exact rule with a `*` in it, and `eval` and the rest
  of Claude Code's list get the exact command. Each rule offered approves its
  command the next time.
- *An allow rule is tried against the command as typed too* (CD469,
  `allowTexts`, Claude Code's hY): `Bash(NODE_ENV=production npm run *)` matches
  its own command; and past `timeout` with its own settings (`-s KILL`,
  `--signal=…`, `-k 5`; Claude Code's CT): `Bash(npm test *)` covers
  `timeout -s KILL 30 npm test`.
- *Rules on a monitor's own settings* (CD470, `MONITOR_SETTINGS`,
  `monitorRules`): `Monitor(timeout_ms:*)`, `Monitor(description:…)` match what
  Coder asked the monitor for; Bash's (`Bash(run_in_background:true)`) are on
  Bash calls only (one had refused every monitor). Hooks see a monitor's own
  input in every event (`callInput`), never the background bash call Coder
  makes of it.

**Bash docs pass 9, part D** (the same "Yes pls"): `!` commands, background
commands, monitors and wording, from Claude Code 2.1.322's own program. Tests:
`test/pass9-d.test.mjs` (CD471 to CD484).
- *A background command stuck on a typed question* (CD478; `watchStall`,
  `stallNews`, `stallNotice`; Claude Code's stall watch): every look (5 seconds)
  notes its output's size; after 45 quiet seconds its last 1,024 bytes are read,
  and when its last line matches Claude Code's patterns (`(y/n)`, `[y/n]`,
  `(yes/no)`, "Do you … ?", "Press Enter", "Continue?", "Overwrite?") Coder is
  told once, after the round or at the next job's start (`stalls`; an idle chat
  is woken: `untoldOf`): 'Background command "…" appears to be waiting for
  interactive input', "Last output:", the tail, and Claude Code's advice. Claude
  Code's code reads the tail and then leaves it out under its heading; Coder
  puts it there. Never a monitor.
- *A monitor's limits* (CD476; `readMonitor`): the lines read together are one
  event (a WebSocket's messages one each), each line cut at 500 characters, the
  event at 3,000; 10 events at once, then one every 2 seconds; the rest counted
  and said ("[N events suppressed — …]"); after 30 seconds of that the monitor
  is stopped ("[Monitor stopped — too much output …]"). A line not ended yet
  keeps its last 1 MiB.
- *Stop while a command runs* (CD474, `STOPPED_RUNNING`): Claude Code's
  rejection and its correction ("this call was stopped while running, not
  refused before it ran …"); no failure hooks.
- *The owner's `!` command* (CD475): moved to the background after a command's
  default time (2 minutes; it waited the most, 10); one that printed past the
  inline limit reaches Coder as the saved output and its preview.
- *Small ones*: a background command that ends in its first second still gets an
  ID and its end notice (CD473); `printf '%s\n'` only prints (CD471); bash's
  `timeout_ms` is read as `timeout` (CD472).
- *Wording, Claude Code's* (CD479 to CD484): "Command timed out after 2m 0s"
  and "Command killed: output file exceeded 5GB" before the output
  (`ccDuration`, its own time format); a command moved at its timeout shows its
  last 2,000 bytes from a line start under "[… earlier output omitted; full
  output: …]" (`movedSoFar`); one the owner moved, no output and no "You will be
  notified when it completes"; blank lines at an output's start and white space
  at its end dropped; a failure cut only past 11,024 characters; a saved
  output's preview ends at a line break; "(PowerShell completed with no
  output)"; the long `sleep` refusal names the monitor tool; "Monitor started
  (task …, expires in 5m …)", "stream ended", "ended without producing output
  (exit 0)", "script failed (exit 4)", "stopped" (`monitorStarted`,
  `monitorSaid`); a monitor deadline past an hour refused ("timeout_ms must be ≤
  3600000"); the stop tool's replies (TaskStop's JSON, "Task … is not running
  (status: …)", "No task found with ID: …"); KillShell and KillBash are its
  names in rules; the checker's reason when it can't be reached
  (`unavailableWhy`: rate-limited, overloaded, server error, timed out,
  connection failed). (A Read or Edit deny rule's refusal of a command was
  "cat from '…' was blocked by a deny rule." here; round 4 found Claude Code
  gives its sentence for the whole command, see below.)
- *Two bugs fixed on the way*: output was decoded piece by piece, so a letter
  split between two pieces showed as "��" (`utf8Partial`: each stream's letters
  decoded whole); and a stopped command's own processes got SIGTERM twice (the
  sweep for its marked processes now leaves its process group out:
  `endMarked`'s `skipGroup`).

**Bash docs pass 9, part E** (the same "Yes pls"): the hooks details, from
Claude Code's hooks reference and 2.1.322's own program. Tests:
`test/pass9-e.test.mjs` (CD485 to CD497).
- *How a hook runs*: a shell-form command with `sh -c` (`hookShell`; Claude
  Code: "sh -c on macOS and Linux"), never in the chat's CODER_SHELL; its own
  `timeout` kept as given (600 is the default, not a cap; `HOOK_TIMEOUT_MAX_S`
  only keeps a timer sane); at most 12 prompt or agent hooks at once
  (`MODEL_HOOKS_AT_ONCE`); a handler is its type, command, `if` and shell
  (`handlerKey`), so the same command under two `if` values is two handlers.
- *What a hook is told*: `permission_mode` "default" in the cloud's Accept edits
  (`hookMode`, `fileEdits` false); for a command, Claude Code's Bash output
  fields (`bashFacts`: `backgroundTaskId`, `backgroundedByUser`,
  `timedOutAfterMs`, `returnCodeInterpretation`); `bashEditDiff: { skipped:
  true }` for a git command that moves the work tree; PostToolUse for a
  background command (it had never fired) and PostToolUseFailure for one that
  could not start (`notStarted`).
- *What a hook says*: a PreToolUse hook's additionalContext reaches Coder when
  the call does not run (its own deny, a rule, a No); a text past 10,000
  characters is saved in the chat's output folder and given as its path and a
  2,000-character preview (`persistHookText`, the machine's `saveText`); an
  answer naming another event is no answer ("Hook returned incorrect event
  name: …", `wrongEvent`); several JSON lines that hold no hook field are plain
  text, other broken JSON in Claude Code's words (`notJson`); a command's new
  output must have Bash's shape, stdout, stderr and interrupted
  (`bashShapeProblem`), else the original stays, in Claude Code's words.
- *Folders and files*: CwdChanged runs for the owner's `!` cd too (`cwdMoved`);
  the env file CwdChanged and FileChanged hooks write is cleared at every move;
  FileChanged's names are files in the commands' current folder; a hook run
  while that folder is gone runs from the project's and leaves it as it is, so
  Coder's next command says "Shell cwd was reset to …" (`hookHome`).
- *Small*: the card's permission_prompt Notification hooks 6 seconds after it
  shows, never for one answered sooner (`PROMPT_NOTIFY_MS`;
  CODER_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS turns them off); the AI's home
  has `~/.claude` (the machine's start, and the image).
- *Not copied*: `transcript_path` (Claude Code's conversation file on its
  machine; Coder keeps the conversation on its server).

**Bash docs pass 9, part F** (the same "Yes pls"): the page. Tests:
`test/pass9-f.test.mjs` (CD498 to CD507).
- *A step that never ran*: refused by a rule, auto mode's checker, a hook,
  Coder's own checks or the owner's answer, its result is marked `ran: false`.
  The page takes it out of its group and out of the group's count, so "Ran 2
  commands" counts only commands that ran, as Claude Code takes a step that
  needs its own row out of its group; the step's own row says "✕ not run"
  where it said "✕ exit -1" (`neverRan`; older chats by their marks).
- *A saved key that is never sent*: Claude Code's "If the list marks a secret
  Not sent instead, the note under it says why and what to do". Every site
  the key names never gets a key (GitHub, the Anthropic API, the public
  package registries), or a key saved before it names the same site (the
  first key for a site is the one sent): "Not sent", and why, under the key
  (`notSentWhy`, sent by the Worker's `secretList`). Keys whose sites overlap
  without matching exactly get no mark, as in Claude Code.
- *The network levels*: None, Limited and Full, as Claude Code now names them,
  with **Allow package managers** and **Allowed domains** under Limited. A
  setting saved as Trusted opens as Limited with the box checked; one saved as
  Custom opens as Limited with its domains and its box. The server keeps the
  old names (`netSaved`: the box and no domains is "trusted", anything else
  "custom"), so no environment reaches anything new. Coder proposes a new
  environment's level as none, limited or full.
- *Variables commands never get*: PATH, HOME, SHELL, USER, LD_…,
  NODE_OPTIONS, BASH_ENV, ENV, SHELLOPTS, BASHOPTS, CDPATH and OTEL_… (one
  list, `VAR_DROPPED_RE`, for the machine's `safeVars` and the page) are named
  on the variables page and its row ("2 not given to commands").
- *Found in the live test after deploy 123*: a background command Coder
  stopped itself kept "running" on its step (a job Coder stops gets no end
  notice). Coder's stop now names it (`stoppedJob` on the result) and the page
  shows "stopped" (`bgEndsOf`; older chats by Claude Code's "Successfully
  stopped task: …"). Test CD505.
- *Found in round 2 of the live test (and the same tests in Claude Code)*:
  every hook's script first makes the chat's scratch folder
  (`HOOK_SCRATCH_MAKE`; the first hook of a new chat had run before any
  command made it, test CD506); a running monitor is read every 200 ms
  (`readMonitors`, `MONITOR_BATCH_MS`, on the real machine), Claude Code's
  batching, so a busy command meets its limits as there (test CD507).

**Round 3 of the live test** (owner, 2026-11-11: "yea go ahead test all of it"):
everything in Bash not tried live before. Tests: `test/round3.test.mjs`.
- *A sensitive file named by ~*: a command writing `~/.zshrc` was named on the
  card as the project's folder with `~` in it; now the AI's home (`commandAsk`'s
  `tilde`), as Claude Code names it in its own; written as typed when the home
  isn't known (test CD508).
- *gh's refusals are GitHub's JSON* (`ghRefused`, `{"message": …}`): gh shows
  why (a plain-text refusal came out as "invalid character 'G' looking for
  beginning of value"), as with Claude Code's GitHub proxy (test CD509).
- *A hook's notice keeps its reason* (`hookNoteText`): past 600 characters
  its command is cut short, never the reason after it (a 1,000-character hook
  command had hidden "Hook returned incorrect event name"; test CD510).
- *Claude Code's own ways for the three differences found* (the owner: "use
  the same claude code wording"):
  - a failed Grok call is tried again as Claude Code does (`coderSend`;
    `MAX_RETRIES` 10, `CODER_MAX_RETRIES` up to 15; 408, 409, 429, 5xx and a
    lost connection; retry-after, else 500 ms doubling to 32 s plus up to a
    quarter; the chat's line "API error · Retrying in 1s · attempt 1/10",
    `retryLine`), test CD511;
  - a private address is refused with Claude Code's cloud proxy's 403
    ("Destination IP is in a private/reserved range", `x-deny-reason:
    private_dest_ip`) and no note; a repository the chat doesn't have, in its
    GitHub proxy's sentence (`REPO_NOT_ENABLED`, `API_PATH_NOT_AVAILABLE` in
    `coder-secrets.mjs`; Coder's AI has no add_repo, so the owner's
    "+ Repository" is named), test CD512.

**Round 4: Claude Code's command-line version next to round 3** (owner,
2026-11-11: "yes Haiku", then "yes copy all of them"). Claude Code 2.1.322, in
its cloud setting, ran round 3's rule and hook cases with Haiku, and then the
cases each difference raised (24 runs, 17 cents in all). Tests:
`test/round4.test.mjs`, where every expected answer is Claude Code's own.
- *A file rule's refusal* (`bashDecision`): "Permission to use Bash with
  command <command> has been denied.", as Claude Code gave it for every way of
  naming the file (CD513).
- *A hook's block* (`hooksOutcome`'s `blockBy`): PreToolUse "PreToolUse:Bash
  hook error: <reason>" ("Blocked by hook" with none); exit 2 "[command hook]:
  <stderr>" ("No stderr output"), stdout's JSON not read; another event's
  "PostToolUse:Bash hook blocking error from command: "command hook": …"; a
  Stop hook's "Stop hook feedback:" and a new line, and for a JSON block that
  other line too. A hook is named by its kind (`hookKind`: "command hook",
  "http hook", "prompt hook", "agent hook"), never by its command or address,
  as in Claude Code's cloud (CD514). The page's "Blocked by your hook" box
  reads both shapes (`hookBlockOf`). Since 2026-11-13 it keeps the hook's
  lines, in a fixed-width font, so a table stays a table (`hookWords`: at most
  20 lines and 2,000 characters there; all of it in the opened step).
- *Terminal color codes* (`noColor` in `public/coder.js`, 2026-11-13): the
  page leaves out codes such as ESC "[31;1m" where it shows output (a step's
  output and last lines, monitors, background commands), Coder's notes and
  errors, and Grok's text; they showed as text ("[31;1mGet-Item:") in the
  live test of PowerShell hooks. What Grok is given keeps them, as Claude Code
  gives its model a hook's output as it is; cards that ask for an approval
  show their text exactly (CD570).
- *A hook answer with no event name* (`wrongEvent`): Claude Code's note word
  for word, "Hook JSON output validation failed — hookSpecificOutput is missing
  required field "hookEventName"", the hook's output and `HOOK_SHAPE` (CD515).
- *A hook's note* names the hook as Claude Code does: "PreToolUse:Bash hook
  additional context: …" for a tool's events (`hookNote`), "SessionStart …"
  and "UserPromptSubmit …" for the others (CD519).
- *$"…" and $'…'* (`parseShell`'s `ansiC`, `locale`, `quotedHead`): they ask,
  "This command can't be checked before it runs", "Text with escape codes in
  this command can't be checked before it runs", or for a command name written
  $'…' with an operand after it, "command head $'rm' — a $'…' word the shell
  decodes before looking the command up" (after `command`, `exec`, `builtin`
  and the like: "… after command …", `quotedHeadWhy`). No rule can name such a
  command, so a deny rule on rm no longer refuses `$"rm" -f x` there: it asks;
  a rule on another part still refuses; in Auto Coder still holds such a name
  to the rules. The rm check still sees through both (CD516).
- *Brackets and braces* ask, even for a command that only reads, and no allow
  rule passes them; a deny rule inside still refuses first; Auto leaves them to
  its checker (CD517): `( … )` "This command uses shell operators that require
  approval for safety" (`SHELL_OPERATORS`), with a `;` of its own inside "This
  command can't be checked before it runs", with a redirection or after `time`
  "A group in parentheses …" (`GROUP_PARENS`); `{ …; }` and `(( … ))` "A group
  in braces or double parentheses …" (`GROUP_BRACES`); a function "A function
  definition …"; `for (( … ))` "A counting for loop …"; `{a,b}` "Brace
  expansion"; `{1..3}` "A brace pattern …". `if`, `while` and plain `;` lists
  are unchanged.
- *A command Claude Code's checks of the whole text catch* (`echo <1-3>`): the
  card names their reason, not the rm check's; in Auto it is still refused as
  one that can't be checked (CD518).
- *69 of Claude Code's answers*, verdict and words, are checked together
  (CD520).
- *The last three* (the owner: "copy those too"): arithmetic of numbers only,
  `echo $((1+1))`, and a `$` that starts nothing, `echo "$'x'"`, only read and
  run (`readDollar`'s `literal`) (CD521); a prompt hook's "no" is
  "PreToolUse:Bash hook error: [<its prompt as written>]: <reason>" and an agent
  hook's "… Agent hook condition was not met: <reason>"; after a call "…
  hook blocking error from command: "<its prompt>": …"; a Stop hook's "Stop hook
  feedback:" and a new line (CD522). With these, all 71 of Claude Code's answers
  match (CD520).
- *Not copied, left as it is:* a hook's "defer" (Claude Code's command-line
  version stops the run for an app that resumes it; Coder ignores it, as
  Claude Code's docs say a normal session does).

**Round 5 of the live test: the 10 fixes** (owner, 2026-11-12: "fix all 10,
then merge and deploy"). Tests: `test/round5.test.mjs` (CD523 to CD534).
- *A picture too small for Grok* (xAI refuses one under 8 pixels a side or 512
  in all, and the turn ended): a command's printed picture and one the owner
  attaches are enlarged on the machine first (`picMinFit`, `asPicture`, the
  `fit_picture` tool, `fitOwnerPics`), each pixel a block with a white margin
  where a side is still short; one that can't be is left out; Coder is told
  either way. `picSize` reads GIF and WebP too (CD524, CD525).
- *A monitor's end* says its time as Claude Code writes it, "expired after
  20s" (`monitorSaid`, CD526): its own time limit (`limitMs`), not the time from
  just before its command started to its deadline (CD535).
- *A Monitor rule's card* names the owner's rule as written, "Your rule
  Monitor asks first" (`monitorRules`' `named`, `namedForMonitor`); the deny
  sentence stays Claude Code's, which says Bash (CD527).
- *GitHub busy or away* (a 429 ended a whole turn): each git call to GitHub is
  tried again after 2 and 6 seconds (`gitNet`, `gitBusy`); still away, with the
  chat's copy on its branch, the turn goes on with that copy and the chat says
  so (`prepareRepo`'s `note`); a new chat or a real refusal still ends it. The
  push at the end is tried again too (CD528).
- *Working folders where the commands see them*: in the admin sandbox, whose
  /tmp is its own, looked up there (`boxRealDirs`, `extraDirsOf`'s `seen`,
  `cwdInside`), once the sandbox is open and before the AI's commands go on;
  one that is not there is said in the chat (`missingDirsSaid`). A sandbox-only
  folder's instructions are not read by root; Coder is told to read them
  (CD529).
- *Stop's choice off*: the sandbox stays while what the stopped command left
  running is still in it (`keptInBox`, CD530).
- *Maven through the gate*: `-Daether.connector.http.useSystemProperties=true`
  in JAVA_TOOL_OPTIONS, so Maven 3.9's downloader uses Java's proxy settings
  (`toolProxyEnv`, CD531).
- *The owner's /compact* is a job on the chat's machine (`compact` in the job,
  `runCoder`'s `compact`): PreCompact hooks as "manual" with the owner's words
  (`custom_instructions`; a block keeps the conversation), the summary, then
  PostCompact and SessionStart ("compact") hooks; Coder does not answer; at its
  end Coder's server moves Rewind's marks (CD532, CD533).
- *Only secret-looking variables hidden in the chat* (`secretVar`, in
  `container/coder-checks.mjs`): by name (KEY, TOKEN, SECRET, PASSWORD, AUTH, …)
  or by value (a key's shape, a login in a web address, a long mix of letters
  and digits); `false` stays `false` (CD534). And Coder is told never to print
  only those values (`varsNote`; it was "never print their values" for every
  variable, which Claude Code doesn't have) (CD536).

**Round 6 of the live test: the 6 fixes** (owner, 2026-11-12: "Ok yes"). Tests:
`test/round6.test.mjs` (CD537 to CD541, CD543, CD544) and CD542 in `test/pass7.test.mjs`.
- *A starting branch late in the alphabet* is asked for by name (`git
  ls-remote --heads <url> refs/heads/<base>`, `headListed`): the list of all
  branches is cut at 4,000 characters, about 50 branches, so a branch past them
  looked missing. Only when it isn't there does the whole list say whether the
  repository is empty (CD537).
- *The copy's `origin`* is the repository's github.com address
  (`originUrl`), whatever address Coder fetches by: on Coder's machines that was
  its git relay, and `gh` could not tell which repository it was in. Coder's own
  fetch and push still name their address (CD538, CD24).
- *An extra repository that opens* says nothing (`extraRepoEvent`): round 5's
  note had split the "else" from its "if", so each one said "Could not open …:
  undefined" (CD539).
- *SessionEnd hooks when the machine stops* run outside the job's admin sandbox
  once it has closed (`boxAtEnd`): as the AI's user, in the room, as commands
  ran before the sandbox. A sandbox a background command keeps is still used
  (CD540). Each stop leaves a record (`noteSessionEnd`): when it began, with the
  stop signal, then what each hook did, the newest 20 lines in
  `.session-end.log` in root's own git folder (`/data/git` on Fly.io), which the
  AI's commands may read and never write (CD543, CD384c). The record found the
  real cause after deploy 145: the hook started on Fly.io's SIGINT and failed in
  1 ms, "ENOENT … req-….json", because a job's end removes the chat's work folder
  (`/srv/coder-bg/<chat>`, `tidyBg`) when nothing in the background keeps it, and
  the hook's input file is written there. That folder is now made again before
  the file is written (CD544). Live after deploy 147: the machine slept, and
  the hook ran in 16 ms with exit code 0 and wrote its file.
- *`@coder` on a pull request whose chat was deleted* drops the stale branch
  record and opens a new chat on the pull request's branch, as for anyone
  else's pull request; deleting a chat drops its own branch records
  (`dropBranchRecords`), and auto-fix news for a deleted chat's branch does too
  (CD541).
- *`CODER_DISABLE_DANGEROUS_RM_TIMEOUT` in Auto*: the checker's approval of a
  critical-path removal is the answer, with no card after it (Claude Code: "These
  removals then go to the classifier in auto mode"; "auto: the classifier
  decides"). Its block is a block, and an Ask rule still asks (CD542).

**The hooks around the automatic summary, tried live** (owner, 2026-11-12: "1
do the test"): one message passed 450,000 characters; PreCompact and PostCompact
ran as `auto` (what PreCompact printed reached the summary) and SessionStart as
`compact`. It showed one difference, fixed (owner: "yes fix it, then merge and
deploy"): hooks are told the chat's mode as Claude Code's cloud names it,
Accept edits as `default` while commands that change files ask
(`hookModeName`), and the SessionEnd hooks of a machine that stops now use the
same rule with what the message's hooks were given (`t.fileEdits`); they said
`acceptEdits` (CD545).

**A full disk, side by side with Claude Code** (owner, 2026-11-12: "yes do the
disk and memory test", "remember to run claude code to compare and fix"). Live
on Fly.io a chat's disk grows by 10 GB once 80% full, up to 50 GB, so it is
full only at that limit. Filled to it, Coder refused to start `echo hello`
("The command was not started: … ENOSPC …"). Claude Code 2.1.322 (Haiku), with
its project and temporary directory on one full 8 MB disk as on its cloud
machine, ran it and said what it printed was lost; with only the project's disk
full it said nothing. From its code: the note is only about the volume of its
temporary directory, only after a command that failed (not one stopped at its
time limit), before the command's output. Now the same (CD546, CD547): no check
before a command (Coder needs no file to start one, so a command that frees
space can run); after one that failed, only the volume of Coder's folder for
command output (`diskNoteAfter`): under 10 MB free or 1,000 free inodes, and a
test write beside it (`probeWrite`) when it can't be looked at or the command
printed nothing (Claude Code's ENOSPC and EDQUOT wordings); "whatever this
command printed was lost" when it printed nothing; the note before the output
(`withDiskNote`), for the owner's own commands (!) too; Claude Code's advice
(`FREE_SPACE`) without "or restart Claude Code with CLAUDE_CODE_TMPDIR …", which
Coder has no setting for.

**Low memory, the same day.** The memory-pressure stop's rules match Claude
Code 2.1.322's code (critical, idle 30 minutes, no turn running, not soon after
an earlier stop, MemAvailable under 10% and 4 GiB; its "delegated agents"
condition has nothing to match in Coder). Live, memory was made scarce (1.2 to
1.4 GB of 16 GB left, under a cap just above what a test program held), but
critical stall could not be held: reclaiming clean cache costs almost nothing,
Linux keeps a running program's code in memory, and re-reading a file stalls
only at first (8–15% of 5-second readings, then 0.4–1.2%); with no swap on
Coder's machines, sustained critical pressure comes only near running out of
memory. One difference was found and fixed (CD338): Claude Code arms the
kernel's trigger, "some 150000 2000000" (150 ms of stall within any 2 seconds);
Coder averaged 5-second readings, so a 160 ms burst inside 5 seconds never
counted. Now it reads the stall every half second (`samplePressure`,
`PRESSURE_SAMPLE_MS`) and looks at each background command when 150 ms falls
within 2 seconds (`stallTriggered`), then starts the readings again, as the
kernel fires once a window.

**The account's email with a User-Agent, live and side by side** (owner,
2026-11-12: "Ok yes"). On gofarther.dev, with the throwaway test account's own
address and every command pointed at 127.0.0.1 port 9 (nothing listens, so
nothing leaves the machine): of 8 calls in Auto, Coder refused the same 6 as
Claude Code 2.1.323 (curl's `-A`, wget's `-U`, a `User-Agent:` header with the
address %40-encoded and in capitals, `echo "User-Agent: …"`, and a monitor) and
ran the 2 without the address next to a User-Agent; one call each in Accept edits
and Plan was refused too; never a question card. Claude Code (Haiku), with its own
settings folder whose account email was made up, did the same in default, Accept
edits, Plan and Auto, also with no allow rule (the refusal comes before the ask).
Two differences, from its run and its code (`cc-plugin-privacy`), fixed: Grok is
now told Claude Code's words, "Permission to use Bash denied by plugin
cc-plugin-privacy: " before the refusal (and Monitor, PowerShell:
`accountEmailRefused`, CD548), and the address is also looked for without its
quote marks and backslashes, as Claude Code's QUOTING does (o'brien@… as
obrien@…): the Worker then sends a second length and SHA-256 after a comma
(`emailMark`), and the machine takes one or two (CD549). A monitor's own input
is what is read for it.

**The low-memory stop and dangerous deletes, live** (owner, 2026-11-13: "Dont
leave them out ,we gotta test them bro"). The memory-pressure stop fired on a real
machine: a background command holding 14 GB under a raised cap, writing without a
break and taking 300 MB and giving it back every 4 seconds (dirty pages the
kernel must wait to write: 400–2,000 ms of stall within 2 seconds, about 1.43 GB
available), was left alone while the chat had been active within 30 minutes and
stopped two seconds after the 30th idle minute (SIGTERM, "low memory", Claude
Code's words; Grok was woken with them). Dangerous deletes: Grok (and Claude
Code's Haiku) refused to make the calls at all, so the owner's own PreToolUse
hook turned marker commands into them (`updatedInput`, applied before the check):
Accept edits asks with Claude Code's words and only Yes and No; Auto refuses; the
owner's Ask rule asks in Auto; the three switches let them run; answered Yes,
each ran for real in the admin sandbox (`rm -rf /` stopped by rm's own failsafe).
After `sudo rm -rf --no-preserve-root /`, the sandbox could no longer start and
the next commands ran outside it as plain `dev` (the fallback), unannounced.
Claude Code 2.1.323 differs in Auto: it shows the question to someone watching,
refused by itself after 2 minutes, and stops showing it after 3 unanswered in a
session (its `tengu_splendid_horizon` defaults: `timeoutMs` 120000,
`maxDialogTimeouts` 3); and it has `CLAUDE_CODE_STRICT_INLINE_SHELL_RM_PROMPT` and
`CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY`, which Coder lacks. Not changed: the
owner's call.

**Claude Code 2.1.323's bash-tool changes, copied** (owner, 2026-11-13: "Yes all
7"; `test/cc323.test.mjs`, CD550–CD559). Read in Claude Code's own program and,
where it says so, tried in its command-line version with Haiku.
1. *Deny and ask rules past sudo and env with settings written together*
   (`sudo -nu root touch x`): both of Claude Code's readings are tried, the usual
   and the wide one (`unwrapSteps(…, { wide: true })`, its `vze`): settings
   written together take a value when their last letter does, and after sudo or
   env a word with `=` is a setting. The dangerous-delete check reads both too
   (`sudo -nu root rm -rf /`, `env -iu FOO rm -rf ~` had passed it).
2. *An allow rule's `*` joined to the program's name* (`starStretchesProgram`,
   its `qpr`): `Bash(NODE_ENV*)` no longer approves `NODE_ENV=1 touch x`, nor
   `Bash(ls*)` `ls=1 touch x`; letters, digits and `_ . + - : @ % , ~ /` after it
   are the same word (`Bash(ls*)` still approves `lsof`). Also its "combined
   sudo flags" fix (`Bash(sudo -Eu root NODE_ENV*)`).
3. *A warning for a `*` in a variable's value* (`starInSettingValue`, its `Dh`),
   in its words, before the wildcard-before-the-command one.
4. *Writes into protected places from a command*: bash already asked every time,
   with only a one-time Yes, whatever the rules (the earlier note was wrong). The
   PowerShell tool did not: in Accept edits `Add-Content .bashrc x` ran unasked.
   Now its writing cmdlets (Claude Code's list, with Remove-Item and
   Clear-Content; `psWriteTargets`) and its redirections ask the same way
   (`psProtectedAsk`). Claude Code's own other words for its settings files:
   "… requested permissions to write to …/.claude/settings.json, but you haven't
   granted it yet."
5. *Auto's 2-minute question for a dangerous delete* (Claude Code 2.1.281): in
   Auto, and in Plan where the checker reviews commands, a card with only Yes and
   No and Claude Code's line, "Coder will automatically block this request in
   1:59, to avoid holding up an unattended session", counted down each second;
   unanswered, the delete is blocked and Coder goes on, told Claude Code's words
   ("… and no person did (the permission prompt timed out, or none was shown)").
   After 3 in a row went unanswered none is shown ("… already gone unanswered 3
   times in this session, so it was not shown again"); an answer starts the count
   again. The count is kept with the chat's other Auto counts.
   `CODER_DISABLE_DANGEROUS_RM_TIMEOUT` keeps the old way (the checker decides).
6. *`CLAUDE_CODE_STRICT_INLINE_SHELL_RM_PROMPT`*: Claude Code ran 11 harmless
   commands whose `-c` script or eval text it can't read the same way with and
   without it; Coder's check lets all 11 through too (CD558). Nothing to copy.
7. *No command outside the admin sandbox when it should be on*: on a machine made
   for one (`sandbox` and a kept disk) where it can't start, the AI's commands and
   the owner's `!` are refused in Claude Code's words for its strict sandbox mode
   ("The command did not run. … no command may run outside the sandbox, and the
   sandbox failed to start in this session …"), and the chat says why. The
   environment's setup script, which runs inside the sandbox, waits too ("Setup:
   not run, …"). Coder's helpers and the owner's hooks still run, as Claude Code's
   hooks run outside its sandbox. The owner's `!` step reads "✕ not run", with
   "Not run: Coder's admin sandbox could not start on this chat's machine."
   (`BOX_DOWN_OWN`); the AI, which answers it, gets Claude Code's words in the
   command's output (live test, 2026-11-13: the step read "exit -1", with the
   words meant for the AI).

**The sealed room** (owner, 2026-11-07, step 3: a real wall for the network
setting). Coder's old wall was a firewall rule matched by user (iptables'
owner match), which Fly.io's machines lack, so there the network setting was a
guard for tools that use the proxy, not a wall. Now the real service runs the
AI's commands in a network of their own (`container/coder-room.mjs`, a Linux
network namespace the service owns; `execIn`'s `room`): started by the service
(`nsenter`) and made the AI's user (`setpriv`) before the command runs. The
room's only ways out are a relay where the commands are told the gate is
(`coder-room-forward.mjs`, root's, on 127.0.0.1:<port>), which passes to the
gate through a socket only root can open, and, with Full access only, the
room's own user-mode internet link (`slirp4netns`). The AI has no rights over
the room's network, and a change of setting mid-job reaches the room at once.
A machine that cannot have the room runs commands as before, and Coder is told
the list is then only a guard. A room counts only when it can be entered
(`makeRoom`): on Fly.io a sleeping machine keeps its own disk, `/run` with it,
so after a restart only the room's name was left, and every job ran without the
room (live test, 2026-11-07); now the name is taken away and the room made
again. `test/room.test.mjs` tries the room for real as root, a restart
included (the deploy runs it), and the GitHub machine check tries it in the
full image with the real gate and real websites (`test/room-check.mjs`).

**The machine's own disk, all of it** (live test, 2026-11-07). On Fly.io the
machine's own changes go on its own disk (`/.fly-upper-layer`). A machine made
before that disk could be 20 GB had the disk made bigger by Fly.io, not the
filesystem on it (7.8 GB of 20). At start the service grows the filesystem to
fill its disk while in use (`growOwnDisk`, `resize2fs` from e2fsprogs), without
holding up the start; anything unexpected, and nothing is done.

**The master key's jobs** (owner, 2026-11-07, step 4). Coder's commands install
any Ubuntu package mid-job (`apt-get install`, `apt install`, `sudo apt-get
install`) and run any installed service (`service NAME start`), as on Claude
Code's machine, and use ports 80 and 443 in their room (the room's own
`ip_unprivileged_port_start`). sudo lets `dev` run one program as root,
`container/tools/coder-admin` (`tools/coder-admin.sudoers`), which checks each
request (package names only, never an apt option; a service that is installed;
start, stop, restart, reload, status) and does nothing else; with a limited
network its apt goes through the gate (`gateForApt`, `/run/coder-gate/apt-proxy`).
`tools/apt-get` (also `apt`), `tools/service` and `tools/sudo` pass only those
jobs on, and refuse the rest plainly. On a machine with the admin sandbox
(below), that is only the fallback.

**The admin sandbox** (owner, 2026-11-07: "finish this": Claude Code's commands
run as full admin; `container/coder-sandbox.mjs`). Each job's commands, and the
whole setup script, run in a sandbox of their own, as its `dev` with sudo for
anything (`/etc/sudoers.d/coder-sandbox` in the sandbox's own layer): install,
remove or upgrade any package, change any system file, run any service, use any
port. `tools/apt-get` (also `apt`) and `tools/service` add the sudo themselves
there, and `tools/sudo` passes everything to the real sudo (they know the
sandbox by `/etc/coder-sandbox`, which only it has). It is Linux namespaces: a
user namespace whose admin is, outside, an ordinary unknown user (ids 1000000 and
up; `/etc/subuid` gives root that range), its own mount and process namespaces,
and the sealed room's network, which it cannot change or leave (it is owned by
the machine's admin). Its system is the machine image itself, read-only, shown
through an id map (on Fly.io the image's own disk, `/dev/vda`, since the
machine's root is a layered filesystem that an id map cannot show; elsewhere the
root; `CODER_SANDBOX_BASE` names another), under its own layer (overlayfs, with
`userxattr`, without which dpkg's folder renames fail) on the chat's kept disk,
`/data/.coder-admin/<version>`: what it installs stays while the machine
sleeps, and so does its `/tmp`, from one message to the next, as Claude Code
keeps `/tmp` for its session (the owner, 2026-11-08: "Fix that too"; each job had
a fresh, empty `/tmp` before); `/run` and `/dev/shm` last one job. A new Coder version (`CODER_IMAGE_REF`, from the Fly settings)
starts it fresh. It sees, at the same places, the chat's files, dev's home and
Coder's memory (dev's on disk and inside: only dev, and its Docker's own ids from
`/etc/subuid`, are mapped, so nothing there can be made as the machine's admin
or any other user: `mineIdmap`), and, read-only, the git folders, the
background logs and the gate's certificates; nothing else of the machine
(`pivot_root`). Its first process (`coder-sandbox-init.sh`) builds all that and
waits; each command enters it (`nsenter`, `sandboxArgs`). It is stopped wherever
the AI's commands are (`killUser`): before root's git, at the end of a job and
before the next. Docker's engine runs in it as dev, as before (today's engine
runs in the room's own network, Docker's "detach-netns", so `tools/docker` gives
it the gate at 127.0.0.1; an older one, inside its own, gets 10.0.2.2). A machine that
cannot have it runs commands as before, with the master key's jobs, and Coder is
told which (`MACHINE_ADMIN` or `MACHINE_TOOLS`). `test/sandbox.test.mjs` tries it
for real as root (the deploy runs it), and the GitHub machine check tries it in
the full image given as a disk, with the real gate (`test/sandbox-check.mjs`).

**The environment's saved copy of its setup** (owner, 2026-11-07: "ok start";
like Claude Code's environment cache: "If it completes in under about 5 minutes,
the filesystem is snapshotted and reused", and "Cloud sessions start from a
fresh clone of your repository"). On Fly.io, when a chat's setup script runs on
a fresh disk (no job has worked on it: no `.coder-used`, and no project on it
before the job's clone), in the admin sandbox (so
all it made is on that disk: the sandbox's layer and dev's home), and works
within its five minutes, the job waits before Coder starts (`held`): the machine
writes the copy's note (`.coder-copy.json`: the chat, the setup's fingerprint
`setupSha` of the script and the network setting, the Coder version) and flushes
the disk; the Worker has Fly save the disk (`snapshotChat`: kept 8 days,
`CACHE_KEEP_DAYS`) and records it on the environment
(`coder/<uid>/environments/<id>.cache.json`: Fly's name for the copy and its
disk, its size, region and Coder version, the setup's key `setupKeyOf`, and
`ready` once Fly has finished it), then tells the machine to go (`/go`, with a
note the machine puts in the chat; without an answer it goes on after 2
minutes, `HOLD_MS`).

Fly saves a disk when it gets to it, not when asked (live test #25,
2026-11-07; its docs: "Scheduled to snapshot volume", and a copy goes "from
waiting to running to created"; one took over 7 minutes to finish). So the
Worker waits until Fly lists the copy as `running` (it is saving the disk) or
`created`, then 10 seconds more (`CACHE_START_MS` 80 seconds at most, within
the machine's 2 minutes; not started by then: no copy, said in the chat), and
the copy's note stays on the chat's disk for good, so a copy saved later still
says what it is. A new chat in the environment gets its disk made from the
copy only once Fly has finished it (`copyState`, asked at the chat's first
message until the record says `ready`; Fly refuses an unfinished one). While
it is being finished (up to `CACHE_PENDING_MS`, 30 minutes), a new chat runs
the setup itself, says so in the chat, and makes no second copy. The copy must
be for the same setup script and network setting, Coder version and region,
under 7 days old, and recorded with its disk (`cacheUsable`; one recorded
before this fix is not, so it is made again). The new disk (`x-coder-from-copy`,
only when its machine is made, never sent to a machine; at least as big) is
used once Fly has restored the copy into it (`restoring`, then `created`; 5
minutes at most, `FLY_RESTORE_MS`). If Fly cannot make it, restore it, or start
a machine on it, what was made is removed and an empty disk is made as before;
the machine's record keeps why (`copyMiss`), and the machine is told
(`x-coder-copy`: `used`, or `missed: why`, set only by flyBox) and says it in
the chat. On a disk made from the copy, the machine's first job (`takeCopy`)
first removes the other chat's own files (its repositories, git folders and
memory), so every chat clones its repository fresh; a copy of this same setup
skips the setup (said in the chat, and to Coder, which runs a project's own
install itself, since what the setup made inside the project folder is not
there); any other copy, or one with no note, is cleared down to a fresh disk,
the setup runs, and the chat says why. The variables and keys never reach the
setup, so they are not part of the copy. Cloudflare's containers have no
saved copies. The read-only button `.github/workflows/check-coder-copies.yml`
lists the newest chat disks, their copies and these records (no account or
chat ids).

**Root's git is never steered by the AI's files** (the audit, 2026-11-06). The
projects folder (`/work`) belongs to root: the service makes each project's
folder and hands only that folder to `dev`, and refuses to work in a project
folder that is a link. Git never runs inside a repository the AI made in the
project (or a submodule folder it made into one), and such a folder is never
saved. Files are handed to `dev` one by one, never through a link, and a file
with another name elsewhere (a hard link) keeps its owner.

Before root touches a project's files, every process of `dev` is stopped by the
kernel (a kill sent as `dev` to all its processes at once); if that fails, root
does nothing with the files. The hand-over holds each folder open while it works
in it, so a folder swapped for a link is never followed. A save says in the chat
what it left out ("Not saved: …"), and a submodule the AI moved to another
commit is still saved (its commit is read by the service, never by git inside
its folder). Root reads the repo's instruction files and the memory file only
when they are plain files with one name, through real folders, never a link.
The deploy runs the root-only tests (`test/root-safety.test.mjs`) under sudo.

**The repo's instruction files** (owner, 2026-11-07, item 10; like Claude Code's
memory docs, with Coder's own names; CLAUDE.md is never Coder's:
`repoInstructions` in `container/server.mjs`). At the start of every job:
`CODER.md` and `.coder/CODER.md`; when the repo has neither, `AGENTS.md` and
`.coder/AGENTS.md` (other coding agents' file); and the rules in
`.coder/rules/` (any `.md`, in folders too). A rule whose YAML front matter has
`paths:` (Claude Code's patterns: `*.md` anywhere, `/*.md` only at the top,
`src/**/*.{ts,tsx}`) loads instead once Coder reads, edits or writes a matching
file, and a subfolder's own `CODER.md` (else its `AGENTS.md`) once Coder works
on a file under it: with that tool's answer, once a job (`laterNotes`). Coder is
told at the start which ones wait for which files. All are read by root before
any of the AI's commands run; `node_modules`, `.git` and build folders are not
searched. At the start they come to at most 100,000 characters in all
(`NOTES_MAX`; Claude Code loads each CLAUDE.md whole), and one that loads later
to 40,000 (`NOTE_ONE_MAX`, Claude Code's limit for such a file); past either, the
file is named with a note to read the rest with the read tool, never cut without
a word.

**A security check on each edit** (owner, 2026-11-07, item 12; like Claude
Code's security-guidance check on each file edit, with no model call:
`container/coder-security.mjs`). What Coder writes (`write`: the whole file;
`edit`: what goes in) is matched against risky patterns: dynamic code (`eval(`,
`new Function`, `os.system`, `shell=True`, `child_process.exec`), unsafe
deserialization (`pickle`, `yaml.load` without SafeLoader), DOM injection
(`dangerouslySetInnerHTML`, `.innerHTML =`, `document.write`), queries built from
text, private keys, and any edit to `.github/workflows/`. A match adds a warning
to that tool's answer, once a job for each rule and file, and Coder fixes it or
says why it is safe; nothing is blocked. A repo adds its own rules in
`.coder/security-patterns.json`, `.yaml` or `.yml`, with Claude Code's fields
(`rule_name`, `regex` or `substrings`, `paths`, `exclude_paths`, `reminder` up
to 1 KB; 50 at most). Claude Code's two model-backed reviews (at the end of each
turn, and on each commit) are not built: they cost model calls.

**Long chats are summarized, not cut** (owner, 2026-11-07, items 3 and 9; like
Claude Code's auto-compact, `/compact` and Rewind's summaries:
`container/coder-compact.mjs`, `src/coder-summary.mjs`). Coder's own model
writes each summary from a plain-text copy of that part of the conversation
(tool answers cut short; no secrets kept); it stands in for those messages in
what Coder reads (`messages.json`), while the chat (`events.json`) keeps every
message, with a note where the summary stands. Before a job, a saved
conversation past 300 KB has its older jobs summarized (the owner's newest
three messages stay whole); if no summary can be made, the oldest part is cut
as before. Within a job, past 450 KB, the job summarizes its own older steps
(never between a tool's call and its answer, and never the saved history
before the job). What a summary leaves comes to at most 70% of the room
(`KEEP_SHARE`): the chat before the job and the owner's message, the summary,
the files read again (at most 10%, `REREAD_SHARE`), and the newest rounds whole,
which get what is left (up to eight, at least the newest one); pictures never
count. When a summary cannot bring the job back under its room (the chat before
it is near the room), none is made again until the job has grown by a tenth of
it. At most thirty times a job (`COMPACT_JOB_MAX`). While Coder works, a read gives up to about 100,000 characters,
but the chat saved between messages keeps each tool's answer and each note of
the app to 12,000 characters, and a summary to 40,000 (`forSaving`), and the
chat's record keeps each step's output to 12,000; the saved chat's size cap
(`capHistory`, 400 KB) cuts only at the owner's messages, and one job over it
has its answers shortened, never the job dropped (it used to leave nothing).
`/compact [what to keep]` makes the whole conversation one summary, as a job on
the chat's machine that Coder does not answer, so its PreCompact, PostCompact and
SessionStart hooks run (round 5). Rewind offers Claude Code's choices: Restore code and chat, chat only,
code only (the code ones only when a later job changed files), Summarize from
here and Summarize up to here (each with an optional focus); after the chat
goes back, the message returns to the box. Rewind's points inside a summary go.
Since 2026-11-13 Restore code puts back only the files Coder's file tools changed, like
Claude Code's checkpoints ("A file that only Bash commands changed isn't tracked and stays
as it is"): each job's result names the files its write and edit changed (`edited`), kept
with its commit, with whether the commit changed such a file by any means (`tracked`, from
the push's `files`: "Under each prompt, the rewind menu counts changes to files Claude had
already edited, whatever made them"); the code choices show only when a later job did. The
machine's `/restore` (`restoreTracked`) puts each tracked file back as it was before the
message, or, for one first changed after it, as it was before the job that first changed
it, so a command's later change to a tracked file is undone too, and a file the tools made
is removed; a link, a hard-linked file, one under a link or where a folder was is skipped
with Claude Code's warning ("Restored the code, but skipped N files: …"). One commit with
the chat's link, saved to the branch, never a force push (in a read-only chat, kept on
Coder's machine, and the Rewind box says so, CD567); Coder is told which files went
back. A chat with jobs from before then reverts the later jobs whole, as before. Tests:
`test/rewind-restore.test.mjs`.

**Notifications, like Claude Code's** (owner, 2026-11-07, item 8; its mobile and
Remote Control docs; `src/coder-push.mjs`). Web Push from the Worker: Coder's
own key (VAPID, RFC 8292, made once and kept sealed), each message encrypted for
its device (RFC 8291, checked against the RFC's own example), sent only to a
browser's push service (Google's, Mozilla's, Apple's, Microsoft's). The account
menu's **Notifications** panel turns them on for a device (the page's service
worker, `public/sw.js`, shows a push and opens its chat; it caches nothing) and
holds Claude Code's two switches: **Push when Coder decides** (Coder's `notify`
tool, for "notify me when the tests finish", at most 3 a job; and the end of a
job of 3 minutes or more) and **Push when actions are required** (its question,
a key it needs, an environment change it proposes). They go out as the job's
steps reach the Worker (`handleLive`), each step once, never about a chat the
owner is looking at (the page's polls say so while visible and focused). A
device its push service says is gone is forgotten. Works in browsers on
computers and Android, and on iPhone from the Home Screen (iOS 16.4 or later).
The desktop app's window has no Web Push: while the app is open (minimized too;
its background throttling is off) the page watches the chats itself and shows
the same notifications with the same switches (the chat list's `waiting`, what
a job left for the owner, and `ran`, how long it took), turned on per app. The
phone app (Capacitor) has none yet: native push needs the owner's Firebase and
Apple accounts.

**Connectors (MCP)** (built on the jessica copy, 2026-11-10 to 11-11; merged into
main on 2026-11-13, the owner: "merge carefully so we can have that code"): each
person's list of MCP servers (the gear's menu, Connectors: Yours, Discover, a page
per connector with Always allow, Needs approval or Blocked for each tool), switched
on or off per chat from the chat box. Sign-ins stay sealed on the Worker; the
machine calls a tool through `/api/coder/mcp` with its job's pass, and the Worker
adds the sign-in. Grok sees each tool as `mcp__<connector>__<tool>`, after Coder's
own; jobs started from GitHub get none. What `docs/connectors-vs-claude-code.md`
lists from Claude Code's MCP docs is done there (tool search, long answers to a
file, time limits, the server's always-ask, resources and prompts, and the rest).
Since the merge, a connector's tool goes through what every tool does, as Claude
Code's MCP tools do (`container/coder-agent.mjs`, `test/connectors-merged.test.mjs`):
permission rules by its name or its connector's (`mcp__linear__create_issue`,
`mcp__linear`, `mcp__linear__*`; `parseRule` and `wholeRule` in
`container/coder-perms.mjs`), PreToolUse, PermissionRequest and PostToolUse hooks by
its own name (its card shows as "connector", `card.hookTool` carries the name), a No
that ends the turn, and Plan mode asking before one that changes something.
Read-only connector tools start side by side only where no hook or rule checks
each call first.

**Gloopy** (built on the test copy, test.gofarther.dev, 2026-11-09 to 11-13; merged
into main on 2026-11-13, the owner: "merge carefully"): an always-on assistant in
its own tab, one per person, on Coder's own engine (`runCoder`), with its own
instructions, tools (its browser, sign-in and paying cards, hand-off, schedules,
webhooks, files, pages, helpers), its own checks before a step that could change
something, and its own Settings (what it may do on its own, its rules in the
owner's words). The page draws both tabs with the same code (`makeView('coder')`,
`makeView('gloopy')`). What the merge keeps apart (`test/gloopy-merged.test.mjs`):
a Gloopy turn runs with none of Coder's hooks, Auto checker or permission rules
(the machine's `gloopyOpts`), and its browser rules go in as `browserRules`, apart
from Coder's `rules`; the mode chip, its keys and the connectors chip are Coder's
alone; Settings, Connectors and Notifications open in the tab that is showing.
Gloopy's `/compact` is still made by the Worker (Coder's runs on its machine, with
its hooks).

**Gloopy uses the connectors** (2026-11-13, the owner: "make gloopy use the
connectors"): the same list as Coder's chats (the Connectors page), sent with each
Gloopy turn by the Worker (`jobConnectors`) and offered after Gloopy's own tools
(with the tool search when there are many); each call goes through the Worker's
gate with the turn's pass, as Coder's do. Each tool as the owner set it: **Always
allow** runs at once; **Needs approval**, and a tool its server asks about every
time, asks on Gloopy's own card and the turn ends there (Gloopy has no modes, so
Coder's "in Auto it runs" does not apply; nor do read-only tools start side by side
before their card). On the card, **Allow once** has the Worker make that one call
with the owner's sign-in (`gloopyCard`), and Gloopy hears the answer with the next
message, fenced off as the connector's data (up to 20,000 characters); **Always
allow** also sets that tool to Always allow on the Connectors page (not offered for
a tool its server asks about every time); **Deny** calls nothing, and Gloopy is not
asked about it again until the owner's own next message. **Blocked** tools are never
offered. Gloopy's helpers (owner, 2026-11-13: "fix 3") get only the tools set to
Always allow, not one its server asks about every time nor one the owner just said
no to, as a helper can't ask on a card (`helperConn` in the agent; Claude Code's
background subagents deny what isn't allowed beforehand). Tests:
`test/gloopy-connectors.test.mjs` (GC8 for the helpers).

**A message can't get stuck** (owner, 2026-11-13: "fix 1", from the note Gloopy's
session left): Coder's chats start a message as Gloopy's do since its fix. The
chat is marked as starting before the slow part (`claimStart`: the GitHub sign-in,
a long chat's summary, the environment), so another message meanwhile waits in the
queue; the same message sent twice (the page's `mid`; a browser sends it again when
its connection drops) waits for its first copy and is never started or queued twice
(`sameMessage`); a failed start puts the chat back only while it is still its own
(`release`), never over a newer start; a long chat's summary is made by one start
only (`START_SETTLE_MS`); the start's id goes to the machine, which takes the same
start twice as one; a start cut off half-way is undone by the state check after
`STARTING_MAX_MS` and said in the chat; and the start goes on when the page goes
(`ctx.waitUntil`). Tests: `test/coder-start.test.mjs`.

**Settings in Gloopy's tab are Gloopy's** (owner, 2026-11-13: "fix 2"): the gear's
Settings opens Gloopy's own Settings there, as its header button does; Coder's
(background commands, disk and memory warnings, hooks, Auto mode) are in Coder's tab.

**The docs page** (`public/docs.html`, gofarther.dev/docs): Read, Write, Edit, Bash and
Connectors, the tools tested live so far (owner, 2026-11-13: "do the docs live now for
the tools we have done in the coder"); its numbers are checked against the code
(`CD248` in `test/found-in-testing.test.mjs`).

**While testing:** only the accounts in `CODER_USERS` may use it, and nothing is
charged. `CODER_ON` `"off"` makes every `/api/coder/` address answer 404.

## The GitHub App

Registered: **gofarther-coder** (Client ID `Iv23li7CSEGqBSxEqQU7`), callback
`https://coder.gofarther.dev/api/coder/github/callback`, permissions Contents and
Pull requests (read and write) and Metadata (read), installable by any account.

**@coder in a comment, and auto-fix** (`src/coder-mentions.mjs`). GitHub's call
is answered at once, with "On it" posted as the app, and the job's record is
made with its message still to send (`queueStart`). The every-minute check
(`runMentionJobs`, from `scheduled` in `worker.js`, which awaits all of its
work) sends it: Cloudflare cancels what still runs 30 seconds after GitHub's
call is answered, and a start can take minutes (a machine fetching Coder's
image, the clone, the setup script). It claims a start first (`starting`), so
a slow one is never sent twice, and starts one job per chat at a time. A start
that fails is told in place of "On it". If the check that was starting a job
was cut off (Cloudflare gives it 15 minutes, `START_STALE_MS`), the job goes on
when its message went in, and otherwise Coder says on GitHub that starting took
too long. Live test, 2026-11-07: before this, a job whose start took minutes
had no record, so its "On it" comment never changed.

**Auto-fix, like Claude Code's** (owner, 2026-11-07, item 2; its docs: "turn on
Auto-fix", "paste the PR URL into a session and tell Claude to auto-fix it",
"tell Claude to stop watching the PR"). Off until turned on for a pull request:
with the chat's Auto-fix button, or by asking Coder in the chat (its `auto_fix`
tool; never from a job GitHub started), for any open pull request of the chat's
repository (never a fork's, whose branch cannot be pushed to, nor one another
chat has): the chat then works on that pull request's branch (`autofixFor`,
applied when the turn ends; its branch is recorded, `branchKey`). With it on, a
failed check on the pull request's newest commit, or the owner's review, starts
a job in its chat (up to 3 in a row without the owner writing). Nothing is
posted on the pull request: Coder explains in the chat, asks first when a
comment is unclear, and, for a review comment, may answer in that comment's
thread (`reply_review`, only that thread), posted at the job's end as the owner
and marked "— Coder (gofarther.dev), for @owner". Like Claude Code's, it cannot
react to a merge conflict (GitHub sends no news when the base branch moves).

**Code review, like Claude Code's** (owner, 2026-11-07, item 11; its Code Review
docs; `src/coder-review.mjs`). Off until the owner turns it on for a repository
they can push to, where Coder's app is installed (Repositories screen,
`POST /review/settings`). Its **Review runs**, as Claude Code's: After every
push, Once after PR creation (opened, reopened, ready for review), or Manual;
and a **level**: Quick (one finder, low effort), Standard (two finders and a
check) or Deep (three finders, a check, high effort). Automatic reviews skip
drafts and forks, with a tip where none starts. **Comment commands**, at the
very start of a new top-level comment on a pull request, from a Coder user with
write access (checked with GitHub; strangers get no answer): `@coder review`
(or `once`), `@coder review always` (also reviews each push), `@coder review
stop` / `off` / `pause`; they never start a plain @coder job. A review is
queued with a **Coder Review** check run ("Code review queued..."), one per pull
request, and run by the every-minute check on the Worker, read-only, never
building or running the code: **find** (finders with different lenses, at
once), **verify** (a check that drops false positives), **rank** (deduplicated,
by severity, at most 25 and 10 nits), **post**: one review (`COMMENT`, never an
approval) with an inline comment for each finding on a line of the diff (🔴
Important, 🟡 Nit, 🟣 Pre-existing, with "Why this was flagged"), the rest in
its summary and as the check run's annotations; the check run concludes
neutral, its details a table ending with `<!-- coder-review-severity: {...} -->`;
no findings: a note. It reads `REVIEW.md` from the base branch only (its `@file`
lines beside it, at most 8; a skill's `SKILL.md`; a subfolder's own, never in a
test, example, generated or vendored folder) and `CODER.md` (or `AGENTS.md`)
at the root and in each changed file's folders. The pull request's text and
code are data. **A later review on a push** covers what changed since the
last one, posts no nits or pre-existing findings (and says how many), resolves
the threads of findings it judges fixed (GitHub's GraphQL, as the app), and
answers a person's reply once; a push that changes no lines keeps the earlier
result ("skipped — no new changes", or "not repeated — earlier findings still
open"). Needs, in the app's GitHub settings: **Pull request** events (for
automatic reviews) and **Checks: read and write** (for the check run); without
them, comment commands and the review itself still work.

## Deploy

The **deploy coder** button (`.github/workflows/deploy-coder.yml`), pressed by
the owner. It needs these GitHub secrets: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `XAI_API_KEY`, `CODER_GITHUB_CLIENT_SECRET`. The token
key is derived from the client secret during the deploy. It also signs the
sign-in proofs, so a new client secret means everyone connects GitHub and signs
in again.
