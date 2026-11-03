import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  RotateCcw, 
  X, 
  Flame, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Skull,
  Dices
} from 'lucide-react';
import { DieType, RollResult } from './DiceRoller';
import { cn } from '../lib/utils';

export interface DiceAnimationOverlayProps {
  isOpen: boolean;
  isSpinning: boolean;
  dieType: DieType;
  quantity: number;
  modifier: number;
  formula: string;
  result: RollResult | null;
  onReroll: () => void;
  onClose: () => void;
}

// Faceted 3D-styled SVG geometry for each die type
function RenderDieFace({ 
  dieType, 
  displayValue, 
  isSpinning, 
  outcome 
}: { 
  dieType: DieType; 
  displayValue: number | string; 
  isSpinning: boolean; 
  outcome?: 'critical' | 'fumble' | 'success' | 'failure';
}) {
  const getThemeColors = () => {
    if (isSpinning) {
      return {
        fill: 'url(#arcaneSpinGrad)',
        stroke: '#38bdf8',
        text: 'text-cyan-200',
        glow: 'rgba(56, 189, 248, 0.5)'
      };
    }
    switch (outcome) {
      case 'critical':
        return {
          fill: 'url(#criticalGrad)',
          stroke: '#eab308',
          text: 'text-amber-200',
          glow: 'rgba(234, 179, 8, 0.7)'
        };
      case 'fumble':
        return {
          fill: 'url(#fumbleGrad)',
          stroke: '#ef4444',
          text: 'text-rose-200',
          glow: 'rgba(239, 68, 68, 0.7)'
        };
      case 'success':
        return {
          fill: 'url(#successGrad)',
          stroke: '#10b981',
          text: 'text-emerald-200',
          glow: 'rgba(16, 185, 129, 0.6)'
        };
      default:
        return {
          fill: 'url(#defaultGrad)',
          stroke: '#94a3b8',
          text: 'text-slate-100',
          glow: 'rgba(148, 163, 184, 0.4)'
        };
    }
  };

  const theme = getThemeColors();

  return (
    <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center">
      {/* Dynamic SVG Gradients */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <linearGradient id="arcaneSpinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="criticalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ca8a04" />
            <stop offset="40%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="fumbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b91c1c" />
            <stop offset="50%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#022c22" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="defaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
      </svg>

      {/* Die Shape Geometry SVG */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
        style={{ filter: `drop-shadow(0 0 16px ${theme.glow})` }}
      >
        {dieType === 4 && (
          // D4: Tetrahedron
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <polygon points="50,10 12,85 88,85" />
            <line x1="50" y1="10" x2="50" y2="85" strokeWidth="1.8" opacity="0.7" />
            <line x1="12" y1="85" x2="50" y2="55" strokeWidth="1.8" opacity="0.7" />
            <line x1="88" y1="85" x2="50" y2="55" strokeWidth="1.8" opacity="0.7" />
          </g>
        )}

        {dieType === 6 && (
          // D6: Cube with rounded bevels
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <rect x="15" y="15" width="70" height="70" rx="14" />
            <path d="M 15 30 L 85 30 M 15 70 L 85 70 M 30 15 L 30 85 M 70 15 L 70 85" opacity="0.15" strokeWidth="1" />
          </g>
        )}

        {dieType === 8 && (
          // D8: Octahedron
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <polygon points="50,8 90,50 50,92 10,50" />
            <line x1="10" y1="50" x2="90" y2="50" strokeWidth="1.8" opacity="0.6" />
            <line x1="50" y1="8" x2="50" y2="92" strokeWidth="1.8" opacity="0.6" />
            <polygon points="50,26 72,50 50,74 28,50" opacity="0.4" strokeWidth="1.2" />
          </g>
        )}

        {dieType === 10 && (
          // D10: Pentagonal Trapezohedron / Kite
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <polygon points="50,6 92,38 50,94 8,38" />
            <line x1="50" y1="6" x2="50" y2="94" strokeWidth="1.8" opacity="0.6" />
            <line x1="8" y1="38" x2="50" y2="54" strokeWidth="1.8" opacity="0.6" />
            <line x1="92" y1="38" x2="50" y2="54" strokeWidth="1.8" opacity="0.6" />
          </g>
        )}

        {dieType === 12 && (
          // D12: Dodecahedron
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <polygon points="50,8 90,36 76,88 24,88 10,36" />
            <polygon points="50,28 72,46 64,74 36,74 28,46" opacity="0.5" strokeWidth="1.5" />
            <line x1="50" y1="8" x2="50" y2="28" strokeWidth="1.5" opacity="0.6" />
            <line x1="90" y1="36" x2="72" y2="46" strokeWidth="1.5" opacity="0.6" />
            <line x1="76" y1="88" x2="64" y2="74" strokeWidth="1.5" opacity="0.6" />
            <line x1="24" y1="88" x2="36" y2="74" strokeWidth="1.5" opacity="0.6" />
            <line x1="10" y1="36" x2="28" y2="46" strokeWidth="1.5" opacity="0.6" />
          </g>
        )}

        {dieType === 20 && (
          // D20: Faceted Icosahedron
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <polygon points="50,6 90,26 90,74 50,94 10,74 10,26" />
            <polygon points="50,22 78,64 22,64" strokeWidth="1.8" opacity="0.65" />
            <line x1="50" y1="6" x2="50" y2="22" strokeWidth="1.5" opacity="0.6" />
            <line x1="90" y1="26" x2="78" y2="64" strokeWidth="1.5" opacity="0.6" />
            <line x1="90" y1="74" x2="78" y2="64" strokeWidth="1.5" opacity="0.6" />
            <line x1="50" y1="94" x2="50" y2="64" strokeWidth="1.5" opacity="0.6" />
            <line x1="10" y1="74" x2="22" y2="64" strokeWidth="1.5" opacity="0.6" />
            <line x1="10" y1="26" x2="22" y2="64" strokeWidth="1.5" opacity="0.6" />
          </g>
        )}

        {dieType === 100 && (
          // D100: Percentile Jewel
          <g stroke={theme.stroke} strokeWidth="2.5" strokeLinejoin="round" fill={theme.fill}>
            <polygon points="50,6 92,38 50,94 8,38" />
            <circle cx="50" cy="50" r="28" opacity="0.3" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* Display Value in center of die face */}
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-center font-serif font-black tracking-tighter select-none pointer-events-none",
          dieType === 4 ? "pt-5" : "",
          isSpinning ? "opacity-90 blur-[0.3px]" : "opacity-100",
          typeof displayValue === 'number' && displayValue > 99 ? "text-3xl" : "text-4xl sm:text-5xl",
          theme.text
        )}
        style={{
          textShadow: isSpinning 
            ? '0 0 12px rgba(56, 189, 248, 0.8)' 
            : outcome === 'critical'
            ? '0 0 20px rgba(234, 179, 8, 0.9), 0 0 35px rgba(234, 179, 8, 0.5)'
            : outcome === 'fumble'
            ? '0 0 20px rgba(239, 68, 68, 0.9), 0 0 35px rgba(239, 68, 68, 0.5)'
            : outcome === 'success'
            ? '0 0 16px rgba(16, 185, 129, 0.8)'
            : '0 0 12px rgba(255, 255, 255, 0.4)'
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}

export default function DiceAnimationOverlay({
  isOpen,
  isSpinning,
  dieType,
  quantity,
  modifier,
  formula,
  result,
  onReroll,
  onClose
}: DiceAnimationOverlayProps) {
  // Flickering random number during spin
  const [flickerVal, setFlickerVal] = React.useState<number>(() => Math.floor(Math.random() * dieType) + 1);

  React.useEffect(() => {
    if (!isSpinning) return;
    const interval = setInterval(() => {
      setFlickerVal(Math.floor(Math.random() * dieType) + 1);
    }, 45);
    return () => clearInterval(interval);
  }, [isSpinning, dieType]);

  if (!isOpen) return null;

  const outcome = result?.outcome;
  const primaryDisplayValue = isSpinning 
    ? flickerVal 
    : (result ? (result.rolls.length === 1 ? result.rolls[0] : result.total) : flickerVal);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 z-50 rounded-[2.2rem] bg-obsidian/95 backdrop-blur-2xl flex flex-col items-center justify-between p-5 overflow-hidden select-none border border-arcane/40 shadow-2xl"
      >
        {/* Background Radial Glow & Atmosphere */}
        <div 
          className={cn(
            "absolute inset-0 pointer-events-none transition-all duration-700",
            isSpinning && "bg-radial from-arcane/25 via-cyan-900/10 to-transparent",
            !isSpinning && outcome === 'critical' && "bg-radial from-gold/30 via-amber-950/20 to-transparent",
            !isSpinning && outcome === 'fumble' && "bg-radial from-red-600/30 via-rose-950/20 to-transparent",
            !isSpinning && outcome === 'success' && "bg-radial from-emerald-500/25 via-teal-950/20 to-transparent",
            !isSpinning && outcome === 'failure' && "bg-radial from-amber-500/15 via-black/30 to-transparent"
          )} 
        />

        {/* Arcane Rune Ring behind spinning die */}
        <motion.div
          animate={{ rotate: isSpinning ? 360 : 45 }}
          transition={isSpinning ? { repeat: Infinity, duration: 6, ease: "linear" } : { duration: 1.5, ease: "easeOut" }}
          className={cn(
            "absolute w-64 h-64 rounded-full border border-dashed pointer-events-none opacity-20 top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2",
            isSpinning ? "border-cyan-400" : outcome === 'critical' ? "border-gold" : outcome === 'fumble' ? "border-red-500" : "border-parchment"
          )}
        />
        <motion.div
          animate={{ rotate: isSpinning ? -360 : -45 }}
          transition={isSpinning ? { repeat: Infinity, duration: 9, ease: "linear" } : { duration: 1.5, ease: "easeOut" }}
          className={cn(
            "absolute w-80 h-80 rounded-full border border-dotted pointer-events-none opacity-15 top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2",
            isSpinning ? "border-cyan-400" : outcome === 'critical' ? "border-gold" : outcome === 'fumble' ? "border-red-500" : "border-parchment"
          )}
        />

        {/* Top Header info & Close/Skip Button */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-arcane/20 border border-arcane/40 flex items-center justify-center text-arcane">
              <Dices size={15} className={isSpinning ? "animate-spin" : ""} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-parchment/60">
                {isSpinning ? "Rolando Dados..." : "Resultado da Rolagem"}
              </p>
              <p className="text-xs font-serif font-bold text-parchment truncate max-w-[200px]">
                {formula || `${quantity}d${dieType}${modifier ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ''}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/50 hover:text-parchment transition-colors cursor-pointer"
            title="Fechar Visualização (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Center: Spinning / Impact Landing Die with 3D Tumbling Effect */}
        <div className="relative my-auto flex flex-col items-center justify-center z-10">
          {/* Shockwave Burst upon landing */}
          <AnimatePresence>
            {!isSpinning && result && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className={cn(
                  "absolute w-44 h-44 rounded-full border-2 pointer-events-none",
                  outcome === 'critical' && "border-gold shadow-[0_0_40px_rgba(234,179,8,0.8)]",
                  outcome === 'fumble' && "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.8)]",
                  outcome === 'success' && "border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.7)]",
                  outcome === 'failure' && "border-slate-400"
                )}
              />
            )}
          </AnimatePresence>

          {/* 3D Tumbling / Settling Die */}
          <div style={{ perspective: 1000 }} className="relative flex items-center justify-center">
            <motion.div
              animate={
                isSpinning
                  ? {
                      rotateX: [0, 360, 720, 1080],
                      rotateY: [0, -540, -1080],
                      rotateZ: [0, 180, 360],
                      scale: [0.85, 1.12, 0.92, 1.1, 0.95],
                      y: [0, -14, 4, -10, 0]
                    }
                  : {
                      rotateX: 0,
                      rotateY: 0,
                      rotateZ: 0,
                      scale: [1.38, 0.94, 1.06, 1],
                      y: 0
                    }
              }
              transition={
                isSpinning
                  ? {
                      repeat: Infinity,
                      duration: 0.75,
                      ease: "linear"
                    }
                  : {
                      duration: 0.55,
                      ease: [0.34, 1.56, 0.64, 1]
                    }
              }
              className="cursor-pointer"
              onClick={isSpinning ? onClose : undefined}
            >
              <RenderDieFace
                dieType={dieType}
                displayValue={primaryDisplayValue}
                isSpinning={isSpinning}
                outcome={outcome}
              />
            </motion.div>
          </div>

          {/* Multiple Dice Breakdown Pills (e.g. 2d6 or 3d20) */}
          {!isSpinning && result && result.rolls.length > 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center justify-center gap-1.5 mt-3 flex-wrap max-w-xs"
            >
              {result.rolls.map((r, i) => (
                <span
                  key={i}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-xs font-mono font-bold border",
                    r === dieType ? "bg-gold/20 text-gold border-gold/40" :
                    r === 1 ? "bg-red-500/20 text-red-300 border-red-500/40" :
                    "bg-white/5 text-parchment/80 border-white/10"
                  )}
                >
                  {r}
                </span>
              ))}
              {result.discardedRolls && result.discardedRolls.length > 0 && (
                <span className="text-[10px] font-mono text-parchment/40 line-through">
                  ({result.discardedRolls.join(', ')})
                </span>
              )}
              {result.modifier !== 0 && (
                <span className="text-xs font-mono text-parchment/60">
                  {result.modifier > 0 ? `+${result.modifier}` : result.modifier}
                </span>
              )}
            </motion.div>
          )}

          {/* Outcome Hero Banner */}
          {!isSpinning && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 25 }}
              className="mt-3 flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  "px-4 py-1.5 rounded-2xl border text-xs font-serif font-black uppercase tracking-wider flex items-center gap-2 shadow-xl",
                  outcome === 'critical' && "bg-gradient-to-r from-amber-500/30 via-gold/40 to-amber-500/30 text-gold border-gold shadow-gold/30 animate-pulse",
                  outcome === 'fumble' && "bg-gradient-to-r from-red-600/30 via-rose-900/40 to-red-600/30 text-rose-300 border-red-500 shadow-red-500/30 animate-pulse",
                  outcome === 'success' && "bg-gradient-to-r from-emerald-500/20 via-teal-900/30 to-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-emerald-500/20",
                  outcome === 'failure' && "bg-white/10 text-amber-200 border-white/20"
                )}
              >
                {outcome === 'critical' && <Sparkles size={14} className="text-gold" />}
                {outcome === 'fumble' && <Skull size={14} className="text-red-400" />}
                {outcome === 'success' && <CheckCircle2 size={14} className="text-emerald-400" />}
                {outcome === 'failure' && <AlertCircle size={14} className="text-amber-400" />}
                <span>{result.outcomeLabel}</span>
              </div>

              {/* Total & formula detail */}
              <p className="text-xs font-mono text-parchment/70 mt-1">
                Total: <strong className="text-parchment font-serif text-sm">{result.total}</strong>
                {result.modifier !== 0 && ` (${result.rolls.reduce((a, b) => a + b, 0)} ${result.modifier > 0 ? '+' : '-'} ${Math.abs(result.modifier)})`}
                {result.targetDC && ` vs Meta ${result.isRollUnder ? '≤' : '≥'}${result.targetDC}`}
              </p>
            </motion.div>
          )}

          {/* Spinning Status Label */}
          {isSpinning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center gap-2 text-xs font-mono text-cyan-300/80"
            >
              <Sparkles size={13} className="text-cyan-400 animate-spin" />
              <span>Sorteando destino...</span>
            </motion.div>
          )}
        </div>

        {/* Footer Actions: Reroll & Dismiss */}
        <div className="w-full flex items-center justify-between gap-3 pt-3 border-t border-white/10 z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-parchment/60 hover:text-parchment text-xs font-mono transition-colors text-center cursor-pointer"
          >
            {isSpinning ? "Pular Animação" : "Concluir (ESC)"}
          </button>

          <button
            type="button"
            onClick={onReroll}
            disabled={isSpinning}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl font-serif font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg border cursor-pointer",
              "bg-gradient-to-r from-arcane via-cyan-500 to-blue-600 text-obsidian border-cyan-300/50 hover:shadow-cyan-500/30",
              isSpinning && "opacity-60 cursor-not-allowed"
            )}
          >
            <RotateCcw size={13} />
            <span>Rolar Novamente</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
