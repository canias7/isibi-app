// THE ROOM'S END OF THE PIPE TO CODER'S GATE (coder-room.mjs). Started by
// Coder's service, as root, inside the room's network: it listens where the
// commands are told the gate is (127.0.0.1:<port>) and passes each connection
// to the gate's socket, which only root can open. The commands cannot stop it
// (it is root's), and it can reach nothing but the gate.
//   node coder-room-forward.mjs <port> <socket>
import net from "node:net";

const [port, sock] = process.argv.slice(2);
const server = net.createServer((s) => {
  const c = net.connect(sock);
  s.pipe(c); c.pipe(s);
  s.on("error", () => c.destroy());
  c.on("error", () => s.destroy());
});
server.on("error", (e) => { process.stderr.write(String((e && e.message) || e) + "\n"); process.exit(1); });
server.listen(Number(port), "127.0.0.1", () => process.stdout.write("ready\n"));
