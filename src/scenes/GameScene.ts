import Phaser from 'phaser'
import { AudioManager } from '../game/AudioManager'
import { BALL_ELEMENT_DEFINITIONS, BALL_FORM_DEFINITIONS } from '../game/BallDefinitions'
import { BallSystem } from '../game/BallSystem'
import { BrickSystem } from '../game/BrickSystem'
import { DamageResolver, type AppliedDamageResult } from '../game/DamageResolver'
import { LoadoutPanel } from '../game/LoadoutPanel'
import { PlatformSystem } from '../game/PlatformSystem'
import { RewardSystem } from '../game/RewardSystem'
import {
  BRICK_DESCENT_SPEED,
  DANGER_LINE_Y,
  MAX_BALL_SPEED,
  ballSpeedForElapsedSeconds,
  readHighScore,
  saveHighScore,
  scoreForBrickDestroyed,
  scoreForWaveClear,
  missingBallCount,
} from '../game/rules'
import { GameState, type BallEntity, type BrickView, type GameSession, type RewardOption } from '../game/types'

const WIDTH = 480
const HEIGHT = 800
const PLAYFIELD_TOP = 88
const PADDLE_Y = 735
const INITIAL_PADDLE_WIDTH = 108
const PADDLE_HEIGHT = 16
const PADDLE_SPEED = 520
const WAVE_COUNTDOWN_SECONDS = 3

export class GameScene extends Phaser.Scene {
  private state = GameState.READY
  private session!: GameSession
  private paddle!: Phaser.GameObjects.Rectangle
  private balls!: BallSystem
  private bricks!: BrickSystem
  private platforms!: PlatformSystem
  private rewards!: RewardSystem
  private damageResolver!: DamageResolver
  private loadout!: LoadoutPanel
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA?: Phaser.Input.Keyboard.Key
  private keyD?: Phaser.Input.Keyboard.Key
  private scoreText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private highScoreText!: Phaser.GameObjects.Text
  private buildText!: Phaser.GameObjects.Text
  private platformText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private muteButton!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Rectangle
  private restartButton!: Phaser.GameObjects.Text
  private rewardContainer?: Phaser.GameObjects.Container
  private placementContainer?: Phaser.GameObjects.Container
  private placementSummary?: Phaser.GameObjects.Text
  private placementMessage?: Phaser.GameObjects.Text
  private audio = new AudioManager()
  private dragging = false
  private paddleDragOffset = 0
  private pausedByVisibility = false
  private pausePrompt?: Phaser.GameObjects.Text
  private uiBlocking = false
  private reinforcementTimer?: Phaser.Time.TimerEvent
  private waveCountdownTimer?: Phaser.Time.TimerEvent

  constructor() {
    super('game')
  }

