import { describe, expect, it } from 'vitest'
import {
  ballSpeedForElapsedSeconds,
  ballColorForAttack,
  brickRowsForWave,
  difficultyForWave,
  hpCapForWave,
  maxHpForWave,
  launchAngleForAim,
  missingBallCount,
  minHpForWave,
  randomBrickHp,
  readHighScore,
  rayRectangleDistance,
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

  it('uses wave-based hp bounds with a dynamic squared cap', () => {
    expect(difficultyForWave(1)).toBe(1)
    expect(difficultyForWave(7)).toBe(1)
    expect(difficultyForWave(8)).toBe(2)
    expect(hpCapForWave(1)).toBe(2)
    expect(hpCapForWave(8)).toBe(68)
    expect(minHpForWave(1)).toBe(1)
    expect(maxHpForWave(1)).toBe(2)
    expect(minHpForWave(5)).toBe(2)
    expect(maxHpForWave(5)).toBe(8)
    expect(minHpForWave(6)).toBe(3)
    expect(maxHpForWave(6)).toBe(9)
    expect(minHpForWave(7)).toBe(4)
    expect(maxHpForWave(7)).toBe(10)
    expect(minHpForWave(8)).toBe(5)
    expect(maxHpForWave(8)).toBe(22)
    expect(minHpForWave(100)).toBe(97)
    expect(maxHpForWave(100)).toBe(9682)
  })

  it('generates hp within the current wave range', () => {
    expect(randomBrickHp(1, () => 0)).toBe(1)
    expect(randomBrickHp(1, () => 0.999)).toBe(2)
    expect(randomBrickHp(7, () => 0)).toBe(4)
    expect(randomBrickHp(7, () => 0.999)).toBe(10)
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

  it('limits player-selected launch direction to a small angle', () => {
    expect(launchAngleForAim(-1)).toBe(-118)
    expect(launchAngleForAim(0)).toBe(-90)
    expect(launchAngleForAim(1)).toBe(-62)
    expect(launchAngleForAim(99)).toBe(-62)
  })

  it('only replenishes the deficit below the run starting-ball count', () => {
    expect(missingBallCount(0, 1)).toBe(1)
    expect(missingBallCount(1, 1)).toBe(0)
    expect(missingBallCount(2, 4)).toBe(2)
    expect(missingBallCount(8, 4)).toBe(0)
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

  it('finds the first rectangle intersected by a directional fire ray', () => {
    expect(rayRectangleDistance(
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 0, y: 10, width: 4, height: 4 },
    )).toBe(8)
    expect(rayRectangleDistance(
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 10, width: 4, height: 4 },
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
