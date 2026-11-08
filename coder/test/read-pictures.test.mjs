// CODER'S READ OPENS PICTURES, PDFs AND NOTEBOOKS (owner item 1, 2026-11-08: "finish, 1"), like Claude
// Code's Read (its tools reference: it "reads images (PNG, JPG, …) and presents them visually", "reads PDFs
// via the pages parameter (max 20 pages per request; required for PDFs over 10 pages)" and "reads Jupyter
// notebooks (.ipynb) as cells with outputs"). Grok takes JPG and PNG pictures, and a tool answers in text
// (xAI's docs, read 2026-11-07), so the pictures go to Grok beside the round's answers.
// The read tool runs as on Coder's machine (node coder-tools.mjs, in the project's folder); the parts that
// need ImageMagick or poppler (both in Coder's machine image) are skipped where they are not installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const T = await import("../container/coder-tools.mjs");
const has = (cmd) => spawnSync("sh", ["-c", "command -v " + cmd], { stdio: "ignore" }).status === 0;
const MAGICK = has("convert"), POPPLER = has("pdftotext") && has("pdfinfo") && has("pdftoppm");

/** The read tool, as Coder's machine runs it: { code, text, pictures }. */
function read(dir, args) {
  const r = spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: "read", args })).toString("base64")], { cwd: dir, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const out = String(r.stdout || "");
  if (!out.startsWith(T.PICS_MARK)) return { code: r.status, text: out, pictures: [] };
  const j = JSON.parse(out.slice(T.PICS_MARK.length));
  return { code: r.status, text: j.text, pictures: j.pictures, raw: out };
}
const pngOf = (p) => Buffer.from(p.data, "base64");

/** A small PDF: each page a line of text, or (null) only a drawing, as a scan would be. */
function makePdf(pages) {
  const objs = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = "<< /Type /Pages /Kids [" + pages.map((_, i) => 4 + i * 2 + " 0 R").join(" ") + "] /Count " + pages.length + " >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((t, i) => {
    const content = t ? "BT /F1 18 Tf 72 720 Td (" + t + ") Tj ET" : "0.2 0.4 0.8 rg 100 400 300 200 re f";
    objs[4 + i * 2] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents " + (5 + i * 2) + " 0 R >>";
    objs[5 + i * 2] = "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream";
  });
  let out = "%PDF-1.4\n";
  const offs = [];
  for (let id = 1; id < objs.length; id++) { offs[id] = out.length; out += id + " 0 obj\n" + objs[id] + "\nendobj\n"; }
  const xref = out.length;
  out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n" + offs.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  return Buffer.from(out + "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n", "latin1");
}

