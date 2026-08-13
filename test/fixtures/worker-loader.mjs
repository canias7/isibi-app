// A resolve hook, so `worker.js` can be imported by a test.
//
// Registered with `module.register()` from `worker-harness.mjs` before the
// dynamic import. It redirects exactly one specifier and passes everything else
// to the default resolver — a broad hook here would quietly stub a real module
// and make a green test meaningless.
const STUB = new URL("./cf-containers.mjs", import.meta.url).href;

export function resolve(specifier, context, next) {
  if (specifier === "@cloudflare/containers") return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
