// The boundary around the site's own server — spawn it, drop it, bound it, stop it.
//
// The parent half of `render-server-child.mjs`. That file explains WHY the
// model's server bundle may not run in this process; this one is the discipline
// around the process it runs in instead:
//
//   • SPAWNED, so a synchronous wedge in a component blocks a loop that is not
//     ours and can be SIGKILLed from a loop that is still turning.
//   • PRIVILEGE-DROPPED where the platform allows it, so model code cannot write
//     into the `/app` tree the NEXT customer's build reuses.
//   • BOUNDED PER REQUEST, so one slow render cannot hold the check open, and
//     bounded in TOTAL, so a wedged child cannot spin a core for the life of the
//     build.
//   • STOPPED in a `finally`, because a render check that leaks a server per
//     build is the module-registry leak it replaced wearing a process instead.
//
// A LEAF-ISH MODULE ON PURPOSE. `build-server.mjs` listens on a port at import
// time and cannot be imported by a test, and this is precisely the layer whose
// mistakes are invisible from outside — a drop that silently did not happen, a
// timeout that cannot fire, a child that is never reaped. All of it is driven
// directly in `test/render-sandbox.test.mjs`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { killTree } from "./run-step.mjs";

/** The child, resolved from THIS file rather than from APP or the cwd: it is
 *  part of the build SERVICE, not of the template the service builds. */
export const RENDER_CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "render-server-child.mjs");

/** How long the child gets to load a multi-megabyte bundle and listen. */
export const SSR_START_MS = 20_000;
/** One document. Generous — a cold first render pulls in the whole kit — and
 *  finite, which is the point: nothing on this path may wait forever. */
export const SSR_REQUEST_MS = 10_000;
/** The whole render check is budgeted at 25s; this is the wall behind it, so a
 *  child that is spinning cannot outlive the build that started it. */
export const SSR_LIFETIME_MS = 120_000;

/**
 * The uid/gid to run the site's server as, or null for "we cannot drop".
 *
 * NULL IS NOT A FAILURE, it is the honest answer on a host where the drop is not
 * available — a developer's machine, a CI runner, a container that already runs
 * unprivileged. The caller reports it rather than refusing, because refusing
 * would mean no render check at all anywhere but production.
 *
 * ONLY FROM ROOT. `setuid` needs the privilege it is giving up; asking for it as
 * an ordinary user makes `spawn` throw EPERM, which would turn "we could not
 * confine it" into "there is no render check".
 *
 * READ OFF /etc/passwd rather than hardcoded, and refuses uid 0 explicitly — a
 * passwd entry naming root would be a drop to nothing wearing the shape of one.
 */
export function renderAs(user = process.env.RENDER_USER || "node") {
  try { if (typeof process.getuid !== "function" || process.getuid() !== 0) return null; } catch { return null; }
  try {
    const row = fs.readFileSync("/etc/passwd", "utf8").split("\n").find((l) => l.startsWith(String(user) + ":"));
    if (!row) return null;
    const f = row.split(":");
    const uid = Number(f[2]), gid = Number(f[3]);
    return Number.isInteger(uid) && uid > 0 && Number.isInteger(gid) ? { uid, gid } : null;
  } catch { return null; }
}

/** A handle for a server that never started. Same shape as a live one, so no
 *  caller has to branch on whether it got one — `fetch` is null and `down()`
 *  says why, which is what makes the render check able to report honestly
 *  instead of blaming the site's pages for 404ing. */
const dead = (why, unprivileged) => ({
  ok: false, why, unprivileged: !!unprivileged, port: 0,
  fetch: null, down: () => why, stop: () => {},
});

/**
 * Start the site's own server in a child process and hand back a fetch into it.
 *
 * → { ok, why, unprivileged, port, fetch, down, stop }
 *
 *   fetch(Request) → Response          proxied to the child, bounded
 *   down()         → "" | reason       "" while it is healthy
 *   stop()         → undefined         idempotent; kills the group
 *
 * NEVER REJECTS AND NEVER THROWS. This is a diagnostic's dependency, not the
 * build's: a bundle that will not load must cost a render report and never a
 * site.
 */
