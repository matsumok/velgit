import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedProject: string | null;
  setSelectedProject: (project: string | null) => void;
  selectedDrawing: string | null;
  setSelectedDrawing: (filename: string | null) => void;
  selectedCommitOid: string | "HEAD";
  setSelectedCommitOid: (oid: string | "HEAD") => void;
  username: string | null;
  setUsername: (name: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedProject: null,
      setSelectedProject: (project) =>
        set({ selectedProject: project, selectedCommitOid: "HEAD", selectedDrawing: null }),
      selectedDrawing: null,
      setSelectedDrawing: (filename) => set({ selectedDrawing: filename }),
      selectedCommitOid: "HEAD",
      setSelectedCommitOid: (oid) => set({ selectedCommitOid: oid }),
      username: null,
      setUsername: (name) => set({ username: name }),
    }),
    { name: "velgit-store" },
  ),
);
