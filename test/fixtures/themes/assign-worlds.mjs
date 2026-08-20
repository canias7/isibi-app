// THE WORLD-ASSIGNMENT GENERATOR — regenerates worlds.mjs from the batch
// catalogues. Banked beside its output (2026-08-01) because the curation IS
// the value: the hand overrides, the keyword corrections (cabin once
// matched cabinet, plank matched plankton, and "brass" kept catching the
// band instead of the metal), and the per-material component kits. Run:
//   node builder/theme-candidates/assign-worlds.mjs
import fs from "node:fs";
import path from "node:path";
const D = import.meta.dirname;
const batches = await Promise.all([1, 2, 3, 4, 5, 6].map((n) =>
  import(path.join(D, `batch-${n}.mjs`))));
const ALL = Object.assign({}, ...batches.map((b) => Object.values(b)[0]));

const HAND = {
  // print — restraint is the look; texture only where the genre IS texture
  broadsheet: {}, literary: {}, journal: { decor: "grain" }, gazette: {},
  zine: { decor: "grain" }, manifesto: {},
  // tech
  swiss: {}, bauhaus: { backdrop: "wash" }, "neo-brutalist": { backdrop: "wash" },
  developer: { decor: "grid", display: "accent" }, cyber: { backdrop: "glow", decor: "scanlines", display: "accent" },
  "industrial-technical": { decor: "grid" }, neumorphic: { backdrop: "wash" },
  modern: { backdrop: "wash" }, saas: { backdrop: "field", display: "accent" },
  // quiet — worlds off, that IS the theme
  minimal: {}, monochrome: {}, "quiet-luxury": {}, gallery: {}, japandi: {},
  "wabi-sabi": { decor: "grain" }, utilitarian: {}, scandi: { backdrop: "wash" },
  // bold
  poster: { backdrop: "horizon", display: "accent" }, maximalist: { backdrop: "field", decor: "spots", display: "gradient" },
  kinetic: { backdrop: "field", display: "accent" }, "anti-design": {},
  acid: { backdrop: "glow", display: "accent" }, y2k: { backdrop: "aurora", display: "gradient" },
  vaporwave: { backdrop: "horizon", decor: "grid", display: "gradient" },
  memphis: { decor: "spots", backdrop: "wash", display: "accent" },
  psychedelic: { backdrop: "aurora", display: "gradient" },
  // warm / retro / americana staples
  artisan: { decor: "grain", backdrop: "wash" }, farmhouse: { decor: "check", backdrop: "wash" },
  market: { decor: "grain", backdrop: "wash", display: "accent" },
  "mid-century": { backdrop: "field", display: "accent" }, "art-deco": { decor: "rays", display: "accent" },
  "art-nouveau": { backdrop: "wash", display: "accent" }, victorian: { decor: "grain" },
  diner: { decor: "check", backdrop: "wash", display: "accent" },
  "retro-futurism": { decor: "rays", backdrop: "field", display: "accent" },
  grunge: { decor: "grain", display: "ink" }, punk: { decor: "grain" },
  "analog-vhs": { decor: "scanlines", backdrop: "glow", display: "accent" },
  blueprint: { decor: "grid" }, apothecary: { decor: "grain" },
  western: { decor: "grain", backdrop: "wash" }, "drive-in": { backdrop: "glow", display: "accent" },
  tiki: { decor: "weave", backdrop: "wash", display: "accent" },
  "county-fair": { decor: "spots", backdrop: "wash", display: "accent" },
  "honky-tonk": { backdrop: "glow", display: "accent" }, rodeo: { decor: "grain", backdrop: "wash" },
  boardwalk: { decor: "stripes", backdrop: "horizon", display: "accent" },
  "soda-fountain": { decor: "check", backdrop: "wash", display: "accent" },
  jukebox: { backdrop: "glow", display: "gradient" },
  // luxury — mostly ink or accent, plain or the faintest wash
  couture: {}, jewellery: { backdrop: "glow", display: "accent" }, "fine-dining": { display: "accent" },
  hotel: { backdrop: "wash" }, heritage: {}, spa: { backdrop: "wash" },
  // playful
  toybox: { backdrop: "wash", decor: "spots", display: "gradient" },
  sticker: { decor: "spots", backdrop: "wash", display: "gradient" },
  claymorphism: { backdrop: "wash", display: "accent" },
  comic: { decor: "dots", backdrop: "wash", display: "accent" },
  nursery: { backdrop: "wash", decor: "dots", display: "accent" },
  arcade: { backdrop: "glow", decor: "scanlines", display: "gradient" },
  // dark / moody
  noir: {}, cinematic: { backdrop: "glow", display: "accent" }, gothic: { display: "accent" },
  nightlife: { backdrop: "glow", display: "gradient" }, esoteric: { decor: "grain", display: "accent" },
  // materials / craft textures
  // Wood is a GROUND decor since the realism pass (2026-08-01): it opens the
  // root and carries its own tonal variation, so a wash under it only bloomed
  // gold over the grain — measured side by side, wood-only won.
  walnut: { decor: "wood", display: "accent" },
  "farm-table": { decor: "wood", display: "accent" },
  treehouse: { decor: "wood", display: "accent" },
  "nordic-cabin": { decor: "wood", display: "accent" },
  "potting-shed": { decor: "wood" },
  linen: { decor: "weave" }, denim: { decor: "weave", display: "accent" }, cork: { decor: "grain" },
  terrazzo: { decor: "spots", display: "accent" }, concrete: { decor: "grain" },
  velvet: { backdrop: "glow", display: "accent" }, letterpress: { decor: "grain" },
  loom: { decor: "weave", display: "accent" }, tweed: { decor: "weave" }, silk: { display: "gradient" },
  quilt: { decor: "check", backdrop: "wash", display: "accent" }, knitting: { decor: "weave", backdrop: "wash", display: "accent" },
  haberdashery: { decor: "dots" }, "butcher-paper": { decor: "grain" },
  "field-notes": { decor: "grid" }, "composition-book": { decor: "grid" },
  "dot-matrix": { decor: "scanlines" }, teletext: { decor: "scanlines", display: "accent" },
  "terminal-amber": { decor: "scanlines" }, "beige-box": {}, wireframe: { decor: "grid" },
  "system-classic": {}, eink: {}, vector: { decor: "grid", display: "accent" },
  "cassette-futurism": { backdrop: "glow", display: "accent" }, hologram: { display: "gradient" },
  skeuomorph: { decor: "weave", backdrop: "wash" },
  // media / correspondence
  paperback: { decor: "grain" }, tabloid: { decor: "dots" }, mixtape: { decor: "grain", display: "accent" },
  arthouse: { display: "accent" }, atlas: { decor: "grid" }, telegram: { decor: "grain" },
  marginalia: {}, libretto: {}, "penny-dreadful": { decor: "dots" },
  stationery: {}, "wax-seal": { decor: "grain", display: "accent" }, postcard: { decor: "grain", display: "accent" },
  scrapbook: { decor: "spots", backdrop: "wash", display: "accent" }, "carbon-copy": { decor: "scanlines" },
  "fountain-pen": {}, envelope: { decor: "grain" }, "ink-blot": {}, receipt: { decor: "scanlines" },
  // stage / music / games
  "silent-film": { decor: "grain" }, cabaret: { backdrop: "glow", display: "accent" },
  vaudeville: { decor: "rays", display: "accent" }, "magic-show": { backdrop: "glow", display: "accent" },
  "shadow-play": { backdrop: "glow", display: "accent" }, "box-office": { decor: "grain" },
  ballet: { backdrop: "wash", display: "accent" }, "green-room": { backdrop: "wash" },
  matinee: { backdrop: "glow", decor: "grain", display: "accent" },
  backstage: { backdrop: "glow" },
  orchestra: {}, "jazz-club": { backdrop: "glow", display: "accent" },
  choir: { display: "accent" }, karaoke: { backdrop: "glow", display: "gradient" },
  boombox: { decor: "scanlines", display: "accent" }, "vinyl-45": { display: "accent", backdrop: "wash" },
  busker: { decor: "grain", backdrop: "wash" }, discotheque: { backdrop: "glow", display: "gradient" },
  chamber: {}, "opera-house": { backdrop: "glow", display: "accent" },
  "board-game": { decor: "spots", backdrop: "wash", display: "accent" },
  casino: { backdrop: "glow", display: "accent" }, "playing-cards": { display: "accent" },
  crossword: { decor: "grid" }, jigsaw: { decor: "dots", backdrop: "wash", display: "accent" },
  pinball: { backdrop: "glow", decor: "dots", display: "gradient" },
  mahjong: { decor: "grid", display: "accent" }, dominoes: {},
  dungeon: { decor: "grid", backdrop: "glow", display: "accent" },
  bingo: { decor: "dots", backdrop: "wash", display: "accent" },
  // civic / office — worlds quiet, occasional accent type
  transit: { display: "accent" }, municipal: {}, library: { decor: "grain" },
  "museum-label": {}, schoolhouse: { decor: "grid", display: "accent" },
  laboratory: { decor: "grid" }, observatory: { backdrop: "glow", display: "accent" },
  "post-office": { decor: "stripes", display: "accent" }, ledger: { decor: "grid" },
  courthouse: {}, typewriter: {}, "corner-office": { backdrop: "glow" },
  switchboard: { decor: "dots" }, archive: { decor: "grain" }, boardroom: {},
  cubicle: { decor: "grid" }, reception: { backdrop: "wash" }, stockroom: { decor: "grid" },
  "night-shift": { backdrop: "glow" }, dispatch: { decor: "grid", display: "accent" },
  // weather / sky / land
  thunderstorm: { backdrop: "field", display: "accent" }, heatwave: { backdrop: "horizon", display: "accent" },
  blizzard: { backdrop: "wash" }, drizzle: { backdrop: "wash" },
  rainbow: { backdrop: "aurora", display: "gradient" }, dewfall: { backdrop: "aurora" },
  sirocco: { backdrop: "horizon" }, mistral: { backdrop: "field" },
  gale: { backdrop: "field", decor: "stripes" }, afterglow: { backdrop: "horizon", display: "accent" },
  eclipse: { backdrop: "glow", display: "accent" }, comet: { backdrop: "glow", display: "accent" },
  moonrise: { backdrop: "glow" }, cumulus: { backdrop: "aurora" }, nebula: { backdrop: "aurora", display: "gradient" },
  sundial: { decor: "rays" }, weathervane: {}, kite: { decor: "spots", backdrop: "field", display: "accent" },
  balloonist: { decor: "stripes", backdrop: "horizon", display: "accent" },
  polaris: { backdrop: "glow" }, aurora: { backdrop: "aurora", display: "gradient" },
  monsoon: { backdrop: "wash" }, tundra: {}, meadow: { backdrop: "wash", decor: "spots" },
  tidepool: { backdrop: "aurora" }, canyon: { backdrop: "horizon", display: "accent" },
  orchard: { backdrop: "wash", decor: "spots", display: "accent" }, fog: { backdrop: "wash" },
  ember: { backdrop: "glow", display: "accent" }, alpine: { backdrop: "field" },
  desert: { backdrop: "horizon" },
  // frontier / antiquity / world / underground / patina
  volcano: { backdrop: "glow", display: "accent" }, glacier: { backdrop: "aurora" },
  dune: { backdrop: "horizon" }, "cloud-forest": { backdrop: "wash", decor: "grain" },
  rainforest: { backdrop: "field" }, oasis: { backdrop: "wash", display: "accent" },
  outback: { backdrop: "horizon", decor: "grain", display: "accent" },
  steppe: { backdrop: "horizon" }, basecamp: { decor: "grid" }, summit: { backdrop: "field" },
  amphora: { backdrop: "field", decor: "grain", display: "accent" },
  laurel: { display: "accent" }, oracle: { backdrop: "glow", display: "accent" },
  hieroglyph: { decor: "grain", display: "accent" }, runestone: { decor: "grain" },
  atlantis: { backdrop: "aurora", display: "accent" }, papyrus: { decor: "weave" },
  obsidian: { backdrop: "glow" }, phoenix: { backdrop: "glow", display: "gradient" },
  scarab: { display: "accent", backdrop: "wash" }, palimpsest: { decor: "grain" },
  fresco: { decor: "grain", backdrop: "wash" }, sepia: { decor: "grain" },
  kintsugi: { display: "accent" }, "ghost-sign": { decor: "grain", display: "accent" },
  attic: { decor: "grain", backdrop: "glow" }, "time-capsule": { decor: "grain" },
  patina: { decor: "grain" }, overgrown: { decor: "grain", backdrop: "wash" },
  ruin: { decor: "grain" },
  cave: { backdrop: "glow" }, grotto: { backdrop: "aurora" }, mine: { backdrop: "glow", display: "accent" },
  catacomb: { backdrop: "glow" }, "metro-tile": { decor: "grid", display: "accent" },
  bunker: { decor: "grain" }, burrow: { backdrop: "glow", display: "accent" },
  "root-cellar": { backdrop: "glow" }, speakeasy: { backdrop: "glow", display: "accent" },
  vault: {}, hammam: { backdrop: "wash", decor: "dots", display: "accent" },
  riad: { decor: "grid", backdrop: "wash", display: "accent" }, taverna: { backdrop: "wash", display: "accent" },
  fika: { decor: "check", backdrop: "wash" }, hanok: { decor: "weave" },
  pueblo: { backdrop: "horizon", display: "accent" }, bazaar: { backdrop: "glow", decor: "weave", display: "accent" },
  milonga: { backdrop: "glow", display: "accent" }, highlands: { decor: "check", display: "accent" },
  chai: { backdrop: "wash", decor: "dots", display: "accent" },
  // gems / painters / coda
  malachite: { display: "accent", backdrop: "wash" }, lapis: { backdrop: "glow", display: "accent" },
  "rose-quartz": { backdrop: "wash", display: "accent" }, "tigers-eye": { backdrop: "field", display: "accent" },
  jade: { display: "accent" }, opal: { backdrop: "aurora", display: "gradient" },
  onyx: { backdrop: "glow" }, amber: { backdrop: "glow", display: "accent" }, granite: { decor: "grain" },
  impressionist: { backdrop: "aurora", decor: "grain", display: "accent" },
  fauvist: { backdrop: "field", display: "gradient" }, cubist: { decor: "grain" },
  pointillist: { decor: "dots", display: "accent" }, watercolour: { backdrop: "aurora", display: "accent" },
  gouache: { backdrop: "wash", display: "accent" }, charcoal: { decor: "grain" },
  sanguine: { decor: "grain", display: "accent" }, linocut: { display: "accent" },
  tarot: { backdrop: "glow", decor: "grain", display: "accent" },
  bioluminescence: { backdrop: "aurora", display: "accent" },
  prism: { decor: "grid", display: "gradient" }, mirage: { backdrop: "horizon" },
  confetti: { decor: "spots", backdrop: "wash", display: "gradient" },
  "paper-cut": { backdrop: "wash" }, terrarium: { backdrop: "aurora" },
  kaleidoscope: { backdrop: "aurora", decor: "spots", display: "gradient" },
  matchbox: { decor: "grain", display: "accent" },
};

