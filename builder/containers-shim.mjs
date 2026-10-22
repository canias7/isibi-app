// `@cloudflare/containers`, AS SEEN FROM INSIDE THE CONTAINER.
//
// The Worker reaches the site's build service through a Durable Object:
// `getContainer(env.SITE_BUILD_CONTAINER, laneName(slug)).fetch(new Request(
// "http://build/build", …))`. When the Worker's own module runs INSIDE that
// container (worker-loader.mjs), the build service is this process's
// neighbour on localhost — so the same call becomes a plain HTTP request to it,
// with the `http://build/` host rewritten to the local port and everything
// else of the request preserved.
//
// THE LANE NAME IS IGNORED, and that is a property to know rather than a
// shortcut: the job was fired at the lane for its own slug, so the container
// this code runs in IS that lane, and a call naming another lane (a hold probe,
// the game container) has no business on the job path. Such a call would reach
// this same build service, which is wrong only in the way a misrouted request
// is wrong — visibly, as the wrong answer — and never silently.
//
// `Container` is exported so the Worker module's `class SiteBuildContainer
// extends Container` declaration evaluates; nothing instantiates it here.

import { longFetch } from "./long-post.mjs";

export const BUILD_HOST = "http://build";

/** Where the build service listens inside the container. */
export function localBuildOrigin(env = process.env) {
  const port = Number(env && env.JOB_BUILD_PORT) || 8080;
  return "http://127.0.0.1:" + port;
}

/** `http://build/build` → `http://127.0.0.1:8080/build`; any other URL as is. */
export function rewriteBuildUrl(url, origin = localBuildOrigin()) {
  const s = String(url || "");
  if (s === BUILD_HOST) return origin + "/";
  if (s.startsWith(BUILD_HOST + "/")) return origin + s.slice(BUILD_HOST.length);
  return s;
}

export class Container {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}

// EVERY HOP GOES OVER `longFetch`, NEVER NODE'S OWN FETCH (2026-10-22, audit
// finding 40). Node's fetch is undici, whose 300-second headers timeout fires
// before any AbortSignal set longer, and the build service answers `/build`
// (the compile, held up to ~10 minutes by `withRoom`) and the synchronous
// `/model` only when the whole job is done. Inside a container job that cut a
// compile over 300 s as `TypeError: fetch failed`. `longFetch` has no headers
// or body timeout; the request's own signal is the one bound. The short hops
// (`/model/start`, its polls, `/health`) ride it too: one transport, nothing
// to choose per path. This file is loaded only inside the container
// (worker-loader.mjs), so workerd never sees `node:http`.
export function getContainer(_namespace, _name) {
  return {
    async fetch(input, init) {
      const req = input instanceof Request ? input : new Request(input, init);
      const url = rewriteBuildUrl(req.url);
      const body = req.method === "GET" || req.method === "HEAD" ? null : new Uint8Array(await req.arrayBuffer());
      return longFetch(url, { method: req.method, headers: req.headers, body, signal: req.signal });
    },
  };
}
