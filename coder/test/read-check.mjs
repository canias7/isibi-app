// CODER'S READ, IN CODER'S OWN MACHINE IMAGE (owner item 1, 2026-11-08): a picture, a PDF with a page
// that has no text, and a notebook with a plot, read as Coder reads them (node /app/coder-tools.mjs, as
// `dev`, in a project folder), with the image's own ImageMagick and poppler. Run by machine-tools.sh.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const MARK = "\u0000coder-pictures\u0000";
const read = (args) => {
  const out = String(spawnSync("node", ["--no-warnings", "/app/coder-tools.mjs", Buffer.from(JSON.stringify({ tool: "read", args })).toString("base64")], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).stdout || "");
  if (!out.startsWith(MARK)) throw new Error("no pictures for " + args.path + ": " + out.slice(0, 300));
  const j = JSON.parse(out.slice(MARK.length));
  if (!j.pictures.length || !j.pictures.every((p) => /^image\/(png|jpeg)$/.test(p.type) && p.data.length > 50)) throw new Error("bad pictures for " + args.path);
  console.log(j.text.split("\n").slice(0, 3).join(" | ") + "  + " + j.pictures.length + " picture(s), " + j.pictures.map((p) => p.type + " " + p.data.length).join(", "));
  return j;
};

execFileSync("convert", ["-size", "2400x1200", "gradient:blue-white", "shot.png"]);
execFileSync("convert", ["-size", "300x200", "xc:red", "anim.gif"]);
execFileSync("python3", ["-c", "from reportlab.pdfgen import canvas\nc = canvas.Canvas('doc.pdf')\nc.drawString(72, 720, 'pdf text ok')\nc.showPage()\nc.rect(100, 400, 300, 200, fill=1)\nc.showPage()\nc.save()"]);
const plot = execFileSync("convert", ["-size", "120x80", "xc:orange", "png:-"]).toString("base64");
writeFileSync("nb.ipynb", JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [{ cell_type: "code", execution_count: 1, metadata: {}, source: ["plot()"], outputs: [{ output_type: "display_data", metadata: {}, data: { "image/png": plot } }] }] }));

if (!/^Picture: shot\.png \(2400×1200, PNG, [^)]*\), shown to you as a picture after these results, made smaller \(1600×800\): for fine detail, crop /.test(read({ path: "shot.png" }).text)) throw new Error("the screenshot was not made smaller, or Coder was not told so");
read({ path: "anim.gif" });
const pdf = read({ path: "doc.pdf" });
if (!pdf.text.includes("--- Page 1 (picture 1) ---\npdf text ok") || !pdf.text.includes("--- Page 2 (picture 2; no text) ---") || pdf.pictures.length !== 2) throw new Error("the PDF's pages (each a picture too): " + pdf.text);
read({ path: "nb.ipynb" });
// A PDF THAT SAYS IT HAS 3 PAGES BUT HAS 12 (Claude Code 2.1.317): its pages are counted (this image's pypdf), so the
// hidden ones are read too.
const objs = ["", "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [" + Array.from({ length: 12 }, (_, i) => 4 + i * 2 + " 0 R").join(" ") + "] /Count 3 >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
for (let i = 0; i < 12; i++) { const c = "BT /F1 18 Tf 72 720 Td (Page " + (i + 1) + ") Tj ET"; objs[4 + i * 2] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents " + (5 + i * 2) + " 0 R >>"; objs[5 + i * 2] = "<< /Length " + c.length + " >>\nstream\n" + c + "\nendstream"; }
let liar = "%PDF-1.4\n"; const offs = [];
for (let id = 1; id < objs.length; id++) { offs[id] = liar.length; liar += id + " 0 obj\n" + objs[id] + "\nendobj\n"; }
const xref = liar.length;
liar += "xref\n0 " + objs.length + "\n0000000000 65535 f \n" + offs.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
writeFileSync("liar.pdf", Buffer.from(liar, "latin1"));
const hidden = read({ path: "liar.pdf", pages: "10-12" });
if (!/\(the file says 3, but it has 12\)/.test(hidden.text) || !hidden.text.includes("Page 12") || hidden.pictures.length !== 3) throw new Error("the PDF's own page count was trusted: " + hidden.text.slice(0, 300));
console.log("read ok");
