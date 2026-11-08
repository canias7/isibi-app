# Coder against Claude Code, tool by tool

The owner's plan (2026-11-08): go through Coder's tools and environment one at a time. The owner tries each one in
both Coder and Claude Code with the same prompt. Claude (the assistant) compares them against Claude Code's actual
docs, read fresh each time: the [tools reference](https://code.claude.com/docs/en/tools-reference) and the
[cloud docs](https://code.claude.com/docs/en/claude-code-on-the-web).

Each entry: what Claude Code's docs say, what Coder does, the test, the results, and what changed.

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
- **One more that Claude Code does and Coder doesn't, offered to the owner:** "A note when a file Claude read earlier changes on disk" (how Claude Code works). If a command changes a file Coder read (a formatter, a git checkout), Claude Code tells Claude what changed before its next step. Coder isn't told, so it could edit from an old copy (the edit then fails, and Coder reads the file again).
- **For later (tool 3, edit):** Claude Code's Edit refuses a file that isn't valid UTF-8, rather than spoil its bytes.

Different on purpose: Claude Code's permission rules (`Read(...)` deny rules, a prompt for files outside the working folder, network paths) and its `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` setting. Coder has no permission prompts or settings. It reads only inside the chat's repositories (its extra ones too), plus its own memory file.


**Differences seen side by side:**
- **Claude Code shows the picture it opened in the chat.** Coder shows the step ("Read test.png") but not the picture. Offered to the owner.
- **Saving:** Claude Code left the files uncommitted until its stop hook asked, then committed and pushed. Coder commits and pushes every job by itself. Same end result.
