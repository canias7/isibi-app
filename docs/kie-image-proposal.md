# Kie.ai: an implementation-ready proposal for ONE image capability

**Status: a proposal. Nothing here is implemented, nothing is merged, no call
has been made to Kie, and no model has been chosen.** Written 2026-09-19 from
the provider's own current documentation, against this repository's code as it
stands. The owner's instruction was *"prepare an implementation-ready proposal…
Do not choose a paid model or make a paid call on my behalf."*

---

## 0. The one capability, and why it is the first

**Text-to-image, for the photographs on a generated site.** It is the only
capability where this platform already has every hop built except the provider
call: a prompt goes in, bytes come back, they are sniffed, hashed, stored under
the owner's own uploads and swapped into a page's `src`. The seam is one
function.

Everything else Kie sells — video, music, image EDITING — has no such seam here
and would need new architecture before a provider question even arises. **Image,
video and audio are kept strictly apart in this document.** Supporting one gives
us none of the others, and the reasons are in §8.

---

## 1. The seam, named exactly

```
worker.js:2419   async function genSitePhoto(env, prompt) -> Uint8Array   (throws)
worker.js:2461   async function makeSitePhoto(env, slug, prompt) -> {url, error?}
worker.js:2405   const SITE_IMG_MODEL = "fal-ai/nano-banana-pro"
```

`genSitePhoto` is the WHOLE provider surface. It does three things:

1. `POST https://fal.run/fal-ai/nano-banana-pro` with
   `{prompt, aspect_ratio, resolution: "2K", output_format: "jpeg", num_images: 1}`
   and `Authorization: Key ${env.FAL_KEY}`, under `AbortSignal.timeout(120000)`.
2. Reads `d.images[0].url` out of the JSON answer.
3. `fetch`es that url under `AbortSignal.timeout(30000)` and returns the bytes.

