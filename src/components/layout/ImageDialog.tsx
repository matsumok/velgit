import { useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";

interface ImageDialogProps {
  src: string;
  alt: string;
}

export function ImageDialog({ src, alt }: ImageDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-zoom-in block border-0 bg-transparent p-0"
      >
        <img src={src} alt={alt} className="w-full" draggable={false} />
      </button>
      <DialogContent className="sm:max-w-4xl overflow-auto p-2">
        <img src={src} alt={alt} className="w-full" draggable={false} />
      </DialogContent>
    </Dialog>
  );
}
