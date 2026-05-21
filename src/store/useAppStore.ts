import { create } from "zustand";

interface AppState {
  selectedProject: string | null;
  selectedDiscipline: string | null;
  setSelectedProject: (project: string | null) => void;
  setSelectedDiscipline: (discipline: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  selectedProject: null,
  selectedDiscipline: null,
  setSelectedProject: (project) => set({ selectedProject: project }),
  setSelectedDiscipline: (discipline) =>
    set({ selectedDiscipline: discipline }),
}));