test("CD193 read shows a picture to Grok: PNG and JPG as Grok takes them, GIF, WebP, BMP and TIFF made PNG first, a big one made smaller, its size said; a broken one, or one too big, is refused; a text file reads as before, never with the pictures' mark", { skip: !MAGICK && "ImageMagick is not installed here (it is on Coder's machine)" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-pics-"));
  execFileSync("convert", ["-size", "2400x1200", "gradient:blue-white", join(dir, "shot.png")]);
  execFileSync("convert", ["-size", "640x480", "plasma:", join(dir, "photo.jpg")]);
  for (const k of ["gif", "webp", "bmp", "tiff"]) execFileSync("convert", ["-size", "300x200", "xc:red", join(dir, "pic." + k)]);
  // A big screenshot: made 1600 wide (its longest side), and said so.
  const shot = read(dir, { path: "shot.png" });
  assert.equal(shot.code, 0, shot.text);
  assert.match(shot.text, /^Picture: shot\.png \(1600×800, PNG, \d+ KB\), shown to you as a picture after these results\.$/);
  assert.equal(shot.pictures.length, 1);
  assert.equal(shot.pictures[0].type, "image/png");
  assert.deepEqual(T.picSize(pngOf(shot.pictures[0])), { w: 1600, h: 800 });
  // A photo stays a JPEG; the other kinds become PNGs (Grok takes only JPG and PNG).
  const photo = read(dir, { path: "photo.jpg" });
  assert.equal(photo.pictures[0].type, "image/jpeg");
  assert.deepEqual(T.picSize(pngOf(photo.pictures[0])), { w: 640, h: 480 });
  for (const k of ["gif", "webp", "bmp", "tiff"]) {
    const r = read(dir, { path: "pic." + k });
    assert.equal(r.code, 0, k + ": " + r.text);
    assert.match(r.text, new RegExp("^Picture: pic\\." + k + " \\(300×200, " + k.toUpperCase() + ", "));
    assert.equal(r.pictures[0].type, "image/png", k);
    assert.equal(pngOf(r.pictures[0]).readUInt32BE(0), 0x89504e47, k + " is a real PNG");
  }
  // NOT A PICTURE AFTER ALL: refused, with why.
  await writeFile(join(dir, "fake.png"), "this is not a picture");
  const fake = read(dir, { path: "fake.png" });
  assert.equal(fake.code, 1);
  assert.match(fake.text, /^error: fake\.png cannot be shown: it could not be opened as a picture/);
  // Too big to show, even made smaller: refused (one read's pictures fit in what the machine passes on).
  const tiny = await T.asPicture(execFileSync("convert", ["-size", "800x800", "plasma:", "png:-"], { maxBuffer: 16 * 1024 * 1024 }), "png", 2000);
  assert.deepEqual(tiny, { why: "it is too big to show, even made smaller" });
  // A TEXT FILE, as before: its numbered lines; never the mark, whatever it holds (the mark has a NUL in it,
  // so a file holding it is not text at all, and is refused as before).
  await writeFile(join(dir, "a.txt"), T.PICS_MARK + '{"text":"x","pictures":[]}\nline two\n');
  const forged = read(dir, { path: "a.txt" });
  assert.deepEqual([forged.code, forged.pictures.length], [1, 0]);
  assert.match(forged.text, /^error: a\.txt is a binary file/);
  await writeFile(join(dir, "b.txt"), 'coder-pictures {"text":"x","pictures":[]}\nline two\n');
  const txt = read(dir, { path: "b.txt" });
  assert.equal(txt.code, 0);
  assert.equal(txt.pictures.length, 0);
  assert.ok(!txt.text.startsWith(T.PICS_MARK), "a text file's answer starts with its first line's number");
  assert.match(txt.text, /^\s+1\tcoder-pictures/);
  // Outside the project, as before: refused.
  assert.match(read(dir, { path: "/etc/hostname" }).text, /^error: that path is outside the project/);
});

test("CD194 read opens a PDF like Claude Code's Read: each page's text, and every page shown as a picture too (the owner, 2026-11-08: \"Yes fix that too\"), sharing the read's room so all of up to 20 pages fit; pages \"1-5\" picks pages, at most 20 at a time, and is needed past 10 pages; anything else is refused with what to do", { skip: !(POPPLER && MAGICK) && "poppler or ImageMagick is not installed here (both are on Coder's machine)" }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-pdf-"));
  await writeFile(join(dir, "doc.pdf"), makePdf(["Hello from page one", null, "And page three"]));
  const doc = read(dir, { path: "doc.pdf" });
  assert.equal(doc.code, 0, doc.text);
  assert.equal(doc.text, "doc.pdf: PDF, 3 pages; each page is also shown to you as a picture after these results, in order\n\n--- Page 1 (picture 1) ---\nHello from page one\n\n--- Page 2 (picture 2; no text) ---\n\n--- Page 3 (picture 3) ---\nAnd page three");
  assert.equal(doc.pictures.length, 3, "every page, the ones with text too");
  const page = T.picSize(Buffer.from(doc.pictures[0].data, "base64"));
  assert.deepEqual(page, { w: 1082, h: 1400 }, "a letter page drawn 1400 on its longest side: " + JSON.stringify(page));
  // ONE PAGE, or a range.
  assert.equal(read(dir, { path: "doc.pdf", pages: "3" }).text, "doc.pdf: PDF, 3 pages, pages 3-3; each page is also shown to you as a picture after these results, in order\n\n--- Page 3 (picture 1) ---\nAnd page three");
  assert.equal(read(dir, { path: "doc.pdf", pages: "1-2" }).pictures.length, 2);
  // PAST 10 PAGES, pages is needed; at most 20 at a time.
  await writeFile(join(dir, "long.pdf"), makePdf(Array.from({ length: 25 }, (_, i) => "Long page " + (i + 1))));
  assert.equal(read(dir, { path: "long.pdf" }).text, 'error: long.pdf has 25 pages: give pages, e.g. "1-5" (at most 20 at a time)');
  assert.equal(read(dir, { path: "long.pdf", pages: "2-22" }).text, 'error: at most 20 pages at a time: ask for fewer (e.g. "2-21")');
  const some = read(dir, { path: "long.pdf", pages: "24-25" });
  assert.equal(some.text, "long.pdf: PDF, 25 pages, pages 24-25; each page is also shown to you as a picture after these results, in order\n\n--- Page 24 (picture 1) ---\nLong page 24\n\n--- Page 25 (picture 2) ---\nLong page 25");
  // 20 PAGES AT ONCE, the most: all 20 as pictures, within the read's room, each at most PIC_ONE_MAX.
  const twenty = read(dir, { path: "long.pdf", pages: "1-20" });
  assert.equal(twenty.pictures.length, 20, twenty.text.slice(0, 300));
  assert.ok(twenty.pictures.reduce((n, p) => n + p.data.length, 0) <= T.PICS_BUDGET && twenty.pictures.every((p) => p.data.length <= T.PIC_ONE_MAX));
  assert.match(twenty.text, /--- Page 20 \(picture 20\) ---\nLong page 20$/);
  for (const bad of ["0", "26", "5-3", "one", "1-2-3"]) assert.equal(read(dir, { path: "long.pdf", pages: bad }).text, 'error: pages must be one page or a range like "1-5", within the PDF\'s 25 pages', bad);
  // NOT A PDF after all.
  await writeFile(join(dir, "fake.pdf"), "not a pdf");
  assert.match(read(dir, { path: "fake.pdf" }).text, /^error: fake\.pdf could not be opened as a PDF/);
});

