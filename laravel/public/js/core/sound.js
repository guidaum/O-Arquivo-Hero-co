// Sons do rolador (soundEngine.ts do sistema antigo).
// Toca o áudio configurado pelo mestre nas regras; sem configuração,
// com "synth:" ou se o áudio falhar, gera o som com a Web Audio API.
// Os sons de efeito (ataque, porta, rugido...) chegam com o painel do mestre.

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

const SYNTH = {
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

/** type: diceRoll | success | failure | critical | fumble. */
export function playEffect(type, url, volume = 0.5) {
    const synth = () => SYNTH[type]?.(volume);

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
