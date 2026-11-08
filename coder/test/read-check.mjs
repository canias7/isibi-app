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

if (!/^Picture: shot\.png \(1600×800, PNG, /.test(read({ path: "shot.png" }).text)) throw new Error("the screenshot was not made smaller");
read({ path: "anim.gif" });
const pdf = read({ path: "doc.pdf" });
if (!pdf.text.includes("--- Page 1 (picture 1) ---\npdf text ok") || !pdf.text.includes("--- Page 2 (picture 2; no text) ---") || pdf.pictures.length !== 2) throw new Error("the PDF's pages (each a picture too): " + pdf.text);
read({ path: "nb.ipynb" });
console.log("read ok");
