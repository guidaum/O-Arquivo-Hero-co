// Utilidades de mapas com grade (campaignMaps.ts do sistema antigo), usadas
// pelo inspetor de camadas e pela masmorra.
//
// A grade é { cols, rows, type } com type 'square' ou 'hex'. Coordenadas em %
// da imagem; células numeradas linha * colunas + coluna nos dois formatos.
// Espelho de App\Support\BoardGrid (mudanças nos dois lados): hexágonos com
// pontas para cima, linhas ímpares deslocadas meia célula para a direita,
// largura 100 / (colunas + 0,5) e passo vertical 100 / (linhas + 1/3).

export const SQUARE = 'square';
export const HEX = 'hex';

const UNIT_TEXT = {
    ft: (total) => `${total} pés (${Math.round(total * 0.3048 * 10) / 10}m)`,
    m: (total) => `${total} metros`,
    km: (total) => `${total} km`,
    mi: (total) => `${total} milhas`,
    leagues: (total) => `${total} léguas`,
};

const isHex = (type) => type === HEX;

function hexMetrics(cols, rows) {
    return { width: 100 / (cols + 0.5), step: 100 / (rows + 1 / 3) };
}

/** Largura de uma célula em % da largura da imagem. */
export function cellWidth(grid) {
    return isHex(grid.type) ? hexMetrics(grid.cols, grid.rows).width : 100 / grid.cols;
}

/** Coluna e linha da célula sob um ponto (em %). */
export function cellAt(grid, point) {
    const { cols, rows } = grid;

    if (!isHex(grid.type)) {
        return {
            col: Math.max(0, Math.min(cols - 1, Math.floor((point.x / 100) * cols))),
            row: Math.max(0, Math.min(rows - 1, Math.floor((point.y / 100) * rows))),
        };
    }

    // Centro mais próximo numa métrica em que o hexágono desenhado é a célula
    // de Voronoi (o eixo vertical, em passos, pesa (√3/2)²).
    const { width, step } = hexMetrics(cols, rows);
    const u = point.x / width;
    const v = point.y / step;
    const base = Math.floor(v);
    let best = { col: 0, row: 0 };
    let bestDistance = Infinity;

    for (let row = base - 1; row <= base + 1; row++) {
        if (row < 0 || row >= rows) continue;

        const offset = row % 2 === 1 ? 0.5 : 0;
        const col = Math.max(0, Math.min(cols - 1, Math.round(u - 0.5 - offset)));
        const distance = (u - (col + 0.5 + offset)) ** 2 + 0.75 * (v - (row + 2 / 3)) ** 2;

        if (distance < bestDistance) {
            bestDistance = distance;
            best = { col, row };
        }
    }

    return best;
}

/** Centro de uma célula (em %). */
export function cellCenter(grid, col, row) {
    if (!isHex(grid.type)) {
        return { x: ((col + 0.5) * 100) / grid.cols, y: ((row + 0.5) * 100) / grid.rows };
    }

    const { width, step } = hexMetrics(grid.cols, grid.rows);

    return { x: (col + 0.5 + (row % 2 === 1 ? 0.5 : 0)) * width, y: (row + 2 / 3) * step };
}

/** Vértices de uma célula (em %), para desenhar névoa e pincel. */
export function cellPolygon(grid, col, row) {
    if (!isHex(grid.type)) {
        const w = 100 / grid.cols;
        const h = 100 / grid.rows;
        const x = col * w;
        const y = row * h;

        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    }

    const { width, step } = hexMetrics(grid.cols, grid.rows);
    const { x, y } = cellCenter(grid, col, row);
    const half = width / 2;

    return [
        [x, y - (2 * step) / 3],
        [x + half, y - step / 3],
        [x + half, y + step / 3],
        [x, y + (2 * step) / 3],
        [x - half, y + step / 3],
        [x - half, y - step / 3],
    ];
}

