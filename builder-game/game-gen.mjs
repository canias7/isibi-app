// Phase 2 — kaplay game generation contract + parser + genre routing.
//
// Mirrors ../builder/react-gen.mjs (the app builder) with the engine swapped for
// kaplay. Sonnet emits a whole Vite/kaplay PROJECT as `===FILE: <path>===` blocks;
// the parser turns that into { "<path>": "<src>" } for the game build-service.
//
// The build-service only allows writes to index.html / vite.config.js / src/**,
// and kaplay is the ONLY pre-baked dep, so the model MUST stay inside that shape.

// Same delimiter parser as the app builder (format is identical).
export function parseGeneratedFiles(text) {
  const files = {};
  const s = String(text || "");
  const parts = s.split(/^===FILE:\s*(.+?)\s*===[ \t]*$/gm);
  for (let i = 1; i < parts.length; i += 2) {
    const rawPath = (parts[i] || "").trim();
    let body = parts[i + 1] || "";
    body = body.replace(/^\r?\n/, "").replace(/\s+$/, "");
    body = body.replace(/^```[a-zA-Z]*\r?\n/, "").replace(/\r?\n```$/, "");
    if (rawPath) files[rawPath] = body;
  }
  return files;
}

// The ONLY importable package (must match builder-game/package.json).
export const GAME_DEPS = ["kaplay"];

// Bounded genre set — each maps to a scaffold skeleton Sonnet fills in. Restricting
// to well-understood shapes is the single biggest lever on "the AI produced a
// playable game" (vs. "any game from scratch", which fails far more often).
export const GENRES = ["runner", "flappy", "platformer", "topdown", "breakout"];

// Cheap keyword router so the composer/Studio can infer the genre from the prompt.
export function pickGenre(prompt) {
  const p = String(prompt || "").toLowerCase();
  if (/\bflappy|flap|tap to fly|pipes?\b/.test(p)) return "flappy";
  if (/\bbreakout|brick|paddle|arkanoid\b/.test(p)) return "breakout";
  if (/\btop.?down|shooter|twin.?stick|arena|maze\b/.test(p)) return "topdown";
  if (/\bplatformer|jump|mario|metroid|coins?\b/.test(p)) return "platformer";
  if (/\brunner|endless|dash|obstacle|dodge\b/.test(p)) return "runner";
  return "runner"; // safest default: one-button, hardest to get wrong
}

// The generation contract. Kept terse + imperative — kaplay's concise API is the
// point (fewer tokens, fewer ways for the model to go wrong).
export const GAME_RULES =
  "You are isibi's GAME builder. Emit a COMPLETE, RUNNABLE Vite + kaplay game as file blocks, each starting with a line `===FILE: <relative/path>===` then the file's raw contents IN FULL (never a diff). Output ONLY file blocks — NO prose, NO markdown fences. " +
  "ENGINE: import ONLY `kaplay` (`import kaplay from \"kaplay\"`). NO other npm packages, NO CDN <script> tags, NO external art/audio URLs, NO fetch/network. kaplay is the entire toolkit (rendering, input, physics via body()/area(), audio, scenes, tween, particles). " +
  "PROJECT SHAPE (write ONLY these paths): `src/main.js` (REQUIRED entry) and any number of `src/*.js` modules. Do NOT write index.html or vite.config.js — the platform provides them (a #game <canvas> and the bundler). " +
  "MODULE PATTERN (follow EXACTLY — this avoids the #1 crash): `src/main.js` initialises kaplay ONCE and passes the context around. It MUST look like: `import kaplay from \"kaplay\"; const k = kaplay({ width: 960, height: 540, letterbox: true, background: [12,8,24], canvas: document.querySelector(\"#game\"), global: false });` then import setup functions from your other modules and CALL them with `k`, then `k.go(\"<firstScene>\")`. Every other module MUST export a function that TAKES `k` and registers a scene, e.g. `export function gameScene(k){ k.scene(\"game\", () => { /* ... */ }) }`. NEVER call kaplay API at a module's top level and NEVER rely on globals — always go through the passed `k`. " +
  "GAMEPLAY: it must be genuinely playable and complete — a real loop with win/lose or score, on-screen HUD (score/lives), and a restart path (a `k.scene(\"gameover\", ...)` that `k.go`es back to the game on a keypress). Handle BOTH keyboard (`k.onKeyPress`, `k.onKeyDown` — arrows/WASD/space) AND pointer (`k.onClick` / `k.onMousePress`) so it works on desktop and touch. Use a FIXED logical size 960×540 (kaplay letterboxes to fit). " +
  "SOUND: a built-in 8-bit SFX kit ships with every build (do NOT generate audio). Load the ones you need in `src/main.js` with `k.loadSound(\"<name>\", \"sfx/<name>.wav\")` and trigger them with `k.play(\"<name>\", { volume: 0.5 })`. Available names: jump, coin, hit, shoot, explode, powerup, blip. Wire them to the obvious moments (jump→jump, pickup→coin/powerup, collision/death→hit/explode, firing→shoot, UI→blip) so the game feels alive. Keep volume ≤ 0.6, and never play a sound every single frame. " +
  "ART: use PRIMITIVE/vector art only — kaplay shape components `k.rect(w,h)`, `k.circle(r)`, `k.polygon()`, `k.text()`, with `k.color()`, `k.outline()`, and `k.pos()/k.anchor()`. Do NOT load image files. Lean into a clean neon look (pink #ff79c6 / amber #ffb84d on near-black) to match the brand. " +
  "ROBUSTNESS: guard every `get()`/collision handler against destroyed objects, clamp the player inside bounds, and make sure the FIRST FRAME already renders something (add the scene's core objects in the scene body, not after a timer). No dead controls, no TODO stubs. Keep the whole game focused and under ~600 lines total.";

