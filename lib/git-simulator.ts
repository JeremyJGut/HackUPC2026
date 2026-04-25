import type {
  BranchTrack,
  ChatMessage,
  GitAction,
  GitChangedFile,
  RepositoryState,
  SavePoint,
} from "./types";

const examplesByAction = {
  commit: [
    "Se prepara todo lo que cambiaste",
    "Se crea un nuevo Punto de Guardado en la historia",
    "Tu trabajo queda listo para recuperar o compartir",
  ],
  push: [
    "Tu último Punto de Guardado se envía a la nube",
    "La copia remota queda sincronizada",
    "Puedes seguir trabajando con tranquilidad",
  ],
  restore: [
    "Se recupera una versión anterior segura",
    "Mantienes una referencia clara del cambio",
    "La interfaz te muestra el salto temporal antes de aplicarlo",
  ],
  merge: [
    "Se combinan dos historias en una sola línea",
    "La rama principal absorbe los cambios de otra rama",
    "El historial mostrará un punto de unión entre ambas líneas",
  ],
  rebase: [
    "Se reordena tu trabajo sobre una base más reciente",
    "Tu rama reaparece como si hubiera nacido después",
    "La historia queda más lineal y limpia visualmente",
  ],
} as const;

const containsAny = (text: string, candidates: string[]) =>
  candidates.some((candidate) => text.includes(candidate));

const matchesAny = (text: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(text));

function isoMinutesAgo(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function createPoint(
  id: string,
  label: string,
  description: string,
  type: SavePoint["type"],
  branch = "main",
  timestamp = new Date().toISOString(),
  parentId?: string,
  targetId?: string,
): SavePoint {
  return { id, label, description, timestamp, type, branch, parentId, targetId };
}

function cloneRepository(repository: RepositoryState): RepositoryState {
  return {
    ...repository,
    commits: repository.commits.map((point) => ({ ...point })),
    branches: repository.branches.map((branch) => ({ ...branch })),
    workingChanges: [...repository.workingChanges],
  };
}

function nextPointLabel(count: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `Punto ${alphabet[count] ?? count + 1}`;
}

function nextPointId(count: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return `point-${alphabet[count] ?? count + 1}`;
}

const branchPalette = [
  "#34d399",
  "#60a5fa",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
];

function buildBranch(name: string, headId: string, index: number, baseId?: string): BranchTrack {
  return {
    name,
    headId,
    baseId,
    color: branchPalette[index % branchPalette.length],
  };
}

function updateBranchHead(repository: RepositoryState, branchName: string, headId: string) {
  repository.branches = repository.branches.map((branch) =>
    branch.name === branchName ? { ...branch, headId } : branch,
  );
}

function getCurrentHead(repository: RepositoryState) {
  return repository.commits.find((point) => point.id === repository.headId) ?? repository.commits.at(-1);
}

export function createInitialRepository(): RepositoryState {
  const pointA = createPoint(
    "point-a",
    "Punto A",
    "Base estable del proyecto",
    "commit",
    "main",
    isoMinutesAgo(180),
  );
  const pointB = createPoint(
    "point-b",
    "Punto B",
    "Nueva pantalla de bienvenida",
    "commit",
    "main",
    isoMinutesAgo(95),
    "point-a",
  );
  const pointC = createPoint(
    "point-c",
    "Punto C",
    "Textos refinados para presentar la demo",
    "commit",
    "main",
    isoMinutesAgo(25),
    "point-b",
  );

  return {
    branchName: "main",
    commits: [pointA, pointB, pointC],
    branches: [buildBranch("main", "point-c", 0)],
    workingChanges: [
      "Nuevo copy para el chat guiado",
      "Ajustes visuales en el panel central",
      "Estado de voz listo para demostración",
    ],
    stagedChanges: 3,
    pushedPointId: "point-b",
    remoteStatus: "Tienes cambios recientes pendientes de subir",
    lastAction: "idle",
    headId: "point-c",
  };
}

export function createInitialMessages(): ChatMessage[] {
  return [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      subject: 'Gitly "Bienvenida"',
      content:
        "Hola, soy Gitly. Puedes decir cosas como “Guarda lo que he hecho ahora”, “Súbelo a internet” o “Quiero volver a lo de ayer”.",
      timestamp: new Date().toISOString(),
      kind: "normal",
    },
  ];
}

function branchColorForIndex(index: number) {
  return branchPalette[index % branchPalette.length];
}

function deriveLabel(point: {
  type: SavePoint["type"];
  branch: string;
  msg?: string;
  hash?: string;
}) {
  if (point.type === "push") {
    return point.msg || "Sincronizado";
  }

  if (point.type === "branch") {
    return point.msg || `Rama ${point.branch}`;
  }

  return point.msg || point.hash || "Punto de guardado";
}

