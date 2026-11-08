# Everything Coder has (gofarther.dev)

The full list, numbered, for testing one by one (owner, 2026-11-07: "lets make
an entire list of everything we have"). Each item: what it does, and its result.

**The full test, 2026-11-08** (owner: "u test it all yourself one by one , record it pls").
How each item was tested:

- **Live:** the real Coder (real Grok, real machine, real GitHub), through `@coder` on the test repository
  canias7/testingforclaude, issues #12 to #16 and pull request #16.
- **Page:** the real page and the real server code, on Claude's side, with stand-ins for sign-in, GitHub and
  Grok (Claude can't sign in to the live site: the code is emailed). Recorded.
- **App:** the real desktop app on Claude's side, filmed on a virtual screen, opening the real gofarther.dev.
- **Automatic:** the automatic tests.

The recordings: 1 sign-in, page, GitHub, chats · 2 Stop, closing the tab, question cards · 3 environments ·
4 changes, pull request, Rewind, Undo, read-only · 4b /compact, the message box, read-only · 5 auto-fix,
code review settings, notifications, install, sign out · 5b settings kept, sign out · 6 the desktop app ·
7 the live tests, filmed on GitHub (each result outlined, with its item number).

**Totals:** 44 passed. 4 passed as far as Claude can go and need you for the last step (4, 42, 43, 44: a
switch, or a real phone). 2 weren't tested (45 desktop notifications, 47 the phone app). 6 problems were
found and fixed (the list at the end).

---

## A. Signing in and the page

1. **Sign in with your password, then the emailed code** (both steps, every time).
   **Passed** (page, recordings 1 and 5b): both steps, then Sign out goes back to the start page, the browser
   keeps nothing, and the old sign-in is refused. Note: Sign out ends your sign-in on every device (a question
   for you, at the end).
2. **Only allowed accounts** (`CODER_USERS`) can use Coder, and it's free while testing.
   **Passed** (automatic tests).
3. **The page:** the left rail (Coder, and Gloopy "coming soon"), New chat, Repositories, Recents (your chats), and the gear (Notifications, Sign out).
   **Passed** (page, recording 1).
4. **Install it like an app** (Home Screen on a phone, or "Install" in Chrome on a computer).
   **Passed** as far as a test browser can go (page, recording 5): the app manifest "Go Farther" (standalone,
   3 icons) and the service worker are there. The Install button itself needs a real phone or Chrome: **you**.

## B. GitHub

5. **Connect GitHub** with Coder's app, choosing which repositories it may use.
   **Passed** (page, recording 1).
6. **Open any public repository** by `owner/name` or its address; one you can't push to is read-only (item 5 of the list).
   **Passed** (page, recordings 4 and 4b).
7. **Your GitHub login never enters Coder's machine** (git goes through Coder's server with a short pass).
   **Passed** (live, issue #12): git on the machine has no login, and `GH_TOKEN`/`GITHUB_TOKEN` hold only a
   placeholder; the real login is added outside the machine.
8. **`gh` works with your login**, only for the chat's own repositories; `gh pr` and `gh issue` are refused (GitHub's GraphQL), `gh api repos/...` works (item 6).
   **Passed** (live, issue #12): `gh api` listed the issues; `gh pr list` was refused, as designed.

## C. Chats

9. **New chat on a repository**, on its own branch `coder/<chat>`; Coder never touches your main branch.
   **Passed** (page, recording 1; live, every answer names its branch).
10. **Pick the starting branch** before the first message. **Passed** (page, recording 1).
11. **Several repositories in one chat** (up to 3 more), added before the first message. **Passed** (page, recording 1).
12. **Pick the environment** before the first message. **Passed** (page, recording 1).
13. **Model and effort picker** (Grok 4.7: low, medium, high, extra high). **Passed** (page, recording 1).
14. **Pictures and @ files**: paste or attach a picture; type @ to point Coder at a file.
    **Passed** (page, recording 1; live with the real Grok on 2026-11-06).
15. **Stop** a running job. **Passed** (page, recording 2).
16. **A job keeps going when you close the tab**, and the chat is saved as it goes (a lost machine keeps its steps).
    **Passed** (page, recording 2: the tab closed mid-job; 45 seconds later the job had finished and was saved).
17. **Question cards**: Coder asks up to 4 questions in one card (your pick 4), each with choices, Other and sometimes several picks; one Submit sends all the answers.
    **Passed** (page, recording 2: 3 questions; live, issue #14: 2 questions in one comment, answered in one).

## D. Coder's machine

18. **One machine per chat** on Fly.io (4 CPUs, 16 GB); it sleeps when quiet, keeps its disk, and wakes on your next message.
    **Passed** (live, issue #12: after a sleep, the files and the program it had installed were all still there).
19. **Claude Code's tools**: Python, Node, Ruby, PHP, Java, Go, Rust, C/C++, Docker, PostgreSQL, Redis, Chrome, Playwright and more.
    **Passed** (live, issue #12: `check-tools` said 60 ok, none missing).
20. **Admin sandbox**: `sudo` works for anything inside it, and `apt-get install` works; the machine itself stays safe.
    **Passed** (live, issue #12), with two problems found and fixed: programs in /usr/games couldn't be run by
    name, and background commands couldn't be checked or stopped (fixes 1 and 2).
21. **The sealed network room**: all of Coder's internet goes through the gate that follows your network setting.
    **Passed** (the machine check on every deploy proves the wall). This round's live chat was on Full, and both
    sites got through, as they should. Trusted and None weren't tried again this round.
22. **A copy of the repository that failed is made again** (the bug the live test found).
    **Passed** (live, 2026-11-07, issue #9).

## E. Environments

23. **Named environments**, with a Default made for you; rename and archive. **Passed** (page, recording 3).
24. **Setup script**: runs on a new machine; system packages install as admin.
    **Passed** (page, recording 3; live, issues #12 and #13).
25. **The environment's saved copy of its setup**: the next new chat starts from it and skips the setup (item 1 of the list).
    **Passed** (live, issue #13: the next chat started from the saved copy and the setup didn't run again).
    It had failed on 2026-11-07 and was fixed.
26. **Network access**: None, Trusted (Claude Code's list, with the "www." sites), Full, or your own allowed sites (item 7).
    **Passed** (page, recording 3; live on Full). Found and fixed: on Full, Coder couldn't tell you its setting (fix 3).
27. **Variables** (settings every command sees). **Passed** (page, recording 3).
28. **Secrets**: keys Coder's server adds to requests for a site; they never enter the machine. Coder can ask you for one with a secure card.
    **Passed** (page, recording 3).
29. **Coder proposes environment changes** (allow a site, a setup script, a new environment); you approve.
    **Passed** (page, recording 3).

## F. How Coder works

30. **Its tools**: read, edit, write, search, the code helper (lsp), commands, web pages and web search, background commands, a to-do list. `read` also opens pictures (a screenshot Coder takes, say), PDFs by page, and Jupyter notebooks (your pick 1).
    **Passed** (live, issue #12: its to-do list, glob, grep, lsp, a screenshot it took and read exactly, a PDF
    page that was only a red circle, web search, web_fetch). Background commands: fix 2.
31. **Instruction files**: `CODER.md` (or `AGENTS.md` when there's no CODER.md), rules in `.coder/rules` for some paths only, a subfolder's own file; plus a memory kept between chats (item 10).
    **Passed** (live, issues #14 and #15): it followed the root CODER.md, was shown `src/CODER.md` when it
    opened a file in `src/`, and a new chat remembered your favourite colour. AGENTS.md and `.coder/rules`:
    automatic tests.
32. **Security check on each edit**: a warning to Coder when it writes risky code (item 12).
    **Passed** (live, issue #12: writing `eval` got the warning, and Coder then removed it).
33. **Review and Security review** of the chat's changes: you ask Coder (there are no Review buttons since 2026-11-06).
    **Passed** (live, issue #14: real findings, no files changed).
34. **Long chats summarized**, not cut; `/compact` with what to keep (item 3).
    **Passed** (page, recordings 4 and 4b; summarizing during a long job: automatic tests).
35. **Rewind**: code and chat, chat only, code only, Summarize from here, Summarize up to here (item 9).
    **Passed** (page, recording 4).
36. **Undo the last job** (ask Coder).
    **Passed** (page, recording 4: the last job's commit was reverted). Live, issue #14: it asked first, since the
    last job had changed nothing. Then undo turned out not to be allowed from GitHub, which is on purpose. Fix 5
    stops it offering undo there.

## G. Saving work

37. **Each job is committed and pushed** to Coder's branch. **Passed** (live, every job; page).
38. **See changes**, with **Compare against** any branch, and comments on lines for Coder (item 4).
    **Passed** (page, recording 4).
39. **Create PR / Create draft PR** (buttons, or ask Coder).
    **Passed** (page, recordings 4 and 5: a draft and a normal pull request opened; live: `@coder make a draft
    pull request` opened draft pull request #16). Correction: the first recording 4 said "opened" too early. No
    pull request had been made, because Claude's stand-in for Grok never asked for one. Recording 4 was redone.
40. **Read-only repositories**: the work stays on Coder's machine, See changes shows it, **Download patch**, no pull request (item 5).
    **Passed** (page, recordings 4 and 4b).

## H. GitHub automation

41. **@coder in an issue or pull request comment**: Coder answers there.
    **Passed** (live, issues #12 to #16 and pull request #16).
42. **Auto-fix** a pull request: off until you turn it on (button, or ask Coder in the chat); fixes failed checks and your reviews; answers in a review thread (item 2).
    **Passed** on the page (recording 5: Off, On, Off, and kept). **Live needs you:** turn it on for pull
    request #16 (only the chat on gofarther.dev can). The older auto-fix passed live on 2026-11-05.
43. **Code review**: per repository (Repositories screen: when it runs, and Quick / Standard / Deep); `@coder review`, `@coder review always`, `@coder review stop`; comments on the lines with 🔴 🟡 🟣, a summary, a check (item 11).
    **Passed** on the page (recordings 5 and 5b: set, and kept after a reload). Live, pull request #16:
    `@coder review` got "Coder Review isn't turned on for canias7/testingforclaude", which is right while it's
    Off. **Live needs you:** turn it on for that repository.

## I. Notifications and apps

44. **Notifications** on a phone or computer, with Claude Code's two switches; never about a chat you're looking at; tapping one opens the chat (item 8).
    **Passed** as far as a test browser can go (page, recordings 5 and 5b: the panel, and the two switches kept
    after a reload). A real notification needs a real phone or Chrome (the test browser has no push service):
    **you**.
45. **Desktop app notifications** while the app is open. **Not tested** (it needs signing in inside the app).
46. **Desktop app** for Mac and Windows (the build button).
    **Passed** (app, recording 6): gofarther.dev in its own window, no "Download" buttons inside it, other sites
    stay out, and its own page when there's no internet. Found and fixed: Try again with no internet left a
    blank window (fix 6, in the next desktop build).
47. **Phone app** for Android (and iPhone, simulator only until there's an Apple account; the build button).
    **Not tested** (no phone or phone emulator on Claude's side).

## J. Behind the scenes (covered by the automatic tests)

48. Your Grok key never enters Coder's machine; each machine has its own lock; your keys' values are hidden in the chat; the code is never stored with us (only on GitHub and the chat's machine).
    **Passed** (automatic tests; live, issue #12: a search of the machine's settings for keys found only the
    GitHub placeholder).
49. The buttons on GitHub: deploy, the machine's image check, the desktop and phone builds, and the old app's cleanup (which needs your word each time).
    **Passed** for deploy and the image check at the last deploy. The build buttons weren't pressed this round.
50. 212 automatic tests, 4 desktop app tests, plus 18 machine-admin tests, run before every deploy. **All pass.**

---

## Found and fixed by the full test (2026-11-08)

1. Programs in /usr/games (like `cowsay`) couldn't be run by name. *Live after "merge and deploy".*
2. Background commands: Coder's check said "not running" while a server ran, and its stop didn't stop it. *Live after "merge and deploy".*
3. On Full network access, Coder couldn't tell you its setting. *Live after "merge and deploy".*
4. A message that couldn't be sent in one chat stayed in the box when you opened another chat. *Live after "merge and deploy".*
5. On GitHub, asking for undo led to a question, then to "not available from GitHub". GitHub jobs are no longer offered what they can't do. *Live after "merge and deploy".*
6. Desktop app: Try again with no internet left a blank window. *In the next desktop build.*

Also corrected: two of Claude's own test mistakes. The first recording 4 said "pull request opened" too early,
and the test browser put the sign-in back after Sign out. Both were redone (recordings 4 and 5b).

## Small things noticed, not changed

- A command you stopped still shows a ✓.
- Download patch's file name repeats the repository's name (`public-demo-public-demo-….patch`).
- `gh pr list` without `--repo` first says "no git remotes found"; `gh pr` is refused anyway (use `gh api`).
- Sign out signs you out on every device (phone, desktop app, other browsers), which is Supabase's default.
  Claude's apps sign out only the device you're on.

## Not possible yet (needs you)

- **App Store and Google Play**: your own developer accounts (Apple $99 a year, Google $25 once).
- **Notifications inside the phone app**: the same accounts (Firebase for Android, Apple's push for iPhone). Until then, use gofarther.dev from the Home Screen.
- **Automatic code reviews on every pull request**: in GitHub's settings for the gofarther-coder app, tick "Pull request" events and set "Checks" to read and write.
