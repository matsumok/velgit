export const queryKeys = {
  drawings: (project: string) => ["drawings", project] as const,
  pendingChanges: (project: string) => ["pending_changes", project] as const,
  // project を含めることで複数プロジェクト間のキャッシュ混在を防ぐ
  commitHistoryBase: (project: string) => ["commit_history", project] as const,
  commitHistory: (project: string, drawing: string) =>
    ["commit_history", project, drawing] as const,
  releases: (project: string) => ["releases", project] as const,
  releaseDrawings: (releaseId: number) =>
    ["release_drawings", releaseId] as const,
  projectCommits: (project: string) => ["project_commits", project] as const,
  drawingsAtCommit: (project: string, oid: string) =>
    ["drawings_at_commit", project, oid] as const,
};