function deriveDescription(point: {
  type: SavePoint["type"];
  msg?: string;
  author?: string;
  branch: string;
}) {
  if (point.type === "push") {
    return point.msg || "Copia compartida en la nube";
  }

  if (point.type === "branch") {
    return point.msg || `Cambio de contexto hacia ${point.branch}`;
  }

  if (point.author) {
    return `${point.msg || "Sin mensaje"} · ${point.author}`;
  }

  return point.msg || "Guardado real del repositorio";
}

type GitBackendCommit = {
  id: string;
  hash: string;
  msg: string;
  time: string;
  author?: string;
  branch?: string;
  type?: SavePoint["type"];
  parentId?: string;
  targetId?: string;
};

type GitBackendBranch = {
  name: string;
  color?: string;
  headId: string;
  baseId?: string;
};

export function repositoryFromBackend(data: {
  branchName: string;
  commits: GitBackendCommit[];
  branches: GitBackendBranch[];
  changedFiles?: GitChangedFile[];
  stagedChanges: number;
  pushedPointId?: string;
  remoteStatus: string;
  headId: string;
  repoPath?: string;
  hasRemote?: boolean;
  remoteUrl?: string | null;
  isDetachedHead?: boolean;
}): RepositoryState {
  const commits = data.commits.map((commit) =>
    createPoint(
      commit.id,
      deriveLabel({
        type: commit.type ?? "commit",
        branch: commit.branch ?? data.branchName,
        msg: commit.msg,
        hash: commit.hash,
      }),
      deriveDescription({
        type: commit.type ?? "commit",
        msg: commit.msg,
        author: commit.author,
        branch: commit.branch ?? data.branchName,
      }),
      commit.type ?? "commit",
      commit.branch ?? data.branchName,
      commit.time,
      commit.parentId,
      commit.targetId,
    ),
  );

  const branches = data.branches.map((branch, index) => ({
    name: branch.name,
    headId: branch.headId,
    baseId: branch.baseId,
    color: branch.color ?? branchColorForIndex(index),
  }));

  const workingChanges =
    data.changedFiles?.map((file) => `${file.status} ${file.file}`) ??
    (data.stagedChanges > 0 ? ["Cambios detectados en el repositorio"] : []);

  return {
    branchName: data.branchName,
    commits,
    branches,
    changedFiles: data.changedFiles ?? [],
    workingChanges,
    stagedChanges: data.stagedChanges,
    pushedPointId: data.pushedPointId,
    remoteStatus: data.remoteStatus,
    lastAction: "idle",
    headId: data.headId,
    repoPath: data.repoPath,
    hasRemote: data.hasRemote,
    remoteUrl: data.remoteUrl,
    isDetachedHead: data.isDetachedHead,
  };
}