// ---- wave 2: motion, edges, skins — hand picks where the genre names them
const WAVE2 = {
  // skins
  "box-office": { skin: "ticket" }, matinee: { skin: "ticket" }, "drive-in": { skin: "ticket" },
  transit: { skin: "ticket" }, ferry: { skin: "ticket" }, "county-fair": { skin: "ticket" },
  cinema: {}, tombola: {}, bingo: { skin: "ticket" },
  gallery: { skin: "frame" }, "museum-label": { skin: "frame" }, easel: { skin: "frame" },
  fresco: { skin: "frame" }, anatomy: { skin: "frame" }, sepia: { skin: "frame" },
  impressionist: { skin: "frame" }, watercolour: { skin: "frame" }, "silent-film": { skin: "frame" },
  scrapbook: { skin: "tilt" }, sticker: { skin: "tilt" }, crayon: { skin: "tilt" },
  mixtape: { skin: "tilt" }, thrift: { skin: "tilt" }, busker: { skin: "tilt" },
  "lemonade-stand": { skin: "tilt" }, "paper-plane": { skin: "tilt" }, postcard: { skin: "tilt" },
};

// ---- materials: a theme whose world NAMES a surface gets that surface as
// its ground (2026-08-01, the realism sweep). Matched on name + label so
// "leather blotter" counts, with an explicit override map for corrections
// and a KEEP set for themes whose identity is light or pattern, not matter.
// Each material carries a small COMPONENT KIT — the coherence the owner
// asked for ("not only the background") — applied ONLY where the base theme
// and the world rules left that axis unset, so hand-authored axes survive.
const MAT_KEEP = new Set([
  "neo-brutalist",  // a digital design genre, not poured concrete
  "jewellery", "opera-house", "watercolour", "impressionist", "gouache",  // light/paint IS the subject
  "quilt",          // the check pattern says quilt better than a cloth ground
  "couture", "silk", "hologram",  // sheen and cut, not weave
  // First-list corrections — each of these matched a WORD, not a world:
  "jazz-club", "cabaret", "speakeasy", "maypole", "fiesta",  // "brass" was the band, not the surface
  "y2k", "jukebox", "gelato", "soda-fountain", "diner",      // chrome trim on a light-and-vinyl world
  "mixtape",        // "felt-tip" is a pen
  "airship",        // its "envelope" holds gas, not letters
  "marbles",        // a child's glass, not a slab
  "tiki", "orchard", "delicatessen", "arboretum",            // bamboo, fruit, tile, trees
  "shadow-play", "dot-matrix",                               // backlit paper and greenbar ARE light/stripes
  "quiet-luxury",   // the quiet category's identity is restraint — worlds stay off
]);
const MAT_OVERRIDE = {
  whiskey: "leather", study: "leather", "fine-dining": "linen", library: "wood",
  western: "wood", "chess-club": "wood", brewery: "wood", "yacht-club": "wood",
  granite: "marble", tweed: "felt", knitting: "felt", denim: "linen",
  fresco: "plaster", riad: "plaster", pueblo: "plaster",
  "wabi-sabi": "plaster", papyrus: "paper", palimpsest: "paper",
  // Where a label names two surfaces, the one the world is MADE of wins:
  courthouse: "marble",   // oak bench stands ON the marble
  hammam: "marble",       // "steamed marble", not plaster
  taverna: "plaster",     // whitewash walls; the tables are furniture
  rodeo: "leather",       // tooled leather is the rodeo craft
  letterpress: "paper",   // wood type prints INTO paper
  "box-office": "paper",  // ticket stubs and stamps
  trattoria: "paper",     // the label says paper tablecloth
  balloonist: "canvas",   // the striped envelope is cloth
  reception: "marble",    // "lobby stone"
  "museum-label": "plaster",  // "warm wall"
  // The brass instruments — "brass" left the keyword rules because it kept
  // matching bands and rails, so the genuinely-brass worlds are named:
  clockwork: "brushed", orrery: "brushed", gramophone: "brushed",
  "difference-engine": "brushed", pendulum: "brushed", astrolabe: "brushed",
  submarine: "brushed", "sleeper-train": "brushed", locksmith: "brushed",
};
const MAT_RULES = [
  // "cabin" and "plank" are EXACT — \w* matched cabinet and plankton.
  ["wood", /\b(wood\w*|oak|walnut|timber|planks?\b|cabins?\b|lodge|barn|saloon|sawmill|carpent\w*|lumber|treehouse|whittl\w*)/],
  ["marble", /\b(marble|courthouse|museum(?!-label)|luxur|penthouse|embassy)\w*/],
  ["leather", /\b(leather|cobbler|saddle|oxblood|blotter|barber)\w*/],
  ["linen", /\b(linen|flax|tailor|loom|drapery|tablecloth)\w*/],
  ["canvas", /\b(canvas|easel|atelier|tent)\w*/],
  ["plaster", /\b(plaster|stucco|adobe|villa|siesta|whitewash|hacienda|tadelakt)\w*/],
  ["concrete", /\b(concrete|brutalist-concrete|warehouse|foundry|garage)\w*/],
  ["brushed", /\b(steel|chrome|forge|copper|pewter|aluminium)\w*/],
  ["felt", /\b(felt|wool|knit|mitten|flannel|cardigan)\w*/],
  ["paper", /\b(paper|letterpress|zine|journal|stationery|envelope|postcard|manuscript|papyrus)\w*/],
];
function materialFor(name, t) {
  if (MAT_KEEP.has(name)) return null;
  if (MAT_OVERRIDE[name]) return MAT_OVERRIDE[name];
  const hay = `${name} ${t.label ?? ""}`.toLowerCase();
  for (const [mat, re] of MAT_RULES) if (re.test(hay)) return mat;
  return null;
}
// The kit: what a surface implies about the furniture standing on it.
// Core axes (shadow/corner/border/icon) defer to the base theme; overlay
// axes (buttons/inputs/display) defer to HAND and the display rules.
const MAT_KIT = {
  wood: { shadow: "flat", corner: "round" },
  paper: { inputs: "underline", border: "hairline", display: "ink" },
  linen: { inputs: "underline", icon: "fine" },
  canvas: { border: "drawn", display: "accent" },
  plaster: { corner: "squircle", shadow: "soft" },
  concrete: { buttons: "sharp", shadow: "flat", display: "ink" },
  marble: { buttons: "sharp", shadow: "crisp", display: "ink" },
  leather: { corner: "round", shadow: "soft", display: "accent" },
  felt: { corner: "squircle", shadow: "soft" },
  brushed: { buttons: "sharp", icon: "fine", display: "ink" },
};
const CORE_AXES = new Set(["shadow", "corner", "border", "icon", "tracking"]);

