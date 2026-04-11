import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Sword, 
  Zap, 
  Brain, 
  Eye, 
  Heart, 
  Scroll, 
  BookOpen, 
  Backpack, 
  Star, 
  History, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Edit3, 
  Share2, 
  Download,
  Flame,
  Target,
  Activity,
  ArrowLeft,
  Dice6,
  Sparkles,
  Coins,
  X,
  Filter
} from 'lucide-react';
import { cn, evaluateFormula } from '../lib/utils';
import { auth, db, doc, getDoc, onSnapshot, setDoc, OperationType, handleFirestoreError, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from '../firebase';

const iconMap: Record<string, any> = {
  Shield, Sword, Zap, Flame, Eye, Brain, Heart, Activity, Scroll, Dice6, Sparkles
};

export default function CharacterSheet() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = searchParams.get('id');
  
  const [character, setCharacter] = React.useState<any>(null);
  const [session, setSession] = React.useState<any>(null);
  const [userRole, setUserRole] = React.useState<'player' | 'gm' | null>(null);
  const [availableSessions, setAvailableSessions] = React.useState<any[]>([]);
  const [isJoiningSession, setIsJoiningSession] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const [inventory, setInventory] = React.useState<any[]>([]);
  const [characterSkills, setCharacterSkills] = React.useState<string[]>([]);
  const [characterPowers, setCharacterPowers] = React.useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = React.useState<any[]>([]);
  const [availablePowers, setAvailablePowers] = React.useState<any[]>([]);
  const [currentPV, setCurrentPV] = React.useState(0);
  const [currentATP, setCurrentATP] = React.useState(0);
  const [protecao, setProtecao] = React.useState(0);
  const [sanidade, setSanidade] = React.useState(7);
  const [despertar, setDespertar] = React.useState(0);
  const [stats, setStats] = React.useState<Record<string, number>>({});
  const [attributePoints, setAttributePoints] = React.useState(0);
  const [statsMods, setStatsMods] = React.useState<Record<string, number>>({});
  const [canEditStats, setCanEditStats] = React.useState(false);
  const [talentMods, setTalentMods] = React.useState<Record<string, number>>({});
  const [talents, setTalents] = React.useState<any[]>([]);
  const [activeCategory, setActiveCategory] = React.useState('geral');
  const [activeSection, setActiveSection] = React.useState('stats');
  const [isInventoryOpen, setIsInventoryOpen] = React.useState(false);

  const isGM = userRole === 'gm';
  const isOwner = character?.ownerId === auth.currentUser?.uid;
  const canPlayerEdit = isGM || (isOwner && canEditStats);

  const [newEquip, setNewEquip] = React.useState({
    name: '',
    description: '',
    quantity: 1,
    ammo: '-',
    damage: '',
    defense: 0,
    equipped: false
  });

  const [isAddingSkill, setIsAddingSkill] = React.useState(false);
  const [isAddingPower, setIsAddingPower] = React.useState(false);
  const [newSkill, setNewSkill] = React.useState({
    name: '',
    type: 'Luta',
    atp: 0,
    damage: '',
    description: ''
  });

  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('Todos');

  const filteredAvailableSkills = availableSkills.filter(s => 
    !characterSkills.includes(s.id) &&
    (searchTerm === '' || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (typeFilter === 'Todos' || s.type === typeFilter)
  );

  const filteredAvailablePowers = availablePowers.filter(p => 
    !characterPowers.includes(p.id) &&
    (searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (typeFilter === 'Todos' || p.type === typeFilter)
  );

  const [globalSettings, setGlobalSettings] = React.useState<any>(null);

  React.useEffect(() => {
    const settingsRef = doc(db, 'globalSettings', 'config');
    const unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });
    return () => unsubscribeSettings();
  }, []);

  React.useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'characters', characterId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCharacter(data);
        
        // Initialize baseStats for older characters to prevent point farming
        if (!data.baseStats && data.stats) {
          updateDoc(doc(db, 'characters', characterId), { baseStats: data.stats });
        }
        
        // Fetch session if linked
        if (data.sessionId) {
          getDoc(doc(db, 'gameSessions', data.sessionId)).then(sessionSnap => {
            if (sessionSnap.exists()) {
              const sessionData = { id: sessionSnap.id, ...sessionSnap.data() } as any;
              setSession(sessionData);
              if (sessionData && auth.currentUser) {
                if (sessionData.gmId === auth.currentUser.uid) {
                  setUserRole('gm');
                } else if (sessionData.playerIds?.includes(auth.currentUser.uid)) {
                  setUserRole('player');
                }
              }
            }
          });
        } else {
          setSession(null);
          setUserRole(data.ownerId === auth.currentUser?.uid ? 'player' : null);
        }

        const loadedInventory = (data.equipment || []).map((item: any) => ({
          ...item,
          id: item.id || Math.random().toString(36).substring(2, 9),
          category: item.category || (item.defense > 0 ? 'armor' : item.damage ? 'weapons' : 'misc')
        }));
        setInventory(loadedInventory);
        
        setCharacterSkills(data.skills || []);
        setCharacterPowers(data.powers || []);
        
        // Initial values if not present
        const charStats = data.stats || {};
        const charStatsMods = data.statsMods || {};
        setStats(charStats);
        setAttributePoints(data.attributePoints || 0);
        setStatsMods(charStatsMods);
        setCanEditStats(data.canEditStats ?? false);
        setTalentMods(data.talentMods || {});

        const getVal = (id: string) => (charStats[id] || 0) + (charStatsMods[id] || 0);
        
        // Use global settings for max PV/ATP if available
        const pvFormula = globalSettings?.pvFormula || '((FOR / 2) + CON) * 10';
        const atpFormula = globalSettings?.atpFormula || '(INT + 3) * 3';
        
        const statsForFormula: Record<string, number> = {
          FOR: getVal('for'),
          CON: getVal('con'),
          AGI: getVal('agi'),
          PER: getVal('per'),
          VEL: getVal('vel'),
          INI: getVal('ini'),
          INT: getVal('int'),
          COR: getVal('cor'),
          LUTA: (data.skills || []).length, // Simplified for initial calc
          MISTICA: (data.skills || []).length, // Simplified for initial calc
        };

        const maxPV = evaluateFormula(pvFormula, statsForFormula);
        const maxATP = evaluateFormula(atpFormula, statsForFormula);
        
        setCurrentPV(data.currentPV ?? maxPV);
        setCurrentATP(data.currentATP ?? maxATP);
        setProtecao(data.protecao ?? 0);
        setSanidade(Math.min(7, data.sanidade ?? 7));
        setDespertar(Math.min(7, data.despertar ?? 0));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `characters/${characterId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [characterId, globalSettings]);

  const armorItems = inventory.filter(item => item.equipped && (item.category === 'armor' || item.category === 'Armadura' || item.defense > 0));
  const armorBonus = armorItems.reduce((acc, item) => acc + (item.defense || 0), 0);
  
  // The total protection is the current value of the slider (protecao)
  // which represents the active protection within the limit of equipped armor.
  const totalProtecao = protecao;

  // Adjust protection value if it exceeds the current armor bonus
  React.useEffect(() => {
    if (protecao > armorBonus) {
      setProtecao(armorBonus);
    }
  }, [armorBonus, protecao]);

  React.useEffect(() => {
    const talentsQuery = query(collection(db, 'talents'));
    const unsubscribeTalents = onSnapshot(talentsQuery, (snapshot) => {
      const talentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTalents(talentData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'talents');
    });

    const skillsQuery = query(collection(db, 'skills'));
    const unsubscribeSkills = onSnapshot(skillsQuery, (snapshot) => {
      const skillData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableSkills(skillData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'skills');
    });

    const powersQuery = query(collection(db, 'powers'));
    const unsubscribePowers = onSnapshot(powersQuery, (snapshot) => {
      const powerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailablePowers(powerData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'powers');
    });

    return () => {
      unsubscribeTalents();
      unsubscribeSkills();
      unsubscribePowers();
    };
  }, []);

  const handleSave = async (updatedData?: any) => {
    if (!characterId || !character) return;
    try {
      // Use updateDoc to only update the fields that changed, 
      // preventing overwriting points added by GM if character state is stale.
      const dataToUpdate = {
        equipment: inventory,
        skills: characterSkills,
        powers: characterPowers,
        currentPV,
        currentATP,
        protecao,
        sanidade,
        despertar,
        stats,
        attributePoints,
        statsMods,
        canEditStats,
        talentMods,
        ...updatedData
      };
      await updateDoc(doc(db, 'characters', characterId), dataToUpdate);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleAddEquip = async () => {
    if (newEquip.name.trim()) {
      const itemToAdd = { 
        ...newEquip, 
        id: Math.random().toString(36).substring(2, 9) 
      };
      const updatedInventory = [...inventory, itemToAdd];
      setInventory(updatedInventory);
      
      // Auto-save inventory change
      await handleSave({ equipment: updatedInventory });
      
      // Reset form
      setNewEquip({ 
        name: '', 
        description: '', 
        quantity: 1, 
        ammo: '-', 
        damage: '', 
        defense: 0, 
        equipped: false 
      });
    }
  };

  const toggleEquip = async (id: string) => {
    const updatedInventory = inventory.map(item => 
      item.id === id ? { ...item, equipped: !item.equipped } : item
    );
    setInventory(updatedInventory);
    await handleSave({ equipment: updatedInventory });
  };

  const removeInventoryItem = async (id: string) => {
    const updatedInventory = inventory.filter(item => item.id !== id);
    setInventory(updatedInventory);
    await handleSave({ equipment: updatedInventory });
  };

  const handleAddSkillFromLibrary = async (skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    if (!skill) return;

    const currentPoints = character.skillPoints || 0;
    if (currentPoints < skill.purchaseCost) {
      alert('Pontos de perícia insuficientes!');
      return;
    }

    const newSkills = [...characterSkills, skillId];
    setCharacterSkills(newSkills);
    await handleSave({ 
      skills: newSkills,
      skillPoints: currentPoints - skill.purchaseCost
    });
  };

  const handleRemoveSkill = async (skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    const newSkills = characterSkills.filter(id => id !== skillId);
    setCharacterSkills(newSkills);
    
    const currentPoints = character.skillPoints || 0;
    const refund = skill ? skill.purchaseCost : 0;

    await handleSave({ 
      skills: newSkills,
      skillPoints: currentPoints + refund
    });
  };

  const handleAddPowerFromLibrary = async (powerId: string) => {
    const power = availablePowers.find(p => p.id === powerId);
    if (!power) return;

    const currentPoints = character.powerPoints || 0;
    if (currentPoints < power.purchaseCost) {
      alert('Pontos de poder insuficientes!');
      return;
    }

    const newPowers = [...characterPowers, powerId];
    setCharacterPowers(newPowers);
    await handleSave({ 
      powers: newPowers,
      powerPoints: currentPoints - power.purchaseCost
    });
  };

  const handleRemovePower = async (powerId: string) => {
    const power = availablePowers.find(p => p.id === powerId);
    const newPowers = characterPowers.filter(id => id !== powerId);
    setCharacterPowers(newPowers);

    const currentPoints = character.powerPoints || 0;
    const refund = power ? power.purchaseCost : 0;

    await handleSave({ 
      powers: newPowers,
      powerPoints: currentPoints + refund
    });
  };

  const handleJoinSession = async (sessionId: string) => {
    if (!characterId) return;
    try {
      await updateDoc(doc(db, 'characters', characterId), { sessionId });
      setIsJoiningSession(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleLeaveSession = async () => {
    if (!characterId) return;
    try {
      await updateDoc(doc(db, 'characters', characterId), { sessionId: null });
      setSession(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const fetchAvailableSessions = async () => {
    if (!auth.currentUser) return;
    try {
      // Fetch sessions where user is Player
      const qPlayer = query(collection(db, 'gameSessions'), where('playerIds', 'array-contains', auth.currentUser.uid));
      const playerSnapshot = await getDocs(qPlayer);
      const playerSessions = playerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'player' }));

      // Fetch sessions where user is GM
      const qGm = query(collection(db, 'gameSessions'), where('gmId', '==', auth.currentUser.uid));
      const gmSnapshot = await getDocs(qGm);
      const gmSessions = gmSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'gm' }));

      const allSessions = [...playerSessions, ...gmSessions];
      setAvailableSessions(allSessions);
      setIsJoiningSession(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'gameSessions');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-arcane/20 border-t-arcane rounded-full animate-spin" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-serif mb-4">Lenda não encontrada</h2>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-arcane hover:underline"
        >
          <ArrowLeft size={20} />
          Voltar para o Dashboard
        </button>
      </div>
    );
  }

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link da ficha copiado para a área de transferência!');
  };

  const handleDownload = () => {
    if (!character) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(character, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${character.name}_ficha.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleEditImage = async () => {
    if (!character || !characterId) return;
    
    // Permission check
    const isOwner = character.ownerId === auth.currentUser?.uid;
    const isGM = userRole === 'gm';
    const canEdit = isGM || (isOwner && canEditStats);
    
    if (!canEdit) {
      alert('Você não tem permissão para editar a imagem deste personagem.');
      return;
    }

    const newImage = prompt('Insira a URL da nova imagem do personagem:', character.image || '');
    if (newImage !== null && newImage !== character.image) {
      try {
        await updateDoc(doc(db, 'characters', characterId), { image: newImage });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `characters/${characterId}`);
      }
    }
  };

  const attributes = [
    { id: 'for', label: 'Força', icon: Sword, value: stats.for || 0, mod: statsMods.for || 0, color: 'text-ember' },
    { id: 'con', label: 'Constituição', icon: Shield, value: stats.con || 0, mod: statsMods.con || 0, color: 'text-ember' },
    { id: 'agi', label: 'Agilidade', icon: Zap, value: stats.agi || 0, mod: statsMods.agi || 0, color: 'text-arcane' },
    { id: 'per', label: 'Percepção', icon: Eye, value: stats.per || 0, mod: statsMods.per || 0, color: 'text-gold' },
    { id: 'vel', label: 'Velocidade', icon: Zap, value: stats.vel || 0, mod: statsMods.vel || 0, color: 'text-arcane' },
    { id: 'ini', label: 'Iniciativa', icon: Zap, value: stats.ini || 0, mod: statsMods.ini || 0, color: 'text-gold' },
    { id: 'int', label: 'Inteligência', icon: Brain, value: stats.int || 0, mod: statsMods.int || 0, color: 'text-arcane' },
    { id: 'cor', label: 'Coragem', icon: Heart, value: stats.cor || 0, mod: statsMods.cor || 0, color: 'text-ember' },
  ];

  const equippedItems = inventory.filter(i => i.equipped);


  const getAttr = (id: string) => {
    const attr = attributes.find(a => a.id === id);
    return (attr?.value || 0) + (attr?.mod || 0);
  };
  
  const FOR = getAttr('for');
  const CON = getAttr('con');
  const AGI = getAttr('agi');
  const PER = getAttr('per');
  const VEL = getAttr('vel');
  const INT = getAttr('int');

  const resolvedSkills = availableSkills
    .filter(s => characterSkills.includes(s.id))
    .map(s => ({
      ...s,
      type: character?.skillOverrides?.[s.id]?.type || s.type,
      descriptionOverride: character?.skillOverrides?.[s.id]?.description,
      level: character?.skillOverrides?.[s.id]?.level || 1
    }));

  const resolvedPowers = availablePowers
    .filter(p => characterPowers.includes(p.id))
    .map(p => ({
      ...p,
      type: character?.powerOverrides?.[p.id]?.type || p.type,
      descriptionOverride: character?.powerOverrides?.[p.id]?.description,
      level: character?.powerOverrides?.[p.id]?.level || 1
    }));

  const lutaCount = resolvedSkills.filter(s => s.type === 'Luta').length;
  const misticaCount = resolvedSkills.filter(s => s.type === 'Mística').length;

  const statsForFormula: Record<string, number> = {
    FOR: getAttr('for'),
    CON: getAttr('con'),
    AGI: getAttr('agi'),
    PER: getAttr('per'),
    VEL: getAttr('vel'),
    INI: getAttr('ini'),
    INT: getAttr('int'),
    COR: getAttr('cor'),
    LUTA: lutaCount,
    MISTICA: misticaCount,
  };

  const maxPV = evaluateFormula(globalSettings?.pvFormula || '((FOR / 2) + CON) * 10', statsForFormula);
  const maxATP = evaluateFormula(globalSettings?.atpFormula || '(INT + 3) * 3', statsForFormula);

  const soco = evaluateFormula(globalSettings?.socoFormula || 'FOR', statsForFormula);
  const chute = evaluateFormula(globalSettings?.chuteFormula || 'FOR + (FOR / 2)', statsForFormula);
  const en = evaluateFormula(globalSettings?.enFormula || '20 - ((AGI + (PER / 2)) + (LUTA * 2))', statsForFormula);
  const dm = evaluateFormula(globalSettings?.dmFormula || '20 - ((AGI + (PER / 2)) + (MISTICA * 2))', statsForFormula);
  const defesa = evaluateFormula(globalSettings?.defesaFormula || 'CON + (AGI / 2) + (LUTA * 2)', statsForFormula);
  const esquiva = evaluateFormula(globalSettings?.esquivaFormula || '(CON + AGI + (VEL / 2)) + (LUTA * 2)', statsForFormula);

  const calculateDamage = (damage: string) => {
    if (!damage) return '-';
    let result = damage.toUpperCase();
    const statsMap: Record<string, number | string> = {
      FOR: getAttr('for'),
      CON: getAttr('con'),
      AGI: getAttr('agi'),
      PER: getAttr('per'),
      VEL: getAttr('vel'),
      INI: getAttr('ini'),
      INT: getAttr('int'),
      COR: getAttr('cor'),
    };

    Object.entries(statsMap).forEach(([key, value]) => {
      const regex = new RegExp(key, 'g');
      result = result.replace(regex, value.toString());
    });
    
    // Clean up double signs like +- or ++
    result = result.replace(/\+\+/g, '+').replace(/\+-/g, '-');
    
    return result;
  };

  const calculateTalentValue = (composition: string[]) => {
    return composition.reduce((acc, attrId) => acc + getAttr(attrId), 0);
  };

  const categories = [
    { id: 'geral', label: 'Ficha Geral', icon: Scroll },
    { id: 'inventory', label: 'Inventário', icon: Backpack },
  ];

  const sections = [
    { id: 'stats', label: 'Atributos', icon: Sword, category: 'geral' },
    { id: 'combat', label: 'Status de Combate', icon: Shield, category: 'geral' },
    { id: 'skills', label: 'Perícias e Disciplinas', icon: Scroll, category: 'geral' },
    { id: 'powers', label: 'Poderes e Mágias', icon: Flame, category: 'geral' },
    { id: 'talents', label: 'Talentos', icon: Sparkles, category: 'geral' },
    { id: 'inventory', label: 'Inventário', icon: Backpack, category: 'inventory' },
  ];

  const activeSections = sections.filter(s => s.category === activeCategory);

  return (
    <div className="space-y-10 pb-24 lg:pb-0">
      {/* Character Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 text-center sm:text-left">
          <div 
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden border-2 border-white/10 p-1 group cursor-pointer shrink-0"
            onClick={handleEditImage}
          >
            <img 
              src={character.image} 
              alt={character.name} 
              className="w-full h-full object-cover rounded-[1.5rem] opacity-80 group-hover:scale-110 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-arcane/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Edit3 size={24} className="text-white" />
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-start">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-2">
              <h2 className="text-3xl sm:text-5xl font-serif text-glow-arcane leading-tight">{character.name}</h2>
              <span className="px-3 py-1 glass-arcane text-arcane text-[10px] font-mono uppercase tracking-widest rounded-full">Nível {character.level}</span>
            </div>
            <div className="flex items-center gap-2 text-parchment/40 font-mono text-xs sm:text-sm uppercase tracking-widest">
              {(() => {
                const Icon = iconMap[character.icon] || Shield;
                return <Icon size={14} />;
              })()}
              <span>{character.class} • Juramento de Devoção</span>
            </div>
            
            {/* Session Info */}
            <div className="mt-4 flex flex-wrap justify-center sm:justify-start items-center gap-3">
              {session ? (
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3">
                  <div className="px-3 py-1 bg-ember/10 text-ember border border-ember/20 rounded-lg text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
                    <Shield size={12} />
                    Campanha: {session.name}
                  </div>
                  <button 
                    onClick={handleLeaveSession}
                    className="text-[10px] font-mono text-parchment/20 hover:text-ember transition-colors uppercase tracking-widest"
                  >
                    Sair da Campanha
                  </button>
                </div>
              ) : (
                <button 
                  onClick={fetchAvailableSessions}
                  className="px-3 py-1 bg-white/5 text-parchment/40 border border-white/10 rounded-lg text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <Plus size={12} />
                  Vincular a uma Campanha
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-6 mt-6">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-arcane" />
                <span className="text-base sm:text-lg font-serif">{defesa} <span className="text-[10px] text-parchment/40 font-mono">DEF</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-gold" />
                <span className="text-base sm:text-lg font-serif">{totalProtecao} <span className="text-[10px] text-parchment/40 font-mono">PROT</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Heart size={16} className="text-ember" />
                <span className="text-base sm:text-lg font-serif">{currentPV} / {maxPV} <span className="text-[10px] text-parchment/40 font-mono">PV</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-gold" />
                <span className="text-base sm:text-lg font-serif">+{getAttr('ini')} <span className="text-[10px] text-parchment/40 font-mono">INI</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-arcane" />
                <span className="text-base sm:text-lg font-serif">{VEL} <span className="text-[10px] text-parchment/40 font-mono">VEL</span></span>
              </div>
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1 justify-center sm:justify-start">
                <Coins size={16} className="text-gold" />
                <span className="text-base sm:text-lg font-serif">{character.money || 0} <span className="text-[10px] text-parchment/40 font-mono">GPs</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-3 mt-4 lg:mt-0">
          <button 
            onClick={handleShare}
            className="p-3 glass rounded-2xl hover:bg-white/10 transition-colors text-parchment/60 hover:text-parchment"
            title="Compartilhar Ficha"
          >
            <Share2 size={20} />
          </button>
          <button 
            onClick={handleDownload}
            className="p-3 glass rounded-2xl hover:bg-white/10 transition-colors text-parchment/60 hover:text-parchment"
            title="Baixar JSON"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={() => handleSave()}
            className="flex-1 sm:flex-none px-6 py-3 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-105 transition-transform shadow-lg shadow-arcane/20"
          >
            Salvar Ficha
          </button>
        </div>
      </header>

      {/* Floating Navigation Menu */}
      <div className="sticky top-4 lg:top-20 z-30 flex flex-col items-center gap-2 py-4 pointer-events-none lg:hidden">
        {/* Category Menu (Mobile Only) */}
        <div className="lg:hidden glass-arcane p-1 rounded-xl border border-white/10 flex items-center gap-1 pointer-events-auto shadow-xl">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                // Set first section of category as active
                const firstSection = sections.find(s => s.category === cat.id);
                if (firstSection) setActiveSection(firstSection.id);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all",
                activeCategory === cat.id 
                  ? "bg-white/10 text-arcane font-bold" 
                  : "text-parchment/40 hover:text-parchment"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Section Menu (Desktop: All, Mobile: Filtered by Category) */}
        <div className="glass-arcane p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 pointer-events-auto shadow-2xl shadow-black/50 overflow-x-auto no-scrollbar max-w-[95vw]">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                setActiveCategory(section.category);
              }}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-all whitespace-nowrap",
                activeSection === section.id 
                  ? "bg-arcane text-obsidian font-bold shadow-lg" 
                  : "text-parchment/40 hover:text-parchment hover:bg-white/5",
                // Hide sections not in active category on mobile, but show all on desktop
                section.category !== activeCategory && "hidden lg:flex"
              )}
            >
              <section.icon size={14} />
              <span className={cn("hidden lg:inline", activeSection === section.id && "inline")}>{section.label}</span>
            </button>
          ))}
        </div>
        
        {/* Sub-label for current section on mobile */}
        <div className="lg:hidden pointer-events-none">
          <div className="px-4 py-1 bg-obsidian/80 backdrop-blur-sm border border-white/5 rounded-full text-[9px] font-mono text-parchment/40 uppercase tracking-widest">
            {sections.find(s => s.id === activeSection)?.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Attributes & Combat Status */}
        <div className={cn(
          "lg:col-span-3 space-y-8",
          activeSection !== 'stats' && activeSection !== 'combat' && "hidden lg:block"
        )}>
          <section className={cn("space-y-4", activeSection !== 'stats' && "hidden lg:block")}>
            <div className="flex items-center justify-between px-2 sm:px-4">
              <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Dados Básicos</h3>
              {isGM && (
                <button 
                  onClick={() => {
                    const next = !canEditStats;
                    setCanEditStats(next);
                    handleSave({ canEditStats: next });
                  }}
                  className={cn(
                    "text-[9px] sm:text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border transition-colors",
                    canEditStats ? "bg-arcane/20 text-arcane border-arcane/30" : "bg-white/5 text-parchment/40 border-white/10"
                  )}
                >
                  {canEditStats ? "Edição Liberada" : "Edição Bloqueada"}
                </button>
              )}
            </div>
            <div className="glass p-4 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Nome da Lenda</label>
                  {canPlayerEdit ? (
                    <input 
                      type="text"
                      value={character.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setCharacter({ ...character, name: newName });
                        handleSave({ name: newName });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-base font-serif text-glow-arcane focus:outline-none focus:border-arcane/50"
                    />
                  ) : (
                    <p className="text-base font-serif text-glow-arcane leading-tight">{character.name}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Classe / Vocação</label>
                  {canPlayerEdit ? (
                    <input 
                      type="text"
                      value={character.class}
                      onChange={(e) => {
                        const newClass = e.target.value;
                        setCharacter({ ...character, class: newClass });
                        handleSave({ class: newClass });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-base font-serif text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  ) : (
                    <p className="text-base font-serif text-parchment leading-tight">{character.class}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">URL da Imagem</label>
                {canPlayerEdit ? (
                  <input 
                    type="text"
                    value={character.image || ''}
                    onChange={(e) => {
                      const newImage = e.target.value;
                      setCharacter({ ...character, image: newImage });
                      handleSave({ image: newImage });
                    }}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-[10px] font-mono text-parchment focus:outline-none focus:border-arcane/50"
                  />
                ) : (
                  <p className="text-[10px] font-mono text-parchment/40 truncate">{character.image || 'Nenhuma imagem'}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-2 sm:px-4 pt-4">
              <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Atributos</h3>
              {attributePoints > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-ember/20 border border-ember/30 rounded-full animate-pulse">
                  <Sparkles size={12} className="text-ember" />
                  <span className="text-[10px] font-bold text-ember uppercase tracking-wider">{attributePoints} Pontos Disponíveis</span>
                </div>
              )}
            </div>
            <div className="space-y-2 sm:space-y-3">
              {attributes.map((attr, idx) => (
                <motion.div
                  key={attr.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass p-3 sm:p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn("p-1.5 sm:p-2 rounded-xl bg-white/5", attr.color)}>
                      <attr.icon size={16} sm:size={18} />
                    </div>
                    <span className="font-serif text-base sm:text-lg">{attr.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {canPlayerEdit ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              value={attr.value}
                              onChange={(e) => {
                                const newValue = parseInt(e.target.value) || 0;
                                const oldValue = stats[attr.id] || 0;
                                const baseValue = character.baseStats?.[attr.id] ?? 0;
                                
                                // Prevent going below base for players
                                if (!isGM && newValue < baseValue) {
                                  return;
                                }

                                const diff = newValue - oldValue;
                                const currentPoints = attributePoints;
                                
                                if (!isGM && diff > currentPoints) {
                                  alert('Pontos de atributo insuficientes!');
                                  return;
                                }
                                
                                const newStats = { ...stats, [attr.id]: newValue };
                                setStats(newStats);
                                
                                // Calculate new points
                                let newPoints = currentPoints;
                                if (diff > 0) {
                                  // Spending points
                                  newPoints = Math.max(0, currentPoints - diff);
                                } else if (diff < 0) {
                                  // Refunding points
                                  // Only refund points that were above base
                                  const refundAmount = Math.min(Math.abs(diff), Math.max(0, oldValue - baseValue));
                                  newPoints = currentPoints + refundAmount;
                                }

                                setAttributePoints(newPoints);
                                handleSave({ 
                                  stats: newStats,
                                  attributePoints: newPoints
                                });
                              }}
                              className="w-10 sm:w-12 bg-white/5 border border-white/10 rounded text-center text-lg sm:text-xl font-serif text-glow-arcane focus:outline-none focus:border-arcane/50"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-lg sm:text-xl font-serif text-glow-arcane leading-none">{attr.value}</p>
                      )}
                      <p className="text-[8px] sm:text-[10px] text-parchment/40 font-mono uppercase tracking-wider">BASE</p>
                    </div>
                    <div className="text-right">
                      {canPlayerEdit ? (
                        <input 
                          type="number"
                          value={attr.mod}
                          onChange={(e) => {
                            const newMods = { ...statsMods, [attr.id]: parseInt(e.target.value) || 0 };
                            setStatsMods(newMods);
                            handleSave({ statsMods: newMods });
                          }}
                          className="w-10 sm:w-12 bg-white/5 border border-white/10 rounded text-center text-lg sm:text-xl font-serif text-ember focus:outline-none focus:border-ember/50"
                        />
                      ) : (
                        <p className="text-lg sm:text-xl font-serif text-ember leading-none">{attr.mod >= 0 ? `+${attr.mod}` : attr.mod}</p>
                      )}
                      <p className="text-[8px] sm:text-[10px] text-parchment/40 font-mono uppercase tracking-wider">MOD.</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Combat Status Calculations */}
          <section className={cn("space-y-4", activeSection !== 'combat' && "hidden lg:block")}>
            <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Status de Combate</h3>
            <div className="glass p-6 rounded-3xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Soco</p>
                  <p className="text-xl font-serif text-ember">{soco}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Chute</p>
                  <p className="text-xl font-serif text-ember">{chute}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">E/N (Esq. Nat.)</p>
                  <p className="text-xl font-serif text-arcane">{en}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">D/M</p>
                  <p className="text-xl font-serif text-gold">{dm}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Defesa</p>
                  <p className="text-xl font-serif text-arcane">{defesa}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Esquiva</p>
                  <p className="text-xl font-serif text-arcane">{esquiva}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Middle Column: Status Sliders & Perícias */}
        <div className={cn(
          "lg:col-span-6 space-y-10",
          activeSection !== 'stats' && activeSection !== 'skills' && activeSection !== 'talents' && "hidden lg:block"
        )}>
          {/* Status Sliders */}
          <section className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", activeSection !== 'stats' && "hidden lg:block")}>
            <div className="glass p-6 rounded-[2.5rem] space-y-4 md:col-span-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Heart size={18} className="text-ember" />
                  <span className="font-serif text-lg">PV</span>
                </div>
                <span className="font-mono text-sm">{currentPV} / {maxPV}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={maxPV} 
                value={currentPV} 
                onChange={(e) => setCurrentPV(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ember"
              />
            </div>

            <div className="glass p-6 rounded-[2.5rem] space-y-4 md:col-span-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-arcane" />
                  <span className="font-serif text-lg">ATP</span>
                </div>
                <span className="font-mono text-sm">{currentATP} / {maxATP}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={maxATP} 
                value={currentATP} 
                onChange={(e) => setCurrentATP(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-arcane"
              />
            </div>

            <div className="glass p-6 rounded-[2.5rem] space-y-4 md:col-span-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-gold" />
                  <span className="font-serif text-lg">Proteção Atual</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-3xl font-serif text-glow-gold">{totalProtecao}</span>
                  <span className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest">Limite: {armorBonus}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-parchment/40">
                  <span>Ajuste de Proteção</span>
                  <span>{protecao} / {armorBonus}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={armorBonus} 
                  value={protecao} 
                  onChange={(e) => setProtecao(parseInt(e.target.value))}
                  disabled={armorBonus === 0}
                  className={cn(
                    "w-full h-2 rounded-lg appearance-none cursor-pointer accent-gold",
                    armorBonus > 0 ? "bg-white/10" : "bg-white/5 cursor-not-allowed"
                  )}
                />
              </div>

              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest">Defesa de Armaduras</p>
                  <span className="text-xs font-mono text-gold">Total: {armorBonus}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {armorItems.map(item => (
                    <div key={item.id} className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px] flex items-center gap-2">
                      <Shield size={10} className="text-gold/60" />
                      <span className="text-parchment/60">{item.name}</span>
                      <span className="text-gold">+{item.defense}</span>
                    </div>
                  ))}
                  {armorItems.length === 0 && (
                    <span className="text-[10px] text-parchment/20 italic">Nenhuma armadura equipada</span>
                  )}
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-[2.5rem] space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-ember" />
                  <span className="font-serif text-lg">Sanidade</span>
                </div>
                <span className="font-mono text-sm">{sanidade}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="7" 
                value={sanidade} 
                onChange={(e) => setSanidade(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ember"
              />
            </div>

            <div className="glass p-6 rounded-[2.5rem] space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-arcane" />
                  <span className="font-serif text-lg">Despertar</span>
                </div>
                <span className="font-mono text-sm">{despertar}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="7" 
                value={despertar} 
                onChange={(e) => setDespertar(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-arcane"
              />
            </div>
          </section>

          {/* Perícias & Disciplinas */}
          <section className={cn("space-y-6", activeSection !== 'skills' && "hidden lg:block")}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-serif flex items-center gap-3">
                <Scroll className="text-arcane" size={24} />
                Perícias & Disciplinas
              </h3>
              {canPlayerEdit && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('Todos');
                    setIsAddingSkill(true);
                  }}
                  className="p-2 glass rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="space-y-4">
              {resolvedSkills.map((skill, idx) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="glass p-5 rounded-3xl space-y-3 group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30 cursor-pointer relative"
                >
                  {canPlayerEdit && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSkill(skill.id);
                      }}
                      className="absolute top-4 right-4 p-1.5 glass rounded-lg opacity-0 group-hover:opacity-100 hover:bg-ember/20 hover:text-ember transition-all"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border border-white/10",
                        skill.type === 'Luta' ? "text-ember" : skill.type === 'Mística' ? "text-arcane" : "text-gold"
                      )}>
                        {skill.type === 'Luta' ? <Sword size={18} /> : skill.type === 'Mística' ? <Flame size={18} /> : <Activity size={18} />}
                      </div>
                      <div>
                        <h5 className="font-serif text-lg">
                          {skill.name}
                          <span className="text-xs text-parchment/40 ml-2">Nvl {skill.level}</span>
                        </h5>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">{skill.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">ATP</p>
                        <p className="text-base font-serif text-arcane">{skill.atp}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Dano</p>
                        <p className="text-base font-serif text-ember">{calculateDamage(skill.damage)}</p>
                      </div>
                      {skill.difficultyFormula && (
                        <div>
                          <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Dificuldade</p>
                          <p className="text-base font-serif text-gold">{evaluateFormula(skill.difficultyFormula, statsForFormula)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-parchment/60 leading-relaxed">
                    {skill.description}
                    {skill.descriptionOverride && (
                      <span className="block mt-2 pt-2 border-t border-white/5 text-arcane/80 italic">
                        {skill.descriptionOverride}
                      </span>
                    )}
                  </p>
                </motion.div>
              ))}
              {resolvedSkills.length === 0 && (
                <div className="text-center py-10 glass rounded-3xl border border-dashed border-white/10">
                  <p className="text-sm text-parchment/20 italic">Nenhuma perícia ou disciplina cadastrada</p>
                </div>
              )}
            </div>
          </section>

          {/* Poderes Section */}
          <section className={cn("space-y-6", activeSection !== 'powers' && "hidden lg:block")}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-serif flex items-center gap-3">
                <Flame className="text-ember" size={24} />
                Poderes e Mágias
              </h3>
              {canPlayerEdit && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('Todos');
                    setIsAddingPower(true);
                  }}
                  className="p-2 glass rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <div className="space-y-4">
              {resolvedPowers.map((power, idx) => (
                <motion.div
                  key={power.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="glass p-5 rounded-3xl space-y-3 group hover:bg-white/10 transition-all border border-white/10 hover:border-ember/30 cursor-pointer relative"
                >
                  {canPlayerEdit && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePower(power.id);
                      }}
                      className="absolute top-4 right-4 p-1.5 glass rounded-lg opacity-0 group-hover:opacity-100 hover:bg-ember/20 hover:text-ember transition-all"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 text-ember">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h5 className="font-serif text-lg">
                          {power.name}
                          <span className="text-xs text-parchment/40 ml-2">Nvl {power.level}</span>
                        </h5>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">{power.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Custo</p>
                        <p className="text-base font-serif text-gold">{power.purchaseCost} pts</p>
                      </div>
                      {power.difficultyFormula && (
                        <div>
                          <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Dificuldade</p>
                          <p className="text-base font-serif text-arcane">{evaluateFormula(power.difficultyFormula, statsForFormula)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-parchment/60 leading-relaxed">
                    {power.description}
                    {power.descriptionOverride && (
                      <span className="block mt-2 pt-2 border-t border-white/5 text-ember/80 italic">
                        {power.descriptionOverride}
                      </span>
                    )}
                  </p>
                </motion.div>
              ))}
              {resolvedPowers.length === 0 && (
                <div className="text-center py-10 glass rounded-3xl border border-dashed border-white/10">
                  <p className="text-sm text-parchment/20 italic">Nenhum poder ou mágia cadastrado</p>
                </div>
              )}
            </div>
          </section>

          {/* Talentos Section */}
          {talents.length > 0 && (
            <section className={cn("space-y-6", activeSection !== 'talents' && "hidden lg:block")}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif flex items-center gap-3">
                  <Sparkles className="text-gold" size={24} />
                  Talentos da Campanha
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {talents.map((talent, idx) => {
                  const baseValue = calculateTalentValue(talent.composition);
                  const modValue = talentMods[talent.id] || 0;
                  const totalValue = baseValue + modValue;
                  
                  return (
                    <motion.div
                      key={talent.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      className="glass p-5 rounded-3xl border border-white/10 hover:border-gold/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-serif text-lg text-glow-gold">{talent.name}</h5>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Base: {baseValue}</span>
                            {canPlayerEdit ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Mod:</span>
                                <input 
                                  type="number"
                                  value={modValue}
                                  onChange={(e) => {
                                    const newMods = { ...talentMods, [talent.id]: parseInt(e.target.value) || 0 };
                                    setTalentMods(newMods);
                                    handleSave({ talentMods: newMods });
                                  }}
                                  className="w-10 bg-white/5 border border-white/10 rounded text-center text-xs font-mono text-ember focus:outline-none focus:border-ember/50"
                                />
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-ember uppercase tracking-widest">Mod: {modValue >= 0 ? `+${modValue}` : modValue}</span>
                            )}
                          </div>
                          <div className="px-3 py-1 bg-gold/10 text-gold border border-gold/20 rounded-lg font-serif text-xl">
                            {totalValue}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-parchment/60 line-clamp-2 mb-4">{talent.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {talent.composition.map(attrId => {
                          const attr = attributes.find(a => a.id === attrId);
                          if (!attr) return null;
                          
                          const tagStyles = {
                            'for': 'bg-ember/10 text-ember border-ember/20',
                            'con': 'bg-ember/10 text-ember border-ember/20',
                            'cor': 'bg-ember/10 text-ember border-ember/20',
                            'agi': 'bg-arcane/10 text-arcane border-arcane/20',
                            'vel': 'bg-arcane/10 text-arcane border-arcane/20',
                            'int': 'bg-arcane/10 text-arcane border-arcane/20',
                            'per': 'bg-gold/10 text-gold border-gold/20',
                            'ini': 'bg-gold/10 text-gold border-gold/20',
                          }[attrId] || 'bg-white/5 text-parchment/40 border-white/10';

                          return (
                            <div key={attrId} className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-mono uppercase tracking-wider transition-colors",
                              tagStyles
                            )}>
                              <attr.icon size={8} />
                              {attr.label}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Inventory */}
        <div className={cn(
          "lg:col-span-3 space-y-10",
          activeSection !== 'inventory' && "hidden lg:block"
        )}>
          {/* Equipped Items */}
          <section className={cn("space-y-6", activeSection !== 'inventory' && "hidden lg:block")}>
            <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Itens Equipados</h3>
            <div className="glass p-6 rounded-[2.5rem] space-y-4">
              {equippedItems.map((item, idx) => (
                <motion.div
                  key={item.id || item.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  className="flex items-center justify-between p-3 glass rounded-2xl group hover:bg-white/5 transition-all border border-white/5 hover:border-arcane/20"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl bg-white/5", item.color || "text-arcane")}>
                      {item.defense > 0 ? <Shield size={16} /> : <Sword size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-serif leading-tight">{item.name}</p>
                      <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">{item.slot || 'Equipamento'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleEquip(item.id)}
                      className="p-2 glass rounded-xl hover:bg-ember/20 hover:text-ember transition-all text-parchment/40"
                      title="Desequipar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Equipment Summary */}
          <section className={cn("space-y-6", activeSection !== 'inventory' && "hidden lg:block")}>
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Equipamento</h3>
              <button 
                onClick={() => navigate(`/inventory?id=${characterId}`)}
                className="p-1.5 glass rounded-lg hover:bg-arcane/20 hover:text-arcane transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="glass p-6 rounded-[2.5rem] space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Backpack size={20} className="text-arcane" />
                  <span className="font-serif text-lg">Mochila</span>
                </div>
                <span className="text-xs font-mono text-parchment/40">{inventory.length} ITENS</span>
              </div>
              <div className="space-y-4">
                {inventory.length === 0 ? (
                  <div className="py-8 text-center glass rounded-2xl border border-dashed border-white/5">
                    <p className="text-[10px] font-mono text-parchment/20 uppercase tracking-widest">Mochila Vazia</p>
                  </div>
                ) : (
                  inventory.map((item) => (
                    <div 
                      key={item.id || item.name} 
                      className="space-y-1 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleEquip(item.id)}
                            className={cn(
                              "p-1 rounded transition-all",
                              item.equipped ? "bg-arcane/20 text-arcane" : "bg-white/5 text-parchment/20 hover:text-arcane"
                            )}
                            title={item.equipped ? "Desequipar" : "Equipar"}
                          >
                            <Zap size={12} />
                          </button>
                          <span className="text-sm font-serif text-parchment/80 group-hover:text-arcane transition-colors">{item.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-parchment/40">x{item.quantity}</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-parchment/20 uppercase tracking-tighter pl-6">
                        <span>Dano: {item.damage}</span>
                        <span>Mun: {item.ammo}</span>
                        {item.defense > 0 && <span className="text-arcane">Def: +{item.defense}</span>}
                        {item.equipped && <span className="text-gold">Equipado</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button 
                onClick={() => navigate(`/inventory?id=${characterId}`)}
                className="w-full py-3 glass rounded-2xl text-[10px] font-mono text-parchment/40 hover:text-parchment transition-colors uppercase tracking-widest"
              >
                VER INVENTÁRIO COMPLETO
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Add Skill Modal (Library) */}
      <AnimatePresence>
        {isAddingSkill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingSkill(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <button 
                onClick={() => setIsAddingSkill(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif">Biblioteca de Perícias</h3>
                <div className="flex items-center gap-2 px-4 py-2 glass rounded-2xl border border-arcane/20">
                  <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos Disponíveis:</span>
                  <span className="text-lg font-serif text-arcane">{character.skillPoints || 0}</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/40" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar perícia..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-parchment focus:outline-none focus:border-arcane/50"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-parchment focus:outline-none focus:border-arcane/50 appearance-none"
                >
                  <option value="Todos">Todos os Tipos</option>
                  <option value="Conhecimento">Conhecimento</option>
                  <option value="Artes">Artes</option>
                  <option value="Treinamento">Treinamento</option>
                  <option value="Ocultismo">Ocultismo</option>
                  <option value="Empírico">Empírico</option>
                  <option value="Luta">Luta</option>
                  <option value="Mística">Mística</option>
                </select>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {filteredAvailableSkills.map((skill) => (
                  <div 
                    key={skill.id}
                    className="glass p-4 rounded-2xl border border-white/5 hover:border-arcane/30 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-serif text-lg text-parchment group-hover:text-arcane transition-colors">{skill.name}</h4>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{skill.type}</span>
                      </div>
                      <button 
                        onClick={() => handleAddSkillFromLibrary(skill.id)}
                        className="p-2 bg-arcane/10 text-arcane rounded-xl hover:bg-arcane hover:text-obsidian transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-parchment/60 line-clamp-2 mb-3">{skill.description}</p>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                      <span>Custo: <span className="text-gold">{skill.purchaseCost} pts</span></span>
                      <span>ATP: <span className="text-arcane">{skill.atp}</span></span>
                      <span>Dano: <span className="text-ember">{skill.damage}</span></span>
                    </div>
                  </div>
                ))}
                {filteredAvailableSkills.length === 0 && (
                  <div className="text-center py-12 glass rounded-3xl border border-dashed border-white/10">
                    <p className="text-sm text-parchment/20 italic">Nenhuma perícia disponível para adicionar</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Power Modal (Library) */}
      <AnimatePresence>
        {isAddingPower && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingPower(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <button 
                onClick={() => setIsAddingPower(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-serif">Biblioteca de Poderes</h3>
                <div className="flex items-center gap-2 px-4 py-2 glass rounded-2xl border border-ember/20">
                  <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos Disponíveis:</span>
                  <span className="text-lg font-serif text-ember">{character.powerPoints || 0}</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/40" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar poder..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-parchment focus:outline-none focus:border-arcane/50"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-parchment focus:outline-none focus:border-arcane/50 appearance-none"
                >
                  <option value="Todos">Todos os Tipos</option>
                  <option value="Físico">Físico</option>
                  <option value="Elemental">Elemental</option>
                  <option value="Defesa">Defesa</option>
                  <option value="Buff">Buff</option>
                  <option value="Debuff">Debuff</option>
                  <option value="Gerais">Gerais</option>
                </select>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {filteredAvailablePowers.map((power) => (
                  <div 
                    key={power.id}
                    className="glass p-4 rounded-2xl border border-white/5 hover:border-ember/30 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-serif text-lg text-parchment group-hover:text-ember transition-colors">{power.name}</h4>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{power.type}</span>
                      </div>
                      <button 
                        onClick={() => handleAddPowerFromLibrary(power.id)}
                        className="p-2 bg-ember/10 text-ember rounded-xl hover:bg-ember hover:text-obsidian transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-parchment/60 line-clamp-2 mb-3">{power.description}</p>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                      <span>Custo: <span className="text-gold">{power.purchaseCost} pts</span></span>
                    </div>
                  </div>
                ))}
                {filteredAvailablePowers.length === 0 && (
                  <div className="text-center py-12 glass rounded-3xl border border-dashed border-white/10">
                    <p className="text-sm text-parchment/20 italic">Nenhum poder disponível para adicionar</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Join Session Modal */}
      <AnimatePresence>
        {isJoiningSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJoiningSession(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setIsJoiningSession(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              <h3 className="text-2xl font-serif mb-6">Vincular a Campanha</h3>
              <div className="space-y-4">
                {availableSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-parchment/40 mb-4">Você ainda não entrou em nenhuma campanha.</p>
                    <button 
                      onClick={() => navigate('/')}
                      className="text-arcane hover:underline text-sm font-bold"
                    >
                      Ir para o Dashboard
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableSessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleJoinSession(s.id)}
                        className="w-full p-4 glass rounded-2xl text-left hover:bg-white/10 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-lg group-hover:text-arcane transition-colors">{s.name}</span>
                          <ChevronRight size={18} className="text-parchment/20 group-hover:text-arcane transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
