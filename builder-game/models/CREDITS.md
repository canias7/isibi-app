# 3D model pack — sources & licenses

All models here are **CC0 (public domain)** — free for commercial use, no attribution
required. Credits below are courtesy, not obligation.

## Characters
- `robot.glb` — "RobotExpressive" (three.js examples, CC0).
- `soldier.glb` — "Soldier" (three.js examples).

## Prop / environment packs
Baked outside `public/` (in the container's `modelpack/`); the build-service copies only
the props a given game references into `public/models/` before `vite build`, so 2D and
primitive-3D games aren't bloated.

- `warehouse_*` — **KayKit Prototype Bits** by Kay Lousberg (kaylousberg.com), CC0.
  Crates, barrels, pallets, pillars, walls, shooting targets, table, can, coin.
- `dungeon_*` — **KayKit Dungeon Remastered** by Kay Lousberg, CC0.
  Barrels, crates, chests, keg, torch, pillar, table, wall, banner, bottle.
- `city_*` — **KayKit City Builder Bits** by Kay Lousberg, CC0.
  Dumpster, hydrant, streetlight, traffic light, bench, car, water tower, crate.
- `scifi_*` — **Polygonal Mind CC0 asset library** (via the ToxSam/open-source-3D-assets
  registry → ToxSam/cc0-models-Polygonal-Mind), CC0.
  Battery, capsule, machine, antenna, drone, glass screen, plug, circular wall, bridge,
  mini-PC, monolith.

`.gltf` sources were converted to self-contained `.glb` (embedded textures) via
`gltf-pipeline`; filenames are lowercase + theme-prefixed so the worker's model-ref
parse (which lowercases) resolves them.
