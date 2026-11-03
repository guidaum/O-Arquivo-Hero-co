import React from 'react';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc 
} from '../../firebase';
import { MapDrawingStroke } from '../../types/mapDrawing';
import { cn } from '../../lib/utils';

export const DRAWING_COLORS = [
  { name: 'Ciano Arcano', hex: '#38bdf8' },
  { name: 'Brasa / Vermelho', hex: '#ef4444' },
  { name: 'Ouro Real', hex: '#f59e0b' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Púrpura Mística', hex: '#c084fc' },
  { name: 'Rosa Choque', hex: '#f43f5e' },
  { name: 'Branco Puro', hex: '#ffffff' },
  { name: 'Sombra Ébano', hex: '#18181b' }
];

export const STROKE_SIZES = [
  { label: 'Fino', value: 2 },
  { label: 'Médio', value: 4 },
  { label: 'Grosso', value: 7 }
];

interface MapDrawingOverlayProps {
  mapId: string;
  sessionId?: string;
  collectionName: 'mapDrawings' | 'dungeonDrawings';
  isDrawingMode: boolean;
  drawingTool: 'pen' | 'polygon' | 'eraser';
  activeColor: string;
  strokeSize: number;
  isGM?: boolean;
  containerRef: React.RefObject<HTMLElement | null | any>;
  onStrokeStart?: () => void;
  onStrokeCreated?: (docId: string, stroke: MapDrawingStroke) => void;
  onStrokeDeleted?: (stroke: MapDrawingStroke) => void;
}

export const MapDrawingOverlay: React.FC<MapDrawingOverlayProps> = ({
  mapId,
  sessionId,
  collectionName,
  isDrawingMode,
  drawingTool,
  activeColor,
  strokeSize,
  isGM = false,
  containerRef,
  onStrokeStart,
  onStrokeCreated,
  onStrokeDeleted
}) => {
  const user = auth.currentUser;
  const [strokes, setStrokes] = React.useState<MapDrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = React.useState<MapDrawingStroke | null>(null);
  const [hoveredStrokeId, setHoveredStrokeId] = React.useState<string | null>(null);
  const isMouseDownRef = React.useRef(false);

  // 1. Real-time Strokes Listener from Firestore
  React.useEffect(() => {
    if (!mapId) return;

    let q = query(collection(db, collectionName), where('mapId', '==', mapId));
    if (sessionId) {
      q = query(
        collection(db, collectionName),
        where('mapId', '==', mapId),
        where('sessionId', '==', sessionId)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const list: MapDrawingStroke[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as MapDrawingStroke);
      });
      // Sort chronologically
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setStrokes(list);
    }, (err) => {
      console.warn(`Error subscribing to ${collectionName}:`, err);
    });

    return () => unsub();
  }, [mapId, sessionId, collectionName]);

  // Convert client coordinates to percentage relative to container
  const getCoordinatesPct = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2))
    };
  };

  // Pointer Down (Start drawing or add polygon vertex)
  const handleStart = (clientX: number, clientY: number) => {
    if (!isDrawingMode || drawingTool === 'eraser') return;

    const pt = getCoordinatesPct(clientX, clientY);
    if (!pt) return;

    // If using polygon tool and we already have an active stroke
    if (drawingTool === 'polygon' && currentStroke) {
      const p0 = currentStroke.points[0];
      const distToStart = Math.hypot(pt.x - p0.x, pt.y - p0.y);

      // If clicked near the start point and have at least 3 vertices: CLOSE and FILL!
      if (currentStroke.points.length >= 3 && distToStart < 4.5) {
        const closedStroke: MapDrawingStroke = {
          ...currentStroke,
          points: [...currentStroke.points, { ...p0 }],
          isClosed: true,
          isPolygon: true,
          fillColor: `${currentStroke.color}40`
        };
        saveStrokeToDb(closedStroke);
        setCurrentStroke(null);
        isMouseDownRef.current = false;
        return;
      }

      // Otherwise append vertex to current polygon
      setCurrentStroke(prev => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, pt]
        };
      });
      return;
    }

    isMouseDownRef.current = true;
    onStrokeStart?.();

    const newStroke: MapDrawingStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      mapId,
      sessionId: sessionId || '',
      points: [pt],
      color: activeColor,
      size: strokeSize,
      authorId: user?.uid || 'guest',
      authorName: user?.displayName || (isGM ? 'Mestre' : 'Jogador'),
      createdAt: Date.now(),
      isPolygon: drawingTool === 'polygon'
    };

    setCurrentStroke(newStroke);
  };

  // Pointer Move (Sampling points)
  const handleMove = (clientX: number, clientY: number) => {
    if (!currentStroke) return;

    const pt = getCoordinatesPct(clientX, clientY);
    if (!pt) return;

    if (drawingTool === 'pen' && isMouseDownRef.current) {
      const lastPoint = currentStroke.points[currentStroke.points.length - 1];
      if (lastPoint) {
        const dx = pt.x - lastPoint.x;
        const dy = pt.y - lastPoint.y;
        if (Math.hypot(dx, dy) < 0.25) return;
      }

      setCurrentStroke(prev => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, pt]
        };
      });
    }
  };

  // Save stroke to Firestore helper
  const saveStrokeToDb = async (strokeToSave: MapDrawingStroke) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        mapId: strokeToSave.mapId,
        sessionId: strokeToSave.sessionId || '',
        points: strokeToSave.points,
        color: strokeToSave.color,
        size: strokeToSave.size,
        authorId: strokeToSave.authorId,
        authorName: strokeToSave.authorName,
        createdAt: strokeToSave.createdAt,
        isClosed: Boolean(strokeToSave.isClosed),
        fillColor: strokeToSave.fillColor || `${strokeToSave.color}40`,
        isPolygon: Boolean(strokeToSave.isPolygon)
      });
      onStrokeCreated?.(docRef.id, { ...strokeToSave, id: docRef.id });
    } catch (err) {
      console.error(`Error saving stroke to ${collectionName}:`, err);
    }
  };

  // Pointer Up (Save stroke to Firestore for pen tool)
  const handleEnd = async () => {
    if (drawingTool === 'polygon') {
      // In polygon tool, we don't finish on mouseup; vertices are placed by clicking
      return;
    }

    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;

    if (!currentStroke || currentStroke.points.length < 2) {
      setCurrentStroke(null);
      return;
    }

    const strokeToSave = { ...currentStroke };
    setCurrentStroke(null);

    // Auto-detect closed loop: If end point is near start point (< 4.5%), close and fill interior!
    if (strokeToSave.points.length >= 3) {
      const p0 = strokeToSave.points[0];
      const pLast = strokeToSave.points[strokeToSave.points.length - 1];
      const dist = Math.hypot(pLast.x - p0.x, pLast.y - p0.y);
      if (dist < 4.5) {
        strokeToSave.isClosed = true;
        strokeToSave.fillColor = `${strokeToSave.color}40`;
        strokeToSave.points[strokeToSave.points.length - 1] = { ...p0 }; // Close seam perfectly
      }
    }

    await saveStrokeToDb(strokeToSave);
  };

  // Delete individual stroke
  const handleDeleteStroke = async (strokeId: string, authorId: string) => {
    if (!user) return;
    if (isGM || authorId === user.uid) {
      const targetStroke = strokes.find(s => s.id === strokeId);
      if (targetStroke) {
        onStrokeDeleted?.(targetStroke);
      }
      try {
        await deleteDoc(doc(db, collectionName, strokeId));
      } catch (err) {
        console.error('Error deleting stroke:', err);
      }
    }
  };

  // Check if current stroke start point is near cursor for snap indicator
  const startPt = currentStroke && currentStroke.points.length >= 3 ? currentStroke.points[0] : null;
  const lastPt = currentStroke && currentStroke.points.length >= 3 ? currentStroke.points[currentStroke.points.length - 1] : null;
  const isNearStart = startPt && lastPt && Math.hypot(lastPt.x - startPt.x, lastPt.y - startPt.y) < 4.5;

  return (
    <svg
      className={cn(
        "absolute inset-0 w-full h-full z-25",
        isDrawingMode && (drawingTool === 'pen' || drawingTool === 'polygon') && "cursor-crosshair",
        isDrawingMode && drawingTool === 'eraser' && "cursor-pointer",
        !isDrawingMode && "pointer-events-none"
      )}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.preventDefault();
          e.stopPropagation();
          handleStart(e.clientX, e.clientY);
        }
      }}
      onMouseMove={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMove(e.clientX, e.clientY);
      }}
      onMouseUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEnd();
      }}
      onMouseLeave={() => handleEnd()}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          handleStart(t.clientX, t.clientY);
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length > 0) {
          const t = e.touches[0];
          handleMove(t.clientX, t.clientY);
        }
      }}
      onTouchEnd={() => handleEnd()}
      onDoubleClick={(e) => {
        // Double-click in polygon mode to instantly close and fill
        if (drawingTool === 'polygon' && currentStroke && currentStroke.points.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          const p0 = currentStroke.points[0];
          const closedStroke: MapDrawingStroke = {
            ...currentStroke,
            points: [...currentStroke.points, { ...p0 }],
            isClosed: true,
            isPolygon: true,
            fillColor: `${currentStroke.color}40`
          };
          saveStrokeToDb(closedStroke);
          setCurrentStroke(null);
        }
      }}
    >
      {/* Existing Saved Strokes */}
      {strokes.map(stroke => {
        const pointsStr = stroke.points.map(p => `${p.x},${p.y}`).join(' ');
        const isHovered = hoveredStrokeId === stroke.id;

        return (
          <g key={stroke.id}>
            {/* Clickable thicker invisible hitbox in eraser mode */}
            {isDrawingMode && drawingTool === 'eraser' && (
              <polyline
                points={pointsStr}
                stroke="transparent"
                strokeWidth={Math.max(14, stroke.size * 2.8)}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={stroke.isClosed ? "transparent" : "none"}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredStrokeId(stroke.id)}
                onMouseLeave={() => setHoveredStrokeId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStroke(stroke.id, stroke.authorId);
                }}
              />
            )}

            {/* Visual Shape: Polygon with Fill if closed, or Polyline if open */}
            {stroke.isClosed ? (
              <polygon
                points={pointsStr}
                fill={isHovered && isDrawingMode && drawingTool === 'eraser' ? '#ef444430' : (stroke.fillColor || `${stroke.color}40`)}
                stroke={isHovered && isDrawingMode && drawingTool === 'eraser' ? '#ef4444' : stroke.color}
                strokeWidth={stroke.size * 0.25}
                strokeLinejoin="round"
                style={{
                  filter: stroke.color === '#ffffff' 
                    ? 'drop-shadow(0 0 1px rgba(0,0,0,0.9))' 
                    : `drop-shadow(0 0 2px ${stroke.color}80)`
                }}
              />
            ) : (
              <polyline
                points={pointsStr}
                stroke={isHovered && isDrawingMode && drawingTool === 'eraser' ? '#ef4444' : stroke.color}
                strokeWidth={stroke.size * 0.25} // Scaled for 0-100 coordinate space
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={isHovered && isDrawingMode && drawingTool === 'eraser' ? 0.95 : 0.88}
                fill="none"
                style={{
                  filter: stroke.color === '#ffffff' 
                    ? 'drop-shadow(0 0 1px rgba(0,0,0,0.9))' 
                    : `drop-shadow(0 0 1.5px ${stroke.color}80)`
                }}
              />
            )}
          </g>
        );
      })}

      {/* Current In-Progress Stroke / Polygon Preview */}
      {currentStroke && currentStroke.points.length > 0 && (
        <g>
          {isNearStart ? (
            // Preview closed polygon fill when tips touch!
            <polygon
              points={`${currentStroke.points.map(p => `${p.x},${p.y}`).join(' ')} ${currentStroke.points[0].x},${currentStroke.points[0].y}`}
              fill={`${currentStroke.color}40`}
              stroke={currentStroke.color}
              strokeWidth={currentStroke.size * 0.25}
              strokeLinejoin="round"
            />
          ) : (
            <polyline
              points={currentStroke.points.map(p => `${p.x},${p.y}`).join(' ')}
              stroke={currentStroke.color}
              strokeWidth={currentStroke.size * 0.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.9}
              fill="none"
            />
          )}

          {/* Magnetic Snap Target Circle on start point to close and fill */}
          {currentStroke.points.length >= 3 && (
            <g className="cursor-pointer">
              <circle
                cx={currentStroke.points[0].x}
                cy={currentStroke.points[0].y}
                r={isNearStart ? 2.5 : 1.8}
                fill={isNearStart ? "#10b981" : `${currentStroke.color}80`}
                stroke="#ffffff"
                strokeWidth={0.5}
                className={isNearStart ? "animate-pulse" : ""}
              />
              {isNearStart && (
                <text
                  x={currentStroke.points[0].x + 3}
                  y={currentStroke.points[0].y}
                  fontSize="2.2"
                  fill="#ffffff"
                  className="font-mono font-bold"
                  style={{ textShadow: '0 0 3px black' }}
                >
                  ✓ Fechar e Preencher
                </text>
              )}
            </g>
          )}
        </g>
      )}
    </svg>
  );
};
