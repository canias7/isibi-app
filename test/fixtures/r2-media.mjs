// R2 AS THE BINDING BEHAVES, FOR VIDEO AND AUDIO (2026-10-14): objects with
// their http and custom metadata, `get` with a byte range, `head`, `list` with
// a prefix and cursor, and multipart uploads — created, parts sent, completed
// (the object appears only then) or aborted. Parts are checked as R2 checks
// them: every part but the last the same size, each at least 5 MiB, the list
// at completion naming each part's own etag.
//
// `fail` makes the next call of a name throw once: { uploadPart: 1, complete: 1 }.
// `calls` records each call by name, so a case can show what was — and was not —
// done (a part never reached R2, nothing completed).
import { randomBytes, createHash } from "node:crypto";

export const MIN_PART = 5 * 1024 * 1024;

export function mediaBucket({ fail = {} } = {}) {
  const store = new Map();
  const uploads = new Map();
  const calls = [];
  let n = 0;
  const failing = { ...fail };
  const trip = (name) => {
    calls.push(name);
    if (failing[name] > 0) { failing[name]--; throw new Error("r2 " + name + " failed"); }
  };
  const etagOf = (bytes) => createHash("md5").update(bytes).digest("hex");
  const objOf = (key, o, range) => {
    const all = o.bytes;
    const slice = range ? all.subarray(range.offset, range.offset + range.length) : all;
    return {
      key, size: all.length, etag: o.etag, httpEtag: '"' + o.etag + '"', uploaded: new Date(o.at),
      httpMetadata: { ...o.httpMetadata }, customMetadata: { ...o.customMetadata },
      range: range || undefined,
      body: new Response(slice).body,
      arrayBuffer: async () => slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength),
      text: async () => new TextDecoder().decode(slice),
      json: async () => JSON.parse(new TextDecoder().decode(slice)),
    };
  };
  const toBytes = async (v) => {
    if (v instanceof Uint8Array) return new Uint8Array(v);
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (typeof v === "string") return new TextEncoder().encode(v);
    if (v && typeof v.getReader === "function") return new Uint8Array(await new Response(v).arrayBuffer());
    return new Uint8Array(0);
  };
  const b = {
    store, uploads, calls,
    raw: (k) => (store.has(k) ? store.get(k).bytes : null),
    async put(key, value, opts = {}) {
      trip("put");
      const bytes = await toBytes(value);
      store.set(key, { bytes, etag: etagOf(bytes), at: Date.now() + (++n), httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {} });
      return { key, size: bytes.length };
    },
    async get(key, opts = {}) {
      trip("get");
      const o = store.get(key);
      if (!o) return null;
      let range = null;
      if (opts.range) {
        const r = opts.range;
        const off = typeof r.offset === "number" ? r.offset : typeof r.suffix === "number" ? Math.max(0, o.bytes.length - r.suffix) : 0;
        const len = typeof r.length === "number" ? r.length : o.bytes.length - off;
        range = { offset: off, length: Math.max(0, Math.min(len, o.bytes.length - off)) };
      }
      return objOf(key, o, range);
    },
    async head(key) {
      trip("head");
      const o = store.get(key);
      if (!o) return null;
      const x = objOf(key, o, null);
      delete x.body;
      return x;
    },
    async delete(key) {
      trip("delete");
      for (const k of Array.isArray(key) ? key : [key]) store.delete(k);
    },
    async list({ prefix = "", cursor, include } = {}) {
      trip("list");
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + 2);
      const truncated = start + 2 < keys.length;
      return {
        objects: page.map((k) => {
          const o = store.get(k);
          return { key: k, size: o.bytes.length, etag: o.etag, uploaded: new Date(o.at), ...(include && include.includes("customMetadata") ? { customMetadata: { ...o.customMetadata } } : {}), ...(include && include.includes("httpMetadata") ? { httpMetadata: { ...o.httpMetadata } } : {}) };
        }),
        truncated, cursor: truncated ? String(start + 2) : undefined,
      };
    },
    async createMultipartUpload(key, opts = {}) {
      trip("createMultipartUpload");
      const uploadId = randomBytes(12).toString("base64url");
      uploads.set(uploadId, { key, parts: new Map(), opts, done: false });
      return b.resumeMultipartUpload(key, uploadId);
    },
    resumeMultipartUpload(key, uploadId) {
      return {
        key, uploadId,
        async uploadPart(partNumber, value) {
          trip("uploadPart");
          const u = uploads.get(uploadId);
          if (!u || u.key !== key || u.done) throw new Error("no such upload");
          const bytes = await toBytes(value);
          const etag = etagOf(bytes) + "-" + partNumber;
          u.parts.set(partNumber, { bytes, etag });
          return { partNumber, etag };
        },
        async complete(parts) {
          trip("complete");
          const u = uploads.get(uploadId);
          if (!u || u.key !== key || u.done) throw new Error("no such upload");
          const list = [...parts].sort((x, y) => x.partNumber - y.partNumber);
          const chunks = list.map((p) => {
            const have = u.parts.get(p.partNumber);
            if (!have || have.etag !== p.etag) throw new Error("part " + p.partNumber + " does not match");
            return have.bytes;
          });
          for (let i = 0; i < chunks.length - 1; i++) {
            if (chunks[i].length < MIN_PART || chunks[i].length !== chunks[0].length) throw new Error("parts are not uniform");
          }
          const total = chunks.reduce((s, c) => s + c.length, 0);
          const bytes = new Uint8Array(total);
          let at = 0;
          for (const c of chunks) { bytes.set(c, at); at += c.length; }
          u.done = true;
          uploads.delete(uploadId);
          store.set(key, { bytes, etag: etagOf(bytes), at: Date.now() + (++n), httpMetadata: u.opts.httpMetadata || {}, customMetadata: u.opts.customMetadata || {} });
          return { key, size: total, etag: etagOf(bytes), httpEtag: '"' + etagOf(bytes) + '"' };
        },
        async abort() {
          trip("abort");
          uploads.delete(uploadId);
        },
      };
    },
  };
  return b;
}
