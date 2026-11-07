// Utilidades de mapas com grade (campaignMaps.ts do sistema antigo),
// usadas pelo inspetor de camadas e, depois, pela masmorra.

const UNIT_TEXT = {
    ft: (total) => `${total} pés (${Math.round(total * 0.3048 * 10) / 10}m)`,
    m: (total) => `${total} metros`,
    km: (total) => `${total} km`,
    mi: (total) => `${total} milhas`,
    leagues: (total) => `${total} léguas`,
};

/**
 * Distância entre dois pontos (em %) contada em quadrados da grade e
 * convertida pela escala { unit, value_per_square }.
 */
export function gridDistance(from, to, cols = 24, rows = 14, scale = { unit: 'ft', value_per_square: 5 }) {
    const dxSquares = Math.abs(to.x - from.x) / (100 / (cols || 24));
    const dySquares = Math.abs(to.y - from.y) / (100 / (rows || 14));
    const squares = Math.sqrt(dxSquares ** 2 + dySquares ** 2);
    const rounded = Math.round(squares * 10) / 10;
    const total = Math.round(squares * (scale?.value_per_square || 5) * 10) / 10;
    const format = UNIT_TEXT[scale?.unit];

    return {
        squares: rounded,
        total,
        formatted: format ? `${rounded} quad. • ${format(total)}` : `${rounded} blocos`,
    };
}

/** Células num raio (1 = só a célula, 2 = 3×3, 3 = 5×5), em índices linha * colunas + coluna. */
export function cellsInRadius(col, row, radius, cols, rows) {
    const cells = [];
    const reach = radius - 1;

    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            const c = col + dx;
            const r = row + dy;

            if (c >= 0 && c < cols && r >= 0 && r < rows) cells.push(r * cols + c);
        }
    }

    return cells;
}
