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
  Unlock,
  MapPin,
  Scroll,
  Tv,
  Maximize2,
  Minimize2,
  Zap,
  Keyboard,
  Shapes,
  Disc,
  Droplets,
  Dices,
  VolumeX,
  CloudRain,
  ChevronLeft,
  Sliders,
  Music,
  ChevronDown,
  RotateCw,
  LayoutGrid
} from 'lucide-react';
import { cn } from '../lib/utils';
import { MapDrawingOverlay } from './map/MapDrawingOverlay';
import { MapDrawingToolbar } from './map/MapDrawingToolbar';
import RoomShapeLibraryModal, { RoomShapeDefinition } from './map/RoomShapeLibraryModal';
import { DungeonMapMarker, MapDrawingStroke } from '../types/mapDrawing';
import { playPingAudioAlert } from '../lib/pingSound';
import CharacterSheet from './CharacterSheet';
import BestiaryModal from './BestiaryModal';
import EncounterGeneratorModal from './EncounterGeneratorModal';
import SoundEffectManager from './SoundEffectManager';
import GMAudioController from './GMAudioController';
import { SoundConfig } from '../lib/soundEngine';
import MapAtmosphereOverlay, { WeatherType, WEATHER_OPTIONS } from './MapAtmosphereOverlay';
import { 
  atmospherePlayer, 
  ATMOSPHERE_PRESETS, 
  AtmosphereType 
} from '../lib/atmosphereEngine';
import { Monster, GeneratedEncounter } from '../types/bestiary';
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
  hidden?: boolean;
  isHidden?: boolean;
  lastMovedAt?: string;
  lastMovedBy?: string;
}

export interface PingData {
  id: string;
  x: number;
  y: number;
  userName: string;
  userId?: string;
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

export const DUNGEON_MARKER_CATEGORIES: Record<DungeonMapMarker['category'], {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
}> = {
  danger: { label: 'Perigo / Atenção', icon: Flame, color: '#ef4444', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  trap: { label: 'Armadilha', icon: AlertTriangle, color: '#a855f7', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  treasure: { label: 'Tesouro / Baú', icon: Gem, color: '#f59e0b', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  door: { label: 'Porta / Passagem', icon: Landmark, color: '#10b981', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  poi: { label: 'Ponto de Interesse', icon: Sparkles, color: '#38bdf8', bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  target: { label: 'Alvo / Foco', icon: Crosshair, color: '#f43f5e', bg: 'bg-rose-600/20 text-rose-300 border-rose-600/40' },
  note: { label: 'Anotação Tática', icon: BookOpen, color: '#eab308', bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
};

export interface AoeTemplate {
  id: string;
  type: 'circle' | 'cone' | 'line' | 'cube';
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  targetX?: number; // for cone / line direction
  targetY?: number;
  radiusFeet: number; // e.g. 5, 10, 15, 20, 30
  rotation?: number; // 0 - 360 degrees
  color: string;
  name?: string;
  createdBy?: string;
  createdAt?: string;
  dungeonId: string;
  sessionId?: string;
}

export const TOKEN_CONDITIONS = [
  { id: 'poisoned', name: 'Envenenado', color: '#10b981', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', symbol: '☠', desc: 'Sofre dano contínuo ou desvantagem' },
  { id: 'stunned', name: 'Atordoado', color: '#eab308', bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', symbol: '⚡', desc: 'Incapacitado de agir neste turno' },
  { id: 'bleeding', name: 'Sangrando', color: '#ef4444', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40', symbol: '🩸', desc: 'Perde PV a cada rodada ao agir' },
  { id: 'burning', name: 'Em Chamas', color: '#f97316', bg: 'bg-orange-500/20 text-orange-300 border-orange-500/40', symbol: '🔥', desc: 'Queima viva causando dano por fogo' },
  { id: 'prone', name: 'Caído', color: '#8b5cf6', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', symbol: '🛌', desc: 'No chão; ataques corpo a corpo têm vantagem' },
  { id: 'blinded', name: 'Cego', color: '#64748b', bg: 'bg-slate-500/20 text-slate-300 border-slate-500/40', symbol: '👁️', desc: 'Não pode ver, falha em testes de visão' },
  { id: 'frightened', name: 'Aterrorizado', color: '#d946ef', bg: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40', symbol: '😱', desc: 'Desvantagem enquanto a fonte do medo estiver visível' },
  { id: 'invisible', name: 'Invisível', color: '#38bdf8', bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40', symbol: '👻', desc: 'Impossível de ser visto a olho nu' },
  { id: 'blessed', name: 'Abençoado', color: '#06b6d4', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', symbol: '✨', desc: 'Bônus em ataques, testes ou resistências' },
  { id: 'weakened', name: 'Enfraquecido', color: '#a8a29e', bg: 'bg-stone-500/20 text-stone-300 border-stone-500/40', symbol: '🛡️', desc: 'Dano ou forças reduzidas pela metade' }
];

export const AOE_SPELL_PRESETS = [
  { name: 'Bola de Fogo (Esfera 20 pés)', type: 'circle' as const, radiusFeet: 20, color: '#ef4444' },
  { name: 'Sopro de Dragão (Cone 30 pés)', type: 'cone' as const, radiusFeet: 30, color: '#f97316' },
  { name: 'Relâmpago (Linha 60 pés)', type: 'line' as const, radiusFeet: 60, color: '#38bdf8' },
  { name: 'Névoa / Nuvem Tóxica (Cubo 20 pés)', type: 'cube' as const, radiusFeet: 20, color: '#10b981' },
  { name: 'Espíritos Guardiões (Esfera 15 pés)', type: 'circle' as const, radiusFeet: 15, color: '#eab308' },
  { name: 'Cone de Frio (Cone 60 pés)', type: 'cone' as const, radiusFeet: 60, color: '#06b6d4' },
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
  const isCustomTargetRequested = Boolean(initialMap && !['catacombs', 'temple', 'cavern'].includes(initialMap));
  const [targetDungeonDoc, setTargetDungeonDoc] = React.useState<DungeonPreset | null>(null);
  const [targetDungeonLoading, setTargetDungeonLoading] = React.useState<boolean>(isCustomTargetRequested);

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

  // Tool Modes: 'select' (Mover) | 'pan' (Navegar Câmera) | 'ruler' | 'ping' | 'fog' | 'aoe'
  const [activeTool, setActiveTool] = React.useState<'select' | 'pan' | 'ruler' | 'ping' | 'fog' | 'aoe'>('select');

  // Drag vs Click distinction refs to prevent unwanted token teleportation
  const mouseDownPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = React.useRef<number>(0);
  const wasDraggingRef = React.useRef<boolean>(false);

  // Helper: check if a click or mousedown originated from any floating toolbar, button, or UI HUD
  const isToolbarClick = (target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('button, input, select, textarea, [data-toolbar], [data-no-map-click]'));
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

  // Area of Effect (AoE) Templates State
  const [aoeTemplates, setAoeTemplates] = React.useState<AoeTemplate[]>([]);
  const [aoeType, setAoeType] = React.useState<'circle' | 'cone' | 'line' | 'cube'>('circle');
  const [aoeRadiusFeet, setAoeRadiusFeet] = React.useState<number>(20);
  const [aoeRotation, setAoeRotation] = React.useState<number>(0);
  const [aoeColor, setAoeColor] = React.useState<string>('#ef4444');
  const [aoeName, setAoeName] = React.useState<string>('Bola de Fogo');

  // AoE Dragging State (Arrastar magias criadas pelo mapa)
  const [draggingAoeId, setDraggingAoeId] = React.useState<string | null>(null);
  const [dragAoeCurrentPos, setDragAoeCurrentPos] = React.useState<{ x: number; y: number } | null>(null);
  const [dragAoeOriginPos, setDragAoeOriginPos] = React.useState<{ x: number; y: number } | null>(null);

  // Pre-defined Room Shapes Library State
  const [isRoomShapesModalOpen, setIsRoomShapesModalOpen] = React.useState<boolean>(false);
  const [activeStampShape, setActiveStampShape] = React.useState<RoomShapeDefinition | null>(null);
  const [stampColor, setStampColor] = React.useState<string>('#64748b');
  const [stampCursorGrid, setStampCursorGrid] = React.useState<{ col: number; row: number; pctX: number; pctY: number } | null>(null);

  // TV / Tabletop Fullscreen Mode
  const [isTvMode, setIsTvMode] = React.useState<boolean>(false);

  // Keyboard Shortcuts Modal State
  const [isShortcutsOpen, setIsShortcutsOpen] = React.useState<boolean>(false);

  // Conditions Selection Popover
  const [isConditionsPopoverOpen, setIsConditionsPopoverOpen] = React.useState<boolean>(false);

  // Movement Range Aura state
  const [showMovementRange, setShowMovementRange] = React.useState<boolean>(false);

  // Quick Attack & Roll Notification Toast
  const [quickRollNotice, setQuickRollNotice] = React.useState<{
    tokenName: string;
    d20: number;
    bonus: number;
    total: number;
    isCrit: boolean;
    isFumble: boolean;
    color: string;
    timestamp: number;
  } | null>(null);

  // Freehand Map Drawing state
  const [isDrawingMode, setIsDrawingMode] = React.useState(false);
  const [drawingTool, setDrawingTool] = React.useState<'pen' | 'polygon' | 'eraser'>('pen');
  const [drawingColor, setDrawingColor] = React.useState('#38bdf8');
  const [drawingStrokeSize, setDrawingStrokeSize] = React.useState(3);

  // Undo / Redo History Stack for DungeonMap Drawings & Polygons
  const [drawingUndoStack, setDrawingUndoStack] = React.useState<{ type: 'add' | 'delete'; docId: string; stroke: MapDrawingStroke }[]>([]);
  const [drawingRedoStack, setDrawingRedoStack] = React.useState<{ type: 'add' | 'delete'; docId: string; stroke: MapDrawingStroke }[]>([]);

  // Tactical Dungeon Markers (Marcadores táticos)
  const [markers, setMarkers] = React.useState<DungeonMapMarker[]>([]);
  const [isAddingMarker, setIsAddingMarker] = React.useState(false);
  const [selectedMarker, setSelectedMarker] = React.useState<DungeonMapMarker | null>(null);
  const [newMarkerCoord, setNewMarkerCoord] = React.useState<{ x: number; y: number } | null>(null);
  const [markerDraft, setMarkerDraft] = React.useState<{
    label: string;
    category: DungeonMapMarker['category'];
    description: string;
    color: string;
  }>({
    label: '',
    category: 'danger',
    description: '',
    color: '#ef4444'
  });

  // Real-time Pings
  const [pings, setPings] = React.useState<PingData[]>([]);

  // UI Modals & Drawers
  const [isSpawnerOpen, setIsSpawnerOpen] = React.useState(false);
  const [isBestiaryOpen, setIsBestiaryOpen] = React.useState(false);
  const [isEncounterGeneratorOpen, setIsEncounterGeneratorOpen] = React.useState(false);
  const [isAtmospherePanelOpen, setIsAtmospherePanelOpen] = React.useState(false);
  const [isSoundManagerModalOpen, setIsSoundManagerModalOpen] = React.useState(false);

  // Quick Menu Dropdowns
  const [isMapDropdownOpen, setIsMapDropdownOpen] = React.useState(false);
  const [isGmCreaturesMenuOpen, setIsGmCreaturesMenuOpen] = React.useState(false);
  const [isDpadCollapsed, setIsDpadCollapsed] = React.useState(false);

  // Atmosphere & Audio Soundscape State
  const [activeSoundscape, setActiveSoundscape] = React.useState<AtmosphereType>('off');
  const [customAmbientUrl, setCustomAmbientUrl] = React.useState<string>('');
  const [customAmbientName, setCustomAmbientName] = React.useState<string>('');
  const [activeWeather, setActiveWeather] = React.useState<WeatherType>('none');
  const [atmosphereVolume, setAtmosphereVolume] = React.useState<number>(0.6);
  const [isAtmosphereMuted, setIsAtmosphereMuted] = React.useState<boolean>(false);

  // Campaign sounds memo for GMAudioController
  const campaignSounds: SoundConfig = React.useMemo(() => ({
    ...(activeSessionData?.soundSettings || {}),
    ...(activeSessionData || {}),
    customAmbientSound: customAmbientUrl,
    customAmbientName: customAmbientName
  }), [activeSessionData, customAmbientUrl, customAmbientName]);

  // Combat & Turn Tracker State
  const [isTurnTrackerOpen, setIsTurnTrackerOpen] = React.useState(true);
  const [activeTurnIndex, setActiveTurnIndex] = React.useState(0);
  const [combatRound, setCombatRound] = React.useState(1);
  const [inCombat, setInCombat] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  // Character Sheet Modal State
  const [sheetModalCharacterId, setSheetModalCharacterId] = React.useState<string | null>(null);

  // Campaign characters (from active campaign session)
  const [campaignCharacters, setCampaignCharacters] = React.useState<any[]>([]);

  // Spawner active tab: 'players' | 'monsters'
  const [spawnerTab, setSpawnerTab] = React.useState<'players' | 'monsters'>('players');

  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapImageRef = React.useRef<HTMLImageElement>(null);

  // Load Campaign Characters for Party Tokens and Spawner
  React.useEffect(() => {
    if (!selectedSessionId) {
      setCampaignCharacters([]);
      return;
    }
    const qCampaignChars = query(
      collection(db, 'characters'),
      where('sessionId', '==', selectedSessionId)
    );
    const unsub = onSnapshot(qCampaignChars, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCampaignCharacters(list);
    }, (err) => {
      console.warn('Error loading campaign characters:', err);
    });
    return () => unsub();
  }, [selectedSessionId]);

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

  // Sync Dungeon Map context with global floating ActionMenu
  React.useEffect(() => {
    const currentSessionId = selectedSessionId || userCharactersWithSession[0]?.sessionId;
    window.dispatchEvent(new CustomEvent('action_menu_context_update', {
      detail: {
        sessionId: currentSessionId || undefined,
        isGM,
        senderOverride: isGM 
          ? { name: 'Mestre', photo: user?.photoURL || '' } 
          : { name: userCharacter?.name || user?.displayName || 'Jogador', photo: userCharacter?.image || user?.photoURL || '' },
        notesTargetType: 'campaign',
        notesTargetId: currentSessionId || 'general',
        notesTargetName: activeSessionData?.name || 'Campanha',
        characterContext: userCharacter ? { id: userCharacter.id, name: userCharacter.name } : undefined
      }
    }));
  }, [selectedSessionId, isGM, user, userCharacter, activeSessionData, userCharactersWithSession]);

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

    // 4. Se a masmorra solicitada for personalizada e ainda estiver carregando, NUNCA puxar o modelo base!
    if (selectedMapId && !['catacombs', 'temple', 'cavern'].includes(selectedMapId)) {
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

    // 5. Se for Mestre e estiver em modelo base: primeira masmorra disponível ou modelo base
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
          hidden: Boolean(d.hidden || d.isHidden),
          isHidden: Boolean(d.hidden || d.isHidden),
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
        if (now - (d.timestamp || 0) < 30000) { // keep pings for up to 30s unless removed
          list.push({
            id: docSnap.id,
            x: d.x,
            y: d.y,
            userName: d.userName || 'Jogador',
            userId: d.userId,
            color: d.color || '#06b6d4',
            timestamp: d.timestamp || now
          });
        }
      });
      setPings(list);
    }, (err) => {
      console.warn('Dungeon pings subscription warning:', err);
    });

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPings(prev => prev.filter(p => now - (p.timestamp || 0) < 30000));
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [user, activeDungeonKey]);

  // Real-time AoE Spell Templates Listener
  React.useEffect(() => {
    if (!user || !activeDungeonKey) return;
    const qAoE = query(
      collection(db, 'dungeonAoEs'),
      where('dungeonId', '==', activeDungeonKey)
    );

    const unsubscribe = onSnapshot(qAoE, (snapshot) => {
      const list: AoeTemplate[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AoeTemplate);
      });
      setAoeTemplates(list);
    }, (err) => {
      console.warn('AoE templates subscription warning:', err);
    });

    return () => unsubscribe();
  }, [user, activeDungeonKey]);

  // Real-time Dungeon Markers Listener
  React.useEffect(() => {
    if (!user || !activeDungeonKey) return;
    const qMarkers = query(
      collection(db, 'dungeonMarkers'),
      where('mapId', '==', activeDungeonKey)
    );

    const unsub = onSnapshot(qMarkers, (snapshot) => {
      const list: DungeonMapMarker[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!selectedSessionId || !data.sessionId || data.sessionId === selectedSessionId) {
          list.push({ id: docSnap.id, ...data } as DungeonMapMarker);
        }
      });
      setMarkers(list);
    }, (err) => {
      console.warn('Dungeon markers subscription warning:', err);
    });

    return () => unsub();
  }, [user, activeDungeonKey, selectedSessionId]);

  // Real-time Atmosphere (Audio Soundscapes & Visual Weather) and Combat Synchronization
  React.useEffect(() => {
    if (!activeDungeonKey) return;
    const unsub = onSnapshot(doc(db, 'dungeonAtmosphere', activeDungeonKey), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const soundscape = (data.soundscape as AtmosphereType) || 'off';
        const weather = (data.weather as WeatherType) || 'none';
        const round = typeof data.combatRound === 'number' ? data.combatRound : 1;
        const combat = Boolean(data.inCombat);
        const cUrl = data.customAmbientUrl || '';
        const cName = data.customAmbientName || '';
        setActiveSoundscape(soundscape);
        setActiveWeather(weather);
        setCombatRound(round);
        setInCombat(combat);
        setCustomAmbientUrl(cUrl);
        setCustomAmbientName(cName);
      }
    }, (err) => {
      console.warn('Atmosphere listener warning:', err);
    });
    return () => unsub();
  }, [activeDungeonKey]);

  // Synchronize procedural audio or custom ambient track with activeSoundscape and volume
  React.useEffect(() => {
    if (isAtmosphereMuted) {
      atmospherePlayer.stop();
      return;
    }
    atmospherePlayer.setVolume(atmosphereVolume);
    if (customAmbientUrl) {
      atmospherePlayer.playCustomTrack(customAmbientUrl, customAmbientName || 'Ambiência Personalizada');
    } else if (activeSoundscape && activeSoundscape !== 'off' && activeSoundscape !== 'none') {
      atmospherePlayer.play(activeSoundscape);
    } else {
      atmospherePlayer.stop();
    }
  }, [activeSoundscape, customAmbientUrl, customAmbientName, atmosphereVolume, isAtmosphereMuted]);

  // Cleanup audio on component unmount
  React.useEffect(() => {
    return () => {
      atmospherePlayer.stop();
    };
  }, []);

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

  // Visible Turn Order (Filtered by Fog of War and Hidden State for players!)
  const visibleTurnOrderTokens = React.useMemo(() => {
    return turnOrderTokens.filter(t => {
      const isExplicitlyHidden = Boolean(t.hidden || t.isHidden);
      if (isExplicitlyHidden && (!isGM || gmViewMode === 'player')) return false;
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

  // Helper: extract character sheet data for token (Nome, HP, Imagem, Iniciativa etc.)
  const extractCharacterDataForToken = (char: any) => {
    if (!char) return null;
    const name = char.name || 'Herói';
    const avatar = char.image || char.avatar || user?.photoURL || '';

    const stats = char.stats || char.baseStats || {};
    const forca = Number(stats.for || stats.forca || 10);
    const con = Number(stats.con || stats.constituicao || 10);
    const formulaMaxHp = Math.max(10, Math.round(((forca / 2) + con) * 10));

    const maxHp = Number(char.maxPV ?? char.attributes?.maxHp ?? formulaMaxHp);
    const currentHp = Number(char.currentPV ?? char.attributes?.currentHp ?? maxHp);

    const iniBonus = Number(stats.ini ?? char.baseStats?.ini ?? stats.iniciativa ?? stats.agi ?? 0);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const initiative = d20 + iniBonus;

    return {
      name,
      avatar,
      hp: currentHp,
      maxHp,
      initiative,
      iniBonus,
      characterId: char.id,
      userId: char.ownerId || '',
      userName: char.ownerName || char.name
    };
  };

  // Automatically spawn / join token for current user with full character sheet data
  const handleJoinDungeonWithMyToken = async () => {
    if (!user) return;

    const assignedColor = PLAYER_COLORS[tokens.filter(t => t.type === 'player').length % PLAYER_COLORS.length];
    const initialPos = snapCoordinate(activePreset.entranceCoord.x, activePreset.entranceCoord.y);

    // Prefer full character in campaignCharacters, then userCharacter, then userCharactersWithSession
    const fullChar = (campaignCharacters.find(c => c.ownerId === user.uid || c.id === selectedCharacterId))
      || userCharacter
      || userCharactersWithSession.find(c => c.id === selectedCharacterId)
      || userCharactersWithSession[0];

    const charData = extractCharacterDataForToken(fullChar);

    const newToken: Partial<DungeonTokenData> = {
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'Jogador',
      characterId: charData?.characterId || userCharacter?.id || '',
      name: charData?.name || userCharacter?.name || user.displayName || 'Aventureiro',
      avatar: charData?.avatar || userCharacter?.avatar || user.photoURL || '',
      color: assignedColor,
      type: 'player',
      hp: charData?.hp ?? 20,
      maxHp: charData?.maxHp ?? 20,
      x: initialPos.x,
      y: initialPos.y,
      size: 1,
      initiative: charData?.initiative ?? (Math.floor(Math.random() * 20) + 1),
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

  // Spawn a campaign player's token on the battlemap with their full character sheet data
  const handleSpawnPlayerCharacterToken = async (char: any) => {
    if (!char) return;
    const charData = extractCharacterDataForToken(char);
    if (!charData) return;

    const assignedColor = PLAYER_COLORS[tokens.filter(t => t.type === 'player').length % PLAYER_COLORS.length];
    const initialPos = snapCoordinate(activePreset.entranceCoord.x, activePreset.entranceCoord.y);

    const newToken: Partial<DungeonTokenData> = {
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      userId: charData.userId || user?.uid || '',
      userName: charData.userName || char.name || 'Jogador',
      characterId: charData.characterId,
      name: charData.name,
      avatar: charData.avatar,
      color: assignedColor,
      type: 'player',
      hp: charData.hp,
      maxHp: charData.maxHp,
      x: initialPos.x,
      y: initialPos.y,
      size: 1,
      initiative: charData.initiative,
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: user?.displayName || (isGM ? 'Mestre' : 'Jogador')
    };

    try {
      const docRef = await addDoc(collection(db, 'dungeonTokens'), newToken);
      setSelectedTokenId(docRef.id);
      setIsSpawnerOpen(false);
    } catch (err) {
      console.error('Failed to spawn player token:', err);
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

  // Global & Tactical Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if user is typing in an input, textarea or select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      // ESC: Clear ruler, aoe, markers, exit TV mode, deselect token, or close modals
      if (e.key === 'Escape') {
        if (rulerStart || activeTool === 'ruler') {
          setRulerStart(null);
          setRulerCurrent(null);
          setActiveTool('select');
          return;
        }
        if (activeTool === 'aoe') {
          setActiveTool('select');
          return;
        }
        if (isAddingMarker) {
          setIsAddingMarker(false);
          setNewMarkerCoord(null);
          return;
        }
        if (isTvMode) {
          setIsTvMode(false);
          return;
        }
        if (selectedTokenId) {
          setSelectedTokenId(null);
          return;
        }
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (isConditionsPopoverOpen) {
          setIsConditionsPopoverOpen(false);
          return;
        }
      }

      // '?' key: Open Keyboard Shortcuts Modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }

      // 'T' or 't': Toggle TV / Tabletop Mode
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setIsTvMode(prev => !prev);
        return;
      }

      // 'G' or 'g': Toggle Grid
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowGrid(prev => !prev);
        return;
      }

      // 'M' or 'm' or 'V' or 'v': Toggle Move / Select mode
      if (e.key === 'm' || e.key === 'M' || e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setActiveTool(prev => prev === 'select' ? 'pan' : 'select');
        return;
      }

      // 'R' or 'r': Switch to Ruler
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setActiveTool(prev => {
          if (prev === 'ruler') {
            setRulerStart(null);
            setRulerCurrent(null);
            return 'select';
          }
          return 'ruler';
        });
        return;
      }

      // 'A' or 'a': Switch to AoE Spell Templates
      if (e.key === 'a' || e.key === 'A') {
        if (activeTool !== 'select' || !selectedToken) {
          e.preventDefault();
          setActiveTool(prev => prev === 'aoe' ? 'select' : 'aoe');
          return;
        }
      }

      // 'F' or 'f': Switch to Fog Brush (GM only)
      if ((e.key === 'f' || e.key === 'F') && isGM) {
        e.preventDefault();
        setActiveTool('fog');
        return;
      }

      // 'H' or 'h': Pan tool
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setActiveTool('pan');
        return;
      }

      // Zoom keys: '+' or '=' and '-' or '_'
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale(prev => Math.min(3.5, prev + 0.15));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScale(prev => Math.max(0.5, prev - 0.15));
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        setScale(1.1);
        setPosition({ x: 0, y: 0 });
        return;
      }

      // Delete token
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedToken) {
        e.preventDefault();
        handleDeleteToken(selectedToken.id);
        return;
      }

      // Token movement with Arrow keys or WASD (only in select mode)
      if (activeTool === 'select') {
        const activeTok = selectedToken || myToken;
        if (!activeTok) return;

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          handleStepDirection('up');
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleStepDirection('down');
        } else if (e.key === 'ArrowLeft' || ((e.key === 'a' || e.key === 'A') && selectedToken)) {
          e.preventDefault();
          handleStepDirection('left');
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleStepDirection('right');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, selectedToken, myToken, activePreset, snapToGrid, isGM, isTvMode, isShortcutsOpen, isConditionsPopoverOpen]);

  // Toggle Condition on Token in Firestore
  const handleToggleCondition = async (tokenId: string, conditionId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    const currentConditions = token.conditions || [];
    const exists = currentConditions.includes(conditionId);
    const nextConditions = exists
      ? currentConditions.filter(c => c !== conditionId)
      : [...currentConditions, conditionId];
    
    // Optimistic UI update
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, conditions: nextConditions } : t));

    try {
      await updateDoc(doc(db, 'dungeonTokens', tokenId), {
        conditions: nextConditions
      });
    } catch (err) {
      console.warn('Failed to update token conditions:', err);
    }
  };

  // Quick Attack / Skill Roll in HUD
  const handleQuickAttackRoll = (token: DungeonTokenData) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonus = token.initiative || (token.type === 'monster' ? 3 : 2);
    const total = d20 + bonus;
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;

    playPingAudioAlert();

    setQuickRollNotice({
      tokenName: token.name,
      d20,
      bonus,
      total,
      isCrit,
      isFumble,
      color: token.color,
      timestamp: Date.now()
    });

    setTimeout(() => {
      setQuickRollNotice(null);
    }, 4500);
  };

