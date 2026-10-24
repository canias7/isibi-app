# What can go wrong when we call a model (2026-10-24)

Saved on the owner's word: **a list only, nothing built yet.**

## The kinds of failure

| # | What happens | Sign we get | Usually brief? | Would waiting and retrying help? |
|---|---|---|---|---|
| 1 | Provider overloaded or down | 503 "Service Unavailable", or "unavailable" inside the stream | Yes (seconds to minutes) | **Yes** |
| 2 | Provider's gateway broke | 502 "Bad Gateway" | Yes | **Yes** |
| 3 | Provider's gateway timed out | 504 "Gateway Timeout" | Yes | **Yes** |
| 4 | Provider's internal error | 500 "Internal Server Error" | Usually | **Yes**, a few times |
| 5 | Too many requests | 429 "Rate limited" (often says how long to wait) | Yes | **Yes**, after the wait it names |
| 6 | Out of credit on the provider account | 402, or a "billing"/"quota" error (xAI, 2026-09-30) | No, until someone tops up | **No**. Switch model or tell the owner |
| 7 | Our key is wrong or revoked | 401 / 403 | No | **No**. Owner must fix the key |
| 8 | The request itself is bad | 400 "Bad Request" (too long, bad format) | No | **No**. The same request fails every time |
| 9 | Model not found / retired | 404 | No | **No**. Switch model |
| 10 | Connection dropped mid-answer | Stream cut off, network reset | Yes | **Yes** |
| 11 | Our own clock ran out | Timeout on our side (the job's deadline) | – | Only with time left |
| 12 | Answer cut off (too long) | `max_tokens` stop | No | **No** as is. Ask for less, or allow more |
| 13 | Model refused | Refusal / safety stop | No | **No** as is. Different wording or model |
| 14 | Model answered, but wrongly | Empty choice, no tool call, unknown names (Saltmarsh's style part) | – | Sometimes. Ask once more with the reason |
| 15 | Model answered in the wrong shape | JSON that doesn't parse, missing fields | Sometimes | **Yes**, once, with the error fed back |

## What happened on Saltmarsh (2026-10-24, kind #1)

- xAI (Grok) sent "unavailable" mid-answer at 00:12:58. Two more calls failed at 00:13:03 and 00:13:16–22.
- xAI was working again by 00:25:40, when the Bookshop page started.
- Nothing tried in between, so we don't know when it came back.
- Our code does not retry this kind on purpose (audit A23-3). Its message was printed only to the server log and lost.

## Ideas for kind #1 (not built)

1. **Wait and retry longer**: 10 s, 30 s, 1 min, 2 min, then every few minutes, for up to about **20 minutes** (the jobs have a 50-minute limit). A model-written line tells the customer it is waiting.
2. **Switch to the backup model** (Claude) after 1–2 failures. That would have worked straight away.
3. **Park the part and come back later**: mark it "waiting for the model", free the site, and have the regular tick retry it in a few minutes. Nothing holds the container while waiting.
4. **Keep the real error**: save the provider's type and message on the job and its trace, so we know which kind it was.
5. **Check before retrying**: never retry kinds 6–9, 12 and 13. Never charge twice: retry only the call that failed.

## The owner's design for the waiting notice (2026-10-24)

- **A fixed server notice, not a model line** (the model may be the thing that is down). Shown in the chat as a grey box:
  - the code and its name, e.g. **"Grok error 503 · Service Unavailable"**; when the provider sends a word with no number, it is mapped to the standard code (unavailable → 503, overloaded → 529, rate limited → 429), and a real number is shown as sent;
  - the provider's own words, word for word;
  - a link to the provider's status page: **status.x.ai** for Grok (official, named in docs.x.ai's Debugging page), status.claude.com for Claude;
  - **No attempt count** (owner, 2026-10-24): "Retrying in 4:59 · no charge while waiting", counting down live, and it **keeps retrying every 5 minutes until the model answers**. Past the job's 50-minute limit the part is parked ("waiting for Grok"), the site is freed, and the background tick keeps trying every 5 minutes, resuming from the saved step.
- On recovery: "✓ Grok is answering again", then the model's own progress lines resume.
- There is no "every retry failed" end state; the customer can press Stop, or switch to Claude. (Open for the owner: a long cap such as 24 hours, and whether to switch to Claude automatically.)
- **A retry picks up where it stopped**: only the call that failed is sent again, inside the same job; steps already finished (e.g. the tables designed) are kept, nothing finished is redone or charged again.
- Mockup: `scratchpad/retry-mock/m3.html` (this session).
- **Which failures get this notice and the endless 5-minute retry** (owner, 2026-10-24): every provider-side kind in the table above, not only 503: **#1 503 unavailable, #2 502, #3 504, #4 500, #5 429 (waiting at least as long as the provider asks), #10 connection dropped.** Not the kinds that come from our side (#6 out of credit, #7 key, #8 bad request, #9 model not found) or from the answer itself (#12–#15); those keep their own handling.

## The exact fixed messages (owner, 2026-10-24)

Shown as a grey server notice, never model-written. `<Model>` is the model's name (Grok, Claude); `<words>` is the provider's own message, word for word; the link is the provider's status page (status.x.ai for Grok, status.claude.com for Claude).

**While waiting** (every kind below, countdown live, repeats every 5 minutes until the model answers):

| Kind | Title line |
|---|---|
| 503 | ⚠ `<Model>` error 503 · Service Unavailable |
| 502 | ⚠ `<Model>` error 502 · Bad Gateway |
| 504 | ⚠ `<Model>` error 504 · Gateway Timeout |
| 500 | ⚠ `<Model>` error 500 · Internal Server Error |
| 429 | ⚠ `<Model>` error 429 · Too Many Requests |
| Connection dropped | ⚠ `<Model>` connection dropped · No response |

Then, for every kind:

> `<Model>` said: `<words>` · [status page]
> Your work so far is kept. Retrying in 4:59 · no charge while waiting

(For 429 the countdown is the longer of 5 minutes and the wait the provider names. When the provider sends no words, the "said" part is left out.)

**When it answers again:**

> ✓ `<Model>` is answering again · picking up where it stopped

**When the customer presses Stop while waiting:**

> Stopped. Nothing was built or charged for this part.
