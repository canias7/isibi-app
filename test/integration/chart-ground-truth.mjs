// GROUND TRUTH FOR CHART LABELS — the diagnostic behind `kit-paint`'s note.
//
// `kit-paint` computes a label's background from the ancestor chain, which is
// right for flow content and cannot see what is behind a chart glyph: an SVG
// shape paints with `fill`, has no `background-color`, and is a SIBLING of the
// label. So that file REPORTS chart text rather than asserting it, and this is
// what says whether any given report is real.
//
// It reads the pixel the browser actually painted. Every text element has only
// its GLYPHS hidden — `color` and `fill` forced transparent, backgrounds left
// alone — then one screenshot per component, and the pixel at each label's
// centre is the true composited ground beneath it, whatever drew it.
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

const lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
const ratio=(a,z)=>{const[x,y]=[lum(a),lum(z)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};

const findings=[]; let measured=0, offscreen=0;
for (const { k, html } of rendered) {
  const spots = await page.evaluate((h) => {
    const host=document.getElementById("host"); host.innerHTML=h;
    const cvs=document.createElement("canvas");cvs.width=cvs.height=1;
    const ctx=cvs.getContext("2d",{willReadFrequently:true});
    const parse=(c)=>{if(!c||c==="transparent"||c==="none")return null;ctx.fillStyle="#000";ctx.fillStyle=c;
      ctx.clearRect(0,0,1,1);ctx.fillRect(0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;
      return d[3]===0?null:{r:d[0],g:d[1],b:d[2],a:d[3]/255};};
    const out=[]; const els=[];
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
      const ink=parse(el.closest("svg")?cs.fill:cs.color); if(!ink) continue;
      const px=parseFloat(cs.fontSize), bold=Number(cs.fontWeight)>=700;
      out.push({x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height,
        ink, need: px>=24||(bold&&px>=18.66)?3:4.5, text:t.slice(0,26)});
      els.push(el);
    }
    // Hide only the GLYPHS. Backgrounds — including each element's own — stay,
    // so the pixel under a label is exactly what was painted behind it.
    for (const el of els){ el.style.setProperty("color","transparent","important");
                           el.style.setProperty("fill","transparent","important"); }
    const hb=host.getBoundingClientRect();
    return {spots:out, host:{x:hb.left,y:hb.top,w:Math.max(1,hb.width),h:Math.max(1,hb.height)}};
  }, html);
  if(!spots.spots.length) continue;
  const clipH=Math.min(spots.host.h, 1600-spots.host.y);
  if(clipH<=1){offscreen+=spots.spots.length;continue;}
  const img=decodePng(await page.screenshot({clip:{x:0,y:0,width:1100,height:Math.ceil(Math.min(1600,spots.host.y+clipH))}}));
  for(const s of spots.spots){
    if(s.y>=img.h-1||s.x>=img.w-1){offscreen++;continue;}
    measured++;
    const bg=pixelAt(img,s.x,s.y);
    const on=s.ink.a<1?{r:s.ink.r*s.ink.a+bg.r*(1-s.ink.a),g:s.ink.g*s.ink.a+bg.g*(1-s.ink.a),b:s.ink.b*s.ink.a+bg.b*(1-s.ink.a)}:s.ink;
    const got=ratio(on,bg);
    if(got<s.need) findings.push({k, got, need:s.need, ink:`rgb(${s.ink.r|0},${s.ink.g|0},${s.ink.b|0})`, bg:`rgb(${bg.r},${bg.g},${bg.b})`, text:s.text});
  }
}
findings.sort((a,z)=>a.got-z.got);
console.log(`\n== ${MODE}: sampled real pixels under ${measured} chart labels (${offscreen} off-screen, skipped)`);
console.log(`   ${findings.length} genuinely fail, across ${new Set(findings.map(f=>f.k)).size} components\n`);
const identical=findings.filter(f=>f.ink===f.bg);
const partial=findings.filter(f=>f.ink!==f.bg);
console.log(`   ink EXACTLY equals the painted ground: ${identical.length} (across ${new Set(identical.map(f=>f.k)).size} components)`);
console.log(`      -> the fingerprint of a background that did not paint at all\n`);
console.log(`   genuine partial shortfalls: ${partial.length} (across ${new Set(partial.map(f=>f.k)).size} components)\n`);
const band=findings.filter(f=>f.got>=2.2);
console.log(`   PLAUSIBLE-REAL BAND (>=2.2:1 — too much contrast to be ink-on-its-own-mark): ${band.length} across ${new Set(band.map(f=>f.k)).size} components`);
const byInk={}; for(const f of band)(byInk[f.ink]??=[]).push(f);
for(const [ink,list] of Object.entries(byInk).sort((a,z)=>z[1].length-a[1].length))
  console.log(`      ${String(list.length).padStart(3)}  ink ${ink}   ${[...new Set(list.map(x=>x.k.split(".")[0]))].slice(0,9).join(", ")}`);
console.log("");
for(const f of [].slice(0,0)) console.log(`      ${f.got.toFixed(2)}:1 (needs ${f.need})  ${f.k.split(".")[0]}  ink ${f.ink} on ${f.bg}  "${f.text}"`);
console.log("");
for(const f of [].slice(0,0)) console.log(`   ${f.got.toFixed(2)}:1 (needs ${f.need})  ${f.k.split(".")[0]}  ink ${f.ink} on ${f.bg}  "${f.text}"`);
await b.close();
fs.rmSync(OUT, { recursive: true, force: true });
