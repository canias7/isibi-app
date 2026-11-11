# Connectors (MCP): Coder compared with Claude Code

Read from Claude Code's MCP docs (https://code.claude.com/docs/en/mcp) on 2026-11-11, at the owner's word ("go look on
the claude code docs for how the mcp works"; "save this list"). The second half of that page (tool search, resources,
timeouts, some sign-in details) came as a summary, not word for word.

## Already the same

- Transport: Streamable HTTP only, the one Claude Code recommends.
- Sign-in: OAuth with the server found from its metadata (RFC 9728, then RFC 8414), the app registered on the fly
  (dynamic client registration), PKCE; the login kept encrypted and renewed automatically.
- Tool names: `mcp__<server>__<tool>`.
- A key in a header (our "API key" box).
- Jobs started from GitHub get no connectors (our own safety choice).

## What Claude Code does more (suggested order)

| # | What | Claude Code | Coder now | Status |
|---|------|-------------|-----------|--------|
| 1 | Sign-in also on 403 | 401 or 403 means "needs sign-in" | 401 or 403 | done 2026-11-11 |
| 2 | Retry once after a refresh | on a 401 with a refresh token: refresh, retry once | on a tool call and on Check again | done 2026-11-11 |
| 3 | Long answers to a file | `MAX_MCP_OUTPUT_TOKENS` 25,000 (warning over 10,000); text over 50,000 characters saved to a file | over 50,000 characters saved to the scratch folder; Grok gets the first 2,000 and the path (the Worker passes up to 500,000) | done 2026-11-11 |
| 4 | Timeouts | 60-second floor per request; idle limit 5 minutes; a call still running after 2 minutes goes to the background | 60 seconds a request, 5 minutes a tool call (no moving to the background yet) | done 2026-11-11 |
| 5 | Tool search | only tool names loaded until a search when there are many | over 20 tools (or 40,000 characters of them): names and one connector_search; what it finds is loaded | done 2026-11-11 |
| 6 | "Always ask" from the server | `_meta["anthropic/requiresUserInteraction"]: true` asks on every call, whatever the mode or rules | read; asks every time, in every mode; not run where nobody can be asked | done 2026-11-11 |
| 7 | Pre-registered apps | `--client-id` / `--client-secret` for servers without self-registration (GitHub, HubSpot) | not needed for your list: MongoDB reads Go Farther's client document (Claude Code supports these too); Render's server takes an API key | done 2026-11-11 |
| 8 | Old SSE servers | falls back to SSE when HTTP fails (Asana and others) | HTTP first; an address ending in /sse, or a server refusing HTTP with 400/404/405, uses SSE | done 2026-11-11 |
| 9 | Resources and prompts | `@server:resource`, `/mcp__server__prompt`, elicitation popups | none | later |
| 10 | Tool list changes | `list_changed` fetches the new list | no open session to hear it, so: lists older than an hour are read again after a job starts; an unknown-tool error re-reads at once | done 2026-11-11 (our way) |

## Different on purpose

- Claude Code runs on your own computer and keeps logins there. Coder is a website: logins stay on our server, never on
  Coder's machine; each tool call goes through the server.
- Claude Code has local, project and user lists. Coder has one list per person for the whole platform (owner,
  2026-11-10).

## Second check of Claude Code's MCP docs (2026-11-11, the whole page read word for word)

Your word: "go back to the Claude Code docs and look up the MCP tools ... see what we're missing". Sorted from most to least worth doing for Coder.

