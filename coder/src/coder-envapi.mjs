/**
 * CLAUDE CODE'S ENVIRONMENT TOOLS, CODER'S SERVER SIDE (the owner, 2026-11-14: "Do all the talk to you tools execpt for the
 * notify one"; container/coder-envtools.mjs has the tools, their checks and texts).
 *
 * Claude Code's get_environment, update_environment, create_environment and switch_environment are answered by its server,
 * which knows the environments as they are now. Here too:
 *   POST ENV_PATH (the machine, with its job's pass, like a connector call): { action: "get", environment_id? } for
 *     get_environment's answer, or { action: "check", tool, args } for a card's content (or why the call is refused);
 *   approveEnvChange (the page, when the owner approves a card: POST /projects/:id/envchange { tool, args }): the same
 *     checks again on the environment as it is then, and the change made; nothing is changed when a check fails.
 * Values of variables and network secrets never leave here for the machine.
 */
import { modelPass } from "./coder-model-gate.mjs";
import { listEnvs, saveEnvList, readEnvData, writeEnvData, envIdFor, envIdOf, markUsed, envListOut } from "./coder-environments.mjs";
import { egressPass, machineKeyRules, EGRESS_PATH } from "./coder-egress.mjs";
import { envAnswer, envCard, sameCard, ENV_INPUT_CHECKS, ENV_CARD_TOOLS, planUpdate, planCreate, planSwitch, approvedText } from "../container/coder-envtools.mjs";

export const ENV_PATH = "/api/coder/environment";

const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const same = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const metaKey = (uid, id) => "coder/" + uid + "/" + id + "/meta.json";
async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}

/** This chat's repositories: its own and the ones added to it. */
export const chatRepos = (meta) => [meta && meta.repo, ...(meta && Array.isArray(meta.repos) ? meta.repos.map((r) => r && r.repo) : [])].filter((r) => typeof r === "string" && r);

/**
 * WHAT THE CHECKS READ (coder-envtools.mjs): this chat's environment, the owner's list, the settings of this chat's
 * environment, of those saved for its repositories, and of `also` (an environment asked about), and its repositories.
 */
export async function envState(env, bucket, uid, meta, also = []) {
  const list = await listEnvs(bucket, uid);
  const envId = meta.envId && list.some((e) => e.id === meta.envId) ? meta.envId : await envIdOf(bucket, uid, meta);
  const repos = chatRepos(meta);
  const mine = new Set(repos.map((r) => r.toLowerCase()));
  const ids = new Set([envId, ...also.filter((x) => typeof x === "string" && list.some((e) => e.id === x)), ...list.filter((e) => !e.archived && Array.isArray(e.repos) && e.repos.some((r) => mine.has(String(r).toLowerCase()))).map((e) => e.id)]);
  const data = {};
  for (const id of ids) data[id] = await readEnvData(env, bucket, uid, id);
  return { envId, list, data, repos };
}

/** THE MACHINE'S QUESTIONS (get_environment, and a card's checks), with its job's pass (as handleMcp). */
export async function handleEnvApi(request, env, { now = Date.now() } = {}) {
  if (request.method !== "POST") return answer({ error: "method" }, 405);
  const bucket = env && env.CODER_BUCKET;
  if (!bucket) return answer({ error: "storage is not available" }, 503);
  const h = (k) => String(request.headers.get(k) || "");
  const chat = h("x-coder-chat"), turn = h("x-coder-turn"), until = h("x-coder-until");
  const m = /^([\w-]{1,100})\/([a-z0-9][a-z0-9-]{2,40})$/.exec(chat);
  if (!m || !/^\d{1,9}$/.test(turn) || !/^\d{13}$/.test(until)) return answer({ error: "not a job's call" }, 403);
  const want = await modelPass(env, chat, turn, until);
  if (!want || !same(want, h("x-coder-model"))) return answer({ error: "not this job's pass" }, 403);
  if (Number(until) <= now) return answer({ error: "this pass has ended" }, 403);
  const [, uid, id] = m;
  const meta = await getJson(bucket, metaKey(uid, id), null);
  if (!meta || String(meta.turn) !== turn) return answer({ error: "that chat has moved on" }, 403);
  // (Never in a job started from GitHub, whose text strangers can write: the tools are not offered there either.)
  if (meta.jobFromGithub === true || meta.kind === "gloopy") return answer({ error: "error: the environment cannot be looked up or changed in a job started from GitHub" }, 403);
  let body = null;
  try { body = JSON.parse((await request.text()).slice(0, 300_000)); } catch { body = null; }
  if (!body || typeof body !== "object") return answer({ error: "error: Coder's server could not read that" }, 400);
  const also = [body.action === "get" ? body.environment_id : body.args && typeof body.args === "object" ? body.args.environment_id : null];
  return answer(envAnswer(await envState(env, bucket, uid, meta, also), body));
}

