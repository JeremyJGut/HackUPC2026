"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, FolderGit2, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { GitTreeVisualizer } from "@/components/git-tree-visualizer";
import {
  checkoutToPoint,
  createAssistantConfirmation,
  createAssistantResult,
  createInitialRepository,
  createInitialMessages,
  createUnknownIntentMessage,
  getActionFromInput,
  simulateAction,
} from "@/lib/git-simulator";
import type {
  ChatMessage,
  GitOperationResponse,
  PendingAction,
  RepoApiResponse,
  RepositoryState,
  RepoStatusResponse,
} from "@/lib/types";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

const suggestionPhrases = [
  "Guarda lo que he hecho ahora",
  "Haz merge de la rama actual",
  "Haz rebase sobre main",
  "Crea una rama paralela para experimentar",
  "Súbelo a internet",
  "Quiero volver a lo de ayer",
];

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "No se pudo completar la operación Git.");
  }

  return data;
}

export default function Home() {
  const [repository, setRepository] = useState<RepositoryState>(createInitialRepository());
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoadingRepo, setIsLoadingRepo] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const hasWelcomedRef = useRef(false);

  const stats = useMemo(
    () => [
      {
        label: "Puntos de guardado",
        value: repository.commits.length.toString().padStart(2, "0"),
        icon: ShieldCheck,
      },
      {
        label: "Cambios preparados",
        value: String(repository.stagedChanges),
        icon: Sparkles,
      },
      {
        label: "Estado de nube",
        value: repository.remoteStatus || (repository.lastAction === "push" ? "Sincronizado" : "Local"),
        icon: CloudUpload,
      },
    ],
    [repository],
  );

  const addAssistantMessage = useCallback((content: string, kind: ChatMessage["kind"] = "normal") => {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
        kind,
      },
    ]);
  }, []);

  const loadRepository = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setIsLoadingRepo(true);
      }

      try {
        const data = await apiFetch<RepoApiResponse>("/api/repo");
        setRepository(data.repository);
        setIsConnected(true);

        if (!hasWelcomedRef.current) {
          hasWelcomedRef.current = true;
          setMessages([
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content:
                `Conectado con tu repositorio real en ${data.repository.repoPath ?? "/workspace"}.\n\n` +
                `Rama activa: ${data.repository.branchName}. ` +
                `Tienes ${data.repository.commits.length} puntos visibles en la historia y ` +
                `${data.repository.changedFiles?.length ?? 0} archivo(s) con cambios.`,
              timestamp: new Date().toISOString(),
              kind: "normal",
            },
          ]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo conectar con la capa de Git real.";
        setIsConnected(false);
        if (!quiet) {
          addAssistantMessage(
            `No he podido conectar con Git real todavía.\n\n${message}\n\n` +
              "Seguiré mostrando la interfaz, pero las operaciones reales no estarán disponibles hasta que el repositorio sea accesible.",
            "fallback",
          );
        }
      } finally {
        if (!quiet) {
          setIsLoadingRepo(false);
        }
      }
    },
    [addAssistantMessage],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();

      if (!transcript) {
        return;
      }

      setInput(transcript);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Te escuché decir: "${transcript}". Puedes enviarlo o editarlo antes de confirmar.`,
          timestamp: new Date().toISOString(),
          kind: "transcript",
        },
      ]);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    void loadRepository(false);
  }, [loadRepository]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (!isConnected || pendingAction || isExecuting) {
        return;
      }

      try {
        await loadRepository(true);
      } catch {
        // silent polling failure
      }
    }, 8000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isConnected, pendingAction, isExecuting, loadRepository]);

  const handleSubmit = (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const action = getActionFromInput(trimmed, repository);

    if (!action) {
      setMessages((current) => [...current, userMessage, createUnknownIntentMessage(trimmed)]);
      setInput("");
      return;
    }

    const simulation = simulateAction(repository, action);

    setMessages((current) => [...current, userMessage, createAssistantConfirmation(action)]);
    setPendingAction({
      action,
      before: repository,
      after: simulation.nextState,
      summary: simulation.summary,
      backupLabel: simulation.backupLabel,
    });
    setInput("");
  };

  const handleConfirm = async () => {
    if (!pendingAction) {
      return;
    }

    setIsExecuting(true);

    try {
      let response: GitOperationResponse;
      if (pendingAction.action.type === "commit") {
        const commitMessage = input.trim() || "GitEase: Guardado desde lenguaje natural";
        response = await apiFetch<GitOperationResponse>("/api/commit", {
          method: "POST",
          body: JSON.stringify({ message: commitMessage }),
        });
      } else if (pendingAction.action.type === "push") {
        response = await apiFetch<GitOperationResponse>("/api/push", {
          method: "POST",
        });
      } else if (pendingAction.action.type === "restore") {
        response = await apiFetch<GitOperationResponse>("/api/reset", {
          method: "POST",
          body: JSON.stringify({ mode: "soft" }),
        });
      } else if (pendingAction.action.type === "merge") {
        response = await apiFetch<GitOperationResponse>("/api/merge", {
          method: "POST",
          body: JSON.stringify({
            sourceBranch: pendingAction.action.targetBranch ?? pendingAction.action.gitTranslation[0]?.split(" ").at(-1),
          }),
        });
      } else if (pendingAction.action.type === "rebase") {
        response = await apiFetch<GitOperationResponse>("/api/rebase", {
          method: "POST",
          body: JSON.stringify({
            onto: pendingAction.action.targetBranch ?? pendingAction.action.gitTranslation[0]?.split(" ").at(-1),
          }),
        });
      } else {
        const branchName = pendingAction.action.gitTranslation[0]?.split(" ").at(-1) ?? "idea-gitease";
        response = await apiFetch<GitOperationResponse>("/api/branch", {
          method: "POST",
          body: JSON.stringify({ name: branchName }),
        });
      }

      setRepository(response.repository);
      setMessages((current) => [...current, createAssistantResult(pendingAction.action, response.message)]);
      setPendingAction(null);
      await loadRepository(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo ejecutar la operación Git.";
      addAssistantMessage(`He intentado ejecutar la acción real, pero Git devolvió este error:\n\n${message}`, "fallback");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClose = () => {
    setPendingAction(null);
  };

  const handleCheckoutSelect = (pointId: string) => {
    const targetPoint = repository.commits.find((point) => point.id === pointId);
    if (!targetPoint) {
      return;
    }

    const nextRepository = checkoutToPoint(repository, pointId);
    setRepository(nextRepository);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `He movido el HEAD hacia ${targetPoint.label}. Es una simulación visual de checkout para que veas cómo cambiaría tu historia.`,
        timestamp: new Date().toISOString(),
        kind: "result",
      },
    ]);
  };

  const handleMicClick = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }

      recognitionRef.current.start();
      setIsListening(true);
      return;
    }

    setIsListening(true);
    window.setTimeout(() => {
      const fallbackTranscript = "Súbelo a internet";
      setInput(fallbackTranscript);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Modo demo: he simulado la voz con "${fallbackTranscript}".`,
          timestamp: new Date().toISOString(),
          kind: "transcript",
        },
      ]);
      setIsListening(false);
    }, 1200);
  };

  const statusBadge = isConnected
    ? {
        icon: <FolderGit2 className="h-3.5 w-3.5" />,
        text: isLoadingRepo ? "Conectando con Git..." : "Git real conectado",
        className: "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
      }
    : {
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        text: "Modo desconectado",
        className: "border border-amber-400/30 bg-amber-400/10 text-amber-100",
      };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_35%),linear-gradient(180deg,#07111f,#020617)] px-4 py-6 text-slate-100 sm:px-6 lg:h-[100dvh] lg:overflow-hidden xl:px-8">
      <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-6">
        <motion.header
          className="flex flex-col gap-5 rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                GitEase MVP
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}>
                {statusBadge.icon}
                {statusBadge.text}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Git explicado como si fuera una historia.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Traduce voz o lenguaje natural a acciones seguras, muestra una copia de seguridad antes de
                ejecutar y visualiza la evolucion del proyecto con puntos de guardado intuitivos.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="min-w-[160px] rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4"
              >
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Icon className="h-4 w-4 text-indigo-300" />
                  {label}
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </motion.header>

        <section className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(280px,24vw,380px)] lg:items-stretch">
          <motion.section
            className="min-h-[640px] lg:min-h-0 lg:h-full lg:w-full"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
          >
            <GitTreeVisualizer
              repository={repository}
              pending={pendingAction?.after}
              onCheckoutSelect={handleCheckoutSelect}
            />
          </motion.section>

          <motion.aside
            className="min-h-[640px] rounded-[32px] border border-white/10 bg-white/6 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-xl lg:justify-self-end lg:min-h-0 lg:h-full lg:w-full lg:max-w-[380px] lg:overflow-hidden"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <ChatPanel
              messages={messages}
              input={input}
              isListening={isListening}
              onInputChange={setInput}
              onSubmit={() => handleSubmit(input)}
              onMicClick={handleMicClick}
              suggestions={suggestionPhrases}
            />
          </motion.aside>
        </section>
      </div>

      <AnimatePresence>
        {pendingAction && (
          <ConfirmationModal pending={pendingAction} onClose={handleClose} onConfirm={handleConfirm} />
        )}
      </AnimatePresence>
    </main>
  );
}
