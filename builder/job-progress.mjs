// A JOB'S PROGRESS, SAID ACROSS THE PROCESS LINE (2026-10-30).
//
// The owner: "no limit" on how long a task runs. A container job is no longer
// stopped at a fixed wall-clock deadline; the build service stops it only when
// it has made NO PROGRESS for `NO_PROGRESS_MS` (`job-clock.mjs`). The service
// counts every line the child writes as progress, so inside a container job
// (`JOB_ID` set by the service) this writes one short line, at most every
// `NOTE_EVERY_MS`, whenever the agent finishes a round or a tool. Outside a
// container job (the Worker, the tests) it does nothing.

/** The fewest milliseconds between two progress lines (the watchdog's window is minutes). */
export const NOTE_EVERY_MS = 30_000;

let lastAt = 0;

/** Say "still working" to the build service; cheap, never throws. */
export function noteProgress(what = "", { now = Date.now(), write = null, inJob = null } = {}) {
  const job = inJob !== null ? inJob : typeof process !== "undefined" && !!(process.env && process.env.JOB_ID);
  if (!job) return false;
  if (now - lastAt < NOTE_EVERY_MS) return false;
  lastAt = now;
  try {
    const w = write || ((l) => process.stdout.write(l));
    w("progress " + String(what).slice(0, 40) + "\n");
  } catch { return false; }
  return true;
}

/** Tests only: forget the last note. */
export function resetProgressNote() { lastAt = 0; }
