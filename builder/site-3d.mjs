/**
 * A 3D MODEL FOR A SITE, MADE BY MESHY 7.1 THROUGH FAL (2026-10-22).
 *
 * The owner: when a customer asks for a 3D asset, unless they ask otherwise,
 * the model is made with fal's Meshy 7.1 and shown with three.js through the
 * kit's `Scene3D`. Two doors: words (`text-to-3d`) or one photograph
 * (`image-to-3d`). Textured, never rigged or animated: textured is $1.20 a
 * model, and rigging and animation are extra the owner has not approved.
 *
 * PURE: no fetch of its own, no clock of its own. The request builders, the
 * answer reader, the price and the fal queue flow (with the network, the clock
 * and the sleep handed in), and the page placement. The Worker's route
 * (`/api/site/<slug>/model3d`) is the only caller that spends.
 *
 * THE MODEL IDS, THE PRICE AND THE SETTINGS LIVE HERE AND NOWHERE ELSE.
 */

/** fal's endpoint ids, confirmed on fal's pages (2026-10-22). */
export const MESHY_TEXT_MODEL = "fal-ai/meshy/v7.1/text-to-3d";
export const MESHY_IMAGE_MODEL = "fal-ai/meshy/v7.1/image-to-3d";

/** What one textured model costs us at fal, in dollars. */
export const MODEL3D_USD = 1.2;
/** 1 credit = $0.008 (docs/platform.md), so $1.20 is 150 credits: the price shown, and the most one model charges. */
export const MODEL3D_CREDITS = Math.round(MODEL3D_USD / 0.008);

/**
 * WEBSITE-FRIENDLY GEOMETRY: Meshy's Smart Topology, held to a polycount a
 * phone turns smoothly (fal's own ceiling for it is 15,000). Triangles, the
 * shape three.js draws. No PBR maps (base colour only keeps the file small and
 * the price the textured one), no rigging, no animation.
 */
export const MESHY_SETTINGS = Object.freeze({
  model_type: "smart-topology",
  target_polycount: 12000,
  topology: "triangle",
  symmetry_mode: "auto",
  should_remesh: true,
  enable_pbr: false,
  enable_rigging: false,
  enable_animation: false,
  enable_safety_checker: true,
});

/** fal's limit on the prompt. */
export const MAX_PROMPT_CHARS = 600;
/** The longest a generation is waited for, and how often it is asked after. */
export const MODEL3D_WAIT_MS = 15 * 60 * 1000;
export const MODEL3D_POLL_MS = 5000;
/** The largest file kept from an answer (the uploads' own cap for a model). */
export const MODEL3D_MAX_GLB_BYTES = 50_000_000;
export const MODEL3D_MAX_USDZ_BYTES = 50_000_000;
export const MODEL3D_MAX_THUMB_BYTES = 5_000_000;

/** The ledger's ref for one model: unique per site and request key, so a retry never charges twice. */
export function model3dRef(slug, key) {
  return "model3d:" + String(slug).toLowerCase() + ":" + key;
}
/** A request key the browser mints (the security scan's shape). */
export const MODEL3D_KEY = /^[A-Za-z0-9_-]{8,64}$/;

const cleanText = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** The words-to-model request: `{ model, input }`, or `{ error }`. */
export function textTo3dRequest(prompt) {
  const p = cleanText(prompt);
  if (!p) return { error: "say what the 3D model should be" };
  if (p.length > MAX_PROMPT_CHARS) return { error: "describe it in " + MAX_PROMPT_CHARS + " characters or fewer" };
  // `mode: "full"` is preview plus refine: the textured model.
  return { model: MESHY_TEXT_MODEL, input: { prompt: p, mode: "full", ...MESHY_SETTINGS } };
}

/** The photo-to-model request: an https image address only (fal fetches it). */
export function imageTo3dRequest(imageUrl, texturePrompt) {
  const u = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (!isHttps(u)) return { error: "the photograph needs a public https address" };
  const t = cleanText(texturePrompt).slice(0, MAX_PROMPT_CHARS);
  return { model: MESHY_IMAGE_MODEL, input: { image_url: u, should_texture: true, ...(t ? { texture_prompt: t } : {}), ...MESHY_SETTINGS } };
}

