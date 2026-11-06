import Phaser from 'phaser'
import { AudioManager } from '../game/AudioManager'
import {
  INITIAL_LIVES,
  ballSpeedForWave,
  loseLife,
  randomBrickHp,
  readHighScore,
  saveHighScore,
  scoreForHit,
  scoreForWaveClear,
} from '../game/rules'
import { GameState, type BrickView, type GameSession } from '../game/types'

const WIDTH = 480
const HEIGHT = 800
const PADDLE_Y = 735
const PADDLE_WIDTH = 108
const PADDLE_SPEED = 520
const BALL_RADIUS = 8
const BRICK_COLUMNS = 7
const BRICK_ROWS = 5
const BRICK_WIDTH = 58
const BRICK_HEIGHT = 35
const BRICK_GAP = 7
const BRICK_TOP = 128

export class GameScene extends Phaser.Scene {
  private state = GameState.READY
  private session!: GameSession
  private paddle!: Phaser.GameObjects.Rectangle
  private ball!: Phaser.GameObjects.Arc
  private bricks!: Phaser.Physics.Arcade.StaticGroup
  private brickViews = new Map<Phaser.GameObjects.Rectangle, BrickView>()
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private scoreText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private highScoreText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private muteButton!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Rectangle
  private restartButton!: Phaser.GameObjects.Text
  private audio = new AudioManager()
  private activeBricks = 0
  private dragging = false
  private paddleDragOffset = 0
  private pausedByVisibility = false
  private pausePrompt?: Phaser.GameObjects.Text

  constructor() {
    super('game')
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT + 80)
    this.cameras.main.setBackgroundColor('#070b1b')
    this.drawBackground()

    this.session = {
      score: 0,
      highScore: readHighScore(window.localStorage),
      lives: INITIAL_LIVES,
      wave: 1,
    }

