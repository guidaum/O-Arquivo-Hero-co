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
  Check,
  Star,
  Info,
  Search,
  Target,
  UserPlus,
  RefreshCw,
  Backpack,
  Package,
  Settings,
  ShoppingCart,
  ShoppingBag,
  HeartCrack,
  Play,
  Image as ImageIcon,
  Feather,
  Music,
  Volume2
} from 'lucide-react';
import { ImagePickerModal } from './ImagePickerModal';
import QuickNotes from './QuickNotes';
import SoundEffectManager from './SoundEffectManager';
import { SoundConfig, DEFAULT_SOUNDS } from '../lib/soundEngine';
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
  getDocs,
  OperationType, 
  handleFirestoreError 
} from '../firebase';
import { cn, evaluateFormula, rollDiceFormula, resolveStatsWithVars, playAudio } from '../lib/utils';
import SessionJournal from './SessionJournal';
import SessionChat from './SessionChat';

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
  diffEasyMod?: number;
  diffHardDiv?: number;
  diffExtremeDiv?: number;
  initialMoney?: number;
  attributes?: { id: string; label: string; icon: string; color: string }[];
  shopEnabled?: boolean;
  shopItemIds?: string[];
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
  ownerId?: string;
  traits?: string[];
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
  category?: string;
}

interface Skill {
  id: string;
  name: string;
  type: string;
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
  type: string;
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
  type: 'skill' | 'power' | 'trait';
  data: any;
  suggestedBy: string;
  suggestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface Trait {
  id: string;
  name: string;
  description: string;
  effect: string;
  modifier: number;
  modifierType: string;
  type: 'advantage' | 'disadvantage';
  createdAt: string;
}

const DEFAULT_ATTRIBUTES = [
  { id: 'for', label: 'Força', icon: 'Sword', color: 'text-ember' },
  { id: 'con', label: 'Constituição', icon: 'Shield', color: 'text-ember' },
  { id: 'agi', label: 'Agilidade', icon: 'Zap', color: 'text-arcane' },
  { id: 'per', label: 'Percepção', icon: 'Eye', color: 'text-gold' },
  { id: 'vel', label: 'Velocidade', icon: 'Zap', color: 'text-arcane' },
  { id: 'ini', label: 'Iniciativa', icon: 'Zap', color: 'text-gold' },
  { id: 'int', label: 'Inteligência', icon: 'Brain', color: 'text-arcane' },
  { id: 'cor', label: 'Coragem', icon: 'Heart', color: 'text-ember' },
];

// Helper to get icon component from name
const getIcon = (name: string) => {
  const icons: Record<string, any> = {
    Sword, Shield, Zap, Eye, Brain, Heart, Users, Dice6, Activity, Scroll, Plus, History, Sparkles, Save, Trash2, Edit2, Flame, Star, Info, Target, Search, Filter, X, UserPlus
  };
  return icons[name] || Shield;
};

export default function GMDashboard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [session, setSession] = React.useState<GameSession | null>(null);
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [attributes, setAttributes] = React.useState(DEFAULT_ATTRIBUTES);
  const [talents, setTalents] = React.useState<Talent[]>([]);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [powers, setPowers] = React.useState<Power[]>([]);
  const [traits, setTraits] = React.useState<Trait[]>([]);
  const [itemCatalog, setItemCatalog] = React.useState<any[]>([]);
  const [baseSettings, setBaseSettings] = React.useState<any>(null);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [editingSuggestion, setEditingSuggestion] = React.useState<Suggestion | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'characters' | 'journal' | 'notes' | 'settings' | 'talents' | 'skills' | 'powers' | 'suggestions' | 'traits' | 'vars' | 'categories' | 'catalog' | 'baseSettings' | 'sounds'>('characters');
  const [showConfigMenu, setShowConfigMenu] = React.useState(false);
  const configMenuRef = React.useRef<HTMLDivElement>(null);
  const [gmNotes, setGmNotes] = React.useState('');
  const [isGmQuickNotesOpen, setIsGmQuickNotesOpen] = React.useState(false);

  React.useEffect(() => {
    if (sessionId) {
      localStorage.setItem('last_active_session_id', sessionId);
    }
  }, [sessionId]);
  const [maxAttributePoints, setMaxAttributePoints] = React.useState(120);
  const [maxSingleAttributeValue, setMaxSingleAttributeValue] = React.useState(100);
  const [initialSkillPoints, setInitialSkillPoints] = React.useState(0);
  const [initialPowerPoints, setInitialPowerPoints] = React.useState(0);
  const [attrPointsPerLevel, setAttrPointsPerLevel] = React.useState(10);
  const [skillPointsPerLevel, setSkillPointsPerLevel] = React.useState(5);
  const [powerPointsPerLevel, setPowerPointsPerLevel] = React.useState(2);
  const [npcDefaultMinAttr, setNpcDefaultMinAttr] = React.useState(0);
  const [npcDefaultMaxAttr, setNpcDefaultMaxAttr] = React.useState(100);
  const [npcDefaultAttrPoints, setNpcDefaultAttrPoints] = React.useState(120);
  const [npcDefaultSkillPoints, setNpcDefaultSkillPoints] = React.useState(10);
  const [npcDefaultPowerPoints, setNpcDefaultPowerPoints] = React.useState(5);
  const [initialMoney, setInitialMoney] = React.useState(500);
  
