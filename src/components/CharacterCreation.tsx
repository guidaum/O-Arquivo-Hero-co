import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
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
  Star
} from 'lucide-react';
import { cn, evaluateFormula } from '../lib/utils';
import { auth, db, collection, setDoc, getDoc, doc, OperationType, handleFirestoreError, query, where, getDocs } from '../firebase';

export default function CharacterCreation() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [sessionSearch, setSessionSearch] = React.useState('');
  const [showSessionList, setShowSessionList] = React.useState(false);
  const steps = ['Origens', 'Atributos', 'Vantagens/Defeitos', 'Perícias', 'Poderes', 'Equipamento', 'Revisão'];

  const [basics, setBasics] = React.useState({
    name: '',
    class: 'Paladino',
    image: 'https://picsum.photos/seed/paladin/400/600',
    color: 'arcane',
    icon: 'Shield',
    sessionId: ''
  });

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const [availableSkills, setAvailableSkills] = React.useState<any[]>([]);
  const [availablePowers, setAvailablePowers] = React.useState<any[]>([]);
  const [availableTraits, setAvailableTraits] = React.useState<any[]>([]);
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

  const [skills, setSkills] = React.useState<any[]>([]);
  const [powers, setPowers] = React.useState<any[]>([]);
  const [selectedTraits, setSelectedTraits] = React.useState<any[]>([]);

  const [showSkillSuggestion, setShowSkillSuggestion] = React.useState(false);
  const [showPowerSuggestion, setShowPowerSuggestion] = React.useState(false);
  const [showTraitSuggestion, setShowTraitSuggestion] = React.useState(false);
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
      alert('Sugestão enviada para o mestre!');
    } catch (error) {
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
    equipped: false
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
        equipped: false
      });
    }
  };

  const removeEquip = (id: string) => {
    setEquipment(equipment.filter(e => e.id !== id));
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
    if (!sessionSearch) return [];
    const searchLower = sessionSearch.toLowerCase();
    return sessions.filter(s => 
      s.name.toLowerCase().includes(searchLower) || 
      s.code.toLowerCase().includes(searchLower) ||
      s.gmName.toLowerCase().includes(searchLower)
    );
  }, [sessions, sessionSearch]);

  const [globalSettings, setGlobalSettings] = React.useState<any>(null);

  React.useEffect(() => {
    // Fetch global settings
    const fetchGlobalSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'globalSettings', 'config'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setGlobalSettings(data);
          setMaxPoints(data.maxAttributePoints ?? 120);
          setMaxSingleAttr(data.maxSingleAttributeValue ?? 100);
          setInitialSkillPoints(data.initialSkillPoints ?? 0);
          setInitialPowerPoints(data.initialPowerPoints ?? 0);
          setSkillPoints(data.initialSkillPoints ?? 0);
          setPowerPoints(data.initialPowerPoints ?? 0);
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
      } catch (error) {
        console.error('Error fetching library:', error);
      }
    };
    fetchLibrary();
  }, []);

  React.useEffect(() => {
    if (basics.sessionId) {
      const session = sessions.find(s => s.id === basics.sessionId);
      // We still use session for some context, but settings are now global
    }
    setValues({ for: 0, con: 0, agi: 0, per: 0, vel: 0, ini: 0, int: 0, cor: 0 });
    setSkills([]);
    setPowers([]);
    setSelectedTraits([]);
  }, [basics.sessionId, sessions]);

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

  const attributes = [
    { id: 'for', label: 'Força', icon: Sword, color: 'text-ember', description: 'Poder físico e força bruta.' },
    { id: 'con', label: 'Constituição', icon: Shield, color: 'text-ember', description: 'Saúde, resistência e força vital.' },
    { id: 'agi', label: 'Agilidade', icon: Zap, color: 'text-arcane', description: 'Destreza, reflexos e equilíbrio.' },
    { id: 'per', label: 'Percepção', icon: Eye, color: 'text-gold', description: 'Intuição, sentidos e observação.' },
    { id: 'vel', label: 'Velocidade', icon: Zap, color: 'text-arcane', description: 'Capacidade de deslocamento rápido.' },
    { id: 'ini', label: 'Iniciativa', icon: Zap, color: 'text-gold', description: 'Prontidão para o combate.' },
    { id: 'int', label: 'Inteligência', icon: Brain, color: 'text-arcane', description: 'Agudeza mental e raciocínio.' },
    { id: 'cor', label: 'Coragem', icon: Heart, color: 'text-ember', description: 'Força de vontade e bravura.' },
  ];

  const [values, setValues] = React.useState<Record<string, number>>({
    for: 0, con: 0, agi: 0, per: 0, vel: 0, ini: 0, int: 0, cor: 0
  });

  const [maxPoints, setMaxPoints] = React.useState(120);
  const [maxSingleAttr, setMaxSingleAttr] = React.useState(100);

  const calculateCost = React.useCallback((baseCost: number, level: number, type: string, isPower: boolean) => {
    if (!globalSettings) return Math.max(1, baseCost * level);

    const formula = isPower 
      ? (globalSettings.powerCostFormula || '(COST * LVL) / VAR') 
      : (globalSettings.skillCostFormula || '(COST * LVL) / VAR');
    const typeVars = isPower 
      ? (globalSettings.powerTypeVars || {}) 
      : (globalSettings.skillTypeVars || {});
    
    const typeVarValue = typeVars[type] || '1';
    
    // Resolve typeVarValue if it's an attribute
    let resolvedVar = 1;
    const attrMap: Record<string, string> = {
      'FOR': 'for', 'CON': 'con', 'AGI': 'agi', 'PER': 'per', 
      'VEL': 'vel', 'INI': 'ini', 'INT': 'int', 'COR': 'cor'
    };

    if (attrMap[typeVarValue.toUpperCase()]) {
      resolvedVar = values[attrMap[typeVarValue.toUpperCase()]] || 1;
    } else {
      resolvedVar = parseFloat(typeVarValue) || 1;
    }

    // Ensure resolvedVar is at least 1 to avoid division by zero or negative costs
    resolvedVar = Math.max(1, resolvedVar);

    try {
      let evalFormula = formula.toUpperCase();
      evalFormula = evalFormula.replace(/\bCOST\b/g, baseCost.toString());
      evalFormula = evalFormula.replace(/\bLVL\b/g, level.toString());
      evalFormula = evalFormula.replace(/\bVAR\b/g, resolvedVar.toString());
      
      return Math.max(1, Math.floor(new Function(`return ${evalFormula}`)()));
    } catch (e) {
      console.error('Error calculating cost:', e);
      return Math.max(1, baseCost * level);
    }
  }, [globalSettings, values]);

  const totalSkillPointsSpent = React.useMemo(() => {
    return skills.reduce((acc, s) => acc + calculateCost(s.purchaseCost || 1, s.level || 1, s.typeOverride || s.type, false), 0);
  }, [skills, calculateCost]);

  const totalPowerPointsSpent = React.useMemo(() => {
    return powers.reduce((acc, p) => acc + calculateCost(p.purchaseCost || 1, p.level || 1, p.typeOverride || p.type, true), 0);
  }, [powers, calculateCost]);

  const traitBalance = React.useMemo(() => {
    const disadvantages = selectedTraits.filter(t => t.type === 'disadvantage').reduce((acc, t) => acc + Math.abs(t.modifier || 0), 0);
    const advantages = selectedTraits.filter(t => t.type === 'advantage').reduce((acc, t) => acc + Math.abs(t.modifier || 0), 0);
    return disadvantages - advantages;
  }, [selectedTraits]);

  React.useEffect(() => {
    setSkillPoints(initialSkillPoints - totalSkillPointsSpent);
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
      setSelectedTraits(selectedTraits.filter(t => t.id !== trait.id));
    } else {
      if (trait.type === 'disadvantage') {
        setSelectedTraits([...selectedTraits, trait]);
      } else {
        // Advantage cost check
        const cost = Math.abs(trait.modifier || 0);
        if (traitBalance >= cost) {
          setSelectedTraits([...selectedTraits, trait]);
        }
      }
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
        // Check if we have enough points for the new level
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

  const handleSaveCharacter = async () => {
    if (!auth.currentUser || !basics.sessionId) return;
    setLoading(true);
    try {
      const characterId = crypto.randomUUID();
      const characterData = {
        id: characterId,
        ownerId: auth.currentUser.uid,
        name: basics.name || 'Sem Nome',
        class: basics.class,
        level: 1,
        xp: 0,
        xpMax: 1000,
        image: basics.image,
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
        traits: selectedTraits.map(t => t.id),
        equipment,
        attributePoints: 0,
        skillPoints: 0,
        powerPoints: 0,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'characters', characterId), characterData);
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Stepper */}
      <div className="flex items-center justify-between px-2 sm:px-4">
        {steps.map((s, idx) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-2 relative">
              <div className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                step > idx + 1 ? "bg-arcane border-arcane text-obsidian" :
                step === idx + 1 ? "border-arcane text-arcane shadow-[0_0_15px_rgba(71,214,255,0.3)]" :
                "border-white/10 text-parchment/20"
              )}>
                {step > idx + 1 ? <Sparkles size={14} sm:size={18} /> : <span className="text-xs sm:text-sm font-mono">{idx + 1}</span>}
              </div>
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
                <header>
                  <h2 className="text-4xl font-serif mb-2">Origens da Lenda</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 01: Nome e Vocação</p>
                </header>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Personagem</label>
                      <input 
                        type="text" 
                        value={basics.name}
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
                        value={basics.class}
                        onChange={e => setBasics({...basics, class: e.target.value})}
                        placeholder="Ex: Paladino, Caçador de Sombras..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl font-serif focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Vincular a uma Campanha (Obrigatório)</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/20" size={18} />
                        <input 
                          type="text" 
                          value={sessionSearch}
                          onChange={e => {
                            setSessionSearch(e.target.value);
                            setShowSessionList(true);
                            if (basics.sessionId) setBasics({...basics, sessionId: ''});
                          }}
                          onFocus={() => setShowSessionList(true)}
                          onBlur={() => setTimeout(() => setTouched(prev => ({ ...prev, sessionId: true })), 200)}
                          placeholder="Busque por código ou nome da campanha..."
                          className={cn(
                            "w-full bg-white/5 border rounded-2xl pl-12 pr-6 py-4 text-xl font-serif focus:outline-none transition-colors",
                            touched.sessionId && !basics.sessionId ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                          )}
                        />
                        {touched.sessionId && !basics.sessionId && (
                          <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">Selecione uma campanha</p>
                        )}
                        {showSessionList && sessionSearch && (
                          <div className="absolute z-50 w-full mt-2 glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar">
                            {filteredSessions.length > 0 ? (
                              filteredSessions.map(session => (
                                <button
                                  key={session.id}
                                  onClick={() => {
                                    setBasics({...basics, sessionId: session.id});
                                    setSessionSearch(session.displayText);
                                    setShowSessionList(false);
                                  }}
                                  className="w-full px-6 py-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-none"
                                >
                                  <p className="font-serif text-lg">{session.displayText}</p>
                                </button>
                              ))
                            ) : (
                              <div className="px-6 py-4 text-parchment/40 font-mono text-xs uppercase tracking-widest">Nenhuma campanha encontrada</div>
                            )}
                          </div>
                        )}
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
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Ou insira uma URL de imagem personalizada</label>
                      <input 
                        type="text" 
                        value={basics.image}
                        onChange={e => setBasics({...basics, image: e.target.value})}
                        placeholder="https://exemplo.com/imagem.png"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-mono focus:outline-none focus:border-arcane/50 transition-colors"
                      />
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

                  <div className="flex justify-end pt-6">
                    <button 
                      onClick={() => {
                        if (!basics.name || !basics.sessionId) {
                          setTouched({ name: true, sessionId: true });
                          return;
                        }
                        setStep(2);
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

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-serif mb-2">Defina seus Atributos</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 02: A Essência do Herói</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {attributes.map((attr, idx) => (
                    <motion.div
                      key={attr.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass p-6 rounded-3xl group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-3 rounded-2xl bg-white/5", attr.color)}>
                            <attr.icon size={24} />
                          </div>
                          <div>
                            <h4 className="font-serif text-xl">{attr.label}</h4>
                            <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Modificador: {getModifier(values[attr.id])}</p>
                          </div>
                        </div>
                        <div className="text-3xl font-serif text-glow-arcane">
                          {values[attr.id]}
                          <span className="text-xs text-parchment/20 ml-1">/ {maxSingleAttr}</span>
                        </div>
                      </div>

                      <p className="text-xs text-parchment/40 mb-6 leading-relaxed">{attr.description}</p>

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
                  ))}
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    onClick={() => setStep(3)}
                    className="px-8 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <span>Continuar para Vantagens/Defeitos</span>
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
                    <h2 className="text-4xl font-serif mb-2">Vantagens & Defeitos</h2>
                    <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 03: Traços de Personalidade e Destino</p>
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
                      <button
                        key={trait.id}
                        onClick={() => toggleTrait(trait)}
                        className={cn(
                          "glass p-6 rounded-3xl text-left transition-all border group relative",
                          isSelected 
                            ? (isAdvantage ? "border-arcane bg-arcane/10" : "border-ember bg-ember/10") 
                            : "border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-serif text-xl group-hover:text-arcane transition-colors">{trait.name}</h4>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest",
                            isAdvantage ? "bg-arcane text-obsidian" : "bg-ember text-obsidian"
                          )}>
                            {trait.modifier > 0 ? `+${trait.modifier}` : trait.modifier} pts
                          </div>
                        </div>
                        <p className="text-xs text-parchment/40 mb-4 line-clamp-2">{trait.description}</p>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-parchment/60 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Activity size={12} /> 
                            {trait.type === 'advantage' ? 'Vantagem' : 'Defeito'}
                          </span>
                          {trait.modifierType && (
                            <span className="flex items-center gap-1">
                              <Target size={12} /> 
                              {trait.modifierType.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <div className={cn(
                            "absolute top-2 right-2",
                            isAdvantage ? "text-arcane" : "text-ember"
                          )}>
                            <Check size={16} />
                          </div>
                        )}
                      </button>
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
                              Dif: {evaluateFormula(skill.difficultyFormula, { ...values, skills: skills.length, powers: powers.length })}
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
                  <div className="glass px-6 py-3 rounded-2xl border border-ember/30 bg-ember/5 flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos de Poder</p>
                      <p className={cn(
                        "text-2xl font-serif",
                        powerPoints === 0 ? "text-gold" : "text-ember"
                      )}>
                        {powerPoints} / {initialPowerPoints}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-ember/10 flex items-center justify-center text-ember">
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
                            } pts
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
                              Dif: {evaluateFormula(power.difficultyFormula, { ...values, skills: skills.length, powers: powers.length })}
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
                  <h2 className="text-4xl font-serif mb-2">Equipamento & Inventário</h2>
                  <p className="text-parchment/40 font-mono text-sm uppercase tracking-widest">Passo 06: Preparação para a Jornada</p>
                </header>

                {/* Equipment Form */}
                <div className="glass p-8 rounded-[2.5rem] space-y-6 border border-white/10">
                  <h3 className="text-xl font-serif flex items-center gap-2">
                    <Plus className="text-arcane" size={20} />
                    Adicionar Novo Equipamento
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                      <input 
                        type="text" 
                        value={newEquip.name}
                        onChange={e => setNewEquip({...newEquip, name: e.target.value})}
                        placeholder="Ex: Espada Longa"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                      <input 
                        type="text" 
                        value={newEquip.damage}
                        onChange={e => setNewEquip({...newEquip, damage: e.target.value})}
                        placeholder="Ex: 1d8+FOR"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Quantidade</label>
                      <input 
                        type="number" 
                        value={newEquip.quantity}
                        onChange={e => setNewEquip({...newEquip, quantity: parseInt(e.target.value) || 1})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Munição</label>
                      <input 
                        type="text" 
                        value={newEquip.ammo}
                        onChange={e => setNewEquip({...newEquip, ammo: e.target.value})}
                        placeholder="Ex: 20 flechas ou -"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Defesa</label>
                      <input 
                        type="number" 
                        value={newEquip.defense}
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
                    {equipment.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-5 rounded-3xl flex items-center justify-between group border border-white/10 hover:border-arcane/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-arcane">
                            <Shield size={18} />
                          </div>
                          <div>
                            <h5 className="font-serif text-lg">{item.name}</h5>
                            <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-wider">
                              Qtd: {item.quantity} • Mun: {item.ammo} • Dano: {item.damage || 'N/A'} 
                              {item.defense > 0 && ` • Defesa: +${item.defense}`}
                              {item.equipped && ' • [EQUIPADO]'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeEquip(idx)}
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
                    <div className="w-24 h-24 rounded-3xl overflow-hidden border border-white/10">
                      <img src={basics.image} alt={basics.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-serif">{basics.name || 'Sem Nome'}</h3>
                      <p className="text-arcane font-mono text-sm uppercase tracking-widest">{basics.class} Nível 1</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {attributes.map(attr => (
                      <div key={attr.id} className="glass p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-mono text-parchment/40 uppercase">{attr.label}</p>
                        <p className="text-xl font-serif">{values[attr.id]}</p>
                      </div>
                    ))}
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
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-arcane/20 to-ember/20 border-2 border-white/10 mx-auto overflow-hidden p-1">
                <img 
                  src="https://picsum.photos/seed/creation/200/200" 
                  alt="Prévia do Personagem" 
                  className="w-full h-full object-cover rounded-full opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="text-xl sm:text-2xl font-serif">{basics.name || 'Aethelgard'}</h3>
              <p className="text-[10px] sm:text-xs font-mono text-arcane uppercase tracking-widest">{basics.class} Humano</p>
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
                  onClick={() => setStep(prev => Math.min(steps.length, prev + 1))}
                  disabled={step === 1 && (!basics.sessionId || !basics.name)}
                  className={cn(
                    "w-full py-4 bg-arcane text-obsidian rounded-2xl flex items-center justify-center gap-2 font-bold hover:scale-105 transition-transform shadow-lg shadow-arcane/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  )}
                >
                  <span>
                    {step === 1 ? 'Continuar para Atributos' : 
                     step === 2 ? 'Continuar para Vantagens/Defeitos' : 
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
              className="relative w-full max-w-2xl glass p-8 rounded-[2.5rem] border border-white/10 space-y-6 overflow-y-auto max-h-[90vh]"
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
    </div>
  );
}
