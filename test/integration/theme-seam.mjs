// DOES A THEME REACH THE DIST? — the one question the response cannot answer.
//
// The font write learned this the expensive way and says so in its own comment:
// a separate stylesheet imported after styles.css produced NOTHING, the build
// reported the right fonts, and the bundle shipped the defaults. A theme has the
// same failure available to it, so this drives a real build and reads the built
// CSS rather than trusting `{applied: true}`.
//
// It caught exactly that on its first run — except the bug was in the TEST: it
// looked for the marker comment (stripped by the minifier, correctly) and for
// `0.975` (rewritten as `97.5%`, also correctly). A harness that reports a
// working seam as broken is as useless as one that reports the reverse, so it
// asserts on the value in both forms and on its POSITION — the theme's must be
// the last `--background`, or the template's wins and the site ships the default
// look while the response says otherwise.
//
// $0: no model call, no Neon project, no container. Two real builds.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { spawn } from "node:child_process";
const ROOT = path.join(import.meta.dirname, "../..");
const TEMPLATE = path.join(ROOT, "builder/lovable/template");
const PORT = 8391;
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "theme-seam-"));
fs.cpSync(TEMPLATE, sandbox, { recursive: true, filter: (s) => !/(^|[\\/])(node_modules|dist)$/.test(s) });
fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(sandbox, "node_modules"), "dir");
fs.mkdirSync(path.join(sandbox, ".routes-base"), { recursive: true });
fs.copyFileSync(path.join(sandbox, "src/routes/__root.tsx"), path.join(sandbox, ".routes-base/__root.tsx"));
fs.copyFileSync(path.join(sandbox, "src/styles.css"), path.join(sandbox, ".styles-base.css"));
const ROUTES = Object.fromEntries(fs.readdirSync(path.join(TEMPLATE, "src/routes"))
  .filter((f) => f.endsWith(".tsx") && f !== "__root.tsx")
  .map((f) => [f, fs.readFileSync(path.join(TEMPLATE, "src/routes", f), "utf8")]));
const srv = spawn("node", [path.join(ROOT, "builder/build-server.mjs")],
  { env: { ...process.env, APP_DIR: sandbox, PORT: String(PORT), NODE_ENV: "production" }, stdio: ["ignore","pipe","pipe"] });
srv.stderr.on("data", d => process.stderr.write("  [b] " + d));
let up=false; for (let i=0;i<60&&!up;i++){ try{ up=(await fetch(`http://127.0.0.1:${PORT}/health`)).ok; }catch{ await new Promise(r=>setTimeout(r,300)); } }
if(!up){ console.log("build server never came up"); process.exit(1); }
// THE 500 ARE TEST DATA NOW (2026-08-20) — the theme registry left the product
// and the container takes an authored palette. They are still the right corpus
// to drive this seam with: real hand-designed colours, and the harness can check
// the paper it sent comes back out of the compiled stylesheet.
const { ALL_THEMES } = await import(path.join(ROOT,"test/fixtures/themes.mjs"));
const { oklchToRgb } = await import(path.join(ROOT,"builder/site-theme.mjs"));
const { seedColor } = await import(path.join(ROOT,"builder/site-seeds.mjs"));
const asHex = ([L,C,H]) => { const [r,g,b] = oklchToRgb(L,C,H);
  return "#" + [r,g,b].map((v) => Math.round(v*255).toString(16).padStart(2,"0")).join(""); };
const seedsOf = (t) => ({ name: "Seam", paper: asHex(t.light.paper), ink: asHex(t.light.ink), accent: asHex(t.light.accent),
  dark: { paper: asHex(t.dark.paper), ink: asHex(t.dark.ink), accent: asHex(t.dark.accent) } });
