# Owner notes

The owner's running log, newest first, in plain English. Started fresh on
2026-11-05: everything from the old website builder was deleted, and the old
log (81,000 lines) is in git history.

## 2026-11-06: Desktop and phone apps, started

- The plan (owner: "start making the desktop apps and mobile apps … so we don't stay behind"): the apps are gofarther.dev in their own window, like Claude's desktop app is claude.ai. So every feature built on the site shows up in the desktop and phone apps at once, with no separate app updates. The apps add what only apps can: their own icon, menu and shortcuts, and later notifications.
- Phones, now: gofarther.dev can be installed from the phone's browser (iPhone: Share → Add to Home Screen; Android: menu → Install app). It opens full-screen with the GF icon, named Go Farther. Chrome's own check finds nothing stopping it.
- Desktop, built and tested here: coder/desktop (Electron, what Claude's and VS Code's desktop apps use). One window; the usual menu (copy and paste on a Mac need it); links to other sites open in the browser; GitHub's sign-in stays inside so Connect GitHub works; a small offline page; only notifications and copying allowed. Inside the app the page hides its "Download for Mac / Windows" buttons.
- A new button, "build desktop apps" (GitHub Actions), makes GoFarther-mac.dmg and GoFarther-windows.exe on GitHub's Mac and Windows machines. Free: the repository is public. By default it only keeps the files with the run; ticking "publish" makes a public release the front page's Download buttons can point to.
- Not signed yet: that needs the Apple Developer Program ($99 a year, also needed for the iPhone app) and, optionally, a Windows certificate. Until then the Mac asks once in System Settings → Privacy & Security → "Open Anyway", and Windows shows "Windows protected your PC" → More info → Run anyway.
- Next: the phone apps (Android first: it can be installed without a store; iPhone needs the Apple account). Google Play is $25 once.

## 2026-11-06: Environment matched to Claude Code's docs (1-7)

Checked against code.claude.com/docs/en/cloud-environments.
- 1. Four network levels, like Claude Code's: None, Trusted (the default list), Full, and Custom (your own sites, with an "Also include the default list" box). Older "Limited" settings read as Custom with the default list.
- 2. New repos start on Trusted, like Claude Code's Default environment (was Full). Repos already saved as Full stay Full. Approving "Allow this site?" on Trusted switches to Custom with the default list plus that site.
- 3. The default list is Claude Code's: about 160 sites (npm, PyPI, RubyGems, crates, Go, Maven, NuGet and other registries; GitHub, GitLab, Bitbucket; Docker and other container registries; Google Cloud, Azure, AWS; Ubuntu, Anaconda, HashiCorp, Datadog and more).
- 4. Sites with a saved secret stay reachable at every level, even None.
- 5. Keys are never sent to package registries, GitHub or Anthropic's API, even if a secret lists them.
- 6. The setup script gets about 5 minutes (was 10), and runs again when the script or the network setting changes, or after about 7 days, like Claude Code's cache.
- 7. More secret types: body parameter (added to JSON and form bodies), OAuth 2.0 client credentials (token fetched and renewed by the proxy), Google Cloud service account, and AWS SigV4 (each request signed; checked against AWS's own test examples).
- Coder's web_fetch follows the site list like any other request; the docs name only GitHub, connectors, sites with a saved secret and Anthropic's own API as skipping it. Grok's web search (on xAI's side) is unaffected.

## 2026-11-06: The Environment window, like Claude Code's

- The Environment button opens a window like Claude Code's "Edit cloud environment": four rows (Network access, Network secrets, Setup script, Environment variables), each with its own page, Back, Cancel and Save changes.
- Network access: None (no internet at all), Limited (package sites plus the sites you allow, `*.example.com` allowed) or Full.
- Network secrets: a list with remove, and an Add secret form: name, secret type, one or more websites (`*.` for subdomains), optional path prefixes, one or more headers (name, prefix, value), and a "resolved curl example". Coder never sees the values; Coder's own key card still works too.
- Setup script: a code box with Choose file (up to 64 KB) and copy.
- Environment variables: one box in .env format. Like Claude Code's, the values are shown again and are not for secrets.

## 2026-11-06: Live test fixes: no node_modules on the branch, paragraphs, commit titles

- Live test passed: the setup-script offer after `npm install` (card shown; Decline kept the script), no Review/Undo buttons in the top bar, "do a security review" used Coder's review tool, "undo that last job" reverted it, answers show bullet lists.
- Found and fixed: (1) a job's `npm install` put node_modules and npm's cache on the branch; installed packages and caches are now never committed (Python, Rust and Yarn ones too). (2) When Grok's answer came in two parts (before and after a web search) they ran together ("tips.- Keep"); now two paragraphs. (3) A job that ended with a card got a commit titled "proposed a new setup script"; it now uses what Coder said about the work.

## 2026-11-06: Fix: Coder offers installs for the setup script

