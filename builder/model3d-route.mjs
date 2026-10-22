/**
 * THE OWNER'S 3D MODEL ROUTE, `/api/site/<slug>/model3d` (2026-10-22).
 *
 * The Worker gates it (signed in, `assertOwner`) and hands this module its
 * stores, its ledger and its network as `deps`, so the whole flow is tested
 * with stubs and no paid call:
 *
 *   GET  ?estimate=1          the price, before anything is spent
 *   POST { prompt | image, page?, label?, key }
 *                             debit the price under `model3d:<slug>:<key>`
 *                             (a short balance is refused, nothing called),
 *                             submit to fal's queue, keep a record
 *   GET  ?key=<key>           ask fal once; when done, download the .glb,
 *                             .usdz and thumbnail into the site's uploads,
 *                             place a Scene3D on the page and publish; when
 *                             fal failed, reverse the debit by its ref
 *
 * THE PRICE IS THE CAP. The estimate is `MODEL3D_CREDITS` and the debit is
 * that number, never more; a failed generation is reversed in full. Placing
 * the model on the page is not the generation: a model that was made and
 * stored stays charged when the page could not take it, and the reply says so.
 *
 * deps:
 *   falKey                     the platform's FAL_KEY (absent: refused, nothing charged)
 *   off                        true unless MODEL3D_PURCHASES is "on" (off by default)
 *   origin                     the public origin uploads are served from (for fal to fetch a photo)
 *   fetch, now()
 *   readRecord(key)            → record | null
 *   writeRecord(key, rec, etag?) → { ok, etag }   (etag given: only over that version)
 *   debit(amount, ref)         → the ledger's answer (`debitCredits`)
 *   reverse(ref, amount)       → { ok, refunded }
 *   balance()                  → number | null
 *   storeFile(name, bytes)     → { url, kind } | { error }   (`handleUpload`, owner's caps)
 *   loadPages()                → { ok, pages: [{ path, source }] }
 *   publish(pages, label)      → { ok, ... }
 *   routeOf(path)              → "/visit"
 */
import {
  MODEL3D_CREDITS, MODEL3D_USD, MODEL3D_KEY, model3dRef, model3dRequest, queueSubmit, queueStatus, downloadCapped,
  MODEL3D_MAX_GLB_BYTES, MODEL3D_MAX_USDZ_BYTES, MODEL3D_MAX_THUMB_BYTES, model3dLabel, scene3dBlock, placeScene3D, model3dReply,
} from "./site-3d.mjs";

const json = (body, status = 200) => ({ status, body });
const PAGE = /^\/[a-z0-9/_-]{0,120}$/i;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export const MODEL3D_OFF_MSG = "3D models are switched off just now. Nothing was charged.";

export function model3dEstimate() {
  return { credits: MODEL3D_CREDITS, usd: MODEL3D_USD, what: "one textured 3D model (Meshy 7.1)" };
}

function b64bytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** GET ?estimate=1 */
export async function model3dPrice(deps) {
  let balance = null;
  try { balance = await deps.balance(); } catch { balance = null; }
  return json({ ok: true, estimate: model3dEstimate(), balance: Number.isFinite(balance) ? balance : null }, 200);
}

