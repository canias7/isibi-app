// Genre scaffold: flappy (one-button tap-to-fly through gaps). Keyboard (space/up)
// + pointer (tap). Follows the pass-`k` pattern; primitive neon art only.
export function registerScenes(k) {
  k.scene("game", () => {
    k.setGravity(1500)

    // Ground (a solid the bird dies on)
    k.add([k.rect(k.width(), 30), k.pos(0, k.height() - 30), k.area(), k.color(26, 11, 38), k.outline(2, k.rgb(255, 121, 198)), "solid"])

    // Bird — amber
    const bird = k.add([k.circle(16), k.pos(220, 220), k.area(), k.body(), k.color(255, 184, 77), k.outline(2, k.rgb(255, 220, 150)), "bird"])
    const flap = () => bird.jump(430)
    k.onKeyPress("space", flap)
    k.onKeyPress("up", flap)
    k.onMousePress(flap)

    let score = 0
    const label = k.add([k.text("0", { size: 40 }), k.pos(k.center().x, 56), k.anchor("center"), k.fixed(), k.z(100), k.color(255, 255, 255)])

    const SPEED = 220, GAP = 165, PW = 74
    const spawnPipes = () => {
      const gapY = k.rand(90, k.height() - 90 - GAP - 30)
      const pipe = [k.area(), k.move(k.LEFT, SPEED), k.offscreen({ destroy: true }), k.color(150, 60, 235), k.outline(2, k.rgb(255, 121, 198)), "pipe"]
      k.add([k.rect(PW, gapY), k.pos(k.width(), 0), ...pipe])
      k.add([k.rect(PW, k.height() - 30 - (gapY + GAP)), k.pos(k.width(), gapY + GAP), ...pipe])
      k.add([k.rect(6, GAP), k.pos(k.width() + PW, gapY), k.area(), k.move(k.LEFT, SPEED), k.offscreen({ destroy: true }), k.opacity(0), "point"])
      k.wait(1.5, spawnPipes)
    }
    spawnPipes()

    bird.onCollide("point", (p) => { if (p.exists()) k.destroy(p); score++; label.text = String(score) })
    bird.onCollide("pipe", () => k.go("gameover", score))
    bird.onCollide("solid", () => k.go("gameover", score))
    bird.onUpdate(() => { if (bird.pos.y < -20) k.go("gameover", score) })
  })

  k.scene("gameover", (score) => {
    k.add([k.text("Game Over", { size: 52 }), k.pos(k.center().x, 200), k.anchor("center"), k.color(255, 121, 198)])
    k.add([k.text("Score: " + (score || 0), { size: 32 }), k.pos(k.center().x, 270), k.anchor("center"), k.color(255, 255, 255)])
    k.add([k.text("press space / tap to retry", { size: 22 }), k.pos(k.center().x, 330), k.anchor("center"), k.color(255, 184, 77)])
    const retry = () => k.go("game")
    k.onKeyPress("space", retry)
    k.onMousePress(retry)
  })
}
