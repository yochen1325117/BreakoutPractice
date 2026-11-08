import { MAX_PADDLE_WIDTH, MAX_PLATFORM_WIDTH } from './rules'
import type { GameSession, OwnedPlatform, RewardOption } from './types'

export class RewardSystem {
  constructor(private readonly random: () => number = Math.random) {}

  createOptions(session: GameSession): [RewardOption, RewardOption] {
    const pool: RewardOption[] = [
      { type: 'permanent-attack', amount: 1 },
      { type: 'platform', platformType: 'attack' },
      { type: 'platform', platformType: 'fire' },
      { type: 'platform', platformType: 'water' },
      { type: 'platform', platformType: 'wind' },
      { type: 'platform', platformType: 'electric' },
      { type: 'starting-ball', amount: 1 },
    ]
    const splitCount = session.ownedPlatforms.filter((platform) => platform.type === 'split').length
    if (splitCount < 1) pool.push({ type: 'platform', platformType: 'split' })
    if (splitCount >= 1 && session.splitPlatformBallCount === 2) pool.push({ type: 'split-upgrade' })
    if (session.paddleWidth + 20 <= MAX_PADDLE_WIDTH) {
      pool.push({ type: 'paddle-width', amount: 20 })
    }
    if (session.platformWidth + 20 <= MAX_PLATFORM_WIDTH) {
      pool.push({ type: 'platform-width', amount: 20 })
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
    if (reward.type === 'platform-width') {
      session.platformWidth = Math.min(MAX_PLATFORM_WIDTH, session.platformWidth + reward.amount)
      return undefined
    }
    if (reward.type === 'starting-ball') {
      session.startingBallCount += reward.amount
      return undefined
    }
    if (reward.type === 'split-upgrade') {
      if (session.splitPlatformBallCount === 2 && session.ownedPlatforms.some((item) => item.type === 'split')) {
        session.splitPlatformBallCount = 3
      }
      return undefined
    }
    if (reward.platformType === 'split' && session.ownedPlatforms.some((item) => item.type === 'split')) {
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