/** POST: charge, submit, record. */
export async function model3dStart(deps, { slug, body }) {
  const b = body && typeof body === "object" ? body : {};
  if (typeof b.key !== "string" || !MODEL3D_KEY.test(b.key)) return json({ ok: false, error: "a request key is needed" }, 400);
  const key = b.key;
  if (deps.off) return json({ ok: false, error: MODEL3D_OFF_MSG, cost: 0 }, 503);
  if (!deps.falKey) return json({ ok: false, error: "The 3D service isn’t set up yet. Nothing was charged.", cost: 0 }, 501);
  // THE SAME KEY TWICE IS THE SAME MODEL: answered from its record, never charged again.
  const prior = await deps.readRecord(key);
  if (prior && prior.rec) return json({ ok: true, key, state: prior.rec.state, cost: prior.rec.charged || 0, again: true });
  const page = typeof b.page === "string" && PAGE.test(b.page.trim()) ? b.page.trim().replace(/\/+$/, "") || "/" : "/";
  const words = typeof b.prompt === "string" ? b.prompt : "";
  const label = model3dLabel(typeof b.label === "string" && b.label.trim() ? b.label : words || "3D model");
  // A PHOTOGRAPH: stored first as the owner's own upload (sniffed, capped),
  // then handed to fal by its public address.
  let imageUrl = "";
  if (b.image !== undefined && b.image !== null && b.image !== "") {
    const raw = typeof b.image === "string" ? b.image : b.image && typeof b.image.data === "string" ? b.image.data : "";
    const m = raw.match(DATA_URL);
    if (!m) return json({ ok: false, error: "that photograph couldn’t be read (PNG, JPEG or WebP)", cost: 0 }, 400);
    const st = await deps.storeFile("photo." + (m[1] === "image/jpeg" ? "jpg" : m[1].split("/")[1]), b64bytes(m[2]));
    if (!st || st.error || st.kind !== "image") return json({ ok: false, error: (st && st.error) || "that photograph couldn’t be stored", cost: 0 }, 400);
    imageUrl = deps.origin + st.url;
  }
  const req = model3dRequest({ prompt: words, imageUrl });
  if (req.error) return json({ ok: false, error: req.error, cost: 0 }, 400);
  // THE BALANCE GATE IS THE DEBIT: a short balance is refused by the ledger
  // with nothing taken, before fal is asked anything.
  const ref = model3dRef(slug, key);
  let d;
  try { d = await deps.debit(MODEL3D_CREDITS, ref); }
  catch { return json({ ok: false, error: "Couldn’t reach your credits just now. Nothing was charged.", cost: 0 }, 503); }
  if (!d || (d.ok !== true && d.exempt !== true)) {
    return json({ ok: false, error: "A 3D model costs " + MODEL3D_CREDITS + " credits" + (d && Number.isFinite(d.balance) ? " and you have " + d.balance : "") + ". Nothing was charged.", code: "short", cost: 0 }, 402);
  }
  const charged = d.repeat ? d.prior : d.taken;
  const sub = await queueSubmit({ fetch: deps.fetch }, { key: deps.falKey, model: req.model, input: req.input });
  if (!sub.ok) {
    const back = charged > 0 ? await deps.reverse(ref, charged) : { ok: true, refunded: 0 };
    return json({ ok: false, error: "The 3D service couldn’t start that model. " + (charged > 0 && back.ok ? "Your " + charged + " credits are back." : charged > 0 ? "The refund didn’t go through yet." : "Nothing was charged."), cost: back.ok ? 0 : charged }, 502);
  }
  const rec = { state: "waiting", slug, key, ref, charged, page, label, model: req.model, requestId: sub.requestId, statusUrl: sub.statusUrl, resultUrl: sub.resultUrl, at: deps.now() };
  await deps.writeRecord(key, rec);
  return json({ ok: true, key, state: "waiting", cost: charged, estimate: MODEL3D_CREDITS });
}

