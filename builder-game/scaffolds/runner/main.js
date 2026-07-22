// Genre scaffold: endless runner (one-button, hardest genre to get wrong).
// Canonical example of the mandated pattern — main.js inits kaplay ONCE and passes
// the `k` context to each scene module; no top-level engine calls, no globals.
import kaplay from "kaplay"
import { gameScene } from "./game.js"
import { gameoverScene } from "./gameover.js"

const k = kaplay({
  width: 960,
  height: 540,
  letterbox: true,
  background: [12, 8, 24],
  canvas: document.querySelector("#game"),
  global: false,
})

gameScene(k)
gameoverScene(k)
k.go("game")
