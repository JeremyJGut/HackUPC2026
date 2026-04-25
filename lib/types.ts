export type TimelinePointType = "commit" | "push" | "restore" | "branch";

export type GitActionType = "commit" | "push" | "restore" | "branch";

export type BranchTrack = {
  name: string;
  color: string;
  headId: string;
  baseId?: string;
};

export type SavePoint = {
  id: string;
  label: string;
  description: string;
  timestamp: string;
  type: TimelinePointType;
  branch: string;
  parentId?: string;
  targetId?: string;
};

export type RepositoryState = {
  branchName: string;
  commits: SavePoint[];
  branches: BranchTrack[];
  workingChanges: string[];
  stagedChanges: number;
  pushedPointId?: string;
  remoteStatus: string;
  lastAction: GitActionType | "idle";
  headId: string;
};

export type GitAction = {
  type: GitActionType;
  label: string;
  naturalExplanation: string;
  gitTranslation: string[];
  accent: string;
  previewChanges: string[];
};

export type PendingAction = {
  action: GitAction;
  before: RepositoryState;
  after: RepositoryState;
  summary: string;
  backupLabel: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  kind?: "normal" | "confirmation" | "result" | "transcript" | "fallback";
};
