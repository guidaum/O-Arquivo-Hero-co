// Rolador de Dados (DiceRoller.tsx + DiceAnimationOverlay.tsx).
//
// O servidor rola (POST /dados/rolar) e, numa campanha, publica no chat.
// Aqui ficam a animação, os sons e o histórico (guardado no navegador,
// como no sistema antigo). Outras telas podem pedir uma rolagem com:
// document.dispatchEvent(new CustomEvent('dice:roll', { detail: { sides: 20, quantity: 1, modifier: 2 } }))

import { postJson } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';
import { playEffect, playOutcome, stopSound } from '../core/sound.js';

const HISTORY_KEY = 'dice-history';
const SOUND_KEY = 'dice-sound';
const HISTORY_LIMIT = 50;
const MIN_SPIN = 900;
const AUTO_CLOSE = 3800;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Contorno de cada dado na animação (viewBox 0 0 100 100).
const SHAPES = {
    4: '50,8 94,88 6,88',
    6: '12,12 88,12 88,88 12,88',
    8: '50,4 94,50 50,96 6,50',
    10: '50,4 92,38 50,96 8,38',
    12: '50,4 92,34 76,90 24,90 8,34',
    20: '50,6 92,28 92,72 50,94 8,72 8,28',
    100: '50,4 92,38 50,96 8,38',
};

const OUTCOME_ICONS = { critical: 'sparkles', fumble: 'skull', success: 'check', failure: 'alert-circle' };

function stored(key, fallback) {
    try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function store(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Armazenamento indisponível: o histórico vale só para esta página.
    }
}

const panel = document.querySelector('[data-dice]');

