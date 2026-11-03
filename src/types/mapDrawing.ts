/**
 * Types for Map Freehand Drawing, Markers, and Real-time Pings
 * Used across World Map and Dungeon & Tokens Map
 */

export interface MapDrawingStroke {
  id: string;
  mapId: string;
  sessionId?: string;
  points: Array<{ x: number; y: number }>; // Percentage coordinates (0 - 100%)
  color: string;
  size: number; // width in pixels
  authorId: string;
  authorName: string;
  createdAt: number;
  isClosed?: boolean;
  fillColor?: string;
  isPolygon?: boolean;
}

export type DrawingTool = 'none' | 'pen' | 'polygon' | 'eraser' | 'ping';

export interface WorldMapPingData {
  id: string;
  mapId: string;
  sessionId?: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  userId: string;
  userName: string;
  color: string;
  timestamp: number;
}

export interface DungeonMapMarker {
  id: string;
  mapId: string;
  sessionId?: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  label: string;
  category: 'poi' | 'trap' | 'treasure' | 'danger' | 'door' | 'note' | 'target';
  description?: string;
  color?: string;
  authorId: string;
  authorName: string;
  createdAt: number;
}
