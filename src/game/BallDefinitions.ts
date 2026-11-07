import type {
  BallElementDefinition,
  BallElementId,
  BallFormDefinition,
  BallFormId,
} from './types'

export const BALL_FORM_DEFINITIONS: Record<BallFormId, BallFormDefinition> = {
  normal: { id: 'normal', name: '普通' },
}

export const BALL_ELEMENT_DEFINITIONS: Record<BallElementId, BallElementDefinition> = {
  neutral: { id: 'neutral', name: '無屬性' },
  fire: { id: 'fire', name: '火焰' },
  water: { id: 'water', name: '水流' },
  wind: { id: 'wind', name: '疾風' },
}