test("CD195 read opens a Jupyter notebook as its cells with their outputs (Claude Code's Read): code and markdown, printed text, results, errors without terminal colours, and its plots shown as pictures; a .ipynb that is not a notebook reads as text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-nb-"));
  const plot = MAGICK ? execFileSync("convert", ["-size", "120x80", "xc:orange", "png:-"]).toString("base64") : "";
  const nb = { nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [
    { cell_type: "markdown", id: "intro", metadata: {}, source: ["# Sales\n", "Notes here"] },
    { cell_type: "code", id: "calc", execution_count: 3, metadata: {}, source: ["print('hi')\n", "1 + 1"], outputs: [
      { output_type: "stream", name: "stdout", text: ["hi\n"] },
      { output_type: "execute_result", execution_count: 3, metadata: {}, data: { "text/plain": ["2"] } },
      ...(plot ? [{ output_type: "display_data", metadata: {}, data: { "image/png": plot, "text/plain": ["<Figure>"] } }] : []),
      { output_type: "error", ename: "ValueError", evalue: "bad value", traceback: ["\u001b[31mValueError\u001b[0m: bad value"] },
    ] },
  ] };
  await writeFile(join(dir, "sales.ipynb"), JSON.stringify(nb));
  const r = read(dir, { path: "sales.ipynb" });
  assert.equal(r.code, 0, r.text);
  assert.equal(r.text, [
    "sales.ipynb: Jupyter notebook, 2 cells",
    "--- Cell 1 (markdown, id intro) ---\n# Sales\nNotes here",
    "--- Cell 2 (code, run 3, id calc) ---\nprint('hi')\n1 + 1",
    "[stdout]\nhi\n",
    "[output]\n2",
    ...(plot ? ["[picture output: shown to you as picture 1 after these results]"] : []),
    "[error] ValueError: bad value\nValueError: bad value",
  ].join("\n\n"));
  assert.equal(r.pictures.length, plot ? 1 : 0);
  if (plot) assert.deepEqual(T.picSize(pngOf(r.pictures[0])), { w: 120, h: 80 });
  // Not a notebook (no cells): its text, as any file.
  await writeFile(join(dir, "odd.ipynb"), "not json at all\n");
  assert.match(read(dir, { path: "odd.ipynb" }).text, /^\s+1\tnot json at all/);
});

