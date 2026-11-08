# How the owner likes things done

Started fresh on 2026-11-05, when everything from the old website builder was
deleted (the old file is in git history).

## Approval
- **Spending:** no paid run or AI call without the owner's approval. Propose the
  exact request and a cost estimate first.
- **Presses:** Claude may run workflows itself when the owner asks (2026-11-05). Deletion runs still need the owner's word each time.
- **Git:** merge to `main` and deploy only when the owner says so. No pull
  request unless asked.
- **Deleting:** nothing permanent (Workers, storage, databases, branches) without
  the owner's word, and then through a button they press or a list they see.
- **Secrets:** never read or print a secret's value. The owner types secrets in.

## Working
- Plain, simple English. One step at a time when the owner has to do something.
- Always show UI changes as screenshots in the chat. The owner directs the
  design: don't restyle beyond what's asked. Offer options as screenshots.
- Never write GitHub's skip-CI marker anywhere.
- Every change ships with tests, an owner-notes entry and a push.
- **Test everything in the browser (2026-11-08, "we need to test everything in
  the browser bro, pls, remember that"):** every feature and fix is tried live on
  gofarther.dev in the browser, with Grok, and recorded (then the same in Claude
  Code, to compare). Automated tests and checks on Claude's side are not enough
  on their own.
- **Tool by tool (2026-11-08, "Ok do that"):** while going through one tool, keep
  anything that is not that tool in its own list, marked as outside it, and ask
  the owner before fixing it. Something the tool's change breaks elsewhere may be
  fixed with it, but say plainly that it is outside the tool and why.

## Coder (2026-11-05)
- Same style as the old sites agent's chat, its own folder, Worker and container.
- Code goes through each user's own GitHub, through a GitHub App (chosen: "A").
- A Linux terminal; any code project; its own projects; run and show it.
- Free while testing; only the owner's accounts (`CODER_USERS`).
- The chat looks like the Claude app: light grey bubbles, "Ran …" lines, several commands grouped in one box, plain answers, model and effort under the box.
- Model picker: Grok 4.7 with its effort levels (Low, Medium, High).
- Coder's tools: `bash` only (the owner removed `ask` and `done`). It finishes by answering in words.
- Coder has, from Claude Code: several chats at once (3 per person), the repo's own rules (CODER.md, CLAUDE.md, AGENTS.md), memory per repo, comments on the changes, background commands, slash commands.
- The left tabs: Coder and the Gloopy agent (the yellow figure; coming soon).
