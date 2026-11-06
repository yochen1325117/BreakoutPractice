import { describe, expect, it } from 'vitest'
import { DamageResolver } from './DamageResolver'
import { RewardSystem } from './RewardSystem'
import type { BallEntity, BrickView, GameSession } from './types'

function session(): GameSession {
  return {
    score: 0,
    highScore: 0,
    wave: 1,
    elapsedPlaySeconds: 0,
    ballBuild: { baseAttack: 2, formId: 'normal', elementId: 'neutral', modifierIds: [] },
    ownedPlatforms: [],
    paddleWidth: 108,
    startingBallCount: 1,
  }
}

describe('damage resolver', () => {
  it('uses and clears a stacked next-hit bonus', () => {
    const ball = {
      build: { baseAttack: 2, formId: 'normal', elementId: 'neutral', modifierIds: [] },
      runtime: { nextHitBonus: 3 },
    } as unknown as BallEntity
    const brick = { data: { hp: 8, maxHp: 8 } } as unknown as BrickView
    const result = new DamageResolver().resolve(ball, brick)
    expect(result).toEqual({ damage: 5, destroyed: false })
    expect(brick.data.hp).toBe(3)
    expect(ball.runtime.nextHitBonus).toBe(0)
  })

  it('caps reported damage at remaining brick hp', () => {
    const ball = {
      build: { baseAttack: 10, formId: 'normal', elementId: 'neutral', modifierIds: [] },
      runtime: { nextHitBonus: 0 },
    } as unknown as BallEntity
    const brick = { data: { hp: 2, maxHp: 5 } } as unknown as BrickView
    expect(new DamageResolver().resolve(ball, brick)).toEqual({ damage: 2, destroyed: true })
    expect(brick.data.hp).toBe(0)
  })
})

describe('reward system', () => {
  it('draws two distinct, equally weighted reward types from the expanded pool', () => {
    const values = [0, 0, 0.8]
    const [attack, platform] = new RewardSystem(() => values.shift() ?? 0).createOptions(session())
    expect(attack).toEqual({ type: 'permanent-attack', amount: 1 })
    expect(platform).toEqual({ type: 'platform', platformType: 'split' })
    expect(new Set([attack.type, platform.type]).size).toBe(2)
  })

  it('can draw the new paddle and starting-ball options', () => {
    const [paddle, startingBall] = new RewardSystem(() => 0.999).createOptions(session())
    expect(paddle).toEqual({ type: 'paddle-width', amount: 20 })
    expect(startingBall).toEqual({ type: 'starting-ball', amount: 1 })
  })

  it('removes paddle growth from the pool when the next upgrade would exceed 70% width', () => {
    const current = session()
    current.paddleWidth = 328
    for (let index = 0; index < 20; index += 1) {
      const options = new RewardSystem(() => index / 20).createOptions(current)
      expect(options.some((option) => option.type === 'paddle-width')).toBe(false)
    }
  })

  it('applies permanent attack to the run build', () => {
    const current = session()
    new RewardSystem().apply(current, { type: 'permanent-attack', amount: 1 })
    expect(current.ballBuild.baseAttack).toBe(3)
  })

  it('adds an unplaced platform to unlimited inventory', () => {
    const current = session()
    new RewardSystem().apply(current, { type: 'platform', platformType: 'attack' })
    expect(current.ownedPlatforms).toHaveLength(1)
    expect(current.ownedPlatforms[0]).toMatchObject({ type: 'attack', isPlaced: false })
  })

  it('permanently increases paddle width and starting ball count for the run', () => {
    const current = session()
    const rewards = new RewardSystem()
    rewards.apply(current, { type: 'paddle-width', amount: 20 })
    rewards.apply(current, { type: 'starting-ball', amount: 1 })
    expect(current.paddleWidth).toBe(128)
    expect(current.startingBallCount).toBe(2)
  })
})
