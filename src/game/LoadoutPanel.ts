import Phaser from 'phaser'
import { BALL_ELEMENT_DEFINITIONS, BALL_FORM_DEFINITIONS } from './BallDefinitions'
import type { GameSession } from './types'

export class LoadoutPanel {
  private container?: Phaser.GameObjects.Container

  constructor(private readonly scene: Phaser.Scene, private readonly width = 480, private readonly height = 800) {}

  get visible(): boolean { return Boolean(this.container?.visible) }

  show(session: GameSession, ballCount: number, onClose: () => void): void {
    this.hide()
    const attackCount = session.ownedPlatforms.filter((item) => item.type === 'attack').length
    const splitCount = session.ownedPlatforms.filter((item) => item.type === 'split').length
    const fireCount = session.ownedPlatforms.filter((item) => item.type === 'fire').length
    const placedCount = session.ownedPlatforms.filter((item) => item.isPlaced).length
    const backdrop = this.scene.add.rectangle(this.width / 2, this.height / 2, this.width, this.height, 0x030612, 0.78).setInteractive()
    const panel = this.scene.add.rectangle(this.width / 2, this.height / 2, this.width - 44, 510, 0x091125, 0.98).setStrokeStyle(2, 0x30e5ff)
    const title = this.scene.add.text(this.width / 2, 178, '本局能力', {
      fontFamily: 'system-ui, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5)
    const details = this.scene.add.text(54, 222,
      `球體\n` +
      `場上球數　${ballCount}\n` +
      `基礎攻擊　${session.ballBuild.baseAttack}\n` +
      `起始球數　${session.startingBallCount}\n` +
      `橫桿長度　${session.paddleWidth}\n` +
      `型態　　　${BALL_FORM_DEFINITIONS[session.ballBuild.formId].name}\n` +
      `元素　　　${BALL_ELEMENT_DEFINITIONS[session.ballBuild.elementId].name}\n\n` +
      `平台\n` +
      `已擁有　　${session.ownedPlatforms.length}\n` +
      `已放置　　${placedCount}\n` +
      `強化平台　${attackCount}\n` +
      `分裂平台　${splitCount}\n` +
      `火焰平台　${fireCount}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#d8f8ff', lineSpacing: 9,
      })
    const close = this.scene.add.text(this.width / 2, 607, '關閉並繼續', {
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
