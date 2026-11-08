# Coder against Claude Code, tool by tool

The owner's plan (2026-11-08): go through Coder's tools and environment one at a time. The owner tries each one in
both Coder and Claude Code with the same prompt. Claude (the assistant) compares them against Claude Code's actual
docs, read fresh each time: the [tools reference](https://code.claude.com/docs/en/tools-reference) and the
[cloud docs](https://code.claude.com/docs/en/claude-code-on-the-web).

Each entry: what Claude Code's docs say, what Coder does, the test, the results, and what changed.

Anything found that is not the tool itself goes in its own list, marked as outside the tool, and is fixed only on the owner's word (the owner, 2026-11-08: "Ok do that"). Something the tool's change breaks elsewhere may be fixed with it, said plainly.

---

## 1. read (Claude Code: Read)

**Claude Code's docs:**
- "returns the contents with line numbers";
- "PNG, JPEG, GIF, and WebP files are returned as visual content that Claude can see";
- PDFs: "reads short .pdf files whole. For PDFs longer than 10 pages, it reads in ranges… up to 20 pages at a time";
- notebooks: "all cells with their outputs, including… visualizations";
- "one call returns at most 25,000 tokens" (about 100,000 characters), and "refuses a whole file over 256 KB", so a larger file is read in parts with offset and limit.

**Coder:**
- **The same:** pictures (also BMP and TIFF), the same 10 and 20-page PDF rules, and notebooks with their charts.
- **Different before 2026-11-08:** text came 400 lines at a time, then the answer was cut to 12,000 characters with the middle dropped.
- **Now:** the whole file when it fits (up to about 100,000 characters a call), and a longer file in parts of whole lines, never cut in the middle. Test CD204.

**The test (the same prompt in both):** make long.txt (500 numbered lines), test.png (a red square with TEST) and test.pdf (page 2 only a blue circle). Then, with the reading tool only, give line 250, the picture and both pages.

The right answers: line 250 is 220956, a red square with TEST, and page 2 is a blue circle.

**Results:**

| Run | Line 250 | Picture | PDF page 2 | Reads |
|---|---|---|---|---|
| Coder, GitHub (issue #18) | 220956 ✓ | ✓ | ✓ | 3 (asked for line 245 on) |
| Coder, its real page (recording 9) | 220956 ✓ | ✓ | ✓ | 3 (asked for line 250 on; it fixed a missing font by itself first) |
| Claude Code (the owner's run, session "testing2") | 220956 ✓ (read just that line) | ✓ (and shown in the chat) | ✓ | 3 |

**Changed:** read gives whole files up to about 100,000 characters, like Claude Code's. Live with the next deploy.

**Double-checked against the docs' Read section, word for word** (the owner: "Double check it against claude code docs before going to the next one"):

| Claude Code's docs | Coder now |
|---|---|
| Line numbers | same |
| "at most 25,000 tokens" a call | about 100,000 characters (about 25,000 tokens) |
| Whole file over that: "the first page of the file, with a PARTIAL view notice saying how much of the file it received and how to read more with offset and limit" | the same: `[PARTIAL view: lines 1-926 of 2000 (about 98 KB of 200 KB). Read more with offset 927 and limit 916]`. The limit is worked out so the next part fits exactly. |
| "refuses a whole file over 256 KB" (read a part, or Grep) | the same |
| "an offset or limit read over the token limit": an error | the same |
| `allow_large: true`: the whole file or a long range in one call, "sized against the room left in the session's context window" | the same. Coder (never Grok) works out the room left before the job is summarized, and caps it at 400,000 characters. |
| "Reading an empty file returns a notice that the file exists but its contents are empty" | the same (it showed a blank line 1 before) |
| "an offset past the last line returns a notice giving the file's line count" | the same (it wrongly said "empty file" before) |
| Images refused only over 128 MB, resized | the same (refused over 20 MB before) |
| Notebooks: "more than 256 KB, or more than the token limit, returns an error", how to read part with a command; files up to 100 MB | the same (it cut the text at 40,000 characters and refused files over 20 MB before) |
| Folders and binary files refused | the same |
| PDFs: pages drawn with `pdftoppm`, so Claude sees every page | **the same since the owner's "Yes fix that too":** every page is drawn as a picture (1400 px on its longest side), and its text is kept too. Up to 20 pages a read all reach Grok: they share the read's room, and Coder's machine now passes up to 8 MB for a file tool's answer. |
| Long lines: not in the docs | Coder cuts a line at 2,000 characters (as Claude Code's own tool description long has) |

Tests CD204, CD205 and CD206 (all fail on the earlier code), CD194 and CD196 updated. 215 pass. The machine-image check (`test/read-check.mjs`) passes with it too.

**Second pass over the docs, every page that talks about reading files** (the owner: "Go over the claude code docs again over this tool"). Pages: tools reference (all of it, not only the Read section), errors, environment variables, context window, permissions, common workflows, memory.

Fixed (test CD207, CD208; 217 pass):
- **A pipe or a device** is refused at once, as Claude Code's Read does ("is a pipe or a device"). Coder used to wait on it until the time limit.
- **Viewing one file with a command counts as reading it** (`cat`, `nl`, `bat`, `head`, `tail`, `sed -n 'X,Yp'`, `grep`, `rg` on one file, no pipes or redirects, Claude Code's own list). That file's folder instructions now load, as for read.
- **Folder instruction files** (a subfolder's CODER.md, a path rule) are taken up to 40,000 characters, Claude Code's limit (8,000 before). A longer one gets a note to read the rest, where it used to be cut without a word.
- **After a long job is summarized**, the folder instructions it was shown load again when their files are read, as Claude Code's do ("load again on demand").
- **A password-protected PDF** says so ("is password protected").

**Added on the owner's "Yea add all of that"** (tests CD209, CD210 and CD211, all failing on the earlier code):
- **@-mentioned files go into the message**, like Claude Code's @ ("includes the content of the file in the conversation when it fits the Read tool's token limit"; "a text file larger than 256KB isn't included"):
  - Coder's app reads each one before Coder starts and puts it right after the owner's message, with its folder's instructions.
  - A picture is shown. A folder comes as its listing ("Directory references show file listings, not contents").
  - A file too big for one read is named, not included.
  - A path that isn't a file in the project (a package name like @types/node) is left alone.
  - Each shows in the chat as a step: "Read src/app.js (@-mentioned)".
  - Not in a job from GitHub, where strangers write.
  - Paths like `app/(auth)/page.tsx` and `pages/[id].tsx` work too.
- **After a summary, Coder re-reads up to five files it was working on**, the most recently changed first, like Claude Code:
  - A file over 20,000 characters (about 5,000 tokens) is only named: a "Referenced file".
  - Files the kept steps already show, pictures, and files that are gone are skipped.
  - They go with the summary, and show as steps: "Read a.js (again, after the summary)".
- **Instruction files at the start:** up to 100,000 characters in all (20,000 before). Claude Code loads each CLAUDE.md whole. Past the limit, a file is named with a note to read the rest, never cut without a word.
- Also: a note Coder's app adds (the @-mentioned files, a read's pictures, a reminder) no longer counts as one of the owner's messages when a long chat is summarized.

**Third pass over the docs** (the owner: "go look at the docs again"). Pages: errors (all of it), environment variables, hooks, settings, interactive mode, sub-agents, troubleshooting, how Claude Code works.
- **Confirmed:** by default Claude Code puts an @-mentioned file into the message. Only with `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1` does Claude get "the mentioned paths with a note to read them", which is what Coder did before.
- **Fixed (test CD212):**
  - A path or a pattern with a null byte is refused in Claude Code's words ("cannot contain null bytes (\0). Remove the null byte and try again."). Coder said "no such file" before.
  - A file that isn't a PDF says "is not a valid PDF" (Claude Code: "The PDF file was not valid").
- **The same already:**
  - a picture over 128 MB is refused, with how to make a smaller copy;
  - PDF pages need `pdftoppm` (Coder's machine has it);
  - a password-protected PDF says so;
  - a request is kept under the size limit (Claude Code's 32 MB, Coder's 30 MB);
  - after a few summaries in one job, no more (Claude Code stops "after a few attempts").
- **One more, added on the owner's "Yes do that too"** (test CD213, failing on the earlier code): "A note when a file Claude read earlier changes on disk" (how Claude Code works, "Context Claude Code adds on its own"). The docs say only that one line, so we checked what Claude Code really does:
  - **In my own session:** when one of my commands changed a file I had read, Claude Code added to its result: "[This command modified 1 file you've previously read: … Call Read before editing.]"
  - **The owner's test 1 in Claude Code** (a background command changes notes.txt from apple to banana, then ends): Claude Code woke up by itself when the command ended and was told only that it had finished, nothing about the file. Claude then read the file again on its own.
  - **The owner's test 2** (the background command changes the file, then keeps running, so nothing wakes Claude): at the owner's next message, Claude said it got no note at all. It learned of the change only from the cloud's own "commit your changes" check.
  - **Seen again in my session, the same day:** a command of mine changed a file I had read and ended with an error. Claude Code then sent this note on its own, word for word: "Note: …/docs/tool-by-tool.md changed on disk since you last read it. That's usually deliberate, so take it as the current state rather than reverting it; if the change looks wrong, say so rather than undoing it yourself — otherwise no need to call it out. The changes are not shown here; use Read if you need the current content." So Claude Code's note names the file and does **not** show what changed.
  - **So Coder now does the same:** a command that changed a file Coder had read says so in its result: "[This command changed 1 file you read before: a.js. Read it again before editing.]". A file changed any other way (in the background, or between messages) gets no note, and is never put down to Coder's next command.
  - For each file Coder reads, writes or edits (up to 256 KB; at most 100 a chat), its machine keeps only its time, size and a fingerprint, kept between messages. Coder's own edits are no news, and a file only touched (the same bytes) is no change.
  - (A first version also showed the changed lines for changes made any other way; the owner's tests showed Claude Code doesn't, so that was taken out.)
- **For later (tool 3, edit):**
  - Claude Code's Edit still edits a file that changed since it was read when old_string matches its current content, and "the result notes that the file carries other changes".
  - It refuses a file that isn't valid UTF-8, rather than spoil its bytes.
- **For later (tool 5, bash):**
  - Claude Code's background commands keep running between messages, and Claude Code wakes up when one ends (test 1). Coder stops them when a message ends.
  - After a summary, Claude Code "reminds Claude which ones [background commands] are still running so it doesn't start a duplicate".

**Double-checked, everything at once** (the owner: "double check everything we have with that tool"):
- **Every rule, run for real:** a checklist ran the actual read tool as Coder's machine runs it (as its own user, in a project folder) on 24 cases: line numbers, the PARTIAL view and parts that join up exactly, the 256 KB refusal, a part that doesn't fit, allow_large, empty files, an offset past the end, long lines, pictures (and one over 128 MB), PDFs (short, over 10 pages, 20 at a time, password, not a PDF), notebooks with plots, folders, binary files, pipes, null bytes, paths outside the project, an @-mentioned folder, and a command changing a file. 24 of 24 match.
- **The docs, read again word for word** (tools reference, context window, common workflows, memory). Two new differences, fixed (test CD216):
  - Claude Code "refuses a file whose extension it treats as binary, such as .xlsx, .parquet, .heic, or .zip", and its error suggests "a shell command or script that reads the format". Coder now does the same, with a way to read each kind.
  - "Read only reads files, not directories. Claude lists directory contents with a shell command such as ls": Coder's message now says to list a folder with glob or ls.
- **A gap found:** Claude Code re-reads up to five files "right after compaction", and that includes /compact. Coder did it only after a summary in the middle of a job. Now every summary made between messages (/compact, a long chat summarized, Rewind's summaries) names the files its part worked on, and the next job reads them again, once (tests CD214, CD215).
- **A fresh review of the code** (a separate reviewer, not shown my reasoning) found five real problems, all from read now giving much bigger answers. All fixed (tests CD217, CD218, CD219):
  - **A chat could lose its whole memory:** a job that read a lot went over the saved chat's size cap, and the cap then kept nothing. Now the saved chat keeps each answer to 12,000 characters (Coder reads a file again when it needs it; Grok still gets every read whole while it works), and the cap never drops a job.
  - **A long job's requests could grow without end:** its summaries always kept the newest 8 steps whole, which big reads made too big, and stopped after 3. Now they keep the newest steps only up to 40% of the room, up to 10 times a job. A test job that reads a 100,000-character file 40 times now keeps every request under 670,000 characters (the reviewer measured 5.4 million in a longer job on the earlier code).
  - **A rewind to a chat's very start** could make Coder's next command be blamed for the rewind's changes. Now a chat with no history follows none of the old files.
  - **The chat's record kept every big read whole** (heavy to load). Now each step's output there is kept to 12,000 characters.
  - **Next.js paths like `[...slug].tsx`** were not @-mentionable ("..." looked like going up a folder). Now only a real `..` part is refused.
  - Also: the PARTIAL view's "about X KB of Y KB" now counts bytes on both sides.
- **One more pass over the docs** (the owner: "one more time"): a big picture is shown smaller, and read's answer used to give only the smaller size as if it were the real one. Now it gives the real size, says it is shown smaller, and how to crop for fine detail ("Claude may see a downscaled version of a large screenshot … crop the region you care about … and then read the crop"). Test CD220.
- **The last check, everything fresh** (the owner: "check our coder is up to date with the claude code docs … one more time"): every read passage of the tools reference (to the end of the page this time), the context window, @-mentions, memory, environment variables and errors pages, and Claude Code's changelog (its newest 15 versions, 2.1.305 to 2.1.319, word for word). Read matches everywhere but three places, all fixed (tests CD221, CD222):
  - **A PDF that lies about its page count** (Claude Code 2.1.317: "Fixed a PDF's own metadata being able to make Read and @-mentions under-count its pages"). Tried on Coder: a PDF saying 3 pages but having 12 was read as 3 pages, the other 9 unseen. Now Coder counts the pages themselves (pypdf, on its machine) and reads a mended copy when the counts differ: "liar.pdf has 12 pages (the file says 3, but it has 12)". One whose count is too high, which Coder couldn't open before, is read from a mended copy too. The machine check (test/read-check.mjs) reads the hidden pages in Coder's own image.
  - **Instructions and memory after a summary** ("Project-root CLAUDE.md and unscoped rules | Re-injected from disk", "Auto memory | Re-injected from disk"; Claude Code 2.1.311 fixed "stale MEMORY.md and CLAUDE.md content right after automatic compaction"). Coder kept the copy made when the message started, so after editing CODER.md or its memory it went on seeing the old one. Now they come fresh from disk after a job's summary.
  - **.epub** (Claude Code 2.1.301 had read it as text): refused as binary by its kind, like .zip.
  - The same already: re-reading an unchanged file gives its content (Claude Code 2.1.317 "Removed the Read tool's 'file unchanged since your last Read' stub"); a big nested instruction file loads only its start (2.1.309); PDF pages drawn in the read's own folder (2.1.312's clash can't happen); reads that would refill the room right after a summary (2.1.307: fixed here by the review's fix 2).
  - Different on purpose: Claude Code tells Claude "to always pass absolute paths"; Coder's tools always run in the project, so paths from it work (a whole path inside it works too). Why (the owner asked, 2026-11-08; my first answer, "Claude Code runs on your computer", was wrong, as the owner said: "claude code is local and cloud both"): the docs give no reason ("Claude is instructed to always pass absolute paths"), and Claude Code does it in the cloud as well. What they do say: "When Claude runs `cd` in the main session, the new working directory carries over to later Bash commands", and it works in added directories too. So its current folder moves during a chat, and only a whole path always means the same file. In Coder every command (`bash -c` in the project's folder, in `server.mjs`) and every file tool starts in the project's folder, so `src/app.js` always means one file.
  - **Checked for real** (the owner: "Double check if that information is true"). Claude Code, in this cloud session: a `cd` carried over to the next command, and `Read README.md` (a short path, accepted although the tool says "must be an absolute path") opened `coder/README.md`, then after `cd desktop` `coder/desktop/README.md`. Coder, on its real machine code (the page test set-up): `cd src && pwd` then `pwd` gave `<project>/src` then `<project>`, and `read README.md` after them opened the project's top README; a whole path inside the project reads, `/etc/hostname` and `../outside.txt` are refused. All the docs searched (227 of 228 pages): no reason is given for absolute paths; `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` ("so every Bash command starts in the project directory") makes Claude Code's commands work as Coder's always do.
  - **Outside read, for tool 5 (bash), to ask the owner then:** in Claude Code a `cd` carries over to later commands (within the project or added directories); in Coder each command starts in the project's folder. **Done on the owner's word** (2026-11-08: "lets do it the claude code way"; tests CD230 to CD235, each failing on the old code). Tried in Claude Code first (this session): a `cd` carried over only when the command succeeded (`cd … && false` didn't move it); Glob and Grep with no path searched the new folder and listed from it; a `cd` in a background command got "Session cwd remains <dir>; directory changes made by the backgrounded command do not apply to subsequent commands." (and a background command with no `cd` got no such note); leaving the working directories got "Shell cwd was reset to <dir>". Coder now does each, and its commands start where the last one left off in the next message too (the Worker keeps the folder with the chat). Grok is told the folder in its context (WHERE YOUR COMMANDS RUN) and in a command's result when it changes, as Claude Code updates Claude's working directory; the file tools' `path` asks for a full path ("Claude is instructed to always pass absolute paths"). `CODER_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` in the chat's environment variables turns it off (Claude Code's `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`, under Coder's name). Not tested in Claude Code (its own safety check stops deleting the folder it is in): a folder deleted under the commands; Coder goes back to the project's folder and says "Shell cwd was reset to". Outside bash, fixed with it as the same lines changed: grep and glob given another repository of the chat by a short path searched the project's own folder (checked on the old code).
  - For later (tool 2, write): Claude Code won't let Claude overwrite a notebook or a file it read only partly (a PARTIAL view, or a big instruction file it saw only the start of, 2.1.312) without reading it all.
- **Checked again before merging** (the owner: "double check again against claude code docs before merging"):
  - **Claude Code's changelog further back** (2.1.260 to 2.1.304, word for word). Coder already matched nearly all its read changes; three more, fixed (test CD224):
    - **UTF-16 text files with a byte-order mark** (2.1.299: "Fixed Read garbling UTF-16LE files with a byte-order mark"): Coder refused them as binary. Read opens them now (edit still refuses them, for tool 3).
    - **CMYK JPEG pictures** (2.1.269: "Fixed CMYK JPEG images failing to attach"): now made sRGB, which Grok can open.
    - **`file_path` for `path`** (2.1.292: Read "ignore[s] a few stray parameters instead of failing the call"): Claude Code's own name is taken.
  - **The instruction files' HTML comments** (memory docs: "Block-level HTML comments … in CLAUDE.md files are stripped before the content is injected into Claude's context … When you open a CLAUDE.md file directly with the Read tool, comments remain visible"): now left out as they load, and read still shows them (test CD223).
  - **A second fresh review** of the newest code found nine real problems, all fixed (tests CD225, CD226):
    - a long chat's job summarized almost every round and still grew (what a summary leaves is now sized with the chat before the job);
    - **security:** the fresh reload of instructions after a summary made the machine's admin read the repo's folders while Coder's commands could still run (now only the memory file and the top-level CODER.md or AGENTS.md, with no folder on the way);
    - **security:** reading a PDF started Python in the project's folder, so a repo's `pypdf.py` would have run (now isolated, and no program a read runs starts there);
    - re-reads after a summary drew pictures and PDFs only to drop them; pictures counted when sizing the steps kept; the crop hint pointed at `/tmp`, which read refused (now a scratch folder, `/tmp/coder-scratch`, that read can open); a WebP's real size wasn't said; a deleted memory file broke the reload; a rewind point could be lost when a saved chat had to be cut down.
  - **For later, offered to the owner:** Claude Code saves pictures you paste where Claude can open them as files (2.1.275); its @ file list ranks a file-name match above a folder-name match (2.1.280). Done (below).
  - **For later (instruction files):** Claude Code warns when an instruction file is too long, and a CLAUDE.md can import others with `@path`.
- **The three the owner asked for** (2026-11-08: "Fix those 3"; tests CD227 to CD229, each failing on the old code; checked on the real page with screenshots):
  - **The picture a read opened shows in the chat**, under its step, as in Claude Code (seen side by side, below). Read's answer carries a small copy (a JPEG at most 320 on its longest side), kept with the chat's record; Grok never gets the small copy.
  - **The owner's pictures are saved as files** (2.1.275: "Improved pasted and attached images: they are now saved where Claude can open them as files without a permission prompt"): in the project's `.coder-pictures` folder, never saved to the branch, named by when they were sent, the newest 50 kept. A note added to the owner's message tells Coder where. Not in a job from GitHub.
  - **The @ list ranks file-name matches first** (2.1.280: "a file whose name contains the query now ranks above one that only matches across its folder names"): a name that starts with what was typed, then one that has it, then a match in a folder only; shorter paths first within each.
- **A correction:** I said Claude Code sent its separate "changed on disk" note probably because my command failed. It did it again after a command that worked, for a file outside the git repository. So that note seems to be for changes its in-command check doesn't catch. Either way it names the file and doesn't show the changes, as Coder's does.

**Which of the fixes above are read, and which are not** (the owner asked, 2026-11-08: "But is this part of that tool?"):
- **Read itself:** whole files and the PARTIAL view, the 256 KB and allow_large rules, empty files and offsets, long lines, pictures (sizes, the real size and crop hint, CMYK, the 128 MB limit), PDFs (every page a picture, password, not a PDF, the page count a file states, a repo's `pypdf.py` never run), notebooks, folders, binary kinds, pipes, null bytes, UTF-16 text, `file_path`, @-mentions (the file in the message), the re-read of files after a summary, and the note when a command changes a file Coder read.
- **Outside read, broken by read's bigger answers, so fixed with it:** the saved chat losing its memory and the size cap; long jobs' summaries (how much they keep, how often they run, pictures counted); the chat's record holding whole reads; re-reads of pictures after a summary.
- **Outside read, fixed while there (found in the same code), before this rule:** comments in CODER.md left out; the instruction files at the start (100,000 characters) and the fresh reload after a summary (and its security fix); a deleted memory file; a lost rewind point; .coder rules' "read the rest from line N".

Different on purpose: Claude Code's permission rules (`Read(...)` deny rules, a prompt for files outside the working folder, network paths) and its `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` setting. Coder has no permission prompts or settings. It reads only inside the chat's repositories (its extra ones too), plus its own memory file.


**Differences seen side by side:**
- **Claude Code shows the picture it opened in the chat.** Coder showed the step ("Read test.png") but not the picture. Fixed (the owner: "Fix those 3"): the picture shows under the step.
- **Saving:** Claude Code left the files uncommitted until its stop hook asked, then committed and pushed. Coder commits and pushes every job by itself. Same end result.

**The five-message comparison, Coder's side, live** (2026-11-08, after "Ok merge and deploy"; recording 10, a new chat on canias7/testingforclaude; Claude Code's side: the owner's screenshots, to come):
1. mid.txt whole: lines 1-926 of 2000 and "[PARTIAL view: lines 1-926 of 2000 (about 91 KB of 198 KB). Read more with offset 927 and limit 918]"; empty.txt: "empty.txt exists, but it is empty."; from line 5000: "mid.txt has 2000 lines: offset 5000 is past its end."; the folder: "error:  is a folder, not a file: list what is in it with glob, or a command such as ls". **A bug, in read:** the folder's name is missing for `.` (`rel` is empty there; it was before the folder change too). **Fixed** (the owner: "ur suggestion yes"): Claude Code's Read, tried in this session, answers a folder with "EISDIR: illegal operation on a directory, read '/home/user'" (for `.`) and "… read '/home/user/isibi-app/coder/src'", naming it by its full path; the docs: "Read only reads files, not directories. Claude lists directory contents with a shell command such as `ls`." Coder now names every folder by its full path (`folderError` in `coder-tools.mjs`) and keeps its hint ("list what is in it with glob, or a command such as ls"). Test CD237.
2. @notes.txt: "Line 2 is banana. Yes — its text was already in your message"; the chat shows "Read notes.txt (@-mentioned)".
3. sed: "exit code 0", "(no output)", "[This command changed 1 file you read before: notes.txt. Read it again before editing.]".
4. /compact: "Compacted: the conversation so far is now a summary for Coder. The chat still shows it all."
5. Read again after the summary: notes.txt and empty.txt shown, mid.txt only named (over 20,000 characters); notes.txt now apple, mango, cherry.
- **Outside read, seen in the recording (2:07), done on the owner's word** ("do it like this"): the line over a group of steps said "5 steps" and "a command failed" when the failed step was a read. Claude Code's docs and changelog name each kind in a collapsed group ("Ran 3 shell commands", "Read N files", "Searched for", "Listed N directories"; "a call that did not run" must not read as if it ran) but never show a failure's words. Now the line names each kind in the order they came ("Ran 1 command, read 4 files"; `groupWords` in `public/coder.js`) and what failed by its kind ("a read failed", "2 edits failed", "2 steps failed" for mixed kinds). Test CD236.