export function getActionFromInput(input: string, repository: RepositoryState): GitAction | null {
  const normalized = input.trim().toLowerCase();

  const explicitMergeIntoMain = matchesAny(normalized, [
    /\bhaz merge con main\b/,
    /\bmerge con main\b/,
    /\bfusiona .* con main\b/,
    /\bfusiona .* en main\b/,
    /\bmergea .* en main\b/,
    /\bmete .* en main\b/,
  ]);

  if (explicitMergeIntoMain) {
    const currentBranch = repository.branchName;
    return {
      type: "merge",
      label: "Fusionar rama actual en main",
      naturalExplanation:
        "Voy a cambiar a main y fusionar allí la rama actual para que sus cambios entren en la línea principal.",
      gitTranslation: ["git checkout main", `git merge ${currentBranch}`],
      accent: "from-emerald-400/80 to-cyan-300/80",
      previewChanges: [...examplesByAction.merge],
      targetBranch: currentBranch,
    };
  }

  if (
    containsAny(normalized, [
      "merge",
      "fusiona",
      "fusionar",
      "unir ramas",
      "mezcla ramas",
      "combina ramas",
    ])
  ) {
    const currentBranch = repository.branchName;
    return {
      type: "merge",
      label: "Fusionar rama actual en main",
      naturalExplanation:
        "Voy a llevar tu rama actual hacia main y fusionarla allí para que sus cambios entren en la línea principal.",
      gitTranslation: [`git checkout main`, `git merge ${currentBranch}`],
      accent: "from-emerald-400/80 to-cyan-300/80",
      previewChanges: [...examplesByAction.merge],
      targetBranch: currentBranch,
    };
  }

  if (
    containsAny(normalized, [
      "rebase",
      "rebasa",
      "reorganiza la rama",
      "reordena commits",
      "pon esto encima",
    ])
  ) {
    const ontoBranch =
      repository.branchName === "main"
        ? repository.branches.find((branch) => branch.name !== "main")?.name ?? "main"
        : "main";
    return {
      type: "rebase",
      label: "Reordenar con rebase",
      naturalExplanation:
        "Voy a reubicar tu rama sobre una base más reciente para que la historia quede más lineal.",
      gitTranslation: [`git rebase ${ontoBranch}`],
      accent: "from-violet-400/80 to-fuchsia-300/80",
      previewChanges: [...examplesByAction.rebase],
      targetBranch: ontoBranch,
    };
  }

  if (
    containsAny(normalized, [
      "guarda",
      "guardar",
      "hecho ahora",
      "save",
      "commit",
      "copia de seguridad",
    ])
  ) {
    return {
      type: "commit",
      label: "Guardar progreso",
      naturalExplanation:
        "Voy a guardar lo que has hecho ahora creando un nuevo Punto de Guardado entendible y seguro.",
      gitTranslation: ['git add .', 'git commit -m "Guardar progreso visual"'],
      accent: "from-emerald-400/80 to-teal-300/80",
      previewChanges: [...examplesByAction.commit],
    };
  }

  if (
    containsAny(normalized, [
      "rama",
      "branch",
      "multiverso",
      "camino alternativo",
      "version paralela",
      "separa esto",
    ])
  ) {
    const nextBranchName = repository.branches.length === 1 ? "idea-ui" : `idea-${repository.branches.length}`;
    return {
      type: "branch",
      label: "Crear un multiverso nuevo",
      naturalExplanation:
        "Voy a abrir una rama paralela para que explores otra versión sin tocar la historia principal.",
      gitTranslation: [`git checkout -b ${nextBranchName}`],
      accent: "from-fuchsia-400/80 to-violet-300/80",
      previewChanges: [
        "Se crea un carril nuevo en el grafo",
        "La historia principal queda intacta",
        "Podrás experimentar en paralelo con seguridad",
      ],
    };
  }

  if (
    containsAny(normalized, [
      "sube",
      "subelo",
      "súbelo",
      "internet",
      "nube",
      "push",
      "publica",
      "subir",
    ])
  ) {
    return {
      type: "push",
      label: "Subir a la nube",
      naturalExplanation:
        "Voy a subir tu último Punto de Guardado para que quede respaldado y sincronizado fuera de tu ordenador.",
      gitTranslation: [`git push origin ${repository.branchName}`],
      accent: "from-sky-400/80 to-cyan-300/80",
      previewChanges: [...examplesByAction.push],
    };
  }

  if (
    containsAny(normalized, [
      "volver",
      "ayer",
      "anterior",
      "deshacer",
      "reset",
      "checkout",
      "retrocede",
    ])
  ) {
    return {
      type: "restore",
      label: "Volver a un punto anterior",
      naturalExplanation:
        "Voy a mostrarte cómo volver a un momento anterior de la historia sin que pierdas el contexto actual.",
      gitTranslation: ["git checkout <punto-anterior>", "git reset --soft HEAD~1"],
      accent: "from-amber-400/80 to-orange-300/80",
      previewChanges: [...examplesByAction.restore],
    };
  }

  return null;
}