| # | What | Claude Code | Coder now | Status |
|---|------|-------------|-----------|--------|
| 11 | Idle limit, not a total limit | the 5 minutes is an idle window, reset by progress notifications; the total limit is about 28 hours | idle 5 minutes, reset by every piece of the answer (a tool call asks for progress); 30 minutes in all (a web request can't wait 28 hours) | done 2026-11-11 |
| 12 | Tool search threshold | while the tools' definitions are under 10% of the context they load at once ("no fixed per-server tool cap") | loaded upfront while their definitions are under 100,000 characters (10% of Grok's context); no tool count | done 2026-11-11 |
| 13 | Description length | 4,096 characters at the start; 16,384 when found by tool search | 4,096 characters upfront, 16,384 when found by search | done 2026-11-11 |
| 14 | A tool's own size limit | `_meta["anthropic/maxResultSizeChars"]` raises the 50,000-character file threshold, up to 500,000 | read, up to 500,000 | done 2026-11-11 |
| 15 | Long errors | an error over about 11,000 characters keeps its first and last 5,000 | first and last 5,000 kept | done 2026-11-11 |
| 16 | Big-answer warning | a warning shows when an answer is over 10,000 tokens | a note in the chat over about 10,000 tokens | done 2026-11-11 |
| 17 | Pictures from a tool | PNG, JPEG, GIF and WebP shown to the model in the chat | PNG and JPEG shown to Grok (up to 4, as read's pictures are); GIF and WebP named | done 2026-11-11 |
| 18 | Retries | a first connection failing with a 5xx, refusal or timeout is tried 3 times; listing tools is tried 3 times | a first connection failing with a 5xx, refused or a timeout is tried 3 times, 1 and 2 seconds apart; tools/list too; never a tool call already started | done 2026-11-11 |
| 19 | offline_access | appended to the scopes when the sign-in server offers it, so a refresh token comes back | added when the sign-in server offers it | done 2026-11-11 |
| 20 | "Needs more permission" | a 403 `insufficient_scope` says the connector needs more permissions | "needs more permissions: reconnect it" | done 2026-11-11 |
| 21 | Server instructions | a server's instructions (up to 4,096 characters) are given to the model at the start | each working connector's instructions (up to 4,096) given to Grok, marked as the server's, not the owner's | done 2026-11-11 |
| 22 | Read-only in parallel; safe repeats | `readOnlyHint` tools run side by side; `idempotentHint` tools may be repeated once on a new connection | read-only tools that need no question start together; an idempotent tool is repeated once after a passing failure | done 2026-11-11 |
| 23 | Always load a tool | `_meta["anthropic/alwaysLoad"]` keeps a tool loaded even with tool search | read; such tools load at the start even with tool search | done 2026-11-11 |
| 24 | Tool schemas | top-level `anyOf`/`oneOf`/`allOf` flattened; tools with odd property names left out | flattened; tools with odd property names left out | done 2026-11-11 |
| 25 | Same server twice | addresses compared without case, default port or trailing slash | compared without case, default port or trailing slash | done 2026-11-11 |
| 26 | Long calls to the background | a call still running after 2 minutes moves to the background | a connector call still running after 2 minutes moves to the background; Coder goes on and is told the answer when it comes (before its turn ends at the latest) | done 2026-11-11 |
| 27 | Resources | `@server:protocol://path`, fetched and attached | `@connector:uri` in your message is read and attached, marked as data; the connector's page lists its resources | done 2026-11-11 |
| 28 | Prompts | `/server:prompt` slash commands | `/connector:prompt args` (or `/mcp__connector__prompt`) as your message becomes the prompt's text; the connector's page lists them | done 2026-11-11 |
| 29 | Elicitation | the server asks the user something (a form or a link) | NOT DONE: the app would pause a tool call to ask you something, across two separate web requests; that needs a Durable Object (a bigger change). Apps aren't told we support it, so they don't ask | not done |
| 30 | MCP tasks (beta) | long server jobs polled every 2 seconds (250 ms to 30 s), cancellable | a tool that supports tasks is asked to run as one; Coder's server follows it (every 0.25 to 30 seconds, 2 by default) until it ends, up to 30 minutes, then cancels it | done 2026-11-11 |

Not on the page, so not needed to match: sampling, structured content and outputSchema, destructiveHint, title, notifications/cancelled. Ours only: the hourly tool-list refresh (Claude Code relies on list_changed, which a web request can't hear).

## Third check: Claude.ai's connector help pages, the Agent SDK's MCP page, and Claude Code's permissions, hooks and settings pages (2026-11-11)

Your word: "Ok yes pls" (to reading the other pages that mention MCP). Pages: support.claude.com articles 11175166 and 11176164,
code.claude.com/docs/en/agent-sdk/mcp, /permissions, /hooks, /settings.

| # | What | Claude | Coder now | Status |
|---|------|--------|-----------|--------|
| 31 | Connectors on or off per chat | "enable connectors for individual conversations via the "+" button … then "Connectors"" | every working connector is on in every chat (the server can already keep a chat's off list; no button) | to do |
| 32 | Tools off per chat | "Using the "Search and tools" menu, disable any tools that aren't relevant to the current conversation" | only per tool for all chats | to do |
| 33 | Sign in later | "Sign in now", "Sign in when needed" or "No sign in" when adding | sign-in starts at once | to do |
| 34 | A whole connector switched off | statuses "pending", "connected", "failed", "needs-auth", "disabled" | ok, needs sign-in, not working (no "disabled") | to do |
| 35 | Warnings for custom connectors | "services that haven't been verified by Anthropic"; "Malicious MCP servers may include hidden instructions"; "Monitor changes in tool behavior" | none shown | to do |
| 36 | Tool changes noticed | (the warning above) | lists refreshed hourly, changes not shown | to do (show new or changed tools) |
| 37 | Wildcard rules | `mcp__<server>__*`, `mcp__github__get_*`; `"deny": ["mcp__*"]` turns off every MCP tool | one tool or one group at a time | to do (all of a connector at once; all connectors off) |
| 38 | "On demand" tool access | "Auto (the default)" or "On demand"; "If you have 10 or more connectors active, consider switching to On demand" | tool search switches by size on its own | later (an owner setting) |
| 39 | Team controls | owners add connectors for the team; members request them; owners set Always allow / Needs approval / Blocked for everyone ("Individual users can't override this") | one person only | later (when teams come) |
| 40 | Free plan limit | "Free users are limited to one custom connector" | no limit but 20 | later (when plans come) |
| 41 | Hooks on connector tools | PreToolUse/PostToolUse match `mcp__<server>__.*`; an `mcp_tool` hook calls a connector's tool; PostToolUse can replace an MCP answer (`updatedMCPToolOutput`) | Coder's hooks don't cover connectors (hooks are on another branch) | later |
| 42 | Elicitation hooks | `Elicitation` and `ElicitationResult` hooks answer or change what the server asks | none | later (needs #29) |
| 43 | Interactive connectors | connectors that show live UI in the chat; owners can turn those tool calls off | none | later |

Same already: tool permissions Always allow / Needs approval / Blocked; a connector from a known service shows its own name, not "Custom"; sign-in by the published client document ("Use Claude's published identity (Recommended)") or registration on the fly ("Register automatically"); servers must be reachable over the public internet (ours are called from our server too); the SDK's "MCP servers that fail to connect don't throw" (ours say "not working" and the chat goes on).

Not for us: `.mcp.json` approval, `enableAllProjectMcpServers`-style settings, `--disallowedTools`, `dontAsk` mode, Cowork's `mcp__workspace__bash`, `/cd` disconnecting project servers, the SDK's in-process servers and status calls.
