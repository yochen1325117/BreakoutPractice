import { MAX_PADDLE_WIDTH } from './rules'
import type { GameSession, OwnedPlatform, RewardOption } from './types'

export class RewardSystem {
  constructor(private readonly random: () => number = Math.random) {}

  createOptions(session: GameSession): [RewardOption, RewardOption] {
    const pool: RewardOption[] = [
      { type: 'permanent-attack', amount: 1 },
      { type: 'platform', platformType: 'attack' },
      { type: 'platform', platformType: 'split' },
      { type: 'platform', platformType: 'fire' },
      { type: 'starting-ball', amount: 1 },
    ]
    if (session.paddleWidth + 20 <= MAX_PADDLE_WIDTH) {
      pool.push({ type: 'paddle-width', amount: 20 })
    }
    const picked: RewardOption[] = []
    while (picked.length < 2) {
      const index = Math.min(pool.length - 1, Math.floor(this.random() * pool.length))
      picked.push(pool.splice(index, 1)[0]!)
    }
    return picked as [RewardOption, RewardOption]
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
