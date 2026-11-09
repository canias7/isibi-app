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
| Long lines: not in the docs | whole, never cut (since 2026-11-08: Claude Code 2.1.319 gave a 20,000-character line whole; Coder cut every line at 2,000 characters before) |

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

**Everything on read, live in the browser, then side by side with Claude Code** (2026-11-08; the owner: "yea we need to test everything in the browser bro , pls , remember that", then "ok" to merge, deploy and run it; deploy 65; recording 11, a new chat on canias7/testingforclaude, eleven messages; the files made by one script, `maketest.py`, the same on both sides; Claude Code's side run in this session by a helper, Claude Code 2.1.319):

| What | Coder, live | Claude Code |
|---|---|---|
| A file over 256 KB | "error: big.txt is 293 KB, over the 256 KB a whole read takes: …" | "File content (293KB) exceeds maximum allowed size (256KB). …" |
| A 127 KB file, whole | lines 1-1111 of 1561, the PARTIAL note ending "Do not answer from this part alone if the answer may be further in the file." | lines 1-657 of 1562 (50,521 tokens, cap 25,000), its note ending the same way |
| allow_large | the whole file | the whole file |
| A 5,000-character line | cut at 2,000, with "…" | whole. A 20,000-character line came back whole too; a 60,000-character line, over one read by itself, was left for its own read ("showing lines 1-1 of 4 total … Call Read with offset=2 limit=1"). **Different.** |
| UTF-16 | read | read |
| The folder | "error: /data/work/… is a folder, not a file: …" (its full path: live now) | "EISDIR: illegal operation on a directory, read '/home/user/cc-test2'" |
| .zip, .xlsx, .bin | refused, with a command for each kind | refused: "This tool cannot read binary files. …" |
| A named pipe | refused at once: "is a pipe or a device, not a file; it cannot be read" | waited about 8 hours, until something wrote to the pipe, then "the file exists but the contents are empty". **Coder better.** |
| /etc/hostname | refused: outside the project (on purpose) | read (this session's permissions allow it) |
| A null byte in the path | "the path cannot contain null bytes (\0). Remove the null byte and try again." | not tried for real (the helper's call sent the six characters `\u0000`) |
| Pictures: PNG, CMYK JPEG, WebP | all seen; a big one shown at 1600 px, with its real size and a crop hint | all seen; a big one shown at 2000 px: "[Image: original 6000x4000, displayed at 2000x1333. Multiply coordinates by 3.00 to map to original image.]" **Different.** |
| A 137 MB picture | refused (over 128 MB), with how to make a smaller copy | a BMP is refused as binary (its Read shows PNG, JPEG, GIF and WebP) |
| The owner's picture | saved to `.coder-pictures`, opened again from there, shown under its step | (saved since 2.1.275; not tried here) |
| PDFs: 25 pages with no range, 1-25, 21-25, a fake one | the same rules, the same meaning | the same |
| A password-protected PDF | "is password protected; it cannot be read without its password" | "PDF file read: … (828 bytes)", nothing shown. **Coder better.** |
| A PDF that says 3 pages but has 12 | "has 12 pages (the file says 3, but it has 12)"; pages 10-12 shown | "PDF has 3 pages"; pages 10-12 refused. **Coder better.** |
| A notebook with a chart | cells, output, the chart | the same |
| "@cart" in the box | src/cart.js, docs/cart-guide.md, src/discart.js, cart/index.js | (2.1.280's rule; not typed here) |
| @ a folder, a file over 256 KB, a picture | the listing; named, not included; the picture | (as in its docs) |
| `cat notes.txt`, then `sed` changes it | "exit code 0", "(no output)": **no note** | "[This command modified 1 file you've previously read: notes.txt. Call Read before editing.]", then a second note with the new lines: "Note: /home/user/cc-test2/notes.txt changed on disk since you last read it. … Here are the relevant changes (shown with line numbers): 1 apple 2 kiwi 3 cherry". **Different.** |
| A job summarized in the middle | "Compacted: the earlier steps of this job are now a summary for Coder …"; CODER.md read again whole, part3, part2 and part1 named (over 20,000 characters); the new CODER.md line followed ("PINEAPPLE") | not run here (it needs a session filled to its limit); its docs say the same |
| How lines are counted; "up to 2000 lines" | 1561; no line limit | 1562 (the end counts); its tool description's "Reads up to 2000 lines by default" was not applied (3,000 lines came back) |

- **Differences found, all four fixed on the owner's word** ("Yea fix those 4"; tests CD238, CD239, CD240, CD213, CD220, CD226 and CD193, each failing on the old code; 249 pass, and the 24 real read checks):
  1. **A command that shows one file counts as reading it for the changed note too** (Claude Code: yes). Coder counts it for folder instructions and for what is read again after a summary, but takes no fingerprint of the file, so a later change goes unseen.
  2. **No cutting of long lines** (Claude Code: none, up to what one read takes). Coder cuts every line at 2,000 characters, so the rest of a long line (minified code, a long paragraph) is never seen.
  3. **A second note with the changed lines**, as Claude Code sent right after the command. Coder's first version of the changed note showed them; it was taken out after the owner's two tests (a command in the background, a change between messages), where Claude Code sent nothing. For a command's own changes, it does send them.
  4. **Big pictures shown at 2000 px** with Claude Code's line about mapping coordinates (now 1600 px and a crop hint). Costs a bit more Grok per picture.
  - **How:** (1) a one-file view command now takes the file's fingerprint too (`seen`, a tool only Coder's app uses), so the next command that changes it gets "[This command changed 1 file you read before: notes.txt. Read it again before editing.]". (2) `rowOf` gives each line whole; a line over one read by itself stops a whole read before it ("Read more with offset 2 and limit 1"), and a read starting at it fails with "line 2 of huge.txt is 146 KB by itself, more than one read takes (about 100,000 characters): set allow_large to read it whole, or show a part of it with bash, e.g. sed -n 2p 'huge.txt' | cut -c1-50000". (3) Next to each followed file, each line's own 8-character fingerprint (never its text); after a command changes the file, Grok gets, after that round's results, "Note: notes.txt changed on disk since you last read it. That's usually deliberate, so take it as the current state rather than reverting it; if the change looks wrong, say so rather than undoing it yourself, otherwise no need to call it out. Here are the relevant changes (shown with line numbers):" and the lines, 8 either side of the change, or "The changes are not shown here; read it again if you need the current content." past 8,000 characters. The chat doesn't show it (Claude Code's is a system note). (4) `PIC_SIDES` starts at 2000, and the note says "made smaller (2000×1333; multiply coordinates by 3.00 to map them to the real picture)", keeping the crop hint.
  - **Live, in the browser** (deploy 66; recording 12, seven messages in the last test chat on canias7/testingforclaude, since the account was at Coder's limit of 50 chats; then 40 old test chats removed on the owner's word, "you can delete old chats bro"):
    1. Long lines: a 5,000-character line and a 20,000-character line came back whole (last words w1018 and w3518, the same as Claude Code's); a 150,000-character line: "[PARTIAL view: lines 1-1 of 3 (about 1 KB of 146 KB). Read more with offset 2 and limit 1. …]", then "error: line 2 of hugeline.txt is 146 KB by itself, more than one read takes (about 100,000 characters): set allow_large to read it whole, or show a part of it with bash, e.g. sed -n 2p 'hugeline.txt' | cut -c1-50000".
    2. `cat notes.txt`, then `sed`: "[This command changed 1 file you read before: notes.txt. Read it again before editing.]", and Grok quoted the second note word for word: "Note: notes.txt changed on disk since you last read it. … Here are the relevant changes (shown with line numbers):" then 1 apple, 2 kiwi, 3 cherry (Claude Code's: the same lines).
    3. big.png: "made smaller (2000×1333; multiply coordinates by 3.00 to map them to the real picture)" (Claude Code: "displayed at 2000x1333. Multiply coordinates by 3.00"); GIF, BMP and TIFF all seen (Claude Code reads the GIF, and refuses BMP and TIFF as binary).
    4. and 5. `/tmp`: a file made in one message was still there in the next ("kept from message 4").
    6. A link in the scratch folder to /etc/hostname: "error: that path leads outside the project" (Claude Code read it: this session may read outside its project; different on purpose).
    7. @line20k.txt: the 20,000-character line came in the message whole ("Line 2 is 20000 characters long, and its last word is w3518").
- **Found while checking write, read itself** (2026-11-08): Claude Code's Read says when a file is not valid UTF-8, after its lines: "[This file is not valid UTF-8: it uses a legacy encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. Its undecodable bytes show above as U+FFFD. Edit and Write will refuse it: change it with a shell command that keeps its encoding, or ask the user whether to convert it to UTF-8.]". Coder's read showed the � with no word of why, and its write then saved the � over the real letters. **Added** (the owner: "Yea fix that"): the same note (`NOT_UTF8_NOTE`), after the lines and after a PARTIAL view's note, never for UTF-8 or UTF-16 files. It says what Coder's edit and write would do today (save the �, so don't use them on it); whether they refuse such a file, as Claude Code's do, is for tools 2 and 3. Test CD241 (fails on the old code); 250 pass.
- **A missing file** (checked side by side, 2026-11-08): Claude Code's Read says "File does not exist. Note: your current working directory is /home/user/cc-test4."; Coder's said only "error: no such file: missing.txt". **Fixed** (the owner: "Ok do those fixes too"): "error: no such file: missing.txt. Note: your current working directory is /data/work/…." (`missingFile`), the folder a short path counts from, so a path given from the wrong folder is seen as such. The @ check still leaves a path that is not a file alone (a package name like @types/node). Test CD242 and CD235's checks (fail on the old code); 251 pass.
- **Both live** (the owner: "merge and deploy and test whats missing on the read tool"; deploy 67; recording 13, a new chat on canias7/testingforclaude): `printf 'caf\xe9 au lait\n' > old.txt`, then read: "1 caf� au lait" and the note, "[This file is not valid UTF-8: it uses an old encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. …]"; and missing.txt: "error: no such file: missing.txt. Note: your current working directory is /data/work/testingforclaude-o29kv4r4." **A file in a chat's second repository, live too** (recording 14; the owner switched Coder's GitHub app to all repositories): a new chat on canias7/testingforclaude with canias7/isibi-app added before the first message ("+ Repository"); asked for that repository's README.md, Coder tried /data/work/testingforclaude-2gj1uycr-x1/README.md ("no such file": isibi-app has none at its top), searched that repository with glob and read /data/work/testingforclaude-2gj1uycr-x1/coder/README.md, first line "# Coder" (right). Claude Code reads another repository's files by full path the same way.
- **Also checked side by side, the same in both:** a file name with spaces and accents, an SVG (read as text), and a link that stays inside the project (followed). **For tool 3 (edit):** a file with Windows line endings: Coder's read shows the hidden carriage return at each line's end, Claude Code's looks clean; it has to change together with edit, or Coder's edits of such files would stop matching. **Not comparable here:** a file with no read permission (this Claude Code session runs as the machine's admin); Coder says "EACCES: permission denied".
- **Small, seen in the recording, fixed on the owner's word** ("Do this pls"; tests CD246 and CD247, each failing on the old code; 256 pass): the step for the null-byte path read "Read notes.txt" (the null can't be seen): a step's name now writes such characters out (`visibleChars`: "Read notes\\0.txt"; a line break "\\n", others "\\x01"). A notebook's chart and a PDF's pages were not shown under their step, as a picture file is: now the first four (`STEP_THUMBS`) are, small, as the chat shows a picture's; Grok still gets every page whole.
- **Outside read (for tool 5, bash), fixed on the owner's word** ("Fix that too"): Coder's commands got an empty `/tmp` with each message (each job's sandbox mounted a fresh one), so a file made there was gone by the next message; Claude Code keeps `/tmp` for the session. The 137 MB picture was made and read in one message for that reason. Now `/tmp` is the sandbox's own layer's, on the chat's kept disk, kept from one message to the next (and while the machine sleeps); a new Coder version starts it fresh, with the rest of that layer. CD147 tries it in a real sandbox (a file in `/tmp` is there in the next job's sandbox, gone with a new version; `/tmp` is not a tmpfs, mode 1777); CD148 checks the start script. Both fail on the old one.

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
- **Claude Code's side, run in this session** (the owner: "u can do it here, u are claude code"; the same files, in /home/user/cc-test):
  1. mid.txt whole: lines 1-218, then "[Truncated: PARTIAL view — /home/user/cc-test/mid.txt: showing lines 1-218 of 2001 total (195008 tokens, cap 25000). Call Read with offset=219 limit=218 for the next page, or Grep to find a specific section. Even with allow_large, this is more than fits in the context you have left this turn (other large reads in the same turn share that room). Do NOT answer from this page alone if the answer may be further in the file.]". Its cap is 25,000 tokens, and this file is about one token a character (the runs of y), so 218 lines; Coder's cap is 100,000 characters (about 25,000 tokens of ordinary text), so 926 lines. It counts 2001 lines (the end after the last line break counts as a line; `wc -l` says 2000, as Coder does).
  2. empty.txt: "Warning: the file exists but the contents are empty."; from line 5000: "Warning: the file exists but is shorter than the provided offset (5000). The file has 2001 lines."; the folder `.` (after the `cd` into cc-test): "EISDIR: illegal operation on a directory, read '/home/user/cc-test'".
  3. sed: the whole result was "[This command modified 1 file you've previously read: notes.txt. Call Read before editing.]" (Coder: "exit code 0", "(no output)", then "[This command changed 1 file you read before: notes.txt. Read it again before editing.]").
  - Messages 2, 4 and 5, typed by the owner in this session (the owner: "lets do . 2,4,5"):
    - Message 2, @/home/user/cc-test/notes.txt: the file came before the owner's words, as a Read call ("Called the Read tool with the following input: {"file_path":"/home/user/cc-test/notes.txt"}") with its numbered lines (1 apple, 2 mango, 3 cherry, and an empty 4). Answered with no tools: line 2 is mango, and it came inside the message. (Coder: the same, but after the owner's words, as a note from Coder's app, by the short path.)
    - Message 4, /compact: "Compacted" is all that reached the model.
    - Message 5, right after the summary, with no tools: notes.txt and empty.txt read again, as Read calls by full path (empty.txt with "Warning: the file exists but the contents are empty."); docs/tool-by-tool.md, docs/owner-notes.md and coder/container/coder-tools.mjs only named ("… was read before the last conversation was summarized, but the contents are too large to include. Use Read tool if you need to access it."); mid.txt not named at all. notes.txt: apple, mango, cherry.
  - **Why mid.txt was left out** (the owner: "ok go look at the docs pls"). The docs (context window, "What survives compaction"): "Right after compaction, Claude Code re-reads up to five of the files Claude has read or edited in the session, choosing the ones modified most recently. A file over 5,000 tokens comes back as a path reference without its content, shown as `Referenced file` instead of `Read`." By when each was last changed: tool-by-tool.md 10:34:09, owner-notes.md 10:34:04, coder-tools.mjs 10:33:11, notes.txt 10:28:02, empty.txt 10:27:40.884, then mid.txt 10:27:40.880, the sixth, 4 thousandths of a second older than empty.txt. Two test files a Python command changed at 10:32:56 were not counted: changed by a command, not read or edited. Coder's rule is the same (`rereadFiles` in `coder-agent.mjs`: up to five, `REREAD_FILES`; the most recently changed first; over 20,000 characters, about 5,000 tokens, only named, as a "Referenced file"; a command that only shows one file counts as reading it, as Claude Code's tools reference says). Coder's chat had read only the three test files, so all three came back and mid.txt was only named. **Nothing to change.**
  - **Outside read, noted for later:** CLAUDE.md came back whole after the summary (the docs: "Project-root CLAUDE.md and unscoped rules: Re-injected from disk"; Coder sends its instruction files with every round, so they stay); the words /compact shows ("Compacted"; Coder's line is longer).
  - **Against the docs** (the owner: "look up in the docs"): "By default one call returns at most 25,000 tokens … and refuses a whole file over 256 KB" (Coder: 100,000 characters, as it cannot count Grok's tokens first; the same 256 KB); "the first page of the file, with a `PARTIAL view` notice saying how much of the file it received and how to read more with `offset` and `limit`" (Coder's says that); Grep is named for the errors over 256 KB or a part over the limit (Coder's say "search it with grep"); "Reading an empty file returns a notice that the file exists but its contents are empty, and an `offset` past the last line returns a notice giving the file's line count" (Coder's do). How lines are counted, the "Warning:" wording and the extra sentences of the real note are not in the docs.
  - **Added** (the owner: "ok yes"): the PARTIAL note ends with "Do not answer from this part alone if the answer may be further in the file." (`PARTIAL_HINT`), as Claude Code's real note does ("Do NOT answer from this page alone if the answer may be further in the file"). CD204 checks it.
- **Outside read, seen in the recording (2:07), done on the owner's word** ("do it like this"): the line over a group of steps said "5 steps" and "a command failed" when the failed step was a read. Claude Code's docs and changelog name each kind in a collapsed group ("Ran 3 shell commands", "Read N files", "Searched for", "Listed N directories"; "a call that did not run" must not read as if it ran) but never show a failure's words. Now the line names each kind in the order they came ("Ran 1 command, read 4 files"; `groupWords` in `public/coder.js`) and what failed by its kind ("a read failed", "2 edits failed", "2 steps failed" for mixed kinds). Test CD236.

---

## 2. write (Claude Code: Write)

**Claude Code's docs** (tools reference, "Write tool behavior"; errors):
- "creates a new file or overwrites an existing one with the full content provided. It doesn't append or merge."
- Reading first: older models always; "Newer models can overwrite a file they never read this session"; but "Jupyter notebooks, and files Claude has read only partially with a `PARTIAL view` notice, require the read on every model." Not for new files. "Viewing the file with Bash also satisfies this requirement."
- Files that are not valid UTF-8: the docs say Write may replace one "unless the new content contains U+FFFD".
- Links: "Refusing to write <path>: it is a symbolic link. Write to the link's target path instead".

**Tried side by side, for real** (the owner: "Compare it to claude code write ones and make sure they need fixing pls"; Claude Code 2.1.319's own Write, run by a helper in this session; Coder's write tool run as its machine runs it, on the same files):

| Case | Claude Code | Coder before |
|---|---|---|
| A new file | written: "File created successfully at: /home/user/cc-test3/newfile.txt" | written |
| A plain file not read | written: "The file /home/user/cc-test3/plain.txt has been updated successfully." | written |
| A file read only partly (a PARTIAL view) | refused: "File has not been read yet. Read it first before writing to it." | **written: the 389 lines it never saw were lost** |
| A notebook not read | refused, the same words | **written** |
| A file in an old encoding (Windows-1252) | refused, even with the right text: "File is not valid UTF-8: … These tools write UTF-8 (or UTF-16LE behind its byte-order mark) and never convert a file's encoding on their own, so nothing was written. … To replace the whole file with new UTF-8 text anyway, delete it first, then Write it." (stricter than its docs) | **written: "�" saved over the real "é"** |
| A UTF-16 file | kept UTF-16 (its byte-order mark, two bytes a letter) | **made UTF-8** |
| A path that is a link | refused: "Refusing to write /home/user/cc-test3/link.txt: it is a symbolic link. Write to the link's target path instead: /home/user/cc-test3/target.txt." | **written through: target.txt changed** |
| A file inside a linked folder | written | written |

**Fixed** (the owner: "just use the same GitHub account … " then on with write; tests CD243, CD244 and CD245, each failing on the old code; 254 pass, and the 24 real read checks):
- A file read only partly, or a notebook not read in this chat: "error: big.txt has not been read yet. Read it first before writing to it: you read only part of it (a PARTIAL view), and replacing it would lose the rest. Read the rest of it first." (`WRITE_NOT_READ`). Read marks a PARTIAL view in the chat's record of files (`markPartial`); any later read, a write or an edit clears it. A notebook's read now counts as reading it (it did not before: the test found that).
- Not valid UTF-8: refused, nothing written, with Claude Code's ways out (a command that keeps the encoding, asking the owner, or deleting the file first).
- UTF-16 (either byte order): kept, with its byte-order mark.
- A path that is a link: "error: Refusing to write link.txt: it is a symbolic link. Write to the link's target path instead: target.txt."
- Read's note on old encodings now says "Write refuses it, and edit would save the � …" (edit is tool 3).
- **Not changed, offered:** the words after a write ("wrote a.txt (2 lines)"; Claude Code: "File created successfully at: …" / "The file … has been updated successfully.").
- **Kept, on purpose:** at most about 90,000 characters a call (how much Grok sends in one answer); the docs give no limit.

**Second pass, the whole tool** (the owner: "first of all, we gotta go look on Claude Code's write tool and see what it does and see what ours does … after we copy or use what they do, then we can actually start testing it"). The cases the first pass didn't cover, each tried with Claude Code 2.1.319's own Write (in /home/user/cc-test5; the part-read cases by a helper, with its own read record), then with Coder's:

| Case | Claude Code | Coder before |
|---|---|---|
| Read, then changed by a command | refused: "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it." | **written over the change** |
| Read, then changed in the background (20 seconds later) | refused, the same words | **written** |
| Written by it, then changed by a command | refused, the same words | **written** |
| The same, once the "changed on disk" note had shown the change | written | written |
| Read again after the change | written | written |
| Only its time changed (`touch -m`), the same bytes | written | written |
| Read only partly, then `cat` of it (141 KB, its output cut) | refused: "File has not been read yet. Read it first before writing to it." | **written: `cat` counted as reading it all** |
| Read only partly, then `head -5` of it | refused, the same words | **written** |
| New file in folders that don't exist | "File created successfully at: /home/user/cc-test5/new/sub/x.txt (file state is current in your context — no need to Read it back)" | written, "wrote new/sub/x.txt (2 lines)" (one line) |
| An existing file | "The file /home/user/cc-test5/run.sh has been updated successfully. (file state is current in your context — no need to Read it back)" | "wrote run.sh (3 lines)" |
| Empty content | the file emptied; "… has been updated successfully. …" | emptied; "(1 lines)" |
| A UTF-8 file with a byte-order mark | kept: `357 273 277 n e w \n` | **dropped** |
| A folder | "/home/user/cc-test5/afolder is a directory, not a file. To create a file inside it, include the file name in file_path." | "EISDIR: illegal operation on a directory, open '…'" |
| A script's mode (755) | kept | kept |
| A CRLF file, given LF | written as given (`x \n y \n`) | written as given |

**Copied** (tests CD249, CD250 and CD251, each failing on the old code; 260 pass, and the 24 real read checks):
- Changed since read: "error: a.txt has been modified since read, either by a command or by something running in the background. Read it again before attempting to write it." (`WRITE_CHANGED`; Claude Code's "by the user or by a linter" told as what can change a file on Coder's machine). A file's record (its time, size and fingerprint) is compared; only its time changing is no change. Reading it again, or the note after that round that shows Grok the change, clears it; a file a command changed is marked as changed and not yet seen (`stale`) until then, so a write in the same answer as the command is refused, as Claude Code refuses it (found live, deploy 70, message 4; CD260).
- A part-read file stays part-read after a command shows it (`toolSeen` keeps the mark).
- A UTF-8 byte-order mark is kept, never doubled.
- A folder: "error: /…/afolder is a directory, not a file. To create a file inside it, include the file name in path."
- The words: "File created successfully at: x.txt" / "The file x.txt has been updated successfully.", each with " (file state is current in your context — no need to Read it back)" (`WRITE_FRESH`). No count, so no wrong count.
- What Grok is told: "Write a whole file: a new one, or one you have read, replaced in full (it is not appended to or merged). For a change to part of a file, use edit instead. …" (Claude Code's: "creating a new file, or fully replacing one you've already Read … For partial changes, use Edit instead."; its "Overwriting an existing file you haven't Read will fail" is not so for either, so not copied).
- **Kept, on purpose:** paths named from the project (Claude Code names full paths; Coder's tools all take and name project paths), and the 90,000 characters a call.
- **For edit (tool 3):** Claude Code's Edit has the same "modified since read" check and the same "(file state is current …)" words.

**Docs pass** (the owner, 2026-11-09: "look on Claude Code Docs and go look for the right writing tool and compare to ours"). Every docs page fetched fresh (228 pages; the Write pages unchanged since 2026-11-08), each line about Write checked against Coder, and the changelog's Write entries (all in 2.1.319, the version here). Where the docs and the real tool disagree, both were tried:

| Docs (page) | Coder before | Now |
|---|---|---|
| "creates a new file or overwrites an existing one with the full content provided. It doesn't append or merge." (tools reference) | same | same |
| Newer models may overwrite a file not read; notebooks and PARTIAL-view files need the read; not for new files (tools reference) | same | same |
| "Viewing the file with Bash also satisfies this requirement under the same rules described in Edit tool behavior": `cat`, `nl`, `bat`, `batcat`, `head`, `tail`, `sed -n 'X,Yp'`, `grep`, `egrep`, `fgrep`, `rg`, one file, no pipes or redirects; nothing printed doesn't count (tools reference) | the same list, and a failed command doesn't count | same (a part-read file stays part-read after one, as the real tool showed) |
| "For partial changes to an existing file, Claude uses Edit instead of Write." | not said to Grok | said (second pass) |
| Non-UTF-8: the tools reference says Write "can still replace such a file … unless the new content contains U+FFFD"; the changelog (2.1.299) says Write "silently converting Windows-1252, Shift-JIS, GBK or UTF-16BE files to UTF-8 (now refused)", and the real Write refused | refused (first pass, from the real tool) | kept: the changelog and the real tool agree; the reference page is behind |
| A subfolder CLAUDE.md or rules file over its limit is shown only in part ("40,000 characters" with a 200K context, 150,000 with 1M; memory) and, since 2.1.312, "Write now asks Claude to read it all or edit in place" (changelog). Tried for real: a 210,000-character subfolder CLAUDE.md shown up to line 1642 ("> Only the start of this file is shown. For the rest, call Read … with offset=1643 and a limit."), then Write refused: "You were given only the start of this file, and nothing shows that you have since read all of it in one call, so a Write could lose the rest. To change part of it, use Edit. To replace it whole, first Read it in one call with no offset or limit. If Read returns only a page or says the file is too large, Read it again with allow_large: true. If even that cannot return all of it, use Edit."; its Edit went through | **written over: Coder's app shows such a file in part too ("[sub/AGENTS.md goes on past 40,000 characters: read the rest of it with the read tool, from line N]"), and write didn't know** | refused in those words, until read all at once (a part read or a command that shows it doesn't count); an edit goes through (CD252) |
| A null byte: "the message names the tool and the argument: `Read file_path cannot contain null bytes (\0). Remove the null byte and try again.`" (errors) | "the path cannot contain null bytes …" | write: "write path cannot contain null bytes (\0). Remove the null byte and try again." (CD212, CD253). **Outside write:** read, edit, grep and glob still say "the path …"; on the owner's word |
| A link at the path itself: "it is a symbolic link. Write to the link's target path instead" (errors, permissions, memory) | same (first pass) | same |
| Links in a loop, or leading nowhere: "where it leads on disk could not be determined (a link on the way could not be examined, or the links do not resolve)" (errors). The real Write gave "ELOOP: too many symbolic links encountered, stat '…/loopa/x.txt'" for a loop and "Refusing to write …/dangling/x.txt: its parent-directory symlink resolution changed after permission was checked." for a link to nowhere | the raw ELOOP or ENOENT of making the folder (nothing written, and nothing made outside, but only because making it failed) | refused in the docs' words, checked before any folder is made (CD253) |
| An existing folder: "a clear error" (changelog 2.1.277) | raw EISDIR | Claude Code's words (second pass) |
| Folder instructions load when Write creates or changes a file in their scope (changelog 2.1.288; memory) | same (`FILE_HOOK_TOOLS`) | same |
| Stray parameters ignored (changelog 2.1.292); an unreadable file to overwrite is an error, not the end of the turn (2.1.319); the system umask, not 0o600 (changelog); line endings as given (changelog) | same | same |
| **Not for Coder** (no such part in Coder): permission rules (`Read` deny rules blocking Write, `Edit(path)` rules, `blockWritesOutsideWorkingDirectories`: Coder's write never leaves the project and its scratch folder), PreToolUse/PostToolUse hooks, the IDE diff, Perforce mode, background-session isolation, network-path and permission-race refusals | | |

Tests CD252 and CD253, and CD212 for write's null-byte words (each fails on the old code); 262 pass, and the 24 real read checks.

**What Claude Code's Write has that Coder's didn't** (the owner, 2026-11-09: "not only compare what we have, but also like what we don't have", then "for the write tool only rn" and "Go ahead and do those"). A helper read every docs page and the changelog for features attached to Write by name (32 found; each quote checked word for word), and each was checked in Coder:

| Claude Code's Write | Coder before | Now |
|---|---|---|
| Shows the user what it wrote: a new file's lines ("Fixed tab-indented code rendering … in the Write (create-file) preview"), a replaced file's diff ("Improved Write tool diff computation speed for large files"), the line counts, folded with "+N lines" to open ("Fixed Write tool output collapsing instead of expanding when clicking "+N lines"") | "Wrote a.txt" only; the diff only in See changes | under each write: the counts on its line (+17, or +5 −2), the first 8 lines numbered (a new file's as they are; a change's with what it added in green and took out in red), "Show N more lines" / "Show less"; up to 120 lines and 8,000 characters kept in the chat (See changes has all); none past 2 MB a side (Claude Code: about 10 MB). From the machine's own `diff -U3`; key-shaped text hidden; never told to Grok (Claude Code's model gets only its short result) (CD254, CD256) |
| Takes `path`, `file_text`, `file_content` for its `file_path` and `content` (changelog 2.1.292 and after) | `file_path` already taken by Coder's app (all file tools); `file_text` and `file_content` failed: "give the file's content" | taken, by the tool and by Coder's app (CD255) |
| After a write to MEMORY.md, its size against the 200-line and 25KB read limits; over: "Error: this write left the memory index at MEMORY.md at 214 lines, over its 200-line read limit. The write succeeded, but …"; near: a reminder (memory, errors) | nothing | measured against what Coder loads of it (25,000 bytes, `MEMORY_MAX`): over, that error in Coder's terms; near (80%), a note; over 200 lines, a note (Coder doesn't cut at 200 lines; Claude Code does: outside write, the owner's call) (CD255) |
| Its per-write security check reads `.claude/security-patterns.yaml`, `.yml` and `.json` (security-guidance) | only `.coder/security-patterns.*` | both (CD255) |
| (found) Grok told write takes "about 90,000 characters per call" in its description, but "up to about 1 MB at once" in its instructions | — | 90,000 in both (CD255) |
| Streams a long write while the model writes it (`CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING`) | the step shows only once Grok has finished | **can't be done with Grok** (the owner: "Yeah, I want it"; xAI's function-calling docs: "With streaming, the function call is returned in whole in a single chunk, not streamed across chunks"): a write's text reaches Coder all at once |
| Errors fed back after a write by a language server plugin ("each time Claude edits or writes a file the server handles, Claude gets the errors and warnings the server reports"; the conversation shows "Found N new diagnostic issues in M files"); not in Claude Code's own cloud sessions | the `lsp` tool, when Grok asks | **done** (the owner: "Yeah, I want it"): after each write of a JavaScript, TypeScript or Python file, one language server (typescript-language-server, pyright-langserver) reads it as it was and as it is; the new errors and warnings (matched without lines) go to Grok as "<new-diagnostics>The following new diagnostic issues were detected: … ✘ [Line 5:25] \"rate\" is not defined [reportUndefinedVariable] (Pyright)" and to the chat as "Found 1 new diagnostic issue in 1 file", the list a tap away; none past 20 seconds, or with no server (`newProblems`, `problemsNote`; CD259) |
| Already the same | a security check on each write; writes one at a time, a failed one not stopping the rest; line endings as given (tried for real: the changelog's "Fixed Write tool silently converting line endings" means no conversion); the umask; Grok told to use write and edit, not shell commands | |
| Not Write itself (on the separate list) | approval prompts and permission modes (Claude Code's cloud sessions pre-approve edits), the IDE diff and editing a proposal, plan mode and the plan file, hooks, checkpoints, the status line and metrics, NotebookEdit, worktrees, memories saved with Write ("Saved N memories"), Perforce mode, synced skills, clickable paths | |

**Last docs pass** (the owner, 2026-11-09: "Before the live browser keep checking the write tool in claude code docs pls we may be missing stuff"). Every changelog entry naming Write (44, all in 2.1.319 or before), every Write error in the error reference, and every other page naming the tool were gone through; where the docs don't give the exact words, Claude Code's own Write was tried (in /home/user/cc-test5):

| Claude Code | Coder before | Now |
|---|---|---|
| Other input names, tried for real: `path` alone → written, "Note: Write's parameters are named `file_path` and `content`. `path` was read as `file_path`."; `file_text` → "`file_text` was read as `content`."; a stray `description` → "`description` was ignored."; several → "… `path` was read as `file_path`. `file_content` was read as `content`. `description` was ignored."; the same path twice → "`path` repeated `file_path` and was ignored." (changelog 2.1.281); two different paths, or contents → refused, nothing written: "InputValidationError: Write failed due to the following issue: An unexpected parameter `path` was provided" | taken silently; two different paths: one picked silently | the same notes and refusal, with Coder's names (`path`, `content`); Coder's app now hands write Grok's own inputs so the tool can say which it read another way (CD257) |
| A file outside the working directory named in full in Write's result, not `../../…` (2.1.304) | a file in the chat's other repository named from that repository ("README.md"), as if it were the project's own | named in full (CD257) |
| Tab-indented code at its right width in the Write preview (2.1.181) | the browser's 8 | 4 (CD257) |
| (Coder's own) the owner's values are hidden in each saved step's text, output and command | the new preview lines were not | hidden there too, when the chat is saved (`hideIn`, CD257) |
| **Protected paths** (permission-modes): writes to `.git`, `.config/git`, `.vscode`, `.idea`, `.husky`, `.cargo`, `.devcontainer`, `.yarn`, `.mvn`, `.claude` (most of it), and files such as `.gitconfig`, `.gitmodules`, `.bashrc`/`.zshrc`/`.profile`/`.envrc`, `.npmrc`, `.yarnrc(.yml)`, `.pnp.cjs`, `bunfig.toml`, `.bazelrc`, `.pre-commit-config.yaml`, `lefthook.yml`, `gradle-wrapper.properties`, `maven-wrapper.properties`, `.devcontainer.json`, `.mcp.json` are "never auto-approved": prompted in default and accept-edits mode (a cloud session's modes too), the classifier in auto mode, denied in dontAsk, allowed only in bypass | `.git` refused; the rest written with no question (the security check warns only on `.github/workflows`) | **asked first** (the owner: "Okay, yes, yes, do that"): the job stops at a card, "Allow Coder to change .husky/pre-commit?" with what it would write, Allow / Don't allow, as Claude Code prompts; Allow is the owner's next message ("I allowed Coder to change .husky/pre-commit.", exactly; notes from the app and longer messages don't count), and lets that file through for the rest of the chat; from GitHub, not written (`PROTECTED_DIRS`, `PROTECTED_FILES`, `protectedFile`; Coder's own `.coder` beside `.claude`; compared without case) (CD258) |
| Disk full (errors: "Disk full: …", "The command was not started: this computer's disk is full (ENOSPC) …") | — | about commands' output (bash, tool 4), not write: for later |
| Everything else naming Write: the IDE (VS Code, JetBrains), Windows, network drives, permission rules, hooks, mods, background sessions, artifacts, Perforce, the synced-skills folder | | not in Coder |

Tests: CD257 (fails on the old code) and CD255's answer with its note; 266 pass, and the 24 real read checks.

**Live in the browser** (deploy 69, recording 16; five messages to Coder on gofarther.dev, canias7/testingforclaude):
- A file read only partly: "error: part.txt has not been read yet. Read it first before writing to it: you read only part of it (a PARTIAL view), and replacing it would lose the rest. Read the rest of it first." A notebook not read: "error: nb.ipynb has not been read yet. Read it first before writing to it: a notebook is read before it is replaced, so no cell or output is lost." Once read: "wrote nb.ipynb (1 lines)".
- An old encoding: refused, nothing written (`od -c old.txt`: `c a f 351 …`, still Latin-1). UTF-16: "wrote u16.txt (2 lines)", and `od -c` shows `377 376 n \0 e \0 …` (its byte-order mark, two bytes a letter). A link: "error: Refusing to write link.txt: it is a symbolic link. Write to the link's target path instead: target.txt." (target.txt still "target original"). A linked folder and a plain file not read: written.
- **Found:** the count after a write takes the line break at the end for one more line ("(2 lines)" for one line; "(1 lines)"). With the wording, the owner's call.

**Live in the browser, everything** (deploy 70, recording 17; the owner, 2026-11-09: "merge deploy and then put everything live and test everything with a browser and check for mistakes and everything. Every single thing on the write tool"). Thirteen messages to Coder on gofarther.dev with Grok 4.7: twelve in one chat on canias7/testingforclaude, one in a chat with two repositories; then the docs page as a signed-out visitor. Each answer kept as text and as a picture:

| # | What | Write said, live | |
|---|---|---|---|
| 1 | A file read only partly; then `cat`; a notebook not read | "error: part.txt has not been read yet. Read it first before writing to it: you read only part of it (a PARTIAL view), …"; after `cat` (cut) the same; "error: nb.ipynb has not been read yet. … a notebook is read before it is replaced, so no cell or output is lost." | as Claude Code |
| 2 | An old encoding, UTF-16, a byte-order mark, a link, a linked folder, a link loop, a link to nowhere, a folder, a new file, a file not read | "error: old.txt is not valid UTF-8: …, so nothing was written." (`od -c`: still `c a f 351`); "The file u16.txt has been updated successfully. (file state is current in your context — no need to Read it back)" (`od -c`: `377 376 n \0 e \0 …`); bom.txt kept its mark (`357 273 277 n e w`); "error: Refusing to write link.txt: it is a symbolic link. Write to the link's target path instead: target.txt."; "File created successfully at: linkdir/new.txt …"; loopa/x.txt and nowhere/x.txt: "error: Refusing to write …: where it leads on disk could not be determined …"; "File created successfully at: brand-new.txt …"; "The file plain.txt has been updated successfully. …" | as Claude Code; **found:** the folder named with the machine's full path ("error: /data/work/testingforclaude-kd8cssav/afolder is a directory, not a file. …") where every other message names the file as Grok gave it: now "afolder is a directory, …" (CD251) |
| 3 | A real null character in the path | "error: write path cannot contain null bytes (\0). Remove the null byte and try again." | as Claude Code |
| 4 | Read; then a command and a write in one answer; read again; only the time changed | the write in the same answer as `echo added by a command >> mod.txt`: "The file mod.txt has been updated successfully." (over the added line); after reading again: updated; after `touch -m`: updated | **found:** Claude Code refuses the write in the same answer as the command ("File has been modified since read …"): Coder's record was brought up to date right after the command, so the write saw nothing new. **Fixed:** a file a command changed is marked changed and not yet seen (`stale`) until Grok reads it or the round's note shows it the change; a write before then: "error: mod.txt has been modified since read, either by a command or by something running in the background. Read it again before attempting to write it." (CD260; needs a deploy, then this message again) |
| 5 | Claude Code's other input names | Grok used only `path` and `content`, its schema's names ("The write tool's call schema only has path and content"); the other names can't be tried through Grok | tested in CD255/CD257 |
| 6 | An instruction file shown only in part (sub/AGENTS.md, 700 lines) | refused: "error: sub/AGENTS.md: You were given only the start of this file, …"; after reading it whole with `allow_large`: "The file sub/AGENTS.md has been updated successfully. …" | as Claude Code |
| 7 | A protected file, Allow (.husky/pre-commit) | the card, "Allow Coder to change .husky/pre-commit?" with its two lines; Allow sent "I allowed Coder to change .husky/pre-commit."; written (Grok then made it runnable with `chmod +x`) | as Claude Code's prompt |
| 8 | A protected file, Don't allow (.npmrc) | the card; Don't allow sent "Don't change .npmrc."; not written, not tried again | as Claude Code's prompt |
| 9 | `.claude/security-patterns.json` (protected too) | the card; Allow; written | |
| 10 | The security check reads it | "SECURITY CHECK of this edit to config.txt (…): - repo:internal_key: Never commit internal keys." | |
| 11 | Each write's change; the mistake-check | calc.py: "Found 1 new diagnostic issue in 1 file", "✘ [Line 4:25] \"rate\" is not defined [reportUndefinedVariable] (Pyright)", fixed by Grok with a second write (the change shown: `- return price * (1 + rate)` / `+ return price * (1 + RATE)`); app.ts: "✘ [Line 1:7] Type 'string' is not assignable to type 'number'. [2322] (typescript)"; long.txt: 8 lines and "Show 22 more lines"; plain.txt: `-replaced`, `+one +two +three`; tab.py at its tab width | |
| 12 | The memory file over 200 lines | "Note: the memory file is now 205 lines, over the 200 it is kept under. Shorten it now: …"; put back (`wc -l`: 2) | |
| 13 | A file in the chat's other repository | "File created successfully at: /data/work/testingforclaude-kh4medd3-x1/coder-write-test.txt …", named in full on the step too; removed after, `git status --short` empty | as Claude Code 2.1.304 |
| docs | The landing page and /docs, signed out | "Docs" beside Sign in; /docs: "Coder docs", read only; on a phone, 375 px wide (no sideways scroll); /docs.html: 307 to /docs; Open Coder: back to the landing page | |

Outside write (on the separate list; the owner: "Yes fix that"; done, CD261): the page numbered a list Grok writes with a blank line between its items "1. 1. 1." (each item drawn as its own list, from 1): now one list, from its first item's own number, as Markdown (CommonMark) has it; the line over a group of steps counted steps, not files ("Wrote 6 files" for five, calc.py twice): now each file once for each kind, as Claude Code's group line counts its `readFilePaths` (a set; seen in Claude Code 2.1.319's own program: `readCount: readFilePaths.size > 0 ? readFilePaths.size : readOperationCount`).

**Retested live after deploy 71** (recording 18; the test chat on canias7/testingforclaude, one message with Grok): a command and a write over the same file in one answer: "error: mod.txt has been modified since read, either by a command or by something running in the background. Read it again before attempting to write it." (as Claude Code); after the round's note showed the change, a write without reading again: "The file mod.txt has been updated successfully. …" (as Claude Code); a folder: "error: afolder is a directory, not a file. To create a file inside it, include the file name in path."; three writes to two files: "Wrote 2 files"; Grok's list "2) … 3) … 4) …": numbered 2, 3, 4. **Found:** its "5) `…`" with two lines under it (no blank line) showed "5)" as plain text: a block was a list only when every line had a mark; now a line with no mark carries on the item above it, as in Markdown (CD262). Write is on the docs page (/docs), beside Read (CD248).

## 3. edit (Claude Code: Edit)

**Claude Code's docs** (the owner, 2026-11-09: "start on the edit tool … Look up the entire Claude Code docs for edit"; all 228 pages fetched fresh that day, every line naming Edit read: the tools reference's "Edit tool behavior", the error reference, the changelog's ~60 Edit entries from 2.0.43 to 2.1.314, permissions, permission modes, hooks, settings, memory, sandboxing, checkpoints and the Agent SDK):
- Exact string replacement, no regular expressions or fuzzy matching. Inputs `file_path`, `old_string`, `new_string`, `replace_all` (optional). Its result for programs is the change as a diff (`structuredPatch`), with `originalFile`, `replaceAll`, `userModified` and an optional `gitDiff`.
- The checks, in order: a path under a `Read` deny rule is refused (a new file there too); read-before-edit (older models must read first; newer models may edit an unread file when reading it would need no permission prompt; a read cut short with a PARTIAL view doesn't count as a read); match exactly ("A single character of whitespace or indentation difference is enough to miss"); exactly once, or `replace_all: true`.
- "A file that changed on disk after Claude last read it can still be edited when `old_string` matches the current content exactly and unambiguously … the result notes that the file carries other changes". Otherwise Claude reads it again.
- A view with a command counts as a read: `cat`, `nl`, `bat`, `batcat`, `head`, `tail`, `sed -n 'X,Yp'`, `grep`, `egrep`, `fgrep`, `rg`, each on one file with no pipes or redirects; a command that printed none of the file's text doesn't count. Viewing a file, or (2.1.x) writing or editing it, loads its folder's CLAUDE.md and path-scoped rules.
- Not valid UTF-8 (unless UTF-16 LE behind its byte-order mark): refused, nothing written. A notebook: use NotebookEdit (cells by `cell_id`: replace, insert, delete). A link at the path: refused, naming its target; links that loop or lead nowhere: refused. A null byte in the path: "Edit file_path cannot contain null bytes (\0). Remove the null byte and try again." Protected paths (`.git`, `.husky`, `.vscode`, `.claude`, `.npmrc` …): never auto-approved, as for Write.
- From the changelog: curly quotes kept (2.1.x: "Fixed Edit tool silently corrupting Unicode curly quotes"); `\uXXXX` written in `old_string` taken for its character, and an escaped backslash before `uXXXX` not; CRLF not doubled, Markdown hard breaks (two trailing spaces) kept; "String not found in file" for a big edit that doesn't match; `replace_all` given as the text "true" accepted; no crash on files over 1 GiB; language-server problems after each edit; the model told to use short `old_string` anchors; Perforce mode (a read-only file: a `p4 edit` hint); each edit's diff shown in the conversation ("Error editing file" when one fails).

**Tried for real** (Claude Code 2.1.319's own Edit, in /home/user/cc-edit1, 2026-11-09):

| Case | Claude Code's Edit |
|---|---|
| A file never read | edited: "The file /home/user/cc-edit1/unread.txt has been updated successfully." |
| A file read whole first, or made by the edit | "… has been updated successfully. (file state is current in your context — no need to Read it back)" |
| Old text not there | "String to replace not found in file.\nString: delta" |
| Old text twice | "Found 2 matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.\nString: x = 1" |
| `replace_all: true` | "The file … has been updated. All occurrences were successfully replaced." |
| Old and new the same | "No changes to make: old_string and new_string are exactly the same." |
| Empty old text, the file exists | "Cannot create new file - file already exists." |
| Empty old text, no such file | the file made, with the new text |
| No such file | "File does not exist. Note: your current working directory is /home/user/cc-edit1." |
| Changed on disk since read, old text still there once | edited: "… updated successfully. (note: the file had been modified on disk since you last read it — the edit applied cleanly, but the file contains other changes not in your context. Read it before edits that depend on surrounding content.)" |
| Changed on disk since read, old text gone | "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it." |
| Only part read (3 of 3,000 lines, with a limit) | edited (no "file state is current") |
| Curly quotes in the file, straight ones in `old_string` | matched; the new text's straight quotes written curly, in the file's style (“hi there”, ‘later’) |
| `café` in `old_string` for a real "café" | matched; `CAFÉ` written as "CAFÉ"; a `é` written out in the file left as it was |
| CRLF file, plain line breaks in `old_string` | matched; the new lines written with CRLF. Mixed endings (CRLF, LF, CRLF): all CRLF after |
| Two trailing spaces | kept, outside the edit and in the new text, in `.md` and `.txt` |
| A tab in the file, spaces in `old_string`; a line-number prefix from read ("2\tBETA") | not found |
| An old encoding (Latin-1) | refused, nothing written: "File is not valid UTF-8: it uses a legacy encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. These tools write UTF-8 (or UTF-16LE behind its byte-order mark) and never convert a file's encoding on their own, so nothing was written. If the file is text, make the change with a shell command that reads and writes it in its own encoding (iconv, or PowerShell Get-Content/Set-Content -Encoding), or ask the user whether to convert it to UTF-8 first. To replace the whole file with new UTF-8 text anyway, delete it first, then Write it." |
| UTF-16 LE with its mark; UTF-8 with its mark | edited; the encoding and the mark kept |
| A link | "Refusing to write /home/user/cc-edit1/link.txt: it is a symbolic link. Write to the link's target path instead: /home/user/cc-edit1/target.txt." |
| A folder | "Error calling tool (Edit): EISDIR: illegal operation on a directory, read" (the raw error) |
| A notebook | "File is a Jupyter Notebook. Use the NotebookEdit to edit this file." |
| A path relative to the current folder | taken from the current folder |
| Whole lines taken out (empty new text) | done |
| A file in a folder with its own CLAUDE.md | that CLAUDE.md shown to the model right after the edit |
| Other names: `path` for `file_path`, `old_str` and `new_str` | taken, silently (Write adds a note; Edit doesn't) |

Next (the owner's order): Coder's edit side by side, then what to copy, then live in the browser.

**Coder's edit, side by side** (the owner, 2026-11-09: "Ok tell me"; Coder's real edit tool run as its machine runs it, as `dev` in a project folder, on the same files and cases: scratchpad `edit-side.mjs`):

| Case | Claude Code's Edit | Coder's edit before |
|---|---|---|
| An old encoding (Latin-1 "café au lait") | refused, nothing written | **written over: "cafï¿½ noir", the é lost for good** (read as UTF-8, written back with U+FFFD) |
| CRLF file, plain line breaks in `old_string` | matched; new lines CRLF | **"old_string was not found"**; its read shows Grok each `\r`, which Grok does not type back, so a CRLF file can hardly be edited |
| Mixed endings | matched; all CRLF after | **not found** |
| Curly quotes in the file, straight in `old_string` | matched; written curly | **not found** |
| `é` in `old_string` | taken for "é" | **not found** |
| A link | refused, naming its target | **edited the target through the link, silently** |
| Links in a loop, or to nowhere | refused ("where it leads on disk could not be determined …") | "no such file: loopa/x.txt …" |
| A notebook | refused: "File is a Jupyter Notebook. Use the NotebookEdit to edit this file." | **edited as plain text** (its JSON) |
| UTF-16 with its mark | edited, kept UTF-16 | refused as "a binary file (not text)" |
| Changed on disk since read, old text still there once | edited, with the note "(note: the file had been modified on disk since you last read it — …)" | edited, no note |
| Changed on disk since read, old text gone | "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it." | "old_string was not found in stale.txt. …" |
| Empty old text, no such file | the file made | "no such file: brandnew.txt. …" |
| Empty old text, the file exists | "Cannot create new file - file already exists." | "give old_string: the exact text to replace" |
| `replace_all` as the text "false" | not all (text booleans read as booleans) | **replaced both** ("k = 2" twice) |
| `old_str`, `new_str` | taken | "give old_string …" |
| A protected file (`.husky/…`, `.npmrc` …) | asked, as for Write | **written with no question** (write asks; edit doesn't yet) |
| What the chat shows under each edit | the change (a diff) | "Edited a.txt" only |
| New problems from the language server after each edit | yes (as after Write) | none (only after write) |
| Size | up to about 1 GiB | 5 MB ("too big for this tool") |
| Its description tells the model to leave read's line-number prefix out of `old_string` | yes ("Strip the Read line prefix (line number + tab)") | no |
| Words: done | "The file … has been updated successfully." ("(file state is current …)" only when read whole); replace_all: "The file … has been updated. All occurrences were successfully replaced." | "edited unread.txt (1 place)" |
| Words: not found / twice / the same | "String to replace not found in file.\nString: …" / "Found 2 matches of the string to replace, but replace_all is false. …\nString: …" / "No changes to make: old_string and new_string are exactly the same." | "old_string was not found in … Read the file and copy the text exactly, spaces included." / "old_string appears 2 times in … Add more lines around it so it is unique, or set replace_all." / "old_string and new_string are the same" |
| A null byte in the path | "Edit file_path cannot contain null bytes (\0). …" | "the path cannot contain null bytes (\0). …" |
| A folder | "Error calling tool (Edit): EISDIR: illegal operation on a directory, read" | ".../adir is a folder, not a file: list what is in it with glob, or a command such as ls" (clearer; Claude Code's Write says much the same) |
| Already the same | an unread file, or one read only in part, edited; exact match (a tab is not spaces; a line-number prefix is not the file); two trailing spaces kept; UTF-8 byte-order mark kept; whole lines taken out; replace_all; "twice" refused; "no such file" with the working folder named; a relative path; the folder's instruction file shown after the edit (`laterNotes`); the security check on each edit (`checkEdit`) | |

**Copied** (the owner, 2026-11-09: "Notebook for later, but yea do this"; `toolEdit` in `container/coder-tools.mjs`, the agent's edit branch, the page's card):

| Claude Code's Edit | Coder's edit now |
|---|---|
| Not valid UTF-8: refused, nothing written | refused, nothing written: "latin1.txt is not valid UTF-8: … Edit saves the whole file as UTF-8 (or UTF-16 behind its byte-order mark), which would replace every byte it cannot decode with U+FFFD, so nothing was written. …" |
| CRLF matched with plain line breaks; written in the ending most lines have | the same (`eolOf`: mostly CRLF all CRLF, mostly LF all LF) |
| Curly quotes matched; the new text curled where the file's were, of that kind | the same (`straighten`, `curlify`: opening after a space or a bracket; an apostrophe between letters ’) |
| `\uXXXX` taken for its character; not after an escaped backslash | the same (`unescapeU`) |
| A link refused, naming its target; loops and links to nowhere refused | the same, write's words |
| A notebook refused ("File is a Jupyter Notebook. Use the NotebookEdit to edit this file.") | refused: "File is a Jupyter Notebook. edit changes plain text, and a notebook is JSON whose cells a text change can break: read the notebook, then replace it whole with write, or change a cell with a short python3 script …" (a notebook tool: later, the owner) |
| Changed since read: edited with its note when the old text is there once; else "File has been modified since read, …" | the same, the note word for word; the refusal in write's words ("… either by a command or by something running in the background …") |
| "(file state is current …)" only for a file read whole, or made by the edit | the same (a read of some lines is marked `part` now, `markPart`) |
| UTF-16 LE behind its mark edited, kept | the same (BE too, as write) |
| No old text: a new file with its folders; an empty file filled; "Cannot create new file - file already exists." | the same |
| `replace_all` as the text "true"/"false"; `old_str`, `new_str` | the same, silently |
| Its words: "The file … has been updated successfully.", "… updated. All occurrences were successfully replaced.", "String to replace not found in file.\nString: …", "Found N matches …", "No changes to make: …", "File does not exist. Note: your current working directory is …", "edit path cannot contain null bytes …" | the same |
| Protected paths asked | asked on the card, with the lines taken out (red) and put in (green); from GitHub not edited |
| Each edit's diff in the conversation; language-server problems after it | under each step (+N −M, the lines), as write's; the language server's new problems |
| The model told to strip read's line prefix, to use short anchors | edit's description: "Copy it from what read showed without read's line-number prefix (the number and the tab before each line): that is not part of the file. Keep old_string short …" |
| Files up to about 1 GiB | 256 MB (one JavaScript string holds about 512 MB) |

Tests: CD263 (every case, Claude Code's words and the bytes on disk), CD264 (the card, the change, old_str and the security check, the description), CD265 (the card's lines on the page), all failing on the old code; CD36, CD224, CD252 and the file-tools test changed to the new words. Tried on a local copy of the page (the edit's change under its step; the card for `.husky/pre-commit`).

**Second docs pass** (the owner, 2026-11-09: "What else on the edit tool from claude code docs you havent seen"): every page searched again for edits in general (diffs, rewind, checkpoints, line counts, read-only files), not only the word Edit, and the cases left untried, tried:

| Claude Code | Coder's edit now |
|---|---|
| A command that views a file counts as reading it: `cat`, `nl`, `bat`, `batcat`, `head`, `tail`, `sed -n 'X,Yp'`, `grep`, `egrep`, `fgrep`, `rg`, one file, no pipes; one that printed none of it doesn't (tools reference) | the same already (`viewedFile`; only a command that succeeded) |
| Path-scoped rules and nested CLAUDE.md load when a file is read, written or edited (memory, context window) | the same already (`.coder/rules` with `paths:`, a subfolder's CODER.md, through `afterFile`) |
| After a summary, up to five files read or edited are read again (context window) | the same already (`REREAD_FILES`, edits counted by `filesTouched`) |
| The memory-file error after any change to it (errors: "Memory index is over its read limit") | the same (`memoryNote` in edit's answer) |
| "Fixed Write and Edit stalling for up to 5 seconds … and reporting 0 lines changed, when changing thousands of lines" | tried: 6,000 lines changed with `replace_all` in 0.09 s, "+6000 −6000", 120 lines kept for the chat |
| A read-only file is changed anyway ("`CLAUDE_CODE_PERFORCE_MODE` … instead of silently overwriting them"; as root here it was, and stayed read-only) | **"error: EACCES: permission denied, open '…/ro.txt'"** (as `dev`), nothing changed: to the owner |
| "Fixed the file edit permission dialog sometimes showing a changed line cut short with no indication" | **the card cuts a line at 300 characters with no "…"** (write's card too): to the owner |
| Diffs read with `+` and `-` for screen readers (accessibility) | the same: each changed line keeps its `+` or `-` |
| Not edit itself, not in Coder: hooks around edits (format on save), `Edit(path)` permission rules, the asking modes (the owner: later), the IDE's side-by-side diff, the `/diff` panel per turn and the session's +N −M totals (Coder: See changes), checkpoints (Coder: Rewind), Perforce mode, telemetry | |

**The two from the second pass, done** (the owner, 2026-11-09: "Ok yea fix that"): a read-only file is edited and stays read-only (`writeOver`: its owner makes it writable for the write, then read-only again; one of another user's: "… is read-only, and it belongs to another user, so edit cannot change it: change it with a command, or ask the owner."); a line over 300 characters on the card ends in "…", with the owner's values hidden before the cut (write's card too). CD266, failing on the code before.

**Third docs pass** (the owner: "then go look at claude code docs again for the edit tool"): all 228 pages fetched again (none changed since that morning); the all-in-one file (`llms-full.txt`, 10 MB) holds the same 228 pages, nothing hidden; the pages not read line by line before, read. Nothing more about edit itself: only things outside it (a mod that replays a turn's edits, the colours of added and removed lines, the focus view's diffstats, hooks after edits, the language server after edits, which Coder has now).

**Live in the browser, with Claude Code side by side** (deploy 73, recording 19; the owner, 2026-11-09: "merge and deploy and then start testing the edit tool", then "Remember to also do it in Claude Code so you can compare it"): eleven messages to Coder on gofarther.dev with Grok 4.7 (a new chat on canias7/testingforclaude), and the same steps with Claude Code 2.1.319's own Edit on the same files (/home/user/cc-live-edit):

| # | What | Coder, live | Claude Code | |
|---|---|---|---|---|
| 2 | Its words: an unread file, not found, twice, replace_all, the same text, no old text (a file with text / a new file in new folders), no such file, a file read whole | the nine answers word for word as Claude Code's | the same nine | same (the working folder's path apart) |
| 3 | Windows endings; mixed endings; curly quotes typed straight | `F I R S T \r \n S E C O N D \r \n i n s e r t e d \r \n`; `A \r \n B \r \n C \r \n`; “hi there” and ‘later’ | the same | same |
| 3 | `é` written out | Grok's first call sent "é" itself (its JSON decoded it), the file changed; the six characters sent after that found "café" gone: "String to replace not found" (right for the file then) | matched, "CAFÉ Rest" | not shown cleanly live; CD263 has it |
| 4 | An old encoding; UTF-16; a UTF-8 mark | refused, `c a f 351` untouched; `377 376 h \0 i \0 …`; `357 273 277 h i …` | the same (its own words) | same (Coder's words for the refusal) |
| 5 | A link; a folder; a notebook; a read-only file; a null byte | "Refusing to write link.txt: it is a symbolic link. Write to the link's target path instead: target.txt."; Coder's folder words; refused with the way round; **edited as `dev`, still `-r--r--r--`**; Grok sent the six letters `\u0000`: "File does not exist" | the same; raw "EISDIR …"; "Use the NotebookEdit to edit this file."; edited (as root), still read-only; not sent | same (Coder's clearer folder and notebook words); the null byte: CD211 |
| 6 | A command and two edits in one answer | changed.txt edited with Claude Code's note word for word; stale.txt: "… has been modified since read, either by a command or by something running in the background. Read it again …" | the same note; "… either by the user or by a linter …" | same |
| 7 | `.husky/pre-commit`: Allow | the card, "What it would change: -npm test +npm run lint"; Allow; edited, its change under the step | edited (auto mode: its classifier allowed it; Manual and accept-edits modes ask) | as Claude Code's Manual mode |
| 8 | `.npmrc`, a 380-character line: Don't allow | the card, the line cut at 300 with "…" (in its text, but past the card's right edge: seen only by scrolling sideways); Don't allow: not changed, not tried again | not run (Coder's card; its terminal wraps a long line) | right, but see Found |
| 9 | The mistake-check | "Found 1 new diagnostic issue in 1 file", "✘ [Line 5:25] \"rate\" is not defined [reportUndefinedVariable] (Pyright)"; Grok fixed it | nothing (no language server plugin in its cloud session) | as Claude Code with a plugin |
| 10 | 40 lines at once | "+40 −40", "Show 73 more lines", its words | its words | same |
| 11 | A folder with its own instructions | sub/CODER.md shown after the edit | sub/CLAUDE.md shown after the edit | same |

**Found:**

1. A Windows-endings file's change, as shown under its step, keeps each line's hidden `\r`, so copying the change gives a blank line after each (on screen it looks right). Claude Code's own record of the same edit has clean lines (`-first`, `+FIRST`).
2. On the protected-file card, a long line with no spaces runs past the card's right edge, so its "…" is seen only by scrolling sideways (le-8-card.png).

Not part of edit's comparison: Claude Code's terminal groups only reads and searches (its `collapsed_read_search`), so there is no Claude Code group line for edits to compare Coder's "Edited N files" with.

**Both fixed** (the owner, 2026-11-09: "Yes fix"):

1. The change is worked out with line endings set aside, as Claude Code's is: no hidden `\r` on its lines, under the step or on the card, and a line whose ending alone changed (a mixed-endings file made the file's own) is not counted as changed. Write shares it. Tried on the real page: the change box and a copy of it have no `\r` (`-first`, `-second`, `+FIRST`, `+SECOND`, `+inserted`, ` third`). CD267.
2. A long line on the card wraps, so its "…" is in view: tried on the real page with the live test's 380-character `.npmrc` line, no sideways scrolling, four rows, the "…" inside the card. CD268.

The /docs page has an Edit section now (what you see, how edit finds the text, when the file changed, files Coder asks about, when edit says no, what stays as it was); CD248 checks its numbers against the code.

**Live after deploy 74** (recording 20; the owner, 2026-11-09: "Ok,merge"): a new chat on canias7/testingforclaude with Grok 4.7.

| # | What | Coder, live | |
|---|---|---|---|
| 1 | A file with Windows endings (`printf 'first\r\nsecond\r\nthird\r\n'`), edited | the change under the step `-first`, `-second`, `+FIRST`, `+SECOND`, `+inserted`, ` third`, with no `\r` in it or in a copy of it; `od -c`: `F I R S T \r \n S E C O N D \r \n i n s e r t e d \r \n t h i r d \r \n`; edit's words as Claude Code's, "(file state is current …)" after Grok had read it whole | fixed |
| 2 | `.npmrc`, a 380-character line: Don't allow | the card wraps it onto 4 rows, the "…" inside the card, no sideways scrolling; not changed | fixed |
| 3 | gofarther.dev/docs | Read, Write and Edit; Edit's six parts in the list | live |

Seen once, outside edit: the setup's saved copy could not be made ("Fly.io did not start saving it in time"). The setup ran because a copy only serves the Coder version that made it (`cacheUsable`: `c.image !== s.image`), and deploy 74 is a new one; the next new chat runs the setup and tries again. The first time in the recorded live tests (seven saved, two used).
