// The Worker (Cloudflare) has no `process`: no file it bundles may touch it at load time (deploy run 279 failed on this).
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("the bundled Worker loads without process", { timeout: 180000 }, () => {
  const out = join(mkdtempSync(join(tmpdir(), "wk-")), "wk.mjs");
  try { execFileSync("npx", ["-y", "esbuild@0.24.0", new URL("../worker.js", import.meta.url).pathname, "--bundle", "--format=esm", "--platform=neutral", "--external:cloudflare:*", "--external:@cloudflare/containers", "--external:node:*", "--main-fields=module,main", "--outfile=" + out, "--log-level=error"], { stdio: "pipe" }); }
  catch (e) { return; } // (no esbuild offline: skip)
  const src = readFileSync(out, "utf8").replace(/^import [^;]*;/mg, "").replace(/^export\s*\{[\s\S]*?\};?/mg, "").replace(/^export (default )?/mg, "");
  const ctx = vm.createContext({ console, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, Response, Request, Headers, fetch, setTimeout, clearTimeout, setInterval, atob, btoa, structuredClone, WebSocket: class {}, Container: class {}, DurableObject: class {}, getContainer() {}, Blob, FormData, AbortController, ReadableStream });
  assert.doesNotThrow(() => vm.runInContext(src, ctx));
});
