import aethelgardMap from '../assets/images/fantasy_world_map_1791537797619.jpg';
import archipelagoMap from '../assets/images/archipelago_fantasy_map_1791537811804.jpg';
import catacombsMap from '../assets/images/dungeon_catacombs_map_1791542484088.jpg';
import templeMap from '../assets/images/dungeon_temple_map_1791542504225.jpg';
import cavernMap from '../assets/images/dungeon_cavern_map_1791542526527.jpg';
import genericWorldThumb from '../assets/images/generic_world_thumb_1791714431471.jpg';
import genericDungeonThumb from '../assets/images/generic_dungeon_thumb_1791714444150.jpg';
import { db, doc, updateDoc } from '../firebase';

// High-fidelity thematic generic thumbnails for players (protects adventure secrets and layout spoilers)
export const GENERIC_WORLD_THUMB = genericWorldThumb;
export const GENERIC_DUNGEON_THUMB = genericDungeonThumb;

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

  // Build World Maps
  const worldMaps: CampaignMapItem[] = [
    ...DEFAULT_WORLD_PRESETS.map(preset => {
      const customSetting = mapSettings[preset.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : preset.active;
      return {
        ...preset,
        active: isActive
      };
    }),
    ...customWorldMaps.map(m => {
      const customSetting = mapSettings[m.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : (m.active !== false);
      return {
        id: m.id,
        name: m.name || 'Mapa do Mundo Personalizado',
        subtitle: m.subtitle || 'Mapa personalizado da campanha',
        type: 'world' as const,
        imageUrl: m.imageUrl,
        active: isActive,
        isCustom: true,
        sessionId: m.sessionId,
        createdBy: m.createdBy
      };
    })
  ];

  // Build Dungeon Maps
  const dungeonMaps: CampaignMapItem[] = [
    ...DEFAULT_DUNGEON_PRESETS.map(preset => {
      const customSetting = mapSettings[preset.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : preset.active;
      return {
        ...preset,
        active: isActive
      };
    }),
    ...customDungeonMaps.map(m => {
      const customSetting = mapSettings[m.id];
      const isActive = customSetting?.active !== undefined ? Boolean(customSetting.active) : (m.active !== false);
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
        createdBy: m.createdBy
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
