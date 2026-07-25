// smoke-check.test.mjs — the runtime smoke check in the shipping build service.
//
// The check itself needs a container and a browser, but its two decisions are pure and are where the
// bugs actually are: WHICH routes to load, and WHICH console errors count. Both fail quietly — a
// wrong route list means whole pages are never opened, and a wrong filter either floods the repair
// loop with expected network noise or drops the one error that mattered.
//
// Run: node builder/smoke-check.test.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.NO_SERVER = "1"; // import the helpers without binding a port
const { routeUrlsFrom, isRealRuntimeError } = await import("./build-server.mjs");
import { scaffoldRouting } from "./scaffold.mjs";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log("\nthe routes come from the router's own generated manifest");
{
  // Written by scaffoldRouting, so the smoke check and the app cannot disagree about what exists.
  const { files } = scaffoldRouting({
    "src/pages/Home.tsx": "", "src/pages/SignIn.tsx": "",
    "src/pages/Bookings.tsx": "", "src/pages/MyAccount.tsx": "",
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-routes-"));
  fs.writeFileSync(path.join(dir, "routes.ts"), files["src/routes.ts"]);
  const urls = routeUrlsFrom(dir);

  check("the landing page is covered", urls.includes("/"), urls.join(" "));
  check("every generated page is covered", urls.length === 4, `${urls.length} route(s): ${urls.join(" ")}`);
  check("a multi-word page keeps its real path", urls.some((u) => /my-?account/i.test(u)), urls.join(" "));
  check("no duplicates", new Set(urls).size === urls.length);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log("\nan app with no manifest still gets its landing page loaded");
{
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-empty-"));
  check("falls back to /", JSON.stringify(routeUrlsFrom(empty)) === '["/"]');
  fs.rmSync(empty, { recursive: true, force: true });
}

console.log("\nreal faults are reported");
{
  // The commonest generated-app crash by far: a name that does not exist. esbuild never resolves it,
  // so the build is clean and only the browser knows.
  check("ReferenceError", isRealRuntimeError("ReferenceError: bookings is not defined"));
  check("TypeError on undefined", isRealRuntimeError("TypeError: Cannot read properties of undefined (reading 'map')"));
  check("an uncaught throw", isRealRuntimeError("Uncaught Error: boom"));
  check("a bare Error", isRealRuntimeError("Error: something broke"));
  check("only the first line is judged", isRealRuntimeError("TypeError: x is not a function\n    at Home (index.js:1:1)"));
}

console.log("\nthe check's own environment is not");
{
  // It runs with no backend reachable, so a data-driven page ALWAYS fails its requests. Reporting
  // those would hand the repair loop a fault that does not exist and burn a pass rewriting a
  // correct page.
  check("a failed fetch", !isRealRuntimeError("TypeError: Failed to fetch"));
  check("a refused connection", !isRealRuntimeError("Error: net::ERR_CONNECTION_REFUSED"));
  check("an unauthenticated API call", !isRealRuntimeError("Error: 401 Unauthorized"));
  check("a missing row", !isRealRuntimeError("Error: 404 Not Found"));
  check("plain console noise", !isRealRuntimeError("Warning: each child needs a unique key"));
  check("a downgraded log line", !isRealRuntimeError("failed to load resource"));
  check("empty input", !isRealRuntimeError("") && !isRealRuntimeError(null));
}

console.log("\nthe worker acts on what the check returns");
{
  const worker = fs.readFileSync(path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), "worker.js"), "utf8");
  check("it reads runtimeErrors off the build", /bd\.runtimeErrors/.test(worker));
  check("and runs a repair pass when there are any", /The app COMPILES but CRASHES in the browser/.test(worker));
  // A repair that breaks the build would turn a working-but-flawed app into no app — the rebuild is
  // only adopted when it actually compiled.
  check("the rebuild is only taken if it compiled", /rb2\.bd && rb2\.bd\.ok && rb2\.bd\.files/.test(worker));

  const server = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "build-server.mjs"), "utf8");
  // Anchored on the preceding delimiter: without it, renaming the field to `xruntimeErrors` still
  // matched, because the mutated name contains the original as a substring.
  check("the service returns the errors advisory", /[,{]\s*runtimeErrors: smoke\.errors/.test(server));
  check("and never fails the build on them", /ok: true, files: dist[\s\S]{0,200}runtimeErrors/.test(server));
  check("the caller can turn it off", /payload\.smoke === false/.test(server));
}

console.log(failures ? `\n${failures} FAILED\n` : "\nall smoke-check checks pass\n");
process.exit(failures ? 1 : 0);
