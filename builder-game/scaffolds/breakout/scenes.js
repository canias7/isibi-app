// Genre scaffold: breakout (paddle + ball + bricks). Manual ball physics (no body)
// with reliable overlap checks. Keyboard (arrows) + pointer (mouse) move the paddle.
export function registerScenes(k) {
  k.scene("game", () => {
    let score = 0, lives = 3
    const label = k.add([k.text("0", { size: 28 }), k.pos(16, 14), k.fixed(), k.z(100), k.color(255, 255, 255)])
    const livesLabel = k.add([k.text("♥♥♥", { size: 24 }), k.pos(k.width() - 92, 16), k.fixed(), k.z(100), k.color(255, 95, 143)])

    const paddle = k.add([k.rect(120, 18, { radius: 6 }), k.pos(k.center().x - 60, k.height() - 50), k.area(), k.color(255, 121, 198), k.outline(2, k.rgb(255, 200, 230)), "paddle"])
    const clampPaddle = (x) => Math.max(0, Math.min(k.width() - paddle.width, x))
    k.onKeyDown("left", () => { paddle.pos.x = clampPaddle(paddle.pos.x - 9) })
    k.onKeyDown("right", () => { paddle.pos.x = clampPaddle(paddle.pos.x + 9) })
    k.onMouseMove(() => { paddle.pos.x = clampPaddle(k.mousePos().x - paddle.width / 2) })

    // Bricks
    const COLS = 10, ROWS = 5, BW = 80, BH = 26, PAD = 6
    const OX = (k.width() - (COLS * (BW + PAD) - PAD)) / 2, OY = 70
    const hues = [[255, 121, 198], [255, 150, 120], [255, 184, 77], [180, 120, 255], [120, 200, 255]]
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const h = hues[r]
      k.add([k.rect(BW, BH, { radius: 4 }), k.pos(OX + c * (BW + PAD), OY + r * (BH + PAD)), k.area(), k.color(h[0], h[1], h[2]), "brick"])
    }

    // Ball — manual velocity, integrated each frame
    let vel = k.vec2(220, -280)
    const ball = k.add([k.circle(9), k.pos(k.center().x, k.height() - 82), k.area(), k.color(255, 255, 255), "ball"])
    ball.onUpdate(() => {
      ball.move(vel.x, vel.y)
      if (ball.pos.x < 9) { ball.pos.x = 9; vel.x = Math.abs(vel.x) }
      if (ball.pos.x > k.width() - 9) { ball.pos.x = k.width() - 9; vel.x = -Math.abs(vel.x) }
      if (ball.pos.y < 9) { ball.pos.y = 9; vel.y = Math.abs(vel.y) }
      if (ball.isColliding(paddle) && vel.y > 0) {
        vel.y = -Math.abs(vel.y)
        const dx = (ball.pos.x - (paddle.pos.x + paddle.width / 2)) / (paddle.width / 2)
        vel.x = dx * 280
      }
      for (const b of k.get("brick")) {
        if (ball.isColliding(b)) { k.destroy(b); vel.y = -vel.y; score += 10; label.text = String(score); break }
      }
      if (k.get("brick").length === 0) { k.go("win", score); return }
      if (ball.pos.y > k.height() + 20) {
        lives--
        livesLabel.text = "♥".repeat(Math.max(0, lives))
        if (lives <= 0) { k.go("gameover", score); return }
        ball.pos = k.vec2(k.center().x, k.height() - 82); vel = k.vec2(220, -280)
      }
    })
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
