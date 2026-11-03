import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Map as MapIcon, 
  MapPin, 
  Compass, 
  Plus, 
  Search, 
  Filter, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Crosshair, 
  Grid, 
  Castle, 
  Skull, 
  Mountain, 
  Tent, 
  Flame, 
  Sparkles, 
  Beer, 
  Anchor, 
  TreePine,
  Landmark,
  Gem,
  Swords,
  Sun,
  Key,
  Flag,
  Info,
  HelpCircle,
  X, 
  Trash2, 
  Edit3, 
  Save, 
  Share2, 
  Check, 
  Copy, 
  Calendar, 
  Shield, 
  Eye, 
  EyeOff, 
  Layers, 
  Maximize2, 
  Minimize2, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Navigation,
  BookOpen,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Globe,
  User,
  Radio,
  Scroll
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
  doc, 
  deleteDoc, 
  OperationType, 
  handleFirestoreError 
} from '../firebase';

import { 
  resolveCampaignMaps, 
  toggleCampaignMapActive, 
  CampaignMapItem,
  DEFAULT_WORLD_PRESETS,
  DEFAULT_DUNGEON_PRESETS 
} from '../lib/campaignMaps';

import MapRestrictedAccess from './MapRestrictedAccess';
import CampaignMapManagerModal from './CampaignMapManagerModal';
import { MapDrawingOverlay } from './map/MapDrawingOverlay';
import { MapDrawingToolbar } from './map/MapDrawingToolbar';
import { WorldMapPingData } from '../types/mapDrawing';
import { playPingAudioAlert } from '../lib/pingSound';
import CharacterSheet from './CharacterSheet';

// Built-in map assets
import aethelgardMap from '../assets/images/fantasy_world_map_1791537797619.jpg';
import archipelagoMap from '../assets/images/archipelago_fantasy_map_1791537811804.jpg';

export interface MapPinData {
  id: string;
  title: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  mapId: string;
  customMapUrl?: string;
  sessionId?: string;
  sessionName?: string;
  category: 'dungeon' | 'town' | 'poi' | 'ruins' | 'nature' | 'camp' | 'danger' | 'tavern' | 'port' | 'sanctuary' | 'treasure' | 'tower' | 'city' | string;
  customIcon?: string;
  dangerLevel: 'safe' | 'moderate' | 'dangerous' | 'deadly';
  status: 'sighted' | 'explored' | 'cleared' | 'unexplored';
  description: string;
  secrets?: string;
  image?: string;
  discoveredDate?: string;
  discoveredBy?: string;
  isSecret?: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MapPreset {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  defaultScale: string;
}

const MAP_PRESETS: MapPreset[] = [
  {
    id: 'aethelgard',
    name: 'Continente de Aethelgard',
    subtitle: 'Reinos Antigos, Florestas Místicas & Picos Gelados',
    imageUrl: aethelgardMap,
    defaultScale: '1 cm = 50 milhas'
  },
  {
    id: 'archipelago',
    name: 'As Ilhas Despedaçadas',
    subtitle: 'Arquipélago Pirata, Recifes Mortais & Mares Bravios',
    imageUrl: archipelagoMap,
    defaultScale: '1 cm = 30 léguas'
  },
  {
    id: 'custom',
    name: 'Mapa Personalizado',
    subtitle: 'Carregue uma imagem ou URL de mapa customizado',
    imageUrl: '',
    defaultScale: 'Escala Customizada'
  }
];

// 20 Unique RPG Icons available for categories and pin customization
export const AVAILABLE_ICONS: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  Skull: { label: 'Masmorra / Crânio', icon: Skull },
  Castle: { label: 'Castelo / Cidade', icon: Castle },
  Sparkles: { label: 'Ponto Místico (POI)', icon: Sparkles },
  Landmark: { label: 'Monumento / Ruínas', icon: Landmark },
  TreePine: { label: 'Floresta / Bosque', icon: TreePine },
  Mountain: { label: 'Montanhas / Ermos', icon: Mountain },
  Tent: { label: 'Acampamento / Refúgio', icon: Tent },
  Flame: { label: 'Covil / Fogo Hostil', icon: Flame },
  Beer: { label: 'Taverna / Caneca', icon: Beer },
  Anchor: { label: 'Porto / Âncora', icon: Anchor },
  Sun: { label: 'Santuário / Templo', icon: Sun },
  Gem: { label: 'Tesouro / Relíquia', icon: Gem },
  Shield: { label: 'Fortaleza / Defesa', icon: Shield },
  Swords: { label: 'Campo de Batalha', icon: Swords },
  Compass: { label: 'Bússola / Exploração', icon: Compass },
  Eye: { label: 'Torre de Vigia', icon: Eye },
  Key: { label: 'Chave / Câmara Secreta', icon: Key },
  BookOpen: { label: 'Grimório / Lore', icon: BookOpen },
  Crosshair: { label: 'Objetivo de Missão', icon: Crosshair },
  Flag: { label: 'Bandeira / Posto Avançado', icon: Flag },
};

export interface CategoryConfig {
  id: string;
  label: string;
  shortLabel: string;
  defaultIconName: keyof typeof AVAILABLE_ICONS;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
  border: string;
  ring: string;
  badge: string;
  glow: string;
  description: string;
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  dungeon: {
    id: 'dungeon',
    label: 'Masmorra / Dungeon',
    shortLabel: 'Dungeon',
    defaultIconName: 'Skull',
    icon: Skull,
    color: 'text-purple-400',
    bg: 'bg-purple-950/70',
    border: 'border-purple-500/50',
    ring: 'ring-purple-500/40',
    badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    glow: 'shadow-purple-500/25',
    description: 'Catacumbas subterrâneas, labirintos sombrios, criptas e masmorras profundas'
  },
  town: {
    id: 'town',
    label: 'Cidade / Town / Vila',
    shortLabel: 'Town',
    defaultIconName: 'Castle',
    icon: Castle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/70',
    border: 'border-emerald-500/50',
    ring: 'ring-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    glow: 'shadow-emerald-500/25',
    description: 'Cidades fortificadas, capitais, aldeias, entrepostos populosos e cidadelas'
  },
  poi: {
    id: 'poi',
    label: 'Ponto de Interesse (POI)',
    shortLabel: 'POI',
    defaultIconName: 'Sparkles',
    icon: Sparkles,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/70',
    border: 'border-cyan-500/50',
    ring: 'ring-cyan-500/40',
    badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    glow: 'shadow-cyan-500/25',
    description: 'Monumentos mágicos, monólitos arcanos, anomalias celestes e marcos místicos'
  },
  ruins: {
    id: 'ruins',
    label: 'Ruínas Antigas',
    shortLabel: 'Ruínas',
    defaultIconName: 'Landmark',
    icon: Landmark,
    color: 'text-stone-300',
    bg: 'bg-stone-900/80',
    border: 'border-stone-400/50',
    ring: 'ring-stone-400/40',
    badge: 'bg-stone-500/20 text-stone-200 border border-stone-500/40',
    glow: 'shadow-stone-500/25',
    description: 'Cidades soterradas, templos profanados e civilizações esquecidas pelos deuses'
  },
  nature: {
    id: 'nature',
    label: 'Floresta / Ermos',
    shortLabel: 'Ermos',
    defaultIconName: 'TreePine',
    icon: TreePine,
    color: 'text-teal-400',
    bg: 'bg-teal-950/70',
    border: 'border-teal-500/50',
    ring: 'ring-teal-500/40',
    badge: 'bg-teal-500/20 text-teal-300 border border-teal-500/40',
    glow: 'shadow-teal-500/25',
    description: 'Bosques ancestrais, picos montanhosos e desfiladeiros selvagens inexplorados'
  },
  camp: {
    id: 'camp',
    label: 'Acampamento / Refúgio',
    shortLabel: 'Acampamento',
    defaultIconName: 'Tent',
    icon: Tent,
    color: 'text-amber-400',
    bg: 'bg-amber-950/70',
    border: 'border-amber-500/50',
    ring: 'ring-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    glow: 'shadow-amber-500/25',
    description: 'Bivaques do grupo, postos avançados de patrulha e abrigos montados'
  },
  danger: {
    id: 'danger',
    label: 'Área de Perigo / Covil',
    shortLabel: 'Perigo / Covil',
    defaultIconName: 'Flame',
    icon: Flame,
    color: 'text-rose-400',
    bg: 'bg-rose-950/70',
    border: 'border-rose-500/50',
    ring: 'ring-rose-500/40',
    badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    glow: 'shadow-rose-500/25',
    description: 'Ninhos de feras lendárias, covis de dragões e regiões com fendas elementais'
  },
  tavern: {
    id: 'tavern',
    label: 'Taverna / Entreposto',
    shortLabel: 'Taverna',
    defaultIconName: 'Beer',
    icon: Beer,
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/70',
    border: 'border-yellow-500/50',
    ring: 'ring-yellow-500/40',
    badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    glow: 'shadow-yellow-500/25',
    description: 'Estalagens acolhedoras, feiras de mercadores e pontos seguros para descanso'
  },
  port: {
    id: 'port',
    label: 'Porto / Marítimo',
    shortLabel: 'Porto',
    defaultIconName: 'Anchor',
    icon: Anchor,
    color: 'text-blue-400',
    bg: 'bg-blue-950/70',
    border: 'border-blue-500/50',
    ring: 'ring-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    glow: 'shadow-blue-500/25',
    description: 'Docas marítimas, baías de ancoragem, ancoradouros e ilhas corsárias'
  },
  sanctuary: {
    id: 'sanctuary',
    label: 'Santuário / Templo',
    shortLabel: 'Santuário',
    defaultIconName: 'Sun',
    icon: Sun,
    color: 'text-amber-300',
    bg: 'bg-amber-950/70',
    border: 'border-amber-400/50',
    ring: 'ring-amber-400/40',
    badge: 'bg-amber-400/20 text-amber-200 border border-amber-400/40',
    glow: 'shadow-amber-400/25',
    description: 'Fontes consagradas, altares de bênção divina e templos iluminados'
  },
  treasure: {
    id: 'treasure',
    label: 'Tesouro / Relíquia',
    shortLabel: 'Tesouro',
    defaultIconName: 'Gem',
    icon: Gem,
    color: 'text-violet-400',
    bg: 'bg-violet-950/70',
    border: 'border-violet-500/50',
    ring: 'ring-violet-500/40',
    badge: 'bg-violet-500/20 text-violet-300 border border-violet-500/40',
    glow: 'shadow-violet-500/25',
    description: 'Baús perdidos, artefatos ancestrais, cofres trancados e riquezas esquecidas'
  },
  tower: {
    id: 'tower',
    label: 'Torre / Fortaleza',
    shortLabel: 'Torre / Forte',
    defaultIconName: 'Shield',
    icon: Shield,
    color: 'text-sky-400',
    bg: 'bg-sky-950/70',
    border: 'border-sky-500/50',
    ring: 'ring-sky-500/40',
    badge: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
    glow: 'shadow-sky-500/25',
    description: 'Torres arcanas de magos, baluartes militares de sentinela e fortificações'
  }
};

export function getCategoryConfig(category?: string): CategoryConfig {
  if (!category) return CATEGORIES.poi;
  if (category === 'city') return CATEGORIES.town;
  return CATEGORIES[category] || CATEGORIES.poi;
}

export function getPinIconComponent(pin: { category?: string; customIcon?: string }): React.ComponentType<{ size?: number; className?: string }> {
  if (pin.customIcon && AVAILABLE_ICONS[pin.customIcon]) {
    return AVAILABLE_ICONS[pin.customIcon].icon;
  }
  const config = getCategoryConfig(pin.category);
  return config.icon;
}

