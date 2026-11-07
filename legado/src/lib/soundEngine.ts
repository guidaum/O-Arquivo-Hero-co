/**
 * soundEngine.ts
 * Unified audio engine for TTRPG dice rolls, outcomes (success, failure, critical hits/misses),
 * presets, file upload utilities, and procedural Web Audio synthesizers (infallible fallback).
 */

export type RollOutcome = 'critical' | 'fumble' | 'success' | 'failure';
export type SoundEffectType = 
  | 'diceRoll' 
  | 'success' 
  | 'failure' 
  | 'critical' 
  | 'fumble'
  | 'attack'
  | 'shield'
  | 'arrow'
  | 'damage'
  | 'spell'
  | 'heal'
  | 'footsteps'
  | 'trap'
  | 'chest'
  | 'door'
  | 'ping'
  | 'roar'
  | 'levelup'
  | 'combat_start'
  | string;

export interface SoundPreset {
  id: string;
  name: string;
  url: string;
  description: string;
  badge?: string;
}

export interface SoundConfig {
  diceRollSound?: string;
  successSound?: string;
  failureSound?: string;
  criticalSound?: string;
  fumbleSound?: string;
  attackSound?: string;
  shieldSound?: string;
  arrowSound?: string;
  damageSound?: string;
  spellSound?: string;
  healSound?: string;
  footstepsSound?: string;
  trapSound?: string;
  chestSound?: string;
  doorSound?: string;
  pingSound?: string;
  monsterRoarSound?: string;
  levelUpSound?: string;
  combatStartSound?: string;
  customAmbientSound?: string;
  customAmbientName?: string;
  [key: string]: string | undefined;
}

export const DEFAULT_SOUNDS: Required<Omit<SoundConfig, 'customAmbientSound' | 'customAmbientName'>> & {
  customAmbientSound?: string;
  customAmbientName?: string;
} = {
  diceRollSound: 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3',
  successSound: 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3',
  failureSound: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  criticalSound: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  fumbleSound: 'https://assets.mixkit.co/active_storage/sfx/2550/2550-preview.mp3',
  attackSound: 'https://assets.mixkit.co/active_storage/sfx/2168/2168-preview.mp3',
  shieldSound: 'https://assets.mixkit.co/active_storage/sfx/2171/2171-preview.mp3',
  arrowSound: 'https://assets.mixkit.co/active_storage/sfx/2174/2174-preview.mp3',
  damageSound: 'https://assets.mixkit.co/active_storage/sfx/2165/2165-preview.mp3',
  spellSound: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  healSound: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  footstepsSound: 'https://assets.mixkit.co/active_storage/sfx/2144/2144-preview.mp3',
  trapSound: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  chestSound: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  doorSound: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3',
  pingSound: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
  monsterRoarSound: 'https://assets.mixkit.co/active_storage/sfx/2551/2551-preview.mp3',
  levelUpSound: 'https://assets.mixkit.co/active_storage/sfx/1432/1432-preview.mp3',
  combatStartSound: 'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3',
  customAmbientSound: '',
  customAmbientName: ''
};

