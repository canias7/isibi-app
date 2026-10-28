// THIS SITE'S OWN FILES, SERVED AND TAKEN BY ITS OWN WORKER (2026-10-27).
//
// `/u/<this site>/<file>`: the owner's uploads and hosted media (copied into
// this site's own bucket at publish, under `uploads/`) and visitors' uploads
// (written here, under `vuploads/`), served with the platform's own rules for
// ranges, revalidation and download names (`./effects/site-media.mjs` and
// `./effects/site-uploads.mjs`, copied byte for byte).
//
// `POST /api/db/<this site>/uploads?table=…`: a visitor attaching an image to
// a form, checked by the platform's own `handleVisitorUpload`, stored in this
// site's own bucket. Nothing here touches the platform.
import { mediaHeaders, parseRange, ifRangeHolds, etagMatches, MEDIA_CACHE, mediaKindOf } from "./effects/site-media.mjs";
import { handleVisitorUpload, dispositionFor, readDownloadName, DOWNLOAD_NAME_KEY, MAX_VISITOR_UPLOAD_BYTES } from "./effects/site-uploads.mjs";

type R2Head = { size: number; etag?: string; httpEtag?: string; uploaded?: Date; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };
type R2Obj = R2Head & { body: ReadableStream | null };
export type FilesBucket = {
  head(key: string): Promise<R2Head | null>;
  get(key: string, opts?: unknown): Promise<R2Obj | null>;
  put(key: string, v: unknown, opts?: unknown): Promise<unknown>;
  list(opts: { prefix: string; cursor?: string; include?: string[] }): Promise<{ objects: (R2Head & { key: string })[]; truncated: boolean; cursor?: string }>;
};
export type FilesEnv = { SITES?: FilesBucket; OWN_BUCKET?: string; SITE_TABLES?: string };

const FILE_RE = /^[A-Za-z0-9._-]{1,120}$/;

export async function serveUpload(request: Request, env: FilesEnv, url: URL, slug: string): Promise<Response | null> {
  if (env.OWN_BUCKET !== "1" || !env.SITES) return null;
  const prefix = "/u/" + slug + "/";
  if (!url.pathname.toLowerCase().startsWith(prefix)) return null;
  const own = { "x-site-data": "own" };
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { ...own, allow: "GET, HEAD" } });
  const name = url.pathname.slice(prefix.length);
  if (!FILE_RE.test(name)) return new Response("Not found", { status: 404, headers: own });
  const B = env.SITES;
  let key = "uploads/" + slug + "/" + name;
  let head = await B.head(key);
  if (!head) { key = "vuploads/" + slug + "/" + name; head = await B.head(key); }
  if (!head) return new Response("Not found", { status: 404, headers: own });
  const media = !!mediaKindOf(name.toLowerCase().split(".").pop());
  const ct = (head.httpMetadata && head.httpMetadata.contentType) || "application/octet-stream";
  const etag = head.httpEtag || (head.etag ? '"' + head.etag + '"' : "");
  const base = {
    mime: ct, size: head.size, etag,
    cache: media ? MEDIA_CACHE : "public, max-age=31536000, immutable",
    disposition: dispositionFor(ct, readDownloadName(head.customMetadata && head.customMetadata[DOWNLOAD_NAME_KEY])),
  };
  if (etagMatches(request.headers.get("if-none-match"), etag)) {
    const h = mediaHeaders(base);
    delete h["content-length"];
    return new Response(null, { status: 304, headers: { ...h, ...own } });
  }
  const asked = ifRangeHolds(request.headers.get("if-range"), etag, head.uploaded) ? request.headers.get("range") : null;
  const range = parseRange(asked, head.size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...own, "content-range": "bytes */" + head.size, "accept-ranges": "bytes", "cache-control": base.cache } });
  }
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: { ...mediaHeaders(base), ...own } });
  const obj = await B.get(key, range ? { range: { offset: range.offset, length: range.length } } : undefined);
  if (!obj || !obj.body) return new Response("Not found", { status: 404, headers: { ...own, "cache-control": "no-store" } });
  return new Response(obj.body, { status: range ? 206 : 200, headers: { ...mediaHeaders({ ...base, range }), ...own } });
}

/** The body, or null as soon as it passes `max` bytes. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { try { await reader.cancel(); } catch { /* gone */ } return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

// Uploads per visitor per minute, per isolate: the platform's own guard, kept here.
const VISITOR_UPLOADS_PER_MIN = 10;
const hits = new Map<string, { n: number; until: number }>();

export async function visitorUpload(request: Request, env: FilesEnv, url: URL, slug: string): Promise<Response | null> {
  if (env.OWN_BUCKET !== "1" || !env.SITES || !env.SITE_TABLES) return null;
  if (url.pathname.toLowerCase() !== "/api/db/" + slug + "/uploads") return null;
  const own = { "x-site-data": "own" };
  if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405, headers: own });
  const cl = Number(request.headers.get("content-length") || 0);
  if (cl && cl > MAX_VISITOR_UPLOAD_BYTES) return Response.json({ error: "that image is too big — keep it under 2 MB", code: "too_big" }, { status: 413, headers: own });
  // READ WITH A CAP, not whole: a chunked upload carries no length to refuse
  // up front, so the bytes are counted as they arrive (2026-10-28).
  const bytes = await readCapped(request, MAX_VISITOR_UPLOAD_BYTES);
  if (!bytes) return Response.json({ error: "that image is too big — keep it under 2 MB", code: "too_big" }, { status: 413, headers: own });
  const B = env.SITES;
  // The platform's rule writes `uploads/<slug>/…`; a visitor's file lives
  // under `vuploads/` in this bucket, so the owner's copies never touch it.
  const toV = (k: string) => k.replace(/^uploads\//, "vuploads/");
  const vr = await handleVisitorUpload({
    tableFor: async (_s: string, t: string) => {
      try {
        const all = JSON.parse(String(env.SITE_TABLES || "[]")) as { name?: string }[];
        return all.find((x) => x && String(x.name).toLowerCase() === String(t || "").toLowerCase()) || null;
      } catch { return null; }
    },
    throttle: async (k: string) => {
      const now = Date.now();
      const b = hits.get(k);
      if (!b || now >= b.until) { hits.set(k, { n: 1, until: now + 60_000 }); if (hits.size > 5000) hits.clear(); return { ok: true }; }
      b.n++;
      return b.n > VISITOR_UPLOADS_PER_MIN ? { ok: false, retryAfter: Math.ceil((b.until - now) / 1000) } : { ok: true };
    },
    hash: async (bytes: Uint8Array) => {
      const d = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    list: async (s: string) => {
      const out: { key: string; size: number; visitor: boolean }[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 50; i++) {
        const page = await B.list({ prefix: "vuploads/" + s + "/", cursor });
        for (const o of page.objects) out.push({ key: o.key.replace(/^vuploads\//, "uploads/"), size: o.size, visitor: true });
        if (!page.truncated) break;
        cursor = page.cursor;
      }
      return out;
    },
    put: (key: string, bytes: Uint8Array, ct: string, meta?: Record<string, string>) =>
      B.put(toV(key), bytes, { httpMetadata: { contentType: ct }, ...(meta ? { customMetadata: meta } : {}) }),
  }, {
    slug,
    table: url.searchParams.get("table"),
    ip: request.headers.get("CF-Connecting-IP") || "",
    bytes,
  });
  return Response.json(vr.body, { status: vr.status, headers: own });
}
