# Attach & billing verification harnesses

Manual tools (not CI — they need a browser and a signed-in session). They exist
because the Gemini clip-cap bug was invisible to every static check: the tables
agreed with each other and disagreed with reality.

Run against a local copy of `public/`:

```sh
cd public && http-server -p 8099 -s --cors &      # serve the app
export ATTACH_OUT=/tmp/attach-check                # session.json + fixtures live here
# write $ATTACH_OUT/session.json: {access_token, refresh_token, expires_at, user}
node test/attach/pricecheck.mjs                    # quote (browser) vs charge (worker)
node test/attach/mediacheck.mjs                    # audio + image validators, every model
node test/attach/matrix.mjs                        # every synthetic clip x every model
python3 test/attach/falcheck.py                    # every cap vs fal's published schema
```

`session.json` is NOT committed — supply your own.

## What each one answers

- **falcheck.py** — fetches `fal.ai/api/openapi/queue/openapi.json` for every
  endpoint the worker routes to and prints the constraints fal documents. This
  is the only check backed by something other than our own opinion.
- **pricecheck.mjs** — drives `estimatePrice()` in the real page and
  `creditCost()` lifted from `worker.js` over the same inputs, including the
  special billing bases (Veo extend's fixed 7s, Veo reference's 8s, the
  whole-clip edits, Seedance's 0.6x reference basis). A mismatch means the
  button lies about the charge.
- **matrix.mjs** — pushes synthetic clips (1-31s, 360p-4K, 23.98/30/60fps,
  mp4/mov/webm) through every model's validators. Generate fixtures with the
  ffmpeg recipe in the git history; drop them in `$ATTACH_OUT/tv` with a
  `tvmeta.json` of ffprobe-measured truth — headless Chromium has no H.264, so
  its own decode returns zeros and would silently pass everything.
- **mediacheck.mjs** — audio duration/size/format and image dimension/aspect
  limits, per model.
