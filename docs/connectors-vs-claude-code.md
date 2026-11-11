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
| 11 | Idle limit, not a total limit | the 5 minutes is an idle window, reset by progress notifications; the total limit is about 28 hours | 5 minutes in all | to do |
| 12 | Tool search threshold | while the tools' definitions are under 10% of the context they load at once ("no fixed per-server tool cap") | over 20 tools, or 40,000 characters | to do |
| 13 | Description length | 4,096 characters at the start; 16,384 when found by tool search | 1,000 | to do |
| 14 | A tool's own size limit | `_meta["anthropic/maxResultSizeChars"]` raises the 50,000-character file threshold, up to 500,000 | not read | to do |
| 15 | Long errors | an error over about 11,000 characters keeps its first and last 5,000 | same as other answers | to do |
| 16 | Big-answer warning | a warning shows when an answer is over 10,000 tokens | none | to do |
| 17 | Pictures from a tool | PNG, JPEG, GIF and WebP shown to the model in the chat | "[image not shown]" | to do |
| 18 | Retries | a first connection failing with a 5xx, refusal or timeout is tried 3 times; listing tools is tried 3 times | once | to do |
| 19 | offline_access | appended to the scopes when the sign-in server offers it, so a refresh token comes back | not added | to do |
| 20 | "Needs more permission" | a 403 `insufficient_scope` says the connector needs more permissions | treated as signed out | to do |
| 21 | Server instructions | a server's instructions (up to 4,096 characters) are given to the model at the start | not read | to do |
| 22 | Read-only in parallel; safe repeats | `readOnlyHint` tools run side by side; `idempotentHint` tools may be repeated once on a new connection | one by one, never repeated | later |
| 23 | Always load a tool | `_meta["anthropic/alwaysLoad"]` keeps a tool loaded even with tool search | not read | to do with #12 |
| 24 | Tool schemas | top-level `anyOf`/`oneOf`/`allOf` flattened; tools with odd property names left out | passed as they are | to do |
| 25 | Same server twice | addresses compared without case, default port or trailing slash | exact text | to do |
| 26 | Long calls to the background | a call still running after 2 minutes moves to the background | waits | later |
| 27 | Resources | `@server:protocol://path`, fetched and attached | none | later (#9) |
| 28 | Prompts | `/server:prompt` slash commands | none | later (#9) |
| 29 | Elicitation | the server asks the user something (a form or a link) | refused | later (#9) |
| 30 | MCP tasks (beta) | long server jobs polled every 2 seconds (250 ms to 30 s), cancellable | none | later |

Not on the page, so not needed to match: sampling, structured content and outputSchema, destructiveHint, title, notifications/cancelled. Ours only: the hourly tool-list refresh (Claude Code relies on list_changed, which a web request can't hear).