const DANGER_LEVELS = {
  safe: { label: 'Seguro', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
  moderate: { label: 'Moderado', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  dangerous: { label: 'Perigoso', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  deadly: { label: 'Letal', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30' }
};

const STATUS_OPTIONS = {
  sighted: { label: 'Apenas Avistado', icon: Eye, color: 'text-parchment/60' },
  explored: { label: 'Em Exploração', icon: Compass, color: 'text-cyan-400' },
  cleared: { label: 'Conquistado / Pacificado', icon: CheckCircle2, color: 'text-emerald-400' },
  unexplored: { label: 'Rumor / Inexplorado', icon: AlertTriangle, color: 'text-amber-400' }
};

// Initial starter pins for demo/exploration
const INITIAL_DEMO_PINS: MapPinData[] = [
  {
    id: 'demo-1',
    title: 'Cidadela de Aethel',
    x: 43.5,
    y: 11.2,
    mapId: 'aethelgard',
    sessionName: 'Campanha Principal',
    category: 'town',
    customIcon: 'Castle',
    dangerLevel: 'safe',
    status: 'explored',
    description: 'A imponente fortaleza da coroa, com muralhas de mármore branco e sentinelas da Ordem do Grifo.',
    discoveredDate: new Date().toISOString().split('T')[0],
    discoveredBy: 'Guarda da Noite',
    createdBy: 'system'
  },
  {
    id: 'demo-2',
    title: 'Floresta de Silverwood',
    x: 34.0,
    y: 28.5,
    mapId: 'aethelgard',
    sessionName: 'Sessão 1: O Bosque Prateado',
    category: 'nature',
    customIcon: 'TreePine',
    dangerLevel: 'moderate',
    status: 'explored',
    description: 'Árvores anciãs de folhas prateadas. Rumores indicam que criaturas místicas protegem o coração do bosque.',
    discoveredDate: new Date().toISOString().split('T')[0],
    discoveredBy: 'Grupo de Aventureiros',
    createdBy: 'system'
  },
  {
    id: 'demo-3',
    title: 'Catacumbas de Khardoos (Dungeon)',
    x: 77.2,
    y: 37.0,
    mapId: 'aethelgard',
    sessionName: 'Sessão 2: As Catacumbas',
    category: 'dungeon',
    customIcon: 'Skull',
    dangerLevel: 'dangerous',
    status: 'unexplored',
    description: 'Masmorra subterrânea proibida repleta de inscrições rúnicas profanas e ecos de cultistas arcanos.',
    discoveredDate: new Date().toISOString().split('T')[0],
    discoveredBy: 'Exploradores de Valoria',
    createdBy: 'system'
  },
  {
    id: 'demo-4',
    title: 'Monólito Astral (POI)',
    x: 58.0,
    y: 22.0,
    mapId: 'aethelgard',
    sessionName: 'Sessão 3: O Eclipse',
    category: 'poi',
    customIcon: 'Sparkles',
    dangerLevel: 'moderate',
    status: 'explored',
    description: 'Obelisco celeste que ressoa com energia cósmica. Concede visões proféticas a conjuradores.',
    discoveredDate: new Date().toISOString().split('T')[0],
    discoveredBy: 'Magos da Torre',
    createdBy: 'system'
  },
  {
    id: 'demo-5',
    title: 'Porto dos Contrabandistas',
    x: 32.5,
    y: 33.5,
    mapId: 'archipelago',
    sessionName: 'Campanha Pirata',
    category: 'port',
    customIcon: 'Anchor',
    dangerLevel: 'moderate',
    status: 'explored',
    description: 'Entreposto clandestino de marinheiros e corsários. Bom lugar para conseguir mapas e poções raras.',
    discoveredDate: new Date().toISOString().split('T')[0],
    discoveredBy: 'Capitão Vane',
    createdBy: 'system'
  },
  {
    id: 'demo-6',
    title: 'Ilha do Baú Amaldiçoado',
    x: 56.0,
    y: 47.0,
    mapId: 'archipelago',
    sessionName: 'Sessão Especial: O Baú Maldito',
    category: 'treasure',
    customIcon: 'Gem',
    dangerLevel: 'deadly',
    status: 'unexplored',
    description: 'Local exato assinalado no antigo pergaminho de bordo com relíquias preciosas e ouro ancestral.',
    discoveredDate: new Date().toISOString().split('T')[0],
    discoveredBy: 'Navegantes',
    createdBy: 'system'
  }
];

// Helper to calculate grid sector (e.g. C-4)
function getGridSector(x: number, y: number): string {
  const colLetter = String.fromCharCode(65 + Math.min(9, Math.max(0, Math.floor(x / 10))));
  const rowNum = Math.min(10, Math.max(1, Math.floor(y / 10) + 1));
  return `${colLetter}-${rowNum}`;
}

export default function WorldMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = auth.currentUser;

  // Selected Map ID from URL search params (or default to 'aethelgard')
  const initialMapParam = searchParams.get('map') || 'aethelgard';
  const initialSessionParam = searchParams.get('session') || '';

  const [selectedMapId, setSelectedMapId] = React.useState<string>(initialMapParam);
  const [customMapUrl, setCustomMapUrl] = React.useState('');
  const [isSettingCustomUrl, setIsSettingCustomUrl] = React.useState(false);
  const [customMapsLoaded, setCustomMapsLoaded] = React.useState<boolean>(false);

  // Direct target map document from Firestore (loaded directly when map parameter is present in URL)
  const isCustomTargetRequested = Boolean(initialMapParam && initialMapParam !== 'aethelgard' && initialMapParam !== 'archipelago');
  const [targetMapDoc, setTargetMapDoc] = React.useState<CampaignMapItem | null>(null);
  const [targetMapLoading, setTargetMapLoading] = React.useState<boolean>(isCustomTargetRequested);

  // User Role & Campaign Management State
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
  const [userCharacters, setUserCharacters] = React.useState<any[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(initialSessionParam);
  const [activeSessionData, setActiveSessionData] = React.useState<any | null>(null);
  const [isMapManagerOpen, setIsMapManagerOpen] = React.useState(false);

  // Keep selectedMapId and selectedSessionId synced when URL parameters change
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

  // Custom Maps loaded from Firestore
  const [customWorldMaps, setCustomWorldMaps] = React.useState<CampaignMapItem[]>([]);
  const [customDungeonMaps, setCustomDungeonMaps] = React.useState<CampaignMapItem[]>([]);

  // Pins state
  const [pins, setPins] = React.useState<MapPinData[]>(() => {
    const saved = localStorage.getItem('world_map_pins_local');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse local pins', e);
      }
    }
    return INITIAL_DEMO_PINS;
  });

  // Game Sessions for linking
  const [sessions, setSessions] = React.useState<{ id: string; name: string; gmId?: string; [key: string]: any }[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // UI Modes & Modals
  const [isPlacingPin, setIsPlacingPin] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showCoordinatesOverlay, setShowCoordinatesOverlay] = React.useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [selectedPin, setSelectedPin] = React.useState<MapPinData | null>(null);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = React.useState(false);
  const [isEditingModalOpen, setIsEditingModalOpen] = React.useState(false);
  const [isLegendOpen, setIsLegendOpen] = React.useState(false);
  const [isCustomIconPickerOpen, setIsCustomIconPickerOpen] = React.useState(false);
  const [copiedCoords, setCopiedCoords] = React.useState(false);

  // New Pin Draft
  const [newPinCoord, setNewPinCoord] = React.useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [pinDraft, setPinDraft] = React.useState<Partial<MapPinData>>({
    title: '',
    category: 'dungeon',
    customIcon: 'Skull',
    dangerLevel: 'moderate',
    status: 'explored',
    sessionId: '',
    description: '',
    secrets: '',
    isSecret: false
  });

  // Zoom & Pan state
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [cursorCoords, setCursorCoords] = React.useState<{ x: number; y: number } | null>(null);

  // Freehand Map Drawing state
  const [isDrawingMode, setIsDrawingMode] = React.useState(false);
  const [drawingTool, setDrawingTool] = React.useState<'pen' | 'polygon' | 'eraser'>('pen');
  const [drawingColor, setDrawingColor] = React.useState('#38bdf8');
  const [drawingStrokeSize, setDrawingStrokeSize] = React.useState(3);

  // Real-time Multiplayer Pings
  const [isPingMode, setIsPingMode] = React.useState(false);
  const [pings, setPings] = React.useState<WorldMapPingData[]>([]);

  // Character Sheet Modal State
  const [sheetModalCharacterId, setSheetModalCharacterId] = React.useState<string | null>(null);

  // Map Selector Dropdown Popover State
  const [isMapSelectorOpen, setIsMapSelectorOpen] = React.useState(false);
  const mapSelectorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mapSelectorRef.current && !mapSelectorRef.current.contains(e.target as Node)) {
        setIsMapSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapImageRef = React.useRef<HTMLImageElement>(null);

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

  // Load User's Characters to strictly link to their campaign
  React.useEffect(() => {
    if (!user) return;
    const qChars = query(collection(db, 'characters'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(qChars, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserCharacters(list);
    }, err => {
      console.warn('Error loading characters for world map:', err);
    });
    return () => unsubscribe();
  }, [user]);

  // Load Game Sessions
  React.useEffect(() => {
    if (!user) return;

    const qSessions = query(collection(db, 'gameSessions'));
    const unsubscribe = onSnapshot(qSessions, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, name: data.name || 'Sessão sem nome', gmId: data.gmId, ...data });
      });
      setSessions(list);
    }, (err) => {
      console.warn('Could not list gameSessions for map dropdown:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // User characters with session
  const userCharactersWithSession = React.useMemo(() => {
    return userCharacters.filter(c => Boolean(c.sessionId));
  }, [userCharacters]);

  // GM sessions (sessions mastered by this user)
  const gmSessions = React.useMemo(() => {
    return sessions.filter(s => s.gmId === user?.uid);
  }, [sessions, user]);

  // Is GM of the current session or admin
  const isGM = React.useMemo(() => {
    if (viewMode === 'user') return false; // Quando o modo jogador está ativo, comporta-se estritamente como jogador!
    if (activeSessionData && activeSessionData.gmId === user?.uid) return true;
    if (selectedSessionId && gmSessions.some(s => s.id === selectedSessionId)) return true;
    if (!selectedSessionId && gmSessions.length > 0) return true;
    if (userRole === 'admin') return true;
    return false;
  }, [userRole, activeSessionData, user, selectedSessionId, gmSessions, viewMode]);

  // Listen to active session document in real time
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

  // Direct listener for explicitly targeted map document from Firestore
  React.useEffect(() => {
    const mapTarget = searchParams.get('map') || selectedMapId;
    if (!mapTarget || mapTarget === 'aethelgard' || mapTarget === 'archipelago') {
      setTargetMapDoc(null);
      setTargetMapLoading(false);
      return;
    }
    setTargetMapLoading(true);
    const unsub = onSnapshot(doc(db, 'worldMaps', mapTarget), (snap) => {
      setTargetMapLoading(false);
      if (snap.exists()) {
        const d = snap.data();
        setTargetMapDoc({
          id: snap.id,
          name: d.name || 'Mapa do Mundo Personalizado',
          subtitle: d.subtitle || 'Mapa personalizado da campanha',
          type: 'world',
          imageUrl: d.imageUrl,
          defaultScale: d.defaultScale || '1 cm = 25 léguas',
          active: d.active !== false,
          isCustom: true,
          sessionId: d.sessionId,
          createdBy: d.createdBy
        });
      } else {
        setTargetMapDoc(null);
      }
    }, err => {
      console.warn('Error fetching target map document directly:', err);
      setTargetMapLoading(false);
    });
    return () => unsub();
  }, [searchParams, selectedMapId]);

  // Load Custom World Maps from Firestore
  React.useEffect(() => {
    if (!user) return;
    const qWorld = query(collection(db, 'worldMaps'));
    const unsubscribe = onSnapshot(qWorld, (snapshot) => {
      const list: CampaignMapItem[] = [];
      const currentMapTarget = searchParams.get('map') || selectedMapId;
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const isTargetMap = docSnap.id === currentMapTarget;
        
        // Ownership / Access rule:
        // - Admin sees all
        // - GM sees maps they created OR maps belonging to campaigns they master
        // - Player sees maps that belong to their character's campaign session
        const isGmOfSession = Boolean(d.sessionId && gmSessions.some(s => s.id === d.sessionId));
        const isCreator = d.createdBy === user.uid;
        const matchesSession = Boolean(selectedSessionId && d.sessionId === selectedSessionId);
        
        const hasAccess = userRole === 'admin' || isTargetMap || isCreator || isGmOfSession || matchesSession;

        if (hasAccess) {
          list.push({
            id: docSnap.id,
            name: d.name || 'Mapa do Mundo Personalizado',
            subtitle: d.subtitle || 'Mapa personalizado da campanha',
            type: 'world',
            imageUrl: d.imageUrl,
            defaultScale: d.defaultScale || '1 cm = 25 léguas',
            active: d.active !== false,
            isCustom: true,
            sessionId: d.sessionId,
            createdBy: d.createdBy
          });
        }
      });
      setCustomWorldMaps(list);
      setCustomMapsLoaded(true);
    }, err => {
      console.warn('Error loading custom world maps:', err);
      setCustomMapsLoaded(true);
    });
    return () => unsubscribe();
  }, [user, userRole, selectedSessionId, gmSessions, selectedMapId, searchParams]);

  // Load Custom Dungeon Maps from Firestore (for the shared manager)
  React.useEffect(() => {
    if (!user) return;
    const qMaps = query(collection(db, 'dungeonMaps'));
    const unsubscribe = onSnapshot(qMaps, (snapshot) => {
      const list: CampaignMapItem[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const belongsToSession = selectedSessionId 
          ? d.sessionId === selectedSessionId 
          : (d.createdBy === user.uid || (d.sessionId && gmSessions.some(s => s.id === d.sessionId)));
        const isOwner = userRole === 'admin' || 
          d.createdBy === user.uid || 
          (d.sessionId && gmSessions.some(s => s.id === d.sessionId)) || 
          (selectedSessionId && d.sessionId === selectedSessionId);

        if (belongsToSession && isOwner) {
          list.push({
            id: docSnap.id,
            name: d.name || 'Masmorra Personalizada',
            subtitle: d.subtitle || 'Mapa de batalha personalizado criado pelo Mestre',
            theme: d.theme || 'Custom',
            type: 'dungeon',
            imageUrl: d.imageUrl,
            gridCols: Number(d.gridCols) || 24,
            gridRows: Number(d.gridRows) || 14,
            entranceCoord: d.entranceCoord || { x: 10, y: 50 },
            active: d.active !== false,
            isCustom: true,
            sessionId: d.sessionId,
            createdBy: d.createdBy
          });
        }
      });
      setCustomDungeonMaps(list);
    }, err => {
      console.warn('Error loading custom dungeon maps:', err);
    });
    return () => unsubscribe();
  }, [user, selectedSessionId, userRole, gmSessions]);

  // Synchronize campaign selection and active character:
  // - O jogador SÓ pode ver a campanha relacionada ao seu personagem, NUNCA fora do personagem
  React.useEffect(() => {
    const initialSession = searchParams.get('session');

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
      }
    }
  }, [isGM, gmSessions, userCharactersWithSession, selectedSessionId, selectedCharacterId, searchParams, user, userRole, activeSessionData]);

  // Resolve todos os mapas da campanha com as ativações do Mestre
  const campaignMaps = React.useMemo(() => {
    return resolveCampaignMaps(activeSessionData, customDungeonMaps, customWorldMaps);
  }, [activeSessionData, customDungeonMaps, customWorldMaps]);

  const campaignWorldMaps = campaignMaps.worldMaps;
  const campaignDungeonMaps = campaignMaps.dungeonMaps;

  // Filtro de acordo com a regra:
  // - O Mestre vê seus próprios mapas e os modelos
  // - O Jogador vê APENAS os mapas da campanha do personagem que está jogando (com vínculo), NÃO vê os mapas modelos!
  const allWorldPresets = React.useMemo(() => {
    if (isGM) {
      const list = [...campaignWorldMaps];
      if (targetMapDoc && !list.some(m => m.id === targetMapDoc.id)) {
        list.push(targetMapDoc);
      }
      return list;
    }

    // Regra estrita para o jogador:
    // Apenas mapas com vínculo com a campanha ativa do personagem (isCustom && sessionId) e que estejam ativos!
    const playerSession = selectedSessionId || userCharactersWithSession[0]?.sessionId;
    const playerMaps = customWorldMaps.filter(m => 
      m.isCustom && 
      Boolean(m.sessionId) && 
      m.sessionId === playerSession && 
      m.active !== false
    );
    if (targetMapDoc && targetMapDoc.isCustom && targetMapDoc.sessionId === playerSession && targetMapDoc.active !== false) {
      if (!playerMaps.some(m => m.id === targetMapDoc.id)) {
        playerMaps.push(targetMapDoc);
      }
    }
    return playerMaps;
  }, [campaignWorldMaps, customWorldMaps, isGM, selectedSessionId, userCharactersWithSession, targetMapDoc]);

  // Preset ativo atual
  const currentPreset = React.useMemo<CampaignMapItem>(() => {
    // 1. Prioridade absoluta: mapa solicitado diretamente via targetMapDoc
    if (targetMapDoc && targetMapDoc.id === selectedMapId) {
      return targetMapDoc;
    }

    // 2. Procura na lista de presets disponíveis
    const found = allWorldPresets.find(p => p.id === selectedMapId);
    if (found) return found;

    // 3. Procura na lista carregada do Firestore
    const customFound = customWorldMaps.find(m => m.id === selectedMapId);
    if (customFound) return customFound;

    // 4. Se o mapa solicitado for personalizado e ainda estiver carregando, NUNCA puxar o modelo base!
    if (selectedMapId && selectedMapId !== 'aethelgard' && selectedMapId !== 'archipelago') {
      return {
        id: selectedMapId,
        name: 'Carregando Mapa...',
        subtitle: 'Buscando informações do mapa cadastrado...',
        type: 'world',
        imageUrl: '',
        defaultScale: '1 cm = 25 léguas',
        active: true,
        isCustom: true
      };
    }

    // 5. Se for Mestre e estiver em modelo base: primeiro mapa disponível ou modelo base
    if (isGM) {
      return allWorldPresets[0] || DEFAULT_WORLD_PRESETS[0];
    }

    // 6. Se for Jogador: primeiro mapa vinculado à campanha. Se não houver nenhum mapa vinculado, retorna placeholder de campanha vazia (NÃO puxa mapa modelo!)
    if (allWorldPresets.length > 0) {
      return allWorldPresets[0];
    }

    return {
      id: 'none',
      name: 'Nenhum Mapa Vinculado',
      subtitle: 'Esta campanha não possui mapas de mundo vinculados e liberados pelo Mestre.',
      type: 'world',
      imageUrl: '',
      defaultScale: '1 cm = 25 léguas',
      active: false,
      isCustom: true
    };
  }, [targetMapDoc, selectedMapId, allWorldPresets, customWorldMaps, targetMapLoading, isGM]);

  // Sincroniza selectedMapId caso nenhum mapa esteja selecionado ou se o jogador estiver apontando para um modelo base inexistente na campanha dele
  React.useEffect(() => {
    if (!customMapsLoaded) return;
    if (targetMapLoading) return; // NUNCA sincronizar enquanto o mapa solicitado ainda está carregando!

    // Se o jogador estiver com 'aethelgard', 'archipelago' ou id vazio, mas a campanha dele possuir mapas vinculados:
    if (!isGM && (selectedMapId === 'aethelgard' || selectedMapId === 'archipelago' || !selectedMapId || selectedMapId === 'none')) {
      if (allWorldPresets.length > 0) {
        setSelectedMapId(allWorldPresets[0].id);
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('map', allWorldPresets[0].id);
          if (selectedSessionId) next.set('session', selectedSessionId);
          return next;
        });
      }
    }
  }, [customMapsLoaded, targetMapLoading, isGM, selectedMapId, allWorldPresets, selectedSessionId, setSearchParams]);

  // Verificação de acesso: o jogador só pode ver se tiver personagem vinculado à campanha
  const hasAccess = isGM || userCharactersWithSession.length > 0;

  // Real-time Firestore sync for Map Pins
  React.useEffect(() => {
    if (!user) return;

    const qPins = query(collection(db, 'mapPins'));
    const unsubscribe = onSnapshot(qPins, (snapshot) => {
      if (!snapshot.empty) {
        const firestorePins: MapPinData[] = [];
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          firestorePins.push({
            id: docSnap.id,
            title: d.title || 'Sem Nome',
            x: Number(d.x) || 50,
            y: Number(d.y) || 50,
            mapId: d.mapId || 'aethelgard',
            customMapUrl: d.customMapUrl || '',
            sessionId: d.sessionId || '',
            sessionName: d.sessionName || '',
            category: d.category || 'poi',
            customIcon: d.customIcon || '',
            dangerLevel: d.dangerLevel || 'moderate',
            status: d.status || 'explored',
            description: d.description || '',
            secrets: d.secrets || '',
            image: d.image || '',
            discoveredDate: d.discoveredDate || '',
            discoveredBy: d.discoveredBy || '',
            isSecret: d.isSecret || false,
            createdBy: d.createdBy || user.uid,
            createdAt: d.createdAt || '',
            updatedAt: d.updatedAt || ''
          });
        });

        // Merge with initial demo pins
        const combined = [...firestorePins];
        INITIAL_DEMO_PINS.forEach(dp => {
          if (!combined.some(p => p.id === dp.id || (p.title === dp.title && p.mapId === dp.mapId))) {
            combined.push(dp);
          }
        });
        setPins(combined);
        localStorage.setItem('world_map_pins_local', JSON.stringify(combined));
      }
    }, (err) => {
      console.warn('Firestore mapPins subscription error (using local storage):', err);
    });

    return () => unsubscribe();
  }, [user]);

  // Current active map image URL
  const activeMapImageUrl = currentPreset.imageUrl;

  // Filtered Pins for current view:
  // - O jogador SÓ vê pinos relacionados à campanha do seu personagem!
  const visiblePins = React.useMemo(() => {
    return pins.filter(pin => {
      // Must match active map
      if (pin.mapId !== currentPreset.id) return false;

      // Filter by session:
      // Jogador SÓ pode ver a campanha do seu personagem!
      if (!isGM) {
        if (pin.sessionId && selectedSessionId && pin.sessionId !== selectedSessionId) return false;
        // Pinos sem sessão só se não houver conflito, mas se houver sessão vinculada, foca na sessão
        if (!pin.sessionId && selectedSessionId) return false;
      } else {
        // Mestre foca na campanha selecionada
        if (selectedSessionId && pin.sessionId && pin.sessionId !== selectedSessionId) return false;
      }

      // Filter by category
      if (selectedCategoryFilter !== 'all') {
        const normPin = pin.category === 'city' ? 'town' : pin.category;
        const normFilter = selectedCategoryFilter === 'city' ? 'town' : selectedCategoryFilter;
        if (normPin !== normFilter) return false;
      }

      // Filter by search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = pin.title.toLowerCase().includes(q);
        const matchesDesc = pin.description.toLowerCase().includes(q);
        const matchesSession = pin.sessionName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesSession) return false;
      }

      return true;
    });
  }, [pins, currentPreset.id, isGM, selectedSessionId, selectedCategoryFilter, searchQuery]);

  // Real-time Multiplayer Pings Listener
  React.useEffect(() => {
    if (!currentPreset.id) return;

    const qPings = query(
      collection(db, 'worldMapPings'),
      where('mapId', '==', currentPreset.id)
    );

    const unsub = onSnapshot(qPings, (snapshot) => {
      const now = Date.now();
      const list: WorldMapPingData[] = [];
      snapshot.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() } as WorldMapPingData;
        if (now - (d.timestamp || 0) < 6000) {
          list.push(d);
        }
      });
      setPings(list);
    }, (err) => {
      console.warn('World map pings listener error:', err);
    });

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPings(prev => prev.filter(p => now - (p.timestamp || 0) < 6000));
    }, 1500);

    return () => {
      unsub();
      clearInterval(cleanupInterval);
    };
  }, [currentPreset.id]);

  // Drop a real-time multiplayer ping on World Map
  const handleDropPing = async (pctX: number, pctY: number) => {
    if (!user) return;
    const newPing: WorldMapPingData = {
      id: `ping_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      mapId: currentPreset.id,
      sessionId: selectedSessionId || '',
      x: pctX,
      y: pctY,
      userId: user.uid,
      userName: user.displayName || (isGM ? 'Mestre' : 'Jogador'),
      color: isGM ? '#f59e0b' : '#38bdf8',
      timestamp: Date.now()
    };

    setPings(prev => [...prev, newPing]);
    playPingAudioAlert();

    try {
      const docRef = await addDoc(collection(db, 'worldMapPings'), newPing);
      setPings(prev => [
        ...prev.filter(p => p.id !== docRef.id && p.id !== newPing.id),
        { ...newPing, id: docRef.id }
      ]);
    } catch (err) {
      console.warn('World map ping sync error:', err);
    }
  };

  // Delete individual ping from World Map
  const handleDeletePing = async (pingId: string) => {
    setPings(prev => prev.filter(p => p.id !== pingId));
    try {
      await deleteDoc(doc(db, 'worldMapPings', pingId));
    } catch (err) {
      console.warn('Error deleting world map ping:', err);
    }
  };

  // Clear all pings from World Map
  const handleClearAllPings = async (onlyMine: boolean = false) => {
    const toDelete = pings.filter(p => !onlyMine || isGM || p.userId === user?.uid);
    setPings(prev => prev.filter(p => !toDelete.some(td => td.id === p.id)));
    try {
      const deletePromises = toDelete.map(p => deleteDoc(doc(db, 'worldMapPings', p.id)));
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn('Error clearing world map pings:', err);
    }
  };

  // Handle map click to place pin or drop ping
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    if (isDrawingMode) return;
    if (!mapImageRef.current) return;

    const rect = mapImageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check bounds
    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      return;
    }

    const pctX = Number(((clickX / rect.width) * 100).toFixed(2));
    const pctY = Number(((clickY / rect.height) * 100).toFixed(2));

    if (e.shiftKey || isPingMode) {
      handleDropPing(pctX, pctY);
      return;
    }

    const initialCat = (selectedCategoryFilter !== 'all' && CATEGORIES[selectedCategoryFilter]) ? selectedCategoryFilter : 'dungeon';
    const initialConfig = getCategoryConfig(initialCat);

    setNewPinCoord({ x: pctX, y: pctY });
    setPinDraft({
      title: '',
      category: initialCat as any,
      customIcon: initialConfig.defaultIconName,
      dangerLevel: 'moderate',
      status: 'explored',
      sessionId: selectedSessionId || '',
      description: '',
      secrets: '',
      isSecret: false,
      discoveredDate: new Date().toISOString().split('T')[0]
    });
    setIsCustomIconPickerOpen(false);
    setIsCreatingModalOpen(true);
    setIsPlacingPin(false);
  };

  // Cursor coordinates tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    if (!mapImageRef.current) return;
    const rect = mapImageRef.current.getBoundingClientRect();
    const currX = e.clientX - rect.left;
    const currY = e.clientY - rect.top;

    if (currX >= 0 && currX <= rect.width && currY >= 0 && currY <= rect.height) {
      const pctX = Number(((currX / rect.width) * 100).toFixed(1));
      const pctY = Number(((currY / rect.height) * 100).toFixed(1));
      setCursorCoords({ x: pctX, y: pctY });
    } else {
      setCursorCoords(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag with left mouse when not placing pin
    if (isPlacingPin) return;
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      // Zoom in
      setScale(prev => Math.min(3.5, prev + zoomFactor));
    } else {
      // Zoom out
      setScale(prev => Math.max(0.6, prev - zoomFactor));
    }
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleFocusPin = (pin: MapPinData) => {
    setSelectedPin(pin);
    // Center view on pin
    if (mapContainerRef.current) {
      setScale(1.6);
      // Rough center approximation based on container
      const containerW = mapContainerRef.current.clientWidth;
      const containerH = mapContainerRef.current.clientHeight;
      const targetX = (containerW / 2) - ((pin.x / 100) * containerW * 1.6);
      const targetY = (containerH / 2) - ((pin.y / 100) * containerH * 1.6);
      setPosition({
        x: Math.max(-containerW, Math.min(containerW, targetX * 0.4)),
        y: Math.max(-containerH, Math.min(containerH, targetY * 0.4))
      });
    }
  };

  // Save new pin
  const handleSaveNewPin = async () => {
    if (!pinDraft.title?.trim()) return;

    const sessionToBind = selectedSessionId || pinDraft.sessionId || '';
    const matchedSession = sessions.find(s => s.id === sessionToBind);

    const newPin: MapPinData = {
      id: `pin-${Date.now()}`,
      title: pinDraft.title.trim(),
      x: newPinCoord.x,
      y: newPinCoord.y,
      mapId: currentPreset.id,
      customMapUrl: currentPreset.isCustom ? currentPreset.imageUrl : '',
      sessionId: sessionToBind,
      sessionName: activeSessionData?.name || matchedSession?.name || '',
      category: (pinDraft.category as any) || 'dungeon',
      customIcon: pinDraft.customIcon || '',
      dangerLevel: (pinDraft.dangerLevel as any) || 'moderate',
      status: (pinDraft.status as any) || 'explored',
      description: pinDraft.description || '',
      secrets: pinDraft.secrets || '',
      image: pinDraft.image || '',
      discoveredDate: pinDraft.discoveredDate || new Date().toISOString().split('T')[0],
      discoveredBy: user?.displayName || 'Aventureiro',
      isSecret: !!pinDraft.isSecret,
      createdBy: user?.uid || 'guest',
      createdAt: new Date().toISOString()
    };

    // Save to Firestore
    try {
      if (user) {
        const docRef = await addDoc(collection(db, 'mapPins'), {
          ...newPin,
          createdBy: user.uid,
          createdAt: new Date().toISOString()
        });
        newPin.id = docRef.id;
      }
    } catch (err) {
      console.warn('Saved pin locally (Firestore failed):', err);
    }

    const updated = [newPin, ...pins];
    setPins(updated);
    localStorage.setItem('world_map_pins_local', JSON.stringify(updated));

    setIsCreatingModalOpen(false);
    setSelectedPin(newPin);
  };

  // Update pin
  const handleUpdatePin = async () => {
    if (!selectedPin || !pinDraft.title?.trim()) return;

    const matchedSession = sessions.find(s => s.id === pinDraft.sessionId);
    const updatedPin: MapPinData = {
      ...selectedPin,
      title: pinDraft.title.trim(),
      category: (pinDraft.category as any) || selectedPin.category,
      customIcon: pinDraft.customIcon !== undefined ? pinDraft.customIcon : (selectedPin.customIcon || ''),
      dangerLevel: (pinDraft.dangerLevel as any) || selectedPin.dangerLevel,
      status: (pinDraft.status as any) || selectedPin.status,
      sessionId: pinDraft.sessionId || '',
      sessionName: matchedSession?.name || '',
      description: pinDraft.description || '',
      secrets: pinDraft.secrets || '',
      isSecret: !!pinDraft.isSecret,
      updatedAt: new Date().toISOString()
    };

    try {
      if (user && !selectedPin.id.startsWith('demo-')) {
        await updateDoc(doc(db, 'mapPins', selectedPin.id), {
          ...updatedPin,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('Update failed in firestore:', err);
    }

    const updatedList = pins.map(p => p.id === selectedPin.id ? updatedPin : p);
    setPins(updatedList);
    localStorage.setItem('world_map_pins_local', JSON.stringify(updatedList));
    setSelectedPin(updatedPin);
    setIsEditingModalOpen(false);
  };

  // Delete pin
  const handleDeletePin = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este marcador do mapa?')) return;

    try {
      if (user && !id.startsWith('demo-')) {
        await deleteDoc(doc(db, 'mapPins', id));
      }
    } catch (err) {
      console.warn('Delete failed in firestore:', err);
    }

    const filtered = pins.filter(p => p.id !== id);
    setPins(filtered);
    localStorage.setItem('world_map_pins_local', JSON.stringify(filtered));
    if (selectedPin?.id === id) {
      setSelectedPin(null);
    }
  };

  // Copy coordinates
  const handleCopyCoordinates = (x: number, y: number, title?: string) => {
    const text = `${title ? title + ' - ' : ''}Coordenadas: X: ${x}%, Y: ${y}% [Setor ${getGridSector(x, y)}]`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Verificação estrita de acesso: Jogador só pode ver a campanha do seu personagem
  if (!hasAccess) {
    return (
      <MapRestrictedAccess 
        mapType="world" 
        userRole={userRole} 
        userCharactersCount={userCharacters.length} 
      />
    );
  }

  // Se o mestre desativou todos os mapas do mundo para esta campanha
  if (allWorldPresets.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-obsidian text-parchment text-center relative overflow-hidden select-none">
        <div className="max-w-md w-full glass-popup bg-stone-950/80 border border-white/15 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-arcane/20 border border-arcane/40 text-arcane flex items-center justify-center mx-auto mb-4">
            <EyeOff size={32} />
          </div>
          <h2 className="font-serif text-xl font-bold mb-2">Nenhum Mapa do Mundo Ativo</h2>
          <p className="text-xs text-parchment/60 leading-relaxed mb-6">
            O Mestre da campanha não ativou nenhum mapa do mundo para exploração nesta sessão. Aguarde as instruções do Mestre!
          </p>
          <div className="flex gap-2 justify-center">
            {isGM ? (
              <button
                onClick={() => setIsMapManagerOpen(true)}
                className="px-4 py-2 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-105 transition-transform flex items-center gap-1.5"
              >
                <Shield size={14} />
                <span>Gerenciar Mapas da Campanha</span>
              </button>
            ) : (
              <Link
                to="/dungeon"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs font-medium"
              >
                Ver Battlemaps de Dungeons
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-obsidian text-parchment overflow-hidden select-none">
      {/* Top Map Control Bar */}
      <header className="h-14 border-b border-white/10 bg-black/60 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 gap-2">
        {/* Left: Map Identity & Map Selector Popover */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={mapSelectorRef}>
            <button
              type="button"
              onClick={() => setIsMapSelectorOpen(!isMapSelectorOpen)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm group"
              title="Trocar Mapa do Mundo ou Gerenciar Mapas"
            >
              <div className="w-6 h-6 rounded-lg bg-arcane/20 border border-arcane/40 flex items-center justify-center text-arcane text-xs">
                <Compass size={14} className="group-hover:rotate-45 transition-transform" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-parchment max-w-[110px] sm:max-w-[160px] truncate leading-tight block">
                    {currentPreset.name}
                  </span>
                  <ChevronDown size={13} className={cn("text-parchment/40 transition-transform", isMapSelectorOpen && "rotate-180 text-arcane")} />
                </div>
                <span className="text-[9px] font-mono text-parchment/40 hidden sm:block leading-none">
                  {allWorldPresets.length} {allWorldPresets.length === 1 ? 'mapa disponível' : 'mapas disponíveis'}
                </span>
              </div>
            </button>

            {/* Map Selector Popover */}
            <AnimatePresence>
              {isMapSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-obsidian/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-2 z-[80] overflow-hidden"
                >
                  <div className="px-3 py-1.5 border-b border-white/10 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-parchment/50">Mapas do Mundo</span>
                    <span className="text-[10px] font-mono text-arcane font-bold">{allWorldPresets.length} Mapas</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 p-0.5">
                    {allWorldPresets.map((preset) => {
                      const isSelected = selectedMapId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group border",
                            isSelected
                              ? "bg-arcane/15 border-arcane/40 text-parchment shadow-sm"
                              : "hover:bg-white/5 border-transparent text-parchment/70 hover:text-parchment"
                          )}
                          onClick={() => {
                            setSelectedMapId(preset.id);
                            setIsMapSelectorOpen(false);
                            setSearchParams(prev => {
                              const next = new URLSearchParams(prev);
                              next.set('map', preset.id);
                              if (selectedSessionId) next.set('session', selectedSessionId);
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                              {preset.imageUrl ? (
                                <img src={preset.imageUrl} alt={preset.name} className="w-full h-full object-cover" />
                              ) : (
                                <Compass size={14} className="text-arcane" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-serif text-xs font-bold truncate leading-tight group-hover:text-arcane transition-colors">
                                {preset.name}
                              </p>
                              <p className="text-[10px] text-parchment/40 truncate leading-tight mt-0.5">
                                {preset.subtitle || preset.defaultScale}
                              </p>
                            </div>
                          </div>

                          {/* GM Quick Activation Toggle */}
                          {isGM && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCampaignMapActive(selectedSessionId, preset.id, preset.active, preset.isCustom, 'world');
                              }}
                              className="p-1 hover:bg-white/10 rounded-lg transition-colors ml-1.5 shrink-0"
                              title={preset.active ? "Ativo para jogadores. Clique para ocultar." : "Desativado para jogadores. Clique para ativar."}
                            >
                              {preset.active ? (
                                <Eye size={13} className="text-emerald-400" />
                              ) : (
                                <EyeOff size={13} className="text-amber-400" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* GM Map Management Link */}
                  {isGM && (
                    <div className="pt-2 mt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMapSelectorOpen(false);
                          setIsMapManagerOpen(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-arcane text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Shield size={13} />
                        <span>Gerenciador de Mapas da Campanha</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right / Center Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Session Selector (GM) OR Character Badge (Player) */}
          {isGM ? (
            <select
              value={selectedSessionId}
              onChange={(e) => {
                setSelectedSessionId(e.target.value);
                setSearchParams(prev => {
                  const next = new URLSearchParams(prev);
                  if (e.target.value) next.set('session', e.target.value);
                  else next.delete('session');
                  return next;
                });
              }}
              className="bg-white/5 border border-white/10 text-parchment rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-arcane hidden xl:block max-w-[150px] truncate"
            >
              {gmSessions.map(s => (
                <option key={s.id} value={s.id} className="bg-obsidian">
                  {s.name}
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
              <div className="items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs hidden lg:flex">
                <User size={12} className="text-arcane" />
                <span className="font-semibold text-arcane">{userCharactersWithSession[0]?.name || 'Herói'}</span>
              </div>
            )
          )}

          {/* Character Sheet Modal Trigger Button */}
          {(selectedCharacterId || userCharactersWithSession.length > 0) && (
            <button
              type="button"
              onClick={() => {
                const charId = selectedCharacterId || userCharactersWithSession[0]?.id;
                if (charId) setSheetModalCharacterId(charId);
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-arcane/20 hover:bg-arcane/30 text-arcane border border-arcane/40 shadow-sm text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Abrir Ficha do Personagem em Modal (sem sair do mapa)"
            >
              <Scroll size={14} />
              <span className="font-semibold text-[11px] sm:text-xs">Ficha</span>
            </button>
          )}

          {/* Drawing and Ping Tools for GM and Players */}
          <MapDrawingToolbar
            isDrawingMode={isDrawingMode}
            onToggleDrawingMode={(val) => {
              setIsDrawingMode(val);
              if (val) {
                setIsPingMode(false);
                setIsPlacingPin(false);
              }
            }}
            drawingTool={drawingTool}
            onChangeTool={setDrawingTool}
            activeColor={drawingColor}
            onChangeColor={setDrawingColor}
            strokeSize={drawingStrokeSize}
            onChangeStrokeSize={setDrawingStrokeSize}
            mapId={currentPreset.id}
            sessionId={selectedSessionId}
            collectionName="mapDrawings"
            isGM={isGM}
            currentUserId={user?.uid}
            currentUserName={user?.displayName || (isGM ? 'Mestre' : 'Jogador')}
            isPingMode={isPingMode}
            onTogglePingMode={(active) => {
              setIsPingMode(active);
              if (active) {
                setIsDrawingMode(false);
                setIsPlacingPin(false);
              }
            }}
          />

          {/* Clear Pings Quick Button */}
          {pings.length > 0 && (
            <button
              type="button"
              onClick={() => handleClearAllPings(false)}
              className="px-2 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer shadow-sm animate-pulse"
              title="Remover todos os sinais de ping ativos no mapa"
            >
              <Trash2 size={12} className="text-rose-400" />
              <span className="hidden sm:inline">Limpar Pings</span>
              <span className="px-1 py-0.2 rounded-full bg-rose-500/30 text-[9px] font-bold">{pings.length}</span>
            </button>
          )}

          {/* Place Pin Toggle */}
          <button
            onClick={() => {
              setIsPlacingPin(!isPlacingPin);
              if (!isPlacingPin) {
                setIsDrawingMode(false);
                setIsPingMode(false);
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all shadow-md",
              isPlacingPin
                ? "bg-ember text-white animate-pulse ring-2 ring-ember/40"
                : "bg-arcane hover:bg-arcane/90 text-obsidian"
            )}
            title="Adicionar Marcador no Mapa do Mundo"
          >
            <MapPin size={14} className={isPlacingPin ? "animate-bounce" : ""} />
            <span className="hidden sm:inline">
              {isPlacingPin ? 'Clique no Mapa...' : 'Marcar Local'}
            </span>
          </button>

          {/* Dungeons Battlemap Link */}
          <Link
            to="/dungeon"
            className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm"
            title="Ir para os Battlemaps de Dungeons com Navegação de Tokens"
          >
            <Skull size={14} />
            <span className="hidden md:inline">Dungeons & Tokens</span>
          </Link>

          {/* Toggle Sidebar */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn(
              "p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5",
              isSidebarOpen
                ? "bg-white/10 border-white/20 text-parchment"
                : "border-white/10 hover:bg-white/5 text-parchment/60"
            )}
            title="Lista de Locais e Filtros"
          >
            <Layers size={16} />
            <span className="hidden lg:inline text-xs font-mono">
              {visiblePins.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Map Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Interactive Canvas Area */}
        <div 
          ref={mapContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={isPlacingPin ? handleMapClick : undefined}
          className={cn(
            "flex-1 relative overflow-hidden bg-stone-950 cursor-grab active:cursor-grabbing",
            isPlacingPin && "cursor-crosshair active:cursor-crosshair"
          )}
          style={{ touchAction: 'none' }}
        >
          {/* Placing Pin Instruction Banner */}
          <AnimatePresence>
            {isPlacingPin && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              >
                <div className="px-4 py-2 rounded-full bg-ember text-white font-medium text-xs shadow-xl flex items-center gap-2 border border-ember/50">
                  <Crosshair size={14} className="animate-spin" />
                  <span>Clique em qualquer coordenada do mapa para registrar o local descoberto</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsPlacingPin(false); }}
                    className="ml-2 p-0.5 hover:bg-black/20 rounded pointer-events-auto"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Floating Category Filter Bar on Canvas */}
          <div className="absolute top-3 left-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl max-w-[calc(100%-8rem)] overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-1.5 font-medium",
                selectedCategoryFilter === 'all'
                  ? "bg-arcane/20 text-arcane border border-arcane/40 shadow-sm"
                  : "text-parchment/70 hover:text-parchment hover:bg-white/10"
              )}
            >
              <MapIcon size={12} />
              <span>Todos</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-parchment/60">
                {pins.filter(p => p.mapId === selectedMapId).length}
              </span>
            </button>

            {Object.values(CATEGORIES).map((cat) => {
              const CatIcon = cat.icon;
              const count = pins.filter(p => p.mapId === selectedMapId && (p.category === cat.id || (cat.id === 'town' && p.category === 'city'))).length;
              if (count === 0 && selectedCategoryFilter !== cat.id) return null;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat.id ? 'all' : cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-1.5 font-medium",
                    selectedCategoryFilter === cat.id
                      ? `${cat.bg} ${cat.color} border ${cat.border} ring-1 ${cat.ring}`
                      : "text-parchment/70 hover:text-parchment hover:bg-white/10"
                  )}
                >
                  <CatIcon size={12} className={cat.color} />
                  <span>{cat.shortLabel}</span>
                  <span className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                    selectedCategoryFilter === cat.id ? "bg-black/30" : "bg-white/10 text-parchment/60"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="h-4 w-px bg-white/10 mx-1 shrink-0" />
            <button
              onClick={() => setIsLegendOpen(true)}
              className="px-2.5 py-1 rounded-xl text-xs whitespace-nowrap text-parchment/70 hover:text-parchment hover:bg-white/10 transition-all flex items-center gap-1 font-medium"
              title="Abrir Legenda de Categorias e Ícones"
            >
              <Info size={12} className="text-arcane" />
              <span>Legenda</span>
            </button>
          </div>

          {/* Map Image Transform Wrapper */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center'
            }}
          >
            <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden border border-amber-900/40 min-w-[320px] min-h-[240px] bg-stone-950">
              {/* Actual Map Image */}
              {activeMapImageUrl ? (
                <img
                  ref={mapImageRef}
                  src={activeMapImageUrl}
                  alt={currentPreset.name || "Mapa Mundi Fantástico"}
                  draggable={false}
                  className="max-h-[82vh] max-w-[85vw] object-contain block pointer-events-auto select-none"
                />
              ) : (
                <div className="w-[80vw] max-w-3xl h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-obsidian/95 border border-white/10">
                  {targetMapLoading ? (
                    <>
                      <Compass size={40} className="text-arcane animate-spin mb-4" />
                      <h3 className="font-serif text-xl font-bold text-parchment">Carregando Mapa Cadastrado...</h3>
                      <p className="text-xs text-parchment/60 mt-1 font-mono">Buscando detalhes do mapa da campanha no Arquivo Heroico</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 shadow-xl">
                        <Compass size={32} />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3">
                        Campanha Ativa
                      </span>
                      <h3 className="font-serif text-2xl font-bold text-glow-arcane">Nenhum Mapa de Mundo Vinculado</h3>
                      <p className="text-sm text-parchment/70 max-w-md mx-auto mt-2 leading-relaxed">
                        De acordo com as regras do Arquivo Heroico, jogadores só visualizam os mapas vinculados e ativados pelo Mestre para esta campanha.
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

              {/* Tactical Cartography Grid Overlay (A-J / 1-10) */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none border border-amber-700/30">
                  {/* Grid Lines */}
                  <div className="w-full h-full grid grid-cols-10 grid-rows-10 divide-x divide-y divide-amber-700/15">
                    {Array.from({ length: 100 }).map((_, idx) => (
                      <div key={idx} className="relative">
                        {/* Plus mark on top-left of each cell */}
                        <span className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-amber-500/30 text-[8px] font-mono leading-none">
                          +
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Column Letters (A-J) */}
                  <div className="absolute top-1 left-0 right-0 flex justify-around text-[9px] font-mono text-amber-500/50 uppercase tracking-widest px-2">
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(l => (
                      <span key={l}>{l}</span>
                    ))}
                  </div>

                  {/* Row Numbers (1-10) */}
                  <div className="absolute top-0 bottom-0 left-1 flex flex-col justify-around text-[9px] font-mono text-amber-500/50 py-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Freehand Drawing Overlay for Players & GM */}
              <MapDrawingOverlay
                mapId={currentPreset.id}
                sessionId={selectedSessionId}
                collectionName="mapDrawings"
                isDrawingMode={isDrawingMode}
                drawingTool={drawingTool}
                activeColor={drawingColor}
                strokeSize={drawingStrokeSize}
                isGM={isGM}
                containerRef={mapImageRef}
              />

              {/* Real-time Multiplayer Pings (Sinais de Ping) */}
              {pings.map((ping) => {
                const canRemove = isGM || !ping.userId || ping.userId === user?.uid;

                return (
                  <div
                    key={ping.id}
                    style={{ left: `${ping.x}%`, top: `${ping.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-35 group select-none"
                  >
                    <div className="relative flex items-center justify-center pointer-events-none">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePing(ping.id);
                        }}
                        style={{ backgroundColor: ping.color, borderColor: '#ffffff' }}
                        className="w-5 h-5 rounded-full border-2 shadow-2xl flex items-center justify-center text-[10px] font-black text-black z-10 pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
                        title={canRemove ? "Clique para remover este ping" : `Sinal de ${ping.userName}`}
                      >
                        !
                      </button>

                      {/* Ping User Pill Label with Close button */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded-md bg-black/95 text-[10px] font-mono font-semibold text-white whitespace-nowrap border border-white/20 shadow-2xl z-20 flex items-center gap-1.5 pointer-events-auto">
                        <Radio size={10} className="animate-spin text-amber-400" />
                        <span>{ping.userName}</span>
                        {canRemove && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePing(ping.id);
                            }}
                            className="p-0.5 rounded hover:bg-rose-500/30 text-parchment/60 hover:text-rose-400 transition-colors cursor-pointer ml-0.5"
                            title="Remover este sinal de ping"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pins Placed on Map */}
              {visiblePins.map((pin) => {
                const categoryConfig = getCategoryConfig(pin.category);
                const IconComponent = getPinIconComponent(pin);
                const dangerConfig = DANGER_LEVELS[pin.dangerLevel] || DANGER_LEVELS.moderate;
                const isSelected = selectedPin?.id === pin.id;

                return (
                  <div
                    key={pin.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPin(pin);
                    }}
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`
                    }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 transition-transform duration-200",
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    )}
                  >
                    {/* Pulsing ring for selected or high-danger locations */}
                    {(isSelected || pin.dangerLevel === 'deadly') && (
                      <span className={cn(
                        "absolute -inset-2 rounded-full animate-ping opacity-60",
                        pin.dangerLevel === 'deadly' ? "bg-rose-500" : "bg-arcane"
                      )} />
                    )}

                    {/* Pin Marker Badge with Category Theming and Glow */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shadow-xl border-2 transition-all relative backdrop-blur-sm",
                      categoryConfig.bg,
                      categoryConfig.border,
                      categoryConfig.glow,
                      isSelected ? "ring-4 ring-arcane/60 shadow-arcane/50" : "hover:ring-2 hover:ring-white/40"
                    )}>
                      <IconComponent size={16} className={categoryConfig.color} />

                      {/* Small danger indicator dot */}
                      <span className={cn(
                        "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-black",
                        pin.dangerLevel === 'safe' && "bg-emerald-500",
                        pin.dangerLevel === 'moderate' && "bg-yellow-500",
                        pin.dangerLevel === 'dangerous' && "bg-orange-500",
                        pin.dangerLevel === 'deadly' && "bg-rose-500"
                      )} />
                    </div>

                    {/* Pin Title Label Pill beneath pin */}
                    <div className={cn(
                      "absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap pointer-events-none transition-all shadow-md border",
                      isSelected 
                        ? "bg-black/90 text-arcane border-arcane/50 opacity-100 ring-1 ring-arcane/30" 
                        : "bg-black/75 text-parchment/90 border-white/10 opacity-80 group-hover:opacity-100"
                    )}>
                      {pin.title}
                    </div>

                    {/* Hover tooltip with quick preview */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-40 pointer-events-none">
                      <div className="bg-obsidian/95 border border-white/20 rounded-xl p-2.5 shadow-2xl text-left w-56 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold", categoryConfig.badge)}>
                            <IconComponent size={10} />
                            <span>{categoryConfig.shortLabel}</span>
                          </span>
                          <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded", dangerConfig.bg, dangerConfig.color)}>
                            {dangerConfig.label}
                          </span>
                        </div>
                        <h4 className="font-serif text-xs font-semibold text-parchment line-clamp-1">
                          {pin.title}
                        </h4>
                        {pin.sessionName && (
                          <p className="text-[10px] text-arcane font-mono mt-0.5 flex items-center gap-1">
                            <BookOpen size={10} />
                            <span>{pin.sessionName}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-parchment/70 mt-1 line-clamp-2">
                          {pin.description || 'Nenhuma anotação registrada.'}
                        </p>
                        <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-parchment/40">
                          <span>Setor {getGridSector(pin.x, pin.y)}</span>
                          <span>X: {pin.x}% Y: {pin.y}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Canvas Controls (Bottom-Right) */}
          <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-2xl">
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
              onClick={() => setScale(prev => Math.max(0.6, prev - 0.25))}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Afastar (-)"
            >
              <ZoomOut size={18} />
            </button>
            <div className="h-px bg-white/10 my-0.5" />
            <button
              onClick={handleResetView}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Centralizar / Resetar Visualização"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                "p-2 rounded-xl transition-all",
                showGrid ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-parchment/60 hover:bg-white/10"
              )}
              title="Alternar Grade Cartográfica (A-J / 1-10)"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setIsLegendOpen(true)}
              className="p-2 hover:bg-white/10 text-parchment rounded-xl transition-all"
              title="Legenda de Categorias & Ícones"
            >
              <Info size={16} />
            </button>
          </div>

          {/* Floating Coordinate Inspector (Bottom-Left) */}
          {showCoordinatesOverlay && (
            <div className="absolute bottom-4 left-4 z-20 bg-black/70 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 text-xs font-mono shadow-2xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {cursorCoords ? (
                <div className="flex items-center gap-3 text-parchment/80">
                  <span>
                    Coordenadas: <strong className="text-arcane">X: {cursorCoords.x}%</strong> | <strong className="text-arcane">Y: {cursorCoords.y}%</strong>
                  </span>
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] border border-amber-500/30">
                    Setor {getGridSector(cursorCoords.x, cursorCoords.y)}
                  </span>
                  <span className="text-[10px] text-parchment/40 hidden sm:inline">
                    Tático [{Math.round(cursorCoords.x * 10)}, {Math.round(cursorCoords.y * 10)}]
                  </span>
                </div>
              ) : (
                <span className="text-parchment/40">
                  Mova o cursor sobre o mapa para ver as coordenadas
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Collapsible Sidebar: Pin Directory & Filters */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-white/10 bg-obsidian/95 backdrop-blur-xl flex flex-col z-20 shrink-0 overflow-hidden"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-arcane" />
                  <h3 className="font-serif text-base font-semibold">
                    Locais Descobertos
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-parchment/60">
                    {visiblePins.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Filters & Search */}
              <div className="p-3 border-b border-white/10 space-y-2 bg-black/20">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar locais, notas, ruínas..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:border-arcane/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-parchment/40 hover:text-parchment"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Campaign Link Indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-parchment/50 shrink-0 uppercase">
                    Campanha:
                  </span>
                  {isGM ? (
                    <select
                      value={selectedSessionId}
                      onChange={(e) => {
                        setSelectedSessionId(e.target.value);
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          if (e.target.value) next.set('session', e.target.value);
                          else next.delete('session');
                          return next;
                        });
                      }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-arcane/50 text-parchment/90"
                    >
                      {gmSessions.map(s => (
                        <option key={s.id} value={s.id} className="bg-obsidian">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex-1 text-xs text-arcane font-medium truncate px-1 py-0.5 bg-arcane/10 rounded border border-arcane/20">
                      {activeSessionData?.name || 'Campanha do Personagem'}
                    </div>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex gap-1 overflow-x-auto pb-1 pt-1 no-scrollbar text-[10px]">
                  <button
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={cn(
                      "px-2 py-0.5 rounded-md whitespace-nowrap transition-all",
                      selectedCategoryFilter === 'all'
                        ? "bg-arcane/20 text-arcane border border-arcane/30"
                        : "bg-white/5 text-parchment/60 hover:text-parchment"
                    )}
                  >
                    Todos ({pins.filter(p => p.mapId === selectedMapId).length})
                  </button>
                  {Object.values(CATEGORIES).map((catVal) => {
                    const count = pins.filter(p => p.mapId === selectedMapId && (p.category === catVal.id || (catVal.id === 'town' && p.category === 'city'))).length;
                    return (
                      <button
                        key={catVal.id}
                        onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === catVal.id ? 'all' : catVal.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-md whitespace-nowrap transition-all flex items-center gap-1",
                          selectedCategoryFilter === catVal.id
                            ? `${catVal.bg} ${catVal.color} border ${catVal.border}`
                            : "bg-white/5 text-parchment/60 hover:text-parchment"
                        )}
                      >
                        <catVal.icon size={10} />
                        <span>{catVal.shortLabel}</span>
                        {count > 0 && <span className="opacity-60 text-[9px]">({count})</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pins List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {visiblePins.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MapIcon size={32} className="mx-auto text-parchment/20 mb-2" />
                    <p className="text-xs text-parchment/60 font-medium">Nenhum local encontrado</p>
                    <p className="text-[11px] text-parchment/40 mt-1">
                      Clique no botão "Marcar Local" e selecione um ponto no mapa para registrar.
                    </p>
                    <button
                      onClick={() => setIsPlacingPin(true)}
                      className="mt-3 px-3 py-1.5 bg-arcane/20 border border-arcane/30 text-arcane rounded-xl text-xs hover:bg-arcane/30"
                    >
                      + Marcar Primeiro Ponto
                    </button>
                  </div>
                ) : (
                  visiblePins.map((pin) => {
                    const cat = getCategoryConfig(pin.category);
                    const danger = DANGER_LEVELS[pin.dangerLevel] || DANGER_LEVELS.moderate;
                    const isSelected = selectedPin?.id === pin.id;
                    const IconComponent = getPinIconComponent(pin);

                    return (
                      <div
                        key={pin.id}
                        onClick={() => handleFocusPin(pin)}
                        className={cn(
                          "p-3 rounded-xl border transition-all cursor-pointer relative group",
                          isSelected
                            ? "bg-arcane/10 border-arcane/40 shadow-lg shadow-arcane/5"
                            : "bg-white/5 border-white/5 hover:border-white/15 hover:bg-white/[0.07]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1.5 rounded-lg border", cat.bg, cat.border, cat.glow)}>
                              <IconComponent size={14} className={cat.color} />
                            </div>
                            <div>
                              <h4 className="font-serif text-xs font-semibold text-parchment group-hover:text-arcane transition-colors">
                                {pin.title}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded flex items-center gap-1", cat.badge)}>
                                  <IconComponent size={9} />
                                  <span>{cat.shortLabel}</span>
                                </span>
                                <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded", danger.bg, danger.color)}>
                                  {danger.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {getGridSector(pin.x, pin.y)}
                            </span>
                          </div>
                        </div>

                        {pin.sessionName && (
                          <div className="mt-2 text-[10px] text-arcane/80 font-mono flex items-center gap-1">
                            <BookOpen size={10} />
                            <span className="truncate">{pin.sessionName}</span>
                          </div>
                        )}

                        {pin.description && (
                          <p className="mt-1.5 text-[11px] text-parchment/60 line-clamp-2 leading-relaxed">
                            {pin.description}
                          </p>
                        )}

                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-parchment/40">
                          <span>X: {pin.x}% | Y: {pin.y}%</span>
                          <span className="text-arcane opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver no mapa →
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sidebar Footer with Export / Share */}
              <div className="p-3 border-t border-white/10 bg-black/20 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    const text = visiblePins.map(p => 
                      `• ${p.title} (${getCategoryConfig(p.category).label}) - Setor ${getGridSector(p.x, p.y)} [X: ${p.x}%, Y: ${p.y}%]${p.sessionName ? ` [${p.sessionName}]` : ''}: ${p.description || 'Sem descrição'}`
                    ).join('\n');
                    navigator.clipboard.writeText(`=== CARTOGRAFIA DO MUNDO: LOCAIS DESCOBERTOS ===\n\n${text}`);
                    setCopiedCoords(true);
                    setTimeout(() => setCopiedCoords(false), 2000);
                  }}
                  className="flex items-center gap-1.5 text-parchment/60 hover:text-arcane transition-colors font-mono text-[11px]"
                >
                  <Copy size={12} />
                  <span>Copiar Relatório</span>
                </button>

                <button
                  onClick={() => setIsPlacingPin(true)}
                  className="px-2.5 py-1 bg-arcane/20 text-arcane hover:bg-arcane/30 rounded-lg font-medium text-xs flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>Novo Local</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Pin Detail Drawer Modal */}
      <AnimatePresence>
        {selectedPin && !isEditingModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-start justify-between bg-black/40">
                <div className="flex items-start gap-3">
                  {(() => {
                    const cat = getCategoryConfig(selectedPin.category);
                    const IconComp = getPinIconComponent(selectedPin);
                    return (
                      <div className={cn("p-2.5 rounded-xl border", cat.bg, cat.border, cat.glow)}>
                        <IconComp size={22} className={cat.color} />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="font-serif text-xl font-bold text-parchment">
                      {selectedPin.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={cn("text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center gap-1 font-semibold", getCategoryConfig(selectedPin.category).badge)}>
                        <span>{getCategoryConfig(selectedPin.category).label}</span>
                      </span>
                      <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded", (DANGER_LEVELS[selectedPin.dangerLevel] || DANGER_LEVELS.moderate).bg, (DANGER_LEVELS[selectedPin.dangerLevel] || DANGER_LEVELS.moderate).color)}>
                        Perigo: {(DANGER_LEVELS[selectedPin.dangerLevel] || DANGER_LEVELS.moderate).label}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-parchment/60 border border-white/10">
                        Status: {(STATUS_OPTIONS[selectedPin.status] || STATUS_OPTIONS.explored).label}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPin(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Coordinates & Tactical Location Card */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-parchment/50 uppercase block">
                      Posicionamento Cartográfico
                    </span>
                    <div className="flex items-center gap-3 mt-1 font-mono text-xs">
                      <span>X: <strong className="text-arcane">{selectedPin.x}%</strong></span>
                      <span>Y: <strong className="text-arcane">{selectedPin.y}%</strong></span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                        Setor {getGridSector(selectedPin.x, selectedPin.y)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyCoordinates(selectedPin.x, selectedPin.y, selectedPin.title)}
                    className="p-2 hover:bg-white/10 text-parchment/70 hover:text-arcane rounded-lg transition-colors flex items-center gap-1 text-xs"
                    title="Copiar Coordenadas"
                  >
                    {copiedCoords ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>

                {/* Session Link */}
                {selectedPin.sessionName && (
                  <div className="flex items-center gap-2 text-xs font-mono text-arcane bg-arcane/10 border border-arcane/20 rounded-xl p-3">
                    <BookOpen size={16} />
                    <span>Vinculado à Sessão: <strong>{selectedPin.sessionName}</strong></span>
                  </div>
                )}

                {/* Discovery Notes */}
                <div>
                  <h4 className="text-xs font-mono uppercase text-parchment/50 mb-1.5">
                    Anotações & Detalhes da Descoberta
                  </h4>
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm leading-relaxed text-parchment/90 whitespace-pre-line">
                    {selectedPin.description || 'Nenhuma descrição detalhada registrada para esta localização.'}
                  </div>
                </div>

                {/* Secrets / GM notes */}
                {selectedPin.secrets && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                    <div className="flex items-center gap-1.5 text-rose-300 font-semibold mb-1">
                      <Lock size={12} />
                      <span>Segredos do Mestre / Lore Oculta</span>
                    </div>
                    <p className="text-rose-200/80 leading-relaxed whitespace-pre-line">
                      {selectedPin.secrets}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-[11px] font-mono text-parchment/40 pt-2 border-t border-white/10">
                  <span>Descoberto por: {selectedPin.discoveredBy || 'Aventureiro'}</span>
                  {selectedPin.discoveredDate && <span>Data: {selectedPin.discoveredDate}</span>}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
                <button
                  onClick={() => handleDeletePin(selectedPin.id)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Excluir Marcador</span>
                </button>

                <div className="flex items-center gap-2">
                  {(selectedPin.category === 'dungeon' || selectedPin.category === 'ruins' || selectedPin.category === 'danger') && (
                    <Link
                      to={`/dungeon?map=catacombs${selectedPin.sessionId ? `&session=${selectedPin.sessionId}` : ''}`}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Skull size={14} />
                      <span>Entrar no Battlemap</span>
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setPinDraft({ ...selectedPin });
                      setIsEditingModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 size={14} />
                    <span>Editar Informações</span>
                  </button>
                  <button
                    onClick={() => setSelectedPin(null)}
                    className="px-4 py-1.5 rounded-xl bg-arcane text-obsidian font-medium text-xs hover:bg-arcane/90 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Edit Pin Modal */}
      <AnimatePresence>
        {(isCreatingModalOpen || isEditingModalOpen) && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-arcane" />
                  <h3 className="font-serif text-lg font-bold">
                    {isCreatingModalOpen ? 'Registrar Novo Local Descoberto' : 'Editar Local'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsCreatingModalOpen(false);
                    setIsEditingModalOpen(false);
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Coordinates Pill */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-parchment/50">Coordenadas no Mapa:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-arcane">X: {isCreatingModalOpen ? newPinCoord.x : selectedPin?.x}%</span>
                    <span className="text-arcane">Y: {isCreatingModalOpen ? newPinCoord.y : selectedPin?.y}%</span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                      Setor {getGridSector(isCreatingModalOpen ? newPinCoord.x : (selectedPin?.x || 50), isCreatingModalOpen ? newPinCoord.y : (selectedPin?.y || 50))}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-mono text-parchment/60 uppercase mb-1">
                    Nome da Localização *
                  </label>
                  <input
                    type="text"
                    value={pinDraft.title || ''}
                    onChange={(e) => setPinDraft({ ...pinDraft, title: e.target.value })}
                    placeholder="Ex: Cidadela de Prata, Ruínas de Eldoria, Taverna do Pônei..."
                    className="w-full bg-white/5 border border-white/15 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-arcane focus:ring-1 focus:ring-arcane"
                    autoFocus
                  />
                </div>

                {/* Category Selection Cards */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono text-parchment/60 uppercase">
                      Categoria do Marcador *
                    </label>
                    {(() => {
                      const activeConfig = getCategoryConfig(pinDraft.category);
                      const ActiveIcon = activeConfig.icon;
                      return (
                        <span className={cn(
                          "text-[10px] font-mono uppercase px-2 py-0.5 rounded flex items-center gap-1 font-semibold",
                          activeConfig.badge
                        )}>
                          <ActiveIcon size={11} />
                          <span>{activeConfig.label}</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-black/25 rounded-xl border border-white/10">
                    {Object.values(CATEGORIES).map((cat) => {
                      const CatIcon = cat.icon;
                      const isSelected = (pinDraft.category === cat.id) || (cat.id === 'town' && pinDraft.category === 'city');

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setPinDraft({ 
                              ...pinDraft, 
                              category: cat.id as any,
                              customIcon: pinDraft.customIcon || cat.defaultIconName
                            });
                          }}
                          className={cn(
                            "p-2 rounded-xl border text-left transition-all flex items-center gap-2 group",
                            isSelected
                              ? `${cat.bg} ${cat.border} ring-2 ring-arcane/50 shadow-md`
                              : "bg-white/5 border-white/5 hover:border-white/15 hover:bg-white/[0.08]"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-lg border shrink-0", cat.bg, cat.border, cat.glow)}>
                            <CatIcon size={14} className={cat.color} />
                          </div>
                          <div className="min-w-0">
                            <div className={cn("text-xs font-medium truncate", isSelected ? "text-parchment font-semibold" : "text-parchment/80 group-hover:text-parchment")}>
                              {cat.shortLabel}
                            </div>
                            <div className="text-[9px] text-parchment/40 truncate">
                              {cat.label.split('/')[0]}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Marker Icon Customizer & Palette */}
                {(() => {
                  const currentCatConfig = getCategoryConfig(pinDraft.category);
                  const selectedIconKey = (pinDraft.customIcon && AVAILABLE_ICONS[pinDraft.customIcon])
                    ? pinDraft.customIcon
                    : currentCatConfig.defaultIconName;
                  const SelectedMarkerIcon = AVAILABLE_ICONS[selectedIconKey]?.icon || currentCatConfig.icon;

                  return (
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-parchment/60 uppercase">Ícone Exibido:</span>
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border",
                            currentCatConfig.bg,
                            currentCatConfig.border,
                            currentCatConfig.glow
                          )}>
                            <SelectedMarkerIcon size={13} className={currentCatConfig.color} />
                          </div>
                          <span className="text-xs font-mono text-arcane font-semibold">
                            {AVAILABLE_ICONS[selectedIconKey]?.label.split('/')[0] || selectedIconKey}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsCustomIconPickerOpen(!isCustomIconPickerOpen)}
                          className="text-[11px] text-arcane hover:underline font-mono flex items-center gap-1"
                        >
                          <span>{isCustomIconPickerOpen ? 'Fechar Ícones' : 'Mudar Ícone (20 opções)'}</span>
                        </button>
                      </div>

                      {isCustomIconPickerOpen && (
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-[10px] text-parchment/50 mb-2">
                            Selecione um dos 20 ícones temáticos para destacar este local no mapa:
                          </p>
                          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                            {Object.entries(AVAILABLE_ICONS).map(([iconKey, iconObj]) => {
                              const IconComp = iconObj.icon;
                              const isIconActive = selectedIconKey === iconKey;

                              return (
                                <button
                                  key={iconKey}
                                  type="button"
                                  onClick={() => setPinDraft({ ...pinDraft, customIcon: iconKey })}
                                  className={cn(
                                    "p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all",
                                    isIconActive
                                      ? "bg-arcane/20 border-arcane text-arcane ring-2 ring-arcane/40"
                                      : "bg-white/5 border-white/5 text-parchment/60 hover:text-parchment hover:bg-white/10"
                                  )}
                                  title={iconObj.label}
                                >
                                  <IconComp size={15} />
                                </button>
                              );
                            })}
                          </div>
                          
                          {pinDraft.customIcon && pinDraft.customIcon !== currentCatConfig.defaultIconName && (
                            <button
                              type="button"
                              onClick={() => setPinDraft({ ...pinDraft, customIcon: currentCatConfig.defaultIconName })}
                              className="mt-2 text-[10px] text-parchment/50 hover:text-arcane font-mono underline"
                            >
                              Restaurar ícone padrão da categoria ({currentCatConfig.defaultIconName})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Live Marker Visual Preview */}
                {(() => {
                  const currentCatConfig = getCategoryConfig(pinDraft.category);
                  const selectedIconKey = (pinDraft.customIcon && AVAILABLE_ICONS[pinDraft.customIcon])
                    ? pinDraft.customIcon
                    : currentCatConfig.defaultIconName;
                  const SelectedMarkerIcon = AVAILABLE_ICONS[selectedIconKey]?.icon || currentCatConfig.icon;

                  return (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-obsidian via-black/40 to-obsidian border border-white/10 flex items-center justify-between text-xs">
                      <span className="text-[10px] font-mono text-parchment/50 uppercase">Prévia no Mapa:</span>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 relative",
                          currentCatConfig.bg,
                          currentCatConfig.border,
                          currentCatConfig.glow
                        )}>
                          <SelectedMarkerIcon size={14} className={currentCatConfig.color} />
                          <span className={cn(
                            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-black",
                            pinDraft.dangerLevel === 'safe' && "bg-emerald-500",
                            pinDraft.dangerLevel === 'moderate' && "bg-yellow-500",
                            pinDraft.dangerLevel === 'dangerous' && "bg-orange-500",
                            pinDraft.dangerLevel === 'deadly' && "bg-rose-500"
                          )} />
                        </div>
                        <span className="font-serif text-xs font-semibold text-parchment">
                          {pinDraft.title || 'Título do Local'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Danger Level */}
                <div>
                  <label className="block text-xs font-mono text-parchment/60 uppercase mb-1">
                    Nível de Ameaça
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(DANGER_LEVELS).map(([k, v]) => {
                      const isDangerActive = pinDraft.dangerLevel === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setPinDraft({ ...pinDraft, dangerLevel: k as any })}
                          className={cn(
                            "py-1.5 px-2 rounded-xl border text-xs font-medium transition-all text-center",
                            isDangerActive
                              ? `${v.bg} ${v.color} ${v.border} ring-2 ring-white/20 font-semibold`
                              : "bg-white/5 border-white/5 text-parchment/60 hover:text-parchment hover:bg-white/10"
                          )}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Associated Session & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-parchment/60 uppercase mb-1">
                      Vincular à Sessão de Jogo
                    </label>
                    <select
                      value={pinDraft.sessionId || ''}
                      onChange={(e) => setPinDraft({ ...pinDraft, sessionId: e.target.value })}
                      className="w-full bg-white/5 border border-white/15 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-arcane text-parchment"
                    >
                      <option value="" className="bg-obsidian">Sem Sessão / Global</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id} className="bg-obsidian">
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-parchment/60 uppercase mb-1">
                      Estado da Exploração
                    </label>
                    <select
                      value={pinDraft.status || 'explored'}
                      onChange={(e) => setPinDraft({ ...pinDraft, status: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/15 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-arcane text-parchment"
                    >
                      {Object.entries(STATUS_OPTIONS).map(([k, v]) => (
                        <option key={k} value={k} className="bg-obsidian">
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes & Lore */}
                <div>
                  <label className="block text-xs font-mono text-parchment/60 uppercase mb-1">
                    Anotações da Descoberta & Descrição
                  </label>
                  <textarea
                    rows={3}
                    value={pinDraft.description || ''}
                    onChange={(e) => setPinDraft({ ...pinDraft, description: e.target.value })}
                    placeholder="O que o grupo descobriu aqui? Rumores, tesouros, inimigos, arquitetura ou pistas encontradas durante a partida..."
                    className="w-full bg-white/5 border border-white/15 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-arcane resize-none"
                  />
                </div>

                {/* Secret notes */}
                <div>
                  <label className="block text-xs font-mono text-rose-400 uppercase mb-1 flex items-center gap-1">
                    <Lock size={12} />
                    <span>Notas Secretas do Mestre (Opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={pinDraft.secrets || ''}
                    onChange={(e) => setPinDraft({ ...pinDraft, secrets: e.target.value })}
                    placeholder="Segredos que os jogadores ainda não descobriram (armadilhas, itens lendários, lealdade de NPCs)..."
                    className="w-full bg-rose-500/5 border border-rose-500/20 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-rose-400 resize-none text-rose-200"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setIsCreatingModalOpen(false);
                    setIsEditingModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl hover:bg-white/10 text-parchment text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={isCreatingModalOpen ? handleSaveNewPin : handleUpdatePin}
                  disabled={!pinDraft.title?.trim()}
                  className="px-5 py-2 rounded-xl bg-arcane text-obsidian text-xs font-semibold hover:bg-arcane/90 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-lg shadow-arcane/20"
                >
                  <Save size={14} />
                  <span>{isCreatingModalOpen ? 'Salvar Marcador' : 'Atualizar Local'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category & Icon Legend Modal */}
      <AnimatePresence>
        {isLegendOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-arcane/20 border border-arcane/40 flex items-center justify-center text-arcane">
                    <Compass size={22} />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-parchment">
                      Legenda Cartográfica & Categorias de Locais
                    </h3>
                    <p className="text-xs text-parchment/60">
                      Guia de símbolos e categorização de locais descobertos no mapa
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsLegendOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-parchment/60 hover:text-parchment"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {/* Categories Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-mono uppercase text-arcane flex items-center gap-1.5 font-semibold">
                      <Layers size={13} />
                      <span>Categorias de Marcadores ({Object.keys(CATEGORIES).length})</span>
                    </h4>
                    <span className="text-[11px] font-mono text-parchment/50">
                      Clique em uma categoria para filtrar o mapa
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.values(CATEGORIES).map((cat) => {
                      const CatIcon = cat.icon;
                      const count = pins.filter(p => p.mapId === selectedMapId && (p.category === cat.id || (cat.id === 'town' && p.category === 'city'))).length;
                      const isFilterActive = selectedCategoryFilter === cat.id;

                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategoryFilter(isFilterActive ? 'all' : cat.id);
                            setIsLegendOpen(false);
                          }}
                          className={cn(
                            "p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all text-left",
                            isFilterActive
                              ? `${cat.bg} ${cat.border} ring-2 ring-arcane/50 shadow-lg`
                              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.07]"
                          )}
                        >
                          <div className={cn("p-2 rounded-xl border shrink-0", cat.bg, cat.border, cat.glow)}>
                            <CatIcon size={18} className={cat.color} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h5 className="font-serif text-xs font-semibold text-parchment">
                                {cat.label}
                              </h5>
                              <span className={cn(
                                "text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold",
                                count > 0 ? "bg-arcane/20 text-arcane border border-arcane/30" : "bg-white/5 text-parchment/40"
                              )}>
                                {count} {count === 1 ? 'local' : 'locais'}
                              </span>
                            </div>
                            <p className="text-[11px] text-parchment/60 mt-1 leading-snug">
                              {cat.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Available Icons Showcase */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                  <h4 className="text-xs font-mono uppercase text-parchment/60 mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>20 Ícones Exclusivos para Personalização</span>
                  </h4>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 text-center">
                    {Object.entries(AVAILABLE_ICONS).map(([k, iconObj]) => {
                      const IconComp = iconObj.icon;
                      return (
                        <div key={k} className="p-2 rounded-lg bg-black/30 border border-white/5 flex flex-col items-center justify-center gap-1">
                          <IconComp size={16} className="text-arcane" />
                          <span className="text-[10px] text-parchment/70 truncate w-full">{iconObj.label.split('/')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
                <span className="text-xs text-parchment/50 font-mono">
                  Total no Mapa Atual: {pins.filter(p => p.mapId === selectedMapId).length} marcadores
                </span>
                <div className="flex items-center gap-2">
                  {selectedCategoryFilter !== 'all' && (
                    <button
                      onClick={() => {
                        setSelectedCategoryFilter('all');
                        setIsLegendOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-parchment text-xs transition-colors"
                    >
                      Limpar Filtros
                    </button>
                  )}
                  <button
                    onClick={() => setIsLegendOpen(false)}
                    className="px-4 py-1.5 rounded-xl bg-arcane text-obsidian text-xs font-semibold hover:bg-arcane/90 transition-colors"
                  >
                    Fechar Legenda
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSettingCustomUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-obsidian border border-white/15 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-arcane" />
                  <h3 className="font-serif text-lg font-bold">Mapa Customizado</h3>
                </div>
                <button
                  onClick={() => setIsSettingCustomUrl(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-parchment/60"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-parchment/70 leading-relaxed">
                Insira o link direto de uma imagem para utilizar como mapa mundi da sua campanha (JPG, PNG ou WebP).
              </p>

              <div>
                <label className="block text-xs font-mono text-parchment/60 uppercase mb-1">
                  URL da Imagem do Mapa
                </label>
                <input
                  type="url"
                  value={customMapUrl}
                  onChange={(e) => setCustomMapUrl(e.target.value)}
                  placeholder="https://exemplo.com/meu-mapa-fantasia.jpg"
                  className="w-full bg-white/5 border border-white/15 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-arcane"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsSettingCustomUrl(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-white/10 text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setIsSettingCustomUrl(false);
                    setSelectedMapId('custom');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-arcane text-obsidian text-xs font-semibold hover:bg-arcane/90"
                >
                  Aplicar Mapa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Map Manager Modal (GM Full Control) */}
      {isGM && (
        <CampaignMapManagerModal
          isOpen={isMapManagerOpen}
          onClose={() => setIsMapManagerOpen(false)}
          sessionId={selectedSessionId}
          sessionName={activeSessionData?.name || 'Campanha'}
          worldMaps={campaignWorldMaps}
          dungeonMaps={campaignDungeonMaps}
          onSelectMap={(type, id) => {
            if (type === 'world') {
              setSelectedMapId(id);
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('map', id);
                if (selectedSessionId) next.set('session', selectedSessionId);
                return next;
              });
            } else {
              window.location.href = `/dungeon?map=${id}${selectedSessionId ? `&session=${selectedSessionId}` : ''}`;
            }
          }}
        />
      )}

      {/* Interactive Character Sheet Modal over World Map */}
      {sheetModalCharacterId && (
        <CharacterSheet
          characterIdProp={sheetModalCharacterId}
          isModal={true}
          onClose={() => setSheetModalCharacterId(null)}
        />
      )}
    </div>
  );
}