/** Either request, from what the route was sent. */
export function model3dRequest({ prompt, imageUrl } = {}) {
  if (typeof imageUrl === "string" && imageUrl) return imageTo3dRequest(imageUrl, prompt);
  return textTo3dRequest(prompt);
}

export function isHttps(u) {
  if (typeof u !== "string" || !u) return false;
  try { const x = new URL(u); return x.protocol === "https:" && !!x.hostname && !x.username && !x.password; } catch { return false; }
}

/** fal hands a file as `{ url, ... }`; a bare string is read too. */
const fileUrl = (f) => (typeof f === "string" ? f : f && typeof f === "object" && typeof f.url === "string" ? f.url : "");

/**
 * WHAT MESHY MADE: `{ ok: true, glb, usdz, thumbnail, seed }`, or `{ ok: false,
 * error }`. A missing or non-https `.glb` is refused — it is the one file the
 * page needs. The `.usdz` and the thumbnail are kept when they are https and
 * dropped (never refused) when they are not.
 */
export function readModelAnswer(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "the 3D service answered nothing readable" };
  const urls = raw.model_urls && typeof raw.model_urls === "object" ? raw.model_urls : {};
  const glb = fileUrl(raw.model_glb) || fileUrl(urls.glb);
  if (!glb) return { ok: false, error: "the 3D service made no model file" };
  if (!isHttps(glb)) return { ok: false, error: "the 3D service's model address was not https" };
  const usdz = fileUrl(urls.usdz);
  const thumb = fileUrl(raw.thumbnail);
  return {
    ok: true, glb,
    usdz: isHttps(usdz) ? usdz : "",
    thumbnail: isHttps(thumb) ? thumb : "",
    seed: Number.isInteger(raw.seed) ? raw.seed : null,
  };
}

// ── FAL'S QUEUE ────────────────────────────────────────────────────────────
//
// Generation takes minutes, so never `fal.run` (one held request). Submit to
// `queue.fal.run/<model>`, keep the request id, ask its status, then read its
// result. Submit and each status read are separate calls, so a route can
// submit in one request and finish in a later one (`queueStatus`), or wait in
// one bounded loop (`runQueue`).

export const FAL_QUEUE = "https://queue.fal.run/";
const QUEUE_HOST = "queue.fal.run";
/** fal's request ids are uuids; anything else is not ours to put in a URL. */
export const FAL_REQUEST_ID = /^[A-Za-z0-9-]{8,80}$/;

/**
 * fal addresses a request under the APP (the first two segments of the model
 * id), not the full endpoint path: `fal-ai/meshy/requests/<id>/status`.
 */
export function queueUrls(model, requestId) {
  const app = String(model).split("/").slice(0, 2).join("/");
  const base = FAL_QUEUE + app + "/requests/" + requestId;
  return { status: base + "/status", result: base, cancel: base + "/cancel" };
}

/** A URL fal handed back is used only when it is fal's queue over https; otherwise ours. */
function falUrl(u, fallback) {
  if (!isHttps(u)) return fallback;
  try { return new URL(u).hostname === QUEUE_HOST ? u : fallback; } catch { return fallback; }
}

const headersFor = (key) => ({ Authorization: "Key " + key, "Content-Type": "application/json" });

/** Submit: `{ ok: true, requestId, statusUrl, resultUrl, cancelUrl }` or `{ ok: false, error, status? }`. */
export async function queueSubmit(deps, { key, model, input }) {
  if (!key) return { ok: false, error: "the 3D service is not configured" };
  let r;
  try {
    r = await deps.fetch(FAL_QUEUE + model, { method: "POST", headers: headersFor(key), body: JSON.stringify(input) });
  } catch (e) { return { ok: false, error: "the 3D service could not be reached" }; }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || typeof j.request_id !== "string" || !FAL_REQUEST_ID.test(j.request_id)) {
    return { ok: false, error: "the 3D service refused the request", status: r.status, detail: j && typeof j.detail === "string" ? j.detail.slice(0, 200) : undefined };
  }
  const own = queueUrls(model, j.request_id);
  return {
    ok: true, requestId: j.request_id,
    statusUrl: falUrl(j.status_url, own.status), resultUrl: falUrl(j.response_url, own.result), cancelUrl: falUrl(j.cancel_url, own.cancel),
  };
}

