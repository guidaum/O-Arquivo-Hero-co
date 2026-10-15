import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Skull, 
  Compass, 
  Crosshair, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Grid, 
  Plus, 
  Trash2, 
  Edit3, 
  Shield, 
  Swords, 
  Flame, 
  Sparkles, 
  Heart, 
  Activity, 
  User, 
  Eye, 
  EyeOff, 
  Move, 
  Ruler, 
  Radio, 
  AlertTriangle, 
  Users, 
  Play, 
  ChevronRight, 
  X, 
  Check, 
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Navigation,
  Footprints, 
  BookOpen, 
  Layers, 
  Castle, 
  Landmark, 
  TreePine, 
  Sun, 
  Gem, 
  RefreshCw,
  Map as MapIcon,
  HelpCircle,
  Volume2,
  CloudFog,
  Cloud,
  Brush,
  Eraser,
  Moon,
  Hand,
  Lock,
  Unlock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  getDoc,
  doc, 
  deleteDoc, 
  getDocs,
  OperationType, 
  handleFirestoreError 
} from '../firebase';

import { 
  resolveCampaignMaps, 
  toggleCampaignMapActive, 
  CampaignMapItem,
  DEFAULT_DUNGEON_PRESETS,
  DEFAULT_WORLD_PRESETS 
} from '../lib/campaignMaps';

import MapRestrictedAccess from './MapRestrictedAccess';
import CampaignMapManagerModal from './CampaignMapManagerModal';

// High-fidelity dungeon battlemap assets
import catacombsMap from '../assets/images/dungeon_catacombs_map_1791542484088.jpg';
import templeMap from '../assets/images/dungeon_temple_map_1791542504225.jpg';
import cavernMap from '../assets/images/dungeon_cavern_map_1791542526527.jpg';

export interface DungeonPreset {
  id: string;
  name: string;
  subtitle: string;
  theme?: string;
  imageUrl: string;
  gridCols: number;
  gridRows: number;
  entranceCoord: { x: number; y: number };
  active?: boolean;
  sessionId?: string;
}

export const DUNGEON_PRESETS: DungeonPreset[] = [
  {
    id: 'catacombs',
    name: 'Catacumbas de Khardoos',
    subtitle: 'Cripta subterrânea com tumbas ancestrais, celas e sarcófagos esquecidos',
    theme: 'Sombrio & Ancestral',
    imageUrl: catacombsMap,
    gridCols: 24,
    gridRows: 14,
    entranceCoord: { x: 8.5, y: 35.0 }
  },
  {
    id: 'temple',
    name: 'Templo Subterrâneo Arcano',
    subtitle: 'Ruínas místicas com círculos rúnicos brilhantes, cristais e piscinas de mana',
    theme: 'Místico & Arcano',
    imageUrl: templeMap,
    gridCols: 24,
    gridRows: 14,
    entranceCoord: { x: 50.0, y: 88.0 }
  },
  {
    id: 'cavern',
    name: 'Covil Vulcânico do Dragão',
    subtitle: 'Caverna natural com rios de magma fervente, pontes de pedra e pilhas de tesouro',
    theme: 'Ígneo & Letal',
    imageUrl: cavernMap,
    gridCols: 24,
    gridRows: 14,
    entranceCoord: { x: 10.0, y: 80.0 }
  }
];

export interface DungeonTokenData {
  id: string;
  dungeonId: string;
  sessionId?: string;
  userId: string;
  userName: string;
  characterId?: string;
  name: string;
  avatar?: string;
  iconName?: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  gridX?: number;
  gridY?: number;
  color: string;
  type: 'player' | 'npc' | 'monster';
  hp: number;
  maxHp: number;
  conditions?: string[];
  size: number; // 1 = 1x1 grid cell, 2 = 2x2, etc.
  initiative?: number;
  lastMovedAt?: string;
  lastMovedBy?: string;
}

export interface PingData {
  id: string;
  x: number;
  y: number;
  userName: string;
  color: string;
  timestamp: number;
}

// Preset token templates for spawning monsters / NPCs
const MONSTER_PRESETS = [
  { name: 'Goblin Espreitador', type: 'monster', hp: 8, maxHp: 8, icon: Skull, color: '#ef4444', size: 1 },
  { name: 'Esqueleto Guerreiro', type: 'monster', hp: 14, maxHp: 14, icon: Skull, color: '#a855f7', size: 1 },
  { name: 'Cultista do Caos', type: 'monster', hp: 18, maxHp: 18, icon: Flame, color: '#f97316', size: 1 },
  { name: 'Orc Brutamontes', type: 'monster', hp: 28, maxHp: 28, icon: Swords, color: '#eab308', size: 1 },
  { name: 'Dragão Carmesim', type: 'monster', hp: 85, maxHp: 85, icon: Flame, color: '#dc2626', size: 2 },
  { name: 'Baú de Relíquias', type: 'npc', hp: 10, maxHp: 10, icon: Gem, color: '#38bdf8', size: 1 },
  { name: 'Guia / NPC Aliado', type: 'npc', hp: 22, maxHp: 22, icon: Shield, color: '#10b981', size: 1 },
];

const PLAYER_COLORS = [
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#f97316', // orange
  '#14b8a6', // teal
];

