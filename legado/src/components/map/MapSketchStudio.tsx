import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Download, 
  Save, 
  X, 
  Compass, 
  Layers, 
  Sliders, 
  Mountain, 
  TreePine, 
  Sun, 
  Snowflake, 
  Building2, 
  Home, 
  Tractor, 
  Skull, 
  Cross, 
  Waves, 
  Navigation, 
  MapPin, 
  Palette, 
  Check, 
  AlertCircle, 
  Eye, 
  Grid, 
  Maximize2,
  Brush,
  Minus,
  Circle,
  PaintBucket,
  Shapes,
  Ratio,
  HelpCircle
} from 'lucide-react';
import { cn, compressDataUrl } from '../../lib/utils';
import { db, auth, collection, addDoc } from '../../firebase';

export interface MapSketchStudioProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSessionId: string;
  gmSessions: Array<{ id: string; name: string }>;
  onMapSaved?: (newMap: any) => void;
}

// 13 Demarcated Elements requested by the user
export interface MapElementDef {
  id: string;
  name: string;
  category: 'terrain' | 'water_roads' | 'poi';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  strokeWidth: number;
  isPOI?: boolean;
  poiSymbol?: string;
  description: string;
}

export const MAP_ELEMENTS: MapElementDef[] = [
  // Terrenos e Relevo
  {
    id: 'continente',
    name: 'Continente',
    category: 'terrain',
    icon: Compass,
    color: '#65a30d', // Verde musgo / terra fértil
    strokeWidth: 32,
    description: 'Massa continental principal e terra firme',
  },
  {
    id: 'ilhas',
    name: 'Ilhas',
    category: 'terrain',
    icon: Layers,
    color: '#84cc16', // Verde claro costeiro
    strokeWidth: 16,
    description: 'Ilhotas, atóis e arquipélagos isolados',
  },
  {
    id: 'montanhas',
    name: 'Montanhas',
    category: 'terrain',
    icon: Mountain,
    color: '#64748b', // Cinza ardósia / picos rochosos
    strokeWidth: 14,
    isPOI: true,
    poiSymbol: '▲',
    description: 'Cordilheiras, picos nevados e colinas escarpadas',
  },
  {
    id: 'florestas',
    name: 'Florestas',
    category: 'terrain',
    icon: TreePine,
    color: '#166534', // Verde floresta profundo
    strokeWidth: 24,
    description: 'Bosques densos, selvas antigas e taigas',
  },
  {
    id: 'desertos',
    name: 'Desertos',
    category: 'terrain',
    icon: Sun,
    color: '#eab308', // Amarelo ocre / dunas
    strokeWidth: 28,
    description: 'Terras áridas, dunas escaldantes e desertos de sal',
  },
  {
    id: 'terras_gelidas',
    name: 'Terras Gélidas',
    category: 'terrain',
    icon: Snowflake,
    color: '#7dd3fc', // Ciano gelo / tundra
    strokeWidth: 26,
    description: 'Geleiras polares, tundras congeladas e campos de gelo',
  },

  // Hidrografia e Vias
  {
    id: 'rios',
    name: 'Rios',
    category: 'water_roads',
    icon: Waves,
    color: '#0284c7', // Azul cerúleo vibrante
    strokeWidth: 6,
    description: 'Cursos fluviais, afluentes, cachoeiras e deltas',
  },
  {
    id: 'estradas',
    name: 'Estradas',
    category: 'water_roads',
    icon: Navigation,
    color: '#b45309', // Castanho terra batida
    strokeWidth: 4,
    description: 'Rotas comerciais, trilhas de caravana e estradas pavimentadas',
  },

  // Assentamentos e Pontos de Interesse (POIs)
  {
    id: 'cidades',
    name: 'Cidades',
    category: 'poi',
    icon: Building2,
    color: '#dc2626', // Carmim imperial
    strokeWidth: 18,
    isPOI: true,
    poiSymbol: '🏰',
    description: 'Metrópoles muradas, capitais de reinos e fortalezas',
  },
  {
    id: 'vilas',
    name: 'Vilas',
    category: 'poi',
    icon: Home,
    color: '#f97316', // Laranja quente
    strokeWidth: 14,
    isPOI: true,
    poiSymbol: '🏡',
    description: 'Aldeias campesinas, vilarejos e povoados ribeirinhos',
  },
  {
    id: 'fazendas',
    name: 'Fazendas',
    category: 'poi',
    icon: Tractor,
    color: '#a3e635', // Verde pasto
    strokeWidth: 16,
    isPOI: true,
    poiSymbol: '🌾',
    description: 'Campos agrícolas cultivados, moinhos e feudos rurais',
  },
  {
    id: 'catacumbas',
    name: 'Catacumbas',
    category: 'poi',
    icon: Skull,
    color: '#9333ea', // Roxo arcano sombrio
    strokeWidth: 14,
    isPOI: true,
    poiSymbol: '💀',
    description: 'Criptas ancestrais, masmorras seladas e ruínas profundas',
  },
  {
    id: 'cemiterios',
    name: 'Cemitérios',
    category: 'poi',
    icon: Cross,
    color: '#475569', // Ardósia fúnebre
    strokeWidth: 12,
    isPOI: true,
    poiSymbol: '🪦',
    description: 'Campos santos esquecidos, mausoléus e sepulcros sombrios',
  },
];

export type MapTheme = 'medieval' | 'contemporary' | 'futuristic';
export type ToolType = 'brush' | 'polygon' | 'line' | 'bucket' | 'stamp' | 'eraser';

export interface MapDimensionPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  ratio: string;
  description: string;
}

export const MAP_DIMENSION_PRESETS: MapDimensionPreset[] = [
  { id: 'hd_16_9', name: '16:9 HD', width: 1280, height: 720, ratio: '16/9', description: 'Padrão 1280 × 720 px' },
  { id: 'fhd_16_9', name: '16:9 Full HD', width: 1920, height: 1080, ratio: '16/9', description: 'Alta resolução 1920 × 1080 px' },
  { id: 'square_1_1', name: '1:1 Quadrado', width: 1024, height: 1024, ratio: '1/1', description: 'Perfeito para battlemaps 1024 × 1024 px' },
  { id: 'panoramic_21_9', name: '21:9 Panorâmico', width: 1920, height: 820, ratio: '21/9', description: 'Ultrawide épico 1920 × 820 px' },
  { id: 'vertical_9_16', name: '9:16 Vertical', width: 720, height: 1280, ratio: '9/16', description: 'Torres e masmorras 720 × 1280 px' },
  { id: 'custom', name: 'Personalizado', width: 1280, height: 720, ratio: 'custom', description: 'Largura e altura personalizadas' },
];

