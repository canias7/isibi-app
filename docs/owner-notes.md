# Owner notes

The owner's running log, newest first, in plain English. Started fresh on
2026-11-05: everything from the old website builder was deleted, and the old
log (81,000 lines) is in git history.

## Waiting on you (noted 2026-11-06, your word: "Note it, i will do it later")

- **Delete the "gofarther-ml" tunnel in Cloudflare.** It linked the old open AI model server (Ollama) to model.gofarther.dev. Its address is already deleted, so nobody can reach it, but the computer running it is still on. In Cloudflare: Zero Trust, Networks, Tunnels, gofarther-ml. Its Connectors tab shows which computer it runs on. Delete the tunnel, and stop Ollama on that computer if you don't need it.
- Optional: turn on leaked-password protection for Coder's sign-in in Supabase.

## 2026-11-07: The two small problems, fixed (on the branch, not deployed yet)

- Your word: "fix this".
- **The setup script runs whole.** Environment takes a script up to 64 KB, but Coder's machine ran only its first 20,000 characters. Now both use one shared limit of 64 KB, so whatever Environment accepts runs in full. Test CD149: a 40,000-character script's last line runs. It fails on the old code.
- **The README says what Coder does now.**
  - Coder pushes its branch after each job. A pull request opens only when you press Create PR or Create draft PR, or ask for one. The old text said it opened one after every job.
  - Coder has many tools. The old text said bash was its only one.
  - A job's start gets 8 minutes, not 3.
  - The setup script never gets your saved keys or variables. The old text said it could use the keys.
  - The project file (CLAUDE.md) had the same "one tool" line; fixed too.
  - Test CD150 checks these lines against the code.
- 159 tests pass.

## 2026-11-07: Admin for anything, in a sealed sandbox (on the branch, not deployed yet)

- Your word: "finish this", about the comparison's line "Claude Code's commands run as full admin. Coder's run as admin only for installing programs, starting services and using ports 80 and 443."
- **What Coder can do now, like Claude Code:**
  - install, remove or upgrade any package;
  - change any system file;
  - start any service;
  - use any port;
  - run any command with `sudo`.
  - The setup script runs this way too.
  - `apt-get`, `apt` and `service` need no `sudo` typed.
- **How it stays safe:** Claude Code keeps its keys and network rules outside its machine; on Fly.io ours are inside the same machine. So Coder's commands run in a sealed sandbox inside the machine:
  - **Inside:** they have admin for anything.
  - **Outside:** that admin is an ordinary, unknown user. It can't leave the network room or change its network. It can't see or stop Coder's own service, read its keys, or touch the machine's own files.
- **What the sandbox is:**
  - **Its system:** the machine's own image, read-only.
  - **Its changes:** a layer on the chat's work disk. What Coder installs stays while the machine sleeps, and a new Coder version starts it fresh.
  - **Your project files:** they stay owned by Coder's ordinary user, so saving to GitHub and Docker work as before.
- **One small difference from Claude Code:** commands run as Coder's own user and use `sudo` for admin, rather than running as admin all the time. Otherwise files Coder makes in your project would be admin's.
- **Checked:**
  - **Fly.io's machines can run it:** your comment at 09:59 showed kernel 6.12, sandboxes allowed, and the overlay system there.
  - **The real test, run as admin here:** admin for anything; dpkg's folder renames; your files stay Coder's user's; the machine's files untouched; the room can't be changed or left; only its own processes and folders are visible; a stop ends everything; installs kept for the next job, and started fresh with a new version. The deploy runs this test as admin too.
  - **GitHub's image check:** it now makes Coder's real image a disk, as on Fly.io, and tries the sandbox there: apt install and remove, a system file, PostgreSQL, port 80, Docker, every tool and the network wall.
- If a machine can't have the sandbox, Coder works as before, with the master key's jobs, and is told which.
- Tests: CD147 (real) and CD148, plus older checks updated. 157 pass.

## 2026-11-07: Coder compared with Claude Code's docs again (after today's work)

