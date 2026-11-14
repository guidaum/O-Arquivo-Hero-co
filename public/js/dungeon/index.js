// Battlemap da masmorra (DungeonMap.tsx).
//
// O estado chega por core/realtime.js (só reenviado quando a versão muda).
// Modos: mover (arrastar tokens e áreas), régua, sinal, área de efeito,
// marcador, desenho e névoa (mestre). Arrastar o mapa vazio move a câmera.
// O servidor decide quem pode o quê; aqui a tela só oferece o que cabe a cada um.
//
// Este módulo guarda o estado, a câmera, o polling, os modos e o arraste; as
// partes da tela recebem o mesmo contexto (ctx):
// - panel.js: painel do selecionado, lista de tokens, combate e ficha em popup;
// - fog.js: pincel e ações da névoa;
// - annotations.js: áreas de efeito e marcadores;
// - spawn.js: entrada do jogador e criaturas do mestre;
// - board.js (camadas) e weather.js (clima).

import { subscribe } from '../core/realtime.js';
import { postJson, request } from '../core/http.js';
import { el } from '../core/dom.js';
import { createViewport } from '../world-map/viewport.js';
import { createDrawing } from '../world-map/drawing.js';
import { renderAoes, renderFog, renderGrid, renderMarkers, renderRuler, renderTokens } from './board.js';
import { createWeather } from './weather.js';
import { cellAt, createFog } from './fog.js';
import { createAnnotations } from './annotations.js';
import { createPanel } from './panel.js';
import { createSpawn } from './spawn.js';

const root = document.querySelector('[data-dungeon]');

