import { describe, expect, it } from 'vitest'
import {
  ballSpeedForElapsedSeconds,
  ballColorForAttack,
  brickRowsForWave,
  maxHpForWave,
  launchAngleForAim,
  minHpForWave,
  randomBrickHp,
  randomPlatformType,
  readHighScore,
  rectanglesOverlap,
  saveHighScore,
  scoreForBrickDestroyed,
  scoreForWaveClear,
  sweptPaddleCrossingX,
  updateSensorMembership,
} from './rules'
import type { StorageLike } from './types'

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

describe('breakout rules', () => {
  it('adds one brick row per wave and caps the layout at six rows', () => {
    expect(brickRowsForWave(1)).toBe(1)
    expect(brickRowsForWave(3)).toBe(3)
    expect(brickRowsForWave(6)).toBe(6)
    expect(brickRowsForWave(20)).toBe(6)
  })

  it('uses wave-based minimum hp and a smoother difficulty multiplier', () => {
    expect(minHpForWave(1)).toBe(1)
    expect(maxHpForWave(1)).toBe(4)
    expect(minHpForWave(5)).toBe(2)
    expect(maxHpForWave(5)).toBe(8)
    expect(minHpForWave(6)).toBe(3)
    expect(maxHpForWave(6)).toBe(9)
    expect(minHpForWave(7)).toBe(4)
    expect(maxHpForWave(7)).toBe(13)
    expect(minHpForWave(8)).toBe(5)
    expect(maxHpForWave(8)).toBe(17)
    expect(maxHpForWave(9)).toBe(20)
    expect(minHpForWave(100)).toBe(20)
    expect(maxHpForWave(100)).toBe(20)
  })

  it('generates hp within the current wave range', () => {
    expect(randomBrickHp(1, () => 0)).toBe(1)
    expect(randomBrickHp(1, () => 0.999)).toBe(4)
    expect(randomBrickHp(7, () => 0)).toBe(4)
    expect(randomBrickHp(7, () => 0.999)).toBe(13)
  })

  it('increases ball speed once per playing second and caps it', () => {
    expect(ballSpeedForElapsedSeconds(0)).toBe(400)
    expect(ballSpeedForElapsedSeconds(1)).toBe(402)
    expect(ballSpeedForElapsedSeconds(60)).toBe(520)
    expect(ballSpeedForElapsedSeconds(999)).toBe(520)
  })

  it('maps attack power from light cyan to deep red', () => {
    expect(ballColorForAttack(1)).toBe(0x6df6ff)
    expect(ballColorForAttack(20)).toBe(0x981633)
    expect(ballColorForAttack(999)).toBe(0x981633)
  })

  it('scores only destroyed bricks and wave clears', () => {
    expect(scoreForBrickDestroyed(40, 5)).toBe(90)
    expect(scoreForWaveClear(50, 3)).toBe(350)
  })

  it('prefers split platforms at a 65/35 threshold', () => {
    expect(randomPlatformType(() => 0.349)).toBe('attack')
    expect(randomPlatformType(() => 0.35)).toBe('split')
  })

  it('limits player-selected launch direction to a small angle', () => {
    expect(launchAngleForAim(-1)).toBe(-118)
    expect(launchAngleForAim(0)).toBe(-90)
    expect(launchAngleForAim(1)).toBe(-62)
    expect(launchAngleForAim(99)).toBe(-62)
  })

  it('detects placement overlap with an optional gap', () => {
    const a = { x: 100, y: 100, width: 100, height: 8 }
    expect(rectanglesOverlap(a, { x: 190, y: 100, width: 100, height: 8 })).toBe(true)
    expect(rectanglesOverlap(a, { x: 210, y: 100, width: 100, height: 8 })).toBe(false)
    expect(rectanglesOverlap(a, { x: 205, y: 100, width: 100, height: 8 }, 6)).toBe(true)
  })

  it('catches a ball that crosses the paddle between physics frames', () => {
    expect(sweptPaddleCrossingX(
      { x: 230, y: 710 },
      { x: 250, y: 745 },
      719,
      240,
      108,
      8,
    )).toBeCloseTo(235.14, 1)
    expect(sweptPaddleCrossingX(
      { x: 100, y: 710 },
      { x: 110, y: 745 },
      719,
      240,
      108,
      8,
    )).toBeUndefined()
  })

  it('treats overlapping sensors as one contact set until the ball leaves', () => {
    const inside = new Set<string>()
    expect(updateSensorMembership(inside, ['split-a', 'split-b'])).toEqual(['split-a', 'split-b'])
    expect(updateSensorMembership(inside, ['split-a', 'split-b'])).toEqual([])
    expect([...inside]).toEqual(['split-a', 'split-b'])
    expect(updateSensorMembership(inside, [])).toEqual([])
    expect(inside.size).toBe(0)
    expect(updateSensorMembership(inside, ['split-b'])).toEqual(['split-b'])
  })

  it('persists high score and tolerates invalid stored values', () => {
    const storage = new MemoryStorage()
    saveHighScore(123.9, storage)
    expect(readHighScore(storage)).toBe(123)
    storage.setItem('breakout-practice-high-score', 'not-a-number')
    expect(readHighScore(storage)).toBe(0)
  })
})
