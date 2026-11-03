import React from 'react';
import { 
  PenTool, 
  Eraser, 
  Trash2, 
  X,
  Check,
  Radio,
  Shapes,
  RotateCcw,
  RotateCw,
  LayoutGrid
} from 'lucide-react';
import { DRAWING_COLORS, STROKE_SIZES } from './MapDrawingOverlay';
import { db, collection, query, where, getDocs, deleteDoc, doc } from '../../firebase';
import { cn } from '../../lib/utils';

interface MapDrawingToolbarProps {
  isDrawingMode: boolean;
  onToggleDrawingMode: (active: boolean) => void;
  drawingTool: 'pen' | 'polygon' | 'eraser';
  onChangeTool: (tool: 'pen' | 'polygon' | 'eraser') => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  strokeSize: number;
  onChangeStrokeSize: (size: number) => void;
  mapId: string;
  sessionId?: string;
  collectionName: 'mapDrawings' | 'dungeonDrawings';
  isGM?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  isPingMode?: boolean;
  onTogglePingMode?: (active: boolean) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenRoomShapes?: () => void;
}

export const MapDrawingToolbar: React.FC<MapDrawingToolbarProps> = ({
  isDrawingMode,
  onToggleDrawingMode,
  drawingTool,
  onChangeTool,
  activeColor,
  onChangeColor,
  strokeSize,
  onChangeStrokeSize,
  mapId,
  sessionId,
  collectionName,
  isGM = false,
  currentUserId,
  currentUserName,
  isPingMode = false,
  onTogglePingMode,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenRoomShapes
}) => {
  const [isColorMenuOpen, setIsColorMenuOpen] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  // Clear drawings in current map
  const handleClearDrawings = async (clearAll: boolean) => {
    setIsClearing(true);
    setShowClearConfirm(false);
    try {
      let q = query(collection(db, collectionName), where('mapId', '==', mapId));
      if (sessionId) {
        q = query(
          collection(db, collectionName),
          where('mapId', '==', mapId),
          where('sessionId', '==', sessionId)
        );
      }

      const snap = await getDocs(q);
      const deletePromises = snap.docs
        .filter(d => clearAll || isGM || d.data().authorId === currentUserId)
        .map(d => deleteDoc(doc(db, collectionName, d.id)));

      await Promise.all(deletePromises);
    } catch (err) {
      console.error(`Error clearing ${collectionName}:`, err);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isDrawingMode) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            onToggleDrawingMode(true);
            if (onTogglePingMode) onTogglePingMode(false);
          }}
          className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl glass hover:bg-arcane/20 text-parchment hover:text-arcane border border-white/10 hover:border-arcane/40 shadow-lg flex items-center gap-1.5 text-xs font-mono transition-all cursor-pointer"
          title="Ativar Ferramenta de Desenho no Mapa (Mestre e Jogadores)"
        >
          <PenTool size={14} className="text-arcane" />
          <span className="font-semibold text-[11px] sm:text-xs">Desenhar no Mapa</span>
        </button>

        {onTogglePingMode && (
          <button
            type="button"
            onClick={() => onTogglePingMode(!isPingMode)}
            className={cn(
              "px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-lg",
              isPingMode 
                ? "bg-amber-400 text-obsidian font-bold ring-2 ring-amber-400/50 animate-pulse" 
                : "glass hover:bg-amber-400/20 text-parchment hover:text-amber-300 border border-white/10 hover:border-amber-400/40"
            )}
            title="Sinal de Ping (Clique no mapa para emitir pulso sonoro e visual a todos)"
          >
            <Radio size={14} className={isPingMode ? "animate-spin text-obsidian" : "text-amber-400"} />
            <span className="font-semibold text-[11px] sm:text-xs">
              {isPingMode ? 'Clique no mapa' : 'Sinal de Ping'}
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/90 backdrop-blur-md border border-arcane/40 shadow-2xl z-30">
      {/* Pen Tool */}
      <button
        type="button"
        onClick={() => onChangeTool('pen')}
        className={cn(
          "p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer",
          drawingTool === 'pen'
            ? "bg-arcane text-obsidian font-bold shadow-md shadow-arcane/20"
            : "text-parchment/70 hover:text-parchment hover:bg-white/10"
        )}
        title="Caneta Livre (Fecha e preenche o interior automaticamente ao unir as pontas)"
      >
        <PenTool size={14} />
        <span className="text-[11px] hidden sm:inline">Caneta</span>
      </button>

      {/* Polygon Tool */}
      <button
        type="button"
        onClick={() => onChangeTool('polygon')}
        className={cn(
          "p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer",
          drawingTool === 'polygon'
            ? "bg-emerald-500 text-obsidian font-bold shadow-md shadow-emerald-500/20"
            : "text-parchment/70 hover:text-parchment hover:bg-white/10"
        )}
        title="Polígono (Clique para adicionar vértices e feche na ponta inicial para preencher o interior)"
      >
        <Shapes size={14} />
        <span className="text-[11px] hidden sm:inline">Polígono</span>
      </button>

      {/* Room Shapes Library Tool */}
      {onOpenRoomShapes && (
        <button
          type="button"
          onClick={onOpenRoomShapes}
          className="p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer text-amber-300 hover:text-amber-200 hover:bg-amber-400/20 border border-amber-400/30"
          title="Biblioteca de Formas de Salas Rápidas (Retângulos, Círculos, Corredores)"
        >
          <LayoutGrid size={14} />
          <span className="text-[11px] hidden sm:inline">Salas Rápidas</span>
        </button>
      )}

      {/* Eraser Tool */}
      <button
        type="button"
        onClick={() => onChangeTool('eraser')}
        className={cn(
          "p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer",
          drawingTool === 'eraser'
            ? "bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20"
            : "text-parchment/70 hover:text-parchment hover:bg-white/10"
        )}
        title="Borracha (Clique sobre qualquer traço para apagar)"
      >
        <Eraser size={14} />
        <span className="text-[11px] hidden sm:inline">Borracha</span>
      </button>

      {/* Undo / Redo Buttons */}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-xl text-xs font-mono flex items-center transition-all cursor-pointer text-parchment/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
          title="Desfazer traço ou polígono (Ctrl + Z)"
        >
          <RotateCcw size={14} />
        </button>
      )}

      {onRedo && (
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-xl text-xs font-mono flex items-center transition-all cursor-pointer text-parchment/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
          title="Refazer traço ou polígono (Ctrl + Y / Ctrl + Shift + Z)"
        >
          <RotateCw size={14} />
        </button>
      )}

      <div className="w-px h-5 bg-white/15 mx-0.5" />

      {/* Active Color Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
          className="p-1.5 rounded-xl hover:bg-white/10 flex items-center gap-1 cursor-pointer"
          title="Escolher Cor do Traço"
        >
          <div 
            className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
            style={{ backgroundColor: activeColor }}
          />
        </button>

        {isColorMenuOpen && (
          <div className="absolute top-full left-0 mt-2 p-2 rounded-2xl bg-obsidian/95 border border-white/20 shadow-2xl flex items-center gap-1.5 backdrop-blur-md z-50">
            {DRAWING_COLORS.map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  onChangeColor(c.hex);
                  setIsColorMenuOpen(false);
                }}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer",
                  activeColor === c.hex ? "border-white ring-2 ring-arcane/50 scale-105" : "border-white/20"
                )}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {activeColor === c.hex && (
                  <Check size={11} className={c.hex === '#ffffff' ? 'text-black' : 'text-white'} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stroke Sizes */}
      <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/10">
        {STROKE_SIZES.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChangeStrokeSize(s.value)}
            className={cn(
              "w-6 h-6 rounded-lg text-[10px] font-mono flex items-center justify-center cursor-pointer transition-all",
              strokeSize === s.value ? "bg-white/20 text-white font-bold" : "text-parchment/50 hover:text-parchment"
            )}
            title={`Espessura: ${s.label}`}
          >
            <div 
              className="rounded-full bg-current" 
              style={{ width: `${s.value + 1}px`, height: `${s.value + 1}px` }} 
            />
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-white/15 mx-0.5" />

      {/* Clear All / Clear Mine Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowClearConfirm(!showClearConfirm)}
          disabled={isClearing}
          className="p-2 rounded-xl text-parchment/60 hover:text-ember hover:bg-white/10 text-xs font-mono cursor-pointer transition-all"
          title="Limpar Desenhos do Mapa"
        >
          <Trash2 size={14} />
        </button>

        {showClearConfirm && (
          <div 
            data-no-map-click="true"
            className="absolute top-full right-0 mt-2 p-3 rounded-2xl bg-obsidian/95 border border-ember/30 shadow-2xl w-52 backdrop-blur-md z-50 space-y-2"
          >
            <span className="text-[11px] font-mono text-parchment/80 block leading-tight">
              Deseja limpar os desenhos deste mapa?
            </span>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleClearDrawings(false)}
                className="w-full py-1.5 px-2 rounded-lg bg-white/10 hover:bg-ember/20 text-ember text-[11px] font-mono text-left cursor-pointer transition-colors"
              >
                Limpar meus desenhos
              </button>
              {isGM && (
                <button
                  type="button"
                  onClick={() => handleClearDrawings(true)}
                  className="w-full py-1.5 px-2 rounded-lg bg-ember/20 hover:bg-ember/30 text-rose-300 text-[11px] font-mono font-bold text-left cursor-pointer transition-colors"
                >
                  Limpar TODOS (Mestre)
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-1 px-2 text-[10px] font-mono text-parchment/50 hover:text-parchment text-center cursor-pointer mt-0.5 rounded hover:bg-white/5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Close Drawing Mode */}
      <button
        type="button"
        onClick={() => onToggleDrawingMode(false)}
        className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/50 hover:text-parchment cursor-pointer"
        title="Fechar Ferramentas de Desenho"
      >
        <X size={14} />
      </button>
    </div>
  );
};