export const SOUND_PRESETS: Record<SoundEffectType, SoundPreset[]> = {
  diceRoll: [
    {
      id: 'mixkit_wood_dice',
      name: 'Dados de Madeira Clássicos',
      url: 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3',
      description: 'Chocalhar tradicional de dados de madeira rolando sobre madeira.',
      badge: 'Padrão'
    },
    {
      id: 'mixkit_table_dice',
      name: 'Dados em Mesa Aveludada',
      url: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3',
      description: 'Impacto suave de dados com rolagem veloz.'
    },
    {
      id: 'mixkit_heavy_impact',
      name: 'Impacto Metálico / Resina',
      url: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
      description: 'Chocalho com baque pesado e ressonante.'
    },
    {
      id: 'synth_dice',
      name: 'Sintetizador Procedural (Web Audio)',
      url: 'synth:roll',
      description: 'Som sintetizado via Web Audio API, nunca falha mesmo offline.',
      badge: '100% Offline'
    }
  ],
  success: [
    {
      id: 'mixkit_triumphant_harp',
      name: 'Acorde Triunfante / Harpa',
      url: 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3',
      description: 'Acorde harmônico celestial indicando sucesso claro.',
      badge: 'Padrão'
    },
    {
      id: 'mixkit_victory_chime',
      name: 'Sino Mágico de Vitória',
      url: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      description: 'Campana cristalina suave para teste bem-sucedido.'
    },
    {
      id: 'mixkit_magic_sparkle',
      name: 'Brilho de Feitiço Arcana',
      url: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
      description: 'Efeito sonoro místico ascendente.'
    },
    {
      id: 'synth_success',
      name: 'Sintetizador Harmônico (Web Audio)',
      url: 'synth:success',
      description: 'Tríade maior ascendente gerada proceduralmente.',
      badge: '100% Offline'
    }
  ],
  failure: [
    {
      id: 'mixkit_low_bell',
      name: 'Sino Sombrio de Fracasso',
      url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      description: 'Badalada grave e melancólica indicando falha no teste.',
      badge: 'Padrão'
    },
    {
      id: 'mixkit_sad_twang',
      name: 'Corda Desafinada / Decepção',
      url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      description: 'Ressonância descendente sutil de frustração.'
    },
    {
      id: 'mixkit_hollow_thud',
      name: 'Impacto Oco nas Profundezas',
      url: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      description: 'Baque seco de lâmina acertando armadura ou escudo.'
    },
    {
      id: 'synth_failure',
      name: 'Sintetizador Descendente (Web Audio)',
      url: 'synth:failure',
      description: 'Intervalo menor descendente sintetizado.',
      badge: '100% Offline'
    }
  ],
  critical: [
    {
      id: 'mixkit_heroic_fanfare',
      name: 'Fanfarra Épica & Trombetas',
      url: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
      description: 'Celebração gloriosa de acerto crítico / 20 Natural!',
      badge: 'Padrão'
    },
    {
      id: 'mixkit_stellar_conquest',
      name: 'Explosão de Glória Lendária',
      url: 'https://assets.mixkit.co/active_storage/sfx/1432/1432-preview.mp3',
      description: 'Impacto dramático com ressonância dourada cintilante.'
    },
    {
      id: 'mixkit_golden_victory',
      name: 'Golpe Crítico Divino',
      url: 'https://assets.mixkit.co/active_storage/sfx/1999/1999-preview.mp3',
      description: 'Clarão triunfal vibrante e majestoso.'
    },
    {
      id: 'synth_critical',
      name: 'Fanfarra Heroica em Sintetizador',
      url: 'synth:critical',
      description: 'Arpeggio brilhante pentatônico de alta fidelidade.',
      badge: '100% Offline'
    }
  ],
  fumble: [
    {
      id: 'mixkit_doom_gong',
      name: 'Gongo do Desastre / Perdição',
      url: 'https://assets.mixkit.co/active_storage/sfx/2550/2550-preview.mp3',
      description: 'Gongo sinistro anunciando falha crítica / 1 Natural!',
      badge: 'Padrão'
    },
    {
      id: 'mixkit_shattering_glass',
      name: 'Vidro Estilhaçando & Catástrofe',
      url: 'https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3',
      description: 'Som cortante e catastrófico de quebra.'
    },
    {
      id: 'mixkit_tragic_echo',
      name: 'Colapso nas Trevas',
      url: 'https://assets.mixkit.co/active_storage/sfx/2551/2551-preview.mp3',
      description: 'Eco horripilante de erro fatal com impacto sombrio.'
    },
    {
      id: 'synth_fumble',
      name: 'Sintetizador Colapso Fatal (Tritone)',
      url: 'synth:fumble',
      description: 'Tritono dissonante descendente com sub-grave profundo.',
      badge: '100% Offline'
    }
  ]
};

// Global audio playback tracking
let currentAudioElement: HTMLAudioElement | null = null;
let currentAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!currentAudioContext || currentAudioContext.state === 'closed') {
      currentAudioContext = new AudioCtx();
    }
    if (currentAudioContext.state === 'suspended') {
      currentAudioContext.resume().catch(() => {});
    }
    return currentAudioContext;
  } catch {
    return null;
  }
}

// ==========================================
// PROCEDURAL WEB AUDIO SYNTHESIZERS (FALLBACK)
// ==========================================

export function playSynthRollSound(volume: number = 0.3) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const rattleTimes = [0, 0.06, 0.13, 0.21, 0.31];

    rattleTimes.forEach((time, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(260 + Math.random() * 240, now + time);
      osc.frequency.exponentialRampToValueAtTime(70, now + time + 0.05);

      const vol = (volume * 0.7) / (index * 0.4 + 1);
      gain.gain.setValueAtTime(vol, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + 0.06);
    });
  } catch {
    // ignore
  }
}

