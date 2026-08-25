// THE PUBLIC ANON KEY, READ OUT OF THE FRONTEND THAT ALREADY SHIPS IT.
//
// `secrets.SUPABASE_ANON_KEY` HAS NEVER EXISTED in this repo. Five workflows
// name it and it arrives EMPTY in all five: `build-as-owner`'s first run died on
// it, its own comment records that, and the container hold probe's first run
// then died on it again in 0.0 seconds because a new script did not inherit the
// fallback.
//
// It is not a secret anybody needs to find. The anon key is the PUBLIC client
// key — `public/auth.js` sends it on every page load — so the answer is to read
// our own frontend rather than to hunt through repository settings for a value
// that was never put there.
//
// A MODULE RATHER THAN A COPY, and a mutation sweep is why. A source-reading
// test that RESTATES this regex asserts its own copy: mutating the probe's
// regex left it perfectly green — measured, it SURVIVED. Exported here, the
// test DRIVES the real extraction, so a pattern that stops matching fails at
// the one place that would otherwise only surface as a live probe dying at its
// own guard, six weeks later, looking exactly like a missing secret.
//
// This is `readSchemaTool`'s precedent: a harness that restates what it is
// checking eventually tunes something subtly different from what really runs.
import fs from "node:fs";

export function anonKeyFromFrontend() {
  const src = fs.readFileSync(new URL("../public/auth.js", import.meta.url), "utf8");
  const m = src.match(/const SUPABASE_ANON_KEY\s*=\s*\n?\s*'([A-Za-z0-9._-]+)'/);
  return m ? m[1] : "";
}
