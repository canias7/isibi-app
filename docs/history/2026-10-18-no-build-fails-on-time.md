# No build fails on time alone (2026-10-18)

On the owner's word ("no build should ever fail, specially when it comes to time"), after the live Harbour Loaf build.

## The failure

The build was the test account's first build: a 317-word prompt for five pages. It was refunded in full except routing, 97 credits left.

- **What happened.** The page step ran 602,445 ms and ended with `fetch failed`.
- **The cause.**
  - A plan of several pages is not split, so the whole site is one model call. Inside the container it went to the build service as one synchronous hop: `containerPagesFanLocal` → `containerPagesCall` → `getContainer(...).fetch` → Node's global fetch (`builder/containers-shim.mjs`).
  - The build service answers `/model` only when the whole site is written. Node's undici gives up on a response that has not begun within 300 seconds, and that limit cannot be raised from fetch.
  - The hop's `TypeError` read as "the container was unreachable" (`retryHere`). So the fallback called the model directly with `callModel(keys, req, budget)`: no sender and no stream, Node's fetch again, cut at 300 seconds again.
  - 300 + 300 ≈ 602 seconds. The first generation also kept running in the build service, so the provider was paid twice.
- **Why small builds succeed:** a one-page plan's bands go through `/model/start`, which is started and then polled.

## The fix

1. `containerPagesFanLocal` starts a single request through `/model/start` and polls `/model/result`, exactly as a fan-out is handled. A service that will not start it falls back to the synchronous hop, as before. A failure keeps the provider's status, detail and class.
2. `containerPagesCall`'s fallback uses the job's own transport: `modelSend(env)` and `modelOpts(env, null)`.
3. In the container, no stopwatch decides a call:
   - `STREAM_IDLE_MS` (5 minutes): a streamed call that sends nothing for that long is stopped as `IdleTimeoutError` by `longPost`. Every byte restarts the clock.
   - `CONTAINER_CALL_CAP_MS` (40 minutes): only a backstop, inside the job's own deadline. It replaces the Worker's 10 minutes at the build service and on the job's calls (`opts.capMs`).
   - `patientCall`: a call that died for any reason other than a provider's own status is asked again, up to `MODEL_CALL_TRIES` (3). It wraps every build-service call and every container call made through `callBuilderModel`.

The Worker is unchanged: no sender, no options, and the same ten minutes.

## Tests

- New file `test/no-build-fails-on-time.test.mjs`:
  - PH1: a single call is started and polled, never held as one hop, and keeps the provider's shape on failure;
  - PH2: the fallback uses the job's sender, stream and silence limit;
  - LP1: a silent stream is stopped, a busy one is not, and nothing changes without `idleMs`;
  - PC1: retry rules.
- PR 4 now insists that the one call is started and polled.
- Ten guards were re-anchored to the new rule (the container ceiling instead of `BUILDER_CALL_MS`, calls wrapped in `patientCall`, `idleMs` on every container call). Each still asserts its property. Red on the old code: PR 4, and the new file cannot load.
- Sweep `scripts/mutants/no-build-fails-on-time.json`: 11 of 11 killed, control survived.
- Full suite `11498 / 11496 / 0 / 2`.

## Not done here

- Provider outages and an empty account still stop a build. They are answers, not time.
- The container job's own 50-minute deadline still stands as the outer backstop.
- Proving it live needs one paid rebuild of the Harbour Loaf prompt after a deploy.
