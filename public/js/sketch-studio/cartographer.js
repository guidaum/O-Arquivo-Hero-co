// Cartógrafo do navegador: transforma o esboço (cores semânticas + símbolos)
// num mapa ilustrado, só com Canvas. É instantâneo, gratuito e sempre
// funciona; o resultado também serve de base para o refino por IA.
//
// Etapas: 1) classificar cada pixel pela cor do elemento; 2) distâncias até a
// costa (mundo) ou até as paredes (masmorra); 3) pintar a base pixel a pixel
// com ruído; 4) desenhar símbolos, acabamento e grade.

import { hexToRgb } from './elements.js';

// Ruído

const PERM = new Uint8Array(512);
{
    let seed = 1337;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const base = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [base[i], base[j]] = [base[j], base[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = base[i & 255];
}

function valueNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => PERM[(PERM[a & 255] + b) & 511] / 255;
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);

    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y) {
    return valueNoise(x, y) * 0.55 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.15;
}

function hash(x, y) {
    return PERM[(PERM[x & 255] + (y & 255)) & 511] / 255;
}

// Utilidades de imagem

function classify(data, colors, width, height) {
    const classes = new Uint8Array(width * height);
    const rgb = colors.map(hexToRgb);

    for (let i = 0, p = 0; i < classes.length; i++, p += 4) {
        let best = 0;
        let bestDistance = Infinity;

        for (let c = 0; c < rgb.length; c++) {
            const dr = data[p] - rgb[c][0];
            const dg = data[p + 1] - rgb[c][1];
            const db = data[p + 2] - rgb[c][2];
            const distance = dr * dr + dg * dg + db * db;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = c;
            }
        }

        classes[i] = best;
    }

    return classes;
}

/** Distância aproximada (chanfro 1 / √2) de cada pixel até o pixel mais próximo onde target(i) é verdadeiro. */
function distanceField(width, height, target, cap = 255) {
    const field = new Float32Array(width * height);
    const diagonal = Math.SQRT2;

    for (let i = 0; i < field.length; i++) field[i] = target(i) ? 0 : cap;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            let value = field[i];
            if (value === 0) continue;
            if (x > 0) value = Math.min(value, field[i - 1] + 1);
            if (y > 0) {
                value = Math.min(value, field[i - width] + 1);
                if (x > 0) value = Math.min(value, field[i - width - 1] + diagonal);
                if (x < width - 1) value = Math.min(value, field[i - width + 1] + diagonal);
            }
            field[i] = value;
        }
    }

    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const i = y * width + x;
            let value = field[i];
            if (value === 0) continue;
            if (x < width - 1) value = Math.min(value, field[i + 1] + 1);
            if (y < height - 1) {
                value = Math.min(value, field[i + width] + 1);
                if (x < width - 1) value = Math.min(value, field[i + width + 1] + diagonal);
                if (x > 0) value = Math.min(value, field[i + width - 1] + diagonal);
            }
            field[i] = value;
        }
    }

    return field;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (color, alpha = 1) => `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha})`;

function setPixel(out, i, color, factor = 1) {
    const p = i * 4;
    out[p] = color[0] * factor;
    out[p + 1] = color[1] * factor;
    out[p + 2] = color[2] * factor;
    out[p + 3] = 255;
}

/** Pontos de uma grade com deslocamento aleatório (para espalhar símbolos). */
function scatter(width, height, step, seed, visit) {
    const points = [];

    for (let y = step / 2; y < height; y += step) {
        for (let x = step / 2; x < width; x += step) {
            const gx = Math.floor(x / step);
            const gy = Math.floor(y / step);
            const px = Math.round(x + (hash(gx + seed, gy) - 0.5) * step * 0.8);
            const py = Math.round(y + (hash(gx, gy + seed) - 0.5) * step * 0.8);
            if (px >= 0 && py >= 0 && px < width && py < height) points.push([px, py, hash(gx * 3 + seed, gy * 7)]);
        }
    }

    points.sort((a, b) => a[1] - b[1]).forEach(visit);
}

// Mapa do mundo