export function startSiteServer(bundle, opts = {}) {
  const {
    childPath = RENDER_CHILD,
    as = renderAs(),
    startMs = SSR_START_MS,
    requestMs = SSR_REQUEST_MS,
    lifetimeMs = SSR_LIFETIME_MS,
    cwd,
    env,
  } = opts;

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [childPath, String(bundle || "")], {
        cwd,
        env: env || process.env,
        // DETACHED, so `stop()` signals a GROUP. The bundle runs in Node here,
        // not in workerd, so model code that reaches for `node:child_process`
        // really can start something — and a kill that reaches one process
        // leaves it running in a container shared by every customer.
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
        ...(as || {}),
      });
    } catch (e) {
      // EPERM here is the drop being refused, which is worth naming: it reads
      // identically to a broken bundle otherwise, and the fixes are opposite.
      return resolve(dead("could not start the site's server: " + String((e && e.message) || e), as));
    }

    const state = { down: "", stopped: false };
    let settled = false;
    let buf = "", stderr = "";

    const stop = () => {
      if (state.stopped) return;
      state.stopped = true;
      clearTimeout(startTimer);
      clearTimeout(lifeTimer);
      killTree(child);
      // The pipes are ours; releasing them is what lets this process exit even
      // if the child ignores the signal for a moment.
      try { child.stdin.end(); } catch {}
      try { child.stdout.destroy(); child.stderr.destroy(); } catch {}
    };

    const settle = (v) => { if (!settled) { settled = true; clearTimeout(startTimer); resolve(v); } };
    const fail = (why) => { stop(); settle(dead(why, as)); };

    const startTimer = setTimeout(
      () => fail("the site's server did not start within " + Math.round(startMs / 1000) + "s"),
      startMs,
    );

    // THE WALL BEHIND THE PER-REQUEST TIMEOUT. A per-request abort frees the
    // CALLER; it does nothing about a child spinning a core, and this container
    // is half a vCPU shared by every build. `unref` so a stopped server's timer
    // can never hold the build service open.
    const lifeTimer = setTimeout(() => {
      state.down = state.down || "the site's server ran past its " + Math.round(lifetimeMs / 1000) + "s budget and was stopped";
      stop();
    }, lifetimeMs);
    if (typeof lifeTimer.unref === "function") lifeTimer.unref();

    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const s = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!s) continue;
        let msg;
        // A HALF-WRITTEN LINE IS SKIPPED, never guessed at. The one shape that
        // must not happen is a truncated line being read as a verdict.
        try { msg = JSON.parse(s); } catch { continue; }
        if (!msg || typeof msg !== "object") continue;
        if (msg.fatal) return fail(String(msg.fatal));
        if (Number.isInteger(msg.port) && msg.port > 0) return settle(live(msg.port));
      }
    });
    child.stderr.on("data", (d) => { stderr += String(d); });

    child.on("error", (e) => fail("could not start the site's server: " + String((e && e.message) || e)));
    child.on("exit", (code, signal) => {
      // BEFORE READY it is a start failure; AFTER ready it is a server that
      // stopped part-way, which the render check turns into an honest "the
      // check could not finish" rather than a finding against every page.
      const tail = stderr.trim().slice(-200);
      const why = "the site's server stopped" + (signal ? " (" + signal + ")" : code != null ? " (exit " + code + ")" : "") + (tail ? ": " + tail : "");
      if (!settled) return fail(why);
      if (!state.stopped) state.down = state.down || why;
    });

    function live(port) {
      return {
        ok: true,
        why: "",
        unprivileged: !!as,
        port,
        down: () => state.down,
        stop,
        fetch: async (request) => {
          const u = new URL(request.url);
          try {
            return await fetch("http://127.0.0.1:" + port + u.pathname + u.search, {
              method: "GET",
              // MANUAL, so a route that redirects is passed through exactly as
              // the in-process loader passed it. Following would make this
              // process fetch whatever the model's code pointed at, which is a
              // capability the boundary exists to withhold.
              redirect: "manual",
              signal: AbortSignal.timeout(requestMs),
            });
          } catch (e) {
            if (e && (e.name === "TimeoutError" || e.name === "AbortError")) {
              // A WEDGED RENDER TAKES THE SERVER DOWN, deliberately. It is
              // single-threaded, so the next request would time out too and the
              // report would come back as "every page threw" — a finding against
              // pages nobody ever opened. Naming the route and stopping is the
              // honest answer, and it also stops the spin. The cost, stated: a
              // page that hangs is reported as a check that could not finish
              // rather than as a serious finding, so the customer-facing note is
              // silent on it. A lie about seven other pages is worse.
              // AND THE MESSAGE HAS TO CARRY THE ROUTE, or this whole branch is
              // the failure it was written to prevent. `state.down || ""` left
              // an Error with an EMPTY message, which stringifies to the bare
              // word "Error" — so the one report that exists to say WHICH page
              // wedged said nothing at all, and the check above it could not
              // tell a timeout from any other throw. Measured: the guard
              // asserting /did not finish rendering/ got 'Error'.
              //
              // `state.down ||` is KEPT and the precedence is deliberate: the
              // lifetime timer sets its own reason first, and running past the
              // whole budget is the more fundamental fact about the server than
              // whichever request happened to be in flight when it fired.
              state.down = state.down ||
                u.pathname + " did not finish rendering within " +
                Math.round(requestMs / 1000) + "s, so the server was stopped";
              stop();
              throw new Error(state.down);
            }
            throw new Error(String((e && e.message) || e));
          }
        },
      };
    }
  });
}
