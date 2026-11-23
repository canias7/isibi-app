/**
 * CODER'S ARTIFACTS, ITS SERVER SIDE (2026-11-23; Claude Code's Artifact tool: "Publishes an HTML or Markdown file ... as an
 * artifact: a private, interactive page. You can share it with a public link").
 *
 * The page machinery is Gloopy's (src/gloopy-pages.mjs), in its own folder (`ns` "artifacts": coder/<uid>/artifacts/), so
 * Gloopy's pages are untouched. Coder's machine sends the page (container/coder-artifact.mjs made it from the file) with its
 * job's pass, through ENV_PATH (src/coder-envapi.mjs): it is kept at once, and Coder is told its id and, when asked for, its
 * public link. The owner opens it from its card in the chat (POST /projects/:id/pages, here for Coder's chats), from its own
 * short-lived signed address, sandboxed as Gloopy's pages are; a public link opens it for anyone while it is marked public.
 */
import { readPages, keepPages, removePage, pageAddress, publicAddress, PAGE_ID, PAGE_MAX } from "./gloopy-pages.mjs";

export const ARTIFACTS_NS = "artifacts";
const enc = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * A PAGE FROM A JOB (`{ action: "artifact", html, title, id?, public? }`), kept now: a new one (id left out) or the next
 * version of one this person has. Never from a job started from GitHub. → { ok, text, id, version, public, link? } | { error }.
 */
export async function artifactNow(env, bucket, uid, meta, body, { now = Date.now() } = {}) {
  if (meta && (meta.jobFromGithub === true || meta.kind === "gloopy")) return { error: "error: artifacts are published from Coder's chats on gofarther.dev, not from GitHub" };
  const html = typeof body.html === "string" ? body.html : "";
  const title = String(body.title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!html || !title) return { error: "error: the page and its title are needed" };
  if (enc.encode(html).length > PAGE_MAX) return { error: "error: the page is over " + Math.round(PAGE_MAX / 1024) + " KB" };
  const list = await readPages(bucket, uid, ARTIFACTS_NS);
  let id = typeof body.id === "string" ? body.id.trim() : "";
  if (id && (!PAGE_ID.test(id) || !list.some((p) => p.id === id))) return { error: "error: no artifact has the id " + id.slice(0, 20) + "; leave id out to publish a new one" };
  if (!id) { do id = "p" + crypto.getRandomValues(new Uint8Array(10)).reduce((s, b) => s + "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36], ""); while (list.some((p) => p.id === id)); }
  const want = typeof body.public === "boolean" ? body.public : undefined;
  if (!(await keepPages(bucket, uid, [{ id, title, html, ...(want === undefined ? {} : { public: want }) }], now, ARTIFACTS_NS))) return { error: "error: the artifact could not be kept (at most 100 artifacts; remove one first)" };
  const p = (await readPages(bucket, uid, ARTIFACTS_NS)).find((x) => x.id === id);
  const link = p && p.public ? await publicAddress(env, uid, id) : "";
  const text = (p.version > 1 ? "Updated" : "Published") + " the artifact “" + title + "” (id " + id + ", version " + p.version + "). It is private to the owner, who opens it from its card in the chat." + (link ? " Public link (anyone with it can open the page): " + link : p.public ? " It is marked public, but its link could not be made: Coder's key is not set." : "");
  return { ok: true, text, id, version: p.version, public: !!p.public, ...(link ? { link } : {}) };
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
  const list = await readPages(bucket, uid, ARTIFACTS_NS);
  const pick = (k) => list.find((x) => x.id === body[k]);
  if (typeof body.open === "string") {
    const p = pick("open");
    if (!p) return json({ error: "That artifact is not there any more." }, 404);
    const address = await pageAddress(env, uid, p.id, Date.now(), ARTIFACTS_NS);
    return address ? json({ ok: true, page: p, url: address, ...(p.public ? { link: await publicAddress(env, uid, p.id) } : {}) }) : json({ error: "Artifacts cannot be opened yet: Coder's key is not set." }, 503);
  }
  if (typeof body.share === "string") {
    const p = pick("share");
    if (!p) return json({ error: "That artifact is not there any more." }, 404);
    const all = await getList(bucket, uid);
    const one = all.find((x) => x && x.id === p.id);
    if (body.public === true) one.public = true; else delete one.public;
    await bucket.put(["coder", uid, ARTIFACTS_NS, "pages.json"].join("/"), JSON.stringify(all), { httpMetadata: { contentType: "application/json" } });
    return json({ ok: true, public: body.public === true, ...(body.public === true ? { link: await publicAddress(env, uid, p.id) } : {}) });
  }
  if (typeof body.remove === "string") {
    if (!(await removePage(bucket, uid, body.remove, ARTIFACTS_NS))) return json({ error: "That artifact is not there any more." }, 404);
    return json({ ok: true, pages: await readPages(bucket, uid, ARTIFACTS_NS) });
  }
  return json({ error: "Give open, share or remove." }, 400);
}
async function getList(bucket, uid) {
  const o = await bucket.get(["coder", uid, ARTIFACTS_NS, "pages.json"].join("/"));
  if (!o) return [];
  try { const l = JSON.parse(await o.text()); return Array.isArray(l) ? l : []; } catch { return []; }
}
