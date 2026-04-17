import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dice1, 
  Dice2, 
  Dice3, 
  Dice4, 
  Dice5, 
  Dice6, 
  History, 
  Trash2, 
  X, 
  ChevronUp, 
  ChevronDown,
  Sparkles,
  Zap
} from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { auth, db, collection, addDoc, doc, getDoc } from '../firebase';
import { cn } from '../lib/utils';

type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

interface RollResult {
  id: string;
  timestamp: number;
  dieType: DieType;
  quantity: number;
  modifier: number;
  rolls: number[];
  total: number;
}

export default function DiceRoller() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [quantity, setQuantity] = React.useState(1);
  const [modifier, setModifier] = React.useState(0);
  const [history, setHistory] = React.useState<RollResult[]>([]);
  const [isRolling, setIsRolling] = React.useState(false);
  const [lastRoll, setLastRoll] = React.useState<RollResult | null>(null);

  React.useEffect(() => {
    const pathParts = location.pathname.split('/');
    if (pathParts[1] === 'gm' && pathParts[2] === 'session' && pathParts[3]) {
      setSessionId(pathParts[3]);
    } else {
      const charId = searchParams.get('id');
      if (charId && location.pathname === '/sheet') {
        getDoc(doc(db, 'characters', charId)).then(docSnap => {
          if (docSnap.exists()) {
            setSessionId(docSnap.data().sessionId || null);
          }
        });
      } else {
        setSessionId(null);
      }
    }
  }, [location, searchParams]);

  const diceTypes: { type: DieType; label: string }[] = [
    { type: 4, label: 'D4' },
    { type: 6, label: 'D6' },
    { type: 8, label: 'D8' },
    { type: 10, label: 'D10' },
    { type: 12, label: 'D12' },
    { type: 20, label: 'D20' },
    { type: 100, label: 'D100' },
  ];

  const handleRoll = (dieType: DieType) => {
    setIsRolling(true);
    
    // Simulate rolling delay
    setTimeout(() => {
      const rolls = Array.from({ length: quantity }, () => Math.floor(Math.random() * dieType) + 1);
      const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
      
      const result: RollResult = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        dieType,
        quantity,
        modifier,
        rolls,
        total,
      };

      setLastRoll(result);
      setHistory(prev => [result, ...prev].slice(0, 20));
      setIsRolling(false);

      // Send to chat if in session
      if (sessionId && auth.currentUser) {
        addDoc(collection(db, 'chatMessages'), {
          sessionId,
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Anônimo',
          senderPhoto: auth.currentUser.photoURL || '',
          text: `Rolou ${quantity}d${dieType}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}: ${total}`,
          type: 'roll',
          rollData: {
            total,
            formula: `${quantity}d${dieType}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`,
            details: `[${rolls.join(', ')}]${modifier !== 0 ? ` ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}` : ''}`,
            rolls: [{ die: `${quantity}d${dieType}`, values: rolls }]
          },
          createdAt: new Date().toISOString()
        });
      }
    }, 600);
  };

  const clearHistory = () => {
    setHistory([]);
    setLastRoll(null);
  };

  return (
    <div className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 glass rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-arcane/20 rounded-lg text-arcane">
                  <Dice6 size={18} />
                </div>
                <h3 className="font-serif text-lg">Rolador de Dados</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-parchment/40 hover:text-parchment"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
              {/* Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-1">Quantidade</label>
                  <div className="flex items-center glass rounded-xl overflow-hidden border border-white/10">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 hover:bg-white/5 text-parchment/60"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <input 
                      type="number" 
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent text-center font-mono text-sm focus:outline-none"
                    />
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2 hover:bg-white/5 text-parchment/60"
                    >
                      <ChevronUp size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-1">Modificador</label>
                  <div className="flex items-center glass rounded-xl overflow-hidden border border-white/10">
                    <button 
                      onClick={() => setModifier(modifier - 1)}
                      className="p-2 hover:bg-white/5 text-parchment/60"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <input 
                      type="number" 
                      value={modifier}
                      onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                      className="w-full bg-transparent text-center font-mono text-sm focus:outline-none"
                    />
                    <button 
                      onClick={() => setModifier(modifier + 1)}
                      className="p-2 hover:bg-white/5 text-parchment/60"
                    >
                      <ChevronUp size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dice Grid */}
              <div className="grid grid-cols-4 gap-2">
                {diceTypes.map((die) => (
                  <button
                    key={die.type}
                    onClick={() => handleRoll(die.type)}
                    disabled={isRolling}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all",
                      "bg-white/5 border-white/10 hover:bg-arcane/10 hover:border-arcane/30 text-parchment/60 hover:text-arcane",
                      isRolling && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-xs font-bold">{die.label}</span>
                  </button>
                ))}
              </div>

              {/* Last Roll Result */}
              <AnimatePresence mode="wait">
                {lastRoll && (
                  <motion.div
                    key={lastRoll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-arcane/20 to-ember/10 border border-white/10 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Resultado</span>
                      <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                        {lastRoll.quantity}d{lastRoll.dieType}{lastRoll.modifier !== 0 ? (lastRoll.modifier > 0 ? ` + ${lastRoll.modifier}` : ` - ${Math.abs(lastRoll.modifier)}`) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-4xl font-serif text-glow-arcane">{lastRoll.total}</div>
                      {lastRoll.rolls.length > 1 && (
                        <div className="text-xs text-parchment/40 font-mono">
                          ({lastRoll.rolls.join(' + ')}{lastRoll.modifier !== 0 ? ` ${lastRoll.modifier > 0 ? '+' : '-'} ${Math.abs(lastRoll.modifier)}` : ''})
                        </div>
                      )}
                    </div>
                    
                    {/* Critical/Fumble Indicators for D20 */}
                    {lastRoll.dieType === 20 && lastRoll.rolls[0] === 20 && (
                      <div className="absolute top-0 right-0 p-1 bg-gold/20 text-gold rounded-bl-lg">
                        <Sparkles size={12} />
                      </div>
                    )}
                    {lastRoll.dieType === 20 && lastRoll.rolls[0] === 1 && (
                      <div className="absolute top-0 right-0 p-1 bg-ember/20 text-ember rounded-bl-lg">
                        <Zap size={12} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* History */}
              {history.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-parchment/40">
                      <History size={14} />
                      <span className="text-[10px] font-mono uppercase tracking-widest">Histórico</span>
                    </div>
                    <button 
                      onClick={clearHistory}
                      className="text-parchment/20 hover:text-ember transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {history.slice(0, 5).map((roll) => (
                      <div key={roll.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5 border border-white/5">
                        <span className="text-parchment/40 font-mono">
                          {roll.quantity}d{roll.dieType}{roll.modifier !== 0 ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ''}
                        </span>
                        <span className={cn(
                          "font-bold",
                          roll.dieType === 20 && roll.rolls[0] === 20 ? "text-gold" : 
                          roll.dieType === 20 && roll.rolls[0] === 1 ? "text-ember" : "text-parchment"
                        )}>
                          {roll.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border",
          isOpen 
            ? "bg-ember border-ember/50 text-obsidian" 
            : "bg-arcane border-arcane/50 text-obsidian"
        )}
      >
        {isOpen ? <X size={24} /> : <Dice6 size={24} />}
      </motion.button>
    </div>
  );
}
