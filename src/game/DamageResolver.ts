import { BALL_ELEMENT_DEFINITIONS, BALL_FORM_DEFINITIONS } from './BallDefinitions'
import type { BallElementId, BallEntity, BrickView } from './types'

export interface AppliedDamageResult {
  damage: number
  destroyed: boolean
}

export interface DamageResult extends AppliedDamageResult {
  attack: number
  elementId: BallElementId
}

export class DamageResolver {
  resolve(ball: BallEntity, brick: BrickView): DamageResult {
    const attack = ball.build.baseAttack + ball.runtime.nextHitBonus
    const elementId = ball.runtime.nextHitElementId === 'neutral'
      ? ball.build.elementId
      : ball.runtime.nextHitElementId
    const result = this.applyDamage(brick, attack)
    ball.runtime.nextHitBonus = 0
    ball.runtime.nextHitElementId = 'neutral'
    const context = { ball, brick, damage: result.damage, destroyed: result.destroyed }
    BALL_FORM_DEFINITIONS[ball.build.formId].onHit?.(context)
    BALL_ELEMENT_DEFINITIONS[elementId].onHit?.(context)
    return { ...result, attack, elementId }
  }

  applyDamage(brick: BrickView, attack: number): AppliedDamageResult {
    const damage = Math.min(brick.data.hp, Math.max(0, attack))
    brick.data.hp = Math.max(0, brick.data.hp - attack)
    return { damage, destroyed: brick.data.hp <= 0 }
  }
}
