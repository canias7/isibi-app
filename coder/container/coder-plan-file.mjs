/**
 * THE CHAT'S PLAN FILE ON CODER'S MACHINE (coder-plan.mjs has plan mode's words, its tool and its checks; this file is the
 * plan file's reading and writing, apart because it needs Node's file modules and Coder's Worker, which loads plan mode's
 * words through coder-perms.mjs, has none).
 */
import { open, unlink, lstat, realpath, readlink } from "node:fs/promises";
import { constants, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";
import { planSlug, SLUG_RE, PLAN_READ_MAX } from "./coder-plan.mjs";

/**
 * CLAUDE CODE 2.1.325'S REFUSAL OF A PLAN FILE IT CANNOT SHOW TO STAY IN THE PROJECT (with plansDirectory set; its changelog:
 * "Fixed plan files sometimes being written outside the project when `plansDirectory` is set; a write that can't be shown to
 * stay inside the project is now refused").
 */
export const PLANS_DIR_UNCONTAINED = "Could not confirm the plansDirectory folder and plan file are inside this project. Check that the folder exists, that no link leads out of it, and that the plan file is not a link and has no hard link. If this system or drive cannot report that, remove plansDirectory from your settings to use the default plans folder.";
/** Its warning for a plansDirectory it does not use (it then keeps the default plans folder). */
export const plansDirWarning = (raw) => "plansDirectory must be within project root, with no backslash in its path off Windows: " + raw;

/**
 * THE plansDirectory SETTING AS CLAUDE CODE 2.1.325 TAKES IT ("Claude Code resolves the path relative to the project root";
 * it "stores plans in ~/.claude/plans instead of the directory you set" when "the path resolves outside the project root" or
 * "the resolved path contains a backslash"): the folder, resolved from the project's folder, when it is inside it, has no
 * backslash, and the nearest folder of it that exists is, its links followed, inside the project's own real folder; else
 * null (the chat's default plans folder is used, with plansDirWarning).
 */
export async function plansDirectoryFor(raw, root) {
  if (typeof raw !== "string" || !raw || typeof root !== "string" || !root) return null;
  const want = resolve(root, raw), base = resolve(root);
  if (want !== base && !want.startsWith(base + sep)) return null;
  if (want.includes("\\")) return null;
  let rootReal;
  try { rootReal = await realpath(base); } catch { return null; }
  for (let at = want; ; at = dirname(at)) {
    let real = null;
    try { real = await realpath(at); } catch { real = null; }
    if (real !== null) return real === rootReal || real.startsWith(rootReal + sep) ? want : null;
    if (dirname(at) === at) return null;
  }
}

/**
 * THE CHAT'S PLAN FILE, KEPT BY CODER'S MACHINE (Claude Code: "~/.claude/plans", one file a session; here one a chat, in
 * `dir`, beside the chat's memory and never in the repository, unless the repository's plansDirectory names a folder in it,
 * `custom` { dir, root }): its name, chosen once (`stateFile`, root's own), Claude Code's two session flags (`exited`: a plan
 * was approved, for "Re-entering Plan Mode"; `on`: plan mode was told and its end not yet), and the file, read and written by
 * root as the AI's own plain file only (never through a link, a hard link, or a file of anyone else's: the AI's user can
 * change the folder). `uid`/`gid`: the AI's user (none in tests). In a plansDirectory folder, root holds the folder itself
 * first and checks that it is in the project (Claude Code: "a write that can't be shown to stay inside the project is now
 * refused"); a plan it cannot save there goes to the default folder under a new name, which the chat then keeps (Claude
 * Code's "The approved plan was saved to …, which this session uses from now on").
 */
export function planStore({ dir, stateFile, uid = null, gid = null, rand = Math.random, custom = null } = {}) {
  let st = null;
  const load = () => {
    if (st) return st;
    let j = null;
    try { j = JSON.parse(readFileSync(stateFile, "utf8")); } catch { j = null; }
    st = j && typeof j === "object" && !Array.isArray(j) ? j : {};
    if (!(typeof st.slug === "string" && st.slug.length <= 100 && SLUG_RE.test(st.slug))) delete st.slug;
    return st;
  };
  const keep = () => { try { writeFileSync(stateFile, JSON.stringify(st), { mode: 0o600 }); } catch { /* this job still knows it */ } };
  const own = Number.isInteger(uid);
  /** The folder of the chat's plan file: plansDirectory's, unless the plan was moved to the default folder. */
  const inCustom = (s) => !!(custom && custom.dir && !s.inDefault);
  const dirOf = (s) => (inCustom(s) ? custom.dir : dir);
  const fileOf = (slug, s) => join(dirOf(s), slug + ".md");
  const current = () => { const s = load(); return s.slug ? fileOf(s.slug, s) : ""; };
  /**
   * The plan file's folder as root may use it: the default one as it is (root's own folder holds it); plansDirectory's held
   * open (never through a link of its own) and found, by what it really is, inside the project's real folder; its path through
   * the open folder ("/proc/self/fd/N"), so a link put in its place afterwards changes nothing. `close` when done.
   */
  const heldDir = async (s) => {
    if (!inCustom(s)) return { path: dir, close: async () => {} };
    let fh = null;
    try {
      const rootReal = await realpath(custom.root);
      fh = await open(custom.dir, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const real = await readlink("/proc/self/fd/" + fh.fd);
      if (!(real === rootReal || real.startsWith(rootReal + sep))) throw new Error(PLANS_DIR_UNCONTAINED);
      const held = fh;
      return { path: "/proc/self/fd/" + held.fd, close: async () => { await held.close().catch(() => {}); } };
    } catch (e) {
      if (fh) await fh.close().catch(() => {});
      throw e && e.message === PLANS_DIR_UNCONTAINED ? e : new Error(PLANS_DIR_UNCONTAINED);
    }
  };
  /** The plan as a new plain file of the AI's in `folder` (whatever had the name goes first). */
  const writeIn = async (folder, slug, text, exclusive = false) => {
    const file = join(folder, slug + ".md");
    if (!exclusive) await unlink(file).catch(() => {});
    const fh = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
    try { await fh.writeFile(String(text)); if (own) await fh.chown(uid, Number.isInteger(gid) ? gid : uid); } finally { await fh.close(); }
  };
  const store = {
    dir,
    /** The plan file's path, or "" before plan mode named one. */
    current,
    /** The plan file's path, named now from the owner's message when it has no name yet (one not taken: ten tries). */
    async name(seed) {
      const s = load();
      if (s.slug) return fileOf(s.slug, s);
      let slug = "";
      for (let k = 0; k < 10; k++) { slug = planSlug(seed, rand); if (!(await lstat(fileOf(slug, s)).then(() => true, () => false))) break; }
      s.slug = slug;
      keep();
      return fileOf(slug, s);
    },
    /** Its text (at most PLAN_READ_MAX bytes), or null: not there, not the AI's own plain file, unreadable, or out of the project. */
    async read() {
      const s = load();
      if (!s.slug) return null;
      let held = null, fh;
      try {
        held = await heldDir(s);
        fh = await open(join(held.path, s.slug + ".md"), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const t = await fh.stat();
        if (!t.isFile() || t.nlink !== 1 || (own && t.uid !== uid)) return null;
        const buf = Buffer.alloc(Math.min(t.size, PLAN_READ_MAX));
        const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
        return buf.subarray(0, bytesRead).toString("utf8");
      } catch { return null; } finally { if (fh) await fh.close().catch(() => {}); if (held) await held.close(); }
    },
    /** The plan the owner edited, written as a new plain file of the AI's (whatever had the name goes first): true when saved. */
    async write(text) {
      return (await store.save(text, { move: false })).saved === true;
    },
    /**
     * THE PLAN THE OWNER EDITED, SAVED AS CLAUDE CODE 2.1.325 SAVES IT: `{ saved: true }`; else `{ notice }`, its warning, and,
     * when a plan in plansDirectory's folder was saved in the default folder instead (under a new name the chat keeps from now
     * on, `move`), `savedTo`.
     */
    async save(text, { move = true } = {}) {
      const s = load();
      const file = current();
      if (!file) return { notice: "The approved plan could not be saved: no plan file is named yet" };
      let why1 = "";
      let held = null;
      try {
        held = await heldDir(s);
        await writeIn(held.path, s.slug, text);
        return { saved: true };
      } catch (e) {
        why1 = String((e && e.message) || e);
      } finally { if (held) await held.close(); }
      // (Claude Code, in plansDirectory's folder: a write that failed with the file holding the text after all is a save.)
      if (inCustom(s) && (await store.read()) === String(text)) return { saved: true };
      if (!inCustom(s) || !move) return { notice: "The approved plan could not be saved to " + file + ": " + why1 };
      const slug = planSlug("", rand), moved = join(dir, slug + ".md");
      try { await writeIn(dir, slug, text, true); } catch (e2) {
        return { notice: "The approved plan could not be saved to " + moved + ": " + String((e2 && e2.message) || e2) + ". Coder has the approved text in this conversation. It could not be saved to " + file + " either: " + why1 };
      }
      s.slug = slug; s.inDefault = true; keep();
      return { notice: "The approved plan was saved to " + moved + ", which this session uses from now on. It could not be saved to " + file + ": " + why1, savedTo: moved };
    },
    flags: () => { const s = load(); return { exited: s.exited === true, on: s.on === true }; },
    setFlags: (f) => { const s = load(); let changed = false; for (const k of ["exited", "on"]) if (f && typeof f[k] === "boolean" && (s[k] === true) !== f[k]) { s[k] = f[k]; changed = true; } if (changed) keep(); },
  };
  return store;
}
