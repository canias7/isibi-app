# Everything Coder has (gofarther.dev)

The full list, numbered, for testing one by one (owner, 2026-11-07: "lets make
an entire list of everything we have"). Each item: what it does, how we test
it, who tests it, and where it stands. "Me" = Claude, through GitHub (no
sign-in needed). "You" = on your own screen, at gofarther.dev or an app.

Status words: **Passed**, **Failed** (then fixed and tested again), **To test**.

---

## A. Signing in and the page

1. **Sign in with your password, then the emailed code** (both steps, every time).
   Test: sign out (gear, Sign out), then sign in again. Who: you. Status: To test.
2. **Only allowed accounts** (`CODER_USERS`) can use Coder, and it's free while testing.
   Test: nothing to do (checked by the automatic tests). Status: Passed (automatic tests).
3. **The page:** the left rail (Coder, and Gloopy "coming soon"), New chat, Repositories, Recents (your chats), and the gear (Notifications, Sign out).
   Test: look around; open and remove a chat in Recents. Who: you. Status: To test.
4. **Install it like an app** (Home Screen on a phone, or "Install" in Chrome on a computer).
   Test: add gofarther.dev to your Home Screen. Who: you. Status: To test.

## B. GitHub

5. **Connect GitHub** with Coder's app, choosing which repositories it may use.
   Test: Repositories, "Add repositories on GitHub". Who: you. Status: To test.
6. **Open any public repository** by `owner/name` or its address; one you can't push to is read-only (item 5 of the list). Who: you. Status: To test.
7. **Your GitHub login never enters Coder's machine** (git goes through Coder's server with a short pass).
   Test: a job clones and pushes. Who: me. Status: To test.
8. **`gh` works with your login**, only for the chat's own repositories; `gh pr` and `gh issue` are refused (GitHub's GraphQL), `gh api repos/...` works (item 6).
   Test: ask Coder to list the repository's issues with `gh api`. Who: me. Status: To test.

## C. Chats

9. **New chat on a repository**, on its own branch `coder/<chat>`; Coder never touches your main branch.
   Test: start a chat, ask for a small change. Who: you. Status: To test.
10. **Pick the starting branch** before the first message. Who: you. Status: To test.
11. **Several repositories in one chat** (up to 3 more), added before the first message. Who: you. Status: To test.
12. **Pick the environment** before the first message. Who: you. Status: To test.
13. **Model and effort picker** (Grok 4.7: low, medium, high, extra high). Who: you. Status: To test.
14. **Pictures and @ files**: paste or attach a picture; type @ to point Coder at a file. Who: you. Status: To test.
15. **Stop** a running job. Who: you. Status: To test.
16. **A job keeps going when you close the tab**, and the chat is saved as it goes (a lost machine keeps its steps).
    Test: send a long task, close the tab, come back later. Who: you. Status: To test.
17. **Question cards**: Coder asks up to 4 questions in one card (your pick 4, live since 2026-11-08), each with choices, Other and sometimes several picks; one Submit sends all the answers. Who: you. Status: To test.

## D. Coder's machine

18. **One machine per chat** on Fly.io (4 CPUs, 16 GB); it sleeps when quiet, keeps its disk, and wakes on your next message. Who: me. Status: To test.
19. **Claude Code's tools**: Python, Node, Ruby, PHP, Java, Go, Rust, C/C++, Docker, PostgreSQL, Redis, Chrome, Playwright and more. Who: me. Status: To test.
20. **Admin sandbox**: `sudo` works for anything inside it, and `apt-get install` works; the machine itself stays safe.
    Who: me. Status: **Passed** (live test, 2026-11-07: `sudo whoami` = root, cowsay installed).
