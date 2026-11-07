// Sons do rolador (soundEngine.ts do sistema antigo).
// Toca o áudio configurado pelo mestre nas regras; sem configuração,
// com "synth:" ou se o áudio falhar, gera o som com a Web Audio API.
// Os efeitos do mestre (ataque, porta, rugido...) seguem a mesma regra.

let context = null;
let currentAudio = null;

function audioContext() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;

        if (!AudioCtx) return null;
        if (!context || context.state === 'closed') context = new AudioCtx();
        if (context.state === 'suspended') context.resume().catch(() => {});

        return context;
    } catch (error) {
        return null;
    }
}

/** Notas: [frequência, início, duração, volume, forma da onda]. */
function playNotes(notes, volume, { lowpass = null, slide = 1 } = {}) {
    const ctx = audioContext();

    if (!ctx) return;

    const now = ctx.currentTime;

    notes.forEach(([frequency, start, duration, level, type = 'triangle']) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now + start);

        if (slide !== 1) {
            oscillator.frequency.exponentialRampToValueAtTime(frequency * slide, now + start + duration);
        }

        gain.gain.setValueAtTime(level * volume, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        let node = oscillator;

        if (lowpass) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(lowpass, now + start);
            oscillator.connect(filter);
            node = filter;
        }

        node.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + start);
        oscillator.stop(now + start + duration + 0.01);
    });
}

/**
 * Uma voz com glissando: { type, from, to, start, duration, level, filter: [tipo, frequência, Q] }.
 * Usada pelos efeitos do mestre (playSynth*Sound do sistema antigo).
 */
function voices(list, volume) {
    const ctx = audioContext();

    if (!ctx) return;

    const now = ctx.currentTime;

    list.forEach(({ type = 'sine', from, to = from, start = 0, duration, level, filter = null }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, now + start);
        if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, now + start + duration);

        gain.gain.setValueAtTime(level * volume, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        let node = oscillator;
        if (filter) {
            const biquad = ctx.createBiquadFilter();
            biquad.type = filter[0];
            biquad.frequency.setValueAtTime(filter[1], now + start);
            if (filter[2]) biquad.Q.setValueAtTime(filter[2], now + start);
            oscillator.connect(biquad);
            node = biquad;
        }

        node.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + start);
        oscillator.stop(now + start + duration + 0.03);
    });
}