if (root) {
    const config = JSON.parse(root.dataset.config);
    const $ = (selector) => root.querySelector(selector);
    const stage = $('[data-stage]');
    const area = $('[data-viewport]');
    const grid = config.grid;
    const weather = createWeather($('[data-weather-layer]'));
    const weatherSelect = $('[data-weather]');

    const state = {
        version: null,
        layers: { show_grid: true, grid_opacity: 75, show_tokens: true, fog_opacity: 90, grid_scale: { unit: 'ft', value_per_square: 5 } },
        fog: { enabled: false, revealed_cells: [] },
        tokens: [],
        aoes: [],
        markers: [],
        combat: { in_combat: false, round: 1, active_token_id: null },
        weather: 'none',
        mode: 'move',
        selectedId: null,
        selectedAoeId: null,
        brush: { mode: 'reveal', size: 2 },
        brushPreview: null,
        ruler: { from: null, to: null },
        gridVisible: true,
    };

    // Avisos

    const banner = $('[data-banner]');
    let bannerTimer;

    function notify(text, tone = 'info') {
        banner.textContent = text;
        banner.dataset.tone = tone;
        banner.hidden = false;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => { banner.hidden = true; }, 3500);
    }

    // Câmera e desenho. "ready" evita desenhar antes de tudo existir
    // (o viewport avisa mudanças assim que a imagem carrega).

    let ready = false;

    const viewport = createViewport({
        viewport: area,
        stage,
        image: $('[data-map-image]'),
        canPan: () => !['draw', 'fog', 'ruler'].includes(state.mode),
        onChange: (view) => {
            $('[data-zoom-label]').textContent = `${Math.round(view.scale * 100)}%`;
            if (ready) renderAll();
        },
        onClick: (event) => handleMapClick(event),
    });

    const drawing = createDrawing({
        layer: $('[data-drawings]'),
        toolbar: $('[data-draw-toolbar]'),
        url: config.drawingsUrl,
        toPercent: viewport.toPercent,
        notify,
    });

    let feed = null;

    const ctx = {
        root,
        $,
        config,
        state,
        grid,
        stage,
        viewport,
        notify,
        fail: (failure) => notify(failure.message, 'error'),
        url: (base, id) => `${base}/${id}`,
        selectedToken: () => state.tokens.find((token) => token.id === state.selectedId) ?? null,
        renderAll: () => renderAll(),
        // Pede o estado completo já, sem esperar o próximo ciclo do polling.
        refresh: () => {
            state.version = null;
            feed?.refresh();
        },
    };

    const annotations = createAnnotations(ctx);
    const panel = createPanel(ctx, annotations);
    const spawn = createSpawn(ctx);
    createFog(ctx);

    // Desenho de tudo

    function renderAll() {
        renderGrid($('[data-grid]'), grid, { ...state.layers, show_grid: state.layers.show_grid && state.gridVisible });
        renderFog($('[data-fog]'), stage, grid, state.fog, state.layers, config.isGm, state.brushPreview);
        renderAoes($('[data-aoes]'), stage, grid, state.aoes, state.layers.grid_scale, state.selectedAoeId);
        renderMarkers($('[data-markers]'), state.markers, config.markerCategories, annotations.openMarker);
        renderTokens($('[data-tokens]'), stage, grid, state.tokens, {
            selectedId: state.selectedId,
            activeId: state.combat.active_token_id,
            conditions: config.conditions,
            showTokens: state.layers.show_tokens || config.isGm,
            onSelect: panel.selectToken,
        });
        renderRuler($('[data-ruler]'), stage, grid, state.layers.grid_scale, state.ruler.from, state.ruler.to);
        panel.render();
        spawn.updateJoinButton();

        // O controle "névoa ativa" acompanha o estado do servidor.
        if (config.isGm) $('[data-fog-enabled]').checked = state.fog.enabled;
    }

    // Polling do estado

    feed = subscribe(config.stateUrl, {
        interval: 2500,
        params: () => ({ versao: state.version ?? undefined }),
        onData(body) {
            state.version = body.version;

            if (body.changed) {
                Object.assign(state, {
                    layers: body.layers,
                    fog: body.fog,
                    tokens: body.tokens,
                    aoes: body.aoes,
                    markers: body.markers,
                    combat: body.combat,
                    weather: body.weather ?? 'none',
                });
                weather.set(state.weather);
                if (weatherSelect && document.activeElement !== weatherSelect) weatherSelect.value = state.weather;
                drawing.setStrokes(body.drawings ?? []);
                if (state.selectedId && !ctx.selectedToken()) state.selectedId = null;
                // Arrastando um token: redesenhar agora trocaria o elemento sob o
                // dedo; a posição dos outros chega ao soltar.
                if (drag) pendingRender = true;
                else renderAll();
            }

            renderPings(body.pings ?? []);
        },
        onError(failure) {
            if (failure.status === 403) notify('Este mapa não está mais disponível para você.', 'error');
        },
    });

    // Clima (mestre): todos veem as partículas pelo estado do mapa.
    weatherSelect?.addEventListener('change', async () => {
        try {
            const body = await request(config.weatherUrl, { method: 'PUT', data: { weather: weatherSelect.value } });
            state.weather = body.weather;
            weather.set(body.weather);
            notify(body.message);
        } catch (failure) {
            ctx.fail(failure);
        }
    });

    // Modos

    function setMode(mode) {
        state.mode = mode;
        root.dataset.mode = mode;
        root.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
        root.querySelectorAll('[data-options]').forEach((options) => { options.hidden = options.dataset.options !== mode; });
        drawing.setActive(mode === 'draw');
        state.ruler = { from: null, to: null };
        state.brushPreview = null;

        const hints = {
            ping: 'Clique no mapa para enviar um sinal.',
            aoe: 'Clique no mapa para posicionar a área de efeito.',
            marker: 'Clique no mapa para posicionar o marcador.',
            ruler: 'Arraste sobre o mapa para medir.',
            fog: 'Clique e arraste para revelar ou ocultar a névoa.',
        };
        if (hints[mode]) notify(hints[mode]);
        renderAll();
    }

    root.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));

    root.querySelectorAll('[data-zoom]').forEach((button) => button.addEventListener('click', () => {
        if (button.dataset.zoom === 'reset') viewport.reset();
        else viewport.zoomCenter(button.dataset.zoom === 'in' ? 1.3 : 1 / 1.3);
    }));

    $('[data-grid-toggle]').addEventListener('click', (event) => {
        state.gridVisible = !state.gridVisible;
        event.currentTarget.setAttribute('aria-pressed', String(state.gridVisible));
        renderAll();
    });

    // Coordenadas sob o cursor e régua

    area.addEventListener('pointermove', (event) => {
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        const { col, row } = cellAt(grid, point);
        $('[data-coords]').textContent = `Coluna ${col + 1} · Linha ${row + 1}`;

        if (state.mode === 'ruler' && state.ruler.from && event.buttons === 1) {
            state.ruler.to = point;
            renderRuler($('[data-ruler]'), stage, grid, state.layers.grid_scale, state.ruler.from, state.ruler.to);
        }
    });

    area.addEventListener('pointerdown', (event) => {
        if (state.mode !== 'ruler' || event.button !== 0 || event.target.closest('.glass')) return;
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        state.ruler = { from: point, to: point };
        renderAll();
    });

    // Cliques no mapa

    function handleMapClick(event) {
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        if (event.shiftKey || state.mode === 'ping') {
            sendPing(point);
        } else if (state.mode === 'aoe') {
            annotations.createAoe(point);
        } else if (state.mode === 'marker') {
            annotations.openMarkerForm(point);
        } else if (state.mode === 'move') {
            state.selectedId = null;
            state.selectedAoeId = null;
            renderAll();
        }
    }

    // Sinais (pings): duram 6 s na tela.

    async function sendPing(point) {
        try {
            const body = await postJson(config.pingsUrl, point);
            renderPings([body.ping]);
        } catch (failure) {
            ctx.fail(failure);
        }
    }

    const shownPings = new Set();

    function renderPings(pings) {
        pings.filter((ping) => !shownPings.has(ping.id)).forEach((ping) => {
            shownPings.add(ping.id);
            const node = el('div', { class: 'map-ping', style: `left: ${ping.x}%; top: ${ping.y}%; --ping-color: ${ping.color}` },
                el('span', { class: 'map-ping__pulse' }), el('span', { class: 'map-ping__core' }),
                el('span', { class: 'map-ping__label' }, ping.mine ? 'Você' : ping.user_name));
            $('[data-pings]').append(node);
            setTimeout(() => node.remove(), 6000);
        });
    }

    // Arrastar tokens e áreas (modo mover)

    let drag = null;
    let pendingRender = false;

    function flushRender() {
        if (pendingRender) {
            pendingRender = false;
            renderAll();
        }
    }

    stage.addEventListener('pointerdown', (event) => {
        if (state.mode !== 'move' || event.button !== 0) return;

        const tokenEl = event.target.closest('.token.can-control');
        const aoeEl = event.target.closest('.aoe.can-edit');
        const target = tokenEl ?? aoeEl;

        if (!target) return;
        event.stopPropagation();
        target.setPointerCapture(event.pointerId);
        drag = { el: target, kind: tokenEl ? 'token' : 'aoe', id: Number(tokenEl ? target.dataset.token : target.dataset.aoe), moved: false, startX: event.clientX, startY: event.clientY };
    });

    stage.addEventListener('pointermove', (event) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;

        drag.moved = true;
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        if (drag.kind === 'token') {
            drag.el.style.left = `${point.x}%`;
            drag.el.style.top = `${point.y}%`;
        } else {
            const aoe = state.aoes.find((item) => item.id === drag.id);
            Object.assign(aoe, point);
            renderAoes($('[data-aoes]'), stage, grid, state.aoes, state.layers.grid_scale, state.selectedAoeId);
        }
        drag.point = point;
    });

    stage.addEventListener('pointerup', async (event) => {
        if (!drag) return;
        const current = drag;
        drag = null;

        if (!current.moved) {
            if (current.kind === 'aoe') panel.selectAoe(current.id);
            flushRender();
            return;
        }

        // Evita que o "click" ao soltar selecione/desselecione algo.
        event.stopPropagation();

        try {
            if (current.kind === 'token') {
                await moveToken(current.id, current.point);
            } else {
                await request(ctx.url(config.aoesUrl, current.id), { method: 'PUT', data: { x: current.point.x, y: current.point.y } });
                ctx.refresh();
            }
        } catch (failure) {
            ctx.fail(failure);
            ctx.refresh();
        } finally {
            flushRender();
        }
    });

    async function moveToken(id, point) {
        const body = await request(ctx.url(config.tokensUrl, id), { method: 'PUT', data: { x: point.x, y: point.y } });
        state.tokens = state.tokens.map((token) => (token.id === id ? body.token : token));
        renderAll();
        ctx.refresh();
    }

    // Setas do teclado movem o token selecionado uma célula.
    document.addEventListener('keydown', (event) => {
        const token = ctx.selectedToken();
        const deltas = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

        if (!token?.can_control || !deltas[event.key] || event.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
        event.preventDefault();

        const [dx, dy] = deltas[event.key];
        moveToken(token.id, { x: token.x + (dx * 100) / grid.cols, y: token.y + (dy * 100) / grid.rows }).catch(ctx.fail);
    });

    // Modo TV: só o mapa, em tela cheia.

    $('[data-tv]').addEventListener('click', () => {
        const on = root.classList.toggle('dungeon--tv');
        if (on) document.documentElement.requestFullscreen?.().catch(() => {});
        else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        setTimeout(() => viewport.reset(), 120);
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && root.classList.contains('dungeon--tv')) {
            root.classList.remove('dungeon--tv');
            setTimeout(() => viewport.reset(), 120);
        }
    });

    ready = true;
    setMode('move');
}
