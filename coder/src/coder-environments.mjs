// ENVIRONMENTS, LIKE CLAUDE CODE'S (owner, 2026-11-06: "make it like claude code",
// after checking code.claude.com/docs/en/cloud-environments).
//
// An environment belongs to the user, has a name, and is not tied to a repo. It
// holds the network setting, the network secrets (keys), the setup script and
// the variables, and they apply to every chat that uses it. "Default" is made
// for you. A chat picks its environment before its first message; after that it
// is fixed, and the Environment button edits that environment.
//
// Before this, every repo had its own settings. The first time a chat of such a
// repo needs them, they move (sealed as they were) into an environment named
// after the repo, which that repo's chats keep using: nothing set up is lost.
//
//   coder/<uid>/environments.json         the list: { list: [{ id, name, at, archived?, repos?, used?, fromRepo?, description? }] }
//   coder/<uid>/environments/<id>.json    one environment's settings, sealed like the GitHub token

import { seal, unseal } from "./coder-github.mjs";
import { normNetwork, normSecret } from "../container/coder-secrets.mjs";

export const ENV_ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
/** An environment's name: one line, 1 to 64 characters (Claude Code's: "1–64 characters, plain text"), no markup. */
export const ENV_NAME = /^[^\u0000-\u001f<>]{1,64}$/;
export const ENV_NAME_MAX = 64;
export const MAX_ENVS = 30;
export const DEFAULT_ENV = "default";
const indexKey = (uid) => "coder/" + uid + "/environments.json";
export const envDataKey = (uid, id) => "coder/" + uid + "/environments/" + id + ".json";
/** Where a repo's settings were kept before environments (2026-11-05 to 2026-11-06). */
export const oldEnvKey = (uid, repo) => "coder/" + uid + "/env/" + String(repo).replace("/", "__") + ".json";

const empty = () => ({ script: "", vars: {}, secrets: [], network: normNetwork(null) });
const put = (bucket, key, text) => bucket.put(key, text, { httpMetadata: { contentType: "application/json" } });

/** The user's environments, Default first (made the first time it is needed). */
export async function listEnvs(bucket, uid) {
  let x = null;
  const o = await bucket.get(indexKey(uid));
  if (o) { try { x = JSON.parse(await o.text()); } catch { x = null; } }
  const list = (x && Array.isArray(x.list) ? x.list : []).filter((e) => e && ENV_ID.test(String(e.id)) && typeof e.name === "string");
  if (!list.some((e) => e.id === DEFAULT_ENV)) list.unshift({ id: DEFAULT_ENV, name: "Default", at: 0, repos: [] });
  return list;
}
export const saveEnvList = (bucket, uid, list) => put(bucket, indexKey(uid), JSON.stringify({ list }));

/** One environment's settings, unsealed (empty if it has none yet). */
export async function readEnvData(env, bucket, uid, id) {
  const o = await bucket.get(envDataKey(uid, id));
  if (!o) return empty();
  try {
    const rec = JSON.parse(await o.text()); const v = await unseal(env, rec.box);
    return { script: String(v.script || ""), vars: v.vars && typeof v.vars === "object" ? v.vars : {}, secrets: (Array.isArray(v.secrets) ? v.secrets : []).map(normSecret).filter(Boolean), network: normNetwork(v.network) };
  } catch { return empty(); }
}
export async function writeEnvData(env, bucket, uid, id, e) {
  await put(bucket, envDataKey(uid, id), JSON.stringify({ at: Date.now(), box: await seal(env, { script: e.script, vars: e.vars, secrets: e.secrets, network: e.network }) }));
}

/** A new id from the name, not used yet. */
export function envIdFor(name, list, rand = Math.random) {
  const base = String(name || "env").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "env";
  for (;;) {
    const id = base + "-" + Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0");
    if (id !== DEFAULT_ENV && !list.some((e) => e.id === id)) return id;
  }
}
/** A name not used yet ("testing2", else "testing2 2", …): only for a name Coder picks itself (a repo's old settings moved). */
export function uniqueName(name, list) {
  const n = String(name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, ENV_NAME_MAX) || "Environment";
  const taken = (c) => list.some((e) => !e.archived && e.name.toLowerCase() === c.toLowerCase());
  if (!taken(n)) return n;
  for (let k = 2; k < 1000; k++) { const c = n.slice(0, ENV_NAME_MAX - 4) + " " + k; if (!taken(c)) return c; }
  return n.slice(0, ENV_NAME_MAX - 10) + " " + Date.now().toString(36);
}
/**
 * A NAME THE OWNER GIVES THAT ANOTHER LISTED ENVIRONMENT ALREADY HAS (Claude Code 2.1.311: "Fixed cloud environment dialogs,
 * including the admin dialog, accepting duplicate names; they now refuse a name another listed environment already has"):
 * that environment (not archived, any letter case), or null. The page's refusal names it.
 */