// Phase 6 — asset (sprite) mode. Same contract as GAME_RULES but the main visual
// entities use AI-GENERATED sprites via @@SPRITE:<prompt>@@ tokens instead of
// primitive shapes. The platform generates each sprite (image model → chroma-key
// cutout → transparent PNG), bundles it into the build, and swaps the token for
// its relative path; the game loads it with k.loadSprite + the k.sprite() component.
export const GAME_ASSET_RULES = GAME_RULES.replace(
  "ART: use PRIMITIVE/vector art only — kaplay shape components `k.rect(w,h)`, `k.circle(r)`, `k.polygon()`, `k.text()`, with `k.color()`, `k.outline()`, and `k.pos()/k.anchor()`. Do NOT load image files. Lean into a clean neon look (pink #ff79c6 / amber #ffb84d on near-black) to match the brand. ",
  "ART: use AI-GENERATED SPRITES for the main visual entities (player, enemies, collectibles, obstacles). In `src/main.js`, load each with `k.loadSprite(\"<name>\", \"@@SPRITE: <short vivid description>@@\")` — the `@@SPRITE:...@@` token becomes a real transparent-background image the platform generates and bundles. Then use the `k.sprite(\"<name>\")` component on that object (add `k.anchor(\"center\")` and `k.scale()` to size it; the art arrives centered on transparency). Use AT MOST 5 sprites; keep each prompt SHORT + concrete (\"a cute round robot\", \"a jagged glowing asteroid\", \"a neon coin\"). Load ALL sprites in main.js BEFORE calling the scene setups. Still use primitive shapes (`k.rect`/`k.text`) for the ground/platforms, HUD (score/lives), and simple particles. Keep the near-black neon backdrop. "
);

// Sprite tokens the platform must resolve before building (mirrors @@IMG@@).
export function parseSpriteTokens(files) {
  const tokens = new Map(); // token → prompt
  for (const src of Object.values(files || {})) {
    const rr = /@@SPRITE:([\s\S]*?)@@/g; let m;
    while ((m = rr.exec(String(src)))) { if (!tokens.has(m[0])) tokens.set(m[0], m[1].trim().slice(0, 300)); }
  }
  return tokens;
}

// Revise contract (change requests from the Studio composer). Same guardrails.
export const GAME_REVISE_RULES =
  "Apply the requested change to the existing kaplay game and return the FULL updated file blocks (same `===FILE: <path>===` format, raw contents in full, only the files you change). Stay inside the same rules: import ONLY kaplay, the pass-`k`-around module pattern (never top-level engine calls / globals), primitive art only, keyboard + pointer input, a working restart, first frame renders. Output ONLY file blocks — NO prose, NO fences.";