/** Distância em hexágonos entre duas células (coordenadas cúbicas). */
export function hexDistance(a, b) {
    const q = (cell) => cell.col - (cell.row - (cell.row & 1)) / 2;
    const dq = q(a) - q(b);
    const dr = a.row - b.row;

    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * Células ao redor de outra: raio 1 = só ela; quadrados 2 = 3×3, 3 = 5×5;
 * hexágonos 2 = ela e os 6 vizinhos, 3 = dois anéis.
 */
export function cellsInRadius(col, row, radius, cols, rows, type = SQUARE) {
    const cells = [];
    const reach = radius - 1;
    const extra = isHex(type) ? 1 : 0;

    for (let r = row - reach; r <= row + reach; r++) {
        for (let c = col - reach - extra; c <= col + reach + extra; c++) {
            if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
            if (isHex(type) && hexDistance({ col, row }, { col: c, row: r }) > reach) continue;

            cells.push(r * cols + c);
        }
    }

    return cells;
}

/**
 * Distância entre dois pontos (em %) convertida pela escala
 * { unit, value_per_square }. Quadrados: linha reta medida em quadrados;
 * hexágonos: número de hexágonos entre as duas células.
 */
export function gridDistance(from, to, cols = 24, rows = 14, scale = { unit: 'ft', value_per_square: 5 }, type = SQUARE) {
    let cells;

    if (isHex(type)) {
        const grid = { cols: cols || 24, rows: rows || 14, type };
        cells = hexDistance(cellAt(grid, from), cellAt(grid, to));
    } else {
        const dxSquares = Math.abs(to.x - from.x) / (100 / (cols || 24));
        const dySquares = Math.abs(to.y - from.y) / (100 / (rows || 14));
        cells = Math.sqrt(dxSquares ** 2 + dySquares ** 2);
    }

    const rounded = Math.round(cells * 10) / 10;
    const total = Math.round(cells * (scale?.value_per_square || 5) * 10) / 10;
    const format = UNIT_TEXT[scale?.unit];
    const label = isHex(type) ? 'hex.' : 'quad.';

    return {
        squares: rounded,
        total,
        formatted: format ? `${rounded} ${label} • ${format(total)}` : `${rounded} blocos`,
    };
}

/** Caminho SVG da grade inteira, para um <svg viewBox="0 0 100 100">. */
export function gridPath(grid) {
    const { cols, rows } = grid;
    const n = (value) => Math.round(value * 1000) / 1000;
    const parts = [];

    if (!isHex(grid.type)) {
        for (let col = 0; col <= cols; col++) parts.push(`M${n((col * 100) / cols)} 0V100`);
        for (let row = 0; row <= rows; row++) parts.push(`M0 ${n((row * 100) / rows)}H100`);

        return parts.join('');
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const points = cellPolygon(grid, col, row);
            parts.push(`M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`);
        }
    }

    return parts.join('');
}

/**
 * Desenha a grade num <svg data-grid> (contorno escuro + linha clara, legível
 * em mapas claros e escuros). O caminho só é refeito quando a grade muda.
 */
export function renderGridSvg(svgEl, grid, visible, opacity) {
    const key = `${grid.type}:${grid.cols}x${grid.rows}`;

    if (svgEl.dataset.gridKey !== key) {
        const ns = 'http://www.w3.org/2000/svg';
        const d = gridPath(grid);
        const shadow = document.createElementNS(ns, 'path');
        const line = document.createElementNS(ns, 'path');
        [[shadow, 'board-grid__shadow'], [line, 'board-grid__line']].forEach(([path, name]) => {
            path.setAttribute('d', d);
            path.setAttribute('class', name);
            path.setAttribute('vector-effect', 'non-scaling-stroke');
        });
        svgEl.replaceChildren(shadow, line);
        svgEl.dataset.gridKey = key;
        svgEl.dataset.gridType = grid.type || SQUARE;
    }

    svgEl.style.opacity = visible ? String(opacity) : '0';
}

/**
 * Névoa num canvas já dimensionado (width × height em px CSS): cobre tudo e
 * recorta as células reveladas. Nos hexágonos, as sobras da borda da imagem
 * (fora de qualquer célula) ficam sempre cobertas.
 */
export function paintFog(ctx, grid, width, height, revealed, color) {
    const scaleX = width / 100;
    const scaleY = height / 100;
    const total = grid.cols * grid.rows;

    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    if (revealed.size) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        revealed.forEach((cell) => {
            if (cell < 0 || cell >= total) return;
            tracePolygon(ctx, cellPolygon(grid, cell % grid.cols, Math.floor(cell / grid.cols)), scaleX, scaleY);
        });
        ctx.fillStyle = '#000';
        ctx.fill();
    }

    ctx.restore();
}

/** Contorno das células do pincel. */
export function strokeCells(ctx, grid, width, height, cells, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    cells.forEach((cell) => tracePolygon(ctx, cellPolygon(grid, cell % grid.cols, Math.floor(cell / grid.cols)), width / 100, height / 100));
    ctx.stroke();
    ctx.restore();
}

function tracePolygon(ctx, points, scaleX, scaleY) {
    points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x * scaleX, y * scaleY);
        else ctx.lineTo(x * scaleX, y * scaleY);
    });
    ctx.closePath();
}