  const [diceRollSound, setDiceRollSound] = React.useState('https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3');
  const [successSound, setSuccessSound] = React.useState('https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3');
  const [failureSound, setFailureSound] = React.useState('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
  const [criticalSound, setCriticalSound] = React.useState('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
  const [fumbleSound, setFumbleSound] = React.useState('https://assets.mixkit.co/active_storage/sfx/2550/2550-preview.mp3');

  const [pvFormula, setPvFormula] = React.useState('((FOR / 2) + CON) * 10');
  const [atpFormula, setAtpFormula] = React.useState('(INT + 3) * 3');
  const [socoFormula, setSocoFormula] = React.useState('FOR');
  const [chuteFormula, setChuteFormula] = React.useState('FOR + (FOR / 2)');
  const [defesaFormula, setDefesaFormula] = React.useState('CON + (AGI / 2) + (LUTA * 2)');
  const [esquivaFormula, setEsquivaFormula] = React.useState('(CON + AGI + (VEL / 2)) + (LUTA * 2)');
  const [enFormula, setEnFormula] = React.useState('20 - ((AGI + (PER / 2)) + (LUTA * 2))');
  const [dmFormula, setDmFormula] = React.useState('20 - ((AGI + (PER / 2)) + (MISTICA * 2))');
  const [skillCostFormula, setSkillCostFormula] = React.useState('(COST * LVL) / VAR');
  const [powerCostFormula, setPowerCostFormula] = React.useState('(COST * LVL)');
  const [calculationVars, setCalculationVars] = React.useState<Record<string, string>>({});
  const [showNewVarInput, setShowNewVarInput] = React.useState(false);
  const [newVarName, setNewVarName] = React.useState('');
  const [talentCategories, setTalentCategories] = React.useState<string[]>([]);
  const [showNewTalentCatInput, setShowNewTalentCatInput] = React.useState(false);
  const [newTalentCatName, setNewTalentCatName] = React.useState('');
  const [showNewPowerTypeInput, setShowNewPowerTypeInput] = React.useState(false);
  const [newPowerTypeName, setNewPowerTypeName] = React.useState('');
  const [showNewSkillTypeInput, setShowNewSkillTypeInput] = React.useState(false);
  const [newSkillTypeName, setNewSkillTypeName] = React.useState('');
  const [showNewAttrInput, setShowNewAttrInput] = React.useState(false);
  const [newAttr, setNewAttr] = React.useState({ label: '', icon: 'Shield', color: 'text-arcane' });
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
  const [diffEasyMod, setDiffEasyMod] = React.useState(2);
  const [diffHardDiv, setDiffHardDiv] = React.useState(2);
  const [diffExtremeDiv, setDiffExtremeDiv] = React.useState(5);
  const [shopEnabled, setShopEnabled] = React.useState(true);
  const [enableEmailPasswordAuth, setEnableEmailPasswordAuth] = React.useState(false);
  const [shopItemIds, setShopItemIds] = React.useState<string[]>([]);
  const [sessionName, setSessionName] = React.useState('');
  const [sessionImage, setSessionImage] = React.useState('');
  const [isSessionImagePickerOpen, setIsSessionImagePickerOpen] = React.useState(false);
  const [isCatalogImagePickerOpen, setIsCatalogImagePickerOpen] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [editingSkillType, setEditingSkillType] = React.useState<string | null>(null);
  const [editingSkillTypeName, setEditingSkillTypeName] = React.useState('');
  const [editingPowerType, setEditingPowerType] = React.useState<string | null>(null);
  const [editingPowerTypeName, setEditingPowerTypeName] = React.useState('');
  const [editingAttribute, setEditingAttribute] = React.useState<string | null>(null);
  const [editingAttributeName, setEditingAttributeName] = React.useState('');

  const [deleteConfirm, setDeleteConfirm] = React.useState<{ id: string, type: 'character' | 'session', name: string } | null>(null);

  // Player Management State
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [isInviting, setIsInviting] = React.useState(false);
  const [sessionPlayers, setSessionPlayers] = React.useState<{ id: string, name: string, email: string, image?: string }[]>([]);

  React.useEffect(() => {
    if (!session?.playerIds) {
      setSessionPlayers([]);
      return;
    }

    const fetchPlayers = async () => {
      try {
        const playerDetails = await Promise.all(
          session.playerIds.map(async (id) => {
            const userSnap = await getDoc(doc(db, 'users', id));
            if (userSnap.exists()) {
              const data = userSnap.data();
              return {
                id: userSnap.id,
                name: data.displayName || 'Jogador Misterioso',
                email: data.email || 'N/A',
                image: data.photoURL || ''
              };
            }
            return { id, name: 'Usuário Desconhecido', email: 'N/A' };
          })
        );
        setSessionPlayers(playerDetails);
      } catch (err) {
        console.error('Error fetching session players:', err);
      }
    };

    fetchPlayers();
  }, [session?.playerIds]);

  const handleInvitePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !sessionId || !session) return;

    setIsInviting(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', inviteEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setSaveStatus({ type: 'error', message: 'Usuário não encontrado com este e-mail.' });
        setIsInviting(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;

      if (session.playerIds?.includes(userId)) {
        setSaveStatus({ type: 'info', message: 'Este jogador já faz parte da sessão.' });
        setIsInviting(false);
        return;
      }

      const updatedPlayerIds = [...(session.playerIds || []), userId];
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        playerIds: updatedPlayerIds
      });

      setInviteEmail('');
      setSaveStatus({ type: 'success', message: 'Jogador convidado com sucesso!' });
      setIsInviting(false);
    } catch (err) {
      console.error('Error inviting player:', err);
      setSaveStatus({ type: 'error', message: 'Erro ao processar convite.' });
      setIsInviting(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!sessionId || !session || !window.confirm('Deseja remover este jogador da sessão?')) return;

    try {
      const updatedPlayerIds = session.playerIds.filter(id => id !== playerId);
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        playerIds: updatedPlayerIds
      });
      setSaveStatus({ type: 'success', message: 'Jogador removido com sucesso!' });
    } catch (err) {
      console.error('Error removing player:', err);
      setSaveStatus({ type: 'error', message: 'Erro ao remover jogador.' });
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'characters', id));
      setDeleteConfirm(null);
      setSaveStatus({ type: 'success', message: 'Personagem excluído com sucesso!' });
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Erro ao excluir personagem.' });
      handleFirestoreError(error, OperationType.DELETE, `characters/${id}`);
    }
  };
  const [filterClass, setFilterClass] = React.useState<string>('all');
  const [filterLevel, setFilterLevel] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [filterType, setFilterType] = React.useState<'all' | 'player' | 'npc'>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'level'>('name');
  const [userPresence, setUserPresence] = React.useState<Record<string, any>>({});

  // Character Management State
  const [managingCharacter, setManagingCharacter] = React.useState<Character | null>(null);
  const [pointsToAdd, setPointsToAdd] = React.useState({ skills: 5, powers: 2, attributes: 10, level: 1 });

  const toggleShopItem = (itemId: string) => {
    setShopItemIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const applySettingsToUI = React.useCallback((data: any) => {
    if (!data) return;
    setMaxAttributePoints(data.maxAttributePoints ?? 120);
    setMaxSingleAttributeValue(data.maxSingleAttributeValue ?? 100);
    setInitialSkillPoints(data.initialSkillPoints ?? 0);
    setInitialPowerPoints(data.initialPowerPoints ?? 0);
    setAttributes(data.attributes || DEFAULT_ATTRIBUTES);
    setAttrPointsPerLevel(data.attrPointsPerLevel ?? 10);
    setSkillPointsPerLevel(data.skillPointsPerLevel ?? 5);
    setPowerPointsPerLevel(data.powerPointsPerLevel ?? 2);
    setNpcDefaultMinAttr(data.npcDefaultMinAttr ?? 0);
    setNpcDefaultMaxAttr(data.npcDefaultMaxAttr ?? 100);
    setNpcDefaultAttrPoints(data.npcDefaultAttrPoints ?? 120);
    setNpcDefaultSkillPoints(data.npcDefaultSkillPoints ?? 10);
    setNpcDefaultPowerPoints(data.npcDefaultPowerPoints ?? 5);
    setInitialMoney(data.initialMoney ?? 500);
    setPvFormula(data.pvFormula || '((FOR / 2) + CON) * 10');
    setAtpFormula(data.atpFormula || '(INT + 3) * 3');
    setSocoFormula(data.socoFormula || 'FOR');
    setChuteFormula(data.chuteFormula || 'FOR + (FOR / 2)');
    setDefesaFormula(data.defesaFormula || 'CON + (AGI / 2) + (LUTA * 2)');
    setEsquivaFormula(data.esquivaFormula || '(CON + AGI + (VEL / 2)) + (LUTA * 2)');
    setEnFormula(data.enFormula || '20 - ((AGI + (PER / 2)) + (LUTA * 2))');
    setDmFormula(data.dmFormula || '20 - ((AGI + (PER / 2)) + (MISTICA * 2))');
    setSkillCostFormula(data.skillCostFormula || '(COST * LVL) / VAR');
    setPowerCostFormula(data.powerCostFormula === '(COST * LVL) / VAR' ? '(COST * LVL)' : (data.powerCostFormula || '(COST * LVL)'));
    setCalculationVars(data.calculationVars || {});
    setTalentCategories(data.talentCategories || []);
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
    setDiffEasyMod(data.diffEasyMod ?? 2);
    setDiffHardDiv(data.diffHardDiv ?? 2);
    setDiffExtremeDiv(data.diffExtremeDiv ?? 5);
    setShopEnabled(data.shopEnabled ?? true);
    setEnableEmailPasswordAuth(data.enableEmailPasswordAuth ?? false);
    setShopItemIds(data.shopItemIds || []);
    
    setDiceRollSound(data.diceRollSound || 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3');
    setSuccessSound(data.successSound || 'https://assets.mixkit.co/active_storage/sfx/1113/1113-preview.mp3');
    setFailureSound(data.failureSound || 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    setCriticalSound(data.criticalSound || 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    setFumbleSound(data.fumbleSound || 'https://assets.mixkit.co/active_storage/sfx/2550/2550-preview.mp3');
  }, []);

  React.useEffect(() => {
    if (activeTab === 'baseSettings' && baseSettings) {
      applySettingsToUI(baseSettings);
    } else if (session) {
      // If session has its own settings, use them. Otherwise fallback to baseSettings.
      if (session.maxAttributePoints !== undefined) {
        applySettingsToUI(session);
      } else if (baseSettings) {
        applySettingsToUI(baseSettings);
      }
    }
  }, [activeTab, baseSettings, session, applySettingsToUI]);

  // NPC Generator State
  const [isGeneratingNPC, setIsGeneratingNPC] = React.useState(false);
  const [npcConfig, setNpcConfig] = React.useState({
    level: 1,
    skillPoints: 10,
    powerPoints: 5,
    attributePoints: 120,
    traitCount: 0,
    minAttrValue: 0,
    maxAttrValue: 100,
    archetype: 'random' as 'combat' | 'scholar' | 'common' | 'random',
    useSessionDefaults: true
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
      const level = npcConfig.level || 1;
      const archetype = npcConfig.archetype === 'random' 
        ? (['combat', 'scholar', 'common'][Math.floor(Math.random() * 3)] as any)
        : npcConfig.archetype;

      // Distribute Attributes
      const stats: Record<string, number> = {};
      const minVal = npcConfig.useSessionDefaults ? npcDefaultMinAttr : (npcConfig.minAttrValue || 0);
      const maxVal = npcConfig.useSessionDefaults ? npcDefaultMaxAttr : Math.min(npcConfig.maxAttrValue || 100, session.maxSingleAttributeValue || 100);
      
      attributes.forEach(attr => stats[attr.id] = minVal);
      
      const baseAttrPoints = npcConfig.useSessionDefaults ? npcDefaultAttrPoints : npcConfig.attributePoints;
      const levelBonusAttr = (attrPointsPerLevel || 0) * (level - 1);
      let totalPool = baseAttrPoints + levelBonusAttr;
      
      // Ensure we don't exceed the total possible (all attributes at maxVal)
      totalPool = Math.min(totalPool, maxVal * attributes.length);
      
      let remainingAttrPoints = totalPool - (minVal * attributes.length);
      if (remainingAttrPoints < 0) remainingAttrPoints = 0;

      const priorities: Record<string, string[]> = {
        combat: ['for', 'con', 'agi', 'ini', 'vel'],
        scholar: ['int', 'per', 'cor', 'ini'],
        common: attributes.map(a => a.id)
      };

      const currentPriorities = priorities[archetype] || priorities.common;

      // Stochastic weighted distribution for true randomness
      const weights: Record<string, number> = {};
      attributes.forEach(attr => {
        // Random base weight between 1 and 10
        let weight = Math.floor(Math.random() * 10) + 1;
        // Significant boost for priority attributes
        if (currentPriorities.includes(attr.id)) {
          weight *= (Math.random() * 3 + 2); // 2x to 5x boost
        }
        weights[attr.id] = weight;
      });

      // Distribute points in chunks using weighted selection
      let iterations = 0;
      const maxIterations = 5000; // High limit to ensure all points are spent
      
      while (remainingAttrPoints > 0 && iterations < maxIterations) {
        iterations++;
        
        // Filter attributes that can still receive points
        const available = attributes.filter(a => stats[a.id] < maxVal);
        if (available.length === 0) break;

        // Calculate total weight of available attributes
        const currentTotalWeight = available.reduce((sum, a) => sum + weights[a.id], 0);
        
        // Pick one attribute based on weights
        let random = Math.random() * currentTotalWeight;
        let selectedAttr = available[0];
        
        for (const attr of available) {
          random -= weights[attr.id];
          if (random <= 0) {
            selectedAttr = attr;
            break;
          }
        }

        // Add a random chunk (1 to 10% of maxVal, or at least 1)
        const maxChunk = Math.max(1, Math.floor(maxVal * 0.1));
        const add = Math.min(remainingAttrPoints, maxVal - stats[selectedAttr.id], Math.floor(Math.random() * maxChunk) + 1);
        
        if (add > 0) {
          stats[selectedAttr.id] += add;
          remainingAttrPoints -= add;
        }
      }

      // Pick Skills
      const selectedSkills: string[] = [];
      const baseSkillPoints = npcConfig.useSessionDefaults ? npcDefaultSkillPoints : npcConfig.skillPoints;
      const levelBonusSkills = (skillPointsPerLevel || 0) * (level - 1);
      let remainingSkillPoints = baseSkillPoints + levelBonusSkills;
      const availableSkillsForNPC = [...skills].sort(() => Math.random() - 0.5);

      for (const skill of availableSkillsForNPC) {
        if (remainingSkillPoints >= skill.purchaseCost) {
          selectedSkills.push(skill.id);
          remainingSkillPoints -= skill.purchaseCost;
        }
      }

      // Pick Powers
      const selectedPowers: string[] = [];
      const basePowerPoints = npcConfig.useSessionDefaults ? npcDefaultPowerPoints : npcConfig.powerPoints;
      const levelBonusPowers = (powerPointsPerLevel || 0) * (level - 1);
      let remainingPowerPoints = basePowerPoints + levelBonusPowers;
      const availablePowersForNPC = [...powers].sort(() => Math.random() - 0.5);

      for (const power of availablePowersForNPC) {
        if (remainingPowerPoints >= power.purchaseCost) {
          selectedPowers.push(power.id);
          remainingPowerPoints -= power.purchaseCost;
        }
      }

      // Pick Traits
      const selectedTraits: string[] = [];
      if (npcConfig.traitCount > 0) {
        const availableTraitsForNPC = [...traits].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(npcConfig.traitCount, availableTraitsForNPC.length); i++) {
          selectedTraits.push(availableTraitsForNPC[i].id);
        }
      }

      const npcSkills = skills.filter(s => selectedSkills.includes(s.id));
      
      const baseStatsForFormula: Record<string, number> = {};
      attributes.forEach(attr => {
        baseStatsForFormula[attr.id.toUpperCase()] = stats[attr.id] || 0;
      });
      
      Object.keys(skillTypeVars).forEach(cat => {
        const normalizedCat = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const count = npcSkills.filter(s => s.type === cat).length;
        baseStatsForFormula[normalizedCat] = count;
        if (!normalizedCat.endsWith('S')) {
          baseStatsForFormula[normalizedCat + 'S'] = count;
        } else {
          baseStatsForFormula[normalizedCat.slice(0, -1)] = count;
        }
      });

      baseStatsForFormula['SKILLS'] = npcSkills.length;
      baseStatsForFormula['POWERS'] = selectedPowers.length;

      const statsForFormula = resolveStatsWithVars(baseStatsForFormula, calculationVars);

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
        traits: selectedTraits,
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
      setSaveStatus({ type: 'success', message: `NPC ${name} gerado com sucesso!` });
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
    composition: [] as string[],
    category: ''
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

  // Trait Form State
  const [isCreatingTrait, setIsCreatingTrait] = React.useState(false);
  const [editingTraitId, setEditingTraitId] = React.useState<string | null>(null);
  const [newTrait, setNewTrait] = React.useState({
    name: '',
    description: '',
    effect: '',
    modifier: 0,
    modifierType: 'for',
    type: 'advantage' as 'advantage' | 'disadvantage'
  });

  // Catalog Form State
  const [isEditingCatalog, setIsEditingCatalog] = React.useState(false);
  const [editingCatalogId, setEditingCatalogId] = React.useState<string | null>(null);
  const [catalogItemForm, setCatalogItemForm] = React.useState({
    name: '',
    category: 'Geral',
    rarity: 'Common',
    weight: 0,
    value: 0,
    isStartingItem: false,
    description: '',
    image: '',
    stats: {} as Record<string, number>,
    damage: '',
    defense: 0,
    relatedWeapons: [] as string[]
  });

  const [isRolling, setIsRolling] = React.useState(false);
  const [quickRoll, setQuickRoll] = React.useState<{ 
    result: number, 
    success: boolean, 
    name: string, 
    attr: string,
    isCritical?: boolean,
    isFumble?: boolean
  } | null>(null);
  const rollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const rollingAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const sendRollToChat = async (label: string, result: any, charName?: string, charImage?: string, success?: boolean) => {
    if (!sessionId || !auth.currentUser) return;

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
        sessionId,
        senderId: auth.currentUser.uid,
        senderName: charName || auth.currentUser.displayName || 'Mestre',
        senderPhoto: charImage || auth.currentUser.photoURL || '',
        text: `Rolou ${label}: ${result.total}`,
        type: 'roll',
        rollData,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending roll to chat:', err);
    }
  };

  const handleQuickRoll = (name: string, attrLabel: string, attrValue: number) => {
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
      rollingAudioRef.current = null;
    }

    // Play rolling sound (shortened)
    rollingAudioRef.current = playAudio(diceRollSound, 0.4);

    setIsRolling(true);
    setQuickRoll(null);
    
    // Simulate rolling delay
    setTimeout(() => {
      // Stop rolling sound
      if (rollingAudioRef.current) {
        rollingAudioRef.current.pause();
        rollingAudioRef.current = null;
      }

      const result = rollDiceFormula('1D10', {});
    const naturalRoll = result.rolls[0]?.values[0] || 0;
    const isCritical = naturalRoll === 1;
    const isFumble = naturalRoll === 10;
    const success = naturalRoll <= attrValue;
    
    // Pre-initialize success/fail sounds
    const criticalAudio = new Audio(criticalSound);
    const fumbleAudio = new Audio(fumbleSound);
    const successAudio = new Audio(successSound);
    const failureAudio = new Audio(failureSound);
    
    setQuickRoll({ 
        result: naturalRoll, 
        success, 
        name, 
        attr: attrLabel,
        isCritical,
        isFumble
      });
      setIsRolling(false);
      
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
      
      sendRollToChat(`${name} - ${attrLabel}`, result, undefined, undefined, success);
      
      // Auto close after 5 seconds
      rollTimeoutRef.current = setTimeout(() => setQuickRoll(null), 5000);
    }, 800);
  };

  const isOnline = (uid?: string) => {
    if (!uid) return false;
    const lastActive = userPresence[uid];
    if (!lastActive) return false;
    const now = Date.now();
    const activeTime = lastActive.toMillis ? lastActive.toMillis() : new Date(lastActive).getTime();
    return (now - activeTime) < 300000; // 5 minutes
  };

  const filteredAndSortedCharacters = React.useMemo(() => {
    return characters
      .filter(char => {
        const matchesClass = filterClass === 'all' || char.class === filterClass;
        const matchesLevel = filterLevel === 'all' || char.level.toString() === filterLevel;
        const matchesType = filterType === 'all' || (filterType === 'npc' ? char.isNPC : !char.isNPC);
        
        const online = isOnline(char.ownerId);
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'online' ? online : !online);
        
        return matchesClass && matchesLevel && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return b.level - a.level;
        }
      });
  }, [characters, filterClass, filterLevel, filterStatus, filterType, sortBy, userPresence]);

  const uniqueClasses = React.useMemo(() => {
    const classes = new Set(characters.map(c => c.class));
    return Array.from(classes).sort();
  }, [characters]);

  const uniqueLevels = React.useMemo(() => {
    const levels = new Set(characters.map(c => c.level.toString()));
    return Array.from(levels).sort((a: string, b: string) => parseInt(a) - parseInt(b));
  }, [characters]);

  React.useEffect(() => {
    if (!sessionId || !user) return;

    const sessionRef = doc(db, 'gameSessions', sessionId);
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // SECURITY CHECK: Only the GM of this specific session or an admin can access this dashboard
        const isAdmin = user?.email === 'guilherme.higino@gmail.com' || (import.meta.env.VITE_ADMIN_EMAIL && user?.email === import.meta.env.VITE_ADMIN_EMAIL);
        if (data.gmId !== user?.uid && !isAdmin) {
          navigate('/');
          return;
        }
        setSession({ id: docSnap.id, ...data } as GameSession);
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
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBaseSettings(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'globalSettings/config');
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

    // Global Traits
    const traitsQuery = query(collection(db, 'traits'));
    const unsubscribeTraits = onSnapshot(traitsQuery, (snapshot) => {
      const traitData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trait[];
      setTraits(traitData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'traits');
    });

    // Item Catalog
    const catalogQuery = query(collection(db, 'itemCatalog'));
    const unsubscribeCatalog = onSnapshot(catalogQuery, (snapshot) => {
      const catalogData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItemCatalog(catalogData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'itemCatalog');
    });

    return () => {
      unsubscribeSession();
      unsubscribeSettings();
      unsubscribeCharacters();
      unsubscribeTalents();
      unsubscribeSkills();
      unsubscribePowers();
      unsubscribeSuggestions();
      unsubscribeTraits();
      unsubscribeCatalog();
    };
  }, [sessionId, user?.uid]);

  React.useEffect(() => {
    if (!sessionId || !session?.playerIds || session.playerIds.length === 0) return;

    const unsubs: (() => void)[] = [];

    // Track GM presence too
    if (session.gmId) {
      const unsubGM = onSnapshot(doc(db, 'users', session.gmId), (docSnap) => {
        if (docSnap.exists()) {
          setUserPresence(prev => ({
            ...prev,
            [session.gmId]: docSnap.data()?.lastActive
          }));
        }
      });
      unsubs.push(unsubGM);
    }

    // Track all players presence
    session.playerIds.forEach(id => {
      const unsub = onSnapshot(doc(db, 'users', id), (docSnap) => {
        if (docSnap.exists()) {
          setUserPresence(prev => ({
            ...prev,
            [id]: docSnap.data()?.lastActive
          }));
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [sessionId, session?.playerIds, session?.gmId]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target as Node)) {
        setShowConfigMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [configMenuRef]);

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSaveNotes = async () => {
    if (!sessionId) return;
    try {
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        gmNotes: gmNotes
      });
      setSaveStatus({ type: 'success', message: 'Notas do mestre salvas!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar notas.' });
      console.error('Error saving GM notes:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!sessionId) return;
    try {
      // Save session-specific info and settings
      await updateDoc(doc(db, 'gameSessions', sessionId), {
        name: sessionName,
        image: sessionImage,
        maxAttributePoints: Number(maxAttributePoints),
        maxSingleAttributeValue: Number(maxSingleAttributeValue),
        initialSkillPoints: Number(initialSkillPoints),
        initialPowerPoints: Number(initialPowerPoints),
        attrPointsPerLevel: Number(attrPointsPerLevel),
        skillPointsPerLevel: Number(skillPointsPerLevel),
        powerPointsPerLevel: Number(powerPointsPerLevel),
        npcDefaultMinAttr: Number(npcDefaultMinAttr),
        npcDefaultMaxAttr: Number(npcDefaultMaxAttr),
        npcDefaultAttrPoints: Number(npcDefaultAttrPoints),
        npcDefaultSkillPoints: Number(npcDefaultSkillPoints),
        npcDefaultPowerPoints: Number(npcDefaultPowerPoints),
        initialMoney: Number(initialMoney),
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
        calculationVars,
        talentCategories,
        attributes,
        skillTypeVars,
        powerTypeVars,
        diffEasyMod: Number(diffEasyMod),
        diffHardDiv: Number(diffHardDiv),
        diffExtremeDiv: Number(diffExtremeDiv),
        shopEnabled,
        shopItemIds,
        diceRollSound,
        successSound,
        failureSound,
        criticalSound,
        fumbleSound,
        updatedAt: new Date().toISOString()
      });

      setSaveStatus({ type: 'success', message: 'Configurações da sessão salvas!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar configurações.' });
      console.error('Error saving settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, `gameSessions/${sessionId}`);
    }
  };

  const handleSaveBaseSettings = async () => {
    try {
      await setDoc(doc(db, 'globalSettings', 'config'), {
        maxAttributePoints: Number(maxAttributePoints),
        maxSingleAttributeValue: Number(maxSingleAttributeValue),
        initialSkillPoints: Number(initialSkillPoints),
        initialPowerPoints: Number(initialPowerPoints),
        attrPointsPerLevel: Number(attrPointsPerLevel),
        skillPointsPerLevel: Number(skillPointsPerLevel),
        powerPointsPerLevel: Number(powerPointsPerLevel),
        npcDefaultMinAttr: Number(npcDefaultMinAttr),
        npcDefaultMaxAttr: Number(npcDefaultMaxAttr),
        npcDefaultAttrPoints: Number(npcDefaultAttrPoints),
        npcDefaultSkillPoints: Number(npcDefaultSkillPoints),
        npcDefaultPowerPoints: Number(npcDefaultPowerPoints),
        initialMoney: Number(initialMoney),
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
        calculationVars,
        talentCategories,
        attributes,
        skillTypeVars,
        powerTypeVars,
        diffEasyMod: Number(diffEasyMod),
        diffHardDiv: Number(diffHardDiv),
        diffExtremeDiv: Number(diffExtremeDiv),
        enableEmailPasswordAuth,
        diceRollSound,
        successSound,
        failureSound,
        criticalSound,
        fumbleSound,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveStatus({ type: 'success', message: 'Configurações BASE salvas! (Válido para novas campanhas)' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar configurações base.' });
      console.error('Error saving base settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'globalSettings/config');
    }
  };

  const handleSaveSounds = async (soundConfig: SoundConfig, alsoSaveGlobal: boolean) => {
    try {
      if (sessionId) {
        await updateDoc(doc(db, 'gameSessions', sessionId), {
          diceRollSound: soundConfig.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
          successSound: soundConfig.successSound || DEFAULT_SOUNDS.successSound,
          failureSound: soundConfig.failureSound || DEFAULT_SOUNDS.failureSound,
          criticalSound: soundConfig.criticalSound || DEFAULT_SOUNDS.criticalSound,
          fumbleSound: soundConfig.fumbleSound || DEFAULT_SOUNDS.fumbleSound,
          updatedAt: new Date().toISOString()
        });
        localStorage.setItem('last_active_session_id', sessionId);
      }

      if (alsoSaveGlobal) {
        await setDoc(doc(db, 'globalSettings', 'config'), {
          diceRollSound: soundConfig.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
          successSound: soundConfig.successSound || DEFAULT_SOUNDS.successSound,
          failureSound: soundConfig.failureSound || DEFAULT_SOUNDS.failureSound,
          criticalSound: soundConfig.criticalSound || DEFAULT_SOUNDS.criticalSound,
          fumbleSound: soundConfig.fumbleSound || DEFAULT_SOUNDS.fumbleSound,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      setDiceRollSound(soundConfig.diceRollSound || DEFAULT_SOUNDS.diceRollSound);
      setSuccessSound(soundConfig.successSound || DEFAULT_SOUNDS.successSound);
      setFailureSound(soundConfig.failureSound || DEFAULT_SOUNDS.failureSound);
      setCriticalSound(soundConfig.criticalSound || DEFAULT_SOUNDS.criticalSound);
      setFumbleSound(soundConfig.fumbleSound || DEFAULT_SOUNDS.fumbleSound);
    } catch (err) {
      console.error('Error saving sounds:', err);
      handleFirestoreError(err, OperationType.UPDATE, `gameSessions/${sessionId || 'globalSettings'}`);
      throw err;
    }
  };

  const handleSaveGlobalSounds = async (soundConfig: SoundConfig) => {
    try {
      await setDoc(doc(db, 'globalSettings', 'config'), {
        diceRollSound: soundConfig.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
        successSound: soundConfig.successSound || DEFAULT_SOUNDS.successSound,
        failureSound: soundConfig.failureSound || DEFAULT_SOUNDS.failureSound,
        criticalSound: soundConfig.criticalSound || DEFAULT_SOUNDS.criticalSound,
        fumbleSound: soundConfig.fumbleSound || DEFAULT_SOUNDS.fumbleSound,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setDiceRollSound(soundConfig.diceRollSound || DEFAULT_SOUNDS.diceRollSound);
      setSuccessSound(soundConfig.successSound || DEFAULT_SOUNDS.successSound);
      setFailureSound(soundConfig.failureSound || DEFAULT_SOUNDS.failureSound);
      setCriticalSound(soundConfig.criticalSound || DEFAULT_SOUNDS.criticalSound);
      setFumbleSound(soundConfig.fumbleSound || DEFAULT_SOUNDS.fumbleSound);
    } catch (err) {
      console.error('Error saving global sounds:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'globalSettings/config');
      throw err;
    }
  };

  const handleRenameAttribute = (oldId: string, newLabel: string) => {
    const newId = newLabel.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 3);
    
    if (newId === oldId) {
      setEditingAttribute(null);
      return;
    }

    if (attributes.some(a => a.id === newId)) {
      setSaveStatus({ type: 'error', message: 'Um atributo com este ID já existe!' });
      return;
    }

    // Update attributes list
    const updatedAttributes = attributes.map(a => 
      a.id === oldId ? { ...a, id: newId, label: newLabel } : a
    );
    setAttributes(updatedAttributes);

    // Update formulas
    const oldUpper = oldId.toUpperCase();
    const newUpper = newId.toUpperCase();
    const replaceVar = (formula: string) => {
      if (!formula) return formula;
      const regex = new RegExp(`\\b${oldUpper}\\b`, 'g');
      return formula.replace(regex, newUpper);
    };

    setPvFormula(replaceVar(pvFormula));
    setAtpFormula(replaceVar(atpFormula));
    setSocoFormula(replaceVar(socoFormula));
    setChuteFormula(replaceVar(chuteFormula));
    setDefesaFormula(replaceVar(defesaFormula));
    setEsquivaFormula(replaceVar(esquivaFormula));
    setEnFormula(replaceVar(enFormula));
    setDmFormula(replaceVar(dmFormula));
    setSkillCostFormula(replaceVar(skillCostFormula));
    setPowerCostFormula(replaceVar(powerCostFormula));

    // Update skillTypeVars (formulas)
    const newSkillTypeVars = { ...skillTypeVars };
    Object.keys(newSkillTypeVars).forEach(key => {
      newSkillTypeVars[key] = replaceVar(newSkillTypeVars[key]);
    });
    setSkillTypeVars(newSkillTypeVars);

    // Update powerTypeVars (formulas)
    const newPowerTypeVars = { ...powerTypeVars };
    Object.keys(newPowerTypeVars).forEach(key => {
      newPowerTypeVars[key] = replaceVar(newPowerTypeVars[key]);
    });
    setPowerTypeVars(newPowerTypeVars);

    // Update calculationVars (formulas)
    const newCalcVars = { ...calculationVars };
    Object.keys(newCalcVars).forEach(key => {
      newCalcVars[key] = replaceVar(newCalcVars[key]);
    });
    setCalculationVars(newCalcVars);

    setEditingAttribute(null);
    setSaveStatus({ type: 'success', message: `Atributo renomeado e fórmulas atualizadas!` });
  };

  const handleSyncVariables = () => {
    // Identify all current base variables
    const currentBaseVars = new Set([
      ...attributes.map(a => a.id.toUpperCase()),
      ...Object.keys(skillTypeVars).map(cat => cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()),
      'SKILLS',
      'POWERS'
    ]);

    // Add plural/singular versions to the set
    const allBaseVars = new Set(currentBaseVars);
    currentBaseVars.forEach(v => {
      if (v.endsWith('S')) allBaseVars.add(v.slice(0, -1));
      else allBaseVars.add(v + 'S');
    });

    // 1. Remove from calculationVars any that conflict with base variables
    const newCalcVars = { ...calculationVars };
    let conflictsRemoved = 0;
    Object.keys(newCalcVars).forEach(key => {
      if (allBaseVars.has(key)) {
        delete newCalcVars[key];
        conflictsRemoved++;
      }
    });

    // 2. Scan formulas for missing variables
    const allFormulas = [
      pvFormula, atpFormula, socoFormula, chuteFormula, defesaFormula, esquivaFormula, enFormula, dmFormula,
      skillCostFormula, powerCostFormula,
      ...Object.values(skillTypeVars),
      ...Object.values(powerTypeVars),
      ...Object.values(calculationVars)
    ];

    const usedVars = new Set<string>();
    allFormulas.forEach(f => {
      if (!f) return;
      const matches = f.match(/[A-Z_][A-Z0-9_]*/g);
      if (matches) matches.forEach(m => usedVars.add(m));
    });

    // Math functions and numbers to ignore
    const ignore = new Set(['Math', 'min', 'max', 'floor', 'ceil', 'round', 'abs', 'PI', 'E']);
    
    let missingAdded = 0;
    usedVars.forEach(v => {
      if (!allBaseVars.has(v) && !newCalcVars[v] && !ignore.has(v) && isNaN(Number(v))) {
        newCalcVars[v] = '0';
        missingAdded++;
      }
    });

    setCalculationVars(newCalcVars);
    
    if (conflictsRemoved > 0 || missingAdded > 0) {
      setSaveStatus({ 
        type: 'success', 
        message: `Sincronização concluída: ${conflictsRemoved} conflitos removidos, ${missingAdded} variáveis ausentes adicionadas.` 
      });
    } else {
      setSaveStatus({ type: 'success', message: 'Todas as variáveis estão sincronizadas e válidas!' });
    }
  };

  const handleRenameSkillType = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingSkillType(null);
      return;
    }
    if (skillTypeVars[newName]) {
      setSaveStatus({ type: 'error', message: 'Esta categoria já existe!' });
      return;
    }

    const next = { ...skillTypeVars };
    const formula = next[oldName];
    delete next[oldName];
    next[newName] = formula;
    setSkillTypeVars(next);
    setEditingSkillType(null);

    // Update formulas
    const oldUpper = oldName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const newUpper = newName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    
    const replaceVar = (formula: string) => {
      if (!formula) return formula;
      // Replace both singular and plural forms
      const oldSingular = oldUpper.endsWith('S') ? oldUpper.slice(0, -1) : oldUpper;
      const oldPlural = oldUpper.endsWith('S') ? oldUpper : oldUpper + 'S';
      const newSingular = newUpper.endsWith('S') ? newUpper.slice(0, -1) : newUpper;
      const newPlural = newUpper.endsWith('S') ? newUpper : newUpper + 'S';

      let f = formula;
      f = f.replace(new RegExp(`\\b${oldPlural}\\b`, 'g'), newPlural);
      f = f.replace(new RegExp(`\\b${oldSingular}\\b`, 'g'), newSingular);
      return f;
    };

    setPvFormula(replaceVar(pvFormula));
    setAtpFormula(replaceVar(atpFormula));
    setSocoFormula(replaceVar(socoFormula));
    setChuteFormula(replaceVar(chuteFormula));
    setDefesaFormula(replaceVar(defesaFormula));
    setEsquivaFormula(replaceVar(esquivaFormula));
    setEnFormula(replaceVar(enFormula));
    setDmFormula(replaceVar(dmFormula));
    setSkillCostFormula(replaceVar(skillCostFormula));
    setPowerCostFormula(replaceVar(powerCostFormula));

    // Update skillTypeVars (formulas)
    const updatedSkillTypeVars = { ...next };
    Object.keys(updatedSkillTypeVars).forEach(key => {
      updatedSkillTypeVars[key] = replaceVar(updatedSkillTypeVars[key]);
    });
    setSkillTypeVars(updatedSkillTypeVars);

    // Update calculationVars (formulas)
    const newCalcVars = { ...calculationVars };
    Object.keys(newCalcVars).forEach(key => {
      newCalcVars[key] = replaceVar(newCalcVars[key]);
    });
    setCalculationVars(newCalcVars);

    // Update existing skills
    const skillsToUpdate = skills.filter(s => s.type === oldName);
    for (const skill of skillsToUpdate) {
      try {
        await updateDoc(doc(db, 'skills', skill.id), { type: newName });
      } catch (err) {
        console.error('Error updating skill type:', err);
      }
    }
  };

  const handleRenamePowerType = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingPowerType(null);
      return;
    }
    if (powerTypeVars[newName]) {
      setSaveStatus({ type: 'error', message: 'Este tipo já existe!' });
      return;
    }

    const next = { ...powerTypeVars };
    const formula = next[oldName];
    delete next[oldName];
    next[newName] = formula;
    setPowerTypeVars(next);
    setEditingPowerType(null);

    // Update formulas
    const oldUpper = oldName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const newUpper = newName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    
    const replaceVar = (formula: string) => {
      if (!formula) return formula;
      const regex = new RegExp(`\\b${oldUpper}\\b`, 'g');
      return formula.replace(regex, newUpper);
    };

    setSkillCostFormula(replaceVar(skillCostFormula));
    setPowerCostFormula(replaceVar(powerCostFormula));

    // Update powerTypeVars (formulas)
    const updatedPowerTypeVars = { ...next };
    Object.keys(updatedPowerTypeVars).forEach(key => {
      updatedPowerTypeVars[key] = replaceVar(updatedPowerTypeVars[key]);
    });
    setPowerTypeVars(updatedPowerTypeVars);

    // Update existing powers
    const powersToUpdate = powers.filter(p => p.type === oldName);
    for (const power of powersToUpdate) {
      try {
        await updateDoc(doc(db, 'powers', power.id), { type: newName });
      } catch (err) {
        console.error('Error updating power type:', err);
      }
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
      setNewTalent({ name: '', description: '', composition: [], category: '' });
      setIsCreatingTalent(false);
      setEditingTalentId(null);
      setSaveStatus({ type: 'success', message: editingTalentId ? 'Talento atualizado!' : 'Talento criado!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar talento.' });
      console.error('Error saving talent:', err);
      handleFirestoreError(err, editingTalentId ? OperationType.UPDATE : OperationType.CREATE, 'talents');
    }
  };

  const handleEditTalent = (talent: any) => {
    setNewTalent({
      name: talent.name,
      description: talent.description,
      composition: talent.composition,
      category: talent.category || ''
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
      setSaveStatus({ type: 'success', message: editingSkillId ? 'Perícia atualizada!' : 'Perícia criada!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar perícia.' });
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
      setSaveStatus({ type: 'success', message: editingPowerId ? 'Poder atualizado!' : 'Poder criado!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar poder.' });
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

  const handleCreateTrait = async () => {
    if (!user || !newTrait.name) return;
    try {
      const traitPayload = {
        ...newTrait,
        modifier: Number(newTrait.modifier) || 0
      };

      if (editingTraitId) {
        await updateDoc(doc(db, 'traits', editingTraitId), {
          ...traitPayload,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'traits'), {
          ...traitPayload,
          createdAt: new Date().toISOString()
        });
      }
      setNewTrait({ name: '', description: '', effect: '', modifier: 0, modifierType: 'for', type: 'advantage' });
      setIsCreatingTrait(false);
      setEditingTraitId(null);
      setSaveStatus({ type: 'success', message: editingTraitId ? 'Vantagem/Defeito atualizado!' : 'Vantagem/Defeito criado!' });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar vantagem/defeito.' });
      console.error('Error saving trait:', err);
      handleFirestoreError(err, editingTraitId ? OperationType.UPDATE : OperationType.CREATE, 'traits');
    }
  };

  const handleEditTrait = (trait: Trait) => {
    setNewTrait({
      name: trait.name,
      description: trait.description,
      effect: trait.effect,
      modifier: trait.modifier,
      modifierType: trait.modifierType,
      type: trait.type
    });
    setEditingTraitId(trait.id);
    setIsCreatingTrait(true);
  };

  const handleDeleteTrait = async (traitId: string) => {
    try {
      await deleteDoc(doc(db, 'traits', traitId));
    } catch (err) {
      console.error('Error deleting trait:', err);
      handleFirestoreError(err, OperationType.DELETE, `traits/${traitId}`);
    }
  };

  const handleEditCatalogItem = (item: any) => {
    setCatalogItemForm({
      name: item.name || '',
      category: item.category || 'Geral',
      rarity: item.rarity || 'Common',
      weight: item.weight || 0,
      value: item.value || 0,
      isStartingItem: item.isStartingItem || false,
      description: item.description || '',
      image: item.image || '',
      stats: item.stats || {},
      damage: item.damage || '',
      defense: item.defense || 0,
      relatedWeapons: item.relatedWeapons || []
    });
    setEditingCatalogId(item.id);
    setIsEditingCatalog(true);
  };

  const handleDuplicateCatalogItem = async (item: any) => {
    try {
      const newItem = {
        ...item,
        name: `${item.name} (Cópia)`,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        createdBy: 'Mestre'
      };
      delete newItem.id; // Correct way to handle id for addDoc
      
      await addDoc(collection(db, 'itemCatalog'), newItem);
      setSaveStatus({ type: 'success', message: 'Item duplicado com sucesso!' });
    } catch (err) {
      console.error('Error duplicating catalog item:', err);
      setSaveStatus({ type: 'error', message: 'Erro ao duplicar item.' });
    }
  };

  const handleSaveCatalogItem = async () => {
    try {
      if (editingCatalogId) {
        await updateDoc(doc(db, 'itemCatalog', editingCatalogId), {
          ...catalogItemForm,
          lastUpdated: new Date().toISOString()
        });
        setSaveStatus({ type: 'success', message: 'Item do catálogo atualizado!' });
      } else {
        await addDoc(collection(db, 'itemCatalog'), {
          ...catalogItemForm,
          createdBy: 'Mestre',
          createdAt: new Date().toISOString()
        });
        setSaveStatus({ type: 'success', message: 'Item criado no catálogo!' });
      }
      setIsEditingCatalog(false);
      setEditingCatalogId(null);
    } catch (err) {
      console.error('Error saving catalog item:', err);
      handleFirestoreError(err, editingCatalogId ? OperationType.UPDATE : OperationType.CREATE, editingCatalogId ? `itemCatalog/${editingCatalogId}` : 'itemCatalog');
      setSaveStatus({ type: 'error', message: 'Erro ao salvar item.' });
    }
  };

  const handleApproveSuggestion = async (suggestion: Suggestion, updatedData?: any) => {
    try {
      let collectionName = 'skills';
      if (suggestion.type === 'power') collectionName = 'powers';
      if (suggestion.type === 'trait') collectionName = 'traits';
      
      const dataToSave = updatedData || suggestion.data;
      // Create the actual skill/power/trait
      await addDoc(collection(db, collectionName), {
        ...dataToSave,
        createdAt: new Date().toISOString()
      });
      // Update suggestion status
      await updateDoc(doc(db, 'suggestions', suggestion.id), {
        status: 'approved',
        data: dataToSave
      });
      setSaveStatus({ type: 'success', message: 'Sugestão aprovada e adicionada à biblioteca global!' });
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
      const attrGain = attrPointsPerLevel * amount;
      const skillGain = skillPointsPerLevel * amount;
      const powerGain = powerPointsPerLevel * amount;

      await updateDoc(doc(db, 'characters', char.id), {
        level: newLevel,
        attributePoints: (char.attributePoints || 0) + attrGain,
        skillPoints: (char.skillPoints || 0) + skillGain,
        powerPoints: (char.powerPoints || 0) + powerGain
      });

      if (managingCharacter?.id === char.id) {
        setManagingCharacter({ 
          ...managingCharacter, 
          level: newLevel,
          attributePoints: (managingCharacter.attributePoints || 0) + attrGain,
          skillPoints: (managingCharacter.skillPoints || 0) + skillGain,
          powerPoints: (managingCharacter.powerPoints || 0) + powerGain
        });
      }
      setSaveStatus({ type: 'success', message: `${char.name} subiu de nível!` });
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Erro ao subir de nível.' });
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
                    setSaveStatus({ type: 'success', message: 'Código da sessão copiado!' });
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

          <div className="flex flex-wrap gap-2 pb-2 lg:pb-0 -mx-6 px-6 lg:mx-0 lg:px-0 lg:justify-end items-center">
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
              Config. Campanha
            </button>
            <button 
              onClick={() => setActiveTab('sounds')}
              className={cn(
                "px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === 'sounds' ? "bg-arcane text-obsidian font-bold shadow-md shadow-arcane/20" : "glass hover:bg-white/5 text-parchment"
              )}
              title="Gerenciador de Efeitos Sonoros"
            >
              <Music size={16} />
              <span>Efeitos Sonoros</span>
            </button>
            <button 
              type="button"
              onClick={() => setIsGmQuickNotesOpen(true)}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all glass hover:bg-ember/20 text-ember border border-ember/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
              title="Anotações Rápidas da Campanha"
            >
              <Feather size={16} />
              <span>Anotações Rápidas</span>
            </button>

            {/* Config Menu Dropdown */}
            <div className="relative" ref={configMenuRef}>
              <button 
                onClick={() => setShowConfigMenu(!showConfigMenu)}
                className={cn(
                  "p-2 rounded-xl transition-all glass hover:bg-white/10 flex items-center justify-center",
                  showConfigMenu || ['talents', 'skills', 'powers', 'traits', 'vars', 'categories', 'catalog', 'baseSettings', 'suggestions', 'sounds'].includes(activeTab) 
                    ? "bg-arcane text-obsidian" 
                    : "text-parchment/60"
                )}
                title="Atalhos e Ferramentas"
              >
                <Settings size={20} className={cn(showConfigMenu && "animate-[spin_3s_linear_infinite]")} />
              </button>
              
              <AnimatePresence>
                {showConfigMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-56 glass-popup bg-obsidian/85 backdrop-blur-xl border border-white/25 rounded-2xl shadow-2xl p-2 z-[100] overflow-hidden"
                  >
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => { setActiveTab('talents'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'talents' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Talentos
                      </button>
                      <button 
                        onClick={() => { setActiveTab('skills'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'skills' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Perícias
                      </button>
                      <button 
                        onClick={() => { setActiveTab('powers'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'powers' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Poderes
                      </button>
                      <button 
                        onClick={() => { setActiveTab('traits'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'traits' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Vantagens/Defeitos
                      </button>
                      
                      <div className="h-px bg-white/10 my-1 mx-2" />
                      
                      <button 
                        onClick={() => { setActiveTab('vars'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'vars' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Variáveis
                      </button>
                      <button 
                        onClick={() => { setActiveTab('categories'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'categories' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Categorias
                      </button>
                      <button 
                        onClick={() => { setActiveTab('catalog'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'catalog' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Catálogo
                      </button>
                      <button 
                        onClick={() => { setActiveTab('sounds'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between",
                          activeTab === 'sounds' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        <span>Efeitos Sonoros</span>
                        <Music size={14} className="text-arcane" />
                      </button>
                      <button 
                        onClick={() => { setActiveTab('baseSettings'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                          activeTab === 'baseSettings' ? "bg-amber-400/20 text-amber-400" : "hover:bg-white/5 text-amber-400/60 hover:text-amber-400"
                        )}
                      >
                        Config. Base
                      </button>

                      <div className="h-px bg-white/10 my-1 mx-2" />

                      <button 
                        onClick={() => { setActiveTab('suggestions'); setShowConfigMenu(false); }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between",
                          activeTab === 'suggestions' ? "bg-white/10 text-arcane" : "hover:bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        Sugestões
                        {suggestions.length > 0 && (
                          <span className="w-5 h-5 bg-ember text-white text-[10px] rounded-full flex items-center justify-center shadow-lg shadow-ember/20">
                            {suggestions.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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

                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'all' | 'player' | 'npc')}
                    className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-arcane/50"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="player">Personagens Jogadores</option>
                    <option value="npc">NPCs</option>
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
                      <button 
                        onClick={() => handleQuickRoll(char.name, 'FOR', char.stats.for)}
                        className="bg-white/5 p-3 rounded-2xl text-center border border-white/5 hover:bg-arcane/10 hover:border-arcane/30 transition-all group/stat"
                      >
                        <p className="text-[10px] text-parchment/40 font-mono mb-1 group-hover/stat:text-arcane">FOR</p>
                        <p className="text-lg font-serif">{char.stats.for}</p>
                      </button>
                      <button 
                        onClick={() => handleQuickRoll(char.name, 'AGI', char.stats.agi)}
                        className="bg-white/5 p-3 rounded-2xl text-center border border-white/5 hover:bg-arcane/10 hover:border-arcane/30 transition-all group/stat"
                      >
                        <p className="text-[10px] text-parchment/40 font-mono mb-1 group-hover/stat:text-arcane">AGI</p>
                        <p className="text-lg font-serif">{char.stats.agi}</p>
                      </button>
                      <button 
                        onClick={() => handleQuickRoll(char.name, 'CON', char.stats.con)}
                        className="bg-white/5 p-3 rounded-2xl text-center border border-white/5 hover:bg-arcane/10 hover:border-arcane/30 transition-all group/stat"
                      >
                        <p className="text-[10px] text-parchment/40 font-mono mb-1 group-hover/stat:text-arcane">CON</p>
                        <p className="text-lg font-serif">{char.stats.con}</p>
                      </button>
                    </div>

                      <div className="mt-6 flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                          {isOnline(char.ownerId) ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-[10px] font-mono text-parchment/40 uppercase">Online</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-parchment/20" />
                              <span className="text-[10px] font-mono text-parchment/20 uppercase">Offline</span>
                            </>
                          )}
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
                            to={`/sheet?id=${char.id}&fromSession=${sessionId}`}
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

          {activeTab === 'catalog' && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 p-6 md:p-8 rounded-[2.5rem] border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div>
                    <h3 className="text-2xl font-serif text-glow-gold">Catálogo de Itens</h3>
                    <p className="text-sm text-parchment/40">Gerencie a biblioteca global de itens e escolha quais estarão na loja da campanha.</p>
                  </div>
                  
                  <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                    <div className={cn(
                      "flex flex-col px-4 py-2 rounded-2xl border transition-all",
                      shopEnabled ? "bg-gold/5 border-gold/20" : "bg-white/5 border-white/5 opacity-50"
                    )}>
                      <p className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest leading-none mb-1">Status da Loja</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", shopEnabled ? "bg-gold animate-pulse" : "bg-parchment/20")} />
                        <span className={cn("text-xs font-bold uppercase tracking-wider", shopEnabled ? "text-gold" : "text-parchment/30")}>
                          {shopEnabled ? "Ativada" : "Desativada"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[8px] font-mono text-parchment/40 uppercase tracking-widest leading-none mb-1">Itens na Loja</p>
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={12} className="text-arcane" />
                        <span className="text-xs font-bold text-arcane">{shopItemIds.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleSaveSettings}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 text-parchment rounded-2xl font-bold hover:bg-white/20 transition-all text-xs border border-white/10"
                  >
                    <Save size={16} />
                    Salvar Loja
                  </button>
                  <button 
                    onClick={() => {
                        setCatalogItemForm({
                          name: '',
                          category: 'misc',
                          rarity: 'Common',
                          weight: 0,
                          value: 0,
                          isStartingItem: false,
                          description: '',
                          image: '',
                          stats: {},
                          damage: '',
                          defense: 0,
                          relatedWeapons: []
                        });
                        setEditingCatalogId(null);
                        setIsEditingCatalog(true);
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-arcane text-obsidian rounded-xl font-bold hover:scale-105 transition-all text-xs"
                    >
                      <Plus size={16} />
                      Criar Novo Item
                    </button>
                  </div>
              </div>

              {isEditingCatalog && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass p-8 rounded-[2.5rem] space-y-6 relative border border-arcane/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-arcane/20 rounded-xl flex items-center justify-center text-arcane">
                        <Edit2 size={20} />
                      </div>
      <div>
        <h3 className="text-xl font-serif">{editingCatalogId ? 'Editar Item do Catálogo' : 'Criar Novo Item no Catálogo'}</h3>
        <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{editingCatalogId ? 'Modificando entradas globais' : 'Adicionando à biblioteca global'}</p>
      </div>
                    </div>
                    <button onClick={() => setIsEditingCatalog(false)} className="text-parchment/40 hover:text-parchment p-2 rounded-full hover:bg-white/5 transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome do Item</label>
                        <input 
                          type="text" 
                          value={catalogItemForm.name}
                          onChange={e => setCatalogItemForm({ ...catalogItemForm, name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Categoria</label>
                          <select 
                            value={catalogItemForm.category}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, category: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          >
                            <option value="weapons">Armas</option>
                            <option value="armor">Armaduras</option>
                            <option value="ammo">Munição</option>
                            <option value="consumables">Consumíveis</option>
                            <option value="misc">Diversos</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Raridade</label>
                          <select 
                            value={catalogItemForm.rarity}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, rarity: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          >
                            <option value="Common">Comum</option>
                            <option value="Uncommon">Incomum</option>
                            <option value="Rare">Raro</option>
                            <option value="Epic">Épico</option>
                            <option value="Legendary">Lendário</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Peso (kg)</label>
                          <input 
                            type="number" 
                            value={catalogItemForm.weight}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, weight: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Valor (MO)</label>
                          <input 
                            type="number" 
                            value={catalogItemForm.value}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, value: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-2 py-4">
                        <input 
                          type="checkbox"
                          id="isStartingItem"
                          checked={catalogItemForm.isStartingItem}
                          onChange={e => setCatalogItemForm({ ...catalogItemForm, isStartingItem: e.target.checked })}
                          className="w-5 h-5 rounded border-white/10 bg-white/5 text-arcane focus:ring-arcane/50"
                        />
                        <label htmlFor="isStartingItem" className="text-xs font-mono text-parchment/60 uppercase tracking-widest cursor-pointer select-none">
                          Item Inicial (Visível na criação de personagem)
                        </label>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Imagem URL</label>
                          <button
                            type="button"
                            onClick={() => setIsCatalogImagePickerOpen(true)}
                            className="text-xs font-mono text-arcane hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <ImageIcon size={12} />
                            Escolher Imagem
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={catalogItemForm.image}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, image: e.target.value })}
                            placeholder="https://..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setIsCatalogImagePickerOpen(true)}
                            className="px-3 py-2 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <ImageIcon size={14} />
                            Galeria
                          </button>
                        </div>
                      </div>

                      {catalogItemForm.category === 'ammo' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Armas Relacionadas</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar glass p-3 rounded-xl border border-white/10">
                            {itemCatalog.filter(i => i.category === 'weapons').map(weapon => (
                              <label key={weapon.id} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                <input 
                                  type="checkbox"
                                  checked={catalogItemForm.relatedWeapons?.includes(weapon.id)}
                                  onChange={e => {
                                    const current = catalogItemForm.relatedWeapons || [];
                                    if (e.target.checked) {
                                      setCatalogItemForm({ ...catalogItemForm, relatedWeapons: [...current, weapon.id] });
                                    } else {
                                      setCatalogItemForm({ ...catalogItemForm, relatedWeapons: current.filter(id => id !== weapon.id) });
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-arcane focus:ring-arcane/50"
                                />
                                <span className="text-xs text-parchment/60 group-hover:text-parchment transition-colors truncate">{weapon.name}</span>
                              </label>
                            ))}
                            {itemCatalog.filter(i => i.category === 'weapons').length === 0 && (
                              <p className="text-[10px] text-parchment/40 italic p-2">Nenhuma arma cadastrada no catálogo.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dano</label>
                          <input 
                            type="text" 
                            value={catalogItemForm.damage}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, damage: e.target.value })}
                            placeholder="Ex: 2d6 + FOR"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Defesa</label>
                          <input 
                            type="number" 
                            value={catalogItemForm.defense}
                            onChange={e => setCatalogItemForm({ ...catalogItemForm, defense: Number(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                        <textarea 
                          value={catalogItemForm.description}
                          onChange={e => setCatalogItemForm({ ...catalogItemForm, description: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors h-24 resize-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificadores de Atributo</label>
                        <div className="grid grid-cols-4 gap-2">
                          {attributes.map(attr => (
                            <div key={attr.id} className="space-y-1">
                              <p className="text-[8px] font-mono text-parchment/40 uppercase text-center">{attr.id}</p>
                              <input 
                                type="number"
                                value={catalogItemForm.stats[attr.id] || 0}
                                onChange={e => setCatalogItemForm({
                                  ...catalogItemForm,
                                  stats: { ...catalogItemForm.stats, [attr.id]: Number(e.target.value) }
                                })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-1 py-1 text-center text-xs focus:outline-none focus:border-arcane/50 font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button 
                      onClick={() => setIsEditingCatalog(false)}
                      className="px-6 py-2 rounded-xl glass hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveCatalogItem}
                      className="flex items-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] active:scale-95 transition-all font-bold shadow-lg shadow-arcane/20"
                    >
                      <Save size={18} />
                      {editingCatalogId ? 'Salvar Alterações' : 'Criar Item'}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {itemCatalog.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Backpack size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">O catálogo está vazio</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Assim que os jogadores criarem ou salvarem itens em seus inventários, eles aparecerão aqui.</p>
                  </div>
                ) : (
                  itemCatalog.map((item) => (
                    <div 
                      key={item.id} 
                      className="glass rounded-[2rem] border border-white/10 hover:border-arcane/30 transition-all group relative overflow-hidden flex flex-col"
                    >
                      <div className="aspect-square relative overflow-hidden bg-obsidian/40">
                        <img 
                          src={item.image || "https://picsum.photos/seed/item/400/400"} 
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                           <div className={cn(
                             "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border",
                             item.rarity === 'Legendary' ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                             item.rarity === 'Epic' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                             item.rarity === 'Rare' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                             item.rarity === 'Uncommon' ? "bg-green-500/20 text-green-400 border-green-500/30" :
                             "bg-gray-500/20 text-gray-400 border-gray-500/30"
                           )}>
                             {item.rarity}
                           </div>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                           <div className="glass-dark px-3 py-1.5 rounded-xl text-[10px] font-mono text-parchment/60 uppercase tracking-widest text-center truncate">
                             {item.category}
                           </div>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col gap-4">
                        <div className="space-y-1">
                          <h4 className="text-xl font-serif text-glow-arcane truncate">{item.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-parchment/30">
                            <span>Criado por: <span className="text-arcane/60">{item.createdBy || 'Sistema'}</span></span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-white/5">
                           <div className="space-y-0.5">
                             <p className="text-[9px] font-mono text-parchment/40 uppercase tracking-tighter">Peso</p>
                             <p className="text-sm font-bold text-parchment/80">{item.weight} kg</p>
                           </div>
                           <div className="space-y-0.5 text-right">
                             <p className="text-[9px] font-mono text-parchment/40 uppercase tracking-tighter">Valor</p>
                             <p className="text-sm font-bold text-gold">{item.value || 0} MO</p>
                           </div>
                        </div>

                        {item.description && (
                          <p className="text-xs text-parchment/50 line-clamp-3 italic">
                            "{item.description}"
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2 mt-auto">
                          {item.damage && (
                            <span className="px-2 py-0.5 rounded-md bg-red-400/10 text-red-400 text-[10px] font-bold border border-red-400/20">
                              Dano: {item.damage}
                            </span>
                          )}
                          {item.defense && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-400/10 text-blue-400 text-[10px] font-bold border border-blue-400/20">
                              Def: {item.defense}
                            </span>
                          )}
                          {item.stats && Object.entries(item.stats).map(([stat, val]) => (val as number) !== 0 && (
                            <span key={stat} className="px-2 py-0.5 rounded-md bg-arcane/10 text-arcane text-[10px] font-bold border border-arcane/20">
                              {stat.toUpperCase()}: {(val as number) > 0 ? `+${val}` : val}
                            </span>
                          ))}
                        </div>
                        
                        <div className="flex gap-2 mb-2">
                           <button 
                             onClick={() => toggleShopItem(item.id)}
                             className={cn(
                               "flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest",
                               shopItemIds.includes(item.id)
                                 ? "bg-gold text-obsidian border-gold shadow-lg shadow-gold/20"
                                 : "bg-white/5 text-parchment/40 border-white/10 hover:border-gold/30 hover:text-gold"
                             )}
                           >
                             <ShoppingCart size={14} className={cn(shopItemIds.includes(item.id) ? "fill-current" : "")} />
                             {shopItemIds.includes(item.id) ? 'Disponível na Loja' : 'Add à Loja'}
                           </button>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditCatalogItem(item)}
                            className="flex-1 py-2 rounded-xl bg-arcane/10 text-arcane border border-arcane/20 text-[10px] font-bold uppercase tracking-widest hover:bg-arcane hover:text-obsidian transition-all flex items-center justify-center gap-2"
                          >
                            <Edit2 size={12} />
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDuplicateCatalogItem(item)}
                            className="p-2 rounded-xl bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-obsidian transition-all"
                            title="Duplicar Item"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm('Deseja excluir este item do catálogo?')) {
                                try {
                                  await deleteDoc(doc(db, 'itemCatalog', item.id));
                                } catch (err) {
                                  console.error('Error deleting catalog item:', err);
                                }
                              }
                            }}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-obsidian transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
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
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsGmQuickNotesOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-ember/20 text-ember border border-ember/30 rounded-xl hover:bg-ember/30 transition-all text-sm font-medium cursor-pointer"
                    title="Abrir Anotações Rápidas da Campanha"
                  >
                    <Feather size={16} />
                    Abrir Anotações Rápidas
                  </button>
                  <button 
                    onClick={handleSaveNotes}
                    className="flex items-center gap-2 px-4 py-2 bg-arcane/20 text-arcane rounded-xl hover:bg-arcane/30 transition-all text-sm font-medium"
                  >
                    <Save size={18} />
                    Salvar Notas
                  </button>
                </div>
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
                      setNewTalent({ name: '', description: '', composition: [], category: '' });
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
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Categoria</label>
                        <select 
                          value={newTalent.category || ''}
                          onChange={e => setNewTalent(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        >
                          <option value="">Sem Categoria</option>
                          {talentCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
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
                              const attr = attributes.find(a => a.id === attrId);
                              if (!attr) return null;
                              return (
                                <motion.div 
                                  key={`${attrId}-${index}`}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-arcane/10 border border-arcane/30 text-arcane text-xs font-medium"
                                >
                                  {React.createElement(getIcon(attr.icon), { size: 12 })}
                                  {attr.label}
                                  <button 
                                    onClick={() => removeAttributeFromTalent(index)}
                                    className="p-1 hover:bg-ember/10 hover:text-ember transition-all rounded-md ml-1"
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
                          {attributes.map(attr => (
                            <button
                              key={attr.id}
                              onClick={() => addAttributeToTalent(attr.id)}
                              className="flex items-center gap-3 p-3 rounded-xl border bg-white/5 border-white/10 text-parchment/40 hover:border-arcane/50 hover:text-parchment transition-all text-left group"
                            >
                              {React.createElement(getIcon(attr.icon), { size: 16, className: "group-hover:text-arcane transition-colors" })}
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
                        <div>
                          <h4 className="text-xl font-serif text-glow-arcane">{talent.name}</h4>
                          {talent.category && (
                            <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{talent.category}</span>
                          )}
                        </div>
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
                          const attr = attributes.find(a => a.id === attrId);
                          if (!attr) return null;
                          return (
                            <div key={attrId} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-wider">
                              {React.createElement(getIcon(attr.icon), { size: 10, className: attr.color })}
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
                            {Object.keys(skillTypeVars).map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
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
                          {Object.keys(powerTypeVars).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
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

          {activeTab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Categorias e Tipos</h3>
                  <p className="text-sm text-parchment/40">Gerencie as categorias de talentos, tipos de poderes e perícias.</p>
                </div>
                <button 
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Save size={18} />
                  Salvar Alterações
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Attributes Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-arcane">
                      <Activity size={20} />
                      <h4 className="text-lg font-serif">Atributos</h4>
                    </div>
                    <button 
                      onClick={() => setShowNewAttrInput(true)}
                      className="p-2 bg-arcane/10 text-arcane rounded-xl hover:bg-arcane/20 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewAttrInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass p-4 rounded-2xl border border-arcane/30 space-y-4 overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                            <input 
                              type="text"
                              value={newAttr.label}
                              onChange={e => setNewAttr({ ...newAttr, label: e.target.value })}
                              placeholder="Ex: Sorte"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-arcane/50 transition-colors text-sm"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Ícone</label>
                            <select 
                              value={newAttr.icon}
                              onChange={e => setNewAttr({ ...newAttr, icon: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-arcane/50 transition-colors text-sm"
                            >
                              <option value="Shield">Escudo</option>
                              <option value="Sword">Espada</option>
                              <option value="Zap">Raio</option>
                              <option value="Brain">Cérebro</option>
                              <option value="Heart">Coração</option>
                              <option value="Eye">Olho</option>
                              <option value="Activity">Atividade</option>
                              <option value="Flame">Fogo</option>
                              <option value="Star">Estrela</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (newAttr.label.trim()) {
                                const id = newAttr.label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 3);
                                if (attributes.some(a => a.id === id)) {
                                  setSaveStatus({ type: 'error', message: 'Um atributo com este ID já existe!' });
                                  return;
                                }
                                setAttributes([...attributes, { ...newAttr, id }]);
                                setNewAttr({ label: '', icon: 'Shield', color: 'text-arcane' });
                                setShowNewAttrInput(false);
                              }
                            }}
                            className="flex-1 py-2 bg-arcane text-obsidian rounded-xl font-bold text-xs hover:scale-[1.02] transition-all"
                          >
                            Adicionar
                          </button>
                          <button 
                            onClick={() => {
                              setShowNewAttrInput(false);
                              setNewAttr({ label: '', icon: 'Shield', color: 'text-arcane' });
                            }}
                            className="px-3 py-2 glass rounded-xl text-xs hover:bg-white/5 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    {attributes.map((attr, idx) => (
                      <div key={attr.id} className="glass p-3 rounded-xl border border-white/5 flex items-center justify-between group">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn("p-1.5 rounded-lg bg-white/5", attr.color)}>
                            {React.createElement(getIcon(attr.icon), { size: 14 })}
                          </div>
                          {editingAttribute === attr.id ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input 
                                type="text"
                                value={editingAttributeName}
                                onChange={e => setEditingAttributeName(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-arcane/50"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameAttribute(attr.id, editingAttributeName);
                                  if (e.key === 'Escape') setEditingAttribute(null);
                                }}
                              />
                              <button 
                                onClick={() => handleRenameAttribute(attr.id, editingAttributeName)}
                                className="p-1 text-green-400 hover:bg-green-400/10 rounded-md"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => setEditingAttribute(null)}
                                className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{attr.label}</span>
                              <span className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest">{attr.id}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {!editingAttribute && (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingAttribute(attr.id);
                                  setEditingAttributeName(attr.label);
                                }}
                                className="p-1.5 text-parchment/20 hover:text-arcane hover:bg-arcane/10 rounded-lg"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  if (DEFAULT_ATTRIBUTES.some(a => a.id === attr.id)) {
                                    setSaveStatus({ type: 'error', message: 'Não é possível excluir atributos base!' });
                                    return;
                                  }
                                  setAttributes(attributes.filter((_, i) => i !== idx));
                                }}
                                className="p-1.5 text-parchment/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Talent Categories */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gold">
                      <Sparkles size={20} />
                      <h4 className="text-lg font-serif">Categorias de Talentos</h4>
                    </div>
                    <button 
                      onClick={() => setShowNewTalentCatInput(true)}
                      className="p-2 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewTalentCatInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass p-4 rounded-2xl border border-gold/30 space-y-4 overflow-hidden"
                      >
                        <input 
                          type="text"
                          value={newTalentCatName}
                          onChange={e => setNewTalentCatName(e.target.value)}
                          placeholder="Nome da categoria..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-gold/50 transition-colors text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (newTalentCatName.trim()) {
                                if (talentCategories.includes(newTalentCatName.trim())) {
                                  setSaveStatus({ type: 'error', message: 'Esta categoria já existe!' });
                                  return;
                                }
                                setTalentCategories([...talentCategories, newTalentCatName.trim()]);
                                setNewTalentCatName('');
                                setShowNewTalentCatInput(false);
                              }
                            }}
                            className="flex-1 py-2 bg-gold text-obsidian rounded-xl font-bold text-xs hover:scale-[1.02] transition-all"
                          >
                            Adicionar
                          </button>
                          <button 
                            onClick={() => {
                              setShowNewTalentCatInput(false);
                              setNewTalentCatName('');
                            }}
                            className="px-3 py-2 glass rounded-xl text-xs hover:bg-white/5 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    {talentCategories.length === 0 ? (
                      <p className="text-xs text-parchment/20 italic text-center py-4">Nenhuma categoria criada.</p>
                    ) : (
                      talentCategories.map((cat, idx) => (
                        <div key={idx} className="glass p-3 rounded-xl border border-white/5 flex items-center justify-between group">
                          <span className="text-sm">{cat}</span>
                          <button 
                            onClick={() => setTalentCategories(talentCategories.filter((_, i) => i !== idx))}
                            className="p-1.5 text-parchment/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Power Types */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-arcane">
                      <Zap size={20} />
                      <h4 className="text-lg font-serif">Tipos de Poderes</h4>
                    </div>
                    <button 
                      onClick={() => setShowNewPowerTypeInput(true)}
                      className="p-2 bg-arcane/10 text-arcane rounded-xl hover:bg-arcane/20 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewPowerTypeInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass p-4 rounded-2xl border border-arcane/30 space-y-4 overflow-hidden"
                      >
                        <input 
                          type="text"
                          value={newPowerTypeName}
                          onChange={e => setNewPowerTypeName(e.target.value)}
                          placeholder="Nome do tipo..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-arcane/50 transition-colors text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (newPowerTypeName.trim()) {
                                if (powerTypeVars[newPowerTypeName.trim()]) {
                                  setSaveStatus({ type: 'error', message: 'Este tipo já existe!' });
                                  return;
                                }
                                setPowerTypeVars({ ...powerTypeVars, [newPowerTypeName.trim()]: '1' });
                                setNewPowerTypeName('');
                                setShowNewPowerTypeInput(false);
                              }
                            }}
                            className="flex-1 py-2 bg-arcane text-obsidian rounded-xl font-bold text-xs hover:scale-[1.02] transition-all"
                          >
                            Adicionar
                          </button>
                          <button 
                            onClick={() => {
                              setShowNewPowerTypeInput(false);
                              setNewPowerTypeName('');
                            }}
                            className="px-3 py-2 glass rounded-xl text-xs hover:bg-white/5 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                    <div className="space-y-3">
                      {Object.entries(powerTypeVars).map(([name, formula]) => (
                        <div key={name} className="glass p-4 rounded-xl border border-white/5 space-y-3 group">
                          <div className="flex items-center justify-between">
                            {editingPowerType === name ? (
                              <div className="flex items-center gap-2 flex-1 mr-2">
                                <input 
                                  type="text"
                                  value={editingPowerTypeName}
                                  onChange={e => setEditingPowerTypeName(e.target.value)}
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-arcane/50"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenamePowerType(name, editingPowerTypeName);
                                    if (e.key === 'Escape') setEditingPowerType(null);
                                  }}
                                />
                                <button 
                                  onClick={() => handleRenamePowerType(name, editingPowerTypeName)}
                                  className="p-1 text-green-400 hover:bg-green-400/10 rounded-md"
                                >
                                  <Check size={14} />
                                </button>
                                <button 
                                  onClick={() => setEditingPowerType(null)}
                                  className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm font-medium text-arcane">{name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => {
                                      setEditingPowerType(name);
                                      setEditingPowerTypeName(name);
                                    }}
                                    className="p-1.5 text-parchment/20 hover:text-arcane hover:bg-arcane/10 rounded-lg"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const next = { ...powerTypeVars };
                                      delete next[name];
                                      setPowerTypeVars(next);
                                    }}
                                    className="p-1.5 text-parchment/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest">Variável de Custo</label>
                            <input 
                              type="text"
                              value={formula}
                              onChange={e => setPowerTypeVars({ ...powerTypeVars, [name]: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-arcane/50 transition-colors text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                </div>

                {/* Skill Categories */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-ember">
                      <Brain size={20} />
                      <h4 className="text-lg font-serif">Categorias de Perícias</h4>
                    </div>
                    <button 
                      onClick={() => setShowNewSkillTypeInput(true)}
                      className="p-2 bg-ember/10 text-ember rounded-xl hover:bg-ember/20 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <p className="text-xs text-parchment/40 italic px-1">
                    * Cada categoria criada aqui torna-se automaticamente uma variável de cálculo (ex: TREINAMENTO).
                  </p>

                  <AnimatePresence>
                    {showNewSkillTypeInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass p-4 rounded-2xl border border-ember/30 space-y-4 overflow-hidden"
                      >
                        <input 
                          type="text"
                          value={newSkillTypeName}
                          onChange={e => setNewSkillTypeName(e.target.value)}
                          placeholder="Nome da categoria..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-ember/50 transition-colors text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (newSkillTypeName.trim()) {
                                if (skillTypeVars[newSkillTypeName.trim()]) {
                                  setSaveStatus({ type: 'error', message: 'Esta categoria já existe!' });
                                  return;
                                }
                                setSkillTypeVars({ ...skillTypeVars, [newSkillTypeName.trim()]: '1' });
                                setNewSkillTypeName('');
                                setShowNewSkillTypeInput(false);
                              }
                            }}
                            className="flex-1 py-2 bg-ember text-obsidian rounded-xl font-bold text-xs hover:scale-[1.02] transition-all"
                          >
                            Adicionar
                          </button>
                          <button 
                            onClick={() => {
                              setShowNewSkillTypeInput(false);
                              setNewSkillTypeName('');
                            }}
                            className="px-3 py-2 glass rounded-xl text-xs hover:bg-white/5 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                    <div className="space-y-3">
                      {Object.entries(skillTypeVars).map(([name, formula]) => (
                        <div key={name} className="glass p-4 rounded-xl border border-white/5 space-y-3 group">
                          <div className="flex items-center justify-between">
                            {editingSkillType === name ? (
                              <div className="flex items-center gap-2 flex-1 mr-2">
                                <input 
                                  type="text"
                                  value={editingSkillTypeName}
                                  onChange={e => setEditingSkillTypeName(e.target.value)}
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-ember/50"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameSkillType(name, editingSkillTypeName);
                                    if (e.key === 'Escape') setEditingSkillType(null);
                                  }}
                                />
                                <button 
                                  onClick={() => handleRenameSkillType(name, editingSkillTypeName)}
                                  className="p-1 text-green-400 hover:bg-green-400/10 rounded-md"
                                >
                                  <Check size={14} />
                                </button>
                                <button 
                                  onClick={() => setEditingSkillType(null)}
                                  className="p-1 text-red-400 hover:bg-red-400/10 rounded-md"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm font-medium text-ember">{name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => {
                                      setEditingSkillType(name);
                                      setEditingSkillTypeName(name);
                                    }}
                                    className="p-1.5 text-parchment/20 hover:text-ember hover:bg-ember/10 rounded-lg"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const next = { ...skillTypeVars };
                                      delete next[name];
                                      setSkillTypeVars(next);
                                    }}
                                    className="p-1.5 text-parchment/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-parchment/40 uppercase tracking-widest">Variável de Custo</label>
                            <input 
                              type="text"
                              value={formula}
                              onChange={e => setSkillTypeVars({ ...skillTypeVars, [name]: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ember/50 transition-colors text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'vars' && (
            <motion.div
              key="vars"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Variáveis de Cálculo</h3>
                  <p className="text-sm text-parchment/40">Consulte as variáveis base e crie variáveis personalizadas para usar em suas fórmulas.</p>
                </div>
                <button 
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Save size={18} />
                  Salvar Alterações
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Core Variables (Read-only) */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-arcane">
                      <Shield size={20} />
                      <h4 className="text-lg font-serif">Variáveis Base (Somente Leitura)</h4>
                    </div>
                    <button 
                      onClick={handleSyncVariables}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-arcane/10 text-arcane rounded-xl hover:bg-arcane/20 transition-all text-[10px] font-bold uppercase tracking-wider"
                      title="Sincronizar variáveis com atributos e categorias"
                    >
                      <RefreshCw size={12} className="animate-spin-slow" />
                      Sincronizar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {attributes.map(attr => (
                      <div key={attr.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">{attr.label}</span>
                        <span className="text-lg font-mono text-arcane">{attr.id.toUpperCase()}</span>
                      </div>
                    ))}
                    {Object.keys(skillTypeVars).map(cat => {
                      const normalizedCat = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                      const plural = normalizedCat.endsWith('S') ? normalizedCat : normalizedCat + 'S';
                      const singular = normalizedCat.endsWith('S') ? normalizedCat.slice(0, -1) : normalizedCat;
                      
                      return (
                        <div key={cat} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1 relative group overflow-hidden">
                          <div className="absolute top-0 right-0 p-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Sincronizado" />
                          </div>
                          <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Perícias: {cat}</span>
                          <div className="flex flex-col">
                            <span className="text-lg font-mono text-arcane leading-tight">{normalizedCat}</span>
                            <span className="text-[9px] font-mono text-parchment/20">Alt: {normalizedCat === singular ? plural : singular}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Total de Perícias</span>
                      <span className="text-lg font-mono text-arcane">SKILLS</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Total de Poderes</span>
                      <span className="text-lg font-mono text-arcane">POWERS</span>
                    </div>
                  </div>
                </div>

                {/* Custom Variables */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-ember">
                      <Plus size={20} />
                      <h4 className="text-lg font-serif">Variáveis Personalizadas</h4>
                    </div>
                    <button 
                      onClick={() => setShowNewVarInput(true)}
                      className="p-2 bg-ember/10 text-ember rounded-xl hover:bg-ember/20 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewVarInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass p-4 rounded-2xl border border-ember/30 space-y-4 overflow-hidden"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Nome da Variável</label>
                          <input 
                            type="text"
                            value={newVarName}
                            onChange={e => setNewVarName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                            placeholder="EX: BONUS_DANO"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-ember/50 transition-colors font-mono text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (newVarName.trim()) {
                                if (calculationVars[newVarName]) {
                                  setSaveStatus({ type: 'error', message: 'Esta variável já existe!' });
                                  return;
                                }
                                setCalculationVars({ ...calculationVars, [newVarName]: '0' });
                                setNewVarName('');
                                setShowNewVarInput(false);
                              }
                            }}
                            className="flex-1 py-2 bg-ember text-obsidian rounded-xl font-bold text-sm hover:scale-[1.02] transition-all"
                          >
                            Adicionar
                          </button>
                          <button 
                            onClick={() => {
                              setShowNewVarInput(false);
                              setNewVarName('');
                            }}
                            className="px-4 py-2 glass rounded-xl text-sm hover:bg-white/5 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    {Object.entries(calculationVars).length === 0 ? (
                      <div className="text-center py-10 glass rounded-2xl border border-white/5">
                        <p className="text-sm text-parchment/20 italic">Nenhuma variável personalizada criada.</p>
                      </div>
                    ) : (
                      Object.entries(calculationVars).map(([name, value]) => (
                        <div key={name} className="glass p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4 group">
                          <div className="flex-1 space-y-1 w-full">
                            <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-1">{name}</label>
                            <input 
                              type="text" 
                              value={value}
                              onChange={e => setCalculationVars({ ...calculationVars, [name]: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-arcane/50 transition-colors font-mono text-sm"
                              placeholder="Fórmula ou valor..."
                            />
                          </div>
                          <button 
                            onClick={() => {
                              const newVars = { ...calculationVars };
                              delete newVars[name];
                              setCalculationVars(newVars);
                            }}
                            className="p-2 text-parchment/20 hover:text-ember hover:bg-ember/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sounds' && (
            <motion.div
              key="sounds"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-6 sm:p-8 rounded-[2.5rem] space-y-6"
            >
              <SoundEffectManager
                currentSettings={{
                  diceRollSound,
                  successSound,
                  failureSound,
                  criticalSound,
                  fumbleSound
                }}
                sessionName={sessionName}
                sessionId={sessionId}
                isGlobalMode={false}
                onSaveSession={handleSaveSounds}
                onSaveGlobal={handleSaveGlobalSounds}
                onUpdateSound={(key, val) => {
                  if (key === 'diceRollSound') setDiceRollSound(val);
                  else if (key === 'successSound') setSuccessSound(val);
                  else if (key === 'failureSound') setFailureSound(val);
                  else if (key === 'criticalSound') setCriticalSound(val);
                  else if (key === 'fumbleSound') setFumbleSound(val);
                }}
              />
            </motion.div>
          )}

          {(activeTab === 'settings' || activeTab === 'baseSettings') && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass p-8 rounded-[2.5rem] space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    activeTab === 'baseSettings' ? "bg-amber-400/20 text-amber-400" : "bg-arcane/20 text-arcane"
                  )}>
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif">
                      {activeTab === 'baseSettings' ? 'Configurações Base do Sistema' : 'Configurações da Campanha'}
                    </h3>
                    <p className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest leading-none">
                      {activeTab === 'baseSettings' 
                        ? 'Afeta todas as futuras campanhas criadas' 
                        : `Ajustes exclusivos para: ${sessionName}`
                      }
                    </p>
                  </div>
                </div>
                <button 
                  onClick={activeTab === 'baseSettings' ? handleSaveBaseSettings : handleSaveSettings}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl hover:scale-[1.02] transition-all font-bold shadow-lg",
                    activeTab === 'baseSettings' ? "bg-amber-400 text-obsidian" : "bg-arcane text-obsidian"
                  )}
                >
                  <Save size={18} />
                  Salvar {activeTab === 'baseSettings' ? 'Base' : 'Alterações'}
                </button>
              </div>

              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/5 p-6 rounded-3xl border border-white/10">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome da Campanha</label>
                      <input 
                        type="text" 
                        value={sessionName}
                        onChange={e => setSessionName(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, sessionName: true }))}
                        className={cn(
                          "w-full bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors font-serif text-lg",
                          touched.sessionName && !sessionName.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                        )}
                      />
                      {touched.sessionName && !sessionName.trim() && (
                        <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O nome da campanha é obrigatório</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Capa da Campanha</label>
                        <button
                          type="button"
                          onClick={() => setIsSessionImagePickerOpen(true)}
                          className="text-xs font-mono text-arcane hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ImageIcon size={12} />
                          Escolher Imagem
                        </button>
                      </div>

                      <div className="flex items-center gap-3 p-3 glass rounded-xl border border-white/10">
                        <div 
                          onClick={() => setIsSessionImagePickerOpen(true)}
                          className="w-16 h-12 rounded-lg overflow-hidden border border-white/20 bg-white/5 shrink-0 cursor-pointer group relative"
                          title="Clique para alterar a imagem"
                        >
                          {sessionImage ? (
                            <img 
                              src={sessionImage} 
                              alt="Capa da Sessão" 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-parchment/30">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-obsidian/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ImageIcon size={14} />
                          </div>
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input 
                            type="text" 
                            value={sessionImage}
                            onChange={e => setSessionImage(e.target.value)}
                            placeholder="URL da imagem..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setIsSessionImagePickerOpen(true)}
                            className="px-3 py-2 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <ImageIcon size={12} />
                            Galeria
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-serif mb-1">Gerenciar Jogadores</h4>
                        <p className="text-sm text-parchment/40">Convide jogadores pelo e-mail para que eles possam participar desta campanha.</p>
                      </div>
                      <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Código da Sessão:</span>
                        <code className="text-sm font-bold text-gold">{session?.code}</code>
                      </div>
                    </div>

                    <form onSubmit={handleInvitePlayer} className="flex gap-4">
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-parchment/20">
                          <UserPlus size={18} />
                        </div>
                        <input 
                          type="email" 
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          placeholder="E-mail do jogador para convidar..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isInviting || !inviteEmail}
                        className="px-8 py-3 bg-arcane text-obsidian rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-arcane/20"
                      >
                        {isInviting ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                        <span>Convidar</span>
                      </button>
                    </form>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sessionPlayers.length === 0 ? (
                        <div className="col-span-full py-12 text-center glass rounded-3xl border border-dashed border-white/5">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-parchment/10">
                            <Users size={32} />
                          </div>
                          <h5 className="text-parchment/40 font-serif text-lg">Nenhum jogador na mesa</h5>
                          <p className="text-xs text-parchment/20 max-w-xs mx-auto">Use o e-mail acima para convidar seus amigos para a aventura.</p>
                        </div>
                      ) : (
                        sessionPlayers.map(player => (
                          <div key={player.id} className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between group hover:border-white/20 transition-all">
                            <div className="flex items-center gap-3">
                              {player.image ? (
                                <img src={player.image} alt={player.name} className="w-11 h-11 rounded-full border-2 border-white/10" />
                              ) : (
                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-parchment/40 border border-white/10">
                                  <User size={22} />
                                </div>
                              )}
                              <div className="overflow-hidden">
                                <p className="text-sm font-bold truncate">{player.name}</p>
                                <p className="text-[10px] font-mono text-parchment/40 truncate">{player.email}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemovePlayer(player.id)}
                              className="p-2.5 text-parchment/20 hover:text-ember hover:bg-ember/10 rounded-xl transition-all md:opacity-0 group-hover:opacity-100 flex-shrink-0"
                              title="Remover da Mesa"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-xl font-serif mb-2">Parâmetros de Criação</h4>
                  <p className="text-sm text-parchment/40">Defina os limites e recursos iniciais que cada jogador terá ao criar seu personagem.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Dinheiro Inicial (MO)</label>
                  <input 
                    type="number" 
                    value={initialMoney}
                    onChange={e => setInitialMoney(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                  />
                  <p className="text-[10px] text-parchment/40 font-mono px-2">Define o capital inicial dos personagens para compra de equipamentos.</p>
                </div>
              </div>
            </div>

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-serif mb-2">Acesso à Loja</h4>
                    <p className="text-sm text-parchment/40">Controle se os jogadores podem acessar o mercado de itens em seus inventários.</p>
                  </div>
                  <button 
                    onClick={() => setShopEnabled(!shopEnabled)}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all border",
                      shopEnabled 
                        ? "bg-gold/20 border-gold/40 text-gold" 
                        : "bg-white/5 border-white/10 text-parchment/40"
                    )}
                  >
                    <ShoppingCart size={18} />
                    <span>{shopEnabled ? 'Loja Ativada' : 'Loja Desativada'}</span>
                  </button>
                </div>
              </div>

              {activeTab === 'baseSettings' && (
                <div className="pt-8 border-t border-white/10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-serif mb-2">Autenticação de Teste</h4>
                      <p className="text-sm text-parchment/40">Habilita a criação de conta e login via e-mail e senha para usuários externos.</p>
                    </div>
                    <button 
                      onClick={() => setEnableEmailPasswordAuth(!enableEmailPasswordAuth)}
                      className={cn(
                        "flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all border",
                        enableEmailPasswordAuth 
                          ? "bg-arcane/20 border-arcane/40 text-arcane" 
                          : "bg-white/5 border-white/10 text-parchment/40"
                      )}
                    >
                      <Shield size={18} />
                      <span>{enableEmailPasswordAuth ? 'Login-Senha Ativado' : 'Login-Senha Desativado'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-xl font-serif mb-2">Evolução de Personagem</h4>
                  <p className="text-sm text-parchment/40">Defina quantos pontos os personagens ganham automaticamente ao subir de nível.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Atributos por Nível</label>
                    <input 
                      type="number" 
                      value={attrPointsPerLevel}
                      onChange={e => setAttrPointsPerLevel(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Perícias por Nível</label>
                    <input 
                      type="number" 
                      value={skillPointsPerLevel}
                      onChange={e => setSkillPointsPerLevel(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Poderes por Nível</label>
                    <input 
                      type="number" 
                      value={powerPointsPerLevel}
                      onChange={e => setPowerPointsPerLevel(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-xl font-serif mb-2">Config Criador de NPC</h4>
                  <p className="text-sm text-parchment/40">Defina os valores padrão que o gerador de NPC usará quando a opção "Usar Padrões da Campanha" estiver ativa.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Atributo Mínimo</label>
                    <input 
                      type="number" 
                      value={npcDefaultMinAttr}
                      onChange={e => setNpcDefaultMinAttr(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Atributo Máximo</label>
                    <input 
                      type="number" 
                      value={npcDefaultMaxAttr}
                      onChange={e => setNpcDefaultMaxAttr(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos de Atributo Base</label>
                    <input 
                      type="number" 
                      value={npcDefaultAttrPoints}
                      onChange={e => setNpcDefaultAttrPoints(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos de Perícia Base</label>
                    <input 
                      type="number" 
                      value={npcDefaultSkillPoints}
                      onChange={e => setNpcDefaultSkillPoints(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Pontos de Poder Base</label>
                    <input 
                      type="number" 
                      value={npcDefaultPowerPoints}
                      onChange={e => setNpcDefaultPowerPoints(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-6">
                <div>
                  <h4 className="text-xl font-serif mb-2">Fórmulas de Combate</h4>
                  <p className="text-sm text-parchment/40">Personalize como os status de combate são calculados. Use nomes de atributos em maiúsculo (ex: FOR, CON, INT, AGI, PER, VEL, INI, COR) e use o nome das categorias de perícia em maiúsculo (ex: LUTA, MISTICA, CONHECIMENTO) para contar perícias desses tipos.</p>
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
                  <h4 className="text-xl font-serif mb-2">Variáveis de Dificuldade</h4>
                  <p className="text-sm text-parchment/40">Defina os modificadores e divisores para os testes de dificuldade.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificador Fácil (F)</label>
                    <input 
                      type="number" 
                      value={diffEasyMod}
                      onChange={e => setDiffEasyMod(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                    <p className="text-[10px] text-parchment/40 font-mono px-2">Valor somado ao atributo (ex: +2).</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Divisor Difícil (D)</label>
                    <input 
                      type="number" 
                      value={diffHardDiv}
                      onChange={e => setDiffHardDiv(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                    <p className="text-[10px] text-parchment/40 font-mono px-2">Atributo dividido por este valor (ex: / 2).</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Divisor Extremo (E)</label>
                    <input 
                      type="number" 
                      value={diffExtremeDiv}
                      onChange={e => setDiffExtremeDiv(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                    />
                    <p className="text-[10px] text-parchment/40 font-mono px-2">Atributo dividido por este valor (ex: / 5).</p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-6">
                <SoundEffectManager
                  currentSettings={{
                    diceRollSound,
                    successSound,
                    failureSound,
                    criticalSound,
                    fumbleSound
                  }}
                  sessionName={sessionName}
                  sessionId={sessionId}
                  isGlobalMode={activeTab === 'baseSettings'}
                  onSaveSession={handleSaveSounds}
                  onSaveGlobal={handleSaveGlobalSounds}
                  onUpdateSound={(key, val) => {
                    if (key === 'diceRollSound') setDiceRollSound(val);
                    else if (key === 'successSound') setSuccessSound(val);
                    else if (key === 'failureSound') setFailureSound(val);
                    else if (key === 'criticalSound') setCriticalSound(val);
                    else if (key === 'fumbleSound') setFumbleSound(val);
                  }}
                />
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
                            suggestion.type === 'skill' ? "bg-arcane/20 text-arcane" : 
                            suggestion.type === 'power' ? "bg-ember/20 text-ember" :
                            "bg-gold/20 text-gold"
                          )}>
                            {suggestion.type === 'skill' ? <Sword size={24} /> : 
                             suggestion.type === 'power' ? <Zap size={24} /> :
                             <Star size={24} />}
                          </div>
                          <div>
                            <h4 className="text-2xl font-serif">{suggestion.data.name}</h4>
                            <p className="text-xs font-mono text-parchment/40 uppercase tracking-widest">
                              Sugerido por {suggestion.suggestedByName} • {
                                suggestion.type === 'skill' ? 'Perícia' : 
                                suggestion.type === 'power' ? 'Poder' :
                                'Vantagem/Defeito'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Tipo</span>
                            <p className="text-sm font-medium">{suggestion.data.type}</p>
                          </div>
                          {suggestion.type !== 'trait' && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Custo de Compra</span>
                              <p className="text-sm font-medium">{suggestion.data.purchaseCost} Pontos</p>
                            </div>
                          )}
                          {suggestion.type === 'skill' && (
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
                          )}
                          {suggestion.type === 'power' && (
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
                          {suggestion.type === 'trait' && (
                            <>
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Modificador</span>
                                <p className="text-sm font-medium">{suggestion.data.modifier || 0}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-parchment/30 uppercase tracking-widest">Modifica</span>
                                <p className="text-sm font-medium">{suggestion.data.modifierType || '-'}</p>
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

          {activeTab === 'traits' && (
            <motion.div
              key="traits"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Vantagens e Defeitos</h3>
                  <p className="text-sm text-parchment/40">Gerencie as vantagens e defeitos disponíveis para os personagens.</p>
                </div>
                <button 
                  onClick={() => {
                    if (isCreatingTrait) {
                      setIsCreatingTrait(false);
                      setEditingTraitId(null);
                      setNewTrait({ name: '', description: '', effect: '', modifier: 0, modifierType: 'for', type: 'advantage' });
                    } else {
                      setIsCreatingTrait(true);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold"
                >
                  <Plus size={18} />
                  {isCreatingTrait ? 'Cancelar' : 'Nova Vantagem/Defeito'}
                </button>
              </div>

              {isCreatingTrait && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="glass p-8 rounded-[2.5rem] space-y-6 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Nome</label>
                        <input 
                          type="text" 
                          value={newTrait.name}
                          onChange={e => setNewTrait(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Visão Noturna"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo</label>
                          <select 
                            value={newTrait.type}
                            onChange={e => setNewTrait(prev => ({ ...prev, type: e.target.value as any }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          >
                            <option value="advantage">Vantagem</option>
                            <option value="disadvantage">Defeito</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificador</label>
                          <input 
                            type="number" 
                            value={newTrait.modifier}
                            onChange={e => setNewTrait(prev => ({ ...prev, modifier: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo de Modificador</label>
                        <select 
                          value={newTrait.modifierType}
                          onChange={e => setNewTrait(prev => ({ ...prev, modifierType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        >
                          <optgroup label="Atributos">
                            {attributes.map(attr => (
                              <option key={attr.id} value={attr.id}>{attr.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Talentos">
                            {talents.map(talent => (
                              <option key={talent.id} value={talent.id}>{talent.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Efeito</label>
                        <input 
                          type="text" 
                          value={newTrait.effect}
                          onChange={e => setNewTrait(prev => ({ ...prev, effect: e.target.value }))}
                          placeholder="Ex: +2 em testes de Percepção no escuro"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Descrição</label>
                        <textarea 
                          value={newTrait.description}
                          onChange={e => setNewTrait(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Detalhes sobre a vantagem ou defeito..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors h-24 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleCreateTrait}
                      disabled={!newTrait.name}
                      className="flex items-center gap-2 px-8 py-3 bg-arcane text-obsidian rounded-2xl hover:scale-[1.02] transition-all font-bold disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Save size={18} />
                      {editingTraitId ? 'Salvar Alterações' : 'Criar Vantagem/Defeito'}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {traits.length === 0 ? (
                  <div className="col-span-full glass p-20 rounded-[3rem] text-center border-dashed border-white/10">
                    <Activity size={48} className="mx-auto text-parchment/10 mb-6" />
                    <h4 className="text-xl font-serif mb-2">Nenhuma vantagem ou defeito cadastrado</h4>
                    <p className="text-parchment/40 max-w-xs mx-auto">Crie vantagens e defeitos para que seus jogadores possam usá-los em suas fichas.</p>
                  </div>
                ) : (
                  traits.map((trait) => (
                    <div key={trait.id} className="glass p-6 rounded-[2.5rem] border border-white/10 hover:border-arcane/30 transition-all group relative">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-serif text-glow-arcane mb-1">{trait.name}</h4>
                          <span className={cn(
                            "text-[10px] font-mono uppercase tracking-widest",
                            trait.type === 'advantage' ? "text-arcane" : "text-ember"
                          )}>
                            {trait.type === 'advantage' ? 'Vantagem' : 'Defeito'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditTrait(trait)}
                            className="p-2 text-parchment/20 hover:text-arcane transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTrait(trait.id)}
                            className="p-2 text-parchment/20 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(() => {
                          const effMod = Number(trait.modifier) || 0;
                          return (
                            <div className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-bold",
                              effMod > 0 ? "bg-arcane/10 text-arcane border-arcane/20" : effMod < 0 ? "bg-ember/10 text-ember border-ember/20" : "bg-white/5 text-parchment/60 border-white/10"
                            )}>
                              {effMod > 0 ? '+' : ''}{effMod} {
                                attributes.find(a => a.id === trait.modifierType)?.label || 
                                talents.find(t => t.id === trait.modifierType)?.name || 
                                trait.modifierType
                              }
                            </div>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-parchment/60 mb-4 line-clamp-2">{trait.effect}</p>
                      <p className="text-xs text-parchment/40 line-clamp-3 italic">"{trait.description}"</p>
                    </div>
                  ))
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
              className="relative w-full max-w-2xl glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setEditingSuggestion(null)}
                className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-2xl transition-colors text-parchment/40 hover:text-parchment"
              >
                <X size={24} />
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
                      onBlur={() => setTouched(prev => ({ ...prev, editSuggestionName: true }))}
                      className={cn(
                        "w-full bg-white/5 border rounded-xl px-4 py-3 focus:outline-none transition-colors",
                        touched.editSuggestionName && !editingSuggestion.data.name.trim() ? "border-ember/50 bg-ember/5" : "border-white/10 focus:border-arcane/50"
                      )}
                    />
                    {touched.editSuggestionName && !editingSuggestion.data.name.trim() && (
                      <p className="text-[10px] text-ember font-mono uppercase tracking-widest px-2 mt-1">O nome é obrigatório</p>
                    )}
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
                      ) : editingSuggestion.type === 'power' ? (
                        <>
                          <option value="Físico">Físico</option>
                          <option value="Elemental">Elemental</option>
                          <option value="Defesa">Defesa</option>
                          <option value="Buff">Buff</option>
                          <option value="Debuff">Debuff</option>
                          <option value="Geral">Geral</option>
                        </>
                      ) : (
                        <>
                          <option value="advantage">Vantagem</option>
                          <option value="disadvantage">Defeito</option>
                        </>
                      )}
                    </select>
                  </div>
                  {editingSuggestion.type !== 'trait' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Custo de Compra (XP/Pontos)</label>
                      <input 
                        type="number" 
                        value={editingSuggestion.data.purchaseCost}
                        onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, purchaseCost: parseInt(e.target.value) || 0}})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                      />
                    </div>
                  )}
                  {editingSuggestion.type === 'skill' && (
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
                  )}
                  {editingSuggestion.type === 'power' && (
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
                  {editingSuggestion.type === 'trait' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Modificador</label>
                        <input 
                          type="number" 
                          value={editingSuggestion.data.modifier || 0}
                          onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, modifier: parseInt(e.target.value) || 0}})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest px-2">Tipo de Modificador</label>
                        <select 
                          value={editingSuggestion.data.modifierType}
                          onChange={e => setEditingSuggestion({...editingSuggestion, data: {...editingSuggestion.data, modifierType: e.target.value}})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-arcane/50 transition-colors"
                        >
                          <optgroup label="Atributos">
                            {attributes.map(attr => (
                              <option key={attr.id} value={attr.id}>{attr.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Talentos">
                            {talents.map(talent => (
                              <option key={talent.id} value={talent.id}>{talent.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
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
              className="relative w-full max-w-md glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 shadow-2xl"
            >
              <button 
                onClick={() => setIsGeneratingNPC(false)}
                className="absolute top-6 right-6 p-3 hover:bg-white/10 rounded-2xl transition-colors text-parchment/40 hover:text-parchment"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-arcane/20 rounded-2xl text-arcane">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-2xl font-serif">Gerador de NPC</h3>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Nível do NPC</label>
                    <input 
                      type="number"
                      value={npcConfig.level}
                      onChange={(e) => setNpcConfig(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Qtd. de Vantagens</label>
                    <input 
                      type="number"
                      value={npcConfig.traitCount}
                      onChange={(e) => setNpcConfig(prev => ({ ...prev, traitCount: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>
                </div>

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

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Usar Padrões da Campanha</p>
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-widest">Usa pontos iniciais da sessão</p>
                  </div>
                  <button
                    onClick={() => setNpcConfig(prev => ({ ...prev, useSessionDefaults: !prev.useSessionDefaults }))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      npcConfig.useSessionDefaults ? "bg-arcane" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      npcConfig.useSessionDefaults ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                {!npcConfig.useSessionDefaults && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Pontos de Atributo</label>
                      <input 
                        type="number"
                        value={npcConfig.attributePoints}
                        onChange={(e) => setNpcConfig(prev => ({ ...prev, attributePoints: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-parchment focus:outline-none focus:border-arcane/50"
                      />
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
                  </div>
                )}

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
                className="glass-modal bg-obsidian/85 backdrop-blur-xl w-full max-w-lg p-8 rounded-[3rem] border border-white/25 relative"
              >
                <button 
                  onClick={() => setManagingCharacter(null)}
                  className="absolute top-6 right-6 p-3 glass rounded-2xl hover:bg-white/10 transition-colors text-parchment/40 hover:text-parchment"
                >
                  <X size={24} />
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
              className="glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] w-full max-w-md border border-red-500/20 space-y-6 text-center"
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

      {/* Quick Roll Result Notification */}
      <AnimatePresence>
        {isRolling && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.8, y: 50, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] glass px-8 py-4 rounded-3xl border border-arcane/30 shadow-2xl flex items-center gap-4 overflow-hidden"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
              className="text-arcane"
            >
              <Dice6 size={32} />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-parchment/40 uppercase tracking-widest animate-pulse">Rodando Dados...</span>
              <span className="text-lg font-serif">Aguarde o resultado</span>
            </div>
          </motion.div>
        )}

        {quickRoll && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 50, x: '-50%', scale: 0.9 }}
            className={cn(
              "fixed bottom-24 left-1/2 z-[100] glass px-8 py-5 rounded-[2.5rem] border shadow-2xl flex items-center gap-6 transition-all duration-500",
              quickRoll.isCritical ? "border-gold shadow-[0_0_30px_rgba(255,215,0,0.4)] bg-gold/10" :
              quickRoll.isFumble ? "border-ember shadow-[0_0_30px_rgba(255,68,68,0.4)] bg-ember/10" :
              (quickRoll.success ? "border-arcane/50" : "border-ember/50")
            )}
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest mb-1">{quickRoll.name} • {quickRoll.attr}</span>
              <div className="flex items-baseline gap-3">
                <motion.span 
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "text-3xl font-serif",
                    quickRoll.isCritical ? "text-gold animate-bounce" :
                    quickRoll.isFumble ? "text-ember animate-pulse" :
                    (quickRoll.success ? "text-glow-arcane" : "text-ember")
                  )}
                >
                  {quickRoll.isCritical ? 'CRÍTICO!' : 
                   quickRoll.isFumble ? 'DESASTRE!' : 
                   (quickRoll.success ? 'Sucesso' : 'Falha')}
                </motion.span>
                <span className={cn(
                  "text-sm font-mono bg-white/5 px-2 py-1 rounded-lg border",
                  quickRoll.isCritical ? "text-gold border-gold/30" : 
                  quickRoll.isFumble ? "text-ember border-ember/30" : 
                  "text-parchment/40 border-white/5"
                )}>(d10: {quickRoll.result})</span>
              </div>
            </div>
            
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12 }}
            >
              {quickRoll.isCritical ? (
                <div className="w-12 h-12 bg-gold/20 rounded-2xl flex items-center justify-center text-gold border border-gold/30">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
              ) : quickRoll.isFumble ? (
                <div className="w-12 h-12 bg-ember/20 rounded-2xl flex items-center justify-center text-ember border border-ember/30">
                  <HeartCrack size={24} className="animate-bounce" />
                </div>
              ) : quickRoll.success ? (
                <div className="w-12 h-12 bg-arcane/20 rounded-2xl flex items-center justify-center text-arcane border border-arcane/30">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-ember/20 rounded-2xl flex items-center justify-center text-ember border border-ember/30">
                  <HeartCrack size={24} className="animate-bounce" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {sessionId && (
        <SessionChat 
          sessionId={sessionId} 
          isGM={true}
          senderOverride={{ name: "Mestre", photo: auth.currentUser?.photoURL || "" }}
        />
      )}

      {/* Campaign Quick Notes (Persistent across all campaign screens/tabs) */}
      {sessionId && (
        <QuickNotes 
          targetType="campaign" 
          targetId={sessionId} 
          targetName={session?.name || 'Campanha'} 
          isGM={true}
          isOpen={isGmQuickNotesOpen}
          onOpenChange={setIsGmQuickNotesOpen}
          showFloatingButton={true}
        />
      )}

      {/* Session Cover Image Picker Modal */}
      <ImagePickerModal
        isOpen={isSessionImagePickerOpen}
        onClose={() => setIsSessionImagePickerOpen(false)}
        onConfirm={(url) => {
          setSessionImage(url);
          setIsSessionImagePickerOpen(false);
        }}
        title="Capa da Campanha"
        subtitle="Insira uma URL ou faça upload da imagem de capa"
        confirmText="Definir Capa"
        initialUrl={sessionImage}
      />

      {/* Catalog Item Image Picker Modal */}
      <ImagePickerModal
        isOpen={isCatalogImagePickerOpen}
        onClose={() => setIsCatalogImagePickerOpen(false)}
        onConfirm={(url) => {
          setCatalogItemForm(prev => ({ ...prev, image: url }));
          setIsCatalogImagePickerOpen(false);
        }}
        title="Imagem do Item do Catálogo"
        subtitle="Insira uma URL ou faça upload da imagem do item"
        confirmText="Definir Imagem"
        initialUrl={catalogItemForm.image}
        maxDimension={600}
      />
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
