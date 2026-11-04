import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 })
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(6, 6, 6)
    graphics.generateTexture('particle', 12, 12)
    graphics.destroy()
    this.scene.start('game')
  }
}
