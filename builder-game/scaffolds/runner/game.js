// The runnable game scene. Neon endless runner: jump/double-jump over obstacles,
// grab orbs, survive. Keyboard (space/up) + pointer (tap) both work.
export function gameScene(k) {
  k.scene("game", () => {
    k.setGravity(1900)
    const GROUND_Y = 470

    // Ground
    k.add([
      k.rect(k.width(), k.height() - GROUND_Y),
      k.pos(0, GROUND_Y),
      k.area(),
      k.body({ isStatic: true }),
      k.color(26, 11, 38),
      k.outline(2, k.rgb(255, 121, 198)),
      "ground",
    ])

    // Player — neon pink
    const player = k.add([
      k.rect(38, 46, { radius: 8 }),
      k.pos(160, GROUND_Y - 60),
      k.anchor("botleft"),
      k.area(),
      k.body({ jumpForce: 760 }),
      k.color(255, 121, 198),
      k.outline(2, k.rgb(255, 190, 225)),
      "player",
    ])

    let jumps = 0
    player.onGround(() => { jumps = 0 })
    const doJump = () => { if (jumps < 2) { player.jump(760); jumps++ } }
    k.onKeyPress("space", doJump)
    k.onKeyPress("up", doJump)
    k.onMousePress(doJump)

    // Score HUD (fixed so it ignores any camera moves)
    let score = 0
    const label = k.add([k.text("0", { size: 32 }), k.pos(20, 18), k.fixed(), k.z(100), k.color(255, 255, 255)])
    k.onUpdate(() => { score += k.dt() * 10; label.text = Math.floor(score).toString() })

    // Obstacles
    const spawnObstacle = () => {
      const h = k.rand(30, 96)
      k.add([
        k.rect(30, h),
        k.pos(k.width() + 20, GROUND_Y - h),
        k.area(),
        k.move(k.LEFT, 340),
        k.color(150, 60, 235),
        k.outline(2, k.rgb(255, 121, 198)),
        k.offscreen({ destroy: true }),
        "danger",
      ])
      k.wait(k.rand(0.8, 1.6), spawnObstacle)
    }
    spawnObstacle()

    // Orbs — amber pickups
    const spawnOrb = () => {
      k.add([
        k.circle(12),
        k.pos(k.width() + 20, k.rand(250, GROUND_Y - 40)),
        k.area(),
        k.move(k.LEFT, 300),
        k.color(255, 184, 77),
        k.offscreen({ destroy: true }),
        "orb",
      ])
      k.wait(k.rand(1.2, 2.4), spawnOrb)
    }
    spawnOrb()

    player.onCollide("danger", () => k.go("gameover", Math.floor(score)))
    player.onCollide("orb", (o) => { if (o.exists()) k.destroy(o); score += 25 })
    // Safety: if physics ever flings the player out, end cleanly instead of hanging.
    player.onUpdate(() => { if (player.pos.y > k.height() + 120) k.go("gameover", Math.floor(score)) })
  })
}
