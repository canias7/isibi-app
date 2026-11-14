// THE LANGUAGE SERVERS' KEEPER (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; LSP becomes Claude
// Code's plugin version, whose servers run for the whole session; "Fix base on Claude Code docs, please"): `node
// coder-lspd.mjs <project> [<socket>]`. Coder's service starts it (server.mjs) the first time a lookup, a write or an edit
// needs a server, as the AI's user inside the same sandbox and room as its commands, as it starts a background command, and
// keeps it at each turn's end as it keeps those; it keeps the project's servers, answers on its socket (in $HOME/.coder-lsp,
// socketFor, unless given), and ends when the chat's machine stops. It never runs as root: Coder's service never starts it so.
import { serveKeeper, socketFor } from "./coder-lsp.mjs";

const [root, given] = process.argv.slice(2);
if (!root) process.exit(2);
let keeper = null;
const stop = () => { if (keeper) keeper.close(0); else process.exit(0); };
for (const s of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(s, stop);
// (Anything it did not expect: its servers stopped with it, and the next call that needs one has Coder's service start another.)
process.on("uncaughtException", () => { if (keeper) keeper.close(1); else process.exit(1); });
(async () => {
  const sock = given || (await socketFor(root));
  if (!sock) process.exit(3);
  keeper = await serveKeeper(root, sock);
})().catch(() => process.exit(1));