- Live test: Coder ran `npm install` for a new package and finished without offering to add it to the setup script. Now, when a job ran an install the setup script doesn't do, Coder's app reminds it once before it finishes, and it offers the change on the approval card. Not for GitHub jobs.
- The fake Stripe test key was deleted from the test repo.

## 2026-11-06: Review and Undo are now things Coder does when asked; nicer answers

- The Review menu and the Undo button are gone from the chat's top bar. Instead Coder has two new tools it calls itself: "review" (code or security; it gets the branch's changes plus the checklist and answers with findings, changing nothing) and "undo_last_job" (the app reverts the last job's commit and pushes when the turn ends, like the old button). Just say "review my changes", "do a security review" or "undo that".
- Answers are formatted: bullet and numbered lists, small headings, bold, `code`, links, and source marks like [[1]] show as small numbered chips.
- Tested live: the setup-install offer (2) is checked in the next live run.

## 2026-11-06: Fix: Limited network crashed Coder's machine

- Live test: with Limited on, the first blocked request ("example.com") crashed the whole machine ("Coder's machine restarted"). A connection reset on a blocked site had no error handler. Fixed, plus a safety net so a network error can never stop every job again.
- Coder's tool output no longer shows Node's "experimental" proxy warning.
- Live so far: effort picker ✓ (Low/Medium/High/Extra high, High selected); setup script saw no variable ✓ (var=[]); failed setup → Coder named the command and exit 127 and proposed a fixed script on the card ✓; Approve saved it ✓.

## 2026-11-06: Effort levels match xAI's docs

- xAI's reasoning guide (docs.x.ai/docs/guides/reasoning) lists Grok 4.7's efforts as low, medium, high (its default) and xhigh. The picker now offers Low, Medium, High and Extra high, and starts on High like xAI (it was Medium, and Extra high was missing). The landing page chip says High.

## 2026-11-06: Environment like Claude Code's (1-5)

- 1. The setup script can no longer read the owner's variables or keys (it runs with neither, like Claude Code).
- 5. A new approval card: Coder proposes an environment change with a tool (propose_env), the card shows exactly what would change, and nothing changes until the owner presses Approve.
- 2. After Coder had to install something every chat needs (npm ci…), it proposes adding it to the setup script on that card.
- 3. When the setup script fails, Coder is told the exit code and output, says which command failed, and proposes a fixed script on the card.
- 4. Network access per repo, in the Environment panel: Open (any public site, as before) or Limited (package sites like npm, PyPI, GitHub, plus the repo's list, plus sites with saved keys). A blocked request tells Coder, which asks "Allow Coder to reach this site?" on the card. Where the machine allows it, a firewall makes the proxy the only way out; where it doesn't, the list still covers tools that use the proxy setting, and Coder is told which.
- None of this can be proposed from GitHub jobs.

## 2026-11-06: Last audit item: keys stay hidden even if removed mid-job

- Each job's key values are kept sealed until the job ends, so its saved chat still hides them if the owner removes the key while the job runs.

## 2026-11-06: Audit #3 fixes (secrets and the latest changes)

- The key middleman can no longer be crashed by a bad request (bad port, broken request, odd characters); before, one bad request from Grok's commands could stop every chat on that machine.
- Keys only go in real key headers (Authorization, or names ending in Key/Token/Auth/Secret), never in ones a website copies back like Origin or Host. The card now shows how the key is sent. If a website copies the key into its answer's headers anyway, that header is dropped before Grok's command sees it.
- Keys must be plain characters (no spaces, no accents); "Basic" keys get the trailing colon Stripe-style APIs expect.
- The memory file is handed to Grok's user through the already-open file, so a swapped-in link can no longer trick root into giving away a protected file. Leftover commands from an earlier job are stopped when a new job starts.
- Jobs from GitHub can't ask for keys, and never get the "welcome back" recap (it would be posted publicly).
- @coder on a pull request from a fork no longer tries to use the fork's branch.

## 2026-11-06: Fix: Coder pops up the key card instead of explaining

- Live test: asked to check a Stripe balance with no key saved, Grok told the owner to export a variable instead of opening the card. Its instructions now say to call request_secret right away and never to give set-up steps for keys.

## 2026-11-06: Secrets that Coder never sees (like Claude Code's network secrets)

- When a job needs an API key (Stripe, OpenAI…), Coder asks with a new tool, request_secret, and a card pops up in the chat: "Coder needs a secret for api.stripe.com", a box for the key, Decline / Save. Nothing is shown anywhere until Coder asks.
- The key is saved sealed with the repo's environment (Coder's storage, never GitHub, never the chat). On each job, a small proxy on Coder's machine adds it to HTTPS requests for that one host. Grok and its commands never have the key: they just call https://api.stripe.com/... and the proxy fills it in.
- Not given to jobs started from GitHub (@coder, auto-fix), same as the variables. If a key ever shows up in output, the saved chat shows [hidden].
- Saved keys appear in the Environment panel only as host names, with x to remove one.
- Works for curl, Python, git and most tools; Node's own fetch only when it honours the proxy setting.

## 2026-11-06: @coder jobs show a short label in the chat

- Retest found the chat showing Coder's whole safety wrapper for an @coder comment. It now shows "@you on GitHub: what you asked", like auto-fix's short label. Coder still gets the full, wrapped text.

## 2026-11-06: Coder's file tools can open its own memory file

- In the retest, saving or forgetting a style showed a red "error" step: the read tool only opens files inside the project, and Coder's memory file is kept outside it (so it never reaches GitHub). Coder fell back to the shell and finished, but it looked broken. Now read, write and edit may also open that one memory file, nothing else outside the project, and never through a link.

## 2026-11-05: Fix: pictures stay for the whole job

- Full retest found it: since the audit change "pictures go to Grok once", a job that read files first and described the picture at the end had lost it, and Grok invented one ("a teal square with a robot"). Pictures now stay for every step of the job (like Claude), and leave only the saved history afterwards. Costs a little more per job with a picture; correctness first.

## 2026-11-05: Saved styles followed strictly (like Claude Code's output style)

- Live test: "always keep it short" was saved in memory but a new chat only half-followed it. In Claude Code a chosen output style is its own setting with its own instructions, not a memory note. So now Coder saves a style as one memory line starting "Style:", and those lines are given to it as their own "THE OWNER'S STYLE" section right after its main instructions, overriding the default. "Forget it" deletes the line.

## 2026-11-05: How Coder talks (its main instructions rewritten)

- On your word, Coder's system prompt has a new "HOW YOU TALK" part: it leads with the answer; short and plain by default; shows evidence ("npm test: 12 passing", the error line), never "all tests pass" without the command; adapts to whatever you ask ("explain…", "teach me…", "keep it short", or any style you describe) for the rest of the chat, and if you say "always" it saves that style in its memory for the repo.
- From the Claude Code docs: comments in code only where the code is not obvious (or when asked); pull request descriptions say what changed, why, how it was checked and any risks; and when you come back to a chat after 2+ hours it starts with a one-line recap.
- No fixed style picker (your call: "more customizable, whatever the user asks").
- Default style is EXPLANATORY (your word): after the result, Coder explains what it changed and why, with an "Insight:" line for non-obvious choices. "Keep it short" / "less explaining" switches to the brief style.

## 2026-11-05: Noted for later: buttons → tools the model calls

- Your word: features like Review, Security review (and similar front-end buttons such as Undo) should become TOOLS that Coder calls itself when you ask in the chat ("review my changes"), not front-end buttons. Parked for later.

## 2026-11-05: Live test of the edge cases (recorded)

- Gloopy tab shows "Coming soon." Security review ran and found nothing serious, with reasons.
- Auto-fix off switch: with it Off, a failing check on pull request #5 started no fix for 3 minutes; switched back On.
- Binary files: read and edit both refused with "is a binary file (not text); use bash".
- Web fetch to local addresses (localhost, cloud metadata, a disguised IPv6 loopback): Grok refused to even try, twice; our own block was checked against real addresses on a machine earlier.
- Not tested live (covered by the automated tests): a 1 MB write (it would cost a lot of Grok output), fork protection (needs a second GitHub account), the 3-tries limit (Coder fixes on the first try), Undo overlap (Undo always reverses the newest job). Finishing GitHub connect needs you (Disconnect → Connect on your account).

## 2026-11-05: Live test of the rest (recorded)

- CODER.md: Coder added one with a rule ("End every answer with: -- checked by Coder") and every later answer in that chat followed it.
- Memory per repo: told to remember "the owner's favourite colour is teal" in one chat; a brand-new chat answered "Teal." without opening files.
- Comments on diff lines: a comment on the workflow's node-version line ("use Node 22") was done exactly.
- Workflows permission works: Coder added .github/workflows/test.yml.
- Auto-fix from a failed check: Coder opened pull request #5 with a deliberate bug; GitHub's check failed; within seconds Coder fixed it, ran the same test (passed) and updated #5.
- Small fix: the chat line for an auto-fix now shows the real reason ("Auto-fix: The check "test" failed") instead of the safety label.

## 2026-11-05: @coder on a pull request works on that pull request's branch

- Live test: `@coder` on pull request #4 did the job in a new chat on a new branch, so the change would not have shown in the pull request. Now, on Coder's own pull request, @coder continues the chat that owns its branch; on anyone else's pull request (same repo, never a fork), a new chat starts from that pull request's branch.

## 2026-11-05: Full live test, and the landing-page text fix

- Recorded live run on gofarther.dev (test account, real Grok and GitHub): every tool worked (todo, glob, read, write, edit, grep, lsp diagnostics, bash, background job + check + stop, web fetch, Grok's web search), the question buttons (Coder then fixed the type error), Environment (setup ran; GREETING set but never printed), pictures (a clear picture read exactly; a faint one was misread by Grok), @file, Review (real findings), a pull request from the chat (#4), See changes, Undo (Revert commit), and the Remove box.
- Found: what you type on the landing page is not carried into the chat box after sign-in. A fix was made, then reverted on your word ("not worried about the landing page thing").

## 2026-11-05: Audit #2 fixes (1, 2, 5, 6, 10, 11, 12)

- **1. Forks can't trigger auto-fix.** A failed check counts only for a pull request inside the repo itself (not a fork, whose branch could be named like Coder's) and only on Coder's own latest commit. Reviews on fork pull requests are ignored too.
- **2. GitHub text can't steer Coder.** Issue, pull request, review and CI-log text is wrapped and labelled as untrusted data; Coder is told never to reveal secrets and that its answer is posted publicly. Jobs started from GitHub get the setup script but NOT your environment variables, and variable values are replaced by [hidden] in saved chats (so they can't reach GitHub).
- **5. Web fetch** blocks every private/local address in all its written forms, and checks the address at the moment it connects (no swap between checking and fetching).
- **6. GitHub connect is tied to your browser** (a random value in a cookie must match), so a link made by someone else can't attach your GitHub to their account. Reconnecting another GitHub account or disconnecting clears the old login, and @coder checks the login still belongs to that account.
- **10. Pictures go to Grok once** per message, not on every step.
- **11. Big writes** (up to about 1 MB) go through a file instead of the command line; read/edit refuse huge files (20 MB / 5 MB) and binary files with a clear message.
- **12. Two @coder comments** each keep their own record; chat ids are 8 random characters and never reuse an existing chat or branch.

