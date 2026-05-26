import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_FACTOR = 0.15;

interface ImageDialogProps {
  src: string;
  alt: string;
}

export function ImageDialog({ src, alt }: ImageDialogProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // containerEl を state で管理することで、ポータルへのマウント後に effect が確実に発火する
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const stateRef = useRef({ scale: 1, translate: { x: 0, y: 0 } });
  const dragRef = useRef({ startX: 0, startY: 0, tx: 0, ty: 0 });

  const reset = useCallback(() => {
    stateRef.current = { scale: 1, translate: { x: 0, y: 0 } };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!containerEl) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: s, translate: t } = stateRef.current;
      const delta = e.deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + s * delta));
      const rect = containerEl.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = newScale / s;
      const newTranslate = {
        x: cx - factor * (cx - t.x),
        y: cy - factor * (cy - t.y),
      };
      stateRef.current = { scale: newScale, translate: newTranslate };
      setScale(newScale);
      setTranslate(newTranslate);
    };

    containerEl.addEventListener("wheel", onWheel, { passive: false });
    return () => containerEl.removeEventListener("wheel", onWheel);
  }, [containerEl]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (stateRef.current.scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      tx: stateRef.current.translate.x,
      ty: stateRef.current.translate.y,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newTranslate = {
      x: dragRef.current.tx + (e.clientX - dragRef.current.startX),
      y: dragRef.current.ty + (e.clientY - dragRef.current.startY),
    };
    stateRef.current.translate = newTranslate;
    setTranslate(newTranslate);
  };

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="w-full cursor-zoom-in p-0 h-auto"
      >
        <img src={src} alt={alt} className="w-full" draggable={false} />
      </Button>
      <DialogContent className="sm:max-w-4xl p-2 overflow-hidden">
        <div
          ref={setContainerEl}
          role="application"
          aria-label="図面ビューアー（ドラッグでパン、ダブルクリックでリセット）"
          className={cn(
            "relative overflow-hidden w-full select-none",
            isDragging
              ? "cursor-grabbing"
              : scale > 1
                ? "cursor-grab"
                : "cursor-zoom-in",
          )}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={reset}
        >
          <img
            src={src}
            alt={alt}
            className="w-full pointer-events-none"
            draggable={false}
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          />
        </div>
        {scale > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="absolute bottom-4 right-4"
          >
            リセット
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
