// Desenhos sobre o mapa (MapDrawingOverlay.tsx + MapDrawingToolbar.tsx).
// Os traços ficam no servidor; esta camada desenha em SVG (0–100 %) e
// envia cada traço terminado. Desfazer apaga o último traço próprio desta
// página; refazer o envia de novo.

import { deleteJson, postJson, request } from '../core/http.js';
import { el, replace } from '../core/dom.js';

export const DRAWING_COLORS = [
    ['Ciano Arcano', '#38bdf8'],
    ['Brasa / Vermelho', '#ef4444'],
    ['Ouro Real', '#f59e0b'],
    ['Esmeralda', '#10b981'],
    ['Púrpura Mística', '#c084fc'],
    ['Rosa Choque', '#f43f5e'],
    ['Branco Puro', '#ffffff'],
    ['Sombra Ébano', '#18181b'],
];

export const STROKE_SIZES = [['Fino', 2], ['Médio', 4], ['Grosso', 7]];

const SVG = 'http://www.w3.org/2000/svg';
const CLOSE_DISTANCE = 4.5;
const MIN_STEP = 0.25;

function svg(tag, attributes) {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attributes).forEach(([name, value]) => {
        if (value !== null && value !== undefined) node.setAttribute(name, String(value));
    });

    return node;
}