if (panel) {
    const config = JSON.parse(panel.dataset.config);
    const $ = (selector) => panel.querySelector(selector);
    const quantityInput = $('[data-dice-quantity]');
    const modifierInput = $('[data-dice-modifier]');
    const targetToggle = $('[data-dice-target-toggle]');
    const targetInput = $('[data-dice-target]');
    const underButton = $('[data-dice-under]');
    const stage = $('[data-dice-stage]');
    const face = $('[data-dice-face]');
    const polygon = $('[data-dice-polygon]');
    const resultBox = $('[data-dice-result]');
    const error = $('[data-dice-error]');

    const state = {
        open: false,
        sides: 20,
        mode: 'normal',
        rollUnder: true,
        rolling: false,
        sound: stored(SOUND_KEY, true) !== false,
        history: stored(HISTORY_KEY, []),
        filter: 'all',
        cleared: null,
        last: null,
    };
    let autoCloseTimer;
    let rollingAudio = null;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
    const quantity = () => clamp(parseInt(quantityInput.value, 10), 1, Number(quantityInput.max));
    const modifier = () => clamp(parseInt(modifierInput.value, 10) || 0, -100, 100);
    const target = () => (targetToggle.checked && targetInput.value !== '' ? clamp(parseInt(targetInput.value, 10), -100, 1000) : null);

    // Abrir e fechar (menu de ações)

    function setOpen(open) {
        state.open = open;
        panel.hidden = !open;
        document.dispatchEvent(new CustomEvent('tool:state', { detail: { tool: 'dice', open } }));
    }

    document.addEventListener('tool:toggle', (event) => {
        if (event.detail?.tool === 'dice') setOpen(event.detail.open ?? !state.open);
    });
    document.addEventListener('tool:state', (event) => {
        if (event.detail?.tool !== 'dice' && event.detail?.open && state.open) setOpen(false);
    });

    // Configuração da rolagem

    function formulaText() {
        const mod = modifier();
        let text = `${quantity()}d${state.sides}`;

        // Como no servidor: a vantagem aparece na fórmula, mas só vale com um dado.
        if (state.mode === 'advantage') text += ' (Vantagem)';
        if (state.mode === 'disadvantage') text += ' (Desvantagem)';
        if (mod !== 0) text += mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`;
        if (target() !== null) text += ` vs ${state.rollUnder ? '≤' : '≥'}${target()}`;

        return text;
    }

    function updateControls() {
        panel.querySelectorAll('[data-die]').forEach((button) => button.setAttribute('aria-checked', String(Number(button.dataset.die) === state.sides)));
        panel.querySelectorAll('[data-dice-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.diceMode === state.mode)));
        targetInput.disabled = !targetToggle.checked;
        underButton.setAttribute('aria-pressed', String(state.rollUnder));
        underButton.textContent = state.rollUnder ? 'Menor é melhor (≤)' : 'Maior é melhor (≥)';
        underButton.title = state.rollUnder ? 'Menor é melhor: passa quem rolar até a meta' : 'Maior é melhor: passa quem alcançar a meta';
        $('[data-dice-formula]').textContent = formulaText();
        polygon.setAttribute('points', SHAPES[state.sides]);
    }

    panel.querySelectorAll('[data-die]').forEach((button) => button.addEventListener('click', () => {
        state.sides = Number(button.dataset.die);
        updateControls();
        roll();
    }));

    panel.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
        const input = button.dataset.step === 'quantity' ? quantityInput : modifierInput;
        input.value = String(clamp((parseInt(input.value, 10) || 0) + Number(button.dataset.delta), Number(input.min), Number(input.max)));
        updateControls();
    }));

    [quantityInput, modifierInput, targetInput].forEach((input) => input.addEventListener('input', updateControls));
    targetToggle.addEventListener('change', updateControls);

    panel.querySelectorAll('[data-dice-mode]').forEach((button) => button.addEventListener('click', () => {
        state.mode = button.dataset.diceMode;
        updateControls();
    }));

    underButton.addEventListener('click', () => {
        state.rollUnder = !state.rollUnder;
        updateControls();
    });

    // Som

    const soundButton = $('[data-dice-sound]');

    function updateSoundButton() {
        soundButton.setAttribute('aria-pressed', String(state.sound));
        soundButton.title = state.sound ? 'Som ativado (clique para silenciar)' : 'Som desativado (clique para ativar)';
        replace(soundButton, icon(state.sound ? 'volume' : 'volume-off', 18));
    }

    soundButton.addEventListener('click', () => {
        state.sound = !state.sound;
        store(SOUND_KEY, state.sound);
        if (!state.sound) stopSound();
        updateSoundButton();
    });

    // Rolagem com animação

    function spin() {
        stage.hidden = false;
        stage.className = 'dice-stage is-spinning';
        replace(resultBox, el('p', { class: 'dice-stage__rolling' }, icon('sparkles', 14), ' Os dados estão rolando...'));

        // Movimento reduzido: sem a troca rápida de números (piscaria 14 vezes por segundo).
        if (reducedMotion.matches) {
            face.textContent = '?';

            return () => {};
        }

        const shuffle = setInterval(() => {
            face.textContent = String(Math.floor(Math.random() * state.sides) + 1);
        }, 70);

        return () => clearInterval(shuffle);
    }

    function showResult(result, posted) {
        stage.className = `dice-stage is-${result.outcome}`;
        face.textContent = String(result.quantity === 1 && result.modifier === 0 ? result.rolls[0] : result.total);

        replace(resultBox,
            el('div', { class: 'dice-stage__dice' },
                result.rolls.map((value) => el('span', { class: 'dice-chip' }, String(value))),
                result.discarded_rolls.map((value) => el('span', { class: 'dice-chip dice-chip--discarded', title: 'Descartado pela vantagem/desvantagem' }, String(value))),
                result.modifier !== 0 ? el('span', { class: 'dice-stage__modifier' }, result.modifier > 0 ? `+ ${result.modifier}` : `- ${Math.abs(result.modifier)}`) : null),
            el('p', { class: 'dice-stage__outcome' }, icon(OUTCOME_ICONS[result.outcome], 16), result.outcome_label),
            el('p', { class: 'dice-stage__total' }, 'Total: ', el('strong', {}, String(result.total))),
            el('p', { class: 'dice-stage__formula' }, result.formula, posted ? ' · enviado ao chat' : ''));

        clearTimeout(autoCloseTimer);
        autoCloseTimer = setTimeout(() => { stage.hidden = true; }, AUTO_CLOSE);
    }

    async function roll(overrides = {}) {
        if (state.rolling) return;

        const request = {
            sides: overrides.sides ?? state.sides,
            quantity: overrides.quantity ?? quantity(),
            modifier: overrides.modifier ?? modifier(),
            advantage_mode: overrides.advantage_mode ?? state.mode,
            target: overrides.target !== undefined ? overrides.target : target(),
            roll_under: overrides.roll_under ?? state.rollUnder,
            game_session_id: config.sessionId,
            character_id: config.characterId,
        };

        state.rolling = true;
        error.textContent = '';
        clearTimeout(autoCloseTimer);
        polygon.setAttribute('points', SHAPES[request.sides] ?? SHAPES[20]);
        const stopShuffle = spin();

        if (state.sound) {
            stopSound();
            rollingAudio = playEffect('diceRoll', config.sounds?.diceRoll, 0.4);
        }

        try {
            const [body] = await Promise.all([postJson(config.rollUrl, request), new Promise((resolve) => setTimeout(resolve, MIN_SPIN))]);
            stopShuffle();
            rollingAudio?.pause?.();
            showResult(body.roll, body.posted);
            addToHistory(body.roll);

            if (state.sound) playOutcome(body.roll.outcome, config.sounds ?? {});
        } catch (failure) {
            stopShuffle();
            stage.hidden = true;
            error.textContent = failure.message;
        } finally {
            state.rolling = false;
        }
    }

    $('[data-dice-roll]').addEventListener('click', () => roll());
    $('[data-dice-reroll]').addEventListener('click', () => (state.last ? roll(requestOf(state.last)) : roll()));
    $('[data-dice-stage-close]').addEventListener('click', () => {
        clearTimeout(autoCloseTimer);
        stage.hidden = true;
    });

    // Pedidos de outras telas.
    document.addEventListener('dice:roll', (event) => {
        const detail = event.detail ?? {};
        state.sides = SHAPES[detail.sides] ? Number(detail.sides) : 20;
        quantityInput.value = String(detail.quantity ?? 1);
        modifierInput.value = String(detail.modifier ?? 0);
        state.mode = detail.advantage_mode ?? 'normal';
        updateControls();
        setOpen(true);
        roll();
    });

    // Histórico

    function requestOf(entry) {
        return {
            sides: entry.sides,
            quantity: entry.quantity,
            modifier: entry.modifier,
            advantage_mode: entry.advantage_mode,
            target: entry.target,
            roll_under: entry.roll_under,
        };
    }

    function saveHistory() {
        state.history = state.history.slice(0, HISTORY_LIMIT);
        store(HISTORY_KEY, state.history);
        renderHistory();
    }

    function addToHistory(result) {
        const now = new Date();
        const entry = { ...result, id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
        state.last = entry;
        state.history.unshift(entry);
        state.cleared = null;
        saveHistory();
    }

    function copyText(entry) {
        return `🎲 ${entry.formula} = ${entry.total} (${entry.details}) - ${entry.outcome_label}`;
    }

    function renderStats() {
        const history = state.history;
        const count = (outcome) => history.filter((entry) => entry.outcome === outcome).length;
        const average = history.length ? Math.round((history.reduce((sum, entry) => sum + entry.total, 0) / history.length) * 10) / 10 : 0;

        replace($('[data-dice-stats]'), [
            ['Total', history.length],
            ['Críticos', count('critical')],
            ['Sucessos', count('success')],
            ['Desastres', count('fumble')],
            ['Média', average.toLocaleString('pt-BR')],
        ].map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, String(value)))));
    }

    function renderHistory() {
        renderStats();

        const list = state.history.filter((entry) => state.filter === 'all' || String(entry.sides) === state.filter);
        $('[data-dice-undo]').hidden = !state.cleared;

        replace($('[data-dice-history]'), list.length === 0
            ? el('li', { class: 'dice-history__empty' }, state.history.length ? 'Nenhuma rolagem com este dado.' : 'Nenhuma rolagem ainda.')
            : list.map((entry) => el('li', { class: `dice-history__item is-${entry.outcome}` },
                el('div', { class: 'dice-history__main' },
                    el('span', { class: 'dice-history__total' }, String(entry.total)),
                    el('span', {},
                        el('strong', {}, entry.formula),
                        el('small', {}, `${entry.details} · ${entry.outcome_label} · ${entry.time}`))),
                el('div', { class: 'dice-history__actions' },
                    el('button', { type: 'button', class: 'icon-button', title: 'Rolar novamente a mesma fórmula', onClick: () => { showRoller(); roll(requestOf(entry)); } }, icon('rotate-ccw', 15)),
                    el('button', { type: 'button', class: 'icon-button', title: 'Copiar resultado', 'data-copy': copyText(entry) }, icon('copy', 15)),
                    el('button', {
                        type: 'button',
                        class: 'icon-button',
                        title: 'Excluir esta rolagem do histórico',
                        onClick: () => {
                            state.history = state.history.filter((item) => item.id !== entry.id);
                            saveHistory();
                        },
                    }, icon('trash', 15))))));
    }

    $('[data-dice-filter]').addEventListener('change', (event) => {
        state.filter = event.target.value;
        renderHistory();
    });

    const clearButton = $('[data-dice-clear]');
    let confirmTimer;

    clearButton.addEventListener('click', () => {
        if (state.history.length === 0) return;

        if (!clearButton.classList.contains('is-confirming')) {
            clearButton.classList.add('is-confirming');
            $('[data-dice-clear-label]').textContent = 'Confirmar?';
            confirmTimer = setTimeout(() => {
                clearButton.classList.remove('is-confirming');
                $('[data-dice-clear-label]').textContent = 'Limpar';
            }, 3000);
            return;
        }

        clearTimeout(confirmTimer);
        clearButton.classList.remove('is-confirming');
        $('[data-dice-clear-label]').textContent = 'Limpar';
        state.cleared = state.history;
        state.history = [];
        saveHistory();
    });

    $('[data-dice-undo]').addEventListener('click', () => {
        state.history = state.cleared ?? [];
        state.cleared = null;
        saveHistory();
    });

    // Abas

    function showTab(name) {
        panel.querySelectorAll('[data-dice-tab]').forEach((tab) => {
            if (tab.dataset.diceTab === name) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });
        panel.querySelectorAll('[data-dice-view]').forEach((view) => { view.hidden = view.dataset.diceView !== name; });
    }

    function showRoller() {
        showTab('roller');
    }

    panel.querySelectorAll('[data-dice-tab]').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.diceTab)));

    updateControls();
    updateSoundButton();
    renderHistory();
}
