import { spawnSync } from "node:child_process";
import path from "node:path";

import type {
  BranchTrack,
  GitChangedFile,
  GitOperationResponse,
  RepoStatusResponse,
  RepositoryState,
  SavePoint,
} from "@/lib/types";

const branchPalette = [
  "#34d399",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
];

function repositoryPath() {
  return process.env.GITEASE_REPO_PATH
    ? path.resolve(process.env.GITEASE_REPO_PATH)
    : process.cwd();
}

function runGit(args: string[], cwd = repositoryPath()) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 20000,
  });

  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status ?? 1,
  };
}

function assertRepository() {
  const check = runGit(["rev-parse", "--is-inside-work-tree"]);

  if (!check.ok) {
    throw new Error("La carpeta actual no es un repositorio Git válido.");
  }
}

function formatTimestamp(raw: string) {
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function branchColor(index: number) {
  return branchPalette[index % branchPalette.length];
}

function parseChangedFiles(output: string): GitChangedFile[] {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim() || "M",
      file: line.slice(3).trim(),
    }));
}

function labelForCommit(index: number, message: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter = alphabet[index] ?? String(index + 1);
  return `Punto ${letter}`;
}

function descriptionForCommit(message: string) {
  return message.length > 68 ? `${message.slice(0, 65)}...` : message;
}

function buildBranches(commits: SavePoint[]) {
  const branchHeads = new Map<string, string>();
  const branchBases = new Map<string, string | undefined>();

  for (const point of commits) {
    branchHeads.set(point.branch, point.id);
    if (!branchBases.has(point.branch)) {
      branchBases.set(point.branch, point.parentId);
    }
  }

  return [...branchHeads.entries()].map(([name, headId], index) => ({
    name,
    headId,
    baseId: branchBases.get(name),
    color: branchColor(index),
  }));
}

function currentBranchName() {
  const branch = runGit(["branch", "--show-current"]);
  return branch.ok && branch.stdout ? branch.stdout : "HEAD";
}

function currentRemoteStatus(branchName: string, hasRemote: boolean) {
  if (!hasRemote) {
    return "No hay remoto configurado todavía";
  }

  const upstream = runGit(["rev-parse", "--abbrev-ref", `${branchName}@{upstream}`]);
  if (!upstream.ok) {
    return "La rama local aún no tiene upstream remoto";
  }

  const aheadBehind = runGit(["rev-list", "--left-right", "--count", `${branchName}...${upstream.stdout}`]);
  if (!aheadBehind.ok) {
    return "No pude calcular el estado con la nube";
  }

  const [aheadRaw = "0", behindRaw = "0"] = aheadBehind.stdout.split(/\s+/);
  const ahead = Number.parseInt(aheadRaw, 10) || 0;
  const behind = Number.parseInt(behindRaw, 10) || 0;

  if (ahead === 0 && behind === 0) {
    return "Sincronizado con el remoto";
  }
  if (ahead > 0 && behind === 0) {
    return `${ahead} cambio(s) pendientes de subir`;
  }
  if (behind > 0 && ahead === 0) {
    return `${behind} cambio(s) pendientes de traer`;
  }
  return `${ahead} pendiente(s) de subir y ${behind} pendiente(s) de traer`;
}

function countStagedChanges(changedFiles: GitChangedFile[]) {
  return changedFiles.filter((file) => file.status.length > 1 && file.status[0] !== " ").length;
}

function mapGitType(message: string, branch: string, currentBranch: string): SavePoint["type"] {
  if (/merge|branch/i.test(message) && branch !== currentBranch) {
    return "branch";
  }
  if (/push|sync|publish/i.test(message)) {
    return "push";
  }
  if (/reset|restore|revert/i.test(message)) {
    return "restore";
  }
  return "commit";
}

