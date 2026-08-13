// GROUND TRUTH FOR CHART LABELS — the diagnostic behind `kit-paint`'s note.
//
// `kit-paint` computes a label's background from the ancestor chain, which is
// right for flow content and cannot see what is behind a chart glyph: an SVG
// shape paints with `fill`, has no `background-color`, and is a SIBLING of the
// label. So that file REPORTS chart text rather than asserting it, and this is
// what says whether any given report is real.
//
// IT DIFFS TWO RENDERS, which is the only thing that answers the question
// exactly. Each component is screenshotted twice: once as it is, and once with
// every text element's GLYPHS hidden (`color` and `fill` forced transparent,
// backgrounds untouched). The pixels that CHANGE between the two are precisely
// the glyphs — so the ground behind a label is those same pixels in the hidden
// render, per pixel, with nothing inferred.
//
// A single sample at the centre of the label's box was the first method and is
// WRONG in a way that matters here: a label's box routinely overlaps a mark
// that sits BESIDE its glyphs, so the centre pixel is a bar the text never
// touches. It reported 34 labels unreadable that are painted on the page.
// Verdicts are the MEDIAN over glyph pixels — a stroke clipping something dark
// at one end is not the label being unreadable — with the worst also printed.
//
// COMMITTED BECAUSE THE TRIAGE IS UNREPRODUCIBLE WITHOUT IT. This repo has
// already recorded one boundary that rested on a single uncommitted session
// and drifted into self-contradiction before anybody re-read it. Run it when a
// chart lands in the note and you need to know whether it is a defect:
//
//   node test/integration/chart-ground-truth.mjs [light|dark]
//
// It is a DIAGNOSTIC, not a check — it asserts nothing and gates nothing, and
// deliberately is not wired into any workflow.
//
// What it found on 2026-08-13, over 7,272 labels in light mode: 155 short of
// the bar across 53 components, of which 64 were a background that never
// painted (our synthesised props out of domain — `choropleth` uses its
// `levels` prop AS CSS COLOURS and got "Sample 1659"), ~38 were a label
// sampled on the mark it annotates (`health` draws its markers in `TONE` on a
// polyline stroked in `TONE`), and 53 were real: a heat cell painted on a
// CONTINUOUS `color-mix` ramp under a BINARY ink threshold, whose mid-band no
// fixed ink can clear.
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
import { TEMPLATE, OUT, CANNOT_RENDER, chartEntries, renderAll } from "./kit-harness.mjs";
import { decodePng, pixelAt } from "./png-read.mjs";
const { chromium } = createRequire(path.join(TEMPLATE, "package.json"))("playwright");
const MODE = process.argv[2] === "dark" ? "dark" : "light";

// The same real stylesheet `kit-paint` builds — without it every class is
// inert and the page is black on white.
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "css.js"), 'import "../src/styles.css";\n');
const vite = await import(path.join(TEMPLATE, "node_modules/vite/dist/node/index.js"));
const tailwind = (await import(path.join(TEMPLATE, "node_modules/@tailwindcss/vite/dist/index.mjs"))).default;
await vite.build({ root: TEMPLATE, configFile: false, logLevel: "error", plugins: [tailwind()],
  build: { outDir: path.join(OUT, "css"), emptyOutDir: true, rollupOptions: { input: path.join(OUT, "css.js") } } });
const css = fs.readFileSync(path.join(OUT, "css/assets",
  fs.readdirSync(path.join(OUT, "css/assets")).find((f) => f.endsWith(".css"))), "utf8");

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const rels = ["chrome-linux/chrome", "chrome-linux64/chrome",
    "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"];
  const found = [];
  try {
    for (const dir of fs.readdirSync(root)) for (const rel of rels) {
      const p = path.join(root, dir, rel);
      if (fs.existsSync(p)) found.push(p);
    }
  } catch { /* fall through to playwright's own lookup */ }
  found.sort((a, b) => Number(/headless/.test(a)) - Number(/headless/.test(b)));
  return found[0] || null;
}

const rendered = renderAll("full", chartEntries.filter(e=>!e.truncated)).filter(r=>r.html && !CANNOT_RENDER[r.k]);
const exe = findChromium();
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await b.newPage({ viewport:{width:1100,height:1600}, deviceScaleFactor:1 });
await page.setContent(`<!doctype html><html class="${MODE==="dark"?"dark":""}"><head><style>${css}</style></head>
  <body class="bg-background text-foreground" style="margin:0"><div id="host" style="padding:12px"></div></body></html>`,{waitUntil:"domcontentloaded"});


const findings=[]; let measured=0, offscreen=0, noGlyphs=0;

const lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
const ratio=(a,z)=>{const[x,y]=[lum(a),lum(z)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};

const COLLECT = (h) => {
  const host=document.getElementById("host"); host.innerHTML=h;
  const cvs=document.createElement("canvas");cvs.width=cvs.height=1;
  const ctx=cvs.getContext("2d",{willReadFrequently:true});
  const parse=(c)=>{if(!c||c==="transparent"||c==="none")return null;ctx.fillStyle="#000";ctx.fillStyle=c;
    ctx.clearRect(0,0,1,1);ctx.fillRect(0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;
    return d[3]===0?null:{r:d[0],g:d[1],b:d[2],a:d[3]/255};};
  const out=[]; window.__texts=[];
  for (const el of host.querySelectorAll("*")) {
    const t=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim();
    if(!t) continue;
    const cs=getComputedStyle(el);
    if(cs.visibility==="hidden"||cs.display==="none"||Number(cs.opacity)===0) continue;
    let dec=false; for(let n=el;n&&n!==host;n=n.parentElement){
      if(n.hasAttribute("disabled")||n.getAttribute("aria-disabled")==="true"){dec=true;break;}
      if(n.getAttribute("aria-hidden")==="true"&&getComputedStyle(n).pointerEvents==="none"){dec=true;break;}}
    if(dec) continue;
    const r=el.getBoundingClientRect(); if(r.width<=1||r.height<=1) continue;
    const ink=parse(el.closest("svg")?cs.fill:cs.color); if(!ink||ink.a<0.999) continue;
    const px=parseFloat(cs.fontSize), bold=Number(cs.fontWeight)>=700;
    out.push({x:Math.floor(r.left), y:Math.floor(r.top), w:Math.ceil(r.width), h:Math.ceil(r.height),
      ink, need: px>=24||(bold&&px>=18.66)?3:4.5, text:t.slice(0,26)});
    window.__texts.push(el);
  }
  const hb=host.getBoundingClientRect();
  return {spots:out, height: Math.ceil(hb.bottom)};
};
const HIDE = () => { for (const el of window.__texts||[]) {
  el.style.setProperty("color","transparent","important");
  el.style.setProperty("fill","transparent","important"); } };

for (const { k, html } of rendered) {
  const { spots, height } = await page.evaluate(COLLECT, html);
  if(!spots.length) continue;
  const H = Math.min(1600, Math.max(1, height));
  const clip = {x:0, y:0, width:1100, height:H};
  const before = decodePng(await page.screenshot({clip}));
  await page.evaluate(HIDE);
  const after = decodePng(await page.screenshot({clip}));

  for (const s of spots) {
    if (s.y >= H-1) { offscreen++; continue; }
    // The glyph pixels: where hiding the text changed the render.
    const grounds=[];
    for (let y=Math.max(0,s.y); y<Math.min(H, s.y+s.h); y++) {
      for (let x=Math.max(0,s.x); x<Math.min(1100, s.x+s.w); x++) {
        const a=pixelAt(before,x,y), b=pixelAt(after,x,y);
        const d=Math.abs(a.r-b.r)+Math.abs(a.g-b.g)+Math.abs(a.b-b.b);
        // Only pixels the glyph substantially covers. Antialiased edges blend
        // ink with ground and would report a contrast neither colour has.
        if (d>=60) grounds.push({b, d});
      }
    }
    if (!grounds.length) { noGlyphs++; continue; }
    measured++;
    grounds.sort((p,q)=>q.d-p.d);
    const solid = grounds.slice(0, Math.max(1, Math.round(grounds.length*0.5)));
    const rs = solid.map(g=>ratio(s.ink,g.b)).sort((p,q)=>p-q);
    const med = rs[Math.floor(rs.length/2)], min = rs[0];
    if (med < s.need) findings.push({k, got:med, min, need:s.need,
      ink:`rgb(${s.ink.r},${s.ink.g},${s.ink.b})`,
      bg:`rgb(${solid[Math.floor(solid.length/2)].b.r},${solid[Math.floor(solid.length/2)].b.g},${solid[Math.floor(solid.length/2)].b.b})`,
      text:s.text});
  }
}
findings.sort((a,z)=>a.got-z.got);
console.log(`\n== ${MODE}: diffed two renders over ${measured} chart labels (${offscreen} off-screen, ${noGlyphs} no glyph pixels)`);
console.log(`   ${findings.length} fail on the pixels their glyphs actually cover, across ${new Set(findings.map(f=>f.k)).size} components\n`);
// A label whose ink EQUALS its ground had no background painted at all — our
// synthesised props out of domain (`choropleth` uses its `levels` prop as CSS
// colours and got "Sample 1659"). Separated, because it is our fault and not
// the chart's, and mixing the two hides the real ones.
const unpainted=findings.filter(f=>f.got<1.02);
const real=findings.filter(f=>f.got>=1.02);
console.log(`   of those, ${unpainted.length} had NO background painted (our props, not the chart): ${[...new Set(unpainted.map(f=>f.k.split(".")[0]))].join(", ")}`);
console.log(`   leaving ${real.length} real, across ${new Set(real.map(f=>f.k)).size} components\n`);
const byInk={}; for(const f of real)(byInk[f.ink]??=[]).push(f);
for(const [ink,list] of Object.entries(byInk).sort((a,z)=>z[1].length-a[1].length))
  console.log(`   ${String(list.length).padStart(3)}  ink ${ink}   ${[...new Set(list.map(x=>x.k.split(".")[0]))].slice(0,9).join(", ")}`);
console.log("");
for(const f of real.slice(0,26))
  console.log(`   ${f.got.toFixed(2)}:1 (worst px ${f.min.toFixed(2)}, needs ${f.need})  ${f.k}  ink ${f.ink} on ${f.bg}  "${f.text}"`);
await b.close();
fs.rmSync(OUT, { recursive: true, force: true });
