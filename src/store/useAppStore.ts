import { create } from "zustand";

interface AppState {
  selectedProject: string | null;
  setSelectedProject: (project: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  selectedProject: null,
  setSelectedProject: (project) => set({ selectedProject: project }),
}));
