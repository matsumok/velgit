import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Job {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

interface AppState {
  selectedProject: string | null;
  setSelectedProject: (project: string | null) => void;
  selectedDrawing: string | null;
  setSelectedDrawing: (filename: string | null) => void;
  selectedCommitOid: string | "HEAD";
  setSelectedCommitOid: (oid: string | "HEAD") => void;
  username: string | null;
  setUsername: (name: string) => void;
  jobs: Job[];
  addJob: (job: Job) => void;
  removeJob: (id: string) => void;
  selectedJobId: string | null;
  selectJob: (id: string | null) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  isProjectReady: boolean;
  setProjectReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedProject: null,
      setSelectedProject: (project) =>
        set({
          selectedProject: project,
          selectedCommitOid: "HEAD",
          selectedDrawing: null,
        }),
      selectedDrawing: null,
      setSelectedDrawing: (filename) => set({ selectedDrawing: filename }),
      selectedCommitOid: "HEAD",
      setSelectedCommitOid: (oid) => set({ selectedCommitOid: oid }),
      username: null,
      setUsername: (name) => set({ username: name }),
      jobs: [],
      addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),
      removeJob: (id) =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== id),
          selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
        })),
      selectedJobId: null,
      selectJob: (id) => {
        const { jobs } = get();
        const job = id ? (jobs.find((j) => j.id === id) ?? null) : null;
        set({
          selectedJobId: id,
          selectedProject: job?.path ?? null,
          selectedCommitOid: "HEAD",
          selectedDrawing: null,
          isProjectReady: false,
        });
      },
      theme: "light",
      setTheme: (theme) => set({ theme }),
      isProjectReady: false,
      setProjectReady: (ready) => set({ isProjectReady: ready }),
    }),
    {
      name: "velgit-store",
      partialize: (state) => ({
        selectedProject: state.selectedProject,
        selectedDrawing: state.selectedDrawing,
        selectedCommitOid: state.selectedCommitOid,
        username: state.username,
        jobs: state.jobs,
        selectedJobId: state.selectedJobId,
        theme: state.theme,
        // isProjectReady は永続化しない（起動時は常に false）
      }),
    },
  ),
);
