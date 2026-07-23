// Integration test for the build-container /critique endpoint — spawns build-server.mjs, POSTs a dist, and
// verifies it serves + screenshots the routes. Real Playwright render ($0). This is the container half of the
// vision loop (the Worker calls /critique to get screenshots, then runs the vision model on them).
import { makeTally } from "./harness.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const t = makeTally("Critique endpoint");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 8137;

// Spawn the build server.
const child = spawn("node", [join(ROOT, "builder", "build-server.mjs")], {
  env: { ...process.env, PORT: String(PORT), APP_DIR: mkdtempSync(join(tmpdir(), "app-")) },
  stdio: ["ignore", "pipe", "pipe"],
});
// Wait for it to announce it's listening.
await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("server did not start")), 8000);
  child.stdout.on("data", (d) => { if (/build-service on/.test(String(d))) { clearTimeout(to); resolve(); } });
  child.stderr.on("data", () => {});
});

const post = (path, body) => fetch(`http://127.0.0.1:${PORT}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

try {
  const dist = { "index.html": { t: "<!doctype html><html><body style='background:#08070c;color:#fff;font:20px system-ui;padding:40px'><h1>Punch Card</h1><p>7 / 10 punches</p></body></html>" } };

  // --- Renders the route(s) → screenshots ---
  let r = await post("/critique", { dist, routes: ["/"], width: 600, height: 400 });
  t.eq(r.ok, true, "/critique renders the dist");
  t.eq(r.shots.length, 1, "…one shot for one route");
  t.eq(r.shots[0].route, "/", "…labeled with the route");
  t.ok(r.shots[0].pngBase64.length > 500, "…a non-trivial PNG");
  t.eq(Buffer.from(r.shots[0].pngBase64, "base64").slice(0, 4).toString("hex"), "89504e47", "…valid PNG magic");

  // --- Multiple routes (HashRouter: all serve index.html, hash routes) ---
  r = await post("/critique", { dist, routes: ["/", "/rewards", "/admin"], width: 500, height: 300 });
  t.eq(r.shots.length, 3, "renders every requested route");

  // --- Validation: no dist ---
  r = await post("/critique", { routes: ["/"] });
  t.eq(r.ok, false, "no dist → ok:false");
  t.ok(/index\.html/.test(r.error), "…explains index.html is required");

  // --- /health still works ---
  const h = await fetch(`http://127.0.0.1:${PORT}/health`).then((x) => x.text());
  t.eq(h, "ok", "/health still responds");
} finally {
  child.kill("SIGKILL");
}

t.done();
