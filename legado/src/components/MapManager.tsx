import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Map as MapIcon, 
  Compass, 
  Skull, 
  Shield, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Edit3,
  ExternalLink, 
  Sparkles, 
  Layers, 
  Grid, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Users, 
  ArrowRight,
  X,
  Sword,
  Image as ImageIcon,
  Upload,
  Ratio,
  Save,
  Loader2,
  Sliders,
  SlidersHorizontal,
  Move,
  RefreshCw,
  Ruler,
  Paintbrush,
  Eraser,
  CloudFog,
  Crosshair,
  RotateCcw
} from 'lucide-react';
import { cn, compressImageFile, compressDataUrl } from '../lib/utils';
import { 
  db, 
  auth, 
  onAuthStateChanged,
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc 
} from '../firebase';
import { 
  CampaignMapItem, 
  resolveCampaignMaps, 
  toggleCampaignMapActive, 
  deleteCampaignCustomMap,
  MapLayerSettings,
  DEFAULT_LAYER_SETTINGS,
  saveMapLayerSettings,
  MapGridScaleConfig,
  DEFAULT_GRID_SCALE_CONFIG,
  calculateGridDistance
} from '../lib/campaignMaps';
import MapSketchStudio from './map/MapSketchStudio';

export default function MapManager() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Reactive Auth State to prevent dropped queries or null currentUser on load
  const [currentUser, setCurrentUser] = React.useState(auth.currentUser);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  // Selected session ID
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(() => searchParams.get('session') || '');
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [activeSessionData, setActiveSessionData] = React.useState<any | null>(null);
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

  // Filter Tab
  const [filterType, setFilterType] = React.useState<'all' | 'world' | 'dungeon'>('all');
  const [sourceFilter, setSourceFilter] = React.useState<'all' | 'custom' | 'presets'>('custom');

  // Custom Maps from Firestore
  const [customWorldMaps, setCustomWorldMaps] = React.useState<CampaignMapItem[]>([]);
  const [customDungeonMaps, setCustomDungeonMaps] = React.useState<CampaignMapItem[]>([]);
  const [loadingMaps, setLoadingMaps] = React.useState(true);

  // Global Layer Mode (Todas as Camadas | Apenas Imagem de Fundo | Apenas Grade & Tokens)
  const [globalLayerMode, setGlobalLayerMode] = React.useState<'all' | 'background' | 'grid_tokens'>('all');

  // Interactive Layer Inspector Modal State
  const [layerModalMap, setLayerModalMap] = React.useState<CampaignMapItem | null>(null);
  const [inspectorTab, setInspectorTab] = React.useState<'layers' | 'fog' | 'ruler'>('layers');
  const [layerSettingsForm, setLayerSettingsForm] = React.useState<MapLayerSettings>(DEFAULT_LAYER_SETTINGS);
  const [isSavingLayers, setIsSavingLayers] = React.useState(false);

  // Fog of War Overlay Painting State
  const [fogBrushMode, setFogBrushMode] = React.useState<'reveal' | 'hide'>('reveal');
  const [fogBrushSize, setFogBrushSize] = React.useState<1 | 2 | 3>(2);
  const [isPaintingFog, setIsPaintingFog] = React.useState(false);
  const [revealedCellsSet, setRevealedCellsSet] = React.useState<Set<number>>(new Set());
  const [hoveredFogCell, setHoveredFogCell] = React.useState<{ col: number; row: number } | null>(null);

  // Distance Measurement Ruler State
  const [rulerStart, setRulerStart] = React.useState<{ x: number; y: number } | null>(null);
  const [rulerCurrent, setRulerCurrent] = React.useState<{ x: number; y: number } | null>(null);
  const [isDrawingRuler, setIsDrawingRuler] = React.useState(false);

  // Interactive Test Tokens for the live layer inspector canvas
  const [previewTokens, setPreviewTokens] = React.useState<Array<{ id: string; name: string; x: number; y: number; color: string; label: string }>>([
    { id: 't1', name: 'Guerreiro da Vanguarda', x: 28, y: 42, color: '#38bdf8', label: '⚔️' },
    { id: 't2', name: 'Feiticeira Arcana', x: 44, y: 36, color: '#c084fc', label: '✨' },
    { id: 't3', name: 'Monstro Chefe', x: 68, y: 62, color: '#f87171', label: '💀' }
  ]);
  const [draggingPreviewTokenId, setDraggingPreviewTokenId] = React.useState<string | null>(null);

  // Safe In-UI Map Deletion State
  const [mapToDelete, setMapToDelete] = React.useState<CampaignMapItem | null>(null);
  const [isDeletingMap, setIsDeletingMap] = React.useState(false);

  // Sketch Studio State
  const [isSketchStudioOpen, setIsSketchStudioOpen] = React.useState(false);

  // Add Map Form State
  const [isAddingMap, setIsAddingMap] = React.useState(false);
  const [newMapType, setNewMapType] = React.useState<'world' | 'dungeon'>('world');
  const [newName, setNewName] = React.useState('');
  const [newSubtitle, setNewSubtitle] = React.useState('');
  const [newImageUrl, setNewImageUrl] = React.useState('');
  const [newScale, setNewScale] = React.useState('1 cm = 25 léguas');
  const [newGridCols, setNewGridCols] = React.useState(24);
  const [newGridRows, setNewGridRows] = React.useState(14);
  const [newTheme, setNewTheme] = React.useState('Personalizado');
  const [newMapSessionId, setNewMapSessionId] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [isCompressingImage, setIsCompressingImage] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detectedDimensions, setDetectedDimensions] = React.useState<{ width: number; height: number; ratioStr: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Edit Map Modal State
  const [editingMap, setEditingMap] = React.useState<CampaignMapItem | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editSubtitle, setEditSubtitle] = React.useState('');
  const [editImageUrl, setEditImageUrl] = React.useState('');
  const [editGridCols, setEditGridCols] = React.useState(24);
  const [editGridRows, setEditGridRows] = React.useState(14);
  const [editTheme, setEditTheme] = React.useState('Personalizado');
  const [editScale, setEditScale] = React.useState('1 cm = 25 léguas');
  const [editSessionId, setEditSessionId] = React.useState('');
  const [editActive, setEditActive] = React.useState(true);
  const [isUpdatingMap, setIsUpdatingMap] = React.useState(false);
  const [isCompressingEditImage, setIsCompressingEditImage] = React.useState(false);
  const [editDimensions, setEditDimensions] = React.useState<{ width: number; height: number; ratioStr: string } | null>(null);
  const editFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Measure Image Dimensions and Auto-calculate Grid
  const measureImageDimensions = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = w / h;
      let ratioStr = `${w} × ${h}`;
      if (Math.abs(ratio - 16 / 9) < 0.15) ratioStr += ' (16:9)';
      else if (Math.abs(ratio - 1) < 0.15) ratioStr += ' (1:1 Quadrado)';
      else if (Math.abs(ratio - 21 / 9) < 0.2) ratioStr += ' (21:9 Panorâmico)';
      else if (ratio < 0.8) ratioStr += ' (Vertical)';

      setDetectedDimensions({ width: w, height: h, ratioStr });

      // If user hasn't explicitly customized cols/rows, recommend matching grid
      if (newMapType === 'dungeon') {
        if (ratio >= 1.5) {
          setNewGridCols(24);
          setNewGridRows(14);
        } else if (ratio >= 0.85 && ratio <= 1.25) {
          setNewGridCols(24);
          setNewGridRows(24);
        } else if (ratio < 0.85) {
          setNewGridCols(14);
          setNewGridRows(24);
        }
      }
    };
    img.src = url;
  };

  const measureEditImageDimensions = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = w / h;
      let ratioStr = `${w} × ${h}`;
      if (Math.abs(ratio - 16 / 9) < 0.15) ratioStr += ' (16:9)';
      else if (Math.abs(ratio - 1) < 0.15) ratioStr += ' (1:1 Quadrado)';
      else if (Math.abs(ratio - 21 / 9) < 0.2) ratioStr += ' (21:9 Panorâmico)';
      else if (ratio < 0.8) ratioStr += ' (Vertical)';
      setEditDimensions({ width: w, height: h, ratioStr });
    };
    img.src = url;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).' });
      return;
    }

    setIsCompressingImage(true);
    setStatusMessage(null);
    try {
      // Compress client-side so image fits strictly under Firestore's 1MB limit
      const compressedDataUrl = await compressImageFile(file, 1920, 1080, 0.82);
      setNewImageUrl(compressedDataUrl);
      measureImageDimensions(compressedDataUrl);
      if (!newName.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setNewName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err) {
      console.error('Error compressing image:', err);
      setStatusMessage({ type: 'error', text: 'Erro ao processar imagem. Tente outro arquivo.' });
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).' });
      return;
    }

    setIsCompressingEditImage(true);
    try {
      const compressedDataUrl = await compressImageFile(file, 1920, 1080, 0.82);
      setEditImageUrl(compressedDataUrl);
      measureEditImageDimensions(compressedDataUrl);
    } catch (err) {
      console.error('Error compressing edit image:', err);
      setStatusMessage({ type: 'error', text: 'Erro ao processar nova imagem.' });
    } finally {
      setIsCompressingEditImage(false);
    }
  };

  const handleOpenEditMap = (map: CampaignMapItem) => {
    setEditingMap(map);
    setEditName(map.name);
    setEditSubtitle(map.subtitle || '');
    setEditImageUrl(map.imageUrl || '');
    setEditGridCols(map.gridCols || 24);
    setEditGridRows(map.gridRows || 14);
    setEditTheme(map.theme || 'Personalizado');
    setEditScale(map.defaultScale || '1 cm = 25 léguas');
    setEditSessionId(map.sessionId || selectedSessionId || '');
    setEditActive(map.active !== false);
    measureEditImageDimensions(map.imageUrl || '');
  };

  const handleSaveEditedMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMap || !editName.trim() || !editImageUrl.trim()) return;

    setIsUpdatingMap(true);
    setStatusMessage(null);
    try {
      const finalImg = await compressDataUrl(editImageUrl.trim(), 1920, 1080, 0.82);
      const col = editingMap.type === 'world' ? 'worldMaps' : 'dungeonMaps';

      const updatePayload: any = {
        name: editName.trim(),
        subtitle: editSubtitle.trim(),
        imageUrl: finalImg,
        sessionId: editSessionId,
        active: editActive,
        updatedAt: new Date().toISOString()
      };

      if (editingMap.type === 'world') {
        updatePayload.defaultScale = editScale.trim() || '1 cm = 25 léguas';
      } else {
        updatePayload.gridCols = Number(editGridCols) || 24;
        updatePayload.gridRows = Number(editGridRows) || 14;
        updatePayload.theme = editTheme.trim() || 'Personalizado';
      }

      await updateDoc(doc(db, col, editingMap.id), updatePayload);

      if (editSessionId) {
        try {
          await updateDoc(doc(db, 'gameSessions', editSessionId), {
            [`mapSettings.${editingMap.id}.active`]: editActive
          });
        } catch (_) {}
      }

      setEditingMap(null);
      setStatusMessage({ type: 'success', text: `Mapa "${editName}" atualizado com sucesso!` });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Error updating custom map:', err);
      setStatusMessage({ type: 'error', text: 'Falha ao atualizar o mapa. Verifique a imagem ou tente novamente.' });
    } finally {
      setIsUpdatingMap(false);
    }
  };

  // Load User Role
  React.useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUserRole(snap.data().role || 'user');
      }
    });
    return () => unsub();
  }, [currentUser]);

  // Load GM Sessions
  React.useEffect(() => {
    if (!currentUser) return;
    const qSessions = query(collection(db, 'gameSessions'));
    const unsub = onSnapshot(qSessions, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, name: data.name || 'Sessão sem nome', gmId: data.gmId, ...data });
      });
      setSessions(list);
    });
    return () => unsub();
  }, [currentUser]);

  // Filter sessions mastered strictly by this GM (a GM only manages their own campaigns)
  const gmSessions = React.useMemo(() => {
    return sessions.filter(s => s.gmId === currentUser?.uid);
  }, [sessions, currentUser]);

  // Set of session IDs mastered by this user
  const userGmSessionIds = React.useMemo(() => {
    return new Set(gmSessions.map(s => s.id));
  }, [gmSessions]);

  // Auto-select first session only if an invalid session ID is present in URL
  React.useEffect(() => {
    if (!currentUser) return;
    if (gmSessions.length > 0 && selectedSessionId) {
      const isSelectedValid = gmSessions.some(s => s.id === selectedSessionId);
      if (!isSelectedValid) {
        setSelectedSessionId(gmSessions[0].id);
        setSearchParams({ session: gmSessions[0].id });
      }
    }
  }, [gmSessions, selectedSessionId, setSearchParams, currentUser]);

  // Listen to active session data
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
    });
    return () => unsub();
  }, [selectedSessionId]);

  // Load Custom World Maps - Strictly preserves GM maps and prevents premature overwriting
  React.useEffect(() => {
    if (!currentUser) {
      setLoadingMaps(false);
      return;
    }
    const qWorld = query(collection(db, 'worldMaps'));
    const unsub = onSnapshot(qWorld, (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();

        // Strict GM Ownership & Access:
        // GM can see maps they created, maps of their sessions, or any map if admin
        const isOwner = userRole === 'admin' ||
          data.createdBy === currentUser.uid || 
          (data.sessionId && userGmSessionIds.has(data.sessionId)) ||
          (!data.createdBy) ||
          (selectedSessionId && data.sessionId === selectedSessionId);

        if (!isOwner) return;

        // Campaign selection filter
        const matchesSession = !selectedSessionId 
          ? true 
          : (data.sessionId === selectedSessionId || (!data.sessionId && (data.createdBy === currentUser.uid || !data.createdBy)));

        if (matchesSession) {
          // Resolve layer settings with fallback to localStorage cache
          let layerSettings = data.layerSettings;
          if (!layerSettings) {
            try {
              const cached = localStorage.getItem(`map_layers_${d.id}`);
              if (cached) layerSettings = JSON.parse(cached);
            } catch (_) {}
          }

          list.push({
            id: d.id,
            name: data.name || 'Mapa do Mundo Personalizado',
            subtitle: data.subtitle || 'Mapa personalizado da campanha',
            type: 'world',
            imageUrl: data.imageUrl,
            defaultScale: data.defaultScale || '1 cm = 25 léguas',
            active: data.active !== false,
            isCustom: true,
            sessionId: data.sessionId,
            createdBy: data.createdBy,
            layerSettings: layerSettings || DEFAULT_LAYER_SETTINGS
          });
        }
      });
      setCustomWorldMaps(list);
      setLoadingMaps(false);
    }, (err) => {
      console.warn('Error loading custom world maps:', err);
      setLoadingMaps(false);
    });
    return () => unsub();
  }, [currentUser, userRole, selectedSessionId, userGmSessionIds]);

  // Load Custom Dungeon Maps - Strictly preserves GM maps and prevents premature overwriting
  React.useEffect(() => {
    if (!currentUser) {
      setLoadingMaps(false);
      return;
    }
    const qDung = query(collection(db, 'dungeonMaps'));
    const unsub = onSnapshot(qDung, (snap) => {
      const list: CampaignMapItem[] = [];
      snap.forEach(d => {
        const data = d.data();

        // Strict GM Ownership & Access:
        // GM can see maps they created, maps of their sessions, or any map if admin
        const isOwner = userRole === 'admin' ||
          data.createdBy === currentUser.uid || 
          (data.sessionId && userGmSessionIds.has(data.sessionId)) ||
          (!data.createdBy) ||
          (selectedSessionId && data.sessionId === selectedSessionId);

        if (!isOwner) return;

        // Campaign selection filter
        const matchesSession = !selectedSessionId 
          ? true 
          : (data.sessionId === selectedSessionId || (!data.sessionId && (data.createdBy === currentUser.uid || !data.createdBy)));

        if (matchesSession) {
          // Resolve layer settings with fallback to localStorage cache
          let layerSettings = data.layerSettings;
          if (!layerSettings) {
            try {
              const cached = localStorage.getItem(`map_layers_${d.id}`);
              if (cached) layerSettings = JSON.parse(cached);
            } catch (_) {}
          }

          list.push({
            id: d.id,
            name: data.name || 'Masmorra Personalizada',
            subtitle: data.subtitle || 'Mapa de batalha personalizado',
            theme: data.theme || 'Custom',
            type: 'dungeon',
            imageUrl: data.imageUrl,
            gridCols: Number(data.gridCols) || 24,
            gridRows: Number(data.gridRows) || 14,
            entranceCoord: data.entranceCoord || { x: 10, y: 50 },
            active: data.active !== false,
            isCustom: true,
            sessionId: data.sessionId,
            createdBy: data.createdBy,
            layerSettings: layerSettings || DEFAULT_LAYER_SETTINGS
          });
        }
      });
      setCustomDungeonMaps(list);
      setLoadingMaps(false);
    }, (err) => {
      console.warn('Error loading custom dungeon maps:', err);
      setLoadingMaps(false);
    });
    return () => unsub();
  }, [currentUser, userRole, selectedSessionId, userGmSessionIds]);

  // Resolve all campaign maps with GM activations (Custom maps appear FIRST)
  const campaignMaps = React.useMemo(() => {
    return resolveCampaignMaps(activeSessionData, customDungeonMaps, customWorldMaps);
  }, [activeSessionData, customDungeonMaps, customWorldMaps]);

  const worldMaps = campaignMaps.worldMaps;
  const dungeonMaps = campaignMaps.dungeonMaps;

  // Filtered list based on tab and source
  const displayedMaps = React.useMemo(() => {
    let list = filterType === 'world' 
      ? worldMaps 
      : filterType === 'dungeon' 
        ? dungeonMaps 
        : [...worldMaps, ...dungeonMaps];

    if (sourceFilter === 'custom') {
      list = list.filter(m => m.isCustom);
    } else if (sourceFilter === 'presets') {
      list = list.filter(m => !m.isCustom);
    }
    return list;
  }, [filterType, sourceFilter, worldMaps, dungeonMaps]);

  const customCount = displayedMaps.filter(m => m.isCustom).length;
  const activeCount = displayedMaps.filter(m => m.active).length;
  const totalCount = displayedMaps.length;

  const handleToggleMap = async (map: CampaignMapItem) => {
    // Only the GM who owns the map or the campaign can toggle it
    if (!map.isCustom) {
      setStatusMessage({ type: 'error', text: 'Os modelos base são fixos. Um mestre só pode gerenciar os seus próprios mapas.' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    if (map.createdBy && currentUser && map.createdBy !== currentUser.uid && (!map.sessionId || !userGmSessionIds.has(map.sessionId))) {
      setStatusMessage({ type: 'error', text: 'Você só pode gerenciar os mapas da sua própria campanha.' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    try {
      await toggleCampaignMapActive(selectedSessionId, map.id, map.active, map.isCustom, map.type);
      setStatusMessage({
        type: 'success',
        text: `Mapa "${map.name}" foi ${!map.active ? 'ativado (visível aos jogadores)' : 'desativado (oculto dos jogadores)'}!`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Error toggling map active:', err);
      setStatusMessage({ type: 'error', text: 'Erro ao alterar status do mapa.' });
    }
  };

  const requestDeleteCustomMap = (map: CampaignMapItem) => {
    if (map.createdBy && currentUser && map.createdBy !== currentUser.uid && (!map.sessionId || !userGmSessionIds.has(map.sessionId))) {
      setStatusMessage({ type: 'error', text: 'Você só pode excluir os seus próprios mapas.' });
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    setMapToDelete(map);
  };

  const handleConfirmDeleteCustomMap = async () => {
    if (!mapToDelete) return;
    setIsDeletingMap(true);
    try {
      await deleteCampaignCustomMap(mapToDelete.id, mapToDelete.type);
      // Optimistically remove from state
      if (mapToDelete.type === 'world') {
        setCustomWorldMaps(prev => prev.filter(m => m.id !== mapToDelete.id));
      } else {
        setCustomDungeonMaps(prev => prev.filter(m => m.id !== mapToDelete.id));
      }
      setStatusMessage({ type: 'success', text: `Mapa "${mapToDelete.name}" excluído com sucesso.` });
      setTimeout(() => setStatusMessage(null), 3000);
      setMapToDelete(null);
    } catch (err) {
      console.error('Error deleting map:', err);
      setStatusMessage({ type: 'error', text: 'Erro ao excluir mapa.' });
    } finally {
      setIsDeletingMap(false);
    }
  };

  // Helper: Get cells in radius for fog of war painting
  const getCellsInRadius = React.useCallback((centerCol: number, centerRow: number, radius: number, cols: number, rows: number): number[] => {
    const result: number[] = [];
    const r = radius - 1; // 1 -> 0 (single cell), 2 -> 1 (3x3), 3 -> 2 (5x5)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const col = centerCol + dx;
        const row = centerRow + dy;
        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          result.push(row * cols + col);
        }
      }
    }
    return result;
  }, []);

  // Open Layer Management Modal for a Map (with target tab: layers | fog | ruler)
  const handleOpenLayerModal = (map: CampaignMapItem, targetTab: 'layers' | 'fog' | 'ruler' = 'layers') => {
    setLayerModalMap(map);
    setInspectorTab(targetTab);

    const sessionLayer = activeSessionData?.mapSettings?.[map.id]?.layerSettings;
    const initialSettings: MapLayerSettings = sessionLayer || map.layerSettings || DEFAULT_LAYER_SETTINGS;

    const cols = map.gridCols || 24;
    const rows = map.gridRows || 14;
    const totalCells = cols * rows;

    // Resolve revealed cells
    let initialRevealed: number[] = [];
    if (Array.isArray(initialSettings.revealedCells) && initialSettings.revealedCells.length > 0) {
      initialRevealed = initialSettings.revealedCells;
    } else if (!initialSettings.fogEnabled) {
      // If fog is off, all cells are initially revealed
      initialRevealed = Array.from({ length: totalCells }, (_, i) => i);
    } else {
      // If fog is on and empty, reveal around entrance
      const entCol = Math.max(0, Math.min(cols - 1, Math.floor(((map.entranceCoord?.x || 10) / 100) * cols)));
      const entRow = Math.max(0, Math.min(rows - 1, Math.floor(((map.entranceCoord?.y || 50) / 100) * rows)));
      initialRevealed = getCellsInRadius(entCol, entRow, 3, cols, rows);
    }

    setRevealedCellsSet(new Set(initialRevealed));
    setLayerSettingsForm({
      ...initialSettings,
      revealedCells: initialRevealed,
      gridScale: initialSettings.gridScale || DEFAULT_GRID_SCALE_CONFIG
    });

    // Reset distance measurement ruler
    setRulerStart(null);
    setRulerCurrent(null);
    setIsDrawingRuler(false);
  };

  // Apply Fog Brush at a specific grid coordinate (col, row)
  const applyFogBrushAt = (col: number, row: number) => {
    if (!layerModalMap) return;
    const cols = layerModalMap.gridCols || 24;
    const rows = layerModalMap.gridRows || 14;
    const targetCells = getCellsInRadius(col, row, fogBrushSize, cols, rows);

    setRevealedCellsSet(prev => {
      const next = new Set<number>(prev);
      if (fogBrushMode === 'reveal') {
        targetCells.forEach(c => next.add(c));
      } else {
        targetCells.forEach(c => next.delete(c));
      }
      return next;
    });
  };

  // Fog Quick Actions
  const handleRevealAllFog = () => {
    if (!layerModalMap) return;
    const total = (layerModalMap.gridCols || 24) * (layerModalMap.gridRows || 14);
    const allCells = Array.from({ length: total }, (_, i) => i);
    setRevealedCellsSet(new Set(allCells));
  };

  const handleHideAllFog = () => {
    setRevealedCellsSet(new Set());
  };

  const handleRevealEntranceFog = () => {
    if (!layerModalMap) return;
    const cols = layerModalMap.gridCols || 24;
    const rows = layerModalMap.gridRows || 14;
    const entCol = Math.max(0, Math.min(cols - 1, Math.floor(((layerModalMap.entranceCoord?.x || 10) / 100) * cols)));
    const entRow = Math.max(0, Math.min(rows - 1, Math.floor(((layerModalMap.entranceCoord?.y || 50) / 100) * rows)));
    const entranceCells = getCellsInRadius(entCol, entRow, 3, cols, rows);
    setRevealedCellsSet(new Set(entranceCells));
  };

  const handleInvertFog = () => {
    if (!layerModalMap) return;
    const total = (layerModalMap.gridCols || 24) * (layerModalMap.gridRows || 14);
    setRevealedCellsSet(prev => {
      const next = new Set<number>();
      for (let i = 0; i < total; i++) {
        if (!prev.has(i)) next.add(i);
      }
      return next;
    });
  };

  // Save Layer Settings (Persists to Firestore doc, gameSession, and localStorage)
  const handleSaveLayerSettings = async () => {
    if (!layerModalMap) return;
    setIsSavingLayers(true);
    try {
      const finalPayload: MapLayerSettings = {
        ...layerSettingsForm,
        revealedCells: Array.from(revealedCellsSet)
      };

      await saveMapLayerSettings(
        layerModalMap.id,
        layerModalMap.type,
        finalPayload,
        selectedSessionId,
        layerModalMap.isCustom
      );

      // Optimistically update local custom lists so UI updates instantaneously
      if (layerModalMap.type === 'world') {
        setCustomWorldMaps(prev => prev.map(m => m.id === layerModalMap.id ? { ...m, layerSettings: finalPayload } : m));
      } else {
        setCustomDungeonMaps(prev => prev.map(m => m.id === layerModalMap.id ? { ...m, layerSettings: finalPayload } : m));
      }

      setStatusMessage({
        type: 'success',
        text: `Camadas, Névoa de Guerra e Régua do mapa "${layerModalMap.name}" salvas com sucesso!`
      });
      setTimeout(() => setStatusMessage(null), 3500);
      setLayerModalMap(null);
    } catch (err) {
      console.error('Error saving layer settings:', err);
      setStatusMessage({ type: 'error', text: 'Falha ao salvar configurações de camada.' });
    } finally {
      setIsSavingLayers(false);
    }
  };

  const handleCreateNewMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newImageUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Preencha o nome do mapa e selecione ou informe uma imagem.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      // Guarantee image data is safely compressed under Firestore's 1MB document limit
      const finalImageUrl = await compressDataUrl(newImageUrl.trim(), 1920, 1080, 0.82);
      const targetSession = newMapSessionId !== undefined && newMapSessionId !== '' 
        ? newMapSessionId 
        : (selectedSessionId || (gmSessions.length > 0 ? gmSessions[0].id : ''));
      const currentUid = currentUser?.uid || auth.currentUser?.uid || 'gm';

      if (newMapType === 'world') {
        const docRef = await addDoc(collection(db, 'worldMaps'), {
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa do mundo personalizado',
          imageUrl: finalImageUrl,
          defaultScale: newScale.trim() || '1 cm = 25 léguas',
          sessionId: targetSession,
          active: true,
          createdBy: currentUid,
          layerSettings: DEFAULT_LAYER_SETTINGS,
          createdAt: new Date().toISOString()
        });

        // Optimistically prepend to state immediately so the uploaded map is never masked by template presets
        const optimisticMap: CampaignMapItem = {
          id: docRef.id,
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa do mundo personalizado',
          type: 'world',
          imageUrl: finalImageUrl,
          defaultScale: newScale.trim() || '1 cm = 25 léguas',
          sessionId: targetSession,
          active: true,
          isCustom: true,
          createdBy: currentUid,
          layerSettings: DEFAULT_LAYER_SETTINGS
        };
        setCustomWorldMaps(prev => [optimisticMap, ...prev.filter(m => m.id !== docRef.id)]);
      } else {
        const docRef = await addDoc(collection(db, 'dungeonMaps'), {
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa tático de batalha',
          theme: newTheme.trim() || 'Personalizado',
          imageUrl: finalImageUrl,
          gridCols: Number(newGridCols) || 24,
          gridRows: Number(newGridRows) || 14,
          entranceCoord: { x: 10, y: 50 },
          sessionId: targetSession,
          active: true,
          createdBy: currentUid,
          layerSettings: DEFAULT_LAYER_SETTINGS,
          createdAt: new Date().toISOString()
        });

        // Optimistically prepend to state immediately so the uploaded map is never masked by template presets
        const optimisticMap: CampaignMapItem = {
          id: docRef.id,
          name: newName.trim(),
          subtitle: newSubtitle.trim() || 'Mapa tático de batalha',
          theme: newTheme.trim() || 'Personalizado',
          type: 'dungeon',
          imageUrl: finalImageUrl,
          gridCols: Number(newGridCols) || 24,
          gridRows: Number(newGridRows) || 14,
          entranceCoord: { x: 10, y: 50 },
          sessionId: targetSession,
          active: true,
          isCustom: true,
          createdBy: currentUid,
          layerSettings: DEFAULT_LAYER_SETTINGS
        };
        setCustomDungeonMaps(prev => [optimisticMap, ...prev.filter(m => m.id !== docRef.id)]);
      }

      // Ensure the user is viewing custom maps so the new map is front and center
      if (sourceFilter === 'presets') {
        setSourceFilter('all');
      }

      setNewName('');
      setNewSubtitle('');
      setNewImageUrl('');
      setDetectedDimensions(null);
      setIsAddingMap(false);
      setStatusMessage({ type: 'success', text: `Mapa "${newName.trim()}" criado e cadastrado com sucesso! Já está pronto para edição ou uso.` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Error creating map:', err);
      setStatusMessage({ 
        type: 'error', 
        text: 'Falha ao salvar mapa na campanha. Caso tenha enviado um arquivo muito grande, tente uma imagem mais leve.' 
      });
    } finally {
      setSaving(false);
    }
  };

  const isGMAuthorized = userRole === 'admin' || (userRole === 'gm' && gmSessions.length > 0) || gmSessions.length > 0;

  // Se o usuário estiver no Modo Jogador ou não for Mestre/Admin:
  if (!isGMAuthorized || viewMode === 'user') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-obsidian text-parchment relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-8 rounded-3xl border border-white/10 text-center space-y-6 shadow-2xl relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-ember/20 border border-ember/30 text-ember mx-auto flex items-center justify-center">
            <Sword size={28} />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-ember px-3 py-1 rounded-full bg-ember/10 border border-ember/20 inline-block mb-2 font-bold">
              Modo Jogador Ativo
            </span>
            <h2 className="text-2xl font-serif font-bold text-glow-arcane">
              Acesso Exclusivo para Mestres
            </h2>
            <p className="text-xs text-parchment/70 mt-2 leading-relaxed">
              Você está no Modo Jogador. Os mapas da sua campanha ficam disponíveis diretamente na <strong>Ficha do seu Personagem</strong>.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              to="/sheet"
              className="w-full py-3 px-4 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-arcane/20"
            >
              <span>Ver Mapas na Ficha do Personagem</span>
              <ArrowRight size={14} />
            </Link>

            {isGMAuthorized && (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('preferredViewMode', 'gm');
                  window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: 'gm' }));
                  setViewMode('gm');
                }}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-parchment/80 transition-all flex items-center justify-center gap-2"
              >
                <Shield size={14} className="text-arcane" />
                <span>Alternar para Modo Mestre</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 bg-obsidian text-parchment space-y-6">
      {/* Top Header & Campaign Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-arcane/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-arcane/25 to-purple-600/20 border border-arcane/40 flex items-center justify-center text-arcane shadow-xl shadow-arcane/10">
            <Shield size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-glow-arcane">
                Gerenciador de Mapas do Mestre
              </h1>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-arcane/20 border border-arcane/40 text-arcane font-bold">
                Painel do Mestre
              </span>
            </div>
            <p className="text-xs text-parchment/60 mt-1 max-w-xl">
              Ative ou desative os mapas de mundo e masmorras da campanha. Os jogadores <strong>só conseguem ver os mapas ativos</strong> através da ficha do seu respectivo personagem, e <strong>com miniatura genérica temática</strong> para proteger os segredos da aventura.
            </p>
          </div>
        </div>

        {/* Campaign Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {gmSessions.length > 0 ? (
            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
              <span className="text-xs font-mono uppercase text-parchment/40 px-2">Campanha:</span>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  if (e.target.value) {
                    setSearchParams({ session: e.target.value });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="bg-obsidian border border-white/10 rounded-xl px-3 py-1.5 text-xs font-medium text-parchment focus:outline-none focus:border-arcane"
              >
                <option value="">Todas as Campanhas ({gmSessions.length})</option>
                {gmSessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'Sessão'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
              Nenhuma campanha encontrada como Mestre.
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSketchStudioOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-obsidian text-xs font-bold hover:scale-105 transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/25 cursor-pointer"
          >
            <Sparkles size={15} />
            <span>Desenhar Mapa com IA</span>
          </button>

          <button
            onClick={() => setIsAddingMap(!isAddingMap)}
            className="px-4 py-2 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-105 transition-transform flex items-center gap-1.5 shadow-lg shadow-arcane/20"
          >
            {isAddingMap ? <X size={15} /> : <Plus size={15} />}
            <span>{isAddingMap ? 'Fechar Cadastro' : 'Cadastrar Novo Mapa'}</span>
          </button>
        </div>
      </div>

      {/* Forja Cartográfica Hero Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-600/10 to-arcane/10 border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
              <Sparkles size={11} />
              <span>Forja Cartográfica</span>
            </span>
            <h3 className="text-base sm:text-lg font-serif font-bold text-white">
              Desenhe o Próprio Mapa do Seu Mundo
            </h3>
          </div>
          <p className="text-xs text-parchment/70 max-w-2xl leading-relaxed">
            Esboce continentes, ilhas, montanhas, florestas, desertos, terras gélidas, cidades, vilas, fazendas, catacumbas, cemitérios, rios e estradas. A inteligência artística transformará seu esboço em um mapa com acabamento medieval, contemporâneo ou futurista para as suas campanhas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsSketchStudioOpen(true)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-obsidian font-bold text-xs hover:scale-105 transition-all shadow-xl shadow-amber-500/30 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Sparkles size={16} />
          <span>Abrir Forja & Desenhar Mapa</span>
        </button>
      </div>

      {/* Status Notice Toast */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "p-3 rounded-2xl text-xs flex items-center gap-2 border shadow-lg",
            statusMessage.type === 'success'
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : "bg-red-500/20 border-red-500/40 text-red-300"
          )}
        >
          {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </motion.div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Mapas Ativos (Visíveis)</span>
          <div className="text-2xl font-bold font-serif text-emerald-400 mt-1 flex items-center gap-2">
            <Eye size={20} />
            <span>{worldMaps.filter(m => m.active).length + dungeonMaps.filter(m => m.active).length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Liberados para os jogadores</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Mapas Desativados (Ocultos)</span>
          <div className="text-2xl font-bold font-serif text-amber-400 mt-1 flex items-center gap-2">
            <EyeOff size={20} />
            <span>{worldMaps.filter(m => !m.active).length + dungeonMaps.filter(m => !m.active).length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Secretos / Em preparação</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Seus Mapas Criados</span>
          <div className="text-2xl font-bold font-serif text-amber-400 mt-1 flex items-center gap-2">
            <Sparkles size={20} />
            <span>{customWorldMaps.length + customDungeonMaps.length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Exclusivos do seu mestre</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <span className="text-[10px] font-mono uppercase text-parchment/40">Battlemaps & Dungeons</span>
          <div className="text-2xl font-bold font-serif text-purple-400 mt-1 flex items-center gap-2">
            <Skull size={20} />
            <span>{dungeonMaps.length}</span>
          </div>
          <span className="text-[10px] text-parchment/40 mt-1 block">Com grade tática e tokens</span>
        </div>
      </div>

      {/* Add New Map Form (Collapsible) */}
      <AnimatePresence>
        {isAddingMap && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreateNewMap}
            className="p-6 rounded-3xl bg-white/[0.04] border border-arcane/30 space-y-4 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-arcane">
                <Plus size={18} />
                <span>Cadastrar Novo Mapa para a Campanha</span>
              </div>
              <div className="flex bg-white/5 p-1 rounded-xl text-xs border border-white/10">
                <button
                  type="button"
                  onClick={() => setNewMapType('world')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold",
                    newMapType === 'world' ? "bg-arcane text-obsidian" : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Mapa do Mundo
                </button>
                <button
                  type="button"
                  onClick={() => setNewMapType('dungeon')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold",
                    newMapType === 'dungeon' ? "bg-purple-500 text-obsidian" : "text-parchment/60 hover:text-parchment"
                  )}
                >
                  Battlemap / Dungeon
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Nome do Mapa *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newMapType === 'world' ? 'Ex: Reinos Perdidos de Valoria' : 'Ex: Catacumba dos Ancestrais'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Subtítulo / Descrição da Região
                </label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="Ex: Florestas místicas, picos e vales proibidos"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                />
              </div>
            </div>

            {/* Image Source Selection: URL or Local File */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60">
                  Imagem do Mapa * (Arquivo local ou Link direto)
                </label>
                {detectedDimensions && (
                  <span className="text-[10px] font-mono text-arcane bg-arcane/10 border border-arcane/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Ratio size={11} />
                    <span>Dimensão detectada: <strong>{detectedDimensions.ratioStr}</strong></span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <input
                    type="url"
                    value={newImageUrl.startsWith('data:') ? '' : newImageUrl}
                    onChange={(e) => {
                      setNewImageUrl(e.target.value);
                      measureImageDimensions(e.target.value);
                    }}
                    placeholder="Cole um link direto JPG/PNG/WebP ou use o botão ao lado"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-arcane font-mono"
                  />
                </div>

                <div className="sm:col-span-4 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressingImage}
                    className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-parchment border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isCompressingImage ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-arcane" />
                        <span>Comprimindo...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="text-arcane" />
                        <span>Enviar Arquivo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview image thumbnail if available */}
              {newImageUrl && (
                <div className="relative w-full h-28 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex items-center justify-center group">
                  <img src={newImageUrl} alt="Prévia do Mapa" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        setNewImageUrl('');
                        setDetectedDimensions(null);
                      }}
                      className="px-3 py-1 rounded-lg bg-rose-500/80 text-white text-xs font-semibold"
                    >
                      Remover Imagem
                    </button>
                  </div>
                </div>
              )}
            </div>

            {newMapType === 'world' ? (
              <div className="max-w-xs">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Escala do Mapa
                </label>
                <input
                  type="text"
                  value={newScale}
                  onChange={(e) => setNewScale(e.target.value)}
                  placeholder="1 cm = 30 léguas"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Tema
                    </label>
                    <input
                      type="text"
                      value={newTheme}
                      onChange={(e) => setNewTheme(e.target.value)}
                      placeholder="Ex: Cripta, Caverna, Templo"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Colunas da Grade (X)
                    </label>
                    <input
                      type="number"
                      min="6"
                      max="80"
                      value={newGridCols}
                      onChange={(e) => setNewGridCols(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Linhas da Grade (Y)
                    </label>
                    <input
                      type="number"
                      min="6"
                      max="60"
                      value={newGridRows}
                      onChange={(e) => setNewGridRows(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-arcane"
                    />
                  </div>
                </div>

                {/* Grid Presets for Battlemaps */}
                <div>
                  <span className="text-[10px] font-mono text-parchment/50 uppercase block mb-1">
                    Atalhos de Proporção da Grade:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '16:9 Padrão (24×14)', cols: 24, rows: 14 },
                      { label: 'Quadrado 1:1 (24×24)', cols: 24, rows: 24 },
                      { label: 'Vertical 9:16 (14×24)', cols: 14, rows: 24 },
                      { label: 'Panorâmico 21:9 (32×12)', cols: 32, rows: 12 },
                      { label: 'Grande (36×20)', cols: 36, rows: 20 },
                      { label: 'Épico (48×28)', cols: 48, rows: 28 },
                    ].map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setNewGridCols(p.cols);
                          setNewGridRows(p.rows);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border",
                          newGridCols === p.cols && newGridRows === p.rows
                            ? "bg-purple-500/30 text-purple-200 border-purple-400 font-bold"
                            : "bg-white/5 text-parchment/60 hover:text-white border-white/10"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Selection */}
            {gmSessions.length > 0 && (
              <div className="pt-2 border-t border-white/10 max-w-sm">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                  Vincular à Campanha
                </label>
                <select
                  value={newMapSessionId || selectedSessionId || gmSessions[0]?.id || ''}
                  onChange={(e) => setNewMapSessionId(e.target.value)}
                  className="w-full bg-obsidian border border-white/15 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-arcane"
                >
                  <option value="">Global / Todas as Campanhas</option>
                  {gmSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'Campanha'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAddingMap(false)}
                className="px-4 py-2 rounded-xl text-xs hover:bg-white/10 text-parchment/60 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || isCompressingImage}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-arcane text-obsidian hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Cadastrando...</span>
                  </>
                ) : (
                  <span>Cadastrar Mapa na Campanha</span>
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter Tabs & Layer Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type filters */}
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer",
                filterType === 'all'
                  ? "bg-white/15 text-parchment font-bold shadow-sm"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Layers size={15} />
              <span>Todos</span>
            </button>

            <button
              onClick={() => setFilterType('world')}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer",
                filterType === 'world'
                  ? "bg-arcane text-obsidian font-bold shadow-sm"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Compass size={15} />
              <span>Mundo</span>
            </button>

            <button
              onClick={() => setFilterType('dungeon')}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer",
                filterType === 'dungeon'
                  ? "bg-purple-500 text-obsidian font-bold shadow-sm"
                  : "text-parchment/60 hover:text-parchment hover:bg-white/5"
              )}
            >
              <Skull size={15} />
              <span>Dungeons</span>
            </button>
          </div>

          {/* Source filters: Todos / Apenas Meus Mapas / Modelos Base */}
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => setSourceFilter('all')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all cursor-pointer text-xs",
                sourceFilter === 'all'
                  ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 shadow-sm"
                  : "text-parchment/50 hover:text-parchment"
              )}
            >
              Todos da Campanha
            </button>
            <button
              onClick={() => setSourceFilter('custom')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer text-xs",
                sourceFilter === 'custom'
                  ? "bg-amber-400 text-obsidian font-bold shadow-sm"
                  : "text-parchment/50 hover:text-amber-300"
              )}
            >
              <Sparkles size={13} />
              <span>Apenas Meus Mapas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/20">
                {customWorldMaps.length + customDungeonMaps.length}
              </span>
            </button>
            <button
              onClick={() => setSourceFilter('presets')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all cursor-pointer text-xs",
                sourceFilter === 'presets'
                  ? "bg-white/15 text-parchment font-bold shadow-sm"
                  : "text-parchment/50 hover:text-parchment"
              )}
            >
              Modelos Base
            </button>
          </div>

          {/* Global Layer View Mode Toggle: Todas / Apenas Fundo / Apenas Grade & Tokens */}
          <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setGlobalLayerMode('all')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer text-xs",
                globalLayerMode === 'all'
                  ? "bg-arcane text-obsidian font-bold shadow-sm"
                  : "text-parchment/50 hover:text-parchment"
              )}
              title="Exibir todas as camadas ativas (imagem de fundo + grade tática e tokens)"
            >
              <Layers size={13} />
              <span>Todas as Camadas</span>
            </button>

            <button
              type="button"
              onClick={() => setGlobalLayerMode('background')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer text-xs",
                globalLayerMode === 'background'
                  ? "bg-amber-400 text-obsidian font-bold shadow-sm"
                  : "text-parchment/50 hover:text-amber-300"
              )}
              title="Exibir apenas a imagem de fundo do mapa, sem grade ou tokens"
            >
              <ImageIcon size={13} />
              <span>Apenas Fundo</span>
            </button>

            <button
              type="button"
              onClick={() => setGlobalLayerMode('grid_tokens')}
              className={cn(
                "px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer text-xs",
                globalLayerMode === 'grid_tokens'
                  ? "bg-purple-500 text-obsidian font-bold shadow-sm"
                  : "text-parchment/50 hover:text-purple-300"
              )}
              title="Modo Tático: focar na grade interativa e tokens com fundo suavizado"
            >
              <Grid size={13} />
              <span>Apenas Grade & Tokens</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-parchment/50 font-mono">
          Mostrando {displayedMaps.length} mapas • {activeCount} ativos • {customCount} criados por você
        </div>
      </div>

      {/* Loading Skeleton */}
      {loadingMaps ? (
        <div className="p-16 flex flex-col items-center justify-center gap-4 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <Loader2 size={36} className="text-arcane animate-spin" />
          <div className="text-center">
            <h3 className="font-serif text-lg font-semibold text-parchment">Carregando mapas da campanha...</h3>
            <p className="text-xs text-parchment/50 mt-1">Sincronizando cartografia e camadas com o Firebase</p>
          </div>
        </div>
      ) : (
        /* Map Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMaps.map((map) => {
            const isActive = map.active;
            const isWorld = map.type === 'world';
            const layer = map.layerSettings || DEFAULT_LAYER_SETTINGS;

            return (
              <motion.div
                key={map.id}
                layout
                className={cn(
                  "rounded-3xl border transition-all flex flex-col justify-between overflow-hidden group shadow-xl",
                  isActive
                    ? "bg-white/[0.04] border-white/15 hover:border-arcane/50"
                    : "bg-black/40 border-dashed border-white/10 opacity-70 hover:opacity-100"
                )}
              >
                <div>
                  {/* Layered Interactive Canvas Viewport (Clickable to view map) */}
                  <div 
                    onClick={() => {
                      const targetSession = map.sessionId || selectedSessionId || '';
                      if (isWorld) {
                        navigate(`/map?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                      } else {
                        navigate(`/dungeon?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                      }
                    }}
                    className="relative h-52 bg-slate-950 overflow-hidden border-b border-white/10 cursor-pointer group/banner"
                    title="Clique para abrir e ver este mapa"
                  >
                    {/* Layer 1: Background Image */}
                    <img
                      src={map.imageUrl}
                      alt={map.name}
                      style={{
                        opacity: globalLayerMode === 'grid_tokens' 
                          ? 0.18 
                          : (layer.showBackground !== false ? ((layer.backgroundOpacity ?? 100) / 100) : 0),
                        transition: 'opacity 0.3s ease'
                      }}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105",
                        !isActive && "grayscale"
                      )}
                    />

                    {/* Layer 2: Tactical Grid Overlay */}
                    {(globalLayerMode === 'all' || globalLayerMode === 'grid_tokens') && layer.showGrid !== false && (
                      <svg 
                        className="absolute inset-0 w-full h-full pointer-events-none" 
                        style={{
                          opacity: globalLayerMode === 'grid_tokens' ? 0.95 : ((layer.gridOpacity ?? 75) / 100),
                          transition: 'opacity 0.3s ease'
                        }}
                      >
                        <defs>
                          <pattern 
                            id={`grid-${map.id}`} 
                            width={`${100 / (map.gridCols || 24)}%`} 
                            height={`${100 / (map.gridRows || 14)}%`} 
                            patternUnits="userSpaceOnUse"
                          >
                            <rect width="100%" height="100%" fill="none" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="0.75" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#grid-${map.id})`} />
                      </svg>
                    )}

                    {/* Layer 2.5: Tactical Fog of War Overlay */}
                    {layer.fogEnabled && (
                      <svg 
                        className="absolute inset-0 w-full h-full pointer-events-none" 
                        style={{ 
                          opacity: (layer.fogOpacity ?? 85) / 100,
                          transition: 'opacity 0.3s ease' 
                        }}
                      >
                        <defs>
                          <mask id={`card-fog-mask-${map.id}`}>
                            <rect width="100%" height="100%" fill="white" />
                            {Array.isArray(layer.revealedCells) && layer.revealedCells.map((cellIdx) => {
                              const cols = map.gridCols || 24;
                              const rows = map.gridRows || 14;
                              const c = cellIdx % cols;
                              const r = Math.floor(cellIdx / cols);
                              return (
                                <rect
                                  key={cellIdx}
                                  x={`${(c / cols) * 100}%`}
                                  y={`${(r / rows) * 100}%`}
                                  width={`${(1 / cols) * 100 + 0.15}%`}
                                  height={`${(1 / rows) * 100 + 0.15}%`}
                                  fill="black"
                                />
                              );
                            })}
                          </mask>
                        </defs>
                        <rect width="100%" height="100%" fill="#050811" mask={`url(#card-fog-mask-${map.id})`} />
                      </svg>
                    )}

                    {/* Layer 3: Interactive Tokens / Markers */}
                    {(globalLayerMode === 'all' || globalLayerMode === 'grid_tokens') && layer.showTokens !== false && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div 
                          className="absolute w-6 h-6 rounded-full bg-arcane/90 border-2 border-white shadow-lg flex items-center justify-center text-[10px] transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                          style={{ left: `${map.entranceCoord?.x || 25}%`, top: `${map.entranceCoord?.y || 45}%` }}
                          title="Posição de Entrada / Grupo"
                        >
                          ⚔️
                        </div>
                        {!isWorld && (
                          <div 
                            className="absolute w-6 h-6 rounded-full bg-red-600/90 border-2 border-white shadow-lg flex items-center justify-center text-[10px] transform -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${Math.min(90, (map.entranceCoord?.x || 25) + 38)}%`, top: `${Math.min(90, (map.entranceCoord?.y || 45) + 18)}%` }}
                            title="Monstro / Inimigo Tático"
                          >
                            💀
                          </div>
                        )}
                      </div>
                    )}

                    {/* Active / Inactive Badge */}
                    <div className="absolute top-3 left-3">
                      {isActive ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/90 text-obsidian text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                          <Eye size={13} />
                          <span>Ativo • Visível</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-stone-900/90 text-amber-300 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 border border-amber-500/40 shadow-lg backdrop-blur-md">
                          <EyeOff size={13} />
                          <span>Desativado • Oculto</span>
                        </span>
                      )}
                    </div>

                    {/* Type Tag, Fog Badge & Ownership Badge */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase shadow-lg backdrop-blur-md",
                        isWorld 
                          ? "bg-arcane/80 text-obsidian" 
                          : "bg-purple-600/80 text-white"
                      )}>
                        {isWorld ? 'Mapa do Mundo' : 'Dungeon Battlemap'}
                      </span>
                      {layer.fogEnabled && (
                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase shadow-lg backdrop-blur-md bg-purple-900/90 text-purple-200 border border-purple-400/50 flex items-center gap-1">
                          <CloudFog size={10} />
                          <span>Névoa Ativa</span>
                        </span>
                      )}
                      {map.isCustom && (
                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold uppercase shadow-lg backdrop-blur-md bg-amber-400/90 text-obsidian flex items-center gap-1 border border-amber-300/50">
                          <Sparkles size={10} />
                          <span>Seu Mapa</span>
                        </span>
                      )}
                    </div>

                    {/* Hover Overlay Hint */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="px-4 py-2 rounded-xl bg-obsidian/90 text-arcane text-xs font-bold border border-arcane/50 shadow-2xl flex items-center gap-2 backdrop-blur-md">
                        <ExternalLink size={14} />
                        <span>Abrir Visualizador do Mapa</span>
                      </span>
                    </div>

                    {/* Spec Bar (Bottom) */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/90 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
                      <span>{isWorld ? 'Cartografia Geral' : `Grade: ${map.gridCols || 24}x${map.gridRows || 14}`}</span>
                      <span className="flex items-center gap-1 text-[9px] text-arcane">
                        <Layers size={10} />
                        <span>Fundo: {layer.showBackground !== false ? `${layer.backgroundOpacity ?? 100}%` : 'Off'} | Grade: {layer.showGrid !== false ? `${layer.gridOpacity ?? 75}%` : 'Off'}</span>
                      </span>
                      {layer.gridScale ? (
                        <span className="text-amber-300 flex items-center gap-1">
                          <Ruler size={9} />
                          <span>{layer.gridScale.valuePerSquare} {layer.gridScale.unit}/bloco</span>
                        </span>
                      ) : (
                        map.defaultScale && <span>{map.defaultScale}</span>
                      )}
                    </div>
                  </div>

                  {/* Info Content */}
                  <div className="p-5 space-y-2">
                    <h3 
                      onClick={() => {
                        const targetSession = map.sessionId || selectedSessionId || '';
                        if (isWorld) {
                          navigate(`/map?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                        } else {
                          navigate(`/dungeon?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                        }
                      }}
                      className="font-serif font-bold text-lg text-parchment group-hover:text-arcane transition-colors cursor-pointer hover:underline"
                      title="Clique para ver o mapa"
                    >
                      {map.name}
                    </h3>
                    <p className="text-xs text-parchment/60 line-clamp-2 leading-relaxed">
                      {map.subtitle}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-arcane/80 bg-arcane/5 border border-arcane/20 px-2.5 py-1 rounded-lg">
                      <Shield size={11} className="text-arcane" />
                      <span>Visão do Jogador: Miniatura Genérica ({isWorld ? 'Pergaminho Selado' : 'Portal da Masmorra'})</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-5 pt-0 border-t border-white/5 mt-2 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 pt-3">
                    {/* Explicit Ver Mapa Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetSession = map.sessionId || selectedSessionId || '';
                        if (isWorld) {
                          navigate(`/map?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                        } else {
                          navigate(`/dungeon?map=${encodeURIComponent(map.id)}${targetSession ? `&session=${encodeURIComponent(targetSession)}` : ''}`);
                        }
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-arcane/20 text-arcane hover:bg-arcane/30 border border-arcane/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                      title="Abrir este mapa em tela cheia"
                    >
                      <ExternalLink size={14} />
                      <span>Ver Mapa</span>
                    </button>

                    {/* Layer Settings Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLayerModal(map, 'layers');
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                      title="Configurar Camadas (Imagem de Fundo, Grade e Tokens)"
                    >
                      <Layers size={14} />
                      <span>Camadas</span>
                    </button>

                    {/* Fog of War Shortcut Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLayerModal(map, 'fog');
                      }}
                      className={cn(
                        "py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0",
                        layer.fogEnabled
                          ? "bg-purple-600/30 text-purple-300 hover:bg-purple-600/40 border border-purple-400/50"
                          : "bg-white/5 text-parchment/70 hover:bg-white/10 border border-white/10"
                      )}
                      title="Pintar Névoa de Guerra (Revelar ou ocultar áreas)"
                    >
                      <CloudFog size={14} />
                      <span>Névoa</span>
                    </button>

                    {/* Measurement Ruler Shortcut Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLayerModal(map, 'ruler');
                      }}
                      className="py-2.5 px-3 rounded-2xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                      title="Ferramenta de Medição de Distância e Escala de Grade"
                    >
                      <Ruler size={14} />
                      <span>Régua</span>
                    </button>

                    {/* Edit Custom Map Button */}
                    {map.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditMap(map)}
                        className="py-2.5 px-3 rounded-2xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
                        title="Editar nome, imagem, dimensões ou grade deste mapa"
                      >
                        <Edit3 size={14} />
                        <span>Editar</span>
                      </button>
                    )}

                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleMap(map)}
                      className={cn(
                        "flex-1 py-2.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer",
                        isActive
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                      )}
                    >
                      {isActive ? (
                        <>
                          <EyeOff size={14} />
                          <span className="truncate">Desativar</span>
                        </>
                      ) : (
                        <>
                          <Eye size={14} />
                          <span className="truncate">Ativar</span>
                        </>
                      )}
                    </button>

                    {/* Delete Custom Map */}
                    {map.isCustom && (
                      <button
                        type="button"
                        onClick={() => requestDeleteCustomMap(map)}
                        className="p-2.5 rounded-2xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        title="Excluir este mapa personalizado"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {displayedMaps.length === 0 && !loadingMaps && (
        <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <Layers size={40} className="mx-auto text-parchment/30 mb-3" />
          <h3 className="font-serif text-lg font-semibold text-parchment/80">Nenhum mapa encontrado</h3>
          <p className="text-xs text-parchment/40 mt-1 max-w-sm mx-auto">
            Não há mapas cadastrados para os filtros selecionados. Clique no botão de cadastrar novo mapa para começar.
          </p>
        </div>
      )}

      {/* Interactive Layer Inspector Modal */}
      <AnimatePresence>
        {layerModalMap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-obsidian border border-indigo-500/40 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl relative my-auto max-h-[94vh] overflow-y-auto text-parchment space-y-5"
            >
              {/* Modal Header & Navigation Tabs */}
              <div className="flex flex-col gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                      {inspectorTab === 'layers' && <Layers size={20} />}
                      {inspectorTab === 'fog' && <CloudFog size={20} className="text-purple-400" />}
                      {inspectorTab === 'ruler' && <Ruler size={20} className="text-amber-400" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                        <span>Inspetor Cartográfico do Mestre</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                          {layerModalMap.type === 'world' ? 'Mundo' : 'Dungeon'}
                        </span>
                      </h3>
                      <p className="text-xs text-parchment/60 font-mono">
                        {layerModalMap.name} • {layerModalMap.gridCols || 24}×{layerModalMap.gridRows || 14} blocos
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLayerModalMap(null)}
                    className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/60 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Top Tabs: Camadas | Névoa de Guerra | Régua & Medição */}
                <div className="flex items-center gap-2 bg-white/[0.03] p-1 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('layers')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      inspectorTab === 'layers'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40"
                        : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                    )}
                  >
                    <Layers size={15} />
                    <span>Camadas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectorTab('fog')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      inspectorTab === 'fog'
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40"
                        : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                    )}
                  >
                    <CloudFog size={15} />
                    <span>Névoa de Guerra</span>
                    {layerSettingsForm.fogEnabled && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Névoa Ativa" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectorTab('ruler')}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      inspectorTab === 'ruler'
                        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30 border border-amber-400/40"
                        : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                    )}
                  >
                    <Ruler size={15} />
                    <span>Régua & Medição</span>
                  </button>
                </div>
              </div>

              {/* Interactive Viewport Canvas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-parchment/70 font-mono">
                  <span>
                    {inspectorTab === 'layers' && 'Pré-visualização Interativa das Camadas:'}
                    {inspectorTab === 'fog' && 'Pintura Interativa de Névoa de Guerra (Clique e arraste):'}
                    {inspectorTab === 'ruler' && 'Régua de Medição Tática (Clique e arraste para traçar):'}
                  </span>
                  <span className="text-[11px] text-arcane flex items-center gap-1 font-mono">
                    {inspectorTab === 'layers' && (
                      <>
                        <Move size={12} />
                        <span>Arraste os tokens na grade</span>
                      </>
                    )}
                    {inspectorTab === 'fog' && (
                      <>
                        <Paintbrush size={12} className="text-purple-300" />
                        <span>Pincel: {fogBrushMode === 'reveal' ? 'Revelar (Borracha)' : 'Ocultar (Névoa)'} • {fogBrushSize === 1 ? '1 bloco' : fogBrushSize === 2 ? '3×3 blocos' : '5×5 blocos'}</span>
                      </>
                    )}
                    {inspectorTab === 'ruler' && (
                      <>
                        <Crosshair size={12} className="text-amber-300" />
                        <span>Escala: {layerSettingsForm.gridScale?.valuePerSquare || 5} {layerSettingsForm.gridScale?.unit || 'ft'}/quadrado</span>
                      </>
                    )}
                  </span>
                </div>

                <div 
                  className={cn(
                    "relative h-64 sm:h-72 w-full bg-slate-950 rounded-2xl overflow-hidden border border-white/15 select-none",
                    inspectorTab === 'fog' && "cursor-crosshair",
                    inspectorTab === 'ruler' && "cursor-crosshair"
                  )}
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                    const cols = layerModalMap.gridCols || 24;
                    const rows = layerModalMap.gridRows || 14;
                    const col = Math.max(0, Math.min(cols - 1, Math.floor((xPct / 100) * cols)));
                    const row = Math.max(0, Math.min(rows - 1, Math.floor((yPct / 100) * rows)));

                    if (inspectorTab === 'fog') {
                      setIsPaintingFog(true);
                      setHoveredFogCell({ col, row });
                      applyFogBrushAt(col, row);
                    } else if (inspectorTab === 'ruler') {
                      setIsDrawingRuler(true);
                      setRulerStart({ x: xPct, y: yPct });
                      setRulerCurrent({ x: xPct, y: yPct });
                    }
                  }}
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                    const cols = layerModalMap.gridCols || 24;
                    const rows = layerModalMap.gridRows || 14;
                    const col = Math.max(0, Math.min(cols - 1, Math.floor((xPct / 100) * cols)));
                    const row = Math.max(0, Math.min(rows - 1, Math.floor((yPct / 100) * rows)));

                    if (inspectorTab === 'fog') {
                      setHoveredFogCell({ col, row });
                      if (isPaintingFog) {
                        applyFogBrushAt(col, row);
                      }
                    } else if (inspectorTab === 'ruler') {
                      if (isDrawingRuler) {
                        setRulerCurrent({ x: xPct, y: yPct });
                      }
                    } else if (inspectorTab === 'layers') {
                      if (draggingPreviewTokenId) {
                        setPreviewTokens(prev => prev.map(t => t.id === draggingPreviewTokenId ? { ...t, x: Math.round(xPct), y: Math.round(yPct) } : t));
                      }
                    }
                  }}
                  onPointerUp={() => {
                    setIsPaintingFog(false);
                    setIsDrawingRuler(false);
                    setDraggingPreviewTokenId(null);
                  }}
                  onPointerLeave={() => {
                    setIsPaintingFog(false);
                    setIsDrawingRuler(false);
                    setDraggingPreviewTokenId(null);
                    setHoveredFogCell(null);
                  }}
                >
                  {/* Layer 1: Background Image */}
                  <img
                    src={layerModalMap.imageUrl}
                    alt={layerModalMap.name}
                    style={{
                      opacity: layerSettingsForm.showBackground ? (layerSettingsForm.backgroundOpacity / 100) : 0,
                      transition: 'opacity 0.2s ease'
                    }}
                    className="w-full h-full object-cover pointer-events-none"
                  />

                  {/* Layer 2: Tactical Grid Overlay */}
                  {(layerSettingsForm.showGrid || inspectorTab === 'fog' || inspectorTab === 'ruler') && (
                    <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none" 
                      style={{
                        opacity: layerSettingsForm.showGrid ? (layerSettingsForm.gridOpacity / 100) : 0.45,
                        transition: 'opacity 0.2s ease'
                      }}
                    >
                      <defs>
                        <pattern 
                          id={`modal-grid-${layerModalMap.id}`} 
                          width={`${100 / (layerModalMap.gridCols || 24)}%`} 
                          height={`${100 / (layerModalMap.gridRows || 14)}%`} 
                          patternUnits="userSpaceOnUse"
                        >
                          <rect width="100%" height="100%" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="0.8" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill={`url(#modal-grid-${layerModalMap.id})`} />
                    </svg>
                  )}

                  {/* Layer 2.5: Fog of War Overlay */}
                  {(layerSettingsForm.fogEnabled || inspectorTab === 'fog') && (
                    <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none" 
                      style={{ 
                        opacity: layerSettingsForm.fogEnabled 
                          ? ((layerSettingsForm.fogOpacity ?? 85) / 100)
                          : 0.5,
                        transition: 'opacity 0.2s ease' 
                      }}
                    >
                      <defs>
                        <mask id={`modal-fog-mask-${layerModalMap.id}`}>
                          <rect width="100%" height="100%" fill="white" />
                          {Array.from(revealedCellsSet).map((cellIdx) => {
                            const numIdx = Number(cellIdx);
                            const cols = layerModalMap.gridCols || 24;
                            const rows = layerModalMap.gridRows || 14;
                            const c = numIdx % cols;
                            const r = Math.floor(numIdx / cols);
                            return (
                              <rect
                                key={cellIdx}
                                x={`${(c / cols) * 100}%`}
                                y={`${(r / rows) * 100}%`}
                                width={`${(1 / cols) * 100 + 0.15}%`}
                                height={`${(1 / rows) * 100 + 0.15}%`}
                                fill="black"
                              />
                            );
                          })}
                        </mask>
                      </defs>
                      <rect 
                        width="100%" 
                        height="100%" 
                        fill="#050811" 
                        mask={`url(#modal-fog-mask-${layerModalMap.id})`} 
                      />
                    </svg>
                  )}

                  {/* Fog Brush Hover Indicator */}
                  {inspectorTab === 'fog' && hoveredFogCell && (
                    <div className="absolute inset-0 pointer-events-none">
                      {getCellsInRadius(
                        hoveredFogCell.col, 
                        hoveredFogCell.row, 
                        fogBrushSize, 
                        layerModalMap.gridCols || 24, 
                        layerModalMap.gridRows || 14
                      ).map(cIdx => {
                        const cols = layerModalMap.gridCols || 24;
                        const rows = layerModalMap.gridRows || 14;
                        const c = cIdx % cols;
                        const r = Math.floor(cIdx / cols);
                        const isRevealing = fogBrushMode === 'reveal';
                        return (
                          <div
                            key={cIdx}
                            style={{
                              left: `${(c / cols) * 100}%`,
                              top: `${(r / rows) * 100}%`,
                              width: `${(1 / cols) * 100}%`,
                              height: `${(1 / rows) * 100}%`
                            }}
                            className={cn(
                              "absolute border",
                              isRevealing 
                                ? "bg-emerald-400/30 border-emerald-400/70" 
                                : "bg-purple-600/40 border-purple-400/70"
                            )}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Layer 3: Interactive Draggable Tokens */}
                  {layerSettingsForm.showTokens && (
                    <div className="absolute inset-0 pointer-events-none">
                      {previewTokens.map((tok) => (
                        <div
                          key={tok.id}
                          onPointerDown={(e) => {
                            if (inspectorTab !== 'layers') return;
                            e.stopPropagation();
                            setDraggingPreviewTokenId(tok.id);
                          }}
                          style={{ left: `${tok.x}%`, top: `${tok.y}%` }}
                          className={cn(
                            "absolute w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-xs transform -translate-x-1/2 -translate-y-1/2 select-none",
                            inspectorTab === 'layers' ? "pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-110" : "pointer-events-none opacity-80"
                          )}
                          title={`${tok.name} (Arraste para mover)`}
                        >
                          <div 
                            className="w-full h-full rounded-full flex items-center justify-center text-xs shadow-inner"
                            style={{ backgroundColor: tok.color }}
                          >
                            <span>{tok.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Layer 4: Interactive Distance Measurement Line */}
                  {rulerStart && rulerCurrent && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                      {/* Measurement Line */}
                      <line
                        x1={`${rulerStart.x}%`}
                        y1={`${rulerStart.y}%`}
                        x2={`${rulerCurrent.x}%`}
                        y2={`${rulerCurrent.y}%`}
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        className="drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                      />

                      {/* Origin Dot */}
                      <circle
                        cx={`${rulerStart.x}%`}
                        cy={`${rulerStart.y}%`}
                        r="6"
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="animate-pulse"
                      />

                      {/* Target Reticle */}
                      <circle
                        cx={`${rulerCurrent.x}%`}
                        cy={`${rulerCurrent.y}%`}
                        r="7"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx={`${rulerCurrent.x}%`}
                        cy={`${rulerCurrent.y}%`}
                        r="2.5"
                        fill="#f59e0b"
                      />

                      {/* Midpoint Distance Badge */}
                      {(() => {
                        const midX = (rulerStart.x + rulerCurrent.x) / 2;
                        const midY = (rulerStart.y + rulerCurrent.y) / 2;
                        const dist = calculateGridDistance(
                          rulerStart, 
                          rulerCurrent, 
                          layerModalMap.gridCols || 24, 
                          layerModalMap.gridRows || 14, 
                          layerSettingsForm.gridScale || DEFAULT_GRID_SCALE_CONFIG
                        );

                        return (
                          <g transform={`translate(${midX * 8}, ${midY * 4.5})`}>
                            {/* Embedded HTML badge via foreignObject for clean styling */}
                            <foreignObject
                              x={`${midX}%`}
                              y={`${midY}%`}
                              width="160"
                              height="40"
                              style={{ overflow: 'visible', transform: 'translate(-50%, -50%)' }}
                            >
                              <div className="flex items-center justify-center">
                                <span className="px-2.5 py-1 rounded-xl bg-slate-950/90 text-amber-300 border border-amber-400/60 shadow-2xl text-[11px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md whitespace-nowrap">
                                  <Ruler size={11} className="text-amber-400" />
                                  <span>{dist.formatted}</span>
                                </span>
                              </div>
                            </foreignObject>
                          </g>
                        );
                      })()}
                    </svg>
                  )}

                  {/* Viewport Info Overlay Pill */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-white/90 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 pointer-events-none">
                    <div className="flex items-center gap-3">
                      {inspectorTab === 'layers' && (
                        <>
                          <span>Fundo: <strong className={layerSettingsForm.showBackground ? 'text-emerald-400' : 'text-red-400'}>{layerSettingsForm.showBackground ? `${layerSettingsForm.backgroundOpacity}%` : 'Oculto'}</strong></span>
                          <span>Grade: <strong className={layerSettingsForm.showGrid ? 'text-indigo-400' : 'text-red-400'}>{layerSettingsForm.showGrid ? `${layerSettingsForm.gridOpacity}%` : 'Oculta'}</strong></span>
                          <span>Tokens: <strong className={layerSettingsForm.showTokens ? 'text-arcane' : 'text-red-400'}>{layerSettingsForm.showTokens ? 'Ativos' : 'Ocultos'}</strong></span>
                        </>
                      )}
                      {inspectorTab === 'fog' && (
                        <>
                          <span>Névoa: <strong className={layerSettingsForm.fogEnabled ? 'text-emerald-400' : 'text-amber-400'}>{layerSettingsForm.fogEnabled ? 'Ativada (Mundo Tático)' : 'Desativada'}</strong></span>
                          <span>Revelado: <strong className="text-purple-300">{Math.round((revealedCellsSet.size / ((layerModalMap.gridCols || 24) * (layerModalMap.gridRows || 14))) * 100)}% ({revealedCellsSet.size} blocos)</strong></span>
                        </>
                      )}
                      {inspectorTab === 'ruler' && (
                        <>
                          <span>Régua: <strong className="text-amber-300">{rulerStart && rulerCurrent ? calculateGridDistance(rulerStart, rulerCurrent, layerModalMap.gridCols || 24, layerModalMap.gridRows || 14, layerSettingsForm.gridScale || DEFAULT_GRID_SCALE_CONFIG).formatted : 'Aguardando traçado...'}</strong></span>
                          <span>Grade: <strong className="text-sky-300">{layerSettingsForm.gridScale?.valuePerSquare || 5} {layerSettingsForm.gridScale?.unit || 'ft'} / bloco</strong></span>
                        </>
                      )}
                    </div>
                    <span className="text-white/50">{layerModalMap.gridCols || 24}×{layerModalMap.gridRows || 14} blocos</span>
                  </div>
                </div>
              </div>

              {/* Tab Content Controls */}
              {inspectorTab === 'layers' && (
                <div className="space-y-4 pt-1">
                  {/* Presets Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <span className="text-[11px] font-mono text-parchment/60 uppercase">
                      Configurações Rápidas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          showBackground: true,
                          backgroundOpacity: 100,
                          showGrid: false,
                          gridOpacity: 0,
                          showTokens: false
                        }))}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 transition-all cursor-pointer"
                      >
                        Apenas Imagem (Sem Grade)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          showBackground: false,
                          backgroundOpacity: 0,
                          showGrid: true,
                          gridOpacity: 90,
                          showTokens: true
                        }))}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 transition-all cursor-pointer"
                      >
                        Apenas Grade & Tokens
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          showBackground: true,
                          backgroundOpacity: 100,
                          showGrid: true,
                          gridOpacity: 75,
                          showTokens: true
                        }))}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 transition-all cursor-pointer"
                      >
                        Equilibrado (Padrão)
                      </button>
                    </div>
                  </div>

                  {/* Layer 1: Background Image Controls */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={16} className="text-amber-400" />
                        <span className="text-xs font-bold font-serif text-white">Camada 1: Imagem de Fundo (Background)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs font-mono text-parchment/60">
                          {layerSettingsForm.showBackground ? 'Visível' : 'Oculta'}
                        </span>
                        <input
                          type="checkbox"
                          checked={layerSettingsForm.showBackground}
                          onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, showBackground: e.target.checked }))}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    </div>

                    {layerSettingsForm.showBackground && (
                      <div className="flex items-center gap-4 pt-1">
                        <span className="text-xs font-mono text-parchment/60 w-24 shrink-0">Opacidade: {layerSettingsForm.backgroundOpacity}%</span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={layerSettingsForm.backgroundOpacity}
                          onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, backgroundOpacity: Number(e.target.value) }))}
                          className="flex-1 accent-amber-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Layer 2: Grid Layer Controls */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Grid size={16} className="text-indigo-400" />
                        <span className="text-xs font-bold font-serif text-white">Camada 2: Grade Tática de Batalha (Grid)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs font-mono text-parchment/60">
                          {layerSettingsForm.showGrid ? 'Visível' : 'Oculta'}
                        </span>
                        <input
                          type="checkbox"
                          checked={layerSettingsForm.showGrid}
                          onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, showGrid: e.target.checked }))}
                          className="w-4 h-4 rounded text-indigo-500 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    </div>

                    {layerSettingsForm.showGrid && (
                      <div className="flex items-center gap-4 pt-1">
                        <span className="text-xs font-mono text-parchment/60 w-24 shrink-0">Opacidade: {layerSettingsForm.gridOpacity}%</span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={layerSettingsForm.gridOpacity}
                          onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, gridOpacity: Number(e.target.value) }))}
                          className="flex-1 accent-indigo-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Layer 3: Interactive Tokens Layer */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-arcane" />
                        <span className="text-xs font-bold font-serif text-white">Camada 3: Tokens & Marcadores Interativos</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs font-mono text-parchment/60">
                          {layerSettingsForm.showTokens ? 'Visíveis' : 'Ocultos'}
                        </span>
                        <input
                          type="checkbox"
                          checked={layerSettingsForm.showTokens}
                          onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, showTokens: e.target.checked }))}
                          className="w-4 h-4 rounded text-arcane focus:ring-0 cursor-pointer"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-parchment/50">
                      Quando ativo, os tokens de personagens, monstros e pontos de interesse são renderizados sobre a grade do mapa.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab Content: Névoa de Guerra (Fog of War) */}
              {inspectorTab === 'fog' && (
                <div className="space-y-4 pt-1">
                  {/* Master Fog Toggle & Brush Modes */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CloudFog size={18} className="text-purple-400" />
                          <span className="text-sm font-bold font-serif text-white">Névoa de Guerra Tática (Fog of War)</span>
                        </div>
                        <p className="text-xs text-parchment/60 mt-0.5">
                          Oculta salas e terrenos não explorados. Apenas áreas reveladas pelo Mestre ficam visíveis para os jogadores.
                        </p>
                      </div>

                      <label className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-purple-900/30 border border-purple-500/40 cursor-pointer">
                        <span className="text-xs font-mono font-bold text-purple-200">
                          {layerSettingsForm.fogEnabled ? 'Névoa Ativada' : 'Névoa Desativada'}
                        </span>
                        <input
                          type="checkbox"
                          checked={!!layerSettingsForm.fogEnabled}
                          onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, fogEnabled: e.target.checked }))}
                          className="w-4 h-4 rounded text-purple-500 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Brush Mode & Size Toolbar */}
                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                      {/* Mode: Reveal vs Hide */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-parchment/60">Modo de Pintura:</span>
                        <div className="flex rounded-xl bg-black/40 border border-white/10 p-0.5">
                          <button
                            type="button"
                            onClick={() => setFogBrushMode('reveal')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                              fogBrushMode === 'reveal'
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                                : "text-parchment/60 hover:text-white"
                            )}
                          >
                            <Eraser size={14} />
                            <span>Revelar Área</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFogBrushMode('hide')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                              fogBrushMode === 'hide'
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                                : "text-parchment/60 hover:text-white"
                            )}
                          >
                            <Paintbrush size={14} />
                            <span>Ocultar com Névoa</span>
                          </button>
                        </div>
                      </div>

                      {/* Brush Size */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-parchment/60">Tamanho do Pincel:</span>
                        <div className="flex rounded-xl bg-black/40 border border-white/10 p-0.5">
                          <button
                            type="button"
                            onClick={() => setFogBrushSize(1)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                              fogBrushSize === 1 ? "bg-white/20 text-white" : "text-parchment/50 hover:text-white"
                            )}
                          >
                            1 Bloco
                          </button>
                          <button
                            type="button"
                            onClick={() => setFogBrushSize(2)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                              fogBrushSize === 2 ? "bg-white/20 text-white" : "text-parchment/50 hover:text-white"
                            )}
                          >
                            3×3 Blocos
                          </button>
                          <button
                            type="button"
                            onClick={() => setFogBrushSize(3)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                              fogBrushSize === 3 ? "bg-white/20 text-white" : "text-parchment/50 hover:text-white"
                            )}
                          >
                            5×5 Blocos
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Fog Opacity Slider */}
                    <div className="flex items-center gap-4 pt-1">
                      <span className="text-xs font-mono text-parchment/60 w-32 shrink-0">
                        Densidade da Névoa: {layerSettingsForm.fogOpacity ?? 85}%
                      </span>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={layerSettingsForm.fogOpacity ?? 85}
                        onChange={(e) => setLayerSettingsForm(prev => ({ ...prev, fogOpacity: Number(e.target.value) }))}
                        className="flex-1 accent-purple-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Quick Action Fog Buttons */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                    <span className="text-[11px] font-mono text-parchment/60 uppercase">
                      Ações Rápidas de Névoa:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={handleRevealEntranceFog}
                        className="p-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Revela apenas a área ao redor da entrada inicial"
                      >
                        <Eye size={13} />
                        <span>Revelar Entrada</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRevealAllFog}
                        className="p-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Revela todo o mapa de uma vez"
                      >
                        <Sparkles size={13} />
                        <span>Revelar Tudo</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleHideAllFog}
                        className="p-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Cobre 100% do mapa com escuridão"
                      >
                        <EyeOff size={13} />
                        <span>Cobrir Tudo</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleInvertFog}
                        className="p-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-sky-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Inverte áreas ocultas e reveladas"
                      >
                        <RotateCcw size={13} />
                        <span>Inverter Névoa</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Régua & Medição de Distância (Distance Measurement Tool) */}
              {inspectorTab === 'ruler' && (
                <div className="space-y-4 pt-1">
                  {/* Grid Scale Configuration Box */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Ruler size={18} className="text-amber-400" />
                        <span className="text-sm font-bold font-serif text-white">Escala da Grade Tática & Medição</span>
                      </div>
                      <span className="text-xs font-mono text-parchment/60">
                        {layerModalMap.gridCols || 24} colunas × {layerModalMap.gridRows || 14} linhas
                      </span>
                    </div>
                    <p className="text-xs text-parchment/60">
                      Configure a escala de cada quadrado da grade. Ao arrastar no mapa acima, as distâncias em linha reta e alcance de magias serão calculados automaticamente.
                    </p>

                    {/* Scale Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] font-mono text-parchment/60 uppercase mb-1">
                          Unidade de Medida
                        </label>
                        <select
                          value={layerSettingsForm.gridScale?.unit || 'ft'}
                          onChange={(e) => {
                            const newUnit = e.target.value as any;
                            setLayerSettingsForm(prev => ({
                              ...prev,
                              gridScale: {
                                ...(prev.gridScale || DEFAULT_GRID_SCALE_CONFIG),
                                unit: newUnit
                              }
                            }));
                          }}
                          className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          <option value="ft">Pés / Feet (ft) - Padrão D&D 5e</option>
                          <option value="m">Metros (m) - Sistema Métrico</option>
                          <option value="sq">Quadrados / Blocos (sq)</option>
                          <option value="km">Quilômetros (km) - Mapa Regional</option>
                          <option value="mi">Milhas (mi) - Mapa Continental</option>
                          <option value="leagues">Léguas (leagues) - Náutico / Fantasia</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-parchment/60 uppercase mb-1">
                          Valor por Quadrado/Bloco
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.1"
                          max="10000"
                          value={layerSettingsForm.gridScale?.valuePerSquare || 5}
                          onChange={(e) => {
                            const val = Math.max(0.1, Number(e.target.value) || 1);
                            setLayerSettingsForm(prev => ({
                              ...prev,
                              gridScale: {
                                ...(prev.gridScale || DEFAULT_GRID_SCALE_CONFIG),
                                valuePerSquare: val
                              }
                            }));
                          }}
                          className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Scale Presets Bar */}
                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-mono text-parchment/60 mr-1">Predefinições:</span>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          gridScale: { unit: 'ft', valuePerSquare: 5 }
                        }))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 transition-all cursor-pointer"
                      >
                        D&D 5e (5 ft)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          gridScale: { unit: 'm', valuePerSquare: 1.5 }
                        }))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 transition-all cursor-pointer"
                      >
                        Métrico (1.5 m)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          gridScale: { unit: 'm', valuePerSquare: 1 }
                        }))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-sky-300 transition-all cursor-pointer"
                      >
                        Tático GURPS (1 m)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          gridScale: { unit: 'km', valuePerSquare: 10 }
                        }))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 transition-all cursor-pointer"
                      >
                        Regional (10 km)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayerSettingsForm(prev => ({
                          ...prev,
                          gridScale: { unit: 'leagues', valuePerSquare: 5 }
                        }))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-indigo-300 transition-all cursor-pointer"
                      >
                        Náutico (5 léguas)
                      </button>
                    </div>
                  </div>

                  {/* Measurement Readout Card */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                    {rulerStart && rulerCurrent ? (
                      (() => {
                        const dist = calculateGridDistance(
                          rulerStart, 
                          rulerCurrent, 
                          layerModalMap.gridCols || 24, 
                          layerModalMap.gridRows || 14, 
                          layerSettingsForm.gridScale || DEFAULT_GRID_SCALE_CONFIG
                        );
                        return (
                          <>
                            <div className="space-y-1">
                              <div className="text-[11px] font-mono uppercase text-amber-300/80">
                                Resultado da Medição Atual:
                              </div>
                              <div className="text-xl font-serif font-bold text-white flex items-center gap-2">
                                <span className="text-amber-400">{dist.formatted}</span>
                                <span className="text-xs font-mono text-parchment/60">
                                  ({dist.squares.toFixed(1)} blocos euclidianos)
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setRulerStart(null);
                                setRulerCurrent(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
                            >
                              Limpar Traçado
                            </button>
                          </>
                        );
                      })()
                    ) : (
                      <div className="flex items-center gap-3">
                        <Crosshair size={22} className="text-amber-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-white">Nenhum traçado ativo</div>
                          <p className="text-[11px] text-parchment/60">
                            Clique e arraste sobre o mapa acima para traçar uma linha reta e medir distâncias ou alcances de ataques e magias.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setLayerModalMap(null)}
                  disabled={isSavingLayers}
                  className="px-4 py-2.5 rounded-xl text-xs hover:bg-white/10 text-parchment/60 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveLayerSettings}
                  disabled={isSavingLayers}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingLayers ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando Configuração...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Salvar Configurações & Névoa</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Custom Map Modal */}
      <AnimatePresence>
        {editingMap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-obsidian border border-arcane/40 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto text-parchment space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-white">
                      Editar Mapa Personalizado
                    </h3>
                    <p className="text-xs text-parchment/60 font-mono">
                      {editingMap.type === 'world' ? 'Mapa do Mundo' : 'Battlemap de Masmorra'} • {editingMap.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMap(null)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditedMap} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Nome do Mapa *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-parchment focus:outline-none focus:border-arcane"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Subtítulo / Descrição
                    </label>
                    <input
                      type="text"
                      value={editSubtitle}
                      onChange={(e) => setEditSubtitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-parchment focus:outline-none focus:border-arcane"
                    />
                  </div>
                </div>

                {/* Campaign assignment & visibility */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Campanha Vinculada
                    </label>
                    <select
                      value={editSessionId}
                      onChange={(e) => setEditSessionId(e.target.value)}
                      className="w-full bg-obsidian border border-white/15 rounded-xl px-3.5 py-2 text-xs text-parchment focus:outline-none focus:border-arcane"
                    >
                      <option value="">Global / Todas as Campanhas</option>
                      {gmSessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'Campanha'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Visibilidade para os Jogadores
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditActive(!editActive)}
                      className={cn(
                        "w-full py-2 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer",
                        editActive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      )}
                    >
                      {editActive ? (
                        <>
                          <Eye size={15} />
                          <span>Ativo (Visível na ficha do personagem)</span>
                        </>
                      ) : (
                        <>
                          <EyeOff size={15} />
                          <span>Desativado (Oculto dos jogadores)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Image source / replacement */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60">
                      Imagem do Mapa (Link direto ou Enviar Arquivo)
                    </label>
                    {editDimensions && (
                      <span className="text-[10px] font-mono text-arcane bg-arcane/10 border border-arcane/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Ratio size={11} />
                        <span>Dimensão: <strong>{editDimensions.ratioStr}</strong></span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-8">
                      <input
                        type="url"
                        value={editImageUrl.startsWith('data:') ? '' : editImageUrl}
                        onChange={(e) => {
                          setEditImageUrl(e.target.value);
                          measureEditImageDimensions(e.target.value);
                        }}
                        placeholder="Link direto ou envie um arquivo ao lado"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-arcane font-mono"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEditFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={isCompressingEditImage}
                        className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-parchment border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isCompressingEditImage ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-arcane" />
                            <span>Comprimindo...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} className="text-arcane" />
                            <span>Substituir Imagem</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {editImageUrl && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex items-center justify-center">
                      <img src={editImageUrl} alt="Prévia do Mapa" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>

                {/* Specific fields: Dungeon vs World */}
                {editingMap.type === 'world' ? (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Escala Cartográfica
                    </label>
                    <input
                      type="text"
                      value={editScale}
                      onChange={(e) => setEditScale(e.target.value)}
                      placeholder="Ex: 1 cm = 30 léguas"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-arcane"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                          Tema da Masmorra
                        </label>
                        <input
                          type="text"
                          value={editTheme}
                          onChange={(e) => setEditTheme(e.target.value)}
                          placeholder="Ex: Cripta, Ruínas"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-arcane"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                          Colunas da Grade (X)
                        </label>
                        <input
                          type="number"
                          min="6"
                          max="80"
                          value={editGridCols}
                          onChange={(e) => setEditGridCols(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-arcane"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                          Linhas da Grade (Y)
                        </label>
                        <input
                          type="number"
                          min="6"
                          max="60"
                          value={editGridRows}
                          onChange={(e) => setEditGridRows(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-arcane"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div>
                      <span className="text-[10px] font-mono text-parchment/50 uppercase block mb-1">
                        Atalhos de Proporção:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { label: '16:9 Padrão (24×14)', cols: 24, rows: 14 },
                          { label: 'Quadrado (24×24)', cols: 24, rows: 24 },
                          { label: 'Vertical (14×24)', cols: 14, rows: 24 },
                          { label: 'Panorâmico (32×12)', cols: 32, rows: 12 },
                          { label: 'Grande (36×20)', cols: 36, rows: 20 },
                        ].map(p => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => {
                              setEditGridCols(p.cols);
                              setEditGridRows(p.rows);
                            }}
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer border",
                              editGridCols === p.cols && editGridRows === p.rows
                                ? "bg-purple-500/30 text-purple-200 border-purple-400 font-bold"
                                : "bg-white/5 text-parchment/60 hover:text-white border-white/10"
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setEditingMap(null)}
                    disabled={isUpdatingMap}
                    className="px-4 py-2 rounded-xl text-xs hover:bg-white/10 text-parchment/60 cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingMap || isCompressingEditImage}
                    className="px-6 py-2 rounded-xl text-xs font-bold bg-arcane text-obsidian hover:opacity-90 disabled:opacity-50 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    {isUpdatingMap ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Salvando Alterações...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Salvar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Custom Map Confirmation Modal */}
      <AnimatePresence>
        {mapToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-obsidian border border-red-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-parchment"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-bold text-white mb-1">
                    Excluir Mapa
                  </h3>
                  <p className="text-xs text-parchment/60 font-mono">
                    Ação irreversível de mestre
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 mb-6 text-xs">
                <p>
                  Tem certeza que deseja excluir o mapa personalizado <strong>"{mapToDelete.name}"</strong>?
                </p>
                <p className="text-parchment/50">
                  Este mapa será removido permanentemente e os jogadores não poderão mais acessá-lo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMapToDelete(null)}
                  disabled={isDeletingMap}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-semibold hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCustomMap}
                  disabled={isDeletingMap}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingMap ? 'Excluindo...' : 'Sim, Excluir Mapa'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Sketch and AI Rendering Studio Modal */}
      <MapSketchStudio
        isOpen={isSketchStudioOpen}
        onClose={() => setIsSketchStudioOpen(false)}
        selectedSessionId={selectedSessionId}
        gmSessions={gmSessions}
        onMapSaved={(newMap) => {
          setStatusMessage({
            type: 'success',
            text: `Novo mapa "${newMap.name}" criado com sucesso e adicionado à campanha!`,
          });
          setTimeout(() => setStatusMessage(null), 4000);
        }}
      />
    </div>
  );
}
