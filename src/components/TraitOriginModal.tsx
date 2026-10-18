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
  Sparkles,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { cn, isTraitModifierSameAsEffect } from '../lib/utils';

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
    total?: number;
    isTalent?: boolean;
    composition?: string[];
    compositionDetails?: Array<{
      id: string;
      label: string;
      total: number;
      value: number;
      mod: number;
      traitMod: number;
      itemMod: number;
    }>;
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
    isDirect?: boolean;
    sourceAttr?: string;
  }>;
  attrTotal: number;
}

export const TraitOriginModal: React.FC<TraitOriginModalProps> = ({
  isOpen,
  onClose,
  attr,
  contributingTraits = [],
  attrTotal
}) => {
  if (!attr) return null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-xl glass-modal bg-obsidian/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden z-10 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            {(() => {
              const IconComponent = (attr.icon && iconMap[attr.icon]) || (attr.isTalent ? Sparkles : Sword);
              const traitsSum = contributingTraits
                .filter(t => attr.isTalent ? t.isDirect !== false : true)
                .reduce((acc, t) => acc + (Number(t.effectiveMod) || 0), 0);
              
              const effectiveTraitMod = contributingTraits && contributingTraits.length > 0 ? traitsSum : (attr.traitMod || 0);
              const isNegative = effectiveTraitMod < 0;
              const isPositive = effectiveTraitMod > 0;
              const isTalent = Boolean(attr.isTalent);
              const computedTotal = (attr.value || 0) + (attr.mod || 0) + effectiveTraitMod + (!isTalent ? (attr.itemMod ?? 0) : 0);
              const displayTotal = attrTotal !== undefined && attrTotal !== null ? attrTotal : (attr.total ?? computedTotal);

              return (
                <>
                  <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-2xl bg-white/5 border border-white/15", attr.color || (isTalent ? "text-gold" : "text-arcane"))}>
                        <IconComponent size={22} />
                      </div>
                      <div>
                        <h3 className="text-xl font-serif text-parchment flex items-center gap-2">
                          Composição & Modificadores
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
                    {/* Regra de Efeitos e Modificadores de Traços */}
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                      <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <span className="font-mono uppercase tracking-wider text-amber-300 font-bold block">
                          Regra de Aplicação de Efeitos e Modificadores
                        </span>
                        <p className="text-parchment/80 leading-relaxed font-sans text-[11px] sm:text-xs">
                          Quando o efeito e o modificador de um traço alterarem o mesmo {isTalent ? 'talento' : 'atributo'}, é considerado apenas o valor do modificador (sem duplicidade). Todos os cálculos de testes, talentos e combate consideram o <strong className="text-parchment font-semibold">valor total</strong> dos atributos.
                        </p>
                      </div>
                    </div>

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
                            {isNegative ? "Penalidade Efetiva de Traços" : isPositive ? "Bônus Efetivo de Traços" : "Sem Modificador Direto de Traços"}
                          </span>
                          <span className="font-mono text-xl font-bold">
                            {effectiveTraitMod > 0 ? `+${effectiveTraitMod}` : effectiveTraitMod} pts
                          </span>
                        </div>
                        <p className="text-xs text-parchment/60 font-sans mt-0.5">
                          {isNegative 
                            ? `Os traços ativos aplicam uma penalidade líquida de ${Math.abs(effectiveTraitMod)} ponto(s) neste ${isTalent ? 'talento' : 'atributo'}.`
                            : isPositive 
                            ? `Os traços ativos concedem um bônus líquido de ${effectiveTraitMod} ponto(s) neste ${isTalent ? 'talento' : 'atributo'}.`
                            : `Nenhum traço ativo está alterando diretamente este ${isTalent ? 'talento' : 'atributo'}.`}
                        </p>
                      </div>
                    </div>

                    {/* Talent Composition Attributes Breakdown */}
                    {isTalent && attr.compositionDetails && attr.compositionDetails.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/50 uppercase tracking-widest px-1">
                          Atributos de Composição (Valores Totais Utilizados)
                        </label>
                        <div className="space-y-2">
                          {attr.compositionDetails.map((comp) => (
                            <div key={comp.id} className="p-3 rounded-2xl glass border border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-serif text-sm font-bold text-parchment">{comp.label}</span>
                                <span className="text-[10px] font-mono text-parchment/40">({comp.id.toUpperCase()})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-[10px] font-mono text-parchment/50 hidden sm:flex items-center gap-1.5">
                                  <span>Base: {comp.value}</span>
                                  {comp.mod !== 0 && <span className="text-ember">Mod: {comp.mod > 0 ? `+${comp.mod}` : comp.mod}</span>}
                                  {comp.traitMod !== 0 && <span className="text-arcane">Traço: {comp.traitMod > 0 ? `+${comp.traitMod}` : comp.traitMod}</span>}
                                  {comp.itemMod !== 0 && <span className="text-gold">Item: {comp.itemMod > 0 ? `+${comp.itemMod}` : comp.itemMod}</span>}
                                </div>
                                <div className="px-2.5 py-1 rounded-xl bg-arcane/15 border border-arcane/30 text-arcane font-serif text-sm font-bold">
                                  Total: {comp.total}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Complete Value Composition Bar */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/50 uppercase tracking-widest px-1">
                        Composição do Valor Final do {isTalent ? 'Talento' : 'Atributo'}
                      </label>
                      <div className={cn(
                        "grid gap-2 text-center p-3 rounded-2xl glass border border-white/10",
                        isTalent ? "grid-cols-3" : "grid-cols-4"
                      )}>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-wider block">
                            {isTalent ? 'Soma Atributos Totais' : 'Base'}
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
                          <span className="text-[9px] font-mono uppercase tracking-wider font-bold block">
                            {isTalent ? 'Traço Direto' : 'Traço'}
                          </span>
                          <span className={cn(
                            "font-serif text-base font-bold",
                            isNegative ? "text-ember" : isPositive ? "text-arcane" : "text-parchment/40"
                          )}>
                            {effectiveTraitMod > 0 ? `+${effectiveTraitMod}` : effectiveTraitMod}
                          </span>
                        </div>
                        {!isTalent && (
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-wider block">Item / Equip.</span>
                            <span className="font-serif text-base text-arcane">{(attr.itemMod ?? 0) >= 0 ? `+${attr.itemMod ?? 0}` : attr.itemMod}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-arcane/10 border border-arcane/30 text-sm font-mono shadow-sm">
                        <span className="text-parchment/80 uppercase tracking-wider font-bold">Valor Total Final:</span>
                        <span className="text-parchment font-serif text-2xl font-bold text-glow-arcane">{displayTotal} pts</span>
                      </div>
                    </div>

                    {/* List of Contributing Traits */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest flex items-center gap-1.5">
                          <Star size={12} className="text-gold" />
                          Traços que Influenciam este {isTalent ? 'Talento' : 'Atributo'} ({contributingTraits.length})
                        </label>
                      </div>

                      {contributingTraits.length > 0 ? (
                        <div className="space-y-3">
                          {contributingTraits.map((t, index) => {
                            const isPositiveMod = t.effectiveMod > 0;
                            const isNegativeMod = t.effectiveMod < 0;
                            const isDisadvantage = String(t.type || '').toLowerCase().includes('disadvantage') || 
                                                   String(t.type || '').toLowerCase().includes('defeito') ||
                                                   String(t.type || '').toLowerCase().includes('desvantagem');
                            const sameType = isTraitModifierSameAsEffect(t);

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
                                    <div className="flex items-center gap-2">
                                      <h4 className={cn(
                                        "font-serif text-base font-medium",
                                        isNegativeMod ? "text-ember" : isPositiveMod ? "text-arcane" : "text-parchment"
                                      )}>
                                        {t.name}
                                      </h4>
                                      {t.sourceAttr && (
                                        <span className="text-[9px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-parchment/60">
                                          via {t.sourceAttr}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className={cn(
                                        "text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        isDisadvantage 
                                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30" 
                                          : "bg-arcane/15 text-arcane border-arcane/30"
                                      )}>
                                        {isDisadvantage ? 'Defeito' : 'Vantagem'}
                                      </span>
                                      {t.modifierType && (
                                        <span className="text-[10px] text-parchment/50 font-mono">
                                          Alvo: {t.modifierType.toUpperCase()}
                                        </span>
                                      )}
                                      {sameType && (
                                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                          <CheckCircle2 size={10} />
                                          Sem duplicidade (apenas modificador considerado)
                                        </span>
                                      )}
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
                                  <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-parchment/60">
                                    <span className="text-gold uppercase tracking-wider text-[9px] font-bold">Efeito Declarado:</span>
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
                          <p className="font-serif text-sm text-parchment/70">
                            Nenhum traço ativo está modificando diretamente este {isTalent ? 'talento' : 'atributo'}.
                          </p>
                          <p className="text-xs text-parchment/40 font-sans max-w-sm mx-auto">
                            O cálculo utiliza o valor base somado aos modificadores manuais e de itens. Se você adquirir novas Vantagens ou Defeitos, eles serão aplicados aqui automaticamente.
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
                      Fechar
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
