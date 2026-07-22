// Genre scaffold: platformer (run, double-jump, collect coins, reach the goal).
// Keyboard (arrows/WASD + space) and pointer (tap to jump). Static-body platforms.
export function registerScenes(k) {
  k.scene("game", () => {
    k.setGravity(2000)
    let score = 0
    const label = k.add([k.text("0", { size: 28 }), k.pos(16, 14), k.fixed(), k.z(100), k.color(255, 255, 255)])

    const plat = (x, y, w) => k.add([k.rect(w, 18, { radius: 4 }), k.pos(x, y), k.area(), k.body({ isStatic: true }), k.color(26, 11, 38), k.outline(2, k.rgb(255, 184, 77)), "solid"])
    plat(0, k.height() - 30, k.width())        // ground
    plat(220, 400, 160)
    plat(470, 320, 150)
    plat(700, 240, 170)
    plat(380, 190, 120)

    const coinAt = (x, y) => k.add([k.circle(11), k.pos(x, y), k.area(), k.color(255, 184, 77), k.outline(2, k.rgb(255, 220, 150)), "coin"])
    coinAt(300, 360); coinAt(540, 280); coinAt(770, 200); coinAt(430, 150)

    // Goal flag, sitting on the highest-right platform
    k.add([k.rect(24, 48), k.pos(790, 240 - 48), k.area(), k.color(120, 255, 160), k.outline(2, k.rgb(255, 255, 255)), "goal"])

    const player = k.add([k.rect(32, 40, { radius: 7 }), k.pos(60, 180), k.area(), k.body({ jumpForce: 720 }), k.color(255, 121, 198), k.outline(2, k.rgb(255, 200, 230)), "player"])
    const SPEED = 260
    k.onKeyDown("left", () => player.move(-SPEED, 0)); k.onKeyDown("a", () => player.move(-SPEED, 0))
    k.onKeyDown("right", () => player.move(SPEED, 0)); k.onKeyDown("d", () => player.move(SPEED, 0))
    let jumps = 0
    player.onGround(() => { jumps = 0 })
    const doJump = () => { if (jumps < 2) { player.jump(720); jumps++ } }
    k.onKeyPress("space", doJump); k.onKeyPress("up", doJump); k.onKeyPress("w", doJump)
    k.onMousePress(doJump)

    player.onCollide("coin", (c) => { if (c.exists()) k.destroy(c); score += 10; label.text = String(score) })
    player.onCollide("goal", () => k.go("win", score))
    player.onUpdate(() => { if (player.pos.y > k.height() + 80) k.go("gameover", score) })
  })

  k.scene("gameover", (score) => endScene(k, "Game Over", score))
  k.scene("win", (score) => endScene(k, "You Win!", score))
}

function endScene(k, title, score) {
  k.add([k.text(title, { size: 52 }), k.pos(k.center().x, 200), k.anchor("center"), k.color(255, 121, 198)])
  k.add([k.text("Score: " + (score || 0), { size: 32 }), k.pos(k.center().x, 270), k.anchor("center"), k.color(255, 255, 255)])
  k.add([k.text("press space / tap to retry", { size: 22 }), k.pos(k.center().x, 330), k.anchor("center"), k.color(255, 184, 77)])
  const retry = () => k.go("game")
  k.onKeyPress("space", retry)
  k.onMousePress(retry)
}