const SYNTH = {
    attack: (volume) => voices([{ type: 'sawtooth', from: 800, to: 140, duration: 0.16, level: 0.7, filter: ['bandpass', 1200, 2.5] }], volume),
    shield: (volume) => voices([
        { type: 'triangle', from: 520, to: 180, duration: 0.28, level: 0.65 },
        { type: 'sine', from: 1040, to: 320, duration: 0.28, level: 0.65 },
    ], volume),
    arrow: (volume) => voices([{ type: 'triangle', from: 1600, to: 240, duration: 0.14, level: 0.45 }], volume),
    damage: (volume) => voices([{ type: 'sawtooth', from: 130, to: 45, duration: 0.25, level: 0.75, filter: ['lowpass', 350] }], volume),
    spell: (volume) => voices([350, 523, 659, 880, 1174].map((from, index) => ({ from, to: from * 1.5, start: index * 0.04, duration: 0.3, level: 0.25 })), volume),
    heal: (volume) => voices([523.25, 659.25, 783.99, 1046.5].map((from, index) => ({ type: 'triangle', from, start: index * 0.08, duration: 0.4, level: 0.35 })), volume),
    footsteps: (volume) => voices([0, 0.2].map((start) => ({ type: 'triangle', from: 180, to: 60, start, duration: 0.07, level: 0.3 })), volume),
    trap: (volume) => voices([{ type: 'sawtooth', from: 1400, to: 120, duration: 0.12, level: 0.7 }], volume),
    chest: (volume) => voices([
        { type: 'sawtooth', from: 220, to: 340, duration: 0.22, level: 0.35 },
        ...[0.12, 0.18, 0.25].map((start) => ({ from: 1900 + Math.random() * 600, start, duration: 0.08, level: 0.3 })),
    ], volume),
    door: (volume) => voices([{ type: 'sawtooth', from: 95, to: 65, duration: 0.45, level: 0.5, filter: ['lowpass', 260] }], volume),
    ping: (volume) => voices([{ from: 880, to: 440, duration: 0.3, level: 0.6 }], volume),
    monster_roar: (volume) => voices([{ type: 'sawtooth', from: 95, to: 45, duration: 0.65, level: 0.8, filter: ['lowpass', 380] }], volume),
    level_up: (volume) => voices([440, 554.37, 659.25, 880, 1108.73].map((from, index) => ({ type: 'triangle', from, start: index * 0.08, duration: 0.5, level: 0.45 })), volume),
    combat_start: (volume) => voices([0, 0.16].map((start, index) => ({ type: 'triangle', from: 120 - index * 25, to: 40, start, duration: 0.35, level: 0.75 })), volume),

    diceRoll(volume) {
        playNotes([0, 0.06, 0.13, 0.21, 0.31].map((start, index) => [
            260 + Math.random() * 240, start, 0.05, 0.7 / (index * 0.4 + 1), index % 2 === 0 ? 'triangle' : 'sine',
        ]), volume, { slide: 0.27 });
    },
    success(volume) {
        playNotes([[659.25, 0, 0.22, 0.35], [830.61, 0.08, 0.25, 0.4], [987.77, 0.16, 0.45, 0.5]], volume);
    },
    failure(volume) {
        playNotes([[392, 0, 0.25, 0.16, 'sawtooth'], [311.13, 0.12, 0.35, 0.18, 'sawtooth'], [293.66, 0.28, 0.55, 0.2, 'sawtooth']], volume, { lowpass: 800, slide: 0.95 });
    },
    critical(volume) {
        playNotes([[523.25, 0, 0.18, 0.4], [659.25, 0.07, 0.2, 0.45], [783.99, 0.14, 0.25, 0.5], [1046.5, 0.22, 0.6, 0.65], [1318.51, 0.28, 0.55, 0.35], [2093, 0.22, 0.48, 0.2, 'sine']], volume);
    },
    fumble(volume) {
        playNotes([[185, 0, 0.85, 0.7, 'sawtooth'], [130.81, 0, 0.85, 0.7, 'triangle']], volume, { lowpass: 450, slide: 0.3 });
    },
};

export function stopSound() {
    if (currentAudio) {
        try {
            currentAudio.pause();
        } catch (error) {
            // ignora
        }
        currentAudio = null;
    }
}

// Os efeitos das regras usam chaves com sublinhado (dice_roll); o rolador usa diceRoll.
const ALIASES = { dice_roll: 'diceRoll' };

/**
 * type: diceRoll | success | failure | critical | fumble, ou um efeito do
 * mestre (attack, shield, arrow, damage, spell, heal, footsteps, trap, chest,
 * door, ping, monster_roar, level_up, combat_start).
 */
export function playEffect(type, url, volume = 0.5) {
    const synthKey = ALIASES[type] ?? type;
    const synth = () => SYNTH[synthKey]?.(volume);

    if (!url || url.startsWith('synth:')) {
        synth();
        return null;
    }

    let fellBack = false;
    const fallback = () => {
        if (!fellBack) {
            fellBack = true;
            synth();
        }
    };

    try {
        const audio = new Audio(url);
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.addEventListener('error', fallback, { once: true });
        audio.play().catch(fallback);
        currentAudio = audio;

        return audio;
    } catch (error) {
        synth();
        return null;
    }
}

/** Som do resultado (crítico, falha crítica, sucesso ou falha). */
export function playOutcome(outcome, sounds = {}, volume = 0.6) {
    const urls = { critical: sounds.critical, fumble: sounds.fumble, success: sounds.success, failure: sounds.failure };

    return playEffect(outcome, urls[outcome], outcome === 'success' || outcome === 'failure' ? volume * 0.9 : volume);
}