let pass=0, fail=0;
const ok=(n,c,x)=>{ c?(pass++,console.log("  ok   "+n)):(fail++,console.log("  FAIL "+n+(x?"\n       -> "+String(x).slice(0,300):""))); };
for (const name of ["broadsheet","editorial"]) {
  // EXPECT WHAT WAS SENT, NOT WHAT THE FIXTURE HOLDS. The palette travels as hex
  // now, and a round trip moves L by up to 0.058 — so comparing against the
  // fixture's own OKLCH would fail against a container doing exactly the right
  // thing. `seedColor` is the same reading the container makes.
  const seeds = seedsOf(ALL_THEMES[name]);
  const want = seedColor(seeds.paper);
  const r = await (await fetch(`http://127.0.0.1:${PORT}/build`, { method:"POST", headers:{"content-type":"application/json"},
    body: JSON.stringify({ files: ROUTES, slug: "theme-seam", title: "Seam", seeds }) })).json();
  ok(`${name}: build succeeds`, r.ok===true, r.stage+": "+r.error);
  if(!r.ok) continue;
  // The palette's own NAME comes back, not a registry id — there is no registry.
  ok(`${name}: response reports the palette applied`, r.theme && r.theme.applied===true && r.theme.theme==="Seam", JSON.stringify(r.theme));
  const css = Object.entries(r.files).filter(([f])=>f.endsWith(".css")).map(([,v])=>Buffer.from(v.b||v.t||"", v.b?"base64":"utf8").toString()).join("\n");
  // Asserted on a VALUE, never on the marker comment: the minifier strips
  // comments, and it also rewrites 0.975 as 97.5%. A first draft of this test
  // looked for both literally and reported a working seam as broken.
  const bg = css.match(/--background:\s*oklch\([^)]*\)/g) || [];
  // MIRROR `themeCss`'S OWN EMITTER, which rounds to 4 decimals BEFORE the
  // minifier turns the value into a percentage: 0.976070 is emitted as 0.9761
  // and minified to `97.61%`. Rounding the other way round gives `97.607%` and
  // reports a working seam as broken — which is exactly what this comment two
  // lines up already warns about for the marker comment, one rounding step over.
  const pct = (n) => String(Number((Number(n.toFixed(4)) * 100).toFixed(4)));
  const hit = (v) => bg.filter(s => s.includes(pct(v)) || s.includes(String(v)));
  ok(`${name}: the theme's paper reaches the dist`, hit(want[0]).length > 0, `no ${pct(want[0])}% among ${JSON.stringify(bg)}`);
  // The template declares its own --background further up. Later wins, so the
  // theme's has to be LAST or the site ships the default look while the response
  // says otherwise — the exact failure the font write was built to end.
  const lastLight = bg.length ? bg[bg.length-2] : "";
  ok(`${name}: and it OVERRIDES the template's, not the other way round`,
     lastLight.includes(pct(want[0])) || lastLight.includes(String(want[0])), `last light --background was ${lastLight}`);
}
// AN UNUSABLE PALETTE MUST NOT TAKE THE BUILD DOWN. Was "an unknown theme",
// which meant a name the registry did not hold; the equivalent now is a palette
// that cannot be used — here grey on grey, which every contrast floor refuses.
// A site whose data layer is live and whose pages compiled must not be lost over
// its colours.
const bad = await (await fetch(`http://127.0.0.1:${PORT}/build`, { method:"POST", headers:{"content-type":"application/json"},
  body: JSON.stringify({ files: ROUTES, slug:"theme-seam", title:"Seam",
    seeds: { name:"Fog", paper:"#8a8a8a", ink:"#6f6f6f", accent:"#7a7a90" } }) })).json();
ok("an unusable palette still publishes a site", bad.ok===true, bad.stage+": "+bad.error);
ok("...and says so rather than claiming it applied", bad.theme && bad.theme.applied===false && bad.theme.notes.length>0, JSON.stringify(bad.theme));
// AND THE NOTE NAMES THE REASON. Four different failures reach here — nothing
// sent, an unreadable colour, swapped modes, an illegible palette — and a note
// that says only "kept the default look" is one nobody can act on.
ok("...and the note says WHY", /body text|quiet text|button|paper|colour/i.test(String(bad.theme && bad.theme.notes)), JSON.stringify(bad.theme));
srv.kill("SIGKILL"); fs.rmSync(sandbox,{recursive:true,force:true});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