// Fix contract for the Phase-4 auto-fix loop — fed the runtime smoke-test errors.
export function gameFixRules(errors) {
  return (
    "The build compiled but the RUNTIME SMOKE TEST failed. Fix ONLY what these errors indicate and return the FULL corrected file blocks (`===FILE: <path>===`, raw contents in full, only changed files). Do NOT restyle or add features. Common causes: calling a kaplay function before `k` exists (top-level engine call — move it into a scene and use the passed `k`), a null from `k.get()` used without a guard, an undefined component, or nothing drawn on frame 1. Keep import ONLY kaplay, the pass-`k` module pattern, primitive art. Output ONLY file blocks.\n\nSMOKE ERRORS:\n" +
    (Array.isArray(errors) ? errors : [String(errors)]).map((e) => "- " + e).join("\n") +
    (errors && errors.blank ? "\n- canvas rendered nothing (blank) — ensure the first scene adds visible objects immediately" : "")
  );
}

// ── Phase 7 — 3D engine (Babylon.js) ────────────────────────────────────────
// Opt-in "3D" mode: instead of kaplay (2D canvas), the game is a Babylon.js WebGL
// scene — a real first-person/third-person 3D game. Babylon is pre-baked in the
// container; the model MUST import from the specific tree-shaken paths below (an
// `import * as BABYLON` pulls a 4.9MB bundle — the per-module paths keep it ~1.6MB).
export const GAME_3D_RULES =
  "You are isibi's 3D GAME builder. Emit a COMPLETE, RUNNABLE Vite + Babylon.js game as file blocks, each starting with a line `===FILE: <relative/path>===` then the file's raw contents IN FULL. Output ONLY file blocks — NO prose, NO markdown fences. " +
  "ENGINE: Babylon.js (WebGL). Import ONLY from `@babylonjs/core` USING THE EXACT PER-MODULE PATHS below — NEVER `import * as BABYLON from \"@babylonjs/core\"` (that bloats the bundle 3×). Import ONLY what you use, from this allowlist:\n" +
  "  import { Engine } from \"@babylonjs/core/Engines/engine.js\";\n" +
  "  import { WebGPUEngine } from \"@babylonjs/core/Engines/webgpuEngine.js\";\n" +
  "  import { Scene } from \"@babylonjs/core/scene.js\";\n" +
  "  import { UniversalCamera } from \"@babylonjs/core/Cameras/universalCamera.js\";\n" +
  "  import { HemisphericLight } from \"@babylonjs/core/Lights/hemisphericLight.js\";\n" +
  "  import { DirectionalLight } from \"@babylonjs/core/Lights/directionalLight.js\";\n" +
  "  import { MeshBuilder } from \"@babylonjs/core/Meshes/meshBuilder.js\";\n" +
  "  import { StandardMaterial } from \"@babylonjs/core/Materials/standardMaterial.js\";\n" +
  "  import { Color3, Color4 } from \"@babylonjs/core/Maths/math.color.js\";\n" +
  "  import { Vector3 } from \"@babylonjs/core/Maths/math.vector.js\";\n" +
  "  import { Ray } from \"@babylonjs/core/Culling/ray.js\";\n" +
  "  // RENDERING (add these — the post pipeline below is REQUIRED, see RENDERING):\n" +
  "  import { ShadowGenerator } from \"@babylonjs/core/Lights/Shadows/shadowGenerator.js\";\n" +
  "  import { DefaultRenderingPipeline } from \"@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js\";\n" +
  "  import \"@babylonjs/core/Rendering/depthRendererSceneComponent.js\";\n" +
  "  // OPTIONAL — ONLY if you load a 3D model from the asset pack (see ASSETS):\n" +
  "  import { SceneLoader } from \"@babylonjs/core/Loading/sceneLoader.js\";\n" +
  "  import \"@babylonjs/loaders/glTF/2.0/glTFLoader.js\";\n" +
  "NO other npm packages, NO CDN, NO external model/texture/audio URLs, NO fetch. Build the world from Babylon primitives (MeshBuilder.CreateBox/Sphere/Ground/Cylinder) + StandardMaterial colours, OPTIONALLY dropping in a ready 3D model or two from the ASSETS pack for the hero characters. " +
  "PROJECT SHAPE (write ONLY these paths): `src/main.js` (REQUIRED entry) and any number of `src/*.js` modules. Do NOT write index.html or vite.config.js — the platform provides a #game <canvas> and the bundler. " +
  "MODULE PATTERN (follow EXACTLY): `src/main.js` gets the canvas `const canvas = document.getElementById(\"game\")`, then creates the engine using WebGPU when available with a WebGL fallback (COPY THIS EXACT block — the top-level `await` is fine, the build target is esnext): `let engine; try { if (await WebGPUEngine.IsSupportedAsync) { engine = new WebGPUEngine(canvas, { antialias: true }); await engine.initAsync(); } else { engine = new Engine(canvas, true); } } catch (e) { engine = new Engine(canvas, true); }` — the try/catch MUST wrap it so a browser that reports WebGPU but fails to init still falls back to WebGL instead of crashing. Then `const scene = new Scene(engine)`, build the world, then `engine.runRenderLoop(() => scene.render())` and `window.addEventListener(\"resize\", () => engine.resize())`. Other modules export functions that TAKE `scene` (and helpers) and build part of the world. " +
  "FIRST-PERSON CONTROLS: use a UniversalCamera at eye height. Enable WASD + arrows: `cam.keysUp=[87,38]; cam.keysDown=[83,40]; cam.keysLeft=[65,37]; cam.keysRight=[68,39];`. `cam.attachControl(canvas, true)`. Mouse-look via pointer lock: on canvas click call `canvas.requestPointerLock?.()`. Give the player collisions + gravity: `scene.collisionsEnabled = true; scene.gravity = new Vector3(0,-0.4,0); cam.checkCollisions = true; cam.applyGravity = true; cam.ellipsoid = new Vector3(0.6,0.9,0.6);` and set `checkCollisions = true` on the ground and every wall so you can't walk through them or fall off. " +
  "GAMEPLAY: a real loop with win/lose + score, e.g. a wave shooter — enemies (boxes/spheres tagged `mesh.metadata = { enemy: true, hp: 1 }`) that move toward the player each frame in `scene.onBeforeRenderObservable.add(() => { ... })`. SHOOTING: on pointer-down while pointer-locked, `const ray = cam.getForwardRay(120); const hit = scene.pickWithRay(ray, m => m.isPickable && m.metadata && m.metadata.enemy); if (hit && hit.pickedMesh) { hit.pickedMesh.dispose(); score++; }`. CRITICAL: if you use getForwardRay / pickWithRay / any ray at all, you MUST include the line `import { Ray } from \"@babylonjs/core/Culling/ray.js\";` from the allowlist — Babylon's picking is a side-effect of that module, and WITHOUT it the game throws \"Ray needs to be imported\" the instant the player fires (tree-shaking drops it otherwise). Also set `mesh.isPickable = true` on every enemy. Damage the player when an enemy reaches them; at 0 HP show a game-over overlay and allow restart. Guard EVERY frame against disposed meshes (`if (m.isDisposed()) return;`). " +
  "HUD + OVERLAYS: use plain DOM, not Babylon GUI. In main.js create absolutely-positioned <div>s over the canvas for score/health and the crosshair, and a hidden game-over <div> with a restart button (restart by reloading state or `location.reload()`). Style them inline (position:fixed; color:#fff; font-family:system-ui). A tiny centre crosshair helps aiming. " +
  "ASSETS — USE A REAL MODEL FOR CHARACTERS (this is the single biggest quality win, do NOT skip it): a pack of ready rigged 3D models ships with the build. If your game has ANY character — the player's on-screen body OR enemies/creatures — you MUST load a model for them instead of a bare box; box enemies look unfinished. Add the two OPTIONAL imports above and load it: `const res = await SceneLoader.ImportMeshAsync(\"\", \"models/\", \"robot.glb\", scene); const root = res.meshes[0]; root.scaling.setAll(0.5); root.position = new Vector3(x, 0, z);` (RobotExpressive stands ~1.8 units tall — scale to taste). AVAILABLE MODELS (pick by theme): `soldier.glb` — a rigged HUMAN character (a real person — use this for people/soldiers/humans/NPCs, the player's human body, or human enemies; it stands ~human height already, ~1.8 units); `robot.glb` — a rigged humanoid robot (use for robots/mechs/sci-fi enemies). Prefer the HUMAN `soldier.glb` whenever the game is about people. Use the model for the PLAYER body and, instantiated + tinted + scaled, for the ENEMIES that chase the player. To make an enemy pickable for shooting, set `mesh.isPickable = true` and `mesh.metadata = { enemy: true }` on the loaded ROOT (and rely on descendant picking) or on a small invisible box you parent to it. Reference a model ONLY by a `models/<name>.glb` path from this list (unknown names 404). Models load ASYNC — build the primitive arena + lights FIRST so frame 1 renders, then add the models when the promise resolves; guard the `.then()` so a load failure falls back to a primitive and never crashes. Use primitives for the ground, walls, projectiles, pickups, and HUD. Only fall back to a box for a character if NO available model fits the theme. " +
  "ANIMATIONS (the models are RIGGED — a walking/attacking enemy beats a sliding statue, so animate them): each model ships with named animation clips (use the EXACT names for that model). soldier.glb (human) has: Idle, Walk, Run, TPose (never play TPose — it's the bind pose). robot.glb has: Idle, Walking, Running, Jump, WalkJump, Punch, Death, Wave, Yes, No, ThumbsUp, Sitting, Standing, Dance. Match clips to the model you loaded — e.g. a chasing HUMAN plays `Run`/`Walk` (not `Running`), a chasing ROBOT plays `Running`. If a clip you want isn't in the list for that model, use the closest one (a human has no Death/Punch — just stop the clip and dispose on kill, or shrink/fade the mesh). " +
  "ONE animated model (e.g. the player avatar): `const res = await SceneLoader.ImportMeshAsync(\"\", \"models/\", \"robot.glb\", scene); res.animationGroups.forEach(a => a.stop()); res.animationGroups.find(a => a.name === \"Idle\").play(true);`. " +
  "MANY independently-animated enemies — DON'T clone the mesh (skinned clones don't animate right); instead load an AssetContainer ONCE and instantiate per enemy: `const container = await SceneLoader.LoadAssetContainerAsync(\"models/\", \"robot.glb\", scene);` then for each enemy `const inst = container.instantiateModelsToScene(n => n + enemyId, false); const root = inst.rootNodes[0]; root.position = ...; inst.animationGroups.forEach(a => a.stop()); (inst.animationGroups.find(a => a.name === \"Running\") || inst.animationGroups[0]).play(true);` — each instance has its OWN `rootNodes` + `animationGroups`. IMPORTANT: `await` the container load ONCE at startup BEFORE you spawn the first enemy (show a brief 'Loading…' overlay while it loads) so every enemy is the real animated model from the very first spawn — do NOT spawn box-placeholder enemies that pop in and get replaced (that looks broken). Keep a primitive fallback ONLY for the case the load genuinely throws. " +
  "DRIVE the clips from gameplay: play `Running` (or `Walking`) while an enemy chases the player, switch to `Punch` when it's in attack range, and play `Death` ONCE (`.play(false)`) then dispose the instance when it's killed. Turn a chasing enemy to face the player each frame (`root.lookAt(playerPos)` or set `root.rotation.y = Math.atan2(dx, dz)`). Keep animations cheap — don't restart a clip that's already playing every frame. " +
  "RENDERING — ALWAYS add this post-processing pipeline + shadows (REQUIRED; it is the single biggest thing separating a flat tech-demo from a game that looks premium — never skip it). After creating the camera, add: `const pipe = new DefaultRenderingPipeline(\"fx\", true, scene, [cam]); pipe.bloomEnabled = true; pipe.bloomThreshold = 0.15; pipe.bloomWeight = 0.8; pipe.bloomKernel = 80; pipe.fxaaEnabled = true; pipe.imageProcessingEnabled = true; pipe.imageProcessing.toneMappingEnabled = true; pipe.imageProcessing.contrast = 1.25; pipe.imageProcessing.exposure = 1.1; pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 2.5; pipe.grainEnabled = true; pipe.grain.intensity = 6; pipe.chromaticAberrationEnabled = true; pipe.chromaticAberration.aberrationAmount = 10;`. Give neon materials a STRONG `emissiveColor` (near full brightness on the accent colour) so bloom makes them GLOW — that glow is the signature look. LIGHTING: keep ONE HemisphericLight at LOW intensity (~0.3) for fill, add ONE DirectionalLight for shape + shadows (`const dir = new DirectionalLight(\"dir\", new Vector3(-0.5,-1,0.4), scene); dir.position = new Vector3(12,20,-12); dir.intensity = 0.9;`), and a shadow generator (`const sg = new ShadowGenerator(1024, dir); sg.useBlurExponentialShadowMap = true; sg.blurKernel = 32;`) — call `sg.addShadowCaster(mesh)` on the player body, enemies, and obstacles and set `ground.receiveShadows = true` so everything sits grounded in the world. " +
  "ENVIRONMENT — the world must read as a PLACE, never an empty void in open space (this matters as much as the characters). Do ALL of: (1) ATMOSPHERE — add fog so distance fades into a coloured haze: `scene.fogMode = Scene.FOGMODE_EXP2; scene.fogColor = new Color3(0.05,0.03,0.09); scene.fogDensity = 0.015;` and set `scene.clearColor` to the same haze. (2) SKYBOX — the horizon must not be black: `const sky = MeshBuilder.CreateBox(\"sky\", { size: 500 }, scene); const skm = new StandardMaterial(\"skm\", scene); skm.backFaceCulling = false; skm.disableLighting = true; skm.emissiveColor = new Color3(0.07,0.04,0.13); sky.material = skm; sky.infiniteDistance = true;`. (3) A neon GRID floor — over the dark ground lay thin emissive line-boxes every ~5 units in x and z (cyan `emissiveColor`, `disableLighting=true`) so the ground has depth. (4) BOUNDARY WALLS enclosing the arena (4 tall emissive-edged walls with `checkCollisions=true`) so it's a room, not infinite. " +
  "PROPS / SET-DRESSING — scatter ~12-18 cover objects so the arena feels populated, not bare: crates (boxes), barrels (cylinders), low cover walls, tall pillars — each with a neon `emissiveColor` accent, added as `sg.addShadowCaster(...)`, `checkCollisions=true`, placed at varied random positions (but keep the player's spawn + immediate front clear). These double as cover the player and enemies weave around. " +
  "LOOK + FEEL: neon materials — pink #ff79c6 / amber #ffb84d / cyan accents via `mat.emissiveColor` + `mat.diffuseColor` on a dark base. Keep the HemisphericLight (fill, low) + DirectionalLight (shape + shadows) from RENDERING. " +
  "ROBUSTNESS: the FIRST FRAME must already render the arena + player view (build everything before the render loop, not after a timer). Handle keyboard AND pointer. No dead controls, no TODO stubs. Keep the whole game focused and under ~500 lines total. It MUST run with zero uncaught errors and draw a non-blank 3D scene immediately.";

// Fix contract for a 3D (Babylon) build that failed the smoke test.
export function game3DFixRules(errors) {
  return (
    "The 3D Babylon build " + ((errors && errors.compile) ? "FAILED TO COMPILE" : "compiled but the RUNTIME SMOKE TEST failed") +
    ". Fix ONLY what these errors indicate and return the FULL corrected file blocks (`===FILE: <path>===`, raw contents in full, only changed files). Common causes: importing from a wrong `@babylonjs/core/...` path or using `import * as BABYLON` (use the exact per-module allowlist paths), calling a Babylon API before `engine`/`scene` exist, using a disposed mesh without an `isDisposed()` guard, or nothing drawn on frame 1 (build the arena + a light + the camera BEFORE runRenderLoop). Keep the per-module imports, the pass-`scene` module pattern, primitives only. Output ONLY file blocks.\n\nERRORS:\n" +
    (Array.isArray(errors) ? errors : (errors && errors.list) || [String(errors)]).map((e) => "- " + e).join("\n")
  );
}