## 2026-11-05: Tool steps: option A without colours

- You chose option A without the colours (renders in the chat). Every step now shows a grey icon for its tool (terminal, file, pencil, magnifier, folder, code brackets, globe, eye, square, gear), a dark verb (Ran, Read, Edited, Searched…), the target in code type, and on the right ✓, "✕ error" or "running". Not deployed yet.

## 2026-11-05: Live test: auto-fix from a review

- You left a review (Comment) on testingforclaude pull request #3: "rename notes.txt to notes.md, add a title, delete setup-ran.txt". Coder picked it up by itself, did all three on the branch, and pull request #3 was updated (checked on GitHub: notes.md with "# Notes", no notes.txt, no setup-ran.txt).
- On your own pull requests GitHub only allows "Comment" (not "Request changes"); Coder treats both the same.

## 2026-11-05: Auto-fix finds older chats too

- Chats made before Coder recorded whose branch is whose (e.g. the @coder chat on testingforclaude) are now found by their branch name, so auto-fix works on their pull requests too.
- Live: Review worked (it even flagged the setup file that was being committed, the bug fixed just before). Pull request #3 on testingforclaude is ready for the auto-fix test.

## 2026-11-05: Live retest, and setup files kept off the branch

- Live on gofarther.dev (test account): the picture was described correctly, "Ran setup" showed and its file existed, the variable was there (Coder refused to print it: "that variable is a secret"), @README.md was read first, and the message showed once.
- Found and fixed: files the setup script makes were being saved to the branch (an `npm ci` would have committed node_modules). They now go in the git folder's own ignore list, so only Coder's real changes are saved.

