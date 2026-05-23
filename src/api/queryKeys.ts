export const queryKeys = {
  drawings: (project: string) => ["drawings", project] as const,
  pendingChanges: (project: string) => ["pending_changes", project] as const,
  commitHistory: (drawing: string) => ["commit_history", drawing] as const,
  releases: (project: string) => ["releases", project] as const,
  releaseDrawings: (releaseId: number) =>
    ["release_drawings", releaseId] as const,
};
