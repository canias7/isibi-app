# How the owner likes things done

Started fresh on 2026-11-05, when everything from the old website builder was
deleted (the old file is in git history).

## Approval
- **Spending:** no paid run or AI call without the owner's approval. Propose the
  exact request and a cost estimate first.
- **Presses:** the owner presses every workflow run. Hand over the exact inputs.
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

## Coder (2026-11-05)
- Same style as the old sites agent's chat, its own folder, Worker and container.
- Code goes through each user's own GitHub, through a GitHub App (chosen: "A").
- A Linux terminal; any code project; its own projects; run and show it.
- Free while testing; only the owner's accounts (`CODER_USERS`).
- The chat looks like the Claude app: light grey bubbles, "Ran …" lines, several commands grouped in one box, plain answers, model and effort under the box.
- Model picker: Grok 4.7 with its effort levels (Low, Medium, High).
- Coder's tools: `bash` only (the owner removed `ask` and `done`). It finishes by answering in words.
- The left tabs: Coder and the Gloopy agent (the yellow figure; coming soon).
