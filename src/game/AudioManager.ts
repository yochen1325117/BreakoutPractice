export type SoundName = 'bounce' | 'hit' | 'break' | 'miss' | 'clear'

const frequencies: Record<SoundName, [number, number, number]> = {
  bounce: [220, 250, 0.045],
  hit: [440, 520, 0.06],
  break: [660, 880, 0.1],
  miss: [180, 80, 0.28],
  clear: [520, 1040, 0.34],
}

export class AudioManager {
  private context?: AudioContext
  private muted = false

  get isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      const Context = window.AudioContext ?? window.webkitAudioContext
      if (!Context) return
      this.context = new Context()
    }
    if (this.context.state === 'suspended') await this.context.resume()
  }

  play(name: SoundName): void {
    if (this.muted || !this.context || this.context.state !== 'running') return

    const [start, end, duration] = frequencies[name]
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = name === 'miss' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
