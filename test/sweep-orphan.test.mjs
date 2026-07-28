// The orphan sweeper, driven end to end against a stub.
//
// It is a maintenance tool that runs with the service key and deletes published
// files, so the guard that matters — REFUSING a slug that still has an owner —
// must not be exercised for the first time against real data. Nor should the
// happy path, which creates an account and claims a site.
//
// So: one stub server standing in for both Supabase and the Worker (their paths
// don't collide), the real script run as a child process against it, and
// assertions on what it actually did — which calls it made, in which order, and
// what it left behind.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, ".github", "scripts", "sweep-orphan-site.mjs");

// A stand-in for Supabase + the published site. `owner` is the site_backends
// row's uid (null = orphaned), `published` is whether /s/<slug>/ still serves.
function stub({ owner = null, published = true, deleteStatus = 200 } = {}) {
  const calls = [];
  const state = { owner, published };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const json = (code, body) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      calls.push({ method: req.method, path: url.pathname + url.search, body });

      // --- Supabase: the ownership row ---
      if (url.pathname === "/rest/v1/site_backends") {
        if (req.method === "GET") return json(200, state.owner ? [{ uid: state.owner }] : []);
        if (req.method === "POST") { state.owner = JSON.parse(body || "{}").uid; return json(201, {}); }
        if (req.method === "DELETE") { state.owner = null; return json(204, {}); }
      }
      // --- Supabase: throwaway account ---
      if (url.pathname === "/auth/v1/admin/users" && req.method === "POST") return json(200, { id: "user-under-test" });
      if (url.pathname.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") return json(200, {});
      if (url.pathname === "/auth/v1/token") return json(200, { access_token: "jwt-under-test" });

      // --- the Worker: the owner-facing delete route ---
      const m = url.pathname.match(/^\/api\/site\/(.+)$/);
      if (m && req.method === "DELETE") {
        if (!req.headers.authorization) return json(401, { error: "unauthenticated" });
        if (deleteStatus !== 200) return json(deleteStatus, { ok: false, error: "boom" });
        // Deleting really does take the files down — that is what the script
        // verifies afterwards, so the stub has to model it.
        state.published = false;
        state.owner = null;
        return json(200, { ok: true, slug: m[1], removed: 8 });
      }
      // --- the published site ---
      if (url.pathname.startsWith("/s/")) {
        if (!state.published) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "content-type": "text/html" });
        return res.end("<div id=root></div>");
      }
      res.writeHead(404); res.end("nf");
    });
  });
  return { server, calls, state };
}

async function runSweeper(slug, opts = {}) {
  const s = stub(opts);
  await new Promise((r) => s.server.listen(0, r));
  const origin = `http://127.0.0.1:${s.server.address().port}`;
  const out = await new Promise((resolve) => {
    const child = spawn("node", [SCRIPT, slug], {
      env: {
        ...process.env,
        SUPABASE_SERVICE_KEY: "service-key-under-test",
        SWEEP_SUPABASE_URL: origin,
        SWEEP_BASE_URL: origin,
      },
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  await new Promise((r) => s.server.close(r));
  return { ...out, calls: s.calls, state: s.state };
}

const deletes = (calls) => calls.filter((c) => c.method === "DELETE" && c.path.startsWith("/api/site/"));

test("it refuses a slug that still has an owner", async () => {
  const r = await runSweeper("someones-live-site", { owner: "a-real-user", published: true });
  assert.equal(r.code, 1, "must exit non-zero");
  assert.match(r.stderr, /refusing/i);
  assert.match(r.stderr, /a-real-user/, "should name who owns it");
  assert.equal(deletes(r.calls).length, 0, "must not call the delete route on a live site");
  assert.equal(r.state.owner, "a-real-user", "must not touch the ownership row");
  assert.equal(r.state.published, true, "the site must still be published");
});

test("a live site is refused before any account is created", async () => {
  const r = await runSweeper("someones-live-site", { owner: "a-real-user" });
  assert.ok(!r.calls.some((c) => c.path.startsWith("/auth/v1/admin/users")),
    "should not create a throwaway account for a site it is going to refuse");
});

test("it exits clean when the slug is already gone", async () => {
  const r = await runSweeper("already-swept", { owner: null, published: false });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /nothing to do/i);
  assert.equal(deletes(r.calls).length, 0);
  assert.ok(!r.calls.some((c) => c.method === "POST" && c.path === "/rest/v1/site_backends"),
    "should not claim a slug that has nothing to delete");
});

test("it sweeps a real orphan, and says what it removed", async () => {
  const r = await runSweeper("barber-shop", { owner: null, published: true });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /swept clean/);
  assert.match(r.stdout, /removed 8 object/);
  assert.equal(r.state.published, false, "the files must actually be gone");
});

test("it deletes through the owner route, authenticated", async () => {
  const r = await runSweeper("barber-shop", { owner: null, published: true });
  const del = deletes(r.calls);
  assert.equal(del.length, 1, "exactly one delete, through the route");
  assert.equal(del[0].path, "/api/site/barber-shop");
  // The 401 branch in the stub would have fired otherwise.
  assert.ok(!r.stdout.includes("FAIL"), r.stdout);
});

test("it claims the orphan for the account it created, then removes the account", async () => {
  const r = await runSweeper("barber-shop", { owner: null, published: true });
  const claim = r.calls.find((c) => c.method === "POST" && c.path === "/rest/v1/site_backends");
  assert.ok(claim, "should claim the slug");
  const claimed = JSON.parse(claim.body);
  assert.equal(claimed.slug, "barber-shop");
  assert.equal(claimed.uid, "user-under-test", "claimed for the throwaway account, not anyone real");
  assert.ok(r.calls.some((c) => c.method === "DELETE" && c.path.startsWith("/auth/v1/admin/users/")),
    "the throwaway account must not be left behind");
});

test("the claim happens after the ownership check, never before", async () => {
  const r = await runSweeper("barber-shop", { owner: null, published: true });
  const checkedAt = r.calls.findIndex((c) => c.method === "GET" && c.path.startsWith("/rest/v1/site_backends"));
  const claimedAt = r.calls.findIndex((c) => c.method === "POST" && c.path === "/rest/v1/site_backends");
  assert.ok(checkedAt >= 0 && claimedAt > checkedAt,
    "claiming before checking would let it take over a live site");
});

test("a failed delete still cleans up, and reports failure", async () => {
  const r = await runSweeper("barber-shop", { owner: null, published: true, deleteStatus: 500 });
  assert.equal(r.code, 1, "must not claim success when the delete failed");
  assert.match(r.stdout, /FAIL/);
  assert.ok(r.calls.some((c) => c.method === "DELETE" && c.path.startsWith("/auth/v1/admin/users/")),
    "the throwaway account must be removed even when the delete failed");
  assert.equal(r.state.owner, null,
    "the slug must not stay claimed by an account that no longer exists");
});
