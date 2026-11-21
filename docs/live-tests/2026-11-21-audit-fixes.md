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

## Round 5 live checks

Where: gofarther.dev, repo canias7/testingforclaude, Grok on Low, mode Accept edits. Two throwaway chats (deleted after). Screenshots: session scratchpad, live-audit/r5-*.png.

Chat 1 message (one job, 14 steps, every card answered Yes): "Test run. Do each numbered step as its own separate tool call… 1. bash: `mkdir -p docs2 && echo hi > docs2/a.txt` 2. bash: `cat /etc/hostname` 3. bash: `sed -n 'w copy.txt' README.md` 4. bash: `grep -r zzqqxx_nomatch docs2` 5. bash: `mkdir -p junk && rm -rf junk` 6. bash: `curl -s -o /dev/null -H "Authorization: Bearer ghp_<36 fake chars>" https://example.com` 7. read tool: `.git/HEAD` 8. write tool: `..dots.txt` 9. bash: `echo old > ro.txt && chmod 444 ro.txt` 10. write tool: `ro.txt` = new 11. write tool: `key.txt` = the fake token 12. bash: `wc -c key.txt ro.txt` 13. web_fetch `https://example.com` 14. web_fetch `https://example.com/?q=` + 2,100 a's"

| Audit item | Message / action | Result | |
|---|---|---|---|
| R1-22 file outside project asks | step 2 | Card ("cat in '/etc/hostname' was blocked … Do you want to proceed?"); Yes printed it | PASS |
| R1-34 sed that writes asks | step 3 | Card "This command requires approval" | PASS |
| R1-27 search with no match not a failure | step 4 | Step shown ✓, not failed | PASS |
| R1-123 harmless delete in project | step 5 | Normal card, no dangerous-delete wording | PASS |
| R1-49 "don't ask again" with a secret | step 6 | Card offers "Yes, and don't ask again for curl … Bearer ghp_…" with the full token in the option text | **FAIL** |
| Hiding secrets in the card / chat | step 6, 11 | Command line and written file shown as `[hidden]` (but see R1-49: the option text shows it) | PASS (partly) |
| R2-12 key-shaped text kept in files | steps 11-12 | `wc -c key.txt` = 40, the real text | PASS |
| R1-143 file holding a key not saved to GitHub | step 11, end of job | key.txt committed and pushed to the chat's branch (seen on GitHub) | **FAIL** |
| R1-189 file tools and .git | step 7 | Read refused: "the .git folder is off limits" | **FAIL** |
| R1-212 names starting with two dots | step 8 | `..dots.txt` written | PASS |
| R1-155 write a whole read-only file | steps 9-10 | Write worked (old → new) | PASS |
| R1-199 link card says where it leads | step 13 | "Coder wants to fetch content from example.com" | PASS |
| R1-177 too-long address refused before asking | step 14 | Refused ("Invalid URL"), no card | PASS |
| R1-203 new card doesn't grab the keyboard | Clicked box, typed `1` while first card waited | Card still waiting, box held "1" | PASS |
| R1-159 @ list offers folders | Typed `@docs` after docs2/ was made | Only `docs2/a.txt`, no `docs2/` folder | **FAIL** |
| R1-13 pull request state shown | `Open a pull request for this branch titled "r5 test". Reply in one line.` | "Pull request #36" pill in header and #36 in Recents | PASS |
| R1-46 /undo alias | Typed `/und`, `/checkp`, `/allowed`; sent `/undo` | List offers /rewind and /permissions; /undo opened Rewind | PASS |
| R1-14 GitHub's own reason on a failed PR | Chat 2: `Open a pull request for this branch right now, without changing any file. Reply in one line with exactly what GitHub said.` | "GitHub did not open the pull request: Validation Failed." (GitHub's detail, e.g. no commits between branches, not shown) | **FAIL** |
| R1-148 /compact on a very short chat | Chat 2: `/compact` | "Not enough messages to compact. Your message is back in the box." | PASS |
| R1-44/132 draft does not move chats | Typed a draft in chat 2, switched to chat 1, back | Chat 1 box empty; draft back in chat 2 | PASS |
| R1-158 /btw | Typed `/btw` | "No commands match" (no handler in code) | **FAIL** |
| R1-215 /autocompact | Typed `/autocompact` | "No commands match" | **FAIL** |
| R1-220 /init, /review | Typed each | "No commands match" | **FAIL** |
| R1-166 Archive a chat | Looked at a Recents row | Only × (remove), no Archive | **FAIL** |

Skipped: hooks and settings-file items (need files on main); GitHub-started jobs, @coder, auto-fix and review items; PowerShell items (tool off); crashes, restarts and lost-job races (can't cause safely); paid extras (web search cap); sign-out and landing-page items; long-chat and table items; See changes line numbers (no suitable diff).

## Round 6 live checks

Deploy run 271 (main, 5320e8dd) succeeded. Tested live on gofarther.dev, canias7/testingforclaude, Grok 4.7 on Low, Accept edits. Throwaway chats deleted afterwards. Screenshots: `r6-*.png` in the session's live-audit folder.

| Check | What was done | Result | Verdict |
|---|---|---|---|
| 1 Secret card | Asked for the curl with a fake `ghp_` Bearer token | Card showed `Bearer [hidden]`, options only Yes / No; token not in card text or HTML. Answered No: "Not allowed". (On the first try Grok refused the step itself without a card.) | **PASS** |
| 2 Secret file | Wrote key.txt with a fake token, then "commit and push now" | Push refused: "Not sent to GitHub: key.txt (GitHub PAT) looks like it holds a secret…"; diff shows `[hidden]`. GitHub: key.txt 404 on the branch (docs3/a.txt is there). | **PASS** |
| 3 .git | read tool on `.git/HEAD`; write tool on `.git/zz-test.txt` | Read fails: `error: no such file: .git/HEAD. Note: your current working directory is /data/work/<chat>` (twice). Write was refused ("Refused: .git is off limits"), but only after a "sensitive file" card offering Yes, which was clicked. The repo's git dir lives at `/data/git/<chat>`, so `.git` is not in the work tree. | **FAIL** (read) |
| 4 @ folders | Typed `@docs` after docs3/a.txt was made | List: `docs3/`, `docs3/a.txt` | **PASS** |
| 5 PR reason | Fresh chat, no changes, "open a pull request" | Reply quotes GitHub: "Validation Failed: No commits between coder/testingforclaude-c51d and coder/testingforclaude-hqzvv5l3". Grok took 9 bash steps first and created the branch ref with `gh api`. | **PASS** |
| 6a /init | `/init` | Read README, wrote CLAUDE.md (11 lines). It was auto-pushed to the throwaway chat branch with no card to answer No to. | **PASS** (note the auto-push) |
| 6b /review | `/review` | Reviewed the branch diff against its base, flagged key.txt as a secret | **PASS** |
| 6c /btw | `/btw what is 2+2?` while a 45 s command ran | Side panel answered "4"; the question did not appear in the chat | **PASS** |
| 7 Archive | ⋯ then Archive, reload, Unarchive | Left Recents, "Archived (1)" shown and kept after reload; Unarchive put it back and the button went away | **PASS** |
