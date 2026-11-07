// Ambientações procedurais (atmosphereEngine.ts do sistema antigo): chuva,
// vento, taverna, caverna, tambores e santuário arcano, sintetizados com a
// Web Audio API (sem arquivos externos), ou uma trilha da biblioteca em loop.
// Se a trilha falhar, cai na caverna procedural, como no sistema antigo.

let context = null;
let master = null;
let volume = 0.5;
let nodes = [];
let timers = [];
let track = null;
let current = null;

function audioContext() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!context || context.state === 'closed') {
            context = new AudioCtx();
            master = null;
        }
        if (context.state === 'suspended') context.resume().catch(() => {});
        if (!master) {
            master = context.createGain();
            master.gain.setValueAtTime(volume, context.currentTime);
            master.connect(context.destination);
        }
        return context;
    } catch (error) {
        return null;
    }
}

function keep(...items) {
    nodes.push(...items);
}

function every(ms, callback) {
    timers.push(window.setInterval(callback, ms));
}

/** Ruído rosa em loop (base de chuva e vento). */
function noise(ctx, seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        data[i] = (b0 + b1 + b2) * 0.11;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

/** Nota curta: oscilador com envelope que some sozinho. */
function blip(ctx, { type = 'sine', from, to = from, level, duration, filter = null, delay = 0 }) {
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    let node = oscillator;
    if (filter) {
        const biquad = ctx.createBiquadFilter();
        biquad.type = filter[0];
        biquad.frequency.setValueAtTime(filter[1], now);
        oscillator.connect(biquad);
        node = biquad;
    }
    node.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
}

/** Tom contínuo até a ambientação parar. */
function drone(ctx, type, frequency, level) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(level, ctx.currentTime);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    keep(oscillator, gain);
    return gain;
}

const SCAPES = {
    dungeon_rain(ctx) {
        const rain = noise(ctx, 4);
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.setValueAtTime(1100, ctx.currentTime);
        band.Q.setValueAtTime(0.8, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        rain.connect(band);
        band.connect(gain);
        gain.connect(master);
        rain.start();
        keep(rain, band, gain);

        every(450, () => {
            const from = 1200 + Math.random() * 800;
            blip(ctx, { from, to: from * 1.5, level: 0.18 + Math.random() * 0.1, duration: 0.08 });
        });
        every(11000, () => {
            const now = ctx.currentTime;
            const oscillator = ctx.createOscillator();
            const filter = ctx.createBiquadFilter();
            const thunder = ctx.createGain();
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(70 + Math.random() * 30, now);
            oscillator.frequency.exponentialRampToValueAtTime(35, now + 2.5);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(180, now);
            thunder.gain.setValueAtTime(0.001, now);
            thunder.gain.linearRampToValueAtTime(0.4, now + 0.6);
            thunder.gain.exponentialRampToValueAtTime(0.001, now + 3);
            oscillator.connect(filter);
            filter.connect(thunder);
            thunder.connect(master);
            oscillator.start(now);
            oscillator.stop(now + 3.1);
        });
    },

    cold_wind(ctx) {
        const wind = noise(ctx, 5);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(350, ctx.currentTime);
        filter.Q.setValueAtTime(3.5, ctx.currentTime);
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.18, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(240, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        wind.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        wind.start();
        lfo.start();
        keep(wind, filter, lfo, lfoGain, gain);
    },

    tavern(ctx) {
        drone(ctx, 'sine', 110, 0.2);
        every(120, () => {
            blip(ctx, {
                type: Math.random() > 0.5 ? 'triangle' : 'sawtooth',
                from: 800 + Math.random() * 1200,
                level: 0.15 + Math.random() * 0.15,
                duration: 0.025,
            });
        });
    },

    deep_cavern(ctx) {
        drone(ctx, 'sine', 55, 0.35);
        drone(ctx, 'triangle', 82.4, 0.15);
        every(1800, () => {
            const from = 750 + Math.random() * 400;
            blip(ctx, { from, to: from * 1.8, level: 0.2, duration: 0.1 });
            blip(ctx, { from: from * 0.9, level: 0.08, duration: 0.25, delay: 0.18 });
        });
    },

    combat_drums(ctx) {
        let step = 0;
        every((60 / 110) * 1000 * 0.5, () => {
            const heavy = step % 4 === 0;
            if (heavy || Math.random() > 0.4) {
                blip(ctx, { type: 'triangle', from: heavy ? 110 : 85, to: 38, level: heavy ? 0.45 : 0.25, duration: 0.25 });
            }
            if (step % 2 === 1) {
                blip(ctx, { type: 'sawtooth', from: 320 + Math.random() * 120, level: 0.12, duration: 0.06 });
            }
            step = (step + 1) % 8;
        });
    },

    arcane_mystery(ctx) {
        [432, 648, 864].forEach((frequency, index) => {
            const gain = drone(ctx, 'sine', frequency, 0.2 - index * 0.04);
            const tremolo = ctx.createOscillator();
            tremolo.frequency.setValueAtTime(0.3 + index * 0.15, ctx.currentTime);
            const depth = ctx.createGain();
            depth.gain.setValueAtTime(0.06, ctx.currentTime);
            tremolo.connect(depth);
            depth.connect(gain.gain);
            tremolo.start();
            keep(tremolo, depth);
        });
    },
};

export const SOUNDSCAPES = Object.keys(SCAPES);

export function stopAmbience() {
    timers.forEach((id) => window.clearInterval(id));
    timers = [];
    nodes.forEach((node) => {
        try {
            node.stop?.();
            node.disconnect();
        } catch (error) {
            // já parado
        }
    });
    nodes = [];
    if (track) {
        track.pause();
        track.src = '';
        track = null;
    }
    current = null;
}

/** Ambientação atual: "dungeon_rain"..., "track:<url>" ou null. */
export function currentAmbience() {
    return current;
}

export function playSoundscape(type) {
    if (current === type) return;
    stopAmbience();
    const ctx = audioContext();
    if (!ctx || !SCAPES[type]) return;
    current = type;
    SCAPES[type](ctx);
}

export function playTrack(url) {
    const key = `track:${url}`;
    if (current === key) return;
    stopAmbience();
    current = key;

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    const fallback = () => {
        if (track === audio) {
            track = null;
            current = null;
            playSoundscape('deep_cavern');
        }
    };
    audio.addEventListener('error', fallback, { once: true });
    audio.play().catch(fallback);
    track = audio;
}

export function setAmbienceVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    if (master && context) master.gain.setTargetAtTime(volume, context.currentTime, 0.05);
    if (track) track.volume = volume;
}
