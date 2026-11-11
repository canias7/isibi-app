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
| 5 | Tool search | only tool names loaded until a search when there are many | up to 80 full tools sent | later |
| 6 | "Always ask" from the server | `_meta["anthropic/requiresUserInteraction"]: true` asks on every call, whatever the mode or rules | read; asks every time, in every mode; not run where nobody can be asked | done 2026-11-11 |
| 7 | Pre-registered apps | `--client-id` / `--client-secret` for servers without self-registration (GitHub, HubSpot) | not possible; a key instead | owner decides |
| 8 | Old SSE servers | falls back to SSE when HTTP fails (Asana and others) | HTTP only | later |
| 9 | Resources and prompts | `@server:resource`, `/mcp__server__prompt`, elicitation popups | none | later |
| 10 | Tool list changes | `list_changed` fetches the new list | only on "Check again" | later |

## Different on purpose

- Claude Code runs on your own computer and keeps logins there. Coder is a website: logins stay on our server, never on
  Coder's machine; each tool call goes through the server.
- Claude Code has local, project and user lists. Coder has one list per person for the whole platform (owner,
  2026-11-10).