/** GET ?key=: one status read, and the finish when fal is done. */
export async function model3dPoll(deps, { slug, key }) {
  if (typeof key !== "string" || !MODEL3D_KEY.test(key)) return json({ ok: false, error: "no such request" }, 400);
  const got = await deps.readRecord(key);
  if (!got || !got.rec) return json({ ok: false, error: "no such request" }, 404);
  const rec = got.rec;
  if (rec.state === "done") return json({ ok: true, state: "done", ...rec.result, cost: rec.charged, reply: rec.reply });
  if (rec.state === "failed") return json({ ok: false, state: "failed", error: rec.error, cost: rec.cost || 0, reply: rec.reply });
  if (rec.state === "finishing" && deps.now() - (rec.claimedAt || 0) < 5 * 60 * 1000) return json({ ok: true, state: "finishing" });
  const st = await queueStatus({ fetch: deps.fetch }, { key: deps.falKey, statusUrl: rec.statusUrl, resultUrl: rec.resultUrl });
  if (st.state === "waiting") return json({ ok: true, state: "waiting", position: st.position });
  // ONE FINISHER: the record is claimed over the version just read, so two
  // polls cannot both refund or both publish.
  const claim = await deps.writeRecord(key, { ...rec, state: "finishing", claimedAt: deps.now() }, got.etag);
  if (!claim || !claim.ok) return json({ ok: true, state: "finishing" });
  const fail = async (error) => {
    const back = rec.charged > 0 ? await deps.reverse(rec.ref, rec.charged) : { ok: true, refunded: 0 };
    const cost = back.ok ? 0 : rec.charged;
    const reply = "I couldn’t make that 3D model (" + error + "). " + (rec.charged > 0 ? (back.ok ? "Your " + rec.charged + " credits are back." : "The refund hasn’t gone through yet — it will be retried.") : "Nothing was charged.");
    await deps.writeRecord(key, { ...rec, state: "failed", error, cost, reply, refunded: back.ok === true });
    return json({ ok: false, state: "failed", error, cost, reply });
  };
  if (st.state === "failed") return fail(st.error);
  const a = st.answer;
  const glb = await downloadCapped({ fetch: deps.fetch }, a.glb, MODEL3D_MAX_GLB_BYTES);
  if (!glb.ok) return fail("the model file " + (glb.tooBig ? "was over 50 MB" : "couldn’t be downloaded"));
  const sg = await deps.storeFile("model.glb", glb.bytes);
  if (!sg || sg.error || sg.kind !== "model") return fail("the model file couldn’t be stored" + (sg && sg.error ? ": " + sg.error : ""));
  let usdzUrl = "", posterUrl = "";
  if (a.usdz) {
    const u = await downloadCapped({ fetch: deps.fetch }, a.usdz, MODEL3D_MAX_USDZ_BYTES);
    if (u.ok) { const su = await deps.storeFile("model.usdz", u.bytes); if (su && !su.error && su.kind === "model") usdzUrl = su.url; }
  }
  if (a.thumbnail) {
    const t = await downloadCapped({ fetch: deps.fetch }, a.thumbnail, MODEL3D_MAX_THUMB_BYTES);
    if (t.ok) { const sp = await deps.storeFile("model-poster.png", t.bytes); if (sp && !sp.error && sp.kind === "image") posterUrl = sp.url; }
  }
  // ON THE PAGE: the stored files, never fal's addresses (they expire).
  let placed = false, publish = null;
  const src = await deps.loadPages();
  if (src && src.ok && Array.isArray(src.pages)) {
    const at = src.pages.findIndex((p) => p && typeof p.path === "string" && deps.routeOf(p.path) === rec.page);
    if (at >= 0) {
      const pl = placeScene3D(src.pages[at].source, scene3dBlock({ src: sg.url, poster: posterUrl, label: rec.label, key }));
      if (pl.ok) {
        const pages = src.pages.map((p, i) => (i === at ? { ...p, source: pl.source } : p));
        try { publish = await deps.publish(pages, "Added a 3D model"); } catch (e) { publish = { ok: false }; }
        placed = !!(publish && publish.ok);
      }
    }
  }
  const result = { glb: sg.url, usdz: usdzUrl, poster: posterUrl, page: rec.page, label: rec.label, placed, draft: publish && publish.draft };
  const reply = model3dReply({ label: rec.label, page: rec.page, placed, cost: rec.charged });
  await deps.writeRecord(key, { ...rec, state: "done", result, reply, doneAt: deps.now() });
  return json({ ok: true, state: "done", ...result, cost: rec.charged, reply });
}
