import kaplay from "kaplay"
import { registerScenes } from "./scenes.js"

const k = kaplay({
  width: 960,
  height: 540,
  letterbox: true,
  background: [12, 8, 24],
  canvas: document.querySelector("#game"),
  global: false,
})

registerScenes(k)
k.go("game")