/**
 * One status read and, when it is done, the result: `{ state: "waiting",
 * position? }`, `{ state: "done", answer }` (read by `readModelAnswer`) or
 * `{ state: "failed", error }`. A status call that does not answer is
 * `waiting` with `unread` — it may still be running, so nothing is refunded
 * on it.
 */
export async function queueStatus(deps, { key, statusUrl, resultUrl }) {
  let s;
  try {
    const r = await deps.fetch(statusUrl, { headers: headersFor(key) });
    s = r.ok ? await r.json().catch(() => null) : null;
    if (!r.ok && r.status >= 400 && r.status < 500 && r.status !== 429) return { state: "failed", error: "the 3D service lost the request" };
  } catch { s = null; }
  if (!s || typeof s.status !== "string") return { state: "waiting", unread: true };
  if (s.status === "IN_QUEUE" || s.status === "IN_PROGRESS") {
    return { state: "waiting", status: s.status, ...(Number.isInteger(s.queue_position) ? { position: s.queue_position } : {}) };
  }
  if (s.status !== "COMPLETED") return { state: "failed", error: "the 3D service answered an unknown state" };
  let r2, j;
  try {
    r2 = await deps.fetch(resultUrl, { headers: headersFor(key) });
    j = await r2.json().catch(() => null);
  } catch { return { state: "waiting", unread: true }; }
  if (!r2.ok) {
    if (r2.status >= 500 || r2.status === 429) return { state: "waiting", unread: true };
    return { state: "failed", error: "the 3D service could not make that model" + (j && typeof j.detail === "string" ? ": " + j.detail.slice(0, 160) : "") };
  }
  const a = readModelAnswer(j);
  return a.ok ? { state: "done", answer: a } : { state: "failed", error: a.error };
}

/**
 * The whole flow in one bounded loop: submit, ask every `everyMs` until done
 * or `maxMs` passes (then ask fal to cancel), and answer the read result.
 * `deps`: `{ fetch, sleep(ms), now() }`.
 */
export async function runQueue(deps, { key, model, input, maxMs = MODEL3D_WAIT_MS, everyMs = MODEL3D_POLL_MS, onWait = null }) {
  const sub = await queueSubmit(deps, { key, model, input });
  if (!sub.ok) return { ok: false, stage: "submit", error: sub.error };
  const start = deps.now();
  for (;;) {
    const st = await queueStatus(deps, { key, statusUrl: sub.statusUrl, resultUrl: sub.resultUrl });
    if (st.state === "done") return { ok: true, requestId: sub.requestId, answer: st.answer };
    if (st.state === "failed") return { ok: false, stage: "generate", requestId: sub.requestId, error: st.error };
    if (typeof onWait === "function") { try { onWait(st); } catch { /* a progress line never stops the work */ } }
    if (deps.now() - start >= maxMs) {
      try { await deps.fetch(sub.cancelUrl, { method: "PUT", headers: headersFor(key) }); } catch { /* best effort */ }
      return { ok: false, stage: "timeout", requestId: sub.requestId, error: "the 3D model took too long to make" };
    }
    await deps.sleep(everyMs);
  }
}

/**
 * A file from fal, held to `cap` bytes: by its declared length first, then by
 * what arrives (a stream is counted and cut, never buffered past the cap).
 * `{ ok: true, bytes }` or `{ ok: false, error }`.
 */
export async function downloadCapped(deps, url, cap) {
  if (!isHttps(url)) return { ok: false, error: "not an https address" };
  let r;
  try { r = await deps.fetch(url); } catch { return { ok: false, error: "the file could not be fetched" }; }
  if (!r.ok) return { ok: false, error: "the file could not be fetched (" + r.status + ")" };
  const declared = Number(r.headers && typeof r.headers.get === "function" ? r.headers.get("content-length") : 0) || 0;
  if (declared > cap) return { ok: false, error: "the file is too big", tooBig: true };
  if (r.body && typeof r.body.getReader === "function") {
    const reader = r.body.getReader();
    const parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > cap) { try { await reader.cancel(); } catch { /* gone */ } return { ok: false, error: "the file is too big", tooBig: true }; }
      parts.push(value);
    }
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return { ok: true, bytes: out };
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > cap) return { ok: false, error: "the file is too big", tooBig: true };
  return { ok: true, bytes: buf };
}

