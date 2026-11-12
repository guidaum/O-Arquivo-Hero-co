// Battlemap da masmorra (DungeonMap.tsx).
//
// O estado chega por core/realtime.js (só reenviado quando a versão muda).
// Modos: mover (arrastar tokens e áreas), régua, sinal, área de efeito,
// marcador, desenho e névoa (mestre). Arrastar o mapa vazio move a câmera.
// O servidor decide quem pode o quê; aqui a tela só oferece o que cabe a cada um.

import { subscribe } from '../core/realtime.js';
import { deleteJson, postJson, request } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';
import { cellsInRadius } from '../core/maps.js';
import { createViewport } from '../world-map/viewport.js';
import { createDrawing } from '../world-map/drawing.js';
import { renderAoes, renderFog, renderGrid, renderMarkers, renderRuler, renderTokens } from './board.js';
import { createWeather } from './weather.js';

const root = document.querySelector('[data-dungeon]');

if (root) {
    const config = JSON.parse(root.dataset.config);
    const $ = (selector) => root.querySelector(selector);
    const stage = $('[data-stage]');
    const weather = createWeather($('[data-weather-layer]'));
    const weatherSelect = root.querySelector('[data-weather]');

    // Clima (mestre): todos veem as partículas pelo estado do mapa.
    weatherSelect?.addEventListener('change', async () => {
        try {
            const body = await request(config.weatherUrl, { method: 'PUT', data: { weather: weatherSelect.value } });
            state.weather = body.weather;
            weather.set(body.weather);
            notify(body.message);
        } catch (failure) {
            notify(failure.message, 'error');
        }
    });
    const grid = config.grid;
    const url = (base, id) => `${base}/${id}`;

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
        ruler: { from: null, to: null },
        markerPoint: null,
        tab: 'tokens',
        gridVisible: true,
    };

    const selectedToken = () => state.tokens.find((token) => token.id === state.selectedId) ?? null;

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

    const fail = (failure) => notify(failure.message, 'error');

    // Câmera, desenho e polling. "ready" evita desenhar antes de tudo existir
    // (o viewport avisa mudanças assim que a imagem carrega).

    let ready = false;

    const viewport = createViewport({
        viewport: $('[data-viewport]'),
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

    const feed = subscribe(config.stateUrl, {
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
                if (state.selectedId && !selectedToken()) state.selectedId = null;
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

    const refresh = () => {
        state.version = null;
        feed.refresh();
    };

    // Desenho de tudo

    function renderAll() {
        renderGrid($('[data-grid]'), grid, { ...state.layers, show_grid: state.layers.show_grid && state.gridVisible });
        renderFog($('[data-fog]'), stage, grid, state.fog, state.layers, config.isGm, state.brushPreview ?? null);
        renderAoes($('[data-aoes]'), stage, grid, state.aoes, state.layers.grid_scale, state.selectedAoeId);
        renderMarkers($('[data-markers]'), state.markers, config.markerCategories, openMarker);
        renderTokens($('[data-tokens]'), stage, grid, state.tokens, {
            selectedId: state.selectedId,
            activeId: state.combat.active_token_id,
            conditions: config.conditions,
            showTokens: state.layers.show_tokens || config.isGm,
            onSelect: selectToken,
        });
        renderRuler($('[data-ruler]'), stage, grid, state.layers.grid_scale, state.ruler.from, state.ruler.to);
        renderSidebar();
        updateJoinButton();

        // O controle "névoa ativa" acompanha o estado do servidor.
        if (config.isGm) $('[data-fog-enabled]').checked = state.fog.enabled;
    }

    // Modos

    function setMode(mode) {
        state.mode = mode;
        root.dataset.mode = mode;
        root.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
        root.querySelectorAll('[data-options]').forEach((panel) => { panel.hidden = panel.dataset.options !== mode; });
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

    $('[data-viewport]').addEventListener('pointermove', (event) => {
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;
        const col = Math.min(grid.cols - 1, Math.floor((point.x / 100) * grid.cols));
        const row = Math.min(grid.rows - 1, Math.floor((point.y / 100) * grid.rows));
        $('[data-coords]').textContent = `Coluna ${col + 1} · Linha ${row + 1}`;
    });

    // Cliques no mapa

    async function handleMapClick(event) {
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        if (event.shiftKey || state.mode === 'ping') {
            sendPing(point);
        } else if (state.mode === 'aoe') {
            createAoe(point);
        } else if (state.mode === 'marker') {
            state.markerPoint = point;
            markerForm.reset();
            document.getElementById('dungeon-marker').showModal();
        } else if (state.mode === 'move') {
            state.selectedId = null;
            state.selectedAoeId = null;
            renderAll();
        }
    }

    async function sendPing(point) {
        try {
            const body = await postJson(config.pingsUrl, point);
            renderPings([body.ping]);
        } catch (failure) {
            fail(failure);
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
            if (current.kind === 'aoe') selectAoe(current.id);
            flushRender();
            return;
        }

        // Evita que o "click" ao soltar selecione/desselecione algo.
        event.stopPropagation();

        try {
            if (current.kind === 'token') {
                await moveToken(current.id, current.point);
            } else {
                await request(url(config.aoesUrl, current.id), { method: 'PUT', data: { x: current.point.x, y: current.point.y } });
                refresh();
            }
        } catch (failure) {
            fail(failure);
            refresh();
        } finally {
            flushRender();
        }
    });

    async function moveToken(id, point) {
        const body = await request(url(config.tokensUrl, id), { method: 'PUT', data: { x: point.x, y: point.y } });
        state.tokens = state.tokens.map((token) => (token.id === id ? body.token : token));
        renderAll();
        refresh();
    }

    // Setas do teclado movem o token selecionado uma célula.
    document.addEventListener('keydown', (event) => {
        const token = selectedToken();
        const deltas = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

        if (!token?.can_control || !deltas[event.key] || event.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
        event.preventDefault();

        const [dx, dy] = deltas[event.key];
        moveToken(token.id, { x: token.x + (dx * 100) / grid.cols, y: token.y + (dy * 100) / grid.rows }).catch(fail);
    });

    // Régua e pincel da névoa

    let painting = false;

    function cellAt(point) {
        const col = Math.min(grid.cols - 1, Math.floor((point.x / 100) * grid.cols));
        const row = Math.min(grid.rows - 1, Math.floor((point.y / 100) * grid.rows));

        return { col, row };
    }

    function paintAt(point) {
        const { col, row } = cellAt(point);
        const cells = cellsInRadius(col, row, state.brush.size, grid.cols, grid.rows);
        const revealed = new Set(state.fog.revealed_cells);
        cells.forEach((cell) => (state.brush.mode === 'reveal' ? revealed.add(cell) : revealed.delete(cell)));
        state.fog = { ...state.fog, revealed_cells: [...revealed] };
        state.brushPreview = { mode: state.brush.mode, cells };
    }

    $('[data-viewport]').addEventListener('pointerdown', (event) => {
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point || event.button !== 0 || event.target.closest('.glass')) return;

        if (state.mode === 'ruler') {
            state.ruler = { from: point, to: point };
            renderAll();
        } else if (state.mode === 'fog') {
            painting = true;
            paintAt(point);
            renderAll();
        }
    });

    $('[data-viewport]').addEventListener('pointermove', (event) => {
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        if (state.mode === 'ruler' && state.ruler.from && event.buttons === 1) {
            state.ruler.to = point;
            renderRuler($('[data-ruler]'), stage, grid, state.layers.grid_scale, state.ruler.from, state.ruler.to);
        } else if (state.mode === 'fog') {
            if (painting) paintAt(point);
            else state.brushPreview = { mode: state.brush.mode, cells: cellsInRadius(cellAt(point).col, cellAt(point).row, state.brush.size, grid.cols, grid.rows) };
            renderFog($('[data-fog]'), stage, grid, state.fog, state.layers, config.isGm, state.brushPreview);
        }
    });

    window.addEventListener('pointerup', () => {
        if (painting) {
            painting = false;
            saveFog();
        }
    });

    async function saveFog() {
        try {
            await request(config.fogUrl, { method: 'PUT', data: { enabled: state.fog.enabled, revealed_cells: state.fog.revealed_cells } });
            refresh();
        } catch (failure) {
            fail(failure);
        }
    }

    if (config.isGm) {
        $('[data-fog-enabled]').addEventListener('change', (event) => {
            state.fog = { ...state.fog, enabled: event.target.checked };
            saveFog();
        });

        root.querySelectorAll('[data-brush-mode]').forEach((button) => button.addEventListener('click', () => {
            state.brush.mode = button.dataset.brushMode;
            root.querySelectorAll('[data-brush-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        }));

        root.querySelectorAll('[data-brush-size]').forEach((button) => button.addEventListener('click', () => {
            state.brush.size = Number(button.dataset.brushSize);
            root.querySelectorAll('[data-brush-size]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        }));

        root.querySelectorAll('[data-fog-action]').forEach((button) => button.addEventListener('click', () => {
            const total = grid.cols * grid.rows;
            let cells = state.fog.revealed_cells;

            if (button.dataset.fogAction === 'reveal-all') cells = Array.from({ length: total }, (_, cell) => cell);
            if (button.dataset.fogAction === 'hide-all') cells = [];
            if (button.dataset.fogAction === 'players') {
                const set = new Set(cells);
                state.tokens.filter((token) => token.type === 'player').forEach((token) => {
                    const { col, row } = cellAt(token);
                    cellsInRadius(col, row, 3, grid.cols, grid.rows).forEach((cell) => set.add(cell));
                });
                cells = [...set];
            }

            state.fog = { ...state.fog, revealed_cells: cells };
            renderAll();
            saveFog();
        }));
    }

    // Áreas de efeito

    const aoePreset = $('[data-aoe-preset]');
    aoePreset.addEventListener('change', () => { $('[data-aoe-feet]').value = aoePreset.value.split('|')[1]; });

    async function createAoe(point) {
        const [type, , color, name] = aoePreset.value.split('|');

        try {
            await postJson(config.aoesUrl, {
                type,
                name,
                color,
                x: point.x,
                y: point.y,
                radius_feet: Number($('[data-aoe-feet]').value) || 20,
                rotation: Number($('[data-aoe-rotation]').value) || 0,
            });
            refresh();
        } catch (failure) {
            fail(failure);
        }
    }

    function selectAoe(id) {
        state.selectedAoeId = id;
        state.selectedId = null;
        renderAll();
    }

    $('[data-aoe-clear]')?.addEventListener('click', async () => {
        if (!window.confirm('Remover todas as áreas de efeito deste mapa?')) return;
        try {
            await deleteJson(config.aoesUrl);
            refresh();
        } catch (failure) {
            fail(failure);
        }
    });

    // Marcadores

    const markerForm = document.querySelector('[data-marker-form]');

    markerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await postJson(config.markersUrl, {
                label: markerForm.elements.label.value,
                category: markerForm.elements.category.value,
                description: markerForm.elements.description.value,
                ...state.markerPoint,
            });
            document.getElementById('dungeon-marker').close();
            refresh();
        } catch (failure) {
            markerForm.querySelector('[data-marker-error]').textContent = failure.message;
        }
    });

    function openMarker(marker) {
        const category = config.markerCategories[marker.category];
        const panel = $('[data-selected]');
        panel.hidden = false;
        state.selectedId = null;

        replace(panel,
            el('header', { class: 'dungeon-selected__head', 'data-keep': '' },
                el('span', { class: 'dungeon-selected__swatch', style: `--token-color: ${category.color}` }, icon(category.icon, 16)),
                el('strong', {}, marker.label),
                el('button', { type: 'button', class: 'icon-button', title: 'Fechar', onClick: () => { panel.hidden = true; } }, icon('x', 16))),
            el('p', { class: 'muted' }, category.label),
            marker.description ? el('p', {}, marker.description) : null,
            marker.can_delete ? el('button', {
                type: 'button',
                class: 'button button--secondary',
                onClick: async () => {
                    try {
                        await deleteJson(url(config.markersUrl, marker.id));
                        panel.hidden = true;
                        refresh();
                    } catch (failure) {
                        fail(failure);
                    }
                },
            }, icon('trash', 14), ' Remover marcador') : null);
    }

    // Ficha do personagem em popup: a própria página da ficha, embutida (sem
    // menu nem polling, ver core/theme-init.js); as rolagens dela vão ao chat.

    const sheetDialog = document.getElementById('dungeon-sheet');
    const sheetFrame = sheetDialog?.querySelector('[data-sheet-frame]');

    function openSheet(token) {
        if (!sheetDialog || !token.sheet_url) return;

        sheetDialog.querySelector('.modal__title').textContent = `Ficha · ${token.name}`;
        sheetDialog.querySelector('[data-sheet-link]').href = token.sheet_url;
        if (sheetFrame.getAttribute('src') !== token.sheet_url) sheetFrame.setAttribute('src', token.sheet_url);
        sheetDialog.showModal();
    }

    // Ao fechar, a ficha sai da memória e o mapa busca o estado (PV pode ter mudado).
    sheetDialog?.addEventListener('close', () => {
        sheetFrame.setAttribute('src', 'about:blank');
        refresh();
    });

    // Duplo clique (ou toque duplo) no token abre a ficha.
    stage.addEventListener('dblclick', (event) => {
        const tokenEl = event.target.closest('.token');
        const token = tokenEl ? state.tokens.find((item) => item.id === Number(tokenEl.dataset.token)) : null;

        if (token?.sheet_url) {
            event.stopPropagation();
            openSheet(token);
        }
    });

    // Tokens: seleção e painel

    function selectToken(token) {
        state.selectedId = token.id;
        state.selectedAoeId = null;
        renderAll();
    }

    async function updateToken(token, data) {
        try {
            const body = await request(url(config.tokensUrl, token.id), { method: 'PUT', data });
            state.tokens = state.tokens.map((item) => (item.id === token.id ? body.token : item));
            renderAll();
            refresh();
        } catch (failure) {
            fail(failure);
        }
    }

    function renderSelected() {
        const panel = $('[data-selected]');
        const token = selectedToken();
        const aoe = state.aoes.find((item) => item.id === state.selectedAoeId);

        if (aoe) {
            panel.hidden = false;
            replace(panel,
                el('header', { class: 'dungeon-selected__head' },
                    el('span', { class: 'dungeon-selected__swatch', style: `--token-color: ${aoe.color}` }, icon('flame', 16)),
                    el('strong', {}, aoe.name || 'Área de efeito'),
                    el('button', { type: 'button', class: 'icon-button', title: 'Fechar', onClick: () => selectAoe(null) }, icon('x', 16))),
                el('p', { class: 'muted' }, `${aoe.radius_feet} pés · giro ${aoe.rotation}°`),
                aoe.can_edit ? el('div', { class: 'dungeon-selected__row' },
                    el('button', { type: 'button', class: 'button button--secondary', onClick: () => rotateAoe(aoe, -15) }, '↺ 15°'),
                    el('button', { type: 'button', class: 'button button--secondary', onClick: () => rotateAoe(aoe, 15) }, '↻ 15°'),
                    el('button', {
                        type: 'button',
                        class: 'button button--danger',
                        onClick: async () => {
                            try {
                                await deleteJson(url(config.aoesUrl, aoe.id));
                                state.selectedAoeId = null;
                                refresh();
                            } catch (failure) {
                                fail(failure);
                            }
                        },
                    }, icon('trash', 14))) : null);
            return;
        }

        if (!token) {
            if (!panel.querySelector('[data-keep]')) panel.hidden = true;
            return;
        }

        panel.hidden = false;
        const control = token.can_control;

        replace(panel,
            el('header', { class: 'dungeon-selected__head' },
                el('span', { class: 'dungeon-selected__swatch', style: `--token-color: ${token.color}` }, token.name.charAt(0)),
                el('strong', {}, token.name),
                el('button', { type: 'button', class: 'icon-button', title: 'Centralizar', onClick: () => viewport.focus(token) }, icon('locate', 16)),
                el('button', { type: 'button', class: 'icon-button', title: 'Fechar', onClick: () => { state.selectedId = null; renderAll(); } }, icon('x', 16))),
            token.sheet_url ? el('button', { type: 'button', class: 'button button--secondary dungeon-selected__sheet', onClick: () => openSheet(token) }, icon('scroll-text', 14), ' Ver ficha') : null,
            el('div', { class: 'dungeon-selected__hp' },
                el('span', {}, `PV ${token.hp} / ${token.max_hp}`),
                el('span', { class: 'token__hp token__hp--wide' }, el('span', { style: `width: ${token.max_hp ? (token.hp / token.max_hp) * 100 : 100}%` }))),
            control ? el('div', { class: 'dungeon-selected__row' },
                [-5, -1, 1, 5].map((delta) => el('button', {
                    type: 'button',
                    class: `button ${delta < 0 ? 'button--danger' : 'button--secondary'} dungeon-selected__delta`,
                    onClick: () => updateToken(token, { hp: Math.max(0, Math.min(token.max_hp, token.hp + delta)) }),
                }, delta > 0 ? `+${delta}` : String(delta)))) : null,
            el('p', { class: 'eyebrow' }, 'Condições'),
            el('div', { class: 'chips' }, Object.entries(config.conditions).map(([id, condition]) => {
                const active = token.conditions.includes(id);
                return el('button', {
                    type: 'button',
                    class: `chip dungeon-condition${active ? ' is-active' : ''}`,
                    style: `--condition-color: ${condition.color}`,
                    disabled: !control,
                    'aria-pressed': String(active),
                    onClick: () => updateToken(token, { conditions: active ? token.conditions.filter((item) => item !== id) : [...token.conditions, id] }),
                }, `${condition.symbol} ${condition.name}`);
            })),
            el('div', { class: 'dungeon-selected__row' },
                el('label', { class: 'dungeon-options__field' }, 'Iniciativa ', el('input', {
                    class: 'field__input',
                    type: 'number',
                    value: token.initiative,
                    disabled: !control,
                    onChange: (event) => updateToken(token, { initiative: Number(event.target.value) || 0 }),
                })),
                el('button', {
                    type: 'button',
                    class: 'button button--secondary',
                    title: 'Rolar 1d20 no rolador de dados',
                    onClick: () => document.dispatchEvent(new CustomEvent('dice:roll', { detail: { sides: 20, quantity: 1, modifier: 0 } })),
                }, icon('dice', 14), ' Rolar d20')),
            config.isGm ? el('div', { class: 'dungeon-selected__row' },
                el('label', { class: 'dungeon-options__field' }, 'PV máx. ', el('input', {
                    class: 'field__input', type: 'number', min: 1, value: token.max_hp,
                    onChange: (event) => updateToken(token, { max_hp: Math.max(1, Number(event.target.value) || 1), hp: Math.min(token.hp, Math.max(1, Number(event.target.value) || 1)) }),
                })),
                el('button', { type: 'button', class: 'button button--secondary', onClick: () => updateToken(token, { is_hidden: !token.is_hidden }) },
                    icon(token.is_hidden ? 'eye' : 'eye-off', 14), token.is_hidden ? ' Revelar' : ' Ocultar')) : null,
            token.moved_by ? el('p', { class: 'muted dungeon-selected__note' }, `Movido por último por ${token.moved_by}.`) : null,
            control ? el('button', {
                type: 'button',
                class: 'button button--danger',
                onClick: async () => {
                    if (!window.confirm(`Remover ${token.name} do mapa?`)) return;
                    try {
                        await deleteJson(url(config.tokensUrl, token.id));
                        state.selectedId = null;
                        refresh();
                    } catch (failure) {
                        fail(failure);
                    }
                },
            }, icon('trash', 14), ' Remover do mapa') : null);
    }

    async function rotateAoe(aoe, delta) {
        try {
            await request(url(config.aoesUrl, aoe.id), { method: 'PUT', data: { rotation: (aoe.rotation + delta + 360) % 360 } });
            refresh();
        } catch (failure) {
            fail(failure);
        }
    }

    // Lista de tokens e combate

    function turnOrder() {
        return state.tokens.filter((token) => !token.is_hidden).sort((a, b) => b.initiative - a.initiative || a.id - b.id);
    }

    function tokenRow(token, extra = null) {
        const percent = token.max_hp ? (token.hp / token.max_hp) * 100 : 100;

        return el('li', {}, el('button', {
            type: 'button',
            class: `pin-list__item${token.id === state.selectedId ? ' is-selected' : ''}${token.id === state.combat.active_token_id ? ' is-active-turn' : ''}`,
            style: `--pin-color: ${token.color}`,
            onClick: () => {
                selectToken(token);
                viewport.focus(token);
            },
        },
        el('span', { class: 'pin-list__icon' }, token.is_hidden ? icon('eye-off', 16) : icon(token.type === 'player' ? 'user' : 'skull', 16)),
        el('span', { class: 'pin-list__text' },
            el('strong', {}, token.name),
            el('small', {}, `PV ${token.hp}/${token.max_hp} · Ini ${token.initiative}`),
            el('span', { class: 'token__hp token__hp--wide' }, el('span', { style: `width: ${percent}%` }))),
        extra));
    }

    function renderSidebar() {
        renderSelected();

        replace($('[data-token-list]'), state.tokens.length === 0
            ? el('li', { class: 'pin-list__empty' }, 'Nenhum token no mapa ainda.')
            : state.tokens.map((token) => tokenRow(token)));

        const order = turnOrder();
        $('[data-round]').textContent = state.combat.in_combat ? `Rodada ${state.combat.round}` : 'Fora de combate';
        replace($('[data-turns]'), order.length === 0
            ? el('li', { class: 'pin-list__empty' }, 'Sem combatentes.')
            : order.map((token, index) => tokenRow(token, el('span', { class: 'dungeon-turn-index' }, String(index + 1)))));
    }

    root.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
        root.querySelectorAll('[data-tab]').forEach((item) => (item === tab ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current')));
        root.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
    }));

    root.querySelectorAll('[data-combat]').forEach((button) => button.addEventListener('click', async () => {
        try {
            const body = await request(config.combatUrl, { method: 'PUT', data: { action: button.dataset.combat } });
            state.combat = body.combat;
            const active = state.tokens.find((token) => token.id === body.combat.active_token_id);
            if (active) viewport.focus(active);
            refresh();
        } catch (failure) {
            fail(failure);
        }
    }));

    // Entrar no mapa (jogador) e criaturas (mestre)

    const joinButton = $('[data-join]');

    function freeCharacter() {
        const placed = new Set(state.tokens.map((token) => token.character_id));

        return config.myCharacters.find((character) => !placed.has(character.id)) ?? null;
    }

    function updateJoinButton() {
        if (joinButton) joinButton.hidden = !freeCharacter();
    }

    joinButton?.addEventListener('click', async () => {
        const character = freeCharacter();
        if (!character) return;

        try {
            const body = await postJson(config.tokensUrl, { mode: 'character', character_id: character.id });
            state.selectedId = body.token.id;
            notify(body.message, 'success');
            refresh();
        } catch (failure) {
            fail(failure);
        }
    });

    if (config.isGm) {
        const hidden = () => document.querySelector('[data-spawn-hidden]').checked;
        const spawn = async (data) => {
            try {
                const body = await postJson(config.tokensUrl, data);
                notify(body.message, 'success');
                document.getElementById('spawn-token').close();
                refresh();
            } catch (failure) {
                document.querySelector('[data-spawn-error]').textContent = failure.message;
            }
        };

        replace(document.querySelector('[data-spawn-characters]'), config.campaignCharacters.length
            ? config.campaignCharacters.map((character) => el('button', { type: 'button', class: 'chip', onClick: () => spawn({ mode: 'character', character_id: character.id }) },
                character.name, character.owner ? el('small', {}, ` · ${character.owner}`) : null))
            : el('p', { class: 'muted' }, 'Nenhum personagem na campanha.'));

        replace(document.querySelector('[data-spawn-presets]'), Object.entries(config.presets).map(([key, preset]) => el('button', {
            type: 'button',
            class: 'chip',
            style: `border-color: ${preset.color}`,
            onClick: () => spawn({ mode: 'preset', preset: key, is_hidden: hidden() }),
        }, `${preset.name} (${preset.hp} PV)`)));

        document.querySelector('[data-spawn-form]').addEventListener('submit', (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            spawn({
                mode: 'custom',
                name: form.elements.name.value,
                hp: Number(form.elements.hp.value) || 10,
                type: form.elements.type.value,
                size: Number(form.elements.size.value) || 1,
                color: form.elements.color.value,
                is_hidden: hidden(),
            });
        });

        root.querySelectorAll('[data-map-active]').forEach((input) => input.addEventListener('change', async () => {
            try {
                const body = await request(input.dataset.mapActive, { method: 'PUT', data: { active: input.checked } });
                notify(body.message, 'success');
            } catch (failure) {
                input.checked = !input.checked;
                fail(failure);
            }
        }));
    }

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
