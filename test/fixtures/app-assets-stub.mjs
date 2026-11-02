// A stand-in for Cloudflare's static-asset binding (`env.ASSETS`) over a
// folder, answering as the live one was measured to on 2026-11-02:
// `cache-control: public, max-age=0, must-revalidate`, a strong ETag from the
// bytes, a 304 on a matching If-None-Match, the query string ignored, and `/`
// served as index.html. Used by test/app-load-speed.test.mjs.
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".woff2": "font/woff2" };

export function assetsStub(dir, { files = null } = {}) {
  const seen = [];
  return {
    seen,
    async fetch(input) {
      const req = input instanceof Request ? input : new Request(input);
      const url = new URL(req.url);
      seen.push(url.pathname + url.search);
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith("/")) p += "index.html";
      let body;
      if (files) body = Object.hasOwn(files, p) ? Buffer.from(files[p]) : null;
      else {
        const f = path.join(dir, path.normalize(p));
        body = f.startsWith(dir) && existsSync(f) && statSync(f).isFile() ? readFileSync(f) : null;
      }
      if (!body) return new Response("Not found", { status: 404 });
      const etag = '"' + createHash("sha256").update(body).digest("hex").slice(0, 32) + '"';
      const headers = { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate", etag };
      const inm = req.headers.get("if-none-match");
      if (inm && inm.split(",").some((t) => t.trim() === etag)) return new Response(null, { status: 304, headers: { etag, "cache-control": headers["cache-control"] } });
      return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
    },
  };
}