export function playSynthSuccessSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Ascending major harmony: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz)
    const notes = [
      { freq: 659.25, time: 0, dur: 0.22, vol: 0.35 },
      { freq: 830.61, time: 0.08, dur: 0.25, vol: 0.4 },
      { freq: 987.77, time: 0.16, dur: 0.45, vol: 0.5 }
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(vol * volume, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch {
    // ignore
  }
}

export function playSynthFailureSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Descending melancholy minor notes: G4 (392Hz) -> Eb4 (311Hz) -> D4 (293Hz)
    const notes = [
      { freq: 392.00, time: 0, dur: 0.25, vol: 0.4 },
      { freq: 311.13, time: 0.12, dur: 0.35, vol: 0.45 },
      { freq: 293.66, time: 0.28, dur: 0.55, vol: 0.5 }
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.95, now + time + dur);

      // Low pass filter to make it dull and gloomy
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now + time);

      gain.gain.setValueAtTime(vol * volume * 0.4, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch {
    // ignore
  }
}

export function playSynthCriticalSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Heroic fanfare arpeggio: C5 (523Hz), E5 (659Hz), G5 (783Hz), C6 (1046Hz) + shimmer chime
    const notes = [
      { freq: 523.25, time: 0, dur: 0.18, vol: 0.4 },
      { freq: 659.25, time: 0.07, dur: 0.20, vol: 0.45 },
      { freq: 783.99, time: 0.14, dur: 0.25, vol: 0.5 },
      { freq: 1046.50, time: 0.22, dur: 0.60, vol: 0.65 },
      { freq: 1318.51, time: 0.28, dur: 0.55, vol: 0.35 }
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(vol * volume, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });

    // Metallic chime shimmer burst
    const noiseOsc = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    noiseOsc.type = 'sine';
    noiseOsc.frequency.setValueAtTime(2093.00, now + 0.22); // C7
    noiseGain.gain.setValueAtTime(0.2 * volume, now + 0.22);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    noiseOsc.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseOsc.start(now + 0.22);
    noiseOsc.stop(now + 0.7);
  } catch {
    // ignore
  }
}

export function playSynthFumbleSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Dissonant doom gong with devil's tritone: F#3 (185Hz) vs C3 (130Hz) sliding down into oblivion
    const drone1 = ctx.createOscillator();
    const drone2 = ctx.createOscillator();
    const gain = ctx.createGain();

    drone1.type = 'sawtooth';
    drone2.type = 'triangle';

    drone1.frequency.setValueAtTime(185, now);
    drone1.frequency.exponentialRampToValueAtTime(55, now + 0.8);

    drone2.frequency.setValueAtTime(130.81, now);
    drone2.frequency.exponentialRampToValueAtTime(45, now + 0.8);

    // Dark resonant low-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.8);

    gain.gain.setValueAtTime(volume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    drone1.connect(filter);
    drone2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    drone1.start(now);
    drone2.start(now);
    drone1.stop(now + 0.9);
    drone2.stop(now + 0.9);
  } catch {
    // ignore
  }
}

export function playSynthAttackSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Sword slash metallic whoosh + clash
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(volume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    // ignore
  }
}

export function playSynthShieldSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Metallic shield block resonance
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(520, now);
    osc1.frequency.exponentialRampToValueAtTime(180, now + 0.25);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1040, now);
    osc2.frequency.exponentialRampToValueAtTime(320, now + 0.2);

    gain.gain.setValueAtTime(volume * 0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  } catch {
    // ignore
  }
}

export function playSynthArrowSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);

    gain.gain.setValueAtTime(volume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // ignore
  }
}

export function playSynthDamageSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);

    gain.gain.setValueAtTime(volume * 0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch {
    // ignore
  }
}

export function playSynthSpellSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [350, 523, 659, 880, 1174];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + idx * 0.04 + 0.25);

      gain.gain.setValueAtTime(volume * 0.25, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.32);
    });
  } catch {
    // ignore
  }
}

export function playSynthHealSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(volume * 0.35, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.42);
    });
  } catch {
    // ignore
  }
}

