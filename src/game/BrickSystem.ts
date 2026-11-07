import Phaser from 'phaser'
import { brickRowsForWave, randomBrickHp, rayRectangleDistance } from './rules'
import type { BrickView } from './types'

const WIDTH = 480
const COLUMNS = 7
const BRICK_WIDTH = 58
const BRICK_HEIGHT = 35
const GAP = 7
const TOP = 160

export class BrickSystem {
  readonly group: Phaser.Physics.Arcade.Group
  private readonly views = new Map<Phaser.GameObjects.Rectangle, BrickView>()

  constructor(private readonly scene: Phaser.Scene) {
    this.group = scene.physics.add.group({ allowGravity: false, immovable: true })
  }

  get count(): number { return this.views.size }

  createWave(wave: number): void {
    this.clear()
    const totalWidth = COLUMNS * BRICK_WIDTH + (COLUMNS - 1) * GAP
    const startX = (WIDTH - totalWidth) / 2 + BRICK_WIDTH / 2
    for (let row = 0; row < brickRowsForWave(wave); row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const hp = randomBrickHp(wave)
        const x = startX + column * (BRICK_WIDTH + GAP)
        const y = TOP + row * (BRICK_HEIGHT + GAP)
        const shape = this.scene.add.rectangle(x, y, BRICK_WIDTH, BRICK_HEIGHT, this.colorForHp(hp)).setStrokeStyle(2, 0xffffff, 0.42)
        const label = this.scene.add.text(x, y, String(hp), {
          fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(0.5)
        this.scene.physics.add.existing(shape)
        this.group.add(shape)
        const body = shape.body as Phaser.Physics.Arcade.Body
        body.setAllowGravity(false)
        body.setImmovable(true)
        this.views.set(shape, { shape, label, data: { hp, maxHp: hp, row, column, lastHitAt: -1000 } })
      }
    }
  }

  get(shape: Phaser.GameObjects.GameObject): BrickView | undefined {
    return this.views.get(shape as Phaser.GameObjects.Rectangle)
  }

  updateDescent(delta: number, speed: number): void {
    const movement = speed * delta / 1000
    for (const brick of this.views.values()) {
      brick.shape.y += movement
      brick.label.y = brick.shape.y
      ;(brick.shape.body as Phaser.Physics.Arcade.Body).updateFromGameObject()
    }
  }

  hasCrossed(y: number): boolean {
    for (const brick of this.views.values()) {
      if (brick.shape.y + BRICK_HEIGHT / 2 >= y) return true
    }
    return false
  }

  updateView(brick: BrickView): void {
    brick.label.setText(String(brick.data.hp))
    brick.shape.setFillStyle(this.colorForHp(brick.data.hp))
  }

  findNextAlongDirection(primary: BrickView, direction: Phaser.Math.Vector2): BrickView | undefined {
    let closest: BrickView | undefined
    let closestDistance = Number.POSITIVE_INFINITY
    const origin = { x: primary.shape.x, y: primary.shape.y }
    for (const candidate of this.views.values()) {
      if (candidate === primary) continue
      const distance = rayRectangleDistance(origin, direction, {
        x: candidate.shape.x,
        y: candidate.shape.y,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
      })
      if (distance === undefined || distance <= 0 || distance >= closestDistance) continue
      closest = candidate
      closestDistance = distance
    }
    return closest
  }

  findHorizontalNeighbors(primary: BrickView): BrickView[] {
    const columns = new Set([primary.data.column - 1, primary.data.column + 1])
    return [...this.views.values()].filter((candidate) =>
      candidate.data.row === primary.data.row && columns.has(candidate.data.column),
    )
  }

  destroy(brick: BrickView): void {
    this.views.delete(brick.shape)
    this.group.remove(brick.shape)
    brick.label.destroy()
    brick.shape.destroy()
  }

  clear(): void {
    for (const brick of [...this.views.values()]) this.destroy(brick)
  }

  private colorForHp(hp: number): number {
    if (hp <= 2) return 0x19ddeb
    if (hp <= 5) return 0x7b61ff
    if (hp <= 9) return 0xff4fb7
    if (hp <= 14) return 0xff8a3d
    return 0xff4057
  }
}
