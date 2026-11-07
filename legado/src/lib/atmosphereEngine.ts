/**
 * atmosphereEngine.ts
 * Procedural Web Audio API synthesizer for rich TTRPG atmospheric soundscapes.
 * 100% self-contained, offline-capable, and immune to CORS or broken CDN issues.
 */

export type AtmosphereType = 
  | 'none'
  | 'dungeon_rain'
  | 'cold_wind'
  | 'tavern'
  | 'deep_cavern'
  | 'combat_drums'
  | 'arcane_mystery';

export interface AtmospherePreset {
  id: AtmosphereType;
  name: string;
  subtitle: string;
  iconName: string;
  color: string;
  description: string;
}

export const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  {
    id: 'none',
    name: 'Silêncio',
    subtitle: 'Sem ambiência ativa',
    iconName: 'VolumeX',
    color: '#94a3b8',
    description: 'Nenhum som de fundo ativo.'
  },
  {
    id: 'dungeon_rain',
    name: 'Chuva na Masmorra',
    subtitle: 'Goteiras, chuva contínua & trovões distantes',
    iconName: 'CloudRain',
    color: '#0284c7',
    description: 'Água escorrendo pelas pedras frias, tempestade lá fora e trovões ocasionais.'
  },
  {
    id: 'cold_wind',
    name: 'Vento Gélido & Nevasca',
    subtitle: 'Uivos congelantes de inverno',
    iconName: 'Wind',
    color: '#38bdf8',
    description: 'Vento cortante uivando através de fendas e passagens congeladas.'
  },
  {
    id: 'tavern',
    name: 'Taverna Aconchegante',
    subtitle: 'Lareira crepitante & calor',
    iconName: 'Beer',
    color: '#f59e0b',
    description: 'Madeira estalando suavemente na lareira de pedra e ressonância acolhedora.'
  },
  {
    id: 'deep_cavern',
    name: 'Caverna Profunda & Ecos',
    subtitle: 'Pingos d\'água & drone abissal',
    iconName: 'Mountain',
    color: '#a855f7',
    description: 'Ressonância profunda do subsolo, pingos estalando em poças d\'água e silêncio ancestral.'
  },
  {
    id: 'combat_drums',
    name: 'Combate Tenso & Tambores',
    subtitle: 'Percussão marcial de guerra',
    iconName: 'Swords',
    color: '#ef4444',
    description: 'Batidas rítmicas de tambores de guerra e pulso tenso marcando o embate mortal.'
  },
  {
    id: 'arcane_mystery',
    name: 'Santuário Arcano',
    subtitle: 'Taças de cristal & harmônicos',
    iconName: 'Sparkles',
    color: '#10b981',
    description: 'Frequências puras e misteriosas de runas mágicas e cristais ressonantes.'
  }
];