    this.createHud()
    this.createPaddle()
    this.createBall()
    this.bricks = this.physics.add.staticGroup()
    this.createWave()
    this.createOverlay()
    this.setupInput()
    this.setupCollisions()
    this.updateHud()
    this.showReadyMessage()
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    })
  }

  update(_time: number, delta: number): void {
    if (this.pausedByVisibility) return
    this.updatePaddle(delta)

    if (this.state === GameState.READY) {
      this.attachBallToPaddle()
    } else if (this.state === GameState.PLAYING) {
      this.normalizeBallVelocity()
      if (this.ball.y > HEIGHT + 20) this.handleMiss()
    }
  }

  private drawBackground(): void {
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x183052, 0.25)
    for (let y = 96; y < HEIGHT; y += 40) graphics.lineBetween(0, y, WIDTH, y)
    for (let x = 0; x <= WIDTH; x += 40) graphics.lineBetween(x, 96, x, HEIGHT)
    graphics.lineStyle(2, 0x2ce6ff, 0.2)
    graphics.strokeRect(8, 88, WIDTH - 16, HEIGHT - 96)
  }

  private createHud(): void {
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#d8f8ff',
      fontStyle: 'bold',
    }
    this.scoreText = this.add.text(20, 20, '', labelStyle)
    this.waveText = this.add.text(WIDTH / 2, 20, '', labelStyle).setOrigin(0.5, 0)
    this.livesText = this.add.text(20, 51, '', { ...labelStyle, fontSize: '15px', color: '#ff77b7' })
    this.highScoreText = this.add
      .text(WIDTH / 2, 53, '', { ...labelStyle, fontSize: '13px', color: '#8da6c9' })
      .setOrigin(0.5, 0)
    this.muteButton = this.add
      .text(WIDTH - 20, 19, '音效 ON', { ...labelStyle, fontSize: '14px', backgroundColor: '#17233d', padding: { x: 9, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.audio.setMuted(!this.audio.isMuted)
        this.muteButton.setText(this.audio.isMuted ? '音效 OFF' : '音效 ON')
      })
  }

  private createPaddle(): void {
    this.paddle = this.add.rectangle(WIDTH / 2, PADDLE_Y, PADDLE_WIDTH, 16, 0x26e6ff).setStrokeStyle(3, 0xb9f8ff)
    this.physics.add.existing(this.paddle)
    const body = this.paddle.body as Phaser.Physics.Arcade.Body
    body.setImmovable(true)
    body.setAllowGravity(false)
    body.setCollideWorldBounds(true)
  }

  private createBall(): void {
    this.ball = this.add.circle(WIDTH / 2, PADDLE_Y - 22, BALL_RADIUS, 0xffffff).setStrokeStyle(3, 0x54f7ff)
    this.physics.add.existing(this.ball)
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    body.setCircle(BALL_RADIUS)
    body.setBounce(1, 1)
    body.setCollideWorldBounds(true, 1, 1)
    body.setAllowGravity(false)
    body.onWorldBounds = true
    this.physics.world.on('worldbounds', (hitBody: Phaser.Physics.Arcade.Body) => {
      if (hitBody.gameObject === this.ball && this.state === GameState.PLAYING) this.audio.play('bounce')
    })
  }

  private createWave(): void {
    const totalWidth = BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP
    const startX = (WIDTH - totalWidth) / 2 + BRICK_WIDTH / 2
    this.activeBricks = 0

    for (let row = 0; row < BRICK_ROWS; row += 1) {
      for (let column = 0; column < BRICK_COLUMNS; column += 1) {
        const hp = randomBrickHp(this.session.wave)
        const x = startX + column * (BRICK_WIDTH + BRICK_GAP)
        const y = BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP)
        const shape = this.add
          .rectangle(x, y, BRICK_WIDTH, BRICK_HEIGHT, this.colorForHp(hp))
          .setStrokeStyle(2, 0xffffff, 0.42)
        const label = this.add
          .text(x, y, String(hp), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffffff',
          })
          .setOrigin(0.5)
        this.bricks.add(shape)
        this.brickViews.set(shape, {
          shape,
          label,
          data: { hp, maxHp: hp, row, column, lastHitAt: -1000 },
        })
        this.activeBricks += 1
      }
    }
    this.bricks.refresh()
  }

  private createOverlay(): void {
    this.overlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 54, 240, 0x091125, 0.96).setStrokeStyle(2, 0x30e5ff).setVisible(false).setDepth(20)
    this.statusText = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 42, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '27px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(21)
    this.restartButton = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 62, '重新開始', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#06101d',
        backgroundColor: '#35e9ff',
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restartGame())
  }

  private setupInput(): void {
    if (!this.input.keyboard) return
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.keySpace.on('down', () => this.tryLaunch())

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return
      if (!pointer.isDown) {
        this.dragging = false
        return
      }
      this.movePaddleTo(pointer.x - this.paddleDragOffset)
    })
    this.input.on('pointerup', () => {
      this.dragging = false
    })
    this.input.on('gameout', () => {
      this.dragging = false
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      void this.audio.unlock()
      if (this.pausedByVisibility) {
        this.resumeFromVisibilityPause()
        return
      }
      if (this.isPointerOnPaddle(pointer.x, pointer.y)) {
        this.dragging = true
        this.paddleDragOffset = pointer.x - this.paddle.x
      }
      if (!this.hitInteractiveUi(pointer.x, pointer.y)) this.tryLaunch()
    })
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.ball, this.bricks, (ball, brick) => {
      this.hitBrick(ball as Phaser.GameObjects.Arc, brick as Phaser.GameObjects.Rectangle)
    })
    this.physics.add.collider(
      this.ball,
      this.paddle,
      () => this.bounceFromPaddle(),
      () => (this.ball.body as Phaser.Physics.Arcade.Body).velocity.y > 0,
    )
  }

  private updatePaddle(delta: number): void {
    if (this.dragging || this.state === GameState.GAME_OVER) return
    const left = this.cursors?.left.isDown || this.keyA?.isDown
    const right = this.cursors?.right.isDown || this.keyD?.isDown
    const direction = (right ? 1 : 0) - (left ? 1 : 0)
    if (direction !== 0) this.movePaddleTo(this.paddle.x + direction * PADDLE_SPEED * (delta / 1000))
  }

  private movePaddleTo(x: number): void {
    const half = PADDLE_WIDTH / 2
    this.paddle.x = Phaser.Math.Clamp(x, half + 10, WIDTH - half - 10)
    const body = this.paddle.body as Phaser.Physics.Arcade.Body
    body.updateFromGameObject()
    if (this.state === GameState.READY) this.attachBallToPaddle()
  }

  private attachBallToPaddle(): void {
    this.ball.setPosition(this.paddle.x, PADDLE_Y - 22)
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
    body.updateFromGameObject()
  }

  private tryLaunch(): void {
    if (this.state !== GameState.READY || this.pausedByVisibility) return
    this.state = GameState.PLAYING
    this.statusText.setVisible(false)
    const speed = ballSpeedForWave(this.session.wave)
    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-125, -55))
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
  }

  private hitBrick(_ball: Phaser.GameObjects.Arc, shape: Phaser.GameObjects.Rectangle): void {
    if (this.state !== GameState.PLAYING) return
    const brick = this.brickViews.get(shape)
    if (!brick || this.time.now - brick.data.lastHitAt < 45) return
    brick.data.lastHitAt = this.time.now
    brick.data.hp -= 1
    this.session.score = scoreForHit(this.session.score)
    this.updateHighScore()

    if (brick.data.hp <= 0) {
      this.audio.play('break')
      this.createBreakParticles(shape.x, shape.y, shape.fillColor)
      brick.label.destroy()
      shape.destroy()
      this.brickViews.delete(shape)
      this.activeBricks -= 1
      if (this.activeBricks === 0) this.clearWave()
    } else {
      this.audio.play('hit')
      brick.label.setText(String(brick.data.hp))
      shape.setFillStyle(this.colorForHp(brick.data.hp))
      this.tweens.add({ targets: [shape, brick.label], scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 55 })
    }
    this.updateHud()
  }

  private bounceFromPaddle(): void {
    if (this.state !== GameState.PLAYING) return
    this.audio.play('bounce')
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const offset = Phaser.Math.Clamp((this.ball.x - this.paddle.x) / (PADDLE_WIDTH / 2), -1, 1)
    const speed = ballSpeedForWave(this.session.wave)
    const horizontal = offset * speed * 0.82
    const vertical = -Math.sqrt(Math.max(speed * speed - horizontal * horizontal, speed * speed * 0.3))
    body.setVelocity(horizontal || Phaser.Math.RND.sign() * 70, vertical)
  }

  private normalizeBallVelocity(): void {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const velocity = body.velocity
    if (velocity.lengthSq() === 0) return
    const targetSpeed = ballSpeedForWave(this.session.wave)
    const minAxis = 70
    if (Math.abs(velocity.x) < minAxis) velocity.x = (velocity.x < 0 ? -1 : 1) * minAxis
    if (Math.abs(velocity.y) < minAxis) velocity.y = (velocity.y < 0 ? -1 : 1) * minAxis
    velocity.normalize().scale(targetSpeed)
  }

  private handleMiss(): void {
    if (this.state !== GameState.PLAYING) return
    this.audio.play('miss')
    this.session = loseLife(this.session)
    this.updateHud()
    if (this.session.lives <= 0) {
      this.endGame()
      return
    }
    this.state = GameState.READY
    this.attachBallToPaddle()
    this.statusText.setText('漏接了！\n點擊或按空白鍵再次發球').setVisible(true)
    this.time.delayedCall(900, () => {
      if (this.state === GameState.READY) this.showReadyMessage()
    })
  }

  private clearWave(): void {
    if (this.state !== GameState.PLAYING) return
    this.state = GameState.WAVE_CLEAR
    const clearedWave = this.session.wave
    this.session.score = scoreForWaveClear(this.session.score, clearedWave)
    this.updateHighScore()
    this.updateHud()
    this.audio.play('clear')
    ;(this.ball.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
    this.statusText.setText(`第 ${clearedWave} 波完成！`).setVisible(true)
    this.time.delayedCall(1200, () => {
      if (this.state !== GameState.WAVE_CLEAR) return
      this.session.wave += 1
      this.createWave()
      this.state = GameState.READY
      this.attachBallToPaddle()
      this.updateHud()
      this.showReadyMessage()
    })
  }

  private endGame(): void {
    this.state = GameState.GAME_OVER
    ;(this.ball.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
    this.updateHighScore()
    this.overlay.setVisible(true)
    this.statusText
      .setText(`遊戲結束\n分數 ${this.session.score}\n抵達第 ${this.session.wave} 波`)
      .setVisible(true)
    this.restartButton.setVisible(true)
  }

  private restartGame(): void {
    if (this.state !== GameState.GAME_OVER) return
    this.brickViews.forEach((brick) => {
      brick.label.destroy()
      brick.shape.destroy()
    })
    this.brickViews.clear()
    this.bricks.clear(true, true)
    this.session = {
      score: 0,
      highScore: readHighScore(window.localStorage),
      lives: INITIAL_LIVES,
      wave: 1,
    }
    this.overlay.setVisible(false)
    this.restartButton.setVisible(false)
    this.createWave()
    this.state = GameState.READY
    this.attachBallToPaddle()
    this.updateHud()
    this.showReadyMessage()
  }

  private updateHighScore(): void {
    if (this.session.score <= this.session.highScore) return
    this.session.highScore = this.session.score
    saveHighScore(this.session.highScore, window.localStorage)
  }

  private updateHud(): void {
    this.scoreText.setText(`分數 ${this.session.score}`)
    this.waveText.setText(`第 ${this.session.wave} 波`)
    this.livesText.setText(`生命 ${'♥'.repeat(this.session.lives)}${'♡'.repeat(INITIAL_LIVES - this.session.lives)}`)
    this.highScoreText.setText(`最高 ${this.session.highScore}`)
  }

  private showReadyMessage(): void {
    this.statusText.setText('移動橫桿瞄準\n點擊或按空白鍵發球').setVisible(true)
  }

  private colorForHp(hp: number): number {
    if (hp <= 2) return 0x19ddeb
    if (hp <= 5) return 0x7b61ff
    if (hp <= 9) return 0xff4fb7
    if (hp <= 14) return 0xff8a3d
    return 0xff4057
  }

  private createBreakParticles(x: number, y: number, tint: number): void {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 70, max: 180 },
      lifespan: 360,
      quantity: 10,
      scale: { start: 0.55, end: 0 },
      tint,
      emitting: false,
    })
    emitter.explode(10)
    this.time.delayedCall(420, () => emitter.destroy())
  }

  private hitInteractiveUi(x: number, y: number): boolean {
    if (this.muteButton.getBounds().contains(x, y)) return true
    return this.restartButton.visible && this.restartButton.getBounds().contains(x, y)
  }

  private isPointerOnPaddle(x: number, y: number): boolean {
    const hitArea = new Phaser.Geom.Rectangle(
      this.paddle.x - PADDLE_WIDTH / 2 - 10,
      this.paddle.y - 18,
      PADDLE_WIDTH + 20,
      36,
    )
    return hitArea.contains(x, y)
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden && this.state === GameState.PLAYING) {
      this.pausedByVisibility = true
      this.physics.pause()
      this.pausePrompt = this.add
        .text(WIDTH / 2, HEIGHT / 2, '遊戲已暫停\n點擊畫面繼續', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#091125ee',
          align: 'center',
          padding: { x: 32, y: 24 },
        })
        .setOrigin(0.5)
        .setDepth(30)
    }
  }

  private resumeFromVisibilityPause(): void {
    this.pausedByVisibility = false
    this.physics.resume()
    this.pausePrompt?.destroy()
    this.pausePrompt = undefined
  }
}