// ---- rules for everything unnamed
function assign(name, t) {
  const wave2 = WAVE2[name] ?? {};
  // ambient by rule: lit worlds drift, playful/bold play, quiet stays still
  const base = HAND[name];
  const pick = (out) => {
    if (out.ambient === undefined) {
      const backdrop = out.backdrop ?? (t.surface === "glass" ? "aurora" : undefined);
      if (["playful", "bold"].includes(t.cat) && backdrop) out.ambient = "lively";
      else if (["aurora", "glow"].includes(backdrop)) out.ambient = "drift";
    }
    return { ...out, ...wave2 };
  };
  let out;
  if (base !== undefined) out = { ...base };
  else {
    out = {};
    if (t.surface === "glass") out.backdrop = "aurora";
    else if (t.shot === "dark") out.backdrop = "glow";
    else if (["print", "quiet"].includes(t.cat)) { /* plain */ }
    else out.backdrop = "wash";
    // display: colour where the palette has colour and the genre isn't print/quiet
    const chroma = Math.max(t.light.accent[1], t.dark.accent[1]);
    if (!["print", "quiet", "civic", "office"].includes(t.cat) && chroma >= 0.1) {
      out.display = ["playful", "bold"].includes(t.cat) ? "gradient" : "accent";
    }
  }
  const mat = materialFor(name, t);
  if (mat) {
    delete out.backdrop; // a ground carries itself — measured on wood, wash only bloomed over the grain
    out.decor = mat;
    for (const [axis, v] of Object.entries(MAT_KIT[mat] ?? {})) {
      if (CORE_AXES.has(axis)) { if (t[axis] === undefined && out[axis] === undefined) out[axis] = v; }
      else if (out[axis] === undefined) out[axis] = v;
    }
  }
  return pick(out);
}

