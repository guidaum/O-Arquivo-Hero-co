// Elementos do Estúdio de Esboços. Cada área pintada usa uma cor única no
// esboço: é por ela que o cartógrafo (cartographer.js) sabe o que é cada
// pixel. Elementos "stamp" são símbolos posicionados (cidades, portas...).
//
// kind: "area" (pincel, retângulo, polígono, balde), "line" (rios, estradas),
//       "stamp" (símbolo num ponto).

export const WORLD = {
    background: { id: 'oceano', name: 'Oceano', color: '#1e3a5f' },
    elements: [
        { id: 'continente', name: 'Continente', kind: 'area', color: '#65a30d', size: 32, icon: 'compass', hint: 'Massa continental e terra firme' },
        { id: 'ilhas', name: 'Ilhas', kind: 'area', color: '#84cc16', size: 16, icon: 'layers', hint: 'Ilhotas, atóis e arquipélagos' },
        { id: 'montanhas', name: 'Montanhas', kind: 'area', color: '#64748b', size: 14, icon: 'mountain', hint: 'Cordilheiras e picos' },
        { id: 'florestas', name: 'Florestas', kind: 'area', color: '#166534', size: 24, icon: 'tree-pine', hint: 'Bosques, selvas e taigas' },
        { id: 'desertos', name: 'Desertos', kind: 'area', color: '#eab308', size: 28, icon: 'sun', hint: 'Dunas e desertos de sal' },
        { id: 'terras_gelidas', name: 'Terras Gélidas', kind: 'area', color: '#7dd3fc', size: 26, icon: 'sparkles', hint: 'Geleiras e tundras' },
        { id: 'rios', name: 'Rios', kind: 'line', color: '#0284c7', size: 6, icon: 'activity', hint: 'Rios, afluentes e deltas' },
        { id: 'estradas', name: 'Estradas', kind: 'line', color: '#b45309', size: 4, icon: 'compass', hint: 'Rotas comerciais e trilhas' },
        { id: 'cidades', name: 'Cidades', kind: 'stamp', color: '#dc2626', size: 18, icon: 'castle', hint: 'Capitais e cidades muradas' },
        { id: 'vilas', name: 'Vilas', kind: 'stamp', color: '#f97316', size: 14, icon: 'tent', hint: 'Aldeias e povoados' },
        { id: 'fazendas', name: 'Fazendas', kind: 'stamp', color: '#a3e635', size: 16, icon: 'grid', hint: 'Campos cultivados e moinhos' },
        { id: 'catacumbas', name: 'Catacumbas', kind: 'stamp', color: '#9333ea', size: 14, icon: 'skull', hint: 'Criptas e ruínas' },
        { id: 'cemiterios', name: 'Cemitérios', kind: 'stamp', color: '#475569', size: 12, icon: 'crosshair', hint: 'Campos santos e mausoléus' },
    ],
};

export const DUNGEON = {
    background: { id: 'rocha', name: 'Rocha', color: '#1c1917' },
    elements: [
        { id: 'piso', name: 'Salas e corredores', kind: 'area', color: '#a8a29e', size: 28, icon: 'grid', hint: 'Piso transitável: as paredes surgem nas bordas' },
        { id: 'agua', name: 'Água', kind: 'area', color: '#2563eb', size: 22, icon: 'activity', hint: 'Poças, lagos e canais subterrâneos' },
        { id: 'lava', name: 'Lava', kind: 'area', color: '#ea580c', size: 20, icon: 'flame', hint: 'Rios de magma' },
        { id: 'escombros', name: 'Escombros', kind: 'area', color: '#78716c', size: 18, icon: 'hammer', hint: 'Desmoronamentos (terreno difícil)' },
        { id: 'porta', name: 'Porta', kind: 'stamp', color: '#92400e', size: 14, icon: 'key', hint: 'Clique sobre a parede entre salas' },
        { id: 'escada', name: 'Escada', kind: 'stamp', color: '#e7e5e4', size: 18, icon: 'layers', hint: 'Subida ou descida de andar' },
        { id: 'pilar', name: 'Pilar', kind: 'stamp', color: '#57534e', size: 12, icon: 'shield', hint: 'Colunas de pedra' },
        { id: 'bau', name: 'Baú', kind: 'stamp', color: '#ca8a04', size: 12, icon: 'gem', hint: 'Tesouro' },
        { id: 'armadilha', name: 'Armadilha', kind: 'stamp', color: '#dc2626', size: 12, icon: 'alert-triangle', hint: 'Armadilha escondida' },
        { id: 'altar', name: 'Altar', kind: 'stamp', color: '#a855f7', size: 16, icon: 'sparkles', hint: 'Altar ou círculo ritual' },
    ],
};

export const DIMENSIONS = [
    { id: 'hd', name: '16:9 HD', width: 1280, height: 720 },
    { id: 'fhd', name: '16:9 Full HD', width: 1920, height: 1080 },
    { id: 'square', name: '1:1 Quadrado', width: 1024, height: 1024 },
    { id: 'panoramic', name: '21:9 Panorâmico', width: 1920, height: 820 },
    { id: 'vertical', name: '9:16 Vertical', width: 720, height: 1280 },
];

export const BRUSH_SCALES = [['Fino', 0.5], ['Normal', 1], ['Grosso', 1.8], ['Enorme', 2.5]];

export function palette(type) {
    return type === 'dungeon' ? DUNGEON : WORLD;
}

export function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
