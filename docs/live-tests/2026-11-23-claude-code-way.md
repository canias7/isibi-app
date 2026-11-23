# Live test: the 8 "Claude Code way" batches (2026-11-23)

Deploy 277 (main at 5af56f11), gofarther.dev, Grok 4.7 on Low, test repository canias7/testingforclaude.
Two throwaway chats (Accept edits, then Auto); both deleted after.

| # | What was tried | Result |
|---|---|---|
| 0 | `env \| grep -E '^CLAUDE' \| sort` | Pass: CLAUDECODE=1, CLAUDE_CODE_REMOTE=true, CLAUDE_CODE_SESSION_ID and CLAUDE_CODE_REMOTE_SESSION_ID (the chat's id), CLAUDE_EFFORT=low |
| 1 | `/model`, `/effort bogus`, `/effort low`, the / list | Pass: "Model: Grok 4.7. Use /model <name> to switch"; "Unknown effort: bogus. Choose one of: low, medium, high, xhigh."; "Set effort level to low"; /context /export /clear /model /effort all in the list |
| 2 | `/context` | Pass: the grid, System prompt / System tools / Memory files / Messages / Free space / Autocompact buffer, Auto memory listed |
| 3 | Find files containing "hello" | Pass: searched with `rg -l -i` in bash; no grep/glob tool |
| 4 | Make a notebook, read it, NotebookEdit one cell | **Fail: 16 calls, each "error: give a path"** (the check before the edit sent only a write's or an edit's inputs). Fixed; test R11a |
| 5 | Write .claude/notes.md, then .claude/notes2.md | Pass: card offered "Yes, and allow Coder to edit its own settings for this session"; picked; the second write asked nothing |
| 6 | SendUserFile hello.txt, caption "test file" | Pass: card "hello.txt · 1 KB · test file" with Download |
| 7 | Attach a CSV and ask about it | First try: the question went before the upload ended ("Wait for the file to finish attaching."). Retest r11b: Pass, Coder read `.coder-files/r11-prices.csv` and listed apple 3, pear 5, plum 7 |
| 8 | CLAUDE.md "Always end every answer with the word BANANA." | Pass: later answers end with BANANA, also after /clear (the first answer after did not: Grok on Low) |
| 9 | Ctrl+Enter while working | Pass: "Queued for later" with Send now. Retest r11b with a real 45-second command: the message waited, the job said done-one, then queued-later-ok came as its own answer |
| 10 | Send now | Pass. Retest r11d: with a command running, it went on in the background and Coder answered sent-now-a-ok in the same job; with the command's card still waiting, the job stopped and the message went out next (answered 12 s later) |
| 11 | `/export r11-test.txt` | Pass: a 5.5 KB file in Claude Code's layout ("> ", "⏺", "⎿") |
| 12 | Share: Public, open the link, Private again | Pass: read-only page "Shared by canias7 · Read only"; after Private: "This chat isn't shared: it is private, or it no longer exists." Its left side said "Connect GitHub to start." Fixed |
| 13 | Edit README, Rewind "Restore code only", git log/status | Pass: "1 file restored, not committed"; git status showed README.md changed with no new commit; the next message's save committed it |
| 14 | `/clear`, then "what did I ask first?" | Pass: the grey line, and Coder did not know the earlier messages |
| 15 | + Repository between messages | Shown in the bar with the other repositories |
| B1 | Auto: `rm -rf ~`, then `rm -rf "$OLD_BUILD_DIR"/` | Not reached: Grok refused both itself, so Coder's own refusal never ran live (covered by tests: cc-way-batch7) |

Also seen: right after the deploy the first new chat took over 30 seconds to open; after that about 4 seconds.

All test chats were deleted after, with the four empty ones the timing checks made.
