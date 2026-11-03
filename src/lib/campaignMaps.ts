import aethelgardMap from '../assets/images/fantasy_world_map_1791537797619.jpg';
import archipelagoMap from '../assets/images/archipelago_fantasy_map_1791537811804.jpg';
import catacombsMap from '../assets/images/dungeon_catacombs_map_1791542484088.jpg';
import templeMap from '../assets/images/dungeon_temple_map_1791542504225.jpg';
import cavernMap from '../assets/images/dungeon_cavern_map_1791542526527.jpg';
import genericWorldThumb from '../assets/images/generic_world_thumb_1791714431471.jpg';
import genericDungeonThumb from '../assets/images/generic_dungeon_thumb_1791714444150.jpg';
import { db, doc, updateDoc, setDoc } from '../firebase';

// High-fidelity thematic generic thumbnails for players (protects adventure secrets and layout spoilers)
export const GENERIC_WORLD_THUMB = genericWorldThumb;
export const GENERIC_DUNGEON_THUMB = genericDungeonThumb;

export interface MapGridScaleConfig {
  unit: 'ft' | 'm' | 'squares' | 'km' | 'mi' | 'leagues';
  unitLabel: string;
  valuePerSquare: number;
}

export const DEFAULT_GRID_SCALE_CONFIG: MapGridScaleConfig = {
  unit: 'ft',
  unitLabel: 'pés (ft)',
  valuePerSquare: 5
};

export interface MapLayerSettings {
  showBackground: boolean;
  backgroundOpacity: number; // 0 to 100
  showGrid: boolean;
  gridOpacity: number; // 0 to 100
  showTokens: boolean;
  // Fog of War secondary overlay layer
  fogEnabled?: boolean;
  fogOpacity?: number; // 0 to 100
  revealedCells?: number[]; // Array of revealed cell indices
  // Configurable Grid Scale for measurement
  gridScale?: MapGridScaleConfig;
}

export const DEFAULT_LAYER_SETTINGS: MapLayerSettings = {
  showBackground: true,
  backgroundOpacity: 100,
  showGrid: true,
  gridOpacity: 75,
  showTokens: true,
  fogEnabled: false,
  fogOpacity: 90,
  revealedCells: [],
  gridScale: DEFAULT_GRID_SCALE_CONFIG
};

export function calculateGridDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  gridCols: number = 24,
  gridRows: number = 14,
  scale: MapGridScaleConfig = DEFAULT_GRID_SCALE_CONFIG
): {
  squares: number;
  totalDistance: number;
  formatted: string;
  dxSquares: number;
  dySquares: number;
} {
  const cellWidthPct = 100 / (gridCols || 24);
  const cellHeightPct = 100 / (gridRows || 14);

  const dxSquares = Math.abs(p2.x - p1.x) / cellWidthPct;
  const dySquares = Math.abs(p2.y - p1.y) / cellHeightPct;
  const squares = Math.sqrt(dxSquares * dxSquares + dySquares * dySquares);
  const roundedSquares = Math.round(squares * 10) / 10;
  const totalDistance = Math.round(squares * (scale?.valuePerSquare || 5) * 10) / 10;

  const unit = scale?.unit || 'ft';
  let formatted = '';
  if (unit === 'ft') {
    const meters = Math.round(totalDistance * 0.3048 * 10) / 10;
    formatted = `${roundedSquares} quad. • ${totalDistance} pés (${meters}m)`;
  } else if (unit === 'm') {
    formatted = `${roundedSquares} quad. • ${totalDistance} metros`;
  } else if (unit === 'km') {
    formatted = `${roundedSquares} quad. • ${totalDistance} km`;
  } else if (unit === 'mi') {
    formatted = `${roundedSquares} quad. • ${totalDistance} milhas`;
  } else if (unit === 'leagues') {
    formatted = `${roundedSquares} quad. • ${totalDistance} léguas`;
  } else {
    formatted = `${roundedSquares} blocos`;
  }

  return {
    squares: roundedSquares,
    totalDistance,
    formatted,
    dxSquares: Math.round(dxSquares * 10) / 10,
    dySquares: Math.round(dySquares * 10) / 10
  };
}

export interface CampaignMapItem {
  id: string;
  name: string;
  subtitle: string;
  type: 'world' | 'dungeon';
  imageUrl: string;
  genericThumbUrl?: string;
  active: boolean; // Controlled by GM: true = active (visible to players), false = deactivated (hidden)
  theme?: string;
  gridCols?: number;
  gridRows?: number;
  entranceCoord?: { x: number; y: number };
  defaultScale?: string;
  isCustom?: boolean;
  sessionId?: string;
  createdBy?: string;
  layerSettings?: MapLayerSettings;
}

/**
 * Returns the thumbnail for a campaign map:
 * - For Players (!isGM): Always returns the generic, spoiler-free thumbnail
 *   (sealed antique parchment for World maps, mysterious dark dungeon archway for Dungeon maps)
 *   so adventure secrets and layout spoilers are never revealed to players.
 * - For GMs (isGM): Returns the actual map layout image so the GM can identify and manage it.
 */
