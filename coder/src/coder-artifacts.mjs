/**
 * CODER'S ARTIFACTS, ITS SERVER SIDE (2026-11-23; Claude Code's Artifact tool: "Publishes an HTML or Markdown file ... as an
 * artifact: a private, interactive page. You can share it with a public link"; its publish, list, read, delete and open
 * actions the same day).
 *
 * The page machinery is Gloopy's (src/gloopy-pages.mjs), in its own folder (`ns` "artifacts": coder/<uid>/artifacts/), so
 * Gloopy's pages are untouched. The artifacts' list keeps fields Gloopy's pages don't have (icon, description, each version's
 * record with its label, the chat that published last), so it is read and written here, never through keepPages or
 * removePage (which would drop them). Coder's machine sends its calls (container/coder-resources.mjs) with its job's pass,
 * through ENV_PATH (src/coder-envapi.mjs). The owner opens an artifact from its card in the chat (POST /projects/:id/pages,
 * here for Coder's chats), from its own short-lived signed address, sandboxed as Gloopy's pages are; a public link opens it
 * for anyone while it is marked public.
 */
import { readPages, pageAddress, publicAddress, pageListKey, pageFileKey, PAGE_ID, PAGE_MAX, PAGES_MAX } from "./gloopy-pages.mjs";

