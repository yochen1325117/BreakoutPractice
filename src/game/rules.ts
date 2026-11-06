import type { GameSession } from './types'

export const INITIAL_LIVES = 3
export const MAX_BRICK_HP = 20
export const MAX_BRICK_ROWS = 6
export const HIT_SCORE = 10
export const INITIAL_BALL_SPEED = 300
export const BALL_SPEED_PER_SECOND = 1
export const MAX_BALL_SPEED = 520

export function brickRowsForWave(wave: number): number {
  return Math.min(MAX_BRICK_ROWS, Math.max(1, Math.floor(wave)))
}

export function minHpForWave(wave: number): number {
  if (wave <= 3) return 1
  return Math.min(MAX_BRICK_HP, 1 + Math.floor(wave - 3))
}

export function maxHpForWave(wave: number): number {
  if (wave <= 3) return 3
  return Math.min(MAX_BRICK_HP, 3 + Math.floor(wave - 3) * 2)
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

export function scoreForHit(score: number): number {
  return score + HIT_SCORE
}

export function scoreForWaveClear(score: number, wave: number): number {
  return score + 100 * wave
}

export function loseLife(session: GameSession): GameSession {
  return { ...session, lives: Math.max(0, session.lives - 1) }
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
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
