import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User,
  UserPlus, 
  ChevronRight, 
  ChevronLeft, 
  Dice6, 
  Sparkles, 
  Shield, 
  Sword, 
  Zap, 
  Brain, 
  Eye, 
  Heart,
  Plus,
  Trash2,
  Flame,
  Activity,
  Scroll,
  Check,
  Search,
  Filter,
  Target,
  Star,
  X,
  Info,
  Package,
  History,
  Edit2,
  Backpack,
  Pencil,
  Image as ImageIcon,
  Camera
} from 'lucide-react';
import { cn, evaluateFormula, rollDiceFormula, resolveStatsWithVars, playAudio, getTraitEffectiveModifier, isTraitModifierSameAsEffect, getTraitTargets, getTraitTargetDisplayName } from '../lib/utils';
import { auth, db, collection, setDoc, getDoc, doc, OperationType, handleFirestoreError, query, where, getDocs } from '../firebase';
import { ImagePickerModal } from './ImagePickerModal';

// Helper to get icon component from name
const getIcon = (name: string) => {
  const icons: Record<string, any> = {
    Sword, Shield, Zap, Eye, Brain, Heart, UserPlus, Dice6, Activity, Scroll, Plus, History, Sparkles, Flame, Star, Info, Target, Search, Filter, X
  };
  return icons[name] || Shield;
};

const RollingValue = ({ sides = 20, isDamage = false }: { sides?: number, isDamage?: boolean }) => {
  const [val, setVal] = React.useState(1);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setVal(Math.floor(Math.random() * (isDamage ? 20 : sides)) + 1);
    }, 40);
    return () => clearInterval(interval);
  }, [sides, isDamage]);
  return <>{val}</>;
};

const DEFAULT_ATTRIBUTES = [
  { id: 'for', label: 'Força', icon: 'Sword', color: 'text-ember', description: 'Poder físico e força bruta.' },
  { id: 'con', label: 'Constituição', icon: 'Shield', color: 'text-ember', description: 'Saúde, resistência e força vital.' },
  { id: 'agi', label: 'Agilidade', icon: 'Zap', color: 'text-arcane', description: 'Destreza, reflexos e equilíbrio.' },
  { id: 'per', label: 'Percepção', icon: 'Eye', color: 'text-gold', description: 'Intuição, sentidos e observação.' },
  { id: 'vel', label: 'Velocidade', icon: 'Zap', color: 'text-arcane', description: 'Capacidade de deslocamento rápido.' },
  { id: 'ini', label: 'Iniciativa', icon: 'Zap', color: 'text-gold', description: 'Prontidão para o combate.' },
  { id: 'int', label: 'Inteligência', icon: 'Brain', color: 'text-arcane', description: 'Agudeza mental e raciocínio.' },
  { id: 'cor', label: 'Coragem', icon: 'Heart', color: 'text-ember', description: 'Força de vontade e bravura.' },
];


