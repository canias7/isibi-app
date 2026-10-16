// R2 AS THE BINDING BEHAVES, FOR VIDEO AND AUDIO (2026-10-14): objects with
// their http and custom metadata, `get` with a byte range, `head`, `list` with
// a prefix and cursor, and multipart uploads — created, parts sent, completed
// (the object appears only then) or aborted. Parts are checked as R2 checks
// them: every part but the last the same size, each at least 5 MiB, the list
// at completion naming each part's own etag.
//
// `fail` makes the next call of a name throw once: { uploadPart: 1, complete: 1 }.
// `lose` makes a call of a name DO its work and then throw, as a request does
// whose answer is lost on the way back: { complete: 1 }.
// `put` honours `onlyIf` as R2 does — `etagMatches` writes only over that
// etag, `etagDoesNotMatch: "*"` only where there is no object — answering
// null when the condition fails (2026-10-15). `lag` yields to the event loop
// inside every call, so requests sent together really interleave.
//
// ETAGS AS R2 GIVES THEM, NO STRONGER (2026-10-15, Codex's review of
// `673e26cb`): an ordinary write's etag is the MD5 of its bytes — the same
// bytes written again carry the same etag — and each write gets its own
// generated `version`. This is what Cloudflare's Miniflare does. An earlier
// version of this file added a counter to every etag and called that R2's
// behaviour; it was not, and it hid a race in which a ledger returned to the
// same bytes. A finished multipart upload's etag here is the MD5 of its
// parts' MD5s and their count; nothing here relies on that form.
// `hooks.beforeComplete(key, uploadId)` and `hooks.beforeDelete(key)` run
// before a multipart close and a delete land: the barriers around the gap
// between a replacement's check and its commit (2026-10-15).
// `hooks.beforePut(key, value, opts)` runs before a write is decided, so a
// case can hold one request between its read and its conditional write while
// another runs whole.
// `calls` records each call by name, so a case can show what was — and was not —
// done (a part never reached R2, nothing completed).
import { randomBytes, createHash } from "node:crypto";

export const MIN_PART = 5 * 1024 * 1024;

export function mediaBucket({ fail = {}, lose = {}, lag = false, hooks = {}, pageSize = 2 } = {}) {
  const store = new Map();
  const uploads = new Map();
  const calls = [];
  let n = 0;
  const failing = { ...fail };
  const losing = { ...lose };
  const failErr = {};
  const trip = (name) => {
    calls.push(name);
    if (failing[name] > 0) { failing[name]--; throw failErr[name] ? failErr[name]() : new Error("r2 " + name + " failed"); }
  };
  const lost = (name) => { if (losing[name] > 0) { losing[name]--; throw new Error("r2 " + name + " answer lost"); } };
  const pause = () => (lag ? new Promise((r) => setTimeout(r, 0)) : null);
  const etagOf = (bytes) => createHash("md5").update(bytes).digest("hex");
  const objOf = (key, o, range) => {
    const all = o.bytes;
    const slice = range ? all.subarray(range.offset, range.offset + range.length) : all;
    return {
      key, size: all.length, etag: o.etag, httpEtag: '"' + o.etag + '"', version: o.version, uploaded: new Date(o.at),
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
    // STORAGE THAT STOPS ANSWERING from now on, for `n` calls of a name (2026-10-15).
    // …with the error a case names (`make()`), as R2's NoSuchUpload (2026-10-15).
    failNext: (name, n = 1, make = null) => { failing[name] = n; failErr[name] = make; },
    raw: (k) => (store.has(k) ? store.get(k).bytes : null),
    async put(key, value, opts = {}) {
      trip("put");
      const bytes = await toBytes(value);
      await pause();
      if (hooks.beforePut) await hooks.beforePut(key, bytes, opts);
      const c = opts.onlyIf;
      if (c && c.etagDoesNotMatch === "*" && store.has(key)) return null;
      if (c && typeof c.etagMatches === "string" && (!store.has(key) || store.get(key).etag !== c.etagMatches)) return null;
      // THE ETAG IS THE BYTES' MD5; THE VERSION IS NEW EVERY TIME.
      store.set(key, { bytes, etag: etagOf(bytes), version: randomBytes(16).toString("hex"), at: Date.now() + (++n), httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {} });
      const o = store.get(key);
      return { key, size: bytes.length, etag: o.etag, httpEtag: '"' + o.etag + '"', version: o.version };
    },
    async get(key, opts = {}) {
      trip("get");
      await pause();
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
      await pause();
      const o = store.get(key);
      if (!o) return null;
      const x = objOf(key, o, null);
      delete x.body;
      return x;
    },
    async delete(key) {
      trip("delete");
      if (hooks.beforeDelete) await hooks.beforeDelete(key);
      for (const k of Array.isArray(key) ? key : [key]) store.delete(k);
    },
    // PAGES AS R2 GIVES THEM (2026-10-16, Codex's review of `fbd53dca`): at most
    // `limit` keys (R2's default and ceiling 1000), after `startAfter` or after
    // the cursor's key, in key order. The cursor names the last key served, so
    // a key deleted between pages does not shift the next one. `pageSize`
    // (default 2, as before) caps a page further, so the older cases still walk
    // several pages; a case about realistic pages passes `pageSize: 1000`.
    async list({ prefix = "", cursor, include, limit, startAfter } = {}) {
      trip("list");
      await pause();
      const cap = Math.max(1, Math.min(Number.isInteger(limit) && limit > 0 ? limit : 1000, 1000, pageSize));
      const from = cursor ? Buffer.from(String(cursor), "base64url").toString("utf8") : (typeof startAfter === "string" ? startAfter : "");
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix) && k > from).sort();
      const page = keys.slice(0, cap);
      const truncated = keys.length > cap;
      return {
        objects: page.map((k) => {
          const o = store.get(k);
          return { key: k, size: o.bytes.length, etag: o.etag, uploaded: new Date(o.at), ...(include && include.includes("customMetadata") ? { customMetadata: { ...o.customMetadata } } : {}), ...(include && include.includes("httpMetadata") ? { httpMetadata: { ...o.httpMetadata } } : {}) };
        }),
        truncated, cursor: truncated ? Buffer.from(page[page.length - 1], "utf8").toString("base64url") : undefined,
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
          const etag = etagOf(bytes);
          u.parts.set(partNumber, { bytes, etag });
          return { partNumber, etag };
        },
        async complete(parts) {
          trip("complete");
          if (hooks.beforeComplete) await hooks.beforeComplete(key, uploadId);
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
          const etag = createHash("md5").update(Buffer.concat(list.map((p) => Buffer.from(p.etag, "hex")))).digest("hex") + "-" + list.length;
          store.set(key, { bytes, etag, version: randomBytes(16).toString("hex"), at: Date.now() + (++n), httpMetadata: u.opts.httpMetadata || {}, customMetadata: u.opts.customMetadata || {} });
          lost("complete");
          return { key, size: total, etag, httpEtag: '"' + etag + '"', version: store.get(key).version };
        },
        // AS R2 ANSWERS (2026-10-16, Codex's review of `ea9a2b71`): an upload
        // that is not there — never made, already aborted or already
        // completed — is refused with NoSuchUpload (10024), which proves it is
        // gone; `lose: { abort: n }` aborts and then loses the answer.
        async abort() {
          trip("abort");
          const u = uploads.get(uploadId);
          if (!u || u.done) throw Object.assign(new Error("NoSuchUpload: The specified multipart upload does not exist."), { code: 10024 });
          uploads.delete(uploadId);
          lost("abort");
        },
      };
    },
  };
  return b;
}
