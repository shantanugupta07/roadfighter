/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isEngineRunning: boolean = false;

  constructor() {
    // Lazy initialize on first interaction to abide by browser security policies
    this.isMuted = localStorage.getItem('roadfighter_muted') === 'true';
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('roadfighter_muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopEngine();
    } else if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.isMuted;
  }

  getMuteStatus() {
    return this.isMuted;
  }

  startEngine() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isEngineRunning) return;

    try {
      // Create engine tone using sawtooth or triangle oscillator
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // low pitch engine rumbling

      // Filter to make it sound like a throbbing exhaust
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.engineOsc.start();
      this.isEngineRunning = true;
    } catch (e) {
      console.error("Failed to start engine audio", e);
    }
  }

  updateEngine(speedRatio: number, gear: 'LOW' | 'HIGH') {
    if (this.isMuted || !this.isEngineRunning || !this.engineOsc || !this.ctx) return;

    const baseFreq = gear === 'LOW' ? 45 : 75;
    const maxFreqAddition = gear === 'LOW' ? 90 : 150;
    
    // Smooth frequency transitions
    const targetFreq = baseFreq + speedRatio * maxFreqAddition;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);

    // Throbbing effect (simulating cylinder firing)
    const throb = 0.05 + Math.sin(this.ctx.currentTime * 30 * (1 + speedRatio)) * 0.02;
    this.engineGain?.gain.setTargetAtTime(throb, this.ctx.currentTime, 0.05);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch (e) {}
      this.engineGain = null;
    }
    this.isEngineRunning = false;
  }

  playCrash() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      // Retro crash: Noise buffer + quick decaying oscillator
      const bufferSize = this.ctx.sampleRate * 0.5; // half second
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill with noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter to make it "explosive"
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.4);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      // Add a low-end sub oscillator for punch
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(120, now);
      subOsc.frequency.linearRampToValueAtTime(20, now + 0.3);

      subGain.gain.setValueAtTime(0.6, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);

      noise.start(now);
      subOsc.start(now);

      noise.stop(now + 0.5);
      subOsc.stop(now + 0.5);
    } catch (e) {
      console.error(e);
    }
  }

  playSkid() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      // High-pitched screeching sweep
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(750, now + 0.25);
      // Fast vibrato
      osc.frequency.setValueAtTime(750 + Math.sin(now * 100) * 50, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  playFuel() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Arpeggio: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const duration = 0.08;

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * duration);

        gain.gain.setValueAtTime(0.08, now + idx * duration);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * duration + duration - 0.01);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * duration);
        osc.stop(now + idx * duration + duration);
      });
    } catch (e) {}
  }

  playBeep() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  playLevelComplete() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // High energetic retro victory riff
      const notes = [523.25, 523.25, 523.25, 523.25, 659.25, 587.33, 659.25, 783.99, 1046.50];
      const rhythms = [0.12, 0.12, 0.12, 0.18, 0.12, 0.12, 0.12, 0.12, 0.4];
      
      let accumTime = 0;
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + accumTime);

        gain.gain.setValueAtTime(0.12, now + accumTime);
        gain.gain.exponentialRampToValueAtTime(0.001, now + accumTime + rhythms[idx] - 0.02);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + accumTime);
        osc.stop(now + accumTime + rhythms[idx]);

        accumTime += rhythms[idx];
      });
    } catch (e) {}
  }

  playGameOver() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Sad descending retro riff
      const notes = [392.00, 349.23, 311.13, 261.63];
      const rhythms = [0.2, 0.2, 0.2, 0.5];
      
      let accumTime = 0;
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + accumTime);

        gain.gain.setValueAtTime(0.15, now + accumTime);
        gain.gain.exponentialRampToValueAtTime(0.001, now + accumTime + rhythms[idx] - 0.02);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + accumTime);
        osc.stop(now + accumTime + rhythms[idx]);

        accumTime += rhythms[idx];
      });
    } catch (e) {}
  }
}

export const audio = new AudioEngine();
export default audio;
