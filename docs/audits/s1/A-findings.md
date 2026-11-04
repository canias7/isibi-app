# Audit s1, reader A: the site agent (offline, read-only)

Branch `claude/cool-fermat-a06gie`, 2026-11-04. No product or test file changed; nothing paid was called.
Line numbers are from this branch.

## A-1 (high): nothing in code separates "answer a question" from "build", and the prompt pushes toward building
- **Where**: builder/site-agent.mjs:318 (AGENT_RULES, the question rule), :293-295 (SERVER_RULES 2), :1327-1378 (every edit is offered every write tool), :52/:55 (AGENT_MAX_ROUNDS and AGENT_CREDIT_CAP are both Infinity); builder/page-gen.mjs:1281-1284 (rule 14, which sits in the same system prompt through `pageRulesFor`).
- **Summary**: the only thing that stops a question from turning into a build is prompt wording. That wording is weak for payments, and in places it points the other way.
  - The rule for capability questions ("When they ask whether the site can do something, say what it would take") gives only email and SMS as examples. It says nothing about payments.
  - Rule 14 says "when the owner asks for a payment … write it there yourself". "Asks for a payment" reads like "can we take payments".
  - "When the message asks for something to be done, do it" closes the paragraph, so it is the last word.
  - SERVER_RULES 2's fallback ("Use … the one the site's code or set keys already use") lets the model treat any Stripe trace in the code, or `docs.stripe.com` listed first in read_docs, as "already chosen".
  - SERVER_RULES are appended after AGENT_RULES and say "these come first", while AGENT_RULES say "THESE RULES WIN OVER ANYTHING ABOVE". The two blocks each claim priority.
  - Nothing in code backs any of this up. There is no confirmation before an expensive feature, no rule that ask_owner must come before the first write when the message is a question, and no cap.
- **What the customer sees**: they ask whether something is possible. Without any go-ahead, they get a full feature built and a large bill.
- **Scenario**: "so can we take payments" on an existing site. All tools are offered. The model reads it as "asks for a payment" (rule 14) and "something to be done", picks Stripe, writes a checkout, builds and finishes. Charged 47 credits; no provider was asked. The prompt-only "answer in finish" path (:318) is never forced.
- **Confidence**: the missing code gate and the contradictory wording are confirmed by reading. That this is what drove the live case is plausible.

## A-2 (high): a `run` command can silently delete components from the workspace
- **Where**: builder/site-agent.mjs:663 (`syncFromRun`); builder/agent-shell.mjs:32 (`PART`) and :93 (writeSiteFiles skips a non-matching part); builder/site-agent.mjs:80 (`PART_KEY`).
- **Summary**: the agent accepts part names the shell (and build-server.mjs:401) refuse: uppercase, a leading digit, `--`, a trailing `-`. The shell never writes such a part into the sandbox, so it never reads it back. `syncFromRun` then deletes every workspace key it did not get back.
- **What the customer sees**: components vanish after the agent runs even a read-only `grep`. Then the build fails, or the site loses a section, and the reply says only that files were changed.
- **Scenario** (probed with node): workspace parts `Hero`, `2col` and `site-header`. A `run` comes back with only `site-header`. `syncFromRun` answers `['-parts/Hero','-parts/2col']` as "changed", and both are gone from the workspace. The build then fails to resolve the import, or if nothing imports them they are published as removed. Even before any run, such a part passes `write_file` and is then dropped by the build (build-server.mjs:401).
- **Confidence**: confirmed (probed).

