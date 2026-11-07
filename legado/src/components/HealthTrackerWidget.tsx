import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Shield, 
  Sparkles, 
  Skull, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RotateCcw,
  Activity,
  Flame,
  Check,
  Lock,
  Unlock,
  Coffee,
  Tent
} from 'lucide-react';
import { cn } from '../lib/utils';

interface HealthTrackerWidgetProps {
  currentPV: number;
  maxPV: number;
  tempPV?: number;
  onUpdatePV: (value: number) => void;
  onUpdateTempPV?: (value: number) => void;
  disabled?: boolean;
}

export default function HealthTrackerWidget({
  currentPV,
  maxPV,
  tempPV = 0,
  onUpdatePV,
  onUpdateTempPV,
  disabled = false
}: HealthTrackerWidgetProps) {
  const [customAmount, setCustomAmount] = React.useState<number | ''>('');
  const [lastActionText, setLastActionText] = React.useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = React.useState<boolean>(true);

  // If disabled prop was explicitly passed as true, user can still override with one click
  const effectiveDisabled = disabled && !isUnlocked;

  // Health percentage
  const safeMax = Math.max(1, maxPV);
  const hpPercent = Math.max(0, Math.min(100, Math.round((currentPV / safeMax) * 100)));

  // Low health states
  const isDeadOrDying = currentPV <= 0;
  const isCritical = currentPV > 0 && hpPercent <= 25;
  const isWounded = currentPV > 0 && hpPercent > 25 && hpPercent <= 50;
  const isHealthy = hpPercent > 50;

  // Flash action message
  const showFeedback = (text: string) => {
    setLastActionText(text);
    setTimeout(() => setLastActionText(null), 2500);
  };

  // Automated Damage Handler (absorbs from tempPV first!)
  const applyDamage = (amount: number) => {
    if (amount <= 0) return;
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }
    if (currentPV <= 0 && tempPV <= 0) {
      showFeedback('💀 Personagem já está com 0 PV (inconsciente)!');
      return;
    }

    let remainingDmg = amount;
    let newTemp = tempPV;
    let newPV = currentPV;

    if (newTemp > 0) {
      if (newTemp >= remainingDmg) {
        newTemp -= remainingDmg;
        remainingDmg = 0;
        showFeedback(`🛡️ Absorveu ${amount} de dano no PV Temporário!`);
      } else {
        remainingDmg -= newTemp;
        showFeedback(`🛡️ PV Temp absorveu ${newTemp} de dano! ${remainingDmg} atingiu o PV!`);
        newTemp = 0;
      }
      if (onUpdateTempPV) onUpdateTempPV(newTemp);
    } else {
      showFeedback(`💥 Tomou ${amount} de dano!`);
    }

    if (remainingDmg > 0) {
      newPV = Math.max(0, currentPV - remainingDmg);
      onUpdatePV(newPV);
    }

    setCustomAmount('');
  };

  // Automated Heal Handler (caps at maxPV)
  const applyHeal = (amount: number) => {
    if (amount <= 0) return;
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }
    if (currentPV >= maxPV) {
      showFeedback(`✨ Vida já está no máximo (${maxPV} PV)!`);
      return;
    }

    const newPV = Math.min(maxPV, currentPV + amount);
    const healed = newPV - currentPV;
    onUpdatePV(newPV);
    showFeedback(`✨ Curou +${healed} PV!`);
    setCustomAmount('');
  };

  // Add Temp PV Handler
  const applyTempPV = (amount: number) => {
    if (!onUpdateTempPV) return;
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }

    const newTemp = Math.max(0, tempPV + amount);
    onUpdateTempPV(newTemp);
    showFeedback(`🛡️ +${amount} PV Temporário concedido!`);
    setCustomAmount('');
  };

  // Clear Temp PV
  const clearTempPV = () => {
    if (!onUpdateTempPV) return;
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }
    onUpdateTempPV(0);
    showFeedback('PV Temporário removido.');
  };

  // Full Heal
  const fullHeal = () => {
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }
    onUpdatePV(maxPV);
    showFeedback(`🌟 Recuperação total: ${maxPV} PV restaurados!`);
  };

  // Short Rest (+25% maxPV)
  const shortRest = () => {
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }
    const healAmt = Math.max(1, Math.round(maxPV * 0.25));
    applyHeal(healAmt);
    showFeedback(`☕ Descanso Curto: +${healAmt} PV recuperados!`);
  };

  // Long Rest (Full heal)
  const longRest = () => {
    if (effectiveDisabled) {
      setIsUnlocked(true);
    }
    onUpdatePV(maxPV);
    if (tempPV > 0 && onUpdateTempPV) {
      onUpdateTempPV(0);
    }
    showFeedback(`⛺ Descanso Longo: ${maxPV} PV restaurados e descanso concluído!`);
  };

  return (
    <div className={cn(
      "glass p-6 rounded-[2.5rem] space-y-5 transition-all duration-300 relative overflow-hidden border",
      isDeadOrDying && "border-red-600/80 bg-red-950/20 shadow-[0_0_35px_rgba(220,38,38,0.35)]",
      isCritical && "border-rose-500/70 bg-rose-950/15 shadow-[0_0_30px_rgba(244,63,94,0.3)]",
      isWounded && "border-amber-500/40 bg-amber-950/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      isHealthy && "border-white/10 hover:border-white/20"
    )}>
      {/* Ambient Pulsing Background Glow for Low Health */}
      {(isDeadOrDying || isCritical) && (
        <div className="absolute -inset-4 bg-gradient-to-r from-red-600/10 via-rose-600/15 to-transparent blur-2xl pointer-events-none animate-pulse" />
      )}

      {/* Header with Title, Status Toggle and Current/Max Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center transition-all border shadow-lg shrink-0",
            isDeadOrDying && "bg-red-600/30 border-red-500 text-red-400 animate-pulse",
            isCritical && "bg-rose-500/25 border-rose-400 text-rose-300 animate-bounce",
            isWounded && "bg-amber-500/20 border-amber-400/50 text-amber-300",
            isHealthy && "bg-emerald-500/15 border-emerald-400/40 text-emerald-300"
          )}>
            {isDeadOrDying ? (
              <Skull size={22} className="text-red-400" />
            ) : (
              <Heart size={22} className={cn(
                isCritical ? "fill-rose-500 text-rose-500" : "text-ember"
              )} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-xl font-bold tracking-tight">Pontos de Vida</h3>
              <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">(PV)</span>

              {/* Interactive Status & Activation Toggle */}
              <button
                type="button"
                onClick={() => setIsUnlocked(!isUnlocked)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm border cursor-pointer",
                  !effectiveDisabled
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 animate-pulse"
                )}
                title={!effectiveDisabled ? "Rastreador Ativo e Interativo. Clique para Travar." : "Rastreador Inativo. Clique para Ativar!"}
              >
                {!effectiveDisabled ? (
                  <>
                    <Activity size={10} className="text-emerald-400" />
                    <span>Rastreador Ativo</span>
                  </>
                ) : (
                  <>
                    <Lock size={10} className="text-amber-400" />
                    <span>Ativar Rastreador</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Status Indicator Badges */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isDeadOrDying && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-md shadow-red-950 animate-pulse">
                  <Skull size={10} /> Inconsciente / Morrendo
                </span>
              )}
              {isCritical && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-rose-600/30 text-rose-300 border border-rose-500/50 flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={10} /> Vida Crítica ({hpPercent}%)
                </span>
              )}
              {isWounded && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Ferido ({hpPercent}%)
                </span>
              )}
              {isHealthy && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {hpPercent === 100 ? 'Vitalidade Máxima (100%)' : `Estável (${hpPercent}%)`}
                </span>
              )}

              {tempPV > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shadow-sm">
                  <Shield size={10} /> +{tempPV} PV Temp
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Big Numbers Display */}
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              "text-3xl sm:text-4xl font-serif font-black tracking-tight",
              isDeadOrDying && "text-red-500 text-glow-ember animate-pulse",
              isCritical && "text-rose-400 text-glow-ember",
              isWounded && "text-amber-300",
              isHealthy && "text-parchment"
            )}>
              {currentPV}
            </span>
            <span className="text-sm font-mono text-parchment/40">/ {maxPV}</span>
            {tempPV > 0 && (
              <span className="text-base font-serif font-bold text-cyan-400 drop-shadow ml-1">
                (+{tempPV})
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
            {hpPercent}% de Vida
          </span>
        </div>
      </div>

      {/* Visual Feedback Banner on Critical Health */}
      <AnimatePresence>
        {(isDeadOrDying || isCritical) && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -5 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -5 }}
            className={cn(
              "p-3 rounded-2xl flex items-center gap-3 border text-xs shadow-lg relative overflow-hidden",
              isDeadOrDying 
                ? "bg-red-900/40 border-red-500 text-red-200"
                : "bg-rose-900/30 border-rose-500/60 text-rose-200"
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-xl flex items-center justify-center shrink-0",
              isDeadOrDying ? "bg-red-600 text-white" : "bg-rose-600 text-white"
            )}>
              {isDeadOrDying ? <Skull size={15} /> : <AlertTriangle size={15} />}
            </div>
            <div className="flex-1">
              <p className="font-bold">
                {isDeadOrDying 
                  ? "Seu personagem está inconsciente e sangrando!" 
                  : "Atenção: Vitalidade Crítica! Risco de colapso!"}
              </p>
              <p className="text-[10px] opacity-80">
                {isDeadOrDying
                  ? "Realize testes de sobrevivência ou receba socorro urgente de aliados."
                  : "Menos de 25% de vida restante. Ataques seguintes podem ser mortais."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Temporary Feedback Notification */}
      <AnimatePresence>
        {lastActionText && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-mono flex items-center justify-between text-parchment/90 shadow-md backdrop-blur-sm"
          >
            <span>{lastActionText}</span>
            <Check size={14} className="text-emerald-400" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layered Multi-Status Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-5 w-full bg-white/5 rounded-full p-1 border border-white/10 flex items-center relative overflow-hidden shadow-inner">
          {/* Main Health Bar */}
          <motion.div 
            initial={false}
            animate={{ width: `${hpPercent}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "h-full rounded-full transition-all duration-300 relative",
              isDeadOrDying && "bg-red-700/80 shadow-md shadow-red-900",
              isCritical && "bg-gradient-to-r from-red-600 via-rose-600 to-red-500 shadow-md shadow-rose-900/50",
              isWounded && "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 shadow-md shadow-amber-900/40",
              isHealthy && "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 shadow-md shadow-emerald-900/30"
            )}
          >
            {/* Gloss reflection shine */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
          </motion.div>

          {/* Temporary HP Overlay Bar (glowing cyan shield extension) */}
          {tempPV > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ 
                width: `${Math.min(100 - hpPercent, Math.round((tempPV / safeMax) * 100))}%` 
              }}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-md shadow-cyan-500/50 ml-0.5 relative"
            >
              <div className="absolute inset-0 bg-white/25 rounded-full animate-pulse" />
            </motion.div>
          )}
        </div>

        {/* Bar Sub-labels */}
        <div className="flex justify-between items-center text-[10px] font-mono text-parchment/40 px-1">
          <span>0 PV</span>
          {tempPV > 0 ? (
            <span className="text-cyan-400 font-semibold flex items-center gap-1">
              <Shield size={10} /> Absorção Temp: +{tempPV}
            </span>
          ) : (
            <span>Máximo: {maxPV} PV</span>
          )}
          <span>100%</span>
        </div>
      </div>

      {/* Manual Range Slider */}
      <div className="space-y-1">
        <input 
          type="range" 
          min="0" 
          max={maxPV} 
          value={currentPV ?? 0} 
          onChange={(e) => {
            if (effectiveDisabled) setIsUnlocked(true);
            onUpdatePV(parseInt(e.target.value) || 0);
          }}
          className={cn(
            "w-full h-2 rounded-lg appearance-none cursor-pointer transition-colors",
            isDeadOrDying && "bg-red-950 accent-red-600",
            isCritical && "bg-rose-950 accent-rose-500",
            isWounded && "bg-amber-950 accent-amber-500",
            isHealthy && "bg-white/10 accent-emerald-500"
          )}
        />
      </div>

      {/* Quick Action Combat Controls */}
      <div className="pt-2 border-t border-white/5 space-y-3">
        {/* Row 1: Damage & Healing Quick Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Damage Controls */}
          <div className="p-3 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-red-300">
              <span className="flex items-center gap-1">
                <Minus size={14} className="text-red-400" /> Tomar Dano
              </span>
              <span className="text-[9px] font-mono opacity-60">Absorve Temp 1º</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 5, 10].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => applyDamage(amt)}
                  className="py-1.5 px-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-mono font-bold transition-all active:scale-95 cursor-pointer"
                >
                  -{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Heal Controls */}
          <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
              <span className="flex items-center gap-1">
                <Plus size={14} className="text-emerald-400" /> Curar
              </span>
              <button
                type="button"
                onClick={fullHeal}
                className="text-[9px] font-mono text-emerald-400 hover:underline uppercase cursor-pointer font-bold"
              >
                Cura Total
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 5, 10].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => applyHeal(amt)}
                  className="py-1.5 px-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold transition-all active:scale-95 cursor-pointer"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Temporary HP Widget Management */}
        {onUpdateTempPV && (
          <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <Shield size={14} />
              </div>
              <div>
                <p className="text-xs font-semibold text-cyan-300">PV Temporário</p>
                <p className="text-[9px] font-mono text-parchment/50">Escudo que absorve dano antes do PV real</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[5, 10].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => applyTempPV(amt)}
                  className="py-1 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-200 text-xs font-mono font-bold transition-all active:scale-95 cursor-pointer"
                >
                  +{amt} Temp
                </button>
              ))}
              {tempPV > 0 && (
                <button
                  type="button"
                  onClick={clearTempPV}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-parchment/40 hover:text-red-400 transition-colors cursor-pointer"
                  title="Zerar PV Temporário"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Rest Mechanics & Custom Value Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Quick Rest Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={shortRest}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Descanso Curto: Recupera 25% do PV Máximo"
            >
              <Coffee size={13} />
              <span>Descanso Curto</span>
            </button>
            <button
              type="button"
              onClick={longRest}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="Descanso Longo: Recupera todo o PV Máximo"
            >
              <Tent size={13} />
              <span>Descanso Longo</span>
            </button>
          </div>

          {/* Custom Amount Form */}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
            <input
              type="number"
              min="1"
              placeholder="Qtd exata"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 bg-obsidian border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-parchment focus:outline-none focus:border-arcane"
            />
            <button
              type="button"
              onClick={() => customAmount !== '' && applyDamage(Number(customAmount))}
              disabled={customAmount === ''}
              className="flex-1 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              - Dano
            </button>
            <button
              type="button"
              onClick={() => customAmount !== '' && applyHeal(Number(customAmount))}
              disabled={customAmount === ''}
              className="flex-1 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              + Cura
            </button>
            {onUpdateTempPV && (
              <button
                type="button"
                onClick={() => customAmount !== '' && applyTempPV(Number(customAmount))}
                disabled={customAmount === ''}
                className="py-1.5 px-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                + Temp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
