// Restart path — required by GAME_RULES so a game is never a dead end.
export function gameoverScene(k) {
  k.scene("gameover", (score) => {
    k.add([k.text("Game Over", { size: 52 }), k.pos(k.center().x, 190), k.anchor("center"), k.color(255, 121, 198)])
    k.add([k.text("Score: " + (score || 0), { size: 34 }), k.pos(k.center().x, 262), k.anchor("center"), k.color(255, 255, 255)])
    k.add([k.text("press space / tap to retry", { size: 22 }), k.pos(k.center().x, 322), k.anchor("center"), k.color(255, 184, 77)])
    const retry = () => k.go("game")
    k.onKeyPress("space", retry)
    k.onMousePress(retry)
  })
}
