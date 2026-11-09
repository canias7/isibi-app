// A STAND-IN LANGUAGE SERVER for the tests (the real ones may not be installed where the tests run): it speaks LSP over
// stdio, and for each version of a file it reports an error per line with BAD and a warning per line with WARN (an INFO
// line is a hint, never reported as new), in two steps, an empty report first, as real servers may.
let buf = Buffer.alloc(0);
const send = (o) => { const s = JSON.stringify(o); process.stdout.write("Content-Length: " + Buffer.byteLength(s) + "\r\n\r\n" + s); };
const report = (uri, text) => {
  send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } });
  setTimeout(() => send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: text.split("\n").flatMap((l, i) =>
    l.includes("BAD") ? [{ range: { start: { line: i, character: l.indexOf("BAD") }, end: { line: i, character: l.indexOf("BAD") + 3 } }, severity: 1, message: "bad thing: " + l.trim(), code: "fake-bad", source: "Fake" }]
    : l.includes("WARN") ? [{ range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } }, severity: 2, message: "a warning", source: "Fake" }]
    : l.includes("INFO") ? [{ range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } }, severity: 3, message: "a hint" }] : []) } }), 150);
};
process.stdin.on("data", (b) => {
  buf = Buffer.concat([buf, b]);
  for (;;) {
    const h = buf.indexOf("\r\n\r\n");
    if (h < 0) return;
    const len = Number(/Content-Length: (\d+)/i.exec(buf.slice(0, h).toString())[1]);
    if (buf.length < h + 4 + len) return;
    const m = JSON.parse(buf.slice(h + 4, h + 4 + len).toString("utf8"));
    buf = buf.slice(h + 4 + len);
    if (m.method === "initialize") send({ jsonrpc: "2.0", id: m.id, result: { capabilities: { textDocumentSync: 1 } } });
    else if (m.method === "textDocument/didOpen") report(m.params.textDocument.uri, m.params.textDocument.text);
    else if (m.method === "textDocument/didChange") report(m.params.textDocument.uri, m.params.contentChanges[0].text);
    else if (m.id !== undefined) send({ jsonrpc: "2.0", id: m.id, result: null });
  }
});