const WORLD_THEMES = {
    parchment: { ocean: [170, 192, 186], deep: [138, 164, 160], land: [233, 214, 172], island: [228, 210, 166], forest: [184, 192, 134], mountain: [205, 186, 150], desert: [238, 216, 156], ice: [243, 241, 233], river: [96, 132, 150], road: [126, 86, 52], ink: [72, 52, 34], tree: [118, 132, 76], paper: true },
    painted: { ocean: [70, 132, 178], deep: [30, 74, 120], land: [146, 190, 108], island: [156, 196, 116], forest: [70, 122, 60], mountain: [152, 134, 114], desert: [224, 198, 128], ice: [238, 245, 249], river: [58, 124, 186], road: [126, 88, 56], ink: [40, 44, 38], tree: [44, 92, 44], paper: false },
    contemporary: { ocean: [126, 176, 214], deep: [56, 108, 168], land: [182, 210, 148], island: [188, 214, 152], forest: [112, 162, 94], mountain: [184, 164, 134], desert: [232, 214, 166], ice: [246, 249, 251], river: [74, 132, 204], road: [168, 92, 60], ink: [64, 64, 64], tree: [80, 130, 70], paper: false },
    futuristic: { ocean: [8, 18, 36], deep: [3, 8, 20], land: [14, 44, 62], island: [16, 50, 70], forest: [10, 62, 66], mountain: [32, 62, 86], desert: [52, 54, 44], ice: [44, 86, 106], river: [0, 200, 255], road: [255, 170, 0], ink: [0, 224, 255], tree: [0, 170, 160], paper: false, glow: true },
};

function renderWorld(ctx, data, stamps, width, height, theme, name, colors) {
    const t = WORLD_THEMES[theme] ?? WORLD_THEMES.parchment;
    const OCEAN = 0, CONTINENT = 1, ISLAND = 2, MOUNTAIN = 3, FOREST = 4, DESERT = 5, ICE = 6, RIVER = 7, ROAD = 8;
    const classes = classify(data, colors, width, height);
    // Rios e estradas só contam como terra perto de terra firme; no mar viram mar
    // (assim um rio que passa da costa não vira um "píer" contornado).
    const isTerrain = (i) => classes[i] !== OCEAN && classes[i] !== RIVER && classes[i] !== ROAD;
    const toTerrain = distanceField(width, height, isTerrain, 20);
    for (let i = 0; i < classes.length; i++) {
        if ((classes[i] === RIVER || classes[i] === ROAD) && toTerrain[i] > 8) classes[i] = OCEAN;
    }
    const isLand = (i) => classes[i] !== OCEAN;
    const toLand = distanceField(width, height, isLand, 80);
    const toOcean = distanceField(width, height, (i) => !isLand(i), 80);
    const image = ctx.createImageData(width, height);
    const out = image.data;
    const base = { [CONTINENT]: t.land, [ISLAND]: t.island, [MOUNTAIN]: t.mountain, [FOREST]: t.forest, [DESERT]: t.desert, [ICE]: t.ice };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const cls = classes[i];
            const grain = 0.9 + fbm(x / 90, y / 90) * 0.14 + (t.paper ? (hash(x, y) - 0.5) * 0.05 : 0);

            if (cls === OCEAN) {
                const d = toLand[i];
                let color = mix(t.ocean, t.deep, Math.min(1, d / 70));
                // Linhas de onda paralelas à costa.
                for (const ring of [5, 11, 19]) {
                    const edge = Math.abs(d - ring);
                    if (edge < 0.8) color = mix(color, t.ink, (0.8 - edge) * (t.glow ? 0.6 : 0.35));
                }
                setPixel(out, i, color, grain);
                continue;
            }

            if (toOcean[i] <= 1.6) {
                setPixel(out, i, t.ink, 1);
                continue;
            }

            if (cls === RIVER) {
                setPixel(out, i, t.river, 1);
                continue;
            }

            if (cls === ROAD) {
                const dash = (x + y) % 12 < 7;
                setPixel(out, i, dash ? t.road : t.land, grain);
                continue;
            }

            let color = base[cls] ?? t.land;
            // Terra mais clara perto da costa, como num atlas.
            if (toOcean[i] < 14) color = mix(color, [255, 250, 235], (1 - toOcean[i] / 14) * (t.glow ? 0 : 0.18));
            setPixel(out, i, color, grain);
        }
    }

    ctx.putImageData(image, 0, 0);

    const at = (x, y) => classes[y * width + x];
    const inside = (x, y, cls, margin) => at(x, y) === cls && toOcean[y * width + x] > margin;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Florestas: árvores pequenas.
    scatter(width, height, 12, 11, ([x, y, r]) => {
        if (!inside(x, y, FOREST, 4)) return;
        const size = 3.6 + r * 1.6;
        ctx.strokeStyle = rgba(t.ink, 0.85);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.6);
        ctx.lineTo(x, y + size * 1.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(mix(t.tree, [0, 0, 0], r * 0.2));
        ctx.fill();
        ctx.stroke();
    });

    // Montanhas: picos com lado sombreado.
    scatter(width, height, 22, 29, ([x, y, r]) => {
        if (!inside(x, y, MOUNTAIN, 5)) return;
        const w = 18 + r * 8;
        const h = 14 + r * 8;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(t.mountain, [255, 255, 255], 0.25));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x + w * 0.08, y + h / 2);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(t.mountain, [0, 0, 0], 0.3));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.strokeStyle = rgba(t.ink, 0.9);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // Neve no topo.
        ctx.beginPath();
        ctx.moveTo(x - w * 0.12, y - h * 0.22);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x + w * 0.12, y - h * 0.22);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
    });

    // Desertos: dunas.
    scatter(width, height, 18, 47, ([x, y, r]) => {
        if (!inside(x, y, DESERT, 4)) return;
        ctx.beginPath();
        ctx.arc(x, y + 4, 6 + r * 3, Math.PI * 1.15, Math.PI * 1.85);
        ctx.strokeStyle = rgba(mix(t.desert, t.ink, 0.55), 0.8);
        ctx.lineWidth = 1.2;
        ctx.stroke();
    });

    // Terras gélidas: marcas de gelo.
    scatter(width, height, 16, 61, ([x, y]) => {
        if (!inside(x, y, ICE, 4)) return;
        ctx.strokeStyle = rgba(mix(t.ice, [90, 140, 170], 0.6), 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y);
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x, y + 3);
        ctx.stroke();
    });

    stamps.forEach((stamp) => drawWorldStamp(ctx, stamp, t));
    drawWorldFinish(ctx, width, height, t, name);
}

