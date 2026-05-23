/** Procedural SFX — Web Audio, no external assets */
export class Sfx {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
  }

  _ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = !!on;
  }

  _tone(freq, dur, type = "square", gain = 0.04) {
    const ctx = this._ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }

  shoot() {
    this._tone(520, 0.05, "square", 0.025);
  }

  kill() {
    this._tone(180, 0.08, "sawtooth", 0.035);
  }

  hurt() {
    this._tone(90, 0.12, "triangle", 0.05);
  }

  pickup() {
    this._tone(660, 0.06, "sine", 0.03);
  }

  boss() {
    this._tone(55, 0.25, "sawtooth", 0.06);
  }

  gameOver() {
    this._tone(120, 0.2, "triangle", 0.04);
    setTimeout(() => this._tone(80, 0.35, "triangle", 0.04), 120);
  }

  destroy() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