  // Create AoE template in Firestore
  const handleCreateAoeTemplate = async (pctX: number, pctY: number, targetPctX?: number, targetPctY?: number) => {
    if (!user) return;
    const snapped = snapToGrid ? snapCoordinate(pctX, pctY) : { x: pctX, y: pctY };
    const tempId = `aoe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAoE: AoeTemplate = {
      id: tempId,
      type: aoeType,
      x: snapped.x,
      y: snapped.y,
      targetX: targetPctX ?? snapped.x,
      targetY: targetPctY ?? snapped.y,
      radiusFeet: aoeRadiusFeet,
      rotation: aoeRotation,
      color: aoeColor,
      name: aoeName,
      createdBy: user.displayName || (isGM ? 'Mestre' : 'Jogador'),
      createdAt: new Date().toISOString(),
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || ''
    };

    // Optimistic UI update
    setAoeTemplates(prev => [...prev, newAoE]);

    try {
      const { id: _, ...payload } = newAoE;
      const docRef = await addDoc(collection(db, 'dungeonAoEs'), payload);
      setAoeTemplates(prev => prev.map(a => a.id === tempId ? { ...a, id: docRef.id } : a));
    } catch (err) {
      console.warn('Failed to create AoE template:', err);
    }
  };

  // Rotate existing AoE template on the battlefield
  const handleRotateAoe = async (aoeId: string, deltaDeg: number) => {
    const target = aoeTemplates.find(a => a.id === aoeId);
    if (!target) return;
    const newRot = ((target.rotation || 0) + deltaDeg + 360) % 360;
    setAoeTemplates(prev => prev.map(a => a.id === aoeId ? { ...a, rotation: newRot } : a));
    try {
      await updateDoc(doc(db, 'dungeonAoEs', aoeId), { rotation: newRot });
    } catch (err) {
      console.warn('Failed to update AoE rotation in Firestore:', err);
    }
  };

  // Delete AoE template
  const handleDeleteAoe = async (aoeId: string) => {
    setAoeTemplates(prev => prev.filter(a => a.id !== aoeId));
    try {
      await deleteDoc(doc(db, 'dungeonAoEs', aoeId));
    } catch (err) {
      console.warn('Failed to delete AoE template:', err);
    }
  };

  // Move existing AoE template on the battlefield (Drag & Drop)
  const handleMoveAoe = async (aoeId: string, targetX: number, targetY: number) => {
    const snapped = snapToGrid ? snapCoordinate(targetX, targetY) : { x: targetX, y: targetY };
    setAoeTemplates(prev => prev.map(a => a.id === aoeId ? { ...a, x: snapped.x, y: snapped.y } : a));
    try {
      await updateDoc(doc(db, 'dungeonAoEs', aoeId), {
        x: snapped.x,
        y: snapped.y,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to update AoE position in Firestore:', err);
    }
  };

  // Stamp pre-defined room shape into dungeonDrawings
  const handleStampRoom = async (shape: RoomShapeDefinition, centerCol: number, centerRow: number, color: string) => {
    if (!user) return;
    const cellWidthPct = 100 / activePreset.gridCols;
    const cellHeightPct = 100 / activePreset.gridRows;

    const points = shape.relativeOffsets.map(off => {
      const col = centerCol + off.dx;
      const row = centerRow + off.dy;
      const x = Number(Math.max(0, Math.min(100, col * cellWidthPct)).toFixed(2));
      const y = Number(Math.max(0, Math.min(100, row * cellHeightPct)).toFixed(2));
      return { x, y };
    });

    const tempId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newStroke: MapDrawingStroke = {
      id: tempId,
      mapId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      points,
      color,
      size: 3,
      authorId: user.uid,
      authorName: user.displayName || (isGM ? 'Mestre' : 'Jogador'),
      createdAt: Date.now(),
      isClosed: true,
      fillColor: `${color}35`,
      isPolygon: true
    };

    try {
      const { id: _, ...payload } = newStroke;
      const docRef = await addDoc(collection(db, 'dungeonDrawings'), payload);
      const savedStroke = { ...newStroke, id: docRef.id };
      handleStrokeCreated(docRef.id, savedStroke);
      playPingAudioAlert();
    } catch (err) {
      console.warn('Failed to stamp room shape in Firestore:', err);
    }
  };

  const handleStampCenter = (shape: RoomShapeDefinition, color: string) => {
    const centerCol = Math.floor(activePreset.gridCols / 2);
    const centerRow = Math.floor(activePreset.gridRows / 2);
    handleStampRoom(shape, centerCol, centerRow, color);
  };

  // Drawing Undo / Redo Stack Handlers
  const handleStrokeCreated = React.useCallback((docId: string, stroke: MapDrawingStroke) => {
    setDrawingUndoStack(prev => [...prev, { type: 'add', docId, stroke }]);
    setDrawingRedoStack([]);
  }, []);

  const handleStrokeDeleted = React.useCallback((stroke: MapDrawingStroke) => {
    setDrawingUndoStack(prev => [...prev, { type: 'delete', docId: stroke.id, stroke }]);
    setDrawingRedoStack([]);
  }, []);

  const handleDrawingUndo = React.useCallback(async () => {
    if (drawingUndoStack.length === 0) return;
    const lastAction = drawingUndoStack[drawingUndoStack.length - 1];
    setDrawingUndoStack(prev => prev.slice(0, prev.length - 1));

    if (lastAction.type === 'add') {
      try {
        await deleteDoc(doc(db, 'dungeonDrawings', lastAction.docId));
        setDrawingRedoStack(prev => [...prev, lastAction]);
      } catch (e) {
        console.warn('Undo stroke delete failed:', e);
      }
    } else if (lastAction.type === 'delete') {
      try {
        const { id, ...data } = lastAction.stroke;
        const newDoc = await addDoc(collection(db, 'dungeonDrawings'), data);
        setDrawingRedoStack(prev => [...prev, { ...lastAction, docId: newDoc.id }]);
      } catch (e) {
        console.warn('Undo stroke restore failed:', e);
      }
    }
  }, [drawingUndoStack]);

  const handleDrawingRedo = React.useCallback(async () => {
    if (drawingRedoStack.length === 0) return;
    const lastRedo = drawingRedoStack[drawingRedoStack.length - 1];
    setDrawingRedoStack(prev => prev.slice(0, prev.length - 1));

    if (lastRedo.type === 'add') {
      try {
        const { id, ...data } = lastRedo.stroke;
        const newDoc = await addDoc(collection(db, 'dungeonDrawings'), data);
        setDrawingUndoStack(prev => [...prev, { ...lastRedo, docId: newDoc.id }]);
      } catch (e) {
        console.warn('Redo stroke restore failed:', e);
      }
    } else if (lastRedo.type === 'delete') {
      try {
        await deleteDoc(doc(db, 'dungeonDrawings', lastRedo.docId));
        setDrawingUndoStack(prev => [...prev, lastRedo]);
      } catch (e) {
        console.warn('Redo stroke delete failed:', e);
      }
    }
  }, [drawingRedoStack]);

  // Keyboard shortcut listener for Drawing Undo/Redo (Ctrl+Z and Ctrl+Y)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Escape') {
        if (activeStampShape) {
          setActiveStampShape(null);
          setStampCursorGrid(null);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleDrawingRedo();
        } else {
          e.preventDefault();
          handleDrawingUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleDrawingRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDrawingUndo, handleDrawingRedo]);

  // Clear all AoEs
  const handleClearAllAoEs = async () => {
    const currentList = [...aoeTemplates];
    setAoeTemplates([]);
    try {
      for (const a of currentList) {
        await deleteDoc(doc(db, 'dungeonAoEs', a.id));
      }
    } catch (err) {
      console.warn('Failed to clear AoEs:', err);
    }
  };

  // Drop a real-time multiplayer ping on the map
  const handleDropPing = async (pctX: number, pctY: number) => {
    if (!user) return;
    const now = Date.now();
    const newPingPayload = {
      x: pctX,
      y: pctY,
      userName: user.displayName || user.email?.split('@')[0] || (isGM ? 'Mestre' : 'Jogador'),
      userId: user.uid,
      color: myToken?.color || (isGM ? '#f59e0b' : '#06b6d4'),
      timestamp: now,
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || ''
    };

    playPingAudioAlert();

    try {
      const docRef = await addDoc(collection(db, 'dungeonPings'), newPingPayload);
      setPings(prev => [
        ...prev.filter(p => p.id !== docRef.id),
        { id: docRef.id, ...newPingPayload }
      ]);
    } catch (err) {
      console.warn('Ping sync error:', err);
    }
  };

  // Remove an individual ping from dungeon map
  const handleDeletePing = async (pingId: string) => {
    setPings(prev => prev.filter(p => p.id !== pingId));
    try {
      await deleteDoc(doc(db, 'dungeonPings', pingId));
    } catch (err) {
      console.warn('Error deleting dungeon ping:', err);
    }
  };

  // Clear all pings in this dungeon map
  const handleClearAllPings = async (onlyMine: boolean = false) => {
    const toDelete = pings.filter(p => !onlyMine || isGM || p.userId === user?.uid);
    setPings(prev => prev.filter(p => !toDelete.some(td => td.id === p.id)));
    try {
      const deletePromises = toDelete.map(p => deleteDoc(doc(db, 'dungeonPings', p.id)));
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn('Error clearing dungeon pings:', err);
    }
  };

  // Add a new tactical marker on the dungeon map
  const handleSaveMarker = async () => {
    if (!newMarkerCoord || !markerDraft.label.trim() || !user) return;

    const newMarker: DungeonMapMarker = {
      id: `mark_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      mapId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      x: newMarkerCoord.x,
      y: newMarkerCoord.y,
      label: markerDraft.label.trim(),
      category: markerDraft.category,
      description: markerDraft.description.trim(),
      color: markerDraft.color,
      authorId: user.uid,
      authorName: user.displayName || (isGM ? 'Mestre' : 'Jogador'),
      createdAt: Date.now()
    };

