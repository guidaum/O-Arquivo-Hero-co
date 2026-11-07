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
  Filter,
  Menu,
  ChevronLeft,
  LayoutGrid,
  Check,
  Info,
  UserPlus,
  Search,
  Image as ImageIcon,
  Camera,
  Feather,
  Map as MapIcon,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { cn, evaluateFormula, rollDiceFormula, resolveStatsWithVars, playAudio, getTraitEffectiveModifier, isTraitModifierSameAsEffect, getTraitTargets, getTraitTargetDisplayName, calculateTraitCost } from '../lib/utils';
import { auth, db, doc, getDoc, onSnapshot, setDoc, OperationType, handleFirestoreError, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc } from '../firebase';
import { SoundConfig, DEFAULT_SOUNDS, playSoundEffect, playRollOutcomeSound } from '../lib/soundEngine';
import Inventory from './Inventory';
import QuickNotes from './QuickNotes';
import { ImagePickerModal } from './ImagePickerModal';
import { TraitOriginModal } from './TraitOriginModal';
import { TraitDetailModal } from './TraitDetailModal';
import HealthTrackerWidget from './HealthTrackerWidget';
import CampaignMapsCharacterTab from './CampaignMapsCharacterTab';

const iconMap: Record<string, any> = {
  Shield, Sword, Zap, Flame, Eye, Brain, Heart, Activity, Scroll, Dice6, Sparkles
};

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
    Shield, Sword, Zap, Flame, Eye, Brain, Heart, Activity, Scroll, Dice6, Sparkles, UserPlus, Plus, History, Star, Info, Target, Search, Filter, X
  };
  return icons[name] || Shield;
};

const RollingValue = ({ sides = 20, isDamage = false }: { sides?: number, isDamage?: boolean }) => {
  const [val, setVal] = React.useState(1);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setVal(Math.floor(Math.random() * (isDamage ? 20 : sides)) + 1);
    }, 60);
    return () => clearInterval(interval);
  }, [sides, isDamage]);
  return <>{val}</>;
};


