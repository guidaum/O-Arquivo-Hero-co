// Inspetor de camadas: camadas visuais, névoa de guerra e régua de um
// mapa na campanha. Nada é salvo até clicar em "Salvar" (PUT JSON).
// A névoa é pintada célula a célula num canvas sobre a imagem; aqui o
// mestre vê o mapa através das células ocultas (os jogadores não verão).

import { request } from '../core/http.js';
import { cellsInRadius, gridDistance } from '../core/maps.js';

const root = document.querySelector('[data-layers]');

if (root) {
    const config = JSON.parse(root.dataset.config);
    const $ = (selector) => root.querySelector(selector);
    const stage = $('[data-stage]');
    const image = $('[data-image]');
    const grid = $('[data-grid]');
    const canvas = $('[data-fog]');
    const ruler = $('[data-ruler]');
    const readout = $('[data-readout]');
    const hint = $('[data-hint]');
    const { cols, rows } = config;
    const total = cols * rows;

    const state = {
        tab: 'layers',
        layers: structuredClone(config.layers),
        fogEnabled: config.fog.enabled,
        revealed: new Set(config.fog.revealed_cells),
        brushMode: 'reveal',
        brushSize: 2,
        painting: false,
        hover: null,
        rulerStart: null,
        rulerEnd: null,
        dirty: false,
    };

    // Fog nunca configurada: começa revelada só ao redor da entrada (sistema antigo).
    if (state.fogEnabled && state.revealed.size === 0) {
        entranceCells().forEach((cell) => state.revealed.add(cell));
    }
    if (!state.fogEnabled && state.revealed.size === 0) {
        for (let cell = 0; cell < total; cell++) state.revealed.add(cell);
    }

    function entranceCells() {
        const col = Math.max(0, Math.min(cols - 1, Math.floor((config.entrance.x / 100) * cols)));
        const row = Math.max(0, Math.min(rows - 1, Math.floor((config.entrance.y / 100) * rows)));

        return cellsInRadius(col, row, 3, cols, rows);
    }

    const markDirty = () => { state.dirty = true; };

    // Desenho

    function renderLayers() {
        const { layers } = state;
        image.style.opacity = layers.show_background ? String(layers.background_opacity / 100) : '0.08';
        grid.hidden = !layers.show_grid;
        grid.style.opacity = String(layers.grid_opacity / 100);
        grid.style.setProperty('--cols', cols);
        grid.style.setProperty('--rows', rows);

        root.querySelectorAll('[data-layer]').forEach((input) => {
            const value = layers[input.dataset.layer];
            if (input.type === 'checkbox') input.checked = Boolean(value);
            else input.value = String(value);
        });
        root.querySelectorAll('[data-output]').forEach((output) => { output.textContent = `${layers[output.dataset.output]}%`; });

        $('[data-fog-enabled]').checked = state.fogEnabled;
        $('[data-scale-unit]').value = layers.grid_scale.unit;
        $('[data-scale-value]').value = String(layers.grid_scale.value_per_square);
    }

    function renderFog() {
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const cellWidth = width / cols;
        const cellHeight = height / rows;
        const showFog = state.fogEnabled || state.tab === 'fog';

        if (showFog) {
            // Visão do mestre: as células ocultas ficam escurecidas, mas o mapa continua visível.
            ctx.fillStyle = `rgba(8, 7, 12, ${Math.min(0.75, state.layers.fog_opacity / 100 * 0.8)})`;
            for (let cell = 0; cell < total; cell++) {
                if (!state.revealed.has(cell)) {
                    ctx.fillRect((cell % cols) * cellWidth, Math.floor(cell / cols) * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
                }
            }
        }

        if (state.tab === 'fog' && state.hover) {
            ctx.strokeStyle = state.brushMode === 'reveal' ? '#38bdf8' : '#ef4444';
            ctx.lineWidth = 2;
            cellsInRadius(state.hover.col, state.hover.row, state.brushSize, cols, rows).forEach((cell) => {
                ctx.strokeRect((cell % cols) * cellWidth + 1, Math.floor(cell / cols) * cellHeight + 1, cellWidth - 2, cellHeight - 2);
            });
        }

        $('[data-fog-count]').textContent = `${state.revealed.size} de ${total} células reveladas${state.fogEnabled ? '' : ' (névoa desligada: os jogadores veem o mapa inteiro)'}.`;
    }

    function renderRuler() {
        ruler.replaceChildren();
        readout.hidden = true;

        if (!state.rulerStart || !state.rulerEnd) return;

        const ns = 'http://www.w3.org/2000/svg';
        const line = document.createElementNS(ns, 'line');
        Object.entries({ x1: state.rulerStart.x, y1: state.rulerStart.y, x2: state.rulerEnd.x, y2: state.rulerEnd.y, class: 'ruler-line' })
            .forEach(([name, value]) => line.setAttribute(name, String(value)));
        ruler.append(line);

        const distance = gridDistance(state.rulerStart, state.rulerEnd, cols, rows, state.layers.grid_scale);
        readout.textContent = distance.formatted;
        readout.style.left = `${(state.rulerStart.x + state.rulerEnd.x) / 2}%`;
        readout.style.top = `${(state.rulerStart.y + state.rulerEnd.y) / 2}%`;
        readout.hidden = false;
        $('[data-ruler-readout]').textContent = `Distância: ${distance.formatted}`;
    }

    function renderHint() {
        hint.textContent = {
            layers: 'Ajuste o que aparece para os jogadores. A prévia mostra o resultado.',
            fog: 'Clique e arraste sobre o mapa para revelar ou ocultar células. Os jogadores só veem as células reveladas.',
            ruler: 'Arraste sobre o mapa para medir a distância em quadrados da grade.',
        }[state.tab];
    }

    function render() {
        renderLayers();
        renderFog();
        renderRuler();
        renderHint();
    }

    // Abas

    root.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
        state.tab = tab.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach((item) => {
            if (item === tab) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });
        root.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== state.tab; });
        stage.dataset.tool = state.tab;
        render();
    }));

    // Camadas

    const PRESETS = {
        image: { show_background: true, background_opacity: 100, show_grid: false, grid_opacity: 0, show_tokens: false },
        grid: { show_background: false, background_opacity: 0, show_grid: true, grid_opacity: 90, show_tokens: true },
        balanced: { show_background: true, background_opacity: 100, show_grid: true, grid_opacity: 75, show_tokens: true },
    };

    root.querySelectorAll('[data-layer-preset]').forEach((button) => button.addEventListener('click', () => {
        Object.assign(state.layers, PRESETS[button.dataset.layerPreset]);
        markDirty();
        render();
    }));

    root.querySelectorAll('[data-layer]').forEach((input) => input.addEventListener('input', () => {
        state.layers[input.dataset.layer] = input.type === 'checkbox' ? input.checked : Number(input.value);
        markDirty();
        render();
    }));

    // Névoa

    $('[data-fog-enabled]').addEventListener('change', (event) => {
        state.fogEnabled = event.target.checked;
        markDirty();
        render();
    });

    root.querySelectorAll('[data-brush-mode]').forEach((button) => button.addEventListener('click', () => {
        state.brushMode = button.dataset.brushMode;
        root.querySelectorAll('[data-brush-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    }));

    root.querySelectorAll('[data-brush-size]').forEach((button) => button.addEventListener('click', () => {
        state.brushSize = Number(button.dataset.brushSize);
        root.querySelectorAll('[data-brush-size]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    }));

    root.querySelectorAll('[data-fog-action]').forEach((button) => button.addEventListener('click', () => {
        const action = button.dataset.fogAction;
        const all = Array.from({ length: total }, (_, cell) => cell);

        if (action === 'reveal-all') state.revealed = new Set(all);
        if (action === 'hide-all') state.revealed = new Set();
        if (action === 'entrance') state.revealed = new Set(entranceCells());
        if (action === 'invert') state.revealed = new Set(all.filter((cell) => !state.revealed.has(cell)));

        markDirty();
        render();
    }));

    // Ponteiro sobre o mapa (pincel da névoa ou régua)

    function pointAt(event) {
        const rect = stage.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

        return { x, y, col: Math.min(cols - 1, Math.floor((x / 100) * cols)), row: Math.min(rows - 1, Math.floor((y / 100) * rows)) };
    }

    function paint(point) {
        cellsInRadius(point.col, point.row, state.brushSize, cols, rows).forEach((cell) => {
            if (state.brushMode === 'reveal') state.revealed.add(cell);
            else state.revealed.delete(cell);
        });
        markDirty();
    }

    stage.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || state.tab === 'layers') return;

        stage.setPointerCapture(event.pointerId);
        const point = pointAt(event);

        if (state.tab === 'fog') {
            state.painting = true;
            paint(point);
            renderFog();
        } else {
            state.rulerStart = point;
            state.rulerEnd = point;
            renderRuler();
        }
    });

    stage.addEventListener('pointermove', (event) => {
        const point = pointAt(event);

        if (state.tab === 'fog') {
            state.hover = point;
            if (state.painting) paint(point);
            renderFog();
        } else if (state.tab === 'ruler' && stage.hasPointerCapture(event.pointerId)) {
            state.rulerEnd = point;
            renderRuler();
        }
    });

    const stop = (event) => {
        state.painting = false;
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    };
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);
    stage.addEventListener('pointerleave', () => {
        state.hover = null;
        renderFog();
    });

    // Régua

    $('[data-scale-unit]').addEventListener('change', (event) => {
        state.layers.grid_scale.unit = event.target.value;
        markDirty();
        renderRuler();
    });

    $('[data-scale-value]').addEventListener('input', (event) => {
        state.layers.grid_scale.value_per_square = Math.max(0.1, Number(event.target.value) || 1);
        markDirty();
        renderRuler();
    });

    root.querySelectorAll('[data-scale-preset]').forEach((button) => button.addEventListener('click', () => {
        const [unit, value] = button.dataset.scalePreset.split(':');
        state.layers.grid_scale = { unit, value_per_square: Number(value) };
        markDirty();
        render();
    }));

    // Salvar

    const saveButton = document.querySelector('[data-layers-save]');

    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;

        try {
            const body = await request(config.saveUrl, {
                method: 'PUT',
                data: {
                    layers: state.layers,
                    fog: { enabled: state.fogEnabled, revealed_cells: [...state.revealed].sort((a, b) => a - b) },
                },
            });
            state.dirty = false;
            hint.textContent = body.message;
            hint.dataset.tone = 'success';
        } catch (failure) {
            hint.textContent = failure.message;
            hint.dataset.tone = 'error';
        } finally {
            saveButton.disabled = false;
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (state.dirty) event.preventDefault();
    });

    // A imagem define o tamanho da área; a névoa acompanha.
    const resize = () => renderFog();
    if (image.complete) render();
    else image.addEventListener('load', render, { once: true });
    new ResizeObserver(resize).observe(stage);
    render();
}