export default function CharacterCreation() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [sessionSearch, setSessionSearch] = React.useState('');
  const [showSessionList, setShowSessionList] = React.useState(false);
  const [sessionIndex, setSessionIndex] = React.useState(0);
  const sessionListRef = React.useRef<HTMLDivElement>(null);
  const sessionInputRef = React.useRef<HTMLInputElement>(null);
  const steps = ['Vantagens/Defeitos', 'Origens', 'Atributos', 'Perícias', 'Poderes', 'Equipamento', 'Revisão'];

  const [basics, setBasics] = React.useState({
    name: '',
    class: '',
    image: '',
    color: 'arcane',
    icon: 'Shield',
    sessionId: '',
    money: 500
  });

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);

  const [availableSkills, setAvailableSkills] = React.useState<any[]>([]);
  const [availablePowers, setAvailablePowers] = React.useState<any[]>([]);
  const [availableTraits, setAvailableTraits] = React.useState<any[]>([]);
  const [availableTalents, setAvailableTalents] = React.useState<any[]>([]);
  const [skillPoints, setSkillPoints] = React.useState(0);
  const [powerPoints, setPowerPoints] = React.useState(0);
  const [traitPoints, setTraitPoints] = React.useState(0);
  const [initialSkillPoints, setInitialSkillPoints] = React.useState(0);
  const [initialPowerPoints, setInitialPowerPoints] = React.useState(0);

  const [skillSearch, setSkillSearch] = React.useState('');
  const [skillTypeFilter, setSkillTypeFilter] = React.useState('all');
  const [powerSearch, setPowerSearch] = React.useState('');
  const [powerTypeFilter, setPowerTypeFilter] = React.useState('all');
  const [traitSearch, setTraitSearch] = React.useState('');
  const [traitTypeFilter, setTraitTypeFilter] = React.useState('all');
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isRolling, setIsRolling] = React.useState(false);
  const [quickRoll, setQuickRoll] = React.useState<{ 
    result: number, 
    success?: boolean, 
    attr: string, 
    target?: number,
    type: 'test' | 'damage',
    diceSides?: number,
    rolling?: boolean,
    isCritical?: boolean,
    isFumble?: boolean
  } | null>(null);
  const rollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const rollingAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const [skills, setSkills] = React.useState<any[]>([]);
  const [powers, setPowers] = React.useState<any[]>([]);
  const [selectedTraits, setSelectedTraits] = React.useState<any[]>([]);
  const [detailTrait, setDetailTrait] = React.useState<any | null>(null);

  const [showSkillSuggestion, setShowSkillSuggestion] = React.useState(false);
  const [showPowerSuggestion, setShowPowerSuggestion] = React.useState(false);
  const [showTraitSuggestion, setShowTraitSuggestion] = React.useState(false);

  const [itemCatalog, setItemCatalog] = React.useState<any[]>([]);
  const [showCatalog, setShowCatalog] = React.useState(false);
  const [catalogSearch, setCatalogSearch] = React.useState('');
  const [suggestionData, setSuggestionData] = React.useState({
    name: '',
    type: '',
    description: '',
    purchaseCost: 1,
    atpCost: 0,
    damage: '',
    cost: '',
    effect: '',
    modifier: 0,
    modifierType: 'for'
  });

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSaveSuggestion = async (type: 'skill' | 'power' | 'trait') => {
    if (!auth.currentUser) return;
    try {
      const suggestionId = crypto.randomUUID();
      const data = {
        type,
        data: {
          name: suggestionData.name,
          type: suggestionData.type || (type === 'skill' ? 'Geral' : type === 'power' ? 'Geral' : 'advantage'),
          description: suggestionData.description,
          purchaseCost: suggestionData.purchaseCost,
          ...(type === 'skill' ? { atpCost: suggestionData.atpCost, damage: suggestionData.damage } : {}),
          ...(type === 'power' ? { cost: suggestionData.cost, effect: suggestionData.effect } : {}),
          ...(type === 'trait' ? { modifier: suggestionData.modifier, modifierType: suggestionData.modifierType, effect: suggestionData.effect } : {}),
          createdAt: new Date().toISOString()
        },
        suggestedBy: auth.currentUser.uid,
        suggestedByName: auth.currentUser.displayName || auth.currentUser.email || 'Anônimo',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'suggestions', suggestionId), data);
      setShowSkillSuggestion(false);
      setShowPowerSuggestion(false);
      setShowTraitSuggestion(false);
      setSuggestionData({ name: '', type: '', description: '', purchaseCost: 1, atpCost: 0, damage: '', cost: '', effect: '', modifier: 0, modifierType: 'for' });
      setSaveStatus({ type: 'success', message: 'Sugestão enviada para o mestre!' });
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Erro ao enviar sugestão.' });
      handleFirestoreError(error, OperationType.WRITE, 'suggestions');
    }
  };

  const [equipment, setEquipment] = React.useState<any[]>([]);

  const [newEquip, setNewEquip] = React.useState({
    name: '',
    description: '',
    quantity: 1,
    ammo: '-',
    damage: '',
    defense: 0,
    equipped: false,
    stats: {} as Record<string, number>,
    image: '',
    category: 'Geral',
    rarity: 'Common'
  });

  const handleAddEquip = () => {
    if (newEquip.name.trim()) {
      setEquipment([...equipment, { ...newEquip, id: crypto.randomUUID() }]);
      setNewEquip({
        name: '',
        description: '',
        quantity: 1,
        ammo: '-',
        damage: '',
        defense: 0,
        equipped: false,
        stats: {},
        image: '',
        category: 'Geral',
        rarity: 'Common'
      });
    }
  };

  const removeEquip = (id: string) => {
    const itemToRemove = equipment.find(e => e.id === id);
    if (itemToRemove && itemToRemove.value) {
      setBasics(prev => ({ ...prev, money: prev.money + (itemToRemove.value * (itemToRemove.quantity || 1)) }));
    }
    setEquipment(equipment.filter(e => e.id !== id));
  };

  const importFromCatalog = (item: any) => {
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

    if (item.value > basics.money) {
      const randomMessage = funnyFailMessages[Math.floor(Math.random() * funnyFailMessages.length)];
      setSaveStatus({ type: 'error', message: `${randomMessage} (Preço: ${item.value} MO, Você tem: ${basics.money} MO)` });
      return;
    }

    setBasics(prev => ({ ...prev, money: prev.money - (item.value || 0) }));
    setEquipment([...equipment, {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      quantity: 1,
      equipped: false,
      stats: item.stats || {}
    }]);
    setShowCatalog(false);
    setSaveStatus({ type: 'success', message: `Item '${item.name}' adquirido por ${item.value} MO!` });
  };

  React.useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionsSnap = await getDocs(collection(db, 'gameSessions'));
        const sessionsData = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const gmIds = [...new Set(sessionsData.map((s: any) => s.gmId))];
        const gmNames: Record<string, string> = {};
        
        // Fetch GM names
        await Promise.all(gmIds.map(async (gmId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', gmId));
            if (userDoc.exists()) {
              gmNames[gmId] = userDoc.data().displayName || 'Mestre Desconhecido';
            } else {
              gmNames[gmId] = 'Mestre Desconhecido';
            }
          } catch (e) {
            gmNames[gmId] = 'Mestre Desconhecido';
          }
        }));

        const formattedSessions = sessionsData.map((s: any) => ({
          ...s,
          gmName: gmNames[s.gmId] || 'Mestre Desconhecido',
          displayText: `${s.code} - ${s.name} (${gmNames[s.gmId] || 'Mestre Desconhecido'})`
        }));

        setSessions(formattedSessions);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      }
    };
    fetchSessions();
  }, []);

  const filteredSessions = React.useMemo(() => {
    const searchLower = sessionSearch.toLowerCase().trim();
    if (!searchLower && !showSessionList) return [];
    
    const results = sessions.filter(s => 
      s.name.toLowerCase().includes(searchLower) || 
      s.code.toLowerCase().includes(searchLower) ||
      s.gmName.toLowerCase().includes(searchLower)
    );

    // If search is empty but focused, show first 5 available sessions
    if (!searchLower && showSessionList) return sessions.slice(0, 5);
    
    return results;
  }, [sessions, sessionSearch, showSessionList]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(event.target as Node) && 
          sessionInputRef.current && !sessionInputRef.current.contains(event.target as Node)) {
        setShowSessionList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [baseGlobalSettings, setBaseGlobalSettings] = React.useState<any>(null);
  const [globalSettings, setGlobalSettings] = React.useState<any>(null);

  React.useEffect(() => {
    // Fetch global settings
    const fetchGlobalSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'globalSettings', 'config'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setBaseGlobalSettings(data);
          setGlobalSettings(data);
          setMaxPoints(Number(data.maxAttributePoints ?? 28));
          setMaxSingleAttr(Number(data.maxSingleAttributeValue ?? 10));
          setInitialSkillPoints(Number(data.initialSkillPoints ?? 10));
          setInitialPowerPoints(Number(data.initialPowerPoints ?? 5));
          setSkillPoints(Number(data.initialSkillPoints ?? 10));
          setPowerPoints(Number(data.initialPowerPoints ?? 5));
          if (data.initialMoney !== undefined) {
            setBasics(prev => ({ ...prev, money: data.initialMoney }));
          }
        }
      } catch (error) {
        console.error('Error fetching global settings:', error);
      }
    };
    fetchGlobalSettings();

    // Fetch global library (skills and powers)
    const fetchLibrary = async () => {
      try {
        const skillsSnap = await getDocs(collection(db, 'skills'));
        setAvailableSkills(skillsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const powersSnap = await getDocs(collection(db, 'powers'));
        setAvailablePowers(powersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const traitsSnap = await getDocs(collection(db, 'traits'));
        setAvailableTraits(traitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const talentsSnap = await getDocs(collection(db, 'talents'));
        setAvailableTalents(talentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const catalogSnap = await getDocs(collection(db, 'itemCatalog'));
        setItemCatalog(catalogSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching library:', error);
      }
    };
    fetchLibrary();
  }, []);

  const prevSessionIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    const isFirstRun = prevSessionIdRef.current === undefined;
    const sessionIdChanged = !isFirstRun && prevSessionIdRef.current !== basics.sessionId;
    prevSessionIdRef.current = basics.sessionId;

    const session = basics.sessionId ? sessions.find(s => s.id === basics.sessionId) : null;
    const effectiveSettings = session ? { ...baseGlobalSettings, ...session } : baseGlobalSettings;
    
    if (effectiveSettings) {
      setGlobalSettings(effectiveSettings);
      const effectiveMaxAttr = Number(session?.maxAttributePoints ?? baseGlobalSettings?.maxAttributePoints ?? 28);
      const effectiveMaxSingle = Number(session?.maxSingleAttributeValue ?? baseGlobalSettings?.maxSingleAttributeValue ?? 10);
      const effectiveSkillPts = Number(session?.initialSkillPoints ?? baseGlobalSettings?.initialSkillPoints ?? 10);
      const effectivePowerPts = Number(session?.initialPowerPoints ?? baseGlobalSettings?.initialPowerPoints ?? 5);
      const effectiveMoney = Number(session?.initialMoney ?? baseGlobalSettings?.initialMoney ?? 500);

      setMaxPoints(effectiveMaxAttr);
      setMaxSingleAttr(effectiveMaxSingle);
      setInitialSkillPoints(effectiveSkillPts);
      setInitialPowerPoints(effectivePowerPts);
      setBasics(prev => ({ ...prev, money: effectiveMoney }));
    }

    const currentAttributes = basics.sessionId 
      ? (sessions.find(s => s.id === basics.sessionId)?.attributes || baseGlobalSettings?.attributes || DEFAULT_ATTRIBUTES)
      : (baseGlobalSettings?.attributes || DEFAULT_ATTRIBUTES);
    
    if (sessionIdChanged) {
      const initialValues: Record<string, number> = {};
      currentAttributes.forEach((attr: any) => {
        initialValues[attr.id] = 0;
      });
      setValues(initialValues);
      setSkills([]);
      setPowers([]);
      // Traços (Vantagens/Defeitos) escolhidos no Passo 01 são preservados!
    } else {
      setValues(prev => {
        const next = { ...prev };
        currentAttributes.forEach((attr: any) => {
          if (next[attr.id] === undefined) next[attr.id] = 0;
        });
        return next;
      });
    }
  }, [basics.sessionId, sessions, baseGlobalSettings]);

  const availableIcons = [
    { id: 'Shield', icon: Shield },
    { id: 'Sword', icon: Sword },
    { id: 'Flame', icon: Flame },
    { id: 'Eye', icon: Eye },
    { id: 'Zap', icon: Zap },
    { id: 'Brain', icon: Brain },
    { id: 'Heart', icon: Heart },
    { id: 'Activity', icon: Activity },
    { id: 'Scroll', icon: Scroll },
    { id: 'Dice6', icon: Dice6 },
    { id: 'Sparkles', icon: Sparkles },
  ];

  const classes = [
    { name: 'Paladino', icon: Shield, color: 'arcane', image: 'https://picsum.photos/seed/paladin/400/600' },
    { name: 'Guerreiro', icon: Sword, color: 'ember', image: 'https://picsum.photos/seed/warrior/400/600' },
    { name: 'Mago', icon: Flame, color: 'arcane', image: 'https://picsum.photos/seed/mage/400/600' },
    { name: 'Ranger', icon: Eye, color: 'gold', image: 'https://picsum.photos/seed/ranger/400/600' },
    { name: 'Ladino', icon: Zap, color: 'ember', image: 'https://picsum.photos/seed/rogue/400/600' },
  ];

  const attributes = React.useMemo(() => {
    return globalSettings?.attributes || DEFAULT_ATTRIBUTES;
  }, [globalSettings]);

  const [values, setValues] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    setValues(prev => {
      const next = { ...prev };
      let changed = false;
      attributes.forEach(attr => {
        if (next[attr.id] === undefined) {
          next[attr.id] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [attributes]);

  const statsForFormula: Record<string, number> = React.useMemo(() => {
    const baseStats: Record<string, number> = {};
    attributes.forEach(attr => {
      baseStats[attr.id.toUpperCase()] = values[attr.id] || 0;
    });

    // Apply trait modifiers maintaining the configured sign and disregarding same-type modifier/effect
    selectedTraits.forEach(trait => {
      const { attrIds } = getTraitTargets(trait, attributes, []);
      const effMod = getTraitEffectiveModifier(trait);
      attrIds.forEach(attrId => {
        const upper = attrId.toUpperCase();
        if (baseStats[upper] !== undefined) {
          baseStats[upper] = (baseStats[upper] || 0) + effMod;
        }
      });
    });
    
    const skillCategoryCounts: Record<string, number> = {};
    const skillCategories = Object.keys(globalSettings?.skillTypeVars || { 'Luta': '1', 'Mística': '1' });
    
    skillCategories.forEach(cat => {
      const normalizedCat = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const count = skills.filter(s => s.type === cat).length;
      skillCategoryCounts[normalizedCat] = count;
      if (!normalizedCat.endsWith('S')) {
        skillCategoryCounts[normalizedCat + 'S'] = count;
      } else {
        skillCategoryCounts[normalizedCat.slice(0, -1)] = count;
      }
    });
    
    return resolveStatsWithVars({
      ...baseStats,
      SKILLS: skills.length,
      POWERS: powers.length,
      ...skillCategoryCounts,
    }, globalSettings?.calculationVars);
  }, [values, skills, powers, globalSettings?.calculationVars, attributes, selectedTraits]);

  const [maxPoints, setMaxPoints] = React.useState(120);
  const [maxSingleAttr, setMaxSingleAttr] = React.useState(100);

  const calculateCost = React.useCallback((baseCost: number, level: number, type: string, isPower: boolean) => {
    if (!globalSettings) return Math.max(1, Math.ceil(baseCost * level));

    const defaultPowerFormula = '(COST * LVL)';
    const formula = isPower 
      ? (globalSettings.powerCostFormula && globalSettings.powerCostFormula !== '(COST * LVL) / VAR' 
          ? globalSettings.powerCostFormula 
          : defaultPowerFormula) 
      : (globalSettings.skillCostFormula || '(COST * LVL) / VAR');
    const typeVars = isPower 
      ? (globalSettings.powerTypeVars || {}) 
      : (globalSettings.skillTypeVars || {});
    
    const typeVarValue = typeVars[type] || '1';
    
    // Resolve typeVarValue dynamically using evaluateFormula
    // This allows typeVarValue to be an attribute name or a complex formula
    const resolvedVar = Math.max(1, evaluateFormula(typeVarValue, statsForFormula));

    try {
      let evalFormula = formula.toUpperCase();
      evalFormula = evalFormula.replace(/\bCOST\b/g, baseCost.toString());
      evalFormula = evalFormula.replace(/\bLVL\b/g, level.toString());
      evalFormula = evalFormula.replace(/\bVAR\b/g, resolvedVar.toString());
      
      const rawVal = new Function(`return ${evalFormula}`)();
      // O cálculo do custo se der um valor quebrado sempre deve arredondar para cima
      return Math.max(1, Math.ceil(Number(rawVal)));
    } catch (e) {
      console.error('Error calculating cost:', e);
      return Math.max(1, Math.ceil(baseCost * level));
    }
  }, [globalSettings, values, statsForFormula]);

  const totalSkillPointsSpent = React.useMemo(() => {
    const skillsCost = skills.reduce((acc, s) => acc + calculateCost(s.purchaseCost || 1, s.level || 1, s.typeOverride || s.type, false), 0);
    return skillsCost;
  }, [skills, calculateCost]);

  const totalPowerPointsSpent = React.useMemo(() => {
    return powers.reduce((acc, p) => acc + calculateCost(p.purchaseCost || 1, p.level || 1, p.typeOverride || p.type, true), 0);
  }, [powers, calculateCost]);

  const traitBalance = React.useMemo(() => {
    const disadvantages = selectedTraits.filter(t => {
      const type = String(t.type || '').toLowerCase();
      return type === 'disadvantage' || type === 'defeito' || type === 'desvantagem';
    }).reduce((acc, t) => acc + Math.abs(Number(t.modifier) || 0), 0);

    const advantages = selectedTraits.filter(t => {
      const type = String(t.type || '').toLowerCase();
      return type === 'advantage' || type === 'vantagem';
    }).reduce((acc, t) => acc + Math.abs(Number(t.modifier) || 0), 0);

    return disadvantages - advantages;
  }, [selectedTraits]);

  const contributingTraitsByAttr = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    selectedTraits.forEach(trait => {
      const { attrIds } = getTraitTargets(trait, attributes, availableTalents);
      const effMod = getTraitEffectiveModifier(trait);
      attrIds.forEach(attrId => {
        const lower = attrId.toLowerCase();
        if (!map[lower]) map[lower] = [];
        if (!map[attrId]) map[attrId] = [];
        const item = {
          ...trait,
          effectiveMod: effMod
        };
        map[lower].push(item);
        if (lower !== attrId) map[attrId].push(item);
      });
    });
    return map;
  }, [selectedTraits, attributes, availableTalents]);

  const traitStatsMods = React.useMemo(() => {
    const mods: Record<string, number> = {};
    selectedTraits.forEach(trait => {
      const { attrIds } = getTraitTargets(trait, attributes, availableTalents);
      const effMod = getTraitEffectiveModifier(trait);
      attrIds.forEach(attrId => {
        const lower = attrId.toLowerCase();
        mods[lower] = (mods[lower] || 0) + effMod;
        if (attrId !== lower) {
          mods[attrId] = mods[lower];
        }
      });
    });
    return mods;
  }, [selectedTraits, attributes, availableTalents]);

  React.useEffect(() => {
    setSkillPoints((initialSkillPoints || 0) - totalSkillPointsSpent);
  }, [totalSkillPointsSpent, initialSkillPoints]);

  React.useEffect(() => {
    setPowerPoints(initialPowerPoints - totalPowerPointsSpent);
  }, [totalPowerPointsSpent, initialPowerPoints]);

  const filteredSkills = React.useMemo(() => {
    return availableSkills.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(skillSearch.toLowerCase());
      const matchesType = skillTypeFilter === 'all' || s.type === skillTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [availableSkills, skillSearch, skillTypeFilter]);

  const filteredPowers = React.useMemo(() => {
    return availablePowers.filter(p => {
      const searchLower = powerSearch.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(searchLower) || 
                           (p.description && p.description.toLowerCase().includes(searchLower)) ||
                           (p.effect && p.effect.toLowerCase().includes(searchLower));
      const matchesType = powerTypeFilter === 'all' || p.type === powerTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [availablePowers, powerSearch, powerTypeFilter]);

  const filteredTraits = React.useMemo(() => {
    return availableTraits.filter(t => {
      const searchLower = traitSearch.toLowerCase();
      const matchesSearch = t.name.toLowerCase().includes(searchLower) || 
                           (t.description && t.description.toLowerCase().includes(searchLower)) ||
                           (t.effect && t.effect.toLowerCase().includes(searchLower));
      const matchesType = traitTypeFilter === 'all' || t.type === traitTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [availableTraits, traitSearch, traitTypeFilter]);

  const toggleSkill = (skill: any) => {
    const isSelected = skills.some(s => s.id === skill.id);
    if (isSelected) {
      setSkills(skills.filter(s => s.id !== skill.id));
    } else {
      const cost = calculateCost(skill.purchaseCost || 1, 1, skill.type, false);
      if (skillPoints >= cost) {
        setSkills([...skills, { ...skill, level: 1, typeOverride: skill.type, descriptionOverride: '' }]);
      }
    }
  };

  const updateSkillType = (skillId: string, newType: string) => {
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, typeOverride: newType } : s));
  };

  const updateSkillDescription = (skillId: string, newDescription: string) => {
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, descriptionOverride: newDescription } : s));
  };

  const updateSkillLevel = (skillId: string, delta: number) => {
    setSkills(prev => prev.map(s => {
      if (s.id === skillId) {
        const newLevel = Math.max(1, s.level + delta);
        // Check if we have enough points for the new level
        const currentCost = calculateCost(s.purchaseCost || 1, s.level, s.typeOverride || s.type, false);
        const nextCost = calculateCost(s.purchaseCost || 1, newLevel, s.typeOverride || s.type, false);
        const costDiff = nextCost - currentCost;
        
        if (delta > 0 && skillPoints < costDiff) return s;
        return { ...s, level: newLevel };
      }
      return s;
    }));
  };

  const togglePower = (power: any) => {
    const isSelected = powers.some(p => p.id === power.id);
    if (isSelected) {
      setPowers(powers.filter(p => p.id !== power.id));
    } else {
      const cost = calculateCost(power.purchaseCost || 1, 1, power.type, true);
      if (powerPoints >= cost) {
        setPowers([...powers, { ...power, level: 1, typeOverride: power.type, descriptionOverride: '' }]);
      }
    }
  };

  const toggleTrait = (trait: any) => {
    const isSelected = selectedTraits.some(t => t.id === trait.id);
    if (isSelected) {
      setSelectedTraits(prev => prev.filter(t => t.id !== trait.id));
    } else {
      setSelectedTraits(prev => [...prev, trait]);
    }
  };

  const updatePowerType = (powerId: string, newType: string) => {
    setPowers(prev => prev.map(p => p.id === powerId ? { ...p, typeOverride: newType } : p));
  };

  const updatePowerDescription = (powerId: string, newDescription: string) => {
    setPowers(prev => prev.map(p => p.id === powerId ? { ...p, descriptionOverride: newDescription } : p));
  };

  const updatePowerLevel = (powerId: string, delta: number) => {
    setPowers(prev => prev.map(p => {
      if (p.id === powerId) {
        const newLevel = Math.max(1, p.level + delta);
        // Check if we have enough skill points for the new level
        const currentCost = calculateCost(p.purchaseCost || 1, p.level, p.typeOverride || p.type, true);
        const nextCost = calculateCost(p.purchaseCost || 1, newLevel, p.typeOverride || p.type, true);
        const costDiff = nextCost - currentCost;
        
        if (delta > 0 && powerPoints < costDiff) return p;
        return { ...p, level: newLevel };
      }
      return p;
    }));
  };

  const handleValueChange = (id: string, delta: number) => {
    const currentTotal = (Object.values(values) as number[]).reduce((a, b) => a + b, 0);
    if (delta > 0 && currentTotal >= maxPoints) return;

    setValues(prev => ({
      ...prev,
      [id]: Math.min(maxSingleAttr, Math.max(0, prev[id] + delta))
    }));
  };

  const getModifier = (value: number) => {
    const mod = Math.floor((value - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const handleQuickRoll = (attrLabel: string, attrValue: number, difficulty: 'easy' | 'normal' | 'hard' | 'extreme' = 'normal', diceSides: number = 20) => {
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
      rollingAudioRef.current = null;
    }
    
    const s = globalSettings || {};
    const dSound = s.diceRollSound || 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3';
    const sSound = s.successSound || 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3';
    const fSound = s.failureSound || 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
    const cSound = s.criticalSound || 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3';
    const fbSound = s.fumbleSound || 'https://assets.mixkit.co/active_storage/sfx/2550/2550-preview.mp3';

    // Play rolling sound (shortened)
    rollingAudioRef.current = playAudio(dSound, 0.4);

    let target = attrValue;
    let diffLabel = 'Normal';
    
    const easyMod = globalSettings?.diffEasyMod ?? 2;
    const hardDiv = globalSettings?.diffHardDiv ?? 2;
    const extremeDiv = globalSettings?.diffExtremeDiv ?? 5;

    if (difficulty === 'easy') {
      target += easyMod;
      diffLabel = 'Fácil';
    } else if (difficulty === 'hard') {
      target = Math.floor(attrValue / hardDiv);
      diffLabel = 'Difícil';
    } else if (difficulty === 'extreme') {
      target = Math.floor(attrValue / extremeDiv);
      diffLabel = 'Extremo';
    }
    
    const roll = Math.floor(Math.random() * diceSides) + 1;
    const isCritical = roll === 1;
    const isFumble = roll === diceSides;
    const success = roll <= target;
    
    // Pre-initialize success/fail sounds
    const criticalAudio = new Audio(cSound);
    const fumbleAudio = new Audio(fbSound);
    const successAudio = new Audio(sSound);
    const failureAudio = new Audio(fSound);
    
    setQuickRoll({ 
      result: 0, 
      success: false, 
      attr: `${attrLabel} [${diffLabel}]`,
      target,
      type: 'test',
      diceSides,
      rolling: true
    });

    setTimeout(() => {
      // Stop rolling sound
      if (rollingAudioRef.current) {
        rollingAudioRef.current.pause();
        rollingAudioRef.current = null;
      }

      setQuickRoll({ 
        result: roll, 
        success, 
        attr: `${attrLabel} [${diffLabel}]`,
        target,
        type: 'test',
        diceSides,
        rolling: false,
        isCritical,
        isFumble
      });

      if (isCritical) {
        criticalAudio.volume = 0.6;
        criticalAudio.play().catch(() => {});
      } else if (isFumble) {
        fumbleAudio.volume = 0.6;
        fumbleAudio.play().catch(() => {});
      } else if (success) {
        successAudio.volume = 0.5;
        successAudio.play().catch(() => {});
      } else {
        failureAudio.volume = 0.5;
        failureAudio.play().catch(() => {});
      }

      rollTimeoutRef.current = setTimeout(() => setQuickRoll(null), 5000);
    }, 1000);
  };

  const handleFormulaRoll = (label: string, formula: string) => {
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
      rollingAudioRef.current = null;
    }
    
    const s = globalSettings || {};
    const dSound = s.diceRollSound || 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3';
    const sSound = s.successSound || 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3';

    // Play rolling sound
    rollingAudioRef.current = playAudio(dSound, 0.4);

    if (!formula) return;
    const result = rollDiceFormula(formula, statsForFormula);
    
    // Pre-initialize sound
    const damageAudio = new Audio(sSound);
    
    setQuickRoll({ 
      result: 0, 
      attr: label,
      type: 'damage',
      rolling: true
    });

    setTimeout(() => {
      // Stop rolling sound
      if (rollingAudioRef.current) {
        rollingAudioRef.current.pause();
        rollingAudioRef.current = null;
      }

      setQuickRoll({ 
        result: result.total, 
        attr: label,
        type: 'damage',
        rolling: false
      });
      
      damageAudio.volume = 0.5;
      damageAudio.play().catch(() => {});

      rollTimeoutRef.current = setTimeout(() => setQuickRoll(null), 5000);
    }, 1000);
  };

  const handleSaveCharacter = async () => {
    if (!auth.currentUser || !basics.sessionId) return;
    setLoading(true);
    try {
      const characterId = crypto.randomUUID();

      const cleanTraits = selectedTraits.map(t => ({
        id: String(t.id || Math.random().toString(36).substring(2, 9)),
        name: String(t.name || ''),
        description: String(t.description || ''),
        effect: String(t.effect || ''),
        modifier: Number(t.modifier) || 0,
        modifierType: String(t.modifierType || 'for'),
        type: (String(t.type || '').toLowerCase() === 'disadvantage' || String(t.type || '').toLowerCase() === 'defeito' || String(t.type || '').toLowerCase() === 'desvantagem')
          ? 'disadvantage'
          : 'advantage'
      }));

      const advantagesList = cleanTraits.filter(t => t.type === 'advantage');
      const disadvantagesList = cleanTraits.filter(t => t.type === 'disadvantage');

      const characterData = {
        id: characterId,
        ownerId: auth.currentUser.uid,
        name: basics.name || 'Sem Nome',
        class: basics.class || 'Aventureiro',
        money: basics.money,
        level: 1,
        xp: 0,
        xpMax: 1000,
        image: basics.image || 'https://picsum.photos/seed/adventurer/400/600',
        color: basics.color,
        icon: basics.icon,
        sessionId: basics.sessionId,
        stats: values,
        baseStats: values,
        statsMods: {},
        canEditStats: false,
        skills: skills.map(s => s.id),
        skillOverrides: skills.reduce((acc, s) => {
          acc[s.id] = { 
            type: s.typeOverride || s.type,
            description: s.descriptionOverride || '',
            level: s.level || 1
          };
          return acc;
        }, {} as any),
        powers: powers.map(p => p.id),
        powerOverrides: powers.reduce((acc, p) => {
          acc[p.id] = { 
            type: p.typeOverride || p.type,
            description: p.descriptionOverride || '',
            level: p.level || 1
          };
          return acc;
        }, {} as any),
        traits: cleanTraits.map(t => t.id),
        traitObjects: cleanTraits,
        advantages: advantagesList,
        disadvantages: disadvantagesList,
        equipment,
        attributePoints: 0,
        skillPoints: Math.max(0, skillPoints),
        powerPoints: Math.max(0, powerPoints),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'characters', characterId), characterData);
      setSaveStatus({ type: 'success', message: 'Personagem criado com sucesso!' });
      setTimeout(() => navigate('/'), 1000);
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Erro ao criar personagem.' });
      handleFirestoreError(error, OperationType.WRITE, 'characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
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
            {saveStatus.type === 'success' ? <Check size={20} /> : 
             saveStatus.type === 'error' ? <X size={20} /> : 
             <Info size={20} />}
            <span className="font-medium">{saveStatus.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Stepper */}
      <div className="flex items-center justify-between px-2 sm:px-4">
        {steps.map((s, idx) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-2 relative">
              <button
                type="button"
                onClick={() => {
                  if (idx + 1 > 2 && (!basics.sessionId || !basics.name)) {
                    setTouched({ name: true, sessionId: true });
                    setStep(2);
                    return;
                  }
                  setStep(idx + 1);
                }}
                className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 cursor-pointer hover:scale-105",
                  step > idx + 1 ? "bg-arcane border-arcane text-obsidian" :
                  step === idx + 1 ? "border-arcane text-arcane shadow-[0_0_15px_rgba(71,214,255,0.3)]" :
                  "border-white/10 text-parchment/20 hover:border-white/30"
                )}
                title={`Ir para ${s}`}
              >
                {step > idx + 1 ? <Sparkles size={14} className="sm:w-[18px] sm:h-[18px]" /> : <span className="text-xs sm:text-sm font-mono">{idx + 1}</span>}
              </button>
              <span className={cn(
                "text-[8px] sm:text-[10px] font-mono uppercase tracking-widest absolute -bottom-6 whitespace-nowrap hidden sm:block",
                step === idx + 1 ? "text-arcane" : "text-parchment/20"
              )}>
                {s}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 sm:mx-4 rounded-full transition-all duration-500",
                step > idx + 1 ? "bg-arcane" : "bg-white/10"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="pt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-serif mb-2">Vantagens & Defeitos</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 01: Traços de Personalidade e Destino</p>
                  </div>
                  <div className="glass px-6 py-3 rounded-2xl border border-arcane/30 bg-arcane/5 flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Saldo de Modificadores</p>
                      <p className={cn(
                        "text-2xl font-serif",
                        traitBalance >= 0 ? "text-arcane" : "text-ember"
                      )}>
                        {traitBalance > 0 ? `+${traitBalance}` : traitBalance}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-arcane/10 flex items-center justify-center text-arcane">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </header>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar vantagem ou defeito..."
                      value={traitSearch}
                      onChange={e => setTraitSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="sm:w-48 relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                    <select
                      value={traitTypeFilter}
                      onChange={e => setTraitTypeFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                    >
                      <option value="all" className="bg-obsidian">Todos</option>
                      <option value="advantage" className="bg-obsidian">Vantagens</option>
                      <option value="disadvantage" className="bg-obsidian">Defeitos</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => setShowTraitSuggestion(true)}
                    className="px-6 py-4 bg-arcane/10 hover:bg-arcane/20 text-arcane rounded-2xl font-mono text-xs uppercase tracking-widest border border-arcane/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Sugerir Defeito
                  </button>
                </div>

                {/* Trait Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                  {filteredTraits.map((trait) => {
                    const isSelected = selectedTraits.some(t => t.id === trait.id);
                    const isAdvantage = trait.type === 'advantage';
                    return (
                      <div
                        key={trait.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleTrait(trait)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleTrait(trait);
                          }
                        }}
                        className={cn(
                          "glass p-6 rounded-3xl text-left transition-all border group relative cursor-pointer select-none",
                          isSelected 
                            ? (isAdvantage ? "border-arcane bg-arcane/10 shadow-lg shadow-arcane/5" : "border-ember bg-ember/10 shadow-lg shadow-ember/5") 
                            : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h4 className="font-serif text-xl group-hover:text-arcane transition-colors pr-2 leading-tight">{trait.name}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest font-bold",
                              isAdvantage ? "bg-arcane text-obsidian" : "bg-ember text-obsidian"
                            )}>
                              {trait.modifier > 0 ? `+${trait.modifier}` : trait.modifier} pts
                            </div>
                            {/* Info icon in the top right corner */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailTrait(trait);
                              }}
                              className="p-1 rounded-full hover:bg-white/15 text-parchment/40 hover:text-arcane transition-all cursor-pointer"
                              title="Ver detalhes do traço"
                            >
                              <Info size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-parchment/50 mb-4 line-clamp-2 leading-relaxed">{trait.description}</p>
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/60 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <Activity size={12} className={isAdvantage ? "text-arcane" : "text-ember"} /> 
                              {trait.type === 'advantage' ? 'Vantagem' : 'Defeito'}
                            </span>
                            {trait.modifierType && (
                              <span className="flex items-center gap-1 font-sans capitalize font-medium text-parchment/80">
                                <Target size={12} className={isAdvantage ? "text-arcane" : "text-ember"} /> 
                                {getTraitTargetDisplayName(trait.modifierType, attributes, availableTalents)}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <div className={cn(
                              "flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-bold",
                              isAdvantage ? "text-arcane" : "text-ember"
                            )}>
                              <Check size={14} /> Selecionado
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredTraits.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-parchment/20">
                        <Sparkles size={32} />
                      </div>
                      <p className="text-parchment/40 font-mono text-sm">Nenhum traço encontrado com esses filtros.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    onClick={() => setStep(2)}
                    className="px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <span>Continuar para Origens</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif mb-2">Origens da Lenda</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 02: Nome, Vocação e Campanha</p>
                </header>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Personagem</label>
                    <input 
                      type="text" 
                      value={basics.name || ''}
                      onChange={e => setBasics({...basics, name: e.target.value})}
                      onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                      placeholder="Ex: Aethelgard, o Destemido"
                      className={cn(
                        "w-full bg-white/5 border rounded-2xl px-6 py-4 text-xl font-serif focus:outline-none transition-colors",
                        touched.name && !basics.name ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                      )}
                    />
                    {touched.name && !basics.name && (
                      <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O nome é obrigatório</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Sua Vocação (Nome)</label>
                    <input 
                      type="text" 
                      value={basics.class || ''}
                      onChange={e => setBasics({...basics, class: e.target.value})}
                      placeholder="Ex: Paladino, Caçador de Sombras..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl font-serif focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Vincular a uma Campanha (Obrigatório)</label>
                    <div className="relative">
                      <Search className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
                        showSessionList ? "text-arcane" : "text-parchment/20"
                      )} size={18} />
                      <input 
                        ref={sessionInputRef}
                        type="text" 
                        value={sessionSearch || ''}
                        onChange={e => {
                          setSessionSearch(e.target.value);
                          setShowSessionList(true);
                          setSessionIndex(0);
                          if (basics.sessionId) setBasics({...basics, sessionId: ''});
                        }}
                        onFocus={() => setShowSessionList(true)}
                        onKeyDown={(e) => {
                          if (showSessionList && filteredSessions.length > 0) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setSessionIndex(prev => (prev + 1) % filteredSessions.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setSessionIndex(prev => (prev - 1 + filteredSessions.length) % filteredSessions.length);
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              const session = filteredSessions[sessionIndex];
                              if (session) {
                                setBasics({...basics, sessionId: session.id});
                                setSessionSearch(session.displayText);
                                setShowSessionList(false);
                              }
                            } else if (e.key === 'Escape') {
                              setShowSessionList(false);
                            }
                          }
                        }}
                        placeholder="Busque por código ou nome da campanha..."
                        className={cn(
                          "w-full bg-white/5 border rounded-2xl pl-12 pr-6 py-4 text-xl font-serif focus:outline-none transition-colors",
                          touched.sessionId && !basics.sessionId ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                        )}
                      />
                      {touched.sessionId && !basics.sessionId && (
                        <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">Selecione uma campanha</p>
                      )}
                      
                      <AnimatePresence>
                        {showSessionList && (
                          <motion.div 
                            ref={sessionListRef}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute z-50 w-full mt-2 glass-popup bg-obsidian/85 backdrop-blur-xl rounded-2xl border border-white/25 overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
                          >
                            {filteredSessions.length > 0 ? (
                              filteredSessions.map((session, i) => (
                                <button
                                  key={session.id}
                                  onMouseEnter={() => setSessionIndex(i)}
                                  onClick={() => {
                                    setBasics({...basics, sessionId: session.id});
                                    setSessionSearch(session.displayText);
                                    setShowSessionList(false);
                                  }}
                                  className={cn(
                                    "w-full px-6 py-4 text-left transition-colors border-b border-white/5 last:border-none flex items-center justify-between group",
                                    sessionIndex === i ? "bg-white/10" : "hover:bg-white/5"
                                  )}
                                >
                                  <div className="flex flex-col">
                                    <p className={cn(
                                      "font-serif text-lg transition-colors",
                                      sessionIndex === i ? "text-arcane" : "text-parchment"
                                    )}>{session.displayText}</p>
                                    <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Mestre: {session.gmName}</span>
                                  </div>
                                  {sessionIndex === i && (
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-arcane/60 animate-pulse uppercase">
                                      <ChevronRight size={12} />
                                      <span>Enter</span>
                                    </div>
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="px-6 py-8 text-center space-y-2">
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto text-parchment/20">
                                  <Search size={20} />
                                </div>
                                <p className="text-parchment/40 font-mono text-[10px] uppercase tracking-widest">Nenhuma campanha encontrada</p>
                                <p className="text-[9px] text-parchment/20 italic">Tente buscar por um código diferente ou nome do mestre.</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {basics.sessionId && !showSessionList && (
                      <div className="flex items-center gap-2 px-2">
                        <Check size={14} className="text-arcane" />
                        <span className="text-[10px] text-arcane font-mono uppercase tracking-widest">Campanha Selecionada</span>
                      </div>
                    )}
                    {sessions.length === 0 ? (
                      <p className="text-[10px] text-ember font-mono px-2">Nenhuma campanha disponível no sistema.</p>
                    ) : (
                      <p className="text-[10px] text-parchment/40 font-mono px-2">Busque pelo código ou nome para selecionar a campanha.</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Imagem do Personagem (Avatar / Retrato)</label>
                      <button
                        type="button"
                        onClick={() => setIsImageModalOpen(true)}
                        className="text-xs font-mono text-arcane hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <ImageIcon size={14} />
                        Escolher Imagem
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl glass border border-white/10">
                      <div 
                        onClick={() => setIsImageModalOpen(true)}
                        className="relative group cursor-pointer shrink-0"
                        title="Clique para alterar a imagem"
                      >
                        <div className="w-20 h-24 rounded-2xl overflow-hidden border-2 border-arcane/50 bg-white/5 relative group-hover:scale-105 transition-transform">
                          {basics.image ? (
                            <img 
                              src={basics.image} 
                              alt="Retrato do Personagem" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-parchment/30">
                              <ImageIcon size={24} />
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white">
                          <Camera size={18} />
                          <span className="text-[9px] font-mono mt-0.5">Alterar</span>
                        </div>
                      </div>

                      <div className="flex-1 w-full space-y-2">
                        <p className="text-xs text-parchment/70 font-serif">
                          Insira uma URL direta ou faça upload da imagem do seu herói:
                        </p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={basics.image || ''}
                            onChange={e => setBasics({...basics, image: e.target.value})}
                            placeholder="https://exemplo.com/imagem.png"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setIsImageModalOpen(true)}
                            className="px-4 py-2.5 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                          >
                            <ImageIcon size={14} />
                            Galeria / Upload
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Escolha o Ícone da Vocação</label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-3">
                      {availableIcons.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setBasics({ ...basics, icon: item.id })}
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                            basics.icon === item.id ? "border-arcane bg-arcane/10 shadow-[0_0_15px_rgba(71,214,255,0.2)]" : "border-white/10 hover:border-white/20"
                          )}
                        >
                          <item.icon size={20} className={basics.icon === item.id ? "text-arcane" : "text-parchment/40"} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Ou escolha um arquétipo pronto</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {classes.map((cls) => (
                        <button
                          key={cls.name}
                          onClick={() => setBasics({
                            ...basics, 
                            class: cls.name, 
                            color: cls.color,
                            image: cls.image,
                            icon: cls.name === 'Paladino' ? 'Shield' : 
                                  cls.name === 'Guerreiro' ? 'Sword' :
                                  cls.name === 'Mago' ? 'Flame' :
                                  cls.name === 'Ranger' ? 'Eye' : 'Zap'
                          })}
                          className={cn(
                            "glass p-6 rounded-3xl flex items-center gap-4 transition-all border",
                            basics.class === cls.name ? "border-arcane bg-arcane/10 shadow-[0_0_20px_rgba(71,214,255,0.1)]" : "border-white/10 hover:border-white/20"
                          )}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center",
                            cls.color === 'arcane' ? "bg-arcane/20 text-arcane" : 
                            cls.color === 'ember' ? "bg-ember/20 text-ember" : "bg-gold/20 text-gold"
                          )}>
                            <cls.icon size={24} />
                          </div>
                          <div className="text-left">
                            <h4 className="font-serif text-lg">{cls.name}</h4>
                            <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">Vocação</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <button 
                    onClick={() => setStep(1)}
                    className="px-6 py-4 glass text-parchment/70 hover:text-white rounded-2xl font-mono text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft size={16} />
                    <span>Voltar para Vantagens/Defeitos</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (!basics.name || !basics.sessionId) {
                        setTouched({ name: true, sessionId: true });
                        return;
                      }
                      setStep(3);
                    }}
                    className={cn(
                      "px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform",
                      (!basics.name || !basics.sessionId) && "opacity-50"
                    )}
                  >
                    <span>Continuar para Atributos</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-serif mb-2">Defina seus Atributos</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 03: A Essência do Herói</p>
                  </div>
                  <div className="glass px-6 py-3 rounded-2xl border border-arcane/30 bg-arcane/5 flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos Restantes</p>
                      <p className={cn(
                        "text-2xl font-serif",
                        (maxPoints - (Object.values(values) as number[]).reduce((a, b) => a + b, 0)) === 0 ? "text-gold" : "text-arcane"
                      )}>
                        {maxPoints - (Object.values(values) as number[]).reduce((a, b) => a + b, 0)} / {maxPoints}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-arcane/10 flex items-center justify-center text-arcane">
                      <Dice6 size={24} />
                    </div>
                  </div>
                </header>

                {/* Banner de Modificadores Adquiridos com Vantagens e Defeitos */}
                {selectedTraits.length > 0 ? (
                  <div className="glass p-5 rounded-3xl border border-arcane/20 bg-arcane/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-arcane" />
                        <h4 className="font-serif text-base text-parchment/90">Modificadores de Traços Adquiridos</h4>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-parchment/50">
                        {selectedTraits.length} {selectedTraits.length === 1 ? 'traço selecionado' : 'traços selecionados'} no Passo 01
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {attributes.map(attr => {
                        const mod = traitStatsMods[attr.id.toLowerCase()] || 0;
                        if (!mod) return null;
                        const isPositive = mod > 0;
                        return (
                          <div 
                            key={attr.id}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border shadow-sm",
                              isPositive 
                                ? "bg-arcane/15 border-arcane/40 text-arcane" 
                                : "bg-ember/15 border-ember/40 text-ember"
                            )}
                          >
                            <span>{attr.label}:</span>
                            <span className="text-sm font-serif">{isPositive ? `+${mod}` : mod}</span>
                          </div>
                        );
                      })}
                      {Object.keys(traitStatsMods).length === 0 && (
                        <p className="text-xs font-mono text-parchment/40 italic">
                          Os traços selecionados não possuem bônus numéricos diretos em atributos.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="glass p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between text-xs text-parchment/40 font-mono">
                    <span>Nenhum traço selecionado ainda no Passo 01.</span>
                    <button 
                      type="button" 
                      onClick={() => setStep(1)} 
                      className="text-arcane hover:underline flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <ChevronLeft size={14} />
                      <span>Ir ao Passo 01 (Vantagens/Defeitos)</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {attributes.map((attr, idx) => {
                    const traitMod = traitStatsMods[attr.id.toLowerCase()] || 0;
                    const contributingTraits = contributingTraitsByAttr[attr.id.toLowerCase()] || [];
                    const effectiveValue = (values[attr.id] || 0) + traitMod;

                    return (
                      <motion.div
                        key={attr.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                          "glass p-6 rounded-3xl group hover:bg-white/10 transition-all border",
                          traitMod > 0 ? "border-arcane/30 bg-arcane/[0.02]" :
                          traitMod < 0 ? "border-ember/30 bg-ember/[0.02]" :
                          "border-white/10 hover:border-arcane/30"
                        )}
                      >
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-3 rounded-2xl bg-white/5", attr.color)}>
                              {React.createElement(getIcon(attr.icon), { size: 24 })}
                            </div>
                            <div>
                              <h4 className="font-serif text-xl">{attr.label}</h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-parchment/60 font-mono uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                  Base: {values[attr.id] || 0}
                                </span>
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border",
                                  traitMod > 0 ? "bg-arcane/20 text-arcane border-arcane/30 shadow-[0_0_10px_rgba(71,214,255,0.2)]" :
                                  traitMod < 0 ? "bg-ember/20 text-ember border-ember/30 shadow-[0_0_10px_rgba(255,107,107,0.2)]" :
                                  "bg-white/5 text-parchment/40 border-white/10"
                                )}>
                                  {traitMod > 0 ? `+${traitMod}` : traitMod} Traço
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-3xl font-serif text-glow-arcane leading-none">
                              {effectiveValue}
                              <span className="text-xs text-parchment/20 ml-1">/ {maxSingleAttr}</span>
                            </div>
                            <p className="text-[9px] text-parchment/40 font-mono uppercase tracking-wider mt-1">
                              {traitMod !== 0 
                                ? `Total Efetivo (${values[attr.id] || 0} ${traitMod > 0 ? `+ ${traitMod}` : `- ${Math.abs(traitMod)}`})` 
                                : `Mod: ${getModifier(values[attr.id] || 0)}`}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-parchment/40 mb-4 leading-relaxed">{attr.description}</p>

                        {/* Lista de traços que afetam este atributo */}
                        {contributingTraits.length > 0 && (
                          <div className="mb-4 p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                            <p className="text-[9px] font-mono uppercase tracking-widest text-parchment/40 flex items-center gap-1">
                              <Sparkles size={11} className="text-arcane" />
                              Modificador de Vantagens/Defeitos:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {contributingTraits.map((t: any) => (
                                <span
                                  key={t.id}
                                  className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-lg font-mono flex items-center gap-1 font-semibold",
                                    t.type === 'advantage' 
                                      ? "bg-arcane/15 text-arcane border border-arcane/25" 
                                      : "bg-ember/15 text-ember border border-ember/25"
                                  )}
                                  title={t.description || t.effect}
                                >
                                  {t.name}: {t.effectiveMod > 0 ? `+${t.effectiveMod}` : t.effectiveMod}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleValueChange(attr.id, -1)}
                            className="flex-1 py-3 glass rounded-xl hover:bg-ember/10 hover:text-ember transition-all text-xl font-serif"
                          >
                            -
                          </button>
                          <button 
                            onClick={() => handleValueChange(attr.id, 1)}
                            className="flex-1 py-3 glass rounded-xl hover:bg-arcane/10 hover:text-arcane transition-all text-xl font-serif"
                          >
                            +
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-6">
                  <button 
                    onClick={() => setStep(2)}
                    className="px-6 py-4 glass text-parchment/70 hover:text-white rounded-2xl font-mono text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-all"
                  >
                    <ChevronLeft size={16} />
                    <span>Voltar para Origens</span>
                  </button>
                  <button 
                    onClick={() => setStep(4)}
                    className="px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <span>Continuar para Perícias</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-serif mb-2">Escolha suas Perícias</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 04: Talentos e Especialidades</p>
                  </div>
                  <div className="glass px-6 py-3 rounded-2xl border border-arcane/30 bg-arcane/5 flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos de Perícia</p>
                      <p className={cn(
                        "text-2xl font-serif",
                        skillPoints === 0 ? "text-gold" : "text-arcane"
                      )}>
                        {skillPoints} / {initialSkillPoints}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-arcane/10 flex items-center justify-center text-arcane">
                      <Brain size={24} />
                    </div>
                  </div>
                </header>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                    <input 
                      type="text"
                      placeholder="Buscar perícia por nome..."
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="sm:w-48 relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                    <select
                      value={skillTypeFilter}
                      onChange={e => setSkillTypeFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                    >
                      <option value="all" className="bg-obsidian">Todos</option>
                      <option value="Luta" className="bg-obsidian">Luta</option>
                      <option value="Mística" className="bg-obsidian">Mística</option>
                      <option value="Geral" className="bg-obsidian">Geral</option>
                      <option value="Conhecimento" className="bg-obsidian">Conhecimento</option>
                      <option value="Artes" className="bg-obsidian">Artes</option>
                      <option value="Treinamento" className="bg-obsidian">Treinamento</option>
                      <option value="Ocultismo" className="bg-obsidian">Ocultismo</option>
                      <option value="Empírico" className="bg-obsidian">Empírico</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => setShowSkillSuggestion(true)}
                    className="px-6 py-4 bg-arcane/10 hover:bg-arcane/20 text-arcane rounded-2xl font-mono text-xs uppercase tracking-widest border border-arcane/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Sugerir Perícia
                  </button>
                </div>

                {/* Skill Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                  {filteredSkills.map((skill) => {
                    const isSelected = skills.some(s => s.id === skill.id);
                    return (
                      <div
                        key={skill.id}
                        onClick={() => toggleSkill(skill)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSkill(skill); }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "glass p-6 rounded-3xl text-left transition-all border group relative cursor-pointer",
                          isSelected ? "border-arcane bg-arcane/10" : "border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-serif text-xl group-hover:text-arcane transition-colors">{skill.name}</h4>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest",
                            isSelected ? "bg-arcane text-obsidian" : "bg-white/5 text-parchment/40"
                          )}>
                            {isSelected 
                              ? calculateCost(skill.purchaseCost || 1, skills.find(s => s.id === skill.id)?.level || 1, skills.find(s => s.id === skill.id)?.typeOverride || skill.type, false)
                              : calculateCost(skill.purchaseCost || 1, 1, skill.type, false)
                            } pts
                          </div>
                        </div>
                        <p className="text-xs text-parchment/40 mb-4 line-clamp-2">{skill.description}</p>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/60 uppercase tracking-wider">
                          <span className="flex items-center gap-1"><Activity size={12} /> {isSelected ? skills.find(s => s.id === skill.id)?.typeOverride : skill.type}</span>
                          <span className="flex items-center gap-1"><Sparkles size={12} /> Nvl {isSelected ? skills.find(s => s.id === skill.id)?.level : 1}</span>
                          {skill.atpCost > 0 && <span className="flex items-center gap-1"><Zap size={12} /> {skill.atpCost} ATP</span>}
                          {skill.damage && <span className="flex items-center gap-1"><Sword size={12} /> {skill.damage}</span>}
                          {skill.difficultyFormula && (
                            <span className="flex items-center gap-1">
                              <Brain size={12} /> 
                              Dif: {evaluateFormula(skill.difficultyFormula, statsForFormula)}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Nível da Perícia</label>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateSkillLevel(skill.id, -1); }}
                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-ember/10 transition-colors"
                                  >
                                    -
                                  </button>
                                  <span className="text-sm font-serif">{skills.find(s => s.id === skill.id)?.level || 1}</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateSkillLevel(skill.id, 1); }}
                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-arcane/10 transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Alterar Tipo (Opcional)</label>
                                <select 
                                  value={skills.find(s => s.id === skill.id)?.typeOverride || skill.type}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updateSkillType(skill.id, e.target.value)}
                                  className="w-full bg-obsidian/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-arcane/50"
                                >
                                  <option value="Luta">Luta</option>
                                  <option value="Mística">Mística</option>
                                  <option value="Geral">Geral</option>
                                  <option value="Conhecimento">Conhecimento</option>
                                  <option value="Artes">Artes</option>
                                  <option value="Treinamento">Treinamento</option>
                                  <option value="Ocultismo">Ocultismo</option>
                                  <option value="Empírico">Empírico</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Descrição Customizada (Opcional)</label>
                              <textarea
                                value={skills.find(s => s.id === skill.id)?.descriptionOverride || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateSkillDescription(skill.id, e.target.value)}
                                placeholder="Adicione detalhes específicos para sua perícia..."
                                className="w-full bg-obsidian/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-arcane/50 resize-none h-16"
                              />
                            </div>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 text-arcane">
                            <Check size={16} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredSkills.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-parchment/20">
                        <Brain size={32} />
                      </div>
                      <p className="text-parchment/40 font-mono text-sm">Nenhuma perícia encontrada com esses filtros.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    onClick={() => setStep(5)}
                    className="px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <span>Continuar para Poderes</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-serif mb-2">Escolha seus Poderes</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 05: Dons e Habilidades Especiais</p>
                  </div>
                  <div className="glass px-6 py-3 rounded-2xl border border-arcane/30 bg-arcane/5 flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos de poder Disponíveis</p>
                      <p className={cn(
                        "text-2xl font-serif",
                        powerPoints === 0 ? "text-gold" : "text-arcane"
                      )}>
                        {powerPoints} / {(initialPowerPoints || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-arcane/10 flex items-center justify-center text-arcane">
                      <Brain size={24} />
                    </div>
                  </div>
                </header>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar poder por nome ou efeito..."
                      value={powerSearch}
                      onChange={e => setPowerSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="sm:w-48 relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                    <select
                      value={powerTypeFilter}
                      onChange={e => setPowerTypeFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                    >
                      <option value="all" className="bg-obsidian">Todos</option>
                      <option value="Físico" className="bg-obsidian">Físico</option>
                      <option value="Elemental" className="bg-obsidian">Elemental</option>
                      <option value="Defesa" className="bg-obsidian">Defesa</option>
                      <option value="Buff" className="bg-obsidian">Buff</option>
                      <option value="Debuff" className="bg-obsidian">Debuff</option>
                      <option value="Geral" className="bg-obsidian">Geral</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => setShowPowerSuggestion(true)}
                    className="px-6 py-4 bg-ember/10 hover:bg-ember/20 text-ember rounded-2xl font-mono text-xs uppercase tracking-widest border border-ember/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Sugerir Poder
                  </button>
                </div>

                {/* Power Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                  {filteredPowers.map((power) => {
                    const isSelected = powers.some(p => p.id === power.id);
                    return (
                      <div
                        key={power.id}
                        onClick={() => togglePower(power)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') togglePower(power); }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "glass p-6 rounded-3xl text-left transition-all border group relative cursor-pointer",
                          isSelected ? "border-ember bg-ember/10" : "border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-serif text-xl group-hover:text-ember transition-colors">{power.name}</h4>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest",
                            isSelected ? "bg-ember text-obsidian" : "bg-white/5 text-parchment/40"
                          )}>
                            {isSelected 
                              ? calculateCost(power.purchaseCost || 1, powers.find(p => p.id === power.id)?.level || 1, powers.find(p => p.id === power.id)?.typeOverride || power.type, true)
                              : calculateCost(power.purchaseCost || 1, 1, power.type, true)
                            } pts de perícia
                          </div>
                        </div>
                        <p className="text-xs text-parchment/40 mb-4 line-clamp-2">{power.description}</p>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/60 uppercase tracking-wider">
                          <span className="flex items-center gap-1"><Activity size={12} /> {isSelected ? powers.find(p => p.id === power.id)?.typeOverride : power.type}</span>
                          <span className="flex items-center gap-1"><Sparkles size={12} /> Nvl {isSelected ? powers.find(p => p.id === power.id)?.level : 1}</span>
                          {power.cost && <span className="flex items-center gap-1"><Zap size={12} /> {power.cost}</span>}
                          {power.difficultyFormula && (
                            <span className="flex items-center gap-1">
                              <Brain size={12} /> 
                              Dif: {evaluateFormula(power.difficultyFormula, statsForFormula)}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Nível do Poder</label>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updatePowerLevel(power.id, -1); }}
                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-ember/10 transition-colors"
                                  >
                                    -
                                  </button>
                                  <span className="text-sm font-serif">{powers.find(p => p.id === power.id)?.level || 1}</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updatePowerLevel(power.id, 1); }}
                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-arcane/10 transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Alterar Tipo (Opcional)</label>
                                <select 
                                  value={powers.find(p => p.id === power.id)?.typeOverride || power.type}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updatePowerType(power.id, e.target.value)}
                                  className="w-full bg-obsidian/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-arcane/50"
                                >
                                  <option value="Físico">Físico</option>
                                  <option value="Elemental">Elemental</option>
                                  <option value="Defesa">Defesa</option>
                                  <option value="Buff">Buff</option>
                                  <option value="Debuff">Debuff</option>
                                  <option value="Geral">Geral</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest">Descrição Customizada (Opcional)</label>
                              <textarea
                                value={powers.find(p => p.id === power.id)?.descriptionOverride || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updatePowerDescription(power.id, e.target.value)}
                                placeholder="Adicione detalhes específicos para seu poder..."
                                className="w-full bg-obsidian/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-ember/50 resize-none h-16"
                              />
                            </div>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 text-ember">
                            <Check size={16} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredPowers.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-parchment/20">
                        <Sparkles size={32} />
                      </div>
                      <p className="text-parchment/40 font-mono text-sm">Nenhum poder encontrado com esses filtros.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    onClick={() => setStep(6)}
                    className="px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <span>Continuar para Equipamento</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h2 className="text-4xl font-serif">Equipamento & Inventário</h2>
                      <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 06: Arsenal e Suprimentos</p>
                    </div>
                    <div className="flex items-center gap-3 bg-gold/10 px-6 py-3 rounded-2xl border border-gold/30">
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-gold/60 uppercase tracking-widest">Ouro Inicial</p>
                        <p className="text-xl font-serif text-gold">{basics.money} MO</p>
                      </div>
                      <div className="w-10 h-10 bg-gold/20 rounded-full flex items-center justify-center text-gold">
                        <Dice6 size={20} />
                      </div>
                    </div>
                  </div>
                </header>

                {/* Equipment Form */}
                <div className="glass p-8 rounded-[2.5rem] space-y-6 border border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-serif flex items-center gap-2">
                      <Plus className="text-arcane" size={20} />
                      Adicionar Novo Equipamento
                    </h3>
                    <button 
                      onClick={() => setShowCatalog(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-arcane/10 hover:bg-arcane/20 text-arcane rounded-xl font-mono text-[10px] uppercase tracking-widest border border-arcane/30 transition-all"
                    >
                      <Search size={14} />
                      Buscar no Catálogo
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                      <input 
                        type="text" 
                        value={newEquip.name || ''}
                        onChange={e => setNewEquip({...newEquip, name: e.target.value})}
                        placeholder="Ex: Espada Longa"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                      <input 
                        type="text" 
                        value={newEquip.damage || ''}
                        onChange={e => setNewEquip({...newEquip, damage: e.target.value})}
                        placeholder="Ex: 1d8+FOR"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Quantidade</label>
                      <input 
                        type="number" 
                        value={newEquip.quantity ?? 1}
                        onChange={e => setNewEquip({...newEquip, quantity: parseInt(e.target.value) || 1})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Munição</label>
                      <input 
                        type="text" 
                        value={newEquip.ammo || ''}
                        onChange={e => setNewEquip({...newEquip, ammo: e.target.value})}
                        placeholder="Ex: 20 flechas ou -"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Defesa</label>
                      <input 
                        type="number" 
                        value={newEquip.defense ?? 0}
                        onChange={e => setNewEquip({...newEquip, defense: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-3 px-2 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={newEquip.equipped}
                          onChange={e => setNewEquip({...newEquip, equipped: e.target.checked})}
                          className="w-5 h-5 rounded border-white/10 bg-white/5 text-arcane focus:ring-arcane/50"
                        />
                        <span className="text-xs font-mono text-parchment/40 uppercase tracking-widest group-hover:text-parchment transition-colors">Equipado</span>
                      </label>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificadores de Atributo</label>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {attributes.map(attr => (
                          <div key={attr.id} className="space-y-1">
                            <p className="text-[8px] font-mono text-parchment/40 uppercase text-center">{attr.id}</p>
                            <input 
                              type="number"
                              value={newEquip.stats?.[attr.id] || 0}
                              onChange={e => setNewEquip({
                                ...newEquip,
                                stats: { ...newEquip.stats, [attr.id]: parseInt(e.target.value) || 0 }
                              })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-1 text-center text-xs focus:outline-none focus:border-arcane/50 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                      <textarea 
                        value={newEquip.description}
                        onChange={e => setNewEquip({...newEquip, description: e.target.value})}
                        placeholder="Descreva o item e suas propriedades..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleAddEquip}
                    className="w-full py-4 bg-arcane/10 hover:bg-arcane/20 text-arcane rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-arcane/30"
                  >
                    <Plus size={20} />
                    Confirmar Equipamento
                  </button>
                </div>

                {/* Equipment List */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Itens no Inventário</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {equipment.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-5 rounded-3xl flex items-center justify-between group border border-white/10 hover:border-arcane/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10",
                            item.equipped ? "bg-arcane/20 text-arcane" : "bg-white/5 text-parchment/40"
                          )}>
                            {item.defense > 0 ? <Shield size={22} /> : <Sword size={22} />}
                          </div>
                          <div>
                            <h4 className="font-serif text-lg">{item.name}</h4>
                            <div className="flex items-center gap-3 text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                              <span>Qtd: {item.quantity}</span>
                              {item.damage && <span>Dano: {item.damage}</span>}
                              {item.defense > 0 && <span>Defesa: +{item.defense}</span>}
                              {item.stats && Object.entries(item.stats).some(([_, v]) => (v as number) !== 0) && (
                                <span className="text-arcane">
                                  MODS: {Object.entries(item.stats)
                                    .filter(([_, v]) => (v as number) !== 0)
                                    .map(([k, v]) => `${k.toUpperCase()} ${Number(v) > 0 ? '+' : ''}${v}`)
                                    .join(' | ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeEquip(item.id)}
                          className="p-2 hover:bg-ember/10 text-parchment/20 hover:text-ember rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    onClick={() => setStep(7)}
                    className="px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <span>Revisar Personagem</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}
            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif mb-2">Revisão Final</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 07: Selando o Destino</p>
                </header>

                <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                      {basics.image ? (
                        <img src={basics.image} alt={basics.name || 'Personagem'} className="w-full h-full object-cover" />
                      ) : (
                        <User size={36} className="text-parchment/30" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif">{basics.name || 'Sem Nome'}</h3>
                      <p className="text-arcane font-mono text-sm uppercase tracking-widest">{basics.class || 'Sem Vocação'} Nível 1</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {attributes.map(attr => {
                      const traitMod = traitStatsMods[attr.id.toLowerCase()] || 0;
                      const effVal = (values[attr.id] || 0) + traitMod;
                      return (
                        <div key={attr.id} className="glass p-4 rounded-2xl text-center">
                          <p className="text-[10px] font-mono text-parchment/40 uppercase">{attr.label}</p>
                          <p className="text-xl font-serif text-glow-arcane">{effVal}</p>
                          {traitMod !== 0 && (
                            <p className="text-[9px] font-mono text-parchment/40">
                              (Base {values[attr.id] || 0} {traitMod > 0 ? `+${traitMod}` : traitMod})
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Vantagens & Defeitos</h4>
                      <div className="space-y-2">
                        {selectedTraits.map(t => (
                          <div key={t.id} className="flex justify-between text-sm">
                            <span className={cn(
                              t.type === 'advantage' ? "text-arcane" : "text-ember"
                            )}>
                              {t.name}
                            </span>
                            <span className="text-parchment/40">
                              {t.modifier > 0 ? `+${t.modifier}` : t.modifier} {t.modifierType?.toUpperCase()}
                            </span>
                          </div>
                        ))}
                        {selectedTraits.length === 0 && <p className="text-sm text-parchment/20">Nenhum traço selecionado.</p>}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Perícias</h4>
                      <div className="space-y-2">
                        {skills.map(s => (
                          <div key={s.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-parchment/80">{s.name} (Nvl {s.level})</span>
                              <span className="text-parchment/40">{s.typeOverride || s.type}</span>
                            </div>
                            {s.descriptionOverride && (
                              <p className="text-[10px] text-arcane/60 italic leading-tight pl-2 border-l border-arcane/20">
                                {s.descriptionOverride}
                              </p>
                            )}
                          </div>
                        ))}
                        {skills.length === 0 && <p className="text-sm text-parchment/20">Nenhuma perícia selecionada.</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Poderes</h4>
                      <div className="space-y-2">
                        {powers.map(p => (
                          <div key={p.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-parchment/80">{p.name} (Nvl {p.level})</span>
                              <span className="text-parchment/40">{p.typeOverride || p.type}</span>
                            </div>
                            {p.descriptionOverride && (
                              <p className="text-[10px] text-ember/60 italic leading-tight pl-2 border-l border-ember/20">
                                {p.descriptionOverride}
                              </p>
                            )}
                          </div>
                        ))}
                        {powers.length === 0 && <p className="text-sm text-parchment/20">Nenhum poder selecionado.</p>}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Resumo de Inventário</h4>
                      <p className="text-sm text-parchment/60 leading-relaxed">
                        {equipment.length} itens no inventário. 
                        Pronto para enfrentar os desafios que aguardam.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveCharacter}
                  disabled={loading}
                  className="w-full py-6 bg-arcane text-obsidian rounded-3xl font-bold text-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-arcane/30 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-obsidian/20 border-t-obsidian rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={24} />
                      <span>Concluir Criação</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar: Preview & Actions */}
        <div className="space-y-8 lg:sticky lg:top-24 h-fit order-first lg:order-last">
          <section className="glass p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] space-y-6">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-arcane/20 to-ember/20 border-2 border-white/10 mx-auto overflow-hidden p-1 flex items-center justify-center">
                {basics.image ? (
                  <img 
                    src={basics.image} 
                    alt="Prévia do Personagem" 
                    className="w-full h-full object-cover rounded-full opacity-80"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-parchment/30">
                    <User size={36} className="text-parchment/30" />
                  </div>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-serif min-h-[1.75rem]">
                {step >= 2 ? (basics.name || 'Sem Nome') : ''}
              </h3>
              <p className="text-[10px] sm:text-xs font-mono text-arcane uppercase tracking-widest min-h-[1rem]">
                {step >= 2 ? (basics.class || 'Sem Vocação') : ''}
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-parchment/40">TOTAL DE PONTOS</span>
                <span className="text-sm font-serif">
                  {(Object.values(values) as number[]).reduce((a, b) => a + b, 0)} / {maxPoints}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-arcane transition-all duration-500 rounded-full" 
                  style={{ width: `${Math.min(100, ((Object.values(values) as number[]).reduce((a, b) => a + b, 0) / maxPoints) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {step < steps.length && (
                <button 
                  onClick={() => {
                    if (step === 2 && (!basics.sessionId || !basics.name)) {
                      setTouched({ name: true, sessionId: true });
                      return;
                    }
                    setStep(prev => Math.min(steps.length, prev + 1));
                  }}
                  disabled={step === 2 && (!basics.sessionId || !basics.name)}
                  className={cn(
                    "w-full py-4 bg-arcane text-obsidian rounded-2xl flex items-center justify-center gap-2 font-bold hover:scale-105 transition-transform shadow-lg shadow-arcane/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  )}
                >
                  <span>
                    {step === 1 ? 'Continuar para Origens' : 
                     step === 2 ? 'Continuar para Atributos' : 
                     step === 3 ? 'Continuar para Perícias' : 
                     step === 4 ? 'Continuar para Poderes' : 
                     step === 5 ? 'Continuar para Equipamento' : 
                     step === 6 ? 'Revisar Personagem' : 
                     'Próximo Passo'}
                  </span>
                  <ChevronRight size={18} />
                </button>
              )}
              {step > 1 && (
                <button 
                  onClick={() => setStep(prev => Math.max(1, prev - 1))}
                  className="w-full py-4 text-parchment/40 hover:text-parchment transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar</span>
                </button>
              )}
            </div>

            <div className="p-4 glass-ember rounded-2xl flex items-start gap-3">
              <Sparkles size={18} className="text-ember shrink-0 mt-0.5" />
              <p className="text-[10px] text-ember leading-relaxed font-mono uppercase tracking-wider">
                Dica: Paladinos se beneficiam mais de Força e Coragem para seus ataques divinos e liderança.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Suggestion Modals */}
      <AnimatePresence>
        {showCatalog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCatalog(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 space-y-6 overflow-y-auto max-h-[90vh] no-scrollbar"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-serif">Catálogo de Itens</h3>
                  <p className="text-parchment/40 font-mono text-xs uppercase tracking-widest">Selecione um item pré-definido pelo mestre</p>
                </div>
                <button 
                  onClick={() => setShowCatalog(false)}
                  className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar no catálogo..."
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-arcane/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {itemCatalog
                  .filter(i => (i.isStartingItem === true) && i.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => importFromCatalog(item)}
                      className="glass p-6 rounded-3xl text-left border border-white/10 hover:border-arcane/50 hover:bg-arcane/5 transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-serif text-xl group-hover:text-arcane transition-colors">{item.name}</h4>
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] font-mono uppercase tracking-widest text-parchment/40 border border-white/10">
                            {item.rarity}
                          </span>
                        </div>
                        <p className="text-xs text-parchment/40 mb-4 line-clamp-2">{item.description || 'Sem descrição.'}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {item.damage && (
                            <span className="px-2 py-0.5 rounded bg-ember/10 text-ember text-[9px] font-mono uppercase">
                              Dano: {item.damage}
                            </span>
                          )}
                          {item.defense > 0 && (
                            <span className="px-2 py-0.5 rounded bg-gold/10 text-gold text-[9px] font-mono uppercase">
                              DF: {item.defense}
                            </span>
                          )}
                          {item.stats && Object.entries(item.stats).map(([k, v]) => (v as number) !== 0 && (
                            <span key={k} className="px-2 py-0.5 rounded bg-arcane/10 text-arcane text-[9px] font-mono uppercase">
                              {k}: {Number(v) > 0 ? '+' : ''}{v}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
                        <div className="flex items-center gap-1.5 min-w-[60px]">
                          <span className="text-gold text-lg font-serif">{item.value || 0}</span>
                          <span className="text-[10px] font-mono text-gold/40 uppercase">MO</span>
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest",
                          basics.money >= (item.value || 0) ? "bg-arcane/10 text-arcane" : "bg-ember/10 text-ember"
                        )}>
                          {basics.money >= (item.value || 0) ? "Disponível" : "Sem Fundos"}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
              
              {itemCatalog.length === 0 && (
                <div className="text-center py-12">
                  <Package size={48} className="text-parchment/10 mx-auto mb-4" />
                  <p className="text-parchment/40 font-serif">Catálogo vazio. Peça ao mestre para adicionar itens.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Suggestion Modals */}
      <AnimatePresence>
        {(showSkillSuggestion || showPowerSuggestion || showTraitSuggestion) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowSkillSuggestion(false); setShowPowerSuggestion(false); setShowTraitSuggestion(false); }}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <header>
                <h3 className="text-3xl font-serif">Sugerir {showSkillSuggestion ? 'Perícia' : showPowerSuggestion ? 'Poder' : 'Vantagem/Defeito'}</h3>
                <p className="text-parchment/40 font-mono text-xs uppercase tracking-widest">Sua sugestão será enviada para aprovação do mestre</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                  <input 
                    type="text" 
                    value={suggestionData.name}
                    onChange={e => setSuggestionData({...suggestionData, name: e.target.value})}
                    onBlur={() => setTouched(prev => ({ ...prev, suggestionName: true }))}
                    placeholder="Ex: Golpe de Misericórdia"
                    className={cn(
                      "w-full bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors",
                      touched.suggestionName && !suggestionData.name.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                    )}
                  />
                  {touched.suggestionName && !suggestionData.name.trim() && (
                    <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O nome é obrigatório</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo</label>
                  <select 
                    value={suggestionData.type}
                    onChange={e => setSuggestionData({...suggestionData, type: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                  >
                    <option value="" className="bg-obsidian">Selecione o Tipo...</option>
                    {showSkillSuggestion ? (
                      <>
                        <option value="Luta" className="bg-obsidian">Luta</option>
                        <option value="Mística" className="bg-obsidian">Mística</option>
                        <option value="Geral" className="bg-obsidian">Geral</option>
                        <option value="Conhecimento" className="bg-obsidian">Conhecimento</option>
                        <option value="Artes" className="bg-obsidian">Artes</option>
                        <option value="Treinamento" className="bg-obsidian">Treinamento</option>
                        <option value="Ocultismo" className="bg-obsidian">Ocultismo</option>
                        <option value="Empírico" className="bg-obsidian">Empírico</option>
                      </>
                    ) : showPowerSuggestion ? (
                      <>
                        <option value="Físico" className="bg-obsidian">Físico</option>
                        <option value="Elemental" className="bg-obsidian">Elemental</option>
                        <option value="Defesa" className="bg-obsidian">Defesa</option>
                        <option value="Buff" className="bg-obsidian">Buff</option>
                        <option value="Debuff" className="bg-obsidian">Debuff</option>
                        <option value="Geral" className="bg-obsidian">Geral</option>
                      </>
                    ) : (
                      <>
                        <option value="advantage" className="bg-obsidian">Vantagem</option>
                        <option value="disadvantage" className="bg-obsidian">Defeito</option>
                      </>
                    )}
                  </select>
                </div>
                {showTraitSuggestion ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificador (Ex: -2 ou 2)</label>
                      <input 
                        type="number" 
                        value={suggestionData.modifier}
                        onChange={e => setSuggestionData({...suggestionData, modifier: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo de Modificador</label>
                      <select 
                        value={suggestionData.modifierType}
                        onChange={e => setSuggestionData({...suggestionData, modifierType: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                      >
                        <option value="for" className="bg-obsidian">FOR</option>
                        <option value="con" className="bg-obsidian">CON</option>
                        <option value="agi" className="bg-obsidian">AGI</option>
                        <option value="per" className="bg-obsidian">PER</option>
                        <option value="vel" className="bg-obsidian">VEL</option>
                        <option value="ini" className="bg-obsidian">INI</option>
                        <option value="int" className="bg-obsidian">INT</option>
                        <option value="cor" className="bg-obsidian">COR</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Compra (Pontos)</label>
                    <input 
                      type="number" 
                      value={suggestionData.purchaseCost}
                      onChange={e => setSuggestionData({...suggestionData, purchaseCost: parseInt(e.target.value) || 1})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                )}
                {showSkillSuggestion ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de ATP (Opcional)</label>
                      <input 
                        type="number" 
                        value={suggestionData.atpCost}
                        onChange={e => setSuggestionData({...suggestionData, atpCost: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano (Opcional)</label>
                      <input 
                        type="text" 
                        value={suggestionData.damage}
                        onChange={e => setSuggestionData({...suggestionData, damage: e.target.value})}
                        placeholder="Ex: 1d8+FOR"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                  </>
                ) : showPowerSuggestion ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Uso (Ex: 5 ATP)</label>
                      <input 
                        type="text" 
                        value={suggestionData.cost}
                        onChange={e => setSuggestionData({...suggestionData, cost: e.target.value})}
                        placeholder="Ex: 5 ATP"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Efeito</label>
                      <input 
                        type="text" 
                        value={suggestionData.effect}
                        onChange={e => setSuggestionData({...suggestionData, effect: e.target.value})}
                        placeholder="Ex: Causa 2d6 de dano de fogo"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Efeito</label>
                    <input 
                      type="text" 
                      value={suggestionData.effect}
                      onChange={e => setSuggestionData({...suggestionData, effect: e.target.value})}
                      placeholder="Ex: +2 em testes de FOR"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                )}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                  <textarea 
                    value={suggestionData.description}
                    onChange={e => setSuggestionData({...suggestionData, description: e.target.value})}
                    onBlur={() => setTouched(prev => ({ ...prev, suggestionDescription: true }))}
                    placeholder="Descreva detalhadamente o funcionamento..."
                    rows={4}
                    className={cn(
                      "w-full bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors resize-none",
                      touched.suggestionDescription && !suggestionData.description.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                    )}
                  />
                  {touched.suggestionDescription && !suggestionData.description.trim() && (
                    <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">A descrição é obrigatória</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => { setShowSkillSuggestion(false); setShowPowerSuggestion(false); setShowTraitSuggestion(false); }}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-parchment rounded-2xl font-bold transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleSaveSuggestion(showSkillSuggestion ? 'skill' : showPowerSuggestion ? 'power' : 'trait')}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all border",
                    showSkillSuggestion ? "bg-arcane/10 hover:bg-arcane/20 text-arcane border-arcane/30" : 
                    showPowerSuggestion ? "bg-ember/10 hover:bg-ember/20 text-ember border-ember/30" :
                    "bg-gold/10 hover:bg-gold/20 text-gold border-gold/30"
                  )}
                >
                  Enviar Sugestão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Roll Result Notification */}
      <AnimatePresence>
        {quickRoll && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%', scale: 0.8, rotateX: 45 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 20, x: '-50%', scale: 0.8, rotateX: -45 }}
            transition={{ type: "spring", damping: 15 }}
            style={{ perspective: "1000px" }}
            className={cn(
              "fixed bottom-24 left-1/2 z-[100] glass px-8 py-5 rounded-[2.5rem] border shadow-2xl flex items-center gap-6 transition-all duration-500",
              quickRoll.rolling ? "border-white/20" : 
              quickRoll.isCritical ? "border-gold shadow-[0_0_30px_rgba(255,215,0,0.4)] bg-gold/10" :
              quickRoll.isFumble ? "border-ember shadow-[0_0_30px_rgba(255,68,68,0.4)] bg-ember/10" :
              (quickRoll.success ? "border-arcane/50" : "border-ember/50")
            )}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest mb-1">
                {quickRoll.type === 'test' ? 'Teste: ' : 'Dano/Efeito: '}
                {quickRoll.attr}
              </span>
              <div className="flex items-baseline gap-3">
                {quickRoll.type === 'test' ? (
                  <>
                    <span className={cn(
                      "text-3xl font-serif min-w-[100px]",
                      quickRoll.rolling ? "text-parchment/40" : 
                      quickRoll.isCritical ? "text-gold animate-bounce" :
                      quickRoll.isFumble ? "text-ember animate-pulse" :
                      (quickRoll.success ? "text-glow-arcane" : "text-ember")
                    )}>
                      {quickRoll.rolling ? 'Rolando...' : 
                       quickRoll.isCritical ? 'CRÍTICO!' : 
                       quickRoll.isFumble ? 'DESASTRE!' : 
                       (quickRoll.success ? 'Sucesso' : 'Falha')}
                    </span>
                    <span className={cn(
                      "text-sm font-mono bg-white/5 px-2 py-1 rounded-lg border",
                      quickRoll.isCritical ? "text-gold border-gold/30" : 
                      quickRoll.isFumble ? "text-ember border-ember/30" : 
                      "text-parchment/40 border-white/5"
                    )}>
                      (d{quickRoll.diceSides || 20}: {quickRoll.rolling ? <RollingValue sides={quickRoll.diceSides} /> : quickRoll.result} vs {quickRoll.target})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-serif text-ember min-w-[40px]">
                      {quickRoll.rolling ? <RollingValue isDamage /> : quickRoll.result}
                    </span>
                    <span className="text-sm text-parchment/40 font-mono">
                      Total
                    </span>
                  </>
                )}
              </div>
            </div>

            <motion.div
              animate={quickRoll.rolling ? { 
                rotate: [0, 360],
                scale: [1, 1.2, 1],
                x: [0, -3, 3, -3, 3, 0],
                y: [0, -3, 3, -3, 3, 0],
                rotateX: [0, 90, 180, 270, 360],
                rotateY: [0, 90, 180, 270, 360]
              } : { rotate: 0, scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0 }}
              transition={quickRoll.rolling ? { 
                rotate: { repeat: Infinity, duration: 0.3, ease: "linear" },
                scale: { repeat: Infinity, duration: 0.4 },
                x: { repeat: Infinity, duration: 0.15 },
                y: { repeat: Infinity, duration: 0.2 },
                rotateX: { repeat: Infinity, duration: 0.5, ease: "linear" },
                rotateY: { repeat: Infinity, duration: 0.6, ease: "linear" }
              } : { type: "spring", damping: 12 }}
            >
              {quickRoll.rolling ? (
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-parchment/40 border border-white/10">
                  <Dice6 size={28} />
                </div>
              ) : (
                <>
                  {quickRoll.type === 'test' ? (
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors",
                      quickRoll.success ? "bg-arcane/20 text-arcane border-arcane/30" : "bg-ember/20 text-ember border-ember/30"
                    )}>
                      {quickRoll.success ? <Sparkles size={28} className="animate-pulse" /> : <Zap size={28} className="animate-bounce" />}
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-ember/20 rounded-2xl flex items-center justify-center text-ember border border-ember/30">
                      <Sword size={28} className="animate-pulse" />
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character Image Picker Modal */}
      <ImagePickerModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onConfirm={(url) => {
          setBasics(prev => ({ ...prev, image: url }));
          setIsImageModalOpen(false);
        }}
        title="Retrato do Personagem"
        subtitle="Insira uma URL, faça upload ou tire uma foto da câmera"
        confirmText="Definir Imagem"
        initialUrl={basics.image}
      />

      {/* Trait Detail Modal */}
      <AnimatePresence>
        {detailTrait && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailTrait(null)}
              className="absolute inset-0 bg-obsidian/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-modal bg-obsidian/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl z-10"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-2xl border",
                    detailTrait.type === 'advantage' 
                      ? "bg-arcane/15 text-arcane border-arcane/30" 
                      : "bg-ember/15 text-ember border-ember/30"
                  )}>
                    <Star size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif text-parchment">{detailTrait.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-[9px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border font-bold",
                        detailTrait.type === 'advantage' 
                          ? "bg-arcane/20 text-arcane border-arcane/30" 
                          : "bg-ember/20 text-ember border-ember/30"
                      )}>
                        {detailTrait.type === 'advantage' ? 'Vantagem' : 'Defeito'}
                      </span>
                      <span className="text-xs font-mono text-parchment/40">
                        {detailTrait.modifier > 0 ? `+${detailTrait.modifier}` : detailTrait.modifier} pontos
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailTrait(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-parchment/40 block text-[10px] uppercase tracking-wider mb-1">Modifica / Alvo</span>
                    <span className="text-parchment font-bold text-sm">
                      {getTraitTargetDisplayName(detailTrait.modifierType, attributes, availableTalents)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-parchment/40 block text-[10px] uppercase tracking-wider mb-1">Valor do Modificador</span>
                    <span className={cn(
                      "font-serif font-bold text-base",
                      detailTrait.modifier > 0 ? "text-arcane" : detailTrait.modifier < 0 ? "text-ember" : "text-parchment"
                    )}>
                      {detailTrait.modifier > 0 ? `+${detailTrait.modifier}` : detailTrait.modifier} pts
                    </span>
                  </div>
                </div>

                {detailTrait.description && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest block">
                      Descrição
                    </label>
                    <div className="p-4 rounded-2xl glass border border-white/10 text-sm text-parchment/80 leading-relaxed font-sans">
                      {detailTrait.description}
                    </div>
                  </div>
                )}

                {detailTrait.effect && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest block">
                      Efeito
                    </label>
                    <div className="p-3.5 rounded-2xl bg-arcane/5 border border-arcane/20 text-xs text-parchment/80 font-mono">
                      {detailTrait.effect}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10 gap-3">
                <button
                  type="button"
                  onClick={() => setDetailTrait(null)}
                  className="px-5 py-2.5 glass rounded-xl text-xs font-mono uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                {(() => {
                  const isSelected = selectedTraits.some(t => t.id === detailTrait.id);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        toggleTrait(detailTrait);
                        setDetailTrait(null);
                      }}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all shadow-lg cursor-pointer flex items-center gap-2",
                        isSelected
                          ? "bg-ember/20 text-ember border border-ember/40 hover:bg-ember/30"
                          : detailTrait.type === 'advantage'
                          ? "bg-arcane text-obsidian shadow-arcane/20 hover:scale-105"
                          : "bg-ember text-obsidian shadow-ember/20 hover:scale-105"
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Trash2 size={14} />
                          <span>Remover do Personagem</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Selecionar Traço</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