interface CharacterSheetProps {
  characterIdProp?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export default function CharacterSheet({
  characterIdProp,
  isModal = false,
  onClose
}: CharacterSheetProps = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = characterIdProp || searchParams.get('id');
  const fromSessionParam = searchParams.get('fromSession');
  const [isQuickNotesOpen, setIsQuickNotesOpen] = React.useState(false);
  
  const [character, setCharacter] = React.useState<any>(null);
  const [session, setSession] = React.useState<any>(null);
  const [userRole, setUserRole] = React.useState<'player' | 'gm' | null>(null);
  const [availableSessions, setAvailableSessions] = React.useState<any[]>([]);
  const [isJoiningSession, setIsJoiningSession] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const [inventory, setInventory] = React.useState<any[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<any[]>([]);
  const [characterSkills, setCharacterSkills] = React.useState<string[]>([]);
  const [characterPowers, setCharacterPowers] = React.useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = React.useState<any[]>([]);
  const [availablePowers, setAvailablePowers] = React.useState<any[]>([]);
  const [availableTraits, setAvailableTraits] = React.useState<any[]>([]);
  const [characterTraits, setCharacterTraits] = React.useState<string[]>([]);
  const [currentPV, setCurrentPV] = React.useState(0);
  const [tempPV, setTempPV] = React.useState(0);
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
  const [activeCategory, setActiveCategory] = React.useState(() => searchParams.get('tab') === 'maps' ? 'maps' : 'geral');
  const [activeSection, setActiveSection] = React.useState('all');
  const [saveStatus, setSaveStatus] = React.useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = React.useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = React.useState(false);
  const [imagePickerInitialTab, setImagePickerInitialTab] = React.useState<'url' | 'upload' | 'camera'>('url');
  const [selectedTraitAttr, setSelectedTraitAttr] = React.useState<any | null>(null);
  const [isTraitOriginModalOpen, setIsTraitOriginModalOpen] = React.useState(false);
  const [detailTrait, setDetailTrait] = React.useState<any | null>(null);
  const [gmModifiers, setGmModifiers] = React.useState<Record<string, Array<{ id: string; value: number; justification: string; authorId?: string; authorName?: string; createdAt?: string; targetId?: string; isTalent?: boolean }>>>({});
  const [isAddingTrait, setIsAddingTrait] = React.useState(false);
  const [traitSearchTerm, setTraitSearchTerm] = React.useState('');
  const [traitFilterType, setTraitFilterType] = React.useState<'all' | 'advantage' | 'disadvantage'>('all');
  const [activeTraitModalTab, setActiveTraitModalTab] = React.useState<'library' | 'custom'>('library');
  const [customTrait, setCustomTrait] = React.useState({
    name: '',
    type: 'advantage',
    modifier: 1,
    modifierType: 'for',
    effect: '',
    description: ''
  });
  const [gmModifierModal, setGmModifierModal] = React.useState<{
    isOpen: boolean;
    targetId: string;
    targetName: string;
    isTalent: boolean;
  } | null>(null);
  const [gmModValue, setGmModValue] = React.useState<number>(1);
  const [gmModJustification, setGmModJustification] = React.useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
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
  const [activeRollAttr, setActiveRollAttr] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'user' | 'gm'>(() => {
    return (localStorage.getItem('preferredViewMode') as 'user' | 'gm') || 'user';
  });

  // Sync viewMode changes across components (Player Mode vs GM Mode)
  React.useEffect(() => {
    const handleViewModeChange = (e: any) => {
      const newMode = e.detail || localStorage.getItem('preferredViewMode');
      if (newMode && (newMode === 'user' || newMode === 'gm')) {
        setViewMode(newMode);
      }
    };
    window.addEventListener('viewModeChanged', handleViewModeChange);
    window.addEventListener('storage', handleViewModeChange);
    return () => {
      window.removeEventListener('viewModeChanged', handleViewModeChange);
      window.removeEventListener('storage', handleViewModeChange);
    };
  }, []);

  // When viewMode is 'user', the user is playing in player mode, so they see strictly player menus and views
  const isPlayerMode = viewMode === 'user';
  const isGM = !isPlayerMode && (userRole === 'gm' || userRole === 'admin');
  const isOwner = character?.ownerId === auth.currentUser?.uid;
  const canPlayerEdit = isGM || (isOwner && canEditStats);

  const activeSessionId = session?.id || character?.sessionId || fromSessionParam;
  const isGMOfCampaign = !isPlayerMode && Boolean(
    (session && session.gmId === auth.currentUser?.uid) ||
    userRole === 'gm' ||
    userRole === 'admin'
  );

  // If the viewer is the GM of the campaign, their quick notes return notes for that campaign!
  // If the viewer is a player, their quick notes return notes for the selected character.
  const notesTargetType = (isGMOfCampaign && activeSessionId) ? 'campaign' : 'character';
  const notesTargetId = (isGMOfCampaign && activeSessionId) ? activeSessionId : (characterId || character?.id || 'isolated');
  const notesTargetName = (isGMOfCampaign && activeSessionId) ? (session?.name || 'Campanha') : (character?.name || 'Personagem');

  // Sync context with global floating ActionMenu
  React.useEffect(() => {
    if (character) {
      window.dispatchEvent(new CustomEvent('action_menu_context_update', {
        detail: {
          sessionId: activeSessionId || character.sessionId || undefined,
          senderOverride: { name: character.name, photo: character.image },
          isGM: isGMOfCampaign,
          notesTargetType,
          notesTargetId,
          notesTargetName,
          characterContext: { id: characterId || character.id || '', name: character.name }
        }
      }));
    }
  }, [character, activeSessionId, isGMOfCampaign, notesTargetType, notesTargetId, notesTargetName, characterId]);

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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'globalSettings/config');
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
        
        // Fetch session if linked or passed via fromSession
        const effectiveSessionId = data.sessionId || fromSessionParam;
        if (effectiveSessionId) {
          localStorage.setItem('last_active_session_id', effectiveSessionId);
          getDoc(doc(db, 'gameSessions', effectiveSessionId)).then(sessionSnap => {
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
        setCharacterTraits(data.traits || []);
        
        // Initial values if not present
        const charStats = data.stats || {};
        const charStatsMods = data.statsMods || {};
        setStats(charStats);
        setAttributePoints(data.attributePoints || 0);
        setStatsMods(charStatsMods);
        setCanEditStats(data.canEditStats ?? false);
        setTalentMods(data.talentMods || {});
        setGmModifiers(data.gmModifiers || {});

        const getVal = (id: string) => (charStats[id] || 0) + (charStatsMods[id] || 0);
        
        // Use global settings for max PV/ATP if available
        const pvFormula = globalSettings?.pvFormula || '((FOR / 2) + CON) * 10';
        const atpFormula = globalSettings?.atpFormula || '(INT + 3) * 3';
        
        const initialAttrVars: Record<string, number> = {};
        const baseAttrs = globalSettings?.attributes || DEFAULT_ATTRIBUTES;
        baseAttrs.forEach((attr: any) => {
          initialAttrVars[attr.id.toUpperCase()] = getVal(attr.id);
        });

        const initialSkillCategoryCounts: Record<string, number> = {};
        const skillCategories = Object.keys(globalSettings?.skillTypeVars || { 'Luta': '1', 'Mística': '1' });
        const charSkills = data.skills || [];
        
        skillCategories.forEach(cat => {
          const normalizedCat = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
          const count = charSkills.filter((s: any) => s.type === cat).length;
          initialSkillCategoryCounts[normalizedCat] = count;
          if (!normalizedCat.endsWith('S')) {
            initialSkillCategoryCounts[normalizedCat + 'S'] = count;
          } else {
            initialSkillCategoryCounts[normalizedCat.slice(0, -1)] = count;
          }
        });

        const statsForFormula = resolveStatsWithVars({
          ...initialAttrVars,
          ...initialSkillCategoryCounts,
          SKILLS: charSkills.length,
          POWERS: (data.powers || []).length,
        }, globalSettings?.calculationVars);

        const maxPV = evaluateFormula(pvFormula, statsForFormula);
        const maxATP = evaluateFormula(atpFormula, statsForFormula);
        
        setCurrentPV(data.currentPV ?? maxPV);
        setTempPV(data.tempPV ?? data.temporaryHP ?? 0);
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

    const traitsQuery = query(collection(db, 'traits'));
    const unsubscribeTraits = onSnapshot(traitsQuery, (snapshot) => {
      const traitData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableTraits(traitData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'traits');
    });

    const catalogQuery = query(collection(db, 'itemCatalog'));
    const unsubscribeCatalog = onSnapshot(catalogQuery, (snapshot) => {
      setCatalogItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'itemCatalog');
    });

    return () => {
      unsubscribeTalents();
      unsubscribeSkills();
      unsubscribePowers();
      unsubscribeTraits();
      unsubscribeCatalog();
    };
  }, []);

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

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
        tempPV,
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
      setSaveStatus({ type: 'success', message: 'Alterações salvas com sucesso!' });
    } catch (error) {
      setSaveStatus({ type: 'error', message: 'Erro ao salvar alterações.' });
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
      setSaveStatus({ type: 'error', message: 'Pontos de perícia insuficientes!' });
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
      setSaveStatus({ type: 'error', message: 'Pontos de poder insuficientes!' });
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

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setSaveStatus({ type: 'success', message: 'Link da ficha copiado para a área de transferência!' });
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

  const handleEditImage = () => {
    if (!character || !characterId) return;
    
    // Permission check
    const isOwner = character.ownerId === auth.currentUser?.uid;
    const isGM = userRole === 'gm';
    const canEdit = isGM || (isOwner && canEditStats);
    
    if (!canEdit) {
      setSaveStatus({ type: 'error', message: 'Você não tem permissão para editar a imagem deste personagem.' });
      return;
    }

    setIsImagePickerOpen(true);
  };

  const handleConfirmImage = async (newImage: string) => {
    if (!characterId) return;
    try {
      setCharacter(prev => prev ? { ...prev, image: newImage } : prev);
      await updateDoc(doc(db, 'characters', characterId), { image: newImage });
      setSaveStatus({ type: 'success', message: 'Imagem do personagem atualizada com sucesso!' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleAddGMModifier = async () => {
    if (!gmModifierModal || !characterId) return;
    if (!gmModJustification.trim()) {
      setSaveStatus({ type: 'error', message: 'A justificativa do mestre é obrigatória!' });
      return;
    }

    const targetKey = gmModifierModal.targetId.toLowerCase();
    const newMod = {
      id: crypto.randomUUID(),
      value: Number(gmModValue) || 0,
      justification: gmModJustification.trim(),
      authorId: auth.currentUser?.uid || '',
      authorName: auth.currentUser?.displayName || auth.currentUser?.email || 'Mestre',
      createdAt: new Date().toISOString(),
      targetId: targetKey,
      isTalent: gmModifierModal.isTalent
    };

    const currentList = gmModifiers[targetKey] || [];
    const updatedGmModifiers = {
      ...gmModifiers,
      [targetKey]: [...currentList, newMod]
    };

    setGmModifiers(updatedGmModifiers);
    try {
      await updateDoc(doc(db, 'characters', characterId), { gmModifiers: updatedGmModifiers });
      setSaveStatus({ type: 'success', message: 'Modificador do mestre salvo com sucesso!' });
      setGmModifierModal(null);
      setGmModJustification('');
      setGmModValue(1);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleRemoveGMModifier = async (targetId: string, modId: string) => {
    if (!characterId) return;
    const targetKey = targetId.toLowerCase();
    const currentList = gmModifiers[targetKey] || [];
    const updatedList = currentList.filter(m => m.id !== modId);
    const updatedGmModifiers = {
      ...gmModifiers,
      [targetKey]: updatedList
    };

    setGmModifiers(updatedGmModifiers);
    try {
      await updateDoc(doc(db, 'characters', characterId), { gmModifiers: updatedGmModifiers });
      setSaveStatus({ type: 'success', message: 'Modificador do mestre removido.' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleAddTraitToCharacter = async (trait: any) => {
    if (!characterId) return;
    const currentTraits = characterTraits || [];
    const traitId = trait.id || crypto.randomUUID();
    const newTrait = { ...trait, id: traitId };
    const updatedTraits = [...currentTraits, newTrait];
    setCharacterTraits(updatedTraits);
    try {
      await updateDoc(doc(db, 'characters', characterId), { traits: updatedTraits });
      setSaveStatus({ type: 'success', message: `Traço "${trait.name}" adicionado à ficha!` });
      setIsAddingTrait(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const handleCreateCustomTrait = async () => {
    if (!characterId) return;
    if (!customTrait.name.trim()) {
      setSaveStatus({ type: 'error', message: 'O nome do traço é obrigatório!' });
      return;
    }

    const newTrait = {
      id: crypto.randomUUID(),
      name: customTrait.name.trim(),
      type: customTrait.type,
      modifier: Number(customTrait.modifier) || 0,
      modifierType: customTrait.modifierType || 'for',
      effect: customTrait.effect || '',
      description: customTrait.description || '',
      isCustom: true
    };

    await handleAddTraitToCharacter(newTrait);
    setCustomTrait({
      name: '',
      type: 'advantage',
      modifier: 1,
      modifierType: 'for',
      effect: '',
      description: ''
    });
  };

  const handleRemoveTrait = async (traitId: string) => {
    if (!characterId) return;
    const updatedTraits = (characterTraits || []).filter((item: any) => {
      if (typeof item === 'string') return item !== traitId;
      return item.id !== traitId;
    });
    setCharacterTraits(updatedTraits);
    try {
      await updateDoc(doc(db, 'characters', characterId), { traits: updatedTraits });
      setSaveStatus({ type: 'success', message: 'Traço removido da ficha.' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${characterId}`);
    }
  };

  const resolvedTraits = React.useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    const charObjects: any[] = Array.isArray((character as any)?.traitObjects) 
      ? (character as any).traitObjects 
      : [];
    
    const advantages: any[] = Array.isArray((character as any)?.advantages) ? (character as any).advantages : [];
    const disadvantages: any[] = Array.isArray((character as any)?.disadvantages) ? (character as any).disadvantages : [];
    const allEmbeddedObjects = [...charObjects, ...advantages, ...disadvantages];

    const traitMap = new Map<string, any>();
    availableTraits.forEach(t => {
      if (t && t.id) traitMap.set(t.id, t);
      if (t && t.name) traitMap.set(t.name.toLowerCase(), t);
    });

    allEmbeddedObjects.forEach(t => {
      if (t && t.id && !traitMap.has(t.id)) traitMap.set(t.id, t);
      if (t && t.name && !traitMap.has(t.name.toLowerCase())) traitMap.set(t.name.toLowerCase(), t);
    });

    (characterTraits || []).forEach(item => {
      if (!item) return;
      if (typeof item === 'object' && (item as any).id) {
        const objId = (item as any).id;
        if (!seen.has(objId)) {
          seen.add(objId);
          const fromLib = traitMap.get(objId) || {};
          list.push({ ...fromLib, ...item });
        }
      } else if (typeof item === 'string') {
        const found = traitMap.get(item) || traitMap.get(item.toLowerCase());
        const traitId = found?.id || item;
        if (!seen.has(traitId)) {
          seen.add(traitId);
          if (found) {
            list.push(found);
          } else {
            const embedded = allEmbeddedObjects.find(t => t.id === item || t.name === item);
            if (embedded) list.push(embedded);
          }
        }
      }
    });

    allEmbeddedObjects.forEach(t => {
      if (t && t.id && !seen.has(t.id)) {
        seen.add(t.id);
        const fromLib = traitMap.get(t.id) || {};
        list.push({ ...fromLib, ...t });
      }
    });

    return list;
  }, [availableTraits, characterTraits, character]);

  const contributingTraitsByAttr = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    const baseAttrs = globalSettings?.attributes || DEFAULT_ATTRIBUTES;

    resolvedTraits.forEach(trait => {
      const { attrIds } = getTraitTargets(trait, baseAttrs, talents);
      const effMod = getTraitEffectiveModifier(trait);
      attrIds.forEach(attrId => {
        const lower = attrId.toLowerCase();
        if (!map[lower]) map[lower] = [];
        map[lower].push({
          ...trait,
          effectiveMod: effMod
        });
      });
    });
    return map;
  }, [resolvedTraits, globalSettings, talents]);

  const contributingTraitsByTalent = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    const baseAttrs = globalSettings?.attributes || DEFAULT_ATTRIBUTES;

    talents.forEach(talent => {
      const talentIdLower = talent.id.toLowerCase();
      const talentNameLower = (talent.name || '').toLowerCase();
      const compLower = (talent.composition || []).map((c: string) => c.toLowerCase());
      const addedTraitIds = new Set<string>();
      const talentTraits: any[] = [];

      resolvedTraits.forEach(trait => {
        const { attrIds, talentIds } = getTraitTargets(trait, baseAttrs, talents);
        const effMod = getTraitEffectiveModifier(trait);

        // Check if directly targets the talent
        const directlyTargets = talentIds.some(tId => {
          const tLower = tId.toLowerCase();
          return tLower === talentIdLower || tLower === talentNameLower;
        });

        // Check if targets an attribute in the talent's composition
        const compAttrMatch = baseAttrs.find(a => 
          compLower.includes(a.id.toLowerCase()) && 
          attrIds.some(aId => aId.toLowerCase() === a.id.toLowerCase())
        );

        if (directlyTargets && !addedTraitIds.has(trait.id)) {
          addedTraitIds.add(trait.id);
          talentTraits.push({
            ...trait,
            effectiveMod: effMod,
            isDirect: true
          });
        } else if (compAttrMatch && !addedTraitIds.has(trait.id)) {
          addedTraitIds.add(trait.id);
          talentTraits.push({
            ...trait,
            effectiveMod: effMod,
            isDirect: false,
            sourceAttr: compAttrMatch.label || compAttrMatch.id.toUpperCase()
          });
        }
      });

      map[talentIdLower] = talentTraits;
      if (talent.name) {
        map[talentNameLower] = talentTraits;
      }
    });

    return map;
  }, [resolvedTraits, globalSettings, talents]);

  const traitStatsMods = React.useMemo(() => {
    const mods: Record<string, number> = {};
    const baseAttrs = globalSettings?.attributes || DEFAULT_ATTRIBUTES;

    resolvedTraits.forEach(trait => {
      const { attrIds } = getTraitTargets(trait, baseAttrs, talents);
      const effMod = getTraitEffectiveModifier(trait);
      attrIds.forEach(attrId => {
        const idLower = attrId.toLowerCase();
        mods[idLower] = (mods[idLower] || 0) + effMod;

        // Alias original casing without adding a duplicate
        const baseAttr = baseAttrs.find(a => a.id.toLowerCase() === idLower);
        if (baseAttr && baseAttr.id !== idLower) {
          mods[baseAttr.id] = mods[idLower];
        }
      });
    });
    return mods;
  }, [resolvedTraits, globalSettings, talents]);

  const traitTalentMods = React.useMemo(() => {
    const mods: Record<string, number> = {};
    Object.entries(contributingTraitsByTalent).forEach(([key, traitsList]) => {
      // Only direct talent traits apply as direct talent bonuses,
      // because traits on constituent attributes are already reflected in the total attribute values!
      mods[key] = (traitsList as any[])
        .filter(t => t.isDirect !== false)
        .reduce((sum, t) => sum + (Number(t.effectiveMod) || 0), 0);
    });
    return mods;
  }, [contributingTraitsByTalent]);

  const itemStatsMods = React.useMemo(() => {
    const mods: Record<string, number> = {};
    const equippedItems = inventory.filter(item => item.equipped);
    equippedItems.forEach(item => {
      if (item.stats) {
        Object.entries(item.stats).forEach(([stat, value]) => {
          mods[stat] = (mods[stat] || 0) + (Number(value) || 0);
        });
      }
    });
    return mods;
  }, [inventory]);

  const attributes = React.useMemo(() => {
    const baseAttrs = globalSettings?.attributes || DEFAULT_ATTRIBUTES;

    return baseAttrs.map(attr => {
      const val = stats[attr.id] || 0;
      const mod = statsMods[attr.id] || 0;
      const rawTraitMod = traitStatsMods[attr.id.toLowerCase()] ?? traitStatsMods[attr.id] ?? 0;
      const itemMod = itemStatsMods[attr.id] ?? itemStatsMods[attr.id.toLowerCase()] ?? 0;
      const gmMod = (gmModifiers[attr.id.toLowerCase()] || []).reduce((sum, m) => sum + (Number(m.value) || 0), 0);

      // Se o traço e o modificador vêm do mesmo defeito ou vantagem e afetam o mesmo atributo ou talento,
      // o traço deve ser desconsiderado no cálculo do atributo:
      const traitDisregarded = mod !== 0 && rawTraitMod !== 0;
      const traitMod = traitDisregarded ? 0 : rawTraitMod;
      const total = val + mod + traitMod + itemMod + gmMod;

      return {
        ...attr,
        value: val,
        mod,
        traitMod,
        rawTraitMod,
        traitDisregarded,
        itemMod,
        gmMod,
        total
      };
    });
  }, [globalSettings, stats, statsMods, traitStatsMods, itemStatsMods, gmModifiers]);

  const contributingTraitsForSelectedAttr = React.useMemo(() => {
    if (!selectedTraitAttr) return [];
    const targetId = (selectedTraitAttr.id || '').toLowerCase();
    if (selectedTraitAttr.isTalent) {
      return contributingTraitsByTalent[targetId] || [];
    }
    return contributingTraitsByAttr[targetId] || [];
  }, [selectedTraitAttr, contributingTraitsByAttr, contributingTraitsByTalent]);

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

  const handleQuickRoll = (attrLabel: string, attrValue: number, difficulty: 'easy' | 'normal' | 'hard' | 'extreme' = 'normal', diceSides: number = 20) => {
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
      rollingAudioRef.current = null;
    }
    
    const soundCfg: SoundConfig = {
      diceRollSound: session?.diceRollSound || globalSettings?.diceRollSound || DEFAULT_SOUNDS.diceRollSound,
      successSound: session?.successSound || globalSettings?.successSound || DEFAULT_SOUNDS.successSound,
      failureSound: session?.failureSound || globalSettings?.failureSound || DEFAULT_SOUNDS.failureSound,
      criticalSound: session?.criticalSound || globalSettings?.criticalSound || DEFAULT_SOUNDS.criticalSound,
      fumbleSound: session?.fumbleSound || globalSettings?.fumbleSound || DEFAULT_SOUNDS.fumbleSound
    };

    // Play rolling sound (shortened)
    rollingAudioRef.current = playSoundEffect('diceRoll', soundCfg.diceRollSound, 0.4);

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
        try {
          rollingAudioRef.current.pause();
        } catch {}
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
        playRollOutcomeSound('critical', soundCfg, 0.6);
      } else if (isFumble) {
        playRollOutcomeSound('fumble', soundCfg, 0.6);
      } else if (success) {
        playRollOutcomeSound('success', soundCfg, 0.5);
      } else {
        playRollOutcomeSound('failure', soundCfg, 0.5);
      }

      sendRollToChat(`${attrLabel} [${diffLabel}]`, {
        total: roll,
        detail: `1D${diceSides} <= ${target}`,
        rolls: [{ die: `1D${diceSides}`, values: [roll] }]
      }, success);
      
      rollTimeoutRef.current = setTimeout(() => setQuickRoll(null), 5000);
    }, 600);
  };

  const equippedItems = inventory.filter(i => i.equipped);

  const getAttr = (id: string) => {
    const lowerId = id.toLowerCase();
    const attr = attributes.find(a => a.id.toLowerCase() === lowerId);
    if (attr) {
      return attr.total;
    }
    const val = stats[id] ?? stats[lowerId] ?? 0;
    const mod = statsMods[id] ?? statsMods[lowerId] ?? 0;
    const rawTrMod = traitStatsMods[id] ?? traitStatsMods[lowerId] ?? 0;
    const trMod = (mod !== 0 && rawTrMod !== 0) ? 0 : rawTrMod;
    const itMod = itemStatsMods[id] ?? itemStatsMods[lowerId] ?? 0;
    const gmMod = (gmModifiers[lowerId] || []).reduce((sum, m) => sum + (Number(m.value) || 0), 0);
    return val + mod + trMod + itMod + gmMod;
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

  const skillCategoryCounts: Record<string, number> = {};
  const skillCategories = Object.keys(globalSettings?.skillTypeVars || { 'Luta': '1', 'Mística': '1' });
  
  skillCategories.forEach(cat => {
    const normalizedCat = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const count = resolvedSkills.filter(s => s.type === cat).length;
    skillCategoryCounts[normalizedCat] = count;
    if (!normalizedCat.endsWith('S')) {
      skillCategoryCounts[normalizedCat + 'S'] = count;
    } else {
      skillCategoryCounts[normalizedCat.slice(0, -1)] = count;
    }
  });

  const baseStatsForFormula: Record<string, number> = {};
  attributes.forEach(attr => {
    baseStatsForFormula[attr.id.toUpperCase()] = getAttr(attr.id);
  });

  const statsForFormula = resolveStatsWithVars({
    ...baseStatsForFormula,
    ...skillCategoryCounts,
    SKILLS: resolvedSkills.length,
    POWERS: resolvedPowers.length,
  }, globalSettings?.calculationVars);

  const maxPV = evaluateFormula(globalSettings?.pvFormula || '((FOR / 2) + CON) * 10', statsForFormula);
  const maxATP = evaluateFormula(globalSettings?.atpFormula || '(INT + 3) * 3', statsForFormula);

  const soco = evaluateFormula(globalSettings?.socoFormula || 'FOR', statsForFormula);
  const chute = evaluateFormula(globalSettings?.chuteFormula || 'FOR + (FOR / 2)', statsForFormula);
  const en = evaluateFormula(globalSettings?.enFormula || '20 - ((AGI + (PER / 2)) + (LUTA * 2))', statsForFormula);
  const dm = evaluateFormula(globalSettings?.dmFormula || '20 - ((AGI + (PER / 2)) + (MISTICA * 2))', statsForFormula);
  const defesa = evaluateFormula(globalSettings?.defesaFormula || 'CON + (AGI / 2) + (LUTA * 2)', statsForFormula);
  const esquiva = evaluateFormula(globalSettings?.esquivaFormula || '(CON + AGI + (VEL / 2)) + (LUTA * 2)', statsForFormula);

  const sendRollToChat = async (label: string, result: any, success?: boolean) => {
    if (!character?.sessionId || !auth.currentUser) return;

    try {
      const rollData: any = {
        total: result.total,
        formula: result.detail || label,
        details: result.rolls ? result.rolls.map((r: any) => `${r.die}: [${r.values.join(', ')}]`).join(' | ') : '',
        rolls: result.rolls || []
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

  const sendValueToChat = async (label: string, value: any) => {
    if (!character?.sessionId || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'chatMessages'), {
        sessionId: character.sessionId,
        senderId: auth.currentUser.uid,
        senderName: character.name || auth.currentUser.displayName || 'Anônimo',
        senderPhoto: character.image || auth.currentUser.photoURL || '',
        text: `${label}: ${value}`,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending value to chat:', err);
    }
  };

  const handleFormulaRoll = async (label: string, formula: string, sourceItem?: any) => {
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    if (rollingAudioRef.current) {
      rollingAudioRef.current.pause();
      rollingAudioRef.current = null;
    }
    
    const s = session || globalSettings || {};
    const dSound = s.diceRollSound || DEFAULT_SOUNDS.diceRollSound;
    const sSound = s.successSound || DEFAULT_SOUNDS.successSound;

    // Play rolling sound
    rollingAudioRef.current = playSoundEffect('diceRoll', dSound, 0.4);

    if (!formula) return;

    // Ammo consumption logic for weapons
    if (sourceItem && sourceItem.damage) {
      const catalogId = sourceItem.catalogId;
      
      const linkedAmmoInCatalog = catalogItems.filter(i => i.category === 'ammo' && i.relatedWeapons?.includes(catalogId));
      const linkedAmmoInInventory = inventory.filter(i => i.category === 'ammo' && i.relatedWeapons?.includes(catalogId));
      
      const isAmmoRequired = linkedAmmoInCatalog.length > 0 || linkedAmmoInInventory.length > 0;

      if (isAmmoRequired) {
        const compatibleAmmo = inventory.find(i => 
          i.category === 'ammo' && 
          (i.relatedWeapons?.includes(catalogId) || 
           linkedAmmoInCatalog.some(a => a.id === i.catalogId)) && 
          (i.quantity || 1) > 0
        );

        if (!compatibleAmmo) {
          setSaveStatus({ type: 'error', message: `FALHA: Sem munição para ${label}!` });
          if (character.sessionId && auth.currentUser) {
            await addDoc(collection(db, 'chatMessages'), {
              sessionId: character.sessionId,
              senderId: auth.currentUser.uid,
              senderName: character.name || 'Herói',
              senderPhoto: character.image || '',
              text: `⚠️ A arma de ${character.name} (${label}) falhou! Está sem munição.`,
              type: 'system',
              createdAt: new Date().toISOString()
            });
          }
          return;
        }

        // Consume 1 ammo
        try {
          let updatedInventory;
          if ((compatibleAmmo.quantity || 1) > 1) {
            updatedInventory = inventory.map(i => i.id === compatibleAmmo.id ? { ...i, quantity: i.quantity - 1 } : i);
          } else {
            updatedInventory = inventory.filter(i => i.id !== compatibleAmmo.id);
          }

          setInventory(updatedInventory);
          await updateDoc(doc(db, 'characters', characterId!), {
            equipment: updatedInventory
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
    }

    const result = rollDiceFormula(formula, statsForFormula);
    
    setQuickRoll({ 
      result: 0, 
      attr: label,
      type: 'damage',
      rolling: true
    });

    setTimeout(() => {
      // Stop rolling sound
      if (rollingAudioRef.current) {
        try {
          rollingAudioRef.current.pause();
        } catch {}
        rollingAudioRef.current = null;
      }

      setQuickRoll({ 
        result: result.total, 
        attr: label,
        type: 'damage',
        rolling: false
      });

      playSoundEffect('success', sSound, 0.5);

      sendRollToChat(label, result);
      rollTimeoutRef.current = setTimeout(() => setQuickRoll(null), 5000);
    }, 600);
  };

  const calculateDamage = (damage: string) => {
    if (!damage) return '-';
    let result = damage.toUpperCase();
    const statsMap: Record<string, number | string> = {};
    attributes.forEach(attr => {
      statsMap[attr.id.toUpperCase()] = getAttr(attr.id);
    });

    Object.entries(statsMap).forEach(([key, value]) => {
      const regex = new RegExp(key, 'g');
      result = result.replace(regex, value.toString());
    });
    
    // Clean up double signs like +- or ++
    result = result.replace(/\+\+/g, '+').replace(/\+-/g, '-');
    
    return result;
  };

  const getTraitTalentMod = (talent: any): number => {
    if (!talent) return 0;
    return traitTalentMods[talent.id] ?? 
           traitTalentMods[talent.id.toLowerCase()] ?? 
           traitTalentMods[talent.name] ?? 
           traitTalentMods[talent.name.toLowerCase()] ?? 
           0;
  };

  const getTalentBaseValue = (talent: any) => {
    if (!talent?.composition) return 0;
    return talent.composition.reduce((acc: number, attrId: string) => {
      return acc + getAttr(attrId);
    }, 0);
  };

  const calculateTalentValue = (talent: any) => {
    const baseValue = getTalentBaseValue(talent);
    const manualMod = talentMods[talent.id] || 0;
    const rawTraitMod = getTraitTalentMod(talent);
    // Se o traço e o modificador vêm do mesmo defeito ou vantagem e afetam o mesmo talento, o traço é desconsiderado:
    const traitMod = (manualMod !== 0 && rawTraitMod !== 0) ? 0 : rawTraitMod;
    const gmMod = (gmModifiers[talent.id.toLowerCase()] || []).reduce((sum, m) => sum + (Number(m.value) || 0), 0);
    return baseValue + manualMod + traitMod + gmMod;
  };

  const categories = [
    { id: 'geral', label: 'Ficha Geral', icon: Scroll },
    { id: 'inventory', label: 'Inventário', icon: Backpack },
    { id: 'maps', label: 'Mapas da Campanha', icon: MapIcon },
  ];

  const sections = [
    { id: 'all', label: 'Ficha Completa', icon: LayoutGrid, category: 'geral' },
    { id: 'stats', label: 'Atributos', icon: Sword, category: 'geral' },
    { id: 'combat', label: 'Status de Combate', icon: Shield, category: 'geral' },
    { id: 'traits', label: 'Vantagens e Defeitos', icon: Star, category: 'geral' },
    { id: 'skills', label: 'Perícias e Disciplinas', icon: Scroll, category: 'geral' },
    { id: 'powers', label: 'Poderes e Mágias', icon: Flame, category: 'geral' },
    { id: 'talents', label: 'Talentos', icon: Sparkles, category: 'geral' },
    { id: 'inventory', label: 'Inventário', icon: Backpack, category: 'inventory' },
    { id: 'manage_inventory', label: 'Gerenciar Itens', icon: Edit3, category: 'inventory' },
    { id: 'campaign_maps', label: 'Mapas da Campanha', icon: MapIcon, category: 'maps' },
  ];

  const activeSections = sections.filter(s => s.category === activeCategory);

  const renderSidebar = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8 px-2">
        {!isSidebarCollapsed && <h3 className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Navegação</h3>}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex p-2 hover:bg-white/5 rounded-lg transition-colors text-parchment/40 hover:text-parchment"
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <button 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors text-parchment/40 hover:text-parchment"
        >
          <X size={20} />
        </button>
      </div>

      {/* Category Switcher in Sidebar */}
      <div className={cn("grid gap-2 mb-6", isSidebarCollapsed ? "grid-cols-1" : "grid-cols-2")}>
        {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                const firstSection = sections.find(s => s.category === cat.id);
                if (firstSection) setActiveSection(firstSection.id);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 rounded-2xl border transition-all",
                activeCategory === cat.id 
                  ? "bg-arcane/10 border-arcane/30 text-arcane shadow-lg shadow-arcane/5" 
                  : "bg-white/5 border-white/10 text-parchment/40 hover:text-parchment hover:bg-white/10"
              )}
              title={cat.label}
            >
              <cat.icon size={isSidebarCollapsed ? 20 : 18} />
              <span className={cn(
                "text-[9px] font-mono uppercase tracking-tighter transition-all duration-300 overflow-hidden",
                isSidebarCollapsed ? "opacity-0 h-0" : "opacity-100 h-auto"
              )}>
                {cat.label}
              </span>
            </button>
        ))}
      </div>

      <div className="h-px bg-white/5 mb-6" />

      <nav className="space-y-2">
        {activeSections.map(section => (
          <button
            key={section.id}
            onClick={() => {
              setActiveSection(section.id);
              if (window.innerWidth < 1024) setIsMobileSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative",
              activeSection === section.id 
                ? "bg-arcane/10 text-arcane border border-arcane/20" 
                : "text-parchment/60 hover:text-parchment hover:bg-white/5"
            )}
          >
            <section.icon size={20} className={cn(
              "shrink-0 transition-transform group-hover:scale-110",
              activeSection === section.id && "text-arcane"
            )} />
            <span className={cn(
              "font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300",
              isSidebarCollapsed && window.innerWidth >= 1024 ? "opacity-0 w-0 ml-0" : "opacity-100 w-auto ml-0"
            )}>
              {section.label}
            </span>
            {activeSection === section.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-arcane rounded-r-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );

  const isAll = activeSection === 'all';

  const sheetContent = (
    <div className={cn("flex flex-col lg:flex-row gap-6 lg:gap-10 relative", isModal ? "p-3 sm:p-5" : "min-h-screen")}>
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
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:block sticky top-24 h-[calc(100vh-120px)] transition-all duration-300 shrink-0",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="glass p-4 rounded-3xl border border-white/10 h-full">
          {renderSidebar()}
        </div>
      </aside>

      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-50 w-12 h-12 bg-arcane text-obsidian rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border border-arcane/20"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-72 bg-obsidian border-r border-white/10 z-[70] p-6 lg:hidden"
            >
              {renderSidebar()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 space-y-10 pb-32 lg:pb-12">
        {/* Category Navigation Bar (Horizontal Tabs) */}
        <div className="flex items-center gap-6 border-b border-white/10 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                const firstSection = sections.find(s => s.category === cat.id);
                if (firstSection) setActiveSection(firstSection.id);
              }}
              className={cn(
                "pb-4 px-2 text-xs sm:text-sm font-mono uppercase tracking-widest transition-all relative flex items-center gap-2 shrink-0",
                activeCategory === cat.id 
                  ? "text-arcane" 
                  : "text-parchment/40 hover:text-parchment"
              )}
            >
              <cat.icon size={16} />
              {cat.label}
              {activeCategory === cat.id && (
                <motion.div 
                  layoutId="activeCategory"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-arcane"
                />
              )}
            </button>
          ))}
        </div>

        {/* Mobile Section Navigation Bar */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {activeSections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest border transition-all shrink-0",
                activeSection === section.id 
                  ? "bg-arcane/20 border-arcane/30 text-arcane" 
                  : "bg-white/5 border-white/10 text-parchment/40"
              )}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Character Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 text-center sm:text-left">
          <div className="relative shrink-0">
            <div 
              className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden border-2 border-white/10 p-1 group cursor-pointer"
              onClick={() => {
                setImagePickerInitialTab('url');
                setIsImagePickerOpen(true);
              }}
              title="Alterar retrato do personagem"
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
            {/* Quick Camera Capture Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImagePickerInitialTab('camera');
                setIsImagePickerOpen(true);
              }}
              className="absolute -bottom-1 -right-1 p-2 rounded-2xl bg-obsidian border border-arcane/40 text-arcane hover:bg-arcane hover:text-obsidian hover:scale-110 active:scale-95 transition-all shadow-xl z-20 cursor-pointer"
              title="Tirar foto com a câmera do dispositivo"
            >
              <Camera size={15} />
            </button>
          </div>
          <div className="flex flex-col items-center sm:items-start w-full">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-2 w-full">
              <h2 className="text-3xl sm:text-5xl font-serif text-glow-arcane leading-tight break-words max-w-full">{character.name}</h2>
              <span className="shrink-0 px-3 py-1 glass-arcane text-arcane text-[10px] font-mono uppercase tracking-widest rounded-full">Nível {character.level}</span>
            </div>
            <div className="flex items-center gap-2 text-parchment/40 font-mono text-xs sm:text-sm uppercase tracking-widest">
              {(() => {
                const Icon = iconMap[character.icon] || Shield;
                return <Icon size={14} />;
              })()}
              <span>{character.class}</span>
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
              <div 
                onClick={() => {
                  setActiveCategory('geral');
                  setActiveSection('combat');
                  setTimeout(() => {
                    const el = document.getElementById('health-tracker-widget-container');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 50);
                }}
                className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                title="Clique para abrir o Rastreador de Vida (PV) e Combate"
              >
                <Heart size={16} className={cn(
                  currentPV <= 0 
                    ? "text-red-500 animate-pulse fill-red-500" 
                    : currentPV <= maxPV * 0.25 
                      ? "text-rose-500 animate-bounce fill-rose-500" 
                      : "text-ember"
                )} />
                <span className={cn(
                  "text-base sm:text-lg font-serif font-bold",
                  currentPV <= maxPV * 0.25 ? "text-rose-400" : ""
                )}>
                  {currentPV} / {maxPV}
                  {tempPV > 0 && <span className="text-cyan-400 text-xs font-mono ml-1 font-semibold">(+{tempPV} Temp)</span>}
                  <span className="text-[10px] text-parchment/40 font-mono ml-1">PV</span>
                </span>
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
                <span className="text-base sm:text-lg font-serif">{character.money || 0} <span className="text-[10px] text-parchment/40 font-mono">MO</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-3 mt-4 lg:mt-0">
          <button 
            type="button"
            onClick={() => setIsQuickNotesOpen(true)}
            className="p-3 glass rounded-2xl hover:bg-white/10 transition-colors text-parchment/60 hover:text-gold cursor-pointer"
            title={isGMOfCampaign && activeSessionId ? `Anotações Rápidas da Campanha (${notesTargetName})` : `Anotações Rápidas de ${notesTargetName}`}
          >
            <Feather size={20} />
          </button>
          <button 
            onClick={() => navigate(`/journal?characterId=${characterId}`)}
            className="p-3 glass rounded-2xl hover:bg-white/10 transition-colors text-parchment/60 hover:text-arcane"
            title="Abrir Diário do Personagem"
          >
            <BookOpen size={20} />
          </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {activeCategory === 'geral' ? (
          <>
            {/* Left Column: Attributes & Combat Status */}
            <div className={cn(
              "space-y-10",
              isAll ? "lg:col-span-4" : "lg:col-span-12",
              !isAll && activeSection !== 'stats' && activeSection !== 'combat' && "hidden"
            )}>
              <section className={cn("space-y-4", !isAll && activeSection !== 'stats' && "hidden")}>
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
                      value={character.name || ''}
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
                      value={character.class || ''}
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
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">URL da Imagem</label>
                  {canPlayerEdit && (
                    <button
                      type="button"
                      onClick={handleEditImage}
                      className="text-[10px] font-mono text-arcane hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ImageIcon size={12} />
                      Galeria / Upload
                    </button>
                  )}
                </div>
                {canPlayerEdit ? (
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={character.image || ''}
                      onChange={(e) => {
                        const newImage = e.target.value;
                        setCharacter({ ...character, image: newImage });
                        handleSave({ image: newImage });
                      }}
                      placeholder="https://..."
                      className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-[10px] font-mono text-parchment focus:outline-none focus:border-arcane/50"
                    />
                    <button
                      type="button"
                      onClick={handleEditImage}
                      className="px-2.5 py-1 bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 rounded text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <ImageIcon size={12} />
                      Alterar
                    </button>
                  </div>
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
                  onClick={() => {
                    setSelectedTraitAttr(attr);
                    setIsTraitOriginModalOpen(true);
                  }}
                  className="glass p-3 sm:p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all border border-white/10 hover:border-arcane/30 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div className={cn("p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:border-arcane/40 transition-colors shrink-0", attr.color)}>
                      {React.createElement(getIcon(attr.icon), { size: 20 })}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif text-base sm:text-lg font-bold group-hover:text-arcane transition-colors truncate">{attr.label}</span>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase">({attr.id.toUpperCase()})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTraitAttr(attr);
                          setIsTraitOriginModalOpen(true);
                        }}
                        className="text-[10px] font-mono text-arcane/70 hover:text-arcane flex items-center gap-1 hover:underline cursor-pointer transition-colors mt-0.5"
                        title="Ver Composição Detalhada"
                      >
                        <Info size={11} />
                        <span>Ver Composição</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <AnimatePresence mode="wait">
                      {activeRollAttr === attr.id ? (
                        <motion.div 
                          key="diffs"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex gap-1.5 sm:gap-2 items-center"
                        >
                          {[
                            { id: 'easy', label: 'F', color: 'hover:text-green-400', title: `Fácil (+${globalSettings?.diffEasyMod ?? 2})` },
                            { id: 'normal', label: 'N', color: 'hover:text-arcane', title: 'Normal' },
                            { id: 'hard', label: 'D', color: 'hover:text-orange-400', title: `Difícil (1/${globalSettings?.diffHardDiv ?? 2})` },
                            { id: 'extreme', label: 'E', color: 'hover:text-ember', title: `Extremo (1/${globalSettings?.diffExtremeDiv ?? 5})` },
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickRoll(attr.label, getAttr(attr.id), d.id as any, 10);
                                setActiveRollAttr(null);
                              }}
                              className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg glass text-[10px] font-bold transition-colors cursor-pointer", d.color)}
                              title={d.title}
                            >
                              {d.label}
                            </button>
                          ))}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRollAttr(null);
                            }}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg glass text-parchment/20 hover:text-ember transition-colors ml-1 pl-1 border-l border-white/10 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </motion.div>
                      ) : (
                        <motion.button 
                          key="dice"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRollAttr(attr.id);
                          }}
                          className="p-2 hover:bg-arcane/20 rounded-xl text-parchment/40 hover:text-arcane transition-colors cursor-pointer"
                          title="Rolar Teste com Dificuldade"
                        >
                          <Dice6 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {isGM && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGmModifierModal({
                            isOpen: true,
                            targetId: attr.id,
                            targetName: attr.label,
                            isTalent: false
                          });
                          setGmModValue(1);
                          setGmModJustification('');
                        }}
                        className="p-1.5 sm:p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/35 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-mono shadow-sm"
                        title="Adicionar Modificador do Mestre neste Atributo"
                      >
                        <ShieldAlert size={14} />
                        <span className="hidden sm:inline font-bold">GM</span>
                      </button>
                    )}

                    {/* ONLY TOTAL BADGE WITH COMPOSITION MODAL TRIGGER */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTraitAttr(attr);
                        setIsTraitOriginModalOpen(true);
                      }}
                      className="flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-arcane/15 border border-arcane/40 hover:bg-arcane/25 hover:border-arcane transition-all cursor-pointer group/total shadow-sm shadow-arcane/10"
                      title="Valor Total do Atributo (Clique para ver a Modal de Composição)"
                    >
                      <div className="flex flex-col items-end">
                        <span className="text-xl sm:text-2xl font-serif font-bold text-glow-arcane text-parchment leading-none group-hover/total:scale-105 transition-transform">
                          {attr.total}
                        </span>
                        <span className="text-[8px] font-mono uppercase tracking-widest text-arcane font-bold">TOTAL</span>
                      </div>
                      <ChevronRight size={14} className="text-arcane/60 group-hover/total:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Combat Status Calculations */}
          <section className={cn("space-y-4", !isAll && activeSection !== 'combat' && "hidden")}>
            <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest px-4">Status de Combate</h3>
            <div className="glass p-6 rounded-3xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 group relative">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Soco</p>
                    <button 
                      onClick={() => sendValueToChat('Soco', soco)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-arcane/20 rounded transition-all text-parchment/40 hover:text-arcane"
                      title="Compartilhar no Chat"
                    >
                      <Share2 size={12} />
                    </button>
                  </div>
                  <p className="text-xl font-serif text-ember">{soco}</p>
                </div>
                <div className="space-y-1 group relative">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Chute</p>
                    <button 
                      onClick={() => sendValueToChat('Chute', chute)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-arcane/20 rounded transition-all text-parchment/40 hover:text-arcane"
                      title="Compartilhar no Chat"
                    >
                      <Share2 size={12} />
                    </button>
                  </div>
                  <p className="text-xl font-serif text-ember">{chute}</p>
                </div>

                {/* E/N (Esq. Nat.) */}
                <div className="space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">E/N (Esq. Nat.)</p>
                    <AnimatePresence mode="wait">
                      {activeRollAttr === 'en_combat' ? (
                        <motion.div 
                          key="diffs"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex gap-1 items-center bg-obsidian/90 backdrop-blur-md rounded-lg p-1 z-10 absolute right-0 -top-1 border border-white/10 shadow-xl"
                        >
                          {[
                            { id: 'easy', label: 'F', color: 'hover:text-green-400' },
                            { id: 'normal', label: 'N', color: 'hover:text-arcane' },
                            { id: 'hard', label: 'D', color: 'hover:text-orange-400' },
                            { id: 'extreme', label: 'E', color: 'hover:text-ember' },
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickRoll('E/N (Esq. Nat.)', en, d.id as any, 20);
                                setActiveRollAttr(null);
                              }}
                              className={cn("w-6 h-6 rounded bg-white/5 text-[9px] font-bold transition-colors", d.color)}
                            >
                              {d.label}
                            </button>
                          ))}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRollAttr(null);
                            }} 
                            className="w-6 h-6 rounded bg-white/5 text-ember hover:bg-ember/10 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </motion.div>
                      ) : (
                        <button 
                          onClick={() => setActiveRollAttr('en_combat')}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-arcane/20 rounded transition-all text-parchment/40 hover:text-arcane"
                        >
                          <Dice6 size={12} />
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-xl font-serif text-arcane">{en}</p>
                </div>

                {/* D/M */}
                <div className="space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">D/M</p>
                    <AnimatePresence mode="wait">
                      {activeRollAttr === 'dm_combat' ? (
                        <motion.div 
                          key="diffs"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex gap-1 items-center bg-obsidian/90 backdrop-blur-md rounded-lg p-1 z-10 absolute right-0 -top-1 border border-white/10 shadow-xl"
                        >
                          {[
                            { id: 'easy', label: 'F', color: 'hover:text-green-400' },
                            { id: 'normal', label: 'N', color: 'hover:text-arcane' },
                            { id: 'hard', label: 'D', color: 'hover:text-orange-400' },
                            { id: 'extreme', label: 'E', color: 'hover:text-ember' },
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickRoll('D/M', dm, d.id as any, 20);
                                setActiveRollAttr(null);
                              }}
                              className={cn("w-6 h-6 rounded bg-white/5 text-[9px] font-bold transition-colors", d.color)}
                            >
                              {d.label}
                            </button>
                          ))}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRollAttr(null);
                            }} 
                            className="w-6 h-6 rounded bg-white/5 text-ember hover:bg-ember/10 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </motion.div>
                      ) : (
                        <button 
                          onClick={() => setActiveRollAttr('dm_combat')}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-arcane/20 rounded transition-all text-parchment/40 hover:text-arcane"
                        >
                          <Dice6 size={12} />
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-xl font-serif text-gold">{dm}</p>
                </div>

                {/* Defesa */}
                <div className="space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Defesa</p>
                    <AnimatePresence mode="wait">
                      {activeRollAttr === 'defesa_combat' ? (
                        <motion.div 
                          key="diffs"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex gap-1 items-center bg-obsidian/90 backdrop-blur-md rounded-lg p-1 z-10 absolute right-0 -top-1 border border-white/10 shadow-xl"
                        >
                          {[
                            { id: 'easy', label: 'F', color: 'hover:text-green-400' },
                            { id: 'normal', label: 'N', color: 'hover:text-arcane' },
                            { id: 'hard', label: 'D', color: 'hover:text-orange-400' },
                            { id: 'extreme', label: 'E', color: 'hover:text-ember' },
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickRoll('Defesa', defesa, d.id as any, 20);
                                setActiveRollAttr(null);
                              }}
                              className={cn("w-6 h-6 rounded bg-white/5 text-[9px] font-bold transition-colors", d.color)}
                            >
                              {d.label}
                            </button>
                          ))}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRollAttr(null);
                            }} 
                            className="w-6 h-6 rounded bg-white/5 text-ember hover:bg-ember/10 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </motion.div>
                      ) : (
                        <button 
                          onClick={() => setActiveRollAttr('defesa_combat')}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-arcane/20 rounded transition-all text-parchment/40 hover:text-arcane"
                        >
                          <Dice6 size={12} />
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-xl font-serif text-arcane">{defesa}</p>
                </div>

                {/* Esquiva */}
                <div className="space-y-1 relative group">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Esquiva</p>
                    <AnimatePresence mode="wait">
                      {activeRollAttr === 'esquiva_combat' ? (
                        <motion.div 
                          key="diffs"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex gap-1 items-center bg-obsidian/90 backdrop-blur-md rounded-lg p-1 z-10 absolute right-0 -top-1 border border-white/10 shadow-xl"
                        >
                          {[
                            { id: 'easy', label: 'F', color: 'hover:text-green-400' },
                            { id: 'normal', label: 'N', color: 'hover:text-arcane' },
                            { id: 'hard', label: 'D', color: 'hover:text-orange-400' },
                            { id: 'extreme', label: 'E', color: 'hover:text-ember' },
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickRoll('Esquiva', esquiva, d.id as any, 20);
                                setActiveRollAttr(null);
                              }}
                              className={cn("w-6 h-6 rounded bg-white/5 text-[9px] font-bold transition-colors", d.color)}
                            >
                              {d.label}
                            </button>
                          ))}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRollAttr(null);
                            }} 
                            className="w-6 h-6 rounded bg-white/5 text-ember hover:bg-ember/10 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </motion.div>
                      ) : (
                        <button 
                          onClick={() => setActiveRollAttr('esquiva_combat')}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-arcane/20 rounded transition-all text-parchment/40 hover:text-arcane"
                        >
                          <Dice6 size={12} />
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-xl font-serif text-arcane">{esquiva}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Equipamentos com Rolagem */}
          {equippedItems.some(item => item.damage) && (
            <section className={cn("space-y-4 pt-4", !isAll && activeSection !== 'combat' && "hidden")}>
              <div className="flex items-center justify-between px-4">
                <h3 className="text-xs font-mono text-parchment/40 uppercase tracking-widest">Ataques e Equipamentos</h3>
                <Sword size={14} className="text-ember/40" />
              </div>
              <div className="glass p-5 rounded-[2rem] border border-white/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {equippedItems.filter(item => item.damage).map((item) => (
                    <motion.div 
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      className="glass p-4 rounded-2xl border border-white/5 hover:border-arcane/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 max-w-[70%]">
                          <p className="text-[10px] text-parchment/60 font-mono uppercase tracking-wider truncate" title={item.name}>{item.name}</p>
                        </div>
                        <button 
                          onClick={() => handleFormulaRoll(item.name, item.damage, item)}
                          className="p-1.5 bg-arcane/10 hover:bg-arcane/20 rounded-lg text-arcane transition-colors"
                          title="Rolar Dano"
                        >
                          <Dice6 size={14} />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-serif text-ember">{item.damage}</p>
                        <span className="text-[10px] text-parchment/20 font-mono uppercase tracking-widest">Dano</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Middle Column: Status Sliders & Perícias */}
        <div className={cn(
          isAll ? "lg:col-span-5" : "lg:col-span-12",
          !isAll && activeSection !== 'combat' && activeSection !== 'skills' && activeSection !== 'powers' && activeSection !== 'talents' && activeSection !== 'traits' && "hidden"
        )}>
          {/* Status Sliders */}
          <section className={cn("flex flex-col gap-1 mb-4", !isAll && activeSection !== 'combat' && "hidden")}>
            <div id="health-tracker-widget-container" className="mb-[10px]">
              <HealthTrackerWidget
                currentPV={currentPV}
                maxPV={maxPV}
                tempPV={tempPV}
                onUpdatePV={(val) => {
                  setCurrentPV(val);
                  handleSave({ currentPV: val });
                }}
                onUpdateTempPV={(val) => {
                  setTempPV(val);
                  handleSave({ tempPV: val });
                }}
                disabled={false}
              />
            </div>

            <div className="glass p-6 rounded-[2.5rem] space-y-4 mb-[10px]">
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
                value={currentATP ?? 0} 
                onChange={(e) => setCurrentATP(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-arcane"
              />
            </div>

            <div className="glass p-6 rounded-[2.5rem] space-y-4 mb-[10px]">
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
                  value={protecao ?? 0} 
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

            <div className="glass p-6 rounded-[2.5rem] space-y-4 mb-[10px]">
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
                value={sanidade ?? 7} 
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
                value={despertar ?? 0} 
                onChange={(e) => setDespertar(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-arcane"
              />
            </div>
          </section>

          {/* Perícias & Disciplinas */}
          <section className={cn("space-y-6 mb-4", !isAll && activeSection !== 'skills' && "hidden")}>
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
                      className="absolute top-2 right-2 p-1 glass rounded-xl opacity-0 group-hover:opacity-100 hover:bg-ember/20 hover:text-ember transition-all shadow-lg"
                    >
                      <X size={16} />
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
                      {skill.damage && (
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Dano</p>
                            <p className="text-base font-serif text-ember">{calculateDamage(skill.damage)}</p>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFormulaRoll(skill.name, skill.damage);
                            }}
                            className="p-2 hover:bg-ember/20 rounded-lg text-parchment/40 hover:text-ember transition-colors"
                            title="Rolar Dano"
                          >
                            <Sword size={18} />
                          </button>
                        </div>
                      )}
                      {skill.difficultyFormula && (
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Teste</p>
                            <p className="text-base font-serif text-gold">{evaluateFormula(skill.difficultyFormula, statsForFormula)}</p>
                          </div>
                          <div className="relative">
                            <AnimatePresence mode="wait">
                              {activeRollAttr === skill.id ? (
                                <motion.div 
                                  key="diffs"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="absolute right-0 bottom-full mb-2 flex gap-2 glass p-1.5 rounded-xl border border-white/10 z-10"
                                >
                                  {[
                                    { id: 'easy', label: 'F', color: 'hover:text-green-400', title: `Fácil (+${globalSettings?.diffEasyMod ?? 2})` },
                                    { id: 'normal', label: 'N', color: 'hover:text-arcane', title: 'Normal' },
                                    { id: 'hard', label: 'D', color: 'hover:text-orange-400', title: `Difícil (1/${globalSettings?.diffHardDiv ?? 2})` },
                                    { id: 'extreme', label: 'E', color: 'hover:text-ember', title: `Extremo (1/${globalSettings?.diffExtremeDiv ?? 5})` },
                                  ].map(d => (
                                    <button
                                      key={d.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleQuickRoll(skill.name, evaluateFormula(skill.difficultyFormula, statsForFormula), d.id as any);
                                        setActiveRollAttr(null);
                                      }}
                                      className={cn("w-7 h-7 rounded-lg glass text-[10px] font-bold transition-colors", d.color)}
                                      title={d.title}
                                    >
                                      {d.label}
                                    </button>
                                  ))}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRollAttr(null);
                                    }}
                                    className="w-7 h-7 rounded-lg glass text-parchment/20 hover:text-ember transition-colors ml-2 pl-2 border-l border-white/10"
                                  >
                                    <X size={12} />
                                  </button>
                                </motion.div>
                              ) : (
                                <motion.button 
                                  key="dice"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRollAttr(skill.id);
                                  }}
                                  className="p-2 hover:bg-arcane/20 rounded-lg text-parchment/40 hover:text-arcane transition-colors"
                                  title="Rolar Teste"
                                >
                                  <Brain size={18} />
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </div>
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
            </div>
          </section>

          {/* Vantagens & Defeitos Section */}
          <section className={cn("space-y-6 mb-4", !isAll && activeSection !== 'traits' && "hidden")}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-serif flex items-center gap-3">
                <Star className="text-gold" size={24} />
                Vantagens e Defeitos
              </h3>
              {canPlayerEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setTraitSearchTerm('');
                    setTraitFilterType('all');
                    setActiveTraitModalTab('library');
                    setIsAddingTrait(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-arcane/15 hover:bg-arcane/25 text-arcane border border-arcane/30 text-xs font-mono uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm shadow-arcane/10 font-bold"
                  title="Adicionar Vantagem ou Defeito na ficha"
                >
                  <Plus size={16} />
                  <span>Adicionar Traço</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resolvedTraits.map((trait, idx) => {
                const effMod = getTraitEffectiveModifier(trait);
                const isDisadvantage = trait.type === 'disadvantage' || trait.type === 'defeito' || trait.type === 'desvantagem';
                const targetName = getTraitTargetDisplayName(trait.modifierType, globalSettings?.attributes || DEFAULT_ATTRIBUTES, talents);
                return (
                  <motion.div
                    key={trait.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailTrait(trait)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailTrait(trait);
                      }
                    }}
                    className={cn(
                      "glass p-5 rounded-3xl border transition-all group cursor-pointer relative",
                      !isDisadvantage 
                        ? "border-arcane/20 hover:border-arcane/50 hover:bg-arcane/[0.04]" 
                        : "border-ember/20 hover:border-ember/50 hover:bg-ember/[0.04]"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <h5 className={cn(
                          "font-serif text-lg group-hover:text-glow-arcane transition-colors truncate",
                          !isDisadvantage ? "text-arcane" : "text-ember"
                        )}>
                          {trait.name}
                        </h5>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">
                          {isDisadvantage ? 'Defeito' : 'Vantagem'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className={cn(
                          "px-3 py-1 rounded-lg font-serif text-xl border",
                          effMod > 0 ? "bg-arcane/10 text-arcane border-arcane/20" : effMod < 0 ? "bg-ember/10 text-ember border-ember/20" : "bg-white/5 text-parchment/60 border-white/10"
                        )}>
                          {effMod > 0 ? `+${effMod}` : effMod}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailTrait(trait);
                          }}
                          className="p-1.5 rounded-full hover:bg-white/15 text-parchment/40 hover:text-arcane transition-all cursor-pointer"
                          title="Ver detalhes do traço"
                        >
                          <Info size={16} />
                        </button>
                        {canPlayerEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTrait(trait.id);
                            }}
                            className="p-1.5 rounded-full hover:bg-rose-500/20 text-parchment/40 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remover este traço da ficha"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-parchment/60 mb-2 line-clamp-2 leading-relaxed">{trait.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono text-parchment/60">
                      <span className="truncate pr-2 max-w-[55%]">Efeito: {trait.effect}</span>
                      <span className="shrink-0 flex items-center gap-1 font-sans font-medium text-parchment/80">
                        <Target size={11} className={!isDisadvantage ? "text-arcane" : "text-ember"} />
                        {targetName}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {resolvedTraits.length === 0 && (
                <div className="col-span-full text-center py-10 glass rounded-3xl border border-dashed border-white/10">
                  <p className="text-sm text-parchment/20 italic">Nenhuma vantagem ou defeito selecionado</p>
                </div>
              )}
            </div>
          </section>

          {/* Poderes e Mágias Section */}
          <section className={cn("space-y-6 mb-4", !isAll && activeSection !== 'powers' && "hidden")}>
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
                      className="absolute top-2 right-2 p-1 glass rounded-xl opacity-0 group-hover:opacity-100 hover:bg-ember/20 hover:text-ember transition-all shadow-lg"
                    >
                      <X size={16} />
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
                      {power.effect && (
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Efeito</p>
                            <p className="text-base font-serif text-ember">{calculateDamage(power.effect)}</p>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFormulaRoll(power.name, power.effect);
                            }}
                            className="p-2 hover:bg-ember/20 rounded-lg text-parchment/40 hover:text-ember transition-colors"
                            title="Rolar Efeito"
                          >
                            <Zap size={18} />
                          </button>
                        </div>
                      )}
                      {power.difficultyFormula && (
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-[10px] text-parchment/40 font-mono uppercase tracking-wider">Teste</p>
                            <p className="text-base font-serif text-arcane">{evaluateFormula(power.difficultyFormula, statsForFormula)}</p>
                          </div>
                          <div className="relative">
                            <AnimatePresence mode="wait">
                              {activeRollAttr === power.id ? (
                                <motion.div 
                                  key="diffs"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="absolute right-0 bottom-full mb-2 flex gap-2 glass p-1.5 rounded-xl border border-white/10 z-10"
                                >
                                  {[
                                    { id: 'easy', label: 'F', color: 'hover:text-green-400', title: `Fácil (+${globalSettings?.diffEasyMod ?? 2})` },
                                    { id: 'normal', label: 'N', color: 'hover:text-arcane', title: 'Normal' },
                                    { id: 'hard', label: 'D', color: 'hover:text-orange-400', title: `Difícil (1/${globalSettings?.diffHardDiv ?? 2})` },
                                    { id: 'extreme', label: 'E', color: 'hover:text-ember', title: `Extremo (1/${globalSettings?.diffExtremeDiv ?? 5})` },
                                  ].map(d => (
                                    <button
                                      key={d.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleQuickRoll(power.name, evaluateFormula(power.difficultyFormula, statsForFormula), d.id as any);
                                        setActiveRollAttr(null);
                                      }}
                                      className={cn("w-7 h-7 rounded-lg glass text-[10px] font-bold transition-colors", d.color)}
                                      title={d.title}
                                    >
                                      {d.label}
                                    </button>
                                  ))}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRollAttr(null);
                                    }}
                                    className="w-7 h-7 rounded-lg glass text-parchment/20 hover:text-ember transition-colors ml-2 pl-2 border-l border-white/10"
                                  >
                                    <X size={12} />
                                  </button>
                                </motion.div>
                              ) : (
                                <motion.button 
                                  key="dice"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRollAttr(power.id);
                                  }}
                                  className="p-2 hover:bg-arcane/20 rounded-lg text-parchment/40 hover:text-arcane transition-colors"
                                  title="Rolar Teste"
                                >
                                  <Brain size={18} />
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </div>
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
            <section className={cn("space-y-6 mb-4", !isAll && activeSection !== 'talents' && "hidden")}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-serif flex items-center gap-3">
                  <Sparkles className="text-gold" size={24} />
                  Talentos da Campanha
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {talents.map((talent, idx) => {
                  const baseValue = getTalentBaseValue(talent);
                  const traitMod = getTraitTalentMod(talent);
                  const manualMod = talentMods[talent.id] || 0;
                  const totalValue = calculateTalentValue(talent);
                  
                  return (
                    <motion.div
                      key={talent.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      className="glass p-4 sm:p-5 rounded-3xl border border-white/10 hover:border-gold/30 transition-all group relative overflow-hidden"
                    >
                      {(() => {
                        const openTalentDetails = (e?: React.MouseEvent) => {
                          if (e) e.stopPropagation();
                          const compDetails = (talent.composition || []).map((attrId: string) => {
                            const lowerId = attrId.toLowerCase();
                            const a = attributes.find(at => at.id.toLowerCase() === lowerId);
                            return {
                              id: attrId,
                              label: a?.label || attrId.toUpperCase(),
                              total: getAttr(attrId),
                              value: a?.value || 0,
                              mod: a?.mod || 0,
                              traitMod: a?.traitMod || 0,
                              itemMod: a?.itemMod || 0
                            };
                          });

                          setSelectedTraitAttr({
                            id: talent.id,
                            label: talent.name,
                            icon: 'Sparkles',
                            color: 'text-gold',
                            value: baseValue,
                            mod: manualMod,
                            traitMod,
                            itemMod: 0,
                            total: totalValue,
                            isTalent: true,
                            composition: talent.composition,
                            compositionDetails: compDetails
                          });
                          setIsTraitOriginModalOpen(true);
                        };

                        return (
                          <div className="flex justify-between items-start mb-2 relative z-10">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h5 
                                  onClick={openTalentDetails}
                                  className="font-serif text-base sm:text-lg text-glow-gold truncate cursor-pointer hover:underline"
                                  title="Clique para ver a composição e modificadores do talento"
                                >
                                  {talent.name}
                                </h5>
                                <button
                                  type="button"
                                  onClick={openTalentDetails}
                                  className="text-gold/60 hover:text-gold transition-colors p-0.5 cursor-pointer"
                                  title="Ver composição e traços"
                                >
                                  <Info size={12} />
                                </button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-mono text-parchment/30 uppercase tracking-widest whitespace-nowrap">B: {baseValue}</span>
                                {canPlayerEdit ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-parchment/30 uppercase tracking-widest">M:</span>
                                    <input 
                                      type="number"
                                      value={manualMod ?? 0}
                                      onChange={(e) => {
                                        const newMods = { ...talentMods, [talent.id]: parseInt(e.target.value) || 0 };
                                        setTalentMods(newMods);
                                        handleSave({ talentMods: newMods });
                                      }}
                                      className="w-8 h-4 bg-white/5 border border-white/10 rounded text-center text-[9px] font-mono text-ember focus:outline-none focus:border-ember/50"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-mono text-ember uppercase tracking-widest">M: {manualMod >= 0 ? `+${manualMod}` : manualMod}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={openTalentDetails}
                                  className={cn(
                                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer hover:scale-105",
                                    traitMod > 0 ? "bg-arcane/15 text-arcane border border-arcane/30" :
                                    traitMod < 0 ? "bg-ember/15 text-ember border border-ember/30" :
                                    "text-parchment/40 hover:text-parchment/70 bg-white/5 border border-white/10"
                                  )}
                                  title="Clique para ver os traços que modificam este talento"
                                >
                                  <span>T: {traitMod > 0 ? `+${traitMod}` : traitMod}</span>
                                  <Info size={8} className="opacity-70" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isGM && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGmModifierModal({
                                      isOpen: true,
                                      targetId: talent.id,
                                      targetName: talent.name,
                                      isTalent: true
                                    });
                                    setGmModValue(1);
                                    setGmModJustification('');
                                  }}
                                  className="p-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/35 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-mono shadow-sm"
                                  title="Adicionar Modificador do Mestre neste Talento"
                                >
                                  <ShieldAlert size={14} />
                                  <span className="hidden sm:inline font-bold">GM</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={openTalentDetails}
                                className="px-2.5 py-1 bg-gold/15 text-gold border border-gold/30 rounded-xl font-serif text-lg sm:text-xl shadow-lg shadow-gold/5 cursor-pointer hover:bg-gold/25 hover:scale-105 transition-all"
                                title="Valor Total do Talento (Clique para ver Composição)"
                              >
                                {totalValue}
                              </button>
                              <div className="relative">
                                <AnimatePresence mode="wait">
                                  {activeRollAttr === talent.id ? (
                                    <motion.div 
                                      key="diffs"
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      className="absolute right-0 bottom-full mb-2 flex gap-1.5 glass p-1.5 rounded-2xl border border-white/10 z-20 shadow-2xl"
                                    >
                                      {[
                                        { id: 'easy', label: 'F', color: 'hover:text-green-400', title: `Fácil (+${globalSettings?.diffEasyMod ?? 2})` },
                                        { id: 'normal', label: 'N', color: 'hover:text-arcane', title: 'Normal' },
                                        { id: 'hard', label: 'D', color: 'hover:text-orange-400', title: `Difícil (1/${globalSettings?.diffHardDiv ?? 2})` },
                                        { id: 'extreme', label: 'E', color: 'hover:text-ember', title: `Extremo (1/${globalSettings?.diffExtremeDiv ?? 5})` },
                                      ].map(d => (
                                        <button
                                          key={d.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickRoll(talent.name, totalValue, d.id as any);
                                            setActiveRollAttr(null);
                                          }}
                                          className={cn("w-8 h-8 rounded-xl glass text-[10px] font-bold transition-all hover:scale-110 active:scale-95", d.color)}
                                          title={d.title}
                                        >
                                          {d.label}
                                        </button>
                                      ))}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveRollAttr(null);
                                        }}
                                        className="w-8 h-8 rounded-xl glass text-parchment/20 hover:text-ember transition-colors ml-1 pl-1 border-l border-white/10"
                                      >
                                        <X size={14} />
                                      </button>
                                    </motion.div>
                                  ) : (
                                    <motion.button 
                                      key="dice"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveRollAttr(talent.id);
                                      }}
                                      className="p-2 hover:bg-gold/20 rounded-xl text-parchment/30 hover:text-gold transition-all hover:scale-110"
                                      title="Rolar Teste"
                                    >
                                      <Brain size={18} />
                                    </motion.button>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <p className="text-[10px] text-parchment/40 line-clamp-2 mb-3 h-8">{talent.description}</p>
                      <div className="flex flex-wrap gap-1 relative z-10">
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
                              "flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[7px] font-mono uppercase tracking-wider transition-colors",
                              tagStyles
                            )}>
                              {React.createElement(getIcon(attr.icon), { size: 7 })}
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

        {/* Right Column: Inventory Summary */}
        <div className={cn(
          isAll ? "lg:col-span-3" : "lg:col-span-12",
          !isAll && activeSection !== 'inventory' && "hidden"
        )}>
          {/* Equipped Items */}
          <section className={cn("space-y-6", !isAll && activeSection !== 'inventory' && "hidden")}>
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
                        className="p-2 glass rounded-xl hover:bg-arcane/20 hover:text-arcane transition-all text-parchment/40"
                        title="Desequipar"
                      >
                        <Shield size={14} />
                      </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Equipment Summary */}
          <section className={cn("space-y-6", !isAll && activeSection !== 'inventory' && "hidden")}>
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
                  inventory.slice(0, 5).map((item) => (
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
                            <Shield size={12} />
                          </button>
                          <span className="text-sm font-serif text-parchment/80 group-hover:text-arcane transition-colors">{item.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-parchment/40">x{item.quantity}</span>
                      </div>
                    </div>
                  ))
                )}
                {inventory.length > 5 && (
                  <p className="text-[10px] text-center text-parchment/20 italic">e mais {inventory.length - 5} itens...</p>
                )}
              </div>
              <button 
                onClick={() => {
                  setActiveCategory('inventory');
                  setActiveSection('inventory');
                }}
                className="w-full py-3 glass rounded-2xl text-[10px] font-mono text-parchment/40 hover:text-parchment transition-colors uppercase tracking-widest"
              >
                VER INVENTÁRIO COMPLETO
              </button>
            </div>
          </section>
        </div>
          </>
        ) : (activeCategory === 'maps' || activeSection === 'campaign_maps') ? (
          <div className="lg:col-span-12">
            <CampaignMapsCharacterTab 
              character={character}
              characterId={characterId || ''}
              activeSessionId={activeSessionId}
              session={session}
              isGM={isGMOfCampaign}
            />
          </div>
        ) : activeSection === 'manage_inventory' ? (
          <div className="lg:col-span-12">
            <Inventory hideHeader={true} />
          </div>
        ) : (
          <div className="lg:col-span-12 space-y-10">
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-serif flex items-center gap-4">
                <Backpack className="text-arcane" size={32} />
                Inventário Completo
              </h3>
              <button 
                onClick={() => setActiveSection('manage_inventory')}
                className="px-6 py-3 bg-arcane text-obsidian rounded-2xl font-bold hover:scale-105 transition-transform"
              >
                Gerenciar Itens
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item) => (
                <motion.div 
                  key={item.id || item.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "glass p-6 rounded-[2rem] border transition-all group relative overflow-hidden",
                    item.equipped ? "border-arcane/30 bg-arcane/5" : "border-white/10 hover:border-white/20"
                  )}
                >
                  {item.equipped && (
                    <div className="absolute top-0 right-0 px-4 py-1 bg-arcane text-obsidian text-[10px] font-bold uppercase tracking-widest rounded-bl-xl">
                      Equipado
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10",
                        item.equipped ? "bg-arcane/20 text-arcane" : "bg-white/5 text-parchment/40"
                      )}>
                        {item.defense > 0 ? <Shield size={24} /> : <Sword size={24} />}
                      </div>
                      <div>
                        <h4 className="text-xl font-serif">{item.name}</h4>
                        <span className="text-[10px] font-mono text-parchment/40 uppercase tracking-widest">Quantidade: {item.quantity}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-parchment/60 mb-6 line-clamp-3">{item.description || 'Nenhuma descrição disponível.'}</p>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-parchment/20 uppercase tracking-widest">Dano / Efeito</span>
                      <p className="text-sm font-serif text-ember">{item.damage || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-parchment/20 uppercase tracking-widest">Defesa</span>
                      <p className="text-sm font-serif text-arcane">{item.defense > 0 ? `+${item.defense}` : '-'}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-2">
                    <button 
                      onClick={() => toggleEquip(item.id)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                        item.equipped ? "bg-ember/10 text-ember hover:bg-ember/20" : "bg-arcane/10 text-arcane hover:bg-arcane/20"
                      )}
                    >
                      {item.equipped ? 'Desequipar' : 'Equipar'}
                    </button>
                  </div>
                </motion.div>
              ))}
              {inventory.length === 0 && (
                <div className="col-span-full py-20 text-center glass rounded-[3rem] border border-dashed border-white/10">
                  <Backpack size={48} className="text-parchment/10 mx-auto mb-4" />
                  <p className="text-parchment/40 font-serif text-xl">Sua mochila está vazia</p>
                  <p className="text-xs text-parchment/20 font-mono uppercase tracking-widest mt-2">Adicione itens para começar sua jornada</p>
                </div>
              )}
            </div>
          </div>
        )}
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
              className="relative w-full max-w-2xl glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 shadow-2xl max-h-[80vh] flex flex-col"
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
                    value={searchTerm || ''}
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
              className="relative w-full max-w-2xl glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 shadow-2xl max-h-[80vh] flex flex-col"
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
                    value={searchTerm || ''}
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
              className="relative w-full max-w-md glass-modal bg-obsidian/85 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/25 shadow-2xl"
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
              animate={quickRoll.rolling ? { rotate: 360 } : { rotate: 0 }}
              transition={quickRoll.rolling ? { repeat: Infinity, duration: 0.5, ease: "linear" } : { type: "spring" }}
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
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onConfirm={handleConfirmImage}
        title="Retrato do Personagem"
        subtitle="Insira uma URL, faça upload ou tire uma foto com a câmera"
        confirmText="Salvar Imagem"
        initialUrl={character.image}
        initialTab={imagePickerInitialTab}
      />

      {/* Trait Origin Detail Modal */}
      <TraitOriginModal
        isOpen={isTraitOriginModalOpen}
        onClose={() => {
          setIsTraitOriginModalOpen(false);
          setSelectedTraitAttr(null);
        }}
        attr={selectedTraitAttr}
        contributingTraits={contributingTraitsForSelectedAttr}
        attrTotal={selectedTraitAttr ? (selectedTraitAttr.isTalent ? calculateTalentValue(selectedTraitAttr) : getAttr(selectedTraitAttr.id)) : 0}
        gmModifiers={selectedTraitAttr ? (gmModifiers[(selectedTraitAttr.id || '').toLowerCase()] || []) : []}
        isGM={isGM}
        onAddGMModifier={isGM && selectedTraitAttr ? () => {
          setGmModifierModal({
            isOpen: true,
            targetId: selectedTraitAttr.id,
            targetName: selectedTraitAttr.label || selectedTraitAttr.id,
            isTalent: Boolean(selectedTraitAttr.isTalent)
          });
          setGmModValue(1);
          setGmModJustification('');
        } : undefined}
        onRemoveGMModifier={isGM && selectedTraitAttr ? (modId) => {
          handleRemoveGMModifier(selectedTraitAttr.id, modId);
        } : undefined}
      />

      {/* GM Modifier Modal */}
      <AnimatePresence>
        {gmModifierModal?.isOpen && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGmModifierModal(null)}
              className="absolute inset-0 bg-obsidian/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg glass-modal bg-obsidian/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl text-parchment font-bold">
                      Modificador do Mestre
                    </h3>
                    <p className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                      Alvo: {gmModifierModal.targetName} ({gmModifierModal.isTalent ? 'Talento' : 'Atributo'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGmModifierModal(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-parchment/70 block">
                    Valor do Modificador (+ ou -)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGmModValue(prev => prev - 1)}
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xl font-serif text-parchment flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={gmModValue}
                      onChange={(e) => setGmModValue(parseInt(e.target.value) || 0)}
                      className="flex-1 py-2 px-4 rounded-xl bg-white/5 border border-white/15 text-center font-serif text-2xl font-bold text-parchment focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setGmModValue(prev => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xl font-serif text-parchment flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-parchment/70 block">
                      Justificativa do Mestre <span className="text-amber-400 font-bold">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-parchment/40">Obrigatória</span>
                  </div>
                  <textarea
                    value={gmModJustification}
                    onChange={(e) => setGmModJustification(e.target.value)}
                    rows={3}
                    placeholder="Ex: Bênção divina concedida pelo Templo do Sol / Fratura sofrida na batalha de Karas..."
                    className="w-full bg-white/5 border border-white/15 rounded-2xl p-3.5 text-xs font-sans text-parchment focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                  <p className="text-[10px] text-parchment/50 font-sans">
                    Esta justificativa ficará visível no detalhamento de composição deste atributo/talento.
                  </p>
                </div>

                {/* Modificadores já existentes */}
                {(() => {
                  const existingMods = gmModifiers[gmModifierModal.targetId.toLowerCase()] || [];
                  if (existingMods.length === 0) return null;
                  return (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-parchment/50 block font-bold">
                        Modificadores já aplicados nesta ficha ({existingMods.length})
                      </span>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                        {existingMods.map(m => (
                          <div key={m.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold font-serif", m.value >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-ember bg-ember/10")}>
                                  {m.value > 0 ? `+${m.value}` : m.value}
                                </span>
                                <span className="text-xs text-parchment truncate italic">"{m.justification}"</span>
                              </div>
                              <span className="text-[9px] font-mono text-parchment/40 block">
                                Por {m.authorName || 'Mestre'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveGMModifier(gmModifierModal.targetId, m.id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-parchment/40 hover:text-rose-400 transition-colors shrink-0"
                              title="Excluir modificador"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setGmModifierModal(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/15 text-parchment/70 hover:text-white hover:bg-white/5 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddGMModifier}
                  disabled={!gmModJustification.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Salvar Modificador
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Trait Modal */}
      <AnimatePresence>
        {isAddingTrait && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingTrait(false)}
              className="absolute inset-0 bg-obsidian/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl glass-modal bg-obsidian/95 backdrop-blur-xl border border-arcane/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 z-10 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-arcane/20 text-arcane border border-arcane/30 flex items-center justify-center">
                    <Star size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl text-parchment font-bold">
                      Adicionar Vantagem ou Defeito
                    </h3>
                    <p className="text-xs font-mono text-parchment/50">
                      Disponível na edição da ficha mesmo sem pontos prévios
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingTrait(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-parchment/40 hover:text-parchment cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTraitModalTab('library')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors font-bold",
                    activeTraitModalTab === 'library' ? "bg-arcane text-obsidian shadow-sm" : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Biblioteca ({availableTraits.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTraitModalTab('custom')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors font-bold",
                    activeTraitModalTab === 'custom' ? "bg-arcane text-obsidian shadow-sm" : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Criar Traço Personalizado
                </button>
              </div>

              {activeTraitModalTab === 'library' ? (
                <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar vantagem ou defeito..."
                        value={traitSearchTerm}
                        onChange={(e) => setTraitSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-sans text-parchment focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                    <select
                      value={traitFilterType}
                      onChange={(e) => setTraitFilterType(e.target.value as any)}
                      className="bg-obsidian border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-parchment/80 focus:outline-none focus:border-arcane/50"
                    >
                      <option value="all">Todos</option>
                      <option value="advantage">Vantagens</option>
                      <option value="disadvantage">Defeitos</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    {availableTraits
                      .filter(t => {
                        const isDisadvantage = String(t.type || '').toLowerCase().includes('disadvantage') || String(t.type || '').toLowerCase().includes('defeito') || String(t.type || '').toLowerCase().includes('desvantagem');
                        const isAdvantage = !isDisadvantage;
                        if (traitFilterType === 'advantage' && !isAdvantage) return false;
                        if (traitFilterType === 'disadvantage' && !isDisadvantage) return false;
                        if (!traitSearchTerm.trim()) return true;
                        const term = traitSearchTerm.toLowerCase();
                        return (t.name || '').toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term) || (t.effect || '').toLowerCase().includes(term);
                      })
                      .map((trait) => {
                        const effMod = getTraitEffectiveModifier(trait);
                        const isDisadvantage = String(trait.type || '').toLowerCase().includes('disadvantage') || String(trait.type || '').toLowerCase().includes('defeito') || String(trait.type || '').toLowerCase().includes('desvantagem');
                        const alreadyHas = resolvedTraits.some(rt => rt.id === trait.id || rt.name?.toLowerCase() === trait.name?.toLowerCase());

                        return (
                          <div
                            key={trait.id}
                            className={cn(
                              "p-3.5 rounded-2xl glass border transition-all flex items-start justify-between gap-3",
                              alreadyHas ? "border-white/10 bg-white/[0.02] opacity-75" : "border-white/15 hover:border-arcane/40"
                            )}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className={cn("font-serif text-base font-bold truncate", isDisadvantage ? "text-ember" : "text-arcane")}>
                                  {trait.name}
                                </h5>
                                <span className={cn(
                                  "text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                  isDisadvantage ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-arcane/15 text-arcane border-arcane/30"
                                )}>
                                  {isDisadvantage ? 'Defeito' : 'Vantagem'}
                                </span>
                                {alreadyHas && (
                                  <span className="text-[9px] font-mono text-parchment/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                    Na Ficha
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-parchment/70 line-clamp-2 leading-relaxed">
                                {trait.description}
                              </p>
                              {trait.effect && (
                                <p className="text-[10px] font-mono text-gold/80 truncate">
                                  Efeito: {trait.effect}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {(() => {
                                const cost = calculateTraitCost(trait);
                                return (
                                  <span className={cn(
                                    "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                                    isDisadvantage ? "bg-ember/15 text-ember border-ember/30" : "bg-arcane/15 text-arcane border-arcane/30"
                                  )}>
                                    {isDisadvantage ? `+${cost} pts` : `Custo: ${cost} pts`}
                                  </span>
                                );
                              })()}
                              <span className={cn(
                                "px-2 py-1 rounded-lg font-serif text-base border",
                                effMod > 0 ? "bg-arcane/10 text-arcane border-arcane/20" : effMod < 0 ? "bg-ember/10 text-ember border-ember/20" : "bg-white/5 text-parchment/60 border-white/10"
                              )}>
                                {effMod > 0 ? `+${effMod}` : effMod}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddTraitToCharacter(trait)}
                                className="px-3 py-1.5 rounded-xl bg-arcane text-obsidian text-xs font-mono uppercase tracking-wider font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm shadow-arcane/20"
                              >
                                {alreadyHas ? '+ Outro' : 'Adicionar'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/70 block">Nome do Traço *</label>
                      <input
                        type="text"
                        value={customTrait.name}
                        onChange={(e) => setCustomTrait({ ...customTrait, name: e.target.value })}
                        placeholder="Ex: Mente Brilhante"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs font-sans text-parchment focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/70 block">Tipo</label>
                      <select
                        value={customTrait.type}
                        onChange={(e) => setCustomTrait({ ...customTrait, type: e.target.value })}
                        className="w-full bg-obsidian border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane/50"
                      >
                        <option value="advantage">Vantagem</option>
                        <option value="disadvantage">Defeito</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/70 block">Modificador Numérico</label>
                      <input
                        type="number"
                        value={customTrait.modifier}
                        onChange={(e) => setCustomTrait({ ...customTrait, modifier: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/70 block">Atributo Alvo</label>
                      <select
                        value={customTrait.modifierType}
                        onChange={(e) => setCustomTrait({ ...customTrait, modifierType: e.target.value })}
                        className="w-full bg-obsidian border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-parchment focus:outline-none focus:border-arcane/50 uppercase"
                      >
                        {(globalSettings?.attributes || DEFAULT_ATTRIBUTES).map((a: any) => (
                          <option key={a.id} value={a.id}>{a.label} ({a.id.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/70 block">Efeito Declarado (Opcional)</label>
                    <input
                      type="text"
                      value={customTrait.effect}
                      onChange={(e) => setCustomTrait({ ...customTrait, effect: e.target.value })}
                      placeholder="Ex: +1 FOR, +1 CON ou +2 em testes de Percepção"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs font-sans text-parchment focus:outline-none focus:border-arcane/50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-parchment/70 block">Descrição</label>
                    <textarea
                      value={customTrait.description}
                      onChange={(e) => setCustomTrait({ ...customTrait, description: e.target.value })}
                      rows={3}
                      placeholder="Descrição narrativa deste traço..."
                      className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs font-sans text-parchment focus:outline-none focus:border-arcane/50 resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateCustomTrait}
                      disabled={!customTrait.name.trim()}
                      className="px-6 py-2.5 rounded-xl bg-arcane text-obsidian text-xs font-mono uppercase tracking-wider font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-arcane/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Salvar e Adicionar à Ficha
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trait Detail Modal */}
      <TraitDetailModal
        isOpen={Boolean(detailTrait)}
        onClose={() => setDetailTrait(null)}
        trait={detailTrait}
        attributes={globalSettings?.attributes || DEFAULT_ATTRIBUTES}
        talents={talents}
      />

      {/* Quick Notes (Controlled Modal - triggered from ActionMenu or header button) */}
      <QuickNotes
        targetType={notesTargetType}
        targetId={notesTargetId}
        targetName={notesTargetName}
        isGM={isGMOfCampaign}
        isOpen={isQuickNotesOpen}
        onOpenChange={setIsQuickNotesOpen}
        showFloatingButton={false}
        characterContext={character ? { id: characterId || character.id || '', name: character.name } : undefined}
      />
    </div>
    </div>
  );

  if (isModal) {
    return (
      <div 
        className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 select-text"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
      >
        <div 
          className="bg-obsidian border border-arcane/40 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-black/70 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-arcane/20 border border-arcane/40 flex items-center justify-center text-arcane">
                <Scroll size={16} />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-parchment leading-tight">
                  Ficha do Personagem {character?.name ? `— ${character.name}` : ''}
                </h3>
                <span className="text-[11px] font-mono text-parchment/50">
                  {session?.name ? `Campanha: ${session.name}` : 'Visualizador em Modal'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-parchment/60 hover:text-rose-400 transition-colors cursor-pointer"
              title="Fechar Ficha"
            >
              <X size={18} />
            </button>
          </div>
          {/* Scrollable Sheet Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {sheetContent}
          </div>
        </div>
      </div>
    );
  }

  return sheetContent;
}