## A-3 (high): changes made through `run` skip the write scope and the other write guards
- **Where**: builder/site-agent.mjs:656-667 (`syncFromRun`) compared with :851-856 (`write_file`) and :870-878 (`delete_file`).
- **Summary**: `write_file` and `delete_file` check `outOfScope` (`deps.mayWrite`, the part's own pages), the helper's `onlyWrite`, the home-page guard and `MAX_FILE_CHARS`. Whatever a shell command changes (`sed -i`, `rm`) comes back through `syncFromRun`, which applies none of these checks.
- **What the customer sees**: a part scoped to `/visit` (split work, or the look scope) can rewrite or delete other pages, including `index.tsx`. Another part that owns those pages then collides with it, or the home page is gone.
- **Scenario**: a split part told to change `/about` runs `sed -i 's/Old/New/' src/routes/*.tsx` (the prompt encourages "sed … for a mechanical change across files"). Every page changes and is saved, even though `mayWrite` would have refused each one.
- **Confidence**: confirmed by reading.

## A-4 (medium): the agent's own words reach the reply writer as a "fact"
- **Where**: builder/agent-outcome.mjs:194 (`"In the agent's own words: " + summary`); builder/one-reply.mjs:291-296 (ONE_REPLY_SYSTEM: "the facts of what really happened … Say only what the facts show"); worker.js:17328-17332 (`said`).
- **Summary**: the finish summary is free text from the model. It is put into the facts list, and the reply writer is told those facts are authoritative. `checkReply` only checks names and paths, not claims.
- **What the customer sees**: replies such as "Payments are now live" or "I've emailed your customers" when the operations did no such thing (keys are missing, server tests failed, a part was skipped).
- **Scenario**: the agent finishes with "Checkout is ready to take payments" while `STRIPE_SECRET_KEY` is unset. The keys fact says "not set", but the reply writer may still repeat the summary's claim. This breaks the owner's rule that "what a reply states comes from what the operations really did".
- **Confidence**: confirmed by reading. That the writer repeats the claim is plausible.

## A-5 (medium): the conversation history is cut short, and a failed history read becomes "no history"
- **Where**: builder/site-agent.mjs:1563-1566 (`historyText`: the last 12 messages, 600 characters each); worker.js:16926 (`catch { history = "" }`, and a failed `cur.read` also gives ""); builder/chat-context.mjs (`planWindow` and the chat summary are used for other paths in worker.js:1138 and 32228, never for the agent).
- **Summary**: the agent never gets the chat's compacted summary. Anything before the last 12 messages is lost, and a long earlier answer (an options list, a plan) is cut to 600 characters. When the chat store cannot be read, the agent is not told the history is unknown. It is given an empty conversation, so "cannot tell" is read as "nothing was said".
- **What the customer sees**: "do the second option" or "use the provider I said earlier" is misread or asked again. A decision made more than 12 messages back (for example "we use Square") is forgotten, and the agent picks again.
- **Scenario**: the provider was chosen in message 3 and the change asked for in message 16. The history the agent gets starts at message 5, so the provider question is asked again or guessed.
- **Confidence**: confirmed by reading (the wiring). The impact is plausible.

## A-6 (medium): `read_docs` covers only three payment providers, but the rules say "any provider" and "read its docs"
- **Where**: builder/agent-server-tools.mjs:71-86 (`DOCS_HOSTS`); builder/site-agent.mjs:279 and :296 ("read the provider's official page"), and :294 (the options name only Stripe, PayPal and Square).
- **Summary**: for payments, the allow-list holds only Stripe, PayPal and Square. Mollie, GoCardless, Paddle, Razorpay, Lemon Squeezy, Adyen and SumUp are all refused, and so is any email or text provider outside the list. The agent is told to read docs and verify signatures each provider's own way, then has to write that code from memory.
- **What the customer sees**: an owner who chooses a provider outside the list gets webhook verification and API code written from memory, which can break or be insecure on the live site. The options shown also steer owners toward the three listed.
- **Scenario**: the owner taps "Other: Mollie". read_docs answers "documentation is read only from …", and the agent guesses Mollie's signature scheme.
- **Confidence**: confirmed by reading.

## A-7 (medium): the credit check fails open and runs only every 5 rounds
- **Where**: builder/site-agent.mjs:1393-1398 (`covered`: a throw gives `true`; checked only when `rounds % CREDIT_CHECK_EVERY === 0`); :55 (`creditCap` is Infinity).
- **Summary**: "cannot tell whether they can afford it" is read as "they can". Between checks, a round can launch helpers whose spending is counted only when they come back, so a run can spend well past the balance. The only bound is a check every 5 rounds.
- **What the customer sees**: a balance driven negative, or a larger bill than their balance allowed, with no pause for credits.
- **Scenario**: on round 1 the agent calls `helpers` with 6 tasks. Each helper runs up to HELPER_ROUNDS rounds. The next affordability check is at round 5, after all of that spend. If `affords` throws (the ledger cannot be read), the run never pauses at all.
- **Confidence**: confirmed by reading.

## A-8 (low): a Stop during a tool batch is shown to the model as a failed build, and the rest of the batch still runs
- **Where**: builder/site-agent.mjs:921-922, :1452-1456.
- **Summary**: when Stop aborts a build, the error is caught and the tool answers "The build failed: stopped by the owner". The loop then runs the remaining tool calls in that batch before the stop is read again. `call_function`, `read_docs`, `helpers` and `read_table` are not wrapped in `untilStopped`. A `run` that was abandoned keeps running in the container for up to 90 seconds.
- **What the customer sees**: work (and outside calls, such as a test call to a server function) carries on for a while after they pressed Stop.
- **Confidence**: confirmed by reading.

## Functions read
- **site-agent.mjs**: AGENT_TOOLS (ask_owner, request_key, split_work, start_build, finish), SERVER_PRACTICES, SERVER_RULES, AGENT_RULES, agentSystem, firstMessage, attachedList, pileSize, dropSeenShots, compact (head), makeWorkspace, writableKey, toolsFor, TOOL_NEEDS, checkNotes, mustFix, buildFailKind, syncFromRun, outOfScope, helperPlan (head), runTool (read_files, write_file, delete_file, change_rows, read_table, build, run, look, helpers, call_function, read_errors, list_keys, request_key, change_schema, start_build, ask_owner, finish), keysWaived, hasPages, runSiteAgent, sendStoppable, untilStopped, stoppedFacts, historyText, sumUsage, asWriterAnswer, newProjectMessage.
- **agent-guard.mjs**: fileMap, workspaceDiff, changeReport, reviewNote, reportFacts, scopeGuard (head).
- **agent-shell.mjs**: all of it.
- **agent-outcome.mjs**: outcomeFacts, keyFacts, pickMedia.
- **agent-carry.mjs**: all of it.
- **exact-edits.mjs**: all of it.
- **agent-server-tools.mjs**: DOCS_HOSTS, docsAllowed, docsText, readDocs.
- **one-reply.mjs**: checkReply, ONE_REPLY_SYSTEM, oneReplyRequest.
- **The wiring in worker.js**: runAgentChange, from line 16898 to 17135.

## Not finished
I did not read these function by function:
- agent-steps.mjs
- hand-over.mjs
- file-picker.mjs
- input-budget.mjs
- chat-context.mjs (only its exports, and that the agent does not use it)
- site-context.mjs
- context-report.mjs
- one-reply.mjs's fallback and record functions
- site-agent.mjs's rows, settings, rules and media tools (around lines 1060-1210)
- the helper scheduler (`runHelperPlan`)
