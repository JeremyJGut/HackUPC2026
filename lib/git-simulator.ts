import type { BranchTrack, ChatMessage, GitAction, RepositoryState, SavePoint } from "./types";

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
} as const;

const containsAny = (text: string, candidates: string[]) =>
  candidates.some((candidate) => text.includes(candidate));

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
      content:
        "Hola, soy GitEase. Puedes decir cosas como “Guarda lo que he hecho ahora”, “Súbelo a internet” o “Quiero volver a lo de ayer”.",
      timestamp: new Date().toISOString(),
      kind: "normal",
    },
  ];
}

export function getActionFromInput(input: string, repository: RepositoryState): GitAction {
  const normalized = input.trim().toLowerCase();

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

  return {
    type: "commit",
    label: "Guardar con ayuda guiada",
    naturalExplanation:
      "No identifiqué una intención exacta, así que propongo un guardado seguro como siguiente paso más útil para no perder trabajo.",
    gitTranslation: ['git add .', 'git commit -m "Guardado sugerido por GitEase"'],
    accent: "from-violet-400/80 to-indigo-300/80",
    previewChanges: [...examplesByAction.commit],
  };
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

export function createAssistantConfirmation(action: GitAction): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
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
    content: `${action.label} preparado. ${summary}`,
    timestamp: new Date().toISOString(),
    kind: "result",
  };
}

