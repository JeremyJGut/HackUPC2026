export type TimelinePointType = "commit" | "push" | "restore" | "branch" | "merge" | "rebase";

export type GitActionType = "commit" | "push" | "restore" | "branch" | "merge" | "rebase";

export type BranchTrack = {
  name: string;
  color: string;
  headId: string;
  baseId?: string;
};

export type GitChangedFile = {
  status: string;
  file: string;
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
  changedFiles?: GitChangedFile[];
  stagedChanges: number;
  pushedPointId?: string;
  remoteStatus: string;
  lastAction: GitActionType | "idle";
  headId: string;
  repoPath?: string;
  hasRemote?: boolean;
  remoteUrl?: string | null;
  isDetachedHead?: boolean;
};

export type GitAction = {
  type: GitActionType;
  label: string;
  naturalExplanation: string;
  gitTranslation: string[];
  accent: string;
  previewChanges: string[];
  targetBranch?: string;
};

export type PendingAction = {
  action: GitAction;
  before: RepositoryState;
  after: RepositoryState;
  summary: string;
  backupLabel: string;
};

export type CheckoutSimulation = {
  repository: RepositoryState;
  selectedPoint: SavePoint;
  message: string;
};

export type RepoApiResponse = {
  repository: RepositoryState;
};

export type RepoStatusResponse = {
  branchName: string;
  headId: string;
  stagedChanges: number;
  workingChanges: string[];
  changedFiles: GitChangedFile[];
  remoteStatus: string;
  isDetachedHead: boolean;
};

export type GitOperationResponse = {
  ok: boolean;
  repository: RepositoryState;
  message: string;
  backupBranch?: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  kind?: "normal" | "confirmation" | "result" | "transcript" | "fallback";
};
