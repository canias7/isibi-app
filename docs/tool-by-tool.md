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

**Differences seen side by side:**
- **Claude Code shows the picture it opened in the chat.** Coder shows the step ("Read test.png") but not the picture. Offered to the owner.
- **Saving:** Claude Code left the files uncommitted until its stop hook asked, then committed and pushed. Coder commits and pushes every job by itself. Same end result.