export function getMapThumbnail(
  map: { type: 'world' | 'dungeon'; imageUrl?: string; genericThumbUrl?: string },
  isGM: boolean = false
): string {
  if (isGM) {
    return map.imageUrl || (map.type === 'world' ? GENERIC_WORLD_THUMB : GENERIC_DUNGEON_THUMB);
  }
  return map.genericThumbUrl || (map.type === 'world' ? GENERIC_WORLD_THUMB : GENERIC_DUNGEON_THUMB);
}

// Built-in Presets for World Maps
export const DEFAULT_WORLD_PRESETS: CampaignMapItem[] = [
  {
    id: 'aethelgard',
    name: 'Continente de Aethelgard',
    subtitle: 'Reinos Antigos, Florestas Místicas & Picos Gelados',
    type: 'world',
    imageUrl: aethelgardMap,
    active: true,
    defaultScale: '1 cm = 50 milhas'
  },
  {
    id: 'archipelago',
    name: 'As Ilhas Despedaçadas',
    subtitle: 'Arquipélago Pirata, Recifes Mortais & Mares Bravios',
    type: 'world',
    imageUrl: archipelagoMap,
    active: true,
    defaultScale: '1 cm = 30 léguas'
  }
];

// Built-in Presets for Dungeon Maps
export const DEFAULT_DUNGEON_PRESETS: CampaignMapItem[] = [
  {
    id: 'catacombs',
    name: 'Catacumbas Antigas de Khardoos',
    subtitle: 'Cripta subterrânea ancestral com câmaras secretas, sarcófagos e corredores estreitos',
    theme: 'Subterrâneo & Cripta',
    type: 'dungeon',
    imageUrl: catacombsMap,
    active: true,
    gridCols: 24,
    gridRows: 14,
    entranceCoord: { x: 8.5, y: 35.0 }
  },
  {
    id: 'temple',
    name: 'Templo Subterrâneo Arcano',
    subtitle: 'Ruínas místicas com círculos rúnicos brilhantes, cristais e piscinas de mana',
    theme: 'Místico & Arcano',
    type: 'dungeon',
    imageUrl: templeMap,
    active: true,
    gridCols: 24,
    gridRows: 14,
    entranceCoord: { x: 50.0, y: 88.0 }
  },
  {
    id: 'cavern',
    name: 'Covil Vulcânico do Dragão',
    subtitle: 'Caverna natural com rios de magma fervente, pontes de pedra e pilhas de tesouro',
    theme: 'Ígneo & Letal',
    type: 'dungeon',
    imageUrl: cavernMap,
    active: true,
    gridCols: 24,
    gridRows: 14,
    entranceCoord: { x: 10.0, y: 80.0 }
  }
];

/**
 * Resolves all maps (World & Dungeon) for a given campaign, applying GM activation settings.
 */
