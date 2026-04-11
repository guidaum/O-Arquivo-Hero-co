import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  ChevronLeft, 
  Shield, 
  User, 
  Dice6, 
  Zap, 
  Heart, 
  Activity, 
  Sword, 
  Scroll,
  Plus,
  History,
  Sparkles,
  Save,
  Trash2,
  Edit2,
  ChevronRight as ChevronRightIcon,
  Brain,
  Eye,
  Copy,
  X,
  Filter,
  ArrowUpDown,
  Flame,
  Check
} from 'lucide-react';
import { 
  auth,
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  OperationType, 
  handleFirestoreError 
} from '../firebase';
import { cn, evaluateFormula } from '../lib/utils';
import SessionJournal from './SessionJournal';

interface GameSession {
  id: string;
  name: string;
  code: string;
  gmId: string;
  playerIds: string[];
  gmNotes?: string;
  maxAttributePoints?: number;
  maxSingleAttributeValue?: number;
  initialSkillPoints?: number;
  initialPowerPoints?: number;
  pvFormula?: string;
  atpFormula?: string;
  socoFormula?: string;
  chuteFormula?: string;
  defesaFormula?: string;
  esquivaFormula?: string;
  enFormula?: string;
  dmFormula?: string;
  skillCostFormula?: string;
  powerCostFormula?: string;
  skillTypeVars?: Record<string, string>;
  powerTypeVars?: Record<string, string>;
}

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  image: string;
  currentPV: number;
  currentATP: number;
  skillPoints?: number;
  powerPoints?: number;
  attributePoints?: number;
  baseStats?: Record<string, number>;
  stats: {
    pv: number;
    atp: number;
    [key: string]: number;
  };
  isNPC?: boolean;
  skillOverrides?: Record<string, { type: string; description?: string; level?: number }>;
  powerOverrides?: Record<string, { type: string; description?: string; level?: number }>;
}

interface Talent {
  id: string;
  name: string;
  description: string;
  composition: string[];
  sessionId: string;
  gmId: string;
}

interface Skill {
  id: string;
  name: string;
  type: 'Luta' | 'Mística' | 'Geral' | 'Conhecimento' | 'Artes' | 'Treinamento' | 'Ocultismo' | 'Empírico';
  atpCost: number;
  damage: string;
  description: string;
  purchaseCost: number;
  sessionId: string;
  gmId: string;
  difficultyFormula?: string;
}

interface Power {
  id: string;
  name: string;
  type: 'Físico' | 'Elemental' | 'Defesa' | 'Buff' | 'Debuff' | 'Geral';
  cost: string;
  effect: string;
  description: string;
  purchaseCost: number;
  sessionId: string;
  gmId: string;
  difficultyFormula?: string;
}

interface Suggestion {
  id: string;
  type: 'skill' | 'power';
  data: any;
  suggestedBy: string;
  suggestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const ATTRIBUTES = [
  { id: 'for', label: 'Força', icon: Sword, color: 'text-ember' },
  { id: 'con', label: 'Constituição', icon: Shield, color: 'text-ember' },
  { id: 'agi', label: 'Agilidade', icon: Zap, color: 'text-arcane' },
  { id: 'per', label: 'Percepção', icon: Eye, color: 'text-gold' },
  { id: 'vel', label: 'Velocidade', icon: Zap, color: 'text-arcane' },
  { id: 'ini', label: 'Iniciativa', icon: Zap, color: 'text-gold' },
  { id: 'int', label: 'Inteligência', icon: Brain, color: 'text-arcane' },
  { id: 'cor', label: 'Coragem', icon: Heart, color: 'text-ember' },
];

export default function GMDashboard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [session, setSession] = React.useState<GameSession | null>(null);
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [talents, setTalents] = React.useState<Talent[]>([]);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [powers, setPowers] = React.useState<Power[]>([]);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [editingSuggestion, setEditingSuggestion] = React.useState<Suggestion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'characters' | 'journal' | 'notes' | 'settings' | 'talents' | 'skills' | 'powers' | 'suggestions'>('characters');
  const [gmNotes, setGmNotes] = React.useState('');
  const [maxAttributePoints, setMaxAttributePoints] = React.useState(120);
  const [maxSingleAttributeValue, setMaxSingleAttributeValue] = React.useState(100);
  const [initialSkillPoints, setInitialSkillPoints] = React.useState(0);
  const [initialPowerPoints, setInitialPowerPoints] = React.useState(0);
  const [pvFormula, setPvFormula] = React.useState('((FOR / 2) + CON) * 10');
  const [atpFormula, setAtpFormula] = React.useState('(INT + 3) * 3');
  const [socoFormula, setSocoFormula] = React.useState('FOR');
  const [chuteFormula, setChuteFormula] = React.useState('FOR + (FOR / 2)');
  const [defesaFormula, setDefesaFormula] = React.useState('CON + (AGI / 2) + (LUTA * 2)');
  const [esquivaFormula, setEsquivaFormula] = React.useState('(CON + AGI + (VEL / 2)) + (LUTA * 2)');
  const [enFormula, setEnFormula] = React.useState('20 - ((AGI + (PER / 2)) + (LUTA * 2))');
  const [dmFormula, setDmFormula] = React.useState('20 - ((AGI + (PER / 2)) + (MISTICA * 2))');
  const [skillCostFormula, setSkillCostFormula] = React.useState('(COST * LVL) / VAR');
  const [powerCostFormula, setPowerCostFormula] = React.useState('(COST * LVL) / VAR');
  const [skillTypeVars, setSkillTypeVars] = React.useState<Record<string, string>>({
    'Geral': '1',
    'Luta': 'FOR',
    'Mística': 'INT',
    'Conhecimento': 'INT',
    'Artes': 'INI',
    'Ocultismo': 'COR',
    'Treinamento': 'CON',
    'Empírico': 'PER'
  });
  const [powerTypeVars, setPowerTypeVars] = React.useState<Record<string, string>>({
    'Geral': '1',
    'Elemental': 'INT',
    'Físico': 'FOR',
    'Defesa': 'CON',
    'Buff': 'COR',
    'Debuff': 'INI'
  });
  const [sessionName, setSessionName] = React.useState('');
  const [sessionImage, setSessionImage] = React.useState('');

  const [deleteConfirm, setDeleteConfirm] = React.useState<{ id: string, type: 'character' | 'session', name: string } | null>(null);

