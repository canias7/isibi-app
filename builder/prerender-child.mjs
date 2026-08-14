// Render each route to HTML — in a process of its own, holding nothing.
//
// THIS FILE EXISTS BECAUSE OF WHERE THE CODE IT RUNS COMES FROM. Every route
// component here was written by a model, from a brief that may itself have been
// written by a stranger: this codebase already treats a brief, an attachment and
// a fetched link as attacker-controlled prose, and page generation turns that
// prose into JavaScript. `prerender()` used to `import()` that JavaScript into
// the build server's own process and call it, which meant model-written code ran
// with the build service's privileges, in the loop that answers `/health`, in a
// container that is LONG-LIVED AND SHARED BY EVERY CUSTOMER ON THE PLATFORM.
//
// Two failures fell out of that, and this file is the answer to both.
//
//   1. A WEDGE. `renderToString` is synchronous, and every other step in
//      build-server.mjs is a subprocess with STEP_TIMEOUT and a SIGKILL behind
//      it. This one had neither, so a `while (true)` in a component — or merely
//      a pathological render — blocked the event loop. `/health` then stops
//      answering and `oneAtATime` queues every other customer's build behind the
//      wedge until Cloudflare recycles the instance. As a subprocess it is
//      killed like anything else, and the cost is one site's snapshots.
//
//   2. A SHARED FILESYSTEM. `resetRoutes` restores `src/routes` between builds
//      and nothing else: `/app/.routes-base`, `.index-base.html`,
//      `.styles-base.css`, `src/components/**` and `node_modules` all persist.
//      Model code that wrote to any of them would be in every LATER customer's
//      build — cross-tenant stored XSS on published sites, from one hostile
//      brief. So the strongest statement this file can make is the one it makes:
//      IT WRITES NOTHING. Not a temp file, not a snapshot, not a log. It reads
//      the bundle, renders, and prints. The parent does every write there is,
//      which is what lets the parent run it with no write access at all.
//
// The contract is deliberately tiny, because everything it does not do is a
// capability the rendered code does not get:
//
//   node prerender-child.mjs <entry-server.js> <routes-json>
//     → stdout, ONE JSON OBJECT PER LINE:
//         {"p":"/book","body":"<html…>"}   rendered
//         {"p":"/book","err":"…"}          this route threw
//         {"fatal":"…"}                    the bundle would not load at all
//         {"done":true}                    every route was attempted
//
// NDJSON RATHER THAN ONE OBJECT AT THE END, and that is not a style choice: a
// child that is SIGKILLed mid-loop has still flushed the lines it already wrote,
// so a single page that hangs costs its own snapshot instead of the whole site's.
// A kill can also cut a line in half, which the parent detects by that line
// failing to parse — the one shape it must not do is silently accept a truncated
// body as a page.
import { pathToFileURL } from "node:url";

const [, , entry, routesJson] = process.argv;

const line = (obj) => { try { process.stdout.write(JSON.stringify(obj) + "\n"); } catch {} };

// The last write's callback fires once the bytes have reached the OS, and writes
// to one stream are ordered — so everything before it is out too.
//
// EXITING EXPLICITLY IS REQUIRED, not tidiness. The SSR bundle builds a
// QueryClient per route, and `entry-server.tsx` says in as many words that
// "a retrying client would only schedule timers in a process that is about to
// exit". In-process that was true. Here the process IS the thing that has to
// exit, and a stray timer would hold it open until the parent's SIGKILL — 150
// seconds of a customer waiting for work that finished.
const finish = () => { try { process.stdout.write(JSON.stringify({ done: true }) + "\n", () => process.exit(0)); } catch { process.exit(0); } };

// ONE FUNCTION WITH EARLY RETURNS, because `finish()` does not halt: it exits
// from a write callback, so a straight-line script would carry on past a fatal
// and print a second, contradictory verdict on the same run.
async function main() {
  let routes = [];
  try { routes = JSON.parse(routesJson || "[]"); } catch {}
  if (!Array.isArray(routes)) routes = [];

  let render;
  try {
    // Cache-busted. Belt-and-braces now — a fresh process has an empty module
    // registry, so it cannot be handed the previous build's bundle — and kept
    // because the bug it prevents is one this container really had: in-process,
    // a plain import gave build two the module build one compiled, and every
    // site after the first was snapshotted as the first. If this ever moves back
    // in-process, the guard is the difference between that recurring and not.
    const mod = await import(pathToFileURL(String(entry || "")).href + "?v=" + Date.now());
    render = mod && mod.render;
  } catch (e) {
    return line({ fatal: String((e && e.message) || e).slice(0, 300) });
  }
  if (typeof render !== "function") return line({ fatal: "entry-server exports no render" });

  for (const p of routes) {
    try {
      const body = await render(String(p));
      line({ p, body: body == null ? "" : String(body) });
    } catch (e) {
      // Per route, never fatal. A page that throws is one missing snapshot; the
      // other four are still worth having, and the site publishes either way.
      line({ p, err: String((e && e.message) || e).slice(0, 200) });
    }
  }
}

// `main` cannot reject — every await inside it is fenced — but an unhandled
// rejection here would exit with no verdict on stdout at all, which the parent
// would have to read as "the child died" rather than "the bundle is broken".
main().catch((e) => line({ fatal: String((e && e.message) || e).slice(0, 300) })).finally(finish);
