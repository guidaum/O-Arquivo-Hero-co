// Névoa de guerra da masmorra: pincel (revelar/ocultar) e ações do mestre.
// O servidor só aceita mudanças do mestre; os jogadores veem o resultado pelo estado.

import { request } from '../core/http.js';
import { cellsInRadius } from '../core/maps.js';
import { renderFog } from './board.js';

// Célula (coluna/linha) de um ponto em % da imagem.
export function cellAt(grid, point) {
    return {
        col: Math.min(grid.cols - 1, Math.floor((point.x / 100) * grid.cols)),
        row: Math.min(grid.rows - 1, Math.floor((point.y / 100) * grid.rows)),
    };
}

export function createFog(ctx) {
    const { root, $, config, state, grid, stage, viewport } = ctx;
    const area = $('[data-viewport]');
    let painting = false;

    function brushCells(point) {
        const { col, row } = cellAt(grid, point);

        return cellsInRadius(col, row, state.brush.size, grid.cols, grid.rows);
    }

    function paintAt(point) {
        const cells = brushCells(point);
        const revealed = new Set(state.fog.revealed_cells);
        cells.forEach((cell) => (state.brush.mode === 'reveal' ? revealed.add(cell) : revealed.delete(cell)));
        state.fog = { ...state.fog, revealed_cells: [...revealed] };
        state.brushPreview = { mode: state.brush.mode, cells };
    }

    async function save() {
        try {
            await request(config.fogUrl, { method: 'PUT', data: { enabled: state.fog.enabled, revealed_cells: state.fog.revealed_cells } });
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    }

    area.addEventListener('pointerdown', (event) => {
        if (state.mode !== 'fog' || event.button !== 0 || event.target.closest('.glass')) return;
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        painting = true;
        paintAt(point);
        ctx.renderAll();
    });

    area.addEventListener('pointermove', (event) => {
        if (state.mode !== 'fog') return;
        const point = viewport.toPercent(event.clientX, event.clientY);
        if (!point) return;

        if (painting) paintAt(point);
        else state.brushPreview = { mode: state.brush.mode, cells: brushCells(point) };
        renderFog($('[data-fog]'), stage, grid, state.fog, state.layers, config.isGm, state.brushPreview);
    });

    window.addEventListener('pointerup', () => {
        if (painting) {
            painting = false;
            save();
        }
    });

    if (!config.isGm) return;

    $('[data-fog-enabled]').addEventListener('change', (event) => {
        state.fog = { ...state.fog, enabled: event.target.checked };
        save();
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
                const { col, row } = cellAt(grid, token);
                cellsInRadius(col, row, 3, grid.cols, grid.rows).forEach((cell) => set.add(cell));
            });
            cells = [...set];
        }

        state.fog = { ...state.fog, revealed_cells: cells };
        ctx.renderAll();
        save();
    }));
}
