// THE WORLD ASSIGNMENT — the whole package per candidate (2026-08-01,
// the realism sweep): ground (a MATERIAL where the theme's world names a
// surface, light backdrops only where light is the subject), display,
// motion, skin — and the component echoes a material implies (a marble
// theme's buttons go sharp, a paper theme's inputs underline), filled only
// where the batch theme left that axis unset so hand-authored axes always
// win. Every value is validated against the engine's real option sets at
// generation. Edit per theme freely — this file is data, and the sweep
// harness merges it onto the batches at render time. A missing entry or
// field means plain/none/ink.
export const WORLDS = {
 broadsheet: {},
 literary: {},
 zine: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 journal: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 gazette: {},
 manifesto: {},
 modern: {
  backdrop: "wash"
 },
 saas: {
  backdrop: "field",
  display: "accent"
 },
 developer: {
  decor: "grid",
  display: "accent"
 },
 "neo-brutalist": {
  backdrop: "wash"
 },
 swiss: {},
 bauhaus: {
  backdrop: "wash"
 },
 neumorphic: {
  backdrop: "wash"
 },
 "gradient-mesh": {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 aurora: {
  backdrop: "aurora",
  display: "gradient",
  ambient: "drift"
 },
 cyber: {
  backdrop: "glow",
  decor: "scanlines",
  display: "accent",
  ambient: "drift"
 },
 "industrial-technical": {
  decor: "grid"
 },
 "ai-native": {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 minimal: {},
 monochrome: {},
 "quiet-luxury": {},
 scandi: {
  decor: "wood"
 },
 japandi: {},
 utilitarian: {},
 "wabi-sabi": {
  decor: "plaster"
 },
 gallery: {
  skin: "frame"
 },
 maximalist: {
  backdrop: "field",
  decor: "spots",
  display: "gradient",
  ambient: "lively"
 },
 poster: {
  backdrop: "horizon",
  display: "accent",
  ambient: "lively"
 },
 kinetic: {
  backdrop: "field",
  display: "accent",
  ambient: "lively"
 },
 "anti-design": {},
 acid: {
  backdrop: "glow",
  display: "accent",
  ambient: "lively"
 },
 "y2k": {
  backdrop: "aurora",
  display: "gradient",
  ambient: "lively"
 },
 vaporwave: {
  backdrop: "horizon",
  decor: "grid",
  display: "gradient",
  ambient: "lively"
 },
 memphis: {
  decor: "spots",
  backdrop: "wash",
  display: "accent",
  ambient: "lively"
 },
 psychedelic: {
  backdrop: "aurora",
  display: "gradient",
  ambient: "lively"
 },
 artisan: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 farmhouse: {
  decor: "wood"
 },
 botanical: {
  backdrop: "wash",
  display: "accent"
 },
 clay: {
  backdrop: "wash",
  display: "accent"
 },
 bakery: {
  backdrop: "wash",
  display: "accent"
 },
 coastal: {
  backdrop: "wash"
 },
 "nordic-cabin": {
  decor: "wood",
  display: "accent"
 },
 market: {
  decor: "grain",
  backdrop: "wash",
  display: "accent"
 },
 "mid-century": {
  display: "accent",
  decor: "wood"
 },
 "art-deco": {
  decor: "rays",
  display: "accent"
 },
 "art-nouveau": {
  backdrop: "wash",
  display: "accent"
 },
 victorian: {
  decor: "grain"
 },
 diner: {
  decor: "check",
  backdrop: "wash",
  display: "accent"
 },
 "retro-futurism": {
  decor: "rays",
  backdrop: "field",
  display: "accent"
 },
 grunge: {
  decor: "grain",
  display: "ink"
 },
 punk: {
  decor: "grain"
 },
 "analog-vhs": {
  decor: "scanlines",
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 blueprint: {
  decor: "grid"
 },
 apothecary: {
  decor: "grain"
 },
 couture: {},
 jewellery: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 hotel: {
  backdrop: "wash"
 },
 "fine-dining": {
  display: "accent",
  decor: "linen",
  inputs: "underline"
 },
 heritage: {},
 spa: {
  backdrop: "wash"
 },
 toybox: {
  backdrop: "wash",
  decor: "spots",
  display: "gradient",
  ambient: "lively"
 },
 sticker: {
  decor: "spots",
  backdrop: "wash",
  display: "gradient",
  ambient: "lively",
  skin: "tilt"
 },
 claymorphism: {
  backdrop: "wash",
  display: "accent",
  ambient: "lively"
 },
 comic: {
  decor: "dots",
  backdrop: "wash",
  display: "accent",
  ambient: "lively"
 },
 nursery: {
  backdrop: "wash",
  decor: "dots",
  display: "accent",
  ambient: "lively"
 },
 arcade: {
  backdrop: "glow",
  decor: "scanlines",
  display: "gradient",
  ambient: "lively"
 },
 noir: {},
 cinematic: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 gothic: {
  display: "accent",
  decor: "leather"
 },
 nightlife: {
  backdrop: "glow",
  display: "gradient",
  ambient: "drift"
 },
 esoteric: {
  decor: "grain",
  display: "accent"
 },
 letterpress: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 linen: {
  decor: "linen",
  inputs: "underline"
 },
 terrazzo: {
  decor: "spots",
  display: "accent"
 },
 cork: {
  decor: "grain"
 },
 denim: {
  decor: "linen",
  display: "accent",
  inputs: "underline"
 },
 porcelain: {
  backdrop: "wash",
  display: "accent"
 },
 concrete: {
  decor: "concrete",
  buttons: "sharp",
  display: "ink"
 },
 copper: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 walnut: {
  decor: "wood",
  display: "accent"
 },
 velvet: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 trattoria: {
  display: "accent",
  decor: "paper",
  inputs: "underline"
 },
 izakaya: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 greenhouse: {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 boathouse: {
  backdrop: "wash",
  display: "accent"
 },
 launderette: {
  backdrop: "wash",
  display: "accent"
 },
 "record-shop": {
  backdrop: "wash",
  display: "accent"
 },
 tearoom: {
  backdrop: "wash"
 },
 courtyard: {
  backdrop: "wash"
 },
 study: {
  decor: "leather",
  display: "accent"
 },
 chapel: {
  backdrop: "wash",
  display: "accent"
 },
 constructivist: {
  backdrop: "wash",
  display: "accent"
 },
 "de-stijl": {
  backdrop: "wash",
  display: "accent"
 },
 "ukiyo-e": {
  backdrop: "wash",
  display: "accent"
 },
 illuminated: {
  backdrop: "wash",
  display: "accent"
 },
 baroque: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 rococo: {
  backdrop: "wash",
  display: "accent"
 },
 "brutalist-concrete": {
  decor: "concrete",
  buttons: "sharp",
  display: "ink"
 },
 "belle-epoque": {
  backdrop: "wash",
  display: "accent"
 },
 seventies: {
  backdrop: "wash",
  display: "accent"
 },
 "eighties-corporate": {
  backdrop: "wash",
  display: "accent"
 },
 alpine: {
  backdrop: "field"
 },
 desert: {
  backdrop: "horizon"
 },
 monsoon: {
  backdrop: "wash"
 },
 tundra: {},
 meadow: {
  backdrop: "wash",
  decor: "spots"
 },
 tidepool: {
  backdrop: "aurora",
  ambient: "drift"
 },
 canyon: {
  backdrop: "horizon",
  display: "accent"
 },
 orchard: {
  backdrop: "wash",
  decor: "spots",
  display: "accent"
 },
 fog: {
  backdrop: "wash"
 },
 ember: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "barber-classic": {
  display: "accent",
  decor: "leather"
 },
 tailor: {
  decor: "linen",
  inputs: "underline"
 },
 "butcher-paper": {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 carpenter: {
  display: "accent",
  decor: "wood"
 },
 foundry: {
  display: "accent",
  decor: "concrete",
  buttons: "sharp"
 },
 printshop: {
  backdrop: "wash",
  display: "accent"
 },
 brewery: {
  display: "accent",
  decor: "wood"
 },
 distillery: {
  display: "accent",
  decor: "wood"
 },
 florist: {
  backdrop: "wash",
  display: "accent"
 },
 cobbler: {
  display: "accent",
  decor: "leather"
 },
 paperback: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 tabloid: {
  decor: "dots"
 },
 libretto: {},
 mixtape: {
  decor: "grain",
  display: "accent",
  skin: "tilt"
 },
 arthouse: {
  display: "accent"
 },
 teletext: {
  decor: "scanlines",
  display: "accent"
 },
 atlas: {
  decor: "grid"
 },
 "field-notes": {
  decor: "grid"
 },
 telegram: {
  decor: "grain"
 },
 marginalia: {},
 "system-classic": {
  decor: "brushed",
  buttons: "sharp",
  display: "ink"
 },
 "dot-matrix": {
  decor: "scanlines"
 },
 wireframe: {
  decor: "grid"
 },
 skeuomorph: {
  decor: "leather",
  display: "accent"
 },
 "terminal-amber": {
  decor: "scanlines"
 },
 eink: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 "cassette-futurism": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 hologram: {
  display: "gradient",
  ambient: "drift"
 },
 "beige-box": {},
 vector: {
  decor: "grid",
  display: "accent"
 },
 espresso: {
  backdrop: "wash"
 },
 matcha: {
  backdrop: "wash",
  display: "accent"
 },
 citrus: {
  backdrop: "wash",
  display: "accent"
 },
 "wine-cellar": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "oyster-bar": {
  backdrop: "wash",
  display: "accent"
 },
 gelato: {
  backdrop: "wash",
  display: "accent"
 },
 smokehouse: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 cocktail: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 honey: {
  backdrop: "wash",
  display: "accent"
 },
 delicatessen: {
  backdrop: "wash",
  display: "accent"
 },
 transit: {
  display: "accent",
  skin: "ticket"
 },
 municipal: {},
 library: {
  decor: "wood"
 },
 "museum-label": {
  decor: "plaster",
  skin: "frame"
 },
 schoolhouse: {
  decor: "grid",
  display: "accent"
 },
 laboratory: {
  decor: "grid"
 },
 observatory: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "post-office": {
  decor: "stripes",
  display: "accent"
 },
 ledger: {
  decor: "grid"
 },
 courthouse: {
  decor: "marble",
  buttons: "sharp",
  display: "ink"
 },
 dusk: {
  backdrop: "wash",
  display: "accent"
 },
 daybreak: {
  backdrop: "wash",
  display: "accent"
 },
 siesta: {
  decor: "plaster"
 },
 fiesta: {
  backdrop: "wash",
  display: "accent"
 },
 monastery: {
  backdrop: "wash"
 },
 promenade: {
  backdrop: "wash",
  display: "accent"
 },
 solstice: {
  backdrop: "wash",
  display: "accent"
 },
 lagoon: {
  backdrop: "wash",
  display: "accent"
 },
 onsen: {
  decor: "wood"
 },
 safari: {
  decor: "canvas",
  display: "accent"
 },
 orchestra: {},
 "jazz-club": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 choir: {
  display: "accent"
 },
 karaoke: {
  backdrop: "glow",
  display: "gradient",
  ambient: "drift"
 },
 boombox: {
  decor: "scanlines",
  display: "accent"
 },
 "vinyl-45": {
  display: "accent",
  backdrop: "wash"
 },
 busker: {
  decor: "grain",
  backdrop: "wash",
  skin: "tilt"
 },
 discotheque: {
  backdrop: "glow",
  display: "gradient",
  ambient: "drift"
 },
 chamber: {},
 "opera-house": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 velodrome: {
  display: "accent",
  decor: "wood"
 },
 "tennis-club": {
  backdrop: "wash",
  display: "accent"
 },
 "boxing-gym": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "yacht-club": {
  display: "accent",
  decor: "wood"
 },
 marathon: {
  backdrop: "wash",
  display: "accent"
 },
 "chess-club": {
  decor: "wood"
 },
 billiards: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "bowling-alley": {
  display: "accent",
  decor: "wood"
 },
 surf: {
  backdrop: "wash",
  display: "accent"
 },
 dojo: {
  backdrop: "wash",
  display: "accent"
 },
 herbarium: {
  backdrop: "wash"
 },
 entomology: {
  backdrop: "wash",
  display: "accent"
 },
 mineralogy: {
  display: "accent",
  decor: "felt"
 },
 anatomy: {
  backdrop: "wash",
  display: "accent",
  skin: "frame"
 },
 "arctic-station": {
  backdrop: "wash",
  display: "accent"
 },
 aquarium: {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 aviary: {
  backdrop: "wash",
  display: "accent"
 },
 fossil: {
  backdrop: "wash",
  display: "accent"
 },
 microscope: {
  backdrop: "wash",
  display: "accent"
 },
 orrery: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 darkroom: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 loom: {
  decor: "linen",
  display: "accent",
  inputs: "underline"
 },
 bindery: {
  backdrop: "wash"
 },
 glassblower: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 mosaic: {
  backdrop: "wash",
  display: "accent"
 },
 origami: {
  backdrop: "wash",
  display: "accent"
 },
 calligraphy: {
  backdrop: "wash",
  display: "accent"
 },
 quilt: {
  decor: "check",
  backdrop: "wash",
  display: "accent"
 },
 easel: {
  display: "accent",
  decor: "canvas",
  skin: "frame"
 },
 mural: {
  backdrop: "wash",
  display: "accent"
 },
 harvest: {
  backdrop: "wash",
  display: "accent"
 },
 frost: {
  backdrop: "wash"
 },
 bloom: {
  backdrop: "wash",
  display: "accent"
 },
 midwinter: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 advent: {
  backdrop: "wash",
  display: "accent"
 },
 lantern: {
  display: "accent",
  decor: "paper",
  inputs: "underline"
 },
 bonfire: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 almanac: {
  backdrop: "wash",
  display: "accent"
 },
 maypole: {
  backdrop: "wash",
  display: "accent"
 },
 "snow-day": {
  display: "accent",
  decor: "felt"
 },
 "sleeper-train": {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 airship: {
  backdrop: "wash"
 },
 motorway: {
  backdrop: "wash",
  display: "accent"
 },
 harbour: {
  backdrop: "wash",
  display: "accent"
 },
 "bicycle-shop": {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 motel: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 caravan: {
  backdrop: "wash",
  display: "accent"
 },
 gondola: {
  backdrop: "wash",
  display: "accent"
 },
 jetset: {
  backdrop: "wash",
  display: "accent"
 },
 trailhead: {
  backdrop: "wash",
  display: "accent"
 },
 millinery: {
  display: "accent",
  decor: "paper",
  inputs: "underline"
 },
 perfumery: {
  backdrop: "wash",
  display: "accent"
 },
 tweed: {
  decor: "felt"
 },
 silk: {
  display: "gradient",
  ambient: "drift"
 },
 haberdashery: {
  decor: "dots"
 },
 sneaker: {
  backdrop: "wash",
  display: "accent"
 },
 thrift: {
  backdrop: "wash",
  display: "accent",
  skin: "tilt"
 },
 streetwear: {
  backdrop: "wash",
  display: "accent"
 },
 bespoke: {
  backdrop: "wash",
  display: "accent"
 },
 cashmere: {
  backdrop: "wash"
 },
 storybook: {
  backdrop: "wash",
  display: "accent"
 },
 "treasure-map": {
  backdrop: "wash",
  display: "accent"
 },
 circus: {
  backdrop: "wash",
  display: "accent"
 },
 marionette: {
  backdrop: "wash",
  display: "accent"
 },
 alchemy: {
  backdrop: "wash",
  display: "accent"
 },
 clockwork: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 castaway: {
  backdrop: "wash"
 },
 labyrinth: {
  backdrop: "wash",
  display: "accent"
 },
 masquerade: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "penny-dreadful": {
  decor: "dots"
 },
 typewriter: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 "corner-office": {
  decor: "wood"
 },
 switchboard: {
  decor: "dots"
 },
 archive: {
  decor: "grain"
 },
 boardroom: {},
 cubicle: {
  decor: "grid"
 },
 reception: {
  decor: "marble",
  buttons: "sharp",
  display: "ink"
 },
 stockroom: {
  decor: "brushed",
  buttons: "sharp",
  display: "ink"
 },
 "night-shift": {
  backdrop: "glow",
  ambient: "drift"
 },
 dispatch: {
  decor: "grid",
  display: "accent"
 },
 hammam: {
  decor: "marble",
  display: "accent",
  buttons: "sharp"
 },
 riad: {
  decor: "plaster",
  display: "accent"
 },
 taverna: {
  display: "accent",
  decor: "plaster"
 },
 fika: {
  decor: "check",
  backdrop: "wash"
 },
 hanok: {
  decor: "wood"
 },
 pueblo: {
  display: "accent",
  decor: "plaster"
 },
 bazaar: {
  backdrop: "glow",
  decor: "weave",
  display: "accent",
  ambient: "drift"
 },
 milonga: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 highlands: {
  decor: "check",
  display: "accent"
 },
 chai: {
  backdrop: "wash",
  decor: "dots",
  display: "accent"
 },
 western: {
  decor: "wood"
 },
 "drive-in": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift",
  skin: "ticket"
 },
 tiki: {
  decor: "weave",
  backdrop: "wash",
  display: "accent"
 },
 "county-fair": {
  decor: "spots",
  backdrop: "wash",
  display: "accent",
  skin: "ticket"
 },
 "honky-tonk": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 rodeo: {
  decor: "leather",
  display: "accent"
 },
 boardwalk: {
  decor: "wood",
  display: "accent"
 },
 "soda-fountain": {
  decor: "check",
  backdrop: "wash",
  display: "accent"
 },
 tailgate: {
  backdrop: "wash",
  display: "accent"
 },
 jukebox: {
  backdrop: "glow",
  display: "gradient",
  ambient: "drift"
 },
 "silent-film": {
  decor: "grain",
  skin: "frame"
 },
 ballet: {
  backdrop: "wash",
  display: "accent"
 },
 cabaret: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 vaudeville: {
  decor: "rays",
  display: "accent"
 },
 matinee: {
  backdrop: "glow",
  decor: "grain",
  display: "accent",
  ambient: "drift",
  skin: "ticket"
 },
 backstage: {
  backdrop: "glow",
  ambient: "drift"
 },
 "magic-show": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "box-office": {
  decor: "paper",
  inputs: "underline",
  display: "ink",
  skin: "ticket"
 },
 "shadow-play": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "green-room": {
  backdrop: "wash"
 },
 "board-game": {
  decor: "spots",
  backdrop: "wash",
  display: "accent"
 },
 casino: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "playing-cards": {
  display: "accent",
  decor: "linen",
  inputs: "underline"
 },
 crossword: {
  decor: "grid"
 },
 jigsaw: {
  decor: "dots",
  backdrop: "wash",
  display: "accent"
 },
 pinball: {
  backdrop: "glow",
  decor: "dots",
  display: "gradient",
  ambient: "drift"
 },
 mahjong: {
  decor: "felt",
  display: "accent"
 },
 dominoes: {},
 dungeon: {
  decor: "paper",
  display: "accent",
  inputs: "underline"
 },
 bingo: {
  decor: "dots",
  backdrop: "wash",
  display: "accent",
  skin: "ticket"
 },
 lighthouse: {
  display: "accent",
  decor: "plaster"
 },
 riverboat: {
  backdrop: "wash",
  display: "accent"
 },
 canal: {
  backdrop: "wash",
  display: "accent"
 },
 fjord: {
  backdrop: "wash",
  display: "accent"
 },
 submarine: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 pearl: {
  backdrop: "aurora",
  ambient: "drift"
 },
 ferry: {
  backdrop: "wash",
  display: "accent",
  skin: "ticket"
 },
 estuary: {
  backdrop: "wash"
 },
 kelp: {
  backdrop: "wash",
  display: "accent"
 },
 buoy: {
  backdrop: "wash",
  display: "accent"
 },
 eclipse: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 comet: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 moonrise: {
  backdrop: "glow",
  ambient: "drift"
 },
 cumulus: {
  backdrop: "aurora",
  ambient: "drift"
 },
 nebula: {
  backdrop: "aurora",
  display: "gradient",
  ambient: "drift"
 },
 sundial: {
  decor: "rays"
 },
 weathervane: {
  decor: "brushed",
  buttons: "sharp",
  display: "ink"
 },
 kite: {
  decor: "spots",
  backdrop: "field",
  display: "accent"
 },
 balloonist: {
  decor: "canvas",
  display: "accent"
 },
 polaris: {
  backdrop: "glow",
  ambient: "drift"
 },
 crayon: {
  display: "accent",
  decor: "paper",
  inputs: "underline",
  skin: "tilt"
 },
 "paper-plane": {
  display: "accent",
  decor: "paper",
  inputs: "underline",
  skin: "tilt"
 },
 treehouse: {
  decor: "wood",
  display: "accent"
 },
 "lemonade-stand": {
  backdrop: "wash",
  display: "accent",
  skin: "tilt"
 },
 marbles: {
  backdrop: "wash",
  display: "accent"
 },
 hopscotch: {
  backdrop: "wash",
  display: "accent"
 },
 sandbox: {
  backdrop: "wash",
  display: "accent"
 },
 "gold-star": {
  backdrop: "wash",
  display: "accent"
 },
 pinwheel: {
  backdrop: "wash",
  display: "accent"
 },
 bubblegum: {
  backdrop: "wash",
  display: "accent"
 },
 cave: {
  backdrop: "glow",
  ambient: "drift"
 },
 grotto: {
  backdrop: "aurora",
  ambient: "drift"
 },
 mine: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 catacomb: {
  backdrop: "glow",
  ambient: "drift"
 },
 "metro-tile": {
  decor: "grid",
  display: "accent"
 },
 bunker: {
  decor: "grain"
 },
 burrow: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "root-cellar": {
  backdrop: "glow",
  ambient: "drift"
 },
 speakeasy: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 vault: {
  decor: "brushed",
  buttons: "sharp",
  display: "ink"
 },
 stationery: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 "wax-seal": {
  decor: "grain",
  display: "accent"
 },
 postcard: {
  decor: "paper",
  display: "accent",
  inputs: "underline",
  skin: "tilt"
 },
 scrapbook: {
  decor: "spots",
  backdrop: "wash",
  display: "accent",
  skin: "tilt"
 },
 "carbon-copy": {
  decor: "scanlines"
 },
 "composition-book": {
  decor: "marble",
  buttons: "sharp",
  display: "ink"
 },
 "fountain-pen": {
  decor: "leather",
  display: "accent"
 },
 envelope: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 "ink-blot": {},
 receipt: {
  decor: "scanlines"
 },
 fishmonger: {
  display: "accent",
  decor: "marble",
  buttons: "sharp"
 },
 cheesemonger: {
  backdrop: "wash",
  display: "accent"
 },
 greengrocer: {
  backdrop: "wash",
  display: "accent"
 },
 bookshop: {
  backdrop: "wash",
  display: "accent"
 },
 newsstand: {
  backdrop: "wash",
  display: "accent"
 },
 antiques: {
  backdrop: "wash"
 },
 "corner-shop": {
  backdrop: "wash",
  display: "accent"
 },
 "night-market": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 candlemaker: {
  backdrop: "wash",
  display: "accent"
 },
 locksmith: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 patina: {
  decor: "grain"
 },
 overgrown: {
  decor: "grain",
  backdrop: "wash"
 },
 ruin: {
  decor: "grain"
 },
 palimpsest: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 fresco: {
  decor: "plaster",
  skin: "frame"
 },
 sepia: {
  decor: "grain",
  skin: "frame"
 },
 kintsugi: {
  display: "accent"
 },
 "ghost-sign": {
  decor: "grain",
  display: "accent"
 },
 attic: {
  decor: "grain",
  backdrop: "glow",
  ambient: "drift"
 },
 "time-capsule": {
  decor: "grain"
 },
 allotment: {
  backdrop: "wash",
  display: "accent"
 },
 topiary: {
  backdrop: "wash",
  display: "accent"
 },
 "walled-garden": {
  backdrop: "wash",
  display: "accent"
 },
 "potting-shed": {
  decor: "wood"
 },
 hedgerow: {
  backdrop: "wash",
  display: "accent"
 },
 "zen-garden": {
  backdrop: "wash"
 },
 "kitchen-garden": {
  backdrop: "wash",
  display: "accent"
 },
 arboretum: {
  backdrop: "wash"
 },
 bonsai: {
  backdrop: "wash"
 },
 "seed-packet": {
  backdrop: "wash",
  display: "accent"
 },
 "mise-en-place": {
  backdrop: "wash",
  display: "accent"
 },
 pantry: {
  backdrop: "wash",
  display: "accent"
 },
 "supper-club": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 cookbook: {
  backdrop: "wash",
  display: "accent"
 },
 "family-recipe": {
  backdrop: "wash",
  display: "accent"
 },
 "farm-table": {
  decor: "wood",
  display: "accent"
 },
 "spice-rack": {
  backdrop: "wash",
  display: "accent"
 },
 "cast-iron": {
  backdrop: "wash",
  display: "accent"
 },
 picnic: {
  backdrop: "wash",
  display: "accent"
 },
 preserves: {
  backdrop: "wash",
  display: "accent"
 },
 "model-railway": {
  backdrop: "wash",
  display: "accent"
 },
 "ham-radio": {
  backdrop: "wash",
  display: "accent"
 },
 birdwatching: {
  backdrop: "wash",
  display: "accent"
 },
 philately: {
  backdrop: "wash",
  display: "accent"
 },
 "coin-cabinet": {
  backdrop: "wash",
  display: "accent"
 },
 rocketry: {
  backdrop: "wash",
  display: "accent"
 },
 beekeeping: {
  backdrop: "wash",
  display: "accent"
 },
 knitting: {
  decor: "felt",
  display: "accent"
 },
 "fly-fishing": {
  backdrop: "wash",
  display: "accent"
 },
 "metal-detecting": {
  backdrop: "wash",
  display: "accent"
 },
 "midnight-snack": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "sunday-morning": {
  backdrop: "wash",
  display: "accent"
 },
 "golden-hour": {
  backdrop: "wash",
  display: "accent"
 },
 "small-hours": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "lie-in": {
  backdrop: "wash",
  display: "accent"
 },
 aperitivo: {
  backdrop: "wash",
  display: "accent"
 },
 nightcap: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "dawn-chorus": {
  backdrop: "wash",
  display: "accent"
 },
 "lunch-break": {
  backdrop: "wash",
  display: "accent"
 },
 "porch-light": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 palladian: {
  backdrop: "wash"
 },
 cottage: {
  backdrop: "wash",
  display: "accent"
 },
 "a-frame": {
  backdrop: "wash",
  display: "accent"
 },
 penthouse: {
  decor: "marble",
  buttons: "sharp",
  display: "ink"
 },
 bungalow: {
  backdrop: "wash",
  display: "accent"
 },
 castle: {
  backdrop: "wash",
  display: "accent"
 },
 windmill: {
  display: "accent",
  decor: "canvas"
 },
 conservatory: {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 terrace: {
  backdrop: "wash",
  display: "accent"
 },
 geodesic: {
  backdrop: "wash",
  display: "accent"
 },
 thunderstorm: {
  backdrop: "field",
  display: "accent"
 },
 heatwave: {
  backdrop: "horizon",
  display: "accent"
 },
 blizzard: {
  backdrop: "wash"
 },
 drizzle: {
  backdrop: "wash"
 },
 rainbow: {
  backdrop: "aurora",
  display: "gradient",
  ambient: "drift"
 },
 dewfall: {
  backdrop: "aurora",
  ambient: "drift"
 },
 sirocco: {
  backdrop: "horizon"
 },
 mistral: {
  backdrop: "field"
 },
 gale: {
  backdrop: "field",
  decor: "stripes"
 },
 afterglow: {
  backdrop: "horizon",
  display: "accent"
 },
 gramophone: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 "difference-engine": {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 pendulum: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 "camera-obscura": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 seismograph: {
  backdrop: "wash",
  display: "accent"
 },
 "player-piano": {
  backdrop: "wash",
  display: "accent"
 },
 zoetrope: {
  backdrop: "wash",
  display: "accent"
 },
 barometer: {
  backdrop: "wash",
  display: "accent"
 },
 astrolabe: {
  display: "accent",
  decor: "brushed",
  buttons: "sharp"
 },
 "magic-lantern": {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 rooftops: {
  backdrop: "wash",
  display: "accent"
 },
 "fire-escape": {
  backdrop: "wash",
  display: "accent"
 },
 cobblestone: {
  backdrop: "wash"
 },
 gaslight: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 plaza: {
  backdrop: "wash",
  display: "accent"
 },
 tram: {
  backdrop: "wash",
  display: "accent"
 },
 awning: {
  display: "accent",
  decor: "canvas"
 },
 balcony: {
  backdrop: "wash",
  display: "accent"
 },
 windowbox: {
  backdrop: "wash",
  display: "accent"
 },
 skyline: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 amphora: {
  backdrop: "field",
  decor: "grain",
  display: "accent"
 },
 laurel: {
  display: "accent"
 },
 oracle: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 hieroglyph: {
  decor: "grain",
  display: "accent"
 },
 runestone: {
  decor: "grain"
 },
 atlantis: {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 papyrus: {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 obsidian: {
  backdrop: "glow",
  ambient: "drift"
 },
 phoenix: {
  backdrop: "glow",
  display: "gradient",
  ambient: "drift"
 },
 scarab: {
  display: "accent",
  backdrop: "wash"
 },
 basecamp: {
  decor: "canvas",
  display: "accent"
 },
 summit: {
  backdrop: "field"
 },
 rainforest: {
  backdrop: "field"
 },
 oasis: {
  backdrop: "wash",
  display: "accent"
 },
 outback: {
  backdrop: "horizon",
  decor: "grain",
  display: "accent"
 },
 steppe: {
  backdrop: "horizon"
 },
 volcano: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 glacier: {
  backdrop: "aurora",
  ambient: "drift"
 },
 dune: {
  backdrop: "horizon"
 },
 "cloud-forest": {
  backdrop: "wash",
  decor: "grain"
 },
 malachite: {
  display: "accent",
  backdrop: "wash"
 },
 lapis: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 "rose-quartz": {
  backdrop: "wash",
  display: "accent"
 },
 "tigers-eye": {
  backdrop: "field",
  display: "accent"
 },
 jade: {
  display: "accent"
 },
 opal: {
  backdrop: "aurora",
  display: "gradient",
  ambient: "drift"
 },
 onyx: {
  backdrop: "glow",
  ambient: "drift"
 },
 amber: {
  backdrop: "glow",
  display: "accent",
  ambient: "drift"
 },
 granite: {
  decor: "marble",
  buttons: "sharp",
  display: "ink"
 },
 impressionist: {
  backdrop: "aurora",
  decor: "grain",
  display: "accent",
  ambient: "drift",
  skin: "frame"
 },
 fauvist: {
  backdrop: "field",
  display: "gradient"
 },
 cubist: {
  decor: "grain"
 },
 pointillist: {
  decor: "dots",
  display: "accent"
 },
 watercolour: {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift",
  skin: "frame"
 },
 gouache: {
  backdrop: "wash",
  display: "accent"
 },
 charcoal: {
  decor: "grain"
 },
 sanguine: {
  decor: "grain",
  display: "accent"
 },
 linocut: {
  display: "accent"
 },
 tarot: {
  backdrop: "glow",
  decor: "grain",
  display: "accent",
  ambient: "drift"
 },
 bioluminescence: {
  backdrop: "aurora",
  display: "accent",
  ambient: "drift"
 },
 prism: {
  decor: "grid",
  display: "gradient"
 },
 mirage: {
  backdrop: "horizon"
 },
 confetti: {
  decor: "spots",
  backdrop: "wash",
  display: "gradient"
 },
 "paper-cut": {
  decor: "paper",
  inputs: "underline",
  display: "ink"
 },
 terrarium: {
  backdrop: "aurora",
  ambient: "drift"
 },
 kaleidoscope: {
  backdrop: "aurora",
  decor: "spots",
  display: "gradient",
  ambient: "drift"
 },
 matchbox: {
  decor: "grain",
  display: "accent"
 }
};
