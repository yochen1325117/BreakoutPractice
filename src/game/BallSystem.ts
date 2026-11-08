import Phaser from 'phaser'
import { ballColorForElements, effectiveBallElements, inheritSplitState, launchAngleForAim, splitAngleOffsets, sweptPaddleCrossingX } from './rules'
import type { BallEntity, PlayerBallBuild } from './types'

const BALL_RADIUS = 8

export class BallSystem {
  readonly group: Phaser.Physics.Arcade.Group
  private readonly entities = new Map<Phaser.GameObjects.Arc, BallEntity>()
  private idCounter = 0

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly build: PlayerBallBuild,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false })
  }

  get count(): number { return this.entities.size }
  get balls(): BallEntity[] { return [...this.entities.values()] }

  getEntity(sprite: Phaser.GameObjects.GameObject): BallEntity | undefined {
    return this.entities.get(sprite as Phaser.GameObjects.Arc)
  }

  createBall(x: number, y: number): BallEntity {
    const sprite = this.scene.add.circle(x, y, BALL_RADIUS, ballColorForElements(this.build.elementIds)).setStrokeStyle(2, 0xffffff, 0.9).setDepth(5)
    this.scene.physics.add.existing(sprite)
    this.group.add(sprite)
    const body = sprite.body as Phaser.Physics.Arcade.Body
    body.setCircle(BALL_RADIUS)
    body.setBounce(1, 1)
    body.setCollideWorldBounds(true, 1, 1)
    body.setAllowGravity(false)
    body.onWorldBounds = true

    const build = { ...this.build, elementIds: [...this.build.elementIds], modifierIds: [...this.build.modifierIds] }
    const label = this.scene.add.text(x, y, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#07101e',
    }).setOrigin(0.5).setDepth(6)

    const entity: BallEntity = {
      id: `ball-${++this.idCounter}`,
      sprite,
      label,
      build,
      runtime: {
        nextHitBonus: 0,
        nextHitElementIds: new Set(),
        previousPosition: new Phaser.Math.Vector2(x, y),
        previousVelocity: new Phaser.Math.Vector2(0, 0),
        insidePlatformIds: new Set(),
      },
    }
    this.entities.set(sprite, entity)
    return entity
  }

  createAttached(paddleX: number, paddleY: number): BallEntity {
    const ball = this.createBall(paddleX, paddleY - 22)
    ;(ball.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
    return ball
  }

  createAttachedBatch(count: number, paddleX: number, paddleY: number, paddleWidth = 108): BallEntity[] {
    const total = Math.max(0, Math.floor(count))
    const usableWidth = Math.max(0, paddleWidth - BALL_RADIUS * 4)
    const spacing = total > 1 ? Math.min(18, usableWidth / (total - 1)) : 0
    const created: BallEntity[] = []
    for (let index = 0; index < total; index += 1) {
      const offset = (index - (total - 1) / 2) * spacing
      created.push(this.createAttached(paddleX + offset, paddleY))
    }
    return created
  }

  attachAll(paddleX: number, paddleY: number, paddleWidth = 108): void {
    const balls = [...this.entities.values()]
    const usableWidth = Math.max(0, paddleWidth - BALL_RADIUS * 4)
    const spacing = balls.length > 1 ? Math.min(18, usableWidth / (balls.length - 1)) : 0
    for (const [index, ball] of balls.entries()) {
      const offset = (index - (balls.length - 1) / 2) * spacing
      ball.sprite.setPosition(paddleX + offset, paddleY - 22)
      ball.label.setPosition(ball.sprite.x, ball.sprite.y)
      ball.runtime.previousPosition.set(ball.sprite.x, ball.sprite.y)
      const body = ball.sprite.body as Phaser.Physics.Arcade.Body
      body.setVelocity(0, 0)
      body.updateFromGameObject()
    }
  }

  launch(speed: number, aimOffset?: number): void {
    const stationary = [...this.entities.values()].filter((ball) => {
      const body = ball.sprite.body as Phaser.Physics.Arcade.Body
      return body.velocity.lengthSq() === 0
    })
    const center = (stationary.length - 1) / 2
    for (const [index, ball] of stationary.entries()) {
      const body = ball.sprite.body as Phaser.Physics.Arcade.Body
      const baseAngle = aimOffset === undefined
        ? Phaser.Math.Between(-105, -75)
        : launchAngleForAim(aimOffset)
      const spread = (index - center) * 5
      const angle = Phaser.Math.DegToRad(Phaser.Math.Clamp(baseAngle + spread, -125, -55))
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    }
  }

  split(source: BallEntity, sourcePlatformId: string, totalBallCount: 2 | 3): BallEntity[] {
    const velocity = (source.sprite.body as Phaser.Physics.Arcade.Body).velocity.clone()
    const angleOffsets = splitAngleOffsets(totalBallCount)
    return angleOffsets.map((degrees) => {
      const angle = Phaser.Math.DegToRad(degrees)
      const clone = this.createBall(source.sprite.x, source.sprite.y)
      for (const platformId of source.runtime.insidePlatformIds) clone.runtime.insidePlatformIds.add(platformId)
      clone.runtime.insidePlatformIds.add(sourcePlatformId)
      inheritSplitState(source, clone)
      clone.runtime.previousPosition.copy(source.runtime.previousPosition)
      const rotated = new Phaser.Math.Vector2(
        velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
        velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle),
      )
      ;(clone.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(rotated.x, rotated.y)
      clone.runtime.previousVelocity.copy(rotated)
      return clone
    })
  }

  update(speed: number): void {
    for (const ball of this.entities.values()) {
      const body = ball.sprite.body as Phaser.Physics.Arcade.Body
      if (body.velocity.lengthSq() > 0) {
        if (Math.abs(body.velocity.x) < 70) body.velocity.x = (body.velocity.x < 0 ? -1 : 1) * 70
        if (Math.abs(body.velocity.y) < 70) body.velocity.y = (body.velocity.y < 0 ? -1 : 1) * 70
        body.velocity.normalize().scale(ball.runtime.speedOverride ?? speed)
      }
      ball.sprite.setFillStyle(ballColorForElements(effectiveBallElements(ball)))
      ball.sprite.setStrokeStyle(2, 0xffffff, 0.9)
      ball.label.setText('')
      ball.label.setPosition(ball.sprite.x, ball.sprite.y)
    }
  }

  commitPositions(): void {
    for (const ball of this.entities.values()) {
      ball.runtime.previousPosition.set(ball.sprite.x, ball.sprite.y)
      ball.runtime.previousVelocity.copy((ball.sprite.body as Phaser.Physics.Arcade.Body).velocity)
    }
  }

  removeFallen(y: number): number {
    let removed = 0
    for (const ball of [...this.entities.values()]) {
      if (ball.sprite.y <= y) continue
      this.remove(ball)
      removed += 1
    }
    return removed
  }

  remove(ball: BallEntity): void {
    this.entities.delete(ball.sprite)
    this.group.remove(ball.sprite)
    ball.label.destroy()
    ball.sprite.destroy()
  }

  removeAll(): void {
    for (const ball of [...this.entities.values()]) this.remove(ball)
  }

  bounceFromPaddle(ball: BallEntity, paddleX: number, paddleWidth: number, speed: number): void {
    const body = ball.sprite.body as Phaser.Physics.Arcade.Body
    const offset = Phaser.Math.Clamp((ball.sprite.x - paddleX) / (paddleWidth / 2), -1, 1)
    const horizontal = offset * speed * 0.82
    const vertical = -Math.sqrt(Math.max(speed * speed - horizontal * horizontal, speed * speed * 0.3))
    body.setVelocity(horizontal || Phaser.Math.RND.sign() * 70, vertical)
  }

  bounceIfCrossedPaddle(
    ball: BallEntity,
    paddleX: number,
    paddleY: number,
    paddleWidth: number,
    paddleHeight: number,
    speed: number,
  ): boolean {
    const body = ball.sprite.body as Phaser.Physics.Arcade.Body
    if (body.velocity.y <= 0) return false

    const collisionY = paddleY - paddleHeight / 2 - BALL_RADIUS
    const previous = ball.runtime.previousPosition
    const crossingX = sweptPaddleCrossingX(
      previous,
      { x: ball.sprite.x, y: ball.sprite.y },
      collisionY,
      paddleX,
      paddleWidth,
      BALL_RADIUS,
    )
    if (crossingX === undefined) return false

    ball.sprite.setPosition(crossingX, collisionY - 0.5)
    ball.label.setPosition(ball.sprite.x, ball.sprite.y)
    body.updateFromGameObject()
    this.bounceFromPaddle(ball, paddleX, paddleWidth, speed)
    return true
  }
}