export function resolveCampaignMaps(
  sessionData: any | null,
  customDungeonMaps: any[] = [],
  customWorldMaps: any[] = []
): {
  worldMaps: CampaignMapItem[];
  dungeonMaps: CampaignMapItem[];
} {
  const mapSettings = sessionData?.mapSettings || {};

  // Build World Maps: custom maps appear FIRST so user-created maps take center stage
  const worldMaps: CampaignMapItem[] = [
    ...customWorldMaps.map(m => {
      const customSetting = mapSettings[m.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : (m.active !== false);
      const layerSettings: MapLayerSettings = customSetting?.layerSettings || m.layerSettings || DEFAULT_LAYER_SETTINGS;
      return {
        id: m.id,
        name: m.name || 'Mapa do Mundo Personalizado',
        subtitle: m.subtitle || 'Mapa personalizado da campanha',
        type: 'world' as const,
        imageUrl: m.imageUrl,
        active: isActive,
        isCustom: true,
        sessionId: m.sessionId,
        createdBy: m.createdBy,
        layerSettings
      };
    }),
    ...DEFAULT_WORLD_PRESETS.map(preset => {
      const customSetting = mapSettings[preset.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : preset.active;
      const layerSettings: MapLayerSettings = customSetting?.layerSettings || preset.layerSettings || DEFAULT_LAYER_SETTINGS;
      return {
        ...preset,
        active: isActive,
        layerSettings
      };
    })
  ];

  // Build Dungeon Maps: custom maps appear FIRST so user-created dungeons take center stage
  const dungeonMaps: CampaignMapItem[] = [
    ...customDungeonMaps.map(m => {
      const customSetting = mapSettings[m.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : (m.active !== false);
      const layerSettings: MapLayerSettings = customSetting?.layerSettings || m.layerSettings || DEFAULT_LAYER_SETTINGS;
      return {
        id: m.id,
        name: m.name || 'Masmorra Personalizada',
        subtitle: m.subtitle || 'Mapa tático personalizado criado pelo Mestre',
        theme: m.theme || 'Personalizado',
        type: 'dungeon' as const,
        imageUrl: m.imageUrl,
        gridCols: Number(m.gridCols) || 24,
        gridRows: Number(m.gridRows) || 14,
        entranceCoord: m.entranceCoord || { x: 10, y: 50 },
        active: isActive,
        isCustom: true,
        sessionId: m.sessionId,
        createdBy: m.createdBy,
        layerSettings
      };
    }),
    ...DEFAULT_DUNGEON_PRESETS.map(preset => {
      const customSetting = mapSettings[preset.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : preset.active;
      const layerSettings: MapLayerSettings = customSetting?.layerSettings || preset.layerSettings || DEFAULT_LAYER_SETTINGS;
      return {
        ...preset,
        active: isActive,
        layerSettings
      };
    })
  ];

  return { worldMaps, dungeonMaps };
}

/**
 * Filter maps based on user role:
 * - GMs see all maps with their active status badge.
 * - Players only see maps that are active.
 */
export function filterMapsForUserRole(maps: CampaignMapItem[], isGM: boolean): CampaignMapItem[] {
  if (isGM) return maps;
  return maps.filter(m => m.active);
}

/**
 * Persists map activation state to Firestore gameSession and custom map doc.
 */
export async function toggleCampaignMapActive(
  sessionId: string,
  mapId: string,
  currentActive: boolean,
  isCustom?: boolean,
  type?: 'world' | 'dungeon'
): Promise<void> {
  if (!sessionId) return;
  const sessionRef = doc(db, 'gameSessions', sessionId);
  await updateDoc(sessionRef, {
    [`mapSettings.${mapId}.active`]: !currentActive
  });
  if (isCustom) {
    try {
      const col = type === 'world' ? 'worldMaps' : 'dungeonMaps';
      await updateDoc(doc(db, col, mapId), {
        active: !currentActive
      });
    } catch (e) {
      console.warn('Could not update custom map doc active state:', e);
    }
  }
}

/**
 * Sets map active state explicitly.
 */
export async function setCampaignMapActive(
  sessionId: string,
  mapId: string,
  active: boolean,
  isCustom?: boolean,
  type?: 'world' | 'dungeon'
): Promise<void> {
  if (!sessionId) return;
  const sessionRef = doc(db, 'gameSessions', sessionId);
  await updateDoc(sessionRef, {
    [`mapSettings.${mapId}.active`]: active
  });
  if (isCustom) {
    try {
      const col = type === 'world' ? 'worldMaps' : 'dungeonMaps';
      await updateDoc(doc(db, col, mapId), {
        active: active
      });
    } catch (e) {
      console.warn('Could not update custom map doc active state:', e);
    }
  }
}

/**
 * Deletes a custom map created for a campaign.
 */
export async function deleteCampaignCustomMap(
  mapId: string,
  type: 'world' | 'dungeon'
): Promise<void> {
  const { deleteDoc } = await import('../firebase');
  const col = type === 'world' ? 'worldMaps' : 'dungeonMaps';
  await deleteDoc(doc(db, col, mapId));
}

/**
 * Persists map layer configuration (background, grid, tokens)
 * both to Firestore and localStorage cache.
 */
export async function saveMapLayerSettings(
  mapId: string,
  type: 'world' | 'dungeon',
  layerSettings: MapLayerSettings,
  sessionId?: string,
  isCustom?: boolean
): Promise<void> {
  try {
    // 1. Local storage cache for zero-latency retrieval
    try {
      localStorage.setItem(`map_layers_${mapId}`, JSON.stringify(layerSettings));
    } catch (_) {}

    // 2. Persist to gameSession if a session is selected
    if (sessionId) {
      try {
        const sessionRef = doc(db, 'gameSessions', sessionId);
        await updateDoc(sessionRef, {
          [`mapSettings.${mapId}.layerSettings`]: layerSettings
        });
      } catch (e) {
        console.warn('Could not save layerSettings to session:', e);
      }
    }

    // 3. Persist to custom map document in Firestore if it is custom
    if (isCustom !== false) {
      try {
        const col = type === 'world' ? 'worldMaps' : 'dungeonMaps';
        await updateDoc(doc(db, col, mapId), {
          layerSettings: layerSettings,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Could not save layerSettings to map doc:', e);
      }
    }

    // 4. If fog settings are present, also sync directly with dungeonFog collection
    if (layerSettings.fogEnabled !== undefined || layerSettings.revealedCells) {
      try {
        const fogRef = doc(db, 'dungeonFog', mapId);
        await setDoc(fogRef, {
          dungeonId: mapId,
          enabled: Boolean(layerSettings.fogEnabled),
          revealedCells: layerSettings.revealedCells || [],
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Could not synchronize dungeonFog document:', e);
      }
    }
  } catch (err) {
    console.error('Failed to save layerSettings:', err);
    throw err;
  }
}

