// THE LANGUAGE SERVERS' KEEPER (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; LSP becomes Claude
// Code's plugin version, whose servers run for the whole session): `node coder-lspd.mjs <project> <socket>`. The lsp tool
// and the after-write check (coder-lsp.mjs) start it the first time they need a server, as the AI's user, inside the same
// sandbox and room as that call; it keeps the project's servers, answers on its socket, and stops after it has been idle a
// while (IDLE_MS) or when Coder's end of a turn ends the AI's processes. It never runs as root: Coder's service never starts it.
import { serveKeeper } from "./coder-lsp.mjs";

const [root, sock] = process.argv.slice(2);
if (!root || !sock) process.exit(2);
let keeper = null;
const stop = () => { if (keeper) keeper.close(0); else process.exit(0); };
for (const s of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(s, stop);
// (Anything it did not expect: its servers stopped with it, and the next call starts a new keeper.)
process.on("uncaughtException", () => { if (keeper) keeper.close(1); else process.exit(1); });
serveKeeper(root, sock).then((k) => { keeper = k; }, () => process.exit(1));