21. **The sealed network room**: all of Coder's internet goes through the gate that follows your network setting. Who: me. Status: To test.
22. **A copy of the repository that failed is made again** (the bug the live test found). Who: me.
    Status: **Passed** (2026-11-07, issue #9: the files and git came back). The test found one leftover, now fixed (live since the 2026-11-07 deploy): the setup's own file in that chat was pushed as Coder's work.

## E. Environments

23. **Named environments**, with a Default made for you; rename and archive. Who: you. Status: To test.
24. **Setup script**: runs on a new machine; system packages install as admin.
    Who: me. Status: **Passed** (live test, 2026-11-07: the script ran).
25. **The environment's saved copy of its setup**: the next new chat starts from it and skips the setup (item 1 of the list).
    Test: two new chats in one environment. Who: me. Status: **Failed** (2026-11-07, issues #10 and #11: the second chat started before Fly.io had finished the first chat's copy; Coder tried it anyway and quietly used an empty disk). Fixed (live since the 2026-11-07 deploy): only a finished copy is used, the chat says when a copy can't be used and why, and the copy is of the disk as the setup left it. To test again (one chat makes the copy; once Fly has finished it, a second chat skips the setup).
26. **Network access**: None, Trusted (Claude Code's list, with the "www." sites), Full, or your own allowed sites (item 7).
    Who: me. Status: To test.
27. **Variables** (settings every command sees). Who: you. Status: To test.
28. **Secrets**: keys Coder's server adds to requests for a site; they never enter the machine. Coder can ask you for one with a secure card. Who: you. Status: To test.
29. **Coder proposes environment changes** (allow a site, a setup script, a new environment); you approve. Who: you. Status: To test.

## F. How Coder works

30. **Its tools**: read, edit, write, search, the code helper (lsp), commands, web pages and web search, background commands, a to-do list. `read` also opens pictures (a screenshot Coder takes, say), PDFs by page, and Jupyter notebooks (your pick 1, live since 2026-11-08). Who: me. Status: To test.
31. **Instruction files**: `CODER.md` (or `AGENTS.md` when there's no CODER.md), rules in `.coder/rules` for some paths only, a subfolder's own file; plus a memory kept between chats (item 10). Who: me. Status: To test.
32. **Security check on each edit**: a warning to Coder when it writes risky code (item 12). Who: me. Status: To test.
33. **Review and Security review** of the chat's changes (the buttons, or ask Coder). Who: you. Status: To test.
34. **Long chats summarized**, not cut; `/compact` with what to keep (item 3). Who: you. Status: To test.
35. **Rewind**: code and chat, chat only, code only, Summarize from here, Summarize up to here (item 9). Who: you. Status: To test.
36. **Undo the last job** (ask Coder). Who: you. Status: To test.

## G. Saving work

37. **Each job is committed and pushed** to Coder's branch. Who: me. Status: To test.
38. **See changes**, with **Compare against** any branch, and comments on lines for Coder (item 4). Who: you. Status: To test.
39. **Create PR / Create draft PR** (buttons, or ask Coder). Who: you. Status: To test.
40. **Read-only repositories**: the work stays on Coder's machine, See changes shows it, **Download patch**, no pull request (item 5). Who: you. Status: To test.

## H. GitHub automation

41. **@coder in an issue or pull request comment**: Coder answers there.
    Who: me. Status: **Passed** (live test, 2026-11-07, testingforclaude #9).
42. **Auto-fix** a pull request: off until you turn it on (button, or ask Coder); fixes failed checks and your reviews; answers in a review thread (item 2). Who: you. Status: To test.
43. **Code review**: per repository (Repositories screen: when it runs, and Quick / Standard / Deep); `@coder review`, `@coder review always`, `@coder review stop`; comments on the lines with 🔴 🟡 🟣, a summary, a check (item 11).
    Who: me. Status: To test. (Automatic reviews on every pull request also need two GitHub settings, in your notes.)

## I. Notifications and apps

44. **Notifications** on a phone or computer, with Claude Code's two switches; never about a chat you're looking at; tapping one opens the chat (item 8). Who: you. Status: To test.
45. **Desktop app notifications** while the app is open. Who: you. Status: To test.
46. **Desktop app** for Mac and Windows (the build button). Who: you. Status: To test.
47. **Phone app** for Android (and iPhone, simulator only until there's an Apple account; the build button). Who: you. Status: To test.

## J. Behind the scenes (covered by the automatic tests)

48. Your Grok key never enters Coder's machine; each machine has its own lock; your keys' values are hidden in the chat; the code is never stored with us (only on GitHub and the chat's machine).
49. The buttons on GitHub: deploy, the machine's image check, the desktop and phone builds, and the old app's cleanup (which needs your word each time).
50. 207 automatic tests, plus 18 machine-admin tests, run before every deploy.

---

## Not possible yet (needs you)

- **App Store and Google Play**: your own developer accounts (Apple $99 a year, Google $25 once).
- **Notifications inside the phone app**: the same accounts (Firebase for Android, Apple's push for iPhone). Until then, use gofarther.dev from the Home Screen.
- **Automatic code reviews on every pull request**: in GitHub's settings for the gofarther-coder app, tick "Pull request" events and set "Checks" to read and write.
