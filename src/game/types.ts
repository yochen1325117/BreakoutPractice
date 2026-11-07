export enum GameState {
  READY = 'READY',
  PLAYING = 'PLAYING',
  WAVE_CLEAR = 'WAVE_CLEAR',
  REWARD_SELECT = 'REWARD_SELECT',
  PLATFORM_PLACEMENT = 'PLATFORM_PLACEMENT',
  GAME_OVER = 'GAME_OVER',
}

export type BallFormId = 'normal'
export type BallElementId = 'neutral' | 'fire'
export type PlatformType = 'attack' | 'split' | 'fire'

export interface PlayerBallBuild {
  baseAttack: number
  formId: BallFormId
  elementId: BallElementId
  modifierIds: string[]
}

export interface BallBuildSnapshot extends PlayerBallBuild {}

export interface BallHitEffectContext {
  ball: BallEntity
  brick: BrickView
  damage: number
  destroyed: boolean
}

export type BallHitEffectHook = (context: BallHitEffectContext) => void

export interface BallFormDefinition {
  id: BallFormId
  name: string
  onHit?: BallHitEffectHook
}

export interface BallElementDefinition {
  id: BallElementId
  name: string
  onHit?: BallHitEffectHook
}

export interface BallRuntimeState {
  nextHitBonus: number
  nextHitElementId: BallElementId
  previousPosition: Phaser.Math.Vector2
  previousVelocity: Phaser.Math.Vector2
  insidePlatformIds: Set<string>
}

export interface BallEntity {
  id: string
  sprite: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  build: BallBuildSnapshot
  runtime: BallRuntimeState
}

export interface OwnedPlatform {
  id: string
  type: PlatformType
  isPlaced: boolean
  x?: number
  y?: number
}

export interface GameSession {
  score: number
  highScore: number
  wave: number
  elapsedPlaySeconds: number
  ballBuild: PlayerBallBuild
  ownedPlatforms: OwnedPlatform[]
  paddleWidth: number
  startingBallCount: number
}

export interface BrickData {
  hp: number
  maxHp: number
  row: number
  column: number
  lastHitAt: number
}

export interface BrickView {
  shape: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  data: BrickData
}

export type RewardOption =
  | { type: 'permanent-attack'; amount: 1 }
  | { type: 'platform'; platformType: PlatformType }
  | { type: 'paddle-width'; amount: number }
  | { type: 'starting-ball'; amount: 1 }

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