export const ARTIFACTS_NS = "artifacts";
/** How many versions' records an artifact keeps (number, when, label, size), and how much of a page a read answers. */
export const VERSIONS_KEPT = 50, READ_MAX = 200_000;
const enc = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const words = (t, max) => String(t == null ? "" : t).replace(/[\p{Cf}\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** The artifacts' own list, with their own fields. */
async function rawList(bucket, uid) {
  const o = await bucket.get(pageListKey(uid, ARTIFACTS_NS));
  if (!o) return [];
  try { const l = JSON.parse(await o.text()); return (Array.isArray(l) ? l : []).filter((p) => p && PAGE_ID.test(p.id) && typeof p.title === "string"); } catch { return []; }
}
const putList = (bucket, uid, list) => bucket.put(pageListKey(uid, ARTIFACTS_NS), JSON.stringify(list), { httpMetadata: { contentType: "application/json" } });
/** One artifact as a list row (Claude Code's title, url, updatedAt; Coder's id, version, icon, description, public). */
const row = (p) => ({ title: p.title, url: p.id, id: p.id, version: Number(p.version) || 1, updatedAt: new Date(Number(p.updated) || Number(p.at) || 0).toISOString(), ...(p.icon ? { icon: p.icon } : {}), ...(p.description ? { description: p.description } : {}), ...(p.public === true ? { public: true } : {}) });

/**
 * A CALL FROM A JOB (`{ action: "artifact", op, ... }`; never from a job started from GitHub, or Gloopy's):
 * - op "publish" (the default): `{ html, title, id?, base?, force?, public?, description?, icon?, label? }`: a new one (id
 *   left out) or the next version of one this person has. A publish built on an older version (base below the newest), or
 *   with no base on one another chat published last, is refused with the live page (`stale`), unless force.
 * - op "list" `{ limit, scope }`, "get" `{ id }`, "read" `{ id }` (its page too), "delete" `{ id }`.
 * → { ok, text, ... } | { error } | { stale, error, html, version }.
 */
export async function artifactNow(env, bucket, uid, meta, body, { now = Date.now(), chat = "" } = {}) {
  if (meta && (meta.jobFromGithub === true || meta.kind === "gloopy")) return { error: "error: artifacts are published from Coder's chats on gofarther.dev, not from GitHub" };
  const op = body.op || "publish";
  const list = await rawList(bucket, uid);
  if (op === "list") {
    const scope = ["mine", "shared", "all"].includes(body.scope) ? body.scope : "mine";
    const limit = Math.min(200, Math.max(1, Number.isInteger(body.limit) ? body.limit : 25));
    // (Coder has no sharing between people: "shared" lists none; "all" is the owner's own, each marked rel mine.)
    const mine = scope === "shared" ? [] : list.slice().sort((a, b) => (Number(b.updated) || 0) - (Number(a.updated) || 0));
    const rows = mine.slice(0, limit).map((p) => ({ ...row(p), ...(scope === "mine" ? {} : { rel: "mine" }) }));
    return { ok: true, artifacts: rows, total: mine.length, ...(mine.length > limit ? { truncated: true } : {}), ...(scope === "mine" ? {} : { scope }) };
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const found = id ? list.find((p) => p.id === id) : null;
  if (op === "get" || op === "read" || op === "delete") {
    if (!found) return { error: "error: no artifact has the url " + id.slice(0, 20) + " (action list gives the owner's artifacts)" };
    const link = found.public === true ? await publicAddress(env, uid, id) : "";
    const facts = { ok: true, id, title: found.title, version: Number(found.version) || 1, ...(found.public === true ? { public: true } : {}), ...(link ? { link } : {}) };
    if (op === "get") return facts;
    if (op === "read") {
      const o = await bucket.get(pageFileKey(uid, id, ARTIFACTS_NS));
      const html = o ? await o.text() : "";
      return { ...facts, html: html.slice(0, READ_MAX), ...(html.length > READ_MAX ? { cut: html.length } : {}), versions: Array.isArray(found.versions) ? found.versions : [] };
    }
    await putList(bucket, uid, list.filter((p) => p.id !== id));
    if (typeof bucket.delete === "function") await bucket.delete(pageFileKey(uid, id, ARTIFACTS_NS));
    return { ok: true, text: "Deleted the artifact “" + found.title + "” (" + id + "). Its link no longer works, for anyone." };
  }
  if (op !== "publish") return { error: "error: op is publish, list, get, read or delete" };
  const html = typeof body.html === "string" ? body.html : "";
  const title = words(body.title, 80);
  if (!html || !title) return { error: "error: the page and its title are needed" };
  const size = enc.encode(html).length;
  if (size > PAGE_MAX) return { error: "error: the page is " + Math.ceil(size / 1024) + " KB; an artifact is at most " + Math.round(PAGE_MAX / 1024) + " KB (big embedded images are the usual cause). Nothing was published." };
  if (id && !found) return { error: "error: no artifact has the url " + id.slice(0, 20) + "; leave url out to publish a new one" };
  if (found && body.force !== true) {
    const base = Number(body.base) || 0, newest = Number(found.version) || 1;
    // (Claude Code: "A publish to an artifact this conversation has not read or published is refused and hands Claude the
    // live version"; it "refuses a publish built on that copy".)
    const stale = base ? base < newest : !!(found.chat && chat && found.chat !== chat);
    if (stale) {
      const o = await bucket.get(pageFileKey(uid, id, ARTIFACTS_NS));
      const live = o ? await o.text() : "";
      return { stale: true, version: newest, html: live.slice(0, READ_MAX), error: "error: the artifact “" + found.title + "” has a newer version (" + newest + ")" + (base ? " than the one this publish is built on (" + base + ")" : ", published from another chat, which this chat has not read") + ". Nothing was published. Its live version follows (this counts as reading it): merge your changes onto it and publish again, or pass force: true only if the owner explicitly said to discard that version." };
    }
  }
  if (!found && list.length >= PAGES_MAX) return { error: "error: the artifact could not be kept (at most " + PAGES_MAX + " artifacts; delete one first)" };
  let newId = id;
  if (!newId) { do newId = "p" + crypto.getRandomValues(new Uint8Array(10)).reduce((s, b) => s + "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36], ""); while (list.some((p) => p.id === newId)); }
  await bucket.put(pageFileKey(uid, newId, ARTIFACTS_NS), html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  const p = found || { id: newId, version: 0, at: now };
  if (!found) list.unshift(p);
  p.title = title; p.version = (Number(p.version) || 0) + 1; p.updated = now; p.size = size;
  if (chat) p.chat = String(chat).slice(0, 60);
  // (The icon is kept on an update that leaves it out; a description likewise.)
  if (typeof body.icon === "string" && words(body.icon, 40)) p.icon = words(body.icon, 40);
  if (typeof body.description === "string") { if (words(body.description, 1000)) p.description = words(body.description, 1000); else delete p.description; }
  if (typeof body.public === "boolean") { if (body.public) p.public = true; else delete p.public; }
  const label = words(body.label, 60);
  p.versions = [...(Array.isArray(p.versions) ? p.versions : []), { version: p.version, at: new Date(now).toISOString(), size, ...(label ? { label } : {}) }].slice(-VERSIONS_KEPT);
  await putList(bucket, uid, list);
  const link = p.public ? await publicAddress(env, uid, newId) : "";
  const text = (found ? "Updated" : "Published") + " the artifact “" + title + "” (url " + newId + ", version " + p.version + (label ? ", “" + label + "”" : "") + "). It is private to the owner, who opens it from its card in the chat." + (link ? " Public link (anyone with it can open the page): " + link : p.public ? " It is marked public, but its link could not be made: Coder's key is not set." : "");
  return { ok: true, text, id: newId, url: newId, title, version: p.version, updated: !!found, public: !!p.public, ...(link ? { link } : {}) };
}

/**
 * THE OWNER'S ARTIFACTS, FOR THE PAGE (a Coder chat's POST /projects/:id/pages, as Gloopy's): GET lists them; POST
 * { open: id } answers the address that shows it (10 minutes); { share: id, public: bool } turns its public link on or off;
 * { remove: id } takes it away.
 */
export async function artifactPages(request, env, bucket, uid) {
  if (request.method === "GET") return json({ ok: true, pages: await readPages(bucket, uid, ARTIFACTS_NS) });
  if (request.method !== "POST") return json({ error: "No artifacts " + request.method }, 400);
  let body = {}; try { body = await request.json(); } catch { body = {}; }
  const all = await rawList(bucket, uid);
  const pick = (k) => all.find((x) => x.id === body[k]);
  if (typeof body.open === "string") {
    const p = (await readPages(bucket, uid, ARTIFACTS_NS)).find((x) => x.id === body.open);
    if (!p) return json({ error: "That artifact is not there any more." }, 404);
    const address = await pageAddress(env, uid, p.id, Date.now(), ARTIFACTS_NS);
    return address ? json({ ok: true, page: p, url: address, ...(p.public ? { link: await publicAddress(env, uid, p.id) } : {}) }) : json({ error: "Artifacts cannot be opened yet: Coder's key is not set." }, 503);
  }
  if (typeof body.share === "string") {
    const one = pick("share");
    if (!one) return json({ error: "That artifact is not there any more." }, 404);
    if (body.public === true) one.public = true; else delete one.public;
    await putList(bucket, uid, all);
    return json({ ok: true, public: body.public === true, ...(body.public === true ? { link: await publicAddress(env, uid, one.id) } : {}) });
  }
  if (typeof body.remove === "string") {
    if (!pick("remove")) return json({ error: "That artifact is not there any more." }, 404);
    await putList(bucket, uid, all.filter((p) => p.id !== body.remove));
    if (typeof bucket.delete === "function") await bucket.delete(pageFileKey(uid, body.remove, ARTIFACTS_NS));
    return json({ ok: true, pages: await readPages(bucket, uid, ARTIFACTS_NS) });
  }
  return json({ error: "Give open, share or remove." }, 400);
}