**Nothing above it is provider-specific.** `makeSitePhoto` sniffs the bytes
(`sniffImage` — the one thing between an image model's answer and a stored XSS),
bounds them at `MAX_UPLOAD_BYTES`, hashes them SHA-256, and PUTs them to
`uploads/<slug>/<hash>.<ext>` through `uploadKey`/`uploadUrl`. `buySitePhotos`
prices, budgets and places. The coverage reader, the reply sentences and the
requirement identity all read the PLACEMENT, not the provider.

**So the whole integration is: `genSitePhoto` gains a second implementation, and
one flag decides which runs.** That is the proposal. Everything below is detail
about making that one function honest.

---

## 2. What Kie's API really is (quoted from its own docs, 2026-09-19)

Kie is a **broker**: one account, one key, many upstream models, ONE async job
protocol for all of them.

### Create

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer <KIE_KEY>
Content-Type: application/json

{
  "model": "bytedance/seedream-v4-text-to-image",
  "callBackUrl": "https://…",                 // optional
  "input": {
    "prompt": "…",                            // required, max 5000 chars
    "image_size": "square_hd",                // default "square_hd"
    "image_resolution": "1K",                 // "1K" | "2K" | "4K", default "1K"
    "max_images": 1,                          // 1–6, default 1
    "seed": 12345,                            // optional
    "nsfw_checker": false                     // default false
  }
}
```

Answer: `{"code": 200, "msg": "success", "data": {"taskId": "task_…"}}`.

> **"A `200 OK` response only means the task was successfully created. It does
> not mean the task is completed."** — docs.kie.ai, verbatim.

### Read

```
GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<taskId>
Authorization: Bearer <KIE_KEY>
```

```json
{ "code": 505, "msg": "success", "data": {
  "taskId": "task_12345678",
  "model": "grok-imagine/text-to-image",
  "state": "success",
  "param": "{…}",
  "resultJson": "{\"resultUrls\":[\"https://example.com/generated-content.jpg\"]}",
  "failCode": "", "failMsg": "",
  "costTime": 15000, "completeTime": 1698765432000,
  "createTime": 1698765400000, "updateTime": 1698765432000,
  "progress": 45, "creditsConsumed": 50 } }
```

**`state` is one of `waiting` · `queuing` · `generating` · `success` · `fail`.**
Two things in that shape matter and are easy to miss:

- **`resultJson` is a STRING containing JSON**, not an object. It has to be
  parsed, and a parse failure is a real outcome rather than an impossibility.
- **The `code` in the example is `505`, not `200`, on a SUCCESSFUL read.** So
  the envelope's `code` cannot be used as the success test; `data.state` is the
  only thing that says what happened. Any reader that branches on `code === 200`
  here is wrong, and the docs' own example is what proves it.

### Callback (webhook), if used

`POST` to the `callBackUrl`, `Content-Type: application/json`, a **15-second**
response timeout, **at most 3 retries**, and the docs tell integrators to make
processing idempotent because *"taskIds may receive multiple callbacks"*.

**There is NO signature, HMAC or verification mechanism documented for the
callback.** That is stated here as a finding, not a footnote: an unauthenticated
webhook that causes a spend or a write is a door anybody can knock on. §6 is
built around not needing it.

---

## 3. The proposed change, hop by hop

### 3a. One provider module, two implementations, one flag

`builder/site-photo-provider.mjs` (new, root-adjacent, dependency-free except a
`fetch` it is handed) exports:

```js
export async function photoBytes(env, prompt, { fetch, sleep, now } = {})
```

— the same contract `genSitePhoto` has today: **prompt in, bytes out, throws on
every failure.** `worker.js`'s `genSitePhoto` becomes a two-line delegate.

`env.PHOTO_PROVIDER` picks: `"fal"` (the default and the current behaviour, byte
for byte) or `"kie"`. **Absent or unrecognised reads as `"fal"`** — cannot-tell
must never silently move a money path to a provider nobody chose.

### 3b. The Kie implementation collapses the async job into the sync seam

```
createTask  ->  taskId
   poll recordInfo every POLL_MS until state is terminal, or the bound is hit
   state === "success"  ->  JSON.parse(resultJson).resultUrls[0]  ->  fetch bytes
   state === "fail"     ->  throw new Error("photo kie " + failCode + " " + failMsg)
   bound hit            ->  throw new Error("photo kie timeout after Nms, last state: …")
```

**Why polling rather than the webhook.** The webhook is the architecturally
"right" answer and is the wrong first step here, for three reasons that are
facts about this repository rather than preferences:

1. **The caller is synchronous and the seam is a function that returns bytes.**
   A webhook needs a public route, a place to park the result, and a way to wake
   the waiting caller — three pieces of machinery, each with its own failure
   modes, to replace one loop.
2. **There is no signature to verify.** A public `/api/kie/callback` that nobody
   can authenticate would be an unauthenticated inbound request that causes a
   spend to be recorded. **This platform's two existing inbound webhooks both
   verify**: Stripe's (`stripe-webhook.mjs` — `hmacHex`, the `t=…,v1=…` header)
   and a site's own (`site-inbound.mjs`, wired at `worker.js:7271`). Adding a
   third that cannot would be a new posture, not a new route.
3. **The clock is already ours.** Since 2026-09-14 the addon and the build run
   in the site's own CONTAINER with `CONTAINER_*_BUDGET_MS` at `Infinity`, so a
   two-minute poll is affordable where it matters. On the Worker path the
   isolate's own ceiling bounds it, which is the honest bound either way.

**The bound is a constant and is stated, not inherited.** `KIE_MAX_MS` should be
the same **120 000 ms** `genSitePhoto` already gives fal's synchronous call, so
switching providers cannot silently change how long a build waits for a picture.
`POLL_MS` 2 000 with the first poll after 3 000 (the docs' own worked example
reports `costTime: 15000`, so a sub-second first poll is pure waste).

### 3c. The result url is fetched, not stored

Kie's callback docs say an image url is **"valid for 10 minutes"** (stated for
`originImageUrl` on the flux-kontext callback page). **We must not store a Kie
url in a page's `src`** — and we already do not: `makeSitePhoto` downloads the
bytes and serves them from `uploads/<slug>/`, which is exactly the behaviour
that makes an expiring provider url a non-issue. **This is worth stating because
it is the single most likely way an integration like this goes wrong**, and the
existing code is already right about it.

### 3d. Nothing else changes

The sniff, the size bound, the hash, the R2 key, the placement, the billing, the
customer sentence, the coverage reader — all provider-agnostic and all untouched.

---

## 4. Credentials

- **`KIE_KEY`**, a GitHub Actions secret uploaded to the Worker each deploy,
  exactly as `FAL_KEY` is. It is **ours**, not the site owner's — this is
  platform spend on the platform's own provider, the same posture `FAL_KEY` has.
  (The bring-your-own rule in CLAUDE.md is about a site sending mail or taking
  payment AS THE BUSINESS. A generated photograph is our cost of goods.)
- **It must carry a `|| fallback` in `deploy.yml`**, because it is OPTIONAL until
  the flag is flipped, and this repository has shipped three merges that deployed
  nothing because a required secret name had no value.
- **The key never leaves the Worker or the job child.** The container job already
  receives its provider credentials through `makeContainerEnv`; `KIE_KEY` joins
  that list only if the container path buys photographs, which it does.
- **`scrubProvider` already covers the failure text.** `makeSitePhoto` runs every
  provider error through it before putting it on the wire, and that stays.

---

## 5. Failure, timeout and retry — stated per case

| what happens | what `photoBytes` does | what the customer sees |
|---|---|---|
| `createTask` non-200, or no `taskId` | throw `"photo kie create <status>"` | *"Couldn't make the photographs this time"* — the existing sentence |
| `recordInfo` transient failure | **retry the poll**, up to `KIE_READ_FAILS` (3) consecutive; then throw | as above |
| `state: "fail"` | throw with `failCode` + `failMsg` | as above, plus the reason in the log |
| terminal state never arrives inside `KIE_MAX_MS` | throw `"photo kie timeout"` **naming the last state seen** | as above |
| `resultJson` unparseable, or `resultUrls` empty | throw `"photo kie no image"` | as above |
| the result url 404s or is expired | throw `"photo kie fetch <status>"` | as above |
| bytes are not a picture | **existing** `sniffImage` refusal | as above |

**A failed attempt is NOT retried as a new task.** One `createTask` per picture,
which is what makes the charge question in §7 answerable at all. A retry would
be a second generation and a second charge for one slot, and the current design
(one shot per token, a placeholder if it fails) is the honest one.

**`AbortSignal.timeout` on every single request**, as `genSitePhoto` already
does — this repository has a recorded case of a `node:https` call with no signal
sitting on a black-holed socket until the job's own deadline.

---

## 6. How charges relate to successful outputs — and the one real gap

**Today, with fal:** `genSitePhoto` is synchronous, so "the call returned bytes"
and "we were charged" are the same event, and `buySitePhotos` bills on `made`
— a photograph that did not arrive costs the customer nothing. **Run 51 is the
live proof**: the provider refused, 13 credits were charged for the page and the
QR code, and the picture that never arrived cost nothing.

**With Kie, that stops being automatic**, and this is the honest centre of the
proposal:

> `recordInfo` reports **`creditsConsumed`**. A task that reaches `state:
> "fail"` may still have consumed credits, and a task we ABANDON at
> `KIE_MAX_MS` is still running on their side and will consume credits whether
> or not we ever read the answer.

So there are three distinct quantities where fal had one:

1. **What Kie charges us** — `creditsConsumed`, readable only from `recordInfo`,
   and only if we read it.
2. **What we charge the customer** — `IMAGE_USD / CREDIT_USD` ≈ **18.75 credits**
   per photograph, flat, billed on `made`.
3. **What we abandoned** — a task past the bound, charged upstream and never
   delivered.

**The proposal: bill the customer exactly as today (on `made`), and record
`creditsConsumed` for OURSELVES.** The customer's price is a flat platform price
and must not move with a broker's per-model rate; what changes is that the
platform can now see its own cost per picture, which it cannot today.
`creditsConsumed` rides the same trace mark the photo step already writes.

**And the abandonment gap is stated rather than designed around**: a timeout
leaves a task we paid for and did not use. Bounding it is the cost of keeping
the seam synchronous, it is small at one picture per slot, and it is the one
thing a webhook would fix. Recorded as the reason to revisit the webhook later,
not as a reason to build it first.

---

## 7. Which model — and why this is the owner's decision, not mine

**I am not choosing one, and no paid call has been made.** What is established:

- The **contract is identical across every Market model** — `createTask` with a
  `model` string and an `input` object, `recordInfo` to read. So the integration
  is model-agnostic and the choice is a one-string change afterwards.
- `bytedance/seedream-v4-text-to-image` is documented in full and is the
  concrete example used above; `seedream/4.5-text-to-image`,
  `seedream/5-lite-text-to-image`, `grok-imagine/text-to-image`, GPT Image and
  Flux-2 families are all on the same protocol.
- **Per-model pricing is NOT in the public docs I could read.** `kie.ai/market`
  and `kie.ai/billing` both returned only a page title to an unauthenticated
  fetch; `creditsConsumed` appears only as an example value (`50`) in a response
  sample, with no credit-to-USD rate stated anywhere I could reach.

**So the decision needs two numbers I cannot get without an account**: the
credit-to-USD rate, and the credits per image for the candidate models. Both are
on the owner's side of a login. **Checked per model, not assumed from one page**:
`seedream/5-lite-text-to-image`'s own doc states no price, no credit cost, no
rate limit and no result-url expiry, and `bytedance/seedream-v4-text-to-image`'s
states none either. **The 10-minute url validity is documented on the
flux-kontext callback page alone** — so it is one family's stated behaviour
rather than a platform-wide promise, and §3c's rule (never store a provider url)
is what makes that not matter.

**One thing worth knowing before picking**: the two model families differ in how
they take the shape of the picture. Seedream 4.0 takes `image_size` +
`image_resolution` (`1K`/`2K`/`4K`); Seedream 5 Lite takes `aspect_ratio` (eight
named ratios) + `quality` (`basic`/`high`/`ultra`). **Ours is an aspect ratio**
— `IMAGE_ASPECT`, which `genSitePhoto` already sends fal — so the 5-Lite shape
maps onto what this platform already decides and the 4.0 shape would need a
translation table. That is an argument about fit, not about quality or price,
and the owner's two numbers still decide.

**The options, as they stand:**

| | keep fal only | add Kie behind the flag, default fal | move to Kie |
|---|---|---|---|
| work | none | one module, one flag, one `deploy.yml` line | the same, plus a flip |
| risk | none | none until the flag moves — the default path is byte-identical | a money path on one live provider with an async protocol never exercised here |
| buys | nothing | a second provider, a measured cost per picture, and a fallback the day fal is down | whatever the price difference is, which is unknown from here |

**Recommendation: the middle one.** Build the seam and the Kie implementation,
leave `PHOTO_PROVIDER` defaulting to `fal`, and make the first Kie call a
deliberate press rather than a deploy. It is reversible, it is the smallest
thing that makes the question answerable with real numbers, and it does not put
a customer's build on an untested provider to find out.

**The first measurement after that is one generated photograph**, which needs a
funded Kie account and is a spend — so it is the owner's press, exactly as every
paid harness here is.

---

## 8. What this deliberately does NOT do

- **No video.** Kie sells it and we have nowhere to put it: `sniffImage` and
  `sniffUpload` between them admit png · jpg · webp · gif · pdf · the zip family
  and **no video or audio container at all**, so a generated film has no storage,
  no serving path and no component that takes a hosted url. That is three pieces
  of work before a provider question arises.
- **No music or audio**, for the same reason and with the same measurement.
- **No image EDITING** (image-to-image, upscale, inpaint). Kie offers all three;
  this platform has no rung that asks for one — the `picture` rung swaps a whole
  photograph and the `logo` rung takes an upload. A new capability, not a
  provider change.
- **No new addon kind.** A provider name is not a thing a customer asks for, and
  `ADD_KINDS` is a list of things they do ask for.
- **No generalisation of the asset pipeline.** The text-to-image capability needs
  exactly one function to change; nothing about it requires the pipeline to learn
  about providers, and a generic layer built for one implementation is a guess.

---

## 9. What to build, in order, if the owner says go

1. `builder/site-photo-provider.mjs` with `photoBytes`, both implementations,
   `fetch`/`sleep` INJECTED so every branch is drivable with no network.
2. `genSitePhoto` becomes a delegate; `SITE_IMG_MODEL` moves into the fal
   implementation. **The fal path must be proved byte-identical** — same url,
   same body, same headers, same two timeouts — by a guard that reads the
   request that really went out.
3. `test/site-photo-provider.test.mjs`: every row of §5's table, the `state`
   machine through all five values, `resultJson` as a string, the `code: 505`
   success (the docs' own example — a reader that branches on `code === 200` is
   red here), the bound, the poll cadence on a fake clock, and the default-to-fal
   rule over junk flag values.
4. `deploy.yml`: `KIE_KEY` with its `|| fallback`, and `PHOTO_PROVIDER` likewise.
5. A mutation sweep with a comment-only control, as every change here ships with.
6. **Then stop.** The live proof is one paid generation and it is the owner's.

**Nothing in steps 1–5 spends a penny or contacts Kie.**

---

## 10. Sources

- https://docs.kie.ai/ — the async task model and the "200 means created"
  sentence
- https://docs.kie.ai/market/quickstart — `createTask` / `recordInfo` addresses
- https://docs.kie.ai/market/common/get-task-detail — the `recordInfo` response
  and the five `state` values
- https://docs.kie.ai/market/seedream/seedream-v4-text-to-image — a concrete
  model's `input` shape (`image_size` + `image_resolution`)
- https://docs.kie.ai/market/seedream/5-lite-text-to-image — a second model's,
  which takes `aspect_ratio` + `quality` instead; and the explicit absence of a
  price, a credit cost, a rate limit and a url expiry
- https://docs.kie.ai/flux-kontext-api/generate-or-edit-image-callbacks — the
  callback payload, the 15-second timeout, the 3 retries, the 10-minute url
  validity, and the absence of any signature
- https://kie.ai/market — modalities only; pricing not reachable unauthenticated