/** A MOVED CHAT'S NETWORK, AT ONCE (Claude Code: "requests through the session's HTTPS proxy follow the new environment's allowed hosts"): its machine, when it runs something. */
export async function pushNetwork(env, deps, uid, id, meta, data) {
  if (!deps || typeof deps.container !== "function") return false;
  try {
    const egress = { url: String(env.CODER_PUBLIC_URL || "https://gofarther.dev").replace(/\/+$/, "") + EGRESS_PATH, chat: uid + "/" + id, turn: meta.turn, pass: await egressPass(env, uid + "/" + id, meta.turn) };
    const r = await deps.container(uid + "-" + id).fetch(new Request("http://coder/network", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, setup: { network: data.network }, secrets: meta.jobFromGithub ? [] : machineKeyRules(data.secrets), egress }) }));
    return r.ok;
  } catch { return false; }
}

/**
 * THE OWNER APPROVED A CARD (the page: POST /projects/:id/envchange { tool, args }): the call's checks again, on the
 * environment as it is now (Claude Code: "the call is refused, changing nothing, if it does not match the target as it is
 * when the user approves"), and what the card showed (`body.shown`) must still be what would be made; then the change.
 * `reachRunning(data)`: the route's push to every running chat of this chat's environment. Answers { ok, said, envId,
 * name, environments } or { error } (nothing changed).
 */
export async function approveEnvChange({ env, bucket, uid, id, meta, deps, body, reachRunning, at = Date.now() }) {
  const tool = body && typeof body.tool === "string" ? body.tool : "";
  if (!ENV_CARD_TOOLS.includes(tool) || !body.args || typeof body.args !== "object" || Array.isArray(body.args)) return { error: "That is not an environment change Coder proposed." };
  if (meta.status === "running") return { error: "Coder is still working on the last message." };
  const v = ENV_INPUT_CHECKS[tool](body.args);
  if (v.error) return { error: v.error.replace(/^error: /, "") };
  const args = v.args;
  const st = await envState(env, bucket, uid, meta, [args.environment_id]);
  // (What the card showed must still be what would be made: `shown`, the card as the page drew it.)
  const now = envCard(st, tool, args);
  if (now.error) return { error: now.error.replace(/^error: /, "") };
  if (!sameCard(body.shown, now.card)) return { error: "what the card shows no longer matches the environment as it is now; nothing was changed" };
  const fresh = async () => (await getJson(bucket, metaKey(uid, id), null)) || meta;
  if (tool === "update_environment") {
    const p = planUpdate(st, args);
    if (p.error) return { error: p.error.replace(/^error: /, "") };
    await writeEnvData(env, bucket, uid, st.envId, p.data);
    let list = st.list;
    if (p.plan.rename) { const me = list.find((e) => e.id === st.envId); if (me) { me.name = p.plan.rename; await saveEnvList(bucket, uid, list); } }
    if (typeof reachRunning === "function") await reachRunning(p.data).catch(() => 0);
    return { ok: true, said: approvedText({ kind: "update", name: p.name }), envId: st.envId, name: p.plan.rename || p.name, environments: envListOut(list) };
  }
  if (tool === "create_environment") {
    const p = planCreate(st, args);
    if (p.error) return { error: p.error.replace(/^error: /, "") };
    const list = st.list;
    const newId = envIdFor(p.entry.name, list);
    const entry = { id: newId, name: p.entry.name, at, repos: p.entry.repos };
    if (entry.repos.length) entry.used = at; // made for these repos: their next chat starts with it (Coder's pick for a repo's new chat)
    await writeEnvData(env, bucket, uid, newId, p.data);
    list.push(entry);
    await saveEnvList(bucket, uid, list);
    let moved = false;
    if (p.moves) {
      const m2 = await fresh();
      const next = { ...m2, envId: newId, envMoved: true };
      await bucket.put(metaKey(uid, id), JSON.stringify(next), { httpMetadata: { contentType: "application/json" } });
      await pushNetwork(env, deps, uid, id, next, p.data);
      moved = true;
    }
    return { ok: true, said: approvedText({ kind: "create", name: entry.name, args, from: (st.list.find((e) => e.id === st.envId) || { name: "Default" }).name }, { moved, stayWhy: p.stayWhy }), envId: moved ? newId : st.envId, name: moved ? entry.name : (list.find((e) => e.id === st.envId) || { name: "Default" }).name, created: { id: newId, name: entry.name }, environments: envListOut(list) };
  }
  const p = planSwitch(st, args);
  if (p.error) return { error: p.error.replace(/^error: /, "") };
  const m2 = await fresh();
  const next = { ...m2, envId: p.target.id, envMoved: true };
  await bucket.put(metaKey(uid, id), JSON.stringify(next), { httpMetadata: { contentType: "application/json" } });
  // (A chat of this repo used it: Coder offers it first for the repo's next chat, as when a chat picks it.)
  if (meta.repo) await markUsed(bucket, uid, p.target.id, meta.repo).catch(() => {});
  await pushNetwork(env, deps, uid, id, next, st.data[p.target.id]);
  return { ok: true, said: approvedText({ kind: "switch", name: p.target.name }), envId: p.target.id, name: p.target.name, environments: envListOut(await listEnvs(bucket, uid)) };
}

