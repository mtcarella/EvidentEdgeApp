import { useRef, useEffect, useState, useCallback } from 'react';

export type AnnotationTool = 'none' | 'highlight' | 'draw' | 'text' | 'arrow' | 'eraser';

export interface Annotation {
  id: string;
  type: 'highlight' | 'draw' | 'text' | 'arrow';
  color: string;
  // All coordinates stored as percentages (0-100) of document dimensions
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Drawing points stored as percentages
  points?: { x: number; y: number }[];
  // Arrow endpoints as percentages
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  content?: string;
  author?: {
    id: string;
    name: string;
  };
  createdAt?: string;
  pageNumber?: number;
  textAnchor?: {
    startOffset: number;
    endOffset: number;
    nodeText: string;
  };
}

interface AnnotationCanvasProps {
  activeTool: AnnotationTool;
  activeColor: string;
  annotations: Annotation[];
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationErase: (id: string) => void;
  containerWidth: number;
  containerHeight: number;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Annotation overlay canvas that renders inside the document scroll container.
 * All annotation coordinates are stored as percentages of document dimensions
 * so they remain anchored to content regardless of zoom or resize.
 *
 * The parent component passes measured containerWidth/containerHeight so the
 * canvas buffer always matches the actual document content dimensions (unscaled).
 */
export function AnnotationCanvas({
  activeTool,
  activeColor,
  annotations,
  onAnnotationAdd,
  onAnnotationErase,
  containerWidth,
  containerHeight,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Sync canvas buffer to the measured content dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0 || containerHeight === 0) return;
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    renderAnnotations();
  }, [containerWidth, containerHeight, annotations]);

  const pctToPixel = useCallback((pctX: number, pctY: number) => ({
    x: (pctX / 100) * containerWidth,
    y: (pctY / 100) * containerHeight,
  }), [containerWidth, containerHeight]);

  const pixelToPct = useCallback((px: number, py: number) => ({
    x: containerWidth > 0 ? (px / containerWidth) * 100 : 0,
    y: containerHeight > 0 ? (py / containerHeight) * 100 : 0,
  }), [containerWidth, containerHeight]);

  const renderAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0 || containerHeight === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const annotation of annotations) {
      switch (annotation.type) {
        case 'highlight': {
          const coords = annotation.coordinates;
          if (!coords) break;
          const { x, y } = pctToPixel(coords.x, coords.y);
          const w = (coords.width / 100) * containerWidth;
          const h = (coords.height / 100) * containerHeight;
          ctx.fillStyle = annotation.color + '40';
          ctx.strokeStyle = annotation.color + '80';
          ctx.lineWidth = 1;
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          if (annotation.author?.name) {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = annotation.color + 'cc';
            ctx.fillText(annotation.author.name, x + 2, y - 3);
          }
          break;
        }

        case 'draw': {
          if (!annotation.points || annotation.points.length < 2) break;
          ctx.strokeStyle = annotation.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          const first = pctToPixel(annotation.points[0].x, annotation.points[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < annotation.points.length; i++) {
            const pt = pctToPixel(annotation.points[i].x, annotation.points[i].y);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          break;
        }

        case 'text': {
          const coords = annotation.coordinates;
          if (!coords || !annotation.content) break;
          const { x, y } = pctToPixel(coords.x, coords.y);
          const padding = 6;
          ctx.font = '13px sans-serif';
          const metrics = ctx.measureText(annotation.content);
          const textHeight = 16;
          ctx.fillStyle = '#fef9c3';
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 1;
          const boxW = metrics.width + padding * 2;
          const boxH = textHeight + padding * 2;
          ctx.beginPath();
          ctx.roundRect(x, y, boxW, boxH, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#1f2937';
          ctx.fillText(annotation.content, x + padding, y + padding + textHeight - 3);
          if (annotation.author?.name) {
            ctx.font = '9px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.fillText(annotation.author.name, x + padding, y + boxH + 10);
          }
          break;
        }

        case 'arrow': {
          if (annotation.startX === undefined || annotation.startY === undefined ||
              annotation.endX === undefined || annotation.endY === undefined) break;
          const start = pctToPixel(annotation.startX, annotation.startY);
          const end = pctToPixel(annotation.endX, annotation.endY);
          ctx.strokeStyle = annotation.color;
          ctx.fillStyle = annotation.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = 12;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
          break;
        }
      }
    }
  }, [annotations, containerWidth, containerHeight, pctToPixel]);

  /**
   * Convert mouse event to pixel coordinates within the canvas.
   * Uses offsetX/offsetY which are already relative to the target element,
   * automatically accounting for scroll position and CSS transforms.
   */
  const getLocalCoords = (e: React.MouseEvent): { x: number; y: number } => {
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'none') return;
    e.preventDefault();
    e.stopPropagation();

    const local = getLocalCoords(e);
    const pct = pixelToPct(local.x, local.y);

    if (activeTool === 'eraser') {
      const hit = findAnnotationAt(pct.x, pct.y);
      if (hit) onAnnotationErase(hit.id);
      return;
    }

    if (activeTool === 'text') {
      const content = prompt('Enter note text:');
      if (content) {
        onAnnotationAdd({
          id: generateId(),
          type: 'text',
          color: activeColor,
          coordinates: { x: pct.x, y: pct.y, width: 0, height: 0 },
          content,
          createdAt: new Date().toISOString(),
        });
      }
      return;
    }

    setIsDrawing(true);
    setStartPoint(pct);
    if (activeTool === 'draw') {
      setCurrentPoints([pct]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const local = getLocalCoords(e);
    const pct = pixelToPct(local.x, local.y);

    if (activeTool === 'draw') {
      setCurrentPoints(prev => [...prev, pct]);
      drawLiveStroke([...currentPoints, pct]);
    } else if (activeTool === 'highlight' || activeTool === 'arrow') {
      renderAnnotations();
      drawLiveShape(local);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const local = getLocalCoords(e);
    const pct = pixelToPct(local.x, local.y);

    if (activeTool === 'draw' && currentPoints.length > 1) {
      onAnnotationAdd({
        id: generateId(),
        type: 'draw',
        color: activeColor,
        points: currentPoints,
        createdAt: new Date().toISOString(),
      });
    } else if (activeTool === 'highlight' && startPoint) {
      const w = Math.abs(pct.x - startPoint.x);
      const h = Math.abs(pct.y - startPoint.y);
      if (w > 0.5 && h > 0.5) {
        onAnnotationAdd({
          id: generateId(),
          type: 'highlight',
          color: activeColor,
          coordinates: {
            x: Math.min(startPoint.x, pct.x),
            y: Math.min(startPoint.y, pct.y),
            width: w,
            height: h,
          },
          createdAt: new Date().toISOString(),
        });
      }
    } else if (activeTool === 'arrow' && startPoint) {
      const dx = pct.x - startPoint.x;
      const dy = pct.y - startPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) > 1) {
        onAnnotationAdd({
          id: generateId(),
          type: 'arrow',
          color: activeColor,
          startX: startPoint.x,
          startY: startPoint.y,
          endX: pct.x,
          endY: pct.y,
          createdAt: new Date().toISOString(),
        });
      }
    }

    setCurrentPoints([]);
    setStartPoint(null);
    renderAnnotations();
  };

  const drawLiveStroke = (points: { x: number; y: number }[]) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderAnnotations();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const first = pctToPixel(points[0].x, points[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const pt = pctToPixel(points[i].x, points[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  };

  const drawLiveShape = (localCurrent: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas || !startPoint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startPx = pctToPixel(startPoint.x, startPoint.y);

    if (activeTool === 'highlight') {
      const x = Math.min(startPx.x, localCurrent.x);
      const y = Math.min(startPx.y, localCurrent.y);
      const w = Math.abs(localCurrent.x - startPx.x);
      const h = Math.abs(localCurrent.y - startPx.y);
      ctx.fillStyle = activeColor + '40';
      ctx.strokeStyle = activeColor + '80';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else if (activeTool === 'arrow') {
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startPx.x, startPx.y);
      ctx.lineTo(localCurrent.x, localCurrent.y);
      ctx.stroke();
      const angle = Math.atan2(localCurrent.y - startPx.y, localCurrent.x - startPx.x);
      const headLen = 12;
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.moveTo(localCurrent.x, localCurrent.y);
      ctx.lineTo(localCurrent.x - headLen * Math.cos(angle - Math.PI / 6), localCurrent.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(localCurrent.x - headLen * Math.cos(angle + Math.PI / 6), localCurrent.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  };

  const findAnnotationAt = (pctX: number, pctY: number): Annotation | null => {
    const hitRadius = 1.5;
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      switch (a.type) {
        case 'highlight': {
          const c = a.coordinates;
          if (c && pctX >= c.x && pctX <= c.x + c.width && pctY >= c.y && pctY <= c.y + c.height) return a;
          break;
        }
        case 'draw':
          if (a.points) {
            for (const p of a.points) {
              if (Math.abs(p.x - pctX) < hitRadius && Math.abs(p.y - pctY) < hitRadius) return a;
            }
          }
          break;
        case 'text': {
          const c = a.coordinates;
          if (c && pctX >= c.x && pctX <= c.x + 15 && pctY >= c.y && pctY <= c.y + 4) return a;
          break;
        }
        case 'arrow': {
          if (a.startX !== undefined && a.startY !== undefined && a.endX !== undefined && a.endY !== undefined) {
            const dist = pointToLineDistancePct(pctX, pctY, a.startX, a.startY, a.endX, a.endY);
            if (dist < hitRadius) return a;
          }
          break;
        }
      }
    }
    return null;
  };

  const cursorStyle = activeTool === 'none' ? 'default'
    : activeTool === 'eraser' ? 'not-allowed'
    : activeTool === 'text' ? 'text'
    : 'crosshair';

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{
        width: containerWidth,
        height: containerHeight,
        cursor: cursorStyle,
        pointerEvents: activeTool !== 'none' ? 'auto' : 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDrawing) {
          setIsDrawing(false);
          setCurrentPoints([]);
          setStartPoint(null);
        }
      }}
    />
  );
}

function pointToLineDistancePct(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;
  if (param < 0) param = 0;
  else if (param > 1) param = 1;
  const xx = x1 + param * C;
  const yy = y1 + param * D;
  return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
}
