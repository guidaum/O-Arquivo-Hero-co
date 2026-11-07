// Ambientação da mesa (GMAudioController.tsx) no menu de ações.
// - Todos: acompanham a trilha escolhida pelo mestre e os efeitos "para a
//   mesa" (polling em /campanhas/{id}/ambiente via core/realtime.js). Os
//   navegadores só tocam áudio depois de um clique, então ouvir é uma
//   escolha de cada um (guardada no navegador), assim como o volume.
// - Mestre: troca a trilha (procedural ou da biblioteca) e dispara efeitos.

import { request, postJson } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';
import { subscribe } from '../core/realtime.js';
import { playEffect } from '../core/sound.js';
import { playSoundscape, playTrack, setAmbienceVolume, stopAmbience } from '../core/ambience.js';

const LISTEN_KEY = 'ambience-listen';
const EFFECTS_KEY = 'ambience-effects';
const VOLUME_KEY = 'ambience-volume';

const panel = document.querySelector('[data-ambience]');

function stored(key, fallback) {
    try {
        return window.localStorage.getItem(key) ?? fallback;
    } catch (error) {
        return fallback;
    }
}

function store(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        // navegação privada: vale só nesta página
    }
}

if (panel) {
    const config = JSON.parse(panel.dataset.config);
    const $ = (selector) => panel.querySelector(selector);
    const listenInput = $('[data-ambience-listen]');
    const effectsInput = $('[data-ambience-effects]');
    const volumeInput = $('[data-ambience-volume]');
    const errorBox = $('[data-ambience-error]');

    const state = {
        open: false,
        version: null,
        ambience: { soundscape: null, label: 'Silêncio', track_url: null, volume: 50, effect: null },
        lastEffectAt: null,
        listen: stored(LISTEN_KEY, '0') === '1',
        effects: stored(EFFECTS_KEY, '1') === '1',
        volume: Number(stored(VOLUME_KEY, '60')),
    };

    listenInput.checked = state.listen;
    effectsInput.checked = state.effects;
    volumeInput.value = String(state.volume);

    const masterVolume = () => (state.volume / 100) * ((state.ambience.volume ?? 50) / 50) * 0.5;

    function applyAmbience() {
        $('[data-ambience-now]').textContent = state.ambience.label ?? 'Silêncio';
        setAmbienceVolume(Math.min(1, masterVolume()));

        if (!state.listen || !state.ambience.soundscape) {
            stopAmbience();
        } else if (state.ambience.track_url) {
            playTrack(state.ambience.track_url);
        } else {
            playSoundscape(state.ambience.soundscape);
        }

        panel.querySelectorAll('[data-scape]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.scape === (state.ambience.soundscape ?? 'none')));
        });
    }

    function playLocal(key) {
        playEffect(key, config.sounds?.[key] ?? null, Math.min(1, state.volume / 100));
    }

    function receive(body) {
        state.version = body.version;
        if (!body.changed) return;

        state.ambience = body;
        const effect = body.effect;

        // Na primeira resposta só registra o último efeito (não repete o passado).
        if (effect && state.lastEffectAt !== null && effect.at > state.lastEffectAt && effect.fresh && state.effects && !config.isGm) {
            playLocal(effect.key);
        }
        state.lastEffectAt = Math.max(state.lastEffectAt ?? 0, effect?.at ?? 0);

        applyAmbience();
    }

    const interval = () => (state.listen || state.effects ? 4000 : 20000);
    const feed = subscribe(config.stateUrl, {
        interval: interval(),
        params: () => ({ versao: state.version ?? undefined }),
        onData: receive,
    });

    // Preferências do participante

    listenInput.addEventListener('change', () => {
        state.listen = listenInput.checked;
        store(LISTEN_KEY, state.listen ? '1' : '0');
        feed.setInterval(interval());
        applyAmbience();
    });

    effectsInput.addEventListener('change', () => {
        state.effects = effectsInput.checked;
        store(EFFECTS_KEY, state.effects ? '1' : '0');
        feed.setInterval(interval());
    });

    volumeInput.addEventListener('input', () => {
        state.volume = Number(volumeInput.value);
        store(VOLUME_KEY, String(state.volume));
        setAmbienceVolume(Math.min(1, masterVolume()));
    });

    // Painel

    function setOpen(open) {
        state.open = open;
        panel.hidden = !open;
        document.dispatchEvent(new CustomEvent('tool:state', { detail: { tool: 'ambience', open } }));
    }

    document.addEventListener('tool:toggle', (event) => {
        if (event.detail?.tool === 'ambience') setOpen(event.detail.open ?? !state.open);
    });
    document.addEventListener('tool:state', (event) => {
        if (event.detail?.tool !== 'ambience' && event.detail?.open && state.open) setOpen(false);
    });

    // Mestre: trilhas e mesa de efeitos

    if (config.isGm) {
        const fail = (failure) => { errorBox.textContent = failure.message; };

        async function changeAmbience(data) {
            errorBox.textContent = '';
            try {
                const body = await request(config.updateUrl, { method: 'PUT', data });
                // O mestre que escolhe uma trilha quer ouvi-la.
                if (body.soundscape && !state.listen) {
                    listenInput.checked = true;
                    listenInput.dispatchEvent(new Event('change'));
                }
                state.ambience = { ...state.ambience, ...body };
                state.version = null;
                applyAmbience();
            } catch (failure) {
                fail(failure);
            }
        }

        replace($('[data-ambience-scapes]'),
            el('button', { type: 'button', class: 'chip', 'data-scape': 'none', onClick: () => changeAmbience({ soundscape: 'none' }) }, icon('volume-off', 14), ' Silêncio'),
            ...config.soundscapes.map((scape) => el('button', {
                type: 'button',
                class: 'chip',
                'data-scape': scape.key,
                title: scape.description,
                onClick: () => changeAmbience({ soundscape: scape.key }),
            }, scape.label)),
        );

        const trackSelect = $('[data-ambience-track]');
        const ambientFirst = [...config.tracks].sort((a, b) => Number(b.ambient) - Number(a.ambient));
        ambientFirst.forEach((track) => trackSelect.append(el('option', { value: String(track.id) }, track.name)));
        trackSelect.disabled = config.tracks.length === 0;
        trackSelect.addEventListener('change', () => {
            if (trackSelect.value) changeAmbience({ soundscape: 'custom', sound_id: Number(trackSelect.value) });
            trackSelect.value = '';
        });

        const broadcast = $('[data-ambience-broadcast]');
        replace($('[data-ambience-board]'), ...config.effects
            .filter((effect) => !['dice_roll', 'success', 'failure', 'critical', 'fumble'].includes(effect.key))
            .map((effect) => el('button', {
                type: 'button',
                class: `ambience-board__pad ambience-board__pad--${effect.category}`,
                onClick: async () => {
                    playLocal(effect.key);
                    if (!broadcast.checked) return;
                    try {
                        const body = await postJson(config.effectUrl, { effect: effect.key });
                        state.lastEffectAt = Math.max(state.lastEffectAt ?? 0, body.effect?.at ?? 0);
                    } catch (failure) {
                        fail(failure);
                    }
                },
            }, effect.label)));
    }

    window.addEventListener('pagehide', () => {
        feed.stop();
        stopAmbience();
    });
}
