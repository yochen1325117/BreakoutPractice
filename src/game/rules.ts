import type { PlatformType, StorageLike } from './types'

export const MAX_BRICK_HP = 20
export const MAX_BRICK_ROWS = 6
export const INITIAL_BALL_SPEED = 400
export const BALL_SPEED_PER_SECOND = 2
export const MAX_BALL_SPEED = 520
export const BRICK_DESCENT_SPEED = 2
export const DANGER_LINE_Y = 650
export const MAX_PADDLE_WIDTH = 480 * 0.7

const BALL_ATTACK_COLORS = [0x6df6ff, 0x668cff, 0xd85cff, 0xff6655, 0x981633]

export function ballColorForAttack(attack: number): number {
  const normalized = Math.min(1, Math.max(0, (attack - 1) / 19))
  const scaled = normalized * (BALL_ATTACK_COLORS.length - 1)
  const index = Math.min(BALL_ATTACK_COLORS.length - 2, Math.floor(scaled))
  const progress = scaled - index
  const start = BALL_ATTACK_COLORS[index]!
  const end = BALL_ATTACK_COLORS[index + 1]!
  const channel = (shift: number) => {
    const from = (start >> shift) & 0xff
    const to = (end >> shift) & 0xff
    return Math.round(from + (to - from) * progress)
  }
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

export function brickRowsForWave(wave: number): number {
  return Math.min(MAX_BRICK_ROWS, Math.max(1, Math.floor(wave)))
}

export function minHpForWave(wave: number): number {
  return Math.min(MAX_BRICK_HP, Math.max(1, Math.floor(wave) - 3))
}

export function maxHpForWave(wave: number): number {
  const normalizedWave = Math.max(1, Math.floor(wave))
  const difficulty = Math.max(1, normalizedWave - 5)
  return Math.min(MAX_BRICK_HP, normalizedWave + 3 * difficulty)
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

export function randomPlatformType(random = Math.random): PlatformType {
  return random() < 0.35 ? 'attack' : 'split'
}

export function launchAngleForAim(aimOffset: number): number {
  return -90 + Math.min(1, Math.max(-1, aimOffset)) * 28
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