## 2026-11-05: Fix: pictures said "too big"

- The live test found that attaching a picture always said "That picture is too big": the page's safety rules block the way it was read. It is now read another way (allowed by those rules).

## 2026-11-05: Auto-fix pull requests

- On your word ("4"): when a check fails on a pull request from one of Coder's branches, or YOU review it (changes requested, a comment, or a line comment), Coder posts "working on a fix (try N of 3)" on the pull request, reads the failed run's log (GitHub Actions), fixes it in that branch's chat, and the comment becomes the result. If the cause is not in its changes, or the review is unclear, it explains instead of changing code.
- At most 3 tries in a row; your own message in the chat starts the count again. Reviews from other people and bots are ignored (they cannot spend your Grok). An "Auto-fix: On/Off" switch sits next to the pull request link.
- Needs on the GitHub app: Checks read-only, Actions read-only, and the events "Check run" and "Pull request review".

## 2026-11-05: Environment per repo

- On your word ("14"): an "Environment" button in the chat's top bar. Per repository: a setup script (e.g. `npm ci`) that runs as the limited user when Coder's machine first opens the repo, and again only when you change it ("Ran setup" in the chat, with its output); and variables (e.g. a test API key) that Coder's commands can use. Values are sealed like the GitHub key and never shown again (only names). Names that steer the machine (PATH, HOME, LD_*, NODE_OPTIONS, CODER_*) are refused.

## 2026-11-05: Review and Security review

