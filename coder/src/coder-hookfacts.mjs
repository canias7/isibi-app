// WHAT CODER'S HOOKS NEED FROM THE WORKER ABOUT A CHAT'S NEXT MESSAGE (2026-11-27, the round "make Coder's hooks match Claude
// Code's"; container/coder-hookevents.mjs runs the hooks): a model switch since the chat's last message (PreModelSwitch and
// PostModelSwitch, source "command" for /model, "picker" for the model picker), a Settings change (ConfigChange,
// user_settings), and working folders the owner added (DirectoryAdded). The first message of a chat has none of them: there
// is no earlier state to change from. → { facts, seen }: `facts` for the machine, `seen` kept on the chat's meta.

export function hookFactsFor(meta, { model = "", via = "", prefsAt = 0, dirs = [], now = Date.now() } = {}) {
  const m = meta && typeof meta === "object" ? meta : {};
  const first = !(Number(m.turn) > 0);
  const facts = {};
  const last = typeof m.lastModel === "string" ? m.lastModel : "";
  if (!first && last && model && last !== model) facts.modelSwitch = { from: last, to: String(model), source: via === "command" ? "command" : "picker", requested: String(model) };
  const seenAt = Number(m.prefsSeen) || 0;
  if (!first && seenAt && Number(prefsAt) > seenAt) facts.configChanges = [{ source: "user_settings" }];
  const list = (Array.isArray(dirs) ? dirs : []).filter((d) => typeof d === "string" && d.startsWith("/"));
  const before = Array.isArray(m.dirsSeen) ? m.dirsSeen : null;
  if (!first && before) { const added = list.filter((d) => !before.includes(d)); if (added.length) facts.dirsAdded = added.slice(0, 20); }
  return { facts: Object.keys(facts).length ? facts : null, seen: { lastModel: String(model || last || ""), prefsSeen: Number(now), dirsSeen: list.slice(0, 50) } };
}
