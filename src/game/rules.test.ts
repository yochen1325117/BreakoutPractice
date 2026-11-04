import { describe, expect, it } from 'vitest'
import {
  ballSpeedForWave,
  loseLife,
  maxHpForWave,
  randomBrickHp,
  readHighScore,
  saveHighScore,
  scoreForHit,
  scoreForWaveClear,
  type StorageLike,
} from './rules'
import type { GameSession } from './types'

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('breakout rules', () => {
  it('increases max brick hp each wave and caps it at 20', () => {
    expect(maxHpForWave(1)).toBe(5)
    expect(maxHpForWave(2)).toBe(6)
    expect(maxHpForWave(100)).toBe(20)
  })

  it('generates hp within the current wave range', () => {
    expect(randomBrickHp(1, () => 0)).toBe(1)
    expect(randomBrickHp(1, () => 0.999)).toBe(5)
    expect(randomBrickHp(4, () => 0.999)).toBe(8)
  })

  it('increases and caps ball speed', () => {
    expect(ballSpeedForWave(1)).toBe(360)
    expect(ballSpeedForWave(4)).toBe(420)
    expect(ballSpeedForWave(100)).toBe(650)
  })

  it('scores hits and wave clears', () => {
    expect(scoreForHit(40)).toBe(50)
    expect(scoreForWaveClear(50, 3)).toBe(350)
  })

  it('decrements lives without going below zero', () => {
    const base: GameSession = { score: 0, highScore: 0, lives: 1, wave: 1 }
    expect(loseLife(base).lives).toBe(0)
    expect(loseLife({ ...base, lives: 0 }).lives).toBe(0)
  })

  it('persists high score and tolerates invalid stored values', () => {
    const storage = new MemoryStorage()
    saveHighScore(123.9, storage)
    expect(readHighScore(storage)).toBe(123)
    storage.setItem('breakout-practice-high-score', 'not-a-number')
    expect(readHighScore(storage)).toBe(0)
  })
})