export function playSynthFootstepsSound(volume: number = 0.4) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.2].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now + delay);
      osc.frequency.exponentialRampToValueAtTime(60, now + delay + 0.06);

      gain.gain.setValueAtTime(volume * 0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.08);
    });
  } catch {
    // ignore
  }
}

export function playSynthTrapSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Mechanical click + sudden spike snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);

    gain.gain.setValueAtTime(volume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // ignore
  }
}

export function playSynthChestSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Wood creak + coin shimmer
    const creak = ctx.createOscillator();
    const cGain = ctx.createGain();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(220, now);
    creak.frequency.exponentialRampToValueAtTime(340, now + 0.18);
    cGain.gain.setValueAtTime(volume * 0.35, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    creak.connect(cGain);
    cGain.connect(ctx.destination);
    creak.start(now);
    creak.stop(now + 0.25);

    // Coins
    [0.12, 0.18, 0.25].forEach(time => {
      const coin = ctx.createOscillator();
      const coinGain = ctx.createGain();
      coin.type = 'sine';
      coin.frequency.setValueAtTime(1900 + Math.random() * 600, now + time);
      coinGain.gain.setValueAtTime(volume * 0.3, now + time);
      coinGain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.08);
      coin.connect(coinGain);
      coinGain.connect(ctx.destination);
      coin.start(now + time);
      coin.stop(now + time + 0.09);
    });
  } catch {
    // ignore
  }
}

export function playSynthDoorSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);

    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);
  } catch {
    // ignore
  }
}

export function playSynthPingSound(volume: number = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5 radar ping
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

    gain.gain.setValueAtTime(volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch {
    // ignore
  }
}

export function playSynthMonsterRoarSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.6);

    gain.gain.setValueAtTime(volume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  } catch {
    // ignore
  }
}

export function playSynthLevelUpSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(volume * 0.45, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.55);
    });
  } catch {
    // ignore
  }
}

export function playSynthCombatStartSound(volume: number = 0.6) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Heavy war drum strike
    [0, 0.16].forEach((time, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120 - idx * 25, now + time);
      osc.frequency.exponentialRampToValueAtTime(40, now + time + 0.3);

      gain.gain.setValueAtTime(volume * 0.75, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + 0.38);
    });
  } catch {
    // ignore
  }
}

export function playSynthSound(type: SoundEffectType, volume: number = 0.5) {
  switch (type) {
    case 'diceRoll':
    case 'synth:roll':
      playSynthRollSound(volume);
      break;
    case 'success':
    case 'synth:success':
      playSynthSuccessSound(volume);
      break;
    case 'failure':
    case 'synth:failure':
      playSynthFailureSound(volume);
      break;
    case 'critical':
    case 'synth:critical':
      playSynthCriticalSound(volume);
      break;
    case 'fumble':
    case 'synth:fumble':
      playSynthFumbleSound(volume);
      break;
    case 'attack':
    case 'attackSound':
    case 'synth:attack':
      playSynthAttackSound(volume);
      break;
    case 'shield':
    case 'shieldSound':
    case 'synth:shield':
      playSynthShieldSound(volume);
      break;
    case 'arrow':
    case 'arrowSound':
    case 'synth:arrow':
      playSynthArrowSound(volume);
      break;
    case 'damage':
    case 'damageSound':
    case 'synth:damage':
      playSynthDamageSound(volume);
      break;
    case 'spell':
    case 'spellSound':
    case 'synth:spell':
      playSynthSpellSound(volume);
      break;
    case 'heal':
    case 'healSound':
    case 'synth:heal':
      playSynthHealSound(volume);
      break;
    case 'footsteps':
    case 'footstepsSound':
    case 'synth:footsteps':
      playSynthFootstepsSound(volume);
      break;
    case 'trap':
    case 'trapSound':
    case 'synth:trap':
      playSynthTrapSound(volume);
      break;
    case 'chest':
    case 'chestSound':
    case 'synth:chest':
      playSynthChestSound(volume);
      break;
    case 'door':
    case 'doorSound':
    case 'synth:door':
      playSynthDoorSound(volume);
      break;
    case 'ping':
    case 'pingSound':
    case 'synth:ping':
      playSynthPingSound(volume);
      break;
    case 'roar':
    case 'monsterRoarSound':
    case 'synth:roar':
      playSynthMonsterRoarSound(volume);
      break;
    case 'levelup':
    case 'levelUpSound':
    case 'synth:levelup':
      playSynthLevelUpSound(volume);
      break;
    case 'combat_start':
    case 'combatStartSound':
    case 'synth:combat_start':
      playSynthCombatStartSound(volume);
      break;
    default:
      playSynthRollSound(volume);
      break;
  }
}

