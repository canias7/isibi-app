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
// A NAME ON THE WIRE AGAIN (2026-08-27, owner's call). This posted `seeds` for
// the 2026-08-20 → 2026-08-27 era; the registry is back in the product, the
// payload field is `theme`, and the container resolves the name itself — so the
// expected paper is the FIXTURE THEME'S OWN OKLCH value, with no hex round trip
// to tolerate: what the registry holds is what `themeCss` renders.
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
const { ALL_THEMES } = await import(path.join(ROOT,"test/fixtures/themes.mjs"));
let pass=0, fail=0;
const ok=(n,c,x)=>{ c?(pass++,console.log("  ok   "+n)):(fail++,console.log("  FAIL "+n+(x?"\n       -> "+String(x).slice(0,300):""))); };
for (const name of ["broadsheet","editorial"]) {
  // EXPECT THE REGISTRY'S OWN VALUE. `themeCss` emits the theme's light paper
  // as `--background`; the minifier rewrites `0.975` as `97.5%`, so the value
  // is matched in both spellings — the trap this harness's own header records.
  const want = ALL_THEMES[name].light.paper[0];
  const r = await (await fetch(`http://127.0.0.1:${PORT}/build`, { method:"POST", headers:{"content-type":"application/json"},
    body: JSON.stringify({ files: ROUTES, slug: "theme-seam", title: "Seam", theme: name }) })).json();
  ok(`${name}: build succeeds`, r.ok===true, r.stage+": "+r.error);
  if(!r.ok) continue;
  // The registry ID comes back — it is what the Worker sent and what a reply
  // can say out loud; the label is a designer's one-liner, not an address.
  ok(`${name}: response reports the theme applied, by id`, r.theme && r.theme.applied===true && r.theme.theme===name, JSON.stringify(r.theme));
  const css = Object.entries(r.files).filter(([f])=>f.endsWith(".css")).map(([,v])=>Buffer.from(v.b||v.t||"", v.b?"base64":"utf8").toString()).join("\n");
  const bg = css.match(/--background:\s*oklch\([^)]*\)/g) || [];
  // MIRROR `themeCss`'S OWN EMITTER, which rounds to 4 decimals BEFORE the
  // minifier turns the value into a percentage: 0.976070 is emitted as 0.9761
  // and minified to `97.61%`. Rounding the other way round gives `97.607%` and
  // reports a working seam as broken.
  const pct = (n) => String(Number((Number(n.toFixed(4)) * 100).toFixed(4)));
  const hit = (v) => bg.filter(s => s.includes(pct(v)) || s.includes(String(v)));
  ok(`${name}: the theme's paper reaches the dist`, hit(want).length > 0, `no ${pct(want)}% among ${JSON.stringify(bg)}`);
  // The template declares its own --background further up. Later wins, so the
  // theme's has to be LAST or the site ships the default look while the response
  // says otherwise — the exact failure the font write was built to end.
  const lastLight = bg.length ? bg[bg.length-2] : "";
  ok(`${name}: and it OVERRIDES the template's, not the other way round`,
     lastLight.includes(pct(want)) || lastLight.includes(String(want)), `last light --background was ${lastLight}`);
}
// AN UNKNOWN NAME MUST NOT TAKE THE BUILD DOWN. The registry era's original
// case, back verbatim: the Worker validates through `FIELD_KEEPS.theme` before
// storing, so a name reaching here that the registry refuses is version skew or
// a hand-written payload — and a site whose data layer is live and whose pages
// compiled must not be lost over decoration either way.
const bad = await (await fetch(`http://127.0.0.1:${PORT}/build`, { method:"POST", headers:{"content-type":"application/json"},
  body: JSON.stringify({ files: ROUTES, slug:"theme-seam", title:"Seam", theme: "zzz-nonesuch" }) })).json();
ok("an unknown theme still publishes a site", bad.ok===true, bad.stage+": "+bad.error);
ok("...and says so rather than claiming it applied", bad.theme && bad.theme.applied===false && bad.theme.notes.length>0, JSON.stringify(bad.theme));
// AND THE NOTE NAMES THE NAME — "kept the default look" alone is a note nobody
// can act on; which name failed to resolve is the one fact that separates a
// typo from version skew.
ok("...and the note says WHICH name", /zzz-nonesuch/.test(String(bad.theme && bad.theme.notes)), JSON.stringify(bad.theme));
srv.kill("SIGKILL"); fs.rmSync(sandbox,{recursive:true,force:true});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);