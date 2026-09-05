// WHAT `cloudflare:workers` MEANS INSIDE THE CONTAINER — nothing.
//
// The Worker module is imported under Node inside the site's container (see
// worker-loader.mjs), and two of its dependencies import `cloudflare:workers`
// for the Durable Object base class. No Durable Object is ever constructed
// there: the container is the runtime for the JOB, and the `SiteBuildContainer`
// class is only declared, never instantiated, on that path. So the base class is
// a shell that remembers its arguments and does nothing, and the loader maps
// every `cloudflare:*` specifier here.
//
// Deliberately tiny and deliberately dumb: anything that would need a real
// Durable Object inside the container is a design mistake this file must not
// paper over, and a missing export here is an import error at startup — loud —
// rather than a silent stub.

export class DurableObject {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}

export class WorkerEntrypoint {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}

export class WorkflowEntrypoint {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}

/** `import { env } from "cloudflare:workers"` — the container's job env is handed
 *  to the module's functions explicitly, so the global one is empty. */
export const env = {};

export function waitUntil() { /* the runner awaits the job's own ctx */ }
