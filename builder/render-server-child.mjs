// Serve the model's own server bundle — in a process of its own, holding nothing.
//
// THIS FILE EXISTS BECAUSE OF WHERE THE CODE IT RUNS COMES FROM. Every route
// component in that bundle was written by a model, from a brief that may itself
// have been written by a stranger: this codebase already treats a brief, an
// attachment and a fetched link as attacker-controlled prose, and page
// generation turns that prose into JavaScript. The render check used to
// `import()` that JavaScript into the build server's own process and CALL it per
// request, which meant model-written code ran with the build service's
// privileges, in the loop that answers `/health`, in a container that is
// LONG-LIVED AND SHARED BY EVERY CUSTOMER ON THE PLATFORM.
//
// It is the same file `prerender-child.mjs` was, restored against the same three
// failures — the Dockerfile deleted that one on the premise that "nothing in
// this image executes model-written code any more", and then said in the next
// paragraph of the same comment block that the render check still does.
//
//   1. A WEDGE, AND NO TIMER CAN SAVE IT. `renderToString` is synchronous, so a
//      `while (true)` in a component blocks the event loop — and every timeout
//      in the old design was a timer in that same loop: `checkRender`'s 25s
//      budget, Playwright's 6s navigation timeout, `oneAtATime`'s queue. None of
//      them can fire. `/health` stops answering and every queued customer's
//      build hangs until Cloudflare recycles the instance, which it reports as
//      "Failed to start container" / "The container is not running" — the
//      two-messages-one-cause misdiagnosis that reads as flaky infrastructure.
//      As a separate process it is SIGKILLable from a loop that is still turning.
//
//   2. A SHARED FILESYSTEM. `resetRoutes` restores `src/routes` between builds
//      and nothing else: `/app/.routes-base`, `.styles-base.css`,
//      `src/components/**` and `node_modules` all persist. Model code that wrote
//      to any of them would be in every LATER customer's build — cross-tenant
//      stored XSS on published sites, from one hostile brief. So the strongest
//      statement this file can make is the one it makes: IT WRITES NOTHING. Not
//      a temp file, not a log, not a snapshot. It reads the bundle, answers
//      requests, and prints one line. That is what lets the parent run it with no
//      write access at all.
//
//   3. AN UNBOUNDED MODULE REGISTRY. In-process the import was cache-busted with
//      `?b=<now>` so build two could not be handed build one's server — correct,
//      and Node's ESM registry keys on the whole URL and has no unload, so every
//      build's several-megabyte bundle was retained for the life of the
//      container. Here the registry dies with the process, so the cache-buster
//      is not needed and is deliberately absent: adding one back is what created
//      the leak.
//
// The contract is deliberately tiny, because everything it does not do is a
// capability the rendered code does not get:
//
//   node render-server-child.mjs <dist/server/server.js>
//     → stdout, ONE JSON OBJECT PER LINE:
//         {"port":41234}   listening on 127.0.0.1, ready for requests
//         {"fatal":"…"}    the bundle would not load, or would not listen
//
// A LINE, NOT A HANDSHAKE. The parent reads until it sees one of the two and
// stops; a half-written line fails to parse and is skipped, which is the one
// shape that must not be accepted as a verdict.
import http from "node:http";
import { pathToFileURL } from "node:url";

const [, , bundle] = process.argv;

const line = (obj) => { try { process.stdout.write(JSON.stringify(obj) + "\n"); } catch {} };

// EXITING EXPLICITLY, from the write callback, so the reason is on the wire
// before the process goes. The last write's callback fires once the bytes have
// reached the OS and writes to one stream are ordered, so everything before it
// is out too.
const fatal = (why) => {
  const msg = JSON.stringify({ fatal: String(why).slice(0, 300) }) + "\n";
  try { process.stdout.write(msg, () => process.exit(1)); } catch { process.exit(1); }
};

// HEADERS THE PROXY MUST NOT REPEAT. We re-send the body as a Buffer, so a
// length or a framing declared by the app is a claim about bytes we are no
// longer sending in that shape — Node computes both.
const DROP = new Set(["content-length", "transfer-encoding", "content-encoding"]);

async function main() {
  let app;
  try {
    const mod = await import(pathToFileURL(String(bundle || "")).href);
    app = mod && mod.default;
  } catch (e) {
    return fatal("the site's server bundle would not load: " + String((e && e.message) || e));
  }
  if (!app || typeof app.fetch !== "function") return fatal("the site's server bundle exports no fetch handler");

  const server = http.createServer(async (req, res) => {
    try {
      // `{}` AS ENV, exactly as the in-process loader passed: the entry skips
      // its liveness probe with no bucket binding and serves assets from R2
      // only, which the parent's own static branch answers instead.
      const out = await app.fetch(new Request("http://127.0.0.1" + String(req.url || "/"), { method: "GET" }), {});
      const body = Buffer.from(await out.arrayBuffer());
      const headers = {};
      for (const [k, v] of out.headers) if (!DROP.has(k.toLowerCase())) headers[k] = v;
      res.writeHead(out.status, headers);
      res.end(body);
    } catch (e) {
      // 500 WITH THE REASON, never a silent 200. A render that throws is exactly
      // what the check exists to find, and swallowing it here would report the
      // page as clean.
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("ssr threw: " + String((e && e.message) || e).slice(0, 300));
    }
  });
  server.on("error", (e) => fatal("the site's server could not listen: " + String((e && e.message) || e)));
  // 127.0.0.1 ONLY. This is model-written code answering HTTP; binding it to
  // every interface would publish it out of the container.
  server.listen(0, "127.0.0.1", () => line({ port: server.address().port }));
}

// AN ORPHAN GUARD, and it is the one thing here that is about the PARENT dying
// rather than this process misbehaving. The parent kills this child in a
// `finally`, but a build service that is itself SIGKILLed runs no `finally` — and
// what is left behind is a process holding a port and, if it is wedged, a core,
// for as long as the instance lives. stdin is a pipe to the parent, so the
// parent going away closes it and `end` fires.
try {
  process.stdin.resume();
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("close", () => process.exit(0));
  process.stdin.on("error", () => process.exit(0));
} catch {}

main().catch((e) => fatal(String((e && e.message) || e)));