// ── ON THE PAGE ────────────────────────────────────────────────────────────

export const SCENE3D_IMPORT = 'import { Scene3D } from "@/components/ui/scene-3d";';
/** An address the page may point Scene3D at: this site's own upload. */
export const OWN_UPLOAD = (slug) => new RegExp("^/u/" + String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "") + "/[a-f0-9]{1,64}\\.(glb|png|jpg|webp)$");

/** The label read out for the model: the request's words, short. */
export function model3dLabel(words) {
  const t = cleanText(words).replace(/^(please\s+)?(make|create|add|build|generate|put)\s+(me\s+)?(a\s+|an\s+)?(3d|3-d)\s+(model|version|object)\s+(of\s+)?/i, "");
  const s = (t || "3D model").slice(0, 120);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * THE BAND THAT SHOWS IT: one Scene3D in the page's own width, its `src` the
 * stored `.glb`, its `poster` the stored thumbnail. Attribute values are JS
 * string literals (`JSON.stringify`), so no label can close the tag.
 */
export function scene3dBlock({ src, poster = "", label, key = "" }) {
  const attrs = ["label={" + JSON.stringify(String(label || "3D model")) + "}", "src={" + JSON.stringify(src) + "}"];
  if (poster) attrs.push("poster={" + JSON.stringify(poster) + "}");
  attrs.push("height={420}");
  return '      <section className="mx-auto max-w-6xl px-6 py-16"' + (key ? ' data-model3d={' + JSON.stringify(key) + '}' : "") + ">\n" +
    "        <Scene3D " + attrs.join(" ") + " />\n" +
    "      </section>\n";
}

/**
 * PLACE IT ON A PAGE: the import added once (after the last import), the band
 * inserted before the page's last `</SiteChrome>` — the frame every generated
 * page returns, whose `<main>` holds the page's bands. `{ ok: true, source }`
 * or `{ ok: false, why }`; nothing else in the page changes.
 */
export function placeScene3D(source, block) {
  const src = typeof source === "string" ? source : "";
  if (!src) return { ok: false, why: "no-source" };
  const at = src.lastIndexOf("</SiteChrome>");
  if (at < 0) return { ok: false, why: "no-frame" };
  const lineStart = src.lastIndexOf("\n", at) + 1;
  let out = src.slice(0, lineStart) + block + src.slice(lineStart);
  if (!/import\s*\{[^}]*\bScene3D\b[^}]*\}\s*from\s*["']@\/components\/ui\/scene-3d["']/.test(out)) {
    const imports = [...out.matchAll(/^import[^\n]*?(?:from\s*["'][^"']+["']|["'][^"']+["']);?[ \t]*$/gm)];
    // A multi-line import ends on its `} from "…";` line, which the pattern also matches.
    const last = imports.length ? imports[imports.length - 1] : null;
    const pos = last ? last.index + last[0].length : 0;
    out = out.slice(0, pos) + (pos ? "\n" : "") + SCENE3D_IMPORT + (pos ? "" : "\n") + out.slice(pos);
  }
  return { ok: true, source: out };
}

/** The reply that names the cost. */
export function model3dReply({ label, page, placed, cost }) {
  const c = Number(cost) || 0;
  const paid = c > 0 ? " It cost " + c + " credit" + (c === 1 ? "" : "s") + "." : "";
  if (placed) return "Your 3D model of " + label.toLowerCase() + " is on " + (page === "/" ? "the home page" : page) + " — visitors can drag to turn it." + paid;
  return "Your 3D model of " + label.toLowerCase() + " is made and saved in your files, but I couldn’t place it on " + (page === "/" ? "the home page" : page) + " — ask me to put it on a page." + paid;
}