    setMarkers(prev => [...prev, newMarker]);
    setNewMarkerCoord(null);
    setIsAddingMarker(false);

    try {
      await addDoc(collection(db, 'dungeonMarkers'), newMarker);
    } catch (err) {
      console.error('Error saving dungeon marker:', err);
    }
  };

  // Delete a tactical marker from dungeon map
  const handleDeleteMarker = async (markerId: string, authorId: string) => {
    if (!user) return;
    if (isGM || authorId === user.uid) {
      setMarkers(prev => prev.filter(m => m.id !== markerId));
      if (selectedMarker?.id === markerId) setSelectedMarker(null);
      try {
        await deleteDoc(doc(db, 'dungeonMarkers', markerId));
      } catch (err) {
        console.error('Error deleting dungeon marker:', err);
      }
    }
  };

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    // Nunca processar mousedown se o clique foi em qualquer barra de ferramentas, botão ou HUD
    if (isToolbarClick(e.target)) return;

    // Se a ferramenta de desenho estiver ativa, não arrastar a câmera
    if (isDrawingMode) return;

    // Shift + Clique dropa ping instantaneamente
    if (e.shiftKey) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) handleDropPing(coords.pctX, coords.pctY);
      return;
    }

    // Se estiver adicionando marcador tático, captura coordenada e abre modal
    if (isAddingMarker) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        setNewMarkerCoord({ x: coords.pctX, y: coords.pctY });
      }
      return;
    }

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

    // Se estiver adicionando marcador ou posicionando AoE, o clique será tratado em handleMapCellClick
    if (isAddingMarker || activeTool === 'aoe') {
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

    // AoE Dragging in Progress (arrastar área da magia pelo mapa)
    if (draggingAoeId) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        setDragAoeCurrentPos({ x: coords.pctX, y: coords.pctY });
      }
    }

    // Room Shape Stamp Hover in Progress
    if (activeStampShape) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        const col = Math.floor((coords.pctX / 100) * activePreset.gridCols);
        const row = Math.floor((coords.pctY / 100) * activePreset.gridRows);
        setStampCursorGrid({ col, row, pctX: coords.pctX, pctY: coords.pctY });
      } else {
        setStampCursorGrid(null);
      }
    }
  };

  // Canvas Mouse Up
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaintingFog) {
      setIsPaintingFog(false);
      return;
    }

    if (activeTool === 'ruler') {
      // Manter a medição visível! Atualiza o ponto final caso tenha arrastado
      const coords = getMapCoordinatesFromEvent(e);
      if (coords && rulerStart) {
        setRulerCurrent({ x: coords.pctX, y: coords.pctY });
      }
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

    // Drop dragged AoE template (conclui arrasto e persiste no Firestore)
    if (draggingAoeId && dragAoeCurrentPos) {
      handleMoveAoe(draggingAoeId, dragAoeCurrentPos.x, dragAoeCurrentPos.y);
      setDraggingAoeId(null);
      setDragAoeCurrentPos(null);
      setDragAoeOriginPos(null);
    }
  };

  // Click on Battlemap Cell
  const handleMapCellClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Se o clique foi em qualquer barra de ferramentas, botão, badge ou HUD, NUNCA mover token
    if (isToolbarClick(e.target)) return;

    // Se estava arrastando a câmera, token ou magia, ou pintando névoa, ignorar clique
    if (isDraggingCanvas || draggingTokenId || draggingAoeId || isPaintingFog) return;
    if (wasDraggingRef.current || dragDistanceRef.current > 6) return;

    // Modo Carimbo de Salas Rápidas
    if (activeStampShape) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        const col = Math.floor((coords.pctX / 100) * activePreset.gridCols);
        const row = Math.floor((coords.pctY / 100) * activePreset.gridRows);
        handleStampRoom(activeStampShape, col, row, stampColor);
      }
      return;
    }

    if (isDrawingMode) return;

    if (e.shiftKey) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) handleDropPing(coords.pctX, coords.pctY);
      return;
    }

    if (activeTool === 'ruler') {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        if (!rulerStart) {
          setRulerStart({ x: coords.pctX, y: coords.pctY });
          setRulerCurrent({ x: coords.pctX, y: coords.pctY });
        } else {
          setRulerCurrent({ x: coords.pctX, y: coords.pctY });
        }
      }
      return;
    }

    if (isAddingMarker) {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) {
        setNewMarkerCoord({ x: coords.pctX, y: coords.pctY });
        setIsAddingMarker(false);
      }
      return;
    }

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

    if (activeTool === 'aoe') {
      const coords = getMapCoordinatesFromEvent(e);
      if (coords) handleCreateAoeTemplate(coords.pctX, coords.pctY);
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

  // Toggle Token Visibility (Reveal / Hide for GM)
  const handleToggleTokenVisibility = async (tokenId: string, makeHidden: boolean) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, hidden: makeHidden, isHidden: makeHidden } : t));
    try {
      await updateDoc(doc(db, 'dungeonTokens', tokenId), {
        hidden: makeHidden,
        isHidden: makeHidden
      });
    } catch (err) {
      console.warn('Failed to update token visibility:', err);
    }
  };

  // Spawn Campaign NPC / Monster (Visível ou Oculto)
  const handleSpawnCampaignCharacterToken = async (char: any, isHidden: boolean = false) => {
    if (!char || !user) return;
    const isMonster = Boolean(char.isMonster);
    const assignedColor = isMonster ? '#ef4444' : (char.type === 'npc' ? '#f59e0b' : '#3b82f6');
    const entrance = snapCoordinate(
      activePreset.entranceCoord.x + (Math.random() * 8 - 4),
      activePreset.entranceCoord.y + (Math.random() * 8 - 4)
    );

    const hpVal = Number(char.hp ?? char.stats?.hp ?? char.maxHp ?? 25);
    const maxHpVal = Number(char.maxHp ?? char.stats?.maxHp ?? char.hp ?? 25);
    const sizeVal = Number(char.monsterSize ?? char.size ?? 1);

    const newToken: Partial<DungeonTokenData> = {
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      userId: char.ownerId || user.uid,
      userName: char.name || (isMonster ? 'Monstro' : 'NPC'),
      characterId: char.id,
      name: char.name,
      avatar: char.avatar || '',
      iconName: isMonster ? 'Skull' : (char.type === 'npc' ? 'User' : 'Shield'),
      color: assignedColor,
      type: isMonster ? 'monster' : (char.type === 'npc' ? 'npc' : 'player'),
      hp: hpVal,
      maxHp: maxHpVal,
      x: entrance.x,
      y: entrance.y,
      size: sizeVal,
      initiative: Math.floor(Math.random() * 20) + 1,
      hidden: isHidden,
      isHidden: isHidden,
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: user.displayName || 'Mestre'
    };

    try {
      const docRef = await addDoc(collection(db, 'dungeonTokens'), newToken);
      setSelectedTokenId(docRef.id);
      setIsSpawnerOpen(false);
    } catch (err) {
      console.error('Failed to spawn campaign character token:', err);
    }
  };

  // Spawn Monster / NPC Preset (Visível ou Oculto)
  const handleSpawnPreset = async (preset: typeof MONSTER_PRESETS[0], hidden: boolean = false) => {
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
      hidden: hidden,
      isHidden: hidden,
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

  // Spawn monster directly from the Bestiary (Biblioteca expandida)
  const handleSpawnFromBestiary = async (monster: Monster, isHidden: boolean = false) => {
    if (!user) return;
    const entrance = snapCoordinate(activePreset.entranceCoord.x, activePreset.entranceCoord.y);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const initiative = d20 + (monster.initiativeBonus || 0);

    const newToken: Partial<DungeonTokenData> = {
      dungeonId: activeDungeonKey,
      sessionId: selectedSessionId || '',
      userId: user.uid,
      userName: user.displayName || 'Mestre',
      name: monster.name,
      avatar: '',
      color: monster.type === 'Dragão' || monster.type === 'Aberração' ? '#dc2626' : monster.type === 'Morto-vivo' ? '#a855f7' : '#ef4444',
      type: 'monster',
      hp: monster.hp,
      maxHp: monster.maxHp,
      x: entrance.x,
      y: entrance.y,
      size: monster.gridSize || 1,
      initiative,
      hidden: isHidden,
      isHidden: isHidden,
      conditions: [],
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: user.displayName || 'Mestre'
    };

    try {
      const docRef = await addDoc(collection(db, 'dungeonTokens'), newToken);
      setSelectedTokenId(docRef.id);
      setIsBestiaryOpen(false);
    } catch (err) {
      console.error('Failed to spawn monster from bestiary:', err);
    }
  };

  // Spawn complete encounter generated by CR / Party XP budget
  const handleSpawnEncounter = async (encounter: GeneratedEncounter, areHidden: boolean) => {
    if (!user) return;
    const entrance = snapCoordinate(activePreset.entranceCoord.x, activePreset.entranceCoord.y);

    let spawnedCount = 0;
    for (const group of encounter.monsters) {
      for (let i = 0; i < group.count; i++) {
        const d20 = Math.floor(Math.random() * 20) + 1;
        const initiative = d20 + (group.monster.initiativeBonus || 0);
        const offsetX = (spawnedCount % 5) * (100 / activePreset.gridCols);
        const offsetY = Math.floor(spawnedCount / 5) * (100 / activePreset.gridRows);
        const posX = Math.min(95, Math.max(5, entrance.x + offsetX));
        const posY = Math.min(95, Math.max(5, entrance.y + offsetY));

        const suffix = group.count > 1 ? ` #${i + 1}` : '';
        const newToken: Partial<DungeonTokenData> = {
          dungeonId: activeDungeonKey,
          sessionId: selectedSessionId || '',
          userId: user.uid,
          userName: user.displayName || 'Mestre',
          name: `${group.monster.name}${suffix}`,
          avatar: '',
          color: group.monster.type === 'Dragão' ? '#dc2626' : group.monster.type === 'Morto-vivo' ? '#a855f7' : '#ef4444',
          type: 'monster',
          hp: group.monster.hp,
          maxHp: group.monster.maxHp,
          x: posX,
          y: posY,
          size: group.monster.gridSize || 1,
          initiative,
          hidden: areHidden,
          isHidden: areHidden,
          conditions: [],
          lastMovedAt: new Date().toISOString(),
          lastMovedBy: user.displayName || 'Mestre'
        };

        try {
          await addDoc(collection(db, 'dungeonTokens'), newToken);
          spawnedCount++;
        } catch (err) {
          console.error('Failed to spawn encounter monster:', err);
        }
      }
    }
    setIsEncounterGeneratorOpen(false);
  };

  // Soundscape & Visual Weather Handlers
  const handleChangeSoundscape = async (preset: AtmosphereType) => {
    setActiveSoundscape(preset);
    setCustomAmbientUrl('');
    setCustomAmbientName('');
    try {
      await setDoc(doc(db, 'dungeonAtmosphere', activeDungeonKey), {
        soundscape: preset,
        customAmbientUrl: '',
        customAmbientName: ''
      }, { merge: true });
    } catch (err) {
      console.error('Failed to change soundscape:', err);
    }
  };

  const handleSaveCampaignSounds = async (sounds: SoundConfig) => {
    if (selectedSessionId) {
      try {
        await updateDoc(doc(db, 'gameSessions', selectedSessionId), {
          soundSettings: sounds,
          ...sounds,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Failed to update session sounds:', e);
      }
    }
    if (sounds.customAmbientSound) {
      setCustomAmbientUrl(sounds.customAmbientSound);
      setCustomAmbientName(sounds.customAmbientName || 'Trilha Personalizada');
      try {
        await setDoc(doc(db, 'dungeonAtmosphere', activeDungeonKey), {
          customAmbientUrl: sounds.customAmbientSound,
          customAmbientName: sounds.customAmbientName || 'Trilha Personalizada',
          soundscape: 'off'
        }, { merge: true });
      } catch (e) {
        console.warn('Failed to update atmosphere doc with custom sound:', e);
      }
    }
  };

  const handleChangeWeather = async (weather: WeatherType) => {
    setActiveWeather(weather);
    try {
      await setDoc(doc(db, 'dungeonAtmosphere', activeDungeonKey), {
        weather: weather
      }, { merge: true });
    } catch (err) {
      console.error('Failed to change weather:', err);
    }
  };

  // Advanced Combat & Turn Handlers
  const handleNextTurn = async () => {
    const list = visibleTurnOrderTokens;
    if (list.length === 0) return;
    let nextIdx = activeTurnIndex + 1;
    let newRound = combatRound;
    if (nextIdx >= list.length) {
      nextIdx = 0;
      newRound = combatRound + 1;
      setCombatRound(newRound);
      try {
        await setDoc(doc(db, 'dungeonAtmosphere', activeDungeonKey), {
          combatRound: newRound,
          inCombat: true
        }, { merge: true });
      } catch (err) {
        console.warn('Failed to sync combat round:', err);
      }
    }
    setActiveTurnIndex(nextIdx);
    if (list[nextIdx]) {
      handleCenterOnToken(list[nextIdx]);
    }
  };

  const handlePrevTurn = async () => {
    const list = visibleTurnOrderTokens;
    if (list.length === 0) return;
    let prevIdx = activeTurnIndex - 1;
    let prevRound = combatRound;
    if (prevIdx < 0) {
      prevIdx = Math.max(0, list.length - 1);
      if (combatRound > 1) {
        prevRound = combatRound - 1;
        setCombatRound(prevRound);
        try {
          await setDoc(doc(db, 'dungeonAtmosphere', activeDungeonKey), {
            combatRound: prevRound
          }, { merge: true });
        } catch (err) {
          console.warn('Failed to sync combat round:', err);
        }
      }
    }
    setActiveTurnIndex(prevIdx);
    if (list[prevIdx]) {
      handleCenterOnToken(list[prevIdx]);
    }
  };

  const handleRerollAllInitiative = async () => {
    try {
      for (const t of tokens) {
        const d20 = Math.floor(Math.random() * 20) + 1;
        await updateDoc(doc(db, 'dungeonTokens', t.id), { initiative: d20 });
      }
      setActiveTurnIndex(0);
    } catch (err) {
      console.error('Failed to reroll initiative:', err);
    }
  };

  const handleResetCombat = async () => {
    setCombatRound(1);
    setActiveTurnIndex(0);
    setInCombat(false);
    try {
      await setDoc(doc(db, 'dungeonAtmosphere', activeDungeonKey), {
        combatRound: 1,
        inCombat: false
      }, { merge: true });
    } catch (err) {
      console.error('Failed to reset combat:', err);
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

  // Delete Token immediately from dungeon map and Firestore
  const handleDeleteToken = async (tokenId: string) => {
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
    <div className={cn(
      "flex flex-col bg-obsidian text-parchment overflow-hidden select-none transition-all",
      isTvMode ? "fixed inset-0 z-50 w-screen h-screen" : "h-[calc(100vh-4rem)]"
    )}>
      {/* Top Tactical Navigation Bar */}
      <header className="h-14 border-b border-white/10 bg-black/60 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 gap-2">
        {/* Left: Map Identity & Map Switcher Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Skull size={18} />
          </div>

          {/* Map Selector Popover Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMapDropdownOpen(!isMapDropdownOpen)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-all text-parchment cursor-pointer group"
              title="Trocar Mapa ou Masmorra da Campanha"
            >
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-xs sm:text-sm text-parchment truncate max-w-[130px] sm:max-w-[200px]">
                    {activePreset.name}
                  </span>
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 hidden md:inline-block">
                    {activePreset.theme || 'Masmorra'}
                  </span>
                </div>
              </div>
              <ChevronDown size={14} className={cn("text-parchment/50 group-hover:text-parchment transition-transform shrink-0", isMapDropdownOpen && "rotate-180")} />
            </button>

            {/* Map Selector Dropdown Menu */}
            <AnimatePresence>
              {isMapDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-obsidian/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-2 z-[100] space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-parchment/60 uppercase tracking-widest font-bold">
                      Mapas da Campanha ({allPresets.length})
                    </span>
                    {isGM && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMapDropdownOpen(false);
                          setIsCampaignManagerModalOpen(true);
                        }}
                        className="text-[10px] font-mono text-arcane hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Shield size={11} />
                        <span>Gerenciar</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {allPresets.map((dp) => (
                      <div
                        key={dp.id}
                        onClick={() => {
                          setSelectedMapId(dp.id);
                          setSearchParams({ map: dp.id, ...(selectedSessionId ? { session: selectedSessionId } : {}) });
                          setIsMapDropdownOpen(false);
                        }}
                        className={cn(
                          "p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all text-xs",
                          selectedMapId === dp.id
                            ? "bg-purple-500/25 border-purple-500/40 text-purple-200 font-semibold shadow-sm"
                            : "bg-white/[0.03] border-white/5 hover:bg-white/10 text-parchment/70 hover:text-parchment"
                        )}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <MapIcon size={14} className={selectedMapId === dp.id ? "text-purple-300 shrink-0" : "text-parchment/40 shrink-0"} />
                          <div className="truncate text-left">
                            <span className="truncate block font-serif">{dp.name}</span>
                            <span className="text-[10px] font-mono text-parchment/40 block truncate">
                              {dp.gridCols}x{dp.gridRows} • {dp.theme || 'Masmorra'}
                            </span>
                          </div>
                        </div>

                        {/* GM Visibility Toggle Button */}
                        {isGM && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCampaignMapActive(selectedSessionId, dp.id, dp.active, dp.isCustom, 'dungeon');
                            }}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors shrink-0"
                            title={dp.active ? "Ativo para jogadores. Clique para desativar." : "Desativado para jogadores. Clique para ativar."}
                          >
                            {dp.active ? (
                              <Eye size={13} className="text-emerald-400" />
                            ) : (
                              <EyeOff size={13} className="text-amber-400" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isGM && (
                    <div className="pt-1.5 border-t border-white/10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMapDropdownOpen(false);
                          setIsCustomMapModalOpen(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-arcane text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Adicionar Novo Battlemap</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center / Right Section: Clean Grouped Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Campaign Selector (GM) */}
          {isGM && gmSessions.length > 0 && (
            <select
              value={selectedSessionId}
              onChange={(e) => {
                setSelectedSessionId(e.target.value);
                setSearchParams({ map: selectedMapId, ...(e.target.value ? { session: e.target.value } : {}) });
              }}
              className="bg-white/5 border border-white/10 text-parchment rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-arcane hidden xl:block max-w-[160px] truncate"
            >
              {gmSessions.map(s => (
                <option key={s.id} value={s.id} className="bg-obsidian">
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Player Character Pill */}
          {!isGM && userCharacter && (
            <div className="items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs hidden lg:flex">
              <User size={12} className="text-arcane" />
              <span className="font-semibold text-arcane">{userCharacter.name}</span>
            </div>
          )}

          {/* Character Sheet Modal Trigger */}
          <button
            type="button"
            onClick={() => {
              const charId = selectedCharacterId || userCharacter?.id || (userCharactersWithSession[0]?.id) || (campaignCharacters.find(c => c.ownerId === user?.uid)?.id);
              if (charId) setSheetModalCharacterId(charId);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-arcane/15 hover:bg-arcane/25 text-arcane border border-arcane/30 shadow-sm text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
            title="Abrir Ficha do Personagem em Modal (sem sair da masmorra)"
          >
            <Scroll size={13} />
            <span className="font-semibold text-xs hidden sm:inline">Ficha</span>
          </button>

          {/* Player Spawn / Join Token Button */}
          {!myToken ? (
            <button
              onClick={handleJoinDungeonWithMyToken}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-arcane to-emerald-400 text-obsidian text-xs font-semibold hover:opacity-95 transition-all shadow-lg flex items-center gap-1.5 animate-pulse cursor-pointer shrink-0"
            >
              <User size={13} />
              <span className="hidden sm:inline">Inserir Meu Token</span>
            </button>
          ) : (
            <button
              onClick={() => handleCenterOnToken(myToken)}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-arcane text-xs font-mono transition-colors flex items-center gap-1.5 border border-arcane/30 cursor-pointer shrink-0"
              title="Centralizar no meu personagem"
            >
              <Crosshair size={13} />
              <span className="hidden md:inline">Meu Token</span>
            </button>
          )}

          {/* GM Encounter & Creatures Hub (Bestiário, ND, Inserir Monstro) */}
          {isGM && (
            <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setIsBestiaryOpen(true)}
                className="px-2.5 py-1 rounded-lg text-rose-300 hover:bg-rose-500/20 text-xs font-mono font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title="Biblioteca de Monstros & Bestiário Expandido com Fichas Rápidas"
              >
                <BookOpen size={13} className="text-rose-400" />
                <span className="hidden md:inline">Bestiário</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEncounterGeneratorOpen(true)}
                className="px-2.5 py-1 rounded-lg text-amber-300 hover:bg-amber-500/20 text-xs font-mono font-medium transition-colors flex items-center gap-1 border-l border-white/10 cursor-pointer"
                title="Gerador de Encontros por ND / XP"
              >
                <Swords size={13} className="text-amber-400" />
                <span className="hidden md:inline">Gerador ND</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSpawnerOpen(true)}
                className="px-2.5 py-1 rounded-lg text-purple-300 hover:bg-purple-500/20 text-xs font-mono font-medium transition-colors flex items-center gap-1 border-l border-white/10 cursor-pointer"
                title="Inserir Monstro ou NPC na Masmorra"
              >
                <Plus size={13} className="text-purple-400" />
                <span className="hidden sm:inline">Monstro</span>
              </button>
            </div>
          )}

          {/* Atmosphere & Soundscape Player Button */}
          <button
            onClick={() => setIsAtmospherePanelOpen(!isAtmospherePanelOpen)}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm shrink-0",
              activeSoundscape !== 'off' || activeWeather !== 'none'
                ? "bg-sky-500/25 text-sky-200 border-sky-500/50"
                : "bg-white/5 hover:bg-white/10 text-parchment/60 hover:text-parchment border-white/10"
            )}
            title="Ambiência Sonora Procedural & Clima Visual no Mapa"
          >
            {activeSoundscape !== 'off' ? (
              <Volume2 size={13} className="text-sky-400 animate-pulse" />
            ) : (
              <CloudRain size={13} className="text-sky-300" />
            )}
            <span className="hidden lg:inline text-xs">Clima</span>
            {(activeSoundscape !== 'off' || activeWeather !== 'none') && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            )}
          </button>

          {/* TV Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setIsTvMode(!isTvMode)}
            className={cn(
              "p-2 rounded-xl border transition-all text-xs flex items-center gap-1 cursor-pointer shrink-0",
              isTvMode
                ? "bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-md font-bold"
                : "border-white/10 hover:bg-white/10 text-parchment/60 hover:text-amber-300"
            )}
            title={isTvMode ? "Sair do Modo TV (ESC ou T)" : "Modo TV / Mesa Presencial (T)"}
          >
            <Tv size={15} className={isTvMode ? "animate-pulse text-amber-400" : ""} />
            <span className="hidden xl:inline text-[11px] font-mono">TV</span>
          </button>

          {/* Keyboard Shortcuts Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-parchment/60 hover:text-arcane transition-all text-xs shrink-0"
            title="Atalhos Rápidos de Teclado (Pressione ?)"
          >
            <Keyboard size={15} />
          </button>

          {/* Return to World Map */}
          <Link
            to="/map"
            className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-parchment/60 hover:text-parchment transition-all text-xs shrink-0"
            title="Voltar ao Mapa Geral do Mundo"
          >
            <MapIcon size={15} />
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

          {/* Quick Tactical Attack / Dice Roll Toast */}
          <AnimatePresence>
            {quickRollNotice && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.9 }}
                className={cn(
                  "absolute top-28 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-mono border backdrop-blur-md",
                  quickRollNotice.isCrit
                    ? "bg-emerald-950/95 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/50"
                    : quickRollNotice.isFumble
                    ? "bg-rose-950/95 border-rose-500 text-rose-200 ring-2 ring-rose-500/50"
                    : "bg-black/90 border-white/20 text-parchment"
                )}
              >
                <Swords size={18} className={quickRollNotice.isCrit ? "text-emerald-400 animate-bounce" : "text-arcane"} />
                <div>
                  <div className="font-serif font-bold text-xs flex items-center gap-1.5">
                    <span>Ataque de {quickRollNotice.tokenName}</span>
                    {quickRollNotice.isCrit && <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400 font-mono">CRÍTICO!</span>}
                    {quickRollNotice.isFumble && <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 border border-rose-400 font-mono">FALHA CRÍTICA!</span>}
                  </div>
                  <div className="text-[11px] text-parchment/80 font-mono">
                    Dado: [<strong>{quickRollNotice.d20}</strong>] + Bônus {quickRollNotice.bonus} = <strong className="text-amber-400 text-xs">{quickRollNotice.total}</strong>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TV / Tabletop Mode Banner */}
          {isTvMode && (
            <div 
              data-toolbar="true"
              className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-md border border-amber-500/50 px-4 py-1.5 rounded-full flex items-center gap-3 shadow-2xl text-xs font-mono"
            >
              <Tv size={14} className="text-amber-400 animate-pulse" />
              <span className="text-amber-200 font-semibold">Mesa Presencial / Modo TV</span>
              <span className="text-white/20">|</span>
              <button
                type="button"
                onClick={() => setIsTvMode(false)}
                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-parchment text-[10px] cursor-pointer"
              >
                Sair (ESC)
              </button>
            </div>
          )}

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
                "p-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer",
                activeTool === 'ruler' ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-semibold" : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Régua de Medição Tática (Alcance / Atalho: R)"
            >
              <Ruler size={14} />
              <span className="text-[11px] font-medium hidden sm:inline">Régua</span>
            </button>

            {/* AoE Spell Template Tool */}
            <button
              onClick={() => setActiveTool(activeTool === 'aoe' ? 'select' : 'aoe')}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer",
                activeTool === 'aoe' 
                  ? "bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-sm font-semibold" 
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Área de Efeito (AoE) para Magias, Explosões e Sopros (Atalho: A)"
            >
              <Shapes size={14} className={activeTool === 'aoe' ? "text-rose-400 animate-pulse" : "text-parchment/40"} />
              <span className="text-[11px] font-medium hidden sm:inline">Magia AoE</span>
              {aoeTemplates.length > 0 && (
                <span className="text-[9px] px-1 rounded-full bg-rose-500/30 text-rose-300 font-mono font-bold leading-none">
                  {aoeTemplates.length}
                </span>
              )}
            </button>

            {/* Tactical Marker Toggle */}
            <button
              onClick={() => {
                setIsAddingMarker(!isAddingMarker);
                if (!isAddingMarker) {
                  setIsDrawingMode(false);
                }
              }}
              className={cn(
                "p-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer",
                isAddingMarker 
                  ? "bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-md font-semibold animate-pulse" 
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title="Adicionar Marcador Tático (Clique no mapa para marcar perigo, armadilha, tesouro, porta ou nota)"
            >
              <MapPin size={14} className={isAddingMarker ? "animate-bounce text-amber-400" : "text-amber-400"} />
              <span className="text-[11px] font-medium hidden sm:inline">
                {isAddingMarker ? 'Clique no mapa' : 'Marcador'}
              </span>
            </button>

            {/* Freehand Drawing Toolbar for Dungeon */}
            <MapDrawingToolbar
              isDrawingMode={isDrawingMode}
              onToggleDrawingMode={(val) => {
                setIsDrawingMode(val);
                if (val) {
                  setIsAddingMarker(false);
                  setActiveTool('select');
                }
              }}
              drawingTool={drawingTool}
              onChangeTool={setDrawingTool}
              activeColor={drawingColor}
              onChangeColor={setDrawingColor}
              strokeSize={drawingStrokeSize}
              onChangeStrokeSize={setDrawingStrokeSize}
              mapId={activeDungeonKey}
              sessionId={selectedSessionId}
              collectionName="dungeonDrawings"
              isGM={isGM}
              currentUserId={user?.uid}
              currentUserName={user?.displayName || (isGM ? 'Mestre' : 'Jogador')}
              isPingMode={activeTool === 'ping'}
              onTogglePingMode={(active) => {
                setActiveTool(active ? 'ping' : 'select');
                if (active) {
                  setIsDrawingMode(false);
                  setIsAddingMarker(false);
                }
              }}
              onUndo={handleDrawingUndo}
              onRedo={handleDrawingRedo}
              canUndo={drawingUndoStack.length > 0}
              canRedo={drawingRedoStack.length > 0}
              onOpenRoomShapes={() => setIsRoomShapesModalOpen(true)}
            />

            {/* Quick Room Shapes Library Button */}
            <button
              onClick={() => setIsRoomShapesModalOpen(true)}
              className="p-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
              title="Biblioteca de Formas de Salas (Retângulos, Círculos, Corredores para criação rápida de masmorras)"
            >
              <LayoutGrid size={14} className="text-amber-400" />
              <span className="text-[11px] font-medium hidden sm:inline">Salas Rápidas</span>
            </button>

            {/* Clear Pings Quick Button (Remover Pings da Dungeon) */}
            {pings.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearAllPings(false)}
                className="px-2 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer shadow-sm animate-pulse"
                title="Remover todos os sinais de ping ativos nesta masmorra"
              >
                <Trash2 size={12} className="text-rose-400" />
                <span className="hidden sm:inline">Limpar Pings</span>
                <span className="px-1 py-0.2 rounded-full bg-rose-500/30 text-[9px] font-bold">{pings.length}</span>
              </button>
            )}

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
                "p-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer",
                activeTool === 'fog' 
                  ? "bg-purple-600/40 text-purple-200 border border-purple-500/60 shadow-lg shadow-purple-500/20 font-semibold ring-1 ring-purple-400/50" 
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
              title={activeTool === 'fog' ? "Clique para voltar aos controles gerais" : "Controle de Névoa de Guerra (Revelar ou ocultar áreas)"}
            >
              <CloudFog size={14} className={activeTool === 'fog' ? "text-purple-300 animate-pulse" : (fogEnabled ? "text-purple-400" : "text-parchment/40")} />
              <span className="text-[11px] font-medium hidden sm:inline">
                {activeTool === 'fog' ? 'Névoa (Ativo)' : 'Névoa'}
              </span>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                fogEnabled ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-rose-500/60"
              )} />
            </button>
          </div>

          {/* Floating AoE Spell Template Configuration Bar */}
          <AnimatePresence>
            {activeTool === 'aoe' && (
              <motion.div
                key="aoe-controls-bar"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                data-toolbar="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="absolute top-16 left-4 z-20 flex flex-wrap items-center gap-2 bg-black/90 backdrop-blur-md p-2 rounded-2xl border border-rose-500/40 shadow-2xl text-xs max-w-2xl"
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-rose-300 font-bold uppercase flex items-center gap-1 mr-1">
                    <Shapes size={12} />
                    <span>Formato:</span>
                  </span>

                  {(['circle', 'cone', 'line', 'cube'] as const).map(shape => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setAoeType(shape)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer",
                        aoeType === shape
                          ? "bg-rose-500/30 text-rose-200 border border-rose-500/50"
                          : "bg-white/5 text-parchment/60 hover:text-parchment hover:bg-white/10"
                      )}
                    >
                      {shape === 'circle' ? '💥 Esfera' : shape === 'cone' ? '📐 Cone' : shape === 'line' ? '⚡ Linha' : '⬛ Cubo'}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-white/10" />

                {/* Radius / Size in blocks & feet */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-parchment/50">Tamanho:</span>
                  <select
                    value={aoeRadiusFeet}
                    onChange={(e) => setAoeRadiusFeet(Number(e.target.value))}
                    className="bg-obsidian border border-white/20 text-parchment rounded-lg px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-rose-400"
                  >
                    <option value={5}>1 bloco (5 pés / 1 cel)</option>
                    <option value={10}>2 blocos (10 pés / 2 cel)</option>
                    <option value={15}>3 blocos (15 pés / 3 cel)</option>
                    <option value={20}>4 blocos (20 pés / Bola de Fogo)</option>
                    <option value={30}>6 blocos (30 pés / Sopro Dragão)</option>
                    <option value={40}>8 blocos (40 pés / 8 cel)</option>
                    <option value={60}>12 blocos (60 pés / Cone / Raio)</option>
                    <option value={100}>20 blocos (100 pés / Tempestade)</option>
                  </select>
                </div>

                <div className="h-4 w-px bg-white/10" />

                {/* AoE Rotation Controls */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-parchment/50">Girar:</span>
                  <button
                    type="button"
                    onClick={() => setAoeRotation(prev => ((prev - 45) + 360) % 360)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] cursor-pointer"
                    title="Girar 45° anti-horário"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <span className="font-mono text-[10px] text-rose-300 w-9 text-center font-bold">
                    {aoeRotation}°
                  </span>
                  <button
                    type="button"
                    onClick={() => setAoeRotation(prev => (prev + 45) % 360)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] cursor-pointer"
                    title="Girar 45° horário"
                  >
                    <RotateCw size={12} />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={aoeRotation}
                    onChange={(e) => setAoeRotation(Number(e.target.value))}
                    className="w-14 accent-rose-500 h-1 cursor-pointer"
                    title={`Ângulo: ${aoeRotation}°`}
                  />
                </div>

                <div className="h-4 w-px bg-white/10" />

                {/* Color presets */}
                <div className="flex items-center gap-1">
                  {[
                    { c: '#ef4444', label: 'Fogo' },
                    { c: '#06b6d4', label: 'Gelo' },
                    { c: '#10b981', label: 'Veneno' },
                    { c: '#a855f7', label: 'Arcano' },
                    { c: '#eab308', label: 'Radiante' },
                  ].map(item => (
                    <button
                      key={item.c}
                      type="button"
                      onClick={() => setAoeColor(item.c)}
                      style={{ backgroundColor: item.c }}
                      className={cn(
                        "w-4 h-4 rounded-full border transition-transform cursor-pointer",
                        aoeColor === item.c ? "scale-125 border-white ring-1 ring-white" : "border-black/50 opacity-70 hover:opacity-100"
                      )}
                      title={item.label}
                    />
                  ))}
                </div>

                <div className="h-4 w-px bg-white/10" />

                <span className="text-[10px] font-mono text-rose-300/80 italic">
                  Clique no mapa para posicionar
                </span>

                {/* Clear AoEs button */}
                {aoeTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllAoEs}
                    className="ml-auto px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                    title="Remover todas as áreas de efeito ativas"
                  >
                    <Trash2 size={11} />
                    <span>Limpar ({aoeTemplates.length})</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Ruler Instructions & Controls Bar */}
          <AnimatePresence>
            {activeTool === 'ruler' && (
              <motion.div
                key="ruler-controls-bar"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                data-toolbar="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="absolute top-16 left-4 z-20 flex items-center gap-2.5 bg-black/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-amber-500/40 shadow-2xl text-xs font-mono"
              >
                <Ruler size={15} className="text-amber-400 animate-pulse" />
                <span className="text-amber-300 font-bold">Régua Tática:</span>
                <span className="text-parchment/80 text-[11px]">
                  {rulerStart && rulerCurrent
                    ? `${calculateDistance(rulerStart, rulerCurrent).squares} quad. | ${calculateDistance(rulerStart, rulerCurrent).feet} pés (${calculateDistance(rulerStart, rulerCurrent).meters}m)`
                    : rulerStart
                    ? "Mova o mouse ou clique no destino"
                    : "Clique no mapa para marcar a origem (ou arraste)"}
                </span>
                {rulerStart && (
                  <button
                    type="button"
                    onClick={() => {
                      setRulerStart(null);
                      setRulerCurrent(null);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-[10px] cursor-pointer ml-1 transition-colors"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRulerStart(null);
                    setRulerCurrent(null);
                    setActiveTool('select');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] cursor-pointer ml-1 transition-colors"
                >
                  Fechar Régua (ESC)
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Fog of War GM Controls Toolbar (Top-Left under Mode Bar) with Framer Motion Fade Animation */}
          <AnimatePresence>
            {isGM && activeTool === 'fog' && (
              <motion.div 
                key="fog-controls-bar"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                data-toolbar="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="absolute top-16 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-black/90 backdrop-blur-md p-2 rounded-2xl border border-purple-500/40 shadow-2xl text-xs max-w-2xl"
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
                <div className="text-[9px] font-mono text-parchment/40 hidden lg:block">
                  {revealedCells.size}/{activePreset.gridCols * activePreset.gridRows} células ({Math.round((revealedCells.size / (activePreset.gridCols * activePreset.gridRows)) * 100)}%)
                </div>

                {/* Return to General Controls Button */}
                <button
                  type="button"
                  onClick={() => setActiveTool('select')}
                  className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 hover:text-white border border-purple-500/40 text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer shadow-sm ml-auto"
                  title="Voltar aos Controles Gerais (Mover, Navegar, Régua)"
                >
                  <ArrowLeft size={11} className="text-purple-300" />
                  <span>Voltar aos Controles Gerais</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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

              {/* Ruler Measurement Line & Overlay */}
              {rulerStart && rulerCurrent && (
                <>
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
                    <line
                      x1={`${rulerStart.x}%`}
                      y1={`${rulerStart.y}%`}
                      x2={`${rulerCurrent.x}%`}
                      y2={`${rulerCurrent.y}%`}
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeDasharray="6 4"
                      className="drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                    />
                    {/* Origin point */}
                    <circle cx={`${rulerStart.x}%`} cy={`${rulerStart.y}%`} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                    {/* Target point */}
                    <circle cx={`${rulerCurrent.x}%`} cy={`${rulerCurrent.y}%`} r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                  </svg>

                  {/* High-visibility HTML Distance Badge */}
                  {(() => {
                    const dist = calculateDistance(rulerStart, rulerCurrent);
                    const midX = (rulerStart.x + rulerCurrent.x) / 2;
                    const midY = (rulerStart.y + rulerCurrent.y) / 2;
                    return (
                      <div
                        style={{ left: `${midX}%`, top: `${midY}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-35 pointer-events-none select-none"
                      >
                        <div className="bg-black/95 border border-amber-400 text-amber-300 font-mono text-[11px] font-bold rounded-lg py-1 px-2.5 shadow-2xl text-center whitespace-nowrap flex items-center gap-1.5 ring-2 ring-black/60">
                          <Ruler size={13} className="text-amber-400" />
                          <span>{dist.squares} quad.</span>
                          <span className="text-white/40">|</span>
                          <span>{dist.feet} pés ({dist.meters}m)</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Dynamic Visual Weather Particle & Mist Overlay */}
              <MapAtmosphereOverlay weather={activeWeather} />

              {/* Freehand Drawing Overlay for Dungeon Battlemap */}
              <MapDrawingOverlay
                mapId={activeDungeonKey}
                sessionId={selectedSessionId}
                collectionName="dungeonDrawings"
                isDrawingMode={isDrawingMode}
                drawingTool={drawingTool}
                activeColor={drawingColor}
                strokeSize={drawingStrokeSize}
                isGM={isGM}
                containerRef={mapImageRef}
                onStrokeCreated={handleStrokeCreated}
                onStrokeDeleted={handleStrokeDeleted}
              />

              {/* Ghost Preview of Pre-defined Room Shape being Stamped */}
              {activeStampShape && stampCursorGrid && (
                <svg 
                  className="absolute inset-0 pointer-events-none z-30 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {(() => {
                    const cellWidthPct = 100 / activePreset.gridCols;
                    const cellHeightPct = 100 / activePreset.gridRows;
                    const pts = activeStampShape.relativeOffsets.map(off => {
                      const c = stampCursorGrid.col + off.dx;
                      const r = stampCursorGrid.row + off.dy;
                      const x = Number(Math.max(0, Math.min(100, c * cellWidthPct)).toFixed(2));
                      const y = Number(Math.max(0, Math.min(100, r * cellHeightPct)).toFixed(2));
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <g className="animate-pulse">
                        <polygon
                          points={pts}
                          fill={`${stampColor}45`}
                          stroke={stampColor}
                          strokeWidth="0.6"
                          strokeDasharray="1.5,1.5"
                          strokeLinejoin="round"
                        />
                        {/* Center marker crosshair */}
                        <circle
                          cx={(stampCursorGrid.col + 0.5) * cellWidthPct}
                          cy={(stampCursorGrid.row + 0.5) * cellHeightPct}
                          r="0.8"
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth="0.2"
                        />
                      </g>
                    );
                  })()}
                </svg>
              )}

              {/* Real-time Multiplayer Pings (Sinais de Ping com Opção de Remoção) */}
              {pings.map((ping) => (
                <div
                  key={ping.id}
                  data-no-map-click="true"
                  style={{ left: `${ping.x}%`, top: `${ping.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-40 group select-none pointer-events-auto cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePing(ping.id);
                  }}
                  title="Clique para remover este sinal de ping"
                >
                  <div className="relative flex items-center justify-center">
                    <span 
                      style={{ backgroundColor: ping.color }}
                      className="absolute w-12 h-12 rounded-full animate-ping opacity-75 pointer-events-none"
                    />
                    <span 
                      style={{ borderColor: ping.color }}
                      className="absolute w-8 h-8 rounded-full border-2 animate-pulse opacity-90 pointer-events-none"
                    />
                    
                    {/* Clickable Ping Core Button to Dismiss */}
                    <button
                      type="button"
                      data-no-map-click="true"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePing(ping.id);
                      }}
                      style={{ borderColor: '#ffffff', backgroundColor: ping.color }}
                      className="w-6 h-6 rounded-full border-2 shadow-2xl flex items-center justify-center text-[10px] font-black text-black z-10 cursor-pointer hover:scale-125 transition-transform"
                      title="Clique para remover este sinal de ping"
                    >
                      !
                    </button>

                    {/* Ping User Pill Label with Close button */}
                    <div 
                      data-no-map-click="true"
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2.5 py-0.5 rounded-full bg-black/95 text-[10px] font-mono text-white whitespace-nowrap border border-white/20 shadow-2xl flex items-center gap-1.5 z-20"
                    >
                      <Radio size={10} className="animate-spin text-amber-400" />
                      <span>{ping.userName}</span>
                      <button
                        type="button"
                        data-no-map-click="true"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePing(ping.id);
                        }}
                        className="p-0.5 rounded-full hover:bg-rose-500/40 text-parchment/60 hover:text-white transition-colors cursor-pointer ml-0.5"
                        title="Remover este sinal de ping"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Tactical Dungeon Markers (Marcadores táticos) */}
              {markers.map((marker) => {
                const catConfig = DUNGEON_MARKER_CATEGORIES[marker.category] || DUNGEON_MARKER_CATEGORIES.danger;
                const IconComp = catConfig.icon;
                const isSelected = selectedMarker?.id === marker.id;
                const canDelete = isGM || (user && marker.authorId === user.uid);

                return (
                  <div
                    key={marker.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMarker(isSelected ? null : marker);
                    }}
                    style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-35 transition-transform duration-150",
                      isSelected ? "scale-125 z-45" : "hover:scale-115"
                    )}
                  >
                    <div 
                      className="w-7 h-7 rounded-xl border flex items-center justify-center shadow-xl transition-all"
                      style={{
                        backgroundColor: marker.color ? `${marker.color}25` : undefined,
                        borderColor: marker.color || catConfig.color,
                        boxShadow: `0 0 10px ${(marker.color || catConfig.color)}50`
                      }}
                    >
                      <IconComp size={14} style={{ color: marker.color || catConfig.color }} />
                    </div>

                    {/* Label Pill */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded bg-black/90 text-[9px] font-mono font-medium text-white whitespace-nowrap border border-white/20 shadow-lg pointer-events-none group-hover:scale-105 transition-transform">
                      {marker.label}
                    </div>

                    {/* Quick Marker Tooltip / Popover */}
                    {isSelected && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2.5 rounded-xl bg-obsidian/95 border border-white/20 shadow-2xl w-48 text-left z-50 backdrop-blur-md space-y-1.5 pointer-events-auto"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border", catConfig.bg)}>
                            {catConfig.label}
                          </span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMarker(marker.id, marker.authorId);
                              }}
                              className="p-1 rounded-md text-parchment/50 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                              title="Remover Marcador"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <h5 className="text-xs font-serif font-bold text-parchment truncate">
                          {marker.label}
                        </h5>
                        {marker.description && (
                          <p className="text-[10px] text-parchment/70 leading-snug line-clamp-2">
                            {marker.description}
                          </p>
                        )}
                        <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[8px] font-mono text-parchment/40">
                          <span>Por: {marker.authorName}</span>
                          <span>X: {marker.x}% Y: {marker.y}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* AREA OF EFFECT (AoE) SPELL TEMPLATES LAYER */}
              {aoeTemplates.map((aoe) => {
                const diameterBlocks = Math.max(1, Math.round(aoe.radiusFeet / 5));
                const widthPct = (diameterBlocks / activePreset.gridCols) * 100;
                const heightPct = (diameterBlocks / activePreset.gridRows) * 100;
                const rot = aoe.rotation || 0;

                const isDraggingThis = draggingAoeId === aoe.id;
                const posX = isDraggingThis && dragAoeCurrentPos ? dragAoeCurrentPos.x : aoe.x;
                const posY = isDraggingThis && dragAoeCurrentPos ? dragAoeCurrentPos.y : aoe.y;

                return (
                  <div
                    key={aoe.id}
                    style={{
                      left: `${posX}%`,
                      top: `${posY}%`,
                      width: aoe.type === 'line' ? `${Math.max(3, (1 / activePreset.gridCols) * 100)}%` : `${widthPct}%`,
                      height: `${heightPct}%`,
                      transform: `translate(-50%, -50%) rotate(${rot}deg)`,
                      transformOrigin: 'center center',
                      transition: isDraggingThis ? 'none' : 'left 140ms ease-out, top 140ms ease-out'
                    }}
                    className={cn(
                      "absolute z-15 pointer-events-auto select-none group",
                      isDraggingThis ? "cursor-grabbing opacity-90 scale-105 z-40" : "cursor-grab"
                    )}
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).closest('button, input')) return;
                      e.stopPropagation();
                      setDraggingAoeId(aoe.id);
                      setDragAoeOriginPos({ x: aoe.x, y: aoe.y });
                      setDragAoeCurrentPos({ x: aoe.x, y: aoe.y });
                    }}
                    title={`${aoe.name || 'Magia AoE'}: ${diameterBlocks} bloco(s) (${aoe.radiusFeet} pés) • ${rot}° • Arraste para mover`}
                  >
                    {/* Circle / Sphere Shape */}
                    {aoe.type === 'circle' && (
                      <div
                        style={{
                          backgroundColor: `${aoe.color}30`,
                          borderColor: aoe.color,
                        }}
                        className="w-full h-full rounded-full border-2 border-dashed shadow-[0_0_25px_rgba(255,255,255,0.15)] flex items-center justify-center relative cursor-pointer group-hover:border-solid group-hover:brightness-125 transition-all"
                      >
                        <div className="opacity-0 group-hover:opacity-100 bg-black/90 px-2 py-1 rounded-xl text-[9px] font-mono text-white border border-white/20 flex items-center gap-1.5 shadow-2xl transition-opacity pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, -45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° anti-horário"
                          >
                            <RotateCcw size={10} />
                          </button>
                          <span className="font-bold">{rot}°</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, 45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° horário"
                          >
                            <RotateCw size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAoe(aoe.id);
                            }}
                            className="p-1 hover:bg-rose-500/30 text-rose-300 rounded ml-1"
                            title="Remover magia"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cube / Square Shape */}
                    {aoe.type === 'cube' && (
                      <div
                        style={{
                          backgroundColor: `${aoe.color}30`,
                          borderColor: aoe.color,
                        }}
                        className="w-full h-full rounded-xl border-2 border-dashed shadow-[0_0_25px_rgba(255,255,255,0.15)] flex items-center justify-center relative cursor-pointer group-hover:border-solid group-hover:brightness-125 transition-all"
                      >
                        <div className="opacity-0 group-hover:opacity-100 bg-black/90 px-2 py-1 rounded-xl text-[9px] font-mono text-white border border-white/20 flex items-center gap-1.5 shadow-2xl transition-opacity pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, -45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° anti-horário"
                          >
                            <RotateCcw size={10} />
                          </button>
                          <span className="font-bold">{rot}°</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, 45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° horário"
                          >
                            <RotateCw size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAoe(aoe.id);
                            }}
                            className="p-1 hover:bg-rose-500/30 text-rose-300 rounded ml-1"
                            title="Remover magia"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Cone Shape */}
                    {aoe.type === 'cone' && (
                      <div
                        style={{
                          background: `radial-gradient(circle at 50% 100%, ${aoe.color}55 0%, ${aoe.color}15 70%, transparent 100%)`,
                          borderColor: aoe.color,
                          clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)'
                        }}
                        className="w-full h-full border-t-2 border-dashed shadow-[0_0_25px_rgba(255,255,255,0.15)] flex items-center justify-center relative cursor-pointer group-hover:brightness-125 transition-all"
                      >
                        <div className="opacity-0 group-hover:opacity-100 bg-black/90 px-2 py-1 rounded-xl text-[9px] font-mono text-white border border-white/20 flex items-center gap-1.5 shadow-2xl transition-opacity pointer-events-auto -translate-y-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, -45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° anti-horário"
                          >
                            <RotateCcw size={10} />
                          </button>
                          <span className="font-bold">{rot}°</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, 45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° horário"
                          >
                            <RotateCw size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAoe(aoe.id);
                            }}
                            className="p-1 hover:bg-rose-500/30 text-rose-300 rounded ml-1"
                            title="Remover cone"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Line Shape */}
                    {aoe.type === 'line' && (
                      <div
                        style={{
                          backgroundColor: `${aoe.color}45`,
                          borderColor: aoe.color,
                        }}
                        className="w-full h-full mx-auto rounded-full border-2 border-dashed shadow-[0_0_25px_rgba(255,255,255,0.15)] flex items-center justify-center relative cursor-pointer group-hover:brightness-125 transition-all"
                      >
                        <div className="opacity-0 group-hover:opacity-100 bg-black/90 px-2 py-1 rounded-xl text-[9px] font-mono text-white border border-white/20 flex items-center gap-1.5 shadow-2xl transition-opacity pointer-events-auto whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, -45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° anti-horário"
                          >
                            <RotateCcw size={10} />
                          </button>
                          <span className="font-bold">{rot}°</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateAoe(aoe.id, 45);
                            }}
                            className="p-1 hover:bg-white/20 rounded text-parchment"
                            title="Girar 45° horário"
                          >
                            <RotateCw size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAoe(aoe.id);
                            }}
                            className="p-1 hover:bg-rose-500/30 text-rose-300 rounded ml-1"
                            title="Remover linha"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Movement Range Aura on Selected Token */}
              {showMovementRange && selectedToken && (
                <div
                  style={{
                    left: `${selectedToken.x}%`,
                    top: `${selectedToken.y}%`,
                    width: `${(6 * 2 / activePreset.gridCols) * 100}%`,
                    height: `${(6 * 2 / activePreset.gridRows) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-arcane/70 bg-arcane/10 pointer-events-none z-15 animate-pulse shadow-[0_0_30px_rgba(6,182,212,0.25)] flex items-center justify-center"
                >
                  <span className="absolute top-1 text-[9px] font-mono text-arcane/90 bg-black/80 px-2 py-0.5 rounded-full border border-arcane/30 shadow-sm">
                    Alcance de Movimento (6 cel / 30 pés)
                  </span>
                </div>
              )}

              {/* MULTIPLAYER TOKENS PLACED ON MAP */}
              {tokens.map((token) => {
                const isSelected = selectedTokenId === token.id;
                const isMyToken = user && token.userId === user.uid;
                const isDraggingThis = draggingTokenId === token.id;

                // Fog of War & Hidden Token Concealment check
                const tokenCell = getCellIndexFromPct(token.x, token.y, activePreset.gridCols, activePreset.gridRows);
                const isCellRevealed = !fogEnabled || revealedCells.has(tokenCell);
                const isPlayerPerspective = !isGM || gmViewMode === 'player';
                const isExplicitlyHidden = Boolean(token.hidden || token.isHidden);

                // If explicitly marked hidden OR cell is unrevealed and in Player Perspective, conceal monsters and NPCs!
                if (isPlayerPerspective && (isExplicitlyHidden || (fogEnabled && !isCellRevealed && token.type !== 'player'))) {
                  return null; // completely hidden from players
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
                      isSelected ? "z-30 scale-110" : "hover:scale-105",
                      isExplicitlyHidden && "opacity-80"
                    )}
                  >
                    {/* GM Indicator: Monster/NPC is explicitly hidden */}
                    {isExplicitlyHidden && (
                      <div 
                        className="absolute -top-1.5 -left-1.5 z-30 bg-purple-950 border border-purple-400 text-purple-200 rounded-full p-0.5 shadow-md flex items-center justify-center animate-pulse"
                        title="Monstro Oculto no Mapa (Invisível para os jogadores)"
                      >
                        <EyeOff size={10} />
                      </div>
                    )}

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
                        isExplicitlyHidden ? "border-dashed border-purple-400 ring-2 ring-purple-500/50" : "",
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

                    {/* Active Conditions Badges over Token */}
                    {token.conditions && token.conditions.length > 0 && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5 z-30 pointer-events-none">
                        {token.conditions.map(condId => {
                          const cond = TOKEN_CONDITIONS.find(c => c.id === condId);
                          if (!cond) return null;
                          return (
                            <span
                              key={condId}
                              style={{ backgroundColor: cond.color }}
                              className="w-3.5 h-3.5 rounded-full border border-black shadow flex items-center justify-center text-[8px] text-black font-black"
                              title={`${cond.name}: ${cond.desc}`}
                            >
                              {cond.symbol}
                            </span>
                          );
                        })}
                      </div>
                    )}

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
                      <div className="bg-obsidian/95 border border-white/20 rounded-xl p-2 shadow-2xl text-left w-48 backdrop-blur-md">
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
                        {/* Active Conditions List in Hover Card */}
                        {token.conditions && token.conditions.length > 0 && (
                          <div className="mt-1.5 pt-1 border-t border-white/10 flex flex-wrap gap-1">
                            {token.conditions.map(condId => {
                              const cond = TOKEN_CONDITIONS.find(c => c.id === condId);
                              if (!cond) return null;
                              return (
                                <span
                                  key={condId}
                                  className={cn("text-[8px] px-1.5 py-0.5 rounded border font-mono font-medium flex items-center gap-1", cond.bg)}
                                >
                                  <span>{cond.symbol}</span>
                                  <span>{cond.name}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
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

          {/* Floating Canvas Controls (Moved to Right Rail so Bottom is free for Audio/HUD) */}
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute bottom-20 right-3.5 z-30 flex flex-col gap-1.5 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl"
          >
            <button
              onClick={() => setScale(prev => Math.min(3.5, prev + 0.25))}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all cursor-pointer"
              title="Aproximar (+)"
            >
              <ZoomIn size={16} />
            </button>
            <div className="text-[10px] font-mono text-center text-parchment/60 py-0.5">
              {Math.round(scale * 100)}%
            </div>
            <button
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all cursor-pointer"
              title="Afastar (-)"
            >
              <ZoomOut size={16} />
            </button>
            <div className="h-px bg-white/10 my-0.5" />
            <button
              onClick={() => {
                setScale(1.1);
                setPosition({ x: 0, y: 0 });
              }}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all cursor-pointer"
              title="Redefinir Câmera"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => setDarknessMode(!darknessMode)}
              className={cn(
                "p-2 rounded-xl transition-all cursor-pointer",
                darknessMode ? "bg-purple-500/20 text-purple-300" : "text-parchment/60 hover:bg-white/10"
              )}
              title="Modo Atmosférico de Penumbra"
            >
              {darknessMode ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all cursor-pointer"
              title="Ajuda e Instruções de Navegação"
            >
              <HelpCircle size={15} />
            </button>
          </div>

          {/* Tactical D-Pad / Grid Step Controller (Bottom-Left, Collapsible) */}
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-4 z-20"
          >
            {isDpadCollapsed ? (
              <button
                type="button"
                onClick={() => setIsDpadCollapsed(false)}
                className="p-2.5 rounded-2xl bg-black/80 hover:bg-black/95 backdrop-blur-md border border-white/15 shadow-2xl text-arcane hover:text-white flex items-center gap-1.5 text-xs font-mono cursor-pointer transition-all"
                title="Expandir D-Pad / Controle Direcional"
              >
                <Navigation size={14} />
                <span className="text-[11px] font-semibold hidden sm:inline">D-Pad</span>
              </button>
            ) : (
              <div className="flex flex-col items-center bg-black/80 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl">
                <div className="w-full flex items-center justify-between text-[9px] font-mono text-parchment/60 mb-1 gap-2">
                  <div className="flex items-center gap-1 truncate max-w-[90px]">
                    <Navigation size={10} className="text-arcane shrink-0" />
                    <span className="truncate">{((selectedToken || myToken)?.name || 'Token').split(' ')[0]}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDpadCollapsed(true)}
                    className="text-parchment/40 hover:text-parchment p-0.5 cursor-pointer rounded"
                    title="Minimizar D-Pad"
                  >
                    <Minimize2 size={11} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 w-24">
                  <div />
                  <button
                    onClick={() => handleStepDirection('up')}
                    disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title={activeTool === 'select' ? "Mover para Cima (W ou ↑)" : "Habilite a ferramenta Mover para usar as setas"}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <div />

                  <button
                    onClick={() => handleStepDirection('left')}
                    disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
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
                    className="p-2 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-arcane flex items-center justify-center transition-all disabled:opacity-30 border border-arcane/30 cursor-pointer"
                    title="Centralizar Câmera no Token"
                  >
                    <Crosshair size={14} />
                  </button>

                  <button
                    onClick={() => handleStepDirection('right')}
                    disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title={activeTool === 'select' ? "Mover para Direita (D ou →)" : "Habilite a ferramenta Mover para usar as setas"}
                  >
                    <ArrowRight size={16} />
                  </button>

                  <div />
                  <button
                    onClick={() => handleStepDirection('down')}
                    disabled={(!selectedToken && !myToken) || activeTool !== 'select'}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-arcane/40 text-parchment flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
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

              {/* Open Character Sheet if token is linked to a character */}
              {selectedToken.characterId && (
                <button
                  type="button"
                  onClick={() => setSheetModalCharacterId(selectedToken.characterId!)}
                  className="px-2.5 py-1 rounded-lg bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/30 text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer"
                  title="Abrir Ficha Completa deste Personagem em Modal"
                >
                  <Scroll size={13} />
                  <span>Ver Ficha</span>
                </button>
              )}

              {/* GM Token Visibility Toggle (Oculto / Visível) */}
              {isGM && (
                <button
                  type="button"
                  onClick={() => handleToggleTokenVisibility(selectedToken.id, !Boolean(selectedToken.hidden || selectedToken.isHidden))}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm",
                    (selectedToken.hidden || selectedToken.isHidden)
                      ? "bg-purple-950/80 text-purple-200 border-purple-500/50 hover:bg-purple-900"
                      : "bg-emerald-950/80 text-emerald-200 border-emerald-500/50 hover:bg-emerald-900"
                  )}
                  title={(selectedToken.hidden || selectedToken.isHidden) ? "Token Oculto dos jogadores. Clique para REVELAR aos jogadores" : "Token Visível aos jogadores. Clique para OCULTAR dos jogadores"}
                >
                  {(selectedToken.hidden || selectedToken.isHidden) ? (
                    <>
                      <EyeOff size={13} className="text-purple-400" />
                      <span>Oculto</span>
                    </>
                  ) : (
                    <>
                      <Eye size={13} className="text-emerald-400" />
                      <span>Visível</span>
                    </>
                  )}
                </button>
              )}

              {/* Quick Attack / Roll Action */}
              <button
                type="button"
                onClick={() => handleQuickAttackRoll(selectedToken)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Rolar Teste de Ataque / Ação Rápida (1d20 + bônus)"
              >
                <Swords size={13} className="text-rose-400" />
                <span>Ataque</span>
              </button>

              {/* Tactical Conditions Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsConditionsPopoverOpen(!isConditionsPopoverOpen)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm",
                    (selectedToken.conditions && selectedToken.conditions.length > 0)
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-white/10 text-parchment/70 hover:text-parchment border-white/10"
                  )}
                  title="Gerenciar Condições e Status Táticos neste token"
                >
                  <Activity size={13} className="text-amber-400" />
                  <span>Status {selectedToken.conditions && selectedToken.conditions.length > 0 ? `(${selectedToken.conditions.length})` : ''}</span>
                </button>

                {/* Conditions Popover */}
                {isConditionsPopoverOpen && (
                  <div
                    data-toolbar="true"
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-black/95 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-2xl z-50 text-left space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                        <Activity size={11} />
                        <span>Condições & Status</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsConditionsPopoverOpen(false)}
                        className="text-parchment/40 hover:text-parchment p-0.5 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto no-scrollbar">
                      {TOKEN_CONDITIONS.map(cond => {
                        const isActive = selectedToken.conditions?.includes(cond.id);
                        return (
                          <button
                            key={cond.id}
                            type="button"
                            onClick={() => handleToggleCondition(selectedToken.id, cond.id)}
                            className={cn(
                              "p-1.5 rounded-xl border text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer text-left",
                              isActive
                                ? `${cond.bg} font-bold shadow-sm`
                                : "bg-white/5 border-white/10 text-parchment/60 hover:bg-white/10 hover:text-parchment"
                            )}
                            title={cond.desc}
                          >
                            <span>{cond.symbol}</span>
                            <span className="truncate">{cond.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Movement Range Aura Toggle */}
              <button
                type="button"
                onClick={() => setShowMovementRange(!showMovementRange)}
                className={cn(
                  "p-1.5 rounded-lg border transition-all cursor-pointer",
                  showMovementRange
                    ? "bg-arcane/25 text-arcane border-arcane/50"
                    : "text-parchment/50 hover:bg-white/10 border-transparent"
                )}
                title={showMovementRange ? "Ocultar Raio de Movimento (30 pés)" : "Exibir Raio de Movimento (30 pés)"}
              >
                <Disc size={15} />
              </button>

              {/* Focus on token button */}
              <button
                onClick={() => handleCenterOnToken(selectedToken)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-arcane cursor-pointer"
                title="Centralizar Câmera no Token"
              >
                <Crosshair size={16} />
              </button>

              {/* Delete Token button */}
              <button
                onClick={() => handleDeleteToken(selectedToken.id)}
                className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400 cursor-pointer"
                title="Remover Token da Masmorra"
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
          {isTurnTrackerOpen && visibleTurnOrderTokens.length > 0 && (
            <div 
              data-toolbar="true"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/85 backdrop-blur-md p-1.5 px-3 rounded-full border border-arcane/30 shadow-2xl max-w-2xl overflow-x-auto no-scrollbar"
            >
              {/* Round Counter Badge */}
              <div className="flex items-center gap-1.5 bg-arcane/20 border border-arcane/40 px-2.5 py-1 rounded-full text-arcane text-[11px] font-mono font-bold shrink-0">
                <Swords size={12} className="text-arcane animate-pulse" />
                <span>Rodada {combatRound}</span>
              </div>

              {/* Turn Stepper Controls: Previous Turn */}
              <button
                type="button"
                onClick={handlePrevTurn}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-parchment/80 hover:text-white transition-all cursor-pointer shrink-0"
                title="Voltar para o turno anterior (Rodada anterior se for o primeiro)"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Tokens Turn Order */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {visibleTurnOrderTokens.map((tok, idx) => {
                  const isCurrentTurn = idx === activeTurnIndex % visibleTurnOrderTokens.length;
                  const hpPct = Math.round((tok.hp / Math.max(1, tok.maxHp)) * 100);
                  return (
                    <div
                      key={tok.id}
                      onClick={() => {
                        setActiveTurnIndex(idx);
                        handleCenterOnToken(tok);
                      }}
                      style={{ borderColor: tok.color }}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all relative overflow-hidden shrink-0 group",
                        isCurrentTurn 
                          ? "ring-2 ring-arcane scale-110 shadow-[0_0_12px_rgba(56,189,248,0.7)] z-10" 
                          : "opacity-60 hover:opacity-100 hover:scale-105"
                      )}
                      title={`${tok.name} | Inic: ${tok.initiative || '?'} | PV: ${tok.hp}/${tok.maxHp}`}
                    >
                      {tok.avatar ? (
                        <img src={tok.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold" style={{ color: tok.color }}>
                          {tok.name.substring(0, 2)}
                        </span>
                      )}
                      {/* Mini HP bar on bottom */}
                      <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60">
                        <div 
                          className={cn("h-full", hpPct > 50 ? "bg-emerald-400" : hpPct > 20 ? "bg-amber-400" : "bg-rose-500")}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      {isCurrentTurn && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-arcane animate-ping" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Turn Stepper Controls: Next Turn */}
              <button
                type="button"
                onClick={handleNextTurn}
                className="p-1 px-2.5 rounded-full bg-arcane hover:bg-arcane/90 text-obsidian text-[11px] font-mono font-bold flex items-center gap-0.5 transition-all cursor-pointer shrink-0 shadow-md"
                title="Avançar para próximo turno (avança rodada se for o último)"
              >
                <span>Próximo</span>
                <ChevronRight size={13} />
              </button>

              {/* Reroll Initiative & Reset Combat Buttons */}
              <div className="flex items-center gap-1 border-l border-white/15 pl-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleRerollAllInitiative}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-parchment/70 hover:text-amber-300 transition-colors cursor-pointer"
                  title="Rolar Iniciativa para Todos os Tokens (1d20)"
                >
                  <Dices size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleResetCombat}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-parchment/70 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Reiniciar Combate (Voltar para Rodada 1)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
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
                  <Users size={18} className="text-arcane" />
                  <h3 className="font-serif text-lg font-bold text-parchment">
                    Inserir Tokens na Masmorra
                  </h3>
                </div>
                <button
                  onClick={() => setIsSpawnerOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs: Jogadores da Campanha vs Monstros & NPCs */}
              {(() => {
                const campaignPlayers = campaignCharacters.filter(c => c.type !== 'npc' && !c.isMonster);
                const campaignMonsters = campaignCharacters.filter(c => c.type === 'npc' || c.isMonster);

                return (
                  <>
                    <div className="flex border-b border-white/10 bg-black/20 px-4 pt-2 gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSpawnerTab('players')}
                        className={cn(
                          "px-3 py-2 text-xs font-mono font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer",
                          spawnerTab === 'players'
                            ? "border-arcane text-arcane bg-arcane/10 rounded-t-xl"
                            : "border-transparent text-parchment/50 hover:text-parchment"
                        )}
                      >
                        <Users size={14} />
                        <span>Heróis da Campanha ({campaignPlayers.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpawnerTab('monsters')}
                        className={cn(
                          "px-3 py-2 text-xs font-mono font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer",
                          spawnerTab === 'monsters'
                            ? "border-purple-400 text-purple-300 bg-purple-500/10 rounded-t-xl"
                            : "border-transparent text-parchment/50 hover:text-parchment"
                        )}
                      >
                        <Skull size={14} />
                        <span>Monstros & NPCs ({campaignMonsters.length + MONSTER_PRESETS.length})</span>
                      </button>
                    </div>

                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                      {spawnerTab === 'players' ? (
                        <>
                          <p className="text-xs text-parchment/60 leading-relaxed font-mono">
                            Os dados de cada token (<strong>Nome, HP, Imagem e Bônus de Iniciativa</strong>) são sincronizados diretamente da ficha do personagem do jogador da campanha:
                          </p>

                          {campaignPlayers.length === 0 ? (
                            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-2">
                              <Users size={28} className="mx-auto text-parchment/30" />
                              <h5 className="font-serif text-sm font-bold text-parchment">
                                Nenhum Herói Vinculado à Campanha
                              </h5>
                              <p className="text-xs text-parchment/50 max-w-sm mx-auto">
                                Jogadores que criarem personagens vinculados a esta campanha aparecerão aqui com dados completos sincronizados.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {campaignPlayers.map((char) => {
                                const charData = extractCharacterDataForToken(char);
                                const isAlreadyOnMap = tokens.some(t => t.characterId === char.id);
                                return (
                                  <div
                                    key={char.id}
                                    onClick={() => handleSpawnPlayerCharacterToken(char)}
                                    className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-arcane/50 hover:bg-arcane/10 cursor-pointer transition-all flex items-center gap-3 group relative"
                                  >
                                    <div className="w-10 h-10 rounded-full border-2 border-arcane/60 overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
                                      {charData?.avatar ? (
                                        <img src={charData.avatar} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <User size={18} className="text-arcane" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <h5 className="font-serif text-xs font-bold text-parchment group-hover:text-arcane truncate">
                                          {charData?.name}
                                        </h5>
                                        {isAlreadyOnMap && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                            No mapa
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-parchment/60 mt-0.5">
                                        <span className="text-emerald-400 font-semibold">HP {charData?.hp}/{charData?.maxHp}</span>
                                        <span>•</span>
                                        <span className="text-amber-400">Inic +{charData?.iniBonus}</span>
                                      </div>
                                      <div className="text-[9px] font-mono text-parchment/40 truncate">
                                        {char.class || 'Aventureiro'}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="px-2 py-1 rounded-lg bg-arcane/20 text-arcane text-[10px] font-mono font-bold group-hover:bg-arcane group-hover:text-obsidian transition-colors"
                                    >
                                      + Inserir
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-xs text-parchment/60 leading-relaxed font-mono">
                            Escolha monstros e NPCs para posicionar no mapa. Mestre pode posicionar de <strong>forma oculta (invisível aos jogadores)</strong> para emboscadas táticas:
                          </p>

                          {/* Campaign Monsters & NPCs Section */}
                          {campaignMonsters.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Skull size={13} className="text-rose-400" />
                                <span>Criaturas & NPCs da Campanha ({campaignMonsters.length})</span>
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {campaignMonsters.map((char) => {
                                  const isMonster = Boolean(char.isMonster);
                                  const isAlreadyOnMap = tokens.some(t => t.characterId === char.id);
                                  return (
                                    <div
                                      key={char.id}
                                      className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between gap-2 group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div 
                                          className={cn(
                                            "w-10 h-10 rounded-full border-2 overflow-hidden bg-black/40 shrink-0 flex items-center justify-center",
                                            isMonster ? "border-rose-500/70" : "border-amber-500/70"
                                          )}
                                        >
                                          {char.avatar ? (
                                            <img src={char.avatar} alt="" className="w-full h-full object-cover" />
                                          ) : isMonster ? (
                                            <Skull size={18} className="text-rose-400" />
                                          ) : (
                                            <Shield size={18} className="text-amber-400" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <h5 className="font-serif text-xs font-bold text-parchment truncate">
                                              {char.name}
                                            </h5>
                                            {isMonster ? (
                                              <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                Monstro
                                              </span>
                                            ) : (
                                              <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                NPC
                                              </span>
                                            )}
                                            {isAlreadyOnMap && (
                                              <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                No mapa
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-parchment/60 mt-0.5">
                                            <span className="text-rose-400 font-semibold">HP {char.hp || char.stats?.hp || 20}</span>
                                            <span>•</span>
                                            <span className="text-parchment/40">{char.monsterType || char.class || 'Hostil'}</span>
                                            {char.dangerLevel && (
                                              <>
                                                <span>•</span>
                                                <span className="text-amber-400 font-bold">{char.dangerLevel}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Quick Spawn Buttons: Oculto vs Visível */}
                                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5">
                                        <button
                                          type="button"
                                          onClick={() => handleSpawnCampaignCharacterToken(char, true)}
                                          className="flex-1 py-1 px-2 rounded-lg bg-purple-950/70 border border-purple-500/40 hover:bg-purple-900 text-purple-200 text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
                                          title="Posicionar este monstro no mapa de forma OCULTA (invisível aos jogadores)"
                                        >
                                          <EyeOff size={11} className="text-purple-400" />
                                          <span>👻 Oculto</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSpawnCampaignCharacterToken(char, false)}
                                          className="flex-1 py-1 px-2 rounded-lg bg-white/10 border border-white/15 hover:bg-white/20 text-parchment text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
                                          title="Posicionar este monstro no mapa visível aos jogadores"
                                        >
                                          <Eye size={11} className="text-emerald-400" />
                                          <span>👁️ Visível</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Quick Presets Section */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-mono font-bold text-parchment/60 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles size={13} className="text-arcane" />
                              <span>Modelos Rápidos da Masmorra ({MONSTER_PRESETS.length})</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {MONSTER_PRESETS.map((m, idx) => {
                                const MIcon = m.icon;
                                return (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-purple-500/30 transition-all flex flex-col justify-between gap-2 group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div 
                                        style={{ borderColor: m.color }}
                                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center bg-black/40 shrink-0"
                                      >
                                        <MIcon size={18} style={{ color: m.color }} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h5 className="font-serif text-xs font-bold text-parchment truncate">
                                          {m.name}
                                        </h5>
                                        <div className="flex items-center gap-2 text-[10px] font-mono text-parchment/50 mt-0.5">
                                          <span className="text-rose-400">HP {m.hp}</span>
                                          <span>•</span>
                                          <span>{m.size}x{m.size}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5">
                                      <button
                                        type="button"
                                        onClick={() => handleSpawnPreset(m, true)}
                                        className="flex-1 py-1 px-2 rounded-lg bg-purple-950/70 border border-purple-500/40 hover:bg-purple-900 text-purple-200 text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
                                        title="Posicionar de forma oculta (invisível aos jogadores)"
                                      >
                                        <EyeOff size={11} className="text-purple-400" />
                                        <span>👻 Oculto</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSpawnPreset(m, false)}
                                        className="flex-1 py-1 px-2 rounded-lg bg-white/10 border border-white/15 hover:bg-white/20 text-parchment text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
                                        title="Posicionar visível no mapa"
                                      >
                                        <Eye size={11} className="text-emerald-400" />
                                        <span>👁️ Visível</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-end">
                <button
                  onClick={() => setIsSpawnerOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs transition-colors cursor-pointer"
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
                  <strong className="text-rose-400 block mb-1">📡 Sinalizador (Sinal de Ping):</strong>
                  <span>Clique no mapa com o botão <strong>Ping</strong> (ou <strong>Shift + Clique</strong>) para alertar os outros jogadores com pulso sonoro e radar animado em tempo real.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-sky-400 block mb-1">✏️ Desenhar no Mapa:</strong>
                  <span>Tanto jogadores quanto mestre podem desenhar livremente com a <strong>Caneta</strong>, escolher cores e espessuras, usar a <strong>Borracha</strong> para apagar traços e limpar desenhos a qualquer momento.</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <strong className="text-amber-300 block mb-1">📍 Marcadores Táticos:</strong>
                  <span>Clique em <strong>Marcador</strong> e marque no mapa perigos, armadilhas, tesouros, portas secretas e notas. Clique no marcador para ver detalhes ou removê-lo.</span>
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

      {/* Create Tactical Dungeon Marker Modal */}
      <AnimatePresence>
        {newMarkerCoord && (
          <div 
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setNewMarkerCoord(null);
                setIsAddingMarker(false);
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setNewMarkerCoord(null);
                setIsAddingMarker(false);
              }
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-arcane/40 rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 text-arcane">
                  <MapPin size={18} />
                  <h3 className="font-serif font-bold text-sm text-parchment">
                    Adicionar Marcador Tático
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewMarkerCoord(null);
                    setIsAddingMarker(false);
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div>
                  <label className="block text-parchment/70 mb-1 text-[11px]">
                    Rótulo / Nome do Marcador:
                  </label>
                  <input
                    type="text"
                    value={markerDraft.label}
                    onChange={(e) => setMarkerDraft({ ...markerDraft, label: e.target.value })}
                    placeholder="Ex: Armadilha, Baú Secreto, Inimigo..."
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-1.5 text-parchment focus:outline-none focus:border-arcane text-xs"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-parchment/70 mb-1 text-[11px]">
                    Categoria:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(DUNGEON_MARKER_CATEGORIES) as DungeonMapMarker['category'][]).map(catKey => {
                      const cat = DUNGEON_MARKER_CATEGORIES[catKey];
                      const IconC = cat.icon;
                      const isCurrent = markerDraft.category === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setMarkerDraft({
                            ...markerDraft,
                            category: catKey,
                            color: cat.color
                          })}
                          className={cn(
                            "p-1.5 rounded-xl border text-left flex items-center gap-1.5 transition-all cursor-pointer text-[10px]",
                            isCurrent
                              ? "bg-white/15 border-arcane text-white font-bold"
                              : "bg-white/5 border-white/10 text-parchment/60 hover:text-parchment"
                          )}
                        >
                          <IconC size={12} style={{ color: cat.color }} />
                          <span className="truncate">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-parchment/70 mb-1 text-[11px]">
                    Anotação (Opcional):
                  </label>
                  <textarea
                    value={markerDraft.description}
                    onChange={(e) => setMarkerDraft({ ...markerDraft, description: e.target.value })}
                    placeholder="Descrição para os aventureiros..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-1.5 text-parchment focus:outline-none focus:border-arcane text-xs resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setNewMarkerCoord(null);
                    setIsAddingMarker(false);
                  }}
                  className="px-3 py-1.5 rounded-xl hover:bg-white/10 text-parchment/60 text-xs font-mono cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveMarker}
                  disabled={!markerDraft.label.trim()}
                  className="px-4 py-1.5 rounded-xl bg-arcane hover:bg-arcane/90 text-obsidian text-xs font-mono font-bold disabled:opacity-50 transition-all cursor-pointer shadow-md"
                >
                  Salvar Marcador
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Character Sheet Modal over Dungeon Map */}
      {sheetModalCharacterId && (
        <CharacterSheet
          characterIdProp={sheetModalCharacterId}
          isModal={true}
          onClose={() => setSheetModalCharacterId(null)}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {isShortcutsOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsShortcutsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-950 border border-arcane/50 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5 text-arcane">
                  <div className="p-2 rounded-xl bg-arcane/20 border border-arcane/40">
                    <Keyboard size={20} />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-parchment">
                      Atalhos Rápidos de Teclado
                    </h3>
                    <p className="text-[11px] text-parchment/60 font-mono">
                      Controles rápidos para combate tático e mestre
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShortcutsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl text-parchment/60 hover:text-parchment cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-[11px] font-bold text-arcane uppercase tracking-wider block mb-1">
                    Movimento & Câmera
                  </span>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Mover Token</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">WASD / Setas</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Alternar Mover / Pan</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">M ou V</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Mão / Panorâmica</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">H</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Zoom In / Out</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">+ / -</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Resetar Câmera</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">0</kbd>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                    Ferramentas de Combate
                  </span>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Régua Tática</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-purple-300">R</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Magias em Área (AoE)</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-purple-300">A</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Pincel de Névoa (Mestre)</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-purple-300">F</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Grade Tática (Grid)</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-purple-300">G</kbd>
                  </div>
                  <div className="flex items-center justify-between text-parchment/80">
                    <span>Ping no Mapa</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-purple-300">Shift + Clique</kbd>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                    Mesa Presencial & Utilidades
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between text-parchment/80">
                      <span>Modo TV / Mesa Presencial</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">T</kbd>
                    </div>
                    <div className="flex items-center justify-between text-parchment/80">
                      <span>Excluir Token Selecionado</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-rose-300">Delete / Backspace</kbd>
                    </div>
                    <div className="flex items-center justify-between text-parchment/80">
                      <span>Deselecionar / Sair da TV</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-parchment/60">ESC</kbd>
                    </div>
                    <div className="flex items-center justify-between text-parchment/80">
                      <span>Ajuda de Atalhos</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-[10px] text-amber-300">?</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsShortcutsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-arcane hover:bg-arcane/90 text-obsidian text-xs font-mono font-bold transition-all shadow-md cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bestiary Modal */}
      <BestiaryModal
        isOpen={isBestiaryOpen}
        onClose={() => setIsBestiaryOpen(false)}
        onSpawnMonster={handleSpawnFromBestiary}
      />

      {/* Encounter Generator Modal */}
      <EncounterGeneratorModal
        isOpen={isEncounterGeneratorOpen}
        onClose={() => setIsEncounterGeneratorOpen(false)}
        partyCharacters={campaignCharacters}
        onSpawnEncounter={handleSpawnEncounter}
      />

      {/* Atmosphere & Soundscape Control Popover */}
      <AnimatePresence>
        {isAtmospherePanelOpen && (
          <div 
            data-toolbar="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="fixed top-16 right-4 z-50 w-80 bg-obsidian/95 backdrop-blur-xl border border-sky-500/30 rounded-2xl p-4 shadow-2xl text-xs flex flex-col gap-4 font-sans"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-sky-400" />
                <h3 className="font-serif font-bold text-parchment text-sm">Ambiência & Clima</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAtmospherePanelOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Soundscape presets */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-sky-300 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Trilha Procedural WebAudio</span>
                <span className="text-[10px] text-parchment/40">Looping Contínuo</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {ATMOSPHERE_PRESETS.map((preset) => {
                  const isActive = activeSoundscape === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleChangeSoundscape(preset.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer",
                        isActive
                          ? "bg-sky-500/20 border-sky-500/50 text-sky-200 shadow-sm"
                          : "bg-white/5 border-white/10 text-parchment/70 hover:bg-white/10 hover:text-parchment"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-xs flex items-center gap-1.5">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-parchment/50">
                          {preset.description}
                        </span>
                      </div>
                      {isActive && <Check size={14} className="text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Volume slider & mute */}
            <div className="flex flex-col gap-1.5 bg-black/40 p-2.5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between text-[11px] font-mono text-parchment/70">
                <span className="flex items-center gap-1">
                  <Sliders size={12} className="text-sky-400" />
                  <span>Volume da Ambiência</span>
                </span>
                <span>{isAtmosphereMuted ? 'MUDO' : `${Math.round(atmosphereVolume * 100)}%`}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAtmosphereMuted(!isAtmosphereMuted)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-parchment cursor-pointer"
                  title={isAtmosphereMuted ? "Desmutar som" : "Mutar som"}
                >
                  {isAtmosphereMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-sky-300" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isAtmosphereMuted ? 0 : atmosphereVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAtmosphereVolume(val);
                    if (isAtmosphereMuted && val > 0) {
                      setIsAtmosphereMuted(false);
                    }
                  }}
                  className="w-full accent-sky-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>
            </div>

            {/* Weather Overlay Options */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-amber-300 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Clima Visual no Mapa</span>
                <span className="text-[10px] text-parchment/40">Partículas em Tempo Real</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {WEATHER_OPTIONS.map((opt) => {
                  const isWeatherActive = activeWeather === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChangeWeather(opt.id)}
                      className={cn(
                        "p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1",
                        isWeatherActive
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm font-semibold"
                          : "bg-white/5 border-white/10 text-parchment/70 hover:bg-white/10 hover:text-parchment"
                      )}
                    >
                      <span className="text-sm">{opt.icon}</span>
                      <span className="text-[10px]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Ambient Status if active */}
            {customAmbientUrl && (
              <div className="p-2 rounded-xl bg-sky-950/40 border border-sky-500/30 text-[11px] font-mono text-sky-200 flex items-center justify-between">
                <span className="truncate">🎵 Trilha: {customAmbientName || 'Customizada'}</span>
                <button
                  type="button"
                  onClick={() => handleChangeSoundscape('none')}
                  className="text-red-400 hover:text-red-300 text-[10px] ml-1 shrink-0"
                >
                  Desligar
                </button>
              </div>
            )}

            {/* GM Master Sound Manager Trigger Button */}
            {isGM && (
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsAtmospherePanelOpen(false);
                    setIsSoundManagerModalOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl bg-arcane hover:bg-arcane/90 text-obsidian text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-arcane/20 transition-all cursor-pointer"
                >
                  <Music size={14} />
                  <span>Gestor Completo de Sons do Mestre</span>
                </button>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* GM Full Sound Manager Modal over Dungeon Battlemap */}
      <AnimatePresence>
        {isSoundManagerModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-arcane/40 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setIsSoundManagerModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-parchment cursor-pointer z-20"
                title="Fechar gestor de sons"
              >
                <X size={18} />
              </button>

              <SoundEffectManager
                currentSettings={{
                  ...(activeSessionData?.soundSettings || {}),
                  ...(activeSessionData || {}),
                  customAmbientSound: customAmbientUrl,
                  customAmbientName: customAmbientName
                }}
                sessionName={activeSessionData?.name || 'Campanha'}
                sessionId={selectedSessionId || undefined}
                onSaveSession={handleSaveCampaignSounds}
                onClose={() => setIsSoundManagerModalOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent DM Audio Controller & SFX Soundboard directly on Dungeon Map */}
      {isGM && (
        <GMAudioController
          sessionId={selectedSessionId || undefined}
          sessionName={activeSessionData?.name || activePreset.name}
          campaignSounds={campaignSounds}
          defaultTab="sfx"
          className="fixed bottom-3 right-24 sm:right-28 z-40 select-none"
          onOpenFullSoundManager={() => setIsSoundManagerModalOpen(true)}
        />
      )}
      {/* Active Room Stamp Mode Floating Notification Bar */}
      <AnimatePresence>
        {activeStampShape && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-16 left-1/2 z-50 bg-obsidian/95 border-2 border-amber-400 text-parchment px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md select-none"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <LayoutGrid size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <span>Construir Sala:</span>
                <span className="text-white underline">{activeStampShape.name}</span>
                <span className="text-[10px] font-mono text-amber-200/70 font-normal">({activeStampShape.dimensionsLabel})</span>
              </div>
              <p className="text-[10px] text-parchment/70">
                Mova o mouse sobre o mapa para ver o contorno e <strong>clique no local desejado</strong>
              </p>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <button
                type="button"
                onClick={() => {
                  const centerCol = Math.floor(activePreset.gridCols / 2);
                  const centerRow = Math.floor(activePreset.gridRows / 2);
                  handleStampRoom(activeStampShape, centerCol, centerRow, stampColor);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-obsidian text-[11px] font-bold font-mono transition-colors cursor-pointer"
                title="Carimbar no centro do mapa"
              >
                No Centro
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveStampShape(null);
                  setStampCursorGrid(null);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-parchment text-xs cursor-pointer"
                title="Encerrar carimbo de sala (ESC)"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pre-defined Room Shapes Library Modal */}
      <RoomShapeLibraryModal
        isOpen={isRoomShapesModalOpen}
        onClose={() => setIsRoomShapesModalOpen(false)}
        onSelectShape={(shape, color) => {
          setActiveStampShape(shape);
          setStampColor(color);
        }}
        onStampCenter={(shape, color) => {
          handleStampCenter(shape, color);
        }}
      />
    </div>
  );
}
