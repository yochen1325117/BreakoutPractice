import Phaser from 'phaser'
import { BALL_ELEMENT_DEFINITIONS, BALL_FORM_DEFINITIONS } from './BallDefinitions'
import { attackRangeForBalls, effectiveBallElements } from './rules'
import type { BallEntity, GameSession } from './types'

export class LoadoutPanel {
  private container?: Phaser.GameObjects.Container

  constructor(private readonly scene: Phaser.Scene, private readonly width = 480, private readonly height = 800) {}

  get visible(): boolean { return Boolean(this.container?.visible) }

  show(session: GameSession, balls: BallEntity[], onClose: () => void): void {
    this.hide()
    const [minimumAttack, maximumAttack] = attackRangeForBalls(balls, session.ballBuild.baseAttack)
    const attackSummary = minimumAttack === maximumAttack ? `${minimumAttack}` : `${minimumAttack}–${maximumAttack}`
    const elementGroups = new Map<string, number>()
    for (const ball of balls) {
      const names = effectiveBallElements(ball).map((element) => BALL_ELEMENT_DEFINITIONS[element].name)
      const key = names.join('＋') || '無屬性'
      elementGroups.set(key, (elementGroups.get(key) ?? 0) + 1)
    }
    const activeElementSummary = [...elementGroups.entries()].map(([name, count]) => `　${name} ×${count}`).join('\n') || '　無屬性'
    const permanentElementSummary = session.ballBuild.elementIds.map((element) => BALL_ELEMENT_DEFINITIONS[element].name).join('＋') || '無屬性'
    const attackCount = session.ownedPlatforms.filter((item) => item.type === 'attack').length
    const splitCount = session.ownedPlatforms.filter((item) => item.type === 'split').length
    const fireCount = session.ownedPlatforms.filter((item) => item.type === 'fire').length
    const waterCount = session.ownedPlatforms.filter((item) => item.type === 'water').length
    const windCount = session.ownedPlatforms.filter((item) => item.type === 'wind').length
    const electricCount = session.ownedPlatforms.filter((item) => item.type === 'electric').length
    const placedCount = session.ownedPlatforms.filter((item) => item.isPlaced).length
    const backdrop = this.scene.add.rectangle(this.width / 2, this.height / 2, this.width, this.height, 0x030612, 0.78).setInteractive()
    const panel = this.scene.add.rectangle(this.width / 2, this.height / 2, this.width - 32, 720, 0x091125, 0.98).setStrokeStyle(2, 0x30e5ff)
    const title = this.scene.add.text(this.width / 2, 55, '本局能力', {
      fontFamily: 'system-ui, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5)
    const details = this.scene.add.text(42, 88,
      `球體\n` +
      `場上球數　${balls.length}\n` +
      `基礎攻擊　${session.ballBuild.baseAttack}\n` +
      `實際攻擊　${attackSummary}\n` +
      `起始球數　${session.startingBallCount}\n` +
      `橫桿長度　${session.paddleWidth}\n` +
      `平台長度　${session.platformWidth}\n` +
      `型態　　　${BALL_FORM_DEFINITIONS[session.ballBuild.formId].name}\n` +
      `永久元素　${permanentElementSummary}\n` +
      `場上屬性\n${activeElementSummary}\n\n` +
      `平台\n` +
      `已擁有　　${session.ownedPlatforms.length}\n` +
      `已放置　　${placedCount}\n` +
      `強化平台　${attackCount}\n` +
      `分裂平台　${splitCount}\n` +
      `火焰平台　${fireCount}\n` +
      `水流平台　${waterCount}\n` +
      `疾風平台　${windCount}\n` +
      `電流平台　${electricCount}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#d8f8ff', lineSpacing: 2,
        wordWrap: { width: 396, useAdvancedWrap: true },
      })
    const close = this.scene.add.text(this.width / 2, 744, '關閉並繼續', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: '#06101d', backgroundColor: '#35e9ff', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', onClose)
    this.container = this.scene.add.container(0, 0, [backdrop, panel, title, details, close]).setDepth(60)
  }

  hide(): void {
    this.container?.destroy(true)
    this.container = undefined
  }
}
