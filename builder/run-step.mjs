// Running one build step — bounded, and killed all the way down.
//
// A LEAF MODULE, and that is why it exists at all. `build-server.mjs` listens on
// a port at import time, so nothing can import it to test it; the timeout path
// below is the one part of that file whose failure is invisible from outside,
// because it produces a build that LOOKS like it failed cleanly while a process
// belonging to the previous customer is still writing into the tree the next one
// is about to reset. Same split `exit-reason.mjs` already has, for the same
// reason.
//
// WHAT WAS WRONG, both halves measured against the shape rather than guessed:
//
//   1. `child.kill("SIGKILL")` SIGNALS ONE PROCESS. Every step is `npx <tool>`,
//      and npm's exec runs the tool as its own child — so the signal reached
//      `npx` and `vite`/`tsc` carried on. `spawn` was called with no `detached`
//      either, so there was no process group to signal even if somebody had
//      tried.
//
//   2. THE TIMER RESOLVED IMMEDIATELY. `resolve(...)` sat beside the kill rather
//      than after the child's `close`, so `run` returned while the child was
//      still alive, `oneAtATime` released, and the NEXT build's `resetRoutes()`
//      — an `rm -rf` of `src/routes` and `dist` — could start with the orphan
//      still emitting into `dist/client/assets/`. One customer's content-hashed
//      chunks landing in another customer's published bundle is exactly the
//      class `oneAtATime` and `resetRoutes` exist to prevent, arriving through
//      the one path neither of them guarded.
//
// So: a process GROUP, killed as a group, and the promise settles on `close`
// rather than on the kill — with a bounded grace, because a `run` that waits
// forever for a child that will not die is a worse failure than the one being
// fixed. `timed out after Ns` is preserved verbatim as `err` because
// `exitReason` returns whatever a step SAID in preference to any diagnosis of
// its own, and that sentence is what an operator reads.
import { spawn } from "node:child_process";

/** How long to wait for a killed step to actually close before giving up on it. */
export const KILL_GRACE_MS = 5000;

/**
 * Kill a step and everything it started.
 *
 * THE GROUP FIRST, and the fallback is not belt-and-braces: `process.kill(-pid)`
 * throws ESRCH when the group is already gone (the ordinary race with a child
 * that exited between the timer firing and this line) and it throws EPERM on a
 * platform with no process groups at all. Falling through to the direct kill is
 * what keeps the old behaviour as a floor rather than replacing it.
 *
 * Both are fenced, because a kill that throws inside a timer callback is an
 * uncaught exception, and an uncaught exception in this process is the whole
 * build service dying mid-build for every customer queued behind it.
 */
export function killTree(child) {
  const pid = child && child.pid;
  if (!pid) return false;
  try { process.kill(-pid, "SIGKILL"); return true; } catch {}
  try { child.kill("SIGKILL"); return true; } catch {}
  return false;
}

/**
 * Run a build step and hand back what it said.
 *
 * `{ code, signal, out, err }` — the shape `exitReason` reads, unchanged. THE
 * SIGNAL IS CARRIED, not just the code: a killed process closes with `code:
 * null` and the signal that killed it, and `null !== 0` reads as an ordinary
 * failure, so a SIGKILL was once reported as a build that failed for no stated
 * reason.
 *
 * NEVER REJECTS. Every caller treats the result as data; a rejection here would
 * escape into the build handler's catch-all and report a spawn problem as a
 * generic build failure with no stage.
 */
export function runStep(cmd, args, opts = {}) {
  const { cwd, env, timeout = 150_000, killGrace = KILL_GRACE_MS, ...rest } = opts;
  return new Promise((resolve) => {
    let child;
    try {
      // DETACHED SO THERE IS A GROUP TO SIGNAL. On POSIX this makes the child a
      // process-group leader, so `kill(-pid)` reaches `npx`, the tool `npx`
      // execs, and anything either of them started. Without it the kill reaches
      // one process and the real work carries on.
      child = spawn(cmd, args, { cwd, env, detached: true, ...rest });
    } catch (e) {
      return resolve({ code: -1, signal: null, out: "", err: String((e && e.message) || e) });
    }

    let err = "", out = "", timedOut = false, settled = false, grace = null;
    const timedOutErr = "timed out after " + Math.round(timeout / 1000) + "s";
    const settle = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      if (grace) clearTimeout(grace);
      resolve(v);
    };

    if (child.stdout) child.stdout.on("data", (d) => { out += d; });
    if (child.stderr) child.stderr.on("data", (d) => { err += d; });

    const to = setTimeout(() => {
      timedOut = true;
      killTree(child);
      // AND THEN WAIT FOR IT, which is the half that was missing. `close` fires
      // once the child is gone AND its pipes are closed, so settling on it is
      // the only thing that can promise the tree is quiet before the caller
      // resets the directory it was writing into. Bounded, because a promise
      // that can never settle is a build service that never serves again.
      grace = setTimeout(() => settle({ code: -1, signal: "SIGKILL", out, err: timedOutErr }), killGrace);
    }, timeout);

    child.on("close", (code, signal) => {
      settle(timedOut ? { code: -1, signal, out, err: timedOutErr } : { code, signal, out, err });
    });
    child.on("error", (e) => {
      killTree(child);
      settle({ code: -1, signal: null, out, err: String((e && e.message) || e) });
    });
  });
}
