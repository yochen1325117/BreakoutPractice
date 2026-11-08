import { describe, expect, it } from 'vitest'
import { DamageResolver } from './DamageResolver'
import { RewardSystem } from './RewardSystem'
import type { BallEntity, BrickView, GameSession } from './types'

function session(): GameSession {
  return {
    wave: 1,
    elapsedPlaySeconds: 0,
    ballBuild: { baseAttack: 2, formId: 'normal', elementIds: [], modifierIds: [] },
    ownedPlatforms: [],
    paddleWidth: 108,
    startingBallCount: 1,
    platformWidth: 100,
    splitPlatformBallCount: 2,
  }
}

describe('damage resolver', () => {
  it('uses and clears a stacked next-hit bonus', () => {
    const ball = {
      build: { baseAttack: 2, formId: 'normal', elementIds: [], modifierIds: [] },
      runtime: { nextHitBonus: 3, nextHitElementIds: new Set() },
    } as unknown as BallEntity
    const brick = { data: { hp: 8, maxHp: 8 } } as unknown as BrickView
    const result = new DamageResolver().resolve(ball, brick)
    expect(result).toEqual({ damage: 5, destroyed: false, attack: 5, elementIds: [] })
    expect(brick.data.hp).toBe(3)
    expect(ball.runtime.nextHitBonus).toBe(0)
  })

  it('caps reported damage at remaining brick hp', () => {
    const ball = {
      build: { baseAttack: 10, formId: 'normal', elementIds: [], modifierIds: [] },
      runtime: { nextHitBonus: 0, nextHitElementIds: new Set() },
    } as unknown as BallEntity
    const brick = { data: { hp: 2, maxHp: 5 } } as unknown as BrickView
    expect(new DamageResolver().resolve(ball, brick)).toEqual({
      damage: 2, destroyed: true, attack: 10, elementIds: [],
    })
    expect(brick.data.hp).toBe(0)
  })

  it('combines permanent and temporary elements, then consumes only temporary state', () => {
    const ball = {
      build: { baseAttack: 2, formId: 'normal', elementIds: ['water'], modifierIds: [] },
      runtime: { nextHitBonus: 3, nextHitElementIds: new Set(['fire', 'electric']), speedOverride: 520 },
    } as unknown as BallEntity
    const primary = { data: { hp: 8, maxHp: 8 } } as unknown as BrickView
    const secondary = { data: { hp: 9, maxHp: 9 } } as unknown as BrickView
    const resolver = new DamageResolver()
    const result = resolver.resolve(ball, primary)
    expect(result).toEqual({ damage: 5, destroyed: false, attack: 5, elementIds: ['fire', 'water', 'electric'] })
    expect(resolver.applyDamage(secondary, result.attack)).toEqual({ damage: 5, destroyed: false })
    expect(secondary.data.hp).toBe(4)
    expect(ball.runtime.nextHitBonus).toBe(0)
    expect(ball.runtime.nextHitElementIds.size).toBe(0)
    expect(ball.build.elementIds).toEqual(['water'])
    expect(ball.runtime.speedOverride).toBeUndefined()
  })
})

describe('reward system', () => {
  it('treats attack and split platforms as independent, equally weighted rewards', () => {
    const values = [0.7, 0.2]
    const [split, attack] = new RewardSystem(() => values.shift() ?? 0).createOptions(session())
    expect(split).toEqual({ type: 'platform', platformType: 'split' })
    expect(attack).toEqual({ type: 'platform', platformType: 'attack' })
  })

  it('offers the fire platform as its own reward entry', () => {
    const [fire] = new RewardSystem(() => 0.23).createOptions(session())
    expect(fire).toEqual({ type: 'platform', platformType: 'fire' })
  })

  it('offers the electric platform as its own reward entry', () => {
    const [electric] = new RewardSystem(() => 0.55).createOptions(session())
    expect(electric).toEqual({ type: 'platform', platformType: 'electric' })
  })

  it('can draw the new paddle and starting-ball options', () => {
    const values = [0.8, 0.7]
    const [paddle, startingBall] = new RewardSystem(() => values.shift() ?? 0).createOptions(session())
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

  it('limits split platforms to one and offers a one-time triple-split upgrade', () => {
    const current = session()
    current.ownedPlatforms.push({ id: 'split-1', type: 'split', isPlaced: false })
    let sawUpgrade = false
    for (let index = 0; index < 20; index += 1) {
      const options = new RewardSystem(() => index / 20).createOptions(current)
      expect(options.some((option) => option.type === 'platform' && option.platformType === 'split')).toBe(false)
      sawUpgrade ||= options.some((option) => option.type === 'split-upgrade')
    }
    expect(sawUpgrade).toBe(true)
    expect(new RewardSystem().apply(current, { type: 'platform', platformType: 'split' })).toBeUndefined()
    expect(current.ownedPlatforms).toHaveLength(1)

    new RewardSystem().apply(current, { type: 'split-upgrade' })
    expect(current.splitPlatformBallCount).toBe(3)
    for (let index = 0; index < 20; index += 1) {
      const options = new RewardSystem(() => index / 20).createOptions(current)
      expect(options.some((option) => option.type === 'split-upgrade')).toBe(false)
    }
  })

  it('permanently increases paddle width and starting ball count for the run', () => {
    const current = session()
    const rewards = new RewardSystem()
    rewards.apply(current, { type: 'paddle-width', amount: 20 })
    rewards.apply(current, { type: 'starting-ball', amount: 1 })
    expect(current.paddleWidth).toBe(128)
    expect(current.startingBallCount).toBe(2)
  })

  it('permanently increases all reward platform lengths', () => {
    const current = session()
    new RewardSystem().apply(current, { type: 'platform-width', amount: 20 })
    expect(current.platformWidth).toBe(120)
  })
})
