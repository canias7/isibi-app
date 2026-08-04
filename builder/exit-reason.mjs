// Why a build step failed, when the step itself said nothing.
//
// A LEAF MODULE — no imports, no side effects — and that is the point.
// `build-server.mjs` listens on a port at import time, so nothing can import it
// to test it; the first attempt to do so hung the test runner. Same split
// `site-errors.mjs` has, for the same reason.

/**
 * What a step failed with, when it said nothing at all.
 *
 * `stage:"build", error:"build failed"` is what the smoke reported on
 * 2026-08-04, and it is the least useful sentence this service can produce: it
 * names the step we already knew and adds nothing. It happens when a step exits
 * non-zero having written to neither stream, and the reason it writes nothing is
 * almost always that it never got to — it was killed rather than failing.
 *
 * Verified before writing this rather than assumed: `vite build --logLevel warn`
 * prints a genuine bundler error to stderr and exits 1 (measured: 1,025 bytes),
 * so a silent non-zero exit is NOT the log level swallowing a real diagnosis.
 *
 * Used for every step, not just the bundler — a silent `tsc` or `tsr generate`
 * is the same failure wearing a different stage.
 */
export function exitReason(step, r, { stdoutFirst = false } = {}) {
  // `tsc` reports on stdout and everything else on stderr, so which stream leads
  // is per-tool. Said out loud rather than by swapping the fields at the call
  // site, which is what the first draft did and reads as a bug.
  const said = stdoutFirst
    ? ((r.out || "") + "\n" + (r.err || "")).trim()
    : ((r.err || "") + "\n" + (r.out || "")).trim();
  if (said) return said;
  if (r.signal) {
    // SIGKILL with no output means the step never got the chance to fail — it
    // was killed. From in here the cause is genuinely indistinguishable, so both
    // candidates are NAMED and neither is asserted.
    //
    // The first draft said "usually means the container ran out of memory" and
    // that was a guess I then measured against: the container is `standard-1`
    // (4 GiB / half a vCPU / 8 GB disk) and `vite build` on this template peaks
    // at 618 MiB across all node processes, ~6x under the limit. So memory is
    // the WEAKER of the two, and the instance being stopped underneath a running
    // build is the one to look at first. Written down because the plausible
    // wrong answer is what a reader would otherwise chase.
    const why = r.signal === "SIGKILL"
      ? " — killed outright, so either the instance was stopped mid-build or it hit a resource limit"
      : "";
    return `${step} was killed by ${r.signal}${why} (no output)`;
  }
  return `${step} exited with code ${r.code} and wrote nothing to stdout or stderr`;
}