class ProceduralAtmospherePlayer {
  private ctx: AudioContext | null = null;
  private currentType: AtmosphereType = 'none';
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
  private intervalIds: number[] = [];
  private customAudio: HTMLAudioElement | null = null;
  private customAudioUrl: string | null = null;
  private customTrackName: string | null = null;
  private isPausedState: boolean = false;
  private pausedType: AtmosphereType = 'none';
  private listeners: Set<() => void> = new Set();

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private initContext(): AudioContext | null {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (!this.masterGain && this.ctx) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    if (this.customAudio) {
      this.customAudio.volume = this.volume;
    }
    this.notify();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentType(): AtmosphereType {
    return this.currentType;
  }

  public getCustomTrackName(): string | null {
    return this.customTrackName;
  }

  public getCustomUrl(): string | null {
    return this.customAudioUrl;
  }

  public isPlaying(): boolean {
    if (this.isPausedState) return false;
    if (this.currentType !== 'none') return true;
    if (this.customAudio && !this.customAudio.paused) return true;
    return false;
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  private stopProceduralOnly() {
    this.intervalIds.forEach(id => window.clearInterval(id));
    this.intervalIds = [];

    this.activeNodes.forEach(n => {
      try {
        if (n.stop) n.stop();
        n.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];
  }

  public stop() {
    this.currentType = 'none';
    this.customTrackName = null;
    this.customAudioUrl = null;
    this.isPausedState = false;
    this.pausedType = 'none';

    this.stopProceduralOnly();

    if (this.customAudio) {
      try {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
        this.customAudio.src = '';
      } catch {
        // ignore
      }
      this.customAudio = null;
    }
    this.notify();
  }

  public pause() {
    if (this.isPausedState) return;

    if (this.customAudio && !this.customAudio.paused) {
      this.customAudio.pause();
      this.isPausedState = true;
      this.notify();
      return;
    }

    if (this.currentType !== 'none') {
      this.pausedType = this.currentType;
      this.stopProceduralOnly();
      this.isPausedState = true;
      this.currentType = 'none';
      this.notify();
    }
  }

  public resume() {
    if (!this.isPausedState) return;

    if (this.customAudio) {
      this.customAudio.play().then(() => {
        this.isPausedState = false;
        this.notify();
      }).catch((err) => {
        console.warn('Resume custom ambient audio failed:', err);
      });
      return;
    }

    if (this.pausedType !== 'none') {
      const typeToResume = this.pausedType;
      this.pausedType = 'none';
      this.isPausedState = false;
      this.play(typeToResume);
    }
  }

  public togglePlayPause(fallbackType: AtmosphereType = 'deep_cavern', fallbackCustomUrl?: string, fallbackCustomName?: string) {
    if (this.isPlaying()) {
      this.pause();
    } else if (this.isPausedState) {
      this.resume();
    } else if (fallbackCustomUrl) {
      this.playCustomTrack(fallbackCustomUrl, fallbackCustomName);
    } else {
      this.play(fallbackType === 'none' ? 'deep_cavern' : fallbackType);
    }
  }

  /**
   * Plays a custom looping audio track (MP3, WAV, WebM, etc.) from direct URL or Data URL.
   * If playback fails (e.g., broken URL or CORS), falls back to procedural 'dungeon_rain'.
   */
  public playCustomTrack(url: string, name?: string) {
    this.stop();
    if (!url) return;

    this.customTrackName = name || 'Ambiência Personalizada';
    this.customAudioUrl = url;
    this.isPausedState = false;
    this.pausedType = 'none';

    try {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = this.volume;
      this.customAudio = audio;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.notify();
        }).catch((err) => {
          console.warn('Custom ambient audio playback failed, falling back to procedural cavern:', err);
          this.play('deep_cavern');
        });
      }

      audio.onerror = () => {
        console.warn('Custom ambient audio load error, falling back to procedural cavern.');
        this.play('deep_cavern');
      };
    } catch (err) {
      console.warn('Failed to initialize Audio for custom track:', err);
      this.play('deep_cavern');
    }
    this.notify();
  }

  public play(type: AtmosphereType) {
    this.stop();
    if (type === 'none') {
      this.notify();
      return;
    }

    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;
    this.currentType = type;
    this.isPausedState = false;
    this.pausedType = 'none';

    switch (type) {
      case 'dungeon_rain':
        this.startDungeonRain(ctx, this.masterGain);
        break;
      case 'cold_wind':
        this.startColdWind(ctx, this.masterGain);
        break;
      case 'tavern':
        this.startTavern(ctx, this.masterGain);
        break;
      case 'deep_cavern':
        this.startDeepCavern(ctx, this.masterGain);
        break;
      case 'combat_drums':
        this.startCombatDrums(ctx, this.masterGain);
        break;
      case 'arcane_mystery':
        this.startArcaneMystery(ctx, this.masterGain);
        break;
    }
    this.notify();
  }

  // --- PROCEDURAL GENERATORS ---

  // Helper: Generates Pink/Brown Noise buffer for continuous weather
  private createNoiseBuffer(ctx: AudioContext, seconds: number = 3): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.11;
    }
    return buffer;
  }

  // 1. Dungeon Rain: Continuous rain + rhythmic water drips + distant thunder rumbles
  private startDungeonRain(ctx: AudioContext, destination: GainNode) {
    // Rain bed
    const noiseBuffer = this.createNoiseBuffer(ctx, 4);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1100, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.35, ctx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(rainGain);
    rainGain.connect(destination);
    noiseSource.start();
    this.activeNodes.push(noiseSource, bandpass, rainGain);

    // Random water drops
    const dropInterval = window.setInterval(() => {
      if (this.currentType !== 'dungeon_rain' || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startFreq = 1200 + Math.random() * 800;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, now + 0.04);

      gain.gain.setValueAtTime(0.18 + Math.random() * 0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }, 450);
    this.intervalIds.push(dropInterval);

    // Distant thunder rumble (every 8 to 15 seconds)
    const thunderInterval = window.setInterval(() => {
      if (this.currentType !== 'dungeon_rain' || !this.ctx) return;
      const now = this.ctx.currentTime;
      const tOsc = this.ctx.createOscillator();
      const tFilter = this.ctx.createBiquadFilter();
      const tGain = this.ctx.createGain();

      tOsc.type = 'sawtooth';
      tOsc.frequency.setValueAtTime(70 + Math.random() * 30, now);
      tOsc.frequency.exponentialRampToValueAtTime(35, now + 2.5);

      tFilter.type = 'lowpass';
      tFilter.frequency.setValueAtTime(180, now);

      tGain.gain.setValueAtTime(0.001, now);
      tGain.gain.linearRampToValueAtTime(0.4, now + 0.6);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

      tOsc.connect(tFilter);
      tFilter.connect(tGain);
      tGain.connect(destination);
      tOsc.start(now);
      tOsc.stop(now + 3.1);
    }, 11000);
    this.intervalIds.push(thunderInterval);
  }

  // 2. Cold Wind: Howling modulated wind with resonance peaks
  private startColdWind(ctx: AudioContext, destination: GainNode) {
    const noiseBuffer = this.createNoiseBuffer(ctx, 5);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, ctx.currentTime);
    filter.Q.setValueAtTime(3.5, ctx.currentTime);

    // LFO to slowly sweep wind frequency (howling)
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.18, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(240, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.5, ctx.currentTime);

    noise.connect(filter);
    filter.connect(windGain);
    windGain.connect(destination);

    noise.start();
    lfo.start();
    this.activeNodes.push(noise, filter, lfo, lfoGain, windGain);
  }

  // 3. Tavern: Crackling fireplace wood & warm ambient drone
  private startTavern(ctx: AudioContext, destination: GainNode) {
    // Warm low drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(110, ctx.currentTime); // A2 warm drone
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.2, ctx.currentTime);
    drone.connect(droneGain);
    droneGain.connect(destination);
    drone.start();
    this.activeNodes.push(drone, droneGain);

    // Fireplace crackles (frequent rapid mini bursts)
    const crackleInterval = window.setInterval(() => {
      if (this.currentType !== 'tavern' || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = Math.random() > 0.5 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(800 + Math.random() * 1200, now);

      gain.gain.setValueAtTime(0.15 + Math.random() * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.03);
    }, 120);
    this.intervalIds.push(crackleInterval);
  }

  // 4. Deep Cavern: 60Hz subterranean sub-drone + reverberant slow water droplets
  private startDeepCavern(ctx: AudioContext, destination: GainNode) {
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, ctx.currentTime); // Low A1 subterranean rumble
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(destination);
    subOsc.start();

    const lowFifth = ctx.createOscillator();
    lowFifth.type = 'triangle';
    lowFifth.frequency.setValueAtTime(82.4, ctx.currentTime); // E2
    const fifthGain = ctx.createGain();
    fifthGain.gain.setValueAtTime(0.15, ctx.currentTime);
    lowFifth.connect(fifthGain);
    fifthGain.connect(destination);
    lowFifth.start();

    this.activeNodes.push(subOsc, subGain, lowFifth, fifthGain);

    // Deep echo water drops
    const dropInterval = window.setInterval(() => {
      if (this.currentType !== 'deep_cavern' || !this.ctx) return;
      const now = this.ctx.currentTime;
      const f = 750 + Math.random() * 400;

      // Primary drop
      const d1 = this.ctx.createOscillator();
      const g1 = this.ctx.createGain();
      d1.type = 'sine';
      d1.frequency.setValueAtTime(f, now);
      d1.frequency.exponentialRampToValueAtTime(f * 1.8, now + 0.05);
      g1.gain.setValueAtTime(0.2, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      d1.connect(g1);
      g1.connect(destination);
      d1.start(now);
      d1.stop(now + 0.12);

      // Reverb echo 1 (180ms later)
      setTimeout(() => {
        if (!this.ctx) return;
        const e1 = this.ctx.createOscillator();
        const eg1 = this.ctx.createGain();
        e1.type = 'sine';
        e1.frequency.setValueAtTime(f * 0.9, this.ctx.currentTime);
        eg1.gain.setValueAtTime(0.08, this.ctx.currentTime);
        eg1.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        e1.connect(eg1);
        eg1.connect(destination);
        e1.start();
        e1.stop(this.ctx.currentTime + 0.26);
      }, 180);
    }, 1800);
    this.intervalIds.push(dropInterval);
  }

  // 5. Combat Drums: Rhythmic martial war drum rhythm
  private startCombatDrums(ctx: AudioContext, destination: GainNode) {
    let beatStep = 0;
    const bpm = 110;
    const stepDuration = (60 / bpm) * 1000 * 0.5; // Eighth note

    const drumInterval = window.setInterval(() => {
      if (this.currentType !== 'combat_drums' || !this.ctx) return;
      const now = this.ctx.currentTime;
      const isHeavyBeat = beatStep % 4 === 0;
      const isOffBeat = beatStep % 2 === 1;

      // Bass drum
      if (isHeavyBeat || Math.random() > 0.4) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const startPitch = isHeavyBeat ? 110 : 85;
        osc.frequency.setValueAtTime(startPitch, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);

        const vol = isHeavyBeat ? 0.45 : 0.25;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.26);
      }

      // Shaker / Rim accent on offbeats
      if (isOffBeat) {
        const noise = this.ctx.createOscillator();
        const nGain = this.ctx.createGain();
        noise.type = 'sawtooth';
        noise.frequency.setValueAtTime(320 + Math.random() * 120, now);
        nGain.gain.setValueAtTime(0.12, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        noise.connect(nGain);
        nGain.connect(destination);
        noise.start(now);
        noise.stop(now + 0.07);
      }

      beatStep = (beatStep + 1) % 8;
    }, stepDuration);
    this.intervalIds.push(drumInterval);
  }

  // 6. Arcane Mystery: Singing crystal bowl harmonic resonance
  private startArcaneMystery(ctx: AudioContext, destination: GainNode) {
    // Pure harmonic triad: 432Hz (Sacred A), 648Hz (E), 864Hz (A)
    const freqs = [432, 648, 864];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Tremolo
      const trem = ctx.createOscillator();
      trem.frequency.setValueAtTime(0.3 + idx * 0.15, ctx.currentTime);
      const tremGain = ctx.createGain();
      tremGain.gain.setValueAtTime(0.06, ctx.currentTime);
      trem.connect(tremGain);
      tremGain.connect(gain.gain);

      gain.gain.setValueAtTime(0.2 - idx * 0.04, ctx.currentTime);
      osc.connect(gain);
      gain.connect(destination);

      osc.start();
      trem.start();
      this.activeNodes.push(osc, trem, tremGain, gain);
    });
  }
}

export const atmospherePlayer = new ProceduralAtmospherePlayer();