  create(): void {
    this.physics.world.setBounds(8, PLAYFIELD_TOP, WIDTH - 16, HEIGHT + 80 - PLAYFIELD_TOP)
    this.cameras.main.setBackgroundColor('#070b1b')
    this.drawBackground()
    this.session = this.createSession()

    this.createHud()
    this.createPaddle()
    this.bricks = new BrickSystem(this)
    this.balls = new BallSystem(this, this.session.ballBuild)
    this.platforms = new PlatformSystem(this, this.session.ownedPlatforms, () => this.session.platformWidth)
    this.rewards = new RewardSystem()
    this.damageResolver = new DamageResolver()
    this.loadout = new LoadoutPanel(this)
    this.createOverlay()
    this.setupInput()
    this.setupCollisions()
    this.updateHud()
    this.showRewardSelection()

    const physicsWorld = this.physics.world
    const sceneEvents = this.events
    physicsWorld.on('worldbounds', this.handleWorldBounds)
    sceneEvents.on(Phaser.Scenes.Events.POST_UPDATE, this.checkDangerLine, this)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    sceneEvents.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
      physicsWorld.off('worldbounds', this.handleWorldBounds)
      sceneEvents.off(Phaser.Scenes.Events.POST_UPDATE, this.checkDangerLine, this)
    })
  }

  update(_time: number, delta: number): void {
    if (this.pausedByVisibility || this.loadout.visible) return
    this.updatePaddle(delta)
    const speed = ballSpeedForElapsedSeconds(this.session.elapsedPlaySeconds)

    if (this.state === GameState.READY) {
      this.balls.attachAll(this.paddle.x, PADDLE_Y, this.session.paddleWidth)
      this.balls.update(speed)
      this.balls.commitPositions()
      return
    }

    if (this.state === GameState.WAVE_COUNTDOWN) {
      this.balls.attachAll(this.paddle.x, PADDLE_Y, this.session.paddleWidth)
      this.balls.update(speed)
      this.balls.commitPositions()
      return
    }

    if (this.state === GameState.PLAYING) {
      this.session.elapsedPlaySeconds += delta / 1000
      this.bricks.updateDescent(delta, BRICK_DESCENT_SPEED)
      this.updateActiveBalls(speed)
      const removed = this.balls.removeFallen(HEIGHT + 20)
      if (removed > 0) {
        this.audio.play('miss')
        this.updateHud()
      }
      if (this.balls.count < this.session.startingBallCount) this.scheduleBallReinforcement()
      return
    }
  }

  private createSession(): GameSession {
    return {
      score: 0,
      highScore: readHighScore(window.localStorage),
      wave: 0,
      elapsedPlaySeconds: 0,
      ballBuild: { baseAttack: 1, formId: 'normal', elementId: 'neutral', modifierIds: [] },
      ownedPlatforms: [],
      paddleWidth: INITIAL_PADDLE_WIDTH,
      startingBallCount: 1,
      platformWidth: 100,
    }
  }

  private drawBackground(): void {
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x183052, 0.25)
    for (let y = 96; y < HEIGHT; y += 40) graphics.lineBetween(0, y, WIDTH, y)
    for (let x = 0; x <= WIDTH; x += 40) graphics.lineBetween(x, 96, x, HEIGHT)
    graphics.lineStyle(2, 0x2ce6ff, 0.2)
    graphics.strokeRect(8, 88, WIDTH - 16, HEIGHT - 96)
    graphics.lineStyle(2, 0xff4057, 0.85)
    graphics.lineBetween(9, DANGER_LINE_Y, WIDTH - 9, DANGER_LINE_Y)
    this.add.text(14, DANGER_LINE_Y - 22, '警戒線', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ff6680',
    })
  }

  private createHud(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#d8f8ff', fontStyle: 'bold',
    }
    this.scoreText = this.add.text(14, 12, '', style)
    this.waveText = this.add.text(WIDTH / 2, 12, '', style).setOrigin(0.5, 0)
    this.muteButton = this.add.text(WIDTH - 14, 9, '音效 ON', {
      ...style, fontSize: '13px', backgroundColor: '#17233d', padding: { x: 8, y: 6 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.audio.setMuted(!this.audio.isMuted)
      this.muteButton.setText(this.audio.isMuted ? '音效 OFF' : '音效 ON')
    })
    this.highScoreText = this.add.text(14, 48, '', { ...style, fontSize: '11px', color: '#8da6c9' })
    this.buildText = this.add.text(112, 43, '', {
      ...style, fontSize: '12px', backgroundColor: '#17233d', padding: { x: 7, y: 5 },
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openLoadout())
    this.platformText = this.add.text(WIDTH - 14, 43, '', {
      ...style, fontSize: '12px', backgroundColor: '#17233d', padding: { x: 7, y: 5 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openLoadout())
  }

  private createPaddle(): void {
    this.paddle = this.add.rectangle(WIDTH / 2, PADDLE_Y, this.session.paddleWidth, PADDLE_HEIGHT, 0x26e6ff).setStrokeStyle(3, 0xb9f8ff)
    this.physics.add.existing(this.paddle)
    const body = this.paddle.body as Phaser.Physics.Arcade.Body
    body.setImmovable(true)
    body.setAllowGravity(false)
    body.setCollideWorldBounds(true)
  }

  private createOverlay(): void {
    this.overlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH - 54, 240, 0x091125, 0.96).setStrokeStyle(2, 0x30e5ff).setVisible(false).setDepth(20)
    this.statusText = this.add.text(WIDTH / 2, HEIGHT / 2 - 42, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#ffffff', align: 'center', lineSpacing: 10,
    }).setOrigin(0.5).setDepth(21)
    this.restartButton = this.add.text(WIDTH / 2, HEIGHT / 2 + 68, '重新開始', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#06101d',
      backgroundColor: '#35e9ff', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setDepth(21).setVisible(false).setInteractive({ useHandCursor: true })
  }

  private setupInput(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.tryLaunch())
    }
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return
      if (!pointer.isDown) { this.dragging = false; return }
      this.movePaddleTo(pointer.x - this.paddleDragOffset)
    })
    this.input.on('pointerup', () => { this.dragging = false })
    this.input.on('gameout', () => { this.dragging = false })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      void this.audio.unlock()
      if (this.state === GameState.GAME_OVER && this.restartButton.getBounds().contains(pointer.x, pointer.y)) {
        this.restartGame()
        return
      }
      if (this.pausedByVisibility) { this.resumeFromVisibilityPause(); return }
      if (this.uiBlocking) return
      if (pointer.y >= DANGER_LINE_Y) {
        this.dragging = true
        this.paddleDragOffset = 0
        this.movePaddleTo(pointer.x)
      }
      if (!this.hitInteractiveUi(pointer.x, pointer.y)) {
        this.tryLaunch(pointer.y < DANGER_LINE_Y ? pointer.x : undefined)
      }
    })
  }

  private setupCollisions(): void {
    this.physics.add.collider(this.balls.group, this.bricks.group, (ballObject, brickObject) => {
      const ball = this.balls.getEntity(ballObject as Phaser.GameObjects.GameObject)
      if (ball) this.hitBrick(ball, brickObject as Phaser.GameObjects.GameObject)
    })
    this.physics.add.collider(
      this.balls.group,
      this.paddle,
      (ballObject) => {
        const ball = this.balls.getEntity(ballObject as Phaser.GameObjects.GameObject)
        if (!ball || this.state !== GameState.PLAYING) return
        this.audio.play('bounce')
        this.balls.bounceFromPaddle(ball, this.paddle.x, this.session.paddleWidth, ballSpeedForElapsedSeconds(this.session.elapsedPlaySeconds))
      },
      (ballObject) => ((ballObject as Phaser.GameObjects.Arc).body as Phaser.Physics.Arcade.Body).velocity.y > 0,
    )
  }

  private updateActiveBalls(speed: number): void {
    this.balls.update(speed)
    for (const ball of this.balls.balls) {
      if (this.balls.bounceIfCrossedPaddle(ball, this.paddle.x, PADDLE_Y, this.session.paddleWidth, PADDLE_HEIGHT, speed)) {
        this.audio.play('bounce')
      }
    }
    this.platforms.processBalls(this.balls.balls, {
      onAttack: (ball) => {
        ball.runtime.nextHitBonus += 1
        this.audio.play('hit')
      },
      onSplit: (ball, platformId) => {
        this.balls.split(ball, platformId)
        this.audio.play('break')
        this.updateHud()
      },
      onFire: (ball) => {
        ball.runtime.nextHitElementId = 'fire'
        this.audio.play('hit')
      },
      onWater: (ball) => {
        ball.runtime.nextHitElementId = 'water'
        this.audio.play('hit')
      },
      onWind: (ball) => {
        ball.runtime.nextHitElementId = 'wind'
        ball.runtime.speedOverride = MAX_BALL_SPEED
        const body = ball.sprite.body as Phaser.Physics.Arcade.Body
        if (body.velocity.lengthSq() > 0) body.velocity.normalize().scale(MAX_BALL_SPEED)
        this.audio.play('hit')
      },
    })
    this.balls.commitPositions()
  }

  private hitBrick(ball: BallEntity, object: Phaser.GameObjects.GameObject): void {
    if (this.state !== GameState.PLAYING) return
    const brick = this.bricks.get(object)
    if (!brick) return
    const penetrationTarget = ball.runtime.nextHitElementId === 'fire' || ball.build.elementId === 'fire'
      ? this.bricks.findNextAlongDirection(brick, ball.runtime.previousVelocity)
      : undefined
    const waterTargets = ball.runtime.nextHitElementId === 'water' || ball.build.elementId === 'water'
      ? this.bricks.findHorizontalNeighbors(brick)
      : []
    const result = this.damageResolver.resolve(ball, brick)
    if (result.elementId === 'fire' && penetrationTarget) {
      this.createFireTrail(brick.shape.x, brick.shape.y, penetrationTarget.shape.x, penetrationTarget.shape.y)
    }
    if (result.elementId === 'water') {
      for (const target of waterTargets) {
        this.createElementTrail(brick.shape.x, brick.shape.y, target.shape.x, target.shape.y, 0x43b7ff)
      }
    }
    this.applyBrickDamage(brick, result)
    if (result.elementId === 'fire' && penetrationTarget && this.bricks.get(penetrationTarget.shape)) {
      const penetrationResult = this.damageResolver.applyDamage(penetrationTarget, result.attack)
      this.applyBrickDamage(penetrationTarget, penetrationResult)
    }
    if (result.elementId === 'water') {
      for (const target of waterTargets) {
        if (!this.bricks.get(target.shape)) continue
        const spreadResult = this.damageResolver.applyDamage(target, result.attack)
        this.applyBrickDamage(target, spreadResult)
      }
    }
    this.updateHighScore()
    if (this.bricks.count === 0) this.clearWave()
    this.updateHud()
  }

  private applyBrickDamage(brick: BrickView, result: AppliedDamageResult): void {
    if (result.destroyed) {
      this.audio.play('break')
      this.createBreakParticles(brick.shape.x, brick.shape.y, brick.shape.fillColor)
      this.session.score = scoreForBrickDestroyed(this.session.score, brick.data.maxHp)
      this.bricks.destroy(brick)
    } else {
      this.audio.play('hit')
      this.bricks.updateView(brick)
      this.tweens.add({ targets: [brick.shape, brick.label], scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 55 })
    }
  }

  private updatePaddle(delta: number): void {
    if (this.dragging || this.uiBlocking || this.state === GameState.GAME_OVER) return
    const left = this.cursors?.left.isDown || this.keyA?.isDown
    const right = this.cursors?.right.isDown || this.keyD?.isDown
    const direction = (right ? 1 : 0) - (left ? 1 : 0)
    if (direction !== 0) this.movePaddleTo(this.paddle.x + direction * PADDLE_SPEED * delta / 1000)
  }

  private movePaddleTo(x: number): void {
    const half = this.session.paddleWidth / 2
    this.paddle.x = Phaser.Math.Clamp(x, half + 10, WIDTH - half - 10)
    ;(this.paddle.body as Phaser.Physics.Arcade.Body).updateFromGameObject()
    if (this.state === GameState.READY || this.state === GameState.WAVE_COUNTDOWN) {
      this.balls.attachAll(this.paddle.x, PADDLE_Y, this.session.paddleWidth)
    }
  }

  private tryLaunch(targetX?: number): void {
    const launchable = this.state === GameState.READY
    if (!launchable || this.pausedByVisibility || this.uiBlocking || this.balls.count === 0) return
    this.state = GameState.PLAYING
    this.statusText.setVisible(false)
    const aimOffset = targetX === undefined
      ? undefined
      : Phaser.Math.Clamp((targetX - this.paddle.x) / (WIDTH / 2), -1, 1)
    this.balls.launch(ballSpeedForElapsedSeconds(this.session.elapsedPlaySeconds), aimOffset)
  }

  private scheduleBallReinforcement(): void {
    if (this.state !== GameState.PLAYING || this.reinforcementTimer) return
    this.reinforcementTimer = this.time.delayedCall(1000, () => {
      this.reinforcementTimer = undefined
      if (this.state !== GameState.PLAYING) return
      const missing = missingBallCount(this.balls.count, this.session.startingBallCount)
      if (missing === 0) return
      this.balls.createAttachedBatch(missing, this.paddle.x, PADDLE_Y, this.session.paddleWidth)
      this.balls.launch(ballSpeedForElapsedSeconds(this.session.elapsedPlaySeconds))
      this.updateHud()
    })
  }

  private clearWave(): void {
    if (this.state !== GameState.PLAYING) return
    this.state = GameState.WAVE_CLEAR
    this.balls.removeAll()
    this.session.score = scoreForWaveClear(this.session.score, this.session.wave)
    this.updateHighScore()
    this.updateHud()
    this.audio.play('clear')
    this.statusText.setText(`第 ${this.session.wave} 波完成！`).setVisible(true)
    this.time.delayedCall(800, () => {
      if (this.state === GameState.WAVE_CLEAR) this.showRewardSelection()
    })
  }

  private showRewardSelection(): void {
    this.state = GameState.REWARD_SELECT
    this.uiBlocking = true
    this.statusText.setVisible(false)
    const options = this.rewards.createOptions(this.session)
    const backdrop = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x030612, 0.82).setInteractive()
    const panel = this.add.rectangle(WIDTH / 2, 400, WIDTH - 36, 500, 0x091125, 0.98).setStrokeStyle(2, 0x30e5ff)
    const title = this.add.text(WIDTH / 2, 190, this.session.wave === 0 ? '選擇開局獎勵' : '選擇本波獎勵', {
      fontFamily: 'system-ui, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5)
    const cards = options.flatMap((reward, index) => {
      const presentation = this.rewardPresentation(reward)
      return this.rewardCard(56, 248 + index * 174, WIDTH - 112, presentation.title, presentation.description, reward)
    })
    this.rewardContainer = this.add.container(0, 0, [
      backdrop, panel, title, ...cards,
    ]).setDepth(50)
  }

  private rewardPresentation(reward: RewardOption): { title: string; description: string } {
    if (reward.type === 'permanent-attack') {
      return { title: '永久攻擊 +1', description: `基礎攻擊提升至 ${this.session.ballBuild.baseAttack + 1}` }
    }
    if (reward.type === 'platform') {
      if (reward.platformType === 'attack') {
        return { title: '強化平台', description: '每次穿越使下一擊攻擊力 +1，可累積' }
      }
      if (reward.platformType === 'split') {
        return { title: '分裂平台', description: '每次穿越分裂出一顆繼承永久能力的新球' }
      }
      if (reward.platformType === 'fire') {
        return { title: '火焰平台', description: '下次命中以完整攻擊力穿透後方一塊磚' }
      }
      if (reward.platformType === 'water') {
        return { title: '水流平台', description: '下次命中以完整攻擊力擴散至左右磚塊' }
      }
      return { title: '疾風平台', description: '球速提升至最高，直到下一次命中' }
    }
    if (reward.type === 'paddle-width') {
      return { title: '橫桿加長', description: `橫桿長度 +20（目前 ${this.session.paddleWidth}）` }
    }
    if (reward.type === 'platform-width') {
      return { title: '平台加長', description: `所有獎勵平台長度 +20（目前 ${this.session.platformWidth}）` }
    }
    return { title: '起始球數 +1', description: `下一波起始球數提升至 ${this.session.startingBallCount + 1}` }
  }

  private rewardCard(x: number, y: number, width: number, title: string, description: string, reward: RewardOption): Phaser.GameObjects.GameObject[] {
    const background = this.add.rectangle(x, y, width, 148, reward.type === 'permanent-attack' ? 0x273c78 : 0x5b245d, 0.95)
      .setOrigin(0, 0).setStrokeStyle(2, 0xffffff, 0.4).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.selectReward(reward))
    const heading = this.add.text(x + 18, y + 17, title, {
      fontFamily: 'system-ui, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#ffffff',
    })
    const body = this.add.text(x + 18, y + 56, description, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#d8f8ff', wordWrap: { width: width - 36 },
    })
    return [background, heading, body]
  }

  private selectReward(reward: RewardOption): void {
    if (this.state !== GameState.REWARD_SELECT) return
    this.rewards.apply(this.session, reward)
    this.syncPaddleSize()
    this.rewardContainer?.destroy(true)
    this.rewardContainer = undefined
    this.platforms.syncViews()
    this.updateHud()
    if (this.session.ownedPlatforms.length > 0) this.showPlatformPlacement()
    else this.startNextWave()
  }

  private showPlatformPlacement(): void {
    this.state = GameState.PLATFORM_PLACEMENT
    this.uiBlocking = true
    const backdrop = this.add.rectangle(WIDTH / 2, 350, WIDTH, 510, 0x030612, 0.16).setInteractive()
    const header = this.add.rectangle(WIDTH / 2, 116, WIDTH - 28, 58, 0x091125, 0.92).setStrokeStyle(2, 0x30e5ff)
    const title = this.add.text(34, 98, '配置平台', {
      fontFamily: 'system-ui, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    })
    this.placementSummary = this.add.text(WIDTH - 30, 105, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#d8f8ff', align: 'center',
    }).setOrigin(1, 0)
    const placementGuide = this.add.text(WIDTH / 2, 350,
      `平台放置方式\n\n` +
      `拖曳場上的平台即可移動\n` +
      `可放置在警戒線以上，平台允許互相重疊\n` +
      `未放置的平台會保留在庫存\n\n` +
      `橘色 +1：下一次攻擊力增加\n` +
      `粉色 ×2：球穿越時產生新球\n` +
      `紅色 火：下次攻擊穿透一塊磚\n` +
      `藍色 水：下次攻擊擴散至左右\n` +
      `綠色 風：下次命中前維持最高球速`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#8da6c9',
        align: 'center', lineSpacing: 5,
      }).setOrigin(0.5).setAlpha(0.72)
    const controlGuide = this.add.text(WIDTH / 2, 618,
      '◀／▶ 切換平台　｜　放置／收回　｜　刪除不可復原　｜　開始下一波確認', {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#d8f8ff', align: 'center',
      }).setOrigin(0.5)
    this.placementMessage = this.add.text(WIDTH / 2, 644, '選擇平台後即可開始配置', {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#8da6c9', align: 'center',
    }).setOrigin(0.5)
    const previous = this.uiButton(24, 665, '◀', () => this.platforms.cycleSelection(-1))
    const toggle = this.uiButton(82, 665, '放置／收回', () => {
      const ok = this.platforms.toggleSelectedPlacement()
      this.placementMessage?.setText(ok ? '平台狀態已更新' : '沒有足夠的合法空間，請先移動或收回其他平台')
      this.refreshPlacementSummary()
    })
    const remove = this.uiButton(226, 665, '刪除', () => {
      this.platforms.deleteSelected()
      this.placementMessage?.setText('平台已永久刪除')
      this.refreshPlacementSummary()
    })
    const next = this.uiButton(307, 665, '▶', () => this.platforms.cycleSelection(1))
    const confirm = this.uiButton(365, 665, '開始下一波', () => this.confirmPlacement())
    this.placementContainer = this.add.container(0, 0, [
      backdrop, header, title, this.placementSummary, placementGuide, controlGuide,
      this.placementMessage, ...previous, ...toggle, ...remove, ...next, ...confirm,
    ]).setDepth(40)
    this.platforms.beginPlacement(() => this.refreshPlacementSummary())
    this.refreshPlacementSummary()
  }

  private uiButton(x: number, y: number, label: string, action: () => void): Phaser.GameObjects.GameObject[] {
    const text = this.add.text(x, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#06101d',
      backgroundColor: '#35e9ff', padding: { x: 10, y: 12 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', action)
    return [text]
  }

  private refreshPlacementSummary(): void {
    const selected = this.platforms.selected
    if (!this.placementSummary) return
    if (!selected) {
      this.placementSummary.setText('目前沒有平台')
      return
    }
    const index = this.session.ownedPlatforms.findIndex((item) => item.id === selected.id) + 1
    const type = selected.type === 'attack'
      ? '強化平台 +1'
      : selected.type === 'split' ? '分裂平台 ×2'
        : selected.type === 'fire' ? '火焰平台'
          : selected.type === 'water' ? '水流平台' : '疾風平台'
    const status = selected.isPlaced ? '已放置' : '庫存中'
    this.placementSummary.setText(`${index}/${this.session.ownedPlatforms.length}　${type}　${status}　｜　已放置 ${this.platforms.placedCount}`)
  }

  private confirmPlacement(): void {
    if (!this.platforms.allPlacementsValid()) {
      this.placementMessage?.setText('仍有平台位置不合法')
      return
    }
    this.platforms.endPlacement()
    this.placementContainer?.destroy(true)
    this.placementContainer = undefined
    this.placementSummary = undefined
    this.placementMessage = undefined
    this.startNextWave()
  }

  private startNextWave(): void {
    this.session.wave += 1
    this.bricks.createWave(this.session.wave)
    this.createStartingBalls()
    this.uiBlocking = false
    this.updateHud()
    this.beginWaveCountdown()
  }

  private openLoadout(): void {
    if (this.uiBlocking || this.state === GameState.GAME_OVER) return
    this.uiBlocking = true
    this.physics.pause()
    this.time.paused = true
    this.loadout.show(this.session, this.balls.count, () => {
      this.loadout.hide()
      this.uiBlocking = false
      if (!this.pausedByVisibility) {
        this.time.paused = false
        this.physics.resume()
      }
    })
  }

  private checkDangerLine(): void {
    const descending = this.state === GameState.PLAYING
    if (descending && this.bricks.count > 0 && this.bricks.hasCrossed(DANGER_LINE_Y)) this.endGame()
  }

  private endGame(): void {
    if (this.state === GameState.GAME_OVER) return
    this.state = GameState.GAME_OVER
    this.reinforcementTimer?.remove(false)
    this.reinforcementTimer = undefined
    this.waveCountdownTimer?.remove(false)
    this.waveCountdownTimer = undefined
    this.balls.removeAll()
    this.updateHighScore()
    this.uiBlocking = true
    this.overlay.setVisible(true)
    this.statusText.setText(`磚塊越過警戒線！\n分數 ${this.session.score}\n抵達第 ${this.session.wave} 波`).setVisible(true)
    this.restartButton.setVisible(true)
  }

  private restartGame(): void {
    if (this.state !== GameState.GAME_OVER) return
    this.state = GameState.READY
    this.uiBlocking = false
    this.pausedByVisibility = false
    this.time.paused = false
    this.physics.resume()
    this.scene.restart()
  }

  private updateHighScore(): void {
    if (this.session.score <= this.session.highScore) return
    this.session.highScore = this.session.score
    saveHighScore(this.session.highScore, window.localStorage)
  }

  private updateHud(): void {
    const formName = BALL_FORM_DEFINITIONS[this.session.ballBuild.formId].name
    const elementName = BALL_ELEMENT_DEFINITIONS[this.session.ballBuild.elementId].name
    this.scoreText.setText(`分數 ${this.session.score}`)
    this.waveText.setText(`第 ${this.session.wave} 波`)
    this.highScoreText.setText(`最高 ${this.session.highScore}`)
    this.buildText.setText(`球 ${this.balls?.count ?? 0}｜攻 ${this.session.ballBuild.baseAttack}｜${formName}・${elementName}`)
    this.platformText.setText(`平台 ${this.platforms?.placedCount ?? 0}/${this.session.ownedPlatforms.length}`)
  }

  private createStartingBalls(): void {
    this.balls.createAttachedBatch(this.session.startingBallCount, this.paddle.x, PADDLE_Y, this.session.paddleWidth)
  }

  private beginWaveCountdown(): void {
    this.waveCountdownTimer?.remove(false)
    this.state = GameState.WAVE_COUNTDOWN
    let remaining = WAVE_COUNTDOWN_SECONDS
    const tick = (): void => {
      if (this.state !== GameState.WAVE_COUNTDOWN) return
      this.statusText.setText(`第 ${this.session.wave} 波準備\n${remaining}`).setVisible(true)
      if (remaining === 0) {
        this.waveCountdownTimer = undefined
        this.statusText.setVisible(false)
        this.state = GameState.PLAYING
        this.balls.launch(ballSpeedForElapsedSeconds(this.session.elapsedPlaySeconds))
        return
      }
      remaining -= 1
      this.waveCountdownTimer = this.time.delayedCall(1000, tick)
    }
    tick()
  }

  private syncPaddleSize(): void {
    this.paddle.setSize(this.session.paddleWidth, PADDLE_HEIGHT)
    this.paddle.displayWidth = this.session.paddleWidth
    const body = this.paddle.body as Phaser.Physics.Arcade.Body
    body.setSize(this.session.paddleWidth, PADDLE_HEIGHT, true)
    this.movePaddleTo(this.paddle.x)
  }

  private createBreakParticles(x: number, y: number, tint: number): void {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 70, max: 180 }, lifespan: 360, quantity: 10,
      scale: { start: 0.55, end: 0 }, tint, emitting: false,
    })
    emitter.explode(10)
    this.time.delayedCall(420, () => emitter.destroy())
  }

  private createFireTrail(fromX: number, fromY: number, toX: number, toY: number): void {
    this.createElementTrail(fromX, fromY, toX, toY, 0xff5a36, 0xffd166)
  }

  private createElementTrail(fromX: number, fromY: number, toX: number, toY: number, color: number, core = 0xffffff): void {
    const trail = this.add.graphics().setDepth(12)
    trail.lineStyle(6, color, 0.9)
    trail.lineBetween(fromX, fromY, toX, toY)
    trail.lineStyle(2, core, 1)
    trail.lineBetween(fromX, fromY, toX, toY)
    this.tweens.add({ targets: trail, alpha: 0, duration: 180, onComplete: () => trail.destroy() })
  }

  private hitInteractiveUi(x: number, y: number): boolean {
    return this.muteButton.getBounds().contains(x, y) ||
      this.buildText.getBounds().contains(x, y) ||
      this.platformText.getBounds().contains(x, y) ||
      (this.restartButton.visible && this.restartButton.getBounds().contains(x, y))
  }

  private handleWorldBounds = (body: Phaser.Physics.Arcade.Body): void => {
    if (this.balls.getEntity(body.gameObject) && this.state === GameState.PLAYING) this.audio.play('bounce')
  }

  private handleVisibilityChange = (): void => {
    if (!document.hidden || this.state === GameState.GAME_OVER || this.pausedByVisibility) return
    this.pausedByVisibility = true
    this.physics.pause()
    this.time.paused = true
    this.pausePrompt = this.add.text(WIDTH / 2, HEIGHT / 2, '遊戲已暫停\n點擊畫面繼續', {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#091125ee', align: 'center', padding: { x: 32, y: 24 },
    }).setOrigin(0.5).setDepth(80)
  }

  private resumeFromVisibilityPause(): void {
    this.pausedByVisibility = false
    if (!this.loadout.visible) {
      this.time.paused = false
      this.physics.resume()
    }
    this.pausePrompt?.destroy()
    this.pausePrompt = undefined
  }
}