export function simulateAction(repository: RepositoryState, action: GitAction) {
  const nextState = cloneRepository(repository);
  const currentHead = getCurrentHead(nextState);

  if (action.type === "commit") {
    const nextIndex = nextState.commits.length;
    const newPoint = createPoint(
      nextPointId(nextIndex),
      nextPointLabel(nextIndex),
      "Guardado generado a partir de lenguaje natural",
      "commit",
      nextState.branchName,
      new Date().toISOString(),
      currentHead?.id,
    );

    nextState.commits.push(newPoint);
    nextState.headId = newPoint.id;
    updateBranchHead(nextState, nextState.branchName, newPoint.id);
    nextState.stagedChanges = 0;
    nextState.workingChanges = [];
    nextState.remoteStatus = `${newPoint.label} creado localmente y pendiente de subir`;
    nextState.lastAction = "commit";

    return {
      nextState,
      summary: `Se creará ${newPoint.label} con una copia segura de tu trabajo actual.`,
      backupLabel: newPoint.label,
    };
  }

  if (action.type === "push") {
    const lastPoint = getCurrentHead(nextState) ?? nextState.commits[nextState.commits.length - 1];
    const pushedPoint = createPoint(
      `${lastPoint.id}-cloud`,
      `${lastPoint.label} sincronizado`,
      "Copia compartida en la nube",
      "push",
      nextState.branchName,
      new Date().toISOString(),
      lastPoint.id,
      lastPoint.id,
    );

    nextState.commits.push(pushedPoint);
    nextState.pushedPointId = lastPoint.id;
    nextState.remoteStatus = `La nube ahora refleja ${lastPoint.label}`;
    nextState.lastAction = "push";

    return {
      nextState,
      summary: `Tu historial mostrará que ${lastPoint.label} también quedó sincronizado en la nube.`,
      backupLabel: lastPoint.label,
    };
  }

  if (action.type === "branch") {
    const sourceHead = getCurrentHead(nextState) ?? nextState.commits[nextState.commits.length - 1];
    const branchName = action.gitTranslation[0]?.split(" ").at(-1) ?? `idea-${nextState.branches.length}`;
    const branchPoint = createPoint(
      `${sourceHead.id}-branch-${nextState.branches.length}`,
      `Rama ${branchName}`,
      `Nuevo multiverso abierto desde ${sourceHead.label}`,
      "branch",
      branchName,
      new Date().toISOString(),
      sourceHead.id,
      sourceHead.id,
    );

    nextState.commits.push(branchPoint);
    nextState.branches.push(
      buildBranch(branchName, branchPoint.id, nextState.branches.length, sourceHead.id),
    );
    nextState.branchName = branchName;
    nextState.headId = branchPoint.id;
    nextState.remoteStatus = `Se abrió la rama ${branchName} como línea paralela`;
    nextState.lastAction = "branch";
    nextState.stagedChanges = 2;
    nextState.workingChanges = [
      `Exploración visual iniciada en ${branchName}`,
      "Cambios experimentales listos para probar",
    ];

    return {
      nextState,
      summary: `Se abrirá ${branchName} como una historia paralela conectada a ${sourceHead.label}.`,
      backupLabel: sourceHead.label,
    };
  }

  if (action.type === "merge") {
    const currentBranchName = nextState.branchName;
    const sourceBranch =
      nextState.branches.find((branch) => branch.name === currentBranchName) ?? nextState.branches[0];
    const mainBranch =
      nextState.branches.find((branch) => branch.name === "main") ?? nextState.branches[0];
    const sourceHead =
      nextState.commits.find((point) => point.id === sourceBranch?.headId) ?? nextState.commits.at(-1);
    const mainHead =
      nextState.commits.find((point) => point.id === mainBranch?.headId) ?? nextState.commits.at(-1);
    const mergePoint = createPoint(
      `${mainHead?.id ?? "main"}-merge-${sourceHead?.id ?? "source"}`,
      `Merge de ${sourceBranch?.name ?? "rama actual"} en main`,
      `La rama ${sourceBranch?.name ?? "actual"} se fusiona dentro de main`,
      "merge",
      "main",
      new Date().toISOString(),
      mainHead?.id,
      sourceHead?.id,
    );

    nextState.commits.push(mergePoint);
    nextState.headId = mergePoint.id;
    nextState.branchName = "main";
    updateBranchHead(nextState, "main", mergePoint.id);
    nextState.remoteStatus = `Merge preparado: ${sourceBranch?.name ?? "rama actual"} entrará en main`;
    nextState.lastAction = "merge";

    return {
      nextState,
      summary: `La rama actual ${sourceBranch?.name ?? "actual"} se fusionará dentro de main.`,
      backupLabel: mainHead?.label ?? sourceHead?.label ?? "punto actual",
    };
  }

  if (action.type === "rebase") {
    const baseBranch =
      nextState.branches.find((branch) => branch.name !== nextState.branchName) ?? nextState.branches[0];
    const rebasedPoint = createPoint(
      `${currentHead?.id ?? "head"}-rebase`,
      `Rebase sobre ${baseBranch?.name ?? nextState.branchName}`,
      `La línea ${nextState.branchName} se recoloca sobre ${baseBranch?.name ?? "la nueva base"}`,
      "rebase",
      nextState.branchName,
      new Date().toISOString(),
      currentHead?.id,
      baseBranch?.headId,
    );

    nextState.commits.push(rebasedPoint);
    nextState.headId = rebasedPoint.id;
    updateBranchHead(nextState, nextState.branchName, rebasedPoint.id);
    nextState.remoteStatus = `Rebase preparado sobre ${baseBranch?.name ?? "la rama base"}`;
    nextState.lastAction = "rebase";

    return {
      nextState,
      summary: `La historia de ${nextState.branchName} se reorganizará sobre ${baseBranch?.name ?? "la base actual"}.`,
      backupLabel: currentHead?.label ?? "punto actual",
    };
  }

  const previousCommit =
    [...nextState.commits]
      .reverse()
      .find((point) => point.type === "commit" && point.id !== currentHead?.id) ??
    nextState.commits[0];

  const restorePoint = createPoint(
    `${previousCommit.id}-restore`,
    `Volver a ${previousCommit.label}`,
    "Recuperación visual de una versión anterior",
    "restore",
    nextState.branchName,
    new Date().toISOString(),
    currentHead?.id,
    previousCommit.id,
  );

  nextState.commits.push(restorePoint);
  nextState.headId = restorePoint.id;
  updateBranchHead(nextState, nextState.branchName, restorePoint.id);
  nextState.workingChanges = [`Interfaz recuperada desde ${previousCommit.label}`];
  nextState.stagedChanges = 1;
  nextState.remoteStatus = `Vista preparada para regresar a ${previousCommit.label}`;
  nextState.lastAction = "restore";

  return {
    nextState,
    summary: `La historia mostrará un regreso seguro hasta ${previousCommit.label} antes de aplicarlo.`,
    backupLabel: previousCommit.label,
  };
}

