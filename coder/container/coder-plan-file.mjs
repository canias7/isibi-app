/**
 * THE CHAT'S PLAN FILE ON CODER'S MACHINE (coder-plan.mjs has plan mode's words, its tool and its checks; this file is the
 * plan file's reading and writing, apart because it needs Node's file modules and Coder's Worker, which loads plan mode's
 * words through coder-perms.mjs, has none).
 */
import { open, unlink, lstat } from "node:fs/promises";
import { constants, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planSlug, SLUG_RE, PLAN_READ_MAX } from "./coder-plan.mjs";

/**
 * THE CHAT'S PLAN FILE, KEPT BY CODER'S MACHINE (Claude Code: "~/.claude/plans", one file a session; here one a chat, in
 * `dir`, beside the chat's memory and never in the repository): its name, chosen once (`stateFile`, root's own), Claude
 * Code's two session flags (`exited`: a plan was approved, for "Re-entering Plan Mode"; `on`: plan mode was told and its
 * end not yet), and the file, read and written by root as the AI's own plain file only (never through a link, a hard link,
 * or a file of anyone else's: the AI's user can change the folder). `uid`/`gid`: the AI's user (none in tests).
 */
export function planStore({ dir, stateFile, uid = null, gid = null, rand = Math.random } = {}) {
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
  const fileOf = (slug) => join(dir, slug + ".md");
  const current = () => { const s = load(); return s.slug ? fileOf(s.slug) : ""; };
  return {
    dir,
    /** The plan file's path, or "" before plan mode named one. */
    current,
    /** The plan file's path, named now from the owner's message when it has no name yet (one not taken: ten tries). */
    async name(seed) {
      const s = load();
      if (s.slug) return fileOf(s.slug);
      let slug = "";
      for (let k = 0; k < 10; k++) { slug = planSlug(seed, rand); if (!(await lstat(fileOf(slug)).then(() => true, () => false))) break; }
      s.slug = slug;
      keep();
      return fileOf(slug);
    },
    /** Its text (at most PLAN_READ_MAX bytes), or null: not there, not the AI's own plain file, or unreadable. */
    async read() {
      const file = current();
      if (!file) return null;
      let fh;
      try {
        fh = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const s = await fh.stat();
        if (!s.isFile() || s.nlink !== 1 || (own && s.uid !== uid)) return null;
        const buf = Buffer.alloc(Math.min(s.size, PLAN_READ_MAX));
        const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
        return buf.subarray(0, bytesRead).toString("utf8");
      } catch { return null; } finally { if (fh) await fh.close().catch(() => {}); }
    },
    /** The plan the owner edited, written as a new plain file of the AI's (whatever had the name goes first): true when saved. */
    async write(text) {
      const file = current();
      if (!file) return false;
      try {
        await unlink(file).catch(() => {});
        const fh = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
        try { await fh.writeFile(String(text)); if (own) await fh.chown(uid, Number.isInteger(gid) ? gid : uid); } finally { await fh.close(); }
        return true;
      } catch { return false; }
    },
    flags: () => { const s = load(); return { exited: s.exited === true, on: s.on === true }; },
    setFlags: (f) => { const s = load(); let changed = false; for (const k of ["exited", "on"]) if (f && typeof f[k] === "boolean" && (s[k] === true) !== f[k]) { s[k] = f[k]; changed = true; } if (changed) keep(); },
  };
}