// ==========================================
// UNIFIED ROBUST AUDIO PLAYER
// ==========================================

export function stopActiveAudio() {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }
}

/**
 * Plays an audio effect from URL or Base64 data URL.
 * Automatically falls back to procedural Web Audio synthesizer if URL is broken,
 * offline, blocked by browser policy, or if user selected a 'synth:' preset.
 */
export function playSoundEffect(
  type: SoundEffectType,
  soundUrl?: string,
  volume: number = 0.5
): HTMLAudioElement | null {
  // 1. Check if user configured explicit synth preset
  if (!soundUrl || soundUrl.startsWith('synth:')) {
    playSynthSound(type, volume);
    return null;
  }

  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    currentAudioElement = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`Audio element playback failed for ${type} (${soundUrl}), falling back to Web Audio synth:`, err);
        playSynthSound(type, volume);
      });
    }

    audio.onerror = () => {
      console.warn(`Audio error event fired for ${type}, falling back to Web Audio synth.`);
      playSynthSound(type, volume);
    };

    return audio;
  } catch (err) {
    console.warn(`Failed to instantiate Audio for ${type}, falling back to Web Audio synth:`, err);
    playSynthSound(type, volume);
    return null;
  }
}

/**
 * Specifically plays roll outcome audio based on result: 'critical' | 'fumble' | 'success' | 'failure'
 */
export function playRollOutcomeSound(
  outcome: RollOutcome,
  config: SoundConfig = {},
  volume: number = 0.6
): HTMLAudioElement | null {
  const effectiveConfig = { ...DEFAULT_SOUNDS, ...config };

  switch (outcome) {
    case 'critical':
      return playSoundEffect('critical', effectiveConfig.criticalSound, volume);
    case 'fumble':
      return playSoundEffect('fumble', effectiveConfig.fumbleSound, volume);
    case 'success':
      return playSoundEffect('success', effectiveConfig.successSound, volume * 0.9);
    case 'failure':
      return playSoundEffect('failure', effectiveConfig.failureSound, volume * 0.9);
  }
}

/**
 * Plays any configured system sound by its key (e.g. 'attackSound', 'spellSound', 'pingSound')
 */
export function playSystemSound(
  soundKey: string,
  config: SoundConfig = {},
  volume: number = 0.5
): HTMLAudioElement | null {
  const soundUrl = (config as any)[soundKey] || (DEFAULT_SOUNDS as any)[soundKey];
  return playSoundEffect(soundKey, soundUrl, volume);
}

// ==========================================
// FILE UPLOAD HELPER (MP3, WAV, OGG, WEBM)
// ==========================================

export interface AudioUploadResult {
  dataUrl: string;
  name: string;
  size: number;
  format: string;
}

/**
 * Validates and converts an uploaded audio file into a Base64 Data URL.
 * Recommends audio files under 2.5MB so they fit cleanly in Firestore.
 */
export function convertAudioFileToDataUrl(file: File): Promise<AudioUploadResult> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Nenhum arquivo fornecido.'));
      return;
    }

    const validMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/webm',
      'audio/aac',
      'audio/mp4',
      'audio/x-m4a'
    ];

    const isAudio = file.type.startsWith('audio/') || validMimes.includes(file.type);
    if (!isAudio && !/\.(mp3|wav|ogg|webm|m4a|aac)$/i.test(file.name)) {
      reject(new Error('Formato inválido. Por favor, selecione um arquivo de áudio (MP3, WAV, OGG, WebM ou M4A).'));
      return;
    }

    // 2.5 MB maximum limit to ensure fast transfers and Firestore document budget
    const MAX_SIZE_BYTES = 2.5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      reject(new Error('O arquivo de áudio é muito grande. Para efeitos sonoros, envie um áudio de até 2.5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
        resolve({
          dataUrl: reader.result,
          name: file.name,
          size: file.size,
          format: ext
        });
      } else {
        reject(new Error('Falha ao processar arquivo de áudio.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo do disco.'));
    };
    reader.readAsDataURL(file);
  });
}
