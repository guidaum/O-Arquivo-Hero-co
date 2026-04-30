import React from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
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
  Check,
  Dice6,
  Sparkles,
  GripVertical,
  Pencil,
  ShoppingBag,
  ShoppingCart,
  Search,
  Target,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn, rollDiceFormula } from '../lib/utils';
import { auth, db, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, onSnapshot } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';

export default function Inventory({ hideHeader = false }: { hideHeader?: boolean }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = searchParams.get('id');

  const categories = [
    { id: 'weapons', label: 'Armas', icon: Sword, color: 'text-ember' },
    { id: 'armor', label: 'Armaduras', icon: Shield, color: 'text-arcane' },
    { id: 'ammo', label: 'Munição', icon: Target, color: 'text-gold' },
    { id: 'consumables', label: 'Consumíveis', icon: FlaskConical, color: 'text-ember' },
    { id: 'misc', label: 'Diversos', icon: Scroll, color: 'text-parchment' },
  ];

  const [character, setCharacter] = React.useState<any>(null);
  const [session, setSession] = React.useState<any>(null);
  const [globalSettings, setGlobalSettings] = React.useState<any>(null);
  const [items, setItems] = React.useState<any[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState('weapons');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isShopOpen, setIsShopOpen] = React.useState(false);
  const [confirmingItem, setConfirmingItem] = React.useState<any>(null);
  const [selectedShopItem, setSelectedShopItem] = React.useState<any>(null);
  const [purchaseQuantity, setPurchaseQuantity] = React.useState(1);
  const [shopCategory, setShopCategory] = React.useState('all');
  const [shopSearch, setShopSearch] = React.useState('');
  const [modalMode, setModalMode] = React.useState<'add' | 'edit'>('add');
  const [editingItemId, setEditingItemId] = React.useState<string | number | null>(null);
  const [isMoneyModalOpen, setIsMoneyModalOpen] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [moneyAmount, setMoneyAmount] = React.useState(0);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [newItem, setNewItem] = React.useState({
    name: '',
    category: 'misc',
    rarity: 'Comum',
    weight: 0,
    value: 0,
    stats: {} as Record<string, number>,
    description: '',
    quantity: 1,
    ammo: '-',
    damage: '',
    defense: 0,
    equipped: false,
    image: '',
    relatedWeapons: [] as string[]
  });

  const [quickRoll, setQuickRoll] = React.useState<{ result: number, total: number, name: string } | null>(null);

  const sendRollToChat = async (label: string, result: any, success?: boolean) => {
    if (!character?.sessionId || !auth.currentUser) return;

    try {
      const rollData: any = {
        total: result.total,
        formula: result.detail,
        details: result.rolls.map((r: any) => `${r.die}: [${r.values.join(', ')}]`).join(' | '),
        rolls: result.rolls
      };

      if (success !== undefined) {
        rollData.success = success;
      }

      await addDoc(collection(db, 'chatMessages'), {
        sessionId: character.sessionId,
        senderId: auth.currentUser.uid,
        senderName: character.name || auth.currentUser.displayName || 'Anônimo',
        senderPhoto: character.image || auth.currentUser.photoURL || '',
        text: `Rolou ${label}: ${result.total}`,
        type: 'roll',
        rollData,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending roll to chat:', err);
    }
  };

  const handleQuickRoll = async (item: any) => {
    const { name, damage, catalogId } = item;
    if (!damage || !character) return;
    
    // Check for ammo requirements
    // A weapon requires ammo if any ammo item in either catalog or inventory is linked to it
    const linkedAmmoInCatalog = catalogItems.filter(i => i.category === 'ammo' && i.relatedWeapons?.includes(catalogId));
    const linkedAmmoInInventory = items.filter(i => i.category === 'ammo' && i.relatedWeapons?.includes(catalogId));
    
    const isAmmoRequired = linkedAmmoInCatalog.length > 0 || linkedAmmoInInventory.length > 0;

    if (isAmmoRequired) {
      // Find suitable ammo in inventory
      const compatibleAmmo = items.find(i => 
        i.category === 'ammo' && 
        (i.relatedWeapons?.includes(catalogId) || 
         linkedAmmoInCatalog.some(a => a.id === i.catalogId)) && 
        (i.quantity || 1) > 0
      );

      if (!compatibleAmmo) {
        setSaveStatus({ type: 'error', message: `FALHA: Sem munição para ${name}!` });
        if (character.sessionId && auth.currentUser) {
          await addDoc(collection(db, 'chatMessages'), {
            sessionId: character.sessionId,
            senderId: auth.currentUser.uid,
            senderName: character.name || 'Herói',
            senderPhoto: character.image || '',
            text: `⚠️ A arma de ${character.name} (${name}) falhou! Está sem munição.`,
            type: 'system',
            createdAt: new Date().toISOString()
          });
        }
        return;
      }

      // Consume 1 ammo
      try {
        let updatedItems;
        if ((compatibleAmmo.quantity || 1) > 1) {
          updatedItems = items.map(i => i.id === compatibleAmmo.id ? { ...i, quantity: i.quantity - 1 } : i);
        } else {
          updatedItems = items.filter(i => i.id !== compatibleAmmo.id);
        }

        setItems(updatedItems);
        await updateDoc(doc(db, 'characters', characterId!), {
          equipment: updatedItems
        });
        
        if ((compatibleAmmo.quantity || 1) <= 1) {
          setSaveStatus({ type: 'error', message: `Munição ESGOTADA: ${compatibleAmmo.name}!` });
          if (character.sessionId && auth.currentUser) {
            await addDoc(collection(db, 'chatMessages'), {
              sessionId: character.sessionId,
              senderId: auth.currentUser.uid,
              senderName: character.name || 'Herói',
              senderPhoto: character.image || '',
              text: `❗ A munição (${compatibleAmmo.name}) de ${character.name} acabou!`,
              type: 'system',
              createdAt: new Date().toISOString()
            });
          }
        } else {
          setSaveStatus({ type: 'info', message: `Munição consumida: ${compatibleAmmo.name} (-1)` });
        }
      } catch (err) {
        console.error("Erro ao consumir munição:", err);
        return;
      }
    }

    // Proceed with roll
    const currentStats: Record<string, number> = {};
    const stats = character.stats || {};
    const mods = character.statsMods || {};
    
    // Include base stats + mods
    Object.keys(stats).forEach(key => {
      currentStats[key.toUpperCase()] = (stats[key] || 0) + (mods[key] || 0);
    });

    const result = rollDiceFormula(damage, currentStats);
    setQuickRoll({ result: result.total, total: result.total, name });
    sendRollToChat(name, result);
    setTimeout(() => setQuickRoll(null), 5000);
  };

  React.useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    // Characters real-time sync
    const unsubscribeChar = onSnapshot(doc(db, 'characters', characterId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCharacter(data);
        const mappedItems = (data.equipment || []).map((item: any) => ({
          ...item,
          id: item.id || Math.random().toString(36).substring(2, 9),
          category: item.category || (item.defense > 0 ? 'armor' : item.damage ? 'weapons' : 'misc'),
          rarity: item.rarity || 'Comum',
          weight: item.weight || 0,
          value: item.value || 0,
          stats: typeof item.stats === 'object' ? item.stats : {},
          image: item.image || `https://picsum.photos/seed/${item.name}/100/100`
        }));
        setItems(mappedItems);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `characters/${characterId}`);
      setLoading(false);
    });

    // Global Settings
    getDoc(doc(db, 'globalSettings', 'config')).then(snap => {
      if (snap.exists()) setGlobalSettings(snap.data());
    });

    return () => unsubscribeChar();
  }, [characterId]);

  // Session sync
  React.useEffect(() => {
    if (!character?.sessionId) return;

    const unsubscribeSession = onSnapshot(doc(db, 'gameSessions', character.sessionId), (snap) => {
      if (snap.exists()) {
        setSession(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `gameSessions/${character.sessionId}`);
    });

    return () => unsubscribeSession();
  }, [character?.sessionId]);

  // Catalog sync
  React.useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'itemCatalog'));
        let catalog = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter by session shop settings if available
        if (session?.shopItemIds && session.shopItemIds.length > 0) {
          catalog = catalog.filter(item => session.shopItemIds.includes(item.id));
        }

        setCatalogItems(catalog);
      } catch (err) {
        console.error('Error fetching catalog:', err);
      }
    };
    
    fetchCatalog();
  }, [session?.shopItemIds]);

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

  const saveToCatalog = async (item: any) => {
    try {
      const catalogId = item.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!catalogId) return;

      await setDoc(doc(db, 'itemCatalog', catalogId), {
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        weight: item.weight,
        value: item.value,
        stats: item.stats,
        description: item.description,
        damage: item.damage,
        defense: item.defense,
        image: item.image,
        lastUpdated: new Date().toISOString(),
        createdBy: character?.name || auth.currentUser?.displayName || 'Anônimo'
      }, { merge: true });
    } catch (err) {
      console.error('Error saving to catalog:', err);
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

  const handlePurchase = (catalogItem: any) => {
    if (!characterId || !character) return;
    
    const itemValue = catalogItem.value || 0;
    if (itemValue > (character.money || 0)) {
      const funnyFailMessages = [
        "Seu bolso tem um eco maior que o Grande Cânion.",
        "Acho que você esqueceu de conferir o saldo da sua conta de rabanetes.",
        "O vendedor olhou para as suas moedas imaginárias e deu risada.",
        "MO não nasce em árvore, aventureiro!",
        "Sua carteira está mais vazia que a cabeça de um ogro.",
        "Tente pagar com gratidão. Spoiler: não funcionou.",
        "Você sacudiu a bolsa e só saiu poeira e uma teia de aranha.",
        "Saldo insuficiente. Deseja tentar pagar com um poema épico? O mercador disse que não aceita rimas pobres.",
        "Sua bolsa está tão leve que ela quase flutuou para longe. Traga moedas de verdade na próxima!",
        "O mercador te deu um abraço de consolação. Mas o item continua custando o mesmo.",
        "Você tentou convencer o mercador de que é o 'escolhido'. Ele disse que até o 'escolhido' tem que pagar as contas.",
        "Olhando para sua bolsa, parece que você gastou tudo em poções de invisibilidade... para o seu dinheiro.",
        "Erro 404: Ouro não encontrado.",
        "Suas economias atuais permitem comprar: um fio de cabelo de goblin e uma pedra sem graça. Este item não.",
        "O vendedor perguntou se você aceita lavar os pratos por um mês. Talvez assim você consiga.",
        "Sua conta bancária mágica foi bloqueada por excesso de... falta de depósitos.",
        "Você ofereceu amizade em troca do item. O mercador disse que prefere ouro."
      ];
      const randomMessage = funnyFailMessages[Math.floor(Math.random() * funnyFailMessages.length)];
      setSaveStatus({ type: 'error', message: `${randomMessage} (Preço: ${itemValue} MO, Você tem: ${character.money || 0} MO)` });
      return;
    }

    setConfirmingItem(catalogItem);
    setPurchaseQuantity(1);
  };

  const confirmPurchase = async () => {
    if (!confirmingItem || !characterId || !character) return;
    
    const qty = (confirmingItem.category === 'ammo' || confirmingItem.category === 'consumables') ? purchaseQuantity : 1;
    const itemValue = (confirmingItem.value || 0) * qty;
    
    try {
      let updatedInventory = [...items];
      const isStackable = confirmingItem.category === 'ammo' || confirmingItem.category === 'consumables';
      
      if (isStackable) {
        const existingItemIndex = updatedInventory.findIndex(i => i.catalogId === confirmingItem.id || i.name === confirmingItem.name);
        if (existingItemIndex > -1) {
          updatedInventory[existingItemIndex] = {
            ...updatedInventory[existingItemIndex],
            quantity: (updatedInventory[existingItemIndex].quantity || 1) + qty
          };
        } else {
          const newItem = {
            ...confirmingItem,
            catalogId: confirmingItem.id,
            id: Math.random().toString(36).substring(2, 9),
            quantity: qty,
            equipped: false,
            stats: confirmingItem.stats || {}
          };
          updatedInventory.push(newItem);
        }
      } else {
        const newItem = {
          ...confirmingItem,
          catalogId: confirmingItem.id,
          id: Math.random().toString(36).substring(2, 9),
          quantity: 1,
          equipped: false,
          stats: confirmingItem.stats || {}
        };
        updatedInventory.push(newItem);
      }

      const newMoney = (character.money || 0) - itemValue;

      await updateDoc(doc(db, 'characters', characterId), {
        equipment: updatedInventory,
        money: newMoney
      });

      setItems(updatedInventory);
      setCharacter({ ...character, money: newMoney });
      setSaveStatus({ 
        type: 'success', 
        message: `${qty > 1 ? qty + 'x ' : ''}${confirmingItem.name} adquirido com sucesso! (-${itemValue} MO)` 
      });
      setConfirmingItem(null);
      setPurchaseQuantity(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const [sortBy, setSortBy] = React.useState('Manual');
  const [filterRarity, setFilterRarity] = React.useState('Todas');

  const handleReorder = async (newOrder: any[]) => {
    // We only update if we are in Manual sort mode
    if (sortBy !== 'Manual') {
      setSortBy('Manual');
    }

    const updatedItems = [...items];
    
    // Find index in main items array for each filtered item currently being reordered
    const visibleItemIds = filteredItems.map(i => i.id);
    const indicesInMaster = [];
    
    for (let i = 0; i < items.length; i++) {
      if (visibleItemIds.includes(items[i].id)) {
        indicesInMaster.push(i);
      }
    }

    // Replace items at those master indices with the new order
    indicesInMaster.forEach((masterIdx, orderIdx) => {
      updatedItems[masterIdx] = newOrder[orderIdx];
    });

    setItems(updatedItems);
    await saveToFirestore(updatedItems);
  };

  const handleSaveItem = async () => {
    if (newItem.name.trim()) {
      const itemData = {
        ...newItem,
        image: newItem.image.trim() || `https://picsum.photos/seed/${newItem.name}/100/100`
      };

      let updatedItems = [...items];
      const isStackable = itemData.category === 'ammo' || itemData.category === 'consumables';

      if (modalMode === 'edit' && editingItemId !== null) {
        updatedItems = items.map(item => 
          item.id === editingItemId ? { ...itemData, id: editingItemId } : item
        );
        setSaveStatus({ type: 'success', message: 'Item atualizado' });
      } else if (isStackable) {
        const existingItemIndex = updatedItems.findIndex(i => i.name.toLowerCase() === itemData.name.toLowerCase() && i.category === itemData.category);
        if (existingItemIndex > -1) {
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: (updatedItems[existingItemIndex].quantity || 1) + (itemData.quantity || 1)
          };
          setSaveStatus({ type: 'success', message: 'Quantidade adicionada ao item existente!' });
        } else {
          updatedItems.push({
            ...itemData,
            id: Math.random().toString(36).substring(2, 9)
          });
          setSaveStatus({ type: 'success', message: 'Item adicionado' });
        }
      } else {
        const itemToAdd = {
          ...itemData,
          id: Math.random().toString(36).substring(2, 9)
        };
        updatedItems.push(itemToAdd);
        setSaveStatus({ type: 'success', message: 'Item adicionado' });
      }
      
      setItems(updatedItems);
      await saveToFirestore(updatedItems);
      await saveToCatalog(itemData);
      setIsModalOpen(false);
      resetNewItem();
    }
  };

  const resetNewItem = () => {
    setNewItem({
      name: '',
      category: 'misc',
      rarity: 'Comum',
      weight: 0,
      value: 0,
      stats: {},
      description: '',
      quantity: 1,
      ammo: '-',
      damage: '',
      defense: 0,
      equipped: false,
      image: '',
      relatedWeapons: []
    });
    setEditingItemId(null);
    setModalMode('add');
    setTouched({});
  };

  const openAddModal = () => {
    resetNewItem();
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setNewItem({ ...item });
    setEditingItemId(item.id);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const removeItem = async (id: string | number) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    await saveToFirestore(updatedItems);
    setSaveStatus({ type: 'success', message: 'Item removido' });
  };

  const useItem = async (id: string | number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if ((item.quantity || 1) > 1) {
      const updatedItems = items.map(i => 
        i.id === id ? { ...i, quantity: (i.quantity || 1) - 1 } : i
      );
      setItems(updatedItems);
      await saveToFirestore(updatedItems);
      setSaveStatus({ type: 'success', message: `Você usou um ${item.name}. Restam ${(item.quantity || 1) - 1}.` });
    } else {
      const updatedItems = items.filter(i => i.id !== id);
      setItems(updatedItems);
      await saveToFirestore(updatedItems);
      setSaveStatus({ type: 'success', message: `Você usou o último ${item.name}.` });
    }
  };

  const toggleEquip = async (id: string | number) => {
    const item = items.find(i => i.id === id);
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, equipped: !item.equipped } : item
    );
    setItems(updatedItems);
    await saveToFirestore(updatedItems);
    setSaveStatus({ type: 'success', message: item?.equipped ? 'Item desequipado' : 'Item equipado' });
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
      return 0; // 'Manual' uses the original array order
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
      <AnimatePresence>
        {saveStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl",
              saveStatus.type === 'success' ? "bg-arcane/90 border-arcane/20 text-obsidian" : 
              saveStatus.type === 'error' ? "bg-ember/90 border-ember/20 text-white" : 
              "bg-white/90 border-white/20 text-obsidian"
            )}
          >
            {saveStatus.type === 'success' ? (
              <div className="flex items-center gap-2">
                {saveStatus.message.includes('MO') ? <Coins size={20} className="text-obsidian" /> : <Check size={20} />}
              </div>
            ) : 
             saveStatus.type === 'error' ? <X size={20} /> : 
             <Info size={20} />}
            <span className="font-bold">{saveStatus.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Stats */}
      {!hideHeader && (
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
                <p className="text-base sm:text-lg font-serif">{character?.money || 0} <span className="text-xs text-gold">MO</span></p>
                <p className="text-[8px] text-parchment/20 font-mono uppercase tracking-widest mt-0.5">Total: {(character?.money || 0) + items.reduce((acc, item) => acc + (item.value || 0), 0)} MO</p>
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
              <p className="text-base sm:text-lg font-serif">{items.reduce((acc, item) => acc + (item.weight || 0), 0).toFixed(1)} / 150 <span className="text-xs text-arcane">KG</span></p>
            </div>
          </div>
        </div>
      </header>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Categories Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-10 h-fit">
          <div className="flex items-center justify-between px-4">
            <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Navegação</h4>
          </div>
          
          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar">
            {/* Shop Shortcut */}
            {(session?.shopEnabled !== false) && (
              <>
                <button
                  onClick={() => setIsShopOpen(true)}
                  className="flex-shrink-0 lg:w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group glass bg-gold/5 border border-gold/20 text-gold hover:bg-gold/10"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart size={18} sm:size={20} className="transition-transform group-hover:scale-110" />
                    <span className="font-medium text-sm sm:text-base whitespace-nowrap font-serif tracking-wide">Mercado & Loja</span>
                  </div>
                  <div className="hidden lg:flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gold/40">VISITAR</span>
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </button>

                <div className="hidden lg:block h-px bg-white/5 my-2" />
              </>
            )}

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
              onClick={openAddModal}
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
                  <option value="Manual">Manual</option>
                  <option value="Raridade">Raridade</option>
                  <option value="Peso">Peso</option>
                  <option value="Valor">Valor</option>
                </select>
              </div>
            </div>
          </div>

          <Reorder.Group 
            axis="y" 
            values={filteredItems} 
            onReorder={handleReorder}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {filteredItems.map((item, idx) => (
              <Reorder.Item
                key={item.id}
                value={item}
                dragListener={sortBy === 'Manual'}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "glass p-5 rounded-3xl group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30 cursor-pointer",
                  sortBy !== 'Manual' && "cursor-default"
                )}
              >
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-2">
                    {sortBy === 'Manual' && (
                      <div className="text-parchment/20 group-hover:text-parchment/40 cursor-grab active:cursor-grabbing">
                        <GripVertical size={20} />
                      </div>
                    )}
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 relative shrink-0">
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
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-serif text-lg">{item.name}</h5>
                        {item.quantity && item.quantity > 1 && (
                          <span className="bg-gold text-obsidian text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-lg shadow-gold/20">
                            {item.quantity}x
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-[8px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-widest",
                        item.rarity === 'Lendário' ? "bg-gold/10 text-gold border border-gold/20" :
                        item.rarity === 'Raro' ? "bg-arcane/10 text-arcane border border-arcane/20" :
                        "bg-white/5 text-parchment/40 border border-white/10"
                      )}>
                        {item.rarity}
                      </span>
                    </div>
                    <p className="text-[10px] text-arcane font-mono mb-2">
                      {item.stats && typeof item.stats === 'object' 
                        ? Object.entries(item.stats)
                            .filter(([_, val]) => Number(val) !== 0)
                            .map(([key, val]) => `${key.toUpperCase()}: ${Number(val) > 0 ? '+' : ''}${val}`)
                            .join(' | ')
                        : ''}
                    </p>
                    {item.category === 'ammo' && item.relatedWeapons?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.relatedWeapons.map((weaponId: string) => {
                          const weapon = catalogItems.find(i => i.id === weaponId);
                          return weapon ? (
                            <span key={weaponId} className="text-[8px] font-mono text-arcane/60 uppercase border border-arcane/20 px-1.5 py-0.5 rounded bg-arcane/5">
                              {weapon.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-[10px] text-parchment/40 font-mono">
                      <span className="flex items-center gap-1"><Weight size={10} /> {item.weight} KG</span>
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
                        handleQuickRoll(item);
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-parchment/40 hover:text-arcane"
                      title="Rolar Dano"
                    >
                      <Dice6 size={16} />
                    </button>
                    {(item.category === 'consumables' || item.category === 'ammo') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          useItem(item.id);
                        }}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gold hover:text-white"
                        title="Usar / Consumir"
                      >
                        <Zap size={16} className="fill-gold/10" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEquip(item.id);
                      }}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        item.equipped ? "bg-arcane/20 text-arcane" : "hover:bg-white/5 text-parchment/40 hover:text-arcane"
                      )}
                      title={item.equipped ? "Desequipar" : "Equipar"}
                    >
                      <Check size={16} className={cn(item.equipped ? "opacity-100" : "opacity-30")} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(item);
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-parchment/40 hover:text-arcane"
                      title="Editar Item"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        let statsSummary = '';
                        if (item.stats && typeof item.stats === 'object') {
                          const entries = Object.entries(item.stats);
                          if (entries.length > 0) {
                            statsSummary = '\n\nModificadores:\n' + entries
                              .map(([key, val]) => {
                                const v = Number(val) || 0;
                                return `${key.toUpperCase()}: ${v > 0 ? '+' : ''}${v}`;
                              })
                              .join(', ');
                          }
                        }
                        setSaveStatus({ 
                          type: 'info', 
                          message: `${item.name}: ${item.description || 'Sem descrição.'}${statsSummary}` 
                        });
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
                    className="p-2.5 bg-ember/10 text-ember rounded-xl hover:bg-ember hover:text-obsidian transition-all shadow-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              </Reorder.Item>
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
          </Reorder.Group>
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
                    <p className="text-parchment/40 font-mono text-[10px] uppercase tracking-widest">Saldo Atual: {character?.money || 0} MO</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMoneyModalOpen(false)}
                  className="p-3 hover:bg-white/10 rounded-2xl transition-colors text-parchment/40 hover:text-parchment"
                >
                  <X size={24} />
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
                    {modalMode === 'edit' ? <Pencil size={24} /> : <Plus size={24} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif">{modalMode === 'edit' ? 'Editar Item' : 'Adicionar Item Personalizado'}</h2>
                    <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                      {modalMode === 'edit' ? 'Modifique os detalhes do seu item' : 'Crie um novo item para o seu inventário'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 hover:bg-white/10 rounded-2xl transition-colors text-parchment/40 hover:text-parchment"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Item</label>
                      <input
                        type="text"
                        value={newItem.name}
                        onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                        onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                        placeholder="Ex: Escudo de Escamas de Dragão"
                        className={cn(
                          "w-full bg-white/5 border rounded-xl px-4 py-2 text-sm focus:outline-none transition-colors",
                          touched.name && !newItem.name.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                        )}
                      />
                      {touched.name && !newItem.name.trim() && (
                        <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O nome do item é obrigatório</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">URL da Imagem</label>
                      <input
                        type="text"
                        value={newItem.image}
                        onChange={e => setNewItem({ ...newItem, image: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-arcane/50 font-mono"
                      />
                    </div>
                  </div>

                  {newItem.category === 'ammo' && (
                    <div className="space-y-2 px-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest block">Armas Compatíveis (No Catálogo)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto no-scrollbar glass p-3 rounded-xl border border-white/5">
                        {catalogItems.filter(i => i.category === 'weapons').map(weapon => (
                          <label key={weapon.id} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                            <input 
                              type="checkbox"
                              checked={newItem.relatedWeapons?.includes(weapon.id)}
                              onChange={e => {
                                const current = newItem.relatedWeapons || [];
                                if (e.target.checked) {
                                  setNewItem({ ...newItem, relatedWeapons: [...current, weapon.id] });
                                } else {
                                  setNewItem({ ...newItem, relatedWeapons: current.filter(id => id !== weapon.id) });
                                }
                              }}
                              className="w-4 h-4 rounded border-white/10 bg-white/5 text-arcane focus:ring-arcane/50"
                            />
                            <span className="text-[10px] text-parchment/60 group-hover:text-parchment transition-colors truncate">{weapon.name}</span>
                          </label>
                        ))}
                        {catalogItems.filter(i => i.category === 'weapons').length === 0 && (
                          <p className="text-[10px] text-parchment/40 italic p-1">Nenhuma arma cadastrada no sistema.</p>
                        )}
                      </div>
                    </div>
                  )}

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
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Peso (KG)</label>
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

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificadores de Atributo</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(globalSettings?.attributes || [
                        { id: 'for', label: 'For' },
                        { id: 'con', label: 'Con' },
                        { id: 'agi', label: 'Agi' },
                        { id: 'per', label: 'Per' },
                        { id: 'vel', label: 'Vel' },
                        { id: 'ini', label: 'Ini' },
                        { id: 'int', label: 'Int' },
                        { id: 'cor', label: 'Cor' }
                      ]).map((attr: any) => (
                        <div key={attr.id} className="space-y-1">
                          <label className="text-[9px] font-mono text-parchment/30 uppercase tracking-tighter ml-1">{attr.label || attr.id.toUpperCase()}</label>
                          <input
                            type="number"
                            value={newItem.stats[attr.id] || 0}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              const newStats = { ...newItem.stats };
                              if (val === 0) {
                                delete newStats[attr.id];
                              } else {
                                newStats[attr.id] = val;
                              }
                              setNewItem({ ...newItem, stats: newStats });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-arcane/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição Adicional</label>
                    <textarea
                      value={newItem.description}
                      onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="Ex: Resistência a Fogo, Brilha no escuro..."
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
                  onClick={handleSaveItem}
                  className="w-full py-4 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-arcane/20"
                >
                  {modalMode === 'edit' ? 'Salvar Alterações' : 'Adicionar ao Inventário'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shop Modal */}
      <AnimatePresence>
        {isShopOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShopOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col relative z-10"
            >
              {/* Shop Header */}
              <div className="p-8 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif text-parchment">Loja de Itens</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                        Mercado de {globalSettings?.campaignName || 'Aventureiro'}
                      </p>
                      <div className="flex items-center gap-1 text-gold">
                        <Coins size={12} />
                        <span className="text-xs font-mono">{character?.money || 0} MO</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsShopOpen(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Shop Filters */}
              <div className="px-8 flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6">
                <div className="relative flex-1 group w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20 group-focus-within:text-gold transition-colors" size={18} />
                  <input
                    type="text"
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    placeholder="Buscar itens no mercado..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-3 text-sm focus:outline-none focus:border-gold/50 transition-colors"
                  />
                  {(shopSearch || shopCategory !== 'all') && (
                    <button 
                      onClick={() => { setShopSearch(''); setShopCategory('all'); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-parchment/60 hover:text-parchment transition-all"
                      title="Limpar filtros"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar w-full lg:w-auto">
                  {['all', ...new Set(catalogItems.map(item => item.category))].filter(Boolean).map(cat => (
                    <button
                      key={cat as string}
                      onClick={() => setShopCategory(cat as string)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[9px] font-mono uppercase tracking-widest transition-all whitespace-nowrap border",
                        shopCategory === cat 
                          ? "bg-gold/10 border-gold/40 text-gold shadow-lg shadow-gold/5" 
                          : "bg-white/5 border-white/10 text-parchment/40 hover:text-parchment hover:bg-white/10"
                      )}
                    >
                      {cat === 'all' ? 'Ver Tudo' : categories.find(c => c.id === cat)?.label || cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Empty State */}
              {catalogItems
                .filter(item => shopCategory === 'all' || item.category === shopCategory)
                .filter(item => !shopSearch || item.name.toLowerCase().includes(shopSearch.toLowerCase()) || item.description?.toLowerCase().includes(shopSearch.toLowerCase()))
                .length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-parchment/20 mb-4">
                    <Search size={32} />
                  </div>
                  <h4 className="text-xl font-serif text-parchment/60 mb-2">Nenhum item encontrado</h4>
                  <p className="text-sm text-parchment/40 max-w-xs">
                    Tente ajustar sua busca ou categoria para encontrar o que procura.
                  </p>
                </div>
              )}

              {/* Shop Grid */}
              <div className="flex-1 overflow-y-auto p-8 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 no-scrollbar">
                {catalogItems
                  .filter(item => shopCategory === 'all' || item.category === shopCategory)
                  .filter(item => !shopSearch || item.name.toLowerCase().includes(shopSearch.toLowerCase()) || item.description?.toLowerCase().includes(shopSearch.toLowerCase()))
                  .map((catalogItem) => (
                    <div 
                      key={catalogItem.id}
                      onClick={() => setSelectedShopItem(catalogItem)}
                      className="glass p-5 rounded-3xl border border-white/5 hover:border-gold/30 transition-all group flex flex-col cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Info size={14} className="text-gold/40" />
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 group-hover:scale-110 transition-transform">
                          <img 
                            src={catalogItem.image || `https://picsum.photos/seed/${catalogItem.name}/150/150`} 
                            alt={catalogItem.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-serif text-lg leading-tight truncate group-hover:text-gold transition-colors">{catalogItem.name}</h4>
                            <span className={cn(
                              "text-[8px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest border shrink-0",
                              catalogItem.rarity === 'Legendary' ? "text-gold border-gold/50 bg-gold/10" :
                              catalogItem.rarity === 'Rare' ? "text-arcane border-arcane/50 bg-arcane/10" :
                              catalogItem.rarity === 'Uncommon' ? "text-ember border-ember/50 bg-ember/10" :
                              "text-parchment/60 border-white/10"
                            )}>
                              {catalogItem.rarity || 'Common'}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-parchment/40 uppercase mb-2">
                            {categories.find(c => c.id === catalogItem.category)?.label || catalogItem.category || 'Geral'} • {catalogItem.weight || 0}kg
                          </p>
                          <p className="text-xs text-parchment/60 leading-relaxed line-clamp-2 italic mb-2">
                            {catalogItem.description || 'Nenhuma descrição disponível.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 mt-auto border-t border-white/5">
                        <div className="flex items-center gap-2 text-gold">
                          <Coins size={16} />
                          <span className="font-serif text-lg">{catalogItem.value || 0} MO</span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePurchase(catalogItem); }}
                          disabled={catalogItem.value > (character?.money || 0)}
                          className={cn(
                            "px-4 py-2 rounded-xl flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest transition-all",
                            catalogItem.value > (character?.money || 0) 
                              ? "bg-white/5 text-parchment/20 cursor-not-allowed" 
                              : "bg-gold text-obsidian font-bold shadow-lg shadow-gold/20 hover:scale-105 active:scale-95"
                          )}
                        >
                          <ShoppingCart size={14} />
                          Comprar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item Detail Modal (Shop Integration) */}
      <AnimatePresence>
        {selectedShopItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedShopItem(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass max-w-2xl w-full rounded-[3rem] border border-white/10 shadow-3xl relative z-10 overflow-hidden flex flex-col"
            >
              <div className="relative h-64 sm:h-80 w-full overflow-hidden">
                <img 
                  src={selectedShopItem.image || `https://picsum.photos/seed/${selectedShopItem.name}/600/400`} 
                  alt={selectedShopItem.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/40 to-transparent" />
                
                <button 
                  onClick={() => setSelectedShopItem(null)}
                  className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-xl transition-all text-parchment"
                >
                  <X size={20} />
                </button>

                <div className="absolute bottom-6 left-8 right-8">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn(
                      "text-[10px] font-mono px-3 py-1 rounded-full uppercase tracking-[0.2em] border shadow-lg backdrop-blur-sm",
                      selectedShopItem.rarity === 'Legendary' ? "text-gold border-gold/50 bg-gold/10" :
                      selectedShopItem.rarity === 'Rare' ? "text-arcane border-arcane/50 bg-arcane/10" :
                      selectedShopItem.rarity === 'Uncommon' ? "text-ember border-ember/50 bg-ember/10" :
                      "text-parchment/60 border-white/10"
                    )}>
                      {selectedShopItem.rarity || 'Comum'}
                    </span>
                    <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
                      {categories.find(c => c.id === selectedShopItem.category)?.label || selectedShopItem.category || 'Geral'}
                    </span>
                  </div>
                  <h3 className="text-4xl font-serif text-parchment text-glow-white mb-1">{selectedShopItem.name}</h3>
                </div>
              </div>

              <div className="p-8 pb-10 flex flex-col gap-8">
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-1">
                    <Coins size={16} className="text-gold mb-1" />
                    <span className="text-lg font-serif text-parchment">{selectedShopItem.value || 0}</span>
                    <span className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Valor</span>
                  </div>
                  <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-1">
                    <Weight size={16} className="text-ember mb-1" />
                    <span className="text-lg font-serif text-parchment">{selectedShopItem.weight || 0}kg</span>
                    <span className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Peso</span>
                  </div>
                  <div className="glass p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-1">
                    <Shield size={16} className="text-arcane mb-1" />
                    <span className="text-lg font-serif text-parchment">{selectedShopItem.defense || 0}</span>
                    <span className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Defesa</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h5 className="text-[10px] font-mono text-gold/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <span className="w-8 h-px bg-gold/20" /> Atributos e Bônus
                    </h5>
                    {selectedShopItem.stats && Object.keys(selectedShopItem.stats).length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedShopItem.stats).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/5 hover:border-gold/10 transition-colors">
                            <span className="text-[10px] font-mono text-parchment/60 uppercase">{k}</span>
                            <span className="text-sm font-serif text-gold">{Number(v) > 0 ? '+' : ''}{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-parchment/40 italic">Nenhum bônus de atributo concedido por este item.</p>
                    )}
                  </div>

                  {selectedShopItem.category === 'ammo' && selectedShopItem.relatedWeapons?.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-mono text-gold/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                         <span className="w-8 h-px bg-gold/20" /> Armas Compatíveis
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedShopItem.relatedWeapons.map((weaponId: string) => {
                          const weapon = catalogItems.find(i => i.id === weaponId);
                          return weapon ? (
                            <span key={weaponId} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-parchment/60 font-mono">
                              {weapon.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="text-[10px] font-mono text-gold/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                       <span className="w-8 h-px bg-gold/20" /> Lore & Descrição
                    </h5>
                    <p className="text-sm text-parchment/60 leading-relaxed italic border-l-2 border-gold/20 pl-4 py-1">
                      {selectedShopItem.description || 'Uma relíquia misteriosa encontrada em locais esquecidos. Suas origens exatas são desconhecidas até mesmo pelos sábios mais renomados.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => { setSelectedShopItem(null); handlePurchase(selectedShopItem); }}
                    disabled={selectedShopItem.value > (character?.money || 0)}
                    className={cn(
                      "flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-[10px] transition-all shadow-xl",
                      selectedShopItem.value > (character?.money || 0) 
                        ? "bg-white/5 text-parchment/20 border border-white/10 cursor-not-allowed" 
                        : "bg-gold text-obsidian shadow-gold/20 hover:scale-[1.02] active:scale-95"
                    )}
                  >
                    <ShoppingCart size={18} />
                    Adquirir Item
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmingItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingItem(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass max-w-md w-full rounded-[2.5rem] border border-gold/30 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-gold/10 rounded-3xl mx-auto flex items-center justify-center text-gold mb-6 border border-gold/20">
                  <ShoppingCart size={32} />
                </div>
                <h3 className="text-2xl font-serif text-parchment mb-2 text-glow-gold">Confirmar Compra</h3>
                <p className="text-sm text-parchment/60 mb-6 leading-relaxed">
                  Você deseja adquirir <span className="text-gold font-bold italic">{confirmingItem.name}</span> por <span className="text-gold font-bold">{confirmingItem.value} MO</span>?
                </p>

                {(confirmingItem.category === 'ammo' || confirmingItem.category === 'consumables') && (
                  <div className="mb-8 p-4 glass rounded-2xl border border-white/5 space-y-3">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest block text-left px-2">Quantidade</label>
                    <div className="flex items-center justify-between bg-black/20 rounded-xl p-2 border border-white/5">
                      <button 
                        onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-parchment/40 hover:text-parchment"
                      >
                        <Minus size={20} />
                      </button>
                      
                      <div className="flex flex-col items-center">
                        <input 
                          type="number"
                          value={purchaseQuantity}
                          onChange={(e) => setPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 bg-transparent text-center font-serif text-2xl text-gold focus:outline-none"
                        />
                        <span className="text-[8px] font-mono text-parchment/20 uppercase tracking-[0.2em] -mt-1">Unidades</span>
                      </div>

                      <button 
                        onClick={() => setPurchaseQuantity(purchaseQuantity + 1)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors text-parchment/40 hover:text-parchment"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-2 pt-2 text-[10px] font-mono">
                      <span className="text-parchment/30 uppercase">Total:</span>
                      <span className="text-gold font-bold">{(confirmingItem.value || 0) * purchaseQuantity} MO</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmPurchase}
                    className="w-full py-4 bg-gold text-obsidian rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-gold/20"
                  >
                    Selar Transação
                  </button>
                  <button
                    onClick={() => setConfirmingItem(null)}
                    className="w-full py-4 bg-white/5 text-parchment/60 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all border border-white/10"
                  >
                    Mudar de Ideia
                  </button>
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gold/20">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full bg-gold"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Roll Result Notification */}
      <AnimatePresence>
        {quickRoll && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] glass px-6 py-3 rounded-2xl border border-arcane/30 shadow-2xl flex items-center gap-4"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{quickRoll.name}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif text-glow-arcane">{quickRoll.total}</span>
                <span className="text-xs text-parchment/40 font-mono">Resultado</span>
              </div>
            </div>
            <Sparkles className="text-gold animate-bounce" size={20} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
