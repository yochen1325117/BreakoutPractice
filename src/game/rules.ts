import type { ActiveBallElementId, BallEntity, PlayerBallBuild, StorageLike } from './types'

export const MAX_BRICK_ROWS = 6
export const INITIAL_BALL_SPEED = 600
export const BALL_SPEED_PER_SECOND = 2
export const MAX_BALL_SPEED = 900
export const BRICK_DESCENT_SPEED = 2
export const DANGER_LINE_Y = 650
export const MAX_PADDLE_WIDTH = 480 * 0.7
export const MAX_PLATFORM_WIDTH = 420

export const BALL_ELEMENT_COLORS: Record<ActiveBallElementId, number> = {
  fire: 0xff6a32,
  water: 0x43b7ff,
  wind: 0x64f0a5,
  electric: 0xffe45c,
}
export const NEUTRAL_BALL_COLOR = 0xeafcff
const BALL_ELEMENT_ORDER: ActiveBallElementId[] = ['fire', 'water', 'wind', 'electric']

export function uniqueElements(elements: Iterable<ActiveBallElementId>): ActiveBallElementId[] {
  const values = new Set(elements)
  return BALL_ELEMENT_ORDER.filter((element) => values.has(element))
}

export function effectiveBallElements(ball: Pick<BallEntity, 'build' | 'runtime'>): ActiveBallElementId[] {
  return uniqueElements([...ball.build.elementIds, ...ball.runtime.nextHitElementIds])
}

export function activeElementsForBalls(
  balls: readonly Pick<BallEntity, 'build' | 'runtime'>[],
  fallback: Iterable<ActiveBallElementId> = [],
): ActiveBallElementId[] {
  return uniqueElements([...fallback, ...balls.flatMap((ball) => effectiveBallElements(ball))])
}

export function attackRangeForBalls(
  balls: readonly Pick<BallEntity, 'build' | 'runtime'>[],
  fallbackAttack: number,
): [number, number] {
  const attacks = balls.map((ball) => ball.build.baseAttack + ball.runtime.nextHitBonus)
  return attacks.length === 0
    ? [fallbackAttack, fallbackAttack]
    : [Math.min(...attacks), Math.max(...attacks)]
}

export function ballColorForElements(elements: Iterable<ActiveBallElementId>): number {
  const unique = uniqueElements(elements)
  if (unique.length === 0) return NEUTRAL_BALL_COLOR
  const channelAverage = (shift: number) => Math.round(
    unique.reduce((sum, element) => sum + ((BALL_ELEMENT_COLORS[element] >> shift) & 0xff), 0) / unique.length,
  )
  return (channelAverage(16) << 16) | (channelAverage(8) << 8) | channelAverage(0)
}

export function brickRowsForWave(wave: number): number {
  return Math.min(MAX_BRICK_ROWS, Math.max(1, Math.floor(wave)))
}

export function minHpForWave(wave: number): number {
  const normalizedWave = Math.max(1, Math.floor(wave))
  return Math.min(hpCapForWave(normalizedWave), Math.max(1, normalizedWave - 3))
}

export function difficultyForWave(wave: number): number {
  const normalizedWave = Math.max(1, Math.floor(wave))
  return Math.max(1, normalizedWave - 6)
}

export function hpCapForWave(wave: number): number {
  const normalizedWave = Math.max(1, Math.floor(wave))
  const difficulty = difficultyForWave(normalizedWave)
  return normalizedWave ** 2 + difficulty ** 2
}

export function maxHpForWave(wave: number): number {
  const normalizedWave = Math.max(1, Math.floor(wave))
  const difficulty = difficultyForWave(normalizedWave)
  return Math.min(hpCapForWave(normalizedWave), (normalizedWave + 3) * difficulty)
}

export function randomBrickHp(wave: number, random = Math.random): number {
  const minimum = minHpForWave(wave)
  const maximum = maxHpForWave(wave)
  return Math.floor(random() * (maximum - minimum + 1)) + minimum
}

export function ballSpeedForElapsedSeconds(elapsedSeconds: number): number {
  return Math.min(
    MAX_BALL_SPEED,
    INITIAL_BALL_SPEED + Math.floor(Math.max(0, elapsedSeconds)) * BALL_SPEED_PER_SECOND,
  )
}

export function scoreForBrickDestroyed(score: number, maxHp: number): number {
  return score + Math.max(0, Math.floor(maxHp)) * 10
}

export function scoreForWaveClear(score: number, wave: number): number {
  return score + 100 * wave
}

export function launchAngleForAim(aimOffset: number): number {
  return -90 + Math.min(1, Math.max(-1, aimOffset)) * 28
}

export function missingBallCount(currentCount: number, startingBallCount: number): number {
  return Math.max(0, Math.floor(startingBallCount) - Math.max(0, Math.floor(currentCount)))
}

export function electricChainDamage(attack: number): number {
  return Math.max(1, Math.floor(Math.max(0, attack) / 2))
}

