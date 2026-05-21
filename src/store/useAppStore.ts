import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedProject: string | null;
  setSelectedProject: (project: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedProject: null,
      setSelectedProject: (project) => set({ selectedProject: project }),
    }),
    { name: "velgit-store" },
  ),
);