function drawWorldStamp(ctx, { id, x, y, size }, t) {
    const s = Math.max(10, size);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = rgba(t.ink);
    ctx.lineWidth = 1.5;
    ctx.fillStyle = rgba(mix(t.land, [255, 255, 255], 0.35));

    if (id === 'cidades') {
        const w = s * 1.4;
        ctx.fillStyle = rgba([196, 70, 56]);
        ctx.fillRect(-w / 2, -s * 0.2, w, s * 0.7);
        ctx.strokeRect(-w / 2, -s * 0.2, w, s * 0.7);
        [-w / 2, -s * 0.15, w / 2 - s * 0.3].forEach((tx) => {
            ctx.fillRect(tx, -s * 0.75, s * 0.3, s * 0.6);
            ctx.strokeRect(tx, -s * 0.75, s * 0.3, s * 0.6);
        });
    } else if (id === 'vilas') {
        ctx.fillRect(-s * 0.4, -s * 0.1, s * 0.8, s * 0.5);
        ctx.strokeRect(-s * 0.4, -s * 0.1, s * 0.8, s * 0.5);
        ctx.beginPath();
        ctx.moveTo(-s * 0.55, -s * 0.1);
        ctx.lineTo(0, -s * 0.55);
        ctx.lineTo(s * 0.55, -s * 0.1);
        ctx.closePath();
        ctx.fillStyle = rgba([170, 80, 50]);
        ctx.fill();
        ctx.stroke();
    } else if (id === 'fazendas') {
        ctx.fillStyle = rgba([214, 196, 110]);
        ctx.fillRect(-s * 0.6, -s * 0.4, s * 1.2, s * 0.8);
        ctx.strokeRect(-s * 0.6, -s * 0.4, s * 1.2, s * 0.8);
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
            ctx.moveTo(-s * 0.6, i * s * 0.15);
            ctx.lineTo(s * 0.6, i * s * 0.15);
        }
        ctx.lineWidth = 0.8;
        ctx.stroke();
    } else if (id === 'catacumbas') {
        ctx.fillStyle = rgba([235, 230, 215]);
        ctx.beginPath();
        ctx.arc(0, -s * 0.1, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rgba(t.ink);
        ctx.beginPath();
        ctx.arc(-s * 0.16, -s * 0.12, s * 0.1, 0, Math.PI * 2);
        ctx.arc(s * 0.16, -s * 0.12, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-s * 0.2, s * 0.3, s * 0.4, s * 0.15);
    } else if (id === 'cemiterios') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.55);
        ctx.lineTo(0, s * 0.4);
        ctx.moveTo(-s * 0.28, -s * 0.25);
        ctx.lineTo(s * 0.28, -s * 0.25);
        ctx.stroke();
        ctx.lineWidth = 1;
        [-0.45, 0.45].forEach((offset) => {
            ctx.beginPath();
            ctx.arc(s * offset, s * 0.3, s * 0.12, Math.PI, 0);
            ctx.lineTo(s * offset + s * 0.12, s * 0.45);
            ctx.lineTo(s * offset - s * 0.12, s * 0.45);
            ctx.closePath();
            ctx.stroke();
        });
    }

    ctx.restore();
}