const pointsText = (points) => points.map((point) => `${point.x},${point.y}`).join(' ');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createDrawing({ layer, toolbar, url, toPercent, notify }) {
    const state = {
        active: false,
        tool: 'pen',
        color: DRAWING_COLORS[0][1],
        size: STROKE_SIZES[1][1],
        strokes: [],
        current: null,
        undo: [],
        redo: [],
    };

    // Barra de ferramentas

    replace(toolbar.querySelector('[data-draw-colors]'), DRAWING_COLORS.map(([name, hex]) => el('button', {
        type: 'button',
        class: 'draw-color',
        title: name,
        'aria-label': name,
        'aria-pressed': String(hex === state.color),
        style: `--swatch: ${hex}`,
        dataset: { drawColor: hex },
    })));

    replace(toolbar.querySelector('[data-draw-sizes]'), STROKE_SIZES.map(([label, size]) => el('button', {
        type: 'button',
        class: 'draw-size',
        title: `Espessura: ${label}`,
        'aria-pressed': String(size === state.size),
        dataset: { drawSize: size },
    }, el('span', { style: `--dot: ${size + 2}px` }))));

    function syncToolbar() {
        toolbar.querySelectorAll('[data-draw-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.drawTool === state.tool)));
        toolbar.querySelectorAll('[data-draw-color]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.drawColor === state.color)));
        toolbar.querySelectorAll('[data-draw-size]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.drawSize) === state.size)));
        layer.dataset.tool = state.tool;
    }

    toolbar.addEventListener('click', (event) => {
        const button = event.target.closest('button');

        if (!button) return;
        if (button.dataset.drawTool) state.tool = button.dataset.drawTool;
        if (button.dataset.drawColor) state.color = button.dataset.drawColor;
        if (button.dataset.drawSize) state.size = Number(button.dataset.drawSize);
        if (button.hasAttribute('data-draw-undo')) undo();
        if (button.hasAttribute('data-draw-redo')) redo();
        if (button.dataset.drawClear) clear(button.dataset.drawClear === 'all');

        cancelCurrent();
        syncToolbar();
    });

    // Desenho

    function render() {
        const nodes = state.strokes.map((stroke) => {
            const closed = stroke.is_closed || stroke.is_polygon && stroke.points.length > 2;
            const shape = svg(closed ? 'polygon' : 'polyline', {
                points: pointsText(stroke.points),
                fill: closed ? (stroke.fill_color || `${stroke.color}40`) : 'none',
                stroke: stroke.color,
                'stroke-width': stroke.size,
                class: `drawing-stroke${stroke.can_delete ? ' can-delete' : ''}`,
                'data-id': stroke.id,
            });

            return shape;
        });

        if (state.current) {
            const { points } = state.current;
            nodes.push(svg('polyline', { points: pointsText(points), fill: 'none', stroke: state.color, 'stroke-width': state.size, class: 'drawing-stroke is-current' }));

            if (state.tool === 'polygon' && points.length >= 3) {
                nodes.push(svg('circle', { cx: points[0].x, cy: points[0].y, r: 1.2, class: 'drawing-snap' }));
            }
        }

        layer.replaceChildren(...nodes);
    }

    async function save(stroke) {
        try {
            const body = await postJson(url, stroke);
            state.strokes.push(body.drawing);
            state.undo.push(body.drawing);
            state.redo = [];
            render();
        } catch (failure) {
            notify(failure.message, 'error');
            render();
        }
    }

    function finish(closeShape) {
        const current = state.current;
        state.current = null;

        if (!current || current.points.length < 2) {
            render();
            return;
        }

        const points = [...current.points];
        let closed = closeShape;

        // Caneta: se as pontas se encontram, fecha e preenche.
        if (!closed && state.tool === 'pen' && points.length >= 6 && distance(points[0], points[points.length - 1]) < CLOSE_DISTANCE) {
            closed = true;
        }

        if (closed) points[points.length - 1] = { ...points[0] };

        save({
            points,
            color: state.color,
            fill_color: closed ? `${state.color}40` : null,
            size: state.size,
            is_closed: closed,
            is_polygon: state.tool === 'polygon',
        });
    }

    function cancelCurrent() {
        if (state.current) {
            state.current = null;
            render();
        }
    }

    layer.addEventListener('pointerdown', (event) => {
        if (!state.active || event.button !== 0) return;

        const point = toPercent(event.clientX, event.clientY);

        if (state.tool === 'eraser') {
            const target = event.target.closest('.drawing-stroke.can-delete');
            if (target) erase(Number(target.dataset.id));
            return;
        }

        if (!point) return;
        event.preventDefault();

        if (state.tool === 'polygon') {
            if (state.current && state.current.points.length >= 3 && distance(point, state.current.points[0]) < CLOSE_DISTANCE) {
                state.current.points.push({ ...state.current.points[0] });
                finish(true);
                return;
            }

            state.current ??= { points: [] };
            state.current.points.push(point);
            render();
            return;
        }

        layer.setPointerCapture(event.pointerId);
        state.current = { points: [point] };
        render();
    });

    layer.addEventListener('pointermove', (event) => {
        if (!state.active || state.tool !== 'pen' || !state.current || !layer.hasPointerCapture(event.pointerId)) return;

        const point = toPercent(event.clientX, event.clientY);
        const last = state.current.points[state.current.points.length - 1];

        if (point && distance(point, last) >= MIN_STEP) {
            state.current.points.push(point);
            render();
        }
    });

    layer.addEventListener('pointerup', (event) => {
        if (state.tool === 'pen' && state.current && layer.hasPointerCapture(event.pointerId)) {
            layer.releasePointerCapture(event.pointerId);
            finish(false);
        }
    });

    layer.addEventListener('dblclick', () => {
        if (state.tool === 'polygon' && state.current && state.current.points.length >= 3) {
            state.current.points.push({ ...state.current.points[0] });
            finish(true);
        }
    });

    async function erase(id, remember = true) {
        try {
            await deleteJson(`${url}/${id}`);
            const removed = state.strokes.find((stroke) => stroke.id === id);
            state.strokes = state.strokes.filter((stroke) => stroke.id !== id);
            if (remember && removed?.mine) state.undo = state.undo.filter((stroke) => stroke.id !== id);
            render();
        } catch (failure) {
            notify(failure.message, 'error');
        }
    }

    async function undo() {
        const last = state.undo.pop();

        if (!last) {
            notify('Nada para desfazer.');
            return;
        }

        await erase(last.id, false);
        state.redo.push(last);
    }

    async function redo() {
        const stroke = state.redo.pop();

        if (!stroke) {
            notify('Nada para refazer.');
            return;
        }

        const redoStack = state.redo;
        await save({ points: stroke.points, color: stroke.color, fill_color: stroke.fill_color, size: stroke.size, is_closed: stroke.is_closed, is_polygon: stroke.is_polygon });
        state.redo = redoStack;
    }

    async function clear(all) {
        if (!window.confirm(all ? 'Apagar TODOS os desenhos deste mapa?' : 'Apagar todos os seus desenhos deste mapa?')) return;

        try {
            const body = await request(`${url}${all ? '?todos=1' : ''}`, { method: 'DELETE' });
            state.strokes = state.strokes.filter((stroke) => !all && !stroke.mine);
            state.undo = [];
            state.redo = [];
            render();
            notify(body.message);
        } catch (failure) {
            notify(failure.message, 'error');
        }
    }

    document.addEventListener('keydown', (event) => {
        if (!state.active || !(event.ctrlKey || event.metaKey) || event.target.closest('input, textarea')) return;

        if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            undo();
        } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
            event.preventDefault();
            redo();
        }
    });

    syncToolbar();

    return {
        setActive(active) {
            state.active = active;
            toolbar.hidden = !active;
            layer.classList.toggle('is-active', active);
            if (!active) cancelCurrent();
        },
        /** Traços vindos do servidor (polling). O traço em andamento é mantido. */
        setStrokes(strokes) {
            state.strokes = strokes;
            render();
        },
    };
}