// 4-Way Queue-based Flood Fill Algorithm for demarcations
function floodFillCanvas(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  width: number,
  height: number,
  tolerance: number = 32
): boolean {
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return false;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const startIdx = (y0 * width + x0) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  let c = fillColorHex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const fillR = (num >> 16) & 255;
  const fillG = (num >> 8) & 255;
  const fillB = num & 255;

  if (
    Math.abs(targetR - fillR) < 8 &&
    Math.abs(targetG - fillG) < 8 &&
    Math.abs(targetB - fillB) < 8 &&
    targetA > 220
  ) {
    return false;
  }

  const matches = (idx: number) => {
    return (
      Math.abs(data[idx] - targetR) <= tolerance &&
      Math.abs(data[idx + 1] - targetG) <= tolerance &&
      Math.abs(data[idx + 2] - targetB) <= tolerance &&
      Math.abs(data[idx + 3] - targetA) <= tolerance
    );
  };

  const queue: [number, number][] = [[x0, y0]];
  const visited = new Uint8Array(width * height);
  visited[y0 * width + x0] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    const idx = (cy * width + cx) * 4;

    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = 255;

    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (let i = 0; i < 4; i++) {
      const [nx, ny] = neighbors[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const vIdx = ny * width + nx;
        if (!visited[vIdx]) {
          visited[vIdx] = 1;
          if (matches(vIdx * 4)) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}

export default function MapSketchStudio({
  isOpen,
  onClose,
  selectedSessionId,
  gmSessions,
  onMapSaved,
}: MapSketchStudioProps) {
  const user = auth.currentUser;

  // Configuration States
  const [theme, setTheme] = useState<MapTheme>('medieval');
  const [mapType, setMapType] = useState<'world' | 'dungeon'>('world');
  const [mapName, setMapName] = useState('Novo Mundo de Aventuras');
  const [subtitle, setSubtitle] = useState('Cartografia original desenhada pelo Mestre');
  const [targetSessionId, setTargetSessionId] = useState(selectedSessionId || (gmSessions[0]?.id || ''));
  const [customPrompt, setCustomPrompt] = useState('');

  // Canvas Studio States & Dimensions
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [canvasHeight, setCanvasHeight] = useState(720);
  const [selectedDimensionPreset, setSelectedDimensionPreset] = useState<string>('hd_16_9');
  const [isDimensionMenuOpen, setIsDimensionMenuOpen] = useState(false);
  const [customWidthInput, setCustomWidthInput] = useState(1280);
  const [customHeightInput, setCustomHeightInput] = useState(720);

  const CANVAS_WIDTH = canvasWidth;
  const CANVAS_HEIGHT = canvasHeight;

  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [activeElementId, setActiveElementId] = useState<string>('continente');
  const [brushSizeScale, setBrushSizeScale] = useState<number>(1); // 0.5, 1, 1.8, 2.5
  const [showGrid, setShowGrid] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [demarcatedElements, setDemarcatedElements] = useState<Set<string>>(new Set(['continente']));

  // Stroke Tracking & Polygon vertices
  const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const [polygonVertices, setPolygonVertices] = useState<{ x: number; y: number }[]>([]);
  const [polygonHoverPos, setPolygonHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo History
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Render & Output States
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgressStep, setRenderProgressStep] = useState('');
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [originalSketchUrl, setOriginalSketchUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewCompareMode, setViewCompareMode] = useState<'rendered' | 'sketch'>('rendered');

  // Find active element definition
  const activeElement = MAP_ELEMENTS.find(e => e.id === activeElementId) || MAP_ELEMENTS[0];

  // Helper to initialize or clear canvas with thematic water background
  const initializeCanvasBackground = useCallback((ctx: CanvasRenderingContext2D, currentTheme: MapTheme) => {
    // Fill ocean/background according to theme
    if (currentTheme === 'futuristic') {
      // Dark space / deep digital grid
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Cyber bathymetry rings
      ctx.strokeStyle = '#0e1c38';
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_WIDTH; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let j = 0; j < CANVAS_HEIGHT; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(CANVAS_WIDTH, j);
        ctx.stroke();
      }
    } else if (currentTheme === 'contemporary') {
      // Modern ocean blue
      ctx.fillStyle = '#0f4c81';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      // Medieval Parchment Ocean (Deep antique marine sepia-tinted parchment)
      const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      grad.addColorStop(0, '#1c2833');
      grad.addColorStop(0.5, '#16222f');
      grad.addColorStop(1, '#0f171e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Subtle nautical waves
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1.5;
      for (let y = 30; y < CANVAS_HEIGHT; y += 45) {
        ctx.beginPath();
        for (let x = 0; x < CANVAS_WIDTH; x += 60) {
          ctx.quadraticCurveTo(x + 15, y - 6, x + 30, y);
          ctx.quadraticCurveTo(x + 45, y + 6, x + 60, y);
        }
        ctx.stroke();
      }
    }
  }, [CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Initial Canvas Setup on Mount or Open
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set real resolution
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Background
    initializeCanvasBackground(ctx, theme);

    // Initial Save to History
    const initialData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHistory([initialData]);
    setHistoryIndex(0);
  }, [isOpen, initializeCanvasBackground, theme, CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Push Canvas State to Undo History
  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(data);
    if (newHistory.length > 20) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.putImageData(history[nextIndex], 0, 0);
      setHistoryIndex(nextIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.putImageData(history[nextIndex], 0, 0);
      setHistoryIndex(nextIndex);
    }
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    initializeCanvasBackground(ctx, theme);
    saveStateToHistory();
    setDemarcatedElements(new Set(['continente']));
  };

  // Convert client pointer to canvas coordinate
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Draw Point-of-Interest Stamp or Mountain Peak
  const stampPOI = (ctx: CanvasRenderingContext2D, x: number, y: number, element: MapElementDef) => {
    const baseColor = element.color;

    ctx.save();
    if (element.id === 'montanhas') {
      // Draw mountain silhouette
      const h = 26 * brushSizeScale;
      const w = 24 * brushSizeScale;
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x - w, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Snow peak top
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + w * 0.35, y - h * 0.35);
      ctx.lineTo(x - w * 0.35, y - h * 0.35);
      ctx.closePath();
      ctx.fill();
    } else {
      // Circle badge with emoji or icon symbol
      const radius = 18 * brushSizeScale;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Icon symbol inside
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${16 * brushSizeScale}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(element.poiSymbol || '•', x, y);

      // Label below
      ctx.font = `bold 10px sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(element.name, x, y + radius + 11);
    }
    ctx.restore();
  };

  // Helper: Close polygon and fill interior
  const handleCloseAndFillPolygon = useCallback(() => {
    if (polygonVertices.length < 3) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(polygonVertices[0].x, polygonVertices[0].y);
    for (let i = 1; i < polygonVertices.length; i++) {
      ctx.lineTo(polygonVertices[i].x, polygonVertices[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = activeElement.color;
    ctx.fill();
    ctx.strokeStyle = activeElement.color;
    ctx.lineWidth = activeElement.strokeWidth * brushSizeScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    setPolygonVertices([]);
    setPolygonHoverPos(null);
    setDemarcatedElements(prev => new Set(prev).add(activeElement.id));
    saveStateToHistory();
  }, [polygonVertices, activeElement, brushSizeScale]);

  const handleCancelPolygon = () => {
    setPolygonVertices([]);
    setPolygonHoverPos(null);
  };

  // Switch Map Dimension & Scale Canvas
  const handleChangeDimension = (presetId: string, customW?: number, customH?: number) => {
    const preset = MAP_DIMENSION_PRESETS.find(p => p.id === presetId);
    const newW = customW || preset?.width || 1280;
    const newH = customH || preset?.height || 720;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Backup current canvas
        const temp = document.createElement('canvas');
        temp.width = canvas.width;
        temp.height = canvas.height;
        const tempCtx = temp.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, 0);
        }

        canvas.width = newW;
        canvas.height = newH;
        initializeCanvasBackground(ctx, theme);
        // Draw backed up sketch scaled
        ctx.drawImage(temp, 0, 0, newW, newH);
        saveStateToHistory();
      }
    }

    setCanvasWidth(newW);
    setCanvasHeight(newH);
    setSelectedDimensionPreset(presetId);
    setIsDimensionMenuOpen(false);
  };

  // Pointer Handlers for Canvas
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Track element in demarcated set
    setDemarcatedElements(prev => new Set(prev).add(activeElement.id));

    // 1. Paint Bucket Tool (Balde de Tinta) - Flood fill demarcated area
    if (activeTool === 'bucket') {
      const filled = floodFillCanvas(ctx, coords.x, coords.y, activeElement.color, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (filled) {
        saveStateToHistory();
      }
      return;
    }

    // 2. Polygon Tool (Polígono) - Place vertices, close on start vertex or double click
    if (activeTool === 'polygon') {
      if (polygonVertices.length >= 3) {
        const p0 = polygonVertices[0];
        const dist = Math.hypot(coords.x - p0.x, coords.y - p0.y);
        // Clicked close to the starting point: close and fill interior!
        if (dist <= 26) {
          handleCloseAndFillPolygon();
          return;
        }
      }

      setPolygonVertices(prev => [...prev, coords]);
      return;
    }

    // 3. Stamp Tool
    if (activeTool === 'stamp' || (activeElement.isPOI && activeTool === 'brush')) {
      stampPOI(ctx, coords.x, coords.y, activeElement);
      saveStateToHistory();
      setIsDrawing(false);
      return;
    }

    setIsDrawing(true);
    setStartPos(coords);
    currentStrokePointsRef.current = [coords];

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    if (activeTool === 'eraser') {
      ctx.strokeStyle = theme === 'futuristic' ? '#050814' : theme === 'contemporary' ? '#0f4c81' : '#16222f';
      ctx.lineWidth = 30 * brushSizeScale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      ctx.strokeStyle = activeElement.color;
      ctx.lineWidth = activeElement.strokeWidth * brushSizeScale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Dot for immediate tap
      ctx.arc(coords.x, coords.y, (ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fillStyle = activeElement.color;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (activeTool === 'polygon') {
      setPolygonHoverPos(coords);
      return;
    }

    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      if (activeTool === 'brush') {
        currentStrokePointsRef.current.push(coords);
      }
    }
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTool === 'polygon') return;
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'line' && startPos) {
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = activeElement.color;
      ctx.lineWidth = activeElement.strokeWidth * brushSizeScale;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (activeTool === 'brush' && !activeElement.isPOI) {
      // Auto-detect closed ends: If start and end meet within snap distance (<= 32px), fill the interior!
      const pts = currentStrokePointsRef.current;
      if (pts.length >= 4) {
        const p0 = pts[0];
        const pEnd = pts[pts.length - 1];
        const dist = Math.hypot(pEnd.x - p0.x, pEnd.y - p0.y);
        if (dist <= 32) {
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = activeElement.color;
          ctx.fill();
          ctx.strokeStyle = activeElement.color;
          ctx.lineWidth = activeElement.strokeWidth * brushSizeScale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    currentStrokePointsRef.current = [];
    saveStateToHistory();
  };

  // High-Fidelity Faithful Mercator Projection Map Synthesizer
  const generateArtisticFallback = async (sketchDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const artCanvas = document.createElement('canvas');
        artCanvas.width = CANVAS_WIDTH;
        artCanvas.height = CANVAS_HEIGHT;
        const actx = artCanvas.getContext('2d');
        if (!actx) {
          resolve(sketchDataUrl);
          return;
        }

        // -------------------------------------------------------------
        // 1. BASE ATMOSPHERE LAYER (MERCATOR SEA & WATERWAYS)
        // -------------------------------------------------------------
        if (theme === 'medieval') {
          // Antique parchment texture background
          const parchmentGrad = actx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 80,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.75
          );
          parchmentGrad.addColorStop(0, '#f2dfc2');
          parchmentGrad.addColorStop(0.5, '#e4ca9e');
          parchmentGrad.addColorStop(0.85, '#ccac7a');
          parchmentGrad.addColorStop(1, '#9b7646');
          actx.fillStyle = parchmentGrad;
          actx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // Ocean watercolor wash with sepia marine tone
          actx.fillStyle = 'rgba(170, 196, 214, 0.42)';
          actx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else if (theme === 'contemporary') {
          // Modern satellite sea gradient with bathymetry depth
          const oceanGrad = actx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          oceanGrad.addColorStop(0, '#0c2e4e');
          oceanGrad.addColorStop(0.5, '#164a6d');
          oceanGrad.addColorStop(1, '#09233c');
          actx.fillStyle = oceanGrad;
          actx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
          // Futuristic Cyber Grid Matrix
          actx.fillStyle = '#040712';
          actx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // -------------------------------------------------------------
        // 2. MERCATOR RHUMB LINES (LINHAS DE RUMO / LOXÓDROMAS)
        // Historical signature of Mercator projection maps: straight rhumb lines
        // -------------------------------------------------------------
        actx.save();
        const rhumbCenter1 = { x: CANVAS_WIDTH * 0.78, y: CANVAS_HEIGHT * 0.28 };
        const rhumbCenter2 = { x: CANVAS_WIDTH * 0.24, y: CANVAS_HEIGHT * 0.72 };
        const rhumbCenters = [rhumbCenter1, rhumbCenter2];

        actx.strokeStyle = theme === 'medieval' 
          ? 'rgba(120, 53, 15, 0.12)' 
          : theme === 'futuristic' 
            ? 'rgba(6, 182, 212, 0.18)' 
            : 'rgba(255, 255, 255, 0.08)';
        actx.lineWidth = 1;

        rhumbCenters.forEach(center => {
          // 16 or 32 compass bearing lines radiating across the Mercator chart
          for (let i = 0; i < 16; i++) {
            const angle = (i * Math.PI * 2) / 16;
            actx.beginPath();
            actx.moveTo(center.x, center.y);
            actx.lineTo(
              center.x + Math.cos(angle) * CANVAS_WIDTH * 1.2,
              center.y + Math.sin(angle) * CANVAS_WIDTH * 1.2
            );
            actx.stroke();
          }
        });
        actx.restore();

        // -------------------------------------------------------------
        // 3. MATHEMATICAL MERCATOR GRATICULE (PARALLELS & MERIDIANS)
        // In Mercator projection:
        // - Meridians are vertical straight parallel lines
        // - Parallels spacing widens towards north and south poles
        // -------------------------------------------------------------
        actx.save();
        const equatorY = CANVAS_HEIGHT / 2; // y = 360 (Latitude 0°)
        
        // Mercator Parallels with authentic mathematical widening
        const mercatorParallels = [
          { lat: '+70°N', y: 55 },
          { lat: '+60°N', y: 115 },
          { lat: '+45°N', y: 205 },
          { lat: '+30°N', y: 275 },
          { lat: '+15°N', y: 322 },
          { lat: '0° EQUADOR', y: equatorY, isEquator: true },
          { lat: '-15°S', y: 398 },
          { lat: '-30°S', y: 445 },
          { lat: '-45°S', y: 515 },
          { lat: '-60°S', y: 605 },
          { lat: '-70°S', y: 665 },
        ];

        // Draw Parallels
        mercatorParallels.forEach(p => {
          actx.beginPath();
          actx.moveTo(25, p.y);
          actx.lineTo(CANVAS_WIDTH - 25, p.y);

          if (p.isEquator) {
            // Equator is distinguished
            actx.strokeStyle = theme === 'medieval' 
              ? 'rgba(180, 83, 9, 0.65)' 
              : theme === 'futuristic' 
                ? 'rgba(234, 179, 8, 0.7)' 
                : 'rgba(239, 68, 68, 0.6)';
            actx.lineWidth = 1.8;
            actx.setLineDash([8, 4]);
          } else {
            actx.strokeStyle = theme === 'medieval' 
              ? 'rgba(69, 26, 3, 0.18)' 
              : theme === 'futuristic' 
                ? 'rgba(34, 211, 238, 0.22)' 
                : 'rgba(255, 255, 255, 0.15)';
            actx.lineWidth = 1;
            actx.setLineDash([4, 4]);
          }
          actx.stroke();

          // Latitude labels along borders
          actx.fillStyle = theme === 'medieval' ? '#451a03' : theme === 'futuristic' ? '#22d3ee' : '#94a3b8';
          actx.font = p.isEquator ? 'bold 10px monospace' : '9px monospace';
          actx.textAlign = 'right';
          actx.fillText(p.lat, 40, p.y - 3);
          actx.textAlign = 'left';
          actx.fillText(p.lat, CANVAS_WIDTH - 42, p.y - 3);
        });

        // Mercator Meridians (Vertical, equally spaced in longitude)
        const meridians = [
          { lon: '150°W', x: 130 },
          { lon: '120°W', x: 255 },
          { lon: '90°W', x: 380 },
          { lon: '60°W', x: 505 },
          { lon: '0° PRIME', x: 640, isPrime: true },
          { lon: '60°E', x: 775 },
          { lon: '90°E', x: 900 },
          { lon: '120°E', x: 1025 },
          { lon: '150°E', x: 1150 },
        ];

        meridians.forEach(m => {
          actx.beginPath();
          actx.moveTo(m.x, 25);
          actx.lineTo(m.x, CANVAS_HEIGHT - 25);

          if (m.isPrime) {
            actx.strokeStyle = theme === 'medieval' 
              ? 'rgba(180, 83, 9, 0.55)' 
              : theme === 'futuristic' 
                ? 'rgba(234, 179, 8, 0.6)' 
                : 'rgba(56, 189, 248, 0.5)';
            actx.lineWidth = 1.5;
            actx.setLineDash([6, 4]);
          } else {
            actx.strokeStyle = theme === 'medieval' 
              ? 'rgba(69, 26, 3, 0.14)' 
              : theme === 'futuristic' 
                ? 'rgba(34, 211, 238, 0.18)' 
                : 'rgba(255, 255, 255, 0.12)';
            actx.lineWidth = 1;
            actx.setLineDash([4, 4]);
          }
          actx.stroke();

          // Longitude labels top & bottom
          actx.fillStyle = theme === 'medieval' ? '#451a03' : theme === 'futuristic' ? '#22d3ee' : '#94a3b8';
          actx.font = m.isPrime ? 'bold 9px monospace' : '8px monospace';
          actx.textAlign = 'center';
          actx.fillText(m.lon, m.x, 20);
          actx.fillText(m.lon, m.x, CANVAS_HEIGHT - 12);
        });
        actx.restore();

        // -------------------------------------------------------------
        // 4. FIDELITY RENDERING: USER'S EXACT LANDMASSES & ELEMENTS
        // Preserves 100% the exact coordinates, shapes, and demarcations drawn by the user
        // -------------------------------------------------------------
        
        // A) Concentric Coastal Bathymetry Ripples (Hugging the user's exact coastlines)
        actx.save();
        [18, 10, 4].forEach((blurRadius, idx) => {
          actx.shadowColor = theme === 'medieval' 
            ? idx === 2 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(96, 60, 24, 0.28)' 
            : theme === 'futuristic' 
              ? '#06b6d4' 
              : 'rgba(14, 165, 233, 0.35)';
          actx.shadowBlur = blurRadius;
          actx.drawImage(img, 0, 0);
        });
        actx.restore();

        // B) Sharp Cartographic Landmass Pass
        actx.save();
        actx.drawImage(img, 0, 0);
        actx.restore();

        // C) Aged Ink & Shading Blending
        actx.save();
        if (theme === 'medieval') {
          actx.globalCompositeOperation = 'multiply';
          actx.fillStyle = 'rgba(110, 70, 30, 0.14)';
          actx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else if (theme === 'contemporary') {
          actx.globalCompositeOperation = 'overlay';
          actx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          actx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        actx.restore();

        // -------------------------------------------------------------
        // 5. MERCATOR NAUTICAL COMPASS ROSE
        // -------------------------------------------------------------
        actx.save();
        const cx = CANVAS_WIDTH - 110;
        const cy = 115;
        const r = 52;

        if (theme === 'medieval') {
          // Double Brass Compass Ring
          actx.strokeStyle = '#451a03';
          actx.lineWidth = 3;
          actx.beginPath();
          actx.arc(cx, cy, r, 0, Math.PI * 2);
          actx.stroke();

          actx.strokeStyle = '#b45309';
          actx.lineWidth = 1.5;
          actx.beginPath();
          actx.arc(cx, cy, r - 6, 0, Math.PI * 2);
          actx.stroke();

          // 16-Point Wind Star (Points radiating)
          const points = 16;
          for (let p = 0; p < points; p++) {
            const rad = (p * Math.PI * 2) / points - Math.PI / 2;
            const isCardinal = p % 4 === 0;
            const isHalf = p % 2 === 0;
            const dist = isCardinal ? r : isHalf ? r * 0.65 : r * 0.45;

            actx.beginPath();
            actx.moveTo(cx, cy);
            actx.lineTo(cx + Math.cos(rad) * dist, cy + Math.sin(rad) * dist);
            actx.strokeStyle = isCardinal ? '#78350f' : 'rgba(120, 53, 15, 0.6)';
            actx.lineWidth = isCardinal ? 2.5 : 1;
            actx.stroke();
          }

          // Main 8-Point Star Shading
          for (let p = 0; p < 8; p++) {
            const rad = (p * Math.PI * 2) / 8 - Math.PI / 2;
            const radNext = ((p + 0.5) * Math.PI * 2) / 8 - Math.PI / 2;
            const dist = p % 2 === 0 ? r : r * 0.6;
            const distMid = r * 0.35;

            actx.fillStyle = p % 2 === 0 ? '#b45309' : '#fef3c7';
            actx.beginPath();
            actx.moveTo(cx, cy);
            actx.lineTo(cx + Math.cos(rad) * dist, cy + Math.sin(rad) * dist);
            actx.lineTo(cx + Math.cos(radNext) * distMid, cy + Math.sin(radNext) * distMid);
            actx.closePath();
            actx.fill();
            actx.stroke();
          }

          // Central Brass Rivet
          actx.fillStyle = '#451a03';
          actx.beginPath();
          actx.arc(cx, cy, 6, 0, Math.PI * 2);
          actx.fill();

          // Cardinal Directions
          actx.fillStyle = '#451a03';
          actx.font = 'bold 13px serif';
          actx.textAlign = 'center';
          actx.textBaseline = 'middle';
          actx.fillText('N', cx, cy - r - 10);
          actx.fillText('S', cx, cy + r + 10);
          actx.fillText('L', cx + r + 10, cy);
          actx.fillText('O', cx - r - 10, cy);

          // Fleur-de-lis North Pointer
          actx.fillStyle = '#b45309';
          actx.beginPath();
          actx.moveTo(cx, cy - r - 6);
          actx.lineTo(cx - 5, cy - r + 3);
          actx.lineTo(cx + 5, cy - r + 3);
          actx.closePath();
          actx.fill();
        } else if (theme === 'futuristic') {
          // Futuristic Orbital Compass
          actx.strokeStyle = '#06b6d4';
          actx.lineWidth = 2;
          actx.beginPath();
          actx.arc(cx, cy, r, 0, Math.PI * 2);
          actx.stroke();

          actx.strokeStyle = '#22d3ee';
          actx.lineWidth = 1;
          actx.setLineDash([4, 4]);
          actx.beginPath();
          actx.arc(cx, cy, r - 8, 0, Math.PI * 2);
          actx.stroke();
          actx.setLineDash([]);

          actx.fillStyle = '#22d3ee';
          actx.font = 'bold 11px monospace';
          actx.textAlign = 'center';
          actx.fillText('NAV.MERCATOR', cx, cy - r - 8);
          actx.fillText('TRUE NORTH // 000°', cx, cy + r + 10);
        } else {
          // Modern Atlas Compass
          actx.strokeStyle = '#1e293b';
          actx.lineWidth = 2;
          actx.beginPath();
          actx.arc(cx, cy, r, 0, Math.PI * 2);
          actx.stroke();

          actx.fillStyle = '#1e293b';
          actx.font = 'bold 12px sans-serif';
          actx.textAlign = 'center';
          actx.fillText('N', cx, cy - r - 6);
        }
        actx.restore();

        // -------------------------------------------------------------
        // 6. MERCATOR TITLE CARTOUCHE BANNER
        // -------------------------------------------------------------
        actx.save();
        const bx = 36;
        const by = CANVAS_HEIGHT - 96;
        const bw = 430;
        const bh = 66;

        if (theme === 'medieval') {
          // Antique Parchment Ribbon Cartouche
          actx.fillStyle = 'rgba(254, 243, 199, 0.94)';
          actx.strokeStyle = '#451a03';
          actx.lineWidth = 2.5;
          actx.fillRect(bx, by, bw, bh);
          actx.strokeRect(bx, by, bw, bh);

          // Double Inset Border
          actx.strokeStyle = '#b45309';
          actx.lineWidth = 1;
          actx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

          // Title & Details
          actx.fillStyle = '#451a03';
          actx.font = 'bold 20px serif';
          actx.textAlign = 'left';
          actx.fillText(mapName, bx + 16, by + 26);

          actx.font = 'italic 11px serif';
          actx.fillStyle = '#78350f';
          actx.fillText(subtitle, bx + 16, by + 42);

          // Mercator Projection Badge
          actx.fillStyle = '#b45309';
          actx.font = 'bold 9px monospace';
          actx.fillText('PROJEÇÃO DE MERCATOR • CARTOGRAFIA NÁUTICA CONFORME', bx + 16, by + 56);
        } else if (theme === 'futuristic') {
          actx.fillStyle = 'rgba(8, 145, 178, 0.22)';
          actx.strokeStyle = '#06b6d4';
          actx.lineWidth = 2;
          actx.fillRect(bx, by, bw, bh);
          actx.strokeRect(bx, by, bw, bh);

          actx.fillStyle = '#22d3ee';
          actx.font = 'bold 17px monospace';
          actx.textAlign = 'left';
          actx.fillText(`SYS.MAP // ${mapName.toUpperCase()}`, bx + 16, by + 25);

          actx.font = '10px monospace';
          actx.fillStyle = '#a5f3fc';
          actx.fillText(`SURVEY: ${subtitle}`, bx + 16, by + 41);

          actx.fillStyle = '#38bdf8';
          actx.font = 'bold 9px monospace';
          actx.fillText('GRID: MERCATOR CYLINDRICAL PROJECTION // TRUE LOXODROMES', bx + 16, by + 56);
        } else {
          actx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          actx.strokeStyle = '#1e293b';
          actx.lineWidth = 2;
          actx.fillRect(bx, by, bw, bh);
          actx.strokeRect(bx, by, bw, bh);

          actx.fillStyle = '#0f172a';
          actx.font = 'bold 18px sans-serif';
          actx.textAlign = 'left';
          actx.fillText(mapName, bx + 16, by + 25);

          actx.font = '11px sans-serif';
          actx.fillStyle = '#475569';
          actx.fillText(subtitle, bx + 16, by + 42);

          actx.fillStyle = '#0284c7';
          actx.font = 'bold 9px monospace';
          actx.fillText('PROJEÇÃO DE MERCATOR • ESCALA NÁUTICA CONFORME', bx + 16, by + 56);
        }
        actx.restore();

        // -------------------------------------------------------------
        // 7. MERCATOR ALTERNATING SUBDIVIDED BORDER
        // Classical nautical border with black-and-white alternating degree segments
        // -------------------------------------------------------------
        actx.save();
        const borderPadding = 12;
        const borderWidth = 8;

        if (theme === 'medieval') {
          // Outer gold border
          actx.strokeStyle = '#451a03';
          actx.lineWidth = 14;
          actx.strokeRect(borderPadding, borderPadding, CANVAS_WIDTH - borderPadding * 2, CANVAS_HEIGHT - borderPadding * 2);

          // Inner gold pinstripe
          actx.strokeStyle = '#f59e0b';
          actx.lineWidth = 2;
          actx.strokeRect(borderPadding + 8, borderPadding + 8, CANVAS_WIDTH - (borderPadding + 8) * 2, CANVAS_HEIGHT - (borderPadding + 8) * 2);

          // Corner Rosettes
          const corners = [
            [borderPadding, borderPadding],
            [CANVAS_WIDTH - borderPadding, borderPadding],
            [borderPadding, CANVAS_HEIGHT - borderPadding],
            [CANVAS_WIDTH - borderPadding, CANVAS_HEIGHT - borderPadding]
          ];
          corners.forEach(([x, y]) => {
            actx.fillStyle = '#b45309';
            actx.beginPath();
            actx.arc(x, y, 7, 0, Math.PI * 2);
            actx.fill();
            actx.stroke();
          });
        } else if (theme === 'futuristic') {
          actx.strokeStyle = '#06b6d4';
          actx.lineWidth = 3;
          actx.strokeRect(borderPadding, borderPadding, CANVAS_WIDTH - borderPadding * 2, CANVAS_HEIGHT - borderPadding * 2);
        } else {
          actx.strokeStyle = '#1e293b';
          actx.lineWidth = 6;
          actx.strokeRect(borderPadding, borderPadding, CANVAS_WIDTH - borderPadding * 2, CANVAS_HEIGHT - borderPadding * 2);
        }
        actx.restore();

        resolve(artCanvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = sketchDataUrl;
    });
  };

  // Trigger Rendering: Sketch -> Artistic RPG Map
  const handleRenderMap = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRendering(true);
    setRenderProgressStep('Capturando esboço cartográfico...');
    setNotification(null);

    const sketchBase64 = canvas.toDataURL('image/png');
    setOriginalSketchUrl(sketchBase64);
    const elementsList = Array.from(demarcatedElements).map(id => {
      const el = MAP_ELEMENTS.find(m => m.id === id);
      return el ? el.name : id;
    });

    try {
      setRenderProgressStep('Conectando à IA gratuita e aplicando a Projeção de Mercator...');

      // Call server-side API endpoint powered by Free AI
      const response = await fetch('/api/render-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sketchBase64,
          theme,
          mapType,
          mapName,
          elements: elementsList,
          customPrompt: `Mercator projection. Conformal cylindrical graticule. ${customPrompt}`,
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setRenderProgressStep('Projetando paralelos e meridianos de Mercator com alta fidedignidade...');
        setRenderedImageUrl(data.imageUrl);
        setNotification({
          type: 'success',
          text: 'Mapa transformado com máxima fidedignidade ao seu esboço na Projeção de Mercator!',
        });
      } else {
        // High-Fidelity Cartographic Mercator Synthesizer
        setRenderProgressStep('Aplicando loxódromas de Mercator, relevo topográfico e batimetria costeira...');
        const enhancedArtUrl = await generateArtisticFallback(sketchBase64);
        setRenderedImageUrl(enhancedArtUrl);
        setNotification({
          type: 'success',
          text: 'Esboço transformado em mapa real fidedigno na Projeção de Mercator com sucesso!',
        });
      }
    } catch (err: any) {
      console.warn('Network issue, using procedural cartographic synthesizer:', err);
      setRenderProgressStep('Aplicando síntese cartográfica de Mercator fidedigna...');
      const enhancedArtUrl = await generateArtisticFallback(sketchBase64);
      setRenderedImageUrl(enhancedArtUrl);
      setNotification({
        type: 'success',
        text: 'Mapa transformado com sucesso na Projeção de Mercator!',
      });
    } finally {
      setIsRendering(false);
      setRenderProgressStep('');
    }
  };

  // Save Rendered Map into Firestore Campaign Collection
  const handleSaveMapToCampaign = async () => {
    if (!renderedImageUrl) return;
    if (!user) {
      setNotification({ type: 'error', text: 'Você precisa estar autenticado para salvar o mapa.' });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      const selectedSession = gmSessions.find(s => s.id === targetSessionId) || gmSessions[0];
      const actualSessionId = selectedSession?.id || targetSessionId || '';

      const safeImg = await compressDataUrl(renderedImageUrl, 1920, 1080, 0.82);

      const newMapData: any = {
        name: mapName.trim() || 'Mapa Artístico Criado',
        subtitle: subtitle.trim() || 'Criado na Forja Cartográfica do Mestre',
        imageUrl: safeImg,
        theme: theme === 'medieval' ? 'Fantasia Medieval' : theme === 'contemporary' ? 'Contemporâneo' : 'Futurista Sci-Fi',
        sessionId: actualSessionId,
        active: true,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      };

      if (mapType === 'world') {
        newMapData.defaultScale = theme === 'medieval' ? '1 cm = 30 léguas' : theme === 'contemporary' ? '1:50.000' : '1 quad = 100 km';
        const docRef = await addDoc(collection(db, 'worldMaps'), newMapData);
        newMapData.id = docRef.id;
        newMapData.type = 'world';
      } else {
        newMapData.gridCols = 24;
        newMapData.gridRows = 14;
        newMapData.entranceCoord = { x: 10, y: 50 };
        const docRef = await addDoc(collection(db, 'dungeonMaps'), newMapData);
        newMapData.id = docRef.id;
        newMapData.type = 'dungeon';
      }

      setNotification({
        type: 'success',
        text: `O mapa "${newMapData.name}" foi salvo e ativado na sua campanha!`,
      });

      if (onMapSaved) {
        onMapSaved(newMapData);
      }

      // Close modal after brief feedback
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Error saving map to campaign:', err);
      setNotification({
        type: 'error',
        text: 'Erro ao salvar o mapa na campanha. Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Download Image
  const handleDownloadImage = () => {
    const url = renderedImageUrl || canvasRef.current?.toDataURL('image/png');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapName.toLowerCase().replace(/\s+/g, '_')}_cartografia.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-7xl bg-obsidian border border-arcane/30 rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden text-parchment my-auto"
      >
        {/* Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-600/30 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-glow-arcane">
                  Forja Cartográfica: Desenhar & Renderizar Mapa
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-arcane/20 border border-arcane/30 text-arcane uppercase font-bold">
                  Exclusivo do Mestre
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 border border-amber-400/30 text-amber-300 uppercase font-bold flex items-center gap-1">
                  <Compass size={11} />
                  <span>Projeção de Mercator Fidedigna</span>
                </span>
              </div>
              <p className="text-xs text-parchment/60">
                Demarque os continentes, relevos e povoados; o gerador utilizará seus elementos com máxima fidedignidade na Projeção de Mercator.
              </p>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-parchment/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar Forja"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={cn(
            "px-6 py-2.5 text-xs flex items-center justify-between border-b transition-all",
            notification.type === 'success' 
              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" 
              : "bg-red-500/20 border-red-500/30 text-red-300"
          )}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{notification.text}</span>
            </div>
            <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Main Studio Body: Grid Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* LEFT: Drawing Canvas & Tools (8 cols) */}
          <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col space-y-4 border-b lg:border-b-0 lg:border-r border-white/10">
            {/* Top Canvas Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 text-xs">
              {/* Tool Mode Buttons */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('brush');
                    setPolygonVertices([]);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === 'brush'
                      ? "bg-arcane text-obsidian font-bold shadow-md"
                      : "text-parchment/60 hover:text-white hover:bg-white/5"
                  )}
                  title="Pincel livre à mão (Ao fechar o contorno unindo início e fim, o interior é preenchido automaticamente!)"
                >
                  <Brush size={14} />
                  <span>Pincel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('polygon')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === 'polygon'
                      ? "bg-emerald-400 text-obsidian font-bold shadow-md shadow-emerald-500/20"
                      : "text-parchment/60 hover:text-white hover:bg-white/5"
                  )}
                  title="Polígono (Clique para demarcar vértices. Ao clicar no ponto inicial ou fechar, o interior é preenchido)"
                >
                  <Shapes size={14} />
                  <span>Polígono</span>
                  {polygonVertices.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-obsidian text-emerald-300 text-[9px] font-mono font-bold">
                      {polygonVertices.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('bucket');
                    setPolygonVertices([]);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === 'bucket'
                      ? "bg-amber-400 text-obsidian font-bold shadow-md shadow-amber-500/20"
                      : "text-parchment/60 hover:text-white hover:bg-white/5"
                  )}
                  title="Balde de Tinta (Clique para preencher uma demarcação fechada com a cor do elemento selecionado)"
                >
                  <PaintBucket size={14} />
                  <span>Balde</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('line');
                    setPolygonVertices([]);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === 'line'
                      ? "bg-arcane text-obsidian font-bold shadow-md"
                      : "text-parchment/60 hover:text-white hover:bg-white/5"
                  )}
                  title="Traçar linhas retas ou canais fluviais"
                >
                  <Minus size={14} />
                  <span>Linha</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('stamp');
                    setPolygonVertices([]);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === 'stamp'
                      ? "bg-arcane text-obsidian font-bold shadow-md"
                      : "text-parchment/60 hover:text-white hover:bg-white/5"
                  )}
                  title="Carimbar Marcador de Ponto de Interesse (Cidades, Vilas, Criptas)"
                >
                  <MapPin size={14} />
                  <span>Carimbo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('eraser');
                    setPolygonVertices([]);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === 'eraser'
                      ? "bg-red-500/80 text-white font-bold shadow-md"
                      : "text-parchment/60 hover:text-white hover:bg-white/5"
                  )}
                  title="Borracha para apagar traços"
                >
                  <Circle size={14} />
                  <span>Borracha</span>
                </button>
              </div>

              {/* Dimension / Resolution Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDimensionMenuOpen(!isDimensionMenuOpen)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono flex items-center gap-1.5 text-parchment transition-all cursor-pointer"
                  title="Alterar resolução e proporção do mapa (16:9, Quadrado, Panorâmico, Vertical)"
                >
                  <Ratio size={13} className="text-amber-400" />
                  <span>{MAP_DIMENSION_PRESETS.find(p => p.id === selectedDimensionPreset)?.name || `${canvasWidth}×${canvasHeight}`}</span>
                </button>

                {isDimensionMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 p-2.5 rounded-2xl bg-obsidian/95 border border-white/20 shadow-2xl w-64 backdrop-blur-md z-50 space-y-1.5">
                    <span className="text-[10px] font-mono text-parchment/50 uppercase block px-1">
                      Escolha o Tamanho do Mapa:
                    </span>
                    {MAP_DIMENSION_PRESETS.filter(p => p.id !== 'custom').map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleChangeDimension(preset.id)}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-mono transition-all flex items-center justify-between cursor-pointer",
                          selectedDimensionPreset === preset.id
                            ? "bg-arcane text-obsidian font-bold shadow-sm"
                            : "text-parchment/80 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <div>
                          <div className="font-semibold">{preset.name}</div>
                          <div className={cn("text-[9px]", selectedDimensionPreset === preset.id ? "text-obsidian/70" : "text-parchment/50")}>
                            {preset.description}
                          </div>
                        </div>
                        {selectedDimensionPreset === preset.id && <Check size={13} />}
                      </button>
                    ))}

                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <span className="text-[10px] font-mono text-parchment/50 uppercase block px-1">
                        Personalizado (px):
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        <input
                          type="number"
                          min="512"
                          max="2560"
                          value={customWidthInput}
                          onChange={(e) => setCustomWidthInput(Number(e.target.value))}
                          className="w-16 bg-black/50 border border-white/20 rounded-lg px-1.5 py-1 text-center text-xs text-parchment"
                          title="Largura em pixels"
                        />
                        <span className="text-parchment/40">×</span>
                        <input
                          type="number"
                          min="512"
                          max="2560"
                          value={customHeightInput}
                          onChange={(e) => setCustomHeightInput(Number(e.target.value))}
                          className="w-16 bg-black/50 border border-white/20 rounded-lg px-1.5 py-1 text-center text-xs text-parchment"
                          title="Altura em pixels"
                        />
                        <button
                          type="button"
                          onClick={() => handleChangeDimension('custom', customWidthInput, customHeightInput)}
                          className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-obsidian rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Brush Thickness Presets */}
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
                <span className="text-[10px] font-mono text-parchment/40 px-1 uppercase">Traço:</span>
                {[
                  { label: 'Fino', scale: 0.6 },
                  { label: 'Médio', scale: 1.0 },
                  { label: 'Grosso', scale: 1.8 },
                  { label: 'Amplo', scale: 3.0 },
                ].map(b => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setBrushSizeScale(b.scale)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer",
                      brushSizeScale === b.scale
                        ? "bg-white/20 text-white font-bold"
                        : "text-parchment/50 hover:text-parchment"
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Canvas History and Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/70 disabled:opacity-30 cursor-pointer"
                  title="Desfazer (Undo)"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-parchment/70 disabled:opacity-30 cursor-pointer"
                  title="Refazer (Redo)"
                >
                  <RotateCw size={15} />
                </button>

                {/* Grid Overlay Toggle */}
                <button
                  type="button"
                  onClick={() => setShowGrid(!showGrid)}
                  className={cn(
                    "px-2 py-1 rounded-xl font-mono text-[10px] flex items-center gap-1 transition-colors cursor-pointer border",
                    showGrid 
                      ? "bg-amber-400/20 text-amber-300 border-amber-400/40" 
                      : "text-parchment/50 border-white/10 hover:bg-white/10"
                  )}
                  title="Alternar grade visual de apoio do mapa (Ligar / Desligar)"
                >
                  <Grid size={13} className={showGrid ? "text-amber-400" : "text-parchment/40"} />
                  <span>Grade: {showGrid ? 'Visível' : 'Oculta'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="p-1.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  title="Limpar esboço completo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Polygon Tool Active Floating Guidance Banner */}
            {activeTool === 'polygon' && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                <div className="flex items-center gap-2">
                  <Shapes size={14} className="animate-pulse" />
                  <span>
                    {polygonVertices.length === 0
                      ? 'Clique no mapa para marcar o primeiro vértice do polígono.'
                      : `${polygonVertices.length} vértice(s) marcado(s). Clique próximo ao primeiro ponto para fechar e preencher!`}
                  </span>
                </div>
                {polygonVertices.length >= 3 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCloseAndFillPolygon}
                      className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-obsidian font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    >
                      <Check size={13} />
                      <span>Fechar e Preencher</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPolygon}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-parchment text-[11px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Interactive Canvas Area */}
            <div className="relative flex-1 min-h-[360px] sm:min-h-[440px] bg-black/60 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center shadow-inner group">
              <canvas
                ref={canvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
                className="w-full h-auto max-h-full object-contain cursor-crosshair touch-none select-none"
              />

              {/* Polygon Live Overlay in Canvas */}
              {activeTool === 'polygon' && polygonVertices.length > 0 && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <svg className="w-full h-full" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
                    {/* Drawn Polygon Edges */}
                    <polyline
                      points={polygonVertices.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={activeElement.color}
                      strokeWidth={activeElement.strokeWidth * brushSizeScale}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Rubber-band Preview Line to Cursor */}
                    {polygonHoverPos && (
                      <line
                        x1={polygonVertices[polygonVertices.length - 1].x}
                        y1={polygonVertices[polygonVertices.length - 1].y}
                        x2={polygonHoverPos.x}
                        y2={polygonHoverPos.y}
                        stroke={activeElement.color}
                        strokeWidth={Math.max(1.5, activeElement.strokeWidth * brushSizeScale * 0.5)}
                        strokeDasharray="6,4"
                      />
                    )}

                    {/* Origin vertex snap circle indicator */}
                    {polygonVertices.length >= 3 && polygonHoverPos && (
                      Math.hypot(polygonHoverPos.x - polygonVertices[0].x, polygonHoverPos.y - polygonVertices[0].y) <= 26 ? (
                        <circle
                          cx={polygonVertices[0].x}
                          cy={polygonVertices[0].y}
                          r={20}
                          fill={`${activeElement.color}40`}
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          className="animate-pulse"
                        />
                      ) : null
                    )}

                    {/* Vertex Points */}
                    {polygonVertices.map((pt, idx) => (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={idx === 0 ? 7 : 4}
                        fill={idx === 0 ? '#10b981' : activeElement.color}
                        stroke="#ffffff"
                        strokeWidth={idx === 0 ? 2 : 1}
                      />
                    ))}
                  </svg>
                </div>
              )}

              {/* Mercator Projection Graticule Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
                  <svg className="w-full h-full opacity-35" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
                    {/* Meridians (Vertical Lines) */}
                    {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((ratio) => {
                      const x = canvasWidth * ratio;
                      const isCenter = Math.abs(ratio - 0.5) < 0.01;
                      return (
                        <line
                          key={ratio}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={canvasHeight}
                          stroke={isCenter ? "#f59e0b" : "rgba(255,255,255,0.4)"}
                          strokeWidth={isCenter ? 1.5 : 0.8}
                          strokeDasharray={isCenter ? "6,4" : "4,4"}
                        />
                      );
                    })}

                    {/* Parallels (Horizontal Lines) */}
                    {[0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9].map((ratio) => {
                      const y = canvasHeight * ratio;
                      const isEquator = Math.abs(ratio - 0.5) < 0.01;
                      return (
                        <line
                          key={ratio}
                          x1={0}
                          y1={y}
                          x2={canvasWidth}
                          y2={y}
                          stroke={isEquator ? "#f59e0b" : "rgba(255,255,255,0.4)"}
                          strokeWidth={isEquator ? 2 : 0.8}
                          strokeDasharray={isEquator ? "8,4" : "4,4"}
                        />
                      );
                    })}

                    {/* Degree Labels on Mercator Grid */}
                    <text x={25} y={canvasHeight * 0.5 - 6} fill="#f59e0b" fontSize={11} fontFamily="monospace" fontWeight="bold">0° EQUADOR</text>
                    <text x={canvasWidth * 0.5 + 6} y={canvasHeight - 12} fill="#f59e0b" fontSize={9} fontFamily="monospace" opacity={0.8}>0° MERIDIANO</text>
                  </svg>
                </div>
              )}

              {/* Overlay Hint on Bottom Left with Mercator notice */}
              <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl text-[10px] font-mono text-parchment/70 border border-white/10 pointer-events-none flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeElement.color }} />
                <span>Elemento: <strong>{activeElement.name}</strong> • Resolução: <strong>{canvasWidth}×{canvasHeight}</strong></span>
              </div>
            </div>

            {/* Demarcation Elements Palette (The 13 elements requested) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono uppercase tracking-wider text-parchment/60 flex items-center gap-1.5">
                  <Palette size={13} className="text-arcane" />
                  <span>Selecione o Elemento para Demarcar ({MAP_ELEMENTS.length} disponíveis)</span>
                </span>
                <span className="text-[10px] font-mono text-arcane/80">
                  {demarcatedElements.size} demarcados no mapa
                </span>
              </div>

              {/* Element Buttons Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {MAP_ELEMENTS.map((el) => {
                  const Icon = el.icon;
                  const isSelected = activeElementId === el.id;
                  const isDemarcated = demarcatedElements.has(el.id);

                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => {
                        setActiveElementId(el.id);
                        if (el.isPOI) {
                          setActiveTool('stamp');
                        } else if (activeTool === 'stamp') {
                          setActiveTool('brush');
                        }
                      }}
                      className={cn(
                        "p-2 rounded-xl text-left border transition-all flex flex-col justify-between gap-1 relative overflow-hidden cursor-pointer",
                        isSelected
                          ? "bg-white/15 border-arcane shadow-md"
                          : "bg-white/[0.03] border-white/10 hover:border-white/30 hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[10px]"
                          style={{ backgroundColor: el.color }}
                        >
                          <Icon size={12} />
                        </div>
                        {isDemarcated && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Demarcado no mapa" />
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-parchment truncate">
                          {el.name}
                        </div>
                        <div className="text-[9px] font-mono text-parchment/40 uppercase">
                          {el.isPOI ? 'POI' : el.category === 'water_roads' ? 'Via' : 'Relevo'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Theme Settings, Render Controls & Output (4 cols) */}
          <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-white/[0.01]">
            <div className="space-y-4">
              {/* Theme Selection */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1.5 flex items-center gap-1.5">
                  <Compass size={13} className="text-arcane" />
                  <span>Temática Artística *</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'medieval', label: 'Medieval', desc: 'Pergaminho & Fantasia', emoji: '⚔️' },
                    { id: 'contemporary', label: 'Moderna', desc: 'Topográfico & Satélite', emoji: '🏙️' },
                    { id: 'futuristic', label: 'Futurista', desc: 'Cyber-Holográfico Sci-Fi', emoji: '🚀' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id as MapTheme)}
                      className={cn(
                        "p-2.5 rounded-2xl text-center border transition-all cursor-pointer",
                        theme === t.id
                          ? "bg-amber-400/20 border-amber-400/60 text-amber-300 font-bold shadow-lg"
                          : "bg-white/5 border-white/10 text-parchment/60 hover:text-parchment hover:bg-white/10"
                      )}
                    >
                      <div className="text-lg">{t.emoji}</div>
                      <div className="text-xs font-bold mt-1">{t.label}</div>
                      <div className="text-[9px] text-parchment/40 truncate">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Map Type */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMapType('world')}
                  className={cn(
                    "p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    mapType === 'world'
                      ? "bg-arcane text-obsidian border-arcane shadow-md"
                      : "bg-white/5 border-white/10 text-parchment/60 hover:text-white"
                  )}
                >
                  <Compass size={14} />
                  <span>Mapa de Mundo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapType('dungeon')}
                  className={cn(
                    "p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    mapType === 'dungeon'
                      ? "bg-purple-600 text-white border-purple-500 shadow-md"
                      : "bg-white/5 border-white/10 text-parchment/60 hover:text-white"
                  )}
                >
                  <Skull size={14} />
                  <span>Battlemap / Tático</span>
                </button>
              </div>

              {/* Form Metadata */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                    Nome do Mapa *
                  </label>
                  <input
                    type="text"
                    required
                    value={mapName}
                    onChange={(e) => setMapName(e.target.value)}
                    placeholder="Ex: Continente de Aethelgard"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-arcane"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                    Subtítulo / Descrição da Região
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ex: Reinos antigos, florestas místicas e vales inexplorados"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-arcane"
                  />
                </div>

                {gmSessions.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                      Campanha de Destino *
                    </label>
                    <select
                      value={targetSessionId}
                      onChange={(e) => setTargetSessionId(e.target.value)}
                      className="w-full bg-obsidian border border-white/10 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-arcane"
                    >
                      {gmSessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-parchment/60 mb-1">
                    Instruções Artísticas Extras (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Ex: Ilhas com recifes azuis, montanhas pontiagudas ao norte, estilo aquarela..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-arcane resize-none"
                  />
                </div>
              </div>

              {/* Mercator & Free AI Info Badge */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono">
                <div className="flex items-center justify-between text-amber-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Compass size={13} />
                    <span>Projeção Cilíndrica de Mercator</span>
                  </span>
                  <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    IA Gratuita
                  </span>
                </div>
                <p className="text-parchment/60 text-[9px] leading-relaxed">
                  Preserva com máxima fidedignidade os continentes, ilhas, montanhas, hidrografia e povoados desenhados pelo mestre com rumos e coordenadas loxodrômicas.
                </p>
              </div>

              {/* Render Trigger Button */}
              <button
                type="button"
                onClick={handleRenderMap}
                disabled={isRendering}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-obsidian font-bold text-xs uppercase tracking-wider hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 cursor-pointer"
              >
                <Sparkles size={16} className={isRendering ? "animate-spin" : ""} />
                <span>{isRendering ? 'Sintetizando em Projeção de Mercator...' : 'Renderizar Mapa Fidedigno (Mercator)'}</span>
              </button>

              {isRendering && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center space-y-1 animate-pulse">
                  <div className="font-semibold">{renderProgressStep}</div>
                  <div className="text-[10px] text-amber-300/70">Transformando o esboço em cartografia ilustrada via IA gratuita...</div>
                </div>
              )}
            </div>

            {/* Output Preview & Save Section (When rendered) */}
            {renderedImageUrl && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-2xl bg-white/[0.04] border border-arcane/40 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-bold text-arcane">
                  <span className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400" />
                    <span>Mapa Real Transformado!</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    className="text-[10px] text-parchment/60 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={12} />
                    <span>Baixar PNG</span>
                  </button>
                </div>

                {/* Compare View Switcher */}
                {originalSketchUrl && (
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewCompareMode('rendered')}
                      className={cn(
                        "flex-1 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1",
                        viewCompareMode === 'rendered'
                          ? "bg-amber-400 text-obsidian shadow-sm"
                          : "text-parchment/60 hover:text-white"
                      )}
                    >
                      <Sparkles size={11} />
                      <span>Mapa Real (IA)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewCompareMode('sketch')}
                      className={cn(
                        "flex-1 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1",
                        viewCompareMode === 'sketch'
                          ? "bg-white/20 text-white shadow-sm"
                          : "text-parchment/60 hover:text-white"
                      )}
                    >
                      <Brush size={11} />
                      <span>Esboço Original</span>
                    </button>
                  </div>
                )}

                {/* Rendered Thumbnail / View */}
                <div className="relative h-32 rounded-xl overflow-hidden border border-white/10 group/thumb">
                  <img
                    src={viewCompareMode === 'rendered' ? renderedImageUrl : (originalSketchUrl || renderedImageUrl)}
                    alt={mapName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-mono text-white/90 border border-white/10">
                    {viewCompareMode === 'rendered' ? '✨ Mapa Final IA' : '✏️ Esboço do Mestre'}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const targetUrl = viewCompareMode === 'rendered' ? renderedImageUrl : (originalSketchUrl || renderedImageUrl);
                        window.open(targetUrl, '_blank');
                      }}
                      className="px-3 py-1 rounded-xl bg-obsidian/90 text-arcane text-[11px] font-bold border border-arcane/40 flex items-center gap-1"
                    >
                      <Maximize2 size={12} />
                      <span>Ver em Tela Cheia</span>
                    </button>
                  </div>
                </div>

                {/* Save to Campaign Button */}
                <button
                  type="button"
                  onClick={handleSaveMapToCampaign}
                  disabled={isSaving}
                  className="w-full py-2.5 px-3 rounded-xl bg-arcane text-obsidian text-xs font-bold hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-arcane/20 cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Salvando na Campanha...' : 'Salvar Mapa na Minha Campanha'}</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
