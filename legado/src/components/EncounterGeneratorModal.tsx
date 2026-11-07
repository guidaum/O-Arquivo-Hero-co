import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Skull, 
  Sparkles, 
  RotateCcw, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  X, 
  ShieldAlert, 
  Users, 
  Swords, 
  EyeOff, 
  Flame, 
  Compass,
  Award,
  Zap
} from 'lucide-react';
import { Monster, EnvironmentType, GeneratedEncounter } from '../types/bestiary';
import { OFFICIAL_BESTIARY, calculatePartyXpBudgets, getMonsterCountMultiplier } from '../lib/bestiaryData';
import { cn } from '../lib/utils';
import { playSoundEffect } from '../lib/soundEngine';

interface EncounterGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyCharacters: Array<{ name?: string; level?: number; id?: string }>;
  onSpawnEncounter: (encounter: GeneratedEncounter, isHidden: boolean) => void;
}

export default function EncounterGeneratorModal({
  isOpen,
  onClose,
  partyCharacters,
  onSpawnEncounter
}: EncounterGeneratorModalProps) {
  const [difficulty, setDifficulty] = React.useState<'Fácil' | 'Médio' | 'Difícil' | 'Mortal'>('Médio');
  const [environment, setEnvironment] = React.useState<EnvironmentType>('dungeon');
  const [tacticalTheme, setTacticalTheme] = React.useState<'balanced' | 'boss_minions' | 'swarm' | 'solo'>('balanced');
  const [spawnAsHidden, setSpawnAsHidden] = React.useState(false);

  // Party XP Budget Calculation
  const partyBudgets = React.useMemo(() => {
    return calculatePartyXpBudgets(partyCharacters);
  }, [partyCharacters]);

  // Current target XP budget
  const targetXp = React.useMemo(() => {
    switch (difficulty) {
      case 'Fácil': return partyBudgets.facil;
      case 'Médio': return partyBudgets.medio;
      case 'Difícil': return partyBudgets.dificil;
      case 'Mortal': return partyBudgets.mortal;
    }
  }, [difficulty, partyBudgets]);

  // Active generated encounter
  const [encounter, setEncounter] = React.useState<GeneratedEncounter | null>(null);

  // Generate an encounter based on parameters
  const generateEncounter = React.useCallback(() => {
    playSoundEffect('diceRoll');

    // Filter available monsters by environment
    const pool = OFFICIAL_BESTIARY.filter(m => m.environments.includes(environment));
    const validPool = pool.length > 0 ? pool : OFFICIAL_BESTIARY;

    // Filter monsters within sensible CR range of party avgLevel
    const maxCr = Math.min(20, Math.max(1, partyBudgets.avgLevel + (difficulty === 'Mortal' ? 3 : difficulty === 'Difícil' ? 2 : 1)));
    const eligible = validPool.filter(m => m.crValue <= maxCr);
    const candidates = eligible.length > 0 ? eligible : validPool;

    const generatedMonsters: Array<{ monster: Monster; count: number }> = [];
    let currentXp = 0;

    if (tacticalTheme === 'solo') {
      // Find a single monster whose XP is closest to targetXp
      const sorted = [...candidates].sort((a, b) => Math.abs(a.xp - targetXp) - Math.abs(b.xp - targetXp));
      const boss = sorted[0] || candidates[0];
      generatedMonsters.push({ monster: boss, count: 1 });
      currentXp = boss.xp;
    } else if (tacticalTheme === 'boss_minions') {
      // 1 Leader / Boss + 2-4 Minions
      const bosses = candidates.filter(m => m.xp <= targetXp * 0.7);
      const boss = bosses[Math.floor(Math.random() * bosses.length)] || candidates[0];
      generatedMonsters.push({ monster: boss, count: 1 });
      currentXp += boss.xp;

      const remainingXp = Math.max(50, targetXp - currentXp);
      const minions = candidates.filter(m => m.id !== boss.id && m.xp <= remainingXp * 0.5);
      if (minions.length > 0) {
        const minion = minions[Math.floor(Math.random() * minions.length)];
        const minionCount = Math.max(2, Math.min(5, Math.floor(remainingXp / minion.xp) || 2));
        generatedMonsters.push({ monster: minion, count: minionCount });
        currentXp += minion.xp * minionCount;
      }
    } else if (tacticalTheme === 'swarm') {
      // Large group of lower CR minions (4 to 8 creatures)
      const minions = candidates.filter(m => m.crValue <= Math.max(0.25, partyBudgets.avgLevel / 3));
      const chosen = minions[Math.floor(Math.random() * minions.length)] || candidates[0];
      const count = Math.max(4, Math.min(10, Math.floor(targetXp / chosen.xp) || 4));
      generatedMonsters.push({ monster: chosen, count });
      currentXp = chosen.xp * count;
    } else {
      // Balanced patrol (2 or 3 distinct monster types)
      const sorted = [...candidates].sort(() => Math.random() - 0.5);
      const primary = sorted[0];
      generatedMonsters.push({ monster: primary, count: Math.random() > 0.5 ? 2 : 1 });
      currentXp += primary.xp * generatedMonsters[0].count;

      if (sorted.length > 1 && currentXp < targetXp * 0.8) {
        const secondary = sorted[1];
        const secCount = Math.max(1, Math.min(3, Math.floor((targetXp - currentXp) / secondary.xp) || 1));
        generatedMonsters.push({ monster: secondary, count: secCount });
        currentXp += secondary.xp * secCount;
      }
    }

    // Calculate total monster count and adjusted XP
    const totalCount = generatedMonsters.reduce((acc, m) => acc + m.count, 0);
    const multiplier = getMonsterCountMultiplier(totalCount);
    const adjustedXp = Math.round(currentXp * multiplier);

    const generated: GeneratedEncounter = {
      id: `enc_${Date.now()}`,
      name: `Encontro ${difficulty} em ${environment}`,
      difficulty,
      environment,
      totalXp: currentXp,
      adjustedXp,
      targetXpBudget: targetXp,
      monsters: generatedMonsters
    };

    setEncounter(generated);
  }, [environment, difficulty, tacticalTheme, targetXp, partyBudgets]);

  // Initial generation on open
  React.useEffect(() => {
    if (isOpen && !encounter) {
      generateEncounter();
    }
  }, [isOpen, encounter, generateEncounter]);

  // Adjust count manually (+ / -)
  const handleUpdateCount = (monsterId: string, delta: number) => {
    if (!encounter) return;
    const nextList = encounter.monsters.map(m => {
      if (m.monster.id === monsterId) {
        return { ...m, count: Math.max(0, m.count + delta) };
      }
      return m;
    }).filter(m => m.count > 0);

    const totalBase = nextList.reduce((acc, m) => acc + (m.monster.xp * m.count), 0);
    const count = nextList.reduce((acc, m) => acc + m.count, 0);
    const multiplier = getMonsterCountMultiplier(count);
    const adjustedXp = Math.round(totalBase * multiplier);

    setEncounter({
      ...encounter,
      totalXp: totalBase,
      adjustedXp,
      monsters: nextList
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-stone-950 border border-purple-500/40 rounded-3xl w-full max-w-4xl h-[86vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-black/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg">
              <Swords size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold text-parchment">
                  Gerador Tático de Encontros por ND / XP
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  {partyBudgets.partySize} Heróis (Nível Médio {partyBudgets.avgLevel})
                </span>
              </div>
              <p className="text-[11px] text-parchment/60 font-mono">
                Calcula o orçamento de combate baseado no grupo e balanceia monstros automaticamente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl text-parchment/60 hover:text-parchment transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 border-b border-white/10 bg-white/[0.02] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono shrink-0">
          {/* Difficulty Selector */}
          <div>
            <label className="text-[10px] font-mono text-parchment/50 uppercase block mb-1">
              Dificuldade Desejada:
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['Fácil', 'Médio', 'Difícil', 'Mortal'] as const).map(d => {
                const isSelected = difficulty === d;
                const colors = {
                  Fácil: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
                  Médio: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
                  Difícil: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
                  Mortal: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
                };
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "py-1.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-[11px]",
                      isSelected ? colors[d] : "bg-white/5 border-white/10 text-parchment/50 hover:text-parchment"
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Environment Selector */}
          <div>
            <label className="text-[10px] font-mono text-parchment/50 uppercase block mb-1">
              Ambiente / Bioma:
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
              className="w-full bg-black/40 border border-white/15 text-parchment rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="dungeon">Masmorra & Criptas Ancestrais</option>
              <option value="cavern">Caverna Subterrânea & Magma</option>
              <option value="temple">Templo Arcano & Ruínas Místicas</option>
              <option value="forest">Floresta Sombria & Pântano</option>
              <option value="urban">Urbano, Esgotos & Catacumbas</option>
              <option value="volcano">Covil Vulcânico & Terras Ígneas</option>
            </select>
          </div>

          {/* Theme Style */}
          <div>
            <label className="text-[10px] font-mono text-parchment/50 uppercase block mb-1">
              Composição Tática:
            </label>
            <select
              value={tacticalTheme}
              onChange={(e) => setTacticalTheme(e.target.value as any)}
              className="w-full bg-black/40 border border-white/15 text-parchment rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="balanced">Patrulha Balanceada (Mista)</option>
              <option value="boss_minions">1 Chefe + Lacaios de Apoio</option>
              <option value="swarm">Bando Numeroso / Emboscada</option>
              <option value="solo">Duelo Épico contra Criatura Solo</option>
            </select>
          </div>
        </div>

        {/* XP Budget Summary Strip */}
        <div className="px-4 py-2 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between text-xs font-mono shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-parchment/60">
              Orçamento de XP ({difficulty}): <strong className="text-amber-400">{targetXp.toLocaleString()} XP</strong>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-parchment/60">
              XP Base: <strong className="text-purple-300">{encounter?.totalXp.toLocaleString() || 0} XP</strong>
            </span>
            <span className="text-white/20">|</span>
            <span className="text-parchment/60">
              XP Ajustado (Multiplicador de Alvos): <strong className="text-rose-400">{encounter?.adjustedXp.toLocaleString() || 0} XP</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={generateEncounter}
            className="px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <RotateCcw size={12} />
            <span>Gerar Nova Composição</span>
          </button>
        </div>

        {/* Generated Monsters List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-obsidian">
          {!encounter || encounter.monsters.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Skull size={40} className="mx-auto text-parchment/20 animate-pulse" />
              <p className="text-parchment/60 text-xs font-mono">
                Clique no botão acima para calcular e gerar um encontro balanceado.
              </p>
            </div>
          ) : (
            encounter.monsters.map(({ monster, count }) => (
              <div 
                key={monster.id}
                className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div 
                    style={{ borderColor: monster.color, backgroundColor: `${monster.color}20` }}
                    className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-bold text-sm shrink-0 shadow-lg"
                  >
                    <Skull size={24} style={{ color: monster.color }} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-bold text-base text-parchment">
                        {monster.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        ND {monster.cr}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-parchment/60 mt-0.5">
                      {monster.type} • {monster.size} • CA {monster.ac} • {monster.hp} PV • {monster.xp} XP cada
                    </div>
                  </div>
                </div>

                {/* Count Stepper */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => handleUpdateCount(monster.id, -1)}
                      className="p-1 hover:bg-white/10 rounded-lg text-parchment/70 hover:text-rose-400 cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-3 text-xs font-mono font-bold text-parchment">
                      {count}x
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateCount(monster.id, 1)}
                      className="p-1 hover:bg-white/10 rounded-lg text-parchment/70 hover:text-emerald-400 cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="text-right font-mono text-xs text-parchment/80 min-w-[70px]">
                    {(monster.xp * count).toLocaleString()} XP
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Spawning Action */}
        <div className="p-4 border-t border-white/10 bg-black/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 text-xs font-mono text-parchment/70 cursor-pointer">
            <input
              type="checkbox"
              checked={spawnAsHidden}
              onChange={(e) => setSpawnAsHidden(e.target.checked)}
              className="rounded border-white/20 text-purple-600 focus:ring-0 accent-purple-600 cursor-pointer"
            />
            <EyeOff size={14} className="text-purple-400" />
            <span>Inserir monstros como Ocultos na Névoa (Invisíveis aos jogadores)</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-mono transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (encounter && encounter.monsters.length > 0) {
                  onSpawnEncounter(encounter, spawnAsHidden);
                  onClose();
                }
              }}
              disabled={!encounter || encounter.monsters.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-mono font-bold shadow-lg transition-transform hover:scale-105 cursor-pointer disabled:opacity-50"
            >
              Spawnar Encontro no Mapa ({encounter?.monsters.reduce((acc, m) => acc + m.count, 0) || 0} Monstros)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
