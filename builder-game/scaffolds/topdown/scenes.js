// Genre scaffold: top-down arena shooter. Move with WASD/arrows, aim + shoot with
// mouse (or space toward the pointer). Enemies home in; survive + score.
export function registerScenes(k) {
  k.scene("game", () => {
    let score = 0, lives = 3
    const label = k.add([k.text("0", { size: 28 }), k.pos(16, 14), k.fixed(), k.z(100), k.color(255, 255, 255)])
    const livesLabel = k.add([k.text("♥♥♥", { size: 24 }), k.pos(k.width() - 92, 16), k.fixed(), k.z(100), k.color(255, 95, 143)])

    const player = k.add([k.rect(30, 30, { radius: 6 }), k.pos(k.center()), k.anchor("center"), k.area(), k.color(255, 121, 198), k.outline(2, k.rgb(255, 200, 230)), "player"])
    const SPEED = 240
    k.onKeyDown("left", () => player.move(-SPEED, 0)); k.onKeyDown("a", () => player.move(-SPEED, 0))
    k.onKeyDown("right", () => player.move(SPEED, 0)); k.onKeyDown("d", () => player.move(SPEED, 0))
    k.onKeyDown("up", () => player.move(0, -SPEED)); k.onKeyDown("w", () => player.move(0, -SPEED))
    k.onKeyDown("down", () => player.move(0, SPEED)); k.onKeyDown("s", () => player.move(0, SPEED))
    player.onUpdate(() => {
      player.pos.x = Math.max(16, Math.min(k.width() - 16, player.pos.x))
      player.pos.y = Math.max(16, Math.min(k.height() - 16, player.pos.y))
    })

    const shoot = () => {
      const aim = k.mousePos().sub(player.pos)
      const dir = aim.len() > 0 ? aim.unit() : k.vec2(1, 0)
      k.add([k.circle(6), k.pos(player.pos), k.anchor("center"), k.area(), k.move(dir, 540), k.offscreen({ destroy: true }), k.color(255, 184, 77), "bullet"])
    }
    k.onMousePress(shoot)
    k.onKeyPress("space", shoot)

    const spawnEnemy = () => {
      const edges = [k.vec2(k.rand(0, k.width()), -20), k.vec2(k.rand(0, k.width()), k.height() + 20), k.vec2(-20, k.rand(0, k.height())), k.vec2(k.width() + 20, k.rand(0, k.height()))]
      const e = k.add([k.rect(26, 26, { radius: 5 }), k.pos(k.choose(edges)), k.anchor("center"), k.area(), k.color(150, 60, 235), k.outline(2, k.rgb(255, 121, 198)), "enemy"])
      e.onUpdate(() => { const d = player.pos.sub(e.pos); if (d.len() > 1) e.move(d.unit().scale(115)) })
      k.wait(k.rand(0.7, 1.4), spawnEnemy)
    }
    spawnEnemy()

    k.onCollide("bullet", "enemy", (b, e) => {
      if (b.exists()) k.destroy(b)
      if (e.exists()) k.destroy(e)
      score += 10; label.text = String(score)
    })
    player.onCollide("enemy", (e) => {
      if (e.exists()) k.destroy(e)
      lives--
      livesLabel.text = "♥".repeat(Math.max(0, lives))
      if (lives <= 0) k.go("gameover", score)
    })
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
