import type { GameSession } from './types'

export const INITIAL_LIVES = 3
export const INITIAL_MAX_HP = 5
export const MAX_BRICK_HP = 20
export const HIT_SCORE = 10

export function maxHpForWave(wave: number): number {
  return Math.min(MAX_BRICK_HP, INITIAL_MAX_HP + Math.max(0, wave - 1))
}

export function randomBrickHp(wave: number, random = Math.random): number {
  return Math.floor(random() * maxHpForWave(wave)) + 1
}

export function ballSpeedForWave(wave: number): number {
  return Math.min(650, 360 + Math.max(0, wave - 1) * 20)
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