test("CD196 the agent shows read's pictures to Grok: the read's answer is its text, then a note from Coder's app with the pictures attached (as Grok takes them); the chat shows the text; the saved history keeps a note instead of a picture; a job keeps at most 8 pictures attached; only read's answer can carry them", async () => {
  const { runCoder, PICS_KEEP, keepPics } = await import("../container/coder-agent.mjs");
  const { toResponsesInput } = await import("../container/coder-model.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const pic = (n) => ({ type: "image/png", data: Buffer.from("png-" + n).toString("base64") });
  const steps = [
    say("Checking the page.", [call("read", { path: "shot.png" }, "r1"), call("bash", { command: "echo ok" }, "b1")]),
    say("", [call("bash", { command: "fake-mark" }, "b2")]),
    say("It looks right.", []),
  ];
  const seen = [];
  const events = [];
  const out = await runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return steps[Math.min(seen.length - 1, steps.length - 1)]; },
    exec: async ({ command }) => {
      if (command.includes("coder-tools.mjs")) return { code: 0, output: T.PICS_MARK + JSON.stringify({ text: "Picture: shot.png (1280×720, PNG, 40 KB), shown to you as a picture after these results.", pictures: [pic(1), { type: "image/svg+xml", data: "PHN2Zz4=" }] }) };
      // Anything else that prints the mark (here, a command) is only text.
      if (command === "fake-mark") return { code: 0, output: T.PICS_MARK + JSON.stringify({ text: "x", pictures: [pic(2)] }) };
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
  }, { messages: [], text: "Does the page look right?" });
  assert.equal(out.status, "done");
  // GROK'S NEXT REQUEST: both answers, then the note with the picture (an SVG is never passed on).
  const after = seen[1].messages.slice(-3);
  assert.deepEqual(after.map((m) => m.role), ["tool", "tool", "user"]);
  assert.equal(after[0].content, "Picture: shot.png (1280×720, PNG, 40 KB), shown to you as a picture after these results.");
  assert.equal(after[2].content, "(Note from Coder's app, not the owner: the picture your read opened (shot.png), attached here in order.)");
  assert.deepEqual(after[2].images, ["data:image/png;base64," + pic(1).data]);
  const input = toResponsesInput(seen[1].messages).input.at(-1);
  assert.deepEqual(input.content[1], { type: "input_image", image_url: "data:image/png;base64," + pic(1).data, detail: "auto" }, "as Grok takes a picture");
  // The picture stays for the rest of the job; a command's output that looks like the mark carries none.
  assert.equal(seen[2].messages.filter((m) => Array.isArray(m.images)).length, 1);
  assert.ok(seen[2].messages.some((m) => m.role === "tool" && m.content.startsWith("\u0000coder-pictures") === false && /fake|coder-pictures|x/.test(m.content)));
  // THE CHAT shows the read's text; THE SAVED HISTORY keeps a note in place of the picture.
  assert.equal(events.find((e) => e.type === "result" && e.id === "r1").output, "Picture: shot.png (1280×720, PNG, 40 KB), shown to you as a picture after these results.");
  const savedNote = out.messages.find((m) => m.role === "user" && /your read opened/.test(m.content));
  assert.equal(savedNote.content, "(Note from Coder's app, not the owner: the picture your read opened (shot.png), attached here in order.)\n[1 picture attached]");
  assert.equal(savedNote.images, undefined);
  assert.ok(!JSON.stringify(out.messages).includes(pic(1).data), "no picture in the saved history");

  // AT MOST 24 PICTURES STAY ATTACHED in a job (a 20-page PDF read and a few more; the owner, 2026-11-08: every PDF
  // page a picture, like Claude Code), and at most PICS_KEEP_BYTES of them: the oldest are let go, with a note.
  const { PICS_KEEP_BYTES } = await import("../container/coder-agent.mjs");
  assert.deepEqual([PICS_KEEP, PICS_KEEP_BYTES], [24, 18_000_000]);
  const convo = [{ role: "user", content: "owner", images: ["data:image/png;base64,AAAA"] }];
  const read3 = (i, k = 3, size = 4) => ({ role: "user", content: "(Note from Coder's app, not the owner: read " + i + ")", images: Array.from({ length: k }, (_, j) => "p" + i + j + "x".repeat(size)), readPics: true });
  convo.push(read3(0), read3(1, 4));
  for (let i = 2; i < 9; i++) convo.push(read3(i));
  keepPics(convo);
  assert.deepEqual(convo.map((m) => (m.images || []).length), [1, 0, 3, 3, 3, 3, 3, 3, 3, 3], "the owner's own picture stays; reads keep their newest 24");
  assert.match(convo[1].content, / \[No longer attached: read the file again to see it\.\]$/);
  assert.match(convo[2].content, / \[Only the last 3 of them are still attached\.\]$/);
  keepPics(convo);
  assert.equal(convo[2].content.match(/Only the last/g).length, 1, "said once");
  // BY SIZE TOO: pictures of 5,000,000 characters each, so only 3 fit in 18,000,000.
  const big = [read3("a", 2, 5_000_000), read3("b", 2, 5_000_000)];
  keepPics(big);
  assert.deepEqual(big.map((m) => (m.images || []).length), [1, 2], "the newest that fit, by size");
});
