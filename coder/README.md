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
| `src/coder-cors.mjs` | Only gofarther.dev may call it from another address |
| `container/` | The machine's image (Ubuntu 24.04 with Claude Code's tools; its helpers in `container/tools/`): the agent loop, the AI call (Grok 4.7 with an effort level), the safety checks, and the service that clones, runs commands, commits and pushes |
| `test/` | `npm test` from this folder |

## How it works

1. The user signs in, then connects GitHub: Coder sends them to GitHub's own
   sign-in, and they choose which repositories Coder may use.
2. They pick a repository. That is a Coder project.
3. Each message: Coder's machine clones the repository (once), works on its
   own branch `coder/<project>` with its tools (read, edit, write, grep, glob,
   bash, web search and the rest: `CODER_TOOLS` in `container/coder-agent.mjs`)
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
   monitor never shows its folder line (`noCwdMarks`). Grok's file tools get the
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
   2026-11-08), like Claude Code's AskUserQuestion: each question with a header
   shown as a chip, 2 to 4 options with a one-line description (the recommended
   one first, already chosen), several choices when it allows, and Other with a
   box; one Skip and one Submit. The turn ends there, and the answers are the
   owner's next message, one line per question after its header ("Database:
   Postgres"; "(no answer)" when none; "(Recommended)" left off); one question
   sends just the choice, as before. The event keeps the first question where
   older readers look (`text`, `options`) and all of them in `questions`; older
   one-question cards still show. The notification says how many more; on GitHub
   (@coder) they are numbered and answered in one comment.

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
   row starts with its kind ("Allow rule …"). Tests: `test/bash-side.test.mjs`.
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
that version is not on Fly.io yet, and `.github/workflows/check-coder-image.yml`
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
chat's own repositories, as `/repos/OWNER/REPO/...` (anything else: "GitHub
access to ... is not enabled for this session"); GitHub's GraphQL, which
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
`/compact [what to keep]` makes the whole conversation one summary and starts
no job. Rewind offers Claude Code's choices: Restore code and chat, chat only,
code only (the code ones only when a later job changed files), Summarize from
here and Summarize up to here (each with an optional focus); after the chat
goes back, the message returns to the box. Rewind's points inside a summary go.

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
