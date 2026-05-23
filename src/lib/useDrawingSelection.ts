import { useCallback, useState } from "react";

export interface DrawingSelectionHandle {
  selectedFilenames: string[];
  isSelected: (filename: string) => boolean;
  toggle: (filename: string) => void;
  reset: () => void;
}

export function useDrawingSelection(
  filenames: string[],
): DrawingSelectionHandle {
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const selectedFilenames = filenames.filter((f) => !deselected.has(f));

  const isSelected = useCallback(
    (f: string) => !deselected.has(f),
    [deselected],
  );

  const toggle = useCallback((filename: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  }, []);

  const reset = useCallback(() => setDeselected(new Set()), []);

  return { selectedFilenames, isSelected, toggle, reset };
}
