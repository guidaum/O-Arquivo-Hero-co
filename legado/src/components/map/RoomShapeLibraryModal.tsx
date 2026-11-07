import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Square, 
  Circle, 
  Maximize2, 
  LayoutGrid, 
  Sparkles, 
  Check, 
  ArrowRight,
  Shield,
  Layers,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RoomShapeDefinition {
  id: string;
  name: string;
  category: 'rectangle' | 'circle' | 'corridor' | 'special';
  dimensionsLabel: string;
  blocksWidth: number;
  blocksHeight: number;
  description: string;
  relativeOffsets: Array<{ dx: number; dy: number }>;
}

export const ROOM_SHAPES_PRESETS: RoomShapeDefinition[] = [
  // 1. Rectangles & Squares
  {
    id: 'rect_4x4',
    name: 'Sala Pequena',
    category: 'rectangle',
    dimensionsLabel: '4×4 blocos (20×20 pés)',
    blocksWidth: 4,
    blocksHeight: 4,
    description: 'Quarto de guarda, cela de prisão ou depósito secreto.',
    relativeOffsets: [
      { dx: -2, dy: -2 },
      { dx: 2, dy: -2 },
      { dx: 2, dy: 2 },
      { dx: -2, dy: 2 }
    ]
  },
  {
    id: 'rect_6x6',
    name: 'Sala Média',
    category: 'rectangle',
    dimensionsLabel: '6×6 blocos (30×30 pés)',
    blocksWidth: 6,
    blocksHeight: 6,
    description: 'Aposento comunal, biblioteca ou câmara de descanso.',
    relativeOffsets: [
      { dx: -3, dy: -3 },
      { dx: 3, dy: -3 },
      { dx: 3, dy: 3 },
      { dx: -3, dy: 3 }
    ]
  },
  {
    id: 'rect_10x6',
    name: 'Salão Retangular',
    category: 'rectangle',
    dimensionsLabel: '10×6 blocos (50×30 pés)',
    blocksWidth: 10,
    blocksHeight: 6,
    description: 'Refeitório, sala de banquetes ou câmara de audiências.',
    relativeOffsets: [
      { dx: -5, dy: -3 },
      { dx: 5, dy: -3 },
      { dx: 5, dy: 3 },
      { dx: -5, dy: 3 }
    ]
  },
  {
    id: 'rect_14x10',
    name: 'Grande Salão do Trono',
    category: 'rectangle',
    dimensionsLabel: '14×10 blocos (70×50 pés)',
    blocksWidth: 14,
    blocksHeight: 10,
    description: 'Salão do chefão, câmara do tesouro épico ou trono real.',
    relativeOffsets: [
      { dx: -7, dy: -5 },
      { dx: 7, dy: -5 },
      { dx: 7, dy: 5 },
      { dx: -7, dy: 5 }
    ]
  },

  // 2. Circles & Rotundas
  {
    id: 'circle_r3',
    name: 'Câmara Redonda Pequena',
    category: 'circle',
    dimensionsLabel: 'Diâmetro 6 blocos (30 pés)',
    blocksWidth: 6,
    blocksHeight: 6,
    description: 'Poço de rituais, torre de guarda ou câmara de invocação.',
    relativeOffsets: Array.from({ length: 16 }).map((_, i) => {
      const a = (i / 16) * 2 * Math.PI;
      return {
        dx: Number((3 * Math.cos(a)).toFixed(2)),
        dy: Number((3 * Math.sin(a)).toFixed(2))
      };
    })
  },
  {
    id: 'circle_r5',
    name: 'Rotunda / Templo Circular',
    category: 'circle',
    dimensionsLabel: 'Diâmetro 10 blocos (50 pés)',
    blocksWidth: 10,
    blocksHeight: 10,
    description: 'Templo sagrado com altar central ou observatório arcano.',
    relativeOffsets: Array.from({ length: 20 }).map((_, i) => {
      const a = (i / 20) * 2 * Math.PI;
      return {
        dx: Number((5 * Math.cos(a)).toFixed(2)),
        dy: Number((5 * Math.sin(a)).toFixed(2))
      };
    })
  },
  {
    id: 'circle_r7',
    name: 'Arena / Fosso Circular',
    category: 'circle',
    dimensionsLabel: 'Diâmetro 14 blocos (70 pés)',
    blocksWidth: 14,
    blocksHeight: 14,
    description: 'Arena de gladiadores, câmara de dragão ou fosso elemental.',
    relativeOffsets: Array.from({ length: 24 }).map((_, i) => {
      const a = (i / 24) * 2 * Math.PI;
      return {
        dx: Number((7 * Math.cos(a)).toFixed(2)),
        dy: Number((7 * Math.sin(a)).toFixed(2))
      };
    })
  },

  // 3. Corridors & Hallways
  {
    id: 'corr_h10x2',
    name: 'Corredor Reto Horizontal',
    category: 'corridor',
    dimensionsLabel: '10×2 blocos (50×10 pés)',
    blocksWidth: 10,
    blocksHeight: 2,
    description: 'Passagem principal conectando salas laterais.',
    relativeOffsets: [
      { dx: -5, dy: -1 },
      { dx: 5, dy: -1 },
      { dx: 5, dy: 1 },
      { dx: -5, dy: 1 }
    ]
  },
  {
    id: 'corr_v2x10',
    name: 'Corredor Reto Vertical',
    category: 'corridor',
    dimensionsLabel: '2×10 blocos (10×50 pés)',
    blocksWidth: 2,
    blocksHeight: 10,
    description: 'Galeria vertical para exploração e emboscadas.',
    relativeOffsets: [
      { dx: -1, dy: -5 },
      { dx: 1, dy: -5 },
      { dx: 1, dy: 5 },
      { dx: -1, dy: 5 }
    ]
  },
  {
    id: 'corr_narrow8x1',
    name: 'Passagem Estreita',
    category: 'corridor',
    dimensionsLabel: '8×1 bloco (40×5 pés)',
    blocksWidth: 8,
    blocksHeight: 1,
    description: 'Túnel estreito em fila única, ideal para armadilhas.',
    relativeOffsets: [
      { dx: -4, dy: -0.5 },
      { dx: 4, dy: -0.5 },
      { dx: 4, dy: 0.5 },
      { dx: -4, dy: 0.5 }
    ]
  },
  {
    id: 'corr_l8x8',
    name: 'Corredor em L (Esquina)',
    category: 'corridor',
    dimensionsLabel: '8×8 blocos (Largura 2)',
    blocksWidth: 8,
    blocksHeight: 8,
    description: 'Curva em ângulo reto protegendo contra visão direta.',
    relativeOffsets: [
      { dx: -4, dy: -4 },
      { dx: -2, dy: -4 },
      { dx: -2, dy: 2 },
      { dx: 4, dy: 2 },
      { dx: 4, dy: 4 },
      { dx: -4, dy: 4 }
    ]
  },
  {
    id: 'corr_cross8x8',
    name: 'Encruzilhada em Cruz (+)',
    category: 'corridor',
    dimensionsLabel: '8×8 blocos (4 Vias)',
    blocksWidth: 8,
    blocksHeight: 8,
    description: 'Interseção de 4 caminhos com múltiplos rumos para a party.',
    relativeOffsets: [
      { dx: -1, dy: -4 },
      { dx: 1, dy: -4 },
      { dx: 1, dy: -1 },
      { dx: 4, dy: -1 },
      { dx: 4, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: 4 },
      { dx: -1, dy: 4 },
      { dx: -1, dy: 1 },
      { dx: -4, dy: 1 },
      { dx: -4, dy: -1 },
      { dx: -1, dy: -1 }
    ]
  },
  {
    id: 'corr_t8x6',
    name: 'Bifurcação em T',
    category: 'corridor',
    dimensionsLabel: '8×6 blocos (3 Vias)',
    blocksWidth: 8,
    blocksHeight: 6,
    description: 'Junção em T para dividir o grupo ou proteger uma câmara.',
    relativeOffsets: [
      { dx: -4, dy: -3 },
      { dx: 4, dy: -3 },
      { dx: 4, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 3 },
      { dx: -1, dy: 3 },
      { dx: -1, dy: -1 },
      { dx: -4, dy: -1 }
    ]
  },

  // 4. Special & Themed Rooms
  {
    id: 'spec_oct8x8',
    name: 'Cripta Octogonal',
    category: 'special',
    dimensionsLabel: '8×8 blocos (Chanfrada)',
    blocksWidth: 8,
    blocksHeight: 8,
    description: 'Tumba sagrada com sarcófago no centro e nichos nos cantos.',
    relativeOffsets: [
      { dx: -1.5, dy: -4 },
      { dx: 1.5, dy: -4 },
      { dx: 4, dy: -1.5 },
      { dx: 4, dy: 1.5 },
      { dx: 1.5, dy: 4 },
      { dx: -1.5, dy: 4 },
      { dx: -4, dy: 1.5 },
      { dx: -4, dy: -1.5 }
    ]
  },
  {
    id: 'spec_sanctuary10x10',
    name: 'Santuário Cruciforme',
    category: 'special',
    dimensionsLabel: '10×10 blocos',
    blocksWidth: 10,
    blocksHeight: 10,
    description: 'Câmara em cruz com nave central e duas alas laterais.',
    relativeOffsets: [
      { dx: -2, dy: -5 },
      { dx: 2, dy: -5 },
      { dx: 2, dy: -2 },
      { dx: 5, dy: -2 },
      { dx: 5, dy: 2 },
      { dx: 2, dy: 2 },
      { dx: 2, dy: 5 },
      { dx: -2, dy: 5 },
      { dx: -2, dy: 2 },
      { dx: -5, dy: 2 },
      { dx: -5, dy: -2 },
      { dx: -2, dy: -2 }
    ]
  }
];

