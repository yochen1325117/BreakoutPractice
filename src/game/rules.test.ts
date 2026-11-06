import { describe, expect, it } from 'vitest'
import {
  ballSpeedForElapsedSeconds,
  brickRowsForWave,
  loseLife,
  maxHpForWave,
  minHpForWave,
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
  it('adds one brick row per wave and caps the layout at six rows', () => {
    expect(brickRowsForWave(1)).toBe(1)
    expect(brickRowsForWave(3)).toBe(3)
    expect(brickRowsForWave(6)).toBe(6)
    expect(brickRowsForWave(20)).toBe(6)
  })

  it('keeps hp at 1–3 through wave three, then raises both bounds', () => {
    expect(minHpForWave(1)).toBe(1)
    expect(maxHpForWave(1)).toBe(3)
    expect(minHpForWave(3)).toBe(1)
    expect(maxHpForWave(3)).toBe(3)
    expect(minHpForWave(4)).toBe(2)
    expect(maxHpForWave(4)).toBe(5)
    expect(minHpForWave(6)).toBe(4)
    expect(maxHpForWave(6)).toBe(9)
    expect(minHpForWave(100)).toBe(20)
    expect(maxHpForWave(100)).toBe(20)
  })

  it('generates hp within the current wave range', () => {
    expect(randomBrickHp(1, () => 0)).toBe(1)
    expect(randomBrickHp(1, () => 0.999)).toBe(3)
    expect(randomBrickHp(4, () => 0)).toBe(2)
    expect(randomBrickHp(4, () => 0.999)).toBe(5)
  })

  it('increases ball speed once per playing second and caps it', () => {
    expect(ballSpeedForElapsedSeconds(0)).toBe(300)
    expect(ballSpeedForElapsedSeconds(0.99)).toBe(300)
    expect(ballSpeedForElapsedSeconds(1)).toBe(301)
    expect(ballSpeedForElapsedSeconds(60)).toBe(360)
    expect(ballSpeedForElapsedSeconds(999)).toBe(520)
  })

  it('scores hits and wave clears', () => {
    expect(scoreForHit(40)).toBe(50)
    expect(scoreForWaveClear(50, 3)).toBe(350)
  })

  it('decrements lives without going below zero', () => {
    const base: GameSession = {
      score: 0,
      highScore: 0,
      lives: 1,
      wave: 1,
      elapsedPlaySeconds: 0,
      ballAttack: 1,
    }
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
