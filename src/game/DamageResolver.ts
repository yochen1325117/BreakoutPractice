import { BALL_ELEMENT_DEFINITIONS, BALL_FORM_DEFINITIONS } from './BallDefinitions'
import type { BallEntity, BrickView } from './types'

export interface DamageResult {
  damage: number
  destroyed: boolean
}

export class DamageResolver {
  resolve(ball: BallEntity, brick: BrickView): DamageResult {
    const attack = ball.build.baseAttack + ball.runtime.nextHitBonus
    const damage = Math.min(brick.data.hp, Math.max(0, attack))
    brick.data.hp = Math.max(0, brick.data.hp - attack)
    ball.runtime.nextHitBonus = 0
    const destroyed = brick.data.hp <= 0
    const context = { ball, brick, damage, destroyed }
    BALL_FORM_DEFINITIONS[ball.build.formId].onHit?.(context)
    BALL_ELEMENT_DEFINITIONS[ball.build.elementId].onHit?.(context)
    return { damage, destroyed }
  }
}
