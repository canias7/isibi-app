# Live test: audit fixes (2026-11-21)

Where: gofarther.dev, account cristiananias7, repo canias7/testingforclaude, Grok on Low.
Deploy: run 267, main at 7ad684db. Screenshots were in the session scratchpad (live-audit/v2-*.png).

Each test has the exact steps, so the same can be run in Claude Code on the web
(claude.ai/code) on the same repo, and the two compared.

| # | Test | Exact steps | Coder result |
|---|---|---|---|
| 1 | Long approval card | Mode **Accept edits**. Send: `Run this as ONE bash command: 60 lines, each "curl -s https://example.com -o /dev/null", joined with newlines.` Look at the approval card. | PASS: shows 40 lines + "Show all 60 lines" |
| 2 | Waiting step wording | Same card, before answering: read the step's line. | PASS: "… waiting for you" (shows Grok's description when it gives one) |
| 3 | Scroll stays put | While Coder works on a long answer, scroll to the top. | PASS: stays where you scrolled |
| 4 | Show earlier messages | Open a very long chat. | NOT TESTED (no long chat) |
| 5 | Disconnect GitHub | Sidebar → Repositories → Disconnect GitHub → read box → **Cancel**. | PASS (Claude Code: Settings → GitHub) |
| 6 | Rewind list counts | In a chat where Coder changed a file, type `/rewind`. | FAIL: "Nothing to rewind to yet" (bug A) |
| 7 | Plan names the chat | New chat, mode **Plan**. Send: `Add notes/plan-test.txt containing one line.` Approve the plan. | PASS: chat renamed after the plan |
| 8 | @ list is fresh | After Coder makes a new file, type `@` and the first letters of its name. | PASS |
| 9 | /compact while working | While a card waits or Coder works, send `/compact`. | PASS: "Runs when Coder is done" |
| 10 | /rewind while working | While Coder works, send `/rewind`. | PASS: "Rewind opens when Coder finishes", then opens |
| 11 | Mid-job message in Rewind | While Coder works, send `Then say kiwi.`, then `/rewind` after. | PASS: listed with "No code restore" |
| 12 | Setup help text | Environment → Setup script, read the help line. | PASS: says sudo works |
| 13 | Repo skills | Ask: `Create .claude/skills/hello/SKILL.md with name hello, description "Say hello", body "Reply only: Hello from the skill."` Merge it to main, new chat, type `/hel`. | NOT TESTED (skill was only on the chat's branch) |
| 14 | Co-author line | After Coder pushes, open the commit on GitHub. | FAIL: no "Co-authored-by" line (bug B) |
| 15 | Memory notes | Send: `Remember that my favourite fruit is mango.` Then ask Coder to show its memory folder. | PASS: one note file + MEMORY.md index |

## Bugs found
- **A.** /rewind empty when Coder added an internal note (startup/skills) just before a message.
- **B.** No Co-authored-by line on Coder's commits.
- **C.** (seen once) Mode picked before a new chat's first message went back to Auto.
- Smaller: an unknown /command was sent twice; Plan mode committed its plan file to the repo; memory folder named after the chat, not the repo.

## Claude Code side (owner's screenshots, 2026-11-21)
- Accept edits on the web: commands ran with no approval card (60 x `touch /tmp/t1`). Cards only for special tools (get/update environment). Coder showed a card for 60 curls in Accept edits: check whether Coder asks more than Claude Code.
- Tool card: "Allow Claude to use X?", note "Always allow lasts for this session", main button Always allow (with ▾ and shortcut), Deny. Desktop pop-up "Approve or deny …" while a card waits.
- Session gets an AI-made name from the first message ("Bash curl command script", "Notes plan-test file"); approving a plan does not rename it. Coder renames after the approved plan.
- Plan card: "Claude proposed a plan", Open plan link, buttons Reject / Revise… / Accept / Accept and use auto mode (main). Plan opens in a right side panel where you can comment on selected text (only in Plan mode or while approving). Plan file shown as a "Created …md" step.
- Long counting ran as a background command; Claude answered at once and posted the result itself when done. Under answers: copy, pin, read aloud, "1 minute ago".
- After a hook re-prompt, Claude cleaned up a stray package-lock.json by itself.
- Still to test: /compact, /rewind and a message while Claude works (foreground command), unknown /command, co-author, memory, delete while waiting.
