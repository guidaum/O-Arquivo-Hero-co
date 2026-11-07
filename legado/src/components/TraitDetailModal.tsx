import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Star, 
  Sparkles, 
  Activity, 
  Target, 
  Info,
  Shield, 
  Sword, 
  Zap, 
  Eye, 
  Brain, 
  Heart,
  Check
} from 'lucide-react';
import { cn, getTraitTargetDisplayName, getTraitEffectiveModifier, calculateTraitCost, calculateTraitCostDetails } from '../lib/utils';

export interface TraitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trait: any | null;
  attributes?: Array<{ id: string; label?: string }>;
  talents?: Array<{ id: string; name?: string }>;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showSelectButton?: boolean;
}

export const TraitDetailModal: React.FC<TraitDetailModalProps> = ({
  isOpen,
  onClose,
  trait,
  attributes = [],
  talents = [],
  isSelected = false,
  onToggleSelect,
  showSelectButton = false,
}) => {
  if (!trait) return null;

  const isAdvantage = trait.type === 'advantage';
  const effMod = getTraitEffectiveModifier(trait);
  const targetDisplayName = getTraitTargetDisplayName(trait.modifierType, attributes, talents);
  const costDetails = calculateTraitCostDetails(trait);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-obsidian/85 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={cn(
              "relative w-full max-w-lg glass bg-obsidian/95 border rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl z-10 overflow-hidden",
              isAdvantage ? "border-arcane/40 shadow-arcane/10" : "border-ember/40 shadow-ember/10"
            )}
          >
            {/* Top decorative glow */}
            <div 
              className={cn(
                "absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-48 rounded-full blur-3xl pointer-events-none opacity-20",
                isAdvantage ? "bg-arcane" : "bg-ember"
              )} 
            />

            {/* Header */}
            <div className="flex items-start justify-between relative z-10 gap-3">
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "p-3 rounded-2xl border",
                  isAdvantage 
                    ? "bg-arcane/15 text-arcane border-arcane/30 shadow-lg shadow-arcane/10" 
                    : "bg-ember/15 text-ember border-ember/30 shadow-lg shadow-ember/10"
                )}>
                  {isAdvantage ? <Star size={24} /> : <Sparkles size={24} />}
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-serif text-parchment leading-tight">
                    {trait.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn(
                      "text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1",
                      isAdvantage 
                        ? "bg-arcane/20 text-arcane border-arcane/30" 
                        : "bg-ember/20 text-ember border-ember/30"
                    )}>
                      <Activity size={10} />
                      {isAdvantage ? 'Vantagem' : 'Defeito'}
                    </span>
                    <span className="text-xs font-mono text-parchment/60 font-medium">
                      {isAdvantage ? `Custo: ${costDetails.totalCost} pts` : `+${costDetails.totalCost} pts de saldo`}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer shrink-0"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Details Cards */}
            <div className="space-y-4 relative z-10">
              <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-parchment/40 block text-[9px] uppercase tracking-wider mb-1">
                    {costDetails.isAdvantage ? 'Custo' : 'Saldo'}
                  </span>
                  <span className={cn(
                    "font-serif font-bold text-base sm:text-lg block",
                    costDetails.isAdvantage ? "text-arcane" : "text-ember"
                  )}>
                    {costDetails.isAdvantage ? `${costDetails.totalCost} pts` : `+${costDetails.totalCost} pts`}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-parchment/40 block text-[9px] uppercase tracking-wider mb-1">
                    Modificador
                  </span>
                  <span className={cn(
                    "font-serif font-bold text-base sm:text-lg block",
                    effMod > 0 ? "text-arcane" : effMod < 0 ? "text-ember" : "text-parchment"
                  )}>
                    {effMod > 0 ? `+${effMod}` : effMod} pts
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-parchment/40 block text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Target size={10} className={isAdvantage ? "text-arcane" : "text-ember"} />
                    Alvo
                  </span>
                  <span className="text-parchment font-bold text-xs truncate block mt-0.5">
                    {targetDisplayName}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-[11px] font-mono text-parchment/80 space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-parchment/40 block font-bold">
                  Cálculo do Valor de Custo ({costDetails.isAdvantage ? 'Vantagem' : 'Defeito'}):
                </span>
                <p className="leading-relaxed">
                  Soma dos Efeitos ({costDetails.rawEffectSum >= 0 ? `+${costDetails.rawEffectSum}` : costDetails.rawEffectSum}) → Positivo: {costDetails.positiveEffectSum} ÷ 2 ({costDetails.isAdvantage ? 'teto' : 'piso'} = {costDetails.halfEffect}) + |Modificador| ({costDetails.modVal}) = <span className={cn("font-bold", costDetails.isAdvantage ? "text-arcane" : "text-ember")}>{costDetails.totalCost} pts</span>
                </p>
              </div>

              {trait.description && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest block">
                    Descrição Completa
                  </label>
                  <div className="p-4 rounded-2xl glass border border-white/10 text-xs sm:text-sm text-parchment/80 leading-relaxed font-sans max-h-48 overflow-y-auto">
                    {trait.description}
                  </div>
                </div>
              )}

              {trait.effect && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest block">
                    Efeito no Jogo / Regra
                  </label>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 text-xs text-parchment/90 font-mono leading-relaxed">
                    {trait.effect}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10 gap-3 relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 glass rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-white/10 text-parchment/70 hover:text-parchment transition-colors cursor-pointer"
              >
                Fechar
              </button>

              {showSelectButton && onToggleSelect && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleSelect();
                    onClose();
                  }}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all shadow-lg cursor-pointer flex items-center gap-2",
                    isSelected
                      ? "bg-ember/20 text-ember border border-ember/40 hover:bg-ember/30"
                      : isAdvantage
                        ? "bg-arcane text-obsidian hover:bg-arcane/90 shadow-arcane/20"
                        : "bg-ember text-obsidian hover:bg-ember/90 shadow-ember/20"
                  )}
                >
                  {isSelected ? (
                    <>
                      <X size={14} /> Remover Traço
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Selecionar Traço
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default TraitDetailModal;