export const nameHolder = (list, name, except = null) => list.find((e) => e && !e.archived && (!except || e.id !== except.id) && String(e.name).toLowerCase() === String(name).trim().toLowerCase()) || null;
export const nameTakenText = (holder) => "another environment is already named “" + holder.name + "”: pick another name";

/** For a repo's new chat: the environment used (or made) most recently with it, after moving its old settings into one if needed; else Default. */
export async function envForRepo(bucket, uid, repo, list0) {
  const list = list0 || (await listEnvs(bucket, uid));
  if (!repo) return DEFAULT_ENV;
  let hit = list.find((e) => e.fromRepo === repo);
  if (!hit) {
    const old = await bucket.get(oldEnvKey(uid, repo));
    if (old) {
      const short = String(repo).split("/").pop();
      const id = envIdFor(short, list);
      await put(bucket, envDataKey(uid, id), await old.text()); // still sealed; the old file stays where it was
      hit = { id, name: uniqueName(short, list), at: Date.now(), fromRepo: repo, repos: [repo] };
      list.push(hit);
      await saveEnvList(bucket, uid, list);
    }
  }
  // The one used (or made) most recently with this repo.
  // Two at the same moment: the one made later (further down the list) wins, so the choice never depends on chance.
  const last = list.map((e, i) => [e, i]).filter(([e]) => !e.archived && Array.isArray(e.repos) && e.repos.includes(repo)).sort(([a, ia], [b, ib]) => (b.used || b.at || 0) - (a.used || a.at || 0) || ib - ia)[0];
  return last ? last[0].id : DEFAULT_ENV;
}

/** The environment a chat uses: the one it picked; older chats, their repo's. An archived one keeps working for the chats that use it. */
/**
 * GLOOPY'S OWN KEYS (owner, 2026-11-09: "4", Grok Bot's card for API keys): kept like an environment's, sealed, under
 * this id, which no environment can have (theirs always end in -xxxx); Gloopy's chat uses it, never the Default.
 */
export const GLOOPY_ENV = "gloopy";
export async function envIdOf(bucket, uid, meta) {
  if (meta && meta.kind === "gloopy") return GLOOPY_ENV;
  const list = await listEnvs(bucket, uid);
  if (meta && meta.envId && list.some((e) => e.id === meta.envId)) return meta.envId;
  return envForRepo(bucket, uid, meta && meta.repo, list);
}

/** A chat of this repo used this environment: it is offered first for the repo's next chat. */
export async function markUsed(bucket, uid, id, repo) {
  const list = await listEnvs(bucket, uid);
  const e = list.find((x) => x.id === id);
  if (!e) return;
  e.repos = [...new Set([...(Array.isArray(e.repos) ? e.repos : []), repo].filter(Boolean))].slice(-50);
  e.used = Date.now();
  await saveEnvList(bucket, uid, list);
}

/** What the page may see of the list (names and descriptions only; nothing sealed). */
export const envListOut = (list) => list.filter((e) => !e.archived).map((e) => ({ id: e.id, name: e.name, isDefault: e.id === DEFAULT_ENV, ...(typeof e.description === "string" && e.description ? { description: e.description } : {}) }));

// THE ENVIRONMENT'S SAVED COPY OF ITS SETUP (owner, 2026-11-07: "ok start"; like
// Claude Code's environment cache: its docs, read 2026-11-07). The first chat that
// runs the setup script in a fresh machine has its disk saved by Fly.io (a
// snapshot) right after the setup; a new chat in the environment starts from that
// copy and skips the setup. It is made again when the script or the network
// setting changes, after about seven days, or with a new Coder version (Fly's
// side: src/coder-fly.mjs). Not secret: only Fly's name for the copy.
//   coder/<uid>/environments/<id>.cache.json   { snapshot, size, region, image, retention, key, at, from }
export const envCacheKey = (uid, id) => "coder/" + uid + "/environments/" + id + ".cache.json";

/** What the copy is a copy of: the setup script and the network setting (the variables and keys never reach the setup). */
export async function setupKeyOf(setup) {
  const text = JSON.stringify({ script: String((setup && setup.script) || "").trim(), network: normNetwork(setup && setup.network) });
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function readEnvCache(bucket, uid, id) {
  const o = await bucket.get(envCacheKey(uid, id));
  if (!o) return null;
  try {
    const c = JSON.parse(await o.text());
    return c && /^vs_\w{4,80}$/.test(String(c.snapshot)) && /^[0-9a-f]{64}$/.test(String(c.key)) && Number(c.at) > 0 ? c : null;
  } catch { return null; }
}
export const writeEnvCache = (bucket, uid, id, c) => put(bucket, envCacheKey(uid, id), JSON.stringify(c));