- On your word ("5"): a "Review ▾" button in the chat's top bar with "Review changes" (bugs, edge cases, missing tests) and "Security review" (injection, secrets, auth, XSS…). Coder compares its branch with main, runs tests if there are any, changes nothing, and answers with a short list of findings with file, line and a fix. The request is written on the server. `@coder review this` on GitHub works too.

## 2026-11-05: Pictures and @files in the chat

- On your word ("16"): attach a picture with the paperclip in the chat box, or paste one (up to 4 a message, made smaller first). Grok sees it with that message; the saved history keeps only a note, so chats stay small. Your message shows the picture.
- Type `@` in the chat box: the repo's file names are suggested as you type; pick one with Enter or a click. Coder is told to read the files you pointed at.

## 2026-11-05: Live test: @coder, Undo, the locked control panel

- `@coder say hi and list the files in this repo` on canias7/testingforclaude issue #2: gofarther-coder [Bot] answered, the job ran on Coder, and within a minute the bot's comment became "@canias7 Done." with Coder's answer. The first try was refused because the test account had not opened Coder since the deploy (its email was not saved yet); opening Coder once fixed it.
- Undo on the live site: the branch on GitHub got a "Revert …" commit and the file was gone.
- Normal chats still work with the control panel locked.

## 2026-11-05: Undo last job

- On your word ("add 2"): each Coder job that changes files is one commit. An "Undo last job" button (top bar, next to See changes) asks first in Coder's own box, then reverses that commit with a new "Revert …" commit and saves it to the branch. Nothing is force-overwritten; you can undo several jobs in a row. Coder is told, so it knows the change is gone. If later changes touch the same lines, it says it cannot undo cleanly and changes nothing.

## 2026-11-05: @coder in GitHub comments

