import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Star, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Sword, 
  Zap, 
  Eye, 
  Brain, 
  Heart, 
  Flame, 
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

const iconMap: Record<string, any> = {
  Shield, Sword, Zap, Flame, Eye, Brain, Heart, Sparkles, Star
};

export interface TraitOriginModalProps {
  isOpen: boolean;
  onClose: () => void;
  attr: {
    id: string;
    label: string;
    icon?: string;
    color?: string;
    value: number;
    mod: number;
    traitMod: number;
    itemMod?: number;
    isTalent?: boolean;
    composition?: string[];
  } | null;
  contributingTraits: Array<{
    id: string;
    name: string;
    type: string;
    modifier: number;
    modifierType: string;
    description?: string;
    effect?: string;
    effectiveMod: number;
  }>;
  attrTotal: number;
}

export const TraitOriginModal: React.FC<TraitOriginModalProps> = ({
  isOpen,
  onClose,
  attr,
  contributingTraits,
  attrTotal
}) => {
  const hasDetails = Boolean(
    attr && contributingTraits && contributingTraits.length > 0
  );

  return (
    <AnimatePresence>
      {isOpen && attr && hasDetails && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-obsidian/85 backdrop-blur-md"
          />

          {/* Modal Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg glass-modal bg-obsidian/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden z-10 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            {(() => {
              const IconComponent = (attr.icon && iconMap[attr.icon]) || (attr.isTalent ? Sparkles : Sword);
              const traitsSum = (contributingTraits || []).reduce((acc, t) => acc + (Number(t.effectiveMod) || 0), 0);
              const effectiveTraitMod = contributingTraits && contributingTraits.length > 0 ? traitsSum : (attr.traitMod || 0);
              const isNegative = effectiveTraitMod < 0;
              const isPositive = effectiveTraitMod > 0;
              const isTalent = Boolean(attr.isTalent);
              const computedTotal = (attr.value || 0) + (attr.mod || 0) + effectiveTraitMod + (!isTalent ? (attr.itemMod ?? 0) : 0);
              const displayTotal = attrTotal !== undefined && attrTotal !== null ? attrTotal : computedTotal;

              return (
                <>
                  <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-2xl bg-white/5 border border-white/15", attr.color || (isTalent ? "text-gold" : "text-arcane"))}>
                        <IconComponent size={22} />
                      </div>
                      <div>
                        <h3 className="text-xl font-serif text-parchment flex items-center gap-2">
                          Origem do Modificador
                        </h3>
                        <p className="text-xs font-mono text-parchment/50 uppercase tracking-widest">
                          {isTalent ? 'Talento' : 'Atributo'}: <span className="text-parchment font-bold">{attr.label}</span> {!isTalent && `(${attr.id.toUpperCase()})`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="overflow-y-auto space-y-6 pr-1 -mr-1 custom-scrollbar">
                    {/* Trait Status Banner */}
                    <div className={cn(
                      "p-4 rounded-2xl border flex items-center gap-3.5",
                      isNegative ? "bg-ember/10 border-ember/30 text-ember" :
                      isPositive ? "bg-arcane/10 border-arcane/30 text-arcane" :
                      "bg-white/5 border-white/10 text-parchment/70"
                    )}>
                      <div className={cn(
                        "p-2.5 rounded-xl shrink-0",
                        isNegative ? "bg-ember/20 text-ember" :
                        isPositive ? "bg-arcane/20 text-arcane" :
                        "bg-white/10 text-parchment/40"
                      )}>
                        {isNegative ? <TrendingDown size={22} /> : isPositive ? <TrendingUp size={22} /> : <Info size={22} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-base font-bold">
                            {isNegative ? "Penalidade Efetiva de Traços" : isPositive ? "Bônus Efetivo de Traços" : "Sem Modificador de Traços"}
                          </span>
                          <span className="font-mono text-xl font-bold">
                            {effectiveTraitMod > 0 ? `+${effectiveTraitMod}` : effectiveTraitMod} pts
                          </span>
                        </div>
                        <p className="text-xs text-parchment/60 font-sans mt-0.5">
                          {isNegative 
                            ? `Os modificadores ativos de traços aplicam uma redução de ${Math.abs(effectiveTraitMod)} ponto(s) neste ${isTalent ? 'talento' : 'atributo'}.`
                            : isPositive 
                            ? `Os modificadores ativos de traços aplicam um ganho de ${effectiveTraitMod} ponto(s) neste ${isTalent ? 'talento' : 'atributo'}.`
                            : `Nenhum traço ativo está alterando o valor deste ${isTalent ? 'talento' : 'atributo'}.`}
                        </p>
                      </div>
                    </div>

                    {/* Complete Value Composition Bar */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-1">
                        Composição Completa do {isTalent ? 'Talento' : 'Atributo'}
                      </label>
                      <div className={cn(
                        "grid gap-2 text-center p-3 rounded-2xl glass border border-white/10",
                        isTalent ? "grid-cols-3" : "grid-cols-4"
                      )}>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-wider block">
                            {isTalent ? 'Base (Composição)' : 'Base'}
                          </span>
                          <span className="font-serif text-base text-glow-arcane font-bold">{attr.value}</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-wider block">Manual (Mod)</span>
                          <span className="font-serif text-base text-ember">{attr.mod >= 0 ? `+${attr.mod}` : attr.mod}</span>
                        </div>
                        <div className={cn(
                          "space-y-0.5 p-1 rounded-xl border",
                          isNegative ? "bg-ember/15 border-ember/30" : isPositive ? "bg-arcane/15 border-arcane/30" : "border-transparent"
                        )}>
                          <span className="text-[9px] font-mono uppercase tracking-wider font-bold block">Traço</span>
                          <span className={cn(
                            "font-serif text-base font-bold",
                            isNegative ? "text-ember" : isPositive ? "text-arcane" : "text-parchment/40"
                          )}>
                            {effectiveTraitMod > 0 ? `+${effectiveTraitMod}` : effectiveTraitMod}
                          </span>
                        </div>
                        {!isTalent && (
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-wider block">Item</span>
                            <span className="font-serif text-base text-arcane">{(attr.itemMod ?? 0) >= 0 ? `+${attr.itemMod ?? 0}` : attr.itemMod}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
                        <span className="text-parchment/50">Total Efetivo:</span>
                        <span className="text-parchment font-serif text-lg font-bold text-glow-arcane">{displayTotal} pts</span>
                      </div>
                    </div>

                    {/* List of Contributing Traits */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest flex items-center gap-1.5">
                          <Star size={12} className="text-gold" />
                          Traços que Modificam este {isTalent ? 'Talento' : 'Atributo'} ({contributingTraits.length})
                        </label>
                      </div>

                      {contributingTraits.length > 0 ? (
                        <div className="space-y-3">
                          {contributingTraits.map((t, index) => {
                            const isPositiveMod = t.effectiveMod > 0;
                            const isNegativeMod = t.effectiveMod < 0;
                            const isDisadvantage = t.type === 'disadvantage';

                            return (
                              <div
                                key={t.id || index}
                                className={cn(
                                  "p-4 rounded-2xl glass border transition-all space-y-2",
                                  isNegativeMod 
                                    ? "border-ember/30 bg-ember/[0.04] hover:border-ember/50" 
                                    : isPositiveMod
                                    ? "border-arcane/30 bg-arcane/[0.04] hover:border-arcane/50"
                                    : "border-white/10 hover:border-white/20"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h4 className={cn(
                                      "font-serif text-base font-medium",
                                      isNegativeMod ? "text-ember" : isPositiveMod ? "text-arcane" : "text-parchment"
                                    )}>
                                      {t.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={cn(
                                        "text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        isDisadvantage 
                                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30" 
                                          : "bg-arcane/15 text-arcane border-arcane/30"
                                      )}>
                                        {isDisadvantage ? 'Defeito' : 'Vantagem'}
                                      </span>
                                      <span className="text-[10px] text-parchment/40 font-mono">
                                        Alvo: {t.modifierType?.toUpperCase()}
                                      </span>
                                    </div>
                                  </div>

                                  <div className={cn(
                                    "px-3 py-1.5 rounded-xl font-serif text-lg font-bold border shrink-0",
                                    isNegativeMod 
                                      ? "bg-ember/20 text-ember border-ember/40 shadow-sm" 
                                      : isPositiveMod
                                      ? "bg-arcane/20 text-arcane border-arcane/40 shadow-sm"
                                      : "bg-white/10 text-parchment/60 border-white/20"
                                  )}>
                                    {t.effectiveMod > 0 ? `+${t.effectiveMod}` : t.effectiveMod}
                                  </div>
                                </div>

                                {t.description && (
                                  <p className="text-xs text-parchment/70 font-sans leading-relaxed">
                                    {t.description}
                                  </p>
                                )}

                                {t.effect && (
                                  <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-parchment/50">
                                    <span className="text-gold uppercase tracking-wider text-[9px]">Efeito:</span>
                                    <span className="truncate">{t.effect}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 rounded-2xl glass border border-dashed border-white/10 text-center space-y-2">
                          <Star size={24} className="text-parchment/20 mx-auto" />
                          <p className="font-serif text-sm text-parchment/60">
                            Nenhum traço ativo está modificando este {isTalent ? 'talento' : 'atributo'}.
                          </p>
                          <p className="text-xs text-parchment/40 font-sans max-w-sm mx-auto">
                            Os traços mantêm estritamente o sinal (+ ou -) configurado, permitindo defeitos com bônus ou vantagens com penalidades.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-4 border-t border-white/10 flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 py-2.5 bg-arcane text-obsidian rounded-xl text-xs font-mono uppercase tracking-wider font-bold hover:scale-105 transition-all shadow-lg shadow-arcane/20 cursor-pointer"
                    >
                      Entendido
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