export default function DungeonMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Selected Dungeon
  const initialMap = searchParams.get('map') || 'catacombs';
  const initialSession = searchParams.get('session') || '';
  
  const [selectedMapId, setSelectedMapId] = React.useState<string>(initialMap);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(initialSession);
  const [customMapsLoaded, setCustomMapsLoaded] = React.useState<boolean>(false);

  // Direct target dungeon document from Firestore (loaded directly when map parameter is present in URL)
  const [targetDungeonDoc, setTargetDungeonDoc] = React.useState<DungeonPreset | null>(null);
  const [targetDungeonLoading, setTargetDungeonLoading] = React.useState<boolean>(false);

  const [sessions, setSessions] = React.useState<{ id: string; name: string; gmId?: string; mapSettings?: any }[]>([]);
  const [activeSessionData, setActiveSessionData] = React.useState<any | null>(null);

  // Sync selectedMapId and selectedSessionId when URL parameters change
  React.useEffect(() => {
    const urlMap = searchParams.get('map');
    if (urlMap && urlMap !== selectedMapId) {
      setSelectedMapId(urlMap);
    }
    const urlSession = searchParams.get('session');
    if (urlSession && urlSession !== selectedSessionId) {
      setSelectedSessionId(urlSession);
    }
  }, [searchParams]);
  
  // User characters and campaign binding
  const [userCharacters, setUserCharacters] = React.useState<any[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string>('');
  const [isCampaignManagerModalOpen, setIsCampaignManagerModalOpen] = React.useState(false);

  const [customMaps, setCustomMaps] = React.useState<DungeonPreset[]>([]);
  const [isCustomMapModalOpen, setIsCustomMapModalOpen] = React.useState(false);
  const [customMapForm, setCustomMapForm] = React.useState({
    name: '',
    subtitle: '',
    imageUrl: '',
    gridCols: 24,
    gridRows: 14
  });

  // Recent movement broadcast notice (toast when another player moves)
  const [movementNotice, setMovementNotice] = React.useState<{
    text: string;
    userName: string;
    tokenName: string;
    color: string;
  } | null>(null);

  // Previous tokens coordinates ref for real-time movement detection
  const prevTokensRef = React.useRef<Map<string, { x: number; y: number }>>(new Map());

  // Tokens state
  const [tokens, setTokens] = React.useState<DungeonTokenData[]>([]);
  const [selectedTokenId, setSelectedTokenId] = React.useState<string | null>(null);

  // User Role & GM Authorization
  const [userRole, setUserRole] = React.useState<'user' | 'gm' | 'admin'>('user');
  const [viewMode, setViewMode] = React.useState<'user' | 'gm'>(() => {
    return (localStorage.getItem('preferredViewMode') as 'user' | 'gm') || 'user';
  });

  React.useEffect(() => {
    const handleGlobalModeChange = (e: any) => {
      const newMode = e.detail || localStorage.getItem('preferredViewMode');
      if (newMode && (newMode === 'user' || newMode === 'gm')) {
        setViewMode(newMode);
      }
    };
    window.addEventListener('viewModeChanged', handleGlobalModeChange);
    window.addEventListener('storage', handleGlobalModeChange);
    return () => {
      window.removeEventListener('viewModeChanged', handleGlobalModeChange);
      window.removeEventListener('storage', handleGlobalModeChange);
    };
  }, []);
  const [isGMModeExplicit, setIsGMModeExplicit] = React.useState<boolean>(true);

  // Fog of War State (Synchronized with Firestore)
  const [fogEnabled, setFogEnabled] = React.useState<boolean>(true);
  const [revealedCells, setRevealedCells] = React.useState<Set<number>>(new Set());
  const [isFogLoading, setIsFogLoading] = React.useState<boolean>(true);

  // GM Fog Tool Options
  const [gmViewMode, setGmViewMode] = React.useState<'gm' | 'player'>('gm');
  const [fogBrushMode, setFogBrushMode] = React.useState<'reveal' | 'hide'>('reveal');
  const [fogBrushSize, setFogBrushSize] = React.useState<1 | 2 | 3 | 5>(3);
  const [autoRevealOnMove, setAutoRevealOnMove] = React.useState<boolean>(true);
  const [hoveredCellIndex, setHoveredCellIndex] = React.useState<number | null>(null);
  const [isPaintingFog, setIsPaintingFog] = React.useState<boolean>(false);

  // Active User's Character (if any)
  const [userCharacter, setUserCharacter] = React.useState<any>(null);

  // Canvas Viewport & Zoom
  const [scale, setScale] = React.useState(1.1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Tool Modes: 'select' (Mover) | 'pan' (Navegar Câmera) | 'ruler' | 'ping' | 'fog'
  const [activeTool, setActiveTool] = React.useState<'select' | 'pan' | 'ruler' | 'ping' | 'fog'>('select');

  // Drag vs Click distinction refs to prevent unwanted token teleportation
  const mouseDownPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = React.useRef<number>(0);
  const wasDraggingRef = React.useRef<boolean>(false);

  // Helper: check if a click or mousedown originated from any floating toolbar, button, or UI HUD
  const isToolbarClick = (target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, input, select, textarea, [data-toolbar], [data-no-map-click], .z-20, .z-30, .z-40, .z-50'));
  };

  // Grid & Tactical Overlay Options
  const [showGrid, setShowGrid] = React.useState(true);
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [showCoords, setShowCoords] = React.useState(true);
  const [darknessMode, setDarknessMode] = React.useState(false);

  // Active Token Dragging State
  const [draggingTokenId, setDraggingTokenId] = React.useState<string | null>(null);
  const [dragTokenCurrentPos, setDragTokenCurrentPos] = React.useState<{ x: number; y: number } | null>(null);
  const [dragTokenOriginPos, setDragTokenOriginPos] = React.useState<{ x: number; y: number } | null>(null);

  // Ruler Tool State
  const [rulerStart, setRulerStart] = React.useState<{ x: number; y: number } | null>(null);
  const [rulerCurrent, setRulerCurrent] = React.useState<{ x: number; y: number } | null>(null);

  // Real-time Pings
  const [pings, setPings] = React.useState<PingData[]>([]);

  // UI Modals & Drawers
  const [isSpawnerOpen, setIsSpawnerOpen] = React.useState(false);
  const [isTurnTrackerOpen, setIsTurnTrackerOpen] = React.useState(true);
  const [activeTurnIndex, setActiveTurnIndex] = React.useState(0);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapImageRef = React.useRef<HTMLImageElement>(null);

  // Load Sessions for party selector
  React.useEffect(() => {
    if (!user) return;
    const qSessions = query(collection(db, 'gameSessions'));
    const unsubscribe = onSnapshot(qSessions, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ 
          id: docSnap.id, 
          name: docSnap.data().name || 'Sessão sem nome',
          gmId: docSnap.data().gmId,
          ...docSnap.data()
        });
      });
      setSessions(list);
    }, err => {
      console.warn('Error loading sessions for dungeon:', err);
    });
    return () => unsubscribe();
  }, [user]);

  // Direct listener for explicitly targeted dungeon map document from Firestore
  React.useEffect(() => {
    const mapTarget = searchParams.get('map') || selectedMapId;
    if (!mapTarget || ['catacombs', 'temple', 'cavern'].includes(mapTarget)) {
      setTargetDungeonDoc(null);
      setTargetDungeonLoading(false);
      return;
    }
    setTargetDungeonLoading(true);
    const unsub = onSnapshot(doc(db, 'dungeonMaps', mapTarget), (snap) => {
      setTargetDungeonLoading(false);
      if (snap.exists()) {
        const d = snap.data();
        setTargetDungeonDoc({
          id: snap.id,
          name: d.name || 'Masmorra Personalizada',
          subtitle: d.subtitle || 'Mapa de batalha personalizado criado pelo Mestre',
          theme: d.theme || 'Custom',
          imageUrl: d.imageUrl,
          gridCols: Number(d.gridCols) || 24,
          gridRows: Number(d.gridRows) || 14,
          entranceCoord: d.entranceCoord || { x: 10, y: 50 },
          active: d.active !== false,
          sessionId: d.sessionId
        });
      } else {
        setTargetDungeonDoc(null);
      }
    }, err => {
      console.warn('Error fetching target dungeon map directly:', err);
      setTargetDungeonLoading(false);
    });
    return () => unsub();
  }, [searchParams, selectedMapId]);

  // Load Custom Dungeon Maps from Firestore (linked to current session or global)
  React.useEffect(() => {
    if (!user) return;
    const qMaps = query(collection(db, 'dungeonMaps'));
    const unsubscribe = onSnapshot(qMaps, (snapshot) => {
      const list: DungeonPreset[] = [];
      const currentTargetMap = searchParams.get('map') || selectedMapId;
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const isTarget = docSnap.id === currentTargetMap;
        const isGmOfSession = Boolean(d.sessionId && sessions.some(s => s.id === d.sessionId && s.gmId === user.uid));
        const isCreator = d.createdBy === user.uid;
        const matchesSession = Boolean(selectedSessionId && d.sessionId === selectedSessionId);

        const hasAccess = userRole === 'admin' || isTarget || isCreator || isGmOfSession || matchesSession;

        if (hasAccess) {
          list.push({
            id: docSnap.id,
            name: d.name || 'Masmorra Personalizada',
            subtitle: d.subtitle || 'Mapa de batalha personalizado criado pelo Mestre',
            theme: d.theme || 'Custom',
            imageUrl: d.imageUrl,
            gridCols: Number(d.gridCols) || 24,
            gridRows: Number(d.gridRows) || 14,
            entranceCoord: d.entranceCoord || { x: 10, y: 50 },
            active: d.active !== false,
            sessionId: d.sessionId
          });
        }
      });
      setCustomMaps(list);
      setCustomMapsLoaded(true);
    }, err => {
      console.warn('Error loading custom dungeon maps:', err);
      setCustomMapsLoaded(true);
    });
    return () => unsubscribe();
  }, [user, userRole, selectedSessionId, sessions, selectedMapId, searchParams]);

  // Load Custom World Maps for Manager Modal
  const [customWorldMaps, setCustomWorldMaps] = React.useState<CampaignMapItem[]>([]);
  React.useEffect(() => {
    if (!user) return;
    const qWorld = query(collection(db, 'worldMaps'));
    const unsubscribe = onSnapshot(qWorld, (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();
        const belongsToSession = selectedSessionId 
          ? data.sessionId === selectedSessionId 
          : (data.createdBy === user.uid || (data.sessionId && sessions.some(s => s.id === data.sessionId && s.gmId === user.uid)));
        const isOwner = userRole === 'admin' || 
          data.createdBy === user.uid || 
          (data.sessionId && sessions.some(s => s.id === data.sessionId && s.gmId === user.uid)) || 
          (selectedSessionId && data.sessionId === selectedSessionId);

        if (belongsToSession && isOwner) {
          list.push({
            id: d.id,
            name: data.name || 'Mapa do Mundo Personalizado',
            subtitle: data.subtitle || 'Mapa personalizado da campanha',
            type: 'world',
            imageUrl: data.imageUrl,
            defaultScale: data.defaultScale || '1 cm = 25 léguas',
            active: data.active !== false,
            isCustom: true,
            sessionId: data.sessionId
          });
        }
      });
      setCustomWorldMaps(list);
    }, err => {
      console.warn('Error loading custom world maps:', err);
    });
    return () => unsubscribe();
  }, [user, userRole, selectedSessionId, sessions]);

  // Load User's Characters to strictly link to their campaign
  React.useEffect(() => {
    if (!user) return;
    const qChars = query(collection(db, 'characters'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(qChars, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserCharacters(list);
    }, err => {
      console.warn('Error loading characters for dungeon:', err);
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to active session document in real time for instant map status updates
  React.useEffect(() => {
    if (!selectedSessionId) {
      setActiveSessionData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'gameSessions', selectedSessionId), (snap) => {
      if (snap.exists()) {
        setActiveSessionData({ id: snap.id, ...snap.data() });
      } else {
        setActiveSessionData(null);
      }
    }, err => {
      console.warn('Error loading active session data:', err);
    });
    return () => unsub();
  }, [selectedSessionId]);

  // User Role Listener from Firestore
  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const r = snap.data().role;
        setUserRole(r || 'user');
      }
    }, err => {
      console.warn('Error loading user role:', err);
    });
    return () => unsub();
  }, [user]);

  // User characters that are linked to a session
  const userCharactersWithSession = React.useMemo(() => {
    return userCharacters.filter(c => Boolean(c.sessionId));
  }, [userCharacters]);

  // GM sessions (sessions where user is the GM)
  const gmSessions = React.useMemo(() => {
    return sessions.filter(s => s.gmId === user?.uid);
  }, [sessions, user]);

  // Is GM of the currently viewed session or has admin role
  const isGM = React.useMemo(() => {
    if (viewMode === 'user') return false; // Quando o modo jogador está ativo, comporta-se estritamente como jogador!
    if (activeSessionData && activeSessionData.gmId === user?.uid) return true;
    if (!selectedSessionId && gmSessions.length > 0) return true;
    if (userRole === 'admin') return true;
    return false;
  }, [userRole, activeSessionData, user, selectedSessionId, gmSessions, viewMode]);

  // Synchronize campaign selection and active character:
  // - O jogador SÓ pode ver a campanha relacionada ao seu personagem, NUNCA fora do personagem
  React.useEffect(() => {
    // Se for Mestre e nenhuma sessão estiver selecionada, seleciona a primeira sessão do mestre
    if (isGM && !selectedSessionId && gmSessions.length > 0) {
      const preferred = initialSession && gmSessions.some(s => s.id === initialSession)
        ? initialSession
        : gmSessions[0].id;
      setSelectedSessionId(preferred);
      return;
    }

    // Se for Jogador: trava estritamente na campanha do personagem dele
    const isOwnerGM = activeSessionData?.gmId === user?.uid || userRole === 'admin';
    if (!isOwnerGM && userCharactersWithSession.length > 0) {
      const activeChar = userCharactersWithSession.find(c => c.id === selectedCharacterId) || userCharactersWithSession[0];
      if (activeChar && activeChar.sessionId) {
        if (selectedSessionId !== activeChar.sessionId) {
          setSelectedSessionId(activeChar.sessionId);
        }
        if (selectedCharacterId !== activeChar.id) {
          setSelectedCharacterId(activeChar.id);
        }
        setUserCharacter(activeChar);
      }
    }
  }, [isGM, gmSessions, userCharactersWithSession, selectedSessionId, selectedCharacterId, initialSession, user, userRole, activeSessionData]);

  // Resolve todos os mapas (Mundo e Dungeon) da campanha com as ativações do Mestre
  const campaignMaps = React.useMemo(() => {
    return resolveCampaignMaps(activeSessionData, customMaps, customWorldMaps);
  }, [activeSessionData, customMaps, customWorldMaps]);

  const campaignDungeonMaps = campaignMaps.dungeonMaps;
  const campaignWorldMaps = campaignMaps.worldMaps;

  // Filtro de acordo com a regra:
  // - O Mestre vê seus próprios mapas e os modelos
  // - O Jogador vê APENAS os mapas da campanha do personagem que está jogando (com vínculo), NÃO vê os mapas modelos!
  const allPresets = React.useMemo(() => {
    if (isGM) {
      const list = [...campaignDungeonMaps];
      if (targetDungeonDoc && !list.some(m => m.id === targetDungeonDoc.id)) {
        list.push(targetDungeonDoc);
      }
      return list;
    }

    // Regra estrita para o jogador:
    // Apenas masmorras com vínculo com a campanha ativa do personagem (isCustom && sessionId) e que estejam ativas!
    const playerSession = selectedSessionId || userCharactersWithSession[0]?.sessionId;
    const playerMaps = customMaps.filter(m => 
      Boolean(m.sessionId) && 
      m.sessionId === playerSession && 
      m.active !== false
    );
    if (targetDungeonDoc && targetDungeonDoc.sessionId === playerSession && targetDungeonDoc.active !== false) {
      if (!playerMaps.some(m => m.id === targetDungeonDoc.id)) {
        playerMaps.push(targetDungeonDoc);
      }
    }
    return playerMaps;
  }, [campaignDungeonMaps, customMaps, isGM, selectedSessionId, userCharactersWithSession, targetDungeonDoc]);

  // Preset ativo atual
  const activePreset = React.useMemo<DungeonPreset>(() => {
    // 1. Prioridade absoluta: masmorra solicitada diretamente via targetDungeonDoc
    if (targetDungeonDoc && targetDungeonDoc.id === selectedMapId) {
      return targetDungeonDoc;
    }

    // 2. Procura nos presets disponíveis
    const found = allPresets.find(p => p.id === selectedMapId);
    if (found) return found;

    // 3. Procura na lista de customMaps
    const customFound = customMaps.find(m => m.id === selectedMapId);
    if (customFound) return customFound;

    // 4. Se ainda está carregando a masmorra solicitada, retorna estado provisório para NUNCA puxar o mapa base!
    if (targetDungeonLoading && selectedMapId && !['catacombs', 'temple', 'cavern'].includes(selectedMapId)) {
      return {
        id: selectedMapId,
        name: 'Carregando Masmorra...',
        subtitle: 'Buscando informações do mapa tático cadastrado...',
        theme: 'Personalizado',
        imageUrl: '',
        gridCols: 24,
        gridRows: 14,
        entranceCoord: { x: 10, y: 50 },
        active: true
      };
    }

    // 5. Se for Mestre: primeira masmorra disponível ou modelo base
    if (isGM) {
      return allPresets[0] || DUNGEON_PRESETS[0];
    }

    // 6. Se for Jogador: primeira masmorra vinculada à campanha. Se não houver, placeholder de campanha vazia (NÃO puxa modelo base!)
    if (allPresets.length > 0) {
      return allPresets[0];
    }

    return {
      id: 'none',
      name: 'Nenhuma Masmorra Vinculada',
      subtitle: 'Esta campanha não possui masmorras ou mapas de batalha vinculados e liberados pelo Mestre.',
      theme: 'Vazio',
      imageUrl: '',
      gridCols: 24,
      gridRows: 14,
      entranceCoord: { x: 10, y: 50 },
      active: false
    };
  }, [targetDungeonDoc, selectedMapId, allPresets, customMaps, targetDungeonLoading, isGM]);

  // Sincroniza selectedMapId caso nenhum mapa esteja selecionado ou o jogador esteja apontando para um modelo base inexistente
  React.useEffect(() => {
    if (!customMapsLoaded) return;
    if (targetDungeonLoading) return; // NUNCA sincronizar enquanto a masmorra solicitada ainda está carregando!

    // Se o jogador estiver com 'catacombs', 'temple', 'cavern' ou id vazio, mas a campanha dele possuir masmorras vinculadas:
    if (!isGM && (['catacombs', 'temple', 'cavern', 'none'].includes(selectedMapId) || !selectedMapId)) {
      if (allPresets.length > 0) {
        setSelectedMapId(allPresets[0].id);
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('map', allPresets[0].id);
          if (selectedSessionId) next.set('session', selectedSessionId);
          return next;
        });
      }
    }
  }, [customMapsLoaded, targetDungeonLoading, isGM, selectedMapId, allPresets, selectedSessionId, setSearchParams]);

  // Namespace para persistência de tokens e névoa no Firestore por campanha
  const activeDungeonKey = React.useMemo(() => {
    if (selectedSessionId) {
      return `session_${selectedSessionId}_${activePreset.id}`;
    }
    return `dungeon_${activePreset.id}`;
  }, [selectedSessionId, activePreset.id]);

  // Real-time Tokens Synchronization from Firestore with Live Movement Detection
  React.useEffect(() => {
    if (!user) return;

    const qTokens = query(
      collection(db, 'dungeonTokens'),
      where('dungeonId', '==', activeDungeonKey)
    );

    const unsubscribe = onSnapshot(qTokens, (snapshot) => {
      const list: DungeonTokenData[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const tok: DungeonTokenData = {
          id: docSnap.id,
          dungeonId: d.dungeonId,
          sessionId: d.sessionId || '',
          userId: d.userId || '',
          userName: d.userName || 'Jogador',
          characterId: d.characterId || '',
          name: d.name || 'Aventureiro',
          avatar: d.avatar || '',
          iconName: d.iconName || 'Shield',
          x: Number(d.x) || 50,
          y: Number(d.y) || 50,
          gridX: d.gridX,
          gridY: d.gridY,
          color: d.color || '#06b6d4',
          type: d.type || 'player',
          hp: Number(d.hp) ?? 20,
          maxHp: Number(d.maxHp) ?? 20,
          conditions: d.conditions || [],
          size: Number(d.size) || 1,
          initiative: Number(d.initiative) || 0,
          lastMovedAt: d.lastMovedAt || '',
          lastMovedBy: d.lastMovedBy || ''
        };
        list.push(tok);

        // Movement check: Did another player move a token?
        const prev = prevTokensRef.current.get(tok.id);
        if (prev && (Math.abs(prev.x - tok.x) > 0.05 || Math.abs(prev.y - tok.y) > 0.05)) {
          if (tok.userId !== user.uid) {
            setMovementNotice({
              text: `${tok.lastMovedBy || tok.userName} moveu ${tok.name}`,
              userName: tok.lastMovedBy || tok.userName,
              tokenName: tok.name,
              color: tok.color
            });
            setTimeout(() => {
              setMovementNotice(null);
            }, 3500);
          }
        }
        prevTokensRef.current.set(tok.id, { x: tok.x, y: tok.y });
      });

      setTokens(list);
    }, (err) => {
      console.warn('Dungeon tokens subscription warning:', err);
    });

    return () => unsubscribe();
  }, [user, activeDungeonKey]);

  // Real-time Pings Listener
  React.useEffect(() => {
    if (!user) return;
    const qPings = query(
      collection(db, 'dungeonPings'),
      where('dungeonId', '==', activeDungeonKey)
    );

    const unsubscribe = onSnapshot(qPings, (snapshot) => {
      const now = Date.now();
      const list: PingData[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (now - (d.timestamp || 0) < 6000) { // keep pings for 6 seconds
          list.push({
            id: docSnap.id,
            x: d.x,
            y: d.y,
            userName: d.userName || 'Jogador',
            color: d.color || '#06b6d4',
            timestamp: d.timestamp || now
          });
        }
      });
      setPings(list);
    }, (err) => {
      console.warn('Dungeon pings subscription warning:', err);
    });

    return () => unsubscribe();
  }, [user, activeDungeonKey]);

  // Verificação de acesso: o jogador só pode ver se tiver personagem vinculado à campanha
  const hasAccess = isGM || userCharactersWithSession.length > 0;

  // Coordinate & Fog Cell Helpers
  const getCellIndexFromPct = React.useCallback((pctX: number, pctY: number, cols: number, rows: number) => {
    const col = Math.max(0, Math.min(cols - 1, Math.floor((pctX / 100) * cols)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((pctY / 100) * rows)));
    return row * cols + col;
  }, []);

  const getCellsInRadius = React.useCallback((centerCol: number, centerRow: number, radius: number, cols: number, rows: number) => {
    const cells: number[] = [];
    if (radius === 1) {
      if (centerCol >= 0 && centerCol < cols && centerRow >= 0 && centerRow < rows) {
        cells.push(centerRow * cols + centerCol);
      }
      return cells;
    }
    if (radius === 2) {
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++) {
          const c = centerCol + dx;
          const r = centerRow + dy;
          if (c >= 0 && c < cols && r >= 0 && r < rows) {
            cells.push(r * cols + c);
          }
        }
      }
      return cells;
    }
    const r = Math.floor(radius / 2);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const c = centerCol + dx;
        const row = centerRow + dy;
        if (c >= 0 && c < cols && row >= 0 && row < rows) {
          cells.push(row * cols + c);
        }
      }
    }
    return cells;
  }, []);

  // Debounced persistence to Firestore for Fog of War
  const persistTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const persistFogChanges = (cells: number[], enabled: boolean) => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'dungeonFog', activeDungeonKey), {
          dungeonId: activeDungeonKey,
          enabled,
          revealedCells: cells,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.displayName || user?.email?.split('@')[0] || 'Mestre'
        }, { merge: true });
      } catch (err) {
        console.warn('Failed to persist fog of war in Firestore:', err);
      }
    }, 200);
  };

  // Real-time Fog of War Synchronization from Firestore
  React.useEffect(() => {
    if (!user) return;
    setIsFogLoading(true);
    setRevealedCells(new Set());

    const docRef = doc(db, 'dungeonFog', activeDungeonKey);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      setIsFogLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFogEnabled(data.enabled !== false);
        const cellsArray = Array.isArray(data.revealedCells) ? data.revealedCells : [];
        setRevealedCells(new Set(cellsArray));
      } else {
        // Document doesn't exist yet, bootstrap initial fog with entrance area revealed
        const entranceCol = Math.max(0, Math.min(activePreset.gridCols - 1, Math.floor((activePreset.entranceCoord.x / 100) * activePreset.gridCols)));
        const entranceRow = Math.max(0, Math.min(activePreset.gridRows - 1, Math.floor((activePreset.entranceCoord.y / 100) * activePreset.gridRows)));
        const initialRevealed = getCellsInRadius(entranceCol, entranceRow, 3, activePreset.gridCols, activePreset.gridRows);
        setFogEnabled(true);
        setRevealedCells(new Set(initialRevealed));

        setDoc(docRef, {
          dungeonId: activeDungeonKey,
          enabled: true,
          revealedCells: initialRevealed,
          updatedAt: new Date().toISOString(),
          updatedBy: user.displayName || user.email?.split('@')[0] || 'Sistema'
        }).catch(err => {
          console.warn('Failed to bootstrap dungeon fog:', err);
        });
      }
    }, (err) => {
      console.warn('Dungeon fog subscription warning:', err);
      setIsFogLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeDungeonKey, activePreset, getCellsInRadius]);

  // Global mouse release listener for fog painting
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPaintingFog) {
        setIsPaintingFog(false);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPaintingFog]);

  // Apply Fog Brush at a cell
  const handleApplyFogBrush = (cellIndex: number) => {
    if (!fogEnabled) return;
    const col = cellIndex % activePreset.gridCols;
    const row = Math.floor(cellIndex / activePreset.gridCols);
    const targetCells = getCellsInRadius(col, row, fogBrushSize, activePreset.gridCols, activePreset.gridRows);

    setRevealedCells(prev => {
      const next = new Set<number>(prev);
      if (fogBrushMode === 'reveal') {
        targetCells.forEach(c => next.add(c));
      } else {
        targetCells.forEach(c => next.delete(c));
      }
      persistFogChanges(Array.from(next), fogEnabled);
      return next;
    });
  };

  // Reveal Entire Map
  const handleRevealAllFog = () => {
    const total = activePreset.gridCols * activePreset.gridRows;
    const allCells = Array.from({ length: total }, (_, i) => i);
    setRevealedCells(new Set<number>(allCells));
    persistFogChanges(allCells, fogEnabled);
  };

  // Hide / Shroud Entire Map
  const handleHideAllFog = () => {
    setRevealedCells(new Set<number>());
    persistFogChanges([], fogEnabled);
  };

  // Reveal Area around Entrance (Entrance Room)
  const handleRevealEntrance = () => {
    const entranceCol = Math.max(0, Math.min(activePreset.gridCols - 1, Math.floor((activePreset.entranceCoord.x / 100) * activePreset.gridCols)));
    const entranceRow = Math.max(0, Math.min(activePreset.gridRows - 1, Math.floor((activePreset.entranceCoord.y / 100) * activePreset.gridRows)));
    const entranceCells = getCellsInRadius(entranceCol, entranceRow, 3, activePreset.gridCols, activePreset.gridRows);
    setRevealedCells(new Set<number>(entranceCells));
    persistFogChanges(entranceCells, fogEnabled);
  };

  // Reveal Area around all Active Player Tokens (Torch Radius 3x3)
  const handleRevealPlayerTokensArea = () => {
    const playerTokens = tokens.filter(t => t.type === 'player');
    const newSet = new Set<number>(revealedCells);
    playerTokens.forEach(t => {
      const col = Math.floor((t.x / 100) * activePreset.gridCols);
      const row = Math.floor((t.y / 100) * activePreset.gridRows);
      const radiusCells = getCellsInRadius(col, row, 3, activePreset.gridCols, activePreset.gridRows);
      radiusCells.forEach(c => newSet.add(c));
    });
    const list = Array.from(newSet);
    setRevealedCells(newSet);
    persistFogChanges(list, fogEnabled);
  };

  // Toggle Fog Enabled / Disabled in Firestore
  const handleToggleFogEnabled = async () => {
    const nextVal = !fogEnabled;
    setFogEnabled(nextVal);
    try {
      await setDoc(doc(db, 'dungeonFog', activeDungeonKey), {
        dungeonId: activeDungeonKey,
        enabled: nextVal,
        revealedCells: Array.from(revealedCells),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.displayName || user?.email?.split('@')[0] || 'Mestre'
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to toggle fog enabled:', err);
    }
  };

  // Find logged-in player's own token
  const myToken = React.useMemo(() => {
    if (!user) return null;
    return tokens.find(t => t.userId === user.uid && t.type === 'player') || null;
  }, [tokens, user]);

  // Sorted Turn Order (Initiative)
  const turnOrderTokens = React.useMemo(() => {
    return [...tokens].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
  }, [tokens]);

  // Visible Turn Order (Filtered by Fog of War for players!)
  const visibleTurnOrderTokens = React.useMemo(() => {
    return turnOrderTokens.filter(t => {
      if (t.type === 'player') return true;
      if (!fogEnabled) return true;
      if (isGM && gmViewMode === 'gm') return true;
      const col = Math.max(0, Math.min(activePreset.gridCols - 1, Math.floor((t.x / 100) * activePreset.gridCols)));
      const row = Math.max(0, Math.min(activePreset.gridRows - 1, Math.floor((t.y / 100) * activePreset.gridRows)));
      const cellIdx = row * activePreset.gridCols + col;
      return revealedCells.has(cellIdx);
    });
  }, [turnOrderTokens, fogEnabled, isGM, gmViewMode, revealedCells, activePreset]);

  // Selected Token object
  const selectedToken = React.useMemo(() => {
    return tokens.find(t => t.id === selectedTokenId) || null;
  }, [tokens, selectedTokenId]);

  // Snap coordinate helper
  const snapCoordinate = (pctX: number, pctY: number) => {
    if (!snapToGrid) return { x: pctX, y: pctY };
    const stepX = 100 / activePreset.gridCols;
    const stepY = 100 / activePreset.gridRows;
    const col = Math.floor(pctX / stepX);
    const row = Math.floor(pctY / stepY);
    // Center of the grid cell
    const snappedX = Number(((col + 0.5) * stepX).toFixed(2));
    const snappedY = Number(((row + 0.5) * stepY).toFixed(2));
    return { x: snappedX, y: snappedY, gridCol: col + 1, gridRow: row + 1 };
  };

  // Convert mouse or touch event to percentage coordinates on the battlemap
  const getMapCoordinatesFromEvent = (e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    if (!mapImageRef.current) return null;
    const rect = mapImageRef.current.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && (e as any).changedTouches?.length > 0) {
      clientX = (e as any).changedTouches[0].clientX;
      clientY = (e as any).changedTouches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      return null;
    }

    const pctX = Number(((clickX / rect.width) * 100).toFixed(2));
    const pctY = Number(((clickY / rect.height) * 100).toFixed(2));
    return { pctX, pctY };
  };

  // Automatically spawn / join token for current user
  const handleJoinDungeonWithMyToken = async () => {
    if (!user) return;

    const assignedColor = PLAYER_COLORS[tokens.filter(t => t.type === 'player').length % PLAYER_COLORS.length];
    const initialPos = snapCoordinate(activePreset.entranceCoord.x, activePreset.entranceCoord.y);

    const newToken: Partial<DungeonTokenData> = {
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'Jogador',
      characterId: userCharacter?.id || '',
      name: userCharacter?.name || user.displayName || 'Aventureiro',
      avatar: userCharacter?.avatar || user.photoURL || '',
      color: assignedColor,
      type: 'player',
      hp: userCharacter?.attributes?.currentHp || 20,
      maxHp: userCharacter?.attributes?.maxHp || 20,
      x: initialPos.x,
      y: initialPos.y,
      size: 1,
      initiative: Math.floor(Math.random() * 20) + 1,
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: user.displayName || 'Jogador'
    };

    try {
      const docRef = await addDoc(collection(db, 'dungeonTokens'), newToken);
      setSelectedTokenId(docRef.id);
    } catch (err) {
      console.error('Failed to create player token:', err);
    }
  };

  // Move token to coordinates (real-time sync to all players!)
  const handleMoveToken = async (tokenId: string, targetX: number, targetY: number) => {
    // A movimentação só é permitida se a opção 'Mover' estiver habilitada
    if (activeTool !== 'select') return;

    const snapped = snapCoordinate(targetX, targetY);

    // Optimistic UI update
    setTokens(prev => prev.map(t => t.id === tokenId ? { 
      ...t, 
      x: snapped.x, 
      y: snapped.y, 
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: user?.displayName || 'Jogador'
    } : t));

    try {
      await updateDoc(doc(db, 'dungeonTokens', tokenId), {
        x: snapped.x,
        y: snapped.y,
        lastMovedAt: new Date().toISOString(),
        lastMovedBy: user?.displayName || user?.email?.split('@')[0] || 'Jogador'
      });
    } catch (err) {
      console.warn('Failed to update token position in Firestore:', err);
    }

    // Auto-reveal fog around player token if enabled
    if (fogEnabled && autoRevealOnMove) {
      const movingTok = tokens.find(t => t.id === tokenId);
      if (!movingTok || movingTok.type === 'player') {
        const col = Math.floor((snapped.x / 100) * activePreset.gridCols);
        const row = Math.floor((snapped.y / 100) * activePreset.gridRows);
        const radiusCells = getCellsInRadius(col, row, 3, activePreset.gridCols, activePreset.gridRows);

        setRevealedCells(prev => {
          let hasNew = false;
          const next = new Set<number>(prev);
          radiusCells.forEach(c => {
            if (!next.has(c)) {
              next.add(c);
              hasNew = true;
            }
          });
          if (hasNew) {
            persistFogChanges(Array.from(next), fogEnabled);
          }
          return next;
        });
      }
    }
  };

  // Step in a direction (used by on-screen D-Pad and Keyboard navigation)
  const handleStepDirection = (dir: 'up' | 'down' | 'left' | 'right') => {
    // Apenas se a opção 'Mover' estiver ativa
    if (activeTool !== 'select') return;

    const activeTok = selectedToken || myToken;
    if (!activeTok) return;
    const stepX = 100 / activePreset.gridCols;
    const stepY = 100 / activePreset.gridRows;

    let newX = activeTok.x;
    let newY = activeTok.y;

    if (dir === 'up') newY = Math.max(stepY / 2, activeTok.y - stepY);
    if (dir === 'down') newY = Math.min(100 - stepY / 2, activeTok.y + stepY);
    if (dir === 'left') newX = Math.max(stepX / 2, activeTok.x - stepX);
    if (dir === 'right') newX = Math.min(100 - stepX / 2, activeTok.x + stepX);

    handleMoveToken(activeTok.id, newX, newY);
    if (!selectedTokenId) {
      setSelectedTokenId(activeTok.id);
    }
  };

  // Keyboard navigation for selected token or player's own token (Arrow Keys or WASD)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloquear movimentação por teclado se a ferramenta Mover não estiver ativa
      if (activeTool !== 'select') return;

      const activeTok = selectedToken || myToken;
      if (!activeTok) return;
      // Do not capture if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handleStepDirection('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleStepDirection('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleStepDirection('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleStepDirection('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, selectedToken, myToken, activePreset, snapToGrid]);

  // Drop a real-time multiplayer ping on the map
  const handleDropPing = async (pctX: number, pctY: number) => {
    if (!user) return;
    const newPing: PingData = {
      id: `ping-${Date.now()}`,
      x: pctX,
      y: pctY,
      userName: user.displayName || user.email?.split('@')[0] || 'Jogador',
      color: myToken?.color || '#06b6d4',
      timestamp: Date.now()
    };

    setPings(prev => [...prev, newPing]);

    try {
      await addDoc(collection(db, 'dungeonPings'), {
        ...newPing,
        dungeonId: activeDungeonKey
      });
    } catch (err) {
      console.warn('Ping sync error:', err);
    }
  };

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    // Nunca processar mousedown se o clique foi em qualquer barra de ferramentas, botão ou HUD
    if (isToolbarClick(e.target)) return;

    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragDistanceRef.current = 0;
    wasDraggingRef.current = false;

    if (activeTool === 'fog' && isGM) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        const cellIdx = getCellIndexFromPct(coords.pctX, coords.pctY, activePreset.gridCols, activePreset.gridRows);
        setIsPaintingFog(true);
        handleApplyFogBrush(cellIdx);
      }
      return;
    }

    if (activeTool === 'ruler') {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        setRulerStart({ x: coords.pctX, y: coords.pctY });
        setRulerCurrent({ x: coords.pctX, y: coords.pctY });
      }
      return;
    }

    if (activeTool === 'ping') {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        handleDropPing(coords.pctX, coords.pctY);
      }
      return;
    }

    // Otherwise, start dragging viewport canvas
    setIsDraggingCanvas(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Canvas Mouse Move
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const dist = Math.hypot(e.clientX - mouseDownPosRef.current.x, e.clientY - mouseDownPosRef.current.y);
    dragDistanceRef.current = dist;
    if (dist > 6 && isDraggingCanvas) {
      wasDraggingRef.current = true;
    }

    if (activeTool === 'fog' && isGM) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        const cellIdx = getCellIndexFromPct(coords.pctX, coords.pctY, activePreset.gridCols, activePreset.gridRows);
        setHoveredCellIndex(cellIdx);
        if (isPaintingFog) {
          handleApplyFogBrush(cellIdx);
        }
      } else {
        setHoveredCellIndex(null);
      }
      return;
    }

    if (activeTool === 'ruler' && rulerStart) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        setRulerCurrent({ x: coords.pctX, y: coords.pctY });
      }
      return;
    }

    if (isDraggingCanvas) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    // Token Dragging in Progress (apenas se a opção Mover estiver ativa)
    if (draggingTokenId && activeTool === 'select') {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        setDragTokenCurrentPos({ x: coords.pctX, y: coords.pctY });
      }
    }
  };

  // Canvas Mouse Up
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaintingFog) {
      setIsPaintingFog(false);
      return;
    }

    if (activeTool === 'ruler' && rulerStart) {
      // Completed measurement, reset
      setRulerStart(null);
      setRulerCurrent(null);
      setActiveTool('select');
      return;
    }

    if (isDraggingCanvas) {
      setIsDraggingCanvas(false);
      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 120);
      return;
    }

    // Drop dragged token (apenas se a ferramenta Mover estiver habilitada)
    if (draggingTokenId && dragTokenCurrentPos && activeTool === 'select') {
      handleMoveToken(draggingTokenId, dragTokenCurrentPos.x, dragTokenCurrentPos.y);
      setDraggingTokenId(null);
      setDragTokenCurrentPos(null);
      setDragTokenOriginPos(null);
    }
  };

  // Click on Battlemap Cell
  const handleMapCellClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Se o clique foi em qualquer barra de ferramentas, botão, badge ou HUD, NUNCA mover token
    if (isToolbarClick(e.target)) return;

    // Se estava arrastando a câmera ou pintando névoa, ignorar clique
    if (isDraggingCanvas || draggingTokenId || isPaintingFog) return;
    if (wasDraggingRef.current || dragDistanceRef.current > 6) return;

    if (activeTool === 'fog' && isGM) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        const cellIdx = getCellIndexFromPct(coords.pctX, coords.pctY, activePreset.gridCols, activePreset.gridRows);
        handleApplyFogBrush(cellIdx);
      }
      return;
    }

    if (activeTool === 'ping') {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) handleDropPing(coords.pctX, coords.pctY);
      return;
    }

    // A movimentação por clique no mapa SÓ deve ocorrer se a opção 'Mover' estiver habilitada
    // e o clique tiver atingido diretamente a imagem ou grade do mapa (não áreas vazias de fora)
    if (selectedToken && activeTool === 'select') {
      const targetEl = e.target as HTMLElement;
      const isMapTarget = targetEl === mapImageRef.current || Boolean(targetEl.closest('[data-map-overlay]'));
      if (!isMapTarget) return;

      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        handleMoveToken(selectedToken.id, coords.pctX, coords.pctY);
      }
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0015;
    setScale(prev => Math.min(3.5, Math.max(0.5, prev + zoomDelta)));
  };

  // Center camera on a specific token
  const handleCenterOnToken = (token: DungeonTokenData) => {
    setSelectedTokenId(token.id);
    setScale(1.4);
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const targetX = (cw / 2) - ((token.x / 100) * cw * 1.4);
      const targetY = (ch / 2) - ((token.y / 100) * ch * 1.4);
      setPosition({
        x: Math.max(-cw, Math.min(cw, targetX * 0.4)),
        y: Math.max(-ch, Math.min(ch, targetY * 0.4))
      });
    }
  };

  // Spawn Monster / NPC
  const handleSpawnPreset = async (preset: typeof MONSTER_PRESETS[0]) => {
    if (!user) return;
    const entrance = snapCoordinate(activePreset.entranceCoord.x + (Math.random() * 8 - 4), activePreset.entranceCoord.y + (Math.random() * 8 - 4));
    
    const newToken: Partial<DungeonTokenData> = {
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      userId: user.uid,
      userName: user.displayName || 'Mestre',
      name: preset.name,
      color: preset.color,
      type: preset.type as any,
      hp: preset.hp,
      maxHp: preset.maxHp,
      x: entrance.x,
      y: entrance.y,
      size: preset.size,
      initiative: Math.floor(Math.random() * 20) + 1,
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: user.displayName || 'Mestre'
    };

    try {
      const docRef = await addDoc(collection(db, 'dungeonTokens'), newToken);
      setSelectedTokenId(docRef.id);
      setIsSpawnerOpen(false);
    } catch (err) {
      console.error('Failed to spawn monster token:', err);
    }
  };

  // Token HP Adjustment (+/-)
  const handleUpdateHp = async (tokenId: string, delta: number) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    const newHp = Math.max(0, Math.min(token.maxHp, token.hp + delta));
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, hp: newHp } : t));
    try {
      await updateDoc(doc(db, 'dungeonTokens', tokenId), { hp: newHp });
    } catch (e) {
      console.warn('HP update failed:', e);
    }
  };

  // Delete Token
  const handleDeleteToken = async (tokenId: string) => {
    if (!window.confirm('Deseja remover este token da masmorra?')) return;
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    if (selectedTokenId === tokenId) setSelectedTokenId(null);
    try {
      await deleteDoc(doc(db, 'dungeonTokens', tokenId));
    } catch (e) {
      console.warn('Failed to delete token:', e);
    }
  };

  // Calculate distance in feet/squares for ruler
  const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = (p2.x - p1.x) / (100 / activePreset.gridCols);
    const dy = (p2.y - p1.y) / (100 / activePreset.gridRows);
    const squares = Math.round(Math.sqrt(dx * dx + dy * dy));
    const feet = squares * 5;
    const meters = (squares * 1.5).toFixed(1);
    return { squares, feet, meters };
  };

  // Save Custom Dungeon Map to Firestore
  const handleSaveCustomMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMapForm.name.trim() || !customMapForm.imageUrl.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'dungeonMaps'), {
        name: customMapForm.name.trim(),
        subtitle: customMapForm.subtitle.trim() || 'Masmorra personalizada criada pelo grupo',
        theme: 'Custom',
        imageUrl: customMapForm.imageUrl.trim(),
        gridCols: Number(customMapForm.gridCols) || 24,
        gridRows: Number(customMapForm.gridRows) || 14,
        entranceCoord: { x: 10, y: 50 },
        sessionId: selectedSessionId || '',
        createdBy: user?.uid,
        createdAt: new Date().toISOString()
      });

      setSelectedMapId(docRef.id);
      setIsCustomMapModalOpen(false);
      setCustomMapForm({
        name: '',
        subtitle: '',
        imageUrl: '',
        gridCols: 24,
        gridRows: 14
      });
    } catch (err) {
      console.error('Failed to create custom dungeon map:', err);
    }
  };

  // Verificação estrita de acesso: Jogador só pode ver a campanha do seu personagem
  if (!hasAccess) {
    return (
      <MapRestrictedAccess 
        mapType="dungeon" 
        userRole={userRole} 
        userCharactersCount={userCharacters.length} 
      />
    );
  }

  // Se o mestre desativou todos os mapas de dungeon para esta campanha
  if (allPresets.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-obsidian text-parchment text-center relative overflow-hidden select-none">
        <div className="max-w-md w-full glass-popup bg-stone-950/80 border border-white/15 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto mb-4">
            <EyeOff size={32} />
          </div>
          <h2 className="font-serif text-xl font-bold mb-2">Nenhum Mapa de Masmorra Ativo</h2>
          <p className="text-xs text-parchment/60 leading-relaxed mb-6">
            O Mestre da campanha não ativou nenhum mapa de masmorra para exploração nesta sessão. Aguarde a revelação do Mestre!
          </p>
          <div className="flex gap-2 justify-center">
            {isGM ? (
              <button
                onClick={() => setIsCampaignManagerModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-105 transition-transform flex items-center gap-1.5"
              >
                <Shield size={14} />
                <span>Gerenciar Mapas da Campanha</span>
              </button>
            ) : (
              <Link
                to="/map"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-medium"
              >
                Voltar ao Mapa do Mundo
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-obsidian text-parchment overflow-hidden select-none">
      {/* Top Tactical Navigation Bar */}
      <header className="h-14 border-b border-white/10 bg-black/50 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Skull size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base sm:text-lg tracking-wide font-medium">
                {activePreset.name}
              </h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 hidden sm:inline-block">
                Battlemap & Tokens
              </span>
            </div>
            <p className="text-[11px] text-parchment/50 hidden md:block">
              {activePreset.subtitle}
            </p>
          </div>
        </div>

        {/* Center / Right Tactical Controls */}
        <div className="flex items-center gap-2">
          {/* GM Map Management Button */}
          {isGM && (
            <button
              onClick={() => setIsCampaignManagerModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Gerenciar ativação e novos mapas da campanha"
            >
              <Shield size={14} />
              <span className="hidden sm:inline">Gerenciar Mapas</span>
            </button>
          )}

          {/* Dungeon Preset Selector */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            {allPresets.map((dp) => (
              <div key={dp.id} className="flex items-center">
                <button
                  onClick={() => {
                    setSelectedMapId(dp.id);
                    setSearchParams({ map: dp.id, ...(selectedSessionId ? { session: selectedSessionId } : {}) });
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1",
                    selectedMapId === dp.id
                      ? "bg-purple-500/25 text-purple-300 border border-purple-500/40 shadow-sm font-semibold"
                      : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                  )}
                >
                  <span>{dp.name.split(' ')[0]}</span>
                </button>

                {/* GM Quick Activation Toggle */}
                {isGM && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCampaignMapActive(selectedSessionId, dp.id, dp.active, dp.isCustom, 'dungeon');
                    }}
                    className="p-1 hover:bg-white/10 rounded-md transition-colors mr-0.5"
                    title={dp.active ? "Ativo para jogadores. Clique para desativar." : "Desativado para jogadores. Clique para ativar."}
                  >
                    {dp.active ? (
                      <Eye size={12} className="text-emerald-400" />
                    ) : (
                      <EyeOff size={12} className="text-amber-400" />
                    )}
                  </button>
                )}
              </div>
            ))}

            {isGM && (
              <button
                onClick={() => setIsCustomMapModalOpen(true)}
                className="px-2 py-1 rounded-lg text-parchment/50 hover:text-purple-300 hover:bg-white/5 transition-colors font-mono text-[11px] flex items-center gap-1 border-l border-white/10 ml-0.5"
                title="Adicionar Novo Mapa de Masmorra Personalizado"
              >
                <Plus size={11} />
                <span className="hidden sm:inline">Mapa</span>
              </button>
            )}
          </div>

          {/* Session Selector (GM) OR Character Badge (Player) */}
          {isGM ? (
            <select
              value={selectedSessionId}
              onChange={(e) => {
                setSelectedSessionId(e.target.value);
                setSearchParams({ map: selectedMapId, ...(e.target.value ? { session: e.target.value } : {}) });
              }}
              className="bg-white/5 border border-white/10 text-parchment rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-arcane hidden lg:block"
            >
              {gmSessions.map(s => (
                <option key={s.id} value={s.id} className="bg-obsidian">
                  Campanha: {s.name}
                </option>
              ))}
            </select>
          ) : (
            userCharactersWithSession.length > 1 ? (
              <select
                value={selectedCharacterId}
                onChange={(e) => {
                  const char = userCharactersWithSession.find(c => c.id === e.target.value);
                  if (char) {
                    setSelectedCharacterId(char.id);
                    setSelectedSessionId(char.sessionId);
                    setUserCharacter(char);
                  }
                }}
                className="bg-white/5 border border-white/10 text-parchment rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-arcane hidden lg:block"
              >
                {userCharactersWithSession.map(c => {
                  const s = sessions.find(sess => sess.id === c.sessionId);
                  return (
                    <option key={c.id} value={c.id} className="bg-obsidian">
                      {c.name} ({s?.name || 'Campanha'})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs hidden lg:flex">
                <User size={13} className="text-arcane" />
                <span className="font-semibold text-arcane">{userCharacter?.name || 'Herói'}</span>
                <span className="text-parchment/40 text-[10px]">({activeSessionData?.name || 'Campanha'})</span>
              </div>
            )
          )}

          {/* Spawn / Join Token Button */}
          {!myToken ? (
            <button
              onClick={handleJoinDungeonWithMyToken}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-arcane to-emerald-400 text-obsidian text-xs font-semibold hover:opacity-95 transition-all shadow-lg flex items-center gap-1.5 animate-pulse"
            >
              <User size={14} />
              <span>Inserir Meu Token</span>
            </button>
          ) : (
            <button
              onClick={() => handleCenterOnToken(myToken)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-arcane text-xs font-mono transition-colors flex items-center gap-1.5 border border-arcane/30"
              title="Centralizar no meu personagem"
            >
              <Crosshair size={13} />
              <span className="hidden sm:inline">Meu Token ({myToken.name.split(' ')[0]})</span>
            </button>
          )}

          {/* Master Spawn Button */}
          <button
            onClick={() => setIsSpawnerOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 text-xs font-medium transition-colors flex items-center gap-1"
            title="Adicionar Monstro ou NPC"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Monstro / NPC</span>
          </button>

          {/* Return to World Map */}
          <Link
            to="/map"
            className="p-2 rounded-xl border border-white/10 hover:bg-white/5 text-parchment/60 hover:text-parchment transition-all text-xs"
            title="Voltar ao Mapa do Mundo Geral"
          >
            <MapIcon size={16} />
          </Link>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Interactive Battlemap Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onWheel={handleWheel}
          onClick={handleMapCellClick}
          className={cn(
            "flex-1 relative overflow-hidden bg-stone-950",
            activeTool === 'pan' && "cursor-grab active:cursor-grabbing",
            activeTool === 'select' && "cursor-default",
            activeTool === 'ruler' && "cursor-crosshair",
            activeTool === 'ping' && "cursor-cell",
            activeTool === 'fog' && (isGM ? "cursor-crosshair" : "cursor-default"),
            darknessMode && "brightness-75 contrast-125"
          )}
          style={{ touchAction: 'none' }}
        >
          {/* Live Multiplayer Movement Notice Toast */}
          <AnimatePresence>
            {movementNotice && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-black/90 backdrop-blur-md border border-arcane/60 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-mono pointer-events-none"
              >
                <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: movementNotice.color }} />
                <Footprints size={14} className="text-arcane" />
                <span className="text-parchment">
                  <strong style={{ color: movementNotice.color }}>{movementNotice.userName}</strong> moveu o token <strong className="text-arcane">{movementNotice.tokenName}</strong>!
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Tactical Mode Bar (Top-Left) */}
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute top-3 left-4 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl text-xs"
          >
            {/* Tool Selector: Mover (Toggle ON / OFF) */}
            <button
              onClick={() => setActiveTool(activeTool === 'select' ? 'pan' : 'select')}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1.5",
                activeTool === 'select' 
                  ? "bg-arcane/20 text-arcane border border-arcane/40 shadow-sm font-semibold" 
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title={activeTool === 'select' 
                ? "Opção Mover HABILITADA: Permite arrastar tokens e mover pelo mapa. Clique para bloquear." 
                : "Opção Mover BLOQUEADA: Clique para habilitar movimentação de tokens."}
            >
              <Move size={14} className={activeTool === 'select' ? "text-arcane animate-pulse" : "text-parchment/40"} />
              <span className="text-[11px] font-medium hidden sm:inline">Mover</span>
              <span className={cn(
                "text-[9px] px-1 py-0.5 rounded font-mono font-bold leading-none",
                activeTool === 'select' ? "bg-arcane/30 text-arcane border border-arcane/40" : "bg-white/10 text-parchment/40"
              )}>
                {activeTool === 'select' ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Tool Selector: Navegar (Pan da câmera seguro sem risco de mover tokens) */}
            <button
              onClick={() => setActiveTool('pan')}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1",
                activeTool === 'pan' 
                  ? "bg-stone-800 text-amber-300 border border-amber-500/40 shadow-sm font-semibold" 
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Modo Navegar / Pan: Arraste o mapa livremente e inspecione fichas sem mover nenhum token por acidente"
            >
              <Hand size={14} />
              <span className="text-[11px] font-medium hidden sm:inline">Navegar</span>
            </button>

            <button
              onClick={() => setActiveTool('ruler')}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1",
                activeTool === 'ruler' ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold" : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Régua de Medição Tática (Alcance)"
            >
              <Ruler size={14} />
              <span className="text-[11px] font-medium hidden sm:inline">Régua</span>
            </button>

            <button
              onClick={() => setActiveTool('ping')}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1",
                activeTool === 'ping' ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm font-semibold" : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Sinalizador / Alerta de Ping"
            >
              <Radio size={14} />
              <span className="text-[11px] font-medium hidden sm:inline">Ping</span>
            </button>

            <div className="h-4 w-px bg-white/10 mx-1" />

            {/* Grid Snap Toggle */}
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={cn(
                "px-2 py-1 rounded-xl text-[10px] font-mono transition-all",
                snapToGrid ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-parchment/40"
              )}
              title="Ajuste automático às células da grade"
            >
              Snap: {snapToGrid ? 'ON' : 'OFF'}
            </button>

            {/* Grid Visibility Toggle */}
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                "p-1.5 rounded-xl transition-all",
                showGrid ? "text-arcane" : "text-parchment/40"
              )}
              title="Alternar Visibilidade da Grade"
            >
              <Grid size={14} />
            </button>

            <div className="h-4 w-px bg-white/10 mx-1" />

            {/* Fog of War Tool Button */}
            <button
              onClick={() => setActiveTool(activeTool === 'fog' ? 'select' : 'fog')}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1.5",
                activeTool === 'fog' ? "bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm font-semibold" : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Ferramenta Névoa de Guerra (Revelar ou ocultar áreas da masmorra)"
            >
              <CloudFog size={14} className={fogEnabled ? "text-purple-400" : "text-parchment/40"} />
              <span className="text-[11px] font-medium hidden sm:inline">Névoa</span>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                fogEnabled ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-rose-500/60"
              )} />
            </button>
          </div>

          {/* Floating Fog of War GM Controls Toolbar (Top-Left under Mode Bar) */}
          {(activeTool === 'fog' || (isGM && fogEnabled)) && (
            <div 
              data-toolbar="true"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="absolute top-16 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-black/85 backdrop-blur-md p-2 rounded-2xl border border-purple-500/30 shadow-2xl text-xs max-w-2xl"
            >
              {/* Fog Enable / Disable Toggle */}
              <button
                onClick={handleToggleFogEnabled}
                className={cn(
                  "px-2.5 py-1 rounded-xl font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all border",
                  fogEnabled
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                )}
                title="Ativar ou desativar completamente a névoa de guerra nesta masmorra"
              >
                {fogEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>Névoa: {fogEnabled ? 'ATIVA' : 'DESATIVADA'}</span>
              </button>

              <div className="h-4 w-px bg-white/10 mx-0.5" />

              {/* Fog Brush Modes (Revelar vs Ocultar) */}
              <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10">
                <button
                  onClick={() => {
                    setActiveTool('fog');
                    setFogBrushMode('reveal');
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all",
                    fogBrushMode === 'reveal' && activeTool === 'fog'
                      ? "bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold"
                      : "text-parchment/60 hover:text-parchment"
                  )}
                  title="Pincel de Revelação: ilumina e revela áreas ocultas para os jogadores"
                >
                  <Sun size={11} className="text-amber-400" />
                  <span>Revelar (Luz)</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTool('fog');
                    setFogBrushMode('hide');
                  }}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all",
                    fogBrushMode === 'hide' && activeTool === 'fog'
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold"
                      : "text-parchment/60 hover:text-parchment"
                  )}
                  title="Pincel de Ocultação: cobre áreas de volta em névoa e escuridão"
                >
                  <Moon size={11} className="text-purple-400" />
                  <span>Ocultar (Trevas)</span>
                </button>
              </div>

              {/* Brush Size Selector */}
              <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 text-[10px] font-mono items-center">
                <span className="text-parchment/40 px-1 text-[9px]">Raio:</span>
                {[1, 2, 3, 5].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setActiveTool('fog');
                      setFogBrushSize(size as 1 | 2 | 3 | 5);
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded-md transition-all",
                      fogBrushSize === size
                        ? "bg-arcane/20 text-arcane border border-arcane/30 font-semibold"
                        : "text-parchment/50 hover:text-parchment"
                    )}
                    title={`Pincel de ${size}x${size} células`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>

              {/* Auto Reveal on Player Movement Toggle */}
              <button
                onClick={() => setAutoRevealOnMove(prev => !prev)}
                className={cn(
                  "px-2 py-1 rounded-xl text-[10px] font-mono flex items-center gap-1 transition-all border",
                  autoRevealOnMove
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold shadow-sm shadow-amber-500/10"
                    : "bg-white/5 text-parchment/50 border-white/10 hover:text-parchment"
                )}
                title="Auto-Revelar: Quando ativo, ao mover um token de jogador o mapa revela automaticamente a área ao redor"
              >
                <Flame size={11} className={autoRevealOnMove ? "text-amber-400" : "text-parchment/40"} />
                <span>Auto-Tocha {autoRevealOnMove ? "Ligada" : "Desligada"}</span>
              </button>

              {/* Perspective Mode (Mestre vs Jogador) */}
              {isGM && (
                <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 text-[10px] font-mono">
                  <button
                    onClick={() => setGmViewMode('gm')}
                    className={cn(
                      "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                      gmViewMode === 'gm'
                        ? "bg-purple-500/25 text-purple-300 border border-purple-500/30 font-semibold"
                        : "text-parchment/60 hover:text-parchment"
                    )}
                    title="Visão do Mestre: Névoa translúcida semi-transparente mostrando monstros ocultos e mapa de fundo"
                  >
                    <Eye size={11} />
                    <span>Visão Mestre</span>
                  </button>
                  <button
                    onClick={() => setGmViewMode('player')}
                    className={cn(
                      "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                      gmViewMode === 'player'
                        ? "bg-stone-800 text-amber-300 border border-amber-500/30 font-semibold"
                        : "text-parchment/60 hover:text-parchment"
                    )}
                    title="Visão dos Jogadores: Escuridão 100% opaca escondendo tudo que não foi revelado"
                  >
                    <Users size={11} />
                    <span>Visão Jogadores</span>
                  </button>
                </div>
              )}

              {/* Quick Actions Group */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRevealEntrance}
                  className="px-2 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1 transition-all"
                  title="Revela a entrada/início da masmorra (canto esquerdo inferior) para início da aventura"
                >
                  <Footprints size={11} />
                  <span>Revelar Entrada</span>
                </button>
                <button
                  onClick={handleRevealPlayerTokensArea}
                  className="px-2 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono flex items-center gap-1 transition-all"
                  title="Revela raio de 3x3 células em volta de todos os aventureiros"
                >
                  <Sparkles size={11} />
                  <span>Tocha Tokens</span>
                </button>
                <button
                  onClick={handleRevealAllFog}
                  className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-parchment/70 hover:text-parchment text-[10px] font-mono border border-white/10 transition-all"
                  title="Revela toda a masmorra"
                >
                  Revelar Tudo
                </button>
                <button
                  onClick={handleHideAllFog}
                  className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-rose-300 hover:text-rose-200 text-[10px] font-mono border border-white/10 transition-all"
                  title="Oculta todo o mapa de volta em escuridão"
                >
                  Ocultar Tudo
                </button>
              </div>

              {/* Cell Stats Badge */}
              <div className="text-[9px] font-mono text-parchment/40 ml-auto hidden lg:block">
                {revealedCells.size}/{activePreset.gridCols * activePreset.gridRows} células ({Math.round((revealedCells.size / (activePreset.gridCols * activePreset.gridRows)) * 100)}%)
              </div>
            </div>
          )}

          {/* Active Tokens / Players Count Badge (Top-Right) */}
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute top-3 right-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 shadow-2xl text-xs font-mono"
          >
            <Users size={14} className="text-arcane" />
            <span>Tokens Ativos: <strong className="text-arcane">{tokens.length}</strong></span>
            <span className="text-white/20">|</span>
            <span className="text-emerald-400">● Sincronização em Tempo Real</span>
          </div>

          {/* Map Image Transform Wrapper */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center'
            }}
          >
            <div data-map-wrapper="true" className="relative inline-block shadow-2xl rounded-xl overflow-hidden border-2 border-stone-800 min-w-[320px] min-h-[240px] bg-stone-950">
              {/* Actual Dungeon Battlemap Image */}
              {activePreset.imageUrl ? (
                <img
                  ref={mapImageRef}
                  src={activePreset.imageUrl}
                  alt={activePreset.name}
                  draggable={false}
                  data-map-overlay="true"
                  className="max-h-[82vh] max-w-[85vw] object-contain block pointer-events-auto select-none"
                />
              ) : (
                <div className="w-[80vw] max-w-3xl h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-obsidian/95 border border-white/10">
                  {targetDungeonLoading ? (
                    <>
                      <Skull size={40} className="text-purple-400 animate-pulse mb-4" />
                      <h3 className="font-serif text-xl font-bold text-parchment">Carregando Masmorra Cadastrada...</h3>
                      <p className="text-xs text-parchment/60 mt-1 font-mono">Buscando detalhes do battlemap no Arquivo Heroico</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 shadow-xl">
                        <Skull size={32} />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
                        Campanha Ativa
                      </span>
                      <h3 className="font-serif text-2xl font-bold text-glow-arcane">Nenhuma Masmorra Vinculada</h3>
                      <p className="text-sm text-parchment/70 max-w-md mx-auto mt-2 leading-relaxed">
                        De acordo com as regras do Arquivo Heroico, jogadores só visualizam os mapas de batalha e masmorras vinculados e ativados pelo Mestre para esta campanha.
                      </p>
                      <div className="mt-6 flex gap-3">
                        <button
                          type="button"
                          onClick={() => window.history.back()}
                          className="px-5 py-2.5 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-105 transition-transform"
                        >
                          Voltar à Ficha do Personagem
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tactical Grid Overlay */}
              {showGrid && (
                <div 
                  data-map-overlay="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${activePreset.gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${activePreset.gridRows}, 1fr)`
                  }}
                >
                  {Array.from({ length: activePreset.gridCols * activePreset.gridRows }).map((_, idx) => (
                    <div 
                      key={idx}
                      className="border border-white/[0.08] relative group"
                    >
                      {/* Optional coordinates in corners */}
                      {showCoords && (idx === 0 || idx % activePreset.gridCols === 0) && (
                        <span className="absolute top-0.5 left-0.5 text-[7px] font-mono text-white/30 leading-none">
                          {Math.floor(idx / activePreset.gridCols) + 1}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FOG OF WAR LAYER */}
              {fogEnabled && (
                <div 
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${activePreset.gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${activePreset.gridRows}, 1fr)`
                  }}
                >
                  {Array.from({ length: activePreset.gridCols * activePreset.gridRows }).map((_, idx) => {
                    const isRevealed = revealedCells.has(idx);
                    const isPlayerPerspective = !isGM || gmViewMode === 'player';

                    if (isRevealed) {
                      return <div key={idx} className="w-full h-full pointer-events-none" />;
                    }

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-full h-full transition-opacity duration-300 relative select-none",
                          isPlayerPerspective
                            ? "bg-[#09080b] opacity-[0.98]"
                            : "bg-[#09080b]/60 border border-purple-500/20 backdrop-blur-[0.5px]"
                        )}
                        style={{
                          backgroundImage: isPlayerPerspective 
                            ? 'radial-gradient(circle, rgba(18,16,22,0.99) 0%, rgba(9,8,11,1) 100%)' 
                            : undefined
                        }}
                      >
                        {!isPlayerPerspective && (
                          <div className="w-full h-full flex items-center justify-center opacity-30 text-purple-300">
                            <CloudFog size={10} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fog Brush Hover Overlay (Active when GM is painting Fog) */}
              {fogEnabled && isGM && activeTool === 'fog' && hoveredCellIndex !== null && (
                <div 
                  className="absolute inset-0 pointer-events-none z-15"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${activePreset.gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${activePreset.gridRows}, 1fr)`
                  }}
                >
                  {(() => {
                    const hCol = hoveredCellIndex % activePreset.gridCols;
                    const hRow = Math.floor(hoveredCellIndex / activePreset.gridCols);
                    const brushCells = new Set(getCellsInRadius(hCol, hRow, fogBrushSize, activePreset.gridCols, activePreset.gridRows));

                    return Array.from({ length: activePreset.gridCols * activePreset.gridRows }).map((_, idx) => {
                      if (!brushCells.has(idx)) return <div key={idx} />;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "w-full h-full border-2 transition-all animate-pulse",
                            fogBrushMode === 'reveal'
                              ? "bg-amber-400/25 border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                              : "bg-purple-600/30 border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          )}
                        />
                      );
                    });
                  })()}
                </div>
              )}

              {/* Ruler Measurement Line */}
              {rulerStart && rulerCurrent && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                  <line
                    x1={`${rulerStart.x}%`}
                    y1={`${rulerStart.y}%`}
                    x2={`${rulerCurrent.x}%`}
                    y2={`${rulerCurrent.y}%`}
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                  />
                  <circle cx={`${rulerStart.x}%`} cy={`${rulerStart.y}%`} r="5" fill="#f59e0b" />
                  <circle cx={`${rulerCurrent.x}%`} cy={`${rulerCurrent.y}%`} r="5" fill="#f59e0b" />
                  {/* Distance Tooltip */}
                  {(() => {
                    const dist = calculateDistance(rulerStart, rulerCurrent);
                    const midX = (rulerStart.x + rulerCurrent.x) / 2;
                    const midY = (rulerStart.y + rulerCurrent.y) / 2;
                    return (
                      <foreignObject x={`${midX - 10}%`} y={`${midY - 4}%`} width="20%" height="8%">
                        <div className="bg-black/90 border border-amber-500/50 text-amber-300 font-mono text-[10px] rounded-md py-0.5 px-1.5 shadow-xl text-center whitespace-nowrap">
                          {dist.squares} quad. | {dist.meters}m ({dist.feet}ft)
                        </div>
                      </foreignObject>
                    );
                  })()}
                </svg>
              )}

              {/* Real-time Multiplayer Pings */}
              {pings.map((ping) => (
                <div
                  key={ping.id}
                  style={{ left: `${ping.x}%`, top: `${ping.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40"
                >
                  <div className="relative">
                    <span 
                      style={{ backgroundColor: ping.color }}
                      className="absolute -inset-4 rounded-full animate-ping opacity-75"
                    />
                    <div 
                      style={{ borderColor: ping.color, backgroundColor: ping.color }}
                      className="w-4 h-4 rounded-full border-2 shadow-xl shadow-arcane flex items-center justify-center text-[8px] font-bold text-black"
                    >
                      !
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded bg-black/90 text-[9px] font-mono text-white whitespace-nowrap border border-white/20">
                      {ping.userName}
                    </div>
                  </div>
                </div>
              ))}

              {/* MULTIPLAYER TOKENS PLACED ON MAP */}
              {tokens.map((token) => {
                const isSelected = selectedTokenId === token.id;
                const isMyToken = user && token.userId === user.uid;
                const isDraggingThis = draggingTokenId === token.id;

                // Fog of War Token Concealment check
                const tokenCell = getCellIndexFromPct(token.x, token.y, activePreset.gridCols, activePreset.gridRows);
                const isCellRevealed = !fogEnabled || revealedCells.has(tokenCell);
                const isPlayerPerspective = !isGM || gmViewMode === 'player';

                // If cell is unrevealed and in Player Perspective, conceal monsters and NPCs!
                if (fogEnabled && isPlayerPerspective && !isCellRevealed && token.type !== 'player') {
                  return null; // completely hidden in the fog from players
                }

                const isHiddenInFog = fogEnabled && !isCellRevealed && token.type !== 'player';

                // Current position or dragged position
                const posX = isDraggingThis && dragTokenCurrentPos ? dragTokenCurrentPos.x : token.x;
                const posY = isDraggingThis && dragTokenCurrentPos ? dragTokenCurrentPos.y : token.y;

                // HP Percentage
                const hpPct = Math.max(0, Math.min(100, Math.round((token.hp / token.maxHp) * 100)));
                const hpColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 20 ? 'bg-yellow-500' : 'bg-rose-500';

                // Did token move recently? (Within 3.5 seconds)
                const isRecentlyMoved = token.lastMovedAt && (Date.now() - new Date(token.lastMovedAt).getTime() < 3500);

                return (
                  <div
                    key={token.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedTokenId(token.id);
                      // Só permite arrastar e mover o token se a opção Mover estiver habilitada
                      if (activeTool === 'select') {
                        setDraggingTokenId(token.id);
                        setDragTokenOriginPos({ x: token.x, y: token.y });
                        setDragTokenCurrentPos({ x: token.x, y: token.y });
                      }
                    }}
                    style={{
                      left: `${posX}%`,
                      top: `${posY}%`,
                      width: `${token.size === 2 ? 52 : 36}px`,
                      height: `${token.size === 2 ? 52 : 36}px`,
                      // Smooth transition when receiving moves from other players!
                      transition: isDraggingThis ? 'none' : 'left 280ms cubic-bezier(0.2, 0.8, 0.2, 1), top 280ms cubic-bezier(0.2, 0.8, 0.2, 1)'
                    }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 group z-20 select-none",
                      activeTool === 'select' ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                      isSelected ? "z-30 scale-110" : "hover:scale-105"
                    )}
                  >
                    {/* GM Indicator: Monster/NPC is hidden in Fog */}
                    {isHiddenInFog && (
                      <div 
                        className="absolute -top-1.5 -right-1.5 z-30 bg-purple-950 border border-purple-400 text-purple-200 rounded-full p-0.5 shadow-md"
                        title="Oculto na Névoa (Invisível para os jogadores)"
                      >
                        <EyeOff size={10} />
                      </div>
                    )}

                    {/* Pulsing Movement / Turn Aura */}
                    {(isRecentlyMoved || isSelected) && (
                      <span 
                        style={{ backgroundColor: token.color }}
                        className="absolute -inset-1.5 rounded-full animate-pulse opacity-50"
                      />
                    )}

                    {/* Token Disc / Avatar Container */}
                    <div 
                      style={{ borderColor: token.color }}
                      className={cn(
                        "w-full h-full rounded-full border-2 shadow-2xl flex items-center justify-center relative overflow-hidden bg-obsidian transition-all",
                        isSelected ? "ring-4 ring-white/60 shadow-arcane/80" : "hover:ring-2 hover:ring-white/40"
                      )}
                    >
                      {token.avatar ? (
                        <img 
                          src={token.avatar} 
                          alt={token.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div 
                          style={{ backgroundColor: `${token.color}25` }}
                          className="w-full h-full flex items-center justify-center font-serif font-bold text-xs"
                        >
                          {token.type === 'monster' ? (
                            <Skull size={18} className="text-rose-400" />
                          ) : token.type === 'npc' ? (
                            <Shield size={18} className="text-emerald-400" />
                          ) : (
                            <User size={18} style={{ color: token.color }} />
                          )}
                        </div>
                      )}

                      {/* Small Type Icon Badge on Bottom-Right */}
                      <div 
                        style={{ backgroundColor: token.color }}
                        className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black" 
                      />
                    </div>

                    {/* Miniature Tactical HP Bar over Token */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-black/80 border border-white/20 overflow-hidden pointer-events-none">
                      <div 
                        style={{ width: `${hpPct}%` }}
                        className={cn("h-full transition-all duration-300", hpColor)}
                      />
                    </div>

                    {/* Name Pill Beneath Token */}
                    <div 
                      className={cn(
                        "absolute top-full left-1/2 -translate-x-1/2 mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono whitespace-nowrap pointer-events-none transition-all shadow-md border",
                        isSelected 
                          ? "bg-black/95 text-arcane border-arcane/60 font-semibold opacity-100" 
                          : "bg-black/80 text-parchment/90 border-white/10 opacity-75 group-hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span>{token.name}</span>
                        {isRecentlyMoved && (
                          <span className="text-[7px] text-emerald-400">●</span>
                        )}
                      </div>
                    </div>

                    {/* Hover Card for Players */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-40 pointer-events-none">
                      <div className="bg-obsidian/95 border border-white/20 rounded-xl p-2 shadow-2xl text-left w-44 backdrop-blur-md">
                        <div className="flex items-center justify-between text-[10px] font-mono text-parchment/60 mb-1">
                          <span className="capitalize">{token.type}</span>
                          <span style={{ color: token.color }}>{token.userName}</span>
                        </div>
                        <h4 className="font-serif text-xs font-bold text-parchment truncate">
                          {token.name}
                        </h4>
                        <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                          <span>HP: <strong className="text-emerald-400">{token.hp}</strong> / {token.maxHp}</span>
                          {token.initiative ? <span>Inic: <strong>{token.initiative}</strong></span> : null}
                        </div>
                        {token.lastMovedBy && (
                          <div className="mt-1 pt-1 border-t border-white/10 text-[8px] font-mono text-parchment/40">
                            Último movimento por: {token.lastMovedBy}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Canvas Controls (Bottom-Right) */}
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl"
          >
            <button
              onClick={() => setScale(prev => Math.min(3.5, prev + 0.25))}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Aproximar (+)"
            >
              <ZoomIn size={18} />
            </button>
            <div className="text-[10px] font-mono text-center text-parchment/60 py-0.5">
              {Math.round(scale * 100)}%
            </div>
            <button
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Afastar (-)"
            >
              <ZoomOut size={18} />
            </button>
            <div className="h-px bg-white/10 my-0.5" />
            <button
              onClick={() => {
                setScale(1.1);
                setPosition({ x: 0, y: 0 });
              }}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Redefinir Câmera"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setDarknessMode(!darknessMode)}
              className={cn(
                "p-2 rounded-xl transition-all",
                darknessMode ? "bg-purple-500/20 text-purple-300" : "text-parchment/60 hover:bg-white/10"
              )}
              title="Modo Atmosférico de Penumbra"
            >
              {darknessMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Ajuda e Instruções de Navegação"
            >
              <HelpCircle size={16} />
            </button>
          </div>

          {/* Tactical D-Pad / Grid Step Controller (Bottom-Left) */}
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-4 z-20 flex flex-col items-center bg-black/75 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl"
          >
            <div className="text-[9px] font-mono text-parchment/60 mb-1 flex items-center gap-1">
              <Navigation size={10} className="text-arcane" />
              <span>Navegar ({((selectedToken || myToken)?.name || 'Token').split(' ')[0]})</span>
            </div>

            <div className="grid grid-cols-3 gap-1 w-24">
              <div />
              <button
                onClick={() => handleStepDirection('up')}
                disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
                title={activeTool === 'select' ? "Mover para Cima (W ou ↑)" : "Habilite a ferramenta Mover para usar as setas"}
              >
                <ArrowUp size={16} />
              </button>
              <div />

              <button
                onClick={() => handleStepDirection('left')}
                disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
                title={activeTool === 'select' ? "Mover para Esquerda (A ou ←)" : "Habilite a ferramenta Mover para usar as setas"}
              >
                <ArrowLeft size={16} />
              </button>

              <button
                onClick={() => {
                  const target = selectedToken || myToken;
                  if (target) handleCenterOnToken(target);
                }}
                disabled={!selectedToken && !myToken}
                className="p-2 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-arcane flex items-center justify-center transition-all disabled:opacity-30 border border-arcane/30"
                title="Centralizar Câmera no Token"
              >
                <Crosshair size={14} />
              </button>

              <button
                onClick={() => handleStepDirection('right')}
                disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
                title={activeTool === 'select' ? "Mover para Direita (D ou →)" : "Habilite a ferramenta Mover para usar as setas"}
              >
                <ArrowRight size={16} />
              </button>

              <div />
              <button
                onClick={() => handleStepDirection('down')}
                disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
                title={activeTool === 'select' ? "Mover para Baixo (S ou ↓)" : "Habilite a ferramenta Mover para usar as setas"}
              >
                <ArrowDown size={16} />
              </button>
              <div />
            </div>

            {activeTool === 'select' ? (
              <div className="text-[8px] font-mono text-parchment/40 mt-1">
                WASD / Setas
              </div>
            ) : (
              <div className="text-[8px] font-mono text-amber-400/80 mt-1 flex items-center gap-1">
                <Lock size={8} /> Mover bloqueado
              </div>
            )}
          </div>

          {/* Floating Selected Token HUD (Bottom-Center) */}
          {selectedToken && (
            <div 
              data-toolbar="true"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/85 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 px-4 shadow-2xl flex items-center gap-4 text-xs font-mono"
            >
              <div className="flex items-center gap-2.5">
                <div 
                  style={{ borderColor: selectedToken.color }}
                  className="w-8 h-8 rounded-full border-2 overflow-hidden bg-obsidian flex items-center justify-center shrink-0"
                >
                  {selectedToken.avatar ? (
                    <img src={selectedToken.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} style={{ color: selectedToken.color }} />
                  )}
                </div>
                <div>
                  <h4 className="font-serif text-sm font-bold text-parchment">
                    {selectedToken.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-parchment/60">
                    <span>{selectedToken.userName}</span>
                    <span>•</span>
                    <span className="text-emerald-400">HP {selectedToken.hp}/{selectedToken.maxHp}</span>
                  </div>
                </div>
              </div>

              <div className="h-6 w-px bg-white/10" />

              {/* HP Adjustment Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleUpdateHp(selectedToken.id, -5)}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-[10px]"
                >
                  -5
                </button>
                <button
                  onClick={() => handleUpdateHp(selectedToken.id, -1)}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-[10px]"
                >
                  -1
                </button>
                <button
                  onClick={() => handleUpdateHp(selectedToken.id, 1)}
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px]"
                >
                  +1
                </button>
                <button
                  onClick={() => handleUpdateHp(selectedToken.id, 5)}
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px]"
                >
                  +5
                </button>
              </div>

              <div className="h-6 w-px bg-white/10" />

              {/* Focus on token button */}
              <button
                onClick={() => handleCenterOnToken(selectedToken)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-arcane"
                title="Centralizar Câmera no Token"
              >
                <Crosshair size={16} />
              </button>

              {/* Delete Token button */}
              <button
                onClick={() => handleDeleteToken(selectedToken.id)}
                className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400"
                title="Remover Token"
              >
                <Trash2 size={16} />
              </button>

              <button
                onClick={() => setSelectedTokenId(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-parchment/40"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Turn Order / Initiative Bar (Top-Center Floating) */}
          {isTurnTrackerOpen && turnOrderTokens.length > 0 && (
            <div 
              data-toolbar="true"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1.5 px-3 rounded-full border border-white/15 shadow-xl max-w-lg overflow-x-auto no-scrollbar"
            >
              <span className="text-[10px] font-mono text-arcane uppercase mr-1 flex items-center gap-1">
                <Swords size={11} />
                <span>Turno:</span>
              </span>

              {turnOrderTokens.map((tok, idx) => {
                const isCurrentTurn = idx === activeTurnIndex % turnOrderTokens.length;
                return (
                  <div
                    key={tok.id}
                    onClick={() => {
                      setActiveTurnIndex(idx);
                      handleCenterOnToken(tok);
                    }}
                    style={{ borderColor: tok.color }}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all relative overflow-hidden shrink-0",
                      isCurrentTurn ? "ring-2 ring-white scale-110 shadow-lg" : "opacity-60 hover:opacity-100"
                    )}
                    title={`${tok.name} (Inic: ${tok.initiative || '?'})`}
                  >
                    {tok.avatar ? (
                      <img src={tok.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold" style={{ color: tok.color }}>
                        {tok.name.substring(0, 2)}
                      </span>
                    )}
                    {isCurrentTurn && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-arcane animate-ping" />
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => {
                  const nextIdx = (activeTurnIndex + 1) % turnOrderTokens.length;
                  setActiveTurnIndex(nextIdx);
                  if (turnOrderTokens[nextIdx]) {
                    handleCenterOnToken(turnOrderTokens[nextIdx]);
                  }
                }}
                className="ml-1 p-1 rounded-full bg-arcane/20 text-arcane hover:bg-arcane/30 text-[10px] font-mono flex items-center gap-0.5"
                title="Avançar para próximo turno"
              >
                <span>Próximo</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Monster & NPC Spawner Modal */}
      <AnimatePresence>
        {isSpawnerOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skull size={18} className="text-purple-400" />
                  <h3 className="font-serif text-lg font-bold text-parchment">
                    Inserir Token de Monstro / NPC na Masmorra
                  </h3>
                </div>
                <button
                  onClick={() => setIsSpawnerOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <p className="text-xs text-parchment/60">
                  Selecione um dos modelos abaixo para posicionar um monstro ou aliado na entrada da masmorra. Todos os jogadores conectados verão a movimentação em tempo real.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MONSTER_PRESETS.map((m, idx) => {
                    const MIcon = m.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSpawnPreset(m)}
                        className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 cursor-pointer transition-all flex items-center gap-3 group"
                      >
                        <div 
                          style={{ borderColor: m.color }}
                          className="w-9 h-9 rounded-full border-2 flex items-center justify-center bg-black/40 shrink-0"
                        >
                          <MIcon size={18} style={{ color: m.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-serif text-xs font-bold text-parchment group-hover:text-purple-300 truncate">
                            {m.name}
                          </h5>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-parchment/50 mt-0.5">
                            <span>HP: {m.hp}</span>
                            <span>•</span>
                            <span>Tam: {m.size}x{m.size}</span>
                          </div>
                        </div>
                        <span className="text-xs text-purple-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          +
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-end">
                <button
                  onClick={() => setIsSpawnerOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help / Instructions Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Compass size={18} className="text-arcane" />
                  <h3 className="font-serif text-base font-bold text-parchment">
                    Como Navegar e Mover Tokens
                  </h3>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-parchment/80 leading-relaxed font-sans">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-arcane block mb-1">🎮 Movimentação Multiplayer:</strong>
                  <span>Arraste seu token com o mouse ou clique nele e use as teclas <strong>WASD</strong> ou <strong>Setas do Teclado</strong> para andar pelas células da grade. Qualquer jogador logado assiste seu token se deslocando instantaneamente!</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-amber-400 block mb-1">📏 Régua Tática:</strong>
                  <span>Clique na ferramenta <strong>Régua</strong> no menu superior e arraste para medir a distância exata em metros e quadrados para calcular alcance de magias e ataques.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-rose-400 block mb-1">📡 Sinalizador (Ping):</strong>
                  <span>Clique no mapa com a ferramenta <strong>Ping</strong> para alertar os outros jogadores ("Atenção aqui!"). Uma onda luminosa animada surge no local para todos.</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-arcane text-obsidian text-xs font-semibold hover:bg-arcane/90"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Dungeon Map Creator Modal */}
      <AnimatePresence>
        {isCustomMapModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <MapIcon size={18} className="text-purple-400" />
                  <h3 className="font-serif text-lg font-bold text-parchment">
                    Criar Novo Battlemap de Dungeon
                  </h3>
                </div>
                <button
                  onClick={() => setIsCustomMapModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveCustomMap} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-mono text-parchment/70 uppercase mb-1">
                    Nome da Masmorra *
                  </label>
                  <input
                    type="text"
                    required
                    value={customMapForm.name}
                    onChange={(e) => setCustomMapForm({ ...customMapForm, name: e.target.value })}
                    placeholder="Ex: Templo Subterrâneo Proibido"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-parchment focus:outline-none focus:border-arcane"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-parchment/70 uppercase mb-1">
                    Descrição / Subtítulo
                  </label>
                  <input
                    type="text"
                    value={customMapForm.subtitle}
                    onChange={(e) => setCustomMapForm({ ...customMapForm, subtitle: e.target.value })}
                    placeholder="Ex: Nível 2 das ruínas sombrias com armadilhas"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-parchment focus:outline-none focus:border-arcane"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-parchment/70 uppercase mb-1">
                    URL da Imagem do Mapa (Battlemap) *
                  </label>
                  <input
                    type="url"
                    required
                    value={customMapForm.imageUrl}
                    onChange={(e) => setCustomMapForm({ ...customMapForm, imageUrl: e.target.value })}
                    placeholder="https://exemplo.com/battlemap_grid.jpg"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-parchment focus:outline-none focus:border-arcane font-mono text-xs"
                  />
                  <div className="flex gap-2 mt-1.5 text-[11px] text-parchment/50">
                    <span>Exemplos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => setCustomMapForm({ ...customMapForm, imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80' })}
                      className="text-arcane hover:underline"
                    >
                      Ruínas Antigas
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setCustomMapForm({ ...customMapForm, imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80' })}
                      className="text-purple-400 hover:underline"
                    >
                      Câmara Mística
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-mono text-parchment/70 uppercase mb-1">
                      Colunas da Grade
                    </label>
                    <input
                      type="number"
                      min="8"
                      max="48"
                      value={customMapForm.gridCols}
                      onChange={(e) => setCustomMapForm({ ...customMapForm, gridCols: Number(e.target.value) || 24 })}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-parchment focus:outline-none focus:border-arcane font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-parchment/70 uppercase mb-1">
                      Linhas da Grade
                    </label>
                    <input
                      type="number"
                      min="6"
                      max="36"
                      value={customMapForm.gridRows}
                      onChange={(e) => setCustomMapForm({ ...customMapForm, gridRows: Number(e.target.value) || 14 })}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-parchment focus:outline-none focus:border-arcane font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomMapModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold shadow-lg transition-all"
                  >
                    Salvar e Abrir Battlemap
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Map Manager Modal (GM Full Control) */}
      {isGM && (
        <CampaignMapManagerModal
          isOpen={isCampaignManagerModalOpen}
          onClose={() => setIsCampaignManagerModalOpen(false)}
          sessionId={selectedSessionId}
          sessionName={activeSessionData?.name || 'Campanha'}
          worldMaps={campaignWorldMaps}
          dungeonMaps={campaignDungeonMaps}
          onSelectMap={(type, id) => {
            if (type === 'dungeon') {
              setSelectedMapId(id);
              setSearchParams({ map: id, ...(selectedSessionId ? { session: selectedSessionId } : {}) });
            } else {
              navigate(`/map?map=${id}&session=${selectedSessionId}`);
            }
          }}
        />
      )}
    </div>
  );
}
