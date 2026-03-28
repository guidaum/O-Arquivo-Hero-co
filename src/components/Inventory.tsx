import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Backpack, 
  Sword, 
  Shield, 
  FlaskConical, 
  Scroll, 
  Coins, 
  Weight, 
  Trash2, 
  Plus, 
  Info, 
  ChevronRight, 
  Zap,
  X,
  ArrowLeft,
  Minus,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db, doc, getDoc, setDoc, updateDoc } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';

export default function Inventory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = searchParams.get('id');

  const categories = [
    { id: 'weapons', label: 'Armas', icon: Sword, color: 'text-ember' },
    { id: 'armor', label: 'Armaduras', icon: Shield, color: 'text-arcane' },
    { id: 'consumables', label: 'Consumíveis', icon: FlaskConical, color: 'text-gold' },
    { id: 'misc', label: 'Diversos', icon: Scroll, color: 'text-parchment' },
  ];

  const [character, setCharacter] = React.useState<any>(null);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState('weapons');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isMoneyModalOpen, setIsMoneyModalOpen] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);
  const [moneyAmount, setMoneyAmount] = React.useState(0);
  const [newItem, setNewItem] = React.useState({
    name: '',
    category: 'misc',
    rarity: 'Comum',
    weight: 0,
    value: 0,
    stats: '',
    description: '',
    quantity: 1,
    ammo: '-',
    damage: '',
    defense: 0,
    equipped: false
  });

  React.useEffect(() => {
    const fetchCharacter = async () => {
      if (!characterId) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'characters', characterId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCharacter(data);
          // Ensure items have necessary fields for the Inventory UI
          const mappedItems = (data.equipment || []).map((item: any) => ({
            ...item,
            id: item.id || Math.random().toString(36).substring(2, 9),
            category: item.category || (item.defense > 0 ? 'armor' : item.damage ? 'weapons' : 'misc'),
            rarity: item.rarity || 'Comum',
            weight: item.weight || 0,
            value: item.value || 0,
            stats: item.stats || (item.damage ? `Dano: ${item.damage}` : item.defense ? `Defesa: +${item.defense}` : ''),
            image: item.image || `https://picsum.photos/seed/${item.name}/100/100`
          }));
          setItems(mappedItems);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `characters/${characterId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacter();
  }, [characterId]);

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const saveToFirestore = async (updatedItems: any[]) => {
    if (!characterId || !character) return;
    try {
      await updateDoc(doc(db, 'characters', characterId), {
        equipment: updatedItems
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleUpdateMoney = async (amount: number) => {
    if (!characterId || !character) return;
    const currentMoney = character.money || 0;
    const newMoney = Math.max(0, currentMoney + amount);
    
    try {
      await updateDoc(doc(db, 'characters', characterId), {
        money: newMoney
      });
      setCharacter({ ...character, money: newMoney });
      setIsMoneyModalOpen(false);
      setMoneyAmount(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const [sortBy, setSortBy] = React.useState('Raridade');
  const [filterRarity, setFilterRarity] = React.useState('Todas');

  const handleAddItem = async () => {
    if (newItem.name.trim()) {
      const itemToAdd = {
        ...newItem,
        id: Math.random().toString(36).substring(2, 9),
        image: `https://picsum.photos/seed/${newItem.name}/100/100`
      };
      const updatedItems = [...items, itemToAdd];
      setItems(updatedItems);
      await saveToFirestore(updatedItems);
      setSaveStatus('Item adicionado');
      setIsModalOpen(false);
      setNewItem({
        name: '',
        category: 'misc',
        rarity: 'Comum',
        weight: 0,
        value: 0,
        stats: '',
        description: '',
        quantity: 1,
        ammo: '-',
        damage: '',
        defense: 0,
        equipped: false
      });
    }
  };

  const removeItem = async (id: string | number) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    await saveToFirestore(updatedItems);
    setSaveStatus('Item removido');
  };

  const toggleEquip = async (id: string | number) => {
    const item = items.find(i => i.id === id);
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, equipped: !item.equipped } : item
    );
    setItems(updatedItems);
    await saveToFirestore(updatedItems);
    setSaveStatus(item?.equipped ? 'Item desequipado' : 'Item equipado');
  };

  const filteredItems = items
    .filter(item => item.category === activeCategory)
    .filter(item => filterRarity === 'Todas' || item.rarity === filterRarity)
    .sort((a, b) => {
      if (sortBy === 'Raridade') {
        const rarities = ['Comum', 'Incomum', 'Raro', 'Lendário'];
        return rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity);
      }
      if (sortBy === 'Peso') return b.weight - a.weight;
      if (sortBy === 'Valor') return b.value - a.value;
      return 0;
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-arcane/20 border-t-arcane rounded-full animate-spin" />
      </div>
    );
  }

  if (!characterId) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center p-4">
        <div className="glass p-10 rounded-[3rem] text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-ember/10 text-ember rounded-full flex items-center justify-center mx-auto">
            <Info size={40} />
          </div>
          <h2 className="text-3xl font-serif">Personagem não encontrado</h2>
          <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Selecione um personagem no painel para ver seu inventário.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all border border-white/10"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header & Stats */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            onClick={() => navigate(`/sheet?id=${characterId}`)}
            className="p-3 sm:p-4 glass rounded-2xl hover:bg-white/10 transition-all text-parchment/40 hover:text-parchment group shrink-0"
          >
            <ArrowLeft size={20} sm:size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1 sm:mb-2">
              <h2 className="text-2xl sm:text-4xl font-serif leading-tight">Inventário de {character?.name}</h2>
              <AnimatePresence>
                {saveStatus && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-arcane/10 border border-arcane/20 text-arcane text-[10px] font-mono uppercase tracking-widest"
                  >
                    <Check size={10} />
                    {saveStatus}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-parchment/40 font-mono text-[10px] sm:text-sm uppercase tracking-widest">Os Espólios da Aventura</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="glass p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-gold/10 text-gold">
                <Coins size={18} sm:size={20} />
              </div>
              <div>
                <p className="text-[8px] sm:text-[10px] text-parchment/40 font-mono uppercase tracking-widest">Dinheiro</p>
                <p className="text-base sm:text-lg font-serif">{character?.money || 0} <span className="text-xs text-gold">GPs</span></p>
                <p className="text-[8px] text-parchment/20 font-mono uppercase tracking-widest mt-0.5">Total: {(character?.money || 0) + items.reduce((acc, item) => acc + (item.value || 0), 0)} GPs</p>
              </div>
            </div>
            <button 
              onClick={() => setIsMoneyModalOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gold"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="glass p-3 sm:p-4 rounded-2xl flex items-center gap-4 w-full sm:w-auto">
            <div className="p-2 rounded-xl bg-arcane/10 text-arcane">
              <Weight size={18} sm:size={20} />
            </div>
            <div>
              <p className="text-[8px] sm:text-[10px] text-parchment/40 font-mono uppercase tracking-widest">Carga</p>
              <p className="text-base sm:text-lg font-serif">{items.reduce((acc, item) => acc + (item.weight || 0), 0).toFixed(1)} / 150 <span className="text-xs text-arcane">LB</span></p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Categories Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-10 h-fit">
          <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Categorias</h4>
          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex-shrink-0 lg:w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group",
                  activeCategory === cat.id 
                    ? "glass-arcane text-arcane border border-arcane/30" 
                    : "glass text-parchment/60 hover:text-parchment hover:bg-white/10"
                )}
              >
                <div className="flex items-center gap-3">
                  <cat.icon size={18} sm:size={20} className={cn(
                    "transition-transform group-hover:scale-110",
                    activeCategory === cat.id ? cat.color : "text-parchment/40"
                  )} />
                  <span className="font-medium text-sm sm:text-base whitespace-nowrap">{cat.label}</span>
                </div>
                <ChevronRight size={16} className={cn(
                  "hidden lg:block transition-transform",
                  activeCategory === cat.id ? "rotate-90" : "opacity-0 group-hover:opacity-100"
                )} />
              </button>
            ))}
          </nav>

          <div className="pt-2 lg:pt-6">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full py-4 glass border border-dashed border-white/10 rounded-2xl text-parchment/40 hover:text-parchment hover:border-white/20 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={16} />
              <span>Adicionar Item</span>
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif flex items-center gap-3">
              <Backpack className="text-arcane" size={24} />
              {categories.find(c => c.id === activeCategory)?.label}
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-parchment/40">FILTRAR:</span>
                <select 
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-arcane/50"
                >
                  <option value="Todas">Todas as Raridades</option>
                  <option value="Comum">Comum</option>
                  <option value="Incomum">Incomum</option>
                  <option value="Raro">Raro</option>
                  <option value="Lendário">Lendário</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-parchment/40">ORDENAR POR:</span>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-arcane/50"
                >
                  <option value="Raridade">Raridade</option>
                  <option value="Peso">Peso</option>
                  <option value="Valor">Valor</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="glass p-5 rounded-3xl group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30 cursor-pointer"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 relative">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/60 to-transparent",
                      item.rarity === 'Legendary' ? "bg-gold/20" : 
                      item.rarity === 'Rare' ? "bg-arcane/20" : "bg-white/5"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-serif text-lg">{item.name}</h5>
                      <span className={cn(
                        "text-[8px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-widest",
                        item.rarity === 'Lendário' ? "bg-gold/10 text-gold border border-gold/20" :
                        item.rarity === 'Raro' ? "bg-arcane/10 text-arcane border border-arcane/20" :
                        "bg-white/5 text-parchment/40 border border-white/10"
                      )}>
                        {item.rarity}
                      </span>
                    </div>
                    <p className="text-[10px] text-arcane font-mono mb-2">{item.stats}</p>
                    <div className="flex items-center gap-4 text-[10px] text-parchment/40 font-mono">
                      <span className="flex items-center gap-1"><Weight size={10} /> {item.weight} LB</span>
                      <span className="flex items-center gap-1"><Coins size={10} /> {item.value} Dinheiro</span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEquip(item.id);
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        item.equipped ? "bg-arcane/20 text-arcane" : "hover:bg-white/5 text-parchment/40 hover:text-arcane"
                      )}
                    >
                      <Zap size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(`${item.name}\n\n${item.description || 'Sem descrição.'}\n\n${item.stats}`);
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-parchment/40 hover:text-gold"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    className="p-2 hover:bg-ember/10 rounded-lg transition-colors text-parchment/40 hover:text-ember"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}

            {filteredItems.length === 0 && (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-dashed border-white/10">
                  <Backpack size={32} className="text-parchment/20" />
                </div>
                <div>
                  <p className="text-parchment/40 font-serif text-xl">Sua bolsa está vazia...</p>
                  <p className="text-xs font-mono text-parchment/20">Vá em frente e encontre algum saque!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Money Management Modal */}
      <AnimatePresence>
        {isMoneyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoneyModalOpen(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gold/10 text-gold">
                    <Coins size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif">Gerenciar Dinheiro</h3>
                    <p className="text-parchment/40 font-mono text-[10px] uppercase tracking-widest">Saldo Atual: {character?.money || 0} GPs</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMoneyModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-parchment/40 uppercase tracking-widest ml-1">Quantidade</label>
                  <input 
                    type="number"
                    value={moneyAmount}
                    onChange={(e) => setMoneyAmount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-gold/50 text-xl font-serif"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleUpdateMoney(moneyAmount)}
                    className="py-4 bg-gold/20 hover:bg-gold/30 text-gold rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    Adicionar
                  </button>
                  <button 
                    onClick={() => handleUpdateMoney(-moneyAmount)}
                    className="py-4 bg-ember/20 hover:bg-ember/30 text-ember rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Minus size={20} />
                    Remover
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass rounded-[2.5rem] overflow-hidden border border-white/10"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-arcane/10 text-arcane">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif">Adicionar Item Personalizado</h2>
                    <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Crie um novo item para o seu inventário</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-parchment/40 hover:text-parchment"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Item</label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="Ex: Escudo de Escamas de Dragão"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Categoria</label>
                      <select
                        value={newItem.category}
                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50 appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-obsidian">{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Raridade</label>
                      <select
                        value={newItem.rarity}
                        onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50 appearance-none"
                      >
                        <option value="Comum" className="bg-obsidian">Comum</option>
                        <option value="Incomum" className="bg-obsidian">Incomum</option>
                        <option value="Raro" className="bg-obsidian">Raro</option>
                        <option value="Lendário" className="bg-obsidian">Lendário</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Peso (LB)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newItem.weight}
                        onChange={e => setNewItem({ ...newItem, weight: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Valor (Dinheiro)</label>
                      <input
                        type="number"
                        value={newItem.value}
                        onChange={e => setNewItem({ ...newItem, value: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Atributos / Descrição</label>
                    <textarea
                      value={newItem.description}
                      onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="Ex: +2 CA, Resistência a Fogo"
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                      <input
                        type="text"
                        value={newItem.damage}
                        onChange={e => setNewItem({ ...newItem, damage: e.target.value })}
                        placeholder="Ex: 1d8+3"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Defesa</label>
                      <input
                        type="number"
                        value={newItem.defense}
                        onChange={e => setNewItem({ ...newItem, defense: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddItem}
                  className="w-full py-4 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-arcane/20"
                >
                  Adicionar ao Inventário
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
