import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageUrl: string;
  initialX?: number | null;
  initialY?: number | null;
  initialNote?: string | null;
  onSave: (data: { x: number | null; y: number | null; note: string | null }) => Promise<void> | void;
}

const PhotoMarkerDialog = ({ open, onOpenChange, imageUrl, initialX, initialY, initialNote, onSave }: Props) => {
  const [x, setX] = useState<number | null>(initialX ?? null);
  const [y, setY] = useState<number | null>(initialY ?? null);
  const [note, setNote] = useState<string>(initialNote ?? '');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (open) {
      setX(initialX ?? null);
      setY(initialY ?? null);
      setNote(initialNote ?? '');
    }
  }, [open, initialX, initialY, initialNote]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    setX(Math.max(0, Math.min(1, nx)));
    setY(Math.max(0, Math.min(1, ny)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark defect location</DialogTitle>
        </DialogHeader>
        <div
          className="relative w-full cursor-crosshair select-none rounded-md overflow-hidden border border-border"
          onClick={handleClick}
        >
          <img ref={imgRef} src={imageUrl} alt="" className="w-full h-auto block" draggable={false} />
          {x !== null && y !== null && (
            <div
              className="absolute w-4 h-4 rounded-full bg-primary border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            />
          )}
        </div>
        <Input
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 200))}
          placeholder="Optional short note (e.g. crack near hinge)"
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => { setX(null); setY(null); setNote(''); }}>
            Clear
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            await onSave({ x, y, note: note.trim() || null });
            onOpenChange(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoMarkerDialog;