  const handleDeleteCharacter = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'characters', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `characters/${id}`);
    }
  };
  const [filterClass, setFilterClass] = React.useState<string>('all');
  const [filterLevel, setFilterLevel] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'level'>('name');

  // Character Management State
  const [managingCharacter, setManagingCharacter] = React.useState<Character | null>(null);
  const [pointsToAdd, setPointsToAdd] = React.useState({ skills: 5, powers: 2, attributes: 10, level: 1 });

  // NPC Generator State
  const [isGeneratingNPC, setIsGeneratingNPC] = React.useState(false);
  const [npcConfig, setNpcConfig] = React.useState({
    skillPoints: 10,
    powerPoints: 5,
    minAttrValue: 0,
    maxAttrValue: 100,
    archetype: 'random' as 'combat' | 'scholar' | 'common' | 'random'
  });

  const generateRandomName = () => {
    const firstNames = ['Alaric', 'Bryn', 'Caelum', 'Dara', 'Elowen', 'Faelan', 'Gideon', 'Hestia', 'Ivor', 'Juno', 'Kael', 'Lyra', 'Maelis', 'Nyx', 'Orion', 'Phaedra', 'Quill', 'Rhea', 'Soren', 'Thalia', 'Uriel', 'Vesper', 'Wren', 'Xander', 'Yara', 'Zane'];
    const lastNames = ['Shadowstep', 'Ironheart', 'Stormborn', 'Lightbringer', 'Nightshade', 'Silverleaf', 'Goldbeard', 'Oakmantle', 'Ravenwing', 'Stonegrinder', 'Frostwalker', 'Flamecaller', 'Windrider', 'Earthshaker', 'Deepdelver', 'Starwatcher'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  };


  const handleGenerateNPC = async () => {
    if (!session || !user) return;

    try {
      const name = generateRandomName();
      const level = 1;
      const archetype = npcConfig.archetype === 'random' 
        ? (['combat', 'scholar', 'common'][Math.floor(Math.random() * 3)] as any)
        : npcConfig.archetype;

      // Distribute Attributes
      const stats: Record<string, number> = {};
      const minVal = npcConfig.minAttrValue || 0;
      const maxVal = Math.min(npcConfig.maxAttrValue || 100, session.maxSingleAttributeValue || 100);
      
      ATTRIBUTES.forEach(attr => stats[attr.id] = minVal);
      
      let remainingAttrPoints = (session.maxAttributePoints || 120) - (minVal * ATTRIBUTES.length);
      if (remainingAttrPoints < 0) remainingAttrPoints = 0;

      const priorities: Record<string, string[]> = {
        combat: ['for', 'con', 'agi', 'ini', 'vel'],
        scholar: ['int', 'per', 'cor', 'ini'],
        common: ATTRIBUTES.map(a => a.id)
      };

      const currentPriorities = priorities[archetype] || priorities.common;

      // Simple distribution logic
      while (remainingAttrPoints > 0) {
        const attrId = currentPriorities[Math.floor(Math.random() * currentPriorities.length)];
        if (stats[attrId] < maxVal) {
          const add = Math.min(remainingAttrPoints, Math.floor(Math.random() * 10) + 1);
          stats[attrId] += add;
          remainingAttrPoints -= add;
        }
        
        // Safety break if all maxed
        if (ATTRIBUTES.every(a => stats[a.id] >= maxVal)) break;
      }

      // Pick Skills
      const selectedSkills: string[] = [];
      let remainingSkillPoints = npcConfig.skillPoints;
      const availableSkillsForNPC = [...skills].sort(() => Math.random() - 0.5);

      for (const skill of availableSkillsForNPC) {
        if (remainingSkillPoints >= skill.purchaseCost) {
          selectedSkills.push(skill.id);
          remainingSkillPoints -= skill.purchaseCost;
        }
      }

      // Pick Powers
      const selectedPowers: string[] = [];
      let remainingPowerPoints = npcConfig.powerPoints;
      const availablePowersForNPC = [...powers].sort(() => Math.random() - 0.5);

      for (const power of availablePowersForNPC) {
        if (remainingPowerPoints >= power.purchaseCost) {
          selectedPowers.push(power.id);
          remainingPowerPoints -= power.purchaseCost;
        }
      }

      // Calculate PV and ATP using dynamic formulas
      const statsForFormula: Record<string, number> = {};
      ATTRIBUTES.forEach(attr => {
        statsForFormula[attr.id.toUpperCase()] = stats[attr.id] || 0;
      });
      // NPCs start with 0 LUTA/MISTICA for formula calculation unless we want to count their skills
      const npcSkills = skills.filter(s => selectedSkills.includes(s.id));
      statsForFormula['LUTA'] = npcSkills.filter(s => s.type === 'Luta').length;
      statsForFormula['MISTICA'] = npcSkills.filter(s => s.type === 'Mística').length;

      const maxPV = evaluateFormula(session.pvFormula || '((FOR / 2) + CON) * 10', statsForFormula);
      const maxATP = evaluateFormula(session.atpFormula || '(INT + 3) * 3', statsForFormula);

      stats.pv = maxPV;
      stats.atp = maxATP;

      const npcData = {
        name,
        class: archetype.charAt(0).toUpperCase() + archetype.slice(1),
        level,
        image: `https://picsum.photos/seed/${name.replace(' ', '')}/400/400`,
        ownerId: user.uid,
        sessionId: session.id,
        stats,
        statsMods: {},
        skills: selectedSkills,
        powers: selectedPowers,
        skillPoints: remainingSkillPoints,
        powerPoints: remainingPowerPoints,
        currentPV: maxPV,
        currentATP: maxATP,
        money: Math.floor(Math.random() * 100),
        inventory: [],
        isNPC: true,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'characters'), npcData);
      setIsGeneratingNPC(false);
      alert(`NPC ${name} gerado com sucesso!`);
    } catch (err) {
      console.error('Error generating NPC:', err);
      handleFirestoreError(err, OperationType.CREATE, 'characters');
    }
  };

  // Talent Form State
  const [isCreatingTalent, setIsCreatingTalent] = React.useState(false);
  const [newTalent, setNewTalent] = React.useState({
    name: '',
    description: '',
    composition: [] as string[]
  });

  // Skill Form State
  const [isCreatingSkill, setIsCreatingSkill] = React.useState(false);
  const [editingSkillId, setEditingSkillId] = React.useState<string | null>(null);
  const [newSkill, setNewSkill] = React.useState({
    name: '',
    type: 'Geral' as 'Luta' | 'Mística' | 'Geral' | 'Conhecimento' | 'Artes' | 'Treinamento' | 'Ocultismo' | 'Empírico',
    atpCost: 0,
    damage: '',
    description: '',
    purchaseCost: 0,
    difficultyFormula: ''
  });

  // Power Form State
  const [isCreatingPower, setIsCreatingPower] = React.useState(false);
  const [editingPowerId, setEditingPowerId] = React.useState<string | null>(null);
  const [newPower, setNewPower] = React.useState({
    name: '',
    type: 'Geral' as 'Físico' | 'Elemental' | 'Defesa' | 'Buff' | 'Debuff' | 'Geral',
    cost: '',
    effect: '',
    description: '',
    purchaseCost: 0,
    difficultyFormula: ''
  });

  const filteredAndSortedCharacters = React.useMemo(() => {
    return characters
      .filter(char => {
        const matchesClass = filterClass === 'all' || char.class === filterClass;
        const matchesLevel = filterLevel === 'all' || char.level.toString() === filterLevel;
        // Mock status filter for now, as we don't have real presence yet
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'online' ? true : false);
        return matchesClass && matchesLevel && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return b.level - a.level;
        }
      });
  }, [characters, filterClass, filterLevel, filterStatus, sortBy]);

  const uniqueClasses = React.useMemo(() => {
    const classes = new Set(characters.map(c => c.class));
    return Array.from(classes).sort();
  }, [characters]);

  const uniqueLevels = React.useMemo(() => {
    const levels = new Set(characters.map(c => c.level.toString()));
    return Array.from(levels).sort((a: string, b: string) => parseInt(a) - parseInt(b));
  }, [characters]);

  React.useEffect(() => {
    if (!sessionId) return;

    const sessionRef = doc(db, 'gameSessions', sessionId);
    const unsubscribeSession = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // SECURITY CHECK: Only the GM of this specific session can access this dashboard
        if (data.gmId !== user?.uid) {
          navigate('/');
          return;
        }
        setSession({ id: doc.id, ...data } as GameSession);
        setGmNotes(data.gmNotes || '');
        setSessionName(data.name || '');
        setSessionImage(data.image || '');
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `gameSessions/${sessionId}`);
      setLoading(false);
    });

    // Global Settings
    const settingsRef = doc(db, 'globalSettings', 'config');
    const unsubscribeSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMaxAttributePoints(data.maxAttributePoints || 120);
        setMaxSingleAttributeValue(data.maxSingleAttributeValue || 100);
        setInitialSkillPoints(data.initialSkillPoints || 0);
        setInitialPowerPoints(data.initialPowerPoints || 0);
        setPvFormula(data.pvFormula || '((FOR / 2) + CON) * 10');
        setAtpFormula(data.atpFormula || '(INT + 3) * 3');
        setSocoFormula(data.socoFormula || 'FOR');
        setChuteFormula(data.chuteFormula || 'FOR + (FOR / 2)');
        setDefesaFormula(data.defesaFormula || 'CON + (AGI / 2) + (LUTA * 2)');
        setEsquivaFormula(data.esquivaFormula || '(CON + AGI + (VEL / 2)) + (LUTA * 2)');
        setEnFormula(data.enFormula || '20 - ((AGI + (PER / 2)) + (LUTA * 2))');
        setDmFormula(data.dmFormula || '20 - ((AGI + (PER / 2)) + (MISTICA * 2))');
        setSkillCostFormula(data.skillCostFormula || '(COST * LVL) / VAR');
        setPowerCostFormula(data.powerCostFormula || '(COST * LVL) / VAR');
        setSkillTypeVars(data.skillTypeVars || {
          'Geral': '1',
          'Luta': 'FOR',
          'Mística': 'INT',
          'Conhecimento': 'INT',
          'Artes': 'INI',
          'Ocultismo': 'COR',
          'Treinamento': 'CON',
          'Empírico': 'PER'
        });
        setPowerTypeVars(data.powerTypeVars || {
          'Geral': '1',
          'Elemental': 'INT',
          'Físico': 'FOR',
          'Defesa': 'CON',
          'Buff': 'COR',
          'Debuff': 'INI'
        });
      }
    });

    const charactersQuery = query(
      collection(db, 'characters'),
      where('sessionId', '==', sessionId)
    );
    const unsubscribeCharacters = onSnapshot(charactersQuery, (snapshot) => {
      const charData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Character[];
      setCharacters(charData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'characters');
    });

    // Global Talents
    const talentsQuery = query(collection(db, 'talents'));
    const unsubscribeTalents = onSnapshot(talentsQuery, (snapshot) => {
      const talentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Talent[];
      setTalents(talentData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'talents');
    });

    // Global Skills
    const skillsQuery = query(collection(db, 'skills'));
    const unsubscribeSkills = onSnapshot(skillsQuery, (snapshot) => {
      const skillData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Skill[];
      setSkills(skillData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'skills');
    });

    // Global Powers
    const powersQuery = query(collection(db, 'powers'));
    const unsubscribePowers = onSnapshot(powersQuery, (snapshot) => {
      const powerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Power[];
      setPowers(powerData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'powers');
    });

    // Suggestions
    const suggestionsQuery = query(collection(db, 'suggestions'), where('status', '==', 'pending'));
    const unsubscribeSuggestions = onSnapshot(suggestionsQuery, (snapshot) => {
      const suggestionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Suggestion[];
      setSuggestions(suggestionData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suggestions');
    });

    return () => {
      unsubscribeSession();
      unsubscribeSettings();
      unsubscribeCharacters();
      unsubscribeTalents();
      unsubscribeSkills();
      unsubscribePowers();
      unsubscribeSuggestions();
    };
  }, [sessionId]);

  const handleSaveNotes = async () => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        gmNotes: gmNotes
      });
    } catch (err) {
      console.error('Error saving GM notes:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!sessionId) return;
    try {
      // Save session-specific info
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        name: sessionName,
        image: sessionImage,
      });

      // Save global settings
      await setDoc(doc(db, 'globalSettings', 'config'), {
        maxAttributePoints: Number(maxAttributePoints),
        maxSingleAttributeValue: Number(maxSingleAttributeValue),
        initialSkillPoints: Number(initialSkillPoints),
        initialPowerPoints: Number(initialPowerPoints),
        pvFormula,
        atpFormula,
        socoFormula,
        chuteFormula,
        defesaFormula,
        esquivaFormula,
        enFormula,
        dmFormula,
        skillCostFormula,
        powerCostFormula,
        skillTypeVars,
        powerTypeVars,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Error saving settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, `gameSessions/${sessionId}`);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      await deleteDoc(doc(db, 'gameSessions', sessionId));
      navigate('/');
    } catch (err) {
      console.error('Error deleting session:', err);
      handleFirestoreError(err, OperationType.DELETE, `gameSessions/${sessionId}`);
    }
  };

  const [editingTalentId, setEditingTalentId] = React.useState<string | null>(null);

  const handleCreateTalent = async () => {
    if (!user || !newTalent.name || newTalent.composition.length === 0) return;
    try {
      if (editingTalentId) {
        await updateDoc(doc(db, 'talents', editingTalentId), {
          ...newTalent,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'talents'), {
          ...newTalent,
          createdAt: new Date().toISOString()
        });
      }
      setNewTalent({ name: '', description: '', composition: [] });
      setIsCreatingTalent(false);
      setEditingTalentId(null);
    } catch (err) {
      console.error('Error saving talent:', err);
      handleFirestoreError(err, editingTalentId ? OperationType.UPDATE : OperationType.CREATE, 'talents');
    }
  };

  const handleEditTalent = (talent: any) => {
    setNewTalent({
      name: talent.name,
      description: talent.description,
      composition: talent.composition
    });
    setEditingTalentId(talent.id);
    setIsCreatingTalent(true);
  };

  const handleDeleteTalent = async (talentId: string) => {
    try {
      await deleteDoc(doc(db, 'talents', talentId));
    } catch (err) {
      console.error('Error deleting talent:', err);
      handleFirestoreError(err, OperationType.DELETE, `talents/${talentId}`);
    }
  };

  const handleCreateSkill = async () => {
    if (!user || !newSkill.name) return;
    try {
      if (editingSkillId) {
        await updateDoc(doc(db, 'skills', editingSkillId), {
          ...newSkill,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'skills'), {
          ...newSkill,
          createdAt: new Date().toISOString()
        });
      }
      setNewSkill({ name: '', type: 'Geral', atpCost: 0, damage: '', description: '', purchaseCost: 0, difficultyFormula: '' });
      setIsCreatingSkill(false);
      setEditingSkillId(null);
    } catch (err) {
      console.error('Error saving skill:', err);
      handleFirestoreError(err, editingSkillId ? OperationType.UPDATE : OperationType.CREATE, 'skills');
    }
  };

  const handleEditSkill = (skill: Skill) => {
    setNewSkill({
      name: skill.name,
      type: skill.type,
      atpCost: skill.atpCost,
      damage: skill.damage,
      description: skill.description,
      purchaseCost: skill.purchaseCost,
      difficultyFormula: skill.difficultyFormula || ''
    });
    setEditingSkillId(skill.id);
    setIsCreatingSkill(true);
  };

  const handleDeleteSkill = async (skillId: string) => {
    try {
      await deleteDoc(doc(db, 'skills', skillId));
    } catch (err) {
      console.error('Error deleting skill:', err);
      handleFirestoreError(err, OperationType.DELETE, `skills/${skillId}`);
    }
  };

  const handleCreatePower = async () => {
    if (!user || !newPower.name) return;
    try {
      if (editingPowerId) {
        await updateDoc(doc(db, 'powers', editingPowerId), {
          ...newPower,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'powers'), {
          ...newPower,
          createdAt: new Date().toISOString()
        });
      }
      setNewPower({ name: '', type: 'Geral', cost: '', effect: '', description: '', purchaseCost: 0, difficultyFormula: '' });
      setIsCreatingPower(false);
      setEditingPowerId(null);
    } catch (err) {
      console.error('Error saving power:', err);
      handleFirestoreError(err, editingPowerId ? OperationType.UPDATE : OperationType.CREATE, 'powers');
    }
  };

  const handleEditPower = (power: Power) => {
    setNewPower({
      name: power.name,
      type: power.type,
      cost: power.cost,
      effect: power.effect,
      description: power.description,
      purchaseCost: power.purchaseCost,
      difficultyFormula: power.difficultyFormula || ''
    });
    setEditingPowerId(power.id);
    setIsCreatingPower(true);
  };

  const handleDeletePower = async (powerId: string) => {
    try {
      await deleteDoc(doc(db, 'powers', powerId));
    } catch (err) {
      console.error('Error deleting power:', err);
      handleFirestoreError(err, OperationType.DELETE, `powers/${powerId}`);
    }
  };

  const handleApproveSuggestion = async (suggestion: Suggestion, updatedData?: any) => {
    try {
      const collectionName = suggestion.type === 'skill' ? 'skills' : 'powers';
      const dataToSave = updatedData || suggestion.data;
      // Create the actual skill/power
      await addDoc(collection(db, collectionName), {
        ...dataToSave,
        createdAt: new Date().toISOString()
      });
      // Update suggestion status
      await updateDoc(doc(db, 'suggestions', suggestion.id), {
        status: 'approved',
        data: dataToSave
      });
      alert('Sugestão aprovada e adicionada à biblioteca global!');
      setEditingSuggestion(null);
    } catch (err) {
      console.error('Error approving suggestion:', err);
      handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestion.id}`);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    try {
      await updateDoc(doc(db, 'suggestions', suggestionId), {
        status: 'rejected'
      });
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestionId}`);
    }
  };

  const addAttributeToTalent = (attrId: string) => {
    setNewTalent(prev => ({
      ...prev,
      composition: [...prev.composition, attrId]
    }));
  };

  const removeAttributeFromTalent = (index: number) => {
    setNewTalent(prev => ({
      ...prev,
      composition: prev.composition.filter((_, i) => i !== index)
    }));
  };

  const handleLevelUp = async (char: Character, amount: number = 1) => {
    try {
      const newLevel = char.level + amount;
      await updateDoc(doc(db, 'characters', char.id), {
        level: newLevel
      });
      if (managingCharacter?.id === char.id) {
        setManagingCharacter({ ...managingCharacter, level: newLevel });
      }
    } catch (err) {
      console.error('Error leveling up:', err);
      handleFirestoreError(err, OperationType.UPDATE, `characters/${char.id}`);
    }
  };

  const handleAddPoints = async (char: Character, type: 'skills' | 'powers' | 'attributes') => {
    try {
      const field = type === 'skills' ? 'skillPoints' : type === 'powers' ? 'powerPoints' : 'attributePoints';
      const amount = type === 'skills' ? pointsToAdd.skills : type === 'powers' ? pointsToAdd.powers : pointsToAdd.attributes;
      const currentPoints = (char as any)[field] || 0;
      
      await updateDoc(doc(db, 'characters', char.id), {
        [field]: currentPoints + amount
      });
      
      if (managingCharacter?.id === char.id) {
        setManagingCharacter({ ...managingCharacter, [field]: currentPoints + amount });
      }
    } catch (err) {
      console.error(`Error adding ${type} points:`, err);
      handleFirestoreError(err, OperationType.UPDATE, `characters/${char.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-arcane/20 border-t-arcane rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-2xl font-serif">Sessão não encontrada</h2>
        <Link to="/" className="text-arcane hover:underline">Voltar ao Painel</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-parchment p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => navigate('/')}
              className="p-2 sm:p-3 glass rounded-xl sm:rounded-2xl hover:bg-white/10 transition-colors text-parchment/40 hover:text-parchment"
            >
              <ChevronLeft size={20} sm:size={24} />
            </button>
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <Shield size={18} sm:size={20} className="text-ember" />
                <h1 className="text-2xl sm:text-4xl font-serif text-glow-arcane line-clamp-1">{session.name}</h1>
              </div>
              <p className="text-parchment/40 font-mono text-[10px] sm:text-sm uppercase tracking-widest flex items-center gap-2">
                Painel do Mestre • <span className="hidden sm:inline">Código:</span> 
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(session.code);
                    alert('Código da sessão copiado!');
                  }}
                  className="text-arcane hover:text-arcane/80 transition-colors flex items-center gap-1"
                  title="Clique para copiar"
                >
                  {session.code}
                  <Copy size={10} sm:size={12} />
                </button>
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
            <button 
              onClick={() => setActiveTab('characters')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'characters' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Personagens
            </button>
            <button 
              onClick={() => setActiveTab('journal')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'journal' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Diário
            </button>
            <button 
              onClick={() => setActiveTab('talents')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'talents' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Talentos
            </button>
            <button 
              onClick={() => setActiveTab('skills')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'skills' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Perícias
            </button>
            <button 
              onClick={() => setActiveTab('powers')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'powers' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Poderes
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'notes' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Notas
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                activeTab === 'settings' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Config
            </button>
            <button 
              onClick={() => setActiveTab('suggestions')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                activeTab === 'suggestions' ? "bg-arcane text-obsidian" : "glass hover:bg-white/5"
              )}
            >
              Sugestões
              {suggestions.length > 0 && (
                <span className="w-4 h-4 bg-ember text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {suggestions.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'characters' && (
            <motion.div
              key="characters"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <button 
                  onClick={() => setIsGeneratingNPC(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-arcane/10 text-arcane border border-arcane/20 rounded-2xl font-bold hover:bg-arcane hover:text-obsidian transition-all"
                >
                  <Plus size={20} />
                  Gerar NPC Automático
                </button>
                <div className="flex items-center gap-2 px-4 py-2 glass rounded-2xl border border-white/10">
                  <Users size={18} className="text-parchment/40" />
                  <span className="text-sm font-medium">{characters.length} Personagens</span>
                </div>
              </div>

              {/* Filters and Sorting */}
              {characters.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <div className="flex items-center gap-2 text-parchment/40">
                    <Filter size={16} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Filtros:</span>
                  </div>
                  
                  <select 
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todas as Classes</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>

                  <select 
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todos os Níveis</option>
                    {uniqueLevels.map(lvl => (
                      <option key={lvl} value={lvl}>Nível {lvl}</option>
                    ))}
                  </select>

                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>

                  <div className="flex items-center gap-2 text-parchment/40 ml-auto">
                    <ArrowUpDown size={16} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Ordenar:</span>
                  </div>

                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'level')}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="name">Nome (A-Z)</option>
                    <option value="level">Nível (Maior)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {characters.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Users size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum aventureiro ainda</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Compartilhe o código <span className="text-arcane font-mono">{session.code}</span> com seus jogadores para eles entrarem na sessão.</p>
                  </div>
                ) : filteredAndSortedCharacters.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Filter size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum aventureiro encontrado</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Tente ajustar seus filtros para encontrar o que procura.</p>
                  </div>
                ) : (
                  filteredAndSortedCharacters.map((char, idx) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative overflow-hidden"
                    >
                    <div className="flex items-start justify-between mb-4 sm:mb-6 relative z-10">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-arcane/50 transition-colors relative">
                          <img 
                            src={char.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`} 
                            alt={char.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {char.isNPC && (
                            <div className="absolute top-0 right-0 bg-ember text-obsidian p-1 rounded-bl-lg shadow-lg" title="NPC">
                              <User size={10} />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-lg sm:text-xl font-serif mb-0.5 sm:mb-1">{char.name}</h4>
                          <p className="text-[8px] sm:text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Nível {char.level} • {char.class}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                          <Heart size={10} sm:size={12} />
                          <span className="text-[10px] sm:text-xs font-bold">{char.currentPV}/{char.stats.pv}</span>
                        </div>
                        <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Zap size={10} sm:size={12} />
                          <span className="text-[10px] sm:text-xs font-bold">{char.currentATP}/{char.stats.atp}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 relative z-10">
                      <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                        <p className="text-[10px] text-parchment/40 font-mono mb-1">FOR</p>
                        <p className="text-lg font-serif">{char.stats.for}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                        <p className="text-[10px] text-parchment/40 font-mono mb-1">AGI</p>
                        <p className="text-lg font-serif">{char.stats.agi}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
                        <p className="text-[10px] text-parchment/40 font-mono mb-1">CON</p>
                        <p className="text-lg font-serif">{char.stats.con}</p>
                      </div>
                    </div>

                      <div className="mt-6 flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[10px] font-mono text-parchment/40 uppercase">Online</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setDeleteConfirm({ id: char.id, type: 'character', name: char.name })}
                            className="p-2 glass rounded-xl hover:bg-red-500/10 transition-colors text-parchment/20 hover:text-red-400"
                            title="Excluir Personagem"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button 
                            onClick={() => setManagingCharacter(char)}
                            className="p-2 glass rounded-xl hover:bg-white/10 transition-colors text-parchment/60 hover:text-parchment"
                            title="Gerenciar Personagem"
                          >
                            <Edit2 size={18} />
                          </button>
                          <Link 
                            to={`/sheet?id=${char.id}`}
                            className="p-2 glass rounded-xl hover:bg-arcane/20 transition-colors text-arcane"
                          >
                            <ChevronRightIcon size={20} />
                          </Link>
                        </div>
                      </div>

                    {/* Background Decoration */}
                    <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Dice6 size={120} />
                    </div>
                  </motion.div>
                ))
              )}
              </div>
            </motion.div>
          )}

          {activeTab === 'journal' && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SessionJournal gameSessionId={sessionId} />
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif">Notas do Mestre</h3>
                <button 
                  onClick={handleSaveNotes}
                  className="flex items-center gap-2 px-4 py-2 bg-arcane/20 text-arcane rounded-xl hover:bg-arcane/30 transition-all text-sm font-medium"
                >
                  <Save size={18} />
                  Salvar Notas
                </button>
              </div>
              <textarea 
                value={gmNotes}
                onChange={(e) => setGmNotes(e.target.value)}
                className="w-full h-[500px] bg-transparent border-none focus:ring-0 font-serif text-lg leading-relaxed placeholder:text-parchment/20 resize-none"
                placeholder="Suas anotações secretas, planos e segredos da campanha..."
              />
            </motion.div>
          )}

          {activeTab === 'talents' && (
            <motion.div
              key="talents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Biblioteca de Talentos</h3>
                  <p className="text-sm text-parchment/40">Defina talentos e suas composições de atributos para esta campanha.</p>
                </div>
                <button 
                  onClick={() => {
                    if (isCreatingTalent) {
                      setIsCreatingTalent(false);
                      setEditingTalentId(null);
                      setNewTalent({ name: '', description: '', composition: [] });
                    } else {
                      setIsCreatingTalent(true);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  {isCreatingTalent ? <X size={18} /> : <Plus size={18} />}
                  {isCreatingTalent ? 'Cancelar' : 'Novo Talento'}
                </button>
              </div>

              {isCreatingTalent && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="glass p-8 rounded-[2.5rem] space-y-6 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Talento</label>
                        <input 
                          type="text" 
                          value={newTalent.name}
                          onChange={e => setNewTalent(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Mestre das Lâminas"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                        <textarea 
                          value={newTalent.description}
                          onChange={e => setNewTalent(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="O que este talento faz?"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors h-32 resize-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Composição Atual</label>
                        <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-white/5 border border-white/10 rounded-xl">
                          {newTalent.composition.length === 0 ? (
                            <div className="flex items-center justify-center w-full h-full">
                              <span className="text-xs text-parchment/20 italic">Nenhum atributo selecionado</span>
                            </div>
                          ) : (
                            newTalent.composition.map((attrId, index) => {
                              const attr = ATTRIBUTES.find(a => a.id === attrId);
                              if (!attr) return null;
                              return (
                                <motion.div 
                                  key={`${attrId}-${index}`}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-arcane/10 border border-arcane/30 text-arcane text-xs font-medium"
                                >
                                  <attr.icon size={12} />
                                  {attr.label}
                                  <button 
                                    onClick={() => removeAttributeFromTalent(index)}
                                    className="hover:text-ember transition-colors ml-1"
                                  >
                                    <X size={14} />
                                  </button>
                                </motion.div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Adicionar Atributo</label>
                        <div className="grid grid-cols-2 gap-3">
                          {ATTRIBUTES.map(attr => (
                            <button
                              key={attr.id}
                              onClick={() => addAttributeToTalent(attr.id)}
                              className="flex items-center gap-3 p-3 rounded-xl border bg-white/5 border-white/10 text-parchment/40 hover:border-arcane/50 hover:text-parchment transition-all text-left group"
                            >
                              <attr.icon size={16} className="group-hover:text-arcane transition-colors" />
                              <span className="text-sm font-medium">{attr.label}</span>
                              <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-parchment/40 font-mono px-2">Clique nos atributos para adicioná-los à composição. Você pode adicionar o mesmo atributo múltiplas vezes.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleCreateTalent}
                      disabled={!newTalent.name || newTalent.composition.length === 0}
                      className="flex items-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Save size={18} />
                      {editingTalentId ? 'Salvar Alterações' : 'Criar Talento'}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {talents.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Sparkles size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum talento cadastrado</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Crie talentos personalizados para que seus jogadores possam usá-los em suas fichas.</p>
                  </div>
                ) : (
                  talents.map((talent) => (
                    <div key={talent.id} className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl font-serif text-glow-arcane">{talent.name}</h4>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditTalent(talent)}
                            className="p-2 text-parchment/20 hover:text-arcane transition-colors"
                            title="Editar Talento"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTalent(talent.id)}
                            className="p-2 text-parchment/20 hover:text-red-400 transition-colors"
                            title="Excluir Talento"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-parchment/60 mb-6 line-clamp-3">{talent.description || 'Sem descrição.'}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {talent.composition.map(attrId => {
                          const attr = ATTRIBUTES.find(a => a.id === attrId);
                          if (!attr) return null;
                          return (
                            <div key={attrId} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-wider">
                              <attr.icon size={10} className={attr.color} />
                              {attr.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'skills' && (
            <motion.div
              key="skills"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Biblioteca de Perícias</h3>
                  <p className="text-sm text-parchment/40">Crie perícias e disciplinas para os jogadores adicionarem às suas fichas.</p>
                </div>
                <button 
                  onClick={() => {
                    if (isCreatingSkill) {
                      setIsCreatingSkill(false);
                      setEditingSkillId(null);
                      setNewSkill({ name: '', type: 'Geral', atpCost: 0, damage: '', description: '', purchaseCost: 0 });
                    } else {
                      setIsCreatingSkill(true);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Plus size={18} />
                  {isCreatingSkill ? 'Cancelar' : 'Nova Perícia'}
                </button>
              </div>

              {isCreatingSkill && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="glass p-8 rounded-[2.5rem] space-y-6 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome da Perícia</label>
                        <input 
                          type="text" 
                          value={newSkill.name}
                          onChange={e => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Golpe Fulminante"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo</label>
                          <select 
                            value={newSkill.type}
                            onChange={e => setNewSkill(prev => ({ ...prev, type: e.target.value as any }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          >
                            <option value="Geral">Geral</option>
                            <option value="Luta">Luta</option>
                            <option value="Mística">Mística</option>
                            <option value="Conhecimento">Conhecimento</option>
                            <option value="Artes">Artes</option>
                            <option value="Treinamento">Treinamento</option>
                            <option value="Ocultismo">Ocultismo</option>
                            <option value="Empírico">Empírico</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo ATP</label>
                          <input 
                            type="number" 
                            value={newSkill.atpCost}
                            onChange={e => setNewSkill(prev => ({ ...prev, atpCost: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Compra (XP)</label>
                          <input 
                            type="number" 
                            value={newSkill.purchaseCost}
                            onChange={e => setNewSkill(prev => ({ ...prev, purchaseCost: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano / Fórmula</label>
                        <input 
                          type="text" 
                          value={newSkill.damage}
                          onChange={e => setNewSkill(prev => ({ ...prev, damage: e.target.value }))}
                          placeholder="Ex: 2d6 + FOR"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dificuldade (Fórmula)</label>
                        <input 
                          type="text" 
                          value={newSkill.difficultyFormula}
                          onChange={e => setNewSkill(prev => ({ ...prev, difficultyFormula: e.target.value }))}
                          placeholder="Ex: 10 + FOR + INT"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                        <textarea 
                          value={newSkill.description}
                          onChange={e => setNewSkill(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="O que esta perícia faz?"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors h-24 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleCreateSkill}
                      disabled={!newSkill.name}
                      className="flex items-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Save size={18} />
                      {editingSkillId ? 'Salvar Alterações' : 'Criar Perícia'}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {skills.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Scroll size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhuma perícia cadastrada</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Crie perícias para que seus jogadores possam usá-las em suas fichas.</p>
                  </div>
                ) : (
                  skills.map((skill) => (
                    <div key={skill.id} className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-serif text-glow-arcane">{skill.name}</h4>
                          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{skill.type}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditSkill(skill)}
                            className="p-2 text-parchment/20 hover:text-arcane transition-colors"
                            title="Editar Perícia"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSkill(skill.id)}
                            className="p-2 text-parchment/20 hover:text-red-400 transition-colors"
                            title="Excluir Perícia"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-4 mb-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                          <Zap size={10} />
                          {skill.atpCost} ATP
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20 text-[10px] font-bold">
                          <Sparkles size={10} />
                          {skill.purchaseCost} XP
                        </div>
                        {skill.damage && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                            <Sword size={10} />
                            {skill.damage}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-parchment/60 line-clamp-3">{skill.description || 'Sem descrição.'}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'powers' && (
            <motion.div
              key="powers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Biblioteca de Poderes e Mágias</h3>
                  <p className="text-sm text-parchment/40">Crie poderes e mágias especiais para a campanha.</p>
                </div>
                <button 
                  onClick={() => {
                    if (isCreatingPower) {
                      setIsCreatingPower(false);
                      setEditingPowerId(null);
                      setNewPower({ name: '', type: 'Geral', cost: '', effect: '', description: '', purchaseCost: 0, difficultyFormula: '' });
                    } else {
                      setIsCreatingPower(true);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Plus size={18} />
                  {isCreatingPower ? 'Cancelar' : 'Novo Poder'}
                </button>
              </div>

              {isCreatingPower && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="glass p-8 rounded-[2.5rem] space-y-6 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Poder / Mágia</label>
                        <input 
                          type="text" 
                          value={newPower.name}
                          onChange={e => setNewPower(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Bola de Fogo"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo de Poder</label>
                        <select 
                          value={newPower.type}
                          onChange={e => setNewPower(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        >
                          <option value="Físico">Físico</option>
                          <option value="Elemental">Elemental</option>
                          <option value="Defesa">Defesa</option>
                          <option value="Buff">Buff</option>
                          <option value="Debuff">Debuff</option>
                          <option value="Geral">Geral</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo</label>
                        <input 
                          type="text" 
                          value={newPower.cost}
                          onChange={e => setNewPower(prev => ({ ...prev, cost: e.target.value }))}
                          placeholder="Ex: 10 ATP ou 1 Turno"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Compra (XP)</label>
                        <input 
                          type="number" 
                          value={newPower.purchaseCost}
                          onChange={e => setNewPower(prev => ({ ...prev, purchaseCost: Number(e.target.value) }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Efeito / Dano</label>
                        <input 
                          type="text" 
                          value={newPower.effect}
                          onChange={e => setNewPower(prev => ({ ...prev, effect: e.target.value }))}
                          placeholder="Ex: 4d10 de fogo em área"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dificuldade (Fórmula)</label>
                        <input 
                          type="text" 
                          value={newPower.difficultyFormula}
                          onChange={e => setNewPower(prev => ({ ...prev, difficultyFormula: e.target.value }))}
                          placeholder="Ex: 15 + INT + AGI"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                        <textarea 
                          value={newPower.description}
                          onChange={e => setNewPower(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Detalhes sobre o funcionamento..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors h-24 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleCreatePower}
                      disabled={!newPower.name}
                      className="flex items-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Save size={18} />
                      {editingPowerId ? 'Salvar Alterações' : 'Criar Poder'}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {powers.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Flame size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhum poder cadastrado</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Crie poderes e mágias para enriquecer sua campanha.</p>
                  </div>
                ) : (
                  powers.map((power) => (
                    <div key={power.id} className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-serif text-glow-arcane mb-1">{power.name}</h4>
                          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{power.type}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditPower(power)}
                            className="p-2 text-parchment/20 hover:text-arcane transition-colors"
                            title="Editar Poder"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeletePower(power.id)}
                            className="p-2 text-parchment/20 hover:text-red-400 transition-colors"
                            title="Excluir Poder"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 mb-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-gold uppercase tracking-wider">
                          <Sparkles size={10} />
                          Custo de Compra: {power.purchaseCost} XP
                        </div>
                        {power.cost && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                            <Zap size={10} />
                            Custo: {power.cost}
                          </div>
                        )}
                        {power.effect && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400 uppercase tracking-wider">
                            <Flame size={10} />
                            Efeito: {power.effect}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-parchment/60 line-clamp-3">{power.description || 'Sem descrição.'}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif">Configurações da Campanha</h3>
                <button 
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Save size={18} />
                  Salvar Alterações
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome da Campanha</label>
                  <input 
                    type="text" 
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">URL da Imagem de Capa</label>
                  <input 
                    type="text" 
                    value={sessionImage}
                    onChange={e => setSessionImage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos de Atributo Iniciais</label>
                  <input 
                    type="number" 
                    value={maxAttributePoints}
                    onChange={e => setMaxAttributePoints(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define quantos pontos os jogadores podem distribuir na criação de personagem.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Valor Máximo por Atributo</label>
                  <input 
                    type="number" 
                    value={maxSingleAttributeValue}
                    onChange={e => setMaxSingleAttributeValue(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define o valor máximo que um único atributo pode atingir na criação.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos para Perícias</label>
                  <input 
                    type="number" 
                    value={initialSkillPoints}
                    onChange={e => setInitialSkillPoints(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define quantos pontos os jogadores têm para comprar perícias.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos para Poderes</label>
                  <input 
                    type="number" 
                    value={initialPowerPoints}
                    onChange={e => setInitialPowerPoints(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define quantos pontos os jogadores têm para comprar poderes.</p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-xl font-serif mb-2">Fórmulas de Combate</h4>
                  <p className="text-sm text-parchment/40">Personalize como os status de combate são calculados. Use nomes de atributos em maiúsculo (ex: FOR, CON, INT, AGI, PER, VEL, INI, COR) e use LUTA ou MISTICA para contar perícias desses tipos.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de PV Máximo</label>
                    <input 
                      type="text" 
                      value={pvFormula}
                      onChange={e => setPvFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de ATP Máximo</label>
                    <input 
                      type="text" 
                      value={atpFormula}
                      onChange={e => setAtpFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Soco</label>
                    <input 
                      type="text" 
                      value={socoFormula}
                      onChange={e => setSocoFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Chute</label>
                    <input 
                      type="text" 
                      value={chuteFormula}
                      onChange={e => setChuteFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Defesa</label>
                    <input 
                      type="text" 
                      value={defesaFormula}
                      onChange={e => setDefesaFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Esquiva</label>
                    <input 
                      type="text" 
                      value={esquivaFormula}
                      onChange={e => setEsquivaFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Energia (EN)</label>
                    <input 
                      type="text" 
                      value={enFormula}
                      onChange={e => setEnFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Dano Místico (DM)</label>
                    <input 
                      type="text" 
                      value={dmFormula}
                      onChange={e => setDmFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-xl font-serif mb-2">Fórmulas de Custo (Perícias e Poderes)</h4>
                  <p className="text-sm text-parchment/40">Personalize como o custo de compra de perícias e poderes é calculado. Use COST para o custo base, LVL para o nível e VAR para a variável de tipo.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Custo de Perícias</label>
                    <input 
                      type="text" 
                      value={skillCostFormula}
                      onChange={e => setSkillCostFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Fórmula de Custo de Poderes</label>
                    <input 
                      type="text" 
                      value={powerCostFormula}
                      onChange={e => setPowerCostFormula(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h5 className="text-sm font-serif text-parchment/60 uppercase tracking-widest">Variáveis de Tipo de Perícia</h5>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(skillTypeVars).map(([type, value]) => (
                        <div key={type} className="space-y-1">
                          <label className="text-[9px] font-mono text-parchment/30 uppercase">{type}</label>
                          <input 
                            type="text" 
                            value={value}
                            onChange={e => setSkillTypeVars(prev => ({ ...prev, [type]: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-sm font-serif text-parchment/60 uppercase tracking-widest">Variáveis de Tipo de Poder</h5>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(powerTypeVars).map(([type, value]) => (
                        <div key={type} className="space-y-1">
                          <label className="text-[9px] font-mono text-parchment/30 uppercase">{type}</label>
                          <input 
                            type="text" 
                            value={value}
                            onChange={e => setPowerTypeVars(prev => ({ ...prev, [type]: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10">
                <div className="bg-ember/5 border border-ember/20 p-6 rounded-2xl space-y-4">
                  <h4 className="text-ember font-serif text-lg">Zona de Perigo</h4>
                  <p className="text-sm text-parchment/60">A exclusão da campanha é permanente e não pode ser desfeita. Todos os personagens vinculados perderão o vínculo com esta campanha.</p>
                  <button 
                    onClick={() => setDeleteConfirm({ id: sessionId!, type: 'session', name: session.name })}
                    className="flex items-center gap-2 px-6 py-3 bg-ember/10 text-ember border border-ember/20 rounded-xl hover:bg-ember/20 transition-all font-bold text-sm"
                  >
                    <Trash2 size={18} />
                    Excluir Campanha Permanentemente
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'suggestions' && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="space-y-2">
                <h3 className="text-3xl font-serif">Sugestões dos Jogadores</h3>
                <p className="text-parchment/40 font-mono text-xs uppercase tracking-widest">Revise e aprove novas perícias e poderes sugeridos pelos jogadores</p>
              </header>

              <div className="grid grid-cols-1 gap-6">
                {suggestions.map(suggestion => (
                  <div key={suggestion.id} className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-3 rounded-2xl",
                            suggestion.type === 'skill' ? "bg-arcane/20 text-arcane" : "bg-ember/20 text-ember"
                          )}>
                            {suggestion.type === 'skill' ? <Sword size={24} /> : <Zap size={24} />}
                          </div>
                          <div>
                            <h4 className="text-2xl font-serif">{suggestion.data.name}</h4>
                            <p className="text-xs font-mono text-parchment/40 uppercase tracking-widest">
                              Sugerido por {suggestion.suggestedByName} • {suggestion.type === 'skill' ? 'Perícia' : 'Poder'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Tipo</span>
                            <p className="text-sm font-medium">{suggestion.data.type}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Custo de Compra</span>
                            <p className="text-sm font-medium">{suggestion.data.purchaseCost} Pontos</p>
                          </div>
                          {suggestion.type === 'skill' ? (
                            <>
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Custo ATP</span>
                                <p className="text-sm font-medium">{suggestion.data.atpCost || 0}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Dano</span>
                                <p className="text-sm font-medium">{suggestion.data.damage || '-'}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Custo Uso</span>
                                <p className="text-sm font-medium">{suggestion.data.cost || '-'}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Efeito</span>
                                <p className="text-sm font-medium">{suggestion.data.effect || '-'}</p>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Descrição</span>
                          <p className="text-sm text-parchment/60 leading-relaxed italic">"{suggestion.data.description}"</p>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-3">
                        <button 
                          onClick={() => setEditingSuggestion(suggestion)}
                          className="flex-1 md:w-40 py-4 glass text-parchment rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all border border-white/10"
                        >
                          <Edit2 size={18} />
                          Editar
                        </button>
                        <button 
                          onClick={() => handleApproveSuggestion(suggestion)}
                          className="flex-1 md:w-40 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-arcane/20"
                        >
                          <Check size={18} />
                          Aprovar
                        </button>
                        <button 
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          className="flex-1 md:w-40 py-4 glass-ember text-ember rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-ember/10 transition-all border border-ember/20"
                        >
                          <X size={18} />
                          Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {suggestions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 glass rounded-[3rem] border-dashed border-2 border-white/5 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-parchment/20">
                      <Sparkles size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-serif text-parchment/40">Nenhuma sugestão pendente</p>
                      <p className="text-sm text-parchment/20">Novas sugestões de jogadores aparecerão aqui.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* NPC Generator Modal */}
      <AnimatePresence>
        {editingSuggestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSuggestion(null)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setEditingSuggestion(null)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className={cn(
                  "p-3 rounded-2xl",
                  editingSuggestion.type === 'skill' ? "bg-arcane/20 text-arcane" : "bg-ember/20 text-ember"
                )}>
                  <Edit2 size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-serif">Editar Sugestão</h3>
                  <p className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Ajuste os detalhes antes de aprovar</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                    <input 
                      type="text" 
                      value={editingSuggestion.data.name}
                      onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, name: e.target.value}})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo</label>
                    <select 
                      value={editingSuggestion.data.type}
                      onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, type: e.target.value}})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors appearance-none"
                    >
                      {editingSuggestion.type === 'skill' ? (
                        <>
                          <option value="Luta">Luta</option>
                          <option value="Mística">Mística</option>
                          <option value="Geral">Geral</option>
                          <option value="Conhecimento">Conhecimento</option>
                          <option value="Artes">Artes</option>
                          <option value="Treinamento">Treinamento</option>
                          <option value="Ocultismo">Ocultismo</option>
                          <option value="Empírico">Empírico</option>
                        </>
                      ) : (
                        <>
                          <option value="Físico">Físico</option>
                          <option value="Elemental">Elemental</option>
                          <option value="Defesa">Defesa</option>
                          <option value="Buff">Buff</option>
                          <option value="Debuff">Debuff</option>
                          <option value="Geral">Geral</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Compra (XP/Pontos)</label>
                    <input 
                      type="number" 
                      value={editingSuggestion.data.purchaseCost}
                      onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, purchaseCost: parseInt(e.target.value) || 0}})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  {editingSuggestion.type === 'skill' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo ATP</label>
                        <input 
                          type="number" 
                          value={editingSuggestion.data.atpCost || 0}
                          onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, atpCost: parseInt(e.target.value) || 0}})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                        <input 
                          type="text" 
                          value={editingSuggestion.data.damage || ''}
                          onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, damage: e.target.value}})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Uso</label>
                        <input 
                          type="text" 
                          value={editingSuggestion.data.cost || ''}
                          onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, cost: e.target.value}})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Efeito</label>
                        <input 
                          type="text" 
                          value={editingSuggestion.data.effect || ''}
                          onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, effect: e.target.value}})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                  <textarea 
                    value={editingSuggestion.data.description}
                    onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, description: e.target.value}})}
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setEditingSuggestion(null)}
                    className="flex-1 py-4 glass rounded-2xl font-bold hover:bg-white/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => handleApproveSuggestion(editingSuggestion)}
                    className="flex-1 py-4 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-arcane/20"
                  >
                    Salvar & Aprovar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* NPC Generator Modal */}
      <AnimatePresence>
        {isGeneratingNPC && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGeneratingNPC(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setIsGeneratingNPC(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-arcane/20 rounded-2xl text-arcane">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-2xl font-serif">Gerador de NPC</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Arquétipo do NPC</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'combat', label: 'Combate', icon: Sword },
                      { id: 'scholar', label: 'Estudioso', icon: Brain },
                      { id: 'common', label: 'Comum', icon: User },
                      { id: 'random', label: 'Aleatório', icon: Dice6 },
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setNpcConfig(prev => ({ ...prev, archetype: type.id as any }))}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                          npcConfig.archetype === type.id 
                            ? "bg-arcane/20 border-arcane text-arcane" 
                            : "bg-white/5 border-white/10 text-parchment/40 hover:bg-white/10"
                        )}
                      >
                        <type.icon size={16} />
                        <span className="text-xs font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Atributo Mínimo</label>
                    <input 
                      type="number"
                      value={npcConfig.minAttrValue}
                      onChange={(e) => setNpcConfig(prev => ({ ...prev, minAttrValue: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Atributo Máximo</label>
                    <input 
                      type="number"
                      value={npcConfig.maxAttrValue}
                      onChange={(e) => setNpcConfig(prev => ({ ...prev, maxAttrValue: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos de Perícia</label>
                    <input 
                      type="number"
                      value={npcConfig.skillPoints}
                      onChange={(e) => setNpcConfig(prev => ({ ...prev, skillPoints: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos de Poder</label>
                    <input 
                      type="number"
                      value={npcConfig.powerPoints}
                      onChange={(e) => setNpcConfig(prev => ({ ...prev, powerPoints: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleGenerateNPC}
                  className="w-full py-4 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-arcane/20 flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} />
                  Criar NPC Agora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        <AnimatePresence>
          {managingCharacter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass w-full max-w-lg p-8 rounded-[3rem] border border-white/10 relative"
              >
                <button 
                  onClick={() => setManagingCharacter(null)}
                  className="absolute top-6 right-6 p-2 glass rounded-xl hover:bg-white/10 transition-colors text-parchment/40 hover:text-parchment"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-arcane/30">
                    <img 
                      src={managingCharacter.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${managingCharacter.name}`} 
                      alt={managingCharacter.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif">{managingCharacter.name}</h3>
                    <p className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Nível {managingCharacter.level} • {managingCharacter.class}</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Level Up Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-lg flex items-center gap-2">
                        <ArrowUpDown size={18} className="text-arcane" />
                        Alterar Nível
                      </h4>
                      <span className="text-sm font-mono text-parchment/40">Atual: {managingCharacter.level}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={pointsToAdd.level}
                          onChange={(e) => setPointsToAdd(prev => ({ ...prev, level: Number(e.target.value) }))}
                          className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-arcane/50"
                          placeholder="Qtd"
                        />
                        <button 
                          onClick={() => handleLevelUp(managingCharacter, pointsToAdd.level)}
                          className="flex-1 py-4 bg-arcane text-obsidian rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-arcane/20"
                        >
                          <Sparkles size={18} />
                          Adicionar {pointsToAdd.level} Nível(is)
                        </button>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'characters', managingCharacter.id), {
                              level: pointsToAdd.level
                            });
                            setManagingCharacter({ ...managingCharacter, level: pointsToAdd.level });
                          } catch (err) {
                            console.error('Error setting level:', err);
                            handleFirestoreError(err, OperationType.UPDATE, `characters/${managingCharacter.id}`);
                          }
                        }}
                        className="w-full py-2 glass rounded-xl text-[10px] font-mono uppercase tracking-widest text-parchment/40 hover:text-parchment hover:bg-white/5 transition-all"
                      >
                        Definir Nível para {pointsToAdd.level}
                      </button>
                    </div>
                  </div>

                  {/* Points Section */}
                  <div className="space-y-6">
                    <h4 className="font-serif text-lg flex items-center gap-2">
                      <Plus size={18} className="text-gold" />
                      Adicionar Pontos
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Attribute Points */}
                      <div className="glass p-4 rounded-2xl border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Atributos</span>
                          <span className="text-xs font-bold text-ember">{(managingCharacter as any).attributePoints || 0} Atuais</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={pointsToAdd.attributes}
                            onChange={(e) => setPointsToAdd(prev => ({ ...prev, attributes: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ember/50"
                          />
                          <button 
                            onClick={() => handleAddPoints(managingCharacter, 'attributes')}
                            className="p-2 bg-ember text-obsidian rounded-xl hover:scale-105 transition-all"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Skill Points */}
                      <div className="glass p-4 rounded-2xl border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Perícias</span>
                          <span className="text-xs font-bold text-arcane">{managingCharacter.skillPoints || 0} Atuais</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={pointsToAdd.skills}
                            onChange={(e) => setPointsToAdd(prev => ({ ...prev, skills: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-arcane/50"
                          />
                          <button 
                            onClick={() => handleAddPoints(managingCharacter, 'skills')}
                            className="p-2 bg-arcane text-obsidian rounded-xl hover:scale-105 transition-all"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Power Points */}
                      <div className="glass p-4 rounded-2xl border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Poderes</span>
                          <span className="text-xs font-bold text-gold">{managingCharacter.powerPoints || 0} Atuais</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={pointsToAdd.powers}
                            onChange={(e) => setPointsToAdd(prev => ({ ...prev, powers: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold/50"
                          />
                          <button 
                            onClick={() => handleAddPoints(managingCharacter, 'powers')}
                            className="p-2 bg-gold text-obsidian rounded-xl hover:scale-105 transition-all"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-white/10">
                  <button 
                    onClick={() => setManagingCharacter(null)}
                    className="w-full py-3 glass rounded-2xl text-parchment/60 hover:text-parchment hover:bg-white/5 transition-all text-sm font-medium"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-obsidian/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-[2.5rem] w-full max-w-md border border-red-500/20 space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={40} className="text-red-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-serif">Excluir {deleteConfirm.type === 'character' ? 'Personagem' : 'Campanha'}?</h3>
                <p className="text-parchment/60">
                  Tem certeza que deseja excluir <span className="text-white font-bold">"{deleteConfirm.name}"</span>? 
                  Esta ação não pode ser desfeita.
                </p>
                {deleteConfirm.type === 'session' && (
                  <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest mt-4">
                    Nota: Talentos, perícias e configurações globais serão preservados.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="py-4 glass rounded-2xl font-bold hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (deleteConfirm.type === 'character') {
                      handleDeleteCharacter(deleteConfirm.id);
                    } else {
                      handleDeleteSession();
                    }
                  }}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronRight({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
