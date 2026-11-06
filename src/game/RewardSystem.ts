import { MAX_PADDLE_WIDTH, randomPlatformType } from './rules'
import type { GameSession, OwnedPlatform, RewardOption } from './types'

export class RewardSystem {
  constructor(private readonly random: () => number = Math.random) {}

  createOptions(session: GameSession): [RewardOption, RewardOption] {
    const pool: RewardOption['type'][] = ['permanent-attack', 'platform', 'starting-ball']
    if (session.paddleWidth + 20 <= MAX_PADDLE_WIDTH) pool.push('paddle-width')
    const pickedTypes: RewardOption['type'][] = []
    while (pickedTypes.length < 2) {
      const index = Math.min(pool.length - 1, Math.floor(this.random() * pool.length))
      pickedTypes.push(pool.splice(index, 1)[0]!)
    }
    return pickedTypes.map((type): RewardOption => {
      if (type === 'permanent-attack') return { type, amount: 1 }
      if (type === 'platform') return { type, platformType: randomPlatformType(this.random) }
      if (type === 'paddle-width') return { type, amount: 20 }
      return { type: 'starting-ball', amount: 1 }
    }) as [RewardOption, RewardOption]
  }

  apply(session: GameSession, reward: RewardOption): OwnedPlatform | undefined {
    if (reward.type === 'permanent-attack') {
      session.ballBuild.baseAttack += reward.amount
      return undefined
    }
    if (reward.type === 'paddle-width') {
      session.paddleWidth = Math.min(MAX_PADDLE_WIDTH, session.paddleWidth + reward.amount)
      return undefined
    }
    if (reward.type === 'starting-ball') {
      session.startingBallCount += reward.amount
      return undefined
    }
    const platform: OwnedPlatform = {
      id: `platform-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
      type: reward.platformType,
      isPlaced: false,
    }
    session.ownedPlatforms.push(platform)
    return platform
  }
}