export function readRepositoryState(): RepositoryState {
  assertRepository();

  const cwd = repositoryPath();
  const branchName = currentBranchName();
  const detached = branchName === "HEAD";

  const remoteNames = runGit(["remote"], cwd);
  const hasRemote = remoteNames.ok && Boolean(remoteNames.stdout);
  const remoteUrl = hasRemote ? runGit(["remote", "get-url", "origin"], cwd) : null;

  const log = runGit(
    [
      "log",
      "--date=iso-strict",
      "--pretty=format:%H|||%P|||%an|||%ad|||%s|||%D",
      "--all",
      "--reverse",
      "--max-count=80",
    ],
    cwd,
  );

  const commits: SavePoint[] = log.ok
    ? log.stdout
        .split("\n")
        .filter(Boolean)
        .map((line, index) => {
          const [hash, parents, , rawDate, subject, decorations] = line.split("|||");
          const branchFromDecoration =
            decorations
              ?.split(",")
              .map((item) => item.trim())
              .find((item) => !item.startsWith("HEAD") && !item.startsWith("origin/"))
              ?.replace("tag: ", "") ?? branchName;
          const parentId = parents?.split(" ").filter(Boolean)[0];
          const type = mapGitType(subject, branchFromDecoration, branchName);

          return {
            id: hash,
            label: labelForCommit(index, subject),
            description: descriptionForCommit(subject),
            timestamp: formatTimestamp(rawDate),
            type,
            branch: branchFromDecoration,
            parentId,
          };
        })
    : [];

  const changedFilesRaw = runGit(["status", "--porcelain"], cwd);
  const changedFiles = changedFilesRaw.ok ? parseChangedFiles(changedFilesRaw.stdout) : [];
  const workingChanges = changedFiles.map((file) => file.file);
  const stagedChanges = countStagedChanges(changedFiles);

  const head = runGit(["rev-parse", "HEAD"], cwd);
  const headId = head.ok ? head.stdout : commits.at(-1)?.id ?? "";

  const pushedPointId =
    hasRemote && runGit(["rev-parse", "--verify", "origin/" + (detached ? "main" : branchName)], cwd).ok
      ? runGit(["rev-parse", "--verify", "origin/" + (detached ? "main" : branchName)], cwd).stdout
      : undefined;

  const branches = buildBranches(commits);

  return {
    branchName: detached ? commits.find((point) => point.id === headId)?.branch ?? "detached" : branchName,
    commits,
    branches,
    workingChanges,
    changedFiles,
    stagedChanges,
    pushedPointId,
    remoteStatus: currentRemoteStatus(detached ? "main" : branchName, hasRemote),
    lastAction: "idle",
    headId,
    repoPath: cwd,
    hasRemote,
    remoteUrl: remoteUrl?.ok ? remoteUrl.stdout : null,
    isDetachedHead: detached,
  };
}

function successfulOperation(message: string, backupBranch?: string): GitOperationResponse {
  return {
    ok: true,
    repository: readRepositoryState(),
    message,
    backupBranch,
  };
}

export function readRepositoryStatus(): RepoStatusResponse {
  const repository = readRepositoryState();
  return {
    branchName: repository.branchName,
    headId: repository.headId,
    stagedChanges: repository.stagedChanges,
    workingChanges: repository.workingChanges,
    changedFiles: repository.changedFiles ?? [],
    remoteStatus: repository.remoteStatus,
    isDetachedHead: Boolean(repository.isDetachedHead),
  };
}

export function commitAllChanges(message: string) {
  assertRepository();

  const add = runGit(["add", "-A"]);
  if (!add.ok) {
    throw new Error(add.stderr || "No pude preparar los archivos para el commit.");
  }

  const status = runGit(["status", "--porcelain"]);
  if (!status.ok || !status.stdout) {
    throw new Error("No hay cambios para guardar.");
  }

  const commit = runGit(["commit", "-m", message.trim()]);
  if (!commit.ok) {
    throw new Error(commit.stderr || "No pude crear el commit.");
  }

  return successfulOperation(`He creado el commit "${message.trim()}".`);
}

export function pushCurrentBranch() {
  assertRepository();

  const branchName = currentBranchName();
  const push = runGit(["push", "origin", branchName]);

  if (!push.ok) {
    const retry = runGit(["push", "--set-upstream", "origin", branchName]);
    if (!retry.ok) {
      throw new Error(retry.stderr || push.stderr || "No pude subir la rama al remoto.");
    }
  }

  return successfulOperation(`La rama ${branchName} se ha sincronizado con la nube.`);
}

export function resetHeadSoft() {
  assertRepository();

  const backupBranch = `gitease-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  runGit(["branch", backupBranch]);

  const reset = runGit(["reset", "--soft", "HEAD~1"]);
  if (!reset.ok) {
    throw new Error(reset.stderr || "No pude volver al commit anterior.");
  }

  return successfulOperation("He preparado un regreso al punto anterior.", backupBranch);
}

export function createBranchAndCheckout(name: string) {
  assertRepository();

  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._/-]/g, "");

  const result = runGit(["checkout", "-b", safeName]);
  if (!result.ok) {
    throw new Error(result.stderr || "No pude crear la nueva rama.");
  }

  return successfulOperation(`He creado y activado la rama ${safeName}.`);
}

export function checkoutReference(reference: string) {
  assertRepository();

  const result = runGit(["checkout", reference]);
  if (!result.ok) {
    throw new Error(result.stderr || `No pude hacer checkout a ${reference}.`);
  }

  return successfulOperation(`HEAD movido a ${reference}.`);
}

export function mergeBranch(sourceBranch: string) {
  assertRepository();

  const safeBranch = sourceBranch.trim();
  if (!safeBranch) {
    throw new Error("Debes indicar una rama para hacer merge.");
  }

  const result = runGit(["merge", safeBranch]);
  if (!result.ok) {
    throw new Error(result.stderr || `No pude fusionar la rama ${safeBranch}.`);
  }

  return successfulOperation(`He fusionado ${safeBranch} en la rama actual.`);
}

export function rebaseOnto(sourceBranch: string) {
  assertRepository();

  const safeBranch = sourceBranch.trim();
  if (!safeBranch) {
    throw new Error("Debes indicar una rama base para hacer rebase.");
  }

  const result = runGit(["rebase", safeBranch]);
  if (!result.ok) {
    throw new Error(result.stderr || `No pude rebasar sobre ${safeBranch}.`);
  }

  return successfulOperation(`He rehecho la historia actual sobre ${safeBranch}.`);
}