export interface TargetDamage<T> { target: T; damage: number }

export function mergeTargetDamage<T>(intents: Iterable<TargetDamage<T>>): Map<T, number> {
  const merged = new Map<T, number>()
  for (const { target, damage } of intents) {
    merged.set(target, Math.max(merged.get(target) ?? 0, damage))
  }
  return merged
}

export function pickRandomDistinct<T>(items: readonly T[], count: number, random = Math.random): T[] {
  const available = [...items]
  const picked: T[] = []
  const total = Math.min(available.length, Math.max(0, Math.floor(count)))
  while (picked.length < total) {
    const index = Math.min(available.length - 1, Math.floor(random() * available.length))
    picked.push(available.splice(index, 1)[0]!)
  }
  return picked
}

export interface TemporaryElementState { nextHitElementIds: Set<ActiveBallElementId>; speedOverride?: number }

export function inheritTemporaryElement(source: TemporaryElementState, target: TemporaryElementState): void {
  target.nextHitElementIds = new Set(source.nextHitElementIds)
  target.speedOverride = source.speedOverride
}

export interface SplitInheritableState {
  build: PlayerBallBuild
  runtime: TemporaryElementState & { nextHitBonus: number }
}

export function inheritSplitState(source: SplitInheritableState, target: SplitInheritableState): void {
  target.build.baseAttack = source.build.baseAttack
  target.build.formId = source.build.formId
  target.build.elementIds = [...source.build.elementIds]
  target.build.modifierIds = [...source.build.modifierIds]
  target.runtime.nextHitBonus = source.runtime.nextHitBonus
  inheritTemporaryElement(source.runtime, target.runtime)
}

export interface PlacementRect { x: number; y: number; width: number; height: number }

export function rectanglesOverlap(a: PlacementRect, b: PlacementRect, gap = 0): boolean {
  return !(
    a.x + a.width / 2 + gap <= b.x - b.width / 2 ||
    a.x - a.width / 2 - gap >= b.x + b.width / 2 ||
    a.y + a.height / 2 + gap <= b.y - b.height / 2 ||
    a.y - a.height / 2 - gap >= b.y + b.height / 2
  )
}

export interface PointLike { x: number; y: number }
export interface CenteredRectLike { x: number; y: number; width: number; height: number }

export function rayRectangleDistance(
  origin: PointLike,
  direction: PointLike,
  rectangle: CenteredRectLike,
): number | undefined {
  const magnitude = Math.hypot(direction.x, direction.y)
  if (magnitude === 0) return undefined
  const dx = direction.x / magnitude
  const dy = direction.y / magnitude
  const left = rectangle.x - rectangle.width / 2
  const right = rectangle.x + rectangle.width / 2
  const top = rectangle.y - rectangle.height / 2
  const bottom = rectangle.y + rectangle.height / 2
  let minimum = 0
  let maximum = Number.POSITIVE_INFINITY

  const updateRange = (originValue: number, directionValue: number, low: number, high: number): boolean => {
    if (Math.abs(directionValue) < 1e-8) return originValue >= low && originValue <= high
    const first = (low - originValue) / directionValue
    const second = (high - originValue) / directionValue
    minimum = Math.max(minimum, Math.min(first, second))
    maximum = Math.min(maximum, Math.max(first, second))
    return maximum >= minimum
  }

  if (!updateRange(origin.x, dx, left, right)) return undefined
  if (!updateRange(origin.y, dy, top, bottom)) return undefined
  return maximum >= 0 ? Math.max(0, minimum) : undefined
}

export function sweptPaddleCrossingX(
  previous: PointLike,
  current: PointLike,
  collisionY: number,
  paddleX: number,
  paddleWidth: number,
  ballRadius: number,
): number | undefined {
  if (previous.y > collisionY || current.y < collisionY || current.y === previous.y) return undefined
  const progress = Math.min(1, Math.max(0, (collisionY - previous.y) / (current.y - previous.y)))
  const crossingX = previous.x + (current.x - previous.x) * progress
  return Math.abs(crossingX - paddleX) <= paddleWidth / 2 + ballRadius ? crossingX : undefined
}

export function updateSensorMembership(insideIds: Set<string>, crossedIds: readonly string[]): string[] {
  const crossed = new Set(crossedIds)
  const entered: string[] = []

  for (const id of crossed) {
    if (insideIds.has(id)) continue
    insideIds.add(id)
    entered.push(id)
  }
  for (const id of [...insideIds]) {
    if (!crossed.has(id)) insideIds.delete(id)
  }
  return entered
}

const HIGH_SCORE_KEY = 'breakout-practice-high-score'

export function readHighScore(storage?: StorageLike): number {
  try {
    const value = Number(storage?.getItem(HIGH_SCORE_KEY) ?? 0)
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  } catch {
    return 0
  }
}

export function saveHighScore(score: number, storage?: StorageLike): void {
  try {
    storage?.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))))
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