const ENGINE = await import(path.join(D, "..", "site-theme.mjs"));
const LEGAL = {
  backdrop: ENGINE.BACKDROPS, decor: ENGINE.DECORS, display: ENGINE.DISPLAYS,
  ambient: ENGINE.AMBIENTS, skin: ENGINE.SKINS, buttons: ENGINE.BUTTONS,
  inputs: ENGINE.INPUTS, shadow: ENGINE.SHADOWS, corner: ENGINE.CORNERS,
  border: ENGINE.BORDERS, icon: ENGINE.ICON_STROKES, tracking: ENGINE.TRACKINGS,
};
const WORLDS = {};
let stats = { plain: 0, wash: 0, aurora: 0, field: 0, horizon: 0, glow: 0, decors: 0, ink: 0, accent: 0, gradient: 0, drift: 0, lively: 0, skins: 0 };
const mats = {};
for (const [name, t] of Object.entries(ALL)) {
  const w = assign(name, t);
  for (const [axis, v] of Object.entries(w)) {
    if (LEGAL[axis] && !LEGAL[axis][v]) throw new Error(`${name}.${axis} = "${v}" is not a legal option`);
  }
  WORLDS[name] = w;
  stats[w.backdrop ?? "plain"]++;
  if (w.decor) stats.decors++;
  if (ENGINE.GROUND_DECORS.has(w.decor)) mats[w.decor] = (mats[w.decor] ?? 0) + 1;
  stats[w.display ?? "ink"]++;
  if (w.ambient) stats[w.ambient]++;
  if (w.skin) stats.skins++;
}

