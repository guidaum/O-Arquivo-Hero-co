import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Skull, 
  Search, 
  X, 
  Plus, 
  Shield, 
  Heart, 
  Swords, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Flame, 
  Compass, 
  ChevronRight, 
  Filter, 
  Dices,
  BookOpen,
  Zap,
  Info
} from 'lucide-react';
import { Monster, CreatureType, EnvironmentType } from '../types/bestiary';
import { OFFICIAL_BESTIARY } from '../lib/bestiaryData';
import { cn } from '../lib/utils';
import { playSoundEffect } from '../lib/soundEngine';

interface BestiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawnMonster: (monster: Monster, isHidden: boolean) => void;
  customMonsters?: Monster[];
  onSaveCustomMonster?: (monster: Partial<Monster>) => Promise<void>;
  isGM?: boolean;
}

export default function BestiaryModal({
  isOpen,
  onClose,
  onSpawnMonster,
  customMonsters = [],
  onSaveCustomMonster,
  isGM = true
}: BestiaryModalProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCr, setSelectedCr] = React.useState<string>('all');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [selectedEnv, setSelectedEnv] = React.useState<string>('all');
  const [selectedMonster, setSelectedMonster] = React.useState<Monster>(OFFICIAL_BESTIARY[0]);
  const [spawnAsHidden, setSpawnAsHidden] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState<'official' | 'custom'>('official');

  // Quick dice roll result for monster attack
  const [actionRollResult, setActionRollResult] = React.useState<{
    actionName: string;
    d20: number;
    attackTotal: number;
    damageText: string;
  } | null>(null);

  // Combine official & custom
  const allMonsters = React.useMemo(() => {
    return activeTab === 'official' ? OFFICIAL_BESTIARY : customMonsters;
  }, [activeTab, customMonsters]);

  // Filtered monsters list
  const filteredMonsters = React.useMemo(() => {
    return allMonsters.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCr = selectedCr === 'all' || m.cr === selectedCr;
      const matchType = selectedType === 'all' || m.type === selectedType;
      const matchEnv = selectedEnv === 'all' || m.environments.includes(selectedEnv as EnvironmentType);
      return matchSearch && matchCr && matchType && matchEnv;
    });
  }, [allMonsters, searchTerm, selectedCr, selectedType, selectedEnv]);

  // Roll attack & action damage test
  const handleRollAction = (action: Monster['actions'][0]) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonus = action.attackBonus ?? selectedMonster.initiativeBonus ?? 3;
    const attackTotal = d20 + bonus;

    playSoundEffect('diceRoll');

    setActionRollResult({
      actionName: action.name,
      d20,
      attackTotal,
      damageText: action.damage ? `${action.damage} (${action.damageType || 'dano'})` : 'Efeito Especial'
    });

    setTimeout(() => {
      setActionRollResult(null);
    }, 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-stone-950 border border-purple-500/40 rounded-3xl w-full max-w-5xl h-[88vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-black/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow-lg">
              <Skull size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold text-parchment">
                  Bestiário & Biblioteca de Criaturas
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  {filteredMonsters.length} Criaturas
                </span>
              </div>
              <p className="text-[11px] text-parchment/60 font-mono">
                Fichas completas com ações, resistências e inserção direta no mapa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Tab Switch */}
            <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('official')}
                className={cn(
                  "px-3 py-1 rounded-lg transition-all cursor-pointer font-semibold",
                  activeTab === 'official' ? "bg-purple-600/30 text-purple-200 border border-purple-500/40" : "text-parchment/50 hover:text-parchment"
                )}
              >
                Oficiais ({OFFICIAL_BESTIARY.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={cn(
                  "px-3 py-1 rounded-lg transition-all cursor-pointer font-semibold",
                  activeTab === 'custom' ? "bg-purple-600/30 text-purple-200 border border-purple-500/40" : "text-parchment/50 hover:text-parchment"
                )}
              >
                Customizados ({customMonsters.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-xl text-parchment/60 hover:text-parchment transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar criatura por nome ou tipo..."
              className="w-full bg-black/40 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-parchment focus:outline-none focus:border-purple-400 placeholder:text-parchment/30"
            />
          </div>

          {/* CR Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-parchment/40 text-[10px]">ND:</span>
            <select
              value={selectedCr}
              onChange={(e) => setSelectedCr(e.target.value)}
              className="bg-black/40 border border-white/15 text-parchment rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400"
            >
              <option value="all">Todos os NDs</option>
              <option value="1/8">ND 1/8 (25 XP)</option>
              <option value="1/4">ND 1/4 (50 XP)</option>
              <option value="1/2">ND 1/2 (100 XP)</option>
              <option value="1">ND 1 (200 XP)</option>
              <option value="2">ND 2 (450 XP)</option>
              <option value="3">ND 3 (700 XP)</option>
              <option value="5">ND 5 (1.800 XP)</option>
              <option value="8">ND 8 (3.900 XP)</option>
              <option value="10">ND 10 (5.900 XP)</option>
              <option value="15">ND 15 (13.000 XP)</option>
              <option value="20">ND 20 (25.000 XP)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-parchment/40 text-[10px]">Tipo:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-black/40 border border-white/15 text-parchment rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400"
            >
              <option value="all">Todos os Tipos</option>
              <option value="Morto-vivo">Morto-vivo</option>
              <option value="Monstruosidade">Monstruosidade</option>
              <option value="Dragão">Dragão</option>
              <option value="Humanoide">Humanoide</option>
              <option value="Fera">Fera</option>
              <option value="Elemental">Elemental</option>
              <option value="Gigante">Gigante</option>
              <option value="Construto">Construto</option>
            </select>
          </div>

          {/* Environment Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-parchment/40 text-[10px]">Ambiente:</span>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="bg-black/40 border border-white/15 text-parchment rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400"
            >
              <option value="all">Qualquer Local</option>
              <option value="dungeon">Masmorra / Cripta</option>
              <option value="cavern">Caverna Subterrânea</option>
              <option value="temple">Templo Arcano</option>
              <option value="volcano">Vulcão / Magma</option>
              <option value="forest">Floresta / Pântano</option>
              <option value="urban">Urbano / Esgotos</option>
            </select>
          </div>
        </div>

        {/* Action Dice Roll Toast */}
        <AnimatePresence>
          {actionRollResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-2 p-2.5 rounded-xl bg-purple-950/90 border border-purple-400/60 flex items-center justify-between text-xs font-mono shadow-xl shrink-0"
            >
              <div className="flex items-center gap-2">
                <Dices size={16} className="text-purple-300 animate-spin" />
                <span className="text-parchment">
                  Ataque <strong>{actionRollResult.actionName}</strong>: d20 [<strong>{actionRollResult.d20}</strong>] = <strong className="text-amber-400 text-sm">{actionRollResult.attackTotal}</strong> para atingir!
                </span>
              </div>
              <span className="text-purple-300 text-[11px] bg-purple-900/60 px-2 py-0.5 rounded-md border border-purple-400/30">
                Dano: {actionRollResult.damageText}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Master Content Area: Monster List (Left) + Detailed Statblock (Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Monster List Column */}
          <div className="w-full sm:w-72 lg:w-80 border-r border-white/10 overflow-y-auto p-2 space-y-1.5 shrink-0 bg-black/20">
            {filteredMonsters.length === 0 ? (
              <div className="p-8 text-center text-parchment/40 text-xs font-mono">
                Nenhuma criatura encontrada para estes filtros.
              </div>
            ) : (
              filteredMonsters.map(monster => {
                const isSelected = selectedMonster?.id === monster.id;
                return (
                  <button
                    key={monster.id}
                    type="button"
                    onClick={() => setSelectedMonster(monster)}
                    className={cn(
                      "w-full p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer group",
                      isSelected
                        ? "bg-purple-600/20 border-purple-500/60 shadow-lg text-parchment"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.06] text-parchment/70 hover:text-parchment"
                    )}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div 
                        style={{ borderColor: monster.color, backgroundColor: `${monster.color}20` }}
                        className="w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0"
                      >
                        <Skull size={18} style={{ color: monster.color }} />
                      </div>
                      <div className="truncate">
                        <div className="font-serif font-bold text-xs truncate text-parchment group-hover:text-purple-300">
                          {monster.name}
                        </div>
                        <div className="text-[10px] text-parchment/40 font-mono">
                          {monster.type} • {monster.size}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-amber-300 font-bold block">
                        ND {monster.cr}
                      </span>
                      <span className="text-[9px] text-parchment/40 font-mono">
                        {monster.hp} PV
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Monster Statblock Column */}
          {selectedMonster ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-obsidian">
              {/* Statblock Title Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-2xl font-bold text-parchment">
                      {selectedMonster.name}
                    </h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                      ND {selectedMonster.cr} ({selectedMonster.xp.toLocaleString()} XP)
                    </span>
                  </div>
                  <p className="text-xs text-parchment/60 font-mono italic mt-0.5">
                    {selectedMonster.size} {selectedMonster.type.toLowerCase()}, {selectedMonster.alignment}
                  </p>
                </div>

                {/* Direct Spawn Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSpawnMonster(selectedMonster, false)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transition-transform hover:scale-105"
                    title="Inserir criatura diretamente no mapa de masmorra como visível"
                  >
                    <Plus size={14} />
                    <span>Inserir no Mapa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSpawnMonster(selectedMonster, true)}
                    className="px-3 py-2 rounded-xl bg-black/60 hover:bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                    title="Inserir criatura de forma Oculta (Invisível aos jogadores até ser revelada)"
                  >
                    <EyeOff size={14} className="text-purple-400" />
                    <span className="hidden lg:inline">Inserir Oculto</span>
                  </button>
                </div>
              </div>

              {/* Vitals Summary: AC, HP, Speed */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] font-mono uppercase text-parchment/50 flex items-center justify-center gap-1">
                    <Shield size={12} className="text-arcane" />
                    <span>Classe de Armadura</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-arcane mt-0.5">
                    {selectedMonster.ac}
                  </div>
                  <div className="text-[9px] text-parchment/40 font-mono">Armadura Natural</div>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] font-mono uppercase text-parchment/50 flex items-center justify-center gap-1">
                    <Heart size={12} className="text-rose-400" />
                    <span>Pontos de Vida</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">
                    {selectedMonster.hp} <span className="text-xs text-parchment/50 font-normal">({selectedMonster.hitDice})</span>
                  </div>
                  <div className="text-[9px] text-parchment/40 font-mono">PV Máximos</div>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] font-mono uppercase text-parchment/50 flex items-center justify-center gap-1">
                    <Compass size={12} className="text-amber-400" />
                    <span>Deslocamento</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-amber-300 mt-1 truncate">
                    {selectedMonster.speed}
                  </div>
                  <div className="text-[9px] text-parchment/40 font-mono">Espaço: {selectedMonster.gridSize}x{selectedMonster.gridSize} cel</div>
                </div>
              </div>

              {/* Attributes Matrix */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                <div className="grid grid-cols-6 gap-2 text-center text-xs font-mono">
                  {[
                    { label: 'FOR', val: selectedMonster.stats.for },
                    { label: 'AGI', val: selectedMonster.stats.agi },
                    { label: 'CON', val: selectedMonster.stats.con },
                    { label: 'INT', val: selectedMonster.stats.int },
                    { label: 'PER', val: selectedMonster.stats.per },
                    { label: 'COR', val: selectedMonster.stats.cor },
                  ].map(stat => {
                    const mod = Math.floor((stat.val - 10) / 2);
                    const modSign = mod >= 0 ? `+${mod}` : `${mod}`;
                    return (
                      <div key={stat.label} className="p-2 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-[10px] text-parchment/40 font-bold block">{stat.label}</span>
                        <span className="font-bold text-parchment text-sm">{stat.val}</span>
                        <span className="text-[10px] text-arcane block">({modSign})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Traits & Senses */}
              <div className="space-y-1 text-xs font-mono text-parchment/80 border-b border-white/10 pb-3">
                {selectedMonster.savingThrows && <div><strong className="text-arcane">Testes de Resistência:</strong> {selectedMonster.savingThrows}</div>}
                {selectedMonster.damageResistances && selectedMonster.damageResistances.length > 0 && <div><strong className="text-amber-300">Resistências a Dano:</strong> {selectedMonster.damageResistances.join(', ')}</div>}
                {selectedMonster.damageImmunities && selectedMonster.damageImmunities.length > 0 && <div><strong className="text-rose-400">Imunidades a Dano:</strong> {selectedMonster.damageImmunities.join(', ')}</div>}
                {selectedMonster.conditionImmunities && selectedMonster.conditionImmunities.length > 0 && <div><strong className="text-rose-400">Imunidades a Condições:</strong> {selectedMonster.conditionImmunities.join(', ')}</div>}
                <div><strong className="text-parchment">Sentidos:</strong> {selectedMonster.senses}</div>
                <div><strong className="text-parchment">Idiomas:</strong> {selectedMonster.languages}</div>
              </div>

              {/* Special Traits */}
              {selectedMonster.traits && selectedMonster.traits.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-serif font-bold text-sm text-amber-300 flex items-center gap-1.5 border-b border-white/10 pb-1">
                    <Sparkles size={14} />
                    <span>Habilidades Especiais & Traços</span>
                  </h4>
                  {selectedMonster.traits.map((trait, idx) => (
                    <div key={idx} className="text-xs font-mono leading-relaxed bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                      <strong className="text-amber-200">{trait.name}.</strong> <span className="text-parchment/80">{trait.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions & Attack Rolls */}
              <div className="space-y-2 pt-2">
                <h4 className="font-serif font-bold text-sm text-rose-400 flex items-center gap-1.5 border-b border-white/10 pb-1">
                  <Swords size={14} />
                  <span>Ações & Ataques (Clique para rolar)</span>
                </h4>
                <div className="space-y-2">
                  {selectedMonster.actions.map((action, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                      <div>
                        <strong className="text-rose-300 text-sm font-serif">{action.name}.</strong>
                        <p className="text-parchment/70 text-[11px] mt-0.5">{action.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRollAction(action)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-all shadow-sm"
                        title="Rolar ataque e dano desta ação no combate"
                      >
                        <Dices size={13} />
                        <span>Rolar Ação</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flavor Description */}
              {selectedMonster.description && (
                <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/20 text-xs font-mono text-purple-200/80 leading-relaxed italic">
                  "{selectedMonster.description}"
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-parchment/40 text-xs font-mono">
              Selecione uma criatura na lista ao lado para ver sua ficha completa.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
