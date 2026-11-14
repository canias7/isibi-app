// A STAND-IN LANGUAGE SERVER for the tests (the real ones may not be installed where the tests run): it speaks LSP over
// stdio. For each version of a file it reports an error per line with BAD, a warning per line with WARN, an info per line
// with INFO and a hint per line with HINT, in two steps, an empty report first, as real servers may.
// Its answers come from FAKE_LSP_SCRIPT (a JSON file, read again at each request): `{ "<method>": result }`, "$URI" in a
// result standing for the file asked about; and these switches: crashOn (a method: exit 3 when asked), crashAlways (exit 3
// at every start), hangOn (a method never answered), contentModified ({ method, times }), garbage (non-protocol text on
// stdout at start), askClient (on `initialized`, it asks the client for its configuration and an unknown thing), noReport
// (no diagnostics), slowReport (ms before the second report). FAKE_LSP_LOG gets one JSON line per message it receives, and
// {"start":pid,"argv":[...]} when it starts.
import { readFileSync, appendFileSync } from "node:fs";

const LOG = process.env.FAKE_LSP_LOG || "";
const log = (o) => { if (LOG) { try { appendFileSync(LOG, JSON.stringify(o) + "\n"); } catch { /* none */ } } };
const script = () => { try { return JSON.parse(readFileSync(process.env.FAKE_LSP_SCRIPT || "", "utf8")); } catch { return {}; } };
log({ start: process.pid, argv: process.argv.slice(2), name: process.argv[1] });
if (script().crashAlways) process.exit(3);
let buf = Buffer.alloc(0);
const send = (o) => { const s = JSON.stringify(o); process.stdout.write("Content-Length: " + Buffer.byteLength(s) + "\r\n\r\n" + s); };
if (script().garbage) process.stdout.write("Starting fake server v1.0...\n\n");
const report = (uri, text) => {
  const s = script();
  if (s.noReport) return;
  send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } });
  setTimeout(() => send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: text.split("\n").flatMap((l, i) =>
    l.includes("BAD") ? [{ range: { start: { line: i, character: l.indexOf("BAD") }, end: { line: i, character: l.indexOf("BAD") + 3 } }, severity: 1, message: "bad thing: " + l.trim(), code: "fake-bad", source: "Fake" }]
    : l.includes("WARN") ? [{ range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } }, severity: 2, message: "a warning", source: "Fake" }]
    : l.includes("INFO") ? [{ range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } }, severity: 3, message: "an info" }]
    : l.includes("HINT") ? [{ range: { start: { line: i, character: 2 }, end: { line: i, character: 3 } }, severity: 4, message: "a hint", code: 7 }] : []) } }), Number(s.slowReport) || 150);
};
const modified = new Map();
let lastUri = "";
process.stdin.on("data", (b) => {
  buf = Buffer.concat([buf, b]);
  for (;;) {
    const h = buf.indexOf("\r\n\r\n");
    if (h < 0) return;
    const len = Number(/Content-Length: (\d+)/i.exec(buf.slice(0, h).toString())[1]);
    if (buf.length < h + 4 + len) return;
    const m = JSON.parse(buf.slice(h + 4, h + 4 + len).toString("utf8"));
    buf = buf.slice(h + 4 + len);
    log(m);
    const s = script();
    if (m.method === undefined) continue; // an answer to one of its own questions: logged above
    if (s.crashOn === m.method) process.exit(3);
    if (m.method === "initialize") { if (s.slowInit) setTimeout(() => send({ jsonrpc: "2.0", id: m.id, result: { capabilities: { textDocumentSync: 1 } } }), s.slowInit); else send({ jsonrpc: "2.0", id: m.id, result: { capabilities: { textDocumentSync: 1 } } }); continue; }
    if (m.method === "initialized") { if (s.askClient) { send({ jsonrpc: "2.0", id: 900, method: "workspace/configuration", params: { items: [{ section: "python" }, {}] } }); send({ jsonrpc: "2.0", id: 901, method: "window/workDoneProgress/create", params: { token: "t" } }); } continue; }
    if (m.method === "textDocument/didOpen") { lastUri = m.params.textDocument.uri; report(m.params.textDocument.uri, m.params.textDocument.text); continue; }
    if (m.method === "textDocument/didChange") { report(m.params.textDocument.uri, m.params.contentChanges[0].text); continue; }
    if (m.method === "exit") process.exit(0);
    if (m.id === undefined) continue;
    if (m.method === "shutdown") { send({ jsonrpc: "2.0", id: m.id, result: null }); continue; }
    if (s.hangOn === m.method) continue;
    if (s.contentModified && s.contentModified.method === m.method && (modified.get(m.method) || 0) < s.contentModified.times) { modified.set(m.method, (modified.get(m.method) || 0) + 1); send({ jsonrpc: "2.0", id: m.id, error: { code: -32801, message: "content modified" } }); continue; }
    const uri = (m.params && m.params.textDocument && m.params.textDocument.uri) || (m.params && m.params.item && m.params.item.uri) || lastUri;
    const r = Object.prototype.hasOwnProperty.call(s, m.method) ? JSON.parse(JSON.stringify(s[m.method]).replaceAll("$URI", uri)) : null;
    if (r && typeof r === "object" && !Array.isArray(r) && r.$error) { send({ jsonrpc: "2.0", id: m.id, error: r.$error }); continue; }
    send({ jsonrpc: "2.0", id: m.id, result: r });
  }
});
