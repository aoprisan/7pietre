// Tiny WebAudio blips — zero assets, zero deps. Synthesized on the fly. Resumed
// on the first user gesture (the JOACĂ button) to satisfy autoplay policies.
import type { GameEventKind } from './sim/types';

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  resume(): void {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx && AC) this.ctx = new AC();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number): void {
    if (!this.ctx || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  play(kind: GameEventKind): void {
    switch (kind) {
      case 'throw': this.blip(520, 0.12, 'triangle', 0.18, 280); break;
      case 'topple': this.noise(0.35, 0.32); this.blip(160, 0.3, 'square', 0.18, 70); break;
      case 'tag': this.blip(220, 0.18, 'square', 0.26, 90); this.noise(0.12, 0.18); break;
      case 'placeStone': this.blip(440, 0.1, 'sine', 0.2, 620); break;
      case 'pickupStone': this.blip(360, 0.07, 'sine', 0.16, 500); break;
      case 'pickupBall': this.blip(300, 0.07, 'triangle', 0.16, 420); break;
      case 'roundWin': this.blip(523, 0.12, 'square', 0.2, 784); break;
      case 'bounce': this.blip(200, 0.05, 'sine', 0.08); break;
    }
  }
}