export const ROOM_PALETTE_COLORS = [
  { name: 'Pedra de Masmorra', hex: '#64748b', bg: 'bg-slate-500' },
  { name: 'Ciano Arcano', hex: '#38bdf8', bg: 'bg-sky-400' },
  { name: 'Ouro Imperial', hex: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Carmesim Carmim', hex: '#ef4444', bg: 'bg-rose-500' },
  { name: 'Esmeralda Antiga', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Púrpura Profunda', hex: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Gelo Glacial', hex: '#ffffff', bg: 'bg-white' },
];

interface RoomShapeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShape: (shape: RoomShapeDefinition, color: string) => void;
  onStampCenter: (shape: RoomShapeDefinition, color: string) => void;
}

export default function RoomShapeLibraryModal({
  isOpen,
  onClose,
  onSelectShape,
  onStampCenter
}: RoomShapeLibraryModalProps) {
  const [activeCategory, setActiveCategory] = React.useState<'all' | 'rectangle' | 'circle' | 'corridor' | 'special'>('all');
  const [selectedColor, setSelectedColor] = React.useState<string>('#64748b');
  const [selectedShapeId, setSelectedShapeId] = React.useState<string>('rect_6x6');

  if (!isOpen) return null;

  const filteredShapes = ROOM_SHAPES_PRESETS.filter(
    s => activeCategory === 'all' || s.category === activeCategory
  );

  const currentShape = ROOM_SHAPES_PRESETS.find(s => s.id === selectedShapeId) || ROOM_SHAPES_PRESETS[0];

  // Helper to render mini SVG thumbnail for each shape
  const renderShapeThumbnail = (shape: RoomShapeDefinition, size = 70, strokeColor = '#38bdf8') => {
    const maxExtent = Math.max(shape.blocksWidth, shape.blocksHeight) / 2 + 1;
    const scale = (size * 0.4) / maxExtent;
    const center = size / 2;

    const pointsStr = shape.relativeOffsets
      .map(p => `${center + p.dx * scale},${center + p.dy * scale}`)
      .join(' ');

    return (
      <svg width={size} height={size} className="overflow-visible">
        {/* Subtle grid backdrop */}
        <line x1={center - size * 0.38} y1={center} x2={center + size * 0.38} y2={center} stroke="rgba(255,255,255,0.1)" strokeDasharray="2,2" />
        <line x1={center} y1={center - size * 0.38} x2={center} y2={center + size * 0.38} stroke="rgba(255,255,255,0.1)" strokeDasharray="2,2" />
        
        <polygon
          points={pointsStr}
          fill={`${strokeColor}35`}
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl max-h-[92vh] bg-obsidian border border-arcane/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-parchment"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/10">
              <LayoutGrid size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold tracking-wide text-glow-arcane">
                  Biblioteca de Formas de Salas
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-arcane/15 border border-arcane/30 text-arcane font-semibold">
                  Masmorra
                </span>
              </div>
              <p className="text-xs text-parchment/60 mt-0.5">
                Construa masmorras rapidamente carimbando salas retangulares, câmaras circulares e corredores táticos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-parchment/50 hover:text-parchment hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Category Tabs & Color Selector */}
        <div className="px-5 py-3 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            {[
              { id: 'all', label: 'Todas as Salas' },
              { id: 'rectangle', label: 'Retângulos / Quadrados' },
              { id: 'circle', label: 'Câmaras Circulares' },
              { id: 'corridor', label: 'Corredores' },
              { id: 'special', label: 'Especiais / Criptas' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-medium transition-all text-xs cursor-pointer",
                  activeCategory === tab.id
                    ? "bg-amber-500 text-obsidian font-bold shadow-md"
                    : "text-parchment/70 hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-parchment/50 uppercase">Cor da Parede:</span>
            <div className="flex items-center gap-1.5">
              {ROOM_PALETTE_COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  className={cn(
                    "w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center",
                    selectedColor === c.hex ? "scale-125 border-white ring-2 ring-amber-400" : "border-white/20 hover:scale-110 opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {selectedColor === c.hex && <Check size={11} className="text-black stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content: Shape Cards Grid + Active Shape Preview Pane */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Shapes Grid */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredShapes.map(shape => {
              const isSelected = selectedShapeId === shape.id;
              return (
                <div
                  key={shape.id}
                  onClick={() => setSelectedShapeId(shape.id)}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 group",
                    isSelected
                      ? "bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-500/10"
                      : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
                  )}
                >
                  <div className="w-16 h-16 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0">
                    {renderShapeThumbnail(shape, 56, isSelected ? selectedColor : '#94a3b8')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={cn(
                        "font-serif font-bold text-sm truncate",
                        isSelected ? "text-amber-300" : "text-parchment group-hover:text-amber-200"
                      )}>
                        {shape.name}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-arcane block mt-0.5">
                      {shape.dimensionsLabel}
                    </span>
                    <p className="text-[11px] text-parchment/60 line-clamp-1 mt-1">
                      {shape.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Shape Detail & Action Pane */}
          <div className="md:col-span-4 flex flex-col justify-between bg-black/50 border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                Detalhes da Sala Selecionada
              </span>

              <div className="h-44 rounded-xl bg-black/80 border border-white/15 flex items-center justify-center p-3">
                {renderShapeThumbnail(currentShape, 140, selectedColor)}
              </div>

              <div>
                <h4 className="font-serif font-bold text-lg text-parchment">
                  {currentShape.name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-arcane/20 border border-arcane/40 text-arcane text-[11px] font-mono font-semibold">
                    {currentShape.dimensionsLabel}
                  </span>
                  <span className="text-[10px] font-mono text-parchment/50">
                    {currentShape.blocksWidth} × {currentShape.blocksHeight} células
                  </span>
                </div>
                <p className="text-xs text-parchment/70 mt-2 leading-relaxed">
                  {currentShape.description}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] space-y-1.5 text-parchment/80">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <Sparkles size={13} />
                  <span>Como posicionar no mapa:</span>
                </div>
                <p className="text-[10px] text-parchment/60 leading-normal">
                  Escolha <strong>"Carimbar no Cursor"</strong> para arrastar a sombra da sala e clicar no local exato do mapa com alinhamento na grade, ou <strong>"Carimbar no Centro"</strong> para inserir imediatamente.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={() => {
                  onSelectShape(currentShape, selectedColor);
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer font-mono"
              >
                <LayoutGrid size={15} />
                <span>Carimbar no Cursor (Arrastar & Posicionar)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onStampCenter(currentShape, selectedColor);
                  onClose();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Carimbar no Centro do Mapa</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
