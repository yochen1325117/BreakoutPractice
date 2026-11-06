export enum GameState {
  READY = 'READY',
  PLAYING = 'PLAYING',
  WAVE_CLEAR = 'WAVE_CLEAR',
  GAME_OVER = 'GAME_OVER',
}

export interface GameSession {
  score: number
  highScore: number
  lives: number
  wave: number
  elapsedPlaySeconds: number
  ballAttack: number
}

export interface BrickData {
  hp: number
  maxHp: number
  row: number
  column: number
  lastHitAt: number
}

export interface BrickView {
  shape: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  data: BrickData
}
