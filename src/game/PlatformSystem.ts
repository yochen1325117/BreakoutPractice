import Phaser from 'phaser'
import { DANGER_LINE_Y, updateSensorMembership } from './rules'
import type { BallEntity, OwnedPlatform } from './types'

const PLATFORM_WIDTH = 100
const PLATFORM_HEIGHT = 8
const MIN_X = 60
const MAX_X = 420
const MIN_Y = 100
const MAX_Y = DANGER_LINE_Y - 12

interface PlatformView {
  shape: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
}

export interface PlatformTriggerHandlers {
  onAttack(ball: BallEntity): void
  onSplit(ball: BallEntity, platformId: string): void
  onFire(ball: BallEntity): void
}

export class PlatformSystem {
  private readonly views = new Map<string, PlatformView>()
  private placementMode = false
  private selectedId?: string
  private dragOrigin?: Phaser.Math.Vector2
  private onSelectionChanged?: () => void

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly platforms: OwnedPlatform[],
  ) {
    scene.input.on('dragstart', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      if (!this.placementMode) return
      const platform = this.platformForObject(object)
      if (!platform) return
      const shape = object as Phaser.GameObjects.Rectangle
      this.selectedId = platform.id
      this.dragOrigin = new Phaser.Math.Vector2(platform.x ?? shape.x, platform.y ?? shape.y)
      this.onSelectionChanged?.()
    })
    scene.input.on('drag', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      if (!this.placementMode) return
      const platform = this.platformForObject(object)
      if (!platform) return
      const view = this.views.get(platform.id)
      if (!view) return
      platform.x = Phaser.Math.Clamp(dragX, MIN_X, MAX_X)
      platform.y = Phaser.Math.Clamp(dragY, MIN_Y, MAX_Y)
      view.shape.setPosition(platform.x, platform.y)
      view.label.setPosition(platform.x, platform.y)
      view.shape.setFillStyle(this.isValid(platform) ? this.color(platform) : 0xff4057, 0.9)
    })
    scene.input.on('dragend', (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      if (!this.placementMode) return
      const platform = this.platformForObject(object)
      if (!platform || this.isValid(platform)) return
      platform.x = this.dragOrigin?.x ?? platform.x
      platform.y = this.dragOrigin?.y ?? platform.y
      this.syncViews()
    })
  }

  get totalCount(): number { return this.platforms.length }
  get placedCount(): number { return this.platforms.filter((item) => item.isPlaced).length }
  get selected(): OwnedPlatform | undefined { return this.platforms.find((item) => item.id === this.selectedId) }

  syncViews(): void {
    const ids = new Set(this.platforms.map((item) => item.id))
    for (const [id, view] of this.views) {
      if (ids.has(id)) continue
      view.shape.destroy()
      view.label.destroy()
      this.views.delete(id)
    }

    for (const platform of this.platforms) {
      let view = this.views.get(platform.id)
      if (!view) {
        const shape = this.scene.add.rectangle(0, 0, PLATFORM_WIDTH, PLATFORM_HEIGHT, this.color(platform), 0.9).setStrokeStyle(2, 0xffffff, 0.55).setDepth(3)
        const platformLabel = platform.type === 'attack' ? '+1' : platform.type === 'split' ? '×2' : '火'
        const label = this.scene.add.text(0, 0, platformLabel, {
          fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(0.5).setDepth(4)
        shape.setData('platformId', platform.id)
        shape.on('pointerdown', () => {
          if (!this.placementMode) return
          this.selectedId = platform.id
          this.onSelectionChanged?.()
        })
        view = { shape, label }
        this.views.set(platform.id, view)
      }
      const visible = platform.isPlaced && platform.x !== undefined && platform.y !== undefined
      view.shape.setVisible(visible)
      view.label.setVisible(visible)
      if (visible) {
        view.shape.setPosition(platform.x!, platform.y!).setFillStyle(this.color(platform), 0.9)
        view.label.setPosition(platform.x!, platform.y!)
      }
      if (this.placementMode) {
        view.shape.setInteractive({ useHandCursor: true, draggable: true })
        this.scene.input.setDraggable(view.shape)
      } else {
        view.shape.disableInteractive()
      }
    }
  }

  beginPlacement(onSelectionChanged: () => void): void {
    this.placementMode = true
    this.onSelectionChanged = onSelectionChanged
    this.selectedId = this.platforms.at(-1)?.id ?? this.platforms[0]?.id
    this.syncViews()
    for (const view of this.views.values()) {
      view.shape.setDepth(45)
      view.label.setDepth(46)
    }
  }

  endPlacement(): void {
    this.placementMode = false
    this.onSelectionChanged = undefined
    this.selectedId = undefined
    this.syncViews()
    for (const view of this.views.values()) {
      view.shape.setDepth(3)
      view.label.setDepth(4)
    }
  }

  cycleSelection(direction: number): void {
    if (this.platforms.length === 0) return
    const current = Math.max(0, this.platforms.findIndex((item) => item.id === this.selectedId))
    const next = (current + direction + this.platforms.length) % this.platforms.length
    this.selectedId = this.platforms[next]?.id
    this.onSelectionChanged?.()
  }

  toggleSelectedPlacement(): boolean {
    const platform = this.selected
    if (!platform) return false
    if (platform.isPlaced) {
      platform.isPlaced = false
      this.syncViews()
      this.onSelectionChanged?.()
      return true
    }
    const position = this.findOpenPosition(platform)
    if (!position) return false
    platform.isPlaced = true
    platform.x = position.x
    platform.y = position.y
    this.syncViews()
    this.onSelectionChanged?.()
    return true
  }

  deleteSelected(): void {
    const index = this.platforms.findIndex((item) => item.id === this.selectedId)
    if (index < 0) return
    this.platforms.splice(index, 1)
    this.selectedId = this.platforms[Math.min(index, this.platforms.length - 1)]?.id
    this.syncViews()
    this.onSelectionChanged?.()
  }

  allPlacementsValid(): boolean {
    return this.platforms.filter((item) => item.isPlaced).every((item) => this.isValid(item))
  }

  processBalls(balls: BallEntity[], handlers: PlatformTriggerHandlers): void {
    const placed = this.platforms.filter((item) => item.isPlaced && item.x !== undefined && item.y !== undefined)
    const placedById = new Map(placed.map((platform) => [platform.id, platform]))
    for (const ball of [...balls]) {
      const crossedIds: string[] = []
      for (const platform of placed) {
        const rect = new Phaser.Geom.Rectangle(platform.x! - PLATFORM_WIDTH / 2, platform.y! - 10, PLATFORM_WIDTH, 20)
        const line = new Phaser.Geom.Line(ball.runtime.previousPosition.x, ball.runtime.previousPosition.y, ball.sprite.x, ball.sprite.y)
        const crossed = Phaser.Geom.Intersects.LineToRectangle(line, rect) || rect.contains(ball.sprite.x, ball.sprite.y)
        if (crossed) crossedIds.push(platform.id)
      }
      const enteredIds = updateSensorMembership(ball.runtime.insidePlatformIds, crossedIds)
      for (const platformId of enteredIds) {
        const platform = placedById.get(platformId)
        if (!platform) continue
        if (platform.type === 'attack') handlers.onAttack(ball)
        else if (platform.type === 'split') handlers.onSplit(ball, platform.id)
        else handlers.onFire(ball)
      }
    }
  }

  private isValid(platform: OwnedPlatform): boolean {
    if (!platform.isPlaced || platform.x === undefined || platform.y === undefined) return true
    return platform.x >= MIN_X && platform.x <= MAX_X && platform.y >= MIN_Y && platform.y <= MAX_Y
  }

  private findOpenPosition(platform: OwnedPlatform): { x: number; y: number } | undefined {
    platform.isPlaced = true
    platform.x = 240
    platform.y = DANGER_LINE_Y - 42
    return { x: platform.x, y: platform.y }
  }

  private platformForObject(object: Phaser.GameObjects.GameObject): OwnedPlatform | undefined {
    const id = object.getData('platformId') as string | undefined
    return this.platforms.find((item) => item.id === id)
  }

  private color(platform: OwnedPlatform): number {
    if (platform.type === 'attack') return 0xffb23d
    if (platform.type === 'split') return 0xff4fb7
    return 0xff5a36
  }
}
