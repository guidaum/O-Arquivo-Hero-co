// Desenho das camadas do battlemap: grade, névoa, áreas de efeito,
// marcadores, tokens e régua. Coordenadas sempre em % da imagem; o
// tamanho em pixels vem do palco (definido por world-map/viewport.js).

import { el, icon, replace } from '../core/dom.js';
import { gridDistance } from '../core/maps.js';

const SVG = 'http://www.w3.org/2000/svg';

function svg(tag, attributes) {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));

    return node;
}

/** Pés → células, pela escala da grade (padrão: 5 pés por quadrado). */
function feetToCells(feet, scale) {
    const perSquare = scale?.unit === 'ft' ? (scale.value_per_square || 5) : 5;

    return feet / perSquare;
}

export function stageSize(stage) {
    return { width: stage.clientWidth, height: stage.clientHeight };
}

export function renderGrid(gridEl, grid, layers) {
    gridEl.style.setProperty('--cols', grid.cols);
    gridEl.style.setProperty('--rows', grid.rows);
    gridEl.style.opacity = layers.show_grid ? String(layers.grid_opacity / 100) : '0';
}

/**
 * Névoa: para o jogador, células ocultas ficam escuras na opacidade do
 * mestre; para o mestre, ficam translúcidas (ele vê o que está escondido).
 */
export function renderFog(canvas, stage, grid, fog, layers, isGm, brush = null) {
    const { width, height } = stageSize(stage);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!fog.enabled && !brush) return;

    const cellW = width / grid.cols;
    const cellH = height / grid.rows;
    const revealed = new Set(fog.revealed_cells);
    const total = grid.cols * grid.rows;
    const opacity = isGm ? 0.55 : Math.max(0.1, layers.fog_opacity / 100);

    ctx.fillStyle = `rgba(6, 5, 10, ${opacity})`;
    for (let cell = 0; cell < total; cell++) {
        if (!revealed.has(cell)) {
            ctx.fillRect((cell % grid.cols) * cellW, Math.floor(cell / grid.cols) * cellH, cellW + 0.5, cellH + 0.5);
        }
    }

    if (brush) {
        ctx.strokeStyle = brush.mode === 'reveal' ? '#38bdf8' : '#ef4444';
        ctx.lineWidth = 2;
        brush.cells.forEach((cell) => ctx.strokeRect((cell % grid.cols) * cellW + 1, Math.floor(cell / grid.cols) * cellH + 1, cellW - 2, cellH - 2));
    }
}

export function renderAoes(layer, stage, grid, aoes, scale, selectedId) {
    const { width, height } = stageSize(stage);
    layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    layer.replaceChildren();
    const cell = width / grid.cols;

    aoes.forEach((aoe) => {
        const x = (aoe.x / 100) * width;
        const y = (aoe.y / 100) * height;
        const size = feetToCells(aoe.radius_feet, scale) * cell;
        const group = svg('g', {
            class: `aoe${aoe.can_edit ? ' can-edit' : ''}${aoe.id === selectedId ? ' is-selected' : ''}`,
            'data-aoe': aoe.id,
            transform: `rotate(${aoe.rotation} ${x} ${y})`,
            style: `--aoe-color: ${aoe.color}`,
        });
        let shape;

        if (aoe.type === 'circle') {
            shape = svg('circle', { cx: x, cy: y, r: size });
        } else if (aoe.type === 'cube') {
            shape = svg('rect', { x: x - size / 2, y: y - size / 2, width: size, height: size });
        } else if (aoe.type === 'line') {
            shape = svg('rect', { x, y: y - cell / 2, width: size, height: cell });
        } else {
            // Cone de 53°: a largura no fim é igual ao comprimento.
            shape = svg('polygon', { points: `${x},${y} ${x + size},${y - size / 2} ${x + size},${y + size / 2}` });
        }

        group.append(shape, svg('circle', { cx: x, cy: y, r: 4, class: 'aoe__origin' }));
        layer.append(group);

        // O rótulo fica fora do grupo girado, para nunca aparecer de cabeça para baixo.
        if (aoe.name) {
            const label = svg('text', { x, y: y - 10, class: 'aoe__label', 'text-anchor': 'middle' });
            label.textContent = `${aoe.name} · ${aoe.radius_feet} pés`;
            layer.append(label);
        }
    });
}

export function renderMarkers(layer, markers, categories, onOpen) {
    replace(layer, markers.map((marker) => {
        const category = categories[marker.category] ?? categories.note;

        return el('button', {
            type: 'button',
            class: 'dungeon-marker',
            style: `left: ${marker.x}%; top: ${marker.y}%; --marker-color: ${category.color}`,
            title: `${marker.label} · ${category.label}`,
            dataset: { marker: marker.id },
            onClick: (event) => {
                event.stopPropagation();
                onOpen(marker);
            },
        }, icon(category.icon, 16));
    }));
}

export function renderTokens(layer, stage, grid, tokens, { selectedId, activeId, conditions, showTokens, onSelect }) {
    const { width } = stageSize(stage);
    const cell = width / grid.cols;

    replace(layer, tokens.map((token) => {
        const size = cell * token.size * 0.86;
        const percent = token.max_hp > 0 ? Math.max(0, Math.min(1, token.hp / token.max_hp)) : 1;

        return el('button', {
            type: 'button',
            class: [
                'token',
                `token--${token.type}`,
                token.id === selectedId ? 'is-selected' : '',
                token.id === activeId ? 'is-active-turn' : '',
                token.is_hidden ? 'is-hidden' : '',
                token.can_control ? 'can-control' : '',
                token.hp <= 0 ? 'is-down' : '',
                showTokens ? '' : 'is-faded',
            ].filter(Boolean).join(' '),
            style: `left: ${token.x}%; top: ${token.y}%; width: ${size}px; height: ${size}px; --token-color: ${token.color}`,
            title: `${token.name} · PV ${token.hp}/${token.max_hp}`,
            dataset: { token: token.id },
            onClick: (event) => {
                event.stopPropagation();
                onSelect(token);
            },
        },
        token.avatar_url
            ? el('img', { src: token.avatar_url, alt: '', draggable: 'false', referrerpolicy: 'no-referrer' })
            : el('span', { class: 'token__initial' }, token.name.charAt(0).toUpperCase()),
        el('span', { class: 'token__hp' }, el('span', { style: `width: ${percent * 100}%` })),
        token.conditions.length ? el('span', { class: 'token__conditions' }, token.conditions.slice(0, 3).map((id) => conditions[id]?.symbol ?? '')) : null,
        el('span', { class: 'token__name' }, token.name));
    }));
}

export function renderRuler(layer, stage, grid, scale, from, to) {
    const { width, height } = stageSize(stage);
    layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    layer.replaceChildren();

    if (!from || !to) return;

    const x1 = (from.x / 100) * width;
    const y1 = (from.y / 100) * height;
    const x2 = (to.x / 100) * width;
    const y2 = (to.y / 100) * height;
    const distance = gridDistance(from, to, grid.cols, grid.rows, scale);
    const label = svg('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 10, 'text-anchor': 'middle', class: 'ruler__label' });
    label.textContent = distance.formatted;

    layer.append(
        svg('line', { x1, y1, x2, y2, class: 'ruler__line' }),
        svg('circle', { cx: x1, cy: y1, r: 5, class: 'ruler__dot' }),
        svg('circle', { cx: x2, cy: y2, r: 7, class: 'ruler__dot' }),
        label,
    );
}