- Your word: "before we anything, let compare all we have to claude code docs please".
- The three cloud pages were unchanged since this morning's comparison. This time I also read the pages on GitHub, code review, memory, rewind, scheduled tasks, Projects, the phone app, Remote Control and security checks.
- **Now matching, since this morning:**
  - the machine (4 CPUs, 16 GB, and more disk than Claude Code's 30 GB);
  - Ubuntu with all of Claude Code's tools;
  - installs and services mid-job;
  - the network setting as a real wall.
- **Still partly:**
  - the setup cache is per chat;
  - the setup runs as admin only for apt lines;
  - admin during a job is limited to the master key's jobs;
  - auto-fix details;
  - long chats are cut, not summarized;
  - no compare-to-another-branch;
  - only writable repositories;
  - `gh` is installed but not logged in;
  - "www." sites are missing from the Trusted list;
  - the apps aren't published;
  - Rewind can't do code-only or conversation-only;
  - no AGENTS.md;
  - no automatic review on every pull request;
  - no security checks while writing.
- **Still missing:**
  - permission modes;
  - sending a message while Coder works;
  - share, archive and rename a chat;
  - a prefilled link;
  - a link back to the chat in commits;
  - helper agents, hooks, connectors, skills and plugins;
  - terminal and Remote Control;
  - Projects;
  - scheduled tasks;
  - phone notifications;
  - ultrareview.
- **Still open from this morning:**
  - the setup script is cut at 20,000 characters, though settings take 64 KB;
  - old README lines say Coder opens a pull request after each job, that the setup script can use saved keys, that bash is its only tool, and that a start gets 3 minutes (it's 8 now).

## 2026-11-07: Live test passed: the whole 20 GB system disk, admin rights, the sealed room

- Your comment at 09:41, answered at 09:46:
  - `df -h / /.fly-upper-layer`: **20 GB** on both. The system disk grew from 7.8 GB to the 20 GB Fly.io gave it.
  - Coder's service has every admin right (`CapEff 000001ffffffffff`), including the one the grow needs.
  - `ip -br addr`: only `lo` and `tap0`, so the commands are inside the sealed room (this chat's network is Full).
- **Now proven live on Fly.io today:**
  - the tools;
  - installing a program mid-job;
  - Grok through Coder's server (no key on the machine);
  - each machine's own lock key;
  - 4 CPUs and 15 GB;
  - a 10 GB work disk;
  - the 20 GB system disk;
  - the sealed room, also after a restart;
  - GitHub jobs that start from the every-minute check.
- **Not tried live yet:** a chat whose network is Trusted or None, where the room has no internet link of its own. GitHub's check proved it in the real image. To see it live, set testingforclaude's network to Trusted and run the curl again; it should print 000.

## 2026-11-07: Deployed: the disk grow finds Fly.io's disk

- Your word: "merge and deploy". Main b46f9a3b, run 42359923774, every step passing, the machine image rebuilt.
- **Live checks:** the site answers, and the app refuses anyone not signed in.
- **Next:** your test comment, which checks the disk size and the admin right the grow needs.

## 2026-11-07: The fifth test: the sealed room works live; the disk grow missed its disk (now deployed)

- Your comment at 09:17 was answered at 09:21, after the new image's first download.
- **The room works on Fly.io now:**
  - Coder's commands see only their own loopback and `tap0`, not the machine's `eth0`.
  - The room is real (`nsfs`).
  - `tap0` is the room's own internet link, which Coder only adds for the **Full** network setting. So this chat's environment is set to Full, and the direct request's 200 is right.
  - Under Trusted or None there is no `tap0` (GitHub's check showed 000 in the real image). To see it live, set testingforclaude's network to Trusted.
- **The disk still showed 7.8 GB.** Your next comment (09:24) showed why: Fly.io names that disk `/dev/vdb[/upper]` (a folder on the disk), and Coder's start-up step expected exactly `/dev/vdb`. It took that for "no disk to grow" and did nothing. The disk is 20 GB, ext4, and resize2fs is installed.
- **The fix:** read the disk's name without the folder (`findmnt --nofsroot`, and anything in brackets dropped), and write what it did in the machine's log.
  - Tried here on a test disk mounted the same way. This sandbox refuses the grow itself because it lacks one admin right, `CAP_SYS_RESOURCE`, which Fly.io's machines should have. The next test checks that right on the machine too.
- Test: CD146 now uses Fly.io's own way of naming the disk. 155 pass.

## 2026-11-07: Deployed: the sealed room after a restart, and the whole 20 GB system disk

- Your word: "merge and deploy". Main 1056ea0c, run 42357874840, every step passing, the machine image rebuilt and sent to Fly.io.
- **Live checks:** the site answers, the app refuses anyone not signed in, and the Grok address refuses a request with no pass.
- **Next:** your test comment. The first start fetches the new image, so it may take a few minutes.

## 2026-11-07: The sealed room after a restart, and the whole 20 GB system disk (now deployed)

- Your fourth comment (08:42) confirmed both causes:
  - `/run/netns/coder-room` was a plain file left on the kept disk, made at 08:21. The machine had restarted at 08:33, so the room was gone. No gate relay was running.
  - Fly.io's disk for the machine's own changes is 20 GB, but the filesystem on it is 7.8 GB.
  - Coder refused to print its proxy address in a public reply. That was right.
- **Fix 1, the room:** a room now counts only if Coder can actually get into it. If only the name is left after a restart, Coder removes it and makes the room again. So every job is inside the wall again.
- **Fix 2, the disk:** when Coder's machine starts, it grows the filesystem to fill the 20 GB disk Fly.io gave it, while in use, the way cloud machines do at boot. It never holds up the start; anything unexpected, and it does nothing. The full image now lists e2fsprogs (which has the tool for this) explicitly.
- Tests:
  - The real room test, run as admin with real network namespaces, now includes a restart that leaves only the name. It fails on the old code and passes on the new one.
  - GitHub's machine check runs the same restart in Coder's real image.
  - CD146 covers the disk.
  - 155 in all pass.
- This changes the machine image, so the deploy rebuilds it (about 13 minutes). Each chat's machine then gets it the next time it wakes.
- **GitHub's machine check passed** (run 42356997602, in Coder's real image). Every tool works, and the room is sealed for Trusted, None and Full. After a restart that left only the room's name, the room was made again: no direct internet, and npm reachable through the gate.

## 2026-11-07: The third test: almost everything works live; the sealed room is not in use

- Your third comment (08:32) was answered at 08:35, all five commands run.
- **Works live:**
  - Coder reaches Grok through its server, so the machine has no AI key.
  - Every tool is "ok".
  - `apt-get install figlet` worked mid-job with the master key.
  - The machine has 4 CPUs and 15 GB of memory, the new size.
  - The work disk is 10 GB.
  - Coder answered within 3 minutes.
- **Not working:** `curl --noproxy '*' https://example.com` printed 200. Under the default setting (Trusted) the sealed room should block that.
  - Your follow-up (08:37) showed why: Coder's commands see the machine's own network card (`eth0`). In the room they would see only their own loopback. So the room isn't being used on Fly.io, and commands run as before step 3 (only a guard for tools that use the proxy).
- **Likely cause:** on Fly.io the machine's own disk is kept while it sleeps, and the place where the room's name lives (/run) is kept with it. After a restart the name is still there but the room is gone. Coder sees the name, thinks the room exists, can't get into it, and falls back to no room.
  - It worked in the GitHub check because that machine is always fresh.
  - A follow-up comment checks this before the fix.
- **The system disk:** `lsblk` shows a 20 GB disk mounted for the machine's own changes (`/.fly-upper-layer`), so the 20 GB did arrive. `df` reports 7.8 GB for `/`; the follow-up also checks which of the two Coder's installs really use.

## 2026-11-07: Deployed: the Grok pass fix

- Your word: "ok". Main 33f8a97d, run 42355635500, every step passing. The machine image didn't change.
- **Live checks:** the site answers, the app refuses anyone not signed in, and the Grok address refuses a request with no pass.
- **Next:** your third test comment on testingforclaude #2.

## 2026-11-07: The second test: the start fix worked, and a step 1 slip found (now deployed)

- Your second test comment (08:19:59) got "On it" in 4 seconds. The job started at the next minute's check, and the comment was updated at 08:22. So the start fix works live.
- **But the job failed:** "The AI could not be reached: no AI key in Coder's container".
- **Why:** Coder's server sent the machine two things under the same name, `model`: the pass to Grok (step 1), and then the model's name, which replaced the pass. So the machine had no pass, and it no longer has its own key, by design.
  - The earlier tests checked each part on its own. One test even expected the name to be sent as `model`, so the clash slipped through.
- **The fix:** only the pass goes as `model`. The machine reads that same field for the model too. Coder has one model (Grok 4.7), so the machine picks it, at the effort you chose.
  - The fix is only in Coder's server, so the 7 GB machine image doesn't need rebuilding.
- New test CD145 follows a message from the app all the way to what the machine reads: its Grok pass, then Grok 4.7 at the chosen effort.
  - It also fails if `model` is ever sent twice again.
  - It also fails if a second model is added before the model's name gets its own field.
- 154 tests pass.

## 2026-11-07: Deployed: bigger machines and the GitHub start fix

- Your word: "ok" (to merge and deploy).
- Main c6f4a3fb, run 42354646813, every step passing. The machine image didn't change, so it wasn't rebuilt.
- **Live checks:**
  - the site answers;
  - the app refuses anyone not signed in;
  - the Grok address refuses a request with no pass;
  - GitHub's address refuses an unsigned call.
- **Next:** your new test comment on testingforclaude #2. It adds `nproc && free -g`, to show the 4 CPUs and 16 GB.

## 2026-11-07: Why your test comment stayed at "On it", and the fix (now deployed)

- Your word: "you do it" (look into the stuck test).
- **What happened:** when a GitHub comment comes in, Coder answers GitHub straight away and posts "On it". Cloudflare then gives Coder only 30 more seconds to finish what it's doing. Starting your job took minutes, because the machine first had to download the new 6.9 GB toolbox. So Cloudflare cut it off before Coder had written down "come back and update this comment". Nothing was left to update it, so it will stay at "On it".
- I couldn't open the chat to look: the test account's saved browser sign-in had expired, and signing in again would send an email. The reason above comes from Cloudflare's own documentation (the 30-second limit) and from the code. Your test comment was never answered at all, which only happens when that note is missing.
- **The fix:** Coder now writes the note first, together with the message it has to send. The every-minute check, which Cloudflare lets run for 15 minutes, starts the job and keeps watching it. Your comment gets "On it" at once, and the job starts within a minute.
  - If starting fails, Coder says why in place of "On it".
  - It's never started twice, even when a start is slow.
  - Two @coder comments on the same chat start one at a time, as before.
  - Auto-fixes start the same way.
- Test: CD144, plus the GitHub tests updated (153 in all).
- After the deploy, comment on testingforclaude #2 again. The old "On it" comment won't change.

## 2026-11-07: Bigger machines on Fly.io (now deployed)

- Your choices: "4 CPUs, 16 GB" and "Grow to 50 GB". For Cloudflare, "it wont be off", so Cloudflare's backup containers stay as they are.
- **Why:** each chat had 2 of Fly.io's "shared" CPUs and 4 GB. Fly slows a shared CPU to 1/16 of a CPU after a short burst, and a shared machine's disk is 4 times slower. So installs, builds and tests crawled.
- **Now each chat gets:**
  - 4 full-speed CPUs and 16 GB of memory, the same as Claude Code's machine;
  - a work disk that starts at 10 GB and grows by itself, 10 GB at a time when it is 80% full, up to 50 GB.
- **Cost:** about $0.25 an hour while a chat is working, instead of $0.035. A machine stops after 10 quiet minutes. A sleeping chat's work disk is $0.15 per GB a month, so only chats that use the extra room pay for it.
- **If Fly.io has no room for the size:** that chat gets the size from before, so it still works. It tries the big size again with Coder's next version.
- **Chats made before:** they get the new size the next time they wake, never in the middle of a job. Like a new Coder version, this starts the machine's own disk fresh; the chat's files on its work disk stay.
- Tests: CD143, plus the Fly.io tests updated (152 in all).

## 2026-11-07: Deployed: all of Claude Code's tools, and steps 1 to 4

- Your word: "merge and deploy". Main 3a9bbb3d, run 42349243500, all steps passing.
  - The tests ran first, including the room's admin-only test on GitHub's machine.
  - Fly.io's shared keys were removed.
  - The big machine image was built once and sent to Fly.io.
- **Live checks:** the site and health check answer. Coder's git address refuses a request without a pass. The new Grok address refuses a request with no pass and with a made-up pass. The app refuses anyone not signed in.
- **Waiting:** your test comment on testingforclaude #2 (the network wall, check-tools, installing figlet mid-job, the disks).

## 2026-11-07: Before deploying: the first start after the deploy is given time to fetch the big image

- Your word: "merge and deploy".
- Coder gave a machine 60 seconds to answer. A machine being made or updated first fetches the new image, about 6.9 GB, which can take longer. So the first chat after the deploy could have failed with "did not answer".
- Now a machine being made or updated gets 5 minutes, and a plain wake still gets 1 minute. A job counts as lost only after 8 minutes, so a start is never given up on while its machine may still be fetching.
- Test: CD142 (151 in all, plus 16 admin-only).

## 2026-11-07: Step 4 of 4: the master key's everyday jobs (on the branch, not deployed yet)

- Your word: "ok go with the rest".
- **What Coder can do now, mid-job, like Claude Code:**
  - install any Ubuntu system program (`apt-get install`, also written `sudo apt-get install`), with no setup-script card and no restart;
  - start, stop and restart any installed service;
  - use ports 80 and 443 inside its own room.
- **How:** Coder's commands may run exactly one program as admin. It checks every request:
  - only package names, never an apt option (some apt options would run any command as admin);
  - only installed services, and only start, stop, restart, reload or status.
  - Anything else is refused with a plain message.
- With a limited network, its downloads go through Coder's gate too, so your setting holds.
- **Honest limit:** this is not the whole master key. Editing system files, or any other admin command, would need a full container system with the machine's disk mirrored for it. That's a multi-day job with real risk, so it's not done. Removing packages is also refused: removing something like git would quietly break how Coder saves your work.
- Tests: the GitHub machine check installs a program as Coder's own user, starts Redis, serves on port 80 in the room, and checks that `sudo bash`, `apt-get remove`, a trick apt option and a sneaky service name are all refused (150 tests in all, plus 16 admin-only).
- **The GitHub machine check passed** (run 42348124083):
  - As Coder's own user, `apt-get install figlet` and `sudo apt-get install` installed and ran it.
  - `sudo service redis-server start` started Redis (it answered PONG) and it stopped again.
  - Everything else was refused.
  - A server on port 80 worked in the room.
  - The room stayed sealed for every network setting.

## 2026-11-07: Step 3 of 4: the sealed room, so your network setting is a real wall (on the branch, not deployed yet)

- Your word: "ok go with the rest".
- **Why:** on Fly.io, Coder's old wall (a firewall rule matched by user) cannot work: Fly.io's machines lack the kernel piece it needs. So the network setting was a guard that ordinary tools follow, not a wall.
- **Now Coder's commands run in a sealed room:** a network of their own, owned by Coder's program, with only one way out: a pipe to Coder's gate, which checks your network setting. With Full access, the room also gets its own internet link. The AI has no rights over the room's network, so it cannot open another way out. A change of setting reaches the room at once.
- If a machine can't make the room, commands run as before, and Coder is told the list is then only a guard.
- **Tried for real here, as admin:**
  - The pipe to the gate works.
  - Everything else is sealed: the machine's other services, the internet over IPv4 and IPv6, direct website requests.
  - Every attempt by an ordinary user to change the room's network is refused, including slipping into the machine's own network.
  - Full access turns the room's link on, and off again.
- The deploy now runs that test as admin. The GitHub machine check also tries the room in Coder's real image, with the real gate and real websites, for each setting: None, Trusted and Full.
- Tests: CD140 and CD141 (150 in all, plus 16 admin-only).
- **The GitHub machine check passed** (run 42347544465), in Coder's real image with the real gate and real websites:
  - Trusted: going straight to the internet is blocked, a site not allowed is refused, npm is reached.
  - None: going straight to the internet is blocked, a site not allowed is refused, npm is refused too.
  - Full: the room's own link is up and reaches the internet, and switching back takes it away.
  - "THE ROOM: SEALED".

## 2026-11-07: Step 2 of 4: each chat's machine has its own lock key (on the branch, not deployed yet)

- Before: one lock key opened every chat's machine's controls. On Fly.io a machine can be reached from the internet, so a chat that ever read its own key could have worked another chat's machine.
- Now each Fly.io machine's key is a strong code made from Coder's secret and that machine's own name. Knowing one machine's key gives nothing for another's.
- Machines made before this keep the old key until their next update, so a deploy never locks out a job that is running.
- Fly.io itself no longer keeps any of Coder's keys: the deploy removes the shared copies.
- Cloudflare's backup machines keep the old key: they cannot be reached from outside.
- Tests: CD139, and the Fly.io tests now check that each machine gets its own key (148 in all, all passing).

## 2026-11-07: Step 1 of 4: your Grok key never goes to Coder's machine (on the branch, not deployed yet)

- Your word: "ok", to the plan: 1. the Grok key out of the machine, 2. each machine its own lock key, 3. a sealed room for Coder's commands whose only door to the internet is Coder's gate (this makes your network setting a real wall on Fly.io), 4. the master key inside that room, like Claude Code.
- **Found while checking:** Fly.io's machines lack the kernel piece Coder's firewall rule needs (a Fly.io forum thread from 2026-10-12). So on Fly.io your network setting (None, Trusted, Custom) is probably a guard that ordinary tools follow, not a wall. Your GitHub login and saved keys are not affected: they are added outside the machine. Step 3 fixes this. The test comment you were given will show it for sure.
- **Step 1, done:** each job gets a short pass for its AI calls, for one chat, one message and 3 hours. The machine sends every Grok call to Coder's server with it. The server checks the pass, allows only Coder's own model, and adds your key. Fly.io's machines and Cloudflare's backup machines are no longer given the key, and the deploy removes the copy Fly.io has.
- Tests: CD137 and CD138 (147 in all, all passing, plus the 14 admin-only safety tests). The machine check on GitHub passed again with this change (run 42345836203).

## 2026-11-07: All of Claude Code's tools on Coder's machine (on the branch, not deployed yet)

- Your word: "can we install all the tools we need?", about this line of the comparison: Claude Code comes with Python, Node, Ruby, PHP, Java, Go, Rust, C/C++, Docker, PostgreSQL, Redis, Chrome, gh and more.
- **The machine is now Ubuntu 24.04, the same system as Claude Code's machine, with the same tools.**
  - Python (uv, poetry, pytest, mypy, black, ruff), Node 22 and 24, Ruby 3.1, 3.2 and 3.3, PHP 8.3, Java 21 with Maven and Gradle, Go, Rust, C/C++.
  - Docker, PostgreSQL 16, Redis 7, Chrome, and gh, yq, tmux, vim, nano.
  - The same `check-tools` command that lists them all.
- **Plus what Claude Code's real machine has beyond its docs** (your word: "ok", after "anymore tools missing?"):
  - ffmpeg (video and audio), ImageMagick (images), pdftotext, pandoc.
  - Python's document and data libraries (Excel, Word, PowerPoint, PDF, numpy, pandas).
  - Playwright with its own browser, for scripted browser tests and screenshots.
  - Debugging tools: strace, lsof, valgrind, netcat.
  - Left out on purpose: Google Cloud's tools (useless without a Google login on the machine), Nix (rarely needed), and LibreOffice: the full image is about 5.2 GB without these extras and about 6.7 GB with them, and LibreOffice would bring it near Fly.io's 8 GB limit, leaving too little room for what chats install.
- **The machine's own disk may now grow to 20 GB** (Fly.io's default is 8 GB, and the full image alone is about 6.9 GB). With the chat's 10 GB disk that is 30 GB, the same as Claude Code's machine. Fly.io bills a sleeping machine's disk only by what is used, so this costs nothing unless it is used. If Fly.io ever refuses the setting, the machine is made as today.
- **The first check on GitHub** (before the extras): every tool worked as Coder's own user except Docker running a container, because on the test machine Coder's home sat on the image's layered disk. On Fly.io it sits on the chat's own plain disk, so the test now does the same.
- **Fly.io's machines get the full set; Cloudflare's backup machines keep a small image.** Cloudflare's limit is 8 GB an image and 50 GB in all.
- **Coder still never has admin rights.**
  - Docker runs as Coder's own user ("rootless").
  - The two databases start with the same commands as on Claude Code's machine (`service postgresql start`). Coder may run exactly those through the admin's `sudo`, and nothing else.
- **Coder's commands have a home folder of their own.** What they install for themselves, and every download cache, go there. Before, the home was the project folder itself, so a cache could have been saved to your branch. On Fly.io the home is on the chat's kept disk, so it survives sleep and new versions.
- **Coder is told what its machine has,** like a developer who knows their computer.
- **A deploy builds the big image only when the machine changes.** It takes a while; otherwise a deploy stays as quick as now.
- **A new check runs on GitHub whenever the machine changes on a branch.** It builds both images and tries every tool as Coder's own user. It deploys nothing and uses no secrets.
- **Costs:**
  - A sleeping chat's machine costs about $0.15 a month per GB of its image on Fly.io. That's about $0.70 a month instead of about $0.25 (my estimate).
  - A brand-new chat's first start will be a bit slower.
- **The check on GitHub passed** (run 42342573805): both images build, Coder's service starts in both, and every tool works as Coder's own user, Docker included. Things it installs for itself land in its own home. The full image is about 6.9 GB.
- Tests: CD133 to CD136 (145 in all, all passing, plus the 14 admin-only safety tests).

## 2026-11-07: A deploy no longer resets the chats' machines for nothing

- Your word: "merge and deploy". Before that deploy: every deploy gave Coder's machine a new version name, even when nothing in the machine had changed. Each chat's machine then started its own disk fresh on its next wake and ran its setup again.
- Now the name changes only when Coder's machine itself changes (its folder, `coder/container`). A deploy of anything else, like these notes or the website, leaves the machines and their kept disks as they are.
- This deploy changes the name once, so each chat's machine starts fresh one last time.
- **Deployed** (your word: "merge and deploy"): main 52dba3d5, run 42336015163, all steps passing. The machine's version is now `coder-2cb107d3b512`, named after its folder. The site and Coder's health check answer, and Coder's git address still refuses a request without a pass.

## 2026-11-07: Your GitHub login stays off Coder's machines; a sleeping machine keeps what it installed (like Claude Code)

- Your word: "Do 1 and 3", from the comparison with Claude Code.
- **1. Your GitHub login never goes to Coder's machine now**, like Claude Code ("GitHub credentials ... never enter the session VM").
  - The machine gets only a short pass for its chat, valid for one message and 3 hours.
  - Its git goes through Coder's server, which checks the pass and adds your login on the way to GitHub.
  - Git can read the chat's own repos, and push only to the chat's own branch. It can never delete a branch or push a tag. The one exception is the very first commit of an empty repo's main branch, which Coder makes when it opens one.
  - Tested for real on a computer, with git's own GitHub-style server standing in for GitHub: it read and saved through Coder's server, and the stand-in only ever saw your login, added by the server. A push to main, a deletion and a tag were all refused.
- **3. A sleeping machine keeps its whole disk**, so what the setup installed is still there and the setup doesn't run again, like Claude Code. This uses Fly.io's own setting for it. If Fly.io ever refuses the setting, the machine is made without it and the setup runs again, as before.
  - A new Coder version still starts the machine fresh, as Claude Code does after its cache expires.
  - The machine now reports whether its disk was kept, so I can check it live.
- Tests: CD130 to CD132. 141 in all, all passing, plus the 14 admin-only safety tests.
- **Deployed** (your word: "Merge and deploy"): main df610f55, run 42333195974, all steps passing. Coder's git address refuses a request without a pass.
- **Live test 1, saving through Coder's server:** you wrote `@coder add a line saying "fly test" to notes.md` on testingforclaude issue #2 at 03:30:22. The machine woke with the new version, and the commit "Added `fly test` to `notes.md`" was on the chat's branch at 03:30:57. That could only have gone through Coder's server, because the machine no longer has your login. The machine reported `"kept": false`, as expected the first time after a new version.
- **Live test 2, the kept disk:** the machine went to sleep by itself at 03:42:47. Your next comment at 03:44:37 woke it, and it reported `"kept": true`: its whole disk was kept while it slept, so the setup didn't run again, like Claude Code. Coder answered at 03:45:57, about 1 minute 20 seconds, the fastest yet. Before this change a woken machine took about 1 minute 45 seconds, and the first job on a new machine about 2 minutes 20 seconds.

## 2026-11-07: Deployed: Coder's machines on Fly.io, and the chat saved as it goes

- Your word: "Merge and deploy". You made the Fly.io account and saved its token in GitHub as `FLY_API_TOKEN`.
- Merged into main (9421b902) and deployed (run 42325783438). Every step passed, including the tests on GitHub and the admin-only safety tests.
- **On Fly.io:** the app `gofarther-coder-machines` was made, with its internet address and Coder's keys. Coder's machine was built and sent to Fly.io. The site now runs chats' machines on Fly.io (checked in the deploy's log).
- Also live now: jobs keep going when you close the tab, the machine hold, and the chat saved as it goes.
- Checked from outside: the site is up with the new page. Coder refuses anyone not signed in, and its saving address refuses a sender without a job's pass.
- **One more safety step, deployed too:** each Fly.io machine is always given its lock key directly, and a machine without one answers nothing but its health check. Fly.io machines are on the internet, so the key is their only lock; before, it reached them only as a Fly.io secret. Your word: "Merge and deploy". Merged into main (75f65ec8) and deployed (run 42326567782), all steps passing, before the first chat on Fly.io. Tests: 138, plus the 14 admin-only safety tests.
- **Live test on Fly.io (2026-11-07):** you wrote "@coder say hi and list the files in this repo" on canias7/testingforclaude issue #2 at 02:21:35. Coder said "On it" 4 seconds later, made the chat's machine and disk on Fly.io, ran the job, and answered at 02:23:55, about 2 minutes 20 seconds in all, including making the machine: "Done. Hi @canias7. Files in this repo: README.md, notes.md, setup-ran.txt."
  - Checked from outside through Fly.io's front door: the machine answers as Coder's own, in Fly.io's Virginia region (iad). A request without Coder's key is refused ("not allowed"), so the lock works.
  - **It went to sleep by itself at 02:34:54**, about 11 minutes after the job ended (10 quiet minutes, then the every-minute check). Asleep, it costs only its disk.
  - **It woke up for the next message:** your second comment at 02:46:13 woke the sleeping machine. Coder answered at 02:47:58, about 1 minute 45 seconds in all, faster than the first job: "This repo currently has README.md, notes.md, and setup-ran.txt." The machine answers again on Fly.io's front door.
  - So it behaves like Claude Code's machines: one machine per chat, asleep when quiet, woken by your next message with its disk kept.

## 2026-11-07: Coder's machines can run on Fly.io (like Claude Code's VMs)

- Your word: "YES OPTION 2", then "OK LETS START THEN".
- **Each chat gets its own small VM on Fly.io:** 2 shared CPUs, 4 GB of memory and a 10 GB kept disk. It's made from the same Coder machine as today.
- **It stops after 10 quiet minutes, and its disk is kept.** Your next message starts it again; Fly says a stopped machine starts "well under a second", then Coder starts. A job that is working, or waiting to be saved, keeps it on.
- **Your files stay on that disk between messages:** the repo, Coder's changes, and the project's installed packages (like node_modules). The setup script runs again after a restart, which puts back its system packages.
- **Coder gives a machine its newest version only while it's asleep**, never during a job. The disk stays.
- **A machine unused for 30 days is removed with its disk**, like Claude Code's "reclaimed after a period of inactivity". Removing a chat removes its machine at once. Finished work is always on GitHub.
- **Cloudflare stays as the backup.** The deploy button has a new choice: machines on "fly" or "cloudflare".
- **Cost (Fly.io's prices):** about 3.5 cents an hour while a machine runs, and 15 cents per GB a month for each kept disk. A 10 GB disk is $1.50 a month while its chat is kept.
- Fly.io's front door cuts a request that is quiet for 60 seconds, so on long requests (a job's setup) the machine sends a small "still working" signal every 15 seconds.
- Not live yet. Waiting on you: a Fly.io account, its token in GitHub, then "merge and deploy".
- Tests: CD125 to CD129, 138 in all, all passing, plus the 14 admin-only safety tests.

## 2026-11-07: The chat is saved as it goes (like Claude Code)

- Your word: "Do this" (Coder only saved a job's chat when the job ended, so a machine that crashed mid-job lost that job's steps).
- **Now Coder's machine sends each job's new steps to Coder's server every 3 seconds**, and the conversation every 15 seconds. They are kept locked (encrypted) until the job is saved, then deleted.
- **If the machine is lost mid-job** (it restarted, went to sleep, or stopped answering), the steps so far stay in the chat. Your saved values are hidden, as always. A note says the job ended there and its unsaved file changes are gone. Coder is told the same, so your next message carries on from there.
- **Closing the tab right after sending is safe too.** Before, if you closed it while Coder was still setting up (the clone, the setup script), the job could run with nobody saving it, because Cloudflare stops a request whose tab is gone (the old builder's notes say the same). Now the chat counts the job as started before Coder's machine is asked to start it.
- This also fixes a setup script not being able to use your saved keys.
- Tests: CD118 to CD124. 133 in all, all passing. On the branch, not deployed.

## 2026-11-06: A job keeps going when you close the tab (like Claude Code)

- From your screenshots: item 1, "Closing the tab", which I had missed. Before, Coder's machine went to sleep after 10 minutes with no tab open, and the job was lost. A finished job was also only saved while a tab was open.
- **Now each job goes on a watch list when it starts.** Every minute, Coder's server checks each job on the list:
  - this keeps the job's machine awake;
  - when the job ends, the server saves it just as an open tab would: pushed to its branch, the chat kept, and Coder remembers it next time.
- A job comes off the list when it ends, or after 2 hours (a job works for 45 minutes at most).
- While Coder works, the message box says "Coder is working… you can close this tab".
- If a tab stays open while the job is saved somewhere else, it loads the saved chat by itself, with the "Saved to the branch" line.
- **Your question: how Claude Code does it.** Its jobs run on its own cloud machines. The chat history is kept on its servers, so the browser is only a window: "The session keeps running after you close your laptop, and you can check on it or steer it from any device." A machine pauses "after a few minutes without activity", with its files saved.
- **You were right: the old builder had it.** Its "container hold" asked the machine "are you still working?" just before it was put to sleep, and kept it on if so, with a time limit so a stuck one never ran (and cost) for good. Coder now does the same: the machine stays on while a job works (2 hours at most) or while a finished job waits to be saved (30 minutes at most), and sleeps as before otherwise. The every-minute check stays; it is what saves the job when no tab is open.
- Tests: CD112 to CD117. 126 in all, all passing.

## 2026-11-06: Deployed: audit items 3 and 4, and Coder like Claude Code

- Your word: "Merge and deploy". Merged into main (3d57f2b4) and deployed (run 42306004077), with the admin-only safety tests passing on GitHub too.
- Checked from outside, with no sign-in and no Grok: the page is up and has the new parts (Create PR buttons, Rewind, the branch and repository menus); the page sends the sign-in proof; Coder's API refuses anyone not signed in; the key adder refuses anything without a job's pass; model.gofarther.dev doesn't answer.
- **Everyone signs in once more, you too** (password, then the emailed code). Reload any Coder window already open (desktop app: View, then Reload; phone: close the app and open it again). Coder's machines pick up the new image for new chats within about 10 minutes.
- No recorded browser test this time: it would need a sign-in, which emails a code, and tests never send sign-in emails.

## 2026-11-06: Audit items 1, 2 and 4 done; Coder closer to Claude Code

- Your word: "Do 1,2,3,4", then "Finish all this" (about the differences from Claude Code's docs).
- **1. The open model server is gone.** Its address was deleted. It was the only one using its tunnel, and none of your Workers used it. Nobody on the internet can reach it now. The tunnel itself ("gofarther-ml") is still listed in Cloudflare, because GitHub's Cloudflare key can't delete tunnels. You can delete it there (Zero Trust, Networks, Tunnels), and switch off the computer that ran it.
  - "list old stuff" now also lists DNS records, tunnels, and which Workers use them. "delete old stuff" has a second word, DELETE MODEL SERVER, that deletes only this.
- **2. The old gofarther-ai project is stopped, and its data is kept.** Its 6 scheduled jobs are switched off (they were the only thing still using it; one deleted rows older than 90 days every night). The table that let any account mark a mail domain as its own is closed, and so is the one anyone could change. Its 21 working functions now answer "shut down" (the other 4 already did). Their code was saved first, twice, and the two copies were compared; you have it as a file in the chat. Nothing was sent from it since July.
- **4. The last gaps in Coder's machine are closed.** While Coder's app runs git, any other repository inside the project is moved aside and put back after, so git can't open one the AI made. A final check had found three more ways in; all three are tested now.
- **Like Claude Code (from the comparison with its docs):**
  - On GitHub, a stranger's @coder gets no reply at all. Auto-fix asks you first when a review comment is unclear. Coder's questions show their choices on GitHub (they showed "[object Object]").
  - **Create PR** and **Create draft PR** buttons in the chat bar, once the branch has work. Coder writes the title and description.
  - **Web pages are read by a separate reader.** It answers Coder's question from the page, so nothing hidden in a page reaches Coder itself. Pages up to 100,000 characters, each read once per 15 minutes.
  - **The starting branch** is picked under the message box before the first message, next to the environment.
  - **Review on the pull request:** when you ask, Coder posts its findings as comments on the pull request's lines.
  - **Rewind:** each of your messages has a Rewind button: restore the code and the chat, the chat only, or the code only. Code goes back by undoing the later jobs with new commits, never by deleting anything on GitHub.
  - **Network and key changes reach a job that is already running**, like Claude Code ("within about a minute"): every running chat on that environment gets them at once. A job started from GitHub gets the network setting, never the keys.
  - **Keys are added outside Coder's machine**, like Claude Code. Your saved keys' values no longer go to the machine. Its proxy sends each request for a keyed site to Coder's server with that job's own pass, and the server adds the key and sends it on (headers, body keys, OAuth, Google Cloud and AWS signing, the same as before). So nothing on the machine, even with admin rights, can read a key. It can only use one for its own sites, while its job runs.
  - **Several repositories in one chat**, like Claude Code: under the message box, before the first message, "+ Repository" adds up to 3 more of yours (each shows as a tag with ×). Each one gets its own folder next to the chat's first one, prepared and saved the same safe way, on the chat's branch in its own repository. Coder can work in all of them, and open a pull request in any of them. Rewind, Undo and See changes still cover the chat's first repository only.
  - Kept as they are: Coder reads CODER.md (your word: "we not doing claude md we doing coder md"), and only the setup script's install lines run as admin (safer than Claude Code's whole script).
- Tests: CD98 to CD111 and CD94b, plus the others above; 120 in all, passing. On the branch, not deployed.

## 2026-11-06: The emailed code is really required now (audit item 3)

- Your word: "Do 1,2,3,4". This is 3.
- **Both steps, every time.** Signing in is still your password, then the code we email you. What changed is that Coder's server now checks that both steps really happened on gofarther.dev before it lets anyone use Coder.
  - The password step gives the page a ticket that lasts 15 minutes. The code is only accepted with that ticket, for the same email. If it runs out, the card goes back to the password step and says "Start again".
  - The code step gives the session plus the server's own proof. The page sends the proof with every Coder call. Without it, Coder answers "Sign in again."
  - A new account also needs the emailed code.
  - The password check no longer leaves a spare session behind. Only that one is ended, never your other devices.
- **Three reviewers checked it. I fixed everything they found:**
  - **A gap around password resets is closed too.** Coder now remembers your password the first time you sign in after this ships (a scrambled copy that can't be turned back into your password), and later sign-ins must use that same password.
  - **If you ever change your password outside Coder** (Supabase's dashboard or a reset email), Coder will say "That email and password do not match." To fix it, delete one file in Cloudflare: R2, bucket `gofarther-coder`, `coder/<your user id>/signin-pin.json`. The next sign-in then remembers the new password.
  - **Wrong codes are limited:** 5 tries per email every 15 minutes. After that, the card says how many minutes to wait. A right code resets the count. A new password step doesn't. If the storage ever refuses the counting, sign-in still works.
  - **A short hiccup no longer signs you out.** If the sign-in service is busy or down when your session needs renewing, you stay signed in and Coder says to try again in a minute.
  - **What you were typing is kept.** When Coder sends you back to sign in, the text in the chat box (or a message that was on its way) comes back in the box after you sign in.
  - **Old Coder tabs reload by themselves.** A tab left open from before this change now moves to the new page as soon as you open a new one. Before this fix, it would have signed you out about once an hour.
- **No more stuck page.** When a session ends (you signed out on another device, for example), the page now goes back to the sign-in card, which says "Sign in again." It does this once, never in a loop. If the sign-in service can't be reached, you stay signed in and Coder says to try again in a minute.
- **After this goes live, everyone signs in once more, you too.** Sessions from before have no proof. That's expected. Also reload any Coder window that was already open (desktop app: View, then Reload; phone: close the app and open it again).
- No new design: "Sign in again." and the new messages appear in the sign-in card's usual message line.
- Tests: CD86 to CD89 (new file `coder/test/auth-proof.test.mjs`). CD13 and CD22 changed only where the ticket and proof are now needed. CD22 now also gives the account's id and the bucket, which the password step needs.
- On a branch, not deployed. Live after "merge and deploy".

## 2026-11-06: Audit item 4, first part: three reviewers checked the fix, and their findings are fixed

- Your word: "Do 1,2,3,4". Three reviewers checked the fix below. All 14 of their findings were right, and they're fixed. A few of their suggested methods were changed, and the reasons are in the record.
- **The AI's leftover programs are really stopped now.** A program that keeps restarting itself under a new number could survive the old stop and change files while the app was saving. Now the system stops all of the AI's programs at once. If that fails, the app doesn't touch the files.
- **Giving files to the AI's user can't be tricked.** If a folder was swapped for a link at just the wrong moment, files outside the project could be handed over. The app now holds each folder open while it works in it.
- **Nothing is left out without a word.** If a save skips a folder that has its own repository, the chat says "Not saved: …" and names it. A submodule the AI moved to a newer commit (like "update the theme") is saved again. The app reads the commit itself and never runs git inside that folder.
- **Faster saves on big projects.** Folders git ignores (like node_modules) aren't searched any more. On a test project with 176,000 files, that check went from 0.5 s to under 0.1 s. Handing the files over at the start of a job takes 0.6 to 0.9 s instead of 1 to 1.6 s.
- A folder nested too deep for the system no longer blocks a chat. The job still starts, and the save names the folder to delete.
- The app reads CODER.md and the memory file only if they're the AI's own plain files, never a second name for another file.
- **The deploy button now also runs the safety tests that need admin rights.** Before, it skipped them.
- 8 new tests (98 in all). They pass as admin, and as a normal user with the admin-only ones skipped. On the branch, not deployed.

## 2026-11-06: Audit item 4, first part: Coder's app can't be steered by the AI's files

- Your word: "Do 1,2,3,4". This is the first part of 4 (two of the root findings on Coder's machine).
- **A repository the AI makes inside a project is left alone.** Before every save, undo or branch switch, Coder's app looks for any folder in the project that has its own `.git`. Git never runs inside it and it's never saved, not even as a submodule. Everything else is saved as before. Repositories with ordinary submodules work as before, and a folder that is plain again (its `.git` removed) is saved again.
- **Project folders can't be swapped.** The folder holding all projects now belongs to the app, not to the AI's user. The app makes each project's folder itself and gives only that folder to the AI's user. If a project's folder is ever a link, the app refuses to work in it and says so.
- **Giving files to the AI's user** now goes one file at a time. Links are never followed, and a file that also lives somewhere else (a hard link) keeps its owner.
- The app runs git by its full name, with system folders only.
- Very rare: if a folder with its own repository has a name that isn't plain text, Coder says so and doesn't save until it's renamed.
- 5 new tests (CD90 to CD94); all 90 pass. On the branch, not deployed.

## 2026-11-06: Full platform audit

- Your word: "do full platform audit, imma go to bed".
- It was read-only. Nothing was changed, deployed or merged. No Grok calls were made, and no sign-in emails were sent.
- It covered 19 areas: the 15 planned, plus 4 that a final check said were missing. Separate reviewers challenged each finding, and duplicates were merged. Your usage limit cut off the last 12 checks, so I checked those against the code myself.
- **The report is not in this repository.** The repository is public, and the report describes problems that are still live. You have it as a file in the chat (`audit-2026-11-06.md`).
- The audit had left a folder of test keys (`ca/`) in the repo folder. I moved it out before anything was committed.
- Nothing gets fixed until you choose what to fix.

## 2026-11-06: Environments like Claude Code's

- Your word: "make it like claude code", after I checked Claude Code's docs (code.claude.com/docs/en/cloud-environments).
- **Your own environments.** Environments now belong to you, have names, and aren't tied to repos. Default is made for you.
  - Each environment holds the network setting, the keys, the setup script and the variables, and they apply to every chat that uses it. A key saved from one chat reaches every chat on that environment.
- **Picking one.** A chat picks its environment under the message box, before its first message, like Claude Code's picker. "+ Add environment…" makes a new one and opens it.
  - After the first message the pick is fixed, as in Claude Code's docs. The Environment button then edits that environment.
  - A repo's next chat starts with the environment used (or made) most recently for that repo.
- **The Environment window** shows the environment's name, with a Name row to rename it and "Archive this environment". Default can't be renamed or archived.
  - An archived environment leaves the list, but chats that already use it keep working.
- **Nothing is lost.** Each repo's settings from before move into an environment named after the repo the first time one of its chats needs them. The old files stay where they were.
- **Coder's cards.**
  - Coder knows which environment the chat uses. Its setup-script and "Allow this site?" cards name that environment, and the key card says the key is saved on it.
  - Like the "testing2" card you saw in Claude Code: when a chat uses Default and something is only for this repo, Coder offers "Create new environment?" (name, network, repository, setup script; Deny / Create environment). This chat keeps its environment, and new chats of this repo start with the new one.
- Previews checked on the live page with this new page code; live after "merge and deploy".

## 2026-11-06: Like Claude Code: the question card, undo when it isn't clear, where a saved key lives (2, 3, 4)

- You tested all 18 tools in Claude Code and in Coder, and asked for 2, 3 and 4 of the differences.
- 2. **The question card** now looks and works like Claude Code's.
  - The question sits on top, and each choice has a short explanation under it. The recommended choice is first, says "(Recommended)" and is already chosen.
  - There's an "Other" choice with a box to type your own answer, and Coder can allow several choices.
  - Skip and Submit buttons (Ctrl+Enter also submits), and a "Needs your input" tag while it waits.
  - Your choice is kept even if the page redraws. Questions in older chats still show.
- 3. **Undo when it isn't clear.** If Coder's last job changed nothing (like a review) and you say "undo", it first asks which one you mean, the way Claude Code did: that job's files, or something else such as an environment change or a saved key. Coder's app now tells Coder which job is the last one that changed files, and the undo tool won't run until you've chosen. When the last job did change files, undo happens straight away, as before.
- 4. **After you save a key** on the card and Coder uses it, Coder says in one line where it's saved (this repo, only sent to that site) and that you can remove it in Environment → Network secrets.
- You said there's a bigger difference you noticed; waiting for it.
- On the branch; live after "merge and deploy".

## 2026-11-06: Deployed, and the same test recorded again in the browser

- Merged and deployed (your word). Same browser test, recorded again (3.4 minutes, sent in the chat):
  - tree was installed as admin and ran (v2.1.0);
  - the broken line was reported with its exit code and where to fix it;
  - the card came only after Coder ran the line;
  - after Decline, Coder now says the right thing: "The setup script change was declined, so it stays as echo "setup ok" > setup-ran.txt."
- The chat's top bar stays on one line in the video.
- Coder's tools right now, listed for you: read, write, edit, grep, glob, lsp, bash, monitor, stop_job, web_fetch, Grok's web search, ask_user, todo, request_secret, propose_env, review, undo_last_job, pull_request (18).

## 2026-11-06: Recorded browser test of the setup script, and one fix

- Your word: live tests in the browser, recorded. Done on gofarther.dev with the test account, only by clicking and typing. Recording: 3.4 minutes, sent in the chat.
  - In the Environment window, network set to Trusted and setup script set to `apt-get install -y tree`. Coder's app installed tree as admin, and Coder ran `tree --version` (v2.1.0).
  - A broken line added in the window: Coder said which command failed (exit 127) and that it can be fixed in Environment → Setup script.
  - Script and network put back in the window. Asked for a "cache" folder line, Coder ran it first, then showed the card. Decline worked.
- Found: after Decline, Coder said the script "still has the failing nonexistent-tool-xyz line", which you had already removed in the window. Coder trusted its memory of the chat over the script it was given.
- Fixed: when you change the setup script or network in Environment between messages, Coder's app tells Coder in the message itself, with the new script and whether it ran fine. The note stays in the chat's history. The chat still shows only your words.
- On the branch; live after "merge and deploy".

## 2026-11-06: The chat's top bar stays on one line

- Your "Ok" to the fix: on a computer, a long chat title or branch no longer pushes "See changes" onto a second line.
- They are shortened with "…" instead, and the whole name shows when you point at it. The branch gives way first, then the title.
- The repository name stays whole unless the window is narrow (under 1100 pixels).
- Phones keep their layout.
- Preview checked at 1280 and 1024 pixels wide. Live after "merge and deploy".
- Your word for live tests from now on: done in the browser, the way you'd use it (Environment window, chat box, cards), and recorded.

## 2026-11-06: Setup script changes deployed and checked live

- Merged and deployed (your word). Checked in a new chat on the test repo:
  - 1. On the Trusted network, the setup line `apt-get install -y tree` was installed as admin by Coder's app ("Setting up tree (2.1.0-1)"), and Coder then ran `tree --version` (v2.1.0).
  - 2. With a broken setup line, Coder said: "The setup script failed: nonexistent-tool-xyz --install exited with code 127 (command not found). You can fix it in Environment → Setup script; new chats run the fixed script." No card was forced.
  - 3. Asked to add a line that makes a cache folder, Coder first ran `mkdir -p cache`, then the whole new script, and only then showed the card.
- The test repo was set back afterwards: the original setup script, Full network.

## 2026-11-06: The setup script, like Claude Code's (all 3)

- Your word: "Do the 3 of them", after comparing Coder with Claude Code's docs.
- 1. **System packages.** In Claude Code the setup script runs as admin, so `apt install` works. Now a setup line like `apt-get install -y jq` works in Coder too, with or without sudo.
  - Coder's app runs those lines itself, as admin. Only the checked package names go to apt, and your network setting applies.
  - Every other line still runs as Coder's own user. So a setup script can never reach your GitHub token or keys: on Coder's machine they sit next to it, while Claude Code keeps them off its machine.
  - The Setup script page says so.
- 2. **A failed setup, the way Claude Code handles it.** Coder says which command failed and its exit code, and that you can fix it in Environment → Setup script. It offers a fix on the card only if it has one it tried. It carries on with the rest of the work and never makes up results. This replaces the change from earlier today that forced a card every time.
- 3. **Only tried lines.** Like Claude Code, Coder only proposes setup lines it ran itself in that chat and saw work. A package must exist; the machine now keeps Debian's package list so names can be checked.
- On the branch; live after "merge and deploy".

## 2026-11-06: Deployed, and the fixes checked live

- Merged and deployed (your word). The Setup script page shows its new line, and links no longer swallow bold text.
- Checked live in a new chat:
  - Coder named the main branch and the chat's branch correctly ("The main branch is coder/testingforclaude-c51d, and this chat is on coder/testingforclaude-58qkcgew").
  - A broken setup script is now raised: "nonexistent-tool-xyz --install failed because that command is not installed (exit 127)". But Coder didn't put a fix on the card by itself.
- So the reminder now asks Coder to put the fixed script on the card straight away, with the failed command as the card's reason. This is on the branch and goes live after the next "merge and deploy".

## 2026-11-06: Full live test of Coder, and three fixes it found

- Your word: "lets just test all we added". Tested live on gofarther.dev (test account, canias7/testingforclaude, real Grok and GitHub). All passed:
  - a new chat answers;
  - every tool in one job (search, read, write, edit, commands, code check, web fetch, background job with check and stop, the checklist);
  - question buttons; a picture ("BLUE 42"); @README.md;
  - memory in a new chat ("teal"); an "always" style in a new chat, then forgotten; a CODER.md rule;
  - Low and Extra high effort;
  - review and security review (as Coder's own tools); undo;
  - pull request #8; @coder on GitHub (Coder's bot answered on the pull request); auto-fix from a review comment (it deleted the file and updated #8);
  - the Environment window (4 rows, 4 network levels, 7 secret types, script, variables);
  - None and Trusted networks with the "Allow Coder to reach example.com?" card (Approve, then 200);
  - the key card (the key arrived; it never showed on the page); a Basic key added in the window, reachable even on None, only under its path;
  - Stop; two chats working at once; See changes; Remove chat; the front page and sign-in card.
- Found and fixed (on the branch, live after "merge and deploy"):
  - 1. Coder proposed `sudo apt-get install jq` for the setup script. The setup script runs as Coder's own user, without root, so that can never work, and every new chat's setup then failed. Coder is now told this; a proposal with sudo or apt-get is refused with the way that works (install into the project: npm ci, a Python virtualenv); and the Setup script page says it in one line.
  - 2. After a failed setup, Coder answered "Hi. What do you want to work on?" as if nothing had happened, although its instructions said to raise it. Now it is always reminded once, before it finishes, to name the failed command and propose a fix on the card (like the install reminder).
  - 3. Coder guessed the main branch was called `main`, and a command failed in a repo where it isn't. It is now told the repo's main branch and this chat's branch, like Claude Code.
- Noticed, not changed: variable values show as [hidden] in the chat (on purpose, from the audit). The test repo's main branch is still named `coder/testingforclaude-c51d`, left over from before the empty-repo fix.

## 2026-11-06: The iPhone app is in TestFlight

- The owner created the app in App Store Connect (GOFARTHER, dev.gofarther.app); Apple's API refuses to make apps ("The resource 'apps' does not allow 'CREATE'"), so that one step stays on the website.
- Then the "build phone apps" button with "testflight" ticked: the app ID check passed, the iPhone app was built, signed by Apple's cloud signing with the owner's key, and uploaded: "Upload succeeded … EXPORT SUCCEEDED". Apple processes a new build for a few minutes before it shows in TestFlight.
- To install on an iPhone: the TestFlight app from the App Store, and the owner added as an internal tester in App Store Connect → the app → TestFlight.
- (The run's wording no longer blames the key's role when Apple refuses an action it never allows.)

## 2026-11-06: TestFlight run: app ID registered; it now tries to make the app too

- The second press got through the secrets check and registered the app ID dev.gofarther.app with Apple using the owner's key, then stopped: the app isn't in App Store Connect yet.
- Owner: "can't you do that". The run now also tries to make the app in App Store Connect with the key. If Apple allows it, the run carries straight on to build, sign and send to TestFlight; if Apple refuses (its API may not allow making apps), it shows Apple's own words and the steps for the short form in App Store Connect.

## 2026-11-06: First TestFlight press: one secret missing, and a fix

- The first press stopped at the secrets check: APPLE_API_KEY_ID isn't in GitHub's secrets yet (the other three are). Nothing reached Apple.
- My bug, fixed: the check (and the key clean-up) ran in a folder that doesn't exist before the code is checked out. The check now also drops a space or new line pasted with a value (the Team ID had one), and names any value that doesn't look right (Team ID and Key ID: 10 letters and numbers; Issuer ID: the long ID with dashes; the key: the whole .p8 file).

## 2026-11-06: The Apple key goes in GitHub's secrets, not the chat

- The owner offered to give the Apple API key in the chat. Not in the chat (it would be stored in the conversation; the rule is Claude never sees secret values): the owner puts it in GitHub's secrets, and GitHub's Mac machine uses it.
- The TestFlight run now first uses the key to register the app ID (dev.gofarther.app) with Apple when it isn't there, and checks the app exists in App Store Connect, stopping at once with a plain message if not (Apple's API cannot create the app itself, so that one step stays in App Store Connect). A wrong key gets a message naming the secrets to check.

## 2026-11-06: Phone apps build; TestFlight ready to switch on

- "build phone apps" ran: the Android app (GoFarther-android.apk, 3.7 MB) and the iPhone app (Xcode: BUILD SUCCEEDED, ID dev.gofarther.app) both build on GitHub's machines, free.
- The button now has a "testflight" box: it signs the iPhone app with Apple's cloud signing (an App Store Connect API key; no certificate files copied anywhere) and sends it to TestFlight, to install on a real iPhone. It needs four GitHub secrets the owner adds: APPLE_TEAM_ID, APPLE_API_KEY_ID, APPLE_API_ISSUER_ID, APPLE_API_KEY_P8. The key file exists only during the run and is removed after.
- The app answers Apple's encryption question once in its settings (it only uses standard HTTPS), so TestFlight doesn't ask on every build.

## 2026-11-06: Live checks after the outage fix, and a small display fix

- Live: Coder's machine starts again (a new chat answered "Hi. What do you want to work on?").
- Live, Trusted network: npm answered 200; example.com was blocked ("CONNECT tunnel failed, response 403"); web_fetch on example.com was blocked by the site list too. The test repo is back to Full.
- Fixed: a link right before the end of bold text swallowed the closing ** ("**curl https://…:**" showed its asterisks). Links no longer take a * at the end.

## 2026-11-06: The phone apps, started (iPhone and Android)

- coder/mobile: the phone app (Capacitor), gofarther.dev in its own app like the desktop one, named Go Farther with the GF icon and a plain GF splash screen (ID dev.gofarther.app).
- In the phone app the page hides the download buttons, opens links to other sites in the app's own browser sheet (so the app never gets stuck on another site), and keeps GitHub's sign-in inside so Connect GitHub comes back to the app. Checked by pretending to be the app in a browser.
- The page now keeps clear of the status bar, the notch and the home bar on phones (zero on computers, so nothing changes there).
- A new button, "build phone apps": the Android app as GoFarther-android.apk (installs on an Android phone directly), and the iPhone app built for the simulator to check it compiles. Free (public repository).
- Next: the owner has the Apple certificates; with them as GitHub secrets the iPhone build can be signed and sent to TestFlight, to install on a real iPhone.

## 2026-11-06: Fix: Coder's machine could not start after the last deploy

- My mistake in the deploy that matched the Environment to Claude Code's docs: the new file that signs and fetches tokens for secrets (coder-auth.mjs) was not on the list of files copied onto Coder's machine. The machine's program could not start, so every Coder job failed with "Failed to start container" from that deploy until this fix is deployed.
- Fixed (one line in the container's Dockerfile), and a new test builds exactly the files the Dockerfile copies and checks the program starts, so a missing file fails the tests before any deploy.
- The live check of the new Environment window itself passed: saving Trusted from the window, adding a secret with the Add secret form (listed without its value) and removing it all worked; the test repo is back to Full.

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
