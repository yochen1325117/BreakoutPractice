import { BALL_ELEMENT_DEFINITIONS, BALL_FORM_DEFINITIONS } from './BallDefinitions'
import { effectiveBallElements } from './rules'
import type { ActiveBallElementId, BallEntity, BrickView } from './types'

export interface AppliedDamageResult {
  damage: number
  destroyed: boolean
}

export interface DamageResult extends AppliedDamageResult {
  attack: number
  elementIds: ActiveBallElementId[]
}

export class DamageResolver {
  resolve(ball: BallEntity, brick: BrickView): DamageResult {
    const attack = ball.build.baseAttack + ball.runtime.nextHitBonus
    const elementIds = effectiveBallElements(ball)
    const result = this.applyDamage(brick, attack)
    ball.runtime.nextHitBonus = 0
    ball.runtime.nextHitElementIds.clear()
    ball.runtime.speedOverride = undefined
    const context = { ball, brick, damage: result.damage, destroyed: result.destroyed }
    BALL_FORM_DEFINITIONS[ball.build.formId].onHit?.(context)
    for (const elementId of elementIds) BALL_ELEMENT_DEFINITIONS[elementId].onHit?.(context)
    return { ...result, attack, elementIds }
  }

  applyDamage(brick: BrickView, attack: number): AppliedDamageResult {
    const damage = Math.min(brick.data.hp, Math.max(0, attack))
    brick.data.hp = Math.max(0, brick.data.hp - attack)
    return { damage, destroyed: brick.data.hp <= 0 }
  }
}
