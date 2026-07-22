// Default template game so `vite build` always has a valid project shape; the
// generated source overwrites src/** per request. Mounts kaplay into #game.
import kaplay from "kaplay"

const k = kaplay({
  width: 960,
  height: 540,
  letterbox: true,
  background: [12, 8, 24],
  canvas: document.querySelector("#game"),
  global: false,
})

k.add([
  k.text("isibi game studio", { size: 36 }),
  k.pos(k.center()),
  k.anchor("center"),
  k.color(255, 121, 198),
])