export function checkoutToPoint(repository: RepositoryState, pointId: string): RepositoryState {
  const nextState = cloneRepository(repository);
  const targetPoint = nextState.commits.find((point) => point.id === pointId);

  if (!targetPoint) {
    return nextState;
  }

  nextState.headId = targetPoint.id;
  nextState.branchName = targetPoint.branch;
  nextState.remoteStatus = `HEAD situado visualmente en ${targetPoint.label}`;
  nextState.lastAction = "restore";
  nextState.workingChanges = [`Vista activa movida a ${targetPoint.label}`];
  nextState.stagedChanges = 0;
  updateBranchHead(nextState, targetPoint.branch, targetPoint.id);

  return nextState;
}

export function createAssistantConfirmation(action: GitAction): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    subject: `Gitly "${action.label}"`,
    content:
      `Entendido. ${action.naturalExplanation} Para hacer esto, voy a crear una "Copia de Seguridad". ` +
      "Esto guardará tu trabajo actual en el punto A para que nunca lo pierdas. ¿Confirmas?",
    timestamp: new Date().toISOString(),
    kind: "confirmation",
  };
}

export function createAssistantResult(action: GitAction, summary: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    subject: `Gitly "${action.label}"`,
    content: `${action.label} preparado. ${summary}`,
    timestamp: new Date().toISOString(),
    kind: "result",
  };
}

export function simulateCheckout(repository: RepositoryState, pointId: string) {
  const nextState = cloneRepository(repository);
  const targetPoint = nextState.commits.find((point) => point.id === pointId);

  if (!targetPoint) {
    return null;
  }

  nextState.headId = targetPoint.id;
  nextState.branchName = targetPoint.branch;
  nextState.remoteStatus = `HEAD movido a ${targetPoint.label} para explorar ${targetPoint.branch}`;

  return {
    nextState,
    targetPoint,
  };
}

export function createAssistantCheckoutMessage(point: SavePoint): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    subject: 'Gitly "Exploración"',
    content: `He resaltado ${point.label} como referencia visual. La línea temporal principal no cambia; solo estás explorando ese punto de la historia.`,
    timestamp: new Date().toISOString(),
    kind: "normal",
  };
}

export function createSyncStatusMessage(repository: RepositoryState): ChatMessage {
  const repoName = repository.repoPath?.split(/[/\\]/).pop() ?? "repositorio";
  const remoteText = repository.hasRemote
    ? `Remoto conectado${repository.remoteUrl ? ` a ${repository.remoteUrl}` : ""}.`
    : "Todavía no hay remoto configurado.";

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    subject: 'Gitly "Sincronización"',
    content:
      `He conectado Gitly con el repositorio real **${repoName}** en la rama **${repository.branchName}**. ` +
      `${remoteText} Ahora puedo leer el historial, detectar cambios sin guardar y ejecutar acciones reales de Git con tu confirmación.`,
    timestamp: new Date().toISOString(),
    kind: "normal",
  };
}

export function createUnknownIntentMessage(input?: string): ChatMessage {
  const suffix = input ? ` Mensaje recibido: "${input}".` : "";
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    subject: 'Gitly "Acción no identificada"',
    content:
      "No he identificado una acción de Git válida en ese mensaje, así que no puedo realizarla. " +
      "Prueba con algo como guardar, subir, volver, crear una rama, fusionar o hacer rebase." +
      suffix,
    timestamp: new Date().toISOString(),
    kind: "fallback",
  };
}

