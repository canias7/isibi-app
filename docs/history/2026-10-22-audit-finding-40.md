# Audit finding 40 (2026-10-22): the rest of A22-1 and A23-1

What was left of A22-1 / A23-1 (`docs/audits/2026-10-17-builder-audit.md`) after the 2026-10-18 fix moved the page fan-out to `/model/start` and polling. Offline; nothing spent; not merged or deployed.

## What was still real

- **Inside a container job, every `getContainer(...).fetch` is `builder/containers-shim.mjs`**, which called Node's global fetch (undici). undici's headers timeout is 300 s and no longer AbortSignal moves it (`docs/containers-and-jobs.md`, `builder/long-post.mjs`).
- **The compile hop `http://build/build`** (the spine's compile in `worker.js` near line 17072, the build's near 18611, both inside `withRoom` with a signal of up to about 10 minutes): `build-server.mjs` answers `/build` with one `send(...)` after the whole compile, so no header arrives before it ends. A compile over 300 s in a job died as `TypeError: fetch failed` and could be read as the change not building. Confirmed by reading; not reproduced live.
- **The synchronous `/model` fallback** (`containerPagesCall`, near line 6076, used when `/model/start` is not taken, and the third branch near 18229): the same, one connection held for the whole generation.
- **`/job/run`** is fired by the Worker (workerd, no such wall) and answers at once; not affected. `/model/start`, its polls and `/health` answer in milliseconds; not affected, but they now ride the same transport.

## The fix

- **`longFetch` in `builder/long-post.mjs`**: the long-call transport (`node:http`, no headers or body timeout, keepalives, the caller's signal the one bound and its reason the rejection) answering a real `Response` (status, headers, streamed body), because `worker.js` reads these hops as a whole Response, which `longPost`'s four-field answer is not.
- **The shim sends every hop over it**, reading the request body once and passing the method, headers and signal. One transport for every path, nothing to choose per URL. Chosen over a start-and-poll `/build`, which would change the build service, the Worker's two compile call sites and their room handling.
- **The Worker's own path is unchanged**: `worker.js` is not touched and never imports `long-post.mjs` (a guard checks it); the shim is loaded only inside the container (`worker-loader.mjs`).

## Tests

- `test/job-hop-transport.test.mjs`, 5 cases. Global fetch is replaced by a stand-in that fails as undici does ("fetch failed") after a scaled 150 ms headers limit; the build service sends headers only after 600 ms. For `/build` and `/model`, the job hop must not touch global fetch and must bring back status, headers and the whole body, with the request body intact. Plus: an abort before the headers rejects with the signal's `TimeoutError` at the signal, a GET poll answers a real Response, and `worker.js` has no import of `long-post`.
- **Red check**: on the old shim, the `/build` and `/model` cases fail (3 pass, 2 fail).
- Related files (this test, `container-runtime`, `dockerfile`, `long-post*`, `container-job*`): 61 / 61.
- Full suite: `11652 / 11647 / 2 / 3` (tests / pass / fail / skipped). The 2 failures (`media-verify` THE BROWSER MODE, `no-generated-deps` node_modules of any form) fail identically with this change set aside (11 pass, 2 fail on those two files), so they come from this environment, not from this change.

## The image

`builder/containers-shim.mjs` and `builder/long-post.mjs` are container image inputs, so **the next deploy carrying this rolls the image**: predict it before the merge and wait 15–20 minutes after.
