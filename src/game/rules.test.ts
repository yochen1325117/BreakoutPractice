import { describe, expect, it } from 'vitest'
import {
  activeElementsForBalls,
  attackRangeForBalls,
  ballSpeedForElapsedSeconds,
  ballColorForElements,
  brickRowsForWave,
  difficultyForWave,
  electricChainDamage,
  hpCapForWave,
  inheritSplitState,
  maxHpForWave,
  mergeTargetDamage,
  launchAngleForAim,
  missingBallCount,
  minHpForWave,
  pickRandomDistinct,
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
import type { ActiveBallElementId, StorageLike } from './types'

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
    expect(ballSpeedForElapsedSeconds(0)).toBe(600)
    expect(ballSpeedForElapsedSeconds(1)).toBe(602)
    expect(ballSpeedForElapsedSeconds(150)).toBe(900)
    expect(ballSpeedForElapsedSeconds(999)).toBe(900)
  })

  it('colors balls from their unique active elements and averages multiple colors', () => {
    expect(ballColorForElements([])).toBe(0xeafcff)
    expect(ballColorForElements(['fire'])).toBe(0xff6a32)
    expect(ballColorForElements(['fire', 'water'])).toBe(0xa19199)
    expect(ballColorForElements(['water', 'fire', 'fire'])).toBe(0xa19199)
  })

  it('summarizes active ball attack ranges and element unions for the HUD', () => {
    const balls = [
      { build: { baseAttack: 2, elementIds: ['fire'] }, runtime: { nextHitBonus: 0, nextHitElementIds: new Set(['water']) } },
      { build: { baseAttack: 2, elementIds: [] }, runtime: { nextHitBonus: 3, nextHitElementIds: new Set(['electric']) } },
    ] as unknown as import('./types').BallEntity[]
    expect(attackRangeForBalls(balls, 1)).toEqual([2, 5])
    expect(activeElementsForBalls(balls, ['wind'])).toEqual(['fire', 'water', 'wind', 'electric'])
    expect(attackRangeForBalls([], 4)).toEqual([4, 4])
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

  it('copies permanent and temporary stats to a split ball without sharing arrays or element sets', () => {
    const source = {
      build: { baseAttack: 7, formId: 'normal' as const, elementIds: ['fire'] as ActiveBallElementId[], modifierIds: ['charged'] },
      runtime: { nextHitBonus: 4, nextHitElementIds: new Set<ActiveBallElementId>(['water', 'wind']), speedOverride: 520 },
    }
    const target = {
      build: { baseAttack: 1, formId: 'normal' as const, elementIds: [] as ('fire' | 'water' | 'wind' | 'electric')[], modifierIds: [] as string[] },
      runtime: { nextHitBonus: 0, nextHitElementIds: new Set<'fire' | 'water' | 'wind' | 'electric'>(), speedOverride: undefined as number | undefined },
    }
    inheritSplitState(source, target)
    expect(target).toEqual({
      build: { baseAttack: 7, formId: 'normal', elementIds: ['fire'], modifierIds: ['charged'] },
      runtime: { nextHitBonus: 4, nextHitElementIds: new Set(['water', 'wind']), speedOverride: 520 },
    })
    source.build.modifierIds.push('source-only')
    source.runtime.nextHitElementIds.add('electric')
    expect(target.build.modifierIds).toEqual(['charged'])
    expect([...target.runtime.nextHitElementIds]).toEqual(['water', 'wind'])
  })

  it('halves electric chain damage with a minimum of one', () => {
    expect(electricChainDamage(1)).toBe(1)
    expect(electricChainDamage(3)).toBe(1)
    expect(electricChainDamage(4)).toBe(2)
    expect(electricChainDamage(11)).toBe(5)
  })

  it('applies only the highest secondary damage when effects share a target', () => {
    const shared = { id: 'shared' }
    const electricOnly = { id: 'electric' }
    expect([...mergeTargetDamage([
      { target: shared, damage: 2 },
      { target: shared, damage: 5 },
      { target: electricOnly, damage: 2 },
    ])]).toEqual([[shared, 5], [electricOnly, 2]])
  })

  it('picks distinct random chain targets without replacement', () => {
    const values = [0.99, 0]
    expect(pickRandomDistinct(['a', 'b', 'c'], 2, () => values.shift() ?? 0)).toEqual(['c', 'a'])
    expect(pickRandomDistinct(['a'], 2, () => 0)).toEqual(['a'])
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