const header = `// THE WORLD ASSIGNMENT — the whole package per candidate (2026-08-01,
// the realism sweep): ground (a MATERIAL where the theme's world names a
// surface, light backdrops only where light is the subject), display,
// motion, skin — and the component echoes a material implies (a marble
// theme's buttons go sharp, a paper theme's inputs underline), filled only
// where the batch theme left that axis unset so hand-authored axes always
// win. Every value is validated against the engine's real option sets at
// generation. Edit per theme freely — this file is data, and the sweep
// harness merges it onto the batches at render time. A missing entry or
// field means plain/none/ink.
export const WORLDS = `;
fs.writeFileSync(path.join(D, "worlds.mjs"),
  header + JSON.stringify(WORLDS, null, 1).replace(/"([a-z-]+)":/g, (m, k) => k.includes("-") ? `"${k}":` : `${k}:`) + ";\n");
console.log("themes:", Object.keys(WORLDS).length, JSON.stringify(stats));
console.log("materials:", JSON.stringify(mats));
if (process.env.LIST) for (const [name, w] of Object.entries(WORLDS)) {
  if (ENGINE.GROUND_DECORS.has(w.decor)) console.log(` ${w.decor.padEnd(9)} ${name.padEnd(22)} ${ALL[name].label.slice(0, 60)}`);
}
