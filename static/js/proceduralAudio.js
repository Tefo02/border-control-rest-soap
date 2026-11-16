window.ProceduralAudioEngine = {
  audioContext: null,

  ensureContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  },

  playKeyClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(750 + Math.random() * 380, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.045, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.032);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.032);
  },

  playPaperRustle() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(95, ctx.currentTime + 0.055);
    gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.055);
  },

  playPaperCrumple() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bursts = [0, 0.06, 0.13, 0.21];
    bursts.forEach((offset, idx) => {
      const start = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320 - idx * 45, start);
      osc.frequency.exponentialRampToValueAtTime(80, start + 0.05);
      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.055);
    });
  },

  playFootsteps() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const steps = [0, 0.22, 0.44];
    steps.forEach((offset, idx) => {
      const start = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx % 2 === 0 ? 95 : 82, start);
      osc.frequency.exponentialRampToValueAtTime(32, start + 0.09);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.095);
    });
  },

  playSlotSlide() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.14);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  },

  playSinglePrintLineBuzz() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1240 + (Math.random() * 140 - 70), start);
    gain.gain.setValueAtTime(0.032, start);
    gain.gain.exponentialRampToValueAtTime(0.002, start + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.14);
  },

  playModemHandshake() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const tones = [980, 1420, 1850, 1200, 2100];
    tones.forEach((frequency, idx) => {
      const startOffset = ctx.currentTime + idx * 0.042;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, startOffset);
      gainNode.gain.setValueAtTime(0.038, startOffset);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startOffset + 0.038);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(startOffset);
      oscillator.stop(startOffset + 0.038);
    });
  },

  playStampImpact() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sawtooth';
    thudOsc.frequency.setValueAtTime(145, now);
    thudOsc.frequency.exponentialRampToValueAtTime(28, now + 0.21);
    thudGain.gain.setValueAtTime(0.34, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.21);
  },

  playAlertBuzzer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.setValueAtTime(240, now + 0.11);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }
};