function drawWorldFinish(ctx, width, height, t, name) {
    const unit = Math.min(width, height);

    if (t.glow) {
        // Grade orbital.
        ctx.strokeStyle = 'rgba(0, 224, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += unit / 8) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += unit / 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    } else {
        // Vinheta envelhecida.
        const vignette = ctx.createRadialGradient(width / 2, height / 2, unit * 0.35, width / 2, height / 2, Math.hypot(width, height) / 1.6);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, t.paper ? 'rgba(90, 58, 24, 0.42)' : 'rgba(0, 0, 0, 0.3)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
    }

    // Rosa dos ventos.
    const cx = width - unit * 0.12;
    const cy = height - unit * 0.14;
    const r = unit * 0.075;
    ctx.save();
    ctx.translate(cx, cy);
    for (let k = 0; k < 8; k++) {
        const long = k % 2 === 0;
        const length = long ? r : r * 0.55;
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -length);
        ctx.lineTo(r * 0.12, 0);
        ctx.lineTo(-r * 0.12, 0);
        ctx.closePath();
        ctx.fillStyle = long ? rgba(t.ink) : rgba(mix(t.ink, [255, 255, 255], 0.5));
        ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(t.ink, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba(t.ink);
    ctx.font = `bold ${Math.round(r * 0.35)}px Newsreader, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -r * 1.12);
    ctx.restore();

    // Moldura dupla.
    ctx.strokeStyle = rgba(t.ink, 0.9);
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    ctx.lineWidth = 1;
    ctx.strokeRect(15, 15, width - 30, height - 30);

    // Título em faixa.
    if (name) {
        const size = Math.round(unit * 0.045);
        ctx.font = `600 ${size}px Newsreader, Georgia, serif`;
        const textWidth = ctx.measureText(name).width;
        const bx = 30;
        const by = 30;
        ctx.fillStyle = t.glow ? 'rgba(4, 12, 24, 0.85)' : rgba(mix(t.land, [255, 255, 255], 0.5), 0.92);
        ctx.fillRect(bx, by, textWidth + size * 1.4, size * 1.7);
        ctx.strokeStyle = rgba(t.ink, 0.9);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, textWidth + size * 1.4, size * 1.7);
        ctx.fillStyle = rgba(t.ink);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, bx + size * 0.7, by + size * 0.88);
    }
}

// Masmorra

const DUNGEON_THEMES = {
    stone: { floor: [140, 132, 122], mortar: [74, 68, 62], wall: [60, 56, 52], wallTop: [112, 106, 98], rock: [26, 24, 22], tiles: true },
    cave: { floor: [122, 106, 88], mortar: [90, 78, 64], wall: [64, 54, 44], wallTop: [104, 90, 74], rock: [22, 18, 15], tiles: false },
    crypt: { floor: [112, 116, 122], mortar: [58, 60, 66], wall: [44, 46, 54], wallTop: [92, 94, 104], rock: [15, 15, 19], tiles: true },
    temple: { floor: [184, 178, 168], mortar: [128, 122, 116], wall: [72, 66, 84], wallTop: [136, 128, 158], rock: [18, 16, 26], tiles: true, runes: true },
    volcanic: { floor: [74, 62, 58], mortar: [42, 34, 32], wall: [42, 32, 30], wallTop: [86, 60, 50], rock: [14, 10, 10], tiles: false, embers: true },
};

function renderDungeon(ctx, data, stamps, width, height, theme, grid, colors) {
    const t = DUNGEON_THEMES[theme] ?? DUNGEON_THEMES.stone;
    const ROCK = 0, FLOOR = 1, WATER = 2, LAVA = 3, RUBBLE = 4;
    const classes = classify(data, colors, width, height);
    const walkable = (i) => classes[i] !== ROCK;
    const toWalk = distanceField(width, height, walkable, 40);
    const toRock = distanceField(width, height, (i) => !walkable(i), 40);
    const cellW = width / grid.cols;
    const cellH = height / grid.rows;
    const tileW = cellW / 2;
    const tileH = cellH / 2;
    const wallThickness = Math.max(5, Math.round(Math.min(cellW, cellH) * 0.18));
    const image = ctx.createImageData(width, height);
    const out = image.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const cls = classes[i];
            const n = fbm(x / 40, y / 40);

            if (cls === ROCK) {
                const d = toWalk[i];
                if (d <= wallThickness) {
                    const color = d <= 2.2 ? t.wallTop : t.wall;
                    setPixel(out, i, color, 0.85 + n * 0.3);
                } else {
                    setPixel(out, i, t.rock, 0.7 + n * 0.6);
                }
                continue;
            }

            // Sombra junto às paredes dá profundidade.
            const shade = toRock[i] < 12 ? 1 - 0.5 * (1 - toRock[i] / 12) : 1;

            if (cls === WATER) {
                const ripple = fbm(x / 14, y / 14);
                const color = mix([26, 70, 130], [70, 140, 200], Math.min(1, toRock[i] / 30) * 0.3 + ripple * 0.5);
                setPixel(out, i, color, shade);
                continue;
            }

            if (cls === LAVA) {
                const vein = fbm(x / 22, y / 22);
                const color = vein > 0.62 ? [255, 214, 90] : mix([200, 50, 12], [255, 120, 30], vein);
                setPixel(out, i, color, 1);
                continue;
            }

            let color = t.floor;

            if (t.tiles && cls === FLOOR) {
                const row = Math.floor(y / tileH);
                const offsetX = row % 2 ? tileW / 2 : 0;
                const col = Math.floor((x + offsetX) / tileW);
                const localX = (x + offsetX) - col * tileW;
                const localY = y - row * tileH;
                const variation = (hash(col, row) - 0.5) * 0.18;

                color = localX < 1.2 || localY < 1.2 ? t.mortar : mix(t.floor, [255, 255, 255], variation > 0 ? variation : 0);
                if (variation < 0) color = mix(color, [0, 0, 0], -variation);
            }

            if (cls === RUBBLE) color = mix(t.floor, t.wall, 0.35);

            setPixel(out, i, color, shade * (0.88 + n * 0.24));
        }
    }

    ctx.putImageData(image, 0, 0);

    const at = (x, y) => classes[Math.floor(y) * width + Math.floor(x)];

    // Escombros: pedrinhas.
    scatter(width, height, 9, 5, ([x, y, r]) => {
        if (at(x, y) !== RUBBLE) return;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + r * 3, 1.5 + r * 2, r * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = rgba(mix(t.wallTop, [0, 0, 0], r * 0.4));
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    });

    // Brilho da lava e brasas.
    scatter(width, height, 28, 17, ([x, y]) => {
        if (at(x, y) !== LAVA) return;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
        glow.addColorStop(0, 'rgba(255, 140, 40, 0.35)');
        glow.addColorStop(1, 'rgba(255, 140, 40, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 26, y - 26, 52, 52);
    });

    if (t.runes) {
        scatter(width, height, 70, 3, ([x, y, r]) => {
            if (at(x, y) !== FLOOR || r < 0.55) return;
            ctx.beginPath();
            ctx.arc(x, y, 10 + r * 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(80, 200, 255, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }

    if (t.embers) {
        scatter(width, height, 16, 9, ([x, y, r]) => {
            if (at(x, y) === ROCK || r < 0.8) return;
            ctx.fillStyle = 'rgba(255, 120, 40, 0.7)';
            ctx.fillRect(x, y, 2, 2);
        });
    }

    stamps.forEach((stamp) => drawDungeonStamp(ctx, stamp, Math.min(cellW, cellH)));

    if (grid.show) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 1; c < grid.cols; c++) {
            ctx.moveTo(Math.round(c * cellW) + 0.5, 0);
            ctx.lineTo(Math.round(c * cellW) + 0.5, height);
        }
        for (let r = 1; r < grid.rows; r++) {
            ctx.moveTo(0, Math.round(r * cellH) + 0.5);
            ctx.lineTo(width, Math.round(r * cellH) + 0.5);
        }
        ctx.stroke();
    }
}

function drawDungeonStamp(ctx, { id, x, y }, cell) {
    const s = cell * 0.9;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;

    if (id === 'porta') {
        ctx.fillStyle = '#7c4a1e';
        ctx.fillRect(-s / 2, -s * 0.15, s, s * 0.3);
        ctx.strokeRect(-s / 2, -s * 0.15, s, s * 0.3);
        ctx.shadowBlur = 0;
        ctx.beginPath();
        for (let k = 1; k < 4; k++) {
            ctx.moveTo(-s / 2 + (s / 4) * k, -s * 0.15);
            ctx.lineTo(-s / 2 + (s / 4) * k, s * 0.15);
        }
        ctx.stroke();
    } else if (id === 'escada') {
        ctx.fillStyle = '#9c958c';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.shadowBlur = 0;
        for (let k = 0; k < 5; k++) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.12 + k * 0.1})`;
            ctx.fillRect(-s / 2, -s / 2 + (s / 5) * k, s, 2);
        }
        ctx.strokeRect(-s / 2, -s / 2, s, s);
    } else if (id === 'pilar') {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = '#8a837a';
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(-s * 0.08, -s * 0.08, s * 0.14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
    } else if (id === 'bau') {
        ctx.fillStyle = '#6b3f17';
        ctx.fillRect(-s * 0.35, -s * 0.22, s * 0.7, s * 0.44);
        ctx.strokeRect(-s * 0.35, -s * 0.22, s * 0.7, s * 0.44);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e0b030';
        ctx.fillRect(-s * 0.35, -s * 0.04, s * 0.7, s * 0.08);
        ctx.fillRect(-s * 0.05, -s * 0.1, s * 0.1, s * 0.2);
    } else if (id === 'armadilha') {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
        for (let k = 0; k < 6; k++) {
            const a = (Math.PI * 2 * k) / 6;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * s * 0.08, Math.sin(a) * s * 0.08);
            ctx.lineTo(Math.cos(a + 0.25) * s * 0.28, Math.sin(a + 0.25) * s * 0.28);
            ctx.lineTo(Math.cos(a - 0.25) * s * 0.28, Math.sin(a - 0.25) * s * 0.28);
            ctx.fill();
        }
    } else if (id === 'altar') {
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
        glow.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
        glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.fillStyle = '#b8b0a6';
        ctx.fillRect(-s * 0.45, -s * 0.25, s * 0.9, s * 0.5);
        ctx.strokeRect(-s * 0.45, -s * 0.25, s * 0.9, s * 0.5);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffd27a';
        [-0.3, 0.3].forEach((offset) => {
            ctx.beginPath();
            ctx.arc(s * offset, -s * 0.05, s * 0.06, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ctx.restore();
}

/**
 * Desenha o mapa ilustrado e devolve o canvas resultante.
 *
 * @param {{ area: ImageData, stamps: Array, type: 'world'|'dungeon', theme: string, name: string,
 *           colors: string[], grid: { cols: number, rows: number, show: boolean } }} options
 */
export function renderMap({ area, stamps, type, theme, name, colors, grid }) {
    const { width, height } = area;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (type === 'dungeon') {
        renderDungeon(ctx, area.data, stamps, width, height, theme, grid, colors);
    } else {
        renderWorld(ctx, area.data, stamps, width, height, theme, name, colors);
    }

    return canvas;
}