- On your word ("yea lets do it"): on an issue or pull request in a repo Coder can use, comment `@coder do X`. GitHub notifies gofarther.dev (signed with CODER_GITHUB_WEBHOOK_SECRET; anything unsigned is refused).
- Only a GitHub account that was connected to Coder, by a Coder account on CODER_USERS, can wake it. Anyone else gets a polite "only works for accounts that connected…" and nothing runs. Bots never wake it.
- Coder replies "On it" as **gofarther-coder[bot]** (signed with the app's private key, CODER_GITHUB_APP_PRIVATE_KEY, app id 5620754), runs the job like a chat (it shows in your Recents), and every minute the Worker checks for finished jobs and replaces "On it" with what Coder did: its answer, the branch and a link to open a pull request (or the pull request, if you asked for one). A question from Coder shows its options; answer with `@coder <choice>`.
- One chat per issue/PR: the next `@coder` in the same thread continues it.
- The deploy now needs the two new secrets (it stops if they are missing) and the Worker has a once-a-minute timer.

## 2026-11-05: Audit, the two critical fixes

- Coder's machine has a control panel (start, finish, push, stop). It is now locked: only our server, which gives the machine a key made from CODER_TOKEN_KEY, can use it. The AI's commands cannot read that key, so they cannot start extra Grok jobs or take over a job's end.
- A repo's CODER.md is read safely: never through a link, only a plain file, size-capped. (A repo could have made CODER.md a link to a system file holding the xAI key.)
- The unused "export files" feature is deleted (the audit found it could be tricked into reading root's files). The memory file can no longer freeze a job.

## 2026-11-05: Ask, Monitor and LSP added to Coder

- On your word ("add AskUserQuestion, monitor, lsp"):
  - **ask_user**: when Coder truly cannot choose, it asks one question with 2 to 4 buttons and stops. Your tap is sent as the next message.
  - **Background jobs**: bash with run_in_background gives a job (job1…); **monitor** reads its newest output and says if it still runs; **stop_job** ends it. In the chat: "Checked job1 …", "Stopped job1 …".
  - **lsp**: real language servers (TypeScript/JavaScript and Python) for definition, references, hover (type) and diagnostics (errors). "Looked up diagnostics server.js". Coder's machine now installs typescript@5, typescript-language-server and pyright (TypeScript 7 lacks the piece the server needs).
- Audit item fixed with it: everything the AI's user starts (even with &) is killed when a job ends, on Stop, before the push, and before a new job prepares the files.
- Small fix: glob no longer lists .git.

## 2026-11-05: Web search is now Grok's own (no free search)

- One test call (the "test grok search" button) showed Grok's own web search works next to Coder's tools, about half a cent per search (that call cost 78,280,000 xAI "ticks", which we think is about $0.008 in all; check xAI's console).
- On your word ("yes"), Coder now talks to Grok through xAI's Responses request with web search turned on. Grok searches by itself when it needs current facts or docs; each search shows in the chat as "Searched the web for …" with the pages it used. The free DuckDuckGo search is gone.
- Coder's chats and history are unchanged: Coder turns them into the new request and back.

## 2026-11-05: A test button for Grok's own web search

- You said no free search, and to test Grok's own. New workflow "test grok search": you press it, it makes ONE paid Grok call with web_search next to one of Coder's tools, and prints the answer, the tools used and the usage. The key is never printed.

## 2026-11-05: Coder gets Claude Code's tools

- On your word ("you can add all of this"), Coder now has read, edit, write, grep, glob, web_fetch, web_search and a todo checklist, besides bash and pull_request. The file tools run as the same limited user as bash and only inside the project (not .git, not through links). Web fetch reads public pages only (never the machine itself or private networks).
- In the chat they show as their own lines ("Read server.js", "Edited server.js", "Wrote README.md", "Searched \"listen\""), and the checklist shows as a Plan box with ticks.
- Web search uses a free search page (DuckDuckGo). From cloud machines it is often refused, so it may answer "no results". A reliable one needs a search service key (Brave Search has a free tier) that you would type in yourself.

## 2026-11-05: Coder reads CODER.md only

- On your word ("we not doing claude md we doing coder md"): Coder now reads only a repo's CODER.md for its instructions. CLAUDE.md and AGENTS.md (other tools' files) are ignored.

## 2026-11-05: Empty repositories get a main branch first

- Live test result: in the empty repo, Coder's branch became the only branch, so the pull request had nothing to merge into. On your word ("create main automatically"), Coder now makes the main branch first in an empty repository (one empty "Start" commit), then works on its own branch, so pull requests work. That is the only time Coder writes to main, and only when the repo has nothing in it.
- A repo that has branches but no main gets a clear message instead of a git error.
- canias7/testingforclaude still has only the coder/… branch from the test (no main). Easiest: delete that repo and make a fresh empty one, or set its default branch on GitHub.

## 2026-11-05: Live test: empty repositories now work

- The live test on canias7/testingforclaude failed with "could not clone … couldn't find remote ref main": that repo is empty (no files, no branches). Coder now opens an empty repo, starts on its own branch, and pushes it when it makes something. A pull request needs a main branch on GitHub to compare against, so in an empty repo add one first (e.g. a README on GitHub).

## 2026-11-05: Test account allowed

- On your word, cristiananias7@gmail.com (your throwaway test account) may use Coder, for a live test on gofarther.dev. Remove it from CODER_USERS in coder/wrangler.jsonc when testing is done.

## 2026-11-05: Ask Coder for the pull request in the chat (option B)

- The Create pull request button is gone. Say "make a pull request" in the chat: Coder (Grok) looks at the changes and writes the title and description, and our server opens it after the job, once the work is saved to GitHub. If one is already open, it is updated instead. Coder still never holds your GitHub key.
- Coder has a second tool for this (pull_request) next to bash. It is told to use it only when you ask.

## 2026-11-05: The / commands removed

- On your word ("some are there already as buttons"): every / command already had a button, so the / menu is gone. Typing / is now just normal text to Coder. The chat box no longer says "/ for commands".

## 2026-11-05: Two failed deploys, fixed

- The deploy's tests failed twice on GitHub's machine: git printed warnings there, and Coder mistook them for changed files. Coder now reads only git's answer, not its warnings, and a job with nothing new ("hi") sends nothing to GitHub. The third deploy went live: landing page, Create pull request button, and the walk-through fixes.

## 2026-11-05: Recorded walk-through, and two fixes it found

- I ran the real Coder page, routes and machine on my side (GitHub, sign-in and the AI were stand-ins, so it cost nothing) and recorded the whole flow.
- Fixed: a job that changed nothing (like "hi") said "Saved to the branch" and offered Create pull request. Now only real changes do.
- Fixed: what you type on the landing page is now waiting in Coder's chat box after you sign in, and Sign in no longer shows "Create account".

## 2026-11-05: Pull requests only when you press the button (option A)

- Coder no longer opens a pull request by itself. After each job it saves its work to its own branch on GitHub ("Saved to the branch coder/…"). A "Create pull request" button appears next to See changes; press it when you are happy. `/pr` does the same.
- Once a pull request is merged or closed, Coder forgets it, so the button comes back for the next one (this also fixes audit item 1).

## 2026-11-05: Download for Mac / Windows back on the front page

- On your word, gofarther.dev has a landing page again like the old one: Go Farther and Sign in on top, the two black "Download for Mac" / "Download for Windows" buttons (look only, "Coming soon"), and the big ask box (Grok 4.7, Medium). Sign in, or sending from the box, opens the sign-in card. On a phone the download buttons shrink to the two logos.

## 2026-11-05: Coder's own "Remove chat?" box

- Removing a chat showed the browser's own grey popup. Now Coder shows its own white box with Cancel and a red Remove button. A test checks the page uses no browser popups anywhere.

## 2026-11-05: Claude may press the deploy button

- You removed the rule that only you press workflow runs. Claude now runs deploy coder itself when you say deploy. Deleting things still needs your word each time.

## 2026-11-05: Audit fixes, Worker side

- A chat can no longer stay stuck on "working": if Coder's machine lost the job, the chat is freed at once with a note; if the machine stops answering, it is freed after 15 minutes. Stop also frees it.
- The end of a job (push to GitHub, pull request) now happens once, even with two tabs open.
- The chat list no longer loses chats when two change at once (each chat keeps its own record now).
- Smaller: full account id in machine names, a check on the repo's main branch name, Delete allowed through the page's safety rules.
- Then done too: the page checks less often after errors and says "Coder's machine is not answering. Still trying…" after 5 misses; each chat keeps at most about 400 KB of conversation (oldest dropped first); Coder checks its time limit before every command.

## 2026-11-05 — First real try failed; fixed; no container limit

Your first real "hey how are you" showed "Coder could not open canias77777/gfujgvkhbkjblu". The live version allowed only **1 container in total**, and each chat needs its own, so Cloudflare almost certainly refused to start one. The error also dropped the reason.
- **No limit on chats at once** (your word "no limit"). Cloudflare needs a number, so the total is set to **100 containers**, with **no per-person limit**. Each container sleeps after 10 minutes, so it only costs while working. The setting `CODER_MAX_RUNNING` puts a per-person limit back when Coder opens to others.
- **The real reason now shows** when a chat cannot start, or when the AI call fails.
- **The effort safety net:** if Grok refuses the effort setting, Coder asks again without it.

Coder's tests: 25 of 25.

## 2026-11-05 — Browser work moved to the server

On your word "remove the stuff that are browser stuff and put it server side":
- **Sign-in** now goes through Coder's Worker (`/api/auth/signin`, `verify`, `signup`, `refresh`, `logout`). The page no longer holds Supabase's address or key, and may only talk to its own address.
- **The model list, your model and effort pick, and the slash commands** come from the server. Your pick is kept on your account, not in the browser.
- **What each slash command does** is worked out on the server (`/api/coder/command`). The page only opens what the answer says.
- **Comments on the changes** are sent as they are, and the server checks them and writes them into the message.

Coder's tests: 24 of 24. Not live until "merge and deploy" and **deploy coder**.

## 2026-11-05 — Six Claude Code features added to Coder (7, 14, 15, 20, 21, 25)

- **Several chats at once (7):** each chat has its own container. Up to **3 chats per person** can work at the same time, and a 4th waits with "3 chats are already working". Cloudflare allows up to 6 containers in all.
- **The repo's own rules (14):** if the repo has a `CODER.md`, `CLAUDE.md` or `AGENTS.md`, Coder reads it at the start of every turn and follows it (up to 20,000 characters).
- **Memory between chats (15):** each repo gets a memory file. Coder adds a line when it learns something lasting (how to run the tests, your preferences), and every chat on that repo starts with it. It's kept in Coder's storage (`memory/<repo>.md`), not in your repo, up to 25,000 characters.
- **Comment on the changes (20):** in **See changes**, tap a line, write a comment and press Add. It waits as a chip above the box and goes to Coder with your next message, naming the file and line.
- **Long commands in the background (21):** a command still running at its time limit is no longer killed. It keeps running, its output goes to a log, and Coder is told where to read it. The chat shows "running in the background".
- **Slash commands (25):** type `/` for a menu: /new, /repos, /changes, /pr, /stop, /effort, /model, /remove, /help. They run in the page and never use the AI.

Coder's tests: 23 of 23. Not live until "merge and deploy" and **deploy coder**.

## 2026-11-05 — delete old stuff, second press (run 2): Neon and the old app gone

- **Deleted:**
  - the old app Worker **isibi-app** (the queue was unhooked from it first);
  - the queue **site-builds**;
  - the **gofarther-sites** folder;
  - Supabase **media**;
  - **all 48 Neon databases**, each named in the log.
- **Already gone from the first press:** gofarther-front, the 101 site Workers, the KV stores, avatars and the branches. The warnings about these are only "not found".
- **Still emptying:** **113 storage buckets** (isibi-sites, gofarther-files and the gfs-… ones) still had files. Their 1-day expiry rules from the first press still stand. One more press after 04:00 UTC on Nov 6 deletes them.

## 2026-11-05 — Supabase cleaned: only sign-in left

On your "go", I deleted all 32 old tables and every old database function in Supabase. Afterwards: **0 tables, 0 functions left; 14 accounts kept**, untouched. Sign-in still works the same, because it lives in Supabase's own sign-in area, which nothing referenced.

Still left: the second press of **delete old stuff** (after 04:00 UTC on Nov 6) and Neon (press **list old stuff** first).

## 2026-11-05 — Chats: each one its own session, in a Claude-app sidebar

From the four layouts, you picked B in the Claude-app style ("yes like this").
- **Left side:** a rail with the agents (Coder, Gloopy), then Coder's column with **New chat**, **Repositories**, **Recents** (your chats), and your account at the bottom. The gear opens Sign out.
- **Each chat is its own session**, with its own history, branch and pull request. Two chats on the same repo are two pull requests. A chat's title is its first message.
- **Recents:** an orange dot means Coder is working there, and **#12** means it has a pull request. Hover a chat and tap × to remove it from the list (its branch and pull request stay on GitHub).
- **New chat** asks which repo. **See changes** now works for real: it reads what the pull request holds from GitHub, with no AI.
- **On a phone**, ☰ slides the sidebar in.
- The old top bar is gone, and the chat's own bar shows its title, repo, branch, pull request and See changes.
- Coder still has **one container**, so only one chat runs at a time.

Coder's tests: 19 of 19. Not live until "merge and deploy" and **deploy coder**.

## 2026-11-05 — Coder's chat: the Claude-app look (approved)

From your screenshot of the Claude app, you approved this look ("ok good"):
- your messages in a light grey bubble;
- each command as a quiet "Ran … ▸" line, and several in a row grouped as "Ran 3 commands ▾" in one box;
- a failed command marked "exit 1";
- Coder's answer as plain text;
- the model and effort ("Grok 4.7 · Medium") under the message box.

On the branch, not live yet. It goes out with the next "merge and deploy" and **deploy coder**, together with the removal of `ask` and `done`.

## 2026-11-05 — Coder's `done` tool removed too

On your word "delete the done", Coder has **one tool: `bash`**. It finishes the way a person would: it stops running commands and writes its answer in plain words. That answer gets the green ✓ in the chat and becomes the pull request's description, and the work goes to GitHub as before. Coder's tests: 18 of 18. Not live until "deploy coder" is pressed again.

## 2026-11-05 — Coder's `ask` tool removed

On your word "delete the ask", Coder now has two tools: **`bash`** (any Linux command) and **`done`** (finish, and the work goes to GitHub as a pull request). When a choice is open, it picks the sensible one and says which in its summary. If it truly can't go on without you, it says what it needs in its summary. The question buttons are gone from the chat. Coder's tests: 18 of 18. Not live until "deploy coder" is pressed again.

## 2026-11-05 — Coder is live at gofarther.dev; most of the old app is gone

- **delete old stuff (run 1):** deleted the sites Worker, 101 site Workers, the 2 builder containers, 2 KV stores, 152 branches, Supabase `avatars` and every file in `media`, and 1 bucket. The 112 site buckets still had files: each is set to empty within a day, and a second press deletes them. Its log did not confirm the old app Worker, the `site-builds` queue, or the `gofarther-sites` and `media` folders. The old app is gone, though: Coder could take its address.
- **deploy coder (run 3):** Coder now holds gofarther.dev, www and coder.gofarther.dev. Its single container is set.
- **gofarther.dev had no address record** after the old app was deleted. The new **fix gofarther.dev** button detached and re-attached the two addresses (run 2), and all three now answer.
- GitHub connected (your sign-in reached `?github=connected`).
- Left: the Supabase tables (your "go"), the second delete press tomorrow, and Neon (list, then delete).

## 2026-11-05 — The delete button, with every item named

From the **list old stuff** run, the **delete old stuff** button removes, by name:
- the old app Worker and the sites Worker;
- 101 site Workers and their folder;
- the 2 old builder containers, the `site-builds` queue and the 2 KV stores;
- the site storage buckets (`isibi-sites` and every `gfs-…`);
- the Supabase file storage (`media`, `avatars`);
- 152 old branches.

**Kept, on your word:** the Workers nutri, teacher-grade-api, isibi-ai and agent-builder-api, plus the `agent-runs` queue they may use, and the gofarther.app domain.

Neon is next: the list couldn't read it (my mistake, fixed). The Supabase tables wait for your "go".

Coder: a single container (`max_instances` 1).

## 2026-11-05 — Everything old removed from the branch; the delete button next

On your word "delete all the old stuff":

- **On the branch (done):** the old notes and preferences are replaced by these fresh files. The old traces are gone from Coder's files: comments about the website builder, the old sign-in name and an extra route. The deploy button no longer uses an old builder secret. Coder's token key now comes from Coder's own GitHub client secret, so it no longer depends on old secrets.
- **Outside (next, by buttons you press):** the old app and customer-site Workers, their storage, the Neon databases, the old Supabase tables, the old GitHub branches and the old secrets.

## 2026-11-05 — Coder so far

- GitHub App **gofarther-coder** registered. Coder's Worker is deployed at coder.gofarther.dev, switched on for your two accounts only.
- gofarther.dev will be Coder: a sign-in screen, then the tabs on the left (Coder, and the Gloopy agent "coming soon"), then Coder's chat.
- The chat uses style B: plain command lines, a green or red dot, and the output in grey. The model picker offers Grok 4.7 with Low, Medium or High effort.
- Not live yet: it needs "merge and deploy", then the delete button, then **deploy coder**.
