import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  onSave: (svgData: string) => void;
  initialValue?: string;
  disabled?: boolean;
}

const SignaturePad = ({ onSave, initialValue, disabled }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const pathsRef = useRef<{ x: number; y: number }[][]>([]);
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    currentPathRef.current = [pos];
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const pos = getPos(e);
    currentPathRef.current.push(pos);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#1A1A1A';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPathRef.current.length > 1) {
      pathsRef.current.push([...currentPathRef.current]);
      setHasDrawn(true);
    }
    currentPathRef.current = [];
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    pathsRef.current = [];
    setHasDrawn(false);
  };

  const toSVG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    const w = canvas.width;
    const h = canvas.height;
    let pathD = '';
    for (const path of pathsRef.current) {
      if (path.length < 2) continue;
      pathD += `M${path[0].x.toFixed(1)},${path[0].y.toFixed(1)} `;
      for (let i = 1; i < path.length; i++) {
        pathD += `L${path[i].x.toFixed(1)},${path[i].y.toFixed(1)} `;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${pathD}" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }, []);

  const handleSave = () => {
    const svg = toSVG();
    onSave(svg);
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-32 cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled}>
          <Eraser className="w-4 h-4 mr-1" /> Clear
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={!hasDrawn || disabled}>
          <Check className="w-4 h-4 mr-1" /> Confirm Signature
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
